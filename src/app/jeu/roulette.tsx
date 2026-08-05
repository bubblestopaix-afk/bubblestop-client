// === /jeu/roulette — garde-route (03/08/2026) ===
// La Roue du Mois a quitté Boba Quest : c'est un jeu autonome sur /roue (flag
// serveur `roue_du_mois`, carte dédiée sur l'accueil). Cette route ne rend PLUS
// l'ancienne roue ; elle redirige les anciens liens et habitudes vers le nouveau
// jeu. On garde le fichier (plutôt que le supprimer) pour qu'aucun vieux
// push('/jeu/roulette') — historique, notification, lien profond — ne tombe sur
// un écran 404 d'expo-router.
//
// L'ancien écran vivait ici (roue proportionnelle puis parts égales, cf.
// AGENTS.md « Roulette du mois : parts égales »). Son moteur (table ROULETTE
// d'economie.ts, tournerRoulette du store) reste dans le code pour la compat des
// sauvegardes : `derniereRouletteMois` continue d'être migré, simplement plus
// jamais alimenté par une UI.
import { Redirect } from 'expo-router';

export default function AncienneRouletteVersRoue() {
  return <Redirect href={'/roue' as any} />;
}
