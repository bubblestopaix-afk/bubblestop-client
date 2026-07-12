// === Boba Quest — machine à capsules (gacha) ===
// On échange ses perles (ou une capsule gratuite lootée en jeu) contre une
// capsule : la machine tremble, la capsule tombe, et on découvre le collectible.
import { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { C, F, R, OMBRE } from '@/constants/charte';
import PastilleCollectible from '@/components/jeu/collectibles';
import {
  CAPSULES, Collectible, PITY_EPIQUE, PITY_LEGENDAIRE, RARETES, SETS, TypeCapsule,
} from '@/components/jeu/economie';
import { Icone, IconeEmoji, IconeNom } from '@/components/jeu/icones';
import {
  BandeauPreview, BoutonJeu, ChipRarete, EnTeteJeu, formatNb, IconePerle,
} from '@/components/jeu/ui-jeu';
import { ouvrirCapsule, pityRestant, useBobaQuest } from '@/store/jeu';

const VIOLET = '#4c2d77';

type Resultat = {
  collectible: Collectible; doublon: boolean; perlesRendues: number;
  type: TypeCapsule; premiere: boolean;
};

export default function CapsulesScreen() {
  const insets = useSafeAreaInsets();
  const etat = useBobaQuest();

  const [enCours, setEnCours] = useState<TypeCapsule | null>(null);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const wobble = useRef(new Animated.Value(0)).current;
  const chute = useRef(new Animated.Value(0)).current;

  const lancer = (type: TypeCapsule, gratuite: boolean) => {
    if (enCours) return;
    const premiere = etat.capsulesOuvertes === 0;
    const res = ouvrirCapsule(type, gratuite);
    if (!res) return;
    setEnCours(type);
    chute.setValue(0);
    Animated.sequence([
      Animated.loop(
        Animated.sequence([
          Animated.timing(wobble, { toValue: 1, duration: 70, useNativeDriver: true }),
          Animated.timing(wobble, { toValue: -1, duration: 70, useNativeDriver: true }),
        ]),
        { iterations: 4 },
      ),
      Animated.timing(wobble, { toValue: 0, duration: 60, useNativeDriver: true }),
      Animated.timing(chute, { toValue: 1, duration: 650, easing: Easing.bounce, useNativeDriver: true }),
    ]).start(() => {
      setResultat({ ...res, type, premiere });
      setEnCours(null);
    });
  };

  const encorePossible = (type: TypeCapsule) =>
    etat.perles >= CAPSULES[type].cout ||
    (type === 'classique' ? etat.capsulesGratuites > 0 : etat.capsulesDoreesGratuites > 0);

  const ouvrirEncore = () => {
    if (!resultat) return;
    const type = resultat.type;
    const gratuite = type === 'classique' ? etat.capsulesGratuites > 0 : etat.capsulesDoreesGratuites > 0;
    setResultat(null);
    setTimeout(() => lancer(type, gratuite), 120);
  };

  const voirCollection = () => {
    setResultat(null);
    router.push('/jeu/collection' as any);
  };

  return (
    <View style={[styles.fond, { paddingTop: insets.top + 10 }]}>
      <View style={{ paddingHorizontal: 18 }}>
        <EnTeteJeu titre="Capsules" onRetour={() => router.back()} perles={etat.perles} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu}>
        {/* === La machine === */}
        <View style={styles.machineCarte}>
          <Animated.View style={{
            transform: [{ rotate: wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-3deg', '3deg'] }) }],
          }}>
            <Machine />
          </Animated.View>
          {/* capsule qui tombe */}
          <Animated.View
            pointerEvents="none"
            style={[styles.capsuleTombee, {
              opacity: chute.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, 1, 1] }),
              transform: [
                { translateY: chute.interpolate({ inputRange: [0, 1], outputRange: [-26, 34] }) },
                { rotate: chute.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '38deg'] }) },
              ],
            }]}
          >
            <Svg width={44} height={44} viewBox="0 0 24 24">
              <Path d="M4 12 A8 8 0 0 1 20 12 Z" fill="#fff" stroke={VIOLET} strokeWidth={1.4} strokeLinejoin="round" />
              <Path d="M4 12 A8 8 0 0 0 20 12 Z" fill={enCours === 'doree' ? '#f2da33' : '#f3a0bd'} stroke={VIOLET} strokeWidth={1.4} strokeLinejoin="round" />
              <Circle cx={9} cy={8.6} r={1.6} fill="#e9ddf6" />
            </Svg>
          </Animated.View>
          <Text style={styles.machineTexte}>
            {enCours ? 'La machine réfléchit…' : 'Tente ta chance, complète ta collection !'}
          </Text>
        </View>

        {/* === 🎁 Garanties (pity) : la malchance est bornée === */}
        <View style={styles.pityCarte}>
          <BarrePity
            nom="etoile" titre="Épique garanti"
            restant={pityRestant(etat).epique} total={PITY_EPIQUE}
            couleur="#C99012" fond="#fdf3c2"
          />
          <BarrePity
            nom="couronne" titre="Légendaire garanti"
            restant={pityRestant(etat).legendaire} total={PITY_LEGENDAIRE}
            couleur="#D2588A" fond="#fbe4ee"
          />
          <Text style={styles.pityAide}>
            Chaque capsule ouverte te rapproche d'un drop garanti — la garantie
            tombe même en cas de malchance.
          </Text>
        </View>

        {/* === Les deux capsules === */}
        {(['classique', 'doree'] as TypeCapsule[]).map((type) => {
          const conf = CAPSULES[type];
          const gratuites = type === 'classique' ? etat.capsulesGratuites : etat.capsulesDoreesGratuites;
          const peutPayer = etat.perles >= conf.cout;
          return (
            <View key={type} style={[styles.offre, type === 'doree' && styles.offreDoree]}>
              <View style={styles.offreHaut}>
                <Svg width={42} height={42} viewBox="0 0 24 24">
                  <Path d="M4 12 A8 8 0 0 1 20 12 Z" fill="#fff" stroke={VIOLET} strokeWidth={1.4} strokeLinejoin="round" />
                  <Path d="M4 12 A8 8 0 0 0 20 12 Z" fill={type === 'doree' ? '#f2da33' : '#f3a0bd'} stroke={VIOLET} strokeWidth={1.4} strokeLinejoin="round" />
                  <Circle cx={9} cy={8.6} r={1.6} fill="#e9ddf6" />
                </Svg>
                <View style={{ flex: 1 }}>
                  <Text style={styles.offreTitre}>{conf.nom}</Text>
                  <Text style={styles.offreOdds}>
                    {type === 'classique'
                      ? '62 % commun · 26 % rare · 9 % épique · 3 % légendaire'
                      : '60 % rare · 30 % épique · 10 % LÉGENDAIRE'}
                  </Text>
                </View>
              </View>
              {gratuites > 0 && (
                <BoutonJeu
                  titre={`Ouvrir — ${gratuites} gratuite${gratuites > 1 ? 's' : ''}`}
                  onPress={() => lancer(type, true)}
                  disabled={!!enCours}
                />
              )}
              <Pressable
                style={[styles.btnAchat, (!peutPayer || !!enCours) && { opacity: 0.45 }]}
                onPress={() => lancer(type, false)}
                disabled={!peutPayer || !!enCours}
                accessibilityRole="button"
                accessibilityLabel={`Ouvrir ${conf.nom} pour ${formatNb(conf.cout)} perles`}
                accessibilityState={{ disabled: !peutPayer || Boolean(enCours) }}
              >
                <Text style={styles.btnAchatTxt}>Ouvrir</Text>
                <View style={styles.btnAchatCout}>
                  <IconePerle taille={15} />
                  <Text style={styles.btnAchatCoutTxt}>{formatNb(conf.cout)}</Text>
                </View>
              </Pressable>
            </View>
          );
        })}

        <Text style={styles.astuce}>
          Les perles se gagnent en jouant à Perle Rush — et les perles dorées
          du plateau contiennent des capsules gratuites. Les doublons sont
          convertis en perles automatiquement.
        </Text>
        <BandeauPreview />
      </ScrollView>

      {/* === Révélation === */}
      <Modal visible={!!resultat} transparent animationType="fade" onRequestClose={() => setResultat(null)}>
        {resultat && (() => {
          const type = resultat.type;
          const gratuite = type === 'classique' ? etat.capsulesGratuites > 0 : etat.capsulesDoreesGratuites > 0;
          const cout = CAPSULES[type].cout;
          return (
            <View style={styles.modalFond} accessibilityViewIsModal>
              <Reveal resultat={resultat} />
              <View style={{ gap: 10, alignSelf: 'stretch', paddingHorizontal: 30 }}>
                {resultat.premiere && !resultat.doublon && (
                  <BoutonJeu
                    titre="Voir dans ma collection"
                    onPress={voirCollection}
                    accessibilityHint="Ouvre ta collection sur le personnage obtenu"
                  />
                )}
                {encorePossible(type) && (
                  <Pressable
                    style={styles.encoreBtn}
                    onPress={ouvrirEncore}
                    accessibilityRole="button"
                    accessibilityLabel="Ouvrir une autre capsule"
                  >
                    <Text style={styles.encoreBtnTxt}>Ouvrir une autre</Text>
                    {gratuite ? (
                      <View style={styles.encoreGratuit}><Text style={styles.encoreGratuitTxt}>gratuite</Text></View>
                    ) : (
                      <View style={styles.encoreCout}>
                        <IconePerle taille={14} />
                        <Text style={styles.encoreCoutTxt}>{formatNb(cout)}</Text>
                      </View>
                    )}
                  </Pressable>
                )}
                {!gratuite && <Text style={styles.encoreNote}>Chaque ouverture coûte {formatNb(cout)} perles</Text>}
                <Pressable
                  onPress={() => setResultat(null)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Fermer le résultat"
                >
                  <Text style={styles.fermerTxt}>Fermer</Text>
                </Pressable>
              </View>
            </View>
          );
        })()}
      </Modal>
    </View>
  );
}

