// === 🎫 Historique d'achats du client — le Passeport de la Carte (26/07/2026) ===
// Lit `achats_lignes` : les lignes d'achat publiées par la caisse après encaissement,
// uniquement quand le client a présenté sa carte de fidélité. RLS oblige : chacun ne voit
// que les siennes.
//
// Pourquoi ce module existe. Les 24 collectibles de Boba Quest SONT les boissons de la
// carte, et les ids du catalogue sont déjà identiques côté caisse et côté app. Il
// manquait seulement de savoir, côté serveur, qui a bu quoi — c'est ce que cette table
// apporte, et ce module la traduit en `LigneAchat[]`, la forme que comprennent les
// helpers PURS de `components/jeu/economie.ts` (donc testés par `npm run test:jeu`).
//
// Ce module ne décide RIEN : il lit et traduit. C'est le store du jeu qui accorde les
// cartes, et l'écran de collection qui les montre.
import { supabase } from '@/lib/supabase';
import type { LigneAchat } from '@/components/jeu/economie';

// 24 mois de rétention côté serveur ; on borne aussi la lecture pour ne pas rapatrier
// un historique inutilement large sur un téléphone.
const TAILLE_PAGE = 500;
const MAX_PAGES = 50; // 25 000 lignes / 24 mois : garde anti-boucle, jamais un plafond silencieux

const COLONNES = [
  'id', 'categorie_id', 'saveur_id', 'quantite', 'toppings', 'chantilly',
  'lait_avoine', 'encaisse_le', 'created_at',
].join(',');

type LigneBrute = {
  id: string | null;
  categorie_id: string | null;
  saveur_id: string | null;
  quantite: number | null;
  toppings: unknown;
  chantilly: boolean | null;
  lait_avoine: boolean | null;
  encaisse_le: string | null;
  created_at: string | null;
};

export type LigneAchatDetaillee = LigneAchat & {
  id: string;
  encaisseLe: string;
  creeLe: string;
};

/** Traduit une ligne serveur vers la forme attendue par les helpers purs. PUR. */
export function versLigneAchat(l: LigneBrute): LigneAchat | null {
  const categorieId = String(l.categorie_id || '').trim();
  const saveurId = String(l.saveur_id || '').trim();
  if (!categorieId || !saveurId) return null;
  return {
    categorieId,
    saveurId,
    quantite: Math.max(1, Math.floor(Number(l.quantite) || 1)),
    toppings: Array.isArray(l.toppings) ? l.toppings.map((t) => String(t)) : [],
    chantilly: l.chantilly === true,
    laitAvoine: l.lait_avoine === true,
  };
}

/** Même traduction, avec les métadonnées nécessaires au curseur anti-double notification. */
export function versLigneAchatDetaillee(l: LigneBrute): LigneAchatDetaillee | null {
  const ligne = versLigneAchat(l);
  const id = String(l.id || '').trim();
  const encaisseLe = String(l.encaisse_le || '').trim();
  const creeLe = String(l.created_at || '').trim();
  if (!ligne || !id || !Number.isFinite(Date.parse(encaisseLe)) || !Number.isFinite(Date.parse(creeLe))) {
    return null;
  }
  return { ...ligne, id, encaisseLe, creeLe };
}

/**
 * Historique d'achats du client connecté, dans l'ordre d'arrivée serveur.
 * Lève en cas d'échec réseau : l'appelant décide quoi faire (le store ne doit JAMAIS
 * retirer une carte parce qu'une lecture a échoué — voir `appliquerPasseport`).
 */
export async function chargerAchats(): Promise<LigneAchat[]> {
  return chargerAchatsDetaillees();
}

/**
 * Lecture paginée de l'historique nominatif. `depuisCreeLe` porte sur `created_at`
 * (date d'arrivée serveur), pas `encaisse_le` : une caisse hors ligne peut publier
 * aujourd'hui une vente d'hier et elle doit être reprise.
 *
 * La borne de 50 pages est une protection contre une configuration serveur cassée.
 * Atteindre cette garde lève explicitement au lieu de présenter un cumul tronqué.
 */
export async function chargerAchatsDetaillees(depuisCreeLe?: string): Promise<LigneAchatDetaillee[]> {
  const lignes: LigneAchatDetaillee[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const debut = page * TAILLE_PAGE;
    let requete = supabase.from('achats_lignes')
      .select(COLONNES)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(debut, debut + TAILLE_PAGE - 1);
    if (depuisCreeLe) requete = requete.gte('created_at', depuisCreeLe);
    const { data, error } = await requete;
    if (error) throw new Error(error.message);
    const brutes = (data || []) as unknown as LigneBrute[];
    lignes.push(...brutes.map(versLigneAchatDetaillee)
      .filter((l): l is LigneAchatDetaillee => l !== null));
    if (brutes.length < TAILLE_PAGE) return lignes;
  }
  throw new Error('historique-achats-trop-volumineux');
}
