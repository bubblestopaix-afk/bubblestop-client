// === 🏗️ Boba Tower — « La tour vivante » (prototype v2) ===
//
// L'écran du deuxième jeu, refondu après le verdict commanditaire (« ennuyeux
// et répétitif ») : la LARGEUR du sommet est la barre de vie (deux parois qui
// se resserrent à chaque erreur, se rouvrent sur un parfait), un bancal/raté
// fait VACILLER la tour (2e tap au bon moment = rattrapage, moitié de la
// largeur récupérée), et la partie est SANS FIN par étages de 8 poses — elle ne
// se termine que par bascule. Toute la logique vit dans le MOTEUR PUR
// (components/boba-tower/moteur-tower.ts) — cet écran ne fait que mesurer le
// temps des taps, animer les événements et persister les records locaux
// (`bobaTower.*`). Il n'importe RIEN du store Boba Quest (test de source dans
// scripts/test-jeu.cjs).
//
// PERF (téléphones modestes) — ZÉRO setState par frame :
//   · l'oscillation est 100 % native driver : Animated.loop de deux timings
//     LINÉAIRES (l'onde triangle du moteur, exactement), re-créé à chaque pose
//     avec t0 = Date.now() partagé — le visuel et la formule ne peuvent pas
//     dériver l'un de l'autre ;
//   · le vacillement du rattrapage suit le MÊME principe : un timing linéaire
//     de 900 ms (le triangle du marqueur vient de l'interpolation), t0 partagé
//     avec la mesure du 2e tap ;
//   · la pile est une liste de Views STATIQUES (aucun re-render pendant
//     l'oscillation) ; la logique JS ne tourne qu'aux taps.
// Pas de Skia (inutile ici), pas de son (module audio absent du binaire — OTA).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, router, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BORD, C, F, OMBRE, R } from '@/constants/charte';
import {
  AMPLITUDE_OSCILLATION, DERIVE_MAX, LARGEUR_GOBELET, LARGEUR_INITIALE,
  POSES_PAR_ETAGE, RATTRAPAGE_DUREE_MS, RATTRAPAGE_FENETRE_MS,
  VENT_AMPLITUDE, VENT_PERIODE, INGREDIENTS, VARIANTES,
  creerPartie, defiDuJour, evaluerObjectifs, lacher, majSerie, objectifsDuJour,
  periodeIngredient, positionIngredient, rattraper, resultatDe,
  type Defi, type EtatTower, type EvtPose, type IngredientId,
  type ResultatPartie, type ResultatRattrapage, type Scellement, type Serie,
  type VerdictPose,
} from '@/components/boba-tower/moteur-tower';
import { useTowerVisible } from '@/lib/app-config';
import { hapticLeger, hapticLourd, hapticMoyen, hapticSucces } from '@/lib/juice';

// --- Persistance locale UNIQUEMENT (prototype) : clés `bobaTower.*`, jamais le
// store Boba Quest, jamais le réseau. Migration en douceur v2 : les clés
// record (score) et meilleurCombo GARDENT leur nom v1 (les anciens records
// restent valides) ; seule s'AJOUTE la hauteur (`recordEtages`). -------------
const CLE_RECORD = 'bobaTower.record';
const CLE_MEILLEUR_COMBO = 'bobaTower.meilleurCombo';
const CLE_RECORD_ETAGES = 'bobaTower.recordEtages';
const CLE_SERIE = 'bobaTower.serie';
const CLE_ONBOARDING = 'bobaTower.onboardingVu';
const CLE_ONBOARDING_RATTRAPAGE = 'bobaTower.onboardingRattrapageVu';
const cleDefi = (date: string) => `bobaTower.defi.${date}`;

// Couleurs des couches par ingrédient — la charte reste CÔTÉ ÉCRAN (le moteur est
// pur). Le verdict est toujours doublé d'un TEXTE : la couleur seule ne porte
// jamais l'information (accessibilité).
const COULEUR_INGREDIENT: Record<IngredientId, string> = {
  perle: C.violetProfond, the: C.jaune, lait: C.jaunePale, gelee: C.vert, litchi: C.rose,
  glacon: C.bleu, popping: C.roseFonce, fraise: C.danger, mini: C.violetClair, mousse: C.blanc,
};

const LIBELLE_VERDICT: Record<VerdictPose, { texte: string; couleur: string }> = {
  parfait: { texte: 'PARFAIT !', couleur: C.vert },
  bien: { texte: 'BIEN', couleur: C.bleu },
  bancal: { texte: 'BANCAL', couleur: C.jaune },
  rate: { texte: 'RATÉ', couleur: C.rose },
};

// Jour LOCAL du joueur (le défi du jour suit sa journée, pas UTC).
function jourLocalISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Phase = 'pret' | 'chute' | 'rattrapage' | 'scellement' | 'fini';
type Mode = { type: 'libre' } | { type: 'defi'; defi: Defi };

type Hud = {
  score: number; combo: number; largeur: number; derive: number;
  etage: number; posesEtage: number; courant: IngredientId | null;
};
const HUD_VIERGE: Hud = {
  score: 0, combo: 0, largeur: LARGEUR_INITIALE, derive: 0,
  etage: 1, posesEtage: 0, courant: null,
};

type Chute = { evt: EvtPose; xTapU: number; cle: number } | null;
type VerdictAff = { texte: string; couleur: string; points: number; cle: number } | null;
/** Vacillement en cours : côté du penchement (±1) pour le marqueur et la pile. */
type Ratt = { cote: 1 | -1; cle: number } | null;
type Recap = {
  res: ResultatPartie;
  objectifsOk: boolean[];
  nouveauRecord: boolean;
  record: number;
  recordEtages: number;
  nouveauRecordEtages: boolean;
  serie: Serie;
  enDefi: boolean;
} | null;

