// === Boba Quest — économie du jeu (config PURE, zéro dépendance RN) ===
// Collectibles, raretés, capsules (gacha), récompenses de sets, boutique de prix,
// roulette mensuelle. Tout est réglable ici — à terme ces valeurs pourront être
// pilotées côté serveur (app_config) sans mise à jour de l'appli.

export type Rarete = 'commun' | 'rare' | 'epique' | 'legendaire';
export type SetId = 'milk' | 'fruit' | 'topping' | 'signature';

export type Collectible = {
  id: string;
  nom: string;
  set: SetId;
  rarete: Rarete;
  phrase: string; // petite phrase de personnage (fiche de l'album)
};

export type TypePrix = 'tampon' | 'reduction' | 'boisson' | 'perles' | 'capsule_doree';

// Identifiants CANONIQUES partagés avec le catalogue serveur. Le téléphone ne
// transmet jamais une quantité libre : le serveur retrouve type, valeur et quota
// depuis ce code avant de créer une demande pour la caisse.
// Le type a déménagé dans `@/lib/codes-recompenses`, module neutre : la Roue du Mois
// n'a plus à importer un fichier de Boba Quest pour réclamer ses lots. Ré-exporté ici
// pour que les appelants de Quest n'aient pas à changer.
// Import RELATIF volontaire : `scripts/test-jeu.cjs` compile ce fichier avec un tsc
// nu, sans les `paths` du tsconfig — l'alias @/ n'y serait pas résolu.
export type { CodeRecompenseReelle } from '../../lib/codes-recompenses';
import type { CodeRecompenseReelle } from '../../lib/codes-recompenses';

// Un PRIX RÉEL gagné (à réclamer en caisse dans la version finale)
export type Gain = {
  id: string;
  code: CodeRecompenseReelle;
  type: TypePrix;
  qte: number;          // nb tampons, % de réduction, nb boissons…
  label: string;
  origine: 'set' | 'collection' | 'boutique' | 'roulette' | 'quete';
  gagneLe: string;      // ISO
  demandeId?: string;
  statut: 'a_reclamer' | 'en_attente' | 'utilise' | 'refuse';
};

// --- Les 4 sets ---------------------------------------------------------------

export const SETS: Record<SetId, {
  nom: string; rarete: Rarete; couleur: string; fond: string; emoji: string;
  recompense: { code: CodeRecompenseReelle; type: TypePrix; qte: number; label: string };
}> = {
  milk: {
    nom: 'La Bande Milk Tea', rarete: 'commun', couleur: '#8A68B8', fond: '#f1ecfa', emoji: '🧋',
    recompense: { code: 'set_milk', type: 'tampon', qte: 1, label: '+1 tampon de fidélité' },
  },
  fruit: {
    nom: 'Le Gang des Fruités', rarete: 'rare', couleur: '#7E9B12', fond: '#eef4d8', emoji: '🍓',
    recompense: { code: 'set_fruit', type: 'tampon', qte: 2, label: '+2 tampons de fidélité' },
  },
  topping: {
    nom: 'L\'Équipe Toppings', rarete: 'epique', couleur: '#C99012', fond: '#fdf3c2', emoji: '✨',
    recompense: { code: 'set_topping', type: 'reduction', qte: 10, label: '−10 % sur ta prochaine commande' },
  },
  signature: {
    nom: 'Les Signatures Royales', rarete: 'legendaire', couleur: '#D2588A', fond: '#fbe4ee', emoji: '👑',
    recompense: { code: 'set_signature', type: 'boisson', qte: 1, label: 'Grande boisson offerte (L, M pour Signature)' },
  },
};

// Récompense quand TOUTE la collection (24/24) est complète
export const RECOMPENSE_COLLECTION = {
  code: 'collection_complete' as CodeRecompenseReelle,
  type: 'boisson' as TypePrix, qte: 1,
  label: 'Bubble Legend : grande boisson offerte + 3 tampons',
  tamponsBonus: 3,
};

export const RARETES: Record<Rarete, { nom: string; couleur: string; ordre: number }> = {
  commun: { nom: 'Commun', couleur: '#8A68B8', ordre: 0 },
  rare: { nom: 'Rare', couleur: '#4E9DC4', ordre: 1 },
  epique: { nom: 'Épique', couleur: '#C99012', ordre: 2 },
  legendaire: { nom: 'Légendaire', couleur: '#D2588A', ordre: 3 },
};

// --- Les 24 collectibles --------------------------------------------------------

export const COLLECTIBLES: Collectible[] = [
  // Set Milk Tea (commun)
  { id: 'boba', nom: 'Boba', set: 'milk', rarete: 'commun', phrase: 'La perle originale. Toujours au fond, jamais dépassée.' },
  { id: 'classico', nom: 'Classico', set: 'milk', rarete: 'commun', phrase: 'Le milk tea de toujours. Une valeur sûre.' },
  { id: 'theo', nom: 'Théo', set: 'milk', rarete: 'commun', phrase: 'Infusé de sagesse depuis 4000 ans.' },
  { id: 'lacto', nom: 'Lacto', set: 'milk', rarete: 'commun', phrase: 'Doux, crémeux, indispensable.' },
  { id: 'paillette', nom: 'Paillette', set: 'milk', rarete: 'commun', phrase: 'Toujours droite dans ses bottes.' },
  { id: 'sucrette', nom: 'Sucrette', set: 'milk', rarete: 'commun', phrase: '0 %, 50 % ou 100 % ? À toi de voir.' },
  // Set Fruités (rare)
  { id: 'fraisy', nom: 'Fraisberry', set: 'fruit', rarete: 'rare', phrase: 'La star de l\'été, fraîche et pétillante.' },
  { id: 'mango', nom: 'Mangozilla', set: 'fruit', rarete: 'rare', phrase: 'Le kaiju du goûter : soleil tropical à chaque gorgée.' },
  { id: 'litchee', nom: 'Litchiko', set: 'fruit', rarete: 'rare', phrase: 'Petit parfum délicat, grand caractère.' },
  { id: 'passion', nom: 'Maracudja', set: 'fruit', rarete: 'rare', phrase: 'Le trésor acidulé venu du Brésil.' },
  { id: 'citro', nom: 'Citro', set: 'fruit', rarete: 'rare', phrase: 'Acidulé juste ce qu\'il faut.' },
  { id: 'pasteka', nom: 'Pastèka', set: 'fruit', rarete: 'rare', phrase: ' 92 % d\'eau, 100 % de fun.' },
  // Set Toppings (épique)
  { id: 'popping', nom: 'Popping', set: 'topping', rarete: 'epique', phrase: 'Elle éclate en bouche. Littéralement.' },
  { id: 'jelly', nom: 'Wobblina', set: 'topping', rarete: 'epique', phrase: 'Wobble wobble. Rien ne la déstabilise.' },
  { id: 'mochito', nom: 'Mochito', set: 'topping', rarete: 'epique', phrase: 'Tout doux, tout rond, tout bon.' },
  { id: 'coco', nom: 'Coco Loco', set: 'topping', rarete: 'epique', phrase: 'La perle blanche des îles — complètement loco.' },
  { id: 'pudding', nom: 'Flantastique', set: 'topping', rarete: 'epique', phrase: 'Le flan qui a du flair.' },
  { id: 'nuage', nom: 'Nuage', set: 'topping', rarete: 'epique', phrase: 'La chantilly qui plane au-dessus du lot.' },
  // Set Signatures (légendaire)
  { id: 'taro-queen', nom: 'Taro Queen', set: 'signature', rarete: 'legendaire', phrase: 'Violette, royale, inimitable.' },
  { id: 'matcha-sensei', nom: 'Matcha Sensei', set: 'signature', rarete: 'legendaire', phrase: 'Maître zen du thé vert cérémonial.' },
  { id: 'brown-sugar-king', nom: 'Brown Sugar King', set: 'signature', rarete: 'legendaire', phrase: 'Ses rayures de caramel font sa couronne.' },
  { id: 'oreo-star', nom: 'Tiger Sugar', set: 'signature', rarete: 'legendaire', phrase: 'Le brown sugar coule en rayures de tigre.' },
  { id: 'caramel-chef', nom: 'Caramel Chef', set: 'signature', rarete: 'legendaire', phrase: 'Il nappe tout ce qu\'il touche d\'or fondant.' },
  { id: 'bubble-master', nom: 'Bubble Master', set: 'signature', rarete: 'legendaire', phrase: 'La mascotte ultime. Peu l\'ont déjà vue…' },
];

export function collectiblesDuSet(set: SetId): Collectible[] {
  return COLLECTIBLES.filter((c) => c.set === set);
}

export function trouverCollectible(id: string): Collectible | undefined {
  return COLLECTIBLES.find((c) => c.id === id);
}

// --- Capsules (gacha) -----------------------------------------------------------

export type TypeCapsule = 'classique' | 'doree';

// 💰 Rééquilibrage 24/07 (Yoann) : les capsules coûtaient trop peu face au débit de
// perles (≈ 4 000 perles en 10 min de démarrage → 10 capsules). Classique 400 → 700,
// dorée 1 200 → 2 000. La chasse redevient un objectif, pas un achat de confort.
export const CAPSULES: Record<TypeCapsule, {
  nom: string; cout: number; couleur: string;
  poids: Record<Rarete, number>; // sur 100
}> = {
  classique: {
    nom: 'Capsule Classique', cout: 700, couleur: '#8A68B8',
    poids: { commun: 62, rare: 26, epique: 9, legendaire: 3 },
  },
  doree: {
    nom: 'Capsule Dorée', cout: 2000, couleur: '#C99012',
    poids: { commun: 0, rare: 60, epique: 30, legendaire: 10 },
  },
};

// Perles rendues quand on tire un doublon. Remontées le 24/07 avec le prix des capsules
// (≈ 13 % / 31 % / 71 % d'une classique ; légendaire inchangé ≈ 40 % d'une dorée) pour
// que le recyclage reste un vrai lot de consolation sans financer une capsule entière.
export const DOUBLON_PERLES: Record<Rarete, number> = {
  commun: 90, rare: 220, epique: 500, legendaire: 800,
};

// --- 💪 ENTRAÎNEMENT DES CARTES (19/07/2026) — LA réponse aux paliers de combat ---------
// Chaque carte a un NIVEAU (1..10). Chaque niveau au-delà du 1 donne +6 % PV et +6 % ATQ
// (jusqu'à +54 % au niveau 10) — appliqué UNIQUEMENT à l'équipe du joueur dans l'arène,
// jamais aux PNJ (leur force vient de l'échelle par rang). Coût en perles croissant, et
// paliers d'ÉVOLUTION aux niveaux 4/7/10 : ils consomment des doublons de LA carte
// (l'exemplaire vitrine n'est jamais consommé) — à défaut, des éclats en joker.
export const NIVEAU_CARTE_MAX = 10;
export const NIVEAU_CARTE_BONUS_PCT = 6;
export const NIVEAU_CARTE_MULT_RARETE: Record<Rarete, number> = { commun: 1, rare: 1.3, epique: 1.6, legendaire: 2 };
// Coût en perles pour passer DU niveau `niveauActuel` AU suivant (arrondi à la dizaine).
export function coutNiveauCarte(rarete: Rarete, niveauActuel: number): number {
  return Math.round(250 * Math.max(1, niveauActuel) * NIVEAU_CARTE_MULT_RARETE[rarete] / 10) * 10;
}
// niveau CIBLE → doublons de la carte requis (0 si pas un palier d'évolution)
export const EVOLUTIONS_CARTE: Record<number, number> = { 4: 1, 7: 2, 10: 3 };
export const ECLATS_PAR_DOUBLON = 40; // joker : remplace chaque doublon manquant
export function doublonsPourNiveau(niveauCible: number): number {
  return EVOLUTIONS_CARTE[niveauCible] ?? 0;
}
// Multiplicateur de stats d'une carte à un niveau donné (PUR, testé).
export function multNiveauCarte(niveau: number): number {
  const nv = Math.max(1, Math.min(NIVEAU_CARTE_MAX, Math.round(niveau)));
  return 1 + (NIVEAU_CARTE_BONUS_PCT / 100) * (nv - 1);
}

// 🎟️ Tournoi : retenter l'étape perdue de la semaine (au lieu d'attendre lundi)
export const TOURNOI_RETENTE_PERLES = 400;

// 🔥 SÉRIE DE VICTOIRES d'arène : tant qu'on ne perd pas, les perles de victoire
// montent (+15 %/victoire d'affilée, plafonné à ×1,6). Une défaite remet à zéro.
export const SERIE_V_PCT = 15;
export const SERIE_V_MAX = 4;
export function multSerieVictoires(serie: number): number {
  return 1 + (SERIE_V_PCT / 100) * Math.max(0, Math.min(SERIE_V_MAX, Math.round(serie)));
}

// Tire une rareté selon les poids, puis un collectible de cette rareté
export function tirerCapsule(type: TypeCapsule, rng: () => number = Math.random): Collectible {
  const poids = CAPSULES[type].poids;
  const total = poids.commun + poids.rare + poids.epique + poids.legendaire;
  let t = rng() * total;
  let rarete: Rarete = 'commun';
  for (const r of ['commun', 'rare', 'epique', 'legendaire'] as Rarete[]) {
    t -= poids[r];
    if (t < 0) { rarete = r; break; }
  }
  const pool = COLLECTIBLES.filter((c) => c.rarete === rarete);
  return pool[Math.floor(rng() * pool.length)];
}

// --- 🎁 Pity timer : la malchance est BORNÉE (le grand levier « une-de-plus ») --------
// Toutes les N capsules sans Épique+ → Épique garanti ; toutes les M sans
// Légendaire → Légendaire garanti. Les compteurs sont AFFICHÉS sur la machine.

export const PITY_EPIQUE = 10;      // capsules maxi sans épique-ou-mieux
export const PITY_LEGENDAIRE = 40;  // capsules maxi sans légendaire

// Tire un collectible d'une rareté AU MOINS égale à `min` (garantie de pity).
export function tirerCapsuleMin(type: TypeCapsule, min: Rarete, rng: () => number = Math.random): Collectible {
  const naturel = tirerCapsule(type, rng);
  if (RARETES[naturel.rarete].ordre >= RARETES[min].ordre) return naturel;
  const pool = COLLECTIBLES.filter((c) => RARETES[c.rarete].ordre >= RARETES[min].ordre);
  return pool[Math.floor(rng() * pool.length)];
}

// --- ⚡ Événements : week-end DOUBLE PERLES (calendrier fixe, zéro push) ---------------

export type Evenement = { actif: boolean; multiplicateur: number; titre: string; sous: string };

export function evenementDuJour(d: Date = new Date()): Evenement {
  const jour = d.getDay(); // 0 = dimanche, 6 = samedi
  if (jour === 0 || jour === 6) {
    return { actif: true, multiplicateur: 2, titre: '✨ Week-end DOUBLE PERLES', sous: 'Toutes tes perles gagnées sont doublées jusqu\'à dimanche soir !' };
  }
  return { actif: false, multiplicateur: 1, titre: '', sous: '' };
}

// --- 🎫 Boba Pass hebdomadaire : une piste d'XP remplie par TOUT ce qu'on fait ---------
// 100 % gratuit, remis à zéro chaque lundi. La carotte de rétention n°1 du F2P.

export const PASS_XP = {
  niveauPremiere: 60,   // 1ʳᵉ réussite d'un niveau d'Aventure
  niveauRejoue: 20,     // niveau déjà réussi
  defi: 50,             // défi du jour réclamé
  arene: 30,            // victoire d'Arène (Maître)
  tournoi: 80,          // victoire de tournoi
  capsule: 10,          // capsule ouverte
  partieInfini: 15,     // partie de mode Infini
} as const;

export type RecompensePalier = {
  xp: number;
  type: 'perles' | 'capsule' | 'capsule_doree';
  qte: number;
  perlesBonus?: number; // certains paliers cumulent (le dernier surtout)
};

export const PASS_PALIERS: RecompensePalier[] = [
  { xp: 100, type: 'perles', qte: 100 },
  { xp: 220, type: 'perles', qte: 150 },
  { xp: 360, type: 'capsule', qte: 1 },
  { xp: 520, type: 'perles', qte: 220 },
  { xp: 700, type: 'perles', qte: 280 },
  { xp: 900, type: 'capsule', qte: 1 },
  { xp: 1150, type: 'perles', qte: 350 },
  { xp: 1450, type: 'capsule', qte: 1 },
  { xp: 1800, type: 'perles', qte: 450 },
  { xp: 2200, type: 'capsule_doree', qte: 1, perlesBonus: 500 }, // 🏆 palier final
];

export function labelPalier(p: RecompensePalier): string {
  const base = p.type === 'perles' ? `+${p.qte} perles`
    : p.type === 'capsule' ? 'Capsule classique 🎁'
    : 'Capsule DORÉE 👑';
  return p.perlesBonus ? `${base} + ${p.perlesBonus} perles` : base;
}

// --- Gains de partie --------------------------------------------------------------

export const PERLES_MAX_PARTIE = 450;
// Plafond des perles d'un niveau d'Aventure (avant multiplicateurs). Était codé en
// dur dans le store (`Math.min(650, base)`) et échappait donc à cette config.
export const NIVEAU_PERLES_MAX = 650;
export const BONUS_PREMIERE_PARTIE = 2; // multiplicateur 1ʳᵉ partie du jour