// Barre de progression « pity » : combien de capsules avant le drop garanti
function BarrePity({ nom, titre, restant, total, couleur, fond }: {
  nom: IconeNom; titre: string; restant: number; total: number; couleur: string; fond: string;
}) {
  const faites = total - restant;
  const pct = Math.max(0, Math.min(100, (faites / total) * 100));
  const proche = restant <= 3;
  return (
    <View style={{ gap: 5 }}>
      <View style={styles.pityHaut}>
        <View style={styles.pityTitreRang}><Icone nom={nom} taille={15} /><Text style={styles.pityTitre}>{titre}</Text></View>
        <Text style={[styles.pityRestant, proche && { color: couleur }]}>
          {restant === 0 ? 'PROCHAINE GARANTIE !' : `encore ${restant}`}
        </Text>
      </View>
      <View style={[styles.pityBarre, { backgroundColor: fond }]}>
        <View style={[styles.pityRempli, { width: `${pct}%`, backgroundColor: couleur }]} />
      </View>
    </View>
  );
}

// Carte de révélation du collectible (rayons + rareté + phrase)
function Reveal({ resultat }: { resultat: Resultat }) {
  const { collectible, doublon, perlesRendues } = resultat;
  const set = SETS[collectible.set];
  const rarete = RARETES[collectible.rarete];
  const zoom = useRef(new Animated.Value(0)).current;
  const rayons = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(zoom, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
    const boucle = Animated.loop(
      Animated.timing(rayons, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }),
    );
    boucle.start();
    return () => boucle.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const legendaire = collectible.rarete === 'legendaire';
  return (
    <Animated.View style={[styles.reveal, { transform: [{ scale: zoom }] }, legendaire && styles.revealLegendaire]}>
      <View style={styles.rayonsBoite} pointerEvents="none">
        <Animated.View style={{
          transform: [{ rotate: rayons.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
        }}>
          <Svg width={280} height={280} viewBox="0 0 100 100">
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (i * 30 * Math.PI) / 180;
              return (
                <Line
                  key={i} x1={50} y1={50}
                  x2={50 + Math.cos(a) * 55} y2={50 + Math.sin(a) * 55}
                  stroke={legendaire ? '#F3A0BD' : '#E7E1F2'} strokeWidth={7} strokeLinecap="round" opacity={0.35}
                />
              );
            })}
          </Svg>
        </Animated.View>
      </View>
      <Text style={styles.revealNouveau}>
        {doublon ? 'DOUBLON' : legendaire ? '✦ LÉGENDAIRE ✦' : 'NOUVEAU !'}
      </Text>
      <PastilleCollectible id={collectible.id} taille={130} />
      <Text style={styles.revealNom}>{collectible.nom}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <ChipRarete nom={rarete.nom} couleur={rarete.couleur} />
        <View style={[styles.chipSet, { backgroundColor: set.fond }]}>
          <IconeEmoji emoji={set.emoji} taille={14} />
          <Text style={[styles.chipSetTxt, { color: set.couleur }]}>{set.nom}</Text>
        </View>
      </View>
      <Text style={styles.revealPhrase}>« {collectible.phrase} »</Text>
      {doublon && (
        <View style={styles.doublon}>
          <IconePerle taille={16} />
          <Text style={styles.doublonTxt}>Déjà dans ta collec' → +{formatNb(perlesRendues)} perles</Text>
        </View>
      )}
    </Animated.View>
  );
}

