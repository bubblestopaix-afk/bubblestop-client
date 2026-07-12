// === Boba Quest — icônes maison à la DA Bubble Stop (SVG dessinés main) ===
// Pictos riches et colorés, cohérents avec les collectibles : contours violets
// arrondis, aplats vifs, petits reflets, frimousses kawaii. Remplacent TOUS les
// emojis du jeu par une iconographie maison. Une seule <Icone nom=… /> ou, pour
// les listes pilotées par la data, <IconeEmoji emoji={def.emoji} />.
import Svg, { Path, Circle, Line, Rect, G, Polygon } from 'react-native-svg';

import type { SetId } from '@/components/jeu/economie';

const VIOLET = '#4c2d77';

// ---- primitives partagées ------------------------------------------------------
function Etincelle({ x, y, t = 2, c = '#FFD34D', w = 1.5 }: { x: number; y: number; t?: number; c?: string; w?: number }) {
  return (
    <G>
      <Line x1={x - t} y1={y} x2={x + t} y2={y} stroke={c} strokeWidth={w} strokeLinecap="round" />
      <Line x1={x} y1={y - t} x2={x} y2={y + t} stroke={c} strokeWidth={w} strokeLinecap="round" />
    </G>
  );
}
// reflet blanc translucide (donne du volume)
function Gloss({ x, y, r }: { x: number; y: number; r: number }) {
  return <Circle cx={x} cy={y} r={r} fill="rgba(255,255,255,0.7)" />;
}
// petit visage kawaii : deux yeux + sourire
function Visage({ cx, cy, e = 1.8 }: { cx: number; cy: number; e?: number }) {
  return (
    <G>
      <Circle cx={cx - e} cy={cy} r={0.85} fill={VIOLET} />
      <Circle cx={cx + e} cy={cy} r={0.85} fill={VIOLET} />
      <Path d={`M${cx - 1.2} ${cy + 1.7} Q${cx} ${cy + 2.8} ${cx + 1.2} ${cy + 1.7}`} stroke={VIOLET} strokeWidth={1.15} strokeLinecap="round" fill="none" />
    </G>
  );
}

// ============================================================================
//  TYPES DE COMBAT (les 4 motifs déjà validés, riches & colorés)
// ============================================================================

// 🧋 Milk Tea — gobelet violet, mousse crème, perles, paille turquoise, frimousse
function MotifMilk() {
  return (
    <G>
      <Line x1={13.4} y1={6} x2={16} y2={1.9} stroke="#2FB8C6" strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M6.4 6 Q12 3.3 17.6 6 L17.6 7.7 L6.4 7.7 Z" fill="#FFFFFF" stroke={VIOLET} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M7 7.7 L17 7.7 L15.7 20.4 L8.3 20.4 Z" fill="#9B6FD4" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M7.15 7.9 L16.85 7.9 L16.4 11.4 L7.6 11.4 Z" fill="#F5E7CE" />
      <Path d="M9 13 Q8.6 16 9.2 18.6" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={0.5} />
      <Circle cx={9.6} cy={18.2} r={1.05} fill="#3A2560" />
      <Circle cx={12} cy={18.7} r={1.05} fill="#3A2560" />
      <Circle cx={14.4} cy={18.2} r={1.05} fill="#3A2560" />
      <Visage cx={12} cy={14.2} e={2} />
    </G>
  );
}

// 🍓 Fruité — fraise rouge vif, feuilles vertes, pépins dorés, frimousse
function MotifFruit() {
  return (
    <G>
      <Line x1={12} y1={7} x2={12} y2={3.6} stroke="#6E8B34" strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M12 21.6 C6.6 19.4 5 13 7.8 9.4 C9.4 7.4 14.6 7.4 16.2 9.4 C19 13 17.4 19.4 12 21.6 Z" fill="#F24E7D" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M9.3 11 Q8.5 13.5 9.4 15.6" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" fill="none" opacity={0.55} />
      <G fill="#FFE082">
        <Circle cx={9.6} cy={13} r={0.7} /><Circle cx={14.4} cy={13} r={0.7} />
        <Circle cx={12} cy={16.4} r={0.7} /><Circle cx={10} cy={17.6} r={0.7} /><Circle cx={14} cy={17.6} r={0.7} />
      </G>
      <Visage cx={12} cy={12.4} e={2} />
      <Path d="M7.6 9.2 Q9 6.4 12 7.4 Q15 6.4 16.4 9.2 Q13.2 8.4 12 8.9 Q10.8 8.4 7.6 9.2 Z" fill="#57BE3C" stroke={VIOLET} strokeWidth={1.3} strokeLinejoin="round" />
      <Path d="M12 7.4 L10.4 5 Q12 5.2 12 7.4 Z" fill="#57BE3C" stroke={VIOLET} strokeWidth={1.1} strokeLinejoin="round" />
    </G>
  );
}

// ✨ Topping — grappe de perles MULTICOLORES + étincelles
function MotifTopping() {
  const perle = (cx: number, cy: number, r: number, c: string) => (
    <G>
      <Circle cx={cx} cy={cy} r={r} fill={c} stroke={VIOLET} strokeWidth={1.35} />
      <Circle cx={cx - r * 0.35} cy={cy - r * 0.35} r={r * 0.28} fill="rgba(255,255,255,0.75)" />
    </G>
  );
  return (
    <G>
      {perle(8, 12, 2.6, '#6FBF3A')}
      {perle(16, 12, 2.6, '#35BEC9')}
      {perle(7.2, 17, 2.6, '#F368A0')}
      {perle(16.8, 17, 2.6, '#F5B301')}
      {perle(12, 15.4, 3, '#9B6FD4')}
      <Etincelle x={12} y={5.6} t={2.4} />
      <Etincelle x={4.8} y={9} t={1.5} />
      <Etincelle x={19.2} y={9} t={1.5} />
    </G>
  );
}

