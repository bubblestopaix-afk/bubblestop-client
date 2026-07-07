// === Pictos d'OFFRES dessinés main (SVG) — 100 % charte Bubble Stop ===
// Remplacent les emojis des modèles d'offres (rendu identique partout, style kawaii
// de la marque : traits violets arrondis, aplats pastel, petites étincelles).
// Chaque picto vit sur une pastille pastel arrondie (couleur propre au modèle).
import type { ReactElement } from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Rect, Line, Text as SvgText } from 'react-native-svg';

const VIOLET = '#4c2d77';
const VERT = '#9BC31E';
const JAUNE = '#f2da33';
const ROSE = '#f3a0bd';

// Petite étincelle kawaii (croix arrondie)
function Etincelle({ x, y, t = 2.6, c = '#fff' }: { x: number; y: number; t?: number; c?: string }) {
  return (
    <>
      <Line x1={x - t} y1={y} x2={x + t} y2={y} stroke={c} strokeWidth={1.4} strokeLinecap="round" />
      <Line x1={x} y1={y - t} x2={x} y2={y + t} stroke={c} strokeWidth={1.4} strokeLinecap="round" />
    </>
  );
}

// Gobelet de bubble tea (base réutilisée : duo, click & collect…)
function Gobelet({ x = 6, fill = '#e9ddf6' }: { x?: number; fill?: string }) {
  return (
    <>
      <Path d={`M${x} 8 L${x + 12} 8 L${x + 10.4} 21 L${x + 1.6} 21 Z`} fill={fill} stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Line x1={x + 3.5} y1={7.5} x2={x + 9.5} y2={2.5} stroke={VIOLET} strokeWidth={1.6} strokeLinecap="round" />
      <Circle cx={x + 3.6} cy={18} r={1.15} fill={VIOLET} />
      <Circle cx={x + 6.1} cy={18.6} r={1.15} fill={VIOLET} />
      <Circle cx={x + 8.5} cy={18} r={1.15} fill={VIOLET} />
    </>
  );
}

