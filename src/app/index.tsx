// === Écran d'accueil Bubblestop ===
// Utile dès l'ouverture : bonjour personnalisé, suivi LIVE de la commande en cours,
// vraie carte à tampons (9 = 1 offerte), horaires du jour, offres, accès rapides.
import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { MAGASINS } from '@/store/magasin';

const VIOLET = '#3A2A5E';
const VIOLET_PROFOND = '#2A1D46';
const VERT = '#A3C724';
const LAVANDE = '#EFE9F6';

const STATUT_LIB: Record<string, { txt: string; emoji: string }> = {
  en_attente: { txt: 'Commande reçue', emoji: '📨' },
  en_preparation: { txt: 'En préparation', emoji: '👩‍🍳' },
  prete: { txt: 'Prête — viens la chercher !', emoji: '✅' },
};

export default function AccueilScreen() {
  const [prenom, setPrenom] = useState('');
  const [magasinId, setMagasinId] = useState<string | null>(null);
  const [carte, setCarte] = useState<{ tampons: number; cadeaux: number } | null>(null);
  const [carteLiee, setCarteLiee] = useState<boolean | null>(null);
  const [cmdActive, setCmdActive] = useState<any>(null);
  const [horairesJour, setHorairesJour] = useState<string | null>(null);
  const [offres, setOffres] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(false);

  const charger = useCallback(async () => {
    try {
      // Offres actives (visibles même sans compte)
      const { data: offresData } = await supabase.from('offres')
        .select('id, titre, message').eq('active', true)
        .order('created_at', { ascending: false }).limit(5);
      setOffres(offresData ?? []);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setCarteLiee(false); return; }

      // Profil : prénom + magasin + carte
      const { data: p } = await supabase.from('profils')
        .select('nom, prenom_sur_ticket, magasin, numero_fidelite')
        .eq('id', session.user.id).maybeSingle();
      setPrenom(p?.prenom_sur_ticket || (p?.nom || '').split(' ')[0] || '');
      setMagasinId(p?.magasin ?? null);
      setCarteLiee(!!p?.numero_fidelite);

      // Carte de fidélité : tampons / cadeaux en direct
      if (p?.numero_fidelite) {
        const { data: f } = await supabase.from('fidelite_cloud')
          .select('tampons, cadeaux').eq('telephone', p.numero_fidelite).maybeSingle();
        setCarte(f ? { tampons: Number(f.tampons) || 0, cadeaux: Number(f.cadeaux) || 0 } : null);
      }

      // Commande active (suivi live)
      const { data: c } = await supabase.from('commandes')
        .select('numero, statut')
        .in('statut', ['en_attente', 'en_preparation', 'prete'])
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      setCmdActive(c ?? null);

      // Horaires du jour du magasin du client
      if (p?.magasin) {
        const { data: cfg } = await supabase.from('boutique_config')
          .select('horaires').eq('id', p.magasin).maybeSingle();
        const h = cfg?.horaires?.[String(new Date().getDay())];
        if (h) setHorairesJour(h.ouvert === false ? 'Fermé aujourd\'hui' : (h.de && h.a ? `Ouvert aujourd'hui · ${h.de} – ${h.a}` : null));
      }
    } catch (_) { /* silencieux */ }
  }, []);

  useEffect(() => {
    charger();
    // Statut de commande rafraîchi en continu (15 s)
    const t = setInterval(charger, 15000);
    return () => clearInterval(t);
  }, [charger]);

  const onRefresh = async () => { setRefresh(true); await charger(); setRefresh(false); };

  const nomMagasin = magasinId ? (MAGASINS.find((m) => m.id === magasinId)?.nom || magasinId) : null;
  const tampons = carte?.tampons ?? 0;
  const statut = cmdActive ? STATUT_LIB[cmdActive.statut] : null;

  return (
    <View style={styles.fond}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.contenu}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor="#fff" />}
        >
          <Text style={styles.logo}>BUBBLE STOP</Text>
          <Text style={styles.slogan}>
            {prenom ? `Salut ${prenom} 👋` : 'Ton bubble tea préféré, dans ta poche 🥤'}
            {nomMagasin ? `  ·  ${nomMagasin}` : ''}
          </Text>
          {horairesJour && <Text style={styles.horaires}>{horairesJour}</Text>}

          {/* === Suivi LIVE de la commande en cours (l'info n°1 quand elle existe) === */}
          {cmdActive && statut && (
            <Pressable
              style={[styles.suivi, cmdActive.statut === 'prete' && styles.suiviPrete]}
              onPress={() => router.push('/commander/mes-commandes' as any)}
            >
              <Text style={styles.suiviEmoji}>{statut.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.suiviTitre}>Commande n°{cmdActive.numero}</Text>
                <Text style={styles.suiviTexte}>{statut.txt}</Text>
              </View>
              <Text style={styles.suiviChevron}>›</Text>
            </Pressable>
          )}

          {/* Action principale, comme toute app food : commander en 1 tap */}
          <Pressable style={styles.ctaCommander} onPress={() => router.push('/commander' as any)}>
            <Text style={styles.ctaCommanderTexte}>🥤 Commander</Text>
            <Text style={styles.ctaCommanderSous}>Retrait en boutique, sans attendre ›</Text>
          </Pressable>

          {/* === Carte de fidélité RÉELLE : tampons en direct === */}
          {carteLiee && carte ? (
            <Pressable style={styles.carte} onPress={() => router.push('/explore' as any)}>
              <View style={styles.carteLigneTitre}>
                <Text style={styles.carteTitre}>🎁 Ma carte de fidélité</Text>
                <Text style={styles.carteCompteur}>{tampons}/9</Text>
              </View>
              {/* Rangée de tampons : remplis / vides */}
              <View style={styles.tampons}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <View key={i} style={[styles.tampon, i < tampons && styles.tamponPlein]}>
                    {i < tampons && <Text style={styles.tamponTxt}>🥤</Text>}
                  </View>
                ))}
              </View>
              <Text style={styles.carteTexte}>
                {carte.cadeaux > 0
                  ? `🎉 ${carte.cadeaux} boisson${carte.cadeaux > 1 ? 's' : ''} offerte${carte.cadeaux > 1 ? 's' : ''} à utiliser !`
                  : `Encore ${9 - tampons} boisson${9 - tampons > 1 ? 's' : ''} avant la prochaine offerte ›`}
              </Text>
            </Pressable>
          ) : carteLiee === false ? (
            <Pressable style={styles.carte} onPress={() => router.push('/explore' as any)}>
              <Text style={styles.carteTitre}>🎟 Lie ta carte de fidélité</Text>
              <Text style={styles.carteTexte}>
                Ton QR code et tes tampons en direct : 9 boissons = 1 offerte ›
              </Text>
            </Pressable>
          ) : null}

          {/* Offres en cours (publiées depuis la caisse ou le compte admin) */}
          {offres.map((o) => (
            <View key={o.id} style={styles.offre}>
              <Text style={styles.offreTitre}>📣 {o.titre}</Text>
              <Text style={styles.offreMessage}>{o.message}</Text>
            </View>
          ))}

          {/* Accès rapide : historique des commandes */}
          <Pressable style={styles.lien} onPress={() => router.push('/commander/mes-commandes' as any)}>
            <Text style={styles.lienTexte}>🧾 Mes commandes passées ›</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: VIOLET },
  safe: { flex: 1 },
  contenu: { padding: 24, gap: 16 },
  logo: {
    fontSize: 34, fontWeight: '900', color: '#fff', textAlign: 'center',
    letterSpacing: 1, marginTop: 24,
  },
  slogan: { fontSize: 16, color: LAVANDE, textAlign: 'center' },
  horaires: { fontSize: 13, color: '#cdbfe6', textAlign: 'center', marginTop: -10 },

  // Suivi de commande live
  suivi: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 18, padding: 18,
    borderWidth: 2, borderColor: '#FFD166',
  },
  suiviPrete: { borderColor: VERT, backgroundColor: '#F3FADC' },
  suiviEmoji: { fontSize: 28 },
  suiviTitre: { fontSize: 16, fontWeight: '900', color: VIOLET_PROFOND },
  suiviTexte: { fontSize: 14, color: VIOLET_PROFOND, opacity: 0.8 },
  suiviChevron: { fontSize: 26, color: VIOLET_PROFOND, opacity: 0.5, fontWeight: '700' },

  // Gros bouton « Commander » (action n°1 de l'app)
  ctaCommander: { backgroundColor: VERT, borderRadius: 18, padding: 22, alignItems: 'center', gap: 4 },
  ctaCommanderTexte: { fontSize: 22, fontWeight: '900', color: VIOLET_PROFOND },
  ctaCommanderSous: { fontSize: 14, color: VIOLET_PROFOND, opacity: 0.8 },

  carte: { backgroundColor: '#fff', borderRadius: 18, padding: 20, gap: 8 },
  carteLigneTitre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  carteTitre: { fontSize: 18, fontWeight: '800', color: VIOLET_PROFOND },
  carteCompteur: { fontSize: 16, fontWeight: '900', color: VERT },
  carteTexte: { fontSize: 15, color: VIOLET_PROFOND, lineHeight: 22 },

  // Tampons de fidélité
  tampons: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginVertical: 4 },
  tampon: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: LAVANDE,
    borderWidth: 1.5, borderColor: '#d9cdee', alignItems: 'center', justifyContent: 'center',
  },
  tamponPlein: { backgroundColor: '#E9F4C7', borderColor: VERT },
  tamponTxt: { fontSize: 15 },

  offre: { backgroundColor: '#FFD166', borderRadius: 16, padding: 16, gap: 4 },
  offreTitre: { fontSize: 16, fontWeight: '900', color: VIOLET_PROFOND },
  offreMessage: { fontSize: 14, color: VIOLET_PROFOND, lineHeight: 20 },

  lien: { paddingVertical: 6, alignItems: 'center' },
  lienTexte: { fontSize: 15, color: LAVANDE, fontWeight: '700' },
});
