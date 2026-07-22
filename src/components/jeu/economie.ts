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

// Un PRIX RÉEL gagné (à réclamer en caisse dans la version finale)
export type Gain = {
  id: string;
  type: TypePrix;
  qte: number;          // nb tampons, % de réduction, nb boissons…
  label: string;
  origine: 'set' | 'collection' | 'boutique' | 'roulette' | 'quete';
  gagneLe: string;      // ISO
  statut: 'a_reclamer' | 'utilise';
};

// --- Les 4 sets ---------------------------------------------------------------

export const SETS: Record<SetId, {
  nom: string; rarete: Rarete; couleur: string; fond: string; emoji: string;
  recompense: { type: TypePrix; qte: number; label: string };
}> = {
  milk: {
    nom: 'La Bande Milk Tea', rarete: 'commun', couleur: '#8A68B8', fond: '#f1ecfa', emoji: '🧋',
    recompense: { type: 'tampon', qte: 1, label: '+1 tampon de fidélité' },
  },
  fruit: {
    nom: 'Le Gang des Fruités', rarete: 'rare', couleur: '#7E9B12', fond: '#eef4d8', emoji: '🍓',
    recompense: { type: 'tampon', qte: 2, label: '+2 tampons de fidélité' },
  },
  topping: {
    nom: 'L\'Équipe Toppings', rarete: 'epique', couleur: '#C99012', fond: '#fdf3c2', emoji: '✨',
    recompense: { type: 'reduction', qte: 10, label: '−10 % sur ta prochaine commande' },
  },
  signature: {
    nom: 'Les Signatures Royales', rarete: 'legendaire', couleur: '#D2588A', fond: '#fbe4ee', emoji: '👑',
    recompense: { type: 'boisson', qte: 1, label: 'Grande boisson offerte (L, M pour Signature)' },
  },
};

