// === Écran de réclamation d'une carte fidélité temporaire ===
// Partagé par les deux routes /c?t=<jeton> (route statique, robuste en lien direct) et
// /c/<jeton> (route dynamique, navigation interne). Le client récupère les tampons accumulés
// sur sa vraie carte (par numéro de fidélité), via la fonction Edge carte-temp.
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ScrollView, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { C, F } from '@/constants/charte';
import { Carte, ChampTexte, Message, BoutonPrimaire, BoutonGhost } from '@/components/ui-kit';
import { appelCarteTemp, memoriserJeton, oublierJeton } from '@/lib/carte-temp';

// Téléchargement de l'appli native (le QR ouvre déjà l'appli web ; le natif est un +).
const LIEN_PLAY = 'https://play.google.com/store/apps/details?id=com.bubblestop.client';
const LIEN_IOS = 'https://apps.apple.com/fr/app/id6783475068'; // lien direct App Store (BubbleStop)

export default function ReclamerCarte({ token: tokenBrut }: { token: string }) {
  const insets = useSafeAreaInsets();
  // Jeton actif : vient du QR (?t=) OU saisi à la main (sans QR, ex. depuis l'appli native après inscription).
  const [token, setToken] = useState(String(tokenBrut || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
  const [saisie, setSaisie] = useState('');

  const [session, setSession] = useState<Session | null>(null);
  const [sessionPrete, setSessionPrete] = useState(false);
  const [chargementEtat, setChargementEtat] = useState(true);
  const [tampons, setTampons] = useState(0);
  const [cadeaux, setCadeaux] = useState(0);
  const [statut, setStatut] = useState(''); // active | reclamee | rattachee | expiree | inconnu
  const [numero, setNumero] = useState('');
  const [numeroVerrou, setNumeroVerrou] = useState(false); // numéro déjà rattaché au profil
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<null | { ok: boolean; texte: string }>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Session courante (et mise à jour si l'utilisateur se connecte pendant l'écran)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setSessionPrete(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // État de la pré-carte : combien de tampons à récupérer ?
  useEffect(() => {
    if (!token) { setStatut(''); setChargementEtat(false); return; } // pas de jeton → saisie manuelle
    let vivant = true;
    setChargementEtat(true);
    appelCarteTemp({ action: 'etat', token }).then((d) => {
      if (!vivant) return;
      if (d?.ok) {
        setTampons(Number(d.tampons) || 0);
        setCadeaux(Number(d.cadeaux) || 0);
        setStatut(String(d.statut || ''));
        // Mémorise le jeton → s'il crée son compte juste après, on réclamera automatiquement.
        if (String(d.statut || '') === 'active') memoriserJeton(token);
      } else setStatut('inconnu');
      setChargementEtat(false);
    });
    return () => { vivant = false; };
  }, [token]);

  // Numéro de fidélité déjà enregistré sur le profil
  useEffect(() => {
    if (!session) { setNumero(''); setNumeroVerrou(false); return; }
    supabase.from('profils').select('numero_fidelite').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => {
        const n = data?.numero_fidelite ? String(data.numero_fidelite) : '';
        setNumero(n); setNumeroVerrou(!!n);
      });
  }, [session]);

  const recuperer = async () => {
    if (!session) { setMsg('Connecte-toi pour récupérer ta carte.'); return; }
    setMsg(null); setEnCours(true);
    try {
      // Plus besoin de créer une carte avant : l'edge identifie le compte (JWT).
      // Compte SANS carte → la carte express DEVIENT sa carte (rattachement direct,
      // tampons + boissons offertes + historique conservés). Compte AVEC carte → transfert intégral.
      const code = numero.replace(/\D/g, '');
      const d = await appelCarteTemp({ action: 'reclamer', token, ...(code ? { telephone: code } : {}) });
      if (d?.ok) {
        await oublierJeton();
        const n = Number(d.tamponsCredites) || tampons;
        const g = Number(d.cadeaux) || 0;
        const detail = `${n} tampon${n > 1 ? 's' : ''}${g > 0 ? ` et ${g} boisson${g > 1 ? 's' : ''} offerte${g > 1 ? 's' : ''}` : ''}`;
        setResultat({
          ok: true,
          texte: d.rattachee
            ? `🎉 Cette carte est maintenant TA carte ! ${detail} conservé${n + g > 1 ? 's' : ''} — ton QR express reste valable en boutique.`
            : `🎉 ${detail} en cours de transfert vers ta carte — ils apparaissent d'ici quelques instants. Ton QR express reste valable : il pointe désormais vers ta carte.`,
        });
      } else {
        const e = String(d?.erreur || '');
        setResultat({
          ok: false,
          texte: /autre compte/i.test(e) ? 'Cette carte est déjà associée à un autre compte.'
            : /expir|réclam|reclam|déjà/i.test(e) ? 'Cette carte a déjà été récupérée, ou a expiré.'
            : 'La récupération a échoué. Réessaie.',
        });
      }
    } catch {
      setResultat({ ok: false, texte: 'La récupération a échoué. Réessaie.' });
    } finally { setEnCours(false); }
  };

  const enChargement = !sessionPrete || chargementEtat;

  return (
    <View style={styles.fond}>
      <ScrollView contentContainerStyle={[styles.contenu, { paddingTop: insets.top + 24 }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>BUBBLE STOP</Text>
        <Carte style={styles.carte}>
          <Text style={styles.titre}>🎟️ Ta carte fidélité</Text>

          {!token ? (
            <>
              <Text style={styles.sous}>
                Tu as une carte express (QR pris à la borne) ? Entre son <Text style={{ fontFamily: F.t800 }}>numéro de carte</Text> (inscrit sous le QR, sur ta photo) pour la récupérer sur ton compte.
              </Text>
              <ChampTexte
                label="Numéro de carte"
                value={saisie}
                onChangeText={(v) => setSaisie(String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="12345678"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={10}
              />
              <BoutonPrimaire titre="Valider" onPress={() => setToken(saisie.trim())} />
            </>
          ) : enChargement ? (
            <ActivityIndicator color={C.violet} size="large" style={{ marginVertical: 20 }} />
          ) : resultat ? (
            <>
              <Message texte={resultat.texte} type={resultat.ok ? 'ok' : 'info'} />
              <BoutonPrimaire titre="Voir ma carte" onPress={() => router.replace('/explore' as any)} />
            </>
          ) : statut === 'inconnu' ? (
            <>
              <Message texte="Ce jeton n'est pas valide. Vérifie le numéro inscrit sous le QR." />
              <BoutonGhost titre="Saisir un autre jeton" onPress={() => { setToken(''); setSaisie(''); setStatut(''); }} />
            </>
          ) : statut === 'rattachee' ? (
            <>
              <Message texte="Cette carte est déjà associée à un compte." />
              <BoutonPrimaire titre="Voir ma carte" onPress={() => router.replace('/explore' as any)} />
            </>
          ) : statut !== 'active' ? (
            <>
              <Message texte="Cette carte a déjà été récupérée, ou a expiré." />
              <BoutonPrimaire titre="Voir ma carte" onPress={() => router.replace('/explore' as any)} />
            </>
          ) : !session ? (
            <>
              <Text style={styles.sous}>
                Tu as {tampons} tampon{tampons > 1 ? 's' : ''}{cadeaux > 0 ? ` et ${cadeaux} boisson${cadeaux > 1 ? 's' : ''} offerte${cadeaux > 1 ? 's' : ''}` : ''} à récupérer. Connecte-toi (ou crée ton compte) pour les retrouver dans l'appli.
              </Text>
              <BoutonPrimaire titre="Me connecter / m'inscrire" onPress={() => router.push('/compte' as any)} />
            </>
          ) : (
            <>
              <Text style={styles.sous}>
                {tampons} tampon{tampons > 1 ? 's' : ''}{cadeaux > 0 ? ` + ${cadeaux} boisson${cadeaux > 1 ? 's' : ''} offerte${cadeaux > 1 ? 's' : ''} 🎁` : ''} prêt{tampons + cadeaux > 1 ? 's' : ''} à rejoindre ton compte.
              </Text>
              {numeroVerrou ? (
                <Text style={styles.sousPetit}>Ton compte a déjà une carte : tout sera transféré dessus (tampons + boissons offertes).</Text>
              ) : (
                <Text style={styles.sousPetit}>Cette carte express deviendra directement TA carte — tout est conservé, aucun téléphone requis.</Text>
              )}
              <Message texte="Ton QR express photographié restera valable en boutique : il pointera automatiquement vers ta carte." />
              {!!msg && <Message texte={msg} />}
              <BoutonPrimaire
                titre="Récupérer ma carte sur mon compte"
                onPress={recuperer}
                loading={enCours}
              />
            </>
          )}
        </Carte>

        {/* Incitation à garder l'appli native (le QR ouvre déjà l'appli web ; même compte → mêmes tampons) */}
        <Carte style={styles.appBloc}>
          <Text style={styles.appTitre}>📲 Garde l'appli Bubble Stop</Text>
          <Text style={styles.appSous}>Tes tampons, tes offres et la commande à l'avance — toujours dans ta poche.</Text>
          <View style={styles.appBoutons}>
            {/* ⚠️ Guideline App Store 2.3.10 : ne JAMAIS montrer un bouton Google Play dans
                l'app iOS (mention d'une autre plateforme = motif de rejet). Sur le web on
                montre les deux ; sur chaque plateforme native, seulement la sienne. */}
            {Platform.OS !== 'android' && <BoutonGhost titre="App Store" onPress={() => Linking.openURL(LIEN_IOS)} />}
            {Platform.OS !== 'ios' && <BoutonGhost titre="Google Play" onPress={() => Linking.openURL(LIEN_PLAY)} />}
          </View>
        </Carte>

        <BoutonGhost titre="‹ Retour à l'accueil" onPress={() => router.replace('/' as any)} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  contenu: { flexGrow: 1, justifyContent: 'center', padding: 22, gap: 18, paddingBottom: 40 },
  logo: { fontFamily: F.titre, fontSize: 28, color: C.violet, textAlign: 'center', letterSpacing: 0.5 },
  carte: { gap: 14 },
  titre: { fontFamily: F.t800, fontSize: 20, color: C.texte, textAlign: 'center' },
  sous: { fontFamily: F.t400, fontSize: 14.5, color: C.texte2, textAlign: 'center', lineHeight: 21 },
  sousPetit: { fontFamily: F.t600, fontSize: 13, color: C.texte2, textAlign: 'center' },
  aideTel: { fontFamily: F.t400, fontSize: 12, color: C.texte3, textAlign: 'center', lineHeight: 17 },
  appBloc: { gap: 8, alignItems: 'center' },
  appTitre: { fontFamily: F.t800, fontSize: 15.5, color: C.texte, textAlign: 'center' },
  appSous: { fontFamily: F.t400, fontSize: 13, color: C.texte2, textAlign: 'center', lineHeight: 18 },
  appBoutons: { flexDirection: 'row', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
});