// 💰 PLAFOND FINAL (26/07, décision Yoann) — appliqué APRÈS tous les multiplicateurs.
// Les plafonds ci-dessus s'appliquent à la conversion score → perles, donc AVANT
// le ×2 de la 1ʳᵉ partie, le ×2 du week-end, le ×1,3 de série et le % du copain
// Fruité : ils ne plafonnaient donc rien. Une partie d'Infini pouvait rapporter
// 450 × 1,2 × 2 × 2 × 1,3 = 2 808 perles alors que l'écran affichait « ≤ 450 ».
// Ce plafond-ci borne le gain RÉELLEMENT crédité : les bons jours restent très
// gratifiants (×2,7 sur une partie ordinaire) mais l'économie redevient bornée,
// et les seuils de la boutique (8 000 → 60 000) gardent le sens de leur design.
export const PERLES_MAX_FINAL = { infini: 1200, aventure: 1600 } as const;
export type ModeGain = keyof typeof PERLES_MAX_FINAL;

// Conversion score → perles (plafonnée pour garder l'économie saine)
export function perlesPourScore(score: number): number {
  return Math.min(PERLES_MAX_PARTIE, Math.round(score / 10));
}

// --- Récompenses des niveaux d'Aventure (équilibrage « Normal ») --------------------
// 1ʳᵉ réussite d'un niveau = perles (étoiles + score). La CAPSULE n'est plus systématique :
// classique GARANTIE uniquement aux niveaux multiples de NIVEAU_CAPSULE_RYTHME, DORÉE au
// boss (tous les 5, règle du moteur shooter n % 5 === 0 — garder les deux alignées).
// La capsule redevient un ÉVÉNEMENT anticipé (compte à rebours affiché), pas un tapis
// rouge à chaque niveau. Rejouer un niveau déjà réussi = quelques perles (anti-farm).

export const NIVEAU_PERLES_PAR_ETOILE = 40;   // bonus 1ʳᵉ réussite : étoiles × 40
export const NIVEAU_DIV_SCORE = 8;            // perles = score/8 (1ʳᵉ réussite)
export const NIVEAU_DIV_REJOUER = 14;         // perles = score/14 (niveau déjà réussi)
export const NIVEAU_DIV_ECHEC = 14;           // consolation en cas d'échec
export const NIVEAU_CAPSULE_RYTHME = 3;       // capsule classique aux niveaux multiples de 3 (1ʳᵉ réussite)
export const NIVEAU_PRIME_EXPLORATION = 60;   // perles bonus aux 1ʳᵉ réussites SANS capsule (compensation)

// Capsule offerte à la 1ʳᵉ réussite d'un niveau (null = perles seulement + prime).
// `boss` est le flag du moteur (n % 5 === 0) ; un niveau multiple de 3 ET boss → dorée.
export function capsuleDuNiveau(niveau: number, boss: boolean): TypeCapsule | null {
  if (boss) return 'doree';
  return niveau % NIVEAU_CAPSULE_RYTHME === 0 ? 'classique' : null;
}
// Prochain niveau (strictement après `niveau`) qui offre une capsule — pour le compte
// à rebours du récap (« Prochaine capsule garantie : niveau X — plus que N ! »).
export function prochaineCapsuleNiveau(niveau: number): number {
  let n = niveau + 1;
  while (!capsuleDuNiveau(n, n % 5 === 0)) n += 1;
  return n;
}

// --- Perles spéciales (power-ups de tir) — LE grand usage des perles ---------------

export const POWERUPS = {
  bombe: {
    nom: 'Perle Bombe', cout: 150, max: 3,
    detail: 'Explose toutes les perles autour de l\'impact — les capsules résistent mais perdent leur soutien.',
  },
  arc: {
    nom: 'Perle Arc-en-ciel', cout: 100, max: 3,
    detail: 'Prend la couleur du meilleur groupe qu\'elle touche : match garanti, sauve ta chaîne.',
  },
} as const;
export type PowerupId = keyof typeof POWERUPS;

// --- Défis du jour ------------------------------------------------------------------
// 3 défis tirés chaque jour (déterministes par date). Chaque défi rapporte des
// perles ; les 3 réclamés = +1 capsule classique.

export type MesureDefi =
  | 'niveauxTermines' | 'eclatees' | 'orphelines' | 'meilleurScorePartie'
  | 'capsulesLiberees' | 'meilleurGroupe' | 'chaineMax' | 'parties';

export type Defi = { id: string; label: string; cible: number; mesure: MesureDefi; perles: number };

export const DEFIS: Defi[] = [
  { id: 'niveaux2', label: 'Termine 2 niveaux d\'Aventure', cible: 2, mesure: 'niveauxTermines', perles: 250 },
  { id: 'eclate80', label: 'Éclate 80 perles', cible: 80, mesure: 'eclatees', perles: 200 },
  { id: 'orphelines25', label: 'Fais tomber 25 perles en combo', cible: 25, mesure: 'orphelines', perles: 250 },
  { id: 'score800', label: 'Fais 800 points en une partie', cible: 800, mesure: 'meilleurScorePartie', perles: 200 },
  { id: 'capsules2', label: 'Libère 2 capsules', cible: 2, mesure: 'capsulesLiberees', perles: 300 },
  { id: 'groupe5', label: 'Éclate un groupe de 5 perles ou plus', cible: 5, mesure: 'meilleurGroupe', perles: 250 },
  { id: 'chaine3', label: 'Atteins une chaîne ×3', cible: 3, mesure: 'chaineMax', perles: 250 },
  { id: 'parties3', label: 'Joue 3 parties', cible: 3, mesure: 'parties', perles: 180 },
];

