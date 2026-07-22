// === Menu vitrine Bubble Stop ===
// Source produit : Menu-paysage-B1.pdf (juillet 2026).
// Ce module ne contient aucune logique de commande. Il compose une carte
// consultative stable à partir du catalogue cloud/local, puis applique la
// sélection, les prix et les nouveautés validés sur le menu imprimé.

export type FamilleMenu = {
  id: string;
  catalogueId: string;
  nom: string;
  introduction: string;
  formats: string[];
  prix: Record<string, number>;
  noteTarif?: string;
  photo?: string;
  photoMode?: 'cover' | 'contain';
  heroFond?: string;
};

export const FAMILLES_MENU: FamilleMenu[] = [
  {
    id: 'fruit-tea', catalogueId: 'fruit-tea', nom: 'Fruit Tea',
    introduction: 'Thé, une saveur fruitée et une portion de perles : frais, léger et désaltérant.',
    formats: ['S', 'M', 'L'], prix: { S: 3.5, M: 4.5, L: 5.5 },
  },
  {
    id: 'milk-tea', catalogueId: 'milk-tea', nom: 'Milk Tea',
    introduction: 'Du thé et du lait avec une portion de perles, pour une boisson douce et gourmande.',
    formats: ['S', 'M', 'L'], prix: { S: 4.3, M: 5.3, L: 5.9 },
    noteTarif: 'Lait d’avoine bio : +0,60 €.',
  },
  {
    id: 'thes-du-monde', catalogueId: 'traditional', nom: 'Thés du monde',
    introduction: 'Des thés fraîchement infusés, choisis pour leurs parfums floraux, fruités ou torréfiés.',
    formats: ['S', 'M', 'L'], prix: { S: 3.9, M: 4.7, L: 5.7 },
  },
  {
    id: 'milkshake', catalogueId: 'milkshake', nom: 'Milkshake',
    introduction: 'Du lait, une saveur et une portion de perles dans une boisson glacée très gourmande.',
    formats: ['S', 'M', 'L'], prix: { S: 4.5, M: 5.5, L: 5.9 },
    noteTarif: 'Chantilly : +0,50 €.',
  },
  {
    id: 'milk-tea-matcha', catalogueId: 'milk-tea', nom: 'Milk Tea Matcha',
    introduction: 'Matcha bio, lait et une portion de perles, avec une finition végétale et crémeuse.',
    formats: ['S', 'M', 'L'], prix: { S: 4.3, M: 5.3, L: 5.9 },
    noteTarif: 'Lait d’avoine bio : +0,60 €.', photo: '/img/photos/match.webp',
  },
  {
    id: 'mousses', catalogueId: 'signature', nom: 'Mousses',
    introduction: 'Une mousse de lait épaisse et onctueuse, servie avec une portion de perles.',
    formats: ['M'], prix: { M: 6 }, photo: '/img/photos/mousses-menu.png',
    photoMode: 'contain', heroFond: '#FAF1E4',
  },
  {
    id: 'signatures', catalogueId: 'signature', nom: 'Signatures',
    introduction: 'Les recettes emblématiques Bubble Stop, pensées comme de vrais desserts à boire.',
    formats: [], prix: {}, photo: '/img/photos/creme-brulee-menu.png',
    photoMode: 'contain', heroFond: '#FAF1E4',
    noteTarif: 'Chaque signature est proposée en taille M.',
  },
  {
    id: 'citronnade', catalogueId: 'citronnade', nom: 'Citronnade',
    introduction: 'Du citron fraîchement pressé, de l’eau et du sucre pour une boisson vive et rafraîchissante.',
    formats: ['S', 'M', 'L'], prix: { S: 3.5, M: 4.3, L: 4.9 },
    noteTarif: 'Une portion de perles : +0,50 €.',
  },
];

type SaveurSpec = {
  id: string;
  nom?: string;
  groupe?: string;
  couleur?: string;
  icone?: string;
  froid?: boolean;
  reco?: boolean;
  prixUnitaire?: number;
};

// Les seuls produits ajoutés par rapport à l'ancien menu de l'app.
// Ils doivent rester identifiés « Bientôt disponible » jusqu'à décision de Yoann.
export const IDS_SAVEURS_BIENTOT = new Set([
  'mt-hojicha',
  'mt-matcha-mangue',
  'sg-chai-mousse',
  'sg-hojicha-mousse',
]);

