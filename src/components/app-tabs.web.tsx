// Web : même barre d'onglets que le natif (Cadeau est conditionnel au toggle).
// NB : pas de ré-export de './app-tabs' ici — sur web, Metro
// résoudrait vers CE fichier (boucle infinie). On duplique donc l'implémentation,
// mais les icônes SVG viennent du module partagé tab-icons (pas de boucle).
import { Tabs } from 'expo-router';

import { C, F } from '@/constants/charte';
import { IconeAccueil, IconeCarteCadeau, IconeCompte, IconeFidelite, TEINTE_ACTIVE } from '@/components/tab-icons';
import { useFonctionnalite } from '@/lib/fonctionnalites';

export default function AppTabs() {
  const carteCadeau = useFonctionnalite('carte_cadeau');
  const afficherCarteCadeau = carteCadeau.charge && carteCadeau.actif;
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
      {/* Menu vitrine (/menu) — route de détail sans onglet, miroir du natif. */}
      <Tabs.Screen
        name="menu"
        options={{
          tabBarStyle: { display: 'none' },
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
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
        name="carte-cadeau"
        options={afficherCarteCadeau ? {
          title: 'Cadeau',
          tabBarIcon: ({ color, size, focused }) => <IconeCarteCadeau color={color} size={size} focused={focused} />,
        } : {
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="offres"
        options={{
          // Les cartes de l'accueil ouvrent toujours /offres pour afficher le détail.
          // Route cachée, miroir strict du natif.
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="compte"
        options={{
          title: 'Compte',
          tabBarIcon: ({ color, size, focused }) => <IconeCompte color={color} size={size} focused={focused} />,
        }}
      />
      {/* Ancienne carte retirée : /c redirige les anciens liens, sans onglet — miroir du natif. */}
      <Tabs.Screen
        name="c"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
      {/* Route /p (parrainage) — route sans onglet (miroir du natif) */}
      <Tabs.Screen
        name="p"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
      {/* 🕹️ Boba Quest (/jeu) — route sans onglet (miroir du natif) */}
      <Tabs.Screen
        name="jeu"
        options={{
          // plein écran : pas d'onglets client dans le jeu
          tabBarStyle: { display: 'none' },
          tabBarButton: () => null, tabBarItemStyle: { display: 'none' },
        }}
      />
      {/* 🗼 Boba Tower (/boba-tower) — route sans onglet (miroir du natif) */}
      <Tabs.Screen
        name="boba-tower"
        options={{
          // plein écran : pas d'onglets client dans le jeu
          tabBarStyle: { display: 'none' },
          tabBarButton: () => null, tabBarItemStyle: { display: 'none' },
        }}
      />
      {/* 🎡 La Roue du Mois (/roue) — route sans onglet (miroir du natif) */}
      <Tabs.Screen
        name="roue"
        options={{
          // plein écran : pas d'onglets client dans le jeu
          tabBarStyle: { display: 'none' },
          tabBarButton: () => null, tabBarItemStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
