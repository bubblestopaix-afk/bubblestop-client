import { Redirect } from 'expo-router';

// Compatibilité avec les anciens liens /c/<jeton> : la fonctionnalité n'est plus proposée.
export default function AncienLienCarteRetireDynamique() {
  return <Redirect href="/explore" />;
}
