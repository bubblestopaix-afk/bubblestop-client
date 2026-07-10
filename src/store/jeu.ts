// === Boba Quest — état global du jeu (léger, persisté sur le téléphone) ===
// Même pattern que le panier : useSyncExternalStore + AsyncStorage.
// ⚠️ PREVIEW : tout est local. En version finale, les PRIX RÉELS (tampons,
// réductions, boissons) partiront côté serveur (fidelite_demandes appliquées
// par la caisse) avec plafonds anti-triche — voir AGENTS.md.
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  BONUS_DEFIS_CAPSULES, BONUS_PREMIERE_PARTIE, BOUTIQUE, CAPSULES, cleJour,
  cleMois, cleSemaine, Collectible, collectiblesDuSet, Defi, DOUBLON_PERLES,
  EffetBuddy, effetBuddy, evenementDuJour, Gain, labelPrix, MesureDefi,
  NIVEAU_DIV_ECHEC, NIVEAU_DIV_REJOUER, NIVEAU_DIV_SCORE, NIVEAU_PERLES_PAR_ETOILE,
  ObjetId, OBJETS, PASS_PALIERS, PASS_XP, perlesPourScore, PITY_EPIQUE,
  PITY_LEGENDAIRE, POWERUPS, PowerupId, RARETES, RECOMPENSE_COLLECTION,
  Emplacement, CAPSULE_OBJET, ECLATS_DOUBLON, ECLATS_FORGE, tirerObjet, PITY_OBJET_EPIQUE,
  SegmentRoulette, SETS, SetId, tirageDefisDuJour, tirerCapsule, tirerCapsuleMin,
  tirerRoulette, TOURNOI_CONSOLATION, TOURNOI_RECOMPENSES, trouverCollectible,
  TypeCapsule, COLLECTIBLES,
} from '@/components/jeu/economie';
import {
  MISES_DUEL_PAR_JOUR, PERLES_DEFAITE_ARENE, recompenseRang,
} from '@/components/jeu/arene';

// Statistiques d'une partie (défis du jour) — fournies par l'écran shooter
export type StatsPartie = {
  score: number;
  eclatees: number;         // perles éclatées
  orphelines: number;       // perles tombées
  capsulesLiberees: number;
  meilleurGroupe: number;
  chaineMax: number;
};

type StatsJour = {
  jour: string;
  niveauxTermines: number;
  eclatees: number;
  orphelines: number;
  meilleurScorePartie: number;
  capsulesLiberees: number;
  meilleurGroupe: number;
  chaineMax: number;
  parties: number;
  duelsMises: number;   // duels AVEC mise lancés aujourd'hui (limite anti-farm)
};

export type EtatBobaQuest = {
  perles: number;
  collection: Record<string, number>;   // id collectible → nb possédés
  gains: Gain[];                        // prix réels gagnés (à réclamer)
  capsulesGratuites: number;            // capsules classiques gagnées (niveaux, défis)
  capsulesDoreesGratuites: number;      // boss + roulette
  powerups: Record<PowerupId, number>;  // munitions spéciales en stock
  aventure: {
    niveauMax: number;                  // prochain niveau jouable
    etoiles: Record<string, number>;    // niveau → 1..3
  };
  arene: {
    rang: number;                       // prochain Maître à battre (démarre à 1)
    equipe: string[];                   // ids des 3 combattants choisis
    victoires: number;
    defaites: number;
  };
  objets: Partial<Record<ObjetId, boolean>>;              // objets possédés (débloqués)
  portes: Record<string, Partial<Record<Emplacement, ObjetId>>>; // collectibleId → objet par emplacement
  eclats: number;                                         // 🔹 éclats d'objet (forge)
  pityObjet: number;                                      // Capsules Objet depuis le dernier épique+
  tournoi: {
    semaine: string;                    // 'YYYY-Sxx' de la dernière participation
    etape: number;                      // 0..2 = prochaine étape, 3 = champion
    elimine: boolean;                   // sorti cette semaine
    trophees: number;                   // titres de champion (à vie)
  };
  pity: { epique: number; legendaire: number }; // capsules depuis le dernier drop
  pass: {                                // 🎫 Boba Pass hebdomadaire
    semaine: string;
    xp: number;
    reclames: number[];                  // index des paliers déjà réclamés
  };
  buddyId: string | null;               // « copain de tir » équipé (bonus passif)
  statsJour: StatsJour;
  defisReclames: string[];              // ids réclamés AUJOURD'HUI
  defisBonusReclame: boolean;           // bonus capsule du jour réclamé
  meilleurScore: number;                // record du mode infini
  partiesJouees: number;
  capsulesOuvertes: number;
  dernierJourJoue: string | null;       // bonus 1ʳᵉ partie du jour
  derniereRouletteMois: string | null;  // 'YYYY-MM'
  dernierGainRoulette: string | null;
  setsReclames: SetId[];
  collectionReclamee: boolean;
};

