// Fiches publiques rapprochées des adresses le 13/09/2026. Sources dans l'audit.
export const BOUTIQUES_AVIS_GOOGLE = [
  { magasin: 'aix', nom: 'Aix-en-Provence', placeId: 'ChIJRZe6J72NyRIROG8EKm4FZhI' },
  { magasin: 'lyon', nom: 'Lyon', placeId: 'ChIJif8QNwnr9EcRyMFB4tdVdJo' },
  { magasin: 'toulouse', nom: 'Toulouse', placeId: 'ChIJXWQyZRS9rhIRqiyfNgCvnpw' },
] as const;

export type MagasinAvisGoogle = (typeof BOUTIQUES_AVIS_GOOGLE)[number]['magasin'];

/** La destination dépend exclusivement du choix explicite du client. */
export function destinationAvisGoogle(choix: unknown) {
  if (typeof choix !== 'string') return null;
  const boutique = BOUTIQUES_AVIS_GOOGLE.find((b) => b.magasin === choix.trim().toLowerCase());
  if (!boutique) return null;
  return { magasin: boutique.magasin, nom: boutique.nom,
    url: `https://search.google.com/local/writereview?placeid=${boutique.placeId}` };
}
