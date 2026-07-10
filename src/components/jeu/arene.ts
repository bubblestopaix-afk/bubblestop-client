// === Boba Quest — L'ARÈNE : moteur de combat (logique PURE, zéro dépendance RN) ===
// Combats tour par tour type Pokémon : équipes de 3 collectibles, chacun avec
// PV / ATQ / VIT et 2 attaques. Triangle des types (= les sets) :
//   🍓 Fruité > 🧋 Milk Tea > ✨ Topping > 🍓 Fruité   (×1,5 / ×0,75)
//   👑 Signature : neutre dans les deux sens, mais des stats de légende.
// Piment : précision (les grosses attaques ratent plus), coups critiques ×1,5,
// attaques de ZONE (toute l'équipe adverse), OBJETS tenus (bonus passifs),
// et champions de TOURNOI hebdomadaire. L'ordre d'action suit la VIT.
// Testé sous Node.

// import RELATIF (même dossier) : permet aussi de tester ce module sous Node
import {
  agregerEffets, objetsDeSlot,
  trouverCollectible, type Emplacement, type EffetObjet, type ObjetId, type Rarete, type SetId,
} from './economie';

export type CoteCombat = 'a' | 'b';
export type TypeAttaque = 'degats' | 'soin' | 'bouclier' | 'boost' | 'etourdit' | 'double' | 'zone';

export type Attaque = { nom: string; type: TypeAttaque; puissance: number };

export type FicheCombat = {
  pv: number; atk: number; vit: number;
  attaques: [Attaque, Attaque];
};

// Indications affichées sous les boutons d'attaque
export const HINT_ATTAQUE: Record<TypeAttaque, string> = {
  degats: 'Dégâts',
  soin: 'Se soigne',
  bouclier: 'Encaisse le prochain coup à moitié',
  boost: '+40 % ATQ pendant 2 tours',
  etourdit: 'Dégâts + peut étourdir',
  double: 'Frappe deux fois',
  zone: 'Touche TOUTE l\'équipe adverse',
};

// Précision / critiques (le piment des duels)
export const PRECISION_BASE = 0.92;    // attaques normales
export const PRECISION_LOURDE = 0.85;  // grosses attaques (puissance ≥ 1,3)
export const PRECISION_ZONE = 0.9;     // vague de zone (par cible)
export const CHANCE_CRITIQUE = 0.12;   // ×1,5 dégâts

// --- Les fiches des 24 combattants --------------------------------------------------

