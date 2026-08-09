// === Offres : les promos et annonces en cours (publiées par l'admin) ===
import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useFonctionnalite } from '@/lib/fonctionnalites';
import { magasinOffresDepuisProfil, offreEnCours, offreVisiblePour } from '@/lib/offres';
import RappelNotifs from '@/components/rappel-notifs';
import { IconeApp } from '@/components/icones-app';
import { BORD, C, F, OMBRE, R } from '@/constants/charte';
import { PointillesRose, TitreKawaii } from '@/components/ui-kit';

// "il y a 2 j" / "aujourd'hui" pour dater une offre
function depuis(dateIso: string): string {
  const jours = Math.floor((Date.now() - new Date(dateIso).getTime()) / 86400000);
  if (jours <= 0) return 'Aujourd\'hui';
  if (jours === 1) return 'Hier';
  return `Il y a ${jours} j`;
}

export default function OffresRoute() {
  const visibilite = useFonctionnalite('offres');
  if (!visibilite.charge) return null;
  if (!visibilite.actif) return <Redirect href={'/' as any} />;
  return <OffresScreen />;
}

function OffresScreen() {
  const insets = useSafeAreaInsets();
  const [offres, setOffres] = useState<any[] | null>(null);
  const [refresh, setRefresh] = useState(false);
  const [erreur, setErreur] = useState(false);

  const charger = useCallback(async () => {
    // Même règle que l'accueil : dernier QR scanné, fail-closed sans scan connu.
    let magasinClient: string | null = null;
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (sess?.session) {
        const { data: pm } = await supabase.from('profils')
          .select('dernier_magasin_scan').eq('id', sess.session.user.id).maybeSingle();
        magasinClient = magasinOffresDepuisProfil(pm);
      }
    } catch (_) { magasinClient = null; }
    const { data, error } = await supabase.from('offres')
      .select('id, titre, message, created_at, jours, heure_debut, heure_fin, date_debut, date_fin, active, magasins')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      setErreur(true);
      return;
    }
    setErreur(false);
    // Offres programmées : visibles uniquement pendant leur fenêtre (jours/heures/dates)
    setOffres((data ?? []).filter((o) => offreEnCours(o as any) && offreVisiblePour(o as any, magasinClient)));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const tirer = async () => { setRefresh(true); await charger(); setRefresh(false); };

  return (
    <View style={styles.fond}>
      <ScrollView
        contentContainerStyle={[styles.contenu, { paddingTop: insets.top + 18 }]}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={tirer} tintColor={C.violet} />}>
        <TitreKawaii texte="Offres" taille={24} sousTitre="Les bons plans du moment." />

        {/* 🔔 Sans notifications activées, les promos passent à la trappe → rappel */}
        <RappelNotifs />

        {offres === null && !erreur && <Text style={styles.vide}>Chargement…</Text>}

        {erreur && (
          <View style={styles.videCarte} accessibilityRole="alert">
            <IconeApp nom="alerte" taille={42} />
            <Text style={styles.videTitre}>Offres indisponibles</Text>
            <Text style={styles.videTexte}>Vérifie ta connexion puis réessaie.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Réessayer de charger les offres" onPress={charger}>
              <Text style={styles.reessayer}>Réessayer</Text>
            </Pressable>
          </View>
        )}

        {!erreur && offres?.length === 0 && (
          <View style={styles.videCarte}>
            <IconeApp nom="cadeau" taille={42} />
            <Text style={styles.videTitre}>Pas d'offre en ce moment</Text>
            <Text style={styles.videTexte}>
              Reviens bientôt — les nouvelles offres et nouveautés apparaissent ici.
            </Text>
          </View>
        )}

        {offres?.map((o, i) => (
          <View key={o.id} style={[styles.offre, i === 0 && styles.offrePremiere]}>
            <View style={styles.offreHaut}>
              <Text style={[styles.offreTitre, i === 0 && { color: '#54470A' }]}>{o.titre}</Text>
              <Text style={[styles.offreDate, i === 0 && { color: '#54470A', opacity: 0.6 }]}>{depuis(o.created_at)}</Text>
            </View>
            <PointillesRose couleur={i === 0 ? 'rgba(84,71,10,0.25)' : '#F3D9E9'} />
            <Text style={[styles.offreMessage, i === 0 && { color: '#54470A', opacity: 0.85 }]}>{o.message}</Text>
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
    alignItems: 'center', gap: 8, marginTop: 16,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  videEmoji: { fontSize: 40 },
  videTitre: { fontFamily: F.titre, fontSize: 16.5, color: C.violet },
  videTexte: { fontFamily: F.t400, fontSize: 14, color: C.texte2, textAlign: 'center', lineHeight: 20 },
  reessayer: { fontFamily: F.t800, fontSize: 14, color: C.violetClair, paddingVertical: 8, paddingHorizontal: 16 },

  offre: {
    backgroundColor: C.carte, borderRadius: R.carte, paddingVertical: 16, paddingHorizontal: 18, gap: 8,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  // La plus récente ressort en jaune perle (promo phare, bord blanc)
  offrePremiere: { backgroundColor: C.jaune, borderColor: BORD.surPastel },
  offreHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  offreTitre: { flex: 1, fontFamily: F.t800, fontSize: 15.5, color: C.texte },
  offreDate: { fontFamily: F.t600, fontSize: 11.5, color: C.texte3 },
  offreMessage: { fontFamily: F.t500, fontSize: 13, color: C.texte2, lineHeight: 19.5 },
});
