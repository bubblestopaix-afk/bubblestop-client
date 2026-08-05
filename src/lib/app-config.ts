// === Config globale de l'appli (table Supabase `app_config`) ===
// Interrupteurs SERVEUR lus au runtime : une fois l'app publiée, un admin peut activer /
// désactiver une fonctionnalité SANS rebuild ni mise à jour. Lecture publique (RLS),
// écriture réservée aux admins (profils.est_admin).
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getMagasin } from '@/store/magasin';
import { definirPasseportActif, passeportActif } from '@/store/jeu';

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

// --- 🎫 LE PASSEPORT DE LA CARTE : interrupteur SERVEUR (27/07/2026) ------------------
// valeur = { actif: boolean }. Ligne absente / erreur → voir le repli ci-dessous.
//
// POURQUOI CE FLAG EXISTE. À `true`, les capsules ne rendent plus que des cartes déjà
// débloquées au comptoir : le vivier se RESTREINT d'un coup, pour tout le monde, le jour
// de la bascule. Si c'est trop dur, la marche arrière doit coûter des SECONDES — pas une
// OTA, pas une revue de store. Une constante compilée rendait l'aller ET le retour
// dépendants d'une publication ; c'était le vrai risque de ce lot, pas le mapping.
//
// REPLI, ET IL EST DISSYMÉTRIQUE EXPRÈS :
//   · lecture serveur OK       → elle fait foi, et elle est mise en cache ;
//   · lecture KO + cache connu → le cache (une décision serveur déjà constatée) ;
//   · lecture KO + aucun cache → `false`, le défaut compilé.
// Autrement dit on ne FERME jamais une collection sur une panne réseau : une collection
// ouverte par erreur se rattrape à la bascule suivante, une collection fermée par erreur
// fait fuir le joueur — et il ne revient pas.
//
// ⚠️ Ce module dépend de `@/store/jeu` (et pas l'inverse) : le store ne parle JAMAIS au
// réseau, c'est `lib/` qui lit et qui pousse. Même sens que `lib/sauvegarde-jeu.ts`.
export const FLAG_PASSEPORT = 'passeport_carte';

/** Lit l'interrupteur serveur. `null` = LECTURE ÉCHOUÉE (réseau, RLS) — à ne surtout pas
 *  confondre avec `false` (« la ligne existe et dit non », ou « pas de ligne »). */
export async function lirePasseportActif(): Promise<boolean | null> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('valeur')
      .eq('cle', FLAG_PASSEPORT)
      .maybeSingle();
    if (error) return null;
    const v = data?.valeur as { actif?: boolean } | null;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;   // ligne absente = éteint
    return v.actif === true;
  } catch {
    return null;
  }
}

/** Bascule l'interrupteur. Admin uniquement (RLS). Lecture-modif-écriture : préserve
 *  toute future clé inconnue de la config. Applique aussitôt la valeur localement, pour
 *  que l'admin qui bascule CONSTATE l'effet sans relancer l'app. */
export async function ecrirePasseportActif(actif: boolean): Promise<boolean> {
  try {
    const { data, error: erreurLecture } = await supabase
      .from('app_config')
      .select('valeur')
      .eq('cle', FLAG_PASSEPORT)
      .maybeSingle();
    if (erreurLecture) return false;
    const courant = data?.valeur && typeof data.valeur === 'object' && !Array.isArray(data.valeur)
      ? data.valeur as Record<string, unknown>
      : {};
    const { error } = await supabase.from('app_config').upsert({
      cle: FLAG_PASSEPORT,
      valeur: { ...courant, actif },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'cle' });
    if (error) return false;
    definirPasseportActif(actif, true);
    return true;
  } catch {
    return false;
  }
}

/** Un tour de synchronisation de l'interrupteur : lit le serveur et pousse la valeur dans
 *  le store (qui la mémorise pour le prochain démarrage). Silencieux, idempotent, sans
 *  effet si la lecture échoue. Renvoie la valeur qui s'applique désormais.
 *  Utilisable hors React — à câbler dans `app/jeu/_layout.tsx` le jour où on veut que
 *  l'interrupteur se rafraîchisse à l'entrée du jeu et pas seulement sur la collection. */
export async function synchroniserPasseport(): Promise<boolean> {
  const serveur = await lirePasseportActif();
  if (serveur !== null) definirPasseportActif(serveur, true);
  return passeportActif();   // lecture KO → cache du démarrage, ou défaut compilé
}

/** Hook d'écran : rafraîchit l'interrupteur au montage ET à chaque retour sur l'écran
 *  (`useFocusEffect`, comme `useJeuVisible`) — une bascule à distance prend donc effet
 *  dès la prochaine navigation, sans relancer l'appli. `charge` distingue « pas encore
 *  demandé » de « la réponse est bien false ». */
export function usePasseportServeur(): { actif: boolean; charge: boolean } {
  const [etat, setEtat] = useState<{ actif: boolean; charge: boolean }>(
    { actif: passeportActif(), charge: false },
  );
  useFocusEffect(useCallback(() => {
    let vivant = true;
    (async () => {
      const actif = await synchroniserPasseport();
      if (vivant) setEtat({ actif, charge: true });
    })();
    return () => { vivant = false; };
  }, []));
  return etat;
}

