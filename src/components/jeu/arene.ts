// === Boba Quest — L'ARÈNE : moteur de combat (logique PURE, zéro dépendance RN) ===
// Combats tour par tour type Pokémon : équipes de 3 collectibles, chacun avec
// PV / ATQ / VIT et 2 attaques. Triangle des types (= les sets) :
//   🍓 Fruité > 🧋 Milk Tea > ✨ Topping > 🍓 Fruité   (×1,5 / ×0,75)
//   👑 Signature : neutre dans les deux sens, mais des stats de légende.
// Piment : précision (les grosses attaques ratent plus), coups critiques ×1,5,
// attaques de ZONE (toute l'équipe adverse), OBJETS tenus (bonus passifs),
// champions de TOURNOI, intentions annoncées, Garde et combos de marques.
// L'ordre d'action suit la VIT.
// Testé sous Node.

// import RELATIF (même dossier) : permet aussi de tester ce module sous Node
import {
  agregerEffets, CONSOMMABLES, coutEquipe, multNiveauCarte, multOutsider, objetsDeSlot, PASSIFS,
  trouverCollectible, type Boss, type BossGimmick, type ConsommableId, type Emplacement,
  type EffetObjet, type Mutateur, type ObjetId, type Rarete, type SetId,
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

// --- ⭐ Jauge & attaques SIGNATURE + munitions de la spé (la profondeur tactique) ------
// Chaque action charge la jauge (+1), encaisser un coup aussi (+1). Jauge pleine (3)
// → l'attaque SIGNATURE du type se débloque : imparable (ne rate jamais), gros effet
// thématique, remet la jauge à zéro. L'IA la lance dès qu'elle est prête : le joueur
// VOIT la jauge adverse monter et peut anticiper (bouclier, changement, consommable).
// L'attaque n°2 (la « spé ») a des MUNITIONS : 3 usages par combat, mais frappe 20 %
// plus fort (et étourdit plus souvent) — fini le spam, il faut choisir ses moments.
export const CHARGE_MAX = 3;   // actions/coups encaissés pour débloquer la signature
export const SPE_USAGES = 3;   // munitions de l'attaque n°2 (par combattant, par combat)
export const SPE_BONUS = 1.2;  // la spé tape/soigne 20 % plus fort (compense les munitions)

// Dégâts = % des PV MAX de la CIBLE (équitable quel que soit l'écart de stats — l'ulti
// du petit mord autant que celui du grand), plafonnés par l'ATQ de l'attaquant (×3,5)
// pour que les boss géants ne fondent pas. Imparable, neutre en type.
export type SignatureDef = {
  nom: string; desc: string; pvPct: number;
  soinPct?: number; etourdit?: boolean; boost?: boolean; perceBouclier?: boolean;
};
export const SIGNATURES: Record<SetId, SignatureDef> = {
  fruit: { nom: 'Tsunami Tropical', desc: 'Imparable · énorme vague qui transperce les boucliers', pvPct: 26, perceBouclier: true },
  milk: { nom: 'Marée Onctueuse', desc: 'Imparable · dégâts + rend 20 % des PV', pvPct: 18, soinPct: 20 },
  topping: { nom: 'Avalanche de Perles', desc: 'Imparable · dégâts + étourdit à coup sûr', pvPct: 18, etourdit: true },
  signature: { nom: 'Sacre Royal', desc: 'Imparable · dégâts + monte en puissance (+40 %)', pvPct: 20, boost: true },
};
export const SIG_CAP_ATK = 3.5; // plafond des dégâts d'ulti : ATQ × 3,5

// Précision / critiques (le piment des duels)
export const PRECISION_BASE = 0.92;    // attaques normales
export const PRECISION_LOURDE = 0.85;  // grosses attaques (puissance ≥ 1,3)
export const PRECISION_ZONE = 0.9;     // vague de zone (par cible)
export const CHANCE_CRITIQUE = 0.12;   // ×1,5 dégâts
export const GARDE_REDUCTION = 0.45;    // action universelle : prochain impact −45 %
export const CHANGEMENT_REDUCTION = 0.25; // changement tactique : prochain impact −25 %
export const GARDE_COOLDOWN = 2;        // tours complets avant de pouvoir garder à nouveau

// --- 🎯 TIMING « tap parfait » (action commands, CÔTÉ JOUEUR uniquement) --------------
// Quand le joueur choisit une attaque, la Signature ou la Garde, l'UI (duel.tsx)
// affiche une jauge rapide : taper dans la zone DORÉE = PARFAIT, la VERTE = BIEN,
// sinon RATÉ. Le résultat module dégâts/soins et chance de critique ; un PARFAIT ne
// peut jamais rater (précision garantie) et une Garde PARFAITE bloque −70 % en
// chargeant la jauge de +2. L'IA n'en profite jamais : c'est la prime au skill.
export type Timing = 'parfait' | 'bien' | 'rate';
export const TIMING_MULT: Record<Timing, number> = { parfait: 1.3, bien: 1.12, rate: 0.85 };
export const TIMING_CRIT: Record<Timing, number> = { parfait: 0.2, bien: 0.06, rate: 0 };
export const TIMING_ZONE_OR = 0.16;    // largeur de la zone dorée (fraction de la jauge)
export const TIMING_ZONE_VERT = 0.42;  // largeur de la zone verte (dorée incluse)
export const GARDE_PARFAITE = 0.7;     // parade PARFAITE : −70 % au lieu de −45 %
// Position du curseur (0..1) → résultat. Zones centrées sur 0,5. Helper PUR (testé).
// `zones` permet de rétrécir la fenêtre (carte blessée) — défaut = zones standard.
export function timingDepuisPosition(pos: number, zones: { or: number; vert: number } = { or: TIMING_ZONE_OR, vert: TIMING_ZONE_VERT }): Timing {
  const d = Math.abs(pos - 0.5);
  if (d <= zones.or / 2) return 'parfait';
  if (d <= zones.vert / 2) return 'bien';
  return 'rate';
}

// --- 🩸 VISÉE BLESSÉE : plus ta carte souffre, plus viser est dur -----------------------
// La jauge de timing s'appuie sur l'état de TA carte active : curseur plus rapide et
// zones plus étroites quand elle est blessée (mains qui tremblent). Intuitif : on le
// SENT — et ça pousse à soigner/changer au lieu de tanker sans réfléchir.
export const VISEE_DUREE_BASE = 900;   // ms du balayage à pleine forme
export const VISEE_DUREE_MIN = 560;    // ms à l'agonie — la barre FILE, panique !
export function viseeBlessure(pv: number, pvMax: number): number {
  return Math.max(0, Math.min(1, 1 - pv / Math.max(1, pvMax)));
}
export function viseeDuree(blessure: number): number {
  return Math.round(VISEE_DUREE_BASE - (VISEE_DUREE_BASE - VISEE_DUREE_MIN) * blessure);
}
export function viseeZones(blessure: number): { or: number; vert: number } {
  return {
    or: TIMING_ZONE_OR * (1 - 0.45 * blessure),   // zone dorée jusqu'à −45 %
    vert: TIMING_ZONE_VERT * (1 - 0.3 * blessure), // zone verte jusqu'à −30 %
  };
}

// --- 💧 FATIGUE DE SOIN (rééquilibrage 19/07, demande Yoann : « soins trop puissants ») --
// Chaque soin reçu par un combattant rend le SUIVANT 25 % moins efficace (plancher
// 40 %). S'applique aux DEUX camps et à toutes les sources (attaque soin, Signature,
// vol de vie, régén d'objet, consommables) — SAUF le gimmick regen du boss hebdo,
// qui est son identité. Intuitif : « le soin fatigue », fini les combats-éponges.
export const FATIGUE_SOIN_PCT = 25;
export const FATIGUE_SOIN_PLANCHER = 0.4;
export function multFatigueSoin(soinsRecus: number): number {
  return Math.max(FATIGUE_SOIN_PLANCHER, 1 - (FATIGUE_SOIN_PCT / 100) * Math.max(0, soinsRecus));
}
// Applique un soin en tenant compte de la fatigue et incrémente le compteur.
function appliquerSoin(c: Combattant, base: number): number {
  const gain = Math.max(0, Math.round(base * multFatigueSoin(c.soinsRecus)));
  if (gain > 0) {
    c.pv = Math.min(c.pvMax, c.pv + gain);
    c.soinsRecus++;
  }
  return gain;
}

// --- ⚡ COMBO DE PARFAITS (la boucle addictive du duel) -------------------------------
// Chaque PARFAIT enchaîné met +8 % de dégâts « en banque » pour les coups suivants
// (plafonné à +24 %). Un RATÉ casse tout, un BIEN préserve sans ajouter. Le compteur
// vit côté UI (duel.tsx) et le multiplicateur s'applique via jouerRound(comboA).
export const COMBO_PARFAIT_PCT = 8;
export const COMBO_PARFAIT_MAX = 3;
export function multCombo(comboAvant: number): number {
  return 1 + (COMBO_PARFAIT_PCT / 100) * Math.max(0, Math.min(COMBO_PARFAIT_MAX, Math.round(comboAvant)));
}

// --- Les fiches des 24 combattants --------------------------------------------------

export const FICHES: Record<string, FicheCombat> = {
  // 🧋 Milk Tea (communs)
  boba: { pv: 98, atk: 16, vit: 10, attaques: [{ nom: 'Boulet de tapioca', type: 'degats', puissance: 1 }, { nom: 'Roulade géante', type: 'degats', puissance: 1.35 }] },
  classico: { pv: 92, atk: 16, vit: 12, attaques: [{ nom: 'Gorgée classique', type: 'degats', puissance: 1 }, { nom: 'Recette originale', type: 'boost', puissance: 1 }] },
  theo: { pv: 90, atk: 15, vit: 13, attaques: [{ nom: 'Coup de sachet', type: 'degats', puissance: 1 }, { nom: 'Infusion soporifique', type: 'etourdit', puissance: 0.7 }] },
  lacto: { pv: 96, atk: 15, vit: 11, attaques: [{ nom: 'Éclaboussure', type: 'degats', puissance: 1 }, { nom: 'Bain de lait', type: 'soin', puissance: 1.15 }] },
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
  mochito: { pv: 122, atk: 21, vit: 13, attaques: [{ nom: 'Tape moelleuse', type: 'degats', puissance: 1 }, { nom: 'Câlin mochi', type: 'soin', puissance: 1.15 }] },
  coco: { pv: 120, atk: 22, vit: 14, attaques: [{ nom: 'Noix de coco', type: 'degats', puissance: 1 }, { nom: 'Lait de coco', type: 'soin', puissance: 1.1 }] },
  pudding: { pv: 118, atk: 22, vit: 14, attaques: [{ nom: 'Flan flan', type: 'degats', puissance: 1 }, { nom: 'Caramélisation', type: 'boost', puissance: 1 }] },
  nuage: { pv: 126, atk: 21, vit: 12, attaques: [{ nom: 'Coup de brume', type: 'degats', puissance: 0.95 }, { nom: 'Cocon de chantilly', type: 'soin', puissance: 1.25 }] },
  // 👑 Signatures (légendaires)
  'taro-queen': { pv: 140, atk: 26, vit: 16, attaques: [{ nom: 'Sceptre taro', type: 'degats', puissance: 1.05 }, { nom: 'Décret royal', type: 'degats', puissance: 1.45 }] },
  'matcha-sensei': { pv: 138, atk: 25, vit: 18, attaques: [{ nom: 'Fouet cérémonial', type: 'degats', puissance: 1.05 }, { nom: 'Méditation zen', type: 'etourdit', puissance: 0.75 }] },
  'brown-sugar-king': { pv: 146, atk: 26, vit: 15, attaques: [{ nom: 'Rayure de caramel', type: 'degats', puissance: 1.05 }, { nom: 'Couronne fondante', type: 'boost', puissance: 1 }] },
  'oreo-star': { pv: 136, atk: 26, vit: 17, attaques: [{ nom: 'Éclat de cookie', type: 'degats', puissance: 1.05 }, { nom: 'Pluie d\'étoiles', type: 'zone', puissance: 0.6 }] },
  'caramel-chef': { pv: 142, atk: 25, vit: 15, attaques: [{ nom: 'Louche brûlante', type: 'degats', puissance: 1.05 }, { nom: 'Nappage réparateur', type: 'soin', puissance: 1.15 }] },
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
  niveau: number;          // 💪 niveau d'entraînement (1..10, joueur uniquement)
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
  charge: number;          // ⭐ jauge signature (0..CHARGE_MAX)
  speRestantes: number;    // 🔋 munitions de l'attaque n°2 (SPE_USAGES par combat)
  gimmick?: BossGimmick;   // 👹 règle spéciale (boss hebdomadaire uniquement)
  gardePct: number;        // réduction du prochain impact (Garde ou changement)
  gardeCooldown: number;   // tours restants avant une nouvelle Garde
  soinsRecus: number;      // 💧 fatigue de soin : chaque soin suivant rend moins
  collantTours: number;    // 🍯 −4 VIT pendant N actions
  givre: boolean;          // ❄️ prochain impact ×1,35
  petillant: boolean;      // 🫧 prochain impact éclabousse le banc
  bossPhase: 1 | 2 | 3;    // phases de rage à 70 % et 35 % PV
};

export type IntentionIA = 0 | 1 | 'signature';

export type EtatCombat = {
  equipes: Record<CoteCombat, Combattant[]>;
  actifs: Record<CoteCombat, number>;
  round: number;
  fini: boolean;
  vainqueur: CoteCombat | null;
  mutateur?: Mutateur;   // ⚡ règle spéciale du jour, appliquée à la résolution
  intentionB: IntentionIA; // action adverse verrouillée et montrée AVANT le choix joueur
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

// `niveau` = niveau d'ENTRAÎNEMENT de la carte (1..NIVEAU_CARTE_MAX, joueur uniquement) :
// +6 % PV/ATQ par niveau au-delà du 1 via multNiveauCarte. La VIT ne bouge pas.
export function creerCombattant(id: string, echelle = 1, objets: ObjetId[] = [], niveau = 1): Combattant {
  const fiche = FICHES[id];
  const meta = trouverCollectible(id);
  if (!fiche || !meta) throw new Error(`fiche de combat manquante : ${id}`);
  // effet agrégé des objets équipés (+ bonus de panoplie) + PASSIF de la carte
  const eff = agregerEffets(objets, PASSIFS[id]?.eff);
  const mNv = multNiveauCarte(niveau);
  const atk = Math.round(fiche.atk * echelle * mNv * (1 + (eff.atkPct ?? 0) / 100));
  const vit = fiche.vit + (eff.vit ?? 0);
  const pvMax = Math.round(fiche.pv * echelle * mNv * (1 + (eff.pvPct ?? 0) / 100));
  return {
    id,
    nom: meta.nom,
    set: meta.set,
    rarete: meta.rarete,
    niveau: Math.max(1, Math.round(niveau)),
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
    charge: 0,
    speRestantes: SPE_USAGES,
    gardePct: 0,
    gardeCooldown: 0,
    soinsRecus: 0,
    collantTours: 0,
    givre: false,
    petillant: false,
    bossPhase: 1,
  };
}

// ⚖️ Applique le bonus outsider (stats × mult selon le coût de l'équipe) à un camp.
function appliquerOutsider(cs: Combattant[]) {
  const m = multOutsider(coutEquipe(cs.map((c) => c.id)));
  if (m === 1) return;
  for (const c of cs) {
    c.pvMax = Math.round(c.pvMax * m);
    c.pv = c.pvMax;
    c.atk = Math.round(c.atk * m);
  }
}

export function creerCombat(
  idsA: string[], idsB: string[], echelleB = 1,
  objetsA: Record<string, ObjetId[]> = {}, objetsB: Record<string, ObjetId[]> = {},
  mutateur?: Mutateur, niveauxA: Record<string, number> = {},
): EtatCombat {
  const a = idsA.map((id) => creerCombattant(id, 1, objetsA[id] ?? [], niveauxA[id] ?? 1));
  const b = idsB.map((id) => creerCombattant(id, echelleB, objetsB[id] ?? []));
  appliquerOutsider(a);
  appliquerOutsider(b); // même règle des deux côtés (une compo modeste reste dangereuse)
  const etat: EtatCombat = { equipes: { a, b }, actifs: { a: 0, b: 0 }, round: 0, fini: false, vainqueur: null, mutateur, intentionB: 0 };
  etat.intentionB = choisirAttaqueIA(etat, 'b', () => 0.5);
  return etat;
}

// 👹 Combat contre le boss hebdomadaire : ton équipe de 3 vs UNE éponge à PV + gimmick.
export function creerCombatBoss(
  idsA: string[], boss: Boss, objetsA: Record<string, ObjetId[]> = {}, mutateur?: Mutateur,
  niveauxA: Record<string, number> = {},
): EtatCombat {
  const bossC = creerCombattant(boss.combattantId, boss.echelle, []);
  bossC.pvMax = Math.round(bossC.pvMax * boss.pvBonus);
  bossC.pv = bossC.pvMax;
  bossC.nom = boss.nom;
  bossC.gimmick = boss.gimmick;
  const a = idsA.map((id) => creerCombattant(id, 1, objetsA[id] ?? [], niveauxA[id] ?? 1));
  appliquerOutsider(a); // le bonus outsider s'applique à l'équipe du joueur, pas au boss
  const etat: EtatCombat = {
    equipes: { a, b: [bossC] },
    actifs: { a: 0, b: 0 },
    round: 0,
    fini: false,
    vainqueur: null,
    mutateur,
    intentionB: 0,
  };
  etat.intentionB = choisirAttaqueIA(etat, 'b', () => 0.5);
  return etat;
}

export function actif(etat: EtatCombat, cote: CoteCombat): Combattant {
  return etat.equipes[cote][etat.actifs[cote]];
}

function adverse(cote: CoteCombat): CoteCombat {
  return cote === 'a' ? 'b' : 'a';
}

// --- IA (côté b, et côté a pour les replays automatiques) --------------------------------

// Choisit une attaque : signature dès que la jauge est pleine, achève si possible,
// se soigne si mal en point, sinon privilégie la plus grosse attaque (zone valorisée
// par cible vivante). Respecte les munitions de la spé (attaque n°2).
export function choisirAttaqueIA(etat: EtatCombat, cote: CoteCombat, rng: Rng): 0 | 1 | 'signature' {
  const moi = actif(etat, cote);
  // ⭐ jauge pleine → signature immédiate (lisible : l'adversaire la voit venir)
  if (moi.charge >= CHARGE_MAX) return 'signature';
  const speOk = moi.speRestantes > 0;
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
    if (i === 1 && !speOk) continue;
    const a = moi.attaques[i];
    if (estOffensive(a) && a.type !== 'zone' && degatsAttendus(a) * 0.9 >= lui.pv) return i;
  }
  // 2) soin si mal en point
  for (const i of [1, 0] as const) {
    if (i === 1 && !speOk) continue;
    if (moi.attaques[i].type === 'soin' && moi.pv < moi.pvMax * 0.38 && rng() < 0.7) return i;
  }
  // 3) un peu d'imprévisible
  if (rng() < 0.2) return rng() < 0.5 || !speOk ? 0 : 1;
  // 4) sinon : la meilleure option
  const s0 = degatsAttendus(moi.attaques[0]) + (moi.attaques[0].type === 'boost' ? moi.atk * 0.8 : 0);
  const s1 = degatsAttendus(moi.attaques[1]) + (moi.attaques[1].type === 'boost' && moi.boostTours === 0 ? moi.atk * 0.9 : 0)
    + (moi.attaques[1].type === 'bouclier' && !moi.bouclier ? moi.atk * 0.7 : 0);
  return speOk && s1 >= s0 ? 1 : 0;
}

export type DescriptionIntention = {
  titre: string;
  detail: string;
  ton: 'normal' | 'danger' | 'soin' | 'defense';
};

// Contrat d'interface : cette description vient de l'action déjà verrouillée
// dans l'état. Le moteur exécutera exactement ce qui est annoncé.
export function decrireIntention(etat: EtatCombat): DescriptionIntention {
  const c = actif(etat, 'b');
  if (c.etourdi) return { titre: 'Passe son tour', detail: `${c.nom} est étourdi`, ton: 'defense' };
  if (etat.intentionB === 'signature') {
    const sig = SIGNATURES[c.set];
    return { titre: `Signature : ${sig.nom}`, detail: sig.desc, ton: 'danger' };
  }
  const attaque = c.attaques[etat.intentionB];
  const ton = attaque.type === 'soin' ? 'soin'
    : attaque.type === 'bouclier' || attaque.type === 'boost' ? 'defense'
      : attaque.puissance >= 1.3 || attaque.type === 'zone' || attaque.type === 'double' ? 'danger' : 'normal';
  return {
    titre: attaque.nom,
    detail: `${etat.intentionB === 1 ? `Spé · ${c.speRestantes} charge${c.speRestantes > 1 ? 's' : ''} · ` : ''}${HINT_ATTAQUE[attaque.type]}`,
    ton,
  };
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

function actualiserPhaseBoss(c: Combattant, cote: CoteCombat, evts: EvtCombat[]) {
  if (!c.gimmick || c.pv <= 0) return;
  const ratio = c.pv / Math.max(1, c.pvMax);
  const cible: 1 | 2 | 3 = ratio <= 0.35 ? 3 : ratio <= 0.7 ? 2 : 1;
  while (c.bossPhase < cible) {
    c.bossPhase = (c.bossPhase + 1) as 2 | 3;
    if (c.bossPhase === 2) {
      c.atk = Math.round(c.atk * 1.12);
      evts.push({ t: 'statut', cote, texte: `${c.nom} passe en PHASE 2 : sa puissance augmente !` });
    } else {
      c.atk = Math.round(c.atk * 1.15);
      c.vit += 3;
      c.charge = CHARGE_MAX;
      evts.push({ t: 'statut', cote, texte: `${c.nom} entre en PHASE FINALE : Signature imminente !` });
    }
  }
}

// `timing`/`combo` ne sont fournis QUE pour le côté joueur (a) : jauge tap-parfait
// et nombre de PARFAITS déjà en banque avant cette action.
function agir(etat: EtatCombat, cote: CoteCombat, choix: 0 | 1 | 'signature', rng: Rng, evts: EvtCombat[], timing?: Timing, combo = 0) {
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

  // 👹 gimmick bouclier : le boss lève sa garde un tour sur deux
  if (moi.gimmick === 'bouclier' && !moi.bouclier && etat.round % 2 === 1) {
    moi.bouclier = true;
    evts.push({ t: 'statut', cote, texte: `${moi.nom} lève un bouclier ! 🛡️` });
  }

  // ⭐ garde-fous : signature sans jauge pleine / spé sans munitions → attaque de base
  if (choix === 'signature' && moi.charge < CHARGE_MAX) choix = 0;
  if (choix === 1 && moi.speRestantes <= 0) choix = 0;
  const estSpe = choix === 1;
  if (estSpe) moi.speRestantes--;                                      // 🔋 une munition (même si ça rate)

  const mut = etat.mutateur;                                           // ⚡ mutateur du jour
  const boost = moi.boostTours > 0 ? 1.4 : 1;
  const bonusPrecision = (moi.eff.precisionPct ?? 0) / 100;             // 🎯
  const chanceCrit = (CHANCE_CRITIQUE + (moi.eff.critPct ?? 0) / 100) * (mut?.critChanceX2 ? 2 : 1)
    + (timing ? TIMING_CRIT[timing] : 0); // 🍀 💥 🎯 un bon timing rend le critique plus probable

  // Inflige des dégâts à UNE cible — précision, critique, bouclier, effets d'objets, mutateur.
  // `estZone` active la réduction Isotherme ; `perceForce` = la signature transperce.
  // Retourne true si la cible est touchée. Un coup encaissé charge la jauge de la cible (+1).
  const frapper = (qui: Combattant, indexQui: number, puissance: number, precisionBase: number, estZone = false): boolean => {
    // 🎯 un tap PARFAIT ne peut pas rater : la prise de risque est récompensée
    if (timing !== 'parfait' && !mut?.precisionParfaite && rng() > Math.min(1, precisionBase + bonusPrecision)) {
      evts.push({ t: 'statut', cote: adverse(cote), texte: `${qui.nom} esquive l'attaque ! 💨` });
      return false;
    }
    const mult = multType(moi.set, qui.set);
    const crit = rng() < chanceCrit;
    if (crit) evts.push({ t: 'statut', cote, texte: 'Coup critique ! 💥' });
    let degats = Math.round(moi.atk * puissance * mult * boost * (crit ? 1.5 : 1) * (0.9 + rng() * 0.2) * (mut?.degatsMult ?? 1)
      * (timing ? TIMING_MULT[timing] * multCombo(combo) : 1)); // 🎯 timing × ⚡ combo de parfaits
    // 👹 gimmick : le boss « insensible à la zone » ne prend aucun dégât de zone
    if (estZone && qui.gimmick === 'zone-immune') {
      degats = 0;
      evts.push({ t: 'statut', cote: adverse(cote), texte: `${qui.nom} est insensible aux attaques de zone ! 🛡️` });
    }
    // 🌊 Tempête : les dégâts de ZONE sont renforcés par le mutateur…
    if (estZone && mut?.zoneMult) degats = Math.round(degats * mut.zoneMult);
    // 🧊 …puis réduits par l'Isotherme / panoplie Givré de la cible
    if (estZone && qui.eff.reducZonePct) degats = Math.ceil(degats * (1 - qui.eff.reducZonePct / 100));
    // ❄️ combo Givré : le prochain impact brise la marque et frappe plus fort.
    if (qui.givre && degats > 0) {
      degats = Math.ceil(degats * 1.35);
      qui.givre = false;
      evts.push({ t: 'statut', cote, texte: `BRIS DE GLACE sur ${qui.nom} ! ❄️` });
    }
    const boucAgit = qui.bouclier && !mut?.sansBouclier;               // 🛡️ mutateur peut désactiver les boucliers
    const perce = moi.eff.perceBouclier;
    if (boucAgit && !perce) {
      degats = Math.ceil(degats / 2);
      qui.bouclier = false;
      evts.push({ t: 'statut', cote: adverse(cote), texte: `Le bouclier de ${qui.nom} encaisse la moitié !` });
    } else if (boucAgit && perce) {
      evts.push({ t: 'statut', cote, texte: `${moi.nom} transperce le bouclier ! ⚡` });
    }
    if (qui.gardePct > 0 && degats > 0) {
      const reduction = qui.gardePct;
      degats = Math.ceil(degats * (1 - reduction));
      qui.gardePct = 0;
      evts.push({ t: 'statut', cote: adverse(cote), texte: `${qui.nom} amortit ${Math.round(reduction * 100)} % du choc !` });
    }
    const avant = qui.pv;
    const inflige = Math.min(avant, degats);
    qui.pv = Math.max(0, avant - degats);
    actualiserPhaseBoss(qui, adverse(cote), evts);
    if (inflige > 0) qui.charge = Math.min(CHARGE_MAX, qui.charge + 1); // ⭐ encaisser charge la jauge
    let revive = false;
    if (qui.pv <= 0 && qui.reviveDispo) { qui.pv = 1; qui.reviveDispo = false; revive = true; } // 🧿 Grigri
    evts.push({ t: 'degats', cote: adverse(cote), index: indexQui, valeur: degats, efficace: mult, pvApres: qui.pv });
    if (revive) evts.push({ t: 'statut', cote: adverse(cote), texte: `${qui.nom} tient bon à 1 PV ! 🧿` });
    else if (qui.pv <= 0) evts.push({ t: 'ko', cote: adverse(cote), index: indexQui, nom: qui.nom });
    // 🩸 vol de vie de l'attaquant (Caramel / panoplie Sucré) — modulé par le mutateur
    // de soin puis par la 💧 fatigue de soin
    if (inflige > 0 && moi.eff.volDeViePct && moi.pv > 0) {
      const soin = appliquerSoin(moi, inflige * moi.eff.volDeViePct / 100 * (mut?.soinMult ?? 1));
      if (soin > 0) evts.push({ t: 'soin', cote, index: indexMoi, valeur: soin, pvApres: moi.pv });
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
    // 🫧 combo Pétillant : l'impact éclabousse tous les remplaçants encore debout.
    if (inflige > 0 && qui.petillant) {
      qui.petillant = false;
      const equipe = etat.equipes[adverse(cote)];
      const splash = Math.max(1, Math.round(inflige * 0.25));
      for (let i = 0; i < equipe.length; i++) {
        const banc = equipe[i];
        if (i === indexQui || banc.pv <= 0) continue;
        const avantBanc = banc.pv;
        banc.pv = Math.max(0, banc.pv - splash);
        evts.push({ t: 'degats', cote: adverse(cote), index: i, valeur: Math.min(avantBanc, splash), efficace: 1, pvApres: banc.pv });
        if (banc.pv <= 0) evts.push({ t: 'ko', cote: adverse(cote), index: i, nom: banc.nom });
      }
      evts.push({ t: 'statut', cote, texte: 'ÉCLABOUSSURE PÉTILLANTE sur le banc ! 🫧' });
    }
    return true;
  };

  if (choix === 'signature') {
    // ⭐ ATTAQUE SIGNATURE : imparable, dégâts FIXES = % des PV max de la cible
    // (plafonnés à ATQ × SIG_CAP_ATK), neutre en type. Le bouclier encaisse la
    // moitié (contre-jeu assumé), sauf face au perce-bouclier fruité.
    const sig = SIGNATURES[moi.set];
    moi.charge = 0;
    evts.push({ t: 'annonce', cote, texte: `⭐ ${moi.nom} déchaîne ${sig.nom} !` });
    let degatsSig = Math.min(Math.round(cible.pvMax * sig.pvPct / 100), Math.round(moi.atk * SIG_CAP_ATK));
    if (timing) degatsSig = Math.round(degatsSig * TIMING_MULT[timing] * multCombo(combo)); // 🎯 timing × ⚡ combo
    if (cible.givre) {
      degatsSig = Math.ceil(degatsSig * 1.35);
      cible.givre = false;
      evts.push({ t: 'statut', cote, texte: `BRIS DE GLACE sur ${cible.nom} ! ❄️` });
    }
    const boucSig = cible.bouclier && !mut?.sansBouclier;
    if (boucSig && !(sig.perceBouclier || moi.eff.perceBouclier)) {
      degatsSig = Math.ceil(degatsSig / 2);
      cible.bouclier = false;
      evts.push({ t: 'statut', cote: adverse(cote), texte: `Le bouclier de ${cible.nom} encaisse la moitié !` });
    } else if (boucSig) {
      evts.push({ t: 'statut', cote, texte: `${moi.nom} transperce le bouclier ! ⚡` });
    }
    if (cible.gardePct > 0) {
      const reduction = cible.gardePct;
      degatsSig = Math.ceil(degatsSig * (1 - reduction));
      cible.gardePct = 0;
      evts.push({ t: 'statut', cote: adverse(cote), texte: `${cible.nom} amortit ${Math.round(reduction * 100)} % de la Signature !` });
    }
    const avantSig = cible.pv;
    cible.pv = Math.max(0, cible.pv - degatsSig);
    actualiserPhaseBoss(cible, adverse(cote), evts);
    // 💪 comeback : ENCAISSER une signature charge FORT ta propre jauge (+2)
    if (degatsSig > 0 && cible.pv > 0) cible.charge = Math.min(CHARGE_MAX, cible.charge + 2);
    let reviveSig = false;
    if (cible.pv <= 0 && cible.reviveDispo) { cible.pv = 1; cible.reviveDispo = false; reviveSig = true; } // 🧿 Grigri
    evts.push({ t: 'degats', cote: adverse(cote), index: indexCible, valeur: Math.min(avantSig, degatsSig), efficace: 1, pvApres: cible.pv });
    if (reviveSig) evts.push({ t: 'statut', cote: adverse(cote), texte: `${cible.nom} tient bon à 1 PV ! 🧿` });
    else if (cible.pv <= 0) evts.push({ t: 'ko', cote: adverse(cote), index: indexCible, nom: cible.nom });
    if (sig.soinPct && moi.pv > 0 && moi.pv < moi.pvMax) {
      const g = appliquerSoin(moi, moi.pvMax * sig.soinPct / 100 * (mut?.soinMult ?? 1)); // 💧 fatigue
      if (g > 0) evts.push({ t: 'soin', cote, index: indexMoi, valeur: g, pvApres: moi.pv });
    }
    if (sig.etourdit && cible.pv > 0) {
      if (cible.eff.immuniteEtourdi) evts.push({ t: 'statut', cote: adverse(cote), texte: `${cible.nom} est insensible à l'étourdissement ! ❄️` });
      else { cible.etourdi = true; evts.push({ t: 'statut', cote: adverse(cote), texte: `${cible.nom} est étourdi ! 💫` }); }
    }
    if (sig.boost) {
      moi.boostTours = 3; // décrémenté à la fin de CETTE action → effectif 2 tours
      evts.push({ t: 'statut', cote, texte: `${moi.nom} monte en puissance ! (+40 % ATQ) 💪` });
    }
    if (degatsSig > 0 && cible.petillant) {
      cible.petillant = false;
      const splash = Math.max(1, Math.round(degatsSig * 0.25));
      etat.equipes[adverse(cote)].forEach((banc, i) => {
        if (i === indexCible || banc.pv <= 0) return;
        const avant = banc.pv;
        banc.pv = Math.max(0, banc.pv - splash);
        evts.push({ t: 'degats', cote: adverse(cote), index: i, valeur: Math.min(avant, splash), efficace: 1, pvApres: banc.pv });
        if (banc.pv <= 0) evts.push({ t: 'ko', cote: adverse(cote), index: i, nom: banc.nom });
      });
      evts.push({ t: 'statut', cote, texte: 'La Signature déclenche l’ÉCLABOUSSURE PÉTILLANTE ! 🫧' });
    }
  } else {
    const attaque = moi.attaques[choix];
    const bonus = estSpe ? SPE_BONUS : 1; // 🔋 la spé frappe/soigne plus fort
    let touchePourMarque = false;
    evts.push({ t: 'annonce', cote, texte: `${moi.nom} utilise ${attaque.nom} !` });

    switch (attaque.type) {
      case 'degats':
        touchePourMarque = frapper(cible, indexCible, attaque.puissance * bonus, attaque.puissance >= 1.3 ? PRECISION_LOURDE : PRECISION_BASE);
        break;
      case 'double':
        touchePourMarque = frapper(cible, indexCible, attaque.puissance * bonus, PRECISION_BASE);
        if (cible.pv > 0) touchePourMarque = frapper(cible, indexCible, attaque.puissance * bonus, PRECISION_BASE) || touchePourMarque;
        break;
      case 'etourdit': {
        const touche = frapper(cible, indexCible, attaque.puissance * bonus, PRECISION_BASE);
        touchePourMarque = touche;
        if (touche && cible.pv > 0 && rng() < (estSpe ? 0.7 : 0.55)) {
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
          if (c.pv > 0) touchePourMarque = frapper(c, i, attaque.puissance * bonus, PRECISION_ZONE, true) || touchePourMarque;
        }
        break;
      }
      case 'soin': {
        // 💧 fatigue de soin : chaque soin successif du combat rend 25 % de moins
        const avantFatigue = moi.soinsRecus;
        const gain = appliquerSoin(moi, moi.atk * attaque.puissance * bonus * (mut?.soinMult ?? 1) * (timing ? TIMING_MULT[timing] : 1));
        evts.push({ t: 'soin', cote, index: indexMoi, valeur: gain, pvApres: moi.pv });
        if (avantFatigue === 1) evts.push({ t: 'statut', cote, texte: `Le soin FATIGUE : chaque soin suivant rend moins à ${moi.nom} !` });
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

    // Les attaques Spé offensives posent une marque de famille. Le joueur peut
    // ensuite changer de combattant pour déclencher le combo correspondant.
    if (estSpe && touchePourMarque && cible.pv > 0) {
      if (moi.set === 'fruit') {
        cible.collantTours = Math.max(cible.collantTours, 2);
        evts.push({ t: 'statut', cote: adverse(cote), texte: `${cible.nom} devient COLLANT : −4 VIT ! 🍯` });
      } else if (moi.set === 'milk') {
        cible.givre = true;
        evts.push({ t: 'statut', cote: adverse(cote), texte: `${cible.nom} est GIVRÉ : prochain impact renforcé ! ❄️` });
      } else if (moi.set === 'topping') {
        cible.petillant = true;
        evts.push({ t: 'statut', cote: adverse(cote), texte: `${cible.nom} devient PÉTILLANT : prochain impact sur le banc ! 🫧` });
      }
    }
  }
  if (moi.boostTours > 0) moi.boostTours--;
  if (moi.collantTours > 0) moi.collantTours--;

  // 🍯 régénération par tour (Nappé / panoplie Sucré) — après l'action, 💧 fatigue incluse
  if (moi.eff.soinTour && moi.pv > 0 && moi.pv < moi.pvMax) {
    const soin = appliquerSoin(moi, moi.eff.soinTour * (mut?.soinMult ?? 1));
    if (soin > 0) evts.push({ t: 'soin', cote, index: indexMoi, valeur: soin, pvApres: moi.pv });
  }

  // 👹 gimmick regen : le boss se soigne à la fin de SON tour (sauté s'il était étourdi,
  // car un boss étourdi sort de agir() avant d'arriver ici).
  if (moi.gimmick === 'regen' && moi.pv > 0 && moi.pv < moi.pvMax) {
    const soin = Math.round(moi.pvMax * 0.08);
    moi.pv = Math.min(moi.pvMax, moi.pv + soin);
    evts.push({ t: 'soin', cote, index: indexMoi, valeur: soin, pvApres: moi.pv });
  }

  // remplacement des deux côtés (zone + épines peuvent faire tomber l'un ou l'autre)
  verifierRemplacement(etat, adverse(cote), evts);
  verifierRemplacement(etat, cote, evts);
}

// Action du joueur : attaque, Signature, Garde, changement actif, ou consommable.
export type ActionJoueur = 0 | 1 | 'signature' | 'garde' | { changer: number } | { objet: ConsommableId };

export function preparerIntentionIA(etat: EtatCombat, rng: Rng = Math.random) {
  if (!etat.fini) etat.intentionB = choisirAttaqueIA(etat, 'b', rng);
}

// Joue un round complet : les deux camps agissent dans l'ordre de VIT.
// `choixA` = attaque du joueur (ou changement) ; le camp b joue à l'IA (ou `choixB`).
// `timingA` = résultat de la jauge tap-parfait du joueur (attaque, Signature ou Garde).
// `comboA` = PARFAITS consécutifs déjà en banque AVANT cette action (⚡ multCombo).
export function jouerRound(etat: EtatCombat, choixA: ActionJoueur, rng: Rng = Math.random, choixB?: 0 | 1 | 'signature', timingA?: Timing, comboA = 0): EvtCombat[] {
  if (etat.fini) return [];
  const evts: EvtCombat[] = [];
  etat.round++;
  const actifA = actif(etat, 'a');
  if (actifA.gardeCooldown > 0) actifA.gardeCooldown--;
  const cb = choixB ?? etat.intentionB;
  const finirRound = () => preparerIntentionIA(etat, rng);

  // 🛡️ Garde universelle : lisible grâce à l'intention ennemie, mais bornée
  // par un cooldown pour ne pas remplacer les vrais personnages défensifs.
  if (choixA === 'garde') {
    const moi = actif(etat, 'a');
    if (moi.gardeCooldown <= 0) {
      const parfaite = timingA === 'parfait'; // 🎯 PARADE PARFAITE : bloque plus, charge plus
      moi.gardePct = Math.max(moi.gardePct, parfaite ? GARDE_PARFAITE : GARDE_REDUCTION);
      moi.gardeCooldown = GARDE_COOLDOWN + 1;
      moi.charge = Math.min(CHARGE_MAX, moi.charge + (parfaite ? 2 : 1));
      evts.push({ t: 'statut', cote: 'a', texte: parfaite
        ? `PARADE PARFAITE ! ${moi.nom} bloquera −${Math.round(GARDE_PARFAITE * 100)} % et charge fort sa jauge !`
        : `${moi.nom} se met en GARDE : prochain impact −${Math.round(GARDE_REDUCTION * 100)} % !` });
      if (!etat.fini) agir(etat, 'b', cb, rng, evts);
      finirRound();
      return evts;
    }
    choixA = 0;
  }

  // 🔄 Changement actif / 🎒 consommable : le joueur PAIE son tour, puis b frappe.
  if (typeof choixA === 'object') {
    if ('changer' in choixA) {
      const idx = choixA.changer;
      const eq = etat.equipes.a;
      if (idx !== etat.actifs.a && eq[idx] && eq[idx].pv > 0) {
        etat.actifs.a = idx;
        eq[idx].gardePct = Math.max(eq[idx].gardePct, CHANGEMENT_REDUCTION);
        evts.push({ t: 'entree', cote: 'a', index: idx, nom: eq[idx].nom });
        evts.push({ t: 'statut', cote: 'a', texte: `Changement tactique : ${eq[idx].nom} amortira le prochain impact de ${Math.round(CHANGEMENT_REDUCTION * 100)} %.` });
      }
    } else {
      // 🎒 consommable joué sur l'actif (ou dégâts directs à l'adversaire)
      const conso = CONSOMMABLES[choixA.objet];
      const moi = actif(etat, 'a');
      const idxMoi = etat.actifs.a;
      if (conso) {
        const e = conso.effet;
        evts.push({ t: 'annonce', cote: 'a', texte: `${moi.nom} utilise ${conso.nom} !` });
        if (e.soinPct) {
          const g = appliquerSoin(moi, moi.pvMax * e.soinPct / 100); // 💧 fatigue de soin
          evts.push({ t: 'soin', cote: 'a', index: idxMoi, valeur: g, pvApres: moi.pv });
        }
        if (e.retireEtourdi && moi.etourdi) { moi.etourdi = false; evts.push({ t: 'statut', cote: 'a', texte: `${moi.nom} retrouve ses esprits ! 🌿` }); }
        if (e.boost) { moi.boostTours = 2; evts.push({ t: 'statut', cote: 'a', texte: `${moi.nom} déborde d'énergie ! (+40 % ATQ) ⚡` }); }
        if (e.bouclier) { moi.bouclier = true; evts.push({ t: 'statut', cote: 'a', texte: `${moi.nom} se protège ! 🛡️` }); }
        if (e.degatsEnnemi) {
          const cible = actif(etat, 'b');
          const idxCible = etat.actifs.b;
          cible.pv = Math.max(0, cible.pv - e.degatsEnnemi);
          actualiserPhaseBoss(cible, 'b', evts);
          evts.push({ t: 'degats', cote: 'b', index: idxCible, valeur: e.degatsEnnemi, efficace: 1, pvApres: cible.pv });
          if (cible.pv <= 0) evts.push({ t: 'ko', cote: 'b', index: idxCible, nom: cible.nom });
          verifierRemplacement(etat, 'b', evts);
        }
      }
    }
    if (!etat.fini) agir(etat, 'b', cb, rng, evts);
    finirRound();
    return evts;
  }

  // ⏳ Sablier / panoplie Sucré : agit en premier au 1er round (gros bonus de VIT ponctuel)
  const vitBonus = (c: Combattant) => (etat.round === 1 && c.eff.agitPremier ? 1000 : 0);
  const ca = actif(etat, 'a'); const cbt = actif(etat, 'b');
  const vitA = ca.vit - (ca.collantTours > 0 ? 4 : 0) + vitBonus(ca);
  const vitB = cbt.vit - (cbt.collantTours > 0 ? 4 : 0) + vitBonus(cbt);
  const premier: CoteCombat = vitA === vitB ? (rng() < 0.5 ? 'a' : 'b') : vitA > vitB ? 'a' : 'b';
  const ordre: CoteCombat[] = premier === 'a' ? ['a', 'b'] : ['b', 'a'];
  for (const cote of ordre) {
    if (etat.fini) break;
    agir(etat, cote, cote === 'a' ? choixA : cb, rng, evts, cote === 'a' ? timingA : undefined, cote === 'a' ? comboA : 0);
  }
  finirRound();
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

// 🤝 Défis asynchrones (preview) : des « amis » simulés qui t'ont défié. Chacun a une
// équipe STABLE (déterminée par son nom) — en version finale, ce seront de vrais comptes.
export const AMIS_DEMO = ['Léa', 'Maxou', 'Nina', 'Tibo', 'Jade', 'Roro'];
export function equipeAmi(nom: string): string[] {
  const rng = rngGraine(graineTexte(nom, 4242));
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
  const perles = Math.min(200 + rang * 45, 700);
  const capsule = rang % 10 === 0 ? 'doree' : rang % 5 === 0 ? 'classique' : null;
  return { perles, capsule };
}
export const PERLES_DEFAITE_ARENE = 45;
export const MISES_DUEL_PAR_JOUR = 3;
