// === Politique de mise à jour pilotée à distance ===
// La ligne `app_config.mise_a_jour` permet de conseiller ou d'imposer une version
// native minimale sans publier un nouveau réglage dans les stores.
//
// Important : on lit volontairement le build NATIF via expo-constants, déjà inclus
// dans les binaires 1.0.2/1.0.3. Ajouter expo-application rendrait ce garde
// indisponible aux builds actuels tant qu'ils n'auraient pas été reconstruits.
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export const FLAG_MISE_A_JOUR = 'mise_a_jour';

export const URL_APP_STORE = 'https://apps.apple.com/fr/app/id6783475068';
export const URL_PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.bubblestop.client';

export type ModeMiseAJour = 'inactive' | 'conseillee' | 'obligatoire';

export type ConfigMiseAJour = {
  mode: ModeMiseAJour;
  ios_build_min: number;
  android_version_code_min: number;
  message: string;
  ios_url: string;
  android_url: string;
};

export type VersionInstallee = {
  plateforme: 'ios' | 'android';
  version: string;
  build: number;
  minimum: number;
  urlStore: string;
};

export const CONFIG_MISE_A_JOUR_DEFAUT: ConfigMiseAJour = {
  mode: 'inactive',
  ios_build_min: 0,
  android_version_code_min: 0,
  message: 'Une nouvelle version de Bubble Stop est disponible. Mets l’application à jour pour continuer.',
  ios_url: URL_APP_STORE,
  android_url: URL_PLAY_STORE,
};

function entierPositif(valeur: unknown): number {
  const nombre = Number(valeur);
  return Number.isFinite(nombre) && nombre > 0 ? Math.trunc(nombre) : 0;
}

function modeValide(valeur: unknown): ModeMiseAJour {
  return valeur === 'conseillee' || valeur === 'obligatoire' ? valeur : 'inactive';
}

/** Parse une valeur serveur sans jamais rendre une configuration invalide bloquante. */
export function parserConfigMiseAJour(valeur: unknown): ConfigMiseAJour {
  const v = valeur && typeof valeur === 'object' && !Array.isArray(valeur)
    ? valeur as Record<string, unknown>
    : {};
  const message = typeof v.message === 'string' && v.message.trim()
    ? v.message.trim().slice(0, 240)
    : CONFIG_MISE_A_JOUR_DEFAUT.message;
  const iosUrl = typeof v.ios_url === 'string' && /^https:\/\//.test(v.ios_url)
    ? v.ios_url
    : URL_APP_STORE;
  const androidUrl = typeof v.android_url === 'string' && /^https:\/\//.test(v.android_url)
    ? v.android_url
    : URL_PLAY_STORE;

  return {
    mode: modeValide(v.mode),
    ios_build_min: entierPositif(v.ios_build_min),
    android_version_code_min: entierPositif(v.android_version_code_min),
    message,
    ios_url: iosUrl,
    android_url: androidUrl,
  };
}

/**
 * Lit la politique live. `null` signifie réseau/serveur indisponible : le garde
 * DOIT alors laisser l'application s'ouvrir (fail-open, jamais de client bloqué
 * parce que Supabase est momentanément inaccessible).
 */
export async function lireConfigMiseAJour(): Promise<ConfigMiseAJour | null> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('valeur')
      .eq('cle', FLAG_MISE_A_JOUR)
      .maybeSingle();
    if (error) return null;
    return parserConfigMiseAJour(data?.valeur);
  } catch {
    return null;
  }
}

/** Écriture admin lecture-modification-upsert, afin de préserver les futures clés. */
export async function ecrireConfigMiseAJour(config: ConfigMiseAJour): Promise<boolean> {
  try {
    const { data, error: erreurLecture } = await supabase
      .from('app_config')
      .select('valeur')
      .eq('cle', FLAG_MISE_A_JOUR)
      .maybeSingle();
    if (erreurLecture) return false;
    const courant = data?.valeur && typeof data.valeur === 'object' && !Array.isArray(data.valeur)
      ? data.valeur as Record<string, unknown>
      : {};
    const propre = parserConfigMiseAJour(config);
    const { error } = await supabase.from('app_config').upsert({
      cle: FLAG_MISE_A_JOUR,
      valeur: { ...courant, ...propre },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'cle' });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Retourne le build réellement signé dans le binaire. `Constants.expoConfig`
 * seul ne convient pas : son manifeste peut changer avec une OTA.
 */
export function lireVersionInstallee(config?: ConfigMiseAJour): VersionInstallee | null {
  const version = Constants.expoConfig?.version || '—';
  if (Platform.OS === 'ios') {
    const build = entierPositif(Constants.platform?.ios?.buildNumber);
    return {
      plateforme: 'ios',
      version,
      build,
      minimum: config?.ios_build_min ?? 0,
      urlStore: config?.ios_url ?? URL_APP_STORE,
    };
  }
  if (Platform.OS === 'android') {
    const build = entierPositif(Constants.platform?.android?.versionCode);
    return {
      plateforme: 'android',
      version,
      build,
      minimum: config?.android_version_code_min ?? 0,
      urlStore: config?.android_url ?? URL_PLAY_STORE,
    };
  }
  return null;
}

/** Un build inconnu (0), un minimum nul ou le mode inactif ne bloque jamais. */
export function miseAJourNecessaire(config: ConfigMiseAJour, version: VersionInstallee | null): boolean {
  return !!version
    && config.mode !== 'inactive'
    && version.build > 0
    && version.minimum > 0
    && version.build < version.minimum;
}
