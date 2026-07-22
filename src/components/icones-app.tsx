// === Bubble Stop — icônes maison de l'APPLI (client) ===
// Style SOBRE et pro : traits violets nets, aplats discrets de la charte, pas de
// frimousses ni d'étincelles (à la différence des icônes ludiques de Boba Quest).
// Un seul composant <IconeApp nom="…" taille={…} />. Remplacent les emojis.
import Svg, { Path, Circle, Line, Rect, G } from 'react-native-svg';

const VIOLET = '#4c2d77';
const VERT = '#5B8A1E';
const OR = '#C99012';

export type IconeAppNom =
  | 'cadeau' | 'carte' | 'cloche' | 'telephone' | 'sans-telephone' | 'pin'
  | 'cadenas' | 'outils' | 'liste' | 'euro' | 'megaphone' | 'corbeille'
  | 'horloge' | 'gateau' | 'alerte' | 'coche' | 'info' | 'etiquette'
  | 'anniversaire' | 'ticket' | 'stylo' | 'coeur' | 'boite-vide' | 'panier' | 'personne';

function Glyphe({ nom }: { nom: IconeAppNom }) {
  switch (nom) {
    // 🎁 Cadeau — boîte + ruban (sobre)
    case 'cadeau':
      return (
        <G fill="none" stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round">
          <Rect x={4.5} y={9} width={15} height={11} rx={1.6} />
          <Line x1={4.5} y1={13} x2={19.5} y2={13} />
          <Rect x={4} y={6} width={16} height={3.2} rx={1} />
          <Line x1={12} y1={6} x2={12} y2={20} />
          <Path d="M12 6 C9 6 8 2.6 10.4 2.6 C12 2.6 12 4.4 12 6 C12 4.4 12 2.6 13.6 2.6 C16 2.6 15 6 12 6 Z" strokeWidth={1.4} />
        </G>
      );
    // Carte de fidélité — carte + zone QR
    case 'carte':
      return (
        <G fill="none" stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round">
          <Rect x={3} y={5.5} width={18} height={13} rx={2.4} />
          <Rect x={5.6} y={8.4} width={5.2} height={5.2} rx={0.8} strokeWidth={1.3} />
          <Line x1={13.4} y1={9} x2={18} y2={9} strokeWidth={1.4} strokeLinecap="round" />
          <Line x1={13.4} y1={12} x2={17} y2={12} strokeWidth={1.4} strokeLinecap="round" />
          <Line x1={5.6} y1={16} x2={12} y2={16} strokeWidth={1.4} strokeLinecap="round" />
        </G>
      );
    // 🎟️ Carte de fidélité / ticket — ticket cranté
    case 'ticket':
      return (
        <G stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round">
          <Path d="M3.5 7 H20.5 V10 A2 2 0 0 0 20.5 14 V17 H3.5 V14 A2 2 0 0 0 3.5 10 Z" fill="#F1ECFA" />
          <Line x1={12} y1={8} x2={12} y2={16} strokeWidth={1.3} strokeDasharray="1.4 1.6" strokeLinecap="round" />
        </G>
      );
    // 🔔 Cloche — notifications
    case 'cloche':
      return (
        <G stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round">
          <Path d="M12 4 C15.4 4 16.2 7.4 16.4 10.4 C16.6 13.4 17.4 15.2 18.4 16 L5.6 16 C6.6 15.2 7.4 13.4 7.6 10.4 C7.8 7.4 8.6 4 12 4 Z" fill="#F1ECFA" />
          <Path d="M10 18.4 Q12 20 14 18.4" fill="none" strokeLinecap="round" />
          <Line x1={12} y1={2.6} x2={12} y2={4} strokeLinecap="round" />
        </G>
      );
    // 📲 Téléphone
    case 'telephone':
      return (
        <G stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round">
          <Rect x={6.5} y={2.8} width={11} height={18.4} rx={2.6} fill="#F1ECFA" />
          <Line x1={10} y1={5.2} x2={14} y2={5.2} strokeWidth={1.3} strokeLinecap="round" />
          <Circle cx={12} cy={18.3} r={1} fill={VIOLET} stroke="none" />
        </G>
      );
    // 📵 Sans téléphone
    case 'sans-telephone':
      return (
        <G stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round">
          <Rect x={6.5} y={2.8} width={11} height={18.4} rx={2.6} fill="#F1ECFA" />
          <Line x1={5} y1={4} x2={19} y2={20} stroke="#C0455A" strokeWidth={1.9} strokeLinecap="round" />
        </G>
      );
    // 📍 Localisation
    case 'pin':
      return (
        <G stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round">
          <Path d="M12 21 C12 21 5.5 14 5.5 9.2 A6.5 6.5 0 0 1 18.5 9.2 C18.5 14 12 21 12 21 Z" fill="#F1ECFA" />
          <Circle cx={12} cy={9.2} r={2.4} fill={VIOLET} stroke="none" />
        </G>
      );
    // 🔒 Cadenas (sobre, violet)
    case 'cadenas':
      return (
        <G stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round">
          <Path d="M8 10 V8 A4 4 0 0 1 16 8 V10" fill="none" strokeLinecap="round" />
          <Rect x={5.6} y={10} width={12.8} height={9.4} rx={2} fill="#F1ECFA" />
          <Circle cx={12} cy={14} r={1.4} fill={VIOLET} stroke="none" />
          <Line x1={12} y1={14.6} x2={12} y2={17} strokeLinecap="round" />
        </G>
      );
    // 🛠️ Outils (clé + tournevis croisés)
    case 'outils':
      return (
        <G stroke={VIOLET} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <Path d="M14.5 4.5 A3.4 3.4 0 0 0 19.2 9.2 L10 18.4 L6.6 15 Z" fill="#F1ECFA" />
          <Path d="M5 5 L9.5 9.5 M5 5 L4.4 8 L7.4 7.4 L5 5 Z" />
          <Line x1={9.5} y1={9.5} x2={13} y2={13} />
        </G>
      );
    // 📋 Liste / presse-papiers
    case 'liste':
      return (
        <G stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round">
          <Rect x={5} y={4.5} width={14} height={16} rx={2.2} fill="#F1ECFA" />
          <Rect x={9} y={3} width={6} height={3.2} rx={1.2} fill="#fff" />
          <Line x1={8} y1={10} x2={16} y2={10} strokeWidth={1.4} strokeLinecap="round" />
          <Line x1={8} y1={13.4} x2={16} y2={13.4} strokeWidth={1.4} strokeLinecap="round" />
          <Line x1={8} y1={16.8} x2={13} y2={16.8} strokeWidth={1.4} strokeLinecap="round" />
        </G>
      );
    // 💶 Euro / caisse
    case 'euro':
      return (
        <G stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round">
          <Circle cx={12} cy={12} r={8.4} fill="#EEF4D8" />
          <Path d="M15 8.4 A4.4 4.4 0 1 0 15 15.6" fill="none" strokeLinecap="round" />
          <Line x1={7} y1={11} x2={13} y2={11} strokeWidth={1.4} strokeLinecap="round" />
          <Line x1={7} y1={13.2} x2={12.4} y2={13.2} strokeWidth={1.4} strokeLinecap="round" />
        </G>
      );
    // 📣 Mégaphone / push
    case 'megaphone':
      return (
        <G stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round">
          <Path d="M4 10 L13 6 V18 L4 14 Z" fill="#F1ECFA" />
          <Path d="M5.5 14 V17.5 A1.4 1.4 0 0 0 8.3 17.5 V15.2" fill="none" />
          <Path d="M16 9 Q18.4 12 16 15" fill="none" strokeLinecap="round" />
        </G>
      );
    // 🗑️ Corbeille
    case 'corbeille':
      return (
        <G stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round" fill="none">
          <Line x1={5} y1={6.5} x2={19} y2={6.5} strokeLinecap="round" />
          <Path d="M9 6.5 V5 A1.4 1.4 0 0 1 10.4 3.6 H13.6 A1.4 1.4 0 0 1 15 5 V6.5" />
          <Path d="M6.5 6.5 L7.4 19 A1.6 1.6 0 0 0 9 20.4 H15 A1.6 1.6 0 0 0 16.6 19 L17.5 6.5 Z" fill="#F1ECFA" />
          <Line x1={10} y1={10} x2={10.4} y2={16.8} strokeWidth={1.3} strokeLinecap="round" />
          <Line x1={14} y1={10} x2={13.6} y2={16.8} strokeWidth={1.3} strokeLinecap="round" />
        </G>
      );
    // ⏰ Horloge
    case 'horloge':
      return (
        <G stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round">
          <Circle cx={12} cy={13} r={8} fill="#F1ECFA" />
          <Path d="M6.5 5 L4 7.4 M17.5 5 L20 7.4" fill="none" strokeLinecap="round" />
          <Path d="M12 9 V13 L15 14.8" fill="none" strokeLinecap="round" />
        </G>
      );
    // 🎂 Gâteau d'anniversaire
    case 'gateau':
    case 'anniversaire':
      return (
        <G stroke={VIOLET} strokeWidth={1.6} strokeLinejoin="round">
          <Path d="M4.5 13 Q4.5 10.5 7 10.5 H17 Q19.5 10.5 19.5 13 V19 H4.5 Z" fill="#FBE4EE" />
          <Path d="M4.5 15 Q6.5 17 8.5 15 T12.5 15 T16.5 15 T20 15" fill="none" />
          <Line x1={12} y1={10.5} x2={12} y2={6.5} strokeLinecap="round" />
          <Circle cx={12} cy={5} r={1.5} fill={OR} stroke="none" />
        </G>
      );
    // ⚠️ Alerte
    case 'alerte':
      return (
        <G stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round">
          <Path d="M12 4 L21 19.5 H3 Z" fill="#FDF3C2" />
          <Line x1={12} y1={9.5} x2={12} y2={14} strokeLinecap="round" />
          <Circle cx={12} cy={16.6} r={1} fill={VIOLET} stroke="none" />
        </G>
      );
    // ✓ Coche validée
    case 'coche':
      return (
        <G>
          <Circle cx={12} cy={12} r={8.6} fill="#EEF4D8" stroke={VERT} strokeWidth={1.7} />
          <Path d="M8 12.2 L11 15.2 L16.2 8.8" fill="none" stroke={VERT} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
        </G>
      );
    // ℹ️ Info
    case 'info':
      return (
        <G>
          <Circle cx={12} cy={12} r={8.6} fill="#F1ECFA" stroke={VIOLET} strokeWidth={1.7} />
          <Circle cx={12} cy={8} r={1.1} fill={VIOLET} />
          <Line x1={12} y1={11} x2={12} y2={16.4} stroke={VIOLET} strokeWidth={1.9} strokeLinecap="round" />
        </G>
      );
    // 🏷️ Étiquette / offre
    case 'etiquette':
      return (
        <G stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round">
          <Path d="M4 11 L11 4 H19 V12 L12 19 Z" fill="#FDF3C2" />
          <Circle cx={15.4} cy={8.6} r={1.5} fill={VIOLET} stroke="none" />
        </G>
      );
    // ✎ Stylo / éditer
    case 'stylo':
      return (
        <G stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round" fill="none">
          <Path d="M14.5 5.5 L18.5 9.5 L9 19 L4.5 20 L5.5 15.5 Z" fill="#F1ECFA" />
          <Line x1={13} y1={7} x2={17} y2={11} />
        </G>
      );
    // 💜 Cœur
    case 'coeur':
      return (
        <Path d="M12 20 C4.5 14.5 4 9.5 7 7 C9.2 5.2 11 6.4 12 8 C13 6.4 14.8 5.2 17 7 C20 9.5 19.5 14.5 12 20 Z" fill="#EFE3F6" stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round" />
      );
    // Boîte vide (état vide générique)
    case 'boite-vide':
      return (
        <G stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round">
          <Path d="M4 8 L12 4 L20 8 L12 12 Z" fill="#F1ECFA" />
          <Path d="M4 8 V16 L12 20 V12 Z" fill="#EAE4F6" />
          <Path d="M20 8 V16 L12 20 V12 Z" fill="#F1ECFA" />
        </G>
      );
    // 🛒 Panier
    case 'panier':
      return (
        <G stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" fill="none">
          <Path d="M3 4.5 H5.5 L7.5 15 H17.5 L19.5 7 H6.2" fill="none" />
          <Path d="M6.2 7 L17.5 15 Z" fill="#F1ECFA" stroke="none" />
          <Path d="M3 4.5 H5.5 L7.5 15 H17.5 L19.5 7 H6.2" fill="none" />
          <Circle cx={9} cy={19} r={1.5} fill={VIOLET} stroke="none" />
          <Circle cx={16} cy={19} r={1.5} fill={VIOLET} stroke="none" />
        </G>
      );
    // 👤 Personne
    case 'personne':
      return (
        <G stroke={VIOLET} strokeWidth={1.7} strokeLinejoin="round">
          <Circle cx={12} cy={8.5} r={3.6} fill="#F1ECFA" />
          <Path d="M5 20 C5 15.5 8 13.4 12 13.4 C16 13.4 19 15.5 19 20 Z" fill="#F1ECFA" />
        </G>
      );
    default:
      return <Circle cx={12} cy={12} r={8} fill="#F1ECFA" stroke={VIOLET} strokeWidth={1.7} />;
  }
}

export function IconeApp({ nom, taille = 22 }: { nom: IconeAppNom; taille?: number }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24">
      <Glyphe nom={nom} />
    </Svg>
  );
}
