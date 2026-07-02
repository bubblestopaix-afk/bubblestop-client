// === Mes commandes : suivi du statut en direct ===
// Le client voit où en est sa commande (reçue → en préparation → prête),
// avec barre d'étapes. Rafraîchissement auto toutes les 15 s.
import { useEffect, useState, useCallback } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
// @ts-ignore — règles de prix partagées avec le POS
import { calculerPrix } from '@/data/catalogue';
import { trouverCategorieCloud, trouverSaveurCloud } from '@/data/catalogue-cloud';
import { ajouterLigne } from '@/store/panier';
import { C, F, R, OMBRE } from '@/constants/charte';
import { BoutonRetour } from '@/components/ui-kit';

// Apparence de chaque statut côté client (etape 0 = pas de barre)
const STATUTS: Record<string, { label: string; fond: string; texte: string; etape: number }> = {
  en_attente:     { label: 'Reçue',                        fond: C.jaunePale, texte: '#9A6B00', etape: 1 },
  en_preparation: { label: 'En préparation',               fond: '#E3F2FA',   texte: '#1D6E96', etape: 2 },
  prete:          { label: 'Prête ! Viens la chercher',    fond: C.vertPale,  texte: C.vertFonce, etape: 3 },
  recuperee:      { label: 'Récupérée',                    fond: C.lavande,   texte: C.texte2, etape: 0 },
  annulee:        { label: 'Annulée',                      fond: C.dangerPale, texte: C.danger, etape: 0 },
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
  const insets = useSafeAreaInsets();
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
      .eq('client_id', session.user.id) // un admin (RLS globale) ne doit voir ici que LES SIENNES
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
      <ScrollView
        contentContainerStyle={[styles.contenu, { paddingTop: insets.top + 12 }]}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={tirer} tintColor={C.violet} />}>
        <View style={styles.enTete}>
          <BoutonRetour onPress={() => router.back()} />
          <Text style={styles.titre}>Mes commandes</Text>
          <View style={{ width: 40 }} />
        </View>

        {commandes === null && <ActivityIndicator color={C.violet} size="large" style={{ marginTop: 40 }} />}

        {!connecte && (
          <Text style={styles.aide}>Connecte-toi dans l'onglet Compte pour voir tes commandes.</Text>
        )}

        {connecte && commandes?.length === 0 && (
          <Text style={styles.aide}>Aucune commande pour l'instant.</Text>
        )}

        {commandes?.map((cmd) => {
          const st = STATUTS[cmd.statut] ?? { label: cmd.statut, fond: C.lavande, texte: C.texte2, etape: 0 };
          const date = new Date(cmd.created_at);
          return (
            <View key={cmd.id} style={styles.carte}>
              <View style={styles.carteHaut}>
                <Text style={styles.numero}>Commande n°{cmd.numero}</Text>
                <Text style={styles.date}>
                  {date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}{' '}
                  {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              {/* Barre d'étapes pour les commandes en cours */}
              {st.etape > 0 && (
                <View style={styles.etapes}>
                  {[1, 2, 3].map((e) => (
                    <View key={e} style={[styles.etape, e <= st.etape && styles.etapeFaite]} />
                  ))}
                </View>
              )}

              <View style={[styles.statut, { backgroundColor: st.fond }]}>
                <Text style={[styles.statutTexte, { color: st.texte }]}>{st.label}</Text>
              </View>

              {cmd.creneau_retrait && (
                <Text style={styles.creneau}>
                  Retrait prévu à{' '}
                  {new Date(cmd.creneau_retrait).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}

              {cmd.commande_items.map((it) => (
                <Text key={it.id} style={styles.item}>
                  {it.quantite}× {it.produit?.nom}
                </Text>
              ))}

              <View style={styles.carteBas}>
                <Text style={styles.total}>
                  {(cmd.total_cents / 100).toFixed(2).replace('.', ',')} €
                </Text>
                <Pressable style={styles.btnRecommander} onPress={() => recommander(cmd)}>
                  <Text style={styles.btnRecommanderTexte}>Re-commander</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  contenu: { padding: 18, gap: 12, paddingBottom: 40 },
  enTete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titre: { fontFamily: F.titre, fontSize: 22, color: C.violet },
  aide: { fontFamily: F.t600, fontSize: 14.5, color: C.texte2, textAlign: 'center', marginTop: 24, lineHeight: 22 },

  carte: { backgroundColor: C.carte, borderRadius: R.carte, padding: 17, gap: 9, ...OMBRE },
  carteHaut: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  numero: { fontFamily: F.t800, fontSize: 16, color: C.texte },
  date: { fontFamily: F.t600, fontSize: 12.5, color: C.texte3 },

  etapes: { flexDirection: 'row', gap: 6 },
  etape: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.lavande },
  etapeFaite: { backgroundColor: C.vert },

  statut: { borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12, alignSelf: 'flex-start' },
  statutTexte: { fontFamily: F.t800, fontSize: 13.5 },
  creneau: { fontFamily: F.t700, fontSize: 13, color: '#9A6B00' },
  item: { fontFamily: F.t400, fontSize: 13.5, color: C.texte2 },

  carteBas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  total: { fontFamily: F.t800, fontSize: 16, color: C.violet },
  btnRecommander: {
    backgroundColor: C.lavande, borderRadius: R.pill,
    paddingVertical: 9, paddingHorizontal: 16,
  },
  btnRecommanderTexte: { fontFamily: F.t700, fontSize: 13, color: C.violetProfond },
});
