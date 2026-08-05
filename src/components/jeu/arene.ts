// === Boba Quest — L'ARÈNE : moteur de combat (logique PURE, zéro dépendance RN) ===
// Combats tour par tour type Pokémon : équipes de 3 collectibles, chacun avec
// PV / ATQ / VIT et 2 attaques. Triangle des types (= les sets) :
//   🍓 Fruité > 🧋 Milk Tea > ✨ Topping > 🍓 Fruité   (×1,5 / ×0,75)
//   👑 Signature : neutre dans les deux sens, mais des stats de légende.
// Piment : précision (les grosses attaques effleurent plus), coups critiques ×1,5,
// attaques de ZONE (toute l'équipe adverse), OBJETS tenus (bonus passifs),
// champions de TOURNOI, intentions annoncées, Garde et combos de marques.
// L'ordre d'action suit la VIT.
//
// 🔧 REFONTE 26/07 (LOT A) — quatre dettes fermées d'un coup :
//   A1 · les 6 champs de statut ad hoc deviennent UNE liste générique `statuts`
//   A2 · ÉNERGIE D'ÉQUIPE : la spé se paie, changer/objet ne coûtent plus le tour
//   A3/A4 · TRAITS d'attaque + une SIGNATURE par carte (24 identités au lieu de 4)
//   A5 · un SEUL pipeline d'impact (`resoudreImpact`) — les 4 chemins convergent
//   A6 · plus d'échec sec : un coup « raté » EFFLEURE (×0,45)
//   A7 · phases de rage pour TOUS + IA à 3 personnalités qui garde et qui change
// Testé sous Node.

// import RELATIF (même dossier) : permet aussi de tester ce module sous Node
import {
  // 🩹 26/07 — BUDGET_EQUIPE / coutCarte ajoutés : les tirages PNJ doivent respecter le
  // même budget d'équipe que le joueur (voir equipeAleatoire).
  agregerEffets, BUDGET_EQUIPE, CONSOMMABLES, coutCarte, coutEquipe, GOUT_BONUS_PCT, GOUT_MAX,
  GOUT_RANG_MARQUE, GOUT_RANG_MUNITION, multNiveauCarte, multOutsider, objetsDeSlot, PASSIFS,
  trouverCollectible, type Boss, type BossGimmick, type ConsommableId, type EffetTalent,
  type Emplacement,
  type EffetObjet, type Mutateur, type ObjetId, type Rarete, type SetId,
} from './economie';

export type CoteCombat = 'a' | 'b';
export type TypeAttaque = 'degats' | 'soin' | 'bouclier' | 'boost' | 'etourdit' | 'double' | 'zone';

// --- 🏷️ A3 · TRAITS D'ATTAQUE : 24 identités au lieu d'une ----------------------------
// Diagnostic : 24/24 cartes avaient la MÊME attaque de base (`degats`, puissance ~1,0).
// Un trait doit tenir en une phrase et se VOIR en jeu (règle d'écriture du cahier des
// charges). Chaque carte porte 1-2 traits sur son attaque de base et 1 sur sa spé.
export type TraitAttaque =
  | 'perce'      // ignore la moitié de la réduction de Garde
  | 'rapide'     // +6 VIT virtuelle pour l'ordre de CE round seulement
  | 'precise'    // ne peut pas être effleurée (traitée comme un impact plein)
  | 'siphon'     // rend 15 % des dégâts infligés (via appliquerSoin)
  | 'marque'     // pose la marque de famille même si ce n'est pas la spé
  | 'charge'     // +1 charge de Signature en plus
  | 'brise'      // détruit le bouclier de la cible avant de frapper
  | 'recul'      // retire 1 d'énergie au camp adverse
  | 'saignee'    // pose 'brulure' 2 tours (valeur = 4 % des PV max de la cible)
  | 'venin'      // pose 'poison' 3 tours (cumulable jusqu'à 3)
  | 'affaiblit'  // pose 'faiblesse' 2 tours
  | 'furie';     // pose 'fureur' sur SOI, 2 tours

// Aide affichable sous un bouton d'attaque (l'UI n'écrit AUCUN libellé de règle).
export const HINT_TRAIT: Record<TraitAttaque, string> = {
  perce: 'Perce : ignore la moitié de la Garde',
  rapide: 'Rapide : +6 VIT pour ce round',
  precise: 'Précise : ne peut pas être effleurée',
  siphon: 'Siphon : rend 15 % des dégâts en PV',
  marque: 'Marque : pose la marque de famille',
  charge: 'Charge : +1 sur la jauge Signature',
  brise: 'Brise : détruit le bouclier adverse',
  recul: 'Recul : −1 énergie au camp adverse',
  saignee: 'Saignée : brûlure pendant 2 tours',
  venin: 'Venin : poison cumulable (3 max)',
  affaiblit: 'Affaiblit : −25 % ATQ pendant 2 tours',
  furie: 'Furie : +25 % ATQ mais plus fragile',
};

// `traits` est OPTIONNEL : aucune fiche existante ne casse.
export type Attaque = { nom: string; type: TypeAttaque; puissance: number; traits?: TraitAttaque[] };

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

// --- 🧪 A1 · SYSTÈME DE STATUTS GÉNÉRIQUE (le refactor de fond) ------------------------
// AVANT : 6 champs ad hoc (`bouclier`, `etourdi`, `givre`, `petillant`, `collantTours`,
// `boostTours`) — non cumulables, sans durée uniforme, et chaque nouvel état imposait
// un champ + un `if` dans le moteur ET dans l'UI. MAINTENANT : une liste unique, des
// helpers purs comme SEULS points d'accès, et l'UI affiche `INFOS_STATUT` sans un seul
// `if` par statut (donc ajouter un statut ne touche plus jamais le rendu).
export type StatutId =
  // marques de famille (set-up / pay-off)
  | 'collant'      // 🍯 −4 VIT
  | 'givre'        // ❄️ le prochain impact subi est ×1,35, puis consommé
  | 'petillant'    // 🫧 le prochain impact subi éclabousse le banc
  // états classiques
  | 'bouclier'     // 🛡️ encaisse le prochain impact à moitié
  | 'etourdi'      // 😵 passe sa prochaine action
  | 'boost'        // 💪 +40 % ATQ
  | 'garde'        // 🛡️ réduction du prochain impact (valeur = pct 0..1)
  // nouveaux (A1)
  | 'brulure'      // 🔥 perd `valeur` PV en fin de tour
  | 'poison'       // ☠️ perd 6 % de ses PV MAX en fin de tour (cumulable, max 3 piles)
  | 'regen'        // 💚 récupère `valeur` PV en fin de tour (passe par appliquerSoin)
  | 'faiblesse'    // 📉 −25 % ATQ
  | 'fureur'       // 😤 +25 % ATQ mais −20 % de réduction de dégâts subis
  | 'insensible';  // 🪨 immunisé aux nouveaux statuts (1 tour)

export type Statut = {
  id: StatutId;
  tours: number;    // actions restantes ; -1 = jusqu'à consommation (bouclier, givre…)
  piles: number;    // cumul (poison ×3 max) — 1 par défaut
  valeur?: number;  // charge utile (pct de garde, PV de brûlure…)
};

// Table LUE PAR L'UI (§B3) : une puce par statut, aucun `if` par statut côté rendu.
export const INFOS_STATUT: Record<StatutId, { emoji: string; nom: string; aide: string }> = {
  collant: { emoji: '🍯', nom: 'Collant', aide: '−4 VIT : agit après les autres.' },
  givre: { emoji: '❄️', nom: 'Givré', aide: 'Le prochain impact subi frappe 35 % plus fort.' },
  petillant: { emoji: '🫧', nom: 'Pétillant', aide: 'Le prochain impact subi éclabousse le banc.' },
  bouclier: { emoji: '🛡️', nom: 'Bouclier', aide: 'Encaisse le prochain impact à moitié.' },
  etourdi: { emoji: '😵', nom: 'Étourdi', aide: 'Passe sa prochaine action.' },
  boost: { emoji: '💪', nom: 'Boost', aide: '+40 % d’ATQ.' },
  garde: { emoji: '🛡️', nom: 'Garde', aide: 'Amortit le prochain impact.' },
  brulure: { emoji: '🔥', nom: 'Brûlure', aide: 'Perd des PV à la fin de chaque tour.' },
  poison: { emoji: '☠️', nom: 'Poison', aide: 'Perd 6 % de ses PV max par pile, chaque tour.' },
  regen: { emoji: '💚', nom: 'Régénération', aide: 'Récupère des PV à la fin de chaque tour.' },
  faiblesse: { emoji: '📉', nom: 'Faiblesse', aide: '−25 % d’ATQ.' },
  fureur: { emoji: '😤', nom: 'Fureur', aide: '+25 % d’ATQ, mais encaisse 20 % de plus.' },
  insensible: { emoji: '🪨', nom: 'Insensible', aide: 'Immunisé aux nouveaux statuts.' },
};

// Les buffs qu'on se donne à soi-même passent MALGRÉ `insensible` : sinon un Cocon
// Céleste (qui pose `insensible` sur toute l'équipe) empêcherait sa propre équipe de
// se protéger au tour suivant — l'inverse de l'effet promis au joueur.
// 😤 26/07 — `fureur` ajouté : il n'est JAMAIS subi, il est TOUJOURS posé sur soi (trait
// `furie`, signatures `statutSoi` de Sucrette / Passion / Pudding, et le DERNIER SURSAUT
// de `actualiserPhase`). Sans lui, une carte sous Cocon Céleste voyait l'écran annoncer
// « son prochain coup sera CRITIQUE ! 😤 » sans que le statut soit posé : sa propre
// immunité bloquait son propre sursaut.
const STATUTS_AMICAUX: StatutId[] = ['garde', 'bouclier', 'boost', 'regen', 'fureur'];

export const COLLANT_VIT = 4;              // 🍯 malus de VIT du Collant
export const GIVRE_MULT = 1.35;            // ❄️ bris de glace
export const FUREUR_ATK = 1.25;            // 😤 +25 % ATQ pour le porteur
export const FUREUR_VULN = 1.2;            // 😤 …mais il encaisse 20 % de plus
export const FAIBLESSE_ATK = 0.75;         // 📉 −25 % ATQ
export const BOOST_ATK = 1.4;              // 💪 +40 % ATQ
export const MARQUE_COLLANT_TOURS = 2;     // durée standard du Collant
export const POISON_PILES_MAX = 3;         // ☠️ 3 piles maximum
export const POISON_PCT_PILE = 6;          // ☠️ 6 % des PV max par pile et par tour
export const BRULURE_PCT_DEFAUT = 4;       // 🔥 4 % des PV max si aucune valeur fournie
export const BRULURE_MAX_PCT = 5;          // 🔥 plafond dur (§A9)
export const STATUT_DEGATS_MAX_PCT = 20;   // §A9 : 20 % des PV max par tour, statuts CUMULÉS
export const REGEN_PCT_DEFAUT = 6;         // 💚 6 % des PV max si aucune valeur fournie

export function aStatut(c: Combattant, id: StatutId): boolean {
  return c.statuts.some((s) => s.id === id);
}
export function pilesStatut(c: Combattant, id: StatutId): number {
  return c.statuts.find((s) => s.id === id)?.piles ?? 0;
}
export function valeurStatut(c: Combattant, id: StatutId): number {
  return c.statuts.find((s) => s.id === id)?.valeur ?? 0;
}
export function toursStatut(c: Combattant, id: StatutId): number {
  return c.statuts.find((s) => s.id === id)?.tours ?? 0;
}

// Pose (ou renforce) un statut. Retourne false si la pose est REFUSÉE — l'appelant ne
// doit alors pas journaliser d'événement, sinon l'UI annonce un effet qui n'existe pas.
// `tours = -1` : « jusqu'à consommation » — une pose permanente ne peut jamais être
// rabaissée à une durée finie par un Math.max naïf, d'où le test explicite sur -1.
export function poserStatut(c: Combattant, id: StatutId, tours: number, valeur?: number, pilesMax = 1): boolean {
  if (aStatut(c, 'insensible') && !STATUTS_AMICAUX.includes(id)) return false;
  const ex = c.statuts.find((s) => s.id === id);
  if (ex) {
    ex.tours = (tours === -1 || ex.tours === -1) ? -1 : Math.max(tours, ex.tours);
    // 🩹 27/07 — RÉ-EMPOISONNER NE DOIT JAMAIS DÉSEMPOISONNER. `Math.min(pilesMax, …)` seul
    // RABAISSAIT un cumul déjà en place quand la nouvelle pose était MOINS cumulable :
    // l'Averse Acide de Citro (`piles: 2`) faisait perdre une pile à une cible montée à 3
    // par l'Infusion Sans Fin de Théo. Le `Math.max` extérieur est le pendant EXACT de
    // celui de `valeur` et de la règle `-1` sur `tours` : une pose ne peut qu'ajouter.
    ex.piles = Math.max(ex.piles, Math.min(Math.max(1, pilesMax), ex.piles + 1));
    if (valeur !== undefined) ex.valeur = Math.max(ex.valeur ?? 0, valeur);
    return true;
  }
  c.statuts.push({ id, tours, piles: 1, valeur });
  return true;
}

export function retirerStatut(c: Combattant, id: StatutId): void {
  const i = c.statuts.findIndex((s) => s.id === id);
  if (i >= 0) c.statuts.splice(i, 1);
}

// --- ⚡ A2 · ÉNERGIE D'ÉQUIPE : l'arbitrage qui manquait ------------------------------
// Diagnostic : la spé était strictement dominante (×1,2 sur tous les axes, aucun coût)
// et changer de carte coûtait le TOUR ENTIER (banc mort). Désormais une ressource de
// camp, partagée, visible : la spé se paie, changer/jouer un objet se paie AUSSI mais
// laisse l'action d'attaque du round jouable. L'énergie est débitée DANS LE MOTEUR,
// jamais dans l'UI (règle « aucune logique parallèle »).
export const ENERGIE_MAX = 6;
export const ENERGIE_PAR_ROUND = 2;      // gagnée en début de round
export const ENERGIE_PARFAIT = 1;        // bonus d'un tap PARFAIT
export const ENERGIE_KO = 2;             // quand un de SES combattants tombe (comeback)
export const ENERGIE_GARDE_GACHEE = 2;   // Garde posée contre une action non offensive
export const COUT_SPE = 3;
export const COUT_CHANGER = 2;
export const COUT_OBJET = 2;
export const COUT_GARDE = 0;
// Réserve de départ : avec 2/round et une spé à 3, un combat qui démarre à 0 interdirait
// la spé au round 1 (et la rendrait injouable un round sur deux dès le round 3). À 2, le
// round 1 offre déjà un vrai choix — spé (3) OU changement + attaque (2) — et la spé
// reste rationnée par ses 3 munitions.
export const ENERGIE_DEPART = 2;

function bornerEnergie(n: number): number {
  return Math.max(0, Math.min(ENERGIE_MAX, Math.round(n)));
}
export function gagnerEnergie(etat: EtatCombat, cote: CoteCombat, n: number): void {
  etat.energie[cote] = bornerEnergie(etat.energie[cote] + n);
}
// ⚡ 27/07 — ÉNERGIE RÉSERVÉE PAR UNE INTENTION DÉJÀ ANNONCÉE.
// `choisirActionIA` verrouille l'intention adverse à la fin du round précédent (le joueur
// la LIT avant de choisir), en anticipant le revenu de round via `energiePrevue`. Mais
// entre le verrou et l'action, le joueur pouvait VIDER la réserve adverse (trait `recul`,
// signatures `energieAdverse`) : le garde-fou d'`agir()` repliait alors la Spé annoncée sur
// l'attaque de base, SANS aucun événement. Le joueur voyait une ultime promise qui
// n'arrivait jamais — exactement ce que la règle du projet interdit (« ne jamais recalculer
// l'action après le choix du joueur, sinon l'UI ment et l'IA paraît tricher »).
// Le vol d'énergie ne peut donc plus descendre sous le coût de l'action ENGAGÉE. La réserve
// vaut au plus COUT_SPE sur ENERGIE_MAX, ne dure qu'un round, tombe dès que l'action est
// jouée (`agir`) et n'existe pas pour le camp du joueur, qui ne verrouille rien à l'avance.
export function energieReservee(etat: EtatCombat, cote: CoteCombat): number {
  if (cote !== 'b') return 0;                       // seul le camp b annonce à l'avance
  const intention = etat.intentionBEngagee;
  if (intention === undefined || intention === null) return 0;
  // Un changement devenu illégal entre-temps (la cible du banc est tombée) ne sera pas payé :
  // même prédicat que `appliquerChangement`, pas une seconde règle.
  if (typeof intention === 'object') return changementLegal(etat, cote, intention.changer) ? COUT_CHANGER : 0;
  // La Spé ne coûte son énergie que si elle a encore une munition : sans munition, `agir`
  // replie de toute façon, et réserver de l'énergie pour rien priverait le joueur du vol.
  if (intention === 1) return actif(etat, cote).speRestantes > 0 ? COUT_SPE : 0;
  return 0;                                          // attaque 0, Signature et Garde : gratuites
}

// Un changement d'actif est-il jouable ? Source UNIQUE de la règle : `appliquerChangement`
// l'exécute, `energieReservee` s'en sert pour savoir si le coût est réellement engagé.
function changementLegal(etat: EtatCombat, cote: CoteCombat, idx: number): boolean {
  const eq = etat.equipes[cote];
  return idx !== etat.actifs[cote] && !!eq[idx] && eq[idx].pv > 0;
}

// Vol d'énergie (trait `recul`, signature `energieAdverse`) — le SEUL appelant. Borné par
// le bas par `energieReservee`, mais sans jamais RENDRE d'énergie si la réserve est déjà
// entamée : un vol ne peut que retirer, ou ne rien faire.
export function retirerEnergie(etat: EtatCombat, cote: CoteCombat, n: number): void {
  const plancher = energieReservee(etat, cote);
  const apres = bornerEnergie(etat.energie[cote] - n);
  etat.energie[cote] = Math.min(etat.energie[cote], Math.max(plancher, apres));
}
// Débit STRICT : rend false (et ne débite rien) si le camp ne peut pas payer.
export function payerEnergie(etat: EtatCombat, cote: CoteCombat, n: number): boolean {
  if (etat.energie[cote] < n) return false;
  etat.energie[cote] = bornerEnergie(etat.energie[cote] - n);
  return true;
}

// --- ⭐ Jauge & attaques SIGNATURE + munitions de la spé (la profondeur tactique) ------
// Encaisser un coup charge la jauge (+1), une parade aussi (+1 à +3), et le trait
// `charge` d'une carte ajoute +1 quand elle agit. Jauge pleine (3) → la SIGNATURE se
// débloque : imparable, gros effet thématique, remet la jauge à zéro. L'IA la lance dès
// qu'elle est prête : le joueur VOIT la jauge adverse monter et peut anticiper.
// L'attaque n°2 (la « spé ») a des MUNITIONS : 3 usages par combat, frappe 20 % plus
// fort — et coûte désormais 3 d'énergie (§A2) : fini le spam.
export const CHARGE_MAX = 3;   // actions/coups encaissés pour débloquer la signature
export const SPE_USAGES = 3;   // munitions de l'attaque n°2 (par combattant, par combat)
export const SPE_BONUS = 1.2;  // la spé tape/soigne 20 % plus fort (compense les munitions)