export const FICHES: Record<string, FicheCombat> = {
  // 🧋 Milk Tea (communs)
  boba: { pv: 98, atk: 16, vit: 10, attaques: [{ nom: 'Boulet de tapioca', type: 'degats', puissance: 1 }, { nom: 'Roulade géante', type: 'degats', puissance: 1.35 }] },
  classico: { pv: 92, atk: 16, vit: 12, attaques: [{ nom: 'Gorgée classique', type: 'degats', puissance: 1 }, { nom: 'Recette originale', type: 'boost', puissance: 1 }] },
  theo: { pv: 90, atk: 15, vit: 13, attaques: [{ nom: 'Coup de sachet', type: 'degats', puissance: 1 }, { nom: 'Infusion soporifique', type: 'etourdit', puissance: 0.7 }] },
  lacto: { pv: 96, atk: 15, vit: 11, attaques: [{ nom: 'Éclaboussure', type: 'degats', puissance: 1 }, { nom: 'Bain de lait', type: 'soin', puissance: 1.5 }] },
  paillette: { pv: 86, atk: 15, vit: 15, attaques: [{ nom: 'Pique-paille', type: 'degats', puissance: 1 }, { nom: 'Rafale de pailles', type: 'double', puissance: 0.65 }] },
  sucrette: { pv: 88, atk: 16, vit: 14, attaques: [{ nom: 'Jet de sucre', type: 'degats', puissance: 1 }, { nom: 'Rush de glucose', type: 'boost', puissance: 1 }] },
  // 🍓 Fruités (rares)
  fraisy: { pv: 102, atk: 19, vit: 15, attaques: [{ nom: 'Pépin perçant', type: 'degats', puissance: 1 }, { nom: 'Tourbillon fraise', type: 'double', puissance: 0.65 }] },
  mango: { pv: 108, atk: 20, vit: 12, attaques: [{ nom: 'Tranche tropicale', type: 'degats', puissance: 1 }, { nom: 'Soleil de mangue', type: 'degats', puissance: 1.4 }] },
  litchee: { pv: 104, atk: 18, vit: 14, attaques: [{ nom: 'Coquille dure', type: 'degats', puissance: 1 }, { nom: 'Parfum enivrant', type: 'etourdit', puissance: 0.7 }] },
  passion: { pv: 100, atk: 19, vit: 16, attaques: [{ nom: 'Graines folles', type: 'degats', puissance: 1 }, { nom: 'Cœur de passion', type: 'boost', puissance: 1 }] },
  citro: { pv: 100, atk: 20, vit: 15, attaques: [{ nom: 'Zeste acide', type: 'degats', puissance: 1 }, { nom: 'Pluie acide', type: 'zone', puissance: 0.6 }] },
  pasteka: { pv: 112, atk: 18, vit: 11, attaques: [{ nom: 'Coup de tranche', type: 'degats', puissance: 1 }, { nom: 'Carapace de pastèque', type: 'bouclier', puissance: 1 }] },
  // ✨ Toppings (épiques)
  popping: { pv: 116, atk: 23, vit: 15, attaques: [{ nom: 'Bulle qui claque', type: 'degats', puissance: 1 }, { nom: 'Explosion popping', type: 'zone', puissance: 0.65 }] },
  jelly: { pv: 124, atk: 21, vit: 13, attaques: [{ nom: 'Rebond gélatineux', type: 'degats', puissance: 1 }, { nom: 'Mur de gelée', type: 'bouclier', puissance: 1 }] },
  mochito: { pv: 122, atk: 21, vit: 13, attaques: [{ nom: 'Tape moelleuse', type: 'degats', puissance: 1 }, { nom: 'Câlin mochi', type: 'soin', puissance: 1.5 }] },
  coco: { pv: 120, atk: 22, vit: 14, attaques: [{ nom: 'Noix de coco', type: 'degats', puissance: 1 }, { nom: 'Lait de coco', type: 'soin', puissance: 1.4 }] },
  pudding: { pv: 118, atk: 22, vit: 14, attaques: [{ nom: 'Flan flan', type: 'degats', puissance: 1 }, { nom: 'Caramélisation', type: 'boost', puissance: 1 }] },
  nuage: { pv: 126, atk: 21, vit: 12, attaques: [{ nom: 'Coup de brume', type: 'degats', puissance: 0.95 }, { nom: 'Cocon de chantilly', type: 'soin', puissance: 1.6 }] },
  // 👑 Signatures (légendaires)
  'taro-queen': { pv: 140, atk: 26, vit: 16, attaques: [{ nom: 'Sceptre taro', type: 'degats', puissance: 1.05 }, { nom: 'Décret royal', type: 'degats', puissance: 1.45 }] },
  'matcha-sensei': { pv: 138, atk: 25, vit: 18, attaques: [{ nom: 'Fouet cérémonial', type: 'degats', puissance: 1.05 }, { nom: 'Méditation zen', type: 'etourdit', puissance: 0.75 }] },
  'brown-sugar-king': { pv: 146, atk: 26, vit: 15, attaques: [{ nom: 'Rayure de caramel', type: 'degats', puissance: 1.05 }, { nom: 'Couronne fondante', type: 'boost', puissance: 1 }] },
  'oreo-star': { pv: 136, atk: 26, vit: 17, attaques: [{ nom: 'Éclat de cookie', type: 'degats', puissance: 1.05 }, { nom: 'Pluie d\'étoiles', type: 'zone', puissance: 0.6 }] },
  'caramel-chef': { pv: 142, atk: 25, vit: 15, attaques: [{ nom: 'Louche brûlante', type: 'degats', puissance: 1.05 }, { nom: 'Nappage réparateur', type: 'soin', puissance: 1.5 }] },
  'bubble-master': { pv: 148, atk: 28, vit: 19, attaques: [{ nom: 'Perle suprême', type: 'degats', puissance: 1.1 }, { nom: 'Jugement du Boba', type: 'degats', puissance: 1.55 }] },
};

// --- Types / multiplicateurs ----------------------------------------------------------

