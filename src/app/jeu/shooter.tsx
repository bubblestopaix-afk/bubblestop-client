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
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { BORD, C, F, OMBRE } from '@/constants/charte';
import {
  activerFever, alerteObjectif, ApercuTir, BONUS_POINTS, bossPersonnage, Bulle, Case,
  centreCase, creerNiveau, creerPartieInfini, EFFETS_PERLE,
  echangerMunitions, EtatShooter, etoilesNiveau, FEVER_MAX, GROS_LACHER,
  labelBossActionTir, LARGEUR_TERRAIN, LIGNE_H, LIGNE_LIMITE, Ligne, nbCapsules,
  objectifAtteint, objectifCible, objectifLabel, paramsNiveau, Point, previsualiserTir,
  simulerVolPlateau, Special, SpecialBulle, tirer, TIR_PARFAIT_SEUIL, voisins,
} from '@/components/jeu/moteur-shooter';
import { perlesPourScore, POWERUPS, PowerupId, prochaineCapsuleNiveau, trouverCollectible, CONSOMMABLES, ConsommableId } from '@/components/jeu/economie';
import { Icone } from '@/components/jeu/icones';
import { BilleSkia, BullePx, PlateauSkia } from '@/components/jeu/plateau-skia';
import { BossShooter, BuddyLanceur } from '@/components/jeu/shooter-juice';
import { BoutonJeu, Confettis, formatNb, IconePerle, useCountUp } from '@/components/jeu/ui-jeu';
import { hapticLeger, hapticLourd, hapticMoyen, hapticSucces } from '@/lib/juice';
import {
  acheterPowerup, bonusJourDispo, consommerPowerup, coutPowerupActuel,
  echecNiveau, effetBuddyActuel, estimerGainPartie, finPartieInfini, StatsPartie,
  terminerNiveau, useBobaQuest,
} from '@/store/jeu';

// Les 6 familles de perles (les niveaux difficiles utilisent la 6e, orange)
// 🎨 palette CANDY officielle (DA kawaii) — même ordre que BASE dans plateau-skia.tsx
const COULEURS = ['#b98fe0', '#9fc038', '#f2da33', '#ec647b', '#89cfe3', '#f7a14b'];
// Noms FR des familles (objectif « éclate N perles … »)
const NOMS_COULEUR = ['violettes', 'vertes', 'jaunes', 'roses', 'bleues', 'orange'];
const ANGLE_MIN = -Math.PI + 0.2;
const ANGLE_MAX = -0.2;
// 🩹 26/07 — période mini entre deux aperçus tactiques (≈ 11 Hz) — cf. majGuide.
const APERCU_MS = 90;
// 🆕 LOT D — ordre de présentation des perles dans l'aide de jeu : celui du REGISTRE du
// moteur (les 7 historiques d'abord, les 6 nouvelles ensuite). Calculé une fois au
// chargement du module, jamais dans le rendu.
const ORDRE_PERLES = Object.keys(EFFETS_PERLE) as SpecialBulle[];

// Trajectoire montrée au joueur. `ruptures` = indices i où le segment i → i+1 est un
// SAUT de portail : ni le pointillé ni la bille ne doivent le PARCOURIR.
type Guide = { points: Point[]; ruptures: number[] };

type Volee = {
  av: Animated.Value;
  avChute: Animated.Value;
  eclats: { cle: string; x: number; y: number; couleur: string }[];
  chutes: { cle: string; x: number; y: number; couleur: string; capsule?: boolean; dist: number }[];
  textes: { cle: string; y: number; txt: string; gros?: boolean }[];
  // 💥 débris balistiques (4-6 par perle éclatée, plafonnés) — purement visuels
  debris: { cle: string; x: number; y: number; couleur: string; dx: number; dy: number; taille: number }[];
  // 🫧 voisines du pop : masquées du plateau puis rendues en squash & stretch
  squashs: { cle: string; x: number; y: number; couleur: string }[];
};

// 🎁 Butin de fin de partie : un consommable gagné (ou converti en perles si sac plein)
type ButinConso = { id: ConsommableId; ajoute: number; convertisPerles: number };

