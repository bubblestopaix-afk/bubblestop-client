import { SEGMENTS_ROUE } from '../components/roue/roue';

export type TirageStocke = {
  mois: string;
  joueLe: string;
  premierId: string;
  finalId: string;
  doubleTour: boolean;
  code: string;
  libelle: string;
};

export type EtatRoueServeur = {
  mois: string;
  dejaCreee: boolean;
  tirage: TirageStocke | null;
  statut: 'en_attente' | 'appliquee' | 'refusee' | null;
  eligibilite: { autorisee: boolean; disponibleLe: string; scanRequis: boolean } | null;
};

export function messageEligibiliteRoue(conditions: EtatRoueServeur['eligibilite']): string | null {
  if (!conditions || conditions.autorisee) return null;
  const date = new Date(conditions.disponibleLe);
  const attente = date.getTime() > Date.now();
  const quand = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  if (attente && conditions.scanRequis) return `Ta roue sera disponible dès le ${quand}, après un premier scan de ta carte en boutique.`;
  // 31/10/2026 : plus de délai après l'inscription côté serveur ; branche gardée si une date future revenait.
  if (attente) return `Ta roue sera disponible dès le ${quand}.`;
  return 'Pour débloquer ta roue, fais scanner ta carte de fidélité en boutique. Aucun achat nécessaire.';
}

// Aucun tirage ni lecture du cache local : seul le résultat persistant du serveur
// peut fournir un lot. Les anciens lots n'ont pas de métadonnées d'animation.
export function lireEtatRoueServeur(brut: unknown, clientId: string, creation: boolean): EtatRoueServeur {
  const r = brut as Record<string, unknown> | null;
  if (!r || r.ok !== true || typeof r.mois !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(r.mois)) {
    throw new Error('resultat roue invalide');
  }
  if (r.demande === null && !creation) {
    const e = r.eligibilite as Record<string, unknown> | null;
    if (!e || typeof e.autorisee !== 'boolean' || typeof e.scan_requis !== 'boolean'
        || typeof e.disponible_le !== 'string' || !Number.isFinite(Date.parse(e.disponible_le))
        || (e.autorisee && e.scan_requis)) throw new Error('conditions roue invalides');
    return { mois: r.mois, dejaCreee: false, tirage: null, statut: null,
      eligibilite: { autorisee: e.autorisee, disponibleLe: e.disponible_le, scanRequis: e.scan_requis } };
  }
  const d = r.demande as Record<string, unknown> | null;
  const segment = SEGMENTS_ROUE.find((s) => s.code !== null && s.code === d?.code);
  if (!d || d.client_id !== clientId || d.origine !== 'roulette' || !segment
      || typeof d.created_at !== 'string' || !Number.isFinite(Date.parse(d.created_at))
      || !['en_attente', 'appliquee', 'refusee'].includes(String(d.statut))) {
    throw new Error('resultat roue invalide');
  }
  const premierId = d.roue_premier_id ?? segment.id;
  if (premierId !== 'double' && premierId !== segment.id) throw new Error('resultat roue invalide');
  return {
    mois: r.mois,
    dejaCreee: r.deja_creee === true,
    statut: d.statut as EtatRoueServeur['statut'],
    eligibilite: null,
    tirage: {
      mois: r.mois, joueLe: d.created_at, premierId, finalId: segment.id,
      doubleTour: premierId === 'double', code: segment.code!,
      libelle: segment.libelleGain ?? segment.libelle,
    },
  };
}
