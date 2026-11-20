import Svg, { Path, Rect } from 'react-native-svg';

import { C } from '@/constants/charte';

/**
 * Picto de Boba Tower : trois gobelets empilés aux couleurs de la charte.
 * Remplace l'emoji 🗼 de la carte d'accueil (la DA exclut les emojis du contenu client).
 * Décoratif : la carte qui le porte a déjà son libellé d'accessibilité.
 */
export default function PictoBobaTower({ taille = 44 }: { taille?: number }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 40 40" aria-hidden>
      <Path d="M11.5 28.5 L28.5 28.5 L27.2 37 Q27 38 26 38 L14 38 Q13 38 12.8 37 Z" fill={C.vert} />
      <Rect x={9.5} y={25.5} width={21} height={3.2} rx={1.6} fill={C.violet} />
      <Path d="M14 17.5 L29 17.5 L27.8 25.5 L15.2 25.5 Z" fill={C.jaune} />
      <Rect x={12.2} y={14.5} width={18.6} height={3.2} rx={1.6} fill={C.violet} />
      <Path d="M12.5 7 L25.5 7 L24.5 14.5 L13.5 14.5 Z" fill={C.rose} />
      <Rect x={10.8} y={4} width={16.4} height={3.2} rx={1.6} fill={C.violet} />
      <Path d="M21 4 L23.5 0.8" stroke={C.violet} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