// Dégâts = % des PV MAX de la CIBLE (équitable quel que soit l'écart de stats — l'ulti
// du petit mord autant que celui du grand), plafonnés par l'ATQ de l'attaquant (×3,5)
// pour que les boss géants ne fondent pas. Imparable, neutre en type.
// TOUS les champs sauf `nom`/`desc`/`pvPct` sont optionnels : les 4 signatures de repli
// par set continuent de fonctionner à l'identique.
export type SignatureDef = {
  nom: string; desc: string; pvPct: number;
  soinPct?: number; etourdit?: boolean; boost?: boolean; perceBouclier?: boolean;
  // nouveaux (A4)
  statut?: { id: StatutId; tours: number; piles?: number };        // posé sur la cible
  zone?: boolean;              // touche aussi le banc adverse à 40 %
  energie?: number;            // rend de l'énergie à son camp
  soigneEquipe?: number;       // % des PV max rendus à TOUTE son équipe
  // nécessaires à la table des 24 (§A8) — tous optionnels
  statutSoi?: { id: StatutId; tours: number; piles?: number };     // posé sur SOI
  statutEquipe?: { id: StatutId; tours: number; piles?: number };  // toute l'équipe adverse
  statutEquipeSoi?: { id: StatutId; tours: number; piles?: number };// toute SON équipe
  coups?: number;              // nombre de frappes (Salve de Pailles = 4)
  perceGarde?: boolean;        // ignore aussi la réduction de Garde
  volDeViePct?: number;        // % des dégâts infligés rendus en PV
  energieAdverse?: number;     // retire N d'énergie au camp adverse
  riposteAuto?: boolean;       // arme un contre-coup (côté JOUEUR uniquement, cf. §0.9)
};
export const SIGNATURES: Record<SetId, SignatureDef> = {
  fruit: { nom: 'Tsunami Tropical', desc: 'Imparable · énorme vague qui transperce les boucliers', pvPct: 26, perceBouclier: true },
  milk: { nom: 'Marée Onctueuse', desc: 'Imparable · dégâts + rend 20 % des PV', pvPct: 18, soinPct: 20 },
  topping: { nom: 'Avalanche de Perles', desc: 'Imparable · dégâts + étourdit à coup sûr', pvPct: 18, etourdit: true },
  signature: { nom: 'Sacre Royal', desc: 'Imparable · dégâts + monte en puissance (+40 %)', pvPct: 20, boost: true },
};

// --- ⭐ A4 · UNE SIGNATURE PAR CARTE (24, au lieu de 4 partagées) ---------------------
// `SIGNATURES` (par set) reste le REPLI : toute carte sans entrée ici garde l'ulti de son
// set. Toute lecture doit passer par `signatureDe()` — moteur ET UI, sans exception.
// Barème retenu : pur dégât 22-26 % · dégât + contrôle 14-20 % · zone 12-14 % (elle
// touche 3 cibles) · soutien pur 0-10 %. Le plafond ATQ × SIG_CAP_ATK borne le tout.
export const SIGNATURES_CARTE: Partial<Record<string, SignatureDef>> = {
  // 🧋 Milk Tea
  boba: { nom: 'Boule de Neige', desc: 'Imparable · dégâts + se couvre d’un bouclier', pvPct: 18, statutSoi: { id: 'bouclier', tours: -1 } },
  classico: { nom: 'Recette Éternelle', desc: 'Soigne 25 % des PV max à TOUTE l’équipe', pvPct: 0, soigneEquipe: 25 },
  theo: { nom: 'Infusion Sans Fin', desc: 'Imparable · empoisonne à 3 piles', pvPct: 14, statut: { id: 'poison', tours: 3, piles: POISON_PILES_MAX } },
  lacto: { nom: 'Crème Renaissance', desc: 'Se soigne puis régénère pendant 3 tours', pvPct: 0, soinPct: 20, statutSoi: { id: 'regen', tours: 3 } },
  paillette: { nom: 'Salve de Pailles', desc: 'Imparable · quatre coups rapides', pvPct: 7, coups: 4 },
  sucrette: { nom: 'Coup de Sucre', desc: 'Imparable · entre en fureur et fait le plein d’énergie', pvPct: 16, statutSoi: { id: 'fureur', tours: 2 }, energie: ENERGIE_MAX },
  // 🍓 Fruités
  fraisy: { nom: 'Champ de Fraises', desc: 'Imparable · zone + brûlure sur toute l’équipe adverse', pvPct: 12, zone: true, statutEquipe: { id: 'brulure', tours: 2 } },
  mango: { nom: 'Soleil Écrasant', desc: 'Imparable · ignore la Garde ET le bouclier', pvPct: 24, perceBouclier: true, perceGarde: true },
  litchee: { nom: 'Parfum Entêtant', desc: 'Imparable · étourdit et affaiblit', pvPct: 15, etourdit: true, statut: { id: 'faiblesse', tours: 2 } },
  passion: { nom: 'Cœur Ardent', desc: 'Imparable · fureur 3 tours + énergie', pvPct: 18, statutSoi: { id: 'fureur', tours: 3 }, energie: 2 },
  citro: { nom: 'Averse Acide', desc: 'Imparable · zone + poison sur toute l’équipe adverse', pvPct: 12, zone: true, statutEquipe: { id: 'poison', tours: 3, piles: 2 } },
  pasteka: { nom: 'Forteresse Verte', desc: 'Bouclier pour TOUTE l’équipe + contre-coup automatique', pvPct: 10, statutEquipeSoi: { id: 'bouclier', tours: -1 }, riposteAuto: true },
  // ✨ Toppings
  popping: { nom: 'Feu d’Artifice', desc: 'Imparable · zone + brûlure sur tous', pvPct: 12, zone: true, statutEquipe: { id: 'brulure', tours: 2 } },
  jelly: { nom: 'Mur Rebondissant', desc: 'Insensible 2 tours + contre-coup automatique', pvPct: 12, statutSoi: { id: 'insensible', tours: 2 }, riposteAuto: true },
  mochito: { nom: 'Étreinte Moelleuse', desc: 'Soigne l’équipe et la fait régénérer 3 tours', pvPct: 0, soigneEquipe: 15, statutEquipeSoi: { id: 'regen', tours: 3 } },
  coco: { nom: 'Pluie de Coco', desc: 'Imparable · zone + vol de vie', pvPct: 13, zone: true, volDeViePct: 25 },
  pudding: { nom: 'Caramel Brûlant', desc: 'Imparable · brûlure lourde + fureur', pvPct: 16, statut: { id: 'brulure', tours: 3 }, statutSoi: { id: 'fureur', tours: 2 } },
  nuage: { nom: 'Cocon Céleste', desc: 'Soigne l’équipe et la rend insensible 2 tours', pvPct: 0, soigneEquipe: 20, statutEquipeSoi: { id: 'insensible', tours: 2 } },
  // 👑 Signatures
  'taro-queen': { nom: 'Décret Souverain', desc: 'Imparable · dégâts + faiblesse sur toute l’équipe adverse', pvPct: 20, statutEquipe: { id: 'faiblesse', tours: 2 } },
  'matcha-sensei': { nom: 'Vide Parfait', desc: 'Imparable · étourdit et vole 3 d’énergie', pvPct: 16, etourdit: true, energieAdverse: 3, energie: 3 },
  'brown-sugar-king': { nom: 'Couronne Fondante', desc: 'Imparable · dégâts massifs + vol de vie', pvPct: 22, volDeViePct: 25 },
  'oreo-star': { nom: 'Marée Tigrée', desc: 'Imparable · zone qui transperce les boucliers', pvPct: 14, zone: true, perceBouclier: true },
  'caramel-chef': { nom: 'Nappage Suprême', desc: 'Soigne l’équipe et lui donne un bouclier', pvPct: 0, soigneEquipe: 20, statutEquipeSoi: { id: 'bouclier', tours: -1 } },
  // pvPct volontairement aligné sur le repli du set `signature` (20 %) et NON monté à
  // 24 % : vider TOUTE la réserve adverse prive l'ennemi de spé, de changement et
  // d'objet pendant ~3 rounds — un swing de tempo au moins équivalent au +40 % ATQ du
  // Sacre Royal. Y ajouter une prime de dégâts sortirait du barème §A9.
  'bubble-master': { nom: 'Jugement du Boba', desc: 'Imparable · dégâts + vide l’énergie adverse', pvPct: 20, energieAdverse: ENERGIE_MAX },
};

// SEUL point de lecture d'une signature (moteur ET UI) : repli par set garanti.
export function signatureDe(c: Combattant): SignatureDef {
  return SIGNATURES_CARTE[c.id] ?? SIGNATURES[c.set];
}

export const SIG_CAP_ATK = 3.5; // plafond des dégâts d'ulti : ATQ × 3,5
export const SIG_ZONE_PCT = 0.4; // signature `zone` : le banc adverse encaisse 40 %

// Précision / critiques (le piment des duels)
export const PRECISION_BASE = 0.92;    // attaques normales
export const PRECISION_LOURDE = 0.85;  // grosses attaques (puissance ≥ 1,3)
export const PRECISION_ZONE = 0.9;     // vague de zone (par cible)
export const CHANCE_CRITIQUE = 0.12;   // ×1,5 dégâts
// 🩹 26/07 — la chance de critique n'était PAS bornée. Cumul maximal atteignable :
// Tiger Sugar (12) + Paille Royale (6) + Perle Porte-bonheur (8) + panoplie Orage 2p (8)
// = 34 pts, puis ×2 (mutateur `critChanceX2`) + 0,20 (talent `spe_crit`) + 0,20 (timing
// parfait) = 1,32 → `rng() < 1,32` rendait le critique GARANTI à chaque coup. La
// précision, elle, était déjà clampée à 1 dans `frapper` : le crit était le seul
// débordement. On plafonne à 0,85 (il reste toujours 15 % de coups normaux).
export const CHANCE_CRITIQUE_MAX = 0.85;
// --- 💨 A6 · SUPPRESSION DE L'ÉCHEC SEC ------------------------------------------------
// Le pire ressenti du jeu : 8-15 % de chance de perdre son tour ENTIER sur un jet de dé.
// Un « raté » devient désormais un coup EFFLEURÉ : il passe quand même à 45 %, mais ne
// pose ni marque ni statut. Le skill garde sa prime : un tap PARFAIT et le trait
// `precise` garantissent l'impact plein.
export const EFFLEURE_MULT = 0.45;
export const GARDE_REDUCTION = 0.45;    // action universelle : prochain impact −45 %
export const GARDE_MAITRISEE = 0.55;    // 🎖️ talent « garde_maitrisee » : sa Garde −55 %
export const CHANGEMENT_REDUCTION = 0.25; // changement tactique : prochain impact −25 %
// §A9 — passé de 2 à 1 : la Garde (la seule vraie décision du duel) était dispo 1 tour
// sur 3. Le cooldown POSÉ vaut `GARDE_COOLDOWN + 1` (il est décrémenté en tête du round
// suivant), donc 1 → dispo 1 tour sur 2. Le plancher `min 1` est appliqué PAR LE MOTEUR
// (cf. cooldownGarde) : aucune carte ne garde deux rounds d'affilée, quoi qu'il arrive.
export const GARDE_COOLDOWN = 1;
export const GARDE_COOLDOWN_MIN = 1;
export const VIT_RAPIDE = 6;            // trait `rapide` : +6 VIT pour l'ordre de CE round
export const PERCE_GARDE_MULT = 0.5;    // trait `perce` : la Garde ne compte qu'à moitié

// --- 🌡️ COUP DE CHAUD : garantie de terminaison (§A9) ---------------------------------
// §A9 impose « aucun combat au-delà du round 25 en configuration moyenne ». Mesuré sur
// 200 combats seedés, le moteur AVANT refonte tenait déjà 27 à 39 rounds sur les duels
// EN MIROIR (même set des deux côtés) : sans avantage de type ×1,5, les dégâts tombent
// d'un tiers pendant que la régén par tour (`soinTour`), les soins et les Gardes
// continuent — le combat s'enlise. Aucun réglage de dégâts ponctuel ne pouvait fermer ça
// sans casser l'équilibrage des duels favorables (13-19 rounds, déjà bons).
// D'où une pression GLOBALE, tardive et TÉLÉGRAPHIÉE : à partir du round ROUND_ESCALADE,
// tous les impacts (les 4 sources, statuts inclus — un seul pipeline) montent de 15 % par
// round, plafonnés à ×3. Les 11 premiers rounds sont donc STRICTEMENT inchangés (aucun
// duel favorable, qui se joue en 11-18 rounds, n'est retouché), et la borne haute devient
// une propriété mathématique du moteur au lieu d'un espoir.
// Mesure après correctif, 200 combats seedés × 5 compositions : rounds 11 → 24.
export const ROUND_ESCALADE = 12;
export const ESCALADE_PAR_ROUND = 0.15;
export const ESCALADE_MAX = 3;
export function multEscalade(round: number): number {
  if (round < ROUND_ESCALADE) return 1;
  return Math.min(ESCALADE_MAX, 1 + ESCALADE_PAR_ROUND * (round - ROUND_ESCALADE + 1));
}
export const SIPHON_PCT = 15;           // trait `siphon` : 15 % des dégâts rendus en PV
export const SAIGNEE_PCT = 4;           // trait `saignee` : brûlure à 4 % des PV max
export const RECUL_ENERGIE = 1;         // trait `recul` : −1 énergie au camp adverse

// --- 🩹 A9 · plafonds de soin (inchangés, mais désormais NOMMÉS et appliqués) ----------
// Ils étaient jusqu'ici des intentions non codées. On les matérialise pour que les
// nouvelles sources de soin (siphon, régén, signatures de soutien) ne puissent pas
// créer de combats-éponges. Le chemin de soin historique (attaque de type `soin`) n'est
// PAS resserré : « les plafonds restent inchangés » = on ne durcit pas l'existant.
export const SOIN_DIRECT_MAX_PV_PCT = 25;         // un soin direct ≤ 25 % des PV max
export const VOL_DE_VIE_MAX_PCT = 25;             // taux de vol de vie plafonné à 25 %
export const VOL_DE_VIE_MAX_PV_PCT_ACTION = 12;   // …et ≤ 12 % des PV max par action
export const REGEN_MAX_PAR_ACTION = 10;           // 💚 régén ≤ 10 PV par tour

// --- 🎖️ TALENTS D'ÉVOLUTION (Pack 2) : valeurs des effets implémentés ici ----------
// Le modèle de données (enum + table par carte) vit dans economie.ts ; le PNJ n'a
// JAMAIS de talents. Les effets « plats » s'appliquent à la création du combattant,
// les autres sont des hooks du moteur (marque, riposte de marque, garde, soins).
export const TALENT_VIT = 3;             // vit_plus (cumulable)
export const TALENT_ATK_PCT = 0.10;      // atk_pct (cumulable)
export const TALENT_PV_PCT = 0.12;       // pv_pct (cumulable)
export const TALENT_SPE_CRIT = 0.20;     // spe_crit : +20 pts de chance de crit sur la spé
export const TALENT_MARQUE_COLLANT = 3;  // marque_plus : Collant dure 3 actions au lieu de 2
export const TALENT_PETILLANT_PCT = 0.35;// marque_plus : Pétillant éclabousse à 35 % au lieu de 25 %
export const PETILLANT_PCT = 0.25;       // éclaboussure Pétillant standard
export const TALENT_SOIN_PCT = 1.2;      // soin_plus : soins prodigués ×1,2 (cumulable)
export const TALENT_PREMIERE_FRAPPE = 1.25; // premiere_frappe : 1ère attaque du combat +25 %
export const TALENT_CONTRE_MARQUE = 0.25;   // contre_marque : 25 % en encaissant un coup

// --- 👅 E4 · RANG DE GOÛT : la carte évolue avec la consommation RÉELLE ---------------
// Le barème vit dans `economie.ts` (avec `rangGout`/`bonusGout` qui lisent l'historique
// d'achats) : le moteur n'en consomme que les seuils. Réexportés ici par commodité pour
// les écrans de combat — une SEULE source de vérité, jamais une copie.
export { GOUT_MAX, GOUT_BONUS_PCT, GOUT_RANG_MUNITION, GOUT_RANG_MARQUE } from './economie';

// Nombre d'exemplaires d'un talent actif sur un combattant (cumul).
export function compteTalent(c: Combattant, t: EffetTalent): number {
  return c.talents ? c.talents.filter((x) => x === t).length : 0;
}

// --- 🎯 TIMING « tap parfait » (action commands, CÔTÉ JOUEUR uniquement) --------------
// Quand le joueur choisit une attaque, la Signature ou la Garde, l'UI (duel.tsx)
// affiche une jauge rapide : taper dans la zone DORÉE = PARFAIT, la VERTE = BIEN,
// sinon RATÉ. Le résultat module dégâts/soins et chance de critique ; un PARFAIT
// garantit l'impact plein (jamais effleuré) et une Garde PARFAITE bloque −70 % en
// chargeant la jauge de +2. L'IA n'en profite jamais : c'est la prime au skill.
export type Timing = 'parfait' | 'bien' | 'rate';
export const TIMING_MULT: Record<Timing, number> = { parfait: 1.3, bien: 1.12, rate: 0.85 };
export const TIMING_CRIT: Record<Timing, number> = { parfait: 0.2, bien: 0.06, rate: 0 };
export const TIMING_ZONE_OR = 0.16;    // largeur de la zone dorée (fraction de la jauge)
export const TIMING_ZONE_VERT = 0.42;  // largeur de la zone verte (dorée incluse)
export const GARDE_PARFAITE = 0.7;     // parade PARFAITE : −70 % au lieu de −45 %
// 🔄 RIPOSTE DE PARADE PARFAITE (CÔTÉ JOUEUR uniquement, comme le combo) -------
// Une Garde réussie avec un timing PARFAIT déclenche, après l'action adverse,
// un contre-coup automatique : 50 % de l'ATQ de la carte active, imparable,
// modulé par le triangle des types, la variance ±10 % et un critique possible
// (12 %) — mais JAMAIS par le timing ni le combo (le skill est déjà payé par la
// parade). Si l'attaque ripostée était une SIGNATURE : la parade monte à −80 %
// (constante dédiée, GARDE_PARFAITE ne bouge pas) et la jauge charge +1 de plus
// (+3 au total sur le round). L'IA n'y a jamais accès.
export const RIPOSTE_PCT = 0.5;                   // contre-coup = 50 % de l'ATQ
export const RIPOSTE_CRIT = 0.12;                 // critique possible de la riposte
export const GARDE_PARFAITE_ANTI_SIGNATURE = 0.8; // parade parfaite CONTRE une Signature : −80 %
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
// vol de vie, régén d'objet, régén de statut, consommables) — SAUF le gimmick regen du
// boss hebdo, qui est son identité. Intuitif : « le soin fatigue », fini les
// combats-éponges.
export const FATIGUE_SOIN_PCT = 25;
export const FATIGUE_SOIN_PLANCHER = 0.4;
export function multFatigueSoin(soinsRecus: number): number {
  return Math.max(FATIGUE_SOIN_PLANCHER, 1 - (FATIGUE_SOIN_PCT / 100) * Math.max(0, soinsRecus));
}
// Applique un soin en tenant compte de la fatigue et incrémente le compteur.
// SEUL point d'entrée des soins du moteur (règle §0.2, « tout soin passe par ici »).
export function appliquerSoin(c: Combattant, base: number): number {
  const gain = Math.max(0, Math.round(base * multFatigueSoin(c.soinsRecus)));
  if (gain > 0) {
    c.pv = Math.min(c.pvMax, c.pv + gain);
    c.soinsRecus++;
  }
  return gain;
}

