// === Magasin choisi par le client (Aix / Lyon / Toulouse) ===
// Persisté sur le téléphone ; tout en découle : catalogue, horaires, commandes.
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const MAGASINS = [
  { id: 'aix', nom: 'Aix-en-Provence' },
  { id: 'lyon', nom: 'Lyon' },
  { id: 'toulouse', nom: 'Toulouse' },
] as const;

export type MagasinId = (typeof MAGASINS)[number]['id'];

let magasin: MagasinId = 'aix';
const listeners = new Set<() => void>();

// Restauration du choix au premier import
AsyncStorage.getItem('magasin.choisi')
  .then((v) => {
    if (v && MAGASINS.some((m) => m.id === v)) {
      magasin = v as MagasinId;
      listeners.forEach((l) => l());
    }
  })
  .catch(() => {});

export function getMagasin(): MagasinId {
  return magasin;
}

export function setMagasin(id: MagasinId) {
  magasin = id;
  listeners.forEach((l) => l());
  AsyncStorage.setItem('magasin.choisi', id).catch(() => {});
}

export function useMagasin(): MagasinId {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => magasin,
  );
}
