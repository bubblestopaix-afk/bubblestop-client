// Catalogue Bubble Stop - basé sur le menu officiel
// Structure : catégories > saveurs, prix par format S/M/L, options (chantilly, lait avoine, toppings)
// Chaque saveur a un picto (emoji ingrédient) et une couleur qui rappelle l'ingrédient

// === Constantes globales ===
// Système de portions : 1 portion = 2 demi-portions
// On peut prendre 1 portion entière d'un seul topping (1) ou 2 demi-portions différentes (½ + ½)
export const PORTIONS_OFFERTES = 1;               // 1 portion offerte par défaut
export const PORTIONS_AVEC_DOUBLE = 2;            // 2 portions avec le supplément double portion
export const PRIX_DOUBLE_PORTION = 0.9;           // forfait pour passer de 1 à 2 portions
export const PRIX_TOPPING_CITRONNADE = 0.5;       // citronnade : 0,50€ par topping (système simple)
export const SUPPLEMENT_CHANTILLY = 0.5;          // pour milkshakes
export const SUPPLEMENT_LAIT_AVOINE = 0.6;        // pour milk tea uniquement

// === Formats ===
export const formats = [
  { id: 'S', label: 'Small', volume: '36 cl' },
  { id: 'M', label: 'Medium', volume: '50 cl' },
  { id: 'L', label: 'Large', volume: '70 cl' },
];

// === Mochi : tarif dégressif par pack de 2 ===
// 1 mochi = 2,50€ ; pack de 2 = 4,50€ (au lieu de 5,00€) → -0,50€ par paire.
// 1=2,50 · 2=4,50 · 3=7,00 · 4=9,00 …
export const PRIX_MOCHI_UNITE = 2.5;
export const PRIX_MOCHI_PACK2 = 4.5;
// Remise « pack de 2 » à déduire du total, selon le nombre total de mochis du panier.
export function remiseMochiPanier(panier) {
  const nb = (panier || [])
    .filter((l) => l?.categorie?.id === 'mochi-glace')
    .reduce((s, l) => s + (Number(l.qte) || 1), 0);
  const paires = Math.floor(nb / 2);
  const remiseParPaire = 2 * PRIX_MOCHI_UNITE - PRIX_MOCHI_PACK2; // 0,50€
  return Math.round(paires * remiseParPaire * 100) / 100;
}

// === Niveaux de sucre ===
export const niveauxSucre = [
  { id: 'plus', label: 'Extra sucre' },
  { id: 'normal', label: 'Normal' },
  { id: 'moyen', label: 'Moyen' },
  { id: 'sans', label: 'Sans sucre' },
];

