// === Boba Quest — rendu Skia du shooter (perles brillantes, GPU 60 fps) ===
// Remplace les cercles plats par des perles en dégradé radial « glossy » avec
// reflet, et les capsules en billes dorées. La logique reste dans moteur-shooter.
//
// 🧩 26/07/2026 — LOT D : le dessin d'une perle spéciale n'est plus une cascade de
// `if` mais UNE TABLE (`DESSINS`), indexée par `special`. Ajouter une perle = ajouter
// une entrée, exactement comme `EFFETS_PERLE` côté moteur. Deux règles en découlent :
//  • l'ordre d'empilement se lit dans le MOTEUR (`perleEnAvant`), plus dans une liste
//    en dur qui aurait divergé du registre dès la première perle ajoutée ;
//  • le PV DE DÉPART se lit dans le MOTEUR (`EFFETS_PERLE[id].pvDepart`). C'est capital :
//    `pv` sert désormais à TROIS perles qui n'ont ni le même maximum ni le même sens
//    (❄️ givre 2→1 = armure, 🪨 roche 3→1 = armure, 🧨 mèche 5→0 = compte à rebours).
//    On ne distingue donc JAMAIS deux perles par la valeur de `pv`, toujours par
//    `special` — et le ratio d'usure vient du registre, jamais d'un nombre écrit ici.
import type { ReactNode } from 'react';
import {
  Canvas, Circle, Group, Line, Path, RadialGradient, SweepGradient, vec,
} from '@shopify/react-native-skia';

import { EFFETS_PERLE, perleEnAvant, SpecialBulle } from '@/components/jeu/moteur-shooter';
import { C } from '@/constants/charte';

// Chemin SVG d'une étoile à 5 branches centrée (perle bonus)
function etoilePath(cx: number, cy: number, R: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? R : R * 0.45;
    pts.push(`${(cx + Math.cos(ang) * rr).toFixed(2)} ${(cy + Math.sin(ang) * rr).toFixed(2)}`);
  }
  return 'M' + pts.join(' L') + ' Z';
}

// Spirale d'Archimède en UN seul nœud (🌀 portail). 12 segments : au diamètre réel
// d'une perle (~26 px sur un téléphone) l'œil ne distingue rien de plus fin, et ce
// chemin est reconstruit à chaque frame de visée — même ordre de grandeur qu'`etoilePath`,
// déjà appelé deux fois par perle bonus depuis la version de production.
function spiralePath(cx: number, cy: number, R: number, phase: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const a = phase + t * Math.PI * 2.6;
    const rr = R * (0.12 + 0.8 * t);
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return 'M' + pts.join(' L');
}

// 🧨 Le compte à rebours de la mèche doit être LISIBLE : un joueur qui voit « 2 » ne
// joue pas comme s'il voit « 5 ». Skia ne dessine du texte qu'avec un `SkFont` chargé
// (hook + fichier de police) — impossible ici : `BulleSkia` est appelée ~56 fois par
// frame et ne peut porter aucun hook. On dessine donc le chiffre à sept segments, en
// UN nœud `Path` : le prix d'un trait, net à n'importe quelle taille.
const SEGMENTS_CHIFFRE: Record<number, string> = {
  0: 'ABCDEF', 1: 'BC', 2: 'ABGED', 3: 'ABGCD', 4: 'FGBC',
  5: 'AFGCD', 6: 'AFGECD', 7: 'ABC', 8: 'ABCDEFG', 9: 'ABFGCD',
};
function chiffrePath(cx: number, cy: number, w: number, h: number, n: number): string {
  const x0 = cx - w, x1 = cx + w, y0 = cy - h, ym = cy, y1 = cy + h;
  const traits: Record<string, string> = {
    A: `M${x0} ${y0}L${x1} ${y0}`, B: `M${x1} ${y0}L${x1} ${ym}`,
    C: `M${x1} ${ym}L${x1} ${y1}`, D: `M${x0} ${y1}L${x1} ${y1}`,
    E: `M${x0} ${ym}L${x0} ${y1}`, F: `M${x0} ${y0}L${x0} ${ym}`,
    G: `M${x0} ${ym}L${x1} ${ym}`,
  };
  // Un rebours n'affiche qu'un chiffre : au-delà de 9 on retombe sur 9 plutôt que de
  // ne rien dessiner (aucun dosage ne le prévoit, mais une perle muette serait pire).
  const cles = SEGMENTS_CHIFFRE[Math.max(0, Math.min(9, Math.round(n)))] ?? '';
  return [...cles].map((k) => traits[k]).join(' ');
}