// Récompense quand TOUTE la collection (24/24) est complète
export const RECOMPENSE_COLLECTION = {
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
  { id: 'fraisy', nom: 'Fraisy', set: 'fruit', rarete: 'rare', phrase: 'La star de l\'été, fraîche et pétillante.' },
  { id: 'mango', nom: 'Mango', set: 'fruit', rarete: 'rare', phrase: 'Soleil tropical garanti à chaque gorgée.' },
  { id: 'litchee', nom: 'Litchee', set: 'fruit', rarete: 'rare', phrase: 'Petit parfum délicat, grand caractère.' },
  { id: 'passion', nom: 'Passion', set: 'fruit', rarete: 'rare', phrase: 'Elle porte bien son nom.' },
  { id: 'citro', nom: 'Citro', set: 'fruit', rarete: 'rare', phrase: 'Acidulé juste ce qu\'il faut.' },
  { id: 'pasteka', nom: 'Pastèka', set: 'fruit', rarete: 'rare', phrase: ' 92 % d\'eau, 100 % de fun.' },
  // Set Toppings (épique)
  { id: 'popping', nom: 'Popping', set: 'topping', rarete: 'epique', phrase: 'Elle éclate en bouche. Littéralement.' },
  { id: 'jelly', nom: 'Jelly', set: 'topping', rarete: 'epique', phrase: 'Wobble wobble. Rien ne la déstabilise.' },
  { id: 'mochito', nom: 'Mochito', set: 'topping', rarete: 'epique', phrase: 'Tout doux, tout rond, tout bon.' },
  { id: 'coco', nom: 'Coco', set: 'topping', rarete: 'epique', phrase: 'La perle blanche des îles.' },
  { id: 'pudding', nom: 'Pudding', set: 'topping', rarete: 'epique', phrase: 'Le flan qui a du flair.' },
  { id: 'nuage', nom: 'Nuage', set: 'topping', rarete: 'epique', phrase: 'La chantilly qui plane au-dessus du lot.' },
  // Set Signatures (légendaire)
  { id: 'taro-queen', nom: 'Taro Queen', set: 'signature', rarete: 'legendaire', phrase: 'Violette, royale, inimitable.' },
  { id: 'matcha-sensei', nom: 'Matcha Sensei', set: 'signature', rarete: 'legendaire', phrase: 'Maître zen du thé vert cérémonial.' },
  { id: 'brown-sugar-king', nom: 'Brown Sugar King', set: 'signature', rarete: 'legendaire', phrase: 'Ses rayures de caramel font sa couronne.' },
  { id: 'oreo-star', nom: 'Oreo Star', set: 'signature', rarete: 'legendaire', phrase: 'Cookies, crème, et beaucoup de style.' },
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

export const CAPSULES: Record<TypeCapsule, {
  nom: string; cout: number; couleur: string;
  poids: Record<Rarete, number>; // sur 100
}> = {
  classique: {
    nom: 'Capsule Classique', cout: 400, couleur: '#8A68B8',
    poids: { commun: 62, rare: 26, epique: 9, legendaire: 3 },
  },
  doree: {
    nom: 'Capsule Dorée', cout: 1200, couleur: '#C99012',
    poids: { commun: 0, rare: 60, epique: 30, legendaire: 10 },
  },
};

// Perles rendues quand on tire un doublon
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

export const DOUBLON_PERLES: Record<Rarete, number> = {
  commun: 60, rare: 150, epique: 350, legendaire: 800,
};

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
export const BONUS_PREMIERE_PARTIE = 2; // multiplicateur 1ʳᵉ partie du jour

// Conversion score → perles (plafonnée pour garder l'économie saine)
export function perlesPourScore(score: number): number {
  return Math.min(PERLES_MAX_PARTIE, Math.round(score / 10));
}

// --- Récompenses des niveaux d'Aventure (équilibrage « Normal ») --------------------
// 1ʳᵉ réussite d'un niveau = capsule (dorée aux boss, tous les 5 niveaux).
// Rejouer un niveau déjà réussi = quelques perles seulement (anti-farm).

export const NIVEAU_PERLES_PAR_ETOILE = 40;   // bonus 1ʳᵉ réussite : étoiles × 40
export const NIVEAU_DIV_SCORE = 8;            // perles = score/8 (1ʳᵉ réussite)
export const NIVEAU_DIV_REJOUER = 14;         // perles = score/14 (niveau déjà réussi)
export const NIVEAU_DIV_ECHEC = 14;           // consolation en cas d'échec

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
// une capsule dorée coûte 1 200 perles, un vrai tampon commence à 8 000.
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
export const BOUTIQUE: { id: string; cout: number; type: TypePrix; qte: number; parMois: number; label: string; detail: string }[] = [
  { id: 'tampon-1', cout: 8000, type: 'tampon', qte: 1, parMois: 1, label: '+1 tampon', detail: 'Un tampon direct sur ta carte de fidélité' },
  { id: 'reduc-10', cout: 20000, type: 'reduction', qte: 10, parMois: 3, label: '−10 %', detail: 'Sur ta prochaine commande en boutique' },
  { id: 'reduc-20', cout: 40000, type: 'reduction', qte: 20, parMois: 1, label: '−20 %', detail: 'Grosse réduction sur ta prochaine commande' },
  { id: 'boisson-l', cout: 60000, type: 'boisson', qte: 1, parMois: 1, label: 'Grande boisson offerte', detail: 'Taille L (M pour les Signatures)' },
];

// --- Roulette mensuelle (toujours gagnante, 1 tour par mois) -----------------------

export type SegmentRoulette = {
  id: string; label: string; type: TypePrix; qte: number; poids: number; couleur: string;
};

export const ROULETTE: SegmentRoulette[] = [
  { id: 'tampon-1', label: '+1 tampon', type: 'tampon', qte: 1, poids: 28, couleur: '#A3C724' },
  { id: 'perles-300', label: '+300 perles', type: 'perles', qte: 300, poids: 22, couleur: '#8A68B8' },
  { id: 'tampon-2', label: '+2 tampons', type: 'tampon', qte: 2, poids: 14, couleur: '#7EC8E3' },
  { id: 'reduc-10', label: '−10 %', type: 'reduction', qte: 10, poids: 12, couleur: '#FFD166' },
  { id: 'perles-800', label: '+800 perles', type: 'perles', qte: 800, poids: 10, couleur: '#54418A' },
  { id: 'capsule-doree', label: 'Capsule dorée', type: 'capsule_doree', qte: 1, poids: 8, couleur: '#F3A0BD' },
  { id: 'tampon-3', label: '+3 tampons', type: 'tampon', qte: 3, poids: 5, couleur: '#7E9B12' },
  { id: 'boisson-l', label: 'Boisson offerte', type: 'boisson', qte: 1, poids: 1, couleur: '#D2588A' },
];

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
// Comme les cartes ne montent pas de niveau, toute la puissance vient de l'équipement.
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
  'oreo-star': { nom: 'Éclat d\'étoile', desc: '+12 % de crit', eff: { critPct: 12 } },
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
const BOSS_NOMS = ['Méga Boba', 'Taro Colossal', 'Roi Caramel Géant', 'Oreo Titan', 'Chef Suprême', 'Grand Sensei'];
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
  const gim = BOSS_GIMMICKS[(g >>> 3) % BOSS_GIMMICKS.length];
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
