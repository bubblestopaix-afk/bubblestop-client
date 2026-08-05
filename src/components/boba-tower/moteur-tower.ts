// === 🏗️ Boba Tower — « La tour vivante » : le MOTEUR pur ===
//
// Refonte v2 (verdict commanditaire : « assez ennuyeux et répétitif »).
// Trois réponses, et seulement trois — le reste est resté au placard :
//   1. LA LARGEUR EST LA BARRE DE VIE : chaque pose élargit ou rétrécit le
//      sommet (L). Les fenêtres de verdict SCALENT avec L : chaque erreur rend
//      la suivante plus probable — l'erreur a enfin une conséquence physique.
//      L < 22 u → la tour bascule. C'est la première morsure.
//   2. LE RATTRAPAGE : après un bancal/raté, la tour vacille 900 ms ; un 2e tap
//      au point d'équilibre récupère la MOITIÉ de la largeur perdue. Il sauve,
//      il ne paie pas (zéro point, zéro combo) — c'est une décision, pas une
//      rente. Jamais de double peine : un tap manqué n'aggrave rien.
//   3. LES ÉTAGES SANS FIN : 8 poses = un étage scellé (bonus dérivé de la
//      largeur préservée, ré-élargissement plafonné), et on continue. Plus de
//      « victoire » : la partie ne se termine QUE par bascule, et la hauteur
//      (l'étage atteint) devient le record star. Le facteur d'étage
//      (0,96^(étage−1), plancher 0,72) resserre les fenêtres avec l'altitude :
//      même une partie parfaite finit par se tendre.
//
// RÈGLES DE PURETÉ (identiques à moteur-shooter.ts, verrouillées par un test
// de source dans scripts/test-jeu.cjs) :
//   · zéro import — le moteur tourne tel quel sous Node, et Boba Quest ne peut
//     pas être dégradé par lui ;
//   · tout aléa passe par mulberry32 SEEDÉ (jamais Math.random) et ne sert qu'à
//     GÉNÉRER la partie (file d'ingrédients, défi du jour) — le gameplay est
//     100 % déterministe : mêmes taps ⇒ même partie, rejouable et testable ;
//   · jamais Date.now() : le temps est un PARAMÈTRE (tMs), mesuré par l'écran ;
//   · leçon « famille NaN » du projet : toute entrée non finie (seed, tMs) a un
//     repli propre — un NaN ne se propage JAMAIS (et ne « réussit » JAMAIS un
//     rattrapage).
//
// POURQUOI UNE ONDE TRIANGLE (et pas un sinus) : la vitesse est CONSTANTE, donc
//   · l'écran peut la rendre à 100 % en native driver (2 timings linéaires en
//     boucle) sans jamais dériver de la formule ;
//   · l'équité est lisible : chaque unité d'écart coûte le même temps de
//     réaction, où que soit l'ingrédient. Le marqueur du rattrapage suit le
//     même principe (triangle pur sur 900 ms, t0 partagé avec l'écran).

// ---------------------------------------------------------------------------
// Constantes de game design (chiffres du cadrage v2 — voir tests pour bornes)
// ---------------------------------------------------------------------------

/** Largeur logique du gobelet, en unités « u ». Tout le moteur raisonne en u ;
 *  l'écran convertit en pixels (u × échelle). */
export const LARGEUR_GOBELET = 100;
/** Largeur de pose initiale L0 (u) — c'est la barre de vie. */
export const LARGEUR_INITIALE = 56;
/** Plancher de mort : L STRICTEMENT sous ce seuil → bascule. */
export const LARGEUR_MORT = 22;
/** Δ largeur par verdict. Le parfait RÉPARE (plafonné à L0) ; le bien préserve ;
 *  le bancal/raté rétrécit — et comme les fenêtres scalent avec L, chaque
 *  erreur rend la suivante plus probable : la spirale se SENT. */
export const GAIN_PARFAIT = 4;
export const PERTE_BANCAL = 6;
export const PERTE_RATE = 12;

/** Demi-amplitude de l'oscillation : couvre le gobelet + 20 % (±60 u autour du
 *  centre) — l'ingrédient sort un peu des bords, sinon les bords seraient des
 *  zones « sûres » où se caler sans risque. */
export const AMPLITUDE_OSCILLATION = (LARGEUR_GOBELET * 1.2) / 2;
/** Période initiale de l'aller-retour (ms) — réglage nerveux v2. */
export const PERIODE_INITIALE = 1900;
/** Accélération : −8 % de période tous les POSES_PAR_PALIER ingrédients posés. */
export const ACCELERATION_PERIODE = 0.92;
export const POSES_PAR_PALIER = 3;
/** Plancher de la PROGRESSION (les modificateurs d'ingrédient/variante peuvent
 *  le percer : c'est leur raison d'être, ex. Fraise pressée). */
export const PERIODE_PLANCHER = 1050;

/** Fenêtres de verdict DE BASE, en u d'écart au point de visée (bornes
 *  INCLUSES). Les fenêtres EFFECTIVES scalent avec la largeur et l'étage :
 *  fenêtre × (L / L0) × facteurEtage(étage) × modificateurs. */
export const FENETRE_PARFAIT = 6;
export const FENETRE_BIEN = 16;
export const FENETRE_BANCAL = 26;
/** Resserrement par étage : 0,96^(étage−1), plancher 0,72. C'est LA garantie
 *  qu'un joueur parfait n'est pas immortel : même à L = L0, les fenêtres se
 *  tendent avec la hauteur. Le plancher évite l'injouable pur. */
export const FACTEUR_ETAGE = 0.96;
export const FACTEUR_ETAGE_PLANCHER = 0.72;

/** Rattrapage : après un bancal/raté (non mortel), la tour vacille pendant
 *  RATTRAPAGE_DUREE_MS. Le marqueur fait UN aller-retour (triangle pur) :
 *  écart 1 → 0 (équilibre, à mi-fenêtre) → 1. Un 2e tap à ±RATTRAPAGE_FENETRE_MS
 *  du point d'équilibre récupère la MOITIÉ de la largeur perdue. */
export const RATTRAPAGE_DUREE_MS = 900;
export const RATTRAPAGE_FENETRE_MS = 150;

