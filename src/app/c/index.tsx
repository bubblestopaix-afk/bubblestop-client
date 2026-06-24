import { useLocalSearchParams } from 'expo-router';
import ReclamerCarte from '@/components/reclamer-carte';

// Route STATIQUE /c?t=<jeton> — c'est elle qu'utilise le QR de la borne (robuste en lien direct).
export default function ReclamerCarteParQuery() {
  const { t } = useLocalSearchParams<{ t?: string }>();
  return <ReclamerCarte token={String(t || '')} />;
}
