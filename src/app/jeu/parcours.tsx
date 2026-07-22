// === Boba Quest — le parcours d'Aventure ===
// Carte serpentin des niveaux : étoiles gagnées, niveau courant, boss tous les
// 5 niveaux (capsule dorée). Chaque niveau est le même pour tout le monde.
import { StyleSheet, View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { BORD, C, F, OMBRE, OMBRE_VIOLETTE, R } from '@/constants/charte';
import { Etincelle } from '@/components/ui-kit';
import { objectifLabel, paramsNiveau } from '@/components/jeu/moteur-shooter';
import { Icone } from '@/components/jeu/icones';
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
          Boss tous les 5 niveaux = capsule dorée !
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingTop: 10, paddingHorizontal: 16, gap: 12 }}>
        <View style={styles.vallee}>
          <View style={styles.valleePill}><Text style={styles.valleePillTxt}>Vallée des Perles</Text></View>
          <Etincelle taille={13} style={{ position: 'absolute', top: 54, left: 18 }} />
          <Etincelle taille={9} couleur="#CBB6E8" style={{ position: 'absolute', top: 120, right: 16 }} />
          <Carte nbAffiches={nbAffiches} courant={courant} xPour={xPour} etoiles={(n) => etoilesDuNiveau(n, etat)} />
        </View>

        {/* Carte du niveau courant (maquette 3a : Objectif · Munitions · étoiles · CTA candy) */}
        <CarteNiveau n={courant} etoiles={etoilesDuNiveau(courant, etat)} />
      </ScrollView>
    </View>
  );
}

function EtoileNiveau({ pleine }: { pleine: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M12 3l2.5 5.5 6 .6-4.5 4 1.3 5.9L12 21l-5.3 2.9 1.3-5.9-4.5-4 6-.6Z" fill={pleine ? '#f2da33' : '#e4ddef'} />
    </Svg>
  );
}

function CarteNiveau({ n, etoiles }: { n: number; etoiles: number }) {
  const p = paramsNiveau(n);
  return (
    <View style={styles.nivCarte}>
      <View style={styles.nivHaut}>
        <Text style={styles.nivTitre}>Niveau {n}</Text>
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {[1, 2, 3].map((i) => <EtoileNiveau key={i} pleine={i <= etoiles} />)}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={styles.nivInfo}>
          <Text style={styles.nivInfoLabel}>Objectif</Text>
          <Text style={styles.nivInfoVal} numberOfLines={1}>{objectifLabel(p.objectif).replace(' 👹', '')}</Text>
        </View>
        <View style={styles.nivInfo}>
          <Text style={styles.nivInfoLabel}>Munitions</Text>
          <Text style={styles.nivInfoVal}>{p.tirsMax} tirs</Text>
        </View>
      </View>
      <Pressable
        style={styles.nivCta}
        onPress={() => router.push(`/jeu/shooter?niveau=${n}` as any)}
        accessibilityRole="button"
        accessibilityLabel={`Jouer le niveau ${n}`}
      >
        <Text style={styles.nivCtaTxt}>Jouer le niveau {n} ›</Text>
      </Pressable>
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
      <Path d={dChemin} stroke="rgba(255,255,255,0.5)" strokeWidth={1} strokeDasharray="0.1 1.8" strokeLinecap="round" fill="none" />
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
        {boss && <View style={{ marginBottom: -3 }}><Icone nom="couronne" taille={16} /></View>}
        {jouable ? (
          <Text style={[
            styles.noeudNb,
            fait && { color: '#fff' },
            courant && !fait && { color: '#fff' },
          ]}>
            {n}
          </Text>
        ) : (
          <Icone nom="cadenas" taille={22} />
        )}
      </Pressable>
      {/* étoiles sous le nœud */}
      <View style={{ flexDirection: 'row', marginTop: 3, gap: 1 }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ opacity: fait ? (i <= etoiles ? 1 : 0.2) : 0 }}><Icone nom="etoile" taille={12} /></View>
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

  // Vallée des Perles : carte au trésor violette immersive
  vallee: {
    backgroundColor: C.violet, borderRadius: R.carte, paddingVertical: 14,
    overflow: 'hidden', ...OMBRE_VIOLETTE,
  },
  valleePill: {
    alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)', borderRadius: R.pill,
    paddingVertical: 6, paddingHorizontal: 16, marginBottom: 4, zIndex: 2,
  },
  valleePillTxt: { fontFamily: F.titre, fontSize: 14.5, color: '#fff' },

  noeud: {
    backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
  },
  noeudFait: { backgroundColor: C.vert, borderColor: '#fff' },
  noeudCourant: { backgroundColor: C.rose, borderColor: '#fff' },
  noeudVerrou: { backgroundColor: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.55)' },
  noeudBoss: { borderColor: C.jaune },
  noeudNb: { fontFamily: F.titre, fontSize: 21, color: C.violet },

  chipJoue: {
    marginTop: 4, backgroundColor: '#fff', borderRadius: R.pill,
    paddingVertical: 3, paddingHorizontal: 10,
  },
  chipJoueTxt: { fontFamily: F.titre, fontSize: 10.5, color: C.violet },

  // Carte « Niveau N » (maquette 3a)
  nivCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 11,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  nivHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nivTitre: { fontFamily: F.titre, fontSize: 18, color: C.violet },
  nivInfo: { flex: 1, backgroundColor: C.fond, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 11, gap: 1 },
  nivInfoLabel: { fontFamily: F.t600, fontSize: 11, color: '#9384AC' },
  nivInfoVal: { fontFamily: F.t800, fontSize: 13, color: C.texte },
  nivCta: {
    backgroundColor: C.vert, borderRadius: R.btn, paddingVertical: 14, alignItems: 'center',
    borderBottomWidth: 5, borderBottomColor: '#6F8F1F',
  },
  nivCtaTxt: { fontFamily: F.titre, fontSize: 17, color: '#2C380C' },
});
