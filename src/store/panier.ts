// === Panier (état global léger, persisté sur le téléphone) ===
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type LignePanier = {
  id: string;                       // id unique de la ligne
  categorieId: string;
  saveurId: string;
  format: string;                   // 'S' | 'M' | 'L'
  sucre: string | null;             // id niveau de sucre (null si sans choix)
  temperature: 'glace' | 'chaud' | null;
  glacons?: 'avec' | 'peu' | 'sans'; // niveau de glaçons (boissons froides)
  note?: string;                     // note libre du client (transmise en cuisine)
  toppings: Record<string, number>; // { idTopping: portion (0.5 ou 1...) }
  chantilly: boolean;
  laitAvoine: boolean;
  doublePortion: boolean;
  quantite: number;
  prixUnitaire: number;             // en euros
};

let lignes: LignePanier[] = [];
const listeners = new Set<() => void>();

// Restaure le panier sauvegardé au premier import du module
AsyncStorage.getItem('panier.lignes')
  .then((brut) => {
    if (brut && lignes.length === 0) {
      const restaure = JSON.parse(brut);
      if (Array.isArray(restaure) && restaure.length) {
        lignes = restaure;
        listeners.forEach((l) => l());
      }
    }
  })
  .catch(() => {});

function emit() {
  lignes = [...lignes]; // nouvelle référence pour déclencher le re-render
  listeners.forEach((l) => l());
  // Sauvegarde silencieuse (survit à la fermeture de l'appli)
  AsyncStorage.setItem('panier.lignes', JSON.stringify(lignes)).catch(() => {});
}

export function ajouterLigne(ligne: Omit<LignePanier, 'id'>) {
  lignes.push({ ...ligne, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
  emit();
}

// Lit une ligne par id (édition depuis le panier)
export function getLigne(id: string): LignePanier | undefined {
  return lignes.find((l) => l.id === id);
}

// Remplace une ligne existante (édition), en conservant son id
export function remplacerLigne(id: string, data: Omit<LignePanier, 'id'>) {
  lignes = lignes.map((l) => (l.id === id ? { ...data, id } : l));
  emit();
}

export function retirerLigne(id: string) {
  lignes = lignes.filter((l) => l.id !== id);
  emit();
}

export function changerQuantite(id: string, delta: number) {
  const l = lignes.find((x) => x.id === id);
  if (!l) return;
  l.quantite = Math.max(1, l.quantite + delta);
  emit();
}

export function viderPanier() {
  lignes = [];
  emit();
}

// Remise « pack de 2 mochis » : 2 mochis = 4,50€ au lieu de 5,00€ (−0,50€ par paire).
// Même règle que la caisse — calculée sur le nombre TOTAL de mochis du panier.
export function remiseMochi() {
  const nb = lignes
    .filter((l) => l.categorieId === 'mochi-glace')
    .reduce((s, l) => s + (l.quantite || 1), 0);
  return Math.round(Math.floor(nb / 2) * 0.5 * 100) / 100;
}

export function totalPanier() {
  const brut = lignes.reduce((s, l) => s + l.prixUnitaire * l.quantite, 0);
  return Math.round((brut - remiseMochi()) * 100) / 100;
}

// Hook React : re-render automatique quand le panier change
export function usePanier(): LignePanier[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => lignes,
  );
}
