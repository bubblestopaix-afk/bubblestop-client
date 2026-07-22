// === Kit UI Bubble Stop : composants partagés de la DA « kawaii » ===
// Cartes bordées, boutons candy, trio de pastilles, séparateurs pointillés roses…
// utilisés par tous les écrans (cf. bubble-stop-DA/AGENTS-DA.md).
import { ReactNode } from 'react';
import {
  View, Text, Pressable, TextInput, ActivityIndicator,
  StyleSheet, StyleProp, ViewStyle, TextInputProps,
} from 'react-native';
import Svg, { Circle, Line, Path, SvgXml } from 'react-native-svg';

import { BORD, C, F, R, OMBRE } from '@/constants/charte';

// Chevron › (navigation)
export function Chevron({ couleur = C.texte3, size = 18 }: { couleur?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9.5 6 L15.5 12 L9.5 18" stroke={couleur} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Bouton retour rond (posé sur photo ou fond clair)
export function BoutonRetour({ onPress, surPhoto = false }: { onPress: () => void; surPhoto?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Retour"
      style={[styles.retour, surPhoto ? styles.retourPhoto : null]}
      hitSlop={8}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M14.5 6 L8.5 12 L14.5 18" stroke={surPhoto ? '#fff' : C.violetProfond} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

// Carte blanche kawaii : bordure 3 px #F0EBF8, rayon 24, ombre douce violette
export function Carte({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.carte, style]}>{children}</View>;
}

// Trio de pastilles vert/jaune/rose — signe d'ouverture de section de la DA
export function TrioPastilles({ taille = 1 }: { taille?: number }) {
  return (
    <View style={styles.trio} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.trioP, { width: 11 * taille, height: 11 * taille, backgroundColor: C.vert }]} />
      <View style={[styles.trioP, { width: 8 * taille, height: 8 * taille, backgroundColor: C.jaune }]} />
      <View style={[styles.trioP, { width: 5 * taille, height: 5 * taille, backgroundColor: C.rose }]} />
    </View>
  );
}

// Titre de page/section kawaii : trio de pastilles + Fredoka violet (+ sous-titre)
export function TitreKawaii({ texte, sousTitre, droite, taille = 22 }: {
  texte: string; sousTitre?: string; droite?: ReactNode; taille?: number;
}) {
  return (
    <View style={{ gap: 2 }}>
      <View style={styles.titreKawaiiRang}>
        <TrioPastilles />
        <Text style={[styles.titreKawaiiTxt, { fontSize: taille }]}>{texte}</Text>
        <View style={{ flex: 1 }} />
        {droite}
      </View>
      {!!sousTitre && <Text style={styles.titreKawaiiSous}>{sousTitre}</Text>}
    </View>
  );
}

// Séparateur pointillé rose (signature DA) — trait SVG en pointillés arrondis
export function PointillesRose({ couleur = '#F3D9E9' }: { couleur?: string }) {
  return (
    <Svg height={4} style={{ alignSelf: 'stretch' }} accessibilityElementsHidden>
      <Line x1={2} y1={2} x2="100%" y2={2} stroke={couleur} strokeWidth={2.6} strokeLinecap="round" strokeDasharray="0.1, 8" />
    </Svg>
  );
}

// Étincelle ✦ décorative de la marque — asset officiel bubble-stop-DA/assets/brand/etincelle.svg
export function Etincelle({ taille = 16, couleur = C.jaune, style }: { taille?: number; couleur?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24" style={style} accessibilityElementsHidden>
      <Path d="M12 1 l1.6 8.4 8.4 1.6 -8.4 1.6 -1.6 8.4 -1.6 -8.4 -8.4 -1.6 8.4 -1.6 Z" fill={couleur} />
    </Svg>
  );
}

// Mascotte-perle rose signature — asset officiel bubble-stop-DA/assets/brand/mascotte-perle(.couronne).svg
export function MascottePerle({ taille = 44, couronne = false }: { taille?: number; couronne?: boolean }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 40 40" accessibilityElementsHidden>
      <Circle cx={20} cy={20} r={17} fill="#f4a0c6" />
      {couronne && <Path d="M11 10 L14 6 L17 9 L20 5 L23 9 L26 6 L29 10 Z" fill="#f2da33" />}
      <Circle cx={14} cy={couronne ? 19 : 18} r={2.3} fill="#5a2a4e" />
      <Circle cx={26} cy={couronne ? 19 : 18} r={2.3} fill="#5a2a4e" />
      {couronne
        ? <Path d="M15 25 Q20 28.5 25 25" stroke="#5a2a4e" strokeWidth={2.2} fill="none" strokeLinecap="round" />
        : <Path d="M15 23.5 Q20 27.5 25 23.5" stroke="#5a2a4e" strokeWidth={2.2} fill="none" strokeLinecap="round" />}
      {!couronne && <Circle cx={9.5} cy={22.5} r={2.7} fill="#fff" opacity={0.5} />}
      {!couronne && <Circle cx={30.5} cy={22.5} r={2.7} fill="#fff" opacity={0.5} />}
    </Svg>
  );
}