const STATS_JOUR_VIERGES = (jour: string): StatsJour => ({
  jour, niveauxTermines: 0, eclatees: 0, orphelines: 0, meilleurScorePartie: 0,
  capsulesLiberees: 0, meilleurGroupe: 0, chaineMax: 0, parties: 0, duelsMises: 0,
});

const DEFAUT: EtatBobaQuest = {
  perles: 0,
  collection: {},
  gains: [],
  capsulesGratuites: 0,
  capsulesDoreesGratuites: 0,
  powerups: { bombe: 0, arc: 0 },
  aventure: { niveauMax: 1, etoiles: {} },
  arene: { rang: 1, equipe: [], victoires: 0, defaites: 0 },
  objets: {},
  portes: {},
  eclats: 0,
  pityObjet: 0,
  tournoi: { semaine: '', etape: 0, elimine: false, trophees: 0 },
  pity: { epique: 0, legendaire: 0 },
  pass: { semaine: '', xp: 0, reclames: [] },
  buddyId: null,
  statsJour: STATS_JOUR_VIERGES(''),
  defisReclames: [],
  defisBonusReclame: false,
  meilleurScore: 0,
  partiesJouees: 0,
  capsulesOuvertes: 0,
  dernierJourJoue: null,
  derniereRouletteMois: null,
  dernierGainRoulette: null,
  setsReclames: [],
  collectionReclamee: false,
};

// Migre l'ancien format d'objets tenus (collectibleId → ObjetId unique) vers le
// nouveau (collectibleId → { emplacement → ObjetId }). Ignore les objets inconnus.
function migrerPortes(brut: unknown): Record<string, Partial<Record<Emplacement, ObjetId>>> {
  const res: Record<string, Partial<Record<Emplacement, ObjetId>>> = {};
  if (!brut || typeof brut !== 'object') return res;
  for (const [cid, val] of Object.entries(brut as Record<string, unknown>)) {
    if (typeof val === 'string') {
      const def = OBJETS[val as ObjetId];
      if (def) res[cid] = { [def.slot]: val as ObjetId };
    } else if (val && typeof val === 'object') {
      const slots: Partial<Record<Emplacement, ObjetId>> = {};
      for (const [slot, oid] of Object.entries(val as Record<string, unknown>)) {
        if (typeof oid === 'string' && OBJETS[oid as ObjetId]) slots[slot as Emplacement] = oid as ObjetId;
      }
      res[cid] = slots;
    }
  }
  return res;
}

let etat: EtatBobaQuest = JSON.parse(JSON.stringify(DEFAUT));
const listeners = new Set<() => void>();

// Restaure la sauvegarde au premier import du module
AsyncStorage.getItem('bobaQuest.etat')
  .then((brut) => {
    if (!brut) return;
    try {
      const sauve = JSON.parse(brut);
      if (sauve && typeof sauve === 'object') {
        etat = {
          ...JSON.parse(JSON.stringify(DEFAUT)),
          ...sauve,
          powerups: { ...DEFAUT.powerups, ...(sauve.powerups || {}) },
          aventure: { ...DEFAUT.aventure, ...(sauve.aventure || {}) },
          arene: { ...DEFAUT.arene, ...(sauve.arene || {}) },
          objets: { ...(sauve.objets || {}) },
          portes: migrerPortes(sauve.portes),
          tournoi: { ...DEFAUT.tournoi, ...(sauve.tournoi || {}) },
          pity: { ...DEFAUT.pity, ...(sauve.pity || {}) },
          pass: { ...DEFAUT.pass, ...(sauve.pass || {}) },
          statsJour: { ...STATS_JOUR_VIERGES(''), ...(sauve.statsJour || {}) },
        };
        listeners.forEach((l) => l());
      }
    } catch { /* sauvegarde illisible → on repart de zéro */ }
  })
  .catch(() => {});

