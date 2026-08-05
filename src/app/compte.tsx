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
import * as AppleAuthentication from 'expo-apple-authentication';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { connexionGoogleNative } from '@/lib/google-natif';
import { enregistrerPush } from '@/lib/push';
import { memoriserCodeParrain } from '@/lib/parrainage';
import {
  lireConfigCarteCadeau, ecrireConfigCarteCadeau,
  lireJeuFlags, ecrireJeuFlags, ConfigCarteCadeau, JeuFlags,
} from '@/lib/app-config';
import {
  ecrireFonctionnalite, EtatFonctionnalites, FonctionnaliteId,
  lireFonctionnalites, REGISTRE_FONCTIONNALITES,
} from '@/lib/fonctionnalites';
import { offreEnCours, offreProgrammee, resumeRecurrence } from '@/lib/offres';
import { useCatalogueCloud } from '@/data/catalogue-cloud';
import { GoogleLogo } from '@/components/google-logo';
import { LogoBubbleStop } from '@/components/logo-bubblestop';
import { AdminMiseAJour } from '@/components/admin-mise-a-jour';
import { MAGASINS, MagasinId } from '@/store/magasin';
import { C, F, R, OMBRE } from '@/constants/charte';
import {
  Carte, LigneMenu, ChampTexte, MascottePerle, Message, BoutonPrimaire, BoutonGhost, TitreKawaii, TitreSection,
} from '@/components/ui-kit';
import PictoOffre, { FOND_PICTO } from '@/components/pictos-offres';

const URL_CONFIDENTIALITE = 'https://commande.bubblestop.fr/confidentialite';
const URL_REGLEMENT_BOBA_QUEST = 'https://commande.bubblestop.fr/reglement-boba-quest';
const EMAIL_CONTACT = 'contact@bubblestop.fr';
type CibleMessageCaisse = MagasinId | 'toutes';

