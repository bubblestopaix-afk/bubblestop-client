// === Boba Quest — lobby du mode Infini (maquette 3g) ===
// Écran d'avant-partie : aperçu du plateau, record, stats, bonus du jour,
// perles spéciales (achat) et copain de tir. Le CTA lance le vrai shooter.
// Le moteur du jeu n'est PAS touché : ceci est une antichambre visuelle.
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { BORD, C, F, OMBRE, OMBRE_VIOLETTE, R } from '@/constants/charte';
import { Etincelle } from '@/components/ui-kit';
import { PERLES_MAX_PARTIE, POWERUPS, PowerupId, trouverCollectible } from '@/components/jeu/economie';
import { Icone } from '@/components/jeu/icones';
import { BandeauPreview, EnTeteJeu, formatNb, IconePerle } from '@/components/jeu/ui-jeu';
import {
  acheterPowerup, bonusJourDispo, coutPowerupActuel, effetBuddyActuel, useBobaQuest,
} from '@/store/jeu';

// Aperçu décoratif du plateau (perles pastel + lanceur), fidèle à la maquette 3g
function ApercuPlateau() {
  const couleurs = ['#ec647b', '#89cfe3', '#f2da33', '#9fc038', '#ec647b', '#f2da33', '#9fc038', '#b98fe0', '#89cfe3', '#9fc038', '#ec647b', '#f2da33'];
  const pos = [
    [110, 26], [150, 26], [190, 26], [230, 26], [270, 26],
    [130, 60], [170, 60], [210, 60], [250, 60],
    [150, 94], [190, 94], [230, 94],
  ];
  return (
    <Svg width="100%" height={190} viewBox="0 0 380 190">
      {pos.map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={17} fill={couleurs[i % couleurs.length]} />
      ))}
      {/* lanceur */}
      <Circle cx={190} cy={148} r={15} fill={C.rose} stroke="#fff" strokeWidth={3} />
      <Rect x={162} y={168} width={56} height={16} rx={8} fill="#7d5bb0" />
    </Svg>
  );
}