/** Étages : 8 poses ACCEPTÉES scellent l'étage (couvercle). Bonus dérivé de la
 *  largeur PRÉSERVÉE (200 + 4 × L), +100 si étage sans-faute (aucun bancal/raté
 *  non rattrapé), puis L = min(L0, L + 10) : l'étage neuf redonne de l'air. */
export const POSES_PAR_ETAGE = 8;
export const BONUS_ETAGE_BASE = 200;
export const BONUS_ETAGE_PAR_LARGEUR = 4;
export const BONUS_ETAGE_SANS_FAUTE = 100;
export const RELARGISSEMENT_ETAGE = 10;

/** Dérive du centre du sommet au-delà de laquelle la tour bascule (u) — le
 *  2e axe de mort, lisible à l'écran (inclinaison). */
export const DERIVE_MAX = 20;
/** Poids « mémoire » de la dérive : le sommet est une moyenne pondérée des poses
 *  où chaque pose passée pèse λ fois moins que la suivante. λ = 0,8 ⇒ le sommet
 *  reflète surtout les ~5 dernières poses — c'est LUI que le joueur vise, et
 *  c'est lui que l'écran incline (la dérive doit se VOIR venir). */
export const LAMBDA_DERIVE = 0.8;
/** Poids du socle (le gobelet lui-même) dans la moyenne : sans lui, une première
 *  pose bancale à +18 u ferait basculer une tour… d'UN ingrédient. Le socle pèse
 *  comme ~2 poses parfaites au départ, puis s'estompe (× λ à chaque pose). */
export const POIDS_SOCLE = 2;

/** Score d'une pose : (50 + round((1 − offset/fenêtre bancale EFFECTIVE) × 50))
 *  × multiplicateur de combo × multiplicateur d'ingrédient. On normalise par la
 *  fenêtre EFFECTIVE : même précision RELATIVE ⇒ même base ∈ [50..100], que la
 *  tour soit large ou étranglée. Inchangé de la v1 — la refonte ne touche pas
 *  au prix d'une pose, elle touche à ses CONSÉQUENCES. */
export const SCORE_BASE = 50;
export const COMBO_PAS = 0.25;
export const COMBO_PLAFOND = 8;

/** Probabilité de tirer un spécial (quand le précédent n'en est pas un).
 *  0,5 avec l'interdiction de doublon ⇒ densité stationnaire 0,5/1,5 = 1/3,
 *  soit « 1 sur 3 » sans jamais deux de suite (réglage nerveux v2). */
export const PROBA_SPECIAL = 0.5;

/** Variante Vent : le point de visée dérive lentement de ± cette amplitude (u). */
export const VENT_AMPLITUDE = 5;
export const VENT_PERIODE = 6000;

/** Graine de repli quand l'appelant fournit un seed non fini (leçon NaN). */
export const GRAINE_REPLI = 123456789;

// ---------------------------------------------------------------------------
// RNG déterministe — mulberry32 (même famille que moteur-shooter/economie,
// recopié localement : le moteur n'importe RIEN de Boba Quest, par contrat).
// ---------------------------------------------------------------------------

export type Rng = () => number;

