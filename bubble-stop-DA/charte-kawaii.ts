// === Charte graphique Bubble Stop (app client) — DA « kawaii » ===
// Alignée sur la Charte Graphique Bubble Stop (menus kawaii) :
// violet signature, pastels gourmands, rondeurs généreuses, Fredoka pour les titres.
// Remplace src/constants/charte.ts. Police : npx expo install @expo-google-fonts/fredoka

export const C = {
  // Marque
  violet: '#633E90',        // violet signature (fonds de marque, titres)
  violetProfond: '#452A6E', // ombres, vagues
  violetClair: '#815FAE',   // liens, accents secondaires
  vert: '#9FC038',          // vert boba : actions, tampons, taille S
  vertFonce: '#5C7A1F',
  vertPale: '#EDF6E1',      // pastel « fruitées »
  jaune: '#F2DA33',         // jaune perle : offres, taille M
  jaunePale: '#FBF2E5',     // pastel « lactées »
  rose: '#F7B8D6',          // rose bubble : taille L, badges
  rosePale: '#FDEFF6',      // pastel « toppings »
  roseFonce: '#93325E',     // texte sur rose
  // Surfaces
  fond: '#F7F5FB',
  carte: '#FFFFFF',
  lavande: '#ECE7F6',
  bord: '#F0EBF8',          // bordure 3 px des cartes blanches
  // Textes
  texte: '#443657',
  texte2: '#7D6F95',
  texte3: '#A99FC0',
  surViolet: '#D9C9F0',     // texte secondaire sur fond violet
  blanc: '#FFFFFF',
  // États
  danger: '#C24A6E',
  dangerPale: '#FDEFF6',
  bleu: '#89CFE3',
} as const;

// Polices DA : Fredoka (titres, voix « souriante ») + Outfit (textes).
// Paytone One reste réservée au logo. Toujours la famille exacte par graisse.
export const F = {
  titre: 'Fredoka_600SemiBold',
  logo: 'PaytoneOne_400Regular',
  t400: 'Outfit_400Regular',
  t500: 'Outfit_500Medium',
  t600: 'Outfit_600SemiBold',
  t700: 'Outfit_700Bold',
  t800: 'Outfit_800ExtraBold',
} as const;

// Rayons (rondeurs généreuses)
export const R = { carte: 24, btn: 16, pill: 999 } as const;

// Bordure signature des cartes kawaii : 3 px blanc sur pastel, #F0EBF8 sur blanc.
export const BORD = { largeur: 3, surPastel: '#FFFFFF', surBlanc: '#F0EBF8' } as const;

// Ombre douce commune aux cartes claires
export const OMBRE = {
  shadowColor: '#231142',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

// Ombre des cartes violettes (fidélité, carte membre)
export const OMBRE_VIOLETTE = {
  shadowColor: '#231142',
  shadowOpacity: 0.22,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 5,
} as const;
