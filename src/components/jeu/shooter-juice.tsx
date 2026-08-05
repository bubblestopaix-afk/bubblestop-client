// === Boba Quest — juice du Perle Rush : boss incarné + copain de tir ===
// Composants purement visuels (Animated natif, aucune nouvelle dépendance) :
// • BossShooter : le légendaire prête son visage au boss — respiration, choc
//   aux dégâts, 3 attitudes selon la phase, badge animé de l'attaque annoncée.
// • BuddyLanceur : le copain équipé s'anime près du lanceur — flottement,
//   saut de joie sur match, grimace sur raté, excitation quand le Shaker est prêt.
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import PastilleCollectible from '@/components/jeu/collectibles';
import type { BossActionTir } from '@/components/jeu/moteur-shooter';
import { labelBossActionTir } from '@/components/jeu/moteur-shooter';

// 🎨 palette DA — copie locale volontaire (même pattern que plateau-skia.tsx) :
// si constants/charte.ts change, aligner ces teintes à la main.
const PAL = {
  violet: '#633E90',
  jaune: '#F2DA33',
  orange: '#F7A14B',
  rouge: '#E8556A',
  fondSombre: '#3A2036',
  blanc: '#FFFFFF',
};

// 🎯 pictos des attaques du boss (badge au-dessus du visage)
const BADGES_ACTION: Record<BossActionTir, string> = {
  givre: '❄️',
  descente: '🌧️',
  'verrou-swap': '🎨',
};

