// === Encart : prénom manquant ===
// S'affiche aux comptes CONNECTÉS sans prénom. Ils viennent presque tous de deux
// trous mesurés le 05/08/2026 sur les 56 profils :
//   · Apple — 12 comptes sur 14. Apple ne transmet le nom qu'à la PREMIÈRE
//     autorisation et `loginApple` ne le captait pas ; ces 12 prénoms sont perdus
//     côté Apple, définitivement. Seul le client peut encore les donner.
//   · Email — 9 comptes sur 23, le champ étant optionnel au formulaire.
// Le correctif de `compte.tsx` tarit la source ; cet encart rattrape l'existant.
//
// REPORTABLE, contrairement à GateNaissance — et c'est délibéré. Un prénom n'ouvre
// aucun droit (l'anniversaire, lui, conditionne la boisson offerte), et l'app a déjà
// été retoquée une fois par App Store 4.0 sur un écran bloquant. Deux murs
// d'affilée à la première ouverture, c'est chercher le rejet. « Plus tard » repousse
// donc de 7 jours, sans jamais fermer la porte.
import { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableWithoutFeedback,
  Keyboard, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { C, F } from '@/constants/charte';
import { Carte, ChampTexte, Message, BoutonPrimaire } from '@/components/ui-kit';

const CLE_REPORT = 'gatePrenom.v1.reporteJusqua';
const REPORT_JOURS = 7;

/** L'encart est-il en sommeil ? (report « Plus tard » encore valable) */
export async function prenomReporte(): Promise<boolean> {
  try {
    const brut = await AsyncStorage.getItem(CLE_REPORT);
    if (!brut) return false;
    const jusqua = Date.parse(brut);
    return Number.isFinite(jusqua) && jusqua > Date.now();
  } catch {
    return false;
  }
}

export function GatePrenom({ userId, onDone }: { userId: string; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [valeur, setValeur] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const enregistrer = async () => {
    const prenom = valeur.trim().replace(/\s+/g, ' ');
    // Deux caractères au moins : « A » ou un espace seul ne valent pas un prénom, et
    // on préfère une ligne vide à une donnée fantaisiste dans la base.
    if (prenom.length < 2) { setMsg('Entre ton prénom (2 lettres minimum).'); return; }
    setEnCours(true);
    setMsg(null);
    try {
      const { error } = await supabase.from('profils').update({ nom: prenom }).eq('id', userId);
      if (error) throw error;
      await AsyncStorage.removeItem(CLE_REPORT);
      onDone();
    } catch (e: any) {
      setMsg(String(e?.message ?? e));
      setEnCours(false);
    }
  };

  const plusTard = async () => {
    try {
      const jusqua = new Date(Date.now() + REPORT_JOURS * 24 * 3600 * 1000).toISOString();
      await AsyncStorage.setItem(CLE_REPORT, jusqua);
    } catch { /* le report est un confort, jamais un blocage */ }
    onDone();
  };

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent onRequestClose={plusTard}>
      {/* Mêmes précautions que GateNaissance, apprises du rejet App Store 4.0 du 02/07 :
          tap n'importe où pour fermer le clavier, ScrollView + KeyboardAvoidingView pour
          que le bouton reste atteignable sur iPad. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1, backgroundColor: C.fond }}
          contentContainerStyle={[styles.fond, { paddingTop: insets.top + 40 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View>
              <Carte style={styles.carte}>
                <Text style={styles.titre}>Comment on t’appelle ?</Text>
                <Text style={styles.sous}>
                  Ton prénom s’affiche sur ton gobelet en boutique, et c’est lui qu’on
                  utilise pour te saluer ici.
                </Text>
                <ChampTexte
                  value={valeur}
                  onChangeText={setValeur}
                  placeholder="Ton prénom"
                  autoCapitalize="words"
                  autoComplete="given-name"
                  textContentType="givenName"
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
                {msg && <Message texte={msg} />}
                <BoutonPrimaire titre="Enregistrer" onPress={enregistrer} loading={enCours} />
                <Pressable onPress={plusTard} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.plusTard}>Plus tard</Text>
                </Pressable>
              </Carte>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flexGrow: 1, backgroundColor: C.fond, padding: 18, justifyContent: 'center' },
  carte: { gap: 12 },
  titre: { fontFamily: F.titre, fontSize: 24, color: C.violet, textAlign: 'center' },
  sous: { fontFamily: F.t400, fontSize: 15, color: C.texte2, textAlign: 'center', lineHeight: 21 },
  plusTard: { fontFamily: F.t600, fontSize: 13.5, color: C.texte2, textAlign: 'center', paddingVertical: 4 },
});
