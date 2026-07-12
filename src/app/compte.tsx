// === Compte client Bubble Stop (Supabase Auth) ===
// Hub de compte type app pro : profil, sécurité (email + mot de passe confirmés
// par code email), fidélité, aide, admin. Inscription / connexion / Google OAuth.
import { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert, Switch, Linking, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { createURL } from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { enregistrerPush } from '@/lib/push';
import { reclamerJetonEnAttente } from '@/lib/carte-temp';
import { memoriserCodeParrain } from '@/lib/parrainage';
import { lireCommandeMagasins, ecrireCommandeMagasin, lireJeuFlags, ecrireJeuFlags, JeuFlags } from '@/lib/app-config';
import { offreEnCours, offreProgrammee, resumeRecurrence } from '@/lib/offres';
import { useCatalogueCloud } from '@/data/catalogue-cloud';
import { GoogleLogo } from '@/components/google-logo';
import { MAGASINS, MagasinId, getMagasin, setMagasin } from '@/store/magasin';
import { C, F, R, OMBRE } from '@/constants/charte';
import {
  Carte, LigneMenu, ChampTexte, Message, BoutonPrimaire, BoutonGhost, TitreSection,
} from '@/components/ui-kit';
import PictoOffre, { FOND_PICTO } from '@/components/pictos-offres';

// === Choix de la boutique (Aix / Lyon / Toulouse) ===
// Affiché à l'INSCRIPTION et modifiable dans « Mes informations » : c'est le client qui
// choisit sa ville — avant, profils.magasin héritait de la caisse qui traitait son tampon
// de bienvenue (un client Lyon se retrouvait « Toulouse », vécu 12/07).
function ChoixBoutique({ valeur, onChange, label = 'Ta boutique' }: {
  valeur: string | null; onChange: (id: MagasinId) => void; label?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={stylesBoutique.label}>{label}</Text>
      <View style={stylesBoutique.rangee}>
        {MAGASINS.map((m) => (
          <Pressable
            key={m.id}
            style={[stylesBoutique.chip, valeur === m.id && stylesBoutique.chipOn]}
            onPress={() => onChange(m.id)}
          >
            <Text style={[stylesBoutique.chipTxt, valeur === m.id && stylesBoutique.chipTxtOn]}>
              {m.nom}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
const stylesBoutique = StyleSheet.create({
  label: { fontFamily: F.t700, fontSize: 13, color: C.violet },
  rangee: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1, paddingVertical: 10, borderRadius: R.pill, alignItems: 'center',
    backgroundColor: C.lavande, borderWidth: 1.5, borderColor: 'transparent',
  },
  chipOn: { backgroundColor: C.vert, borderColor: C.vert },
  chipTxt: { fontFamily: F.t700, fontSize: 13.5, color: C.violetProfond },
  chipTxtOn: { color: C.violetProfond },
});

const URL_CONFIDENTIALITE = 'https://commande.bubblestop.fr/confidentialite';
const EMAIL_CONTACT = 'contact@bubblestop.fr';

// === Presets d'offres (admin) : modèles prêts à publier ===
// Tap = pré-remplit titre + message (modifiables avant publication).
// `conseil` = note pour l'admin, jamais publiée.
const PRESETS_OFFRES = [
  {
    id: 'happy-hour', emoji: '⚡', nom: 'Happy hour',
    apercu: 'Remplir les heures creuses',
    titre: '⚡ Happy hour : -30 % de 15h à 17h',
    message: 'Aujourd\'hui seulement : -30 % sur toutes les boissons entre 15h et 17h. File en boutique !',
    conseil: 'Adapte l\'horaire à ton heure creuse du jour. La remise s\'applique manuellement en caisse.',
  },
  {
    id: 'install-appli', emoji: '📲', nom: 'Bonus install',
    apercu: 'Faire installer l\'appli (+1 tampon auto)',
    titre: '📲 Installe l\'appli = 1 tampon offert',
    message: 'Télécharge l\'appli Bubble Stop et lie ta carte de fidélité : 1 tampon de bienvenue offert automatiquement. Commande en avance, suis tes tampons, profite des offres !',
    conseil: 'Le tampon de bienvenue est crédité automatiquement à la liaison de la carte — aucune manip en caisse.',
  },
  {
    id: 'avant-premiere', emoji: '🆕', nom: 'Avant-première',
    apercu: 'Nouveauté réservée aux membres',
    titre: '🆕 Nouvelle saveur en avant-première',
    message: 'La nouvelle saveur arrive ! Réservée aux membres de l\'appli pendant 3 jours — viens la goûter avant tout le monde.',
    conseil: 'Remplace par le nom de la saveur. L\'exclusivité = montrer l\'appli en caisse.',
  },
  {
    id: 'tampon-double', emoji: '✌️', nom: 'Tampons ×2',
    apercu: 'Booster ton jour le plus creux',
    titre: '✌️ Mardi = tampons ×2',
    message: 'Tous les mardis, ta carte avance deux fois plus vite : 1 boisson achetée = 2 tampons. À demain ?',
    conseil: 'Choisis ton jour le plus creux. En caisse : ajouter le 2e tampon manuellement.',
  },
  {
    id: 'canicule', emoji: '☀️', nom: 'Canicule',
    apercu: 'Pousser les citronnades quand il fait chaud',
    titre: '☀️ Alerte chaleur : citronnades -20 %',
    message: 'Il fait chaud ! -20 % sur toutes les citronnades aujourd\'hui. Fraîcheur garantie 🍋',
    conseil: 'À envoyer les jours de grosse chaleur, le matin. Produit frais, bonne marge.',
  },
  {
    id: 'pluie', emoji: '🌧️', nom: 'Jour de pluie',
    apercu: 'Boissons chaudes les jours gris',
    titre: '🌧️ Il pleut ? On te réchauffe',
    message: '-20 % sur les boissons chaudes aujourd\'hui. Le bubble tea chaud, c\'est la vie.',
    conseil: 'Spontané = efficace. Push le matin même quand la météo est moche.',
  },
  {
    id: 'duo', emoji: '👯', nom: 'Offre duo',
    apercu: 'Faire venir à deux',
    titre: '👯 À deux c\'est mieux',
    message: 'Ce week-end : 1 topping offert sur chaque boisson quand vous venez à deux. Ramène ton/ta meilleur(e) ami(e) !',
    conseil: 'Coût faible (2 toppings) et fait découvrir la boutique à de nouveaux clients.',
  },
  {
    id: 'precommande', emoji: '📲', nom: 'Click & collect',
    apercu: 'Pousser la commande sur l\'appli',
    titre: '📲 Commande sur l\'appli, zéro attente',
    message: 'Commande en avance depuis l\'appli et récupère ta boisson sans faire la queue. Teste, tu vas adorer.',
    conseil: 'À republier ~1×/mois pour installer le réflexe click & collect.',
  },
  {
    id: 'mystere', emoji: '🎁', nom: 'Boisson mystère',
    apercu: 'Fun + écouler une saveur',
    titre: '🎁 La boisson mystère est de retour',
    message: 'Aujourd\'hui : boisson mystère taille M à 4,50 €. Saveur surprise choisie par l\'équipe — t\'oses ?',
    conseil: 'Parfait pour écouler un stock de saveur. Garde un prix rond et simple.',
  },
  {
    id: 'parrainage', emoji: '🤝', nom: 'Parrainage',
    apercu: 'Tes clients recrutent pour toi',
    titre: '🤝 Amène un ami, gagnez 2 tampons',
    message: 'Ton ami commande pour la 1ère fois en donnant ton numéro de carte ? Vous gagnez chacun 1 tampon !',
    conseil: 'En caisse : ajouter le tampon manuellement chez le parrain ET le filleul.',
  },
  {
    id: 'story', emoji: '📸', nom: 'Story = topping',
    apercu: 'De la pub gratuite par tes clients',
    titre: '📸 Ta story = 1 topping offert',
    message: 'Poste ta boisson en story en nous identifiant, montre-la en caisse : topping offert sur ta prochaine commande.',
    conseil: 'Contenu gratuit sur les réseaux — l\'équipe vérifie la story au comptoir.',
  },
  {
    id: 'derniere-heure', emoji: '🌙', nom: 'Happy end',
    apercu: 'Booster la dernière heure',
    titre: '🌙 Happy end : -30 % avant la fermeture',
    message: 'Dernière heure de la journée : -30 % sur toutes les boissons. Le meilleur moment pour passer !',
    conseil: 'Lisse la fin de journée et évite les pertes. Push ~1 h 30 avant la fermeture.',
  },
  {
    id: 'etudiants', emoji: '🎓', nom: 'Étudiants',
    apercu: 'Attirer les campus voisins',
    titre: '🎓 Pause révisions : -10 % étudiants',
    message: 'Sur présentation de ta carte étudiante : -10 % sur ta boisson, tous les jours. Bon courage pour les révisions !',
    conseil: 'Parfait en période d\'examens (mai-juin, décembre). La remise s\'applique en caisse sur présentation de la carte.',
  },
  {
    id: 'hiver', emoji: '❄️', nom: 'Saison chaude',
    apercu: 'Lancer les boissons chaudes',
    titre: '❄️ Les boissons CHAUDES sont de retour',
    message: 'Le froid arrive, nos bubble teas chauds aussi ! Viens goûter le retour des boissons chaudes — réconfort garanti.',
    conseil: 'À pousser au premier coup de froid (octobre-novembre). Marche aussi en sens inverse au printemps (boissons glacées).',
  },
  {
    id: 'merci', emoji: '💜', nom: 'Merci !',
    apercu: 'Fêter un cap avec tes clients',
    titre: '💜 MERCI ! Topping offert aujourd\'hui',
    message: 'Vous êtes toujours plus nombreux sur l\'appli — pour fêter ça, topping OFFERT sur toutes les boissons aujourd\'hui !',
    conseil: 'À dégainer pour un jalon (X clients appli, anniversaire de la boutique). Coût faible, gros capital sympathie.',
  },
  {
    id: 'nouveau-topping', emoji: '🫧', nom: 'Nouveau topping',
    apercu: 'Faire goûter un lancement',
    titre: '🫧 Nouveau topping à découvrir',
    message: 'Un nouveau topping débarque ! Cette semaine, il est OFFERT sur ta boisson pour le goûter. Dis-nous ce que tu en penses !',
    conseil: 'Remplace par le nom du topping. Une semaine d\'essai gratuit installe l\'habitude — mesure ses ventes dans Stats ensuite.',
  },
  {
    id: 'gouter', emoji: '🍪', nom: 'Le goûter',
    apercu: 'Le créneau 16h-18h des familles',
    titre: '🍪 Le goûter : -1 € de 16h à 18h',
    message: 'Mercredi et samedi, c\'est goûter : -1 € sur toutes les boissons entre 16h et 18h. On t\'attend après les cours !',
    conseil: 'Cible familles et lycéens sur le créneau sortie d\'école. Récurrent = ancre l\'habitude.',
  },
] as const;

// Règles de mot de passe (alignées sur Supabase) :
// 8 caractères min, une minuscule, une majuscule, un chiffre
const REGLES_MDP = '8 caractères minimum, avec une majuscule et un chiffre';
function mdpValide(mdp: string): boolean {
  return mdp.length >= 8 && /[a-z]/.test(mdp) && /[A-Z]/.test(mdp) && /[0-9]/.test(mdp);
}

// Confirmation destructive qui marche aussi sur web (Alert y est muet)
function confirmer(titre: string, texte: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm(`${titre}\n\n${texte}`)) onOk();
    return;
  }
  Alert.alert(titre, texte, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Supprimer', style: 'destructive', onPress: onOk },
  ]);
}

export default function CompteScreen() {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<Session | null>(null);
  const [chargement, setChargement] = useState(true);

  // Formulaire (reset-email = demande du code, reset-code = saisie code + nouveau mdp,
  // confirmation = code de confirmation d'inscription)
  const [mode, setMode] = useState<'connexion' | 'inscription' | 'reset-email' | 'reset-code' | 'confirmation'>('connexion');
  // Code parrain saisi À L'INSCRIPTION (10/07, optionnel) : mémorisé via la MÊME mécanique
  // que le lien/QR /p (parrain.codeEnAttente) → appliqué automatiquement par
  // appliquerParrainEnAttente() (_layout) dès la 1ère session (après la confirmation email).
  const [codeParrain, setCodeParrain] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [codeReset, setCodeReset] = useState('');
  const [mdpReset2, setMdpReset2] = useState(''); // confirmation du nouveau mot de passe (mdp oublié)
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
  const [dateNaissance, setDateNaissance] = useState(''); // JJ/MM/AAAA
  const [naissanceVerrou, setNaissanceVerrou] = useState(false); // true = déjà enregistrée → non modifiable
  const [prenomSurTicket, setPrenomSurTicket] = useState(false);
  const [magasinClient, setMagasinClient] = useState<string | null>(null);
  // Boutique choisie à l'inscription (défaut = choix local de l'app, ex. onglet Commander)
  const [magasinInscription, setMagasinInscription] = useState<MagasinId>(getMagasin());
  const [infosOk, setInfosOk] = useState(false);
  const [estAdmin, setEstAdmin] = useState(false);
  // Section dépliée : null | 'profil' | 'email' | 'email-code' | 'mdp' | 'pin'
  const [edition, setEdition] = useState<null | 'profil' | 'email' | 'email-code' | 'mdp' | 'pin'>(null);
  const [nouvelEmail, setNouvelEmail] = useState('');
  const [codeEmail, setCodeEmail] = useState('');
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [nouveauMdp2, setNouveauMdp2] = useState('');
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [editionEnCours, setEditionEnCours] = useState(false);
  useEffect(() => {
    if (!session) { setEstAdmin(false); return; }
    enregistrerPush();
    supabase.from('profils').select('nom, numero_fidelite, est_admin, prenom_sur_ticket, magasin, date_naissance').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => {
        setPrenom(data?.nom ?? '');
        setTelFidelite(data?.numero_fidelite ?? '');
        // Carte fidélité express : récupère auto les tampons d'un QR en attente dès qu'on a un numéro.
        if (data?.numero_fidelite) reclamerJetonEnAttente(String(data.numero_fidelite)).catch(() => {});
        setPrenomSurTicket(!!data?.prenom_sur_ticket);
        setEstAdmin(!!data?.est_admin);
        setMagasinClient(data?.magasin ?? null);
        // date_naissance (YYYY-MM-DD) → affichage JJ/MM/AAAA ; verrouillée si déjà saisie
        setDateNaissance(data?.date_naissance ? String(data.date_naissance).split('-').reverse().join('/') : '');
        setNaissanceVerrou(!!data?.date_naissance);
      });
  }, [session]);

  // === Admin : gestion des offres ===
  const [offreTitre, setOffreTitre] = useState('');
  const [offreMessage, setOffreMessage] = useState('');
  // Programmation (optionnelle) : jours de semaine, plage horaire, période, push auto.
  // Ex. « -30 % fruit tea » les lundis 16:00→18:00 : jours=[1], 16:00, 18:00, push auto ON
  // → visible (appli + bandeau caisse) UNIQUEMENT pendant la fenêtre, push au début de chaque occurrence.
  const [offreJours, setOffreJours] = useState<number[]>([]);
  const [offreHeureDebut, setOffreHeureDebut] = useState('');
  const [offreHeureFin, setOffreHeureFin] = useState('');
  const [offreDateDebut, setOffreDateDebut] = useState(''); // JJ/MM/AAAA (optionnel)
  const [offreDateFin, setOffreDateFin] = useState('');
  const [offrePushAuto, setOffrePushAuto] = useState(false);
  // Contenu STRUCTURÉ (remise appliquée AUTOMATIQUEMENT par la caisse, ≥ POS 0.28.138) :
  // type −% (sur les lignes ciblées) ou −€ (par boisson ciblée) + catégories cibles.
  const [offreRemiseType, setOffreRemiseType] = useState<'' | 'pourcent' | 'montant' | 'tampons'>('');
  const [offreRemiseValeur, setOffreRemiseValeur] = useState('');
  const [offreCibleCats, setOffreCibleCats] = useState<string[]>([]);
  const { categories: catsCatalogue } = useCatalogueCloud(); // catégories du catalogue POS (fruit-tea…)
  const [offres, setOffres] = useState<any[]>([]);
  const [cmdMap, setCmdMap] = useState<Record<string, boolean> | null>(null); // commande en ligne par magasin
  const [cmdBusy, setCmdBusy] = useState<string | null>(null); // magasin en cours de bascule
  // 🕹️ Jeu Boba Quest : interrupteurs clients / admin (déclarés AVANT le useEffect qui les charge)
  const [jeuFlags, setJeuFlags] = useState<JeuFlags | null>(null);
  const [jeuBusy, setJeuBusy] = useState(false);
  const [offreEtat, setOffreEtat] = useState<string | null>(null);
  // Preset sélectionné (pré-remplit les champs, modifiables ensuite)
  const [presetId, setPresetId] = useState<string | null>(null);
  const choisirPreset = (p: (typeof PRESETS_OFFRES)[number]) => {
    if (presetId === p.id) { setPresetId(null); setOffreTitre(''); setOffreMessage(''); return; }
    setPresetId(p.id);
    setOffreTitre(p.titre);
    setOffreMessage(p.message);
    setOffreEtat(null);
  };
  const presetActif = PRESETS_OFFRES.find((p) => p.id === presetId);
  const chargerOffres = async () => {
    const { data } = await supabase.from('offres').select('*').order('created_at', { ascending: false }).limit(10);
    setOffres(data ?? []);
  };
  useEffect(() => { if (estAdmin) { chargerOffres(); lireCommandeMagasins().then(setCmdMap); lireJeuFlags().then(setJeuFlags); } }, [estAdmin]);

  // Active / désactive la commande en ligne pour UN magasin (flag serveur app_config, par magasin).
  const toggleCommande = async (magasin: string) => {
    if (cmdMap === null || cmdBusy) return;
    const nouveau = !cmdMap[magasin];
    setCmdBusy(magasin);
    setCmdMap({ ...cmdMap, [magasin]: nouveau }); // optimiste
    const ok = await ecrireCommandeMagasin(magasin, nouveau);
    if (!ok) setCmdMap((m) => ({ ...(m || {}), [magasin]: !nouveau })); // rollback si échec
    setCmdBusy(null);
  };

  // 🕹️ Jeu Boba Quest : DEUX interrupteurs serveur indépendants (demande Yoann) —
  // visible pour les CLIENTS (actif) / visible pour les ADMINS (adminVisible).
  const toggleJeu = async (cle: keyof JeuFlags) => {
    if (jeuFlags === null || jeuBusy) return;
    const nouveau = { ...jeuFlags, [cle]: !jeuFlags[cle] };
    setJeuBusy(true);
    setJeuFlags(nouveau); // optimiste
    const ok = await ecrireJeuFlags({ [cle]: nouveau[cle] });
    if (!ok) setJeuFlags(jeuFlags); // rollback si échec
    setJeuBusy(false);
  };

  // 'HH:MM' toléré en saisie : '16', '16h', '16h30', '16:30' → normalisé ou null si invalide
  const normaliserHeure = (v: string): string | null => {
    const s = String(v || '').trim().toLowerCase().replace('h', ':');
    if (!s) return null;
    const m = /^(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
    if (!m) return null;
    const h = Number(m[1]); const mn = Number(m[2] || 0);
    if (h > 23 || mn > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
  };
  const dateFrVersIso = (v: string): string | null => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v || '').trim());
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  };
  const basculerJourOffre = (j: number) =>
    setOffreJours((prev) => (prev.includes(j) ? prev.filter((x) => x !== j) : [...prev, j]));

  const publierOffre = async (avecPush: boolean) => {
    if (!offreTitre.trim() || !offreMessage.trim()) {
      setOffreEtat('Titre et message requis.');
      return;
    }
    // Programmation : validation AVANT publication (heures / dates lisibles)
    const hDebut = normaliserHeure(offreHeureDebut);
    const hFin = normaliserHeure(offreHeureFin);
    if (offreHeureDebut.trim() && !hDebut) { setOffreEtat('Heure de début invalide (ex : 16:00).'); return; }
    if (offreHeureFin.trim() && !hFin) { setOffreEtat('Heure de fin invalide (ex : 18:00).'); return; }
    if (hDebut && hFin && hFin <= hDebut) { setOffreEtat('L\'heure de fin doit être après le début.'); return; }
    const dDebut = dateFrVersIso(offreDateDebut);
    const dFin = dateFrVersIso(offreDateFin);
    if (offreDateDebut.trim() && !dDebut) { setOffreEtat('Date de début invalide (JJ/MM/AAAA).'); return; }
    if (offreDateFin.trim() && !dFin) { setOffreEtat('Date de fin invalide (JJ/MM/AAAA).'); return; }
    if (dDebut && dFin && dFin < dDebut) { setOffreEtat('La date de fin doit être après le début.'); return; }
    // Remise structurée (appliquée auto par la caisse)
    let remiseValeur: number | null = null;
    if (offreRemiseType) {
      remiseValeur = Number(String(offreRemiseValeur).trim().replace(',', '.'));
      if (!(remiseValeur > 0)) { setOffreEtat('Valeur de remise invalide (ex : 30 ou 1,50).'); return; }
      if (offreRemiseType === 'pourcent' && remiseValeur > 100) { setOffreEtat('Un pourcentage ne peut pas dépasser 100.'); return; }
      if (offreRemiseType === 'tampons') {
        remiseValeur = Math.round(remiseValeur);
        if (remiseValeur < 2 || remiseValeur > 5) { setOffreEtat('Tampons : multiplicateur entre 2 et 5 (ex : 2 = tampons ×2).'); return; }
      }
    }
    setOffreEtat('Publication…');
    try {
      const { data: creee, error } = await supabase.from('offres')
        .insert({
          titre: offreTitre.trim(),
          message: offreMessage.trim(),
          jours: offreJours.length > 0 && offreJours.length < 7 ? offreJours : null,
          heure_debut: hDebut, heure_fin: hFin,
          date_debut: dDebut, date_fin: dFin,
          push_auto: offrePushAuto,
          remise_type: offreRemiseType || null,
          remise_valeur: remiseValeur,
          // 'tampons' s'applique à TOUTE la commande → jamais de catégories ciblées
          cible_categories: offreRemiseType && offreRemiseType !== 'tampons' && offreCibleCats.length ? offreCibleCats : null,
        })
        .select('id').maybeSingle();
      if (error) throw error;
      let txt = '✅ Offre publiée (visible sur l\'accueil)';
      if (avecPush) {
        const { data, error: errPush } = await supabase.functions.invoke('envoyer-offre', {
          // offre_id → l'edge tamponne envoyee_le + nb_push sur l'offre (suivi dans l'appli stock)
          body: { titre: offreTitre.trim(), message: offreMessage.trim(), offre_id: creee?.id ?? null },
        });
        txt = errPush
          ? '✅ Publiée, ⚠️ push échoué'
          : `✅ Publiée + push envoyé à ${data?.destinataires ?? 0} appareil(s)`;
      } else if (offrePushAuto) {
        txt = '✅ Offre programmée — push automatique au début de chaque occurrence';
      }
      setOffreTitre(''); setOffreMessage(''); setPresetId(null);
      setOffreJours([]); setOffreHeureDebut(''); setOffreHeureFin('');
      setOffreDateDebut(''); setOffreDateFin(''); setOffrePushAuto(false);
      setOffreRemiseType(''); setOffreRemiseValeur(''); setOffreCibleCats([]);
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

  // === Mes informations : prénom + numéro fidélité + date de naissance ===
  const enregistrerInfos = async () => {
    if (!session) return;
    // Date de naissance JJ/MM/AAAA → YYYY-MM-DD (vide = effacée)
    let naissanceIso: string | null = null;
    if (dateNaissance.trim()) {
      const m = dateNaissance.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      const [, j, mo, a] = m ?? [];
      const valide = m && +mo >= 1 && +mo <= 12 && +j >= 1 && +j <= 31 && +a >= 1900 && +a <= new Date().getFullYear();
      if (!valide) {
        setInfoMsg('Date de naissance : format JJ/MM/AAAA.');
        return;
      }
      naissanceIso = `${a}-${mo}-${j}`;
    }
    setInfoMsg(null);
    const maj: Record<string, any> = {
      id: session.user.id,
      nom: prenom.trim() || null,
      prenom_sur_ticket: prenomSurTicket,
    };
    // Boutique : choisie/modifiée librement par le client (offres et infos locales)
    if (magasinClient) maj.magasin = magasinClient;
    // Date de naissance : enregistrée UNE seule fois, ensuite non modifiable
    if (!naissanceVerrou) maj.date_naissance = naissanceIso;

    const appliquer = async () => {
      const { error: errMaj } = await supabase.from('profils').upsert(maj);
      if (errMaj) {
        setInfoMsg(`Erreur : ${errMaj.message}`);
        return;
      }
      if (!naissanceVerrou && naissanceIso) setNaissanceVerrou(true); // verrouille après 1er enregistrement
      // L'app locale suit la boutique du profil (onglet Commander, catalogue, horaires)
      if (magasinClient && MAGASINS.some((m) => m.id === magasinClient)) setMagasin(magasinClient as MagasinId);
      setInfosOk(true);
      setTimeout(() => setInfosOk(false), 2000);
    };

    // 1re saisie d'une date de naissance → confirmation explicite (devient non modifiable)
    if (!naissanceVerrou && naissanceIso) {
      confirmer(
        'Date de naissance définitive',
        `Confirme ta date de naissance : ${dateNaissance.trim()}.\n\n⚠️ Une fois enregistrée, elle ne pourra PLUS être modifiée.`,
        appliquer,
      );
      return;
    }
    await appliquer();
  };

  const fermerEdition = () => {
    setEdition(null);
    setNouvelEmail(''); setCodeEmail(''); setNouveauMdp(''); setNouveauMdp2('');
    setInfoMsg(null);
  };

  // === Changement du PIN fidélité (appliqué par la caisse sous ~1 min) ===
  const [ancienPin, setAncienPin] = useState('');
  const [nouveauPin, setNouveauPin] = useState('');
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  // Affiche le résultat de la dernière demande (rempli par la caisse)
  useEffect(() => {
    if (!session || !telFidelite) return;
    supabase.from('fidelite_pin_demandes')
      .select('statut, raison, created_at')
      .eq('telephone', telFidelite) // SA carte uniquement (la colonne DB garde son nom historique)
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
    // Un numéro de carte = TOUJOURS 8 chiffres (l'ancien seuil `< 6` datait de l'ère téléphone)
    if (t.length !== 8) { setPinMsg('Active d\'abord ta carte (onglet Fidélité).'); return; }
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
      setAncienPin(''); setNouveauPin(''); setEdition(null);
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
  // 1. Ouverture de la section → envoi du code à l'adresse du compte
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

  // === Connexion / inscription via Google (OAuth Supabase) ===
  // Web/PWA : redirection de la page puis retour (session lue dans l'URL).
  // Natif : ouverture de la page de consentement Google.
  const loginGoogle = async () => {
    setMessage(null);
    try {
      // Web/PWA : redirection de page classique, session relue dans l'URL au retour.
      if (Platform.OS === 'web') {
        const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
        if (error) throw error;
        return;
      }
      // Natif : on ouvre Google dans une session navigateur et on CAPTE le retour deep-link
      // (sinon le navigateur retombe sur le site web et l'app ne reçoit jamais la session).
      const redirectTo = createURL('/'); // ex. bubblestop://
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('URL OAuth introuvable');
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type !== 'success' || !res.url) return; // annulé par l'utilisateur
      // Récupère la session depuis l'URL de retour : ?code= (PKCE) ou #access_token= (implicite).
      const retour = res.url;
      const lire = (s: string): Record<string, string> => {
        const out: Record<string, string> = {};
        s.split('&').forEach((kv) => { const [k, v] = kv.split('='); if (k) out[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
        return out;
      };
      const q = lire(retour.includes('?') ? retour.split('?')[1].split('#')[0] : '');
      if (q.code) {
        const { error: e2 } = await supabase.auth.exchangeCodeForSession(q.code);
        if (e2) throw e2;
      } else {
        const h = lire(retour.includes('#') ? retour.split('#')[1] : '');
        if (h.access_token && h.refresh_token) {
          const { error: e3 } = await supabase.auth.setSession({ access_token: h.access_token, refresh_token: h.refresh_token });
          if (e3) throw e3;
        }
      }
    } catch (e: any) {
      setMessage(String(e?.message ?? e));
    }
  };

  // === Connexion via Apple (iOS — exigé par l'App Store 4.8 dès qu'on propose Google) ===
  // Token d'identité Apple → Supabase (provider apple). Le provider Apple doit être activé
  // côté Supabase avec le bundle `com.bubblestop.client` dans les Client IDs autorisés.
  const loginApple = async () => {
    setMessage(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('Connexion Apple incomplète (jeton manquant).');
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
      if (error) throw error;
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return; // annulé par l'utilisateur
      setMessage(String(e?.message ?? e));
    }
  };

  // JJ/MM/AAAA → YYYY-MM-DD (null si invalide, dans le futur, ou improbable)
  const naissanceVersIso = (saisie: string): string | null => {
    const m = saisie.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const jour = +m[1], mois = +m[2], annee = +m[3];
    if (mois < 1 || mois > 12 || jour < 1 || jour > 31 || annee < 1900) return null;
    const d = new Date(annee, mois - 1, jour);
    if (d.getFullYear() !== annee || d.getMonth() !== mois - 1 || d.getDate() !== jour) return null;
    if (d.getTime() > Date.now()) return null;
    return `${m[3]}-${m[2]}-${m[1]}`;
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
    // Date de naissance OBLIGATOIRE à l'inscription (définitive ensuite)
    let naissanceIso: string | null = null;
    if (mode === 'inscription') {
      naissanceIso = naissanceVersIso(dateNaissance);
      if (!naissanceIso) {
        setMessage('Renseigne ta date de naissance (JJ/MM/AAAA).');
        return;
      }
    }
    setEnCours(true);
    try {
      if (mode === 'inscription') {
        // Code parrain (optionnel) : mémorisé AVANT la création du compte — il sera
        // appliqué tout seul à la 1ère session (best effort, jamais bloquant).
        if (codeParrain.replace(/\D/g, '').length >= 6) {
          try { await memoriserCodeParrain(codeParrain); } catch (e) { /* best effort */ }
        }
        // 1. Création du compte auth
        const { data, error } = await supabase.auth.signUp({ email: mail, password: mdp });
        if (error) throw error;

        // Email DÉJÀ utilisé : par sécurité (anti-énumération) Supabase renvoie un
        // utilisateur SANS identités au lieu d'une erreur → on le détecte et on prévient.
        if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setMessage('Cet email est déjà utilisé. Connecte-toi, ou utilise « Mot de passe oublié ».');
          setEnCours(false);
          return;
        }

        // 2. Création du profil — le numéro de fidélité (code) est attribué plus tard via
        //    « Activer ma carte » (onglet Fidélité). Plus aucun téléphone.
        if (data.user && data.session) {
          const { error: errProfil } = await supabase.from('profils').insert({
            id: data.user.id,
            nom: nom.trim() || null,
            email: mail,
            date_naissance: naissanceIso,
            magasin: magasinInscription, // boutique CHOISIE par le client (fix « Lyon → Toulouse »)
          });
          if (errProfil) throw errProfil;
          setMagasin(magasinInscription);
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
        await supabase.from('profils').upsert({
          id: data.user.id,
          nom: nom.trim() || null,
          email: mail,
          date_naissance: naissanceVersIso(dateNaissance),
          magasin: magasinInscription, // boutique CHOISIE par le client
        });
        setMagasin(magasinInscription);
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
    if (mdp !== mdpReset2) {
      setMessage('Les deux mots de passe ne correspondent pas.');
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
      setMdpReset2('');
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
    confirmer(
      'Supprimer mon compte',
      'Ton compte, tes commandes et ta carte seront supprimés définitivement. Cette action est irréversible.',
      async () => {
        try {
          const { data, error } = await supabase.functions.invoke('supprimer-compte');
          if (error || !data?.ok) throw error || new Error('échec de la suppression');
          await supabase.auth.signOut();
        } catch (e: any) {
          if (Platform.OS === 'web') setInfoMsg(String(e?.message ?? e));
          else Alert.alert('Erreur', String(e?.message ?? e));
        }
      },
    );
  };

  if (chargement) {
    return (
      <View style={[styles.fond, styles.centre]}>
        <ActivityIndicator color={C.violet} size="large" />
      </View>
    );
  }

  // === Connecté : hub du compte ===
  if (session) {
    const initiale = (prenom || session.user.email || '?').trim().charAt(0).toUpperCase();
    const nomMagasin = magasinClient ? (MAGASINS.find((m) => m.id === magasinClient)?.nom || magasinClient) : null;
    return (
      <View style={styles.fond}>
        {/* KAV indispensable (rejet App Store 4.0 iPad) : les champs number-pad du bas
            (PIN, codes) n'ont pas de touche retour et masquaient leurs boutons. */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.contenu, { paddingTop: insets.top + 18 }]}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.titre}>Mon compte</Text>

          {/* === En-tête profil === */}
          <Carte style={styles.profil}>
            <View style={styles.avatar}><Text style={styles.avatarTxt}>{initiale}</Text></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.profilNom}>{prenom || 'Mon profil'}</Text>
              <Text style={styles.profilEmail} numberOfLines={1}>{session.user.email}</Text>
              {!!nomMagasin && <Text style={styles.profilMagasin}>📍 {nomMagasin}</Text>}
            </View>
          </Carte>

          {/* === Mon profil (infos + prénom ticket) === */}
          <TitreSection texte="Mon profil" />
          <Carte style={{ paddingVertical: 4 }}>
            <LigneMenu
              titre="Mes informations"
              sousTitre="Prénom, numéro de carte, prénom sur les tickets"
              onPress={() => (edition === 'profil' ? fermerEdition() : setEdition('profil'))}
            />
            {edition === 'profil' && (
              <View style={styles.depli}>
                <ChampTexte label="Prénom" value={prenom} onChangeText={setPrenom} placeholder="Prénom" autoCapitalize="words" />
                <ChampTexte
                  label="Ton numéro de fidélité"
                  value={telFidelite || '—'}
                  onChangeText={() => {}}
                  editable={false}
                />
                <Text style={styles.aideChamp}>
                  🎟️ Ton numéro de fidélité est attribué automatiquement. Active ta carte dans l'onglet Fidélité pour l'obtenir et afficher ton QR.
                </Text>
                <ChampTexte
                  label="Date de naissance 🎂 (grande boisson offerte le jour J)"
                  value={dateNaissance}
                  editable={!naissanceVerrou}
                  onChangeText={(v) => {
                    if (naissanceVerrou) return; // non modifiable une fois enregistrée
                    // Auto-format JJ/MM/AAAA pendant la saisie
                    const ch = v.replace(/\D/g, '').slice(0, 8);
                    let aff = ch;
                    if (ch.length > 4) aff = `${ch.slice(0, 2)}/${ch.slice(2, 4)}/${ch.slice(4)}`;
                    else if (ch.length > 2) aff = `${ch.slice(0, 2)}/${ch.slice(2)}`;
                    setDateNaissance(aff);
                  }}
                  placeholder="JJ/MM/AAAA"
                  keyboardType="number-pad"
                  maxLength={10}
                />
                {naissanceVerrou && (
                  <Text style={styles.aideChamp}>🔒 Date de naissance enregistrée — non modifiable.</Text>
                )}
                <View style={styles.ligneSwitch}>
                  <Text style={styles.ligneSwitchTxt}>Afficher mon prénom sur mes tickets</Text>
                  <Switch
                    value={prenomSurTicket}
                    onValueChange={setPrenomSurTicket}
                    trackColor={{ false: C.bord, true: C.vert }}
                    thumbColor="#fff"
                  />
                </View>
                {/* Boutique : le client choisit SA ville (avant : héritée de la caisse qui
                    traitait son bonus de bienvenue → clients Lyon marqués « Toulouse ») */}
                <ChoixBoutique valeur={magasinClient} onChange={(id) => setMagasinClient(id)} label="Ma boutique" />
                <BoutonPrimaire titre={infosOk ? '✓ Enregistré' : 'Enregistrer'} onPress={enregistrerInfos} />
              </View>
            )}
            <LigneMenu
              titre="Ma carte de fidélité"
              sousTitre="QR, tampons et boissons offertes"
              onPress={() => router.push('/explore' as any)}
            />
            <LigneMenu
              titre="Mes commandes"
              sousTitre="Suivi et historique"
              onPress={() => router.push('/commander/mes-commandes' as any)}
              separateur={false}
            />
          </Carte>

          {/* === Connexion & sécurité === */}
          <TitreSection texte="Connexion & sécurité" />
          <Carte style={{ paddingVertical: 4 }}>
            <LigneMenu
              titre="Adresse email"
              sousTitre={session.user.email ?? ''}
              onPress={() => ((edition === 'email' || edition === 'email-code') ? fermerEdition() : setEdition('email'))}
            />
            {edition === 'email' && (
              <View style={styles.depli}>
                <ChampTexte
                  label="Nouvelle adresse email"
                  value={nouvelEmail}
                  onChangeText={setNouvelEmail}
                  placeholder="nouvelle@adresse.fr"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <BoutonPrimaire titre="Recevoir le code de confirmation" onPress={demanderChangementEmail} loading={editionEnCours} />
              </View>
            )}
            {edition === 'email-code' && (
              <View style={styles.depli}>
                <ChampTexte
                  label="Code reçu par email"
                  value={codeEmail}
                  onChangeText={setCodeEmail}
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={10}
                />
                <BoutonPrimaire titre="Confirmer le changement" onPress={validerChangementEmail} loading={editionEnCours} />
              </View>
            )}

            <LigneMenu
              titre="Mot de passe"
              sousTitre="Modification confirmée par code email"
              onPress={() => (edition === 'mdp' ? fermerEdition() : demanderChangementMdp())}
            />
            {edition === 'mdp' && (
              <View style={styles.depli}>
                <ChampTexte
                  label="Code reçu par email"
                  value={codeMdp}
                  onChangeText={setCodeMdp}
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={10}
                />
                <ChampTexte
                  label="Nouveau mot de passe"
                  value={nouveauMdp}
                  onChangeText={setNouveauMdp}
                  placeholder={REGLES_MDP}
                  secureTextEntry
                />
                <ChampTexte
                  label="Confirme le nouveau mot de passe"
                  value={nouveauMdp2}
                  onChangeText={setNouveauMdp2}
                  placeholder="••••••••"
                  secureTextEntry
                />
                <BoutonPrimaire titre="Changer le mot de passe" onPress={changerMdp} loading={editionEnCours} />
              </View>
            )}

            <LigneMenu
              titre="Code PIN fidélité"
              sousTitre="Utilisé en caisse avec ton numéro"
              onPress={() => {
                if (edition === 'pin') { fermerEdition(); return; }
                setEdition('pin'); setPinMsg(null);
              }}
              separateur={false}
            />
            {edition === 'pin' && (
              <View style={styles.depli}>
                <ChampTexte
                  label="Ancien PIN (vide si jamais défini)"
                  value={ancienPin}
                  onChangeText={setAncienPin}
                  placeholder="••••"
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                />
                <ChampTexte
                  label="Nouveau PIN (4 chiffres)"
                  value={nouveauPin}
                  onChangeText={setNouveauPin}
                  placeholder="••••"
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                />
                <BoutonPrimaire titre="Changer mon PIN" onPress={envoyerDemandePin} />
              </View>
            )}
            {!!pinMsg && <View style={{ paddingBottom: 12 }}><Message texte={pinMsg} /></View>}
            {!!infoMsg && <View style={{ paddingBottom: 12 }}><Message texte={infoMsg} type={infoMsg.startsWith('✓') ? 'ok' : 'info'} /></View>}
          </Carte>

          {/* === Aide === */}
          <TitreSection texte="Aide" />
          <Carte style={{ paddingVertical: 4 }}>
            <LigneMenu
              titre="Nous contacter"
              sousTitre={EMAIL_CONTACT}
              onPress={() => Linking.openURL(`mailto:${EMAIL_CONTACT}`)}
            />
            <LigneMenu
              titre="Politique de confidentialité"
              onPress={() => Linking.openURL(URL_CONFIDENTIALITE)}
              separateur={false}
            />
          </Carte>

          <BoutonGhost titre="Se déconnecter" onPress={deconnexion} />
          <BoutonGhost titre="Supprimer mon compte" onPress={supprimerCompte} danger />

          {/* === Section ADMIN === */}
          {estAdmin && (
            <>
              <TitreSection texte="🛠️ Admin" />
              <Carte style={{ gap: 10 }}>
                <BoutonPrimaire
                  titre="📋 Toutes les commandes (3 magasins)"
                  onPress={() => router.push('/commander/admin-commandes' as any)}
                />
              </Carte>

              {/* Commande en ligne : activable PAR MAGASIN (l'appli sert d'abord à la fidélité) */}
              <Carte style={{ gap: 10 }}>
                <Text style={styles.adminTitre}>Commande en ligne (par magasin)</Text>
                <Text style={styles.cmdToggleSous}>
                  Active la commande dans l'appli pour les clients d'un magasin. Désactivée = fidélité uniquement.
                </Text>
                {MAGASINS.map((m) => (
                  <View key={m.id} style={styles.cmdMagLigne}>
                    <Text style={styles.cmdMagNom}>{m.nom}</Text>
                    <Switch
                      value={!!cmdMap?.[m.id]}
                      onValueChange={() => toggleCommande(m.id)}
                      disabled={cmdMap === null || cmdBusy === m.id}
                      trackColor={{ true: C.vert, false: '#C9C2D6' }}
                      thumbColor="#fff"
                    />
                  </View>
                ))}
              </Carte>

              {/* 🕹️ Jeu Boba Quest : deux interrupteurs indépendants (clients / admin) */}
              <Carte style={{ gap: 10 }}>
                <Text style={styles.adminTitre}>🕹️ Jeu Boba Quest</Text>
                <Text style={styles.cmdToggleSous}>
                  Deux interrupteurs indépendants : l'onglet jeu peut être ouvert aux clients,
                  ou visible seulement pour toi (pour tester), ou coupé partout. La progression
                  des joueurs n'est jamais effacée — caché ≠ remis à zéro.
                </Text>
                <View style={styles.cmdMagLigne}>
                  <Text style={styles.cmdMagNom}>Visible pour les clients</Text>
                  <Switch
                    value={!!jeuFlags?.actif}
                    onValueChange={() => toggleJeu('actif')}
                    disabled={jeuFlags === null || jeuBusy}
                    trackColor={{ true: C.vert, false: '#C9C2D6' }}
                    thumbColor="#fff"
                  />
                </View>
                <View style={styles.cmdMagLigne}>
                  <Text style={styles.cmdMagNom}>Visible pour l'admin (moi)</Text>
                  <Switch
                    value={!!jeuFlags?.adminVisible}
                    onValueChange={() => toggleJeu('adminVisible')}
                    disabled={jeuFlags === null || jeuBusy}
                    trackColor={{ true: C.vert, false: '#C9C2D6' }}
                    thumbColor="#fff"
                  />
                </View>
              </Carte>

              {/* Offres / annonces */}
              <Carte style={{ gap: 10 }}>
                <Text style={styles.adminTitre}>Offres & annonces</Text>
                <Text style={styles.cmdToggleSous}>
                  Publiée = visible sur l'accueil de l'appli · « + push » = notification à tous les clients.
                </Text>

                {/* === Modèles prêts à publier (pictos maison, scroll horizontal) === */}
                <Text style={styles.presetsAide}>Choisis un modèle ou écris librement :</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsRail}>
                  {PRESETS_OFFRES.map((p) => (
                    <Pressable
                      key={p.id}
                      style={[styles.preset, presetId === p.id && styles.presetActif]}
                      onPress={() => choisirPreset(p)}>
                      <PictoOffre id={p.id} fond={presetId === p.id ? '#fff' : FOND_PICTO[p.id]} taille={42} />
                      <Text style={styles.presetNom} numberOfLines={1}>{p.nom}</Text>
                      <Text style={styles.presetApercu} numberOfLines={2}>{p.apercu}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                {/* Conseil d'utilisation du preset (jamais publié) */}
                {presetActif && <Message texte={`💡 ${presetActif.conseil}`} />}

                <ChampTexte
                  value={offreTitre}
                  onChangeText={setOffreTitre}
                  placeholder="Titre (ex : -20 % aujourd'hui !)"
                  maxLength={60}
                />
                <TextInput
                  style={[styles.adminMultiligne]}
                  value={offreMessage}
                  onChangeText={setOffreMessage}
                  placeholder="Message de l'offre"
                  placeholderTextColor={C.texte3}
                  multiline
                  maxLength={180}
                />
                {/* === ⏰ Programmation (optionnelle) : jours · heures · période · push auto === */}
                <View style={styles.progBloc}>
                  <Text style={styles.progTitre}>⏰ Programmation (optionnel)</Text>
                  <Text style={styles.progAide}>
                    Ex : -30 % fruit tea les lundis 16:00 → 18:00. L'offre ne s'affiche (appli + caisses)
                    que pendant sa fenêtre, et disparaît toute seule en dehors.
                  </Text>
                  <View style={styles.progJours}>
                    {([[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']] as [number, string][]).map(([j, nom], i) => (
                      <Pressable
                        key={`${j}-${i}`}
                        style={[styles.progJour, offreJours.includes(j) && styles.progJourActif]}
                        onPress={() => basculerJourOffre(j)}>
                        <Text style={[styles.progJourTxt, offreJours.includes(j) && styles.progJourTxtActif]}>{nom}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <ChampTexte value={offreHeureDebut} onChangeText={setOffreHeureDebut} placeholder="De (ex : 16:00)" maxLength={5} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ChampTexte value={offreHeureFin} onChangeText={setOffreHeureFin} placeholder="À (ex : 18:00)" maxLength={5} />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <ChampTexte value={offreDateDebut} onChangeText={setOffreDateDebut} placeholder="Du (JJ/MM/AAAA)" maxLength={10} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ChampTexte value={offreDateFin} onChangeText={setOffreDateFin} placeholder="Au (JJ/MM/AAAA)" maxLength={10} />
                    </View>
                  </View>
                  <View style={styles.cmdMagLigne}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cmdMagNom}>📣 Push auto à chaque occurrence</Text>
                      <Text style={styles.progAide}>Notification envoyée à tous au début de chaque créneau (max 1/jour par offre).</Text>
                    </View>
                    <Switch
                      value={offrePushAuto}
                      onValueChange={setOffrePushAuto}
                      trackColor={{ true: C.vert, false: '#C9C2D6' }}
                      thumbColor="#fff"
                    />
                  </View>
                </View>

                {/* === 💶 Remise automatique en caisse (contenu structuré de l'offre) === */}
                <View style={styles.progBloc}>
                  <Text style={styles.progTitre}>💶 Remise automatique en caisse (optionnel)</Text>
                  <Text style={styles.progAide}>
                    La caisse applique la remise TOUTE SEULE pendant la fenêtre de l'offre
                    (caisse + borne, ligne dédiée sur le ticket). Sans réglage, l'offre est
                    purement informative et l'employé applique la remise à la main.
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {([['', 'Aucune'], ['pourcent', '− %'], ['montant', '− € / boisson'], ['tampons', '🎟️ Tampons ×N']] as ['' | 'pourcent' | 'montant' | 'tampons', string][]).map(([t, nom]) => (
                      <Pressable
                        key={t || 'aucune'}
                        style={[styles.progJour, offreRemiseType === t && styles.progJourActif]}
                        onPress={() => setOffreRemiseType(t)}>
                        <Text style={[styles.progJourTxt, offreRemiseType === t && styles.progJourTxtActif]}>{nom}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {offreRemiseType === 'tampons' && (
                    <Text style={styles.progAide}>
                      🎟️ Chaque boisson payée crédite N tampons (borne + caisse, automatique).
                      Le bonus se cumule sur la carte pour la prochaine visite — les boissons
                      offertes n'en gagnent pas.
                    </Text>
                  )}
                  {offreRemiseType !== '' && (
                    <>
                      <ChampTexte
                        value={offreRemiseValeur}
                        onChangeText={setOffreRemiseValeur}
                        placeholder={offreRemiseType === 'pourcent' ? 'Ex : 30 (= −30 %)' : offreRemiseType === 'tampons' ? 'Ex : 2 (= tampons ×2)' : 'Ex : 1,50 (= −1,50 € par boisson)'}
                        keyboardType={offreRemiseType === 'tampons' ? 'number-pad' : 'decimal-pad'}
                        maxLength={6}
                      />
                      {offreRemiseType !== 'tampons' && (
                        <>
                          <Text style={styles.progAide}>Catégories concernées (rien de coché = toute la carte) :</Text>
                          <View style={styles.msgCaisseMags}>
                            {catsCatalogue.map((c: any) => (
                              <Pressable
                                key={c.id}
                                style={[styles.msgCaisseChip, offreCibleCats.includes(c.id) && styles.msgCaisseChipActif]}
                                onPress={() => setOffreCibleCats((prev) =>
                                  prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id])}>
                                <Text style={[styles.msgCaisseChipTxt, offreCibleCats.includes(c.id) && styles.msgCaisseChipTxtActif]}>
                                  {c.nom}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </>
                      )}
                    </>
                  )}
                </View>

                {offreEtat && <Message texte={offreEtat} />}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <BoutonPrimaire titre="Publier" onPress={() => publierOffre(false)} style={{ flex: 1 }} />
                  <BoutonPrimaire titre="📣 + push" onPress={() => publierOffre(true)} style={{ flex: 1 }} />
                </View>
                {offres.map((o) => (
                  <View key={o.id} style={[styles.offreLigne, !o.active && { opacity: 0.5 }]}>
                    <View style={[styles.offreStatut, { backgroundColor: !o.active ? C.fond : offreEnCours(o) ? '#eef4d8' : '#fdf3d7' }]}>
                      <Text style={[styles.offreStatutTxt, { color: !o.active ? C.texte3 : offreEnCours(o) ? '#6d8a1a' : '#b07d10' }]}>
                        {!o.active ? 'OFF' : offreEnCours(o) ? 'EN COURS' : 'PROGRAMMÉE'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.offreLigneTexte} numberOfLines={1}>{o.titre}</Text>
                      {offreProgrammee(o) && (
                        <Text style={styles.offreLigneSous} numberOfLines={1}>
                          ⏰ {resumeRecurrence(o)}{o.push_auto ? ' · 📣 push auto' : ''}
                        </Text>
                      )}
                      {o.remise_type === 'tampons' && Number(o.remise_valeur) >= 2 && (
                        <Text style={styles.offreLigneSous} numberOfLines={1}>
                          🎟️ Tampons ×{Math.round(Number(o.remise_valeur))} sur toute la commande · auto borne + caisse
                        </Text>
                      )}
                      {(o.remise_type === 'pourcent' || o.remise_type === 'montant') && Number(o.remise_valeur) > 0 && (
                        <Text style={styles.offreLigneSous} numberOfLines={1}>
                          💶 {o.remise_type === 'pourcent'
                            ? `−${o.remise_valeur} %`
                            : `−${Number(o.remise_valeur).toFixed(2).replace('.', ',')} €/boisson`}
                          {' sur '}
                          {Array.isArray(o.cible_categories) && o.cible_categories.length
                            ? o.cible_categories.map((id: string) => catsCatalogue.find((c: any) => c.id === id)?.nom || id).join(', ')
                            : 'toute la carte'}
                          {' · appliquée auto en caisse'}
                        </Text>
                      )}
                      <Text style={styles.offreLigneSous} numberOfLines={1}>
                        {o.envoyee_le
                          ? `📲 poussée le ${String(o.envoyee_le).slice(8, 10)}/${String(o.envoyee_le).slice(5, 7)}${o.nb_push ? ` → ${o.nb_push} appareils` : ''}`
                          : '📭 jamais poussée en notification'}
                      </Text>
                    </View>
                    <Pressable onPress={() => basculerOffre(o)} style={{ padding: 6 }}>
                      <Text style={styles.offreAction}>{o.active ? 'Masquer' : 'Activer'}</Text>
                    </Pressable>
                    <Pressable onPress={() => supprimerOffre(o)} style={{ padding: 6 }}>
                      <Text style={{ fontSize: 15 }}>🗑️</Text>
                    </Pressable>
                  </View>
                ))}
              </Carte>

              {/* Message affiché EN GROS sur l'écran pickup de la caisse */}
              <Carte style={{ gap: 10 }}>
                <Text style={styles.adminTitre}>📢 Message à la caisse (pickup)</Text>
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
                  style={styles.adminMultiligne}
                  value={msgCaisseTexte}
                  onChangeText={setMsgCaisseTexte}
                  placeholder="Ex : Pensez à proposer la nouvelle saveur matcha fraise !"
                  placeholderTextColor={C.texte3}
                  multiline
                  maxLength={200}
                />
                {msgCaisseEtat && <Message texte={msgCaisseEtat} />}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <BoutonPrimaire
                    titre="Afficher à la caisse"
                    onPress={() => enregistrerMessageCaisse(false)}
                    disabled={!msgCaisseTexte.trim()}
                    style={{ flex: 1 }}
                  />
                  <BoutonGhost titre="Retirer" onPress={() => enregistrerMessageCaisse(true)} style={{ alignSelf: 'center' }} />
                </View>
              </Carte>
            </>
          )}
        </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // === Confirmation d'inscription (code reçu par email) ===
  if (mode === 'confirmation') {
    return (
      <View style={styles.fond}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.contenuAuth, { paddingTop: insets.top + 18 }]} keyboardShouldPersistTaps="handled">
            <Text style={styles.logoAuth}>BUBBLE STOP</Text>
            <Carte style={styles.carteAuth}>
              <Text style={styles.titreAuth}>Confirme ton compte</Text>
              <Text style={styles.aideAuth}>Entre le code reçu par email.</Text>
              <ChampTexte
                value={codeReset}
                onChangeText={setCodeReset}
                placeholder="Code reçu par email"
                keyboardType="number-pad"
                maxLength={10}
              />
              {message && <Message texte={message} />}
              <BoutonPrimaire titre="Confirmer mon compte" onPress={validerConfirmation} loading={enCours} />
              <BoutonGhost
                titre="Renvoyer le code"
                onPress={async () => {
                  await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() }).catch(() => {});
                  setMessage('Nouveau code envoyé !');
                }}
              />
              <BoutonGhost titre="‹ Retour à la connexion" onPress={() => { setMode('connexion'); setMessage(null); setCodeReset(''); setMdpReset2(''); }} />
            </Carte>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // === Mot de passe oublié ===
  if (mode === 'reset-email' || mode === 'reset-code') {
    return (
      <View style={styles.fond}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.contenuAuth, { paddingTop: insets.top + 18 }]} keyboardShouldPersistTaps="handled">
            <Text style={styles.logoAuth}>BUBBLE STOP</Text>
            <Carte style={styles.carteAuth}>
              <Text style={styles.titreAuth}>Mot de passe oublié</Text>

              {mode === 'reset-email' ? (
                <>
                  <Text style={styles.aideAuth}>On t'envoie un code par email pour choisir un nouveau mot de passe.</Text>
                  <ChampTexte
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {message && <Message texte={message} />}
                  <BoutonPrimaire titre="Envoyer le code" onPress={envoyerCode} loading={enCours} />
                </>
              ) : (
                <>
                  <Text style={styles.aideAuth}>Entre le code reçu par email et ton nouveau mot de passe.</Text>
                  <ChampTexte
                    value={codeReset}
                    onChangeText={setCodeReset}
                    placeholder="Code reçu par email"
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                  <ChampTexte
                    value={mdp}
                    onChangeText={setMdp}
                    placeholder="Nouveau mot de passe"
                    secureTextEntry
                  />
                  <ChampTexte
                    value={mdpReset2}
                    onChangeText={setMdpReset2}
                    placeholder="Confirme le nouveau mot de passe"
                    secureTextEntry
                  />
                  {message && <Message texte={message} />}
                  <BoutonPrimaire titre="Changer le mot de passe" onPress={validerNouveauMdp} loading={enCours} />
                </>
              )}

              <BoutonGhost titre="‹ Retour à la connexion" onPress={() => { setMode('connexion'); setMessage(null); setCodeReset(''); setMdpReset2(''); }} />
            </Carte>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // === Pas connecté : connexion / inscription ===
  return (
    <View style={styles.fond}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.contenuAuth, { paddingTop: insets.top + 18 }]} keyboardShouldPersistTaps="handled">
          <Text style={styles.logoAuth}>BUBBLE STOP</Text>

          <Carte style={styles.carteAuth}>
            {/* Bascule connexion / inscription */}
            <View style={styles.segments}>
              {(['connexion', 'inscription'] as const).map((m) => (
                <Pressable
                  key={m}
                  style={[styles.segment, mode === m && styles.segmentActif]}
                  onPress={() => { setMode(m); setMessage(null); }}>
                  <Text style={[styles.segmentTxt, mode === m && styles.segmentTxtActif]}>
                    {m === 'connexion' ? 'Connexion' : 'Inscription'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {mode === 'inscription' && (
              <>
                <ChampTexte value={nom} onChangeText={setNom} placeholder="Prénom" autoCapitalize="words" />
                <Text style={styles.aideChamp}>
                  📵 Aucun téléphone requis. Ta carte de fidélité est un QR — active-la dans l'onglet Fidélité.
                </Text>
                <ChampTexte
                  value={dateNaissance}
                  onChangeText={(v) => {
                    const ch = v.replace(/\D/g, '').slice(0, 8);
                    let aff = ch;
                    if (ch.length > 4) aff = `${ch.slice(0, 2)}/${ch.slice(2, 4)}/${ch.slice(4)}`;
                    else if (ch.length > 2) aff = `${ch.slice(0, 2)}/${ch.slice(2)}`;
                    setDateNaissance(aff);
                    if (ch.length === 8) Keyboard.dismiss(); // date complète → clavier rendu (cf. rejet 4.0)
                  }}
                  placeholder="Date de naissance (JJ/MM/AAAA)"
                  keyboardType="number-pad"
                  maxLength={10}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                <Text style={styles.reglesMdp}>🎂 Une grande boisson (taille L) offerte le jour de ton anniversaire. Non modifiable une fois enregistrée.</Text>
                <ChampTexte
                  value={codeParrain}
                  onChangeText={(v) => setCodeParrain(v.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Code parrain (optionnel)"
                  keyboardType="number-pad"
                  maxLength={10}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                <Text style={styles.aideChamp}>
                  🤝 Un ami t'a parrainé ? Entre son code (= son numéro de fidélité) : vous serez récompensés en tampons après ta première commande.
                </Text>
                {/* Boutique du client : choisie PAR LE CLIENT (modifiable ensuite dans Mes informations) */}
                <ChoixBoutique valeur={magasinInscription} onChange={setMagasinInscription} />
                <Text style={styles.aideChamp}>
                  📍 Ta boutique habituelle — pour tes offres et infos locales. Modifiable à tout
                  moment, et ta carte de fidélité marche dans TOUTES les boutiques Bubble Stop.
                </Text>
              </>
            )}
            <ChampTexte
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <ChampTexte
              value={mdp}
              onChangeText={setMdp}
              placeholder="Mot de passe"
              secureTextEntry
            />
            {mode === 'inscription' && <Text style={styles.reglesMdp}>{REGLES_MDP}</Text>}

            {message && <Message texte={message} />}

            <BoutonPrimaire
              titre={mode === 'connexion' ? 'Me connecter' : "M'inscrire"}
              onPress={valider}
              loading={enCours}
            />

            {/* Connexion via Apple — affichée en PREMIER sur iOS (HIG Apple + règle 4.8) */}
            {Platform.OS === 'ios' && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={12}
                style={{ height: 48, marginBottom: 4 }}
                onPress={loginApple}
              />
            )}

            {/* Connexion / inscription via Google (OAuth Supabase) */}
            <Pressable style={styles.btnGoogle} onPress={loginGoogle} disabled={enCours}>
              <GoogleLogo size={20} />
              <Text style={styles.btnGoogleTexte}>Continuer avec Google</Text>
            </Pressable>

            {mode === 'connexion' && (
              <BoutonGhost titre="Mot de passe oublié ?" onPress={() => { setMode('reset-email'); setMessage(null); }} />
            )}
          </Carte>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  centre: { alignItems: 'center', justifyContent: 'center' },
  contenu: { padding: 18, gap: 12, paddingBottom: 36 },
  titre: { fontFamily: F.titre, fontSize: 26, color: C.violet },

  // En-tête profil
  profil: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: C.violet,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontFamily: F.titre, fontSize: 22, color: '#fff' },
  profilNom: { fontFamily: F.t800, fontSize: 17, color: C.texte },
  profilEmail: { fontFamily: F.t400, fontSize: 13, color: C.texte2 },
  profilMagasin: { fontFamily: F.t700, fontSize: 12, color: C.violetClair, marginTop: 2 },

  // Sections dépliables
  depli: { gap: 12, paddingBottom: 16, paddingTop: 4 },
  aideChamp: { fontFamily: F.t400, fontSize: 12, color: C.texte3, lineHeight: 17 },
  ligneSwitch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  ligneSwitchTxt: { flex: 1, fontFamily: F.t600, fontSize: 14, color: C.texte },

  // Admin
  adminTitre: { fontFamily: F.titre, fontSize: 15.5, color: C.violet },
  cmdToggleSous: { fontFamily: F.t600, fontSize: 12.5, color: C.texte2, lineHeight: 17 },
  cmdMagLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  cmdMagNom: { fontFamily: F.t700, fontSize: 15, color: C.texte },
  // Presets d'offres (pictos SVG maison — charte)
  presetsAide: { fontFamily: F.t600, fontSize: 12.5, color: C.texte3, marginBottom: -2 },
  presetsRail: { gap: 9, paddingVertical: 2, paddingRight: 6 },
  preset: {
    width: 132, backgroundColor: C.fond, borderRadius: 16, padding: 11, gap: 5,
    borderWidth: 1.5, borderColor: C.bord,
  },
  presetActif: { backgroundColor: C.vertPale, borderColor: C.vert },
  presetNom: { fontFamily: F.t800, fontSize: 12.5, color: C.texte, marginTop: 2 },
  presetApercu: { fontFamily: F.t400, fontSize: 11, color: C.texte2, lineHeight: 14 },
  adminMultiligne: {
    backgroundColor: C.fond, borderRadius: 12, borderWidth: 1.5, borderColor: C.bord,
    padding: 14, minHeight: 76, fontFamily: F.t600, fontSize: 14.5, color: C.texte,
    textAlignVertical: 'top',
  },
  offreLigne: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.fond, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7,
  },
  offreStatut: { borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 3 },
  offreStatutTxt: { fontFamily: F.t800, fontSize: 9.5, letterSpacing: 0.4 },
  offreLigneTexte: { fontFamily: F.t700, fontSize: 13, color: C.texte },
  offreLigneSous: { fontFamily: F.t400, fontSize: 10.5, color: C.texte3, marginTop: 1 },
  offreAction: { fontFamily: F.t700, fontSize: 13, color: C.violetClair },
  // Programmation d'une offre (récurrence)
  progBloc: { backgroundColor: C.fond, borderRadius: 14, padding: 12, gap: 8 },
  progTitre: { fontFamily: F.t800, fontSize: 13, color: C.violetProfond },
  progAide: { fontFamily: F.t400, fontSize: 11.5, color: C.texte3, lineHeight: 16 },
  progJours: { flexDirection: 'row', gap: 6 },
  progJour: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10,
    backgroundColor: C.carte, borderWidth: 1.5, borderColor: C.bord,
  },
  progJourActif: { backgroundColor: C.violet, borderColor: C.violet },
  progJourTxt: { fontFamily: F.t800, fontSize: 12.5, color: C.texte2 },
  progJourTxtActif: { color: '#fff' },
  msgCaisseMags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  msgCaisseChip: { backgroundColor: C.lavande, borderRadius: R.pill, paddingVertical: 8, paddingHorizontal: 14 },
  msgCaisseChipActif: { backgroundColor: C.vert },
  msgCaisseChipTxt: { fontFamily: F.t700, fontSize: 13, color: C.texte2 },
  msgCaisseChipTxtActif: { color: C.violetProfond },

  // Écrans d'authentification
  contenuAuth: { flexGrow: 1, justifyContent: 'center', padding: 22, gap: 18, paddingBottom: 40 },
  logoAuth: { fontFamily: F.titre, fontSize: 28, color: C.violet, textAlign: 'center', letterSpacing: 0.5 },
  carteAuth: { gap: 13 },
  titreAuth: { fontFamily: F.t800, fontSize: 19, color: C.texte, textAlign: 'center' },
  aideAuth: { fontFamily: F.t400, fontSize: 14, color: C.texte2, textAlign: 'center', lineHeight: 20 },
  segments: { flexDirection: 'row', backgroundColor: C.fond, borderRadius: R.pill, padding: 4 },
  segment: { flex: 1, paddingVertical: 10, borderRadius: R.pill, alignItems: 'center' },
  segmentActif: { backgroundColor: C.violet },
  segmentTxt: { fontFamily: F.t700, fontSize: 14, color: C.texte2 },
  segmentTxtActif: { color: '#fff' },
  reglesMdp: { fontFamily: F.t400, fontSize: 12, color: C.texte3, textAlign: 'center' },
  btnGoogle: {
    backgroundColor: '#fff', borderRadius: R.btn + 2, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1.5, borderColor: C.bord,
  },
  btnGoogleTexte: { fontFamily: F.t700, fontSize: 15, color: C.texte },
});
