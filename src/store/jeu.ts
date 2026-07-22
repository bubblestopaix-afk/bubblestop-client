// === Boba Quest — état global du jeu (léger, persisté sur le téléphone) ===
// Même pattern que le panier : useSyncExternalStore + AsyncStorage.
// ⚠️ PREVIEW : tout est local. En version finale, les PRIX RÉELS (tampons,
// réductions, boissons) partiront côté serveur (fidelite_demandes appliquées
// par la caisse) avec plafonds anti-triche — voir AGENTS.md.
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  BONUS_DEFIS_CAPSULES, BONUS_PREMIERE_PARTIE, BOUTIQUE, CAPSULES, cleJour, EtapeQueteId,
  EtatQuete, multSerie, queteApresCredit, QUETE_TAMPON, Serie, serieApresTick,
  cleMois, cleSemaine, Collectible, collectiblesDuSet, Defi, DOUBLON_PERLES,
  EffetBuddy, effetBuddy, evenementDuJour, Gain, labelPrix, MesureDefi,
  NIVEAU_DIV_ECHEC, NIVEAU_DIV_REJOUER, NIVEAU_DIV_SCORE, NIVEAU_PERLES_PAR_ETOILE,
  ObjetId, OBJETS, PASS_PALIERS, PASS_XP, perlesPourScore, PITY_EPIQUE,
  PITY_LEGENDAIRE, POWERUPS, PowerupId, RARETES, RECOMPENSE_COLLECTION,
  Emplacement, CAPSULE_OBJET, ECLATS_DOUBLON, ECLATS_FORGE, tirerObjet, PITY_OBJET_EPIQUE,
  Tier, TIERS, PC_VICTOIRE, PC_DEFAITE, tierPourPc, tierSuivant, progressionTier,
  resetSaison, recompenseSaison, joursRestantsSaison, BOSS_RECOMPENSE,
  CONSOMMABLES, ConsommableId, coutEquipe, BUDGET_EQUIPE, equipeAutoSousBudget,
  SegmentRoulette, SETS, SetId, tirageDefisDuJour, tirerCapsule, tirerCapsuleMin,
  tirerRoulette, TOURNOI_CONSOLATION, TOURNOI_RECOMPENSES, trouverCollectible,
  TypeCapsule, COLLECTIBLES, trocDuJour,
  coutNiveauCarte, doublonsPourNiveau, ECLATS_PAR_DOUBLON, NIVEAU_CARTE_MAX, TOURNOI_RETENTE_PERLES,
  multSerieVictoires,
} from '@/components/jeu/economie';
import {
  MISES_DUEL_PAR_JOUR, PERLES_DEFAITE_ARENE, recompenseRang, AMIS_DEMO,
} from '@/components/jeu/arene';