// 👑 Signature / Couronne — couronne dorée + gemmes + éclat
function MotifCouronne() {
  return (
    <G>
      <Path d="M5.4 16.4 L5.9 8.2 L9.5 11.8 L12 6.4 L14.5 11.8 L18.1 8.2 L18.6 16.4 Z" fill="#F7B733" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Rect x={5.6} y={16} width={12.8} height={3.4} rx={1.3} fill="#F7B733" stroke={VIOLET} strokeWidth={1.5} />
      <Circle cx={5.9} cy={8} r={1.2} fill="#4E86E0" stroke={VIOLET} strokeWidth={1} />
      <Circle cx={12} cy={6.2} r={1.4} fill="#E0426B" stroke={VIOLET} strokeWidth={1} />
      <Circle cx={18.1} cy={8} r={1.2} fill="#43B86A" stroke={VIOLET} strokeWidth={1} />
      <Circle cx={9} cy={17.7} r={0.9} fill="#E0426B" />
      <Circle cx={12} cy={17.7} r={0.9} fill="#4E86E0" />
      <Circle cx={15} cy={17.7} r={0.9} fill="#43B86A" />
      <Etincelle x={12} y={13} t={1.6} c="#FFF3C4" />
    </G>
  );
}

// ============================================================================
//  ÉQUIPEMENT — pailles / couvercles / breloques
// ============================================================================

// 🛡️ Bouclier — écusson turquoise, liseré doré
function MotifBouclier() {
  return (
    <G>
      <Path d="M12 3.2 L19 6 V12 C19 16.6 15.8 19.6 12 21 C8.2 19.6 5 16.6 5 12 V6 Z" fill="#35BEC9" stroke={VIOLET} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M12 3.2 L19 6 V12 C19 16.6 15.8 19.6 12 21" fill="none" stroke="#FFFFFF" strokeWidth={1.1} opacity={0.4} strokeLinejoin="round" />
      <Path d="M9 11.4 L11.2 13.8 L15.4 8.8" fill="none" stroke="#FFFFFF" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
    </G>
  );
}

// 🍀 Trèfle porte-bonheur — 4 cœurs verts
function MotifTrefle() {
  const feuille = (rot: number) => (
    <Path d="M12 12 C12 9.6 9.4 8.6 8.4 10.4 C7.6 11.8 9.6 13.4 12 12 Z" fill="#57BE3C" stroke={VIOLET} strokeWidth={1.2} strokeLinejoin="round" transform={`rotate(${rot} 12 12)`} />
  );
  return (
    <G>
      {feuille(0)}{feuille(90)}{feuille(180)}{feuille(270)}
      <Line x1={12} y1={12} x2={15} y2={20} stroke="#6E8B34" strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={12} cy={12} r={1.2} fill="#FFE082" />
    </G>
  );
}

// 📍 Paille aiguisée — épingle rouge pointue
function MotifEpingle() {
  return (
    <G>
      <Path d="M12 21 C12 21 6.5 13.6 6.5 9.5 A5.5 5.5 0 0 1 17.5 9.5 C17.5 13.6 12 21 12 21 Z" fill="#F24E7D" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Circle cx={12} cy={9.3} r={2.4} fill="#FFFFFF" stroke={VIOLET} strokeWidth={1.2} />
      <Gloss x={9.7} y={7.4} r={1} />
    </G>
  );
}

// ❄️ Flocon givré — 6 branches bleu glace
function MotifFlocon() {
  return (
    <G stroke="#37B4E3" strokeWidth={1.7} strokeLinecap="round">
      {[0, 60, 120].map((a) => {
        const r = (a * Math.PI) / 180;
        const dx = Math.cos(r) * 8, dy = Math.sin(r) * 8;
        return <Line key={a} x1={12 - dx} y1={12 - dy} x2={12 + dx} y2={12 + dy} />;
      })}
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const r = (a * Math.PI) / 180;
        const bx = 12 + Math.cos(r) * 5.4, by = 12 + Math.sin(r) * 5.4;
        const r2 = ((a + 35) * Math.PI) / 180, r3 = ((a - 35) * Math.PI) / 180;
        return (
          <G key={`b${a}`}>
            <Line x1={bx} y1={by} x2={bx + Math.cos(r2) * 2.4} y2={by + Math.sin(r2) * 2.4} strokeWidth={1.4} />
            <Line x1={bx} y1={by} x2={bx + Math.cos(r3) * 2.4} y2={by + Math.sin(r3) * 2.4} strokeWidth={1.4} />
          </G>
        );
      })}
      <Circle cx={12} cy={12} r={1.5} fill="#CDEEFB" stroke="none" />
    </G>
  );
}

// 🍯 Miel / Caramel — pot d'ambre + goutte
function MotifMiel() {
  return (
    <G>
      <Rect x={7} y={9} width={10} height={11} rx={2.4} fill="#F5A623" stroke={VIOLET} strokeWidth={1.5} />
      <Rect x={6.2} y={6.6} width={11.6} height={3} rx={1.2} fill="#F7C948" stroke={VIOLET} strokeWidth={1.4} />
      <Rect x={9.2} y={11.4} width={5.6} height={4.6} rx={1} fill="#FFF3D6" />
      <Path d="M12 15.8 q-1.4 2 0 3.4 q1.4-1.4 0-3.4 Z" fill="#B4720E" />
      <Gloss x={9} y={12} r={0.9} />
    </G>
  );
}