// ×1,5 si le set attaquant bat le set défenseur, ×0,75 dans l'autre sens.
export function multType(attaquant: SetId, defenseur: SetId): 1 | 1.5 | 0.75 {
  if (attaquant === 'signature' || defenseur === 'signature' || attaquant === defenseur) return 1;
  const bat: Record<string, string> = { fruit: 'milk', milk: 'topping', topping: 'fruit' };
  if (bat[attaquant] === defenseur) return 1.5;
  if (bat[defenseur] === attaquant) return 0.75;
  return 1;
}

// --- État de combat ---------------------------------------------------------------------

export type Combattant = {
  id: string;
  nom: string;
  set: SetId;
  rarete: Rarete;
  pvMax: number;
  pv: number;
  atk: number;
  vit: number;
  attaques: [Attaque, Attaque];
  objets: ObjetId[];       // objets équipés (jusqu'à 3, un par emplacement)
  eff: EffetObjet;         // effet agrégé des objets + panoplies (pré-calculé)
  bouclier: boolean;       // encaisse le prochain coup à moitié
  boostTours: number;      // +40 % ATQ tant que > 0
  etourdi: boolean;        // passe sa prochaine action
  reviveDispo: boolean;    // 🧿 Grigri : survivra une fois à 1 PV
};

export type EtatCombat = {
  equipes: Record<CoteCombat, Combattant[]>;
  actifs: Record<CoteCombat, number>;
  round: number;
  fini: boolean;
  vainqueur: CoteCombat | null;
};

// Un événement à animer côté UI (l'état du moteur est déjà à jour).
// `index` = position du combattant concerné dans SON équipe (zone → aussi le banc).
export type EvtCombat =
  | { t: 'annonce'; cote: CoteCombat; texte: string }
  | { t: 'degats'; cote: CoteCombat; index: number; valeur: number; efficace: 1 | 1.5 | 0.75; pvApres: number }
  | { t: 'soin'; cote: CoteCombat; index: number; valeur: number; pvApres: number }
  | { t: 'statut'; cote: CoteCombat; texte: string }
  | { t: 'ko'; cote: CoteCombat; index: number; nom: string }
  | { t: 'entree'; cote: CoteCombat; index: number; nom: string }
  | { t: 'fin'; vainqueur: CoteCombat };

export type Rng = () => number;

export function creerCombattant(id: string, echelle = 1, objets: ObjetId[] = []): Combattant {
  const fiche = FICHES[id];
  const meta = trouverCollectible(id);
  if (!fiche || !meta) throw new Error(`fiche de combat manquante : ${id}`);
  // effet agrégé des objets équipés (+ bonus de panoplie) appliqué à la création
  const eff = agregerEffets(objets);
  const atk = Math.round(fiche.atk * echelle * (1 + (eff.atkPct ?? 0) / 100));
  const vit = fiche.vit + (eff.vit ?? 0);
  const pvMax = Math.round(fiche.pv * echelle * (1 + (eff.pvPct ?? 0) / 100));
  return {
    id,
    nom: meta.nom,
    set: meta.set,
    rarete: meta.rarete,
    pvMax,
    pv: pvMax,
    atk,
    vit,
    attaques: fiche.attaques,
    objets,
    eff,
    bouclier: !!eff.bouclierDepart, // Couvercle Renforcé / Royal démarre bouclier levé
    boostTours: 0,
    etourdi: false,
    reviveDispo: !!eff.reviveUneFois,
  };
}

export function creerCombat(
  idsA: string[], idsB: string[], echelleB = 1,
  objetsA: Record<string, ObjetId[]> = {}, objetsB: Record<string, ObjetId[]> = {},
): EtatCombat {
  return {
    equipes: {
      a: idsA.map((id) => creerCombattant(id, 1, objetsA[id] ?? [])),
      b: idsB.map((id) => creerCombattant(id, echelleB, objetsB[id] ?? [])),
    },
    actifs: { a: 0, b: 0 },
    round: 0,
    fini: false,
    vainqueur: null,
  };
}

export function actif(etat: EtatCombat, cote: CoteCombat): Combattant {
  return etat.equipes[cote][etat.actifs[cote]];
}

function adverse(cote: CoteCombat): CoteCombat {
  return cote === 'a' ? 'b' : 'a';
}

// --- IA (côté b, et côté a pour les replays automatiques) --------------------------------