const CLE_SAUVEGARDE = 'bobaQuest.etat';
const CLE_SAUVEGARDE_SECOURS = 'bobaQuest.etat.backup';
const VERSION_SAUVEGARDE = 1;

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
  versionSauvegarde: number;                    // version du schéma local, migrée au chargement
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
    serieVictoires: number;             // 🔥 victoires d'affilée (multiplie les perles)
  };
  objets: Partial<Record<ObjetId, boolean>>;              // objets possédés (débloqués)
  portes: Record<string, Partial<Record<Emplacement, ObjetId>>>; // collectibleId → objet par emplacement
  eclats: number;                                         // 🔹 éclats d'objet (forge)
  pityObjet: number;                                      // Capsules Objet depuis le dernier épique+
  consommables: Partial<Record<ConsommableId, number>>;   // 🎒 sac de consommables de combat
  classement: {                                           // 🏆 ligue classée + saisons
    pc: number;                                           // points de classement
    saison: string;                                       // 'YYYY-MM' de la saison en cours
    meilleurTierSaison: number;                           // meilleur tier atteint cette saison
    recompenseEnAttente: { saison: string; tierId: number } | null;
    titres: string[];                                     // titres cosmétiques gagnés
  };
  bossHebdo: { semaine: string; battu: boolean };         // 👹 boss de la semaine
  prixMois: { mois: string; achats: Record<string, number> }; // 🛡️ anti-farm : achats boutique du mois, par article
  trocJour: { jour: string; fait: boolean };              // 🤝 troc du jour (1/jour)
  defis: { jour: string; resolus: string[]; historique: { ami: string; gagne: boolean }[] }; // ⚔️ défis d'amis
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
  niveauxCartes: Record<string, number>; // 💪 niveau d'entraînement par carte (absent = 1)
  buddyId: string | null;               // « copain de tir » équipé (bonus passif)
  serie: Serie;                          // 🔥 série quotidienne (streak)
  queteTampon: EtatQuete;                // 🎯 quête unique « Mon premier tampon »
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
  versionSauvegarde: VERSION_SAUVEGARDE,
  perles: 0,
  collection: {},
  gains: [],
  capsulesGratuites: 0,
  capsulesDoreesGratuites: 0,
  powerups: { bombe: 0, arc: 0 },
  serie: { jours: 0, dernierJour: '' },
  queteTampon: { etape: 0, progres: 0, reclamee: false },
  aventure: { niveauMax: 1, etoiles: {} },
  arene: { rang: 1, equipe: [], victoires: 0, defaites: 0, serieVictoires: 0 },
  objets: {},
  portes: {},
  eclats: 0,
  pityObjet: 0,
  consommables: {},
  classement: { pc: 0, saison: '', meilleurTierSaison: 0, recompenseEnAttente: null, titres: [] },
  bossHebdo: { semaine: '', battu: false },
  prixMois: { mois: '', achats: {} },
  trocJour: { jour: '', fait: false },
  defis: { jour: '', resolus: [], historique: [] },
  tournoi: { semaine: '', etape: 0, elimine: false, trophees: 0 },
  niveauxCartes: {},
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
export type EtatHydratationBobaQuest = 'chargement' | 'prete' | 'recuperee' | 'erreur';
let hydratation: EtatHydratationBobaQuest = 'chargement';
let dernierSerialise: string | null = null;
let fileEcriture: Promise<void> = Promise.resolve();

function notifier() {
  listeners.forEach((l) => l());
}

// Convertit toutes les anciennes sauvegardes vers le schéma courant sans changer
// la clé AsyncStorage historique. Les champs inconnus sont conservés par le spread.
function migrerSauvegarde(brut: string): EtatBobaQuest | null {
  try {
    const sauve = JSON.parse(brut);
    if (!sauve || typeof sauve !== 'object' || Array.isArray(sauve)) return null;
    return {
      ...JSON.parse(JSON.stringify(DEFAUT)),
      ...sauve,
      versionSauvegarde: VERSION_SAUVEGARDE,
      powerups: { ...DEFAUT.powerups, ...(sauve.powerups || {}) },
      serie: { ...DEFAUT.serie, ...(sauve.serie || {}) },
      queteTampon: { ...DEFAUT.queteTampon, ...(sauve.queteTampon || {}) },
      aventure: { ...DEFAUT.aventure, ...(sauve.aventure || {}) },
      arene: { ...DEFAUT.arene, ...(sauve.arene || {}) },
      classement: { ...DEFAUT.classement, ...(sauve.classement || {}) },
      bossHebdo: { ...DEFAUT.bossHebdo, ...(sauve.bossHebdo || {}) },
      // prixMois v2 : plafond PAR ARTICLE ({achats}). Convertit l'ancien schéma
      // v1 {boissons: n} ; l'ex-quota hebdo (prixSemaine) est abandonné, ignoré au chargement.
      prixMois: {
        mois: sauve.prixMois?.mois || '',
        achats: {
          ...(sauve.prixMois?.achats || {}),
          ...(sauve.prixMois?.boissons ? { 'boisson-l': sauve.prixMois.boissons } : {}),
        },
      },
      trocJour: { ...DEFAUT.trocJour, ...(sauve.trocJour || {}) },
      defis: { ...DEFAUT.defis, ...(sauve.defis || {}) },
      consommables: { ...(sauve.consommables || {}) },
      objets: { ...(sauve.objets || {}) },
      portes: migrerPortes(sauve.portes),
      tournoi: { ...DEFAUT.tournoi, ...(sauve.tournoi || {}) },
      niveauxCartes: { ...(sauve.niveauxCartes || {}) },
      pity: { ...DEFAUT.pity, ...(sauve.pity || {}) },
      pass: { ...DEFAUT.pass, ...(sauve.pass || {}) },
      statsJour: { ...STATS_JOUR_VIERGES(''), ...(sauve.statsJour || {}) },
    };
  } catch {
    return null;
  }
}

