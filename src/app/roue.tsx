// === La Roue du Mois — 3e jeu autonome de l'appli (route /roue) ===
// Un tour GRATUIT par mois, toujours gagnant, et des lots RÉELS (tampons, topping,
// chantilly, réduction, boisson) retirés en boutique via le pont caisse
// `jeu-recompenses`. Indépendant de Boba Quest : moteur pur dans components/roue/,
// flag serveur `roue_du_mois`, verrou mensuel local `roueDuMois.v1.*`.
// Trois règles héritées des leçons du repo (AGENTS.md) :
//   · le lot est TIRÉ puis PERSISTÉ AVANT l'animation — fermer l'app pendant les
//     ~5 s de rotation ne fait rien perdre, l'animation ne décide jamais de rien ;
//   · `gain_local_id` = `roue-AAAA-MM`, DÉTERMINISTE : la RPC serveur est idempotente
//     par (client, gain local), donc « réessayer » est toujours sans risque ;
//   · les chances EXACTES s'affichent sous la roue — les parts égales ne sont
//     honnêtes qu'accompagnées de cette liste (doctrine de la roulette Quest).
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, G, Path, Text as SvgText, SvgXml } from 'react-native-svg';

import { BORD, C, F, OMBRE, OMBRE_VIOLETTE, R } from '@/constants/charte';
import { BoutonPrimaire, BoutonRetour, Etincelle, MascottePerle, TrioPastilles } from '@/components/ui-kit';
import { useRoueDuMoisVisible } from '@/lib/app-config';
import { chargerDemandesRecompensesJeu, creerDemandeRecompenseJeu } from '@/lib/recompenses-jeu';
// Import de TYPE uniquement (effacé à la compilation) : le catalogue serveur connaît
// déjà `roue_topping` / `roue_chantilly`, mais l'union client vit dans economie.ts
// (Boba Quest), qu'on ne modifie pas — le `as` au point d'appel fait le pont.
import type { CodeRecompenseReelle } from '@/components/jeu/economie';
import { hapticLeger, hapticMoyen, hapticSucces } from '@/lib/juice';
import {
  LOT_VALIDITE_JOURS, PART_DEG, SEGMENTS_ROUE, SegmentRoue, cleDuMois, expireLe,
  instantsDeCrans, joursAvantMoisSuivant, pourcentagesHonnetes, rotationCibleVers,
  segmentSousPointeur, tirageComplet,
} from '@/components/roue/roue';
import { IconeRoue, MotifRoueMono, type IdSegmentRoue } from '@/components/roue/icones-roue';
import { EcranAttente, InviteInscription, useEstConnecte } from '@/components/garde-jeu';

// --- Verrou mensuel local -------------------------------------------------------------
const CLE_TIRAGE = 'roueDuMois.v1.tirage';

// Vagues signature de la DA (même idiome que le header et la carte fidélité de
// l'accueil : COPIER-COLLER du motif de la maquette, jamais de retranscription) —
// une rosée en haut, une violette profonde en bas de l'écrin.
const VAGUES_ROUE_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 420" preserveAspectRatio="none"><path d="M-20,40 Q40,26 100,40 T220,40 T340,40 T460,40 L460,-20 L-20,-20 Z" fill="#f2a7cf" opacity=".10"></path><path d="M-20,384 Q60,402 140,384 T300,384 T460,384 L460,440 L-20,440 Z" fill="#452a6e" opacity=".35"></path></svg>`;

type TirageStocke = {
  mois: string;       // 'AAAA-MM' du tour joué
  joueLe: string;     // ISO du tirage — base du « valable 30 jours » affiché
  premierId: string;
  finalId: string;    // jamais 'double'
  doubleTour: boolean;
  code: string;       // code caisse du lot final
  libelle: string;
};

// Parsing TOLÉRANT : un JSON corrompu, un id inconnu ou un final « double » (données
// bricolées) rendent null — l'écran retombe sur « pas encore joué », jamais un crash.
// Rejouer n'ouvre aucune faille : le quota mensuel serveur (1 lot roue/mois, partagé
// avec l'ancienne roulette) et l'idempotence par gain_local_id verrouillent le réel.
function parserTirage(brut: string | null): TirageStocke | null {
  if (!brut) return null;
  try {
    const v = JSON.parse(brut) as Record<string, unknown>;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    if (typeof v.mois !== 'string' || !/^\d{4}-\d{2}$/.test(v.mois)) return null;
    const final = SEGMENTS_ROUE.find((s) => s.id === v.finalId);
    if (!final || final.code === null) return null;
    // `joueLe` absent ou illisible (donnée d'avant l'expiration, bricolage) → on
    // retombe sur le 1er du mois stocké : l'échéance affichée est alors la plus
    // COURTE possible — on sous-promet, le serveur tranche de toute façon.
    const joueLe = typeof v.joueLe === 'string' && Number.isFinite(Date.parse(v.joueLe))
      ? v.joueLe
      : `${v.mois}-01T00:00:00.000`;
    return {
      mois: v.mois,
      joueLe,
      premierId: typeof v.premierId === 'string' ? v.premierId : final.id,
      finalId: final.id,
      doubleTour: v.doubleTour === true,
      code: typeof v.code === 'string' && v.code ? v.code : final.code,
      libelle: typeof v.libelle === 'string' && v.libelle ? v.libelle : (final.libelleGain ?? final.libelle),
    };
  } catch {
    return null;
  }
}

