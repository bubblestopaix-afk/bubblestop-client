// Helpers pour appliquer les overrides admin au catalogue de base
// (utilisable côté client React)

// Applique les overrides à une catégorie (sans muter l'objet d'origine)
function appliquerOverrideCategorie(cat, override) {
  if (!override) return { ...cat };
  const nouvelle = { ...cat };
  // Prix surchargé (par format)
  if (override.prix) {
    nouvelle.prix = { ...cat.prix, ...override.prix };
  }
  // Flags admin
  if (override.horsStock) nouvelle.horsStock = true;
  if (override.masquee) nouvelle.masquee = true;
  // Taux de TVA spécifique à la catégorie (sinon le défaut config s'applique au calcul)
  if (override.tvaTaux !== undefined && override.tvaTaux !== null) {
    nouvelle.tvaTaux = Number(override.tvaTaux);
  }
  return nouvelle;
}

// Applique les overrides à une saveur
function appliquerOverrideSaveur(saveur, override) {
  if (!override) return { ...saveur };
  const nouvelle = { ...saveur };
  if (override.horsStock) nouvelle.horsStock = true;
  if (override.masquee) nouvelle.masquee = true;
  // Supplément peut être override (utile pour saveurs custom ou ajustement prix)
  if (override.supplement !== undefined && override.supplement !== null) {
    nouvelle.supplement = Number(override.supplement) || 0;
  }
  return nouvelle;
}

// Applique les overrides à un topping
function appliquerOverrideTopping(topping, override) {
  if (!override) return { ...topping };
  const nouveau = { ...topping };
  if (override.horsStock) nouveau.horsStock = true;
  if (override.masquee) nouveau.masquee = true;
  if (override.doublePortionBloquee) nouveau.doublePortionBloquee = true;
  return nouveau;
}

/**
 * Construit le catalogue effectif (= catalogue de base + overrides admin)
 * @param {object} catalogueBase - { categories, toppings }
 * @param {object} overrides - { categories, saveurs, toppings, saveursAjoutees }
 * @param {object} options - { masquerHorsCarte: bool } : si true, filtre les éléments masqués
 * @returns {object} { categories, toppings } avec horsStock/masquee marqués
 */
export function appliquerOverrides(catalogueBase, overrides, { masquerHorsCarte = true } = {}) {
  const ov = overrides || { categories: {}, saveurs: {}, toppings: {}, saveursAjoutees: [] };

  // Catégories
  const categories = catalogueBase.categories.map((cat) => {
    const catOverridee = appliquerOverrideCategorie(cat, ov.categories[cat.id]);
    // Saveurs (de base + ajoutées rattachées à cette catégorie)
    const saveursAjoutees = (ov.saveursAjoutees || []).filter((s) => s.categorieId === cat.id);
    const toutesSaveurs = [...cat.saveurs, ...saveursAjoutees];
    const saveurs = toutesSaveurs
      .map((s) => appliquerOverrideSaveur(s, ov.saveurs[s.id]))
      .filter((s) => !(masquerHorsCarte && s.masquee));
    return { ...catOverridee, saveurs };
  }).filter((cat) => !(masquerHorsCarte && cat.masquee));

  // Toppings
  const toppings = catalogueBase.toppings
    .map((t) => appliquerOverrideTopping(t, ov.toppings[t.id]))
    .filter((t) => !(masquerHorsCarte && t.masquee));

  return { categories, toppings };
}

// Indique si un élément est commandable (pas hors stock, pas masqué)
export function estDisponible(item) {
  return !item.horsStock && !item.masquee;
}