// 🧲 Quatre chevrons qui CONVERGENT vers le centre, en UN seul nœud `Path` — même
// procédé que `chiffrePath` et `spiralePath` : le plateau se reconstruit à 60 Hz pendant
// la visée, on ne paie pas quatre nœuds pour quatre traits. Les bras sont posés sur les
// DIAGONALES : les axes horizontal et vertical sont déjà pris par la Paille 🥤 et la
// Cascade 💧, et une perle doit se distinguer de ses voisines au premier coup d'œil.
// `rPointe` = rayon de la pointe (côté centre), `l` = longueur du bras vers l'extérieur.
function chevronsVersCentre(cx: number, cy: number, rPointe: number, l: number): string {
  const bras: string[] = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const ux = Math.cos(a), uy = Math.sin(a);   // vers l'extérieur
    const nx = -uy, ny = ux;                    // perpendiculaire au bras
    const px = cx + ux * rPointe, py = cy + uy * rPointe;             // pointe
    const bx = cx + ux * (rPointe + l), by = cy + uy * (rPointe + l); // base
    const w = l * 0.6;
    bras.push(
      `M${(bx + nx * w).toFixed(2)} ${(by + ny * w).toFixed(2)}`
      + `L${px.toFixed(2)} ${py.toFixed(2)}`
      + `L${(bx - nx * w).toFixed(2)} ${(by - ny * w).toFixed(2)}`,
    );
  }
  return bras.join(' ');
}

// 💧 Goutte d'eau centrée sur la perle : pointe en HAUT, ventre rond en bas. Un seul
// `Path`, réutilisé en remplissage puis en liseré (deux nœuds, un seul calcul).
function gouttePath(cx: number, cy: number, R: number): string {
  return `M${cx.toFixed(2)} ${(cy - R * 0.72).toFixed(2)}`
    + `Q${(cx + R * 0.46).toFixed(2)} ${(cy + R * 0.06).toFixed(2)} ${(cx + R * 0.34).toFixed(2)} ${(cy + R * 0.34).toFixed(2)}`
    + `Q${(cx + R * 0.2).toFixed(2)} ${(cy + R * 0.66).toFixed(2)} ${cx.toFixed(2)} ${(cy + R * 0.66).toFixed(2)}`
    + `Q${(cx - R * 0.2).toFixed(2)} ${(cy + R * 0.66).toFixed(2)} ${(cx - R * 0.34).toFixed(2)} ${(cy + R * 0.34).toFixed(2)}`
    + `Q${(cx - R * 0.46).toFixed(2)} ${(cy + R * 0.06).toFixed(2)} ${cx.toFixed(2)} ${(cy - R * 0.72).toFixed(2)} Z`;
}

// 🎨 Palette CANDY officielle (DA kawaii — normalisation §2.1 de l'audit, 19/07/2026) :
// violet clair, vert candy, jaune, framboise, bleu ciel, orange abricot.
// ⚠️ garder EXACTEMENT le même ordre que COULEURS dans shooter.tsx.
const RAINBOW = ['#b98fe0', '#9fc038', '#f2da33', '#ec647b', '#89cfe3', '#f7a14b', '#b98fe0'];

// Les 6 familles de perles (même ordre que COULEURS du shooter)
const BASE = ['#b98fe0', '#9fc038', '#f2da33', '#ec647b', '#89cfe3', '#f7a14b'];

// mélange linéaire de deux couleurs hex (t = 0 → a, 1 → b)
function lerpHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const p = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return '#' + p.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// Triplets de dégradé (clair → base → sombre) précalculés par couleur
export const GRAD = BASE.map((c) => ({
  clair: lerpHex(c, '#ffffff', 0.5),
  base: c,
  sombre: lerpHex(c, '#1a1030', 0.24),
}));

// Dégradé glossy pour une couleur hex quelconque (projectile, lanceur)
function gradDe(hex: string) {
  return { clair: lerpHex(hex, '#ffffff', 0.5), base: hex, sombre: lerpHex(hex, '#1a1030', 0.24) };
}

// Ce que reçoit chaque dessin de perle. `pv` et `pvMax` sont RÉSOLUS en amont :
// `pvMax` vient de `EFFETS_PERLE[special].pvDepart`, donc aucun dessin n'écrit « 2 »
// pour le givre ni « 3 » pour la roche — c'est le moteur qui porte ces valeurs.
type ParamsPerle = {
  x: number; y: number; r: number;
  g: { clair: string; base: string; sombre: string }; // dégradé de SA couleur
  pv: number;      // PV / compte à rebours courant
  pvMax: number;   // PV de départ, lu dans le registre du moteur
  reflet: ReactNode;
};
type DessinPerle = (p: ParamsPerle) => ReactNode;

