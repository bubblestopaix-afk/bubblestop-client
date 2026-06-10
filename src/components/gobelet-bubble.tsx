// === Gobelet bubble tea (récompense fidélité) ===
// Reprise exacte du dessin SVG du POS (EcranFidelite) : gobelet de thé au lait,
// paille violette, perles de tapioca — affiché comme 10e case de la carte.
import Svg, { Rect, Ellipse, Path, G, Circle, Text as SvgText } from 'react-native-svg';

export default function GobeletBubble({ size = 28, avecL = false }: { size?: number; avecL?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {/* Paille violette, légèrement inclinée */}
      <Rect
        x="29.5" y="1" width="5" height="18" rx="2.5"
        fill="#633e90" stroke="#4c2d77" strokeWidth="0.8"
        transform="rotate(9 32 10)"
      />
      {/* Couvercle (dôme) */}
      <Ellipse cx="32" cy="14" rx="16.5" ry="3.6" fill="#7a4a22" />
      <Ellipse cx="32" cy="13" rx="16.5" ry="3.1" fill="#9a6938" />
      {/* Corps du gobelet */}
      <Path d="M16 14 L48 14 L44 56 L20 56 Z" fill="#c89569" />
      {/* Liquide thé au lait */}
      <Path d="M18 18 L46 18 L43 50 L21 50 Z" fill="#b88553" opacity={0.92} />
      {/* Perles (boba) */}
      <G fill="#1f1612">
        <Circle cx="24" cy="50" r="3" />
        <Circle cx="30" cy="51.5" r="3" />
        <Circle cx="36" cy="50" r="3" />
        <Circle cx="40" cy="51.5" r="2.8" />
        <Circle cx="27" cy="46.5" r="2.5" />
        <Circle cx="33" cy="46.5" r="2.5" />
        <Circle cx="39" cy="46.5" r="2.5" />
      </G>
      {/* Reflet vertical */}
      <Path d="M22 20 L20.5 47" stroke="#e8c89a" strokeWidth="2" opacity={0.5} strokeLinecap="round" />
      {/* Mention L (grande taille offerte) */}
      {avecL && (
        <SvgText
          x="32" y="37" textAnchor="middle"
          fontSize="19" fontWeight="700"
          fill="#ffffff" stroke="#7a4a22" strokeWidth="0.7">
          L
        </SvgText>
      )}
    </Svg>
  );
}