// === Catégories de boisson ===
// `icone` = emoji représentant l'ingrédient principal
// `couleur` = teinte rappelant l'ingrédient (fond du cercle picto)
export const categories = [
  {
    id: 'fruit-tea',
    nom: 'Fruit tea',
    sousTitre: 'Thé + 1 saveur fruitée au choix',
    emoji: '🍓',
    photo: '/img/photos/tea.webp',
    couleur: '#e07a8a',
    formats: ['S', 'M', 'L'],
    prix: { S: 3.5, M: 4.5, L: 5.5 },
    saveurs: [
      { id: 'ft-litchi',    nom: 'Litchi',    icone: 'svg-litchi', couleur: '#f3c5d4' },
      { id: 'ft-peche',     nom: 'Pêche',     icone: 'svg-peche', couleur: '#ffb499', reco: true },
      { id: 'ft-citron',    nom: 'Citron',    icone: '🍋', couleur: '#f5e260' },
      { id: 'ft-fraise',    nom: 'Fraise',    icone: '🍓', couleur: '#ff8597' },
      { id: 'ft-hibiscus',  nom: 'Hibiscus',  icone: '🌺', couleur: '#e8519c' },
      { id: 'ft-framboise', nom: 'Framboise', icone: 'svg-framboise', couleur: '#f7c8d3' },
      { id: 'ft-pasteque',  nom: 'Pastèque',  icone: '🍉', couleur: '#ff7676' },
      { id: 'ft-mangue',    nom: 'Mangue',    icone: '🥭', couleur: '#ffb244', reco: true },
      { id: 'ft-passion',   nom: 'Passion',   icone: 'svg-passion', couleur: '#ffe1a8', reco: true },
      { id: 'ft-myrtille',  nom: 'Myrtille',  icone: '🫐', couleur: '#7c6cc4' },
    ],
  },
  {
    id: 'milk-tea',
    nom: 'Milk tea',
    sousTitre: 'Thé au lait',
    emoji: '🥛',
    photo: '/img/photos/milktea.webp',
    photos: ['/img/photos/milktea.webp', '/img/photos/match.webp'],
    couleur: '#9bb8d9',
    formats: ['S', 'M', 'L'],
    prix: { S: 4.3, M: 5.3, L: 5.9 },
    optionLaitAvoine: true,
    saveurs: [
      { id: 'mt-original',       nom: 'Original',       icone: 'svg-bubble-tea', couleur: '#f0dcb8', reco: true },
      { id: 'mt-chai',           nom: 'Chaï',           icone: 'svg-chai', couleur: '#f0d9b8' },
      { id: 'mt-fraise',         nom: 'Fraise',         icone: '🍓', couleur: '#ff8597', froid: true },
      { id: 'mt-oolong',         nom: 'Oolong',         icone: 'svg-bubble-tea', couleur: '#f0dcb8', reco: true },
      { id: 'mt-matcha',         nom: 'Matcha',         icone: 'svg-bubble-tea-matcha', couleur: '#88b066' },
      { id: 'mt-taro-coco',      nom: 'Taro & Coco',    icone: 'svg-taro-coco', couleur: '#e6dcc8' },
      { id: 'mt-taro',           nom: 'Taro',           icone: 'svg-taro', couleur: '#d4c5e8', reco: true },
      { id: 'mt-chocolat',       nom: 'Chocolat',       icone: '🍫', couleur: '#7a4a2d' },
      { id: 'mt-vanille',        nom: 'Vanille',        icone: 'svg-vanille', couleur: '#e8d4b0', reco: true },
      { id: 'mt-coco',           nom: 'Coco',           icone: '🥥', couleur: '#d9c9a3' },
      { id: 'mt-assam',          nom: 'Assam',          icone: 'svg-bubble-tea', couleur: '#f0dcb8' },
      { id: 'mt-matcha-vanille', nom: 'Matcha Vanille', icone: 'svg-bubble-tea-matcha', couleur: '#b8c889' },
      { id: 'mt-matcha-fraise',  nom: 'Matcha Fraise',  icone: 'svg-bubble-tea-matcha', couleur: '#a3c48a', froid: true },
      { id: 'mt-rose',           nom: 'Rose',           icone: '🌹', couleur: '#e0779f' },
      { id: 'mt-brown-sugar',    nom: 'Brown sugar',    icone: 'svg-brown-sugar', couleur: '#e8c89a' },
      { id: 'mt-jasmin',         nom: 'Jasmin',         icone: 'svg-jasmin', couleur: '#f5edd0' },
      { id: 'mt-malt-vanille',   nom: 'Malt & vanille', icone: '🌾', couleur: '#d1b97f' },
    ],
  },
  {
    id: 'traditional',
    nom: 'Traditional',
    sousTitre: 'Thés du monde fraîchement infusés',
    emoji: '🍵',
    photo: '/img/photos/trad.webp',
    couleur: '#88a878',
    formats: ['S', 'M', 'L'],
    prix: { S: 3.9, M: 4.7, L: 5.7 },
    saveurs: [
      { id: 'tr-oolong',          nom: 'Oolong',               icone: '🍂', couleur: '#a06a3d' },
      { id: 'tr-earl-grey',       nom: 'Earl grey',            icone: '☕', couleur: '#8a5a3a' },
      { id: 'tr-genmaicha',       nom: 'Genmaicha',            icone: '🌾', couleur: '#c4a268' },
      { id: 'tr-cranberry',       nom: 'Cranberry',            icone: 'svg-cranberry', couleur: '#f5a8aa' },
      { id: 'tr-malt-vanille',    nom: 'Malt & vanille',       icone: '🌾', couleur: '#d1b97f' },
      { id: 'tr-cherry-blossom',  nom: 'Cherry blossom',       icone: '🌸', couleur: '#f0a5c3', reco: true },
      { id: 'tr-the-vert-jasmin', nom: 'Thé vert jasmin',      icone: '🍃', couleur: '#a8c270' },
      { id: 'tr-oolong-peche',    nom: 'Oolong pêche blanche', icone: 'svg-peche', couleur: '#f5b896', reco: true },
      { id: 'tr-assam',           nom: 'Assam',                icone: '🍵', couleur: '#9c6940' },
    ],
  },
  {
    id: 'milkshake',
    nom: 'Milkshake',
    sousTitre: 'Glacé et gourmand',
    emoji: '🥤',
    photo: '/img/photos/milkshake.webp',
    couleur: '#e07a8a',
    formats: ['S', 'M', 'L'],
    prix: { S: 4.5, M: 5.5, L: 5.9 },
    froidUniquement: true,        // milkshake = forcément glacé, pas de choix température
    sansGlacons: true,            // mixé glacé : pas de choix de glaçons
    optionChantilly: true,
    optionLaitAvoine: true,
    saveurs: [
      { id: 'ms-coco',     nom: 'Coco',     icone: '🥥', couleur: '#d9c9a3', reco: true },
      { id: 'ms-cafe',     nom: 'Café',     icone: 'svg-grain-cafe', couleur: '#e8d0b0' },
      { id: 'ms-taro',     nom: 'Taro',     icone: 'svg-taro', couleur: '#d4c5e8' },
      { id: 'ms-passion',  nom: 'Passion',  icone: 'svg-passion', couleur: '#ffe1a8' },
      { id: 'ms-fraise',   nom: 'Fraise',   icone: '🍓', couleur: '#ff8597' },
      { id: 'ms-vanille',  nom: 'Vanille',  icone: 'svg-vanille', couleur: '#e8d4b0', reco: true },
      { id: 'ms-matcha',   nom: 'Matcha',   icone: 'svg-bubble-tea-matcha', couleur: '#88b066' },
      { id: 'ms-chocolat', nom: 'Chocolat', icone: '🍫', couleur: '#7a4a2d' },
    ],
  },
  {
    id: 'signature',
    nom: 'Signature',
    sousTitre: 'Un classique & nos créations',
    emoji: '⭐',
    photo: '/img/photos/match.webp',
    couleur: '#9fc038',
    formats: ['M'],
    prix: { M: 5.5 },
    saveurs: [
      {
        id: 'sg-tiger',
        nom: 'Tiger Sugar',
        description: 'Lait entier bio, brown sugar',
        icone: 'svg-tiger-sugar',
        couleur: '#d49832',
        froid: true,
      },
      {
        id: 'sg-matcha-mousse',
        nom: 'Matcha Mousse',
        description: 'Matcha + mousse de lait épaisse (cream cheese)',
        icone: 'svg-bubble-tea-matcha',
        couleur: '#88b066',
        supplement: 0.5,
      },
      {
        id: 'sg-creme-brulee',
        nom: 'Milk Tea Crème Brûlée',
        icone: 'svg-creme-brulee',
        couleur: '#d4a565',
        supplement: 0.5,
      },
      {
        id: 'sg-mango-punch',
        nom: 'Mango Punch',
        description: 'Thé vert glacé mangue & citron frais pressé',
        icone: '🥭',
        couleur: '#ffb244',
        froid: true,
      },
    ],
  },
  {
    id: 'citronnade',
    nom: 'Citronnade',
    sousTitre: 'Citrons frais pressés, eau',
    emoji: '🍋',
    photo: '/img/photos/citronnade.webp',
    couleur: '#f2da33',
    formats: ['S', 'M', 'L'],
    prix: { S: 3.5, M: 4.3, L: 4.9 },
    froidUniquement: true,
    toppingPayantUnit: true,
    saveurs: [
      { id: 'ci-nature', nom: 'Citronnade', icone: '🍋', couleur: '#f5e260' },
    ],
  },
  // Mochi glacé en dernier (dessert) sur la borne
  {
    id: 'mochi-glace',
    nom: 'Mochi glacé',
    sousTitre: 'Dessert glacé japonais',
    emoji: '🍡',
    visuel: 'mochi',             // carte borne : compo de mochis dessinés (pas de photo)
    couleur: '#e6a9c7',
    formats: ['M'],
    prix: { M: 2.5 },            // 2,50€ l'unité ; remise pack de 2 calculée au total
    tvaTaux: 10,                 // TVA 10% (à consommer, dessert glacé)
    froidUniquement: true,
    sansChoixSucre: true,
    sansGlacons: true,           // dessert : pas de glaçons
    sansToppings: true,          // dessert : pas de toppings ni extras
    sansOptions: true,           // clic saveur = ajout direct à 2,50€ (saveur conservée)

    saveurs: [
      { id: 'mo-vanille',  nom: 'Vanille',  icone: 'svg-mochi', couleur: '#e8d4b0', reco: true },
      { id: 'mo-matcha',   nom: 'Matcha',   icone: 'svg-mochi', couleur: '#88b066' },
      { id: 'mo-mangue',   nom: 'Mangue',   icone: 'svg-mochi', couleur: '#ffb244' },
      { id: 'mo-fraise',   nom: 'Fraise',   icone: 'svg-mochi', couleur: '#ff8597' },
      { id: 'mo-chocolat', nom: 'Chocolat', icone: 'svg-mochi', couleur: '#7a4a2d' },
      { id: 'mo-coco',     nom: 'Coco',     icone: 'svg-mochi', couleur: '#d9c9a3' },
    ],
  },
];