// === LA TABLE DES DESSINS — 1 entrée = 1 perle ==============================
// Budget : ≤ 12 nœuds Skia par perle (le coût d'`etoile`, la plus riche du jeu),
// `Group` et dégradés compris. Le plateau reconstruit tout son arbre à chaque frame
// de visée : une perle trop bavarde se paie sur les 55 autres.
//
// 🔒 Table indexée par `SpecialBulle`, donc EXHAUSTIVE — et non par `string`, comme
// l'écrivait le premier jet. La différence n'est pas cosmétique : avec `string`, une
// 14ᵉ perle ajoutée au registre du moteur retomberait EN SILENCE sur `dessinOrdinaire`
// (`DESSINS[special]` vaut `undefined`), et rien ne la distinguerait à l'écran d'une
// perle normale — ni erreur, ni test rouge, juste une mécanique invisible. Avec le
// `Record` exhaustif, TypeScript refuse de compiler tant que le dessin manque : c'est
// le pendant côté rendu de `EFFETS_PERLE: Record<SpecialBulle, InfoPerle>` côté moteur.
// La table reste exactement aussi extensible : ajouter une perle = ajouter une entrée.
const DESSINS: Record<SpecialBulle, DessinPerle> = {
  // 💥 BOMBE : sphère sombre + mèche + étincelle
  bombe: ({ x, y, r }) => (
    <Group>
      <Circle cx={x} cy={y} r={r * 1.14} color="#C75450" opacity={0.22} />
      <Circle cx={x} cy={y} r={r}>
        <RadialGradient c={vec(x - r * 0.3, y - r * 0.34)} r={r * 1.4} colors={['#5a4a78', '#2f2247', '#160f28']} />
      </Circle>
      <Circle cx={x - r * 0.28} cy={y - r * 0.3} r={r * 0.18} color="rgba(255,255,255,0.35)" />
      {/* mèche */}
      <Line p1={vec(x, y - r * 0.9)} p2={vec(x + r * 0.35, y - r * 1.35)} color="#8a6b3a" style="stroke" strokeWidth={r * 0.12} strokeCap="round" />
      {/* étincelle */}
      <Circle cx={x + r * 0.4} cy={y - r * 1.4} r={r * 0.2} color="#FFD166" />
      <Circle cx={x + r * 0.4} cy={y - r * 1.4} r={r * 0.1} color="#F7A14B" />
    </Group>
  ),

  // 🌈 ARC-EN-CIEL : tourbillon multicolore (joker)
  arc: ({ x, y, r, reflet }) => (
    <Group>
      <Circle cx={x} cy={y} r={r}>
        <SweepGradient c={vec(x, y)} colors={RAINBOW} />
      </Circle>
      <Circle cx={x} cy={y} r={r} style="stroke" strokeWidth={r * 0.1} color="rgba(255,255,255,0.6)" />
      {reflet}
    </Group>
  ),

  // 🌟 SUPERNOVA : perle de sa couleur, grosse étoile blanche rayonnante — éclatée,
  // elle emporte TOUTES les perles de sa couleur. La cible prioritaire du plateau.
  etoile: ({ x, y, r, g }) => (
    <Group>
      {/* halo rayonnant */}
      <Circle cx={x} cy={y} r={r * 1.28} color={g.clair} opacity={0.4} />
      <Circle cx={x} cy={y} r={r}>
        <RadialGradient c={vec(x - r * 0.3, y - r * 0.34)} r={r * 1.4} colors={[g.clair, g.base, g.sombre]} />
      </Circle>
      {/* rayons */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 4 + Math.PI / 8;
        return (
          <Line
            key={i}
            p1={vec(x - Math.cos(a) * r * 1.22, y - Math.sin(a) * r * 1.22)}
            p2={vec(x + Math.cos(a) * r * 1.22, y + Math.sin(a) * r * 1.22)}
            color="rgba(255,255,255,0.5)" style="stroke" strokeWidth={r * 0.09} strokeCap="round"
          />
        );
      })}
      <Path path={etoilePath(x, y, r * 0.72)} color="#ffffff" />
      <Path path={etoilePath(x, y, r * 0.72)} style="stroke" strokeWidth={r * 0.09} color={g.sombre} />
      <Circle cx={x - r * 0.15} cy={y - r * 0.22} r={r * 0.1} color="rgba(255,255,255,0.95)" />
    </Group>
  ),

  // 🎁 +1 TIR : perle colorée + badge blanc avec flèche vers le haut (cadeau de munition)
  tir: ({ x, y, r, g, reflet }) => (
    <Group>
      <Circle cx={x} cy={y} r={r}>
        <RadialGradient c={vec(x - r * 0.3, y - r * 0.34)} r={r * 1.4} colors={[g.clair, g.base, g.sombre]} />
      </Circle>
      <Circle cx={x} cy={y} r={r * 0.58} color="rgba(255,255,255,0.92)" />
      {/* flèche vers le haut */}
      <Line p1={vec(x, y + r * 0.3)} p2={vec(x, y - r * 0.28)} color="#623E91" style="stroke" strokeWidth={r * 0.14} strokeCap="round" />
      <Line p1={vec(x - r * 0.2, y - r * 0.05)} p2={vec(x, y - r * 0.3)} color="#623E91" style="stroke" strokeWidth={r * 0.14} strokeCap="round" />
      <Line p1={vec(x + r * 0.2, y - r * 0.05)} p2={vec(x, y - r * 0.3)} color="#623E91" style="stroke" strokeWidth={r * 0.14} strokeCap="round" />
      {reflet}
    </Group>
  ),

  // ⭐ BONUS : perle colorée + étoile dorée
  bonus: ({ x, y, r, g }) => (
    <Group>
      <Circle cx={x} cy={y} r={r}>
        <RadialGradient c={vec(x - r * 0.3, y - r * 0.34)} r={r * 1.4} colors={[g.clair, g.base, g.sombre]} />
      </Circle>
      <Path path={etoilePath(x, y, r * 0.62)} color="#f2da33" />
      <Path path={etoilePath(x, y, r * 0.62)} style="stroke" strokeWidth={r * 0.08} color="#C99012" />
      <Circle cx={x - r * 0.15} cy={y - r * 0.2} r={r * 0.1} color="rgba(255,255,255,0.85)" />
    </Group>
  ),

  // 🧊 GLAÇON : bloc de glace bleuté (ne se matche pas)
  glacon: ({ x, y, r }) => (
    <Group>
      <Circle cx={x} cy={y} r={r}>
        <RadialGradient c={vec(x - r * 0.3, y - r * 0.34)} r={r * 1.5} colors={['#ffffff', '#cfeaf5', '#8fb8cc']} />
      </Circle>
      {/* facettes de glace */}
      <Line p1={vec(x - r * 0.4, y - r * 0.1)} p2={vec(x + r * 0.1, y + r * 0.5)} color="rgba(255,255,255,0.85)" style="stroke" strokeWidth={r * 0.1} strokeCap="round" />
      <Line p1={vec(x + r * 0.35, y - r * 0.35)} p2={vec(x - r * 0.05, y + r * 0.15)} color="rgba(255,255,255,0.7)" style="stroke" strokeWidth={r * 0.08} strokeCap="round" />
      <Circle cx={x} cy={y} r={r} style="stroke" strokeWidth={r * 0.08} color="rgba(126,200,227,0.7)" />
      <Circle cx={x - r * 0.3} cy={y - r * 0.33} r={r * 0.16} color="rgba(255,255,255,0.9)" />
    </Group>
  ),

  // ❄️ GIVRE : perle colorée sous une pellicule de givre. Entamée (`pv < pvMax`), le
  // voile s'allège et une fêlure apparaît : le joueur voit qu'un seul coup suffit.
  givre: ({ x, y, r, g, pv, pvMax, reflet }) => {
    const fissure = pv < pvMax;
    return (
      <Group>
        <Circle cx={x} cy={y} r={r}>
          <RadialGradient c={vec(x - r * 0.3, y - r * 0.34)} r={r * 1.4} colors={[g.clair, g.base, g.sombre]} />
        </Circle>
        {/* voile de givre (plus léger quand fissuré) */}
        <Circle cx={x} cy={y} r={r} color={fissure ? 'rgba(255,255,255,0.28)' : 'rgba(230,245,252,0.55)'} />
        {/* cristaux */}
        <Line p1={vec(x - r * 0.5, y - r * 0.2)} p2={vec(x + r * 0.1, y + r * 0.5)} color="rgba(255,255,255,0.8)" style="stroke" strokeWidth={r * 0.08} strokeCap="round" />
        {!fissure && <Line p1={vec(x + r * 0.4, y - r * 0.4)} p2={vec(x, y + r * 0.1)} color="rgba(255,255,255,0.7)" style="stroke" strokeWidth={r * 0.07} strokeCap="round" />}
        {fissure && <Line p1={vec(x - r * 0.2, y - r * 0.5)} p2={vec(x + r * 0.2, y + r * 0.5)} color="rgba(120,160,190,0.8)" style="stroke" strokeWidth={r * 0.06} strokeCap="round" />}
        {reflet}
      </Group>
    );
  },

  // === 🆕 LOT D : les 6 perles ajoutées par le LOT C ==========================

  // 🥤 PERLE PAILLE (9 nœuds) : la perle garde SA couleur — elle se matche
  // normalement — mais un rayon horizontal la traverse de part en part et DÉBORDE sur
  // ses voisines de rangée. C'est la promesse dessinée : « en éclatant, j'aspire toute
  // cette ligne ». Le rayon est tracé SOUS le corps : il a l'air de passer derrière.
  laser: ({ x, y, r, g, reflet }) => (
    <Group>
      <Line p1={vec(x - r * 1.42, y)} p2={vec(x + r * 1.42, y)} color="rgba(255,255,255,0.26)" style="stroke" strokeWidth={r * 0.46} strokeCap="round" />
      <Line p1={vec(x - r * 1.42, y)} p2={vec(x + r * 1.42, y)} color="rgba(255,255,255,0.72)" style="stroke" strokeWidth={r * 0.13} strokeCap="round" />
      <Circle cx={x} cy={y} r={r}>
        <RadialGradient c={vec(x - r * 0.3, y - r * 0.34)} r={r * 1.4} colors={[g.clair, g.base, g.sombre]} />
      </Circle>
      {/* la paille elle-même, en diagonale comme dans un vrai gobelet */}
      <Line p1={vec(x - r * 0.34, y + r * 0.66)} p2={vec(x + r * 0.3, y - r * 0.7)} color={C.rose} style="stroke" strokeWidth={r * 0.32} strokeCap="round" />
      <Line p1={vec(x - r * 0.34, y + r * 0.66)} p2={vec(x + r * 0.3, y - r * 0.7)} color="rgba(255,255,255,0.75)" style="stroke" strokeWidth={r * 0.1} strokeCap="round" />
      <Circle cx={x + r * 0.3} cy={y - r * 0.7} r={r * 0.18} color={C.blanc} />
      {reflet}
    </Group>
  ),

  // 🍯 PERLE SIROP (9 nœuds) : une coulure épaisse dégouline sur la perle, et un halo
  // de SA couleur déborde autour d'elle. Le halo est le message utile : ce qui va se
  // répandre sur les 6 voisines, c'est CETTE couleur-là — le joueur prépare son combo
  // en la regardant. Le liseré jaune est la brillance du sirop, pas la couleur repeinte.
  contagion: ({ x, y, r, g, reflet }) => {
    const coulure = `M${(x - r * 0.46).toFixed(2)} ${(y - r * 0.54).toFixed(2)}`
      + `Q${(x - r * 0.66).toFixed(2)} ${(y + r * 0.14).toFixed(2)} ${(x - r * 0.28).toFixed(2)} ${(y + r * 0.32).toFixed(2)}`
      + `Q${(x - r * 0.04).toFixed(2)} ${(y + r * 0.46).toFixed(2)} ${x.toFixed(2)} ${(y + r * 0.78).toFixed(2)}`
      + `Q${(x + r * 0.2).toFixed(2)} ${(y + r * 0.4).toFixed(2)} ${(x + r * 0.26).toFixed(2)} ${(y + r * 0.02).toFixed(2)}`
      + `Q${(x + r * 0.34).toFixed(2)} ${(y - r * 0.4).toFixed(2)} ${(x - r * 0.46).toFixed(2)} ${(y - r * 0.54).toFixed(2)} Z`;
    return (
      <Group>
        <Circle cx={x} cy={y} r={r * 1.2} color={g.base} opacity={0.3} />
        <Circle cx={x} cy={y} r={r}>
          <RadialGradient c={vec(x - r * 0.3, y - r * 0.34)} r={r * 1.4} colors={[g.clair, g.base, g.sombre]} />
        </Circle>
        <Path path={coulure} color={g.clair} />
        <Path path={coulure} style="stroke" strokeWidth={r * 0.08} color={C.jaune} />
        {/* la goutte sur le point de tomber */}
        <Circle cx={x + r * 0.44} cy={y + r * 0.44} r={r * 0.16} color={g.clair} />
        <Circle cx={x + r * 0.4} cy={y + r * 0.4} r={r * 0.06} color={C.blanc} />
        {reflet}
      </Group>
    );
  },

  // 🔗 PERLES JUMELLES (8 nœuds) : deux maillons de chaîne entrelacés, cerclés de
  // sombre pour rester lisibles sur les six couleurs du plateau. Deux perles portant ce
  // motif partent ENSEMBLE : le joueur repère la paire d'un coup d'œil, où qu'elle soit.
  lien: ({ x, y, r, g, reflet }) => (
    <Group>
      <Circle cx={x} cy={y} r={r}>
        <RadialGradient c={vec(x - r * 0.3, y - r * 0.34)} r={r * 1.4} colors={[g.clair, g.base, g.sombre]} />
      </Circle>
      <Circle cx={x - r * 0.27} cy={y} r={r * 0.36} style="stroke" strokeWidth={r * 0.21} color={g.sombre} />
      <Circle cx={x + r * 0.27} cy={y} r={r * 0.36} style="stroke" strokeWidth={r * 0.21} color={g.sombre} />
      <Circle cx={x - r * 0.27} cy={y} r={r * 0.36} style="stroke" strokeWidth={r * 0.1} color="rgba(255,255,255,0.92)" />
      <Circle cx={x + r * 0.27} cy={y} r={r * 0.36} style="stroke" strokeWidth={r * 0.1} color="rgba(255,255,255,0.92)" />
      {reflet}
    </Group>
  ),

  // 🧨 PERLE À MÈCHE (9 nœuds) : le seul CHIFFRE du plateau. Ici `pv` est un compte à
  // rebours — il descend d'un à chaque tir, pas quand on la frappe. Sans nombre affiché
  // le joueur ne peut rien planifier et l'explosion en croix tombe comme une punition
  // arbitraire. La mèche raccourcit dans la même proportion, et le dernier tir avant la
  // détonation passe en rouge danger : c'est l'urgence que la perle est censée créer.
  meche: ({ x, y, r, g, pv, pvMax, reflet }) => {
    const reste = Math.max(0, pv);
    const urgent = reste <= 1;
    // longueur de mèche = fraction restante du rebours (jamais nulle : on doit voir la flamme)
    const l = r * (0.2 + 0.62 * (reste / Math.max(1, pvMax)));
    const tx = x + l * 0.42, ty = y - r * 0.86 - l;
    return (
      <Group>
        <Circle cx={x} cy={y} r={r}>
          <RadialGradient c={vec(x - r * 0.3, y - r * 0.34)} r={r * 1.4} colors={[g.clair, g.base, g.sombre]} />
        </Circle>
        {reflet}
        <Line p1={vec(x, y - r * 0.86)} p2={vec(tx, ty)} color={g.sombre} style="stroke" strokeWidth={r * 0.13} strokeCap="round" />
        <Circle cx={tx} cy={ty} r={r * (urgent ? 0.26 : 0.18)} color={urgent ? C.danger : C.jaune} />
        <Circle cx={tx} cy={ty} r={r * (urgent ? 0.13 : 0.08)} color={C.blanc} />
        {/* pastille du rebours : blanche au calme, rouge danger au dernier tir */}
        <Circle cx={x} cy={y} r={r * 0.46} color={urgent ? C.danger : 'rgba(255,255,255,0.94)'} />
        {/* Proportions d'un afficheur 7 segments : hauteur ≈ 1,6 × largeur, trait ≈
            hauteur/6. À la taille réelle d'une perle (r ≈ 20 px) le chiffre fait
            ~7 × 11 px dans une pastille de 18 px — lisible sans loupe, et il tient
            largement dans le disque (demi-diagonale 0,38 r contre un rayon de 0,46 r). */}
        <Path
          path={chiffrePath(x, y, r * 0.17, r * 0.28, reste)}
          style="stroke" strokeWidth={r * 0.095} strokeCap="round"
          color={urgent ? C.blanc : C.violetProfond}
        />
      </Group>
    );
  },

  // 🌀 PORTAIL (8 nœuds) : un tourbillon, et surtout PAS une perle de couleur — c'est
  // un bloc qui ne se matche jamais, et la seule perle du jeu qui touche la trajectoire.
  // Deux spirales en sens inverse tournent vers un cœur sombre : on lit « ça avale et ça
  // recrache ». La couleur de la perle en dessous est volontairement ignorée, sinon le
  // joueur croirait pouvoir la matcher.
  portail: ({ x, y, r }) => (
    <Group>
      <Circle cx={x} cy={y} r={r}>
        <SweepGradient c={vec(x, y)} colors={[C.violetProfond, C.violetClair, C.bleu, C.violetClair, C.violetProfond]} />
      </Circle>
      <Path path={spiralePath(x, y, r * 0.9, 0)} style="stroke" strokeWidth={r * 0.13} color="rgba(255,255,255,0.78)" />
      <Path path={spiralePath(x, y, r * 0.9, Math.PI)} style="stroke" strokeWidth={r * 0.09} color="rgba(255,255,255,0.34)" />
      <Circle cx={x} cy={y} r={r * 0.2} color={C.violetProfond} />
      <Circle cx={x} cy={y} r={r * 0.09} color={C.bleu} />
      <Circle cx={x} cy={y} r={r} style="stroke" strokeWidth={r * 0.09} color={C.violetClair} />
    </Group>
  ),

  // 🪨 PERLE DE ROCHE (≤ 9 nœuds) : pierre MATE, sans le reflet glossy des perles —
  // c'est ce qui la sépare du reste du plateau et annonce « je ne partirai pas toute
  // seule, la gravité ne me prend pas ». Elle se fissure à mesure qu'elle encaisse :
  // 3 PV intacte, 2 PV une fêlure, 1 PV un réseau de fêlures = « le prochain coup me casse ».
  roche: ({ x, y, r, pv, pvMax }) => {
    const usure = pvMax - Math.max(0, pv);  // 0 → intacte, 1 → fêlée, 2+ → prête à céder
    return (
      <Group>
        <Circle cx={x} cy={y} r={r}>
          <RadialGradient c={vec(x - r * 0.3, y - r * 0.34)} r={r * 1.5} colors={[C.lavande, C.texte3, C.texte]} />
        </Circle>
        <Circle cx={x} cy={y} r={r} style="stroke" strokeWidth={r * 0.09} color={C.texte} />
        {/* arête de la pierre, toujours présente */}
        <Line p1={vec(x - r * 0.52, y - r * 0.44)} p2={vec(x - r * 0.12, y + r * 0.06)} color={C.texte2} style="stroke" strokeWidth={r * 0.09} strokeCap="round" />
        {usure >= 1 && <Line p1={vec(x - r * 0.14, y - r * 0.62)} p2={vec(x + r * 0.16, y + r * 0.66)} color={C.violetProfond} style="stroke" strokeWidth={r * 0.11} strokeCap="round" />}
        {usure >= 2 && <Line p1={vec(x + r * 0.16, y + r * 0.06)} p2={vec(x + r * 0.72, y - r * 0.24)} color={C.violetProfond} style="stroke" strokeWidth={r * 0.11} strokeCap="round" />}
        {usure >= 2 && <Line p1={vec(x - r * 0.02, y - r * 0.2)} p2={vec(x - r * 0.62, y + r * 0.3)} color={C.violetProfond} style="stroke" strokeWidth={r * 0.09} strokeCap="round" />}
        {/* éclat MAT (pas le reflet glossy des perles) : la roche n'est pas comestible */}
        <Circle cx={x - r * 0.32} cy={y - r * 0.34} r={r * 0.17} color="rgba(255,255,255,0.3)" />
      </Group>
    );
  },

  // 💧 PERLE CASCADE (9 nœuds) : le MIROIR EXACT de la Paille 🥤, à la verticale. Même
  // faisceau à deux traits (large et translucide, fin et vif) qui DÉBORDE de la perle sur
  // ±1,42 r — c'est ce débordement, et lui seul, qui dit « ma colonne y passe » : le
  // joueur a déjà appris à lire le trait horizontal de la Paille, il lit celui-ci sans
  // qu'on lui explique. La goutte au centre nomme la perle ; le faisceau annonce l'effet.
  cascade: ({ x, y, r, g, reflet }) => {
    const goutte = gouttePath(x, y, r);
    return (
      <Group>
        <Line p1={vec(x, y - r * 1.42)} p2={vec(x, y + r * 1.42)} color="rgba(255,255,255,0.26)" style="stroke" strokeWidth={r * 0.46} strokeCap="round" />
        <Line p1={vec(x, y - r * 1.42)} p2={vec(x, y + r * 1.42)} color="rgba(255,255,255,0.72)" style="stroke" strokeWidth={r * 0.13} strokeCap="round" />
        <Circle cx={x} cy={y} r={r}>
          <RadialGradient c={vec(x - r * 0.3, y - r * 0.34)} r={r * 1.4} colors={[g.clair, g.base, g.sombre]} />
        </Circle>
        <Path path={goutte} color={g.clair} />
        <Path path={goutte} style="stroke" strokeWidth={r * 0.08} color={C.bleu} />
        {/* la petite brillance dans la goutte : c'est de l'eau, pas un caillou */}
        <Circle cx={x - r * 0.13} cy={y + r * 0.22} r={r * 0.12} color={C.blanc} />
        {reflet}
      </Group>
    );
  },

  // 🧲 PERLE AIMANT (9 nœuds) : un halo de SA COULEUR déborde de la perle, et quatre
  // chevrons pointent VERS le centre. Les deux informations dont le joueur a besoin sont
  // là, sans un mot : le halo dit QUELLE couleur part (même procédé que le Sirop 🍯, où
  // le halo annonce déjà la couleur repeinte), les chevrons disent que ça VIENT vers la
  // perle au lieu de s'en éloigner. Le cercle blanc du halo matérialise la PORTÉE — c'est
  // une supernova LOCALE, et il faut qu'on voie où elle s'arrête.
  aimant: ({ x, y, r, g, reflet }) => (
    <Group>
      <Circle cx={x} cy={y} r={r * 1.26} color={g.base} opacity={0.3} />
      <Circle cx={x} cy={y} r={r * 1.26} style="stroke" strokeWidth={r * 0.07} color="rgba(255,255,255,0.4)" />
      <Circle cx={x} cy={y} r={r}>
        <RadialGradient c={vec(x - r * 0.3, y - r * 0.34)} r={r * 1.4} colors={[g.clair, g.base, g.sombre]} />
      </Circle>
      <Path
        path={chevronsVersCentre(x, y, r * 0.36, r * 0.5)}
        style="stroke" strokeWidth={r * 0.13} strokeCap="round" color="rgba(255,255,255,0.85)"
      />
      {/* le point d'aspiration : tout converge ICI */}
      <Circle cx={x} cy={y} r={r * 0.24} color={g.sombre} />
      <Circle cx={x} cy={y} r={r * 0.1} color={C.blanc} />
      {reflet}
    </Group>
  ),
};

