// === Boba Quest — l'album de collection ===
// 24 collectibles en 4 sets. Compléter un set = un PRIX RÉEL (tampons, réduction,
// boisson). Les non-trouvés restent en silhouette « ? ». Tap = fiche du personnage.
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { C, F, R, OMBRE } from '@/constants/charte';
import { FICHES, TypeAttaque } from '@/components/jeu/arene';
import PastilleCollectible from '@/components/jeu/collectibles';
import {
  Collectible, COLLECTIBLES, collectiblesDuSet, DOUBLON_PERLES, effetBuddy,
  MISSIONS_CARTES, passifDe, rangMaitrise, RARETES, RECOMPENSE_COLLECTION, SETS, SetId,
} from '@/components/jeu/economie';
import { Icone, IconeEmoji } from '@/components/jeu/icones';
import {
  BandeauPreview, BoutonJeu, ChipRarete, EnTeteJeu, formatNb,
} from '@/components/jeu/ui-jeu';
import {
  collectionComplete, definirBuddy, etatMissionCarte, etatVedetteHebdo, nbPrestige,
  nbUniques, prestigeComplet, reclamerCollection, reclamerMissionCarte,
  reclamerPrestige, reclamerSet, setComplet, terminerOnboardingJeu, useBobaQuest,
} from '@/store/jeu';

const ORDRE_SETS: SetId[] = ['milk', 'fruit', 'topping', 'signature'];
type Celebration = { titre: string; label: string; detail: string };
const LABEL_ATTAQUE: Record<TypeAttaque, string> = {
  degats: 'Dégâts', soin: 'Soin', bouclier: 'Bouclier', boost: 'Boost',
  etourdit: 'Étourdissement', double: 'Double frappe', zone: 'Zone',
};

function roleCombat(types: TypeAttaque[]): string {
  if (types.includes('soin')) return 'Soutien';
  if (types.includes('bouclier')) return 'Tank';
  if (types.includes('etourdit')) return 'Contrôle';
  if (types.includes('zone')) return 'Zone';
  if (types.includes('double')) return 'Multi-coup';
  if (types.includes('boost')) return 'Stratège';
  return 'Attaquant';
}

