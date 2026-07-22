// === Registre central des modules optionnels de l'appli client ===
// Fidélité, parrainage, accueil, compte et Wallets sont volontairement hors registre :
// ils restent toujours disponibles. Toute future fonctionnalité optionnelle doit être
// ajoutée ici puis protégée à son point d'entrée ET sur sa route directe.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import {
  ecrireConfigCarteCadeau,
  ecrireJeuFlags,
  lireConfigCarteCadeau,
  lireJeuFlags,
} from '@/lib/app-config';
import { supabase } from '@/lib/supabase';

type SourceFonctionnalite = 'jeu' | 'carte_cadeau' | 'generique';

export type DefinitionFonctionnalite = {
  id: string;
  titre: string;
  description: string;
  source: SourceFonctionnalite;
  actifParDefaut: boolean;
};

/**
 * Source unique du panneau admin. Ajouter une entrée générique ici suffit à faire
 * apparaître son interrupteur ; le nouvel écran doit ensuite appeler
 * `useFonctionnalite('<id>')` pour protéger ses entrées et sa route directe.
 */
export const REGISTRE_FONCTIONNALITES = [
  {
    id: 'jeu',
    titre: 'Boba Quest',
    description: 'Carte d’accueil et accès à tous les écrans du jeu.',
    source: 'jeu',
    actifParDefaut: false,
  },
  {
    id: 'carte_cadeau',
    titre: 'Carte cadeau · solde prépayé',
    description: 'Solde, bonus et demandes de recharge en boutique.',
    source: 'carte_cadeau',
    // Sans serveur ni cache, on ne montre pas un moyen de paiement/recharge.
    actifParDefaut: false,
  },
  {
    id: 'offres',
    titre: 'Offres & annonces',
    description: 'Cartes de l’accueil, écran de détail et rappel de notifications.',
    source: 'generique',
    actifParDefaut: true,
  },
] as const satisfies readonly DefinitionFonctionnalite[];

export type FonctionnaliteId = (typeof REGISTRE_FONCTIONNALITES)[number]['id'];
export type EtatFonctionnalites = Record<FonctionnaliteId, boolean>;

const FLAG_FONCTIONNALITES = 'fonctionnalites';
const CACHE_FONCTIONNALITES = 'appConfig.fonctionnalites.v1';
const INTERVALLE_ACTUALISATION = 30_000;

const ETAT_DEFAUT = Object.fromEntries(
  REGISTRE_FONCTIONNALITES.map((f) => [f.id, f.actifParDefaut]),
) as EtatFonctionnalites;

let dernierEtat: EtatFonctionnalites = { ...ETAT_DEFAUT };
let etatCharge = false;
let lectureEnCours: Promise<EtatFonctionnalites> | null = null;
let minuterie: ReturnType<typeof setInterval> | null = null;

type Ecouteur = (etat: EtatFonctionnalites, charge: boolean) => void;
const ecouteurs = new Set<Ecouteur>();

function definition(id: FonctionnaliteId) {
  return REGISTRE_FONCTIONNALITES.find((f) => f.id === id)!;
}

function parserCache(brut: string | null): EtatFonctionnalites | null {
  if (!brut) return null;
  try {
    const valeur = JSON.parse(brut) as Record<string, unknown>;
    return Object.fromEntries(REGISTRE_FONCTIONNALITES.map((f) => [
      f.id,
      typeof valeur[f.id] === 'boolean' ? valeur[f.id] : f.actifParDefaut,
    ])) as EtatFonctionnalites;
  } catch {
    return null;
  }
}

function publier(etat: EtatFonctionnalites, charge = true) {
  dernierEtat = etat;
  etatCharge = charge;
  AsyncStorage.setItem(CACHE_FONCTIONNALITES, JSON.stringify(etat)).catch(() => {});
  ecouteurs.forEach((ecouter) => ecouter(etat, charge));
}

