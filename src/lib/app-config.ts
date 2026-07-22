// === Config globale de l'appli (table Supabase `app_config`) ===
// Interrupteurs SERVEUR lus au runtime : une fois l'app publiée, un admin peut activer /
// désactiver une fonctionnalité SANS rebuild ni mise à jour. Lecture publique (RLS),
// écriture réservée aux admins (profils.est_admin).
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getMagasin } from '@/store/magasin';

// Commande en ligne : activable PAR MAGASIN. valeur = objet { [magasinId]: boolean }.
// Magasin absent / non défini → DÉSACTIVÉ (l'appli sert d'abord à la fidélité).
export const FLAG_COMMANDE = 'commande_en_ligne_active';

// Lit la map { magasinId: actif } (objet vide si absent / erreur réseau → tout désactivé).
export async function lireCommandeMagasins(): Promise<Record<string, boolean>> {
  try {
    const { data } = await supabase.from('app_config').select('valeur').eq('cle', FLAG_COMMANDE).maybeSingle();
    const v = data?.valeur;
    return (v && typeof v === 'object' && !Array.isArray(v)) ? (v as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

// Active / désactive la commande pour UN magasin (lecture-modif-écriture de la map).
// Admin uniquement (RLS). Renvoie true si OK.
export async function ecrireCommandeMagasin(magasin: string, valeur: boolean): Promise<boolean> {
  const map = await lireCommandeMagasins();
  const nouveau = { ...map, [magasin]: valeur };
  const { error } = await supabase
    .from('app_config')
    .upsert({ cle: FLAG_COMMANDE, valeur: nouveau, updated_at: new Date().toISOString() }, { onConflict: 'cle' });
  return !error;
}

// --- 💳 Carte cadeau / solde prépayé : paliers de bonus LIVE ---
// Cette configuration est lue à chaque recharge par l'Edge `solde-api` : une modification
// admin change donc les prochains bonus sans OTA, sans build et sans toucher les soldes acquis.
export const FLAG_CARTE_CADEAU = 'carte_cadeau';

export type PalierCarteCadeau = { des_centimes: number; bonus_pct: number };
export type ConfigCarteCadeau = {
  actif: boolean;
  min_centimes: number;
  paliers: PalierCarteCadeau[];
};

const CONFIG_CARTE_CADEAU_DEFAUT: ConfigCarteCadeau = {
  actif: true,
  min_centimes: 1000,
  paliers: [],
};

function parserConfigCarteCadeau(valeur: unknown): ConfigCarteCadeau {
  const v = valeur && typeof valeur === 'object' && !Array.isArray(valeur)
    ? valeur as { actif?: boolean; min_centimes?: unknown; paliers?: unknown }
    : {};
  const minimum = Math.round(Number(v.min_centimes));
  const paliers = Array.isArray(v.paliers)
    ? v.paliers
      .map((p) => ({
        des_centimes: Math.round(Number((p as PalierCarteCadeau)?.des_centimes)),
        bonus_pct: Number((p as PalierCarteCadeau)?.bonus_pct),
      }))
      .filter((p) => p.des_centimes > 0 && p.bonus_pct > 0)
      .sort((a, b) => a.des_centimes - b.des_centimes)
    : [];
  return {
    actif: v.actif !== false,
    min_centimes: minimum > 0 ? minimum : CONFIG_CARTE_CADEAU_DEFAUT.min_centimes,
    paliers,
  };
}

export async function lireConfigCarteCadeau(): Promise<ConfigCarteCadeau | null> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('valeur')
      .eq('cle', FLAG_CARTE_CADEAU)
      .maybeSingle();
    if (error) return null;
    return parserConfigCarteCadeau(data?.valeur);
  } catch {
    return null;
  }
}

// Écriture admin en lecture-modif-écriture : préserve toute future clé inconnue de la config.
export async function ecrireConfigCarteCadeau(config: ConfigCarteCadeau): Promise<boolean> {
  try {
    const { data, error: erreurLecture } = await supabase
      .from('app_config')
      .select('valeur')
      .eq('cle', FLAG_CARTE_CADEAU)
      .maybeSingle();
    if (erreurLecture) return false;
    const courant = data?.valeur && typeof data.valeur === 'object' && !Array.isArray(data.valeur)
      ? data.valeur as Record<string, unknown>
      : {};
    const paliers = config.paliers
      .map((p) => ({
        des_centimes: Math.round(p.des_centimes),
        bonus_pct: Number(p.bonus_pct),
      }))
      .sort((a, b) => a.des_centimes - b.des_centimes);
    const { error } = await supabase.from('app_config').upsert({
      cle: FLAG_CARTE_CADEAU,
      valeur: {
        ...courant,
        actif: config.actif,
        min_centimes: Math.round(config.min_centimes),
        paliers,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'cle' });
    return !error;
  } catch {
    return false;
  }
}

// --- 🕹️ Jeu Boba Quest : interrupteurs GLOBAUX (cf. AGENTS.md « Interrupteur ADMIN du jeu ») ---
// valeur = { actif: boolean, selection: boolean, admin: boolean } :
//   · actif = visible pour TOUS les clients (non-admins)
//   · selection = visible pour les clients autorisés individuellement dans
//     `jeu_acces_membres` quand `actif` est false
//   · admin = visible pour les ADMINS (clé ABSENTE = true — compat build 24 où l'admin
//     voyait toujours le jeu ; la build 24 ignore simplement la clé admin)
// Ligne absente = caché pour tous. Erreur réseau → CACHE AsyncStorage (offline) ;
// sans cache non plus → caché (fail-closed : on livre invisible).
export const FLAG_JEU = 'jeu';
const CACHE_JEU = 'appConfig.jeuActif';

export type JeuFlags = { actif: boolean; selectionActive: boolean; adminVisible: boolean };

// Lit les TROIS interrupteurs serveur. null = réseau KO (utiliser le cache).
export async function lireJeuFlags(): Promise<JeuFlags | null> {
  try {
    const { data } = await supabase.from('app_config').select('valeur').eq('cle', FLAG_JEU).maybeSingle();
    const v = data?.valeur as { actif?: boolean; selection?: boolean; admin?: boolean } | null;
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      return { actif: false, selectionActive: true, adminVisible: true };
    }
    return {
      actif: !!v.actif,
      selectionActive: v.selection !== false,
      adminVisible: v.admin !== false,
    };
  } catch {
    return null;
  }
}

// Écrit un ou plusieurs interrupteurs (lecture-modif-écriture : ne perd JAMAIS les autres clés).
// Admin uniquement (RLS). Renvoie true si OK.
export async function ecrireJeuFlags(patch: Partial<JeuFlags>): Promise<boolean> {
  const courant = (await lireJeuFlags()) ?? { actif: false, selectionActive: true, adminVisible: true };
  const nv = { ...courant, ...patch };
  const { error } = await supabase
    .from('app_config')
    .upsert({
      cle: FLAG_JEU,
      valeur: { actif: nv.actif, selection: nv.selectionActive, admin: nv.adminVisible },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'cle' });
  if (!error) AsyncStorage.setItem(CACHE_JEU, JSON.stringify(nv)).catch(() => {});
  return !error;
}

// Compat : lecture du seul flag clients (utilisé par d'anciens appels)
export async function lireJeuActif(): Promise<boolean | null> {
  const f = await lireJeuFlags();
  return f === null ? null : f.actif;
}

// Compat : bascule clients — préserve désormais la clé admin (avant : l'upsert l'écrasait)
export async function ecrireJeuActif(actif: boolean): Promise<boolean> {
  return ecrireJeuFlags({ actif });
}

// Cache : accepte l'ancien format '1'/'0' (build 24) ET les anciens JSON sans `selectionActive`.
function parserCacheJeu(brut: string | null): JeuFlags | null {
  if (brut === null) return null;
  if (brut === '1' || brut === '0') {
    return { actif: brut === '1', selectionActive: true, adminVisible: true };
  }
  try {
    const v = JSON.parse(brut);
    return {
      actif: !!v.actif,
      selectionActive: v.selectionActive !== false,
      adminVisible: v.adminVisible !== false,
    };
  } catch { return null; }
}

// Hook : le jeu est-il visible pour CET utilisateur ?
//   · client (non-admin) → flag `actif` OU (`selection` ET autorisation individuelle)
//   · admin              → flag `admin`, indépendant des modes clients
// Relit les flags au montage ET à chaque retour sur l'écran (useFocusEffect) : une bascule
// à distance prend effet dès la prochaine navigation, sans relancer l'appli.
// L'état du joueur (perles, collection…) n'est JAMAIS purgé : caché ≠ effacé.
export function useJeuVisible() {
  const [etat, setEtat] = useState<{
    visible: boolean;
    actif: boolean;
    selectionActive: boolean;
    autorise: boolean;
    admin: boolean;
    charge: boolean;
  }>(
    { visible: false, actif: false, selectionActive: true, autorise: false, admin: false, charge: false },
  );
  useFocusEffect(useCallback(() => {
    let vivant = true;
    (async () => {
      // 1) cache : verdict immédiat hors-ligne / avant la réponse serveur
      let cache: JeuFlags | null = null;
      try { cache = parserCacheJeu(await AsyncStorage.getItem(CACHE_JEU)); } catch { /* ignore */ }
      if (vivant && cache !== null) {
        const c = cache;
        setEtat((e) => ({
          ...e,
          actif: c.actif,
          selectionActive: c.selectionActive,
          visible: __DEV__ || (e.admin ? c.adminVisible : c.actif),
        }));
      }
      // 2) serveur : la vérité (+ statut admin + autorisation individuelle).
      // L'autorisation individuelle n'est volontairement PAS mise en cache : si
      // l'accès est retiré, un redémarrage hors-ligne ne doit pas le conserver.
      const serveur = await lireJeuFlags();
      let admin = false;
      let autorise = false;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const [{ data: profil }, { data: acces }] = await Promise.all([
            supabase.from('profils').select('est_admin').eq('id', session.user.id).maybeSingle(),
            supabase.from('jeu_acces_membres').select('actif').eq('profil_id', session.user.id).maybeSingle(),
          ]);
          admin = !!profil?.est_admin;
          autorise = acces?.actif === true;
        }
      } catch { /* ignore */ }
      const flags = serveur ?? cache ?? { actif: false, selectionActive: false, adminVisible: false };
      if (serveur !== null) AsyncStorage.setItem(CACHE_JEU, JSON.stringify(serveur)).catch(() => {});
      if (vivant) setEtat({
        visible: __DEV__ || (admin
          ? flags.adminVisible
          : flags.actif || (flags.selectionActive && autorise)),
        actif: flags.actif,
        selectionActive: flags.selectionActive,
        autorise,
        admin,
        charge: true,
      }); // __DEV__ : testable en simulateur sans session (aucun effet en prod)
    })();
    return () => { vivant = false; };
  }, []));
  return etat;
}

// Hook : la commande en ligne est-elle accessible pour CET utilisateur ?
// accessible = commande activée pour SON magasin OU admin (l'admin teste avant d'ouvrir à tous).
export function useCommandeEnLigne() {
  const [etat, setEtat] = useState<{ actif: boolean; admin: boolean; charge: boolean }>(
    { actif: false, admin: false, charge: false },
  );
  useEffect(() => {
    let vivant = true;
    (async () => {
      const map = await lireCommandeMagasins();
      let admin = false;
      let magasin: string | null = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data } = await supabase.from('profils').select('est_admin,magasin').eq('id', session.user.id).maybeSingle();
          admin = !!data?.est_admin;
          magasin = data?.magasin ?? null;
        }
      } catch { /* ignore */ }
      if (!magasin) magasin = getMagasin(); // pas connecté / pas encore verrouillé → magasin sélectionné
      const actif = !!(magasin && map[magasin]);
      if (vivant) setEtat({ actif, admin, charge: true });
    })();
    return () => { vivant = false; };
  }, []);
  return etat;
}