// === Toppings ===
// Chaque topping a un picto (emoji ingrédient) et une couleur de fond rappelant sa teinte
export const toppings = [
  // Perles & jellys
  { id: 'tapioca',           nom: 'Perles de tapioca',   groupe: 'Perles & jellys', icone: 'svg-tapioca', couleur: '#e6d8c4', blocableDouble: true },
  { id: 'jelly-litchi',      nom: 'Jelly litchi',        groupe: 'Perles & jellys', icone: 'svg-litchi', couleur: '#f3c5d4' },
  { id: 'jelly-brown-sugar', nom: 'Jelly brown sugar',   groupe: 'Perles & jellys', icone: 'svg-brown-sugar', couleur: '#e8c89a' },
  { id: 'aloe-vera',         nom: 'Aloé vera',           groupe: 'Perles & jellys', icone: 'svg-aloe-vera', couleur: '#d8e8c4' },
  { id: 'graines-basilic',   nom: 'Graines de basilic',  groupe: 'Perles & jellys', icone: '🌱', couleur: '#5a7a4a' },
  // Perles de saveur
  { id: 'perles-mangue',     nom: 'Perles mangue',       groupe: 'Perles de saveur', icone: '🥭', couleur: '#ffb244' },
  { id: 'perles-myrtille',   nom: 'Perles myrtille',     groupe: 'Perles de saveur', icone: '🫐', couleur: '#7c6cc4' },
  { id: 'perles-peche',      nom: 'Perles pêche',        groupe: 'Perles de saveur', icone: 'svg-peche', couleur: '#ffb499' },
  { id: 'perles-cerise',     nom: 'Perles cerise',       groupe: 'Perles de saveur', icone: '🍒', couleur: '#c93e6a' },
  { id: 'perles-fraise',     nom: 'Perles fraise',       groupe: 'Perles de saveur', icone: '🍓', couleur: '#ff8597' },
  { id: 'perles-framboise',  nom: 'Perles framboise',    groupe: 'Perles de saveur', icone: 'svg-framboise', couleur: '#f7c8d3' },
  { id: 'perles-passion',    nom: 'Perles passion',      groupe: 'Perles de saveur', icone: 'svg-passion',   couleur: '#ffe1a8' },
  { id: 'perles-litchi',     nom: 'Perles litchi',       groupe: 'Perles de saveur', icone: 'svg-litchi', couleur: '#f3c5d4' },
];

