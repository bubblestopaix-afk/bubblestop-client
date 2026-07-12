// === Carte cadeau / solde prépayé (Phase A, 10/07) ===
// Le solde vit sur la carte fidélité — SOURCE DE VÉRITÉ = cloud (fidelite_cloud.solde_centimes,
// mutations uniquement via l'edge solde-api → RPC atomique, jamais côté client).
// Ici on LIT via RLS : sa ligne fidelite_cloud, ses solde_mouvements, la config publique
// app_config 'carte_cadeau' (paliers de bonus, minimum).
// V1 : recharge EN BOUTIQUE (le caissier scanne le QR fidélité habituel) — Stripe plus tard.
// Paiement en caisse avec le même QR (Phase B POS, paiement mixte) ; les boissons payées
// avec le solde donnent des tampons NORMALEMENT, règles cadeaux/suppléments inchangées.
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { C, F, R, OMBRE } from '@/constants/charte';
import { BoutonGhost } from '@/components/ui-kit';

const eur = (centimes: number) => `${(centimes / 100).toFixed(2).replace('.', ',')} €`;

type Mouvement = { id: number; created_at: string; type: string; montant_centimes: number; solde_apres: number; magasin: string | null };
type Palier = { des_centimes: number; bonus_pct: number };

const LIB_TYPE: Record<string, string> = {
  recharge: '💳 Recharge', bonus: '🎁 Bonus offert', paiement: '🧋 Paiement', ajustement: '🛠 Ajustement',
};

