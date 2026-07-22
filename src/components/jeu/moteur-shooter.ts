// === Boba Quest — moteur du bubble shooter (logique PURE, zéro dépendance RN) ===
// Grille hexagonale « offset » : chaque ligne est décalée ou non d'une demi-case.
// Toutes les positions sont exprimées en UNITÉS de diamètre de perle (D = 1) :
// l'écran multiplie simplement par le diamètre en pixels. Testé sous Node.
//
// Deux modes :
// • INFINI  — plateau qui se régénère, descente périodique, AUCUNE capsule.
// • AVENTURE — niveaux déterministes : des CAPSULES sont accrochées dans le
//   plateau. Elles ne matchent jamais : il faut couper les perles qui les
//   retiennent pour qu'elles TOMBENT, avec un nombre de tirs limité.
//
// Twists de tir :
// • CHAÎNE : matchs consécutifs → multiplicateur ×1 → ×2 → ×3 (raté = reset).
// • REBOND : un match après rebond sur un mur = points ×1,5.
// • SPÉCIALES : 'bombe' (explose une zone) et 'arc' (adopte la couleur du
//   meilleur groupe voisin — match garanti). Achetées avec des perles.

export const COLS = 8;                    // perles par ligne
export const LIGNE_LIMITE = 10;           // une perle qui atteint cette ligne = perdu
export const LIGNES_DEPART = 4;           // lignes au lancement (mode infini)
export const RAYON = 0.5;                 // rayon d'une perle (D = 1)
export const LIGNE_H = 0.866;             // hauteur d'une ligne hex (√3/2)
export const LARGEUR_TERRAIN = COLS + 0.5; // les lignes décalées débordent d'une demi-case
export const CHAINE_MAX = 3;              // multiplicateur maxi
export const BONUS_REBOND = 1.5;          // multiplicateur d'un match après rebond
export const RAYON_BOMBE = 2.2;           // rayon d'explosion (en unités, ~7-10 perles en plein plateau)
export const FEVER_MAX = 5;                // matchs nécessaires pour charger le Shaker Fever
export const TIR_PARFAIT_SEUIL = 0.88;     // tension minimale du lance-pierre (0..1)

export type Couleur = 0 | 1 | 2 | 3 | 4 | 5;
export type Special = 'bombe' | 'arc'; // munitions spéciales (achetées)
export type PouvoirFever = 'fruit' | 'milk' | 'topping' | 'signature' | 'neutre';
export type BossActionTir = 'givre' | 'descente' | 'verrou-swap';

// Perles SPÉCIALES posées sur le plateau (transforment chaque niveau en puzzle) :
//  glacon = bloc qui ne se matche pas, à faire tomber ou détruire ;
//  bombe  = explose ses voisines quand une perle éclate à côté (réactions en chaîne) ;
//  givre  = perle colorée sous givre : 2 coups avant d'éclater ;
//  arc    = joker : rejoint n'importe quelle couleur ;
//  bonus  = perle étoilée : +points quand elle éclate.
// 'etoile' = SUPERNOVA : éclatée → toutes les perles de SA couleur partent avec elle.
// 'tir' = perle-cadeau : éclatée ou tombée → +1 tir (mode aventure uniquement).
export type SpecialBulle = 'glacon' | 'bombe' | 'givre' | 'arc' | 'bonus' | 'etoile' | 'tir';
export type Bulle = {
  couleur: Couleur;
  capsule?: boolean;         // capsule → couleur ignorée (objectif à libérer)
  special?: SpecialBulle;
  pv?: number;               // givre : 2 → 1 → éclatée
};
export type Ligne = { decalee: boolean; cases: (Bulle | null)[] };

// Objectif d'un niveau (ce qu'il faut accomplir pour gagner)
export type Objectif =
  | { type: 'capsules' }                             // libérer toutes les capsules
  | { type: 'tomber'; cible: number }                // faire tomber N perles
  | { type: 'nettoyer' }                             // vider le plateau
  | { type: 'couleur'; couleur: Couleur; cible: number } // éclater N perles d'une couleur
  | { type: 'boss'; pv: number }                     // 👹 vider les PV du boss en éclatant
  | { type: 'score' };                               // infini (aucune fin)

export const BONUS_POINTS = 40;   // points d'une perle bonus éclatée
export const EXPLO_POINTS = 40;   // points d'une détonation de bombe-plateau
export const GROS_LACHER = 8;     // ≥ N perles tombées d'un coup = « ÉNORME »
export type Case = { r: number; c: number };
export type Point = { x: number; y: number };

export type EtatShooter = {
  grille: Ligne[];
  score: number;
  tirs: number;                 // tirs depuis la dernière descente
  tirsParDescente: number;      // 0 = pas de descente
  tirsRestants: number | null;  // null = illimité (infini)
  regenerer: boolean;           // plateau vidé → replateau (infini)
  couleursPool: Couleur[];      // couleurs utilisées par la génération
  chaine: number;               // matchs consécutifs (multiplicateur)
  graceChaine: number;          // « copain de tir » Signature : ratés pardonnés
  couleurCourante: Couleur;
  couleurSuivante: Couleur;
  capsulesLiberees: number;     // capsules tombées sur la partie
  detruites: number;            // perles éclatées + tombées
  perdu: boolean;
  plateauxVides: number;        // plateaux entièrement nettoyés (bonus)
  objectif: Objectif;           // but du niveau
  objProgres: number;           // avancement vers l'objectif (tomber/couleur)
  specialsAuto: boolean;        // semer bonus/bombes au fil du jeu (infini)
  tirsMax: number | null;       // budget initial du niveau (aventure) — null en infini
  rush: RushEtat | null;        // 🔥 mini-objectif surprise de mi-niveau (aventure)
  fever: number;                // 0..FEVER_MAX, pouvoir du copain prêt au maximum
  swapBloqueTirs: number;       // boss : échange courant/suivant temporairement verrouillé
  bossPhase: 1 | 2 | 3;         // boss Aventure : cadence plus agressive selon ses PV
  bossCompteur: number;         // tirs depuis la dernière attaque/interruption du boss
  bossActionIndex: number;      // rotation déterministe des attaques du boss
  bossProchaineAction: BossActionTir;
};

// 🔥 RUSH : à mi-niveau, défi éclair « éclate N perles <couleur> en 3 tirs »
// → réussi = +150 points et +2 tirs. Déclenché une seule fois par niveau.
export type RushEtat = {
  couleur: Couleur;
  cible: number;
  progres: number;
  tirsFenetre: number;                    // tirs restants pour réussir
  statut: 'active' | 'reussi' | 'rate';
};
export const RUSH_POINTS = 150;
export const RUSH_TIRS_BONUS = 2;

