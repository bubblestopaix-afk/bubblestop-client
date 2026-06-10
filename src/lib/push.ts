// === Enregistrement du token de notifications push ===
// Sous Expo Go les push ne sont plus supportés : tout est entouré de try/catch,
// ça fonctionnera automatiquement dans le development build (EAS).
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export async function enregistrerPush() {
  try {
    const Notifications = await import('expo-notifications');
    const Device = await import('expo-device');
    if (!Device.isDevice) return; // simulateur/émulateur sans push

    // Permission (demandée une seule fois par iOS/Android)
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    // Token Expo (projectId requis en dev build, absent sous Expo Go)
    const Constants = (await import('expo-constants')).default;
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    )).data;
    if (!token) return;

    // Lié au compte client connecté
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.from('push_tokens').upsert(
      {
        client_id: session.user.id,
        token,
        plateforme: Platform.OS === 'ios' ? 'ios' : 'android',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );
  } catch (_) {
    // Expo Go ou permission refusée : silencieux, on retentera au prochain lancement
  }
}
