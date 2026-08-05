// Pile de navigation de Boba Quest : hub → shooter / capsules / collection / roulette / boutique
// 🕹️ GARDE : le jeu n'est accessible que si le flag serveur `app_config.jeu.actif` est vrai
// (ou pour un admin, qui le voit toujours pour tester). Flag coupé → retour accueil.
// L'état du joueur (perles, collection…) n'est pas touché : caché ≠ effacé.
import { useEffect, useState } from 'react';
import { Redirect, Stack } from 'expo-router';
import {
  ActivityIndicator, AppState, Pressable, StyleSheet, Text, View,
} from 'react-native';

import { C, F, R } from '@/constants/charte';
import { trouverCollectible } from '@/components/jeu/economie';
import { useJeuVisible } from '@/lib/app-config';
import { surveillerAppState, synchroniser } from '@/lib/sauvegarde-jeu';
import {
  synchroniserAchatsJeu, type ResultatSynchronisationAchats,
} from '@/lib/synchronisation-achats-jeu';
import { hapticSucces } from '@/lib/juice';
import { useHydratationBobaQuest } from '@/store/jeu';

const POLL_ACHATS_MS = 15_000;

export default function JeuLayout() {
  const { visible, charge } = useJeuVisible();
  const hydratation = useHydratationBobaQuest();

  // 💾 SAUVEGARDE SERVEUR — la progression suit le compte, plus le téléphone.
  // On synchronise AVANT de laisser jouer : sinon un joueur qui vient de réinstaller
  // jouerait sur un état VIDE, puis sa partie fraîche (révision plus haute) écraserait
  // six semaines de progression au moment de pousser. Le premier tour est donc bloquant.
  //
  // ⚠️ CES HOOKS SONT AVANT TOUT `return` ANTICIPÉ, ET DOIVENT LE RESTER : les appeler
  // après le `if (!visible)` ou le `if (hydratation === 'chargement')` violerait les
  // règles des hooks (ordre d'appel variable d'un rendu à l'autre).
  const [syncFaite, setSyncFaite] = useState(false);
  useEffect(() => {
    if (hydratation === 'chargement') return;   // on attend l'état local d'abord
    let vivant = true;
    // Filet : une sauvegarde ne doit JAMAIS empêcher de jouer. Réseau lent, session
    // expirée, table pas encore migrée → on laisse entrer au bout de 4 s.
    const secours = setTimeout(() => { if (vivant) setSyncFaite(true); }, 4000);
    void synchroniser().finally(() => {
      if (!vivant) return;
      clearTimeout(secours);
      setSyncFaite(true);
    });
    return () => { vivant = false; clearTimeout(secours); };
  }, [hydratation]);

  // sauvegarde immédiate au passage en arrière-plan : c'est là qu'on risque de perdre l'app
  useEffect(() => surveillerAppState(), []);

  // 🧋 ACHATS BOUTIQUE — après la sauvegarde initiale seulement : appliquer une ligne
  // d'achat avant l'adoption éventuelle du serveur créerait une fausse concurrence de
  // révisions. Contrôle immédiat, toutes les 15 s tant que le jeu est ouvert, et au
  // retour au premier plan. Aucun échec réseau ne retire une progression acquise.
  const [achatPrisEnCompte, setAchatPrisEnCompte] = useState<ResultatSynchronisationAchats | null>(null);
  useEffect(() => {
    if (!syncFaite || hydratation === 'chargement' || hydratation === 'erreur' || !visible) return;
    let vivant = true;
    const rafraichir = async () => {
      try {
        const resultat = await synchroniserAchatsJeu();
        if (!vivant || resultat.nouvellesLignes <= 0) return;
        setAchatPrisEnCompte(resultat);
        hapticSucces();
      } catch { /* hors ligne : prochain poll / retour au premier plan */ }
    };
    void rafraichir();
    const intervalle = setInterval(() => { void rafraichir(); }, POLL_ACHATS_MS);
    const cycle = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') void rafraichir();
    });
    return () => {
      vivant = false;
      clearInterval(intervalle);
      cycle.remove();
    };
  }, [syncFaite, hydratation, visible]);

  useEffect(() => {
    if (!achatPrisEnCompte) return;
    const timer = setTimeout(() => setAchatPrisEnCompte(null), 9_000);
    return () => clearTimeout(timer);
  }, [achatPrisEnCompte]);

  // fail-closed : rien tant qu'on ne sait pas (cache/serveur), redirect si caché
  if (!visible) return charge ? <Redirect href={'/' as any} /> : null;
  if (hydratation === 'chargement') {
    return (
      <View style={styles.etat}>
        <ActivityIndicator color={C.violet} size="large" />
        <Text style={styles.titre}>Chargement de ta progression…</Text>
      </View>
    );
  }
  if (hydratation === 'erreur') {
    return (
      <View style={styles.etat}>
        <View style={styles.carteErreur}>
          <Text style={styles.titre}>Ta progression est protégée</Text>
          <Text style={styles.texte}>
            La sauvegarde locale ne peut pas être lue pour le moment. Ferme puis relance
            l’application : aucune nouvelle partie ne sera enregistrée par-dessus.
          </Text>
        </View>
      </View>
    );
  }
  if (!syncFaite) {
    return (
      <View style={styles.etat}>
        <ActivityIndicator color={C.violet} size="large" />
        <Text style={styles.titre}>Synchronisation de ta progression…</Text>
      </View>
    );
  }
  const nomsCartes = (achatPrisEnCompte?.nouvellesCartes || [])
    .map((id) => trouverCollectible(id)?.nom)
    .filter((nom): nom is string => !!nom);
  return (
    <View style={styles.racine}>
      <Stack screenOptions={{ headerShown: false }} />
      {achatPrisEnCompte && (
        <Pressable
          style={styles.notification}
          onPress={() => setAchatPrisEnCompte(null)}
          accessibilityRole="button"
          accessibilityLabel="Achat boutique pris en compte, toucher pour fermer"
        >
          <Text style={styles.notificationEmoji}>🧋</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.notificationTitre}>Achat pris en compte !</Text>
            <Text style={styles.notificationTexte}>
              {achatPrisEnCompte.nouvellesBoissons > 1
                ? `${achatPrisEnCompte.nouvellesBoissons} boissons ajoutées à ton Passeport.`
                : 'Ta boisson a été ajoutée à ton Passeport.'}
            </Text>
            {nomsCartes.length > 0 && (
              <Text style={styles.notificationGain}>
                ✨ {nomsCartes.length === 1
                  ? `${nomsCartes[0]} rejoint ta collection !`
                  : `${nomsCartes.slice(0, 2).join(' et ')} rejoignent ta collection !`}
              </Text>
            )}
            {nomsCartes.length === 0 && achatPrisEnCompte.monteesGout.length > 0 && (
              <Text style={styles.notificationGain}>
                👅 Le Goût de {achatPrisEnCompte.monteesGout.length > 1
                  ? `${achatPrisEnCompte.monteesGout.length} cartes progresse`
                  : 'ta carte progresse'}.
              </Text>
            )}
          </View>
          <Text style={styles.notificationFermer}>×</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1 },
  etat: {
    flex: 1, backgroundColor: C.fond, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, gap: 16,
  },
  carteErreur: {
    width: '100%', maxWidth: 420, backgroundColor: C.carte, borderRadius: R.carte,
    padding: 22, gap: 10,
  },
  titre: { fontFamily: F.t800, fontSize: 18, color: C.violet, textAlign: 'center' },
  texte: { fontFamily: F.t600, fontSize: 14, lineHeight: 21, color: C.texte2, textAlign: 'center' },
  notification: {
    position: 'absolute', top: 54, left: 14, right: 14, zIndex: 1000,
    flexDirection: 'row', alignItems: 'flex-start', gap: 11,
    backgroundColor: C.carte, borderRadius: R.carte, padding: 15,
    borderWidth: 2, borderColor: C.vert,
    shadowColor: '#2A1D46', shadowOpacity: 0.2, shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 }, elevation: 8,
  },
  notificationEmoji: { fontSize: 30, lineHeight: 36 },
  notificationTitre: { fontFamily: F.t800, fontSize: 16, color: C.violet },
  notificationTexte: { fontFamily: F.t600, fontSize: 13.5, lineHeight: 19, color: C.texte2 },
  notificationGain: { fontFamily: F.t700, fontSize: 13, lineHeight: 18, color: C.vertFonce, marginTop: 3 },
  notificationFermer: { fontFamily: F.t800, fontSize: 24, lineHeight: 26, color: C.texte2 },
});
