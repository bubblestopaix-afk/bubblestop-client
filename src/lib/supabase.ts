import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Les clés viennent du fichier .env (jamais en dur dans le code)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Rendu statique (export web) : pas de window → pas de stockage de session
const estServeur = typeof window === 'undefined';

// Client Supabase unique pour toute l'appli
// La session est persistée sur le téléphone via AsyncStorage
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: estServeur ? undefined : AsyncStorage,
    autoRefreshToken: !estServeur,
    persistSession: !estServeur,
    // Web/PWA : lit la session renvoyée dans l'URL après le retour OAuth (Google).
    // Natif : pas de redirection web.
    detectSessionInUrl: !estServeur && Platform.OS === 'web',
  },
});
