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

import { BORD, C, F, OMBRE, OMBRE_VIOLETTE, R } from '@/constants/charte';
import { Etincelle } from '@/components/ui-kit';
import { hapticLeger, hapticLourd, hapticMoyen, hapticSucces } from '@/lib/juice';
import PastilleCollectible from '@/components/jeu/collectibles';
import {
  CAPSULES, Collectible, PITY_EPIQUE, PITY_LEGENDAIRE, Rarete, RARETES, SETS, TypeCapsule,
} from '@/components/jeu/economie';
import { Icone, IconeEmoji, IconeNom } from '@/components/jeu/icones';
import {
  Confettis, BandeauPreview, BoutonJeu, ChipRarete, EnTeteJeu, formatNb, IconePerle, useCountUp,
} from '@/components/jeu/ui-jeu';
import { ouvrirCapsule, pityRestant, useBobaQuest } from '@/store/jeu';

const VIOLET = '#4c2d77';

// ⏱️ Suspense de la cérémonie, dosé par la rareté (la fissure monte avec l'enjeu)
const SUSPENSE_MS: Record<Rarete, number> = { commun: 620, rare: 800, epique: 1100, legendaire: 1500 };

// 🩹 26/07 — les taux annoncés étaient des LITTÉRAUX ('62 % commun · 26 % rare · …') :
// exacts aujourd'hui, faux au prochain rééquilibrage — et un gacha qui mentirait sur ses
// taux, même par oubli, est un problème sérieux. On les DÉRIVE de CAPSULES[type].poids,
// normalisés comme le fait `tirerCapsule` : l'affichage ne peut plus diverger du tirage.
// Les raretés à poids 0 sont omises (la Dorée ne donne aucun commun) et le légendaire de
// la Dorée reste mis en avant, comme avant.
const ORDRE_RARETES: Rarete[] = ['commun', 'rare', 'epique', 'legendaire'];

function tauxCapsule(type: TypeCapsule): string {
  const poids = CAPSULES[type].poids;
  const total = ORDRE_RARETES.reduce((s, r) => s + poids[r], 0) || 1;
  return ORDRE_RARETES
    .filter((r) => poids[r] > 0)
    .map((r) => {
      const pct = Math.round((poids[r] / total) * 100);
      const nom = RARETES[r].nom;
      const libelle = type === 'doree' && r === 'legendaire'
        ? nom.toLocaleUpperCase('fr-FR')
        : nom.toLocaleLowerCase('fr-FR');
      return `${pct} % ${libelle}`;
    })
    .join(' · ');
}

type Resultat = {
  collectible: Collectible; doublon: boolean; perlesRendues: number;
  type: TypeCapsule; premiere: boolean;
};