// Choisit une attaque : achève si possible, se soigne si mal en point,
// sinon privilégie la plus grosse attaque (zone valorisée par cible vivante).
export function choisirAttaqueIA(etat: EtatCombat, cote: CoteCombat, rng: Rng): 0 | 1 {
  const moi = actif(etat, cote);
  const lui = actif(etat, adverse(cote));
  const vivantsAdverses = etat.equipes[adverse(cote)].filter((c) => c.pv > 0).length;
  const mult = multType(moi.set, lui.set);
  const estOffensive = (a: Attaque) => a.type === 'degats' || a.type === 'double' || a.type === 'etourdit' || a.type === 'zone';
  const degatsAttendus = (a: Attaque) => {
    if (!estOffensive(a)) return 0;
    if (a.type === 'zone') return moi.atk * a.puissance * vivantsAdverses * 0.9;
    const p = a.type === 'double' ? a.puissance * 2 : a.puissance;
    return moi.atk * p * mult;
  };
  // 1) coup fatal sur l'actif adverse ?
  for (const i of [1, 0] as const) {
    const a = moi.attaques[i];
    if (estOffensive(a) && a.type !== 'zone' && degatsAttendus(a) * 0.9 >= lui.pv) return i;
  }
  // 2) soin si mal en point
  for (const i of [1, 0] as const) {
    if (moi.attaques[i].type === 'soin' && moi.pv < moi.pvMax * 0.38 && rng() < 0.7) return i;
  }
  // 3) un peu d'imprévisible
  if (rng() < 0.2) return rng() < 0.5 ? 0 : 1;
  // 4) sinon : la meilleure option
  const s0 = degatsAttendus(moi.attaques[0]) + (moi.attaques[0].type === 'boost' ? moi.atk * 0.8 : 0);
  const s1 = degatsAttendus(moi.attaques[1]) + (moi.attaques[1].type === 'boost' && moi.boostTours === 0 ? moi.atk * 0.9 : 0)
    + (moi.attaques[1].type === 'bouclier' && !moi.bouclier ? moi.atk * 0.7 : 0);
  return s1 >= s0 ? 1 : 0;
}

// --- Résolution d'un round -----------------------------------------------------------------

// Si l'actif du camp `cote` est KO → fait entrer le suivant (ou termine le combat)
function verifierRemplacement(etat: EtatCombat, cote: CoteCombat, evts: EvtCombat[]) {
  const equipe = etat.equipes[cote];
  if (equipe[etat.actifs[cote]].pv > 0) return;
  const suivant = equipe.findIndex((c) => c.pv > 0);
  if (suivant === -1) {
    etat.fini = true;
    etat.vainqueur = adverse(cote);
    evts.push({ t: 'fin', vainqueur: adverse(cote) });
  } else {
    etat.actifs[cote] = suivant;
    evts.push({ t: 'entree', cote, index: suivant, nom: equipe[suivant].nom });
  }
}

