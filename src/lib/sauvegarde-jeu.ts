// === 💾 Synchronisation de la progression Boba Quest avec le serveur (26/07/2026) ===
//
// Toute la progression vivait dans AsyncStorage : une réinstallation effaçait tout, y
// compris les prix réels gagnés mais pas encore préparés pour la caisse — qui n'existent
// nulle part ailleurs. Avec le Passeport de la Carte, une carte représente un ACHAT RÉEL :
// la progression cesse d'être un jouet et devient un actif du client.
//
// MODÈLE : le téléphone reste la source de vérité en cours de partie, le serveur est la
// copie qui permet de repartir. Pas de fusion de deux parties parallèles — ce serait un
// vrai moteur de merge, et une source de bugs pire que le problème résolu.
//
// ⚠️ LA RÈGLE QUI PROTÈGE TOUT : on ne POUSSE JAMAIS sans avoir LU le serveur avec
// succès. Une installation neuve (révision 0, état vide) écraserait sinon une sauvegarde
// riche dans la première seconde. `decisionSync` renvoie `attendre` sur lecture échouée,
// et ce module ne pousse que sur `pousser-local`.
import { AppState, type AppStateStatus } from 'react-native';

import { decisionSync, type DecisionSync } from '@/components/jeu/economie';
import { supabase } from '@/lib/supabase';
import { adopterEtatServeur, instantaneEtat } from '@/store/jeu';

/** Anti-rafale : on ne pousse pas à chaque tir de bulle. */
const DELAI_POUSSEE_MS = 20_000;

let pousseeProgrammee: ReturnType<typeof setTimeout> | null = null;
let enCours = false;
let derniereRevisionPoussee = -1;

type Revision = { revision: number | null; maj: string | null };

function diagnostic(message: string, details?: unknown): void {
  if (!__DEV__) return;
  if (details === undefined) console.info(`[Boba sauvegarde] ${message}`);
  else console.info(`[Boba sauvegarde] ${message}`, details);
}

/** Révision côté serveur. Renvoie `undefined` si la lecture a ÉCHOUÉ — la nuance est
 *  capitale : « pas de sauvegarde » et « je ne sais pas » ne se traitent pas pareil. */
async function lireRevisionServeur(): Promise<Revision | undefined> {
  try {
    const { data, error } = await supabase.rpc('revision_jeu_etat');
    if (error) {
      diagnostic('lecture de révision refusée', { code: error.code, message: error.message });
      return undefined;
    }
    const r = (data || {}) as Revision;
    const rev = r.revision === null || r.revision === undefined ? null : Number(r.revision);
    return { revision: rev === null || Number.isNaN(rev) ? null : rev, maj: r.maj ?? null };
  } catch (erreur) {
    diagnostic('lecture de révision impossible', String(erreur));
    return undefined;
  }
}

async function lireEtatServeur(): Promise<{ etat: unknown; revision: number } | null> {
  try {
    const { data, error } = await supabase.from('jeu_etat')
      .select('etat,revision').maybeSingle();
    if (error || !data) return null;
    return { etat: (data as { etat: unknown }).etat, revision: Number((data as { revision: number }).revision) || 0 };
  } catch {
    return null;
  }
}

async function pousser(revision: number, etat: unknown): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('sauver_jeu_etat', { p_revision: revision, p_etat: etat });
    if (error) {
      diagnostic('écriture refusée', { code: error.code, message: error.message, revision });
      return false;
    }
    const resultat = data as { ok?: boolean; erreur?: string } | null;
    if (resultat?.ok !== true) {
      diagnostic('écriture non acceptée', { revision, erreur: resultat?.erreur ?? 'réponse vide' });
      return false;
    }
    diagnostic('écriture acceptée', { revision });
    return true;
  } catch (erreur) {
    diagnostic('écriture impossible', { revision, erreur: String(erreur) });
    return false;
  }
}

/**
 * Un tour de synchronisation. Idempotent, silencieux, et sans effet si quoi que ce soit
 * cloche : ne jamais faire échouer l'ouverture du jeu pour une histoire de sauvegarde.
 * Retourne la décision prise, pour les tests et le diagnostic.
 */
export async function synchroniser(): Promise<DecisionSync> {
  if (enCours) return 'rien';
  enCours = true;
  try {
    if (__DEV__) {
      const { data, error } = await supabase.auth.getSession();
      const expiration = data.session?.expires_at
        ? Math.round(data.session.expires_at - Date.now() / 1000)
        : null;
      diagnostic('session Supabase', {
        presente: Boolean(data.session),
        expirationDansSecondes: expiration,
        erreur: error?.message ?? null,
      });
    }
    const local = instantaneEtat();
    if (!local) {
      diagnostic('état local indisponible');
      return 'attendre';                             // hydratation en cours ou illisible
    }

    const serveur = await lireRevisionServeur();
    const decision = decisionSync(local.revision, serveur === undefined ? undefined : serveur.revision, local.vierge);
    diagnostic('décision', {
      revisionLocale: local.revision,
      revisionServeur: serveur === undefined ? 'lecture-échec' : serveur.revision,
      localVierge: local.vierge,
      decision,
    });

    if (decision === 'adopter-serveur') {
      const distant = await lireEtatServeur();
      if (distant) adopterEtatServeur(distant.etat, distant.revision);
      return decision;
    }
    if (decision === 'pousser-local') {
      if (local.revision === derniereRevisionPoussee) return 'rien';
      const ok = await pousser(local.revision, local.etat);
      if (ok) derniereRevisionPoussee = local.revision;
      // Un refus « revision obsolete » signifie que le serveur est en avance : on
      // adoptera au prochain tour. On ne force JAMAIS.
      return decision;
    }
    return decision;
  } catch {
    return 'attendre';
  } finally {
    enCours = false;
  }
}

/** Programme une poussée différée (anti-rafale). À appeler après une progression. */
export function programmerSauvegarde(): void {
  if (pousseeProgrammee) return;
  pousseeProgrammee = setTimeout(() => {
    pousseeProgrammee = null;
    void synchroniser();
  }, DELAI_POUSSEE_MS);
}

/** Sauvegarde immédiate — au passage en arrière-plan, moment où l'on risque de perdre
 *  l'app. C'est là que ça compte le plus. */
export function sauvegarderMaintenant(): void {
  if (pousseeProgrammee) { clearTimeout(pousseeProgrammee); pousseeProgrammee = null; }
  void synchroniser();
}

/** Branche la sauvegarde sur le cycle de vie de l'app. Renvoie de quoi se débrancher. */
export function surveillerAppState(): () => void {
  const sub = AppState.addEventListener('change', (etat: AppStateStatus) => {
    if (etat === 'background' || etat === 'inactive') sauvegarderMaintenant();
  });
  return () => sub.remove();
}
