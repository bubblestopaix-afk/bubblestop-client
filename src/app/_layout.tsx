import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { supabase } from '@/lib/supabase';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  // Marque le profil "utilise l'appli" (la borne masque alors la promo de téléchargement)
  useEffect(() => {
    const marquer = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.from('profils')
            .update({ app_utilisee: true })
            .eq('id', session.user.id)
            .eq('app_utilisee', false); // n'écrit que si nécessaire
        }
      } catch (_) { /* silencieux */ }
    };
    marquer();
    const { data: sub } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === 'SIGNED_IN') marquer();
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
