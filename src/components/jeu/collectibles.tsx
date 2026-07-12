// === Boba Quest — les 24 collectibles dessinés main (SVG) ===
// Même style que les pictos d'offres : traits violets arrondis, aplats pastel,
// étincelles kawaii, petits visages. Chaque personnage vit sur une pastille
// aux couleurs de son set, cerclée de la couleur de sa rareté.
import type { ReactElement } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, Line, Ellipse } from 'react-native-svg';

import { F } from '@/constants/charte';
import { RangMaitrise, RARETES, SETS, trouverCollectible } from '@/components/jeu/economie';

const VIOLET = '#4c2d77';

// Étincelle kawaii (croix arrondie)
function Etincelle({ x, y, t = 2.2, c = VIOLET }: { x: number; y: number; t?: number; c?: string }) {
  return (
    <>
      <Line x1={x - t} y1={y} x2={x + t} y2={y} stroke={c} strokeWidth={1.3} strokeLinecap="round" />
      <Line x1={x} y1={y - t} x2={x} y2={y + t} stroke={c} strokeWidth={1.3} strokeLinecap="round" />
    </>
  );
}

// Petit visage kawaii : deux yeux + sourire
function Visage({ cx, cy, e = 1.7, c = VIOLET }: { cx: number; cy: number; e?: number; c?: string }) {
  return (
    <>
      <Circle cx={cx - e} cy={cy} r={0.75} fill={c} />
      <Circle cx={cx + e} cy={cy} r={0.75} fill={c} />
      <Path d={`M${cx - 1.1} ${cy + 1.6} Q${cx} ${cy + 2.6} ${cx + 1.1} ${cy + 1.6}`} stroke={c} strokeWidth={1.1} strokeLinecap="round" fill="none" />
    </>
  );
}

// Gobelet de bubble tea avec couvercle bombé + paille (base des personnages boisson)
function GobeletPerso({ fill, paille = '#c9b4e4', visageY = 13.5 }: { fill: string; paille?: string; visageY?: number }) {
  return (
    <>
      <Line x1={12.6} y1={6.5} x2={15.2} y2={1.6} stroke={paille} strokeWidth={2.6} strokeLinecap="round" />
      <Path d="M6.2 6.5 Q12 3.6 17.8 6.5 L17.8 8 L6.2 8 Z" fill="#fff" stroke={VIOLET} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M6.5 8 L17.5 8 L16.2 21.5 L7.8 21.5 Z" fill={fill} stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Circle cx={9.4} cy={19} r={1.05} fill={VIOLET} />
      <Circle cx={12} cy={19.5} r={1.05} fill={VIOLET} />
      <Circle cx={14.6} cy={19} r={1.05} fill={VIOLET} />
      <Visage cx={12} cy={visageY} e={2.2} />
    </>
  );
}

// Couronne royale (Signatures)
function Couronne({ x = 12, y = 3.4, l = 7 }: { x?: number; y?: number; l?: number }) {
  const d = l / 2;
  return (
    <>
      <Path
        d={`M${x - d} ${y} L${x - d} ${y - 2.6} L${x - d / 2} ${y - 1.1} L${x} ${y - 3.2} L${x + d / 2} ${y - 1.1} L${x + d} ${y - 2.6} L${x + d} ${y} Z`}
        fill="#f2da33" stroke={VIOLET} strokeWidth={1.2} strokeLinejoin="round"
      />
      <Circle cx={x} cy={y - 4} r={0.8} fill="#f2da33" stroke={VIOLET} strokeWidth={0.9} />
    </>
  );
}

// Feuille verte (fruités)
function Feuille({ x, y, angle = -30 }: { x: number; y: number; angle?: number }) {
  return (
    <Path
      d="M0 0 Q3.4 -2.6 6 0 Q3.4 2.6 0 0 Z"
      fill="#B7D34D" stroke={VIOLET} strokeWidth={1.1} strokeLinejoin="round"
      transform={`translate(${x} ${y}) rotate(${angle})`}
    />
  );
}