export default function InfiniLobby() {
  const insets = useSafeAreaInsets();
  const etat = useBobaQuest();
  const bonus = bonusJourDispo(etat);
  const buddy = etat.buddyId ? trouverCollectible(etat.buddyId) : undefined;
  const effet = effetBuddyActuel(etat);

  const ligneSpeciale = (id: PowerupId) => {
    const p = POWERUPS[id];
    const stock = etat.powerups[id];
    const cout = coutPowerupActuel(id);
    const plein = stock >= p.max;
    const possible = etat.perles >= cout && !plein;
    return (
      <View key={id} style={styles.speciale}>
        <Svg width={40} height={40} viewBox="0 0 24 24">
          {id === 'bombe' ? (
            <>
              <Circle cx={12} cy={13} r={8.5} fill="#ec647b" />
              <Circle cx={9.5} cy={10.5} r={2.4} fill="#fff" opacity={0.4} />
              <Path d="M16.5 4.5l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6Z" fill="#f2da33" />
            </>
          ) : (
            <>
              <Circle cx={12} cy={12} r={8.5} fill="#b98fe0" />
              <Path d="M5 12 A7 7 0 0 1 19 12" stroke="#f2da33" strokeWidth={2.4} fill="none" />
              <Path d="M6.2 14.6 A6 6 0 0 1 17.8 14.6" stroke="#9fc038" strokeWidth={2.4} fill="none" />
              <Circle cx={9} cy={9} r={2} fill="#fff" opacity={0.45} />
            </>
          )}
        </Svg>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.specialeNom}>{p.nom}</Text>
            <Text style={styles.specialeStock}>{stock}/{p.max}</Text>
          </View>
          <Text style={styles.specialeDetail} numberOfLines={2}>{p.detail}</Text>
        </View>
        <Pressable
          style={[styles.specialeAchat, (!possible) && { opacity: 0.4 }]}
          disabled={!possible}
          onPress={() => acheterPowerup(id)}
          accessibilityRole="button"
          accessibilityLabel={plein ? `${p.nom}, stock plein` : `Acheter ${p.nom} pour ${formatNb(cout)} perles`}
        >
          <IconePerle taille={13} />
          <Text style={styles.specialeAchatTxt}>{plein ? 'Max' : formatNb(cout)}</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.fond, { paddingTop: insets.top + 10 }]}>
      <View style={{ paddingHorizontal: 18 }}>
        <EnTeteJeu titre="Infini" onRetour={() => router.back()} perles={etat.perles} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu}>
        {/* === Plateau violet immersif (maquette 3g) === */}
        <View style={styles.plateau}>
          <Etincelle taille={13} style={{ position: 'absolute', top: 16, left: 16, opacity: 0.85 }} />
          <View style={styles.plateauHaut}>
            <View style={styles.scorePill}>
              <Text style={styles.scorePillLib}>AUJOURD'HUI</Text>
              <Text style={styles.scorePillVal}>{formatNb(etat.statsJour.meilleurScorePartie)}</Text>
            </View>
            <View style={styles.recordPill}>
              <Icone nom="etoile" taille={13} />
              <Text style={styles.recordPillTxt}>Record {formatNb(etat.meilleurScore)}</Text>
            </View>
          </View>
          <ApercuPlateau />
        </View>

        {/* === Stats (maquette : deux cartes côte à côte) === */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={styles.stat}>
            <Text style={styles.statLib}>Meilleure chaîne</Text>
            <Text style={styles.statVal}>×{formatNb(etat.statsJour.chaineMax)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLib}>Perles / partie</Text>
            <Text style={styles.statVal}>≤ {PERLES_MAX_PARTIE}</Text>
          </View>
        </View>

        {/* === Bonus du jour === */}
        {bonus && (
          <View style={styles.bonus}>
            <Icone nom="eclair" taille={17} />
            <Text style={styles.bonusTxt}>Bonus du jour : perles ×2 sur ta 1ʳᵉ partie</Text>
          </View>
        )}

        {/* === Perles spéciales === */}
        <Text style={styles.sectionTitre}>Perles spéciales</Text>
        {ligneSpeciale('bombe')}
        {ligneSpeciale('arc')}
        {buddy && (
          <View style={styles.speciale}>
            <View style={styles.buddyPastille}><Icone nom="boba" taille={22} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.specialeNom}>Copain de tir : {buddy.nom}</Text>
              <Text style={styles.specialeDetail}>{effet.libelle || 'Bonus passif équipé'}</Text>
            </View>
          </View>
        )}

        {/* === CTA candy === */}
        <Pressable
          style={styles.cta}
          onPress={() => router.push('/jeu/shooter' as any)}
          accessibilityRole="button"
          accessibilityLabel="Jouer une partie d'Infini"
        >
          <Text style={styles.ctaTxt}>Jouer ›</Text>
        </Pressable>
        <BandeauPreview />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  contenu: { padding: 18, gap: 12, paddingBottom: 34 },

  plateau: {
    backgroundColor: C.violet, borderRadius: R.carte, padding: 14, gap: 6,
    overflow: 'hidden', ...OMBRE_VIOLETTE,
  },
  plateauHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scorePill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: R.pill,
    paddingVertical: 6, paddingHorizontal: 11,
  },
  scorePillLib: { fontFamily: F.t700, fontSize: 9.5, color: C.surViolet, letterSpacing: 0.8 },
  scorePillVal: { fontFamily: F.t800, fontSize: 15, color: '#fff' },
  recordPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.jaune, borderRadius: R.pill, paddingVertical: 6, paddingHorizontal: 11,
  },
  recordPillTxt: { fontFamily: F.t800, fontSize: 12.5, color: '#54470A' },

  stat: {
    flex: 1, backgroundColor: C.carte, borderRadius: R.carte, padding: 14, gap: 2,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  statLib: { fontFamily: F.t600, fontSize: 12, color: C.texte3 },
  statVal: { fontFamily: F.titre, fontSize: 20, color: C.violet },

  bonus: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: C.jaunePale, borderRadius: R.btn + 2, padding: 13,
    borderWidth: 2, borderColor: C.jaune,
  },
  bonusTxt: { flex: 1, fontFamily: F.t700, fontSize: 13, color: '#54470A' },

  sectionTitre: { fontFamily: F.titre, fontSize: 17, color: C.violet, marginTop: 4 },
  speciale: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.carte, borderRadius: R.carte, padding: 13,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  specialeNom: { fontFamily: F.t800, fontSize: 14, color: C.texte },
  specialeStock: { fontFamily: F.t700, fontSize: 12, color: C.texte3 },
  specialeDetail: { fontFamily: F.t500, fontSize: 11.5, color: C.texte2, lineHeight: 15, marginTop: 1 },
  specialeAchat: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.vert, borderRadius: R.pill, paddingVertical: 7, paddingHorizontal: 12,
    borderBottomWidth: 3, borderBottomColor: '#6F8F1F',
  },
  specialeAchatTxt: { fontFamily: F.t800, fontSize: 12.5, color: '#2C380C' },
  buddyPastille: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.lavande,
    alignItems: 'center', justifyContent: 'center',
  },

  cta: {
    backgroundColor: C.vert, borderRadius: R.btn, paddingVertical: 15, alignItems: 'center',
    borderBottomWidth: 5, borderBottomColor: '#6F8F1F', marginTop: 4,
  },
  ctaTxt: { fontFamily: F.titre, fontSize: 17.5, color: '#2C380C' },
});
