// === Écran bloquant : date de naissance obligatoire à la 1re connexion ===
// S'affiche tant qu'un utilisateur CONNECTÉ n'a pas de date_naissance : comptes
// créés via Google / Apple (qui ne passent pas par le formulaire d'inscription)
// et anciens comptes. Non fermable : l'app reste bloquée tant que la date n'est
// pas saisie. Définitive ensuite (trigger serveur `trg_date_naissance_immuable`).
import { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableWithoutFeedback,
  Keyboard, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { C, F } from '@/constants/charte';
import { Carte, ChampTexte, Message, BoutonPrimaire } from '@/components/ui-kit';

// JJ/MM/AAAA → YYYY-MM-DD (null si invalide, dans le futur, ou improbable)
function naissanceVersIso(saisie: string): string | null {
  const m = saisie.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const jour = +m[1], mois = +m[2], annee = +m[3];
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31 || annee < 1900) return null;
  const d = new Date(annee, mois - 1, jour);
  if (d.getFullYear() !== annee || d.getMonth() !== mois - 1 || d.getDate() !== jour) return null;
  if (d.getTime() > Date.now()) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function GateNaissance({ userId, onDone }: { userId: string; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [valeur, setValeur] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const enregistrer = async () => {
    const iso = naissanceVersIso(valeur);
    if (!iso) { setMsg('Entre une date de naissance valide (JJ/MM/AAAA).'); return; }
    setEnCours(true);
    setMsg(null);
    try {
      const { error } = await supabase.from('profils').update({ date_naissance: iso }).eq('id', userId);
      if (error) throw error;
      onDone();
    } catch (e: any) {
      setMsg(String(e?.message ?? e));
      setEnCours(false);
    }
  };

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent onRequestClose={() => {}}>
      {/* ⚠️ Rejet App Store 4.0 (iPad, 02/07) : impossible de fermer le clavier numérique sur cet
          écran → reviewer bloqué. Correctifs : tap n'importe où = Keyboard.dismiss (Touchable),
          ScrollView + KeyboardAvoidingView (le bouton Valider reste toujours atteignable),
          et fermeture AUTO du clavier dès que la date est complète (8 chiffres). */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1, backgroundColor: C.fond }}
          contentContainerStyle={[styles.fond, { paddingTop: insets.top + 40 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View>
              <Carte style={styles.carte}>
                <Text style={styles.titre}>Bienvenue 🎉</Text>
                <Text style={styles.sous}>
                  Avant de continuer, indique ta date de naissance. Elle nous sert à t'offrir une boisson
                  le jour de ton anniversaire 🎂.
                </Text>
                <ChampTexte
                  value={valeur}
                  onChangeText={(v: string) => {
                    const ch = v.replace(/\D/g, '').slice(0, 8);
                    let aff = ch;
                    if (ch.length > 4) aff = `${ch.slice(0, 2)}/${ch.slice(2, 4)}/${ch.slice(4)}`;
                    else if (ch.length > 2) aff = `${ch.slice(0, 2)}/${ch.slice(2)}`;
                    setValeur(aff);
                    if (ch.length === 8) Keyboard.dismiss(); // date complète → on rend la main
                  }}
                  placeholder="JJ/MM/AAAA"
                  keyboardType="number-pad"
                  maxLength={10}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
                <Text style={styles.aide}>🔒 Non modifiable une fois enregistrée.</Text>
                {msg && <Message texte={msg} />}
                <BoutonPrimaire titre="Valider" onPress={enregistrer} loading={enCours} />
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
  aide: { fontFamily: F.t400, fontSize: 12, color: C.texte2, textAlign: 'center' },
});