export default function CollectionScreen() {
  const insets = useSafeAreaInsets();
  const etat = useBobaQuest();
  const [fiche, setFiche] = useState<Collectible | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);

  const uniques = nbUniques(etat);
  const complete = collectionComplete(etat);
  const prestige = nbPrestige(etat);
  const vedette = etatVedetteHebdo(etat);

  useEffect(() => {
    terminerOnboardingJeu();
  }, []);

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
          <Text style={styles.progAide}>Maîtrise des doublons : ×2 Argent · ×3 Or · ×5 Holo — apparence uniquement, aucune statistique bonus.</Text>
        </View>

        {/* Carte vedette : objectif hebdomadaire lisible et borné à une récompense */}
        <View style={styles.vedetteCarte}>
          <PastilleCollectible
            id={vedette.collectible.id}
            taille={72}
            maitrise={rangMaitrise(etat.collection[vedette.collectible.id] || 0)}
            vedette
          />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.vedetteSur}>CARTE VEDETTE DE LA SEMAINE</Text>
            <Text style={styles.vedetteNom}>{vedette.collectible.nom}</Text>
            <Text style={styles.vedetteTexte}>Gagne un combat avec elle dans ton équipe : +300 perles, une seule fois cette semaine.</Text>
          </View>
          {vedette.recompenseRecuperee && <View style={styles.vedetteOk}><Icone nom="check" taille={16} /></View>}
        </View>

        {complete && (
          <View style={styles.prestigeCarte}>
            <View style={styles.progHaut}>
              <View style={styles.legendTitreRang}><Icone nom="couronne" taille={18} /><Text style={styles.prestigeTitre}>Album Prestige</Text></View>
              <Text style={styles.prestigeNb}>{prestige}/{COLLECTIBLES.length}</Text>
            </View>
            <View style={styles.prestigeBarre}>
              <View style={[styles.prestigeRempli, { width: `${(prestige / COLLECTIBLES.length) * 100}%` }]} />
            </View>
            <Text style={styles.prestigeTexte}>Après le 24/24, le premier nouveau doublon de chaque personnage débloque sa variante brillante.</Text>
            {prestigeComplet(etat) && !etat.prestigeReclame && (
              <BoutonJeu
                titre="Réclamer Boba Mythique · +3 000 perles"
                onPress={() => {
                  const perles = reclamerPrestige();
                  if (perles) setCelebration({ titre: 'ALBUM PRESTIGE COMPLET !', label: `+${formatNb(perles)} perles · titre Boba Mythique`, detail: 'Les 24 variantes brillantes sont réunies.' });
                }}
                style={{ alignSelf: 'stretch', backgroundColor: '#D2588A' }}
              />
            )}
            {etat.prestigeReclame && <Text style={styles.prestigeFini}>Titre « Boba Mythique » obtenu</Text>}
          </View>
        )}

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
                  const mission = etatMissionCarte(m.id, etat);
                  return (
                    <Pressable
                      key={m.id}
                      style={styles.casePerso}
                      onPress={() => n > 0 && setFiche(m)}
                      disabled={n === 0}
                      accessibilityRole="button"
                      accessibilityLabel={n > 0 ? `${m.nom}, obtenu ${n} fois` : `Personnage mystère ${membres.indexOf(m) + 1} sur 6, pas encore découvert`}
                      accessibilityState={{ disabled: n === 0 }}
                    >
                      {n > 1 && (
                        <View style={styles.badgeNb}><Text style={styles.badgeNbTxt}>×{n}</Text></View>
                      )}
                      <PastilleCollectible
                        id={m.id}
                        taille={74}
                        cache={n === 0}
                        maitrise={rangMaitrise(n)}
                        prestige={etat.prestige[m.id] === true}
                        vedette={vedette.collectible.id === m.id}
                      />
                      <Text style={[styles.persoNom, n === 0 && { color: C.texte3 }]} numberOfLines={1}>
                        {n > 0 ? m.nom : '???'}
                      </Text>
                      {n > 0 && mission.terminee && !mission.reclamee && <Text style={styles.missionPrete}>MISSION PRÊTE</Text>}
                    </Pressable>
                  );
                })}
              </View>

              {estComplet && !reclame && (
                <BoutonJeu
                  titre={`Set complet ! Réclamer : ${set.recompense.label}`}
                  onPress={() => {
                    const g = reclamerSet(setId);
                    if (g) setCelebration({ titre: 'PRIX GAGNÉ !', label: g.label, detail: 'Retrouve ce prix dans « Boutique des prix → Mes prix ».' });
                  }}
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
              onPress={() => {
                const g = reclamerCollection();
                if (g) setCelebration({ titre: 'BUBBLE LEGEND !', label: g.label, detail: 'Ta collection de base est complète. L’album Prestige est maintenant ouvert.' });
              }}
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
        {fiche && (() => {
          const nombre = etat.collection[fiche.id] || 0;
          const combat = FICHES[fiche.id];
          const passif = passifDe(fiche.id);
          const mission = MISSIONS_CARTES[fiche.id];
          const progression = etatMissionCarte(fiche.id, etat);
          const rang = rangMaitrise(nombre);
          return (
            <Pressable style={styles.modalFond} onPress={() => setFiche(null)}>
              <Pressable style={styles.ficheConteneur} onPress={() => {}}>
                <ScrollView contentContainerStyle={styles.ficheCarte} showsVerticalScrollIndicator={false}>
                  <PastilleCollectible
                    id={fiche.id}
                    taille={116}
                    maitrise={rang}
                    prestige={etat.prestige[fiche.id] === true}
                    vedette={vedette.collectible.id === fiche.id}
                  />
                  <Text style={styles.ficheNom}>{fiche.nom}</Text>
                  <View style={styles.chipsRang}>
                    <ChipRarete nom={RARETES[fiche.rarete].nom} couleur={RARETES[fiche.rarete].couleur} />
                    <View style={[styles.chipSet, { backgroundColor: SETS[fiche.set].fond }]}>
                      <IconeEmoji emoji={SETS[fiche.set].emoji} taille={14} />
                      <Text style={[styles.chipSetTxt, { color: SETS[fiche.set].couleur }]}>{SETS[fiche.set].nom}</Text>
                    </View>
                    <View style={styles.roleChip}><Text style={styles.roleChipTxt}>{roleCombat(combat.attaques.map((a) => a.type))}</Text></View>
                  </View>
                  <Text style={styles.fichePhrase}>« {fiche.phrase} »</Text>

                  <View style={styles.statsCombat}>
                    <StatCombat label="PV" valeur={combat.pv} />
                    <StatCombat label="ATQ" valeur={combat.atk} />
                    <StatCombat label="VIT" valeur={combat.vit} />
                  </View>
                  <View style={styles.attaquesBloc}>
                    {combat.attaques.map((attaque, index) => (
                      <View key={attaque.nom} style={styles.attaqueLigne}>
                        <Text style={styles.attaqueIndex}>{index === 0 ? 'BASE' : 'SPÉ'}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.attaqueNom}>{attaque.nom}</Text>
                          <Text style={styles.attaqueType}>{LABEL_ATTAQUE[attaque.type]} · puissance ×{attaque.puissance}</Text>
                        </View>
                      </View>
                    ))}
                    {passif && (
                      <View style={styles.passifLigne}>
                        <Icone nom="eclat" taille={16} />
                        <View style={{ flex: 1 }}><Text style={styles.passifNom}>{passif.nom}</Text><Text style={styles.passifDesc}>{passif.desc}</Text></View>
                      </View>
                    )}
                  </View>

                  <View style={styles.maitriseCarte}>
                    <Text style={styles.maitriseTitre}>Maîtrise {rang === 'holo' ? 'Holo' : rang === 'or' ? 'Or' : rang === 'argent' ? 'Argent' : 'Bronze'}</Text>
                    <Text style={styles.maitriseTexte}>Possédé ×{nombre} · prochains cadres : ×2 Argent, ×3 Or, ×5 Holo. Cosmétique uniquement.</Text>
                    {etat.prestige[fiche.id] && <Text style={styles.prestigeFini}>Variante Prestige brillante obtenue</Text>}
                  </View>

                  <View style={styles.missionCarte}>
                    <View style={styles.missionHaut}><Text style={styles.missionTitre}>Mission de {fiche.nom}</Text><Text style={styles.missionCompte}>{progression.progres}/{mission.cible}</Text></View>
                    <Text style={styles.missionTexte}>{mission.label}</Text>
                    <View style={styles.missionBarre}><View style={[styles.missionRempli, { width: `${(progression.progres / mission.cible) * 100}%` }]} /></View>
                    <Text style={styles.missionGain}>Récompense : +{formatNb(mission.recompensePerles)} perles</Text>
                    {progression.terminee && !progression.reclamee && (
                      <BoutonJeu
                        titre="Réclamer la mission"
                        onPress={() => {
                          const gain = reclamerMissionCarte(fiche.id);
                          if (gain) {
                            setFiche(null);
                            setCelebration({ titre: 'MISSION ACCOMPLIE !', label: `+${formatNb(gain)} perles`, detail: `${fiche.nom} maîtrise désormais son défi personnel.` });
                          }
                        }}
                        style={{ alignSelf: 'stretch', backgroundColor: C.vert }}
                      />
                    )}
                    {progression.reclamee && <Text style={styles.missionFaite}>Récompense récupérée</Text>}
                  </View>

                  <Text style={styles.ficheInfos}>Doublon = +{formatNb(DOUBLON_PERLES[fiche.rarete])} perles</Text>
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
                    <Text style={styles.buddyEffet}>Bonus Perle Rush : {effetBuddy(fiche.set, fiche.rarete).libelle}</Text>
                  </Pressable>
                  <BoutonJeu titre="Fermer" onPress={() => setFiche(null)} style={{ alignSelf: 'stretch' }} />
                </ScrollView>
              </Pressable>
            </Pressable>
          );
        })()}
      </Modal>

      {/* Célébration set complété */}
      <Modal visible={!!celebration} transparent animationType="fade" onRequestClose={() => setCelebration(null)}>
        {celebration && (
          <View style={styles.modalFond}>
            <View style={[styles.ficheCarte, { alignSelf: 'stretch' }]}>
              <Icone nom="cadeau" taille={46} />
              <Text style={styles.ficheNom}>{celebration.titre}</Text>
              <Text style={styles.celebLabel}>{celebration.label}</Text>
              <Text style={styles.fichePhrase}>{celebration.detail}</Text>
              <BoutonJeu titre="Génial !" onPress={() => setCelebration(null)} style={{ alignSelf: 'stretch' }} />
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

function StatCombat({ label, valeur }: { label: string; valeur: number }) {
  return (
    <View style={styles.statCombat}>
      <Text style={styles.statValeur}>{valeur}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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

  vedetteCarte: {
    backgroundColor: C.vertPale, borderRadius: R.carte, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 2, borderColor: C.vert, ...OMBRE,
  },
  vedetteSur: { fontFamily: F.t800, fontSize: 10, color: C.vertFonce, letterSpacing: 0.5 },
  vedetteNom: { fontFamily: F.titre, fontSize: 18, color: C.violet },
  vedetteTexte: { fontFamily: F.t600, fontSize: 11.5, lineHeight: 16, color: C.texte2 },
  vedetteOk: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.vert, alignItems: 'center', justifyContent: 'center' },

  prestigeCarte: { backgroundColor: '#FFF0F7', borderRadius: R.carte, padding: 16, gap: 10, borderWidth: 2, borderColor: '#D2588A', ...OMBRE },
  prestigeTitre: { fontFamily: F.titre, fontSize: 18, color: '#A83969' },
  prestigeNb: { fontFamily: F.t800, fontSize: 16, color: '#D2588A' },
  prestigeBarre: { height: 10, borderRadius: 5, backgroundColor: '#F6CEDF', overflow: 'hidden' },
  prestigeRempli: { height: 10, borderRadius: 5, backgroundColor: '#D2588A' },
  prestigeTexte: { fontFamily: F.t600, fontSize: 12.5, lineHeight: 18, color: C.texte2 },
  prestigeFini: { fontFamily: F.t800, fontSize: 12, color: '#A83969', textAlign: 'center' },

  setCarte: { backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 12, ...OMBRE },
  setHaut: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setEmoji: { fontSize: 26 },
  setNom: { fontFamily: F.t800, fontSize: 16, color: C.texte },
  setProg: { fontFamily: F.t600, fontSize: 12, color: C.texte2, marginTop: 1 },

  grilleSet: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  casePerso: { width: '30%', alignItems: 'center', gap: 5 },
  persoNom: { fontFamily: F.t700, fontSize: 12, color: C.texte },
  missionPrete: { fontFamily: F.t800, fontSize: 8.5, color: C.vertFonce },
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
  ficheConteneur: { alignSelf: 'stretch', maxHeight: '90%', borderRadius: 24, overflow: 'hidden' },
  ficheCarte: {
    backgroundColor: C.carte, borderRadius: 24, padding: 24,
    alignItems: 'center', gap: 10, ...OMBRE,
  },
  ficheNom: { fontFamily: F.titre, fontSize: 23, color: C.violet },
  chipSet: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 10 },
  chipSetTxt: { fontFamily: F.t700, fontSize: 12 },
  chipsRang: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  roleChip: { backgroundColor: C.violet, borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 10 },
  roleChipTxt: { fontFamily: F.t800, fontSize: 11, color: '#fff' },
  fichePhrase: { fontFamily: F.t400, fontSize: 13.5, color: C.texte2, textAlign: 'center', fontStyle: 'italic', lineHeight: 19 },
  ficheInfos: { fontFamily: F.t600, fontSize: 12.5, color: C.texte3 },
  celebLabel: { fontFamily: F.t800, fontSize: 16, color: C.vertFonce, textAlign: 'center' },

  statsCombat: { alignSelf: 'stretch', flexDirection: 'row', gap: 8 },
  statCombat: { flex: 1, alignItems: 'center', backgroundColor: C.fond, borderRadius: 12, paddingVertical: 8 },
  statValeur: { fontFamily: F.titre, fontSize: 18, color: C.violet },
  statLabel: { fontFamily: F.t800, fontSize: 9.5, color: C.texte3 },
  attaquesBloc: { alignSelf: 'stretch', gap: 7 },
  attaqueLigne: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.fond, borderRadius: 12, padding: 10 },
  attaqueIndex: { width: 36, fontFamily: F.t800, fontSize: 9.5, color: C.violetClair },
  attaqueNom: { fontFamily: F.t800, fontSize: 13, color: C.texte },
  attaqueType: { fontFamily: F.t600, fontSize: 10.5, color: C.texte3, marginTop: 1 },
  passifLigne: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.vertPale, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: C.vert },
  passifNom: { fontFamily: F.t800, fontSize: 12.5, color: C.vertFonce },
  passifDesc: { fontFamily: F.t600, fontSize: 11, color: C.texte2 },

  maitriseCarte: { alignSelf: 'stretch', backgroundColor: '#F4EFFA', borderRadius: 13, padding: 11, gap: 3 },
  maitriseTitre: { fontFamily: F.t800, fontSize: 13, color: C.violet },
  maitriseTexte: { fontFamily: F.t600, fontSize: 11, color: C.texte2, lineHeight: 16 },
  missionCarte: { alignSelf: 'stretch', backgroundColor: '#FFF8DC', borderRadius: 14, padding: 12, gap: 7, borderWidth: 1.5, borderColor: C.jaune },
  missionHaut: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  missionTitre: { flex: 1, fontFamily: F.t800, fontSize: 13, color: C.violetProfond },
  missionCompte: { fontFamily: F.t800, fontSize: 12, color: '#9A6B00' },
  missionTexte: { fontFamily: F.t600, fontSize: 11.5, color: C.texte2 },
  missionBarre: { height: 7, borderRadius: 4, backgroundColor: '#F3DE9A', overflow: 'hidden' },
  missionRempli: { height: 7, borderRadius: 4, backgroundColor: C.jaune },
  missionGain: { fontFamily: F.t700, fontSize: 10.5, color: '#9A6B00' },
  missionFaite: { fontFamily: F.t800, fontSize: 11.5, textAlign: 'center', color: C.vertFonce },

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
