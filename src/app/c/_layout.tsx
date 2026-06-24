import { Stack } from 'expo-router';

// Pile dédiée à la réclamation d'une carte fidélité temporaire (lien /c/<jeton>), sans en-tête.
export default function CLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