// --- 🏗️ Boba Tower (prototype, 29/07/2026) : interrupteurs GLOBAUX ------------------
// Deuxième jeu de l'app — même contrat que `jeu` (Boba Quest), clé `boba_tower` :
//   valeur = { actif: boolean, selection: boolean, admin: boolean }
//   · actif = visible pour TOUS les clients (non-admins)
//   · selection = PHASE 2, champ présent mais IGNORÉ pour l'instant : la sélection
//     individuelle par membre suivra le modèle de Boba Quest (colonne `jeu` sur
//     `jeu_acces_membres`) — on parse et on préserve la clé dès aujourd'hui pour
//     que la bascule future ne casse aucune config déjà écrite.
//   · admin = visible pour les ADMINS (clé ABSENTE = true : les admins voient par
//     défaut, c'est le canal du pilote — comme pour `jeu`)
// Ligne absente = caché pour tous les clients. Erreur réseau → CACHE AsyncStorage
// (offline) ; sans cache non plus → caché (fail-closed : on livre invisible).
export const FLAG_TOWER = 'boba_tower';
const CACHE_TOWER = 'appConfig.towerActif';

export type TowerFlags = { actif: boolean; selectionActive: boolean; adminVisible: boolean };

// Lit les interrupteurs serveur de Boba Tower. null = réseau KO (utiliser le cache).
export async function lireTowerFlags(): Promise<TowerFlags | null> {
  try {
    const { data } = await supabase.from('app_config').select('valeur').eq('cle', FLAG_TOWER).maybeSingle();
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

// Écrit un ou plusieurs interrupteurs (lecture-modif-écriture : ne perd JAMAIS les
// autres clés, y compris `selection` réservée à la phase 2). Admin uniquement (RLS).
export async function ecrireTowerFlags(patch: Partial<TowerFlags>): Promise<boolean> {
  const courant = (await lireTowerFlags()) ?? { actif: false, selectionActive: true, adminVisible: true };
  const nv = { ...courant, ...patch };
  const { error } = await supabase
    .from('app_config')
    .upsert({
      cle: FLAG_TOWER,
      valeur: { actif: nv.actif, selection: nv.selectionActive, admin: nv.adminVisible },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'cle' });
  if (!error) AsyncStorage.setItem(CACHE_TOWER, JSON.stringify(nv)).catch(() => {});
  return !error;
}

function parserCacheTower(brut: string | null): TowerFlags | null {
  if (brut === null) return null;
  try {
    const v = JSON.parse(brut);
    return {
      actif: !!v.actif,
      selectionActive: v.selectionActive !== false,
      adminVisible: v.adminVisible !== false,
    };
  } catch { return null; }
}

// Hook : Boba Tower est-il visible pour CET utilisateur ?
//   · client (non-admin) → flag `actif` uniquement (la sélection individuelle est
//     PHASE 2 — cf. commentaire de FLAG_TOWER)
//   · admin              → flag `admin`, indépendant du mode clients
//   · __DEV__            → toujours visible (testable en simulateur sans session)
// Même cinématique que useJeuVisible : cache d'abord (verdict immédiat hors-ligne),
// serveur ensuite (la vérité), relu à chaque retour sur l'écran (useFocusEffect).
export function useTowerVisible() {
  const [etat, setEtat] = useState<{ visible: boolean; actif: boolean; admin: boolean; charge: boolean }>(
    { visible: false, actif: false, admin: false, charge: false },
  );
  useFocusEffect(useCallback(() => {
    let vivant = true;
    (async () => {
      // 1) cache : verdict immédiat hors-ligne / avant la réponse serveur
      let cache: TowerFlags | null = null;
      try { cache = parserCacheTower(await AsyncStorage.getItem(CACHE_TOWER)); } catch { /* ignore */ }
      if (vivant && cache !== null) {
        const c = cache;
        setEtat((e) => ({
          ...e,
          actif: c.actif,
          visible: __DEV__ || (e.admin ? c.adminVisible : c.actif),
        }));
      }
      // 2) serveur : la vérité (+ statut admin)
      const serveur = await lireTowerFlags();
      let admin = false;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profil } = await supabase
            .from('profils').select('est_admin').eq('id', session.user.id).maybeSingle();
          admin = !!profil?.est_admin;
        }
      } catch { /* ignore */ }
      const flags = serveur ?? cache ?? { actif: false, selectionActive: false, adminVisible: false };
      if (serveur !== null) AsyncStorage.setItem(CACHE_TOWER, JSON.stringify(serveur)).catch(() => {});
      if (vivant) setEtat({
        visible: __DEV__ || (admin ? flags.adminVisible : flags.actif),
        actif: flags.actif,
        admin,
        charge: true,
      });
    })();
    return () => { vivant = false; };
  }, []));
  return etat;
}