// --- 👑 Boss incarné ---------------------------------------------------------
// perso : id collectible du légendaire (bossPersonnage(niveau) côté moteur)
// pvRatio : objProgres / PV — sa hausse déclenche le choc (dégâts subis)
// phase : 1 calme → 2 fébrile → 3 enragé (anneau, cadence, rotation)
export function BossShooter({
  perso, phase, pvRatio, action, imminent, taille = 46,
}: {
  perso: string;
  phase: 1 | 2 | 3;
  pvRatio: number;
  action: BossActionTir;
  imminent: boolean;
  taille?: number;
}) {
  const souffle = useRef(new Animated.Value(0)).current;
  const coup = useRef(new Animated.Value(1)).current; // 1 = repos
  const badgeAv = useRef(new Animated.Value(0)).current;
  const pvRef = useRef(pvRatio);

  // 🫁 respiration : la cadence trahit l'état du boss (calme → fébrile → enragé)
  const dureeSouffle = phase === 3 ? 520 : phase === 2 ? 850 : 1300;
  useEffect(() => {
    souffle.setValue(0);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(souffle, { toValue: 1, duration: dureeSouffle, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(souffle, { toValue: 0, duration: dureeSouffle, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [souffle, dureeSouffle]);

  // 💥 dégâts subis : tremblement horizontal + punch de scale (une fois par coup)
  useEffect(() => {
    if (pvRatio > pvRef.current + 0.001) {
      coup.setValue(0);
      Animated.timing(coup, {
        toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true,
      }).start();
    }
    pvRef.current = pvRatio;
  }, [pvRatio, coup]);

  // 🎯 badge de l'attaque annoncée : pulse continu, frénétique quand imminente
  useEffect(() => {
    const duree = imminent ? 260 : 620;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(badgeAv, { toValue: 1, duration: duree, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(badgeAv, { toValue: 0, duration: duree, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [badgeAv, imminent, action]);

  // 3 attitudes : couleur d'anneau + amplitude de rotation selon la phase
  const anneau = phase === 3 ? PAL.rouge : phase === 2 ? PAL.orange : PAL.violet;
  const rotMax = phase === 3 ? 4 : phase === 2 ? 2 : 0;
  const tailleAnneau = taille + 8;
  return (
    <Animated.View
      style={{
        width: taille, height: taille,
        transform: [
          // 💥 choc : va-et-vient amorti
          {
            translateX: coup.interpolate({
              inputRange: [0, 0.2, 0.45, 0.7, 1],
              outputRange: [0, -taille * 0.16, taille * 0.13, -taille * 0.06, 0],
            }),
          },
          // 😤 attitude : le boss s'agite de plus en plus
          {
            rotate: souffle.interpolate({
              inputRange: [0, 1],
              outputRange: [`${-rotMax}deg`, `${rotMax}deg`],
            }),
          },
          // 🫁 respiration × 💥 punch de dégâts
          {
            scale: Animated.multiply(
              souffle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }),
              coup.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1.18, 1] }),
            ),
          },
        ],
      }}
    >
      {/* anneau d'attitude (pouls de couleur derrière la pastille) */}
      <Animated.View
        pointerEvents="none"
        style={[styles.anneauBoss, {
          width: tailleAnneau, height: tailleAnneau, borderRadius: tailleAnneau / 2,
          top: -4, left: -4, borderColor: anneau,
          opacity: souffle.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
        }]}
      />
      <PastilleCollectible id={perso} taille={taille} />
      {/* 🎯 badge de l'attaque annoncée, au-dessus du visage */}
      <Animated.View
        pointerEvents="none"
        accessibilityLabel={`Prochaine attaque : ${labelBossActionTir(action)}`}
        style={[styles.badgeBoss, imminent && styles.badgeBossImminent, {
          transform: [
            { scale: badgeAv.interpolate({ inputRange: [0, 1], outputRange: [1, imminent ? 1.3 : 1.12] }) },
            { translateY: badgeAv.interpolate({ inputRange: [0, 1], outputRange: [0, imminent ? -2.5 : 0] }) },
          ],
        }]}
      >
        <Text style={styles.badgeBossTxt}>{BADGES_ACTION[action]}</Text>
      </Animated.View>
    </Animated.View>
  );
}

// --- 🧋 Copain de tir ---------------------------------------------------------
// matchSignal / rateSignal : compteurs qui CHANGENT à chaque événement → la
// réaction se déclenche sur front (comparaison avec la valeur précédente).
export function BuddyLanceur({
  buddyId, taille, fever, matchSignal, rateSignal,
}: {
  buddyId: string;
  taille: number;
  fever: boolean;
  matchSignal: number;
  rateSignal: number;
}) {
  const flotte = useRef(new Animated.Value(0)).current;
  const saut = useRef(new Animated.Value(1)).current;    // 1 = repos
  const grimace = useRef(new Animated.Value(1)).current; // 1 = repos
  const excite = useRef(new Animated.Value(0)).current;
  const matchRef = useRef(matchSignal);
  const rateRef = useRef(rateSignal);

  // 🎈 flottement de fond (idle)
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(flotte, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(flotte, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [flotte]);

  // 🎉 saut de joie sur match
  useEffect(() => {
    if (matchSignal === matchRef.current) return;
    matchRef.current = matchSignal;
    saut.setValue(0);
    Animated.timing(saut, {
      toValue: 1, duration: 460, easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start();
  }, [matchSignal, saut]);

  // 😬 grimace (inclinaison + petite chute) sur raté
  useEffect(() => {
    if (rateSignal === rateRef.current) return;
    rateRef.current = rateSignal;
    grimace.setValue(0);
    Animated.timing(grimace, {
      toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start();
  }, [rateSignal, grimace]);

  // 🤩 excitation tant que le Shaker est chargé (pulse + étincelles)
  useEffect(() => {
    if (!fever) { excite.setValue(0); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(excite, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(excite, { toValue: 0, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => { loop.stop(); excite.setValue(0); };
  }, [fever, excite]);

  const etincelles = [
    { left: -taille * 0.08, top: -taille * 0.1 },
    { right: -taille * 0.08, top: taille * 0.18 },
    { left: taille * 0.42, top: -taille * 0.16 },
  ];
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        width: taille, height: taille,
        transform: [
          // 🎈 idle + 🎉 joie (les translateY se composent)
          { translateY: flotte.interpolate({ inputRange: [0, 1], outputRange: [0, -taille * 0.09] }) },
          {
            translateY: saut.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0, -taille * 0.5, 0],
            }),
          },
          // 😬 grimace : tangage puis redressement
          {
            rotate: grimace.interpolate({
              inputRange: [0, 0.3, 0.65, 1],
              outputRange: ['0deg', '-13deg', '8deg', '0deg'],
            }),
          },
          {
            translateY: grimace.interpolate({
              inputRange: [0, 0.3, 1],
              outputRange: [0, taille * 0.08, 0],
            }),
          },
          // 🎉 punch de joie × 🤩 pulse d'excitation
          {
            scale: Animated.multiply(
              saut.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1, 1.16, 1] }),
              excite.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] }),
            ),
          },
        ],
      }}
    >
      {/* ✨ étincelles d'excitation (Shaker prêt) */}
      {fever && etincelles.map((pos, i) => (
        <Animated.Text
          key={i}
          style={[styles.etincelle, pos, {
            fontSize: taille * 0.26,
            opacity: excite.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
            transform: [{ scale: excite.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.25] }) }],
          }]}
        >
          ✨
        </Animated.Text>
      ))}
      <PastilleCollectible id={buddyId} taille={taille} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anneauBoss: { position: 'absolute', borderWidth: 2.5 },
  badgeBoss: {
    position: 'absolute', top: -7, right: -9,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: PAL.fondSombre,
    borderWidth: 1.5, borderColor: PAL.jaune,
  },
  badgeBossImminent: { borderColor: PAL.rouge, backgroundColor: '#571E2C' },
  badgeBossTxt: { fontSize: 11.5 },
  etincelle: { position: 'absolute' },
});

// PAL est volontairement local (voir note 🎨 plus haut) — exporté pour les tests visuels.
export { PAL as PALETTE_JUICE };
