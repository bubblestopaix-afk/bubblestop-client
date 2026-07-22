// === Boba Quest — DÉFIS D'AMIS (duels asynchrones, preview) ===
// Des amis ont défié ton équipe : tu relèves leurs défis quand tu veux, sans notif,
// tout t'attend ici. En preview : amis simulés + équipes stables. En version finale :
// vrais comptes, ton équipe se bat même hors-ligne, résultats en badge.
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';

import { BORD, C, F, R, OMBRE } from '@/constants/charte';
import PastilleCollectible from '@/components/jeu/collectibles';
import QrView from '@/components/qr-view';
import { equipeAmi } from '@/components/jeu/arene';
import { Icone } from '@/components/jeu/icones';
import { BandeauPreview, BoutonJeu, EnTeteJeu } from '@/components/jeu/ui-jeu';
import { defisEnAttente, useBobaQuest } from '@/store/jeu';

export default function DefisScreen() {
  const insets = useSafeAreaInsets();
  const etat = useBobaQuest();
  const enAttente = defisEnAttente(etat);
  const histo = etat.defis.historique;
  const [qrVisible, setQrVisible] = useState(false);

  return (
    <View style={[styles.fond, { paddingTop: insets.top + 10 }]}>
      <View style={{ paddingHorizontal: 18 }}>
        <EnTeteJeu titre="Défis d'amis" onRetour={() => router.back()} perles={etat.perles} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.pitch}>Des amis ont défié ton équipe. Relève leurs défis quand tu veux — aucune notif, tout t'attend ici.</Text>

        {/* === Défis reçus === */}
        <View style={styles.carte}>
          <View style={styles.titreRang}>
            <Icone nom="epee" taille={18} />
            <Text style={styles.carteTitre}>Défis reçus ({enAttente.length})</Text>
          </View>
          {enAttente.length ? enAttente.map((nom) => {
            const ids = equipeAmi(nom);
            return (
              <View key={nom} style={styles.defiLigne}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.amiNom}>{nom} t'a défié</Text>
                  <View style={styles.equipeRang}>
                    {ids.map((id) => <PastilleCollectible key={id} id={id} taille={34} />)}
                  </View>
                </View>
                <BoutonJeu
                  titre="Relever"
                  onPress={() => router.push(`/jeu/duel?mode=defi&ami=${encodeURIComponent(nom)}` as any)}
                  style={styles.releverBtn}
                />
              </View>
            );
          }) : (
            <Text style={styles.vide}>Tous les défis du jour sont relevés — beau boulot ! Reviens demain pour de nouveaux défis.</Text>
          )}
          <Text style={styles.aide}>Amis simulés (démo) · Une victoire rapporte des perles.</Text>
        </View>

        {/* === Défier un ami (QR) === */}
        <View style={styles.carte}>
          <View style={styles.titreRang}>
            <Icone nom="sac" taille={18} />
            <Text style={styles.carteTitre}>Défier un ami</Text>
          </View>
          <Pressable style={styles.qrBloc} onPress={() => setQrVisible(true)}>
            <QrView valeur="bubblestop://defi/demo" taille={132} />
          </Pressable>
          <Text style={styles.aide}>
            Bientôt : montre ce QR à un ami pour qu'il affronte ton équipe — même quand tu es hors-ligne.
            Le vainqueur gagne des perles, et tu retrouves le résultat ici, sans aucune notification.
          </Text>
        </View>

        {/* === Historique === */}
        {histo.length > 0 && (
          <View style={styles.carte}>
            <Text style={styles.carteTitre}>Derniers duels</Text>
            {histo.map((h, i) => (
              <View key={i} style={styles.histoLigne}>
                <Icone nom={h.gagne ? 'check' : 'triste'} taille={16} />
                <Text style={[styles.histoTxt, { color: h.gagne ? C.vertFonce : C.texte2 }]}>
                  {h.gagne ? 'Victoire' : 'Défaite'} contre {h.ami}
                </Text>
              </View>
            ))}
          </View>
        )}

        <BandeauPreview />
      </ScrollView>

      {/* QR agrandi */}
      <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
        <Pressable style={styles.modalFond} onPress={() => setQrVisible(false)}>
          <View style={styles.qrGrand}>
            <QrView valeur="bubblestop://defi/demo" taille={240} />
            <Text style={styles.qrGrandTxt}>Le défi par QR arrive prochainement.</Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  contenu: { padding: 18, gap: 14, paddingBottom: 34 },
  pitch: { fontFamily: F.t700, fontSize: 14, color: C.texte2, textAlign: 'center', lineHeight: 20 },

  carte: { backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 12, borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE },
  titreRang: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  carteTitre: { fontFamily: F.t800, fontSize: 16, color: C.texte },

  defiLigne: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.fond, borderRadius: 14, padding: 10 },
  amiNom: { fontFamily: F.t800, fontSize: 14, color: C.texte },
  equipeRang: { flexDirection: 'row', gap: 4, marginTop: 5 },
  releverBtn: { paddingVertical: 10, paddingHorizontal: 18, backgroundColor: C.vert },

  qrBloc: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14, alignSelf: 'center' },
  aide: { fontFamily: F.t600, fontSize: 11.5, color: C.texte3, lineHeight: 16, textAlign: 'center' },
  vide: { fontFamily: F.t600, fontSize: 12.5, color: C.texte2, lineHeight: 18, textAlign: 'center' },

  histoLigne: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  histoTxt: { fontFamily: F.t700, fontSize: 13 },

  modalFond: { flex: 1, backgroundColor: 'rgba(42,29,70,0.7)', alignItems: 'center', justifyContent: 'center', padding: 30 },
  qrGrand: { backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', gap: 14 },
  qrGrandTxt: { fontFamily: F.t600, fontSize: 12.5, color: C.texte2, textAlign: 'center' },
});
