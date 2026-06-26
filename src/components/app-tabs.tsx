import { Tabs } from 'expo-router';

import { C, F } from '@/constants/charte';
import { IconeAccueil, IconeCommander, IconeCompte, IconeFidelite, IconeOffres, TEINTE_ACTIVE } from '@/components/tab-icons';
import { usePanier } from '@/store/panier';

// Barre d'onglets (5, style app food) : Accueil · Commander · Fidélité · Offres · Compte.
// Design clair fixe — icônes dans tab-icons.tsx.
export default function AppTabs() {
  // Badge panier sur l'onglet Commander (compteur visible partout)
  const nbArticles = usePanier().reduce((s, l) => s + (l.quantite || 1), 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: TEINTE_ACTIVE.light,
        tabBarInactiveTintColor: C.texte3,
        tabBarStyle: { backgroundColor: C.carte, borderTopColor: C.bord },
        tabBarLabelStyle: { fontFamily: F.t700, fontSize: 10.5 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size, focused }) => <IconeAccueil color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="commander"
        options={{
          title: 'Commander',
          tabBarBadge: nbArticles > 0 ? nbArticles : undefined,
          tabBarBadgeStyle: { backgroundColor: C.vert, color: C.violetProfond, fontFamily: F.t800 },
          tabBarIcon: ({ color, size, focused }) => <IconeCommander color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Fidélité',
          tabBarIcon: ({ color, size, focused }) => <IconeFidelite color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="offres"
        options={{
          title: 'Offres',
          tabBarIcon: ({ color, size, focused }) => <IconeOffres color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="compte"
        options={{
          title: 'Compte',
          tabBarIcon: ({ color, size, focused }) => <IconeCompte color={color} size={size} focused={focused} />,
        }}
      />
      {/* Réclamation d'une carte fidélité temporaire (/c?t=<jeton>) — route accessible mais PAS un onglet.
          href:null ne suffit pas ici (route avec sous-layout) → on masque aussi le bouton + l'item. */}
      <Tabs.Screen
        name="c"
        options={{ href: null, tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
  );
}
