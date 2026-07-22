// === Photos des catégories (reprises du POS) ===
// require statique exigé par Metro — mapping nom de fichier → asset.
const PHOTOS: Record<string, any> = {
  'tea.webp': require('@/assets/images/photos/tea.webp'),
  'milktea.webp': require('@/assets/images/photos/milktea.webp'),
  'trad.webp': require('@/assets/images/photos/trad.webp'),
  'milkshake.webp': require('@/assets/images/photos/milkshake.webp'),
  'match.webp': require('@/assets/images/photos/match.webp'),
  'citronnade.webp': require('@/assets/images/photos/citronnade.webp'),
  'mousses-menu.png': require('@/assets/images/photos/mousses-menu.png'),
  'creme-brulee-menu.png': require('@/assets/images/photos/creme-brulee-menu.png'),
};

// Retrouve la photo d'une catégorie depuis son chemin POS (/img/photos/tea.webp)
export function photoCategorie(cat: any) {
  const chemin = cat?.photo || cat?.photos?.[0];
  if (!chemin) return null;
  return PHOTOS[String(chemin).split('/').pop() as string] ?? null;
}