// --- Pont caisse : messages doux ------------------------------------------------------
// Les erreurs serveur arrivent SANS accents (strings exactes de la RPC). On normalise
// avant de tester (même précaution que la boutique Quest) et on traduit en langage
// humain — jamais un code d'erreur brut face au client.
function messageDoux(brut: string): string {
  const m = brut.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (m.includes('plafond')) {
    // Cas migration : le quota roue du mois est PARTAGÉ avec l'ancienne roulette Quest.
    return 'Ton lot roue est déjà réservé pour ce mois-ci — vois en boutique.';
  }
  if (m.includes('carte fidelite inactive')) {
    return 'Active ta carte de fidélité en boutique pour récupérer ton lot.';
  }
  if (m.includes('acces au jeu non autorise')) {
    return 'La roue n’est pas disponible pour le moment.';
  }
  if (m.includes('prix inconnu ou inactif') || m.includes('gain local deja associe')) {
    return 'Un souci avec ce lot — passe en boutique, l’équipe arrangera ça.';
  }
  return 'Hors connexion — réessaie pour l’envoyer en caisse.';
}

type StatutCaisse = 'en_attente' | 'appliquee' | 'refusee' | 'aucune' | null;

// « Choix en caisse » (décision Yoann 03/08) : un lot en_attente n'est JAMAIS
// appliqué tout seul — la caissière le propose au scan, le client l'utilise ou le
// garde, et il réapparaît au prochain scan tant qu'il n'est pas confirmé. Les
// libellés doivent porter cette liberté (« quand tu veux »), pas une injonction.
function libelleStatut(statut: StatutCaisse, envoiEnCours: boolean): string {
  if (envoiEnCours) return 'Préparation pour la caisse…';
  switch (statut) {
    case 'en_attente': return 'T’attend en caisse — utilise-le quand tu veux';
    case 'appliquee': return 'Utilisé ✅';
    case 'refusee': return 'Refusé — vois en boutique';
    case 'aucune': return 'Pas encore envoyé en caisse';
    default: return 'Statut à vérifier — reconnecte-toi';
  }
}

// --- Géométrie / rythme ---------------------------------------------------------------
const TAILLE = 300;
const RAYON_ROUE = 138;
const DUREE_TOUR_1 = 4600;   // le grand tour du mois
const DUREE_TOUR_2 = 2600;   // le re-spin du nouveau tour, plus court : c'est un rappel
const TOURS_PLEINS_1 = 4;
const TOURS_PLEINS_2 = 2;
const PAUSE_FLOURISH = 950;  // le temps de LIRE « NOUVEAU TOUR ! » avant que ça reparte

// Palette DA (04/08) : tout est clair et gourmand, texte ENCRE partout — sauf le
// segment violet du gros lot (boisson), seul à porter du texte blanc.
const TEXTE_SOMBRE = new Set(['tampon1', 'topping', 'double', 'tampon2', 'reduc10', 'tampon3', 'reduc20']);

// ======================================================================================
// Porte d'entrée : le flag serveur, PUIS la session, puis le contenu. Les hooks lourds
// vivent dans RoueContenu — jamais de hook après un return anticipé (leçon AGENTS.md),
// d'où `useEstConnecte` appelé AVANT tout return.
//
// La porte session n'est pas une sécurité — un client modifié la contourne. C'est de la
// cohérence : la RPC exige déjà un compte et une carte de fidélité (`acces au jeu non
// autorise`, `carte fidelite inactive`). Sans elle, un visiteur tournerait la roue,
// gagnerait, et se prendrait un refus à l'écran suivant.
export default function RoueScreen() {
  const flag = useRoueDuMoisVisible();
  const connecte = useEstConnecte();
  if (!flag.charge && !flag.visible) return <View style={styles.fond} />;
  if (!flag.visible) return <RoueRepli />;
  if (connecte === null) return <EcranAttente />;   // on ne montre rien tant qu'on ne sait pas
  if (!connecte) return (
    <InviteInscription
      emoji="🎡"
      texte="La Roue du Mois offre un tour gratuit par mois, et le lot se retire en boutique avec ta carte de fidélité. Il faut donc un compte pour la lancer."
    />
  );
  return <RoueContenu />;
}

// Écran de repli DOUX : flag éteint (ou lien direct /roue alors que la roue est
// fermée) → on l'explique gentiment, on ne crashe jamais, on ne montre rien du jeu.
// À distinguer de l'invite d'inscription : ici la roue est FERMÉE pour tout le monde,
// il n'y a donc rien à proposer — juste un retour.
function RoueRepli() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.fond, { paddingTop: insets.top + 10 }]}>
      <View style={styles.entete}>
        <BoutonRetour onPress={() => router.back()} />
      </View>
      <View style={styles.repliZone}>
        <View style={styles.repliCarte}>
          <Text style={styles.repliEmoji}>🎡</Text>
          <Text style={styles.repliTitre}>La Roue du Mois arrive bientôt</Text>
          <Text style={styles.repliTexte}>
            Elle n’est pas encore ouverte sur ton appli. Reviens vite — un tour gratuit
            par mois, avec de vrais lots à récupérer en boutique.
          </Text>
          <BoutonPrimaire titre="Retour" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
        </View>
      </View>
    </View>
  );
}

