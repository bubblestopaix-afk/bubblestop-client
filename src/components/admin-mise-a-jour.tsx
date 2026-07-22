import { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, StyleSheet, Switch, Text, View } from 'react-native';

import { BoutonGhost, BoutonPrimaire, Carte, ChampTexte, Chip, Message } from '@/components/ui-kit';
import { C, F } from '@/constants/charte';
import {
  ConfigMiseAJour,
  ecrireConfigMiseAJour,
  lireConfigMiseAJour,
  lireVersionInstallee,
  ModeMiseAJour,
} from '@/lib/mise-a-jour';

const MODES: { id: ModeMiseAJour; label: string }[] = [
  { id: 'inactive', label: 'Désactivée' },
  { id: 'conseillee', label: 'Conseillée' },
  { id: 'obligatoire', label: 'Obligatoire' },
];

function chiffres(valeur: string) {
  return valeur.replace(/\D/g, '').slice(0, 8);
}

export function AdminMiseAJour() {
  const [config, setConfig] = useState<ConfigMiseAJour | null>(null);
  const [ios, setIos] = useState('');
  const [android, setAndroid] = useState('');
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [etat, setEtat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const appliquer = (valeur: ConfigMiseAJour) => {
    setConfig(valeur);
    setIos(valeur.ios_build_min ? String(valeur.ios_build_min) : '');
    setAndroid(valeur.android_version_code_min ? String(valeur.android_version_code_min) : '');
    setMessage(valeur.message);
    setConfirmation(false);
  };

  const charger = async () => {
    setBusy(true);
    setEtat(null);
    const valeur = await lireConfigMiseAJour();
    if (valeur) appliquer(valeur);
    else setEtat('Impossible de charger le réglage. L’application reste ouverte par sécurité.');
    setBusy(false);
  };

  useEffect(() => { charger(); }, []);

  const choisirMode = (mode: ModeMiseAJour) => {
    setConfig((courant) => courant ? { ...courant, mode } : courant);
    setConfirmation(false);
    setEtat(null);
  };

  const enregistrer = async () => {
    Keyboard.dismiss();
    if (!config || busy) return;
    const iosMin = Number(ios || 0);
    const androidMin = Number(android || 0);
    if (!Number.isInteger(iosMin) || iosMin < 0 || !Number.isInteger(androidMin) || androidMin < 0) {
      setEtat('Les numéros minimums doivent être des entiers positifs.');
      return;
    }
    if (config.mode !== 'inactive' && iosMin === 0 && androidMin === 0) {
      setEtat('Indique au moins un build iOS ou un versionCode Android minimum.');
      return;
    }
    if (!message.trim()) {
      setEtat('Le message présenté aux clients ne peut pas être vide.');
      return;
    }
    if (config.mode === 'obligatoire' && !confirmation) {
      setEtat('Confirme d’abord que les nouvelles versions sont réellement disponibles sur les stores.');
      return;
    }

    const suivant = {
      ...config,
      ios_build_min: iosMin,
      android_version_code_min: androidMin,
      message: message.trim(),
    };
    setBusy(true);
    setEtat('Enregistrement…');
    const ok = await ecrireConfigMiseAJour(suivant);
    if (ok) {
      appliquer(suivant);
      setEtat(suivant.mode === 'inactive'
        ? '✓ Contrôle désactivé. Aucun client ne sera bloqué.'
        : '✓ Réglage actif. Il sera relu au lancement, au retour dans l’app ou sous 5 minutes.');
    } else {
      setEtat('Échec de l’enregistrement. Le réglage précédent reste inchangé.');
    }
    setBusy(false);
  };

  const version = lireVersionInstallee(config ?? undefined);

  return (
    <Carte style={{ gap: 12 }}>
      <Text style={styles.titre}>Mises à jour de l’application</Text>
      <Text style={styles.aide}>
        Conseillée affiche un rappel fermable. Obligatoire bloque l’ancienne version et ouvre
        directement le store. N’active jamais le blocage avant que la nouvelle version soit publiée.
      </Text>

      {busy && !config ? <ActivityIndicator color={C.violet} /> : config ? (
        <>
          <View style={styles.modes}>
            {MODES.map((mode) => (
              <Chip
                key={mode.id}
                label={mode.label}
                actif={config.mode === mode.id}
                onPress={() => choisirMode(mode.id)}
                disabled={busy}
              />
            ))}
          </View>

          <View style={styles.numeros}>
            <View style={{ flex: 1 }}>
              <ChampTexte
                label="Build iOS minimum"
                value={ios}
                onChangeText={(v) => { setIos(chiffres(v)); setConfirmation(false); setEtat(null); }}
                placeholder="Ex. 25"
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                editable={!busy}
              />
            </View>
            <View style={{ flex: 1 }}>
              <ChampTexte
                label="VersionCode Android minimum"
                value={android}
                onChangeText={(v) => { setAndroid(chiffres(v)); setConfirmation(false); setEtat(null); }}
                placeholder="Ex. 14"
                keyboardType="number-pad"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                editable={!busy}
              />
            </View>
          </View>

          <ChampTexte
            label="Message présenté aux clients"
            value={message}
            onChangeText={(v) => { setMessage(v.slice(0, 240)); setEtat(null); }}
            multiline
            maxLength={240}
            editable={!busy}
          />

          {config.mode === 'obligatoire' && (
            <View style={styles.confirmation}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.confirmationTitre}>Je confirme la disponibilité sur les stores</Text>
                <Text style={styles.confirmationAide}>
                  Sinon les clients seraient bloqués sans pouvoir installer la nouvelle version.
                </Text>
              </View>
              <Switch
                value={confirmation}
                onValueChange={setConfirmation}
                disabled={busy}
                trackColor={{ true: C.vert, false: '#C9C2D6' }}
                thumbColor="#fff"
              />
            </View>
          )}

          {!!version && (
            <Text style={styles.version}>
              Cet appareil : version {version.version} · {version.plateforme === 'ios' ? 'build iOS' : 'versionCode Android'} {version.build || 'inconnu'}
            </Text>
          )}
          <Text style={styles.securite}>
            Sécurité : si le serveur de configuration est indisponible, l’application s’ouvre normalement.
          </Text>
          {!!etat && <Message texte={etat} type={etat.startsWith('✓') ? 'ok' : etat.startsWith('Échec') || etat.startsWith('Impossible') || etat.startsWith('Confirme') ? 'erreur' : 'info'} />}
          <BoutonPrimaire titre="Enregistrer le contrôle de version" onPress={enregistrer} loading={busy} />
          <BoutonGhost titre="Fermer le clavier" onPress={Keyboard.dismiss} />
        </>
      ) : (
        <>
          {!!etat && <Message texte={etat} type="erreur" />}
          <BoutonPrimaire titre="Réessayer" onPress={charger} loading={busy} />
        </>
      )}
    </Carte>
  );
}

const styles = StyleSheet.create({
  titre: { fontFamily: F.titre, fontSize: 15.5, color: C.violet },
  aide: { fontFamily: F.t600, fontSize: 12.5, color: C.texte2, lineHeight: 17 },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  numeros: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  confirmation: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.jaunePale, borderRadius: 14, padding: 12,
  },
  confirmationTitre: { fontFamily: F.t700, fontSize: 13, color: C.texte },
  confirmationAide: { fontFamily: F.t400, fontSize: 11.5, color: C.texte2, lineHeight: 16 },
  version: { fontFamily: F.t700, fontSize: 12, color: C.violet, textAlign: 'center' },
  securite: { fontFamily: F.t500, fontSize: 11.5, color: C.vertFonce, lineHeight: 16, textAlign: 'center' },
});
