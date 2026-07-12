// === Boba Quest — « Perle Rush », le bubble shooter (v3) ===
// Deux modes :
// • AVENTURE (?niveau=N) : libère les capsules accrochées au plateau en un
//   nombre de tirs limité — étoiles ★★★, boss tous les 5 niveaux.
// • INFINI : score et perles, plateau sans fin — AUCUNE capsule.
// Twists : chaîne ×1→×3, REBOND ×1,5, Tir parfait, Shaker Fever du copain,
// boss actifs, aperçu d'impact, et perles spéciales 💣 Bombe / 🌈 Arc-en-ciel.
// La logique vit dans moteur-shooter.ts (testée) — ici : rendu + gestes + anims.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  Animated, Easing, GestureResponderEvent, Modal, PanResponder, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { C, F, OMBRE } from '@/constants/charte';
import {
  activerFever, ApercuTir, BONUS_POINTS, Bulle, Case, creerNiveau, creerPartieInfini,
  echangerMunitions, EtatShooter, etoilesNiveau, FEVER_MAX, GROS_LACHER,
  labelBossActionTir, LARGEUR_TERRAIN, LIGNE_H, LIGNE_LIMITE, Ligne, nbCapsules,
  objectifCible, objectifLabel, paramsNiveau, Point, previsualiserTir, simulerVol,
  Special, tirer, TIR_PARFAIT_SEUIL,
} from '@/components/jeu/moteur-shooter';
import { perlesPourScore, POWERUPS, PowerupId, trouverCollectible } from '@/components/jeu/economie';
import { Icone } from '@/components/jeu/icones';
import { BilleSkia, BullePx, PlateauSkia } from '@/components/jeu/plateau-skia';
import { BoutonJeu, formatNb, IconePerle } from '@/components/jeu/ui-jeu';
import {
  acheterPowerup, bonusJourDispo, consommerPowerup, coutPowerupActuel,
  echecNiveau, effetBuddyActuel, finPartieInfini, StatsPartie, terminerNiveau,
  useBobaQuest,
} from '@/store/jeu';

// Les 6 familles de perles (les niveaux difficiles utilisent la 6e, orange)
const COULEURS = ['#8A68B8', '#A3C724', '#FFD166', '#F3A0BD', '#7EC8E3', '#F7A14B'];
// Noms FR des familles (objectif « éclate N perles … »)
const NOMS_COULEUR = ['violettes', 'vertes', 'jaunes', 'roses', 'bleues', 'orange'];
const ANGLE_MIN = -Math.PI + 0.2;
const ANGLE_MAX = -0.2;

type Volee = {
  av: Animated.Value;
  avChute: Animated.Value;
  eclats: { cle: string; x: number; y: number; couleur: string }[];
  chutes: { cle: string; x: number; y: number; couleur: string; capsule?: boolean; dist: number }[];
  textes: { cle: string; y: number; txt: string; gros?: boolean }[];
};

type Fin =
  | { type: 'victoire'; etoiles: number; perles: number; bonusJour: boolean; premiere: boolean; capsule: 'classique' | 'doree' | null }
  | { type: 'defaite'; raison: 'tirs' | 'limite' }
  | { type: 'infini'; perles: number; bonusJour: boolean; record: boolean };

const STATS_VIERGES = (): StatsPartie => ({
  score: 0, eclatees: 0, orphelines: 0, capsulesLiberees: 0, meilleurGroupe: 0, chaineMax: 0,
});