// ======================================================================================
function RoueContenu() {
  const insets = useSafeAreaInsets();

  const [moisCourant, setMoisCourant] = useState(() => cleDuMois(new Date()));
  const [verrou, setVerrou] = useState<TirageStocke | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [flourish, setFlourish] = useState(false);
  const [revele, setRevele] = useState<SegmentRoue | null>(null);
  const [statutCaisse, setStatutCaisse] = useState<StatutCaisse>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurCaisse, setErreurCaisse] = useState<string | null>(null);

  const rotation = useRef(new Animated.Value(0)).current;
  // Dernière rotation COMMANDÉE (Animated ne se relit pas côté JS avec le driver
  // natif) : sert à ne pas re-poser la roue quand elle montre déjà le bon segment.
  const rotationPosee = useRef(0);
  const carteScale = useRef(new Animated.Value(0.7)).current;
  const carteOpacite = useRef(new Animated.Value(0)).current;
  const flourishScale = useRef(new Animated.Value(0.6)).current;
  const flourishOpacite = useRef(new Animated.Value(0)).current;

  // Tics haptiques : programmés en une fois via instantsDeCrans, TOUS annulés au
  // démontage — un setTimeout orphelin qui vibre sur un autre écran, c'est non.
  const minuteries = useRef<ReturnType<typeof setTimeout>[]>([]);
  const monte = useRef(true);
  const viderMinuteries = useCallback(() => {
    minuteries.current.forEach(clearTimeout);
    minuteries.current = [];
  }, []);
  useEffect(() => () => { monte.current = false; viderMinuteries(); }, [viderMinuteries]);

  const programmerCrans = useCallback((rotationDelta: number, dureeMs: number) => {
    const instants = instantsDeCrans(rotationDelta, dureeMs);
    instants.forEach((t, i) => {
      minuteries.current.push(setTimeout(() => {
        // Dernier cran un peu plus marqué : c'est l'arrêt, il doit se SENTIR.
        if (i === instants.length - 1) hapticMoyen(); else hapticLeger();
      }, Math.round(t)));
    });
  }, []);

  const dejaJoue = !!verrou && verrou.mois === moisCourant;

  // --- Pont caisse ---------------------------------------------------------------------
  const envoyerEnCaisse = useCallback(async (tirage: TirageStocke) => {
    if (!monte.current) return;
    setEnvoiEnCours(true);
    setErreurCaisse(null);
    try {
      // `roue-AAAA-MM` : déterministe et rejouable — le serveur dédoublonne, et
      // `deja_creee: true` revient comme un succès normal (la lib rend la demande).
      const demande = await creerDemandeRecompenseJeu(`roue-${tirage.mois}`, tirage.code as CodeRecompenseReelle);
      if (monte.current) setStatutCaisse(demande.statut ?? 'en_attente');
    } catch (e) {
      if (monte.current) {
        setStatutCaisse((s) => (s === null ? 'aucune' : s));
        setErreurCaisse(messageDoux(e instanceof Error ? e.message : ''));
      }
    } finally {
      if (monte.current) setEnvoiEnCours(false);
    }
  }, []);

  // --- Mois + verrou + statut caisse, rafraîchis au focus ------------------------------
  const rafraichir = useCallback(() => {
    let vivant = true;
    const mois = cleDuMois(new Date());
    setMoisCourant(mois);
    (async () => {
      let tirage: TirageStocke | null = null;
      try {
        tirage = parserTirage(await AsyncStorage.getItem(CLE_TIRAGE));
      } catch { /* stockage illisible → « pas encore joué », le serveur borne le réel */ }
      if (!vivant) return;
      setVerrou(tirage);
      if (!tirage || tirage.mois !== mois) return;
      try {
        const demandes = await chargerDemandesRecompensesJeu();
        if (!vivant) return;
        const demande = demandes.find((d) => d.gain_local_id === `roue-${mois}`);
        setStatutCaisse(demande ? demande.statut : 'aucune');
      } catch {
        // Hors-ligne : statut inconnu (null) — on n'invente rien, on proposera l'envoi.
        if (vivant) setStatutCaisse((s) => (s === 'en_attente' || s === 'appliquee' || s === 'refusee' ? s : null));
      }
    })();
    return () => { vivant = false; };
  }, []);
  useFocusEffect(rafraichir);

  // Roue au repos d'un mois déjà joué : on la FIGE sur le lot gagné — l'écran
  // raconte le résultat au lieu d'une roue à zéro. Si elle pointe DÉJÀ le bon
  // segment (on sort d'un vrai tour), on n'y touche pas : pas de saut visuel de
  // l'atterrissage aléatoire vers le centre de la part.
  useEffect(() => {
    if (enCours || revele || flourish) return;
    if (dejaJoue && verrou) {
      const index = SEGMENTS_ROUE.findIndex((s) => s.id === verrou.finalId);
      if (index >= 0 && segmentSousPointeur(rotationPosee.current) !== index) {
        const statique = rotationCibleVers(index, () => 0.5, 0);
        rotationPosee.current = statique;
        rotation.setValue(statique);
      }
    }
  }, [dejaJoue, verrou, enCours, revele, flourish, rotation]);

  // --- La cérémonie d'arrivée ----------------------------------------------------------
  const terminerTour = useCallback((tirage: TirageStocke) => {
    if (!monte.current) return;
    const seg = SEGMENTS_ROUE.find((s) => s.id === tirage.finalId) ?? null;
    setEnCours(false);
    setVerrou(tirage);
    setRevele(seg);
    hapticSucces();
    carteScale.setValue(0.7);
    carteOpacite.setValue(0);
    Animated.parallel([
      Animated.spring(carteScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.timing(carteOpacite, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
    // Envoi caisse immédiat : tous les lots réels ont un code. En cas d'échec, le
    // bouton « Préparer pour la caisse » réessaie le MÊME gain_local_id, sans risque.
    void envoyerEnCaisse(tirage);
  }, [carteOpacite, carteScale, envoyerEnCaisse]);

  // --- Nouveau tour : flourish puis re-spin automatique (le tour du mois reste UN tour) --
  const flourishPuisRelancer = useCallback((tirage: TirageStocke, rotationActuelle: number) => {
    if (!monte.current) return;
    setFlourish(true);
    hapticSucces();
    flourishScale.setValue(0.6);
    flourishOpacite.setValue(0);
    Animated.parallel([
      Animated.spring(flourishScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(flourishOpacite, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    minuteries.current.push(setTimeout(() => {
      if (!monte.current) return;
      Animated.timing(flourishOpacite, { toValue: 0, duration: 200, useNativeDriver: true })
        .start(() => { if (monte.current) setFlourish(false); });
      const indexFinal = SEGMENTS_ROUE.findIndex((s) => s.id === tirage.finalId);
      // rotationCibleVers vise depuis le repos : on convertit en DELTA depuis la
      // position actuelle pour que la roue reparte de là où elle s'est arrêtée.
      const absolue = rotationCibleVers(indexFinal, Math.random, TOURS_PLEINS_2);
      const base = ((absolue % 360) + 360) % 360;
      const delta = TOURS_PLEINS_2 * 360 + ((((base - (rotationActuelle % 360)) % 360) + 360) % 360);
      const cible = rotationActuelle + delta;
      rotationPosee.current = cible;
      programmerCrans(delta, DUREE_TOUR_2);
      Animated.timing(rotation, {
        toValue: cible, duration: DUREE_TOUR_2, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start(({ finished }) => { if (finished) terminerTour(tirage); });
    }, PAUSE_FLOURISH));
  }, [flourishOpacite, flourishScale, programmerCrans, rotation, terminerTour]);

  // --- Le lancer -----------------------------------------------------------------------
  const lancer = () => {
    if (enCours || dejaJoue || revele || flourish) return;
    // Le résultat D'ABORD (Math.random est permis ICI, jamais dans le moteur), puis
    // l'animation ne fait que le mettre en scène.
    const tirage = tirageComplet(Math.random);
    const final = SEGMENTS_ROUE.find((s) => s.id === tirage.finalId);
    if (!final || final.code === null) return; // impossible par construction (finalId ≠ 'double')
    const maintenant = new Date();
    const mois = cleDuMois(maintenant);
    const stocke: TirageStocke = {
      mois,
      joueLe: maintenant.toISOString(),
      premierId: tirage.premierId,
      finalId: final.id,
      doubleTour: tirage.doubleTour,
      code: final.code,
      // Le libellé de GAIN (long, expliqué) : c'est lui qu'on stocke et qu'on
      // montre partout où l'on parle du lot — la roue garde le court pour elle.
      libelle: final.libelleGain ?? final.libelle,
    };
    // Persisté AVANT d'animer : app fermée pendant la rotation ⇒ lot retrouvé au
    // prochain focus, avec proposition d'envoi en caisse (leçon roulette du 26/07).
    AsyncStorage.setItem(CLE_TIRAGE, JSON.stringify(stocke)).catch(() => {});
    setMoisCourant(mois);
    setStatutCaisse(null);
    setErreurCaisse(null);
    setEnCours(true);
    viderMinuteries();
    const indexPremier = SEGMENTS_ROUE.findIndex((s) => s.id === tirage.premierId);
    const cible = rotationCibleVers(indexPremier, Math.random, TOURS_PLEINS_1);
    rotation.setValue(0);
    rotationPosee.current = cible;
    programmerCrans(cible, DUREE_TOUR_1);
    Animated.timing(rotation, {
      toValue: cible, duration: DUREE_TOUR_1, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      if (stocke.doubleTour) flourishPuisRelancer(stocke, cible);
      else terminerTour(stocke);
    });
  };

  const joursRestants = joursAvantMoisSuivant(new Date());
  const segmentMisEnAvant = revele ? revele.id : (dejaJoue && !enCours && verrou ? verrou.finalId : null);
  // Validité 30 jours : comptée depuis le TIRAGE (voir expireLe — l'appli sous-promet,
  // le serveur tranche). Un lot déjà utilisé n'expire pas : « Utilisé ✅ » reste vrai.
  const expiration = verrou && dejaJoue ? expireLe(new Date(verrou.joueLe)) : null;
  const lotExpire = !!expiration && Date.now() > expiration.getTime() && statutCaisse !== 'appliquee';
  const montrerEnvoi = dejaJoue && !lotExpire && !envoiEnCours && (statutCaisse === 'aucune' || statutCaisse === null);

  return (
    <View style={[styles.fond, { paddingTop: insets.top + 10 }]}>
      <View style={styles.entete}>
        <BoutonRetour onPress={() => router.back()} />
        <Text style={styles.enteteTitre}>La Roue du Mois</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu}>
        {/* === L'écrin violet immersif, vagues signature en fond === */}
        <View style={styles.roueCarte}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
            <SvgXml xml={VAGUES_ROUE_XML} width="100%" height="100%" />
          </View>
          <Etincelle taille={14} style={{ position: 'absolute', top: 14, left: 14 }} />
          <Etincelle taille={9} couleur="#CBB6E8" style={{ position: 'absolute', top: 40, right: 20 }} />
          <Etincelle taille={11} couleur={C.rose} style={{ position: 'absolute', bottom: 26, left: 22 }} />
          <View style={styles.rouePill}>
            <Text style={styles.rouePillTxt}>1 tour gratuit chaque mois · toujours gagnant</Text>
          </View>

          <View style={styles.roueZone}>
            <View style={styles.fleche}>
              <Svg width={34} height={26} viewBox="0 0 34 26">
                <Path d="M17 26 L4 4 Q17 -2 30 4 Z" fill="#fff" stroke="#fff" strokeWidth={2.4} />
              </Svg>
            </View>
            {/* Le rotor et la mascotte partagent un conteneur de la taille EXACTE de la
                roue. Le repère du centrage devient donc le moyeu lui-même.
                Avant, la superposition s'étalait sur `roueZone`, qui contient AUSSI la
                flèche (26 px de haut, remontée de 13) et un paddingTop de 2 : son milieu
                tombait 7,5 px au-dessus du moyeu, et la mascotte avec. */}
            <View style={{ width: TAILLE, height: TAILLE }}>
              <Animated.View
                style={[
                  dejaJoue && !enCours && !revele ? { opacity: 0.92 } : null,
                  { transform: [{ rotate: rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }] },
                ]}
              >
                <RoueSvg misEnAvantId={segmentMisEnAvant} />
              </Animated.View>

              {/* 🧋 La mascotte perle trône au moyeu et reste DROITE pendant que la roue
                  tourne : elle vit HORS du rotor, par-dessus, sur l'assiette blanche
                  dessinée dans le SVG. C'est elle qui fait « Bubble Stop » d'un coup d'œil. */}
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  {/* couronnée : c'est l'événement du mois, elle préside */}
                  <MascottePerle taille={38} couronne />
                </View>
              </View>
            </View>

            {/* Flourish « NOUVEAU TOUR ! » — par-dessus la roue, le temps d'un souffle */}
            {flourish && (
              <Animated.View
                pointerEvents="none"
                style={[styles.flourish, { opacity: flourishOpacite, transform: [{ scale: flourishScale }] }]}
              >
                <Text style={styles.flourishEmoji}>🌀</Text>
                <Text style={styles.flourishTxt}>NOUVEAU TOUR !</Text>
                <Text style={styles.flourishSous}>La roue repart pour un vrai lot</Text>
              </Animated.View>
            )}
          </View>

          <Text style={styles.roueNote}>
            {enCours
              ? 'La roue tourne…'
              : dejaJoue ? 'Roue du mois déjà jouée' : 'Ton tour gratuit du mois t’attend'}
          </Text>
        </View>

        <Text style={styles.legende}>
          🧋 Lots réels, à récupérer en boutique avec ta carte — quand tu veux, valables {LOT_VALIDITE_JOURS} jours.
        </Text>

        {/* === Lancer / déjà joué. Tant que la roue TOURNE, on garde le bouton (grisé) :
             le verrou est déjà posé en stockage, mais afficher la carte du lot pendant
             la rotation révélerait le résultat avant l'arrêt. === */}
        {!dejaJoue || enCours ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Lancer la roue"
            accessibilityState={{ disabled: enCours }}
            onPress={lancer}
            disabled={enCours || dejaJoue}
            style={({ pressed }) => [styles.btnLancer, (pressed || enCours) && { opacity: 0.75 }]}
          >
            <Text style={styles.btnLancerTxt}>{enCours ? 'La roue tourne…' : 'Lancer ma roue du mois !'}</Text>
          </Pressable>
        ) : (
          <View style={styles.lotCarte}>
            <View style={styles.lotTitreRang}>
              <Text style={styles.lotTitreEmoji}>🎁</Text>
              <Text style={styles.lotTitre}>Mon lot du mois</Text>
            </View>
            {!!verrou && (
              <View style={[styles.lotPill, styles.lotPillRang, { backgroundColor: couleurDe(verrou.finalId) }]}>
                <IconeRoue
                  id={verrou.finalId as IdSegmentRoue}
                  variante="mono"
                  couleur={TEXTE_SOMBRE.has(verrou.finalId) ? '#2A1D46' : '#fff'}
                  taille={18}
                />
                <Text style={[styles.lotPillTxt, TEXTE_SOMBRE.has(verrou.finalId) && { color: '#2A1D46' }]}>
                  {verrou.libelle}
                </Text>
              </View>
            )}
            {/* Le « nouveau tour » n'est PAS un lot : c'est un relanceur, et seul le
                tirage final compte. La carte que le client présente en caisse ne doit
                donc afficher QUE ce lot final — une mention « nouveau tour » à côté se
                lit comme un second gain à honorer. Le pont caisse était déjà sain (le
                code envoyé est celui du lot final, `finalId` n'est jamais 'double') :
                c'était l'affichage qui mentait. `verrou.doubleTour` reste stocké, il
                sert au rejeu de l'animation au rechargement. */}
            <View style={styles.statutRang}>
              <View style={[styles.statutPastille, {
                backgroundColor: lotExpire ? C.texte3
                  : statutCaisse === 'appliquee' ? C.vert
                    : statutCaisse === 'refusee' ? C.danger
                      : statutCaisse === 'en_attente' ? C.jaune : C.texte3,
              }]} />
              <Text style={styles.statutTxt}>
                {lotExpire ? 'Expiré — retente ta chance le mois prochain' : libelleStatut(statutCaisse, envoiEnCours)}
              </Text>
            </View>
            {!lotExpire && !!expiration && statutCaisse !== 'appliquee' && (
              <Text style={styles.validiteTxt}>
                Valable jusqu’au {expiration.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
              </Text>
            )}
            {!lotExpire && !!erreurCaisse && <Text style={styles.erreurTxt}>{erreurCaisse}</Text>}
            {montrerEnvoi && !!verrou && (
              <BoutonPrimaire
                titre="Préparer pour la caisse"
                loading={envoiEnCours}
                onPress={() => { void envoyerEnCaisse(verrou); }}
                style={{ alignSelf: 'stretch' }}
              />
            )}
            <Text style={styles.compteARebours}>
              Nouvelle roue dans {joursRestants} j
            </Text>
          </View>
        )}

        {/* === Tes chances — la liste honnête, JAMAIS sur la roue === */}
        <View style={styles.chances}>
          <View style={styles.chancesTitreRang}>
            <TrioPastilles />
            <Text style={styles.chancesTitre}>Tes chances</Text>
          </View>
          {pourcentagesHonnetes().map((ligne) => (
            <View key={ligne.id} style={styles.chanceLigne}>
              <View style={[styles.chancePastille, { backgroundColor: couleurDe(ligne.id) }]} />
              <IconeRoue id={ligne.id as IdSegmentRoue} variante="mono" couleur={C.violet} taille={17} />
              <Text style={styles.chanceLabel}>{ligne.libelle}</Text>
              <Text style={styles.chancePct}>
                {ligne.pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %
              </Text>
            </View>
          ))}
          <Text style={styles.chancesNote}>
            Le lot est tiré selon ces pourcentages exacts, avant même que la roue tourne —
            les parts sont dessinées égales pour rester lisibles. « Nouveau tour » relance
            la roue : le lot final est toujours un vrai lot.
          </Text>
        </View>
      </ScrollView>

      {/* === Cérémonie : la carte du lot se révèle === */}
      {revele && (
        <View style={styles.voile}>
          <Animated.View style={[styles.gainCarte, { opacity: carteOpacite, transform: [{ scale: carteScale }] }]}>
            <IconeRoue id={revele.id as IdSegmentRoue} variante="mono" couleur={C.violet} taille={56} />
            <Text style={styles.gainTitre}>Tu as gagné !</Text>
            <View style={[styles.gainPill, { backgroundColor: revele.couleur }]}>
              <Text style={[styles.gainPillTxt, TEXTE_SOMBRE.has(revele.id) && { color: '#2A1D46' }]}>
                {revele.libelleGain ?? revele.libelle}
              </Text>
            </View>
            <Text style={styles.gainAide}>
              {envoiEnCours
                ? 'Préparation pour la caisse…'
                : erreurCaisse ?? (statutCaisse === 'en_attente' || statutCaisse === 'appliquee'
                  ? `Prêt ! Il t’attend en caisse — utilise-le quand tu veux, valable ${LOT_VALIDITE_JOURS} jours.`
                  : 'Lot réel : à récupérer en boutique avec ta carte de fidélité.')}
            </Text>
            <BoutonPrimaire titre="Génial !" onPress={() => setRevele(null)} style={{ alignSelf: 'stretch' }} />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

// --- Petit accès table (id → couleur), pour verrou stocké et liste des chances --------
// `emojiDe` a disparu avec le dernier emoji de l'écran : les pictogrammes viennent
// désormais tous de `icones-roue`. Le champ `emoji` reste dans SEGMENTS_ROUE, inutilisé
// ici — à retirer de roue.ts quand plus aucun écran ne s'en sert.
function couleurDe(id: string): string {
  return SEGMENTS_ROUE.find((s) => s.id === id)?.couleur ?? C.violetClair;
}

// --- La roue SVG ----------------------------------------------------------------------
// Décalage d'une demi-part : le CENTRE de la première part tombe pile en haut — au
// repos, la flèche désigne un lot, jamais une couture (même astuce que Quest). Le
// découpage utilise PART_DEG du moteur : une seule vérité pour la géométrie.
const SECTEURS = SEGMENTS_ROUE.map((seg, i) => ({
  a0: i * PART_DEG - PART_DEG / 2,
  a1: i * PART_DEG + PART_DEG / 2,
  centre: i * PART_DEG,
  seg,
}));

const POLICE_ROUE = 11;
// Côté de l'icône dans une part. Mesuré au rendu : 26 px se perd dans les 45°,
// 32 px tient sa place sans mordre le libellé. Les icônes sont dessinées dans une
// boîte de 96 — d'où le scale(32/96) au point d'appel.
const TAILLE_ICONE = 32;
// Largeur moyenne d'un caractère GRAS (fraction de la police), mesurée au rendu sur
// l'ancienne roue : 0,55 (texte normal) sous-estimait et laissait le texte mordre
// les séparateurs blancs.
const LARGEUR_CAR = 0.62;
const MARGE_PART = 0.88;
const RAYON_TEXTE = RAYON_ROUE * 0.64;
// Largeur utile au milieu d'une part : la corde de l'arc à ce rayon, moins la marge.
const LARGEUR_UTILE = 2 * RAYON_TEXTE * Math.sin((Math.PI / 180) * (PART_DEG / 2)) * MARGE_PART;

// Coupe un libellé en 2, ou 3 lignes AU PLUS (04/08 : « Double topping offert »,
// 21 caractères — sa meilleure coupe en 2 laisse encore « topping offert » à ~95 px
// pour ~60 px utiles dans 45° ; en 3 lignes, chaque mot respire). Le critère est la
// ligne la plus LARGE (pas l'équilibre) : c'est elle qui mord les coutures blanches.
// On ne coupe jamais un mot, et on garde le moins de lignes qui tiennent.
function couperLibelle(texte: string): string[] {
  const px = (s: string) => s.length * LARGEUR_CAR * POLICE_ROUE;
  if (px(texte) <= LARGEUR_UTILE) return [texte];
  const mots = texte.split(' ');
  if (mots.length < 2) return [texte];
  // Meilleure coupe en 2 : minimise la ligne la plus large.
  let deux: string[] = [texte];
  let maxDeux = Infinity;
  for (let c = 1; c < mots.length; c++) {
    const lignes = [mots.slice(0, c).join(' '), mots.slice(c).join(' ')];
    const m = Math.max(px(lignes[0]), px(lignes[1]));
    if (m < maxDeux) { maxDeux = m; deux = lignes; }
  }
  if (maxDeux <= LARGEUR_UTILE || mots.length < 3) return deux;
  // Toujours trop large → meilleure coupe en 3 (même critère).
  let trois = deux;
  let maxTrois = maxDeux;
  for (let a = 1; a < mots.length - 1; a++) {
    for (let b = a + 1; b < mots.length; b++) {
      const lignes = [mots.slice(0, a).join(' '), mots.slice(a, b).join(' '), mots.slice(b).join(' ')];
      const m = Math.max(...lignes.map(px));
      if (m < maxTrois) { maxTrois = m; trois = lignes; }
    }
  }
  return trois;
}

// 8 parts ÉGALES, emoji + libellé TANGENTIEL (une lecture presque horizontale ; le
// radial se lit la tête penchée et buterait dans la flèche en haut). Aucun % ICI :
// les chances exactes vivent dans la liste sous la roue. `misEnAvantId` éteint les
// autres parts à l'arrêt — la cérémonie désigne le lot sans texte en plus.
function RoueSvg({ misEnAvantId }: { misEnAvantId: string | null }) {
  const cx = TAILLE / 2, cy = TAILLE / 2;
  const pt = (angleDeg: number, r: number) => {
    const a = (angleDeg * Math.PI) / 180;
    return { x: cx + Math.sin(a) * r, y: cy - Math.cos(a) * r };
  };
  return (
    <Svg width={TAILLE} height={TAILLE} viewBox={`0 0 ${TAILLE} ${TAILLE}`}>
      {/* couronne blanche + « ampoules » de fête foraine, alternées jaune/rose */}
      <Circle cx={cx} cy={cy} r={RAYON_ROUE + 11} fill="#FFFFFF" />
      {Array.from({ length: 16 }, (_, i) => {
        const p = pt(i * 22.5 + 11.25, RAYON_ROUE + 5.5);
        return <Circle key={i} cx={p.x} cy={p.y} r={2.6} fill={i % 2 === 0 ? C.jaune : C.rose} />;
      })}
      {SECTEURS.map(({ a0, a1, centre, seg }) => {
        const p0 = pt(a0, RAYON_ROUE), p1 = pt(a1, RAYON_ROUE);
        const sombre = TEXTE_SOMBRE.has(seg.id);
        const eteint = misEnAvantId !== null && misEnAvantId !== seg.id;
        const pTxt = pt(centre, RAYON_TEXTE);
        // Moitié BASSE (90°..270°) : une rotation nue mettrait le texte à l'envers —
        // on le retourne d'un demi-tour pour qu'il reste lisible.
        const rot = centre > 90 && centre < 270 ? centre + 180 : centre;
        const lignes = couperLibelle(seg.libelle);
        const interligne = POLICE_ROUE * 1.06;
        // Bloc icône + libellé, centré sur pTxt. L'ancien calcul traitait l'emoji comme
        // UNE ligne de texte (11,7 px) ; une icône de 32 px déborde de 16 px sous son
        // ancrage et venait couvrir la première ligne. On mesure donc le bloc pour ce
        // qu'il est : l'icône, un souffle, puis les lignes.
        const SOUFFLE = 3;
        const hautBloc = pTxt.y - (TAILLE_ICONE + SOUFFLE + lignes.length * interligne) / 2;
        const yIcone = hautBloc;                                   // bord HAUT de l'icône
        const y0 = hautBloc + TAILLE_ICONE + SOUFFLE + interligne / 2;
        return (
          <G key={seg.id} opacity={eteint ? 0.32 : 1}>
            <Path
              d={`M${cx} ${cy} L${p0.x} ${p0.y} A${RAYON_ROUE} ${RAYON_ROUE} 0 0 1 ${p1.x} ${p1.y} Z`}
              fill={seg.couleur}
              stroke="#fff"
              strokeWidth={misEnAvantId === seg.id ? 3.4 : 2}
            />
            {/* Icône dessinée à la place de l'emoji : même point d'ancrage, même
                rotation. Elle prend la couleur du libellé de sa part — pas la sienne —
                pour ne rien imposer à la palette pastel des secteurs. */}
            <G
              transform={`rotate(${rot} ${pTxt.x} ${pTxt.y}) `
                + `translate(${pTxt.x - TAILLE_ICONE / 2} ${yIcone}) `
                + `scale(${TAILLE_ICONE / 96})`}
            >
              <MotifRoueMono id={seg.id as IdSegmentRoue} couleur={sombre ? '#2A1D46' : '#fff'} />
            </G>
            {lignes.map((ligne, n) => (
              <SvgText
                key={ligne}
                x={pTxt.x} y={y0 + n * interligne}
                fill={sombre ? '#2A1D46' : '#fff'}
                fontSize={POLICE_ROUE} fontWeight="bold"
                textAnchor="middle" alignmentBaseline="middle"
                transform={`rotate(${rot} ${pTxt.x} ${pTxt.y})`}
              >
                {ligne}
              </SvgText>
            ))}
          </G>
        );
      })}
      {/* moyeu : assiette blanche cerclée de jaune perle — la mascotte perle
          (composant RN, HORS rotation) vient s'asseoir dessus, côté écran. */}
      <Circle cx={cx} cy={cy} r={25} fill="#fff" stroke={C.jaune} strokeWidth={5} />
    </Svg>
  );
}

// --- Styles ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  entete: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 4,
  },
  enteteTitre: { fontFamily: F.titre, fontSize: 19, color: C.violet },
  contenu: { padding: 18, gap: 14, paddingBottom: 34, alignItems: 'stretch' },

  roueCarte: {
    backgroundColor: C.violet, borderRadius: R.carte, paddingVertical: 18,
    gap: 12, overflow: 'hidden', ...OMBRE_VIOLETTE,
  },
  rouePill: {
    alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', borderRadius: R.pill,
    paddingVertical: 6, paddingHorizontal: 16,
  },
  rouePillTxt: { fontFamily: F.titre, fontSize: 13, color: '#fff' },
  roueZone: { alignItems: 'center', paddingTop: 2 },
  fleche: { zIndex: 3, marginBottom: -13 },
  roueNote: { fontFamily: F.t600, fontSize: 12.5, color: C.surViolet, textAlign: 'center' },

  flourish: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  flourishEmoji: { fontSize: 40 },
  flourishTxt: {
    fontFamily: F.titre, fontSize: 30, color: '#fff', letterSpacing: 1,
    textShadowColor: 'rgba(42,29,70,0.8)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 },
  },
  flourishSous: {
    fontFamily: F.t700, fontSize: 13, color: '#fff', marginTop: 2,
    textShadowColor: 'rgba(42,29,70,0.8)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 },
  },

  legende: { fontFamily: F.t600, fontSize: 12, color: C.texte3, textAlign: 'center' },

  btnLancer: {
    backgroundColor: C.vert, borderRadius: R.btn, paddingVertical: 16,
    alignItems: 'center', ...OMBRE,
  },
  btnLancerTxt: { fontFamily: F.titre, fontSize: 17, color: '#fff' },

  lotCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 18, gap: 9,
    alignItems: 'center', borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  lotTitreRang: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  lotTitreEmoji: { fontSize: 17 },
  lotTitre: { fontFamily: F.titre, fontSize: 16.5, color: C.violet },
  lotPill: { borderRadius: R.pill, paddingVertical: 9, paddingHorizontal: 18 },
  lotPillRang: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  lotPillTxt: { fontFamily: F.t800, fontSize: 15, color: '#fff' },
  lotDouble: { fontFamily: F.t600, fontSize: 12, color: C.violetClair },
  statutRang: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statutPastille: { width: 9, height: 9, borderRadius: 5 },
  statutTxt: { fontFamily: F.t700, fontSize: 13, color: C.texte2 },
  validiteTxt: { fontFamily: F.t600, fontSize: 12.5, color: C.texte3 },
  erreurTxt: { fontFamily: F.t600, fontSize: 12.5, color: C.danger, textAlign: 'center', lineHeight: 18 },
  compteARebours: { fontFamily: F.t600, fontSize: 12.5, color: C.texte3, marginTop: 2 },

  chances: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 15, gap: 7,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  chancesTitreRang: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  chancesTitre: { fontFamily: F.titre, fontSize: 15, color: C.violet },
  chanceLigne: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  chancePastille: { width: 11, height: 11, borderRadius: 6 },
  chanceEmoji: { fontSize: 13 },
  chanceLabel: { flex: 1, fontFamily: F.t600, fontSize: 12.5, color: C.texte2 },
  chancePct: { fontFamily: F.t800, fontSize: 12.5, color: C.violetClair },
  chancesNote: { fontFamily: F.t600, fontSize: 11.5, color: C.texte3, marginTop: 4, textAlign: 'center', lineHeight: 16 },

  voile: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(42,29,70,0.65)',
    alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  gainCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 24,
    alignItems: 'center', gap: 11, alignSelf: 'stretch',
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  gainEmoji: { fontSize: 44 },
  gainTitre: { fontFamily: F.titre, fontSize: 24, color: C.violet },
  gainPill: { borderRadius: R.pill, paddingVertical: 10, paddingHorizontal: 18 },
  gainPillTxt: { fontFamily: F.t800, fontSize: 16, color: '#fff' },
  gainDouble: { fontFamily: F.t600, fontSize: 12.5, color: C.violetClair },
  gainAide: { fontFamily: F.t400, fontSize: 13.5, color: C.texte2, textAlign: 'center', lineHeight: 19 },

  repliZone: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  repliCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 24, gap: 10,
    alignItems: 'center', alignSelf: 'stretch',
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  repliEmoji: { fontSize: 44 },
  repliTitre: { fontFamily: F.titre, fontSize: 19, color: C.violet, textAlign: 'center' },
  repliTexte: { fontFamily: F.t400, fontSize: 13.5, color: C.texte2, textAlign: 'center', lineHeight: 19 },
});
