// === Boba Quest — écran de DUEL (combat tour par tour) ===
// Type Pokémon : ton actif en bas, l'adversaire en haut, tu choisis l'attaque,
// les événements du moteur (arene.ts) sont rejoués un à un avec animations.
// Modes : ?mode=pnj&rang=N (Maître de l'Arène) · ?mode=ami[&amical=1|&mise=X&gain=Y]
// · ?mode=tournoi&etape=N · ?mode=boss · ?mode=defi&ami=Nom
// · ?mode=tournee&duel=N&s=SEMAINE (Tournée des Maîtres — état de run lu dans le store,
//   l'adversaire est seedé par les PARAMS pour ne pas recréer le combat après victoire)
//
// 🔧 REFONTE 26/07 (LOT B) — l'écran se cale sur le moteur refondu :
//   B1 · rythme resserré (~−40 % d'attente) : le round se REGARDE deux fois moins
//   B2 · barre d'action à l'ÉNERGIE ; changer / jouer un objet NE FERMENT PLUS le tour
//   B3 · statuts affichés GÉNÉRIQUEMENT depuis `c.statuts` + `INFOS_STATUT`
//   B4 · les animations se branchent sur `evt.cle` — fini le parsing de texte français
//   B5 · l'écran AFFICHE, il ne décide de rien (combo, coûts et victoire = moteur)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Line } from 'react-native-svg';

import { BORD, C, F, R, OMBRE } from '@/constants/charte';
import {
  ActionJoueur, adversairePNJ, adversaireTournoi, aStatut, Attaque, Combattant, CoteCombat,
  creerCombat, creerCombatBoss, CHARGE_MAX, COUT_CHANGER, COUT_OBJET, COUT_SPE, decrireIntention,
  ENERGIE_MAX, ENERGIE_PAR_ROUND, energiePrevue, equipeSam, equipeAmi, EtatCombat, EvtCombat,
  GARDE_MAITRISEE, GARDE_PARFAITE, GARDE_REDUCTION, HINT_ATTAQUE, HINT_TRAIT, INFOS_STATUT,
  jouerRound, multCombo, multType, signatureDe, TypeAttaque,
  Timing, timingDepuisPosition, viseeBlessure, viseeDuree, viseeZones,
} from '@/components/jeu/arene';
import { adversaireTournee, appliquerBonusRun, appliquerPvReportes } from '@/components/jeu/tournee';
import PastilleCollectible from '@/components/jeu/collectibles';
import { BurstSkia } from '@/components/jeu/combat-skia';
import {
  DUREE_SOI_MS, DUREE_VOL_MS, EffetSoi, EtoileImpact, positionCarte, VolAttaque,
  visuelAttaque, type VisuelAttaque,
} from '@/components/jeu/projectiles';
import { Icone, IconeEmoji, IconeType } from '@/components/jeu/icones';
import {
  bossDeLaSemaine, cleJour, cleSemaine, CONSOMMABLES, CONSOMMABLE_IDS, ConsommableId,
  mutateurDuJour, OBJETS, PC_DEFAITE, RARETES, TOURNOI_ETAPES, TOURNOI_RETENTE_PERLES,
  trouverCollectible, type ExploitsCarte, type SetId,
} from '@/components/jeu/economie';
import { BoutonJeu, Confettis, formatNb, IconePerle } from '@/components/jeu/ui-jeu';
import { hapticLeger, hapticLourd, hapticMoyen, hapticSucces } from '@/lib/juice';
import {
  crediterExploits, defaiteArene, defaiteTourneeDuel, defaiteTournoi, goutsEquipe, niveauxEquipe,
  objetsEquipe, resoudreDefiAmi, resoudreDuelAmi, talentsEquipe, useBobaQuest, utiliserConsommable,
  victoireArene, victoireBoss, victoireTourneeDuel, victoireTournoi,
} from '@/store/jeu';

// --- ⏱️ B1 · BARÈME D'ATTENTE DU REPLAY (≈ −40 % sur l'ancien) -------------------------
// Diagnostic n°7 : un round minimal imposait 2 440 ms de visionnage PASSIF pour 2 taps
// de joueur (ratio d'agency 1:3). Le moteur résout tout d'un bloc ; c'est ICI que le
// round se raconte, donc c'est ici que se joue le nerf du combat. Le bouton ×1/×2
// divise encore ces valeurs (cf. `attendre`).
const ATTENTE = {
  annonce: 300,
  annonceSignature: 620, // ⭐ cinématique COMPRISE (DUREE_CINE_MS + respiration)
  degatsActif: 420,
  degatsBanc: 260,
  soin: 380,
  statut: 300,
  riposte: 340,
  koAdverse: 700,
  koAllie: 520,
  entree: 420,
  fin: 400,
} as const;

// ⭐ Durée de la cinématique de Signature. Elle est PASSÉE au composant (au lieu d'y
// être figée) : sinon, à ×2, le voile disparaissait au milieu de son animation.
const DUREE_CINE_MS = 420;
// 💥 Durée de la cinématique de K.O. — calée sur ATTENTE.koAdverse pour que le plein
// écran ne déborde jamais sur l'événement suivant.
const DUREE_KO_MS = ATTENTE.koAdverse;

// --- 🎯 B2 · QUELLES ACTIONS MÉRITENT UNE JAUGE DE TIMING ? ----------------------------
// Le moteur ne lit `timing` (ni le combo) que pour les actions qui frappent ou qui
// soignent. `bouclier` et `boost` posent un statut, point : le joueur faisait un QTE
// pour RIEN (diagnostic n°3). `Record` exhaustif volontaire — ajouter un TypeAttaque
// au moteur casse la compilation ICI au lieu de passer inaperçu.
//
// ⚖️ CONTREPARTIE ASSUMÉE, mesurée sur le moteur avant d'être acceptée.
// `jouerRound` lit aussi `timingA` EN DEHORS de la résolution d'action : un tap PARFAIT
// crédite `ENERGIE_PARFAIT` (+1⚡) et fait monter `etat.combo`. Sept cartes ont une Spé
// de type `boost`/`bouclier` (classico, sucrette, passion, pudding, pasteka, jelly,
// brown-sugar-king) : sur CE tour-là, elles ne peuvent donc pas gagner ce +1⚡.
// Ce qui est perdu, exactement :
//   • le +1⚡ du tap parfait — inatteignable, par définition : il n'y a pas de tap ;
//   • la CAPITALISATION du combo (pas de +1)… mais pas le combo lui-même : le moteur
//     écrit `combo = parfait ? combo+1 : rate ? 0 : combo`, donc SANS timing le combo est
//     PRÉSERVÉ tel quel. Un tap raté, lui, l'aurait remis à zéro.
// La perte est donc symétrique : ni prime, ni casse. « Pas de tap, pas de bonus de tap »
// reste la règle la plus lisible, et c'est la seule cohérente avec le diagnostic n°3 —
// rendre la jauge à ces actions reviendrait à réimposer un geste dont la résolution ne
// dépend pas (vérifié : les événements produits sont identiques pour les 4 timings),
// c'est-à-dire à réintroduire exactement le défaut qu'on vient de corriger.
// Le jour où un `boost`/`bouclier` deviendra sensible au timing dans `resoudreAction`,
// c'est CETTE table qu'il faudra rebasculer à `true` — rien d'autre.
const TIMING_UTILE: Record<TypeAttaque, boolean> = {
  degats: true, double: true, etourdit: true, zone: true, soin: true,
  bouclier: false, boost: false,
};

// 🧪 B3 · Nombre de puces de statut affichées avant le repli « +n ». Une carte peut en
// porter 13 : au-delà de 4, la ligne de PV déborderait sur la jauge Signature.
const MAX_PUCES_STATUT = 4;

// --- 👹 LA REVANCHE DU BOSS HEBDO (27/07/2026) -----------------------------------------
// Constat : le joueur battait le contenu le plus intéressant du jeu et sa récompense
// était une PORTE FERMÉE pendant sept jours (« Vaincu cette semaine — reviens lundi »).
// La revanche rouvre la porte : le MÊME boss, rejouable autant qu'on veut, un cran plus
// fort chaque jour de la semaine.
//
// ⚠️ ZÉRO CRÉDIT, ET ZÉRO APPEL AUX FONCTIONS DE CRÉDIT. `victoireBoss()` sait déjà
// refuser un second versement (`{ deja: true }`), mais on ne l'appelle même pas : un
// appel « qui ne fait rien » est une bombe à retardement — il suffirait qu'un lot futur
// ajoute une ligne AVANT le garde-fou pour transformer la revanche en distributeur de
// perles. Le récap de revanche n'affiche donc aucune ligne de gain, et ne peut pas en
// afficher : sa branche de rendu ne contient pas de `ligneGain`.
//
// L'ENJEU sans récompense : le PALIER atteint (affiché, et il monte tout seul avec les
// jours), et le PALMARÈS des cartes (`noterExploit`) — des compteurs cosmétiques qui
// donnent des TITRES et qui sont déjà crédités dans tous les modes. Aucun champ persisté
// n'a été créé : le palier se DÉRIVE du jour de la semaine (cf. `arene.tsx`), il arrive
// par la ROUTE comme l'étape de Tournoi et le n° de duel de Tournée.
// Borne DURE : la route est une entrée utilisateur, pas une source de confiance. 7 = les
// 7 jours de la semaine, soit le maximum que `arene.tsx` puisse dériver du calendrier.
const REVANCHE_PALIER_MAX = 7;
// ⚖️ DOSAGE RE-CALIBRÉ 28/07 — mesuré par le harnais /tmp/combat2 (joue VRAIMENT la
// revanche paliers 1→7, 3 gimmicks, 3 profils d'équipe, 500 seeds, bon joueur : timing
// « bien », garde sur intention dangereuse, stun contre la régén).
//   AVANT (ATK 0,10 / PV 0,22) : la difficulté montait surtout par les PV. Le boss devenait
//   une éponge géante, et comme la régén du gimmick « regen » vaut 8 % de SES PV max, plus
//   il gonflait, plus il se soignait vite — au palier 7 il rendait 7× les dégâts encaissés
//   (soin÷dégâts mesuré 7,2), finissait le combat À 100 % de PV, et les combats traînaient
//   à 27-30 rounds ALORS QUE l'escalade du moteur plafonne à ×3 au round 25 (borne cassée,
//   heal-lock : injouable même en jouant bien). Les deux absurdités visées par le défaut.
//   APRÈS : la difficulté monte par l'ATTAQUE (boss plus LÉTAL), pas par les PV. Toute
//   croissance de PV rouvrait la dérive régén×éponge (mesuré : dès +1 %/palier la queue
//   repasse 27 rounds) → PV/palier = 0. Le boss garde son éponge de BASE (×2,2), il ne
//   grossit plus. Résultat mesuré : combats bornés (équipes raisonnables ≤ 26 rounds, à
//   parité du boss de base ; pire cas « whale » tank+revive vs regen ≤ 28, rare), régén
//   TOUJOURS battable (soin÷dégâts ≤ 2,2, boss amené à 0 % avec le contre), courbe
//   progressive et jouable (cf. la table du rapport). ATK 0,10→0,12 pour garder un palier 7
//   ÉPIQUE sans allonger la borne (une ATK plus haute fait garder davantage → combats plus
//   longs : 0,12 est le meilleur compromis létalité/borne).
const REVANCHE_ATK_PAR_PALIER = 0.12;  // +12 % d'ATTAQUE par palier (la difficulté vient de là)
const REVANCHE_PV_PAR_PALIER = 0.00;   // +0 % de PV : le boss NE grossit plus (sinon régén×éponge → heal-lock + combats > 25 rounds)

// --- 🔑 B4 · LE CONTRAT DES ANNONCES ---------------------------------------------------
// Deuxième moitié de la dette 🔴 §B4. `cle` avait été ajouté aux seuls `{ t: 'statut' }`,
// or ce sont les `{ t: 'annonce' }` qui pilotent la cinématique de Signature ET tout le
// visuel d'attaque (projectile, assaut de mêlée, aura de soin/boost/bouclier). L'écran
// les reconnaissait au TEXTE :
//     texte.startsWith('⭐')                       → Signature
//     attaques.find((a) => texte.includes(a.nom))  → attaque jouée
// Ce n'est pas seulement fragile, c'est AMBIGU par construction : « X utilise Y ! » est
// le libellé d'une attaque ET celui d'un consommable. Un consommable OTA dont le nom
// contiendrait celui d'une attaque (« Boulet de tapioca en réserve ») ferait partir le
// projectile d'un coup jamais joué — sans erreur, sans test rouge.
//
// Le moteur porte désormais le discriminant. `attaqueIdx` est l'index dans
// `combattant.attaques`, présent UNIQUEMENT pour `cle === 'attaque'` : lui seul sait
// quelle attaque a réellement été résolue (la Spé se replie sur l'attaque de base quand
// les munitions ou l'énergie manquent — décision de `resoudreAction`, jamais de l'écran).
//
// ⚠️ Ce type MIROITE le contrat déclaré dans `arene.ts` (`EvtCombat`, variante
// `annonce`). Il est écrit en INTERSECTION avec le type du moteur, donc :
//  • il compile tant que le moteur n'a pas encore publié les champs (ils sont optionnels) ;
//  • il s'aligne automatiquement dès qu'ils apparaissent ;
//  • une divergence de NOM de champ côté moteur ne casserait rien mais rendrait l'écran
//    silencieusement sobre (aucun projectile, aucune cinématique) — c'est la dégradation
//    choisie : sobre plutôt que menteuse.
type CleAnnonce = 'attaque' | 'signature' | 'objet' | 'garde' | 'changement';
type AnnonceMotorisee = Extract<EvtCombat, { t: 'annonce' }> & {
  cle?: CleAnnonce;
  attaqueIdx?: 0 | 1;
};

// --- 🔑 B4 · RÉACTIONS DE L'ÉCRAN, INDEXÉES PAR `evt.cle` ------------------------------
// Dette 🔴 fermée : `rejouerEvts` pilotait ses animations en PARSANT le texte français
// (`texte.includes('esquive')`, `/critique/i`) — le moindre changement de libellé
// cassait silencieusement une animation, sans erreur ni test rouge. Le moteur expose
// désormais `cle`, discriminant STABLE ; `texte` ne sert plus qu'à l'affichage.
// TOUTE clé émise par le moteur a une entrée ici (même vide) : le script de
// vérification compare cette table aux clés réellement produites, donc une clé ajoutée
// au moteur et non câblée se voit immédiatement. Une clé inconnue dégrade proprement
// (journal seul), elle ne casse rien.
// 🩹 27/07 (retour de Yoann : « il y a une vibration à chaque événement ») — les
// haptiques de statut sont TOUTES retirées. Un round produit jusqu'à une douzaine
// d'événements narratifs (poses de marque, expirations, phases, énergie…) : en faire
// vibrer chacun sature la main et finit par ne plus rien signifier. La règle est
// désormais UNE vibration PAR ATTAQUE, au moment de l'impact — plus le K.O., la
// riposte et la fin de combat, qui sont rares.
// ⚠️ Ne pas rebrancher d'haptique ici : cette table ne sert plus qu'au discriminant
// `crit`, qui pilote le burst d'impact. Le `Record` reste exhaustif pour que le script
// de vérification continue de signaler une clé du moteur non câblée.
type ReactionStatut = { crit?: true };
const REACTIONS_STATUT: Record<string, ReactionStatut> = {
  critique: { crit: true },
  'bris-de-glace': {}, brise: {}, transperce: {}, eclaboussure: {}, 'premiere-frappe': {},
  'dernier-sursaut': {}, 'second-souffle': {}, 'boss-phase-2': {}, 'boss-phase-3': {},
  revive: {},
  'parade-heroique': {}, 'parade-parfaite': {}, garde: {}, 'garde-amortit': {},
  'bouclier-encaisse': {}, 'garde-gachee': {}, 'zone-immune': {},
  'marque-collant': {}, 'marque-givre': {}, 'marque-petillant': {}, 'marque-sceau': {},
  'pose-etourdi': {}, 'etourdi-passe': {}, 'immunite-etourdi': {}, insensible: {},
  'retire-etourdi': {}, 'pose-brulure': {}, 'pose-poison': {}, 'pose-faiblesse': {},
  'pose-fureur': {}, brulure: {}, poison: {},
  energie: {}, 'energie-volee': {}, recul: {}, charge: {},
  effleure: {}, changement: {}, bouclier: {}, boost: {}, 'fatigue-soin': {},
  'statut-expire': {},
  'pose-collant': {}, 'pose-givre': {}, 'pose-petillant': {}, 'pose-bouclier': {},
  'pose-boost': {}, 'pose-garde': {}, 'pose-regen': {}, 'pose-insensible': {},
};

