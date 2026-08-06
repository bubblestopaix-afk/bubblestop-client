// === Codes des récompenses réelles (module NEUTRE) ===
// Ce type vivait dans `components/jeu/economie.ts`, c'est-à-dire dans Boba Quest. La
// Roue du Mois — un jeu indépendant — devait donc importer un fichier de Quest pour
// réclamer ses propres lots. Retiré ici le 05/08/2026, quand Quest a été désactivé :
// un jeu qu'on éteint ne doit pas emporter les autres avec lui.
//
// Les codes sont ceux de `jeu_recompenses_catalogue` côté serveur. Le client ne
// transmet JAMAIS une quantité libre : il envoie un code, et le serveur y retrouve
// type, valeur et quota avant de créer une demande pour la caisse.
export type CodeRecompenseReelle =
  // La Roue du Mois (origine 'roulette' au catalogue)
  | 'roulette_tampon_1' | 'roulette_tampon_2' | 'roulette_tampon_3'
  | 'roulette_reduction_10' | 'roulette_boisson_l'
  | 'roue_topping' | 'roue_reduction_20'
  // Boba Quest (origines 'quete', 'set', 'collection', 'boutique') — conservés tant que
  // le code de Quest est en place, même désactivé.
  | 'quete_premier_tampon'
  | 'set_milk' | 'set_fruit' | 'set_topping' | 'set_signature'
  | 'collection_complete'
  | 'boutique_tampon_1' | 'boutique_reduction_10' | 'boutique_reduction_20' | 'boutique_boisson_l';