function emit() {
  etat = { ...etat };
  listeners.forEach((l) => l());
  AsyncStorage.setItem('bobaQuest.etat', JSON.stringify(etat)).catch(() => {});
}

export function useBobaQuest(): EtatBobaQuest {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => etat,
  );
}

// Les stats & défis repartent de zéro chaque jour (vérifié paresseusement)
function assurerJour() {
  const jour = cleJour();
  if (etat.statsJour.jour !== jour) {
    etat.statsJour = STATS_JOUR_VIERGES(jour);
    etat.defisReclames = [];
    etat.defisBonusReclame = false;
  }
}

// Le Boba Pass repart de zéro chaque lundi (XP + paliers réclamés)
function assurerSemainePass() {
  const semaine = cleSemaine();
  if (etat.pass.semaine !== semaine) {
    etat.pass = { semaine, xp: 0, reclames: [] };
  }
}

// Multiplicateur d'événement du jour (×2 le week-end) appliqué à TOUS les gains de perles
function perlesEvenement(montant: number): number {
  return Math.round(montant * evenementDuJour().multiplicateur);
}

// Crédite de l'XP au Boba Pass (n'affecte pas les perles). Appelé partout où le
// joueur « fait quelque chose » : niveaux, défis, combats, capsules…
function gagnerXpPass(xp: number) {
  assurerSemainePass();
  etat.pass = { ...etat.pass, xp: etat.pass.xp + xp };
}

// --- Helpers lecture -----------------------------------------------------------

export function nbUniques(e: EtatBobaQuest = etat): number {
  return COLLECTIBLES.filter((c) => (e.collection[c.id] || 0) > 0).length;
}

export function setComplet(set: SetId, e: EtatBobaQuest = etat): boolean {
  return collectiblesDuSet(set).every((c) => (e.collection[c.id] || 0) > 0);
}

export function collectionComplete(e: EtatBobaQuest = etat): boolean {
  return nbUniques(e) === COLLECTIBLES.length;
}

export function bonusJourDispo(e: EtatBobaQuest = etat): boolean {
  return e.dernierJourJoue !== cleJour();
}

export function rouletteDispo(e: EtatBobaQuest = etat): boolean {
  return e.derniereRouletteMois !== cleMois();
}

// Capsules avant la prochaine garantie (pity) — pour l'affichage « encore X avant… »
export function pityRestant(e: EtatBobaQuest = etat): { epique: number; legendaire: number } {
  return {
    epique: Math.max(0, PITY_EPIQUE - e.pity.epique),
    legendaire: Math.max(0, PITY_LEGENDAIRE - e.pity.legendaire),
  };
}

export function etoilesDuNiveau(niveau: number, e: EtatBobaQuest = etat): number {
  return e.aventure.etoiles[String(niveau)] || 0;
}

// Effet du « copain de tir » équipé (bonus passif du shooter)
const EFFET_NEUTRE: EffetBuddy = { tirsBonus: 0, perlesPct: 0, remisePct: 0, graceChaine: 0, libelle: '' };
export function effetBuddyActuel(e: EtatBobaQuest = etat): EffetBuddy {
  if (!e.buddyId || (e.collection[e.buddyId] || 0) < 1) return EFFET_NEUTRE;
  const c = trouverCollectible(e.buddyId);
  return c ? effetBuddy(c.set, c.rarete) : EFFET_NEUTRE;
}

// Prix d'une perle spéciale, remise du copain de tir Topping comprise
export function coutPowerupActuel(id: PowerupId, e: EtatBobaQuest = etat): number {
  const remise = effetBuddyActuel(e).remisePct;
  return Math.round(POWERUPS[id].cout * (1 - remise / 100));
}

