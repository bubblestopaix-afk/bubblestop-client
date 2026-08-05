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
//   meilleur groupe voisin — match garanti : il éclate dès 2 perles, cf. 🩹 26/07
//   dans tirer()). Achetées avec des perles.
//
// 🧩 26/07/2026 — REFONTE LOT C : les perles du PLATEAU ne sont plus traitées par
// des blocs `if` codés en dur dans tirer() mais par UN REGISTRE (`EFFETS_PERLE`)
// et UNE file de propagation (`propagerCascade`). Ajouter une perle = ajouter une
// entrée au registre : plus aucune ligne à écrire dans tirer(). Le registre porte
// AUSSI les infos d'affichage (nom, emoji, aide, enAvant) pour que `plateau-skia`
// et `shooter` dessinent et expliquent les perles sans dupliquer la connaissance.

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

// 🧩 Plafond DUR de la cascade : au-delà, on arrête de propager. La terminaison est
// déjà garantie par le `Set` de cases vues (une case ne peut être détruite qu'une
// fois, et rien ne recrée de perle pendant un tir) ; ce plafond est la ceinture en
// plus des bretelles — il borne aussi le travail d'animation envoyé à l'écran.
export const CASCADE_MAX = 200;
export const MECHE_PV = 5;                 // 🧨 compte à rebours de la perle à mèche (en tirs)
export const ROCHE_PV = 3;                 // 🪨 coups à encaisser avant de céder
export const GIVRE_PV = 2;                 // ❄️ coups à encaisser (valeur historique)
export const RAYON_PORTAIL = 0.87;         // 🌀 même rayon que la collision : le portail passe AVANT la perle
export const SORTIE_PORTAIL = 0.95;        // recul de sortie, juste hors du rayon de collision du portail jumeau
export const LASER_POINTS = 60;            // 🥤 points d'une ligne rasée
export const MECHE_POINTS = 50;            // 🧨 points d'une détonation en croix
export const CONTAGION_POINTS = 25;        // 🍯 points d'une contamination
export const LIEN_POINTS = 35;             // 🔗 points d'un appel de jumelle
export const CASCADE_POINTS = 55;          // 💧 points d'une colonne emportée
export const AIMANT_POINTS = 45;           // 🧲 points d'une attraction
export const RAYON_AIMANT = 2;             // 🧲 portée de l'attraction, en CASES (fenêtre 5×5)

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
// --- 6 nouvelles (LOT C, 26/07/2026) : voir EFFETS_PERLE pour LE comportement ---
//  laser     = rase toute sa LIGNE horizontale en éclatant ;
//  contagion = repeint ses 6 voisines dans sa couleur (préparation de gros combo) ;
//  lien      = perles jumelles (`lienId`) : l'une éclate → l'autre part avec elle ;
//  meche     = compte à rebours (`pv`) décrémenté à CHAQUE tir → explosion en croix ;
//  portail   = par paires, DÉVIE le projectile (seule perle qui touche la trajectoire) ;
//  roche     = bloc 3 PV qui ne tombe JAMAIS par gravité (obstacle dur).
// --- 2 nouvelles (LOT PALIERS, 27/07/2026) : elles n'existent PAS avant le palier qui
//     les ouvre — c'est la charge utile concrète d'un boss vaincu, cf. PALIERS_NOMMES ---
//  cascade = rase toute sa COLONNE verticale (la Paille 🥤, mais debout) ;
//  aimant  = attire et fait éclater les perles de SA couleur autour d'elle (supernova
//            LOCALE : fenêtre de RAYON_AIMANT cases, là où 🌟 balaie tout le plateau).
export type SpecialBulle =
  | 'glacon' | 'bombe' | 'givre' | 'arc' | 'bonus' | 'etoile' | 'tir'
  | 'laser' | 'contagion' | 'lien' | 'meche' | 'portail' | 'roche'
  | 'cascade' | 'aimant';
export type Bulle = {
  couleur: Couleur;
  capsule?: boolean;         // capsule → couleur ignorée (objectif à libérer)
  special?: SpecialBulle;
  pv?: number;               // givre : 2 → 1 → éclatée ; roche : 3 ; mèche : compte à rebours
  lienId?: number;           // 🔗 identifiant de paire (perles jumelles)
};
export type Ligne = { decalee: boolean; cases: (Bulle | null)[] };

