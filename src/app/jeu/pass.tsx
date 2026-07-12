// === Boba Quest — 🎫 le BOBA PASS de la semaine ===
// Une piste de 10 paliers remplie par TOUT ce qu'on fait dans le jeu (XP :
// niveaux, défis, arène, tournoi, capsules). 100 % gratuit, remis à zéro chaque
// lundi, gros lot final. Le grand rendez-vous de progression — sans aucune notif.
import { StyleSheet, View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { C, F, R, OMBRE } from '@/constants/charte';
import { cleSemaine, evenementDuJour, labelPalier, PASS_PALIERS, PASS_XP } from '@/components/jeu/economie';
import { Icone, IconeNom } from '@/components/jeu/icones';
import { BandeauPreview, BoutonJeu, EnTeteJeu, formatNb, IconePerle } from '@/components/jeu/ui-jeu';
import { etatPass, reclamerPalierPass, useBobaQuest } from '@/store/jeu';

export default function PassScreen() {
  const insets = useSafeAreaInsets();
  const etat = useBobaQuest();
  const pass = etatPass(etat);
  const semaine = cleSemaine();
  const evt = evenementDuJour();

  const dernierPalier = PASS_PALIERS[PASS_PALIERS.length - 1];
  const pctGlobal = Math.min(100, (pass.xp / dernierPalier.xp) * 100);
  const prochain = PASS_PALIERS.find((p) => pass.xp < p.xp);

  return (
    <View style={[styles.fond, { paddingTop: insets.top + 10 }]}>
      <View style={{ paddingHorizontal: 18 }}>
        <EnTeteJeu titre="Boba Pass" onRetour={() => router.back()} perles={etat.perles} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu}>
        {/* Barre d'XP globale */}
        <View style={styles.entete}>
          <View style={styles.enteteHaut}>
            <Text style={styles.semaine}>Semaine {semaine.split('-S')[1]}</Text>
            <Text style={styles.xpTxt}>{formatNb(pass.xp)} XP</Text>
          </View>
          <View style={styles.barreGlobale}>
            <View style={[styles.barreGlobaleRemplie, { width: `${pctGlobal}%` }]} />
          </View>
          <Text style={styles.pitch}>
            {prochain
              ? `Encore ${formatNb(prochain.xp - pass.xp)} XP avant le prochain palier · nouveau pass chaque lundi`
              : 'Pass au maximum — bravo ! Reviens lundi pour le prochain.'}
          </Text>
          {evt.actif && (
            <View style={styles.evtChip}><Text style={styles.evtChipTxt}>{evt.titre} · XP inchangé, perles ×2</Text></View>
          )}
        </View>

        {/* La piste des 10 paliers */}
        {PASS_PALIERS.map((palier, i) => {
          const atteint = pass.xp >= palier.xp;
          const reclame = pass.reclames.includes(i);
          const final = i === PASS_PALIERS.length - 1;
          return (
            <View key={i} style={[styles.palier, atteint && styles.palierAtteint, final && styles.palierFinal]}>
              <View style={[styles.numero, atteint && styles.numeroAtteint, final && styles.numeroFinal]}>
                {final ? <Icone nom="trophee" taille={20} /> : <Text style={[styles.numeroTxt, atteint && { color: '#fff' }]}>{i + 1}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.palierLabel}>{labelPalier(palier)}</Text>
                <Text style={styles.palierXp}>{formatNb(palier.xp)} XP</Text>
              </View>
              {reclame ? (
                <View style={{ paddingHorizontal: 8 }}><Icone nom="check" taille={18} /></View>
              ) : atteint ? (
                <Pressable style={styles.reclamer} onPress={() => reclamerPalierPass(i)}>
                  <Text style={styles.reclamerTxt}>Réclamer</Text>
                </Pressable>
              ) : (
                <View style={{ paddingHorizontal: 6, opacity: 0.5 }}><Icone nom="cadenas" taille={16} /></View>
              )}
            </View>
          );
        })}

        {/* Comment gagner de l'XP */}
        <View style={styles.carte}>
          <Text style={styles.carteTitre}>Comment gagner de l'XP ?</Text>
          <LigneXp nom="cible" texte="Terminer un niveau d'Aventure" xp={PASS_XP.niveauPremiere} />
          <LigneXp nom="eclair" texte="Réclamer un défi du jour" xp={PASS_XP.defi} />
          <LigneXp nom="trophee" texte="Gagner un combat au tournoi" xp={PASS_XP.tournoi} />
          <LigneXp nom="epee" texte="Gagner un combat d'Arène" xp={PASS_XP.arene} />
          <LigneXp nom="cadeau" texte="Ouvrir une capsule" xp={PASS_XP.capsule} />
          <LigneXp nom="boba" texte="Jouer une partie d'Infini" xp={PASS_XP.partieInfini} />
        </View>

        <BoutonJeu titre="Aller jouer !" onPress={() => router.replace('/jeu' as any)} style={{ backgroundColor: C.vert }} />
        <BandeauPreview />
      </ScrollView>
    </View>
  );
}

