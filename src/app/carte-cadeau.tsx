// === Solde prépayé lié à la carte fidélité ===
// Le client prépare une recharge pour son prochain passage. Rien n'est crédité
// au scan : le caissier doit réellement encaisser puis confirmer dans le POS.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Keyboard, KeyboardAvoidingView, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { C, F, R, OMBRE } from '@/constants/charte';
import { BoutonGhost, BoutonPrimaire, Message } from '@/components/ui-kit';
import { useFonctionnalite } from '@/lib/fonctionnalites';

const eur = (centimes: number) => `${(centimes / 100).toFixed(2).replace('.', ',')} €`;

type Mouvement = { id: number; created_at: string; type: string; montant_centimes: number; solde_apres: number; magasin: string | null };
type Palier = { des_centimes: number; bonus_pct: number };
type DemandeRecharge = {
  id: string;
  client_id: string;
  numero_fidelite: string;
  magasin: string | null;
  montant_centimes: number;
  bonus_pct: number;
  bonus_centimes: number;
  statut: 'en_attente' | 'creditee' | 'annulee' | 'expiree';
  created_at: string;
  // Conservé pour lire les anciennes demandes ; les nouvelles n'expirent plus.
  expires_at: string | null;
  solde_apres?: number | null;
};

const LIB_TYPE: Record<string, string> = {
  recharge: 'Recharge', bonus: 'Bonus offert', paiement: 'Paiement', ajustement: 'Ajustement',
};

function centimesDepuisSaisie(valeur: string) {
  const normalisee = valeur.trim().replace(',', '.').replace(/[^0-9.]/g, '');
  const nombre = Number(normalisee);
  return Number.isFinite(nombre) ? Math.round(nombre * 100) : 0;
}

export default function CarteCadeau() {
  const visibilite = useFonctionnalite('carte_cadeau');
  if (!visibilite.charge) return null;
  if (!visibilite.actif) return <Redirect href={'/' as any} />;
  return <CarteCadeauContenu />;
}

