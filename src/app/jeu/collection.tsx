// === Boba Quest — l'album de collection ===
// 24 collectibles en 4 sets. Compléter un set = un PRIX RÉEL (tampons, réduction,
// boisson). Les non-trouvés restent en silhouette « ? ». Tap = fiche du personnage.
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { BORD, C, F, R, OMBRE, OMBRE_VIOLETTE } from '@/constants/charte';
import PastilleCollectible from '@/components/jeu/collectibles';
import {
  achatsAvantRangGout, bonusGout, Collectible, COLLECTIBLES, collectiblesDuSet, deblocageDe,
  DOUBLON_PERLES,
  effetBuddy, Gain, GOUT_ACHATS_PAR_RANG, GOUT_BONUS_PCT, GOUT_MAX, GOUT_RANG_MARQUE,
  GOUT_RANG_MUNITION, NIVEAU_CARTE_BONUS_PCT, NIVEAU_CARTE_MAX, optionsTalent, PALIERS_TALENT,
  rangGout, RARETES, RECOMPENSE_COLLECTION, REFORGE_TALENT_ECLATS, SETS, SetId,
  titresExploits, trouverCollectible,
  type ChoixTalentsCarte, type PalierTalent,
} from '@/components/jeu/economie';
import { Icone, IconeEmoji } from '@/components/jeu/icones';
import {
  BandeauPreview, BoutonJeu, ChipRarete, EnTeteJeu, formatNb,
} from '@/components/jeu/ui-jeu';
import {
  apercuEntrainement, choisirTalent, collectionComplete,
  definirBuddy, entrainerCarte, goutCarte, nbUniques, niveauCarte, passeportCollection,
  reclamerCollection, reclamerSet, reforgerTalent, setComplet, talentsEnAttente, useBobaQuest,
} from '@/store/jeu';
import { synchroniserAchatsJeu } from '@/lib/synchronisation-achats-jeu';
import { usePasseportServeur } from '@/lib/app-config';
import { commentDebloquer } from '@/lib/passeport-libelles';
import type { LigneAchat } from '@/components/jeu/economie';
import { hapticMoyen } from '@/lib/juice';

const ORDRE_SETS: SetId[] = ['milk', 'fruit', 'topping', 'signature'];

// 🎫 LE MENU D'UNE CARTE PAS ENCORE DÉBLOQUÉE — jamais un cadenas.
// « 🧋 Milk tea Taro 2/3 » invite, « verrouillé » punit : toute la différence est dans la
// formulation, et c'est une règle du projet, pas une préférence.
// Deux routes existent, et une seule phrase les rend toutes les deux :
//   · une boisson à commander → libellés produit de `lib/passeport-libelles.ts`, LUS,
//     jamais réécrits ici (un seul endroit connaît les noms du catalogue) ;
//   · la mascotte → les autres cartes à réunir, qui n'ont aucun libellé produit possible.
// `null` = la cible n'existe plus au catalogue (produit renommé) : on préfère ne rien
// dire plutôt qu'inviter à commander une boisson introuvable.
type MenuDeblocage = { emoji: string; texte: string; aria: string };

function menuDeblocage(carteId: string): MenuDeblocage | null {
  const d = deblocageDe(carteId);
  if (d.par === 'collection') {
    return {
      emoji: '🏆',
      texte: `Réunis les ${d.nb} autres cartes`,
      aria: `À débloquer en réunissant les ${d.nb} autres cartes`,
    };
  }
  const quoi = commentDebloquer(carteId);
  return quoi ? { emoji: '🧋', texte: quoi, aria: `À débloquer en achetant ${quoi}` } : null;
}

// 🩹 26/07 — délai avant que la re-forge « armée » se désarme d'elle-même : une
// demande de confirmation ne doit jamais rester en embuscade sous le doigt.
const REFORGE_CONFIRM_MS = 4000;

