// === Boba Quest — petits composants partagés du jeu ===
// Icône perle, compteur de perles, en-tête d'écran, bandeau preview,
// pictos SVG des tuiles du hub (style charte, comme pictos-offres).
import type { ReactElement } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';

import { C, F, R, OMBRE } from '@/constants/charte';
import { BoutonRetour } from '@/components/ui-kit';

const VIOLET = '#4c2d77';

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

// Pastille « solde de perles »
export function ChipPerles({ n, surFondSombre }: { n: number; surFondSombre?: boolean }) {
  return (
    <View style={[styles.chipPerles, surFondSombre && styles.chipPerlesSombre]}>
      <IconePerle taille={17} />
      <Text style={[styles.chipPerlesTxt, surFondSombre && { color: '#fff' }]}>{formatNb(n)}</Text>
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

// Bandeau « preview » : gains simulés tant que le serveur n'est pas branché
export function BandeauPreview() {
  return (
    <View style={styles.preview}>
      <Text style={styles.previewTxt}>
        🔬 Preview — les prix sont simulés. En version finale, ils seront crédités
        automatiquement sur ta carte et validés en caisse.
      </Text>
    </View>
  );
}

// --- Pictos des tuiles du hub (SVG charte) ---------------------------------------

function Etincelle({ x, y, t = 2.2, c = VIOLET }: { x: number; y: number; t?: number; c?: string }) {
  return (
    <>
      <Line x1={x - t} y1={y} x2={x + t} y2={y} stroke={c} strokeWidth={1.4} strokeLinecap="round" />
      <Line x1={x} y1={y - t} x2={x} y2={y + t} stroke={c} strokeWidth={1.4} strokeLinecap="round" />
    </>
  );
}

const PICTOS_HUB: Record<string, ReactElement> = {
  // 🎯 Jouer — perle visée
  jouer: (
    <>
      <Circle cx={12} cy={12} r={8} fill="#eef4d8" stroke={VIOLET} strokeWidth={1.5} />
      <Circle cx={12} cy={12} r={4.6} fill="#fff" stroke={VIOLET} strokeWidth={1.3} />
      <Circle cx={12} cy={12} r={2} fill="#4c2d77" />
      <Line x1={12} y1={1.5} x2={12} y2={5} stroke={VIOLET} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={12} y1={19} x2={12} y2={22.5} stroke={VIOLET} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={1.5} y1={12} x2={5} y2={12} stroke={VIOLET} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={19} y1={12} x2={22.5} y2={12} stroke={VIOLET} strokeWidth={1.6} strokeLinecap="round" />
    </>
  ),
  // 🧿 Capsules — capsule gachapon
  capsules: (
    <>
      <Path d="M4.5 12 A7.5 7.5 0 0 1 19.5 12 Z" fill="#fff" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M4.5 12 A7.5 7.5 0 0 0 19.5 12 Z" fill="#f3a0bd" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Circle cx={9.5} cy={8.6} r={1.4} fill="#e9ddf6" />
      <Etincelle x={20.5} y={4.5} />
    </>
  ),
  // 📖 Collection — album ouvert avec perles
  collection: (
    <>
      <Path d="M12 5.5 Q7.5 3.5 3.5 5 L3.5 19 Q7.5 17.5 12 19.5 Q16.5 17.5 20.5 19 L20.5 5 Q16.5 3.5 12 5.5 Z" fill="#fff" stroke={VIOLET} strokeWidth={1.5} strokeLinejoin="round" />
      <Line x1={12} y1={5.5} x2={12} y2={19.5} stroke={VIOLET} strokeWidth={1.2} />
      <Circle cx={7.5} cy={10.5} r={1.6} fill="#8A68B8" />
      <Circle cx={16.5} cy={10.5} r={1.6} fill="#A3C724" />
      <Circle cx={7.5} cy={14.5} r={1.6} fill="#FFD166" />
      <Circle cx={16.5} cy={14.5} r={1.6} fill="#F3A0BD" />
    </>
  ),
  // 🎡 Roulette — roue de la fortune
  roulette: (
    <>
      <Circle cx={12} cy={13} r={8} fill="#fff" stroke={VIOLET} strokeWidth={1.5} />
      {[0, 45, 90, 135].map((a) => {
        const r = (a * Math.PI) / 180;
        return <Line key={a} x1={12 - Math.cos(r) * 8} y1={13 - Math.sin(r) * 8} x2={12 + Math.cos(r) * 8} y2={13 + Math.sin(r) * 8} stroke={VIOLET} strokeWidth={1.2} />;
      })}
      <Circle cx={12} cy={13} r={2.2} fill="#f2da33" stroke={VIOLET} strokeWidth={1.2} />
      <Path d="M12 1.4 L10.4 4.4 L13.6 4.4 Z" fill="#D2588A" stroke={VIOLET} strokeWidth={1} strokeLinejoin="round" />
    </>
  ),
  // 🎁 Boutique — cadeau
  boutique: (
    <>
      <Rect x={4.5} y={9} width={15} height={11.5} rx={2} fill="#eef4d8" stroke={VIOLET} strokeWidth={1.5} />
      <Line x1={12} y1={9} x2={12} y2={20.5} stroke={VIOLET} strokeWidth={1.4} />
      <Path d="M12 8.5 C8 8.5 7.5 4 10.2 4 C12 4 12 6.5 12 8.5 C12 6.5 12 4 13.8 4 C16.5 4 16 8.5 12 8.5 Z" fill="#A3C724" stroke={VIOLET} strokeWidth={1.3} strokeLinejoin="round" />
      <Etincelle x={20.5} y={5} t={1.8} />
    </>
  ),
  // ⚔️ Arène — deux épées croisées kawaii
  arene: (
    <>
      <Line x1={5.5} y1={18.5} x2={16.5} y2={5.5} stroke={VIOLET} strokeWidth={2.4} strokeLinecap="round" />
      <Line x1={4.2} y1={15.2} x2={8.8} y2={19.8} stroke={VIOLET} strokeWidth={2} strokeLinecap="round" />
      <Line x1={18.5} y1={18.5} x2={7.5} y2={5.5} stroke="#7E9B12" strokeWidth={2.4} strokeLinecap="round" />
      <Line x1={19.8} y1={15.2} x2={15.2} y2={19.8} stroke="#7E9B12" strokeWidth={2} strokeLinecap="round" />
      <Circle cx={16.9} cy={4.9} r={1.7} fill="#f2da33" stroke={VIOLET} strokeWidth={1} />
      <Circle cx={7.1} cy={4.9} r={1.7} fill="#f3a0bd" stroke={VIOLET} strokeWidth={1} />
      <Etincelle x={12} y={2.6} t={1.7} />
    </>
  ),
  // 🤝 Troc — deux flèches échangées
  troc: (
    <>
      <Path d="M4 9 L16 9 M16 9 L13 6 M16 9 L13 12" stroke={VIOLET} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M20 15 L8 15 M8 15 L11 12 M8 15 L11 18" stroke="#7E9B12" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={19.5} cy={5.5} r={1.4} fill="#f3a0bd" />
      <Circle cx={4.5} cy={19} r={1.4} fill="#e9ddf6" />
    </>
  ),
};

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

// Grand bouton d'action du jeu (violet plein — le vert reste pour les achats)
export function BoutonJeu({
  titre, onPress, disabled, style, accessibilityHint,
}: {
  titre: string; onPress: () => void; disabled?: boolean; style?: any;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      style={[styles.btnJeu, disabled && { opacity: 0.45 }, style]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={titre}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <Text style={styles.btnJeuTxt}>{titre}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chipPerles: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.lavande, borderRadius: R.pill,
    paddingVertical: 7, paddingHorizontal: 12,
  },
  chipPerlesSombre: { backgroundColor: 'rgba(255,255,255,0.16)' },
  chipPerlesTxt: { fontFamily: F.t800, fontSize: 14.5, color: C.violetProfond },

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
    backgroundColor: C.violet, borderRadius: R.btn + 2, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  btnJeuTxt: { fontFamily: F.t800, fontSize: 15.5, color: '#fff' },
});
