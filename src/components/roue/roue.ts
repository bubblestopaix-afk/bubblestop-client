// === La Roue du Mois — moteur PUR (3e jeu autonome de l'appli, hors Boba Quest) ===
// Un tour GRATUIT par mois, huit parts, des lots RÉELS retirés en boutique via le
// pont caisse (`jeu-recompenses`). Ce module ne connaît ni React, ni le réseau, ni
// AsyncStorage : le harnais `scripts/test-jeu.cjs` le compile SEUL dans son coin et
// le teste au degré et à la milliseconde près.
// Deux interdits structurants, hérités des moteurs de Boba Quest :
//   · JAMAIS Math.random() ici — le rng est toujours INJECTÉ (`() => number`).
//     C'est ce qui rend les tirages rejouables en test, et ce qui impose à l'écran
//     de tirer le résultat AVANT d'animer : l'animation ne décide jamais du lot.
//   · JAMAIS Date.now() ici — la date est toujours passée en paramètre. Un verrou
//     mensuel qui lirait l'horloge lui-même serait intestable là où il doit être
//     le plus sûr : 31 décembre à 23 h 59, février bissextile, 1er du mois.

export type SegmentRoue = {
  id: string;
  /** Libellé COURT, écrit SUR la roue (45° par part : chaque caractère compte). */
  libelle: string;
  /** Version longue et EXPLIQUÉE, pour tout ce qui parle du gain : carte du lot,
   *  cérémonie, liste « Tes chances ». Absent = `libelle` suffit tel quel.
   *  (04/08, Yoann : « enlève offert dans le libellé, explique-le dans le gain ».) */
  libelleGain?: string;
  /** Chance RÉELLE en % — la somme de la table fait exactement 100. */
  poids: number;
  /** Code canonique du catalogue caisse (validé côté serveur). `null` pour le SEUL
   *  lot virtuel, « Nouveau tour » : tout le reste se retire en boutique. */
  code: string | null;
  couleur: string;
  emoji: string;
};

// Les parts AFFICHÉES sont ÉGALES (45°) alors que les chances vont de 7 à 17 %.
// C'est défendable — même doctrine que la roulette de Boba Quest (cf. le long
// commentaire de `ROULETTE` dans components/jeu/economie.ts) — parce que :
//   · l'écart max/min des poids est 17/7 ≈ 2,4, sous le plafond ~2,5 : au pire une
//     part annonce 12,5 % pour 7 % réels, un facteur 1,8, pas un facteur 12 ;
//   · l'écran affiche les probabilités EXACTES sous la roue (`pourcentagesHonnetes`).
//     Ne jamais retirer cette liste, et ne pas laisser l'écart se creuser.
// Couleurs : reprises de la palette charte utilisée par la table ROULETTE de Quest,
// en ALTERNANT clair/foncé — 8 parts, nombre pair, l'alternance boucle donc
// proprement au raccord boisson → +1 tampon et deux voisines ne se fondent jamais.
// Retours de Yoann (03/08, libellés affinés le 04/08) actés dans cette table :
//   · le lot topping est DOUBLE — un seul topping paraissait maigre face aux
//     tampons. Sur la ROUE : « Double topping » (court) ; le « offert » vit dans
//     le libellé de GAIN (carte du lot, chances, caisse) ;
//   · PAS de chantilly (elle n'existe que sur les milkshakes : lot mort pour une
//     partie des clients) → remplacée par « −20 % », universel ;
//   · JAMAIS un deuxième segment boisson (surclassement compris) : la boisson
//     offerte est déjà servie en taille MAX — un « taille au-dessus » serait un
//     doublon mensonger. Un seul segment boisson, point.
// Palette (04/08, « plus dans la DA Bubble ») : fini l'alternance clair/FONCÉ des
// débuts — la charte kawaii est LUMINEUSE (pastels gourmands + vert boba, jaune
// perle, rose bubble). On alterne donc saturé charte / pastel gourmand, texte encre
// partout… sauf le GROS LOT : la boisson offerte garde le seul segment violet
// (texte blanc) — la hiérarchie se lit d'un coup d'œil, comme les cartes de l'accueil.
export const SEGMENTS_ROUE: SegmentRoue[] = [
  { id: 'tampon1', libelle: '+1 tampon', poids: 17, code: 'roulette_tampon_1', couleur: '#9FC038', emoji: '💮' },        // C.vert (vert boba)
  { id: 'topping', libelle: 'Double topping', libelleGain: 'Double topping offert', poids: 16, code: 'roue_topping', couleur: '#FFD6E8', emoji: '🍡' }, // rose dragée (pastel)
  { id: 'double', libelle: 'Nouveau tour', poids: 14, code: null, couleur: '#F2DA33', emoji: '🌀' },                      // C.jaune (jaune perle)
  { id: 'tampon2', libelle: '+2 tampons', poids: 13, code: 'roulette_tampon_2', couleur: '#D9C9F0', emoji: '🌸' },       // C.surViolet (lavande pastel)
  { id: 'reduc10', libelle: '−10 %', poids: 13, code: 'roulette_reduction_10', couleur: '#F7B8D6', emoji: '🏷️' },       // C.rose (rose bubble)
  { id: 'tampon3', libelle: '+3 tampons', poids: 11, code: 'roulette_tampon_3', couleur: '#DFF0BC', emoji: '🌺' },       // vert pâle (pastel badge)
  { id: 'reduc20', libelle: '−20 %', poids: 9, code: 'roue_reduction_20', couleur: '#89CFE3', emoji: '🎟️' },            // C.bleu (bleu charte)
  { id: 'boisson', libelle: 'Boisson offerte', poids: 7, code: 'roulette_boisson_l', couleur: '#815FAE', emoji: '🧋' },  // C.violetClair — LE gros lot
];