// --- 🎡 LA ROUE DU MOIS : interrupteurs GLOBAUX (3e jeu autonome, 03/08/2026) ---
// valeur = { actif: boolean, admin: boolean } :
//   · actif = la roue est visible pour TOUS les clients (non-admins)
//   · admin = visible pour les ADMINS (clé ABSENTE = true : l'admin voit la roue par
//     défaut, pour la tester avant de l'ouvrir aux clients)
// Ligne absente = caché pour tous. Erreur réseau → CACHE AsyncStorage (offline) ;
// sans cache non plus → caché (fail-closed : on livre invisible, comme `jeu`).
export const FLAG_ROUE_DU_MOIS = 'roue_du_mois';
const CACHE_ROUE_DU_MOIS = 'appConfig.roueDuMois';

export type RoueDuMoisFlags = { actif: boolean; adminVisible: boolean };

// Lit les DEUX interrupteurs serveur. null = réseau KO (utiliser le cache).
export async function lireRoueDuMoisFlags(): Promise<RoueDuMoisFlags | null> {
  try {
    const { data } = await supabase.from('app_config').select('valeur').eq('cle', FLAG_ROUE_DU_MOIS).maybeSingle();
    const v = data?.valeur as { actif?: boolean; admin?: boolean } | null;
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      return { actif: false, adminVisible: true };
    }
    return { actif: !!v.actif, adminVisible: v.admin !== false };
  } catch {
    return null;
  }
}

// Écrit un ou deux interrupteurs (lecture-modif-écriture : ne perd JAMAIS les autres
// clés de la ligne). Admin uniquement (RLS). Renvoie true si OK.
export async function ecrireRoueDuMoisFlags(patch: Partial<RoueDuMoisFlags>): Promise<boolean> {
  try {
    const { data, error: erreurLecture } = await supabase
      .from('app_config').select('valeur').eq('cle', FLAG_ROUE_DU_MOIS).maybeSingle();
    if (erreurLecture) return false;
    const courant = data?.valeur && typeof data.valeur === 'object' && !Array.isArray(data.valeur)
      ? data.valeur as Record<string, unknown>
      : {};
    const nv: RoueDuMoisFlags = {
      actif: patch.actif ?? courant.actif === true,
      adminVisible: patch.adminVisible ?? courant.admin !== false,
    };
    const { error } = await supabase.from('app_config').upsert({
      cle: FLAG_ROUE_DU_MOIS,
      valeur: { ...courant, actif: nv.actif, admin: nv.adminVisible },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'cle' });
    if (!error) AsyncStorage.setItem(CACHE_ROUE_DU_MOIS, JSON.stringify(nv)).catch(() => {});
    return !error;
  } catch {
    return false;
  }
}

// Cache : mêmes clés que l'état mémorisé — un JSON illisible vaut « pas de cache ».
function parserCacheRoueDuMois(brut: string | null): RoueDuMoisFlags | null {
  if (brut === null) return null;
  try {
    const v = JSON.parse(brut);
    return { actif: !!v.actif, adminVisible: v.adminVisible !== false };
  } catch { return null; }
}

// Hook : la Roue du Mois est-elle visible pour CET utilisateur ? Miroir de
// `useJeuVisible`, sans la liste d'accès individuelle : la roue s'ouvre à tout le
// monde d'un coup, ou se teste côté admin. Relit les flags au montage ET à chaque
// retour sur l'écran (useFocusEffect) : une bascule à distance prend effet dès la
// prochaine navigation, sans relancer l'appli. Le verrou mensuel local n'est JAMAIS
// purgé par une bascule : caché ≠ effacé.
export function useRoueDuMoisVisible() {
  const [etat, setEtat] = useState<{ visible: boolean; actif: boolean; admin: boolean; charge: boolean }>(
    { visible: false, actif: false, admin: false, charge: false },
  );
  useFocusEffect(useCallback(() => {
    let vivant = true;
    (async () => {
      // 1) cache : verdict immédiat hors-ligne / avant la réponse serveur
      let cache: RoueDuMoisFlags | null = null;
      try { cache = parserCacheRoueDuMois(await AsyncStorage.getItem(CACHE_ROUE_DU_MOIS)); } catch { /* ignore */ }
      if (vivant && cache !== null) {
        const c = cache;
        setEtat((e) => ({
          ...e,
          actif: c.actif,
          visible: __DEV__ || (e.admin ? c.adminVisible : c.actif),
        }));
      }
      // 2) serveur : la vérité (+ statut admin)
      const serveur = await lireRoueDuMoisFlags();
      let admin = false;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profil } = await supabase.from('profils').select('est_admin').eq('id', session.user.id).maybeSingle();
          admin = !!profil?.est_admin;
        }
      } catch { /* ignore */ }
      const flags = serveur ?? cache ?? { actif: false, adminVisible: false };
      if (serveur !== null) AsyncStorage.setItem(CACHE_ROUE_DU_MOIS, JSON.stringify(serveur)).catch(() => {});
      if (vivant) setEtat({
        visible: __DEV__ || (admin ? flags.adminVisible : flags.actif),
        actif: flags.actif,
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