// 🎁 Capsule gachapon à libérer : dôme translucide (haut) + moitié dorée (bas)
// + jointure + anneau + halo — volontairement DIFFÉRENTE d'une perle. Hors table :
// une capsule n'est pas une `special`, c'est un drapeau à part sur la `Bulle`.
const dessinCapsule: DessinPerle = ({ x, y, r }) => {
  const domeHaut = `M ${x - r} ${y} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
  return (
    <Group>
      {/* halo doux pour attirer l'œil */}
      <Circle cx={x} cy={y} r={r * 1.16} color="#FFD166" opacity={0.3} />
      {/* corps doré (visible surtout en bas) */}
      <Circle cx={x} cy={y} r={r}>
        <RadialGradient c={vec(x - r * 0.25, y + r * 0.15)} r={r * 1.5} colors={['#ffe9a6', '#f2c022', '#a9740c']} />
      </Circle>
      {/* dôme clair translucide en haut (aspect « capsule ») */}
      <Path path={domeHaut} color="rgba(255,255,255,0.9)" />
      {/* jointure dorée au milieu */}
      <Line
        p1={vec(x - r * 0.82, y)} p2={vec(x + r * 0.82, y)}
        color="#C99012" style="stroke" strokeWidth={r * 0.2} strokeCap="round"
      />
      {/* anneau extérieur */}
      <Circle cx={x} cy={y} r={r - r * 0.05} style="stroke" strokeWidth={r * 0.12} color="#C99012" />
      {/* reflet sur le dôme */}
      <Circle cx={x - r * 0.32} cy={y - r * 0.42} r={r * 0.18} color="rgba(255,255,255,0.95)" />
    </Group>
  );
};

// Perle ordinaire : dégradé glossy + reflet, rien d'autre.
const dessinOrdinaire: DessinPerle = ({ x, y, r, g, reflet }) => (
  <Group>
    <Circle cx={x} cy={y} r={r}>
      <RadialGradient c={vec(x - r * 0.3, y - r * 0.34)} r={r * 1.4} colors={[g.clair, g.base, g.sombre]} />
    </Circle>
    {reflet}
  </Group>
);

// Une perle glossy (dans un Canvas parent). UN seul aiguillage : `special` → table,
// sinon capsule, sinon perle ordinaire. Priorité identique à celle d'avant la refonte
// (une spéciale l'emportait déjà sur la capsule ; par construction du générateur de
// niveaux, aucune perle n'est de toute façon jamais les deux à la fois).
function BulleSkia({ x, y, r, couleur, capsule, special, pv }: {
  x: number; y: number; r: number; couleur: number;
  capsule?: boolean; special?: SpecialBulle; pv?: number;
}) {
  const info = special ? EFFETS_PERLE[special] : undefined;
  // ⚠️ Le maximum vient du REGISTRE, jamais d'un littéral : givre 2, roche 3, mèche 5.
  const pvMax = info?.pvDepart ?? 1;
  const p: ParamsPerle = {
    x, y, r,
    g: GRAD[couleur] ?? GRAD[0],
    pv: pv ?? pvMax,
    pvMax,
    // reflet glossy commun (haut-gauche)
    reflet: <Circle cx={x - r * 0.3} cy={y - r * 0.33} r={r * 0.22} color="rgba(255,255,255,0.55)" />,
  };
  const dessin = (special && DESSINS[special]) || (capsule ? dessinCapsule : dessinOrdinaire);
  return <>{dessin(p)}</>;
}

export type BullePx = {
  x: number; y: number; couleur: number;
  capsule?: boolean; special?: SpecialBulle; pv?: number;
};

// Le plateau entier dans UN Canvas (efficace)
export function PlateauSkia({ w, h, r, bulles }: {
  w: number; h: number; r: number; bulles: BullePx[];
}) {
  // 🩹 26/07 — l'ordre d'empilement se lit dans le MOTEUR (`perleEnAvant`) et non plus
  // dans une liste en dur, qui aurait divergé du registre dès la première perle ajoutée.
  // Le rang est calculé UNE fois par perle (au `map`) et non à chaque comparaison :
  // `sort` appelle son comparateur ~n·log n fois, soit ~6 fois de trop sur 56 perles.
  const ordre = bulles
    .map((b, i) => ({ b, i, av: perleEnAvant(b) ? 1 : 0 }))
    .sort((a, z) => a.av - z.av);
  return (
    <Canvas style={{ width: w, height: h }}>
      {ordre.map(({ b, i }) => (
        <BulleSkia key={i} x={b.x} y={b.y} r={r} couleur={b.couleur} capsule={b.capsule} special={b.special} pv={b.pv} />
      ))}
    </Canvas>
  );
}

// Bille isolée (projectile, lanceur, perle suivante) — Canvas carré de côté `taille`
export function BilleSkia({ taille, hex, glow }: { taille: number; hex: string; glow?: boolean }) {
  const g = gradDe(hex);
  const c = taille / 2;
  const r = taille * 0.47;
  return (
    <Canvas style={{ width: taille, height: taille }}>
      {glow && <Circle cx={c} cy={c} r={r} color={g.clair} opacity={0.35} />}
      <Circle cx={c} cy={c} r={r}>
        <RadialGradient c={vec(c - r * 0.3, c - r * 0.34)} r={r * 1.4} colors={[g.clair, g.base, g.sombre]} />
      </Circle>
      <Circle cx={c - r * 0.3} cy={c - r * 0.33} r={r * 0.24} color="rgba(255,255,255,0.6)" />
    </Canvas>
  );
}