/** Ouverture angulaire d'une part affichée : 8 parts égales. */
export const PART_DEG = 360 / SEGMENTS_ROUE.length; // = 45

// La roue ne s'arrête jamais à moins de 6° d'une couture : un pointeur posé SUR une
// frontière est illisible (« j'ai gagné lequel ? »), et un pointeur toujours pile au
// centre sent le truqué. Entre les deux : une position aléatoire dans la part.
export const MARGE_BORD_DEG = 6;

/**
 * Tire un index de segment selon les POIDS (pas selon les parts affichées).
 * `exclureId` retire un segment du tirage : sa masse se redistribue au prorata des
 * poids restants — c'est la définition même d'un tirage conditionnel, aucune autre
 * renormalisation n'est nécessaire.
 */
export function tirerSegment(rng: () => number, exclureId?: string): number {
  let total = 0;
  for (const s of SEGMENTS_ROUE) if (s.id !== exclureId) total += s.poids;
  let t = rng() * total;
  let dernier = 0;
  for (let i = 0; i < SEGMENTS_ROUE.length; i++) {
    const s = SEGMENTS_ROUE[i];
    if (s.id === exclureId) continue;
    dernier = i;
    t -= s.poids;
    if (t < 0) return i;
  }
  // Filet flottant : rng() < 1 garantit mathématiquement un retour dans la boucle,
  // mais une accumulation d'arrondis pourrait laisser t ≈ 0. Le dernier candidat
  // NON exclu reste alors le seul choix cohérent.
  return dernier;
}

export type TirageRoue = {
  premierId: string;
  /** Toujours un lot RÉEL : jamais 'double'. */
  finalId: string;
  doubleTour: boolean;
};

/**
 * Le tirage complet du mois, en un appel. « Nouveau tour » est un lot VIRTUEL : il
 * relance la roue en s'excluant lui-même, si bien que le lot FINAL est toujours un
 * lot réel — un mois ne peut jamais se solder par « rien ». Les deux tirages sont
 * faits ICI, avant toute animation : l'écran ne fait que rejouer ce verdict.
 */
export function tirageComplet(rng: () => number): TirageRoue {
  const premier = SEGMENTS_ROUE[tirerSegment(rng)];
  if (premier.id !== 'double') {
    return { premierId: premier.id, finalId: premier.id, doubleTour: false };
  }
  const second = SEGMENTS_ROUE[tirerSegment(rng, 'double')];
  return { premierId: 'double', finalId: second.id, doubleTour: true };
}

/**
 * Rotation TOTALE (en degrés, sens horaire) pour que le pointeur — fixe, en haut à
 * 12 h — s'arrête DANS le segment `index`. Après une rotation r, le point de roue
 * situé à l'angle (−r mod 360) passe sous le pointeur ; on vise donc l'opposé de
 * l'angle d'atterrissage choisi. Cet angle est ALÉATOIRE dans la part, à au moins
 * `MARGE_BORD_DEG` des coutures : le résultat étant tiré avant l'animation, un
 * arrêt systématiquement centré trahirait la mise en scène.
 */
export function rotationCibleVers(index: number, rng: () => number, toursPleins: number): number {
  const demiUtile = PART_DEG / 2 - MARGE_BORD_DEG; // 16,5° de part et d'autre du centre
  const angle = index * PART_DEG + (rng() * 2 - 1) * demiUtile;
  const base = (((360 - (angle % 360)) % 360) + 360) % 360;
  return toursPleins * 360 + base;
}

/**
 * L'inverse : quel segment est sous le pointeur pour une rotation donnée ?
 * Sert de preuve de cohérence dans les tests (aller-retour avec `rotationCibleVers`)
 * et de garde-fou à l'écran. La part i s'étend de i×45° − 22,5° à i×45° + 22,5° :
 * arrondir à la part la plus proche suffit, quel que soit le signe de la rotation.
 */
