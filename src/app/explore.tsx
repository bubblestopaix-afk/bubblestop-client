// === Fidélité : carte membre avec QR scannable en caisse ===
// Le QR encode le numéro de carte, exactement ce que lit le lecteur 2D du POS.
// Tampons en temps réel (Supabase realtime + rafraîchissement 30 s).
import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, ScrollView, Platform, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'qrcode';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import GobeletBubble from '@/components/gobelet-bubble';
import { C, F, R, OMBRE } from '@/constants/charte';
import { BoutonPrimaire, BoutonGhost, Message } from '@/components/ui-kit';

// Rend un QR en pur React Native (grille de Views, zéro dépendance native)
function QrView({ valeur, taille = 210 }: { valeur: string; taille?: number }) {
  const [matrice, setMatrice] = useState<{ size: number; data: Uint8Array } | null>(null);

  useEffect(() => {
    try {
      const qr = QRCode.create(valeur, { errorCorrectionLevel: 'M' });
      setMatrice(qr.modules as any);
    } catch (e) {
      setMatrice(null);
    }
  }, [valeur]);

  if (!matrice) return null;
  const n = matrice.size;
  const cellule = taille / n;
  const lignes = [];
  for (let y = 0; y < n; y++) {
    const cases = [];
    for (let x = 0; x < n; x++) {
      cases.push(
        <View
          key={x}
          style={{ width: cellule, height: cellule, backgroundColor: matrice.data[y * n + x] ? '#1A1325' : '#fff' }}
        />
      );
    }
    lignes.push(<View key={y} style={{ flexDirection: 'row' }}>{cases}</View>);
  }
  return <View style={{ padding: 14, backgroundColor: '#fff', borderRadius: 16 }}>{lignes}</View>;
}

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
      const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
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
  const [tel, setTel] = useState('');
  // Numéro de fidélité du COMPTE (le QR et la carte en découlent)
  const [numero, setNumero] = useState<string | null>(null);
  const [carte, setCarte] = useState<any>(undefined);
  const [connecte, setConnecte] = useState(true);
  const [enreg, setEnreg] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Tampons en TEMPS RÉEL pour le numéro du compte
  const chargerCarte = useCallback(async (t: string) => {
    const { data } = await supabase
      .from('fidelite_cloud')
      .select('tampons, cadeaux, tampons_par_carte')
      .eq('telephone', t)
      .maybeSingle();
    setCarte(data ?? null);
  }, []);

  useEffect(() => {
    if (!numero) return;
    chargerCarte(numero);
    const canal = supabase
      .channel(`fidelite-${numero}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'fidelite_cloud', filter: `telephone=eq.${numero}` },
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
    if (data?.numero_fidelite) { setNumero(data.numero_fidelite); setTel(data.numero_fidelite); }
    else setNumero(null);
  }, []);

  useEffect(() => {
    charger();
    const { data: sub } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === 'SIGNED_IN' || evt === 'SIGNED_OUT') { setCarte(undefined); charger(); }
    });
    return () => sub.subscription.unsubscribe();
  }, [charger]);

  // Relie le numéro au compte (modifiable ici, et corrigeable côté caisse)
  const [bienvenue, setBienvenue] = useState<string | null>(null);
  const enregistrerNumero = async () => {
    const t = tel.replace(/\D/g, '');
    if (t.length !== 10) { setMsg('Entre un numéro à 10 chiffres.'); return; }
    setEnreg(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setMsg('Connecte-toi dans l\'onglet Compte.'); return; }
      // 1ère liaison ? (le trigger Supabase crédite alors +1 tampon de bienvenue)
      const { data: avant } = await supabase.from('profils')
        .select('bonus_app').eq('id', session.user.id).maybeSingle();
      const { error } = await supabase.from('profils')
        .update({ numero_fidelite: t, telephone: t }).eq('id', session.user.id);
      if (error) {
        setMsg(error.code === '23505'
          ? 'Ce numéro est déjà relié à un autre compte.'
          : String(error.message));
        return;
      }
      AsyncStorage.setItem('fidelite.tel', t).catch(() => {});
      if (avant && avant.bonus_app === false) {
        setBienvenue('🎁 Carte activée ! Ton tampon de bienvenue arrive d\'ici quelques minutes.');
      }
      setNumero(t);
    } finally {
      setEnreg(false);
    }
  };

  const changerNumero = () => { setNumero(null); setCarte(undefined); setMsg(null); };

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

            <Text style={styles.secours}>
              Pas ton téléphone ? Donne ton numéro + code PIN au comptoir.
            </Text>

            <BoutonGhost titre="Changer de numéro" onPress={changerNumero} />
          </>
        ) : (
          <View style={styles.liaison}>
            <Text style={styles.liaisonTitre}>Active ta carte</Text>
            <Text style={styles.aide}>
              Relie ton numéro de téléphone à ton compte pour activer ta carte de fidélité.
              {'\n\n'}Ton numéro ne sert jamais au démarchage : il identifie simplement ta
              carte, en secours si tu n'as pas ton QR sous la main.
            </Text>
            <TextInput
              style={styles.input}
              value={tel}
              onChangeText={setTel}
              placeholder="06 12 34 56 78"
              placeholderTextColor={C.texte3}
              keyboardType="number-pad"
              maxLength={14}
            />
            {msg && <Message type="erreur" texte={msg} />}
            <BoutonPrimaire
              titre={enreg ? '…' : 'Activer ma carte'}
              onPress={enregistrerNumero}
              disabled={tel.replace(/\D/g, '').length !== 10 || enreg}
            />
          </View>
        )}

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
