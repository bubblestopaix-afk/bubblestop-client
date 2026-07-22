import { Redirect } from 'expo-router';

// Compatibilité avec les anciens liens /c?t=… : la fonctionnalité n'est plus proposée.
export default function AncienLienCarteRetire() {
  return <Redirect href="/explore" />;
}