function agir(etat: EtatCombat, cote: CoteCombat, choix: 0 | 1, rng: Rng, evts: EvtCombat[]) {
  const moi = actif(etat, cote);
  const indexMoi = etat.actifs[cote];
  const cible = actif(etat, adverse(cote));
  const indexCible = etat.actifs[adverse(cote)];
  if (moi.pv <= 0 || etat.fini) return;

  if (moi.etourdi) {
    moi.etourdi = false;
    evts.push({ t: 'statut', cote, texte: `${moi.nom} est étourdi et passe son tour ! 💫` });
    return;
  }

  const attaque = moi.attaques[choix];
  evts.push({ t: 'annonce', cote, texte: `${moi.nom} utilise ${attaque.nom} !` });

  const boost = moi.boostTours > 0 ? 1.4 : 1;
  const bonusPrecision = (moi.eff.precisionPct ?? 0) / 100;             // 🎯
  const chanceCrit = CHANCE_CRITIQUE + (moi.eff.critPct ?? 0) / 100;    // 🍀

  // Inflige des dégâts à UNE cible — précision, critique, bouclier, effets d'objets.
  // `estZone` active la réduction Isotherme. Retourne true si la cible est touchée.
  const frapper = (qui: Combattant, indexQui: number, puissance: number, precisionBase: number, estZone = false): boolean => {
    if (rng() > Math.min(1, precisionBase + bonusPrecision)) {
      evts.push({ t: 'statut', cote: adverse(cote), texte: `${qui.nom} esquive l'attaque ! 💨` });
      return false;
    }
    const mult = multType(moi.set, qui.set);
    const crit = rng() < chanceCrit;
    if (crit) evts.push({ t: 'statut', cote, texte: 'Coup critique ! 💥' });
    let degats = Math.round(moi.atk * puissance * mult * boost * (crit ? 1.5 : 1) * (0.9 + rng() * 0.2));
    // 🧊 Isotherme / panoplie Givré : réduit les dégâts de ZONE subis
    if (estZone && qui.eff.reducZonePct) degats = Math.ceil(degats * (1 - qui.eff.reducZonePct / 100));
    if (qui.bouclier && !moi.eff.perceBouclier) {
      degats = Math.ceil(degats / 2);
      qui.bouclier = false;
      evts.push({ t: 'statut', cote: adverse(cote), texte: `Le bouclier de ${qui.nom} encaisse la moitié !` });
    } else if (qui.bouclier && moi.eff.perceBouclier) {
      evts.push({ t: 'statut', cote, texte: `${moi.nom} transperce le bouclier ! ⚡` });
    }
    const avant = qui.pv;
    const inflige = Math.min(avant, degats);
    qui.pv = Math.max(0, avant - degats);
    let revive = false;
    if (qui.pv <= 0 && qui.reviveDispo) { qui.pv = 1; qui.reviveDispo = false; revive = true; } // 🧿 Grigri
    evts.push({ t: 'degats', cote: adverse(cote), index: indexQui, valeur: degats, efficace: mult, pvApres: qui.pv });
    if (revive) evts.push({ t: 'statut', cote: adverse(cote), texte: `${qui.nom} tient bon à 1 PV ! 🧿` });
    else if (qui.pv <= 0) evts.push({ t: 'ko', cote: adverse(cote), index: indexQui, nom: qui.nom });
    // 🩸 vol de vie de l'attaquant (Caramel / panoplie Sucré)
    if (inflige > 0 && moi.eff.volDeViePct && moi.pv > 0) {
      const soin = Math.round(inflige * moi.eff.volDeViePct / 100);
      if (soin > 0) { moi.pv = Math.min(moi.pvMax, moi.pv + soin); evts.push({ t: 'soin', cote, index: indexMoi, valeur: soin, pvApres: moi.pv }); }
    }
    // 🌵 épines : la cible renvoie une partie des dégâts à l'attaquant
    if (inflige > 0 && qui.eff.epinesPct && moi.pv > 0) {
      const retour = Math.round(inflige * qui.eff.epinesPct / 100);
      if (retour > 0) {
        moi.pv = Math.max(0, moi.pv - retour);
        evts.push({ t: 'degats', cote, index: indexMoi, valeur: retour, efficace: 1, pvApres: moi.pv });
        if (moi.pv <= 0) evts.push({ t: 'ko', cote, index: indexMoi, nom: moi.nom });
      }
    }
    return true;
  };

  switch (attaque.type) {
    case 'degats':
      frapper(cible, indexCible, attaque.puissance, attaque.puissance >= 1.3 ? PRECISION_LOURDE : PRECISION_BASE);
      break;
    case 'double':
      frapper(cible, indexCible, attaque.puissance, PRECISION_BASE);
      if (cible.pv > 0) frapper(cible, indexCible, attaque.puissance, PRECISION_BASE);
      break;
    case 'etourdit': {
      const touche = frapper(cible, indexCible, attaque.puissance, PRECISION_BASE);
      if (touche && cible.pv > 0 && rng() < 0.55) {
        if (cible.eff.immuniteEtourdi) evts.push({ t: 'statut', cote: adverse(cote), texte: `${cible.nom} est insensible à l'étourdissement ! ❄️` });
        else { cible.etourdi = true; evts.push({ t: 'statut', cote: adverse(cote), texte: `${cible.nom} est étourdi ! 💫` }); }
      }
      break;
    }
    case 'zone': {
      // 🌊 la vague balaie TOUTE l'équipe adverse (chaque cible esquive/encaisse)
      const equipeAdverse = etat.equipes[adverse(cote)];
      for (let i = 0; i < equipeAdverse.length; i++) {
        const c = equipeAdverse[i];
        if (c.pv > 0) frapper(c, i, attaque.puissance, PRECISION_ZONE, true);
      }
      break;
    }
    case 'soin': {
      const gain = Math.round(moi.atk * attaque.puissance);
      moi.pv = Math.min(moi.pvMax, moi.pv + gain);
      evts.push({ t: 'soin', cote, index: indexMoi, valeur: gain, pvApres: moi.pv });
      break;
    }
    case 'bouclier':
      moi.bouclier = true;
      evts.push({ t: 'statut', cote, texte: `${moi.nom} se protège ! 🛡️` });
      break;
    case 'boost':
      moi.boostTours = 3; // décrémenté à la fin de CETTE action → effectif 2 tours
      evts.push({ t: 'statut', cote, texte: `${moi.nom} monte en puissance ! (+40 % ATQ) 💪` });
      break;
  }
  if (moi.boostTours > 0) moi.boostTours--;

  // 🍯 régénération par tour (Nappé / panoplie Sucré) — appliquée après l'action
  if (moi.eff.soinTour && moi.pv > 0 && moi.pv < moi.pvMax) {
    const soin = moi.eff.soinTour;
    moi.pv = Math.min(moi.pvMax, moi.pv + soin);
    evts.push({ t: 'soin', cote, index: indexMoi, valeur: soin, pvApres: moi.pv });
  }

  // remplacement des deux côtés (zone + épines peuvent faire tomber l'un ou l'autre)
  verifierRemplacement(etat, adverse(cote), evts);
  verifierRemplacement(etat, cote, evts);
}

