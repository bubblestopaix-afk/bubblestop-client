// === Boba Quest — petits composants partagés du jeu ===
// Icône perle, compteur de perles, en-tête d'écran, bandeau preview,
// pictos SVG des tuiles du hub (style charte, comme pictos-offres).
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Animated, Easing, View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';

import { C, F, R, OMBRE } from '@/constants/charte';
import { BoutonRetour } from '@/components/ui-kit';

// La « Perle » : monnaie du jeu (perle de tapioca brillante)
export function IconePerle({ taille = 18 }: { taille?: number }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} fill="#4c2d77" />
      <Circle cx={8.8} cy={8.8} r={2.6} fill="#fff" opacity={0.5} />
      <Line x1={19.5} y1={3.5} x2={22} y2={3.5} stroke="#C99012" strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={20.75} y1={2.25} x2={20.75} y2={4.75} stroke="#C99012" strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

// Nombre au format fr (12 345)
export function formatNb(n: number): string {
  return n.toLocaleString('fr-FR');
}

// 🎢 Count-up : la valeur « compte » vers sa cible (350 ms) au lieu de sauter.
export function useCountUp(cible: number, duree = 350): number {
  const [affiche, setAffiche] = useState(cible);
  const depuis = useRef(cible);
  useEffect(() => {
    const depart = depuis.current;
    if (depart === cible) return undefined;
    const t0 = Date.now();
    let raf: number;
    const pas = () => {
      const p = Math.min(1, (Date.now() - t0) / duree);
      const e = 1 - (1 - p) * (1 - p); // ease-out
      const v = Math.round(depart + (cible - depart) * e);
      setAffiche(v);
      if (p < 1) raf = requestAnimationFrame(pas);
      else depuis.current = cible;
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [cible, duree]);
  return affiche;
}

// 🎊 Confettis one-shot (candy) : 14 pastilles qui tombent en tournant.
const CONFETTI_COULEURS = ['#9fc038', '#f2da33', '#f7b8d6', '#ec647b', '#89cfe3', '#b98fe0'];
export function Confettis({ hauteur = 240 }: { hauteur?: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [anim]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} accessibilityElementsHidden>
      {Array.from({ length: 14 }).map((_, i) => {
        const gauche = (i * 137) % 100; // répartition déterministe
        const taille = 7 + (i % 3) * 3;
        const retard = (i % 5) / 10;
        const chute = anim.interpolate({
          inputRange: [retard, 1], outputRange: [-24, hauteur], extrapolate: 'clamp',
        });
        const rotation = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${180 + i * 40}deg`] });
        const opacite = anim.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute', top: 0, left: `${gauche}%`,
              width: taille, height: taille * (i % 2 ? 1 : 0.55), borderRadius: 2,
              backgroundColor: CONFETTI_COULEURS[i % CONFETTI_COULEURS.length],
              opacity: opacite,
              transform: [{ translateY: chute }, { rotate: rotation }],
            }}
          />
        );
      })}
    </View>
  );
}

// Pastille « solde de perles »
export function ChipPerles({ n, surFondSombre }: { n: number; surFondSombre?: boolean }) {
  const affiche = useCountUp(n);
  return (
    <View style={[styles.chipPerles, surFondSombre && styles.chipPerlesSombre]}>
      <IconePerle taille={17} />
      <Text style={[styles.chipPerlesTxt, surFondSombre && { color: '#fff' }]}>{formatNb(affiche)}</Text>
    </View>
  );
}

// En-tête d'un écran du jeu : retour + titre + solde
export function EnTeteJeu({ titre, onRetour, perles }: { titre: string; onRetour: () => void; perles?: number }) {
  return (
    <View style={styles.entete}>
      <BoutonRetour onPress={onRetour} />
      <Text style={styles.enteteTitre} numberOfLines={1}>{titre}</Text>
      {perles !== undefined ? <ChipPerles n={perles} /> : <View style={{ width: 40 }} />}
    </View>
  );
}

// Conservé comme point d'extension commun aux écrans du jeu. Aucun avertissement
// technique n'est montré au joueur : la publication publique restera désactivée
// tant que la chaîne de récompenses réelles n'est pas terminée.
export function BandeauPreview() {
  return null;
}

// --- Pictos des tuiles du hub (SVG charte) ---------------------------------------

// Pictos OFFICIELS de la DA (bubble-stop-DA/assets/game/picto-*.svg, piste 2c) —
// convertis en react-native-svg à l'identique. Ne pas redessiner : source Design.
const PICTOS_HUB: Record<string, ReactElement> = {
  // 🎯 Jouer / Aventure — cible (picto-jouer-cible.svg)
  jouer: (
    <>
      <Circle cx={12} cy={12} r={8} fill="none" stroke="#633e90" strokeWidth={1.6} />
      <Circle cx={12} cy={12} r={4.4} fill="#fff" stroke="#633e90" strokeWidth={1.3} />
      <Circle cx={12} cy={12} r={1.9} fill="#4c2d77" />
      <Line x1={12} y1={1.6} x2={12} y2={5} stroke="#633e90" strokeWidth={1.7} strokeLinecap="round" />
      <Line x1={12} y1={19} x2={12} y2={22.4} stroke="#633e90" strokeWidth={1.7} strokeLinecap="round" />
      <Line x1={1.6} y1={12} x2={5} y2={12} stroke="#633e90" strokeWidth={1.7} strokeLinecap="round" />
      <Line x1={19} y1={12} x2={22.4} y2={12} stroke="#633e90" strokeWidth={1.7} strokeLinecap="round" />
    </>
  ),
  // 🧿 Capsules — gachapon rose (picto-capsule.svg)
  capsules: (
    <>
      <Path d="M4.8 12.4A7.2 7.2 0 0 1 19.2 12.4Z" fill="#f7b8d6" />
      <Circle cx={12} cy={9.6} r={2.1} fill="#4c2d77" />
      <Rect x={4.3} y={11.4} width={15.4} height={2.4} rx={1.2} fill="#fff" />
      <Path d="M4.9 13.6A7 7 0 0 0 19.1 13.6Z" fill="#c06a99" />
      <Path d="M12 2.3l.55 1.4 1.4.55-1.4.55-.55 1.4-.55-1.4-1.4-.55 1.4-.55Z" fill="#f2da33" />
    </>
  ),
  // 📖 Collection — album vert à perles (picto-collection.svg)
  collection: (
    <>
      <Path d="M12 6.2Q8 4.2 4 5.6L4 18.2Q8 16.8 12 18.6Q16 16.8 20 18.2L20 5.6Q16 4.2 12 6.2Z" fill="#8ebe74" />
      <Path d="M12 6.2L12 18.6" stroke="#4c7a35" strokeWidth={1.2} />
      <Circle cx={7.6} cy={10} r={1.5} fill="#633e90" />
      <Circle cx={16.4} cy={10} r={1.5} fill="#f2da33" />
      <Circle cx={7.6} cy={13.6} r={1.5} fill="#ec647b" />
      <Circle cx={16.4} cy={13.6} r={1.5} fill="#89cfe3" />
    </>
  ),
  // 🎡 Roulette — roue 6 couleurs (picto-roulette.svg)
  roulette: (
    <>
      <Path d="M12 13L12 5.4A7.6 7.6 0 0 1 18.6 9.2Z" fill="#f2da33" />
      <Path d="M12 13L18.6 9.2A7.6 7.6 0 0 1 18.6 16.8Z" fill="#ec647b" />
      <Path d="M12 13L18.6 16.8A7.6 7.6 0 0 1 12 20.6Z" fill="#9fc038" />
      <Path d="M12 13L12 20.6A7.6 7.6 0 0 1 5.4 16.8Z" fill="#89cfe3" />
      <Path d="M12 13L5.4 16.8A7.6 7.6 0 0 1 5.4 9.2Z" fill="#f7b8d6" />
      <Path d="M12 13L5.4 9.2A7.6 7.6 0 0 1 12 5.4Z" fill="#633e90" />
      <Circle cx={12} cy={13} r={2} fill="#fff" stroke="#4c2d77" strokeWidth={1} />
      <Path d="M12 2.6L10.2 5.8L13.8 5.8Z" fill="#4c2d77" />
    </>
  ),
  // 🎁 Boutique — cadeau rose à nœud jaune (picto-boutique.svg)
  boutique: (
    <>
      <Rect x={4.8} y={10.6} width={14.4} height={9.4} rx={1.6} fill="#ec647b" />
      <Rect x={4} y={8.3} width={16} height={3.6} rx={1.2} fill="#c23e57" />
      <Rect x={10.8} y={8.3} width={2.4} height={11.7} fill="#fff" />
      <Path d="M12 8C9.5 8 8.4 4.3 10.6 4.3C12 4.3 12 6.6 12 8C12 6.6 12 4.3 13.4 4.3C15.6 4.3 14.5 8 12 8Z" fill="#f2da33" />
    </>
  ),
  // ⚔️ Arène — épées violet/vert + étincelle (picto-arene.svg)
  arene: (
    <>
      <Path d="M5.2 19.4L15.4 7.2" stroke="#633e90" strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M14.3 5.6L18.2 8.1L16.6 10L12.7 7Z" fill="#633e90" />
      <Path d="M4 16.4L7.6 20" stroke="#633e90" strokeWidth={2.3} strokeLinecap="round" />
      <Path d="M18.8 19.4L8.6 7.2" stroke="#9fc038" strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M9.7 5.6L5.8 8.1L7.4 10L11.3 7Z" fill="#9fc038" />
      <Path d="M20 16.4L16.4 20" stroke="#9fc038" strokeWidth={2.3} strokeLinecap="round" />
      <Path d="M12 1.8l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7Z" fill="#f2da33" />
    </>
  ),
  // ♾️ Infini — boucle bleue (picto-infini.svg)
  infini: (
    <>
      <Path d="M6 12C6 8.6 9.3 8.6 12 12C14.7 15.4 18 15.4 18 12C18 8.6 14.7 8.6 12 12C9.3 15.4 6 15.4 6 12Z" fill="#3d9ab8" />
      <Path d="M7.6 10.8C8.3 10.1 9.5 10.3 10.6 11.4" stroke="#fff" strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.75} />
      <Path d="M19.4 4.9l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5Z" fill="#f2da33" />
    </>
  ),
  // 🤝 Troc — flèches échangées (picto-troc.svg)
  troc: (
    <>
      <Path d="M4 9 L16 9 M16 9 L13 6 M16 9 L13 12" stroke="#633e90" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M20 15 L8 15 M8 15 L11 12 M8 15 L11 18" stroke="#9fc038" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={19.5} cy={5.5} r={1.4} fill="#f7b8d6" />
      <Circle cx={4.5} cy={19} r={1.4} fill="#b98fe0" />
    </>
  ),
};

// Pictos BLANCS des tuiles candy du hub (maquette 2c : glyphe blanc sur tuile saturée)
const PICTOS_TUILE: Record<string, ReactElement> = {
  arene: (
    <>
      <Path d="M5.2 19.4L15.4 7.2" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M14.3 5.6L18.2 8.1L16.6 10L12.7 7Z" fill="#fff" />
      <Path d="M4 16.4L7.6 20" stroke="#fff" strokeWidth={2.3} strokeLinecap="round" />
      <Path d="M18.8 19.4L8.6 7.2" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" opacity={0.7} />
      <Path d="M9.7 5.6L5.8 8.1L7.4 10L11.3 7Z" fill="#fff" opacity={0.7} />
      <Path d="M20 16.4L16.4 20" stroke="#fff" strokeWidth={2.3} strokeLinecap="round" opacity={0.7} />
      <Path d="M12 1.8l.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7Z" fill="#f2da33" />
    </>
  ),
  capsules: (
    <>
      <Path d="M4.8 12.4A7.2 7.2 0 0 1 19.2 12.4Z" fill="#fff" />
      <Circle cx={12} cy={9.6} r={2.1} fill="#c489ad" />
      <Rect x={4.3} y={11.4} width={15.4} height={2.4} rx={1.2} fill="#fff" />
      <Path d="M4.9 13.6A7 7 0 0 0 19.1 13.6Z" fill="rgba(255,255,255,0.65)" />
      <Path d="M12 2.3l.55 1.4 1.4.55-1.4.55-.55 1.4-.55-1.4-1.4-.55 1.4-.55Z" fill="#f2da33" />
    </>
  ),
  collection: (
    <>
      <Path d="M12 6.2Q8 4.2 4 5.6L4 18.2Q8 16.8 12 18.6Q16 16.8 20 18.2L20 5.6Q16 4.2 12 6.2Z" fill="#fff" />
      <Path d="M12 6.2L12 18.6" stroke="#8ebe74" strokeWidth={1.2} />
      <Circle cx={7.6} cy={10} r={1.5} fill="#633e90" />
      <Circle cx={16.4} cy={10} r={1.5} fill="#f2da33" />
      <Circle cx={7.6} cy={13.6} r={1.5} fill="#ec647b" />
      <Circle cx={16.4} cy={13.6} r={1.5} fill="#89cfe3" />
    </>
  ),
  roulette: (
    <>
      <Circle cx={12} cy={13} r={7.8} fill="#fff" />
      <Path d="M12 5.2L12 20.8M5.2 13L18.8 13M7.2 8.2L16.8 17.8M16.8 8.2L7.2 17.8" stroke="#f0b737" strokeWidth={1.1} />
      <Circle cx={12} cy={13} r={2.2} fill="#ec647b" />
      <Path d="M12 2.4L10.1 5.8L13.9 5.8Z" fill="#633e90" />
    </>
  ),
  boutique: (
    <>
      <Rect x={4.8} y={10.6} width={14.4} height={9.4} rx={1.6} fill="#fff" />
      <Rect x={4} y={8.3} width={16} height={3.6} rx={1.2} fill="#fff" />
      <Rect x={10.8} y={8.3} width={2.4} height={11.7} fill="#2bb4a9" />
      <Path d="M12 8C9.5 8 8.4 4.3 10.6 4.3C12 4.3 12 6.6 12 8C12 6.6 12 4.3 13.4 4.3C15.6 4.3 14.5 8 12 8Z" fill="#f2da33" />
    </>
  ),
  infini: (
    <>
      <Path d="M6 12C6 8.6 9.3 8.6 12 12C14.7 15.4 18 15.4 18 12C18 8.6 14.7 8.6 12 12C9.3 15.4 6 15.4 6 12Z" fill="#fff" />
      <Path d="M19.4 4.9l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5Z" fill="#f2da33" />
    </>
  ),
  troc: (
    <>
      <Path d="M4 9 L16 9 M16 9 L13 6 M16 9 L13 12" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M20 15 L8 15 M8 15 L11 12 M8 15 L11 18" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.7} />
      <Circle cx={19.5} cy={5.5} r={1.4} fill="#f2da33" />
    </>
  ),
};

// Couleurs candy des tuiles (maquette 2c) : fond + socle
export const TUILES_CANDY: Record<string, { fond: string; socle: string }> = {
  arene: { fond: '#ec647b', socle: '#c23e57' },
  capsules: { fond: '#e3b2d3', socle: '#c489ad' },
  collection: { fond: '#8ebe74', socle: '#6b9a54' },
  roulette: { fond: '#f0b737', socle: '#c9901f' },
  boutique: { fond: '#2bb4a9', socle: '#1c8d84' },
  infini: { fond: '#3d9ab8', socle: '#2d7691' },
  troc: { fond: '#b98fe0', socle: '#9668c9' },
};

// Tuile candy du hub (56 px, socle plein, picto blanc, badge, label dessous).
// L'emprise de 72 px garde les libellés séparés dans la grille responsive du hub.
export function TuileMode({ id, label, badge, onPress, accessibilityLabel }: {
  id: keyof typeof TUILES_CANDY | string; label: string; badge?: string;
  onPress: () => void; accessibilityLabel?: string;
}) {
  const c = TUILES_CANDY[id] || TUILES_CANDY.arene;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      style={styles.tuileMode}
    >
      <View style={[styles.tuileModeBloc, { backgroundColor: c.fond, borderBottomColor: c.socle }]}>
        {badge != null && (
          <View style={styles.tuileModeBadge}>
            <Text style={styles.tuileModeBadgeTxt}>{badge}</Text>
          </View>
        )}
        <Svg width={26} height={26} viewBox="0 0 24 24">
          {PICTOS_TUILE[id] || PICTOS_TUILE.arene}
        </Svg>
      </View>
      <Text style={styles.tuileModeLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function PictoHub({ id, fond, taille = 46 }: { id: string; fond: string; taille?: number }) {
  return (
    <View style={{
      width: taille, height: taille, borderRadius: taille * 0.32,
      backgroundColor: fond, alignItems: 'center', justifyContent: 'center',
    }}>
      <Svg width={taille * 0.66} height={taille * 0.66} viewBox="0 0 24 24">
        {PICTOS_HUB[id] || PICTOS_HUB.jouer}
      </Svg>
    </View>
  );
}

// Chip de rareté (Commun / Rare / Épique / Légendaire)
export function ChipRarete({ nom, couleur }: { nom: string; couleur: string }) {
  return (
    <View style={[styles.chipRarete, { borderColor: couleur }]}>
      <View style={[styles.chipRaretePastille, { backgroundColor: couleur }]} />
      <Text style={[styles.chipRareteTxt, { color: couleur }]}>{nom}</Text>
    </View>
  );
}

// Grand bouton candy 3D du jeu (DA kawaii : socle plein plus foncé).
// variante : 'vert' (CTA principal), 'violet' (secondaire), 'danger' (boss/destructif).
const CANDY = {
  vert: { fond: C.vert, socle: '#6F8F1F', texte: '#2C380C' },
  violet: { fond: C.violet, socle: C.violetProfond, texte: '#FFFFFF' },
  danger: { fond: C.danger, socle: '#8E3350', texte: '#FFFFFF' },
} as const;

export function BoutonJeu({
  titre, onPress, disabled, style, accessibilityHint, variante = 'vert',
}: {
  titre: string; onPress: () => void; disabled?: boolean; style?: any;
  accessibilityHint?: string; variante?: keyof typeof CANDY;
}) {
  const v = CANDY[variante];
  return (
    <Pressable
      style={[
        styles.btnJeu,
        { backgroundColor: v.fond, borderBottomColor: v.socle },
        disabled && { opacity: 0.45 },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={titre}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <Text style={[styles.btnJeuTxt, { color: v.texte }]}>{titre}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chipPerles: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.carte, borderRadius: R.pill,
    paddingVertical: 7, paddingHorizontal: 13,
    borderWidth: 2, borderColor: C.bord, ...OMBRE,
  },
  chipPerlesSombre: { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.25)' },
  chipPerlesTxt: { fontFamily: F.titre, fontSize: 14.5, color: C.violetProfond },

  entete: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  enteteTitre: { flex: 1, fontFamily: F.titre, fontSize: 21, color: C.violet },

  preview: {
    backgroundColor: '#EAE4F6', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#DED5EC',
  },
  previewTxt: { fontFamily: F.t600, fontSize: 12, color: C.texte2, lineHeight: 17, textAlign: 'center' },

  chipRarete: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 10,
  },
  chipRaretePastille: { width: 8, height: 8, borderRadius: 4 },
  chipRareteTxt: { fontFamily: F.t700, fontSize: 12 },

  btnJeu: {
    borderRadius: R.btn, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 5,
  },
  btnJeuTxt: { fontFamily: F.titre, fontSize: 16.5 },

  // Tuiles candy du hub (maquette 2c)
  tuileMode: { width: 72, alignItems: 'center', gap: 6 },
  tuileModeBloc: {
    width: 56, height: 56, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 5,
  },
  tuileModeBadge: {
    position: 'absolute', top: -4, right: -4, zIndex: 2,
    backgroundColor: '#EC647B', borderRadius: R.pill, minWidth: 19, height: 19,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 2, borderColor: C.fond,
  },
  tuileModeBadgeTxt: { fontFamily: F.t800, fontSize: 10, color: '#fff' },
  tuileModeLabel: { fontFamily: F.t700, fontSize: 11, color: C.texte },
});