// ⚡ Éclair / Orage — foudre dorée
function MotifEclair() {
  return (
    <G>
      <Polygon points="13.5,2.5 6,13 11,13 9.5,21.5 18,10 12.5,10" fill="#FFC93C" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Polygon points="12.8,5 9,12 12,12" fill="#FFE9A6" />
    </G>
  );
}

// 🧱 Couvercle blindé — mur de briques
function MotifBrique() {
  return (
    <G stroke={VIOLET} strokeWidth={1.2}>
      <Rect x={4.5} y={6} width={15} height={12} rx={1.6} fill="#D9683F" />
      <Line x1={4.5} y1={10} x2={19.5} y2={10} />
      <Line x1={4.5} y1={14} x2={19.5} y2={14} />
      <Line x1={12} y1={6} x2={12} y2={10} />
      <Line x1={8} y1={10} x2={8} y2={14} />
      <Line x1={16} y1={10} x2={16} y2={14} />
      <Line x1={12} y1={14} x2={12} y2={18} />
    </G>
  );
}

// 🍮 Couvercle nappé — flan caramel
function MotifFlan() {
  return (
    <G>
      <Path d="M6 12 Q6 8 12 8 Q18 8 18 12 L18 15 Q18 17.5 12 17.5 Q6 17.5 6 15 Z" fill="#F6D488" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M8.5 8.6 Q12 6 15.5 8.6 Q12 10 8.5 8.6 Z" fill="#B4720E" />
      <Path d="M5 17 Q12 20 19 17 L19 18.2 Q12 20.6 5 18.2 Z" fill="#EFE3CC" stroke={VIOLET} strokeWidth={1.3} strokeLinejoin="round" />
      <Path d="M15 8.4 q1.6 1.2 1 3" fill="none" stroke="#8A5209" strokeWidth={1.1} strokeLinecap="round" />
    </G>
  );
}

// 🧊 Glaçon — cube de glace
function MotifGlacon() {
  return (
    <G>
      <Rect x={5.5} y={5.5} width={13} height={13} rx={3} fill="#B7E7F5" stroke={VIOLET} strokeWidth={1.6} />
      <Path d="M8 8 L11 11 M14 9 L16 11 M9 15 L12 13" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" />
      <Gloss x={8.4} y={8.6} r={1.3} />
    </G>
  );
}

// 🌵 Couvercle à épines — cactus
function MotifCactus() {
  return (
    <G>
      <Rect x={9} y={16} width={6} height={4.5} rx={1} fill="#D98A46" stroke={VIOLET} strokeWidth={1.3} />
      <Path d="M10.4 16 V10 Q10.4 8.2 12 8.2 Q13.6 8.2 13.6 10 V16 Z" fill="#3FA24A" stroke={VIOLET} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M10.4 12.5 H7.8 Q6.6 12.5 6.6 11 V9.4" fill="none" stroke="#3FA24A" strokeWidth={2.4} strokeLinecap="round" />
      <Path d="M13.6 11.6 H16.2 Q17.4 11.6 17.4 10.1 V8.8" fill="none" stroke="#3FA24A" strokeWidth={2.4} strokeLinecap="round" />
      <G stroke="#DDF3C4" strokeWidth={0.9} strokeLinecap="round">
        <Line x1={12} y1={9.4} x2={12} y2={10.4} /><Line x1={12} y1={11.6} x2={12} y2={12.6} /><Line x1={12} y1={13.8} x2={12} y2={14.8} />
      </G>
    </G>
  );
}

// 👟 Baskets kawaii
function MotifBasket() {
  return (
    <G>
      <Path d="M4 15 L4 11.5 Q7 11.5 9 9.5 L11.5 12 L20 14 Q20.6 17 18 17.4 L5.5 17.4 Q4 17.4 4 15.5 Z" fill="#F368A0" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M4 17.2 L20 17.2 L20 18.6 Q20 19 19.4 19 L4.6 19 Q4 19 4 18.6 Z" fill="#FFFFFF" stroke={VIOLET} strokeWidth={1.3} strokeLinejoin="round" />
      <Line x1={10.5} y1={11.4} x2={8.4} y2={13.4} stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={12.6} y1={12} x2={10.6} y2={14} stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" />
    </G>
  );
}

// 🎯 Cible / Lunettes de visée
function MotifCible() {
  return (
    <G>
      <Circle cx={12} cy={12} r={8.4} fill="#F24E7D" stroke={VIOLET} strokeWidth={1.5} />
      <Circle cx={12} cy={12} r={5.4} fill="#FFFFFF" stroke={VIOLET} strokeWidth={1.2} />
      <Circle cx={12} cy={12} r={2.7} fill="#F24E7D" stroke={VIOLET} strokeWidth={1.1} />
      <Circle cx={12} cy={12} r={0.9} fill="#FFFFFF" />
      <Etincelle x={18.5} y={5.5} t={1.8} c="#FFD34D" />
    </G>
  );
}

// 🔔 Cloche / Grelot
function MotifCloche() {
  return (
    <G>
      <Path d="M12 4.4 C15.6 4.4 16.4 8 16.6 11 C16.8 14 17.6 16 18.6 16.8 L5.4 16.8 C6.4 16 7.2 14 7.4 11 C7.6 8 8.4 4.4 12 4.4 Z" fill="#F7B733" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Circle cx={12} cy={3.6} r={1.3} fill="#F7C948" stroke={VIOLET} strokeWidth={1.2} />
      <Circle cx={12} cy={18.6} r={1.7} fill="#E0961E" stroke={VIOLET} strokeWidth={1.3} />
      <Path d="M10 9 Q10.4 6.4 12.6 6.2" fill="none" stroke="#FFF3D6" strokeWidth={1.2} strokeLinecap="round" />
    </G>
  );
}

