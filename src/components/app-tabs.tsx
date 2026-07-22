import { Tabs } from 'expo-router';

import { C, F } from '@/constants/charte';
import { IconeAccueil, IconeCarteCadeau, IconeCompte, IconeFidelite, TEINTE_ACTIVE } from '@/components/tab-icons';
import { useFonctionnalite } from '@/lib/fonctionnalites';

// Barre d'onglets : Accueil · Fidélité · Cadeau (si activé) · Compte.
// Les offres restent consultables depuis l'Accueil, mais n'occupent plus un onglet.
// Design clair fixe — icônes dans tab-icons.tsx.
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
      <Tabs.Screen
        name="commander"
        options={{
          // Décision produit 15/07/2026 : commande retirée pour tous, admins compris.
          // La route reste enregistrée mais cachée ; son layout redirige aussi les anciens liens.
          // ⚠️ PAS de `href` ici : expo-router crash si href + tabBarButton sont combinés.
          title: 'Commander',
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      {/* Menu vitrine (/menu) — consultable depuis les photos de l'accueil, sans
          panier ni commande. Route cachée dans la barre, comme les autres détails. */}
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
          // Toggle admin OFF : onglet absent sans combiner `href` et tabBarButton.
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="offres"
        options={{
          // Les cartes de l'accueil ouvrent toujours /offres pour afficher le détail.
          // La route reste enregistrée mais n'est plus un onglet redondant.
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
      {/* Ancienne carte retirée : /c reste uniquement comme garde-route pour rediriger les
          anciens liens vers Fidélité. Elle ne doit jamais devenir un onglet. */}
      <Tabs.Screen
        name="c"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
      {/* Lien/QR de parrainage (/p?c=<code>) — route sans onglet. */}
      <Tabs.Screen
        name="p"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
      {/* 🕹️ Boba Quest (/jeu) — le jeu à collection, ouvert depuis l'accueil.
          Route SANS onglet (même pattern que /p : jamais de `href` ici). */}
      <Tabs.Screen
        name="jeu"
        options={{
          // plein écran : pas d'onglets client dans le jeu
          tabBarStyle: { display: 'none' },
          tabBarButton: () => null, tabBarItemStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