// === Presets d'offres (admin) : modèles prêts à publier ===
// Tap = pré-remplit titre + message (modifiables avant publication).
// `conseil` = note pour l'admin, jamais publiée.
const PRESETS_OFFRES = [
  {
    id: 'happy-hour', emoji: '⚡', nom: 'Happy hour',
    apercu: 'Remplir les heures creuses',
    titre: '⚡ Happy hour : -30 % de 15h à 17h',
    message: 'Aujourd\'hui seulement : -30 % sur toutes les boissons entre 15h et 17h. File en boutique !',
    conseil: 'Adapte l\'horaire à ton heure creuse. La caisse applique automatiquement la remise après le scan fidélité.',
    remiseType: 'pourcent' as const,
    remiseValeur: '30',
  },
  {
    id: 'install-appli', emoji: '📲', nom: 'Bonus install',
    apercu: 'Faire installer l\'appli (+1 tampon auto)',
    titre: '📲 Installe l\'appli = 1 tampon offert',
    message: 'Télécharge l\'appli Bubble Stop et lie ta carte de fidélité : 1 tampon de bienvenue offert automatiquement. Suis tes tampons et profite des offres !',
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
    conseil: 'Choisis ton jour le plus creux. Le multiplicateur est appliqué automatiquement après le scan fidélité.',
    remiseType: 'tampons' as const,
    remiseValeur: '2',
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
    message: 'Ton ami fait son 1er achat en boutique avec ton numéro de carte ? Vous gagnez chacun 1 tampon !',
    conseil: 'En caisse : ajouter le tampon manuellement chez le parrain ET le filleul.',
  },
  {
    id: 'story', emoji: '📸', nom: 'Story = topping',
    apercu: 'De la pub gratuite par tes clients',
    titre: '📸 Ta story = 1 topping offert',
    message: 'Poste ta boisson en story en nous identifiant, montre-la en caisse : topping offert sur ton prochain achat.',
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

function eurosPourSaisie(centimes: number): string {
  const euros = centimes / 100;
  return (Number.isInteger(euros) ? String(euros) : String(euros)).replace('.', ',');
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
  // Activé par défaut pour les nouveaux comptes : le prénom peut ainsi être
  // imprimé sur les tickets et les étiquettes sans réglage supplémentaire.
  const [prenomSurTicket, setPrenomSurTicket] = useState(true);
  const [infosOk, setInfosOk] = useState(false);
  const [estAdmin, setEstAdmin] = useState(false);
  // Section dépliée : profil ou sécurité du compte Supabase.
  const [edition, setEdition] = useState<null | 'profil' | 'email' | 'email-code' | 'mdp'>(null);
  const [nouvelEmail, setNouvelEmail] = useState('');
  const [codeEmail, setCodeEmail] = useState('');
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [nouveauMdp2, setNouveauMdp2] = useState('');
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [editionEnCours, setEditionEnCours] = useState(false);
  useEffect(() => {
    if (!session) { setEstAdmin(false); return; }
    enregistrerPush();
    supabase.from('profils').select('nom, numero_fidelite, est_admin, prenom_sur_ticket, date_naissance').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => {
        setPrenom(data?.nom ?? '');
        setTelFidelite(data?.numero_fidelite ?? '');
        // `false` explicite reste respecté pour un client qui a désactivé l'option.
        setPrenomSurTicket(data?.prenom_sur_ticket !== false);
        setEstAdmin(!!data?.est_admin);
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
  const [offreRemiseType, setOffreRemiseType] = useState<'' | 'pourcent' | 'montant' | 'tampons' | 'duo'>('');
  const [offreRemiseValeur, setOffreRemiseValeur] = useState('');
  const [offreCibleCats, setOffreCibleCats] = useState<string[]>([]);
  const { categories: catsCatalogue } = useCatalogueCloud(); // catégories du catalogue POS (fruit-tea…)
  const [offres, setOffres] = useState<any[]>([]);
  // Registre central : tous les modules optionnels actuels et futurs apparaissent
  // automatiquement dans le panneau « Fonctionnalités visibles ».
  const [fonctionnalites, setFonctionnalites] = useState<EtatFonctionnalites | null>(null);
  const [fonctionnaliteBusy, setFonctionnaliteBusy] = useState<FonctionnaliteId | null>(null);
  const [fonctionnaliteEtat, setFonctionnaliteEtat] = useState<string | null>(null);
  // 🕹️ Jeu Boba Quest : interrupteurs clients / admin (déclarés AVANT le useEffect qui les charge)
  const [jeuFlags, setJeuFlags] = useState<JeuFlags | null>(null);
  const [jeuBusy, setJeuBusy] = useState(false);
  // 💳 Paliers de bonus carte cadeau : configurables à distance par l'admin.
  // Les montants restent des chaînes en euros pendant la saisie, puis sont validés
  // et convertis en centimes uniquement au moment de l'enregistrement.
  const [carteCadeauConfig, setCarteCadeauConfig] = useState<ConfigCarteCadeau | null>(null);
  const [carteCadeauPaliers, setCarteCadeauPaliers] = useState<{ montant: string; bonus: string }[]>([]);
  const [carteCadeauBusy, setCarteCadeauBusy] = useState(false);
  const [carteCadeauEtat, setCarteCadeauEtat] = useState<string | null>(null);
  const [offreEtat, setOffreEtat] = useState<string | null>(null);
  // Preset sélectionné (pré-remplit les champs, modifiables ensuite)
  const [presetId, setPresetId] = useState<string | null>(null);
  const choisirPreset = (p: (typeof PRESETS_OFFRES)[number]) => {
    if (presetId === p.id) {
      setPresetId(null); setOffreTitre(''); setOffreMessage('');
      setOffreRemiseType(''); setOffreRemiseValeur(''); setOffreCibleCats([]);
      return;
    }
    setPresetId(p.id);
    setOffreTitre(p.titre);
    setOffreMessage(p.message);
    setOffreRemiseType(('remiseType' in p ? p.remiseType : '') as '' | 'pourcent' | 'montant' | 'tampons');
    setOffreRemiseValeur('remiseValeur' in p ? p.remiseValeur : '');
    setOffreCibleCats([]);
    setOffreEtat(null);
  };
  const presetActif = PRESETS_OFFRES.find((p) => p.id === presetId);
  const chargerOffres = async () => {
    const { data } = await supabase.from('offres').select('*').order('created_at', { ascending: false }).limit(10);
    setOffres(data ?? []);
  };
  const chargerConfigCarteCadeau = async () => {
    setCarteCadeauEtat(null);
    const config = await lireConfigCarteCadeau();
    if (!config) {
      setCarteCadeauEtat('Impossible de charger les paliers. Vérifie la connexion.');
      return;
    }
    setCarteCadeauConfig(config);
    setCarteCadeauPaliers(config.paliers.map((p) => ({
      montant: eurosPourSaisie(p.des_centimes),
      bonus: String(p.bonus_pct).replace('.', ','),
    })));
  };
  useEffect(() => {
    if (estAdmin) {
      chargerOffres();
      lireFonctionnalites().then(setFonctionnalites);
      lireJeuFlags().then(setJeuFlags);
      chargerConfigCarteCadeau();
    }
  }, [estAdmin]);

  const modifierPalierCarteCadeau = (index: number, cle: 'montant' | 'bonus', valeur: string) => {
    const nettoyee = valeur.replace(/[^0-9,.]/g, '').replace('.', ',');
    setCarteCadeauPaliers((courants) => courants.map((p, i) => (
      i === index ? { ...p, [cle]: nettoyee } : p
    )));
    setCarteCadeauEtat(null);
  };

  const ajouterPalierCarteCadeau = () => {
    if (carteCadeauPaliers.length >= 8) {
      setCarteCadeauEtat('Maximum 8 paliers pour garder une offre lisible.');
      return;
    }
    const dernier = carteCadeauPaliers
      .map((p) => Number(p.montant.replace(',', '.')) || 0)
      .sort((a, b) => b - a)[0] || 0;
    setCarteCadeauPaliers((p) => [...p, {
      montant: String(dernier > 0 ? dernier + 25 : 25).replace('.', ','),
      bonus: '',
    }]);
    setCarteCadeauEtat(null);
  };

  const enregistrerPaliersCarteCadeau = async () => {
    Keyboard.dismiss();
    if (!carteCadeauConfig) {
      setCarteCadeauEtat('Configuration indisponible. Recharge la page avant d’enregistrer.');
      return;
    }
    const paliers = carteCadeauPaliers.map((p) => ({
      des_centimes: Math.round(Number(p.montant.replace(',', '.')) * 100),
      bonus_pct: Number(p.bonus.replace(',', '.')),
    }));
    if (paliers.some((p) => !Number.isFinite(p.des_centimes) || p.des_centimes < carteCadeauConfig.min_centimes)) {
      setCarteCadeauEtat(`Chaque palier doit commencer à partir de ${(carteCadeauConfig.min_centimes / 100).toFixed(2).replace('.', ',')} €.`);
      return;
    }
    if (paliers.some((p) => !Number.isFinite(p.bonus_pct) || p.bonus_pct <= 0 || p.bonus_pct > 100)) {
      setCarteCadeauEtat('Chaque bonus doit être compris entre 0,1 % et 100 %.');
      return;
    }
    const tries = [...paliers].sort((a, b) => a.des_centimes - b.des_centimes);
    if (tries.some((p, i) => i > 0 && p.des_centimes === tries[i - 1].des_centimes)) {
      setCarteCadeauEtat('Deux paliers ne peuvent pas commencer au même montant.');
      return;
    }
    if (tries.some((p, i) => i > 0 && p.bonus_pct <= tries[i - 1].bonus_pct)) {
      setCarteCadeauEtat('Le pourcentage doit augmenter avec le montant de recharge.');
      return;
    }
    setCarteCadeauBusy(true);
    setCarteCadeauEtat('Enregistrement…');
    const ok = await ecrireConfigCarteCadeau({ ...carteCadeauConfig, paliers: tries });
    if (ok) {
      setCarteCadeauConfig({ ...carteCadeauConfig, paliers: tries });
      setCarteCadeauPaliers(tries.map((p) => ({
        montant: eurosPourSaisie(p.des_centimes),
        bonus: String(p.bonus_pct).replace('.', ','),
      })));
      setCarteCadeauEtat('✓ Paliers enregistrés. Ils s’appliqueront aux prochaines recharges.');
    } else {
      setCarteCadeauEtat('Échec de l’enregistrement. Aucun palier n’a été modifié.');
    }
    setCarteCadeauBusy(false);
  };

  // 🕹️ Visibilité admin / accès individuels. Le flag « tous les clients » reste
  // piloté par le registre central.
  const toggleJeu = async (cle: keyof JeuFlags) => {
    if (jeuFlags === null || jeuBusy) return;
    const nouveau = { ...jeuFlags, [cle]: !jeuFlags[cle] };
    setJeuBusy(true);
    setJeuFlags(nouveau); // optimiste
    const ok = await ecrireJeuFlags({ [cle]: nouveau[cle] });
    if (!ok) setJeuFlags(jeuFlags); // rollback si échec
    setJeuBusy(false);
  };

  const basculerFonctionnalite = async (id: FonctionnaliteId, actif: boolean) => {
    if (!fonctionnalites || fonctionnaliteBusy) return;
    if ((id === 'jeu' && jeuBusy) || (id === 'carte_cadeau' && carteCadeauBusy)) return;
    const precedent = fonctionnalites;
    const suivant = { ...precedent, [id]: actif };
    setFonctionnalites(suivant);
    setFonctionnaliteBusy(id);
    if (id === 'jeu') setJeuBusy(true);
    if (id === 'carte_cadeau') setCarteCadeauBusy(true);
    setFonctionnaliteEtat(actif ? 'Activation…' : 'Masquage…');
    const ok = await ecrireFonctionnalite(id, actif);
    if (ok) {
      // Les panneaux détaillés reflètent immédiatement la même source de vérité.
      if (id === 'jeu') setJeuFlags((courant) => courant ? { ...courant, actif } : courant);
      if (id === 'carte_cadeau') {
        setCarteCadeauConfig((courant) => courant ? { ...courant, actif } : courant);
      }
      setFonctionnaliteEtat(actif
        ? '✓ Fonction visible. Les clients la verront au prochain écran ou sous 30 secondes.'
        : '✓ Fonction masquée. Les données existantes restent conservées.');
    } else {
      setFonctionnalites(precedent);
      setFonctionnaliteEtat('Échec de l’enregistrement. La visibilité n’a pas changé.');
    }
    setFonctionnaliteBusy(null);
    if (id === 'jeu') setJeuBusy(false);
    if (id === 'carte_cadeau') setCarteCadeauBusy(false);
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
    if (offreRemiseType && offreRemiseType !== 'duo') {
      remiseValeur = Number(String(offreRemiseValeur).trim().replace(',', '.'));
      if (!(remiseValeur > 0)) { setOffreEtat('Valeur de remise invalide (ex : 30 ou 1,50).'); return; }
      if (offreRemiseType === 'pourcent' && remiseValeur > 100) { setOffreEtat('Un pourcentage ne peut pas dépasser 100.'); return; }
      if (offreRemiseType === 'tampons') {
        remiseValeur = Math.round(remiseValeur);
        if (remiseValeur < 2 || remiseValeur > 5) { setOffreEtat('Tampons : multiplicateur entre 2 et 5 (ex : 2 = tampons ×2).'); return; }
      }
    }
    // 👯 Duo (04/08) : le taux est porté par la caisse (−50 % sur la moins chère, dès
    // 2 boissons, une fois par ticket) — AUCUNE valeur à saisir. Cible par défaut :
    // toutes les catégories BOISSONS du catalogue. Jamais les mochis : un mochi ne
    // doit ni compter comme « 2ᵉ boisson » ni devenir la « moins chère » à −50 %.
    const NON_BOISSONS = ['mochi-glace'];
    let cibleFinale = offreCibleCats;
    if (offreRemiseType === 'duo' && cibleFinale.length === 0) {
      cibleFinale = (catsCatalogue as any[]).filter((c) => !NON_BOISSONS.includes(c.id)).map((c) => c.id);
      if (cibleFinale.length === 0) {
        // Catalogue cloud pas encore chargé : publier un duo « toute la carte »
        // ferait entrer les mochis dans le décompte — on refuse plutôt que deviner.
        setOffreEtat('Catalogue pas encore chargé — réessaie dans quelques secondes.');
        return;
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
          cible_categories: offreRemiseType && offreRemiseType !== 'tampons' && cibleFinale.length ? cibleFinale : null,
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

  // === Admin : message prioritaire affiché au premier plan sur la caisse ===
  const [msgCaisseMag, setMsgCaisseMag] = useState<CibleMessageCaisse>('toutes');
  const [msgCaisseTexte, setMsgCaisseTexte] = useState('');
  const [msgCaisseEtat, setMsgCaisseEtat] = useState<string | null>(null);
  const [msgCaisseBusy, setMsgCaisseBusy] = useState(false);
  const chargerMessageCaisse = async (mag: CibleMessageCaisse) => {
    if (mag === 'toutes') {
      // Le mode diffusion est volontairement un nouveau message : ne pas préremplir
      // avec le texte d'une boutique et risquer d'écraser les deux autres par mégarde.
      setMsgCaisseTexte('');
      return;
    }
    const { data } = await supabase.from('messages_caisse').select('message, actif').eq('magasin', mag).maybeSingle();
    setMsgCaisseTexte(data?.actif ? (data?.message ?? '') : '');
  };
  useEffect(() => { if (estAdmin) chargerMessageCaisse(msgCaisseMag); }, [estAdmin, msgCaisseMag]);
  const enregistrerMessageCaisse = async (effacer: boolean) => {
    const texte = msgCaisseTexte.trim();
    if (!effacer && !texte) return;
    const cibles = msgCaisseMag === 'toutes' ? MAGASINS.map((m) => m.id) : [msgCaisseMag];
    const updatedAt = new Date().toISOString();
    setMsgCaisseBusy(true);
    setMsgCaisseEtat(effacer ? 'Effacement…' : 'Envoi…');
    try {
      const { error } = await supabase.from('messages_caisse').upsert(
        cibles.map((magasin) => ({
          magasin,
          message: effacer ? null : texte,
          actif: !effacer,
          updated_at: updatedAt,
        })),
        { onConflict: 'magasin' },
      );
      if (error) { setMsgCaisseEtat(String(error.message)); return; }
      if (effacer || msgCaisseMag === 'toutes') setMsgCaisseTexte('');
      const cible = msgCaisseMag === 'toutes' ? 'les 3 caisses' : (MAGASINS.find((m) => m.id === msgCaisseMag)?.nom ?? 'la caisse');
      setMsgCaisseEtat(effacer ? `✅ Message retiré sur ${cible}` : `✅ Message envoyé au premier plan sur ${cible}`);
      setTimeout(() => setMsgCaisseEtat(null), 3500);
    } catch (e: any) {
      setMsgCaisseEtat(String(e?.message ?? e));
    } finally {
      setMsgCaisseBusy(false);
    }
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
    // Date de naissance : enregistrée UNE seule fois, ensuite non modifiable
    if (!naissanceVerrou) maj.date_naissance = naissanceIso;

    const appliquer = async () => {
      const { error: errMaj } = await supabase.from('profils').upsert(maj);
      if (errMaj) {
        setInfoMsg(`Erreur : ${errMaj.message}`);
        return;
      }
      if (!naissanceVerrou && naissanceIso) setNaissanceVerrou(true); // verrouille après 1er enregistrement
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

  // === Connexion / inscription via Google ===
  // Web/PWA : redirection de la page puis retour (session lue dans l'URL).
  // Natif : une seule feuille Google native, puis échange direct du jeton avec Supabase.
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
      const resultatNatif = await connexionGoogleNative();
      if (resultatNatif.ok || resultatNatif.annule) return;
      throw new Error(resultatNatif.message);
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
      const parrain = codeParrain.replace(/\D/g, '');
      if (parrain && parrain.length !== 8) {
        setMessage('Le numéro fidélité de ton parrain doit contenir exactement 8 chiffres. Laisse le champ vide si tu n’en as pas.');
        return;
      }
    }
    setEnCours(true);
    try {
      if (mode === 'inscription') {
        // Code parrain (optionnel) : mémorisé AVANT la création du compte — il sera
        // appliqué tout seul à la 1ère session (best effort, jamais bloquant).
        if (codeParrain.replace(/\D/g, '').length === 8) {
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
            prenom_sur_ticket: true,
          });
          if (errProfil) throw errProfil;
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
          prenom_sur_ticket: true,
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
      'Ton compte et les données personnelles qui lui sont directement rattachées seront supprimés. Les justificatifs soumis à une obligation légale peuvent être conservés sans accès au compte.',
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
    return (
      <View style={styles.fond}>
        {/* KAV indispensable (rejet App Store 4.0 iPad) : les champs de codes n'ont
            pas toujours de touche retour et peuvent masquer leurs boutons. */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.contenu, { paddingTop: insets.top + 18 }]}
          keyboardShouldPersistTaps="handled">
          <TitreKawaii texte="Mon compte" taille={26} />

          {/* === En-tête profil === */}
          <Carte style={styles.profil}>
            <MascottePerle taille={52} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.profilNom}>{prenom || 'Mon profil'}</Text>
              <Text style={styles.profilEmail} numberOfLines={1}>{session.user.email}</Text>
            </View>
          </Carte>

          {/* === Mon profil (infos + prénom ticket) === */}
          <TitreSection texte="Mon profil" />
          <Carte style={{ paddingVertical: 4 }}>
            <LigneMenu
              titre="Mes informations"
              sousTitre="Prénom, numéro de carte, tickets et étiquettes"
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
                  <Text style={styles.ligneSwitchTxt}>Afficher mon prénom sur mes tickets et étiquettes</Text>
                  <Switch
                    value={prenomSurTicket}
                    onValueChange={setPrenomSurTicket}
                    trackColor={{ false: C.bord, true: C.vert }}
                    thumbColor="#fff"
                  />
                </View>
                <BoutonPrimaire titre={infosOk ? '✓ Enregistré' : 'Enregistrer'} onPress={enregistrerInfos} />
              </View>
            )}
            <LigneMenu
              titre="Ma carte de fidélité"
              sousTitre="QR, tampons et boissons offertes"
              onPress={() => router.push('/explore' as any)}
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
              titre="Règlement Boba Quest"
              sousTitre="Jeu, récompenses et validation en boutique"
              onPress={() => Linking.openURL(URL_REGLEMENT_BOBA_QUEST)}
            />
            <LigneMenu
              titre="Politique de confidentialité"
              onPress={() => Linking.openURL(URL_CONFIDENTIALITE)}
              separateur={false}
            />
          </Carte>

          <BoutonGhost titre="Se déconnecter" onPress={deconnexion} />

          {/* === Section ADMIN === */}
          {estAdmin && (
            <>
              <TitreSection texte="🛠️ Admin" />

              {/* Registre central : ce bloc se complète automatiquement lorsqu'une future
                  fonctionnalité optionnelle est déclarée dans lib/fonctionnalites.ts. */}
              <Carte style={{ gap: 11 }}>
                <Text style={styles.adminTitre}>👁️ Fonctionnalités visibles</Text>
                <Text style={styles.cmdToggleSous}>
                  Ces réglages agissent à distance, sans nouvelle version sur les stores.
                  Fidélité, parrainage, accueil et compte restent toujours accessibles.
                </Text>
                {fonctionnalites ? REGISTRE_FONCTIONNALITES.map((fonctionnalite) => (
                  <View key={fonctionnalite.id} style={styles.fonctionnaliteLigne}>
                    <View style={{ flex: 1, paddingRight: 12, gap: 2 }}>
                      <Text style={styles.cmdMagNom}>{fonctionnalite.titre}</Text>
                      <Text style={styles.cmdToggleSous}>{fonctionnalite.description}</Text>
                    </View>
                    <Switch
                      value={fonctionnalites[fonctionnalite.id]}
                      onValueChange={(valeur) => basculerFonctionnalite(fonctionnalite.id, valeur)}
                      disabled={fonctionnaliteBusy !== null
                        || (fonctionnalite.id === 'jeu' && jeuBusy)
                        || (fonctionnalite.id === 'carte_cadeau' && carteCadeauBusy)}
                      trackColor={{ true: C.vert, false: '#C9C2D6' }}
                      thumbColor="#fff"
                    />
                  </View>
                )) : (
                  <ActivityIndicator color={C.violet} />
                )}
                {fonctionnaliteEtat && (
                  <Message
                    texte={fonctionnaliteEtat}
                    type={fonctionnaliteEtat.startsWith('✓') ? 'ok' : fonctionnaliteEtat.startsWith('Échec') ? 'erreur' : 'info'}
                  />
                )}
                <Text style={styles.carteCadeauDirect}>
                  Toute future fonction optionnelle devra être inscrite dans ce registre avant publication.
                </Text>
              </Carte>

              <AdminMiseAJour />

              {/* 🕹️ Le toggle « tous les clients » est dans le registre. Ici, on garde
                  l'accès admin et le coupe-circuit des autorisations individuelles. */}
              <Carte style={{ gap: 10 }}>
                <Text style={styles.adminTitre}>🕹️ Boba Quest · accès avancés</Text>
                <Text style={styles.cmdToggleSous}>
                  Les accès individuels sont accordés membre par membre depuis l’app stock.
                  Couper ce réglage les suspend tous sans effacer leur progression.
                </Text>
                <View style={styles.fonctionnaliteLigne}>
                  <Text style={[styles.cmdMagNom, { flex: 1 }]}>Accès individuels actifs</Text>
                  <Switch
                    value={!!jeuFlags?.selectionActive}
                    onValueChange={() => toggleJeu('selectionActive')}
                    disabled={jeuFlags === null || jeuBusy}
                    trackColor={{ true: C.vert, false: '#C9C2D6' }}
                    thumbColor="#fff"
                  />
                </View>
                <View style={styles.fonctionnaliteLigne}>
                  <Text style={[styles.cmdMagNom, { flex: 1 }]}>Visible pour l’admin</Text>
                  <Switch
                    value={!!jeuFlags?.adminVisible}
                    onValueChange={() => toggleJeu('adminVisible')}
                    disabled={jeuFlags === null || jeuBusy}
                    trackColor={{ true: C.vert, false: '#C9C2D6' }}
                    thumbColor="#fff"
                  />
                </View>
              </Carte>

              {/* 💳 Bonus de recharge : configuration LIVE lue par solde-api. */}
              <Carte style={{ gap: 12 }}>
                <Text style={styles.adminTitre}>💳 Carte cadeau · bonus de recharge</Text>
                <Text style={styles.cmdToggleSous}>
                  Choisis le montant de chaque palier et le pourcentage offert. Le solde payé
                  et son bonus sont crédités sur le même compte fidélité. Modifier ces valeurs
                  ne change jamais les soldes déjà acquis.
                </Text>
                {carteCadeauConfig ? (
                  <>
                    <Text style={styles.carteCadeauDirect}>
                      Visibilité pilotée dans « Fonctionnalités visibles » ci-dessus.
                    </Text>
                    <View style={styles.carteCadeauMinimum}>
                      <Text style={styles.carteCadeauMinimumLabel}>Recharge minimum</Text>
                      <Text style={styles.carteCadeauMinimumValeur}>
                        {(carteCadeauConfig.min_centimes / 100).toFixed(2).replace('.', ',')} €
                      </Text>
                    </View>
                    {carteCadeauPaliers.length === 0 && (
                      <Message texte="Aucun bonus configuré : les recharges créditeront uniquement le montant payé." />
                    )}
                    {carteCadeauPaliers.map((palier, index) => (
                      <View key={index} style={styles.carteCadeauPalier}>
                        <View style={{ flex: 1 }}>
                          <ChampTexte
                            label={`Palier ${index + 1} · dès (€)`}
                            value={palier.montant}
                            onChangeText={(v) => modifierPalierCarteCadeau(index, 'montant', v)}
                            placeholder="25"
                            keyboardType="decimal-pad"
                            returnKeyType="done"
                            onSubmitEditing={Keyboard.dismiss}
                            maxLength={8}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ChampTexte
                            label="Bonus offert (%)"
                            value={palier.bonus}
                            onChangeText={(v) => modifierPalierCarteCadeau(index, 'bonus', v)}
                            placeholder="10"
                            keyboardType="decimal-pad"
                            returnKeyType="done"
                            onSubmitEditing={Keyboard.dismiss}
                            maxLength={6}
                          />
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Supprimer le palier ${index + 1}`}
                          hitSlop={8}
                          style={styles.carteCadeauSupprimer}
                          onPress={() => {
                            setCarteCadeauPaliers((p) => p.filter((_, i) => i !== index));
                            setCarteCadeauEtat(null);
                          }}>
                          <Text style={styles.carteCadeauSupprimerTexte}>×</Text>
                        </Pressable>
                      </View>
                    ))}
                    <BoutonGhost titre="+ Ajouter un palier" onPress={ajouterPalierCarteCadeau} />
                    <Text style={styles.carteCadeauAide}>
                      Exemple : 25 € + 10 % = 27,50 € crédités. Le bonus doit progresser avec
                      les montants. Le meilleur palier atteint est appliqué une seule fois.
                    </Text>
                    {carteCadeauEtat && (
                      <Message
                        texte={carteCadeauEtat}
                        type={carteCadeauEtat.startsWith('✓') ? 'ok' : carteCadeauEtat.startsWith('Échec') || carteCadeauEtat.startsWith('Impossible') ? 'erreur' : 'info'}
                      />
                    )}
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <BoutonPrimaire
                        titre="Enregistrer les paliers"
                        onPress={enregistrerPaliersCarteCadeau}
                        loading={carteCadeauBusy}
                        style={{ flex: 1 }}
                      />
                      <BoutonGhost titre="Fermer le clavier" onPress={Keyboard.dismiss} />
                    </View>
                    <Text style={styles.carteCadeauDirect}>
                      ⚡ Réglage immédiat : les prochaines recharges utilisent ces valeurs sans mise à jour de l’app.
                    </Text>
                  </>
                ) : (
                  <View style={{ gap: 8 }}>
                    <ActivityIndicator color={C.violet} />
                    {carteCadeauEtat && <Message texte={carteCadeauEtat} type="erreur" />}
                    <BoutonGhost titre="Réessayer" onPress={chargerConfigCarteCadeau} />
                  </View>
                )}
              </Carte>

              {/* Offres / annonces */}
              <Carte style={{ gap: 10 }}>
                <Text style={styles.adminTitre}>Offres & annonces</Text>
                <Text style={styles.cmdToggleSous}>
                  Publiée = visible sur l'accueil · « + push » = notification à tous · tout avantage automatique exige un scan fidélité.
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
                  <Text style={styles.progTitre}>🎟️ Avantage fidélité automatique en caisse (optionnel)</Text>
                  <Text style={styles.progAide}>
                    La caisse applique l'avantage TOUTE SEULE pendant la fenêtre, mais uniquement
                    après le scan du QR fidélité (caisse + borne, ligne dédiée sur le ticket).
                    Sans scan : aucun avantage. Sans réglage : annonce purement informative.
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {([['', 'Aucune'], ['pourcent', '− %'], ['montant', '− € / boisson'], ['duo', '👯 Duo −50 %'], ['tampons', '🎟️ Tampons ×N']] as ['' | 'pourcent' | 'montant' | 'tampons' | 'duo', string][]).map(([t, nom]) => (
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
                      🎟️ Après le scan fidélité, chaque boisson payée crédite N tampons
                      (borne + caisse, automatique).
                      Le bonus se cumule sur la carte pour la prochaine visite — les boissons
                      offertes n'en gagnent pas.
                    </Text>
                  )}
                  {offreRemiseType === 'duo' && (
                    <Text style={styles.progAide}>
                      👯 Dès 2 boissons sur le ticket, la moins chère passe à −50 % — une
                      seule fois par passage, après scan du QR fidélité. Rien à régler : le
                      taux est fixe. Sans catégorie cochée, toutes les boissons comptent
                      (jamais les mochis).
                    </Text>
                  )}
                  {offreRemiseType !== '' && (
                    <>
                      {offreRemiseType !== 'duo' && (
                        <ChampTexte
                          value={offreRemiseValeur}
                          onChangeText={setOffreRemiseValeur}
                          placeholder={offreRemiseType === 'pourcent' ? 'Ex : 30 (= −30 %)' : offreRemiseType === 'tampons' ? 'Ex : 2 (= tampons ×2)' : 'Ex : 1,50 (= −1,50 € par boisson)'}
                          keyboardType={offreRemiseType === 'tampons' ? 'number-pad' : 'decimal-pad'}
                          maxLength={6}
                        />
                      )}
                      {offreRemiseType !== 'tampons' && (
                        <>
                          <Text style={styles.progAide}>
                            {offreRemiseType === 'duo'
                              ? 'Catégories concernées (rien de coché = toutes les boissons, mochis exclus) :'
                              : 'Catégories concernées (rien de coché = toute la carte) :'}
                          </Text>
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
                          🎟️ Tampons ×{Math.round(Number(o.remise_valeur))} sur tout le ticket · scan fidélité requis
                        </Text>
                      )}
                      {o.remise_type === 'duo' && (
                        <Text style={styles.offreLigneSous} numberOfLines={1}>
                          👯 Duo : −50 % sur la 2ᵉ boisson (la moins chère) · une fois par ticket · scan fidélité requis
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
                          {' · appliquée auto après scan fidélité'}
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

              {/* Message prioritaire affiché au premier plan sur les caisses */}
              <Carte style={{ gap: 10 }}>
                <Text style={styles.adminTitre}>📢 Message prioritaire aux caisses</Text>
                <Text style={styles.cmdToggleSous}>
                  Une fenêtre passe au premier plan sous quelques secondes. Le caissier touche « OK, fermer » pour reprendre la caisse ; modifier ou renvoyer le message la fera réapparaître.
                </Text>
                <View style={styles.msgCaisseMags}>
                  {([{ id: 'toutes', nom: 'Toutes les caisses' }, ...MAGASINS] as { id: CibleMessageCaisse; nom: string }[]).map((m) => (
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
                  maxLength={500}
                />
                {msgCaisseEtat && <Message texte={msgCaisseEtat} />}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <BoutonPrimaire
                    titre={msgCaisseMag === 'toutes' ? 'Afficher sur les 3 caisses' : 'Afficher sur cette caisse'}
                    onPress={() => enregistrerMessageCaisse(false)}
                    disabled={!msgCaisseTexte.trim() || msgCaisseBusy}
                    loading={msgCaisseBusy}
                    style={{ flex: 1 }}
                  />
                  <BoutonGhost titre="Retirer" onPress={() => enregistrerMessageCaisse(true)} style={{ alignSelf: 'center' }} />
                </View>
              </Carte>
            </>
          )}

          {/* La suppression reste disponible (RGPD / stores), mais volontairement
              isolée de la déconnexion pour éviter tout appui accidentel. */}
          <View style={styles.zoneSensible}>
            <TitreSection texte="Zone sensible" />
            <Carte style={{ paddingVertical: 4 }}>
              <LigneMenu
                titre="Supprimer définitivement mon compte"
                sousTitre="Action irréversible, avec une confirmation supplémentaire"
                onPress={supprimerCompte}
                danger
                separateur={false}
              />
            </Carte>
          </View>
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
            <View
              style={styles.logoAuth}
              accessible
              accessibilityRole="image"
              accessibilityLabel="Logo Bubble Stop">
              <LogoBubbleStop largeur={205} />
            </View>
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
            <View
              style={styles.logoAuth}
              accessible
              accessibilityRole="image"
              accessibilityLabel="Logo Bubble Stop">
              <LogoBubbleStop largeur={205} />
            </View>
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
          <View
            style={styles.logoAuth}
            accessible
            accessibilityRole="image"
            accessibilityLabel="Logo Bubble Stop">
            <LogoBubbleStop largeur={205} />
          </View>

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
                  label="Numéro fidélité de ton parrain (optionnel)"
                  value={codeParrain}
                  onChangeText={(v) => {
                    const code = v.replace(/\D/g, '').slice(0, 8);
                    setCodeParrain(code);
                    if (code.length === 8) Keyboard.dismiss();
                  }}
                  placeholder="8 chiffres, ex. 12345678"
                  keyboardType="number-pad"
                  maxLength={8}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                <Text style={styles.aideChamp}>
                  🤝 Demande à ton parrain le numéro à 8 chiffres affiché sous son QR dans Fidélité → Parrainage. C'est son code parrain — n'entre pas ton propre numéro. Les bonus arrivent après ton premier achat en boutique.
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

  // Sections dépliables
  depli: { gap: 12, paddingBottom: 16, paddingTop: 4 },
  aideChamp: { fontFamily: F.t400, fontSize: 12, color: C.texte3, lineHeight: 17 },
  ligneSwitch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  ligneSwitchTxt: { flex: 1, fontFamily: F.t600, fontSize: 14, color: C.texte },
  zoneSensible: { marginTop: 28, gap: 12 },

  // Admin
  adminTitre: { fontFamily: F.titre, fontSize: 15.5, color: C.violet },
  cmdToggleSous: { fontFamily: F.t600, fontSize: 12.5, color: C.texte2, lineHeight: 17 },
  cmdMagLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  cmdMagNom: { fontFamily: F.t700, fontSize: 15, color: C.texte },
  fonctionnaliteLigne: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.bord,
  },
  carteCadeauMinimum: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.vertPale, borderRadius: 13, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: C.vert,
  },
  carteCadeauMinimumLabel: { fontFamily: F.t700, fontSize: 13, color: C.violetProfond },
  carteCadeauMinimumValeur: { fontFamily: F.titre, fontSize: 15, color: C.violet },
  carteCadeauPalier: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    backgroundColor: C.fond, borderRadius: 14, padding: 10,
  },
  carteCadeauSupprimer: {
    width: 32, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.dangerPale,
  },
  carteCadeauSupprimerTexte: { fontFamily: F.t800, fontSize: 21, color: C.danger, lineHeight: 23 },
  carteCadeauAide: { fontFamily: F.t400, fontSize: 11.5, color: C.texte3, lineHeight: 16 },
  carteCadeauDirect: { fontFamily: F.t600, fontSize: 11.5, color: C.vertFonce, lineHeight: 16, textAlign: 'center' },
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
  logoAuth: { alignItems: 'center', justifyContent: 'center' },
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