export default function CarteCadeau() {
  const insets = useSafeAreaInsets();
  const [solde, setSolde] = useState<number | null>(null);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [paliers, setPaliers] = useState<Palier[]>([]);
  const [minCentimes, setMinCentimes] = useState(1000);
  const [charge, setCharge] = useState(false);

  const charger = useCallback(async () => {
    setCharge(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const uid = s?.session?.user?.id;
      if (!uid) { setSolde(null); return; }
      const { data: prof } = await supabase.from('profils').select('numero_fidelite').eq('id', uid).maybeSingle();
      const numero = prof?.numero_fidelite;
      if (!numero) { setSolde(0); return; }
      const [{ data: fid }, { data: mvts }, { data: cfg }] = await Promise.all([
        supabase.from('fidelite_cloud').select('solde_centimes').eq('numero_fidelite', numero).maybeSingle(),
        supabase.from('solde_mouvements').select('id, created_at, type, montant_centimes, solde_apres, magasin')
          .eq('numero_fidelite', numero).order('created_at', { ascending: false }).limit(25),
        supabase.from('app_config').select('valeur').eq('cle', 'carte_cadeau').maybeSingle(),
      ]);
      setSolde(Number(fid?.solde_centimes) || 0);
      setMouvements((mvts as Mouvement[]) || []);
      const v = (cfg?.valeur || {}) as { min_centimes?: number; paliers?: Palier[] };
      setMinCentimes(Number(v.min_centimes) || 1000);
      setPaliers(Array.isArray(v.paliers) ? v.paliers : []);
    } catch { /* best effort : on garde l'affichage précédent */ }
    setCharge(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const meilleurPalier = paliers.slice().sort((a, b) => b.bonus_pct - a.bonus_pct)[0];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.fond }}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 14, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={charge} onRefresh={charger} tintColor={C.violet} />}
    >
      <BoutonGhost titre="‹ Retour" onPress={() => router.back()} />

      <Text style={st.titre}>💳 Ma carte cadeau</Text>
      <Text style={st.sousTitre}>Un solde prépayé sur ta carte fidélité — recharge en boutique, paie avec ton QR habituel.</Text>

      {/* Solde */}
      <View style={st.soldeCarte}>
        <Text style={st.soldeLabel}>Mon solde</Text>
        <Text style={st.soldeMontant}>{solde == null ? '—' : eur(solde)}</Text>
        <Text style={st.soldeNote}>Utilisable en caisse dans les 3 boutiques · les boissons payées avec le solde donnent des tampons normalement 🧋</Text>
      </View>

      {/* Comment ça marche */}
      <View style={st.carte}>
        <Text style={st.carteTitre}>Comment recharger ?</Text>
        <Text style={st.ligne}>1️⃣  Passe en boutique et dis que tu veux recharger ta carte cadeau (minimum {eur(minCentimes)}).</Text>
        <Text style={st.ligne}>2️⃣  Le caissier scanne ton QR fidélité et encaisse le montant.</Text>
        <Text style={st.ligne}>3️⃣  Ton solde est crédité instantanément — visible ici.</Text>
        {meilleurPalier && (
          <View style={st.bonusPill}>
            <Text style={st.bonusTexte}>
              🎁 +{meilleurPalier.bonus_pct} % OFFERTS dès {eur(meilleurPalier.des_centimes)} de recharge
              {'\n'}(ex. {eur(meilleurPalier.des_centimes)} payés → {eur(Math.round(meilleurPalier.des_centimes * (1 + meilleurPalier.bonus_pct / 100)))} de solde)
            </Text>
          </View>
        )}
        <Text style={st.petit}>La recharge en ligne (CB dans l'appli) arrive bientôt.</Text>
      </View>

      {/* Historique */}
      <View style={st.carte}>
        <Text style={st.carteTitre}>Historique</Text>
        {mouvements.length === 0 ? (
          <Text style={st.petit}>Aucun mouvement pour l'instant — ta première recharge apparaîtra ici.</Text>
        ) : mouvements.map((m) => (
          <View key={m.id} style={st.mvt}>
            <View style={{ flex: 1 }}>
              <Text style={st.mvtType}>{LIB_TYPE[m.type] || m.type}</Text>
              <Text style={st.mvtDate}>
                {new Date(m.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                {m.magasin ? ` · ${m.magasin.charAt(0).toUpperCase()}${m.magasin.slice(1)}` : ''}
              </Text>
            </View>
            <Text style={[st.mvtMontant, m.montant_centimes < 0 ? st.mvtDebit : st.mvtCredit]}>
              {m.montant_centimes > 0 ? '+' : ''}{eur(m.montant_centimes)}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  titre: { fontFamily: F.titre, fontSize: 26, color: C.violet, marginTop: 14 },
  sousTitre: { fontFamily: F.t400, fontSize: 14, color: C.texte2, marginTop: 4, marginBottom: 16, lineHeight: 20 },
  soldeCarte: { backgroundColor: C.violet, borderRadius: R.carte, padding: 22, marginBottom: 14, ...OMBRE },
  soldeLabel: { fontFamily: F.t600, fontSize: 13, color: '#CFC4E8' },
  soldeMontant: { fontFamily: F.titre, fontSize: 42, color: C.blanc, marginVertical: 4 },
  soldeNote: { fontFamily: F.t400, fontSize: 12.5, color: '#CFC4E8', lineHeight: 18 },
  carte: { backgroundColor: C.carte, borderRadius: R.carte, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: C.bord, ...OMBRE },
  carteTitre: { fontFamily: F.t800, fontSize: 16, color: C.violet, marginBottom: 10 },
  ligne: { fontFamily: F.t400, fontSize: 14, color: C.texte, lineHeight: 21, marginBottom: 8 },
  bonusPill: { backgroundColor: C.vertPale, borderRadius: 14, padding: 12, marginTop: 4, marginBottom: 8 },
  bonusTexte: { fontFamily: F.t700, fontSize: 13.5, color: C.vertFonce, lineHeight: 19, textAlign: 'center' },
  petit: { fontFamily: F.t400, fontSize: 12.5, color: C.texte3, lineHeight: 18 },
  mvt: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.bord },
  mvtType: { fontFamily: F.t600, fontSize: 14, color: C.texte },
  mvtDate: { fontFamily: F.t400, fontSize: 12, color: C.texte3, marginTop: 1 },
  mvtMontant: { fontFamily: F.t700, fontSize: 15 },
  mvtCredit: { color: C.vertFonce },
  mvtDebit: { color: C.danger },
});