// ⏳ Sablier
function MotifSablier() {
  return (
    <G>
      <Rect x={6} y={3.4} width={12} height={2} rx={1} fill="#C9922B" stroke={VIOLET} strokeWidth={1.2} />
      <Rect x={6} y={18.6} width={12} height={2} rx={1} fill="#C9922B" stroke={VIOLET} strokeWidth={1.2} />
      <Path d="M7.6 5.4 L16.4 5.4 L12.6 12 L16.4 18.6 L7.6 18.6 L11.4 12 Z" fill="#EAF2F7" stroke={VIOLET} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M9.4 6.8 L14.6 6.8 L12 10.8 Z" fill="#F5B301" />
      <Path d="M12 12.6 L15 17.4 L9 17.4 Z" fill="#F5B301" />
      <Line x1={12} y1={12} x2={12} y2={16.6} stroke="#F5B301" strokeWidth={1.1} />
    </G>
  );
}

// 🧿 Grigri / Œil protecteur (nazar)
function MotifOeil() {
  return (
    <G>
      <Circle cx={12} cy={12} r={8.4} fill="#1F6FC4" stroke={VIOLET} strokeWidth={1.5} />
      <Circle cx={12} cy={12} r={5.6} fill="#EAF4FF" />
      <Circle cx={12} cy={12} r={3.3} fill="#3C97E8" />
      <Circle cx={12} cy={12} r={1.5} fill="#14243E" />
      <Gloss x={10.4} y={10.4} r={0.9} />
    </G>
  );
}

// ============================================================================
//  CONSOMMABLES
// ============================================================================

// 🧪 Potion Boba
function MotifPotion() {
  return (
    <G>
      <Rect x={10.4} y={3.2} width={3.2} height={4} rx={0.8} fill="#C9922B" stroke={VIOLET} strokeWidth={1.2} />
      <Path d="M10.6 6.6 L13.4 6.6 L15.8 12 Q17.4 15.8 15 18.4 Q12 21.2 9 18.4 Q6.6 15.8 8.2 12 Z" fill="#F24E7D" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M9.1 12.2 Q12 11 15 12.2 Q16.4 15.4 14.4 17.6 Q12 19.8 9.6 17.6 Q7.6 15.4 9.1 12.2 Z" fill="#F58FB4" opacity={0.55} />
      <Circle cx={11} cy={15} r={1} fill="#FFFFFF" opacity={0.85} />
      <Circle cx={13.4} cy={16.6} r={0.7} fill="#FFFFFF" opacity={0.85} />
      <Etincelle x={17.2} y={6.6} t={1.6} c="#FFD34D" />
    </G>
  );
}

// 🌿 Réveil Menthe
function MotifMenthe() {
  return (
    <G>
      <Line x1={12} y1={21} x2={12} y2={9} stroke="#3E8E3E" strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M12 12 C8 12 6.4 9 7 6 C10 6.4 12.4 8 12 12 Z" fill="#57BE3C" stroke={VIOLET} strokeWidth={1.3} strokeLinejoin="round" />
      <Path d="M12 10 C16 10 17.6 7 17 4 C14 4.4 11.6 6 12 10 Z" fill="#6FCF4A" stroke={VIOLET} strokeWidth={1.3} strokeLinejoin="round" />
      <Path d="M8.6 8 Q10 9 11.4 10.4 M15.4 6 Q13.8 7.2 12.4 8.8" fill="none" stroke="#2F6E2F" strokeWidth={0.9} strokeLinecap="round" />
    </G>
  );
}

// 🌶️ Bonbon Piquant / Piment
function MotifPiment() {
  return (
    <G>
      <Path d="M8 8 Q10 6.6 12 8" fill="none" stroke="#3E8E3E" strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M11.4 8 C15 8.4 18 11 17.4 15 C17 18.4 14 20.6 11 19.4 C8.6 18.4 8.4 15.4 9.6 13 C10.6 11 11 9.6 11.4 8 Z" fill="#E23B2E" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M12.6 10.4 Q15 11.6 15.4 15" fill="none" stroke="#FF9A8A" strokeWidth={1.3} strokeLinecap="round" opacity={0.7} />
    </G>
  );
}

// ============================================================================
//  TIERS DE LIGUE
// ============================================================================
function Medaille({ c1, c2 }: { c1: string; c2: string }) {
  return (
    <G>
      <Path d="M9 4 L11.5 11 L8 12 Z" fill="#E0426B" stroke={VIOLET} strokeWidth={1} strokeLinejoin="round" />
      <Path d="M15 4 L16 12 L12.5 11 Z" fill="#4E86E0" stroke={VIOLET} strokeWidth={1} strokeLinejoin="round" />
      <Circle cx={12} cy={15} r={6.2} fill={c1} stroke={VIOLET} strokeWidth={1.5} />
      <Circle cx={12} cy={15} r={4} fill={c2} />
      <Path d="M12 12.2 L12.9 14 L14.8 14.2 L13.4 15.5 L13.8 17.4 L12 16.4 L10.2 17.4 L10.6 15.5 L9.2 14.2 L11.1 14 Z" fill="#FFFFFF" opacity={0.92} />
    </G>
  );
}

// 💠 Platine — losange facetté
function MotifLosange() {
  return (
    <G>
      <Polygon points="12,3.5 20.5,12 12,20.5 3.5,12" fill="#4FC4DB" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Polygon points="12,3.5 16,12 12,20.5 8,12" fill="#8FE0EE" />
      <Line x1={3.5} y1={12} x2={20.5} y2={12} stroke="#FFFFFF" strokeWidth={1} opacity={0.6} />
      <Gloss x={10} y={9} r={1.1} />
    </G>
  );
}

