// === Kit UI Bubble Stop : composants partagés du design clair ===
// Cartes, boutons, lignes de menu, chips, champs… utilisés par tous les écrans.
import { ReactNode } from 'react';
import {
  View, Text, Pressable, TextInput, ActivityIndicator,
  StyleSheet, StyleProp, ViewStyle, TextInputProps,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { C, F, R, OMBRE } from '@/constants/charte';

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
      style={[styles.retour, surPhoto ? styles.retourPhoto : null]}
      hitSlop={8}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M14.5 6 L8.5 12 L14.5 18" stroke={surPhoto ? '#fff' : C.violetProfond} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

// Carte blanche avec ombre douce
export function Carte({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.carte, style]}>{children}</View>;
}

// Bouton principal (vert, plein)
export function BoutonPrimaire({
  titre, onPress, disabled, loading, style,
}: { titre: string; onPress: () => void; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
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
    <Pressable style={[styles.btnGhost, style]} onPress={onPress} hitSlop={6}>
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
      disabled={!onPress}
      style={({ pressed }) => [styles.ligneMenu, separateur && styles.ligneMenuSep, pressed && onPress ? { backgroundColor: C.fond } : null]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.ligneMenuTitre, danger && { color: C.danger }]}>{titre}</Text>
        {!!sousTitre && <Text style={styles.ligneMenuSousTitre}>{sousTitre}</Text>}
      </View>
      {droite ?? (onPress ? <Chevron /> : null)}
    </Pressable>
  );
}

// Chip de sélection (formats, sucre, créneaux…) — pastille de couleur optionnelle
export function Chip({
  label, actif, onPress, disabled, pastille,
}: { label: string; actif?: boolean; onPress?: () => void; disabled?: boolean; pastille?: string }) {
  return (
    <Pressable
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
      <Pressable style={[styles.stepperBtn, { width: t, height: t, borderRadius: t / 2 }]} onPress={onMoins} hitSlop={4}>
        <Text style={styles.stepperBtnTxt}>−</Text>
      </Pressable>
      <Text style={[styles.stepperNb, petit && { fontSize: 15, minWidth: 18 }]}>{valeur}</Text>
      <Pressable style={[styles.stepperBtn, { width: t, height: t, borderRadius: t / 2 }]} onPress={onPlus} hitSlop={4}>
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
      <TextInput style={styles.champ} placeholderTextColor={C.texte3} {...props} />
    </View>
  );
}

// Message d'état (info / ok / erreur)
export function Message({ texte, type = 'info' }: { texte: string; type?: 'info' | 'ok' | 'erreur' }) {
  const fond = type === 'ok' ? C.vertPale : type === 'erreur' ? C.dangerPale : C.jaunePale;
  const couleur = type === 'ok' ? C.vertFonce : type === 'erreur' ? C.danger : '#9A6B00';
  return (
    <View style={[styles.message, { backgroundColor: fond }]}>
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

  carte: { backgroundColor: C.carte, borderRadius: R.carte, padding: 18, ...OMBRE },

  btnPrimaire: {
    backgroundColor: C.vert, borderRadius: R.btn + 2, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  btnPrimaireTxt: { fontFamily: F.t800, fontSize: 16, color: C.violetProfond },
  btnGhost: { paddingVertical: 10, alignItems: 'center' },
  btnGhostTxt: { fontFamily: F.t700, fontSize: 14.5, color: C.texte2 },

  ligneMenu: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 15, paddingHorizontal: 2,
  },
  ligneMenuSep: { borderBottomWidth: 1, borderBottomColor: C.bord },
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
  titreSectionTxt: { fontFamily: F.titre, fontSize: 17, color: C.violet },
});
