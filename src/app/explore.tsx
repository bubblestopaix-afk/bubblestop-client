// === Fidélité : carte membre avec QR scannable en caisse ===
// Le QR encode le numéro de carte, exactement ce que lit le lecteur 2D du POS.
// Tampons en temps réel (Supabase realtime + rafraîchissement 30 s).
import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, Platform, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import GobeletBubble from '@/components/gobelet-bubble';
import Parrainage from '@/components/parrainage';
import QrView from '@/components/qr-view';
import { C, F, R, OMBRE } from '@/constants/charte';
import { BoutonPrimaire, BoutonGhost, Message } from '@/components/ui-kit';

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
          <Text style={styles.walletAppleTxt}>{busy === 'apple' ? 'Ouverture…' : 'Ajouter à Apple Wallet'}</Text>
        </Pressable>
      )}
      {montrerGoogle && (
        <Pressable style={[styles.walletBtn, styles.walletGoogle]} onPress={() => ouvrir('google')} disabled={!!busy}>
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

  // Tampons en TEMPS RÉEL pour le numéro du compte
  const [histo, setHisto] = useState<any[] | null>(null); // historique des cartes complétées
  const chargerCarte = useCallback(async (t: string) => {
    const { data } = await supabase
      .from('fidelite_cloud')
      .select('tampons, cadeaux, tampons_par_carte, cartes_completees')
      .eq('numero_fidelite', t)
      .maybeSingle();
    setCarte(data ?? null);
    // Historique des cartes remplies (RLS : chacun ne voit que les siennes)
    const { data: h } = await supabase
      .from('fidelite_cartes')
      .select('completed_le, magasin')
      .order('completed_le', { ascending: false })
      .limit(30);
    setHisto(h ?? []);
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
    const { data: { session } } = await supabase.auth.getSession();
    setConnecte(!!session);
    if (!session) { setNumero(null); return; }
    const { data } = await supabase
      .from('profils').select('numero_fidelite').eq('id', session.user.id).maybeSingle();
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
  const [bienvenue, setBienvenue] = useState<string | null>(null);
  const activerCarte = async () => {
    setEnreg(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setMsg('Connecte-toi dans l\'onglet Compte.'); return; }
      const { data: avant } = await supabase.from('profils')
        .select('bonus_app').eq('id', session.user.id).maybeSingle();
      const { data, error } = await supabase.rpc('activer_ma_carte');
      if (error || !data) { setMsg(error?.message || 'Activation impossible, réessaie.'); return; }
      const code = String(data);
      AsyncStorage.setItem('fidelite.numero', code).catch(() => {});
      if (avant && avant.bonus_app === false) {
        setBienvenue('🎁 Carte activée ! Ton tampon de bienvenue arrive d\'ici quelques minutes.');
      }
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
          <Text style={{ fontSize: 40 }}>🎟</Text>
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
      <ScrollView contentContainerStyle={[styles.contenu, { paddingTop: insets.top + 18 }]}>
        <Text style={styles.titre}>Fidélité</Text>

        {numero ? (
          <>
            {/* Bonus de bienvenue crédité à la 1ère liaison */}
            {bienvenue && <Message type="ok" texte={bienvenue} />}
            {/* === Carte membre violette avec QR === */}
            <View style={styles.carteMembre}>
              {/* Cercles décoratifs */}
              <View style={[styles.deco, { top: -38, right: -30, width: 130, height: 130 }]} />
              <View style={[styles.deco, { bottom: -46, left: -36, width: 150, height: 150 }]} />
              <Text style={styles.carteMembreLogo}>BUBBLE STOP</Text>
              <View style={{ alignItems: 'center' }}>
                <QrView valeur={numero} />
              </View>
              <Text style={styles.carteMembreNumero}>{numero.replace(/(\d{2})(?=\d)/g, '$1 ')}</Text>
              <Text style={styles.carteMembreAide}>Présente ce code en caisse pour cumuler tes tampons</Text>
            </View>

            <BoutonsWallet />

            <CarteTampons
              tampons={carte?.tampons || 0}
              parCarte={carte?.tampons_par_carte || 9}
              cadeaux={carte?.cadeaux || 0}
            />

            {/* === Historique des cartes complétées (les cartes se cumulent : chaque carte
                pleine = une grande boisson offerte, gardée tant qu'elle n'est pas utilisée) === */}
            {(Number(carte?.cartes_completees) || 0) > 0 && (
              <View style={styles.histoCarte}>
                <Text style={styles.histoTitre}>
                  🏆 Mes cartes complétées — {carte.cartes_completees}
                </Text>
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
                    + {carte.cartes_completees - (histo?.length ?? 0)} carte{carte.cartes_completees - (histo?.length ?? 0) > 1 ? 's' : ''} complétée{carte.cartes_completees - (histo?.length ?? 0) > 1 ? 's' : ''} avant la mise en place de l'historique 💜
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
            <Text style={styles.aide}>
              Active ta carte de fidélité en un geste. Tu reçois un numéro de fidélité
              et un QR à présenter en caisse.
              {'\n\n'}📵 Aucun téléphone requis, aucun SMS, jamais de démarchage.
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

        {/* Carte express (QR pris à la borne) : saisir le jeton pour récupérer les tampons */}
        <BoutonGhost titre="🎟️ J'ai une carte express — saisir mon jeton" onPress={() => router.push('/c' as any)} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  contenu: { padding: 18, gap: 14, paddingBottom: 32 },
  titre: { fontFamily: F.titre, fontSize: 26, color: C.violet },

  // Historique des cartes complétées
  histoCarte: { backgroundColor: C.carte, borderRadius: 20, padding: 18, gap: 8, ...OMBRE },
  histoTitre: { fontFamily: F.t800, fontSize: 15, color: C.violetProfond, marginBottom: 2 },
  histoLigne: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.lavande, paddingTop: 8 },
  histoDate: { fontFamily: F.t600, fontSize: 13.5, color: C.texte },
  histoMag: { fontFamily: F.t700, fontSize: 13, color: C.violetClair },
  histoNote: { fontFamily: F.t400, fontSize: 12, color: C.texte2, marginTop: 4 },

  // Carte membre violette
  carteMembre: {
    backgroundColor: C.violet, borderRadius: 24, padding: 22, gap: 12,
    overflow: 'hidden', ...OMBRE,
  },
  deco: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  carteMembreLogo: { fontFamily: F.titre, fontSize: 15, color: '#fff', letterSpacing: 1, textAlign: 'center' },
  carteMembreNumero: { fontFamily: F.t800, fontSize: 19, color: '#fff', letterSpacing: 1.5, textAlign: 'center' },
  carteMembreAide: { fontFamily: F.t600, fontSize: 12.5, color: C.lavande, textAlign: 'center', opacity: 0.85 },

  // Boutons « Ajouter au Wallet »
  walletWrap: { gap: 10 },
  walletBtn: { borderRadius: R.btn, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', ...OMBRE },
  walletApple: { backgroundColor: '#000' },
  walletAppleTxt: { fontFamily: F.t700, fontSize: 15, color: '#fff' },
  walletGoogle: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.bord },
  walletGoogleTxt: { fontFamily: F.t700, fontSize: 15, color: '#3C4043' },

  // Tampons
  carteFid: { backgroundColor: C.carte, borderRadius: R.carte, padding: 18, gap: 12, ...OMBRE },
  carteFidHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  carteFidTitre: { fontFamily: F.titre, fontSize: 16, color: C.violet },
  carteFidCompteur: { fontFamily: F.t800, fontSize: 15, color: C.vertFonce },
  tampons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  tampon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.lavande,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#DED5EC',
  },
  tamponPlein: { backgroundColor: C.vertPale, borderColor: C.vert },
  tamponTexte: { fontFamily: F.t800, fontSize: 14, color: C.texte3 },
  tamponTexteRempli: { fontSize: 17, color: C.violet },
  tamponCadeau: { backgroundColor: '#FFF3DD', borderColor: '#E8C89A' },
  carteFidInfo: { fontFamily: F.t600, fontSize: 13, color: C.texte2, textAlign: 'center' },
  cadeau: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.vertPale, borderRadius: 12, padding: 12,
    borderWidth: 1.5, borderColor: C.vert,
  },
  cadeauTexte: { flex: 1, fontFamily: F.t700, fontSize: 13.5, color: C.violetProfond, lineHeight: 19 },

  secours: { fontFamily: F.t400, fontSize: 12.5, color: C.texte3, textAlign: 'center', lineHeight: 18 },

  // Liaison du numéro
  liaison: { backgroundColor: C.carte, borderRadius: R.carte, padding: 22, gap: 14, ...OMBRE },
  liaisonTitre: { fontFamily: F.t800, fontSize: 18, color: C.texte, textAlign: 'center' },
  aide: { fontFamily: F.t400, fontSize: 14, color: C.texte2, textAlign: 'center', lineHeight: 21 },
  input: {
    backgroundColor: C.fond, borderRadius: 14, borderWidth: 1.5, borderColor: C.bord,
    padding: 16, fontFamily: F.t700, fontSize: 21, textAlign: 'center', color: C.texte,
  },

  videCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 28,
    alignItems: 'center', gap: 10, ...OMBRE,
  },
  videTitre: { fontFamily: F.t800, fontSize: 17, color: C.texte },
});