// 💎 Diamant — gemme bleue facettée
function MotifDiamant() {
  return (
    <G>
      <Path d="M7 4.5 L17 4.5 L21 9.5 L12 21 L3 9.5 Z" fill="#5C8DF2" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M7 4.5 L9.4 9.5 L3 9.5 Z" fill="#8FB2FA" />
      <Path d="M17 4.5 L14.6 9.5 L21 9.5 Z" fill="#8FB2FA" />
      <Path d="M9.4 9.5 L14.6 9.5 L12 21 Z" fill="#3D6FE0" />
      <Line x1={3} y1={9.5} x2={21} y2={9.5} stroke="#FFFFFF" strokeWidth={0.9} opacity={0.55} />
      <Etincelle x={12} y={7} t={1.3} c="#FFFFFF" />
    </G>
  );
}

// ============================================================================
//  MUTATEURS
// ============================================================================

// 💥 Coups du sort — éclat d'impact
function MotifImpact() {
  return (
    <G>
      <Polygon points="12,2.5 14,8.5 20,7 16,11.5 22,14 15.5,14.5 17,21 12,16.5 7,21 8.5,14.5 2,14 8,11.5 4,7 10,8.5" fill="#FF7A2F" stroke={VIOLET} strokeWidth={1.4} strokeLinejoin="round" />
      <Circle cx={12} cy={12.5} r={3.1} fill="#FFD34D" />
      <Circle cx={12} cy={12.5} r={1.3} fill="#FFFFFF" />
    </G>
  );
}

// 🌊 Tempête de perles — vague
function MotifVague() {
  return (
    <G>
      <Path d="M3 14 C6 10 8 18 11 14 C14 10 16 18 19 14 C20.4 12 21 11.5 21 11.5 C21 15 19.5 19 15 19 C10 19 9 15.5 5 16.5 C3.5 17 3 15 3 14 Z" fill="#37B4E3" stroke={VIOLET} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M15.5 8 Q19 8 19.5 11.5 Q17 10.4 15.5 12 Q14.6 9.4 15.5 8 Z" fill="#8FE0EE" stroke={VIOLET} strokeWidth={1.2} strokeLinejoin="round" />
      <Circle cx={8} cy={15} r={0.9} fill="#EAF6FB" />
      <Circle cx={13} cy={15.6} r={0.8} fill="#EAF6FB" />
    </G>
  );
}

// 🍬 Sucre amer — bonbon
function MotifBonbon() {
  return (
    <G>
      <Circle cx={12} cy={12} r={5} fill="#F368A0" stroke={VIOLET} strokeWidth={1.5} />
      <Path d="M6.6 9.4 L3 7.6 L4 12 L3 16.4 L6.6 14.6 Z" fill="#F5B301" stroke={VIOLET} strokeWidth={1.3} strokeLinejoin="round" />
      <Path d="M17.4 9.4 L21 7.6 L20 12 L21 16.4 L17.4 14.6 Z" fill="#F5B301" stroke={VIOLET} strokeWidth={1.3} strokeLinejoin="round" />
      <Path d="M10 10 Q12 11.6 11.4 14" fill="none" stroke="#FFFFFF" strokeWidth={1.3} strokeLinecap="round" opacity={0.8} />
    </G>
  );
}

// 💢 Verre fin — marque de colère / fêlure
function MotifColere() {
  return (
    <G stroke="#E23B2E" strokeWidth={2} strokeLinecap="round" fill="none">
      <Path d="M12 6 Q13.4 8.4 12 10.6 Q10.6 8.4 12 6 Z" fill="#E23B2E" stroke="none" />
      <Path d="M18 12 Q15.6 13.4 13.4 12 Q15.6 10.6 18 12 Z" fill="#E23B2E" stroke="none" />
      <Path d="M12 18 Q10.6 15.6 12 13.4 Q13.4 15.6 12 18 Z" fill="#E23B2E" stroke="none" />
      <Path d="M6 12 Q8.4 10.6 10.6 12 Q8.4 13.4 6 12 Z" fill="#E23B2E" stroke="none" />
      <Circle cx={12} cy={12} r={1.4} fill="#FF7A2F" stroke="none" />
    </G>
  );
}

// ============================================================================
//  BOSS
// ============================================================================

// 👹 Boss — masque d'ogre rouge, cornes, crocs
function MotifBoss() {
  return (
    <G>
      {/* cornes */}
      <Path d="M6.4 8 Q4 5 4.6 3 Q7.2 4.2 7.8 7.4 Z" fill="#E8D9C0" stroke={VIOLET} strokeWidth={1.3} strokeLinejoin="round" />
      <Path d="M17.6 8 Q20 5 19.4 3 Q16.8 4.2 16.2 7.4 Z" fill="#E8D9C0" stroke={VIOLET} strokeWidth={1.3} strokeLinejoin="round" />
      {/* tête */}
      <Path d="M12 6 C16.8 6 19 9.6 19 13 C19 17.4 15.8 20.4 12 20.4 C8.2 20.4 5 17.4 5 13 C5 9.6 7.2 6 12 6 Z" fill="#E24B3C" stroke={VIOLET} strokeWidth={1.6} strokeLinejoin="round" />
      {/* sourcils fâchés */}
      <Path d="M7.6 11 L11 12.4" stroke={VIOLET} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M16.4 11 L13 12.4" stroke={VIOLET} strokeWidth={1.8} strokeLinecap="round" />
      {/* yeux */}
      <Circle cx={9.4} cy={13.4} r={1.5} fill="#FFF3C4" />
      <Circle cx={14.6} cy={13.4} r={1.5} fill="#FFF3C4" />
      <Circle cx={9.6} cy={13.6} r={0.75} fill={VIOLET} />
      <Circle cx={14.4} cy={13.6} r={0.75} fill={VIOLET} />
      {/* bouche + crocs */}
      <Path d="M8.6 16.2 Q12 18.6 15.4 16.2 Z" fill="#7A1E17" stroke={VIOLET} strokeWidth={1.2} strokeLinejoin="round" />
      <Polygon points="9.6,16.4 10.6,18.4 11.4,16.4" fill="#FFFFFF" />
      <Polygon points="14.4,16.4 13.4,18.4 12.6,16.4" fill="#FFFFFF" />
    </G>
  );
}