// La machine gachapon dessinée main
function Machine() {
  return (
    <Svg width={190} height={210} viewBox="0 0 100 110">
      {/* globe */}
      <Circle cx={50} cy={38} r={33} fill="#fff" stroke={VIOLET} strokeWidth={2.2} />
      <Path d="M26 22 Q34 12 46 10" stroke="#E7E1F2" strokeWidth={4} strokeLinecap="round" fill="none" />
      {/* perles dedans */}
      <Circle cx={38} cy={48} r={7.5} fill="#8A68B8" />
      <Circle cx={53} cy={52} r={7.5} fill="#A3C724" />
      <Circle cx={66} cy={47} r={7.5} fill="#FFD166" />
      <Circle cx={45} cy={36} r={7.5} fill="#F3A0BD" />
      <Circle cx={60} cy={33} r={7.5} fill="#7EC8E3" />
      <Circle cx={36} cy={33} r={1.9} fill="#fff" opacity={0.6} />
      <Circle cx={51} cy={49} r={1.9} fill="#fff" opacity={0.6} />
      {/* corps */}
      <Path d="M20 68 L80 68 L76 104 Q76 107 73 107 L27 107 Q24 107 24 104 Z" fill="#54418A" stroke={VIOLET} strokeWidth={2.2} strokeLinejoin="round" />
      <Rect x={39} y={84} width={22} height={13} rx={3.5} fill="#2A1D46" stroke={VIOLET} strokeWidth={1.6} />
      {/* molette */}
      <Circle cx={30} cy={78} r={6.5} fill="#FFD166" stroke={VIOLET} strokeWidth={1.8} />
      <Line x1={30} y1={73.5} x2={30} y2={82.5} stroke={VIOLET} strokeWidth={1.8} strokeLinecap="round" />
      {/* petit visage kawaii sur le corps */}
      <Circle cx={62} cy={77} r={1.3} fill="#fff" />
      <Circle cx={70} cy={77} r={1.3} fill="#fff" />
      <Path d="M63.5 80.5 Q66 82.5 68.5 80.5" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  contenu: { padding: 18, gap: 14, paddingBottom: 34 },

  machineCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 18,
    alignItems: 'center', gap: 4, ...OMBRE,
  },
  capsuleTombee: { position: 'absolute', bottom: 46 },
  machineTexte: { fontFamily: F.t600, fontSize: 13, color: C.texte2, marginTop: 8 },

  pityCarte: { backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 12, ...OMBRE },
  pityHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pityTitreRang: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pityTitre: { fontFamily: F.t800, fontSize: 13.5, color: C.texte },
  pityRestant: { fontFamily: F.t700, fontSize: 12.5, color: C.texte2 },
  pityBarre: { height: 9, borderRadius: 5, overflow: 'hidden' },
  pityRempli: { height: 9, borderRadius: 5 },
  pityAide: { fontFamily: F.t600, fontSize: 11.5, color: C.texte3, lineHeight: 16 },

  offre: { backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 12, ...OMBRE },
  offreDoree: { borderWidth: 2, borderColor: C.jaune },
  offreHaut: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  offreTitre: { fontFamily: F.t800, fontSize: 16.5, color: C.texte },
  offreOdds: { fontFamily: F.t600, fontSize: 12, color: C.texte2, marginTop: 2 },

  btnAchat: {
    backgroundColor: C.vert, borderRadius: R.btn + 2, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  btnAchatTxt: { fontFamily: F.t800, fontSize: 15.5, color: C.violetProfond },
  btnAchatCout: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: R.pill,
    paddingVertical: 4, paddingHorizontal: 10,
  },
  btnAchatCoutTxt: { fontFamily: F.t800, fontSize: 13.5, color: C.violetProfond },

  astuce: { fontFamily: F.t600, fontSize: 12.5, color: C.texte2, lineHeight: 18, textAlign: 'center' },

  modalFond: {
    flex: 1, backgroundColor: 'rgba(42,29,70,0.72)',
    alignItems: 'center', justifyContent: 'center', gap: 18,
  },
  reveal: {
    backgroundColor: C.carte, borderRadius: 26, padding: 24, marginHorizontal: 30,
    alignItems: 'center', gap: 10, alignSelf: 'stretch', overflow: 'hidden', ...OMBRE,
  },
  revealLegendaire: { borderWidth: 3, borderColor: '#F3A0BD' },
  rayonsBoite: {
    ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', top: -20,
  },
  revealNouveau: { fontFamily: F.titre, fontSize: 16, color: C.vertFonce, letterSpacing: 1 },
  revealNom: { fontFamily: F.titre, fontSize: 24, color: C.violet },
  chipSet: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 10 },
  chipSetTxt: { fontFamily: F.t700, fontSize: 12 },
  revealPhrase: { fontFamily: F.t400, fontSize: 13.5, color: C.texte2, textAlign: 'center', fontStyle: 'italic', lineHeight: 19 },
  doublon: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: C.jaunePale, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12,
  },
  doublonTxt: { fontFamily: F.t700, fontSize: 13, color: '#9A6B00' },
  fermerTxt: { fontFamily: F.t700, fontSize: 14.5, color: C.lavande, textAlign: 'center', padding: 8 },
  encoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.violet, borderRadius: R.btn + 2, paddingVertical: 15,
  },
  encoreBtnTxt: { fontFamily: F.t800, fontSize: 15.5, color: '#fff' },
  encoreCout: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 10,
  },
  encoreCoutTxt: { fontFamily: F.t800, fontSize: 13.5, color: C.violetProfond },
  encoreGratuit: { backgroundColor: C.vert, borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 11 },
  encoreGratuitTxt: { fontFamily: F.t800, fontSize: 12.5, color: C.violetProfond },
  encoreNote: { fontFamily: F.t600, fontSize: 11.5, color: C.lavande, textAlign: 'center', marginTop: -2 },
});
