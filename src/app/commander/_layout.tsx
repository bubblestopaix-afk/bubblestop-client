// Commande en ligne retirée de l'app le 15/07/2026.
// Ce garde-route bloque aussi les anciens favoris, historiques et deep links vers
// /commander, /commander/panier, /commander/mes-commandes, etc.
import { Redirect } from 'expo-router';

export default function CommanderLayout() {
  return <Redirect href="/" />;
}
