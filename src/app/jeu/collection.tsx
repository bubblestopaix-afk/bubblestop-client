// === Boba Quest — l'album de collection ===
// 24 collectibles en 4 sets. Compléter un set = un PRIX RÉEL (tampons, réduction,
// boisson). Les non-trouvés restent en silhouette « ? ». Tap = fiche du personnage.
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { C, F, R, OMBRE } from '@/constants/charte';
import PastilleCollectible from '@/components/jeu/collectibles';
import {
  Collectible, COLLECTIBLES, collectiblesDuSet, DOUBLON_PERLES, effetBuddy,
  Gain, RARETES, RECOMPENSE_COLLECTION, SETS, SetId,
} from '@/components/jeu/economie';
import { Icone, IconeEmoji } from '@/components/jeu/icones';
import {
  BandeauPreview, BoutonJeu, ChipRarete, EnTeteJeu, formatNb,
} from '@/components/jeu/ui-jeu';
import {
  collectionComplete, definirBuddy, nbUniques, reclamerCollection, reclamerSet,
  setComplet, useBobaQuest,
} from '@/store/jeu';

const ORDRE_SETS: SetId[] = ['milk', 'fruit', 'topping', 'signature'];

export default function CollectionScreen() {
  const insets = useSafeAreaInsets();
  const etat = useBobaQuest();
  const [fiche, setFiche] = useState<Collectible | null>(null);
  const [celebration, setCelebration] = useState<Gain | null>(null);

  const uniques = nbUniques(etat);
  const complete = collectionComplete(etat);

  return (
    <View style={[styles.fond, { paddingTop: insets.top + 10 }]}>
      <View style={{ paddingHorizontal: 18 }}>
        <EnTeteJeu titre="Ma collection" onRetour={() => router.back()} perles={etat.perles} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu}>
        {/* Progression globale */}
        <View style={styles.progCarte}>
          <View style={styles.progHaut}>
            <Text style={styles.progTitre}>Boba Crew</Text>
            <Text style={styles.progNb}>{uniques}/{COLLECTIBLES.length}</Text>
          </View>
          <View style={styles.progBarre}>
            <View style={[styles.progRempli, { width: `${(uniques / COLLECTIBLES.length) * 100}%` }]} />
          </View>
          <Text style={styles.progAide}>
            Chaque set complété débloque un prix réel. Collection complète = {RECOMPENSE_COLLECTION.label.toLowerCase()} !
          </Text>
        </View>

        {/* Les 4 sets */}
        {ORDRE_SETS.map((setId) => {
          const set = SETS[setId];
          const membres = collectiblesDuSet(setId);
          const trouves = membres.filter((m) => (etat.collection[m.id] || 0) > 0).length;
          const estComplet = setComplet(setId, etat);
          const reclame = etat.setsReclames.includes(setId);
          return (
            <View key={setId} style={styles.setCarte}>
              <View style={styles.setHaut}>
                <IconeEmoji emoji={set.emoji} taille={28} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.setNom}>{set.nom}</Text>
                  <Text style={styles.setProg}>{trouves}/6 · récompense : {set.recompense.label}</Text>
                </View>
                <ChipRarete nom={RARETES[set.rarete].nom} couleur={RARETES[set.rarete].couleur} />
              </View>

              <View style={styles.grilleSet}>
                {membres.map((m) => {
                  const n = etat.collection[m.id] || 0;
                  return (
                    <Pressable
                      key={m.id}
                      style={styles.casePerso}
                      onPress={() => n > 0 && setFiche(m)}
                    >
                      {n > 1 && (
                        <View style={styles.badgeNb}><Text style={styles.badgeNbTxt}>×{n}</Text></View>
                      )}
                      <PastilleCollectible id={m.id} taille={74} cache={n === 0} />
                      <Text style={[styles.persoNom, n === 0 && { color: C.texte3 }]} numberOfLines={1}>
                        {n > 0 ? m.nom : '???'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {estComplet && !reclame && (
                <BoutonJeu
                  titre={`Set complet ! Réclamer : ${set.recompense.label}`}
                  onPress={() => { const g = reclamerSet(setId); if (g) setCelebration(g); }}
                  style={{ backgroundColor: C.vert }}
                />
              )}
              {reclame && (
                <View style={styles.reclame}>
                  <Icone nom="check" taille={15} />
                  <Text style={styles.reclameTxt}>Récompense du set récupérée</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Collection complète */}
        {complete && !etat.collectionReclamee && (
          <View style={[styles.setCarte, { borderWidth: 2, borderColor: '#F3A0BD' }]}>
            <View style={styles.legendTitreRang}><Icone nom="couronne" taille={20} /><Text style={styles.legendTitre}>COLLECTION COMPLÈTE !</Text></View>
            <BoutonJeu
              titre={`Réclamer : ${RECOMPENSE_COLLECTION.label}`}
              onPress={() => { const g = reclamerCollection(); if (g) setCelebration(g); }}
              style={{ backgroundColor: C.vert }}
            />
          </View>
        )}
        {etat.collectionReclamee && (
          <View style={styles.reclame}>
            <Icone nom="couronne" taille={15} />
            <Text style={styles.reclameTxt}>Bubble Legend — récompense ultime récupérée !</Text>
          </View>
        )}

        <BandeauPreview />
      </ScrollView>

      {/* Fiche d'un collectible */}
      <Modal visible={!!fiche} transparent animationType="fade" onRequestClose={() => setFiche(null)}>
        {fiche && (
          <Pressable style={styles.modalFond} onPress={() => setFiche(null)}>
            <Pressable style={styles.ficheCarte} onPress={() => {}}>
              <PastilleCollectible id={fiche.id} taille={120} />
              <Text style={styles.ficheNom}>{fiche.nom}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <ChipRarete nom={RARETES[fiche.rarete].nom} couleur={RARETES[fiche.rarete].couleur} />
                <View style={[styles.chipSet, { backgroundColor: SETS[fiche.set].fond }]}>
                  <IconeEmoji emoji={SETS[fiche.set].emoji} taille={14} />
                  <Text style={[styles.chipSetTxt, { color: SETS[fiche.set].couleur }]}>
                    {SETS[fiche.set].nom}
                  </Text>
                </View>
              </View>
              <Text style={styles.fichePhrase}>« {fiche.phrase} »</Text>
              <Text style={styles.ficheInfos}>
                Possédé ×{etat.collection[fiche.id] || 0} · doublon = +{formatNb(DOUBLON_PERLES[fiche.rarete])} perles
              </Text>
              {/* ⭐ Copain de tir : bonus passif dans le shooter (selon set + rareté) */}
              <Pressable
                style={[styles.buddyBtn, etat.buddyId === fiche.id && styles.buddyBtnActif]}
                onPress={() => definirBuddy(etat.buddyId === fiche.id ? null : fiche.id)}
              >
                <View style={styles.buddyBtnRang}>
                  <Icone nom="etoile" taille={14} />
                  <Text style={[styles.buddyBtnTxt, etat.buddyId === fiche.id && { color: C.vertFonce }]}>
                    {etat.buddyId === fiche.id ? 'Copain de tir actuel — retirer' : 'En faire mon copain de tir'}
                  </Text>
                </View>
                <Text style={styles.buddyEffet}>Bonus : {effetBuddy(fiche.set, fiche.rarete).libelle}</Text>
              </Pressable>
              <BoutonJeu titre="Fermer" onPress={() => setFiche(null)} style={{ alignSelf: 'stretch' }} />
            </Pressable>
          </Pressable>
        )}
      </Modal>

      {/* Célébration set complété */}
      <Modal visible={!!celebration} transparent animationType="fade" onRequestClose={() => setCelebration(null)}>
        {celebration && (
          <View style={styles.modalFond}>
            <View style={styles.ficheCarte}>
              <Icone nom="cadeau" taille={46} />
              <Text style={styles.ficheNom}>PRIX GAGNÉ !</Text>
              <Text style={styles.celebLabel}>{celebration.label}</Text>
              <Text style={styles.fichePhrase}>
                Retrouve ton prix dans « Boutique des prix → Mes prix » — en version
                finale il arrivera direct sur ta carte, à valider en caisse.
              </Text>
              <BoutonJeu titre="Génial !" onPress={() => setCelebration(null)} style={{ alignSelf: 'stretch' }} />
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

  progCarte: { backgroundColor: C.violet, borderRadius: R.carte, padding: 18, gap: 10, ...OMBRE },
  progHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progTitre: { fontFamily: F.titre, fontSize: 18, color: '#fff' },
  progNb: { fontFamily: F.t800, fontSize: 16, color: C.vert },
  progBarre: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  progRempli: { height: 10, borderRadius: 5, backgroundColor: C.vert },
  progAide: { fontFamily: F.t600, fontSize: 12.5, color: C.lavande, lineHeight: 18 },

  setCarte: { backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 12, ...OMBRE },
  setHaut: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setEmoji: { fontSize: 26 },
  setNom: { fontFamily: F.t800, fontSize: 16, color: C.texte },
  setProg: { fontFamily: F.t600, fontSize: 12, color: C.texte2, marginTop: 1 },

  grilleSet: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  casePerso: { width: '30%', alignItems: 'center', gap: 5 },
  persoNom: { fontFamily: F.t700, fontSize: 12, color: C.texte },
  badgeNb: {
    position: 'absolute', top: -4, right: 2, zIndex: 2,
    backgroundColor: C.violetClair, borderRadius: R.pill,
    paddingVertical: 2, paddingHorizontal: 7,
  },
  badgeNbTxt: { fontFamily: F.t800, fontSize: 10.5, color: '#fff' },

  reclame: {
    flexDirection: 'row', gap: 6, justifyContent: 'center',
    backgroundColor: C.vertPale, borderRadius: 12, paddingVertical: 10,
    alignItems: 'center', borderWidth: 1.5, borderColor: C.vert,
  },
  reclameTxt: { fontFamily: F.t700, fontSize: 13, color: C.vertFonce },

  legendTitre: { fontFamily: F.titre, fontSize: 18, color: '#D2588A', textAlign: 'center' },
  legendTitreRang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },

  modalFond: {
    flex: 1, backgroundColor: 'rgba(42,29,70,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  ficheCarte: {
    backgroundColor: C.carte, borderRadius: 24, padding: 24,
    alignItems: 'center', gap: 10, alignSelf: 'stretch', ...OMBRE,
  },
  ficheNom: { fontFamily: F.titre, fontSize: 23, color: C.violet },
  chipSet: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 10 },
  chipSetTxt: { fontFamily: F.t700, fontSize: 12 },
  fichePhrase: { fontFamily: F.t400, fontSize: 13.5, color: C.texte2, textAlign: 'center', fontStyle: 'italic', lineHeight: 19 },
  ficheInfos: { fontFamily: F.t600, fontSize: 12.5, color: C.texte3 },
  celebLabel: { fontFamily: F.t800, fontSize: 16, color: C.vertFonce, textAlign: 'center' },

  buddyBtn: {
    alignSelf: 'stretch', alignItems: 'center', gap: 2,
    backgroundColor: C.lavande, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  buddyBtnActif: { backgroundColor: C.vertPale, borderColor: C.vert },
  buddyBtnRang: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  buddyBtnTxt: { fontFamily: F.t800, fontSize: 13.5, color: C.violetProfond },
  buddyEffet: { fontFamily: F.t600, fontSize: 12, color: C.texte2 },
});