// === Calcul du prix total d'une boisson personnalisée ===
// toppings = objet { id: portion } où portion vaut 0.5 (demi) ou 1 (entière)
// Pour citronnade : portion vaut toujours 1 (système simple : nb d'unités à 0,50€)
export function calculerPrix({ categorie, saveur, format, toppings = {}, chantilly, laitAvoine }) {
  // Sécurité : le format peut arriver en objet {id,label,...} au lieu de l'id 'S'/'M'/'L'.
  // On normalise pour ne JAMAIS retomber sur prix 0 (= boisson offerte par erreur).
  const fmtId = (format && typeof format === 'object') ? format.id : format;
  let prix = categorie.prix[fmtId] ?? 0;

  if (saveur?.supplement) prix += saveur.supplement;

  // Toppings : total des portions (somme des demi-portions et portions entières)
  const totalPortions = Object.values(toppings).reduce((s, p) => s + p, 0);
  if (categorie.toppingPayantUnit) {
    // Citronnade : aucune portion offerte. 1re portion = 0,50€,
    // passage en double portion = +0,90€ EN PLUS (total 1,40€).
    if (totalPortions > 0) prix += PRIX_TOPPING_CITRONNADE;
    if (totalPortions > PORTIONS_OFFERTES) prix += PRIX_DOUBLE_PORTION;
  } else {
    // Bubble tea : 1 portion offerte, double portion = 0,90€ dès qu'on dépasse
    if (totalPortions > PORTIONS_OFFERTES) prix += PRIX_DOUBLE_PORTION;
  }

  if (chantilly) prix += SUPPLEMENT_CHANTILLY;
  if (laitAvoine) prix += SUPPLEMENT_LAIT_AVOINE;

  return prix;
}

