export type Anniversaire =
  | { statut: 'incomplet' }
  | { statut: 'conditions'; boissons: number; prochainAnniversaire: string }
  | { statut: 'disponible'; expireLe: string };

export const CONDITION_ANNIVERSAIRE = 'Une boisson L offerte pour ton anniversaire (M pour Signature), dès 5 boissons payées avec ta carte fidélité pendant les 12 mois précédents. Cadeaux et tampons bonus exclus. À utiliser sous 30 jours.';

export function lireAnniversaire(value: unknown): Anniversaire | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const date = (d: unknown): d is string => typeof d === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(`${d}T12:00:00Z`)) && new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d;
  if (v.statut === 'incomplet') return { statut: 'incomplet' };
  if (v.statut === 'disponible' && date(v.expireLe)) return { statut: 'disponible', expireLe: v.expireLe };
  if (v.statut === 'conditions' && date(v.prochainAnniversaire)
      && Number.isInteger(v.boissons) && Number(v.boissons) >= 0 && Number(v.boissons) <= 5) {
    return { statut: 'conditions', boissons: Number(v.boissons), prochainAnniversaire: v.prochainAnniversaire };
  }
  return null;
}

// Cache borné au compte, en mémoire seulement. Un changement de compte invalide
// aussi une réponse encore en vol. Pas de timer, de stockage persistant ni d'Edge.
export function creerLectureAnniversaire(lire: () => Promise<unknown>, maintenant = Date.now) {
  let compte: string | null = null;
  let generation = 0;
  let cache: Anniversaire | null = null;
  let luLe = 0;
  let enCours: Promise<Anniversaire | null> | null = null;
  function changer(id: string | null) {
    if (compte === id) return;
    compte = id; generation++; cache = null; luLe = 0; enCours = null;
  }
  async function charger(id: string, forcer = false) {
    changer(id);
    if (enCours) return enCours;
    if (!forcer && cache && maintenant() - luLe < 300000) return cache;
    const g = generation;
    enCours = (async () => {
      try {
        const valeur = lireAnniversaire(await lire());
        if (g !== generation) return null;
        if (!valeur) throw new Error('anniversaire-indisponible');
        cache = valeur; luLe = maintenant(); return valeur;
      } catch (error) {
        if (g === generation) { cache = null; luLe = 0; }
        throw error;
      } finally { if (g === generation) enCours = null; }
    })();
    return enCours;
  }
  return { charger, changer };
}

export function dateCadeau(date: string) {
  const [annee, mois, jour] = date.split('-');
  return `${jour}/${mois}/${annee}`;
}
