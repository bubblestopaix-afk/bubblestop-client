// === 🧋 Détection des VRAIES visites en boutique (Gorgée Fraîche, 26/07/2026) ===
// Module AUTONOME, volontairement hors du store du jeu : l'accueil de l'app
// (`app/index.tsx`) doit pouvoir constater une visite sans importer `@/store/jeu`.
// Cet invariant compte — seuls les écrans `app/jeu/*` importent le store, ce qui garantit
// qu'aucune mutation ne peut précéder l'hydratation et rend sûr le fail-closed de
// `app/jeu/_layout.tsx`.
//
// Ce module ne fait QUE détecter et mettre de côté. C'est le jeu qui récompense, quand le
// joueur ouvre Boba Quest (`consommerVisites()` côté store).
//
// Toute la logique de calcul est PURE et vit dans `components/jeu/economie.ts`
// (`suiviApresConstat`, `totalTamponsMonotone`, `tamponsIssusDuJeu`) — donc testée par
// `npm run test:jeu` sans dépendre d'AsyncStorage ni du réseau.
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  migrerSuiviTampons, suiviApresConstat, SUIVI_TAMPONS_VIERGE, tamponsIssusDuJeu,
  totalTamponsMonotone, type SuiviTampons,
} from '@/components/jeu/economie';
import { chargerDemandesRecompensesJeu } from '@/lib/recompenses-jeu';

const CLE = 'bobaQuest.visites';

let suivi: SuiviTampons = { ...SUIVI_TAMPONS_VIERGE };
let charge = false;
let file: Promise<void> = Promise.resolve();

async function assurerCharge(): Promise<void> {
  if (charge) return;
  try {
    const brut = await AsyncStorage.getItem(CLE);
    suivi = migrerSuiviTampons(brut ? JSON.parse(brut) : null);
  } catch {
    suivi = { ...SUIVI_TAMPONS_VIERGE }; // illisible → on repart d'un calibrage
  }
  charge = true;
}

function ecrire(): void {
  const serialise = JSON.stringify(suivi);
  file = file.catch(() => {}).then(() => AsyncStorage.setItem(CLE, serialise)).catch(() => {});
}

/**
 * Constate le compteur de fidélité et met de côté les achats RÉELS détectés.
 *
 * Appelé par l'accueil à chaque lecture de `fidelite_cloud`, donc toutes les 15 s :
 * volontairement idempotent et SILENCIEUX tant que rien ne monte. Le coûteux (lecture des
 * récompenses de jeu côté serveur) n'a lieu QUE quand le total monotone a réellement
 * augmenté — sinon on ferait un appel réseau toutes les 15 s pour rien.
 *
 * `tampons` = compteur intra-carte (« n/9 »), `cartesCompletees` = cartes remplies.
 */
export async function constaterFidelite(tampons: unknown, cartesCompletees: unknown): Promise<void> {
  await assurerCharge();
  const total = totalTamponsMonotone(tampons, cartesCompletees);

  // rien de neuf : ni appel réseau, ni écriture disque
  if (suivi.amorce && total <= suivi.totalVu) return;

  // Le total a bougé. On lit la part imputable aux prix du jeu côté SERVEUR — source de
  // vérité, et immune à une réinstallation de l'app. Si la lecture échoue, on ne conclut
  // RIEN : mieux vaut réessayer au prochain poll que de récompenser un tampon de jeu.
  let totalJeu = suivi.totalJeuVu;
  try {
    totalJeu = tamponsIssusDuJeu(await chargerDemandesRecompensesJeu());
  } catch {
    if (suivi.amorce) return; // on retentera dans 15 s
  }

  const avant = suivi;
  suivi = suiviApresConstat(suivi, total, totalJeu);
  if (suivi.amorce !== avant.amorce || suivi.totalVu !== avant.totalVu
    || suivi.totalJeuVu !== avant.totalJeuVu || suivi.enAttente !== avant.enAttente) {
    ecrire();
  }
}

/** Boissons réelles détectées et pas encore récompensées (lecture seule). */
export async function visitesEnAttente(): Promise<number> {
  await assurerCharge();
  return suivi.enAttente;
}

/** Consomme les boissons en attente (le jeu vient de les récompenser). */
export async function consommerVisitesEnAttente(): Promise<number> {
  await assurerCharge();
  const n = suivi.enAttente;
  if (n > 0) { suivi = { ...suivi, enAttente: 0 }; ecrire(); }
  return n;
}

/** Remise à zéro complète — utilisée par le reset de progression en développement. */
export async function reinitialiserVisites(): Promise<void> {
  suivi = { ...SUIVI_TAMPONS_VIERGE };
  charge = true;
  ecrire();
}

/** État brut du suivi (diagnostic / écran admin). */
export async function etatSuiviVisites(): Promise<SuiviTampons> {
  await assurerCharge();
  return { ...suivi };
}
