// === Boba Quest — le parcours d'Aventure ===
// Carte serpentin des niveaux : étoiles gagnées, niveau courant, boss tous les
// 5 niveaux (capsule dorée). Chaque niveau est le même pour tout le monde.
import { StyleSheet, View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { C, F, R, OMBRE } from '@/constants/charte';
import { paramsNiveau } from '@/components/jeu/moteur-shooter';
import { EnTeteJeu } from '@/components/jeu/ui-jeu';
import { etoilesDuNiveau, useBobaQuest } from '@/store/jeu';

const PAS_Y = 96;          // hauteur entre deux niveaux
const HAUT = 30;           // marge haute de la carte

export default function ParcoursScreen() {
  const insets = useSafeAreaInsets();
  const etat = useBobaQuest();
  const courant = etat.aventure.niveauMax;
  const nbAffiches = Math.max(12, courant + 5);

  // positions serpentines (x en fraction de la largeur)
  const xPour = (i: number) => 0.5 + Math.sin(i * 0.9) * 0.3;

  return (
    <View style={[styles.fond, { paddingTop: insets.top + 10 }]}>
      <View style={{ paddingHorizontal: 18 }}>
        <EnTeteJeu titre="Aventure" onRetour={() => router.back()} perles={etat.perles} />
        <Text style={styles.pitch}>
          Libère les capsules : coupe les perles qui les retiennent, en tirs limités.
          Boss tous les 5 niveaux = capsule dorée 👑
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingTop: 6 }}>
        <Carte nbAffiches={nbAffiches} courant={courant} xPour={xPour} etoiles={(n) => etoilesDuNiveau(n, etat)} />
      </ScrollView>
    </View>
  );
}

function Carte({ nbAffiches, courant, xPour, etoiles }: {
  nbAffiches: number; courant: number; xPour: (i: number) => number; etoiles: (n: number) => number;
}) {
  const hauteur = nbAffiches * PAS_Y + HAUT + 30;
  return (
    <View style={{ height: hauteur }}>
      {/* le chemin (pointillés) qui relie les niveaux */}
      <ChercheminSvg nbAffiches={nbAffiches} xPour={xPour} hauteur={hauteur} />
      {Array.from({ length: nbAffiches }).map((_, i) => {
        const n = i + 1;
        const p = paramsNiveau(n);
        const fait = etoiles(n) > 0;
        const jouable = n <= courant;
        return (
          <Noeud
            key={n} n={n} boss={p.boss} fait={fait} jouable={jouable}
            courant={n === courant} etoiles={etoiles(n)} xFrac={xPour(i)} y={HAUT + i * PAS_Y}
          />
        );
      })}
    </View>
  );
}

// Chemin pointillé — dessiné en pourcentages puis étiré à la largeur réelle
function ChercheminSvg({ nbAffiches, xPour, hauteur }: {
  nbAffiches: number; xPour: (i: number) => number; hauteur: number;
}) {
  let dChemin = '';
  for (let i = 0; i < nbAffiches; i++) {
    const x = xPour(i) * 100;
    const y = ((HAUT + i * PAS_Y + 32) / hauteur) * 100;
    dChemin += i === 0 ? `M${x} ${y}` : ` L${x} ${y}`;
  }
  return (
    <Svg
      width="100%" height={hauteur}
      viewBox="0 0 100 100" preserveAspectRatio="none"
      style={StyleSheet.absoluteFill}
    >
      <Path d={dChemin} stroke="#DED5EC" strokeWidth={1.2} strokeDasharray="2 1.6" fill="none" />
    </Svg>
  );
}

function Noeud({ n, boss, fait, jouable, courant, etoiles, xFrac, y }: {
  n: number; boss: boolean; fait: boolean; jouable: boolean; courant: boolean;
  etoiles: number; xFrac: number; y: number;
}) {
  const taille = boss ? 74 : 62;
  return (
    <View style={{ position: 'absolute', top: y, left: `${xFrac * 100}%`, marginLeft: -taille / 2, alignItems: 'center', width: taille }}>
      <Pressable
        disabled={!jouable}
        onPress={() => router.push(`/jeu/shooter?niveau=${n}` as any)}
        style={[
          styles.noeud,
          { width: taille, height: taille, borderRadius: taille / 2 },
          fait && styles.noeudFait,
          courant && styles.noeudCourant,
          !jouable && styles.noeudVerrou,
          boss && styles.noeudBoss,
        ]}
      >
        {boss && <Text style={{ fontSize: 15, marginBottom: -3 }}>👑</Text>}
        <Text style={[
          styles.noeudNb,
          fait && { color: '#fff' },
          !jouable && { color: C.texte3 },
          courant && !fait && { color: C.violetProfond },
        ]}>
          {jouable ? n : '🔒'}
        </Text>
      </Pressable>
      {/* étoiles sous le nœud */}
      <View style={{ flexDirection: 'row', marginTop: 3 }}>
        {[1, 2, 3].map((i) => (
          <Text key={i} style={{ fontSize: 11, opacity: fait ? (i <= etoiles ? 1 : 0.2) : 0 }}>⭐</Text>
        ))}
      </View>
      {courant && <View style={styles.chipJoue}><Text style={styles.chipJoueTxt}>JOUER</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  pitch: {
    fontFamily: F.t600, fontSize: 12.5, color: C.texte2, lineHeight: 18,
    marginTop: 10, marginBottom: 4, textAlign: 'center',
  },

  noeud: {
    backgroundColor: C.carte, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: C.bord, ...OMBRE,
  },
  noeudFait: { backgroundColor: C.violetClair, borderColor: C.violet },
  noeudCourant: { borderColor: C.vert, backgroundColor: C.vertPale },
  noeudVerrou: { backgroundColor: C.lavande, borderColor: C.bord, opacity: 0.75 },
  noeudBoss: { borderColor: C.jaune },
  noeudNb: { fontFamily: F.titre, fontSize: 21, color: C.violet },

  chipJoue: {
    marginTop: 4, backgroundColor: C.vert, borderRadius: R.pill,
    paddingVertical: 3, paddingHorizontal: 10,
  },
  chipJoueTxt: { fontFamily: F.t800, fontSize: 10.5, color: C.violetProfond },
});