const SAVEURS_PAR_FAMILLE: Record<string, SaveurSpec[]> = {
  'fruit-tea': [
    { id: 'ft-peche', groupe: 'Thé noir' },
    { id: 'ft-framboise', groupe: 'Thé noir' },
    { id: 'ft-myrtille', groupe: 'Thé noir' },
    { id: 'ft-citron', groupe: 'Thé noir' },
    { id: 'ft-hibiscus', groupe: 'Thé noir' },
    { id: 'ft-litchi', groupe: 'Thé vert' },
    { id: 'ft-pasteque', groupe: 'Thé vert' },
    { id: 'ft-mangue', groupe: 'Thé vert' },
    { id: 'ft-passion', groupe: 'Thé vert' },
    { id: 'ft-fraise', groupe: 'Thé vert' },
  ],
  'milk-tea': [
    { id: 'mt-jasmin', groupe: 'Thé vert' },
    { id: 'mt-coco', groupe: 'Thé vert' },
    { id: 'mt-taro', groupe: 'Thé vert' },
    { id: 'mt-taro-coco', groupe: 'Thé vert', nom: 'Taro Coco' },
    { id: 'mt-original', groupe: 'Thé noir' },
    { id: 'mt-brown-sugar', groupe: 'Thé noir', nom: 'Brown Sugar' },
    { id: 'mt-assam', groupe: 'Thé noir' },
    { id: 'mt-malt-vanille', groupe: 'Thé noir' },
    { id: 'mt-vanille', groupe: 'Thé noir' },
    { id: 'mt-fraise', groupe: 'Thé noir', froid: true },
    { id: 'mt-hojicha', groupe: 'Thé noir', nom: 'Hojicha', icone: '🍂', couleur: '#b9865c' },
    { id: 'mt-oolong', groupe: 'Thé noir' },
    { id: 'mt-chocolat', groupe: 'Thé noir' },
    { id: 'mt-rose', groupe: 'Thé noir' },
    { id: 'mt-chai', groupe: 'Thé noir', nom: 'Chai' },
  ],
  'thes-du-monde': [
    { id: 'tr-oolong' },
    { id: 'tr-assam' },
    { id: 'tr-malt-vanille' },
    { id: 'tr-cherry-blossom' },
    { id: 'tr-earl-grey', nom: 'Earl Grey' },
    { id: 'tr-cranberry' },
    { id: 'tr-the-vert-jasmin' },
    { id: 'tr-oolong-peche' },
  ],
  milkshake: [
    { id: 'ms-coco' },
    { id: 'ms-matcha' },
    { id: 'ms-chocolat' },
    { id: 'ms-passion' },
    { id: 'ms-vanille' },
    { id: 'ms-cafe' },
    { id: 'ms-taro' },
    { id: 'ms-fraise' },
  ],
  'milk-tea-matcha': [
    { id: 'mt-matcha', nom: 'Classic', couleur: '#88B066' },
    { id: 'mt-matcha-fraise', nom: 'Fraise', couleur: '#F07A93' },
    { id: 'mt-matcha-vanille', nom: 'Vanille', couleur: '#E8D4B0' },
    { id: 'mt-matcha-mangue', nom: 'Mangue', icone: '🥭', couleur: '#ffb244' },
  ],
  mousses: [
    { id: 'sg-matcha-mousse', nom: 'Matcha Mousse', couleur: '#88B066' },
    { id: 'sg-chai-mousse', nom: 'Chai Mousse', icone: '🍂', couleur: '#C98E56' },
    { id: 'sg-hojicha-mousse', nom: 'Hojicha Mousse', icone: '🍂', couleur: '#b9865c' },
  ],
  signatures: [
    { id: 'sg-creme-brulee', nom: 'Crème Brûlée', prixUnitaire: 6, couleur: '#D4A565' },
    { id: 'sg-tiger', nom: 'Tiger Sugar', prixUnitaire: 5.5, froid: true, couleur: '#A86B32' },
    { id: 'sg-mango-punch', nom: 'Mango Punch', prixUnitaire: 5.5, froid: true, couleur: '#FFB244' },
  ],
  citronnade: [
    { id: 'ci-nature', nom: 'Citronnade' },
  ],
};

