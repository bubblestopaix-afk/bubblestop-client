// === Boba Quest — la Roulette du mois ===
// Un tour GRATUIT par mois, toujours gagnant : tampons, perles, réduction,
// capsule dorée… jusqu'à la grande boisson offerte. Crée le rendez-vous mensuel.
import { useRef, useState } from 'react';
import {
  Animated, Easing, Modal, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg';

import { BORD, C, F, OMBRE, OMBRE_VIOLETTE, R } from '@/constants/charte';
import { Etincelle } from '@/components/ui-kit';
import { ROULETTE, SegmentRoulette } from '@/components/jeu/economie';
import { Icone } from '@/components/jeu/icones';
import { BandeauPreview, BoutonJeu, EnTeteJeu } from '@/components/jeu/ui-jeu';
import { hapticSucces } from '@/lib/juice';
import { appliquerRoulette, rouletteDispo, tournerRoulette, useBobaQuest } from '@/store/jeu';

const TAILLE = 310;
const RAYON_ROUE = 150;
// texte sombre sur les segments clairs
const TEXTE_SOMBRE = new Set(['reduc-10', 'tampon-1', 'capsule-doree']);

export default function RouletteScreen() {
  const insets = useSafeAreaInsets();
  const etat = useBobaQuest();
  const dispo = rouletteDispo(etat);

  const rotation = useRef(new Animated.Value(0)).current;
  const [enCours, setEnCours] = useState(false);
  const [gain, setGain] = useState<SegmentRoulette | null>(null);

  const lancer = () => {
    if (!dispo || enCours) return;
    const seg = tournerRoulette();
    if (!seg) return;
    setEnCours(true);
    const index = ROULETTE.findIndex((s) => s.id === seg.id);
    const centre = index * 45 + 22.5;             // angle du centre du segment (depuis le haut, horaire)
    const cible = 5 * 360 + ((360 - centre) % 360); // amener ce centre sous la flèche
    rotation.setValue(0);
    Animated.timing(rotation, {
      toValue: cible,
      duration: 4200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      appliquerRoulette(seg);
      setGain(seg);
      setEnCours(false);
      hapticSucces();
    });
  };

  // prochain mois (affiché quand la roue est déjà jouée)
  const maintenant = new Date();
  const prochain = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 1)
    .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  return (
    <View style={[styles.fond, { paddingTop: insets.top + 10 }]}>
      <View style={{ paddingHorizontal: 18 }}>
        <EnTeteJeu titre="Roulette du mois" onRetour={() => router.back()} perles={etat.perles} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.pitch}>
          Un tour gratuit chaque mois — et tu gagnes à tous les coups
        </Text>

        {/* === La roue (écrin violet immersif, DA kawaii) === */}
        <View style={styles.roueCarte}>
          <Etincelle taille={14} style={{ position: 'absolute', top: 16, left: 16 }} />
          <Etincelle taille={9} couleur="#CBB6E8" style={{ position: 'absolute', bottom: 26, right: 18 }} />
          <View style={styles.rouePill}><Text style={styles.rouePillTxt}>Toujours gagnante · 1 tour / mois</Text></View>
          <View style={styles.roueZone}>
          {/* flèche */}
          <View style={styles.fleche}>
            <Svg width={34} height={26} viewBox="0 0 34 26">
              <Path d="M17 26 L4 4 Q17 -2 30 4 Z" fill="#fff" stroke="#fff" strokeWidth={2.4} />
            </Svg>
          </View>
          <Animated.View
            style={[
              !dispo && !enCours && !gain ? { opacity: 0.55 } : null,
              { transform: [{ rotate: rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }] },
            ]}
          >
            <Roue />
          </Animated.View>
          </View>
          <Text style={styles.roueNote}>
            {dispo ? "Ton tour gratuit t'attend" : 'Reviens le 1er du mois pour ton tour gratuit'}
          </Text>
        </View>

        {dispo ? (
          <BoutonJeu
            titre={enCours ? 'La roue tourne…' : 'Lancer ma roue du mois !'}
            onPress={lancer}
            disabled={enCours}
          />
        ) : (
          <View style={styles.dejaCarte}>
            <View style={styles.dejaTitreRang}>
              <Icone nom="check" taille={16} />
              <Text style={styles.dejaTitre}>Roue du mois déjà jouée</Text>
            </View>
            {!!etat.dernierGainRoulette && (
              <Text style={styles.dejaGain}>Dernier gain : {etat.dernierGainRoulette}</Text>
            )}
            <Text style={styles.dejaProchain}>Reviens le {prochain} pour ton prochain tour</Text>
          </View>
        )}

        <Text style={styles.legende}>
          Gains possibles : tampons de fidélité, perles, −10 %, capsule dorée…
          et la grande boisson offerte pour les plus chanceux.
        </Text>
        <BandeauPreview />
      </ScrollView>

      {/* === Gain === */}
      <Modal visible={!!gain} transparent animationType="fade" onRequestClose={() => setGain(null)}>
        {gain && (
          <View style={styles.modalFond}>
            <View style={styles.gainCarte}>
              <Icone nom="cadeau" taille={46} />
              <Text style={styles.gainTitre}>Tu as gagné !</Text>
              <View style={[styles.gainPill, { backgroundColor: gain.couleur }]}>
                <Text style={[styles.gainPillTxt, TEXTE_SOMBRE.has(gain.id) && { color: '#2A1D46' }]}>
                  {gain.label}
                </Text>
              </View>
              <Text style={styles.gainAide}>
                {gain.type === 'perles'
                  ? 'Tes perles ont été créditées direct'
                  : gain.type === 'capsule_doree'
                    ? 'Ta capsule dorée t\'attend dans l\'écran Capsules !'
                    : 'Retrouve ton prix dans « Boutique des prix → Mes prix ».'}
              </Text>
              <BoutonJeu titre="Super !" onPress={() => setGain(null)} style={{ alignSelf: 'stretch' }} />
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

// La roue SVG : 8 segments de 45°, labels tournés vers l'extérieur
function Roue() {
  const cx = TAILLE / 2, cy = TAILLE / 2;
  const pt = (angleDeg: number, r: number) => {
    const a = (angleDeg * Math.PI) / 180;
    return { x: cx + Math.sin(a) * r, y: cy - Math.cos(a) * r };
  };
  return (
    <Svg width={TAILLE} height={TAILLE} viewBox={`0 0 ${TAILLE} ${TAILLE}`}>
      <Circle cx={cx} cy={cy} r={RAYON_ROUE + 10} fill="#FFFFFF" />
      {ROULETTE.map((seg, i) => {
        const a0 = i * 45, a1 = (i + 1) * 45, centre = i * 45 + 22.5;
        const p0 = pt(a0, RAYON_ROUE), p1 = pt(a1, RAYON_ROUE);
        const pTxt = pt(centre, RAYON_ROUE * 0.66);
        const sombre = TEXTE_SOMBRE.has(seg.id);
        return (
          <G key={seg.id}>
            <Path
              d={`M${cx} ${cy} L${p0.x} ${p0.y} A${RAYON_ROUE} ${RAYON_ROUE} 0 0 1 ${p1.x} ${p1.y} Z`}
              fill={seg.couleur} stroke="#fff" strokeWidth={2}
            />
            <SvgText
              x={pTxt.x} y={pTxt.y}
              fill={sombre ? '#2A1D46' : '#fff'}
              fontSize={12.5} fontWeight="bold" textAnchor="middle"
              transform={`rotate(${centre} ${pTxt.x} ${pTxt.y})`}
            >
              {seg.label}
            </SvgText>
          </G>
        );
      })}
      {/* moyeu cerclé de jaune perle */}
      <Circle cx={cx} cy={cy} r={26} fill="#fff" stroke={C.jaune} strokeWidth={5} />
      <Circle cx={cx} cy={cy} r={12} fill="#4c2d77" />
      <Circle cx={cx - 4} cy={cy - 4} r={3.4} fill="#fff" opacity={0.5} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  contenu: { padding: 18, gap: 16, paddingBottom: 34, alignItems: 'stretch' },
  pitch: { fontFamily: F.t700, fontSize: 14.5, color: C.texte2, textAlign: 'center' },

  roueCarte: {
    backgroundColor: C.violet, borderRadius: R.carte, paddingVertical: 18,
    gap: 12, overflow: 'hidden', ...OMBRE_VIOLETTE,
  },
  rouePill: {
    alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', borderRadius: R.pill,
    paddingVertical: 6, paddingHorizontal: 16,
  },
  rouePillTxt: { fontFamily: F.titre, fontSize: 13.5, color: '#fff' },
  roueNote: { fontFamily: F.t600, fontSize: 12.5, color: C.surViolet, textAlign: 'center' },
  roueZone: { alignItems: 'center', paddingTop: 2 },
  fleche: { zIndex: 3, marginBottom: -13 },

  dejaCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 18,
    alignItems: 'center', gap: 6,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  dejaTitre: { fontFamily: F.titre, fontSize: 15.5, color: C.violet },
  dejaTitreRang: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dejaGain: { fontFamily: F.t700, fontSize: 13.5, color: C.vertFonce },
  dejaProchain: { fontFamily: F.t600, fontSize: 13, color: C.texte2 },

  legende: { fontFamily: F.t600, fontSize: 12.5, color: C.texte3, textAlign: 'center', lineHeight: 18 },

  modalFond: {
    flex: 1, backgroundColor: 'rgba(42,29,70,0.65)',
    alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  gainCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 24,
    alignItems: 'center', gap: 12, alignSelf: 'stretch',
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  gainTitre: { fontFamily: F.titre, fontSize: 24, color: C.violet },
  gainPill: { borderRadius: R.pill, paddingVertical: 10, paddingHorizontal: 18 },
  gainPillTxt: { fontFamily: F.t800, fontSize: 16, color: '#fff' },
  gainAide: { fontFamily: F.t400, fontSize: 13.5, color: C.texte2, textAlign: 'center', lineHeight: 19 },
});