const GLYPHES: Record<string, ReactElement> = {
  // ——— Set Milk Tea (commun) ———
  boba: (
    <>
      <Circle cx={12} cy={13} r={7.5} fill="#4c2d77" />
      <Circle cx={9.3} cy={10.2} r={2.1} fill="#fff" opacity={0.45} />
      <Visage cx={12} cy={13.5} e={2.3} c="#fff" />
      <Etincelle x={20.3} y={5} t={2.4} />
      <Etincelle x={4} y={19.5} t={1.7} />
    </>
  ),
  classico: <GobeletPerso fill="#e8d9c3" />,
  theo: (
    <>
      <Line x1={12} y1={2.2} x2={15.5} y2={6.5} stroke={VIOLET} strokeWidth={1.2} strokeLinecap="round" />
      <Rect x={13.7} y={1} width={3.6} height={2.6} rx={0.8} fill="#f3a0bd" stroke={VIOLET} strokeWidth={1} />
      <Path d="M7 8.5 Q12 6.5 17 8.5 L16.4 20 Q12 22 7.6 20 Z" fill="#e9ddf6" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M7.3 12.5 L16.7 12.5" stroke={VIOLET} strokeWidth={1} strokeDasharray="1.6 1.4" />
      <Visage cx={12} cy={16} e={2} />
    </>
  ),
  lacto: (
    <>
      <Path d="M7 8 L17 8 L17 20.4 Q17 21.4 16 21.4 L8 21.4 Q7 21.4 7 20.4 Z" fill="#fff" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M7 8 L9 3.6 L15 3.6 L17 8 Z" fill="#a9c8e8" stroke={VIOLET} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M7.2 11.5 L16.8 11.5" stroke="#a9c8e8" strokeWidth={1.6} />
      <Visage cx={12} cy={15.5} e={2} />
    </>
  ),
  paillette: (
    <>
      <Path d="M10 21.5 L10 9 Q10 5.5 13.5 4.5 L16.5 3.7" stroke="#8A68B8" strokeWidth={4} strokeLinecap="round" fill="none" />
      <Path d="M10 21.5 L10 9 Q10 5.5 13.5 4.5 L16.5 3.7" stroke={VIOLET} strokeWidth={1.2} strokeLinecap="round" fill="none" opacity={0.35} />
      <Line x1={8} y1={12} x2={12} y2={12} stroke="#fff" strokeWidth={1.2} opacity={0.7} />
      <Line x1={8} y1={15} x2={12} y2={15} stroke="#fff" strokeWidth={1.2} opacity={0.7} />
      <Visage cx={10} cy={18} e={1.6} c="#fff" />
      <Etincelle x={19.5} y={8} t={2} />
    </>
  ),
  sucrette: (
    <>
      <Rect x={5.5} y={7.5} width={13} height={11.5} rx={2.4} fill="#fff" stroke={VIOLET} strokeWidth={1.5} />
      <Rect x={7.3} y={9.3} width={4} height={2.2} rx={1.1} fill="#efe9f6" />
      <Rect x={13} y={15.5} width={3.4} height={2} rx={1} fill="#efe9f6" />
      <Visage cx={12} cy={13.5} e={2.2} />
      <Etincelle x={19.8} y={4.6} t={2.2} />
      <Etincelle x={4.2} y={4.6} t={1.6} />
    </>
  ),

  // ——— Set Fruités (rare) ———
  fraisy: (
    <>
      <Path d="M12 21 Q4.5 16 5.5 10 Q6.5 6.5 12 6.5 Q17.5 6.5 18.5 10 Q19.5 16 12 21 Z" fill="#f3a0bd" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Feuille x={9} y={5.2} angle={-38} />
      <Feuille x={15} y={5.2} angle={218} />
      {[[8.5, 11], [15.5, 11], [10, 15], [14, 15], [12, 18]].map(([x, y]) => (
        <Circle key={`${x}${y}`} cx={x} cy={y} r={0.55} fill={VIOLET} />
      ))}
      <Visage cx={12} cy={11.6} e={2} />
    </>
  ),
  mango: (
    <>
      <Ellipse cx={12} cy={13.5} rx={7.2} ry={6.4} fill="#f7c948" stroke={VIOLET} strokeWidth={1.5} transform="rotate(-14 12 13.5)" />
      <Path d="M9.5 7.5 Q7.5 5 9.8 3.4" stroke={VIOLET} strokeWidth={1.3} strokeLinecap="round" fill="none" />
      <Feuille x={10} y={4.4} angle={-16} />
      <Circle cx={8.6} cy={11} r={1.5} fill="#fff" opacity={0.4} />
      <Visage cx={12} cy={14} e={2.2} />
    </>
  ),
  litchee: (
    <>
      <Circle cx={12} cy={13.5} r={7} fill="#fbe4ee" stroke={VIOLET} strokeWidth={1.5} />
      {[[7.5, 10], [10, 8], [13.5, 7.6], [16.5, 9.6], [18, 13], [17 , 16.8], [7, 14], [8.3, 17.6]].map(([x, y]) => (
        <Circle key={`${x}${y}`} cx={x} cy={y} r={0.5} fill="#e58bb1" />
      ))}
      <Path d="M12 6.6 Q11.5 4.4 13 3" stroke={VIOLET} strokeWidth={1.2} strokeLinecap="round" fill="none" />
      <Feuille x={12.8} y={3.6} angle={12} />
      <Visage cx={12} cy={13.8} e={2.1} />
    </>
  ),
  passion: (
    <>
      <Circle cx={12} cy={13} r={7.2} fill="#a15fb4" stroke={VIOLET} strokeWidth={1.5} />
      <Circle cx={12} cy={13} r={4.6} fill="#f7c948" />
      {[[10.5, 11.5], [13.5, 11.7], [10.8, 14.6], [13.3, 14.4], [12, 13]].map(([x, y]) => (
        <Circle key={`${x}${y}`} cx={x} cy={y} r={0.65} fill={VIOLET} />
      ))}
      <Path d="M14.5 5.5 Q15.5 3.5 17.5 3.4" stroke={VIOLET} strokeWidth={1.2} strokeLinecap="round" fill="none" />
      <Etincelle x={4.6} y={5.4} t={1.8} />
    </>
  ),
  citro: (
    <>
      <Circle cx={12} cy={13} r={7.2} fill="#cbe26b" stroke={VIOLET} strokeWidth={1.5} />
      <Circle cx={12} cy={13} r={5.4} fill="#eef7c9" />
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const r = (a * Math.PI) / 180;
        return (
          <Path
            key={a}
            d={`M12 13 L${12 + Math.cos(r - 0.32) * 5} ${13 + Math.sin(r - 0.32) * 5} A5 5 0 0 1 ${12 + Math.cos(r + 0.32) * 5} ${13 + Math.sin(r + 0.32) * 5} Z`}
            fill="#cbe26b" opacity={0.8}
          />
        );
      })}
      <Circle cx={12} cy={13} r={1.2} fill="#eef7c9" />
      <Visage cx={12} cy={12.6} e={2.6} />
      <Etincelle x={19.6} y={4.6} t={2} />
    </>
  ),
  pasteka: (
    <>
      <Path d="M3.5 12 A8.5 8.5 0 0 0 20.5 12 Z" fill="#f38aa8" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M3.5 12 A8.5 8.5 0 0 0 20.5 12" stroke="#7E9B12" strokeWidth={2.6} fill="none" />
      <Path d="M3.5 12 L20.5 12" stroke={VIOLET} strokeWidth={1.4} strokeLinecap="round" />
      {[[9, 15], [15, 15], [12, 18]].map(([x, y]) => (
        <Path key={`${x}${y}`} d={`M${x} ${y - 0.8} Q${x + 0.7} ${y} ${x} ${y + 0.8} Q${x - 0.7} ${y} ${x} ${y - 0.8}`} fill={VIOLET} />
      ))}
      <Visage cx={12} cy={14.2} e={2} />
    </>
  ),

  // ——— Set Toppings (épique) ———
  popping: (
    <>
      <Circle cx={12} cy={13} r={6} fill="#f7a14b" stroke={VIOLET} strokeWidth={1.5} />
      <Circle cx={10} cy={11} r={1.6} fill="#fff" opacity={0.5} />
      {[30, 90, 150, 210, 270, 330].map((a) => {
        const r = (a * Math.PI) / 180;
        return <Line key={a} x1={12 + Math.cos(r) * 7.6} y1={13 + Math.sin(r) * 7.6} x2={12 + Math.cos(r) * 9.6} y2={13 + Math.sin(r) * 9.6} stroke="#f7a14b" strokeWidth={1.8} strokeLinecap="round" />;
      })}
      <Visage cx={12} cy={13.4} e={2} />
    </>
  ),
  jelly: (
    <>
      <Rect x={5.5} y={6.5} width={13} height={13} rx={3.4} fill="#8fd8c8" opacity={0.9} stroke={VIOLET} strokeWidth={1.5} />
      <Path d="M8 9.5 Q9.5 8 11.5 8.6" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.8} />
      <Visage cx={12} cy={13.5} e={2.3} />
      <Etincelle x={20.2} y={4.4} t={2} />
    </>
  ),
  mochito: (
    <>
      <Path d="M4.5 15 Q4.5 8 12 8 Q19.5 8 19.5 15 Q19.5 19 16.5 19 L7.5 19 Q4.5 19 4.5 15 Z" fill="#fbe4ee" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M9 8.6 Q12 10.8 15 8.6" stroke={VIOLET} strokeWidth={1} fill="none" opacity={0.4} />
      <Circle cx={7.8} cy={14.4} r={1.1} fill="#f3a0bd" opacity={0.7} />
      <Circle cx={16.2} cy={14.4} r={1.1} fill="#f3a0bd" opacity={0.7} />
      <Visage cx={12} cy={13.8} e={2.2} />
    </>
  ),
  coco: (
    <>
      <Circle cx={12} cy={13} r={6.8} fill="#fff" stroke={VIOLET} strokeWidth={1.5} />
      <Path d="M8 9.5 Q10 7.6 12.5 8.2" stroke="#efe9f6" strokeWidth={2} strokeLinecap="round" fill="none" />
      <Visage cx={12} cy={13.4} e={2.1} />
      <Path d="M17 4.5 Q19.5 3 21 4.8" stroke="#B7D34D" strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <Etincelle x={4.4} y={6} t={1.8} />
    </>
  ),
  pudding: (
    <>
      <Path d="M7.2 9 L16.8 9 L18.5 19 Q18.6 20 17.5 20 L6.5 20 Q5.4 20 5.5 19 Z" fill="#f7c948" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M7.2 9 Q7 6.4 9.5 6.6 Q10 5 12 5 Q14 5 14.5 6.6 Q17 6.4 16.8 9 Q14.5 10.4 12 10.2 Q9.5 10.4 7.2 9 Z" fill="#b0692e" stroke={VIOLET} strokeWidth={1.3} strokeLinejoin="round" />
      <Visage cx={12} cy={15} e={2.2} />
    </>
  ),
  nuage: (
    <>
      <Path d="M6 16 A3.4 3.4 0 0 1 6.6 9.4 A4.6 4.6 0 0 1 15.4 8 A3.8 3.8 0 0 1 18 15.2 Q17 16.6 15.5 16 L8 16 Z" fill="#fff" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M9 16 L8.4 19 M12 16 L12 19.6 M15 16 L15.6 19" stroke="#f3a0bd" strokeWidth={1.6} strokeLinecap="round" />
      <Visage cx={12} cy={12.2} e={2.2} />
      <Etincelle x={20.4} y={5} t={2} />
    </>
  ),

  // ——— Set Signatures (légendaire) ———
  'taro-queen': (
    <>
      <Couronne />
      <GobeletPerso fill="#c9a6e8" />
      <Etincelle x={20.6} y={9} t={1.8} />
    </>
  ),
  'matcha-sensei': (
    <>
      <GobeletPerso fill="#cbe26b" />
      <Path d="M6.6 10.4 L17.4 10.4" stroke={VIOLET} strokeWidth={1.6} strokeLinecap="round" />
      <Feuille x={17.6} y={4.6} angle={-24} />
      <Etincelle x={4.2} y={10} t={1.8} />
    </>
  ),
  'brown-sugar-king': (
    <>
      <Couronne />
      <GobeletPerso fill="#e8d9c3" />
      <Path d="M7.4 9 Q9 11.5 8.2 14.5 M11 8.6 Q12.6 11 12 14 M14.8 9 Q16.2 11.5 15.6 14.4" stroke="#b0692e" strokeWidth={1.7} strokeLinecap="round" fill="none" opacity={0.85} />
    </>
  ),
  'oreo-star': (
    <>
      <GobeletPerso fill="#efe9f6" />
      {[[8.3, 10.3], [15.7, 10.6], [10, 16.3], [14.3, 16.6]].map(([x, y]) => (
        <Circle key={`${x}${y}`} cx={x} cy={y} r={0.8} fill="#3b3147" />
      ))}
      <Path d="M18.6 3.2 L19.3 4.9 L21.1 5.6 L19.3 6.3 L18.6 8 L17.9 6.3 L16.1 5.6 L17.9 4.9 Z" fill="#f2da33" stroke={VIOLET} strokeWidth={0.9} strokeLinejoin="round" />
    </>
  ),
  'caramel-chef': (
    <>
      <Path d="M8.4 5.6 Q7 2.4 9.8 2.2 Q10.4 0.8 12 0.8 Q13.6 0.8 14.2 2.2 Q17 2.4 15.6 5.6 Z" fill="#fff" stroke={VIOLET} strokeWidth={1.2} strokeLinejoin="round" />
      <GobeletPerso fill="#f7c948" />
      <Path d="M7 8.4 Q9 10.6 8.6 12.6 M16.9 8.4 Q15.2 10.6 15.6 12.6" stroke="#b0692e" strokeWidth={1.7} strokeLinecap="round" fill="none" />
    </>
  ),
  'bubble-master': (
    <>
      <Couronne l={8.4} />
      <GobeletPerso fill="#f2da33" paille="#e0b642" />
      <Etincelle x={20.6} y={7.6} t={2.4} />
      <Etincelle x={3.4} y={7.6} t={2.4} />
      <Etincelle x={20.4} y={17} t={1.7} />
      <Etincelle x={3.6} y={17} t={1.7} />
    </>
  ),
};