type Recap =
  | { type: 'pnj'; gagne: boolean; perles: number; capsule: 'classique' | 'doree' | null; rang: number; pc: number; serie: number; multSerie: number }
  | { type: 'tournoi'; gagne: boolean; perles: number; capsule: 'classique' | 'doree' | null; etape: number; champion: boolean }
  | { type: 'tournee'; gagne: boolean; perles: number; etape: number; score: number; record: number; nouveau: boolean }
  // `revanche` > 0 = combat SANS AUCUNE récompense (cf. bloc REVANCHE ci-dessus).
  | { type: 'boss'; gagne: boolean; perles: number; capsules: number; eclats: number; deja: boolean; revanche: number; rounds: number }
  | { type: 'defi'; gagne: boolean; ami: string; perles: number }
  | { type: 'ami'; gagne: boolean; amical: boolean; miseId?: string; gainId?: string; nouveau?: boolean };

export default function DuelScreen() {
  const insets = useSafeAreaInsets();
  const jeu = useBobaQuest();
  const params = useLocalSearchParams<{ mode?: string; rang?: string; etape?: string; amical?: string; mise?: string; gain?: string; ami?: string; duel?: string; s?: string; revanche?: string }>();
  const mode = params.mode === 'pnj' ? 'pnj' : params.mode === 'tournoi' ? 'tournoi' : params.mode === 'boss' ? 'boss' : params.mode === 'defi' ? 'defi' : params.mode === 'tournee' ? 'tournee' : 'ami';
  const rang = Math.max(1, parseInt(String(params.rang ?? '1'), 10) || 1);
  const etape = Math.min(2, Math.max(0, parseInt(String(params.etape ?? '0'), 10) || 0));
  // 🗺️ Tournée : le n° de duel (1.., SANS borne haute) et la semaine seed de la run
  // viennent de la ROUTE — jamais du store — sinon le useEffect [adversaire]
  // recréerait le combat au moment où victoireTourneeDuel met à jour la run.
  const duelNum = Math.max(1, parseInt(String(params.duel ?? '1'), 10) || 1);
  const semTournee = params.s ? String(params.s) : cleSemaine();
  const amical = params.amical === '1';
  const miseId = params.mise ? String(params.mise) : undefined;
  const gainId = params.gain ? String(params.gain) : undefined;
  const amiNom = params.ami ? String(params.ami) : 'Un ami';
  // 👹 Palier de REVANCHE : 0 = le vrai combat hebdomadaire (celui qui paie), > 0 = une
  // revanche sans la moindre récompense. Il vient de la ROUTE, jamais du store — même
  // règle que l'étape de Tournoi et le n° de duel de Tournée — et il est BORNÉ ici :
  // une URL est une entrée utilisateur, pas une source de confiance.
  const revanche = Math.max(0, Math.min(REVANCHE_PALIER_MAX, parseInt(String(params.revanche ?? '0'), 10) || 0));

  // Le boss de revanche est le MÊME boss, dopé. On DÉRIVE un objet local plutôt que de
  // toucher `bossDeLaSemaine` (economie.ts est figé par un autre lot) : le gimmick, le
  // visage et l'indice restent ceux de la semaine, seules les stats montent.
  const boss = useMemo(() => {
    const base = bossDeLaSemaine(cleSemaine());
    if (!revanche) return base;
    return {
      ...base,
      nom: `${base.nom} · Revanche ${revanche}`,
      echelle: base.echelle * (1 + REVANCHE_ATK_PAR_PALIER * revanche),
      pvBonus: base.pvBonus * (1 + REVANCHE_PV_PAR_PALIER * revanche),
    };
  }, [revanche]);
  const adversaire = useMemo(
    () => (mode === 'pnj'
      ? adversairePNJ(rang)
      : mode === 'tournoi'
        ? { ...adversaireTournoi(cleSemaine(), etape), nom: `${adversaireTournoi(cleSemaine(), etape).nom} · ${TOURNOI_ETAPES[etape]}` }
        : mode === 'tournee'
          ? adversaireTournee(semTournee, duelNum)
          : mode === 'boss'
            ? { nom: boss.nom, ids: [boss.combattantId], echelle: boss.echelle, objets: {} }
            : mode === 'defi'
              ? { nom: amiNom, ids: equipeAmi(amiNom), echelle: 1, objets: {} }
              : { nom: amical ? 'Sam (amical)' : 'Sam — duel misé', ids: equipeSam(cleJour()), echelle: 1, objets: {} }),
    [mode, rang, etape, duelNum, semTournee, amical, boss, amiNom],
  );

  const mutateur = useMemo(() => mutateurDuJour(cleJour()), []);
  const nouveauCombat = () => {
    // 🎖️ les talents choisis s'appliquent dans TOUS les modes (côté joueur uniquement)
    const talents = talentsEquipe(jeu);
    // 👅 E4 · Rang de Goût : alimenté par les VRAIS achats, côté joueur UNIQUEMENT
    // (le PNJ n'a ni niveau, ni talent, ni Goût — cf. §E4).
    const gouts = goutsEquipe(jeu.arene.equipe, jeu);
    if (mode === 'boss') return creerCombatBoss(jeu.arene.equipe, boss, objetsEquipe(jeu), mutateur, niveauxEquipe(jeu), talents, gouts);
    const frais = creerCombat(jeu.arene.equipe, adversaire.ids, adversaire.echelle, objetsEquipe(jeu), adversaire.objets, mutateur, niveauxEquipe(jeu), talents, gouts);
    if (mode === 'tournee') {
      // Bonus cumulés sur le combat frais, PUIS PV reportés (clampés aux PV max
      // éventuellement augmentés par « Perle Géante »). Run absente (lien périmé)
      // → duel joué « à nu », garde-fou sans casser l'écran.
      const run = jeu.tournee.run;
      if (run) {
        appliquerBonusRun(frais, run.bonus);
        appliquerPvReportes(frais, run.pvReportes);
      }
    }
    return frais;
  };
  const combatRef = useRef<EtatCombat | null>(null);
  // 🔋 MUNITIONS DE SPÉ — total de pastilles ●/○, relevé SUR LE COMBATTANT.
  // `SPE_USAGES` (3) n'est que le socle : le moteur en accorde davantage (talent
  // `spe_munition`, cumulable · 👅 Goût rang 3 · bonus de run « Recharge de Spé »), donc
  // `speRestantes` vaut couramment 4, 5 ou 6 à l'ouverture. Dériver le total d'une
  // constante globale donnait un nombre de pastilles VARIABLE (5 pleines et −2 vides…)
  // et laissait croire au plein alors que deux munitions étaient déjà brûlées.
  // On relève donc la dotation TELLE QUE LE MOTEUR VIENT DE LA CALCULER, à la création
  // du combat — bonus de run compris, `appliquerBonusRun` tournant dans `nouveauCombat`.
  // Ce n'est pas une règle redérivée : c'est la valeur du moteur, mémorisée.
  const munitionsMax = useRef<Record<string, number>>({});
  const releverMunitions = (etat: EtatCombat) => {
    const releve: Record<string, number> = {};
    for (const c of etat.equipes.a) releve[c.id] = c.speRestantes;
    munitionsMax.current = releve;
  };
  if (!combatRef.current) {
    combatRef.current = nouveauCombat();
    releverMunitions(combatRef.current);
  }
  const combat = combatRef.current;

  // ÉTAT D'AFFICHAGE, mis à jour événement par événement pendant le replay.
  // Le moteur résout tout le round d'un coup : si on lisait directement ses PV,
  // la barre sauterait à l'état final — ici elle descend coup par coup.
  // ⚡ `energie` et `combo` suivent le même principe : ils viennent du MOTEUR et ne
  // sont rafraîchis qu'à la synchronisation de fin de round, pour ne pas voir les
  // pastilles sauter au milieu d'un replay (les boutons sont de toute façon inactifs).
  const [affiche, setAffiche] = useState(() => ({
    actifs: { a: 0, b: 0 } as Record<CoteCombat, number>,
    pv: {
      a: combat.equipes.a.map((c) => c.pv),
      b: combat.equipes.b.map((c) => c.pv),
    } as Record<CoteCombat, number[]>,
    energie: { ...combat.energie } as Record<CoteCombat, number>,
    combo: combat.combo,
  }));
  const afficheRef = useRef(affiche);
  afficheRef.current = affiche;
  const [journal, setJournal] = useState<string[]>([`${adversaire.nom} veut se battre !`]);
  // `enCoursRef` double l'état : deux taps rapprochés peuvent arriver AVANT le
  // re-rendu provoqué par setEnCours — le ref, lui, est à jour immédiatement.
  const [enCours, setEnCours] = useState(false);
  const enCoursRef = useRef(false);
  const majEnCours = (v: boolean) => { enCoursRef.current = v; setEnCours(v); };
  const [flottant, setFlottant] = useState<{ cote: CoteCombat; txt: string; couleur: string; cle: number } | null>(null);
  const [burst, setBurst] = useState<{ cote: CoteCombat; crit: boolean; cle: number; couleur?: string } | null>(null);
  // 🎬 PACK 3 — couche visuelle des attaques : projectile en vol, effet « soi »
  // (soin/boost/bouclier), étoile d'impact de mêlée. Un seul de chaque à la fois :
  // le replay des événements est séquentiel, le nouveau remplace l'ancien (par `cle`).
  const [vol, setVol] = useState<{ cle: number; cote: CoteCombat; visuel: VisuelAttaque } | null>(null);
  const [soiFx, setSoiFx] = useState<{ cle: number; cote: CoteCombat; famille: 'soin' | 'boost' | 'bouclier'; couleur: string } | null>(null);
  const [etoile, setEtoile] = useState<{ cle: number; cote: CoteCombat; couleur: string } | null>(null);
  // attaque en cours de résolution → couleur du burst/étoile à l'impact (degats)
  const attaqueEnVol = useRef<Attaque | null>(null);
  // 📳 Vibration ARMÉE par l'annonce d'une attaque, tirée au premier impact puis remise
  // à null : garantit exactement UNE vibration par attaque, quel que soit le nombre
  // d'événements de dégâts qu'elle produit (zone, multi-coup, éclaboussure).
  const vibrationArmee = useRef<'normal' | 'lourd' | null>(null);
  // dimensions MESURÉES de la zone de combat (positions des cartes en fractions)
  const [zoneDims, setZoneDims] = useState({ l: 0, h: 0 });
  const [sacVisible, setSacVisible] = useState(false);
  const [recap, setRecap] = useState<Recap | null>(null);
  // 🩹 26/07 — ABANDON = DÉFAITE dans tous les modes à ENJEU. Un combat devient
  // « engagé » dès le premier round réellement joué (attaque, garde, changement,
  // consommable) : sortir par la croix le résout alors comme une défaite. Sans cela
  // le RNG (Math.random) offrait un tirage neuf à chaque relance : les −14 PC de
  // l'Arène n'étaient jamais payés, le Boss hebdo devenait gagnable à 100 % par
  // insistance et les 400 perles de retente du Tournoi se contournaient gratuitement.
  const engageRef = useRef(false);
  const [confirmerAbandon, setConfirmerAbandon] = useState(false);
  // 🎯 jauge de timing : action en attente du tap, et verdict flash (PARFAIT/Bien/Raté)
  const [timingDemande, setTimingDemande] = useState<0 | 1 | 'signature' | 'garde' | null>(null);
  const [verdictTiming, setVerdictTiming] = useState<{ t: Timing; cle: number } | null>(null);
  // 🔄🎒 B2 — PRÉFIXE ARMÉ : changer de carte ou jouer un objet ne ferme PLUS le tour
  // (§A2). Le tap n'engage donc plus rien : il ARME un préfixe, l'écran enchaîne sur le
  // choix d'action, et tout part en UN SEUL `jouerRound({ changer|objet, puis })`.
  // C'est ce qui ressuscite le banc, mécaniquement mort quand changer coûtait le tour.
  type Prefixe = { k: 'changer'; index: number } | { k: 'objet'; id: ConsommableId };
  const [prefixe, setPrefixe] = useState<Prefixe | null>(null);
  const prefixeRef = useRef<Prefixe | null>(null);
  prefixeRef.current = prefixe;
  // 💥 K.O. cinématique plein écran quand un adversaire tombe
  const [koFlash, setKoFlash] = useState<{ nom: string; cle: number } | null>(null);
  // ⭐ cinématique de SIGNATURE par famille (joueur OU adverse), skippable au tap
  const [cine, setCine] = useState<{ set: SetId; adverse: boolean; nom: string; cle: number } | null>(null);
  const cineSkipRef = useRef<(() => void) | null>(null);
  const [vitesse, setVitesse] = useState<1 | 2>(1);
  const vitesseRef = useRef<1 | 2>(1);
  vitesseRef.current = vitesse;
  const crediteRef = useRef(false);

  // --- ⏳ REGISTRE DE MINUTERIES ---------------------------------------------------------
  // Aucun `setTimeout` nu ne doit survivre au démontage : l'écran se ferme (croix,
  // récap, retour matériel) alors qu'un replay tourne, et des minuteries orphelines
  // réveillaient encore des setState plusieurs secondes plus tard. Au démontage on
  // purge les minuteries ET on débloque les `attendre` en attente, pour que la boucle
  // de replay se DÉROULE jusqu'au bout : c'est elle qui appelle `finaliser`, donc c'est
  // elle qui crédite le combat — jamais un timer.
  const minuteries = useRef(new Set<ReturnType<typeof setTimeout>>()).current;
  const attentes = useRef(new Set<() => void>()).current;
  const demonteRef = useRef(false);
  const programmer = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      minuteries.delete(id);
      if (!demonteRef.current) fn();
    }, ms);
    minuteries.add(id);
  };
  const attendre = (ms: number) =>
    new Promise<void>((r) => {
      if (demonteRef.current) { r(); return; }
      const resoudre = () => { attentes.delete(resoudre); r(); };
      attentes.add(resoudre);
      programmer(resoudre, Math.round(ms / vitesseRef.current));
    });
  useEffect(() => () => {
    demonteRef.current = true;
    for (const id of minuteries) clearTimeout(id);
    minuteries.clear();
    for (const resoudre of [...attentes]) resoudre(); // le replay finit sans attendre
    attentes.clear();
  }, [minuteries, attentes]);

  // ⭐ Cinématique de Signature (respecte ×1/×2 via attendre, skippable au tap). Une
  // seule par déclenchement ; la promesse se résout à la fin ou au tap.
  const presenterCine = (c: { set: SetId; adverse: boolean; nom: string }) =>
    new Promise<void>((resolve) => {
      let clos = false;
      const fin = () => {
        if (clos) return;
        clos = true;
        cineSkipRef.current = null;
        setCine(null);
        resolve();
      };
      cineSkipRef.current = fin;
      setCine({ ...c, cle: Date.now() });
      void attendre(DUREE_CINE_MS).then(fin);
    });

  // 🏅 PALMARÈS : les exploits du round sont agrégés en mémoire puis persistés
  // EN UNE écriture (flush après chaque replay — jamais une écriture par impact).
  const exploitsPendus = useRef(new Map<string, ExploitsCarte>());
  const noterExploit = (carteId: string, patch: Partial<ExploitsCarte>) => {
    const p = exploitsPendus.current;
    const cur = p.get(carteId) ?? { ko: 0, victoires: 0, parfaits: 0, plusGrosCoup: 0 };
    p.set(carteId, {
      ko: cur.ko + (patch.ko ?? 0),
      victoires: cur.victoires + (patch.victoires ?? 0),
      parfaits: cur.parfaits + (patch.parfaits ?? 0),
      plusGrosCoup: Math.max(cur.plusGrosCoup, patch.plusGrosCoup ?? 0),
    });
  };
  const flusherExploits = () => {
    const p = exploitsPendus.current;
    if (p.size === 0) return;
    exploitsPendus.current = new Map();
    crediterExploits([...p.entries()]);
  };
  // Carte SOURCE d'un dégât subi par le camp b : l'actif du joueur au moment du
  // replay (attaque, spé, signature, riposte, éclaboussure Pétillant, épines…).
  const carteSource = () => combat.equipes.a[afficheRef.current.actifs.a];

  const majPv = (cote: CoteCombat, index: number, pvApres: number) =>
    setAffiche((prev) => {
      const pv = { ...prev.pv, [cote]: [...prev.pv[cote]] };
      pv[cote][index] = pvApres;
      return { ...prev, pv };
    });
  const majActif = (cote: CoteCombat, index: number) =>
    setAffiche((prev) => ({ ...prev, actifs: { ...prev.actifs, [cote]: index } }));
  const synchroniser = () =>
    setAffiche({
      actifs: { ...combat.actifs },
      pv: { a: combat.equipes.a.map((c) => c.pv), b: combat.equipes.b.map((c) => c.pv) },
      // ⚡ B5 — réserve et combo viennent du MOTEUR (`etat.energie`, `etat.combo`) :
      // l'écran n'en tient plus de copie et n'en calcule plus l'évolution.
      energie: { ...combat.energie },
      combo: combat.combo,
    });

  // nouveau combat quand les paramètres changent (étape suivante du tournoi…)
  const premierRendu = useRef(true);
  useEffect(() => {
    if (premierRendu.current) { premierRendu.current = false; return; }
    combatRef.current = nouveauCombat();
    releverMunitions(combatRef.current); // 🔋 nouvelle dotation = nouveau total de pastilles
    crediteRef.current = false;
    engageRef.current = false; // 🩹 26/07 — l'engagement appartient au combat écoulé
    setConfirmerAbandon(false);
    exploitsPendus.current = new Map(); // 🏅 les exploits appartiennent au combat écoulé
    setRecap(null);
    majEnCours(false);
    setFlottant(null);
    setPrefixe(null); // 🔄🎒 un préfixe armé appartient au combat écoulé
    setTimingDemande(null);
    setKoFlash(null);
    setCine(null);
    setVol(null); // 🎬 les effets d'attaque appartiennent au combat écoulé
    setSoiFx(null);
    setEtoile(null);
    attaqueEnVol.current = null;
    setJournal([`${adversaire.nom} veut se battre !`]);
    synchroniser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adversaire]);

  const secousses = useRef({ a: new Animated.Value(0), b: new Animated.Value(0) }).current;
  // 🥊 élan d'attaque : la carte bondit vers l'adversaire au moment de l'annonce
  const elans = useRef({ a: new Animated.Value(0), b: new Animated.Value(0) }).current;
  // 🤜 assaut de MÊLÉE : pas de projectile, la carte FONCE vers l'adversaire
  const assauts = useRef({ a: new Animated.Value(0), b: new Animated.Value(0) }).current;
  // 🥞 squash cartoon de la carte qui encaisse (aplatie puis rebond)
  const squashs = useRef({ a: new Animated.Value(0), b: new Animated.Value(0) }).current;
  // ⚡ flash blanc bref sur la carte touchée
  const flashs = useRef({ a: new Animated.Value(0), b: new Animated.Value(0) }).current;

  const elancer = (cote: CoteCombat) => {
    Animated.sequence([
      Animated.timing(elans[cote], { toValue: 1, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(elans[cote], { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };

  const pousserJournal = (t: string) => setJournal((j) => [t, ...j].slice(0, 2));

  const secouer = (cote: CoteCombat) => {
    Animated.sequence([
      Animated.timing(secousses[cote], { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(secousses[cote], { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(secousses[cote], { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(secousses[cote], { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  // 🤜 assaut de mêlée : fonce d'un coup, marque le contact, revient (natif)
  const assauter = (cote: CoteCombat) => {
    Animated.sequence([
      Animated.timing(assauts[cote], { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(70),
      Animated.timing(assauts[cote], { toValue: 0, duration: 230, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };

  // 🥞 squash à l'impact : la carte s'aplatit (0,85) puis rebond (back = dépassement)
  const squasher = (cote: CoteCombat) => {
    Animated.sequence([
      Animated.timing(squashs[cote], { toValue: 1, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(squashs[cote], { toValue: 0, duration: 300, easing: Easing.out(Easing.back(2.2)), useNativeDriver: true }),
    ]).start();
  };

  // ⚡ flash blanc bref sur la carte touchée (setValue instantané → fondu)
  const flasher = (cote: CoteCombat) => {
    flashs[cote].setValue(0.55);
    Animated.timing(flashs[cote], { toValue: 0, duration: 210, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };

  const finaliser = useCallback((vainqueur: CoteCombat) => {
    if (crediteRef.current) return;
    crediteRef.current = true;
    const gagne = vainqueur === 'a';
    // 🏅 victoire joueur : +1 victoire aux 3 membres de l'équipe (tous modes).
    // Via combatRef (le useCallback survivrait à un combat remplacé).
    if (gagne) for (const c of combatRef.current?.equipes.a ?? []) noterExploit(c.id, { victoires: 1 });
    if (mode === 'pnj') {
      if (gagne) {
        const r = victoireArene(rang);
        setRecap({ type: 'pnj', gagne, perles: r.perles, capsule: r.capsule, rang, pc: r.pc, serie: r.serie, multSerie: r.multSerie });
      } else {
        const r = defaiteArene();
        setRecap({ type: 'pnj', gagne, perles: r.perles, capsule: null, rang, pc: r.pc, serie: 0, multSerie: 1 });
      }
    } else if (mode === 'boss') {
      const rounds = combatRef.current?.round ?? 0;
      if (revanche) {
        // ⚠️ REVANCHE — AUCUN appel de crédit, dans AUCUNE issue. Pas de `victoireBoss`
        // (même « à vide »), pas de `victoireArene`, pas de PC, pas d'XP de Pass.
        // Le seul état persisté qui bouge est le palmarès des cartes (`noterExploit`,
        // au-dessus), qui n'est ni une perle ni un prix réel : c'est le tableau de chasse.
        setRecap({ type: 'boss', gagne, perles: 0, capsules: 0, eclats: 0, deja: true, revanche, rounds });
      } else if (gagne) {
        const r = victoireBoss();
        setRecap({ type: 'boss', gagne, perles: r.perles, capsules: r.capsules, eclats: r.eclats, deja: r.deja, revanche: 0, rounds });
      } else {
        setRecap({ type: 'boss', gagne, perles: 0, capsules: 0, eclats: 0, deja: false, revanche: 0, rounds });
      }
    } else if (mode === 'tournoi') {
      if (gagne) {
        const r = victoireTournoi(etape);
        setRecap({ type: 'tournoi', gagne, perles: r.perles, capsule: r.capsule, etape, champion: r.champion });
      } else {
        const r = defaiteTournoi();
        setRecap({ type: 'tournoi', gagne, perles: r.perles, capsule: null, etape, champion: false });
      }
    } else if (mode === 'tournee') {
      if (gagne) {
        // PV absolus de fin de combat → PV reportés pour le duel suivant (0 = K.O.)
        const pvRestants: Record<string, number> = {};
        for (const c of combatRef.current?.equipes.a ?? []) pvRestants[c.id] = Math.max(0, c.pv);
        const r = victoireTourneeDuel(pvRestants);
        setRecap({
          type: 'tournee', gagne, perles: r?.perles ?? 0, etape: duelNum,
          score: r?.score ?? 0, record: r?.record ?? 0, nouveau: r?.nouveau ?? false,
        });
      } else {
        const r = defaiteTourneeDuel();
        setRecap({ type: 'tournee', gagne, perles: 0, etape: duelNum, score: r.score, record: r.record, nouveau: r.nouveau });
      }
    } else if (mode === 'defi') {
      const r = resoudreDefiAmi(amiNom, gagne);
      setRecap({ type: 'defi', gagne, ami: amiNom, perles: r.perles });
    } else if (amical) {
      setRecap({ type: 'ami', gagne, amical: true });
    } else {
      // 🔒 Le store RE-VALIDE le gain (contre l'équipe de Sam du jour) et renvoie l'id
      // réellement crédité : le récap affiche CE QUE LE STORE A VALIDÉ, jamais l'id d'URL —
      // un `gain=` forgé par deep-link est ainsi corrigé à l'écran comme au crédit.
      const { nouveau, gainId: gagneId } = resoudreDuelAmi(gagne, miseId, gainId);
      setRecap({ type: 'ami', gagne, amical: false, miseId, gainId: gagneId ?? gainId, nouveau });
    }
  }, [mode, rang, etape, duelNum, amical, miseId, gainId, amiNom, revanche]);

  // `opts.objetJoue` : un consommable a été joué EN PRÉFIXE de ce round. Ses dégâts
  // directs (Bonbon Piquant) ne sont pas un fait d'armes de la carte → le palmarès ne
  // s'ouvre qu'à partir de l'annonce d'action du camp a (attaque, spé, Signature) ou
  // d'une riposte, qui suivent toujours le préfixe dans le flux d'événements.
  const rejouerEvts = async (evts: EvtCombat[], opts?: { objetJoue?: ConsommableId | null }) => {
    let critFlag = false;
    let crediterB = !opts?.objetJoue;
    for (const evt of evts) {
      switch (evt.t) {
        case 'annonce': {
          elancer(evt.cote); // 🥊 la carte bondit vers l'adversaire
          const combattant = combat.equipes[evt.cote][afficheRef.current.actifs[evt.cote]];
          // Attente par défaut ; relevée à la durée de l'effet s'il y en a un (voir plus bas).
          let attenteAnnonce: number = ATTENTE.annonce;
          // 🔑 B4 — l'annonce se lit par son DISCRIMINANT, plus par son texte français.
          const annonce: AnnonceMotorisee = evt;
          // ⭐ SIGNATURE : la cinématique plein écran. Le nom vient de `signatureDe()` :
          // il y a 24 signatures DISTINCTES (une par carte). Lire `SIGNATURES[set]`
          // annoncerait l'ulti du SET alors que le moteur a joué celui de la CARTE —
          // la cinématique mentirait.
          if (combattant && annonce.cle === 'signature') {
            attaqueEnVol.current = null; // l'ulti a déjà SA cinématique : burst standard
            crediterB = true;
            vibrationArmee.current = 'lourd'; // 📳 une seule vibration, à l'impact
            pousserJournal(evt.texte);
            await presenterCine({
              set: combattant.set, adverse: evt.cote === 'b', nom: signatureDe(combattant).nom,
            });
            await attendre(ATTENTE.annonceSignature - DUREE_CINE_MS);
            break;
          }
          // 🎬 PACK 3 — on VOIT l'attaque. L'index vient du MOTEUR (`attaqueIdx`), qui
          // seul sait laquelle des deux il a jouée : le repli automatique de la Spé sur
          // l'attaque de base (munitions ou ⚡ manquantes) est décidé DANS `resoudreAction`,
          // l'écran ne peut pas le deviner. Le vol se déroule PENDANT la lecture de
          // l'annonce : l'impact (squash/flash/burst) arrive avec « degats » juste après.
          // Les annonces `objet` / `garde` / `changement` ne portent aucun projectile —
          // et une annonce SANS `cle` (moteur d'une version antérieure) non plus :
          // mieux vaut une annonce sobre qu'un projectile qui ment.
          const att = combattant && annonce.cle === 'attaque' && annonce.attaqueIdx !== undefined
            ? combattant.attaques[annonce.attaqueIdx] ?? null
            : null;
          attaqueEnVol.current = att;
          if (att) {
            vibrationArmee.current = 'normal'; // 📳 armée ici, tirée au PREMIER impact
            if (evt.cote === 'a') crediterB = true; // 🏅 la carte agit : le palmarès s'ouvre
            const visuel = visuelAttaque(att.nom, att.type);
            if (visuel.famille === 'melee') {
              assauter(evt.cote); // 🤜 pas de projectile : la carte FONCE au contact
            } else if (visuel.famille === 'soin' || visuel.famille === 'boost' || visuel.famille === 'bouclier') {
              setSoiFx({ cle: Date.now(), cote: evt.cote, famille: visuel.famille, couleur: visuel.couleur });
              attenteAnnonce = DUREE_SOI_MS;
            } else {
              setVol({ cle: Date.now(), cote: evt.cote, visuel });
              attenteAnnonce = DUREE_VOL_MS;
            }
          }
          pousserJournal(evt.texte);
          // 🎬 On attend que l'effet AIT FINI avant de laisser passer l'impact : sinon
          // les dégâts s'affichent pendant que le projectile est encore en l'air, et
          // l'attaque se lit comme si elle n'avait aucune animation. L'attente est LUE
          // sur la durée réelle de l'effet, jamais redevinée — c'est ce couplage qui
          // avait été rompu le 27/07 en raccourcissant le rythme.
          await attendre(attenteAnnonce);
          break;
        }
        case 'degats': {
          majPv(evt.cote, evt.index, evt.pvApres); // → la barre GLISSE vers la nouvelle valeur
          // 🏅 plus gros coup de la carte source (impact unique, y compris zone/banc)
          if (evt.cote === 'b' && crediterB) {
            const src = carteSource();
            if (src) noterExploit(src.id, { plusGrosCoup: evt.valeur });
          }
          const surActif = evt.index === afficheRef.current.actifs[evt.cote];
          if (surActif) {
            secouer(evt.cote);
            squasher(evt.cote); // 🥞 la carte encaisse : aplatie puis rebond
            flasher(evt.cote);  // ⚡ flash blanc bref
            // 📳 UNE vibration par attaque (retour de Yoann du 27/07). Elle est armée
            // par l'annonce et tirée au PREMIER impact de l'attaque : une vague de zone
            // qui touche trois cartes ne vibre donc qu'une fois, pas trois.
            if (vibrationArmee.current) {
              if (vibrationArmee.current === 'lourd') hapticLourd();
              else if (critFlag) hapticMoyen();
              else hapticLeger();
              vibrationArmee.current = null;
            }
            // 🎬 burst aux COULEURS de l'attaque qui vient de toucher (rose sinon)
            const visuelImpact = attaqueEnVol.current
              ? visuelAttaque(attaqueEnVol.current.nom, attaqueEnVol.current.type)
              : null;
            setBurst({ cote: evt.cote, crit: critFlag, cle: Date.now(), couleur: visuelImpact?.couleur }); // 💥 burst Skia
            setFlottant({ cote: evt.cote, txt: `−${evt.valeur}`, couleur: C.danger, cle: Date.now() });
            // ⭐ mêlée : étoile de contact sur la cible (le coup « au corps à corps »)
            if (visuelImpact?.famille === 'melee') {
              setEtoile({ cle: Date.now(), cote: evt.cote, couleur: visuelImpact.couleur });
            }
          } else {
            // dégâts de ZONE sur le banc : visible au journal + points d'équipe
            const nom = combat.equipes[evt.cote][evt.index]?.nom ?? '';
            pousserJournal(`${nom} (banc) encaisse −${evt.valeur} !`);
          }
          critFlag = false;
          const eff = evt.efficace === 1.5 ? ' C\'est super efficace !' : evt.efficace === 0.75 ? ' Pas très efficace…' : '';
          if (eff && surActif) pousserJournal(eff.trim());
          await attendre(surActif ? ATTENTE.degatsActif : ATTENTE.degatsBanc);
          setFlottant(null);
          break;
        }
        case 'soin':
          majPv(evt.cote, evt.index, evt.pvApres);
          if (evt.index === afficheRef.current.actifs[evt.cote]) {
            setFlottant({ cote: evt.cote, txt: `+${evt.valeur}`, couleur: C.vertFonce, cle: Date.now() });
          }
          await attendre(ATTENTE.soin);
          setFlottant(null);
          break;
        case 'statut': {
          // 🔑 B4 — piloté par `evt.cle` (discriminant stable du moteur), plus jamais
          // par le texte français. Une clé inconnue de la table dégrade proprement :
          // le journal l'affiche, aucune réaction physique, aucun crash.
          const reaction = (evt.cle && REACTIONS_STATUT[evt.cle]) || undefined;
          if (reaction?.crit) critFlag = true; // le prochain impact est un CRITIQUE
          pousserJournal(evt.texte);
          await attendre(ATTENTE.statut);
          break;
        }
        case 'riposte':
          // 🔄 RIPOSTE de parade parfaite : le burst Skia suit sur l'impact (evt degats)
          attaqueEnVol.current = null; // pas d'attaque nommée → burst standard
          if (evt.cote === 'a') crediterB = true; // 🏅 la riposte EST un fait d'armes
          elancer(evt.cote);
          if (evt.antiSignature) hapticLourd(); else hapticMoyen();
          pousserJournal(evt.antiSignature ? 'RIPOSTE HÉROÏQUE ! ⚡' : 'RIPOSTE ! ⚡');
          await attendre(ATTENTE.riposte);
          break;
        case 'ko': {
          hapticLourd();
          secouer(evt.cote);
          // 🏅 K.O. adverse : +1 à la carte source (attaque, riposte, éclaboussure…)
          if (evt.cote === 'b' && crediterB) {
            const src = carteSource();
            if (src) noterExploit(src.id, { ko: 1 });
          }
          // 💥 K.O. adverse = cinématique plein écran (flash + gros texte)
          if (evt.cote === 'b') {
            const cle = Date.now();
            setKoFlash({ nom: evt.nom, cle });
            programmer(() => setKoFlash((k) => (k?.cle === cle ? null : k)),
              Math.round(DUREE_KO_MS / vitesseRef.current) + 40);
          }
          pousserJournal(`${evt.nom} est K.O. ! 💥`);
          await attendre(evt.cote === 'b' ? ATTENTE.koAdverse : ATTENTE.koAllie);
          break;
        }
        case 'entree':
          pousserJournal(`${evt.nom} entre en piste !`);
          majActif(evt.cote, evt.index); // → la carte bascule au bon MOMENT du replay
          await attendre(ATTENTE.entree);
          break;
        case 'fin':
          if (evt.vainqueur === 'a') hapticSucces(); else hapticLourd();
          pousserJournal(evt.vainqueur === 'a' ? 'VICTOIRE ! 🎉' : 'Défaite… 😵‍💫');
          await attendre(ATTENTE.fin);
          finaliser(evt.vainqueur);
          break;
      }
    }
    flusherExploits(); // 🏅 une seule écriture persistée par round
  };

  // --- 🎛️ ÉTAT DÉRIVÉ DE LA BARRE D'ACTION ----------------------------------------------
  // Tout l'affichage suit l'état REJOUÉ (`affiche`), pas l'état final du moteur.
  const moi = combat.equipes.a[affiche.actifs.a];
  const lui = combat.equipes.b[affiche.actifs.b];
  // 🔄 La carte qui JOUERA l'action de ce tour : l'entrante dès qu'un changement est
  // armé. Sans ça la barre proposerait le kit de la carte SORTANTE alors que le moteur
  // résout `puis` avec celui de l'entrante — on mentirait au joueur sur son propre coup.
  const carteQuiJoue = prefixe?.k === 'changer' ? (combat.equipes.a[prefixe.index] ?? moi) : moi;
  const idxQuiJoue = prefixe?.k === 'changer' ? prefixe.index : affiche.actifs.a;
  const avantage = multType(carteQuiJoue.set, lui.set);
  const bancActif = combat.equipes.a.some((c, i) => i !== affiche.actifs.a && c.pv > 0) && !combat.fini;
  const sacDispo = !combat.fini; // 🎒 toujours visible (état vide = découvre la fonctionnalité)
  const sacObjets = CONSOMMABLE_IDS.filter((id) => (jeu.consommables[id] ?? 0) > 0);

  // --- ⚡ B2 · ÉNERGIE D'ÉQUIPE -----------------------------------------------------------
  // Réserve dont le camp disposera AU MOMENT D'AGIR : le moteur crédite le revenu de
  // round (ENERGIE_PAR_ROUND) en TÊTE de `jouerRound`, AVANT tout débit. N'afficher que
  // la réserve courante griserait des actions que le moteur ACCEPTE — dès le round 1
  // (2 en caisse + 2 de revenu → la Spé à 3⚡ est payable, c'est le choix d'ouverture
  // voulu par §A2). On appelle DIRECTEMENT le helper du moteur, celui-là même qui sert à
  // verrouiller l'intention de l'IA : redériver la formule ici serait une logique
  // parallèle, et le jour où le revenu de round change, l'écran mentirait.
  const energieAuTour = energiePrevue(combat, 'a');
  const coutPrefixe = prefixe ? (prefixe.k === 'changer' ? COUT_CHANGER : COUT_OBJET) : 0;
  const energieDispo = Math.max(0, energieAuTour - coutPrefixe);

  const sigPrete = carteQuiJoue.charge >= CHARGE_MAX;
  const sig = signatureDe(carteQuiJoue); // ⭐ 24 signatures distinctes, une par carte
  const spePayable = energieDispo >= COUT_SPE;
  // 🛡️ Le moteur décrémente le cooldown de Garde de l'actif EN TÊTE de round (donc de
  // la carte SORTANTE), puis teste le cooldown BRUT de l'entrante si un changement a
  // été joué. D'où deux seuils — sans quoi la Garde d'une entrante se replierait
  // silencieusement sur l'attaque de base.
  const gardeDecompte = prefixe?.k === 'changer' ? 0 : 1;
  const gardeDispo = carteQuiJoue.gardeCooldown <= gardeDecompte;
  const gardeRestante = Math.max(0, carteQuiJoue.gardeCooldown - gardeDecompte);
  // 🎖️ talent « Garde maîtrisée » : le label reflète la réduction réelle (−55 %)
  const gardeReduction = carteQuiJoue.talents?.includes('garde_maitrisee') ? GARDE_MAITRISEE : GARDE_REDUCTION;
  // 🏷️ A3 — les TRAITS donnent 24 identités là où les 24 cartes avaient la même attaque.
  // L'aide vient du MOTEUR (`HINT_TRAIT`) : l'écran n'écrit aucun libellé de règle.
  const hintTraits = (a: Attaque) => (a.traits ?? []).map((t) => HINT_TRAIT[t]).join(' · ');
  // 🔋 Dotation de Spé de CETTE carte (cf. `munitionsMax`). Le `max` avec la valeur
  // courante est un garde-fou d'affichage : si le moteur venait un jour à RENDRE une
  // munition en cours de combat, le total suivrait au lieu d'afficher des pastilles
  // négatives. Aucune règle n'est recalculée ici.
  const munitionsDe = (c: Combattant) => Math.max(munitionsMax.current[c.id] ?? 0, c.speRestantes);
  const intention = decrireIntention(combat);
  const fondIntention = intention.ton === 'danger' ? C.dangerPale
    : intention.ton === 'soin' ? C.vertPale
      : intention.ton === 'defense' ? '#E9E2F7' : '#FFF3D6';

  // --- ▶️ RÉSOLUTION D'UN ROUND — point d'entrée UNIQUE -----------------------------------
  // UN SEUL `jouerRound` par round, préfixe COMPRIS (§B2). L'écran n'y décide rien : il
  // assemble l'`ActionJoueur` et laisse le moteur payer l'énergie, arbitrer les replis
  // et faire évoluer le combo (§B5).
  const lancerRound = async (action: 0 | 1 | 'signature' | 'garde', t?: Timing) => {
    if (enCoursRef.current || combat.fini) return;
    majEnCours(true);
    const pref = prefixeRef.current;
    setPrefixe(null);

    let choix: ActionJoueur = action;
    let objetJoue: ConsommableId | null = null;
    // 🏅 la carte qui AGIT est l'entrante quand un changement est armé : c'est elle
    // qui jouera l'action (le moteur bascule l'actif avant de résoudre `puis`).
    let carteQuiAgit = combat.equipes.a[combat.actifs.a];
    if (pref?.k === 'changer') {
      choix = { changer: pref.index, puis: action };
      carteQuiAgit = combat.equipes.a[pref.index] ?? carteQuiAgit;
    } else if (pref?.k === 'objet') {
      // 🎒 le sac n'est débité qu'ICI : tant que le joueur n'a pas choisi son action,
      // il peut désarmer le préfixe sans rien perdre.
      if (utiliserConsommable(pref.id)) {
        choix = { objet: pref.id, puis: action };
        objetJoue = pref.id;
        attaqueEnVol.current = null; // dégâts d'objet (Bonbon Piquant) : burst standard
      }
    }

    // 🏅 timing PARFAIT réussi → +1 « parfait » à la carte qui agit RÉELLEMENT
    // (une carte étourdie passe son tour — sauf la Garde, toujours engagée).
    const actionEngagee = !aStatut(carteQuiAgit, 'etourdi') || action === 'garde';
    engageRef.current = true; // 🩹 26/07 — round réellement joué : sortir vaut désormais défaite
    // ⚡ B5 — `comboA` n'est PLUS passé : `etat.combo` (rapatrié dans le moteur) fait foi.
    const evts = jouerRound(combat, choix, Math.random, undefined, t);
    if (t === 'parfait' && actionEngagee) noterExploit(carteQuiAgit.id, { parfaits: 1 });
    await rejouerEvts(evts, { objetJoue });
    synchroniser(); // filet de sécurité : affichage = état exact du moteur
    majEnCours(false);
  };

  // 🎯 La JAUGE DE TIMING n'est plus systématique (§B2) : le moteur ne lit `timing` que
  // pour les actions qui frappent ou qui soignent. Un `bouclier` / `boost` se résout
  // DIRECTEMENT — le joueur ne fait plus un QTE pour rien.
  const attaquer = (choix: 0 | 1 | 'signature') => {
    if (enCoursRef.current || combat.fini || timingDemande !== null) return;
    if (choix !== 'signature' && !TIMING_UTILE[carteQuiJoue.attaques[choix].type]) {
      void lancerRound(choix);
      return;
    }
    setTimingDemande(choix);
  };

  const garder = () => {
    if (enCoursRef.current || combat.fini || timingDemande !== null) return;
    setTimingDemande('garde'); // la parade PARFAITE dépend du tap : jauge obligatoire
  };

  const resoudreTiming = async (t: Timing) => {
    const action = timingDemande;
    setTimingDemande(null);
    if (action === null || enCoursRef.current || combat.fini) return;
    const cle = Date.now();
    setVerdictTiming({ t, cle });
    programmer(() => setVerdictTiming((v) => (v?.cle === cle ? null : v)), 950);
    // Seul le tap PARFAIT est récompensé : faire vibrer aussi le « bien » revenait à
    // vibrer à presque chaque tour, ce qui vide la récompense de son sens.
    if (t === 'parfait') void hapticSucces();
    await lancerRound(action, t);
  };

  // 🔄 B2 — ARME un changement : le banc redevient jouable SANS payer le tour.
  // Retaper la même carte désarme (rien n'a encore été joué, rien n'a été débité).
  const armerChangement = (index: number) => {
    if (enCoursRef.current || combat.fini || timingDemande !== null) return;
    setPrefixe((p) => (p?.k === 'changer' && p.index === index ? null : { k: 'changer', index }));
    hapticLeger();
  };

  // 🎒 B2 — ARME un consommable : même principe, l'action du tour reste jouable.
  const armerObjet = (id: ConsommableId) => {
    if (enCoursRef.current || combat.fini || timingDemande !== null) return;
    setSacVisible(false);
    setPrefixe((p) => (p?.k === 'objet' && p.id === id ? null : { k: 'objet', id }));
    hapticLeger();
  };

  const desarmerPrefixe = () => setPrefixe(null);

  // 🩹 26/07 — Un combat est ABANDONNABLE (= sortir vaut défaite) s'il est à enjeu,
  // engagé, et pas déjà résolu. Un duel `amical` contre Sam ne coûte rien, et un
  // combat où AUCUN round n'a été joué (écran ouvert puis refermé) reste gratuit.
  // 🗺️ Rappel : tuer l'app laisse la run de Tournée intacte (le duel se rejoue avec
  // les PV d'avant-combat) — seule la sortie volontaire est pénalisée.
  // Lu via les REFS (jamais une valeur figée dans une closure de rendu antérieur).
  // 👹 Une REVANCHE n'a AUCUN enjeu au sens comptable : elle ne verse rien et ne retire
  // rien, donc en sortir ne peut rien coûter. La traiter comme un combat à enjeu aurait
  // affiché une confirmation d'abandon mensongère (« le boss de la semaine reste à
  // battre » — alors qu'il est déjà vaincu).
  const aEnjeu = !(mode === 'ami' && amical) && !revanche;
  const sortieVautDefaite = () => aEnjeu && engageRef.current && !combat.fini && !crediteRef.current;
  const abandonPenalise = sortieVautDefaite(); // pour l'affichage (libellés, a11y)

  // Résout le combat exactement comme une défaite : `finaliser('b')` branche déjà
  // chaque mode (defaiteArene, defaiteTournoi, defaiteTourneeDuel, resoudreDefiAmi,
  // resoudreDuelAmi, et le boss qui ne débite rien) et pose son propre garde-fou
  // `crediteRef`. Une seule vérité de résolution, aucun mode oublié.
  // Le récap de DÉFAITE s'affiche ensuite normalement, avec son bouton « Retour … » :
  // le joueur voit ce que l'abandon lui a coûté, exactement comme s'il avait perdu —
  // et on évite de superposer une navigation à l'ouverture du récap.
  const abandonner = () => {
    setConfirmerAbandon(false);
    if (sortieVautDefaite()) { finaliser('b'); return; }
    router.back();
  };

  const quitter = () => {
    // 🩹 26/07 — jamais de défaite sur un tap accidentel : la croix DEMANDE d'abord.
    if (sortieVautDefaite()) { setConfirmerAbandon(true); return; }
    router.back();
  };

  // 🩹 26/07 — ce que l'abandon coûte VRAIMENT, mode par mode : le joueur décide en
  // connaissance de cause. Texte dérivé des constantes, jamais de valeur en dur.
  const coutAbandon = mode === 'pnj'
    ? `Compté comme une défaite d'Arène : ${PC_DEFAITE} PC de classement et ta série de victoires repart de zéro.`
    : mode === 'tournoi'
      ? `Compté comme une défaite : tu es éliminé du tournoi de la semaine (retente possible pour ${formatNb(TOURNOI_RETENTE_PERLES)} perles).`
      : mode === 'tournee'
        ? 'Compté comme une défaite : la run de Tournée s\'arrête ici.'
        : mode === 'boss'
          ? 'Compté comme une défaite : le boss de la semaine reste à battre.' // (jamais atteint en revanche : `aEnjeu` la neutralise)
          : mode === 'defi'
            ? `Compté comme une défaite : le défi de ${amiNom} est perdu pour aujourd'hui.`
            : miseId
              ? `Compté comme une défaite : Sam emporte ton doublon ${trouverCollectible(miseId)?.nom ?? ''}.`
              : 'Compté comme une défaite.';

  return (
    <View style={[styles.fond, { paddingTop: insets.top + 8 }]}>
      {/* header */}
      <View style={styles.hud}>
        <Pressable
          style={styles.fermer}
          onPress={quitter}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={abandonPenalise ? 'Abandonner le combat' : 'Quitter le combat'}
          accessibilityHint={abandonPenalise ? 'Une confirmation te sera demandée : abandonner compte comme une défaite.' : undefined}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Line x1={6} y1={6} x2={18} y2={18} stroke={C.violetProfond} strokeWidth={2.6} strokeLinecap="round" />
            <Line x1={18} y1={6} x2={6} y2={18} stroke={C.violetProfond} strokeWidth={2.6} strokeLinecap="round" />
          </Svg>
        </Pressable>
        <Text style={styles.titre} numberOfLines={1}>{adversaire.nom}</Text>
        <Pressable style={styles.vitesseBtn} disabled={enCours} onPress={() => setVitesse((v) => v === 1 ? 2 : 1)}>
          <Text style={styles.vitesseTxt}>×{vitesse}</Text>
        </Pressable>
      </View>

      {mutateur && (
        <View style={styles.mutateurBanniere}>
          <View style={styles.mutateurRang}>
            <Icone nom="eclair" taille={14} />
            <IconeEmoji emoji={mutateur.emoji} taille={15} />
            <Text style={[styles.mutateurTxt, { flexShrink: 1 }]} numberOfLines={2}>{mutateur.nom} — {mutateur.desc}</Text>
          </View>
        </View>
      )}

      {!combat.fini && (
        <View style={[styles.intention, { backgroundColor: fondIntention }]}>
          <View style={styles.intentionHaut}>
            <Text style={styles.intentionLabel}>PROCHAINE ACTION ADVERSE</Text>
            <View style={styles.intentionHautDroite}>
              {/* ⚡ la réserve adverse se LIT : l'IA paie exactement comme le joueur,
                  donc on peut anticiper sa spé (3⚡) ou son changement (2⚡). */}
              <Text style={styles.energieAdverse}>⚡ {affiche.energie.b}</Text>
              {lui.gimmick && <Text style={styles.phaseBoss}>PHASE {lui.bossPhase}</Text>}
            </View>
          </View>
          <Text style={styles.intentionTitre} numberOfLines={1}>{intention.titre}</Text>
          <Text style={styles.intentionDetail} numberOfLines={2}>{intention.detail}</Text>
        </View>
      )}

      <View
        style={styles.zone}
        onLayout={(e) => {
          // 📐 mesure UNE fois (rotation incluse) : les projectiles se positionnent
          // en fractions de la zone — zéro re-render en dehors d'un vrai changement.
          const { width, height } = e.nativeEvent.layout;
          setZoneDims((d) => (Math.abs(d.l - width) > 1 || Math.abs(d.h - height) > 1 ? { l: width, h: height } : d));
        }}
      >
        {/* === Adversaire === */}
        <CarteCombattant
          key={`b-${affiche.actifs.b}`}
          cote="b" equipe={combat.equipes.b} actifIdx={affiche.actifs.b}
          pvAffiches={affiche.pv.b} secousse={secousses.b} elan={elans.b} flottant={flottant}
          assaut={assauts.b} squash={squashs.b} flash={flashs.b}
          burst={burst?.cote === 'b' ? burst : null} inverse
        />

        {/* === Journal + avantage === */}
        <View style={styles.centre}>
          {avantage !== 1 && !combat.fini && (
            <View style={[styles.avantage, { backgroundColor: avantage === 1.5 ? C.vertPale : C.dangerPale }]}>
              {avantage === 1.5 ? (
                <View style={styles.avantageRow}>
                  <Text style={[styles.avantageTxt, { color: C.vertFonce }]}>Avantage ×1,5 :</Text>
                  <IconeType set={carteQuiJoue.set} taille={18} />
                  <Text style={[styles.avantageTxt, { color: C.vertFonce }]}>bat</Text>
                  <IconeType set={lui.set} taille={18} />
                </View>
              ) : (
                <Text style={[styles.avantageTxt, { color: C.danger }]}>Désavantage de type ×0,75</Text>
              )}
            </View>
          )}
          {verdictTiming && (
            <Text key={verdictTiming.cle} style={[styles.verdict, {
              color: verdictTiming.t === 'parfait' ? '#E8930C' : verdictTiming.t === 'bien' ? C.vertFonce : C.texte3,
            }]}>
              {verdictTiming.t === 'parfait' ? '✨ PARFAIT !' : verdictTiming.t === 'bien' ? 'Bien !' : 'Raté…'}
            </Text>
          )}
          {journal.map((t, i) => (
            <Text key={`${t}-${i}`} style={[styles.journal, i > 0 && { opacity: 0.45, fontSize: 12.5 }]}>{t}</Text>
          ))}
        </View>

        {/* === Moi === */}
        <CarteCombattant
          key={`a-${affiche.actifs.a}`}
          cote="a" equipe={combat.equipes.a} actifIdx={affiche.actifs.a}
          pvAffiches={affiche.pv.a} secousse={secousses.a} elan={elans.a} flottant={flottant}
          assaut={assauts.a} squash={squashs.a} flash={flashs.a}
          burst={burst?.cote === 'a' ? burst : null}
        />

        {/* === 🎬 PACK 3 — overlay des attaques (pointerEvents none, au-dessus
            des cartes ; le chiffre de dégâts reste dans la carte, lisible) === */}
        {zoneDims.l > 0 && (vol || soiFx || etoile) && (
          <View pointerEvents="none" style={styles.volOverlay}>
            {vol && (
              <VolAttaque
                key={vol.cle}
                cote={vol.cote}
                visuel={vol.visuel}
                largeur={zoneDims.l}
                hauteur={zoneDims.h}
                duree={Math.round(DUREE_VOL_MS / vitesseRef.current)}
                onTermine={() => setVol((v) => (v?.cle === vol.cle ? null : v))}
              />
            )}
            {soiFx && (
              <EffetSoi
                key={soiFx.cle}
                famille={soiFx.famille}
                position={positionCarte(soiFx.cote, zoneDims.l, zoneDims.h)}
                couleur={soiFx.couleur}
                duree={Math.round(DUREE_SOI_MS / vitesseRef.current)}
                onTermine={() => setSoiFx((s) => (s?.cle === soiFx.cle ? null : s))}
              />
            )}
            {etoile && (
              <EtoileImpact
                key={etoile.cle}
                position={positionCarte(etoile.cote, zoneDims.l, zoneDims.h)}
                couleur={etoile.couleur}
                onTermine={() => setEtoile((x) => (x?.cle === etoile.cle ? null : x))}
              />
            )}
          </View>
        )}
      </View>

      {/* === ⚡ Combo de PARFAITS en banque (valeur ET barème viennent du moteur) === */}
      {affiche.combo > 0 && !combat.fini && (
        <View style={styles.comboChip}>
          <Text style={styles.comboChipTxt}>
            ⚡ PARFAITS ×{affiche.combo} — prochains coups +{Math.round((multCombo(affiche.combo) - 1) * 100)} %
          </Text>
        </View>
      )}

      {/* === ⚡ B2 · ÉNERGIE D'ÉQUIPE : la ressource qui arbitre tout le tour === */}
      {!combat.fini && (
        <View style={styles.energieRang}>
          <Icone nom="eclair" taille={15} />
          <Text style={styles.energieTxt}>{energieDispo}/{ENERGIE_MAX}</Text>
          <View style={styles.energiePips}>
            {Array.from({ length: ENERGIE_MAX }, (_, i) => (
              <View key={i} style={[styles.energiePip, i < energieDispo && styles.energiePipPlein]} />
            ))}
          </View>
          <Text style={styles.energieHint} numberOfLines={1}>
            {coutPrefixe > 0 ? `−${coutPrefixe}⚡ engagés` : `+${ENERGIE_PAR_ROUND}⚡ par round`}
          </Text>
        </View>
      )}

      {/* === 🔄🎒 B2 · Préfixe ARMÉ : le tour n'est PAS consommé, l'action reste à jouer === */}
      {prefixe !== null && !combat.fini && (
        <View style={styles.prefixeBanniere}>
          <Text style={styles.prefixeTxt} numberOfLines={2}>
            {prefixe.k === 'changer'
              ? `🔄 ${carteQuiJoue.nom} entre en jeu · ${COUT_CHANGER}⚡ — choisis maintenant SON action`
              : `🎒 ${CONSOMMABLES[prefixe.id].nom} · ${COUT_OBJET}⚡ — tu gardes ton action du tour`}
          </Text>
          <Pressable
            style={styles.prefixeAnnuler}
            onPress={desarmerPrefixe}
            disabled={enCours}
            accessibilityRole="button"
            accessibilityLabel="Annuler l'action préparée"
          >
            <Text style={styles.prefixeAnnulerTxt}>Annuler</Text>
          </Pressable>
        </View>
      )}

      {/* === ⭐ Signature : jauge (se remplit en agissant/encaissant) ou bouton prêt === */}
      {!combat.fini && (
        sigPrete ? (
          <Pressable
            style={[styles.sigPret, enCours && { opacity: 0.45 }]}
            disabled={enCours}
            onPress={() => attaquer('signature')}
          >
            <Icone nom="eclat" taille={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sigPretNom}>{sig.nom} — PRÊT !</Text>
              <Text style={styles.sigPretHint}>{sig.desc}</Text>
            </View>
          </Pressable>
        ) : (
          <View style={styles.sigJauge}>
            <Text style={styles.sigJaugeTxt}>Signature</Text>
            <View style={styles.sigPips}>
              {Array.from({ length: CHARGE_MAX }, (_, i) => (
                <View key={i} style={[styles.sigPip, i < carteQuiJoue.charge && styles.sigPipPlein]} />
              ))}
            </View>
            <Text style={styles.sigJaugeHint} numberOfLines={1}>{sig.nom}</Text>
          </View>
        )
      )}

      {/* === Attaques (kit de la carte qui JOUERA réellement ce tour) === */}
      <View style={[styles.attaques, { paddingBottom: (bancActif || sacDispo) ? 8 : insets.bottom + 12 }]}>
        {carteQuiJoue.attaques.map((a, i) => {
          const spe = i === 1;
          // 🔋⚡ la Spé demande une MUNITION et COUT_SPE d'énergie : le moteur replierait
          // sur l'attaque de base, autant le dire AVANT le tap plutôt que le subir.
          const epuisee = spe && carteQuiJoue.speRestantes <= 0;
          const impayable = spe && !spePayable;
          const bloquee = enCours || combat.fini || epuisee || impayable;
          const traits = hintTraits(a);
          return (
            <Pressable
              key={a.nom}
              style={[styles.btnAttaque, bloquee && { opacity: 0.45 }, spe && styles.btnAttaqueSpe]}
              disabled={bloquee}
              onPress={() => attaquer(i as 0 | 1)}
              accessibilityRole="button"
              accessibilityLabel={`${a.nom}${spe ? `, Spé, ${COUT_SPE} énergie` : ''}. ${HINT_ATTAQUE[a.type]}. ${traits}`}
            >
              <Text style={[styles.btnAttaqueNom, spe && { color: '#fff' }]} numberOfLines={2}>
                {a.nom}{spe ? ` · ${COUT_SPE}⚡` : ''}
              </Text>
              <Text style={[styles.btnAttaqueHint, spe && { color: C.lavande }]}>
                {epuisee ? 'Épuisée pour ce combat' : impayable ? `Il faut ${COUT_SPE}⚡` : HINT_ATTAQUE[a.type]}
              </Text>
              {!epuisee && !impayable && traits !== '' && (
                <Text style={[styles.btnAttaqueTrait, spe && { color: '#FFD166' }]} numberOfLines={2}>{traits}</Text>
              )}
              {spe && (
                <Text style={styles.btnAttaqueMun}>
                  {'●'.repeat(Math.max(0, carteQuiJoue.speRestantes))}
                  {'○'.repeat(Math.max(0, munitionsDe(carteQuiJoue) - carteQuiJoue.speRestantes))}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* === 🔄 Changement actif (banc) + 🛡️ Garde + 🎒 Sac === */}
      {(() => {
        const banc = combat.equipes.a.map((c, i) => ({ c, i })).filter(({ c, i }) => i !== affiche.actifs.a && c.pv > 0);
        if (combat.fini || (banc.length === 0 && !sacDispo)) return null;
        const changePayable = energieAuTour >= COUT_CHANGER;
        const objetPayable = energieAuTour >= COUT_OBJET;
        return (
          <View style={[styles.bancRang, { paddingBottom: insets.bottom + 6 }]}>
            {banc.length > 0 && <Text style={styles.bancLabel}>Changer · {COUT_CHANGER}⚡</Text>}
            {banc.map(({ c, i }) => {
              const av = multType(c.set, lui.set);
              const arme = prefixe?.k === 'changer' && prefixe.index === i;
              // Un objet déjà armé occupe le préfixe : les deux ne se cumulent pas.
              const bloque = enCours || (!changePayable && !arme) || prefixe?.k === 'objet';
              return (
                <Pressable
                  key={c.id}
                  style={[styles.bancChip, arme && styles.bancChipArme, bloque && { opacity: 0.4 }]}
                  disabled={bloque}
                  onPress={() => armerChangement(i)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: arme }}
                  accessibilityLabel={`Faire entrer ${c.nom}, ${COUT_CHANGER} énergie. Ton action du tour reste jouable.`}
                >
                  <PastilleCollectible id={c.id} taille={26} />
                  <Text style={styles.bancChipNom} numberOfLines={1}>{c.nom}</Text>
                  {av !== 1 && <Text style={[styles.bancAv, { color: av === 1.5 ? C.vertFonce : C.danger }]}>{av === 1.5 ? '▲' : '▼'}</Text>}
                </Pressable>
              );
            })}
            <Pressable
              style={[styles.gardeBtn, (!gardeDispo || enCours) && { opacity: 0.42 }]}
              disabled={!gardeDispo || enCours}
              onPress={garder}
            >
              <Icone nom="bouclier" taille={15} />
              <Text style={styles.gardeBtnTxt}>
                {gardeDispo ? `Garde −${Math.round(gardeReduction * 100)}/${Math.round(GARDE_PARFAITE * 100)} %` : `Garde · ${gardeRestante} t`}
              </Text>
            </Pressable>
            {sacDispo && (() => {
              const sacBloque = enCours || (!objetPayable && prefixe?.k !== 'objet') || prefixe?.k === 'changer';
              return (
                <Pressable
                  style={[styles.sacBtn, prefixe?.k === 'objet' && styles.sacBtnArme, sacBloque && { opacity: 0.4 }]}
                  disabled={sacBloque}
                  onPress={() => setSacVisible(true)}
                >
                  <Icone nom="sac" taille={15} />
                  <Text style={styles.sacBtnTxt}>
                    Sac · {COUT_OBJET}⚡{sacObjets.length ? ` (${sacObjets.reduce((s, id) => s + (jeu.consommables[id] ?? 0), 0)})` : ''}
                  </Text>
                </Pressable>
              );
            })()}
          </View>
        );
      })()}

      {/* === 🎒 Sac de consommables === */}
      <Modal visible={sacVisible} transparent animationType="fade" onRequestClose={() => setSacVisible(false)}>
        <Pressable style={styles.modalFond} onPress={() => setSacVisible(false)}>
          <Pressable style={styles.sacCarte} onPress={() => {}}>
            <View style={styles.modalTitreRang}><Icone nom="sac" taille={22} /><Text style={styles.modalTitre}>Sac de combat</Text></View>
            {sacObjets.length > 0 ? (
              <>
                {/* 🎒 §A2 — un objet ne coûte PLUS le tour : il coûte de l'énergie et
                    l'action du round reste jouable. Le sac n'est débité qu'une fois
                    l'action choisie (annuler avant ne consomme rien). */}
                <Text style={styles.sacAide}>
                  Jouer un objet coûte {COUT_OBJET}⚡ — tu gardes ton action du tour.
                </Text>
                {sacObjets.map((id) => {
                  const d = CONSOMMABLES[id];
                  return (
                    <Pressable key={id} style={[styles.sacLigne, enCours && { opacity: 0.4 }]} disabled={enCours} onPress={() => armerObjet(id)}>
                      <IconeEmoji emoji={d.emoji} taille={30} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sacNom}>{d.nom} ×{jeu.consommables[id]}</Text>
                        <Text style={styles.sacDesc}>{d.desc}</Text>
                      </View>
                      <Text style={styles.sacCout}>{COUT_OBJET}⚡</Text>
                    </Pressable>
                  );
                })}
              </>
            ) : (
              <>
                <Text style={styles.sacAide}>
                  Ton sac est vide ! Les consommables se jouent en plein combat — soin,
                  boost, bouclier, anti-étourdissement ou dégâts directs — pour
                  {' '}{COUT_OBJET}⚡, sans perdre ton action du tour.
                </Text>
                <Text style={styles.sacVide}>
                  Ils s'achètent avec des perles à l'Arène, section « Sac de combat ».
                </Text>
              </>
            )}
            <BoutonJeu titre="Fermer" onPress={() => setSacVisible(false)} style={{ alignSelf: 'stretch' }} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* === 🩹 26/07 — Confirmation d'ABANDON (jamais de défaite sur un tap) === */}
      <Modal visible={confirmerAbandon} transparent animationType="fade" onRequestClose={() => setConfirmerAbandon(false)}>
        <View style={styles.modalFond}>
          <View style={styles.modalCarte}>
            <Icone nom="triste" taille={40} />
            <Text style={styles.modalTitre}>Abandonner ?</Text>
            <Text style={styles.modalTexte}>Tu perds ce combat. {coutAbandon}</Text>
            <BoutonJeu
              titre="Abandonner le combat"
              variante="danger"
              onPress={abandonner}
              accessibilityHint="Le combat est résolu comme une défaite : le récapitulatif s'affiche."
              style={{ alignSelf: 'stretch' }}
            />
            <BoutonJeu
              titre="Continuer le combat"
              onPress={() => setConfirmerAbandon(false)}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        </View>
      </Modal>

      {/* === 💥 K.O. cinématique === */}
      {koFlash && (
        <KoCinematique
          key={koFlash.cle}
          nom={koFlash.nom}
          duree={Math.round(DUREE_KO_MS / vitesseRef.current)}
        />
      )}

      {/* === ⭐ Cinématique de SIGNATURE (par famille, skippable au tap) === */}
      {cine && (
        <CineSignature
          key={cine.cle}
          set={cine.set}
          adverse={cine.adverse}
          nom={cine.nom}
          duree={Math.round(DUREE_CINE_MS / vitesseRef.current)}
          onSkip={() => cineSkipRef.current?.()}
        />
      )}

      {/* === 🎯 Jauge de timing (attaque / Signature / Garde) — plus dure si blessé.
          🩸 La visée suit la carte qui AGIT : après un changement armé, c'est
          l'entrante (fraîche) qui vise, pas la sortante qui était à l'agonie. === */}
      {timingDemande !== null && (
        <JaugeTiming
          intitule={timingDemande === 'garde' ? 'PARADE — tape dans la zone dorée !' : 'Tape dans la zone dorée !'}
          blessure={viseeBlessure(affiche.pv.a[idxQuiJoue] ?? carteQuiJoue.pv, carteQuiJoue.pvMax)}
          onResultat={resoudreTiming}
        />
      )}

      {/* === Fin === */}
      <Modal visible={!!recap} transparent animationType="fade" onRequestClose={() => {}}>
        {recap && (
          <View style={styles.modalFond}>
            {recap.gagne && (
              <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
                <Confettis hauteur={320} />
              </View>
            )}
            <View style={styles.modalCarte}>
              <Icone nom={recap.gagne ? 'trophee' : 'triste'} taille={48} />
              <Text style={styles.modalTitre}>{recap.gagne ? 'VICTOIRE !' : 'Défaite…'}</Text>

              {recap.type === 'pnj' && (
                <>
                  <View style={styles.ligneGain}>
                    <IconePerle taille={18} />
                    <Text style={styles.ligneGainTxt}>+{formatNb(recap.perles)} perles</Text>
                  </View>
                  {recap.pc !== 0 && (
                    <View style={styles.gainRang}>
                      <Icone nom="trophee" taille={15} />
                      <Text style={[styles.pcGain, { color: recap.pc > 0 ? '#2E7D32' : '#C0455A' }]}>
                        {recap.pc > 0 ? `+${recap.pc}` : recap.pc} PC de classement
                      </Text>
                    </View>
                  )}
                  {recap.capsule && (
                    <View style={styles.gainRang}>
                      <Icone nom="cadeau" taille={16} />
                      <Text style={styles.capsuleGain}>+1 capsule {recap.capsule === 'doree' ? 'DORÉE' : 'classique'} !</Text>
                      {recap.capsule === 'doree' && <Icone nom="couronne" taille={16} />}
                    </View>
                  )}
                  {/* 🔥 série de victoires : la boucle « encore un ! » */}
                  {recap.gagne && recap.serie >= 2 && (
                    <Text style={styles.serieVTxt}>
                      🔥 {recap.serie} victoires d'affilée — perles ×{recap.multSerie.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')}
                    </Text>
                  )}
                  {recap.gagne && recap.serie === 1 && (
                    <Text style={styles.serieVHint}>Enchaîne sans perdre : chaque victoire d'affilée paie +15 % !</Text>
                  )}
                  {recap.gagne
                    ? <Text style={styles.modalTexte}>Rang {recap.rang + 1} débloqué — le prochain Maître t'attend.</Text>
                    : <Text style={styles.modalTexte}>Change d'équipe ou monte en puissance : le triangle des types fait tout !</Text>}
                  {recap.gagne && (
                    <BoutonJeu
                      titre={`Maître suivant — Rang ${recap.rang + 1} →`}
                      onPress={() => router.replace(`/jeu/duel?mode=pnj&rang=${recap.rang + 1}` as any)}
                      style={{ alignSelf: 'stretch', backgroundColor: C.vert }}
                    />
                  )}
                </>
              )}
              {recap.type === 'tournoi' && (
                <>
                  {recap.champion && (
                    <View style={styles.gainRang}>
                      <Icone nom="couronne" taille={18} />
                      <Text style={styles.championTxt}>CHAMPION DE LA SEMAINE !</Text>
                      <Icone nom="couronne" taille={18} />
                    </View>
                  )}
                  <View style={styles.ligneGain}>
                    <IconePerle taille={18} />
                    <Text style={styles.ligneGainTxt}>+{formatNb(recap.perles)} perles</Text>
                  </View>
                  {recap.capsule && (
                    <View style={styles.gainRang}>
                      <Icone nom="cadeau" taille={16} />
                      <Text style={styles.capsuleGain}>+1 capsule {recap.capsule === 'doree' ? 'DORÉE' : 'classique'} !</Text>
                      {recap.capsule === 'doree' && <Icone nom="couronne" taille={16} />}
                    </View>
                  )}
                  {recap.gagne && !recap.champion && (
                    <BoutonJeu
                      titre={`${TOURNOI_ETAPES[Math.min(2, recap.etape + 1)]} →`}
                      onPress={() => router.replace(`/jeu/duel?mode=tournoi&etape=${recap.etape + 1}` as any)}
                      style={{ alignSelf: 'stretch', backgroundColor: C.vert }}
                    />
                  )}
                  {!recap.gagne && (
                    <Text style={styles.modalTexte}>
                      Éliminé pour cette semaine… Nouveau tournoi lundi ! (+{formatNb(recap.perles)} perles de consolation)
                    </Text>
                  )}
                </>
              )}
              {recap.type === 'tournee' && (
                <>
                  {recap.gagne && (
                    <View style={styles.ligneGain}>
                      <IconePerle taille={18} />
                      <Text style={styles.ligneGainTxt}>+{formatNb(recap.perles)} perles</Text>
                    </View>
                  )}
                  <View style={styles.gainRang}>
                    <IconeEmoji emoji="🗺️" taille={16} />
                    <Text style={styles.capsuleGain}>
                      Série en cours : {recap.score} victoire{recap.score > 1 ? 's' : ''}
                      {recap.nouveau ? ' — NOUVEAU RECORD EN COURS !' : ` (record ${recap.record})`}
                    </Text>
                  </View>
                  <Text style={styles.modalTexte}>
                    {recap.gagne
                      ? `Duel ${recap.etape} remporté ! Choisis un bonus de run pour affronter le duel ${recap.etape + 1} — tes PV sont reportés tels quels.`
                      : `La Tournée s'arrête ici : ${recap.score} victoire${recap.score > 1 ? 's' : ''}.${recap.nouveau ? ' Nouveau record !' : ''} Une nouvelle run t'attend.`}
                  </Text>
                </>
              )}
              {/* 👹 REVANCHE — branche SANS aucune ligne de gain, par construction : le
                  récap ne peut donc pas annoncer une récompense qui n'est pas versée. */}
              {recap.type === 'boss' && recap.revanche > 0 && (
                <>
                  <View style={styles.revanchePalier}>
                    <Icone nom="epee" taille={16} />
                    <Text style={styles.revanchePalierTxt}>Revanche · palier {recap.revanche}</Text>
                  </View>
                  <Text style={styles.modalTexte}>
                    {recap.gagne
                      ? `Boss terrassé au palier ${recap.revanche}, en ${recap.rounds} round${recap.rounds > 1 ? 's' : ''} ! Rien à encaisser — la récompense de la semaine est déjà tombée. Demain il sera encore plus fort.`
                      : `Le boss tient bon au palier ${recap.revanche} (${recap.rounds} round${recap.rounds > 1 ? 's' : ''}). Rien de perdu : une revanche ne coûte rien. Retente, ou reviens demain.`}
                  </Text>
                  <Text style={styles.revancheNote}>
                    Entraînement pur : ni perles, ni capsule, ni éclats. Seul ton palmarès de cartes progresse.
                  </Text>
                </>
              )}
              {recap.type === 'boss' && recap.revanche === 0 && (
                recap.gagne ? (
                  recap.deja ? (
                    <Text style={styles.modalTexte}>Boss déjà vaincu cette semaine — passe à la revanche pour le réaffronter !</Text>
                  ) : (
                    <>
                      <View style={styles.ligneGain}>
                        <IconePerle taille={18} />
                        <Text style={styles.ligneGainTxt}>+{formatNb(recap.perles)} perles</Text>
                      </View>
                      <View style={styles.gainRang}>
                        <Icone nom="cadeau" taille={15} />
                        <Text style={styles.capsuleGain}>+{recap.capsules} capsule ·</Text>
                        <Icone nom="eclat" taille={14} />
                        <Text style={styles.capsuleGain}>+{recap.eclats} éclats</Text>
                      </View>
                      <Text style={styles.modalTexte}>Boss de la semaine vaincu ! Reviens lundi défier le suivant.</Text>
                    </>
                  )
                ) : (
                  <Text style={styles.modalTexte}>Le boss est coriace ! Adapte ton équipe à son gimmick et retente.</Text>
                )
              )}
              {recap.type === 'ami' && recap.amical && (
                <Text style={styles.modalTexte}>
                  {recap.gagne ? 'La classe. Sam va demander sa revanche !' : 'Sam jubile. Tu connais le chemin de l\'Aventure…'}
                </Text>
              )}
              {recap.type === 'ami' && !recap.amical && (
                <>
                  {recap.gagne && recap.gainId && (
                    <View style={{ alignItems: 'center', gap: 8 }}>
                      <PastilleCollectible id={recap.gainId} taille={84} />
                      <Text style={styles.capsuleGain}>
                        Tu remportes {trouverCollectible(recap.gainId)?.nom} !{recap.nouveau ? '  NOUVEAU !' : ''}
                      </Text>
                    </View>
                  )}
                  {!recap.gagne && recap.miseId && (
                    <Text style={styles.modalTexte}>
                      Sam emporte ton doublon {trouverCollectible(recap.miseId)?.nom}… Récupère-le à la revanche !
                    </Text>
                  )}
                </>
              )}
              {recap.type === 'defi' && (
                <>
                  {recap.gagne && (
                    <View style={styles.ligneGain}>
                      <IconePerle taille={18} />
                      <Text style={styles.ligneGainTxt}>+{formatNb(recap.perles)} perles</Text>
                    </View>
                  )}
                  <Text style={styles.modalTexte}>
                    {recap.gagne
                      ? `Tu as battu l'équipe de ${recap.ami} ! Défi relevé.`
                      : `${recap.ami} a bien défendu son équipe… Retente sur un autre défi !`}
                  </Text>
                </>
              )}

              {/* 👹 REJOUER SUR PLACE : une revanche ne coûte rien, donc obliger à
                  repasser par l'Arène entre deux tentatives serait du frottement pur.
                  `router.replace` (et non `push`) pour ne pas empiler les écrans de duel :
                  le bouton « Retour à l'Arène » doit rester à UN cran, quelle que soit la
                  longueur de la série. */}
              {recap.type === 'boss' && recap.revanche > 0 && (
                <BoutonJeu
                  titre={`Rejouer — palier ${recap.revanche}`}
                  variante="danger"
                  onPress={() => router.replace(`/jeu/duel?mode=boss&revanche=${recap.revanche}` as any)}
                  style={{ alignSelf: 'stretch' }}
                />
              )}
              <BoutonJeu
                titre={recap.type === 'tournoi' ? 'Retour au tournoi' : recap.type === 'tournee' ? 'Retour à la Tournée' : recap.type === 'defi' ? 'Retour aux défis' : 'Retour à l\'Arène'}
                onPress={() => router.back()}
                style={{ alignSelf: 'stretch' }}
              />
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

// 🎯 Jauge de timing façon « action command » : un curseur balaie la piste,
// le joueur tape — zone dorée = PARFAIT, verte = BIEN, sinon (ou trop tard) = RATÉ.
// 🩸 Plus la carte active est BLESSÉE, plus le curseur FILE et plus les zones se
// resserrent (mains qui tremblent). Résolution par timingDepuisPosition (PUR, testé).
function JaugeTiming({ intitule, blessure, onResultat }: { intitule: string; blessure: number; onResultat: (t: Timing) => void }) {
  const prog = useRef(new Animated.Value(0)).current;
  const pos = useRef(0);
  const resolu = useRef(false);
  const LARGEUR = 264;
  const zones = viseeZones(blessure);
  const grave = blessure >= 0.5;

  useEffect(() => {
    const id = prog.addListener(({ value }) => { pos.current = value; });
    Animated.timing(prog, { toValue: 1, duration: viseeDuree(blessure), easing: Easing.linear, useNativeDriver: true })
      .start(({ finished }) => {
        if (finished && !resolu.current) { resolu.current = true; onResultat('rate'); } // trop tard
      });
    return () => prog.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const taper = () => {
    if (resolu.current) return;
    resolu.current = true;
    prog.stopAnimation();
    onResultat(timingDepuisPosition(pos.current, zones));
  };

  return (
    <Pressable style={styles.timingFond} onPress={taper} accessibilityRole="button" accessibilityLabel="Jauge de timing — tape maintenant">
      <View style={[styles.timingCarte, grave && styles.timingCarteGrave]}>
        <Text style={styles.timingTitre}>{intitule}</Text>
        <View style={[styles.timingPiste, { width: LARGEUR }]}>
          <View style={[styles.timingZoneVerte, { left: LARGEUR * (0.5 - zones.vert / 2), width: LARGEUR * zones.vert }]} />
          <View style={[styles.timingZoneOr, { left: LARGEUR * (0.5 - zones.or / 2), width: LARGEUR * zones.or }]} />
          <Animated.View
            style={[styles.timingCurseur, {
              transform: [{ translateX: prog.interpolate({ inputRange: [0, 1], outputRange: [0, LARGEUR - 5] }) }],
            }]}
          />
        </View>
        <Text style={[styles.timingHint, grave && { color: C.danger }]}>
          {grave
            ? '🩸 Carte blessée : la barre FILE et la cible rétrécit !'
            : 'Doré = PARFAIT (coup sûr + crit) · vert = bien · sinon raté'}
        </Text>
      </View>
    </Pressable>
  );
}

// ⭐ CINÉMATIQUE DE SIGNATURE par famille (skippable au tap) : voile violet profond
// ~92 %, particules thématiques, nom en Fredoka. Accent « danger » (voile rouge +
// mention) quand l'ulti vient de l'adversaire. Tout en driver natif.
// 🔧 B1 — la durée est désormais PASSÉE (et déjà divisée par ×1/×2) : elle était figée
// à 600 ms alors que l'attente, elle, suivait la vitesse — à ×2 le voile disparaissait
// au milieu de son animation.
const CINE_COULEURS: Record<SetId, string[]> = {
  fruit: ['#9FC038', '#F2DA33'],   // vague de fruits vert/jaune
  milk: ['#FBF2E5', '#F7B8D6'],    // nappage crème/rose
  topping: ['#F7B8D6', '#B98FE0'], // pluie de perles rose/violet
  signature: ['#C99012', '#F2DA33'],// rayons dorés royaux
};

function CineSignature({ set, adverse, nom, duree, onSkip }: { set: SetId; adverse: boolean; nom: string; duree: number; onSkip: () => void }) {
  const prog = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(prog, { toValue: 1, duration: duree, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [prog, duree]);

  // positions déterministes (aucune valeur ne change entre deux rendus)
  const particules = useMemo(
    () => Array.from({ length: set === 'topping' ? 12 : 9 }).map((_, i) => ({
      x: (i * 47 + 11) % 96,
      d: (i % 5) / 9,
      taille: 10 + ((i * 7) % 3) * 6,
    })),
    [set],
  );

  return (
    <Pressable
      style={[styles.cineFond, adverse && styles.cineFondAdverse]}
      onPress={onSkip}
      accessibilityRole="button"
      accessibilityLabel="Passer la cinématique de Signature"
    >
      {adverse && <Text style={styles.cineAdverse}>SIGNATURE ADVERSE</Text>}
      {/* particules thématiques */}
      {particules.map((p, i) => {
        const op = prog.interpolate({ inputRange: [p.d, Math.min(1, p.d + 0.28), 1], outputRange: [0, 1, 0.3], extrapolate: 'clamp' });
        const ty = prog.interpolate({
          inputRange: [p.d, 1],
          outputRange: set === 'topping' ? [-36, 320] : set === 'fruit' ? [-14, 110] : [0, 76],
          extrapolate: 'clamp',
        });
        const sc = prog.interpolate({ inputRange: [p.d, Math.min(1, p.d + 0.32), 1], outputRange: [0.2, 1, 1.22], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute', top: set === 'topping' ? '12%' : '26%', left: `${p.x}%`,
              width: p.taille, height: p.taille,
              borderRadius: set === 'fruit' ? p.taille * 0.28 : p.taille / 2,
              backgroundColor: CINE_COULEURS[set][i % 2],
              opacity: op,
              transform: [{ translateY: ty }, { scale: sc }],
            }}
          />
        );
      })}
      {/* 👑 Sacre Royal : couronne dorée qui se déploie */}
      {set === 'signature' && (
        <Animated.View
          pointerEvents="none"
          style={{
            transform: [
              { scale: prog.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.4, 1.14, 1] }) },
              { rotate: prog.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '5deg'] }) },
            ],
          }}
        >
          <Icone nom="couronne" taille={74} />
        </Animated.View>
      )}
      <Animated.Text
        style={[styles.cineTitre, adverse && styles.cineTitreAdverse, {
          opacity: prog.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' }),
          transform: [{ scale: prog.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.6, 1.07, 1] }) }],
        }]}
      >
        {nom.toUpperCase()}
      </Animated.Text>
      <Text style={styles.cineHint}>touche pour passer</Text>
    </Pressable>
  );
}

// 💥 K.O. cinématique : flash + « K.O. ! » qui claque, disparaît tout seul.
// 🔧 B1 — durée PASSÉE et répartie en fractions (entrée / tenue / sortie) pour rester
// calée sur ATTENTE.koAdverse : le plein écran ne déborde jamais sur l'événement suivant.
function KoCinematique({ nom, duree }: { nom: string; duree: number }) {
  const av = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(av, { toValue: 1, duration: Math.round(duree * 0.22), easing: Easing.out(Easing.back(1.8)), useNativeDriver: true }),
      Animated.delay(Math.round(duree * 0.46)),
      Animated.timing(av, { toValue: 2, duration: Math.round(duree * 0.32), useNativeDriver: true }),
    ]).start();
  }, [av, duree]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.koFond, { opacity: av.interpolate({ inputRange: [0, 0.2, 1, 2], outputRange: [0, 1, 1, 0] }) }]}
    >
      <Animated.Text
        style={[styles.koTxt, {
          transform: [
            { scale: av.interpolate({ inputRange: [0, 1, 2], outputRange: [0.3, 1, 1.18] }) },
            { rotate: '-6deg' },
          ],
        }]}
      >
        K.O. !
      </Animated.Text>
      <Text style={styles.koNom}>{nom} est au tapis</Text>
    </Animated.View>
  );
}

// Carte d'un combattant actif : pastille, nom, chips, barre de PV ANIMÉE
// (elle glisse à chaque coup), puces de STATUT, points d'équipe.
// PV et actif viennent de l'état REJOUÉ ; les statuts, eux, sont lus VIVANTS sur le
// combattant : le moteur n'émet pas d'événement porteur d'un index de statut, donc il
// n'existe pas de façon fiable de les rejouer un à un. Conséquence assumée : une puce
// apparaît au plus un événement en avance sur la ligne de journal qui l'explique —
// l'effet est déjà visible pendant qu'on le raconte.
function CarteCombattant({ cote, equipe, actifIdx, pvAffiches, secousse, elan, flottant, burst, assaut, squash, flash, inverse }: {
  cote: CoteCombat; equipe: Combattant[]; actifIdx: number; pvAffiches: number[];
  secousse: Animated.Value;
  elan: Animated.Value;
  flottant: { cote: CoteCombat; txt: string; couleur: string; cle: number } | null;
  burst: { cote: CoteCombat; crit: boolean; cle: number; couleur?: string } | null;
  // 🎬 PACK 3 : assaut de mêlée (fonce), squash d'impact (aplatie), flash blanc
  assaut: Animated.Value;
  squash: Animated.Value;
  flash: Animated.Value;
  inverse?: boolean;
}) {
  const c = equipe[actifIdx];
  const pv = pvAffiches[actifIdx];
  const pct = Math.max(0, Math.min(100, (pv / c.pvMax) * 100));
  const couleurPv = pct > 50 ? C.vert : pct > 22 ? C.jaune : C.danger;
  const meta = trouverCollectible(c.id);

  // La barre GLISSE vers sa nouvelle valeur (au lieu de sauter)
  const largeur = useRef(new Animated.Value(pct)).current;
  useEffect(() => {
    Animated.timing(largeur, {
      toValue: pct, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [pct, largeur]);

  // 🚨 pouls de DANGER : anneau rouge qui bat quand l'actif est sous 25 % de PV
  const danger = pv > 0 && pct <= 25;
  const pouls = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!danger) { pouls.setValue(0); return; }
    const boucle = Animated.loop(Animated.sequence([
      Animated.timing(pouls, { toValue: 1, duration: 440, useNativeDriver: true }),
      Animated.timing(pouls, { toValue: 0, duration: 440, useNativeDriver: true }),
    ]));
    boucle.start();
    return () => boucle.stop();
  }, [danger, pouls]);

  return (
    <Animated.View
      style={[styles.combattant, inverse && { flexDirection: 'row-reverse' }, {
        transform: [
          { translateX: secousse.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] }) },
          // 🥊 élan d'attaque : bond vers l'adversaire (bas → haut, haut → bas)
          { translateY: elan.interpolate({ inputRange: [0, 1], outputRange: [0, inverse ? 13 : -13] }) },
          { scale: elan.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
          // 🤜 assaut de mêlée : la carte FONCE au contact (se cumule à l'élan)
          { translateY: assaut.interpolate({ inputRange: [0, 1], outputRange: [0, inverse ? 46 : -46] }) },
          { scale: assaut.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) },
          // 🥞 squash d'impact : aplatie verticalement, élargie à peine
          { scaleY: squash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] }) },
          { scaleX: squash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
        ],
      }]}
    >
      {/* ⚡ flash blanc d'impact (fondu 210 ms, piloté par `flash`) */}
      <Animated.View pointerEvents="none" style={[styles.flashCarte, { opacity: flash }]} />
      {danger && (
        <Animated.View
          pointerEvents="none"
          style={[styles.dangerRing, { opacity: pouls.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.9] }) }]}
        />
      )}
      <View style={{ alignItems: 'center', gap: 4 }}>
        <View style={{ opacity: pv > 0 ? 1 : 0.3 }}>
          <PastilleCollectible id={c.id} taille={86} />
          {burst && (
            <View pointerEvents="none" style={{ position: 'absolute', left: 43 - 62, top: 43 - 62 }}>
              <BurstSkia taille={124} crit={burst.crit} cle={burst.cle} couleur={burst.couleur} />
            </View>
          )}
        </View>
        {flottant && flottant.cote === cote && (
          <Text key={flottant.cle} style={[styles.flottant, { color: flottant.couleur }]}>{flottant.txt}</Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.nomLigne}>
          <View style={styles.nomRang}>
            <Text style={styles.nom} numberOfLines={1}>{c.nom}</Text>
            {c.objets.map((o) => <IconeEmoji key={o} emoji={OBJETS[o].emoji} taille={14} />)}
          </View>
          <View style={styles.chipsRow}>
            {c.niveau > 1 && <Text style={styles.chipNiveau}>Nv {c.niveau}</Text>}
            <IconeType set={c.set} taille={16} />
            <Text style={styles.chips}>{meta ? RARETES[meta.rarete].nom : ''}</Text>
          </View>
        </View>
        <View style={styles.pvBarre}>
          <Animated.View
            style={[styles.pvRempli, {
              backgroundColor: couleurPv,
              width: largeur.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
            }]}
          />
        </View>
        <View style={styles.sousLigne}>
          <View style={styles.pvTxtRang}>
            <Text style={styles.pvTxt}>{pv}/{c.pvMax} PV</Text>
            {/* 🧪 B3 — STATUTS GÉNÉRIQUES : une puce par entrée de `c.statuts`, libellée
                par `INFOS_STATUT` (table du MOTEUR). Zéro `if` par statut ici : les 13
                statuts actuels — et tous ceux qui viendront — s'affichent sans rééditer
                l'écran. Les marques de famille (Collant / Givré / Pétillant), meilleure
                couche tactique du jeu et jusqu'ici quasi invisibles, se lisent enfin :
                emoji, cumul (×n) et actions restantes. */}
            {c.statuts.slice(0, MAX_PUCES_STATUT).map((s) => {
              const info = INFOS_STATUT[s.id];
              return (
                <Text
                  key={s.id}
                  style={styles.statutPuce}
                  accessibilityLabel={`${info.nom} : ${info.aide}`}
                >
                  {info.emoji}{s.piles > 1 ? `×${s.piles}` : ''}{s.tours > 0 ? ` ${s.tours}` : ''}
                </Text>
              );
            })}
            {c.statuts.length > MAX_PUCES_STATUT && (
              <Text style={styles.statutPuce}>+{c.statuts.length - MAX_PUCES_STATUT}</Text>
            )}
            {c.gimmick && c.bossPhase > 1 ? <Text style={styles.statutBoss}>P{c.bossPhase}</Text> : null}
            {/* ⭐ jauge signature — visible des DEUX côtés (on voit venir l'ulti adverse) */}
            <View style={styles.chargeRang}>
              {Array.from({ length: CHARGE_MAX }, (_, i) => (
                <View key={i} style={[styles.chargePip, i < c.charge && styles.chargePipPlein]} />
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {equipe.map((m, i) => (
              <View key={m.id} style={[styles.point, pvAffiches[i] <= 0 && { backgroundColor: C.bord }, i === actifIdx && pvAffiches[i] > 0 && { borderWidth: 1.5, borderColor: C.violetProfond }]} />
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  hud: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  fermer: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.carte,
    alignItems: 'center', justifyContent: 'center', borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  titre: { flex: 1, fontFamily: F.titre, fontSize: 18, color: C.violet, textAlign: 'center' },
  vitesseBtn: {
    width: 40, height: 34, borderRadius: R.pill, backgroundColor: C.violet,
    alignItems: 'center', justifyContent: 'center',
  },
  vitesseTxt: { fontFamily: F.t800, fontSize: 13, color: '#fff', fontVariant: ['tabular-nums'] },

  intention: {
    marginHorizontal: 18, marginTop: 5, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12,
    borderWidth: 1, borderColor: C.bord,
  },
  intentionHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  intentionHautDroite: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  energieAdverse: { fontFamily: F.t800, fontSize: 9.5, color: C.texte2, fontVariant: ['tabular-nums'] },
  intentionLabel: { fontFamily: F.t800, fontSize: 9.5, color: C.texte3, letterSpacing: 0.4 },
  intentionTitre: { fontFamily: F.t800, fontSize: 13.5, color: C.texte, marginTop: 2 },
  intentionDetail: { fontFamily: F.t600, fontSize: 10.5, color: C.texte2 },
  phaseBoss: { fontFamily: F.t800, fontSize: 9.5, color: C.danger },

  zone: { flex: 1, padding: 18, gap: 12, justifyContent: 'space-between' },

  // 🎬 PACK 3 — overlay des projectiles/effets d'attaque (au-dessus des cartes)
  volOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  // ⚡ voile blanc du flash d'impact, épouse la carte
  flashCarte: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: '#fff', borderRadius: R.carte,
  },

  // 🎯 jauge de timing (action command)
  timingFond: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(69,42,110,0.45)', alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: 150, zIndex: 20,
  },
  timingCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, paddingVertical: 16, paddingHorizontal: 20,
    alignItems: 'center', gap: 12, borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  timingTitre: { fontFamily: F.titre, fontSize: 16, color: C.violet },
  timingCarteGrave: { borderColor: C.danger, borderWidth: 2 },
  timingPiste: {
    height: 26, borderRadius: 13, backgroundColor: C.lavande, overflow: 'hidden',
  },
  timingZoneVerte: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#C9E29B' },
  timingZoneOr: { position: 'absolute', top: 0, bottom: 0, backgroundColor: C.jaune },
  timingCurseur: {
    position: 'absolute', top: -2, bottom: -2, width: 5, borderRadius: 2.5,
    backgroundColor: C.violetProfond,
  },
  timingHint: { fontFamily: F.t600, fontSize: 11, color: C.texte2, textAlign: 'center' },
  verdict: { fontFamily: F.titre, fontSize: 20, textAlign: 'center' },

  // ⚡ combo de parfaits
  comboChip: {
    alignSelf: 'center', backgroundColor: '#FFF3D6', borderRadius: R.pill,
    paddingVertical: 4, paddingHorizontal: 14, marginBottom: 4,
    borderWidth: 1, borderColor: C.jaune,
  },
  comboChipTxt: { fontFamily: F.t800, fontSize: 12, color: '#9A6B00' },

  // ⚡ B2 — ligne d'énergie d'équipe : la ressource se LIT d'un coup d'œil
  energieRang: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginHorizontal: 18, marginBottom: 6, paddingVertical: 6, paddingHorizontal: 12,
    backgroundColor: C.carte, borderRadius: R.pill, borderWidth: 1, borderColor: C.bord,
  },
  energieTxt: { fontFamily: F.t800, fontSize: 12.5, color: C.violet, fontVariant: ['tabular-nums'] },
  energiePips: { flexDirection: 'row', gap: 3 },
  energiePip: { width: 12, height: 9, borderRadius: 3, backgroundColor: C.lavande },
  energiePipPlein: { backgroundColor: C.jaune, borderWidth: 1, borderColor: '#D9BE12' },
  energieHint: { flex: 1, fontFamily: F.t600, fontSize: 10.5, color: C.texte3, textAlign: 'right' },

  // 🔄🎒 B2 — bandeau du préfixe armé (changement ou objet en attente d'action)
  prefixeBanniere: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 18, marginBottom: 6, paddingVertical: 7, paddingHorizontal: 12,
    backgroundColor: '#E9E2F7', borderRadius: 14, borderWidth: 1, borderColor: C.violetClair,
  },
  prefixeTxt: { flex: 1, fontFamily: F.t700, fontSize: 11.5, color: C.violet },
  prefixeAnnuler: {
    borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 10,
    backgroundColor: C.carte, borderWidth: 1, borderColor: C.violetClair,
  },
  prefixeAnnulerTxt: { fontFamily: F.t800, fontSize: 11, color: C.violet },

  // ⭐ Cinématique de Signature
  cineFond: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(69,42,110,0.92)',
  },
  cineFondAdverse: { backgroundColor: 'rgba(110,32,54,0.92)' },
  cineAdverse: {
    position: 'absolute',
    top: '16%',
    alignSelf: 'center',
    fontFamily: F.t800,
    fontSize: 12,
    color: '#FFD3DE',
    letterSpacing: 1.2,
    backgroundColor: 'rgba(194,74,110,0.4)',
    borderRadius: R.pill,
    paddingVertical: 5,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  cineTitre: {
    fontFamily: F.titre,
    fontSize: 30,
    color: C.jaune,
    textAlign: 'center',
    letterSpacing: 1,
    textShadowColor: C.violetProfond,
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
    marginHorizontal: 30,
  },
  cineTitreAdverse: { color: '#FFD3DE' },
  cineHint: {
    position: 'absolute',
    bottom: 56,
    alignSelf: 'center',
    fontFamily: F.t600,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },

  // 💥 K.O. cinématique
  koFond: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(69,42,110,0.35)',
  },
  koTxt: {
    fontFamily: F.titre, fontSize: 64, color: C.jaune,
    textShadowColor: C.violetProfond, textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 8,
  },
  koNom: { fontFamily: F.t800, fontSize: 15, color: '#fff', marginTop: 6 },

  // 🚨 pouls de danger (PV bas)
  dangerRing: {
    position: 'absolute', left: -2, right: -2, top: -2, bottom: -2,
    borderWidth: 3, borderColor: C.danger, borderRadius: R.carte,
  },

  // 🔥 série de victoires
  serieVTxt: { fontFamily: F.t800, fontSize: 14, color: '#C7541F', textAlign: 'center' },
  serieVHint: { fontFamily: F.t600, fontSize: 12, color: C.texte2, textAlign: 'center' },

  combattant: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.carte, borderRadius: R.carte, padding: 14, borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  nomLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nomRang: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  nom: { fontFamily: F.t800, fontSize: 16.5, color: C.texte },
  pvTxtRang: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, flexWrap: 'wrap' },
  chargeRang: { flexDirection: 'row', gap: 2.5, marginLeft: 3 },
  chargePip: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.lavande },
  chargePipPlein: { backgroundColor: '#F5A93B' },
  chips: { fontFamily: F.t700, fontSize: 11.5, color: C.texte2 },
  chipNiveau: {
    fontFamily: F.t800, fontSize: 10.5, color: C.violet, backgroundColor: C.lavande,
    borderRadius: R.pill, paddingHorizontal: 6, paddingVertical: 1.5, overflow: 'hidden',
  },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pvBarre: { height: 10, borderRadius: 5, backgroundColor: C.lavande, overflow: 'hidden' },
  pvRempli: { height: 10, borderRadius: 5 },
  sousLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pvTxt: { fontFamily: F.t700, fontSize: 12, color: C.texte2 },
  // 🧪 B3 — puce de statut générique (emoji + cumul + actions restantes)
  statutPuce: {
    fontFamily: F.t800, fontSize: 9.5, color: C.violet, backgroundColor: C.lavande,
    borderRadius: 5, paddingHorizontal: 3.5, paddingVertical: 0.5, overflow: 'hidden',
  },
  statutBoss: { fontFamily: F.t800, fontSize: 9, color: '#fff', backgroundColor: C.danger, borderRadius: 5, paddingHorizontal: 4 },
  point: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.vert },
  flottant: { position: 'absolute', top: -6, alignSelf: 'center', fontFamily: F.titre, fontSize: 20 },

  centre: { alignItems: 'center', gap: 6, minHeight: 74, justifyContent: 'center' },
  avantage: { borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 12 },
  avantageTxt: { fontFamily: F.t800, fontSize: 12 },
  avantageRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap', justifyContent: 'center' },
  journal: { fontFamily: F.t700, fontSize: 14.5, color: C.texte, textAlign: 'center' },

  attaques: { flexDirection: 'row', gap: 12, paddingHorizontal: 18 },
  btnAttaque: {
    flex: 1, backgroundColor: C.carte, borderRadius: R.btn + 2, paddingVertical: 14,
    alignItems: 'center', gap: 3, borderWidth: 2, borderColor: C.bord, ...OMBRE,
  },
  btnAttaqueSpe: { backgroundColor: C.violet, borderColor: C.violet },
  btnAttaqueNom: { fontFamily: F.t800, fontSize: 14.5, color: C.texte, textAlign: 'center' },
  btnAttaqueHint: { fontFamily: F.t600, fontSize: 11, color: C.texte2, textAlign: 'center' },
  // 🏷️ aide de TRAIT (A3) : la ligne qui donne son identité à chacune des 24 cartes
  btnAttaqueTrait: { fontFamily: F.t600, fontSize: 9.5, color: C.violetClair, textAlign: 'center' },
  btnAttaqueMun: { fontFamily: F.t800, fontSize: 10, color: '#FFD166', textAlign: 'center', letterSpacing: 2, marginTop: 1 },

  // ⭐ signature : jauge fine (pas prête) ou gros bouton doré (prête)
  sigJauge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 18, marginBottom: 8, paddingVertical: 7, paddingHorizontal: 12,
    backgroundColor: C.carte, borderRadius: 12, borderWidth: 1, borderColor: C.bord,
  },
  sigJaugeTxt: { fontFamily: F.t800, fontSize: 11.5, color: C.texte2 },
  sigPips: { flexDirection: 'row', gap: 4 },
  sigPip: { width: 14, height: 8, borderRadius: 4, backgroundColor: C.lavande },
  sigPipPlein: { backgroundColor: '#F5A93B' },
  sigJaugeHint: { flex: 1, fontFamily: F.t600, fontSize: 10.5, color: C.texte3, textAlign: 'right' },
  sigPret: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 18, marginBottom: 8, paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: '#F5A93B', borderRadius: 14, borderWidth: 2, borderColor: '#E8920F',
  },
  sigPretNom: { fontFamily: F.t800, fontSize: 14.5, color: '#4A2B00' },
  sigPretHint: { fontFamily: F.t700, fontSize: 10.5, color: '#7A4B05' },
  bancRang: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 8, flexWrap: 'wrap' },
  bancLabel: { fontFamily: F.t800, fontSize: 12.5, color: C.texte2 },
  bancChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.carte,
    borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1.5, borderColor: C.bord,
  },
  bancChipArme: { borderColor: C.violet, borderWidth: 2, backgroundColor: '#E9E2F7' },
  bancChipNom: { fontFamily: F.t700, fontSize: 12.5, color: C.texte },
  bancAv: { fontFamily: F.t800, fontSize: 12 },
  gardeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#E9E2F7', borderRadius: R.pill, paddingVertical: 6, paddingHorizontal: 12,
    borderWidth: 1, borderColor: C.violetClair,
  },
  gardeBtnTxt: { fontFamily: F.t800, fontSize: 11.5, color: C.violet },
  sacBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.violet, borderRadius: R.pill, paddingVertical: 6, paddingHorizontal: 14,
  },
  sacBtnArme: { backgroundColor: C.violetProfond, borderWidth: 2, borderColor: C.jaune },
  sacBtnTxt: { fontFamily: F.t800, fontSize: 12.5, color: '#fff' },
  sacCarte: { backgroundColor: C.carte, borderRadius: 24, padding: 20, gap: 10, alignSelf: 'stretch', borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE },
  sacAide: { fontFamily: F.t600, fontSize: 12, color: C.texte2, textAlign: 'center' },
  sacVide: { fontFamily: F.t700, fontSize: 12.5, color: C.violet, textAlign: 'center', lineHeight: 18 },
  sacLigne: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.fond,
    borderRadius: 14, padding: 12,
  },
  sacNom: { fontFamily: F.t800, fontSize: 14, color: C.texte },
  sacDesc: { fontFamily: F.t600, fontSize: 11.5, color: C.texte2, marginTop: 1 },
  sacCout: { fontFamily: F.t800, fontSize: 12.5, color: C.violet },
  mutateurBanniere: {
    marginHorizontal: 18, marginTop: 4, marginBottom: 2, backgroundColor: '#FFF3D6',
    borderRadius: R.pill, paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: C.jaune,
  },
  mutateurTxt: { fontFamily: F.t800, fontSize: 12, color: '#9A6B00', textAlign: 'center' },
  mutateurRang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },

  modalFond: { flex: 1, backgroundColor: 'rgba(42,29,70,0.65)', alignItems: 'center', justifyContent: 'center', padding: 26 },
  modalCarte: { backgroundColor: C.carte, borderRadius: 24, padding: 24, alignItems: 'center', gap: 12, alignSelf: 'stretch', borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE },
  modalTitre: { fontFamily: F.titre, fontSize: 24, color: C.violet },
  modalTitreRang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  gainRang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' },
  modalTexte: { fontFamily: F.t400, fontSize: 13.5, color: C.texte2, textAlign: 'center', lineHeight: 20 },
  // 👹 Revanche : un bandeau de PALIER, jamais une ligne de gain.
  revanchePalier: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'center',
    backgroundColor: C.dangerPale, borderRadius: R.pill,
    borderWidth: 2, borderColor: C.danger, paddingVertical: 6, paddingHorizontal: 14,
  },
  revanchePalierTxt: { fontFamily: F.t800, fontSize: 14, color: C.danger },
  revancheNote: { fontFamily: F.t600, fontSize: 11.5, color: C.texte3, textAlign: 'center', lineHeight: 16 },
  ligneGain: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.vertPale, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14,
  },
  ligneGainTxt: { fontFamily: F.t800, fontSize: 15, color: C.vertFonce },
  capsuleGain: { fontFamily: F.t700, fontSize: 14, color: '#9A6B00', textAlign: 'center' },
  pcGain: { fontFamily: F.t800, fontSize: 13.5, textAlign: 'center' },
  championTxt: { fontFamily: F.titre, fontSize: 17, color: '#D2588A', textAlign: 'center' },
});