export default function CapsulesScreen() {
  const insets = useSafeAreaInsets();
  const etat = useBobaQuest();

  const [enCours, setEnCours] = useState<TypeCapsule | null>(null);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  // 🎊 Cérémonie théâtrale : la file des capsules à révéler une à une (×1 ou ×5)
  const [ceremonie, setCeremonie] = useState<{ file: Resultat[]; acceleree: boolean } | null>(null);
  // 🏁 Récapitulatif final d'une ouverture ×5
  const [recap, setRecap] = useState<Resultat[] | null>(null);
  const wobble = useRef(new Animated.Value(0)).current;
  const chute = useRef(new Animated.Value(0)).current;

  // La machine tremble puis la capsule tombe ; `suite` enchaîne (cérémonie).
  const animerMachine = (suite: () => void) => {
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
    ]).start(suite);
  };

  const lancer = (type: TypeCapsule, gratuite: boolean) => {
    if (enCours || ceremonie) return;
    const premiere = etat.capsulesOuvertes === 0;
    const res = ouvrirCapsule(type, gratuite);
    if (!res) return;
    setEnCours(type);
    animerMachine(() => {
      setEnCours(null);
      setCeremonie({ file: [{ ...res, type, premiere }], acceleree: false });
    });
  };

  // ×5 : 5 capsules GRATUITES si le stock le permet, sinon 5 × le coût en
  // perles (jamais de paiement mixte — la règle est lisible et sans surprise).
  const lancerCinq = (type: TypeCapsule) => {
    if (enCours || ceremonie) return;
    const conf = CAPSULES[type];
    const stock = type === 'classique' ? etat.capsulesGratuites : etat.capsulesDoreesGratuites;
    const gratuites = stock >= 5;
    if (!gratuites && etat.perles < conf.cout * 5) return;
    const premiere = etat.capsulesOuvertes === 0;
    const file: Resultat[] = [];
    for (let i = 0; i < 5; i++) {
      const res = ouvrirCapsule(type, gratuites);
      if (!res) break; // filet de sécurité (impossible en pratique : tout est pré-vérifié)
      file.push({ ...res, type, premiere: premiere && i === 0 });
    }
    if (file.length === 0) return;
    setEnCours(type);
    animerMachine(() => {
      setEnCours(null);
      setCeremonie({ file, acceleree: file.length > 1 });
    });
  };

  // Fin de cérémonie : ×1 → la carte Révélation habituelle ; ×5 → le récap.
  const terminerCeremonie = () => {
    if (!ceremonie) return;
    if (ceremonie.file.length === 1) setResultat(ceremonie.file[0]);
    else setRecap(ceremonie.file);
    setCeremonie(null);
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
        {/* === La machine (maquette 3b : pill gratuites + étincelles) === */}
        <View style={styles.machineCarte}>
          <Etincelle taille={13} style={{ position: 'absolute', top: 26, left: 24, opacity: 0.85 }} />
          <Etincelle taille={10} couleur={C.rose} style={{ position: 'absolute', top: 40, right: 28, opacity: 0.7 }} />
          {etat.capsulesGratuites + etat.capsulesDoreesGratuites > 0 && (
            <View style={styles.gratuitesPill}>
              <Text style={styles.gratuitesPillTxt}>
                {etat.capsulesGratuites + etat.capsulesDoreesGratuites} CAPSULE{etat.capsulesGratuites + etat.capsulesDoreesGratuites > 1 ? 'S' : ''} GRATUITE{etat.capsulesGratuites + etat.capsulesDoreesGratuites > 1 ? 'S' : ''}
              </Text>
            </View>
          )}
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
            <CapsuleSvg taille={44} doree={enCours === 'doree'} />
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
          {/* 🩹 26/07 : « Compteur commun aux deux capsules » était devenu à moitié faux —
              la Dorée fait toujours AVANCER le compteur mais ne le DÉPENSE plus (elle a
              déjà 40 % d'épique-ou-mieux en naturel). On dit désormais exactement ça. */}
          <Text style={styles.pityAide}>
            Toutes les capsules ouvertes font avancer ces compteurs, capsules offertes
            comprises — rien n'est perdu. Seule la {CAPSULES.classique.nom} déclenche la
            garantie : la {CAPSULES.doree.nom} n'en a pas besoin, elle donne déjà{' '}
            {CAPSULES.doree.poids.epique + CAPSULES.doree.poids.legendaire} % d'épique
            ou mieux en naturel.
          </Text>
        </View>

        {/* === Les deux capsules === */}
        {(['classique', 'doree'] as TypeCapsule[]).map((type) => {
          const conf = CAPSULES[type];
          const gratuites = type === 'classique' ? etat.capsulesGratuites : etat.capsulesDoreesGratuites;
          const peutPayer = etat.perles >= conf.cout;
          const coutCinq = conf.cout * 5;
          const cinqGratuites = gratuites >= 5;
          const peutCinq = cinqGratuites || etat.perles >= coutCinq;
          return (
            <View key={type} style={[styles.offre, type === 'doree' && styles.offreDoree]}>
              <View style={styles.offreHaut}>
                <CapsuleSvg taille={42} doree={type === 'doree'} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.offreTitre}>{conf.nom}</Text>
                  {/* 🩹 26/07 : taux dérivés de CAPSULES[type].poids (cf. tauxCapsule) */}
                  <Text style={styles.offreOdds}>{tauxCapsule(type)}</Text>
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
              {/* 🖐 Ouvrir ×5 : 5 d'un coup (gratuites si le stock suffit, sinon
                  5 × le coût — jamais de mélange gratuites + perles) */}
              <Pressable
                style={[styles.btnCinq, (!peutCinq || !!enCours) && { opacity: 0.45 }]}
                onPress={() => lancerCinq(type)}
                disabled={!peutCinq || !!enCours}
                accessibilityRole="button"
                accessibilityLabel={cinqGratuites
                  ? `Ouvrir 5 ${conf.nom} gratuites`
                  : `Ouvrir 5 ${conf.nom} pour ${formatNb(coutCinq)} perles`}
                accessibilityState={{ disabled: !peutCinq || Boolean(enCours) }}
              >
                <Text style={styles.btnCinqTxt}>Ouvrir ×5</Text>
                {cinqGratuites ? (
                  <View style={styles.btnCinqCout}><Text style={styles.btnCinqCoutTxt}>5 gratuites</Text></View>
                ) : (
                  <View style={styles.btnCinqCout}>
                    <IconePerle taille={14} />
                    <Text style={styles.btnCinqCoutTxt}>{formatNb(coutCinq)}</Text>
                  </View>
                )}
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

      {/* === 🎊 Cérémonie théâtrale (suspense → flash → révélation), plein écran === */}
      <Modal visible={!!ceremonie} transparent={false} animationType="fade" onRequestClose={terminerCeremonie}>
        {ceremonie && (
          <Ceremonie file={ceremonie.file} acceleree={ceremonie.acceleree} onTermine={terminerCeremonie} />
        )}
      </Modal>

      {/* === 🏁 Récapitulatif d'une ouverture ×5 === */}
      <Modal visible={!!recap} transparent animationType="fade" onRequestClose={() => setRecap(null)}>
        {recap && (() => {
          const type = recap[0].type;
          const conf = CAPSULES[type];
          const stock = type === 'classique' ? etat.capsulesGratuites : etat.capsulesDoreesGratuites;
          const dispo = stock >= 5 || etat.perles >= conf.cout * 5;
          return (
            <View style={styles.modalFond} accessibilityViewIsModal>
              <RecapCinq
                file={recap}
                onFermer={() => setRecap(null)}
                onCollection={() => { setRecap(null); router.push('/jeu/collection' as any); }}
                onEncore={dispo ? () => { setRecap(null); setTimeout(() => lancerCinq(type), 120); } : null}
                coutCinq={stock >= 5 ? 0 : conf.cout * 5}
              />
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
  // 🩹 26/07 : `restant` ne valait jamais 0 (la garantie tombe à `pity + 1 >= total`,
  // donc le compteur plafonnait à total − 1). La barre culminait à 90 % et l'état
  // « PROCHAINE GARANTIE ! » était du code mort — c'est-à-dire exactement le moment
  // « la machine est chaude » que ce compteur est censé mettre en scène.
  const faites = total - restant;
  const pct = Math.max(0, Math.min(100, (faites / total) * 100));
  const garantie = restant <= 0;
  const proche = restant <= 3;
  return (
    <View style={{ gap: 5 }}>
      <View style={styles.pityHaut}>
        <View style={styles.pityTitreRang}><Icone nom={nom} taille={15} /><Text style={styles.pityTitre}>{titre}</Text></View>
        <Text style={[styles.pityRestant, proche && { color: couleur }]}>
          {garantie ? 'PROCHAINE CAPSULE GARANTIE !' : `encore ${restant}`}
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
              {(resultat.collectible.rarete === 'epique' || resultat.collectible.rarete === 'legendaire') && <Confettis hauteur={320} />}
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

// La capsule gachapon (moitié blanche / moitié couleur du type)
function CapsuleSvg({ taille = 92, doree = false }: { taille?: number; doree?: boolean }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24">
      <Path d="M4 12 A8 8 0 0 1 20 12 Z" fill="#fff" stroke={VIOLET} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M4 12 A8 8 0 0 0 20 12 Z" fill={doree ? '#f2da33' : '#f3a0bd'} stroke={VIOLET} strokeWidth={1.4} strokeLinejoin="round" />
      <Circle cx={9} cy={8.6} r={1.6} fill="#e9ddf6" />
    </Svg>
  );
}

// 🎊 CÉRÉMONIE plein écran : enchaîne les capsules de la file une à une.
// « Passer » (toujours visible) ou le bouton retour → directement au final.
function Ceremonie({ file, acceleree, onTermine }: {
  file: Resultat[]; acceleree: boolean; onTermine: () => void;
}) {
  const [index, setIndex] = useState(0);
  return (
    <View style={styles.ceremonieFond}>
      {/* indicateur de progression (×5) — chaque point passé prend la couleur de sa rareté */}
      {file.length > 1 && (
        <View style={styles.ceremoniePoints}>
          {file.map((r, i) => (
            <View
              key={i}
              style={[
                styles.ceremoniePoint,
                i < index && { backgroundColor: RARETES[r.collectible.rarete].couleur },
                i === index && styles.ceremoniePointActif,
              ]}
            />
          ))}
        </View>
      )}
      <CeremonieItem
        key={index}
        res={file[index]}
        acceleree={acceleree}
        onSuivant={() => {
          if (index + 1 >= file.length) onTermine();
          else setIndex(index + 1);
        }}
      />
      <Pressable
        style={styles.ceremoniePasser}
        onPress={onTermine}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Passer la cérémonie"
      >
        <Text style={styles.ceremoniePasserTxt}>Passer ›</Text>
      </Pressable>
    </View>
  );
}

// UNE capsule de la cérémonie : suspense (capsule qui rebondit, lueur de la
// couleur de rareté, fissures) → flash → matériel (silhouette → couleurs).
function CeremonieItem({ res, acceleree, onSuivant }: {
  res: Resultat; acceleree: boolean; onSuivant: () => void;
}) {
  const rarete = res.collectible.rarete;
  const couleur = RARETES[rarete].couleur;
  const mult = acceleree ? 0.45 : 1;
  const [phase, setPhase] = useState<'suspense' | 'materiel'>('suspense');
  const rebond = useRef(new Animated.Value(0)).current;
  const lueur = useRef(new Animated.Value(0)).current;
  const fissures = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const zoom = useRef(new Animated.Value(0)).current;
  const voile = useRef(new Animated.Value(0.94)).current;
  const badge = useRef(new Animated.Value(0)).current;
  const fonte = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // haptique de suspense proportionnelle à la rareté
    if (rarete === 'legendaire') hapticLourd();
    else if (rarete === 'epique') hapticMoyen();
    else hapticLeger();
    const boucleRebond = Animated.loop(
      Animated.sequence([
        Animated.timing(rebond, { toValue: 1, duration: 170, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(rebond, { toValue: 0, duration: 170, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const boucleLueur = Animated.loop(
      Animated.sequence([
        Animated.timing(lueur, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(lueur, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
    );
    boucleRebond.start();
    boucleLueur.start();
    const dureeSuspense = Math.round(SUSPENSE_MS[rarete] * mult);
    const dureeFlash = Math.max(120, Math.round(250 * mult));
    const dureeMateriel = Math.round((res.doublon ? 1500 : 1150) * mult);
    Animated.timing(fissures, { toValue: 1, duration: dureeSuspense, useNativeDriver: true }).start();
    const t1 = setTimeout(() => {
      boucleRebond.stop();
      boucleLueur.stop();
      // ⚡ flash de la couleur de rareté + haptique de révélation
      if (rarete === 'commun') hapticLeger();
      else if (rarete === 'rare') hapticMoyen();
      else hapticLourd();
      Animated.timing(flash, { toValue: 1, duration: dureeFlash, useNativeDriver: true }).start(() => {
        setPhase('materiel');
        Animated.spring(zoom, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }).start();
        Animated.timing(voile, { toValue: 0, duration: 480, useNativeDriver: true }).start();
        Animated.spring(badge, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }).start();
        if (res.doublon) {
          // le doublon FOND pour laisser place à la pluie de perles
          setTimeout(() => {
            Animated.timing(fonte, { toValue: 1, duration: 520, useNativeDriver: true }).start();
          }, 620);
        }
      });
    }, dureeSuspense);
    const t2 = setTimeout(onSuivant, dureeSuspense + dureeFlash + dureeMateriel);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      boucleRebond.stop();
      boucleLueur.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.ceremonieCentre}>
      {phase === 'suspense' && (
        <View style={styles.ceremonieSuspense}>
          <Animated.View
            pointerEvents="none"
            style={[styles.ceremonieLueur, {
              backgroundColor: couleur,
              opacity: lueur.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.5] }),
              transform: [{ scale: lueur.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.18] }) }],
            }]}
          />
          <Animated.View style={{
            transform: [{ scale: rebond.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.14] }) }],
          }}>
            <CapsuleSvg taille={96} doree={res.type === 'doree'} />
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: fissures }]}>
              <Svg width={96} height={96} viewBox="0 0 24 24">
                <Path d="M12 2 L11.2 7 L12.8 10 L11.6 14" stroke="#fff" strokeWidth={0.9} strokeLinecap="round" fill="none" />
                <Path d="M6 6 L9 10 L8 13" stroke="#fff" strokeWidth={0.8} strokeLinecap="round" fill="none" />
                <Path d="M18 6 L15.2 9.5 L16.4 13" stroke="#fff" strokeWidth={0.8} strokeLinecap="round" fill="none" />
              </Svg>
            </Animated.View>
          </Animated.View>
          <Text style={styles.ceremonieSuspenseTxt}>Qu'est-ce qui va sortir ?…</Text>
        </View>
      )}
      {phase === 'materiel' && (
        <Animated.View style={[styles.ceremonieMateriel, { transform: [{ scale: zoom }] }]}>
          <Animated.View style={{
            opacity: fonte.interpolate({ inputRange: [0, 1], outputRange: [1, 0.1] }),
            transform: [
              { scale: fonte.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }) },
              { translateY: fonte.interpolate({ inputRange: [0, 1], outputRange: [0, 30] }) },
            ],
          }}>
            <View>
              <PastilleCollectible id={res.collectible.id} taille={120} />
              {/* 🎭 voile sombre : silhouette → couleurs quand il se dissipe */}
              <Animated.View pointerEvents="none" style={[styles.ceremonieVoile, { opacity: voile }]} />
            </View>
          </Animated.View>
          <Animated.Text style={[styles.ceremonieNom, {
            opacity: badge,
            transform: [{ scale: badge.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          }]}>
            {res.collectible.nom}
          </Animated.Text>
          <Animated.View style={{ opacity: badge, transform: [{ scale: badge }] }}>
            <Text style={[
              styles.ceremonieBadge,
              res.doublon ? styles.ceremonieBadgeDoublon
                : rarete === 'legendaire' ? styles.ceremonieBadgeLeg
                  : styles.ceremonieBadgeNew,
            ]}>
              {res.doublon ? 'DOUBLON' : rarete === 'legendaire' ? '✦ LÉGENDAIRE ✦' : 'NOUVEAU !'}
            </Text>
          </Animated.View>
          {res.doublon && <ChipRembourse montant={res.perlesRendues} />}
          {res.doublon && <PluiePerles />}
        </Animated.View>
      )}
      {/* ⚡ flash plein écran aux couleurs de la rareté (monte puis retombe) */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, {
          backgroundColor: couleur,
          opacity: flash.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.92, 0] }),
        }]}
      />
    </View>
  );
}