// Défis du jour, avec progression et statut de réclamation
export type DefiDuJour = Defi & { progres: number; fait: boolean; reclame: boolean };
export function defisDuJour(e: EtatBobaQuest = etat): DefiDuJour[] {
  const jour = cleJour();
  const stats = e.statsJour.jour === jour ? e.statsJour : STATS_JOUR_VIERGES(jour);
  const reclames = e.statsJour.jour === jour ? e.defisReclames : [];
  return tirageDefisDuJour(jour).map((d) => {
    const progres = Math.min(d.cible, stats[d.mesure as MesureDefi] || 0);
    return { ...d, progres, fait: progres >= d.cible, reclame: reclames.includes(d.id) };
  });
}

// --- Fins de partie ----------------------------------------------------------------

function nouveauGain(type: Gain['type'], qte: number, origine: Gain['origine'], label?: string): Gain {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type, qte,
    label: label || labelPrix(type, qte),
    origine,
    gagneLe: new Date().toISOString(),
    statut: 'a_reclamer',
  };
}

function majStatsPartie(stats: StatsPartie) {
  assurerJour();
  const s = etat.statsJour;
  s.eclatees += stats.eclatees;
  s.orphelines += stats.orphelines;
  s.capsulesLiberees += stats.capsulesLiberees;
  s.meilleurScorePartie = Math.max(s.meilleurScorePartie, stats.score);
  s.meilleurGroupe = Math.max(s.meilleurGroupe, stats.meilleurGroupe);
  s.chaineMax = Math.max(s.chaineMax, stats.chaineMax);
  s.parties += 1;
  etat.partiesJouees += 1;
}

// Le bonus ×2 s'applique à la PREMIÈRE partie du jour (tous modes confondus),
// PUIS l'événement du jour (week-end ×2) sur le tout.
function appliquerBonusJour(perles: number): { perles: number; bonusJour: boolean } {
  const bonus = bonusJourDispo();
  etat.dernierJourJoue = cleJour();
  const avecBonus = bonus ? perles * BONUS_PREMIERE_PARTIE : perles;
  return { perles: perlesEvenement(avecBonus), bonusJour: bonus };
}

// Mode INFINI : perles selon le score (plafonnées), record — AUCUNE capsule.
export function finPartieInfini(stats: StatsPartie): {
  perlesGagnees: number; bonusJour: boolean; record: boolean;
} {
  majStatsPartie(stats);
  const base = Math.round(perlesPourScore(stats.score) * (1 + effetBuddyActuel().perlesPct / 100));
  const { perles, bonusJour } = appliquerBonusJour(base);
  const record = stats.score > etat.meilleurScore;
  if (record) etat.meilleurScore = stats.score;
  etat.perles += perles;
  gagnerXpPass(PASS_XP.partieInfini);
  emit();
  return { perlesGagnees: perles, bonusJour, record };
}

// AVENTURE — victoire : étoiles, perles, capsule à la 1ʳᵉ réussite (dorée au boss).
export function terminerNiveau(
  niveau: number, etoiles: number, boss: boolean, stats: StatsPartie,
): {
  perlesGagnees: number; bonusJour: boolean; premiere: boolean;
  capsule: TypeCapsule | null; etoiles: number;
} {
  majStatsPartie(stats);
  etat.statsJour.niveauxTermines += 1;
  const premiere = !etat.aventure.etoiles[String(niveau)];
  let base = premiere
    ? Math.floor(stats.score / NIVEAU_DIV_SCORE) + etoiles * NIVEAU_PERLES_PAR_ETOILE
    : Math.floor(stats.score / NIVEAU_DIV_REJOUER);
  base = Math.round(base * (1 + effetBuddyActuel().perlesPct / 100));
  const { perles, bonusJour } = appliquerBonusJour(Math.min(400, base));
  etat.perles += perles;

  let capsule: TypeCapsule | null = null;
  if (premiere) {
    capsule = boss ? 'doree' : 'classique';
    if (capsule === 'doree') etat.capsulesDoreesGratuites += 1;
    else etat.capsulesGratuites += 1;
  }
  gagnerXpPass(premiere ? PASS_XP.niveauPremiere : PASS_XP.niveauRejoue);
  etat.aventure.etoiles = {
    ...etat.aventure.etoiles,
    [String(niveau)]: Math.max(etoiles, etat.aventure.etoiles[String(niveau)] || 0),
  };
  etat.aventure.niveauMax = Math.max(etat.aventure.niveauMax, niveau + 1);
  emit();
  return { perlesGagnees: perles, bonusJour, premiere, capsule, etoiles };
}

