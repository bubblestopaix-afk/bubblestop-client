// === 🎫 Libellés lisibles du Passeport de la Carte (26/07/2026) ===
// Traduit une cible de déblocage (`{ type: 'saveur', id: 'mt-taro' }`) en texte que le
// joueur comprend (« un Milk tea Taro »). Vit dans lib/ et non dans economie.ts pour que
// la config d'économie reste une donnée PURE, sans dépendance au catalogue.
//
// Point important pour l'expérience : une carte verrouillée ne doit JAMAIS afficher un
// mur. Elle affiche un MENU — « encore 2 Taro » est une invitation, « verrouillé » est
// une punition. Toute la différence est dans la formulation.
import { deblocageDe, type CibleProduit } from '@/components/jeu/economie';

// `data/catalogue.js` n'est pas typé : on décrit juste ce qu'on utilise.
type Catalogue = {
  trouverSaveur: (categorieId: string, saveurId: string) => { nom?: string } | undefined;
  trouverCategorie: (id: string) => { nom?: string } | undefined;
  trouverTopping: (id: string) => { nom?: string } | undefined;
  categories: { id: string; nom?: string; saveurs?: { id: string; nom?: string }[] }[];
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const catalogue = require('@/data/catalogue.js') as Catalogue;

function nomSaveur(saveurId: string): string | null {
  for (const g of catalogue.categories) {
    const s = (g.saveurs || []).find((x) => x.id === saveurId);
    if (s) return `${g.nom || ''} ${s.nom || ''}`.trim();
  }
  return null;
}

/** Libellé d'UNE cible, ou null si l'id n'existe plus au catalogue (carte renommée). */
export function libelleCible(cible: CibleProduit): string | null {
  switch (cible.type) {
    case 'saveur': return nomSaveur(cible.id);
    case 'categorie': return catalogue.trouverCategorie(cible.id)?.nom ?? null;
    case 'topping': {
      const t = catalogue.trouverTopping(cible.id)?.nom;
      return t ? `avec ${t.toLowerCase()}` : null;
    }
    case 'supplement':
      return cible.id === 'chantilly' ? 'avec chantilly' : 'avec lait d’avoine';
  }
}

/**
 * Phrase d'invitation pour une carte verrouillée.
 * Plusieurs cibles → on en cite au plus deux, puis « … » : une liste de huit perles de
 * fruit ne se lit pas, alors qu'« avec perles mangue, avec perles myrtille… » se lit.
 */
export function commentDebloquer(carteId: string): string | null {
  const d = deblocageDe(carteId);
  if (d.par !== 'achat') return null;
  const noms = d.cibles.map(libelleCible).filter((x): x is string => !!x);
  if (noms.length === 0) return null;
  const cites = noms.slice(0, 2).join(', ');
  const suite = noms.length > 2 ? '…' : '';
  const fois = d.nb > 1 ? ` ×${d.nb}` : '';
  return `${cites}${suite}${fois}`;
}
