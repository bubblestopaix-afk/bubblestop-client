// === Favoris : boissons enregistrées sur le téléphone ===
// Un favori = la config complète d'une boisson (sans quantité ni prix :
// le prix est recalculé à l'ajout, au tarif en vigueur).
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Favori = {
  id: string;
  nom: string; // ex : "Milk tea Taro M"
  categorieId: string;
  saveurId: string;
  format: string;
  sucre: string | null;
  temperature: 'glace' | 'chaud' | null;
  glacons?: 'avec' | 'peu' | 'sans';
  toppings: Record<string, number>;
  chantilly: boolean;
  laitAvoine: boolean;
  doublePortion: boolean;
};

let favoris: Favori[] = [];
const listeners = new Set<() => void>();

// Restauration au premier import
AsyncStorage.getItem('favoris.liste')
  .then((brut) => {
    if (brut) {
      const restaure = JSON.parse(brut);
      if (Array.isArray(restaure)) {
        favoris = restaure;
        listeners.forEach((l) => l());
      }
    }
  })
  .catch(() => {});

function emit() {
  favoris = [...favoris];
  listeners.forEach((l) => l());
  AsyncStorage.setItem('favoris.liste', JSON.stringify(favoris)).catch(() => {});
}

export function ajouterFavori(f: Omit<Favori, 'id'>) {
  favoris.push({ ...f, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
  emit();
}

export function retirerFavori(id: string) {
  favoris = favoris.filter((f) => f.id !== id);
  emit();
}

// Un favori identique existe-t-il déjà ? (même boisson, même config)
export function favoriExistant(f: Omit<Favori, 'id' | 'nom'>): Favori | undefined {
  return favoris.find((x) =>
    x.categorieId === f.categorieId &&
    x.saveurId === f.saveurId &&
    x.format === f.format &&
    x.sucre === f.sucre &&
    x.temperature === f.temperature &&
    (x.glacons ?? 'avec') === (f.glacons ?? 'avec') &&
    x.chantilly === f.chantilly &&
    x.laitAvoine === f.laitAvoine &&
    x.doublePortion === f.doublePortion &&
    JSON.stringify(x.toppings) === JSON.stringify(f.toppings));
}

export function useFavoris(): Favori[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => favoris,
  );
}
