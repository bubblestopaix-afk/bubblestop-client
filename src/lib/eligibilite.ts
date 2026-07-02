// === Éligibilité à la commande en ligne (règle unique, partagée) ===
// Un client peut commander si : admin || commande_debloquee (override master)
// || ≥ 1 carte de fidélité complétée à vie (ou un cadeau dispo, qui en est la preuve).
// Utilisée par l'écran Commander (gate), la fiche produit et le panier (re-vérif à l'envoi).
// NB : le serveur re-vérifie aussi (policy RLS sur INSERT commandes) — ceci n'est que l'UX.
import { supabase } from '@/lib/supabase';

export async function peutCommander(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const { data: p } = await supabase.from('profils')
      .select('est_admin, commande_debloquee, numero_fidelite')
      .eq('id', session.user.id).maybeSingle();
    if (p?.est_admin || p?.commande_debloquee) return true;
    if (!p?.numero_fidelite) return false;
    const { data: f } = await supabase.from('fidelite_cloud')
      .select('cartes_completees, cadeaux')
      .eq('numero_fidelite', p.numero_fidelite).maybeSingle();
    return (Number(f?.cartes_completees) || 0) >= 1 || (Number(f?.cadeaux) || 0) >= 1;
  } catch {
    return false;
  }
}
