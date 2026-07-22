import { CodeRecompenseReelle } from '@/components/jeu/economie';
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
  if (error || !data?.ok || !data?.demande) {
    throw new Error(data?.erreur || error?.message || 'La demande n’a pas pu être préparée.');
  }
  return data.demande as DemandeRecompenseJeu;
}