export function segmentSousPointeur(rotationDeg: number): number {
  const angle = (((360 - (rotationDeg % 360)) % 360) + 360) % 360;
  return Math.round(angle / PART_DEG) % SEGMENTS_ROUE.length;
}

/**
 * Les instants (ms) où une couture de segment franchit le pointeur pendant une
 * rotation `rotationTotaleDeg` animée en `dureeMs` sous easing cubic-out
 * p(t) = 1 − (1 − t/durée)³ — exactement la courbe que l'écran donne à RN Animated
 * (`Easing.out(Easing.cubic)`). L'inverse analytique t(p) = durée × (1 − (1−p)^(1/3))
 * donne l'instant exact de chaque franchissement : les tics haptiques se resserrent
 * au départ puis s'espacent, comme les crans d'une vraie roue qui ralentit. Aucun
 * échantillonnage, aucune dérive : la liste est strictement croissante et le dernier
 * instant ne dépasse jamais la durée.
 * Hypothèse de départ : pointeur au CENTRE d'une part (le repos), première couture à
 * 22,5°. Le re-spin du double tour part d'un point quelconque de la part — l'écart
 * est borné par une demi-part, imperceptible pour un tic haptique.
 */
export function instantsDeCrans(rotationTotaleDeg: number, dureeMs: number): number[] {
  const instants: number[] = [];
  if (rotationTotaleDeg <= 0 || dureeMs <= 0) return instants;
  for (let g = PART_DEG / 2; g <= rotationTotaleDeg; g += PART_DEG) {
    const p = g / rotationTotaleDeg;
    instants.push(dureeMs * (1 - Math.cbrt(1 - p)));
  }
  return instants;
}

/**
 * Validité d'un lot de la roue : 30 jours après le tirage (décision Yoann, 03/08).
 * Le CHIFFRE vit ici pour n'exister qu'une fois côté appli ; la même règle est
 * appliquée côté serveur (filtre du POS dans l'Edge `jeu-recompenses` + garde de
 * `confirmer_demande_recompense_jeu`), qui reste la source de vérité. L'appli
 * compte depuis le TIRAGE, le serveur depuis la création de la demande (quelques
 * secondes plus tard, ou plus si hors-ligne) : l'appli affiche donc toujours une
 * échéance égale ou PLUS TÔT que ce que le serveur accepte — jamais l'inverse,
 * on ne promet jamais un lot que la caisse refuserait.
 */
export const LOT_VALIDITE_JOURS = 30;

/**
 * Date d'expiration d'un lot tiré le `joueLe`. Addition en jours CALENDAIRES
 * (année/mois/jour + 30, heure conservée), pas en millisecondes : un +30×24 h
 * traverserait les changements d'heure d'octobre/mars avec une heure de dérive.
 * Les débordements (31 + 30 = « 61 janvier ») sont normalisés par Date — fin
 * d'année et février bissextile compris, sans table à la main.
 */
export function expireLe(joueLe: Date): Date {
  return new Date(
    joueLe.getFullYear(), joueLe.getMonth(), joueLe.getDate() + LOT_VALIDITE_JOURS,
    joueLe.getHours(), joueLe.getMinutes(), joueLe.getSeconds(), joueLe.getMilliseconds(),
  );
}

/** Clé calendaire 'AAAA-MM' en heure LOCALE : le mois du joueur est celui de son
 *  téléphone, comme partout ailleurs dans l'appli (`cleJour` de Boba Quest). */
export function cleDuMois(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Nombre de jours avant le mois suivant, en jours CALENDAIRES (≥ 1) — pas en
 * tranches de 24 h : le soir du dernier jour du mois, « nouvelle roue dans 1 j »
 * doit rester vrai même s'il ne reste que deux heures.
 * `new Date(année, mois + 1, 0)` = dernier jour du mois courant, donc son nombre
 * de jours — février bissextile et passages d'année compris, sans table à la main.
 */
export function joursAvantMoisSuivant(d: Date): number {
  const joursDansLeMois = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return joursDansLeMois - d.getDate() + 1;
}

/**
 * La liste « Tes chances » : les probabilités EXACTES, lues sur les poids. C'est
 * elle qui rend le découpage égal de la roue défendable — elle s'affiche SOUS la
 * roue, jamais dessus (un % par part rendrait la roue illisible et redondante).
 */
export function pourcentagesHonnetes(): { id: string; libelle: string; pct: number }[] {
  const total = SEGMENTS_ROUE.reduce((s, x) => s + x.poids, 0);
  // Le libellé de GAIN quand il existe : cette liste EXPLIQUE les lots (« Double
  // topping offert »), là où la roue n'a la place que du libellé court.
  return SEGMENTS_ROUE.map((s) => ({ id: s.id, libelle: s.libelleGain ?? s.libelle, pct: (s.poids / total) * 100 }));
}