// --- ⚡ COMBO DE PARFAITS (la boucle addictive du duel) -------------------------------
// Chaque PARFAIT enchaîné met +8 % de dégâts « en banque » pour les coups suivants
// (plafonné à +24 %). Un RATÉ casse tout, un BIEN préserve sans ajouter.
// 🔧 REFONTE — le compteur vivait dans l'UI (duel.tsx) : le moteur ne pouvait donc pas
// raisonner dessus (ni l'IA anticiper, ni un test le vérifier). Il est RAPATRIÉ dans
// `EtatCombat.combo` ; `jouerRound(comboA)` reste accepté et fait autorité quand il est
// fourni, pour ne rien casser côté appelant.
export const COMBO_PARFAIT_PCT = 8;
export const COMBO_PARFAIT_MAX = 3;
export function multCombo(comboAvant: number): number {
  return 1 + (COMBO_PARFAIT_PCT / 100) * Math.max(0, Math.min(COMBO_PARFAIT_MAX, Math.round(comboAvant)));
}

// --- Les fiches des 24 combattants --------------------------------------------------
// ⚠️ Les NOMS d'attaque sont figés : `VISUELS_ATTAQUES` (projectiles.tsx) est indexé par
// nom — un renommage casserait silencieusement l'animation. Seuls les `traits` (§A8)
// sont ajoutés.
export const FICHES: Record<string, FicheCombat> = {
  // 🧋 Milk Tea (communs)
  boba: { pv: 98, atk: 16, vit: 10, attaques: [{ nom: 'Boulet de tapioca', type: 'degats', puissance: 1, traits: ['charge'] }, { nom: 'Roulade géante', type: 'degats', puissance: 1.35, traits: ['perce'] }] },
  classico: { pv: 92, atk: 16, vit: 12, attaques: [{ nom: 'Gorgée classique', type: 'degats', puissance: 1, traits: ['precise'] }, { nom: 'Recette originale', type: 'boost', puissance: 1, traits: ['charge'] }] },
  theo: { pv: 90, atk: 15, vit: 13, attaques: [{ nom: 'Coup de sachet', type: 'degats', puissance: 1, traits: ['affaiblit'] }, { nom: 'Infusion soporifique', type: 'etourdit', puissance: 0.7, traits: ['venin'] }] },
  lacto: { pv: 96, atk: 15, vit: 11, attaques: [{ nom: 'Éclaboussure', type: 'degats', puissance: 1, traits: ['siphon'] }, { nom: 'Bain de lait', type: 'soin', puissance: 1.15 }] },
  paillette: { pv: 86, atk: 15, vit: 15, attaques: [{ nom: 'Pique-paille', type: 'degats', puissance: 1, traits: ['rapide'] }, { nom: 'Rafale de pailles', type: 'double', puissance: 0.65, traits: ['recul'] }] },
  sucrette: { pv: 88, atk: 16, vit: 14, attaques: [{ nom: 'Jet de sucre', type: 'degats', puissance: 1, traits: ['charge', 'rapide'] }, { nom: 'Rush de glucose', type: 'boost', puissance: 1, traits: ['furie'] }] },
  // 🍓 Fruités (rares)
  fraisy: { pv: 102, atk: 19, vit: 15, attaques: [{ nom: 'Pépin perçant', type: 'degats', puissance: 1, traits: ['rapide'] }, { nom: 'Tourbillon fraise', type: 'double', puissance: 0.65, traits: ['saignee'] }] },
  mango: { pv: 108, atk: 20, vit: 12, attaques: [{ nom: 'Tranche tropicale', type: 'degats', puissance: 1, traits: ['perce'] }, { nom: 'Soleil de mangue', type: 'degats', puissance: 1.4, traits: ['brise'] }] },
  litchee: { pv: 104, atk: 18, vit: 14, attaques: [{ nom: 'Coquille dure', type: 'degats', puissance: 1, traits: ['marque'] }, { nom: 'Parfum enivrant', type: 'etourdit', puissance: 0.7, traits: ['affaiblit'] }] },
  passion: { pv: 100, atk: 19, vit: 16, attaques: [{ nom: 'Graines folles', type: 'degats', puissance: 1, traits: ['charge'] }, { nom: 'Cœur de Maracudja', type: 'boost', puissance: 1, traits: ['furie'] }] },
  citro: { pv: 100, atk: 20, vit: 15, attaques: [{ nom: 'Zeste acide', type: 'degats', puissance: 1, traits: ['affaiblit'] }, { nom: 'Pluie acide', type: 'zone', puissance: 0.6, traits: ['venin'] }] },
  pasteka: { pv: 112, atk: 18, vit: 11, attaques: [{ nom: 'Coup de tranche', type: 'degats', puissance: 1, traits: ['precise'] }, { nom: 'Carapace de pastèque', type: 'bouclier', puissance: 1, traits: ['perce'] }] },
  // ✨ Toppings (épiques)
  popping: { pv: 116, atk: 23, vit: 15, attaques: [{ nom: 'Bulle qui claque', type: 'degats', puissance: 1, traits: ['recul'] }, { nom: 'Explosion popping', type: 'zone', puissance: 0.65, traits: ['saignee'] }] },
  jelly: { pv: 124, atk: 21, vit: 13, attaques: [{ nom: 'Rebond gélatineux', type: 'degats', puissance: 1, traits: ['precise'] }, { nom: 'Mur de gelée', type: 'bouclier', puissance: 1, traits: ['brise'] }] },
  mochito: { pv: 122, atk: 21, vit: 13, attaques: [{ nom: 'Tape moelleuse', type: 'degats', puissance: 1, traits: ['siphon'] }, { nom: 'Câlin mochi', type: 'soin', puissance: 1.15, traits: ['marque'] }] },
  coco: { pv: 120, atk: 22, vit: 14, attaques: [{ nom: 'Noix de coco', type: 'degats', puissance: 1, traits: ['perce'] }, { nom: 'Lait de coco', type: 'soin', puissance: 1.1, traits: ['siphon'] }] },
  pudding: { pv: 118, atk: 22, vit: 14, attaques: [{ nom: 'Flan flan', type: 'degats', puissance: 1, traits: ['charge'] }, { nom: 'Caramélisation', type: 'boost', puissance: 1, traits: ['furie'] }] },
  nuage: { pv: 126, atk: 21, vit: 12, attaques: [{ nom: 'Coup de brume', type: 'degats', puissance: 0.95, traits: ['precise'] }, { nom: 'Cocon de chantilly', type: 'soin', puissance: 1.25, traits: ['marque'] }] },
  // 👑 Signatures (légendaires)
  'taro-queen': { pv: 140, atk: 26, vit: 16, attaques: [{ nom: 'Sceptre taro', type: 'degats', puissance: 1.05, traits: ['perce', 'charge'] }, { nom: 'Décret royal', type: 'degats', puissance: 1.45, traits: ['affaiblit'] }] },
  'matcha-sensei': { pv: 138, atk: 25, vit: 18, attaques: [{ nom: 'Fouet cérémonial', type: 'degats', puissance: 1.05, traits: ['rapide', 'precise'] }, { nom: 'Méditation zen', type: 'etourdit', puissance: 0.75, traits: ['venin'] }] },
  'brown-sugar-king': { pv: 146, atk: 26, vit: 15, attaques: [{ nom: 'Rayure de caramel', type: 'degats', puissance: 1.05, traits: ['perce'] }, { nom: 'Couronne fondante', type: 'boost', puissance: 1, traits: ['siphon'] }] },
  'oreo-star': { pv: 136, atk: 26, vit: 17, attaques: [{ nom: 'Morsure tigrée', type: 'degats', puissance: 1.05, traits: ['rapide'] }, { nom: 'Marée brown sugar', type: 'zone', puissance: 0.6, traits: ['brise'] }] },
  'caramel-chef': { pv: 142, atk: 25, vit: 15, attaques: [{ nom: 'Louche brûlante', type: 'degats', puissance: 1.05, traits: ['marque'] }, { nom: 'Nappage réparateur', type: 'soin', puissance: 1.15, traits: ['siphon'] }] },
  'bubble-master': { pv: 148, atk: 28, vit: 19, attaques: [{ nom: 'Perle suprême', type: 'degats', puissance: 1.1, traits: ['perce', 'precise'] }, { nom: 'Jugement du Boba', type: 'degats', puissance: 1.55, traits: ['recul'] }] },
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
  gout: number;            // 👅 rang de Goût 0..5 (joueur uniquement — jamais le PNJ)
  pvMax: number;
  pv: number;
  atk: number;
  vit: number;
  attaques: [Attaque, Attaque];
  objets: ObjetId[];       // objets équipés (jusqu'à 3, un par emplacement)
  eff: EffetObjet;         // effet agrégé des objets + panoplies (pré-calculé)
  statuts: Statut[];       // 🧪 A1 : liste UNIQUE (bouclier, étourdi, boost, marques, DoT…)
  reviveDispo: boolean;    // 🧿 Grigri : survivra une fois à 1 PV
  charge: number;          // ⭐ jauge signature (0..CHARGE_MAX)
  speRestantes: number;    // 🔋 munitions de l'attaque n°2 (SPE_USAGES par combat)
  gimmick?: BossGimmick;   // 👹 règle spéciale (boss hebdomadaire uniquement)
  gardeCooldown: number;   // tours restants avant une nouvelle Garde
  soinsRecus: number;      // 💧 fatigue de soin : chaque soin suivant rend moins
  petillantPct?: number;   // 🫧 marque Pétillant renforcée (talent marque_plus) : 0,35
  bossPhase: 1 | 2 | 3;    // 👹 phases de rage du BOSS à 70 % et 35 % PV
  phaseVie: 0 | 1 | 2;     // 🔥 A7 : Second Souffle (≤50 %) puis Dernier Sursaut (≤25 %)
  critGarantiDispo?: boolean; // 🔥 Dernier Sursaut : la PROCHAINE attaque est critique
  riposteArmee?: boolean;  // 🔄 Forteresse Verte / Mur Rebondissant (côté joueur)
  // 🎖️ talents d'évolution choisis (joueur uniquement, Pack 2) + hooks de run/bonus
  talents?: EffetTalent[]; // effets actifs (les cumuls comptent en double)
  premiereFrappe?: boolean;// ⚡ talent : la 1ère attaque du combat tape +25 %
  gardeCooldownBase?: number;   // 🛡️ cadence de Garde propre à la carte (cf. cooldownGarde)
  marqueOuvertureDispo?: boolean; // 🏷️ bonus de run : la 1ère action qui touche pose la marque de famille
};

// 🗑️ PONT DE COMPATIBILITÉ SUPPRIMÉ (LOT F, 26/07/2026).
// `COMPAT_STATUTS` + `installerCompat` exposaient, en accesseurs NON ÉNUMÉRABLES, les 7
// champs de statut supprimés (`bouclier`, `etourdi`, `givre`, `petillant`, `collantTours`,
// `boostTours`, `gardePct`) — uniquement pour que le harnais, qui tourne sur le JS
// compilé, continue de passer. Le code de PRODUCTION ne les lisait déjà plus (tsc vert
// sans eux). Le harnais lit désormais les helpers publics (`aStatut`, `toursStatut`,
// `pilesStatut`, `valeurStatut`) : le pont est devenu du code mort qui laissait croire
// que des champs supprimés existaient encore. SEUL point d'accès à un statut = ces
// helpers. Ne pas le réintroduire : un accesseur fantôme masque une migration oubliée.

// --- 🤖 A7 · IA : trois personnalités qui gardent et qui changent ----------------------
export type PersonnaliteIA = 'brutal' | 'rusee' | 'tenace';
export type IntentionIA = 0 | 1 | 'signature' | 'garde' | { changer: number };

export type EtatCombat = {
  equipes: Record<CoteCombat, Combattant[]>;
  actifs: Record<CoteCombat, number>;
  round: number;
  fini: boolean;
  vainqueur: CoteCombat | null;
  mutateur?: Mutateur;   // ⚡ règle spéciale du jour, appliquée à la résolution
  intentionB: IntentionIA; // action adverse verrouillée et montrée AVANT le choix joueur
  energie: Record<CoteCombat, number>; // ⚡ A2 : réserve de camp (0..ENERGIE_MAX)
  combo: number;         // ⚡ PARFAITS en banque côté joueur (rapatrié de l'UI)
  // ⚡ 27/07 — intention du camp b DÉJÀ ANNONCÉE au joueur pour le round EN COURS et pas
  // encore jouée. Champ OPTIONNEL et purement transitoire (vit le temps d'un round, jamais
  // persisté, §0.5) : il sert uniquement de plancher au vol d'énergie, cf. `energieReservee`.
  intentionBEngagee?: IntentionIA | null;
};

// Un événement à animer côté UI (l'état du moteur est déjà à jour).
// `index` = position du combattant concerné dans SON équipe (zone → aussi le banc).
// `cle` (§B4) : DISCRIMINANT stable des événements. L'UI pilotait ses animations en
// PARSANT le texte français (`texte.includes('esquive')`, `texte.startsWith('⭐')`, et
// même une recherche du nom d'attaque DANS la phrase) : le moindre changement de
// libellé cassait silencieusement une animation, et l'annonce d'un consommable a
// EXACTEMENT la même forme que celle d'une attaque (`X utilise Y !`) — un consommable
// renommé aurait déclenché le projectile d'une attaque non jouée. `texte` reste pour
// l'affichage, `cle`/`attaqueIdx` pour la logique de rendu.
export type CleAnnonce = 'attaque' | 'signature' | 'objet' | 'garde' | 'changement';
export type EvtCombat =
  | { t: 'annonce'; cote: CoteCombat; texte: string; cle?: CleAnnonce; attaqueIdx?: 0 | 1 }
  | { t: 'degats'; cote: CoteCombat; index: number; valeur: number; efficace: 1 | 1.5 | 0.75; pvApres: number }
  | { t: 'soin'; cote: CoteCombat; index: number; valeur: number; pvApres: number }
  | { t: 'statut'; cote: CoteCombat; texte: string; cle?: string }
  | { t: 'riposte'; cote: CoteCombat; antiSignature: boolean }
  | { t: 'ko'; cote: CoteCombat; index: number; nom: string }
  | { t: 'entree'; cote: CoteCombat; index: number; nom: string }
  | { t: 'fin'; vainqueur: CoteCombat };

export type Rng = () => number;

// `niveau` = niveau d'ENTRAÎNEMENT de la carte (1..NIVEAU_CARTE_MAX, joueur uniquement) :
// +6 % PV/ATQ par niveau au-delà du 1 via multNiveauCarte. La VIT ne bouge pas.
// `talents` = effets d'évolution CHOISIS (joueur uniquement — le PNJ n'en a jamais) :
// les effets plats (VIT/ATQ/PV/munitions/charge/bouclier/1ère frappe) s'appliquent ici,
// les autres sont des hooks du moteur. Les cumuls comptent (2× vit_plus = +6 VIT).
// `gout` (E4) = rang de Goût 0..5 alimenté par les VRAIS achats : +2 % PV/ATQ par rang,
// +1 munition de spé dès le rang 3, marque de famille +1 action au rang 5. Paramètre
// FINAL et optionnel → aucun appel existant ne casse. Jamais pour le camp b.
export function creerCombattant(
  id: string, echelle = 1, objets: ObjetId[] = [], niveau = 1, talents: EffetTalent[] = [], gout = 0,
): Combattant {
  const fiche = FICHES[id];
  const meta = trouverCollectible(id);
  if (!fiche || !meta) throw new Error(`fiche de combat manquante : ${id}`);
  // effet agrégé des objets équipés (+ bonus de panoplie) + PASSIF de la carte
  const eff = agregerEffets(objets, PASSIFS[id]?.eff);
  const mNv = multNiveauCarte(niveau);
  const nTal = (t: EffetTalent) => talents.filter((x) => x === t).length;
  const rangGout = Math.max(0, Math.min(GOUT_MAX, Math.round(gout)));
  const mGout = 1 + (GOUT_BONUS_PCT * rangGout) / 100;
  const atk = Math.round(fiche.atk * echelle * mNv * mGout * (1 + (eff.atkPct ?? 0) / 100) * Math.pow(1 + TALENT_ATK_PCT, nTal('atk_pct')));
  const vit = fiche.vit + (eff.vit ?? 0) + TALENT_VIT * nTal('vit_plus');
  const pvMax = Math.round(fiche.pv * echelle * mNv * mGout * (1 + (eff.pvPct ?? 0) / 100) * Math.pow(1 + TALENT_PV_PCT, nTal('pv_pct')));
  const c: Combattant = {
    id,
    nom: meta.nom,
    set: meta.set,
    rarete: meta.rarete,
    niveau: Math.max(1, Math.round(niveau)),
    gout: rangGout,
    pvMax,
    pv: pvMax,
    atk,
    vit,
    attaques: fiche.attaques,
    objets,
    eff,
    statuts: [],
    reviveDispo: !!eff.reviveUneFois,
    charge: Math.min(CHARGE_MAX, nTal('charge_depart')), // 🎖️ charge_depart : +1 chacun
    // 🎖️ spe_munition : +1 chacun · 👅 Goût rang 3 : +1 munition
    speRestantes: SPE_USAGES + nTal('spe_munition') + (rangGout >= GOUT_RANG_MUNITION ? 1 : 0),
    gardeCooldown: 0,
    soinsRecus: 0,
    bossPhase: 1,
    phaseVie: 0,
    talents: talents.length ? [...talents] : undefined,
    premiereFrappe: nTal('premiere_frappe') > 0,
  };
  // Couvercle Renforcé / talent `bouclier_depart` : bouclier levé dès l'entrée.
  if (eff.bouclierDepart || nTal('bouclier_depart') > 0) poserStatut(c, 'bouclier', -1);
  return c;
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
  talentsA: Record<string, EffetTalent[]> = {}, // 🎖️ côté joueur uniquement
  goutsA: Record<string, number> = {},          // 👅 E4 · côté joueur uniquement
): EtatCombat {
  const a = idsA.map((id) => creerCombattant(id, 1, objetsA[id] ?? [], niveauxA[id] ?? 1, talentsA[id] ?? [], goutsA[id] ?? 0));
  const b = idsB.map((id) => creerCombattant(id, echelleB, objetsB[id] ?? []));
  appliquerOutsider(a);
  appliquerOutsider(b); // même règle des deux côtés (une compo modeste reste dangereuse)
  const etat: EtatCombat = {
    equipes: { a, b }, actifs: { a: 0, b: 0 }, round: 0, fini: false, vainqueur: null, mutateur,
    intentionB: 0, energie: { a: ENERGIE_DEPART, b: ENERGIE_DEPART }, combo: 0,
  };
  etat.intentionB = choisirActionIA(etat, 'b', () => 0.5);
  return etat;
}