// 3 défis distincts, déterministes pour une date donnée ('YYYY-MM-DD')
export function tirageDefisDuJour(jour: string): Defi[] {
  let graine = 0;
  for (let i = 0; i < jour.length; i++) graine = (graine * 31 + jour.charCodeAt(i)) >>> 0;
  // mulberry32 local (pas d'import du moteur pour rester sans dépendance)
  let a = graine >>> 0;
  const rng = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pool = [...DEFIS];
  const tires: Defi[] = [];
  while (tires.length < 3 && pool.length) {
    tires.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return tires;
}

export const BONUS_DEFIS_CAPSULES = 1; // capsule(s) classique(s) quand les 3 défis sont réclamés

// --- « Copain de tir » : un collectible équipé donne un bonus passif au shooter ------
// L'effet dépend du SET, sa force de la RARETÉ (les 24 ont donc tous une utilité).

export type EffetBuddy = {
  tirsBonus: number;      // Milk : tirs en plus en Aventure
  perlesPct: number;      // Fruité : % de perles en plus en fin de partie
  remisePct: number;      // Topping : remise sur les perles spéciales (💣🌈)
  graceChaine: number;    // Signature : la chaîne survit à N tirs ratés
  libelle: string;
};

export function effetBuddy(set: SetId, rarete: Rarete): EffetBuddy {
  const i = RARETES[rarete].ordre; // 0..3
  switch (set) {
    case 'milk': {
      const v = [1, 2, 3, 4][i];
      return { tirsBonus: v, perlesPct: 0, remisePct: 0, graceChaine: 0, libelle: `+${v} tir${v > 1 ? 's' : ''} en Aventure` };
    }
    case 'fruit': {
      const v = [5, 10, 15, 20][i];
      return { tirsBonus: 0, perlesPct: v, remisePct: 0, graceChaine: 0, libelle: `+${v} % de perles gagnées` };
    }
    case 'topping': {
      const v = [10, 20, 30, 40][i];
      return { tirsBonus: 0, perlesPct: 0, remisePct: v, graceChaine: 0, libelle: `−${v} % sur les perles spéciales` };
    }
    case 'signature': {
      const v = [1, 1, 2, 2][i];
      return { tirsBonus: 0, perlesPct: 0, remisePct: 0, graceChaine: v, libelle: `la chaîne survit à ${v} raté${v > 1 ? 's' : ''}` };
    }
  }
}

// --- Boutique des prix (perles → prix réels, paliers volontairement longs) --------

// Économie « généreuse » : les vrais prix restent accessibles, mais sur plusieurs
// sessions. Les seuils sont volontairement au-dessus des dépenses in-game :
// une capsule dorée coûte 2 000 perles, un vrai tampon commence à 8 000.
// Rééquilibrage du 18/07/2026 (validé Yoann) : à ~1 000-1 500 perles/jour de jeu
// actif, tampon ≈ 1 semaine, −10 % ≈ 2 semaines, −20 % ≈ 1 mois, boisson ≈ 6 sem.
// La vraie protection anti-abus reste le plafond MENSUEL par article (parMois),
// inchangé : le coût réel maxi pour la boutique ne bouge pas.
// 🛡️ Anti-farm : CHAQUE article a un plafond MENSUEL (`parMois`, mois calendaire —
// suivi par article dans le store, `prixMois.achats`). Le jeu reste généreux en
// récompenses in-game (capsules, objets, perles illimitées), mais ce qui coûte du
// vrai produit au magasin est borné : un farmeur ne remplit pas une carte en une
// soirée (max/mois : 1 tampon + 3×−10 % + 1×−20 % + 1 grande boisson).
// La roulette (1 tour/mois, boisson à ~1 %) reste hors plafonds : jackpot auto-limité.
// NB : le plafond mensuel s'affiche via `parMois` directement dans la carte de l'article
// (pastille dédiée dans boutique.tsx) — ne PAS le répéter dans `detail`.
export const BOUTIQUE: { id: string; code: CodeRecompenseReelle; cout: number; type: TypePrix; qte: number; parMois: number; label: string; detail: string }[] = [
  { id: 'tampon-1', code: 'boutique_tampon_1', cout: 8000, type: 'tampon', qte: 1, parMois: 1, label: '+1 tampon', detail: 'Un tampon direct sur ta carte de fidélité' },
  { id: 'reduc-10', code: 'boutique_reduction_10', cout: 20000, type: 'reduction', qte: 10, parMois: 3, label: '−10 %', detail: 'Sur ta prochaine commande en boutique' },
  { id: 'reduc-20', code: 'boutique_reduction_20', cout: 40000, type: 'reduction', qte: 20, parMois: 1, label: '−20 %', detail: 'Grosse réduction sur ta prochaine commande' },
  { id: 'boisson-l', code: 'boutique_boisson_l', cout: 60000, type: 'boisson', qte: 1, parMois: 1, label: 'Grande boisson offerte', detail: 'Taille L (M pour les Signatures)' },
];

// --- Roulette mensuelle (toujours gagnante, 1 tour par mois) -----------------------

export type SegmentRoulette = {
  id: string; code?: CodeRecompenseReelle; label: string; type: TypePrix; qte: number; poids: number; couleur: string;
};

// 🩹 27/07 — RÉÉQUILIBRAGE + PARTS ÉGALES. Deux problèmes tenaient ensemble :
//  1. Les lots en perles étaient dérisoires à côté des lots réels. +300 perles, c'est
//     3,75 % du prix boutique d'un tampon (8 000 perles) et un quart d'une journée de
//     jeu — pour un tour qui ne revient qu'une fois par MOIS. Le joueur qui tombait
//     dessus avait l'impression d'avoir perdu sur une roue « toujours gagnante ».
//  2. L'écart de chances allait de 28 % à 1 %, donc la roue devait découper des parts
//     proportionnelles pour ne pas mentir — et une part de 1 % fait 3,6°, illisible.
// On resserre donc l'écart (18 % → 7 %, rapport 2,6 au lieu de 28) : les parts peuvent
// redevenir ÉGALES sans tromper, puisque 12,5 % apparents contre 7 % réels au pire,
// c'est un facteur 1,8 — pas un facteur 12. Les chances exactes restent affichées sous
// la roue ("Tes chances") : c'est ce qui rend les parts égales défendables, NE PAS
// retirer cette liste.
// ⚠️ Toute modification des poids doit garder le rapport max/min sous ~2,5, sinon les
// parts égales redeviennent un mensonge et il faut repasser en proportionnel.
// Couleurs : alignées sur les tokens de `constants/charte.ts` (dette DA du 18/07).
export const ROULETTE: SegmentRoulette[] = [
  { id: 'tampon-1', code: 'roulette_tampon_1', label: '+1 tampon', type: 'tampon', qte: 1, poids: 18, couleur: '#9FC038' },      // C.vert
  { id: 'perles-300', label: '1 200 perles', type: 'perles', qte: 1200, poids: 15, couleur: '#815FAE' },                          // C.violetClair
  { id: 'tampon-2', code: 'roulette_tampon_2', label: '+2 tampons', type: 'tampon', qte: 2, poids: 14, couleur: '#89CFE3' },     // C.bleu
  { id: 'capsule-doree', label: 'Capsule dorée', type: 'capsule_doree', qte: 1, poids: 13, couleur: '#F7B8D6' },                  // C.rose
  { id: 'reduc-10', code: 'roulette_reduction_10', label: '−10 %', type: 'reduction', qte: 10, poids: 12, couleur: '#F2DA33' },  // C.jaune
  { id: 'perles-800', label: '3 000 perles', type: 'perles', qte: 3000, poids: 11, couleur: '#452A6E' },                          // C.violetProfond
  { id: 'tampon-3', code: 'roulette_tampon_3', label: '+3 tampons', type: 'tampon', qte: 3, poids: 10, couleur: '#5C7A1F' },     // C.vertFonce
  { id: 'boisson-l', code: 'roulette_boisson_l', label: 'Boisson offerte', type: 'boisson', qte: 1, poids: 7, couleur: '#93325E' }, // C.roseFonce
];

// 👛 Les lots en perles sont crédités À LEUR VALEUR FACIALE, hors multiplicateurs
// (décision Yoann du 27/07) : la part annonce « 1 200 perles », le joueur touche
// 1 200 perles, quel que soit le jour. Voir `crediterRoulette` dans le store — c'est
// aussi ce qui rend inutile tout plafond ici.

export function tirerRoulette(rng: () => number = Math.random): SegmentRoulette {
  const total = ROULETTE.reduce((s, x) => s + x.poids, 0);
  let t = rng() * total;
  for (const seg of ROULETTE) {
    t -= seg.poids;
    if (t < 0) return seg;
  }
  return ROULETTE[0];
}

// --- Clés de période (bonus quotidien / roulette mensuelle) ------------------------

export function cleJour(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// --- 🔥 Série quotidienne (streak) ---------------------------------------------------
// Revenir chaque jour entretient la série : petites perles quotidiennes, capsule
// dorée chaque 7e jour, et un multiplicateur PERMANENT sur tous les gains de
// perles tant que la série tient. Rien n'est perdu en cas d'absence : la série
// repart à 1, sans malus.
export type Serie = { jours: number; dernierJour: string };
export const SERIE_PERLES = [50, 80, 110, 150, 200, 250] as const; // J1..J6 (J7 = capsule dorée)

export function multSerie(jours: number): number {
  if (jours >= 14) return 1.3;
  if (jours >= 7) return 1.2;
  if (jours >= 3) return 1.1;
  return 1;
}

// Helper PUR (testable) : fait avancer la série pour `jour` (hier = clé de la veille).
// Retourne null si la série a déjà été pointée aujourd'hui.
export function serieApresTick(s: Serie, jour: string, hier: string):
  | { serie: Serie; perles: number; capsuleDoree: boolean }
  | null {
  if (s.dernierJour === jour) return null;
  const jours = s.dernierJour === hier ? s.jours + 1 : 1;
  const capsuleDoree = jours % 7 === 0;
  const perles = capsuleDoree ? 0 : SERIE_PERLES[Math.min((jours - 1) % 7, SERIE_PERLES.length - 1)];
  return { serie: { jours, dernierJour: jour }, perles, capsuleDoree };
}

// --- 🧋 LA GORGÉE FRAÎCHE — le jeu récompense une VRAIE visite (Phase 0, 26/07/2026) --
// Constat de départ : rien, dans tout le jeu, ne dépendait d'un achat réel. On pouvait
// tout farmer depuis son canapé et ne venir que récolter. La flèche n'allait que dans un
// sens : le jeu PAYAIT la boutique (tampons, réductions, boissons offertes).
//
// Ce bloc inverse la flèche SANS aucun travail serveur : `app/index.tsx` interroge déjà
// `fidelite_cloud` toutes les 15 s, et personne ne comparait l'ancienne valeur à la
// nouvelle. Une vraie visite est donc déjà observable, gratuitement, aujourd'hui.
//
// SÉPARATION VOLONTAIRE EN DEUX MOITIÉS :
//  • la DÉTECTION (`SuiviTampons`) vit dans `lib/visites.ts`, hors du store du jeu —
//    l'accueil de l'app ne doit pas importer `@/store/jeu` (invariant vérifié : seuls les
//    écrans `app/jeu/*` l'importent, ce qui garantit qu'aucune mutation ne précède
//    l'hydratation et rend le fail-closed de `app/jeu/_layout.tsx` sûr) ;
//  • la RÉCOMPENSE (`EtatVisites`) vit dans le store, qui consomme ce que la détection
//    a mis de côté.
//
// ⚠️ TROIS PIÈGES, tous traités ici :
// 1. `fidelite_cloud.tampons` est le compteur INTRA-CARTE (affiché « n/9 ») : il retombe
//    à 0 quand une carte se complète. Le total MONOTONE est `cartes_completees × 9 +
//    tampons` — sinon une carte remplie ressemble à une baisse et la visite est perdue.
// 2. Le compteur monte AUSSI quand la caisse honore un tampon GAGNÉ DANS LE JEU. On
//    soustrait cette part, lue côté SERVEUR (`jeu_recompenses_demandes` au statut
//    `appliquee`) et non depuis l'état local — c'est la source de vérité. En cas de doute
//    on SUR-estime cette part : mieux vaut manquer une récompense que d'en offrir une
//    pour un prix qu'on s'est offert soi-même.
// 3. Sans amorçage, une réinstallation (suivi local vide, compteur cloud à 47) serait lue
//    comme 47 achats d'un coup. Le premier constat ne récompense JAMAIS : il calibre.

export const TAMPONS_PAR_CARTE = 9;

export const GORGEE_FRAICHE = {
  capsulesDorees: 1,            // par visite constatée
  capsuleParBoissonEnPlus: 1,   // une classique par boisson au-delà de la première
  maxCapsulesClassiques: 4,     // borne : une grosse commande n'ouvre pas un coffre-fort
  perles: 300,
  heuresX2: 24,                 // durée du ×2 perles offert par la visite
  tourneesOffertes: 1,
  multiplicateur: 2,
} as const;

// ————— moitié 1 : DÉTECTION (persistée par lib/visites.ts, hors store du jeu) —————

export type SuiviTampons = {
  amorce: boolean;      // a-t-on déjà calibré sur un total ? (anti-réinstallation)
  totalVu: number;      // dernier total MONOTONE de tampons observé
  totalJeuVu: number;   // part de ce total imputable aux prix du jeu
  enAttente: number;    // boissons réelles constatées, pas encore récompensées par le jeu
};

export const SUIVI_TAMPONS_VIERGE: SuiviTampons = { amorce: false, totalVu: 0, totalJeuVu: 0, enAttente: 0 };

/** Total de tampons MONOTONE à partir de ce que renvoie `fidelite_cloud`.
 *  `cartesCompletees` absent (vieille ligne) → repli sur le seul compteur intra-carte :
 *  une complétion de carte ressemblera à une baisse, donc à zéro récompense — jamais à
 *  une fausse récompense. */
export function totalTamponsMonotone(tampons: unknown, cartesCompletees: unknown): number {
  const t = Math.max(0, Math.floor(Number(tampons) || 0));
  const c = Math.max(0, Math.floor(Number(cartesCompletees) || 0));
  return c * TAMPONS_PAR_CARTE + t;
}

/** Part du total imputable aux PRIX DU JEU déjà honorés en caisse. PUR.
 *  Entrée = les demandes serveur (`jeu_recompenses_demandes`), source de vérité. */
export function tamponsIssusDuJeu(
  demandes: { type: string; quantite: unknown; tampons_bonus?: unknown; statut: string }[],
): number {
  let n = 0;
  for (const d of demandes) {
    if (d.statut !== 'appliquee') continue;
    if (d.type === 'tampon') n += Math.max(0, Math.floor(Number(d.quantite) || 0));
    n += Math.max(0, Math.floor(Number(d.tampons_bonus) || 0)); // collection complète
  }
  return n;
}

/** Helper PUR (testé) : constate un total et en déduit les ACHATS RÉELS, accumulés dans
 *  `enAttente` jusqu'à ce que le jeu les consomme. */
export function suiviApresConstat(su: SuiviTampons, total: number, totalJeu: number): SuiviTampons {
  const t = Math.max(0, Math.floor(total));
  const tj = Math.max(0, Math.floor(totalJeu));
  if (!su.amorce) return { ...su, amorce: true, totalVu: t, totalJeuVu: tj }; // calibrage
  const boissons = (t - su.totalVu) - Math.max(0, tj - su.totalJeuVu);
  if (boissons <= 0) {
    // baisse (carte complétée sans `cartes_completees`, correction caisse, transfert de
    // carte…) → on se recalibre vers le haut sans rien offrir.
    return { ...su, totalVu: Math.max(su.totalVu, t), totalJeuVu: Math.max(su.totalJeuVu, tj) };
  }
  return { amorce: true, totalVu: t, totalJeuVu: tj, enAttente: su.enAttente + boissons };
}

// ————— moitié 2 : RÉCOMPENSE (persistée dans le store du jeu) —————

export type EtatVisites = {
  boostJusqua: string;    // ISO — fin du ×2 « Gorgée Fraîche » ('' = aucun)
  visites: number;        // visites constatées, cumulées (affichage)
  derniereVisite: string; // ISO de la dernière visite constatée
};

export const VISITES_VIERGES: EtatVisites = { boostJusqua: '', visites: 0, derniereVisite: '' };

export type GainGorgee = {
  boissons: number;
  capsulesDorees: number;
  capsulesClassiques: number;
  perles: number;
  tournees: number;
};

/** Ce que rapportent `boissons` réelles constatées. PUR (testé). */
export function gorgeePourBoissons(boissons: number): GainGorgee | null {
  const n = Math.max(0, Math.floor(boissons));
  if (n <= 0) return null;
  return {
    boissons: n,
    capsulesDorees: GORGEE_FRAICHE.capsulesDorees,
    capsulesClassiques: Math.min(
      GORGEE_FRAICHE.maxCapsulesClassiques,
      (n - 1) * GORGEE_FRAICHE.capsuleParBoissonEnPlus,
    ),
    perles: GORGEE_FRAICHE.perles,
    tournees: GORGEE_FRAICHE.tourneesOffertes,
  };
}

/** Nouvel état de visite après une Gorgée (relance le ×2 de 24 h). PUR. */
export function visitesApresGorgee(v: EtatVisites, maintenant: Date = new Date()): EtatVisites {
  return {
    boostJusqua: new Date(maintenant.getTime() + GORGEE_FRAICHE.heuresX2 * 3600_000).toISOString(),
    visites: v.visites + 1,
    derniereVisite: maintenant.toISOString(),
  };
}

/** Multiplicateur de perles apporté par une visite récente (1 = aucun). PUR. */
export function multGorgee(v: EtatVisites, maintenant: Date = new Date()): number {
  if (!v.boostJusqua) return 1;
  const fin = Date.parse(v.boostJusqua);
  if (!Number.isFinite(fin) || fin <= maintenant.getTime()) return 1;
  return GORGEE_FRAICHE.multiplicateur;
}

/** Heures restantes de ×2 « Gorgée Fraîche » (0 si inactif). PUR. */
export function heuresGorgeeRestantes(v: EtatVisites, maintenant: Date = new Date()): number {
  if (multGorgee(v, maintenant) === 1) return 0;
  return Math.max(0, Math.ceil((Date.parse(v.boostJusqua) - maintenant.getTime()) / 3600_000));
}

/** Normalise le champ persisté `visites` (pattern migrerExploits : assainit, ne purge
 *  jamais). Champ ADDITIF : absent des sauvegardes d'avant le 26/07. */
export function migrerVisites(brut: unknown): EtatVisites {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return { ...VISITES_VIERGES };
  const b = brut as Record<string, unknown>;
  const iso = (x: unknown) => (typeof x === 'string' && Number.isFinite(Date.parse(x)) ? x : '');
  return {
    boostJusqua: iso(b.boostJusqua),
    visites: Math.max(0, Math.floor(Number(b.visites) || 0)),
    derniereVisite: iso(b.derniereVisite),
  };
}

/** Normalise le suivi persisté par lib/visites.ts. PUR. */
export function migrerSuiviTampons(brut: unknown): SuiviTampons {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return { ...SUIVI_TAMPONS_VIERGE };
  const b = brut as Record<string, unknown>;
  const ent = (x: unknown) => Math.max(0, Math.floor(Number(x) || 0));
  return {
    amorce: b.amorce === true,
    totalVu: ent(b.totalVu),
    totalJeuVu: ent(b.totalJeuVu),
    enAttente: ent(b.enAttente),
  };
}

// --- 🎫 LE PASSEPORT DE LA CARTE — une carte se débloque en BUVANT (26/07/2026) -------
// Les 24 collectibles ne sont pas des personnages inventés autour d'un thème : ce SONT
// les boissons de la carte. Taro Queen, Matcha Sensei, Mangozilla, Wobblina… Et les ids
// du catalogue sont déjà IDENTIQUES côté caisse et côté app (`mt-taro` des deux côtés),
// donc « acheter un Taro débloque Taro Queen » est exprimable sans rien réconcilier.
//
// POURQUOI DÉTERMINISTE, ET JAMAIS ALÉATOIRE. Un achat réel donne un résultat ANNONCÉ
// D'AVANCE. Faire d'un achat un tirage de capsule ferait entrer de l'argent réel dans un
// mécanisme de hasard — exactement ce sur quoi plusieurs pays européens légifèrent, et la
// clientèle est jeune. Aujourd'hui le jeu est propre sur ce point (les perles ne
// s'achètent pas, aucune bibliothèque de paiement dans son périmètre) : on ne franchit
// pas cette ligne. C'est aussi meilleur en expérience — un client qui achète un matcha
// pour Matcha Sensei et tire un doublon de Boba est un client déçu par sa boutique.
//
// LE SET COMMUN RESTE GRATUIT. Un joueur qui ne vient jamais garde une équipe complète et
// compétitive : 3 communes coûtent 3 points sur un budget de 7, donc +24 % de stats via
// `multOutsider` — le système anticipait déjà ce cas. Ce n'est pas un lot de consolation,
// c'est un style de jeu. Ce qu'il n'a pas : les 18 cartes rares/épiques/légendaires.
//
// ✅ 27/07/2026 — LES DEUX DERNIERS MAPPINGS SONT TRANCHÉS (décisions de Yoann).
// Il restait deux cartes sans équivalent produit, et c'était une brèche : un épique et LA
// légendaire ultime tombaient d'une capsule sans le moindre achat, Passeport actif.
//  • Flantastique → la FAMILLE VANILLE, 2 achats (4 saveurs sur 3 catégories, aucune
//    réclamée par une autre carte). Un flan est une crème vanille.
//  • Bubble Master → les 23 AUTRES cartes réunies. Ce n'est pas un achat : c'est la
//    variante `{ par: 'collection' }` ci-dessous. Une mascotte ne se commande pas, elle
//    se mérite — et le joueur qui a tout le reste a, de fait, déjà tout bu.
// Reste hors mapping le seul set commun (les 6 Milk Tea), et c'est une décision produit
// explicite : un joueur qui ne vient jamais garde une équipe complète et compétitive.

/** Une cible d'achat au catalogue. Les ids sont ceux de `data/catalogue.js`, partagés
 *  avec la caisse (`src/shared/data/catalogue.js` du dépôt POS) — même référentiel. */
export type CibleProduit =
  | { type: 'saveur'; id: string }        // ex. 'mt-taro'
  | { type: 'categorie'; id: string }     // ex. 'mochi-glace' (n'importe quelle saveur)
  | { type: 'topping'; id: string }       // ex. 'jelly-litchi'
  | { type: 'supplement'; id: 'chantilly' | 'lait-avoine' };

export type Deblocage =
  /** obtenable en JOUANT — et donc GRATUITE même Passeport actif (le set commun) */
  | { par: 'jeu' }
  /** obtenable en ACHETANT : `nb` achats parmi n'importe laquelle des `cibles` */
  | { par: 'achat'; cibles: CibleProduit[]; nb: number }
  /** obtenable en RÉUNISSANT `nb` AUTRES cartes de la collection (Bubble Master).
   *  ⚠️ Ce n'est PAS une carte gratuite : elle ne sort d'une capsule que lorsque la
   *  condition est remplie. Sans cette variante, la légendaire ultime serait la plus
   *  facile à obtenir de tout le jeu — l'inverse exact de ce qu'elle raconte. */
  | { par: 'collection'; nb: number };

// Nombre d'achats requis selon la rareté. La progression est volontairement douce : la
// collection complète doit représenter ~24 à 36 achats, soit 4 mois pour un client
// bi-mensuel — assez long pour être un projet, assez court pour rester un projet.
export const ACHATS_PAR_RARETE: Record<Rarete, number> = {
  commun: 0, rare: 1, epique: 2, legendaire: 3,
};

const sav = (id: string): CibleProduit => ({ type: 'saveur', id });
const cat = (id: string): CibleProduit => ({ type: 'categorie', id });
const top = (id: string): CibleProduit => ({ type: 'topping', id });

/** Ce qui débloque chaque carte. Toute carte absente de cette table = `{ par: 'jeu' }`.
 *
 *  🔗 UNE MÊME CIBLE PEUT SERVIR PLUSIEURS CARTES, et c'est assumé depuis le 27/07.
 *  Deux cibles sont réellement partagées aujourd'hui :
 *    · `jelly-brown-sugar` ouvre Jelly à 2 achats PUIS Brown Sugar King à 3 ;
 *    · `mt-taro-coco` ouvre Coco à 2 achats PUIS Taro Queen à 3.
 *  Yoann en fait des produits doublement récompensés — un topping jelly brown sugar, un
 *  taro-coco, deviennent les articles qui « rapportent le plus », ce qui est exactement
 *  le levier qu'une carte de boutique doit avoir.
 *  ⚠️ NE PAS reprendre l'ancien exemple `sg-creme-brulee` → Flantastique : il est FAUX.
 *  Flantastique (`pudding`) est adossée à la FAMILLE VANILLE (décision Yoann du 27/07,
 *  cf. son bloc plus bas), et la crème brûlée y a justement été ÉCARTÉE parce qu'elle
 *  est déjà la cible unique de `caramel-chef`.
 *  Rien dans le moteur ne suppose l'unicité d'une cible : `achatsPourCarte` recompte
 *  l'historique CARTE PAR CARTE (`d.cibles.some(...)`), sans consommer les lignes ni
 *  tenir de registre global. Deux cartes peuvent donc progresser sur le même achat, et
 *  `rangGout` monte pour les deux — voulu : c'est la même boisson qu'on aime. Le seul
 *  test d'unicité existant est volontairement limité aux 6 fruités (« un fruit = une
 *  saveur »), là où une collision serait une erreur de saisie. */
export const DEBLOCAGE_CARTES: Record<string, Deblocage> = {
  // 🧋 LA BANDE MILK TEA (commun) — GRATUIT, obtenable en jouant. Choix de design :
  // c'est l'équipe du joueur qui ne peut pas venir. Aucun mapping.

  // 🍓 LE GANG DES FRUITÉS (rare) — 1 achat du fruit correspondant.
  // Les 6 tombent EXACTEMENT sur 6 saveurs de `fruit-tea`. Aucune ambiguïté.
  fraisy: { par: 'achat', nb: 1, cibles: [sav('ft-fraise')] },
  mango: { par: 'achat', nb: 1, cibles: [sav('ft-mangue')] },
  litchee: { par: 'achat', nb: 1, cibles: [sav('ft-litchi')] },
  passion: { par: 'achat', nb: 1, cibles: [sav('ft-passion')] },
  citro: { par: 'achat', nb: 1, cibles: [sav('ft-citron')] },
  pasteka: { par: 'achat', nb: 1, cibles: [sav('ft-pasteque')] },

  // ✨ L'ÉQUIPE TOPPINGS (épique) — 2 achats AVEC le topping. C'est la famille la plus
  // rentable : un topping est un supplément sur un panier déjà décidé, donc de la marge
  // quasi pure. Plusieurs cibles acceptées quand la carte désigne une FAMILLE.
  // « Elle éclate en bouche » = les perles de fruit (popping boba) : toutes acceptées.
  popping: {
    par: 'achat', nb: 2,
    cibles: ['perles-mangue', 'perles-myrtille', 'perles-peche', 'perles-cerise',
      'perles-fraise', 'perles-framboise', 'perles-passion', 'perles-litchi'].map(top),
  },
  // « Wobble wobble » = les jellies, les deux parfums comptent.
  jelly: { par: 'achat', nb: 2, cibles: [top('jelly-litchi'), top('jelly-brown-sugar')] },
  // « Tout doux, tout rond » → la catégorie mochi glacé (aucun topping mochi n'existe).
  mochito: { par: 'achat', nb: 2, cibles: [cat('mochi-glace')] },
  // « La perle blanche des îles » → la coco, dans n'importe quelle famille.
  coco: { par: 'achat', nb: 2, cibles: [sav('mt-coco'), sav('ms-coco'), sav('mo-coco'), sav('mt-taro-coco')] },
  // « La chantilly qui plane au-dessus du lot » → le supplément chantilly.
  nuage: { par: 'achat', nb: 2, cibles: [{ type: 'supplement', id: 'chantilly' }] },
  // ✅ 27/07 (décision Yoann) — Flantastique (« le flan qui a du flair ») → LA FAMILLE
  // VANILLE, 2 achats. Aucun topping flan n'existe au catalogue ; un flan, c'est une
  // crème vanille, et les quatre saveurs vanille du catalogue n'étaient réclamées par
  // AUCUNE autre carte. Réparties sur trois catégories (milk tea, milkshake,
  // traditional), elles restent faciles à atteindre pour un épique.
  // (La crème brûlée avait été envisagée puis écartée : elle est déjà la cible de
  // `caramel-chef`, et deux cartes sur un même produit brouillait la lecture.)
  pudding: {
    par: 'achat', nb: 2,
    cibles: [sav('mt-vanille'), sav('ms-vanille'), sav('mt-malt-vanille'), sav('tr-malt-vanille')],
  },

  // 👑 LES SIGNATURES ROYALES (légendaire) — 3 achats. Ce sont les produits premium.
  'taro-queen': { par: 'achat', nb: 3, cibles: [sav('mt-taro'), sav('ms-taro'), sav('mt-taro-coco')] },
  'matcha-sensei': {
    par: 'achat', nb: 3,
    cibles: [sav('sg-matcha-mousse'), sav('mt-matcha'), sav('ms-matcha'),
      sav('mt-matcha-vanille'), sav('mt-matcha-fraise')],
  },
  'brown-sugar-king': { par: 'achat', nb: 3, cibles: [sav('mt-brown-sugar'), top('jelly-brown-sugar')] },
  // Tiger Sugar : la carte s'appelle « Tiger Sugar » et le produit existe tel quel.
  'oreo-star': { par: 'achat', nb: 3, cibles: [sav('sg-tiger')] },
  // « Il nappe tout ce qu'il touche d'or fondant » → la crème brûlée, à elle seule.
  'caramel-chef': { par: 'achat', nb: 3, cibles: [sav('sg-creme-brulee')] },
  // ✅ 27/07 — Bubble Master (« la mascotte ultime, peu l'ont déjà vue ») → LES 23 AUTRES
  // CARTES RÉUNIES. Aucun produit ne lui correspond, et lui en inventer un aurait été le
  // mapping de force qu'on s'interdit. Elle devient la récompense de la collection : le
  // joueur qui la décroche a forcément tout bu, donc le Passeport est honoré sans qu'on
  // ait eu à mentir sur la carte. `nb` est DÉRIVÉ (23 aujourd'hui) et pas écrit en dur :
  // ajouter un 25ᵉ collectible ne doit pas rendre la mascotte silencieusement plus facile.
  'bubble-master': { par: 'collection', nb: COLLECTIBLES.length - 1 },
};

// 🚦 DÉFAUT COMPILÉ DE L'INTERRUPTEUR DU PASSEPORT. À `false`, TOUT se comporte
// exactement comme avant : les capsules donnent n'importe quelle carte, la collection
// s'obtient en jouant. À `true`, la découverte passe par les achats réels et les capsules
// ne donnent plus que des DOUBLONS de cartes déjà débloquées (matière d'entraînement).
//
// ⚠️ CE N'EST PLUS LA VALEUR QUI FAIT FOI AU RUNTIME (27/07/2026). La bascule est
// désormais SERVEUR : `app_config`, clé `passeport_carte`, sur le modèle exact du flag
// `jeu` (voir `lib/app-config.ts`). Le moteur reste pur — il ne lit rien — et c'est le
// store qui porte la valeur vivante (`store/jeu.ts` : `passeportActif()`).
//
// POURQUOI SERVEUR. Le jour de la bascule, le vivier des capsules se restreint d'un coup.
// Si c'est trop dur, il faut pouvoir revenir en arrière EN SECONDES, pas en une OTA :
// une constante compilée rendait l'aller ET le retour dépendants d'une publication.
// Un joueur qui voit sa collection se fermer ne revient pas — la marche arrière doit être
// moins chère que la marche avant.
//
// Ce défaut RESTE à `false`, et le repli hors-ligne / erreur de lecture aussi : mieux
// vaut une collection ouverte par erreur qu'une collection fermée par erreur.
// Il ne doit passer à `true` (côté serveur) qu'une fois la caisse en train de publier
// réellement `achats_lignes` — sinon on verrouille sans donner la clé.
export const PASSEPORT_ACTIF = false;

/** Ce qui débloque une carte (défaut : obtenable en jouant). PUR. */
export function deblocageDe(id: string): Deblocage {
  return DEBLOCAGE_CARTES[id] ?? { par: 'jeu' };
}

/** Une ligne d'achat telle que la publiera `achats_lignes` (Phase 2). */
export type LigneAchat = {
  categorieId: string;
  saveurId: string;
  quantite: number;
  toppings?: string[];
  chantilly?: boolean;
  laitAvoine?: boolean;
};

/** Une ligne d'achat satisfait-elle cette cible ? PUR. */
export function ligneSatisfait(ligne: LigneAchat, cible: CibleProduit): boolean {
  switch (cible.type) {
    case 'saveur': return ligne.saveurId === cible.id;
    case 'categorie': return ligne.categorieId === cible.id;
    case 'topping': return Array.isArray(ligne.toppings) && ligne.toppings.includes(cible.id);
    case 'supplement':
      return cible.id === 'chantilly' ? ligne.chantilly === true : ligne.laitAvoine === true;
  }
}

/** Combien d'achats comptent pour cette carte, d'après l'historique. PUR (testé).
 *  Une ligne de quantité 3 compte pour 3 : le client a bien payé trois boissons.
 *  Chaque carte recompte l'historique POUR ELLE : rien n'est consommé, aucun registre
 *  global — deux cartes qui partagent une cible progressent donc toutes les deux (voir
 *  crème brûlée → Flantastique + Caramel Chef). Une carte `jeu` ou `collection` n'a
 *  aucune cible produit : 0, et c'est la bonne réponse (rien ne s'achète pour elle). */
export function achatsPourCarte(id: string, lignes: LigneAchat[]): number {
  const d = deblocageDe(id);
  if (d.par !== 'achat') return 0;
  let n = 0;
  for (const l of lignes) {
    if (d.cibles.some((c) => ligneSatisfait(l, c))) n += Math.max(1, Math.floor(l.quantite || 1));
  }
  return n;
}

// Combien d'AUTRES collectibles le joueur possède (la carte elle-même ne se compte pas —
// sinon Bubble Master s'aiderait d'elle-même). Version interne : prend un Set déjà
// construit, pour ne pas en refabriquer un par carte dans les boucles sur COLLECTIBLES.
function compterAutresCartes(id: string, acquises: Set<string>): number {
  let n = 0;
  for (const c of COLLECTIBLES) if (c.id !== id && acquises.has(c.id)) n += 1;
  return n;
}

/** Combien d'AUTRES cartes de la collection le joueur possède, hors `id`. PUR.
 *  C'est la mesure de la variante `{ par: 'collection' }` (Bubble Master). */
export function autresCartesPossedees(id: string, possedees: readonly string[]): number {
  return compterAutresCartes(id, new Set(possedees));
}

/** Progression du Passeport pour une carte : acquise ? combien reste-t-il ? PUR.
 *
 *  @param possedees ids déjà en collection — nécessaire aux seules cartes
 *  `{ par: 'collection' }`, d'où le paramètre OPTIONNEL ajouté en dernier (aucune
 *  signature existante n'est rompue). Absent → une carte `collection` se lit « 0/23 »,
 *  ce qui est la lecture prudente : jamais « acquise » par défaut.
 *
 *  ⚠️ La FORME du retour ne bouge pas (4 champs) : `parJeu` reste le seul discriminant
 *  affiché, et il vaut `false` pour une carte `collection` — elle n'est PAS gratuite.
 *  Un écran qui veut distinguer « à boire » de « à réunir » interroge `deblocageDe`. */
export function passeportCarte(id: string, lignes: LigneAchat[], possedees: readonly string[] = []): {
  parJeu: boolean; acquise: boolean; faits: number; requis: number;
} {
  const d = deblocageDe(id);
  if (d.par === 'jeu') return { parJeu: true, acquise: true, faits: 0, requis: 0 };
  if (d.par === 'collection') {
    const faits = autresCartesPossedees(id, possedees);
    return { parJeu: false, acquise: faits >= d.nb, faits, requis: d.nb };
  }
  const faits = achatsPourCarte(id, lignes);
  return { parJeu: false, acquise: faits >= d.nb, faits, requis: d.nb };
}

/** Les cartes que le Passeport considère comme DÉBLOQUÉES : celles que l'historique
 *  d'achats paie, plus celles dont la condition de collection est remplie. PUR.
 *  @param possedees ids déjà en collection (optionnel — seules les cartes
 *  `{ par: 'collection' }` en dépendent ; absentes, elles ne sont jamais débloquées). */
export function cartesDebloqueesParAchats(
  lignes: LigneAchat[], possedees: readonly string[] = [],
): string[] {
  const acquises = new Set(possedees);
  return COLLECTIBLES.filter((c) => {
    const d = deblocageDe(c.id);
    if (d.par === 'achat') return achatsPourCarte(c.id, lignes) >= d.nb;
    if (d.par === 'collection') return compterAutresCartes(c.id, acquises) >= d.nb;
    return false;
  }).map((c) => c.id);
}

/** Combien d'exemplaires d'une carte l'historique d'achats justifie. PUR.
 *  Racheter sa boisson préférée fait MONTER sa carte préférée : au-delà du premier
 *  exemplaire, chaque nouvelle série d'achats donne un doublon — la matière que
 *  l'entraînement consomme aux paliers 4/7/10. La fidélité de goût devient la
 *  progression de jeu, ce qui est exactement le comportement qu'on veut récompenser.
 *
 *  Une carte `collection` renvoie 0, volontairement : aucun achat ne la justifie, donc
 *  le Passeport ne l'OCTROIE jamais d'office (`appliquerPasseport` la laisse tranquille).
 *  Elle s'obtient là où elle a du sens — dans une capsule, une fois les 23 autres
 *  réunies, ce qu'autorise `poolCapsuleAvecPasseport`. La donner automatiquement
 *  supprimerait le seul moment de fête que cette carte doit produire. */
export function exemplairesParAchats(id: string, lignes: LigneAchat[]): number {
  const d = deblocageDe(id);
  if (d.par !== 'achat') return 0;
  return Math.floor(achatsPourCarte(id, lignes) / d.nb);
}

/** Cartes qu'une capsule peut rendre quand le Passeport est ACTIF : uniquement celles
 *  que le joueur a déjà débloquées, plus le set commun (toujours gratuit). La capsule
 *  cesse d'être la voie de DÉCOUVERTE (c'est le comptoir) et devient la voie
 *  d'ENTRAÎNEMENT — la jauge de pity et le frisson du tirage restent intacts. PUR.
 *
 *  Trois façons d'entrer dans le vivier, et trois seulement :
 *   • la carte est DÉJÀ possédée → doublon d'entraînement, toujours autorisé ;
 *   • `{ par: 'jeu' }` → le set commun, gratuit par décision produit ;
 *   • `{ par: 'collection' }` → seulement une fois les `nb` autres cartes réunies.
 *  Une carte `{ par: 'achat' }` pas encore payée n'entre JAMAIS : c'est toute la règle. */
export function poolCapsuleAvecPasseport(possedees: string[]): Collectible[] {
  const acquises = new Set(possedees);
  return COLLECTIBLES.filter((c) => {
    if (acquises.has(c.id)) return true;
    const d = deblocageDe(c.id);
    if (d.par === 'jeu') return true;
    if (d.par === 'collection') return compterAutresCartes(c.id, acquises) >= d.nb;
    return false;
  });
}

// --- 👅 LOT E · LE RANG DE GOÛT : la carte évolue avec la consommation RÉELLE ---------
// (26/07/2026 — réponse à « faire évoluer les cartes selon ce que consomment les clients »)
//
// POURQUOI CE SYSTÈME PLUTÔT QUE LE PASSEPORT. Le Passeport (ci-dessus) répond à la même
// demande mais en FERMANT la collection : tant que l'interrupteur serveur `passeport_carte`
// est à `false` — et il doit le rester tant que la caisse ne publie pas `achats_lignes` —
// rien ne relie le jeu à la boutique. Le Goût, lui, n'enlève RIEN à personne : il n'est
// qu'un bonus qui monte quand on vient boire. Une carte à Goût 0 est parfaitement jouable,
// et le reste. Les deux cohabitent : le Goût s'applique quel que soit l'interrupteur.
//
// FORMULATION PRODUIT : jamais un cadenas, toujours un menu. « 🧋 Milk tea Taro ·
// Goût 2/5 » invite ; « verrouillé » punit. Toute la différence est là.
//
// ⚖️ POURQUOI +10 % ET PAS PLUS. `multOutsider` accorde déjà +24 % GRATUITEMENT à une
// équipe 100 % commune (3 communes = 3 points sur un budget de 7). Un plafond de Goût à
// +10 % ne peut donc pas rendre non compétitif un joueur qui ne vient jamais : le set
// Milk Tea reste un STYLE DE JEU, pas un lot de consolation. C'est la garantie explicite
// d'AGENTS.md, et elle contraint le barème — pas l'inverse.
//
// 🔁 AUCUN SECOND MAPPING. Le lien produit → carte est `DEBLOCAGE_CARTES` +
// `achatsPourCarte`, déjà écrits, déjà testés (un test verrouille que toutes les cibles
// existent au catalogue de la caisse). Le Goût s'y branche, il ne le redouble pas.
// Conséquence assumée : une carte sans cible produit reste à Goût 0. Depuis le 27/07 il
// n'en reste que 7 — les 6 Milk Tea (`{ par: 'jeu' }`) et Bubble Master
// (`{ par: 'collection' }`). Elles n'ont pas de boisson à racheter : leur en inventer une
// serait exactement le mapping parallèle interdit. L'écran de collection le DIT
// positivement plutôt que d'afficher une jauge « 0/5 » qui ne bougera jamais.
// Flantastique, elle, a désormais la crème brûlée : son Goût monte, en même temps que
// celui de Caramel Chef, puisque c'est la même boisson qu'on aime.

export const GOUT_MAX = 5;
export const GOUT_ACHATS_PAR_RANG = 2;   // 2 achats de la boisson = +1 rang
export const GOUT_BONUS_PCT = 2;         // +2 % PV et ATQ par rang (donc +10 % au maximum)
export const GOUT_RANG_MUNITION = 3;     // rang 3 : +1 munition de Spé
export const GOUT_RANG_MARQUE = 5;       // rang 5 : la marque de famille dure +1 action

/** Rang de Goût 0..GOUT_MAX d'une carte d'après l'historique d'achats RÉELS. PUR.
 *  Réutilise `achatsPourCarte` (donc `DEBLOCAGE_CARTES`) : aucun mapping parallèle.
 *  Une carte obtenable en jouant n'a aucune cible produit → rang 0, et c'est voulu. */
export function rangGout(id: string, lignes: LigneAchat[]): number {
  return Math.min(GOUT_MAX, Math.floor(achatsPourCarte(id, lignes) / GOUT_ACHATS_PAR_RANG));
}

/** Ce que rapporte un rang de Goût, en combat. PUR.
 *  ⚠️ Doit rester STRICTEMENT aligné sur ce que `creerCombattant` (arene.ts) applique :
 *  c'est la même règle, exposée pour l'affichage — surtout pas une seconde formule. */
export function bonusGout(rang: number): {
  pvPct: number; atkPct: number; speBonus: number; marqueBonus: number;
} {
  const r = Math.max(0, Math.min(GOUT_MAX, Math.round(Number(rang) || 0)));
  return {
    pvPct: GOUT_BONUS_PCT * r,
    atkPct: GOUT_BONUS_PCT * r,
    speBonus: r >= GOUT_RANG_MUNITION ? 1 : 0,
    marqueBonus: r >= GOUT_RANG_MARQUE ? 1 : 0,
  };
}

/** Achats RESTANTS avant le rang suivant (0 si déjà au maximum). PUR — sert au « encore
 *  1 gorgée » de la fiche, pour que l'écran ne recalcule jamais le barème lui-même. */
export function achatsAvantRangGout(id: string, lignes: LigneAchat[]): number {
  if (deblocageDe(id).par !== 'achat') return 0;
  const rang = rangGout(id, lignes);
  if (rang >= GOUT_MAX) return 0;
  return (rang + 1) * GOUT_ACHATS_PAR_RANG - achatsPourCarte(id, lignes);
}

/** Normalise le champ persisté `goutCartes` (pattern `migrerExploits` : assainit, ne
 *  purge JAMAIS une donnée LÉGITIME, tolère `undefined`). Champ ADDITIF — absent des
 *  sauvegardes d'avant le LOT E, et `VERSION_SAUVEGARDE` reste donc à 2. Les rangs sont
 *  bornés 0..GOUT_MAX ; une entrée illisible retombe à 0, donc n'est pas conservée
 *  (0 = valeur par défaut, rien n'est perdu).
 *
 *  🩹 27/07 — LES CLÉS QUI NE DÉSIGNENT AUCUNE CARTE SONT ÉCARTÉES, exactement comme le
 *  fait `assainirComptes` (store/jeu.ts) pour `collection` et `niveauxCartes` via ce même
 *  `trouverCollectible`. Ce n'est PAS une purge : « ne jamais purger » protège une donnée
 *  du joueur, or un rang de Goût sur un id inexistant ne se rattache à aucune carte, ne
 *  peut jamais être lu (`rangGout`/`bonusGout` travaillent par id de collectible) et
 *  repartait pourtant dans le push serveur de 85 Ko à CHAQUE sauvegarde, indéfiniment.
 *  Le rang d'une carte RÉELLE, lui, est borné et conservé — les deux propriétés sont
 *  distinctes et testées séparément. */
export function migrerGout(brut: unknown): Record<string, number> {
  const res: Record<string, number> = {};
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return res;
  for (const [cid, val] of Object.entries(brut as Record<string, unknown>)) {
    if (!trouverCollectible(cid)) continue;
    const n = Math.max(0, Math.min(GOUT_MAX, Math.floor(Number(val) || 0)));
    if (n > 0) res[cid] = n;
  }
  return res;
}

/** Normalise le champ persisté `exemplairesPasseport` — ce que le Passeport a DÉJÀ
 *  octroyé, carte par carte (voir la correction de la faille dans `appliquerPasseport`).
 *
 *  🔴 MIGRATION CONSERVATRICE. Une sauvegarde d'avant le champ n'a aucune trace de ce qui
 *  a été octroyé : on repart de la collection VIVANTE. On n'octroie donc rien
 *  rétroactivement (un joueur ne reçoit pas d'un coup les exemplaires que ses achats
 *  passés justifieraient) et on ne retire rien (la collection n'est pas touchée).
 *  Le champ PRÉSENT, même vide, fait foi : il n'est jamais ré-amorcé depuis la
 *  collection, sinon une carte tirée en capsule après coup passerait pour un octroi du
 *  Passeport. PUR. */
export function migrerExemplairesPasseport(
  brut: unknown, collection: Record<string, number> = {},
): Record<string, number> {
  const ent = (x: unknown) => Math.max(0, Math.floor(Number(x) || 0));
  const res: Record<string, number> = {};
  const absent = !brut || typeof brut !== 'object' || Array.isArray(brut);
  const source = absent ? (collection || {}) : (brut as Record<string, unknown>);
  for (const [cid, val] of Object.entries(source)) {
    const n = ent(val);
    if (n > 0) res[cid] = n;
  }
  return res;
}

// --- 💾 SAUVEGARDE SERVEUR : la progression suit le COMPTE, plus le téléphone ---------
// (Phase 3, 26/07/2026)
//
// Toute la progression vivait dans AsyncStorage : une réinstallation effaçait six semaines
// de jeu ET les prix réels gagnés mais pas encore préparés pour la caisse, qui n'existent
// nulle part ailleurs. Avec le Passeport de la Carte, ça devient bloquant : une carte
// représente désormais un achat réel, donc la progression est un ACTIF du client.
//
// LE MODÈLE EST « SAUVEGARDE », PAS « BASE DE DONNÉES DE JEU ». Le téléphone reste la
// source de vérité pendant qu'on joue ; le serveur est la copie qui permet de repartir.
// On ne cherche PAS à fusionner deux parties menées en parallèle sur deux téléphones : ce
// serait un vrai moteur de fusion, hors sujet, et une source de bugs pire que le problème
// résolu. L'arbitrage se fait sur une `revision` monotone, incrémentée à chaque
// modification locale.
//
// ⚠️ LA RÈGLE QUI PROTÈGE TOUT : on ne POUSSE JAMAIS sans avoir LU le serveur avec
// succès. Sinon une installation neuve (révision 0, état vide) écraserait une sauvegarde
// riche dans la première seconde — précisément le scénario qu'on veut éviter. C'est
// pourquoi une lecture échouée renvoie `attendre` et surtout pas `pousser-local`.

export type DecisionSync = 'adopter-serveur' | 'pousser-local' | 'rien' | 'attendre';

/** Décide quoi faire, à partir des seules révisions. PUR (testé).
 *  @param revisionLocale  révision de l'état sur ce téléphone
 *  @param revisionServeur `null` = aucune sauvegarde serveur ; `undefined` = LECTURE
 *                         ÉCHOUÉE (réseau, session expirée) → on ne touche à rien
 *  @param localVide       l'état local est-il encore vierge ? (évite de créer une ligne
 *                         serveur pour un joueur qui n'a jamais rien fait) */
export function decisionSync(
  revisionLocale: number,
  revisionServeur: number | null | undefined,
  localVide: boolean,
): DecisionSync {
  if (revisionServeur === undefined) return 'attendre';   // lecture impossible : on ne risque rien
  if (revisionServeur === null) return localVide ? 'rien' : 'pousser-local';
  if (revisionServeur > revisionLocale) return 'adopter-serveur';
  if (revisionLocale > revisionServeur) return 'pousser-local';
  return 'rien';
}

/** Un état est-il encore vierge ? Sert à ne pas créer de sauvegarde serveur pour un
 *  joueur qui n'a jamais joué, et à repérer un état anormalement vide. PUR. */
export function etatEstVierge(e: {
  perles: number; collection: Record<string, number>; partiesJouees: number;
  capsulesOuvertes: number; gains: unknown[];
  curseurAchatsPasseport?: { creeLe?: string; ids?: unknown[] } | null;
}): boolean {
  return (e.perles || 0) === 0
    && Object.keys(e.collection || {}).length === 0
    && (e.partiesJouees || 0) === 0
    && (e.capsulesOuvertes || 0) === 0
    && (e.gains || []).length === 0
    && !e.curseurAchatsPasseport?.creeLe;
}

// --- 🎯 Quête unique « Mon premier tampon » -----------------------------------------
// Chaîne guidée de 7 étapes (dans l'ordre) qui paie UN tampon réel, une seule
// fois, HORS plafonds mensuels de la boutique. Sert de rampe d'accès à la
// première récompense tangible (sinon ~4-6 semaines de jeu).
export type EtapeQueteId = 'niveaux' | 'capsules' | 'duels' | 'defis' | 'infini' | 'copain' | 'perles';
export const QUETE_TAMPON: { id: EtapeQueteId; label: string; cible: number }[] = [
  { id: 'niveaux', label: "Termine 3 niveaux d'Aventure", cible: 3 },
  { id: 'capsules', label: 'Ouvre 2 capsules', cible: 2 },
  { id: 'duels', label: "Gagne 2 combats (Arène ou tournoi)", cible: 2 },
  { id: 'defis', label: 'Réclame 3 défis du jour', cible: 3 },
  { id: 'infini', label: "Joue 3 parties d'Infini", cible: 3 },
  { id: 'copain', label: 'Équipe un copain de tir', cible: 1 },
  { id: 'perles', label: 'Gagne 1 500 perles', cible: 1500 },
];
export type EtatQuete = { etape: number; progres: number; reclamee: boolean };

// Helper PUR (testable) : crédite `n` sur l'étape courante si elle correspond à `id`.
export function queteApresCredit(q: EtatQuete, id: EtapeQueteId, n: number): EtatQuete {
  if (q.reclamee || q.etape >= QUETE_TAMPON.length) return q;
  const etape = QUETE_TAMPON[q.etape];
  if (etape.id !== id) return q;
  const progres = q.progres + n;
  if (progres >= etape.cible) return { etape: q.etape + 1, progres: 0, reclamee: false };
  return { ...q, progres };
}

export function cleMois(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Semaine ISO ('2026-S28') — pour le Tournoi hebdomadaire
export function cleSemaine(d: Date = new Date()): string {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const jour = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - jour);
  const debutAn = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const semaine = Math.ceil(((dt.getTime() - debutAn.getTime()) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-S${String(semaine).padStart(2, '0')}`;
}

// --- 🎒 Objets à équiper : LE méta de l'Arène (le stuff EST la progression) -----------
// L'équipement est la seconde source de puissance, à côté de l'ENTRAÎNEMENT des cartes
// (niveaux 1→10, voir plus haut) — les deux se cumulent sur l'équipe du joueur.
// Chaque combattant a 3 emplacements. Les effets sont DATA-DRIVEN (lus par le moteur)
// pour créer de vrais builds. Sources : boutique perles (sûr), Capsule Objet (chance),
// forge d'éclats (anti-malchance). Les panoplies récompensent la collection.

export type Emplacement = 'paille' | 'couvercle' | 'breloque';

export const EMPLACEMENTS: Record<Emplacement, { nom: string; emoji: string; role: string }> = {
  paille: { nom: 'Paille', emoji: '🧋', role: 'Offensif' },
  couvercle: { nom: 'Couvercle', emoji: '🛡️', role: 'Défensif' },
  breloque: { nom: 'Breloque', emoji: '🍀', role: 'Utilitaire' },
};

// Effet d'un objet — le moteur agrège ces champs sur les 3 emplacements + panoplies.
export type EffetObjet = {
  atkPct?: number;          // +% ATQ
  pvPct?: number;           // +% PV max
  vit?: number;             // +vitesse (plat)
  critPct?: number;         // +% de coups critiques
  precisionPct?: number;    // +% de précision
  soinTour?: number;        // PV récupérés à chaque tour
  bouclierDepart?: boolean; // démarre le combat bouclier levé
  volDeViePct?: number;     // % des dégâts infligés récupérés en PV
  perceBouclier?: boolean;  // ignore le bouclier adverse
  reducZonePct?: number;    // -% de dégâts de ZONE subis
  immuniteEtourdi?: boolean;// insensible à l'étourdissement
  reviveUneFois?: boolean;  // survit une fois à 1 PV au lieu de tomber KO
  agitPremier?: boolean;    // agit en premier au 1er round
  epinesPct?: number;       // renvoie % des dégâts subis à l'attaquant
};

export type PanoplieId = 'givre' | 'sucre' | 'orage' | 'royal';

export type ObjetDef = {
  nom: string; emoji: string;
  slot: Emplacement;
  rarete: Rarete;
  source: 'perles' | 'capsule' | 'trophee';
  cout?: number;            // si source = perles
  panoplie?: PanoplieId;
  detail: string;
  effet: EffetObjet;
};

// ~18 objets sur 4 raretés × 3 emplacements. Communs/rares en boutique perles,
// épiques/légendaires en Capsule Objet (ou forge d'éclats).
const CATALOGUE = {
  // 🧋 PAILLE — offensif
  paille: { nom: 'Grande Paille', emoji: '🧋', slot: 'paille', rarete: 'commun', source: 'perles', cout: 300, detail: '+10 % d\'attaque', effet: { atkPct: 10 } },
  'paille-aiguisee': { nom: 'Paille Aiguisée', emoji: '📍', slot: 'paille', rarete: 'rare', source: 'perles', cout: 700, detail: '+9 % de coups critiques', effet: { critPct: 9 } },
  'paille-givre': { nom: 'Paille Givrée', emoji: '❄️', slot: 'paille', rarete: 'rare', source: 'perles', cout: 750, panoplie: 'givre', detail: '+8 % ATQ · panoplie Givré', effet: { atkPct: 8 } },
  'paille-caramel': { nom: 'Paille Caramel', emoji: '🍯', slot: 'paille', rarete: 'rare', source: 'perles', cout: 750, panoplie: 'sucre', detail: 'Vol de vie 15 % · panoplie Sucré', effet: { volDeViePct: 15 } },
  'paille-foudre': { nom: 'Paille Foudre', emoji: '⚡', slot: 'paille', rarete: 'epique', source: 'capsule', panoplie: 'orage', detail: 'Ignore le bouclier + 6 % ATQ · panoplie Orage', effet: { perceBouclier: true, atkPct: 6 } },
  'paille-royale': { nom: 'Paille Royale', emoji: '👑', slot: 'paille', rarete: 'legendaire', source: 'capsule', panoplie: 'royal', detail: '+15 % ATQ et +6 % crit · panoplie Royale', effet: { atkPct: 15, critPct: 6 } },
  // 🛡️ COUVERCLE — défensif
  couvercle: { nom: 'Couvercle Renforcé', emoji: '🛡️', slot: 'couvercle', rarete: 'commun', source: 'perles', cout: 300, detail: 'Démarre avec un bouclier', effet: { bouclierDepart: true } },
  'couvercle-blinde': { nom: 'Couvercle Blindé', emoji: '🧱', slot: 'couvercle', rarete: 'rare', source: 'perles', cout: 700, detail: '+14 % de PV max', effet: { pvPct: 14 } },
  'couvercle-nappe': { nom: 'Couvercle Nappé', emoji: '🍮', slot: 'couvercle', rarete: 'rare', source: 'perles', cout: 750, panoplie: 'sucre', detail: 'Régénère 6 PV/tour · panoplie Sucré', effet: { soinTour: 6 } },
  'couvercle-iso': { nom: 'Couvercle Isotherme', emoji: '🧊', slot: 'couvercle', rarete: 'epique', source: 'capsule', panoplie: 'givre', detail: '−50 % dégâts de zone · panoplie Givré', effet: { reducZonePct: 50 } },
  'couvercle-epines': { nom: 'Couvercle à Épines', emoji: '🌵', slot: 'couvercle', rarete: 'epique', source: 'capsule', panoplie: 'orage', detail: 'Renvoie 20 % des dégâts · panoplie Orage', effet: { epinesPct: 20 } },
  'couvercle-royal': { nom: 'Couvercle Royal', emoji: '👑', slot: 'couvercle', rarete: 'legendaire', source: 'capsule', panoplie: 'royal', detail: '+14 % PV et bouclier de départ · panoplie Royale', effet: { pvPct: 14, bouclierDepart: true } },
  // 🍀 BRELOQUE — utilitaire
  baskets: { nom: 'Baskets Kawaii', emoji: '👟', slot: 'breloque', rarete: 'commun', source: 'perles', cout: 300, detail: '+5 de vitesse', effet: { vit: 5 } },
  lunettes: { nom: 'Lunettes de Visée', emoji: '🎯', slot: 'breloque', rarete: 'rare', source: 'perles', cout: 600, detail: '+6 % de précision', effet: { precisionPct: 6 } },
  chance: { nom: 'Perle Porte-bonheur', emoji: '🍀', slot: 'breloque', rarete: 'rare', source: 'perles', cout: 650, panoplie: 'orage', detail: '+8 % de crit · panoplie Orage', effet: { critPct: 8 } },
  grelot: { nom: 'Grelot Antigel', emoji: '🔔', slot: 'breloque', rarete: 'rare', source: 'perles', cout: 700, panoplie: 'givre', detail: 'Insensible à l\'étourdissement · panoplie Givré', effet: { immuniteEtourdi: true } },
  sablier: { nom: 'Sablier Sucré', emoji: '⏳', slot: 'breloque', rarete: 'epique', source: 'capsule', panoplie: 'sucre', detail: 'Agit en premier au 1er round · panoplie Sucré', effet: { agitPremier: true } },
  grigri: { nom: 'Grigri de la Perle', emoji: '🧿', slot: 'breloque', rarete: 'legendaire', source: 'capsule', panoplie: 'royal', detail: 'Survit une fois à 1 PV · panoplie Royale', effet: { reviveUneFois: true } },
} satisfies Record<string, ObjetDef>;

// ObjetId garde l'union littérale des clés ; OBJETS est typé ObjetDef pour que les
// champs optionnels (panoplie, cout) soient accessibles sur toute la collection.
export type ObjetId = keyof typeof CATALOGUE;
export const OBJETS: Record<ObjetId, ObjetDef> = CATALOGUE;
export const OBJET_IDS = Object.keys(OBJETS) as ObjetId[];

export function objetsDeSlot(slot: Emplacement): ObjetId[] {
  return OBJET_IDS.filter((id) => OBJETS[id].slot === slot);
}
export function objetsDeRarete(r: Rarete): ObjetId[] {
  return OBJET_IDS.filter((id) => OBJETS[id].rarete === r);
}

// --- Panoplies (bonus de set : 2 ou 3 pièces d'un même thème sur UN combattant) -------

export const PANOPLIES: Record<PanoplieId, {
  nom: string; emoji: string; couleur: string;
  paliers: { seuil: number; effet: EffetObjet; detail: string }[];
}> = {
  givre: {
    nom: 'Givré', emoji: '❄️', couleur: '#7EC8E3',
    paliers: [
      { seuil: 2, effet: { pvPct: 8 }, detail: '2 pièces : +8 % PV' },
      { seuil: 3, effet: { immuniteEtourdi: true, reducZonePct: 30 }, detail: '3 pièces : immunité étourdissement + −30 % dégâts de zone' },
    ],
  },
  sucre: {
    nom: 'Sucré', emoji: '🍯', couleur: '#F7A14B',
    paliers: [
      { seuil: 2, effet: { soinTour: 5 }, detail: '2 pièces : +5 PV/tour' },
      { seuil: 3, effet: { volDeViePct: 15 }, detail: '3 pièces : vol de vie +15 %' },
    ],
  },
  orage: {
    nom: 'Orage', emoji: '⚡', couleur: '#8A68B8',
    paliers: [
      { seuil: 2, effet: { critPct: 8 }, detail: '2 pièces : +8 % crit' },
      { seuil: 3, effet: { atkPct: 12 }, detail: '3 pièces : +12 % ATQ' },
    ],
  },
  royal: {
    nom: 'Royale', emoji: '👑', couleur: '#D2588A',
    paliers: [
      { seuil: 2, effet: { atkPct: 8, pvPct: 8 }, detail: '2 pièces : +8 % ATQ et +8 % PV' },
      { seuil: 3, effet: { critPct: 10, soinTour: 6 }, detail: '3 pièces : +10 % crit et +6 PV/tour' },
    ],
  },
};

// Agrège les effets d'une liste d'objets (3 emplacements) + bonus de panoplie,
// + un effet supplémentaire optionnel (le PASSIF de la carte).
// 🛡️ Plafond des réductions cumulées : sans lui, passif + objet + panoplie peuvent
// dépasser 100 % et une attaque de zone SOIGNE la cible (jelly 45 + isotherme 50 +
// panoplie Givré 3 pièces 30 = 125 %). Bug constaté à l'audit du 26/07.
export const REDUC_ZONE_MAX = 80;

export function agregerEffets(ids: ObjetId[], extra?: EffetObjet): EffetObjet {
  const acc: Record<string, number | boolean> = {};
  const ajoute = (e: EffetObjet) => {
    for (const [k, v] of Object.entries(e)) {
      if (typeof v === 'number') acc[k] = ((acc[k] as number) ?? 0) + v;
      else if (v === true) acc[k] = true;
    }
  };
  const compte: Record<string, number> = {};
  for (const id of ids) {
    const def = OBJETS[id];
    if (!def) continue;
    ajoute(def.effet);
    if (def.panoplie) compte[def.panoplie] = (compte[def.panoplie] ?? 0) + 1;
  }
  for (const [pid, n] of Object.entries(compte)) {
    for (const palier of PANOPLIES[pid as PanoplieId].paliers) {
      if (n >= palier.seuil) ajoute(palier.effet);
    }
  }
  if (extra) ajoute(extra);
  // 🛡️ borne la réduction de zone (voir REDUC_ZONE_MAX) — au-delà, les dégâts
  // deviendraient négatifs et se transformeraient en soin.
  if (typeof acc.reducZonePct === 'number') {
    acc.reducZonePct = Math.min(REDUC_ZONE_MAX, acc.reducZonePct as number);
  }
  return acc as EffetObjet;
}

// --- ⭐ Atouts passifs : chaque carte a une identité de combat (façon Pokémon) ------
// Les communes reçoivent des niches SITUATIONNELLES (anti-étourdissement, survie,
// premier sang…) qui créent du contre-jeu ; les légendaires cumulent plus d'effets.

export type Passif = { nom: string; desc: string; eff: EffetObjet };

export const PASSIFS: Record<string, Passif> = {
  // 🧋 Milk Tea (communes) — des niches qui punissent les compos négligentes
  boba: { nom: 'Increvable', desc: 'Survit une fois à 1 PV', eff: { reviveUneFois: true } },
  classico: { nom: 'Recette maison', desc: '+5 PV régénérés par tour', eff: { soinTour: 5 } },
  theo: { nom: 'Infusion zen', desc: 'Insensible à l\'étourdissement', eff: { immuniteEtourdi: true } },
  lacto: { nom: 'Onctueux', desc: '+12 % de PV max', eff: { pvPct: 12 } },
  paillette: { nom: 'Vive', desc: 'Agit en premier au 1er tour', eff: { agitPremier: true } },
  sucrette: { nom: 'Rush de sucre', desc: '+8 % de coups critiques', eff: { critPct: 8 } },
  // 🍓 Fruités (rares)
  fraisy: { nom: 'Pétillante', desc: '+10 % de crit', eff: { critPct: 10 } },
  mango: { nom: 'Tropicale', desc: '+10 % d\'attaque', eff: { atkPct: 10 } },
  litchee: { nom: 'Parfum précis', desc: '+8 % de précision', eff: { precisionPct: 8 } },
  passion: { nom: 'Ardente', desc: 'Vol de vie 15 %', eff: { volDeViePct: 15 } },
  citro: { nom: 'Acide', desc: 'Renvoie 15 % des dégâts subis', eff: { epinesPct: 15 } },
  pasteka: { nom: 'Carapace', desc: 'Démarre avec un bouclier + −40 % dégâts de zone', eff: { bouclierDepart: true, reducZonePct: 40 } },
  // ✨ Toppings (épiques)
  popping: { nom: 'Explosive', desc: '+12 % d\'attaque', eff: { atkPct: 12 } },
  jelly: { nom: 'Élastique', desc: '−45 % de dégâts de zone', eff: { reducZonePct: 45 } },
  mochito: { nom: 'Moelleux', desc: '+8 PV régénérés par tour', eff: { soinTour: 8 } },
  coco: { nom: 'Blindée', desc: '+16 % de PV max', eff: { pvPct: 16 } },
  pudding: { nom: 'Gourmand', desc: 'Vol de vie 18 %', eff: { volDeViePct: 18 } },
  nuage: { nom: 'Cocon', desc: '+8 % PV max et +6 PV/tour', eff: { pvPct: 8, soinTour: 6 } },
  // 👑 Signatures (légendaires) — plusieurs effets cumulés
  'taro-queen': { nom: 'Aura royale', desc: '+12 % ATQ et +6 % crit', eff: { atkPct: 12, critPct: 6 } },
  'matcha-sensei': { nom: 'Maîtrise zen', desc: 'Anti-étourdissement + 8 % crit', eff: { immuniteEtourdi: true, critPct: 8 } },
  'brown-sugar-king': { nom: 'Couronne fondante', desc: '+14 % PV et +6 PV/tour', eff: { pvPct: 14, soinTour: 6 } },
  'oreo-star': { nom: 'Instinct du tigre', desc: '+12 % de crit', eff: { critPct: 12 } },
  'caramel-chef': { nom: 'Nappage vorace', desc: 'Vol de vie 20 %', eff: { volDeViePct: 20 } },
  'bubble-master': { nom: 'Suprématie', desc: '+12 % ATQ, +8 % crit, survit une fois à 1 PV', eff: { atkPct: 12, critPct: 8, reviveUneFois: true } },
};

export function passifDe(id: string): Passif | undefined {
  return PASSIFS[id];
}

// --- ⚖️ Budget d'équipe par rareté + bonus outsider -----------------------------------
// La rareté = plus d'OPTIONS, pas plus de puissance brute : l'équipe doit tenir sous un
// budget (impossible d'aligner 3 légendaires), et chaque point SOUS le budget booste
// l'équipe → une équipe modeste reste compétitive face à des cartes rares.

export const COUT_RARETE: Record<Rarete, number> = { commun: 1, rare: 2, epique: 3, legendaire: 4 };
export const BUDGET_EQUIPE = 7;
export const OUTSIDER_PAR_POINT = 0.06; // +6 % PV et ATQ par point sous le budget

export function coutCarte(id: string): number {
  const c = trouverCollectible(id);
  return c ? COUT_RARETE[c.rarete] : 1;
}
export function coutEquipe(ids: string[]): number {
  return ids.reduce((s, id) => s + coutCarte(id), 0);
}
// Multiplicateur de stats « outsider » selon le coût total de l'équipe (1 = pas de bonus)
export function multOutsider(coutTotal: number): number {
  return 1 + Math.max(0, BUDGET_EQUIPE - coutTotal) * OUTSIDER_PAR_POINT;
}
// Meilleure équipe de 3 sous le budget parmi les cartes possédées (auto-réparation)
export function equipeAutoSousBudget(possedes: string[]): string[] {
  const parRarete = [...possedes].sort((a, b) => RARETES[trouverCollectible(b)!.rarete].ordre - RARETES[trouverCollectible(a)!.rarete].ordre);
  const eq: string[] = [];
  let cout = 0;
  for (const id of parRarete) { // les plus rares qui rentrent d'abord
    if (eq.length >= 3) break;
    if (cout + coutCarte(id) <= BUDGET_EQUIPE) { eq.push(id); cout += coutCarte(id); }
  }
  if (eq.length < 3) { // compléter avec les moins chères
    for (const id of [...possedes].sort((a, b) => coutCarte(a) - coutCarte(b))) {
      if (eq.length >= 3) break;
      if (!eq.includes(id) && cout + coutCarte(id) <= BUDGET_EQUIPE) { eq.push(id); cout += coutCarte(id); }
    }
  }
  return eq.slice(0, 3);
}

// Panoplies présentes dans une liste d'objets (pour l'affichage), id → nb de pièces.
export function panopliesActives(ids: ObjetId[]): { id: PanoplieId; pieces: number }[] {
  const c: Record<string, number> = {};
  for (const id of ids) { const p = OBJETS[id]?.panoplie; if (p) c[p] = (c[p] ?? 0) + 1; }
  return (Object.entries(c) as [PanoplieId, number][]).map(([id, pieces]) => ({ id, pieces }));
}

// --- 🎒 Consommables : objets à usage unique joués EN COMBAT (remontées tactiques) ----
// Achetés avec des perles, gardés en sac, dépensés pendant un duel. Utiliser un
// consommable COÛTE le tour (l'adversaire frappe) — c'est un pari, pas un cheat.

export type ConsoEffet = {
  soinPct?: number;       // soigne % des PV max de l'actif
  retireEtourdi?: boolean;// retire l'étourdissement
  boost?: boolean;        // +40 % ATQ pendant 2 tours
  bouclier?: boolean;     // lève un bouclier
  degatsEnnemi?: number;  // inflige des dégâts fixes à l'actif adverse
};
export type ConsommableDef = { nom: string; emoji: string; desc: string; cout: number; effet: ConsoEffet };

const CONSO_CATALOGUE = {
  potion: { nom: 'Potion Boba', emoji: '🧪', desc: 'Rend 45 % des PV', cout: 240, effet: { soinPct: 45 } },
  reveil: { nom: 'Réveil Menthe', emoji: '🌿', desc: 'Retire l\'étourdissement', cout: 160, effet: { retireEtourdi: true } },
  energie: { nom: 'Boost Énergie', emoji: '⚡', desc: '+40 % ATQ pendant 2 tours', cout: 220, effet: { boost: true } },
  glacon: { nom: 'Glaçon Bouclier', emoji: '🧊', desc: 'Lève un bouclier protecteur', cout: 200, effet: { bouclier: true } },
  piment: { nom: 'Bonbon Piquant', emoji: '🌶️', desc: '30 dégâts directs à l\'adversaire', cout: 260, effet: { degatsEnnemi: 30 } },
} satisfies Record<string, ConsommableDef>;
export type ConsommableId = keyof typeof CONSO_CATALOGUE;
export const CONSOMMABLES: Record<ConsommableId, ConsommableDef> = CONSO_CATALOGUE;
export const CONSOMMABLE_IDS = Object.keys(CONSOMMABLES) as ConsommableId[];

// --- 🎁 Butin de consommables dans le shooter (Pack 5a, 24/07/2026) -------------------
// Les niveaux d'Aventure et le mode Infini peuvent rapporter un consommable : les
// objets deviennent GAGNABLES sans être achetés, mais le sac est plafonné
// (SAC_MAX_CONSO par objet) et tout excédent est remboursé en perles — jamais de
// stock infini qui rendrait la boutique inutile ni de butin « cheaté ».

export const SAC_MAX_CONSO = 5; // plafond de possession PAR consommable

export const BUTIN_CONSO_PODS: { id: ConsommableId; poids: number }[] = [
  { id: 'potion', poids: 18 },
  { id: 'reveil', poids: 22 },
  { id: 'energie', poids: 22 },
  { id: 'glacon', poids: 20 },
  { id: 'piment', poids: 18 },
];

// Tirage pondéré du consommable gagné (PUR, testé — reste dans CONSOMMABLE_IDS).
export function tirerButinConso(rng: () => number = Math.random): ConsommableId {
  const total = BUTIN_CONSO_PODS.reduce((s, p) => s + p.poids, 0);
  let t = rng() * total;
  for (const p of BUTIN_CONSO_PODS) {
    t -= p.poids;
    if (t < 0) return p.id;
  }
  return BUTIN_CONSO_PODS[BUTIN_CONSO_PODS.length - 1].id;
}

// Probabilité de butin à la fin d'un niveau (PUR, testé) : étoiles × 20 %, boss ×1,5,
// plafonné à 90 % ; MOITIÉ quand le niveau était déjà réussi (anti-farm du rejeu).
// 1★ 20 % · 3★ 60 % · 3★ boss première 90 % · rejeu 1★ 10 %.
export function probaButinNiveau(etoiles: number, boss: boolean, premiere: boolean): number {
  const p = Math.min(0.9, etoiles * 0.2 * (boss ? 1.5 : 1));
  return premiere ? p : p / 2;
}

// Mode infini (PUR, testé) : le butin n'arrive qu'à partir d'un vrai score.
export function probaButinInfini(score: number): number {
  if (score >= 1000) return 0.5;
  if (score >= 500) return 0.25;
  return 0;
}

// --- Capsule Objet (gacha d'équipement) + éclats (forge anti-malchance) --------------

export const CAPSULE_OBJET = {
  nom: 'Capsule Objet', cout: 450, couleur: '#4E9DC4',
  poids: { commun: 0, rare: 58, epique: 32, legendaire: 10 } as Record<Rarete, number>,
};

// Éclats rendus pour un doublon d'objet, et coût de forge d'un objet précis
export const ECLATS_DOUBLON: Record<Rarete, number> = { commun: 5, rare: 12, epique: 30, legendaire: 70 };
export const ECLATS_FORGE: Record<Rarete, number> = { commun: 20, rare: 45, epique: 110, legendaire: 260 };
export const PITY_OBJET_EPIQUE = 8; // Capsules Objet maxi sans épique-ou-mieux

// Tire un objet de la Capsule Objet ; `min` = plancher de rareté garanti (pity).
export function tirerObjet(min: Rarete | null = null, rng: () => number = Math.random): ObjetId {
  const poids = CAPSULE_OBJET.poids;
  const total = poids.commun + poids.rare + poids.epique + poids.legendaire;
  let t = rng() * total;
  let rarete: Rarete = 'rare';
  for (const r of ['commun', 'rare', 'epique', 'legendaire'] as Rarete[]) {
    t -= poids[r];
    if (t < 0) { rarete = r; break; }
  }
  if (min && RARETES[rarete].ordre < RARETES[min].ordre) rarete = min;
  const pool = objetsDeRarete(rarete);
  return pool[Math.floor(rng() * pool.length)];
}

// --- 🏆 Classement classé (ligue) + saisons -----------------------------------------
// Le vrai moteur « je rejoue tous les jours » sans prix réel : on grimpe une échelle
// de tiers en gagnant des Points de Classement (PC), la saison se remet à zéro chaque
// mois (reset DOUX), et le meilleur tier atteint donne une récompense + un titre.

export type Tier = { id: number; nom: string; emoji: string; couleur: string; seuil: number };

export const TIERS: Tier[] = [
  { id: 0, nom: 'Bronze', emoji: '🥉', couleur: '#B08D57', seuil: 0 },
  { id: 1, nom: 'Argent', emoji: '🥈', couleur: '#9AA7B0', seuil: 120 },
  { id: 2, nom: 'Or', emoji: '🥇', couleur: '#E0A81E', seuil: 300 },
  { id: 3, nom: 'Platine', emoji: '💠', couleur: '#3FA9C4', seuil: 540 },
  { id: 4, nom: 'Diamant', emoji: '💎', couleur: '#5C8DF2', seuil: 840 },
  { id: 5, nom: 'Maître du Boba', emoji: '👑', couleur: '#B57BE0', seuil: 1200 },
  { id: 6, nom: 'Boba Légende', emoji: '🧋', couleur: '#D2588A', seuil: 1650 },
];

export const PC_VICTOIRE = 26;   // victoire d'Arène (Maître)
export const PC_DEFAITE = -14;   // défaite (PC planché à 0)

export function tierPourPc(pc: number): Tier {
  let t = TIERS[0];
  for (const x of TIERS) if (pc >= x.seuil) t = x;
  return t;
}
export function tierSuivant(pc: number): Tier | null {
  return TIERS[tierPourPc(pc).id + 1] ?? null;
}
// Progression 0..1 dans le tier courant (1 si apex)
export function progressionTier(pc: number): number {
  const cur = tierPourPc(pc);
  const suiv = TIERS[cur.id + 1];
  if (!suiv) return 1;
  return Math.max(0, Math.min(1, (pc - cur.seuil) / (suiv.seuil - cur.seuil)));
}
// Reset DOUX de fin de saison : on retombe ~2 tiers plus bas (jamais à zéro brutal)
export function resetSaison(pc: number): number {
  return Math.floor(pc * 0.4);
}
// Récompense de fin de saison selon le MEILLEUR tier atteint (titre cosmétique dès Diamant)
export function recompenseSaison(tierId: number): { perles: number; capsules: number; eclats: number; titre: string | null } {
  return {
    perles: 100 + tierId * 120,
    capsules: tierId >= 5 ? 2 : tierId >= 3 ? 1 : 0,
    eclats: tierId * 20,
    titre: tierId >= 4 ? TIERS[tierId].nom : null,
  };
}
// Jours restants dans la saison (le mois en cours, borne incluse)
export function joursRestantsSaison(d: Date = new Date()): number {
  const dernier = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return dernier - d.getDate() + 1;
}

// --- ⚡ Mutateurs quotidiens : une règle spéciale par jour (le même combat paraît neuf) ---
// Déterministe par date, appliqué à TOUS les combats du jour. Récompense une armoire large.

export type Mutateur = {
  id: string; nom: string; emoji: string; desc: string;
  critChanceX2?: boolean;    // crits deux fois plus fréquents
  sansBouclier?: boolean;    // boucliers désactivés
  precisionParfaite?: boolean;// aucune esquive
  zoneMult?: number;         // multiplie les dégâts de ZONE
  soinMult?: number;         // multiplie tous les soins
  degatsMult?: number;       // multiplie tous les dégâts
};

export const MUTATEURS: Mutateur[] = [
  { id: 'crit', nom: 'Coups du sort', emoji: '💥', desc: 'Coups critiques deux fois plus fréquents', critChanceX2: true },
  { id: 'bouclier', nom: 'Boucliers brisés', emoji: '🛡️', desc: 'Les boucliers sont désactivés', sansBouclier: true },
  { id: 'lynx', nom: 'Œil de lynx', emoji: '🎯', desc: 'Personne n\'esquive : tous les coups portent', precisionParfaite: true },
  { id: 'tempete', nom: 'Tempête de perles', emoji: '🌊', desc: 'Les attaques de zone infligent +50 %', zoneMult: 1.5 },
  { id: 'sucre-amer', nom: 'Sucre amer', emoji: '🍬', desc: 'Les soins sont réduits de moitié', soinMult: 0.5 },
  { id: 'verre-fin', nom: 'Verre fin', emoji: '💢', desc: 'Tous les dégâts sont augmentés de 15 %', degatsMult: 1.15 },
];

// Mutateur déterministe d'une journée ('YYYY-MM-DD')
export function mutateurDuJour(jour: string): Mutateur {
  let g = 0;
  for (let i = 0; i < jour.length; i++) g = (g * 31 + jour.charCodeAt(i)) >>> 0;
  return MUTATEURS[g % MUTATEURS.length];
}

// 🤝 Troc du jour (preview) : proposition déterministe d'un « ami » (Sam) — il VEUT un
// de tes doublons et t'OFFRE une carte qui te manque. null si tu n'as pas de doublon OU
// plus aucune carte manquante. Inputs triés → indépendant de l'ordre d'entrée.
export function trocDuJour(jour: string, doublons: string[], manquants: string[]): { veut: string; offre: string } | null {
  if (!doublons.length || !manquants.length) return null;
  let g = 0;
  for (let i = 0; i < jour.length; i++) g = (g * 31 + jour.charCodeAt(i)) >>> 0;
  let a = g >>> 0;
  const rng = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const d = [...doublons].sort();
  const m = [...manquants].sort();
  const veut = d[Math.floor(rng() * d.length)];
  const offre = m[Math.floor(rng() * m.length)];
  return { veut, offre };
}

// --- 🤝 Comptoir de Troc v2 : 3 offres par jour (Pack 5b, 24/07/2026) -----------------
// ANTI-SPAM : 3 offres FIXES seedées par la date (même PRNG mulberry que trocDuJour,
// une graine dérivée `jour|index` par offre pour des tirages indépendants), chacune
// utilisable UNE fois par jour — impossible de « re-roller » en fermant l'écran.
// ÉQUILIBRE : les trocs consomment les compteurs ×n (la monnaie d'entraînement),
// JAMAIS le dernier exemplaire (la vitrine est protégée côté store), et aucune
// ressource n'est créée gratuitement — tout s'échange contre quelque chose.
// ADDICTIF : on revient chaque jour voir les 3 nouvelles offres.

export type OffreTrocSam =
  | { kind: 'sam-carte'; veut: string; offre: string }                 // doublon → carte manquante
  | { kind: 'sam-ressource'; veut: string; capsule: TypeCapsule | null; perles: number; eclats: number }; // collection complète : doublon → ressources

export type OffreTroc =
  | { id: string; type: 'sam'; sam: OffreTrocSam }
  | { id: string; type: 'fonte'; rareteMin: Rarete; nb: number; capsule: TypeCapsule; eclatsBonus: number }
  | { id: string; type: 'ressource'; donne: { type: 'eclats' | 'consos'; n: number }; recoit: { type: 'capsule' | 'eclats'; capsule?: TypeCapsule; eclats?: number } };

export const TROC_OFFRE_IDS = ['sam', 'fonte', 'ressource'] as const;
export type OffreTrocId = (typeof TROC_OFFRE_IDS)[number];

// État persisté du comptoir (v2) : les offres déjà réalisées aujourd'hui.
export type TrocJour = { jour: string; faits: string[] };

// PRNG mulberry32 locale (identique à trocDuJour / tirageDefisDuJour), seedée par
// une chaîne quelconque — utilisée ici avec `jour|index` pour des tirages indépendants.
function rngDepuisChaine(graine: string): () => number {
  let g = 0;
  for (let i = 0; i < graine.length; i++) g = (g * 31 + graine.charCodeAt(i)) >>> 0;
  let a = g >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 🩹 26/07 — STABILITÉ DE L'OFFRE DE SAM. La graine ne dépendait que de la date, mais
// les POOLS indexés dépendaient du contexte : `veut` était tiré dans tes doublons et
// `offre` dans tes cartes manquantes. Le même tirage r ∈ [0,1) indexait donc un tableau
// dont la longueur ET le contenu changeaient à chaque mutation de la collection —
// ouvrir une capsule, réaliser la fonte ou gagner une carte en duel re-roulait l'offre
// le jour même, et elle pouvait muter SOUS LES YEUX du joueur. Le commentaire
// « impossible de re-roller en fermant l'écran » était vrai ; il suffisait d'ouvrir
// une capsule. On tire désormais un index sur un ordre CANONIQUE des 24 cartes, puis
// on projette sur le premier candidat éligible à partir de cet index.
const ORDRE_CANONIQUE: string[] = COLLECTIBLES.map((c) => c.id).sort();

function choisirStable<T extends { id: string }>(candidats: T[], r: number): T {
  const depart = Math.floor(r * ORDRE_CANONIQUE.length);
  for (let i = 0; i < ORDRE_CANONIQUE.length; i++) {
    const id = ORDRE_CANONIQUE[(depart + i) % ORDRE_CANONIQUE.length];
    const trouve = candidats.find((c) => c.id === id);
    if (trouve) return trouve;
  }
  return candidats[0];
}

// Ce que Sam donne pour un doublon quand la collection est COMPLÈTE (plus aucune
// carte manquante) — sinon il offre toujours une carte manquante.
const SAM_RESSOURCES: Record<Rarete, { capsule: TypeCapsule | null; perles: number; eclats: number }> = {
  commun: { capsule: null, perles: 120, eclats: 0 },
  rare: { capsule: 'classique', perles: 0, eclats: 0 },
  epique: { capsule: 'classique', perles: 0, eclats: 20 },
  legendaire: { capsule: 'doree', perles: 0, eclats: 0 },
};

// Les 3 offres du jour (PUR, testé) : TOUJOURS 3 offres aux ids stables
// 'sam' / 'fonte' / 'ressource', déterministes pour une date et un contexte donnés.
export function offresTrocDuJour(
  jour: string,
  ctx: { doublons: { id: string; rarete: Rarete }[]; manquants: { id: string; rarete: Rarete }[] },
): OffreTroc[] {
  // — 1. Le troc de Sam : il VEUT un de tes doublons —
  const rngSam = rngDepuisChaine(`${jour}|0`);
  const doublons = [...ctx.doublons].sort((a, b) => (a.id < b.id ? -1 : 1));
  const manquants = [...ctx.manquants].sort((a, b) => (a.id < b.id ? -1 : 1));
  // Sans aucun doublon, Sam montre quand même son offre (le store la marquera non
  // faisable) : il « voudrait » une carte possédée, n'importe laquelle à défaut.
  const veutPool = doublons.length
    ? doublons
    : COLLECTIBLES.filter((c) => !manquants.some((m) => m.id === c.id))
        .map((c) => ({ id: c.id, rarete: c.rarete }));
  const veut = choisirStable(veutPool.length ? veutPool : COLLECTIBLES, rngSam());
  const ordreR = RARETES[veut.rarete].ordre;
  let sam: OffreTrocSam;
  if (manquants.length) {
    // Rareté ÉGALE si possible, sinon la plus proche STRICTEMENT inférieure,
    // sinon n'importe laquelle en dernier recours (jamais supérieure à R tant
    // qu'il existe une candidate ≤ R).
    const egales = manquants.filter((m) => RARETES[m.rarete].ordre === ordreR);
    const inferieures = manquants.filter((m) => RARETES[m.rarete].ordre < ordreR);
    let pool = egales;
    if (!pool.length && inferieures.length) {
      const meilleur = Math.max(...inferieures.map((m) => RARETES[m.rarete].ordre));
      pool = inferieures.filter((m) => RARETES[m.rarete].ordre === meilleur);
    }
    if (!pool.length) pool = manquants;
    sam = { kind: 'sam-carte', veut: veut.id, offre: choisirStable(pool, rngSam()).id };
  } else {
    // Collection complète : Sam paie le doublon en ressources, selon sa rareté.
    sam = { kind: 'sam-ressource', veut: veut.id, ...SAM_RESSOURCES[veut.rarete] };
  }

  // — 2. La fonte de doublons : plusieurs doublons d'un certain standing → capsule —
  const rngFonte = rngDepuisChaine(`${jour}|1`);
  const fonte: OffreTroc = rngFonte() < 0.65
    ? { id: 'fonte', type: 'fonte', rareteMin: 'rare', nb: 3, capsule: 'classique', eclatsBonus: 0 }
    : { id: 'fonte', type: 'fonte', rareteMin: 'epique', nb: 2, capsule: 'doree', eclatsBonus: 0 };

  // — 3. Le troc du comptoir : ressources du quotidien contre une capsule (ou l'inverse) —
  const rngRessource = rngDepuisChaine(`${jour}|2`);
  const t = rngRessource();
  const ressource: OffreTroc = t < 0.4
    ? { id: 'ressource', type: 'ressource', donne: { type: 'eclats', n: 60 }, recoit: { type: 'capsule', capsule: 'classique' } }
    : t < 0.75
      ? { id: 'ressource', type: 'ressource', donne: { type: 'consos', n: 6 }, recoit: { type: 'capsule', capsule: 'classique' } }
      : { id: 'ressource', type: 'ressource', donne: { type: 'consos', n: 4 }, recoit: { type: 'eclats', eclats: 20 } };

  return [
    { id: 'sam', type: 'sam', sam },
    fonte,
    ressource,
  ];
}

// Normalise le champ persisté `trocJour` (PUR, testé — pattern migrerExploits :
// assainit, ne purge jamais). v2 = { jour, faits[] }. Migration tolérante de la v1
// { jour, fait } : un troc FAIT aujourd'hui devient l'offre 'sam' déjà réalisée
// (l'échange quotidien v1 ÉTAIT l'offre de Sam) ; tout le reste repart à zéro.
export function migrerTrocJour(brut: unknown): TrocJour {
  const aujourdhui = cleJour();
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return { jour: '', faits: [] };
  const b = brut as { jour?: unknown; faits?: unknown; fait?: unknown };
  const jour = typeof b.jour === 'string' ? b.jour : '';
  if (Array.isArray(b.faits)) {
    const faits = [...new Set(b.faits.filter((f): f is string => typeof f === 'string' && (TROC_OFFRE_IDS as readonly string[]).includes(f)))];
    return { jour, faits };
  }
  if (jour === aujourdhui) return { jour, faits: b.fait === true ? ['sam'] : [] };
  return { jour: '', faits: [] };
}

// --- 👹 Boss hebdomadaire à gimmick : un défi PvE qui FORCE certaines compos --------
// Une éponge à PV avec une règle qui tourne chaque semaine (immunisé à la zone / se
// soigne sauf étourdi / bouclier périodique). Battable une fois par semaine → prestige.

export type BossGimmick = 'zone-immune' | 'regen' | 'bouclier';

export type Boss = {
  nom: string; emoji: string;
  combattantId: string;   // collectible légendaire servant de base
  echelle: number;        // multiplicateur de stats
  pvBonus: number;        // PV × pvBonus (éponge)
  gimmick: BossGimmick;
  gimmickDesc: string;
  indice: string;         // conseil pour le battre
};

const BOSS_BASES = ['bubble-master', 'taro-queen', 'brown-sugar-king', 'oreo-star', 'caramel-chef', 'matcha-sensei'];
const BOSS_NOMS = ['Méga Boba', 'Taro Colossal', 'Roi Caramel Géant', 'Tigre Titan', 'Chef Suprême', 'Grand Sensei'];
const BOSS_GIMMICKS: { g: BossGimmick; desc: string; indice: string }[] = [
  { g: 'zone-immune', desc: 'Insensible aux attaques de ZONE', indice: 'Frappe en simple cible — la zone ne lui fait rien.' },
  { g: 'regen', desc: 'Se soigne à chaque tour… sauf s\'il est étourdi', indice: 'Étourdis-le (💫) pour bloquer sa régénération.' },
  { g: 'bouclier', desc: 'Lève un bouclier tous les 2 tours', indice: 'Un perce-bouclier (⚡ Paille Foudre) ignore sa garde.' },
];

export const BOSS_RECOMPENSE = { perles: 700, capsules: 1, eclats: 60 };

// Boss déterministe d'une semaine ('YYYY-Sxx')
export function bossDeLaSemaine(semaine: string): Boss {
  let g = 0;
  for (let i = 0; i < semaine.length; i++) g = (g * 31 + semaine.charCodeAt(i)) >>> 0;
  const i = g % BOSS_BASES.length;
  // ⚠️ Correctif 26/07 : l'ancien `(g >>> 3) % 3` jetait les bits de poids faible —
  // les seuls qui changent d'une semaine à l'autre — et produisait des séries de 7 à
  // 11 semaines avec le MÊME gimmick (mesuré sur 2026 : ZZZZZZZ RR Z RRRRRRRR B…).
  // Un hash séparé sur la semaine garantit une vraie rotation.
  let g2 = 0;
  for (let i2 = semaine.length - 1; i2 >= 0; i2--) g2 = (g2 * 131 + semaine.charCodeAt(i2)) >>> 0;
  const gim = BOSS_GIMMICKS[g2 % BOSS_GIMMICKS.length];
  return {
    nom: BOSS_NOMS[i], emoji: '👹',
    combattantId: BOSS_BASES[i],
    // ⚖️ Calibré par simulation (12/07, 200 combats IA par palier d'équipement) :
    // équipes NUES ~0 % (le boss force l'équipement — c'est son rôle), kit BOUTIQUE
    // perles ~50-75 %, bon loot CAPSULE ~75 %, légendaires ~100 %. Les consommables
    // et la signature ajoutent la marge du vrai joueur. Avant (1.35/3.2) : même un
    // bon kit capsule plafonnait à 1 % — mur de gacha, pas mur d'équipement.
    echelle: 1.18,
    pvBonus: 2.2,
    gimmick: gim.g,
    gimmickDesc: gim.desc,
    indice: gim.indice,
  };
}

// --- Tournoi hebdomadaire (3 étapes, 1 tentative par semaine) ------------------------

export const TOURNOI_ETAPES = ['Quart de finale', 'Demi-finale', 'GRANDE FINALE'] as const;
export const TOURNOI_RECOMPENSES: { perles: number; capsule: 'classique' | 'doree' | null }[] = [
  { perles: 350, capsule: null },
  { perles: 500, capsule: 'classique' },
  { perles: 800, capsule: 'doree' },
];
export const TOURNOI_CONSOLATION = 90; // perles si éliminé

// Libellé d'un prix pour l'écran « Mes prix »
export function labelPrix(type: TypePrix, qte: number): string {
  switch (type) {
    case 'tampon': return `+${qte} tampon${qte > 1 ? 's' : ''} de fidélité`;
    case 'reduction': return `−${qte} % sur ta prochaine commande`;
    case 'boisson': return 'Grande boisson offerte (L, M pour Signature)';
    case 'perles': return `+${qte} perles`;
    case 'capsule_doree': return 'Capsule dorée offerte';
  }
}

// --- 🏅 PALMARÈS PAR CARTE (« Exploits », attachement cosmétique) ----------------
// Chaque carte accumule ses faits d'armes en duel : K.O. infligés, victoires,
// timings PARFAITS réussis et plus gros coup porté. AUCUNE récompense, AUCUN
// bonus de puissance — c'est de l'attachement, affiché dans la fiche de l'album.
// Champ persisté ADDITIF du store (`exploits`), fusionné sans perte au chargement.

export type ExploitsCarte = { ko: number; victoires: number; parfaits: number; plusGrosCoup: number };
export type Exploits = Record<string, ExploitsCarte>;

export const EXPLOITS_VIERGES: ExploitsCarte = { ko: 0, victoires: 0, parfaits: 0, plusGrosCoup: 0 };

// Patch PUR (testé) : incrémente les compteurs et garde le MAX pour le plus gros
// coup. Ne mute jamais l'objet reçu — renvoie une nouvelle map.
export function exploitsApresEvenement(exploits: Exploits, carteId: string, patch: Partial<ExploitsCarte>): Exploits {
  const avant = exploits[carteId] ?? EXPLOITS_VIERGES;
  return {
    ...exploits,
    [carteId]: {
      ko: avant.ko + (patch.ko ?? 0),
      victoires: avant.victoires + (patch.victoires ?? 0),
      parfaits: avant.parfaits + (patch.parfaits ?? 0),
      plusGrosCoup: Math.max(avant.plusGrosCoup, patch.plusGrosCoup ?? 0),
    },
  };
}

// Titres cosmétiques automatiques, par paliers EXACTS (aucune puissance).
export const TITRES_EXPLOITS: { titre: string; mesure: 'ko' | 'victoires' | 'parfaits'; seuil: number }[] = [
  { titre: 'Finisseur', mesure: 'ko', seuil: 10 },
  { titre: 'Briseur', mesure: 'ko', seuil: 50 },
  { titre: 'Fléau', mesure: 'ko', seuil: 150 },
  { titre: 'Combattante', mesure: 'victoires', seuil: 5 },
  { titre: 'Vétéran', mesure: 'victoires', seuil: 25 },
  { titre: 'Légende du Shaker', mesure: 'victoires', seuil: 100 },
  { titre: 'Adroite', mesure: 'parfaits', seuil: 10 },
  { titre: 'Chirurgicale', mesure: 'parfaits', seuil: 50 },
  { titre: 'Métronome', mesure: 'parfaits', seuil: 200 },
];

// Titres atteints par une carte (PUR, testé), dans l'ordre de TITRES_EXPLOITS.
export function titresExploits(ex: ExploitsCarte): string[] {
  return TITRES_EXPLOITS.filter((t) => ex[t.mesure] >= t.seuil).map((t) => t.titre);
}

// Normalise le champ `exploits` d'une sauvegarde (PUR, testé) : tolère l'absence
// (anciennes sauvegardes), les entrées partielles et les valeurs sales — chaque
// compteur est un entier ≥ 0. Ne purge JAMAIS une carte connue.
export function migrerExploits(brut: unknown): Exploits {
  const res: Exploits = {};
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return res;
  for (const [cid, val] of Object.entries(brut as Record<string, unknown>)) {
    if (!val || typeof val !== 'object') continue;
    const v = val as Partial<ExploitsCarte>;
    const entier = (x: unknown) => Math.max(0, Math.floor(Number(x) || 0));
    res[cid] = {
      ko: entier(v.ko),
      victoires: entier(v.victoires),
      parfaits: entier(v.parfaits),
      plusGrosCoup: entier(v.plusGrosCoup),
    };
  }
  return res;
}

// --- 🎖️ ÉVOLUTIONS À CHOIX (« talents » par carte, Pack 2, 19/07/2026) -------------
// Aux paliers d'entraînement 4/7/10 (coûts doublons/éclats et +6 % stats INCHANGÉS),
// le joueur choisit EN PLUS 1 talent parmi 2 propres à la carte. Tant que le palier
// n'a pas de choix, le talent est INACTIF. Un palier choisi peut être « re-forgé »
// pour des éclats : le choix repasse en attente. Les effets sont un enum FERMÉ,
// implémenté dans arene.ts (le PNJ n'a JAMAIS de talents).

export type EffetTalent =
  | 'vit_plus'         // +3 VIT (cumulable)
  | 'atk_pct'          // +10 % ATQ (cumulable)
  | 'pv_pct'           // +12 % PV max (cumulable)
  | 'spe_crit'         // spé : +20 pts de chance de crit (cumulable)
  | 'marque_plus'      // marques posées : +1 action de durée, Pétillant éclabousse à 35 %
  | 'spe_munition'     // +1 munition de spé (cumulable)
  | 'charge_depart'    // +1 charge Signature en entrée de combat (cumulable)
  | 'soin_plus'        // soins prodigués +20 % (cumulable)
  | 'bouclier_depart'  // entre avec un bouclier
  | 'premiere_frappe'  // 1ère attaque du combat +25 % (cumulable)
  | 'garde_maitrisee'  // sa Garde : −55 % au lieu de −45 %
  | 'contre_marque';   // en encaissant un coup : 25 % de poser sa marque de famille

export type PalierTalent = 4 | 7 | 10;
export type ChoixLettre = 'a' | 'b';
export type OptionTalent = { effet: EffetTalent; nom: string; desc: string };

export type ChoixTalentsCarte = { p4?: ChoixLettre; p7?: ChoixLettre; p10?: ChoixLettre };
export type TalentsCartes = Record<string, ChoixTalentsCarte>;

export const PALIERS_TALENT: PalierTalent[] = [4, 7, 10];
export const REFORGE_TALENT_ECLATS = 40; // coût de réinitialisation d'un palier choisi

const T = (effet: EffetTalent, nom: string, desc: string): OptionTalent => ({ effet, nom, desc });

// Table curée : chaque carte a 3 paliers × 2 options, choisies selon son identité
// (soigneur → soin_plus/garde_maitrisee ; rapide → vit_plus/premiere_frappe ;
// marque offensive → marque_plus/spe_crit ; tank → pv_pct/bouclier_depart/contre_marque…).
export const TALENTS_CARTES: Record<string, Record<PalierTalent, [OptionTalent, OptionTalent]>> = {
  // 🧋 Milk Tea (communes)
  boba: {
    4: [T('pv_pct', 'Cuir de tapioca', '+12 % de PV max'), T('bouclier_depart', 'Carapace prête', 'Entre au combat avec un bouclier')],
    7: [T('contre_marque', 'Riposte gluante', '25 % de Givrer l’attaquant quand il encaisse un coup'), T('garde_maitrisee', 'Garde ancestrale', 'Sa Garde bloque −55 % au lieu de −45 %')],
    10: [T('pv_pct', 'Forteresse boba', '+12 % de PV max en plus'), T('charge_depart', 'Élan originel', '+1 charge Signature au départ')],
  },
  classico: {
    4: [T('atk_pct', 'Recette concentrée', '+10 % d’ATQ'), T('soin_plus', 'Crème apaisante', 'Soins prodigués +20 %')],
    7: [T('charge_depart', 'Coup d’avance', '+1 charge Signature au départ'), T('premiere_frappe', 'Première gorgée', '1ère attaque du combat +25 %')],
    10: [T('atk_pct', 'L’original absolu', '+10 % d’ATQ en plus'), T('spe_munition', 'Recette de réserve', '+1 munition de spé')],
  },
  theo: {
    4: [T('vit_plus', 'Infusion rapide', '+3 VIT'), T('premiere_frappe', 'Sachet surprise', '1ère attaque du combat +25 %')],
    7: [T('spe_crit', 'Soporifique dosé', 'Spé : +20 % de crit'), T('spe_munition', 'Théière sans fond', '+1 munition de spé')],
    10: [T('contre_marque', 'Vapeur givrante', '25 % de Givrer l’attaquant quand il encaisse un coup'), T('charge_depart', 'Méditation éclair', '+1 charge Signature au départ')],
  },
  lacto: {
    4: [T('soin_plus', 'Lait entier', 'Soins prodigués +20 %'), T('pv_pct', 'Crème épaisse', '+12 % de PV max')],
    7: [T('spe_munition', 'Bain prolongé', '+1 munition de spé'), T('garde_maitrisee', 'Peau de lait', 'Sa Garde bloque −55 % au lieu de −45 %')],
    10: [T('soin_plus', 'Bain royal', 'Soins prodigués +20 % en plus'), T('bouclier_depart', 'Film protecteur', 'Entre au combat avec un bouclier')],
  },
  paillette: {
    4: [T('vit_plus', 'Bottes fusée', '+3 VIT'), T('premiere_frappe', 'Pique éclair', '1ère attaque du combat +25 %')],
    7: [T('spe_munition', 'Rafale infinie', '+1 munition de spé'), T('atk_pct', 'Paille acérée', '+10 % d’ATQ')],
    10: [T('vit_plus', 'Vitesse lumière', '+3 VIT en plus'), T('spe_crit', 'Rafale chirurgicale', 'Spé : +20 % de crit')],
  },
  sucrette: {
    4: [T('atk_pct', 'Sucre pur', '+10 % d’ATQ'), T('spe_crit', 'Rush croquant', 'Spé : +20 % de crit')],
    7: [T('premiere_frappe', 'Shot de glucose', '1ère attaque du combat +25 %'), T('charge_depart', 'Montée de sucre', '+1 charge Signature au départ')],
    10: [T('atk_pct', 'Sirop royal', '+10 % d’ATQ en plus'), T('spe_munition', 'Réserve de sucre', '+1 munition de spé')],
  },
  // 🍓 Fruités (rares)
  fraisy: {
    4: [T('spe_crit', 'Pépin affûté', 'Spé : +20 % de crit'), T('vit_plus', 'Fruité vif', '+3 VIT')],
    7: [T('marque_plus', 'Confiture tenace', 'Ses marques durent +1 action · Pétillant éclabousse à 35 %'), T('premiere_frappe', 'Première cueillette', '1ère attaque du combat +25 %')],
    10: [T('atk_pct', 'Cœur de fraise', '+10 % d’ATQ'), T('spe_munition', 'Tourbillon sans fin', '+1 munition de spé')],
  },
  mango: {
    4: [T('atk_pct', 'Mangue mûre', '+10 % d’ATQ'), T('premiere_frappe', 'Tranche d’ouverture', '1ère attaque du combat +25 %')],
    7: [T('spe_crit', 'Soleil brûlant', 'Spé : +20 % de crit'), T('vit_plus', 'Brise tropicale', '+3 VIT')],
    10: [T('atk_pct', 'Roi des tropiques', '+10 % d’ATQ en plus'), T('charge_depart', 'Chaleur montante', '+1 charge Signature au départ')],
  },
  litchee: {
    4: [T('vit_plus', 'Parfum vif', '+3 VIT'), T('spe_crit', 'Coquille parfaite', 'Spé : +20 % de crit')],
    7: [T('premiere_frappe', 'Éclat floral', '1ère attaque du combat +25 %'), T('spe_munition', 'Parfum persistant', '+1 munition de spé')],
    10: [T('contre_marque', 'Brume givrante', '25 % de Givrer l’attaquant quand il encaisse un coup'), T('atk_pct', 'Caractère affirmé', '+10 % d’ATQ')],
  },
  passion: {
    4: [T('atk_pct', 'Ardeur', '+10 % d’ATQ'), T('premiere_frappe', 'Coup de foudre', '1ère attaque du combat +25 %')],
    7: [T('spe_munition', 'Passion inépuisable', '+1 munition de spé'), T('soin_plus', 'Nectar vivifiant', 'Soins prodigués +20 %')],
    10: [T('atk_pct', 'Flamme absolue', '+10 % d’ATQ en plus'), T('charge_depart', 'Brasier initial', '+1 charge Signature au départ')],
  },
  citro: {
    4: [T('contre_marque', 'Zeste riposte', '25 % de Coller l’attaquant quand il encaisse un coup'), T('atk_pct', 'Acidité', '+10 % d’ATQ')],
    7: [T('marque_plus', 'Confit collant', 'Ses marques durent +1 action · Pétillant éclabousse à 35 %'), T('vit_plus', 'Zeste vif', '+3 VIT')],
    10: [T('spe_crit', 'Pluie cinglante', 'Spé : +20 % de crit'), T('premiere_frappe', 'Zeste d’entrée', '1ère attaque du combat +25 %')],
  },
  pasteka: {
    4: [T('pv_pct', 'Écorce épaisse', '+12 % de PV max'), T('garde_maitrisee', 'Carapace polie', 'Sa Garde bloque −55 % au lieu de −45 %')],
    7: [T('bouclier_depart', 'Double écorce', 'Entre au combat avec un bouclier'), T('contre_marque', 'Jus poisseux', '25 % de Coller l’attaquant quand il encaisse un coup')],
    10: [T('pv_pct', 'Pastèque géante', '+12 % de PV max en plus'), T('spe_munition', 'Carapace renouvelée', '+1 munition de spé')],
  },
  // ✨ Toppings (épiques)
  popping: {
    4: [T('atk_pct', 'Bulle surpressée', '+10 % d’ATQ'), T('spe_crit', 'Explosion précise', 'Spé : +20 % de crit')],
    7: [T('marque_plus', 'Éclat persistant', 'Ses marques durent +1 action · Pétillant éclabousse à 35 %'), T('premiere_frappe', 'Claque d’ouverture', '1ère attaque du combat +25 %')],
    10: [T('atk_pct', 'Détonation', '+10 % d’ATQ en plus'), T('spe_munition', 'Chargeur géant', '+1 munition de spé')],
  },
  jelly: {
    4: [T('pv_pct', 'Gelée dense', '+12 % de PV max'), T('garde_maitrisee', 'Mur poli', 'Sa Garde bloque −55 % au lieu de −45 %')],
    7: [T('contre_marque', 'Rebond poisseux', '25 % de Pétillanter l’attaquant quand il encaisse un coup'), T('bouclier_depart', 'Gelée prête', 'Entre au combat avec un bouclier')],
    10: [T('pv_pct', 'Wobble géant', '+12 % de PV max en plus'), T('spe_munition', 'Mur infini', '+1 munition de spé')],
  },
  mochito: {
    4: [T('soin_plus', 'Câlin généreux', 'Soins prodigués +20 %'), T('pv_pct', 'Pâte moelleuse', '+12 % de PV max')],
    7: [T('spe_munition', 'Mochi sans fin', '+1 munition de spé'), T('garde_maitrisee', 'Pâte élastique', 'Sa Garde bloque −55 % au lieu de −45 %')],
    10: [T('soin_plus', 'Doux miracle', 'Soins prodigués +20 % en plus'), T('charge_depart', 'Réconfort immédiat', '+1 charge Signature au départ')],
  },
  coco: {
    4: [T('pv_pct', 'Coque dure', '+12 % de PV max'), T('soin_plus', 'Lait frais', 'Soins prodigués +20 %')],
    7: [T('bouclier_depart', 'Coque levée', 'Entre au combat avec un bouclier'), T('spe_munition', 'Réserve de lait', '+1 munition de spé')],
    10: [T('pv_pct', 'Forteresse des îles', '+12 % de PV max en plus'), T('contre_marque', 'Éclat de coque', '25 % de Givrer l’attaquant quand il encaisse un coup')],
  },
  pudding: {
    4: [T('atk_pct', 'Flan corsé', '+10 % d’ATQ'), T('premiere_frappe', 'Claque caramélisée', '1ère attaque du combat +25 %')],
    7: [T('soin_plus', 'Caramel régénérant', 'Soins prodigués +20 %'), T('spe_munition', 'Flan géant', '+1 munition de spé')],
    10: [T('atk_pct', 'Maître flan', '+10 % d’ATQ en plus'), T('charge_depart', 'Flambré d’office', '+1 charge Signature au départ')],
  },
  nuage: {
    4: [T('soin_plus', 'Chantilly extra', 'Soins prodigués +20 %'), T('pv_pct', 'Cumulus', '+12 % de PV max')],
    7: [T('garde_maitrisee', 'Brume épaisse', 'Sa Garde bloque −55 % au lieu de −45 %'), T('spe_munition', 'Ciel sans limite', '+1 munition de spé')],
    10: [T('soin_plus', 'Nimbus miraculeux', 'Soins prodigués +20 % en plus'), T('bouclier_depart', 'Voile prêt', 'Entre au combat avec un bouclier')],
  },
  // 👑 Signatures (légendaires)
  'taro-queen': {
    4: [T('atk_pct', 'Sceptre affûté', '+10 % d’ATQ'), T('spe_crit', 'Décret précis', 'Spé : +20 % de crit')],
    7: [T('premiere_frappe', 'Entrée royale', '1ère attaque du combat +25 %'), T('charge_depart', 'Couronne chargée', '+1 charge Signature au départ')],
    10: [T('atk_pct', 'Reine absolue', '+10 % d’ATQ en plus'), T('spe_munition', 'Décrets illimités', '+1 munition de spé')],
  },
  'matcha-sensei': {
    4: [T('vit_plus', 'Pas de cérémonie', '+3 VIT'), T('premiere_frappe', 'Fouet éclair', '1ère attaque du combat +25 %')],
    7: [T('spe_crit', 'Zen absolu', 'Spé : +20 % de crit'), T('contre_marque', 'Souffle givré', '25 % de Givrer l’attaquant quand il encaisse un coup')],
    10: [T('charge_depart', 'Éveil instantané', '+1 charge Signature au départ'), T('spe_munition', 'Cérémonie sans fin', '+1 munition de spé')],
  },
  'brown-sugar-king': {
    4: [T('pv_pct', 'Caramel dense', '+12 % de PV max'), T('atk_pct', 'Rayure royale', '+10 % d’ATQ')],
    7: [T('soin_plus', 'Fondant réparateur', 'Soins prodigués +20 %'), T('charge_depart', 'Couronne d’or', '+1 charge Signature au départ')],
    10: [T('pv_pct', 'Monarque géant', '+12 % de PV max en plus'), T('spe_munition', 'Règne sans fin', '+1 munition de spé')],
  },
  'oreo-star': {
    4: [T('spe_crit', 'Griffes filantes', 'Spé : +20 % de crit'), T('vit_plus', 'Pas feutré', '+3 VIT')],
    7: [T('marque_plus', 'Rayures poisseuses', 'Ses marques durent +1 action · Pétillant éclabousse à 35 %'), T('premiere_frappe', 'Embuscade', '1ère attaque du combat +25 %')],
    10: [T('atk_pct', 'Rugissement', '+10 % d’ATQ'), T('spe_munition', 'Chasse sans fin', '+1 munition de spé')],
  },
  'caramel-chef': {
    4: [T('soin_plus', 'Nappage doré', 'Soins prodigués +20 %'), T('atk_pct', 'Louche affûtée', '+10 % d’ATQ')],
    7: [T('spe_munition', 'Casserole sans fond', '+1 munition de spé'), T('charge_depart', 'Feu vif', '+1 charge Signature au départ')],
    10: [T('soin_plus', 'Grand nappage', 'Soins prodigués +20 % en plus'), T('premiere_frappe', 'Flambé d’ouverture', '1ère attaque du combat +25 %')],
  },
  'bubble-master': {
    4: [T('atk_pct', 'Perle parfaite', '+10 % d’ATQ'), T('premiere_frappe', 'Jugement immédiat', '1ère attaque du combat +25 %')],
    7: [T('spe_crit', 'Verdict final', 'Spé : +20 % de crit'), T('charge_depart', 'Suprématie', '+1 charge Signature au départ')],
    10: [T('atk_pct', 'Maître absolu', '+10 % d’ATQ en plus'), T('spe_munition', 'Jugements illimités', '+1 munition de spé')],
  },
};

// Les 2 options d'un palier d'une carte (null si la carte n'a pas de table).
export function optionsTalent(carteId: string, palier: PalierTalent): [OptionTalent, OptionTalent] | null {
  return TALENTS_CARTES[carteId]?.[palier] ?? null;
}

// Effets ACTIFS d'une carte : un talent par palier ATTEINT (niveau ≥ palier) ET
// CHOISI. Un palier atteint sans choix = talent inactif. Helper PUR (testé).
export function talentsActifsCarte(carteId: string, choix: ChoixTalentsCarte | undefined, niveau: number): EffetTalent[] {
  if (!choix) return [];
  const res: EffetTalent[] = [];
  for (const palier of PALIERS_TALENT) {
    if (niveau < palier) continue;
    const lettre = choix[`p${palier}` as keyof ChoixTalentsCarte];
    if (!lettre) continue;
    const option = optionsTalent(carteId, palier)?.[lettre === 'a' ? 0 : 1];
    if (option) res.push(option.effet);
  }
  return res;
}

// Effets actifs de TOUTES les cartes ayant au moins un talent — même canal que
// niveauxEquipe côté store : à passer à creerCombat/creerCombatBoss (côté a).
export function effetsTalentsEquipe(talents: TalentsCartes, niveaux: Record<string, number>): Record<string, EffetTalent[]> {
  const res: Record<string, EffetTalent[]> = {};
  for (const [carteId, choix] of Object.entries(talents)) {
    const effets = talentsActifsCarte(carteId, choix, Math.max(1, Math.min(NIVEAU_CARTE_MAX, niveaux[carteId] ?? 1)));
    if (effets.length) res[carteId] = effets;
  }
  return res;
}

// Normalise le champ `talentsCartes` d'une sauvegarde (PUR, testé) : tolère
// l'absence, les entrées partielles et les valeurs sales — seuls les choix
// 'a'/'b' sur les paliers 4/7/10 sont conservés. Jamais de purge.
export function migrerTalents(brut: unknown): TalentsCartes {
  const res: TalentsCartes = {};
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return res;
  for (const [cid, val] of Object.entries(brut as Record<string, unknown>)) {
    if (!val || typeof val !== 'object') continue;
    const v = val as Record<string, unknown>;
    const choix: ChoixTalentsCarte = {};
    for (const cle of ['p4', 'p7', 'p10'] as const) {
      if (v[cle] === 'a' || v[cle] === 'b') choix[cle] = v[cle];
    }
    if (Object.keys(choix).length) res[cid] = choix;
  }
  return res;
}