function CarteCadeauContenu() {
  const insets = useSafeAreaInsets();
  const [solde, setSolde] = useState<number | null>(null);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [paliers, setPaliers] = useState<Palier[]>([]);
  const [minCentimes, setMinCentimes] = useState(1000);
  const [actif, setActif] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [numero, setNumero] = useState<string | null>(null);
  const [montant, setMontant] = useState('25');
  const [demande, setDemande] = useState<DemandeRecharge | null>(null);
  const [charge, setCharge] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [etat, setEtat] = useState<{ type: 'ok' | 'erreur' | 'info'; texte: string } | null>(null);

  const charger = useCallback(async () => {
    setCharge(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const userId = s?.session?.user?.id;
      setUid(userId || null);
      if (!userId) { setSolde(null); setActif(false); return; }
      const { data: prof } = await supabase.from('profils')
        .select('numero_fidelite').eq('id', userId).maybeSingle();
      const code = prof?.numero_fidelite || null;
      setNumero(code);
      if (!code) { setSolde(0); return; }
      const [{ data: fid }, { data: mvts }, { data: cfg }, { data: attente }] = await Promise.all([
        supabase.from('fidelite_cloud').select('solde_centimes').eq('numero_fidelite', code).maybeSingle(),
        supabase.from('solde_mouvements').select('id,created_at,type,montant_centimes,solde_apres,magasin')
          .eq('numero_fidelite', code).order('created_at', { ascending: false }).limit(25),
        supabase.from('app_config').select('valeur').eq('cle', 'carte_cadeau').maybeSingle(),
        supabase.from('recharges_solde_demandes').select('*')
          .eq('client_id', userId).eq('statut', 'en_attente').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      setSolde(Number(fid?.solde_centimes) || 0);
      setMouvements((mvts as Mouvement[]) || []);
      setDemande((attente as DemandeRecharge | null) || null);
      const v = (cfg?.valeur || {}) as { actif?: boolean; min_centimes?: number; paliers?: Palier[] };
      const minimum = Number(v.min_centimes) || 1000;
      setActif(v.actif !== false);
      setMinCentimes(minimum);
      setPaliers(Array.isArray(v.paliers) ? v.paliers : []);
      setMontant((courant) => centimesDepuisSaisie(courant) >= minimum ? courant : String(minimum / 100).replace('.', ','));
    } catch {
      setEtat({ type: 'erreur', texte: 'Impossible d’actualiser le solde. Vérifie ta connexion.' });
    } finally {
      setCharge(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    if (!uid) return;
    const canal = supabase.channel(`recharge-solde-${uid}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'recharges_solde_demandes', filter: `client_id=eq.${uid}`,
      }, (payload: any) => {
        const nouvelle = payload.new as DemandeRecharge | undefined;
        if (!nouvelle) return;
        if (nouvelle.statut === 'en_attente') setDemande(nouvelle);
        if (nouvelle.statut === 'creditee') {
          setDemande(null);
          setEtat({ type: 'ok', texte: `Paiement confirmé : ${eur(nouvelle.montant_centimes + nouvelle.bonus_centimes)} ont été crédités sur ta carte.` });
          charger();
        }
        if (nouvelle.statut === 'annulee' || nouvelle.statut === 'expiree') setDemande(null);
      }).subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [uid, charger]);

  const paliersTries = useMemo(() => paliers.slice().sort((a, b) => a.des_centimes - b.des_centimes), [paliers]);
  const montantCentimes = centimesDepuisSaisie(montant);
  const palier = paliers.filter((p) => montantCentimes >= Number(p.des_centimes))
    .sort((a, b) => Number(b.bonus_pct) - Number(a.bonus_pct))[0];
  const bonusCentimes = palier ? Math.round(montantCentimes * Number(palier.bonus_pct) / 100) : 0;
  const presets = useMemo(() => Array.from(new Set([minCentimes, 2500, 5000, 10000]))
    .filter((v) => v >= minCentimes && v <= 50000), [minCentimes]);

  const demander = async () => {
    Keyboard.dismiss();
    setEtat(null);
    if (!numero) { setEtat({ type: 'erreur', texte: 'Active d’abord ta carte fidélité.' }); return; }
    if (montantCentimes < minCentimes || montantCentimes > 50000) {
      setEtat({ type: 'erreur', texte: `Choisis un montant entre ${eur(minCentimes)} et 500 €.` });
      return;
    }
    setEnvoi(true);
    try {
      const { data, error } = await supabase.functions.invoke('solde-api', {
        body: { action: 'demander-recharge', montant_centimes: montantCentimes },
      });
      if (error || !data?.ok || !data?.demande) {
        setEtat({ type: 'erreur', texte: data?.erreur || error?.message || 'La demande n’a pas pu être envoyée.' });
      } else {
        setDemande(data.demande as DemandeRecharge);
        setEtat({ type: 'ok', texte: 'C’est prêt : ta demande apparaîtra à la caisse au prochain scan de ton QR fidélité.' });
      }
    } catch {
      setEtat({ type: 'erreur', texte: 'Réponse réseau incertaine. Actualise avant de recommencer : la demande a peut-être déjà été créée.' });
    } finally {
      setEnvoi(false);
    }
  };

  const annuler = async () => {
    if (!demande) return;
    setEnvoi(true);
    try {
      const { data, error } = await supabase.functions.invoke('solde-api', {
        body: { action: 'annuler-demande', id: demande.id },
      });
      if (error || !data?.ok) {
        setEtat({ type: 'erreur', texte: data?.erreur || error?.message || 'Annulation impossible.' });
      } else {
        setDemande(null);
        setEtat({ type: 'info', texte: 'Demande annulée. Aucun montant n’a été crédité.' });
      }
    } catch {
      setEtat({ type: 'erreur', texte: 'Réponse réseau incertaine. Actualise pour vérifier si la demande est encore active.' });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.fond }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingTop: insets.top + 14, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={charge} onRefresh={charger} tintColor={C.violet} />}
      >
        <BoutonGhost titre="‹ Retour" onPress={() => router.back()} />

        <Text style={st.titre}>Mon solde prépayé</Text>
        <Text style={st.sousTitre}>
          Il est lié à ta carte fidélité : un seul compte, un seul QR et aucun second code à retenir.
        </Text>

        <View style={st.soldeCarte}>
          <Text style={st.soldeLabel}>Mon solde disponible</Text>
          <Text style={st.soldeMontant}>{solde == null ? '—' : eur(solde)}</Text>
          <Text style={st.soldeNote}>Présente ton QR fidélité au comptoir pour l’utiliser.</Text>
        </View>

        {!actif ? (
          <View style={st.carte}>
            <Text style={st.carteTitre}>Recharges momentanément indisponibles</Text>
            <Text style={st.ligne}>Ton solde déjà acquis reste conservé. La recharge sera proposée ici dès sa réactivation.</Text>
          </View>
        ) : demande ? (
          <View style={[st.carte, st.demandeCarte]}>
            <Text style={st.carteTitre}>Demande prête pour ton prochain passage</Text>
            <Text style={st.demandeMontant}>{eur(demande.montant_centimes)} à encaisser</Text>
            <Text style={st.ligne}>
              Présente ton QR fidélité dans la boutique de ton choix.
              {'\n'}Bonus : {eur(demande.bonus_centimes)} · total crédité après paiement : {eur(demande.montant_centimes + demande.bonus_centimes)}
              {'\n'}Elle reste active jusqu’à son encaissement ou jusqu’à ce que tu l’annules, même si tu viens dans plusieurs jours.
            </Text>
            <View style={st.avertissement}>
              <Text style={st.avertissementTexte}>
                Le scan ne paie et ne crédite rien. Le caissier te demandera si tu souhaites toujours la recharge, puis la créditera seulement après avoir reçu le paiement.
              </Text>
            </View>
            <BoutonGhost titre="Annuler cette demande" danger onPress={annuler} />
          </View>
        ) : (
          <View style={st.carte}>
            <Text style={st.carteTitre}>Préparer ma recharge</Text>
            <Text style={st.ligne}>
              Choisis le montant maintenant. Au prochain scan de ton QR fidélité, la caisse te demandera si tu souhaites toujours l’activer.
            </Text>
            <Text style={st.etape}>Choisis le montant</Text>
            <View style={st.chips}>
              {presets.map((valeur) => (
                <Pressable key={valeur} style={[st.chipMontant, montantCentimes === valeur && st.chipMontantActif]} onPress={() => setMontant(String(valeur / 100).replace('.', ','))}>
                  <Text style={[st.chipMontantTexte, montantCentimes === valeur && st.chipTexteActif]}>{eur(valeur)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={st.label}>Autre montant (maximum 500 €)</Text>
            <TextInput
              value={montant}
              onChangeText={(v) => setMontant(v.replace(/[^0-9,.]/g, '').replace('.', ','))}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              maxLength={7}
              placeholder="25"
              placeholderTextColor={C.texte3}
              style={st.input}
            />

            <View style={st.recap}>
              <Text style={st.recapLabel}>Tu règles au comptoir</Text>
              <Text style={st.recapValeur}>{eur(montantCentimes)}</Text>
              <Text style={st.recapBonus}>Bonus {palier ? `+${palier.bonus_pct} %` : 'actuel'} : {eur(bonusCentimes)}</Text>
              <Text style={st.recapTotal}>Crédit après encaissement : {eur(montantCentimes + bonusCentimes)}</Text>
            </View>
            {etat && <Message type={etat.type} texte={etat.texte} />}
            <BoutonPrimaire titre="Préparer pour mon prochain passage" onPress={demander} loading={envoi} />
            <Text style={st.petit}>La demande apparaît seulement quand ton QR est scanné et reste active jusqu’à son encaissement ou son annulation.</Text>
          </View>
        )}

        {demande && etat && <Message type={etat.type} texte={etat.texte} />}

        <View style={st.carte}>
          <Text style={st.carteTitre}>Bonus de recharge</Text>
          {paliersTries.length === 0 ? (
            <Text style={st.petit}>Aucun bonus temporaire n’est proposé actuellement.</Text>
          ) : paliersTries.map((p) => (
            <View key={`${p.des_centimes}-${p.bonus_pct}`} style={st.bonusPill}>
              <Text style={st.bonusTexte}>
                Dès {eur(p.des_centimes)} : +{p.bonus_pct} % offerts · {eur(p.des_centimes)} payés = {eur(Math.round(p.des_centimes * (1 + p.bonus_pct / 100)))} crédités
              </Text>
            </View>
          ))}
        </View>

        <View style={st.carte}>
          <Text style={st.carteTitre}>Payer avec mon solde</Text>
          <Text style={st.ligne}>Présente le même QR fidélité avant le paiement et demande à utiliser ton solde.</Text>
          <Text style={st.ligne}>Le simple scan ne retire jamais d’argent. Si le solde est insuffisant, tu peux compléter par carte ou en espèces.</Text>
        </View>

        <View style={st.carte}>
          <Text style={st.carteTitre}>Historique</Text>
          {mouvements.length === 0 ? (
            <Text style={st.petit}>Aucun mouvement pour l’instant.</Text>
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
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  titre: { fontFamily: F.titre, fontSize: 26, color: C.violet, marginTop: 14 },
  sousTitre: { fontFamily: F.t400, fontSize: 14, color: C.texte2, marginTop: 4, marginBottom: 16, lineHeight: 20 },
  soldeCarte: { backgroundColor: C.violet, borderRadius: R.carte, padding: 22, marginBottom: 14, ...OMBRE },
  soldeLabel: { fontFamily: F.t600, fontSize: 13, color: '#CFC4E8' },
  soldeMontant: { fontFamily: F.titre, fontSize: 42, color: C.blanc, marginVertical: 4 },
  soldeNote: { fontFamily: F.t400, fontSize: 12.5, color: '#CFC4E8', lineHeight: 18 },
  carte: { backgroundColor: C.carte, borderRadius: R.carte, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: C.bord, gap: 10, ...OMBRE },
  demandeCarte: { borderWidth: 2, borderColor: C.vert },
  carteTitre: { fontFamily: F.t800, fontSize: 16, color: C.violet },
  ligne: { fontFamily: F.t400, fontSize: 14, color: C.texte, lineHeight: 21 },
  etape: { fontFamily: F.t700, fontSize: 13.5, color: C.violetProfond, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipTexteActif: { color: C.blanc },
  chipMontant: { minWidth: 70, alignItems: 'center', borderWidth: 1.5, borderColor: C.bord, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.fond },
  chipMontantActif: { backgroundColor: C.violet, borderColor: C.violet },
  chipMontantTexte: { fontFamily: F.t800, fontSize: 13.5, color: C.violet },
  label: { fontFamily: F.t600, fontSize: 12, color: C.texte2 },
  input: { borderWidth: 1.5, borderColor: C.bord, borderRadius: 14, backgroundColor: C.fond, paddingHorizontal: 14, paddingVertical: 12, fontFamily: F.t700, fontSize: 17, color: C.texte },
  recap: { backgroundColor: C.lavande, borderRadius: 16, padding: 14, gap: 3 },
  recapLabel: { fontFamily: F.t600, fontSize: 12, color: C.texte2 },
  recapValeur: { fontFamily: F.titre, fontSize: 27, color: C.violet },
  recapBonus: { fontFamily: F.t700, fontSize: 12.5, color: C.vertFonce },
  recapTotal: { fontFamily: F.t800, fontSize: 13.5, color: C.violetProfond },
  demandeMontant: { fontFamily: F.titre, fontSize: 27, color: C.violet },
  avertissement: { backgroundColor: C.jaunePale, borderRadius: 14, padding: 12 },
  avertissementTexte: { fontFamily: F.t600, fontSize: 12.5, color: C.violetProfond, lineHeight: 18 },
  bonusPill: { backgroundColor: C.vertPale, borderRadius: 14, padding: 12 },
  bonusTexte: { fontFamily: F.t700, fontSize: 13, color: C.vertFonce, lineHeight: 19, textAlign: 'center' },
  petit: { fontFamily: F.t400, fontSize: 12.5, color: C.texte3, lineHeight: 18, textAlign: 'center' },
  mvt: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.bord },
  mvtType: { fontFamily: F.t600, fontSize: 14, color: C.texte },
  mvtDate: { fontFamily: F.t400, fontSize: 12, color: C.texte3, marginTop: 1 },
  mvtMontant: { fontFamily: F.t700, fontSize: 15 },
  mvtCredit: { color: C.vertFonce },
  mvtDebit: { color: C.danger },
});