// AVENTURE — défaite (ou abandon) : petite consolation.
export function echecNiveau(stats: StatsPartie): { perlesGagnees: number } {
  majStatsPartie(stats);
  const perles = Math.floor(stats.score / NIVEAU_DIV_ECHEC);
  etat.perles += perles;
  etat.dernierJourJoue = cleJour(); // une partie jouée reste une partie
  emit();
  return { perlesGagnees: perles };
}

// --- Power-ups -----------------------------------------------------------------------

export function acheterPowerup(id: PowerupId): boolean {
  const cout = coutPowerupActuel(id);
  if (etat.perles < cout || etat.powerups[id] >= POWERUPS[id].max) return false;
  etat.perles -= cout;
  etat.powerups = { ...etat.powerups, [id]: etat.powerups[id] + 1 };
  emit();
  return true;
}

export function consommerPowerup(id: PowerupId): boolean {
  if (etat.powerups[id] < 1) return false;
  etat.powerups = { ...etat.powerups, [id]: etat.powerups[id] - 1 };
  emit();
  return true;
}

// --- Défis du jour ---------------------------------------------------------------------

export function reclamerDefi(id: string): number {
  assurerJour();
  const defi = defisDuJour().find((d) => d.id === id);
  if (!defi || !defi.fait || defi.reclame) return 0;
  etat.defisReclames = [...etat.defisReclames, id];
  const gagnees = perlesEvenement(defi.perles);
  etat.perles += gagnees;
  gagnerXpPass(PASS_XP.defi);
  emit();
  return gagnees;
}

export function reclamerBonusDefis(): boolean {
  assurerJour();
  const defis = defisDuJour();
  if (etat.defisBonusReclame || !defis.every((d) => d.reclame)) return false;
  etat.defisBonusReclame = true;
  etat.capsulesGratuites += BONUS_DEFIS_CAPSULES;
  emit();
  return true;
}

// --- Arène & duels -----------------------------------------------------------------------

// Collectibles possédés (pour composer l'équipe)
export function idsPossedes(e: EtatBobaQuest = etat): string[] {
  return COLLECTIBLES.filter((c) => (e.collection[c.id] || 0) > 0).map((c) => c.id);
}

// Doublons misables (on garde TOUJOURS au moins un exemplaire)
export function idsDoublons(e: EtatBobaQuest = etat): string[] {
  return COLLECTIBLES.filter((c) => (e.collection[c.id] || 0) >= 2).map((c) => c.id);
}

export function definirEquipe(ids: string[]) {
  etat.arene = { ...etat.arene, equipe: ids.slice(0, 3) };
  emit();
}

export function definirBuddy(id: string | null) {
  etat.buddyId = id;
  emit();
}

// Victoire contre le Maître du rang courant → perles + capsule éventuelle, rang +1
export function victoireArene(rang: number): { perles: number; capsule: TypeCapsule | null } {
  const r = recompenseRang(rang);
  const gagnees = perlesEvenement(r.perles);
  etat.perles += gagnees;
  if (r.capsule === 'doree') etat.capsulesDoreesGratuites += 1;
  else if (r.capsule === 'classique') etat.capsulesGratuites += 1;
  if (rang === etat.arene.rang) etat.arene = { ...etat.arene, rang: rang + 1 };
  etat.arene = { ...etat.arene, victoires: etat.arene.victoires + 1 };
  gagnerXpPass(PASS_XP.arene);
  emit();
  return { perles: gagnees, capsule: r.capsule };
}

export function defaiteArene(): { perles: number } {
  etat.perles += PERLES_DEFAITE_ARENE;
  etat.arene = { ...etat.arene, defaites: etat.arene.defaites + 1 };
  emit();
  return { perles: PERLES_DEFAITE_ARENE };
}

