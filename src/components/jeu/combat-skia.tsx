// === Boba Quest — juice Skia des combats (burst d'impact / critique, GPU) ===
// Effet ponctuel joué à chaque coup : anneau de choc + étincelles + flash.
// Piloté par requestAnimationFrame (autonome du replay), remonté par `cle`.
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';

export function BurstSkia({ taille, crit, cle }: { taille: number; crit: boolean; cle: number }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = Date.now();
    const dur = crit ? 520 : 380;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / dur);
      setT(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setT(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cle, crit]);

  if (t >= 1) return null;
  const c = taille / 2;
  const n = crit ? 10 : 7;
  const coul = crit ? '#FFD166' : '#F3A0BD';
  const op = 1 - t;
  const ringR = c * (0.3 + t * 0.95);

  return (
    <Canvas style={{ width: taille, height: taille }} pointerEvents="none">
      {/* anneau de choc */}
      <Circle cx={c} cy={c} r={ringR} style="stroke" strokeWidth={crit ? 4 : 2.5} color={coul} opacity={op * 0.85} />
      {/* étincelles projetées */}
      <Group>
        {Array.from({ length: n }).map((_, i) => {
          const ang = (i / n) * Math.PI * 2 + (crit ? 0.3 : 0);
          const dist = c * (0.2 + t * (crit ? 1.05 : 0.8));
          const px = c + Math.cos(ang) * dist;
          const py = c + Math.sin(ang) * dist;
          const pr = Math.max(0.5, (crit ? 4.5 : 3) * (1 - t));
          return <Circle key={i} cx={px} cy={py} r={pr} color={coul} opacity={op} />;
        })}
      </Group>
      {/* flash central */}
      <Circle cx={c} cy={c} r={c * 0.5 * (1 - t)} color="#ffffff" opacity={op * 0.5} />
    </Canvas>
  );
}