// Bande ondulée officielle — contenu LITTÉRAL de bubble-stop-DA/assets/brand/vague.svg
const VAGUE_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 60" preserveAspectRatio="none"><path d="M0,34 Q65,18 130,34 T260,34 T390,34 T520,34 L520,60 L0,60 Z" fill="#452a6e"></path><path d="M0,44 Q65,28 130,44 T260,44 T390,44 T520,44 L520,60 L0,60 Z" fill="#a883d6" opacity=".2"></path></svg>`;
export function Vague({ hauteur = 30, style }: { hauteur?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, height: hauteur }, style]} accessibilityElementsHidden>
      <SvgXml xml={VAGUE_XML} width="100%" height="100%" />
    </View>
  );
}

// Bouton principal (vert, plein)
export function BoutonPrimaire({
  titre, onPress, disabled, loading, style,
}: { titre: string; onPress: () => void; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titre}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={[styles.btnPrimaire, (disabled || loading) && { opacity: 0.5 }, style]}
      onPress={onPress}
      disabled={disabled || loading}>
      {loading ? <ActivityIndicator color={C.violetProfond} /> : <Text style={styles.btnPrimaireTxt}>{titre}</Text>}
    </Pressable>
  );
}

// Bouton discret (texte seul)
export function BoutonGhost({
  titre, onPress, danger, style,
}: { titre: string; onPress: () => void; danger?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={titre} style={[styles.btnGhost, style]} onPress={onPress} hitSlop={6}>
      <Text style={[styles.btnGhostTxt, danger && { color: C.danger }]}>{titre}</Text>
    </Pressable>
  );
}

// Ligne de menu (style réglages iOS / McDo) : titre, sous-titre, contenu à droite, chevron
export function LigneMenu({
  titre, sousTitre, onPress, droite, danger, separateur = true,
}: {
  titre: string; sousTitre?: string; onPress?: () => void;
  droite?: ReactNode; danger?: boolean; separateur?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={sousTitre ? `${titre}, ${sousTitre}` : titre}
      disabled={!onPress}
      style={({ pressed }) => [styles.ligneMenu, pressed && onPress ? { backgroundColor: C.fond } : null]}>
      <View style={styles.ligneMenuRang}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.ligneMenuTitre, danger && { color: C.danger }]}>{titre}</Text>
          {!!sousTitre && <Text style={styles.ligneMenuSousTitre}>{sousTitre}</Text>}
        </View>
        {droite ?? (onPress ? <Chevron /> : null)}
      </View>
      {separateur && <View style={{ marginTop: 14 }}><PointillesRose /></View>}
    </Pressable>
  );
}

// Chip de sélection (formats, sucre, créneaux…) — pastille de couleur optionnelle
export function Chip({
  label, actif, onPress, disabled, pastille,
}: { label: string; actif?: boolean; onPress?: () => void; disabled?: boolean; pastille?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!actif, disabled: !!disabled }}
      style={[styles.chip, actif && styles.chipActif, disabled && { opacity: 0.35 }]}
      onPress={onPress}
      disabled={disabled}>
      {!!pastille && <View style={[styles.chipPastille, { backgroundColor: pastille }]} />}
      <Text style={[styles.chipTxt, actif && styles.chipTxtActif]}>{label}</Text>
    </Pressable>
  );
}

// Stepper − n +
export function Stepper({
  valeur, onMoins, onPlus, petit,
}: { valeur: number; onMoins: () => void; onPlus: () => void; petit?: boolean }) {
  const t = petit ? 30 : 40;
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityRole="button" accessibilityLabel="Diminuer la quantité" style={[styles.stepperBtn, { width: t, height: t, borderRadius: t / 2 }]} onPress={onMoins} hitSlop={4}>
        <Text style={styles.stepperBtnTxt}>−</Text>
      </Pressable>
      <Text accessibilityLabel={`Quantité ${valeur}`} style={[styles.stepperNb, petit && { fontSize: 15, minWidth: 18 }]}>{valeur}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Augmenter la quantité" style={[styles.stepperBtn, { width: t, height: t, borderRadius: t / 2 }]} onPress={onPlus} hitSlop={4}>
        <Text style={styles.stepperBtnTxt}>+</Text>
      </Pressable>
    </View>
  );
}

