// === Icônes du bandeau (partagées natif + web) ===
// Grille 24x24, trait 1.8 arrondi, géométrie soignée.
// État ACTIF = remplissage duotone léger (0.15) + trait plein.

import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

type IconeProps = { color: string; size: number; focused: boolean };

// Maison : toit à faîte adouci, base arrondie, porte cintrée centrée
export function IconeAccueil({ color, size, focused }: IconeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4.1 10.7 L10.93 4.42 Q12 3.44 13.07 4.42 L19.9 10.7 L19.9 18.5 Q19.9 20.3 18.1 20.3 L5.9 20.3 Q4.1 20.3 4.1 18.5 Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.15 : 0}
      />
      <Path
        d="M9.75 20.3 L9.75 15.45 Q9.75 14.05 11.15 14.05 L12.85 14.05 Q14.25 14.05 14.25 15.45 L14.25 20.3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

// Bubble tea : couvercle dôme, paille traversante, gobelet fuselé, perles
export function IconeCommander({ color, size, focused }: IconeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Paille inclinée, derrière le dôme */}
      <Line x1="14.9" y1="1.9" x2="13.2" y2="7.7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      {/* Dôme du couvercle */}
      <Path
        d="M6.7 7.9 Q6.7 3.7 12 3.7 Q17.3 3.7 17.3 7.9"
        stroke={color}
        strokeWidth={1.8}
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.15 : 0}
      />
      {/* Bord du couvercle, légèrement débordant */}
      <Line x1="5.7" y1="7.9" x2="18.3" y2="7.9" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      {/* Gobelet fuselé, fond arrondi */}
      <Path
        d="M6.5 7.9 L17.5 7.9 L16.3 19.6 Q16.12 21.3 14.4 21.3 L9.6 21.3 Q7.88 21.3 7.7 19.6 Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.15 : 0}
      />
      {/* Perles de tapioca */}
      <Circle cx="9.8" cy="17.6" r="1.15" fill={color} />
      <Circle cx="12.05" cy="18.35" r="1.15" fill={color} />
      <Circle cx="14.25" cy="17.5" r="1.15" fill={color} />
      <Circle cx="11" cy="15.3" r="1.15" fill={color} />
    </Svg>
  );
}

// Cadeau : boîte arrondie, couvercle débordant, ruban et nœud à deux boucles lisses
export function IconeFidelite({ color, size, focused }: IconeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="4.7"
        y="10.9"
        width="14.6"
        height="9.4"
        rx="1.7"
        stroke={color}
        strokeWidth={1.8}
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.15 : 0}
      />
      <Rect
        x="3.5"
        y="7.5"
        width="17"
        height="3.4"
        rx="1.2"
        stroke={color}
        strokeWidth={1.8}
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.15 : 0}
      />
      {/* Ruban vertical */}
      <Line x1="12" y1="10.9" x2="12" y2="20.3" stroke={color} strokeWidth={1.8} />
      {/* Boucles du nœud, courbes symétriques */}
      <Path
        d="M12 7.5 C9.4 7.5 8 6.8 8 5.4 C8 4.15 9.15 3.55 10.2 4.3 C11.2 5 11.85 6.1 12 7.5 Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.15 : 0}
      />
      <Path
        d="M12 7.5 C14.6 7.5 16 6.8 16 5.4 C16 4.15 14.85 3.55 13.8 4.3 C12.8 5 12.15 6.1 12 7.5 Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.15 : 0}
      />
    </Svg>
  );
}

// Offres : étiquette promo inclinée avec œillet
export function IconeOffres({ color, size, focused }: IconeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.9 11 L3.9 5.8 Q3.9 3.9 5.8 3.9 L11 3.9 Q12 3.9 12.7 4.6 L19.7 11.6 Q21 12.9 19.7 14.2 L14.2 19.7 Q12.9 21 11.6 19.7 L4.6 12.7 Q3.9 12 3.9 11 Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.15 : 0}
      />
      {/* Œillet de l'étiquette */}
      <Circle cx="8" cy="8" r="1.45" stroke={color} strokeWidth={1.6} fill="none" />
    </Svg>
  );
}

// Profil : tête + buste aux épaules arrondies
export function IconeCompte({ color, size, focused }: IconeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="7.7"
        r="3.85"
        stroke={color}
        strokeWidth={1.8}
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.15 : 0}
      />
      <Path
        d="M5.1 20.3 L5.1 19.5 Q5.1 14.9 12 14.9 Q18.9 14.9 18.9 19.5 L18.9 20.3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.15 : 0}
      />
    </Svg>
  );
}

// Teinte active du bandeau : violet Bubble Stop (lisible sur fond clair et sombre)
export const TEINTE_ACTIVE = { light: '#3A2A5E', dark: '#CDBFE6' } as const;