// ============================================================================
//  ACCENTS D'INTERFACE
// ============================================================================

// 🏆 Trophée
function MotifTrophee() {
  return (
    <G>
      <Path d="M7 4.5 L17 4.5 L16.4 10 Q16 13.6 12 13.6 Q8 13.6 7.6 10 Z" fill="#F7B733" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M7 5.5 Q4 5.5 4 8 Q4 10.6 7.4 10.6" fill="none" stroke={VIOLET} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M17 5.5 Q20 5.5 20 8 Q20 10.6 16.6 10.6" fill="none" stroke={VIOLET} strokeWidth={1.5} strokeLinecap="round" />
      <Rect x={10.6} y={13} width={2.8} height={3.6} fill="#E0961E" />
      <Rect x={7.6} y={16.4} width={8.8} height={2.4} rx={1} fill="#F7B733" stroke={VIOLET} strokeWidth={1.4} />
      <Rect x={9} y={18.6} width={6} height={2} rx={1} fill="#E0961E" stroke={VIOLET} strokeWidth={1.3} />
      <Path d="M9.6 6.6 Q9.4 9.4 11 11" fill="none" stroke="#FFF3D6" strokeWidth={1.2} strokeLinecap="round" />
    </G>
  );
}

// ⭐ Étoile
function MotifEtoile() {
  return (
    <G>
      <Polygon points="12,2.6 14.8,9 21.6,9.6 16.4,14.2 18,21 12,17.4 6,21 7.6,14.2 2.4,9.6 9.2,9" fill="#FFC93C" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Polygon points="12,6 13.4,9.6 12,12.4 10.6,9.6" fill="#FFE9A6" />
    </G>
  );
}

// 🎁 Cadeau
function MotifCadeau() {
  return (
    <G>
      <Rect x={4.8} y={9.4} width={14.4} height={10.6} rx={2} fill="#F3A0BD" stroke={VIOLET} strokeWidth={1.5} />
      <Rect x={4} y={7} width={16} height={3.4} rx={1.2} fill="#F368A0" stroke={VIOLET} strokeWidth={1.5} />
      <Rect x={10.6} y={7} width={2.8} height={13} fill="#FFD166" stroke={VIOLET} strokeWidth={1.2} />
      <Path d="M12 7 C8 7 7.4 3 10 3 C12 3 12 5.4 12 7 C12 5.4 12 3 14 3 C16.6 3 16 7 12 7 Z" fill="#7EC96A" stroke={VIOLET} strokeWidth={1.3} strokeLinejoin="round" />
    </G>
  );
}

// 🎒 Sac / Sac de combat
function MotifSac() {
  return (
    <G>
      <Path d="M8 8 Q8 4.5 12 4.5 Q16 4.5 16 8" fill="none" stroke={VIOLET} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M6 10 Q6 7.4 8.4 7.4 L15.6 7.4 Q18 7.4 18 10 L18 18 Q18 20.4 15.6 20.4 L8.4 20.4 Q6 20.4 6 18 Z" fill="#2FB8C6" stroke={VIOLET} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M6.2 13.4 L17.8 13.4 L17.8 16 Q17.8 16.6 17 16.6 L7 16.6 Q6.2 16.6 6.2 16 Z" fill="#EAF6FB" stroke={VIOLET} strokeWidth={1.2} strokeLinejoin="round" />
      <Rect x={10.6} y={14.2} width={2.8} height={2.4} rx={0.6} fill="#F7B733" stroke={VIOLET} strokeWidth={1} />
    </G>
  );
}

// 🔒 Cadenas
function MotifCadenas() {
  return (
    <G>
      <Path d="M8 11 V8.5 Q8 5 12 5 Q16 5 16 8.5 V11" fill="none" stroke={VIOLET} strokeWidth={1.8} strokeLinecap="round" />
      <Rect x={5.5} y={11} width={13} height={9} rx={2.2} fill="#F7B733" stroke={VIOLET} strokeWidth={1.5} />
      <Circle cx={12} cy={14.6} r={1.7} fill={VIOLET} />
      <Rect x={11.2} y={15} width={1.6} height={3.4} rx={0.8} fill={VIOLET} />
    </G>
  );
}

// 🔥 Flamme (chaîne / combo)
function MotifFlamme() {
  return (
    <G>
      <Path d="M12 2.6 C13.5 6 17.5 7.5 17.5 13 C17.5 17.5 15 20.5 12 20.5 C9 20.5 6.5 17.5 6.5 13 C6.5 10 8 8.5 9 7 C9.5 9 10.5 9.5 11 8 C11.6 6.2 11.4 4.4 12 2.6 Z" fill="#FF7A2F" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M12 10 C13 12 14 13 14 15.4 C14 17.6 13 19 12 19 C11 19 10 17.6 10 15.4 C10 14 10.6 13.2 11.2 12.4 C11.6 13.4 12 13 12 12 Z" fill="#FFD34D" />
    </G>
  );
}

