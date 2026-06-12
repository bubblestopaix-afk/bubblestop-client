// === Charte graphique Bubble Stop (app client) ===
// Design clair type "app food pro" : fond lavande très léger, cartes blanches,
// violet profond pour les titres, vert pour les actions, jaune pour les offres.

export const C = {
  // Marque
  violet: '#3A2A5E',
  violetProfond: '#2A1D46',
  violetClair: '#54418A',
  vert: '#A3C724',
  vertFonce: '#7E9B12',
  vertPale: '#F3FADC',
  jaune: '#FFD166',
  jaunePale: '#FFF3D6',
  // Surfaces
  fond: '#F6F4FA',
  carte: '#FFFFFF',
  lavande: '#EFE9F6',
  bord: '#E7E1F2',
  // Textes
  texte: '#2A1D46',
  texte2: '#6E6580',
  texte3: '#9A8FB5',
  blanc: '#FFFFFF',
  // États
  danger: '#C75450',
  dangerPale: '#FBEAEA',
  bleu: '#7EC8E3',
} as const;

// Polices DA : Paytone One (titres) + Outfit (textes).
// On référence TOUJOURS la famille exacte par graisse (pas de fontWeight,
// qui casse le rendu Android avec les polices custom).
export const F = {
  titre: 'PaytoneOne_400Regular',
  t400: 'Outfit_400Regular',
  t600: 'Outfit_600SemiBold',
  t700: 'Outfit_700Bold',
  t800: 'Outfit_800ExtraBold',
} as const;

// Rayons
export const R = { carte: 20, btn: 14, pill: 999 } as const;

// Ombre douce commune aux cartes
export const OMBRE = {
  shadowColor: '#3A2A5E',
  shadowOpacity: 0.07,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 5 },
  elevation: 3,
} as const;