// Total des portions sélectionnées (helper pour l'UI)
export function totalPortions(toppings = {}) {
  return Object.values(toppings).reduce((s, p) => s + p, 0);
}

// === Détail des suppléments payants d'une ligne (pour affichage avec prix) ===
// Renvoie [{ libelle, montant }] : double portion, supplément saveur, chantilly, lait d'avoine…
export function listeSupplements(ligne) {
  const out = [];
  if (ligne?.saveur?.supplement) {
    out.push({ libelle: 'Supplément saveur', montant: ligne.saveur.supplement });
  }
  const tp = totalPortions(ligne?.toppings || {});
  if (ligne?.categorie?.toppingPayantUnit) {
    // Citronnade : 1re portion payante, double portion qui S'AJOUTE au-delà
    if (tp > 0) out.push({ libelle: 'Toppings (1 portion)', montant: PRIX_TOPPING_CITRONNADE });
    if (tp > PORTIONS_OFFERTES) out.push({ libelle: 'Double portion', montant: PRIX_DOUBLE_PORTION });
  } else if (tp > PORTIONS_OFFERTES) {
    out.push({ libelle: 'Double portion', montant: PRIX_DOUBLE_PORTION });
  }
  if (ligne?.chantilly) out.push({ libelle: 'Chantilly', montant: SUPPLEMENT_CHANTILLY });
  if (ligne?.laitAvoine) out.push({ libelle: 'Avoine bio', montant: SUPPLEMENT_LAIT_AVOINE });
  return out;
}