// 🔹 Éclat (monnaie de forge) — petit losange bleu
function MotifEclat() {
  return (
    <G>
      <Polygon points="12,3.5 19,12 12,20.5 5,12" fill="#3C97E8" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Polygon points="12,3.5 15,12 12,20.5 9,12" fill="#7FC0F5" />
      <Gloss x={10} y={9} r={1} />
    </G>
  );
}

// 💪 Boost — flèche d'élan
function MotifBoost() {
  return (
    <G>
      <Circle cx={12} cy={12} r={9} fill="#57BE3C" stroke={VIOLET} strokeWidth={1.5} />
      <Path d="M12 6.5 L16.5 12 L13.6 12 L13.6 17 L10.4 17 L10.4 12 L7.5 12 Z" fill="#FFFFFF" stroke={VIOLET} strokeWidth={1.2} strokeLinejoin="round" />
    </G>
  );
}

// 💫 Étourdi — étoiles tournoyantes
function MotifEtourdi() {
  const star = (cx: number, cy: number, s: number) => (
    <Polygon points={`${cx},${cy - s} ${cx + s * 0.3},${cy - s * 0.3} ${cx + s},${cy} ${cx + s * 0.3},${cy + s * 0.3} ${cx},${cy + s} ${cx - s * 0.3},${cy + s * 0.3} ${cx - s},${cy} ${cx - s * 0.3},${cy - s * 0.3}`} fill="#FFC93C" stroke={VIOLET} strokeWidth={0.9} strokeLinejoin="round" />
  );
  return (
    <G>
      <Path d="M4 15 Q9 10 12 13 Q15 16 20 11" fill="none" stroke="#C9AEE6" strokeWidth={1.5} strokeLinecap="round" />
      {star(6.5, 8, 3)}{star(17, 9, 2.4)}{star(12.5, 6, 2)}
    </G>
  );
}

// ⚔️ Épées croisées (arène / combat)
function MotifEpee() {
  return (
    <G>
      <Line x1={5.5} y1={18.5} x2={16.5} y2={5.5} stroke="#9AA7B0" strokeWidth={2.6} strokeLinecap="round" />
      <Line x1={5.5} y1={18.5} x2={16.5} y2={5.5} stroke="#EAF0F4" strokeWidth={1} strokeLinecap="round" />
      <Line x1={4.2} y1={15.2} x2={8.8} y2={19.8} stroke="#E0961E" strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={18.5} y1={18.5} x2={7.5} y2={5.5} stroke="#9AA7B0" strokeWidth={2.6} strokeLinecap="round" />
      <Line x1={18.5} y1={18.5} x2={7.5} y2={5.5} stroke="#EAF0F4" strokeWidth={1} strokeLinecap="round" />
      <Line x1={19.8} y1={15.2} x2={15.2} y2={19.8} stroke="#E0961E" strokeWidth={2.2} strokeLinecap="round" />
      <Circle cx={16.9} cy={4.9} r={1.8} fill="#F24E7D" stroke={VIOLET} strokeWidth={1} />
      <Circle cx={7.1} cy={4.9} r={1.8} fill="#4E86E0" stroke={VIOLET} strokeWidth={1} />
      <Etincelle x={12} y={2.8} t={1.7} c="#FFD34D" />
    </G>
  );
}

// 🔨 Marteau de forge
function MotifMarteau() {
  return (
    <G>
      <Line x1={13.5} y1={9.5} x2={6.5} y2={19.5} stroke="#B4720E" strokeWidth={2.6} strokeLinecap="round" />
      <Line x1={13.5} y1={9.5} x2={6.5} y2={19.5} stroke="#D89A3A" strokeWidth={1} strokeLinecap="round" />
      <Rect x={11} y={3.6} width={9.5} height={6} rx={1.6} fill="#7C8791" stroke={VIOLET} strokeWidth={1.5} transform="rotate(35 15.75 6.6)" />
      <Rect x={12} y={4.6} width={4} height={1.4} rx={0.7} fill="#C6D0D6" transform="rotate(35 15.75 6.6)" />
      <Etincelle x={5} y={9} t={1.6} c="#FFD34D" />
    </G>
  );
}

// 😵 K.O. / défaite — frimousse étourdie
function MotifTriste() {
  return (
    <G>
      <Circle cx={12} cy={12} r={9} fill="#C9B7E0" stroke={VIOLET} strokeWidth={1.6} />
      <Path d="M7 9.4 L10 11.4 M10 9.4 L7 11.4" stroke={VIOLET} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M14 9.4 L17 11.4 M17 9.4 L14 11.4" stroke={VIOLET} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M9 16.4 Q12 14 15 16.4" fill="none" stroke={VIOLET} strokeWidth={1.6} strokeLinecap="round" />
    </G>
  );
}

// ✓ Validé
function MotifCheck() {
  return (
    <G>
      <Circle cx={12} cy={12} r={9} fill="#57BE3C" stroke={VIOLET} strokeWidth={1.5} />
      <Path d="M7.5 12.4 L10.6 15.4 L16.5 8.6" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </G>
  );
}

// 🚫 Interdit
function MotifInterdit() {
  return (
    <G>
      <Circle cx={12} cy={12} r={8.6} fill="#F3D0D8" stroke="#D5455F" strokeWidth={2} />
      <Line x1={6.4} y1={6.4} x2={17.6} y2={17.6} stroke="#D5455F" strokeWidth={2.2} strokeLinecap="round" />
    </G>
  );
}

