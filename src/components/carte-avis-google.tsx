import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { BOUTIQUES_AVIS_GOOGLE, destinationAvisGoogle, type MagasinAvisGoogle } from '@/lib/avis-google';
import { C, F, R } from '@/constants/charte';

export default function CarteAvisGoogle() {
  const [choix, setChoix] = useState<MagasinAvisGoogle | null>(null);
  const [message, setMessage] = useState('');
  const destination = destinationAvisGoogle(choix);

  async function ouvrir() {
    if (!destination) return;
    setMessage('');
    try { await Linking.openURL(destination.url); }
    catch { setMessage('Google ne s’est pas ouvert. Réessaie dans un instant.'); }
  }

  const libelle = destination ? `Donner mon avis · ${destination.nom} ↗` : 'Choisis une boutique';
  return (
    <View style={s.carte}>
      <Text style={s.titre}>Ton avis compte</Text>
      <Text style={s.texte}>Partage ton expérience dans ton Bubble Stop préféré.</Text>
      <View style={s.choix} accessibilityRole="radiogroup" accessibilityLabel="Choisir une boutique">
        {BOUTIQUES_AVIS_GOOGLE.map((boutique) => (
          <Pressable key={boutique.magasin} accessibilityRole="radio"
            accessibilityLabel={boutique.nom} accessibilityState={{ checked: choix === boutique.magasin }}
            onPress={() => { setChoix(boutique.magasin); setMessage(''); }}
            style={({ pressed }) => [s.option, choix === boutique.magasin && s.selection, pressed && { opacity: 0.7 }]}>
            <Text style={[s.optionTexte, choix === boutique.magasin && s.selectionTexte]}>{boutique.nom}</Text>
          </Pressable>
        ))}
      </View>
      {Platform.OS === 'web' && destination ? (
        <Link href={destination.url as `https://${string}`} target="_blank" rel="noopener noreferrer" asChild>
          <Pressable accessibilityRole="link" style={s.bouton}><Text style={s.action}>{libelle}</Text></Pressable>
        </Link>
      ) : (
        <Pressable onPress={ouvrir} disabled={!destination} accessibilityRole="button"
          accessibilityState={{ disabled: !destination }}
          style={({ pressed }) => [s.bouton, (!destination || pressed) && { opacity: 0.65 }]}>
          <Text style={s.action}>{libelle}</Text>
        </Pressable>
      )}
      <Text style={s.precision}>Tu as visité plusieurs boutiques ? Tu peux laisser un avis pour chacune.</Text>
      {!!message && <Text accessibilityRole="alert" style={s.message}>{message}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  carte: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#DED5E9', borderRadius: R.carte, padding: 18, gap: 12 },
  titre: { fontFamily: F.titre, fontSize: 21, color: C.violet },
  texte: { fontFamily: F.t500, fontSize: 14, lineHeight: 20, color: C.texte },
  choix: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: '#C5B5D9', borderRadius: R.pill, paddingHorizontal: 13, paddingVertical: 10 },
  selection: { backgroundColor: C.violet, borderColor: C.violet },
  optionTexte: { fontFamily: F.t600, fontSize: 14, color: C.violet },
  selectionTexte: { color: '#fff' },
  bouton: { backgroundColor: C.violet, borderRadius: R.btn, minHeight: 48, padding: 13, justifyContent: 'center' },
  action: { fontFamily: F.t700, fontSize: 15, color: '#fff', textAlign: 'center' },
  precision: { fontFamily: F.t400, fontSize: 12, lineHeight: 17, color: C.texte2 },
  message: { fontFamily: F.t600, fontSize: 13, lineHeight: 18, color: C.violetProfond },
});
