import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState, Linking, Modal, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoutonGhost, BoutonPrimaire, Etincelle, MascottePerle } from '@/components/ui-kit';
import { BORD, C, F, OMBRE, R } from '@/constants/charte';
import {
  ConfigMiseAJour,
  lireConfigMiseAJour,
  lireVersionInstallee,
  miseAJourNecessaire,
  VersionInstallee,
} from '@/lib/mise-a-jour';

const RAPPEL_CONSEILLE_APRES_MS = 24 * 60 * 60 * 1000;
const INTERVALLE_CONFIG_MS = 5 * 60 * 1000;
const INTERVALLE_OTA_MS = 10 * 60 * 1000;

type Invitation = {
  config: ConfigMiseAJour;
  version: VersionInstallee;
};

function cleReport(version: VersionInstallee) {
  return `miseAJour.report.${version.plateforme}.${version.minimum}`;
}

/**
 * Garde global :
 * - build store trop ancien → conseil fermable ou écran obligatoire ;
 * - OTA compatible déjà téléchargée → rechargement immédiat ;
 * - retour au premier plan → vérification OTA raisonnablement limitée.
 */
export function GardeMiseAJour() {
  const insets = useSafeAreaInsets();
  const etatUpdates = Updates.useUpdates();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [otaEnCours, setOtaEnCours] = useState(false);
  const [erreurStore, setErreurStore] = useState<string | null>(null);
  const rechargementEnCours = useRef(false);
  const derniereVerificationOta = useRef(0);

  const verifierVersionStore = useCallback(async () => {
    const config = await lireConfigMiseAJour();
    // Fail-open explicite : une panne de configuration ne bloque jamais le lancement.
    if (!config) {
      setInvitation(null);
      return;
    }
    const version = lireVersionInstallee(config);
    if (!miseAJourNecessaire(config, version) || !version) {
      setInvitation(null);
      return;
    }
    if (config.mode === 'conseillee') {
      const report = Number(await AsyncStorage.getItem(cleReport(version)).catch(() => null));
      if (Number.isFinite(report) && Date.now() - report < RAPPEL_CONSEILLE_APRES_MS) {
        setInvitation(null);
        return;
      }
    }
    setInvitation({ config, version });
  }, []);

  const appliquerOta = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled || rechargementEnCours.current) return;
    rechargementEnCours.current = true;
    setOtaEnCours(true);
    try {
      await Updates.reloadAsync();
    } catch {
      // Une OTA ne doit jamais empêcher le client d'utiliser la version embarquée.
      rechargementEnCours.current = false;
      setOtaEnCours(false);
    }
  }, []);

  // ON_LOAD télécharge déjà en arrière-plan. Dès que l'OTA est prête, on l'applique
  // sans demander au client de tuer puis relancer l'application.
  useEffect(() => {
    if (etatUpdates.isUpdatePending) appliquerOta();
  }, [appliquerOta, etatUpdates.isUpdatePending]);

  const verifierOtaAuRetour = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled || rechargementEnCours.current) return;
    const maintenant = Date.now();
    if (maintenant - derniereVerificationOta.current < INTERVALLE_OTA_MS) return;
    derniereVerificationOta.current = maintenant;
    try {
      const resultat = await Updates.checkForUpdateAsync();
      if (!resultat.isAvailable) return;
      // Le téléchargement reste en arrière-plan : aucune attente réseau ne bloque l'UI.
      // L'écran de transition n'apparaît qu'au moment du redémarrage effectif.
      await Updates.fetchUpdateAsync();
      await appliquerOta();
    } catch {
      // Hors-ligne, timeout ou limitation Expo : on garde silencieusement l'app courante.
      setOtaEnCours(false);
      rechargementEnCours.current = false;
    }
  }, [appliquerOta]);

  useEffect(() => {
    verifierVersionStore();
    const intervalle = setInterval(verifierVersionStore, INTERVALLE_CONFIG_MS);
    let precedent = AppState.currentState;
    const sub = AppState.addEventListener('change', (suivant) => {
      const revient = suivant === 'active' && precedent !== 'active';
      precedent = suivant;
      if (revient) {
        verifierVersionStore();
        verifierOtaAuRetour();
      }
    });
    return () => {
      clearInterval(intervalle);
      sub.remove();
    };
  }, [verifierOtaAuRetour, verifierVersionStore]);

  const reporter = async () => {
    if (!invitation || invitation.config.mode === 'obligatoire') return;
    await AsyncStorage.setItem(cleReport(invitation.version), String(Date.now())).catch(() => {});
    setInvitation(null);
  };

  const ouvrirStore = async () => {
    if (!invitation) return;
    setErreurStore(null);
    try {
      await Linking.openURL(invitation.version.urlStore);
    } catch {
      setErreurStore('Impossible d’ouvrir le store. Vérifie ta connexion puis réessaie.');
    }
  };

  const obligatoire = invitation?.config.mode === 'obligatoire';
  const nomStore = invitation?.version.plateforme === 'ios' ? 'l’App Store' : 'Google Play';

  return (
    <>
      <Modal
        visible={!!invitation}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={obligatoire ? () => {} : reporter}>
        <View style={[styles.page, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.decorGauche}><Etincelle taille={22} couleur={C.jaune} /></View>
          <View style={styles.decorDroite}><Etincelle taille={14} couleur={C.rose} /></View>
          <View style={styles.contenu}>
            <View style={styles.mascotte}><MascottePerle taille={82} couronne={!!obligatoire} /></View>
            <Text accessibilityRole="header" style={styles.titre}>
              {obligatoire ? 'Mise à jour nécessaire' : 'Une nouveauté t’attend'}
            </Text>
            <Text style={styles.message}>{invitation?.config.message}</Text>
            {!!invitation && (
              <View style={styles.versionBloc}>
                <Text style={styles.versionLabel}>Version installée</Text>
                <Text style={styles.versionValeur}>
                  {invitation.version.version} · build {invitation.version.build}
                </Text>
              </View>
            )}
            {!!erreurStore && <Text accessibilityRole="alert" style={styles.erreur}>{erreurStore}</Text>}
            <BoutonPrimaire
              titre={`Mettre à jour sur ${nomStore}`}
              onPress={ouvrirStore}
              style={{ alignSelf: 'stretch' }}
            />
            {!obligatoire && <BoutonGhost titre="Plus tard" onPress={reporter} />}
            <Text style={styles.aide}>
              {obligatoire
                ? 'Cette version n’est plus compatible. Tes tampons, ton solde et tes données restent conservés.'
                : 'Tu pourras continuer maintenant et nous te le rappellerons demain.'}
            </Text>
          </View>
        </View>
      </Modal>

      <Modal visible={otaEnCours} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.otaFond}>
          <View style={styles.otaCarte}>
            <MascottePerle taille={54} />
            <Text style={styles.otaTitre}>Mise à jour en cours…</Text>
            <Text style={styles.otaTexte}>Bubble Stop redémarre avec les dernières nouveautés.</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1, backgroundColor: C.fond, paddingHorizontal: 24,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  contenu: { width: '100%', maxWidth: 440, alignItems: 'center', gap: 16 },
  mascotte: {
    width: 118, height: 118, borderRadius: 59, backgroundColor: C.rosePale,
    borderWidth: BORD.largeur, borderColor: C.carte,
    alignItems: 'center', justifyContent: 'center', ...OMBRE,
  },
  titre: { fontFamily: F.titre, fontSize: 28, color: C.violet, textAlign: 'center' },
  message: { fontFamily: F.t500, fontSize: 16, lineHeight: 23, color: C.texte, textAlign: 'center' },
  versionBloc: {
    width: '100%', backgroundColor: C.lavande, borderRadius: R.btn,
    paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', gap: 2,
  },
  versionLabel: { fontFamily: F.t500, fontSize: 12, color: C.texte2 },
  versionValeur: { fontFamily: F.titre, fontSize: 16, color: C.violetProfond },
  erreur: { fontFamily: F.t600, fontSize: 13, color: C.danger, textAlign: 'center' },
  aide: { fontFamily: F.t400, fontSize: 12.5, lineHeight: 18, color: C.texte2, textAlign: 'center' },
  decorGauche: { position: 'absolute', left: 38, top: '22%' },
  decorDroite: { position: 'absolute', right: 44, bottom: '24%' },
  otaFond: {
    flex: 1, backgroundColor: 'rgba(69,42,110,0.78)', padding: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  otaCarte: {
    width: '100%', maxWidth: 360, borderRadius: R.carte, backgroundColor: C.carte,
    borderWidth: BORD.largeur, borderColor: C.bord, padding: 24,
    alignItems: 'center', gap: 10, ...OMBRE,
  },
  otaTitre: { fontFamily: F.titre, fontSize: 20, color: C.violet },
  otaTexte: { fontFamily: F.t500, fontSize: 14, color: C.texte2, textAlign: 'center' },
});