export default function BobaTowerScreen() {
  // ⚠️ TOUS les hooks AVANT tout return anticipé (piège documenté du projet : un
  // hook après un return conditionnel = ordre d'appel variable = crash en prod).
  const { visible, charge } = useTowerVisible();
  const insets = useSafeAreaInsets();

  // — mesure de la zone de jeu (une seule setState, au layout) —
  const [zone, setZone] = useState<{ l: number; h: number } | null>(null);

  // — état moteur (mutable, hors React) + états d'affichage (aux taps seulement) —
  const etatRef = useRef<EtatTower | null>(null);
  const modeRef = useRef<Mode>({ type: 'libre' });
  const compteurRef = useRef(0);
  const [phase, setPhase] = useState<Phase>('pret');
  const [hud, setHud] = useState<Hud>(HUD_VIERGE);
  const [piles, setPiles] = useState<{ id: IngredientId; x: number; cle: number }[]>([]);
  const [bandes, setBandes] = useState(0); // étages déjà scellés (bandeaux au fond)
  const [chute, setChute] = useState<Chute>(null);
  const [ratt, setRatt] = useState<Ratt>(null);
  const [scellementAff, setScellementAff] = useState<Scellement | null>(null);
  const [verdictAff, setVerdictAff] = useState<VerdictAff>(null);
  const [recap, setRecap] = useState<Recap>(null);
  const [enDefi, setEnDefi] = useState(false);

  // — records locaux —
  const [record, setRecord] = useState(0);
  const [recordCombo, setRecordCombo] = useState(0);
  const [recordEtages, setRecordEtages] = useState(0);
  const [serie, setSerie] = useState<Serie | null>(null);
  const [recordDefi, setRecordDefi] = useState(0);
  const [defiFaite, setDefiFaite] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  // 2e bulle (le brief en autorise deux max) : apprise au PREMIER vacillement.
  const [onboardingRatt, setOnboardingRatt] = useState(false);
  const [bulleRatt, setBulleRatt] = useState(false);

  // — valeurs animées (native driver ; la JS thread ne touche à rien par frame) —
  const osc = useRef(new Animated.Value(0)).current;        // 0..1 = onde triangle
  const vent = useRef(new Animated.Value(0)).current;       // −1..1 = souffle du défi Vent
  const chuteProg = useRef(new Animated.Value(0)).current;  // 0..1 = chute (1.6 = raté qui passe à côté)
  const squash = useRef(new Animated.Value(1)).current;     // écrasement à l'atterrissage
  const verdictAnim = useRef(new Animated.Value(0)).current;
  const deriveAnim = useRef(new Animated.Value(0)).current; // inclinaison de la pile
  const largeurAnim = useRef(new Animated.Value(LARGEUR_INITIALE)).current; // les PAROIS (u)
  // 0..1 = fenêtre de vacillement (0,5 = équilibre). REPOS À 0,5 : hors
  // vacillement, l'interpolation doit rendre 0° — jamais une tour penchée.
  const rattAnim = useRef(new Animated.Value(0.5)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const ventLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const rattTimingRef = useRef<Animated.CompositeAnimation | null>(null);
  const t0Ref = useRef(0);
  const t0RattRef = useRef(0);
  const cleRef = useRef(0);
  // Verrous SYNCHRONES anti double-tap : `phase` (état React) ne change qu'au
  // prochain rendu — deux onPressIn dans la même frame verraient tous deux
  // l'ancienne phase. Les refs, eux, basculent immédiatement.
  const poseEnCoursRef = useRef(false);
  const rattResoluRef = useRef(false);           // rattraper() déjà appelé pour CETTE fenêtre
  const rattEchecResRef = useRef<ResultatRattrapage | null>(null); // tap manqué : on laisse la fenêtre se finir

  // — registre de minuteries (pattern du projet : jamais un setTimeout nu qui
  //   survive au démontage — il frapperait un écran mort ou la partie suivante) —
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const programmer = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => { timersRef.current.delete(id); fn(); }, ms);
    timersRef.current.add(id);
  }, []);
  const annulerTimers = useCallback(() => {
    for (const id of timersRef.current) clearTimeout(id);
    timersRef.current.clear();
  }, []);

  // — défi + objectifs du jour (purs, dérivés de la date locale) —
  const jour = useMemo(() => jourLocalISO(), []);
  const defi = useMemo(() => defiDuJour(jour), [jour]);
  const objectifs = useMemo(() => objectifsDuJour(jour), [jour]);

  // chargement des records + onboarding (une fois)
  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const [r, c, e, s, d, ob, obr] = await Promise.all([
          AsyncStorage.getItem(CLE_RECORD),
          AsyncStorage.getItem(CLE_MEILLEUR_COMBO),
          AsyncStorage.getItem(CLE_RECORD_ETAGES),
          AsyncStorage.getItem(CLE_SERIE),
          AsyncStorage.getItem(cleDefi(jour)),
          AsyncStorage.getItem(CLE_ONBOARDING),
          AsyncStorage.getItem(CLE_ONBOARDING_RATTRAPAGE),
        ]);
        if (!vivant) return;
        setRecord(parseInt(r ?? '0', 10) || 0);
        setRecordCombo(parseInt(c ?? '0', 10) || 0);
        setRecordEtages(parseInt(e ?? '0', 10) || 0); // clé NOUVELLE : absente = 0, rien à migrer
        try { if (s) setSerie(JSON.parse(s)); } catch { /* série illisible → repartira à 1 */ }
        try {
          if (d) {
            const v = JSON.parse(d);
            setRecordDefi(Number.isFinite(v?.record) ? v.record : 0);
            setDefiFaite(v?.faite === true);
          }
        } catch { /* défi illisible → considéré non fait */ }
        setOnboarding(ob !== '1');
        setOnboardingRatt(obr !== '1');
      } catch { /* stockage KO : on joue quand même, sans records */ }
    })();
    return () => { vivant = false; };
  }, [jour]);

  // nettoyage au démontage : boucles + minuteries (aucun travail fantôme)
  useEffect(() => () => {
    loopRef.current?.stop();
    ventLoopRef.current?.stop();
    rattTimingRef.current?.stop();
    annulerTimers();
  }, [annulerTimers]);

  // (re)lance l'oscillation de l'ingrédient courant. Re-créée À CHAQUE POSE :
  // t0 est repris au même instant que le start natif → le moteur (formule pure de
  // tMs) et le visuel (loop native) restent synchrones, sans dérive cumulée.
  const demarrerPose = useCallback(() => {
    const etat = etatRef.current;
    if (!etat || etat.finie) return;
    const periode = periodeIngredient(etat);
    osc.setValue(0);
    loopRef.current?.stop();
    loopRef.current = Animated.loop(Animated.sequence([
      Animated.timing(osc, { toValue: 1, duration: periode / 2, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(osc, { toValue: 0, duration: periode / 2, easing: Easing.linear, useNativeDriver: true }),
    ]));
    t0Ref.current = Date.now();
    loopRef.current.start();
    if (etat.variante === 'vent') {
      // même onde triangle « centrée » que cibleVisee() : 0 → +1 → −1 → 0
      vent.setValue(0);
      ventLoopRef.current?.stop();
      ventLoopRef.current = Animated.loop(Animated.sequence([
        Animated.timing(vent, { toValue: 1, duration: VENT_PERIODE / 4, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(vent, { toValue: -1, duration: VENT_PERIODE / 2, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(vent, { toValue: 0, duration: VENT_PERIODE / 4, easing: Easing.linear, useNativeDriver: true }),
      ]));
      ventLoopRef.current.start();
    }
  }, [osc, vent]);

  const nouvellePartie = useCallback((mode: Mode) => {
    annulerTimers();
    loopRef.current?.stop();
    ventLoopRef.current?.stop();
    rattTimingRef.current?.stop();
    modeRef.current = mode;
    // graine : horloge ⊕ compteur pour le mode libre (l'écran a le droit de lire
    // l'horloge, PAS le moteur) ; graine du jour, identique pour tous, en défi.
    const seed = mode.type === 'defi'
      ? mode.defi.seed
      : ((Date.now() ^ (compteurRef.current++ * 0x9E3779B9)) >>> 0);
    etatRef.current = creerPartie(seed, mode.type === 'defi' ? mode.defi.variante : null);
    setEnDefi(mode.type === 'defi');
    setPiles([]);
    setBandes(0);
    setHud({ ...HUD_VIERGE, courant: etatRef.current.file[0] });
    setChute(null);
    setRatt(null);
    setScellementAff(null);
    setVerdictAff(null);
    setRecap(null);
    setBulleRatt(false);
    deriveAnim.setValue(0);
    largeurAnim.setValue(LARGEUR_INITIALE);
    rattAnim.setValue(0.5); // repos = équilibre (0°)
    poseEnCoursRef.current = false;
    rattResoluRef.current = false;
    rattEchecResRef.current = null;
    setPhase('pret');
    demarrerPose();
  }, [annulerTimers, demarrerPose, deriveAnim, largeurAnim, rattAnim]);

  // première partie : dès que la zone est mesurée et l'écran autorisé
  useEffect(() => {
    if (visible && zone && !etatRef.current) nouvellePartie({ type: 'libre' });
  }, [visible, zone, nouvellePartie]);

  // — fin de partie : records, série, objectifs (persistance locale seulement) —
  const finaliser = useCallback(() => {
    const etat = etatRef.current;
    if (!etat) return;
    const res = resultatDe(etat);
    const enDefiFin = modeRef.current.type === 'defi';
    // série de jours joués — SANS malus (majSerie : un oubli repart à 1, sans reproche)
    const serieNv = majSerie(serie, jour);
    setSerie(serieNv);
    AsyncStorage.setItem(CLE_SERIE, JSON.stringify(serieNv)).catch(() => {});
    // record du DÉFI séparé du record libre (clés distinctes, celle du défi datée)
    const precedent = enDefiFin ? recordDefi : record;
    const nouveauRecord = res.score > precedent && res.score > 0;
    const recordCourant = Math.max(precedent, res.score);
    if (enDefiFin) {
      setRecordDefi(recordCourant);
      setDefiFaite(true);
      AsyncStorage.setItem(cleDefi(jour), JSON.stringify({ record: recordCourant, faite: true })).catch(() => {});
    } else if (nouveauRecord) {
      setRecord(recordCourant);
      AsyncStorage.setItem(CLE_RECORD, String(recordCourant)).catch(() => {});
    }
    if (res.meilleurCombo > recordCombo) {
      setRecordCombo(res.meilleurCombo);
      AsyncStorage.setItem(CLE_MEILLEUR_COMBO, String(res.meilleurCombo)).catch(() => {});
    }
    // la HAUTEUR — le nouveau record star (commun libre/défi : c'est la tour)
    const nouveauRecordEtages = res.etages > recordEtages;
    const recordEtagesCourant = Math.max(recordEtages, res.etages);
    if (nouveauRecordEtages) {
      setRecordEtages(recordEtagesCourant);
      AsyncStorage.setItem(CLE_RECORD_ETAGES, String(recordEtagesCourant)).catch(() => {});
    }
    setRecap({
      res,
      objectifsOk: evaluerObjectifs(res, objectifs),
      nouveauRecord,
      record: recordCourant,
      recordEtages: recordEtagesCourant,
      nouveauRecordEtages,
      serie: serieNv,
      enDefi: enDefiFin,
    });
    setPhase('fini');
    hapticLourd(); // il n'y a plus de « victoire » : toute fin est une chute
  }, [jour, serie, record, recordDefi, recordCombo, recordEtages, objectifs]);

  // — scellement d'étage : couvercle qui claque + bonus flottant, puis la pile
  //   se compresse en bandeau et l'étage neuf commence (petit moment de fête) —
  const jouerScellement = useCallback((sc: Scellement) => {
    setPhase('scellement');
    setScellementAff(sc);
    hapticSucces();
    setVerdictAff({
      texte: `ÉTAGE ${sc.etage} SCELLÉ !`,
      couleur: sc.sansFaute ? C.vert : C.jaune,
      points: sc.bonus + sc.bonusSansFaute,
      cle: ++cleRef.current,
    });
    verdictAnim.setValue(0);
    Animated.timing(verdictAnim, { toValue: 1, duration: 820, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    programmer(() => {
      const etat = etatRef.current;
      if (!etat) return;
      setScellementAff(null);
      setPiles([]);
      setBandes(etat.etage - 1);
      setHud((h) => ({
        ...h, score: etat.score, largeur: etat.largeur,
        etage: etat.etage, posesEtage: etat.posesEtage,
        courant: etat.finie ? null : etat.file[etat.indice],
      }));
      // l'étage neuf redonne de l'air : les parois se ROUVRENT (ça se voit)
      Animated.timing(largeurAnim, { toValue: etat.largeur, duration: 300, useNativeDriver: true }).start();
      setPhase('pret');
      demarrerPose();
    }, 720);
  }, [programmer, verdictAnim, largeurAnim, demarrerPose]);

  // — issue d'une fenêtre de rattrapage (tap réussi, tap manqué ou expiration) —
  const apresRattrapage = useCallback((resR: ResultatRattrapage) => {
    const etat = etatRef.current;
    if (!etat) return;
    rattTimingRef.current?.stop();
    setRatt(null);
    setBulleRatt(false);
    if (resR.reussi) {
      hapticSucces();
      // la tour se REDRESSE net (0,5 = point d'équilibre du triangle)
      Animated.timing(rattAnim, { toValue: 0.5, duration: 150, useNativeDriver: true }).start();
      Animated.timing(largeurAnim, { toValue: resR.largeur, duration: 260, useNativeDriver: true }).start();
      setVerdictAff({ texte: 'RATTRAPÉ !', couleur: C.vert, points: 0, cle: ++cleRef.current });
      verdictAnim.setValue(0);
      Animated.timing(verdictAnim, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    } else {
      // la tour retombe sur sa faute — rien de PIRE (jamais de double peine)
      Animated.timing(rattAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
    setHud((h) => ({ ...h, largeur: resR.largeur, posesEtage: etat.posesEtage }));
    if (resR.scellement) {
      programmer(() => {
        Animated.timing(rattAnim, { toValue: 0.5, duration: 180, useNativeDriver: true }).start();
        jouerScellement(resR.scellement as Scellement);
      }, resR.reussi ? 420 : 200);
    } else {
      programmer(() => {
        const e = etatRef.current;
        if (!e || e.finie) return;
        // la tour se stabilise (retour à 0° hors vacillement) et on reprend
        Animated.timing(rattAnim, { toValue: 0.5, duration: 180, useNativeDriver: true }).start();
        setHud((h) => ({ ...h, courant: e.file[e.indice] }));
        setPhase('pret');
        demarrerPose();
      }, resR.reussi ? 480 : 220);
    }
  }, [rattAnim, largeurAnim, verdictAnim, programmer, jouerScellement, demarrerPose]);

  // — ouverture de la fenêtre de vacillement (après l'atterrissage du bancal /
  //   la chute du raté). Marqueur = triangle pur de 900 ms rendu par UNE
  //   interpolation native ; t0 partagé avec la mesure du 2e tap. —
  const ouvrirRattrapage = useCallback((evt: EvtPose) => {
    const cote: 1 | -1 = evt.offsetSigne >= 0 ? 1 : -1;
    setRatt({ cote, cle: ++cleRef.current });
    setPhase('rattrapage');
    rattResoluRef.current = false;
    rattEchecResRef.current = null;
    if (onboardingRatt) {
      // 2e (et dernière) bulle d'onboarding : au premier vacillement.
      setBulleRatt(true);
      setOnboardingRatt(false);
      AsyncStorage.setItem(CLE_ONBOARDING_RATTRAPAGE, '1').catch(() => {});
    }
    rattAnim.setValue(0);
    rattTimingRef.current?.stop();
    rattTimingRef.current = Animated.timing(rattAnim, {
      toValue: 1, duration: RATTRAPAGE_DUREE_MS, easing: Easing.linear, useNativeDriver: true,
    });
    t0RattRef.current = Date.now();
    rattTimingRef.current.start();
    programmer(() => {
      const etat = etatRef.current;
      if (!etat) return;
      if (rattEchecResRef.current) {
        // tap manqué plus tôt : la fenêtre vient de se refermer, on reprend
        const r = rattEchecResRef.current;
        rattEchecResRef.current = null;
        apresRattrapage(r);
      } else if (!rattResoluRef.current) {
        // aucun tap : on résout MANQUÉ (hors fenêtre) — jamais deux fenêtres
        rattResoluRef.current = true;
        apresRattrapage(rattraper(etat, RATTRAPAGE_DUREE_MS + 1));
      }
      // (tap réussi : apresRattrapage a déjà repris la partie, rien à faire)
    }, RATTRAPAGE_DUREE_MS + 40);
  }, [onboardingRatt, rattAnim, programmer, apresRattrapage]);

  // — LE geste : un tap n'importe où dans la zone. En phase « pret » il lâche
  //   l'ingrédient ; pendant un vacillement c'est le 2e battement : rattraper. —
  const onTap = useCallback(() => {
    const etat = etatRef.current;
    // — 2e battement : le rattrapage (un seul par pose, jugé par le moteur) —
    if (phase === 'rattrapage') {
      if (!etat || rattResoluRef.current) return;
      rattResoluRef.current = true;
      const resR = rattraper(etat, Date.now() - t0RattRef.current);
      if (resR.reussi) {
        apresRattrapage(resR);
      } else {
        // manqué : rien de pire — la tour finit son vacillement, puis on reprend
        hapticLeger();
        rattEchecResRef.current = resR;
      }
      return;
    }
    if (onboarding) {
      // la bulle disparaît au premier tap JOUÉ (le tap joue quand même)
      setOnboarding(false);
      AsyncStorage.setItem(CLE_ONBOARDING, '1').catch(() => {});
    }
    if (phase !== 'pret' || poseEnCoursRef.current || !etat || etat.finie) return;
    poseEnCoursRef.current = true;
    // t mesuré CÔTÉ ÉCRAN depuis le début de la pose — le moteur reste pur.
    const t = Date.now() - t0Ref.current;
    const xTapU = positionIngredient(etat, t);
    const evt = lacher(etat, t);
    loopRef.current?.stop();
    ventLoopRef.current?.stop();
    if (evt.verdict === 'parfait') hapticMoyen();
    else if (evt.verdict === 'rate' || evt.basculee) hapticLourd();
    else hapticLeger();
    setChute({ evt, xTapU, cle: ++cleRef.current });
    setPhase('chute');
    chuteProg.setValue(0);
    squash.setValue(1);
    if (evt.verdict === 'rate') {
      // le raté passe à côté du gobelet et disparaît en contrebas
      Animated.timing(chuteProg, { toValue: 1.6, duration: 330, easing: Easing.in(Easing.quad), useNativeDriver: true }).start();
    } else {
      Animated.sequence([
        Animated.timing(chuteProg, { toValue: 1, duration: 190, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        // petit squash à l'atterrissage — le poids de l'ingrédient se SENT
        Animated.timing(squash, { toValue: 0.72, duration: 60, useNativeDriver: true }),
        Animated.timing(squash, { toValue: 1, duration: 90, useNativeDriver: true }),
      ]).start();
    }
    programmer(() => {
      const etatCommit = etatRef.current;
      if (!etatCommit) return;
      if (evt.verdict !== 'rate') {
        // la pile est tenue CÔTÉ ÉCRAN (le moteur vide la sienne au scellement)
        setPiles((p) => [...p, { id: evt.ingredient, x: evt.x, cle: ++cleRef.current }]);
      }
      setChute(null);
      setHud({
        score: evt.score, combo: evt.combo, largeur: evt.largeur,
        derive: evt.derive, etage: evt.etage, posesEtage: evt.posesEtage,
        courant: evt.suivant,
      });
      const lib = LIBELLE_VERDICT[evt.verdict];
      setVerdictAff({ texte: lib.texte, couleur: lib.couleur, points: evt.points, cle: ++cleRef.current });
      verdictAnim.setValue(0);
      Animated.timing(verdictAnim, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      // l'inclinaison suit la dérive : elle se VOIT venir bien avant la bascule
      Animated.timing(deriveAnim, { toValue: evt.derive, duration: 260, useNativeDriver: true }).start();
      // …et les PAROIS suivent la largeur : chaque erreur se referme, chaque
      // parfait rouvre — la barre de vie est GÉOMÉTRIQUE, plus de jauge.
      Animated.timing(largeurAnim, { toValue: evt.largeur, duration: 240, useNativeDriver: true }).start();
      poseEnCoursRef.current = false;
      if (evt.fini) finaliser();
      else if (evt.rattrapage) ouvrirRattrapage(evt);
      else if (evt.scellement) jouerScellement(evt.scellement);
      else { setPhase('pret'); demarrerPose(); }
    }, evt.verdict === 'rate' ? 340 : 350);
  }, [phase, onboarding, chuteProg, squash, verdictAnim, deriveAnim, largeurAnim,
    programmer, finaliser, ouvrirRattrapage, jouerScellement, demarrerPose, apresRattrapage]);

  // ------------------------------------------------------------------
  // Gate d'accès — APRÈS tous les hooks. Fail-closed : rien tant qu'on ne
  // sait pas, retour accueil si le flag est coupé (cf. useTowerVisible).
  // ------------------------------------------------------------------
  if (!visible) return charge ? <Redirect href={'/' as any} /> : null;

  // — géométrie (dérivée de la mesure ; re-calculée seulement aux re-renders de tap) —
  const l = zone?.l ?? 0;
  const h = zone?.h ?? 0;
  const G = Math.min(l * 0.66, 260);                       // largeur du gobelet (px)
  const ech = G / LARGEUR_GOBELET;                         // px par unité logique
  const ampPx = AMPLITUDE_OSCILLATION * ech;
  const hBande = 9;                                        // un étage scellé, compressé
  const maxBandes = 5;                                     // au-delà, la tour « s'enfonce »
  const hCouche = Math.max(10, Math.min(19, Math.floor((h - 236 - maxBandes * hBande) / POSES_PAR_ETAGE)));
  const bandesVisibles = Math.min(bandes, maxBandes);
  const basePile = 26 + bandesVisibles * hBande;           // fond de l'étage courant
  const hGobelet = 26 + maxBandes * hBande + POSES_PAR_ETAGE * hCouche + 12;
  const yOscillateur = 26 + maxBandes * hBande + POSES_PAR_ETAGE * hCouche + 30;
  const centreX = l / 2;
  const ingCourant = hud.courant ? INGREDIENTS[hud.courant] : null;
  const sommetY = basePile + piles.length * hCouche;       // sommet actuel de l'étage

  const rotationPile = deriveAnim.interpolate({
    inputRange: [-DERIVE_MAX, DERIVE_MAX],
    outputRange: ['-7deg', '7deg'],
    extrapolate: 'clamp',
  });
  // vacillement du rattrapage : penché → ÉQUILIBRE (à mi-fenêtre) → penché.
  // Le triangle du moteur (marqueurRattrapage) est EXACTEMENT cette interpolation.
  const rotationRatt = rattAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ratt && ratt.cote < 0 ? ['-6deg', '0deg', '-6deg'] : ['6deg', '0deg', '6deg'],
  });
  const deriveTx = deriveAnim.interpolate({
    inputRange: [-DERIVE_MAX, DERIVE_MAX],
    outputRange: [-DERIVE_MAX * ech, DERIVE_MAX * ech],
    extrapolate: 'clamp',
  });
  // les parois : écart = largeur (u) → px. Native driver, une valeur, deux vues.
  const paroiGaucheTx = largeurAnim.interpolate({
    inputRange: [0, LARGEUR_INITIALE],
    outputRange: [0, -(LARGEUR_INITIALE / 2) * ech],
  });
  const paroiDroiteTx = largeurAnim.interpolate({
    inputRange: [0, LARGEUR_INITIALE],
    outputRange: [0, (LARGEUR_INITIALE / 2) * ech],
  });
  // marqueur du rattrapage : course du bord (côté du penchement) à l'équilibre
  const jaugeDemiCourse = Math.min(l * 0.3, 110);
  const zoneEquilibre = jaugeDemiCourse * (RATTRAPAGE_FENETRE_MS / (RATTRAPAGE_DUREE_MS / 2));
  const marqueurTx = rattAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ratt && ratt.cote < 0
      ? [-jaugeDemiCourse, 0, -jaugeDemiCourse]
      : [jaugeDemiCourse, 0, jaugeDemiCourse],
  });

  const varianteActive = etatRef.current?.variante ? VARIANTES[etatRef.current.variante] : null;

  return (
    <View style={styles.fond}>
      {/* Route auto-découverte dans le Tabs racine : on se déclare SOI-MÊME sans
          onglet ni barre (plein écran, comme /jeu) — app-tabs.tsx n'est pas modifié. */}
      <Tabs.Screen options={{
        tabBarStyle: { display: 'none' },
        tabBarButton: () => null,
        tabBarItemStyle: { display: 'none' },
      }} />

      {/* ===== En-tête ===== */}
      <View style={[styles.entete, { paddingTop: insets.top + 8 }]}>
        <View style={styles.enteteRang}>
          <Pressable
            accessibilityRole="button" accessibilityLabel="Retour à l’accueil"
            onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/' as any); }}
            style={styles.retour} hitSlop={8}>
            <Text style={styles.retourTxt}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.titre}>Boba Tower</Text>
            <Text style={styles.sousTitre}>La tour vivante</Text>
          </View>
          <View style={styles.pillRecord}>
            <Text style={styles.pillRecordTxt}>🏆 {enDefi ? recordDefi : record}</Text>
          </View>
        </View>
        {/* Ligne quête — INFORMATIVE (aucune mécanique réelle au prototype) */}
        <Text style={styles.ligneQuete}>
          Joue où tu veux pour battre ton record. Scanne ta carte lors d’un achat
          Bubble Stop pour obtenir des Clés de boutique et progresser vers de vrais lots.
        </Text>
        <View style={styles.hudRang}>
          <Text style={styles.score}>{hud.score}</Text>
          {hud.combo >= 2 && (
            <View style={styles.pillCombo}><Text style={styles.pillComboTxt}>Combo ×{hud.combo}</Text></View>
          )}
          <View style={{ flex: 1 }} />
          {varianteActive && (
            <View style={styles.pillVariante}>
              <Text style={styles.pillVarianteTxt}>{varianteActive.emoji} {varianteActive.nom}</Text>
            </View>
          )}
          {/* le compteur d'étage : la HAUTEUR est le nouveau record star */}
          <View style={styles.pillEtage}>
            <Text style={styles.pillEtageTxt}>Étage {hud.etage}</Text>
            <Text style={styles.pillEtageSous}>{hud.posesEtage}/{POSES_PAR_ETAGE}</Text>
          </View>
        </View>
      </View>

      {/* ===== Zone de jeu — UN SEUL DOIGT : tap = lâcher, re-tap = rattraper ===== */}
      <Pressable
        style={styles.zone}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          // une seule mesure utile : on ignore les variations < 1 px
          setZone((z) => (z && Math.abs(z.l - width) < 1 && Math.abs(z.h - height) < 1 ? z : { l: width, h: height }));
        }}
        onPressIn={onTap}
        accessibilityRole="button"
        accessibilityLabel="Zone de jeu. Touche pour faire tomber l’ingrédient. Si la tour vacille, retouche au bon moment pour la rattraper.">
        {zone && (
          <>
            {/* gobelet crème (statique — c'est la PILE qui s'incline, pas le verre) */}
            <View pointerEvents="none" style={[styles.gobeletParoi, { left: centreX - G / 2 - 10, height: hGobelet, bottom: 8 }]} />
            <View pointerEvents="none" style={[styles.gobeletParoi, { left: centreX + G / 2 + 2, height: hGobelet, bottom: 8 }]} />
            <View pointerEvents="none" style={[styles.gobeletFond, { left: centreX - G / 2 - 10, width: G + 20, bottom: 8 }]} />
            <View pointerEvents="none" style={[styles.gobeletVitre, { left: centreX - G / 2, width: G, height: hGobelet - 12, bottom: 14 }]} />

            {/* étages déjà scellés : bandeaux compressés au fond (la hauteur se voit) */}
            {Array.from({ length: bandesVisibles }, (_, i) => (
              <View
                key={i}
                pointerEvents="none"
                style={[styles.bandeEtage, {
                  left: centreX - G / 2 + 6, width: G - 12,
                  bottom: 22 + i * hBande, height: hBande - 2,
                }]}
              />
            ))}

            {/* pile de l'étage courant : Views statiques, inclinées selon la dérive
                (+ le vacillement du rattrapage par-dessus, même transform) */}
            <Animated.View
              pointerEvents="none"
              style={[styles.pile, {
                left: centreX - G / 2, width: G, bottom: 14, height: hGobelet,
                transform: [{ rotate: rotationPile }, { rotate: rotationRatt }],
              }]}>
              {piles.map((p, i) => {
                const larg = INGREDIENTS[p.id].largeur * ech;
                return (
                  <View
                    key={p.cle}
                    style={[styles.couche, {
                      width: larg, height: hCouche - 1,
                      left: G / 2 + p.x * ech - larg / 2,
                      bottom: basePile - 14 + i * hCouche,
                      backgroundColor: COULEUR_INGREDIENT[p.id],
                    }]}
                  />
                );
              })}
              {/* couvercle du scellement : il CLAQUE sur l'étage complet */}
              {scellementAff && (
                <View style={[styles.couvercle, {
                  width: G * 0.8, left: G * 0.1,
                  bottom: basePile - 14 + POSES_PAR_ETAGE * hCouche + 2,
                }]}>
                  <Text style={styles.couvercleTxt}>🧋</Text>
                </View>
              )}
            </Animated.View>

            {/* LES PAROIS DU SOMMET : la largeur EST la barre de vie — elles se
                resserrent à chaque erreur, se rouvrent sur un parfait/étage neuf */}
            <Animated.View
              pointerEvents="none"
              style={[styles.paroisSommet, { left: centreX, bottom: sommetY + 2, transform: [{ translateX: deriveTx }] }]}>
              <Animated.View style={[styles.paroiVie, { height: hCouche + 20, transform: [{ translateX: paroiGaucheTx }] }]} />
              <Animated.View style={[styles.paroiVie, { height: hCouche + 20, transform: [{ translateX: paroiDroiteTx }] }]} />
            </Animated.View>

            {/* repère de visée : le centre du sommet (dérive + Vent éventuel) */}
            {phase === 'pret' && (
              <View pointerEvents="none" style={[styles.repere, { left: centreX + hud.derive * ech, bottom: sommetY + 16 }]}>
                <Animated.View style={{
                  alignItems: 'center',
                  transform: [{ translateX: vent.interpolate({ inputRange: [-1, 1], outputRange: [-VENT_AMPLITUDE * ech, VENT_AMPLITUDE * ech] }) }],
                }}>
                  <View style={styles.repereTriangle} />
                  <View style={styles.repereLigne} />
                </Animated.View>
              </View>
            )}

            {/* ingrédient oscillant — 100 % native driver, aucun setState par frame */}
            {phase === 'pret' && ingCourant && (
              <Animated.View
                pointerEvents="none"
                style={[styles.oscillateur, {
                  left: centreX - (ingCourant.largeur * ech) / 2,
                  bottom: yOscillateur,
                  transform: [{ translateX: osc.interpolate({ inputRange: [0, 1], outputRange: [-ampPx, ampPx] }) }],
                }]}>
                <Text style={styles.oscEmoji}>{ingCourant.emoji}</Text>
                <View style={[styles.oscBarre, {
                  width: ingCourant.largeur * ech, height: hCouche + 3,
                  backgroundColor: COULEUR_INGREDIENT[ingCourant.id],
                }]} />
              </Animated.View>
            )}

            {/* chute : du point de lâcher vers la position posée (rebond popping
                visible), ou à côté du gobelet pour un raté */}
            {chute && (
              <Animated.View
                key={chute.cle}
                pointerEvents="none"
                style={[styles.oscillateur, {
                  left: centreX - (INGREDIENTS[chute.evt.ingredient].largeur * ech) / 2,
                  bottom: yOscillateur,
                  opacity: chute.evt.verdict === 'rate'
                    ? chuteProg.interpolate({ inputRange: [0, 1, 1.6], outputRange: [1, 1, 0] })
                    : 1,
                  transform: [
                    {
                      translateX: chuteProg.interpolate({
                        inputRange: [0, 1],
                        outputRange: [chute.xTapU * ech, chute.evt.x * ech],
                        extrapolate: 'extend',
                      }),
                    },
                    {
                      translateY: chuteProg.interpolate({
                        inputRange: [0, 1, 1.6],
                        outputRange: [0, yOscillateur - sommetY, yOscillateur - 2],
                      }),
                    },
                    { scaleY: squash },
                  ],
                }]}>
                <Text style={styles.oscEmoji}>{INGREDIENTS[chute.evt.ingredient].emoji}</Text>
                <View style={[styles.oscBarre, {
                  width: INGREDIENTS[chute.evt.ingredient].largeur * ech, height: hCouche + 3,
                  backgroundColor: COULEUR_INGREDIENT[chute.evt.ingredient],
                }]} />
              </Animated.View>
            )}

            {/* LE VACILLEMENT : jauge d'équilibre — le marqueur fait UN aller-retour
                (triangle 900 ms) ; retoucher quand il traverse la zone d'équilibre */}
            {ratt && (
              <View
                key={ratt.cle}
                pointerEvents="none"
                style={[styles.jaugeRatt, { bottom: yOscillateur + 6, left: centreX - jaugeDemiCourse - 14, width: (jaugeDemiCourse + 14) * 2 }]}>
                <View style={styles.jaugeLigne} />
                <View style={[styles.jaugeZone, { width: zoneEquilibre * 2 }]} />
                <Animated.View style={[styles.jaugeMarqueur, { transform: [{ translateX: marqueurTx }] }]}>
                  <Text style={styles.jaugeMarqueurTxt}>🫨</Text>
                </Animated.View>
              </View>
            )}

            {/* verdict flottant — toujours en TEXTE, jamais la couleur seule */}
            {verdictAff && (
              <Animated.View
                key={verdictAff.cle}
                pointerEvents="none"
                style={[styles.verdict, {
                  bottom: yOscillateur + 44,
                  opacity: verdictAnim.interpolate({ inputRange: [0, 0.12, 0.75, 1], outputRange: [0, 1, 1, 0] }),
                  transform: [{ translateY: verdictAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -30] }) }],
                }]}>
                <Text style={[styles.verdictTxt, { color: verdictAff.couleur }]}>{verdictAff.texte}</Text>
                {verdictAff.points > 0 && <Text style={styles.verdictPoints}>+{verdictAff.points}</Text>}
              </Animated.View>
            )}

            {/* onboarding 1 : UNE bulle au tout premier lancement, disparaît au 1er tap */}
            {onboarding && phase === 'pret' && (
              <View pointerEvents="none" style={styles.bulleOnboarding}>
                <Text style={styles.bulleTxt}>
                  Touche pour faire tomber l’ingrédient.{'\n'}Centre-le pour créer un combo.
                </Text>
                <View style={styles.bullePointe} />
              </View>
            )}
            {/* onboarding 2 (la dernière autorisée) : au premier vacillement */}
            {bulleRatt && (
              <View pointerEvents="none" style={styles.bulleOnboarding}>
                <Text style={styles.bulleTxt}>
                  Si ça vacille, retouche l’écran au bon moment pour rattraper !
                </Text>
                <View style={styles.bullePointe} />
              </View>
            )}
          </>
        )}
      </Pressable>

      {/* ===== Pied : état de la tour + série (plus AUCUNE jauge à pastilles :
            la largeur se lit sur les parois, l'alerte est un simple texte) ===== */}
      <View style={[styles.pied, { paddingBottom: insets.bottom + 10 }]}>
        {hud.largeur <= 34 && phase !== 'fini' && (
          <Text style={styles.alerte}>⚠️ La tour s’étrangle — vise le centre !</Text>
        )}
        <View style={{ flex: 1 }} />
        <Text style={styles.serieTxt}>🔥 {serie?.jours ?? 0} j</Text>
      </View>

      {/* ===== Fin de partie : carte résultat + REJOUER prioritaire ===== */}
      {phase === 'fini' && recap && (
        <View style={styles.finFond}>
          <ScrollView
            contentContainerStyle={[styles.finContenu, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}>
            <View style={styles.finCarte}>
              <Text style={styles.finTitre}>
                {recap.res.raisonBascule === 'derive' ? 'La tour a glissé…' : 'La tour s’est étranglée…'}
              </Text>
              <CompteurScore cible={recap.res.score} />
              {recap.nouveauRecord && (
                <View style={styles.badgeRecord}><Text style={styles.badgeRecordTxt}>NOUVEAU RECORD !</Text></View>
              )}
              <Text style={styles.finRecord}>
                {recap.enDefi ? 'Record du défi' : 'Record'} : {recap.record}
              </Text>

              {/* la HAUTEUR — le record star de la tour vivante */}
              <View style={styles.finHauteur}>
                <Text style={styles.finHauteurNb}>Étage {recap.res.etages}</Text>
                <Text style={styles.finHauteurLabel}>
                  {recap.nouveauRecordEtages ? 'Nouvelle meilleure hauteur !' : `Meilleure hauteur : étage ${recap.recordEtages}`}
                </Text>
              </View>

              <View style={styles.finStats}>
                <View style={styles.finStat}>
                  <Text style={styles.finStatNb}>{recap.res.poses}</Text>
                  <Text style={styles.finStatLabel}>Poses</Text>
                </View>
                <View style={styles.finStat}>
                  <Text style={styles.finStatNb}>×{recap.res.meilleurCombo}</Text>
                  <Text style={styles.finStatLabel}>Meilleur combo</Text>
                </View>
                <View style={styles.finStat}>
                  <Text style={styles.finStatNb}>{recap.res.rattrapages}</Text>
                  <Text style={styles.finStatLabel}>Rattrapés</Text>
                </View>
                <View style={styles.finStat}>
                  <Text style={styles.finStatNb}>🔥 {recap.serie.jours}</Text>
                  <Text style={styles.finStatLabel}>Jours joués</Text>
                </View>
              </View>

              <View style={styles.finObjectifs}>
                <Text style={styles.finObjTitre}>Objectifs du jour</Text>
                {objectifs.map((o, i) => (
                  <Text key={o.id} style={[styles.finObjLigne, recap.objectifsOk[i] && styles.finObjOk]}>
                    {recap.objectifsOk[i] ? '✓' : '○'} {o.libelle}
                  </Text>
                ))}
              </View>
            </View>

            {/* REJOUER : énorme, prioritaire, relance IMMÉDIATE (aucun écran entre) */}
            <Pressable
              accessibilityRole="button" accessibilityLabel="Rejouer"
              onPress={() => nouvellePartie(modeRef.current)}
              style={({ pressed }) => [styles.btnRejouer, pressed && { transform: [{ scale: 0.98 }] }]}>
              <Text style={styles.btnRejouerTxt}>REJOUER</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Lancer le défi du jour : ${defi.nom}`}
              onPress={() => nouvellePartie({ type: 'defi', defi })}
              style={styles.chipDefi}>
              <Text style={styles.chipDefiTxt}>
                Défi du jour : {defi.emoji} {defi.nom}{defiFaite ? '  ·  ✓ joué' : ''}
              </Text>
              <Text style={styles.chipDefiSous}>{defi.description}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button" accessibilityLabel="Retour à l’accueil"
              onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/' as any); }}
              style={styles.btnRetourFin} hitSlop={6}>
              <Text style={styles.btnRetourFinTxt}>Retour à l’accueil</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// Score qui COMPTE (count-up ~700 ms) sur la carte de fin. Interval nettoyé au
// démontage — post-partie, donc hors de la contrainte « zéro setState par frame ».
function CompteurScore({ cible }: { cible: number }) {
  const [affiche, setAffiche] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const it = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 700);
      setAffiche(Math.round(cible * (1 - Math.pow(1 - p, 3))));
      if (p >= 1) clearInterval(it);
    }, 33);
    return () => clearInterval(it);
  }, [cible]);
  return <Text style={styles.finScore}>{affiche}</Text>;
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.violet },

  entete: { paddingHorizontal: 18, gap: 8 },
  enteteRang: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  retour: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  retourTxt: { fontFamily: F.t800, fontSize: 24, color: '#fff', marginTop: -3 },
  titre: { fontFamily: F.titre, fontSize: 24, color: '#fff' },
  sousTitre: { fontFamily: F.t600, fontSize: 12.5, color: C.surViolet },
  pillRecord: {
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: R.pill,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  pillRecordTxt: { fontFamily: F.t800, fontSize: 13.5, color: '#fff' },
  ligneQuete: { fontFamily: F.t500, fontSize: 11.5, lineHeight: 16, color: C.surViolet },

  hudRang: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  score: { fontFamily: F.titre, fontSize: 34, color: '#fff' },
  pillCombo: { backgroundColor: C.jaune, borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 10 },
  pillComboTxt: { fontFamily: F.t800, fontSize: 12.5, color: '#5A4A00' },
  pillVariante: {
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: R.pill,
    paddingVertical: 4, paddingHorizontal: 10,
  },
  pillVarianteTxt: { fontFamily: F.t700, fontSize: 11.5, color: '#fff' },
  pillEtage: {
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: R.pill,
    paddingVertical: 4, paddingHorizontal: 12, alignItems: 'center',
  },
  pillEtageTxt: { fontFamily: F.t800, fontSize: 14, color: '#fff' },
  pillEtageSous: { fontFamily: F.t600, fontSize: 10.5, color: C.surViolet },

  zone: { flex: 1 },
  gobeletParoi: {
    position: 'absolute', width: 8, borderRadius: 5, backgroundColor: C.jaunePale, opacity: 0.95,
  },
  gobeletFond: { position: 'absolute', height: 10, borderRadius: 6, backgroundColor: C.jaunePale },
  gobeletVitre: {
    position: 'absolute', backgroundColor: 'rgba(255,255,255,0.07)',
    borderTopLeftRadius: 6, borderTopRightRadius: 6,
  },
  bandeEtage: {
    position: 'absolute', borderRadius: 4, backgroundColor: C.violetProfond,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)',
  },
  pile: { position: 'absolute' },
  couche: { position: 'absolute', borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)' },
  couvercle: {
    position: 'absolute', height: 22, borderRadius: 10, backgroundColor: C.rose,
    alignItems: 'center', justifyContent: 'center',
  },
  couvercleTxt: { fontSize: 13, marginTop: -1 },

  paroisSommet: { position: 'absolute', width: 0, alignItems: 'center' },
  paroiVie: {
    position: 'absolute', bottom: 0, width: 5, borderRadius: 3,
    backgroundColor: C.jaune, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)',
  },

  repere: { position: 'absolute', width: 0, alignItems: 'center' },
  repereTriangle: {
    width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: C.jaune,
  },
  repereLigne: { width: 2, height: 12, backgroundColor: C.jaune, opacity: 0.55, borderRadius: 1 },

  oscillateur: { position: 'absolute', alignItems: 'center', gap: 3 },
  oscEmoji: { fontSize: 21 },
  oscBarre: { borderRadius: 7, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },

  jaugeRatt: { position: 'absolute', height: 40, alignItems: 'center', justifyContent: 'center' },
  jaugeLigne: { position: 'absolute', left: 6, right: 6, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  jaugeZone: {
    position: 'absolute', height: 16, borderRadius: 8, backgroundColor: C.vert, opacity: 0.85,
  },
  jaugeMarqueur: { position: 'absolute', alignItems: 'center' },
  jaugeMarqueurTxt: { fontSize: 24 },

  verdict: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  verdictTxt: {
    fontFamily: F.titre, fontSize: 26, color: '#fff',
    textShadowColor: 'rgba(42,29,70,0.6)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 },
  },
  verdictPoints: { fontFamily: F.t800, fontSize: 15, color: '#fff', opacity: 0.9 },

  bulleOnboarding: {
    position: 'absolute', top: '30%', alignSelf: 'center', maxWidth: 300,
    backgroundColor: '#fff', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18,
    alignItems: 'center', ...OMBRE,
  },
  bulleTxt: { fontFamily: F.t700, fontSize: 14.5, lineHeight: 21, color: C.texte, textAlign: 'center' },
  bullePointe: {
    position: 'absolute', bottom: -8, width: 0, height: 0,
    borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#fff',
  },

  pied: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 6, gap: 10 },
  alerte: { fontFamily: F.t800, fontSize: 12, color: C.jaune },
  serieTxt: { fontFamily: F.t800, fontSize: 14, color: '#fff' },

  finFond: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(42,29,70,0.88)' },
  finContenu: { flexGrow: 1, justifyContent: 'center', padding: 22, gap: 14 },
  finCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 20, gap: 10, alignItems: 'center',
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  finTitre: { fontFamily: F.titre, fontSize: 22, color: C.violet, textAlign: 'center' },
  finScore: { fontFamily: F.titre, fontSize: 44, color: C.texte },
  badgeRecord: { backgroundColor: C.jaune, borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 14 },
  badgeRecordTxt: { fontFamily: F.t800, fontSize: 13, color: '#5A4A00' },
  finRecord: { fontFamily: F.t600, fontSize: 13, color: C.texte2 },
  finHauteur: { alignItems: 'center', gap: 1, marginTop: 2 },
  finHauteurNb: { fontFamily: F.titre, fontSize: 26, color: C.violet },
  finHauteurLabel: { fontFamily: F.t700, fontSize: 12.5, color: C.vertFonce },
  finStats: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 4 },
  finStat: { flex: 1, alignItems: 'center', gap: 2 },
  finStatNb: { fontFamily: F.titre, fontSize: 19, color: C.violet },
  finStatLabel: { fontFamily: F.t600, fontSize: 11, color: C.texte2 },
  finObjectifs: { alignSelf: 'stretch', gap: 4, marginTop: 6 },
  finObjTitre: { fontFamily: F.titre, fontSize: 14, color: C.violet },
  finObjLigne: { fontFamily: F.t600, fontSize: 13, color: C.texte2 },
  finObjOk: { fontFamily: F.t700, color: C.vertFonce },

  btnRejouer: {
    backgroundColor: C.vert, borderRadius: R.btn + 4, paddingVertical: 20,
    alignItems: 'center', borderBottomWidth: 6, borderBottomColor: '#6F8F1F',
  },
  btnRejouerTxt: { fontFamily: F.titre, fontSize: 24, color: '#2C380C', letterSpacing: 1 },
  chipDefi: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: R.btn,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', gap: 2,
  },
  chipDefiTxt: { fontFamily: F.t800, fontSize: 14, color: '#fff' },
  chipDefiSous: { fontFamily: F.t500, fontSize: 11.5, color: C.surViolet, textAlign: 'center' },
  btnRetourFin: { alignItems: 'center', paddingVertical: 8 },
  btnRetourFinTxt: { fontFamily: F.t700, fontSize: 14, color: C.surViolet },
});
