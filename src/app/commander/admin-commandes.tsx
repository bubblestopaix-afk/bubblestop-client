// === ADMIN (master) : TOUTES les commandes, tous magasins ===
// Visible uniquement si profils.est_admin (les policies RLS « admin » côté
// Supabase autorisent la lecture globale + le changement de statut).
// Filtres : magasin + « en cours seulement ». Rafraîchissement auto 15 s.
import { useEffect, useState, useCallback } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { MAGASINS } from '@/store/magasin';
import { C, F } from '@/constants/charte';

// Couleurs = charte partagée (plus de valeurs locales en dur)
const VIOLET = C.violet;
const VIOLET_PROFOND = C.violetProfond;
const VERT = C.vert;
const LAVANDE = C.lavande;

// Statuts pilotables par l'admin (dans l'ordre du flux)
const FLUX = ['en_attente', 'en_preparation', 'prete', 'recuperee'] as const;
const STATUTS: Record<string, { label: string; court: string; couleur: string }> = {
  en_attente:     { label: '🕐 Reçue',          court: 'Reçue',  couleur: '#FFD166' },
  en_preparation: { label: '👩‍🍳 En préparation', court: 'Prépa',  couleur: '#7EC8E3' },
  prete:          { label: '🛍️ Prête',           court: 'Prête',  couleur: VERT },
  recuperee:      { label: '✅ Récupérée',       court: 'Récup.', couleur: '#B0B4BA' },
  annulee:        { label: '✖ Annulée',          court: 'Annul.', couleur: '#E07A8A' },
};
const EN_COURS = ['en_attente', 'en_preparation', 'prete'];

type Commande = {
  id: string;
  numero: number;
  statut: string;
  magasin: string | null;
  mode_paiement: string | null;
  creneau_retrait: string | null;
  total_cents: number;
  created_at: string;
  profils: { nom: string | null } | null;
  commande_items: { id: string; quantite: number; produit: any }[];
};

