// === Boba Quest — hub du jeu ===
// Solde de perles, Aventure (niveaux), défis du jour, Infini, Capsules,
// Collection, Roulette du mois, Boutique des prix, Troc (bientôt).
import { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { C, F, R, OMBRE } from '@/constants/charte';
import { BoutonRetour } from '@/components/ui-kit';
import { COLLECTIBLES, evenementDuJour, PASS_PALIERS } from '@/components/jeu/economie';
import {
  BandeauPreview, BoutonJeu, formatNb, IconePerle, PictoHub,
} from '@/components/jeu/ui-jeu';
import {
  bonusJourDispo, defisDuJour, etatPass, nbUniques, paliersAReclamer,
  reclamerBonusDefis, reclamerDefi, resetBobaQuest, rouletteDispo, useBobaQuest,
} from '@/store/jeu';

export default function HubBobaQuest() {
  const insets = useSafeAreaInsets();
  const etat = useBobaQuest();
  const [trocVisible, setTrocVisible] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);

  const uniques = nbUniques(etat);
  const bonus = bonusJourDispo(etat);
  const roulette = rouletteDispo(etat);
  const aReclamer = etat.gains.filter((g) => g.statut === 'a_reclamer').length;
  const capsulesGratuites = etat.capsulesGratuites + etat.capsulesDoreesGratuites;
  const defis = defisDuJour(etat);
  const tousReclames = defis.every((d) => d.reclame);
  const etoilesTotal = Object.values(etat.aventure.etoiles).reduce((s, e) => s + e, 0);
  const evt = evenementDuJour();
  const pass = etatPass(etat);
  const passAReclamer = paliersAReclamer(etat);
  const prochainPalier = PASS_PALIERS.find((p) => pass.xp < p.xp);
  const dernierPalier = PASS_PALIERS[PASS_PALIERS.length - 1];
  const pctPass = Math.min(100, (pass.xp / dernierPalier.xp) * 100);
  // indice « encore X avant la capsule du rang 5/10… »
  const versCapsuleArene = 5 - ((etat.arene.rang - 1) % 5);

  return (
    <View style={styles.fond}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {/* === Header violet === */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <View style={[styles.deco, { top: -40, right: -28, width: 140, height: 140 }]} />
          <View style={[styles.deco, { bottom: -52, left: -40, width: 160, height: 160 }]} />
          <View style={styles.headerHaut}>
            <BoutonRetour onPress={() => router.back()} />
            <View style={{ flex: 1 }} />
          </View>
          <Text style={styles.titre}>BOBA QUEST</Text>
          <Text style={styles.sousTitre}>Joue, collectionne, gagne de vrais prix 🧋</Text>

          <View style={styles.solde}>
            <IconePerle taille={30} />
            <Text style={styles.soldeNb}>{formatNb(etat.perles)}</Text>
            <Text style={styles.soldeLib}>perles</Text>
          </View>
          <Text style={styles.soldeUsage}>
            💡 À dépenser en capsules, perles spéciales (💣🌈) et vrais prix
          </Text>
          <View style={[styles.bonusChip, !bonus && styles.bonusChipOff]}>
            <Text style={[styles.bonusChipTxt, !bonus && { color: C.lavande }]}>
              {bonus ? '✨ Bonus du jour : perles ×2 sur ta 1ʳᵉ partie' : '✓ Bonus du jour déjà utilisé — reviens demain !'}
            </Text>
          </View>
        </View>

        <View style={styles.contenu}>
          {/* === ⚡ Événement du week-end (double perles) === */}
          {evt.actif && (
            <View style={styles.evenement}>
              <Text style={styles.evenementTitre}>{evt.titre}</Text>
              <Text style={styles.evenementSous}>{evt.sous}</Text>
            </View>
          )}

          {/* === 🎫 Boba Pass (progression hebdo) === */}
          <Pressable style={styles.pass} onPress={() => router.push('/jeu/pass' as any)}>
            {passAReclamer > 0 && <View style={styles.passBadge}><Text style={styles.passBadgeTxt}>{passAReclamer}</Text></View>}
            <View style={styles.passHaut}>
              <Text style={styles.passTitre}>🎫 Boba Pass</Text>
              <Text style={styles.passXp}>{formatNb(pass.xp)} XP</Text>
            </View>
            <View style={styles.passBarre}>
              <View style={[styles.passRempli, { width: `${pctPass}%` }]} />
            </View>
            <Text style={styles.passSous}>
              {passAReclamer > 0
                ? `🎁 ${passAReclamer} palier${passAReclamer > 1 ? 's' : ''} à réclamer !`
                : prochainPalier
                  ? `Encore ${formatNb(prochainPalier.xp - pass.xp)} XP avant le prochain cadeau`
                  : 'Pass complet — bravo ! 🏆'}
            </Text>
          </Pressable>

          {/* === Aventure (tuile principale) === */}
          <Pressable style={styles.tuileJouer} onPress={() => router.push('/jeu/parcours' as any)}>
            <PictoHub id="jouer" fond="#fff" taille={52} />
            <View style={{ flex: 1 }}>
              <Text style={styles.tuileJouerTitre}>Aventure</Text>
              <Text style={styles.tuileJouerSous}>
                Niveau {etat.aventure.niveauMax} · ⭐ {etoilesTotal}{'\n'}Libère les capsules en tirs limités
              </Text>
            </View>
            <Text style={styles.tuileJouerGo}>JOUER</Text>
          </Pressable>

          {/* === Défis du jour === */}
          <View style={styles.defisCarte}>
            <View style={styles.defisHaut}>
              <Text style={styles.defisTitre}>⚡ Défis du jour</Text>
              <Text style={styles.defisSous}>{defis.filter((d) => d.reclame).length}/3</Text>
            </View>
            {defis.map((defi) => (
              <View key={defi.id} style={styles.defi}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.defiLabel, defi.reclame && styles.defiFaitTxt]}>{defi.label}</Text>
                  <View style={styles.defiBarre}>
                    <View style={[styles.defiBarreRempli, { width: `${(defi.progres / defi.cible) * 100}%` }]} />
                  </View>
                </View>
                {defi.reclame ? (
                  <Text style={styles.defiCoche}>✓</Text>
                ) : defi.fait ? (
                  <Pressable style={styles.defiReclamer} onPress={() => reclamerDefi(defi.id)}>
                    <IconePerle taille={13} />
                    <Text style={styles.defiReclamerTxt}>+{defi.perles}</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.defiProgres}>{formatNb(defi.progres)}/{formatNb(defi.cible)}</Text>
                )}
              </View>
            ))}
            {tousReclames && !etat.defisBonusReclame ? (
              <BoutonJeu
                titre="3/3 — Réclamer la capsule bonus 🎁"
                onPress={() => reclamerBonusDefis()}
                style={{ backgroundColor: C.vert }}
              />
            ) : (
              <Text style={styles.defisBonusLigne}>
                {etat.defisBonusReclame ? '🎁 Capsule bonus du jour récupérée ✓' : '🎁 Les 3 défis réclamés = +1 capsule'}
              </Text>
            )}
          </View>

          {/* === Grille de tuiles === */}
          <View style={styles.grille}>
            <Tuile
              picto="arene" fond="#fbe4ee" titre="L'Arène"
              sous={versCapsuleArene <= 2
                ? `Rang ${etat.arene.rang} · ${versCapsuleArene} victoire${versCapsuleArene > 1 ? 's' : ''} avant une capsule !`
                : `Rang ${etat.arene.rang} · duels & tournoi hebdo`}
              onPress={() => router.push('/jeu/arene' as any)}
            />
            <Tuile
              picto="jouer" fond="#f1ecfa" titre="Infini"
              sous={`Record : ${formatNb(etat.meilleurScore)} · farm à perles`}
              onPress={() => router.push('/jeu/shooter' as any)}
            />
            <Tuile
              picto="capsules" fond="#fbe4ee" titre="Capsules"
              sous={capsulesGratuites > 0 ? `${capsulesGratuites} gratuite${capsulesGratuites > 1 ? 's' : ''} à ouvrir !` : 'Loote des collectibles'}
              badge={capsulesGratuites > 0 ? String(capsulesGratuites) : undefined}
              onPress={() => router.push('/jeu/capsules' as any)}
            />
            <Tuile
              picto="collection" fond="#f1ecfa" titre="Collection"
              sous={`${uniques}/${COLLECTIBLES.length} trouvés`}
              onPress={() => router.push('/jeu/collection' as any)}
            />
            <Tuile
              picto="roulette" fond="#fdf3c2" titre="Roulette du mois"
              sous={roulette ? 'Ton tour gratuit t\'attend !' : 'Déjà jouée ce mois-ci'}
              badge={roulette ? '1' : undefined}
              onPress={() => router.push('/jeu/roulette' as any)}
            />
            <Tuile
              picto="boutique" fond="#eef4d8" titre="Boutique des prix"
              sous={aReclamer > 0 ? `${aReclamer} prix à réclamer` : 'Échange tes perles'}
              badge={aReclamer > 0 ? String(aReclamer) : undefined}
              onPress={() => router.push('/jeu/boutique' as any)}
            />
            <Tuile
              picto="troc" fond="#e4eef8" titre="Troc entre amis"
              sous="Échange tes doublons" bientot
              onPress={() => setTrocVisible(true)}
            />
          </View>

          <Text style={styles.stats}>
            {formatNb(etat.partiesJouees)} partie{etat.partiesJouees > 1 ? 's' : ''} · {formatNb(etat.capsulesOuvertes)} capsule{etat.capsulesOuvertes > 1 ? 's' : ''} ouverte{etat.capsulesOuvertes > 1 ? 's' : ''}
          </Text>
          <BandeauPreview />
          <Pressable onPress={() => setResetVisible(true)} hitSlop={6}>
            <Text style={styles.reset}>(Preview) Tout remettre à zéro</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Modal teaser troc */}
      <Modal visible={trocVisible} transparent animationType="fade" onRequestClose={() => setTrocVisible(false)}>
        <View style={styles.modalFond}>
          <View style={styles.modalCarte}>
            <Text style={{ fontSize: 40 }}>🤝</Text>
            <Text style={styles.modalTitre}>Le troc arrive bientôt !</Text>
            <Text style={styles.modalTexte}>
              Tu pourras proposer tes collectibles en double à tes amis et récupérer
              ceux qui te manquent — un simple QR à scanner entre deux comptes,
              comme pour le parrainage.
            </Text>
            <BoutonJeu titre="J'ai hâte !" onPress={() => setTrocVisible(false)} style={{ alignSelf: 'stretch' }} />
          </View>
        </View>
      </Modal>

      {/* Modal reset preview */}
      <Modal visible={resetVisible} transparent animationType="fade" onRequestClose={() => setResetVisible(false)}>
        <View style={styles.modalFond}>
          <View style={styles.modalCarte}>
            <Text style={{ fontSize: 40 }}>🧹</Text>
            <Text style={styles.modalTitre}>Tout remettre à zéro ?</Text>
            <Text style={styles.modalTexte}>
              Perles, collection, niveaux, prix gagnés : tout repart de zéro.
              (Bouton de test — absent de la version finale.)
            </Text>
            <BoutonJeu
              titre="Oui, remise à zéro"
              onPress={() => { resetBobaQuest(); setResetVisible(false); }}
              style={{ alignSelf: 'stretch', backgroundColor: C.danger }}
            />
            <Pressable onPress={() => setResetVisible(false)} hitSlop={6}>
              <Text style={styles.resetAnnuler}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Tuile({ picto, fond, titre, sous, badge, bientot, onPress }: {
  picto: string; fond: string; titre: string; sous: string; badge?: string; bientot?: boolean; onPress: () => void;
}) {
  return (
    <Pressable style={styles.tuile} onPress={onPress}>
      {badge && <View style={styles.badge}><Text style={styles.badgeTxt}>{badge}</Text></View>}
      {bientot && <View style={styles.bientot}><Text style={styles.bientotTxt}>BIENTÔT</Text></View>}
      <PictoHub id={picto} fond={fond} />
      <Text style={styles.tuileTitre}>{titre}</Text>
      <Text style={styles.tuileSous} numberOfLines={2}>{sous}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },

  header: {
    backgroundColor: C.violet,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 24, gap: 8, overflow: 'hidden',
  },
  deco: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  headerHaut: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  titre: { fontFamily: F.titre, fontSize: 30, color: '#fff', letterSpacing: 0.5 },
  sousTitre: { fontFamily: F.t600, fontSize: 14.5, color: C.lavande },

  solde: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 18,
    paddingVertical: 12, paddingHorizontal: 16, alignSelf: 'flex-start',
  },
  soldeNb: { fontFamily: F.t800, fontSize: 26, color: '#fff' },
  soldeLib: { fontFamily: F.t600, fontSize: 14, color: C.lavande, marginTop: 6 },
  soldeUsage: { fontFamily: F.t600, fontSize: 11.5, color: '#CDBFE6' },

  bonusChip: {
    backgroundColor: C.vert, borderRadius: R.pill, alignSelf: 'flex-start',
    paddingVertical: 7, paddingHorizontal: 13,
  },
  bonusChipOff: { backgroundColor: 'rgba(255,255,255,0.12)' },
  bonusChipTxt: { fontFamily: F.t700, fontSize: 12.5, color: C.violetProfond },

  contenu: { paddingHorizontal: 18, gap: 14, marginTop: 16 },

  // Événement du week-end
  evenement: {
    backgroundColor: C.jaune, borderRadius: R.carte, padding: 16, gap: 3, ...OMBRE,
  },
  evenementTitre: { fontFamily: F.titre, fontSize: 17, color: C.violetProfond },
  evenementSous: { fontFamily: F.t600, fontSize: 12.5, color: C.violetProfond, opacity: 0.8, lineHeight: 17 },

  // Boba Pass
  pass: { backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 8, ...OMBRE },
  passHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  passTitre: { fontFamily: F.t800, fontSize: 16, color: C.texte },
  passXp: { fontFamily: F.t800, fontSize: 14, color: C.violetClair },
  passBarre: { height: 10, borderRadius: 5, backgroundColor: C.lavande, overflow: 'hidden' },
  passRempli: { height: 10, borderRadius: 5, backgroundColor: C.violet },
  passSous: { fontFamily: F.t600, fontSize: 12.5, color: C.texte2 },
  passBadge: {
    position: 'absolute', top: 12, right: 12, zIndex: 2,
    backgroundColor: C.danger, borderRadius: R.pill, minWidth: 22, height: 22,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  passBadgeTxt: { fontFamily: F.t800, fontSize: 12, color: '#fff' },

  tuileJouer: {
    backgroundColor: C.vert, borderRadius: R.carte, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14, ...OMBRE,
  },
  tuileJouerTitre: { fontFamily: F.titre, fontSize: 20, color: C.violetProfond },
  tuileJouerSous: { fontFamily: F.t600, fontSize: 12.5, color: C.violetProfond, opacity: 0.75, marginTop: 2, lineHeight: 17 },
  tuileJouerGo: {
    fontFamily: F.t800, fontSize: 13, color: C.vert, backgroundColor: C.violetProfond,
    borderRadius: R.pill, paddingVertical: 9, paddingHorizontal: 14, overflow: 'hidden',
  },

  // Défis du jour
  defisCarte: { backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 12, ...OMBRE },
  defisHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  defisTitre: { fontFamily: F.t800, fontSize: 16, color: C.texte },
  defisSous: { fontFamily: F.t800, fontSize: 14, color: C.vertFonce },
  defi: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  defiLabel: { fontFamily: F.t700, fontSize: 13.5, color: C.texte, marginBottom: 5 },
  defiFaitTxt: { color: C.texte3 },
  defiBarre: { height: 6, borderRadius: 3, backgroundColor: C.lavande, overflow: 'hidden' },
  defiBarreRempli: { height: 6, borderRadius: 3, backgroundColor: C.vert },
  defiProgres: { fontFamily: F.t700, fontSize: 12, color: C.texte3, minWidth: 48, textAlign: 'right' },
  defiCoche: { fontFamily: F.t800, fontSize: 17, color: C.vertFonce, minWidth: 48, textAlign: 'right' },
  defiReclamer: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.vert, borderRadius: R.pill, paddingVertical: 7, paddingHorizontal: 11,
  },
  defiReclamerTxt: { fontFamily: F.t800, fontSize: 12.5, color: C.violetProfond },
  defisBonusLigne: { fontFamily: F.t600, fontSize: 12, color: C.texte2, textAlign: 'center' },

  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tuile: {
    width: '48%', flexGrow: 1, backgroundColor: C.carte, borderRadius: R.carte,
    padding: 14, gap: 8, ...OMBRE,
  },
  tuileTitre: { fontFamily: F.t800, fontSize: 15, color: C.texte },
  tuileSous: { fontFamily: F.t600, fontSize: 12, color: C.texte2, lineHeight: 16 },
  badge: {
    position: 'absolute', top: 10, right: 10, zIndex: 2,
    backgroundColor: C.danger, borderRadius: R.pill, minWidth: 22, height: 22,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  badgeTxt: { fontFamily: F.t800, fontSize: 12, color: '#fff' },
  bientot: {
    position: 'absolute', top: 10, right: 10, zIndex: 2,
    backgroundColor: C.jaunePale, borderRadius: R.pill, paddingVertical: 3, paddingHorizontal: 8,
    borderWidth: 1, borderColor: C.jaune,
  },
  bientotTxt: { fontFamily: F.t800, fontSize: 9.5, color: '#9A6B00' },

  stats: { fontFamily: F.t600, fontSize: 12, color: C.texte3, textAlign: 'center' },
  reset: { fontFamily: F.t600, fontSize: 12, color: C.texte3, textAlign: 'center', textDecorationLine: 'underline', padding: 4 },
  resetAnnuler: { fontFamily: F.t700, fontSize: 14, color: C.texte2, padding: 6 },

  modalFond: {
    flex: 1, backgroundColor: 'rgba(42,29,70,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  modalCarte: {
    backgroundColor: C.carte, borderRadius: 24, padding: 24,
    alignItems: 'center', gap: 12, alignSelf: 'stretch', ...OMBRE,
  },
  modalTitre: { fontFamily: F.t800, fontSize: 18, color: C.texte, textAlign: 'center' },
  modalTexte: { fontFamily: F.t400, fontSize: 14, color: C.texte2, textAlign: 'center', lineHeight: 20 },
});
