// === Offres programmées / récurrentes ===
// Une offre peut être limitée à des JOURS de la semaine (0=dim … 6=sam), une plage
// HORAIRE ('16:00' → '18:00') et une PÉRIODE (date_debut/date_fin). Sans réglage,
// elle se comporte comme avant (permanente tant qu'elle est active).
// La MÊME logique est portée côté POS (bandeau « Offre en cours », EcranCaisse.jsx)
// et côté edge agent-bubblestop (push auto) — garder les trois en phase.

export type Offre = {
  id: string;
  titre: string;
  message: string;
  active: boolean;
  created_at?: string;
  envoyee_le?: string | null;
  nb_push?: number | null;
  jours?: number[] | null;        // 0=dimanche … 6=samedi
  heure_debut?: string | null;    // 'HH:MM'
  heure_fin?: string | null;      // 'HH:MM'
  date_debut?: string | null;     // 'YYYY-MM-DD'
  date_fin?: string | null;
  push_auto?: boolean | null;
  dernier_push_auto?: string | null;
  // Contenu structuré : remise appliquée AUTOMATIQUEMENT par la caisse (≥ POS 0.28.138)
  // Les avantages structurés sont réservés aux commandes avec fidélité scannée.
  // 'tampons' (≥ POS 0.28.159) : PAS une remise en € — chaque boisson payée crédite
  // remise_valeur tampons (×2, ×3…), borne + caisse, cumulés pour la prochaine visite.
  remise_type?: 'pourcent' | 'montant' | 'tampons' | null; // −% | −€/boisson | tampons ×N
  remise_valeur?: number | null;
  cible_categories?: string[] | null;          // ids catégories POS (fruit-tea…) ; null = toute la carte (ignoré pour 'tampons')
  // Périmètre boutiques (04/08/2026). Absent/vide = promo valable partout.
  magasins?: string[] | null;
};

export const MAGASINS_OFFRE = ['aix', 'lyon', 'toulouse'] as const;

// === Périmètre BOUTIQUES d'une promo — correctif du 05/08/2026 ===
// Une promo peut être restreinte à certaines boutiques (colonne `magasins`).
// Les caisses respectaient déjà ce périmètre (tpv-api impose le filtre) et la
// notification aussi (promos-api cible `profils.magasin`), mais l'AFFICHAGE dans
// l'appli l'ignorait complètement : une promo réservée à une boutique s'affichait
// à TOUS les membres (signalé par Yoann). Deux conséquences : le client croit y
// avoir droit, et la caisse de sa boutique refuse — promesse non tenue.
// On ferme donc ici, en FAIL-CLOSED : sans boutique connue (visiteur non connecté,
// profil sans magasin), seules les promos valables dans les TROIS boutiques
// s'affichent. Mieux vaut ne pas montrer une promo que d'en montrer une inapplicable.
export function offreVisiblePour(o: Offre, magasinClient?: string | null): boolean {
  const vises = Array.isArray(o?.magasins)
    ? o.magasins.map((m) => String(m).toLowerCase().trim()).filter(Boolean)
    : [];
  if (!vises.length) return true;                                    // aucun périmètre = partout
  if (MAGASINS_OFFRE.every((m) => vises.includes(m))) return true;    // les 3 = tout le monde
  const mien = String(magasinClient || '').toLowerCase().trim();
  return !!mien && vises.includes(mien);
}

const minutes = (hhmm?: string | null): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v < 24 * 60 ? v : null;
};

// L'offre est-elle EN COURS à l'instant t ? (t = heure locale de l'appareil — France)
export function offreEnCours(o: Offre, t: Date = new Date()): boolean {
  if (!o?.active) return false;
  const ymd = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  if (o.date_debut && ymd < o.date_debut) return false;
  if (o.date_fin && ymd > o.date_fin) return false;
  if (Array.isArray(o.jours) && o.jours.length > 0 && !o.jours.includes(t.getDay())) return false;
  const debut = minutes(o.heure_debut);
  const fin = minutes(o.heure_fin);
  const mnt = t.getHours() * 60 + t.getMinutes();
  if (debut != null && mnt < debut) return false;
  if (fin != null && mnt >= fin) return false;
  return true;
}

// L'offre a-t-elle une programmation (récurrence / fenêtre) ?
export function offreProgrammee(o: Offre): boolean {
  return Boolean((Array.isArray(o.jours) && o.jours.length > 0) || o.heure_debut || o.heure_fin || o.date_debut || o.date_fin);
}

const NOMS_JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

// Résumé lisible pour l'admin : « lun · 16:00–18:00 · jusqu'au 31/08 »
export function resumeRecurrence(o: Offre): string {
  const parts: string[] = [];
  if (Array.isArray(o.jours) && o.jours.length > 0 && o.jours.length < 7) {
    // Ordre français lun→dim
    const ordre = [1, 2, 3, 4, 5, 6, 0].filter((j) => o.jours!.includes(j));
    parts.push(ordre.map((j) => NOMS_JOURS[j]).join(' '));
  }
  if (o.heure_debut || o.heure_fin) parts.push(`${o.heure_debut || '00:00'}–${o.heure_fin || '24:00'}`);
  const frDate = (d: string) => d.split('-').reverse().slice(0, 2).join('/');
  if (o.date_debut && o.date_fin) parts.push(`du ${frDate(o.date_debut)} au ${frDate(o.date_fin)}`);
  else if (o.date_debut) parts.push(`dès le ${frDate(o.date_debut)}`);
  else if (o.date_fin) parts.push(`jusqu'au ${frDate(o.date_fin)}`);
  return parts.join(' · ');
}