// Restaure la sauvegarde avant d'autoriser le rendu des écrans du jeu. Si la
// valeur principale est illisible, tente la dernière copie connue avant de bloquer.
async function hydraterSauvegarde() {
  try {
    const principalBrut = await AsyncStorage.getItem(CLE_SAUVEGARDE);
    const principal = principalBrut ? migrerSauvegarde(principalBrut) : null;
    if (principal) {
      etat = principal;
      dernierSerialise = principalBrut;
      hydratation = 'prete';
      return;
    }

    const secoursBrut = await AsyncStorage.getItem(CLE_SAUVEGARDE_SECOURS);
    const secours = secoursBrut ? migrerSauvegarde(secoursBrut) : null;
    if (secours) {
      etat = secours;
      dernierSerialise = JSON.stringify(secours);
      await AsyncStorage.setItem(CLE_SAUVEGARDE, dernierSerialise);
      hydratation = 'recuperee';
      return;
    }

    hydratation = principalBrut || secoursBrut ? 'erreur' : 'prete';
  } catch {
    hydratation = 'erreur';
  } finally {
    notifier();
  }
}

void hydraterSauvegarde();

function planifierEcriture(serialise: string) {
  fileEcriture = fileEcriture
    .catch(() => {})
    .then(async () => {
      const precedent = dernierSerialise;
      if (precedent && precedent !== serialise) {
        await AsyncStorage.setItem(CLE_SAUVEGARDE_SECOURS, precedent).catch(() => {});
      }
      await AsyncStorage.setItem(CLE_SAUVEGARDE, serialise);
      dernierSerialise = serialise;
    })
    .catch((erreur) => {
      if (__DEV__) console.warn('Boba Quest : sauvegarde locale impossible', erreur);
    });
}

function emit() {
  etat = { ...etat };
  notifier();
  planifierEcriture(JSON.stringify(etat));
}

export function useBobaQuest(): EtatBobaQuest {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => etat,
  );
}

export function useHydratationBobaQuest(): EtatHydratationBobaQuest {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => hydratation,
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

// 🏆 Rollover de saison (mensuel) : reset DOUX des PC, récompense de fin de saison
// mise en attente selon le meilleur tier atteint. Vérifié paresseusement.
function assurerSaison() {
  const saison = cleMois();
  const c = etat.classement;
  if (!c.saison) { etat.classement = { ...c, saison }; return; } // 1ʳᵉ initialisation
  if (c.saison !== saison) {
    const pc = resetSaison(c.pc);
    etat.classement = {
      pc,
      saison,
      meilleurTierSaison: tierPourPc(pc).id,
      // récompense de la saison qui vient de finir (garde la plus haute si non réclamée)
      recompenseEnAttente:
        c.recompenseEnAttente && c.recompenseEnAttente.tierId >= c.meilleurTierSaison
          ? c.recompenseEnAttente
          : { saison: c.saison, tierId: c.meilleurTierSaison },
      titres: c.titres,
    };
  }
}

// Applique un delta de PC (borné à 0), met à jour le meilleur tier de la saison.
function appliquerPc(delta: number) {
  assurerSaison();
  const pc = Math.max(0, etat.classement.pc + delta);
  const meilleur = Math.max(etat.classement.meilleurTierSaison, tierPourPc(pc).id);
  etat.classement = { ...etat.classement, pc, meilleurTierSaison: meilleur };
}

// Multiplicateur d'événement du jour (×2 le week-end) + multiplicateur de SÉRIE
// quotidienne, appliqués à TOUS les gains de perles. La quête « premier tampon »
// compte aussi ses perles ici (point de passage unique de tous les gains).
function perlesEvenement(montant: number): number {
  const gain = Math.round(montant * evenementDuJour().multiplicateur * multSerie(etat.serie.jours));
  if (gain > 0) crediterQuete('perles', gain);
  return gain;
}

// 🎯 Fait avancer l'étape courante de la quête « Mon premier tampon »
function crediterQuete(id: EtapeQueteId, n = 1) {
  const q = queteApresCredit(etat.queteTampon, id, n);
  if (q !== etat.queteTampon) { etat.queteTampon = q; }
}

// 🔥 Pointe la série quotidienne (appelée à l'ouverture du hub). Ne fait rien si
// déjà pointée aujourd'hui. Récompense : perles J1-J6, capsule dorée chaque J7.
export function tickSerie(): { jours: number; perles: number; capsuleDoree: boolean } | null {
  const maintenant = new Date();
  const hier = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() - 1);
  const r = serieApresTick(etat.serie, cleJour(maintenant), cleJour(hier));
  if (!r) return null;
  etat.serie = r.serie;
  if (r.perles > 0) etat.perles += r.perles; // récompense fixe, hors multiplicateurs
  if (r.capsuleDoree) etat.capsulesDoreesGratuites += 1;
  emit();
  return { jours: r.serie.jours, perles: r.perles, capsuleDoree: r.capsuleDoree };
}

