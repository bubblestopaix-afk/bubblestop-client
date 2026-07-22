import { Redirect } from 'expo-router';

// Ancienne fonctionnalité de carte retirée le 17/07/2026. Le garde protège les anciens QR,
// favoris et historiques de navigation sans exposer l'ancien écran.
export default function CLayout() {
  return <Redirect href="/explore" />;
}