// Résolution d'un tir : tout ce qu'il faut pour animer côté UI.
export type ResultatTir = {
  trajectoire: Point[];         // polyligne du projectile (origine → impact)
  pose: Case | null;            // case de pose (null pour une bombe)
  eclatees: { pos: Case; bulle: Bulle }[]; // éclatées (groupe ou explosion)
  tombees: { pos: Case; bulle: Bulle }[];  // orphelines tombées
  capsules: number;             // capsules libérées sur CE tir
  points: number;               // points gagnés sur CE tir
  multiplicateur: number;       // multiplicateur de chaîne appliqué
  rebond: boolean;              // match réussi après rebond sur un mur
  groupe: number;               // taille du groupe éclaté (défis)
  nouvelleLigne: boolean;       // une ligne est apparue en haut après ce tir
  plateauNettoye: boolean;      // plateau vidé
  perdu: boolean;
  explosions: number;           // bombes-plateau détonées ce tir
  bonusPop: number;             // perles bonus éclatées ce tir
  grosLacher: number;           // nb de perles tombées d'un coup (≥ GROS_LACHER = « ÉNORME »)
  objectifAtteint: boolean;     // le niveau est gagné après ce tir
  tirParfait: boolean;          // tension maximale + impact utile
  feverGagne: number;           // progression gagnée sur ce tir
  bossAction: BossActionTir | null;
  bossInterrompu: boolean;
  etoiles: number;              // 🌟 SUPERNOVA déclenchées ce tir
  tirsBonus: number;            // 🎁 perles « +1 tir » encaissées ce tir
  tirEnOr: boolean;             // 🏅 c'était le DERNIER tir → points ×2 si utile
  rushDebut: boolean;           // 🔥 le RUSH vient de se déclencher
  rushFin: 'reussi' | 'rate' | null; // 🔥 issue du RUSH sur ce tir
};

export type ApercuTir = {
  pose: Case | null;
  eclatees: number;
  tombees: number;
  capsules: number;
};

export type Rng = () => number;

