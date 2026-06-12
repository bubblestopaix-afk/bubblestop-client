import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import { usePanier } from '@/store/panier';

// === Icônes SVG maison du bandeau (remplacent les PNG teintés) ===
// Trait 2px arrondi ; version ACTIVE = remplissage léger + trait plein.

function IconeAccueil({ color, size, focused }: { color: string; size: number; focused: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Toit + murs */}
      <Path
        d="M3.5 10.5 L12 3.5 L20.5 10.5 L20.5 19 Q20.5 20.5 19 20.5 L5 20.5 Q3.5 20.5 3.5 19 Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.18 : 0}
      />
      {/* Porte */}
      <Path
        d="M9.5 20.5 L9.5 14.5 Q9.5 13.5 10.5 13.5 L13.5 13.5 Q14.5 13.5 14.5 14.5 L14.5 20.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill={focused ? color : 'none'}
      />
    </Svg>
  );
}

function IconeCommander({ color, size, focused }: { color: string; size: number; focused: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Paille inclinée */}
      <Line x1="13.2" y1="2" x2="15.8" y2="5.4" stroke={color} strokeWidth={2} strokeLinecap="round" />
      {/* Couvercle */}
      <Path d="M5.5 6.5 L18.5 6.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
      {/* Gobelet trapèze */}
      <Path
        d="M6 6.5 L18 6.5 L16.4 20 Q16.2 21.5 14.7 21.5 L9.3 21.5 Q7.8 21.5 7.6 20 Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.18 : 0}
      />
      {/* Perles de tapioca */}
      <Circle cx="10" cy="17.5" r="1.15" fill={color} />
      <Circle cx="13.6" cy="17.8" r="1.15" fill={color} />
      <Circle cx="11.8" cy="14.8" r="1.15" fill={color} />
    </Svg>
  );
}

function IconeFidelite({ color, size, focused }: { color: string; size: number; focused: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Boîte cadeau */}
      <Rect
        x="4"
        y="9.5"
        width="16"
        height="11"
        rx="2"
        stroke={color}
        strokeWidth={2}
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.18 : 0}
      />
      {/* Couvercle */}
      <Path d="M3.2 6.5 L20.8 6.5 L20.8 9.5 L3.2 9.5 Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {/* Ruban vertical */}
      <Line x1="12" y1="6.5" x2="12" y2="20.5" stroke={color} strokeWidth={2} />
      {/* Nœud : deux boucles */}
      <Path d="M12 6.3 Q8.5 6 8.8 3.8 Q9.1 2 11 3 Q12.4 3.9 12 6.3 Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M12 6.3 Q15.5 6 15.2 3.8 Q14.9 2 13 3 Q11.6 3.9 12 6.3 Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

function IconeCompte({ color, size, focused }: { color: string; size: number; focused: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Tête */}
      <Circle
        cx="12"
        cy="8"
        r="4.2"
        stroke={color}
        strokeWidth={2}
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.18 : 0}
      />
      {/* Épaules */}
      <Path
        d="M4.5 20.5 Q4.5 14.8 12 14.8 Q19.5 14.8 19.5 20.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.18 : 0}
      />
    </Svg>
  );
}

// Tabs classiques expo-router (compatibles SDK 54)
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
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
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
          // Compteur d'articles visible depuis n'importe quel onglet
          tabBarBadge: nbArticles > 0 ? nbArticles : undefined,
          tabBarBadgeStyle: { backgroundColor: '#A3C724', color: '#2A1D46', fontWeight: '800' },
          tabBarIcon: ({ color, size, focused }) => <IconeCommander color={color} size={size} focused={focused} />,
        }}
      />
      {/* Ordre standard : le Compte en dernier, la Fidélité avant */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Fidélité',
          tabBarIcon: ({ color, size, focused }) => <IconeFidelite color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="compte"
        options={{
          title: 'Compte',
          tabBarIcon: ({ color, size, focused }) => <IconeCompte color={color} size={size} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