// Mises de duels (limitées par jour) — préview locale du « gagner les billes des autres »
export function misesRestantesAujourdhui(e: EtatBobaQuest = etat): number {
  const jour = cleJour();
  const faites = e.statsJour.jour === jour ? e.statsJour.duelsMises : 0;
  return Math.max(0, MISES_DUEL_PAR_JOUR - faites);
}

export function enregistrerMiseDuel() {
  assurerJour();
  etat.statsJour = { ...etat.statsJour, duelsMises: etat.statsJour.duelsMises + 1 };
  emit();
}

// Résout un duel d'ami misé : victoire → on gagne la mise adverse ;
// défaite → on perd SON doublon (jamais en dessous d'un exemplaire).
export function resoudreDuelAmi(gagne: boolean, miseId?: string, gainId?: string): { nouveau: boolean } {
  let nouveau = false;
  if (gagne && gainId) {
    nouveau = (etat.collection[gainId] || 0) === 0;
    etat.collection = { ...etat.collection, [gainId]: (etat.collection[gainId] || 0) + 1 };
  } else if (!gagne && miseId) {
    etat.collection = { ...etat.collection, [miseId]: Math.max(1, (etat.collection[miseId] || 1) - 1) };
  }
  emit();
  return { nouveau };
}

// --- 🎒 Objets à équiper : le méta de l'Arène -----------------------------------------------

// Achat d'un objet en boutique (perles). Réservé aux objets de source « perles ».
export function acheterObjet(id: ObjetId): boolean {
  const def = OBJETS[id];
  if (etat.objets[id] || def.source !== 'perles' || def.cout == null || etat.perles < def.cout) return false;
  etat.perles -= def.cout;
  etat.objets = { ...etat.objets, [id]: true };
  emit();
  return true;
}

// Équipe / retire un objet sur UN emplacement d'un combattant. Non exclusif :
// un objet débloqué peut être porté par plusieurs combattants (pas de juggling).
export function equiperObjet(collectibleId: string, slot: Emplacement, objetId: ObjetId | null) {
  const portes = { ...etat.portes };
  const slots = { ...(portes[collectibleId] || {}) };
  if (objetId && etat.objets[objetId] && OBJETS[objetId].slot === slot) slots[slot] = objetId;
  else delete slots[slot];
  portes[collectibleId] = slots;
  etat.portes = portes;
  emit();
}

// Objets équipés par l'équipe d'Arène courante (pour creerCombat) : id → liste d'objets
export function objetsEquipe(e: EtatBobaQuest = etat): Record<string, ObjetId[]> {
  const res: Record<string, ObjetId[]> = {};
  for (const id of e.arene.equipe) {
    const slots = e.portes[id];
    if (!slots) continue;
    const list = (Object.values(slots) as ObjetId[]).filter((o) => e.objets[o]);
    if (list.length) res[id] = list;
  }
  return res;
}

// Objets équipés par UN combattant (pour l'aperçu d'effets dans l'UI)
export function objetsDe(collectibleId: string, e: EtatBobaQuest = etat): ObjetId[] {
  const slots = e.portes[collectibleId];
  if (!slots) return [];
  return (Object.values(slots) as ObjetId[]).filter((o) => e.objets[o]);
}

// 🔵 Capsule Objet (gacha d'équipement) — coûte des perles (ou gratuite via récompense).
// Doublon → éclats. Pity : épique garanti toutes les PITY_OBJET_EPIQUE ouvertures.
export function ouvrirCapsuleObjet(gratuite = false): { objet: ObjetId; doublon: boolean; eclats: number } | null {
  if (!gratuite) {
    if (etat.perles < CAPSULE_OBJET.cout) return null;
    etat.perles -= CAPSULE_OBJET.cout;
  }
  const min = etat.pityObjet + 1 >= PITY_OBJET_EPIQUE ? 'epique' : null;
  const objet = tirerObjet(min);
  const rar = OBJETS[objet].rarete;
  if (RARETES[rar].ordre >= RARETES.epique.ordre) etat.pityObjet = 0;
  else etat.pityObjet += 1;
  let doublon = false;
  let eclats = 0;
  if (etat.objets[objet]) { doublon = true; eclats = ECLATS_DOUBLON[rar]; etat.eclats += eclats; }
  else etat.objets = { ...etat.objets, [objet]: true };
  gagnerXpPass(PASS_XP.capsule);
  emit();
  return { objet, doublon, eclats };
}

