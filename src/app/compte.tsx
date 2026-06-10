// === Compte client Bubblestop (Supabase Auth) ===
// Inscription / connexion par email + mot de passe.
// À l'inscription, on crée aussi la ligne "profils" liée,
// en récupérant le numéro de fidélité déjà saisi dans l'onglet Fidélité.
import { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { enregistrerPush } from '@/lib/push';
import { MAGASINS, MagasinId } from '@/store/magasin';

const VIOLET = '#3A2A5E';
const VIOLET_PROFOND = '#2A1D46';
const VERT = '#A3C724';
const LAVANDE = '#EFE9F6';

// Règles de mot de passe (alignées sur Supabase) :
// 8 caractères min, une minuscule, une majuscule, un chiffre
const REGLES_MDP = '8 caractères minimum, avec une majuscule et un chiffre';
function mdpValide(mdp: string): boolean {
  return mdp.length >= 8 && /[a-z]/.test(mdp) && /[A-Z]/.test(mdp) && /[0-9]/.test(mdp);
}

export default function CompteScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [chargement, setChargement] = useState(true);

  // Formulaire (reset-email = demande du code, reset-code = saisie code + nouveau mdp,
  // confirmation = code de confirmation d'inscription)
  const [mode, setMode] = useState<'connexion' | 'inscription' | 'reset-email' | 'reset-code' | 'confirmation'>('connexion');
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [codeReset, setCodeReset] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Écoute la session (connexion/déconnexion automatiques)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChargement(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Connecté → enregistre le token push (silencieux sous Expo Go) + charge le profil
  const [prenom, setPrenom] = useState('');
  const [telFidelite, setTelFidelite] = useState('');
  const [prenomSurTicket, setPrenomSurTicket] = useState(false);
  const [infosOk, setInfosOk] = useState(false);
  const [estAdmin, setEstAdmin] = useState(false);
  // Édition email / mot de passe : null | 'email' | 'email-code' | 'mdp'
  const [edition, setEdition] = useState<null | 'email' | 'email-code' | 'mdp'>(null);
  const [nouvelEmail, setNouvelEmail] = useState('');
  const [codeEmail, setCodeEmail] = useState('');
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [nouveauMdp2, setNouveauMdp2] = useState('');
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [editionEnCours, setEditionEnCours] = useState(false);
  useEffect(() => {
    if (!session) { setEstAdmin(false); return; }
    enregistrerPush();
    supabase.from('profils').select('nom, numero_fidelite, est_admin, prenom_sur_ticket').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => {
        setPrenom(data?.nom ?? '');
        setTelFidelite(data?.numero_fidelite ?? '');
        setPrenomSurTicket(!!data?.prenom_sur_ticket);
        setEstAdmin(!!data?.est_admin);
      });
  }, [session]);

  // === Admin : gestion des offres ===
  const [offreTitre, setOffreTitre] = useState('');
  const [offreMessage, setOffreMessage] = useState('');
  const [offres, setOffres] = useState<any[]>([]);
  const [offreEtat, setOffreEtat] = useState<string | null>(null);
  const chargerOffres = async () => {
    const { data } = await supabase.from('offres').select('*').order('created_at', { ascending: false }).limit(10);
    setOffres(data ?? []);
  };
  useEffect(() => { if (estAdmin) chargerOffres(); }, [estAdmin]);

  const publierOffre = async (avecPush: boolean) => {
    if (!offreTitre.trim() || !offreMessage.trim()) {
      setOffreEtat('Titre et message requis.');
      return;
    }
    setOffreEtat('Publication…');
    try {
      const { error } = await supabase.from('offres')
        .insert({ titre: offreTitre.trim(), message: offreMessage.trim() });
      if (error) throw error;
      let txt = '✅ Offre publiée (visible sur l\'accueil)';
      if (avecPush) {
        const { data, error: errPush } = await supabase.functions.invoke('envoyer-offre', {
          body: { titre: offreTitre.trim(), message: offreMessage.trim() },
        });
        txt = errPush
          ? '✅ Publiée, ⚠️ push échoué'
          : `✅ Publiée + push envoyé à ${data?.destinataires ?? 0} appareil(s)`;
      }
      setOffreTitre(''); setOffreMessage('');
      setOffreEtat(txt);
      chargerOffres();
    } catch (e: any) {
      setOffreEtat(String(e?.message ?? e));
    }
  };

  // === Admin : message affiché en gros sur l'écran pickup de la caisse ===
  const [msgCaisseMag, setMsgCaisseMag] = useState<MagasinId>('aix');
  const [msgCaisseTexte, setMsgCaisseTexte] = useState('');
  const [msgCaisseEtat, setMsgCaisseEtat] = useState<string | null>(null);
  const chargerMessageCaisse = async (mag: MagasinId) => {
    const { data } = await supabase.from('messages_caisse').select('message, actif').eq('magasin', mag).maybeSingle();
    setMsgCaisseTexte(data?.actif ? (data?.message ?? '') : '');
  };
  useEffect(() => { if (estAdmin) chargerMessageCaisse(msgCaisseMag); }, [estAdmin, msgCaisseMag]);
  const enregistrerMessageCaisse = async (effacer: boolean) => {
    setMsgCaisseEtat(effacer ? 'Effacement…' : 'Envoi…');
    const { error } = await supabase.from('messages_caisse').upsert({
      magasin: msgCaisseMag,
      message: effacer ? null : msgCaisseTexte.trim(),
      actif: !effacer,
      updated_at: new Date().toISOString(),
    });
    if (error) { setMsgCaisseEtat(String(error.message)); return; }
    if (effacer) setMsgCaisseTexte('');
    setMsgCaisseEtat(effacer ? '✅ Message retiré de la caisse' : '✅ Message affiché à la caisse');
    setTimeout(() => setMsgCaisseEtat(null), 3500);
  };

  const basculerOffre = async (o: any) => {
    await supabase.from('offres').update({ active: !o.active }).eq('id', o.id);
    chargerOffres();
  };
  const supprimerOffre = async (o: any) => {
    await supabase.from('offres').delete().eq('id', o.id);
    chargerOffres();
  };

  // === Mes informations : prénom + numéro fidélité ===
  const enregistrerInfos = async () => {
    if (!session) return;
    const t = telFidelite.replace(/\D/g, '');
    if (telFidelite.trim() && t.length !== 10) {
      setInfoMsg('Le numéro de téléphone doit faire 10 chiffres.');
      return;
    }
    setInfoMsg(null);
    await supabase.from('profils').upsert({
      id: session.user.id,
      nom: prenom.trim() || null,
      numero_fidelite: t || null,
      telephone: t || null,
      prenom_sur_ticket: prenomSurTicket,
    });
    if (t) AsyncStorage.setItem('fidelite.tel', t).catch(() => {});
    setInfosOk(true);
    setTimeout(() => setInfosOk(false), 2000);
  };

  const fermerEdition = () => {
    setEdition(null);
    setNouvelEmail(''); setCodeEmail(''); setNouveauMdp(''); setNouveauMdp2('');
    setInfoMsg(null);
  };

  // === Changement du PIN fidélité (appliqué par la caisse sous ~1 min) ===
  const [pinOuvert, setPinOuvert] = useState(false);
  const [ancienPin, setAncienPin] = useState('');
  const [nouveauPin, setNouveauPin] = useState('');
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  // Affiche le résultat de la dernière demande (rempli par la caisse)
  useEffect(() => {
    if (!session || !telFidelite) return;
    supabase.from('fidelite_pin_demandes')
      .select('statut, raison, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.statut === 'refusee') {
          setPinMsg(data.raison === 'pin-incorrect'
            ? '⚠️ Dernière demande refusée : ancien PIN incorrect.'
            : '⚠️ Dernière demande refusée — vérifie ton numéro de carte.');
        }
      });
  }, [session, telFidelite]);

  const envoyerDemandePin = async () => {
    const t = telFidelite.replace(/\D/g, '');
    if (t.length !== 10) { setPinMsg('Enregistre d\'abord ton numéro de fidélité ci-dessus.'); return; }
    if (!/^\d{4}$/.test(nouveauPin)) { setPinMsg('Le nouveau PIN doit faire 4 chiffres.'); return; }
    setPinMsg(null);
    const { error } = await supabase.from('fidelite_pin_demandes').insert({
      telephone: t,
      ancien_pin: ancienPin.trim() || null,
      nouveau_pin: nouveauPin,
    });
    if (error) {
      setPinMsg(String(error.message));
    } else {
      setAncienPin(''); setNouveauPin(''); setPinOuvert(false);
      setPinMsg('✓ Demande envoyée — ton PIN sera mis à jour en boutique d\'ici quelques minutes.');
    }
  };

  // 1. Demande de changement d'email → Supabase envoie un code au nouvel email
  const demanderChangementEmail = async () => {
    const mail = nouvelEmail.trim().toLowerCase();
    if (!mail.includes('@')) { setInfoMsg('Entre une adresse email valide.'); return; }
    setEditionEnCours(true);
    setInfoMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ email: mail });
      if (error) throw error;
      setEdition('email-code');
      setInfoMsg(`Code envoyé à ${mail} — vérifie tes emails (et les spams).`);
    } catch (e: any) {
      const txt = String(e?.message ?? e);
      setInfoMsg(txt.includes('already') ? 'Cette adresse est déjà utilisée.' : txt);
    } finally {
      setEditionEnCours(false);
    }
  };

  // 2. Confirmation du code → l'email du compte change réellement
  const validerChangementEmail = async () => {
    if (codeEmail.trim().length < 6) { setInfoMsg('Entre le code reçu par email.'); return; }
    setEditionEnCours(true);
    setInfoMsg(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: nouvelEmail.trim().toLowerCase(),
        token: codeEmail.trim(),
        type: 'email_change',
      });
      if (error) throw error;
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      // Recopie le nouvel email dans le profil (synchronisé vers la carte en caisse)
      if (data.session) {
        await supabase.from('profils')
          .update({ email: data.session.user.email })
          .eq('id', data.session.user.id);
      }
      fermerEdition();
    } catch (e: any) {
      const txt = String(e?.message ?? e);
      setInfoMsg(txt.includes('expired') || txt.includes('invalid')
        ? 'Code incorrect ou expiré. Recommence.'
        : txt);
    } finally {
      setEditionEnCours(false);
    }
  };

  // === Changement de mot de passe (connecté) — confirmation par code email ===
  const [codeMdp, setCodeMdp] = useState('');
  // 1. Clic sur "Modifier" → envoi du code à l'adresse du compte
  const demanderChangementMdp = async () => {
    if (!session?.user.email) return;
    setEdition('mdp');
    setInfoMsg('Envoi du code…');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(session.user.email);
      if (error) throw error;
      setInfoMsg(`Code envoyé à ${session.user.email} — vérifie tes emails.`);
    } catch (e: any) {
      setInfoMsg(String(e?.message ?? e));
    }
  };
  // 2. Code + nouveau mot de passe → vérification puis application
  const changerMdp = async () => {
    if (codeMdp.trim().length < 6) { setInfoMsg('Entre le code reçu par email.'); return; }
    if (!mdpValide(nouveauMdp)) { setInfoMsg(`Mot de passe : ${REGLES_MDP}.`); return; }
    if (nouveauMdp !== nouveauMdp2) { setInfoMsg('Les deux mots de passe ne correspondent pas.'); return; }
    setEditionEnCours(true);
    setInfoMsg(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: session!.user.email!,
        token: codeMdp.trim(),
        type: 'recovery',
      });
      if (error) throw error;
      const { error: errMdp } = await supabase.auth.updateUser({ password: nouveauMdp });
      if (errMdp) throw errMdp;
      setCodeMdp('');
      fermerEdition();
      setInfoMsg('✓ Mot de passe modifié');
      setTimeout(() => setInfoMsg(null), 2500);
    } catch (e: any) {
      const txt = String(e?.message ?? e);
      setInfoMsg(txt.includes('expired') || txt.includes('invalid')
        ? 'Code incorrect ou expiré. Recommence.'
        : txt);
    } finally {
      setEditionEnCours(false);
    }
  };

  const valider = async () => {
    setMessage(null);
    const mail = email.trim().toLowerCase();
    if (!mail.includes('@')) {
      setMessage('Entre une adresse email valide.');
      return;
    }
    // Connexion : on laisse passer (anciens mots de passe) ; inscription : règles strictes
    if (mode === 'inscription' && !mdpValide(mdp)) {
      setMessage(`Mot de passe : ${REGLES_MDP}.`);
      return;
    }
    if (mode === 'connexion' && !mdp) {
      setMessage('Entre ton mot de passe.');
      return;
    }
    setEnCours(true);
    try {
      if (mode === 'inscription') {
        // 1. Création du compte auth
        const { data, error } = await supabase.auth.signUp({ email: mail, password: mdp });
        if (error) throw error;

        // 2. Création du profil — numéro saisi à l'inscription, sinon celui mémorisé localement
        const telSaisi = telephone.replace(/\D/g, '');
        const numeroFidelite = telSaisi.length === 10
          ? telSaisi
          : await AsyncStorage.getItem('fidelite.tel').catch(() => null);
        if (numeroFidelite) {
          AsyncStorage.setItem('fidelite.tel', numeroFidelite).catch(() => {});
        }
        if (data.user && data.session) {
          const { error: errProfil } = await supabase.from('profils').insert({
            id: data.user.id,
            nom: nom.trim() || null,
            numero_fidelite: numeroFidelite,
            telephone: numeroFidelite,
            email: mail,
          });
          if (errProfil && errProfil.code !== '23505') throw errProfil; // 23505 = déjà créé
        } else {
          // Confirmation email activée : un code a été envoyé, on le demande ici
          setMode('confirmation');
          setMessage(`Code de confirmation envoyé à ${mail} — vérifie tes emails (et les spams).`);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password: mdp });
        if (error) throw error;
      }
    } catch (e: any) {
      // Messages d'erreur courants traduits
      const txt = String(e?.message ?? e);
      if (txt.includes('Invalid login credentials')) setMessage('Email ou mot de passe incorrect.');
      else if (txt.includes('already registered')) setMessage('Un compte existe déjà avec cet email.');
      else if (txt.includes('Email not confirmed')) {
        // Compte jamais confirmé : renvoie un code et bascule sur la saisie
        await supabase.auth.resend({ type: 'signup', email: mail }).catch(() => {});
        setMode('confirmation');
        setMessage(`Ton compte n'est pas confirmé. Nouveau code envoyé à ${mail}.`);
      }
      else setMessage(txt);
    } finally {
      setEnCours(false);
    }
  };

  // === Confirmation d'inscription : vérifie le code, puis crée le profil ===
  const validerConfirmation = async () => {
    if (codeReset.trim().length < 6) { setMessage('Entre le code reçu par email.'); return; }
    setEnCours(true);
    setMessage(null);
    try {
      const mail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.verifyOtp({
        email: mail,
        token: codeReset.trim(),
        type: 'signup',
      });
      if (error) throw error;
      // Session active → création du profil (gardé en attente pendant la confirmation)
      if (data.user) {
        const telSaisi = telephone.replace(/\D/g, '');
        const numeroFidelite = telSaisi.length === 10
          ? telSaisi
          : await AsyncStorage.getItem('fidelite.tel').catch(() => null);
        await supabase.from('profils').upsert({
          id: data.user.id,
          nom: nom.trim() || null,
          numero_fidelite: numeroFidelite,
          telephone: numeroFidelite,
          email: mail,
        });
      }
      setCodeReset('');
      setMode('connexion'); // la session est active → l'écran compte s'affiche
    } catch (e: any) {
      const txt = String(e?.message ?? e);
      setMessage(txt.includes('expired') || txt.includes('invalid')
        ? 'Code incorrect ou expiré. Recommence.'
        : txt);
    } finally {
      setEnCours(false);
    }
  };

  const deconnexion = async () => {
    await supabase.auth.signOut();
  };

  // === Mot de passe oublié : envoi du code par email ===
  const envoyerCode = async () => {
    const mail = email.trim().toLowerCase();
    if (!mail.includes('@')) { setMessage('Entre ton adresse email.'); return; }
    setEnCours(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(mail);
      if (error) throw error;
      setMode('reset-code');
      setMessage('Code envoyé ! Vérifie tes emails (et les spams).');
    } catch (e: any) {
      setMessage(String(e?.message ?? e));
    } finally {
      setEnCours(false);
    }
  };

  // === Mot de passe oublié : vérification du code + nouveau mot de passe ===
  const validerNouveauMdp = async () => {
    if (codeReset.trim().length < 6) {
      setMessage('Entre le code reçu par email.');
      return;
    }
    if (!mdpValide(mdp)) {
      setMessage(`Mot de passe : ${REGLES_MDP}.`);
      return;
    }
    setEnCours(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: codeReset.trim(),
        type: 'recovery',
      });
      if (error) throw error;
      const { error: errMdp } = await supabase.auth.updateUser({ password: mdp });
      if (errMdp) throw errMdp;
      // Connecté avec le nouveau mot de passe
      setMode('connexion');
      setCodeReset('');
      setMdp('');
    } catch (e: any) {
      const txt = String(e?.message ?? e);
      setMessage(txt.includes('expired') || txt.includes('invalid')
        ? 'Code incorrect ou expiré. Recommence.'
        : txt);
    } finally {
      setEnCours(false);
    }
  };

  // === Suppression définitive du compte (RGPD / Play Store) ===
  const supprimerCompte = () => {
    Alert.alert(
      'Supprimer mon compte',
      'Ton compte, tes commandes et ta carte seront supprimés définitivement. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data, error } = await supabase.functions.invoke('supprimer-compte');
              if (error || !data?.ok) throw error || new Error('échec de la suppression');
              await supabase.auth.signOut();
            } catch (e: any) {
              Alert.alert('Erreur', String(e?.message ?? e));
            }
          },
        },
      ],
    );
  };

  if (chargement) {
    return (
      <View style={[styles.fond, styles.centre]}>
        <ActivityIndicator color={VERT} size="large" />
      </View>
    );
  }

  // === Connecté : infos du compte ===
  if (session) {
    return (
      <View style={styles.fond}>
        <SafeAreaView style={styles.safe}>
          <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
            <Text style={styles.titre}>Mon compte</Text>

            {/* === Mes informations === */}
            <View style={styles.section}>
              <Text style={styles.sectionTitre}>Mes informations</Text>
              <Text style={styles.label}>Prénom</Text>
              <TextInput
                style={styles.champ}
                value={prenom}
                onChangeText={setPrenom}
                placeholder="Prénom"
                placeholderTextColor="#9a8fb5"
                autoCapitalize="words"
              />
              <Text style={styles.label}>N° de téléphone (carte fidélité)</Text>
              <TextInput
                style={styles.champ}
                value={telFidelite}
                onChangeText={setTelFidelite}
                placeholder="06 12 34 56 78"
                placeholderTextColor="#9a8fb5"
                keyboardType="number-pad"
                maxLength={14}
              />
              <Text style={[styles.label, { fontWeight: '600' }]}>
                Jamais utilisé pour du démarchage — uniquement pour identifier ta carte en
                caisse si tu n'as pas ton QR.
              </Text>
              {/* Prénom imprimé sur les tickets en boutique (au choix du client) */}
              <View style={styles.ligneInfo}>
                <Text style={[styles.valeur, { flex: 1, fontSize: 14 }]}>
                  Afficher mon prénom sur mes tickets
                </Text>
                <Switch
                  value={prenomSurTicket}
                  onValueChange={setPrenomSurTicket}
                  trackColor={{ false: '#ffffff33', true: VERT }}
                  thumbColor="#fff"
                />
              </View>

              <Pressable style={styles.btnSection} onPress={enregistrerInfos}>
                <Text style={styles.btnTexte}>{infosOk ? '✓ Enregistré' : 'Enregistrer'}</Text>
              </Pressable>

              {/* Code PIN fidélité (utilisé en caisse avec le numéro) */}
              <View style={styles.ligneInfo}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Code PIN fidélité</Text>
                  <Text style={styles.valeur}>••••</Text>
                </View>
                <Pressable onPress={() => { setPinOuvert(!pinOuvert); setPinMsg(null); }}>
                  <Text style={styles.lien}>{pinOuvert ? 'Annuler' : 'Modifier'}</Text>
                </Pressable>
              </View>
              {pinOuvert && (
                <>
                  <TextInput
                    style={styles.champ}
                    value={ancienPin}
                    onChangeText={setAncienPin}
                    placeholder="Ancien PIN (vide si jamais défini)"
                    placeholderTextColor="#9a8fb5"
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                  />
                  <TextInput
                    style={styles.champ}
                    value={nouveauPin}
                    onChangeText={setNouveauPin}
                    placeholder="Nouveau PIN (4 chiffres)"
                    placeholderTextColor="#9a8fb5"
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                  />
                  <Pressable style={styles.btnSection} onPress={envoyerDemandePin}>
                    <Text style={styles.btnTexte}>Changer mon PIN</Text>
                  </Pressable>
                </>
              )}
              {pinMsg && <Text style={styles.message}>{pinMsg}</Text>}
            </View>

            {/* === Connexion & sécurité === */}
            <View style={styles.section}>
              <Text style={styles.sectionTitre}>Connexion & sécurité</Text>

              {/* Email actuel + Modifier */}
              <View style={styles.ligneInfo}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Adresse email</Text>
                  <Text style={styles.valeur}>{session.user.email}</Text>
                </View>
                <Pressable
                  onPress={() => (edition === 'email' || edition === 'email-code') ? fermerEdition() : setEdition('email')}>
                  <Text style={styles.lien}>{(edition === 'email' || edition === 'email-code') ? 'Annuler' : 'Modifier'}</Text>
                </Pressable>
              </View>

              {edition === 'email' && (
                <>
                  <TextInput
                    style={styles.champ}
                    value={nouvelEmail}
                    onChangeText={setNouvelEmail}
                    placeholder="Nouvelle adresse email"
                    placeholderTextColor="#9a8fb5"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Pressable style={styles.btnSection} onPress={demanderChangementEmail} disabled={editionEnCours}>
                    {editionEnCours ? <ActivityIndicator color={VIOLET_PROFOND} /> : <Text style={styles.btnTexte}>Recevoir le code de confirmation</Text>}
                  </Pressable>
                </>
              )}

              {edition === 'email-code' && (
                <>
                  <TextInput
                    style={styles.champ}
                    value={codeEmail}
                    onChangeText={setCodeEmail}
                    placeholder="Code reçu par email"
                    placeholderTextColor="#9a8fb5"
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                  <Pressable style={styles.btnSection} onPress={validerChangementEmail} disabled={editionEnCours}>
                    {editionEnCours ? <ActivityIndicator color={VIOLET_PROFOND} /> : <Text style={styles.btnTexte}>Confirmer le changement</Text>}
                  </Pressable>
                </>
              )}

              {/* Mot de passe + Modifier */}
              <View style={styles.ligneInfo}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Mot de passe</Text>
                  <Text style={styles.valeur}>••••••••</Text>
                </View>
                <Pressable onPress={() => edition === 'mdp' ? fermerEdition() : demanderChangementMdp()}>
                  <Text style={styles.lien}>{edition === 'mdp' ? 'Annuler' : 'Modifier'}</Text>
                </Pressable>
              </View>

              {edition === 'mdp' && (
                <>
                  <TextInput
                    style={styles.champ}
                    value={codeMdp}
                    onChangeText={setCodeMdp}
                    placeholder="Code reçu par email"
                    placeholderTextColor="#9a8fb5"
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                  <TextInput
                    style={styles.champ}
                    value={nouveauMdp}
                    onChangeText={setNouveauMdp}
                    placeholder="Nouveau mot de passe"
                    placeholderTextColor="#9a8fb5"
                    secureTextEntry
                  />
                  <TextInput
                    style={styles.champ}
                    value={nouveauMdp2}
                    onChangeText={setNouveauMdp2}
                    placeholder="Confirme le nouveau mot de passe"
                    placeholderTextColor="#9a8fb5"
                    secureTextEntry
                  />
                  <Pressable style={styles.btnSection} onPress={changerMdp} disabled={editionEnCours}>
                    {editionEnCours ? <ActivityIndicator color={VIOLET_PROFOND} /> : <Text style={styles.btnTexte}>Changer le mot de passe</Text>}
                  </Pressable>
                </>
              )}

              {infoMsg && <Text style={styles.message}>{infoMsg}</Text>}
            </View>

            <Pressable style={styles.btnGhost} onPress={deconnexion}>
              <Text style={styles.btnGhostTexte}>Se déconnecter</Text>
            </Pressable>
            <Pressable style={styles.btnGhost} onPress={supprimerCompte}>
              <Text style={styles.btnDanger}>Supprimer mon compte</Text>
            </Pressable>

            {/* === Section ADMIN : offres / annonces === */}
            {estAdmin && (
              <View style={styles.admin}>
                <Text style={styles.adminTitre}>🛠️ Admin — Offres</Text>
                <TextInput
                  style={styles.input}
                  value={offreTitre}
                  onChangeText={setOffreTitre}
                  placeholder="Titre (ex : -20 % aujourd'hui !)"
                  placeholderTextColor="#9a8fb5"
                  maxLength={60}
                />
                <TextInput
                  style={[styles.input, { minHeight: 70 }]}
                  value={offreMessage}
                  onChangeText={setOffreMessage}
                  placeholder="Message de l'offre"
                  placeholderTextColor="#9a8fb5"
                  multiline
                  maxLength={180}
                />
                {offreEtat && <Text style={styles.message}>{offreEtat}</Text>}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable style={[styles.btn, { flex: 1 }]} onPress={() => publierOffre(false)}>
                    <Text style={styles.btnTexte}>Publier</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, { flex: 1 }]} onPress={() => publierOffre(true)}>
                    <Text style={styles.btnTexte}>📣 + push</Text>
                  </Pressable>
                </View>

                {offres.map((o) => (
                  <View key={o.id} style={styles.offreLigne}>
                    <Text style={[styles.offreLigneTexte, !o.active && { opacity: 0.45 }]} numberOfLines={1}>
                      {o.active ? '🟢' : '⚪'} {o.titre}
                    </Text>
                    <Pressable onPress={() => basculerOffre(o)} style={{ padding: 6 }}>
                      <Text style={styles.btnGhostTexte}>{o.active ? 'Masquer' : 'Activer'}</Text>
                    </Pressable>
                    <Pressable onPress={() => supprimerOffre(o)} style={{ padding: 6 }}>
                      <Text style={{ fontSize: 15 }}>🗑️</Text>
                    </Pressable>
                  </View>
                ))}

                {/* === Message affiché EN GROS sur l'écran pickup de la caisse === */}
                <Text style={[styles.adminTitre, { marginTop: 18 }]}>📢 Message à la caisse (pickup)</Text>
                <View style={styles.msgCaisseMags}>
                  {MAGASINS.map((m) => (
                    <Pressable
                      key={m.id}
                      style={[styles.msgCaisseChip, msgCaisseMag === m.id && styles.msgCaisseChipActif]}
                      onPress={() => setMsgCaisseMag(m.id)}>
                      <Text style={[styles.msgCaisseChipTxt, msgCaisseMag === m.id && styles.msgCaisseChipTxtActif]}>
                        {m.nom}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={[styles.input, { minHeight: 80 }]}
                  value={msgCaisseTexte}
                  onChangeText={setMsgCaisseTexte}
                  placeholder="Ex : Pensez à proposer la nouvelle saveur matcha fraise !"
                  placeholderTextColor="#9a8fb5"
                  multiline
                  maxLength={200}
                />
                {msgCaisseEtat && <Text style={styles.message}>{msgCaisseEtat}</Text>}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    style={[styles.btn, { flex: 1 }, !msgCaisseTexte.trim() && styles.btnOff]}
                    disabled={!msgCaisseTexte.trim()}
                    onPress={() => enregistrerMessageCaisse(false)}>
                    <Text style={styles.btnTexte}>Afficher à la caisse</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => enregistrerMessageCaisse(true)}>
                    <Text style={styles.btnGhostTexte}>Retirer</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // === Confirmation d'inscription (code reçu par email) ===
  if (mode === 'confirmation') {
    return (
      <View style={styles.fond}>
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
              <Text style={styles.titre}>Confirme ton compte</Text>
              <Text style={styles.aide}>Entre le code reçu par email.</Text>
              <TextInput
                style={styles.input}
                value={codeReset}
                onChangeText={setCodeReset}
                placeholder="Code reçu par email"
                placeholderTextColor="#9a8fb5"
                keyboardType="number-pad"
                maxLength={10}
              />
              {message && <Text style={styles.message}>{message}</Text>}
              <Pressable style={[styles.btn, enCours && styles.btnOff]} onPress={validerConfirmation} disabled={enCours}>
                {enCours ? <ActivityIndicator color={VIOLET_PROFOND} /> : <Text style={styles.btnTexte}>Confirmer mon compte</Text>}
              </Pressable>
              <Pressable
                style={styles.btnGhost}
                onPress={async () => {
                  await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() }).catch(() => {});
                  setMessage('Nouveau code envoyé !');
                }}>
                <Text style={styles.btnGhostTexte}>Renvoyer le code</Text>
              </Pressable>
              <Pressable
                style={styles.btnGhost}
                onPress={() => { setMode('connexion'); setMessage(null); setCodeReset(''); }}>
                <Text style={styles.btnGhostTexte}>‹ Retour à la connexion</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  // === Mot de passe oublié ===
  if (mode === 'reset-email' || mode === 'reset-code') {
    return (
      <View style={styles.fond}>
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
              <Text style={styles.titre}>Mot de passe oublié</Text>

              {mode === 'reset-email' ? (
                <>
                  <Text style={styles.aide}>On t'envoie un code par email pour choisir un nouveau mot de passe.</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    placeholderTextColor="#9a8fb5"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {message && <Text style={styles.message}>{message}</Text>}
                  <Pressable style={[styles.btn, enCours && styles.btnOff]} onPress={envoyerCode} disabled={enCours}>
                    {enCours ? <ActivityIndicator color={VIOLET_PROFOND} /> : <Text style={styles.btnTexte}>Envoyer le code</Text>}
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.aide}>Entre le code reçu par email et ton nouveau mot de passe.</Text>
                  <TextInput
                    style={styles.input}
                    value={codeReset}
                    onChangeText={setCodeReset}
                    placeholder="Code reçu par email"
                    placeholderTextColor="#9a8fb5"
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                  <TextInput
                    style={styles.input}
                    value={mdp}
                    onChangeText={setMdp}
                    placeholder="Nouveau mot de passe"
                    placeholderTextColor="#9a8fb5"
                    secureTextEntry
                  />
                  {message && <Text style={styles.message}>{message}</Text>}
                  <Pressable style={[styles.btn, enCours && styles.btnOff]} onPress={validerNouveauMdp} disabled={enCours}>
                    {enCours ? <ActivityIndicator color={VIOLET_PROFOND} /> : <Text style={styles.btnTexte}>Changer le mot de passe</Text>}
                  </Pressable>
                </>
              )}

              <Pressable
                style={styles.btnGhost}
                onPress={() => { setMode('connexion'); setMessage(null); setCodeReset(''); }}>
                <Text style={styles.btnGhostTexte}>‹ Retour à la connexion</Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  // === Pas connecté : formulaire ===
  return (
    <View style={styles.fond}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
            <Text style={styles.titre}>
              {mode === 'connexion' ? 'Connexion' : 'Créer mon compte'}
            </Text>

            {mode === 'inscription' && (
              <>
                <TextInput
                  style={styles.input}
                  value={nom}
                  onChangeText={setNom}
                  placeholder="Prénom"
                  placeholderTextColor="#9a8fb5"
                  autoCapitalize="words"
                />
                <TextInput
                  style={styles.input}
                  value={telephone}
                  onChangeText={setTelephone}
                  placeholder="N° de téléphone (carte fidélité)"
                  placeholderTextColor="#9a8fb5"
                  keyboardType="number-pad"
                  maxLength={14}
                />
              </>
            )}
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="#9a8fb5"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              value={mdp}
              onChangeText={setMdp}
              placeholder="Mot de passe"
              placeholderTextColor="#9a8fb5"
              secureTextEntry
            />
            {mode === 'inscription' && (
              <Text style={styles.reglesMdp}>{REGLES_MDP}</Text>
            )}

            {message && <Text style={styles.message}>{message}</Text>}

            <Pressable style={[styles.btn, enCours && styles.btnOff]} onPress={valider} disabled={enCours}>
              {enCours
                ? <ActivityIndicator color={VIOLET_PROFOND} />
                : <Text style={styles.btnTexte}>{mode === 'connexion' ? 'Me connecter' : "M'inscrire"}</Text>}
            </Pressable>

            <Pressable
              style={styles.btnGhost}
              onPress={() => { setMode(mode === 'connexion' ? 'inscription' : 'connexion'); setMessage(null); }}>
              <Text style={styles.btnGhostTexte}>
                {mode === 'connexion' ? "Pas encore de compte ? M'inscrire" : 'Déjà un compte ? Me connecter'}
              </Text>
            </Pressable>
            {mode === 'connexion' && (
              <Pressable
                style={styles.btnGhost}
                onPress={() => { setMode('reset-email'); setMessage(null); }}>
                <Text style={styles.btnGhostTexte}>Mot de passe oublié ?</Text>
              </Pressable>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: VIOLET },
  centre: { alignItems: 'center', justifyContent: 'center' },
  safe: { flex: 1 },
  contenu: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  titre: { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 8 },
  aide: { fontSize: 15, color: LAVANDE, textAlign: 'center' },
  email: { fontSize: 18, fontWeight: '800', color: VERT },
  input: {
    width: '85%', backgroundColor: '#fff', borderRadius: 14, padding: 16,
    fontSize: 17, fontWeight: '600', color: VIOLET_PROFOND,
  },
  message: { color: '#FFD166', fontSize: 14, textAlign: 'center', paddingHorizontal: 16 },
  reglesMdp: { color: '#9a8fb5', fontSize: 12.5, textAlign: 'center', paddingHorizontal: 16 },
  btn: {
    backgroundColor: VERT, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32,
    minWidth: 180, alignItems: 'center',
  },
  btnOff: { opacity: 0.6 },
  btnTexte: { color: VIOLET_PROFOND, fontWeight: '800', fontSize: 17 },
  btnGhost: { marginTop: 4, padding: 12 },
  btnGhostTexte: { color: LAVANDE, fontWeight: '700', fontSize: 15, textDecorationLine: 'underline' },
  btnDanger: { color: '#E07A8A', fontWeight: '700', fontSize: 14, textDecorationLine: 'underline' },
  // Sections type "carte" (compte connecté)
  section: { width: '100%', backgroundColor: '#ffffff15', borderRadius: 16, padding: 16, gap: 8 },
  sectionTitre: { fontSize: 16, fontWeight: '900', color: VERT, marginBottom: 4 },
  label: { fontSize: 12.5, fontWeight: '700', color: '#9a8fb5' },
  valeur: { fontSize: 15.5, fontWeight: '700', color: '#fff' },
  champ: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    fontSize: 15.5, fontWeight: '600', color: VIOLET_PROFOND, width: '100%',
  },
  btnSection: {
    backgroundColor: VERT, borderRadius: 12, paddingVertical: 13,
    alignItems: 'center', width: '100%',
  },
  ligneInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  lien: { color: VERT, fontWeight: '800', fontSize: 14 },
  admin: {
    width: '100%', marginTop: 24, paddingTop: 18, gap: 10,
    borderTopWidth: 1, borderTopColor: '#ffffff33',
  },
  adminTitre: { fontSize: 18, fontWeight: '900', color: VERT, textAlign: 'center' },
  offreLigne: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#ffffff15', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  offreLigneTexte: { flex: 1, color: LAVANDE, fontWeight: '700', fontSize: 13.5 },
  msgCaisseMags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  msgCaisseChip: { backgroundColor: '#ffffff22', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  msgCaisseChipActif: { backgroundColor: VERT },
  msgCaisseChipTxt: { color: LAVANDE, fontWeight: '700', fontSize: 13 },
  msgCaisseChipTxtActif: { color: VIOLET_PROFOND },
});