// Joue un round complet : les deux camps agissent dans l'ordre de VIT.
// `choixA` = attaque du joueur ; le camp b joue à l'IA (ou `choixB` si fourni).
export function jouerRound(etat: EtatCombat, choixA: 0 | 1, rng: Rng = Math.random, choixB?: 0 | 1): EvtCombat[] {
  if (etat.fini) return [];
  const evts: EvtCombat[] = [];
  etat.round++;
  const cb = choixB ?? choisirAttaqueIA(etat, 'b', rng);
  // ⏳ Sablier / panoplie Sucré : agit en premier au 1er round (gros bonus de VIT ponctuel)
  const vitBonus = (c: Combattant) => (etat.round === 1 && c.eff.agitPremier ? 1000 : 0);
  const ca = actif(etat, 'a'); const cbt = actif(etat, 'b');
  const vitA = ca.vit + vitBonus(ca);
  const vitB = cbt.vit + vitBonus(cbt);
  const premier: CoteCombat = vitA === vitB ? (rng() < 0.5 ? 'a' : 'b') : vitA > vitB ? 'a' : 'b';
  const ordre: CoteCombat[] = premier === 'a' ? ['a', 'b'] : ['b', 'a'];
  for (const cote of ordre) {
    if (etat.fini) break;
    agir(etat, cote, cote === 'a' ? choixA : cb, rng, evts);
  }
  return evts;
}

// --- Générateurs déterministes -----------------------------------------------------------

