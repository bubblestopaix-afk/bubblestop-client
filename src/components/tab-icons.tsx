// === Icônes du bandeau (partagées natif + web) ===
// Redesign : formes CHUNKY arrondies dans l'esprit du logo (traits épais, angles
// ronds). État ACTIF = silhouette pleine + détails en négatif ; inactif = contour.
import Svg, { Path, Circle, Rect, Line, G } from 'react-native-svg';

type IconeProps = { color: string; size: number; focused: boolean };

// Épaisseur de trait généreuse, comme les lettres du logo.
const T = 2.15;

// Fond des découpes en état plein (le bandeau est clair) — donne l'effet "négatif".
const NEG = '#FBF7FF';

// Maison — toit dômé, porte cintrée
export function IconeAccueil({ color, size, focused }: IconeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.6 11 L10.8 4.3 Q12 3.2 13.2 4.3 L20.4 11 L20.4 18.4 Q20.4 20.4 18.4 20.4 L5.6 20.4 Q3.6 20.4 3.6 18.4 Z"
        stroke={color} strokeWidth={T} strokeLinejoin="round"
        fill={focused ? color : 'none'}
      />
      <Path
        d="M9.4 20.4 L9.4 15.1 Q9.4 13.6 10.9 13.6 L13.1 13.6 Q14.6 13.6 14.6 15.1 L14.6 20.4"
        stroke={focused ? NEG : color} strokeWidth={T} strokeLinecap="round" strokeLinejoin="round"
        fill={focused ? NEG : 'none'}
      />
    </Svg>
  );
}

// Bubble tea — couvercle dôme, paille, gobelet fuselé, perles
export function IconeCommander({ color, size, focused }: IconeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="15.1" y1="1.8" x2="13.3" y2="7.6" stroke={color} strokeWidth={T} strokeLinecap="round" />
      <Path
        d="M6.3 8 L17.7 8 L16.4 19.8 Q16.2 21.5 14.4 21.5 L9.6 21.5 Q7.8 21.5 7.6 19.8 Z"
        stroke={color} strokeWidth={T} strokeLinejoin="round"
        fill={focused ? color : 'none'}
      />
      <Path d="M6.4 7.9 Q6.4 3.6 12 3.6 Q17.6 3.6 17.6 7.9" stroke={color} strokeWidth={T} strokeLinecap="round" fill="none" />
      <Line x1="5.5" y1="7.9" x2="18.5" y2="7.9" stroke={color} strokeWidth={T} strokeLinecap="round" />
      <G fill={focused ? NEG : color}>
        <Circle cx="9.9" cy="17.6" r="1.15" />
        <Circle cx="12.1" cy="18.4" r="1.15" />
        <Circle cx="14.2" cy="17.5" r="1.15" />
        <Circle cx="11" cy="15.4" r="1.15" />
      </G>
    </Svg>
  );
}

// Fidélité — carte à tampons (perles) : c'est LITTÉRALEMENT l'écran fidélité
export function IconeFidelite({ color, size, focused }: IconeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="3.2" y="5.6" width="17.6" height="12.8" rx="3.2"
        stroke={color} strokeWidth={T} strokeLinejoin="round"
        fill={focused ? color : 'none'}
      />
      {/* rangée de tampons */}
      <G>
        <Circle cx="7.6" cy="12" r="1.55" stroke={focused ? NEG : color} strokeWidth={1.7} fill={focused ? color : 'none'} />
        <Circle cx="12" cy="12" r="1.55" stroke={focused ? NEG : color} strokeWidth={1.7} fill={focused ? NEG : 'none'} />
        <Circle cx="16.4" cy="12" r="1.55" stroke={focused ? NEG : color} strokeWidth={1.7} fill={focused ? NEG : 'none'} />
      </G>
    </Svg>
  );
}

// Carte cadeau / solde prépayé — carte avec euro, distincte de la carte à tampons
export function IconeCarteCadeau({ color, size, focused }: IconeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="3.2" y="5.2" width="17.6" height="13.6" rx="3.2"
        stroke={color} strokeWidth={T} strokeLinejoin="round"
        fill={focused ? color : 'none'}
      />
      <Line x1="3.8" y1="9.2" x2="20.2" y2="9.2" stroke={focused ? NEG : color} strokeWidth={1.8} />
      <Path
        d="M15.2 12.1 C14.5 11.5 13.6 11.2 12.7 11.2 C10.7 11.2 9.4 12.5 9.4 14 C9.4 15.6 10.7 16.8 12.7 16.8 C13.6 16.8 14.5 16.5 15.2 15.9 M8.4 13.2 H13.1 M8.4 14.9 H12.7"
        stroke={focused ? NEG : color} strokeWidth={1.55} strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

// Offres — étiquette promo avec "%"
export function IconeOffres({ color, size, focused }: IconeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.8 11 L3.8 5.6 Q3.8 3.8 5.6 3.8 L11 3.8 Q12.1 3.8 12.9 4.6 L19.8 11.5 Q21.1 12.8 19.8 14.1 L14.1 19.8 Q12.8 21.1 11.5 19.8 L4.6 12.9 Q3.8 12.1 3.8 11 Z"
        stroke={color} strokeWidth={T} strokeLinejoin="round"
        fill={focused ? color : 'none'}
      />
      <Circle cx="8" cy="8" r="1.5" stroke={focused ? NEG : color} strokeWidth={1.7} fill={focused ? NEG : 'none'} />
      {/* signe pourcent */}
      <G stroke={focused ? NEG : color} strokeWidth={1.7} strokeLinecap="round">
        <Line x1="10.4" y1="14.3" x2="14.3" y2="10.4" />
        <Circle cx="10.7" cy="10.7" r="0.6" fill={focused ? NEG : color} />
        <Circle cx="14" cy="14" r="0.6" fill={focused ? NEG : color} />
      </G>
    </Svg>
  );
}

// Compte — buste arrondi
export function IconeCompte({ color, size, focused }: IconeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12" cy="8" r="4"
        stroke={color} strokeWidth={T}
        fill={focused ? color : 'none'}
      />
      <Path
        d="M4.6 20.4 L4.6 19.4 Q4.6 14.4 12 14.4 Q19.4 14.4 19.4 19.4 L19.4 20.4"
        stroke={color} strokeWidth={T} strokeLinecap="round" strokeLinejoin="round"
        fill={focused ? color : 'none'}
      />
    </Svg>
  );
}

// Teinte active du bandeau : violet Bubble Stop (lisible sur fond clair et sombre)
export const TEINTE_ACTIVE = { light: '#3A2A5E', dark: '#CDBFE6' } as const;
