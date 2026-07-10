// === Boba Quest — rendu Skia du shooter (perles brillantes, GPU 60 fps) ===
// Remplace les cercles plats par des perles en dégradé radial « glossy » avec
// reflet, et les capsules en billes dorées. La logique reste dans moteur-shooter.
import {
  Canvas, Circle, Group, Line, Path, RadialGradient, SweepGradient, vec,
} from '@shopify/react-native-skia';

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

// Les 6 couleurs pour le tourbillon arc-en-ciel
const RAINBOW = ['#8A68B8', '#A3C724', '#FFD166', '#F3A0BD', '#7EC8E3', '#F7A14B', '#8A68B8'];

// Les 6 familles de perles (même ordre que COULEURS du shooter)
const BASE = ['#8A68B8', '#A3C724', '#FFD166', '#F3A0BD', '#7EC8E3', '#F7A14B'];

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

// Une perle glossy (dans un Canvas parent)
function BulleSkia({ x, y, r, couleur, capsule, special, pv }: {
  x: number; y: number; r: number; couleur: number;
  capsule?: boolean; special?: string; pv?: number;
}) {
  // reflet glossy commun (haut-gauche)
  const reflet = <Circle cx={x - r * 0.3} cy={y - r * 0.33} r={r * 0.22} color="rgba(255,255,255,0.55)" />;

  // 💥 BOMBE : sphère sombre + mèche + étincelle
  if (special === 'bombe') {
    return (
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
    );
  }

  // 🌈 ARC-EN-CIEL : tourbillon multicolore (joker)
  if (special === 'arc') {
    return (
      <Group>
        <Circle cx={x} cy={y} r={r}>
          <SweepGradient c={vec(x, y)} colors={RAINBOW} />
        </Circle>
        <Circle cx={x} cy={y} r={r} style="stroke" strokeWidth={r * 0.1} color="rgba(255,255,255,0.6)" />
        {reflet}
      </Group>
    );
  }

  // ⭐ BONUS : perle colorée + étoile dorée
  if (special === 'bonus') {
    const g = GRAD[couleur] ?? GRAD[0];
    return (
      <Group>
        <Circle cx={x} cy={y} r={r}>
          <RadialGradient c={vec(x - r * 0.3, y - r * 0.34)} r={r * 1.4} colors={[g.clair, g.base, g.sombre]} />
        </Circle>
        <Path path={etoilePath(x, y, r * 0.62)} color="#f2da33" />
        <Path path={etoilePath(x, y, r * 0.62)} style="stroke" strokeWidth={r * 0.08} color="#C99012" />
        <Circle cx={x - r * 0.15} cy={y - r * 0.2} r={r * 0.1} color="rgba(255,255,255,0.85)" />
      </Group>
    );
  }

  // 🧊 GLAÇON : bloc de glace bleuté (ne se matche pas)
  if (special === 'glacon') {
    return (
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
    );
  }

  if (capsule) {
    // 🎁 Capsule gachapon à libérer : dôme translucide (haut) + moitié dorée (bas)
    // + jointure + anneau + halo — volontairement DIFFÉRENTE d'une perle.
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
  }
  const g = GRAD[couleur] ?? GRAD[0];

  // ❄️ GIVRE : perle colorée sous une pellicule de givre (2 coups). pv=1 → fissurée.
  if (special === 'givre') {
    const fissure = (pv ?? 2) <= 1;
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
  }

  return (
    <Group>
      <Circle cx={x} cy={y} r={r}>
        <RadialGradient c={vec(x - r * 0.3, y - r * 0.34)} r={r * 1.4} colors={[g.clair, g.base, g.sombre]} />
      </Circle>
      {reflet}
    </Group>
  );
}

export type BullePx = {
  x: number; y: number; couleur: number;
  capsule?: boolean; special?: string; pv?: number;
};

// Une perle « en avant » (capsule, bombe, bonus, arc) passe au-dessus des voisines
const enAvant = (b: BullePx) => (b.capsule || b.special === 'bombe' || b.special === 'bonus' || b.special === 'arc') ? 1 : 0;

// Le plateau entier dans UN Canvas (efficace)
export function PlateauSkia({ w, h, r, bulles }: {
  w: number; h: number; r: number; bulles: BullePx[];
}) {
  const ordre = bulles.map((b, i) => ({ b, i })).sort((a, z) => enAvant(a.b) - enAvant(z.b));
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
