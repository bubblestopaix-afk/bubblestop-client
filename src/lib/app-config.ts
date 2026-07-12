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

// --- 🕹️ Jeu Boba Quest : interrupteur GLOBAL (cf. AGENTS.md « Interrupteur ADMIN du jeu ») ---
// valeur = { actif: boolean }. Ligne absente = caché. Erreur réseau → on garde le CACHE
// AsyncStorage (offline) ; sans cache non plus → caché (fail-closed : on livre invisible).
export const FLAG_JEU = 'jeu';
const CACHE_JEU = 'appConfig.jeuActif';

// Lit le flag serveur. true/false = réponse du serveur ; null = réseau KO (utiliser le cache).
export async function lireJeuActif(): Promise<boolean | null> {
  try {
    const { data } = await supabase.from('app_config').select('valeur').eq('cle', FLAG_JEU).maybeSingle();
    const v = data?.valeur;
    return (v && typeof v === 'object' && !Array.isArray(v)) ? !!(v as { actif?: boolean }).actif : false;
  } catch {
    return null;
  }
}

// Affiche / cache le jeu pour TOUS les clients (admin uniquement — RLS). Renvoie true si OK.
export async function ecrireJeuActif(actif: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('app_config')
    .upsert({ cle: FLAG_JEU, valeur: { actif }, updated_at: new Date().toISOString() }, { onConflict: 'cle' });
  if (!error) AsyncStorage.setItem(CACHE_JEU, actif ? '1' : '0').catch(() => {});
  return !error;
}

// Hook : le jeu est-il visible pour CET utilisateur ? visible = flag actif OU admin
// (l'admin voit toujours le jeu pour le tester — même logique que la commande en ligne).
// Relit le flag au montage ET à chaque retour sur l'écran (useFocusEffect) : une bascule
// à distance prend effet dès la prochaine navigation, sans relancer l'appli.
// L'état du joueur (perles, collection…) n'est JAMAIS purgé : caché ≠ effacé.
export function useJeuVisible() {
  const [etat, setEtat] = useState<{ visible: boolean; actif: boolean; admin: boolean; charge: boolean }>(
    { visible: false, actif: false, admin: false, charge: false },
  );
  useFocusEffect(useCallback(() => {
    let vivant = true;
    (async () => {
      // 1) cache : verdict immédiat hors-ligne / avant la réponse serveur
      let cache: boolean | null = null;
      try { const c = await AsyncStorage.getItem(CACHE_JEU); if (c !== null) cache = c === '1'; } catch { /* ignore */ }
      if (vivant && cache !== null) {
        const c = cache;
        setEtat((e) => ({ ...e, actif: c, visible: c || e.admin }));
      }
      // 2) serveur : la vérité (+ statut admin)
      const serveur = await lireJeuActif();
      let admin = false;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data } = await supabase.from('profils').select('est_admin').eq('id', session.user.id).maybeSingle();
          admin = !!data?.est_admin;
        }
      } catch { /* ignore */ }
      const actif = serveur !== null ? serveur : (cache ?? false);
      if (serveur !== null) AsyncStorage.setItem(CACHE_JEU, serveur ? '1' : '0').catch(() => {});
      if (vivant) setEtat({ visible: actif || admin, actif, admin, charge: true });
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
