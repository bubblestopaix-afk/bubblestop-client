// === Boba Quest — état global du jeu (léger, persisté sur le téléphone) ===
// Même pattern que le panier : useSyncExternalStore + AsyncStorage.
// La progression, les perles et les capsules restent locales. Les PRIX RÉELS
// (tampons, réductions, boissons) sont transformés en demandes serveur
// persistantes puis appliqués une seule fois par la caisse au scan fidélité.
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  BONUS_DEFIS_CAPSULES, BONUS_PREMIERE_PARTIE, BOUTIQUE, CAPSULES, cleJour, EtapeQueteId,
  EtatQuete, multSerie, queteApresCredit, QUETE_TAMPON, Serie, serieApresTick,
  cleMois, cleSemaine, CodeRecompenseReelle, Collectible, collectiblesDuSet, Defi, DOUBLON_PERLES,
  EffetBuddy, effetBuddy, evenementDuJour, Gain, labelPrix, MesureDefi,
  NIVEAU_DIV_ECHEC, NIVEAU_DIV_REJOUER, NIVEAU_DIV_SCORE, NIVEAU_PERLES_PAR_ETOILE,
  NIVEAU_PRIME_EXPLORATION, capsuleDuNiveau,
  type GainGorgee, type EtatVisites, gorgeePourBoissons, visitesApresGorgee, migrerVisites,
  type LigneAchat, exemplairesParAchats, PASSEPORT_ACTIF, poolCapsuleAvecPasseport,
  etatEstVierge,
  deblocageDe, passeportCarte,
  GOUT_MAX, rangGout, migrerGout, migrerExemplairesPasseport,
  multGorgee, heuresGorgeeRestantes, VISITES_VIERGES,
  NIVEAU_PERLES_MAX, PERLES_MAX_FINAL, type ModeGain, ObjetId, OBJETS, OBJET_IDS,
  PASS_PALIERS, PASS_XP, perlesPourScore, PITY_EPIQUE,
  PITY_LEGENDAIRE, POWERUPS, PowerupId, RARETES, RECOMPENSE_COLLECTION,
  Emplacement, CAPSULE_OBJET, ECLATS_DOUBLON, ECLATS_FORGE, tirerObjet, PITY_OBJET_EPIQUE,
  Tier, TIERS, PC_VICTOIRE, PC_DEFAITE, tierPourPc, tierSuivant, progressionTier,
  resetSaison, recompenseSaison, joursRestantsSaison, BOSS_RECOMPENSE,
  CONSOMMABLES, CONSOMMABLE_IDS, ConsommableId, coutEquipe, BUDGET_EQUIPE, equipeAutoSousBudget,
  SAC_MAX_CONSO, tirerButinConso, probaButinNiveau, probaButinInfini,
  SegmentRoulette, SETS, SetId, tirageDefisDuJour, tirerCapsule, tirerCapsuleMin,
  tirerRoulette, TOURNOI_CONSOLATION, TOURNOI_RECOMPENSES, trouverCollectible,
  TypeCapsule, COLLECTIBLES, offresTrocDuJour, migrerTrocJour,
  type OffreTroc, type OffreTrocId, type TrocJour,
  coutNiveauCarte, doublonsPourNiveau, ECLATS_PAR_DOUBLON, NIVEAU_CARTE_MAX, TOURNOI_RETENTE_PERLES,
  multSerieVictoires,
  exploitsApresEvenement, migrerExploits, type Exploits, type ExploitsCarte,
  effetsTalentsEquipe, migrerTalents, optionsTalent, PALIERS_TALENT, REFORGE_TALENT_ECLATS,
  type ChoixLettre, type PalierTalent, type TalentsCartes,
} from '@/components/jeu/economie';
import {
  MISES_DUEL_PAR_JOUR, PERLES_DEFAITE_ARENE, recompenseRang, AMIS_DEMO, equipeSam,
} from '@/components/jeu/arene';
import {
  creerRun, draftBonusRun, finirRun, migrerTournee, perlesVictoireTournee,
  pvMaxEquipeRun, runApresBonus, runApresVictoire, soignerRun,
  TOURNEE_PALIERS, TOURNEE_VIERGE,
  type BonusRunId, type SuiviTournee,
} from '@/components/jeu/tournee';

const CLE_SAUVEGARDE = 'bobaQuest.etat';
const CLE_SAUVEGARDE_SECOURS = 'bobaQuest.etat.backup';
const VERSION_SAUVEGARDE = 2;

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
  tourneesLancees: number; // runs de Tournée démarrées aujourd'hui (limite anti-farm)
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
  trocJour: TrocJour;                                        // 🤝 comptoir de troc (3 offres/jour)
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
  // 👅 LOT E — rang de Goût par carte (0..GOUT_MAX), alimenté par les VRAIS achats.
  // MONOTONE : il ne redescend jamais, même si l'historique serveur est tronqué.
  goutCartes: Record<string, number>;
  // 🎫 Exemplaires DÉJÀ OCTROYÉS par le Passeport, carte par carte. Champ ADDITIF, et
  // surtout : c'est LUI que compare `appliquerPasseport`, plus jamais la collection
  // vivante — sinon `entrainerCarte`, qui consomme des doublons, rouvrirait le robinet
  // à chaque passage sur l'écran Collection (faille E5).
  exemplairesPasseport: Record<string, number>;
  // 🔔 Dernière arrivée `achats_lignes` déjà annoncée au joueur. `created_at` est le
  // curseur (et non la date d'encaissement, car une caisse hors ligne peut publier plus
  // tard) ; `ids` départage les lignes insérées dans la même microseconde.
  curseurAchatsPasseport: { creeLe: string; ids: string[] } | null;
  talentsCartes: TalentsCartes;          // 🎖️ choix de talents par carte (paliers 4/7/10)
  tournee: SuiviTournee;                 // 🗺️ Tournée des Maîtres (run roguelite hebdo)
  exploits: Exploits;                    // 🏅 palmarès par carte (cosmétique, additif)
  buddyId: string | null;               // « copain de tir » équipé (bonus passif)
  serie: Serie;                          // 🔥 série quotidienne (streak)
  queteTampon: EtatQuete;                // 🎯 quête unique « Mon premier tampon »
  statsJour: StatsJour;
  // 🧋 Gorgée Fraîche (26/07) — suivi des VRAIES visites en boutique. Champs ADDITIFS.
  visites: EtatVisites;
  tourneesOffertes: number;   // runs de Tournée offertes par une visite (hors quota du jour)
  // 💾 Sauvegarde serveur : compteur MONOTONE incrémenté à chaque modification locale.
  // C'est lui qui arbitre entre le téléphone et le serveur (cf. `decisionSync`).
  revision: number;
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
  tourneesLancees: 0,
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
  trocJour: { jour: '', faits: [] },
  defis: { jour: '', resolus: [], historique: [] },
  tournoi: { semaine: '', etape: 0, elimine: false, trophees: 0 },
  niveauxCartes: {},
  goutCartes: {},
  exemplairesPasseport: {},
  curseurAchatsPasseport: null,
  talentsCartes: {},
  tournee: { ...TOURNEE_VIERGE, reclames: [] },
  exploits: {},
  pity: { epique: 0, legendaire: 0 },
  pass: { semaine: '', xp: 0, reclames: [] },
  buddyId: null,
  statsJour: STATS_JOUR_VIERGES(''),
  visites: { ...VISITES_VIERGES },
  tourneesOffertes: 0,
  revision: 0,
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

const CODES_RECOMPENSES = new Set<CodeRecompenseReelle>([
  'quete_premier_tampon',
  'set_milk', 'set_fruit', 'set_topping', 'set_signature',
  'collection_complete',
  'boutique_tampon_1', 'boutique_reduction_10', 'boutique_reduction_20', 'boutique_boisson_l',
  'roulette_tampon_1', 'roulette_tampon_2', 'roulette_tampon_3',
  'roulette_reduction_10', 'roulette_boisson_l',
]);

// Compatibilité avec les prix gagnés avant le flux caisse : leur combinaison
// origine/type/quantité suffit à retrouver le code canonique. Un ancien bouton
// « utilisé » sans demande serveur est rouvert, car il ne créditait réellement rien.
function infererCodeRecompense(g: Partial<Gain>): CodeRecompenseReelle | null {
  if (g.code && CODES_RECOMPENSES.has(g.code)) return g.code;
  if (g.origine === 'quete') return 'quete_premier_tampon';
  if (g.origine === 'collection') return 'collection_complete';
  if (g.origine === 'set') {
    if (g.type === 'tampon' && g.qte === 1) return 'set_milk';
    if (g.type === 'tampon' && g.qte === 2) return 'set_fruit';
    if (g.type === 'reduction' && g.qte === 10) return 'set_topping';
    if (g.type === 'boisson' && g.qte === 1) return 'set_signature';
  }
  if (g.origine === 'boutique') {
    if (g.type === 'tampon' && g.qte === 1) return 'boutique_tampon_1';
    if (g.type === 'reduction' && g.qte === 10) return 'boutique_reduction_10';
    if (g.type === 'reduction' && g.qte === 20) return 'boutique_reduction_20';
    if (g.type === 'boisson' && g.qte === 1) return 'boutique_boisson_l';
  }
  if (g.origine === 'roulette') {
    if (g.type === 'tampon' && g.qte === 1) return 'roulette_tampon_1';
    if (g.type === 'tampon' && g.qte === 2) return 'roulette_tampon_2';
    if (g.type === 'tampon' && g.qte === 3) return 'roulette_tampon_3';
    if (g.type === 'reduction' && g.qte === 10) return 'roulette_reduction_10';
    if (g.type === 'boisson' && g.qte === 1) return 'roulette_boisson_l';
  }
  return null;
}

