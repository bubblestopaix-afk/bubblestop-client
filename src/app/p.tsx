// === Route /p?c=<code> — lien / QR de PARRAINAGE ===
// Le filleul scanne le QR du parrain avec la caméra de son téléphone → cette page
// s'ouvre (appli installée ou appli web commande.bubblestop.fr).
// Connecté : le parrainage s'applique TOUT SEUL. Pas connecté : le code est mémorisé
// et appliqué automatiquement après l'inscription/connexion (_layout).
// Les tampons (parrain + filleul) sont crédités à la 1ère commande du filleul.
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, Linking } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { C, F, OMBRE } from '@/constants/charte';
import { BoutonPrimaire, BoutonGhost, Message } from '@/components/ui-kit';
import { IconeApp } from '@/components/icones-app';
import { memoriserCodeParrain, appliquerParrainEnAttente } from '@/lib/parrainage';

const LIEN_PLAY = 'https://play.google.com/store/apps/details?id=com.bubblestop.client';
const LIEN_IOS = 'https://apps.apple.com/fr/app/id6783475068';

export default function LienParrainage() {
  const { c } = useLocalSearchParams<{ c?: string }>();
  const insets = useSafeAreaInsets();
  const code = String(c || '').replace(/\D/g, '').slice(0, 10);
  const [etat, setEtat] = useState<'chargement' | 'applique' | 'attente' | 'erreur'>('chargement');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      if (code.length < 6) { setEtat('erreur'); setMsg('Ce lien de parrainage est incomplet — demande à ton ami·e de te renvoyer son QR ou son code.'); return; }
      await memoriserCodeParrain(code);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setEtat('attente'); return; }
      const r = await appliquerParrainEnAttente();
      if (r?.ok) { setEtat('applique'); setMsg(r.message); }
      else if (r) { setEtat('erreur'); setMsg(r.message); }
      else { setEtat('attente'); } // edge muet (réseau) : le code reste mémorisé, retenté à la prochaine ouverture
    })();
  }, [code]);

  return (
    <View style={[styles.fond, { paddingTop: insets.top + 24 }]}>
      <View style={styles.carte}>
        <IconeApp nom="coeur" taille={46} />
        <Text style={styles.titre}>Parrainage Bubble Stop</Text>

        {etat === 'chargement' && <Text style={styles.texte}>Un instant…</Text>}

        {etat === 'applique' && (
          <>
            <Message type="ok" texte={msg || 'Parrainage enregistré !'} />
            <Text style={styles.texte}>
              Tes tampons de bienvenue (et ceux de ton parrain) arrivent automatiquement à ta première commande en magasin.
            </Text>
            <BoutonPrimaire titre="Voir ma carte de fidélité" onPress={() => router.replace('/explore')} />
          </>
        )}

        {etat === 'attente' && (
          <>
            <View style={styles.codeBloc}>
              <Text style={styles.codeLabel}>Code parrain enregistré ✓</Text>
              <Text style={styles.code}>{code}</Text>
            </View>
            <Text style={styles.texte}>
              Crée ton compte (ou connecte-toi) : ton parrainage s'appliquera automatiquement,
              et tes tampons de bienvenue tomberont à ta première commande.
            </Text>
            <BoutonPrimaire titre="Créer mon compte / me connecter" onPress={() => router.replace('/compte')} />
            {/* Sur le WEB (scan caméra sans l'appli) : liens stores. Après l'installation,
                l'appli neuve ne connaît pas le code (stockage séparé) → on invite à créer
                le compte ICI d'abord (parrainage lié au COMPTE), l'appli suivra. */}
            {Platform.OS === 'web' && (
              <>
                <Text style={styles.astuce}>
                  Astuce : crée ton compte ici (10 secondes), puis télécharge l'appli et
                  connecte-toi — ton parrainage sera déjà enregistré. Si tu installes l'appli
                  d'abord, note ton code : tu le saisiras dans Fidélité → Parrainage.
                </Text>
                <View style={styles.stores}>
                  <BoutonGhost titre="App Store" onPress={() => Linking.openURL(LIEN_IOS)} />
                  <BoutonGhost titre="Google Play" onPress={() => Linking.openURL(LIEN_PLAY)} />
                </View>
              </>
            )}
            <BoutonGhost titre="Plus tard" onPress={() => router.replace('/')} />
          </>
        )}

        {etat === 'erreur' && (
          <>
            <Message type="erreur" texte={msg} />
            <BoutonGhost titre="Aller à l'accueil" onPress={() => router.replace('/')} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond, paddingHorizontal: 18 },
  carte: { backgroundColor: C.carte, borderRadius: 20, padding: 22, gap: 12, alignItems: 'stretch', ...OMBRE },
  emoji: { fontSize: 40, textAlign: 'center' },
  titre: { fontFamily: F.titre, fontSize: 20, color: C.violetProfond, textAlign: 'center' },
  texte: { fontFamily: F.t400, fontSize: 13.5, color: C.texte2, lineHeight: 19, textAlign: 'center' },
  codeBloc: { alignItems: 'center', backgroundColor: C.fond, borderRadius: 14, paddingVertical: 10 },
  codeLabel: { fontFamily: F.t600, fontSize: 11.5, color: C.texte2 },
  code: { fontFamily: F.titre, fontSize: 26, color: C.violet, letterSpacing: 3 },
  astuce: { fontFamily: F.t600, fontSize: 12.5, color: C.texte2, lineHeight: 18, backgroundColor: C.fond, borderRadius: 12, padding: 10 },
  stores: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
});
