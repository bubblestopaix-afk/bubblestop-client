// === Carte de fidélité Bubblestop (QR scannable en caisse) ===
// Le client saisit son numéro une fois ; le QR encode ce numéro, exactement
// ce que lit le lecteur 2D de la caisse. Numéro mémorisé en local.
import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'qrcode';

import { supabase } from '@/lib/supabase';
import GobeletBubble from '@/components/gobelet-bubble';

const VIOLET = '#3A2A5E';
const VIOLET_PROFOND = '#2A1D46';
const VERT = '#A3C724';
const LAVANDE = '#EFE9F6';

// Rend un QR en pur React Native (grille de Views, zéro dépendance native)
function QrView({ valeur, taille = 260 }: { valeur: string; taille?: number }) {
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
          style={{ width: cellule, height: cellule, backgroundColor: matrice.data[y * n + x] ? '#000' : '#fff' }}
        />
      );
    }
    lignes.push(<View key={y} style={{ flexDirection: 'row' }}>{cases}</View>);
  }
  return <View style={{ padding: 12, backgroundColor: '#fff', borderRadius: 12 }}>{lignes}</View>;
}

// Carte de tampons : 9 cases (✓ ou numéro, comme sur le POS) + la 10e case
// "boisson offerte" avec le gobelet bubble tea dessiné, identique à la borne.
function CarteTampons({ tampons, parCarte, cadeaux }: { tampons: number; parCarte: number; cadeaux: number }) {
  const restant = parCarte - tampons;
  return (
    <View style={styles.carteFid}>
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
        {tampons}/{parCarte} — encore {restant} boisson{restant > 1 ? 's' : ''} avant ta
        boisson taille L offerte (M pour Signature)
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

export default function FideliteScreen() {
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
  const enregistrerNumero = async () => {
    const t = tel.replace(/\D/g, '');
    if (t.length !== 10) { setMsg('Entre un numéro à 10 chiffres.'); return; }
    setEnreg(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setMsg('Connecte-toi dans l\'onglet Compte.'); return; }
      const { error } = await supabase.from('profils')
        .update({ numero_fidelite: t, telephone: t }).eq('id', session.user.id);
      if (error) {
        setMsg(error.code === '23505'
          ? 'Ce numéro est déjà relié à un autre compte.'
          : String(error.message));
        return;
      }
      AsyncStorage.setItem('fidelite.tel', t).catch(() => {});
      setNumero(t);
    } finally {
      setEnreg(false);
    }
  };

  const changerNumero = () => { setNumero(null); setCarte(undefined); setMsg(null); };

  // Pas connecté : la fidélité est liée au compte
  if (!connecte) {
    return (
      <View style={styles.fond}>
        <SafeAreaView style={styles.safe}>
          <View style={[styles.contenu, { justifyContent: 'center', flex: 1 }]}>
            <Text style={styles.titre}>Ma carte de fidélité</Text>
            <Text style={styles.aide}>
              Connecte-toi dans l'onglet Compte pour accéder à ta carte de fidélité et ton QR.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.fond}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.contenu}>
          <Text style={styles.titre}>Ma carte de fidélité</Text>

          {numero ? (
            <>
              <QrView valeur={numero} />
              <Text style={styles.tel}>{numero.replace(/(\d{2})(?=\d)/g, '$1 ')}</Text>

              <CarteTampons
                tampons={carte?.tampons || 0}
                parCarte={carte?.tampons_par_carte || 9}
                cadeaux={carte?.cadeaux || 0}
              />

              <Text style={styles.secours}>
                💡 Montre ce QR en caisse pour cumuler tes tampons. Pas ton téléphone ?
                Donne ton numéro + code PIN au comptoir.
              </Text>

              <Pressable style={styles.btnGhost} onPress={changerNumero}>
                <Text style={styles.btnGhostTexte}>Changer de numéro</Text>
              </Pressable>
            </>
          ) : (
            <>
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
                placeholderTextColor="#9a8fb5"
                keyboardType="number-pad"
                maxLength={14}
              />
              {msg && <Text style={styles.liaisonMsg}>{msg}</Text>}
              <Pressable
                style={[styles.btn, tel.replace(/\D/g, '').length !== 10 && styles.btnOff]}
                onPress={enregistrerNumero}
                disabled={enreg}
              >
                <Text style={styles.btnTexte}>{enreg ? '…' : 'Activer ma carte'}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: VIOLET },
  safe: { flex: 1 },
  contenu: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  carteFid: { backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', gap: 10, width: '100%' },
  tampons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  tampon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: LAVANDE,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ded5ec',
  },
  tamponPlein: { backgroundColor: '#EDF5D0', borderColor: VERT },
  tamponTexte: { fontSize: 15, fontWeight: '800', color: '#9a8fb5' },
  tamponTexteRempli: { fontSize: 18, color: VIOLET },
  tamponCadeau: { backgroundColor: '#FFF3DD', borderColor: '#E8C89A' },
  carteFidInfo: { fontSize: 13.5, fontWeight: '700', color: VIOLET_PROFOND },
  secours: { fontSize: 13, color: LAVANDE, textAlign: 'center', lineHeight: 19, opacity: 0.85 },
  liaisonMsg: { color: '#FFD166', fontSize: 14, textAlign: 'center', paddingHorizontal: 16 },
  cadeau: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#EDF5D0', borderRadius: 10, padding: 10,
  },
  cadeauTexte: { flex: 1, fontSize: 14.5, fontWeight: '800', color: VIOLET_PROFOND },
  titre: { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 8 },
  tel: { fontSize: 20, fontWeight: '800', color: LAVANDE, letterSpacing: 1 },
  aide: { fontSize: 15, color: LAVANDE, textAlign: 'center', lineHeight: 22 },
  input: {
    width: '80%', backgroundColor: '#fff', borderRadius: 14, padding: 16,
    fontSize: 22, fontWeight: '700', textAlign: 'center', color: VIOLET_PROFOND,
  },
  btn: {
    backgroundColor: VERT, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32,
  },
  btnOff: { opacity: 0.4 },
  btnTexte: { color: VIOLET_PROFOND, fontWeight: '800', fontSize: 17 },
  btnGhost: { marginTop: 8, padding: 12 },
  btnGhostTexte: { color: LAVANDE, fontWeight: '700', fontSize: 15, textDecorationLine: 'underline' },
});