// ============================================================================
//  DISPATCH
// ============================================================================
export type IconeNom =
  | 'milk' | 'fruit' | 'topping' | 'signature'
  | 'boba' | 'couronne' | 'bouclier' | 'trefle' | 'epingle' | 'flocon' | 'miel'
  | 'eclair' | 'brique' | 'flan' | 'glacon' | 'cactus' | 'basket' | 'cible'
  | 'cloche' | 'sablier' | 'oeil' | 'potion' | 'menthe' | 'piment'
  | 'bronze' | 'argent' | 'or' | 'platine' | 'diamant'
  | 'impact' | 'vague' | 'bonbon' | 'colere' | 'boss'
  | 'trophee' | 'etoile' | 'cadeau' | 'sac' | 'cadenas' | 'flamme' | 'eclat'
  | 'boost' | 'etourdi' | 'check' | 'interdit' | 'perles-multi' | 'epee' | 'marteau' | 'triste';

function Dessin({ nom }: { nom: IconeNom }) {
  switch (nom) {
    case 'milk': return <MotifMilk />;
    case 'fruit': return <MotifFruit />;
    case 'topping': case 'perles-multi': return <MotifTopping />;
    case 'signature': case 'couronne': return <MotifCouronne />;
    case 'boba': return <MotifMilk />;
    case 'bouclier': return <MotifBouclier />;
    case 'trefle': return <MotifTrefle />;
    case 'epingle': return <MotifEpingle />;
    case 'flocon': return <MotifFlocon />;
    case 'miel': return <MotifMiel />;
    case 'eclair': return <MotifEclair />;
    case 'brique': return <MotifBrique />;
    case 'flan': return <MotifFlan />;
    case 'glacon': return <MotifGlacon />;
    case 'cactus': return <MotifCactus />;
    case 'basket': return <MotifBasket />;
    case 'cible': return <MotifCible />;
    case 'cloche': return <MotifCloche />;
    case 'sablier': return <MotifSablier />;
    case 'oeil': return <MotifOeil />;
    case 'potion': return <MotifPotion />;
    case 'menthe': return <MotifMenthe />;
    case 'piment': return <MotifPiment />;
    case 'bronze': return <Medaille c1="#C88A4A" c2="#E0A86A" />;
    case 'argent': return <Medaille c1="#9AA7B0" c2="#C6D0D6" />;
    case 'or': return <Medaille c1="#E0A81E" c2="#F7CE52" />;
    case 'platine': return <MotifLosange />;
    case 'diamant': return <MotifDiamant />;
    case 'impact': return <MotifImpact />;
    case 'vague': return <MotifVague />;
    case 'bonbon': return <MotifBonbon />;
    case 'colere': return <MotifColere />;
    case 'boss': return <MotifBoss />;
    case 'trophee': return <MotifTrophee />;
    case 'etoile': return <MotifEtoile />;
    case 'cadeau': return <MotifCadeau />;
    case 'sac': return <MotifSac />;
    case 'cadenas': return <MotifCadenas />;
    case 'flamme': return <MotifFlamme />;
    case 'eclat': return <MotifEclat />;
    case 'boost': return <MotifBoost />;
    case 'etourdi': return <MotifEtourdi />;
    case 'check': return <MotifCheck />;
    case 'interdit': return <MotifInterdit />;
    case 'epee': return <MotifEpee />;
    case 'marteau': return <MotifMarteau />;
    case 'triste': return <MotifTriste />;
    default: return <MotifTopping />;
  }
}

// Icône générique — <Icone nom="trophee" taille={20} />
export function Icone({ nom, taille = 22 }: { nom: IconeNom; taille?: number }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24">
      <Dessin nom={nom} />
    </Svg>
  );
}

// Correspondance emoji → icône, pour les listes pilotées par la data (economie.ts)
export const EMOJI_ICONE: Record<string, IconeNom> = {
  '🧋': 'boba', '🍓': 'fruit', '✨': 'perles-multi', '👑': 'couronne',
  '🛡️': 'bouclier', '🛡': 'bouclier', '🍀': 'trefle', '📍': 'epingle',
  '❄️': 'flocon', '❄': 'flocon', '🍯': 'miel', '⚡': 'eclair', '🧱': 'brique',
  '🍮': 'flan', '🧊': 'glacon', '🌵': 'cactus', '👟': 'basket', '🎯': 'cible',
  '🔔': 'cloche', '⏳': 'sablier', '🧿': 'oeil', '🧪': 'potion', '🌿': 'menthe',
  '🌶️': 'piment', '🌶': 'piment', '🥉': 'bronze', '🥈': 'argent', '🥇': 'or',
  '💠': 'platine', '💎': 'diamant', '💥': 'impact', '🌊': 'vague', '🍬': 'bonbon',
  '💢': 'colere', '👹': 'boss', '🏆': 'trophee', '⭐': 'etoile', '🎁': 'cadeau',
  '🎒': 'sac', '🔒': 'cadenas', '🔥': 'flamme', '🔹': 'eclat', '💪': 'boost',
  '💫': 'etourdi', '⚔️': 'epee', '⚔': 'epee', '🔨': 'marteau',
  '😵‍💫': 'triste', '😵': 'triste',
};

// Rend l'icône correspondant à un emoji de la data ; null si non mappé.
export function IconeEmoji({ emoji, taille = 22 }: { emoji: string; taille?: number }) {
  const nom = EMOJI_ICONE[emoji];
  if (!nom) return null;
  return <Icone nom={nom} taille={taille} />;
}

// Icône d'un TYPE (set) de combat — conservée pour la légende du triangle.
const SET_NOM: Record<string, IconeNom> = { milk: 'milk', fruit: 'fruit', topping: 'topping', signature: 'signature' };
export function IconeType({ set, taille = 22 }: { set: SetId; taille?: number }) {
  return <Icone nom={SET_NOM[set] ?? 'topping'} taille={taille} />;
}
