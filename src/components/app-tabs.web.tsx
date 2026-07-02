// Web : même barre d'onglets que le natif (Accueil / Commander / Fidélité / Offres / Compte,
// avec badge panier). NB : pas de ré-export de './app-tabs' ici — sur web, Metro
// résoudrait vers CE fichier (boucle infinie). On duplique donc l'implémentation,
// mais les icônes SVG viennent du module partagé tab-icons (pas de boucle).
import { Tabs } from 'expo-router';

import { C, F } from '@/constants/charte';
import { IconeAccueil, IconeCommander, IconeCompte, IconeFidelite, IconeOffres, TEINTE_ACTIVE } from '@/components/tab-icons';
import { usePanier } from '@/store/panier';
import { useCommandeEnLigne } from '@/lib/app-config';

export default function AppTabs() {
  // Badge panier sur l'onglet Commander (compteur visible partout)
  const nbArticles = usePanier().reduce((s, l) => s + (l.quantite || 1), 0);
  // Même règle que le natif : onglet Commander visible si flag serveur OU admin
  const { actif, admin } = useCommandeEnLigne();
  const montrerCommander = actif || admin;

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
        options={montrerCommander ? {
          title: 'Commander',
          tabBarBadge: nbArticles > 0 ? nbArticles : undefined,
          tabBarBadgeStyle: { backgroundColor: C.vert, color: C.violetProfond, fontFamily: F.t800 },
          tabBarIcon: ({ color, size, focused }) => <IconeCommander color={color} size={size} focused={focused} />,
        } : {
          // Flag serveur OFF → onglet masqué (⚠️ pas de `href` + tabBarButton ensemble, cf. natif)
          title: 'Commander',
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
      {/* Route /c (carte express) accessible mais jamais affichée comme onglet — comme en natif */}
      <Tabs.Screen
        name="c"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
    </Tabs>
  );
}
