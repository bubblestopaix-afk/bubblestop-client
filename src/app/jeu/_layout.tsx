// Pile de navigation de Boba Quest : hub → shooter / capsules / collection / roulette / boutique
// 🕹️ GARDE : le jeu n'est accessible que si le flag serveur `app_config.jeu.actif` est vrai
// (ou pour un admin, qui le voit toujours pour tester). Flag coupé → retour accueil.
// L'état du joueur (perles, collection…) n'est pas touché : caché ≠ effacé.
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { C, F, R } from '@/constants/charte';
import { useJeuVisible } from '@/lib/app-config';
import { useHydratationBobaQuest } from '@/store/jeu';

export default function JeuLayout() {
  const { visible, charge } = useJeuVisible();
  const hydratation = useHydratationBobaQuest();
  // fail-closed : rien tant qu'on ne sait pas (cache/serveur), redirect si caché
  if (!visible) return charge ? <Redirect href={'/' as any} /> : null;
  if (hydratation === 'chargement') {
    return (
      <View style={styles.etat}>
        <ActivityIndicator color={C.violet} size="large" />
        <Text style={styles.titre}>Chargement de ta progression…</Text>
      </View>
    );
  }
  if (hydratation === 'erreur') {
    return (
      <View style={styles.etat}>
        <View style={styles.carteErreur}>
          <Text style={styles.titre}>Ta progression est protégée</Text>
          <Text style={styles.texte}>
            La sauvegarde locale ne peut pas être lue pour le moment. Ferme puis relance
            l’application : aucune nouvelle partie ne sera enregistrée par-dessus.
          </Text>
        </View>
      </View>
    );
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  etat: {
    flex: 1, backgroundColor: C.fond, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, gap: 16,
  },
  carteErreur: {
    width: '100%', maxWidth: 420, backgroundColor: C.carte, borderRadius: R.carte,
    padding: 22, gap: 10,
  },
  titre: { fontFamily: F.t800, fontSize: 18, color: C.violet, textAlign: 'center' },
  texte: { fontFamily: F.t600, fontSize: 14, lineHeight: 21, color: C.texte2, textAlign: 'center' },
});