const GLYPHES: Record<string, ReactElement> = {
  // ⚡ Happy hour — éclair
  'happy-hour': (
    <>
      <Path d="M13.5 2.5 L6.5 13.5 H11 L9.5 21.5 L18 10 H13 L15.5 2.5 Z" fill={JAUNE} stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Etincelle x={19.5} y={4.5} c={VIOLET} />
    </>
  ),
  // 📲 Bonus install — téléphone avec perle à l'écran
  'install-appli': (
    <>
      <Rect x={6.5} y={2.5} width={11} height={19} rx={3} fill="#fff" stroke={VIOLET} strokeWidth={1.5} />
      <Circle cx={12} cy={10} r={3.4} fill="#eef4d8" stroke={VIOLET} strokeWidth={1.3} />
      <Circle cx={11} cy={11} r={0.9} fill={VIOLET} />
      <Circle cx={13.2} cy={10.4} r={0.9} fill={VIOLET} />
      <Line x1={10.2} y1={17.5} x2={13.8} y2={17.5} stroke={VIOLET} strokeWidth={1.6} strokeLinecap="round" />
    </>
  ),
  // 🆕 Avant-première — étoile éclatante
  'avant-premiere': (
    <>
      <Path d="M12 3 L14.2 9 L20.5 9.4 L15.6 13.4 L17.2 19.6 L12 16.2 L6.8 19.6 L8.4 13.4 L3.5 9.4 L9.8 9 Z" fill={JAUNE} stroke={VIOLET} strokeWidth={1.4} strokeLinejoin="round" />
      <Etincelle x={20} y={4} c={VIOLET} t={2} />
      <Etincelle x={4} y={5} c={VIOLET} t={1.6} />
    </>
  ),
  // ✌️ Tampons ×2 — deux tampons cochés qui se chevauchent
  'tampon-double': (
    <>
      <Circle cx={9} cy={12} r={6.2} fill="#eef4d8" stroke={VERT} strokeWidth={1.6} />
      <Path d="M6.5 12 L8.3 13.8 L11.6 10.2" stroke={VERT} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={16.5} cy={12} r={6.2} fill="#e9ddf6" stroke={VIOLET} strokeWidth={1.6} />
      <Path d="M14 12 L15.8 13.8 L19.1 10.2" stroke={VIOLET} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  // ☀️ Canicule — soleil kawaii
  canicule: (
    <>
      <Circle cx={12} cy={12} r={5} fill={JAUNE} stroke={VIOLET} strokeWidth={1.5} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        return <Line key={a} x1={12 + Math.cos(r) * 7} y1={12 + Math.sin(r) * 7} x2={12 + Math.cos(r) * 9.5} y2={12 + Math.sin(r) * 9.5} stroke={VIOLET} strokeWidth={1.6} strokeLinecap="round" />;
      })}
      <Circle cx={10.4} cy={11.4} r={0.7} fill={VIOLET} />
      <Circle cx={13.6} cy={11.4} r={0.7} fill={VIOLET} />
      <Path d="M10.6 13.6 Q12 14.8 13.4 13.6" stroke={VIOLET} strokeWidth={1.1} strokeLinecap="round" fill="none" />
    </>
  ),
  // 🌧️ Jour de pluie — nuage + gouttes
  pluie: (
    <>
      <Path d="M6 13 a4 4 0 0 1 .6-7.95 A5 5 0 0 1 16.2 5.4 A3.6 3.6 0 0 1 17.5 13 Z" fill="#fff" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      {[[8, 16.5], [12, 18], [16, 16.5]].map(([x, y]) => (
        <Path key={x} d={`M${x} ${y} q1.4 2 0 3 q-1.4 -1 0 -3`} fill="#a9c8e8" stroke={VIOLET} strokeWidth={1} strokeLinejoin="round" />
      ))}
    </>
  ),
  // 👯 Offre duo — deux gobelets copains
  duo: (
    <>
      <Gobelet x={2.5} fill="#e9ddf6" />
      <Gobelet x={10.5} fill="#eef4d8" />
    </>
  ),
  // 📲 Click & collect — gobelet + chrono
  precommande: (
    <>
      <Gobelet x={4} fill="#e9ddf6" />
      <Circle cx={17.5} cy={7.5} r={4.2} fill="#fff" stroke={VIOLET} strokeWidth={1.4} />
      <Line x1={17.5} y1={7.5} x2={17.5} y2={5.4} stroke={VIOLET} strokeWidth={1.3} strokeLinecap="round" />
      <Line x1={17.5} y1={7.5} x2={19} y2={8.3} stroke={VIOLET} strokeWidth={1.3} strokeLinecap="round" />
    </>
  ),
  // 🎁 Boisson mystère — cadeau « ? »
  mystere: (
    <>
      <Rect x={4.5} y={9} width={15} height={11.5} rx={2} fill={ROSE} stroke={VIOLET} strokeWidth={1.5} />
      <Line x1={12} y1={9} x2={12} y2={20.5} stroke={VIOLET} strokeWidth={1.4} />
      <Path d="M12 8.5 C8 8.5 7.5 4 10.2 4 C12 4 12 6.5 12 8.5 C12 6.5 12 4 13.8 4 C16.5 4 16 8.5 12 8.5 Z" fill={ROSE} stroke={VIOLET} strokeWidth={1.3} strokeLinejoin="round" />
      <SvgText x={8} y={17.6} fontSize={7} fontWeight="bold" fill={VIOLET}>?</SvgText>
      <Etincelle x={20.5} y={5} c={VIOLET} t={1.8} />
    </>
  ),
  // 🤝 Parrainage — deux cœurs liés
  parrainage: (
    <>
      <Path d="M9 6.5 C5.5 6.5 4 9.5 6 12 L9.5 15.5 L13 12 C15 9.5 12.5 6.5 9 6.5 Z" fill="#e9ddf6" stroke={VIOLET} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M15.5 9.5 C12.5 9.5 11 12.3 13 14.6 L15.9 17.7 L19 14.6 C21 12.3 19 9.5 15.5 9.5 Z" fill="#eef4d8" stroke={VERT} strokeWidth={1.4} strokeLinejoin="round" />
      <Etincelle x={19.5} y={6} c={VIOLET} t={1.8} />
    </>
  ),
  // 📸 Story = topping — appareil photo au cœur
  story: (
    <>
      <Rect x={3.5} y={7} width={17} height={12.5} rx={2.6} fill="#fff" stroke={VIOLET} strokeWidth={1.5} />
      <Path d="M9 7 L10 4.8 H14 L15 7 Z" fill="#e9ddf6" stroke={VIOLET} strokeWidth={1.3} strokeLinejoin="round" />
      <Circle cx={12} cy={13} r={3.6} fill="#e9ddf6" stroke={VIOLET} strokeWidth={1.4} />
      <Path d="M12 14.8 L10.6 13.3 C10 12.5 10.8 11.4 11.6 12 L12 12.3 L12.4 12 C13.2 11.4 14 12.5 13.4 13.3 Z" fill={ROSE} />
    </>
  ),
  // 🌙 Dernière heure — lune + étoile
  'derniere-heure': (
    <>
      <Path d="M15 3.5 A9 9 0 1 0 20.5 15.5 A7.2 7.2 0 0 1 15 3.5 Z" fill={JAUNE} stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M17.5 5.5 L18.2 7.2 L20 7.9 L18.2 8.6 L17.5 10.3 L16.8 8.6 L15 7.9 L16.8 7.2 Z" fill="#fff" stroke={VIOLET} strokeWidth={1} strokeLinejoin="round" />
    </>
  ),
  // 🎓 Étudiants — toque de diplômé
  etudiants: (
    <>
      <Path d="M12 5 L21.5 9.5 L12 14 L2.5 9.5 Z" fill={VIOLET} stroke={VIOLET} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M7 12 v4.5 c0 1.6 10 1.6 10 0 V12" fill="#e9ddf6" stroke={VIOLET} strokeWidth={1.4} strokeLinejoin="round" />
      <Line x1={20} y1={10} x2={20} y2={15} stroke={VIOLET} strokeWidth={1.3} strokeLinecap="round" />
      <Circle cx={20} cy={16.2} r={1.2} fill={JAUNE} stroke={VIOLET} strokeWidth={1} />
    </>
  ),
  // ❄️ Boissons chaudes — flocon
  hiver: (
    <>
      {[0, 60, 120].map((a) => {
        const r = (a * Math.PI) / 180;
        const dx = Math.cos(r) * 8, dy = Math.sin(r) * 8;
        return <Line key={a} x1={12 - dx} y1={12 - dy} x2={12 + dx} y2={12 + dy} stroke="#7aa8d8" strokeWidth={1.8} strokeLinecap="round" />;
      })}
      {[30, 90, 150, 210, 270, 330].map((a) => {
        const r = (a * Math.PI) / 180;
        return <Circle key={a} cx={12 + Math.cos(r) * 8.5} cy={12 + Math.sin(r) * 8.5} r={1.1} fill="#7aa8d8" />;
      })}
      <Circle cx={12} cy={12} r={2} fill="#fff" stroke="#7aa8d8" strokeWidth={1.4} />
    </>
  ),
  // 💜 Merci — grand cœur étincelant
  merci: (
    <>
      <Path d="M12 7 C10.5 3.5 4.5 4 4.5 8.6 C4.5 12 8 14.8 12 18.5 C16 14.8 19.5 12 19.5 8.6 C19.5 4 13.5 3.5 12 7 Z" fill={VERT} stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Etincelle x={19.5} y={4.5} c={VIOLET} />
      <Etincelle x={5} y={17} c={VIOLET} t={1.8} />
    </>
  ),
  // 🫧 Nouveau topping — perles de tapioca
  'nouveau-topping': (
    <>
      <Circle cx={9.5} cy={13.5} r={5.5} fill={VIOLET} />
      <Circle cx={7.8} cy={11.6} r={1.5} fill="#fff" opacity={0.65} />
      <Circle cx={17} cy={9} r={3.6} fill="#8a68b8" />
      <Circle cx={16} cy={8} r={1} fill="#fff" opacity={0.65} />
      <Circle cx={16.8} cy={16.8} r={2.4} fill="#c9b4e4" />
      <Etincelle x={20.5} y={4.5} c={VIOLET} t={2} />
    </>
  ),
  // 🍪 Goûter — cookie aux pépites
  gouter: (
    <>
      <Circle cx={12} cy={12} r={8} fill="#ecd9b0" stroke={VIOLET} strokeWidth={1.5} />
      {[[9, 9.5], [14.5, 8.5], [15.5, 14], [9.5, 15.5], [12.5, 12]].map(([x, y]) => (
        <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.15} fill={VIOLET} />
      ))}
    </>
  ),
};

