// Le shooter repose sur Skia natif. Sur le web, on affiche une sortie propre au
// lieu de charger CanvasKit et d'exposer un écran d'erreur au joueur.
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, F, R, OMBRE } from '@/constants/charte';
import { BoutonJeu, EnTeteJeu, PictoHub } from '@/components/jeu/ui-jeu';

export default function ShooterWebFallback() {
  const insets = useSafeAreaInsets();
  const { niveau } = useLocalSearchParams<{ niveau?: string }>();
  const titre = niveau ? `Aventure · niveau ${niveau}` : 'Perle Rush';

  return (
    <View style={[styles.page, { paddingTop: insets.top + 14 }]}>
      <EnTeteJeu titre={titre} onRetour={() => router.back()} />
      <View style={styles.centre}>
        <View style={styles.carte}>
          <PictoHub id="jouer" fond={C.vertPale} taille={68} />
          <Text style={styles.titre}>Le tir se joue dans l’application</Text>
          <Text style={styles.texte}>
            Le lance-pierre et ses effets sont conçus pour l’application mobile.
            Retrouve ce mode sur iPhone ou Android pour jouer dans les meilleures conditions.
          </Text>
          <BoutonJeu
            titre="Retour à Boba Quest"
            onPress={() => router.replace('/jeu' as any)}
            style={styles.bouton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.fond, paddingHorizontal: 18, paddingBottom: 24 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  carte: {
    width: '100%', maxWidth: 440, alignItems: 'center', gap: 14,
    backgroundColor: C.carte, borderRadius: R.carte, padding: 24, ...OMBRE,
  },
  titre: { fontFamily: F.titre, fontSize: 22, color: C.violet, textAlign: 'center' },
  texte: { fontFamily: F.t600, fontSize: 14, lineHeight: 21, color: C.texte2, textAlign: 'center' },
  bouton: { alignSelf: 'stretch', marginTop: 4 },
});
