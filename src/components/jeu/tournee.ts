// === Boba Quest — 🗺️ TOURNÉE DES MAÎTRES : run roguelite hebdomadaire (logique PURE) ===
// Duels enchaînés à difficulté croissante, 100 % local. Chaque semaine, TOUTES les
// tournées sont identiques (adversaires + drafts déterministes, seedés par semaine).
// Les PV se REPORTENT d'un duel à l'autre (une carte K.O. reste K.O. pour la run —
// seul un bonus de soin peut la relever à 30 %). Une défaite = fin de run.
// Testé sous Node.

import {
  CHARGE_MAX, creerCombattant, GARDE_MAITRISEE, GARDE_REDUCTION, NOMS_MAITRES, poserStatut,
  type Adversaire, type EtatCombat,
} from './arene';
import {
  cleSemaine, coutEquipe, multOutsider, objetsDeSlot,
  type EffetTalent, type Emplacement, type ObjetId,
} from './economie';

// --- Générateurs déterministes (mulberry32 local, zéro dépendance) ------------------

function rngGraine(graine: number): () => number {
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

const IDS_COMMUN = ['boba', 'classico', 'theo', 'lacto', 'paillette', 'sucrette'];
const IDS_RARE = ['fraisy', 'mango', 'litchee', 'passion', 'citro', 'pasteka'];
const IDS_EPIQUE = ['popping', 'jelly', 'mochito', 'coco', 'pudding', 'nuage'];
const IDS_LEGENDAIRE = ['taro-queen', 'matcha-sensei', 'brown-sugar-king', 'oreo-star', 'caramel-chef', 'bubble-master'];

function equipeAleatoire(pool: string[], rng: () => number): string[] {
  const ids: string[] = [];
  while (ids.length < 3) {
    const id = pool[Math.floor(rng() * pool.length)];
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

// --- 🎁 Bonus de run : draft de 3 parmi 10 après chaque victoire (cumulables) -------

export type BonusRunId =
  | 'the-revigorant'    // soigne 30 % PV max de toute l'équipe (relève les K.O. à 30 %)
  | 'sirop-atk'         // +15 % ATQ
  | 'perle-geante'      // +15 % PV max
  | 'recharge-spe'      // +1 munition spé
  | 'shaker-chaud'      // +1 charge Signature au départ
  | 'poignet-sur'       // la Garde de toute l'équipe est MAÎTRISÉE (GARDE_MAITRISEE)
  | 'the-energisant'    // +3 VIT
  | 'marque-ouverture'  // la 1ère action qui touche pose la marque de famille
  | 'paille-vampire'    // vol de vie 10 %
  | 'glacon-ouverture'; // bouclier au départ

export type BonusRun = { nom: string; emoji: string; desc: string };

export const BONUS_RUN: Record<BonusRunId, BonusRun> = {
  'the-revigorant': { nom: 'Thé Revigorant', emoji: '🍵', desc: 'Soigne 30 % des PV max de toute l’équipe — relève même les cartes K.O. à 30 %' },
  'sirop-atk': { nom: 'Sirop d’ATQ', emoji: '🍯', desc: '+15 % d’ATQ pour toute l’équipe' },
  'perle-geante': { nom: 'Perle Géante', emoji: '🧋', desc: '+15 % de PV max pour toute l’équipe' },
  'recharge-spe': { nom: 'Recharge Spé', emoji: '🔋', desc: '+1 munition de spé pour toute l’équipe' },
  'shaker-chaud': { nom: 'Shaker Chaud', emoji: '🥤', desc: '+1 charge Signature au départ pour toute l’équipe' },
  // 🛡️ 27/07 — le libellé est DÉRIVÉ des constantes du moteur : impossible qu'il redevienne
  // faux sans que le moteur change avec lui (cf. le bloc `poignet-sur` d'appliquerBonusRun).
  'poignet-sur': {
    nom: 'Poignet Sûr', emoji: '🛡️',
    desc: `La Garde de toute l’équipe bloque −${Math.round(GARDE_MAITRISEE * 100)} % au lieu de −${Math.round(GARDE_REDUCTION * 100)} %`,
  },
  'the-energisant': { nom: 'Thé Énergisant', emoji: '⚡', desc: '+3 VIT pour toute l’équipe' },
  'marque-ouverture': { nom: 'Marque d’Ouverture', emoji: '🏷️', desc: 'La 1ère action qui touche pose la marque de famille' },
  'paille-vampire': { nom: 'Paille Vampire', emoji: '🧛', desc: 'Vol de vie 10 % pour toute l’équipe' },
  'glacon-ouverture': { nom: 'Glaçon d’Ouverture', emoji: '🧊', desc: 'Toute l’équipe entre au combat avec un bouclier' },
};
export const BONUS_RUN_IDS = Object.keys(BONUS_RUN) as BonusRunId[];

// --- 🏅 Paliers hebdomadaires : victoires CUMULÉES de la semaine (toutes runs), ------
// réclamés UNE fois par semaine chacun (cleSemaine, reset lazy comme le Boba Pass).
export const TOURNEE_PALIERS: { victoires: number; type: 'perles' | 'capsule' | 'capsule_doree'; qte: number; label: string }[] = [
  { victoires: 3, type: 'perles', qte: 250, label: '250 perles' },
  { victoires: 6, type: 'capsule', qte: 1, label: 'Capsule classique' },
  { victoires: 9, type: 'capsule_doree', qte: 1, label: 'Capsule DORÉE' },
];

// --- 💰 Récompense d'une victoire d'étape (passée par perlesEvenement → les -----------
// multiplicateurs d'événement/série s'appliquent, mais PAS multSerieVictoires, réservé
// à l'Arène : le sommet de la Tournée reste structurellement 38 % sous celui de l'Arène).
//
// LE DIAGNOSTIC, MESURÉ. `60 + 20×étape` donnait 80 à 160 perles par combat. Rapporté au
// vrai coût du mode, c'est le tarif le plus bas du jeu. Mesuré sur 200 runs par profil
// (8 semaines × 25 runs, harnais hors dépôt) :
//   · 3 rares nv4 / 2 épiques + 1 commun nv7 → MÉDIANE de 2 victoires par run
//   · compte maximal (nv10 + objets légendaires) → médiane 9, p90 11
// Une run médiane = 2 victoires puis une défaite, soit 3 combats pour 180 perles :
// 60 perles par combat. Le MÊME joueur, dans l'Arène, encaisse 0,83×700 + 0,17×45 = 589
// perles par combat au rang 22. La Tournée payait donc 9,8 fois moins que l'Arène pour
// des combats de durée comparable — et pour un mode où la défaite efface la run.
//
// D'OÙ VIENT LE RISQUE (mesuré, pas supposé). En rejouant les mêmes runs SANS le report
// des PV d'une étape à l'autre, la profondeur atteinte explose :
//   profil nv4  : 1,81 → 5,26 victoires   (−65 % de profondeur imputable au report)
//   profil nv7  : 1,93 → 14,65 victoires  (−87 %)
//   compte max  : 9,09 → 33,00 victoires  (−72 %)
// Le report des PV est donc À LUI SEUL le risque du mode : le joueur enchaîne 3, 9, 12
// duels sur UNE barre de vie. S'y ajoute que les équipes adverses de Tournée ne sont PAS
// bornées par BUDGET_EQUIPE (coût mesuré 8 à 10 dès l'étape 8, contre 7 maximum pour le
// joueur, et ≤ 7 pour les Maîtres d'Arène) : la Tournée est le seul mode où l'adversaire
// joue hors budget.
//
// LA COURBE RETENUE. Le risque est nul à l'étape 1 (barre de vie pleine, échelle 1,07,
// rien à perdre) et devient total en profondeur. La prime doit donc suivre la PROFONDEUR,
// pas le mode. D'où un terme de risque CUMULATIF qui vaut exactement 0 à l'étape 1 :
//   perles(e) = BASE + PAR_ETAPE × e + RISQUE × Σ(étapes déjà franchies, plafonnées)
// Conséquences voulues :
//   · l'étape 1 reste à 80 perles, AU PERLE PRÈS. C'est le garde-fou anti-farm n°1 du jeu :
//     gagner l'étape 1 puis abandonner est répétable à l'infini (abandonnerTournee ne coûte
//     rien), donc ce nombre est le plancher de revenu de TOUT le jeu. Il ne bouge pas.
//   · pousser bat toujours recommencer : l'étape 2 vaut 130 contre 80 pour un reset, et
//     l'écart se creuse à chaque étape (la courbe est strictement convexe). AVANT, la marge
//     n'était que de 20 perles (100 contre 80) : le rejeu et la nouveauté se valaient.
//   · l'escalade se FIGE après TOURNEE_RISQUE_PALIER étapes franchies. Sans ce palier, une
//     run profonde devenait la meilleure ferme du jeu : mesuré, une run de 12 victoires
//     rapporterait 12 420 perles (955/combat) sans palier, contre 9 810 (755/combat) avec —
//     soit sous le plafond d'une victoire d'Arène au rang 30 (950). Règle tenue : la Tournée
//     rattrape l'Arène, elle ne la dépasse jamais au combat.
export const TOURNEE_PERLES_BASE = 60;        // inchangé
export const TOURNEE_PERLES_PAR_ETAPE = 20;   // inchangé
// 30 perles de prime supplémentaire par étape déjà franchie. Calibré sur la mesure : il
// amène la run médiane du compte maximal (9 victoires, donc 10 combats) à 4 920 perles,
// soit 492 perles par combat — 84 % du tarif de l'Arène pour le même joueur (589). En
// dessous de 30 la Tournée reste le parent pauvre ; au-dessus (testé à 40) la run de 12
// victoires dépasse le plafond d'une victoire d'Arène et le mode devient la ferme optimale.
export const TOURNEE_PERLES_RISQUE = 30;
// L'escalade cesse de s'accélérer après 6 étapes franchies. 6 est la profondeur où la
// survie du compte maximal commence à décrocher (mesuré : 99 % à l'étape 6, 83 % à la 8,
// 39 % à la 10, 7 % à la 12) : au-delà, la rareté fait déjà le travail de rationnement,
// et laisser l'escalade courir ne ferait que gonfler le jackpot d'une run exceptionnelle.
export const TOURNEE_RISQUE_PALIER = 6;

// Somme des étapes DÉJÀ franchies, chacune plafonnée au palier. Vaut 0 à l'étape 1 (aucune
// étape franchie = aucun risque pris = aucune prime), d'où le plancher anti-farm intact.
function cumulRisque(etape: number): number {
  const franchies = Math.max(0, etape - 1);
  const p = TOURNEE_RISQUE_PALIER;
  if (franchies <= p) return (franchies * (franchies + 1)) / 2;
  return (p * (p + 1)) / 2 + (franchies - p) * p;
}

// 🛡️ 27/07 — MÊME TROU QUE `recompenseRang`, MÊME CORRECTIF (cf. arene.ts).
// `Math.max(1, NaN)` vaut NaN : une étape non numérique — et `run.etape` est un champ
// PERSISTÉ, donc déjà vu sale en migration — ressortait en NaN et contaminait le solde
// de perles pour de bon. On coerce (une "3" persistée reste l'étape 3), puis on refuse
// le non fini avec le même repli que les étapes sales numériques : l'étape 1.
export function perlesVictoireTournee(etape: number): number {
  const brut = Number(etape);
  const e = Number.isFinite(brut) ? Math.max(1, Math.round(brut)) : 1;
  return TOURNEE_PERLES_BASE + TOURNEE_PERLES_PAR_ETAPE * e + TOURNEE_PERLES_RISQUE * cumulRisque(e);
}

// 🍵 Le Thé Revigorant relève une carte K.O. à 30 % de ses PV max (comportement voulu).
export const TOURNEE_SOIN_PCT = 0.3;

// --- État de run (persisté dans le store, champ ADDITIF `tournee`) ------------------

export type RunTournee = {
  semaine: string;                     // semaine ISO de la tournée (adversaires FIGÉS même à cheval sur 2 semaines)
  etape: number;                       // prochain duel à jouer (1..)
  victoires: number;                   // duels gagnés dans CETTE run (= le score)
  bonus: BonusRunId[];                 // bonus de run choisis (cumulés)
  pvReportes: Record<string, number>;  // PV absolus reportés par carte (0 = K.O. pour la run ; absent = pleine forme)
  draftEnAttente: boolean;             // une victoire vient d'être faite, le choix de bonus attend
};

export type SuiviTournee = {
  semaine: string;            // semaine du suivi hebdo (paliers + compteur)
  victoiresSemaine: number;   // victoires cumulées de la semaine, toutes runs
  reclames: number[];         // index des paliers hebdo déjà réclamés
  record: number;             // meilleure série de victoires enchaînées (à vie)
  run: RunTournee | null;     // run en cours (persistée : reprise après fermeture)
};

export const TOURNEE_VIERGE: SuiviTournee = { semaine: '', victoiresSemaine: 0, reclames: [], record: 0, run: null };

// Nouvelle run : étape 1, aucun bonus, toute l'équipe en pleine forme.
export function creerRun(semaine: string): RunTournee {
  return { semaine, etape: 1, victoires: 0, bonus: [], pvReportes: {}, draftEnAttente: false };
}

// Adversaire d'une étape : équipe DÉTERMINISTE (seed semaine+étape — tous les joueurs
// affrontent la même tournée chaque semaine). Échelle 1,0 + 0,07×étape ; pools de
// rareté progressifs comme l'Arène (communes → +rares étape 3 → +épiques étape 6 →
// +légendaires étape 10) ; objets tenus dès l'étape 8 (comme les Maîtres de rang 8+).
export function adversaireTournee(semaine: string, etape: number): Adversaire {
  const e = Math.max(1, Math.round(etape));
  const rng = rngGraine(graineTexte(`${semaine}|tournee|${e}`, 6060));
  const pool: string[] = [
    ...IDS_COMMUN,
    ...(e >= 3 ? IDS_RARE : []),
    ...(e >= 6 ? IDS_EPIQUE : []),
    ...(e >= 10 ? IDS_LEGENDAIRE : []),
  ];
  const ids = equipeAleatoire(pool, rng);
  const objets: Record<string, ObjetId[]> = {};
  if (e >= 8) {
    const nb = e >= 14 ? 3 : e >= 11 ? 2 : 1;
    for (const id of ids) {
      const choisis: ObjetId[] = [];
      for (const slot of ['paille', 'couvercle', 'breloque'] as Emplacement[]) {
        if (choisis.length >= nb) break;
        if (rng() < 0.75) {
          const p = objetsDeSlot(slot);
          choisis.push(p[Math.floor(rng() * p.length)]);
        }
      }
      objets[id] = choisis;
    }
  }
  const echelle = Math.round((1.0 + 0.07 * e) * 100) / 100;
  const nom = `${NOMS_MAITRES[(e - 1) % NOMS_MAITRES.length]} · Duel ${e}`;
  return { nom, ids, echelle, objets };
}

// Draft post-victoire : 3 bonus DISTINCTS parmi ceux pas encore pris, déterministes
// (seed run+étape — rejouer la même run propose les mêmes cartes).
export function draftBonusRun(run: RunTournee): BonusRunId[] {
  const dispo = BONUS_RUN_IDS.filter((id) => !run.bonus.includes(id));
  const rng = rngGraine(graineTexte(`${run.semaine}|draft|${run.etape}|${run.bonus.length}`, 9182));
  const tires: BonusRunId[] = [];
  while (tires.length < 3 && dispo.length) {
    tires.push(dispo.splice(Math.floor(rng() * dispo.length), 1)[0]);
  }
  return tires;
}

// Applique les bonus de run à un COMBAT FRAIS (côté joueur uniquement).
// « the-revigorant » n'agit pas ici : il soigne la RUN (pvReportes) au moment du draft.
// À appeler AVANT appliquerPvReportes (les PV reportés sont clampés aux nouveaux PV max).
// 🔧 REFONTE 26/07 (LOT A) — le bouclier de départ passe désormais par le système de
// statuts générique (`poserStatut`) au lieu du champ ad hoc `c.bouclier`, qui n'existe
// plus sur `Combattant`.
// 🛡️ 27/07 — « Poignet Sûr » ne touche plus au cooldown de Garde (il était devenu inerte,
// cf. le commentaire de son `case`) : il renforce la Garde elle-même via `garde_maitrisee`.
export function appliquerBonusRun(etat: EtatCombat, bonus: BonusRunId[]): void {
  for (const c of etat.equipes.a) {
    for (const b of bonus) {
      switch (b) {
        case 'sirop-atk': c.atk = Math.round(c.atk * 1.15); break;
        case 'perle-geante': c.pvMax = Math.round(c.pvMax * 1.15); c.pv = c.pvMax; break;
        case 'recharge-spe': c.speRestantes += 1; break;
        case 'shaker-chaud': c.charge = Math.min(CHARGE_MAX, c.charge + 1); break;
        // 🛡️ 27/07 — CE BONUS NE FAISAIT PLUS STRICTEMENT RIEN. Il baissait
        // `gardeCooldownBase`, mais le cooldown est décrémenté en TÊTE du round suivant :
        // un cooldown posé `P` rend la Garde au round N+P, donc `P = 1` autoriserait DEUX
        // Gardes d'affilée (invariant à préserver, plancher `GARDE_COOLDOWN_MIN` dans
        // arene.ts). Or `GARDE_COOLDOWN = 1` (§A9) donne DÉJÀ `P = 2`, la cadence la plus
        // serrée que l'invariant permette : mesuré `G.G.G.G.` avec ET sans le bonus. §A9 a
        // donné à tout le monde ce que ce bonus offrait — il n'avait plus aucune marge.
        // On garde son ESPRIT (la Garde, la défense) en changeant son axe : au lieu de
        // garder PLUS SOUVENT, on garde MIEUX. Aucune règle nouvelle, aucune logique
        // parallèle : on réutilise le talent existant `garde_maitrisee`, seul point d'entrée
        // de `appliquerGarde` pour une Garde de base renforcée (−55 % au lieu de −45 % ; la
        // parade PARFAITE et l'anti-Signature, figées par §A9, restent meilleures et
        // inchangées). L'invariant « jamais deux Gardes d'affilée » n'est pas touché : le
        // cooldown ne bouge plus du tout.
        case 'poignet-sur':
          if (!(c.talents ?? []).includes('garde_maitrisee')) c.talents = [...(c.talents ?? []), 'garde_maitrisee'];
          break;
        case 'the-energisant': c.vit += 3; break;
        case 'marque-ouverture': c.marqueOuvertureDispo = true; break;
        case 'paille-vampire': c.eff = { ...c.eff, volDeViePct: (c.eff.volDeViePct ?? 0) + 10 }; break;
        case 'glacon-ouverture': poserStatut(c, 'bouclier', -1); break;
        case 'the-revigorant': break; // soin de run, pas un effet de combat
      }
    }
  }
}

// PV max de l'équipe d'Arène du joueur TELLE QU'EN COMBAT (niveaux + talents + objets
// + bonus outsider), pour les soins de run et l'affichage du lobby. Helper PUR.
// 👅 `gouts` (E4) est un paramètre FINAL et OPTIONNEL : sans lui, comportement inchangé.
// Il doit être fourni dès que les rangs de Goût sont câblés, sinon les PV max de run
// seraient inférieurs aux PV max réels du combat et le report écrêterait les cartes.
export function pvMaxEquipeRun(
  ids: string[],
  objets: Record<string, ObjetId[]>,
  niveaux: Record<string, number>,
  talents: Record<string, EffetTalent[]>,
  gouts: Record<string, number> = {},
): Record<string, number> {
  const m = multOutsider(coutEquipe(ids));
  const res: Record<string, number> = {};
  for (const id of ids) {
    const c = creerCombattant(id, 1, objets[id] ?? [], niveaux[id] ?? 1, talents[id] ?? [], gouts[id] ?? 0);
    res[id] = Math.round(c.pvMax * m);
  }
  return res;
}

// 🍵 Soin de run (Thé Revigorant) : +pct des PV max à TOUTE l'équipe. Une carte K.O.
// (PV ≤ 0) est RELEVÉE à exactement pct×pvMax — c'est le seul moyen de ressusciter.
// Une carte absente de pvReportes est en pleine forme (plafonnée à pvMax).
export function soignerRun(pvReportes: Record<string, number>, pvMax: Record<string, number>, pct = TOURNEE_SOIN_PCT): Record<string, number> {
  const res: Record<string, number> = {};
  for (const id of Object.keys(pvMax)) {
    const gain = Math.max(1, Math.round(pvMax[id] * pct));
    const actuel = pvReportes[id] ?? pvMax[id];
    res[id] = actuel <= 0 ? gain : Math.min(pvMax[id], actuel + gain);
  }
  return res;
}

// Reporte les PV d'un duel sur le combat frais suivant : PV clampés [0, pvMax],
// carte absente = pleine forme. L'actif passe au premier combattant debout (les
// cartes K.O. restent K.O.). Cas limite défensif : équipe entièrement K.O. = défaite.
export function appliquerPvReportes(etat: EtatCombat, pvReportes: Record<string, number>): void {
  for (const c of etat.equipes.a) {
    c.pv = Math.max(0, Math.min(c.pvMax, Math.round(pvReportes[c.id] ?? c.pvMax)));
  }
  if (etat.equipes.a[etat.actifs.a].pv <= 0) {
    const i = etat.equipes.a.findIndex((c) => c.pv > 0);
    if (i >= 0) etat.actifs.a = i;
    else { etat.fini = true; etat.vainqueur = 'b'; }
  }
}

// Victoire : étape +1, PV reportés tels qu'à la fin du duel, draft ouvert. PUR.
export function runApresVictoire(run: RunTournee, pvRestants: Record<string, number>): RunTournee {
  return {
    ...run,
    etape: run.etape + 1,
    victoires: run.victoires + 1,
    pvReportes: { ...pvRestants },
    draftEnAttente: true,
  };
}

// Choix d'un bonus au draft : cumulé, draft refermé (l'étape ne change pas). PUR.
export function runApresBonus(run: RunTournee, id: BonusRunId): RunTournee {
  return { ...run, bonus: [...run.bonus, id], draftEnAttente: false };
}

// Fin de run (défaite ou abandon) : le record ne peut que monter. PUR.
export function finirRun(suivi: SuiviTournee): { suivi: SuiviTournee; score: number; nouveau: boolean } {
  const score = suivi.run?.victoires ?? 0;
  const nouveau = score > suivi.record;
  return {
    suivi: { ...suivi, record: Math.max(suivi.record, score), run: null },
    score,
    nouveau,
  };
}

// Normalise le champ `tournee` d'une sauvegarde (PUR, testé) : tolère l'absence,
// les runs partielles et les valeurs sales ; jamais de purge du record.
export function migrerTournee(brut: unknown): SuiviTournee {
  const res: SuiviTournee = { ...TOURNEE_VIERGE, reclames: [] };
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return res;
  const s = brut as Record<string, unknown>;
  res.semaine = typeof s.semaine === 'string' ? s.semaine : '';
  res.victoiresSemaine = Math.max(0, Math.floor(Number(s.victoiresSemaine) || 0));
  res.reclames = Array.isArray(s.reclames)
    ? s.reclames.filter((x): x is number => typeof x === 'number' && x >= 0 && x < TOURNEE_PALIERS.length)
    : [];
  res.record = Math.max(0, Math.floor(Number(s.record) || 0));
  const r = s.run;
  if (r && typeof r === 'object' && !Array.isArray(r)) {
    const run = r as Record<string, unknown>;
    const pv: Record<string, number> = {};
    if (run.pvReportes && typeof run.pvReportes === 'object') {
      for (const [id, v] of Object.entries(run.pvReportes as Record<string, unknown>)) {
        const n = Number(v);
        if (Number.isFinite(n)) pv[id] = Math.max(0, Math.round(n));
      }
    }
    res.run = {
      semaine: typeof run.semaine === 'string' && run.semaine ? run.semaine : cleSemaine(),
      etape: Math.max(1, Math.floor(Number(run.etape) || 1)),
      victoires: Math.max(0, Math.floor(Number(run.victoires) || 0)),
      bonus: Array.isArray(run.bonus)
        ? (run.bonus.filter((x): x is BonusRunId => typeof x === 'string' && BONUS_RUN_IDS.includes(x as BonusRunId)))
        : [],
      pvReportes: pv,
      draftEnAttente: run.draftEnAttente === true,
    };
  }
  return res;
}