function migrerGains(brut: unknown): Gain[] {
  if (!Array.isArray(brut)) return [];
  return brut.flatMap((valeur) => {
    if (!valeur || typeof valeur !== 'object') return [];
    const g = valeur as Partial<Gain>;
    const code = infererCodeRecompense(g);
    if (!code || !g.id || !g.type || !g.origine || !g.gagneLe) return [];
    const demandeId = typeof g.demandeId === 'string' ? g.demandeId : undefined;
    const statut = demandeId && ['en_attente', 'utilise', 'refuse'].includes(String(g.statut))
      ? g.statut as Gain['statut']
      : 'a_reclamer';
    return [{
      id: String(g.id), code, type: g.type, qte: Number(g.qte) || 1,
      label: String(g.label || labelPrix(g.type, Number(g.qte) || 1)),
      origine: g.origine, gagneLe: String(g.gagneLe), demandeId, statut,
    }];
  });
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
// 🩹 26/07 — Assainisseurs : le spread `...sauve` laissait passer TOUT le brut tel
// quel. Les objets voisins étaient protégés par `{...DEFAUT.x, ...(sauve.x || {})}`,
// mais `collection` — le champ central, celui qui conditionne les sets, la collection
// complète et donc les PRIX RÉELS — était le seul à ne pas l'être. Un `collection:
// null` ne faisait pas échouer la migration (elle ne touchait pas au champ), donc
// l'hydratation passait à « prête », la copie de secours n'était jamais consultée, et
// le crash arrivait plus tard au rendu (`e.collection[c.id]`) à CHAQUE lancement :
// application briquée sans recours.
const entierPositif = (x: unknown): number => {
  const n = Number(x);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
};

function assainirComptes(brut: unknown, cleValide: (id: string) => boolean): Record<string, number> {
  const res: Record<string, number> = {};
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return res;
  for (const [id, n] of Object.entries(brut as Record<string, unknown>)) {
    if (!cleValide(id)) continue;
    const v = entierPositif(n);
    if (v > 0) res[id] = v;
  }
  return res;
}

// 🛡️ 27/07 — `arene` ET `aventure` ÉTAIENT LES DEUX DERNIERS SOUS-OBJETS BRUTS.
// `collection`, `niveauxCartes`, `goutCartes`, `consommables` et `objets` passent tous
// par un assainisseur ; ces deux-là se contentaient d'un spread — `arene: { ...DEFAUT.arene,
// ...(sauve.arene || {}) }` — et une sauvegarde serveur portant `arene.rang: "nawak"`
// était donc ADOPTÉE telle quelle. La suite se déroulait toute seule :
//   · `victoireArene` → `recompenseRang("nawak")` → `etat.perles += NaN` → solde NaN
//     DÉFINITIF, poussé au serveur en `perles: null` (JSON n'a pas de NaN) pendant
//     qu'`etatEstVierge` déclarait le compte « vierge » (NaN > 0 est faux) : la
//     progression du joueur écrasée, sans un seul message ;
//   · `aventure.niveauMax: "nawak"` → `parcours.tsx` appelle `etapePalier(niveauMax)`
//     DÈS LE RENDU → écran rouge irrécupérable.
// Les moteurs ont été bouclés de leur côté (arene.ts, tournee.ts, moteur-shooter.ts) —
// c'est le deuxième niveau de défense, pas le seul : une donnée sale ne doit pas non plus
// se PERSISTER, sinon elle repart au serveur à chaque écriture.
// Règle de la maison : on ASSAINIT, on ne PURGE jamais. Les champs inconnus sont
// conservés par le spread (une version d'app plus récente peut en avoir ajouté), seuls
// les champs connus sont ramenés dans leur domaine, et `undefined` est toléré.

// Palmarès du parcours : `niveau → 1..3 étoiles`. Les clés ne sont pas des ids de
// collectible, donc `assainirComptes` ne convient pas — et il faut un PLAFOND.
const ETOILES_PAR_NIVEAU_MAX = 3;

function assainirEtoiles(brut: unknown): Record<string, number> {
  const res: Record<string, number> = {};
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return res;
  for (const [niveau, note] of Object.entries(brut as Record<string, unknown>)) {
    if (!/^[1-9][0-9]*$/.test(niveau)) continue;   // la clé est un NUMÉRO de niveau
    const n = Math.min(ETOILES_PAR_NIVEAU_MAX, entierPositif(note));
    if (n > 0) res[niveau] = n;
  }
  return res;
}

function migrerAventure(brut: unknown): EtatBobaQuest['aventure'] {
  const s = sousObjet(brut);
  return {
    ...DEFAUT.aventure,
    ...s,
    // le niveau 0 n'existe pas : le parcours commence au 1 (cf. premierNiveauDuPalier)
    niveauMax: Math.max(1, entierPositif(s.niveauMax)),
    // niveau → 1..3 étoiles. Une clé non numérique est ignorée, une note hors barème est
    // RAMENÉE dans le barème (jamais supprimée : c'est un niveau réellement terminé, et
    // `index.tsx` SOMME ces valeurs pour afficher le total d'étoiles du compte).
    etoiles: assainirEtoiles(s.etoiles),
  };
}

function migrerArene(brut: unknown): EtatBobaQuest['arene'] {
  const s = sousObjet(brut);
  return {
    ...DEFAUT.arene,
    ...s,
    // le rang 0 n'existe pas : l'Arène commence au Maître 1 (cf. recompenseRang)
    rang: Math.max(1, entierPositif(s.rang)),
    equipe: textes(s.equipe),
    victoires: entierPositif(s.victoires),
    defaites: entierPositif(s.defaites),
    serieVictoires: entierPositif(s.serieVictoires),
  };
}

// ====================================================================================
// 🛡️ 27/07 — LA MÊME FAILLE, NEUF FOIS DE PLUS : les sous-objets en SPREAD BRUT.
// ====================================================================================
// `arene` et `aventure` ont été bouclés au lot précédent. Les neuf sous-objets qui
// suivent (`powerups`, `serie`, `queteTampon`, `classement`, `bossHebdo`, `defis`,
// `tournoi`, `pity`, `pass`) se contentaient encore d'un `{ ...DEFAUT.x, ...(sauve.x
// || {}) }` : le brut serveur était donc ADOPTÉ TEL QUEL, champ par champ.
//
// ⚠️ LA RÈGLE À RETENIR : **UNE COMPARAISON N'EST PAS UN GARDE-FOU CONTRE `NaN`.**
// `Math.max(1, NaN)` vaut `NaN` ; `'nawak' < 30` vaut `false` ; `'340' + 26` vaut
// `'34026'`. Un test qui a l'AIR de borner une valeur ne la borne que si la valeur est
// DÉJÀ un nombre. D'où les deux dégâts mesurés sur ce lot :
//   · `pass.xp: 'nawak'` → dans `assurerSemainePass`, `etat.pass.xp < palier.xp` est
//     faux à CHAQUE palier, donc aucun n'est sauté : le rattrapage hebdomadaire octroie
//     LA PISTE ENTIÈRE — +2050 perles, les capsules et la capsule DORÉE finale, très
//     exactement ce que rendrait un `xp: 99999` ;
//   · `classement.pc: 'nawak'` → `appliquerPc` fait `Math.max(0, 'nawak' + 26)` = `NaN` :
//     le tier de saison retombe à Bronze et le PC part au serveur en `pc: null` (JSON
//     n'a pas de `NaN`), DÉFINITIVEMENT et sans un seul message. Symétrique, plus
//     sournois encore : un `pc: '340'` parfaitement LÉGITIME devenait 34026 par
//     concaténation de chaînes, propulsant le joueur au dernier tier.
//
// Le patron est celui de `migrerArene` / `migrerAventure`, appliqué à l'identique :
// DEFAUT en socle → spread du brut (les champs INCONNUS sont CONSERVÉS : une version
// d'app plus récente peut en avoir ajouté, et la sauvegarde doit rester compatible dans
// les deux sens) → chaque champ CONNU ramené dans son domaine. On ASSAINIT, on ne PURGE
// jamais, `undefined` est toléré, et `VERSION_SAUVEGARDE` ne bouge pas.

/** Déballe un sous-objet de sauvegarde. Tout ce qui n'est pas un objet simple (null,
 *  tableau, chaîne, nombre) devient `{}` : le migrateur retombe alors sur le DEFAUT. */
const sousObjet = (brut: unknown): Record<string, unknown> =>
  (brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : {}) as Record<string, unknown>;

/** Champ texte (clé de jour/semaine/mois, id…). Un non-texte devient '' — donc une clé
 *  de période jamais égale à la période courante, donc un reset paresseux propre. */
const texte = (x: unknown): string => (typeof x === 'string' ? x : '');

/** Drapeau. Seul un VRAI `true` compte : `'oui'`, `1` ou `[]` sont truthy en JS mais ne
 *  sont pas des booléens, et un drapeau posé par accident vaut un état incohérent. Même
 *  arbitrage que `migrerTournee` (`run.draftEnAttente === true`), même repli que DEFAUT. */
const drapeau = (x: unknown): boolean => x === true;

/** Liste de chaînes (ids, titres…). Les éléments non textuels sont écartés. */
const textes = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : [];

/** Liste d'INDEX de table (paliers réclamés…). Bornée à la table : un index hors table
 *  ne désigne rien, il ne peut donc rien réclamer — il ne ferait que voyager. */
const indexDeTable = (x: unknown, taille: number): number[] =>
  Array.isArray(x)
    ? [...new Set(x.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n >= 0 && n < taille))]
    : [];

// Munitions spéciales. `acheterPowerup` refuse déjà au-delà de `POWERUPS[id].max` : le
// stock ne peut pas légitimement le dépasser, on le RAMÈNE donc dans le domaine plutôt
// que de laisser un `'nawak'` bloquer l'achat (`'nawak' >= 3` est faux → achat autorisé,
// puis `'nawak' + 1` = `'nawak1'` : le stock devient une chaîne qui grandit).
function migrerPowerups(brut: unknown): EtatBobaQuest['powerups'] {
  const s = sousObjet(brut);
  const connus = {} as Record<PowerupId, number>;
  for (const id of Object.keys(POWERUPS) as PowerupId[]) {
    connus[id] = Math.min(POWERUPS[id].max, entierPositif(s[id]));
  }
  return { ...DEFAUT.powerups, ...s, ...connus };
}

// 🔥 Série quotidienne. `multSerie(jours)` multiplie TOUS les gains de perles : un
// `jours` non numérique contaminerait chaque crédit du jeu d'un seul coup.
function migrerSerie(brut: unknown): EtatBobaQuest['serie'] {
  const s = sousObjet(brut);
  return { ...DEFAUT.serie, ...s, jours: entierPositif(s.jours), dernierJour: texte(s.dernierJour) };
}

// 🎯 Quête « Mon premier tampon » — elle débouche sur un PRIX RÉEL en boutique.
// `etape` INDEXE `QUETE_TAMPON` : hors table, `QUETE_TAMPON[etape].id` lèverait.
function migrerQuete(brut: unknown): EtatBobaQuest['queteTampon'] {
  const s = sousObjet(brut);
  return {
    ...DEFAUT.queteTampon,
    ...s,
    // `etape === QUETE_TAMPON.length` est une valeur LÉGITIME : la quête est terminée.
    etape: Math.min(QUETE_TAMPON.length, entierPositif(s.etape)),
    progres: entierPositif(s.progres),
    reclamee: drapeau(s.reclamee),
  };
}

// 🏆 Ligue classée. `pc` est la valeur la plus exposée du lot : elle est lue par
// `tierPourPc`, incrémentée par `appliquerPc`, et poussée au serveur à chaque écriture.
function migrerClassement(brut: unknown): EtatBobaQuest['classement'] {
  const s = sousObjet(brut);
  const attente = sousObjet(s.recompenseEnAttente);
  return {
    ...DEFAUT.classement,
    ...s,
    pc: entierPositif(s.pc),
    saison: texte(s.saison),
    // le tier est un INDEX de `TIERS` : au-delà, `TIERS[id]` rendrait `undefined`.
    meilleurTierSaison: Math.min(TIERS.length - 1, entierPositif(s.meilleurTierSaison)),
    // récompense de fin de saison : conservée si elle désigne une saison ET un tier
    // réels, sinon effacée — une récompense qui ne désigne rien n'est pas réclamable.
    recompenseEnAttente: texte(attente.saison)
      ? { saison: texte(attente.saison), tierId: Math.min(TIERS.length - 1, entierPositif(attente.tierId)) }
      : null,
    titres: textes(s.titres),
  };
}

// 👹 Boss de la semaine.
function migrerBossHebdo(brut: unknown): EtatBobaQuest['bossHebdo'] {
  const s = sousObjet(brut);
  return { ...DEFAUT.bossHebdo, ...s, semaine: texte(s.semaine), battu: drapeau(s.battu) };
}

// ⚔️ Défis d'amis du jour. `resolus` et `historique` sont PARCOURUS par les écrans :
// une chaîne à la place d'un tableau, et `.map` lève au rendu.
function migrerDefis(brut: unknown): EtatBobaQuest['defis'] {
  const s = sousObjet(brut);
  return {
    ...DEFAUT.defis,
    ...s,
    jour: texte(s.jour),
    resolus: textes(s.resolus),
    historique: Array.isArray(s.historique)
      ? s.historique.flatMap((ligne) => {
        const l = sousObjet(ligne);
        return texte(l.ami) ? [{ ami: texte(l.ami), gagne: drapeau(l.gagne) }] : [];
      })
      : [],
  };
}

// 🏟️ Tournoi hebdomadaire. `etape` indexe `TOURNOI_RECOMPENSES` (déjà borné à la
// lecture) et sert de garde à `retenterTournoi` (`etape >= 3`).
function migrerTournoi(brut: unknown): EtatBobaQuest['tournoi'] {
  const s = sousObjet(brut);
  return {
    ...DEFAUT.tournoi,
    ...s,
    semaine: texte(s.semaine),
    // `TOURNOI_RECOMPENSES.length` = champion : l'étape d'après la dernière est légitime.
    etape: Math.min(TOURNOI_RECOMPENSES.length, entierPositif(s.etape)),
    elimine: drapeau(s.elimine),
    trophees: entierPositif(s.trophees),
  };
}

// 🎰 Compteurs d'anti-malchance. Un compteur non numérique casse le pity : la garantie
// « une légendaire tous les N tirages » ne se déclencherait plus jamais.
function migrerPity(brut: unknown): EtatBobaQuest['pity'] {
  const s = sousObjet(brut);
  return { ...DEFAUT.pity, ...s, epique: entierPositif(s.epique), legendaire: entierPositif(s.legendaire) };
}

// 🎫 Boba Pass hebdomadaire — LA faille A de ce lot (cf. l'encadré ci-dessus).
function migrerPass(brut: unknown): EtatBobaQuest['pass'] {
  const s = sousObjet(brut);
  return {
    ...DEFAUT.pass,
    ...s,
    semaine: texte(s.semaine),
    xp: entierPositif(s.xp),
    // index de paliers déjà réclamés : hors table, ils ne désignent aucune récompense.
    reclames: indexDeTable(s.reclames, PASS_PALIERS.length),
  };
}

// 📊 Stats du jour. Même spread brut, et deux de ces compteurs sont des GARDE-FOUS
// ANTI-FARM (`duelsMises`, `tourneesLancees`) comparés à un plafond : `'nawak' < 6`
// étant faux, un compteur sale ouvrait le robinet. Le reset paresseux d'`assurerJour`
// ne rattrape rien tant que `jour` porte, lui, la clé du jour courant.
function migrerStatsJour(brut: unknown): EtatBobaQuest['statsJour'] {
  const s = sousObjet(brut);
  const socle = STATS_JOUR_VIERGES('');
  const compteurs = {} as Record<string, number>;
  for (const cle of Object.keys(socle)) {
    if (cle !== 'jour') compteurs[cle] = entierPositif(s[cle]);
  }
  return { ...socle, ...s, ...compteurs, jour: texte(s.jour) } as EtatBobaQuest['statsJour'];
}

// 🛡️ Plafonds MENSUELS de la boutique — le compteur qui protège les PRIX RÉELS.
// `acheterBoutique` fait `const pris = achats[id] || 0; if (pris >= palier.parMois) return null;`
// puis `achats[id] = pris + 1`. Avec `achats: { 'boisson-l': 'nawak' }` : `'nawak' >= 1`
// est faux → achat autorisé, puis `'nawak' + 1` = `'nawak1'` → toujours faux : BOISSONS
// RÉELLES EN ILLIMITÉ, mois après mois. Les clés inconnues sont conservées (un article
// retiré du catalogue peut y revenir), seules les valeurs sont ramenées à des entiers.
function migrerPrixMois(brut: unknown): EtatBobaQuest['prixMois'] {
  const s = sousObjet(brut);
  const achatsBruts = { ...sousObjet(s.achats), ...(s.boissons ? { 'boisson-l': s.boissons } : {}) };
  const achats: Record<string, number> = {};
  for (const [id, n] of Object.entries(achatsBruts)) achats[id] = entierPositif(n);
  return { mois: texte(s.mois), achats };
}

