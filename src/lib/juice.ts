// === Juice : retours haptiques du jeu ===
// expo-haptics est une dépendance NATIVE : les binaires construits avant son
// ajout ne l'ont pas. On passe donc par un import DYNAMIQUE gardé — si le module
// natif est absent (vieux build, web), tout devient un no-op silencieux.
// ⚠️ Ne jamais importer 'expo-haptics' statiquement ailleurs dans l'app.
import { Platform } from 'react-native';

let Haptics: typeof import('expo-haptics') | null = null;
let tente = false;

async function module_(): Promise<typeof import('expo-haptics') | null> {
  if (!tente) {
    tente = true;
    if (Platform.OS !== 'web') {
      try { Haptics = await import('expo-haptics'); } catch { Haptics = null; }
    }
  }
  return Haptics;
}

async function impact(style: 'Light' | 'Medium' | 'Heavy') {
  try {
    const h = await module_();
    if (!h) return;
    await h.impactAsync(h.ImpactFeedbackStyle[style]);
  } catch { /* module natif absent : silencieux */ }
}

// Petit tap : match de perles, sélection, tir
export function hapticLeger() { impact('Light'); }
// Tap moyen : combo, achat, défi réclamé
export function hapticMoyen() { impact('Medium'); }
// Gros tap : signature, boss, capsule épique+
export function hapticLourd() { impact('Heavy'); }
// Succès : victoire, record, palier de série, quête terminée
export async function hapticSucces() {
  try {
    const h = await module_();
    if (!h) return;
    await h.notificationAsync(h.NotificationFeedbackType.Success);
  } catch { /* silencieux */ }
}