// 👹 Combat contre le boss hebdomadaire : ton équipe de 3 vs UNE éponge à PV + gimmick.
export function creerCombatBoss(
  idsA: string[], boss: Boss, objetsA: Record<string, ObjetId[]> = {}, mutateur?: Mutateur,
  niveauxA: Record<string, number> = {},
  talentsA: Record<string, EffetTalent[]> = {}, // 🎖️ côté joueur uniquement
  goutsA: Record<string, number> = {},          // 👅 E4 · côté joueur uniquement
): EtatCombat {
  const bossC = creerCombattant(boss.combattantId, boss.echelle, []);
  bossC.pvMax = Math.round(bossC.pvMax * boss.pvBonus);
  bossC.pv = bossC.pvMax;
  bossC.nom = boss.nom;
  bossC.gimmick = boss.gimmick;
  const a = idsA.map((id) => creerCombattant(id, 1, objetsA[id] ?? [], niveauxA[id] ?? 1, talentsA[id] ?? [], goutsA[id] ?? 0));
  appliquerOutsider(a); // le bonus outsider s'applique à l'équipe du joueur, pas au boss
  const etat: EtatCombat = {
    equipes: { a, b: [bossC] },
    actifs: { a: 0, b: 0 },
    round: 0,
    fini: false,
    vainqueur: null,
    mutateur,
    intentionB: 0,
    energie: { a: ENERGIE_DEPART, b: ENERGIE_DEPART },
    combo: 0,
  };
  etat.intentionB = choisirActionIA(etat, 'b', () => 0.5);
  return etat;
}

export function actif(etat: EtatCombat, cote: CoteCombat): Combattant {
  return etat.equipes[cote][etat.actifs[cote]];
}

function adverse(cote: CoteCombat): CoteCombat {
  return cote === 'a' ? 'b' : 'a';
}

// Retrouve la position d'un combattant (pour les déclencheurs post-impact du pipeline,
// qui doivent journaliser le bon `index` sans que l'appelant le repasse partout).
function localiser(etat: EtatCombat, c: Combattant): { cote: CoteCombat; index: number } {
  for (const cote of ['a', 'b'] as CoteCombat[]) {
    const i = etat.equipes[cote].indexOf(c);
    if (i >= 0) return { cote, index: i };
  }
  return { cote: 'a', index: 0 };
}

const estOffensive = (a: Attaque) => a.type === 'degats' || a.type === 'double' || a.type === 'etourdit' || a.type === 'zone';
const traitsDe = (c: Combattant, choix: 0 | 1): TraitAttaque[] => c.attaques[choix].traits ?? [];

// VIT effective : Collant (−4) et trait `rapide` (+6, ce round seulement).
export function vitEffective(c: Combattant, rapide = false): number {
  return c.vit - (aStatut(c, 'collant') ? COLLANT_VIT : 0) + (rapide ? VIT_RAPIDE : 0);
}

// Multiplicateur d'ATQ porté par les statuts (💪 boost · 😤 fureur · 📉 faiblesse).
function multAtkStatuts(c: Combattant): number {
  return (aStatut(c, 'boost') ? BOOST_ATK : 1)
    * (aStatut(c, 'fureur') ? FUREUR_ATK : 1)
    * (aStatut(c, 'faiblesse') ? FAIBLESSE_ATK : 1);
}

// Cooldown réellement posé par une Garde. Le plancher vit ICI (et non dans le bonus de
// run) pour que l'invariant « jamais deux Gardes d'affilée » soit garanti par le moteur.
//
// ⚠️ 26/07 — CONSTAT MESURÉ, à lire avant de toucher à cette ligne : le cooldown est
// décrémenté en TÊTE du round suivant, donc un cooldown posé `P` rend la Garde à nouveau
// disponible au round N+P. `P = 1` autorise donc deux Gardes d'affilée : l'invariant exige
// `P >= 2`. Or `GARDE_COOLDOWN = 1` (§A9) donne déjà `P = 2`, c'est-à-dire la cadence LA
// PLUS SERRÉE que l'invariant permette (mesuré : G.G.G.G. = 1 tour sur 2, identique avec et
// sans bonus). Aucun bonus ne peut donc gagner de cadence tant que `GARDE_COOLDOWN` vaut 1.
//
// 🛡️ 27/07 — DÉCISION PRISE, l'alternative retenue étant la seconde ci-dessous : le bonus
// de run « Poignet Sûr » ne touche PLUS au cooldown (il ne faisait plus strictement rien,
// mesuré +0 victoire sur 400 duels) et renforce désormais la Garde elle-même via le talent
// `garde_maitrisee` — cf. `appliquerBonusRun` dans `tournee.ts`. Plus AUCUN appelant ne
// renseigne `gardeCooldownBase` ; le champ et ce plancher restent le seul point d'entrée
// autorisé si un contenu futur veut jouer sur la cadence, et le plancher garantit alors
// l'invariant. Les deux issues écartées le restent : rendre `GARDE_COOLDOWN` à 2 est
// interdit par §A9 (et reprendrait à TOUS les joueurs l'amélioration du diagnostic n°5), et
// retirer le plancher « pour que le bonus serve » livrerait des Gardes consécutives.
function cooldownGarde(c: Combattant): number {
  return Math.max(GARDE_COOLDOWN_MIN, c.gardeCooldownBase ?? GARDE_COOLDOWN) + 1;
}

// --- 🤖 IA (côté b, et côté a pour les replays automatiques) ----------------------------

// Personnalité DÉTERMINISTE, déduite du set du combattant actif : aucun champ persisté
// en plus, et le joueur peut l'anticiper en lisant la carte adverse.
export function personnaliteIA(etat: EtatCombat, cote: CoteCombat): PersonnaliteIA {
  const set = actif(etat, cote).set;
  return set === 'fruit' ? 'rusee' : set === 'milk' ? 'tenace' : 'brutal';
}

// Énergie dont le camp disposera AU MOMENT D'AGIR : l'intention est verrouillée à la fin
// du round précédent, mais le revenu de round (+2) tombe avant l'action. Sans cette
// anticipation, l'IA annoncerait une spé qu'elle ne pourrait pas payer — et le moteur
// replierait sur l'attaque 0 : l'intention affichée mentirait au joueur.
export function energiePrevue(etat: EtatCombat, cote: CoteCombat): number {
  return bornerEnergie(etat.energie[cote] + ENERGIE_PAR_ROUND);
}

// Choisit l'action complète de l'IA. Contraintes ABSOLUES (§0.9) : l'IA ne riposte
// jamais, n'a jamais de talent, jamais de combo de parfaits, ne joue jamais de
// consommable. Elle paie l'énergie exactement comme le joueur.
export function choisirActionIA(etat: EtatCombat, cote: CoteCombat, rng: Rng): IntentionIA {
  const moi = actif(etat, cote);
  // ⭐ jauge pleine → signature immédiate (lisible : l'adversaire la voit venir)
  if (moi.charge >= CHARGE_MAX) return 'signature';
  const perso = personnaliteIA(etat, cote);
  const lui = actif(etat, adverse(cote));
  const energie = energiePrevue(etat, cote);
  const equipe = etat.equipes[cote];
  const ratio = moi.pv / Math.max(1, moi.pvMax);

  // 0) ☠️ ACHEVER passe avant tout le reste : une IA qui se met en Garde alors qu'elle
  // pouvait gagner le duel enlise le combat (mesuré : c'est ce qui poussait les duels
  // en miroir au-delà du round 30). Même helper que la branche offensive : zéro règle
  // dupliquée.
  const fatal = coupFatalIA(etat, cote);
  if (fatal !== null) return fatal;

  // 1) 🛡️ GARDER — la décision que l'IA ne prenait jamais (diagnostic n°6).
  // `gardeCooldown <= 1` : il sera décrémenté en tête du round où l'action se joue.
  if (moi.gardeCooldown <= 1 && etat.energie[cote] >= COUT_GARDE) {
    if (perso === 'rusee' && lui.charge >= CHARGE_MAX) return 'garde';          // pare l'ulti annoncé
    if (perso === 'tenace' && ratio <= 0.35 && rng() < 0.6) return 'garde';     // s'accroche, sans stagner
    if (perso === 'brutal' && ratio <= 0.2 && rng() < 0.3) return 'garde';      // rarement
  }

  // 2) 🔄 CHANGER — le banc adverse cesse d'être un décor.
  if (energie >= COUT_CHANGER && equipe.length > 1) {
    const iMoi = etat.actifs[cote];
    const subitDesavantage = multType(lui.set, moi.set) === 1.5;
    const candidats = equipe
      .map((c, i) => ({ c, i }))
      .filter(({ c, i }) => i !== iMoi && c.pv > 0);
    if (perso === 'rusee' && subitDesavantage) {
      const neutre = candidats.find(({ c }) => multType(lui.set, c.set) < 1.5);
      if (neutre) return { changer: neutre.i };
    }
    if (perso === 'tenace' && ratio <= 0.3) {
      const frais = candidats.find(({ c }) => c.pv / Math.max(1, c.pvMax) >= 0.6);
      if (frais) return { changer: frais.i };
    }
  }

  // 3) sinon : l'ancienne heuristique d'attaque, désormais bornée par l'énergie.
  return choisirAttaqueIA(etat, cote, rng);
}

// Dégâts que l'IA peut ESPÉRER d'une attaque (estimation, pas une règle : le vrai
// calcul reste le pipeline). Factorisé pour être partagé par `coupFatalIA`.
function degatsAttendusIA(etat: EtatCombat, cote: CoteCombat, a: Attaque): number {
  const moi = actif(etat, cote);
  const lui = actif(etat, adverse(cote));
  if (!estOffensive(a)) return 0;
  const vivantsAdverses = etat.equipes[adverse(cote)].filter((c) => c.pv > 0).length;
  if (a.type === 'zone') return moi.atk * a.puissance * vivantsAdverses * 0.9;
  const p = a.type === 'double' ? a.puissance * 2 : a.puissance;
  return moi.atk * p * multType(moi.set, lui.set);
}

// La spé est-elle réellement jouable ? Une munition ET COUT_SPE d'énergie (§A2).
function speJouableIA(etat: EtatCombat, cote: CoteCombat): boolean {
  return actif(etat, cote).speRestantes > 0 && energiePrevue(etat, cote) >= COUT_SPE;
}

// Attaque qui achève l'actif adverse, ou null. Un seul endroit : `choisirActionIA`
// (priorité absolue) et `choisirAttaqueIA` (étape 1) l'utilisent tous les deux.
function coupFatalIA(etat: EtatCombat, cote: CoteCombat): 0 | 1 | null {
  const moi = actif(etat, cote);
  const lui = actif(etat, adverse(cote));
  const speOk = speJouableIA(etat, cote);
  for (const i of [1, 0] as const) {
    if (i === 1 && !speOk) continue;
    const a = moi.attaques[i];
    if (estOffensive(a) && a.type !== 'zone' && degatsAttendusIA(etat, cote, a) * 0.9 >= lui.pv) return i;
  }
  return null;
}

// Choix d'ATTAQUE seul (0 | 1 | 'signature'). Conservé exporté : c'est le contrat
// historique, et `choisirActionIA` s'appuie dessus pour sa branche offensive.
// Achève si possible, se soigne si mal en point, sinon privilégie la plus grosse
// attaque (zone valorisée par cible vivante). Respecte les munitions ET l'énergie.
export function choisirAttaqueIA(etat: EtatCombat, cote: CoteCombat, rng: Rng): 0 | 1 | 'signature' {
  const moi = actif(etat, cote);
  if (moi.charge >= CHARGE_MAX) return 'signature';
  // 🔋⚡ la spé demande une munition ET COUT_SPE d'énergie : sinon elle est hors de portée
  const speOk = speJouableIA(etat, cote);
  const degatsAttendus = (a: Attaque) => degatsAttendusIA(etat, cote, a);
  // 1) coup fatal sur l'actif adverse ?
  const fatal = coupFatalIA(etat, cote);
  if (fatal !== null) return fatal;
  // 2) soin si mal en point
  for (const i of [1, 0] as const) {
    if (i === 1 && !speOk) continue;
    if (moi.attaques[i].type === 'soin' && moi.pv < moi.pvMax * 0.38 && rng() < 0.7) return i;
  }
  // 3) un peu d'imprévisible
  if (rng() < 0.2) return rng() < 0.5 || !speOk ? 0 : 1;
  // 4) sinon : la meilleure option
  const s0 = degatsAttendus(moi.attaques[0]) + (moi.attaques[0].type === 'boost' ? moi.atk * 0.8 : 0);
  const s1 = degatsAttendus(moi.attaques[1]) + (moi.attaques[1].type === 'boost' && !aStatut(moi, 'boost') ? moi.atk * 0.9 : 0)
    + (moi.attaques[1].type === 'bouclier' && !aStatut(moi, 'bouclier') ? moi.atk * 0.7 : 0);
  return speOk && s1 >= s0 ? 1 : 0;
}

export type DescriptionIntention = {
  titre: string;
  detail: string;
  ton: 'normal' | 'danger' | 'soin' | 'defense';
};

// Titres d'intention non offensifs. Les annonces du moteur les CONTIENNENT mot pour mot :
// l'invariant « ce qui est annoncé est ce qui est joué » devient vérifiable pour TOUTES
// les intentions, pas seulement pour les attaques.
export const TITRE_INTENTION_GARDE = 'Se met en GARDE';
export const titreIntentionChangement = (nom: string) => `Change pour ${nom}`;

// Contrat d'interface : cette description vient de l'action déjà verrouillée
// dans l'état. Le moteur exécutera exactement ce qui est annoncé.
export function decrireIntention(etat: EtatCombat): DescriptionIntention {
  const c = actif(etat, 'b');
  if (aStatut(c, 'etourdi')) return { titre: 'Passe son tour', detail: `${c.nom} est étourdi`, ton: 'defense' };
  const intention = etat.intentionB;
  if (intention === 'garde') {
    return { titre: TITRE_INTENTION_GARDE, detail: `${c.nom} amortira le prochain impact`, ton: 'defense' };
  }
  if (typeof intention === 'object') {
    const entrant = etat.equipes.b[intention.changer];
    return {
      titre: titreIntentionChangement(entrant?.nom ?? '?'),
      detail: `Changement tactique · ${COUT_CHANGER}⚡`,
      ton: 'defense',
    };
  }
  if (intention === 'signature') {
    const sig = signatureDe(c);
    return { titre: `Signature : ${sig.nom}`, detail: sig.desc, ton: 'danger' };
  }
  const attaque = c.attaques[intention];
  const ton = attaque.type === 'soin' ? 'soin'
    : attaque.type === 'bouclier' || attaque.type === 'boost' ? 'defense'
      : attaque.puissance >= 1.3 || attaque.type === 'zone' || attaque.type === 'double' ? 'danger' : 'normal';
  return {
    titre: attaque.nom,
    detail: `${intention === 1 ? `Spé · ${c.speRestantes} charge${c.speRestantes > 1 ? 's' : ''} · ${COUT_SPE}⚡ · ` : ''}${HINT_ATTAQUE[attaque.type]}`,
    ton,
  };
}

// --- Résolution d'un round -----------------------------------------------------------------