function migrerCurseurAchatsPasseport(brut: unknown): EtatBobaQuest['curseurAchatsPasseport'] {
  const s = sousObjet(brut);
  const creeLe = texte(s.creeLe);
  if (!creeLe || !Number.isFinite(Date.parse(creeLe))) return null;
  const ids = Array.isArray(s.ids)
    ? [...new Set(s.ids
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 120))]
      .slice(0, 500)
    : [];
  return ids.length > 0 ? { creeLe, ids } : null;
}

// Une sauvegarde vide mais analysable (`"{}"`) produisait un état DEFAUT valide, donc
// « prête », donc `dernierSerialise = "{}"` — et au PREMIER emit() la copie de secours
// devenait à son tour `"{}"`. La progression était alors définitivement perdue. On
// exige désormais qu'une sauvegarde ressemble à une sauvegarde.
function ressembleAUneSauvegarde(s: Record<string, unknown>): boolean {
  return 'perles' in s || 'collection' in s || 'aventure' in s || 'versionSauvegarde' in s;
}

function migrerSauvegarde(brut: string): EtatBobaQuest | null {
  try {
    const sauve = JSON.parse(brut);
    if (!sauve || typeof sauve !== 'object' || Array.isArray(sauve)) return null;
    if (!ressembleAUneSauvegarde(sauve)) return null;
    // 🩹 26/07 : `versionSauvegarde` était écrit mais JAMAIS lu — il donnait l'illusion
    // d'un versionnement. Un downgrade d'app (réinstallation d'un APK plus ancien)
    // faisait avaler une sauvegarde plus récente par un code plus vieux, qui la
    // réécrivait en perdant les champs qu'il ne connaît pas, sans aucun signal.
    if (entierPositif(sauve.versionSauvegarde) > VERSION_SAUVEGARDE) return null;
    // assainie une seule fois : elle sert AUSSI d'amorçage conservateur du champ
    // `exemplairesPasseport` pour les sauvegardes d'avant le LOT E (cf. ci-dessous).
    const collection = assainirComptes(sauve.collection, (id) => !!trouverCollectible(id));
    return {
      ...JSON.parse(JSON.stringify(DEFAUT)),
      ...sauve,
      versionSauvegarde: VERSION_SAUVEGARDE,
      // scalaires : un NaN, un null ou une chaîne casseraient toute l'arithmétique
      perles: entierPositif(sauve.perles),
      eclats: entierPositif(sauve.eclats),
      capsulesGratuites: entierPositif(sauve.capsulesGratuites),
      capsulesDoreesGratuites: entierPositif(sauve.capsulesDoreesGratuites),
      meilleurScore: entierPositif(sauve.meilleurScore),
      partiesJouees: entierPositif(sauve.partiesJouees),
      capsulesOuvertes: entierPositif(sauve.capsulesOuvertes),
      // le champ central, enfin protégé comme ses voisins
      collection,
      setsReclames: Array.isArray(sauve.setsReclames)
        ? sauve.setsReclames.filter((x: unknown): x is SetId => typeof x === 'string' && x in SETS)
        : [],
      defisReclames: Array.isArray(sauve.defisReclames)
        ? sauve.defisReclames.filter((x: unknown): x is string => typeof x === 'string')
        : [],
      gains: migrerGains(sauve.gains),
      powerups: migrerPowerups(sauve.powerups),
      serie: migrerSerie(sauve.serie),
      queteTampon: migrerQuete(sauve.queteTampon),
      aventure: migrerAventure(sauve.aventure),
      arene: migrerArene(sauve.arene),
      classement: migrerClassement(sauve.classement),
      bossHebdo: migrerBossHebdo(sauve.bossHebdo),
      // prixMois v2 : plafond PAR ARTICLE ({achats}). Convertit l'ancien schéma
      // v1 {boissons: n} ; l'ex-quota hebdo (prixSemaine) est abandonné, ignoré au chargement.
      prixMois: migrerPrixMois(sauve.prixMois),
      // 🤝 comptoir de troc v2 : { jour, faits[] } — migration tolérante de la v1
      // { jour, fait } (un troc fait aujourd'hui devient l'offre 'sam' réalisée).
      trocJour: migrerTrocJour(sauve.trocJour),
      defis: migrerDefis(sauve.defis),
      consommables: assainirComptes(sauve.consommables, (id) => (CONSOMMABLE_IDS as string[]).includes(id)),
      objets: assainirComptes(sauve.objets, (id) => (OBJET_IDS as string[]).includes(id)),
      portes: migrerPortes(sauve.portes),
      tournoi: migrerTournoi(sauve.tournoi),
      niveauxCartes: assainirComptes(sauve.niveauxCartes, (id) => !!trouverCollectible(id)),
      // 👅 rangs de Goût : champ ADDITIF — absent avant le LOT E → {} ; rangs bornés
      // 0..GOUT_MAX, entrées sales ignorées, jamais de purge.
      goutCartes: migrerGout(sauve.goutCartes),
      // 🎫 exemplaires déjà octroyés par le Passeport : champ ADDITIF. S'il manque (toute
      // sauvegarde antérieure au LOT E), on l'amorce sur la collection — migration
      // CONSERVATRICE : rien n'est octroyé rétroactivement, rien n'est retiré.
      exemplairesPasseport: migrerExemplairesPasseport(sauve.exemplairesPasseport, collection),
      // 🔔 curseur purement opérationnel : évite de refêter le même achat après un
      // redémarrage ou sur un second téléphone. Absent des anciennes sauvegardes → null.
      curseurAchatsPasseport: migrerCurseurAchatsPasseport(sauve.curseurAchatsPasseport),
      // 🎖️ talents par carte : champ ADDITIF — absent des anciennes sauvegardes → {} ;
      // seuls les choix 'a'/'b' valides sur 4/7/10 sont conservés, jamais de purge.
      talentsCartes: migrerTalents(sauve.talentsCartes),
      // 🗺️ Tournée des Maîtres : champ ADDITIF — run partielle tolérée, record conservé.
      tournee: migrerTournee(sauve.tournee),
      // 🏅 palmarès par carte : champ ADDITIF — absent des anciennes sauvegardes
      // → {} ; entrées partielles/sales assainies, jamais de purge.
      exploits: migrerExploits(sauve.exploits),
      pity: migrerPity(sauve.pity),
      pass: migrerPass(sauve.pass),
      statsJour: migrerStatsJour(sauve.statsJour),
      // 🧋 visites : champ ADDITIF — absent d'avant le 26/07, assaini sans purge
      visites: migrerVisites(sauve.visites),
      tourneesOffertes: entierPositif(sauve.tourneesOffertes),
      revision: entierPositif(sauve.revision),
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
      principalSain = true;   // 🩹 26/07 : autorise l'écriture de la copie de secours
      hydratation = 'prete';
      return;
    }

    const secoursBrut = await AsyncStorage.getItem(CLE_SAUVEGARDE_SECOURS);
    const secours = secoursBrut ? migrerSauvegarde(secoursBrut) : null;
    if (secours) {
      etat = secours;
      dernierSerialise = JSON.stringify(secours);
      await AsyncStorage.setItem(CLE_SAUVEGARDE, dernierSerialise);
      principalSain = true;
      hydratation = 'recuperee';
      return;
    }

    if (principalBrut || secoursBrut) {
      hydratation = 'erreur';   // fail-closed : on n'écrit RIEN par-dessus
    } else {
      principalSain = true;     // première partie : rien à protéger
      hydratation = 'prete';
    }
  } catch {
    hydratation = 'erreur';
  } finally {
    notifier();
  }
}

void hydraterSauvegarde();

// 🩹 26/07 — LES ÉCHECS D'ÉCRITURE NE SONT PLUS SILENCIEUX. `EtatHydratationBobaQuest`
// ne couvrait que la LECTURE : sur un téléphone au stockage plein (SQLITE_FULL, très
// courant sur l'entrée de gamme Android), chaque `setItem` échouait sans un mot. Le
// joueur enchaînait les niveaux, ouvrait ses capsules, achetait un tampon à 8 000
// perles… et tout était revenu en arrière au lancement suivant. L'écran d'erreur
// promet pourtant « aucune nouvelle partie ne sera enregistrée par-dessus » — promesse
// qui n'avait aucun équivalent côté écriture. Trois échecs consécutifs suffisent à
// prévenir le joueur (bandeau non bloquant : sa progression n'est plus enregistrée).
const ECHECS_ECRITURE_AVANT_ALERTE = 3;
let echecsEcriture = 0;
let ecritureImpossible = false;

export function useEcritureImpossible(): boolean {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => ecritureImpossible,
  );
}

// 🩹 26/07 — La copie de secours n'est écrite que si la sauvegarde principale a été lue
// SAINE. Sinon, un principal vide mais analysable devenait le backup au premier emit(),
// et la vraie progression était définitivement écrasée.
let principalSain = false;

function planifierEcriture(serialise: string) {
  fileEcriture = fileEcriture
    .catch(() => {})
    .then(async () => {
      const precedent = dernierSerialise;
      if (principalSain && precedent && precedent !== serialise) {
        await AsyncStorage.setItem(CLE_SAUVEGARDE_SECOURS, precedent).catch(() => {});
      }
      await AsyncStorage.setItem(CLE_SAUVEGARDE, serialise);
      dernierSerialise = serialise;
      principalSain = true;
      if (echecsEcriture > 0) echecsEcriture = 0;
      if (ecritureImpossible) { ecritureImpossible = false; notifier(); }
    })
    .catch((erreur) => {
      echecsEcriture += 1;
      if (echecsEcriture >= ECHECS_ECRITURE_AVANT_ALERTE && !ecritureImpossible) {
        ecritureImpossible = true;
        notifier();
      }
      if (__DEV__) console.warn('Boba Quest : sauvegarde locale impossible', erreur);
    });
}

