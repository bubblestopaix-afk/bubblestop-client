import { useEffect } from 'react';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { PaytoneOne_400Regular } from '@expo-google-fonts/paytone-one';
import {
  Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { supabase } from '@/lib/supabase';

export default function TabLayout() {
  // Polices DA : Paytone One (titres) + Outfit (textes)
  const [polices] = useFonts({
    PaytoneOne_400Regular,
    Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold,
  });

  // Marque le profil "utilise l'appli" (la borne masque alors la promo de téléchargement)
  // + garantit qu'une ligne profils existe (ex. première connexion via Google).
  useEffect(() => {
    const marquer = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: existe } = await supabase.from('profils').select('id').eq('id', session.user.id).maybeSingle();
          if (!existe) {
            await supabase.from('profils').insert({
              id: session.user.id,
              email: session.user.email,
              nom: (session.user.user_metadata as any)?.full_name || null,
              app_utilisee: true,
            });
          } else {
            await supabase.from('profils')
              .update({ app_utilisee: true })
              .eq('id', session.user.id)
              .eq('app_utilisee', false); // n'écrit que si nécessaire
          }
        }
      } catch (_) { /* silencieux */ }
    };
    marquer();
    const { data: sub } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === 'SIGNED_IN') marquer();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Splash natif visible tant que les polices chargent
  if (!polices) return null;

  return (
    // Design clair fixe (comme les apps food) — pas de bascule sombre
    <ThemeProvider value={DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
