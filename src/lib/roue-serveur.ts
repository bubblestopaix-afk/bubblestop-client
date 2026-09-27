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
};

// Aucun tirage ni lecture du cache local : seul le résultat persistant du serveur
// peut fournir un lot. Les anciens lots n'ont pas de métadonnées d'animation.
export function lireEtatRoueServeur(brut: unknown, clientId: string, creation: boolean): EtatRoueServeur {
  const r = brut as Record<string, unknown> | null;
  if (!r || r.ok !== true || typeof r.mois !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(r.mois)) {
    throw new Error('resultat roue invalide');
  }
  if (r.demande === null && !creation) {
    return { mois: r.mois, dejaCreee: false, tirage: null, statut: null };
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
    tirage: {
      mois: r.mois, joueLe: d.created_at, premierId, finalId: segment.id,
      doubleTour: premierId === 'double', code: segment.code!,
      libelle: segment.libelleGain ?? segment.libelle,
    },
  };
}
