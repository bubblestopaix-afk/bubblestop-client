// === Écran d'accueil Bubblestop ===
import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';

const VIOLET = '#3A2A5E';
const VIOLET_PROFOND = '#2A1D46';
const VERT = '#A3C724';
const LAVANDE = '#EFE9F6';

export default function AccueilScreen() {
  // Offres actives publiées par la boutique
  const [offres, setOffres] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('offres')
      .select('id, titre, message')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setOffres(data ?? []));
  }, []);

  return (
    <View style={styles.fond}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.contenu}>
          <Text style={styles.logo}>BUBBLE STOP</Text>
          <Text style={styles.slogan}>Ton bubble tea préféré, dans ta poche 🧋</Text>

          {/* Action principale, comme toute app food : commander en 1 tap */}
          <Pressable style={styles.ctaCommander} onPress={() => router.push('/commander' as any)}>
            <Text style={styles.ctaCommanderTexte}>🧋 Commander</Text>
            <Text style={styles.ctaCommanderSous}>Retrait en boutique, sans attendre ›</Text>
          </Pressable>

          {/* Offres en cours (publiées depuis la caisse ou le compte admin) */}
          {offres.map((o) => (
            <View key={o.id} style={styles.offre}>
              <Text style={styles.offreTitre}>📣 {o.titre}</Text>
              <Text style={styles.offreMessage}>{o.message}</Text>
            </View>
          ))}

          {/* Raccourci fidélité (tap → onglet Fidélité) */}
          <Pressable style={styles.carte} onPress={() => router.push('/explore' as any)}>
            <Text style={styles.carteTitre}>🎁 Ta carte de fidélité</Text>
            <Text style={styles.carteTexte}>
              Ton QR code et tes tampons en direct : 9 boissons = 1 offerte ›
            </Text>
          </Pressable>

          <View style={styles.carte}>
            <Text style={styles.carteTitre}>Bientôt ici</Text>
            <Text style={styles.carteTexte}>• Paiement dans l'appli</Text>
            <Text style={styles.carteTexte}>• Notification quand ta commande est prête</Text>
            <Text style={styles.carteTexte}>• Offres et nouveautés en avant-première</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: VIOLET },
  offre: { backgroundColor: '#FFD166', borderRadius: 16, padding: 16, gap: 4 },
  offreTitre: { fontSize: 16, fontWeight: '900', color: VIOLET_PROFOND },
  offreMessage: { fontSize: 14, color: VIOLET_PROFOND, lineHeight: 20 },
  safe: { flex: 1 },
  contenu: { padding: 24, gap: 16 },
  logo: {
    fontSize: 34, fontWeight: '900', color: '#fff', textAlign: 'center',
    letterSpacing: 1, marginTop: 24,
  },
  slogan: { fontSize: 16, color: LAVANDE, textAlign: 'center', marginBottom: 12 },
  carte: { backgroundColor: '#fff', borderRadius: 18, padding: 20, gap: 8 },
  // Gros bouton « Commander » (action n°1 de l'app)
  ctaCommander: { backgroundColor: VERT, borderRadius: 18, padding: 22, alignItems: 'center', gap: 4 },
  ctaCommanderTexte: { fontSize: 22, fontWeight: '900', color: VIOLET_PROFOND },
  ctaCommanderSous: { fontSize: 14, color: VIOLET_PROFOND, opacity: 0.8 },
  carteTitre: { fontSize: 18, fontWeight: '800', color: VIOLET_PROFOND, marginBottom: 4 },
  carteTexte: { fontSize: 15, color: VIOLET_PROFOND, lineHeight: 22 },
});
