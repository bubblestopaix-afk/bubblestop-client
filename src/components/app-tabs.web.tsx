// Web : même barre d'onglets que le natif (Accueil / Commander / Fidélité / Compte,
// avec badge panier). NB : pas de ré-export de './app-tabs' ici — sur web, Metro
// résoudrait vers CE fichier (boucle infinie). On duplique donc l'implémentation.
import { Tabs } from 'expo-router';
import { Image, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { usePanier } from '@/store/panier';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  // Badge panier sur l'onglet Commander (standard apps food : compteur visible partout)
  const nbArticles = usePanier().reduce((s, l) => s + (l.quantite || 1), 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => (
            <Image
              source={require('@/assets/images/tabIcons/home.png')}
              style={{ width: size, height: size, tintColor: color }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="commander"
        options={{
          title: 'Commander',
          tabBarBadge: nbArticles > 0 ? nbArticles : undefined,
          tabBarBadgeStyle: { backgroundColor: '#A3C724', color: '#2A1D46', fontWeight: '800' },
          tabBarIcon: ({ color, size }) => (
            <Image
              source={require('@/assets/images/tabIcons/commander.png')}
              style={{ width: size, height: size, tintColor: color }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Fidélité',
          tabBarIcon: ({ color, size }) => (
            <Image
              source={require('@/assets/images/tabIcons/explore.png')}
              style={{ width: size, height: size, tintColor: color }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="compte"
        options={{
          title: 'Compte',
          tabBarIcon: ({ color, size }) => (
            <Image
              source={require('@/assets/images/tabIcons/compte.png')}
              style={{ width: size, height: size, tintColor: color }}
            />
          ),
        }}
      />
    </Tabs>
  );
}