export default function AdminCommandesScreen() {
  const [admin, setAdmin] = useState<boolean | null>(null); // null = vérification
  const [commandes, setCommandes] = useState<Commande[] | null>(null);
  const [magFiltre, setMagFiltre] = useState<string>('tous');
  const [enCours, setEnCours] = useState(true); // masque récupérées/annulées par défaut
  const [refresh, setRefresh] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // id de la commande en cours de maj

  // Garde : réservé à l'admin
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setAdmin(false); return; }
      const { data } = await supabase.from('profils').select('est_admin').eq('id', session.user.id).maybeSingle();
      setAdmin(!!data?.est_admin);
    })();
  }, []);

  const charger = useCallback(async () => {
    let q = supabase
      .from('commandes')
      .select('id, numero, statut, magasin, mode_paiement, creneau_retrait, total_cents, created_at, profils(nom), commande_items(id, quantite, produit)')
      .order('created_at', { ascending: false })
      .limit(80);
    if (magFiltre !== 'tous') q = q.eq('magasin', magFiltre);
    if (enCours) q = q.in('statut', EN_COURS);
    const { data } = await q;
    setCommandes((data as unknown as Commande[]) ?? []);
  }, [magFiltre, enCours]);

  // Chargement + polling 15 s (seulement une fois admin confirmé)
  useEffect(() => {
    if (!admin) return;
    charger();
    const t = setInterval(charger, 15000);
    return () => clearInterval(t);
  }, [admin, charger]);

  const tirer = async () => { setRefresh(true); await charger(); setRefresh(false); };

  // Changement de statut (mise à jour optimiste)
  const setStatut = async (cmd: Commande, statut: string) => {
    if (cmd.statut === statut || busy) return;
    setBusy(cmd.id);
    setCommandes((cs) => (cs ?? []).map((c) => (c.id === cmd.id ? { ...c, statut } : c)));
    const { error } = await supabase.from('commandes').update({ statut }).eq('id', cmd.id);
    if (error) await charger(); // erreur → on recharge l'état réel
    setBusy(null);
  };

  if (admin === false) {
    return (
      <View style={styles.fond}><SafeAreaView style={styles.safe}>
        <Text style={[styles.aide, { marginTop: 60 }]}>Réservé à l'administrateur.</Text>
      </SafeAreaView></View>
    );
  }

  return (
    <View style={styles.fond}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.contenu}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={tirer} tintColor="#fff" />}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.retour}>‹ Retour</Text>
          </Pressable>
          <Text style={styles.titre}>🛠️ Toutes les commandes</Text>

          {/* Filtres magasin + en cours */}
          <View style={styles.filtres}>
            {[{ id: 'tous', nom: 'Tous' }, ...MAGASINS].map((m) => (
              <Pressable key={m.id} onPress={() => setMagFiltre(m.id)}
                style={[styles.chip, magFiltre === m.id && styles.chipOn]}>
                <Text style={[styles.chipTexte, magFiltre === m.id && { color: VIOLET_PROFOND }]}>
                  {m.id === 'tous' ? 'Tous' : m.id.charAt(0).toUpperCase() + m.id.slice(1)}
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setEnCours((v) => !v)} style={[styles.chip, enCours && styles.chipOn]}>
              <Text style={[styles.chipTexte, enCours && { color: VIOLET_PROFOND }]}>⏳ En cours</Text>
            </Pressable>
          </View>

          {(admin === null || commandes === null) && <ActivityIndicator color={VERT} size="large" style={{ marginTop: 40 }} />}

          {commandes?.length === 0 && (
            <Text style={styles.aide}>Aucune commande{enCours ? ' en cours' : ''}.</Text>
          )}

          {commandes?.map((cmd) => {
            const st = STATUTS[cmd.statut] ?? { label: cmd.statut, court: cmd.statut, couleur: LAVANDE };
            const date = new Date(cmd.created_at);
            return (
              <View key={cmd.id} style={styles.carte}>
                <View style={styles.carteHaut}>
                  <Text style={styles.numero}>n°{cmd.numero}</Text>
                  <Text style={styles.mag}>{(cmd.magasin || '—').toUpperCase()}</Text>
                  <Text style={styles.date}>
                    {date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}{' '}
                    {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                {/* Client */}
                <Text style={styles.client}>
                  👤 {cmd.profils?.nom || '(sans nom)'}
                </Text>

                <View style={[styles.statut, { backgroundColor: st.couleur }]}>
                  <Text style={styles.statutTexte}>{st.label}</Text>
                </View>

                {cmd.creneau_retrait && (
                  <Text style={styles.creneau}>
                    🕐 Retrait prévu à{' '}
                    {new Date(cmd.creneau_retrait).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}

                {cmd.commande_items.map((it) => (
                  <Text key={it.id} style={styles.item}>{it.quantite}× {it.produit?.nom}</Text>
                ))}

                <Text style={styles.total}>
                  {(cmd.total_cents / 100).toFixed(2).replace('.', ',')} €{cmd.mode_paiement ? '  ·  ' + cmd.mode_paiement : ''}
                </Text>

                {/* Changement de statut : un tap sur l'étape voulue */}
                <View style={styles.fluxLigne}>
                  {FLUX.map((s2) => (
                    <Pressable key={s2} onPress={() => setStatut(cmd, s2)} disabled={busy === cmd.id}
                      style={[styles.fluxBtn, cmd.statut === s2 && { backgroundColor: STATUTS[s2].couleur }]}>
                      <Text style={[styles.fluxTexte, cmd.statut === s2 && { color: VIOLET_PROFOND }]}>{STATUTS[s2].court}</Text>
                    </Pressable>
                  ))}
                  <Pressable onPress={() => setStatut(cmd, 'annulee')} disabled={busy === cmd.id}
                    style={[styles.fluxBtn, cmd.statut === 'annulee' && { backgroundColor: STATUTS.annulee.couleur }]}>
                    <Text style={[styles.fluxTexte, cmd.statut === 'annulee' && { color: VIOLET_PROFOND }]}>✖</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: VIOLET },
  safe: { flex: 1 },
  contenu: { padding: 20, gap: 12, paddingBottom: 40 },
  retour: { color: LAVANDE, fontSize: 16, fontFamily: F.t700, marginBottom: 8 },
  titre: { fontSize: 26, fontFamily: F.titre, color: '#fff' },
  aide: { fontSize: 15, color: LAVANDE, textAlign: 'center', marginTop: 24, lineHeight: 22 },
  filtres: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' },
  chipOn: { backgroundColor: VERT },
  chipTexte: { color: '#fff', fontFamily: F.t800, fontSize: 13 },
  carte: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 8 },
  carteHaut: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numero: { fontSize: 18, fontFamily: F.t800, color: VIOLET_PROFOND },
  mag: { fontSize: 12, fontFamily: F.t800, color: VIOLET, backgroundColor: LAVANDE, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  date: { fontSize: 13, fontFamily: F.t400, color: '#60646C', marginLeft: 'auto' },
  client: { fontSize: 14, fontFamily: F.t700, color: VIOLET_PROFOND },
  statut: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start' },
  statutTexte: { fontFamily: F.t800, fontSize: 14, color: VIOLET_PROFOND },
  creneau: { fontSize: 13.5, fontFamily: F.t700, color: '#a06a00' },
  item: { fontSize: 13.5, fontFamily: F.t400, color: '#60646C' },
  total: { fontSize: 16, fontFamily: F.t800, color: VIOLET, marginTop: 2 },
  fluxLigne: { flexDirection: 'row', gap: 6, marginTop: 4 },
  fluxBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: LAVANDE, alignItems: 'center' },
  fluxTexte: { fontSize: 12, fontFamily: F.t800, color: VIOLET },
});