// 🔨 Forge : dépense des éclats pour débloquer un objet précis (anti-malchance).
export function forgerObjet(id: ObjetId): boolean {
  if (etat.objets[id]) return false;
  const cout = ECLATS_FORGE[OBJETS[id].rarete];
  if (etat.eclats < cout) return false;
  etat.eclats -= cout;
  etat.objets = { ...etat.objets, [id]: true };
  emit();
  return true;
}

// --- 🏆 Tournoi hebdomadaire -------------------------------------------------------------------

// État du tournoi pour CETTE semaine (remis à zéro lazy au changement de semaine)
export function etatTournoi(e: EtatBobaQuest = etat): { semaine: string; etape: number; elimine: boolean; trophees: number } {
  const semaine = cleSemaine();
  if (e.tournoi.semaine !== semaine) {
    return { semaine, etape: 0, elimine: false, trophees: e.tournoi.trophees };
  }
  return e.tournoi;
}

function assurerSemaineTournoi() {
  const semaine = cleSemaine();
  if (etat.tournoi.semaine !== semaine) {
    etat.tournoi = { semaine, etape: 0, elimine: false, trophees: etat.tournoi.trophees };
  }
}

// Victoire à l'étape N (0 quart, 1 demie, 2 finale) → récompenses + progression
export function victoireTournoi(etape: number): { perles: number; capsule: TypeCapsule | null; champion: boolean } {
  assurerSemaineTournoi();
  const r = TOURNOI_RECOMPENSES[Math.min(etape, TOURNOI_RECOMPENSES.length - 1)];
  const gagnees = perlesEvenement(r.perles);
  etat.perles += gagnees;
  if (r.capsule === 'doree') etat.capsulesDoreesGratuites += 1;
  else if (r.capsule === 'classique') etat.capsulesGratuites += 1;
  gagnerXpPass(PASS_XP.tournoi);
  const champion = etape >= 2;
  etat.tournoi = {
    ...etat.tournoi,
    etape: etape + 1,
    elimine: champion, // champion = tournoi terminé pour la semaine
    trophees: etat.tournoi.trophees + (champion ? 1 : 0),
  };
  emit();
  return { perles: gagnees, capsule: r.capsule, champion };
}

export function defaiteTournoi(): { perles: number } {
  assurerSemaineTournoi();
  etat.perles += TOURNOI_CONSOLATION;
  etat.tournoi = { ...etat.tournoi, elimine: true };
  emit();
  return { perles: TOURNOI_CONSOLATION };
}

// --- 🎫 Boba Pass hebdomadaire -----------------------------------------------------------------

export type EtatPass = { semaine: string; xp: number; reclames: number[] };
export function etatPass(e: EtatBobaQuest = etat): EtatPass {
  const semaine = cleSemaine();
  return e.pass.semaine === semaine ? e.pass : { semaine, xp: 0, reclames: [] };
}

// Paliers débloqués (XP atteint) mais pas encore réclamés
export function paliersAReclamer(e: EtatBobaQuest = etat): number {
  const p = etatPass(e);
  let n = 0;
  PASS_PALIERS.forEach((palier, i) => {
    if (p.xp >= palier.xp && !p.reclames.includes(i)) n++;
  });
  return n;
}

// Réclame un palier du pass (crédite sa récompense, event ×2 sur les perles)
export function reclamerPalierPass(index: number): boolean {
  assurerSemainePass();
  const palier = PASS_PALIERS[index];
  if (!palier || etat.pass.xp < palier.xp || etat.pass.reclames.includes(index)) return false;
  if (palier.type === 'perles') etat.perles += perlesEvenement(palier.qte);
  else if (palier.type === 'capsule') etat.capsulesGratuites += palier.qte;
  else if (palier.type === 'capsule_doree') etat.capsulesDoreesGratuites += palier.qte;
  if (palier.perlesBonus) etat.perles += perlesEvenement(palier.perlesBonus);
  etat.pass = { ...etat.pass, reclames: [...etat.pass.reclames, index] };
  emit();
  return true;
}