// 🎯 Réclame le tampon réel de la quête (une seule fois, HORS plafonds mensuels)
export function reclamerQueteTampon(): Gain | null {
  if (etat.queteTampon.reclamee || etat.queteTampon.etape < QUETE_TAMPON.length) return null;
  const gain: Gain = {
    id: `quete-tampon-${Date.now()}`, label: '+1 tampon', origine: 'quete',
    type: 'tampon', qte: 1,
    gagneLe: new Date().toISOString(), statut: 'a_reclamer',
  };
  etat.queteTampon = { ...etat.queteTampon, reclamee: true };
  etat.gains = [gain, ...etat.gains];
  emit();
  return gain;
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
  crediterQuete('infini');
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
  crediterQuete('niveaux');
  majStatsPartie(stats);
  etat.statsJour.niveauxTermines += 1;
  const premiere = !etat.aventure.etoiles[String(niveau)];
  let base = premiere
    ? Math.floor(stats.score / NIVEAU_DIV_SCORE) + etoiles * NIVEAU_PERLES_PAR_ETOILE
    : Math.floor(stats.score / NIVEAU_DIV_REJOUER);
  base = Math.round(base * (1 + effetBuddyActuel().perlesPct / 100));
  const { perles, bonusJour } = appliquerBonusJour(Math.min(650, base));
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
  crediterQuete('defis');
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

// 🤝 Troc du jour : proposition de « Sam » (démo) — donne un doublon, reçois une carte
// manquante. null s'il n'y a pas d'échange possible aujourd'hui.
export function trocDuJourActuel(e: EtatBobaQuest = etat): { veut: string; offre: string; fait: boolean } | null {
  const doublons = idsDoublons(e);
  const manquants = COLLECTIBLES.filter((c) => !((e.collection[c.id] || 0) > 0)).map((c) => c.id);
  const t = trocDuJour(cleJour(), doublons, manquants);
  if (!t) return null;
  const fait = e.trocJour.jour === cleJour() && e.trocJour.fait;
  return { ...t, fait };
}
// Réalise l'échange du jour (1/jour). Retourne l'échange effectué ou null.
export function faireTrocDuJour(): { veut: string; offre: string } | null {
  const t = trocDuJourActuel();
  if (!t || t.fait) return null;
  if ((etat.collection[t.veut] || 0) < 2) return null; // sécurité : il faut le doublon
  etat.collection[t.veut] -= 1;
  etat.collection[t.offre] = (etat.collection[t.offre] || 0) + 1;
  etat.trocJour = { jour: cleJour(), fait: true };
  emit();
  return { veut: t.veut, offre: t.offre };
}

export function definirEquipe(ids: string[]) {
  etat.arene = { ...etat.arene, equipe: ids.slice(0, 3) };
  emit();
}

// ⚖️ Une équipe est-elle valide (3 cartes possédées, sous le budget de rareté) ?
export function equipeValideSousBudget(ids: string[], e: EtatBobaQuest = etat): boolean {
  return ids.length === 3
    && ids.every((id) => (e.collection[id] || 0) > 0)
    && coutEquipe(ids) <= BUDGET_EQUIPE;
}

// --- 🎒 Consommables de combat ---------------------------------------------------------
export function acheterConsommable(id: ConsommableId, n = 1): boolean {
  const cout = CONSOMMABLES[id].cout * n;
  if (etat.perles < cout) return false;
  etat.perles -= cout;
  etat.consommables = { ...etat.consommables, [id]: (etat.consommables[id] ?? 0) + n };
  emit();
  return true;
}
// Consomme 1 exemplaire (appelé quand on l'utilise en combat). True si dispo.
export function utiliserConsommable(id: ConsommableId): boolean {
  const n = etat.consommables[id] ?? 0;
  if (n <= 0) return false;
  etat.consommables = { ...etat.consommables, [id]: n - 1 };
  emit();
  return true;
}

export function definirBuddy(id: string | null) {
  etat.buddyId = id;
  if (id) crediterQuete('copain');
  emit();
}

// Victoire contre le Maître du rang courant → perles (× série de victoires 🔥) +
// capsule éventuelle, rang +1, +PC. `serie` = série APRÈS cette victoire.
export function victoireArene(rang: number): { perles: number; capsule: TypeCapsule | null; pc: number; serie: number; multSerie: number } {
  crediterQuete('duels');
  const r = recompenseRang(rang);
  const multV = multSerieVictoires(etat.arene.serieVictoires ?? 0);
  const gagnees = Math.round(perlesEvenement(r.perles) * multV);
  etat.perles += gagnees;
  if (r.capsule === 'doree') etat.capsulesDoreesGratuites += 1;
  else if (r.capsule === 'classique') etat.capsulesGratuites += 1;
  if (rang === etat.arene.rang) etat.arene = { ...etat.arene, rang: rang + 1 };
  etat.arene = {
    ...etat.arene,
    victoires: etat.arene.victoires + 1,
    serieVictoires: (etat.arene.serieVictoires ?? 0) + 1,
  };
  appliquerPc(PC_VICTOIRE);
  gagnerXpPass(PASS_XP.arene);
  emit();
  return { perles: gagnees, capsule: r.capsule, pc: PC_VICTOIRE, serie: etat.arene.serieVictoires, multSerie: multV };
}

export function defaiteArene(): { perles: number; pc: number } {
  etat.perles += PERLES_DEFAITE_ARENE;
  etat.arene = { ...etat.arene, defaites: etat.arene.defaites + 1, serieVictoires: 0 };
  const avant = etat.classement.pc;
  appliquerPc(PC_DEFAITE);
  const pc = etat.classement.pc - avant; // delta réel (planché à 0)
  emit();
  return { perles: PERLES_DEFAITE_ARENE, pc };
}

// 👹 Boss hebdomadaire : battable une fois par semaine (reset lazy au changement de semaine)
function assurerSemaineBoss() {
  const semaine = cleSemaine();
  if (etat.bossHebdo.semaine !== semaine) etat.bossHebdo = { semaine, battu: false };
}
export function bossBattuCetteSemaine(e: EtatBobaQuest = etat): boolean {
  return e.bossHebdo.semaine === cleSemaine() && e.bossHebdo.battu;
}
// Victoire contre le boss → grosse récompense, une seule fois par semaine
export function victoireBoss(): { perles: number; capsules: number; eclats: number; deja: boolean } {
  assurerSemaineBoss();
  if (etat.bossHebdo.battu) return { perles: 0, capsules: 0, eclats: 0, deja: true };
  const perles = perlesEvenement(BOSS_RECOMPENSE.perles);
  etat.perles += perles;
  etat.capsulesGratuites += BOSS_RECOMPENSE.capsules;
  etat.eclats += BOSS_RECOMPENSE.eclats;
  etat.bossHebdo = { semaine: cleSemaine(), battu: true };
  appliquerPc(PC_VICTOIRE);
  gagnerXpPass(PASS_XP.tournoi);
  emit();
  return { perles, capsules: BOSS_RECOMPENSE.capsules, eclats: BOSS_RECOMPENSE.eclats, deja: false };
}

// 🏆 Réclame la récompense de fin de saison en attente (perles, capsules, éclats, titre)
export function reclamerRecompenseSaison(): { perles: number; capsules: number; eclats: number; titre: string | null } | null {
  assurerSaison();
  const pend = etat.classement.recompenseEnAttente;
  if (!pend) return null;
  const rec = recompenseSaison(pend.tierId);
  const perles = perlesEvenement(rec.perles);
  etat.perles += perles;
  etat.capsulesGratuites += rec.capsules;
  etat.eclats += rec.eclats;
  const titres = rec.titre ? [...etat.classement.titres, `${rec.titre} · ${pend.saison}`] : etat.classement.titres;
  etat.classement = { ...etat.classement, recompenseEnAttente: null, titres };
  emit();
  return { ...rec, perles };
}

// Lecture du classement courant (tier, progression, saison) pour l'UI
export function classementActuel(e: EtatBobaQuest = etat): {
  pc: number; tier: Tier; suivant: Tier | null; progression: number;
  saison: string; joursRestants: number; meilleurTierSaison: number;
  recompenseEnAttente: { saison: string; tierId: number } | null; titres: string[];
} {
  const pc = e.classement.pc;
  return {
    pc,
    tier: tierPourPc(pc),
    suivant: tierSuivant(pc),
    progression: progressionTier(pc),
    saison: e.classement.saison || cleMois(),
    joursRestants: joursRestantsSaison(),
    meilleurTierSaison: e.classement.meilleurTierSaison,
    recompenseEnAttente: e.classement.recompenseEnAttente,
    titres: e.classement.titres,
  };
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

// --- ⚔️ Défis asynchrones d'amis (preview) --------------------------------------------------
const DEFI_PERLES = 80; // récompense d'un défi remporté

// Reset lazy des défis relevés au changement de jour (l'historique, lui, reste).
function assurerJourDefis() {
  if (etat.defis.jour !== cleJour()) etat.defis = { ...etat.defis, jour: cleJour(), resolus: [] };
}
// Défis d'amis encore en attente aujourd'hui (ceux pas encore relevés).
export function defisEnAttente(e: EtatBobaQuest = etat): string[] {
  const resolus = e.defis.jour === cleJour() ? e.defis.resolus : [];
  return AMIS_DEMO.filter((nom) => !resolus.includes(nom));
}
// Relève un défi : marque l'ami comme relevé, journalise le résultat, récompense si gagné.
export function resoudreDefiAmi(nom: string, gagne: boolean): { perles: number } {
  assurerJourDefis();
  // 1 défi par ami et par jour : déjà relevé aujourd'hui → pas de double récompense ni de
  // doublon d'historique. Inatteignable via l'UI actuelle (l'ami quitte la liste dès qu'il est
  // relevé), mais protège les futurs vrais comptes (renvois réseau / double-soumission).
  if (etat.defis.resolus.includes(nom)) return { perles: 0 };
  etat.defis.resolus = [...etat.defis.resolus, nom];
  etat.defis.historique = [{ ami: nom, gagne }, ...etat.defis.historique].slice(0, 12);
  const perles = gagne ? perlesEvenement(DEFI_PERLES) : 0; // événement du jour appliqué (ex. ×2 le week-end)
  if (perles) etat.perles += perles;
  emit();
  return { perles };
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
  crediterQuete('duels');
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

// 🎟️ Retente l'étape perdue de la semaine contre des perles (au lieu d'attendre lundi).
// Un champion (etape 3) n'a rien à retenter ; la consolation déjà versée reste acquise.
export function retenterTournoi(): boolean {
  assurerSemaineTournoi();
  if (!etat.tournoi.elimine || etat.tournoi.etape >= 3) return false;
  if (etat.perles < TOURNOI_RETENTE_PERLES) return false;
  etat.perles -= TOURNOI_RETENTE_PERLES;
  etat.tournoi = { ...etat.tournoi, elimine: false };
  emit();
  return true;
}

// --- 💪 Entraînement des cartes (niveaux) -------------------------------------------------

export function niveauCarte(id: string, e: EtatBobaQuest = etat): number {
  return Math.max(1, Math.min(NIVEAU_CARTE_MAX, e.niveauxCartes[id] ?? 1));
}

// Niveaux de TOUTES les cartes entraînées — à passer à creerCombat/creerCombatBoss (côté a).
export function niveauxEquipe(e: EtatBobaQuest = etat): Record<string, number> {
  const r: Record<string, number> = {};
  for (const id of Object.keys(e.niveauxCartes)) r[id] = niveauCarte(id, e);
  return r;
}

export type ApercuEntrainement = {
  niveau: number;               // niveau actuel
  max: boolean;                 // déjà au niveau max
  cout: number;                 // perles pour le prochain niveau
  doublonsRequis: number;       // doublons de la carte exigés par le palier (0 sinon)
  doublonsDispo: number;        // doublons possédés (l'exemplaire vitrine ne compte pas)
  eclatsJoker: number;          // éclats nécessaires pour remplacer les doublons manquants
  possible: boolean;
  bloque: 'perles' | 'doublons' | null; // ce qui manque si !possible
};

export function apercuEntrainement(id: string, e: EtatBobaQuest = etat): ApercuEntrainement {
  const meta = trouverCollectible(id);
  const niveau = niveauCarte(id, e);
  if (!meta || niveau >= NIVEAU_CARTE_MAX) {
    return { niveau, max: true, cout: 0, doublonsRequis: 0, doublonsDispo: 0, eclatsJoker: 0, possible: false, bloque: null };
  }
  const cout = coutNiveauCarte(meta.rarete, niveau);
  const doublonsRequis = doublonsPourNiveau(niveau + 1);
  const doublonsDispo = Math.max(0, (e.collection[id] ?? 0) - 1);
  const manque = Math.max(0, doublonsRequis - doublonsDispo);
  const eclatsJoker = manque * ECLATS_PAR_DOUBLON;
  const assezPerles = e.perles >= cout;
  const assezDoublons = manque === 0 || e.eclats >= eclatsJoker;
  return {
    niveau, max: false, cout, doublonsRequis, doublonsDispo, eclatsJoker,
    possible: assezPerles && assezDoublons,
    bloque: !assezPerles ? 'perles' : !assezDoublons ? 'doublons' : null,
  };
}

// Passe la carte au niveau suivant. Consomme perles + doublons du palier (jamais
// l'exemplaire vitrine) — les doublons manquants sont remplacés par des éclats.
export function entrainerCarte(id: string): { ok: boolean; niveau: number } {
  const a = apercuEntrainement(id);
  if (a.max || !a.possible) return { ok: false, niveau: a.niveau };
  const consommes = Math.min(a.doublonsRequis, a.doublonsDispo);
  etat.perles -= a.cout;
  if (consommes > 0) etat.collection = { ...etat.collection, [id]: (etat.collection[id] ?? 1) - consommes };
  if (a.eclatsJoker > 0) etat.eclats -= a.eclatsJoker;
  etat.niveauxCartes = { ...etat.niveauxCartes, [id]: a.niveau + 1 };
  emit();
  return { ok: true, niveau: a.niveau + 1 };
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
  crediterQuete('capsules');
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

// 🛡️ Anti-farm : reset lazy des plafonds mensuels de la boutique au changement de mois.
function assurerMoisPrix() {
  const mois = cleMois();
  if (etat.prixMois.mois !== mois) etat.prixMois = { mois, achats: {} };
}
// Combien de fois cet article peut encore être débloqué ce mois-ci (0 = plafonné).
export function restantCeMois(palierId: string, e: EtatBobaQuest = etat): number {
  const palier = BOUTIQUE.find((p) => p.id === palierId);
  if (!palier) return 0;
  const pris = e.prixMois.mois === cleMois() ? (e.prixMois.achats[palierId] || 0) : 0;
  return Math.max(0, palier.parMois - pris);
}

export function acheterBoutique(palierId: string): Gain | null {
  const palier = BOUTIQUE.find((p) => p.id === palierId);
  if (!palier || etat.perles < palier.cout) return null;
  assurerMoisPrix();
  // 🛡️ Anti-farm : plafond MENSUEL par article (tampon 1× · −10 % 3× · −20 % 1× · boisson 1×).
  const pris = etat.prixMois.achats[palierId] || 0;
  if (pris >= palier.parMois) return null;
  etat.prixMois.achats = { ...etat.prixMois.achats, [palierId]: pris + 1 };
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
  if (!__DEV__) return;
  etat = JSON.parse(JSON.stringify(DEFAUT));
  emit();
}