// Fond pastel de la pastille, propre à chaque modèle (harmonisé charte)
export const FOND_PICTO: Record<string, string> = {
  'happy-hour': '#fdf3c2',
  'install-appli': '#e4eef8',
  'avant-premiere': '#fdf3c2',
  'tampon-double': '#eef4d8',
  canicule: '#fdeecd',
  pluie: '#e4eef8',
  duo: '#f1ecfa',
  precommande: '#f1ecfa',
  mystere: '#fbe4ee',
  parrainage: '#eef4d8',
  story: '#fbe4ee',
  'derniere-heure': '#eae4f6',
  etudiants: '#f1ecfa',
  hiver: '#e4eef8',
  merci: '#eef4d8',
  'nouveau-topping': '#f1ecfa',
  gouter: '#faeeda',
};

// Pastille arrondie + glyphe SVG. `fond` = pastel propre au modèle d'offre.
export default function PictoOffre({ id, fond = '#f1ecfa', taille = 44 }: { id: string; fond?: string; taille?: number }) {
  return (
    <View style={{
      width: taille, height: taille, borderRadius: taille * 0.32,
      backgroundColor: fond, alignItems: 'center', justifyContent: 'center',
    }}>
      <Svg width={taille * 0.66} height={taille * 0.66} viewBox="0 0 24 24">
        {GLYPHES[id] || GLYPHES['avant-premiere']}
      </Svg>
    </View>
  );
}
