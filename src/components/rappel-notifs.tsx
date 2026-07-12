// === 🔔 Rappel « active les notifications » ===
// Un client qui refuse (ou ne voit jamais) la demande de notifications ne recevra
// AUCUNE promo ni « commande prête ». Cette bannière s'affiche aux connectés tant
// que la permission n'est pas accordée :
//   - jamais demandée → bouton « Activer » (déclenche la popup système + enregistre le jeton)
//   - refusée        → bouton « Ouvrir les réglages » (Linking.openSettings)
// « Plus tard » masque la bannière 14 jours (AsyncStorage). Invisible sur le web.
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, Linking, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { enregistrerPush } from '@/lib/push';
import { IconeApp } from '@/components/icones-app';
import { C, F, OMBRE } from '@/constants/charte';

const CLE_SNOOZE = 'rappelNotifs.plusTard';
const SNOOZE_JOURS = 14;

export default function RappelNotifs() {
  // 'granted' | 'denied' | 'undetermined' | null (= rien à afficher : web, déconnecté, snoozé…)
  const [etat, setEtat] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const verifier = async () => {
    try {
      if (Platform.OS === 'web') return; // pas de push web
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setEtat(null); return; }
      const snooze = await AsyncStorage.getItem(CLE_SNOOZE).catch(() => null);
      if (snooze && Date.now() - Number(snooze) < SNOOZE_JOURS * 86400000) { setEtat(null); return; }
      const Notifications = await import('expo-notifications');
      const { status } = await Notifications.getPermissionsAsync();
      setEtat(status === 'granted' ? null : status); // granted → rien à rappeler
    } catch { setEtat(null); }
  };
  useEffect(() => { verifier(); }, []);

  if (!etat) return null;

  const activer = async () => {
    setEnCours(true);
    try {
      if (etat === 'denied') {
        // Permission déjà refusée : seule la fiche réglages du téléphone peut la rouvrir
        await Linking.openSettings();
      } else {
        await enregistrerPush(); // popup système + enregistrement du jeton si accepté
      }
    } catch { /* silencieux */ }
    setEnCours(false);
    verifier();
  };
  const plusTard = async () => {
    try { await AsyncStorage.setItem(CLE_SNOOZE, String(Date.now())); } catch { /* ignore */ }
    setEtat(null);
  };

  return (
    <View style={styles.carte}>
      <View style={styles.titreRang}>
        <IconeApp nom="cloche" taille={17} />
        <Text style={styles.titre}>Ne rate aucune promo !</Text>
      </View>
      <Text style={styles.texte}>
        {etat === 'denied'
          ? 'Les notifications sont désactivées : tu ne reçois ni les offres ni le « commande prête ». Réactive-les dans les réglages.'
          : 'Active les notifications pour recevoir les offres exclusives et savoir quand ta commande est prête.'}
      </Text>
      <View style={styles.boutons}>
        <Pressable onPress={activer} disabled={enCours} style={styles.btnPlein}>
          <Text style={styles.btnPleinTxt}>{enCours ? '…' : etat === 'denied' ? 'Ouvrir les réglages' : 'Activer'}</Text>
        </Pressable>
        <Pressable onPress={plusTard} style={styles.btnGhost}>
          <Text style={styles.btnGhostTxt}>Plus tard</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    backgroundColor: C.carte, borderRadius: 18, padding: 16, gap: 8,
    borderWidth: 1.5, borderColor: C.vert, ...OMBRE,
  },
  titreRang: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  titre: { fontFamily: F.t800, fontSize: 14.5, color: C.violetProfond },
  texte: { fontFamily: F.t400, fontSize: 12.5, color: C.texte2, lineHeight: 18 },
  boutons: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  btnPlein: {
    backgroundColor: C.vert, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9,
  },
  btnPleinTxt: { fontFamily: F.t800, fontSize: 13, color: C.violetProfond },
  btnGhost: { paddingHorizontal: 10, paddingVertical: 9 },
  btnGhostTxt: { fontFamily: F.t600, fontSize: 12.5, color: C.texte2 },
});