// mulberry32 local (déterminisme sans dépendre du moteur shooter)
function rngGraine(graine: number): Rng {
  let a = graine >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function graineTexte(texte: string, base: number): number {
  let g = base;
  for (let i = 0; i < texte.length; i++) g = (g * 31 + texte.charCodeAt(i)) >>> 0;
  return g;
}

const IDS_PAR_RARETE: Record<Rarete, string[]> = {
  commun: ['boba', 'classico', 'theo', 'lacto', 'paillette', 'sucrette'],
  rare: ['fraisy', 'mango', 'litchee', 'passion', 'citro', 'pasteka'],
  epique: ['popping', 'jelly', 'mochito', 'coco', 'pudding', 'nuage'],
  legendaire: ['taro-queen', 'matcha-sensei', 'brown-sugar-king', 'oreo-star', 'caramel-chef', 'bubble-master'],
};

// Loadout PNJ : jusqu'à `nb` objets sur des emplacements DISTINCTS (jamais 2 pailles).
function loadoutAleatoire(rng: Rng, nb: number): ObjetId[] {
  const slots: Emplacement[] = ['paille', 'couvercle', 'breloque'];
  const choisis: ObjetId[] = [];
  for (const slot of slots) {
    if (choisis.length >= nb) break;
    if (rng() < 0.75) {
      const pool = objetsDeSlot(slot);
      choisis.push(pool[Math.floor(rng() * pool.length)]);
    }
  }
  return choisis;
}

function equipeAleatoire(pool: string[], rng: Rng): string[] {
  const ids: string[] = [];
  while (ids.length < 3) {
    const id = pool[Math.floor(rng() * pool.length)];
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export const NOMS_MAITRES = [
  'Léo du Lait', 'Fifi Fruitée', 'Toto Topping', 'Perla la Perle', 'Sacha Sucre',
  'Maya Matcha', 'Bilal Bulle', 'Karim Caramel', 'Tara Taro', 'Le Grand Boba',
];

export type Adversaire = { nom: string; ids: string[]; echelle: number; objets: Record<string, ObjetId[]> };

// Maître de l'Arène du rang N — déterministe, de plus en plus fort.
// Dès le rang 8, les Maîtres tiennent des OBJETS (comme les bons joueurs).
export function adversairePNJ(rang: number): Adversaire {
  const rng = rngGraine(5000 + rang * 331);
  const pool: string[] = [
    ...IDS_PAR_RARETE.commun,
    ...(rang >= 3 ? IDS_PAR_RARETE.rare : []),
    ...(rang >= 6 ? IDS_PAR_RARETE.epique : []),
    ...(rang >= 10 ? IDS_PAR_RARETE.legendaire : []),
  ];
  const ids = equipeAleatoire(pool, rng);
  const objets: Record<string, ObjetId[]> = {};
  if (rang >= 8) {
    const nb = rang >= 14 ? 3 : rang >= 11 ? 2 : 1; // les Maîtres s'équipent de mieux en mieux
    for (const id of ids) objets[id] = loadoutAleatoire(rng, nb);
  }
  const echelle = Math.round((0.85 + rang * 0.07) * 100) / 100;
  const nom = `${NOMS_MAITRES[(rang - 1) % NOMS_MAITRES.length]} · Rang ${rang}`;
  return { nom, ids, echelle, objets };
}

// Équipe du jour de « Sam » (l'ami simulé des duels preview) — change chaque jour.
export function equipeSam(jour: string): string[] {
  const rng = rngGraine(graineTexte(jour, 77));
  return equipeAleatoire([...IDS_PAR_RARETE.commun, ...IDS_PAR_RARETE.rare, ...IDS_PAR_RARETE.epique], rng);
}

// --- 🏆 Tournoi hebdomadaire (3 étapes, mêmes champions pour tout le monde) ---------------

export const NOMS_CHAMPIONS = [
  ['Kiki Kiwi', 'Nono Nata', 'Lila Litchi', 'Marco Mochi'],           // quarts
  ['Max Matcha', 'La Duchesse Taro', 'Oscar Oolong', 'Prince Pudding'], // demies
  ['LE GRAND BOBA', 'SA MAJESTÉ SUCRE', 'L\'EMPEREUR PERLE'],           // finales
] as const;

// Champion d'une étape (0 = quart, 1 = demie, 2 = FINALE) pour une semaine donnée.
export function adversaireTournoi(semaine: string, etape: number): Adversaire {
  const rng = rngGraine(graineTexte(semaine, 9091 + etape * 517));
  const pools = [
    [...IDS_PAR_RARETE.rare, ...IDS_PAR_RARETE.epique],
    [...IDS_PAR_RARETE.epique, ...IDS_PAR_RARETE.legendaire],
    [...IDS_PAR_RARETE.legendaire, ...IDS_PAR_RARETE.epique.slice(0, 3)],
  ];
  const echelles = [1.0, 1.12, 1.25];
  const ids = equipeAleatoire(pools[Math.min(etape, 2)], rng);
  const objets: Record<string, ObjetId[]> = {};
  if (etape >= 1) {
    const nb = etape === 2 ? 3 : 2;
    for (const id of ids) objets[id] = loadoutAleatoire(rng, nb);
  }
  const noms = NOMS_CHAMPIONS[Math.min(etape, 2)];
  return {
    nom: noms[Math.floor(rng() * noms.length)],
    ids,
    echelle: echelles[Math.min(etape, 2)],
    objets,
  };
}

// Récompenses de l'Arène (équilibrage « Normal »)
export function recompenseRang(rang: number): { perles: number; capsule: 'classique' | 'doree' | null } {
  const perles = Math.min(120 + rang * 30, 450);
  const capsule = rang % 10 === 0 ? 'doree' : rang % 5 === 0 ? 'classique' : null;
  return { perles, capsule };
}
export const PERLES_DEFAITE_ARENE = 20;
export const MISES_DUEL_PAR_JOUR = 3;
