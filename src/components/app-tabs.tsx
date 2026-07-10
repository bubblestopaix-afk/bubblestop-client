import { Tabs } from 'expo-router';

import { C, F } from '@/constants/charte';
import { IconeAccueil, IconeCommander, IconeCompte, IconeFidelite, IconeOffres, TEINTE_ACTIVE } from '@/components/tab-icons';
import { usePanier } from '@/store/panier';
import { useCommandeEnLigne } from '@/lib/app-config';

// Barre d'onglets (5, style app food) : Accueil · Commander · Fidélité · Offres · Compte.
// Design clair fixe — icônes dans tab-icons.tsx.
export default function AppTabs() {
  // Badge panier sur l'onglet Commander (compteur visible partout)
  const nbArticles = usePanier().reduce((s, l) => s + (l.quantite || 1), 0);
  // Commande en ligne activée (flag serveur) OU admin → onglet visible. Sinon masqué
  // (l'appli sert d'abord à la fidélité). OFF par défaut tant que le flag n'est pas chargé.
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
          // Commande désactivée (flag serveur OFF) → onglet masqué. ⚠️ PAS de `href` ici
          // (expo-router crash si href + tabBarButton ensemble) : on masque via tabBarButton.
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
      {/* Réclamation d'une carte fidélité temporaire (/c?t=<jeton>) — route accessible (deep link)
          mais PAS un onglet. ⚠️ expo-router INTERDIT `href` + `tabBarButton` ENSEMBLE (il throw
          « Cannot use `href` and `tabBarButton` together » → crash au lancement). On masque donc
          UNIQUEMENT via tabBarButton + tabBarItemStyle, SANS href. */}
      <Tabs.Screen
        name="c"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
      {/* Lien/QR de parrainage (/p?c=<code>) — même traitement que /c (route sans onglet). */}
      <Tabs.Screen
        name="p"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
      {/* 🕹️ Boba Quest (/jeu) — le jeu à collection, ouvert depuis l'accueil.
          Route SANS onglet (même pattern que /c et /p : jamais de `href` ici). */}
      <Tabs.Screen
        name="jeu"
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
    </Tabs>
  );
}
