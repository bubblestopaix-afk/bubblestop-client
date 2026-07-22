// === Fidélité : carte membre avec QR scannable en caisse ===
// Le QR encode le numéro de carte, exactement ce que lit le lecteur 2D du POS.
// Tampons en temps réel (Supabase realtime + rafraîchissement 30 s).
import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, Pressable, ScrollView, Platform, Linking, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { SvgXml } from 'react-native-svg';

import { supabase } from '@/lib/supabase';
import GobeletBubble from '@/components/gobelet-bubble';
import Parrainage from '@/components/parrainage';
import QrView from '@/components/qr-view';
import { BORD, C, F, OMBRE, OMBRE_VIOLETTE, R } from '@/constants/charte';
import { BoutonPrimaire, Etincelle, Message, TitreKawaii, Vague } from '@/components/ui-kit';
import { IconeApp } from '@/components/icones-app';
import { LogoBubbleStop } from '@/components/logo-bubblestop';
import { AppleLogo, GoogleWalletLogo } from '@/components/wallet-logos';
import { useFonctionnalite } from '@/lib/fonctionnalites';

// Carte de tampons : 9 cases (✓ ou numéro, comme sur le POS) + la 10e case
// "boisson offerte" avec le gobelet bubble tea dessiné, identique à la borne.
function CarteTampons({ tampons, parCarte, cadeaux }: { tampons: number; parCarte: number; cadeaux: number }) {
  const restant = parCarte - tampons;
  return (
    <View style={styles.carteFid}>
      <View style={styles.carteFidHaut}>
        <Text style={styles.carteFidTitre}>Mes tampons</Text>
        <Text style={styles.carteFidCompteur}>{tampons}/{parCarte}</Text>
      </View>
      <View style={styles.tampons}>
        {Array.from({ length: parCarte }).map((_, i) => (
          <View key={i} style={[styles.tampon, i < tampons && styles.tamponPlein]}>
            <Text style={[styles.tamponTexte, i < tampons && styles.tamponTexteRempli]}>
              {i < tampons ? '✓' : i + 1}
            </Text>
          </View>
        ))}
        {/* 10e case : la boisson offerte (design POS) */}
        <View style={[styles.tampon, styles.tamponCadeau]}>
          <GobeletBubble size={30} />
        </View>
      </View>
      <Text style={styles.carteFidInfo}>
        Encore {restant} boisson{restant > 1 ? 's' : ''} avant ta boisson taille L offerte (M pour Signature)
      </Text>
      {cadeaux > 0 && (
        <View style={styles.cadeau}>
          <GobeletBubble size={34} avecL />
          <Text style={styles.cadeauTexte}>
            {cadeaux} boisson{cadeaux > 1 ? 's' : ''} taille L offerte{cadeaux > 1 ? 's' : ''} (M
            pour Signature) à réclamer en caisse !
          </Text>
        </View>
      )}
    </View>
  );
}