// Champ de saisie avec label
export function ChampTexte({ label, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {!!label && <Text style={styles.champLabel}>{label}</Text>}
      <TextInput accessibilityLabel={props.accessibilityLabel ?? label} style={styles.champ} placeholderTextColor={C.texte3} {...props} />
    </View>
  );
}

// Message d'état (info / ok / erreur)
export function Message({ texte, type = 'info' }: { texte: string; type?: 'info' | 'ok' | 'erreur' }) {
  const fond = type === 'ok' ? C.vertPale : type === 'erreur' ? C.dangerPale : C.jaunePale;
  const couleur = type === 'ok' ? C.vertFonce : type === 'erreur' ? C.danger : '#9A6B00';
  return (
    <View accessibilityRole={type === 'erreur' ? 'alert' : undefined} style={[styles.message, { backgroundColor: fond }]}>
      <Text style={[styles.messageTxt, { color: couleur }]}>{texte}</Text>
    </View>
  );
}

// Titre de section (au-dessus d'une carte)
export function TitreSection({ texte, droite }: { texte: string; droite?: ReactNode }) {
  return (
    <View style={styles.titreSection}>
      <Text style={styles.titreSectionTxt}>{texte}</Text>
      {droite}
    </View>
  );
}

const styles = StyleSheet.create({
  retour: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.carte,
    alignItems: 'center', justifyContent: 'center', ...OMBRE,
  },
  retourPhoto: { backgroundColor: 'rgba(42,29,70,0.45)' },

  carte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 18,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },

  trio: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trioP: { borderRadius: 999 },
  titreKawaiiRang: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titreKawaiiTxt: { fontFamily: F.titre, color: C.violet },
  titreKawaiiSous: { fontFamily: F.t500, fontSize: 13, color: C.texte2 },

  // Bouton candy 3D : vert boba, socle vert foncé (offset plein), texte Fredoka
  btnPrimaire: {
    backgroundColor: C.vert, borderRadius: R.btn + 2, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 5, borderBottomColor: '#6F8F1F',
  },
  btnPrimaireTxt: { fontFamily: F.titre, fontSize: 16.5, color: '#2C380C' },
  btnGhost: { paddingVertical: 10, alignItems: 'center' },
  btnGhostTxt: { fontFamily: F.t700, fontSize: 14.5, color: C.texte2 },

  ligneMenu: { paddingVertical: 15, paddingHorizontal: 2 },
  ligneMenuRang: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ligneMenuTitre: { fontFamily: F.t700, fontSize: 15.5, color: C.texte },
  ligneMenuSousTitre: { fontFamily: F.t400, fontSize: 13, color: C.texte2 },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: C.lavande, borderRadius: R.pill,
    paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipActif: { backgroundColor: C.vertPale, borderColor: C.vert },
  chipPastille: { width: 12, height: 12, borderRadius: 6 },
  chipTxt: { fontFamily: F.t600, fontSize: 14, color: C.texte },
  chipTxtActif: { fontFamily: F.t700, color: C.violetProfond },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperBtn: { backgroundColor: C.lavande, alignItems: 'center', justifyContent: 'center' },
  stepperBtnTxt: { fontFamily: F.t800, fontSize: 19, color: C.violetProfond, lineHeight: 22 },
  stepperNb: { fontFamily: F.t800, fontSize: 17, color: C.texte, minWidth: 22, textAlign: 'center' },

  champLabel: { fontFamily: F.t700, fontSize: 12.5, color: C.texte2 },
  champ: {
    backgroundColor: C.fond, borderRadius: 12, borderWidth: 1.5, borderColor: C.bord,
    paddingVertical: 13, paddingHorizontal: 14,
    fontFamily: F.t600, fontSize: 15.5, color: C.texte,
  },

  message: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  messageTxt: { fontFamily: F.t700, fontSize: 13.5, lineHeight: 19 },

  titreSection: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 6, marginBottom: -4, paddingHorizontal: 4,
  },
  titreSectionTxt: { fontFamily: F.titre, fontSize: 15, color: C.violet },
});