// Les descriptions sont indexées par l'identifiant stable du catalogue afin de
// suivre aussi les disponibilités et tarifs reçus depuis catalogue_cloud.
export const DESCRIPTIONS_SAVEURS: Record<string, string> = {
  // Fruit tea
  'ft-litchi': 'Douce et florale, avec le parfum délicat et légèrement sucré du litchi.',
  'ft-peche': 'Ronde et juteuse, une saveur de pêche douce qui accompagne très bien le thé.',
  'ft-citron': 'Vive et acidulée, pour une boisson très fraîche au goût d’agrume.',
  'ft-fraise': 'Fruitée et familière, avec une douceur de fraise facile à apprécier.',
  'ft-hibiscus': 'Florale et légèrement acidulée, avec une personnalité plus intense en bouche.',
  'ft-framboise': 'Un équilibre gourmand entre la douceur du fruit rouge et une pointe acidulée.',
  'ft-pasteque': 'Légère, douce et très désaltérante, idéale pour une boisson estivale.',
  'ft-mangue': 'Ronde, généreuse et exotique, avec une belle sensation de fruit mûr.',
  'ft-passion': 'Exotique et tonique, plus acidulée que la mangue et très aromatique.',
  'ft-myrtille': 'Une saveur de baie douce, profonde et légèrement acidulée.',

  // Milk tea
  'mt-original': 'Le goût classique du thé au lait : doux, rond et bien équilibré.',
  'mt-chai': 'Chaleureux et épicé, avec les notes parfumées typiques du chai.',
  'mt-fraise': 'Un thé au lait doux et fruité, servi froid pour garder toute sa fraîcheur.',
  'mt-oolong': 'Rond et parfumé, avec les notes délicatement grillées du thé oolong.',
  'mt-matcha': 'Le matcha classique : végétal, délicatement amer et adouci par le lait.',
  'mt-taro-coco': 'Une association très douce : le taro apporte la rondeur, la coco une note exotique.',
  'mt-taro': 'Doux, velouté et légèrement biscuité, avec la saveur singulière du taro.',
  'mt-chocolat': 'Intense et réconfortant, comme un chocolat au lait revisité en bubble tea.',
  'mt-vanille': 'Doux et parfumé, une recette crémeuse aux notes de vanille.',
  'mt-coco': 'Crémeux et exotique, avec une saveur de noix de coco tout en rondeur.',
  'mt-assam': 'Plus corsé, avec les notes maltées d’un thé noir Assam adoucies par le lait.',
  'mt-matcha-vanille': 'Le matcha végétal adouci par une note de vanille plus ronde et gourmande.',
  'mt-matcha-fraise': 'Un contraste frais entre le matcha végétal et la douceur fruitée de la fraise.',
  'mt-matcha-mangue': 'Le matcha végétal associé à une mangue ronde et exotique, pour un contraste très fruité.',
  'mt-rose': 'Délicat et floral, avec un parfum de rose présent sans être trop sucré.',
  'mt-brown-sugar': 'Très gourmand, avec des notes profondes de sucre brun et de caramel.',
  'mt-jasmin': 'Fin et floral, le parfum du jasmin apporte beaucoup de légèreté au lait.',
  'mt-malt-vanille': 'Rond et réconfortant, avec des notes de céréales maltées et de vanille.',
  'mt-hojicha': 'Arôme grillé, à la saveur unique, aux notes de noisette et de caramel.',

  // Thés du monde
  'tr-oolong': 'Un thé semi-oxydé rond et aromatique, aux notes légèrement grillées.',
  'tr-earl-grey': 'Un thé noir parfumé à la bergamote, élégant avec une fraîcheur d’agrume.',
  'tr-cranberry': 'Un thé fruité à la cranberry, vif et légèrement acidulé.',
  'tr-malt-vanille': 'Une infusion douce et enveloppante aux notes de malt et de vanille.',
  'tr-cherry-blossom': 'Délicat et floral, inspiré de la fleur de cerisier avec une finale douce.',
  'tr-the-vert-jasmin': 'Un thé vert frais et végétal, relevé par le parfum floral du jasmin.',
  'tr-oolong-peche': 'La rondeur du thé oolong associée à une pêche blanche douce et parfumée.',
  'tr-assam': 'Un thé noir de caractère, corsé et naturellement malté.',

  // Milkshake
  'ms-coco': 'Onctueux et exotique, avec une saveur de noix de coco très douce.',
  'ms-cafe': 'Crémeux et intense, avec une vraie note de café torréfié.',
  'ms-taro': 'Velouté et délicatement biscuité, avec la douceur originale du taro.',
  'ms-passion': 'Gourmand mais tonique, grâce à la pointe acidulée du fruit de la passion.',
  'ms-fraise': 'Un grand classique crémeux, doux et fruité au goût de fraise.',
  'ms-vanille': 'Très doux et rond, avec un parfum de vanille simple et réconfortant.',
  'ms-matcha': 'La texture d’un milkshake avec le goût végétal et légèrement amer du matcha.',
  'ms-chocolat': 'Riche, crémeux et chocolaté, pour la recette la plus dessert de la famille.',

  // Mousses et signatures
  'sg-tiger': 'Du lait entier bio et du Brown Sugar, pour une recette crémeuse aux notes de caramel.',
  'sg-matcha-mousse': 'Le caractère végétal du matcha sous une mousse de lait épaisse, douce et onctueuse.',
  'sg-chai-mousse': 'Les épices chaleureuses du chai sous une mousse de lait épaisse et onctueuse.',
  'sg-hojicha-mousse': 'Le Hojicha grillé, aux notes de noisette et de caramel, surmonté d’une mousse de lait onctueuse.',
  'sg-creme-brulee': 'Un thé noir au lait saveur crème brûlée, avec une crème caramélisée très gourmande.',
  'sg-mango-punch': 'Un thé vert glacé à la mangue, réveillé par du citron frais pressé.',

  // Citronnade
  'ci-nature': 'Des citrons frais pressés et de l’eau pour une boisson franche, vive et rafraîchissante.',
};

