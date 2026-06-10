// === Mes commandes : suivi du statut en direct ===
// Le client voit où en est sa commande (reçue → en préparation → prête).
// Rafraîchissement auto toutes les 15 s tant que l'écran est ouvert.
import { useEffect, useState, useCallback } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
// @ts-ignore — règles de prix partagées avec le POS
import { calculerPrix } from '@/data/catalogue';
import { trouverCategorieCloud, trouverSaveurCloud } from '@/data/catalogue-cloud';
import { ajouterLigne } from '@/store/panier';

const VIOLET = '#3A2A5E';
const VIOLET_PROFOND = '#2A1D46';
const VERT = '#A3C724';
const LAVANDE = '#EFE9F6';

// Apparence de chaque statut côté client
const STATUTS: Record<string, { label: string; couleur: string }> = {
  en_attente:     { label: '🕐 Reçue',           couleur: '#FFD166' },
  en_preparation: { label: '👩‍🍳 En préparation',  couleur: '#7EC8E3' },
  prete:          { label: '🛍️ Prête ! Viens la chercher', couleur: VERT },
  recuperee:      { label: '✅ Récupérée',        couleur: '#B0B4BA' },
  annulee:        { label: '✖ Annulée',           couleur: '#E07A8A' },
};

type Commande = {
  id: string;
  numero: number;
  statut: string;
  creneau_retrait: string | null;
  total_cents: number;
  created_at: string;
  commande_items: { id: string; quantite: number; produit: any }[];
};

export default function MesCommandesScreen() {
  const [commandes, setCommandes] = useState<Commande[] | null>(null);
  const [connecte, setConnecte] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const charger = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setConnecte(false); setCommandes([]); return; }
    setConnecte(true);
    const { data } = await supabase
      .from('commandes')
      .select('id, numero, statut, creneau_retrait, total_cents, created_at, commande_items(id, quantite, produit)')
      .order('created_at', { ascending: false })
      .limit(10);
    setCommandes((data as Commande[]) ?? []);
  }, []);

  // Chargement initial + polling 15s
  useEffect(() => {
    charger();
    const t = setInterval(charger, 15000);
    return () => clearInterval(t);
  }, [charger]);

  const tirer = async () => {
    setRefresh(true);
    await charger();
    setRefresh(false);
  };

  // Recharge le panier avec les items d'une ancienne commande,
  // au PRIX ACTUEL de la carte (recalculé, pas le prix d'époque)
  const recommander = (cmd: Commande) => {
    let ajoutes = 0;
    cmd.commande_items.forEach((it) => {
      const brut = it.produit?.brut;
      if (!brut) return;
      const categorie = trouverCategorieCloud(brut.categorieId);
      const saveur = trouverSaveurCloud(brut.categorieId, brut.saveurId);
      if (!categorie || !saveur) return; // produit retiré de la carte → ignoré
      if (categorie.horsStock || saveur.horsStock) return; // épuisé aujourd'hui → ignoré
      const prix = calculerPrix({
        categorie, saveur,
        format: brut.format,
        toppings: brut.toppings || {},
        chantilly: !!brut.chantilly,
        laitAvoine: !!brut.laitAvoine,
      });
      ajouterLigne({
        categorieId: brut.categorieId,
        saveurId: brut.saveurId,
        format: brut.format || 'M',
        sucre: brut.sucre ?? null,
        temperature: brut.temperature ?? 'glace',
        glacons: brut.glacons,
        note: brut.note,
        toppings: brut.toppings || {},
        chantilly: !!brut.chantilly,
        laitAvoine: !!brut.laitAvoine,
        doublePortion: !!brut.doublePortion,
        quantite: it.quantite || 1,
        prixUnitaire: prix,
      });
      ajoutes++;
    });
    if (ajoutes > 0) router.push('/commander/panier' as any);
  };

  return (
    <View style={styles.fond}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.contenu}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={tirer} tintColor="#fff" />}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.retour}>‹ Retour</Text>
          </Pressable>
          <Text style={styles.titre}>Mes commandes</Text>

          {commandes === null && <ActivityIndicator color={VERT} size="large" style={{ marginTop: 40 }} />}

          {!connecte && (
            <Text style={styles.aide}>Connecte-toi dans l'onglet Compte pour voir tes commandes.</Text>
          )}

          {connecte && commandes?.length === 0 && (
            <Text style={styles.aide}>Aucune commande pour l'instant.</Text>
          )}

          {commandes?.map((cmd) => {
            const st = STATUTS[cmd.statut] ?? { label: cmd.statut, couleur: LAVANDE };
            const date = new Date(cmd.created_at);
            return (
              <View key={cmd.id} style={styles.carte}>
                <View style={styles.carteHaut}>
                  <Text style={styles.numero}>n°{cmd.numero}</Text>
                  <Text style={styles.date}>
                    {date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}{' '}
                    {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

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
                  <Text key={it.id} style={styles.item}>
                    {it.quantite}× {it.produit?.nom}
                  </Text>
                ))}

                <Text style={styles.total}>
                  {(cmd.total_cents / 100).toFixed(2).replace('.', ',')} €
                </Text>

                <Pressable style={styles.btnRecommander} onPress={() => recommander(cmd)}>
                  <Text style={styles.btnRecommanderTexte}>🔁 Re-commander</Text>
                </Pressable>
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
  retour: { color: LAVANDE, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  titre: { fontSize: 26, fontWeight: '900', color: '#fff' },
  aide: { fontSize: 15, color: LAVANDE, textAlign: 'center', marginTop: 24, lineHeight: 22 },
  carte: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 8 },
  carteHaut: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  numero: { fontSize: 18, fontWeight: '900', color: VIOLET_PROFOND },
  date: { fontSize: 13, color: '#60646C' },
  statut: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start' },
  statutTexte: { fontWeight: '800', fontSize: 14, color: VIOLET_PROFOND },
  creneau: { fontSize: 13.5, fontWeight: '700', color: '#a06a00' },
  item: { fontSize: 13.5, color: '#60646C' },
  total: { fontSize: 16, fontWeight: '900', color: VIOLET, marginTop: 2 },
  btnRecommander: {
    backgroundColor: VERT, borderRadius: 10, paddingVertical: 10,
    alignItems: 'center', marginTop: 4,
  },
  btnRecommanderTexte: { fontWeight: '800', fontSize: 14, color: VIOLET_PROFOND },
});