async function lireGeneriques(): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('valeur')
      .eq('cle', FLAG_FONCTIONNALITES)
      .maybeSingle();
    if (error) return null;
    const valeur = data?.valeur;
    return valeur && typeof valeur === 'object' && !Array.isArray(valeur)
      ? valeur as Record<string, unknown>
      : {};
  } catch {
    return null;
  }
}

/** Lit toutes les visibilités, avec cache hors-ligne et déduplication des requêtes. */
export async function lireFonctionnalites(): Promise<EtatFonctionnalites> {
  if (lectureEnCours) return lectureEnCours;
  lectureEnCours = (async () => {
    const cache = parserCache(await AsyncStorage.getItem(CACHE_FONCTIONNALITES).catch(() => null));
    const base = cache ?? dernierEtat;
    const [generiques, jeu, carteCadeau] = await Promise.all([
      lireGeneriques(),
      lireJeuFlags(),
      lireConfigCarteCadeau(),
    ]);

    const suivant = Object.fromEntries(REGISTRE_FONCTIONNALITES.map((f) => {
      if (f.source === 'jeu') return [f.id, jeu?.actif ?? base[f.id]];
      if (f.source === 'carte_cadeau') return [f.id, carteCadeau?.actif ?? base[f.id]];
      const valeur = generiques?.[f.id];
      return [f.id, typeof valeur === 'boolean' ? valeur : base[f.id] ?? f.actifParDefaut];
    })) as EtatFonctionnalites;

    publier(suivant);
    return suivant;
  })().finally(() => { lectureEnCours = null; });
  return lectureEnCours;
}

async function ecrireGenerique(id: FonctionnaliteId, actif: boolean): Promise<boolean> {
  try {
    const courant = await lireGeneriques();
    if (courant === null) return false;
    const { error } = await supabase.from('app_config').upsert({
      cle: FLAG_FONCTIONNALITES,
      valeur: { ...courant, [id]: actif },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'cle' });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Écriture admin. Les sources historiques du jeu et de la carte cadeau restent les
 * sources de vérité afin que l'Edge Function et les anciennes versions restent alignées.
 */
export async function ecrireFonctionnalite(id: FonctionnaliteId, actif: boolean): Promise<boolean> {
  const source = definition(id).source;
  let ok = false;
  if (source === 'jeu') {
    ok = await ecrireJeuFlags({ actif });
  } else if (source === 'carte_cadeau') {
    const config = await lireConfigCarteCadeau();
    ok = !!config && await ecrireConfigCarteCadeau({ ...config, actif });
  } else {
    ok = await ecrireGenerique(id, actif);
  }
  if (ok) publier({ ...dernierEtat, [id]: actif });
  return ok;
}

function abonner(ecouter: Ecouteur) {
  ecouteurs.add(ecouter);
  if (!minuterie) {
    minuterie = setInterval(() => { lireFonctionnalites().catch(() => {}); }, INTERVALLE_ACTUALISATION);
  }
  return () => {
    ecouteurs.delete(ecouter);
    if (ecouteurs.size === 0 && minuterie) {
      clearInterval(minuterie);
      minuterie = null;
    }
  };
}

/**
 * Visibilité runtime : cache immédiat, actualisation au focus puis toutes les 30 s.
 * Une bascule faite depuis ce téléphone est aussi propagée immédiatement aux écrans montés.
 */
export function useFonctionnalite(id: FonctionnaliteId) {
  const [etat, setEtat] = useState({ actif: dernierEtat[id], charge: etatCharge });
  const actualiser = useCallback(async () => {
    const tout = await lireFonctionnalites();
    setEtat({ actif: tout[id], charge: true });
  }, [id]);

  useEffect(() => abonner((tout, charge) => setEtat({ actif: tout[id], charge })), [id]);
  useFocusEffect(useCallback(() => { actualiser().catch(() => {}); }, [actualiser]));

  return { ...etat, actualiser };
}
