// === Config globale de l'appli (table Supabase `app_config`) ===
// Interrupteurs SERVEUR lus au runtime : une fois l'app publiée, un admin peut activer /
// désactiver une fonctionnalité SANS rebuild ni mise à jour. Lecture publique (RLS),
// écriture réservée aux admins (profils.est_admin).
import { useEffect, useState } from 'react';
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