// RNG déterministe (tests + niveaux) — mulberry32
export function creerRng(graine: number): Rng {
  let a = graine >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Géométrie -------------------------------------------------------------

export function centreCase(r: number, c: number, decalee: boolean): Point {
  return { x: c + RAYON + (decalee ? RAYON : 0), y: r * LIGNE_H + RAYON };
}

// Voisins hexagonaux d'une case (lignes adjacentes = décalage opposé)
export function voisins(grille: Ligne[], r: number, c: number): Case[] {
  const res: Case[] = [];
  const ligne = grille[r];
  if (!ligne) return res;
  const dec = ligne.decalee;
  if (c > 0) res.push({ r, c: c - 1 });
  if (c < COLS - 1) res.push({ r, c: c + 1 });
  for (const dr of [-1, 1]) {
    const r2 = r + dr;
    if (r2 < 0 || r2 >= grille.length) continue;
    const cands = dec ? [c, c + 1] : [c - 1, c];
    for (const c2 of cands) {
      if (c2 >= 0 && c2 < COLS) res.push({ r: r2, c: c2 });
    }
  }
  return res;
}

function bulleEn(grille: Ligne[], r: number, c: number): Bulle | null {
  return grille[r]?.cases[c] ?? null;
}

// Capsules encore accrochées au plateau
export function nbCapsules(grille: Ligne[]): number {
  let n = 0;
  for (const l of grille) for (const b of l.cases) if (b?.capsule) n++;
  return n;
}

// Un BLOC ne se matche jamais par la couleur (capsule, glaçon)
function estBloc(b: Bulle | null): boolean {
  return !!b && (b.capsule === true || b.special === 'glacon');
}

// Couleurs encore présentes (les munitions s'y limitent) — blocs & arcs exclus
export function couleursPresentes(grille: Ligne[]): Couleur[] {
  const s = new Set<Couleur>();
  for (const l of grille) for (const b of l.cases) if (b && !estBloc(b) && b.special !== 'arc') s.add(b.couleur);
  return [...s].sort((a, b) => a - b);
}

// --- Objectifs -----------------------------------------------------------------

export function objectifCible(o: Objectif): number {
  if (o.type === 'tomber' || o.type === 'couleur') return o.cible;
  if (o.type === 'boss') return o.pv;
  return 1;
}

// Le niveau est-il gagné ?
export function objectifAtteint(etat: EtatShooter): boolean {
  const o = etat.objectif;
  // En Aventure, nettoyer entièrement le plateau est toujours une victoire :
  // il ne doit jamais rester une partie impossible avec un objectif chiffré
  // incomplet (ex. 7/15 perles tombées alors qu'il n'y a plus rien à tirer).
  // L'Infini est exclu : son plateau vide est régénéré pour continuer la partie.
  if (!etat.regenerer && o.type !== 'score' && plateauEstVide(etat.grille)) return true;
  switch (o.type) {
    case 'score': return false;                             // infini : jamais
    case 'capsules': return nbCapsules(etat.grille) === 0;  // toutes libérées
    case 'nettoyer': return etat.grille.every((l) => l.cases.every((b) => !b));
    case 'tomber':
    case 'couleur': return etat.objProgres >= o.cible;
    case 'boss': return etat.objProgres >= o.pv;            // 👹 PV du boss vidés
  }
}

// Libellé court de l'objectif (HUD)
export function objectifLabel(o: Objectif, couleurNom?: (c: Couleur) => string): string {
  switch (o.type) {
    case 'score': return 'Fais le meilleur score';
    case 'capsules': return 'Libère les capsules';
    case 'nettoyer': return 'Vide tout le plateau';
    case 'tomber': return `Détache ${o.cible} perles`;
    case 'couleur': return `Éclate ${o.cible} perles ${couleurNom ? couleurNom(o.couleur) : ''}`.trim();
    case 'boss': return 'Vaincs le boss 👹';
  }
}

// Aide contextuelle affichée quand la partie approche de sa fin. Elle explique
// surtout le VERBE de l'objectif (tomber ≠ éclater) au moment où il reste encore
// assez de temps pour corriger sa stratégie.
export function alerteObjectif(
  etat: EtatShooter,
  couleurNom?: (c: Couleur) => string,
): string | null {
  const o = etat.objectif;
  if (o.type === 'score' || objectifAtteint(etat)) return null;

  let elementsRestants = 0;
  for (const ligne of etat.grille) for (const b of ligne.cases) if (b) elementsRestants++;
  const peuDeTirs = etat.tirsRestants !== null && etat.tirsRestants <= 5;
  const plateauPresqueVide = !etat.regenerer && elementsRestants <= 10;
  if (!peuDeTirs && !plateauPresqueVide) return null;

  switch (o.type) {
    case 'capsules': {
      const restant = nbCapsules(etat.grille);
      return `Encore ${restant} capsule${restant > 1 ? 's' : ''} à LIBÉRER — coupe les perles qui ${restant > 1 ? 'les retiennent' : 'la retiennent'} au plafond.`;
    }
    case 'nettoyer':
      return `Encore ${elementsRestants} perle${elementsRestants > 1 ? 's' : ''} sur le plateau — enlève-les toutes.`;
    case 'tomber': {
      const restant = Math.max(0, o.cible - etat.objProgres);
      return `Encore ${restant} perle${restant > 1 ? 's' : ''} à faire TOMBER — coupe leur attache au plafond, ne les éclate pas.`;
    }
    case 'couleur': {
      const restant = Math.max(0, o.cible - etat.objProgres);
      const nom = couleurNom ? ` ${couleurNom(o.couleur)}` : '';
      return `Encore ${restant} perle${restant > 1 ? 's' : ''}${nom} à ÉCLATER — forme des groupes d'au moins 3.`;
    }
    case 'boss': {
      const restant = Math.max(0, o.pv - etat.objProgres);
      return `Encore ${restant} PV au boss — vise de gros groupes et les rebonds.`;
    }
  }
}

// --- Génération ------------------------------------------------------------

function couleurAleatoire(rng: Rng, pool: Couleur[]): Couleur {
  return pool[Math.floor(rng() * pool.length)];
}

// Ligne SANS capsule (les capsules sont posées par le générateur de niveau)
function genererLigne(decalee: boolean, pool: Couleur[], rng: Rng): Ligne {
  const cases: (Bulle | null)[] = [];
  for (let c = 0; c < COLS; c++) cases.push({ couleur: couleurAleatoire(rng, pool) });
  return { decalee, cases };
}

// Semis léger de perles spéciales (mode INFINI) : un peu de piment au fil du jeu
function semerSpeciales(ligne: Ligne, rng: Rng) {
  for (const b of ligne.cases) {
    if (!b || b.special || b.capsule) continue;
    const t = rng();
    if (t < 0.03) b.special = 'bombe';
    else if (t < 0.08) b.special = 'bonus';
  }
}

// Mode INFINI : 5 couleurs, pas de capsule, descente tous les 6 tirs, régénération,
// avec un semis léger de bombes/bonus pour le piment.
export function creerPartieInfini(rng: Rng = Math.random): EtatShooter {
  const pool: Couleur[] = [0, 1, 2, 3, 4];
  const grille: Ligne[] = [];
  for (let r = 0; r < LIGNES_DEPART; r++) {
    const ligne = genererLigne(r % 2 === 1, pool, rng);
    if (r >= 1) semerSpeciales(ligne, rng); // jamais ligne 0 (bombe au plafond = piège)
    grille.push(ligne);
  }
  return {
    grille,
    score: 0,
    tirs: 0,
    tirsParDescente: 6,
    tirsRestants: null,
    tirsMax: null,
    rush: null,
    regenerer: true,
    couleursPool: pool,
    chaine: 0,
    graceChaine: 0,
    couleurCourante: couleurAleatoire(rng, pool),
    couleurSuivante: couleurAleatoire(rng, pool),
    capsulesLiberees: 0,
    detruites: 0,
    perdu: false,
    plateauxVides: 0,
    objectif: { type: 'score' },
    objProgres: 0,
    specialsAuto: true,
    fever: 0,
    swapBloqueTirs: 0,
    bossPhase: 1,
    bossCompteur: 0,
    bossActionIndex: 0,
    bossProchaineAction: 'givre',
  };
}

// --- Niveaux (mode AVENTURE) --------------------------------------------------

export type ParamsNiveau = {
  niveau: number;
  boss: boolean;          // tous les 5 niveaux → capsule dorée
  lignes: number;
  nbCouleurs: number;     // 4 → 6 selon la difficulté
  nbCapsules: number;
  tirsMax: number;
  tirsParDescente: number; // 0 = pas de descente
  objectif: Objectif;
  nbGlacons: number;
  nbBombes: number;
  nbGivre: number;
  nbArc: number;
  nbBonus: number;
  nbEtoiles: number;      // 🌟 SUPERNOVA (rare : la cible prioritaire du plateau)
  nbTirsPlus: number;     // 🎁 perles « +1 tir »
};

// L'objectif tourne selon le niveau, en introduisant les buts progressivement.
function objectifNiveau(n: number, nbCouleurs: number): Objectif {
  if (n <= 2) return { type: 'capsules' };
  if (n % 5 === 0) return { type: 'boss', pv: 26 + n * 4 }; // 👹 niveaux boss (tous les 5)
  switch (n % 4) {
    case 1: return { type: 'capsules' };
    // Une chute ne compte QUE les perles détachées du plafond, pas les groupes
    // éclatés. Le vieux 12 + n/2 demandait 15 chutes dès le niveau 6 sur un
    // plateau de 28 perles : possible en théorie, mais contraire à la silhouette
    // et incompréhensible en jeu. Cible courte, progressive et plafonnée.
    case 2: return { type: 'tomber', cible: Math.min(12, 6 + Math.floor(n / 3)) };
    case 3: return { type: 'couleur', couleur: (n % nbCouleurs) as Couleur, cible: 10 + Math.floor(n / 3) };
    default: return { type: 'nettoyer' };
  }
}

export function paramsNiveau(n: number): ParamsNiveau {
  const boss = n % 5 === 0;
  const lignes = Math.min(4 + Math.floor((n - 1) / 4), 7);
  const nbCouleurs = n <= 3 ? 4 : n <= 9 ? 5 : 6;
  const objectif = objectifNiveau(n, nbCouleurs);
  // capsules uniquement quand c'est l'objectif
  const nbCapsules = objectif.type === 'capsules'
    ? Math.min(1 + Math.floor((n - 1) / 6), 3) + (boss ? 1 : 0)
    : 0;
  // ⏱️ Rythme resserré (Shooter v2, 19/07/2026) : 25 tirs de base au lieu de 28 —
  // chaque tir compte, les perles « +1 tir » et le RUSH rendent le budget vivant.
  const tirsMax = 25 - Math.min(12, Math.floor(n / 2)) + nbCapsules * 4
    + (objectif.type === 'tomber' || objectif.type === 'nettoyer' ? 6 : 0)
    + (objectif.type === 'boss' ? 12 : 0);
  const tirsParDescente = n <= 6 ? 0 : n <= 14 ? 8 : 6;
  // perles spéciales, introduites progressivement
  const nbGlacons = objectif.type === 'nettoyer' ? 0 : n >= 4 ? Math.min(1 + Math.floor((n - 4) / 3), 4) : 0;
  const nbBombes = n >= 6 ? Math.min(1 + Math.floor((n - 6) / 4), 3) : 0;
  const nbGivre = n >= 8 ? Math.min(1 + Math.floor((n - 8) / 4), 3) : 0;
  const nbArc = n >= 5 && n % 3 === 0 ? 1 : 0;
  const nbBonus = n >= 3 ? Math.min(1 + Math.floor((n - 3) / 3), 3) : 0;
  const nbEtoiles = n >= 6 && n % 2 === 0 ? 1 : 0;       // 🌟 un niveau sur deux dès le 6
  const nbTirsPlus = n >= 5 ? Math.min(1 + Math.floor((n - 5) / 6), 2) : 0; // 🎁
  return {
    niveau: n, boss, lignes, nbCouleurs, nbCapsules, tirsMax, tirsParDescente,
    objectif, nbGlacons, nbBombes, nbGivre, nbArc, nbBonus, nbEtoiles, nbTirsPlus,
  };
}

// Douze silhouettes récurrentes donnent une identité aux plateaux : ponts,
// tunnels, grappes et arches. La difficulté continue d'être pilotée par
// paramsNiveau ; les lignes supplémentaires des niveaux avancés restent générées.
const MOTIFS_PLATEAU: string[][] = [
  ['########', '###..###', '##....##', '.##..##.'],
  ['########', '.######.', '..####..', '...##...'],
  ['########', '##.##.##', '.######.', '##....##'],
  ['########', '#.#..#.#', '########', '.##..##.'],
  ['########', '###..###', '.######.', '##.##.##', '..####..'],
  ['########', '##....##', '###..###', '.######.', '..####..'],
  ['########', '.##..##.', '########', '##....##', '.######.'],
  ['########', '####....', '.######.', '....####', '..####..'],
  ['########', '#.####.#', '##....##', '.######.', '...##...'],
  ['########', '##.##.##', '###..###', '.##..##.', '########'],
  ['########', '.######.', '##.##.##', '###..###', '..####..'],
  ['########', '#..##..#', '##.##.##', '.######.', '##....##'],
];

function genererGrilleNiveau(p: ParamsNiveau, pool: Couleur[], rng: Rng): Ligne[] {
  const motif = MOTIFS_PLATEAU[(p.niveau - 1) % MOTIFS_PLATEAU.length];
  const grille: Ligne[] = [];
  for (let r = 0; r < p.lignes; r++) {
    const masque = motif[r];
    if (!masque) {
      grille.push(genererLigne(r % 2 === 1, pool, rng));
      continue;
    }
    grille.push({
      decalee: r % 2 === 1,
      cases: Array.from({ length: COLS }, (_, c) =>
        masque[c] === '#' ? { couleur: couleurAleatoire(rng, pool) } : null),
    });
  }
  return grille;
}

// Niveau DÉTERMINISTE : même numéro → même plateau pour tout le monde.
export function creerNiveau(n: number): EtatShooter {
  const p = paramsNiveau(n);
  const rng = creerRng(900913 + n * 7919);
  const pool = Array.from({ length: p.nbCouleurs }, (_, i) => i as Couleur);
  const grille = genererGrilleNiveau(p, pool, rng);

  // Capsules : jamais ligne 0 (une bulle du plafond ne peut pas tomber).
  // Débuts faciles = capsules en bord bas (on coupe au-dessus) ; ensuite de
  // plus en plus HAUTES (il faut creuser un tunnel jusqu'à leur soutien).
  const rMin = n <= 2 ? p.lignes - 1 : n <= 8 ? 2 : 1;
  const rMax = n <= 2 ? p.lignes - 1 : n <= 8 ? p.lignes - 1 : Math.min(2, p.lignes - 1);
  for (let i = 0; i < p.nbCapsules; i++) {
    const r = Math.max(1, rMin + Math.floor(rng() * (rMax - rMin + 1)));
    // colonnes réparties sur la largeur (± un cran de hasard)
    let c = Math.floor(((i + 0.5) * COLS) / p.nbCapsules + (rng() - 0.5) * 2);
    c = Math.max(0, Math.min(COLS - 1, c));
    // Avec les silhouettes ajourées, la capsule remplace toujours la perle
    // disponible la plus proche (jamais un trou isolé ni une capsule existante).
    const disponibles: Case[] = [];
    for (let rr = 1; rr < grille.length; rr++) for (let cc = 0; cc < COLS; cc++) {
      const b = grille[rr].cases[cc];
      if (b && !b.capsule) disponibles.push({ r: rr, c: cc });
    }
    disponibles.sort((a, b) =>
      (Math.abs(a.r - r) * COLS + Math.abs(a.c - c)) - (Math.abs(b.r - r) * COLS + Math.abs(b.c - c)));
    const choisie = disponibles[0];
    if (choisie) grille[choisie.r].cases[choisie.c] = { couleur: 0, capsule: true };
  }

  // --- Perles spéciales (déterministes) : on remplace des perles colorées ---
  // Pose une perle spéciale sur une case colorée libre (pas capsule / pas déjà spéciale).
  const poserSpecial = (rMin2: number, appliquer: (b: Bulle) => void) => {
    for (let essai = 0; essai < 40; essai++) {
      const r = rMin2 + Math.floor(rng() * (grille.length - rMin2));
      const c = Math.floor(rng() * COLS);
      const b = grille[r]?.cases[c];
      if (b && !b.capsule && !b.special) { appliquer(b); return; }
    }
  };
  for (let i = 0; i < p.nbGlacons; i++) poserSpecial(1, (b) => { b.special = 'glacon'; });
  for (let i = 0; i < p.nbBombes; i++) poserSpecial(0, (b) => { b.special = 'bombe'; });
  for (let i = 0; i < p.nbGivre; i++) poserSpecial(0, (b) => { b.special = 'givre'; b.pv = 2; });
  for (let i = 0; i < p.nbArc; i++) poserSpecial(0, (b) => { b.special = 'arc'; });
  for (let i = 0; i < p.nbBonus; i++) poserSpecial(0, (b) => { b.special = 'bonus'; });
  for (let i = 0; i < p.nbEtoiles; i++) poserSpecial(0, (b) => { b.special = 'etoile'; });
  for (let i = 0; i < p.nbTirsPlus; i++) poserSpecial(0, (b) => { b.special = 'tir'; });

  return {
    grille,
    score: 0,
    tirs: 0,
    tirsParDescente: p.tirsParDescente,
    tirsRestants: p.tirsMax,
    tirsMax: p.tirsMax,
    rush: null,
    regenerer: p.objectif.type === 'boss', // 👹 le boss : plateau qui se régénère (on cogne sans fin)
    couleursPool: pool,
    chaine: 0,
    graceChaine: 0,
    couleurCourante: couleurAleatoire(rng, pool),
    couleurSuivante: couleurAleatoire(rng, pool),
    capsulesLiberees: 0,
    detruites: 0,
    perdu: false,
    plateauxVides: 0,
    objectif: p.objectif,
    objProgres: 0,
    specialsAuto: false,
    fever: 0,
    swapBloqueTirs: 0,
    bossPhase: 1,
    bossCompteur: 0,
    bossActionIndex: 0,
    bossProchaineAction: 'givre',
  };
}

// --- Visée / trajectoire ----------------------------------------------------

// Simule le vol d'un projectile : rebonds sur les murs, arrêt au premier contact
// (perle existante ou plafond). Renvoie la polyligne + le point d'impact.
export function simulerVol(
  grille: Ligne[],
  origine: Point,
  angle: number, // radians, y vers le BAS (écran) : tirer vers le haut = angle négatif
  pas = 0.08,    // sous-pas fin pour ne pas « traverser » une perle (guide : 0.16 suffit)
): { points: Point[]; impact: Point } {
  const PAS = pas;
  let x = origine.x, y = origine.y;
  let vx = Math.cos(angle) * PAS, vy = Math.sin(angle) * PAS;
  const points: Point[] = [{ x, y }];

  const occupees: { x: number; y: number }[] = [];
  for (let r = 0; r < grille.length; r++) {
    for (let c = 0; c < COLS; c++) {
      const b = grille[r].cases[c];
      if (b) occupees.push(centreCase(r, c, grille[r].decalee));
    }
  }

  for (let i = 0; i < 6000; i++) {
    x += vx; y += vy;
    if (x < RAYON) { x = RAYON + (RAYON - x); vx = -vx; points.push({ x, y }); }
    else if (x > LARGEUR_TERRAIN - RAYON) { x = (LARGEUR_TERRAIN - RAYON) - (x - (LARGEUR_TERRAIN - RAYON)); vx = -vx; points.push({ x, y }); }
    if (y <= RAYON) { y = RAYON; break; }
    let touche = false;
    for (const o of occupees) {
      const dx = x - o.x, dy = y - o.y;
      if (dx * dx + dy * dy < 0.87 * 0.87) { touche = true; break; }
    }
    if (touche) break;
  }
  points.push({ x, y });
  return { points, impact: { x, y } };
}

// Case libre la plus proche du point d'impact, connectée au plateau.
export function casePourImpact(grille: Ligne[], impact: Point): Case {
  const rApprox = Math.max(0, Math.round((impact.y - RAYON) / LIGNE_H));
  while (grille.length <= rApprox + 1) {
    grille.push({
      decalee: grille.length ? !grille[grille.length - 1].decalee : false,
      cases: Array(COLS).fill(null),
    });
  }
  let meilleure: Case | null = null;
  let meilleureDist = Infinity;
  let secours: Case | null = null;
  let secoursDist = Infinity;
  for (let r = Math.max(0, rApprox - 2); r <= rApprox + 1 && r < grille.length; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grille[r].cases[c]) continue;
      const p = centreCase(r, c, grille[r].decalee);
      const dx = p.x - impact.x, dy = p.y - impact.y;
      const d = dx * dx + dy * dy;
      const connectee = r === 0 || voisins(grille, r, c).some((v) => !!bulleEn(grille, v.r, v.c));
      if (connectee && d < meilleureDist) { meilleureDist = d; meilleure = { r, c }; }
      if (d < secoursDist) { secoursDist = d; secours = { r, c }; }
    }
  }
  return (meilleure ?? secours)!;
}