export default function ShooterScreen() {
  const insets = useSafeAreaInsets();
  const jeu = useBobaQuest();

  // — mode : ?niveau=N → aventure, sinon infini —
  const { niveau: niveauParam } = useLocalSearchParams<{ niveau?: string }>();
  const nParse = niveauParam ? parseInt(String(niveauParam), 10) : NaN;
  const aventure = Number.isFinite(nParse) && nParse >= 1;
  const niveau = aventure ? nParse : 0;
  const params = aventure ? paramsNiveau(niveau) : null;

  // création d'une partie : applique le bonus du « copain de tir » équipé
  const creerEtat = useCallback((): EtatShooter => {
    const e = aventure ? creerNiveau(niveau) : creerPartieInfini();
    const buddy = effetBuddyActuel();
    if (aventure && e.tirsRestants !== null) e.tirsRestants += buddy.tirsBonus;
    e.graceChaine = buddy.graceChaine;
    return e;
  }, [aventure, niveau]);

  const etatRef = useRef<EtatShooter | null>(null);
  if (!etatRef.current) etatRef.current = creerEtat();
  const statsRef = useRef<StatsPartie>(STATS_VIERGES());
  const crediteRef = useRef(false);

  const [, forcer] = useReducer((x: number) => x + 1, 0);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [phase, setPhase] = useState<'pret' | 'anim' | 'fini'>('pret');
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Projectile animé en NATIF : sa position (coin haut-gauche, en px) est pilotée
  // par une Animated.ValueXY → glisse à 60 fps sur le thread natif, rebonds compris.
  const [proj, setProj] = useState<{ couleur: string; special: Special | null } | null>(null);
  const projPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  // Pendant le vol, on FIGE la grille d'avant-tir (sinon la bille posée apparaît
  // instantanément à destination → effet de téléportation).
  const [grilleFigee, setGrilleFigee] = useState<Ligne[] | null>(null);
  const [guide, setGuide] = useState<Point[] | null>(null);
  const [apercu, setApercu] = useState<ApercuTir | null>(null);
  // 🏹 effet lance-pierre : pendant la visée, la bille RECULE à l'opposé du tir comme un
  // élastique tendu (plus le doigt est loin, plus ça tire), puis CLAQUE en avant au lâcher.
  // `recul` anime la bille (Animated) ; `visee` (état) dessine l'élastique en SVG.
  const recul = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const etirement = useRef(new Animated.Value(0)).current;
  const tensionRef = useRef(0); // 0..1 : tension de l'élastique au lâcher → vitesse du tir
  const [visee, setVisee] = useState<{ a: number; r: number } | null>(null);
  const [volee, setVolee] = useState<Volee | null>(null);
  const [fin, setFin] = useState<Fin | null>(null);
  const [armee, setArmee] = useState<Special | null>(null);
  const [feverArmee, setFeverArmee] = useState(false);
  const [messageFever, setMessageFever] = useState<string | null>(null);
  const [achat, setAchat] = useState<PowerupId | null>(null);

  const gridShift = useRef(new Animated.Value(0)).current;
  const secousse = useRef(new Animated.Value(0)).current; // secousse d'écran sur gros combos
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const bonusDispo = bonusJourDispo();

  useEffect(() => () => { animRef.current?.stop(); }, []);

  const secouer = useCallback((force = 1) => {
    Animated.sequence([
      Animated.timing(secousse, { toValue: force, duration: 40, useNativeDriver: true }),
      Animated.timing(secousse, { toValue: -force, duration: 45, useNativeDriver: true }),
      Animated.timing(secousse, { toValue: force * 0.5, duration: 45, useNativeDriver: true }),
      Animated.timing(secousse, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // translation diagonale de l'écran pendant la secousse (jitter juteux)
  const secousseX = secousse.interpolate({ inputRange: [-1.5, 0, 1.5], outputRange: [-10, 0, 10] });
  const secousseY = secousse.interpolate({ inputRange: [-1.5, 0, 1.5], outputRange: [7, 0, -7] });

  // (re)démarrage — aussi quand on passe au niveau suivant (le param change)
  const reinit = useCallback(() => {
    etatRef.current = creerEtat();
    statsRef.current = STATS_VIERGES();
    crediteRef.current = false;
    animRef.current?.stop();
    setFin(null);
    setArmee(null);
    setFeverArmee(false);
    setMessageFever(null);
    setApercu(null);
    setProj(null);
    setGrilleFigee(null);
    setVolee(null);
    setPhase('pret');
    forcer();
  }, [creerEtat]);
  const premierRendu = useRef(true);
  useEffect(() => {
    if (premierRendu.current) { premierRendu.current = false; return; }
    reinit();
  }, [niveau, reinit]);

  // — géométrie px ↔ unités —
  const d = dims ? Math.min(dims.w / LARGEUR_TERRAIN, dims.h / (LIGNE_LIMITE * LIGNE_H + 2.9)) : 0;
  const offX = dims ? (dims.w - d * LARGEUR_TERRAIN) / 2 : 0;
  const yLimite = LIGNE_LIMITE * LIGNE_H * d;
  const lanceur: Point = { x: LARGEUR_TERRAIN / 2, y: LIGNE_LIMITE * LIGNE_H + 1.6 };
  const lanceurPx = { x: offX + lanceur.x * d, y: lanceur.y * d };
  const enPx = (u: Point) => ({ x: offX + u.x * d, y: u.y * d });

  // — visée LANCE-PIERRE : on tire la bille vers le BAS, le tir part à l'OPPOSÉ (vers le haut).
  // Doigt au-dessus du lanceur = pas armé (null) → aucun tir accidentel en touchant le plateau.
  const calculerAngle = useCallback((tx: number, ty: number): number | null => {
    const dx = tx - lanceurPx.x, dy = ty - lanceurPx.y;
    if (Math.hypot(dx, dy) < 14) return null;      // zone morte autour de la bille
    if (dy < d * 0.08) return null;                // on n'arme qu'en étirant vers le BAS
    const a = Math.atan2(-dy, -dx);                // direction du tir = opposé de l'étirement
    return Math.max(ANGLE_MIN, Math.min(ANGLE_MAX, a));
  }, [lanceurPx.x, lanceurPx.y, d]);

  // 🏹 détend l'élastique en douceur (visée annulée / doigt trop près)
  const relacherElastique = useCallback(() => {
    setVisee(null);
    tensionRef.current = 0;
    Animated.spring(recul, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: true }).start();
    Animated.timing(etirement, { toValue: 0, duration: 110, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const majGuide = useCallback((tx: number, ty: number) => {
    const a = calculerAngle(tx, ty);
    if (a === null) { setGuide(null); setApercu(null); relacherElastique(); return; }
    const { points } = simulerVol(etatRef.current!.grille, lanceur, a, 0.16);
    setGuide(points);
    setApercu(previsualiserTir(etatRef.current!, lanceur, a, armee));
    // 🏹 la bille SUIT le doigt (étirement 1:1, plafonné à ~1,5 bille et au bord d'écran)
    const dist = Math.hypot(tx - lanceurPx.x, ty - lanceurPx.y);
    const rMax = Math.max(d * 0.6, Math.min(d * 1.5, (dims ? dims.h : 700) - lanceurPx.y - d * 0.55));
    const r = Math.min(rMax, dist);
    recul.setValue({ x: -Math.cos(a) * r, y: -Math.sin(a) * r });
    etirement.setValue(Math.min(1, r / rMax));
    tensionRef.current = Math.min(1, r / rMax);
    setVisee({ a, r });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculerAngle, d, lanceurPx.x, lanceurPx.y, dims, armee]);

  // — tir —
  const feu = useCallback((angle: number) => {
    const etat = etatRef.current!;
    if (phaseRef.current !== 'pret' || etat.perdu || !dims) return;
    const special = armee;
    if (special && !feverArmee && !consommerPowerup(special)) { setArmee(null); return; }
    setArmee(null);
    setFeverArmee(false);
    setPhase('anim');
    setGuide(null);
    setApercu(null);
    // 🏹 l'élastique CLAQUE proportionnellement à la tension au lâcher
    const tension = Math.max(0.25, Math.min(1, tensionRef.current));
    tensionRef.current = 0;
    setVisee(null);
    Animated.sequence([
      Animated.timing(recul, {
        toValue: { x: Math.cos(angle) * d * (0.1 + 0.16 * tension), y: Math.sin(angle) * d * (0.1 + 0.16 * tension) },
        duration: 70, easing: Easing.out(Easing.quad), useNativeDriver: true,
      }),
      Animated.spring(recul, { toValue: { x: 0, y: 0 }, friction: 4, useNativeDriver: true }),
    ]).start();
    Animated.timing(etirement, { toValue: 0, duration: 90, useNativeDriver: true }).start();

    const couleurTiree = special === 'bombe'
      ? '#2A1D46'
      : special === 'arc' ? '#fff' : COULEURS[etat.couleurCourante];
    // photo de la grille AVANT résolution → affichée pendant tout le vol
    const figee = etat.grille.map((l) => ({ decalee: l.decalee, cases: [...l.cases] }));
    setGrilleFigee(figee);
    const res = tirer(etat, lanceur, angle, Math.random, special, tension >= TIR_PARFAIT_SEUIL);

    // stats de partie (défis du jour)
    const s = statsRef.current;
    s.score = etat.score;
    s.eclatees += res.eclatees.length;
    s.orphelines += res.tombees.filter((t) => !t.bulle.capsule).length;
    s.capsulesLiberees += res.capsules;
    s.meilleurGroupe = Math.max(s.meilleurGroupe, res.groupe);
    s.chaineMax = Math.max(s.chaineMax, etat.chaine);

    // vol du projectile : une Animated.timing par segment de la polyligne
    // (les rebonds sont des segments), enchaînées → glissé fluide et VISIBLE.
    const tl = (p: Point) => ({ x: p.x - d * 0.47, y: p.y - d * 0.47 }); // centre → coin
    const pts = res.trajectoire.map(enPx);
    // 🏹 la VITESSE dépend de la tension : à peine tendu → tir doux, à fond → boulet
    const vitesse = (11 + 21 * tension) * d; // px/s : ~16·d relâché doux → ~32·d à pleine tension
    projPos.setValue(tl(pts[0]));
    setProj({ couleur: couleurTiree, special });
    const segments = [];
    for (let i = 1; i < pts.length; i++) {
      const L = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      segments.push(Animated.timing(projPos, {
        toValue: tl(pts[i]),
        duration: Math.max(45, (L / vitesse) * 1000),
        easing: Easing.linear,
        useNativeDriver: true,
      }));
    }
    animRef.current = Animated.sequence(segments);
    animRef.current.start(({ finished }) => {
      if (!finished) return;
      setProj(null);
      atterrir(res, couleurTiree, figee);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims, d, offX, armee, feverArmee]);

  // — résolution visuelle à l'atterrissage (positions dans la grille FIGÉE) —
  const atterrir = (res: ReturnType<typeof tirer>, couleurTiree: string, figee: Ligne[]) => {
    const etat = etatRef.current!;
    const decalee = (r: number) =>
      figee.length ? (r % 2 === 0 ? figee[0].decalee : !figee[0].decalee) : r % 2 === 1;
    const versPx = (pos: Case) => enPx({
      x: pos.c + 0.5 + (decalee(pos.r) ? 0.5 : 0),
      y: pos.r * LIGNE_H + 0.5,
    });

    const eclats = res.eclatees.map((e, i) => {
      const p = versPx(e.pos);
      return { cle: `e${i}`, x: p.x, y: p.y, couleur: COULEURS[e.bulle.couleur] };
    });
    if (res.eclatees.length && res.pose) {
      const p = versPx(res.pose);
      eclats.push({ cle: 'etir', x: p.x, y: p.y, couleur: couleurTiree });
    }
    const chutes = res.tombees.map((e, i) => {
      const p = versPx(e.pos);
      return {
        cle: `c${i}`, x: p.x, y: p.y,
        couleur: COULEURS[e.bulle.couleur], capsule: e.bulle.capsule,
        dist: (dims ? dims.h : 600) - p.y + 60,
      };
    });
    const textes: Volee['textes'] = [];
    if (res.points > 0) {
      const suffixe = res.multiplicateur >= 2 ? `  ×${res.multiplicateur} 🔥` : '';
      textes.push({ cle: 't0', y: Math.max(60, yLimite * 0.45), txt: `+${formatNb(res.points)}${suffixe}` });
    }
    if (res.rebond) textes.push({ cle: 'tr', y: Math.max(90, yLimite * 0.45) + 30, txt: 'REBOND ! ×1,5', gros: true });
    if (res.tirParfait) textes.push({ cle: 'tparfait', y: Math.max(65, yLimite * 0.38), txt: 'TIR PARFAIT !', gros: true });
    if (res.feverGagne > 0 && etat.fever >= FEVER_MAX) textes.push({ cle: 'tfever', y: yLimite * 0.74, txt: 'SHAKER FEVER PRÊT !', gros: true });
    if (res.bossInterrompu) textes.push({ cle: 'tbi', y: yLimite * 0.24, txt: 'ATTAQUE DU BOSS INTERROMPUE !', gros: true });
    if (res.bossAction) textes.push({ cle: 'tba', y: yLimite * 0.24, txt: `${labelBossActionTir(res.bossAction)} !`, gros: true });
    if (res.explosions > 0) textes.push({ cle: 'tx', y: yLimite * 0.32, txt: res.explosions > 1 ? `💥 ${res.explosions} EXPLOSIONS !` : '💥 BOUM !', gros: true });
    if (res.bonusPop > 0) textes.push({ cle: 'tb', y: yLimite * 0.68, txt: `⭐ +${formatNb(res.bonusPop * BONUS_POINTS)}` });
    if (res.grosLacher >= GROS_LACHER) textes.push({ cle: 'tg', y: yLimite * 0.55, txt: `ÉNORME ! ${res.grosLacher} perles 🎉`, gros: true });
    if (res.capsules > 0) textes.push({ cle: 'tc', y: yLimite - 60, txt: `🎁 capsule libérée !`, gros: true });
    if (res.plateauNettoye) textes.push({ cle: 'tp', y: yLimite / 2, txt: 'PLATEAU NETTOYÉ !', gros: true });

    // secousse d'écran : explosions, gros lâcher, ou gros groupe
    if (res.explosions > 0 || res.grosLacher >= GROS_LACHER) secouer(1.4);
    else if (res.groupe >= 6 || res.tombees.length >= 4) secouer(0.8);

    if (eclats.length || chutes.length || textes.length) {
      const av = new Animated.Value(0);
      const avChute = new Animated.Value(0);
      setVolee({ av, avChute, eclats, chutes, textes });
      Animated.timing(av, { toValue: 1, duration: 420, useNativeDriver: true }).start();
      Animated.timing(avChute, { toValue: 1, duration: 520, easing: Easing.in(Easing.quad), useNativeDriver: true }).start();
      setTimeout(() => setVolee(null), 800);
    }

    if (res.nouvelleLigne) {
      gridShift.setValue(-LIGNE_H * d);
      Animated.timing(gridShift, { toValue: 0, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
    setGrilleFigee(null); // on rebascule sur la grille VIVANTE (bille posée + pops)
    forcer();

    // — fin de partie ? —
    const stats = { ...statsRef.current, score: etat.score };
    if (aventure) {
      if (res.objectifAtteint) {
        // victoire (prioritaire sur tout le reste) — objectif du niveau accompli
        setTimeout(() => {
          if (crediteRef.current) return;
          crediteRef.current = true;
          const etoiles = etoilesNiveau(etat.tirsRestants ?? 0, params!.tirsMax);
          const r = terminerNiveau(niveau, etoiles, params!.boss, stats);
          setFin({ type: 'victoire', etoiles: r.etoiles, perles: r.perlesGagnees, bonusJour: r.bonusJour, premiere: r.premiere, capsule: r.capsule });
          setPhase('fini');
        }, 650);
        return;
      }
      if (etat.perdu || (etat.tirsRestants ?? 1) <= 0) {
        setTimeout(() => {
          if (crediteRef.current) return;
          crediteRef.current = true;
          echecNiveau(stats);
          setFin({ type: 'defaite', raison: etat.perdu ? 'limite' : 'tirs' });
          setPhase('fini');
        }, 650);
        return;
      }
    } else if (etat.perdu) {
      setTimeout(() => {
        if (crediteRef.current) return;
        crediteRef.current = true;
        const r = finPartieInfini(stats);
        setFin({ type: 'infini', perles: r.perlesGagnees, bonusJour: r.bonusJour, record: r.record });
        setPhase('fini');
      }, 650);
      return;
    }
    setPhase('pret');
  };

  // — gestes (PanResponder créé UNE fois, fonctions à jour via refs) —
  const majGuideRef = useRef(majGuide); majGuideRef.current = majGuide;
  const feuRef = useRef(feu); feuRef.current = feu;
  const relacherRef = useRef(relacherElastique); relacherRef.current = relacherElastique;
  const calculerAngleRef = useRef(calculerAngle); calculerAngleRef.current = calculerAngle;
  const dimsRef = useRef(dims); dimsRef.current = dims;
  const dRef = useRef(d); dRef.current = d;
  const lanceurPxRef = useRef(lanceurPx); lanceurPxRef.current = lanceurPx;
  const dansZoneJeu = (e: GestureResponderEvent) => {
    if (phaseRef.current !== 'pret' || !dimsRef.current) return false;
    const { locationX: x, locationY: y } = e.nativeEvent;
    // plateau + zone haute : libres (le glissé peut y démarrer puis descendre armer)
    if (y < dimsRef.current.h - dRef.current * 2.4) return true;
    // 🏹 bande du lanceur : la COLONNE CENTRALE arme le lance-pierre ;
    // les côtés restent aux boutons (perles spéciales à gauche, échange à droite)
    return Math.abs(x - lanceurPxRef.current.x) < dRef.current * 1.25;
  };
  const panHandlers = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: dansZoneJeu,
      // capture aussi un glissé qui démarre par un simple contact (meilleur feel)
      onMoveShouldSetPanResponder: dansZoneJeu,
      onPanResponderGrant: (e) => majGuideRef.current(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderMove: (e) => majGuideRef.current(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderRelease: (e) => {
        setGuide(null);
        setApercu(null);
        const a = calculerAngleRef.current(e.nativeEvent.locationX, e.nativeEvent.locationY);
        if (a !== null) feuRef.current(a);
        else relacherRef.current(); // 🏹 pas de tir → l'élastique se détend
      },
      onPanResponderTerminate: () => { setGuide(null); setApercu(null); relacherRef.current(); },
    }),
  ).current;

  // — sorties —
  const quitter = () => {
    const etat = etatRef.current!;
    if (!crediteRef.current && etat.score > 0) {
      crediteRef.current = true;
      const stats = { ...statsRef.current, score: etat.score };
      if (aventure) echecNiveau(stats);         // abandon = consolation
      else finPartieInfini(stats);
    }
    router.back();
  };
  const versParcours = () => router.back();
  const niveauSuivant = () => router.replace(`/jeu/shooter?niveau=${niveau + 1}` as any);

  // — power-ups —
  const toucherPowerup = (id: PowerupId) => {
    if (phase !== 'pret') return;
    setFeverArmee(false);
    if (jeu.powerups[id] > 0) setArmee(armee === id ? null : id);
    else { setArmee(null); setAchat(id); }
  };

  const declencherFever = () => {
    if (phase !== 'pret') return;
    const pouvoir = jeu.buddyId ? (trouverCollectible(jeu.buddyId)?.set ?? 'neutre') : 'neutre';
    const r = activerFever(etatRef.current!, pouvoir);
    if (!r.active) return;
    if (r.special) {
      setArmee(r.special);
      setFeverArmee(true);
    }
    setMessageFever(r.label);
    setTimeout(() => setMessageFever(null), 1800);
    forcer();
  };

  // — rendu —
  const etat = etatRef.current!;
  const grille = grilleFigee ?? etat.grille; // figée pendant le vol
  const capsulesRestantes = aventure ? nbCapsules(grille) : 0;
  const perlesSiFin = perlesPourScore(etat.score) * (bonusDispo && !crediteRef.current ? 2 : 1);
  const multChaine = Math.min(etat.chaine, 3);
  const bossSeuil = etat.bossPhase === 3 ? 2 : 3;
  const bossDans = Math.max(1, bossSeuil - etat.bossCompteur);

  const pointsGuide: Point[] = [];
  if (guide && d > 0) {
    let reste = 0;
    for (let i = 1; i < guide.length; i++) {
      const a = guide[i - 1], b = guide[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      let t = reste;
      while (t < seg) {
        pointsGuide.push({ x: a.x + ((b.x - a.x) * t) / seg, y: a.y + ((b.y - a.y) * t) / seg });
        t += 0.52;
      }
      reste = t - seg;
    }
  }

  // perles du plateau en px, pour le rendu Skia (figées pendant le vol)
  const bullesPx: BullePx[] = [];
  if (d > 0) {
    grille.forEach((ligne, r) => ligne.cases.forEach((b, c) => {
      if (!b) return;
      const p = enPx({ x: c + 0.5 + (ligne.decalee ? 0.5 : 0), y: r * LIGNE_H + 0.5 });
      bullesPx.push({ x: p.x, y: p.y, couleur: b.couleur, capsule: b.capsule, special: b.special, pv: b.pv });
    }));
  }

  return (
    <View style={[styles.fond, { paddingTop: insets.top + 8 }]}>
      {/* === HUD === */}
      <View style={styles.hud}>
        <Pressable style={styles.fermer} onPress={quitter} hitSlop={8}>
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Line x1={6} y1={6} x2={18} y2={18} stroke={C.violetProfond} strokeWidth={2.6} strokeLinecap="round" />
            <Line x1={18} y1={6} x2={6} y2={18} stroke={C.violetProfond} strokeWidth={2.6} strokeLinecap="round" />
          </Svg>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          {aventure ? (
            <>
              <View style={styles.titreNiveauRang}>
                <Text style={styles.titreNiveau}>Niveau {niveau}</Text>
                {params?.boss && <Icone nom="couronne" taille={18} />}
              </View>
              <Text style={styles.scorePetit}>{formatNb(etat.score)} pts</Text>
            </>
          ) : (
            <>
              <Text style={styles.score}>{formatNb(etat.score)}</Text>
              <View style={styles.sousScore}>
                <IconePerle taille={13} />
                <Text style={styles.sousScoreTxt}>
                  ≈ {formatNb(perlesSiFin)} {bonusDispo && !crediteRef.current ? '(bonus ×2 ✨)' : ''}
                </Text>
              </View>
            </>
          )}
        </View>
        {aventure ? (
          <View style={[styles.tirsPill, (etat.tirsRestants ?? 0) <= 5 && styles.tirsPillDanger]}>
            <Text style={[styles.tirsPillNb, (etat.tirsRestants ?? 0) <= 5 && { color: '#fff' }]}>
              {etat.tirsRestants ?? 0}
            </Text>
            <Text style={[styles.tirsPillLib, (etat.tirsRestants ?? 0) <= 5 && { color: '#FBEAEA' }]}>tirs</Text>
          </View>
        ) : (
          <View style={styles.recordBoite}>
            <Text style={styles.recordTxt}>Record</Text>
            <Text style={styles.recordNb}>{formatNb(Math.max(jeu.meilleurScore, etat.score))}</Text>
          </View>
        )}
      </View>

      {/* Sous-HUD : objectif du niveau / chaîne / descente */}
      <View style={styles.sousHud}>
        {aventure && etat.objectif.type === 'capsules' && (
          <View style={styles.capsulesRang}>
            {Array.from({ length: (params?.nbCapsules ?? 0) }).map((_, i) => (
              <MiniCapsule key={i} liberee={i >= capsulesRestantes} />
            ))}
            <Text style={styles.capsulesLib}>à libérer</Text>
          </View>
        )}
        {aventure && etat.objectif.type === 'boss' && (() => {
          const pv = objectifCible(etat.objectif);
          const restant = Math.max(0, pv - etat.objProgres);
          const pct = Math.round((restant / pv) * 100);
          return (
            <View style={styles.bossPill}>
              <Icone nom="boss" taille={26} />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.bossHpFond}>
                  <View style={[styles.bossHpPlein, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.bossHpTxt}>Boss — {restant}/{pv} PV</Text>
                <Text style={styles.bossActionTxt} numberOfLines={1}>
                  Phase {etat.bossPhase} · {labelBossActionTir(etat.bossProchaineAction)} dans {bossDans} tir{bossDans > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          );
        })()}
        {aventure && etat.objectif.type !== 'capsules' && etat.objectif.type !== 'score' && etat.objectif.type !== 'boss' && (
          <View style={styles.objectifPill}>
            <Icone nom="cible" taille={15} />
            <Text style={styles.objectifTxt} numberOfLines={1}>
              {objectifLabel(etat.objectif, (c) => NOMS_COULEUR[c])}
            </Text>
            {(etat.objectif.type === 'tomber' || etat.objectif.type === 'couleur') && (
              <>
                <View style={styles.objBarreFond}>
                  <View
                    style={[
                      styles.objBarrePlein,
                      { width: `${Math.min(100, (etat.objProgres / Math.max(1, objectifCible(etat.objectif))) * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.objCompte}>
                  {Math.min(etat.objProgres, objectifCible(etat.objectif))}/{objectifCible(etat.objectif)}
                </Text>
              </>
            )}
          </View>
        )}
        {multChaine >= 2 && (
          <View style={styles.chainePill}>
            <Icone nom="flamme" taille={13} />
            <Text style={styles.chainePillTxt}>Chaîne ×{multChaine}</Text>
          </View>
        )}
        <Pressable
          style={[styles.feverPill, etat.fever >= FEVER_MAX && styles.feverPillPret]}
          disabled={etat.fever < FEVER_MAX || phase !== 'pret'}
          onPress={declencherFever}
        >
          <Icone nom="eclat" taille={13} />
          <Text style={[styles.feverTxt, etat.fever >= FEVER_MAX && styles.feverTxtPret]}>
            {etat.fever >= FEVER_MAX ? 'SHAKER !' : `${etat.fever}/${FEVER_MAX}`}
          </Text>
        </Pressable>
        {etat.tirsParDescente > 0 && (
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {Array.from({ length: etat.tirsParDescente }).map((_, i) => (
              <View key={i} style={[styles.pointTir, i < etat.tirsParDescente - etat.tirs && styles.pointTirPlein]} />
            ))}
          </View>
        )}
      </View>

      {/* === Terrain === (secousse d'écran appliquée ici) */}
      <Animated.View
        style={[styles.terrain, { marginBottom: insets.bottom + 6, transform: [{ translateX: secousseX }, { translateY: secousseY }] }]}
        onLayout={(e) => setDims({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        {...panHandlers.panHandlers}
      >
        {dims && d > 0 && (
          <>
            <View style={[styles.mur, { left: offX - 2, height: yLimite + d }]} />
            <View style={[styles.mur, { left: offX + LARGEUR_TERRAIN * d, height: yLimite + d }]} />

            {/* === Plateau rendu en Skia (perles glossy, GPU) === */}
            <Animated.View
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, top: 0, transform: [{ translateY: gridShift }] }}
            >
              <PlateauSkia w={dims.w} h={dims.h} r={d * 0.47} bulles={bullesPx} />
            </Animated.View>

            <View style={[styles.limite, { top: yLimite, left: offX, width: LARGEUR_TERRAIN * d }]} />

            {pointsGuide.map((p, i) => {
              const px = enPx(p);
              return (
                <View
                  key={i}
                  pointerEvents="none"
                  style={[
                    styles.guide,
                    armee === 'bombe' && { backgroundColor: '#C75450' },
                    { left: px.x - 3, top: px.y - 3, opacity: 0.85 - (i / pointsGuide.length) * 0.55 },
                  ]}
                />
              );
            })}

            {apercu?.pose && (() => {
              const ligne = etat.grille[apercu.pose!.r];
              const dec = ligne?.decalee ?? (apercu.pose!.r % 2 === 1);
              const p = enPx({
                x: apercu.pose!.c + 0.5 + (dec ? 0.5 : 0),
                y: apercu.pose!.r * LIGNE_H + 0.5,
              });
              return (
                <View pointerEvents="none" style={[styles.apercuPose, { left: p.x - d * 0.47, top: p.y - d * 0.47, width: d * 0.94, height: d * 0.94, borderRadius: d * 0.47 }]}>
                  {(apercu.eclatees > 0 || apercu.tombees > 0) && (
                    <Text style={styles.apercuTxt}>−{apercu.eclatees + apercu.tombees}</Text>
                  )}
                </View>
              );
            })()}

            {proj && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute', left: 0, top: 0,
                  transform: [{ translateX: projPos.x }, { translateY: projPos.y }],
                }}
              >
                {proj.special === 'arc' ? (
                  <PerleArc taille={d * 0.94} />
                ) : proj.special === 'bombe' ? (
                  <View style={styles.projectile}><PictoPowerup id="bombe" taille={d * 0.94} /></View>
                ) : (
                  <BilleSkia taille={d * 0.94} hex={proj.couleur} glow />
                )}
              </Animated.View>
            )}

            {volee && volee.eclats.map((e) => (
              <Animated.View
                key={e.cle} pointerEvents="none"
                style={[styles.eclat, {
                  left: e.x - d * 0.5, top: e.y - d * 0.5, width: d, height: d, borderRadius: d / 2,
                  borderColor: e.couleur,
                  opacity: volee.av.interpolate({ inputRange: [0, 1], outputRange: [0.95, 0] }),
                  transform: [{ scale: volee.av.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.55] }) }],
                }]}
              />
            ))}
            {volee && volee.chutes.map((ch) => (
              <Animated.View
                key={ch.cle} pointerEvents="none"
                style={{
                  position: 'absolute', left: ch.x - d * 0.47, top: ch.y - d * 0.47,
                  opacity: volee.avChute.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0.35] }),
                  transform: [{ translateY: volee.avChute.interpolate({ inputRange: [0, 1], outputRange: [0, ch.dist] }) }],
                }}
              >
                {ch.capsule ? (
                  <CapsuleSvg taille={d * 0.94} />
                ) : (
                  <View style={{ width: d * 0.94, height: d * 0.94, borderRadius: d * 0.47, backgroundColor: ch.couleur }}>
                    <View style={[styles.reflet, { width: d * 0.26, height: d * 0.26, borderRadius: d * 0.13 }]} />
                  </View>
                )}
              </Animated.View>
            ))}
            {volee && volee.textes.map((t) => (
              <Animated.Text
                key={t.cle} pointerEvents="none"
                style={[styles.flottant, t.gros && styles.flottantGros, {
                  left: 0, right: 0, top: t.y - 12, textAlign: 'center',
                  opacity: volee.av.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
                  transform: [{ translateY: volee.av.interpolate({ inputRange: [0, 1], outputRange: [0, -34] }) }],
                }]}
              >
                {t.txt}
              </Animated.Text>
            ))}

            {/* === Lanceur (lance-pierre) === */}
            {/* 🏹 l'élastique : deux brins tendus des plots vers la bille reculée */}
            {visee && (() => {
              const bx = lanceurPx.x - Math.cos(visee.a) * visee.r;
              const by = lanceurPx.y - Math.sin(visee.a) * visee.r;
              const ax1 = lanceurPx.x - d * 0.78, ax2 = lanceurPx.x + d * 0.78;
              const ay = lanceurPx.y + d * 0.14;
              return (
                <Svg pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }} width={dims.w} height={dims.h}>
                  <Line x1={ax1} y1={ay} x2={bx} y2={by} stroke="#B9A5DE" strokeWidth={3.2} strokeLinecap="round" />
                  <Line x1={ax2} y1={ay} x2={bx} y2={by} stroke="#B9A5DE" strokeWidth={3.2} strokeLinecap="round" />
                  <Circle cx={ax1} cy={ay} r={3.6} fill="#8A76B5" />
                  <Circle cx={ax2} cy={ay} r={3.6} fill="#8A76B5" />
                </Svg>
              );
            })()}
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute', left: lanceurPx.x - d * 0.55, top: lanceurPx.y - d * 0.55, ...OMBRE,
                transform: [
                  { translateX: recul.x },
                  { translateY: recul.y },
                  { scale: etirement.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
                ],
              }}
            >
              {armee === 'arc' ? (
                <PerleArc taille={d * 1.1} />
              ) : armee === 'bombe' ? (
                <PictoPowerup id="bombe" taille={d * 1.1} />
              ) : (
                <BilleSkia taille={d * 1.1} hex={COULEURS[etat.couleurCourante]} glow />
              )}
            </Animated.View>
            <Svg
              pointerEvents="none" width={26} height={14}
              style={{ position: 'absolute', left: lanceurPx.x - 13, top: lanceurPx.y + d * 0.62 }}
              viewBox="0 0 26 14"
            >
              <Path d="M3 11 L13 3 L23 11" stroke={C.texte3} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>

            {/* Boutons perles spéciales (gauche) */}
            <View style={[styles.powerups, { top: lanceurPx.y - d * 0.55 }]}>
              <BoutonPowerup
                id="bombe" stock={jeu.powerups.bombe} armee={armee === 'bombe'}
                onPress={() => toucherPowerup('bombe')}
              />
              <BoutonPowerup
                id="arc" stock={jeu.powerups.arc} armee={armee === 'arc'}
                onPress={() => toucherPowerup('arc')}
              />
            </View>

            {/* perle suivante + échanger (droite) */}
            <Pressable
              disabled={etat.swapBloqueTirs > 0}
              onPress={() => { if (phase === 'pret' && echangerMunitions(etatRef.current!)) forcer(); }}
              style={[styles.suivant, etat.swapBloqueTirs > 0 && { opacity: 0.35 }, { left: lanceurPx.x + d * 1.5, top: lanceurPx.y - d * 0.42 }]}
              hitSlop={10}
            >
              <BilleSkia taille={d * 0.7} hex={COULEURS[etat.couleurSuivante]} />
              <Svg width={18} height={18} viewBox="0 0 24 24">
                <Path d="M4 9 A8 8 0 0 1 19 7 M19 7 L19 2.5 M19 7 L14.5 7" stroke={C.texte2} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <Path d="M20 15 A8 8 0 0 1 5 17 M5 17 L5 21.5 M5 17 L9.5 17" stroke={C.texte2} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </Pressable>

            <Text style={[styles.astuce, { top: lanceurPx.y + d * 1.1 }]}>
              {messageFever
                ? messageFever
                : visee && tensionRef.current >= TIR_PARFAIT_SEUIL
                  ? 'TIR PARFAIT armé — relâche !'
                  : etat.swapBloqueTirs > 0
                    ? `Échange brouillé encore ${etat.swapBloqueTirs} tir${etat.swapBloqueTirs > 1 ? 's' : ''}`
                    : armee
                      ? `${feverArmee ? 'Fever' : POWERUPS[armee].nom} armée — tire vers le bas et relâche !`
                      : 'Tire la bille vers le bas… et relâche !'}
            </Text>
          </>
        )}

        {/* === Fin de partie === */}
        {phase === 'fini' && fin && (
          <View style={styles.finFond}>
            <View style={styles.finCarte}>
              {fin.type === 'victoire' && (
                <>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {[1, 2, 3].map((i) => (
                      <View key={i} style={{ opacity: i <= fin.etoiles ? 1 : 0.22 }}><Icone nom="etoile" taille={38} /></View>
                    ))}
                  </View>
                  <Text style={styles.finTitre}>Niveau {niveau} réussi !</Text>
                  <View style={styles.finLigne}>
                    <IconePerle taille={20} />
                    <Text style={styles.finPerles}>
                      +{formatNb(fin.perles)} perles{fin.bonusJour ? ' (×2 ✨)' : ''}
                    </Text>
                  </View>
                  {fin.capsule && (
                    <View style={styles.finCapsulesRang}>
                      <Icone nom="cadeau" taille={15} />
                      <Text style={styles.finCapsules}>+1 capsule {fin.capsule === 'doree' ? 'DORÉE' : 'classique'} — ouvre-la vite !</Text>
                      {fin.capsule === 'doree' && <Icone nom="couronne" taille={15} />}
                    </View>
                  )}
                  {!fin.premiere && <Text style={styles.finNote}>Niveau déjà réussi : perles réduites, pas de capsule.</Text>}
                  <BoutonJeu titre="Niveau suivant →" onPress={niveauSuivant} style={{ alignSelf: 'stretch', backgroundColor: C.vert }} />
                  <Pressable onPress={versParcours} hitSlop={6}>
                    <Text style={styles.finRetour}>Retour au parcours ›</Text>
                  </Pressable>
                </>
              )}
              {fin.type === 'defaite' && (
                <>
                  <Icone nom="triste" taille={42} />
                  <Text style={styles.finTitre}>
                    {fin.raison === 'tirs' ? 'Plus de tirs !' : 'Le plateau a débordé !'}
                  </Text>
                  <Text style={styles.finNote}>
                    Astuce : coupe les perles qui RETIENNENT la capsule — et pense aux
                    perles spéciales (Bombe et Arc-en-ciel).
                  </Text>
                  <BoutonJeu titre="Réessayer" onPress={reinit} style={{ alignSelf: 'stretch' }} />
                  <Pressable onPress={versParcours} hitSlop={6}>
                    <Text style={styles.finRetour}>Retour au parcours ›</Text>
                  </Pressable>
                </>
              )}
              {fin.type === 'infini' && (
                <>
                  <Icone nom={fin.record ? 'trophee' : 'boba'} taille={42} />
                  <Text style={styles.finTitre}>{fin.record ? 'Nouveau record !' : 'Partie terminée !'}</Text>
                  <Text style={styles.finScore}>{formatNb(etat.score)} points</Text>
                  <View style={styles.finLigne}>
                    <IconePerle taille={20} />
                    <Text style={styles.finPerles}>
                      +{formatNb(fin.perles)} perles{fin.bonusJour ? ' (bonus du jour ×2 ✨)' : ''}
                    </Text>
                  </View>
                  <BoutonJeu titre="Rejouer" onPress={reinit} style={{ alignSelf: 'stretch' }} />
                  <Pressable onPress={() => router.back()} hitSlop={6}>
                    <Text style={styles.finRetour}>Retour au QG ›</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        )}
      </Animated.View>

      {/* === Achat de perle spéciale === */}
      <Modal visible={!!achat} transparent animationType="fade" onRequestClose={() => setAchat(null)}>
        {achat && (
          <Pressable style={styles.modalFond} onPress={() => setAchat(null)}>
            <Pressable style={styles.modalCarte} onPress={() => {}}>
              <PictoPowerup id={achat} taille={64} />
              <Text style={styles.modalTitre}>{POWERUPS[achat].nom}</Text>
              <Text style={styles.modalTexte}>{POWERUPS[achat].detail}</Text>
              <View style={styles.finLigne}>
                <IconePerle taille={16} />
                <Text style={styles.finPerles}>
                  {formatNb(coutPowerupActuel(achat))} perles
                  {coutPowerupActuel(achat) < POWERUPS[achat].cout ? ` (copain de tir −${formatNb(POWERUPS[achat].cout - coutPowerupActuel(achat))} ✨)` : ''} — tu en as {formatNb(jeu.perles)}
                </Text>
              </View>
              <BoutonJeu
                titre={jeu.perles >= coutPowerupActuel(achat) ? 'Acheter et armer' : 'Pas assez de perles'}
                disabled={jeu.perles < coutPowerupActuel(achat)}
                onPress={() => {
                  if (acheterPowerup(achat)) { setArmee(achat); setAchat(null); }
                }}
                style={{ alignSelf: 'stretch', backgroundColor: C.vert }}
              />
              <Pressable onPress={() => setAchat(null)} hitSlop={6}>
                <Text style={styles.finRetour}>Plus tard</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        )}
      </Modal>
    </View>
  );
}

// Une perle de la grille — la CAPSULE a son propre look (coffre à collectible)
function Perle({ x, y, d, bulle }: { x: number; y: number; d: number; bulle: Bulle }) {
  if (bulle.capsule) {
    return (
      <View style={{ position: 'absolute', left: x - d * 0.5, top: y - d * 0.5 }}>
        <CapsuleSvg taille={d} />
      </View>
    );
  }
  return (
    <View
      style={{
        position: 'absolute', left: x - d * 0.47, top: y - d * 0.47,
        width: d * 0.94, height: d * 0.94, borderRadius: d * 0.47,
        backgroundColor: COULEURS[bulle.couleur],
      }}
    >
      <View style={[styles.reflet, { width: d * 0.26, height: d * 0.26, borderRadius: d * 0.13 }]} />
    </View>
  );
}

// La capsule accrochée : bille dorée à moitié blanche, anneau or, étincelle
function CapsuleSvg({ taille }: { taille: number }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={11} fill="#FFF3D6" stroke="#C99012" strokeWidth={1.6} />
      <Path d="M3.5 12 A8.5 8.5 0 0 1 20.5 12 Z" fill="#fff" stroke="#C99012" strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M3.5 12 A8.5 8.5 0 0 0 20.5 12 Z" fill="#f2da33" stroke="#C99012" strokeWidth={1.6} strokeLinejoin="round" />
      <Circle cx={8.6} cy={8.4} r={1.7} fill="#fff" opacity={0.85} />
      <Line x1={19.6} y1={3.4} x2={22} y2={3.4} stroke="#C99012" strokeWidth={1.4} strokeLinecap="round" />
      <Line x1={20.8} y1={2.2} x2={20.8} y2={4.6} stroke="#C99012" strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

// Perle arc-en-ciel : camembert des 6 couleurs
function PerleArc({ taille }: { taille: number }) {
  const cx = 12, cy = 12, r = 11;
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24">
      {COULEURS.map((coul, i) => {
        const a0 = (i * 60 * Math.PI) / 180, a1 = ((i + 1) * 60 * Math.PI) / 180;
        return (
          <Path
            key={coul}
            d={`M${cx} ${cy} L${cx + Math.sin(a0) * r} ${cy - Math.cos(a0) * r} A${r} ${r} 0 0 1 ${cx + Math.sin(a1) * r} ${cy - Math.cos(a1) * r} Z`}
            fill={coul}
          />
        );
      })}
      <Circle cx={8.6} cy={8.4} r={2} fill="#fff" opacity={0.6} />
    </Svg>
  );
}

// Mini-capsule du sous-HUD (grisée quand libérée)
function MiniCapsule({ liberee }: { liberee: boolean }) {
  return (
    <View style={{ opacity: liberee ? 0.25 : 1 }}>
      <CapsuleSvg taille={22} />
    </View>
  );
}

// Picto d'un power-up (bombe : perle sombre étincelante / arc : camembert)
function PictoPowerup({ id, taille }: { id: PowerupId; taille: number }) {
  if (id === 'arc') return <PerleArc taille={taille} />;
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24">
      <Circle cx={12} cy={13} r={9} fill="#2A1D46" />
      <Circle cx={8.8} cy={9.8} r={2.2} fill="#fff" opacity={0.35} />
      <Path d="M12 4 Q12 1.5 14.5 1.5" stroke="#C99012" strokeWidth={1.8} strokeLinecap="round" fill="none" />
      <Line x1={15.6} y1={0.6} x2={17.4} y2={2.4} stroke="#C75450" strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={17.4} y1={0.6} x2={15.6} y2={2.4} stroke="#C75450" strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function BoutonPowerup({ id, stock, armee, onPress }: {
  id: PowerupId; stock: number; armee: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.btnPowerup, armee && styles.btnPowerupArme]} hitSlop={6}>
      <PictoPowerup id={id} taille={30} />
      <View style={[styles.stockBadge, stock === 0 && { backgroundColor: C.texte3 }]}>
        <Text style={styles.stockBadgeTxt}>{stock > 0 ? `×${stock}` : '+'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },

  hud: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  fermer: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.carte,
    alignItems: 'center', justifyContent: 'center', ...OMBRE,
  },
  score: { fontFamily: F.titre, fontSize: 30, color: C.violet },
  titreNiveau: { fontFamily: F.titre, fontSize: 23, color: C.violet },
  titreNiveauRang: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  scorePetit: { fontFamily: F.t700, fontSize: 12.5, color: C.texte2, marginTop: -1 },
  sousScore: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -2 },
  sousScoreTxt: { fontFamily: F.t700, fontSize: 12, color: C.texte2 },
  recordBoite: { alignItems: 'flex-end' },
  recordTxt: { fontFamily: F.t700, fontSize: 11, color: C.texte3 },
  recordNb: { fontFamily: F.t800, fontSize: 15, color: C.violetProfond },

  tirsPill: {
    backgroundColor: C.carte, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 13,
    alignItems: 'center', ...OMBRE,
  },
  tirsPillDanger: { backgroundColor: C.danger },
  tirsPillNb: { fontFamily: F.titre, fontSize: 20, color: C.violet, lineHeight: 24 },
  tirsPillLib: { fontFamily: F.t700, fontSize: 10, color: C.texte3, marginTop: -2 },

  sousHud: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingHorizontal: 16, paddingTop: 6, minHeight: 30, flexWrap: 'wrap',
  },
  capsulesRang: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  capsulesLib: { fontFamily: F.t700, fontSize: 11.5, color: C.texte2, marginLeft: 3 },
  objectifPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.violet, borderRadius: 999,
    paddingVertical: 5, paddingHorizontal: 12, maxWidth: '82%',
  },
  objectifTxt: { fontFamily: F.t800, fontSize: 12.5, color: '#fff' },
  objBarreFond: {
    width: 54, height: 7, borderRadius: 4, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  objBarrePlein: { height: 7, borderRadius: 4, backgroundColor: C.jaune },
  objCompte: { fontFamily: F.t800, fontSize: 11.5, color: '#FFE7A6' },
  bossPill: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: '#3A2036', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12,
    maxWidth: '86%', minWidth: 200,
  },
  bossFace: { fontSize: 22 },
  bossHpFond: { height: 9, borderRadius: 5, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.18)' },
  bossHpPlein: { height: 9, borderRadius: 5, backgroundColor: '#E8556A' },
  bossHpTxt: { fontFamily: F.t800, fontSize: 11, color: '#FFD3DA' },
  bossActionTxt: { fontFamily: F.t600, fontSize: 9.5, color: '#F3D8E8' },
  chainePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FFF3D6', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 11,
    borderWidth: 1, borderColor: C.jaune,
  },
  chainePillTxt: { fontFamily: F.t800, fontSize: 12, color: '#9A6B00' },
  feverPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999,
    paddingVertical: 4, paddingHorizontal: 9, backgroundColor: C.carte, borderWidth: 1, borderColor: C.bord,
  },
  feverPillPret: { backgroundColor: C.violet, borderColor: C.jaune },
  feverTxt: { fontFamily: F.t800, fontSize: 11, color: C.texte3, fontVariant: ['tabular-nums'] },
  feverTxtPret: { color: '#fff' },
  pointTir: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.bord },
  pointTirPlein: { backgroundColor: C.violetClair },

  terrain: { flex: 1, marginTop: 4, overflow: 'hidden' },
  mur: { position: 'absolute', top: 0, width: 2, backgroundColor: C.bord, borderRadius: 1 },
  limite: { position: 'absolute', height: 2, backgroundColor: 'rgba(199,84,80,0.45)', borderRadius: 1 },
  guide: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: C.violetClair },
  apercuPose: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderStyle: 'dashed', borderColor: C.vert, backgroundColor: 'rgba(163,199,36,0.16)',
  },
  apercuTxt: { fontFamily: F.t800, fontSize: 11, color: C.vertFonce },
  projectile: { position: 'absolute', ...OMBRE },
  reflet: { position: 'absolute', top: '14%', left: '14%', backgroundColor: '#fff', opacity: 0.5 },
  eclat: { position: 'absolute', borderWidth: 3.5, backgroundColor: 'transparent' },
  flottant: { position: 'absolute', fontFamily: F.t800, fontSize: 17, color: C.violetProfond },
  flottantGros: { fontFamily: F.titre, fontSize: 20, color: C.vertFonce },
  suivant: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8 },
  astuce: {
    position: 'absolute', left: 0, right: 0, textAlign: 'center',
    fontFamily: F.t600, fontSize: 11.5, color: C.texte3,
  },

  powerups: { position: 'absolute', left: 14, flexDirection: 'row', gap: 10 },
  btnPowerup: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: C.carte,
    alignItems: 'center', justifyContent: 'center', ...OMBRE,
    borderWidth: 2, borderColor: 'transparent',
  },
  btnPowerupArme: { borderColor: C.vert, backgroundColor: C.vertPale },
  stockBadge: {
    position: 'absolute', top: -5, right: -5, backgroundColor: C.violetClair,
    borderRadius: 999, minWidth: 19, height: 19, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  stockBadgeTxt: { fontFamily: F.t800, fontSize: 10.5, color: '#fff' },

  finFond: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(42,29,70,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 26,
  },
  finCarte: {
    backgroundColor: C.carte, borderRadius: 24, padding: 24, gap: 10,
    alignItems: 'center', alignSelf: 'stretch', ...OMBRE,
  },
  finTitre: { fontFamily: F.titre, fontSize: 22, color: C.violet, textAlign: 'center' },
  finScore: { fontFamily: F.t800, fontSize: 17, color: C.texte },
  finLigne: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.vertPale, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14,
  },
  finPerles: { fontFamily: F.t800, fontSize: 14.5, color: C.vertFonce },
  finCapsules: { fontFamily: F.t700, fontSize: 13.5, color: '#9A6B00', textAlign: 'center' },
  finCapsulesRang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, flexWrap: 'wrap' },
  finNote: { fontFamily: F.t400, fontSize: 12.5, color: C.texte2, textAlign: 'center', lineHeight: 18 },
  finRetour: { fontFamily: F.t700, fontSize: 14, color: C.texte2, padding: 6 },

  modalFond: {
    flex: 1, backgroundColor: 'rgba(42,29,70,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  modalCarte: {
    backgroundColor: C.carte, borderRadius: 24, padding: 24,
    alignItems: 'center', gap: 12, alignSelf: 'stretch', ...OMBRE,
  },
  modalTitre: { fontFamily: F.titre, fontSize: 21, color: C.violet },
  modalTexte: { fontFamily: F.t400, fontSize: 13.5, color: C.texte2, textAlign: 'center', lineHeight: 20 },
});