// 💧 Doublon recyclé : 9 perles qui tombent pendant que la pastille fond
function PluiePerles() {
  const pluie = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(pluie, { toValue: 1, duration: 950, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [pluie]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 9 }).map((_, i) => {
        const x = (i * 37 + 13) % 88;
        const d = (i % 4) * 0.12;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute', top: '30%', left: `${x}%`,
              opacity: pluie.interpolate({ inputRange: [d, d + 0.15, 0.9, 1], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' }),
              transform: [{ translateY: pluie.interpolate({ inputRange: [d, 1], outputRange: [-30, 300], extrapolate: 'clamp' }) }],
            }}
          >
            <IconePerle taille={13} />
          </Animated.View>
        );
      })}
    </View>
  );
}

// 🪙 Chip « doublon → perles » : le compteur MONTE de 0 au montant
// (useCountUp n'anime qu'au CHANGEMENT de cible → on passe par un état 0 → montant)
function ChipRembourse({ montant }: { montant: number }) {
  const [cible, setCible] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setCible(montant), 260);
    return () => clearTimeout(t);
  }, [montant]);
  const nb = useCountUp(cible, 750);
  return (
    <View style={styles.rembourse}>
      <IconePerle taille={16} />
      <Text style={styles.rembourseTxt}>Doublon recyclé → +{formatNb(nb)} perles</Text>
    </View>
  );
}

