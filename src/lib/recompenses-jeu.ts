import { CodeRecompenseReelle } from '@/lib/codes-recompenses';
import { supabase } from '@/lib/supabase';

export type DemandeRecompenseJeu = {
  id: string;
  client_id: string;
  numero_fidelite: string;
  gain_local_id: string;
  code: CodeRecompenseReelle;
  type: 'tampon' | 'reduction' | 'boisson';
  quantite: number;
  tampons_bonus: number;
  label: string;
  origine: 'set' | 'collection' | 'boutique' | 'roulette' | 'quete';
  statut: 'en_attente' | 'appliquee' | 'refusee';
  created_at: string;
  traitee_at?: string | null;
};

const COLONNES = 'id,client_id,numero_fidelite,gain_local_id,code,type,quantite,tampons_bonus,label,origine,statut,created_at,traitee_at';

export async function chargerDemandesRecompensesJeu(): Promise<DemandeRecompenseJeu[]> {
  const { data, error } = await supabase.from('jeu_recompenses_demandes')
    .select(COLONNES)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data || []) as DemandeRecompenseJeu[];
}

export async function creerDemandeRecompenseJeu(
  gainLocalId: string,
  code: CodeRecompenseReelle,
): Promise<DemandeRecompenseJeu> {
  const { data, error } = await supabase.functions.invoke('jeu-recompenses', {
    body: { action: 'creer-demande', gain_local_id: gainLocalId, code },
  });
  // 🩹 03/08/2026 — refus métier de l'Edge (plafond mensuel, carte inactive…) : la RPC
  // répond ok:false en HTTP 409, et supabase-js range alors le corps NON PAS dans
  // `data` (null) mais derrière `error.context` (la Response brute). Sans cette
  // lecture, tous les refus s'affichaient « La demande n'a pas pu être préparée » —
  // l'écran ne pouvait pas distinguer « plafond atteint » (inutile de réessayer)
  // d'une vraie panne réseau (réessayer aide). Lecture best-effort : un corps
  // illisible retombe sur les messages d'avant, jamais une exception en plus.
  let erreurServeur: string | undefined = typeof data?.erreur === 'string' ? data.erreur : undefined;
  if (!erreurServeur && error && typeof error === 'object' && 'context' in error) {
    try {
      const corps = await (error as { context: { json?: () => Promise<unknown> } }).context.json?.();
      const brute = (corps as { erreur?: unknown } | null)?.erreur;
      if (typeof brute === 'string') erreurServeur = brute;
    } catch { /* corps non-JSON ou déjà consommé : messages génériques ci-dessous */ }
  }
  if (error || !data?.ok || !data?.demande) {
    throw new Error(erreurServeur || error?.message || 'La demande n’a pas pu être préparée.');
  }
  return data.demande as DemandeRecompenseJeu;
}
