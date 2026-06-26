import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// URL + clé ANON Supabase. La clé anon est PUBLIQUE (protégée par RLS, conçue pour être
// embarquée côté client) → on garde une valeur de repli EN DUR pour qu'un build natif ne
// crashe JAMAIS au lancement si l'inlining des EXPO_PUBLIC_* ne prend pas (piège EAS).
// En local/web, les EXPO_PUBLIC_* (.env) restent prioritaires.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zpnoopitysojsvuqnbuo.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwbm9vcGl0eXNvanN2dXFuYnVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NDgzNTUsImV4cCI6MjA5NjQyNDM1NX0.rMouh9jqljjlIqT2TJ6FqpR1smCk_Ss1E-1wZm8R054';

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
