// === Date de naissance : format et plancher d'âge, une seule fois ===
// Le contrôle vivait en TROIS copies (inscription, édition de profil, gate des comptes
// Google/Apple) : trois occasions de diverger. Elles s'appuient toutes sur ce module.
//
// PLANCHER À 15 ANS (décision Yoann, 05/08/2026) : c'est le seuil français du
// consentement autonome au traitement des données personnelles (art. 45 loi
// Informatique et Libertés, transposant l'art. 8 RGPD). En dessous, l'accord d'un
// titulaire de l'autorité parentale est requis — que l'appli ne sait pas recueillir.
// Mesuré avant la mise en place : 1 compte sur 46 déclarait 14 ans, avec push actif.
export const AGE_MINIMUM = 15;

export type ResultatNaissance =
  | { ok: true; iso: string }
  | { ok: false; motif: 'format' | 'trop_jeune' };

/** JJ/MM/AAAA → YYYY-MM-DD, avec contrôle de calendrier réel et du plancher d'âge. */
export function analyserNaissance(saisie: string): ResultatNaissance {
  const m = String(saisie).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return { ok: false, motif: 'format' };
  const jour = +m[1], mois = +m[2], annee = +m[3];
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31 || annee < 1900) {
    return { ok: false, motif: 'format' };
  }
  // Date RÉELLE : le 31/02 passe les bornes ci-dessus mais n'existe pas.
  const d = new Date(annee, mois - 1, jour);
  if (d.getFullYear() !== annee || d.getMonth() !== mois - 1 || d.getDate() !== jour) {
    return { ok: false, motif: 'format' };
  }
  if (d.getTime() > Date.now()) return { ok: false, motif: 'format' };

  // Âge révolu, calculé sur le calendrier — pas en millisecondes, qui trébuchent sur
  // les bissextiles et les changements d'heure.
  const today = new Date();
  let age = today.getFullYear() - annee;
  const avantAnniversaire =
    today.getMonth() + 1 < mois || (today.getMonth() + 1 === mois && today.getDate() < jour);
  if (avantAnniversaire) age -= 1;
  if (age < AGE_MINIMUM) return { ok: false, motif: 'trop_jeune' };

  return { ok: true, iso: `${m[3]}-${m[2]}-${m[1]}` };
}

/** Message prêt à afficher pour un refus. */
export function messageNaissance(motif: 'format' | 'trop_jeune'): string {
  return motif === 'trop_jeune'
    ? `Il faut avoir ${AGE_MINIMUM} ans pour créer un compte. Passe en boutique avec un parent, on t'expliquera.`
    : 'Entre une date de naissance valide (JJ/MM/AAAA).';
}