function emit() {
  // 💾 Chaque modification fait avancer la révision : c'est elle qui permettra au serveur
  // de savoir qui, du téléphone ou de la sauvegarde, est en avance. Monotone par
  // construction — jamais décrémentée, jamais remise à zéro (sauf reset explicite).
  etat = { ...etat, revision: (etat.revision || 0) + 1 };
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

// --- 🚦 L'INTERRUPTEUR DU PASSEPORT, VALEUR VIVANTE (27/07/2026) ----------------------
// `PASSEPORT_ACTIF` (economie.ts) n'est plus que le DÉFAUT COMPILÉ. La vérité vient de
// `app_config`, clé `passeport_carte`, exactement comme le flag `jeu` — parce que le jour
// de la bascule le vivier des capsules se restreint d'un coup, et qu'il faut pouvoir
// revenir en arrière EN SECONDES si c'est trop dur, pas en une OTA.
//
// RÉPARTITION DES RÔLES, ET ELLE EST STRICTE :
//   · `lib/app-config.ts` parle au RÉSEAU (Supabase) et pousse la valeur lue ici ;
//   · ce store la PORTE, la relit, et la garde en cache AsyncStorage — il n'appelle
//     jamais Supabase. AsyncStorage n'est pas le réseau : c'est déjà son support.
// Le cache est relu au DÉMARRAGE du module. Sans lui, l'interrupteur ne serait effectif
// qu'après le passage sur un écran qui pense à le rafraîchir, et un joueur qui file droit
// sur les capsules ouvrirait un vivier non restreint.
//
// CE N'EST PAS DE L'ÉTAT JOUEUR. Volontairement HORS `EtatBobaQuest` : pas de champ
// persisté dans la sauvegarde, pas de `emit()`, donc pas de `revision` incrémentée ni de
// poussée serveur. Une config d'exploitation n'a rien à faire dans la sauvegarde d'un
// joueur — elle y voyagerait d'un téléphone à l'autre et survivrait à une marche arrière.
// `resetBobaQuest()` ne la remet pas non plus : effacer sa partie ne rouvre pas une
// collection que l'exploitant a fermée.
const CLE_CACHE_PASSEPORT = 'appConfig.passeportActif';

let passeportActifCourant: boolean = PASSEPORT_ACTIF;
// Une réponse SERVEUR fait autorité sur le cache pour toute la session : si elle arrive
// avant que la lecture AsyncStorage (asynchrone, lancée au chargement du module) ne se
// termine, le cache périmé ne doit surtout pas l'écraser au retour.
let passeportServeurConnu = false;

/** L'interrupteur du Passeport, tel qu'il vaut MAINTENANT sur ce téléphone. */
export function passeportActif(): boolean {
  return passeportActifCourant;
}

/** Pose la valeur de l'interrupteur.
 *  @param serveur `true` = elle vient d'une lecture réseau RÉUSSIE : elle prime alors sur
 *  le cache pour le reste de la session, et elle est mémorisée pour le prochain
 *  démarrage. `false` = elle vient du cache local, et elle s'efface devant le serveur.
 *  N'écrit RIEN dans la sauvegarde du joueur : on notifie juste les écrans montés. */
export function definirPasseportActif(actif: boolean, serveur: boolean = false): void {
  if (!serveur && passeportServeurConnu) return;   // le serveur a déjà tranché
  if (serveur) {
    passeportServeurConnu = true;
    // mémorisé À PART de la sauvegarde de partie : une config ne doit jamais pouvoir
    // corrompre `bobaQuest.etat`, ni faire échouer son écriture.
    AsyncStorage.setItem(CLE_CACHE_PASSEPORT, actif ? '1' : '0').catch(() => {});
  }
  if (passeportActifCourant === actif) return;
  passeportActifCourant = actif;
  notifier();
}

// Repli : cache absent, illisible ou de forme inconnue → on garde le défaut compilé
// (`false`). Fail-closed dans le bon sens : mieux vaut une collection ouverte par erreur
// qu'une collection fermée par erreur — la seconde fait fuir le joueur, pas la première.
async function hydraterPasseport(): Promise<void> {
  try {
    const brut = await AsyncStorage.getItem(CLE_CACHE_PASSEPORT);
    if (brut === '1' || brut === 'true') definirPasseportActif(true);
    else if (brut === '0' || brut === 'false') definirPasseportActif(false);
  } catch { /* stockage HS : le défaut compilé fait office de repli */ }
}

void hydraterPasseport();

/** Hook d'écran : re-rend quand l'interrupteur bascule à distance. */
export function usePasseportActif(): boolean {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => passeportActifCourant,
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

// Le Boba Pass repart de zéro chaque lundi (XP + paliers réclamés).
// 🩹 26/07 — AVANT DE REMETTRE À ZÉRO, on crédite automatiquement les paliers ATTEINTS
// mais jamais réclamés. Auparavant ils disparaissaient en silence le lundi : un joueur
// qui débloquait le palier final le dimanche soir (capsule DORÉE + 500 perles) sans
// toucher « Réclamer » perdait tout, sans notification ni avertissement. Le pass est la
// carotte de rétention n°1 du jeu : se faire voler une fois suffit à ne plus revenir.
// Les gains crédités automatiquement sont exposés via `passRattrape` (récap au retour).
let passRattrapeEnAttente: { perles: number; capsules: number; capsulesDorees: number } | null = null;

function assurerSemainePass() {
  const semaine = cleSemaine();
  if (etat.pass.semaine === semaine) return;
  let perles = 0; let capsules = 0; let dorees = 0;
  PASS_PALIERS.forEach((palier, i) => {
    if (etat.pass.xp < palier.xp || etat.pass.reclames.includes(i)) return;
    if (palier.type === 'perles') perles += palier.qte;
    else if (palier.type === 'capsule') capsules += palier.qte;
    else if (palier.type === 'capsule_doree') dorees += palier.qte;
    if (palier.perlesBonus) perles += palier.perlesBonus;
  });
  if (perles || capsules || dorees) {
    etat.perles += perles;
    etat.capsulesGratuites += capsules;
    etat.capsulesDoreesGratuites += dorees;
    const av = passRattrapeEnAttente;
    passRattrapeEnAttente = {
      perles: (av?.perles ?? 0) + perles,
      capsules: (av?.capsules ?? 0) + capsules,
      capsulesDorees: (av?.capsulesDorees ?? 0) + dorees,
    };
  }
  etat.pass = { semaine, xp: 0, reclames: [] };
}

/** Récompenses de pass créditées d'office au changement de semaine (à afficher une
 *  fois au joueur, puis consommer). Retourne null s'il n'y a rien à annoncer. */
export function consommerPassRattrape(): { perles: number; capsules: number; capsulesDorees: number } | null {
  const r = passRattrapeEnAttente;
  passRattrapeEnAttente = null;
  return r;
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
  // 🧋 26/07 : le ×2 « Gorgée Fraîche » (visite réelle de moins de 24 h) s'ajoute aux
  // multiplicateurs existants. Le plafond FINAL (PERLES_MAX_FINAL) borne le cumul.
  const gain = Math.round(montant * evenementDuJour().multiplicateur * multSerie(etat.serie.jours)
    * multGorgee(etat.visites));
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
  // 🩹 26/07 : le hub appelle tickSerie à chaque arrivée — c'est le point de passage
  // le plus fiable pour purger les périodes échues (et rattraper les paliers de pass
  // non réclamés) même si le joueur ne lance aucune partie de la semaine.
  const avantRattrape = passRattrapeEnAttente;
  assurerSemainePass();
  const maintenant = new Date();
  const hier = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() - 1);
  const r = serieApresTick(etat.serie, cleJour(maintenant), cleJour(hier));
  if (!r) {
    // rien pour la série aujourd'hui, mais le pass a peut-être été rattrapé
    if (passRattrapeEnAttente !== avantRattrape) emit();
    return null;
  }
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
    id: `quete-tampon-${Date.now()}`, code: 'quete_premier_tampon', label: '+1 tampon', origine: 'quete',
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
    // 🩹 26/07 : la garantie se déclenche à `pity.X + 1 >= PITY_X`, donc le compteur
    // ne dépassait jamais PITY_X − 1 et ce « restant » ne valait jamais 0 : la barre
    // de la machine plafonnait à 90 % et l'état « PROCHAINE GARANTIE ! » était du code
    // mort. On renvoie le nombre de capsules restantes AVANT la garantie incluse.
    epique: Math.max(0, PITY_EPIQUE - 1 - e.pity.epique),
    legendaire: Math.max(0, PITY_LEGENDAIRE - 1 - e.pity.legendaire),
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

function nouveauGain(
  type: Gain['type'], qte: number, origine: Gain['origine'],
  label: string | undefined, code: CodeRecompenseReelle,
): Gain {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    code, type, qte,
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
// 🩹 26/07 — PLAFOND FINAL. `perlesPourScore` (450) et `NIVEAU_PERLES_MAX` (650)
// plafonnent la conversion score → perles, donc AVANT le ×2 du jour, le ×2 du week-end,
// le ×1,3 de série et le % du copain Fruité : ils ne bornaient rien. Une partie
// d'Infini pouvait rapporter 2 808 perles pendant que l'écran affichait « ≤ 450 ».
// `mode` applique le plafond réel sur le montant CRÉDITÉ (cf. PERLES_MAX_FINAL).
function appliquerBonusJour(perles: number, mode?: ModeGain): { perles: number; bonusJour: boolean } {
  const bonus = bonusJourDispo();
  etat.dernierJourJoue = cleJour();
  const avecBonus = bonus ? perles * BONUS_PREMIERE_PARTIE : perles;
  const gain = perlesEvenement(avecBonus);
  return { perles: mode ? Math.min(PERLES_MAX_FINAL[mode], gain) : gain, bonusJour: bonus };
}

/** Estimation du gain d'une partie AVANT de la terminer (HUD, écran Infini) : même
 *  chaîne de calcul que le crédit réel, plafond final inclus. Évite que le HUD
 *  sous-estime le gain d'un facteur 2 à 5 — un bonus non annoncé est un bonus perdu. */
export function estimerGainPartie(base: number, mode: ModeGain, e: EtatBobaQuest = etat): number {
  const avecBuddy = Math.round(base * (1 + effetBuddyActuel(e).perlesPct / 100));
  const avecJour = bonusJourDispo(e) ? avecBuddy * BONUS_PREMIERE_PARTIE : avecBuddy;
  const brut = Math.round(avecJour * evenementDuJour().multiplicateur * multSerie(e.serie.jours));
  return Math.min(PERLES_MAX_FINAL[mode], brut);
}

// Mode INFINI : perles selon le score (plafonnées), record — AUCUNE capsule.
// 🎁 À partir de 500 pts, chance de BUTIN : un consommable tiré au sort (rng injectable).
export function finPartieInfini(stats: StatsPartie, rng: () => number = Math.random): {
  perlesGagnees: number; bonusJour: boolean; record: boolean;
  butin: { id: ConsommableId; ajoute: number; convertisPerles: number } | null;
} {
  crediterQuete('infini');
  majStatsPartie(stats);
  const base = Math.round(perlesPourScore(stats.score) * (1 + effetBuddyActuel().perlesPct / 100));
  const { perles, bonusJour } = appliquerBonusJour(base, 'infini');
  const record = stats.score > etat.meilleurScore;
  if (record) etat.meilleurScore = stats.score;
  etat.perles += perles;
  gagnerXpPass(PASS_XP.partieInfini);
  let butin: { id: ConsommableId; ajoute: number; convertisPerles: number } | null = null;
  if (rng() < probaButinInfini(stats.score)) {
    const id = tirerButinConso(rng);
    const r = gagnerConsommable(id); // emit interne (plafond + conversion)
    butin = { id, ajoute: r.ajoute, convertisPerles: r.convertisPerles };
  }
  emit();
  return { perlesGagnees: perles, bonusJour, record, butin };
}

// AVENTURE — victoire : étoiles, perles, capsule à la 1ʳᵉ réussite (dorée au boss).
// 🎁 Chance de BUTIN consommable (× étoiles, boss ×1,5, moitié au rejeu) — rng injectable.
export function terminerNiveau(
  niveau: number, etoiles: number, boss: boolean, stats: StatsPartie,
  rng: () => number = Math.random,
): {
  perlesGagnees: number; bonusJour: boolean; premiere: boolean;
  capsule: TypeCapsule | null; etoiles: number;
  butin: { id: ConsommableId; ajoute: number; convertisPerles: number } | null;
} {
  crediterQuete('niveaux');
  majStatsPartie(stats);
  etat.statsJour.niveauxTermines += 1;
  const premiere = !etat.aventure.etoiles[String(niveau)];
  let base = premiere
    ? Math.floor(stats.score / NIVEAU_DIV_SCORE) + etoiles * NIVEAU_PERLES_PAR_ETOILE
    : Math.floor(stats.score / NIVEAU_DIV_REJOUER);
  base = Math.round(base * (1 + effetBuddyActuel().perlesPct / 100));
  const { perles, bonusJour } = appliquerBonusJour(Math.min(NIVEAU_PERLES_MAX, base), 'aventure');
  etat.perles += perles;

  let capsule: TypeCapsule | null = null;
  if (premiere) {
    capsule = capsuleDuNiveau(niveau, boss);
    if (capsule === 'doree') etat.capsulesDoreesGratuites += 1;
    else if (capsule === 'classique') etat.capsulesGratuites += 1;
    else etat.perles += NIVEAU_PRIME_EXPLORATION; // prime d'exploration (compense la capsule)
  }
  gagnerXpPass(premiere ? PASS_XP.niveauPremiere : PASS_XP.niveauRejoue);
  etat.aventure.etoiles = {
    ...etat.aventure.etoiles,
    [String(niveau)]: Math.max(etoiles, etat.aventure.etoiles[String(niveau)] || 0),
  };
  etat.aventure.niveauMax = Math.max(etat.aventure.niveauMax, niveau + 1);
  let butin: { id: ConsommableId; ajoute: number; convertisPerles: number } | null = null;
  if (rng() < probaButinNiveau(etoiles, boss, premiere)) {
    const id = tirerButinConso(rng);
    const r = gagnerConsommable(id); // emit interne (plafond + conversion)
    butin = { id, ajoute: r.ajoute, convertisPerles: r.convertisPerles };
  }
  emit();
  return { perlesGagnees: perles, bonusJour, premiere, capsule, etoiles, butin };
}

// AVENTURE — défaite (ou abandon) : petite consolation.
// 🩹 26/07 — Cette fonction posait `dernierJourJoue` (donc CONSOMMAIT le bonus ×2 de
// la 1ʳᵉ partie du jour) sans jamais l'appliquer, et sautait aussi le ×2 du week-end
// et le multiplicateur de série. Rater son premier niveau un samedi coûtait le bonus
// de toute la journée. Elle passe maintenant par le même point unique que les autres
// fins de partie (`appliquerBonusJour`), qui pose le drapeau ET applique les gains.
export function echecNiveau(stats: StatsPartie): { perlesGagnees: number; bonusJour: boolean } {
  majStatsPartie(stats);
  const base = Math.floor(stats.score / NIVEAU_DIV_ECHEC);
  const { perles, bonusJour } = appliquerBonusJour(base, 'aventure');
  etat.perles += perles;
  emit();
  return { perlesGagnees: perles, bonusJour };
}

// --- 💾 SYNCHRONISATION AVEC LA SAUVEGARDE SERVEUR -----------------------------------
// Le store ne parle PAS au réseau (il n'a jamais parlé au réseau, et c'est bien ainsi) :
// il expose seulement de quoi lire et remplacer son état. `lib/sauvegarde-jeu.ts` fait
// les allers-retours et décide, à partir des helpers PURS d'economie.ts.

/** Instantané destiné à la sauvegarde serveur. `null` si l'état n'est pas fiable —
 *  auquel cas il ne faut RIEN pousser (on écraserait une bonne sauvegarde). */
export function instantaneEtat(): { revision: number; etat: EtatBobaQuest; vierge: boolean } | null {
  if (hydratation === 'chargement' || hydratation === 'erreur') return null;
  return {
    revision: etat.revision || 0,
    etat: JSON.parse(JSON.stringify(etat)) as EtatBobaQuest,
    vierge: etatEstVierge(etat),
  };
}

/** Adopte la sauvegarde serveur : le téléphone était en retard. On passe par
 *  `migrerSauvegarde` — la sauvegarde serveur reçoit exactement le même assainissement
 *  qu'une sauvegarde locale (champs additifs, valeurs sales, version future refusée). */
export function adopterEtatServeur(brut: unknown, revisionServeur: number): boolean {
  if (hydratation === 'erreur') return false;
  let serialise: string;
  try { serialise = typeof brut === 'string' ? brut : JSON.stringify(brut); } catch { return false; }
  const migre = migrerSauvegarde(serialise);
  if (!migre) return false;
  // la révision qui fait foi est celle du SERVEUR : sinon le téléphone se croirait
  // aussitôt en avance et repousserait ce qu'il vient d'adopter.
  etat = { ...migre, revision: Math.max(revisionServeur, migre.revision || 0) };
  hydratation = 'prete';
  notifier();
  planifierEcriture(JSON.stringify(etat));
  return true;
}

// --- 🎫 LE PASSEPORT DE LA CARTE : les achats réels débloquent les personnages --------
// `lib/achats.ts` lit l'historique publié par la caisse ; ici on le TRADUIT en cartes.
//
// TROIS PROPRIÉTÉS VOULUES :
//  • MONOTONE — on ne retire JAMAIS une carte. Si la lecture réseau échoue, si la
//    rétention serveur purge un vieil achat, si le joueur change de téléphone : ce qui
//    est acquis reste acquis. `Math.max` partout, aucune soustraction.
//  • IDEMPOTENTE — appelable à chaque ouverture du jeu sans rien accumuler à tort.
//  • CUMULATIVE avec le reste — une carte gagnée en capsule (avant l'activation du
//    Passeport) n'est jamais dégradée.
//
// 🔴 CORRECTION DU 26/07 (LOT E5) — DOUBLONS RÉGÉNÉRABLES À VOLONTÉ.
// Cette fonction comparait `exemplairesParAchats()` à la COLLECTION VIVANTE. Or
// `entrainerCarte` DÉCRÉMENTE cette même collection aux paliers d'évolution 4/7/10. Le
// cycle « j'entraîne, je quitte l'écran Collection, je le rouvre » remettait donc le
// doublon consommé — indéfiniment, sans un seul achat de plus. Mesuré sur 12 achats
// réels de Milk tea Taro : les 6 doublons exigés pour monter Taro Queen au niveau 10
// étaient tous rendus (6 × DOUBLON_PERLES.legendaire = 4 800 perles de matière offerte),
// et la pompe brute recréait 1 exemplaire par tour, sans borne.
// La faille n'était PAS gardée par `PASSEPORT_ACTIF` : cette fonction s'exécute quel que
// soit l'interrupteur, elle attendait seulement que `chargerAchats()` renvoie des lignes.
//
// → On compare désormais à `exemplairesPasseport[id]`, c'est-à-dire ce que le Passeport a
// DÉJÀ OCTROYÉ. Ce compteur ne bouge que ici, et jamais à la baisse : ce que le joueur
// fait ensuite de ses cartes (entraînement, fonte au troc) ne rouvre plus le robinet.
// Le total offert reste borné par les achats réels : `floor(achats / nb)`, un point.
export function appliquerPasseport(lignes: LigneAchat[]): { nouvelles: string[]; exemplaires: number } {
  if (hydratation === 'erreur') return { nouvelles: [], exemplaires: 0 };
  const nouvelles: string[] = [];
  let exemplaires = 0;
  const collection = { ...etat.collection };
  const octroyes = { ...etat.exemplairesPasseport };
  for (const c of COLLECTIBLES) {
    const vise = exemplairesParAchats(c.id, lignes);
    if (vise <= 0) continue;
    const deja = octroyes[c.id] || 0;
    if (vise <= deja) continue;       // MONOTONE : jamais de reprise, jamais de re-don
    const enPlus = vise - deja;
    if ((collection[c.id] || 0) === 0) nouvelles.push(c.id);
    exemplaires += enPlus;
    collection[c.id] = (collection[c.id] || 0) + enPlus; // on AJOUTE, on ne rétablit pas
    octroyes[c.id] = vise;
  }
  if (nouvelles.length === 0 && exemplaires === 0) return { nouvelles: [], exemplaires: 0 };
  etat.collection = collection;
  etat.exemplairesPasseport = octroyes;
  emit();
  return { nouvelles, exemplaires };
}

// --- 👅 LOT E · LE GOÛT : les cartes évoluent avec ce que le client consomme -----------
// Même contrat que le Passeport (MONOTONE, IDEMPOTENT, sans réseau), mais sans jamais
// rien fermer : le Goût n'est qu'un bonus qui monte. Le barème et le mapping vivent dans
// `economie.ts` (`rangGout`, qui réutilise `DEBLOCAGE_CARTES`) — le store ne fait
// qu'appliquer, il ne calcule aucune règle.

/** Une carte dont le rang de Goût vient de monter (l'écran peut le fêter). */
export type MonteeGout = { id: string; avant: number; rang: number };

/** Fait monter les rangs de Goût d'après les achats réels. MONOTONE (`Math.max`, aucune
 *  soustraction : un historique tronqué par la rétention serveur ne dégrade rien),
 *  IDEMPOTENTE (rappelable à chaque ouverture de l'écran), un seul `emit()` en fin. */
export function appliquerGout(lignes: LigneAchat[]): MonteeGout[] {
  if (hydratation === 'erreur') return [];
  const montees: MonteeGout[] = [];
  const gouts = { ...etat.goutCartes };
  for (const c of COLLECTIBLES) {
    const avant = gouts[c.id] || 0;
    const apres = Math.max(avant, rangGout(c.id, lignes));
    if (apres > avant) { gouts[c.id] = apres; montees.push({ id: c.id, avant, rang: apres }); }
  }
  if (montees.length === 0) return [];   // idempotent : rien changé, rien écrit
  etat.goutCartes = gouts;
  emit();
  return montees;
}

export type AchatAvecCurseur = LigneAchat & { id: string; creeLe: string };

/** Lignes arrivées après la dernière confirmation montrée dans le jeu. PUR par lecture :
 *  ne déplace pas le curseur ; un échec d'application ne peut donc pas perdre l'avis. */
export function achatsPasseportNonVus(
  lignes: AchatAvecCurseur[],
  e: EtatBobaQuest = etat,
): AchatAvecCurseur[] {
  const curseur = e.curseurAchatsPasseport;
  if (!curseur) return lignes.filter((l) => Number.isFinite(Date.parse(l.creeLe)));
  const instant = Date.parse(curseur.creeLe);
  const ids = new Set(curseur.ids);
  return lignes.filter((l) => {
    const t = Date.parse(l.creeLe);
    return Number.isFinite(t) && (t > instant || (t === instant && !ids.has(l.id)));
  });
}

/** Déplace le curseur jusqu'à la dernière ligne effectivement traitée. Monotone,
 *  idempotent, et persisté dans la sauvegarde de compte pour éviter une seconde
 *  notification sur un autre téléphone. */
export function marquerAchatsPasseportVus(lignes: AchatAvecCurseur[]): boolean {
  if (hydratation === 'erreur' || lignes.length === 0) return false;
  const valides = lignes
    .map((l) => ({ id: String(l.id || ''), creeLe: String(l.creeLe || ''), t: Date.parse(l.creeLe) }))
    .filter((l) => l.id && Number.isFinite(l.t));
  if (valides.length === 0) return false;
  const ancien = etat.curseurAchatsPasseport;
  const ancienT = ancien ? Date.parse(ancien.creeLe) : -Infinity;
  const maxT = Math.max(ancienT, ...valides.map((l) => l.t));
  const auMax = new Set(ancienT === maxT ? (ancien?.ids || []) : []);
  for (const l of valides) if (l.t === maxT) auMax.add(l.id);
  const creeLe = valides.find((l) => l.t === maxT)?.creeLe || ancien?.creeLe;
  if (!creeLe) return false;
  const ids = [...auMax].sort();
  if (ancien?.creeLe === creeLe && JSON.stringify([...ancien.ids].sort()) === JSON.stringify(ids)) {
    return false;
  }
  etat.curseurAchatsPasseport = { creeLe, ids };
  emit();
  return true;
}

/** Rang de Goût persisté d'une carte, borné (0 si jamais bu). */
export function goutCarte(id: string, e: EtatBobaQuest = etat): number {
  return Math.max(0, Math.min(GOUT_MAX, e.goutCartes[id] ?? 0));
}

/** Rangs de Goût des cartes demandées — à passer en `goutsA` à `creerCombat` /
 *  `creerCombatBoss` (côté joueur UNIQUEMENT : le PNJ n'a jamais de Goût).
 *  Chaque id demandé a une entrée, à 0 par défaut : l'appelant n'a rien à supposer. */
export function goutsEquipe(ids: string[], e: EtatBobaQuest = etat): Record<string, number> {
  const r: Record<string, number> = {};
  for (const id of ids) r[id] = goutCarte(id, e);
  return r;
}

/** Progression du Passeport pour l'album : par carte, ce qu'il reste à boire — ou, pour
 *  Bubble Master, combien d'autres cartes il reste à réunir.
 *  Les ids POSSÉDÉS sont transmis à `passeportCarte` : c'est la mesure de la variante
 *  `{ par: 'collection' }`, et elle vit dans le moteur pur, jamais recalculée ici. */
export function passeportCollection(lignes: LigneAchat[], e: EtatBobaQuest = etat): Record<string, {
  parJeu: boolean; acquise: boolean; faits: number; requis: number;
}> {
  const res: Record<string, { parJeu: boolean; acquise: boolean; faits: number; requis: number }> = {};
  const possedees = Object.keys(e.collection || {}).filter((k) => (e.collection[k] || 0) > 0);
  for (const c of COLLECTIBLES) {
    const p = passeportCarte(c.id, lignes, possedees);
    // une carte déjà possédée (capsule d'avant, cadeau…) est acquise quoi qu'il arrive
    res[c.id] = { ...p, acquise: p.acquise || (e.collection[c.id] || 0) > 0 };
  }
  return res;
}

// --- 🧋 LA GORGÉE FRAÎCHE : récompenser une VRAIE visite -----------------------------
// La DÉTECTION vit dans `lib/visites.ts` (hors store, pour que l'accueil de l'app n'ait
// pas à importer @/store/jeu). Le store ne fait que CRÉDITER ce qu'elle a mis de côté :
// il reste donc entièrement synchrone et sans réseau, comme le reste du store.
// C'est le hub du jeu qui orchestre (`app/jeu/index.tsx`).
//
// Le crédit ne passe PAS par `perlesEvenement` : ce sont des perles de bienvenue, pas un
// gain de partie — les doubler par le ×2 qu'elles viennent elles-mêmes d'activer serait
// un effet de bord absurde.
export function crediterGorgee(boissons: number): GainGorgee | null {
  // fail-closed sur une sauvegarde ILLISIBLE seulement : on n'écrit jamais par-dessus.
  // Le cas « hydratation en cours » est couvert par `app/jeu/_layout.tsx`, qui ne monte
  // aucun écran du jeu avant la fin de l'hydratation — et surtout par l'appelant, qui ne
  // consomme les visites en attente QU'APRÈS un crédit réussi (aucune perte possible).
  if (hydratation === 'erreur') return null;
  const gain = gorgeePourBoissons(boissons);
  if (!gain) return null;
  etat.capsulesDoreesGratuites += gain.capsulesDorees;
  etat.capsulesGratuites += gain.capsulesClassiques;
  etat.perles += gain.perles;
  etat.tourneesOffertes += gain.tournees;
  etat.visites = visitesApresGorgee(etat.visites);
  emit();
  return gain;   // l'appelant l'affiche : pas d'état « en attente » à maintenir ici
}

/** État du ×2 « visite récente » pour l'affichage (hub, HUD). */
export function boostVisite(e: EtatBobaQuest = etat): { actif: boolean; heures: number; visites: number } {
  const m = multGorgee(e.visites);
  return { actif: m > 1, heures: m > 1 ? heuresGorgeeRestantes(e.visites) : 0, visites: e.visites.visites };
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
  // 🩹 26/07 : crédité APRÈS les gardes. Avant, un double-tap sur « Réclamer » faisait
  // avancer deux fois l'étape « Réclame 3 défis » de la quête qui paie un vrai tampon.
  crediterQuete('defis');
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

// --- 🤝 Comptoir de Troc v2 : 3 offres par jour (Pack 5b) --------------------------
// Les offres sont DÉTERMINISTES par date (economie.offresTrocDuJour) — chacune est
// utilisable UNE fois par jour (`trocJour.faits`). Reset lazy au changement de jour,
// comme les défis. Tout troc consomme des compteurs ×n (monnaie d'entraînement) :
// l'exemplaire vitrine (×1) n'est JAMAIS troquable.

// Reset lazy du comptoir au changement de jour.
function assurerJourTroc() {
  const jour = cleJour();
  if (etat.trocJour.jour !== jour) etat.trocJour = { jour, faits: [] };
}

// Une offre du jour enrichie pour l'UI : déjà faite ? faisable ? sinon pourquoi.
export type OffreTrocEnrichie = OffreTroc & { fait: boolean; faisable: { ok: boolean; manque?: string } };

export function offresTrocAujourdhui(e: EtatBobaQuest = etat): OffreTrocEnrichie[] {
  const jour = cleJour();
  const faits = e.trocJour.jour === jour ? e.trocJour.faits : [];
  const possedees = Object.keys(e.collection || {}).filter((k) => (e.collection[k] || 0) > 0);
  const doublons = COLLECTIBLES
    .filter((c) => (e.collection[c.id] || 0) >= 2)
    .map((c) => ({ id: c.id, rarete: c.rarete }));
  // 🎫 27/07 — LE COMPTOIR DE TROC NE DOIT PAS CONTOURNER LE PASSEPORT.
  // Sam échange un doublon contre une carte MANQUANTE. Passeport actif, ça rendait
  // l'interrupteur décoratif : mesuré sur 400 jours d'offres, un joueur sans le moindre
  // achat — 6 communes en double, ce que le Passeport lui laisse — se voyait proposer une
  // carte PAYANTE 400 jours sur 400 (souvent une légendaire). Soit les 18 cartes
  // payantes en 18 jours, gratuitement, pendant qu'on demande aux autres de venir boire.
  // On restreint donc les cartes que Sam peut OFFRIR au même vivier que les capsules :
  // une seule règle de déblocage dans tout le jeu, pas deux.
  // Quand il ne reste rien à offrir, `offresTrocDuJour` bascule tout seul sur la branche
  // `sam-ressource` qui existe déjà (collection complète) : Sam paie le doublon en
  // capsule/perles/éclats. Le rendez-vous quotidien est préservé, la porte dérobée non.
  // ⚠️ STRICTEMENT conditionné à l'interrupteur : à `false` — donc aujourd'hui, et après
  // toute marche arrière — le comportement est identique au octet près.
  const offrables = passeportActif()
    ? new Set(poolCapsuleAvecPasseport(possedees).map((c) => c.id))
    : null;
  const manquants = COLLECTIBLES
    .filter((c) => !((e.collection[c.id] || 0) > 0))
    .filter((c) => offrables === null || offrables.has(c.id))
    .map((c) => ({ id: c.id, rarete: c.rarete }));
  return offresTrocDuJour(jour, { doublons, manquants }).map((offre) => {
    const fait = faits.includes(offre.id);
    let faisable: { ok: boolean; manque?: string };
    if (offre.type === 'sam') {
      // Sam veut un doublon : la vitrine (×1) ne suffit JAMAIS.
      faisable = (e.collection[offre.sam.veut] || 0) >= 2
        ? { ok: true }
        : { ok: false, manque: `Pas de doublon de ${trouverCollectible(offre.sam.veut)?.nom ?? 'cette carte'}` };
    } else if (offre.type === 'fonte') {
      const eligibles = COLLECTIBLES.filter(
        (c) => (e.collection[c.id] || 0) >= 2 && RARETES[c.rarete].ordre >= RARETES[offre.rareteMin].ordre,
      ).length;
      faisable = eligibles >= offre.nb
        ? { ok: true }
        : { ok: false, manque: `Il te manque ${offre.nb - eligibles} doublon${offre.nb - eligibles > 1 ? 's' : ''}` };
    } else if (offre.donne.type === 'eclats') {
      faisable = e.eclats >= offre.donne.n
        ? { ok: true }
        : { ok: false, manque: `Il te manque ${offre.donne.n - e.eclats} éclats` };
    } else {
      const total = CONSOMMABLE_IDS.reduce((s, id) => s + (e.consommables[id] ?? 0), 0);
      faisable = total >= offre.donne.n
        ? { ok: true }
        : { ok: false, manque: `Il te manque ${offre.donne.n - total} consommable${offre.donne.n - total > 1 ? 's' : ''}` };
    }
    return { ...offre, fait, faisable } as OffreTrocEnrichie;
  });
}

// Réalise une offre du jour. Re-valide TOUT côté store (jour courant, pas déjà
// faite, faisabilité, choix conformes) — l'UI ne fait que proposer. `recu` = texte
// court FR du gain. Retourne null si refus (rien n'est alors consommé).
export function realiserOffreTroc(
  id: OffreTrocId,
  choix?: { cartes?: string[]; consos?: ConsommableId[] },
): { ok: boolean; recu: string } | null {
  assurerJourTroc();
  if (etat.trocJour.faits.includes(id)) return null;
  const offre = offresTrocAujourdhui().find((o) => o.id === id);
  if (!offre || !offre.faisable.ok) return null;
  let recu = '';
  if (offre.type === 'sam') {
    const { sam } = offre;
    if ((etat.collection[sam.veut] || 0) < 2) return null; // sécurité : la vitrine n'est JAMAIS troquée
    etat.collection = { ...etat.collection, [sam.veut]: (etat.collection[sam.veut] || 0) - 1 };
    if (sam.kind === 'sam-carte') {
      etat.collection = { ...etat.collection, [sam.offre]: (etat.collection[sam.offre] || 0) + 1 };
      recu = `${trouverCollectible(sam.offre)?.nom ?? sam.offre} !`;
    } else {
      if (sam.capsule === 'doree') etat.capsulesDoreesGratuites += 1;
      else if (sam.capsule === 'classique') etat.capsulesGratuites += 1;
      if (sam.perles) etat.perles += sam.perles;
      if (sam.eclats) etat.eclats += sam.eclats;
      recu = [
        sam.capsule ? `Capsule ${sam.capsule === 'doree' ? 'dorée' : 'classique'}` : '',
        sam.perles ? `${sam.perles} perles` : '',
        sam.eclats ? `${sam.eclats} éclats` : '',
      ].filter(Boolean).join(' + ');
    }
  } else if (offre.type === 'fonte') {
    const cartes = choix?.cartes ?? [];
    if (cartes.length !== offre.nb || new Set(cartes).size !== cartes.length) return null;
    for (const cid of cartes) {
      const meta = trouverCollectible(cid);
      if (!meta) return null;
      if (RARETES[meta.rarete].ordre < RARETES[offre.rareteMin].ordre) return null; // rareté trop basse
      if ((etat.collection[cid] || 0) < 2) return null; // doublon requis, vitrine épargnée
    }
    const collection = { ...etat.collection };
    for (const cid of cartes) collection[cid] = (collection[cid] || 0) - 1;
    etat.collection = collection;
    if (offre.capsule === 'doree') etat.capsulesDoreesGratuites += 1;
    else etat.capsulesGratuites += 1;
    if (offre.eclatsBonus) etat.eclats += offre.eclatsBonus;
    recu = `Capsule ${offre.capsule === 'doree' ? 'dorée' : 'classique'}${offre.eclatsBonus ? ` + ${offre.eclatsBonus} éclats` : ''}`;
  } else {
    if (offre.donne.type === 'eclats') {
      if (etat.eclats < offre.donne.n) return null;
      etat.eclats -= offre.donne.n;
    } else {
      const consos = choix?.consos ?? [];
      if (consos.length !== offre.donne.n) return null;
      const compte: Partial<Record<ConsommableId, number>> = {};
      for (const c of consos) {
        if (!CONSOMMABLES[c]) return null;
        compte[c] = (compte[c] ?? 0) + 1;
      }
      for (const [cid, n] of Object.entries(compte) as [ConsommableId, number][]) {
        if ((etat.consommables[cid] ?? 0) < n) return null;
      }
      const sac = { ...etat.consommables };
      for (const [cid, n] of Object.entries(compte) as [ConsommableId, number][]) sac[cid] = (sac[cid] ?? 0) - n;
      etat.consommables = sac;
    }
    if (offre.recoit.type === 'capsule') {
      if (offre.recoit.capsule === 'doree') etat.capsulesDoreesGratuites += 1;
      else etat.capsulesGratuites += 1;
      recu = `Capsule ${offre.recoit.capsule === 'doree' ? 'dorée' : 'classique'}`;
    } else {
      etat.eclats += offre.recoit.eclats ?? 0;
      recu = `${offre.recoit.eclats ?? 0} éclats`;
    }
  }
  etat.trocJour = { ...etat.trocJour, faits: [...etat.trocJour.faits, id] };
  emit();
  return { ok: true, recu };
}

// 🩹 26/07 : `equipeValideSousBudget` était exportée et n'avait AUCUN appelant (la
// règle était réimplémentée à la main dans arene.tsx). Elle devient l'unique vérité.
export function definirEquipe(ids: string[]): boolean {
  const eq = ids.slice(0, 3);
  if (!equipeValideSousBudget(eq)) return false;
  etat.arene = { ...etat.arene, equipe: eq };
  emit();
  return true;
}

// ⚖️ Une équipe est-elle valide (3 cartes possédées, sous le budget de rareté) ?
export function equipeValideSousBudget(ids: string[], e: EtatBobaQuest = etat): boolean {
  return ids.length === 3
    && ids.every((id) => (e.collection[id] || 0) > 0)
    && coutEquipe(ids) <= BUDGET_EQUIPE;
}

// --- 🎒 Consommables de combat ---------------------------------------------------------
// Sac plafonné à SAC_MAX_CONSO par objet : la boutique refuse au-delà, et les butins
// (shooter) convertissent l'excédent en perles — jamais de stock infini.
export function acheterConsommable(id: ConsommableId, n = 1): boolean {
  const cout = CONSOMMABLES[id].cout * n;
  if (etat.perles < cout) return false;
  if ((etat.consommables[id] ?? 0) + n > SAC_MAX_CONSO) return false; // sac plein
  etat.perles -= cout;
  etat.consommables = { ...etat.consommables, [id]: (etat.consommables[id] ?? 0) + n };
  emit();
  return true;
}
// 🎁 Gain hors boutique (butin, récompense) : ajoute jusqu'au plafond ; chaque unité
// excédentaire est REMBOURSÉE en perles (moitié du prix boutique), créditées
// directement — même esprit que les éclats des doublons d'objets, PAS perlesEvenement.
export function gagnerConsommable(id: ConsommableId, n = 1): { ajoute: number; convertisPerles: number } {
  const actuel = etat.consommables[id] ?? 0;
  const ajoute = Math.max(0, Math.min(n, SAC_MAX_CONSO - actuel));
  const convertisPerles = (n - ajoute) * Math.floor(CONSOMMABLES[id].cout / 2);
  etat.consommables = { ...etat.consommables, [id]: actuel + ajoute };
  if (convertisPerles > 0) etat.perles += convertisPerles;
  emit();
  return { ajoute, convertisPerles };
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
  // 🩹 26/07 : l'étape « Équipe un copain de tir » se validait même avec une carte
  // non possédée (le copain est sans effet dans ce cas — cf. effetBuddyActuel).
  if (id && (etat.collection[id] || 0) > 0) crediterQuete('copain');
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

// 🔒 GAIN LÉGITIME D'UN DUEL MISÉ — DÉRIVÉ DE L'ADVERSAIRE RÉEL DU JOUR, jamais d'un id d'URL.
// Sam ne met en jeu qu'une carte de SON équipe du jour (`equipeSam(cleJour())`, déterministe,
// pool commun/rare/épique — JAMAIS de légendaire). On préfère une carte que le joueur n'a pas
// encore (le sel du duel), sinon la première de l'équipe. DÉTERMINISTE ⇒ ce que la modale de
// mise d'`arene.tsx` promet est EXACTEMENT ce que la résolution crédite, sans qu'aucun id de
// confiance ne transite par l'écran.
export function gainDuelAmiDuJour(e: EtatBobaQuest = etat, jour: string = cleJour()): string {
  const equipe = equipeSam(jour);
  return equipe.find((id) => !(e.collection[id] > 0)) ?? equipe[0];
}

// Résout un duel d'ami misé : victoire → on gagne une carte de l'adversaire ; défaite → on
// perd SON doublon (jamais en dessous d'un exemplaire).
// 🔒 FUITE DEEP-LINK FERMÉE (28/07) : `gainId` vient d'un paramètre d'URL posé par l'écran —
// un joueur pouvait forger un deep-link `gain=<n'importe quelle carte, même légendaire>` et se
// faire créditer sans l'avoir gagnée (même famille de fuite que la pompe à doublons fermée).
// Le store ne fait DÉSORMAIS jamais confiance à cet id : en cas de victoire il RE-VALIDE le
// gain contre l'équipe de Sam du jour (l'adversaire réel). On n'honore `gainId` que s'il
// appartient bien à cette équipe (cohérence d'affichage) ; sinon — id forgé, hors roster,
// absent — on retombe sur le gain DÉRIVÉ. Un `gain=<légendaire>` est donc rejeté d'office, et
// on RENVOIE l'id réellement crédité pour que l'écran affiche ce que le store a validé.
// Un SEUL emit() : aucun double crédit.
export function resoudreDuelAmi(gagne: boolean, miseId?: string, gainId?: string): { nouveau: boolean; gainId?: string } {
  let nouveau = false;
  let credite: string | undefined;
  if (gagne) {
    // re-validation : l'id n'est honoré que s'il est une carte de l'adversaire réel du jour.
    const equipe = equipeSam(cleJour());
    credite = (gainId && equipe.includes(gainId)) ? gainId : gainDuelAmiDuJour(etat);
    nouveau = (etat.collection[credite] || 0) === 0;
    etat.collection = { ...etat.collection, [credite]: (etat.collection[credite] || 0) + 1 };
  } else if (miseId) {
    // 🩹 26/07 : `Math.max(1, (collection[id] || 1) - 1)` CRÉAIT la carte quand on ne
    // la possédait pas (undefined || 1 → 1, 1 − 1 → 0, max(1,0) → 1). On ne retire la
    // mise que s'il reste un doublon ; l'exemplaire vitrine n'est jamais consommé.
    const n = etat.collection[miseId] || 0;
    if (n >= 2) etat.collection = { ...etat.collection, [miseId]: n - 1 };
  }
  emit();
  return { nouveau, gainId: credite };
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
  assurerSemaineTournoi();
  // 🩹 26/07 : l'invariant « 1 tentative par semaine » n'existait que dans l'UI —
  // le store acceptait n'importe quelle étape, y compris après élimination.
  if (etat.tournoi.elimine || etape !== etat.tournoi.etape) {
    return { perles: 0, capsule: null, champion: false };
  }
  crediterQuete('duels');
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
  // 🩹 26/07 : la consolation était versée à CHAQUE appel, sans vérifier l'élimination.
  if (etat.tournoi.elimine) return { perles: 0 };
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
  doublonsConsommes: number;    // 🩹 26/07 : doublons RÉELLEMENT débités (min requis/dispo)
  eclatsJoker: number;          // éclats nécessaires pour remplacer les doublons manquants
  possible: boolean;
  bloque: 'perles' | 'doublons' | null; // ce qui manque si !possible
};

export function apercuEntrainement(id: string, e: EtatBobaQuest = etat): ApercuEntrainement {
  const meta = trouverCollectible(id);
  const niveau = niveauCarte(id, e);
  // 🩹 26/07 : on n'entraîne que des cartes RÉELLEMENT possédées (l'UI le garantissait
  // déjà, la garde manquait au bon endroit — sinon on montait au niveau 10 une carte
  // jamais tirée, en payant tout en éclats).
  if (!meta || (e.collection[id] ?? 0) < 1 || niveau >= NIVEAU_CARTE_MAX) {
    return {
      niveau, max: niveau >= NIVEAU_CARTE_MAX, cout: 0, doublonsRequis: 0, doublonsDispo: 0,
      doublonsConsommes: 0, eclatsJoker: 0, possible: false, bloque: null,
    };
  }
  const cout = coutNiveauCarte(meta.rarete, niveau);
  const doublonsRequis = doublonsPourNiveau(niveau + 1);
  const doublonsDispo = Math.max(0, (e.collection[id] ?? 0) - 1);
  const doublonsConsommes = Math.min(doublonsRequis, doublonsDispo);
  const manque = Math.max(0, doublonsRequis - doublonsDispo);
  const eclatsJoker = manque * ECLATS_PAR_DOUBLON;
  const assezPerles = e.perles >= cout;
  const assezDoublons = manque === 0 || e.eclats >= eclatsJoker;
  return {
    niveau, max: false, cout, doublonsRequis, doublonsDispo, doublonsConsommes, eclatsJoker,
    possible: assezPerles && assezDoublons,
    bloque: !assezPerles ? 'perles' : !assezDoublons ? 'doublons' : null,
  };
}

// Passe la carte au niveau suivant. Consomme perles + doublons du palier (jamais
// l'exemplaire vitrine) — les doublons manquants sont remplacés par des éclats.
export function entrainerCarte(id: string): { ok: boolean; niveau: number } {
  const a = apercuEntrainement(id);
  if (a.max || !a.possible) return { ok: false, niveau: a.niveau };
  const consommes = a.doublonsConsommes;
  etat.perles -= a.cout;
  if (consommes > 0) etat.collection = { ...etat.collection, [id]: (etat.collection[id] ?? 1) - consommes };
  if (a.eclatsJoker > 0) etat.eclats -= a.eclatsJoker;
  etat.niveauxCartes = { ...etat.niveauxCartes, [id]: a.niveau + 1 };
  emit();
  return { ok: true, niveau: a.niveau + 1 };
}

// --- 🎖️ Talents par carte (paliers 4 / 7 / 10) --------------------------------------
// À chaque palier atteint, le joueur CHOISIT 1 option parmi 2 (table curée dans
// economie.ts). Le choix est persisté (`talentsCartes`) et peut être « re-forgé »
// contre des éclats. Les effets s'appliquent dans TOUS les duels via talentsEquipe
// passé à creerCombat/creerCombatBoss (côté a).

// Effets actifs de TOUTES les cartes — à passer à creerCombat/creerCombatBoss (côté a).
export function talentsEquipe(e: EtatBobaQuest = etat): ReturnType<typeof effetsTalentsEquipe> {
  return effetsTalentsEquipe(e.talentsCartes, niveauxEquipe(e));
}

// Cartes possédées ayant au moins un palier ATTEINT sans choix fait → badge « ! ».
export function talentsEnAttente(e: EtatBobaQuest = etat): string[] {
  const res: string[] = [];
  for (const id of Object.keys(e.collection)) {
    const n = niveauCarte(id, e);
    const choix = e.talentsCartes[id];
    for (const palier of PALIERS_TALENT) {
      if (n >= palier && optionsTalent(id, palier) && !choix?.[`p${palier}` as keyof typeof choix]) {
        res.push(id);
        break;
      }
    }
  }
  return res;
}

// Choisit l'option 'a' ou 'b' d'un palier. Gardes : carte possédée, palier atteint,
// table existante, palier pas déjà choisi (la re-forge sert à changer).
export function choisirTalent(carteId: string, palier: PalierTalent, lettre: ChoixLettre): boolean {
  if (!etat.collection[carteId]) return false;
  if (niveauCarte(carteId) < palier) return false;
  if (!optionsTalent(carteId, palier)) return false;
  const cle = `p${palier}` as const;
  const actuels = etat.talentsCartes[carteId] ?? {};
  if (actuels[cle]) return false;
  etat.talentsCartes = { ...etat.talentsCartes, [carteId]: { ...actuels, [cle]: lettre } };
  emit();
  return true;
}

// Re-forge : efface le choix d'un palier contre REFORGE_TALENT_ECLATS éclats → le
// talent repasse « à choisir ». Jamais gratuit, jamais de reset global.
export function reforgerTalent(carteId: string, palier: PalierTalent): boolean {
  const cle = `p${palier}` as const;
  const actuels = etat.talentsCartes[carteId];
  if (!actuels?.[cle]) return false;
  if (etat.eclats < REFORGE_TALENT_ECLATS) return false;
  etat.eclats -= REFORGE_TALENT_ECLATS;
  const copie = { ...actuels };
  delete copie[cle];
  etat.talentsCartes = { ...etat.talentsCartes, [carteId]: copie };
  emit();
  return true;
}

// --- 🗺️ Tournée des Maîtres (run roguelite hebdo) -----------------------------------
// Une run enchaîne des duels à difficulté croissante, adversaires et drafts
// DÉTERMINISTES par semaine (tournee.ts). Les PV se reportent d'un duel à l'autre ;
// une défaite ou un abandon termine la run. Les paliers hebdo comptent les
// victoires CUMULÉES de la semaine (toutes runs), réclamés 1×/semaine.

// Reset lazy au changement de semaine : compteur + paliers réclamés repartent à
// zéro ; le record est À VIE ; une run en cours SURVIT au changement de semaine
// (ses adversaires sont seedés par sa propre semaine de départ).
function assurerSemaineTournee() {
  const semaine = cleSemaine();
  if (etat.tournee.semaine !== semaine) {
    etat.tournee = { ...etat.tournee, semaine, victoiresSemaine: 0, reclames: [] };
  }
}

// Vue lazy du suivi (même règle qu'assurerSemaineTournee, sans écrire).
export function tourneeActuelle(e: EtatBobaQuest = etat): SuiviTournee {
  const semaine = cleSemaine();
  return e.tournee.semaine === semaine
    ? e.tournee
    : { ...e.tournee, semaine, victoiresSemaine: 0, reclames: [] };
}

// Lance une nouvelle run (impossible si une run est en cours ou l'équipe invalide).
// 🩹 26/07 — ANTI-FARM. `lancerTournee` n'avait ni coût ni limite : gagner le duel 1
// (95 % de victoire mesurée) puis abandonner rapportait ~80 perles par cycle, à
// l'infini — et `victoiresSemaine` s'incrémentait, donc les 3 paliers hebdo
// (250 perles + capsule + capsule DORÉE) se débloquaient sans jamais dépasser le
// duel 2. Deux verrous : un nombre de runs par jour, et une équipe réellement valide
// (l'ancien test ne vérifiait que `length < 3`, ni la possession ni le budget).
export const TOURNEES_PAR_JOUR = 3;

export function tourneesRestantesAujourdhui(e: EtatBobaQuest = etat): number {
  const dujour = e.statsJour.jour === cleJour() ? e.statsJour.tourneesLancees : 0;
  // 🧋 les runs OFFERTES par une visite réelle s'ajoutent au quota quotidien
  return Math.max(0, TOURNEES_PAR_JOUR - dujour) + Math.max(0, e.tourneesOffertes);
}

export function lancerTournee(): boolean {
  assurerSemaineTournee();
  assurerJour();
  if (etat.tournee.run) return false;
  if (!equipeValideSousBudget(etat.arene.equipe)) return false;
  if (tourneesRestantesAujourdhui() <= 0) return false;
  // on consomme d'abord les runs offertes par une visite, puis le quota du jour
  if (etat.tourneesOffertes > 0) etat.tourneesOffertes -= 1;
  else etat.statsJour.tourneesLancees += 1;
  etat.tournee = { ...etat.tournee, run: creerRun(cleSemaine()) };
  emit();
  return true;
}

// Victoire au duel `run.etape` : perles (événement ×2 possible), compteur hebdo,
// XP pass, quête duels ; les PV de fin de combat deviennent les PV reportés et le
// draft de bonus s'ouvre. pvRestants = PV absolus par carte (0 = K.O.).
export function victoireTourneeDuel(pvRestants: Record<string, number>): {
  perles: number; etape: number; score: number; record: number; nouveau: boolean;
} | null {
  assurerSemaineTournee();
  const run = etat.tournee.run;
  if (!run) return null;
  crediterQuete('duels');
  const perles = perlesEvenement(perlesVictoireTournee(run.etape));
  etat.perles += perles;
  gagnerXpPass(PASS_XP.arene);
  const score = run.victoires + 1;
  etat.tournee = {
    ...etat.tournee,
    victoiresSemaine: etat.tournee.victoiresSemaine + 1,
    run: runApresVictoire(run, pvRestants),
  };
  emit();
  // record PERSISTÉ à la fin de run ; ici on affiche le record « en cours » pour motiver.
  return { perles, etape: run.etape, score, record: Math.max(etat.tournee.record, score), nouveau: score > etat.tournee.record };
}

// Défaite (ou abandon via la croix, traité pareil par duel.tsx) : fin de run, le
// record ne peut que monter. Aucune consolation en perles — l'enjeu est la série.
export function defaiteTourneeDuel(): { score: number; record: number; nouveau: boolean } {
  assurerSemaineTournee();
  const { suivi, score, nouveau } = finirRun(etat.tournee);
  etat.tournee = suivi;
  emit();
  return { score, record: suivi.record, nouveau };
}

// Abandon depuis l'écran Tournée = défaite de run (même règle que la croix du duel).
export function abandonnerTournee(): { score: number; record: number; nouveau: boolean } {
  return defaiteTourneeDuel();
}

// Choix d'un bonus au draft post-victoire. Le bonus doit faire partie du draft
// déterministe courant. « the-revigorant » soigne la RUN immédiatement (PV max
// combat réels : niveaux + talents + objets + outsider) ; les autres bonus
// s'appliqueront au combat frais du duel suivant (appliquerBonusRun côté duel.tsx).
export function choisirBonusTournee(id: BonusRunId): boolean {
  assurerSemaineTournee();
  const run = etat.tournee.run;
  if (!run || !run.draftEnAttente) return false;
  if (!draftBonusRun(run).includes(id)) return false;
  let suivant = runApresBonus(run, id);
  if (id === 'the-revigorant') {
    suivant = {
      ...suivant,
      pvReportes: soignerRun(
        run.pvReportes,
        // 👅 les rangs de Goût comptent ici aussi : sans eux, les PV max de run seraient
        // INFÉRIEURS aux PV max réels du combat et le report écrêterait les cartes.
        pvMaxEquipeRun(etat.arene.equipe, objetsEquipe(), niveauxEquipe(), talentsEquipe(),
          goutsEquipe(etat.arene.equipe)),
      ),
    };
  }
  etat.tournee = { ...etat.tournee, run: suivant };
  emit();
  return true;
}

// Paliers hebdo débloqués (victoires cumulées atteintes) mais pas encore réclamés.
export function paliersTourneeReclamables(e: EtatBobaQuest = etat): number {
  const t = tourneeActuelle(e);
  let n = 0;
  TOURNEE_PALIERS.forEach((palier, i) => {
    if (t.victoiresSemaine >= palier.victoires && !t.reclames.includes(i)) n++;
  });
  return n;
}

// Réclame un palier hebdo (perles événement ×2 possible / capsule / capsule dorée).
export function reclamerPalierTournee(index: number): boolean {
  assurerSemaineTournee();
  const palier = TOURNEE_PALIERS[index];
  if (!palier || etat.tournee.victoiresSemaine < palier.victoires || etat.tournee.reclames.includes(index)) return false;
  if (palier.type === 'perles') etat.perles += perlesEvenement(palier.qte);
  else if (palier.type === 'capsule') etat.capsulesGratuites += palier.qte;
  else if (palier.type === 'capsule_doree') etat.capsulesDoreesGratuites += palier.qte;
  etat.tournee = { ...etat.tournee, reclames: [...etat.tournee.reclames, index] };
  emit();
  return true;
}

// --- 🏅 Palmarès par carte (« Exploits ») ------------------------------------------
// Crédite un LOT d'exploits en une seule écriture persistée (le duel agrège les
// faits du round puis flush — jamais d'écriture par impact). Aucun effet de
// puissance : c'est de l'attachement cosmétique, affiché dans l'album.
export function crediterExploits(lots: [string, Partial<ExploitsCarte>][]) {
  if (!lots.length) return;
  for (const [carteId, patch] of lots) {
    if (!carteId) continue;
    etat.exploits = exploitsApresEvenement(etat.exploits, carteId, patch);
  }
  emit();
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

// 🩹 26/07 — `rng` INJECTABLE, comme `terminerNiveau` et `finPartieInfini` le font déjà.
// Sans lui, le test « doublon épique = 500 perles » de scripts/test-jeu.cjs était un
// TIRAGE AU SORT : la garantie de pity « épique-ou-mieux » peut rendre un LÉGENDAIRE
// (tirerCapsuleMin puise dans les 12 cartes épique+légendaire), donc une carte non
// possédée, donc pas un doublon. Mesuré : 4 échecs sur 8 exécutions. Un test qui tombe
// une fois sur deux finit par être ignoré — c'est pire que pas de test.
export function ouvrirCapsule(type: TypeCapsule, gratuite: boolean, rng: () => number = Math.random): {
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
  // 🩹 26/07 : crédité APRÈS les gardes (un double-tap sur « Ouvrir » validait l'étape
  // « Ouvre 2 capsules » de la quête au tampon réel sans ouvrir la moindre capsule).
  crediterQuete('capsules');
  // 🎁 PITY : la garantie prend le pas si le compteur est au maximum.
  // 🩹 26/07 — Seule la capsule CLASSIQUE consomme la garantie. Avant, un joueur qui
  // avait payé 9 capsules classiques (6 300 perles) et réclamait sa capsule dorée
  // OFFERTE de série J7 voyait sa garantie brûlée par un cadeau — alors que la dorée a
  // déjà 40 % d'épique-ou-mieux en naturel (0/60/30/10). La dorée continue de faire
  // AVANCER le compteur (rien n'est perdu), elle ne le dépense plus.
  const garantieDispo = type === 'classique';
  const forceLegendaire = garantieDispo && etat.pity.legendaire + 1 >= PITY_LEGENDAIRE;
  const forceEpique = garantieDispo && etat.pity.epique + 1 >= PITY_EPIQUE;

  // 🎫 PASSEPORT ACTIF : la capsule ne DÉCOUVRE plus, elle ENTRAÎNE. Elle ne peut rendre
  // que des cartes DÉJÀ débloquées au comptoir (plus le set commun, toujours gratuit) —
  // sinon elle contournerait entièrement la règle « on débloque en buvant ». Le pity, le
  // suspense et les doublons-matière restent identiques : seul le vivier change.
  // Repli de sûreté : pool vide (joueur qui n'a encore rien) → tirage normal, pour ne
  // jamais bloquer un début de partie.
  // 🚦 27/07 : l'interrupteur est SERVEUR (`passeportActif()`), plus une constante
  // compilée — la bascule et surtout la MARCHE ARRIÈRE prennent effet sans OTA. Il est lu
  // à chaque ouverture, donc une capsule ouverte 10 s après le retour en arrière tire
  // déjà dans le vivier complet.
  const poolPasseport = passeportActif()
    ? poolCapsuleAvecPasseport(Object.keys(etat.collection).filter((k) => (etat.collection[k] || 0) > 0))
    : [];

  let collectible: Collectible;
  if (poolPasseport.length > 0) {
    // on honore la garantie DANS le vivier autorisé : si elle tombe, on privilégie la
    // rareté promise quand elle y est présente, sinon on tire dans tout le vivier.
    const minimum = forceLegendaire ? 'legendaire' : forceEpique ? 'epique' : null;
    const eligibles = minimum
      ? poolPasseport.filter((c) => RARETES[c.rarete].ordre >= RARETES[minimum].ordre)
      : [];
    const vivier = eligibles.length > 0 ? eligibles : poolPasseport;
    collectible = vivier[Math.floor(rng() * vivier.length)];
  } else if (forceLegendaire) {
    collectible = tirerCapsuleMin(type, 'legendaire', rng);
  } else if (forceEpique) {
    collectible = tirerCapsuleMin(type, 'epique', rng);
  } else {
    collectible = tirerCapsule(type, rng);
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
  const gain = nouveauGain(r.type, r.qte, 'set', r.label, r.code);
  etat.gains = [gain, ...etat.gains];
  etat.setsReclames = [...etat.setsReclames, set];
  emit();
  return gain;
}

export function reclamerCollection(): Gain | null {
  if (etat.collectionReclamee || !collectionComplete()) return null;
  const gain = nouveauGain(
    RECOMPENSE_COLLECTION.type, RECOMPENSE_COLLECTION.qte, 'collection',
    RECOMPENSE_COLLECTION.label, RECOMPENSE_COLLECTION.code,
  );
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
  const gain = nouveauGain(palier.type, palier.qte, 'boutique', palier.label, palier.code);
  etat.gains = [gain, ...etat.gains];
  emit();
  return gain;
}

// 🩹 26/07 — REMBOURSEMENT. `acheterBoutique` débite les perles et crée le gain SANS
// consulter le serveur ; le quota n'est vérifié qu'à « Préparer pour la caisse ». Or
// les deux compteurs ne comptent pas la même chose : le client compte le mois
// d'ACHAT, le serveur le mois de CRÉATION DE LA DEMANDE. Un joueur qui achetait
// 3 × −10 % en janvier sans les préparer, puis les préparait en février, saturait le
// quota de février : ses achats suivants étaient refusés définitivement, le gain
// restait `a_reclamer` pour toujours et jusqu'à 60 000 perles s'évaporaient — aucun
// chemin de remboursement n'existait. À appeler depuis le `catch` de
// `preparerPourCaisse` quand le serveur refuse pour cause de plafond.
export function rembourserAchatBoutique(gainId: string): boolean {
  const gain = etat.gains.find((g) => g.id === gainId);
  if (!gain || gain.origine !== 'boutique' || gain.statut !== 'a_reclamer') return false;
  const palier = BOUTIQUE.find((p) => p.code === gain.code);
  if (!palier) return false;
  assurerMoisPrix();
  const pris = etat.prixMois.achats[palier.id] || 0;
  etat.prixMois.achats = { ...etat.prixMois.achats, [palier.id]: Math.max(0, pris - 1) };
  etat.perles += palier.cout;
  etat.gains = etat.gains.filter((g) => g.id !== gainId);
  emit();
  return true;
}

// 🩹 26/07 — ATOMICITÉ. Avant, `tournerRoulette` brûlait le tour du mois et le
// persistait immédiatement, tandis que le LOT n'était crédité que 4,2 s plus tard, à
// la fin de l'animation (`appliquerRoulette` appelée depuis le callback Animated).
// Un appel entrant, un retour arrière ou l'OS qui tue l'app pendant la roue = tour du
// mois consommé, lot perdu, et l'écran affichait quand même « Dernier gain : Boisson
// offerte ». Le tirage et le crédit sont désormais une seule transaction ; l'animation
// ne fait que RÉVÉLER un résultat déjà acquis.
export function tournerRoulette(rng: () => number = Math.random): SegmentRoulette | null {
  if (!rouletteDispo()) return null;
  const seg = tirerRoulette(rng);
  etat.derniereRouletteMois = cleMois();
  etat.dernierGainRoulette = seg.label;
  crediterRoulette(seg);
  emit();
  return seg;
}

function crediterRoulette(seg: SegmentRoulette) {
  if (seg.type === 'perles') {
    // 🩹 27/07 (décision Yoann) — LA ROUE EST HORS MULTIPLICATEURS.
    // Le 26/07, les lots en perles avaient été branchés sur `perlesEvenement` au motif
    // que le bandeau du hub promet « toutes tes perles gagnées sont doublées ». Deux
    // raisons de revenir dessus :
    //  · la roue ANNONCE son lot en toutes lettres sur la part (« 1 200 perles ») :
    //    c'est un montant fixe, promis avant le tirage. En rendre 2 400 ou 6 240 selon
    //    le jour, c'est un autre écart entre l'affiché et le réel ;
    //  · avec les lots relevés le 27/07 et un cumul possible de ×5,2 (événement ×2 ·
    //    série ×1,3 · Gorgée Fraîche ×2), « 3 000 perles » pouvait en rendre 15 600,
    //    soit 22 capsules d'un coup — de quoi annuler l'équilibrage du 24/07.
    // Le lot est donc crédité À SA VALEUR FACIALE, comme les perles de série
    // quotidienne (`tickSerie`) et celles de la Gorgée Fraîche, déjà hors
    // multiplicateurs. Un test verrouille ce comportement : ne pas rebrancher
    // `perlesEvenement` ici sans rouvrir la question du plafond.
    etat.perles += seg.qte;
    // La quête « Gagne 1 500 perles » suit quand même : le joueur a bien gagné ces
    // perles, seul le multiplicateur est écarté.
    crediterQuete('perles', seg.qte);
  } else if (seg.type === 'capsule_doree') {
    etat.capsulesDoreesGratuites += seg.qte;
  } else {
    if (!seg.code) return;
    etat.gains = [nouveauGain(seg.type, seg.qte, 'roulette', seg.label, seg.code), ...etat.gains];
  }
}

/** @deprecated Le lot est désormais crédité par `tournerRoulette` (transaction unique).
 *  Conservée sans effet pour ne casser aucun appelant existant. */
export function appliquerRoulette(_seg: SegmentRoulette) { /* no-op */ }

export function mettreGainEnAttente(id: string, demandeId: string) {
  etat.gains = etat.gains.map((g) => (
    g.id === id ? { ...g, demandeId, statut: 'en_attente' as const } : g
  ));
  emit();
}

export type StatutDemandeRecompense = {
  id: string;
  gain_local_id: string;
  statut: 'en_attente' | 'appliquee' | 'refusee';
};

export function synchroniserGainsServeur(demandes: StatutDemandeRecompense[]) {
  const parGain = new Map(demandes.map((d) => [d.gain_local_id, d]));
  let change = false;
  const gains = etat.gains.map((g) => {
    const d = parGain.get(g.id);
    if (!d) return g;
    const statut: Gain['statut'] = d.statut === 'appliquee'
      ? 'utilise'
      : d.statut === 'refusee' ? 'refuse' : 'en_attente';
    if (g.demandeId === d.id && g.statut === statut) return g;
    change = true;
    return { ...g, demandeId: d.id, statut };
  });
  if (!change) return;
  etat.gains = gains;
  emit();
}

// Remise à zéro complète (bouton preview du hub)
export function resetBobaQuest() {
  if (!__DEV__) return;
  etat = JSON.parse(JSON.stringify(DEFAUT));
  // 💾 26/07 — Après une remise à zéro EXPLICITE, il n'y a plus rien à charger : l'état
  // en mémoire EST la vérité. Le laisser à « chargement » (ou pire, à « erreur ») ferait
  // mentir `instantaneEtat()`, qui refuserait de synchroniser un état pourtant connu —
  // et sur l'écran d'erreur de sauvegarde, la réinitialisation ne délivrerait jamais.
  // Aucun risque d'écrasement serveur : la révision repart à 1 et la RPC refuse toute
  // révision qui ne dépasse pas celle déjà en base.
  hydratation = 'prete';
  principalSain = false;   // on ne connaît plus la copie de secours : on la reconstruit
  emit();
}

// Test manuel de restauration cloud, uniquement en développement.
// Efface strictement les deux copies locales Boba Quest : la session Supabase et les
// autres données de l'application ne sont pas touchées. Le rechargement JS est lancé
// par l'écran appelant après la résolution de cette promesse.
export async function effacerSauvegardeLocalePourTestRestauration(): Promise<boolean> {
  if (!__DEV__) return false;
  // Une écriture locale déjà planifiée ne doit pas recréer la sauvegarde juste après
  // le multiRemove et fausser le scénario « installation vierge ».
  await fileEcriture.catch(() => {});
  await AsyncStorage.multiRemove([CLE_SAUVEGARDE, CLE_SAUVEGARDE_SECOURS]);
  return true;
}
