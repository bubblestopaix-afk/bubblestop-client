import { magasinOffresDepuisProfil } from './offres';

// Fiches publiques rapprochées des adresses le 13/09/2026. Sources dans l'audit.
const BOUTIQUES = {
  aix: { nom: 'Aix-en-Provence', placeId: 'ChIJRZe6J72NyRIROG8EKm4FZhI' },
  lyon: { nom: 'Lyon', placeId: 'ChIJif8QNwnr9EcRyMFB4tdVdJo' },
  toulouse: { nom: 'Toulouse', placeId: 'ChIJXWQyZRS9rhIRqiyfNgCvnpw' },
} as const;

export function destinationAvisGoogle(profil: { dernier_magasin_scan?: string | null } | null) {
  const magasin = magasinOffresDepuisProfil(profil);
  if (!magasin || !(magasin in BOUTIQUES)) return null;
  const boutique = BOUTIQUES[magasin as keyof typeof BOUTIQUES];
  return { magasin, nom: boutique.nom,
    url: `https://search.google.com/local/writereview?placeid=${boutique.placeId}` };
}

/** Lecture au clic, sans poll ni repli sur une boutique d'origine. */
export async function lireDestinationAvisGoogle(deps: {
  lireCompte: () => Promise<string | null>;
  lireProfil: (compte: string) => Promise<{ dernier_magasin_scan?: string | null } | null>;
}) {
  const compte = await deps.lireCompte();
  if (!compte) throw new Error('Connecte-toi pour retrouver la boutique de ton dernier scan.');
  const profil = await deps.lireProfil(compte);
  // Une déconnexion ou un changement de compte pendant la lecture invalide la réponse.
  if (await deps.lireCompte() !== compte) throw new Error('Ton compte a changé. Réessaie depuis ton compte actuel.');
  const destination = destinationAvisGoogle(profil);
  if (!destination) throw new Error('Scanne ta carte de fidélité en boutique pour retrouver le bon magasin.');
  return destination;
}