function LigneXp({ nom, texte, xp }: { nom: IconeNom; texte: string; xp: number }) {
  return (
    <View style={styles.ligneXp}>
      <Icone nom={nom} taille={18} />
      <Text style={styles.ligneXpTxt}>{texte}</Text>
      <Text style={styles.ligneXpVal}>+{xp} XP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  contenu: { padding: 18, gap: 12, paddingBottom: 34 },

  entete: { backgroundColor: C.violet, borderRadius: R.carte, padding: 18, gap: 8, ...OMBRE },
  enteteHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  semaine: { fontFamily: F.titre, fontSize: 17, color: '#fff' },
  xpTxt: { fontFamily: F.t800, fontSize: 16, color: C.vert },
  barreGlobale: { height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  barreGlobaleRemplie: { height: 12, borderRadius: 6, backgroundColor: C.vert },
  pitch: { fontFamily: F.t600, fontSize: 12.5, color: C.lavande, lineHeight: 18 },
  evtChip: { backgroundColor: C.jaune, borderRadius: R.pill, alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 11 },
  evtChipTxt: { fontFamily: F.t800, fontSize: 11.5, color: C.violetProfond },

  palier: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.carte, borderRadius: 16, padding: 12, ...OMBRE,
  },
  palierAtteint: { borderWidth: 1.5, borderColor: C.vert },
  palierFinal: { borderWidth: 2, borderColor: C.jaune, backgroundColor: '#FFFDF5' },
  numero: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: C.lavande,
    alignItems: 'center', justifyContent: 'center',
  },
  numeroAtteint: { backgroundColor: C.vert },
  numeroFinal: { backgroundColor: C.jaune },
  numeroTxt: { fontFamily: F.t800, fontSize: 15, color: C.violetProfond },
  palierLabel: { fontFamily: F.t800, fontSize: 14, color: C.texte },
  palierXp: { fontFamily: F.t600, fontSize: 12, color: C.texte2, marginTop: 1 },
  reclamer: { backgroundColor: C.vert, borderRadius: R.pill, paddingVertical: 8, paddingHorizontal: 14 },
  reclamerTxt: { fontFamily: F.t800, fontSize: 12.5, color: C.violetProfond },
  reclameTxt: { fontFamily: F.t800, fontSize: 18, color: C.vertFonce, paddingHorizontal: 8 },
  verrou: { fontSize: 15, opacity: 0.5, paddingHorizontal: 6 },

  carte: { backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 9, ...OMBRE, marginTop: 4 },
  carteTitre: { fontFamily: F.t800, fontSize: 15, color: C.texte, marginBottom: 2 },
  ligneXp: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ligneXpTxt: { flex: 1, fontFamily: F.t600, fontSize: 13, color: C.texte2 },
  ligneXpVal: { fontFamily: F.t800, fontSize: 12.5, color: C.violetClair },
});
