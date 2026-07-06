// === Offres : les promos et annonces en cours (publiées par l'admin) ===
import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import RappelNotifs from '@/components/rappel-notifs';
import { C, F, R, OMBRE } from '@/constants/charte';

// "il y a 2 j" / "aujourd'hui" pour dater une offre
function depuis(dateIso: string): string {
  const jours = Math.floor((Date.now() - new Date(dateIso).getTime()) / 86400000);
  if (jours <= 0) return 'Aujourd\'hui';
  if (jours === 1) return 'Hier';
  return `Il y a ${jours} j`;
}

export default function OffresScreen() {
  const insets = useSafeAreaInsets();
  const [offres, setOffres] = useState<any[] | null>(null);
  const [refresh, setRefresh] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await supabase.from('offres')
      .select('id, titre, message, created_at')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(20);
    setOffres(data ?? []);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const tirer = async () => { setRefresh(true); await charger(); setRefresh(false); };

  return (
    <View style={styles.fond}>
      <ScrollView
        contentContainerStyle={[styles.contenu, { paddingTop: insets.top + 18 }]}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={tirer} tintColor={C.violet} />}>
        <Text style={styles.titre}>Offres</Text>
        <Text style={styles.sousTitre}>Les bons plans du moment, à montrer en caisse.</Text>

        {/* 🔔 Sans notifications activées, les promos passent à la trappe → rappel */}
        <RappelNotifs />

        {offres === null && <Text style={styles.vide}>Chargement…</Text>}

        {offres?.length === 0 && (
          <View style={styles.videCarte}>
            <Text style={styles.videEmoji}>🎁</Text>
            <Text style={styles.videTitre}>Pas d'offre en ce moment</Text>
            <Text style={styles.videTexte}>
              Reviens bientôt — les nouvelles offres et nouveautés apparaissent ici.
            </Text>
          </View>
        )}

        {offres?.map((o, i) => (
          <View key={o.id} style={[styles.offre, i === 0 && styles.offrePremiere]}>
            <View style={styles.offreHaut}>
              <Text style={[styles.offreTitre, i === 0 && { color: C.violetProfond }]}>{o.titre}</Text>
              <Text style={[styles.offreDate, i === 0 && { color: C.violetProfond, opacity: 0.6 }]}>{depuis(o.created_at)}</Text>
            </View>
            <Text style={[styles.offreMessage, i === 0 && { color: C.violetProfond, opacity: 0.85 }]}>{o.message}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  contenu: { padding: 18, gap: 12, paddingBottom: 32 },
  titre: { fontFamily: F.titre, fontSize: 26, color: C.violet },
  sousTitre: { fontFamily: F.t600, fontSize: 14, color: C.texte2, marginTop: -6 },

  vide: { fontFamily: F.t600, fontSize: 14, color: C.texte2, textAlign: 'center', marginTop: 30 },
  videCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 28,
    alignItems: 'center', gap: 8, marginTop: 16, ...OMBRE,
  },
  videEmoji: { fontSize: 40 },
  videTitre: { fontFamily: F.t800, fontSize: 16.5, color: C.texte },
  videTexte: { fontFamily: F.t400, fontSize: 14, color: C.texte2, textAlign: 'center', lineHeight: 20 },

  offre: { backgroundColor: C.carte, borderRadius: R.carte, padding: 18, gap: 6, ...OMBRE },
  // La plus récente ressort en jaune (comme une promo phare)
  offrePremiere: { backgroundColor: C.jaune },
  offreHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  offreTitre: { flex: 1, fontFamily: F.t800, fontSize: 16, color: C.texte },
  offreDate: { fontFamily: F.t600, fontSize: 12, color: C.texte3 },
  offreMessage: { fontFamily: F.t400, fontSize: 14, color: C.texte2, lineHeight: 20 },
});
