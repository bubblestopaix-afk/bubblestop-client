// Pile de navigation de l'onglet Commander :
// catégories → personnalisation → panier
import { Stack } from 'expo-router';

export default function CommanderLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
