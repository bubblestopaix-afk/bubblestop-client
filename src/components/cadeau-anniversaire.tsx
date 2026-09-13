import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { C, F } from '@/constants/charte';
import { CONDITION_ANNIVERSAIRE, dateCadeau } from '@/lib/anniversaire';
import { useAnniversaire } from '@/lib/use-anniversaire';

export default function CadeauAnniversaire({ discret = false, solde }: { discret?: boolean; solde?: number }) {
  const { cadeau, erreur } = useAnniversaire(solde);
  const Bloc = discret ? View : Pressable;
  if (cadeau?.statut === 'disponible' && solde !== 0) return (
    <Bloc accessibilityRole={discret ? undefined : "button"} onPress={discret ? undefined : () => router.push('/explore')}
      accessibilityLabel="Mon cadeau anniversaire, voir ma carte fidélité" style={styles.cadeau}>
      <Text style={styles.titre}>🎂 Ta boisson L d’anniversaire est offerte !</Text>
      <Text style={styles.texte}>Présente ton QR en caisse jusqu’au {dateCadeau(cadeau.expireLe)} inclus. M pour Signature.</Text>
      {discret && <Text style={styles.texte}>{CONDITION_ANNIVERSAIRE}</Text>}
      {!discret && <Text style={styles.lien}>Voir ma carte fidélité →</Text>}
    </Bloc>
  );
  if (!discret) return null;
  return (
    <View style={styles.conditions}>
      <Text style={styles.sousTitre}>🎂 Ton cadeau d’anniversaire</Text>
      <Text style={styles.texte}>{CONDITION_ANNIVERSAIRE}</Text>
      {cadeau?.statut === 'conditions' && <Text style={styles.texte}>
        {cadeau.boissons}/5 boissons payées confirmées sur les 12 derniers mois. La condition sera vérifiée le jour de ton anniversaire.
      </Text>}
      {erreur && <Text style={styles.texte}>Le suivi de ton cadeau est momentanément indisponible.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  cadeau: { backgroundColor: '#FDEFF6', borderColor: '#DBBAD9', borderWidth: 1, borderRadius: 20, padding: 16, gap: 7 },
  conditions: { paddingVertical: 12, paddingHorizontal: 5, gap: 6 },
  titre: { fontFamily: F.titre, fontSize: 18, color: C.violet },
  sousTitre: { fontFamily: F.t600, fontSize: 14, color: C.violet },
  texte: { fontFamily: F.t400, fontSize: 13, lineHeight: 19, color: '#5C5069' },
  lien: { fontFamily: F.t600, fontSize: 14, color: C.violet },
});
