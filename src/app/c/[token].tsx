import { useLocalSearchParams } from 'expo-router';
import ReclamerCarte from '@/components/reclamer-carte';

// Route DYNAMIQUE /c/<jeton> — atteinte en navigation interne (le QR de la borne utilise /c?t=).
export default function ReclamerCarteParChemin() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  return <ReclamerCarte token={String(token || '')} />;
}