// Si l'actif du camp `cote` est KO → fait entrer le suivant (ou termine le combat)
// 🩹 REFONTE — garde `etat.fini` ajoutée : depuis que les statuts (brûlure / poison)
// peuvent tuer en fin de tour, ce helper est appelé à plusieurs endroits par round. Sans
// ce filet, une équipe déjà anéantie poussait un SECOND événement `fin` (l'UI rejouerait
// deux écrans de victoire).
function verifierRemplacement(etat: EtatCombat, cote: CoteCombat, evts: EvtCombat[]) {
  if (etat.fini) return;
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

// --- 🔥 A7 · PHASES POUR TOUS ---------------------------------------------------------
// Le boss avait des phases de rage (donc du récit) ; les 24 cartes, rien. Généralisé :
// Second Souffle à 50 % (+10 % ATQ, +1 énergie au camp) et Dernier Sursaut à 25 %
// (+20 % ATQ, prochaine attaque critique garantie). Les seuils 70 %/35 % du BOSS et ses
// 3 gimmicks sont conservés À L'IDENTIQUE en plus (contenu déjà équilibré).
function actualiserPhase(etat: EtatCombat, c: Combattant, cote: CoteCombat, evts: EvtCombat[]) {
  if (c.pv <= 0) return;
  const ratio = c.pv / Math.max(1, c.pvMax);
  // 👹 BOSS : comportement historique, strictement inchangé.
  if (c.gimmick) {
    const cible: 1 | 2 | 3 = ratio <= 0.35 ? 3 : ratio <= 0.7 ? 2 : 1;
    while (c.bossPhase < cible) {
      c.bossPhase = (c.bossPhase + 1) as 2 | 3;
      if (c.bossPhase === 2) {
        c.atk = Math.round(c.atk * 1.12);
        evts.push({ t: 'statut', cote, cle: 'boss-phase-2', texte: `${c.nom} passe en PHASE 2 : sa puissance augmente !` });
      } else {
        c.atk = Math.round(c.atk * 1.15);
        c.vit += 3;
        c.charge = CHARGE_MAX;
        evts.push({ t: 'statut', cote, cle: 'boss-phase-3', texte: `${c.nom} entre en PHASE FINALE : Signature imminente !` });
      }
    }
  }
  // 🔥 TOUS : Second Souffle puis Dernier Sursaut, une seule fois chacun (monotone).
  const cibleVie: 0 | 1 | 2 = ratio <= 0.25 ? 2 : ratio <= 0.5 ? 1 : 0;
  while (c.phaseVie < cibleVie) {
    c.phaseVie = (c.phaseVie + 1) as 1 | 2;
    if (c.phaseVie === 1) {
      c.atk = Math.round(c.atk * 1.1);
      gagnerEnergie(etat, cote, 1);
      evts.push({ t: 'statut', cote, cle: 'second-souffle', texte: `SECOND SOUFFLE de ${c.nom} : +10 % ATQ et +1 ⚡ !` });
    } else {
      c.atk = Math.round(c.atk * 1.2);
      // Le sursaut est TÉLÉGRAPHIÉ : `fureur` le rend plus fort ET plus fragile (visible
      // via INFOS_STATUT), et `critGarantiDispo` porte le critique promis — on ne le
      // câble PAS sur `fureur` lui-même, sinon le trait `furie` offrirait des critiques
      // garantis à volonté (hors barème).
      poserStatut(c, 'fureur', 1);
      c.critGarantiDispo = true;
      evts.push({ t: 'statut', cote, cle: 'dernier-sursaut', texte: `DERNIER SURSAUT de ${c.nom} : son prochain coup sera CRITIQUE ! 😤` });
    }
  }
}

// --- 🩹 A5 · LE PIPELINE D'IMPACT UNIQUE (dette n°1) ----------------------------------
// AVANT : 4 chemins de calcul (frapper / branche Signature / riposter / encaisserDegats),
// chacun ayant déjà oublié au moins un multiplicateur (historique 🩹 26/07 : `degatsMult`
// sautait la Signature, `reviveDispo` sautait les dégâts secondaires…). MAINTENANT une
// seule fonction, un seul ordre, et toute nouvelle source s'y branche.
export type SourceImpact = 'attaque' | 'signature' | 'riposte' | 'secondaire';

type OptsImpact = {
  estZone?: boolean;
  perceBouclier?: boolean;
  perceGarde?: boolean;
  sansType?: boolean;
  // Réservé aux DÉGÂTS DE STATUT (brûlure / poison) : une combustion n'est pas un coup
  // qu'un bouclier ou une Garde peut intercepter. Sans cette porte, un `poison` effacerait
  // gratuitement bouclier + Garde + givre à CHAQUE tour, ce qui contredirait le barème
  // §A9 et rendrait tout le kit défensif inutile. Le chemin de calcul reste unique.
  sansDefenses?: boolean;
  // 🌡️ 26/07 — Réservé aux dégâts NON INTENTIONNELS (statuts, épines, éclaboussure) : le
  // Coup de chaud est une pression sur les ÉCHANGES DE COUPS, pas sur les poisons.
  //  · statuts : `tickStatuts` borne le budget à §A9 (20 % des PV max par tour) AVANT
  //    d'appeler le pipeline ; remultiplier après faisait sauter le plafond dès le round 12
  //    (mesuré 23 % au round 12, 41 % au 18, 60 % au 25 — une carte morte en deux tours).
  //  · épines / éclaboussure : leur brut DÉRIVE de `inflige`, qui porte déjà l'escalade.
  //    La réappliquer la cumulait AU CARRÉ (mesuré : retour ×3 au round 25 pour des épines
  //    à 100 %). Même raisonnement que pour « Verre fin » : une instance de dégâts = UNE
  //    majoration, à la source.
  sansEscalade?: boolean;
};

function resoudreImpact(
  etat: EtatCombat, attaquant: Combattant, cible: Combattant, cibleCote: CoteCombat,
  cibleIndex: number, brut: number, source: SourceImpact,
  opts: OptsImpact,
  evts: EvtCombat[],
): number {
  const mut = etat.mutateur;
  const attCote = adverse(cibleCote);
  let d = Math.max(0, Math.round(brut));

  // 1) 👹 gimmick : le boss « insensible à la zone » ne prend aucun dégât de zone
  if (opts.estZone && cible.gimmick === 'zone-immune') {
    d = 0;
    evts.push({ t: 'statut', cote: cibleCote, cle: 'zone-immune', texte: `${cible.nom} est insensible aux attaques de zone ! 🛡️` });
  }
  // 2) 🌊 Tempête : les dégâts de ZONE sont renforcés par le mutateur…
  if (opts.estZone && mut?.zoneMult) d = Math.round(d * mut.zoneMult);
  // 3) 🧊 …puis réduits par l'Isotherme / panoplie Givré de la cible
  if (opts.estZone && cible.eff.reducZonePct) d = Math.ceil(d * (1 - cible.eff.reducZonePct / 100));

  if (!opts.sansDefenses) {
    // 4) ❄️ combo Givré : le prochain impact brise la marque et frappe plus fort
    if (d > 0 && aStatut(cible, 'givre')) {
      d = Math.ceil(d * GIVRE_MULT);
      retirerStatut(cible, 'givre');
      evts.push({ t: 'statut', cote: attCote, cle: 'bris-de-glace', texte: `BRIS DE GLACE sur ${cible.nom} ! ❄️` });
    }
    // 5) 😤 fureur : le porteur tape plus fort mais encaisse 20 % de plus
    if (d > 0 && aStatut(cible, 'fureur')) d = Math.ceil(d * FUREUR_VULN);
    // 6) 🛡️ bouclier : encaisse la moitié (le mutateur peut les désactiver)
    const boucAgit = d > 0 && aStatut(cible, 'bouclier') && !mut?.sansBouclier;
    if (boucAgit && !opts.perceBouclier) {
      d = Math.ceil(d / 2);
      retirerStatut(cible, 'bouclier');
      evts.push({ t: 'statut', cote: cibleCote, cle: 'bouclier-encaisse', texte: `Le bouclier de ${cible.nom} encaisse la moitié !` });
    } else if (boucAgit) {
      evts.push({ t: 'statut', cote: attCote, cle: 'transperce', texte: `${attaquant.nom} transperce le bouclier ! ⚡` });
    }
    // 7) 🛡️ Garde : amortit le prochain impact (le trait `perce` n'en laisse que la moitié)
    if (d > 0 && aStatut(cible, 'garde')) {
      const reduction = valeurStatut(cible, 'garde') * (opts.perceGarde ? PERCE_GARDE_MULT : 1);
      d = Math.ceil(d * (1 - reduction));
      retirerStatut(cible, 'garde');
      evts.push({
        t: 'statut', cote: cibleCote, cle: 'garde-amortit',
        texte: `${cible.nom} amortit ${Math.round(reduction * 100)} % ${source === 'signature' ? 'de la Signature' : 'du choc'} !`,
      });
    }
  }

  // 8) 🛡️ 26/07 — filet de sécurité : une réduction cumulée > 100 % rendait `d` NÉGATIF,
  // et `avant - d` SOIGNAIT la cible au-delà de ses PV max (combo Wobblina 45 % +
  // Couvercle Isotherme 50 % + panoplie Givré 30 % = 125 %). À CONSERVER ABSOLUMENT.
  d = Math.max(0, d);
  // 9) ⚡ mutateur « Verre fin » : ici, donc pour les QUATRE sources (c'était LE bug —
  // il sautait la Signature, l'attaque la plus importante du jeu).
  if (mut?.degatsMult) d = Math.round(d * mut.degatsMult);
  // 9 bis) 🌡️ COUP DE CHAUD (§A9) : neutre jusqu'au round 11, puis +15 %/round (×3 max).
  // Même emplacement que le mutateur — donc les 4 sources, à la seule exception des dégâts
  // qui ne sont pas un échange de coups (cf. `sansEscalade`).
  const esc = opts.sansEscalade ? 1 : multEscalade(etat.round);
  if (esc > 1) d = Math.round(d * esc);

  // 10) application aux PV, 🧿 revive, événement, ⭐ charge de la cible
  const avant = cible.pv;
  const inflige = Math.min(avant, d);
  cible.pv = Math.min(cible.pvMax, Math.max(0, avant - d));
  actualiserPhase(etat, cible, cibleCote, evts);
  // ⭐ encaisser charge la jauge ; encaisser une SIGNATURE la charge FORT (+2, comeback)
  const gainCharge = source === 'signature' ? 2 : source === 'secondaire' ? 0 : 1;
  if (inflige > 0 && cible.pv > 0 && gainCharge > 0) cible.charge = Math.min(CHARGE_MAX, cible.charge + gainCharge);
  let revive = false;
  if (cible.pv <= 0 && cible.reviveDispo) { cible.pv = 1; cible.reviveDispo = false; revive = true; } // 🧿 Grigri
  const efficace: 1 | 1.5 | 0.75 = opts.sansType ? 1 : multType(attaquant.set, cible.set);
  evts.push({ t: 'degats', cote: cibleCote, index: cibleIndex, valeur: inflige, efficace, pvApres: cible.pv });
  if (revive) evts.push({ t: 'statut', cote: cibleCote, cle: 'revive', texte: `${cible.nom} tient bon à 1 PV ! 🧿` });
  // 🩹 26/07 — `avant > 0` : on ne tue QUE ce qui était encore vivant. Frapper une cible
  // déjà à 0 PV ré-émettait un `ko` (l'écran rejouait sa cinématique plein écran) et
  // recréditait `ENERGIE_KO` — deux fois la prime de comeback pour une seule carte perdue.
  else if (cible.pv <= 0 && avant > 0) {
    evts.push({ t: 'ko', cote: cibleCote, index: cibleIndex, nom: cible.nom });
    gagnerEnergie(etat, cibleCote, ENERGIE_KO); // 💪 comeback : perdre une carte donne de l'énergie
  }

  // 11) déclencheurs POST-IMPACT. Volontairement inactifs pour `secondaire` : c'est le
  // comportement historique de `encaisserDegats`, et c'est aussi ce qui empêche une
  // récursion (éclaboussure → épines → éclaboussure → …).
  if (source !== 'secondaire' && inflige > 0) {
    const posAtt = localiser(etat, attaquant);
    const mutSoin = mut?.soinMult ?? 1;
    // 🩸 vol de vie de l'attaquant (Caramel / panoplie Sucré) — 🎖️ soin_plus inclus
    if (attaquant.eff.volDeViePct && attaquant.pv > 0) {
      const taux = Math.min(VOL_DE_VIE_MAX_PCT, attaquant.eff.volDeViePct);
      const brutSoin = Math.min(inflige * taux / 100, attaquant.pvMax * VOL_DE_VIE_MAX_PV_PCT_ACTION / 100);
      const soin = appliquerSoin(attaquant, brutSoin * multSoinProdigue(attaquant) * mutSoin);
      if (soin > 0) evts.push({ t: 'soin', cote: posAtt.cote, index: posAtt.index, valeur: soin, pvApres: attaquant.pv });
    }
    // 🌵 épines : la cible renvoie une partie des dégâts à l'attaquant.
    // 🩹 26/07 — « Verre fin » est DÉJÀ porté par `inflige` : le réappliquer le
    // cumulerait au carré. Une instance de dégâts = UNE majoration, à la source.
    // 🌡️ 26/07 — EXACTEMENT le même raisonnement pour le COUP DE CHAUD, qui vit à la même
    // étape 9 du pipeline et avait été oublié : mesuré, des épines à 100 % renvoyaient ×1,6
    // des dégâts reçus au round 15 et ×3 au round 25. D'où `sansEscalade`.
    if (cible.eff.epinesPct && attaquant.pv > 0 && attaquant !== cible) {
      const retour = Math.round(inflige * cible.eff.epinesPct / 100);
      if (retour > 0) encaisserDegats(etat, attaquant, posAtt.cote, posAtt.index, retour, evts, true, true);
    }
    // 🫧 combo Pétillant : l'impact éclabousse tous les remplaçants encore debout.
    if (aStatut(cible, 'petillant')) {
      retirerStatut(cible, 'petillant');
      const equipe = etat.equipes[cibleCote];
      // `splash` DÉRIVE de `inflige` : comme les épines, il porte déjà « Verre fin » ET le
      // 🌡️ Coup de chaud — d'où `sansEscalade` (sinon la majoration serait au carré).
      const splash = Math.max(1, Math.round(inflige * (cible.petillantPct ?? PETILLANT_PCT)));
      for (let i = 0; i < equipe.length; i++) {
        const banc = equipe[i];
        if (i === cibleIndex || banc.pv <= 0) continue;
        encaisserDegats(etat, banc, cibleCote, i, splash, evts, true, true);
      }
      evts.push({ t: 'statut', cote: attCote, cle: 'eclaboussure', texte: 'ÉCLABOUSSURE PÉTILLANTE sur le banc ! 🫧' });
    }
    // 🎖️ contre_marque : la cible encaisse → 25 % de poser SA marque de famille sur
    // l'attaquant. Traité par l'appelant (il seul connaît son `rng`) — cf. frapper().
  }
  return inflige;
}

// 🩹 Dégâts SECONDAIRES (éclaboussure Pétillante, épines, consommable, statut) : simple
// entrée du pipeline unique. Conserve `reviveDispo` (🧿 Grigri / « Increvable »), les
// gimmicks, le mutateur et le clamp [0, pvMax]. Retourne les PV réellement retirés.
//
// 🩹 26/07 — `sansDefenses` vaut TRUE par défaut. Un dégât secondaire NON INTENTIONNEL
// (retour d'épines, éclaboussure Pétillante, tick de brûlure/poison) n'est pas un coup
// qu'on pare : avant la refonte il allait droit aux PV, et le faire passer par les étapes
// 4-7 laissait un retour d'épines de 1 PV détruire un bouclier entier ou consommer le
// pay-off ×1,35 de la marque ❄️ Givré — l'inverse exact du design « set-up / pay-off ».
// Seule une source réellement OFFENSIVE et voulue par le joueur (le consommable, qu'il
// vise et paie 2 ⚡) passe `false` et se fait donc bel et bien intercepter.
function encaisserDegats(
  etat: EtatCombat, qui: Combattant, cote: CoteCombat, index: number, brut: number,
  evts: EvtCombat[], sansDefenses = true, sansEscalade = false,
): number {
  return resoudreImpact(etat, qui, qui, cote, index, brut, 'secondaire', { sansType: true, sansDefenses, sansEscalade }, evts);
}

// 🎖️ soin_plus : les soins PRODIGUÉS par ce combattant rendent +20 % (cumulable)
function multSoinProdigue(c: Combattant): number {
  return Math.pow(TALENT_SOIN_PCT, compteTalent(c, 'soin_plus'));
}

// Pose la marque de famille de `source` sur `cible`. 🎖️ marque_plus : durée +1 et
// Pétillant éclabousse à 35 %. 👅 Goût rang 5 : +1 action. Signature = sans marque.
function poserMarqueFamille(source: Combattant, cible: Combattant, cibleCote: CoteCombat, evts: EvtCombat[]) {
  const plus = compteTalent(source, 'marque_plus') > 0;
  const bonusGout = source.gout >= GOUT_RANG_MARQUE ? 1 : 0;
  const tours = (plus ? TALENT_MARQUE_COLLANT : MARQUE_COLLANT_TOURS) + bonusGout;
  if (source.set === 'fruit') {
    if (poserStatut(cible, 'collant', tours)) {
      evts.push({ t: 'statut', cote: cibleCote, cle: 'marque-collant', texte: `${cible.nom} devient COLLANT : −${COLLANT_VIT} VIT ! 🍯` });
    }
  } else if (source.set === 'milk') {
    if (poserStatut(cible, 'givre', -1)) {
      evts.push({ t: 'statut', cote: cibleCote, cle: 'marque-givre', texte: `${cible.nom} est GIVRÉ : prochain impact renforcé ! ❄️` });
    }
  } else if (source.set === 'topping') {
    if (poserStatut(cible, 'petillant', -1)) {
      cible.petillantPct = plus ? TALENT_PETILLANT_PCT : PETILLANT_PCT;
      evts.push({ t: 'statut', cote: cibleCote, cle: 'marque-petillant', texte: `${cible.nom} devient PÉTILLANT : prochain impact sur le banc ! 🫧` });
    }
  } else if (source.set === 'signature') {
    // 🩹 26/07 — le set `signature` sortait ici SANS RIEN POSER : les 6 légendaires
    // étaient exclues du système de marques, donc `marque_plus` de Tiger Sugar et
    // `contre_marque` de Matcha Sensei n'avaient AUCUN effet. On réutilise les DEUX
    // marques de contrôle existantes (Givré + Collant) sous le nom de SCEAU ROYAL :
    // les libellés figés d'economie.ts imposent chacun une marque différente pour une
    // même famille. Pétillant est volontairement exclu (hors barème).
    const g = poserStatut(cible, 'givre', -1);
    const co = poserStatut(cible, 'collant', tours);
    if (g || co) evts.push({ t: 'statut', cote: cibleCote, cle: 'marque-sceau', texte: `${cible.nom} porte le SCEAU ROYAL : GIVRÉ et COLLANT ! 👑` });
  }
}

// --- 🧪 A1 · TICK DE STATUTS (fin de tour du PORTEUR) ---------------------------------
// Applique brûlure / poison / régén, PUIS décrémente les durées > 0, PUIS retire les
// expirés (`tours === -1` ne décrémente jamais : consommation seulement).
// Toute perte de PV passe par le pipeline d'impact, tout soin par `appliquerSoin`.
// Plafond dur §A9 : 20 % des PV max par tour, TOUS statuts confondus.
// `etat`/`index` sont optionnels (paramètres FINAUX) pour que le helper reste appelable
// seul dans un test ; à défaut on résout dans un état solo, donc par le MÊME pipeline.
//
// 🌡️ 27/07 — LE PLAFOND ÉTAIT CALCULÉ TROP TÔT. Le budget est borné ICI, mais
// `resoudreImpact` remultipliait ensuite par `multEscalade(etat.round)` (étape 9 bis) :
// mesuré sur une cible empoisonnée ×3 + brûlée, la perte réelle passait de 19,9 % au
// round 1 à 22,6 % au round 12, 40,4 % au round 18 et 59,6 % au round 25 — une carte
// mourait en deux tours sans être touchée. Les deux ticks passent donc `sansEscalade`,
// exactement pour la même raison que les épines et l'éclaboussure Pétillante : le Coup
// de chaud majore un ÉCHANGE DE COUPS, et une perte déjà bornée en pourcentage de PV max
// ne doit pas être remajorée après coup. §A9 (« pas plus de 20 % par tour ») l'emporte
// donc sur la lecture large de §A7 — mesuré après : 20 % à TOUS les rounds.
export function tickStatuts(
  c: Combattant, cote: CoteCombat, evts: EvtCombat[], etat?: EtatCombat, index = 0,
): void {
  const st = etat ?? etatSolo(c, cote);
  const idx = etat ? index : 0;
  if (c.pv > 0) {
    let budget = Math.max(0, Math.floor(c.pvMax * STATUT_DEGATS_MAX_PCT / 100));
    // 🔥 brûlure
    const b = c.statuts.find((s) => s.id === 'brulure');
    if (b && budget > 0) {
      const voulu = Math.max(1, Math.round(b.valeur ?? Math.ceil(c.pvMax * BRULURE_PCT_DEFAUT / 100)));
      const d = Math.min(voulu, Math.ceil(c.pvMax * BRULURE_MAX_PCT / 100), budget);
      budget -= d;
      evts.push({ t: 'statut', cote, cle: 'brulure', texte: `${c.nom} brûle ! 🔥` });
      // 🌡️ `sansEscalade` : cf. le bloc de commentaire au-dessus du budget.
      encaisserDegats(st, c, cote, idx, d, evts, true, true);
    }
    // ☠️ poison (cumulable, 6 % des PV max par pile)
    const p = c.statuts.find((s) => s.id === 'poison');
    if (p && budget > 0 && c.pv > 0) {
      const voulu = Math.ceil(c.pvMax * POISON_PCT_PILE / 100 * Math.min(POISON_PILES_MAX, p.piles));
      const d = Math.min(voulu, budget);
      budget -= d;
      evts.push({ t: 'statut', cote, cle: 'poison', texte: `${c.nom} est empoisonné (×${p.piles}) ! ☠️` });
      encaisserDegats(st, c, cote, idx, d, evts, true, true);
    }
    // 💚 régén — passe par appliquerSoin, donc respecte la 💧 fatigue de soin
    const r = c.statuts.find((s) => s.id === 'regen');
    if (r && c.pv > 0 && c.pv < c.pvMax) {
      const voulu = Math.min(REGEN_MAX_PAR_ACTION, Math.max(1, Math.round(r.valeur ?? Math.ceil(c.pvMax * REGEN_PCT_DEFAUT / 100))));
      const gain = appliquerSoin(c, voulu * (st.mutateur?.soinMult ?? 1));
      if (gain > 0) evts.push({ t: 'soin', cote, index: idx, valeur: gain, pvApres: c.pv });
    }
  }
  for (const s of c.statuts) if (s.tours > 0) s.tours--;
  const expires = c.statuts.filter((s) => s.tours === 0).map((s) => s.id);
  if (expires.length) {
    c.statuts = c.statuts.filter((s) => s.tours !== 0);
    evts.push({
      t: 'statut', cote, cle: 'statut-expire',
      texte: `${c.nom} n’est plus ${expires.map((id) => INFOS_STATUT[id].nom.toLowerCase()).join(', ')}.`,
    });
  }
}

// État minimal (un seul combattant) : permet à `tickStatuts` d'utiliser le pipeline
// unique même quand il est appelé hors combat (tests unitaires de statuts).
function etatSolo(c: Combattant, cote: CoteCombat): EtatCombat {
  const autre = adverse(cote);
  const equipes = { a: [] as Combattant[], b: [] as Combattant[] };
  equipes[cote] = [c];
  equipes[autre] = [c];
  return {
    equipes, actifs: { a: 0, b: 0 }, round: 0, fini: false, vainqueur: null,
    intentionB: 0, energie: { a: 0, b: 0 }, combo: 0,
  };
}

// 🩹 26/07 — TICK DE FIN DE TOUR : joué dans TOUTES les branches (attaque, garde,
// changement, objet, tour passé pour étourdissement) — exactement une fois par tour et
// par camp. Il portait la régén d'objet, le boost et le Collant ; il porte désormais
// aussi le tick des statuts (brûlure / poison / régén / expirations).
function finDeTour(etat: EtatCombat, c: Combattant, cote: CoteCombat, index: number, evts: EvtCombat[]) {
  tickStatuts(c, cote, evts, etat, index);
  // 🍯 régénération par tour (Nappé / panoplie Sucré) — après l'action, 💧 fatigue incluse
  if (c.eff.soinTour && c.pv > 0 && c.pv < c.pvMax) {
    const soin = appliquerSoin(c, c.eff.soinTour * (etat.mutateur?.soinMult ?? 1));
    if (soin > 0) evts.push({ t: 'soin', cote, index, valeur: soin, pvApres: c.pv });
  }
  // 🩹 REFONTE — INDISPENSABLE : avant, `finDeTour` ne pouvait que soigner, donc aucune
  // branche n'avait besoin de vérifier un K.O. après lui. Une brûlure ou un poison PEUT
  // désormais achever son porteur, et `finDeTour` est appelé dans 6 branches dont 5
  // sortent aussitôt (tour passé pour étourdissement, garde, changement, objet, garde du
  // joueur). Sans ce contrôle ici, le combattant restait « actif » à 0 PV : `agir` sortait
  // au round suivant sans jouer, et le combat se bloquait sans fin.
  verifierRemplacement(etat, cote, evts);
}

// 🛡️ Pose la Garde d'un camp. Partagée par la branche joueur de `jouerRound` (qui y
// ajoute la riposte de parade parfaite) et par l'IA : une seule règle, un seul endroit.
function appliquerGarde(
  etat: EtatCombat, cote: CoteCombat, evts: EvtCombat[], timing?: Timing, choixAdverse?: IntentionIA,
): { parfaite: boolean; antiSignature: boolean } {
  const moi = actif(etat, cote);
  const parfaite = timing === 'parfait'; // 🎯 PARADE PARFAITE : bloque plus, charge plus
  // 🛡️⚡ parade parfaite CONTRE une Signature annoncée : −80 % et jauge +3
  const antiSignature = parfaite && choixAdverse === 'signature';
  // 🎖️ garde_maitrisee : la Garde de CETTE carte bloque −55 % (parfaite/anti-signature inchangées, meilleures)
  const reductionBase = compteTalent(moi, 'garde_maitrisee') > 0 ? GARDE_MAITRISEE : GARDE_REDUCTION;
  const reduction = antiSignature ? GARDE_PARFAITE_ANTI_SIGNATURE : parfaite ? GARDE_PARFAITE : reductionBase;
  // 🩹 27/07 — UNE GARDE FAIBLE HÉRITAIT D'UNE GARDE FORTE. `poserStatut` conserve
  // `Math.max(valeur)` (à raison : deux sources concurrentes de réduction ne doivent pas
  // s'annuler), mais la Garde n'est consommée que par un IMPACT : parer parfaitement une
  // action NON offensive laissait GARDE_PARFAITE (0,70) en place, et la Garde RATÉE du
  // round suivant en héritait (mesuré 0,70 au lieu de 0,45). Une Garde REMPLACE la
  // précédente — c'est la même main qui se replace, pas une seconde protection — d'où le
  // retrait explicite avant la pose. Le `Math.max` de `poserStatut` reste intact pour les
  // vrais cumuls (changement tactique, effets d'objet).
  retirerStatut(moi, 'garde');
  poserStatut(moi, 'garde', -1, reduction);
  moi.gardeCooldown = cooldownGarde(moi);
  moi.charge = Math.min(CHARGE_MAX, moi.charge + (antiSignature ? 3 : parfaite ? 2 : 1));
  evts.push({ t: 'annonce', cote, texte: `${moi.nom} — ${TITRE_INTENTION_GARDE} !`, cle: 'garde' });
  evts.push({
    t: 'statut', cote, cle: antiSignature ? 'parade-heroique' : parfaite ? 'parade-parfaite' : 'garde',
    texte: antiSignature
      ? `PARADE HÉROÏQUE ! ${moi.nom} bloquera −${Math.round(GARDE_PARFAITE_ANTI_SIGNATURE * 100)} % de la Signature et sa jauge déborde !`
      : parfaite
        ? `PARADE PARFAITE ! ${moi.nom} bloquera −${Math.round(GARDE_PARFAITE * 100)} % et charge fort sa jauge !`
        : `${moi.nom} se met en GARDE : prochain impact −${Math.round(reductionBase * 100)} % !`,
  });
  return { parfaite, antiSignature };
}

// 🔄 Changement d'actif (payé en énergie, §A2). Retourne false si rien n'a bougé :
// un changement impayable ou illégal est simplement IGNORÉ, l'action `puis` se joue.
function appliquerChangement(etat: EtatCombat, cote: CoteCombat, idx: number, evts: EvtCombat[]): boolean {
  const eq = etat.equipes[cote];
  if (!changementLegal(etat, cote, idx)) return false;
  if (!payerEnergie(etat, cote, COUT_CHANGER)) return false;
  etat.actifs[cote] = idx;
  poserStatut(eq[idx], 'garde', -1, CHANGEMENT_REDUCTION);
  evts.push({ t: 'annonce', cote, texte: `${eq[idx].nom} — ${titreIntentionChangement(eq[idx].nom)} !`, cle: 'changement' });
  evts.push({ t: 'entree', cote, index: idx, nom: eq[idx].nom });
  evts.push({
    t: 'statut', cote, cle: 'changement',
    texte: `Changement tactique : ${eq[idx].nom} amortira le prochain impact de ${Math.round(CHANGEMENT_REDUCTION * 100)} %.`,
  });
  return true;
}

// Une action est-elle OFFENSIVE ? Sert au remboursement `ENERGIE_GARDE_GACHEE` : gardér
// contre un boost ou un soin ne doit pas être puni (diagnostic n°5).
function actionOffensive(c: Combattant, choix: IntentionIA): boolean {
  if (aStatut(c, 'etourdi')) return false;
  if (choix === 'signature') return signatureDe(c).pvPct > 0;
  if (choix === 'garde' || typeof choix === 'object') return false;
  return estOffensive(c.attaques[choix]);
}

// `timing`/`combo` ne sont fournis QUE pour le côté joueur (a) : jauge tap-parfait
// et nombre de PARFAITS déjà en banque avant cette action.
function agir(
  etat: EtatCombat, cote: CoteCombat, choix: 0 | 1 | 'signature' | 'garde' | { changer: number },
  rng: Rng, evts: EvtCombat[], timing?: Timing, combo = 0,
) {
  const moi = actif(etat, cote);
  const indexMoi = etat.actifs[cote];
  const cible = actif(etat, adverse(cote));
  const indexCible = etat.actifs[adverse(cote)];
  if (moi.pv <= 0 || etat.fini) return;
  // ⚡ l'intention annoncée de b est en train d'être JOUÉE : sa réserve d'énergie est
  // libérée immédiatement. Sans cela, b resterait immunisé au vol pour le reste du round
  // alors qu'il n'a plus rien à payer — le plancher deviendrait un bouclier permanent.
  if (cote === 'b') etat.intentionBEngagee = null;

  if (aStatut(moi, 'etourdi')) {
    retirerStatut(moi, 'etourdi');
    evts.push({ t: 'statut', cote, cle: 'etourdi-passe', texte: `${moi.nom} est étourdi et passe son tour ! 💫` });
    // 🩹 REFONTE — le tick de fin de tour manquait ici : un étourdissement gelait la
    // brûlure, le poison, la régén, le boost et le Collant. Un tour passé EST un tour.
    finDeTour(etat, moi, cote, indexMoi, evts);
    return;
  }

  // 🛡️ / 🔄 l'IA peut désormais garder et changer (§A7) : mêmes helpers que le joueur.
  if (choix === 'garde') {
    appliquerGarde(etat, cote, evts, timing, choixAdversePour(etat, cote));
    finDeTour(etat, moi, cote, indexMoi, evts);
    return;
  }
  if (typeof choix === 'object') {
    appliquerChangement(etat, cote, choix.changer, evts);
    const finC = actif(etat, cote);
    finDeTour(etat, finC, cote, etat.actifs[cote], evts);
    return;
  }

  // 👹 gimmick bouclier : le boss lève sa garde un tour sur deux
  if (moi.gimmick === 'bouclier' && !aStatut(moi, 'bouclier') && etat.round % 2 === 1) {
    poserStatut(moi, 'bouclier', -1);
    evts.push({ t: 'statut', cote, cle: 'bouclier', texte: `${moi.nom} lève un bouclier ! 🛡️` });
  }

  // ⭐⚡ garde-fous (§A2) : signature sans jauge pleine / spé sans munition OU sans
  // énergie → repli sur l'attaque de base. L'énergie est débitée ICI, jamais dans l'UI.
  if (choix === 'signature' && moi.charge < CHARGE_MAX) choix = 0;
  if (choix === 1 && (moi.speRestantes <= 0 || etat.energie[cote] < COUT_SPE)) choix = 0;
  const estSpe = choix === 1;
  if (estSpe) {
    moi.speRestantes--;                    // 🔋 une munition (même si le coup effleure)
    payerEnergie(etat, cote, COUT_SPE);    // ⚡ et 3 d'énergie
  }

  const mut = etat.mutateur;                                           // ⚡ mutateur du jour
  const multAtk = multAtkStatuts(moi);                                 // 💪 😤 📉
  const bonusPrecision = (moi.eff.precisionPct ?? 0) / 100;             // 🎯
  // 🩹 26/07 — borné par CHANCE_CRITIQUE_MAX : sans ce clamp le total dépassait 1,00
  // (jusqu'à 1,32) et le critique devenait automatique — voir CHANCE_CRITIQUE_MAX.
  const chanceCrit = Math.min(CHANCE_CRITIQUE_MAX,
    (CHANCE_CRITIQUE + (moi.eff.critPct ?? 0) / 100) * (mut?.critChanceX2 ? 2 : 1)
    + (estSpe ? TALENT_SPE_CRIT * compteTalent(moi, 'spe_crit') : 0)    // 🎖️ spe_crit
    + (timing ? TIMING_CRIT[timing] : 0)); // 🍀 💥 🎯 un bon timing rend le critique plus probable
  const multSoin = multSoinProdigue(moi);
  const traits = choix === 'signature' ? [] : traitsDe(moi, choix);

  // Inflige des dégâts à UNE cible. Tout ce qui suit le calcul du BRUT est délégué au
  // pipeline unique. Retourne `plein: false` quand le coup n'a fait qu'EFFLEURER (§A6) :
  // ni marque ni statut dans ce cas — c'est la seule pénalité qui reste au raté.
  const frapper = (qui: Combattant, indexQui: number, puissance: number, precisionBase: number, estZone = false): { plein: boolean; inflige: number } => {
    const mult = multType(moi.set, qui.set);
    // 🔥 Dernier Sursaut : le critique promis est GARANTI (consommé au premier coup)
    const critForce = moi.critGarantiDispo === true;
    const crit = critForce || rng() < chanceCrit;
    if (critForce) moi.critGarantiDispo = false;
    if (crit) evts.push({ t: 'statut', cote, cle: 'critique', texte: 'Coup critique ! 💥' });
    let brut = moi.atk * puissance * mult * multAtk * (crit ? 1.5 : 1) * (0.9 + rng() * 0.2)
      * (timing ? TIMING_MULT[timing] * multCombo(combo) : 1); // 🎯 timing × ⚡ combo
    // 🎖️ premiere_frappe : la 1ère attaque qui touche tape +25 % (consommé au 1er impact)
    if (moi.premiereFrappe && brut > 0) {
      brut *= Math.pow(TALENT_PREMIERE_FRAPPE, compteTalent(moi, 'premiere_frappe'));
      moi.premiereFrappe = false;
      evts.push({ t: 'statut', cote, cle: 'premiere-frappe', texte: `${moi.nom} frappe le premier coup parfait ! ⚡` });
    }
    // 💨 A6 — le raté n'annule plus le tour : il EFFLEURE (×0,45), sans marque ni statut.
    // Un tap PARFAIT, le trait `precise` et le mutateur « Œil de lynx » garantissent le plein.
    let plein = true;
    if (timing !== 'parfait' && !traits.includes('precise') && !mut?.precisionParfaite
      && rng() > Math.min(1, precisionBase + bonusPrecision)) {
      brut *= EFFLEURE_MULT;
      plein = false;
      evts.push({ t: 'statut', cote, cle: 'effleure', texte: `${moi.nom} ne fait qu’effleurer ${qui.nom} ! 💨` });
    }
    // ⚔️ trait `brise` : le bouclier est DÉTRUIT avant le coup (il n'encaisse rien)
    if (traits.includes('brise') && aStatut(qui, 'bouclier')) {
      retirerStatut(qui, 'bouclier');
      evts.push({ t: 'statut', cote, cle: 'brise', texte: `${moi.nom} BRISE le bouclier de ${qui.nom} ! 💥` });
    }
    const inflige = resoudreImpact(etat, moi, qui, adverse(cote), indexQui, brut, 'attaque', {
      estZone,
      perceBouclier: moi.eff.perceBouclier,
      perceGarde: traits.includes('perce'),
    }, evts);
    // 🩸 trait `siphon` : 15 % des dégâts rendus en PV (💧 fatigue + plafonds §A9)
    if (inflige > 0 && traits.includes('siphon') && moi.pv > 0) {
      const brutSoin = Math.min(inflige * SIPHON_PCT / 100, moi.pvMax * VOL_DE_VIE_MAX_PV_PCT_ACTION / 100);
      const soin = appliquerSoin(moi, brutSoin * multSoin * (mut?.soinMult ?? 1));
      if (soin > 0) evts.push({ t: 'soin', cote, index: indexMoi, valeur: soin, pvApres: moi.pv });
    }
    // 🎖️ contre_marque : la cible encaisse → 25 % de poser SA marque sur l'attaquant
    if (inflige > 0 && moi.pv > 0 && compteTalent(qui, 'contre_marque') > 0 && rng() < TALENT_CONTRE_MARQUE) {
      poserMarqueFamille(qui, moi, cote, evts);
    }
    // 🩸 ☠️ 📉 traits d'altération : seulement sur un impact PLEIN et une cible debout
    if (plein && inflige > 0 && qui.pv > 0) {
      if (traits.includes('saignee')) {
        const pv = Math.max(1, Math.round(qui.pvMax * SAIGNEE_PCT / 100));
        if (poserStatut(qui, 'brulure', 2, pv)) evts.push({ t: 'statut', cote: adverse(cote), cle: 'pose-brulure', texte: `${qui.nom} prend feu ! 🔥` });
      }
      if (traits.includes('venin')) {
        if (poserStatut(qui, 'poison', 3, undefined, POISON_PILES_MAX)) {
          evts.push({ t: 'statut', cote: adverse(cote), cle: 'pose-poison', texte: `${qui.nom} est empoisonné (×${pilesStatut(qui, 'poison')}) ! ☠️` });
        }
      }
      if (traits.includes('affaiblit')) {
        if (poserStatut(qui, 'faiblesse', 2)) evts.push({ t: 'statut', cote: adverse(cote), cle: 'pose-faiblesse', texte: `${qui.nom} est AFFAIBLI : −25 % ATQ ! 📉` });
      }
      if (traits.includes('marque')) poserMarqueFamille(moi, qui, adverse(cote), evts);
    }
    return { plein, inflige };
  };

  if (choix === 'signature') {
    // ⭐ ATTAQUE SIGNATURE : imparable, dégâts FIXES = % des PV max de la cible
    // (plafonnés à ATQ × SIG_CAP_ATK), neutre en type. Le bouclier encaisse la moitié
    // (contre-jeu assumé), sauf face à un perce-bouclier. Une signature par CARTE (§A4).
    const sig = signatureDe(moi);
    moi.charge = 0;
    evts.push({ t: 'annonce', cote, texte: `⭐ ${moi.nom} déchaîne ${sig.nom} !`, cle: 'signature' });
    const coups = Math.max(1, Math.round(sig.coups ?? 1));
    const optsSig: OptsImpact = {
      sansType: true,
      perceBouclier: sig.perceBouclier || moi.eff.perceBouclier,
      perceGarde: sig.perceGarde,
    };
    let infligeTotal = 0;
    if (sig.pvPct > 0) {
      let parCoup = Math.min(
        Math.round(cible.pvMax * sig.pvPct / 100),
        Math.round(moi.atk * SIG_CAP_ATK / coups),
      );
      if (timing) parCoup = Math.round(parCoup * TIMING_MULT[timing] * multCombo(combo)); // 🎯 × ⚡
      for (let n = 0; n < coups; n++) {
        if (cible.pv <= 0 || moi.pv <= 0 || etat.fini) break;
        infligeTotal += resoudreImpact(etat, moi, cible, adverse(cote), indexCible, parCoup, 'signature', optsSig, evts);
      }
      // 🌊 `zone` : le banc adverse encaisse SIG_ZONE_PCT de la frappe principale
      if (sig.zone) {
        const equipe = etat.equipes[adverse(cote)];
        for (let i = 0; i < equipe.length; i++) {
          if (i === indexCible || equipe[i].pv <= 0 || moi.pv <= 0) continue;
          infligeTotal += resoudreImpact(etat, moi, equipe[i], adverse(cote), i, parCoup * SIG_ZONE_PCT, 'signature', { ...optsSig, estZone: true }, evts);
        }
      }
    }
    const mutSoin = mut?.soinMult ?? 1;
    // 💚 soin de soi (plafonné §A9)
    if (sig.soinPct && moi.pv > 0 && moi.pv < moi.pvMax) {
      const base = moi.pvMax * Math.min(SOIN_DIRECT_MAX_PV_PCT, sig.soinPct) / 100;
      const g = appliquerSoin(moi, base * multSoin * mutSoin);
      if (g > 0) evts.push({ t: 'soin', cote, index: indexMoi, valeur: g, pvApres: moi.pv });
    }
    // 💚 soin d'ÉQUIPE (Recette Éternelle, Cocon Céleste, Nappage Suprême…)
    if (sig.soigneEquipe) {
      const equipe = etat.equipes[cote];
      for (let i = 0; i < equipe.length; i++) {
        const c = equipe[i];
        if (c.pv <= 0 || c.pv >= c.pvMax) continue;
        const base = c.pvMax * Math.min(SOIN_DIRECT_MAX_PV_PCT, sig.soigneEquipe) / 100;
        const g = appliquerSoin(c, base * multSoin * mutSoin);
        if (g > 0) evts.push({ t: 'soin', cote, index: i, valeur: g, pvApres: c.pv });
      }
    }
    // 🩸 vol de vie massif (Couronne Fondante, Pluie de Coco)
    if (sig.volDeViePct && infligeTotal > 0 && moi.pv > 0) {
      const taux = Math.min(VOL_DE_VIE_MAX_PCT, sig.volDeViePct);
      const brutSoin = Math.min(infligeTotal * taux / 100, moi.pvMax * VOL_DE_VIE_MAX_PV_PCT_ACTION / 100);
      const g = appliquerSoin(moi, brutSoin * multSoin * mutSoin);
      if (g > 0) evts.push({ t: 'soin', cote, index: indexMoi, valeur: g, pvApres: moi.pv });
    }
    if (sig.etourdit && cible.pv > 0) etourdir(cible, adverse(cote), evts);
    if (sig.boost) {
      poserStatut(moi, 'boost', 3); // décrémenté à la fin de CETTE action → effectif 2 tours
      evts.push({ t: 'statut', cote, cle: 'boost', texte: `${moi.nom} monte en puissance ! (+40 % ATQ) 💪` });
    }
    if (sig.statut && cible.pv > 0) poserStatutJournalise(cible, adverse(cote), sig.statut, evts);
    if (sig.statutSoi) poserStatutJournalise(moi, cote, sig.statutSoi, evts);
    if (sig.statutEquipe) {
      for (const c of etat.equipes[adverse(cote)]) if (c.pv > 0) poserStatutJournalise(c, adverse(cote), sig.statutEquipe, evts);
    }
    if (sig.statutEquipeSoi) {
      for (const c of etat.equipes[cote]) if (c.pv > 0) poserStatutJournalise(c, cote, sig.statutEquipeSoi, evts);
    }
    // ⚡ économie : rend / vole de l'énergie
    if (sig.energie) {
      gagnerEnergie(etat, cote, sig.energie);
      evts.push({ t: 'statut', cote, cle: 'energie', texte: `${moi.nom} récupère ${sig.energie} ⚡ !` });
    }
    // ⚡ 27/07 — on annonce ce qui a RÉELLEMENT été volé, jamais le montant demandé : la
    // réserve adverse peut être déjà vide, ou protégée par `energieReservee`. Annoncer un
    // vol qui n'a pas eu lieu serait le mensonge d'UI que ce lot corrige, en plus petit.
    if (sig.energieAdverse) {
      const avantVol = etat.energie[adverse(cote)];
      retirerEnergie(etat, adverse(cote), sig.energieAdverse);
      const vole = avantVol - etat.energie[adverse(cote)];
      if (vole > 0) {
        evts.push({ t: 'statut', cote, cle: 'energie-volee', texte: `L’énergie adverse fond de ${vole} ⚡ !` });
      }
    }
    // 🔄 contre-coup automatique — CÔTÉ JOUEUR UNIQUEMENT : « l'IA n'a jamais de
    // riposte » est une consigne produit explicite (§0.9), sans exception de contenu.
    if (sig.riposteAuto && cote === 'a') moi.riposteArmee = true;
  } else {
    const attaque = moi.attaques[choix];
    const bonus = estSpe ? SPE_BONUS : 1; // 🔋 la spé frappe/soigne plus fort
    let touchePourMarque = false;
    // `attaqueIdx` : l'écran retrouve l'attaque par son INDEX, jamais par son nom.
    evts.push({ t: 'annonce', cote, texte: `${moi.nom} utilise ${attaque.nom} !`, cle: 'attaque', attaqueIdx: choix });

    switch (attaque.type) {
      case 'degats':
        touchePourMarque = frapper(cible, indexCible, attaque.puissance * bonus, attaque.puissance >= 1.3 ? PRECISION_LOURDE : PRECISION_BASE).plein;
        break;
      case 'double':
        touchePourMarque = frapper(cible, indexCible, attaque.puissance * bonus, PRECISION_BASE).plein;
        // 🩹 26/07 — `moi.pv > 0` : un attaquant tué par les 🌵 épines du 1er coup
        // plaçait quand même le second (un mort ne frappe pas).
        if (cible.pv > 0 && moi.pv > 0) touchePourMarque = frapper(cible, indexCible, attaque.puissance * bonus, PRECISION_BASE).plein || touchePourMarque;
        break;
      case 'etourdit': {
        const touche = frapper(cible, indexCible, attaque.puissance * bonus, PRECISION_BASE).plein;
        touchePourMarque = touche;
        if (touche && cible.pv > 0 && rng() < (estSpe ? 0.7 : 0.55)) etourdir(cible, adverse(cote), evts);
        break;
      }
      case 'zone': {
        // 🌊 la vague balaie TOUTE l'équipe adverse (chaque cible encaisse à son compte)
        const equipeAdverse = etat.equipes[adverse(cote)];
        for (let i = 0; i < equipeAdverse.length; i++) {
          // 🩹 26/07 — Citro à 4 PV, tué par les 🌵 épines de la 2e cible, terminait
          // quand même sa vague sur la 3e.
          if (moi.pv <= 0) break;
          const c = equipeAdverse[i];
          if (c.pv > 0) touchePourMarque = frapper(c, i, attaque.puissance * bonus, PRECISION_ZONE, true).plein || touchePourMarque;
        }
        break;
      }
      case 'soin': {
        // 💧 fatigue de soin : chaque soin successif du combat rend 25 % de moins
        // 🎖️ soin_plus : les soins prodigués par cette carte rendent +20 %
        const avantFatigue = moi.soinsRecus;
        const gain = appliquerSoin(moi, moi.atk * attaque.puissance * bonus * multSoin * (mut?.soinMult ?? 1) * (timing ? TIMING_MULT[timing] : 1));
        evts.push({ t: 'soin', cote, index: indexMoi, valeur: gain, pvApres: moi.pv });
        if (avantFatigue === 1) evts.push({ t: 'statut', cote, cle: 'fatigue-soin', texte: `Le soin FATIGUE : chaque soin suivant rend moins à ${moi.nom} !` });
        break;
      }
      case 'bouclier':
        poserStatut(moi, 'bouclier', -1);
        evts.push({ t: 'statut', cote, cle: 'bouclier', texte: `${moi.nom} se protège ! 🛡️` });
        break;
      case 'boost':
        poserStatut(moi, 'boost', 3); // décrémenté à la fin de CETTE action → effectif 2 tours
        evts.push({ t: 'statut', cote, cle: 'boost', texte: `${moi.nom} monte en puissance ! (+40 % ATQ) 💪` });
        break;
    }

    // 🏷️ traits « d'action » : ils ne dépendent pas d'un impact, donc ils fonctionnent
    // aussi sur une spé défensive (Recette originale, Rush de glucose…).
    if (traits.includes('charge')) {
      moi.charge = Math.min(CHARGE_MAX, moi.charge + 1);
      evts.push({ t: 'statut', cote, cle: 'charge', texte: `${moi.nom} charge sa jauge Signature ! ⭐` });
    }
    if (traits.includes('furie')) {
      if (poserStatut(moi, 'fureur', 2)) evts.push({ t: 'statut', cote, cle: 'pose-fureur', texte: `${moi.nom} entre en FUREUR : +25 % ATQ, mais plus fragile ! 😤` });
    }
    // ⚡ 27/07 — même règle que pour `energieAdverse` : on n'annonce que ce qui a réellement
    // été retiré (la réserve adverse peut être protégée par `energieReservee`).
    if (traits.includes('recul') && etat.energie[adverse(cote)] > 0) {
      const avantRecul = etat.energie[adverse(cote)];
      retirerEnergie(etat, adverse(cote), RECUL_ENERGIE);
      const recule = avantRecul - etat.energie[adverse(cote)];
      if (recule > 0) evts.push({ t: 'statut', cote, cle: 'recul', texte: `Le camp adverse perd ${recule} ⚡ !` });
    }

    // Les attaques Spé offensives posent une marque de famille. Le joueur peut
    // ensuite changer de combattant pour déclencher le combo correspondant.
    if (estSpe && touchePourMarque && cible.pv > 0) {
      poserMarqueFamille(moi, cible, adverse(cote), evts);
    }
    // 🏷️ bonus de run « Marque d'Ouverture » : la 1ère action qui TOUCHE (même une
    // attaque de base) pose aussi la marque de famille. Consommé au premier impact.
    if (moi.marqueOuvertureDispo && touchePourMarque && cible.pv > 0) {
      moi.marqueOuvertureDispo = false;
      poserMarqueFamille(moi, cible, adverse(cote), evts);
    }
  }
  finDeTour(etat, moi, cote, indexMoi, evts);

  // 👹 gimmick regen : le boss se soigne à la fin de SON tour (sauté s'il était étourdi,
  // car un boss étourdi sort de agir() avant d'arriver ici).
  if (moi.gimmick === 'regen' && moi.pv > 0 && moi.pv < moi.pvMax) {
    // 🩹 26/07 — `soinMult` (mutateur « Sucre amer ») manquait. La 💧 fatigue de soin
    // reste, elle, volontairement contournée ici (identité du boss hebdo).
    const soin = Math.round(moi.pvMax * 0.08 * (mut?.soinMult ?? 1));
    moi.pv = Math.min(moi.pvMax, moi.pv + soin);
    evts.push({ t: 'soin', cote, index: indexMoi, valeur: soin, pvApres: moi.pv });
  }

  // remplacement des deux côtés (zone + épines peuvent faire tomber l'un ou l'autre)
  verifierRemplacement(etat, adverse(cote), evts);
  verifierRemplacement(etat, cote, evts);
}

// Étourdissement : un seul endroit (l'immunité 🔔 Grelot / ❄️ passifs y est honorée,
// et `insensible` bloque la pose via poserStatut).
function etourdir(cible: Combattant, cibleCote: CoteCombat, evts: EvtCombat[]) {
  if (cible.eff.immuniteEtourdi) {
    evts.push({ t: 'statut', cote: cibleCote, cle: 'immunite-etourdi', texte: `${cible.nom} est insensible à l'étourdissement ! ❄️` });
    return;
  }
  if (poserStatut(cible, 'etourdi', 1)) {
    evts.push({ t: 'statut', cote: cibleCote, cle: 'pose-etourdi', texte: `${cible.nom} est étourdi ! 💫` });
  } else {
    evts.push({ t: 'statut', cote: cibleCote, cle: 'insensible', texte: `${cible.nom} est INSENSIBLE : rien ne l'atteint ! 🪨` });
  }
}

// Pose générique journalisée (payload de signature). Un seul libellé pour 13 statuts :
// c'est INFOS_STATUT qui porte le texte, donc ajouter un statut n'ajoute aucun `if`.
function poserStatutJournalise(
  c: Combattant, cote: CoteCombat, def: { id: StatutId; tours: number; piles?: number }, evts: EvtCombat[],
) {
  const piles = Math.max(1, def.piles ?? 1);
  let pose = false;
  for (let n = 0; n < piles; n++) pose = poserStatut(c, def.id, def.tours, undefined, piles) || pose;
  const info = INFOS_STATUT[def.id];
  if (pose) evts.push({ t: 'statut', cote, cle: `pose-${def.id}`, texte: `${c.nom} : ${info.nom} ${info.emoji}` });
  else evts.push({ t: 'statut', cote, cle: 'insensible', texte: `${c.nom} est INSENSIBLE : rien ne l'atteint ! 🪨` });
}

// Action du joueur : attaque, Signature, Garde, changement actif, ou consommable.
// 🔧 §A2 — `puis` (OPTIONNEL) est le changement de règle décisif : `{ changer }` et
// `{ objet }` ne consomment PLUS le tour, ils coûtent de l'énergie et laissent l'action
// d'attaque jouable. Sans `puis`, le comportement historique est conservé à l'identique
// (le tour passe) : compatibilité totale avec les appelants existants.
export type ActionJoueur =
  | 0 | 1 | 'signature' | 'garde'
  | { changer: number; puis?: 0 | 1 | 'signature' | 'garde' }
  | { objet: ConsommableId; puis?: 0 | 1 | 'signature' | 'garde' };

export function preparerIntentionIA(etat: EtatCombat, rng: Rng = Math.random) {
  if (!etat.fini) etat.intentionB = choisirActionIA(etat, 'b', rng);
}

// Action que l'autre camp va jouer — utile à la parade anti-Signature. Côté b, on ne
// connaît que l'intention verrouillée ; côté a, l'information est passée explicitement.
function choixAdversePour(etat: EtatCombat, cote: CoteCombat): IntentionIA | undefined {
  return cote === 'b' ? undefined : etat.intentionB;
}

// 🔄 Contre-coup d'une parade PARFAITE (ou d'une signature `riposteAuto`) : frappe
// l'actif adverse APRÈS son action, par le pipeline unique.
function riposter(etat: EtatCombat, moi: Combattant, antiSignature: boolean, rng: Rng, evts: EvtCombat[]) {
  if (etat.fini) return;
  const cible = actif(etat, 'b');
  if (cible.pv <= 0) return;
  const indexCible = etat.actifs.b;
  evts.push({ t: 'riposte', cote: 'a', antiSignature });
  const mult = multType(moi.set, cible.set);
  const crit = rng() < RIPOSTE_CRIT;
  if (crit) evts.push({ t: 'statut', cote: 'a', cle: 'critique', texte: 'Coup critique ! 💥' });
  const brut = moi.atk * RIPOSTE_PCT * mult * multAtkStatuts(moi) * (crit ? 1.5 : 1) * (0.9 + rng() * 0.2);
  resoudreImpact(etat, moi, cible, 'b', indexCible, brut, 'riposte', {}, evts);
  verifierRemplacement(etat, 'b', evts);
  // 🩹 26/07 — LE CAMP 'a' AUSSI : un contre-coup peut tuer SON PROPRE AUTEUR par les
  // 🌵 épines de la cible (passif « Acide » de Citro, Couvercle à Épines). `riposter` est
  // appelé par `declencherRiposteArmee`, qui passe APRÈS tous les `finDeTour` du round :
  // sans ce contrôle, plus personne ne relevait le cadavre. Il restait « actif » → l'action
  // du joueur au round suivant était jetée, l'événement `ko` ré-émis (cinématique rejouée)
  // et `ENERGIE_KO` crédité deux fois ; sur la dernière carte, aucun `fin` n'était émis.
  verifierRemplacement(etat, 'a', evts);
}

// Joue un round complet : les deux camps agissent dans l'ordre de VIT.
// `choixA` = action du joueur ; le camp b joue à l'IA (ou `choixB`).
// `timingA` = résultat de la jauge tap-parfait du joueur (attaque, Signature ou Garde).
// `comboA` = PARFAITS en banque AVANT cette action ; s'il est omis, `etat.combo` fait foi.
export function jouerRound(
  etat: EtatCombat, choixA: ActionJoueur, rng: Rng = Math.random,
  choixB?: 0 | 1 | 'signature', timingA?: Timing, comboA?: number,
): EvtCombat[] {
  if (etat.fini) return [];
  const evts: EvtCombat[] = [];
  etat.round++;
  // ⚡ A2 — revenu de round pour les DEUX camps, puis prime de skill du joueur.
  gagnerEnergie(etat, 'a', ENERGIE_PAR_ROUND);
  gagnerEnergie(etat, 'b', ENERGIE_PAR_ROUND);
  if (timingA === 'parfait') gagnerEnergie(etat, 'a', ENERGIE_PARFAIT);
  // cooldown de Garde : les DEUX camps, maintenant que l'IA garde aussi (§A7)
  for (const cote of ['a', 'b'] as CoteCombat[]) {
    const c = actif(etat, cote);
    if (c.gardeCooldown > 0) c.gardeCooldown--;
  }
  const cb = choixB ?? etat.intentionB;
  const combo = comboA ?? etat.combo;
  // ⚡ l'action de b est ENGAGÉE pour ce round : son coût est protégé du vol d'énergie
  // jusqu'à ce qu'elle soit jouée (cf. `energieReservee`).
  etat.intentionBEngagee = cb;
  const finirRound = () => {
    // ⚡ le combo vit désormais dans le moteur : un PARFAIT capitalise, un RATÉ casse.
    etat.combo = timingA === 'parfait' ? Math.min(COMBO_PARFAIT_MAX, combo + 1)
      : timingA === 'rate' ? 0 : combo;
    // ⚡ filet : si b n'a pas pu agir (K.O., combat terminé), la réserve tombe quand même.
    etat.intentionBEngagee = null;
    preparerIntentionIA(etat, rng);
  };

  // --- Préfixe 🔄 changement / 🎒 consommable ------------------------------------------
  let action: 0 | 1 | 'signature' | 'garde' | null = null;
  let tourConsommeParPrefixe = false;
  if (typeof choixA === 'object') {
    if ('changer' in choixA) {
      appliquerChangement(etat, 'a', choixA.changer, evts);
    } else {
      jouerConsommable(etat, choixA.objet, evts);
    }
    if (choixA.puis !== undefined) action = choixA.puis;
    else tourConsommeParPrefixe = true;
  } else {
    action = choixA;
  }

  // Ancien comportement (aucun `puis`) : le joueur a payé son tour, b frappe.
  if (tourConsommeParPrefixe) {
    // 🩹 26/07 — la carte qui tique est celle PRÉSENTE sur le terrain à la fin du tour
    // (après un changement, c'est l'entrante — même règle que pour une attaque).
    const finA = actif(etat, 'a');
    const idxFinA = etat.actifs.a;
    if (!etat.fini) agir(etat, 'b', cb, rng, evts);
    if (!etat.fini) finDeTour(etat, finA, 'a', idxFinA, evts); // pas d'événement après `fin`
    if (!etat.fini) declencherRiposteArmee(etat, rng, evts);
    finirRound();
    return evts;
  }

  // --- 🛡️ Garde universelle : lisible grâce à l'intention ennemie, mais bornée par un
  // cooldown pour ne pas remplacer les vrais personnages défensifs.
  if (action === 'garde') {
    const moi = actif(etat, 'a');
    const idxMoi = etat.actifs.a; // 🩹 26/07 — mémorisé pour le tick de fin de tour
    if (moi.gardeCooldown <= 0) {
      const { parfaite, antiSignature } = appliquerGarde(etat, 'a', evts, timingA, cb);
      if (!etat.fini) agir(etat, 'b', cb, rng, evts);
      // ⚡ A2 — Garde « gâchée » : l'adversaire n'a pas attaqué → remboursement, pour que
      // parer une intention défensive ne soit jamais un tour perdu sec.
      if (!actionOffensive(etat.equipes.b[etat.actifs.b], cb)) {
        gagnerEnergie(etat, 'a', ENERGIE_GARDE_GACHEE);
        evts.push({ t: 'statut', cote: 'a', cle: 'garde-gachee', texte: `Garde dans le vide : +${ENERGIE_GARDE_GACHEE} ⚡ !` });
      }
      // 🔄 RIPOSTE : le contre-coup part après l'impact encaissé. Une parade parfaite
      // riposte même si l'adversaire n'a pas attaqué — le contre-coup est sa prime.
      if (parfaite && !etat.fini && moi.pv > 0) riposter(etat, moi, antiSignature, rng, evts);
      if (!etat.fini) declencherRiposteArmee(etat, rng, evts);
      // 🩹 26/07 — tick de fin de tour du camp a : cette branche ne passe pas par agir().
      // APRÈS la riposte (pour qu'elle profite encore du boost) et sauté si le combat est
      // terminé, pour ne pas émettre d'événement après le `fin`.
      if (!etat.fini) finDeTour(etat, moi, 'a', idxMoi, evts);
      finirRound();
      return evts;
    }
    action = 0; // cooldown non écoulé → attaque de base : agir() jouera le tick lui-même
  }

  // ⏳ Sablier / panoplie Sucré : agit en premier au 1er round (gros bonus de VIT ponctuel)
  const vitBonus = (c: Combattant) => (etat.round === 1 && c.eff.agitPremier ? 1000 : 0);
  const ca = actif(etat, 'a'); const cbt = actif(etat, 'b');
  // 🏷️ trait `rapide` : +6 VIT pour l'ordre de CE round seulement
  const rapide = (c: Combattant, choix: IntentionIA | 0 | 1 | 'signature' | 'garde' | null) =>
    typeof choix === 'number' && traitsDe(c, choix).includes('rapide');
  const vitA = vitEffective(ca, rapide(ca, action)) + vitBonus(ca);
  const vitB = vitEffective(cbt, rapide(cbt, cb)) + vitBonus(cbt);
  const premier: CoteCombat = vitA === vitB ? (rng() < 0.5 ? 'a' : 'b') : vitA > vitB ? 'a' : 'b';
  const ordre: CoteCombat[] = premier === 'a' ? ['a', 'b'] : ['b', 'a'];
  // À ce stade `action` n'est plus jamais 'garde' : la branche ci-dessus l'a soit jouée
  // (avec un `return`), soit repliée sur l'attaque de base (cooldown non écoulé).
  const actionJouee: 0 | 1 | 'signature' = (action ?? 0) as 0 | 1 | 'signature';
  for (const cote of ordre) {
    if (etat.fini) break;
    agir(etat, cote, cote === 'a' ? actionJouee : cb, rng, evts,
      cote === 'a' ? timingA : undefined, cote === 'a' ? combo : 0);
  }
  // ⚡ Garde gâchée du camp b (l'IA a paré une action non offensive du joueur)
  if (!etat.fini && cb === 'garde' && !actionOffensive(etat.equipes.a[etat.actifs.a], actionJouee)) {
    gagnerEnergie(etat, 'b', ENERGIE_GARDE_GACHEE);
  }
  if (!etat.fini) declencherRiposteArmee(etat, rng, evts);
  finirRound();
  return evts;
}

// 🔄 Contre-coup armé par une signature (`riposteAuto`) : joué en fin de round, une
// seule fois. CÔTÉ JOUEUR uniquement — l'IA ne riposte jamais (§0.9).
function declencherRiposteArmee(etat: EtatCombat, rng: Rng, evts: EvtCombat[]) {
  const moi = actif(etat, 'a');
  if (!moi.riposteArmee) return;
  moi.riposteArmee = false;
  if (moi.pv > 0) riposter(etat, moi, false, rng, evts);
}

// 🎒 Consommable joué sur l'actif (ou dégâts directs à l'adversaire), payé en énergie.
// Un consommable impayable est simplement IGNORÉ (l'objet n'est pas consommé côté store :
// c'est l'UI qui décide de l'afficher grisé, à partir de COUT_OBJET).
function jouerConsommable(etat: EtatCombat, id: ConsommableId, evts: EvtCombat[]) {
  const conso = CONSOMMABLES[id];
  if (!conso) return;
  if (!payerEnergie(etat, 'a', COUT_OBJET)) return;
  const moi = actif(etat, 'a');
  const idxMoi = etat.actifs.a;
  const e = conso.effet;
  evts.push({ t: 'annonce', cote: 'a', texte: `${moi.nom} utilise ${conso.nom} !`, cle: 'objet' });
  if (e.soinPct) {
    // 🩹 26/07 — `soinMult` (mutateur « Sucre amer ») manquait : le soin d'un
    // consommable échappait au « soins réduits de moitié ».
    const g = appliquerSoin(moi, moi.pvMax * e.soinPct / 100 * (etat.mutateur?.soinMult ?? 1)); // 💧 fatigue
    evts.push({ t: 'soin', cote: 'a', index: idxMoi, valeur: g, pvApres: moi.pv });
  }
  if (e.retireEtourdi && aStatut(moi, 'etourdi')) {
    retirerStatut(moi, 'etourdi');
    evts.push({ t: 'statut', cote: 'a', cle: 'retire-etourdi', texte: `${moi.nom} retrouve ses esprits ! 🌿` });
  }
  // 🩹 26/07 — 3 (et non 2) : décrémenté en fin de CETTE action → effectif 2 tours,
  // comme l'attaque `boost` (la promesse du Boost Énergie).
  if (e.boost) {
    poserStatut(moi, 'boost', 3);
    evts.push({ t: 'statut', cote: 'a', cle: 'boost', texte: `${moi.nom} déborde d'énergie ! (+40 % ATQ) ⚡` });
  }
  if (e.bouclier) {
    poserStatut(moi, 'bouclier', -1);
    evts.push({ t: 'statut', cote: 'a', cle: 'bouclier', texte: `${moi.nom} se protège ! 🛡️` });
  }
  if (e.degatsEnnemi) {
    const cible = actif(etat, 'b');
    const idxCible = etat.actifs.b;
    // 🩹 26/07 — `degatsMult` (« Verre fin ») et `reviveDispo` (🧿 Grigri) sautaient les
    // consommables : le pipeline unique les honore désormais tous les deux.
    // `sansDefenses: false` — SEUL dégât secondaire à garder les défenses : le joueur le
    // vise et le paie 2 ⚡, c'est SON attaque de ce tour. Un objet imparable rendrait le
    // bouclier et la Garde inutiles contre lui, et le ×1,35 du ❄️ Givré est ici un vrai
    // pay-off (30 → 41), pas un gaspillage.
    encaisserDegats(etat, cible, 'b', idxCible, e.degatsEnnemi, evts, false);
    verifierRemplacement(etat, 'b', evts);
  }
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

// 🩹 26/07 — les tirages PNJ ignoraient totalement BUDGET_EQUIPE : rang 10 → équipe à
// 9 points, rang 15 → 9, rang 30 → 8, alors que le joueur est plafonné à 7. Tous les
// PNJ passent par ici (adversairePNJ, adversaireTournoi, equipeSam, equipeAmi), donc on
// corrige à la source : boucle de REJET bornée, puis repli DÉTERMINISTE (les 3 cartes
// les moins chères du pool, ordre du pool = stable) pour garantir la terminaison.
export const TIRAGES_MAX_BUDGET = 60; // essais avant repli déterministe
function equipeAleatoire(pool: string[], rng: Rng): string[] {
  // Coût plancher du pool = les 3 cartes les moins chères qu'il contient. Certains pools
  // ne peuvent PAS produire d'équipe à 7 (la finale du tournoi n'aligne qu'épiques et
  // légendaires, soit 9 au minimum) : on vise alors le dépassement MINIMAL plutôt que de
  // laisser passer un tirage libre à 12 points.
  const parCout = [...pool].map((id, i) => ({ id, i, c: coutCarte(id) }))
    .sort((x, y) => (x.c - y.c) || (x.i - y.i)); // sort STABLE → repli déterministe
  const coutPlancher = parCout.slice(0, 3).reduce((s, x) => s + x.c, 0);
  const plafond = Math.max(BUDGET_EQUIPE, coutPlancher);
  for (let essai = 0; essai < TIRAGES_MAX_BUDGET; essai++) {
    const ids: string[] = [];
    // garde-fou : un pool de moins de 3 ids distincts bouclait à l'infini ici
    for (let i = 0; i < 200 && ids.length < 3; i++) {
      const id = pool[Math.floor(rng() * pool.length)];
      if (!ids.includes(id)) ids.push(id);
    }
    if (ids.length === 3 && coutEquipe(ids) <= plafond) return ids;
  }
  return parCout.slice(0, 3).map((x) => x.id); // repli déterministe, terminaison garantie
}

// 🩹 26/07 — CHAMPIONS DE TOURNOI : tête d'affiche + remplissage LÉGAL.
// Le correctif du budget avait un effet de bord : les pools des demies et de la finale
// n'alignaient QUE des épiques (3) et des légendaires (4), soit 9 points au minimum —
// aucune équipe de 3 n'y était légale sous BUDGET_EQUIPE (7). Le tirage retombait sur le
// dépassement minimal, et la finale n'avait plus qu'UNE composition possible (3 épiques),
// donc plus aucun légendaire en finale : le tournoi perdait à la fois sa légalité et son
// prestige. On compose désormais autour d'une TÊTE D'AFFICHE de la rareté voulue, puis on
// remplit les 2 emplacements restants avec les cartes les plus chères qui tiennent dans le
// budget restant — sans jamais dépasser la rareté de la tête d'affiche, pour qu'elle reste
// la star. Résultat : toujours ≤ 7 points, toujours un légendaire en finale.
export function equipeTeteAffiche(rareteTete: Rarete, rng: Rng): string[] {
  const ordre: Rarete[] = ['legendaire', 'epique', 'rare', 'commun'];
  const poolTete = IDS_PAR_RARETE[rareteTete];
  const ids = [poolTete[Math.floor(rng() * poolTete.length)]];
  let reste = BUDGET_EQUIPE - coutCarte(ids[0]);
  for (let slot = 0; slot < 2; slot++) {
    const aRemplirApres = 1 - slot;                 // emplacements encore vides ensuite
    const max = reste - aRemplirApres;              // laisser 1 point par emplacement restant
    // la plus chère rareté qui tient, plafonnée par celle de la tête d'affiche
    // le coût est monotone avec la rareté (1/2/3/4) : le comparer suffit, pas besoin
    // d'importer RARETES ici.
    const coutTete = coutCarte(ids[0]);
    const rarete = ordre.find((r) => {
      const c = coutCarte(IDS_PAR_RARETE[r][0]);
      return c <= max && c <= coutTete;
    });
    if (!rarete) break;
    const candidats = IDS_PAR_RARETE[rarete].filter((id) => !ids.includes(id));
    if (!candidats.length) break;
    const choix = candidats[Math.floor(rng() * candidats.length)];
    ids.push(choix);
    reste -= coutCarte(choix);
  }
  // filet : si un pool épuisé a empêché de remplir, on complète avec des communes
  for (const id of IDS_PAR_RARETE.commun) {
    if (ids.length >= 3) break;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids.slice(0, 3);
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
  // 🩹 26/07 — l'escalade du tournoi passe désormais par la RARETÉ DE LA TÊTE D'AFFICHE
  // (cf. equipeTeteAffiche) au lieu de pools qui rendaient toute équipe illégale :
  // quart = champion RARE · demie = champion ÉPIQUE · FINALE = champion LÉGENDAIRE.
  // La montée en puissance reste portée par l'échelle (1,00 → 1,12 → 1,25) et par
  // l'équipement (0 → 2 → 3 objets), comme avant.
  const teteAffiche: Rarete[] = ['rare', 'epique', 'legendaire'];
  const echelles = [1.0, 1.12, 1.25];
  const ids = equipeTeteAffiche(teteAffiche[Math.min(etape, 2)], rng);
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

// --- 🏆 Récompenses de l'Arène (équilibrage « Normal ») -------------------------------
// 🔧 RÉÉQUILIBRAGE 27/07 — « les combats ne paient pas assez face au jeu des billes ».
//
// LE DIAGNOSTIC, MESURÉ. L'ancienne formule était `Math.min(200 + rang * 45, 700)` : le
// plafond mordait dès le RANG 12 et une victoire ne progressait plus JAMAIS ensuite.
// Or l'Arène ne s'arrête pas au rang 12. Mesuré sur 40 à 60 combats seedés par rang
// (harnais hors dépôt, équipes du joueur LÉGALES au regard de BUDGET_EQUIPE = 7, IA des
// deux côtés pour ne pas surestimer le joueur) :
//   · 3 rares nv4        → 90 % de victoires au rang 10, mur au rang 12
//   · 2 épiques + 1 commun nv7 → 88 % au rang 12, 73 % au 15, 77 % au 18, 83 % au 22
//   · légendaire+rare+commun nv10 + objets légendaires → 100 % jusqu'au rang 45, 53 % au 50
// Autrement dit les rangs 12 à 50 sont du contenu RÉELLEMENT joué, qui payait exactement
// comme le rang 12. Le « mur » ressenti par le commanditaire était donc structurel, et il
// tombait pile là où le joueur investi passe l'essentiel de sa vie de compte.
//
// LA COURBE RETENUE. La rampe linéaire historique est CONSERVÉE À L'IDENTIQUE jusqu'au
// rang ARENE_RANG_LINEAIRE : les rangs 1 à 11 ne bougent pas d'une perle (l'entrée de jeu
// n'est pas inflatée, et le farm du bas de tableau n'est pas rendu plus rentable). Au-delà,
// la progression CONTINUE mais RALENTIT : chaque tranche de ARENE_DEMI_RANGS rangs comble
// la moitié de ce qui reste jusqu'à l'asymptote. Deux propriétés, voulues toutes les deux :
//   · strictement croissante — plus jamais de mur, monter en rang paie TOUJOURS ;
//   · bornée PAR CONSTRUCTION — `recompenseRang` ne peut mathématiquement pas dépasser
//     ARENE_PERLES_ASYMPTOTE, exactement comme l'ancien `Math.min` bornait à 700.
//     L'Arène est le SEUL mode sans plafond FINAL sur les multiplicateurs (perlesEvenement
//     ×5,2 × multSerieVictoires ×1,6 = ×8,32, là où le shooter est borné par
//     PERLES_MAX_FINAL) : cette borne dure n'est pas négociable. On DÉPLACE le plafond,
//     on ne le supprime pas — le sommet ne bouge que d'un facteur 1,43, connu et fini.
export const ARENE_PERLES_BASE = 200;      // inchangé
export const ARENE_PERLES_PAR_RANG = 45;   // inchangé
// Fin de la rampe linéaire. 13 et pas 11 (fin naturelle de l'ancienne rampe) parce que
// 200 + 13×45 = 785 : c'est le socle qui, additionné à la valeur-perles des capsules du
// nouveau rythme (mesurée à 405/victoire sur 20 victoires, cf. plus bas), amène la
// victoire d'Arène à parité avec un niveau d'Aventure neuf (650 perles + 575 de capsules
// = 1 225). La courbe franchit ces 1 225 au rang 15 — exactement la bande où le joueur
// investi vit (73-88 % de victoires du rang 12 au rang 25, mesuré).
export const ARENE_RANG_LINEAIRE = 13;
// Borne dure de la fonction. 1 000 laisse de la marge aux rangs 30-50 que le compte
// maximal atteint réellement (mesuré 80-100 % de victoires), tout en gardant CHAQUE rang
// accessible sous +32 % de l'ancien plafond (rang 25 = 925). Le sommet théorique passe
// donc de 700×8,32 = 5 824 à 1 000×8,32 = 8 320 perles, et cette dernière valeur exige
// ~50 montées de rang consécutives : le sommet est déplacé, jamais ouvert.
export const ARENE_PERLES_ASYMPTOTE = 1000;
// Demi-vie de la montée résiduelle, en rangs. 8 fait tomber le premier demi-pas au rang 21
// (885 perles) : la progression reste VISIBLE sur toute la bande 13-25 (+140 perles), qui
// est justement celle du joueur investi. Plus court, la courbe s'aplatirait DANS la bande
// jouée (le mur reviendrait, juste déplacé) ; plus long, elle paierait trop haut aux rangs
// 30-50 que le compte maximal enchaîne.
export const ARENE_DEMI_RANGS = 8;
// 🎁 RYTHME DES CAPSULES — l'écart le plus gros, et le plus invisible.
// AVANT : classique au rang %5, dorée au rang %10. Sur 20 victoires (rangs 1→20) :
// 2 classiques + 2 dorées = 2×700 + 2×2 000 = 5 400 perles de valeur, soit 270/victoire.
// Le shooter, lui, donne une classique tous les 3 niveaux et une DORÉE à chaque boss
// (tous les 5) : sur 20 niveaux neufs, 5 classiques + 4 dorées = 11 500, soit 575/niveau.
// L'Arène rendait donc 2,1 fois moins de capsules que le shooter à nombre de combats égal
// — 305 perles de valeur cachée perdues par victoire, plus que l'écart en perles lui-même.
// APRÈS : classique tous les 3 rangs, dorée tous les 6 (même structure que le shooter, où
// la dorée du boss l'emporte sur la classique du multiple de 3). Sur 20 victoires :
// 3 classiques + 3 dorées = 8 100, soit 405/victoire. On referme l'écart à 70 % du rythme
// du shooter SANS l'égaler : la dorée reste tous les 6 rangs contre 5 niveaux, et un rang
// coûte plus d'un combat dès que le taux de victoire décroche. La capsule d'Arène reste
// donc un événement, pas un tapis roulant.
export const ARENE_CAPSULE_RYTHME = 3;
export const ARENE_CAPSULE_DOREE_RYTHME = 6;

// 🛡️ 27/07 — UN RANG NON NUMÉRIQUE NE DOIT PLUS TRAVERSER LA FONCTION.
// `Math.max(1, Math.round(rang))` avait l'AIR d'un garde-fou : il ramène bien un rang
// nul, négatif ou fractionnaire sur le rang 1. Mais `Math.max(1, NaN)` vaut NaN — un
// rang non numérique ressortait donc en NaN, et `victoireArene` faisait `etat.perles +=
// NaN`. Le solde devenait NaN DÉFINITIVEMENT, puis partait au serveur en `perles: null`
// (JSON n'a pas de NaN) pendant qu'`etatEstVierge` déclarait le compte « vierge » (NaN
// > 0 est faux) : la progression du joueur était écrasée sans le moindre message.
// On COERCE d'abord (une sauvegarde qui porte "12" garde son rang 12 : on n'assainit
// jamais au prix d'une donnée légitime), puis on REFUSE le non fini — repli sur le rang
// 1, exactement là où retombent déjà les rangs sales numériques.
// Le même trou, et le même correctif, dans `perlesVictoireTournee` (tournee.ts).
function rangSur(rang: number): number {
  const n = Number(rang);
  return Number.isFinite(n) ? Math.max(1, Math.round(n)) : 1;
}

export function recompenseRang(rang: number): { perles: number; capsule: 'classique' | 'doree' | null } {
  const r = rangSur(rang);
  const socle = ARENE_PERLES_BASE + ARENE_RANG_LINEAIRE * ARENE_PERLES_PAR_RANG;
  let perles: number;
  if (r <= ARENE_RANG_LINEAIRE) {
    perles = ARENE_PERLES_BASE + r * ARENE_PERLES_PAR_RANG; // rangs 1-13 : rampe historique
  } else {
    // Montée résiduelle à demi-vie : il reste toujours quelque chose à gagner, et la
    // somme ne franchit jamais l'asymptote.
    // Arrondi À L'UNITÉ, et non à la dizaine de 5 pourtant plus jolie à afficher : arrondir
    // à 5 recollait déjà les rangs 32 et 33 sur la même valeur (960), c'est-à-dire un mur —
    // minuscule, mais un mur — au beau milieu des rangs 30-45 que le compte maximal enchaîne
    // à 80-100 % de victoires (mesuré). À l'unité, la courbe est STRICTEMENT croissante
    // jusqu'au rang 48 (premier palier d'arrondi : 48 et 49 à 990 perles), quand ce même
    // compte maximal décroche déjà à 53 % de victoires au rang 50 : le palier d'arrondi
    // tombe donc hors de portée réelle, ce que l'ancien plafond à 700 ne faisait pas.
    const reste = ARENE_PERLES_ASYMPTOTE - socle;
    const comble = 1 - Math.pow(2, -(r - ARENE_RANG_LINEAIRE) / ARENE_DEMI_RANGS);
    perles = Math.round(socle + reste * comble);
  }
  const capsule = r % ARENE_CAPSULE_DOREE_RYTHME === 0 ? 'doree'
    : r % ARENE_CAPSULE_RYTHME === 0 ? 'classique' : null;
  return { perles, capsule };
}

// 💔 Consolation de défaite. VOLONTAIREMENT laissée à 45 et VOLONTAIREMENT non indexée sur
// le rang : une consolation qui monterait avec le rang serait farmable en concédant
// instantanément au rang le plus haut atteint (l'abandon d'un duel passe par le même
// chemin que la défaite dans le store). En la laissant fixe pendant que les victoires
// montent, on rend la défaite RELATIVEMENT moins rentable qu'avant — 45/700 = 6,4 % de la
// victoire hier, 45/925 = 4,9 % au rang 25 aujourd'hui : l'écart entre gagner et perdre
// s'élargit, ce qui est exactement le sens voulu.
export const PERLES_DEFAITE_ARENE = 45;
export const MISES_DUEL_PAR_JOUR = 3;