// 🏁 Récapitulatif d'une ouverture ×5 : les 5 cartes, la meilleure mise en avant
function RecapCinq({ file, onFermer, onCollection, onEncore, coutCinq }: {
  file: Resultat[]; onFermer: () => void; onCollection: () => void;
  onEncore: (() => void) | null; coutCinq: number;
}) {
  // meilleure capsule = rareté la plus haute (1ʳᵉ occurrence à égalité)
  let iBest = 0;
  file.forEach((r, i) => {
    if (RARETES[r.collectible.rarete].ordre > RARETES[file[iBest].collectible.rarete].ordre) iBest = i;
  });
  const totalPerles = file.reduce((s, r) => s + r.perlesRendues, 0);
  return (
    <View style={styles.recapCarte}>
      <Text style={styles.recapTitre}>Ouverture ×5</Text>
      <View style={styles.recapRangee}>
        {file.map((r, i) => <CarteRecap key={i} res={r} star={i === iBest} />)}
      </View>
      {totalPerles > 0 && (
        <View style={styles.recapTotal}>
          <IconePerle taille={15} />
          <Text style={styles.recapTotalTxt}>Doublons recyclés → +{formatNb(totalPerles)} perles</Text>
        </View>
      )}
      <View style={styles.recapBoutons}>
        <BoutonJeu titre="Voir la collection" onPress={onCollection} />
        {onEncore && (
          <Pressable
            style={styles.encoreBtn}
            onPress={onEncore}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir 5 autres capsules"
          >
            <Text style={styles.encoreBtnTxt}>Encore ×5</Text>
            {coutCinq === 0 ? (
              <View style={styles.encoreGratuit}><Text style={styles.encoreGratuitTxt}>gratuites</Text></View>
            ) : (
              <View style={styles.encoreCout}>
                <IconePerle taille={14} />
                <Text style={styles.encoreCoutTxt}>{formatNb(coutCinq)}</Text>
              </View>
            )}
          </Pressable>
        )}
        <Pressable
          onPress={onFermer}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Fermer le récapitulatif"
        >
          <Text style={styles.fermerTxt}>Fermer</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Une carte du récap ×5 ; la meilleure pulse avec un halo de sa couleur de rareté
function CarteRecap({ res, star }: { res: Resultat; star: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!star) return undefined;
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    boucle.start();
    return () => boucle.stop();
  }, [pulse, star]);
  const couleur = RARETES[res.collectible.rarete].couleur;
  return (
    <Animated.View style={[styles.recapCase, star && {
      borderColor: couleur,
      shadowColor: couleur,
      shadowOpacity: 0.55,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 0 },
      elevation: 6,
      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1.14] }) }],
    }]}>
      <PastilleCollectible id={res.collectible.id} taille={46} />
      <Text style={styles.recapCaseNom} numberOfLines={1}>{res.collectible.nom}</Text>
      {res.doublon ? (
        <View style={styles.recapCasePerles}>
          <IconePerle taille={10} />
          <Text style={styles.recapCasePerlesTxt}>{formatNb(res.perlesRendues)}</Text>
        </View>
      ) : (
        <Text style={styles.recapCaseNew}>NOUVEAU</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  contenu: { padding: 18, gap: 14, paddingBottom: 34 },

  machineCarte: {
    backgroundColor: C.violet, borderRadius: R.carte, padding: 18,
    alignItems: 'center', gap: 4, overflow: 'hidden', ...OMBRE_VIOLETTE,
  },
  capsuleTombee: { position: 'absolute', bottom: 46 },
  gratuitesPill: {
    backgroundColor: '#EC647B', borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 12,
    borderBottomWidth: 3, borderBottomColor: '#B83A52', marginBottom: 6,
  },
  gratuitesPillTxt: { fontFamily: F.t800, fontSize: 10.5, color: '#fff', letterSpacing: 0.5 },
  machineTexte: { fontFamily: F.t600, fontSize: 13, color: C.surViolet, marginTop: 8 },

  pityCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 12,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  pityHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pityTitreRang: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pityTitre: { fontFamily: F.t800, fontSize: 13.5, color: C.texte },
  pityRestant: { fontFamily: F.t700, fontSize: 12.5, color: C.texte2 },
  pityBarre: { height: 9, borderRadius: 5, overflow: 'hidden' },
  pityRempli: { height: 9, borderRadius: 5 },
  pityAide: { fontFamily: F.t600, fontSize: 11.5, color: C.texte3, lineHeight: 16 },

  offre: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 12,
    borderWidth: BORD.largeur, borderColor: C.violetClair, ...OMBRE,
  },
  offreDoree: { borderColor: C.jaune },
  offreHaut: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  offreTitre: { fontFamily: F.titre, fontSize: 16.5, color: C.violet },
  offreOdds: { fontFamily: F.t600, fontSize: 12, color: C.texte2, marginTop: 2 },

  btnAchat: {
    backgroundColor: C.vert, borderRadius: R.btn + 2, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderBottomWidth: 5, borderBottomColor: '#6F8F1F',
  },
  btnAchatTxt: { fontFamily: F.titre, fontSize: 15.5, color: '#2C380C' },
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
    backgroundColor: C.carte, borderRadius: R.carte, padding: 24, marginHorizontal: 30,
    alignItems: 'center', gap: 10, alignSelf: 'stretch', overflow: 'hidden',
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  revealLegendaire: { borderColor: C.rose },
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
  fermerTxt: {
    fontFamily: F.t700, fontSize: 14.5, color: C.lavande, textAlign: 'center',
    paddingVertical: 8, paddingHorizontal: 22, alignSelf: 'center',
    backgroundColor: 'rgba(42,29,70,0.85)', borderRadius: 999, overflow: 'hidden',
  },
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

  // 🖐 ouverture ×5
  btnCinq: {
    backgroundColor: C.violet, borderRadius: R.btn + 2, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderBottomWidth: 5, borderBottomColor: '#3A2A5E',
  },
  btnCinqTxt: { fontFamily: F.titre, fontSize: 14.5, color: '#fff' },
  btnCinqCout: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: R.pill,
    paddingVertical: 4, paddingHorizontal: 10,
  },
  btnCinqCoutTxt: { fontFamily: F.t800, fontSize: 12.5, color: C.violetProfond },

  // 🎊 cérémonie théâtrale (plein écran)
  ceremonieFond: { flex: 1, backgroundColor: '#2A1D46', alignItems: 'center', justifyContent: 'center' },
  ceremonieCentre: { alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', flex: 1 },
  ceremonieSuspense: { alignItems: 'center', justifyContent: 'center', gap: 26 },
  ceremonieLueur: { position: 'absolute', width: 210, height: 210, borderRadius: 105 },
  ceremonieSuspenseTxt: { fontFamily: F.t600, fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  ceremonieMateriel: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  ceremonieVoile: { ...StyleSheet.absoluteFillObject, backgroundColor: '#2A1D46', borderRadius: 36 },
  ceremonieNom: {
    fontFamily: F.titre, fontSize: 26, color: '#fff', textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6,
  },
  ceremonieBadge: {
    fontFamily: F.titre, fontSize: 15, letterSpacing: 1, textAlign: 'center',
    borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 16, overflow: 'hidden',
  },
  ceremonieBadgeNew: { backgroundColor: C.vert, color: '#2C380C' },
  ceremonieBadgeLeg: { backgroundColor: C.jaune, color: C.violetProfond },
  ceremonieBadgeDoublon: { backgroundColor: 'rgba(255,255,255,0.16)', color: C.lavande },
  ceremoniePoints: {
    position: 'absolute', top: 60, alignSelf: 'center',
    flexDirection: 'row', gap: 8, zIndex: 5,
  },
  ceremoniePoint: {
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  ceremoniePointActif: { backgroundColor: '#fff', transform: [{ scale: 1.25 }] },
  ceremoniePasser: {
    position: 'absolute', bottom: 46, alignSelf: 'center',
    paddingVertical: 10, paddingHorizontal: 22,
    borderRadius: R.pill, backgroundColor: 'rgba(255,255,255,0.12)',
  },
  ceremoniePasserTxt: { fontFamily: F.t700, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  rembourse: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: C.jaunePale, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12,
  },
  rembourseTxt: { fontFamily: F.t700, fontSize: 13, color: '#9A6B00' },

  // 🏁 récapitulatif ×5
  recapCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 20, marginHorizontal: 22,
    alignItems: 'center', gap: 14, alignSelf: 'stretch',
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  recapTitre: { fontFamily: F.titre, fontSize: 20, color: C.violet },
  recapRangee: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  recapCase: {
    width: '18.5%', alignItems: 'center', gap: 5,
    backgroundColor: C.fond, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 4,
    borderWidth: 2, borderColor: 'transparent',
  },
  recapCaseNom: { fontFamily: F.t700, fontSize: 10.5, color: C.texte, alignSelf: 'stretch', textAlign: 'center' },
  recapCaseNew: { fontFamily: F.t800, fontSize: 8.5, color: C.vertFonce, letterSpacing: 0.4 },
  recapCasePerles: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  recapCasePerlesTxt: { fontFamily: F.t800, fontSize: 10, color: '#9A6B00' },
  recapTotal: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: C.jaunePale, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12,
  },
  recapTotalTxt: { fontFamily: F.t700, fontSize: 13, color: '#9A6B00' },
  recapBoutons: { gap: 10, alignSelf: 'stretch' },
});
