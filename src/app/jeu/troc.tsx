// === Boba Quest — le TROC (preview) ===
// Transforme tes doublons en cartes qui te manquent. En preview : un « échange du
// jour » avec Sam (démo), déterministe, 1 par jour. En version finale : échange
// direct avec de vrais amis par QR (arrive avec les duels).
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { C, F, R, OMBRE } from '@/constants/charte';
import PastilleCollectible from '@/components/jeu/collectibles';
import { trouverCollectible } from '@/components/jeu/economie';
import { Icone } from '@/components/jeu/icones';
import { BandeauPreview, BoutonJeu, EnTeteJeu } from '@/components/jeu/ui-jeu';
import { faireTrocDuJour, idsDoublons, trocDuJourActuel, useBobaQuest } from '@/store/jeu';

export default function TrocScreen() {
  const insets = useSafeAreaInsets();
  const etat = useBobaQuest();
  const troc = trocDuJourActuel(etat);
  const doublons = idsDoublons(etat);
  const [gain, setGain] = useState<{ veut: string; offre: string } | null>(null);

  const nom = (id: string) => trouverCollectible(id)?.nom ?? '';
  const faire = () => { const r = faireTrocDuJour(); if (r) setGain(r); };

  return (
    <View style={[styles.fond, { paddingTop: insets.top + 10 }]}>
      <View style={{ paddingHorizontal: 18 }}>
        <EnTeteJeu titre="Troc" onRetour={() => router.back()} perles={etat.perles} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.pitch}>Transforme un doublon en carte manquante de la même rareté.</Text>

        {/* === Échange du jour === */}
        <View style={styles.carte}>
          <Text style={styles.carteTitre}>Échange du jour</Text>
          {troc && troc.fait ? (
            <View style={styles.faitBadge}>
              <Icone nom="check" taille={16} />
              <Text style={styles.faitTxt}>Échange du jour fait — reviens demain !</Text>
            </View>
          ) : troc ? (
            <>
              <View style={styles.echangeRang}>
                <View style={styles.col}>
                  <Text style={styles.colLabel}>Tu donnes</Text>
                  <PastilleCollectible id={troc.veut} taille={66} />
                  <Text style={styles.colNom} numberOfLines={1}>{nom(troc.veut)}</Text>
                  <Text style={styles.colSous}>ton doublon</Text>
                </View>
                <View style={styles.fleche}><Text style={styles.flecheTxt}>›</Text></View>
                <View style={styles.col}>
                  <Text style={styles.colLabel}>Tu reçois</Text>
                  <PastilleCollectible id={troc.offre} taille={66} />
                  <Text style={styles.colNom} numberOfLines={1}>{nom(troc.offre)}</Text>
                  <View style={styles.neuf}><Text style={styles.neufTxt}>NOUVEAU</Text></View>
                </View>
              </View>
              <BoutonJeu titre="Échanger" onPress={faire} style={{ alignSelf: 'stretch', backgroundColor: C.vert }} />
            </>
          ) : (
            <Text style={styles.vide}>
              Il te faut un doublon et une carte manquante de la même rareté. Une commune ne peut
              donc jamais être échangée contre une légendaire.
            </Text>
          )}
          <Text style={styles.aide}>Sam (démo) · Bientôt : échange avec de vrais amis par QR, avec l'arrivée des duels.</Text>
        </View>

        {/* === Tes doublons === */}
        <View style={styles.carte}>
          <Text style={styles.carteTitre}>Tes doublons ({doublons.length})</Text>
          {doublons.length ? (
            <View style={styles.grille}>
              {doublons.map((id) => (
                <View key={id} style={styles.dbl}>
                  <View style={styles.dblBadge}><Text style={styles.dblBadgeTxt}>×{etat.collection[id]}</Text></View>
                  <PastilleCollectible id={id} taille={56} />
                  <Text style={styles.dblNom} numberOfLines={1}>{nom(id)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.vide}>Aucun doublon pour l'instant — tu en gagnes en tirant une carte déjà dans ta collec'.</Text>
          )}
        </View>

        <BandeauPreview />
      </ScrollView>

      {/* === Confirmation d'échange === */}
      <Modal visible={!!gain} transparent animationType="fade" onRequestClose={() => setGain(null)}>
        {gain && (
          <View style={styles.modalFond}>
            <View style={styles.modalCarte}>
              <Text style={styles.modalTitre}>Échange réussi !</Text>
              <PastilleCollectible id={gain.offre} taille={120} />
              <Text style={styles.modalNom}>{nom(gain.offre)}</Text>
              <Text style={styles.modalTexte}>
                Tu as troqué ton doublon {nom(gain.veut)} contre {nom(gain.offre)}. Il rejoint ta collection !
              </Text>
              <BoutonJeu titre="Super !" onPress={() => setGain(null)} style={{ alignSelf: 'stretch' }} />
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  contenu: { padding: 18, gap: 14, paddingBottom: 34 },
  pitch: { fontFamily: F.t700, fontSize: 14.5, color: C.texte2, textAlign: 'center' },

  carte: { backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 12, ...OMBRE },
  carteTitre: { fontFamily: F.t800, fontSize: 16, color: C.texte },

  echangeRang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  col: { alignItems: 'center', gap: 4, width: 110 },
  colLabel: { fontFamily: F.t700, fontSize: 11.5, color: C.texte3 },
  colNom: { fontFamily: F.t800, fontSize: 12.5, color: C.texte },
  colSous: { fontFamily: F.t600, fontSize: 10.5, color: C.texte3 },
  fleche: { alignItems: 'center', justifyContent: 'center' },
  flecheTxt: { fontFamily: F.titre, fontSize: 26, color: C.violetClair },
  neuf: { backgroundColor: C.vert, borderRadius: R.pill, paddingVertical: 2, paddingHorizontal: 8, marginTop: 1 },
  neufTxt: { fontFamily: F.t800, fontSize: 9.5, color: C.violetProfond },

  faitBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: C.vertPale, borderRadius: 10, paddingVertical: 10,
  },
  faitTxt: { fontFamily: F.t800, fontSize: 12.5, color: '#2E7D32' },
  vide: { fontFamily: F.t600, fontSize: 12.5, color: C.texte2, lineHeight: 18, textAlign: 'center' },
  aide: { fontFamily: F.t600, fontSize: 11, color: C.texte3, lineHeight: 15, textAlign: 'center' },

  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  dbl: { alignItems: 'center', gap: 3, width: 72 },
  dblBadge: {
    position: 'absolute', top: -4, right: 6, zIndex: 2,
    backgroundColor: C.violetClair, borderRadius: R.pill, paddingVertical: 1, paddingHorizontal: 6,
  },
  dblBadgeTxt: { fontFamily: F.t800, fontSize: 10, color: '#fff' },
  dblNom: { fontFamily: F.t700, fontSize: 10.5, color: C.texte },

  modalFond: { flex: 1, backgroundColor: 'rgba(42,29,70,0.6)', alignItems: 'center', justifyContent: 'center', padding: 26 },
  modalCarte: { backgroundColor: C.carte, borderRadius: 24, padding: 24, alignItems: 'center', gap: 10, alignSelf: 'stretch', ...OMBRE },
  modalTitre: { fontFamily: F.titre, fontSize: 22, color: C.violet },
  modalNom: { fontFamily: F.titre, fontSize: 20, color: C.violet },
  modalTexte: { fontFamily: F.t400, fontSize: 13.5, color: C.texte2, textAlign: 'center', lineHeight: 20 },
});
