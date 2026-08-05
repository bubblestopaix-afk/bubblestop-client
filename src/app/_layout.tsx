import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { PaytoneOne_400Regular } from '@expo-google-fonts/paytone-one';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import {
  Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { GardeMiseAJour } from '@/components/garde-mise-a-jour';
import AppTabs from '@/components/app-tabs';
import { GateNaissance } from '@/components/gate-naissance';
import { GatePrenom, prenomReporte } from '@/components/gate-prenom';
import { supabase } from '@/lib/supabase';
import { appliquerParrainEnAttente } from '@/lib/parrainage';
import { enregistrerPush } from '@/lib/push';

export default function TabLayout() {
  // Polices DA kawaii : Fredoka (titres) + Outfit (textes) + Paytone One (logo)
  const [polices] = useFonts({
    Fredoka_600SemiBold, PaytoneOne_400Regular,
    Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold,
  });

  // Utilisateur connecté SANS date de naissance → on bloque sur l'écran de saisie.
  const [naissanceUserId, setNaissanceUserId] = useState<string | null>(null);

  // Connecté SANS prénom → encart de rattrapage, REPORTABLE (voir gate-prenom).
  // Les deux portes ne s'affichent jamais ensemble : l'anniversaire d'abord.
  const [prenomUserId, setPrenomUserId] = useState<string | null>(null);

  // Badge sur l'icône : les pushs (offres, agent, POS) posent badge=1 → on l'efface
  // dès que l'appli est ouverte / revient au premier plan (le client « a vu »).
  // + Handler PREMIER PLAN : sans lui, iOS n'affiche RIEN quand un push arrive
  // pendant que l'appli est OUVERTE (cas vécu : Yoann publie une offre depuis
  // l'admin de l'appli → le push part → l'app est au premier plan → silence).
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true, // bannière même appli ouverte (SDK 53+)
            shouldShowList: true,   // visible dans le centre de notifications
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });
      } catch { /* ignore (web / module absent) */ }
    })();
    const effacer = async () => {
      try { (await import('expo-notifications')).setBadgeCountAsync(0); } catch { /* ignore */ }
    };
    effacer();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') effacer(); });
    return () => sub.remove();
  }, []);

  // Marque le profil "utilise l'appli" (la borne masque alors la promo de téléchargement)
  // + garantit qu'une ligne profils existe (ex. première connexion via Google)
  // + détecte l'absence de date de naissance (Google/Apple/anciens comptes) → gate bloquant.
  useEffect(() => {
    const marquer = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setNaissanceUserId(null); return; }
        // Jeton de notifications enregistré dès l'OUVERTURE (avant : seulement en visitant
        // l'onglet Compte → beaucoup de clients connectés ne recevaient jamais de push).
        enregistrerPush();
        // Code parrain scanné AVANT l'inscription (/p?c=…) → appliqué dès la connexion.
        appliquerParrainEnAttente().catch(() => {});
        const { data: prof } = await supabase.from('profils')
          .select('id, date_naissance, nom').eq('id', session.user.id).maybeSingle();
        if (!prof) {
          // Nouveau compte (souvent Google/Apple) : on crée la ligne, sans date → gate.
          await supabase.from('profils').insert({
            id: session.user.id,
            email: session.user.email,
            // `full_name` est la clé de Google. Apple ne renseigne aucune de ces clés
            // (vérifié : 14 comptes Apple sur 14 sans `given_name`) — son prénom est
            // capté à la source, dans loginApple. Les alternatives ci-dessous ne
            // coûtent rien et couvrent les fournisseurs qui nomment autrement.
            nom: (session.user.user_metadata as any)?.full_name
              || (session.user.user_metadata as any)?.name
              || (session.user.user_metadata as any)?.given_name
              || null,
            app_utilisee: true,
            prenom_sur_ticket: true,
          });
          setNaissanceUserId(session.user.id);
          setPrenomUserId(null);
        } else {
          await supabase.from('profils')
            .update({ app_utilisee: true })
            .eq('id', session.user.id)
            .eq('app_utilisee', false); // n'écrit que si nécessaire
          setNaissanceUserId(prof.date_naissance ? null : session.user.id);
          const sansPrenom = !prof.nom || !String(prof.nom).trim();
          setPrenomUserId(sansPrenom && !(await prenomReporte()) ? session.user.id : null);
        }
      } catch (_) { /* silencieux */ }
    };
    marquer();
    const { data: sub } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === 'SIGNED_IN') marquer();
      else if (evt === 'SIGNED_OUT') { setNaissanceUserId(null); setPrenomUserId(null); }
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
      <GardeMiseAJour />
      {naissanceUserId && (
        <GateNaissance userId={naissanceUserId} onDone={() => setNaissanceUserId(null)} />
      )}
      {!naissanceUserId && prenomUserId && (
        <GatePrenom userId={prenomUserId} onDone={() => setPrenomUserId(null)} />
      )}
    </ThemeProvider>
  );
}