// Boutons « Ajouter au Wallet » — ouvrent l'Edge Function wallet-pass avec le jeton
// de session en query (le navigateur système ne peut pas poser d'en-tête Authorization).
// iOS → renvoie le .pkpass (Safari propose « Ajouter à Apple Wallet »).
// Android → redirige vers la page « Enregistrer dans Google Wallet ».
function BoutonsWallet() {
  const [busy, setBusy] = useState<null | 'apple' | 'google'>(null);
  const ouvrir = useCallback(async (plateforme: 'apple' | 'google') => {
    try {
      setBusy(plateforme);
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const base = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zpnoopitysojsvuqnbuo.supabase.co';
      if (!token || !base) return;
      const url = `${base}/functions/v1/wallet-pass?platform=${plateforme}&token=${encodeURIComponent(token)}`;
      await Linking.openURL(url);
    } catch {
      /* silencieux */
    } finally {
      setBusy(null);
    }
  }, []);

  const montrerApple = Platform.OS === 'ios' || Platform.OS === 'web';
  const montrerGoogle = Platform.OS === 'android' || Platform.OS === 'web';
  return (
    <View style={styles.walletWrap}>
      {montrerApple && (
        <Pressable style={[styles.walletBtn, styles.walletApple]} onPress={() => ouvrir('apple')} disabled={!!busy}>
          <AppleLogo />
          <Text style={styles.walletAppleTxt}>{busy === 'apple' ? 'Ouverture…' : 'Ajouter à Apple Wallet'}</Text>
        </Pressable>
      )}
      {montrerGoogle && (
        <Pressable style={[styles.walletBtn, styles.walletGoogle]} onPress={() => ouvrir('google')} disabled={!!busy}>
          <GoogleWalletLogo />
          <Text style={styles.walletGoogleTxt}>{busy === 'google' ? 'Ouverture…' : 'Ajouter à Google Wallet'}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function FideliteScreen() {
  const insets = useSafeAreaInsets();
  // Numéro de fidélité du COMPTE (le QR et la carte en découlent)
  const [numero, setNumero] = useState<string | null>(null);
  const [carte, setCarte] = useState<any>(undefined);
  const [connecte, setConnecte] = useState(true);
  const [enreg, setEnreg] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erreurChargement, setErreurChargement] = useState(false);
  const carteCadeau = useFonctionnalite('carte_cadeau');

  // Tampons en TEMPS RÉEL pour le numéro du compte
  const [histo, setHisto] = useState<any[] | null>(null); // historique des cartes complétées
  const chargerCarte = useCallback(async (t: string) => {
    const { data, error } = await supabase
      .from('fidelite_cloud')
      .select('tampons, cadeaux, tampons_par_carte, cartes_completees, solde_centimes')
      .eq('numero_fidelite', t)
      .maybeSingle();
    if (error) { setErreurChargement(true); return; }
    setCarte(data ?? null);
    // Historique des cartes remplies (RLS : chacun ne voit que les siennes)
    const { data: h, error: erreurHisto } = await supabase
      .from('fidelite_cartes')
      .select('completed_le, magasin')
      .order('completed_le', { ascending: false })
      .limit(30);
    if (erreurHisto) setErreurChargement(true);
    else setHisto(h ?? []);
    if (!erreurHisto) setErreurChargement(false);
  }, []);

  useEffect(() => {
    if (!numero) return;
    chargerCarte(numero);
    const canal = supabase
      .channel(`fidelite-${numero}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'fidelite_cloud', filter: `numero_fidelite=eq.${numero}` },
        (payload: any) => { if (payload.new) setCarte(payload.new); })
      .subscribe();
    const it = setInterval(() => chargerCarte(numero), 30000);
    return () => { supabase.removeChannel(canal); clearInterval(it); };
  }, [numero, chargerCarte]);

  // La fidélité est gérée par le COMPTE : le numéro vient du profil
  const charger = useCallback(async () => {
    const { data: { session }, error: erreurSession } = await supabase.auth.getSession();
    if (erreurSession) { setErreurChargement(true); return; }
    setConnecte(!!session);
    if (!session) { setNumero(null); return; }
    const { data, error } = await supabase
      .from('profils').select('numero_fidelite').eq('id', session.user.id).maybeSingle();
    if (error) { setErreurChargement(true); return; }
    setErreurChargement(false);
    if (data?.numero_fidelite) setNumero(data.numero_fidelite);
    else setNumero(null);
  }, []);

  useEffect(() => {
    charger();
    const { data: sub } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === 'SIGNED_IN' || evt === 'SIGNED_OUT') { setCarte(undefined); charger(); }
    });
    return () => sub.subscription.unsubscribe();
  }, [charger]);

  // Active la carte du compte : un NUMÉRO DE FIDÉLITÉ unique est généré côté serveur (RPC),
  // sans téléphone. Le trigger crédite +1 tampon de bienvenue à la 1ère activation.
  const [bienvenue, setBienvenue] = useState(false);
  const activerCarte = async () => {
    setEnreg(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setMsg('Connecte-toi dans l\'onglet Compte.'); return; }
      const { data, error } = await supabase.rpc('activer_ma_carte');
      if (error || !data) { setMsg(error?.message || 'Activation impossible, réessaie.'); return; }
      const code = String(data);
      AsyncStorage.setItem('fidelite.numero', code).catch(() => {});
      // L'écran d'activation n'est affiché que lorsqu'aucune carte n'existe encore :
      // annoncer systématiquement le cadeau évite qu'il passe inaperçu.
      setBienvenue(true);
      setCarte(undefined);
      setNumero(code);
    } finally {
      setEnreg(false);
    }
  };

  // Pas connecté : la fidélité est liée au compte
  if (!connecte) {
    return (
      <View style={[styles.fond, { justifyContent: 'center', padding: 24 }]}>
        <View style={styles.videCarte}>
          <IconeApp nom="ticket" taille={44} />
          <Text style={styles.videTitre}>Ma carte de fidélité</Text>
          <Text style={styles.aide}>
            Connecte-toi dans l'onglet Compte pour accéder à ta carte et ton QR.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fond}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.contenu, { paddingTop: insets.top + 18 }]}
        keyboardShouldPersistTaps="handled"
      >
        <TitreKawaii texte="Fidélité" taille={24} />

        {erreurChargement && (
          <View accessibilityRole="alert">
            <Message type="erreur" texte="Impossible d'actualiser ta carte. Vérifie ta connexion." />
            <BoutonPrimaire titre="Réessayer" onPress={() => { charger(); if (numero) chargerCarte(numero); }} />
          </View>
        )}

        {numero ? (
          <>
            {/* Confirmation forte après la toute première activation. Le crédit est serveur :
                il peut mettre quelques instants à apparaître dans la grille temps réel. */}
            {bienvenue && (
              <View style={styles.bienvenueCarte} accessibilityRole="alert">
                <View style={styles.bienvenuePastille}>
                  <Text style={styles.bienvenuePlus}>+1</Text>
                </View>
                <View style={styles.bienvenueContenu}>
                  <Text style={styles.bienvenueTitre}>Ton premier tampon est offert !</Text>
                  <Text style={styles.bienvenueTexte}>
                    Ta carte est activée. Le tampon de bienvenue est ajouté automatiquement — rien à faire en caisse.
                    Il peut apparaître dans quelques instants.
                  </Text>
                </View>
              </View>
            )}
            {/* === Carte membre violette avec QR === */}
            <View style={styles.carteMembre}>
              {/* Vagues — COPIER-COLLER du <svg> de la maquette 1b */}
              <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
                <SvgXml width="100%" height="100%" xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 250" preserveAspectRatio="none"><path d="M-20,30 Q40,18 100,30 T220,30 T340,30 T460,30 L460,-20 L-20,-20 Z" fill="#f2a7cf" opacity=".1"></path><path d="M-20,228 Q60,242 140,228 T300,228 T460,228 L460,270 L-20,270 Z" fill="#452a6e" opacity=".35"></path></svg>`} />
              </View>
              <Etincelle taille={15} style={{ position: 'absolute', top: 44, left: 16, opacity: 0.8 }} />
              <Etincelle taille={12} couleur="#EAE8F5" style={{ position: 'absolute', bottom: 52, right: 20, opacity: 0.45 }} />
              <View style={{ alignItems: 'center' }}><LogoBubbleStop variante="blanc" largeur={118} /></View>
              <View style={{ alignItems: 'center' }}>
                <QrView valeur={numero} />
              </View>
              <Text style={styles.carteMembreNumero}>{numero.replace(/(\d{2})(?=\d)/g, '$1 ')}</Text>
              <Text style={styles.carteMembreAide}>Présente ce code en caisse pour cumuler tes tampons</Text>
              <Vague hauteur={22} />
            </View>

            <BoutonsWallet />

            <CarteTampons
              tampons={carte?.tampons || 0}
              parCarte={carte?.tampons_par_carte || 9}
              cadeaux={carte?.cadeaux || 0}
            />

            {/* Le solde prépayé appartient à cette même carte fidélité : aucun second code. */}
            {carteCadeau.actif && <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Mon solde prépayé, ${(Number(carte?.solde_centimes) || 0) / 100} euros`}
              style={styles.soldeCarte}
              onPress={() => router.push('/carte-cadeau')}>
              <View style={styles.soldeIcone}>
                <IconeApp nom="carte" taille={22} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.soldeTitre]}>Mon solde prépayé</Text>
                <Text style={[styles.soldeSousTitre]}>
                  Recharge en boutique · utilise-le avec ton QR fidélité
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 1 }}>
                <Text style={[styles.soldeMontant]}>
                  {((Number(carte?.solde_centimes) || 0) / 100).toFixed(2).replace('.', ',')} €
                </Text>
                <Text style={[styles.soldeChevron]}>›</Text>
              </View>
            </Pressable>}

            {/* === Historique des cartes complétées (les cartes se cumulent : chaque carte
                pleine = une grande boisson offerte, gardée tant qu'elle n'est pas utilisée) === */}
            {(Number(carte?.cartes_completees) || 0) > 0 && (
              <View style={styles.histoCarte}>
                <View style={styles.histoTitreRang}>
                  <IconeApp nom="carte" taille={16} />
                  <Text style={styles.histoTitre}>Mes cartes complétées — {carte.cartes_completees}</Text>
                </View>
                {(histo ?? []).map((h, i) => (
                  <View key={i} style={styles.histoLigne}>
                    <Text style={styles.histoDate}>
                      {new Date(h.completed_le).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </Text>
                    <Text style={styles.histoMag}>
                      {h.magasin ? h.magasin.charAt(0).toUpperCase() + h.magasin.slice(1) : ''}
                    </Text>
                  </View>
                ))}
                {(Number(carte?.cartes_completees) || 0) > (histo?.length ?? 0) && (
                  <Text style={styles.histoNote}>
                    + {carte.cartes_completees - (histo?.length ?? 0)} carte{carte.cartes_completees - (histo?.length ?? 0) > 1 ? 's' : ''} complétée{carte.cartes_completees - (histo?.length ?? 0) > 1 ? 's' : ''} avant la mise en place de l'historique
                  </Text>
                )}
              </View>
            )}

            <Text style={styles.secours}>
              Pas ton QR sous la main ? Donne ton numéro de fidélité au comptoir.
            </Text>
          </>
        ) : (
          <View style={styles.liaison}>
            <Text style={styles.liaisonTitre}>Active ta carte</Text>
            <View style={styles.bonusActivation}>
              <Text style={styles.bonusActivationNombre}>+1</Text>
              <Text style={styles.bonusActivationTexte}>tampon de bienvenue offert dès l'activation</Text>
            </View>
            <Text style={styles.aide}>
              Active ta carte de fidélité en un geste. Tu reçois un numéro de fidélité
              et un QR à présenter en caisse.
              {'\n\n'}Aucun téléphone requis, aucun SMS, jamais de démarchage.
            </Text>
            {msg && <Message type="erreur" texte={msg} />}
            <BoutonPrimaire
              titre={enreg ? '…' : 'Activer ma carte'}
              onPress={activerCarte}
              disabled={enreg}
            />
          </View>
        )}

        {/* 🤝 Parrainage : mon code + saisir un code (récompenses à la 1ère commande du filleul) */}
        <Parrainage />

      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  contenu: { padding: 18, gap: 14, paddingBottom: 32 },
  titre: { fontFamily: F.titre, fontSize: 26, color: C.violet },

  // Confirmation de la création de carte et du bonus de bienvenue
  bienvenueCarte: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.vertPale, borderRadius: 18, padding: 15,
    borderWidth: 1.5, borderColor: C.vert,
  },
  bienvenuePastille: {
    width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.vert,
  },
  bienvenuePlus: { fontFamily: F.titre, fontSize: 19, color: C.violetProfond },
  bienvenueContenu: { flex: 1, gap: 3 },
  bienvenueTitre: { fontFamily: F.t800, fontSize: 15, color: C.violetProfond },
  bienvenueTexte: { fontFamily: F.t600, fontSize: 12.5, lineHeight: 18, color: C.texte2 },

  // Historique des cartes complétées
  histoCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 18, gap: 8,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  histoTitre: { fontFamily: F.t800, fontSize: 15, color: C.violetProfond },
  histoTitreRang: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  histoLigne: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.lavande, paddingTop: 8 },
  histoDate: { fontFamily: F.t600, fontSize: 13.5, color: C.texte },
  histoMag: { fontFamily: F.t700, fontSize: 13, color: C.violetClair },
  histoNote: { fontFamily: F.t400, fontSize: 12, color: C.texte2, marginTop: 4 },

  // Carte membre violette
  carteMembre: {
    backgroundColor: C.violet, borderRadius: 26, padding: 18, gap: 10,
    overflow: 'hidden', ...OMBRE_VIOLETTE,
  },
  carteMembreLogo: { fontFamily: F.titre, fontSize: 15, color: '#fff', letterSpacing: 1, textAlign: 'center' },
  carteMembreNumero: { fontFamily: F.t800, fontSize: 17, color: '#fff', letterSpacing: 1.5, textAlign: 'center' },
  carteMembreAide: { fontFamily: F.t500, fontSize: 12, color: '#B9A9D8', textAlign: 'center' },

  // Boutons « Ajouter au Wallet »
  walletWrap: { flexDirection: 'row', gap: 9 },
  walletBtn: { flex: 1, minHeight: 49, borderRadius: R.btn, paddingVertical: 11, paddingHorizontal: 10, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', ...OMBRE },
  walletApple: { backgroundColor: '#000' },
  walletAppleTxt: { fontFamily: F.t700, fontSize: 12.5, color: '#fff' },
  walletGoogle: { backgroundColor: '#fff', borderWidth: 2, borderColor: C.bord },
  walletGoogleTxt: { fontFamily: F.t700, fontSize: 12.5, color: '#3C4043' },

  // Tampons
  carteFid: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 18, gap: 12,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  carteFidHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  carteFidTitre: { fontFamily: F.titre, fontSize: 16, color: C.violet },
  carteFidCompteur: { fontFamily: F.t800, fontSize: 15, color: C.vertFonce },
  tampons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  tampon: {
    width: 37, height: 37, borderRadius: 19, backgroundColor: C.lavande,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#DED5EC',
  },
  tamponPlein: { backgroundColor: C.vertPale, borderColor: C.vert },
  tamponTexte: { fontFamily: F.t800, fontSize: 14, color: C.texte3 },
  tamponTexteRempli: { fontSize: 16, color: C.vertFonce },
  tamponCadeau: { backgroundColor: C.jaunePale, borderColor: C.jaune },
  carteFidInfo: { fontFamily: F.t600, fontSize: 13, color: C.texte2, textAlign: 'center' },
  cadeau: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.vertPale, borderRadius: 12, padding: 12,
    borderWidth: 1.5, borderColor: C.vert,
  },
  cadeauTexte: { flex: 1, fontFamily: F.t700, fontSize: 13.5, color: C.violetProfond, lineHeight: 19 },

  // Solde prépayé : accès volontairement dans Fidélité, pas un 5e onglet.
  soldeCarte: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.carte, borderRadius: R.carte, padding: 16,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  soldeCarteAvecSolde: { backgroundColor: C.violet, borderColor: C.violet },
  soldeIcone: {
    width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.rosePale,
  },
  soldeTitre: { fontFamily: F.t800, fontSize: 14.5, color: C.texte },
  soldeSousTitre: { fontFamily: F.t400, fontSize: 11.5, lineHeight: 16, color: C.texte2 },
  soldeMontant: { fontFamily: F.titre, fontSize: 16, color: C.violet },
  soldeChevron: { fontFamily: F.t700, fontSize: 18, lineHeight: 18, color: C.texte3 },
  soldeTexteClair: { color: C.blanc },
  soldeTexteSecondaireClair: { color: C.lavande },

  secours: { fontFamily: F.t400, fontSize: 12, color: C.texte3, textAlign: 'center', lineHeight: 18 },

  // Liaison du numéro
  liaison: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 22, gap: 14,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  liaisonTitre: { fontFamily: F.titre, fontSize: 18, color: C.violet, textAlign: 'center' },
  bonusActivation: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.vertPale, borderRadius: R.pill, paddingVertical: 9, paddingHorizontal: 13,
    borderWidth: 1, borderColor: C.vert,
  },
  bonusActivationNombre: { fontFamily: F.titre, fontSize: 17, color: C.violet },
  bonusActivationTexte: { flexShrink: 1, fontFamily: F.t700, fontSize: 12.5, color: C.violetProfond },
  aide: { fontFamily: F.t400, fontSize: 14, color: C.texte2, textAlign: 'center', lineHeight: 21 },
  input: {
    backgroundColor: C.fond, borderRadius: 14, borderWidth: 1.5, borderColor: C.bord,
    padding: 16, fontFamily: F.t700, fontSize: 21, textAlign: 'center', color: C.texte,
  },

  videCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 28,
    alignItems: 'center', gap: 10,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  videTitre: { fontFamily: F.titre, fontSize: 17, color: C.violet },
});
