// === 🔄 Synchronisation automatique boutique → Boba Quest (27/07/2026) ===
//
// Le scan de la carte ne donne rien à lui seul : il rattache le panier au compte.
// Après encaissement + fiscalisation, le POS publie `achats_lignes`. Ce module relève
// alors ces lignes, met à jour Passeport + Goût et renvoie une notification à l'UI.
//
// Une lecture complète est faite une fois par session de jeu. Ensuite on ne relit que
// les arrivées serveur depuis le dernier `created_at` (important pour le rattrapage
// d'une caisse hors ligne), avec fusion par UUID. Le store garde séparément le curseur
// DÉJÀ ANNONCÉ, synchronisé avec le compte : progression et notification sont donc
// idempotentes même après redémarrage ou changement de téléphone.
import {
  chargerAchatsDetaillees, type LigneAchatDetaillee,
} from '@/lib/achats';
import { programmerSauvegarde } from '@/lib/sauvegarde-jeu';
import { supabase } from '@/lib/supabase';
import {
  achatsPasseportNonVus, appliquerGout, appliquerPasseport,
  marquerAchatsPasseportVus, type MonteeGout,
} from '@/store/jeu';

export type ResultatSynchronisationAchats = {
  historique: LigneAchatDetaillee[];
  nouvellesLignes: number;
  nouvellesBoissons: number;
  nouvellesCartes: string[];
  nouveauxExemplaires: number;
  monteesGout: MonteeGout[];
};

const VIDE: ResultatSynchronisationAchats = {
  historique: [],
  nouvellesLignes: 0,
  nouvellesBoissons: 0,
  nouvellesCartes: [],
  nouveauxExemplaires: 0,
  monteesGout: [],
};

let historique: LigneAchatDetaillee[] | null = null;
let utilisateurMemoire: string | null = null;
let enCours: Promise<ResultatSynchronisationAchats> | null = null;

function fusionner(
  avant: LigneAchatDetaillee[],
  apres: LigneAchatDetaillee[],
): LigneAchatDetaillee[] {
  const parId = new Map(avant.map((l) => [l.id, l]));
  for (const ligne of apres) parId.set(ligne.id, ligne);
  return [...parId.values()].sort((a, b) => {
    const date = Date.parse(a.creeLe) - Date.parse(b.creeLe);
    return date || a.id.localeCompare(b.id);
  });
}

function dernierCreeLe(lignes: LigneAchatDetaillee[]): string | undefined {
  return lignes.length > 0 ? lignes[lignes.length - 1].creeLe : undefined;
}

export function historiqueAchatsJeu(): LigneAchatDetaillee[] {
  return historique ? [...historique] : [];
}

async function executer(): Promise<ResultatSynchronisationAchats> {
  const { data } = await supabase.auth.getSession();
  const utilisateur = data.session?.user?.id || null;
  if (!utilisateur) {
    utilisateurMemoire = null;
    historique = null;
    return { ...VIDE, historique: [] };
  }

  if (utilisateurMemoire !== utilisateur) {
    utilisateurMemoire = utilisateur;
    historique = null; // ne jamais mélanger deux comptes sur le même téléphone
  }

  const existantes = historique || [];
  const ajoutees = await chargerAchatsDetaillees(dernierCreeLe(existantes));
  historique = fusionner(existantes, ajoutees);

  // Toujours recalculer depuis l'historique complet de la session : Passeport et Goût
  // sont monotones, donc une lecture réseau tronquée/échouée ne retire jamais rien.
  const passeport = appliquerPasseport(historique);
  const monteesGout = appliquerGout(historique);
  const nonVues = achatsPasseportNonVus(historique);
  const curseurDeplace = marquerAchatsPasseportVus(nonVues);

  if (passeport.exemplaires > 0 || monteesGout.length > 0 || curseurDeplace) {
    programmerSauvegarde();
  }

  return {
    historique: [...historique],
    nouvellesLignes: nonVues.length,
    nouvellesBoissons: nonVues.reduce(
      (total, ligne) => total + Math.max(1, Math.floor(ligne.quantite || 1)),
      0,
    ),
    nouvellesCartes: passeport.nouvelles,
    nouveauxExemplaires: passeport.exemplaires,
    monteesGout,
  };
}

/** Tour idempotent et sérialisé. Lève sur erreur réseau : l'UI garde alors l'état
 * acquis et réessaie au prochain poll/retour au premier plan. */
export function synchroniserAchatsJeu(): Promise<ResultatSynchronisationAchats> {
  if (enCours) return enCours;
  enCours = executer().finally(() => { enCours = null; });
  return enCours;
}