export function mulberry32(graine: number): Rng {
  let a = (Number.isFinite(graine) ? Math.floor(graine) : GRAINE_REPLI) >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash FNV-1a d'une chaîne → graine 32 bits (défi/objectifs du jour : la DATE
// est la seule source d'aléa, donc tout le monde a le même défi le même jour).
function hacherChaine(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Registre des ingrédients — id/nom/emoji/largeur/comportement.
// Les COULEURS restent côté écran : le moteur ne connaît pas la charte.
// ---------------------------------------------------------------------------

export type IngredientId =
  | 'perle' | 'the' | 'lait' | 'gelee' | 'litchi'          // classiques
  | 'glacon' | 'popping' | 'fraise' | 'mini' | 'mousse';   // spéciaux

export type Ingredient = {
  id: IngredientId;
  nom: string;
  emoji: string;
  /** Largeur visuelle de la couche (u) — purement cosmétique, les fenêtres de
   *  verdict n'en dépendent pas (équité : même cible pour tous). */
  largeur: number;
  special: boolean;
  /** Multiplicateur de période d'oscillation (glaçon lent, fraise rapide). */
  facteurPeriode: number;
  /** Multiplicateur des fenêtres de verdict (mini-perle plus exigeante). */
  facteurFenetres: number;
  /** Multiplicateur de points (fraise ×2, mini ×1,5). */
  facteurPoints: number;
  /** Multiplicateur d'offset EFFECTIF (popping rebondit vers le centre : ×0,55). */
  facteurOffset: number;
  /** Glissement post-pose vers l'extérieur (mousse : +6 u). */
  glisse: number;
  /** Multiplicateur de la PERTE DE LARGEUR d'un bancal (glaçon : ×2 → −12 u).
   *  Traduction v2 du « secoue deux fois plus » : l'instabilité comptable a
   *  disparu, la punition passe par la largeur — la seule monnaie qui reste. */
  malusBancal: number;
  /** Le POURQUOI joueur, en une phrase (affiché par l'écran). */
  comportement: string;
};

const ING = (
  id: IngredientId, nom: string, emoji: string, largeur: number, special: boolean,
  extra: Partial<Ingredient>, comportement: string,
): Ingredient => ({
  id, nom, emoji, largeur, special,
  facteurPeriode: 1, facteurFenetres: 1, facteurPoints: 1, facteurOffset: 1,
  glisse: 0, malusBancal: 1, comportement, ...extra,
});

export const INGREDIENTS: Record<IngredientId, Ingredient> = {
  // — classiques : même comportement, couleurs/formes différentes à l'écran —
  perle:  ING('perle', 'Perles de tapioca', '🧋', 62, false, {}, 'La base de toute tour.'),
  the:    ING('the', 'Thé noir infusé', '🍵', 66, false, {}, 'Se pose sans surprise.'),
  lait:   ING('lait', 'Lait onctueux', '🥛', 64, false, {}, 'Se pose sans surprise.'),
  gelee:  ING('gelee', 'Gelée matcha', '🍀', 60, false, {}, 'Se pose sans surprise.'),
  litchi: ING('litchi', 'Litchi confit', '🍬', 58, false, {}, 'Se pose sans surprise.'),
  // — spéciaux (1 sur 3, jamais deux de suite) —
  glacon: ING('glacon', 'Glaçon', '🧊', 62, true,
    { facteurPeriode: 1.35, malusBancal: 2 },
    'Lent à viser… mais un bancal étrangle deux fois plus la tour.'),
  popping: ING('popping', 'Perle popping', '🫧', 56, true,
    { facteurOffset: 0.55 },
    'Rebondit vers le centre : pardonne les à-peu-près.'),
  fraise: ING('fraise', 'Fraise pressée', '🍓', 58, true,
    { facteurPeriode: 0.65, facteurPoints: 2 },
    'File à toute vitesse — points doublés.'),
  mini: ING('mini', 'Mini-perle', '🌙', 42, true,
    { facteurFenetres: 0.7, facteurPoints: 1.5 },
    'Toute petite : fenêtres réduites, points ×1,5.'),
  mousse: ING('mousse', 'Mousse de lait', '🍮', 60, true,
    { glisse: 6 },
    'Glisse vers l’extérieur après la pose : punit le tout-juste.'),
};

export const CLASSIQUES: IngredientId[] = ['perle', 'the', 'lait', 'gelee', 'litchi'];
export const SPECIAUX: IngredientId[] = ['glacon', 'popping', 'fraise', 'mini', 'mousse'];

// ---------------------------------------------------------------------------
// Variantes (défi du jour)
// ---------------------------------------------------------------------------

export type VarianteId = 'vent' | 'presse' | 'etroit' | 'minis' | 'glacons';

export type Variante = {
  id: VarianteId;
  nom: string;
  emoji: string;
  description: string;
  facteurPeriode: number;
  facteurFenetres: number;
};

export const VARIANTES: Record<VarianteId, Variante> = {
  vent: {
    id: 'vent', nom: 'Vent de taro', emoji: '🌬️',
    description: 'Le point de visée dérive lentement — suis le repère !',
    facteurPeriode: 1, facteurFenetres: 1,
  },
  presse: {
    id: 'presse', nom: 'Service pressé', emoji: '⏩',
    description: 'Tout va 25 % plus vite. Respire, puis tape.',
    facteurPeriode: 0.75, facteurFenetres: 1,
  },
  etroit: {
    id: 'etroit', nom: 'Gobelet étroit', emoji: '🥤',
    description: 'Fenêtres réduites de 20 % : la précision paie.',
    facteurPeriode: 1, facteurFenetres: 0.8,
  },
  minis: {
    id: 'minis', nom: 'Pluie de minis', emoji: '🌙',
    description: 'Une mini-perle sur deux : petites cibles, gros points.',
    facteurPeriode: 1, facteurFenetres: 1,
  },
  glacons: {
    id: 'glacons', nom: 'Tout-glaçon', emoji: '🧊',
    description: 'Que des glaçons : lents, lourds… impitoyables.',
    facteurPeriode: 1, facteurFenetres: 1,
  },
};

const ORDRE_VARIANTES: VarianteId[] = ['vent', 'presse', 'etroit', 'minis', 'glacons'];

// ---------------------------------------------------------------------------
// État d'une partie
// ---------------------------------------------------------------------------

export type VerdictPose = 'parfait' | 'bien' | 'bancal' | 'rate';

export type PoseFaite = {
  ingredient: IngredientId;
  /** Position posée finale (u, 0 = centre du gobelet), glissement mousse inclus. */
  x: number;
  offset: number;
  verdict: VerdictPose;
};

/** Fenêtre de rattrapage en attente (au plus une, consommée au 1er appel). */
export type RattrapageEnCours = {
  /** Largeur perdue par la faute (6, 12 avec glaçon, 12 pour un raté). */
  perdu: number;
  verdictOrigine: 'bancal' | 'rate';
};

export type EtatTower = {
  seed: number;
  variante: VarianteId | null;
  /** File d'ingrédients GÉNÉRÉE AU FIL DE L'EAU (partie sans fin) : chaque
   *  indice est tiré d'un flux seedé indépendant — déterministe, sans borne.
   *  Un RATÉ ne consomme PAS l'ingrédient : la punition passe par la largeur. */
  file: IngredientId[];
  /** Poses ACCEPTÉES au total (pointeur de file + horloge d'accélération). */
  indice: number;
  /** LA BARRE DE VIE : largeur du sommet (u). Bornée par L0, morte sous 22. */
  largeur: number;
  /** Étage COURANT (1 = premier). L'étage atteint est le record star. */
  etage: number;
  /** Poses acceptées dans l'étage courant (0..POSES_PAR_ETAGE−1). */
  posesEtage: number;
  /** Bancals/ratés NON rattrapés de l'étage courant (0 au scellement = +100). */
  fautesEtage: number;
  etagesSansFaute: number;
  /** Poses de l'étage COURANT (affichage écran) — vidées au scellement. */
  poses: PoseFaite[];
  score: number;
  combo: number;
  meilleurCombo: number;
  /** Rattrapages RÉUSSIS (stat de fin + objectifs). */
  rattrapages: number;
  /** Fenêtre de rattrapage ouverte (null sinon). Tant qu'elle est ouverte,
   *  l'ingrédient suivant n'apparaît pas (contrat écran) ; un lacher() reçu
   *  malgré tout la résout d'abord comme MANQUÉE (jamais deux fenêtres). */
  rattrapage: RattrapageEnCours | null;
  /** Scellement en attente : la 8e pose était un bancal — le couvercle attend
   *  l'issue du rattrapage (le verdict rattrapé compte comme BIEN pour le
   *  sans-faute d'étage, donc AVANT de juger l'étage). */
  scellementDiffere: boolean;
  /** Centre du sommet (u) = moyenne pondérée des poses (λ + socle). C'est le
   *  point de visée du prochain ingrédient ET l'inclinaison de l'écran. */
  derive: number;
  // internes de la moyenne pondérée (mise à jour incrémentale)
  sommeDerive: number;
  poidsDerive: number;
  parfaits: number;
  biens: number;
  bancals: number;
  rates: number;
  finie: boolean;
  /** Toujours vraie à la fin : la SEULE façon de finir est de basculer. */
  basculee: boolean;
  raisonBascule: 'largeur' | 'derive' | null;
};

/** Détail d'un étage scellé (à animer : couvercle qui claque + bonus flottant). */
export type Scellement = {
  /** Numéro de l'étage scellé (l'étage courant devient etage + 1). */
  etage: number;
  /** 200 + 4 × L, calculé sur la largeur PRÉSERVÉE (avant ré-élargissement). */
  bonus: number;
  bonusSansFaute: number;
  sansFaute: boolean;
  /** Largeur après le ré-élargissement min(L0, L + 10). */
  largeurApres: number;
};

export type EvtPose = {
  verdict: VerdictPose;
  ingredient: IngredientId;
  /** Indice de file concerné (avant avancement). */
  indice: number;
  /** Position finale (u). Pour un raté : là où il tombe À CÔTÉ (à animer). */
  x: number;
  /** Offset signé EFFECTIF (après rebond popping) — négatif = à gauche. */
  offsetSigne: number;
  offset: number;
  points: number;
  score: number;
  combo: number;
  multCombo: number;
  /** Largeur APRÈS l'évènement complet (pose + scellement immédiat éventuel). */
  largeur: number;
  derive: number;
  /** Étage courant APRÈS l'évènement (déjà incrémenté si scellement immédiat). */
  etage: number;
  posesEtage: number;
  /** Effet spécial réellement APPLIQUÉ à cette pose (l'écran l'anime). */
  effet: 'popping' | 'mousse' | 'glacon' | null;
  /** Glissement mousse appliqué (±6 u), 0 sinon. */
  glisse: number;
  /** Fenêtre de rattrapage OUVERTE par cette pose (bancal/raté non mortel).
   *  L'écran joue le vacillement et attend rattraper() ou la fin de fenêtre. */
  rattrapage: { dureeMs: number; perdu: number } | null;
  /** Étage scellé PAR CETTE POSE (8e pose parfaite/bien — le cas bancal passe
   *  par le rattrapage : scellement rendu par rattraper()). */
  scellement: Scellement | null;
  fini: boolean;
  basculee: boolean;
  raisonBascule: 'largeur' | 'derive' | null;
  /** Prochain ingrédient à faire osciller (null si partie finie). Si un
   *  rattrapage est ouvert, il ne doit apparaître qu'APRÈS la fenêtre. */
  suivant: IngredientId | null;
};

/** Retour de rattraper() — le rattrapage SAUVE (largeur), il ne PAIE pas :
 *  aucun point, aucun combo. Le scellement différé éventuel est rendu ici. */
export type ResultatRattrapage = {
  reussi: boolean;
  largeurRecuperee: number;
  /** Largeur après résolution (récupération + ré-élargissement éventuels). */
  largeur: number;
  scellement: Scellement | null;
};

// ---------------------------------------------------------------------------
// Création de partie + file d'ingrédients sans fin
// ---------------------------------------------------------------------------

/** Ingrédient n° `indice` d'une partie : flux seedé PAR INDICE (seed ⊕ mélange
 *  de l'indice) — déterministe et sans borne, contrairement à une recette
 *  fermée. L'interdiction « jamais deux spéciaux de suite » lit le précédent. */
function tirerIngredient(
  seed: number, indice: number, precedent: IngredientId | null, variante: VarianteId | null,
): IngredientId {
  const rng = mulberry32((seed ^ Math.imul(indice + 1, 0x9E3779B9)) >>> 0);
  if (variante === 'glacons') return 'glacon';
  if (variante === 'minis') {
    // La pluie EST le thème : les minis échappent à l'interdiction de doublon
    // (sinon « une mini sur deux » serait mathématiquement inatteignable).
    return rng() < 0.5 ? 'mini' : CLASSIQUES[Math.floor(rng() * CLASSIQUES.length)];
  }
  const precedentSpecial = precedent !== null && INGREDIENTS[precedent].special;
  if (!precedentSpecial && rng() < PROBA_SPECIAL) {
    return SPECIAUX[Math.floor(rng() * SPECIAUX.length)];
  }
  return CLASSIQUES[Math.floor(rng() * CLASSIQUES.length)];
}

// Garantit file[indice] (l'ingrédient courant) — appelée après chaque avancée.
function etendreFile(etat: EtatTower): void {
  while (etat.file.length <= etat.indice) {
    const precedent = etat.file.length > 0 ? etat.file[etat.file.length - 1] : null;
    etat.file.push(tirerIngredient(etat.seed, etat.file.length, precedent, etat.variante));
  }
}

export function creerPartie(seed: number, variante?: VarianteId | null): EtatTower {
  const graine = Number.isFinite(seed) ? Math.floor(seed) : GRAINE_REPLI;
  const v: VarianteId | null = variante && VARIANTES[variante] ? variante : null;
  const etat: EtatTower = {
    seed: graine,
    variante: v,
    file: [],
    indice: 0,
    largeur: LARGEUR_INITIALE,
    etage: 1,
    posesEtage: 0,
    fautesEtage: 0,
    etagesSansFaute: 0,
    poses: [],
    score: 0,
    combo: 0,
    meilleurCombo: 0,
    rattrapages: 0,
    rattrapage: null,
    scellementDiffere: false,
    derive: 0,
    sommeDerive: 0,
    poidsDerive: POIDS_SOCLE,
    parfaits: 0, biens: 0, bancals: 0, rates: 0,
    finie: false, basculee: false, raisonBascule: null,
  };
  etendreFile(etat);
  return etat;
}

// ---------------------------------------------------------------------------
// Oscillation — l'onde triangle PURE
// ---------------------------------------------------------------------------

/** Ingrédient en cours d'oscillation (null si la partie est finie). */
export function ingredientCourant(etat: EtatTower): Ingredient | null {
  if (etat.finie) return null;
  const id = etat.file[etat.indice];
  return id ? INGREDIENTS[id] : null;
}

/** Période d'oscillation de l'ingrédient COURANT (ms). Le plancher borne la
 *  progression (paliers de −8 % tous les 3 posés) ; les facteurs d'ingrédient
 *  et de variante s'appliquent APRÈS et peuvent le percer (Fraise pressée). */
export function periodeIngredient(etat: EtatTower): number {
  const palier = Math.floor(etat.indice / POSES_PAR_PALIER);
  const base = Math.max(PERIODE_PLANCHER, PERIODE_INITIALE * Math.pow(ACCELERATION_PERIODE, palier));
  const ing = ingredientCourant(etat);
  const fVariante = etat.variante ? VARIANTES[etat.variante].facteurPeriode : 1;
  return base * (ing ? ing.facteurPeriode : 1) * fVariante;
}

// Onde triangle « centrée » dans [−1, 1] : part de 0 en montant, +1 au quart de
// période, 0 à la moitié, −1 aux trois quarts. Sert au Vent (départ neutre).
function triangleCentre(t: number, periode: number): number {
  const phase = ((t % periode) + periode) % periode / periode;
  if (phase < 0.25) return 4 * phase;
  if (phase < 0.75) return 2 - 4 * phase;
  return 4 * phase - 4;
}

/** Position (u, 0 = centre du gobelet) de l'ingrédient courant à l'instant tMs
 *  — tMs est mesuré DEPUIS LE DÉBUT DE LA POSE EN COURS (l'écran redémarre son
 *  animation ET son chrono à chaque pose : t0 partagé, aucune dérive possible).
 *  Onde triangle : part du bord GAUCHE (−amplitude), vitesse constante.
 *  t = période/4 ⇒ pile au centre. Entrée non finie ⇒ repli t = 0. */
export function positionIngredient(etat: EtatTower, tMs: number): number {
  if (etat.finie) return 0;
  const t = Number.isFinite(tMs) ? tMs : 0;
  const p = periodeIngredient(etat);
  const phase = ((t % p) + p) % p / p;
  const a = AMPLITUDE_OSCILLATION;
  return phase < 0.5 ? -a + 4 * a * phase : 3 * a - 4 * a * phase;
}

/** Point de visée à l'instant tMs : le centre du sommet (dérive), plus le
 *  souffle du Vent en variante 🌬️ (même base de temps que l'oscillation). */
export function cibleVisee(etat: EtatTower, tMs: number): number {
  const t = Number.isFinite(tMs) ? tMs : 0;
  const vent = etat.variante === 'vent' ? VENT_AMPLITUDE * triangleCentre(t, VENT_PERIODE) : 0;
  return etat.derive + vent;
}

/** Inverse du triangle : premier instant t ≥ apresMs où l'ingrédient courant
 *  passe par xVoulu. Sert aux tests et aux bots (jamais à l'écran : le joueur
 *  fournit t, pas x). xVoulu est borné à l'amplitude. */
export function tPourPosition(etat: EtatTower, xVoulu: number, apresMs = 0): number {
  const p = periodeIngredient(etat);
  const a = AMPLITUDE_OSCILLATION;
  const x = Math.max(-a, Math.min(a, Number.isFinite(xVoulu) ? xVoulu : 0));
  const apres = Number.isFinite(apresMs) && apresMs > 0 ? apresMs : 0;
  const tMontee = (p * (x + a)) / (4 * a);        // segment montant [0, p/2]
  const tDescente = (p * (3 * a - x)) / (4 * a);  // segment descendant [p/2, p]
  for (let k = Math.floor(apres / p); ; k++) {
    for (const t of [k * p + tMontee, k * p + tDescente]) {
      if (t >= apres) return t;
    }
  }
}

/** Écart du marqueur de rattrapage au point d'équilibre, à tMs de l'ouverture
 *  de la fenêtre : triangle pur 1 → 0 (équilibre, à mi-fenêtre) → 1. L'écran
 *  l'anime en natif (2 timings linéaires, t0 partagé — même principe que
 *  l'oscillation) ; la réussite se juge en TEMPS (±150 ms), soit un écart
 *  marqueur ≤ 150/450 = 1/3 : le visuel et la règle coïncident exactement. */
export function marqueurRattrapage(tMs: number): number {
  const demi = RATTRAPAGE_DUREE_MS / 2;
  const t = Number.isFinite(tMs) ? Math.max(0, Math.min(RATTRAPAGE_DUREE_MS, tMs)) : 0;
  return Math.abs(demi - t) / demi;
}

// ---------------------------------------------------------------------------
// Fenêtres vivantes et verdict
// ---------------------------------------------------------------------------

/** Resserrement des fenêtres par étage : 0,96^(étage−1), plancher 0,72.
 *  Entrée non finie ou < 1 → étage 1 (facteur 1), jamais un NaN. */
export function facteurEtage(etage: number): number {
  const e = Number.isFinite(etage) && etage >= 1 ? Math.floor(etage) : 1;
  return Math.max(FACTEUR_ETAGE_PLANCHER, Math.pow(FACTEUR_ETAGE, e - 1));
}

/** Facteur de fenêtres COMPLET de l'état courant : (L / L0) × facteurEtage ×
 *  ingrédient (mini ×0,7) × variante (étroit ×0,8). C'est LA tour vivante :
 *  chaque erreur (L↓) et chaque étage gagné resserrent le verdict suivant. */
export function facteurFenetresCourant(etat: EtatTower): number {
  const ing = ingredientCourant(etat);
  const fVariante = etat.variante ? VARIANTES[etat.variante].facteurFenetres : 1;
  return (etat.largeur / LARGEUR_INITIALE) * facteurEtage(etat.etage)
    * (ing ? ing.facteurFenetres : 1) * fVariante;
}

/** Les trois fenêtres EFFECTIVES (u) du prochain lâcher — pour les tests et
 *  les bots ; l'écran, lui, montre la largeur (les parois) et non des chiffres. */
export function fenetresCourantes(etat: EtatTower): { parfait: number; bien: number; bancal: number } {
  const f = facteurFenetresCourant(etat);
  return { parfait: FENETRE_PARFAIT * f, bien: FENETRE_BIEN * f, bancal: FENETRE_BANCAL * f };
}

/** Verdict pour un offset ABSOLU donné, fenêtres multipliées par `facteur`
 *  (largeur × étage × ingrédient × variante — cumulés par l'appelant). Bornes
 *  INCLUSES : offset = fenêtre est encore dedans. Exportée seule pour des
 *  tests aux bornes exactes, sans passer par l'inversion du triangle. */
export function verdictDeOffset(offset: number, facteur = 1): VerdictPose {
  if (!Number.isFinite(offset)) return 'rate'; // repli NaN : jamais un faux parfait
  const f = Number.isFinite(facteur) && facteur > 0 ? facteur : 1;
  const o = Math.abs(offset);
  if (o <= FENETRE_PARFAIT * f) return 'parfait';
  if (o <= FENETRE_BIEN * f) return 'bien';
  if (o <= FENETRE_BANCAL * f) return 'bancal';
  return 'rate';
}

// ---------------------------------------------------------------------------
// Pose, scellement, rattrapage
// ---------------------------------------------------------------------------

// Événement neutre pour un appel sur partie finie : on ne mute rien, on redit
// simplement l'état final (l'écran n'appelle normalement plus lacher() ici).
function evtPartieFinie(etat: EtatTower): EvtPose {
  return {
    verdict: 'rate', ingredient: etat.file[etat.file.length - 1] ?? 'perle',
    indice: etat.indice, x: etat.derive, offsetSigne: 0, offset: 0,
    points: 0, score: etat.score, combo: etat.combo,
    multCombo: 1 + COMBO_PAS * Math.min(etat.combo, COMBO_PLAFOND),
    largeur: etat.largeur, derive: etat.derive,
    etage: etat.etage, posesEtage: etat.posesEtage,
    effet: null, glisse: 0, rattrapage: null, scellement: null,
    fini: true, basculee: etat.basculee, raisonBascule: null, suivant: null,
  };
}

function basculer(etat: EtatTower, raison: 'largeur' | 'derive'): void {
  etat.finie = true;
  etat.basculee = true;
  etat.raisonBascule = raison;
  etat.rattrapage = null;          // morte : plus rien à rattraper
  etat.scellementDiffere = false;
}

/** Scelle l'étage courant : bonus dérivé de la largeur PRÉSERVÉE, +100 si
 *  sans-faute, puis ré-élargissement plafonné et compteurs remis pour l'étage
 *  neuf. Les poses affichées sont vidées (le couvercle « absorbe » l'étage). */
function sceller(etat: EtatTower): Scellement {
  const sansFaute = etat.fautesEtage === 0;
  const bonus = BONUS_ETAGE_BASE + BONUS_ETAGE_PAR_LARGEUR * etat.largeur;
  const bonusSansFaute = sansFaute ? BONUS_ETAGE_SANS_FAUTE : 0;
  etat.score += bonus + bonusSansFaute;
  if (sansFaute) etat.etagesSansFaute += 1;
  const scelle = etat.etage;
  etat.etage += 1;
  etat.posesEtage = 0;
  etat.fautesEtage = 0;
  etat.poses = [];
  etat.largeur = Math.min(LARGEUR_INITIALE, etat.largeur + RELARGISSEMENT_ETAGE);
  return { etage: scelle, bonus, bonusSansFaute, sansFaute, largeurApres: etat.largeur };
}

// Résout la fenêtre ouverte (réussie ou non), PUIS le scellement différé.
// Ordre voulu : la récupération de largeur se fait AVANT le bonus d'étage
// (200 + 4 × L récompense la largeur préservée, rattrapage compris) et
// l'annulation de faute AVANT le jugement sans-faute de l'étage.
function resoudreRattrapage(etat: EtatTower, reussi: boolean): ResultatRattrapage {
  const r = etat.rattrapage as RattrapageEnCours; // l'appelant a vérifié non-null
  etat.rattrapage = null;
  let recup = 0;
  if (reussi) {
    recup = r.perdu / 2;
    etat.largeur = Math.min(LARGEUR_INITIALE, etat.largeur + recup);
    etat.rattrapages += 1;
    // Le verdict comptabilisé pour le sans-faute d'étage devient BIEN : la
    // faute est effacée du compteur d'étage (le combo, lui, RESTE cassé).
    etat.fautesEtage = Math.max(0, etat.fautesEtage - 1);
  }
  let scellement: Scellement | null = null;
  if (etat.scellementDiffere) {
    etat.scellementDiffere = false;
    scellement = sceller(etat);
  }
  return { reussi, largeurRecuperee: recup, largeur: etat.largeur, scellement };
}

/** LE 2e battement du jeu : pendant le vacillement (fenêtre RATTRAPAGE_DUREE_MS
 *  ouverte par un bancal/raté non mortel), un 2e tap à tMs de l'OUVERTURE.
 *  Réussi si |tMs − 450| ≤ 150 (le point d'équilibre du marqueur) : récupère
 *  la MOITIÉ de la largeur perdue et efface la faute du sans-faute d'étage.
 *  Manqué (ou tMs non fini — un NaN ne réussit jamais) : rien de pire, mais la
 *  tentative est CONSOMMÉE — un seul rattrapage par pose. Sans fenêtre ouverte :
 *  aucun effet, aucune mutation. L'écran appelle aussi rattraper() à
 *  l'expiration (tMs hors fenêtre) pour résoudre un éventuel scellement différé. */
export function rattraper(etat: EtatTower, tMs: number): ResultatRattrapage {
  if (etat.finie || !etat.rattrapage) {
    return { reussi: false, largeurRecuperee: 0, largeur: etat.largeur, scellement: null };
  }
  const t = Number.isFinite(tMs) ? tMs : -1; // repli : hors fenêtre, jamais un faux succès
  const reussi = Math.abs(t - RATTRAPAGE_DUREE_MS / 2) <= RATTRAPAGE_FENETRE_MS;
  return resoudreRattrapage(etat, reussi);
}

/** LE geste du jeu : lâcher l'ingrédient à l'instant tMs (mesuré côté écran
 *  depuis le début de la pose). Mute `etat` et retourne TOUT ce que l'écran
 *  doit animer. Ordre des vérités, et pourquoi :
 *    1. largeur < 22 → bascule (la barre de vie est à zéro : mort immédiate,
 *       PAS de rattrapage in extremis — le vacillement stabilise une tour
 *       debout, il ne ressuscite pas) ;
 *    2. sinon |dérive| > 20 → bascule (le 2e axe, lisible à l'inclinaison) ;
 *    3. sinon bancal/raté → fenêtre de rattrapage (et scellement DIFFÉRÉ si la
 *       8e pose de l'étage est un bancal : le couvercle attend le verdict).
 *  Une fenêtre laissée ouverte par l'appelant est d'abord résolue MANQUÉE :
 *  jamais deux fenêtres, jamais de double peine. */
export function lacher(etat: EtatTower, tMs: number): EvtPose {
  if (etat.finie) return evtPartieFinie(etat);
  if (etat.rattrapage) resoudreRattrapage(etat, false);
  const t = Number.isFinite(tMs) ? tMs : 0;
  const indice = etat.indice;
  const ing = INGREDIENTS[etat.file[indice]];

  const x = positionIngredient(etat, t);
  const cible = cibleVisee(etat, t);
  // Popping : l'ingrédient REBONDIT vers le point de visée — l'offset effectif
  // (verdict, points ET position finale) est réduit à 55 %.
  const offsetSigne = (x - cible) * ing.facteurOffset;
  const offset = Math.abs(offsetSigne);
  const fFen = facteurFenetresCourant(etat); // fenêtres de CE lâcher (avant Δ largeur)
  const verdict = verdictDeOffset(offset, fFen);

  let effet: EvtPose['effet'] = ing.facteurOffset < 1 ? 'popping' : null;

  if (verdict === 'rate') {
    // Tombe à côté : PAS posé, la file ne progresse pas — la punition est
    // PHYSIQUE : la tour s'étrangle de 12 u (et le combo meurt).
    etat.rates += 1;
    etat.combo = 0;
    etat.fautesEtage += 1;
    etat.largeur -= PERTE_RATE;
    let rattrapage: EvtPose['rattrapage'] = null;
    if (etat.largeur < LARGEUR_MORT) {
      basculer(etat, 'largeur');
    } else {
      etat.rattrapage = { perdu: PERTE_RATE, verdictOrigine: 'rate' };
      rattrapage = { dureeMs: RATTRAPAGE_DUREE_MS, perdu: PERTE_RATE };
    }
    return {
      verdict, ingredient: ing.id, indice,
      x: cible + offsetSigne, offsetSigne, offset,
      points: 0, score: etat.score, combo: 0, multCombo: 1,
      largeur: etat.largeur, derive: etat.derive,
      etage: etat.etage, posesEtage: etat.posesEtage,
      effet, glisse: 0, rattrapage, scellement: null,
      fini: etat.finie, basculee: etat.basculee, raisonBascule: etat.raisonBascule,
      suivant: etat.finie ? null : etat.file[etat.indice],
    };
  }

  // — pose acceptée —
  let xPose = cible + offsetSigne;
  let glisse = 0;
  if (ing.glisse > 0) {
    // Mousse : glisse vers l'EXTÉRIEUR du sommet après la pose. Pile au centre ?
    // Elle penche du côté où la tour penche déjà (le côté « lourd » — physique).
    const sens = offsetSigne !== 0 ? Math.sign(offsetSigne) : (etat.derive >= 0 ? 1 : -1);
    glisse = sens * ing.glisse;
    xPose += glisse;
    effet = 'mousse';
  }

  etat.poses.push({ ingredient: ing.id, x: xPose, offset, verdict });
  // dérive incrémentale : moyenne pondérée (λ) + socle qui s'estompe
  etat.sommeDerive = etat.sommeDerive * LAMBDA_DERIVE + xPose;
  etat.poidsDerive = etat.poidsDerive * LAMBDA_DERIVE + 1;
  etat.derive = etat.sommeDerive / etat.poidsDerive;

  let perte = 0;
  if (verdict === 'parfait') {
    etat.parfaits += 1;
    etat.combo += 1;
    etat.largeur = Math.min(LARGEUR_INITIALE, etat.largeur + GAIN_PARFAIT); // la tour RESPIRE
  } else if (verdict === 'bien') {
    etat.biens += 1;            // le combo est CONSERVÉ, pas incrémenté
  } else {
    etat.bancals += 1;
    etat.combo = 0;
    etat.fautesEtage += 1;
    perte = PERTE_BANCAL * ing.malusBancal; // glaçon : ×2 — la tour s'étrangle double
    etat.largeur -= perte;
    if (ing.malusBancal > 1) effet = 'glacon';   // le glaçon a « mordu »
  }
  etat.meilleurCombo = Math.max(etat.meilleurCombo, etat.combo);

  // Points : le combo s'applique APRÈS incrément — le parfait qui monte le combo
  // en profite tout de suite (récompense immédiate), et un BIEN en plein combo
  // garde le multiplicateur acquis.
  const multCombo = 1 + COMBO_PAS * Math.min(etat.combo, COMBO_PLAFOND);
  const base = SCORE_BASE + Math.round((1 - offset / (FENETRE_BANCAL * fFen)) * SCORE_BASE);
  const points = Math.round(base * ing.facteurPoints * multCombo);
  etat.score += points;
  etat.indice += 1;
  etat.posesEtage += 1;
  etendreFile(etat);

  let scellement: Scellement | null = null;
  let rattrapage: EvtPose['rattrapage'] = null;
  if (etat.largeur < LARGEUR_MORT) {
    // Mort par largeur d'abord : la barre de vie prime (elle est ce qu'on voit).
    basculer(etat, 'largeur');
  } else if (Math.abs(etat.derive) > DERIVE_MAX) {
    basculer(etat, 'derive');
  } else if (verdict === 'bancal') {
    etat.rattrapage = { perdu: perte, verdictOrigine: 'bancal' };
    rattrapage = { dureeMs: RATTRAPAGE_DUREE_MS, perdu: perte };
    // 8e pose bancale : le couvercle ATTEND l'issue du rattrapage (le verdict
    // rattrapé compte comme BIEN pour le sans-faute — il faut juger APRÈS).
    if (etat.posesEtage >= POSES_PAR_ETAGE) etat.scellementDiffere = true;
  } else if (etat.posesEtage >= POSES_PAR_ETAGE) {
    scellement = sceller(etat);
  }

  return {
    verdict, ingredient: ing.id, indice,
    x: xPose, offsetSigne, offset,
    points, score: etat.score, combo: etat.combo, multCombo,
    largeur: etat.largeur, derive: etat.derive,
    etage: etat.etage, posesEtage: etat.posesEtage,
    effet, glisse, rattrapage, scellement,
    fini: etat.finie, basculee: etat.basculee, raisonBascule: etat.raisonBascule,
    suivant: etat.finie ? null : etat.file[etat.indice],
  };
}

// ---------------------------------------------------------------------------
// Résultat de partie + objectifs
// ---------------------------------------------------------------------------

export type ResultatPartie = {
  score: number;
  /** Étage ATTEINT (courant à la bascule) — LA hauteur, le record star. */
  etages: number;
  /** Poses acceptées au total (les ratés tombent à côté, ils ne comptent pas). */
  poses: number;
  meilleurCombo: number;
  rattrapages: number;
  parfaits: number;
  biens: number;
  bancals: number;
  rates: number;
  etagesSansFaute: number;
  basculee: boolean;
  raisonBascule: 'largeur' | 'derive' | null;
};

export function resultatDe(etat: EtatTower): ResultatPartie {
  return {
    score: etat.score, etages: etat.etage, poses: etat.indice,
    meilleurCombo: etat.meilleurCombo, rattrapages: etat.rattrapages,
    parfaits: etat.parfaits, biens: etat.biens, bancals: etat.bancals, rates: etat.rates,
    etagesSansFaute: etat.etagesSansFaute,
    basculee: etat.basculee, raisonBascule: etat.raisonBascule,
  };
}

export type Objectif = {
  id: string;
  type: 'parfaits' | 'score' | 'combo' | 'etage' | 'rattrapages' | 'etage_sans_faute' | 'poses';
  cible: number;
  libelle: string;
};

// Pool fixe : les libellés sont la SEULE source affichée (pas de reformulation
// côté écran). Étendu v2 : hauteur, rattrapages et étage sans-faute — les
// nouveaux verbes du jeu deviennent des raisons de relancer une partie.
const POOL_OBJECTIFS: Objectif[] = [
  { id: 'parfaits-5', type: 'parfaits', cible: 5, libelle: '5 poses parfaites' },
  { id: 'parfaits-10', type: 'parfaits', cible: 10, libelle: '10 poses parfaites' },
  { id: 'score-1500', type: 'score', cible: 1500, libelle: 'Atteindre 1 500 points' },
  { id: 'score-2500', type: 'score', cible: 2500, libelle: 'Atteindre 2 500 points' },
  { id: 'combo-4', type: 'combo', cible: 4, libelle: 'Un combo de 4 parfaits' },
  { id: 'combo-6', type: 'combo', cible: 6, libelle: 'Un combo de 6 parfaits' },
  { id: 'etage-2', type: 'etage', cible: 2, libelle: 'Atteindre l’étage 2' },
  { id: 'etage-3', type: 'etage', cible: 3, libelle: 'Atteindre l’étage 3' },
  { id: 'rattrapages-2', type: 'rattrapages', cible: 2, libelle: 'Réussir 2 rattrapages' },
  { id: 'etage-sans-faute', type: 'etage_sans_faute', cible: 1, libelle: 'Sceller un étage sans faute' },
  { id: 'poses-12', type: 'poses', cible: 12, libelle: 'Poser 12 ingrédients' },
];

// Date attendue : 'YYYY-MM-DD'. Une chaîne invalide retombe sur un jour fixe —
// le défi reste valide et déterministe, jamais un NaN dans la graine.
function jourSur(dateISO: string): string {
  return typeof dateISO === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateISO)
    ? dateISO.slice(0, 10)
    : '1970-01-01';
}

export type Defi = {
  date: string;
  variante: VarianteId;
  nom: string;
  emoji: string;
  description: string;
  /** Graine de la partie du jour : la MÊME pour tout le monde (comparable). */
  seed: number;
};

/** Défi du jour : variante + graine dérivées de la date (mulberry32 sur un hash
 *  de la date). Même date ⇒ même défi, pour tous les joueurs, hors-ligne. */
export function defiDuJour(dateISO: string): Defi {
  const date = jourSur(dateISO);
  const rng = mulberry32(hacherChaine('tower-defi:' + date));
  const variante = ORDRE_VARIANTES[Math.floor(rng() * ORDRE_VARIANTES.length)];
  const v = VARIANTES[variante];
  return {
    date, variante, nom: v.nom, emoji: v.emoji, description: v.description,
    seed: Math.floor(rng() * 4294967296),
  };
}

/** 3 objectifs du jour, tirés du pool au seed de la date (flux séparé du défi :
 *  changer le pool ne change pas la variante du jour, et inversement). Jamais
 *  deux objectifs du même TYPE le même jour : « étage 2 » + « étage 3 » ferait
 *  un objectif fantôme (réussir le second englobe le premier). */
export function objectifsDuJour(dateISO: string): Objectif[] {
  const rng = mulberry32(hacherChaine('tower-objectifs:' + jourSur(dateISO)));
  let pioche = [...POOL_OBJECTIFS];
  const choisis: Objectif[] = [];
  for (let i = 0; i < 3 && pioche.length > 0; i++) {
    const choisi = pioche.splice(Math.floor(rng() * pioche.length), 1)[0];
    choisis.push(choisi);
    pioche = pioche.filter((o) => o.type !== choisi.type);
  }
  return choisis;
}

/** Évaluation PURE d'objectifs sur un résultat (une case par objectif, dans
 *  l'ordre). Type inconnu (pool plus récent) ⇒ false, jamais un crash. */
export function evaluerObjectifs(res: ResultatPartie, objs: Objectif[]): boolean[] {
  return objs.map((o) => {
    switch (o.type) {
      case 'parfaits': return res.parfaits >= o.cible;
      case 'score': return res.score >= o.cible;
      case 'combo': return res.meilleurCombo >= o.cible;
      case 'etage': return res.etages >= o.cible;
      case 'rattrapages': return res.rattrapages >= o.cible;
      case 'etage_sans_faute': return res.etagesSansFaute >= o.cible;
      case 'poses': return res.poses >= o.cible;
      default: return false;
    }
  });
}

// ---------------------------------------------------------------------------
// Série de jours joués — SANS malus : un oubli repart à 1, aucun reproche.
// ---------------------------------------------------------------------------

export type Serie = { jours: number; dernierJour: string };

function veilleDe(jourISO: string): string {
  const [a, m, j] = jourISO.split('-').map((n) => parseInt(n, 10));
  const d = new Date(Date.UTC(a, m - 1, j));
  if (!Number.isFinite(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Série après une partie jouée le jour `jourISO` (heure locale, fournie par
 *  l'écran — le moteur ne lit jamais l'horloge). Même jour : inchangée ;
 *  lendemain : +1 ; sinon : repart à 1. */
export function majSerie(serie: Serie | null | undefined, jourISO: string): Serie {
  const jour = jourSur(jourISO);
  const jours = serie && Number.isFinite(serie.jours) ? Math.max(0, Math.floor(serie.jours)) : 0;
  const dernier = serie && typeof serie.dernierJour === 'string' ? serie.dernierJour : '';
  if (dernier === jour && jours > 0) return { jours, dernierJour: jour };
  if (dernier === veilleDe(jour) && jours > 0) return { jours: jours + 1, dernierJour: jour };
  return { jours: 1, dernierJour: jour };
}
