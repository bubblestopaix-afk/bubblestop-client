import { useEffect, useState } from 'react';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { PaytoneOne_400Regular } from '@expo-google-fonts/paytone-one';
import {
  Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { GateNaissance } from '@/components/gate-naissance';
import { supabase } from '@/lib/supabase';

export default function TabLayout() {
  // Polices DA : Paytone One (titres) + Outfit (textes)
  const [polices] = useFonts({
    PaytoneOne_400Regular,
    Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold,
  });

  // Utilisateur connecté SANS date de naissance → on bloque sur l'écran de saisie.
  const [naissanceUserId, setNaissanceUserId] = useState<string | null>(null);

  // Marque le profil "utilise l'appli" (la borne masque alors la promo de téléchargement)
  // + garantit qu'une ligne profils existe (ex. première connexion via Google)
  // + détecte l'absence de date de naissance (Google/Apple/anciens comptes) → gate bloquant.
  useEffect(() => {
    const marquer = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setNaissanceUserId(null); return; }
        const { data: prof } = await supabase.from('profils')
          .select('id, date_naissance').eq('id', session.user.id).maybeSingle();
        if (!prof) {
          // Nouveau compte (souvent Google/Apple) : on crée la ligne, sans date → gate.
          await supabase.from('profils').insert({
            id: session.user.id,
            email: session.user.email,
            nom: (session.user.user_metadata as any)?.full_name || null,
            app_utilisee: true,
          });
          setNaissanceUserId(session.user.id);
        } else {
          await supabase.from('profils')
            .update({ app_utilisee: true })
            .eq('id', session.user.id)
            .eq('app_utilisee', false); // n'écrit que si nécessaire
          setNaissanceUserId(prof.date_naissance ? null : session.user.id);
        }
      } catch (_) { /* silencieux */ }
    };
    marquer();
    const { data: sub } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === 'SIGNED_IN') marquer();
      else if (evt === 'SIGNED_OUT') setNaissanceUserId(null);
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
      {naissanceUserId && (
        <GateNaissance userId={naissanceUserId} onDone={() => setNaissanceUserId(null)} />
      )}
    </ThemeProvider>
  );
}