// === Répartition automatique des portions ===
// Chaque topping veut 1 portion pleine ; si le total dépasse le budget
// (1 simple, 2 double) on réduit tout le monde à ½.
//   simple : 1 topping = 1 | 2 toppings = ½ + ½
//   double : 1 = 1 | 2 = 1 + 1 | 3-4 = ½ chacun
export function portionParTopping(nbToppings, doublePortion) {
  if (nbToppings <= 0) return 0;
  const budget = doublePortion ? PORTIONS_AVEC_DOUBLE : PORTIONS_OFFERTES;
  return nbToppings <= budget ? 1 : 0.5;
}
// Nombre max de toppings sélectionnables (½ mini par topping)
export function maxToppings(doublePortion) {
  return (doublePortion ? PORTIONS_AVEC_DOUBLE : PORTIONS_OFFERTES) * 2;
}
// Reconstruit l'objet { id: portion } à partir d'une liste d'ids et du mode
// (utilisé au changement de mode double/simple)
export function repartirToppings(ids, doublePortion) {
  const p = portionParTopping(ids.length, doublePortion);
  const out = {};
  ids.forEach((id) => { out[id] = p; });
  return out;
}
// Ajoute un NOUVEAU topping en remplissant le budget restant, sans toucher aux
// portions déjà choisies. Si le budget est plein, on libère ½ sur le plus gros.
//   ex (double) : tapioca 1½ + tap mangue → mangue ½ (tapioca reste 1½)
export function ajouterTopping(toppings, id, doublePortion) {
  const budget = doublePortion ? PORTIONS_AVEC_DOUBLE : PORTIONS_OFFERTES;
  const reste = budget - totalPortions(toppings);
  const next = { ...toppings };
  if (reste >= 1) {
    next[id] = 1;            // de la place pour une portion pleine
  } else if (reste >= 0.5) {
    next[id] = 0.5;          // juste la place pour une demi-portion
  } else {
    // Budget plein : on prend ½ sur le plus gros topping existant
    const autre = Object.keys(next)
      .sort((a, b) => next[b] - next[a])[0];
    if (autre) {
      next[autre] -= 0.5;
      if (next[autre] <= 0) delete next[autre];
    }
    next[id] = 0.5;
  }
  return next;
}
// Re-tap sur un topping déjà choisi : +½ portion (½→1→1½→2 puis retrait),
// en libérant le ½ nécessaire sur les autres toppings pour tenir dans le budget.
// Permet d'avoir 1½ sur un seul topping (ex: 1½ perles + ½ autre en double).
export function incrementerTopping(toppings, id, doublePortion) {
  const budget = doublePortion ? PORTIONS_AVEC_DOUBLE : PORTIONS_OFFERTES;
  const cur = toppings[id] || 0;
  const nouvelle = cur + 0.5;
  // Au-delà de 2 portions sur un même topping → on le retire (fin du cycle)
  if (nouvelle > PORTIONS_AVEC_DOUBLE) {
    const out = { ...toppings };
    delete out[id];
    return out;
  }
  const next = { ...toppings, [id]: nouvelle };
  // On pioche le ½ manquant sur les autres toppings (les plus gros d'abord)
  let surplus = totalPortions(next) - budget;
  while (surplus > 0) {
    const autre = Object.keys(next)
      .filter((x) => x !== id && next[x] > 0)
      .sort((a, b) => next[b] - next[a])[0];
    if (!autre) break;
    next[autre] -= 0.5;
    if (next[autre] <= 0) delete next[autre];
    surplus -= 0.5;
  }
  // Budget impossible à tenir (ex: simple mode, 1 seul topping) → toggle off
  if (totalPortions(next) > budget) {
    const out = { ...toppings };
    delete out[id];
    return out;
  }
  return next;
}

// === Helpers ===
export const trouverCategorie = (id) => categories.find((c) => c.id === id);
export const trouverSaveur = (categorieId, saveurId) =>
  trouverCategorie(categorieId)?.saveurs.find((s) => s.id === saveurId);
export const trouverTopping = (id) => toppings.find((t) => t.id === id);
export const trouverFormat = (id) => formats.find((f) => f.id === id);
export const trouverSucre = (id) => niveauxSucre.find((s) => s.id === id);

export function getToppingsParGroupe() {
  const map = {};
  toppings.forEach((t) => {
    if (!map[t.groupe]) map[t.groupe] = [];
    map[t.groupe].push(t);
  });
  return map;
}