function normaliserNomSaveur(valeur: unknown) {
  return String(valeur ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Sésame a été retiré du menu client. Le filtrage par nom ET identifiant
// s'applique aussi aux anciens caches catalogue déjà présents sur les téléphones.
export function saveursVitrine(categorie: any) {
  return (Array.isArray(categorie?.saveurs) ? categorie.saveurs : []).filter((saveur: any) => {
    const nom = normaliserNomSaveur(saveur?.nom);
    const id = normaliserNomSaveur(saveur?.id);
    return nom !== 'sesame' && !id.includes('sesame');
  });
}

export function trouverFamilleMenu(id?: string | string[]) {
  const valeur = Array.isArray(id) ? id[0] : id;
  return FAMILLES_MENU.find((famille) => famille.id === valeur);
}

export function construireCategorieVitrine(categories: any[], familleOuId: FamilleMenu | string) {
  const famille = typeof familleOuId === 'string' ? trouverFamilleMenu(familleOuId) : familleOuId;
  if (!famille) return null;

  const source = (categories ?? []).find((item: any) => item.id === famille.catalogueId) ?? {};
  const sourcesParId = new Map(
    (Array.isArray(source.saveurs) ? source.saveurs : []).map((saveur: any) => [String(saveur.id), saveur]),
  );
  const specs = SAVEURS_PAR_FAMILLE[famille.id] ?? [];
  const saveurs = specs.map((spec) => ({
    icone: '🧋',
    couleur: '#D9C5EA',
    ...(sourcesParId.get(spec.id) as object | undefined),
    ...spec,
    bientot: IDS_SAVEURS_BIENTOT.has(spec.id),
    supplement: undefined,
  }));

  return {
    ...source,
    id: famille.id,
    nom: famille.nom,
    sousTitre: famille.introduction,
    photo: famille.photo ?? source.photo,
    photoMode: famille.photoMode,
    heroFond: famille.heroFond,
    formats: famille.formats,
    prix: famille.prix,
    noteTarif: famille.noteTarif,
    saveurs: saveursVitrine({ saveurs }),
  };
}

export function descriptionSaveur(categorie: any, saveur: any) {
  const description = DESCRIPTIONS_SAVEURS[String(saveur?.id ?? '')]
    ?? (typeof saveur?.description === 'string' ? saveur.description.trim() : '');
  if (description) return description;

  const nomSaveur = String(saveur?.nom ?? 'Cette saveur');
  const nomCategorie = String(categorie?.nom ?? 'cette boisson');
  return `${nomSaveur} est une déclinaison de ${nomCategorie} à découvrir pour son profil aromatique.`;
}