// --- Capsules / collection / boutique / roulette (inchangé) ---------------------------

export function ouvrirCapsule(type: TypeCapsule, gratuite: boolean): {
  collectible: Collectible; doublon: boolean; perlesRendues: number;
} | null {
  if (gratuite) {
    if (type === 'classique') {
      if (etat.capsulesGratuites < 1) return null;
      etat.capsulesGratuites -= 1;
    } else {
      if (etat.capsulesDoreesGratuites < 1) return null;
      etat.capsulesDoreesGratuites -= 1;
    }
  } else {
    const cout = CAPSULES[type].cout;
    if (etat.perles < cout) return null;
    etat.perles -= cout;
  }
  // 🎁 PITY : la garantie prend le pas si le compteur est au maximum
  let collectible: Collectible;
  if (etat.pity.legendaire + 1 >= PITY_LEGENDAIRE) {
    collectible = tirerCapsuleMin(type, 'legendaire');
  } else if (etat.pity.epique + 1 >= PITY_EPIQUE) {
    collectible = tirerCapsuleMin(type, 'epique');
  } else {
    collectible = tirerCapsule(type);
  }
  // mise à jour des compteurs pity (reset quand la rareté est atteinte)
  const ordre = RARETES[collectible.rarete].ordre;
  etat.pity = {
    epique: ordre >= RARETES.epique.ordre ? 0 : etat.pity.epique + 1,
    legendaire: ordre >= RARETES.legendaire.ordre ? 0 : etat.pity.legendaire + 1,
  };

  const deja = etat.collection[collectible.id] || 0;
  const doublon = deja > 0;
  let perlesRendues = 0;
  etat.collection = { ...etat.collection, [collectible.id]: deja + 1 };
  if (doublon) {
    perlesRendues = DOUBLON_PERLES[collectible.rarete];
    etat.perles += perlesRendues;
  }
  etat.capsulesOuvertes += 1;
  gagnerXpPass(PASS_XP.capsule);
  emit();
  return { collectible, doublon, perlesRendues };
}

export function reclamerSet(set: SetId): Gain | null {
  if (etat.setsReclames.includes(set) || !setComplet(set)) return null;
  const r = SETS[set].recompense;
  const gain = nouveauGain(r.type, r.qte, 'set', r.label);
  etat.gains = [gain, ...etat.gains];
  etat.setsReclames = [...etat.setsReclames, set];
  emit();
  return gain;
}

export function reclamerCollection(): Gain | null {
  if (etat.collectionReclamee || !collectionComplete()) return null;
  const gain = nouveauGain(RECOMPENSE_COLLECTION.type, RECOMPENSE_COLLECTION.qte, 'collection', RECOMPENSE_COLLECTION.label);
  etat.gains = [gain, ...etat.gains];
  etat.collectionReclamee = true;
  emit();
  return gain;
}

export function acheterBoutique(palierId: string): Gain | null {
  const palier = BOUTIQUE.find((p) => p.id === palierId);
  if (!palier || etat.perles < palier.cout) return null;
  etat.perles -= palier.cout;
  const gain = nouveauGain(palier.type, palier.qte, 'boutique');
  etat.gains = [gain, ...etat.gains];
  emit();
  return gain;
}

export function tournerRoulette(): SegmentRoulette | null {
  if (!rouletteDispo()) return null;
  const seg = tirerRoulette();
  etat.derniereRouletteMois = cleMois();
  etat.dernierGainRoulette = seg.label;
  emit();
  return seg;
}

export function appliquerRoulette(seg: SegmentRoulette) {
  if (seg.type === 'perles') {
    etat.perles += seg.qte;
  } else if (seg.type === 'capsule_doree') {
    etat.capsulesDoreesGratuites += seg.qte;
  } else {
    etat.gains = [nouveauGain(seg.type, seg.qte, 'roulette'), ...etat.gains];
  }
  emit();
}

export function utiliserGain(id: string) {
  etat.gains = etat.gains.map((g) => (g.id === id ? { ...g, statut: 'utilise' as const } : g));
  emit();
}

// Remise à zéro complète (bouton preview du hub)
export function resetBobaQuest() {
  etat = JSON.parse(JSON.stringify(DEFAUT));
  emit();
}