// --- Pastille d'un collectible (album, capsules, fiches) -------------------------
// cache=true → vraie silhouette du personnage, estompée + « ? ». Le mystère
// reste intact tout en donnant à chaque case une forme reconnaissable.
export default function PastilleCollectible({
  id, taille = 64, cache = false, maitrise = 'bronze', prestige = false, vedette = false,
}: {
  id: string; taille?: number; cache?: boolean; maitrise?: RangMaitrise;
  prestige?: boolean; vedette?: boolean;
}) {
  const c = trouverCollectible(id);
  if (!c) return null;
  const set = SETS[c.set];
  const rarete = RARETES[c.rarete];
  return (
    <View
      style={[
        styles.pastille,
        {
          width: taille, height: taille, borderRadius: taille * 0.3,
          backgroundColor: cache ? '#ECE7F3' : set.fond,
          borderColor: cache ? '#DED5EC' : rarete.couleur,
        },
        !cache && c.rarete === 'legendaire' && styles.legendaire,
        !cache && maitrise === 'argent' && styles.argent,
        !cache && maitrise === 'or' && styles.or,
        !cache && maitrise === 'holo' && styles.holo,
        !cache && prestige && styles.prestige,
        !cache && vedette && styles.vedette,
      ]}
    >
      {cache ? (
        <>
          <Svg width={taille * 0.72} height={taille * 0.72} viewBox="0 0 24 24" opacity={0.18}>
            {GLYPHES[id] || GLYPHES['boba']}
          </Svg>
          <Text style={[styles.mystere, { fontSize: taille * 0.34 }]}>?</Text>
        </>
      ) : (
        <Svg width={taille * 0.72} height={taille * 0.72} viewBox="0 0 24 24">
          {GLYPHES[id] || GLYPHES['boba']}
        </Svg>
      )}
      {!cache && maitrise !== 'bronze' && (
        <View style={[styles.badgeMaitrise, prestige && styles.badgePrestige]}>
          <Text style={styles.badgeMaitriseTxt}>
            {prestige ? 'P' : maitrise === 'argent' ? 'II' : maitrise === 'or' ? 'III' : 'V'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pastille: {
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  legendaire: {
    shadowColor: '#D2588A', shadowOpacity: 0.55, shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 }, elevation: 4,
  },
  argent: { borderColor: '#AAB4BF', borderWidth: 3 },
  or: { borderColor: '#D6A617', borderWidth: 3 },
  holo: {
    borderColor: '#55C6C2', borderWidth: 3,
    shadowColor: '#D2588A', shadowOpacity: 0.65, shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 }, elevation: 5,
  },
  prestige: {
    borderColor: '#D2588A', borderWidth: 4, backgroundColor: '#FFF0F7',
    shadowColor: '#8A68B8', shadowOpacity: 0.75, shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  vedette: {
    shadowColor: '#A3C724', shadowOpacity: 0.9, shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  badgeMaitrise: {
    position: 'absolute', right: -5, bottom: -5, minWidth: 22, height: 22,
    paddingHorizontal: 4, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#4C2D77', borderWidth: 2, borderColor: '#fff',
  },
  badgePrestige: { backgroundColor: '#D2588A' },
  badgeMaitriseTxt: { fontFamily: F.t800, fontSize: 9, color: '#fff' },
  mystere: { position: 'absolute', fontFamily: F.t800, color: '#8F7BAC' },
});