// Objectif d'un niveau (ce qu'il faut accomplir pour gagner)
export type Objectif =
  | { type: 'capsules' }                             // libérer toutes les capsules
  | { type: 'tomber'; cible: number }                // faire tomber N perles
  | { type: 'nettoyer' }                             // vider le plateau
  | { type: 'couleur'; couleur: Couleur; cible: number } // éclater N perles d'une couleur
  | { type: 'boss'; pv: number }                     // 👹 vider les PV du boss en éclatant
  | { type: 'score' }                                // infini (aucune fin)
  // --- NOUVEAUX (LOT C) : chacun est borné par la MATIÈRE réellement présente,
  // jamais par une formule en `n` seule (cf. paramsNiveau et §C4 du cahier) ---
  | { type: 'chaine'; cible: number }                // atteindre une chaîne de N matchs consécutifs
  | { type: 'lacher'; cible: number }                // faire tomber N perles EN UN SEUL TIR
  | { type: 'parfaits'; cible: number }              // réussir N tirs parfaits
  | { type: 'speciales'; cible: number };            // déclencher N perles spéciales

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
  descentes: number;            // 📈 descentes déjà subies (paliers de l'infini : 6 → 5 → 4 tirs)
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
  // 🎖️ PALIER du niveau (chapitre du parcours) — DÉRIVÉ du numéro de niveau, jamais
  // persisté (cf. palierDuNiveau). Le moteur en a besoin DANS `tirer()` : c'est lui qui
  // règle l'agressivité du boss, et `tirer()` ne connaît pas le numéro de niveau.
  palier: number;
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
// C'est le BUS D'ÉVÉNEMENTS du tir : l'écran n'a rien à recalculer, il lit ces
// compteurs pour ses textes flottants, ses haptiques et ses secousses.
export type ResultatTir = {
  trajectoire: Point[];         // polyligne du projectile (origine → impact)
  ruptures: number[];           // 🌀 indices i de `trajectoire` où le segment i → i+1 est un SAUT de portail (à ne pas tracer)
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
  // --- nouveaux événements (LOT C) : l'écran les anime, le moteur les compte ---
  lasers: number;               // 🥤 lignes rasées ce tir
  contagions: number;           // 🍯 contaminations (repeintes) ce tir
  liens: number;                // 🔗 paires de jumelles déclenchées ce tir
  portails: number;             // 🌀 sauts de portail sur la trajectoire (0 ou 1)
  meches: number;               // 🧨 mèches détonées ce tir
  specialesDeclenchees: number; // total de perles spéciales dont l'effet a payé ce tir
  // --- LOT PALIERS (additifs : aucun appelant existant ne casse) ---
  cascades: number;             // 💧 colonnes emportées ce tir
  aimants: number;              // 🧲 attractions déclenchées ce tir
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

// Fiche registre d'une perle (undefined pour une perle ordinaire). Point d'accès
// UNIQUE : personne ne doit tester `b.special === '…'` ailleurs qu'ici.
export function infoPerle(b: Bulle | null | undefined): InfoPerle | undefined {
  return b?.special ? EFFETS_PERLE[b.special] : undefined;
}

// Un BLOC ne se matche jamais par la couleur (capsule, glaçon, portail, roche)
export function estBloc(b: Bulle | null): boolean {
  return !!b && (b.capsule === true || !!infoPerle(b)?.bloc);
}

// Une perle « en avant » est dessinée AU-DESSUS de ses voisines (capsule comprise).
// `plateau-skia` lit cette règle ici au lieu d'entretenir sa propre liste en dur.
export function perleEnAvant(b: { capsule?: boolean; special?: string } | null | undefined): boolean {
  if (!b) return false;
  if (b.capsule) return true;
  const info = b.special ? EFFETS_PERLE[b.special as SpecialBulle] : undefined;
  return !!info?.enAvant;
}

// Couleurs encore présentes (les munitions s'y limitent) — blocs & arcs exclus
export function couleursPresentes(grille: Ligne[]): Couleur[] {
  const s = new Set<Couleur>();
  for (const l of grille) for (const b of l.cases) if (b && !estBloc(b) && b.special !== 'arc') s.add(b.couleur);
  return [...s].sort((a, b) => a - b);
}

// --- Objectifs -----------------------------------------------------------------

export function objectifCible(o: Objectif): number {
  if (o.type === 'boss') return o.pv;
  // `'cible' in o` couvre d'un coup tomber/couleur ET les 4 nouveaux objectifs :
  // un objectif chiffré de plus n'oblige pas à revenir éditer cette ligne.
  if ('cible' in o) return o.cible;
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
    case 'couleur':
    // Les 4 nouveaux objectifs sont tous des compteurs : `objProgres` est le
    // MEILLEUR score atteint (chaîne, lâcher) ou le cumul (parfaits, spéciales).
    case 'chaine':
    case 'lacher':
    case 'parfaits':
    case 'speciales': return etat.objProgres >= o.cible;
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
    // Libellés courts : `parcours.tsx` les affiche sur UNE ligne (numberOfLines={1}).
    case 'chaine': return `Enchaîne ${o.cible} matchs d'affilée`;
    case 'lacher': return `Fais tomber ${o.cible} perles d'un coup`;
    case 'parfaits': return `Réussis ${o.cible} tirs parfaits`;
    case 'speciales': return `Déclenche ${o.cible} perles spéciales`;
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
    // Les 4 nouveaux objectifs expliquent leur VERBE, comme les anciens : c'est le
    // seul moment où le joueur peut encore corriger sa stratégie.
    case 'chaine': {
      const restant = Math.max(0, o.cible - etat.objProgres);
      return `Il te manque ${restant} match${restant > 1 ? 's' : ''} de CHAÎNE — enchaîne sans jamais rater, un tir raté remet la chaîne à zéro.`;
    }
    case 'lacher': {
      return `Il faut ${o.cible} perles qui tombent D'UN SEUL COUP — coupe le pont qui retient la plus grosse grappe (record actuel : ${etat.objProgres}).`;
    }
    case 'parfaits': {
      const restant = Math.max(0, o.cible - etat.objProgres);
      return `Encore ${restant} TIR${restant > 1 ? 'S' : ''} PARFAIT${restant > 1 ? 'S' : ''} — tire l'élastique à fond ET touche un groupe.`;
    }
    case 'speciales': {
      const restant = Math.max(0, o.cible - etat.objProgres);
      return `Encore ${restant} perle${restant > 1 ? 's' : ''} SPÉCIALE${restant > 1 ? 'S' : ''} à déclencher — fais éclater les bombes, étoiles, pailles et sirops du plateau.`;
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
    descentes: 0,
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
    palier: 0,               // l'Infini n'a pas de chapitre : il est HORS parcours
  };
}

// --- 🎖️ PALIERS DE PARCOURS (27/07/2026) --------------------------------------------
//
// LE CONSTAT : « le boss du niveau 5 et celui du niveau 50 sont structurellement
// identiques ». C'était vrai, et mesurable — TOUS les dosages de `paramsBruts`
// plafonnent avant le niveau 17 (glaçons 13, bombes 14, givre 16, bonus 9, +1 tir 11,
// roches 16, lignes 13, budget 24, couleurs 10). À partir du niveau 17, deux niveaux
// consécutifs ne diffèrent QUE par leur objectif et leur silhouette. Le parcours était
// une ligne plate.
//
// LA RÉPONSE : un PALIER = 5 niveaux = un chapitre, refermé par son boss. Battre ce
// boss OUVRE le chapitre suivant, et un chapitre ouvert change le jeu d'après :
//   • sa PERLE SIGNATURE entre en jeu (et n'en sort plus) ;
//   • le BOSS gagne du rythme (il frappe plus tôt, son souffle givre plus large) ;
//   • le parcours change de nom, de silhouettes et de promesse.
//
// ⚠️ ZÉRO CHAMP PERSISTÉ : le palier se DÉDUIT du numéro de niveau. `store/jeu.ts`
// n'appartient pas à ce lot, et de toute façon un palier déductible ne peut pas se
// désynchroniser d'une sauvegarde — c'est la bonne conception, pas un pis-aller.

export type Palier = {
  index: number;            // 0 = le tout premier chapitre (niveaux 1 à 5)
  nom: string;              // titre affiché
  emoji: string;
  promesse: string;         // UNE phrase : ce que ce palier a ouvert (valable au 1er passage)
  perle: SpecialBulle | null; // la perle SIGNATURE du chapitre (null = les bases)
  // 🎖️ Au 1er passage (tour 0), le chapitre INTRODUIT réellement sa perle : la promesse
  // « NOUVELLE PERLE » est vraie. Aux tours de boucle suivants, la perle est DÉJÀ connue du
  // joueur — l'écran doit alors présenter un libellé neutre, pas une fausse nouveauté (cf.
  // parcours.tsx). Le fait vit ici, sa présentation reste à l'écran : le moteur ne fabrique
  // pas de texte d'UI.
  premiereFois: boolean;
};

export const NIVEAUX_PAR_PALIER = 5;   // = la cadence des boss (n % 5 === 0)

// 🎖️ À partir de CE palier, la perle signature du chapitre est RENFORCÉE (+1 sur tous
// ses plateaux). Les chapitres 1 et 2 n'en ont pas besoin : les seuils historiques de
// `paramsBruts` leur livrent déjà de vraies nouveautés (Supernova au 6, Paille au 7,
// Jumelles au 9, Roche au 10, Mèche au 11, Portail au 13). Leur `perle` ne sert donc
// qu'à NOMMER le chapitre. Le renfort commence exactement là où la progression
// s'arrêtait : au niveau 16, dernier seuil du jeu (le givre).
export const PALIER_RENFORT_MIN = 3;

// Les 8 chapitres nommés. Au-delà, le parcours BOUCLE en le disant (cf. palierInfo) :
// mieux vaut un cycle assumé et étiqueté qu'une ligne plate qui prétend progresser.
//
// ⚠️ Aucun chapitre ne renforce le PORTAIL 🌀 : `portailsDeGrille` apparie les deux
// premiers portails trouvés SANS regarder `lienId`. Une seconde paire ferait donc
// communiquer deux portails de paires différentes — une trajectoire fausse, pas un
// contenu de plus. Même raison pour les blocs (glaçon, roche) : un chapitre doit
// OUVRIR quelque chose, pas murer le plateau.
// `index` ET `premiereFois` sont DÉRIVÉS à chaque lecture (l'un du numéro demandé, l'autre
// du tour de boucle) : la table ne porte que l'identité STATIQUE d'un chapitre.
const PALIERS_NOMMES: Omit<Palier, 'index' | 'premiereFois'>[] = [
  { nom: 'Vallée des Perles', emoji: '🫧', perle: null,
    promesse: 'Les bases : capsules à libérer, glaçons 🧊 à décrocher, perles étoilées ⭐ à faire sauter.' },
  { nom: 'Verger Givré', emoji: '❄️', perle: 'etoile',
    promesse: 'La Supernova 🌟 et les perles givrées ❄️ entrent en jeu.' },
  { nom: 'Atelier à Mèches', emoji: '🧨', perle: 'meche',
    promesse: 'La Mèche 🧨, le Portail 🌀 et la Roche 🪨 rejoignent les plateaux.' },
  { nom: 'Allée des Pailles', emoji: '🥤', perle: 'laser',
    promesse: 'Une Perle Paille 🥤 de plus sur chaque plateau : deux lignes à raser.' },
  { nom: 'Chutes de Sirop', emoji: '💧', perle: 'cascade',
    promesse: 'NOUVELLE PERLE — la Cascade 💧 emporte toute sa COLONNE. Six silhouettes de plateau inédites entrent aussi dans la roue.' },
  { nom: 'Mine Magnétique', emoji: '🧲', perle: 'aimant',
    promesse: 'NOUVELLE PERLE — l’Aimant 🧲 attire et fait éclater sa couleur tout autour de lui.' },
  { nom: 'Constellation', emoji: '🌟', perle: 'etoile',
    promesse: 'Une seconde Supernova 🌟 : deux couleurs entières à balayer.' },
  { nom: 'Double Lien', emoji: '🔗', perle: 'lien',
    promesse: 'Une SECONDE paire de Jumelles 🔗 : deux ponts à couper à distance.' },
];

// 🎖️ Les deux perles que les paliers 4 et 5 FONT ENTRER EN JEU (indices dans la table
// ci-dessus). Ce ne sont PAS des « renforts » : elles n'existaient nulle part avant leur
// chapitre, et une fois ouvertes elles restent — un chapitre franchi ne se referme pas.
export const PALIER_CASCADE = 4;   // 💧 niveau 21
export const PALIER_AIMANT = 5;    // 🧲 niveau 26

// La perle RENFORCÉE (+1) par le chapitre d'un niveau — null en deçà du renfort.
export function renfortPalier(index: number): SpecialBulle | null {
  // 🛡️ Assaini AVANT la comparaison : `NaN < PALIER_RENFORT_MIN` est faux, donc un index
  // non fini traversait ce garde et n'était rattrapé que par le repli de `palierInfo`.
  if (entierSur(index, 0) < PALIER_RENFORT_MIN) return null;
  const perle = palierInfo(index).perle;
  // 💧🧲 Les perles de palier arrivent par `nbCascades`/`nbAimants`, pas par le renfort :
  // les repasser ici les poserait DEUX fois sur leur propre chapitre, et une seule fois
  // ensuite — un pic incohérent, précisément sur le niveau censé les présenter.
  return perle === 'cascade' || perle === 'aimant' ? null : perle;
}

// 🛡️ 27/07 — UN NOMBRE NON FINI NE DOIT PLUS ATTEINDRE LA TABLE DES CHAPITRES.
// `Math.max(0, Math.round(index))` avait l'AIR d'un garde-fou, mais `Math.max(0, NaN)`
// vaut NaN : `PALIERS_NOMMES[NaN % 8]` rendait `undefined` et la lecture de `.nom`
// LEVAIT un TypeError. Et depuis que `paramsBruts` appelle `renfortPalier(palierDuNiveau(n))`,
// toute la chaîne `creerNiveau` → `paramsNiveau` → `palierInfo` propageait ce crash,
// alors qu'avant ce lot `creerNiveau(NaN)` rendait un état dégénéré mais SANS exception.
// C'était donc une RÉGRESSION, et elle était ATTEIGNABLE : `parcours.tsx` appelle
// `etapePalier(etat.aventure.niveauMax)` DÈS LE RENDU, et `aventure` subissait un spread
// brut à la migration — une sauvegarde serveur abîmée donnait un écran rouge dont le
// joueur ne pouvait plus sortir, pas un niveau bizarre.
// On coerce puis on refuse le non fini : le repli est le plancher de la fonction, celui
// sur lequel retombent déjà les entrées sales numériques (0 pour un chapitre, 1 pour un
// niveau). `entierSur` est la source unique de ce repli pour TOUTE la chaîne des paliers.
function entierSur(x: number, plancher: number): number {
  const n = Number(x);
  return Number.isFinite(n) ? Math.max(plancher, Math.round(n)) : plancher;
}

// Chapitre d'un niveau. Niveaux 1-5 → 0, 6-10 → 1, 11-15 → 2… Le boss du niveau
// 5·(k+1) referme le palier k et ouvre le palier k+1.
export function palierDuNiveau(n: number): number {
  const niveau = Number(n);
  if (!Number.isFinite(niveau)) return 0;
  return Math.max(0, Math.floor((Math.max(1, niveau) - 1) / NIVEAUX_PAR_PALIER));
}

// Fiche d'un palier. Au-delà de la table, on RECYCLE en numérotant le tour de boucle
// (« Vallée des Perles ✦2 ») : le joueur voit qu'il repasse, et où il en est.
export function palierInfo(index: number): Palier {
  const i = entierSur(index, 0);
  const base = PALIERS_NOMMES[i % PALIERS_NOMMES.length];
  const tour = Math.floor(i / PALIERS_NOMMES.length);
  return {
    index: i,
    nom: tour === 0 ? base.nom : `${base.nom} ✦${tour + 1}`,
    emoji: base.emoji,
    promesse: base.promesse,
    perle: base.perle,
    premiereFois: tour === 0,
  };
}

// Premier niveau d'un palier (celui juste après le boss qui l'a ouvert).
export function premierNiveauDuPalier(index: number): number {
  return entierSur(index, 0) * NIVEAUX_PAR_PALIER + 1;
}
// Niveau du BOSS qui referme un palier — donc celui qui ouvre le suivant.
export function niveauBossDuPalier(index: number): number {
  return (entierSur(index, 0) + 1) * NIVEAUX_PAR_PALIER;
}

// « Où en suis-je, et qu'est-ce qui m'attend ? » — LE contrat de `parcours.tsx`.
// `restants` = niveaux à faire avant le boss (0 = c'est CE niveau, le boss est là).
export type EtapePalier = {
  actuel: Palier;
  suivant: Palier;
  niveauBoss: number;
  restants: number;
  progression: number;   // 0..1 dans le chapitre courant
};
export function etapePalier(n: number): EtapePalier {
  const niveau = entierSur(n, 1);
  const index = palierDuNiveau(niveau);
  const niveauBoss = niveauBossDuPalier(index);
  const faits = niveau - premierNiveauDuPalier(index);   // 0..4
  return {
    actuel: palierInfo(index),
    suivant: palierInfo(index + 1),
    niveauBoss,
    restants: Math.max(0, niveauBoss - niveau),
    progression: Math.min(1, faits / NIVEAUX_PAR_PALIER),
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
  // --- LOT C : dosage des 6 nouvelles perles (tableau §C3 du cahier) ---
  nbLasers: number;       // 🥤 niveau ≥ 7, 1 max
  nbContagions: number;   // 🍯 niveau ≥ 4, 1-2
  nbLiens: number;        // 🔗 niveau ≥ 9, NOMBRE DE PAIRES (1 paire = 2 perles)
  nbMeches: number;       // 🧨 niveau ≥ 11, 1
  nbPortails: number;     // 🌀 niveau ≥ 13, NOMBRE DE PAIRES (1 paire = 2 perles)
  nbRoches: number;       // 🪨 niveau ≥ 10, 1-2
  // --- LOT PALIERS ---
  nbCascades: number;         // 💧 palier ≥ PALIER_CASCADE (niveau 21), puis toujours
  nbAimants: number;          // 🧲 palier ≥ PALIER_AIMANT (niveau 26), puis toujours
  palier: number;             // chapitre du parcours (cf. palierDuNiveau)
  renfort: SpecialBulle | null; // 🎖️ la perle DÉJÀ connue que CE chapitre double
};

// L'objectif tourne selon le niveau, en introduisant les buts progressivement.
function objectifNiveau(n: number, nbCouleurs: number): Objectif {
  if (n <= 2) return { type: 'capsules' };
  if (n % 5 === 0) return { type: 'boss', pv: 26 + n * 4 }; // 👹 niveaux boss (tous les 5)
  // Niveaux 3 à 6 : rotation historique conservée TELLE QUELLE. C'est le tunnel
  // d'apprentissage du jeu, déjà équilibré et testé — on n'y introduit aucun
  // objectif neuf (et les niveaux 5/6 sont figés par les tests).
  if (n <= 6) {
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
  // À partir du 7 : rotation de HUIT objectifs au lieu de quatre. Les créneaux
  // 0/1/3/6 gardent les objectifs historiques AUX MÊMES NIVEAUX (8-16-24-32
  // nettoyer, 14-22 tomber, 11-19-27 couleur, 9-17 capsules) ; les 4 nouveaux
  // occupent les créneaux 2, 4, 5 et 7. Les CIBLES sont bornées plus bas par la
  // matière réelle du plateau (cf. paramsNiveau) : jamais par ces formules seules.
  switch (n % 8) {
    case 0: return { type: 'nettoyer' };
    case 1: return { type: 'capsules' };
    case 2: return { type: 'speciales', cible: Math.min(6, 2 + Math.floor(n / 6)) };
    case 3: return { type: 'couleur', couleur: (n % nbCouleurs) as Couleur, cible: 10 + Math.floor(n / 3) };
    // 🔗 CHAÎNE : cible PLATE à 3, et non 3 + n/6 comme la borne haute l'autorise.
    // Mesuré (8 parties par niveau, bot qui matche dès qu'un match existe, 140 angles,
    // munition échangée comprise) : chaîne max = [2,3,3,3,4,4,5,6] au niveau 12,
    // [2,3,3,3,4,4,5,5] au 28, [2,2,2,3,3,4,4,9] au 36. Médiane 3-4, plancher 2.
    // Une cible de 5 ou 6 serait donc ingagnable la plupart des parties. 3 est en
    // plus la valeur qui parle au joueur : c'est CHAINE_MAX, le multiplicateur ×3
    // que le HUD affiche déjà. La difficulté progresse par le plateau (plus de
    // rangées, moins de tirs, plus de blocs), pas par un chiffre inatteignable.
    // 🩹 26/07 — la formule `Math.min(CHAINE_MAX, 3 + Math.floor(n / 6))` était MORTE :
    // son second terme vaut au moins 3 et `CHAINE_MAX` vaut 3, donc elle rendait toujours
    // 3. Elle laissait croire à une progression qui n'existait pas. On écrit l'intention
    // réelle, celle que le commentaire ci-dessus documente déjà : cible PLATE à CHAINE_MAX.
    case 4: return { type: 'chaine', cible: CHAINE_MAX };
    // 🏅 PARFAITS : un tir parfait = élastique à fond + au moins une perle éclatée.
    // Progression lente (3 → 5 sur 40 niveaux) : mesuré en force brute, un bot qui
    // tire toujours à fond atteint 4 à 6 parfaits par niveau, avec de la variance
    // selon le tirage des munitions. La borne dure de §C4 (35 % du budget) est
    // appliquée en plus dans paramsBruts.
    case 5: return { type: 'parfaits', cible: 3 + Math.floor(n / 16) };
    case 6: return { type: 'tomber', cible: Math.min(12, 6 + Math.floor(n / 3)) };
    // 🎉 LÂCHER : « N perles d'un seul coup ». Cible volontairement basse et bornée
    // par le plateau (cf. paramsNiveau + lacherAtteignable) : mesuré sur 12 parties de
    // bot, les plateaux denses des niveaux avancés ne lâchent que 1 à 8 perles d'un
    // coup, très loin des 8 à 18 que la géométrie laissait espérer.
    default: return { type: 'lacher', cible: Math.min(GROS_LACHER, 3 + Math.floor(n / 16)) };
  }
}

// Paramètres BRUTS d'un niveau : tout ce qui se déduit de `n` seul. Séparé de
// `paramsNiveau` parce que les bornes de faisabilité de 'lacher' exigent
// d'analyser le plateau réel, et que ce plateau se construit… à partir d'ici
// (sans cette coupure, paramsNiveau s'appellerait elle-même).
// 👹 PLAFOND DE DÉGÂTS PAR TIR d'un joueur ordinaire sur un niveau boss.
// MESURÉ (bot en force brute, 72 angles, 3 graines, niveaux 5 à 60, PV mis à l'infini
// pour lire le potentiel brut) : 1,28 à 4,63 dégâts par tir, médiane 3,46. La formule
// historique `26 + 4n` exigeait 3,9 dgt/tir au niveau 20 et 7,4 au niveau 40, alors que
// le budget de tirs, lui, PLAFONNE à 25 dès le niveau 24. Résultat mesuré avant
// correctif : les boss des niveaux 20, 25, 30, 35 et 40 étaient hors d'atteinte (0/5
// gagnés par le bot, et 53 à 87 dégâts infligés pour 106 à 186 PV demandés).
// C'est le cinquième niveau ingagnable livré en production ; il est borné ici comme
// l'ont été 'couleur', 'lacher', 'parfaits' et 'speciales' : par la matière RÉELLE.
// ⚠️ LEÇON À NE PAS REPERDRE — ce plafond n'a JAMAIS été le facteur limitant des boss.
// Quand l'arrivée de la 💧 Cascade a fait retomber le niveau 25 sous sa cible, le réflexe
// a été de baisser ce nombre : de 2,4 à 2,2 puis 2,05, soit une cible passée de 60 à 51.
// Résultat mesuré : 4 runs gagnées sur 32, à l'identique aux trois valeurs. Le bot ne
// manquait pas de dégâts, il MOURAIT — c'est la marge de rangées (cf. `margeBoss` dans
// paramsBruts) qui débloquait le niveau, et elle l'a fait passer de 4/32 à 25/32 à
// cible INCHANGÉE. Baisser un plafond de PV qui n'est pas le goulot ne fait que rendre
// le jeu plus fade sans rien réparer : mesurer AVANT de régler.
// Valeur finale, tous les niveaux boss de 1 à 60 mesurés entre 15 et 28 runs gagnées
// sur 32, dégâts atteignables 5 à 12 points au-dessus de la cible : de la marge réelle.
export const BOSS_DEGATS_PAR_TIR = 2.4;

// 🛡️ 27/07 — LE NUMÉRO DE NIVEAU EST ASSAINI UNE FOIS, ICI, ET PLUS NULLE PART.
// `aventure.niveauMax` est un champ PERSISTÉ qui arrive jusqu'ici (`shooter.tsx` ouvre
// `creerNiveau(niveau)`, `parcours.tsx` dessine `paramsNiveau(n)` par carte). Sans repli,
// un `n` non fini donnait `lignes: NaN` — donc un plateau VIDE, sans plafond, ingagnable
// et invisible — quand il ne levait pas carrément. Un niveau 1 propre est un bien
// meilleur repli qu'un plateau fantôme, et c'est le même repli que partout ailleurs dans
// la chaîne des paliers. Les niveaux réels (entiers ≥ 1) ne bougent pas d'un iota.
function niveauSur(n: number): number {
  return entierSur(n, 1);
}

// 🎖️ COMBIEN DE CASES COLORÉES la silhouette d'un niveau pose RÉELLEMENT. Les positions
// du motif sont FIXES (le rng ne tire que la COULEUR de chaque case, jamais sa présence),
// donc ce compte est connu SANS assembler le plateau — c'est ce qui casse la circularité
// que `mesurerPlateau` doit sinon contourner. Les rangées sous le motif sont pleines
// (`genererGrilleNiveau` les remplit à COLS), et ce sont elles qui, aux niveaux avancés,
// « enterrent la silhouette sous une dalle » : ce compte les inclut, car ce sont autant
// de cases où une spéciale peut atterrir.
function cellulesSilhouette(n: number, lignes: number): number {
  const motif = motifDuNiveau(n);
  let total = 0;
  for (let r = 0; r < lignes; r++) {
    const masque = motif[r];
    total += masque ? [...masque].filter((ch) => ch === '#').length : COLS;
  }
  return total;
}

// 🎖️ RATIONNEMENT DES SPÉCIALES PAR LA MATIÈRE (27/07/2026 — défaut « renfort sacrifié »).
//
// LE CONSTAT : au-delà du niveau ~20, `paramsBruts` demande plus de perles spéciales que
// le plateau n'a de cases. `poserSpecial` échoue alors en silence, et comme le RENFORT de
// chapitre est posé EN DERNIER, c'est lui la première victime : mesuré, le niveau 49
// annonçait le chapitre « Verger Givré / Supernova » mais ne portait AUCUNE 🌟 (0 perle
// ordinaire non plus — un plateau « soupe »). `alignerSurPoses` cachait le trou en
// rabattant l'annonce sur le posé : plus d'incohérence visible, mais la promesse du boss
// (« ce chapitre fait entrer la Supernova ») restait trahie sur ces niveaux.
//
// LE CORRECTIF (celui que le cahier demande, cf. `plafondBloc` pour les blocs) : on borne
// le total des spéciales de BASE par la matière réellement disponible, en RÉSERVANT
// d'abord la place du renfort et un plancher de perles ordinaires (sans quoi le plateau
// n'a plus de quoi se matcher). Quand ça déborde, on rabote — les blocs d'abord (ils
// n'apportent aucun match et sont justement ce qui « enterre la silhouette »), jamais le
// renfort. Résultat : tout niveau qui ANNONCE une perle de chapitre la porte vraiment.
//
// ⚠️ INERTE sur les niveaux figés : les niveaux ≤ 15 ne saturent pas (ils demandent bien
// moins que leur budget), donc `dose` en ressort inchangé, donc leur suite de tirages
// `poserSpecial` — et leur empreinte bit à bit — ne bouge pas d'un iota.
type CleDose =
  | 'glacon' | 'roche' | 'portail' | 'contagion' | 'givre' | 'bombe' | 'bonus'
  | 'tir' | 'arc' | 'lien' | 'laser' | 'meche' | 'etoile' | 'cascade' | 'aimant';
type DoseSpeciales = Record<CleDose, number>;

// Ordre de rabotage : du plus SACRIFIABLE au plus précieux. Les trois blocs (`bloc: true`)
// en tête — ils ne se matchent jamais et forment la « dalle » — puis les décoratives
// abondantes, et en dernier les perles de signature (paille, mèche, supernova, cascade,
// aimant) qui donnent son identité au chapitre. Le renfort, lui, n'est JAMAIS dans cette
// liste : il est réservé hors budget.
const ORDRE_RABOTAGE: CleDose[] = [
  'glacon', 'roche', 'portail', 'contagion', 'givre', 'bombe', 'bonus', 'tir', 'arc',
  'lien', 'laser', 'meche', 'etoile', 'cascade', 'aimant',
];
// 🔗🌀 Deux perles = une paire : les raboter coûte 2 cases d'un coup, et jamais une
// demi-paire (`poserPaire` refuse déjà une paire incomplète).
const CLES_PAIRE: CleDose[] = ['lien', 'portail'];
// Plancher de perles ORDINAIRES à préserver, pour que le plateau reste matchable — sans
// lui, un plateau saturé devient la « soupe » décrite plus haut (niveau 49 → 0 ordinaire).
// Un plancher PLAT, et non proportionnel : le vrai problème n'est pas la taille du plateau
// mais le RATIO spéciales/cases. Un plateau LARGE bien pourvu (le niveau 31 et ses 10
// perles ordinaires) n'a aucun besoin d'être raboté ; un plateau ÉTROIT saturé (le boss et
// ses 3 perles ordinaires) en a un besoin criant. Un plancher proportionnel rabotait le
// premier plus fort que le second — l'inverse de l'intention. Un seuil plat ne mord donc
// QUE là où la matière ordinaire descend sous ce seuil, et laisse intacts (au bit près,
// suite de tirages comprise) tous les plateaux déjà sains — dont ceux que les tests figent.
const PLANCHER_MATIERE = 8;

function rationnerSpeciales(
  n: number, lignes: number, nbCapsules: number,
  renfort: SpecialBulle | null, dose: DoseSpeciales,
): void {
  const casesColorees = cellulesSilhouette(n, lignes);
  const coutRenfort = renfort ? (renfort === 'lien' ? 2 : 1) : 0;
  // Budget en cases pour les spéciales de base = tout ce que la silhouette pose, moins les
  // capsules (qui prennent aussi une case colorée), moins la place réservée au renfort,
  // moins le plancher de matière ordinaire. Jamais négatif.
  const budget = Math.max(0, casesColorees - nbCapsules - coutRenfort - PLANCHER_MATIERE);
  const cout = (k: CleDose) => (CLES_PAIRE.includes(k) ? 2 : 1);
  const total = () => ORDRE_RABOTAGE.reduce((s, k) => s + dose[k] * cout(k), 0);
  // Rabotage déterministe : on vide chaque poste dans l'ordre, du plus sacrifiable au
  // moins, jusqu'à tenir dans le budget. `while` par UNITÉ pour que les paires (coût 2)
  // s'arrêtent au bon moment sans jamais dépasser en négatif.
  for (const k of ORDRE_RABOTAGE) {
    while (dose[k] > 0 && total() > budget) dose[k]--;
    if (total() <= budget) break;
  }
}

function paramsBruts(nBrut: number): ParamsNiveau {
  const n = niveauSur(nBrut);
  const boss = n % 5 === 0;
  const palier = palierDuNiveau(n);
  const nbCouleursBase = n <= 3 ? 4 : n <= 9 ? 5 : 6;
  const objectif = objectifNiveau(n, nbCouleursBase);
  // 🔗 FAISABILITÉ de 'chaine' — MESURE avant réglage. Enchaîner N matchs n'est une
  // affaire d'adresse que si une couleur matchable est presque toujours disponible.
  // À 6 couleurs, sur les niveaux 12 / 28 / 36, 10 à 16 tirs sur 21 à 27 n'offraient
  // AUCUN match possible (160 angles × munition courante ET échangée) : la chaîne
  // plafonnait à 3 quelle que soit la stratégie, et une cible de 5-6 était donc
  // ingagnable. On réduit la palette de CES niveaux : c'est la matière du plateau qui
  // doit porter l'objectif, jamais le tirage de la munition.
  // (L'objectif 'couleur' est décidé avec la palette de base : aucune circularité,
  // 'chaine' et 'couleur' ne peuvent pas être le même niveau.)
  const nbCouleurs = objectif.type === 'chaine' ? Math.min(nbCouleursBase, 4) : nbCouleursBase;
  // capsules uniquement quand c'est l'objectif ('boss' exclut 'capsules', donc pas
  // de capsule bonus à ajouter ici — l'ancien `+ (boss ? 1 : 0)` était mort).
  const nbCapsules = objectif.type === 'capsules'
    ? Math.min(1 + Math.floor((n - 1) / 6), 3)
    : 0;
  // ⏱️ Rythme resserré (Shooter v2, 19/07/2026) : 25 tirs de base au lieu de 28 —
  // chaque tir compte, les perles « +1 tir » et le RUSH rendent le budget vivant.
  // 🩹 26/07 : l'objectif 'couleur' était le SEUL sans bonus de tirs alors que sa
  // cible monte avec le niveau → budget aligné sur 'tomber'/'nettoyer'.
  const lignesBase = Math.min(4 + Math.floor((n - 1) / 4), 7);
  // Budget : 'capsules' est déjà payé par `nbCapsules * 4`, le boss par +12, et TOUT
  // objectif chiffré (tomber/nettoyer/couleur + les 4 nouveaux) reçoit les mêmes +6.
  // Écrit comme un « sinon » et non comme une liste blanche : un objectif de plus ne
  // doit pas pouvoir se retrouver silencieusement avec un budget de niveau 'capsules'.
  const bonusTirsObjectif = objectif.type === 'boss' ? 12 : objectif.type === 'capsules' ? 0 : 6;
  const tirsBase = 25 - Math.min(12, Math.floor(n / 2)) + nbCapsules * 4 + bonusTirsObjectif;
  // 🩹 26/07 — « Nettoyer » exige de vider TOUT le plateau : son budget doit suivre la
  // taille du plateau, pas seulement décroître avec le niveau. Plancher à 3,5 tirs par
  // rangée (7 lignes → 25 tirs) : exigeant, mais plus arithmétiquement perdu d'avance.
  const tirsMax = objectif.type === 'nettoyer'
    ? Math.max(tirsBase, Math.round(lignesBase * 3.5))
    : tirsBase;
  // 🩹 26/07 — « Nettoyer » demandait de vider ~44 perles en 19 tirs PENDANT que la
  // descente en rajoutait 8 toutes les 6 rangées : ~3,6 perles détruites par tir sans
  // jamais rater, soit un objectif hors d'atteinte. La descente est donc deux fois
  // plus lente sur ces niveaux — la pression reste, la course perdue d'avance non.
  // (À retester en conditions réelles : c'est le réglage le plus « à l'estime » du lot.)
  const descenteBase = n <= 6 ? 0 : n <= 14 ? 8 : 6;
  const tirsParDescente = objectif.type === 'nettoyer' ? descenteBase * 2 : descenteBase;
  // 🩹 26/07 — LE MUR INVISIBLE : la rangée la plus basse d'un plateau de `lignes`
  // lignes est à l'index `lignes - 1`, et on perd à LIGNE_LIMITE. Il n'y a donc que
  // `LIGNE_LIMITE - (lignes - 1)` descentes de marge. À 7 lignes et 6 tirs/descente,
  // le joueur mourait au tir 24 alors que le HUD lui promettait jusqu'à 30 tirs.
  // On borne le plateau pour que la descente ne tue JAMAIS avant la fin du budget :
  // elle reste une pression réelle (il faut dégager le bas), plus un couperet caché.
  // 👹 27/07 — LE MUR INVISIBLE OUBLIAIT LE BOSS, et c'est ce qui rendait ses niveaux
  // mortels : la formule ne provisionne que la descente PÉRIODIQUE, alors que l'attaque
  // « Pluie de perles » ajoute elle aussi une rangée. Le plafond descendait donc deux fois
  // plus vite que garanti (mesuré : le bot mourait enterré avec un tiers de son budget en
  // main). Le correctif ne touche PAS à cette formule mais à la source, dans
  // `appliquerActionBoss` : une Pluie de perles REMET À ZÉRO le compteur de la descente
  // périodique, donc les deux ne se cumulent plus et la garantie ci-dessous redevient vraie.
  // (Essayé et REJETÉ : retirer des rangées de départ aux niveaux boss. Leur plateau se
  // régénère, donc la matière ne manquait pas — mais un plateau de 4 rangées, soit ~23
  // cases, ne peut pas porter les ~27 perles spéciales que le niveau 50 demande :
  // `poserSpecial` échouait en série et laissait des jumelles 🔗 dépareillées.)
  // …et UNE RANGÉE DE MARGE en plus sur un niveau boss. La remise à zéro ci-dessus
  // empêche les deux horloges de se cumuler, mais elle ne les fusionne pas : le boss
  // choisit QUAND il fait pleuvoir, donc il peut déclencher tôt puis laisser l'horloge
  // périodique repartir — sur un budget de 25 tirs on mesure 5 à 6 rangées là où la
  // formule n'en provisionne que 5. Cette formule est calibrée pour tuer EXACTEMENT au
  // dernier tir (`LIGNE_LIMITE + 1`) : sans marge, la moindre rangée de plus tue avant.
  // Une rangée suffit, et le plateau d'un niveau boss se régénère — il ne perd donc
  // aucune matière (contrairement à l'essai à −3 rangées, qui saturait les poses).
  const margeBoss = objectif.type === 'boss' ? 1 : 0;
  const lignesMax = tirsParDescente > 0
    ? LIGNE_LIMITE + 1 - Math.ceil(tirsMax / tirsParDescente) - margeBoss
    : 7;
  const lignes = Math.max(4, Math.min(lignesBase, lignesMax));
  // 🩹 26/07 — L'objectif 'couleur' était ARITHMÉTIQUEMENT ingagnable en fin de
  // parcours : la cible montait (10 + n/3 → 20 au niveau 31) pendant que le budget
  // descendait (25 − n/2 → 13). Au niveau 27 il fallait éclater 19 perles roses
  // alors qu'il n'en existerait jamais plus d'une douzaine sur toute la partie.
  // La cible est désormais indexée sur le budget de tirs réel.
  if (objectif.type === 'couleur') {
    objectif.cible = Math.max(8, Math.min(objectif.cible, Math.round(tirsMax * 0.6)));
  }
  // 👹 FAISABILITÉ DU BOSS : ses PV sont un MULTIPLE DU BUDGET DE TIRS, jamais une
  // formule en `n` seule. Le rythme exigé monte d'un palier à l'autre (1,3 dégât par tir
  // au premier boss → le plafond mesuré de 2,9 à partir du palier 5), puis se stabilise :
  // au-delà, c'est le budget qui rétrécit, donc le boss se durcit tout seul.
  // La borne historique `26 + 4n` est conservée comme PLAFOND, mais elle n'est le facteur
  // limitant QU'AU PREMIER BOSS. 🩹 27/07 — le commentaire précédent affirmait « le boss
  // du niveau 5 garde ses 46 PV, celui du 10 ses 66 » : la première moitié est vraie, la
  // seconde était FAUSSE, et de 14 PV. Mesuré sur l'arbre courant :
  //   · niveau 5  → palier 0, rythme 1,30, budget 35 tirs → 35 × 1,30 = 46 ; le plafond
  //     historique vaut 46 lui aussi : les deux coïncident, le boss garde bien ses 46 PV ;
  //   · niveau 10 → palier 1, rythme 1,62, budget 32 tirs → 32 × 1,62 = 52, très en
  //     dessous du plafond historique (66). C'est donc le CLAMP DE FAISABILITÉ qui mord,
  //     pas le plafond — et c'est le sens même de ce lot : dès le palier 1, le budget de
  //     tirs a déjà baissé (35 → 32) quand `26 + 4n` continue de monter tout droit.
  // À partir du niveau 10, le plafond historique n'est donc plus jamais atteint (66 contre
  // 52, 266 contre 60 au niveau 60) : il ne reste qu'une borne de sécurité. Seuls les boss
  // qui demandaient l'impossible sont ramenés sur terre.
  if (objectif.type === 'boss') {
    const rythme = Math.min(BOSS_DEGATS_PAR_TIR, 1.3 + 0.32 * palier);
    objectif.pv = Math.max(20, Math.min(objectif.pv, Math.round(tirsMax * rythme)));
  }
  // perles spéciales, introduites progressivement
  // 👹 LES BLOCS SONT RATIONNÉS SUR UN NIVEAU BOSS. Un bloc (glaçon 🧊, roche 🪨) ne se
  // matche jamais ET n'inflige AUCUN dégât : `objProgres` compte `eclatees.filter(x =>
  // !estBloc(x.bulle))`. Sur un niveau boss — le seul dont la victoire est une COURSE aux
  // dégâts contre un budget de tirs — chaque bloc retire donc une case utile de la course.
  // Mesuré au niveau 20 : 26 perles spéciales et 8 blocs pour 34 cases, soit 8 perles
  // colorées en tout. Il n'y avait littéralement plus de quoi former des groupes de 3.
  // Même famille d'exclusion que 'nettoyer' juste en dessous, et pour une raison de même
  // nature : ne pas livrer un objectif que le plateau interdit.
  const plafondBloc = objectif.type === 'boss' ? 1 : 4;
  // 🧊🪨🌀 27/07 — LES BLOCS MURENT UNE CAPSULE AUTANT QU'UN « VIDE LE PLATEAU ». Un bloc
  // (glaçon, roche, portail) ne se matche JAMAIS : sur un niveau capsules, il empêche de
  // creuser le tunnel jusqu'au soutien de la capsule, donc de la décrocher. Mesuré sur le
  // niveau 17 (le seul niveau capsules réellement INGAGNABLE du parcours) : 4000 parties
  // aléatoires + un bot à 3 coups d'anticipation, ZÉRO capsule libérée — et les 3 capsules
  // se décrochent toutes dès qu'on retire ses 8 blocs. On les exclut donc des niveaux
  // capsules exactement comme des niveaux nettoyer, et pour la même raison : ne pas livrer
  // un objectif que le plateau interdit. ⚠️ Réservé aux niveaux > 14 : ceux ≤ 14 sont FIGÉS
  // bit à bit par les tests de caractérisation, et le seul niveau capsules concerné (le 9)
  // garde ainsi ses 2 glaçons historiques.
  const blocsMurent = objectif.type === 'nettoyer'
    || (objectif.type === 'capsules' && n > 14);
  const nbGlacons = blocsMurent ? 0
    : n >= 4 ? Math.min(1 + Math.floor((n - 4) / 3), plafondBloc) : 0;
  const nbBombes = n >= 6 ? Math.min(1 + Math.floor((n - 6) / 4), 3) : 0;
  const nbGivre = n >= 8 ? Math.min(1 + Math.floor((n - 8) / 4), 3) : 0;
  const nbArc = n >= 5 && n % 3 === 0 ? 1 : 0;
  const nbBonus = n >= 3 ? Math.min(1 + Math.floor((n - 3) / 3), 3) : 0;
  // 🌟 un niveau sur deux dès le 6 — MAIS les niveaux 'couleur' tombent toujours sur
  // n impair (n % 4 === 3), donc ils n'avaient jamais de SUPERNOVA… alors que c'est
  // le seul outil qui balaie une couleur entière. Corrigé le 26/07.
  const nbEtoiles = n >= 6 && (n % 2 === 0 || objectif.type === 'couleur') ? 1 : 0;
  const nbTirsPlus = n >= 5 ? Math.min(1 + Math.floor((n - 5) / 6), 2) : 0; // 🎁
  // --- LOT C : les 6 nouvelles perles, dosage du tableau §C3 ---
  const nbLasers = n >= 7 ? 1 : 0;                                            // 🥤
  const nbContagions = n >= 4 ? Math.min(1 + Math.floor((n - 4) / 6), 2) : 0; // 🍯
  const nbLiens = n >= 9 ? 1 : 0;                                             // 🔗 1 paire
  const nbMeches = n >= 11 ? 1 : 0;                                           // 🧨
  // 🌀 26/07 — Exclu des niveaux `nettoyer`, comme le glaçon et la roche : le portail est
  // un `bloc`, il ne se matche JAMAIS. Sur un « vide TOUT le plateau », il ne peut partir
  // que par gravité, et il est justement posé en pleine matière (c'est son intérêt de
  // trajectoire). Il n'y a aucune raison de traiter le 3ᵉ bloc du jeu autrement que les
  // deux autres. Niveaux concernés : 16, 24, 32, 48, 56.
  const nbPortails = blocsMurent ? 0 : n >= 13 ? 1 : 0;                        // 🌀 1 paire
  // 🪨 La roche ne tombe jamais : sur un niveau « vide TOUT le plateau » elle serait
  // le seul obstacle à ne pas pouvoir partir par gravité. Même exclusion que le
  // glaçon (et pour la même raison sur les niveaux capsules, cf. `blocsMurent`).
  const nbRoches = blocsMurent ? 0
    : n >= 10 ? Math.min(1 + Math.floor((n - 10) / 6), Math.min(2, plafondBloc)) : 0;
  // 🎖️ LE RENFORT DE PALIER — la récompense concrète d'un boss vaincu, posée EN PLUS.
  // Il arrive exactement là où tous les autres dosages ont fini de monter (le dernier
  // seuil du jeu est le givre, au niveau 16) : c'est la zone plate que le commanditaire
  // a vue à l'œil nu. Volontairement +1 et pas +3 — mesuré, un plateau de niveau 40
  // porte déjà ~27 perles spéciales pour ~42 cases : au-delà, `poserSpecial` échoue et
  // le plateau devient une soupe où plus rien ne se matche.
  // ⚠️ Exclu des niveaux 'couleur' : leur cible se compte en perles D'UNE COULEUR, et
  // toute perle spéciale posée est une perle colorée EN MOINS. Mesuré : le niveau 19,
  // déjà limite, devenait ingagnable en force brute avec un renfort de plus.
  const renfort = objectif.type === 'couleur' ? null : renfortPalier(palier);
  // 💧🧲 LES DEUX PERLES DE PALIER. Une seule de chaque : la Cascade démonte une colonne
  // entière et l'Aimant vide une fenêtre de 5×5 — à deux exemplaires elles résoudraient
  // le plateau toutes seules. Elles restent acquises pour tous les chapitres suivants
  // (`>=`), sinon « ce que le boss a ouvert » se refermerait au chapitre d'après.
  const nbCascades = palier >= PALIER_CASCADE ? 1 : 0;
  const nbAimants = palier >= PALIER_AIMANT ? 1 : 0;
  // 🎖️ On rabat le dosage BRUT ci-dessus sur ce que la silhouette peut porter (cf.
  // `rationnerSpeciales`). `dose` devient la source unique des compteurs pour la suite :
  // faisabilité de 'speciales', ET la grille (le plateau est assemblé à partir de CE
  // dosage rationné, donc `mesurerPlateau` et `creerNiveau` restent d'accord au bit près).
  const dose: DoseSpeciales = {
    glacon: nbGlacons, roche: nbRoches, portail: nbPortails, contagion: nbContagions,
    givre: nbGivre, bombe: nbBombes, bonus: nbBonus, tir: nbTirsPlus, arc: nbArc,
    lien: nbLiens, laser: nbLasers, meche: nbMeches, etoile: nbEtoiles,
    cascade: nbCascades, aimant: nbAimants,
  };
  rationnerSpeciales(n, lignes, nbCapsules, renfort, dose);
  // 🎯 FAISABILITÉ de 'speciales' : la cible ne peut pas dépasser ce que le plateau
  // porte réellement. On compte les spéciales dont l'effet PAIE quand elles partent
  // (bombe, bonus, étoile, +1 tir, paille, sirop, jumelles, mèche) — pas les blocs
  // ni les armures, qu'on ne « déclenche » pas. Marge : on ne demande jamais plus de
  // la moitié, et `creerNiveau` sème des bonus si la pose réelle est trop pauvre.
  // Calculée sur le dosage RATIONNÉ : la cible suit ce que le plateau porte, pas ce
  // que `paramsBruts` aurait voulu poser.
  const declenchables = dose.bombe + dose.bonus + dose.etoile + dose.tir
    + dose.laser + dose.contagion + dose.lien * 2 + dose.meche + dose.cascade + dose.aimant
    // le renfort est déclenchable dans tous les cas (aucun chapitre ne renforce un bloc)
    + (renfort ? (renfort === 'lien' ? 2 : 1) : 0);
  if (objectif.type === 'speciales') {
    objectif.cible = Math.max(2, Math.min(objectif.cible, Math.floor(declenchables / 2)));
  }
  // 🎯 FAISABILITÉ de 'parfaits' : un tir parfait coûte un tir. Plafond à 35 % du
  // budget (règle §C4) pour laisser de la marge aux ratés d'apprentissage.
  if (objectif.type === 'parfaits') {
    objectif.cible = Math.min(objectif.cible, Math.max(3, Math.floor(tirsMax * 0.35)));
  }
  return {
    niveau: n, boss, lignes, nbCouleurs, nbCapsules, tirsMax, tirsParDescente,
    objectif,
    nbGlacons: dose.glacon, nbBombes: dose.bombe, nbGivre: dose.givre, nbArc: dose.arc,
    nbBonus: dose.bonus, nbEtoiles: dose.etoile, nbTirsPlus: dose.tir,
    nbLasers: dose.laser, nbContagions: dose.contagion, nbLiens: dose.lien,
    nbMeches: dose.meche, nbPortails: dose.portail, nbRoches: dose.roche,
    nbCascades: dose.cascade, nbAimants: dose.aimant, palier, renfort,
  };
}

// 🎯 FAISABILITÉ de 'lacher' — la seule borne qui exige de REGARDER le plateau.
//
// ⚠️ Deux modèles ont été essayés et MESURÉS avant de choisir celui-ci :
//  1. « Perles sous la Perle Paille » : structurellement exact (raser une ligne
//     décroche tout ce qui est dessous, deux lignes non adjacentes ne se touchant
//     jamais dans une grille hexagonale décalée) mais FAUX en pratique — la paille
//     est enfouie dans la matière, et 0 angle sur 400 permet de la faire éclater au
//     premier tir. Cette borne annonçait 10 à 18 perles là où un bot prudent en
//     décrochait 1 à 8. Rejetée : une borne de faisabilité ne doit jamais surestimer.
//  2. Le modèle ci-dessous : le joueur ÉRODE k rangées par le bas (ce que fait toute
//     partie), puis coupe le meilleur pont. Pour chaque groupe de même couleur déjà
//     présent (≥ 2 perles, la perle posée fera la troisième) qui touche une case libre
//     posable, on retire le groupe et on compte les orphelines. Mesuré contre 12
//     parties de bot : le modèle annonce 4/2/4/4 aux niveaux 7/23/31/39 pour des
//     lâchers réellement obtenus de 4/8/6/3 — conservateur partout, jamais optimiste.
//
// Les roches (qui ne tombent jamais) et les capsules (que l'objectif ne compte pas)
// sont exclues du décompte.
export function lacherAtteignable(grille: Ligne[]): number {
  let max = 0;
  // k = rangées du bas déjà consommées par le joueur (0 à 3 : au-delà, le budget de
  // tirs d'un niveau avancé ne suffit plus à creuser).
  for (let k = 0; k <= 3; k++) {
    const g = grille.slice(0, grille.length - k);
    if (g.length < 2) break;
    const vus = new Set<string>();
    for (let r = 0; r < g.length; r++) {
      for (let c = 0; c < COLS; c++) {
        const b = g[r].cases[c];
        if (!b || estBloc(b) || vus.has(`${r}:${c}`)) continue;
        const groupe = groupeMemeCouleur(g, { r, c });
        for (const cas of groupe) vus.add(`${cas.r}:${cas.c}`);
        if (groupe.length < 2) continue;   // + la perle posée = 3, le seuil d'éclat
        // … à condition qu'une case libre POSABLE touche ce groupe.
        let posable = false;
        for (const cas of groupe) {
          for (const v of voisins(g, cas.r, cas.c)) {
            if (g[v.r].cases[v.c]) continue;
            if (v.r === 0 || voisins(g, v.r, v.c).some((w) => !!g[w.r].cases[w.c])) { posable = true; break; }
          }
          if (posable) break;
        }
        if (!posable) continue;
        const copie = g.map((l) => ({ decalee: l.decalee, cases: [...l.cases] }));
        for (const cas of groupe) copie[cas.r].cases[cas.c] = null;
        let n = 0;
        for (const o of orphelines(copie)) {
          const ob = copie[o.r].cases[o.c];
          if (ob && !ob.capsule && !infoPerle(ob)?.neTombeJamais) n++;
        }
        if (n > max) max = n;
      }
    }
  }
  return max;
}

// Mémo de la mesure ci-dessous : `paramsNiveau` est appelée DANS LE RENDU (parcours.tsx
// dessine une carte par niveau, shooter.tsx la relit à chaque frame). Le niveau étant
// déterministe, la valeur ne peut pas changer — on ne construit son plateau qu'une fois.
const MEMO_PLATEAU = new Map<number, { poses: JournalPoses; lacher: number | null }>();
const GRAINE_NIVEAU = 900913;

// 🩹 27/07 — ON MESURE LE PLATEAU RÉEL, ON N'EXTRAPOLE PLUS.
// Le dosage de `paramsBruts` est une DEMANDE ; le plateau, lui, peut la refuser quand il
// n'a plus de case libre. Mesuré avant correctif : niveau 15 → paire de portails 🌀
// demandée, ZÉRO posée ; niveau 49 → Supernova 🌟 de renfort absente ; niveau 60 → 1
// Paille 🥤 sur 2. Trois promesses de `paramsNiveau` que le plateau ne tenait pas, sans
// la moindre trace. On construit donc le plateau une fois, on relève ce qu'il a accepté,
// et `paramsNiveau` n'annonce que cela.
// ⚠️ Le plateau est TOUJOURS assemblé à partir du dosage BRUT — jamais du dosage aligné.
// C'est la clé de la déterminisme : la pose consomme le rng, donc réinjecter un dosage
// réduit produirait un AUTRE plateau, donc une autre mesure, donc un autre alignement.
// `lacher` reste PARESSEUX : `lacherAtteignable` est la partie coûteuse, et un niveau
// sur six seulement porte cet objectif.
function mesurerPlateau(n: number, avecLacher: boolean): { poses: JournalPoses; lacher: number | null } {
  const niveau = niveauSur(n);
  const cache = MEMO_PLATEAU.get(niveau);
  if (cache && (cache.lacher !== null || !avecLacher)) return cache;
  const brut = paramsBruts(niveau);
  const pool = Array.from({ length: brut.nbCouleurs }, (_, i) => i as Couleur);
  const poses: JournalPoses = {};
  // Même graine et même assemblage que creerNiveau → EXACTEMENT le même plateau.
  const grille = assemblerPlateau(brut, pool, creerRng(GRAINE_NIVEAU + niveau * 7919), poses);
  const mesure = { poses, lacher: avecLacher ? lacherAtteignable(grille) : null };
  MEMO_PLATEAU.set(niveau, mesure);
  return mesure;
}

// 🎖️ ALIGNE LE DOSAGE ANNONCÉ SUR LE DOSAGE POSÉ. Deux règles, dans cet ordre :
//  1. le dosage HISTORIQUE du niveau est servi en premier — c'est la promesse de base ;
//  2. le RENFORT de palier, qui est le supplément du chapitre, saute en dernier : sur un
//     plateau saturé, mieux vaut perdre le bonus que la matière du niveau lui-même.
// Une paire (🔗 jumelles, 🌀 portails) compte pour DEUX perles et ne s'annonce qu'entière
// (`Math.floor(… / 2)`) : une demi-paire n'est pas une demi-promesse, c'est un défaut.
function alignerSurPoses(p: ParamsNiveau, poses: JournalPoses): void {
  const reste: JournalPoses = { ...poses };
  const prendre = (special: SpecialBulle, voulu: number): number => {
    const dispo = reste[special] ?? 0;
    const pris = Math.max(0, Math.min(voulu, dispo));
    reste[special] = dispo - pris;
    return pris;
  };
  p.nbGlacons = prendre('glacon', p.nbGlacons);
  p.nbBombes = prendre('bombe', p.nbBombes);
  p.nbGivre = prendre('givre', p.nbGivre);
  p.nbArc = prendre('arc', p.nbArc);
  p.nbBonus = prendre('bonus', p.nbBonus);
  p.nbEtoiles = prendre('etoile', p.nbEtoiles);
  p.nbTirsPlus = prendre('tir', p.nbTirsPlus);
  p.nbLasers = prendre('laser', p.nbLasers);
  p.nbContagions = prendre('contagion', p.nbContagions);
  p.nbRoches = prendre('roche', p.nbRoches);
  p.nbMeches = prendre('meche', p.nbMeches);
  p.nbLiens = Math.floor(prendre('lien', p.nbLiens * 2) / 2);
  p.nbPortails = Math.floor(prendre('portail', p.nbPortails * 2) / 2);
  p.nbCascades = prendre('cascade', p.nbCascades);
  p.nbAimants = prendre('aimant', p.nbAimants);
  if (p.renfort) {
    const besoin = p.renfort === 'lien' ? 2 : 1;
    if (prendre(p.renfort, besoin) < besoin) p.renfort = null;
  }
}

export function paramsNiveau(n: number): ParamsNiveau {
  const p = paramsBruts(n);
  alignerSurPoses(p, mesurerPlateau(p.niveau, false).poses);
  if (p.objectif.type === 'lacher') {
    const atteignable = mesurerPlateau(p.niveau, true).lacher ?? 0;
    // Second correctif de réalisme : décrocher une grappe DEMANDE des tirs (creuser,
    // préparer la couleur, viser le pont). Un niveau à 19 tirs n'a pas le temps d'un
    // niveau à 28. On pondère donc la borne par le budget réel — c'est ce qui sépare
    // le niveau 7 (28 tirs, cible 3) du niveau 39 (19 tirs, même potentiel brut).
    const parBudget = Math.round(atteignable * Math.min(1, p.tirsMax / 25));
    // Un plateau incapable de lâcher deux perles d'un coup ne peut pas porter cet
    // objectif : on REPLIE sur 'tomber' (cumulatif, historiquement sûr) plutôt que de
    // livrer un compteur qui n'atteindra jamais sa cible. Le repli ne change ni le
    // budget de tirs ni le dosage des perles (mêmes règles que 'lacher').
    // `p.niveau` et non `n` : c'est le numéro DÉJÀ assaini (cf. `niveauSur`), sinon un
    // `n` non fini rendrait ici une cible NaN — un compteur qui n'avance jamais.
    if (parBudget < 2) p.objectif = { type: 'tomber', cible: Math.min(12, 6 + Math.floor(p.niveau / 3)) };
    else p.objectif.cible = Math.max(2, Math.min(p.objectif.cible, parBudget));
  }
  return p;
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
  // --- 🎖️ SILHOUETTES DE PALIER (6 de plus) : elles n'entrent dans la rotation qu'à
  // partir du chapitre 4. Toutes vérifiées SANS orpheline de 4 à 7 rangées. ---
  ['########', '.######.', '..#..#..', '.##.##..', '...##...'],   // sablier
  ['########', '#####...', '.#####..', '..#####.', '...#####'],   // escalier
  ['########', '#.#.#.#.', '########', '.#....#.', '.##..##.'],   // couronne
  ['########', '##.##.##', '#.#..#.#', '########', '..#..#..'],   // trident
  ['########', '##....##', '#.####.#', '##....##', '########'],   // anneau
  ['########', '##.##.##', '.#.##.#.', '..####..', '.##..##.'],   // papillon
];
// Les 12 silhouettes HISTORIQUES : la rotation d'avant le palier 4, figée par les tests
// (« les 12 plateaux doivent être distincts ») et par le tunnel d'apprentissage.
const MOTIFS_HISTORIQUES = 12;

// 🎖️ Une silhouette de palier est un DÉBLOCAGE, pas un décor : tant que le joueur n'a
// pas franchi le chapitre 4, la rotation est EXACTEMENT celle d'avant (12 motifs) ;
// à partir de là, six formes inédites entrent dans la roue (18 motifs). C'est la
// deuxième moitié de la promesse d'un boss : le parcours change de tête, pas seulement
// de numéro.
function motifDuNiveau(n: number): string[] {
  const dispo = palierDuNiveau(n) >= 4 ? MOTIFS_PLATEAU.length : MOTIFS_HISTORIQUES;
  return MOTIFS_PLATEAU[(n - 1) % dispo];
}

function genererGrilleNiveau(p: ParamsNiveau, pool: Couleur[], rng: Rng): Ligne[] {
  const motif = motifDuNiveau(p.niveau);
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

// 🎖️ CE QUE LE PLATEAU A RÉELLEMENT ACCEPTÉ, par type de perle. Rempli au fil des poses
// et lu par `mesurerPlateau` : c'est la seule source honnête du dosage, puisque le
// plateau peut REFUSER une pose (saturation) sans que personne s'en aperçoive.
type JournalPoses = Partial<Record<SpecialBulle, number>>;

// Assemblage du plateau : silhouette + capsules + perles spéciales. Extrait de
// `creerNiveau` pour que la borne de faisabilité de 'lacher' puisse analyser LE
// plateau réel (cf. mesurerPlateau). ⚠️ Ne lit JAMAIS `p.objectif.cible` : c'est ce qui
// garantit que le plateau analysé par `paramsNiveau` et celui construit par
// `creerNiveau` sont identiques, à graine égale.
// `poses` est un paramètre optionnel FINAL : les appelants historiques ne changent pas.
function assemblerPlateau(p: ParamsNiveau, pool: Couleur[], rng: Rng, poses?: JournalPoses): Ligne[] {
  const n = p.niveau;
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
  // `rMax` (exclu) est optionnel et n'est utilisé que par les nouvelles perles : le
  // laisser vide reproduit EXACTEMENT la suite de tirages historique.
  // 🩹 27/07 — RETOURNE LA BULLE ÉCRITE (ou null si le plateau n'avait plus de place).
  // Le retour était `void` : personne ne pouvait donc savoir qu'une pose avait échoué,
  // et c'est ce silence qui laissait passer une jumelle 🔗 orpheline et une perle promise
  // par `paramsNiveau` absente du plateau. Le journal `poses` compte ce qui a RÉELLEMENT
  // été accepté — c'est lui qui permet à `paramsNiveau` de n'annoncer que le vrai.
  const poserSpecial = (rMin2: number, appliquer: (b: Bulle) => void, rMax = grille.length): Bulle | null => {
    const haut = Math.max(rMin2 + 1, rMax);
    const ecrire = (b: Bulle) => {
      appliquer(b);
      if (poses && b.special) poses[b.special] = (poses[b.special] ?? 0) + 1;
      return b;
    };
    for (let essai = 0; essai < 40; essai++) {
      const r = rMin2 + Math.floor(rng() * (haut - rMin2));
      const c = Math.floor(rng() * COLS);
      const b = grille[r]?.cases[c];
      if (b && !b.capsule && !b.special) return ecrire(b);
    }
    // 🩹 27/07 — REPLI DÉTERMINISTE, et il répare un bug silencieux de longue date.
    // Les 40 essais ci-dessus sont des SONDAGES ALÉATOIRES : sur un plateau dense (un
    // niveau boss porte ~23 perles spéciales pour ~30 cases) ils échouent tous
    // régulièrement, et la perle demandée n'est alors JAMAIS posée — sans erreur, sans
    // trace. C'est ainsi qu'on obtenait une jumelle 🔗 orpheline de sa paire (le harnais
    // exige pourtant des paires) et, depuis ce lot, une perle de PALIER absente du
    // chapitre censé la présenter — c'est-à-dire une promesse de boss non tenue.
    // Le repli balaie les cases dans l'ordre et prend la première libre.
    // ⚠️ Il ne consomme AUCUN tirage : la suite du rng reste identique au bit près pour
    // tous les niveaux où la pose aléatoire réussissait déjà (donc tous les niveaux
    // figés par les tests). Il ne change QUE les cas qui étaient perdus.
    for (let r = rMin2; r < haut; r++) {
      for (let c = 0; c < COLS; c++) {
        const b = grille[r]?.cases[c];
        if (b && !b.capsule && !b.special) return ecrire(b);
      }
    }
    // Plateau SATURÉ : plus une seule case libre dans les bornes demandées. On le DIT
    // (retour null) au lieu de le taire — c'est `paramsNiveau` qui rabattra la promesse.
    return null;
  };

  // 🔗🌀 UNE PAIRE EST ENTIÈRE OU ABSENTE. Les deux perles d'une paire portent le même
  // `lienId` et n'ont de sens qu'ENSEMBLE : `portailsDeGrille` exige deux portails (une
  // moitié de paire est du contenu mort), et une jumelle 🔗 solitaire n'appelle personne.
  // Avant, la seconde pose pouvait échouer en silence et laisser la première sur le
  // plateau : on ANNULE donc la première plutôt que de livrer une demi-paire.
  // (La case rendue est restaurée à l'identique : `poserSpecial` ne choisit que des cases
  // SANS `special`, donc sans `pv` ni `lienId` — retirer ces trois champs suffit.)
  const poserPaire = (appliquer: (b: Bulle) => void, rMin2 = 0, rMax = grille.length): boolean => {
    const a = poserSpecial(rMin2, appliquer, rMax);
    if (!a) return false;
    if (poserSpecial(rMin2, appliquer, rMax)) return true;
    if (a.special && poses) poses[a.special] = Math.max(0, (poses[a.special] ?? 0) - 1);
    delete a.special; delete a.lienId; delete a.pv;
    return false;
  };
  for (let i = 0; i < p.nbGlacons; i++) poserSpecial(1, (b) => { b.special = 'glacon'; });
  for (let i = 0; i < p.nbBombes; i++) poserSpecial(0, (b) => { b.special = 'bombe'; });
  for (let i = 0; i < p.nbGivre; i++) poserSpecial(0, (b) => { b.special = 'givre'; b.pv = GIVRE_PV; });
  for (let i = 0; i < p.nbArc; i++) poserSpecial(0, (b) => { b.special = 'arc'; });
  for (let i = 0; i < p.nbBonus; i++) poserSpecial(0, (b) => { b.special = 'bonus'; });
  for (let i = 0; i < p.nbEtoiles; i++) poserSpecial(0, (b) => { b.special = 'etoile'; });
  for (let i = 0; i < p.nbTirsPlus; i++) poserSpecial(0, (b) => { b.special = 'tir'; });
  // ⚠️ Les 6 nouvelles perles sont posées APRÈS les 7 historiques, jamais avant :
  // `poserSpecial` consomme le rng, et intercaler un tirage déplacerait toutes les
  // poses existantes (les tests figent « niveau 5 → une perle +1 tir », « niveau 6 →
  // une SUPERNOVA »). Ordre = compatibilité.
  // 🥤 La paille rase SA ligne : posée sur la dernière rangée elle ne décrocherait
  // rien. On la garde donc hors du plafond ET hors de la rangée du bas — c'est aussi
  // ce qui rend le lâcher réellement possible (cf. lacherAtteignable).
  for (let i = 0; i < p.nbLasers; i++) poserSpecial(1, (b) => { b.special = 'laser'; }, grille.length - 1);
  for (let i = 0; i < p.nbContagions; i++) poserSpecial(0, (b) => { b.special = 'contagion'; });
  for (let i = 0; i < p.nbRoches; i++) poserSpecial(1, (b) => { b.special = 'roche'; b.pv = ROCHE_PV; });
  for (let i = 0; i < p.nbMeches; i++) poserSpecial(0, (b) => { b.special = 'meche'; b.pv = MECHE_PV; });
  // 🔗 Les jumelles : les deux perles portent le MÊME `lienId`. 🩹 27/07 — la paire est
  // désormais ATOMIQUE (cf. `poserPaire`) : si la seconde pose échoue, la première est
  // retirée. Une jumelle solitaire n'appelle personne — c'était une perle spéciale
  // affichée au joueur qui ne faisait rien.
  for (let i = 0; i < p.nbLiens; i++) {
    const id = i + 1;
    poserPaire((b) => { b.special = 'lien'; b.lienId = id; });
  }
  // 🌀 PORTAILS : une paire n'a de sens que si le projectile peut ENTRER dans l'un et
  // RESSORTIR de l'autre. Mesuré avec une pose libre (rMin 1) : sur les 28 niveaux qui
  // en portent, 26 n'offraient 0 angle sur 400 capable d'atteindre un portail au premier
  // tir (la bille s'arrête à la première perle : un portail enterré est du contenu MORT).
  // Et posés sur la seule face inférieure, c'est la SORTIE qui était bouchée (les
  // rangées ajoutées sous le motif sont pleines). D'où deux rôles distincts :
  //  • l'ENTRÉE est la case la plus basse de sa colonne → la bille peut la toucher ;
  //  • la SORTIE a le ciel libre juste au-dessus (une cavité du motif) → la bille peut
  //    en repartir en gardant son angle, et débouche dans le tunnel.
  for (let i = 0; i < p.nbPortails; i++) {
    const id = i + 1;
    const libre = (r: number, c: number) => {
      const b = grille[r]?.cases[c];
      return !!b && !b.capsule && !b.special;
    };
    const entrees: Case[] = [];
    for (let c = 0; c < COLS; c++) {
      for (let r = grille.length - 1; r >= 1; r--) {
        if (!grille[r].cases[c]) continue;
        if (libre(r, c)) entrees.push({ r, c });
        break;                       // seule la plus basse de la colonne est exposée
      }
    }
    // Deux qualités de sortie : PLEIN CIEL (toutes les cases du dessus libres → tous
    // les angles ressortent) puis, à défaut, ENTREBÂILLÉE (au moins une libre → une
    // partie des angles ressort, le garde-fou « sortie bouchée » refuse les autres).
    // Avec le seul critère strict, 2 niveaux sur 28 n'avaient plus de paire du tout ;
    // avec le seul critère large, 5 niveaux de plus avaient une paire injouable.
    const sortiesLarges: Case[] = [];
    const sorties: Case[] = [];
    for (let r = 1; r < grille.length; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!libre(r, c)) continue;
        const dessus = voisins(grille, r, c).filter((v) => v.r === r - 1);
        if (!dessus.length) continue;
        if (dessus.every((v) => !grille[v.r].cases[v.c])) sorties.push({ r, c });
        else if (dessus.some((v) => !grille[v.r].cases[v.c])) sortiesLarges.push({ r, c });
      }
    }
    if (!sorties.length) sorties.push(...sortiesLarges);
    // 🩹 27/07 — CETTE BOUCLE N'AVAIT PAS DE REPLI, et c'est ce qui manquait.
    // `poserSpecial` a reçu un repli déterministe après ses 40 sondages ; la pose des
    // portails, elle, se contentait de `break` dès qu'un des deux rôles ne trouvait
    // personne. Mesuré au niveau 15 : la rangée du bas est intégralement occupée par des
    // spéciales (la densité a monté quand `margeBoss` a retiré une rangée aux plateaux
    // boss), donc AUCUNE colonne n'expose de case libre → `entrees` vide → la paire
    // promise par `paramsNiveau` n'existait tout simplement pas sur le plateau, alors
    // qu'il restait 13 cases libres. Le repli reprend le même esprit, en dégradé :
    //  • à défaut d'entrée EXPOSÉE, la case libre la plus BASSE (c'est celle que la bille
    //    atteindra en premier dès que le joueur aura creusé — et un plateau de boss se
    //    régénère, donc elle se dégage vraiment) ;
    //  • la sortie reste choisie dans `sorties` tant qu'il y en a une : « pouvoir
    //    ressortir » est la moitié non négociable de la promesse. Faute de quoi, la case
    //    libre la plus HAUTE, celle qui a le plus de ciel au-dessus d'elle.
    // ⚠️ Ce repli ne consomme AUCUN tirage, et il n'est atteint que là où l'ancien code
    // faisait `break` sans en consommer non plus : la suite du rng — donc le plateau
    // entier — reste identique au bit près partout où la paire se posait déjà.
    const libresBas: Case[] = [];
    for (let r = grille.length - 1; r >= 1; r--) {
      for (let c = 0; c < COLS; c++) if (libre(r, c)) libresBas.push({ r, c });
    }
    let entree: Case | null = null;
    let sortie: Case | null = null;
    if (entrees.length && sorties.length) {
      const tiree = entrees[Math.floor(rng() * entrees.length)];
      const candidates = sorties.filter((s) => s.r !== tiree.r || s.c !== tiree.c);
      if (candidates.length) { entree = tiree; sortie = candidates[Math.floor(rng() * candidates.length)]; }
    }
    if (!entree || !sortie) {
      const memeCase = (a: Case, b: Case) => a.r === b.r && a.c === b.c;
      entree = entrees[0] ?? libresBas[0] ?? null;
      if (!entree) break;                                    // plus une seule case libre
      sortie = sorties.find((s) => !memeCase(s, entree!))
        ?? [...libresBas].reverse().find((s) => !memeCase(s, entree!))
        ?? null;
      if (!sortie) break;                                    // une seule case : pas de paire
    }
    // Une paire ENTIÈRE ou rien. Les deux cases sont libres et distinctes par
    // construction — mais on le VÉRIFIE avant d'écrire quoi que ce soit, au lieu de
    // tester case par case pendant l'écriture : la version précédente pouvait, en
    // théorie, poser la première et refuser la seconde, c'est-à-dire livrer le portail
    // solitaire que `portailsDeGrille` ne saura jamais apparier.
    const bEntree = grille[entree.r]?.cases[entree.c];
    const bSortie = grille[sortie.r]?.cases[sortie.c];
    if (!bEntree || !bSortie || bEntree === bSortie) break;
    if (bEntree.capsule || bEntree.special || bSortie.capsule || bSortie.special) break;
    for (const b of [bEntree, bSortie]) {
      b.special = 'portail'; b.lienId = id;
      if (poses) poses.portail = (poses.portail ?? 0) + 1;
    }
  }
  // 🎖️ LES POSES DE PALIER sont faites EN DERNIER, après les 13 poses historiques — même
  // règle de compatibilité que le LOT C : `poserSpecial` consomme le rng, donc intercaler
  // un tirage déplacerait TOUTES les poses existantes. Comme `renfort` vaut null en deçà
  // du palier 3 et que `nbCascades`/`nbAimants` valent 0 avant les paliers 4 et 5, aucun
  // niveau d'avant le 16 ne voit sa suite de tirages bouger d'un iota.
  //
  // 💧 La Cascade rase sa COLONNE : posée en rangée 0 elle emporterait le plafond de sa
  // colonne dès le premier contact, sans que le joueur ait pu la viser. Hors plafond,
  // donc — même précaution que la Paille 🥤, pour la raison symétrique.
  for (let i = 0; i < p.nbCascades; i++) poserSpecial(1, (b) => { b.special = 'cascade'; });
  // 🧲 L'Aimant, lui, est utile partout : sa fenêtre le suit.
  for (let i = 0; i < p.nbAimants; i++) poserSpecial(0, (b) => { b.special = 'aimant'; });
  if (p.renfort) {
    const r = p.renfort;
    if (r === 'lien') {
      // 🔗 Une paire, pas une jumelle solitaire : le `lienId` continue la numérotation
      // des paires déjà posées, sinon la nouvelle paire écraserait la précédente.
      // (Atomique depuis le 27/07, comme la pose historique juste au-dessus.)
      const id = p.nbLiens + 1;
      poserPaire((b) => { b.special = 'lien'; b.lienId = id; });
    } else {
      // 🥤 La Paille rase SA ligne : mêmes bornes que sa pose historique (ni au plafond,
      // ni sur la rangée du bas, où elle ne décrocherait rien).
      const rMin = r === 'laser' ? 1 : 0;
      const rMax = r === 'laser' ? grille.length - 1 : grille.length;
      poserSpecial(rMin, (b) => { b.special = r; if (r === 'meche') b.pv = MECHE_PV; }, rMax);
    }
  }
  return grille;
}

// Niveau DÉTERMINISTE : même numéro → même plateau pour tout le monde.
export function creerNiveau(n: number): EtatShooter {
  const niveau = niveauSur(n);       // 🛡️ un `n` non fini ouvre le niveau 1, il ne crashe plus
  const p = paramsNiveau(niveau);
  const rng = creerRng(GRAINE_NIVEAU + niveau * 7919);
  const pool = Array.from({ length: p.nbCouleurs }, (_, i) => i as Couleur);
  // ⚠️ 27/07 — LE PLATEAU EST ASSEMBLÉ À PARTIR DU DOSAGE BRUT, JAMAIS DU DOSAGE ALIGNÉ.
  // `paramsNiveau` abaisse ses compteurs pour ne promettre que ce que le plateau porte
  // (cf. `alignerSurPoses`) ; repasser ce dosage réduit ici ferait un AUTRE plateau — la
  // pose consomme le rng — donc une autre mesure, donc un autre alignement. Le brut est
  // la source unique du plateau, et c'est ce qui garantit que le plateau MESURÉ par
  // `mesurerPlateau` et celui CONSTRUIT ici restent identiques au bit près.
  const grille = assemblerPlateau(paramsBruts(niveau), pool, rng);

  // 🩹 26/07 — MATIÈRE GARANTIE pour l'objectif « éclate N perles <couleur> ».
  // La génération répartit les couleurs uniformément : sur un plateau de 46 perles
  // en 6 couleurs, il n'y en avait que 6 à 9 de la couleur demandée, pour une cible
  // de 16 à 20. L'objectif était donc ingagnable quel que soit le talent du joueur.
  // On repeint ici quelques perles ordinaires (déterministe : même rng, donc même
  // plateau pour tout le monde) pour que la cible existe réellement sur le plateau.
  if (p.objectif.type === 'couleur') {
    const cibleC = p.objectif.couleur;
    const compter = () => grille.reduce(
      (s, l) => s + l.cases.filter((b) => !!b && !b.capsule && b.couleur === cibleC).length, 0);
    const voulu = p.objectif.cible + 2;
    for (let essai = 0; essai < 300 && compter() < voulu; essai++) {
      const r = Math.floor(rng() * grille.length);
      const c = Math.floor(rng() * COLS);
      const b = grille[r]?.cases[c];
      if (b && !b.capsule && !b.special && b.couleur !== cibleC) b.couleur = cibleC;
    }
  }

  // 🎯 MATIÈRE GARANTIE pour « déclenche N perles spéciales » : la borne de
  // `paramsBruts` raisonne sur les poses DEMANDÉES, or `poserSpecial` peut échouer
  // sur un plateau très ajouré. On sème donc des ⭐ bonus — la spéciale la plus
  // simple à déclencher (il suffit de l'inclure dans un match) — jusqu'à avoir une
  // perle de marge. Même patron déterministe que le repeint de couleur ci-dessus.
  if (p.objectif.type === 'speciales') {
    const compter = () => grille.reduce(
      (s, l) => s + l.cases.filter((b) => !!infoPerle(b)?.declencheObjectif).length, 0);
    for (let essai = 0; essai < 200 && compter() <= p.objectif.cible; essai++) {
      const r = Math.floor(rng() * grille.length);
      const c = Math.floor(rng() * COLS);
      const b = grille[r]?.cases[c];
      if (b && !b.capsule && !b.special) b.special = 'bonus';
    }
  }

  return {
    grille,
    score: 0,
    tirs: 0,
    tirsParDescente: p.tirsParDescente,
    descentes: 0,
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
    palier: p.palier,        // 🎖️ chapitre du parcours — dérivé, jamais persisté
  };
}

// --- Visée / trajectoire ----------------------------------------------------

// 🌀 Une paire de portails, exprimée en centres de case (unités de diamètre).
export type PairePortail = { a: Point; b: Point };

// Résultat d'un vol. `points` / `impact` sont les champs historiques ; `ruptures` et
// `rebonds` sont ADDITIFS (aucun appelant existant ne casse).
export type Vol = {
  points: Point[];
  impact: Point;
  ruptures: number[];      // indices i où le segment i → i+1 est un SAUT de portail
  rebonds: number;         // rebonds sur les murs (le bonus REBOND en dépend)
  portailUtilise: boolean;
};

// Les deux portails posés sur le plateau, ou null s'il n'y en a pas exactement une
// paire utilisable. ⚠️ SOURCE UNIQUE : le guide pointillé, l'aperçu tactique et le
// tir réel doivent tous passer CE résultat à `simulerVol`, sinon la ligne montrée au
// joueur et la trajectoire jouée divergent (règle §0.2 « aucune logique parallèle »).
// Le plus simple, et le plus sûr, est d'appeler `simulerVolPlateau` (ci-dessous).
export function portailsDeGrille(grille: Ligne[]): PairePortail | null {
  const trouves: Point[] = [];
  for (let r = 0; r < grille.length; r++) {
    for (let c = 0; c < COLS; c++) {
      const b = grille[r].cases[c];
      if (b?.special === 'portail') trouves.push(centreCase(r, c, grille[r].decalee));
    }
  }
  return trouves.length >= 2 ? { a: trouves[0], b: trouves[1] } : null;
}

// Simule le vol d'un projectile : rebonds sur les murs, arrêt au premier contact
// (perle existante ou plafond). Renvoie la polyligne + le point d'impact.
export function simulerVol(
  grille: Ligne[],
  origine: Point,
  angle: number, // radians, y vers le BAS (écran) : tirer vers le haut = angle négatif
  // 🩹 26/07 — sous-pas fin pour ne pas « traverser » une perle. L'ancien commentaire
  // affirmait que « 0.16 suffit pour le guide » : c'est faux, un pas deux fois plus gros
  // change la case d'arrivée sur ~1,5 % des angles. TOUT ce qui est montré au joueur
  // (ligne pointillée, bille fantôme) doit utiliser ce défaut, comme le tir réel.
  pas = 0.08,
  // 🌀 Portails : paramètre OPTIONNEL, à passer À L'IDENTIQUE par les trois appelants.
  // 🩹 26/07 — le défaut était `null`, c'est-à-dire « ce plateau n'a pas de portail » :
  // un appelant qui l'omettait obtenait une trajectoire FAUSSE sans que rien ne casse.
  // Le défaut est désormais l'ABSENCE d'argument, et il se lit sur le plateau. Passer
  // explicitement `null` garde le sens « ignore les portails ». Aucune rupture de
  // signature (§0.4 : on n'évolue que par paramètre optionnel), et le chemin chaud
  // (`simulerVolPlateau`, appelé ~11 fois par seconde pendant la visée) fournit toujours
  // la valeur, donc ne re-balaie jamais la grille.
  portails?: PairePortail | null,
): Vol {
  const paire: PairePortail | null = portails === undefined ? portailsDeGrille(grille) : portails;
  const PAS = pas;
  let x = origine.x, y = origine.y;
  let vx = Math.cos(angle) * PAS, vy = Math.sin(angle) * PAS;
  const points: Point[] = [{ x, y }];
  const ruptures: number[] = [];
  let rebonds = 0;
  let portailUtilise = false;   // un seul saut par tir, sinon boucle infinie A → B → A

  const occupees: { x: number; y: number }[] = [];
  for (let r = 0; r < grille.length; r++) {
    for (let c = 0; c < COLS; c++) {
      const b = grille[r].cases[c];
      if (b) occupees.push(centreCase(r, c, grille[r].decalee));
    }
  }

  // ⚡ Coordonnées des portails aplaties en variables locales AVANT la boucle : ce vol
  // tourne à 60 Hz pour la ligne pointillée. Une version qui construisait la liste des
  // paires à chaque pas coûtait 0,064 ms au lieu de 0,029 (×2,2, uniquement en
  // allocations) — inacceptable dans le chemin de rendu par frame.
  const pax = paire ? paire.a.x : 0, pay = paire ? paire.a.y : 0;
  const pbx = paire ? paire.b.x : 0, pby = paire ? paire.b.y : 0;
  const R2P = RAYON_PORTAIL * RAYON_PORTAIL;

  for (let i = 0; i < 6000; i++) {
    x += vx; y += vy;
    if (x < RAYON) { x = RAYON + (RAYON - x); vx = -vx; rebonds++; points.push({ x, y }); }
    else if (x > LARGEUR_TERRAIN - RAYON) { x = (LARGEUR_TERRAIN - RAYON) - (x - (LARGEUR_TERRAIN - RAYON)); vx = -vx; rebonds++; points.push({ x, y }); }
    if (y <= RAYON) { y = RAYON; break; }
    // 🌀 PORTAIL — testé AVANT la collision, et au même rayon (0,87) : sans cela le
    // projectile s'arrêterait sur la perle-portail au lieu d'y entrer. L'angle est
    // conservé ; on ressort juste au-delà du rayon de collision du portail jumeau
    // pour ne pas s'y coller. Deux points sont poussés dans la polyligne (entrée puis
    // sortie) et l'indice de l'entrée est noté : le rendu sait qu'il ne doit pas
    // tracer CE segment. `vy` ne change jamais de signe → on ressort toujours en
    // montant, jamais vers le bas.
    if (paire && !portailUtilise) {
      const versB = (x - pax) * (x - pax) + (y - pay) * (y - pay) < R2P;
      const versA = !versB && (x - pbx) * (x - pbx) + (y - pby) * (y - pby) < R2P;
      if (versB || versA) {
        // entrée = le portail touché, sortie = son jumeau. L'angle est CONSERVÉ : on
        // ressort juste au-delà du rayon de collision du jumeau, dans le même sens.
        const ex = versB ? pbx : pax, ey = versB ? pby : pay;   // sortie
        const nx = versB ? pax : pbx, ny = versB ? pay : pby;   // entrée
        const norme = Math.hypot(vx, vy) || 1;
        const sx = ex + (vx / norme) * SORTIE_PORTAIL;
        const sy = ey + (vy / norme) * SORTIE_PORTAIL;
        // 🔒 SORTIE BOUCHÉE = pas de saut. Sans ce garde-fou, le projectile pourrait
        // réapparaître À L'INTÉRIEUR d'une zone pleine ; `casePourImpact` ne cherche
        // une case libre que dans une fenêtre de 4 rangées autour de l'impact et
        // renverrait alors `null` (avant les portails, la bille arrivait toujours « par
        // le vide », le cas était impossible). Un portail bouché se comporte alors comme
        // une perle ordinaire : la bille s'y colle.
        let bouchee = sx < RAYON || sx > LARGEUR_TERRAIN - RAYON || sy <= RAYON;
        if (!bouchee) {
          for (const o of occupees) {
            // les deux portails eux-mêmes ne bouchent rien : ce sont des PORTES.
            if ((o.x === ex && o.y === ey) || (o.x === nx && o.y === ny)) continue;
            const ox = sx - o.x, oy = sy - o.y;
            if (ox * ox + oy * oy < 0.87 * 0.87) { bouchee = true; break; }
          }
        }
        if (!bouchee) {
          points.push({ x, y });              // point de RUPTURE (entrée)
          ruptures.push(points.length - 1);   // le segment i → i+1 est un saut
          x = sx; y = sy;
          points.push({ x, y });              // point de sortie
          portailUtilise = true;
          continue;                           // le pas suivant repart de la sortie
        }
      }
    }
    let touche = false;
    for (const o of occupees) {
      const dx = x - o.x, dy = y - o.y;
      if (dx * dx + dy * dy < 0.87 * 0.87) { touche = true; break; }
    }
    if (touche) break;
  }
  points.push({ x, y });
  return { points, impact: { x, y }, ruptures, rebonds, portailUtilise };
}

// LE point d'entrée à utiliser partout côté écran : il lit les portails du plateau
// lui-même, donc le guide pointillé, l'aperçu tactique et le tir réel ne peuvent PAS
// se retrouver avec des options différentes. `tirer()` passe par ici.
export function simulerVolPlateau(grille: Ligne[], origine: Point, angle: number, pas = 0.08): Vol {
  return simulerVol(grille, origine, angle, pas, portailsDeGrille(grille));
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

// 🪨 26/07 — Un bloc `neTombeJamais` (la roche) n'est PAS du contenu jouable : il ne se
// matche jamais (`bloc`) et la gravité ne l'emporte jamais. Un plateau qui n'a plus que
// des roches est donc un plateau où le joueur ne peut plus rien faire — `couleursPresentes`
// y est vide, donc même la munition n'a plus de couleur utile. Le compter comme du contenu
// gelait la régénération des niveaux BOSS (boss définitivement invulnérable) et fermait le
// filet universel « plateau vidé = victoire » sur tous les autres niveaux.
// ⚠️ L'objectif `nettoyer` garde SON propre test (`cases.every((b) => !b)`) : il n'est pas
// concerné, et par construction `paramsBruts` ne pose aucune roche sur ces niveaux.
function plateauEstVide(grille: Ligne[]): boolean {
  return grille.every((l) => l.cases.every((b) => !b || infoPerle(b)?.neTombeJamais));
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

// 👑 Boss incarné : les niveaux boss (5, 10, 15…) prêtent leur visage aux 6
// légendaires de la collection, en rotation déterministe. Pur et testable.
export const BOSS_PERSONNAGES = [
  'bubble-master', 'brown-sugar-king', 'taro-queen',
  'matcha-sensei', 'oreo-star', 'caramel-chef',
] as const;
export function bossPersonnage(niveau: number): string {
  const idx = Math.max(0, Math.round(niveau / 5) - 1) % BOSS_PERSONNAGES.length;
  return BOSS_PERSONNAGES[idx];
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
    // 👹 27/07 — LA PLUIE DE PERLES *REMPLACE* LA DESCENTE PÉRIODIQUE, elle ne s'y ajoute
    // plus. Sans cette remise à zéro, deux horloges indépendantes poussaient des rangées
    // sur le même plateau, alors que le « mur invisible » de `paramsBruts` n'en provisionne
    // qu'une : le joueur mourait AVANT la fin de son budget, exactement le couperet caché
    // que ce garde-fou existe pour interdire. Le boss reste aussi menaçant (il choisit
    // QUAND la rangée tombe, et il la fait tomber plus tôt que l'horloge), mais il ne peut
    // plus doubler la cadence dans le dos de la garantie.
    etat.tirs = 0;
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
  // 🎖️ LE SOUFFLE S'ÉLARGIT AVEC LE PALIER (+1 perle givrée au chapitre 4, +2 au 8).
  // C'est LA façon dont le boss du niveau 50 se distingue de celui du niveau 5 : ses PV,
  // eux, sont bornés par le budget de tirs (cf. paramsBruts), et ce budget plafonne à 25
  // dès le niveau 24 — au-delà, faire monter les PV ne produit plus de la difficulté,
  // seulement de l'impossible. Le givre, lui, COÛTE des tirs sans jamais faire MONTER le
  // plateau : il ne peut donc pas rendre un niveau ingagnable, seulement plus serré.
  // Plafonné à +2 : au-delà, une seule attaque givrerait la moitié d'une rangée.
  const n = Math.min(candidates.length, 1 + etat.bossPhase + Math.min(2, Math.floor(etat.palier / 4)));
  for (let i = 0; i < n; i++) {
    candidates[i].special = 'givre';
    candidates[i].pv = GIVRE_PV;
  }
}

// ⚠️ DEEP-COPY MANUELLE — tout nouveau champ OBJET ou TABLEAU de `EtatShooter` doit
// être ajouté ici. Sinon l'aperçu tactique (qui rejoue un vrai `tirer()` sur ce clone,
// ~11 fois par seconde pendant la visée) muterait la partie réelle : un bug quasi
// indiagnosticable. `cases.map({...b})` copie aussi `pv` et `lienId` des perles.
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

// --- 🧩 MOTEUR DE CASCADE + REGISTRE DE PERLES (LOT C) -----------------------
//
// Avant : trois blocs séquentiels codés en dur dans `tirer()` (bombes, puis
// supernova, puis orphelines). Ajouter une perle = ajouter un bloc, et une perle
// révélée par le bloc n°2 n'était plus vue par le bloc n°1.
// Maintenant : UNE file de propagation. Un effet ne détruit JAMAIS directement, il
// appelle `detruire()`, qui retire la perle et la POUSSE DANS LA FILE. Les réactions
// en chaîne deviennent donc automatiques dans tous les sens, et la terminaison est
// garantie par le `Set` de cases vues (une case n'est détruite qu'une fois, et rien
// ne recrée de perle pendant un tir) doublée du plafond `CASCADE_MAX`.

export type CompteursCascade = {
  explosions: number;   // 💥 bombes-plateau détonées
  etoiles: number;      // 🌟 supernovas
  bonusPop: number;     // ⭐ perles bonus encaissées
  lasers: number;       // 🥤 lignes rasées
  contagions: number;   // 🍯 contaminations
  liens: number;        // 🔗 paires de jumelles
  portails: number;     // 🌀 sauts de portail
  meches: number;       // 🧨 mèches détonées
  cascades: number;     // 💧 colonnes emportées
  aimants: number;      // 🧲 attractions
};
export type CleCompteur = keyof CompteursCascade;

export type CtxCascade = {
  g: Ligne[];
  etat: EtatShooter;
  eclatees: { pos: Case; bulle: Bulle }[];  // sortie, poussée par les effets
  file: { pos: Case; bulle: Bulle }[];      // à propager
  rng: Rng;
  compte: CompteursCascade;
  pts: number;
  mult: number;
  vus: Set<string>;                         // anti-boucle : `${r}:${c}`
  couleursBalayees: Set<Couleur>;           // 🌟 une couleur n'est balayée qu'une fois par tir
};

// Contexte des effets qui s'appliquent À CHAQUE TIR (et pas à l'éclatement) : la
// mèche s'en sert pour décrémenter son compte à rebours puis, à 0, se détruire —
// l'explosion elle-même repart dans la cascade, donc dans le chemin commun.
export type CtxTir = {
  cascade: CtxCascade;
  g: Ligne[];
  etat: EtatShooter;
  rng: Rng;
};

export type InfoPerle = {
  id: SpecialBulle;
  nom: string;                 // nom affichable (aide de jeu)
  emoji: string;               // pictogramme (textes flottants, légende)
  aide: string;                // une phrase, montrée au joueur
  bloc?: boolean;              // ne se matche jamais par la couleur
  pvDepart?: number;           // encaisse N coups / compte à rebours de départ
  enAvant?: boolean;           // dessinée au-dessus de ses voisines
  parProximite?: boolean;      // détone quand une VOISINE est détruite (bombe)
  absorbe?: boolean;           // une destruction lui coûte 1 PV au lieu de l'emporter (roche)
  neTombeJamais?: boolean;     // la gravité ne l'emporte pas, même orpheline (roche)
  declencheObjectif?: boolean; // compte pour l'objectif « déclenche N spéciales »
  declencheEnTombant?: boolean;// … y compris quand elle TOMBE (bonus, +1 tir)
  pointsEclat?: number;        // points immédiats à la destruction (bonus)
  compteurEclat?: CleCompteur; // compteur incrémenté à la destruction
  surEclat?: (ctx: CtxCascade, pos: Case, bulle: Bulle) => void;
  surTir?: (ctx: CtxTir, pos: Case, bulle: Bulle) => void;
  devieTrajectoire?: true;     // gérée par simulerVol (portail)
};

// Retire une perle et l'inscrit dans la cascade. SEUL point de destruction : aucun
// effet ne doit écrire `g[r].cases[c] = null` lui-même, sinon sa perle ne propagera
// rien et l'anti-boucle sera contournée. Renvoie `true` si la perle est bien partie.
function detruire(ctx: CtxCascade, r: number, c: number): boolean {
  if (r < 0 || c < 0 || c >= COLS || r >= ctx.g.length) return false;
  const cle = `${r}:${c}`;
  if (ctx.vus.has(cle)) return false;
  const b = ctx.g[r].cases[c];
  if (!b) return false;
  // Les capsules RÉSISTENT à tout : elles se libèrent en TOMBANT, jamais en éclatant.
  if (b.capsule) return false;
  if (ctx.eclatees.length >= CASCADE_MAX) return false;     // plafond dur de perf
  const info = infoPerle(b);
  // 🪨 Perle à armure (roche) : encaisse le coup au lieu de partir.
  if (info?.absorbe) {
    const pv = b.pv ?? info.pvDepart ?? 1;
    if (pv > 1) { b.pv = pv - 1; return false; }
  }
  ctx.vus.add(cle);
  ctx.g[r].cases[c] = null;
  const detruite = { pos: { r, c }, bulle: b };
  ctx.eclatees.push(detruite);
  ctx.file.push(detruite);
  // Récompense immédiate de destruction (⭐ bonus) : versée AU MOMENT du retrait,
  // donc au même instant qu'avant la refonte — c'est ce qui préserve le bonus REBOND
  // sur les perles bonus du groupe (le ×1,5 s'applique aux points du match).
  // ⭐ ÉCART ASSUMÉ vs PRÉ-REFONTE — 26/07/2026, tranché et mesuré.
  // AVANT, les points de la perle bonus étaient recopiés à la main dans QUATRE blocs
  // (match, chaîne de bombes, supernova, chute) et OUBLIÉS dans le cinquième : la
  // MUNITION bombe. Une ⭐ soufflée par une bombe achetée ne rapportait donc rien, en
  // contradiction directe avec son aide de jeu (« Rapporte 40 points quand elle éclate ou
  // qu'elle tombe ») — un oubli de recopie, pas un choix d'équilibrage. Le registre verse
  // désormais la récompense sur le chemin UNIQUE de destruction.
  // Mesuré : plateau témoin 70 → 110 pts (+BONUS_POINTS, une seule fois). Purement du
  // SCORE : `bonusPop` ne nourrit aucun objectif (l'objectif `speciales` compte
  // `declencheObjectif`, déjà satisfait avant). On GARDE.
  if (info?.pointsEclat) ctx.pts += info.pointsEclat;
  if (info?.compteurEclat) ctx.compte[info.compteurEclat]++;
  return true;
}

// Vide la file : chaque perle détruite déclenche son propre effet, puis réveille ses
// voisines « à détonation de proximité ». FIFO → la vague se propage par anneaux,
// ce qui donne un ordre d'animation lisible côté écran.
function propagerCascade(ctx: CtxCascade) {
  let tours = 0;
  while (ctx.file.length) {
    if (++tours > CASCADE_MAX * 4) break;   // ceinture ET bretelles
    const { pos, bulle } = ctx.file.shift()!;
    infoPerle(bulle)?.surEclat?.(ctx, pos, bulle);
    for (const v of voisins(ctx.g, pos.r, pos.c)) {
      if (infoPerle(ctx.g[v.r]?.cases[v.c])?.parProximite) detruire(ctx, v.r, v.c);
    }
  }
}

// 🧨 Effets « à chaque tir » : un balayage du plateau par tir, avant la chute des
// orphelines, afin que ce qu'une mèche fait sauter tombe DANS LE MÊME TIR.
function appliquerEffetsDeTir(ctxTir: CtxTir) {
  const g = ctxTir.g;
  for (let r = 0; r < g.length; r++) {
    for (let c = 0; c < COLS; c++) {
      const b = g[r].cases[c];
      const surTir = infoPerle(b)?.surTir;
      if (b && surTir) surTir(ctxTir, { r, c }, b);
    }
  }
}

// === LE REGISTRE : 1 entrée = 1 perle ======================================
// Les 7 premières sont les spéciales historiques, réécrites À COMPORTEMENT
// IDENTIQUE (rayon, seuils, points, ordre des récompenses). Les 6 suivantes sont
// les nouvelles du LOT C. `nom` / `emoji` / `aide` / `enAvant` sont lus par l'écran :
// aucune de ces informations ne doit être redupliquée dans un `.tsx`.
export const EFFETS_PERLE: Record<SpecialBulle, InfoPerle> = {
  glacon: {
    id: 'glacon', nom: 'Glaçon', emoji: '🧊', bloc: true,
    aide: 'Bloc de glace : il ne se matche jamais, il faut le faire tomber.',
  },
  bombe: {
    id: 'bombe', nom: 'Bombe', emoji: '💥', enAvant: true, parProximite: true,
    declencheObjectif: true,
    aide: 'Explose ses voisines dès qu’une perle éclate à côté — les bombes se relaient.',
    surEclat: (ctx, pos) => {
      ctx.compte.explosions++;
      for (const v of voisins(ctx.g, pos.r, pos.c)) detruire(ctx, v.r, v.c);
      ctx.pts += EXPLO_POINTS * ctx.mult;
    },
  },
  givre: {
    id: 'givre', nom: 'Perle givrée', emoji: '❄️', pvDepart: GIVRE_PV,
    aide: 'Sous givre : il faut deux coups pour l’éclater (un Tir parfait suffit).',
    // ⚠️ L'armure du givre reste traitée dans le MATCH (cf. tirer) et nulle part
    // ailleurs : historiquement une bombe ou une supernova l'emporte d'un coup.
    // Lui donner `absorbe` ici changerait ce comportement de production.
  },
  arc: {
    id: 'arc', nom: 'Arc-en-ciel', emoji: '🌈', enAvant: true,
    aide: 'Joker : elle rejoint n’importe quelle couleur pour agrandir un groupe.',
  },
  bonus: {
    id: 'bonus', nom: 'Perle étoilée', emoji: '⭐', enAvant: true,
    declencheObjectif: true, declencheEnTombant: true,
    pointsEclat: BONUS_POINTS, compteurEclat: 'bonusPop',
    aide: `Rapporte ${BONUS_POINTS} points quand elle éclate ou qu’elle tombe.`,
  },
  etoile: {
    id: 'etoile', nom: 'Supernova', emoji: '🌟', enAvant: true, declencheObjectif: true,
    aide: 'En éclatant, elle emporte TOUTES les perles de sa couleur.',
    surEclat: (ctx, pos, bulle) => {
      if (ctx.couleursBalayees.has(bulle.couleur)) return; // une couleur = un balayage
      ctx.couleursBalayees.add(bulle.couleur);
      ctx.compte.etoiles++;
      for (let r = 0; r < ctx.g.length; r++) {
        for (let c = 0; c < COLS; c++) {
          const b = ctx.g[r].cases[c];
          if (!b || estBloc(b) || b.special === 'arc' || b.couleur !== bulle.couleur) continue;
          if (detruire(ctx, r, c)) ctx.pts += 12 * ctx.mult;
        }
      }
    },
  },
  tir: {
    id: 'tir', nom: 'Perle cadeau', emoji: '🎁', enAvant: true,
    declencheObjectif: true, declencheEnTombant: true,
    aide: 'Éclatée ou tombée, elle rend +1 tir (mode Aventure).',
    // Le crédit de tir est compté dans `tirer` (éclatées ET tombées) : historique.
  },
  // --- 🆕 LOT C ---------------------------------------------------------------
  laser: {
    id: 'laser', nom: 'Perle Paille', emoji: '🥤', enAvant: true, declencheObjectif: true,
    aide: 'En éclatant, la paille aspire TOUTE sa ligne horizontale.',
    surEclat: (ctx, pos) => {
      ctx.compte.lasers++;
      for (let c = 0; c < COLS; c++) detruire(ctx, pos.r, c);
      ctx.pts += LASER_POINTS * ctx.mult;
    },
  },
  contagion: {
    id: 'contagion', nom: 'Perle Sirop', emoji: '🍯', enAvant: true, declencheObjectif: true,
    aide: 'En éclatant, le sirop repeint ses 6 voisines dans sa couleur.',
    surEclat: (ctx, pos, bulle) => {
      let repeintes = 0;
      for (const v of voisins(ctx.g, pos.r, pos.c)) {
        const b = ctx.g[v.r]?.cases[v.c];
        // On ne repeint que ce qui a une couleur utile : ni bloc, ni joker.
        if (!b || estBloc(b) || b.special === 'arc' || b.couleur === bulle.couleur) continue;
        b.couleur = bulle.couleur;
        repeintes++;
      }
      // Aucune destruction ici : la contagion PRÉPARE le gros combo du tir suivant.
      if (repeintes) { ctx.compte.contagions++; ctx.pts += CONTAGION_POINTS * ctx.mult; }
    },
  },
  lien: {
    id: 'lien', nom: 'Perles Jumelles', emoji: '🔗', enAvant: true, declencheObjectif: true,
    aide: 'Posées par paires : éclater l’une éclate l’autre, où qu’elle soit.',
    surEclat: (ctx, pos, bulle) => {
      if (bulle.lienId === undefined) return;   // jumelle solitaire : éclate normalement
      let appelees = 0;
      for (let r = 0; r < ctx.g.length; r++) {
        for (let c = 0; c < COLS; c++) {
          const b = ctx.g[r].cases[c];
          if (b?.special !== 'lien' || b.lienId !== bulle.lienId) continue;
          if (detruire(ctx, r, c)) appelees++;
        }
      }
      // Pas de boucle possible : la jumelle appelée cherche à son tour sa paire, ne
      // trouve plus personne (les deux cases sont déjà dans `vus`) et s'arrête.
      if (appelees) { ctx.compte.liens++; ctx.pts += LIEN_POINTS * ctx.mult; }
    },
  },
  meche: {
    id: 'meche', nom: 'Perle à Mèche', emoji: '🧨', enAvant: true, pvDepart: MECHE_PV,
    declencheObjectif: true,
    aide: 'Compte à rebours à chaque tir : à zéro, elle explose en croix.',
    surEclat: (ctx, pos) => {
      ctx.compte.meches++;
      for (const d of [1, 2]) {
        detruire(ctx, pos.r - d, pos.c);
        detruire(ctx, pos.r + d, pos.c);
        detruire(ctx, pos.r, pos.c - d);
        detruire(ctx, pos.r, pos.c + d);
      }
      ctx.pts += MECHE_POINTS * ctx.mult;
    },
    surTir: (ctx, pos, bulle) => {
      const reste = (bulle.pv ?? MECHE_PV) - 1;
      bulle.pv = reste;
      // À zéro elle se détruit : l'explosion en croix vient de `surEclat`, donc elle
      // passe par le chemin commun (chaînes, plafond, anti-boucle) — pas de doublon.
      if (reste <= 0) detruire(ctx.cascade, pos.r, pos.c);
    },
  },
  portail: {
    id: 'portail', nom: 'Portail', emoji: '🌀', bloc: true, enAvant: true, devieTrajectoire: true,
    aide: 'Par paires : la perle qui entre dans l’un ressort de l’autre, même angle.',
  },
  roche: {
    id: 'roche', nom: 'Perle de Roche', emoji: '🪨', bloc: true,
    pvDepart: ROCHE_PV, absorbe: true, neTombeJamais: true,
    aide: `Bloc à ${ROCHE_PV} PV : la gravité ne l’emporte pas, il faut la casser.`,
  },
  // --- 🎖️ LOT PALIERS : les deux perles que les boss OUVRENT ---------------------
  cascade: {
    id: 'cascade', nom: 'Perle Cascade', emoji: '💧', enAvant: true, declencheObjectif: true,
    aide: 'En éclatant, elle emporte toute sa COLONNE — la Paille 🥤, mais debout.',
    // Pendant VERTICAL exact de la Paille : même patron, même chemin de destruction
    // (`detruire`), donc les mêmes garanties d'anti-boucle (`vus`) et le même plafond
    // CASCADE_MAX. Comme elle coupe la colonne du plafond au sol, tout ce qui s'y
    // accrochait dégringole : c'est LA perle qui démonte un plateau, d'où sa rareté.
    surEclat: (ctx, pos) => {
      ctx.compte.cascades++;
      for (let r = 0; r < ctx.g.length; r++) detruire(ctx, r, pos.c);
      ctx.pts += CASCADE_POINTS * ctx.mult;
    },
  },
  aimant: {
    id: 'aimant', nom: 'Perle Aimant', emoji: '🧲', enAvant: true, declencheObjectif: true,
    aide: 'En éclatant, elle attire et fait éclater les perles de SA couleur autour d’elle.',
    // SUPERNOVA LOCALE : la 🌟 balaie une couleur sur TOUT le plateau, l'aimant sur une
    // fenêtre de (2·RAYON_AIMANT+1)² cases. Bornée par construction — donc jamais un
    // « je gagne tout seul » — et elle récompense le placement, pas la chance.
    // Pas besoin de `couleursBalayees` (le garde-fou de la supernova) : la fenêtre est
    // locale, et `vus` empêche déjà qu'une case soit détruite deux fois.
    surEclat: (ctx, pos, bulle) => {
      let attirees = 0;
      for (let r = Math.max(0, pos.r - RAYON_AIMANT); r <= pos.r + RAYON_AIMANT && r < ctx.g.length; r++) {
        for (let c = Math.max(0, pos.c - RAYON_AIMANT); c <= Math.min(COLS - 1, pos.c + RAYON_AIMANT); c++) {
          const b = ctx.g[r].cases[c];
          if (!b || estBloc(b) || b.special === 'arc' || b.couleur !== bulle.couleur) continue;
          if (detruire(ctx, r, c)) attirees++;
        }
      }
      if (attirees) { ctx.compte.aimants++; ctx.pts += AIMANT_POINTS * ctx.mult; }
    },
  },
};

// Une spéciale est « déclenchée » quand son effet a réellement payé : elle a éclaté,
// ou elle est tombée ET son effet fonctionne aussi à la chute (bonus, +1 tir).
function compterSpecialesDeclenchees(
  eclatees: { bulle: Bulle }[],
  tombees: { bulle: Bulle }[],
): number {
  let n = 0;
  for (const e of eclatees) if (infoPerle(e.bulle)?.declencheObjectif) n++;
  for (const t of tombees) if (infoPerle(t.bulle)?.declencheEnTombant) n++;
  return n;
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
  // 🌀 Portails lus depuis LE plateau : guide pointillé, aperçu et tir réel passent
  // donc forcément les mêmes options (cf. simulerVolPlateau).
  const vol = simulerVolPlateau(g, origine, angle);
  const { points, impact } = vol;
  // Un rebond MUR ×1,5 — compté explicitement : depuis les portails, la polyligne
  // peut contenir des points qui ne sont pas des rebonds (entrée/sortie de portail).
  const rebondi = vol.rebonds > 0;
  // 🏅 TIR EN OR : c'est le tout dernier tir du budget → points ×2 s'il est utile
  const tirEnOr = etat.tirsRestants === 1;

  // 🧩 Contexte unique de la cascade : les points, les compteurs et les perles
  // détruites vivent ici, plus dans une dizaine de variables locales.
  const ctx: CtxCascade = {
    g,
    etat,
    eclatees: [],
    file: [],
    rng,
    compte: {
      explosions: 0, etoiles: 0, bonusPop: 0,
      lasers: 0, contagions: 0, liens: 0,
      portails: vol.portailUtilise ? 1 : 0, meches: 0,
      cascades: 0, aimants: 0,
    },
    pts: 0,
    mult: 1,
    vus: new Set<string>(),
    couleursBalayees: new Set<Couleur>(),
  };
  const eclatees = ctx.eclatees;
  let capsules = 0;
  let rebond = false;
  let pose: Case | null = null;
  const tombees: { pos: Case; bulle: Bulle }[] = [];
  let tailleGroupe = 0;

  if (special === 'bombe') {
    // 💣 pas de pose : tout ce qui est colorié dans le rayon explose
    // (les capsules RÉSISTENT — mais privées de soutien, elles tombent)
    const centre = casePourImpact(g, impact);
    const cCentre = centreCase(centre.r, centre.c, g[centre.r].decalee);
    ctx.mult = Math.max(1, Math.min(etat.chaine, CHAINE_MAX));
    for (let r = 0; r < g.length; r++) {
      for (let c = 0; c < COLS; c++) {
        const b = g[r].cases[c];
        if (!b) continue;
        const p = centreCase(r, c, g[r].decalee);
        const dx = p.x - cCentre.x, dy = p.y - cCentre.y;
        if (dx * dx + dy * dy <= RAYON_BOMBE * RAYON_BOMBE) detruire(ctx, r, c);
      }
    }
    ctx.pts += eclatees.length * 10 * ctx.mult;
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
        // 🩹 26/07 — le scan n'excluait que `capsule`, pas les GLAÇONS. Un glaçon est un
        // bloc : il ne matche jamais. L'arc pouvait donc adopter SA couleur, pour un
        // « meilleur groupe » de 1 (la perle posée toute seule) — 100 perles dépensées
        // pour poser une perle ordinaire d'une couleur inutile. `estBloc` couvre capsule
        // + glaçon. Aucune option perdue : la couleur d'un bloc ne peut, par construction,
        // former qu'un groupe de 1. (Mesuré : 147 tirs sur 7 240 en étaient victimes.)
        if (!b || estBloc(b) || testees.has(b.couleur)) continue;
        testees.add(b.couleur);
        g[pose.r].cases[pose.c] = { couleur: b.couleur };
        const taille = groupeMemeCouleur(g, pose).length;
        g[pose.r].cases[pose.c] = null;
        if (!meilleure || taille > meilleure.taille) meilleure = { couleur: b.couleur, taille };
      }
      if (meilleure) couleurTir = meilleure.couleur;
    }
    g[pose.r].cases[pose.c] = { couleur: couleurTir };

    // 🩹 26/07 — L'ARC TIENT ENFIN SA PROMESSE (« match garanti, sauve ta chaîne », 100
    // perles). Le seuil d'éclatement restait 3 même pour un arc : quand la pose ne touchait
    // que des perles isolées, le meilleur groupe valait 2 (la posée + une voisine) → rien
    // n'éclatait ET la chaîne retombait à 0, soit l'inverse exact de ce que la boutique vend.
    // Choix retenu : seuil à 2 POUR CE TIR. L'écran consomme le power-up AVANT d'appeler
    // `tirer()` et le store n'a pas de fonction de remboursement — ne pas consommer la
    // munition obligerait à toucher `store/jeu.ts`, hors périmètre. Le barème est inchangé
    // (`groupe - 3` reste borné à 0) : un match à 2 rapporte 20 pts × multiplicateur.
    const seuilEclat = special === 'arc' ? 2 : 3;
    const groupe = groupeMemeCouleur(g, pose);
    tailleGroupe = groupe.length;
    if (groupe.length >= seuilEclat) {
      etat.chaine = Math.min(etat.chaine + 1, 9);
      ctx.mult = Math.min(etat.chaine, CHAINE_MAX);
      for (const caseG of groupe) {
        const b = bulleEn(g, caseG.r, caseG.c)!;
        // ❄️ givre : encaisse un coup et RESTE tant que pv > 1. Traité ICI et pas dans
        // `detruire` : historiquement une bombe ou une supernova emporte un givre d'un
        // seul coup, seul le MATCH doit buter sur son armure.
        if (b.special === 'givre' && (b.pv ?? GIVRE_PV) > 1 && !tirParfaitDemande) {
          b.pv = (b.pv ?? GIVRE_PV) - 1;
          continue;
        }
        // 💥 ÉCART ASSUMÉ vs PRÉ-REFONTE — 26/07/2026, tranché et mesuré.
        // AVANT : une bombe INCLUSE dans le groupe matché était retirée avec le groupe et
        // ne détonait pas ; une bombe simplement ADJACENTE, si. Même perle, deux résultats
        // opposés selon un détail que le joueur ne peut ni voir ni apprendre — et matcher
        // une bombe la DÉSAMORÇAIT, à l'exact opposé de son aide de jeu (« Explose ses
        // voisines dès qu'une perle éclate à côté »). MAINTENANT elle passe par `detruire`
        // comme tout le reste, donc elle détone.
        // Mesuré : plateau témoin 45 → 85 pts (3 → 6 perles) ; sur 110 parties de bot
        // (niveaux 6-60, 2 graines) l'écart d'équilibrage est de 1 niveau gagné (44 vs 43)
        // et de 2 tirs restants cumulés (615 vs 617) — dans le bruit. On GARDE.
        detruire(ctx, caseG.r, caseG.c);
      }
      ctx.pts += (groupe.length * 10 + Math.max(0, groupe.length - 3) * 5) * ctx.mult;
      if (tirParfaitDemande && eclatees.length) ctx.pts += 25 * ctx.mult;
      // ⚠️ Le ×1,5 du REBOND s'applique aux points DU MATCH uniquement — donc avant de
      // propager la cascade, exactement comme avant la refonte (les points de bombe,
      // de supernova, de paille… ne sont pas multipliés).
      if (rebondi && eclatees.length) { rebond = true; ctx.pts = Math.round(ctx.pts * BONUS_REBOND); }
    } else if (special === 'arc') {
      // 🩹 26/07 — Filet de sécurité : même à 2, le groupe peut rester à 1 (pose au plafond
      // sans voisine, ou entourée uniquement de blocs). La munition est alors perdue sans
      // faute du joueur → la chaîne est PRÉSERVÉE, seconde moitié de la promesse « sauve ta
      // chaîne ». Ce raté ne consomme pas non plus la grâce du copain Signature.
    } else if (etat.graceChaine > 0 && etat.chaine > 0) {
      etat.graceChaine--; // le copain de tir Signature pardonne ce raté
    } else {
      etat.chaine = 0; // tir sans match → la chaîne retombe
    }
  }

  // 🧩 UNE SEULE PROPAGATION, jusqu'à épuisement : bombes de proximité, supernovas,
  // pailles, sirops, jumelles et mèches s'enchaînent dans n'importe quel ordre. Chaque
  // effet vit dans EFFETS_PERLE — il n'y a plus rien à ajouter ici pour une perle de
  // plus (c'était le défaut structurel des trois anciens blocs séquentiels).
  propagerCascade(ctx);

  // 🧨 Effets « à chaque tir » (compte à rebours des mèches) : APRÈS la cascade du
  // match — le tir compte même s'il n'a rien touché — et AVANT la chute, pour que ce
  // qu'une mèche fait sauter tombe dans le même tir. Une seconde propagation suffit :
  // la file repart avec le même `vus`, donc le plafond global reste respecté.
  appliquerEffetsDeTir({ cascade: ctx, g, etat, rng });
  propagerCascade(ctx);

  // Orphelines (après éclatement OU explosion) : les capsules se LIBÈRENT ici
  if (eclatees.length) {
    for (const caseO of orphelines(g)) {
      const b = bulleEn(g, caseO.r, caseO.c)!;
      const info = infoPerle(b);
      // 🪨 La roche reste, même orpheline : elle seule ignore la gravité. Ce qui
      // pendait SOUS elle tombe quand même (la liste des orphelines est calculée
      // depuis le plafond) → une roche ne peut donc jamais séquestrer une capsule.
      if (info?.neTombeJamais) continue;
      tombees.push({ pos: caseO, bulle: b });
      if (b.capsule) capsules++;
      // Récompense de chute, lue dans le registre (⭐ bonus) au lieu d'un `if` par perle.
      if (info?.pointsEclat) ctx.pts += info.pointsEclat;
      if (info?.compteurEclat) ctx.compte[info.compteurEclat]++;
      g[caseO.r].cases[caseO.c] = null;
    }
    ctx.pts += tombees.length * 15 * ctx.mult;
    // 🎉 GROS LÂCHER : bonus superlinéaire quand une grosse grappe dégringole
    if (tombees.length >= GROS_LACHER) ctx.pts += tombees.length * tombees.length * 3 * ctx.mult;
  }

  retirerLignesVidesEnBas(g);

  // Plateau nettoyé : bonus. En infini on régénère ; en aventure on laisse vide
  // (la victoire — toutes capsules libérées — est constatée par l'écran).
  let plateauNettoye = false;
  if (plateauEstVide(g)) {
    plateauNettoye = true;
    etat.plateauxVides++;
    if (etat.regenerer) {
      ctx.pts += 500;
      // 🪨 26/07 — Le plateau est RENOUVELÉ : les blocs `neTombeJamais` survivants partent
      // avec lui. Sans ce balayage, une roche restée hors de la ligne 0 (les descentes
      // `unshift` la poussent vers le bas) laissait les lignes neuves empilées SOUS elle,
      // donc décrochées : `orphelines` part de la ligne 0 et déclarait tout le plateau
      // neuf orphelin. En infini `g` est déjà vide ici : ligne sans effet.
      g.length = 0;
      for (let r = 0; r < LIGNES_DEPART; r++) g.push(genererLigne(r % 2 === 1, etat.couleursPool, rng));
    } else {
      ctx.pts += 200;
    }
  }

  // Descente périodique (jamais juste après un plateau neuf) — lignes SANS capsule
  etat.tirs++;
  let nouvelleLigne = false;
  if (etat.tirsParDescente > 0 && !plateauNettoye && etat.tirs >= etat.tirsParDescente && g.length) {
    etat.tirs = 0;
    nouvelleLigne = true;
    etat.descentes++;
    // 📈 Infini tendu : le rythme de descente se resserre en paliers (6 → 5 → 4 tirs).
    // Réservé au mode infini (tirsRestants null) : les niveaux gardent leur cadence fixe.
    if (etat.tirsRestants === null) {
      etat.tirsParDescente = etat.descentes < 3 ? 6 : etat.descentes < 8 ? 5 : 4;
    }
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
      ctx.pts += RUSH_POINTS;
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
  if (tirEnOr && ctx.pts > 0) ctx.pts *= 2;
  const pts = ctx.pts;

  etat.score += pts;
  etat.detruites += eclatees.length + tombees.length;
  etat.capsulesLiberees += capsules;

  const specialesDeclenchees = compterSpecialesDeclenchees(eclatees, tombees);

  // Avancement de l'objectif du niveau (tomber / couleur / boss + les 4 nouveaux)
  const obj = etat.objectif;
  if (obj.type === 'chaine') {
    // MEILLEURE chaîne atteinte : le compteur ne redescend pas quand la chaîne casse,
    // sinon la barre de progression ferait du yo-yo et l'objectif serait illisible.
    etat.objProgres = Math.max(etat.objProgres, etat.chaine);
  } else if (obj.type === 'lacher') {
    // « N perles EN UN SEUL TIR » → on garde le RECORD du tir, pas un cumul.
    etat.objProgres = Math.max(etat.objProgres, tombees.filter((t) => !t.bulle.capsule).length);
  } else if (obj.type === 'parfaits') {
    // Même définition que `tirParfait` du résultat : tension maxi ET impact utile.
    if (tirParfaitDemande && eclatees.length > 0) etat.objProgres++;
  } else if (obj.type === 'speciales') {
    etat.objProgres += specialesDeclenchees;
  } else if (obj.type === 'tomber') {
    etat.objProgres += tombees.filter((t) => !t.bulle.capsule).length;
  } else if (obj.type === 'couleur') {
    const compte = (arr: { bulle: Bulle }[]) =>
      arr.filter((x) => !estBloc(x.bulle) && x.bulle.special !== 'arc' && x.bulle.couleur === obj.couleur).length;
    etat.objProgres += compte(eclatees) + compte(tombees);
  } else if (obj.type === 'boss') {
    // 👹 chaque perle éclatée / tombée blesse le boss ; gros combos et explosions cognent plus fort
    const degats = eclatees.filter((x) => !estBloc(x.bulle)).length
      + tombees.filter((t) => !t.bulle.capsule).length
      + (tailleGroupe >= 5 ? 3 : 0) + ctx.compte.explosions * 2
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
      // ⚠️ 27/07 — LA CADENCE NE BOUGE PAS AVEC LE PALIER, et c'est un choix MESURÉ.
      // Un seuil abaissé à 2 dès le palier 4 a été essayé : l'attaque « Pluie de perles »
      // ajoute une rangée, donc 50 % d'attaques en plus = 50 % de rangées en plus sur un
      // plateau qui, sur un niveau boss, se RÉGÉNÈRE déjà. Résultat en force brute :
      // le bot mourait enterré au 14ᵉ tir sur 30 aux niveaux 20/30 (7 et 22 dégâts) —
      // on refermait par la cadence les niveaux qu'on venait de rouvrir par les PV.
      // Le palier durcit le boss par la LARGEUR de son souffle (cf. appliquerActionBoss),
      // qui gêne sans jamais faire monter le plateau.
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
    trajectoire: points, ruptures: vol.ruptures, pose, eclatees, tombees, capsules,
    points: pts, multiplicateur: ctx.mult, rebond, groupe: tailleGroupe,
    nouvelleLigne, plateauNettoye, perdu: etat.perdu,
    explosions: ctx.compte.explosions, bonusPop: ctx.compte.bonusPop,
    grosLacher: tombees.length,
    objectifAtteint: objectifAtteint(etat),
    tirParfait: tirParfaitDemande && eclatees.length > 0,
    feverGagne,
    bossAction,
    bossInterrompu,
    etoiles: ctx.compte.etoiles,
    tirsBonus,
    tirEnOr: tirEnOr && pts > 0,
    rushDebut,
    rushFin,
    lasers: ctx.compte.lasers,
    contagions: ctx.compte.contagions,
    liens: ctx.compte.liens,
    portails: ctx.compte.portails,
    meches: ctx.compte.meches,
    specialesDeclenchees,
    cascades: ctx.compte.cascades,
    aimants: ctx.compte.aimants,
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