// --- Groupes / orphelines -----------------------------------------------------

// Groupe connecté de même couleur contenant la case. Les BLOCS (capsule, glaçon)
// ne matchent jamais ; une perle ARC-EN-CIEL est un JOKER qui rejoint le groupe.
export function groupeMemeCouleur(grille: Ligne[], depart: Case): Case[] {
  const cible = bulleEn(grille, depart.r, depart.c);
  if (!cible || estBloc(cible)) return [];
  const refCoul = cible.couleur; // la perle posée a une vraie couleur
  const vu = new Set<string>([`${depart.r}:${depart.c}`]);
  const file: Case[] = [depart];
  const groupe: Case[] = [];
  while (file.length) {
    const cur = file.pop()!;
    groupe.push(cur);
    for (const v of voisins(grille, cur.r, cur.c)) {
      const cle = `${v.r}:${v.c}`;
      if (vu.has(cle)) continue;
      const b = bulleEn(grille, v.r, v.c);
      if (b && !estBloc(b) && (b.couleur === refCoul || b.special === 'arc')) { vu.add(cle); file.push(v); }
    }
  }
  return groupe;
}

// Perles non reliées au plafond (elles tombent) — capsules comprises.
export function orphelines(grille: Ligne[]): Case[] {
  const vu = new Set<string>();
  const file: Case[] = [];
  for (let c = 0; c < COLS; c++) {
    if (grille[0]?.cases[c]) { vu.add(`0:${c}`); file.push({ r: 0, c }); }
  }
  while (file.length) {
    const cur = file.pop()!;
    for (const v of voisins(grille, cur.r, cur.c)) {
      const cle = `${v.r}:${v.c}`;
      if (vu.has(cle) || !bulleEn(grille, v.r, v.c)) continue;
      vu.add(cle);
      file.push(v);
    }
  }
  const res: Case[] = [];
  for (let r = 0; r < grille.length; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grille[r].cases[c] && !vu.has(`${r}:${c}`)) res.push({ r, c });
    }
  }
  return res;
}