type Fin =
  | { type: 'victoire'; etoiles: number; perles: number; bonusJour: boolean; premiere: boolean; capsule: 'classique' | 'doree' | null; butin: ButinConso | null }
  | { type: 'defaite'; raison: 'tirs' | 'limite' }
  | { type: 'infini'; perles: number; bonusJour: boolean; record: boolean; butin: ButinConso | null };

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
    // 🩹 26/07 : les tirs offerts par le copain Milk gonflaient `tirsRestants` sans
    // toucher `tirsMax` — or les étoiles se calculent sur `tirsRestants / tirsMax`.
    // Un joueur équipé d'un Milk légendaire décrochait 3★ en jouant moins bien qu'un
    // joueur nu qui n'en obtenait que 2. Le budget de référence suit désormais le don.
    if (aventure && e.tirsRestants !== null) {
      e.tirsRestants += buddy.tirsBonus;
      if (e.tirsMax !== null) e.tirsMax += buddy.tirsBonus;
    }
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
  const [guide, setGuide] = useState<Guide | null>(null);
  const [apercu, setApercu] = useState<ApercuTir | null>(null);
  // 📖 Aide de jeu : la liste des perles spéciales posées sur CE plateau. Nom, emoji et
  // phrase viennent intégralement d'`EFFETS_PERLE` — aucun libellé n'est réécrit ici.
  const [aidePerles, setAidePerles] = useState(false);
  // 🏹 effet lance-pierre : pendant la visée, la bille RECULE à l'opposé du tir comme un
  // élastique tendu (plus le doigt est loin, plus ça tire), puis CLAQUE en avant au lâcher.
  // `recul` anime la bille (Animated) ; `visee` (état) dessine l'élastique en SVG.
  const recul = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const etirement = useRef(new Animated.Value(0)).current;
  const tensionRef = useRef(0); // 0..1 : tension de l'élastique au lâcher → vitesse du tir
  const [visee, setVisee] = useState<{ a: number; r: number } | null>(null);
  const [volee, setVolee] = useState<Volee | null>(null);
  const [fin, setFin] = useState<Fin | null>(null);
  // 🎊 récap animé : les perles gagnées COMPTENT au lieu de s'afficher d'un bloc
  const perlesComptees = useCountUp(fin && fin.type !== 'defaite' ? fin.perles : 0, 750);
  const [armee, setArmee] = useState<Special | null>(null);
  const [feverArmee, setFeverArmee] = useState(false);
  const [messageFever, setMessageFever] = useState<string | null>(null);
  const [achat, setAchat] = useState<PowerupId | null>(null);

  const gridShift = useRef(new Animated.Value(0)).current;
  const secousse = useRef(new Animated.Value(0)).current; // secousse d'écran sur gros combos
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const bonusDispo = bonusJourDispo();

  // 🧃 juice Pack 4 : flash de la pastille chaîne, pulsation DANGER, signaux du copain
  const chaineFlash = useRef(new Animated.Value(1)).current; // 1 = repos
  const dangerAv = useRef(new Animated.Value(0)).current;
  const dangerRef = useRef(false);
  const critiqueRef = useRef(false);
  const matchSigRef = useRef(0); // 🎉 copain : incrémenté à chaque tir avec éclats
  const rateSigRef = useRef(0);  // 😬 copain : incrémenté à chaque tir sans effet

  // 🩹 26/07 — REGISTRE DE TIMEOUTS. Le fichier posait 5 `setTimeout` nus et ne
  // contenait AUCUN `clearTimeout` : le seul cleanup couvrait l'animation du
  // projectile. Conséquences réelles : un `terminerNiveau` / `finPartieInfini`
  // programmé à +650 ms s'exécutait après le démontage de l'écran (crédit fantôme +
  // setState sur composant démonté), et `reinit()` ne les annulait pas non plus — un
  // `setVolee(null)` en retard effaçait l'animation du NOUVEAU niveau. Tous les
  // timeouts passent désormais par `programmer`, qui les enregistre ; `annulerTimers`
  // purge le registre au démontage ET à chaque réinitialisation.
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  const apercuTsRef = useRef(0);                                            // dernier aperçu calculé (ms)
  const apercuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // rafraîchissement de traîne
  const programmer = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => { timersRef.current.delete(id); fn(); }, ms);
    timersRef.current.add(id);
    return id;
  }, []);
  const annulerTimer = useCallback((id: ReturnType<typeof setTimeout> | null) => {
    if (id === null) return;
    clearTimeout(id);
    timersRef.current.delete(id);
  }, []);
  const annulerTimers = useCallback(() => {
    for (const id of timersRef.current) clearTimeout(id);
    timersRef.current.clear();
    apercuTimerRef.current = null; // l'id purgé ne doit plus être annulé (les ids sont recyclés)
  }, []);

  useEffect(() => () => { animRef.current?.stop(); annulerTimers(); }, [annulerTimers]);

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
    annulerTimers(); // 🩹 26/07 — sinon un timeout du niveau précédent frappe le nouveau
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
  }, [creerEtat, annulerTimers]);
  const premierRendu = useRef(true);
  useEffect(() => {
    if (premierRendu.current) { premierRendu.current = false; return; }
    reinit();
  }, [niveau, reinit]);

  // — géométrie px ↔ unités —
  const d = dims ? Math.min(dims.w / LARGEUR_TERRAIN, dims.h / (LIGNE_LIMITE * LIGNE_H + 2.9)) : 0;
  const offX = dims ? (dims.w - d * LARGEUR_TERRAIN) / 2 : 0;
  // 📐 le plateau n'est plus COLLÉ en haut : la hauteur inutilisée est répartie
  // (moitié au-dessus du plateau, moitié sous le lanceur), plafonnée à ~2 billes
  const offY = dims ? Math.min(Math.max(0, dims.h - d * (LIGNE_LIMITE * LIGNE_H + 2.9)) * 0.5, d * 2.2) : 0;
  const yLimite = offY + LIGNE_LIMITE * LIGNE_H * d;
  const lanceur: Point = { x: LARGEUR_TERRAIN / 2, y: LIGNE_LIMITE * LIGNE_H + 1.6 };
  const lanceurPx = { x: offX + lanceur.x * d, y: offY + lanceur.y * d };
  const enPx = (u: Point) => ({ x: offX + u.x * d, y: offY + u.y * d });

  // — visée LANCE-PIERRE : on tire la bille vers le BAS, le tir part à l'OPPOSÉ (vers le haut).
  // Doigt au-dessus du lanceur = pas armé (null) → aucun tir accidentel en touchant le plateau.
  const calculerAngle = useCallback((tx: number, ty: number): number | null => {
    const dx = tx - lanceurPx.x, dy = ty - lanceurPx.y;
    // ⚠️ zone morte LARGE (≈ une demi-bille) : un simple tap près du lanceur ne doit
    // JAMAIS partir en tir — il faut un vrai étirement (constat de l'audit 19/07 :
    // des taps interprétés comme tirs consommaient le budget en douce)
    if (Math.hypot(dx, dy) < Math.max(14, d * 0.55)) return null;
    if (dy < d * 0.16) return null;                // on n'arme qu'en étirant vers le BAS
    const a = Math.atan2(-dy, -dx);                // direction du tir = opposé de l'étirement
    return Math.max(ANGLE_MIN, Math.min(ANGLE_MAX, a));
  }, [lanceurPx.x, lanceurPx.y, d]);

  // 🏹 détend l'élastique en douceur (visée annulée / doigt trop près)
  const relacherElastique = useCallback(() => {
    annulerTimer(apercuTimerRef.current); apercuTimerRef.current = null;
    setVisee(null);
    tensionRef.current = 0;
    Animated.spring(recul, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: true }).start();
    Animated.timing(etirement, { toValue: 0, duration: 110, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annulerTimer]);

  const majGuide = useCallback((tx: number, ty: number) => {
    const a = calculerAngle(tx, ty);
    if (a === null) { setGuide(null); setApercu(null); relacherElastique(); return; }
    // 🩹 26/07 — MÊME PAS D'INTÉGRATION QUE LE TIR RÉEL : le guide passait 0.16 alors que
    // `tirer()` et `previsualiserTir` utilisent le défaut 0.08. Mesuré sur 12 832 angles ×
    // 32 niveaux : 212 arrivées sur une AUTRE case (1,7 % ; 198 à l'audit, avant la refonte
    // des niveaux du jour), jusqu'à 1,5 perle d'écart à l'impact. La bille fantôme était
    // juste, la ligne pointillée non → « tir volé » pile quand on vise fin. Remesuré à 0
    // divergence. Le pas fin coûte ~2× le pas grossier (0,007 vs 0,003 ms en V8), financé
    // par le throttle ci-dessous : le poste lourd, c'est l'aperçu (2 à 4× ce vol).
    // 🔴 26/07 — `simulerVolPlateau`, PAS `simulerVol`. Le guide appelait la variante
    // SANS portails alors que `tirer()` et `previsualiserTir` passent tous deux par
    // `simulerVolPlateau` : dès le niveau 13, la ligne pointillée traçait une trajectoire
    // droite là où la bille entrait dans le portail et ressortait ailleurs. L'écran
    // MENTAIT au joueur sur la seule information dont il se sert pour viser — la faute la
    // plus grave possible dans ce moteur (« aucune logique parallèle », §0.2 du cahier).
    // Ce point d'entrée lit les portails DANS le plateau : les trois appelants ne peuvent
    // donc plus diverger, même si un quatrième apparaît un jour.
    const { points, ruptures } = simulerVolPlateau(etatRef.current!.grille, lanceur, a);
    setGuide({ points, ruptures });
    // 🩹 26/07 — APERÇU THROTTLÉ à ~11 Hz (bords d'attaque ET de traîne). `previsualiserTir`
    // deep-copie la grille puis rejoue un `tirer()` complet (vol, groupes, chaînes de bombes,
    // supernova, orphelines, RUSH, IA du boss) : 0,014 à 0,113 ms/frame en V8 selon la
    // machine, ×10 à ×30 sous Hermes sur un mobile d'entrée de gamme — et ce AVANT React et
    // ses setState sur un composant de ~1 500 lignes. Sur 2 s de visée à 60 Hz : 120 aperçus
    // → 23 (−81 %). Ligne pointillée et élastique restent à 60 Hz : retours DIRECTS du geste.
    // La TRAÎNE est indispensable : sans elle, le joueur qui immobilise son doigt (dernier
    // ajustement fin, puis lâcher) ne reçoit plus d'événement et garderait un fantôme périmé
    // jusqu'au tir ; avec elle l'aperçu converge vers l'angle final en moins de 90 ms. Le tir
    // est de toute façon TOUJOURS résolu depuis l'angle du lâcher, jamais depuis l'aperçu.
    annulerTimer(apercuTimerRef.current); apercuTimerRef.current = null;
    const attente = APERCU_MS - (Date.now() - apercuTsRef.current);
    const calculerApercu = () => {
      apercuTsRef.current = Date.now();
      setApercu(previsualiserTir(etatRef.current!, lanceur, a, armee));
    };
    if (attente <= 0) calculerApercu();
    else {
      apercuTimerRef.current = programmer(() => {
        apercuTimerRef.current = null;
        if (phaseRef.current !== 'pret') return; // tir déjà parti : pas de fantôme en vol
        calculerApercu();
      }, attente);
    }
    // 🏹 la bille SUIT le doigt (étirement 1:1, plafonné à ~1,5 bille et au bord d'écran)
    const dist = Math.hypot(tx - lanceurPx.x, ty - lanceurPx.y);
    const rMax = Math.max(d * 0.6, Math.min(d * 1.5, (dims ? dims.h : 700) - lanceurPx.y - d * 0.55));
    const r = Math.min(rMax, dist);
    recul.setValue({ x: -Math.cos(a) * r, y: -Math.sin(a) * r });
    etirement.setValue(Math.min(1, r / rMax));
    tensionRef.current = Math.min(1, r / rMax);
    setVisee({ a, r });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculerAngle, d, lanceurPx.x, lanceurPx.y, dims, armee, annulerTimer, programmer]);

  // — tir —
  const feu = useCallback((angle: number) => {
    // 🩹 26/07 — doigt levé : la traîne de l'aperçu n'a plus d'objet et ne doit pas
    // ressusciter un fantôme (pendant le vol, ou après un tir refusé faute de munition).
    // Annulée AVANT toute sortie anticipée.
    annulerTimer(apercuTimerRef.current); apercuTimerRef.current = null;
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
    // 🌀 Le segment de SAUT de portail (entrée → sortie) est parcouru en 0 ms : la bille
    // doit se TÉLÉPORTER, pas glisser en diagonale à travers tout le plateau. Le plancher
    // de 45 ms, indispensable aux segments courts (rebonds), produirait ici exactement
    // l'inverse de l'effet voulu — il est donc contourné pour ces seuls segments.
    // `res.ruptures` vient du moteur : l'écran ne redécouvre pas le saut de son côté.
    const sauts = res.ruptures.length ? new Set(res.ruptures) : null;
    let msAvantSaut = 0;   // instant du saut dans la séquence, pour l'haptique
    let sautVu = false;
    const segments = [];
    for (let i = 1; i < pts.length; i++) {
      const L = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      const saut = sauts?.has(i - 1) ?? false;
      const duree = saut ? 0 : Math.max(45, (L / vitesse) * 1000);
      if (!saut && !sautVu) msAvantSaut += duree;
      if (saut) sautVu = true;
      segments.push(Animated.timing(projPos, {
        toValue: tl(pts[i]),
        duration: duree,
        easing: Easing.linear,
        useNativeDriver: true,
      }));
    }
    // 📳 Le « vzzt » du portail se sent AU MOMENT du saut, pas à l'atterrissage : c'est
    // lui qui fait comprendre que la bille a été happée. Programmé via le REGISTRE de
    // timers (jamais un setTimeout nu) → purgé au démontage et à la réinitialisation.
    if (sautVu) programmer(hapticLeger, msAvantSaut);
    animRef.current = Animated.sequence(segments);
    animRef.current.start(({ finished }) => {
      if (!finished) return;
      setProj(null);
      // 🩹 26/07 — On passe par un REF, jamais par la closure. `feu` est mémoïsé sur
      // [dims, d, offX, armee, feverArmee] : aucune de ces valeurs ne change quand
      // « Niveau suivant → » fait un router.replace (l'écran n'est pas démonté, c'est
      // le useEffect [niveau] qui réinitialise). `feu` conservait donc l'`atterrir`
      // du niveau PRÉCÉDENT, avec ses `niveau` et `params` périmés : gagner le niveau
      // 8 créditait les étoiles du 7, sans capsule, en « déjà réussi », et le niveau 9
      // ne se déverrouillait jamais. Le ref est toujours à jour, quel que soit le
      // comportement de remontage d'expo-router.
      atterrirRef.current(res, couleurTiree, figee);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims, d, offX, armee, feverArmee, annulerTimer, programmer]);

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
    // 🌟 Shooter v2 : supernova, +1 tir, tir en or, rush
    if (res.etoiles > 0) textes.push({ cle: 'tsn', y: yLimite * 0.3, txt: '🌟 SUPERNOVA !', gros: true });
    if (res.tirsBonus > 0) textes.push({ cle: 'ttb', y: yLimite * 0.62, txt: `+${res.tirsBonus} TIR${res.tirsBonus > 1 ? 'S' : ''} !`, gros: true });
    if (res.tirEnOr) textes.push({ cle: 'tor', y: yLimite * 0.5, txt: '🏅 TIR EN OR ×2 !', gros: true });
    if (res.rushDebut && etat.rush) textes.push({ cle: 'trd', y: yLimite * 0.4, txt: `🔥 RUSH : ${etat.rush.cible} ${NOMS_COULEUR[etat.rush.couleur]} en 3 tirs !`, gros: true });
    if (res.rushFin === 'reussi') textes.push({ cle: 'trf', y: yLimite * 0.4, txt: '🔥 RUSH RÉUSSI ! +2 TIRS', gros: true });
    if (res.rushFin === 'rate') textes.push({ cle: 'trx', y: yLimite * 0.4, txt: 'Rush raté… la prochaine !' });
    // 🆕 LOT D — les 6 perles du plateau s'annoncent. Emoji et NOM viennent du REGISTRE
    // (`EFFETS_PERLE`) : l'écran n'invente aucun libellé, et une perle de plus côté moteur
    // n'obligera pas à revenir rééditer des chaînes ici. Les hauteurs sont réparties pour
    // ne jamais empiler deux annonces au même endroit (cf. les blocs juste au-dessus).
    const objSpe = etat.objectif;
    const nomPerle = (id: SpecialBulle) => `${EFFETS_PERLE[id].emoji} ${EFFETS_PERLE[id].nom.toUpperCase()}`;
    if (res.meches > 0) {
      textes.push({ cle: 'tme', y: yLimite * 0.22, txt: `${nomPerle('meche')} — DÉTONATION !`, gros: true });
    }
    if (res.lasers > 0) {
      textes.push({ cle: 'tla', y: yLimite * 0.26, txt: `${nomPerle('laser')} — LIGNE ASPIRÉE !`, gros: true });
    }
    if (res.liens > 0) {
      textes.push({ cle: 'tli', y: yLimite * 0.58, txt: `${nomPerle('lien')} — LES DEUX PARTENT !`, gros: true });
    }
    if (res.contagions > 0) {
      textes.push({ cle: 'tco', y: yLimite * 0.65, txt: `${nomPerle('contagion')} — VOISINES REPEINTES !`, gros: true });
    }
    if (res.portails > 0) {
      textes.push({ cle: 'tpo', y: yLimite * 0.71, txt: `${nomPerle('portail')} — TÉLÉPORTÉE !`, gros: true });
    }
    // 🎯 Le TOTAL de spéciales ne s'affiche QUE sur les niveaux qui en font l'objectif :
    // ailleurs il ferait doublon avec les annonces ci-dessus (une paille déclenchée est
    // déjà annoncée) et encombrerait l'écran. Là, c'est LA jauge que le joueur suit.
    if (res.specialesDeclenchees > 0 && objSpe.type === 'speciales') {
      textes.push({
        cle: 'tsp', y: yLimite * 0.78,
        txt: `+${res.specialesDeclenchees} spéciale${res.specialesDeclenchees > 1 ? 's' : ''} · ${Math.min(etat.objProgres, objSpe.cible)}/${objSpe.cible}`,
      });
    }
    // 🌊 cascade : chaîne ×2/×3 → gros titre au centre + flash de la pastille chaîne
    if (res.multiplicateur >= 2 && res.eclatees.length) {
      textes.push({
        cle: 'tcascade', y: yLimite * 0.33,
        txt: res.multiplicateur >= 3 ? `CASCADE ×${res.multiplicateur} !!` : `CHAÎNE ×${res.multiplicateur} !`,
        gros: true,
      });
      chaineFlash.setValue(0);
      Animated.timing(chaineFlash, {
        toValue: 1, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true,
      }).start();
    }

    // 📳 l'impact se SENT : haptiques proportionnelles à l'action. 🆕 LOT D : la paille
    // et la mèche rasent une ligne / une croix entière — même poids qu'une explosion ; les
    // jumelles et le sirop sont des coups « tactiques » → moyen. Le portail, lui, se sent
    // PENDANT le vol (cf. `feu`) et pas ici : à l'atterrissage il arriverait trop tard.
    const grosChoc = res.etoiles > 0 || res.tirEnOr || res.explosions > 0
      || res.grosLacher >= GROS_LACHER || res.lasers > 0 || res.meches > 0;
    const moyenChoc = res.multiplicateur >= 2 || res.groupe >= 5 || res.capsules > 0
      || res.liens > 0 || res.contagions > 0;
    if (grosChoc) hapticLourd();
    else if (moyenChoc) hapticMoyen();
    else if (res.eclatees.length) hapticLeger();
    if (res.rushFin === 'reussi' || res.plateauNettoye) hapticSucces();
    // 🎯 Progression de l'objectif « déclenche N spéciales » : un retour dédié, sinon le
    // joueur ne sent rien quand il avance. Le garde `!res.objectifAtteint` évite de
    // doubler l'haptique de victoire, jouée 650 ms plus tard par le crédit de fin.
    if (res.specialesDeclenchees > 0 && objSpe.type === 'speciales' && !res.objectifAtteint) {
      hapticMoyen();
    }

    // secousse d'écran : explosions, gros lâcher, ou gros groupe
    // 🆕 LOT D : une ligne rasée ou une croix qui détone secouent autant qu'une bombe.
    if (res.explosions > 0 || res.grosLacher >= GROS_LACHER || res.etoiles > 0
      || res.lasers > 0 || res.meches > 0) secouer(1.4);
    else if (res.groupe >= 6 || res.tombees.length >= 4 || res.liens > 0) secouer(0.8);

    // 🧋 signaux du copain : joie sur match, grimace sur tir sans rien
    if (res.eclatees.length > 0) matchSigRef.current += 1;
    else if (res.points === 0 && !res.bossAction) rateSigRef.current += 1;

    // 💥 débris balistiques : 6/4/3 éclats par perle éclatée (plafond 24, sobriété)
    const debris: Volee['debris'] = [];
    if (eclats.length) {
      const parEclat = eclats.length <= 4 ? 6 : eclats.length <= 6 ? 4 : 3;
      eclats.forEach((e, i) => {
        const nb = Math.min(parEclat, 24 - debris.length);
        for (let k = 0; k < nb; k++) {
          const a = (k / Math.max(1, nb)) * Math.PI + i * 0.7; // éventail vers le haut
          debris.push({
            cle: `db${i}-${k}`, x: e.x, y: e.y, couleur: e.couleur,
            dx: Math.cos(a) * d * (0.7 + (k % 3) * 0.35),
            dy: -Math.abs(Math.sin(a)) * d * (1.1 + (k % 2) * 0.7) - d * 0.3,
            taille: d * (0.16 + (k % 3) * 0.05),
          });
        }
      });
    }
    // 🫧 squash & stretch : les voisines RESTANTES du pop se compressent puis
    // rebondissent. Repérées dans la grille FIGÉE, re-projetées dans la grille
    // RÉSOLUE (+1 ligne si descente) — perles pleines seulement, plafond 8.
    const squashs: Volee['squashs'] = [];
    if (res.eclatees.length) {
      const gApres = etat.grille;
      const decalR = res.nouvelleLigne ? 1 : 0;
      const parties = new Set(res.eclatees.map((e) => `${e.pos.r},${e.pos.c}`));
      res.tombees.forEach((t) => parties.add(`${t.pos.r},${t.pos.c}`));
      const vus = new Set<string>();
      for (const e of res.eclatees) {
        if (squashs.length >= 8) break;
        for (const v of voisins(figee, e.pos.r, e.pos.c)) {
          const b = figee[v.r]?.cases[v.c];
          const cleV = `${v.r + decalR},${v.c}`;
          if (!b || b.capsule || b.special || parties.has(`${v.r},${v.c}`) || vus.has(cleV)) continue;
          const ligneApres = gApres[v.r + decalR];
          if (!ligneApres || !ligneApres.cases[v.c]) continue; // disparue entre-temps
          vus.add(cleV);
          const p = enPx(centreCase(v.r + decalR, v.c, ligneApres.decalee));
          squashs.push({ cle: cleV, x: p.x, y: p.y, couleur: COULEURS[b.couleur] });
          if (squashs.length >= 8) break;
        }
      }
    }

    if (eclats.length || chutes.length || textes.length || debris.length) {
      const av = new Animated.Value(0);
      const avChute = new Animated.Value(0);
      setVolee({ av, avChute, eclats, chutes, textes, debris, squashs });
      Animated.timing(av, { toValue: 1, duration: 420, useNativeDriver: true }).start();
      Animated.timing(avChute, { toValue: 1, duration: 520, easing: Easing.in(Easing.quad), useNativeDriver: true }).start();
      programmer(() => setVolee(null), 800); // 🩹 26/07 — enregistré : `reinit()` le purge
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
        // 🩹 26/07 — `programmer` : ce crédit ne doit PLUS s'exécuter après un démontage
        // de l'écran ni après un passage au niveau suivant (cf. registre de timeouts).
        programmer(() => {
          if (crediteRef.current) return;
          crediteRef.current = true;
          // budget de référence = celui de l'état (inclut le don du copain), pas
          // celui de params (qui l'ignore) — cf. correctif dans creerEtat.
          const etoiles = etoilesNiveau(etat.tirsRestants ?? 0, etat.tirsMax ?? params!.tirsMax);
          const r = terminerNiveau(niveau, etoiles, params!.boss, stats);
          hapticSucces();
          setFin({ type: 'victoire', etoiles: r.etoiles, perles: r.perlesGagnees, bonusJour: r.bonusJour, premiere: r.premiere, capsule: r.capsule, butin: r.butin });
          setPhase('fini');
        }, 650);
        return;
      }
      if (etat.perdu || (etat.tirsRestants ?? 1) <= 0) {
        programmer(() => { // 🩹 26/07 — idem : annulable au démontage / à la réinitialisation
          if (crediteRef.current) return;
          crediteRef.current = true;
          echecNiveau(stats);
          setFin({ type: 'defaite', raison: etat.perdu ? 'limite' : 'tirs' });
          setPhase('fini');
        }, 650);
        return;
      }
    } else if (etat.perdu) {
      programmer(() => { // 🩹 26/07 — idem : `finPartieInfini` ne doit pas créditer un écran quitté
        if (crediteRef.current) return;
        crediteRef.current = true;
        const r = finPartieInfini(stats);
        setFin({ type: 'infini', perles: r.perlesGagnees, bonusJour: r.bonusJour, record: r.record, butin: r.butin });
        setPhase('fini');
      }, 650);
      return;
    }
    setPhase('pret');
  };

  // — gestes (PanResponder créé UNE fois, fonctions à jour via refs) —
  // ⚠️ `atterrirRef` doit rester ici : c'est lui qui protège la fin de niveau de la
  // closure périmée de `feu` (voir le commentaire dans animRef.current.start).
  const atterrirRef = useRef(atterrir); atterrirRef.current = atterrir;
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
    // 🩹 26/07 : la victoire n'est créditée qu'après 650 ms d'animation. Taper la croix
    // pendant ce délai posait `crediteRef`, annulait le setTimeout de victoire et
    // enregistrait une DÉFAITE sur un niveau gagné (ni étoiles, ni capsule, ni
    // déverrouillage). On crédite la victoire si l'objectif est rempli.
    if (!crediteRef.current && aventure && objectifAtteint(etat)) {
      crediteRef.current = true;
      const stats = { ...statsRef.current, score: etat.score };
      const etoiles = etoilesNiveau(etat.tirsRestants ?? 0, etat.tirsMax ?? params!.tirsMax);
      terminerNiveau(niveau, etoiles, params!.boss, stats);
      router.back();
      return;
    }
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
    programmer(() => setMessageFever(null), 1800); // 🩹 26/07 — enregistré (setState après démontage)
    forcer();
  };

  // — rendu —
  const etat = etatRef.current!;
  const grille = grilleFigee ?? etat.grille; // figée pendant le vol
  const capsulesRestantes = aventure ? nbCapsules(grille) : 0;
  // 🩹 26/07 — le HUD ne comptait que le ×2 du jour : il ignorait le % du copain Fruité,
  // le ×2 du week-end et le ×1,3 de série, donc sous-estimait le gain d'un facteur 2 à 5
  // (et `crediteRef.current` dans l'expression est un ref : aucun re-rendu à son
  // changement). `estimerGainPartie` rejoue EXACTEMENT la chaîne du crédit réel,
  // plafond final PERLES_MAX_FINAL.infini inclus.
  const perlesSiFin = estimerGainPartie(perlesPourScore(etat.score), 'infini');
  const multChaine = Math.min(etat.chaine, 3);
  const bossSeuil = etat.bossPhase === 3 ? 2 : 3;
  const bossDans = Math.max(1, bossSeuil - etat.bossCompteur);
  const alerteObjectifTexte = aventure && phase !== 'fini'
    ? alerteObjectif(etat, (c) => NOMS_COULEUR[c])
    : null;

  const pointsGuide: Point[] = [];
  if (guide && d > 0) {
    // 🌀 Un saut de portail n'est PAS un trajet : la bille disparaît d'un point et
    // reparaît à l'autre. Sans ce filtre, le pointillé tendait une corde en travers du
    // plateau entre les deux portails, et le joueur croyait pouvoir tirer à travers.
    // (Le `Set` n'est construit que s'il y a un saut : la visée tourne à 60 Hz.)
    const sauts = guide.ruptures.length ? new Set(guide.ruptures) : null;
    let reste = 0;
    for (let i = 1; i < guide.points.length; i++) {
      if (sauts?.has(i - 1)) { reste = 0; continue; } // la cadence repart à la sortie
      const a = guide.points[i - 1], b = guide.points[i];
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
  // 🫧 pendant la volée, les voisines « squashées » sont retirées du plateau :
  // le calque animé squash & stretch les rend à la même place (mêmes repères,
  // car la grille figée d'un tir enchaîné = grille résolue du tir précédent).
  const masquees = new Set((volee?.squashs ?? []).map((s) => s.cle));
  const bullesPx: BullePx[] = [];
  if (d > 0) {
    grille.forEach((ligne, r) => ligne.cases.forEach((b, c) => {
      if (!b) return;
      if (masquees.size && masquees.has(`${r},${c}`)) return;
      const p = enPx({ x: c + 0.5 + (ligne.decalee ? 0.5 : 0), y: r * LIGNE_H + 0.5 });
      bullesPx.push({ x: p.x, y: p.y, couleur: b.couleur, capsule: b.capsule, special: b.special, pv: b.pv });
    }));
  }

  // ⚠️ tension : le plateau s'approche de la ligne (2,6 perles) ou la frôle (1,4)
  const danger = phase !== 'fini' && bullesPx.some((b) => b.y > yLimite - d * 2.6);
  const critique = phase !== 'fini' && bullesPx.some((b) => b.y > yLimite - d * 1.4);

  // ⚠️ pulsation rouge tant que le danger dure (native, stoppée dès qu'il se calme)
  useEffect(() => {
    if (!danger) { dangerAv.setValue(0); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(dangerAv, { toValue: 1, duration: 430, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(dangerAv, { toValue: 0, duration: 430, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => { loop.stop(); dangerAv.setValue(0); };
  }, [danger, dangerAv]);

  // 📳 haptique UNIQUEMENT à l'entrée en zone danger (moyenne) puis critique (lourde)
  useEffect(() => {
    if (danger && !dangerRef.current) hapticMoyen();
    dangerRef.current = danger;
    if (critique && !critiqueRef.current) hapticLourd();
    critiqueRef.current = critique;
  }, [danger, critique]);

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
                {/* ⭐ étoiles EN DIRECT : ce que rapporterait le niveau fini maintenant */}
                {etat.tirsMax !== null && (
                  <View style={styles.etoilesLive}>
                    {[1, 2, 3].map((i) => (
                      <View key={i} style={{ opacity: i <= etoilesNiveau(etat.tirsRestants ?? 0, etat.tirsMax ?? 1) ? 1 : 0.2 }}>
                        <Icone nom="etoile" taille={13} />
                      </View>
                    ))}
                  </View>
                )}
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
              {/* 👑 boss INCARNÉ : le légendaire du niveau prête son visage —
                  respiration, choc aux dégâts, 3 attitudes, badge de l'attaque */}
              <BossShooter
                perso={bossPersonnage(niveau)}
                phase={etat.bossPhase}
                pvRatio={etat.objProgres / Math.max(1, pv)}
                action={etat.bossProchaineAction}
                imminent={bossDans <= 1}
                taille={46}
              />
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
            {/* 🩹 26/07 — la barre était câblée en dur sur `tomber`/`couleur` : les 4
                nouveaux objectifs chiffrés (chaîne, lâcher, parfaits, spéciales)
                affichaient leur libellé SANS aucune progression. Le test est désormais le
                MÊME que celui d'`objectifCible` côté moteur (« l'objectif porte-t-il une
                cible ? ») : un objectif chiffré de plus s'affichera sans rééditer cette
                ligne. `nettoyer` n'a pas de cible → il reste sans barre, comme avant. */}
            {'cible' in etat.objectif && (
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
          <Animated.View
            style={[styles.chainePill, {
              transform: [{ scale: chaineFlash.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 1.22, 1] }) }],
            }]}
          >
            {/* 🔥 flash de cascade : voile jaune qui s'éteint sur la pastille */}
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, {
                borderRadius: 999, backgroundColor: C.jaune,
                opacity: chaineFlash.interpolate({ inputRange: [0, 1], outputRange: [0.65, 0] }),
              }]}
            />
            <Icone nom="flamme" taille={13} />
            <Text style={styles.chainePillTxt}>Chaîne ×{multChaine}</Text>
          </Animated.View>
        )}
        {/* 🔥 RUSH actif : progression du défi éclair */}
        {etat.rush?.statut === 'active' && (
          <View style={styles.rushPill}>
            <View style={[styles.rushPastille, { backgroundColor: COULEURS[etat.rush.couleur] }]} />
            <Text style={styles.rushTxt} numberOfLines={1}>
              RUSH {etat.rush.progres}/{etat.rush.cible} {NOMS_COULEUR[etat.rush.couleur]} · {etat.rush.tirsFenetre} tir{etat.rush.tirsFenetre > 1 ? 's' : ''}
            </Text>
          </View>
        )}
        {/* 🏅 dernier tir du budget : tout ce qu'il rapporte compte DOUBLE */}
        {etat.tirsRestants === 1 && phase !== 'fini' && (
          <View style={styles.orPill}>
            <Text style={styles.orTxt}>🏅 DERNIER TIR — TOUT COMPTE ×2 !</Text>
          </View>
        )}
        <Pressable
          style={[styles.feverPill, etat.fever >= FEVER_MAX && styles.feverPillPret]}
          disabled={etat.fever < FEVER_MAX || phase !== 'pret'}
          onPress={declencherFever}
        >
          <Icone nom="eclat" taille={13} />
          {/* « Shaker x/5 » explicite : sans le mot, la jauge se confond avec un
              compteur d'objectif (constat de l'audit en jouant du 18-19/07) */}
          <Text style={[styles.feverTxt, etat.fever >= FEVER_MAX && styles.feverTxtPret]}>
            {etat.fever >= FEVER_MAX ? 'SHAKER !' : `Shaker ${etat.fever}/${FEVER_MAX}`}
          </Text>
        </Pressable>
        {/* 📖 Aide de jeu : 13 perles spéciales existent désormais, dont 6 inédites qui
            dévient la bille ou transforment le plateau. Sans une phrase pour les
            expliquer, le joueur SUBIT la mèche et le portail au lieu de les jouer. Le
            bouton est toujours là (aucun scan du plateau dans le rendu) ; la liste des
            perles réellement posées n'est calculée qu'à l'OUVERTURE de la fenêtre. */}
        <Pressable style={styles.aidePill} onPress={() => setAidePerles(true)} hitSlop={6}>
          <Text style={styles.aidePillTxt}>Perles ?</Text>
        </Pressable>
        {etat.tirsParDescente > 0 && (
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {Array.from({ length: etat.tirsParDescente }).map((_, i) => (
              <View key={i} style={[styles.pointTir, i < etat.tirsParDescente - etat.tirs && styles.pointTirPlein]} />
            ))}
          </View>
        )}
      </View>

      {alerteObjectifTexte && (
        <View
          style={styles.alerteObjectif}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <View style={styles.alerteObjectifIcone}><Icone nom="cible" taille={17} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.alerteObjectifTitre}>OBJECTIF À FINIR</Text>
            <Text style={styles.alerteObjectifTexte}>{alerteObjectifTexte}</Text>
          </View>
        </View>
      )}

      {/* === Terrain === (secousse d'écran appliquée ici) */}
      <Animated.View
        style={[styles.terrain, { marginBottom: insets.bottom + 6, transform: [{ translateX: secousseX }, { translateY: secousseY }] }]}
        onLayout={(e) => setDims({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        {...panHandlers.panHandlers}
      >
        {dims && d > 0 && (
          <>
            {/* 🎨 fond VIOLET immersif du plateau (maquette 3g) : la zone de jeu est
                sombre jusqu'à la ligne limite, les perles candy éclatent dessus */}
            <View pointerEvents="none" style={[styles.plateauFond, { height: yLimite + d * 0.4 }]}>
              <View style={[styles.plateauLueur, { left: '12%', top: '18%' }]} />
              <View style={[styles.plateauLueur, { right: '8%', top: '55%', width: 90, height: 90 }]} />
            </View>
            <View style={[styles.mur, { left: offX - 2, height: yLimite + d }]} />
            <View style={[styles.mur, { left: offX + LARGEUR_TERRAIN * d, height: yLimite + d }]} />

            {/* === Plateau rendu en Skia (perles glossy, GPU) === */}
            <Animated.View
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, top: 0, transform: [{ translateY: gridShift }] }}
            >
              <PlateauSkia w={dims.w} h={dims.h} r={d * 0.47} bulles={bullesPx} />
              {/* 🫧 squash & stretch : les voisines du pop (masquées du plateau
                  Skia) sont rendues ici à l'identique — compressées puis rebondies.
                  Même transform gridShift → suivi parfait pendant la descente. */}
              {volee?.squashs.map((s) => (
                <Animated.View
                  key={`sq-${s.cle}`}
                  style={{
                    position: 'absolute', left: s.x - d * 0.47, top: s.y - d * 0.47,
                    transform: [{
                      scale: volee.av.interpolate({
                        inputRange: [0, 0.28, 0.6, 1],
                        outputRange: [1, 0.84, 1.07, 1],
                      }),
                    }],
                  }}
                >
                  <BilleSkia taille={d * 0.94} hex={s.couleur} />
                </Animated.View>
              ))}
            </Animated.View>

            {/* ⚠️ ligne de DÉFAITE : invisible tant que le plateau est loin, elle
                n'apparaît (avec son libellé) que quand les perles s'en approchent —
                désormais PULSÉE, avec vignette rougeoyante sur les bords du terrain */}
            {danger && (
              <>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.vignette, {
                    borderWidth: d * 0.55,
                    borderColor: critique ? 'rgba(194,40,74,0.5)' : 'rgba(150,34,64,0.32)',
                    opacity: dangerAv.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
                  }]}
                />
                <Animated.View style={[styles.limite, {
                  top: yLimite, left: offX, width: LARGEUR_TERRAIN * d,
                  opacity: dangerAv.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
                  transform: [{ scaleY: dangerAv.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
                }]} />
                <Text style={[styles.limiteTxt, { top: yLimite + 4 }]}>
                  {critique
                    ? 'DANGER — la prochaine descente peut être fatale !'
                    : 'DANGER — ne laisse pas les perles toucher la ligne !'}
                </Text>
              </>
            )}

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
            {/* 💥 débris balistiques : propulsés vers le haut en éventail,
                retombent avec la gravité en fondant (≤ 24, pilotés par volee.av) */}
            {volee && volee.debris.map((db) => (
              <Animated.View
                key={db.cle} pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: db.x - db.taille / 2, top: db.y - db.taille / 2,
                  width: db.taille, height: db.taille, borderRadius: db.taille / 2,
                  backgroundColor: db.couleur,
                  opacity: volee.av.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.9, 0] }),
                  transform: [
                    { translateX: volee.av.interpolate({ inputRange: [0, 1], outputRange: [0, db.dx] }) },
                    { translateY: volee.av.interpolate({ inputRange: [0, 0.38, 1], outputRange: [0, db.dy, db.dy + d * 3.2] }) },
                  ],
                }}
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

            {/* 🧋 copain de tir : le compagnon équipé s'anime près du lanceur —
                flottement, joie sur match, grimace sur raté, excitation Shaker */}
            {jeu.buddyId && (
              <View
                pointerEvents="none"
                style={{ position: 'absolute', left: lanceurPx.x + d * 1.62, top: lanceurPx.y + d * 0.3 }}
              >
                <BuddyLanceur
                  buddyId={jeu.buddyId}
                  taille={d * 1.2}
                  fever={etat.fever >= FEVER_MAX}
                  matchSignal={matchSigRef.current}
                  rateSignal={rateSigRef.current}
                />
              </View>
            )}

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
            {/* 🎊 récap ANIMÉ : confettis sur victoire/record, perles en count-up */}
            {(fin.type === 'victoire' || (fin.type === 'infini' && fin.record)) && (
              <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
                <Confettis hauteur={300} />
              </View>
            )}
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
                      +{formatNb(perlesComptees)} perles{fin.bonusJour ? ' (×2 ✨)' : ''}
                    </Text>
                  </View>
                  {fin.butin && (fin.butin.ajoute > 0 || fin.butin.convertisPerles > 0) && (
                    <Text style={styles.finButin}>
                      🎁 Butin : {CONSOMMABLES[fin.butin.id].emoji} {CONSOMMABLES[fin.butin.id].nom}
                      {fin.butin.convertisPerles > 0 ? ` (sac plein → +${fin.butin.convertisPerles} perles)` : ''}
                    </Text>
                  )}
                  {fin.capsule && (
                    <View style={styles.finCapsulesRang}>
                      <Icone nom="cadeau" taille={15} />
                      <Text style={styles.finCapsules}>+1 capsule {fin.capsule === 'doree' ? 'DORÉE' : 'classique'} — ouvre-la vite !</Text>
                      {fin.capsule === 'doree' && <Icone nom="couronne" taille={15} />}
                    </View>
                  )}
                  {fin.premiere && !fin.capsule && (
                    <Text style={styles.finNote}>
                      🎁 Prochaine capsule garantie : niveau {prochaineCapsuleNiveau(niveau)} — plus que {prochaineCapsuleNiveau(niveau) - niveau} !
                    </Text>
                  )}
                  {!fin.premiere && <Text style={styles.finNote}>Niveau déjà réussi : perles réduites, pas de capsule.</Text>}
                  <BoutonJeu titre="Niveau suivant →" onPress={niveauSuivant} style={{ alignSelf: 'stretch' }} />
                  <Pressable onPress={reinit} hitSlop={6}>
                    <Text style={styles.finRetour}>Rejouer ce niveau ›</Text>
                  </Pressable>
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
                      +{formatNb(perlesComptees)} perles{fin.bonusJour ? ' (bonus du jour ×2 ✨)' : ''}
                    </Text>
                  </View>
                  {fin.butin && (fin.butin.ajoute > 0 || fin.butin.convertisPerles > 0) && (
                    <Text style={styles.finButin}>
                      🎁 Butin : {CONSOMMABLES[fin.butin.id].emoji} {CONSOMMABLES[fin.butin.id].nom}
                      {fin.butin.convertisPerles > 0 ? ` (sac plein → +${fin.butin.convertisPerles} perles)` : ''}
                    </Text>
                  )}
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
                style={{ alignSelf: 'stretch' }}
              />
              <Pressable onPress={() => setAchat(null)} hitSlop={6}>
                <Text style={styles.finRetour}>Plus tard</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        )}
      </Modal>

      {/* === 📖 Les perles spéciales de ce plateau === */}
      <Modal visible={aidePerles} transparent animationType="fade" onRequestClose={() => setAidePerles(false)}>
        {aidePerles && (() => {
          // Le scan du plateau vit ICI, dans le corps du `&&` : il ne s'exécute qu'à
          // l'ouverture de la fenêtre, jamais pendant la partie. Le chemin de rendu de la
          // visée (60 Hz) ne doit rien gagner de neuf — c'est la règle de perf du lot.
          const vues = new Set<SpecialBulle>();
          for (const l of etat.grille) for (const b of l.cases) if (b?.special) vues.add(b.special);
          const presentes = ORDRE_PERLES.filter((id) => vues.has(id));
          return (
            <Pressable style={styles.modalFond} onPress={() => setAidePerles(false)}>
              <Pressable style={styles.modalCarte} onPress={() => {}}>
                <Text style={styles.modalTitre}>Les perles de ce plateau</Text>
                {presentes.length === 0 ? (
                  <Text style={styles.modalTexte}>
                    Aucune perle spéciale sur ce plateau — que des perles à assortir par 3 !
                  </Text>
                ) : (
                  <ScrollView style={styles.aideListe} showsVerticalScrollIndicator={false}>
                    {presentes.map((id) => (
                      <View key={id} style={styles.aideLigne}>
                        <Text style={styles.aideEmoji}>{EFFETS_PERLE[id].emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.aideNom}>{EFFETS_PERLE[id].nom}</Text>
                          <Text style={styles.aideTexte}>{EFFETS_PERLE[id].aide}</Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                )}
                <BoutonJeu titre="Compris !" onPress={() => setAidePerles(false)} style={{ alignSelf: 'stretch' }} />
              </Pressable>
            </Pressable>
          );
        })()}
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
    alignItems: 'center', justifyContent: 'center', borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
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
    alignItems: 'center', borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
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
  // ⭐ étoiles en direct dans l'en-tête
  etoilesLive: { flexDirection: 'row', gap: 2, marginLeft: 5 },
  // 🔥 pill du RUSH actif
  rushPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FBE3E8', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 11,
    borderWidth: 1, borderColor: '#ec647b',
  },
  rushPastille: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: '#fff' },
  rushTxt: { fontFamily: F.t800, fontSize: 11.5, color: '#B3364F' },
  // 🏅 bannière du dernier tir (tir en or)
  orPill: {
    backgroundColor: C.jaune, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#C99012',
  },
  orTxt: { fontFamily: F.t800, fontSize: 11.5, color: '#5A4300' },
  feverPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999,
    paddingVertical: 4, paddingHorizontal: 9, backgroundColor: C.carte, borderWidth: 1, borderColor: C.bord,
  },
  feverPillPret: { backgroundColor: C.violet, borderColor: C.jaune },
  feverTxt: { fontFamily: F.t800, fontSize: 11, color: C.texte3, fontVariant: ['tabular-nums'] },
  feverTxtPret: { color: '#fff' },
  // 📖 pastille « Perles ? » et fenêtre d'aide (contenu tiré d'EFFETS_PERLE)
  aidePill: {
    borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10,
    backgroundColor: C.carte, borderWidth: 1, borderColor: C.bord,
  },
  aidePillTxt: { fontFamily: F.t800, fontSize: 11, color: C.texte2 },
  aideListe: { alignSelf: 'stretch', maxHeight: 300 },
  aideLigne: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 5 },
  aideEmoji: { fontSize: 21, width: 27, textAlign: 'center' },
  aideNom: { fontFamily: F.t800, fontSize: 13.5, color: C.violet },
  aideTexte: { fontFamily: F.t400, fontSize: 12, color: C.texte2, lineHeight: 17 },
  pointTir: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.bord },
  pointTirPlein: { backgroundColor: C.violetClair },

  alerteObjectif: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    marginHorizontal: 16, marginTop: 6, paddingVertical: 8, paddingHorizontal: 11,
    backgroundColor: '#FFF3D6', borderRadius: 14, borderWidth: 1.5, borderColor: '#F0B737',
  },
  alerteObjectifIcone: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F2DA33',
  },
  alerteObjectifTitre: { fontFamily: F.t800, fontSize: 10.5, color: '#9A6B00' },
  alerteObjectifTexte: { fontFamily: F.t700, fontSize: 11.5, lineHeight: 15, color: '#54470A' },

  terrain: { flex: 1, marginTop: 4, overflow: 'hidden' },
  mur: { position: 'absolute', top: 0, width: 2, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 1 },
  limite: { position: 'absolute', height: 2.5, backgroundColor: 'rgba(236,100,123,0.85)', borderRadius: 1 },
  // ⚠️ vignette DANGER : liseré rougeoyant sur tout le bord du terrain
  vignette: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 24 },
  limiteTxt: {
    position: 'absolute', left: 0, right: 0, textAlign: 'center',
    fontFamily: F.t800, fontSize: 10.5, color: '#ec647b',
  },
  guide: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  // 🎨 fond violet immersif du plateau + lueurs douces
  plateauFond: {
    position: 'absolute', left: 0, right: 0, top: 0,
    backgroundColor: '#452A6E', borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  plateauLueur: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(129,95,174,0.35)',
  },
  apercuPose: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderStyle: 'dashed', borderColor: C.vert, backgroundColor: 'rgba(163,199,36,0.16)',
  },
  apercuTxt: { fontFamily: F.t800, fontSize: 11, color: C.vertFonce },
  projectile: { position: 'absolute', ...OMBRE },
  reflet: { position: 'absolute', top: '14%', left: '14%', backgroundColor: '#fff', opacity: 0.5 },
  eclat: { position: 'absolute', borderWidth: 3.5, backgroundColor: 'transparent' },
  // ⚠️ les textes flottants vivent sur le PLATEAU VIOLET → clair + ombre portée
  flottant: {
    position: 'absolute', fontFamily: F.t800, fontSize: 17, color: '#fff',
    textShadowColor: 'rgba(43,23,74,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  flottantGros: { fontFamily: F.titre, fontSize: 20, color: C.jaune },
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
    alignItems: 'center', alignSelf: 'stretch', borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
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
  finButin: { fontFamily: F.t700, fontSize: 13, color: C.vertFonce, textAlign: 'center', lineHeight: 18 },
  finRetour: { fontFamily: F.t700, fontSize: 14, color: C.texte2, padding: 6 },

  modalFond: {
    flex: 1, backgroundColor: 'rgba(42,29,70,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  modalCarte: {
    backgroundColor: C.carte, borderRadius: 24, padding: 24,
    alignItems: 'center', gap: 12, alignSelf: 'stretch', borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  modalTitre: { fontFamily: F.titre, fontSize: 21, color: C.violet },
  modalTexte: { fontFamily: F.t400, fontSize: 13.5, color: C.texte2, textAlign: 'center', lineHeight: 20 },
});
