import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { C, F, OMBRE_VIOLETTE, R } from '@/constants/charte';

/** Illustration décorative : elle ne représente ni les lots ni leurs probabilités. */
function PetiteRoue() {
  return (
    <View aria-hidden pointerEvents="none">
      <Svg width={88} height={96} viewBox="0 0 88 96" aria-hidden>
        <Circle cx={44} cy={49} r={40} fill="#fff" />
        <Path d="M44 49L44 13A36 36 0 0 1 80 49Z" fill={C.rose} />
        <Path d="M44 49L80 49A36 36 0 0 1 44 85Z" fill={C.jaune} />
        <Path d="M44 49L44 85A36 36 0 0 1 8 49Z" fill={C.vert} />
        <Path d="M44 49L8 49A36 36 0 0 1 44 13Z" fill="#B6A0DA" />
        <Circle cx={44} cy={49} r={13} fill="#fff" />
        <Circle cx={40} cy={47} r={2} fill={C.violetProfond} />
        <Circle cx={48} cy={47} r={2} fill={C.violetProfond} />
        <Path d="M40 53Q44 57 48 53" fill="none" stroke={C.violetProfond} strokeWidth={2} strokeLinecap="round" />
        <Path d="M36 3H52L44 19Z" fill={C.jaune} />
      </Svg>
    </View>
  );
}

export default function CarteRoueAccueil({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.carte, pressed && s.presse]}
      accessibilityRole="button"
      accessibilityLabel="La Roue du Mois : un tour gratuit par mois. Ouvrir ma roue"
      accessibilityHint="Consulte ton tour et tes lots du mois.">
      <Text style={s.badge}>TON RENDEZ-VOUS DU MOIS</Text>
      <View style={s.ligne}>
        <View style={s.textes}>
          <Text style={s.titre}>La Roue{ '\n' }du Mois</Text>
          <Text style={s.sousTitre}>1 tour gratuit par mois,{ '\n' }des lots à savourer en boutique.</Text>
        </View>
        <PetiteRoue />
      </View>
      <View style={s.bouton}><Text style={s.boutonTexte}>Ouvrir ma roue →</Text></View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  carte: { backgroundColor: C.violet, borderRadius: R.carte, padding: 20, gap: 14,
    borderWidth: 2, borderColor: C.jaune, ...OMBRE_VIOLETTE },
  presse: { opacity: 0.88 },
  badge: { color: C.jaune, fontFamily: F.t800, fontSize: 11, letterSpacing: 1 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  textes: { flex: 1, minWidth: 0 },
  titre: { fontFamily: F.titre, fontSize: 29, lineHeight: 32, color: '#fff' },
  sousTitre: { fontFamily: F.t500, fontSize: 14, lineHeight: 19, color: '#fff', marginTop: 8 },
  bouton: { minHeight: 48, borderRadius: R.btn, backgroundColor: C.jaune,
    justifyContent: 'center', alignItems: 'center', padding: 12 },
  boutonTexte: { fontFamily: F.t800, fontSize: 16, color: C.violetProfond, textAlign: 'center' },
});
