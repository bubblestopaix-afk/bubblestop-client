// === Catalogue cloud : carte publiée par la caisse (Supabase) ===
// Au lancement on affiche la copie locale, puis on bascule sur la version
// cloud dès qu'elle est chargée (prix à jour, saveurs masquées, nouveautés).
// Dernière version cloud mémorisée sur le téléphone (utilisable hors ligne).
import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { getMagasin } from '@/store/magasin';
// @ts-ignore — catalogue JS partagé avec le POS (repli local)
import { categories as categoriesLocales, toppings as toppingsLocaux } from '@/data/catalogue';

type Catalogue = { categories: any[]; toppings: any[] };

let catalogue: Catalogue = { categories: categoriesLocales, toppings: toppingsLocaux };
let magasinCharge: string | null = null; // magasin du catalogue en mémoire
const listeners = new Set<() => void>();

function publier(nouveau: Catalogue) {
  if (!Array.isArray(nouveau?.categories) || !nouveau.categories.length) return;
  catalogue = { categories: nouveau.categories, toppings: nouveau.toppings || [] };
  listeners.forEach((l) => l());
}

async function rafraichir(magasin: string) {
  // 1. Cache local du magasin (affichage immédiat même sans réseau)
  try {
    const brut = await AsyncStorage.getItem(`catalogue.cloud.${magasin}`);
    if (brut) publier(JSON.parse(brut));
  } catch (_) { /* repli local */ }
  // 2. Version cloud fraîche (catalogue du magasin choisi)
  try {
    const { data } = await supabase
      .from('catalogue_cloud')
      .select('data')
      .eq('id', magasin)
      .maybeSingle();
    if (data?.data) {
      publier(data.data);
      AsyncStorage.setItem(`catalogue.cloud.${magasin}`, JSON.stringify(data.data)).catch(() => {});
    }
  } catch (_) { /* on garde la version courante */ }
}

// Hook : catalogue effectif du magasin choisi (cloud si dispo, sinon local)
export function useCatalogueCloud(): Catalogue {
  const cat = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => catalogue,
  );
  useEffect(() => {
    const magasin = getMagasin();
    if (magasinCharge !== magasin) {
      magasinCharge = magasin;
      rafraichir(magasin);
    }
  });
  return cat;
}

// Finders sur le catalogue effectif (équivalents cloud des helpers du POS)
export const trouverCategorieCloud = (id: string) =>
  catalogue.categories.find((c: any) => c.id === id);
export const trouverSaveurCloud = (categorieId: string, saveurId: string) =>
  trouverCategorieCloud(categorieId)?.saveurs?.find((s: any) => s.id === saveurId);
export const trouverToppingCloud = (id: string) =>
  catalogue.toppings.find((t: any) => t.id === id);
