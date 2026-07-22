// === Boba Quest — 🏆 le TOURNOI de la semaine ===
// 3 étapes (quart → demie → GRANDE FINALE), les mêmes champions pour tout le
// monde, UNE tentative par semaine : perdu = éliminé jusqu'à lundi.
// Récompenses qui montent, capsule DORÉE et titre de Champion en finale.
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { BORD, C, F, R, OMBRE } from '@/constants/charte';
import { adversaireTournoi } from '@/components/jeu/arene';
import PastilleCollectible from '@/components/jeu/collectibles';
import {
  cleSemaine, OBJETS, TOURNOI_ETAPES, TOURNOI_RECOMPENSES, TOURNOI_RETENTE_PERLES, trouverCollectible,
} from '@/components/jeu/economie';
import { Icone, IconeEmoji } from '@/components/jeu/icones';
import { BandeauPreview, BoutonJeu, EnTeteJeu, formatNb } from '@/components/jeu/ui-jeu';
import { etatTournoi, retenterTournoi, useBobaQuest } from '@/store/jeu';

export default function TournoiScreen() {
  const insets = useSafeAreaInsets();
  const etat = useBobaQuest();
  const tournoi = etatTournoi(etat);
  const semaine = cleSemaine();
  const champion = tournoi.etape >= 3;

  return (
    <View style={[styles.fond, { paddingTop: insets.top + 10 }]}>
      <View style={{ paddingHorizontal: 18 }}>
        <EnTeteJeu titre="Tournoi" onRetour={() => router.back()} perles={etat.perles} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu}>
        {/* Bandeau de la semaine */}
        <View style={styles.enTete}>
          <Text style={styles.semaine}>Semaine {semaine.split('-S')[1]} · nouveaux champions chaque lundi</Text>
          <Text style={styles.pitch}>
            3 combats, UNE seule tentative par semaine. Perds… et reviens lundi !
          </Text>
          {tournoi.trophees > 0 && (
            <View style={styles.trophees}>
              <Icone nom="couronne" taille={15} />
              <Text style={styles.tropheesTxt}>{tournoi.trophees} titre{tournoi.trophees > 1 ? 's' : ''} de Champion</Text>
            </View>
          )}
        </View>

        {champion && (
          <View style={styles.championCarte}>
            <Icone nom="couronne" taille={44} />
            <Text style={styles.championTitre}>CHAMPION DE LA SEMAINE !</Text>
            <Text style={styles.championTexte}>Tu as balayé le tournoi. Reviens lundi défendre ton titre.</Text>
          </View>
        )}

        {/* Les 3 étapes du bracket */}
        {TOURNOI_ETAPES.map((nomEtape, i) => {
          const adv = adversaireTournoi(semaine, i);
          const rec = TOURNOI_RECOMPENSES[i];
          const faite = tournoi.etape > i;
          const courante = tournoi.etape === i && !tournoi.elimine;
          const perdueIci = tournoi.elimine && !champion && tournoi.etape === i;
          const verrouillee = tournoi.etape < i || (tournoi.elimine && tournoi.etape <= i && !perdueIci);
          return (
            <View
              key={nomEtape}
              style={[
                styles.etape,
                faite && styles.etapeFaite,
                courante && styles.etapeCourante,
                (verrouillee || perdueIci) && { opacity: 0.6 },
                i === 2 && styles.etapeFinale,
              ]}
            >
              <View style={styles.etapeHaut}>
                <View style={styles.etapeNomRang}>
                  <Icone nom={faite ? 'check' : perdueIci ? 'interdit' : verrouillee ? 'cadenas' : 'epee'} taille={16} />
                  <Text style={styles.etapeNom}>{nomEtape}</Text>
                </View>
                <Text style={styles.puissance}>×{adv.echelle.toFixed(2)}</Text>
              </View>
              <Text style={styles.advNom}>{adv.nom}</Text>
              <View style={styles.equipeRang}>
                {adv.ids.map((id) => (
                  <View key={id} style={styles.slot}>
                    <PastilleCollectible id={id} taille={56} />
                    <View style={styles.slotNomRang}>
                      <Text style={styles.slotNom} numberOfLines={1}>{trouverCollectible(id)?.nom}</Text>
                      {adv.objets[id]?.map((o) => <IconeEmoji key={o} emoji={OBJETS[o].emoji} taille={12} />)}
                    </View>
                  </View>
                ))}
              </View>
              <View style={styles.recompenseRang}>
                <Icone nom="trophee" taille={15} />
                <Text style={styles.recompense}>
                  {formatNb(rec.perles)} perles
                  {rec.capsule ? ` + capsule ${rec.capsule === 'doree' ? 'DORÉE' : 'classique'}` : ''}
                  {i === 2 ? ' + titre de Champion' : ''}
                </Text>
                {rec.capsule ? <IconeEmoji emoji={rec.capsule === 'doree' ? '👑' : '🎁'} taille={15} /> : null}
              </View>
              {courante && (
                <BoutonJeu
                  titre={`Combattre — ${nomEtape} !`}
                  onPress={() => router.push(`/jeu/duel?mode=tournoi&etape=${i}` as any)}
                  style={{ backgroundColor: i === 2 ? '#D2588A' : C.vert }}
                />
              )}
              {perdueIci && (
                <>
                  <Text style={styles.elimine}>Éliminé ici — retente ou reviens lundi</Text>
                  {/* 🎟️ seconde chance payante : retente la MÊME étape sans attendre lundi */}
                  <BoutonJeu
                    titre={`Retenter — ${formatNb(TOURNOI_RETENTE_PERLES)} perles`}
                    onPress={() => { if (retenterTournoi()) router.push(`/jeu/duel?mode=tournoi&etape=${i}` as any); }}
                    style={{ backgroundColor: etat.perles >= TOURNOI_RETENTE_PERLES ? C.vert : C.lavande }}
                  />
                  {etat.perles < TOURNOI_RETENTE_PERLES && (
                    <Text style={styles.pitch}>Pas assez de perles pour retenter — joue à Perle Rush !</Text>
                  )}
                </>
              )}
            </View>
          );
        })}

        {tournoi.elimine && !champion && (
          <Text style={styles.note}>Les champions changent chaque lundi (les mêmes pour tous les joueurs).</Text>
        )}
        <BandeauPreview />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  contenu: { padding: 18, gap: 14, paddingBottom: 34 },

  enTete: { alignItems: 'center', gap: 6 },
  semaine: { fontFamily: F.t800, fontSize: 14, color: C.violetProfond },
  pitch: { fontFamily: F.t600, fontSize: 12.5, color: C.texte2, textAlign: 'center', lineHeight: 18 },
  trophees: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.jaunePale, borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 12,
    borderWidth: 1, borderColor: C.jaune,
  },
  tropheesTxt: { fontFamily: F.t800, fontSize: 12.5, color: '#9A6B00' },

  championCarte: {
    backgroundColor: C.violet, borderRadius: R.carte, padding: 20,
    alignItems: 'center', gap: 8, ...OMBRE,
  },
  championTitre: { fontFamily: F.titre, fontSize: 20, color: C.jaune },
  championTexte: { fontFamily: F.t600, fontSize: 13, color: C.lavande, textAlign: 'center' },

  etape: { backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 10, borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE },
  etapeFaite: { borderWidth: 2, borderColor: C.vert },
  etapeCourante: { borderWidth: 2, borderColor: C.violetClair },
  etapeFinale: { backgroundColor: '#FDF6FB' },
  etapeHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  etapeNomRang: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  etapeNom: { fontFamily: F.t800, fontSize: 15.5, color: C.texte },
  puissance: {
    fontFamily: F.t800, fontSize: 12, color: C.violetProfond,
    backgroundColor: C.lavande, borderRadius: R.pill, paddingVertical: 3, paddingHorizontal: 9,
    overflow: 'hidden',
  },
  advNom: { fontFamily: F.titre, fontSize: 16, color: C.violet },
  equipeRang: { flexDirection: 'row', justifyContent: 'space-around' },
  slot: { alignItems: 'center', gap: 3, width: 92 },
  slotNom: { fontFamily: F.t700, fontSize: 11, color: C.texte },
  slotNomRang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, flexWrap: 'wrap' },
  recompense: { fontFamily: F.t700, fontSize: 12.5, color: C.vertFonce, textAlign: 'center' },
  recompenseRang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, flexWrap: 'wrap' },
  elimine: { fontFamily: F.t700, fontSize: 12.5, color: C.danger, textAlign: 'center' },
  note: { fontFamily: F.t600, fontSize: 12, color: C.texte3, textAlign: 'center' },
});