function retirerLignesVidesEnBas(grille: Ligne[]) {
  while (grille.length && grille[grille.length - 1].cases.every((b) => !b)) grille.pop();
}

function plateauEstVide(grille: Ligne[]): boolean {
  return grille.every((l) => l.cases.every((b) => !b));
}

export function ligneLaPlusBasse(grille: Ligne[]): number {
  for (let r = grille.length - 1; r >= 0; r--) {
    if (grille[r].cases.some((b) => !!b)) return r;
  }
  return -1;
}

export function labelBossActionTir(action: BossActionTir): string {
  switch (action) {
    case 'givre': return 'Souffle givré';
    case 'descente': return 'Pluie de perles';
    case 'verrou-swap': return 'Brouilleur de couleurs';
  }
}

// Active le pouvoir chargé par les matchs. Les pouvoirs offensifs renvoient une
// munition de Fever : l'écran l'arme sans toucher au stock acheté du joueur.
export function activerFever(etat: EtatShooter, pouvoir: PouvoirFever): { active: boolean; special: Special | null; label: string } {
  if (etat.fever < FEVER_MAX) return { active: false, special: null, label: '' };
  etat.fever = 0;
  if (pouvoir === 'milk') {
    if (etat.tirsParDescente > 0) etat.tirs = Math.max(0, etat.tirs - 2);
    else if (etat.tirsRestants !== null) etat.tirsRestants += 1;
    return { active: true, special: null, label: etat.tirsParDescente > 0 ? 'Descente retardée de 2 tirs !' : '+1 tir !' };
  }
  if (pouvoir === 'topping') {
    return { active: true, special: 'bombe', label: 'Mini-bombe offerte !' };
  }
  if (pouvoir === 'signature') {
    etat.graceChaine += 1;
    return { active: true, special: 'arc', label: 'Arc-en-ciel + chaîne protégée !' };
  }

  const compte = new Map<Couleur, number>();
  for (const ligne of etat.grille) for (const b of ligne.cases) {
    if (b && !estBloc(b) && b.special !== 'arc') compte.set(b.couleur, (compte.get(b.couleur) ?? 0) + 1);
  }
  const dominante = [...compte.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (dominante !== undefined) {
    etat.couleurCourante = dominante;
    etat.couleurSuivante = dominante;
  }
  return { active: true, special: null, label: pouvoir === 'fruit' ? 'Double bille fruitée !' : 'Couleur dominante préparée !' };
}

function prochaineActionBoss(index: number): BossActionTir {
  return (['givre', 'descente', 'verrou-swap'] as BossActionTir[])[index % 3];
}

function appliquerActionBoss(etat: EtatShooter, action: BossActionTir, rng: Rng) {
  if (action === 'descente') {
    etat.grille.unshift(genererLigne(!etat.grille[0]?.decalee, etat.couleursPool, rng));
    return;
  }
  if (action === 'verrou-swap') {
    etat.swapBloqueTirs = 2;
    return;
  }

  // Le souffle givre d'abord les perles basses : la menace est visible et peut
  // être cassée par un Tir parfait au lieu d'être une punition arbitraire.
  const candidates: Bulle[] = [];
  for (let r = etat.grille.length - 1; r >= 0; r--) {
    for (const b of etat.grille[r].cases) if (b && !b.capsule && !b.special) candidates.push(b);
  }
  const n = Math.min(candidates.length, 1 + etat.bossPhase);
  for (let i = 0; i < n; i++) {
    candidates[i].special = 'givre';
    candidates[i].pv = 2;
  }
}

function clonerEtatShooter(etat: EtatShooter): EtatShooter {
  return {
    ...etat,
    objectif: { ...etat.objectif },
    rush: etat.rush ? { ...etat.rush } : null,
    couleursPool: [...etat.couleursPool],
    grille: etat.grille.map((l) => ({
      decalee: l.decalee,
      cases: l.cases.map((b) => b ? { ...b } : null),
    })),
  };
}

// --- Résolution d'un tir -----------------------------------------------------

// Tir complet : vol → pose (ou explosion) → éclatement → chute des orphelines
// → descente éventuelle. MUTE l'état passé.
export function tirer(
  etat: EtatShooter,
  origine: Point,
  angle: number,
  rng: Rng = Math.random,
  special: Special | null = null,
  tirParfaitDemande = false,
): ResultatTir {
  if (etat.swapBloqueTirs > 0) etat.swapBloqueTirs--;
  const g = etat.grille;
  const { points, impact } = simulerVol(g, origine, angle);
  const rebondi = points.length > 2; // la polyligne contient un point par rebond
  // 🏅 TIR EN OR : c'est le tout dernier tir du budget → points ×2 s'il est utile
  const tirEnOr = etat.tirsRestants === 1;

  let pts = 0;
  let capsules = 0;
  let multiplicateur = 1;
  let rebond = false;
  let explosions = 0;
  let bonusPop = 0;
  let pose: Case | null = null;
  const eclatees: { pos: Case; bulle: Bulle }[] = [];
  const tombees: { pos: Case; bulle: Bulle }[] = [];
  let tailleGroupe = 0;

  if (special === 'bombe') {
    // 💣 pas de pose : tout ce qui est colorié dans le rayon explose
    // (les capsules RÉSISTENT — mais privées de soutien, elles tombent)
    const centre = casePourImpact(g, impact);
    const cCentre = centreCase(centre.r, centre.c, g[centre.r].decalee);
    for (let r = 0; r < g.length; r++) {
      for (let c = 0; c < COLS; c++) {
        const b = g[r].cases[c];
        if (!b || b.capsule) continue;
        const p = centreCase(r, c, g[r].decalee);
        const dx = p.x - cCentre.x, dy = p.y - cCentre.y;
        if (dx * dx + dy * dy <= RAYON_BOMBE * RAYON_BOMBE) {
          eclatees.push({ pos: { r, c }, bulle: b });
          g[r].cases[c] = null;
        }
      }
    }
    multiplicateur = Math.max(1, Math.min(etat.chaine, CHAINE_MAX));
    pts += eclatees.length * 10 * multiplicateur;
    // la chaîne n'est ni cassée ni augmentée par une bombe
  } else {
    pose = casePourImpact(g, impact);
    let couleurTir = etat.couleurCourante;
    if (special === 'arc') {
      // 🌈 adopte la couleur du PLUS GROS groupe voisin de la pose
      let meilleure: { couleur: Couleur; taille: number } | null = null;
      const testees = new Set<Couleur>();
      for (const v of voisins(g, pose.r, pose.c)) {
        const b = bulleEn(g, v.r, v.c);
        if (!b || b.capsule || testees.has(b.couleur)) continue;
        testees.add(b.couleur);
        g[pose.r].cases[pose.c] = { couleur: b.couleur };
        const taille = groupeMemeCouleur(g, pose).length;
        g[pose.r].cases[pose.c] = null;
        if (!meilleure || taille > meilleure.taille) meilleure = { couleur: b.couleur, taille };
      }
      if (meilleure) couleurTir = meilleure.couleur;
    }
    g[pose.r].cases[pose.c] = { couleur: couleurTir };

    const groupe = groupeMemeCouleur(g, pose);
    tailleGroupe = groupe.length;
    if (groupe.length >= 3) {
      etat.chaine = Math.min(etat.chaine + 1, 9);
      multiplicateur = Math.min(etat.chaine, CHAINE_MAX);
      for (const caseG of groupe) {
        const b = bulleEn(g, caseG.r, caseG.c)!;
        // ❄️ givre : encaisse un coup et RESTE tant que pv > 1
        if (b.special === 'givre' && (b.pv ?? 2) > 1 && !tirParfaitDemande) {
          b.pv = (b.pv ?? 2) - 1;
          continue;
        }
        eclatees.push({ pos: caseG, bulle: b });
        if (b.special === 'bonus') { pts += BONUS_POINTS; bonusPop++; }
        g[caseG.r].cases[caseG.c] = null;
      }
      pts += (groupe.length * 10 + Math.max(0, groupe.length - 3) * 5) * multiplicateur;
      if (tirParfaitDemande && eclatees.length) pts += 25 * multiplicateur;
      if (rebondi && eclatees.length) { rebond = true; pts = Math.round(pts * BONUS_REBOND); }
    } else if (etat.graceChaine > 0 && etat.chaine > 0) {
      etat.graceChaine--; // le copain de tir Signature pardonne ce raté
    } else {
      etat.chaine = 0; // tir sans match → la chaîne retombe
    }
  }

  // 💥 Réactions en chaîne : toute BOMBE-PLATEAU adjacente à une perle retirée
  // détone (retire la bombe + ses voisines), ce qui peut enchaîner d'autres bombes.
  if (eclatees.length) {
    const dejaDet = new Set<string>();
    const file: Case[] = [];
    for (const e of eclatees) {
      for (const v of voisins(g, e.pos.r, e.pos.c)) {
        const b = bulleEn(g, v.r, v.c);
        if (b?.special === 'bombe' && !dejaDet.has(`${v.r}:${v.c}`)) { dejaDet.add(`${v.r}:${v.c}`); file.push(v); }
      }
    }
    while (file.length) {
      const bombe = file.pop()!;
      explosions++;
      for (const cas of [bombe, ...voisins(g, bombe.r, bombe.c)]) {
        const b = bulleEn(g, cas.r, cas.c);
        if (!b || b.capsule) continue; // les capsules résistent à l'explosion
        if (b.special === 'bombe' && !dejaDet.has(`${cas.r}:${cas.c}`)) { dejaDet.add(`${cas.r}:${cas.c}`); file.push(cas); }
        eclatees.push({ pos: { r: cas.r, c: cas.c }, bulle: b });
        if (b.special === 'bonus') { pts += BONUS_POINTS; bonusPop++; }
        g[cas.r].cases[cas.c] = null;
      }
      pts += EXPLO_POINTS * multiplicateur;
    }
  }

  // 🌟 SUPERNOVA : chaque perle ÉTOILE éclatée emporte TOUTES les perles de sa
  // couleur encore sur le plateau (blocs et capsules résistent). Les étoiles
  // révélées par le souffle s'enchaînent — une couleur n'est balayée qu'une fois.
  let etoiles = 0;
  if (eclatees.length) {
    const fileEtoiles: Couleur[] = eclatees
      .filter((e) => e.bulle.special === 'etoile')
      .map((e) => e.bulle.couleur);
    const couleursBalayees = new Set<Couleur>();
    while (fileEtoiles.length) {
      const coul = fileEtoiles.pop()!;
      if (couleursBalayees.has(coul)) continue;
      couleursBalayees.add(coul);
      etoiles++;
      for (let r = 0; r < g.length; r++) {
        for (let c = 0; c < COLS; c++) {
          const b = g[r].cases[c];
          if (!b || b.capsule || estBloc(b) || b.special === 'arc') continue;
          if (b.couleur !== coul) continue;
          if (b.special === 'etoile') fileEtoiles.push(b.couleur);
          eclatees.push({ pos: { r, c }, bulle: b });
          if (b.special === 'bonus') { pts += BONUS_POINTS; bonusPop++; }
          g[r].cases[c] = null;
          pts += 12 * multiplicateur;
        }
      }
    }
  }

  // Orphelines (après éclatement OU explosion) : les capsules se LIBÈRENT ici
  if (eclatees.length) {
    for (const caseO of orphelines(g)) {
      const b = bulleEn(g, caseO.r, caseO.c)!;
      tombees.push({ pos: caseO, bulle: b });
      if (b.capsule) capsules++;
      if (b.special === 'bonus') { pts += BONUS_POINTS; bonusPop++; }
      g[caseO.r].cases[caseO.c] = null;
    }
    pts += tombees.length * 15 * multiplicateur;
    // 🎉 GROS LÂCHER : bonus superlinéaire quand une grosse grappe dégringole
    if (tombees.length >= GROS_LACHER) pts += tombees.length * tombees.length * 3 * multiplicateur;
  }

  retirerLignesVidesEnBas(g);

  // Plateau nettoyé : bonus. En infini on régénère ; en aventure on laisse vide
  // (la victoire — toutes capsules libérées — est constatée par l'écran).
  let plateauNettoye = false;
  if (plateauEstVide(g)) {
    plateauNettoye = true;
    etat.plateauxVides++;
    if (etat.regenerer) {
      pts += 500;
      for (let r = 0; r < LIGNES_DEPART; r++) g.push(genererLigne(r % 2 === 1, etat.couleursPool, rng));
    } else {
      pts += 200;
    }
  }

  // Descente périodique (jamais juste après un plateau neuf) — lignes SANS capsule
  etat.tirs++;
  let nouvelleLigne = false;
  if (etat.tirsParDescente > 0 && !plateauNettoye && etat.tirs >= etat.tirsParDescente && g.length) {
    etat.tirs = 0;
    nouvelleLigne = true;
    const nouvelle = genererLigne(!g[0].decalee, etat.couleursPool, rng);
    if (etat.specialsAuto) semerSpeciales(nouvelle, rng);
    g.unshift(nouvelle);
  }

  // Tirs restants (aventure)
  if (etat.tirsRestants !== null) etat.tirsRestants = Math.max(0, etat.tirsRestants - 1);

  // 🎁 Perles « +1 tir » encaissées (éclatées OU tombées) — aventure uniquement
  const tirsBonus = etat.tirsRestants !== null
    ? eclatees.filter((x) => x.bulle.special === 'tir').length
      + tombees.filter((x) => x.bulle.special === 'tir').length
    : 0;
  if (tirsBonus > 0 && etat.tirsRestants !== null) etat.tirsRestants += tirsBonus;

  // 🔥 RUSH de mi-niveau : suivi du défi actif, puis déclenchement unique
  let rushDebut = false;
  let rushFin: 'reussi' | 'rate' | null = null;
  if (etat.rush && etat.rush.statut === 'active') {
    const compteRush = (arr: { bulle: Bulle }[]) => arr.filter((x) =>
      !x.bulle.capsule && !estBloc(x.bulle) && x.bulle.special !== 'arc'
      && x.bulle.couleur === etat.rush!.couleur).length;
    etat.rush.progres += compteRush(eclatees) + compteRush(tombees);
    etat.rush.tirsFenetre--;
    if (etat.rush.progres >= etat.rush.cible) {
      etat.rush.statut = 'reussi';
      rushFin = 'reussi';
      pts += RUSH_POINTS;
      if (etat.tirsRestants !== null) etat.tirsRestants += RUSH_TIRS_BONUS;
    } else if (etat.rush.tirsFenetre <= 0) {
      etat.rush.statut = 'rate';
      rushFin = 'rate';
    }
  } else if (!etat.rush && etat.tirsMax !== null && etat.tirsRestants !== null
    && etat.objectif.type !== 'boss' && !etat.perdu
    && etat.tirsRestants <= Math.floor(etat.tirsMax / 2) && etat.tirsRestants > 4) {
    // couleur la plus présente = défi lisible ; il faut assez de matière pour être jouable
    const comptes = new Map<Couleur, number>();
    for (const l of g) for (const b of l.cases) {
      if (b && !b.capsule && !estBloc(b) && b.special !== 'arc') {
        comptes.set(b.couleur, (comptes.get(b.couleur) ?? 0) + 1);
      }
    }
    let meilleure: Couleur | null = null;
    let dispo = 0;
    for (const [coul, nb] of comptes) if (nb > dispo) { dispo = nb; meilleure = coul; }
    if (meilleure !== null && dispo >= 6) {
      etat.rush = {
        couleur: meilleure,
        cible: Math.min(8, Math.max(5, Math.floor(dispo * 0.6))),
        progres: 0,
        tirsFenetre: 3,
        statut: 'active',
      };
      rushDebut = true;
    }
  }

  // Perdu ? (le plateau a atteint la limite)
  etat.perdu = ligneLaPlusBasse(g) >= LIGNE_LIMITE;

  // 🏅 TIR EN OR réussi : le dernier tir du budget paie double
  if (tirEnOr && pts > 0) pts *= 2;

  etat.score += pts;
  etat.detruites += eclatees.length + tombees.length;
  etat.capsulesLiberees += capsules;

  // Avancement de l'objectif du niveau (tomber / couleur / boss)
  const obj = etat.objectif;
  if (obj.type === 'tomber') {
    etat.objProgres += tombees.filter((t) => !t.bulle.capsule).length;
  } else if (obj.type === 'couleur') {
    const compte = (arr: { bulle: Bulle }[]) =>
      arr.filter((x) => !estBloc(x.bulle) && x.bulle.special !== 'arc' && x.bulle.couleur === obj.couleur).length;
    etat.objProgres += compte(eclatees) + compte(tombees);
  } else if (obj.type === 'boss') {
    // 👹 chaque perle éclatée / tombée blesse le boss ; gros combos et explosions cognent plus fort
    const degats = eclatees.filter((x) => !estBloc(x.bulle)).length
      + tombees.filter((t) => !t.bulle.capsule).length
      + (tailleGroupe >= 5 ? 3 : 0) + explosions * 2
      + (tirParfaitDemande && eclatees.length ? 1 : 0);
    etat.objProgres += degats;
  }

  // Shaker Fever : un match charge, un rebond réussi accélère encore la jauge.
  const feverAvant = etat.fever;
  if (!special && tailleGroupe >= 3) {
    etat.fever = Math.min(FEVER_MAX, etat.fever + 1 + (rebond ? 1 : 0));
  }
  const feverGagne = etat.fever - feverAvant;

  // Boss Aventure : son attaque est annoncée plusieurs tirs à l'avance. Un
  // rebond réussi ou un gros lâcher interrompt le compte à rebours.
  let bossAction: BossActionTir | null = null;
  let bossInterrompu = false;
  if (obj.type === 'boss' && !objectifAtteint(etat)) {
    const ratio = etat.objProgres / Math.max(1, obj.pv);
    etat.bossPhase = ratio >= 0.66 ? 3 : ratio >= 0.33 ? 2 : 1;
    const interruption = rebond || tombees.length >= GROS_LACHER;
    if (interruption) {
      bossInterrompu = etat.bossCompteur > 0;
      etat.bossCompteur = 0;
    } else {
      etat.bossCompteur++;
      const seuil = etat.bossPhase === 3 ? 2 : 3;
      if (etat.bossCompteur >= seuil) {
        bossAction = etat.bossProchaineAction;
        appliquerActionBoss(etat, bossAction, rng);
        etat.bossCompteur = 0;
        etat.bossActionIndex++;
        etat.bossProchaineAction = prochaineActionBoss(etat.bossActionIndex);
        if (bossAction === 'descente') nouvelleLigne = true;
      }
    }
    etat.perdu = ligneLaPlusBasse(g) >= LIGNE_LIMITE;
  }

  // Munitions : les tirs spéciaux ne consomment PAS la perle courante
  if (!special) {
    const presentes = couleursPresentes(g);
    etat.couleurCourante = etat.couleurSuivante;
    if (!presentes.includes(etat.couleurCourante) && presentes.length) {
      etat.couleurCourante = presentes[Math.floor(rng() * presentes.length)];
    }
    etat.couleurSuivante = presentes.length
      ? presentes[Math.floor(rng() * presentes.length)]
      : couleurAleatoire(rng, etat.couleursPool);
  }

  return {
    trajectoire: points, pose, eclatees, tombees, capsules,
    points: pts, multiplicateur, rebond, groupe: tailleGroupe,
    nouvelleLigne, plateauNettoye, perdu: etat.perdu,
    explosions, bonusPop, grosLacher: tombees.length,
    objectifAtteint: objectifAtteint(etat),
    tirParfait: tirParfaitDemande && eclatees.length > 0,
    feverGagne,
    bossAction,
    bossInterrompu,
    etoiles,
    tirsBonus,
    tirEnOr: tirEnOr && pts > 0,
    rushDebut,
    rushFin,
  };
}

// Aperçu tactique sans mutation de la partie réelle. Il partage exactement la
// même résolution que le tir final, donc la bille fantôme ne ment pas au joueur.
export function previsualiserTir(
  etat: EtatShooter,
  origine: Point,
  angle: number,
  special: Special | null = null,
): ApercuTir {
  const copie = clonerEtatShooter(etat);
  const res = tirer(copie, origine, angle, () => 0.5, special, false);
  return {
    pose: res.pose,
    eclatees: res.eclatees.length,
    tombees: res.tombees.length,
    capsules: res.capsules,
  };
}

// Échange la perle courante et la suivante (bouton « swap »)
export function echangerMunitions(etat: EtatShooter) {
  if (etat.swapBloqueTirs > 0) return false;
  const t = etat.couleurCourante;
  etat.couleurCourante = etat.couleurSuivante;
  etat.couleurSuivante = t;
  return true;
}

// Étoiles d'un niveau selon les tirs restants (≥35 % → 3★, ≥15 % → 2★, sinon 1★)
export function etoilesNiveau(tirsRestants: number, tirsMax: number): 1 | 2 | 3 {
  const ratio = tirsRestants / Math.max(1, tirsMax);
  return ratio >= 0.35 ? 3 : ratio >= 0.15 ? 2 : 1;
}