export default function CollectionScreen() {
  const insets = useSafeAreaInsets();
  const etat = useBobaQuest();
  const [fiche, setFiche] = useState<Collectible | null>(null);
  const [celebration, setCelebration] = useState<Gain | null>(null);
  // 🎖️ choix de talent en cours (ouvre la modale des 2 options du palier)
  const [choixTalent, setChoixTalent] = useState<{ carteId: string; palier: PalierTalent } | null>(null);

  // 🩹 26/07 — RE-FORGE EN 2 TAPS (pattern « tape encore pour confirmer » de tournee.tsx).
  // Un seul tap débitait REFORGE_TALENT_ECLATS éclats ET effaçait le talent choisi, sur
  // un bouton compact au bout d'une ligne dense dans une modale scrollable : le tap
  // accidentel était parfaitement plausible, et le choix perdu sans le moindre avis.
  // Clé = `carteId-palier` : une seule ligne peut être armée à la fois.
  const [reforgeArmee, setReforgeArmee] = useState<string | null>(null);
  const reforgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desarmerReforge = () => {
    if (reforgeTimer.current) { clearTimeout(reforgeTimer.current); reforgeTimer.current = null; }
    setReforgeArmee(null);
  };
  const armerReforge = (cle: string) => {
    if (reforgeTimer.current) clearTimeout(reforgeTimer.current);
    setReforgeArmee(cle);
    reforgeTimer.current = setTimeout(() => { reforgeTimer.current = null; setReforgeArmee(null); }, REFORGE_CONFIRM_MS);
  };
  // pas de setState après démontage, et fermer la fiche désarme toujours
  useEffect(() => () => { if (reforgeTimer.current) clearTimeout(reforgeTimer.current); }, []);
  const fermerFiche = () => { desarmerReforge(); setFiche(null); };

  // 🎫 Le layout du jeu synchronise déjà les achats automatiquement. L'album demande
  // le même cache partagé pour afficher les compteurs détaillés ; aucune seconde logique
  // d'octroi ne vit ici et une lecture réseau ratée ne retire jamais rien.
  // 🚦 L'interrupteur du Passeport est SERVEUR (`app_config`, clé `passeport_carte`) :
  // ce hook le relit à chaque retour sur l'écran et le pousse dans le store, d'où le
  // reste du jeu (les capsules, notamment) le lira. Aucune requête ne bloque le rendu :
  // hors ligne, on garde le cache du démarrage, et sans cache le défaut compilé (false).
  const passeportServeur = usePasseportServeur();
  const [achats, setAchats] = useState<LigneAchat[]>([]);
  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const resultat = await synchroniserAchatsJeu();
        if (!vivant) return;
        setAchats(resultat.historique);
      } catch { /* hors ligne, ou table pas encore alimentée : on n'affiche rien de plus */ }
    })();
    return () => { vivant = false; };
  }, []);
  const passeport = passeportCollection(achats, etat);

  const uniques = nbUniques(etat);
  const complete = collectionComplete(etat);
  // 🎖️ cartes ayant un palier de talent atteint sans choix → badge sur la case album
  const enAttente = new Set(talentsEnAttente(etat));

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
            {/* Passeport actif : on l'annonce en premier et positivement — c'est une
                façon d'obtenir des cartes qui s'AJOUTE au comptoir, pas une restriction
                dont on s'excuse. */}
            {passeportServeur.actif
              ? 'Les cartes se débloquent au comptoir : commande la boisson, prends la carte. '
              : ''}
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
                  // 🏅 palmarès : badge discret sur les cartes qui ont des titres
                  const ex = etat.exploits[m.id];
                  const nbTitres = ex ? titresExploits(ex).length : 0;
                  // 👅 Goût au maximum → liseré doré. Purement cosmétique : la puissance
                  // du rang est déjà appliquée en combat (economie.ts → arene.ts).
                  const goutMax = n > 0 && goutCarte(m.id, etat) >= GOUT_MAX;
                  return (
                    <Pressable
                      key={m.id}
                      style={styles.casePerso}
                      onPress={() => n > 0 && setFiche(m)}
                    >
                      {n > 1 && (
                        <View style={styles.badgeNb}><Text style={styles.badgeNbTxt}>×{n}</Text></View>
                      )}
                      {n > 0 && nbTitres > 0 && (
                        <View style={styles.badgeTitres}><Text style={styles.badgeTitresTxt}>🏅{nbTitres}</Text></View>
                      )}
                      {n > 0 && enAttente.has(m.id) && (
                        <View style={styles.badgeTalent}><Text style={styles.badgeTalentTxt}>🎖️!</Text></View>
                      )}
                      {/* cadre TOUJOURS présent (bordure transparente au repos) : le
                          liseré doré ne doit décaler aucune case de la grille. */}
                      <View style={[styles.pastilleCadre, goutMax && styles.pastilleDoree]}>
                        <PastilleCollectible id={m.id} taille={74} cache={n === 0} />
                      </View>
                      <Text style={[styles.persoNom, n === 0 && { color: C.texte3 }]} numberOfLines={1}>
                        {n > 0 ? m.nom : '???'}
                      </Text>
                      {/* 🎫 Carte encore à débloquer : on montre le MENU, pas un cadenas.
                          « encore 2 Milk tea Taro » invite ; « verrouillé » punit.
                          La mascotte affiche sa propre route (« Réunis les 23 autres
                          cartes ») — une carte sans boisson n'est pas une carte muette. */}
                      {n === 0 && !passeport[m.id]?.parJeu && (() => {
                        const p = passeport[m.id];
                        const menu = menuDeblocage(m.id);
                        if (!p || !menu) return null;
                        return (
                          <Text style={styles.passeportIndice} numberOfLines={2}
                            accessibilityLabel={`${menu.aria}, ${p.faits} sur ${p.requis}`}>
                            {menu.emoji} {menu.texte}{p.requis > 1 ? `  ${p.faits}/${p.requis}` : ''}
                          </Text>
                        );
                      })()}
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
      <Modal visible={!!fiche} transparent animationType="fade" onRequestClose={fermerFiche}>
        {fiche && (
          <Pressable style={styles.modalFond} onPress={fermerFiche}>
            <Pressable
              style={[
                styles.ficheCarte, { maxHeight: '100%' },
                // 👅 liseré doré : la carte est au Goût maximum
                goutCarte(fiche.id, etat) >= GOUT_MAX && styles.ficheCarteDoree,
              ]}
              onPress={() => {}}
            >
              <ScrollView style={{ alignSelf: 'stretch' }} contentContainerStyle={{ alignItems: 'center', gap: 10 }} showsVerticalScrollIndicator={false}>
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
              {/* 👅 GOÛT (LOT E) : la carte évolue avec ce que le client boit VRAIMENT.
                  Jamais un cadenas, toujours un menu — un Goût 0 se joue très bien, ce
                  n'est qu'une invitation à passer. Le rang affiché est celui du STORE
                  (monotone, persisté) ; l'historique lu ne sert qu'au « encore N ». */}
              {(() => {
                // Une carte sans cible produit (les 6 Milk Tea, Flantastique, Bubble
                // Master) n'a AUCUN moyen de faire monter son Goût : lui coller une jauge
                // « 0/5 » qu'elle ne remplira jamais serait un cadenas déguisé. On dit ce
                // qu'elle est, positivement, et on passe. La source est `parJeu` (store),
                // pas l'absence de libellé — un produit renommé au catalogue ne doit pas
                // faire passer une carte payante pour une carte gratuite.
                if (passeport[fiche.id]?.parJeu) {
                  return (
                    <View style={styles.gout}>
                      <Text style={styles.goutAide}>
                        👅 Pas de boisson à son nom sur la carte : {fiche.nom} joue à son
                        plein potentiel telle quelle, sans rien avoir à commander.
                      </Text>
                    </View>
                  );
                }
                // 🏆 La mascotte : pas de produit non plus, mais elle n'est PAS gratuite
                // pour autant — elle se réunit. La fiche ne s'ouvre que sur une carte
                // POSSÉDÉE : à ce stade la jauge « x/23 » n'a plus rien à dire, on
                // explique donc simplement pourquoi elle n'a pas de Goût. La progression,
                // elle, est portée par la case de l'album, là où elle sert encore.
                const deblocage = deblocageDe(fiche.id);
                if (deblocage.par === 'collection') {
                  return (
                    <View style={styles.gout}>
                      <Text style={styles.goutAide}>
                        🏆 Aucune boisson ne porte son nom : {fiche.nom} se mérite en
                        réunissant les {deblocage.nb} autres cartes. Elle joue à son plein
                        potentiel telle quelle.
                      </Text>
                    </View>
                  );
                }
                // libellés produits : passeport-libelles.ts, jamais réécrits ici.
                // `null` = l'id n'existe plus au catalogue → on affiche la jauge sans menu.
                const menu = commentDebloquer(fiche.id);
                const rang = goutCarte(fiche.id, etat);
                const bonus = bonusGout(rang);
                // l'historique fraîchement lu confirme-t-il le rang persisté ? sinon
                // (lecture ratée, rétention serveur) on se tait plutôt que de mentir.
                const aJour = rangGout(fiche.id, achats) === rang;
                const restant = aJour ? achatsAvantRangGout(fiche.id, achats) : 0;
                return (
                  <View style={[styles.gout, rang >= GOUT_MAX && styles.goutDore]}>
                    <View style={styles.goutHaut}>
                      <Text style={styles.goutTitre}>👅 Goût {rang}/{GOUT_MAX}</Text>
                      <Text style={styles.goutBonus}>
                        {bonus.pvPct > 0 ? `+${bonus.pvPct} % PV & ATQ` : 'stats de base'}
                      </Text>
                    </View>
                    <View
                      style={styles.goutJauge}
                      accessibilityRole="progressbar"
                      accessibilityLabel={`Goût ${rang} sur ${GOUT_MAX}`}
                    >
                      {Array.from({ length: GOUT_MAX }, (_, i) => (
                        <View key={i} style={[styles.goutCran, i < rang && styles.goutCranPlein]} />
                      ))}
                    </View>
                    {/* la MÊME phrase-menu que la case de l'album : un seul libellé produit */}
                    {menu && <Text style={styles.goutAide}>🧋 {menu}</Text>}
                    {rang >= GOUT_MAX ? (
                      <Text style={styles.goutPerk}>
                        Goût au maximum — cette carte connaît ta commande par cœur.
                      </Text>
                    ) : (
                      <Text style={styles.goutAide}>
                        {restant > 0 ? `Encore ${restant} pour le Goût ${rang + 1} · ` : ''}
                        {GOUT_ACHATS_PAR_RANG} boissons = +1 Goût, +{GOUT_BONUS_PCT} % PV & ATQ
                        par rang jusqu'au Goût {GOUT_MAX}.
                      </Text>
                    )}
                    {bonus.speBonus > 0 && (
                      <Text style={styles.goutPerk}>
                        🥤 +{bonus.speBonus} munition de Spé (Goût {GOUT_RANG_MUNITION})
                      </Text>
                    )}
                    {bonus.marqueBonus > 0 && (
                      <Text style={styles.goutPerk}>
                        ✨ Marque de famille +{bonus.marqueBonus} action (Goût {GOUT_RANG_MARQUE})
                      </Text>
                    )}
                  </View>
                );
              })()}
              {/* 💪 Entraînement : niveau de la carte + bouton (la VRAIE réponse aux paliers) */}
              {(() => {
                const a = apercuEntrainement(fiche.id, etat);
                const bonus = (a.niveau - 1) * NIVEAU_CARTE_BONUS_PCT;
                return (
                  <View style={styles.entrainement}>
                    <View style={styles.entraineHaut}>
                      <Text style={styles.entraineNiveau}>Niveau {a.niveau}/{NIVEAU_CARTE_MAX}</Text>
                      <Text style={styles.entraineBonus}>{bonus > 0 ? `+${bonus} % PV & ATQ` : 'stats de base'}</Text>
                    </View>
                    <View style={styles.entraineBarre}>
                      <View style={[styles.entraineRempli, { width: `${(a.niveau / NIVEAU_CARTE_MAX) * 100}%` }]} />
                    </View>
                    {a.max ? (
                      <Text style={styles.entraineAide}>Niveau maximum atteint — champion absolu !</Text>
                    ) : (
                      <>
                        <Pressable
                          style={[styles.entraineBtn, !a.possible && { opacity: 0.45 }]}
                          disabled={!a.possible}
                          onPress={() => { const r = entrainerCarte(fiche.id); if (r.ok) hapticMoyen(); }}
                        >
                          {/* 🩹 26/07 : le libellé opposait doublons OU éclats alors que le
                              paiement est MIXTE (min(requis, dispo) doublons + le reste en
                              éclats). Un joueur avec 2 doublons sur 3 requis lisait
                              « + 40 éclats » et se faisait aussi prendre ses 2 doublons. */}
                          <Text style={styles.entraineBtnTxt}>
                            Entraîner — {formatNb(a.cout)} perles
                            {a.doublonsConsommes > 0
                              ? ` + ${a.doublonsConsommes} doublon${a.doublonsConsommes > 1 ? 's' : ''}`
                              : ''}
                            {a.eclatsJoker > 0 ? ` + ${a.eclatsJoker} éclats` : ''}
                          </Text>
                        </Pressable>
                        <Text style={styles.entraineAide}>
                          {a.bloque === 'perles' ? 'Pas assez de perles — joue pour en gagner !'
                            : a.bloque === 'doublons' ? `Palier d'évolution : il faut ${a.doublonsRequis} doublon${a.doublonsRequis > 1 ? 's' : ''} de cette carte (ou des éclats de la forge).`
                              : `+${NIVEAU_CARTE_BONUS_PCT} % PV & ATQ par niveau · évolutions aux niveaux 4, 7 et 10`}
                        </Text>
                      </>
                    )}
                  </View>
                );
              })()}
              {/* 🎖️ Talents : 1 choix parmi 2 aux niveaux 4, 7 et 10 (re-forge = éclats) */}
              {(() => {
                const n = niveauCarte(fiche.id, etat);
                const choix = etat.talentsCartes[fiche.id];
                return (
                  <View style={styles.talents}>
                    <View style={styles.talentsHaut}>
                      <IconeEmoji emoji="🎖️" taille={15} />
                      <Text style={styles.talentsTitre}>Talents</Text>
                    </View>
                    {PALIERS_TALENT.map((palier) => {
                      const options = optionsTalent(fiche.id, palier);
                      if (!options) return null;
                      const lettre = choix?.[`p${palier}` as keyof ChoixTalentsCarte];
                      if (n < palier) {
                        return (
                          <View key={palier} style={[styles.talentLigne, { opacity: 0.5 }]}>
                            <Icone nom="cadenas" taille={13} />
                            <Text style={styles.talentVerrouille}>
                              Palier {palier} — entraîne la carte jusqu'au niveau {palier}
                            </Text>
                          </View>
                        );
                      }
                      if (!lettre) {
                        return (
                          <Pressable
                            key={palier}
                            style={styles.talentAChoisir}
                            onPress={() => setChoixTalent({ carteId: fiche.id, palier })}
                            accessibilityRole="button"
                            accessibilityLabel={`Choisir le talent du palier ${palier}`}
                          >
                            <Text style={styles.talentAChoisirTxt}>🎖️ Palier {palier} — choisir un talent !</Text>
                          </Pressable>
                        );
                      }
                      const opt = options[lettre === 'a' ? 0 : 1];
                      // 🩹 26/07 — re-forge armée puis confirmée (voir armerReforge)
                      const cleReforge = `${fiche.id}-${palier}`;
                      const armee = reforgeArmee === cleReforge;
                      return (
                        <View key={palier} style={styles.talentBloc}>
                          <View style={styles.talentLigne}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.talentNom}>Palier {palier} · {opt.nom}</Text>
                              <Text style={styles.talentDesc}>{opt.desc}</Text>
                            </View>
                            <Pressable
                              style={[
                                styles.reforgeBtn,
                                armee && styles.reforgeBtnArmee,
                                etat.eclats < REFORGE_TALENT_ECLATS && { opacity: 0.45 },
                              ]}
                              disabled={etat.eclats < REFORGE_TALENT_ECLATS}
                              onPress={() => {
                                if (!armee) { armerReforge(cleReforge); return; }
                                desarmerReforge();
                                if (reforgerTalent(fiche.id, palier)) hapticMoyen();
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={armee
                                ? `Confirmer la re-forge du palier ${palier} : ${REFORGE_TALENT_ECLATS} éclats et perte du talent ${opt.nom}`
                                : `Re-forger le talent du palier ${palier} pour ${REFORGE_TALENT_ECLATS} éclats`}
                              accessibilityHint={armee ? undefined : 'Une confirmation te sera demandée avant de dépenser tes éclats.'}
                            >
                              <Text style={[styles.reforgeBtnTxt, armee && styles.reforgeBtnTxtArmee]}>
                                {armee ? 'Confirmer' : `Re-forge · ${REFORGE_TALENT_ECLATS}🔹`}
                              </Text>
                            </Pressable>
                          </View>
                          {armee && (
                            <Text style={styles.reforgeAvertit}>
                              Re-forger efface « {opt.nom} » et coûte {formatNb(REFORGE_TALENT_ECLATS)} éclats —
                              tape encore pour confirmer.
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                );
              })()}
              {/* 🏅 Exploits : le palmarès de CETTE carte (arène, tournoi, boss, duels) */}
              {(() => {
                const ex = etat.exploits[fiche.id];
                const titres = ex ? titresExploits(ex) : [];
                return (
                  <View style={styles.exploits}>
                    <View style={styles.exploitsHaut}>
                      <Icone nom="trophee" taille={15} />
                      <Text style={styles.exploitsTitre}>Exploits</Text>
                    </View>
                    <View style={styles.exploitsGrille}>
                      <View style={styles.exploitsStat}>
                        <Text style={styles.exploitsValeur}>{formatNb(ex?.ko ?? 0)}</Text>
                        <Text style={styles.exploitsLabel}>K.O.</Text>
                      </View>
                      <View style={styles.exploitsStat}>
                        <Text style={styles.exploitsValeur}>{formatNb(ex?.victoires ?? 0)}</Text>
                        <Text style={styles.exploitsLabel}>Victoires</Text>
                      </View>
                      <View style={styles.exploitsStat}>
                        <Text style={styles.exploitsValeur}>{formatNb(ex?.parfaits ?? 0)}</Text>
                        <Text style={styles.exploitsLabel}>Parfaits</Text>
                      </View>
                      <View style={styles.exploitsStat}>
                        <Text style={styles.exploitsValeur}>{formatNb(ex?.plusGrosCoup ?? 0)}</Text>
                        <Text style={styles.exploitsLabel}>Plus gros coup</Text>
                      </View>
                    </View>
                    {titres.length > 0 ? (
                      <View style={styles.exploitsChips}>
                        {titres.map((t) => (
                          <View key={t} style={styles.exploitsChip}><Text style={styles.exploitsChipTxt}>{t}</Text></View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.exploitsInvite}>Fais combattre cette carte pour écrire son histoire.</Text>
                    )}
                  </View>
                );
              })()}
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
              <BoutonJeu titre="Fermer" onPress={fermerFiche} style={{ alignSelf: 'stretch' }} />
              </ScrollView>
            </Pressable>
          </Pressable>
        )}
      </Modal>

      {/* 🎖️ Choix d'un talent (2 options, choix définitif — re-forge contre éclats) */}
      <Modal visible={!!choixTalent} transparent animationType="fade" onRequestClose={() => setChoixTalent(null)}>
        {choixTalent && (() => {
          const options = optionsTalent(choixTalent.carteId, choixTalent.palier);
          const meta = trouverCollectible(choixTalent.carteId);
          if (!options || !meta) return null;
          return (
            <Pressable style={styles.modalFond} onPress={() => setChoixTalent(null)}>
              <Pressable style={styles.ficheCarte} onPress={() => {}}>
                <PastilleCollectible id={choixTalent.carteId} taille={84} />
                <Text style={styles.ficheNom}>Talent · palier {choixTalent.palier}</Text>
                <Text style={styles.fichePhrase}>
                  Un seul choix pour {meta.nom} — les deux options sont bonnes, suis ton style !
                </Text>
                {options.map((opt, i) => (
                  <Pressable
                    key={opt.effet + i}
                    style={({ pressed }) => [styles.optionTalent, pressed && { transform: [{ scale: 0.98 }] }]}
                    onPress={() => {
                      if (choisirTalent(choixTalent.carteId, choixTalent.palier, i === 0 ? 'a' : 'b')) {
                        hapticMoyen();
                        setChoixTalent(null);
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Choisir ${opt.nom}`}
                  >
                    <Text style={styles.optionTalentNom}>{opt.nom}</Text>
                    <Text style={styles.optionTalentDesc}>{opt.desc}</Text>
                  </Pressable>
                ))}
                <BoutonJeu titre="Plus tard" onPress={() => setChoixTalent(null)} style={{ alignSelf: 'stretch' }} />
              </Pressable>
            </Pressable>
          );
        })()}
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

  progCarte: { backgroundColor: C.violet, borderRadius: R.carte, padding: 18, gap: 10, ...OMBRE_VIOLETTE },
  progHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progTitre: { fontFamily: F.titre, fontSize: 18, color: '#fff' },
  progNb: { fontFamily: F.t800, fontSize: 16, color: C.jaune },
  progBarre: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  progRempli: { height: 10, borderRadius: 5, backgroundColor: C.vert },
  progAide: { fontFamily: F.t600, fontSize: 12.5, color: C.lavande, lineHeight: 18 },

  setCarte: { backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 12, borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE },
  setHaut: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  setEmoji: { fontSize: 26 },
  setNom: { fontFamily: F.t800, fontSize: 16, color: C.texte },
  setProg: { fontFamily: F.t600, fontSize: 12, color: C.texte2, marginTop: 1 },

  grilleSet: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  casePerso: { width: '30%', alignItems: 'center', gap: 5 },
  passeportIndice: {
    fontFamily: F.t600, fontSize: 9.5, lineHeight: 12, color: '#8A2B51',
    textAlign: 'center', marginTop: 1,
  },
  persoNom: { fontFamily: F.t700, fontSize: 12, color: C.texte },
  // 👅 cadre du portrait : bordure transparente au repos → le liseré doré du Goût
  // maximum s'allume sans jamais décaler la grille.
  pastilleCadre: { borderRadius: R.pill, borderWidth: 2.5, borderColor: 'transparent', padding: 2 },
  pastilleDoree: { borderColor: C.jaune, backgroundColor: C.jaunePale },
  badgeNb: {
    position: 'absolute', top: -4, right: 2, zIndex: 2,
    backgroundColor: C.violetClair, borderRadius: R.pill,
    paddingVertical: 2, paddingHorizontal: 7,
  },
  badgeNbTxt: { fontFamily: F.t800, fontSize: 10.5, color: '#fff' },
  badgeTitres: {
    position: 'absolute', top: -4, left: 2, zIndex: 2,
    backgroundColor: C.jaunePale, borderRadius: R.pill,
    paddingVertical: 2, paddingHorizontal: 6,
    borderWidth: 1, borderColor: '#E8C84A',
  },
  badgeTitresTxt: { fontFamily: F.t800, fontSize: 9.5, color: '#9A6B00' },
  badgeTalent: {
    position: 'absolute', bottom: 16, right: 2, zIndex: 2,
    backgroundColor: C.violet, borderRadius: R.pill,
    paddingVertical: 2, paddingHorizontal: 6,
  },
  badgeTalentTxt: { fontFamily: F.t800, fontSize: 9.5, color: '#fff' },

  // 🎖️ talents de la carte (fiche)
  talents: {
    alignSelf: 'stretch', backgroundColor: C.carte, borderRadius: 16, padding: 12, gap: 8,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc,
  },
  talentsHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  talentsTitre: { fontFamily: F.titre, fontSize: 15, color: C.violet },
  talentLigne: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  talentVerrouille: { fontFamily: F.t600, fontSize: 11.5, color: C.texte3, flex: 1, lineHeight: 16 },
  talentAChoisir: {
    backgroundColor: C.jaunePale, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12,
    borderWidth: 1.5, borderColor: '#E8C84A', alignItems: 'center',
  },
  talentAChoisirTxt: { fontFamily: F.t800, fontSize: 12.5, color: '#9A6B00' },
  talentNom: { fontFamily: F.t800, fontSize: 12.5, color: C.texte },
  talentDesc: { fontFamily: F.t600, fontSize: 11, color: C.texte2, lineHeight: 15 },
  reforgeBtn: {
    backgroundColor: C.lavande, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8,
  },
  reforgeBtnTxt: { fontFamily: F.t800, fontSize: 10.5, color: C.violetProfond },
  // 🩹 26/07 : état « armé » de la re-forge — le second tap est destructif, il le dit
  talentBloc: { gap: 5 },
  reforgeBtnArmee: { backgroundColor: C.danger },
  reforgeBtnTxtArmee: { color: '#fff' },
  reforgeAvertit: { fontFamily: F.t700, fontSize: 10.5, color: C.danger, lineHeight: 14 },
  optionTalent: {
    alignSelf: 'stretch', backgroundColor: C.fond, borderRadius: 14, padding: 13, gap: 3,
    borderWidth: 2, borderColor: C.violetClair,
  },
  optionTalentNom: { fontFamily: F.t800, fontSize: 14.5, color: C.violet, textAlign: 'center' },
  optionTalentDesc: { fontFamily: F.t600, fontSize: 12, color: C.texte2, textAlign: 'center', lineHeight: 17 },

  // 🏅 palmarès de la carte (fiche)
  exploits: {
    alignSelf: 'stretch', backgroundColor: C.carte, borderRadius: 16, padding: 12, gap: 9,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc,
  },
  exploitsHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  exploitsTitre: { fontFamily: F.titre, fontSize: 15, color: C.violet },
  exploitsGrille: { flexDirection: 'row', justifyContent: 'space-between' },
  exploitsStat: { alignItems: 'center', flex: 1 },
  exploitsValeur: { fontFamily: F.t800, fontSize: 15, color: C.texte },
  exploitsLabel: { fontFamily: F.t600, fontSize: 10, color: C.texte3, marginTop: 1 },
  exploitsChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  exploitsChip: { backgroundColor: C.jaunePale, borderRadius: R.pill, paddingVertical: 3, paddingHorizontal: 9 },
  exploitsChipTxt: { fontFamily: F.t800, fontSize: 11, color: '#9A6B00' },
  exploitsInvite: { fontFamily: F.t600, fontSize: 11.5, color: C.texte3, textAlign: 'center', lineHeight: 16 },

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
    alignItems: 'center', gap: 10, alignSelf: 'stretch', borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  ficheCarteDoree: { borderColor: C.jaune },
  ficheNom: { fontFamily: F.titre, fontSize: 23, color: C.violet },

  // 👅 Goût de la carte (fiche) — même gabarit que le bloc « entraînement »
  gout: {
    alignSelf: 'stretch', backgroundColor: C.fond, borderRadius: 16, padding: 12, gap: 8,
    borderWidth: 1, borderColor: C.bord,
  },
  goutDore: { borderWidth: 2, borderColor: C.jaune, backgroundColor: C.jaunePale },
  goutHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goutTitre: { fontFamily: F.t800, fontSize: 13.5, color: C.violet },
  goutBonus: { fontFamily: F.t700, fontSize: 12, color: C.vertFonce },
  goutJauge: { flexDirection: 'row', gap: 5 },
  goutCran: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.lavande },
  goutCranPlein: { backgroundColor: C.jaune },
  goutAide: { fontFamily: F.t600, fontSize: 11, color: C.texte3, lineHeight: 15 },
  goutPerk: { fontFamily: F.t700, fontSize: 11.5, color: C.texte2, lineHeight: 15 },
  chipSet: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 10 },
  chipSetTxt: { fontFamily: F.t700, fontSize: 12 },
  fichePhrase: { fontFamily: F.t400, fontSize: 13.5, color: C.texte2, textAlign: 'center', fontStyle: 'italic', lineHeight: 19 },
  ficheInfos: { fontFamily: F.t600, fontSize: 12.5, color: C.texte3 },

  // 💪 entraînement
  entrainement: {
    alignSelf: 'stretch', backgroundColor: C.fond, borderRadius: 16, padding: 12, gap: 8,
    borderWidth: 1, borderColor: C.bord,
  },
  entraineHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  entraineNiveau: { fontFamily: F.t800, fontSize: 13.5, color: C.violet },
  entraineBonus: { fontFamily: F.t700, fontSize: 12, color: C.vertFonce },
  entraineBarre: { height: 8, borderRadius: 4, backgroundColor: C.lavande, overflow: 'hidden' },
  entraineRempli: { height: 8, borderRadius: 4, backgroundColor: C.vert },
  entraineBtn: {
    backgroundColor: C.vert, borderRadius: R.btn, borderBottomWidth: 4, borderBottomColor: '#6F8F1F',
    paddingVertical: 10, alignItems: 'center',
  },
  entraineBtnTxt: { fontFamily: F.titre, fontSize: 14, color: '#2C380C' },
  entraineAide: { fontFamily: F.t600, fontSize: 11, color: C.texte3, lineHeight: 15 },
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
