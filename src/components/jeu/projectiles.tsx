// === Boba Quest — 🎬 PROJECTILES & EFFETS D'ATTAQUE (couche visuelle du duel) ===
// Pack 3 : une attaque se VOIT. Table nom d'attaque → famille visuelle + couleur
// (les 48 attaques des 24 cartes d'arene.ts), puis composants 100 % Animated en
// driver NATIF (translate/scale/rotate/opacity — aucune nouvelle dépendance,
// compatible OTA). AUCUNE logique de combat ici : duel.tsx déclenche à
// l'événement « annonce », chaque composant joue son animation UNE fois puis
// appelle onTermine() → l'écran le démonte proprement (zéro re-render à 60 fps,
// le tour suivant n'est jamais bloqué par une animation).

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import type { CoteCombat, TypeAttaque } from '@/components/jeu/arene';

// --- 🎨 Familles visuelles -----------------------------------------------------

export type FamilleVisuelle =
  | 'graines'    // éventail de petites graines qui fusent
  | 'perle-bond' // boule qui rebondit en arcs
  | 'rouleau'    // grosse boule qui roule en grossissant
  | 'shuriken'   // palet qui tournoie
  | 'liquide'    // goutte / éclaboussure en arc
  | 'brume'      // nuée qui dérive (+ 💤 si ça peut étourdir)
  | 'melee'      // PAS de projectile : assaut de la carte + étoile d'impact
  | 'double'     // deux projectiles rapides successifs
  | 'zone'       // pluie de mini-projectiles sur la zone ennemie
  | 'soin'       // étincelles vertes qui montent sur SA carte
  | 'boost'      // aura dorée pulsée sur SA carte
  | 'bouclier';  // bulle qui se matérialise sur SA carte

export type VisuelAttaque = {
  famille: FamilleVisuelle;
  couleur: string;   // projectile + burst/étoile à l'impact
  couleur2?: string; // détail (noyau de graine, liseré de perle rare…)
  etoiles?: boolean; // 💤 l'attaque peut étourdir → étoiles en fin de vol
};

// 🗺️ TABLE des 48 attaques (stats d'arene.ts) → famille + couleur thématique.
// Regroupée par carte, dans le même ordre que les FICHES du moteur.
const VISUELS_ATTAQUES: Record<string, VisuelAttaque> = {
  // 🧋 Base — Boba & cie
  'Boulet de tapioca': { famille: 'perle-bond', couleur: '#3A2A3E' },
  'Roulade géante': { famille: 'rouleau', couleur: '#3A2A3E' },
  'Gorgée classique': { famille: 'liquide', couleur: '#C98F5A' },
  'Recette originale': { famille: 'boost', couleur: '#F5A93B' },
  'Coup de sachet': { famille: 'liquide', couleur: '#B5986B' },
  'Infusion soporifique': { famille: 'brume', couleur: '#A9B7D8', etoiles: true },
  'Éclaboussure': { famille: 'liquide', couleur: '#E3C9A8' },
  'Bain de lait': { famille: 'soin', couleur: '#7CB342' },
  'Pique-paille': { famille: 'melee', couleur: '#F27D9C' },
  'Rafale de pailles': { famille: 'double', couleur: '#F27D9C' },
  'Jet de sucre': { famille: 'liquide', couleur: '#F2C14E' },
  'Rush de glucose': { famille: 'boost', couleur: '#F5A93B' },
  // 🍓 Fruités
  'Pépin perçant': { famille: 'melee', couleur: '#E84A6F' },
  'Tourbillon fraise': { famille: 'double', couleur: '#E84A6F' },
  'Tranche tropicale': { famille: 'shuriken', couleur: '#F5A93B' },
  'Soleil de mangue': { famille: 'perle-bond', couleur: '#F5A93B' },
  'Coquille dure': { famille: 'melee', couleur: '#E2543E' },
  'Parfum enivrant': { famille: 'brume', couleur: '#D98FBF', etoiles: true },
  'Graines folles': { famille: 'graines', couleur: '#F2DA33', couleur2: '#4A2B1A' },
  'Cœur de Maracudja': { famille: 'boost', couleur: '#F2DA33' },
  'Zeste acide': { famille: 'shuriken', couleur: '#C8D42A' },
  'Pluie acide': { famille: 'zone', couleur: '#C8D42A' },
  'Coup de tranche': { famille: 'melee', couleur: '#3E9B4F' },
  'Carapace de pastèque': { famille: 'bouclier', couleur: '#3E9B4F' },
  // ✨ Onctueux (toppings)
  'Bulle qui claque': { famille: 'perle-bond', couleur: '#F7B8D6' },
  'Explosion popping': { famille: 'zone', couleur: '#F7B8D6' },
  'Rebond gélatineux': { famille: 'melee', couleur: '#F7B8D6' },
  'Mur de gelée': { famille: 'bouclier', couleur: '#F7B8D6' },
  'Tape moelleuse': { famille: 'melee', couleur: '#C9BBA8' },
  'Câlin mochi': { famille: 'soin', couleur: '#7CB342' },
  'Noix de coco': { famille: 'perle-bond', couleur: '#7A4B26' },
  'Lait de coco': { famille: 'soin', couleur: '#7CB342' },
  'Flan flan': { famille: 'perle-bond', couleur: '#D8A24A' },
  'Caramélisation': { famille: 'boost', couleur: '#C9761F' },
  'Coup de brume': { famille: 'brume', couleur: '#C9BEDC' },
  'Cocon de chantilly': { famille: 'soin', couleur: '#7CB342' },
  // 👑 Signatures
  'Sceptre taro': { famille: 'melee', couleur: '#B98FE0' },
  'Décret royal': { famille: 'perle-bond', couleur: '#9A6BD8' },
  'Fouet cérémonial': { famille: 'melee', couleur: '#4E7A3A' },
  'Méditation zen': { famille: 'brume', couleur: '#A8C6A0', etoiles: true },
  'Rayure de caramel': { famille: 'shuriken', couleur: '#C9761F' },
  'Couronne fondante': { famille: 'boost', couleur: '#C99012' },
  'Morsure tigrée': { famille: 'melee', couleur: '#E8962A' },
  'Marée brown sugar': { famille: 'zone', couleur: '#8A5A2A' },
  'Louche brûlante': { famille: 'liquide', couleur: '#C9761F' },
  'Nappage réparateur': { famille: 'soin', couleur: '#7CB342' },
  'Perle suprême': { famille: 'perle-bond', couleur: '#2E1F3D', couleur2: '#C99012' },
  'Jugement du Boba': { famille: 'rouleau', couleur: '#C99012' },
};

// 🛟 Repli par TYPE : un nom absent de la table (futur contenu) ne crashe jamais,
// il hérite d'un visuel générique cohérent avec son effet.
const REPLI_PAR_TYPE: Record<TypeAttaque, VisuelAttaque> = {
  degats: { famille: 'perle-bond', couleur: '#8A6FB8' },
  double: { famille: 'double', couleur: '#8A6FB8' },
  zone: { famille: 'zone', couleur: '#8A6FB8' },
  etourdit: { famille: 'brume', couleur: '#C9BEDC', etoiles: true },
  soin: { famille: 'soin', couleur: '#7CB342' },
  boost: { famille: 'boost', couleur: '#F5A93B' },
  bouclier: { famille: 'bouclier', couleur: '#7FB3E8' },
};

export function visuelAttaque(nom: string, type: TypeAttaque): VisuelAttaque {
  return VISUELS_ATTAQUES[nom] ?? REPLI_PAR_TYPE[type] ?? REPLI_PAR_TYPE.degats;
}

// --- 📍 Repères de la zone de combat --------------------------------------------

export type PointZone = { x: number; y: number };

// Centre de la pastille de la carte active, en fractions de la zone MESURÉE :
// l'adversaire (b) est en haut avec sa pastille à DROITE (row-reverse), le
// joueur (a) en bas, pastille à GAUCHE. Approximation assumée : le burst
// d'impact fait ~124 px, la cible est large — ça se lit sans mesure exacte.
export function positionCarte(cote: CoteCombat, largeur: number, hauteur: number): PointZone {
  return cote === 'a'
    ? { x: largeur * 0.2, y: hauteur * 0.85 }
    : { x: largeur * 0.8, y: hauteur * 0.15 };
}

// ⏱️ Durées de référence à vitesse ×1 (duel.tsx les divise par la vitesse ×1/×2)
// ⚠️ Ces deux durées sont des SYNCHRONISATIONS, pas de simples réglages de rythme :
// `duel.tsx` attend exactement le temps de l'effet avant d'afficher l'impact, pour que
// le projectile ARRIVE au moment où les dégâts s'affichent. Le 27/07, l'attente de
// l'annonce a été raccourcie sans elles : les dégâts apparaissaient avant l'arrivée du
// projectile, et l'attaque se lisait comme si elle n'avait plus d'animation du tout.
// Elles ont été resserrées ici (520 → 380, 640 → 460) pour garder le gain de rythme —
// mais l'écran les LIT désormais, il ne les redevine plus.
export const DUREE_VOL_MS = 380;
export const DUREE_SOI_MS = 460;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// 🔁 Un seul Animated.Value par effet, lancé UNE fois au montage (pattern de
// JaugeTiming) : toutes les particules lisent `prog` par interpolations → aucun
// setState pendant l'animation, tout part sur le thread natif.
function useProgression(duree: number, onTermine: () => void) {
  const prog = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(prog, { toValue: 1, duration: duree, easing: Easing.linear, useNativeDriver: true });
    anim.start(({ finished }) => { if (finished) onTermine(); });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return prog;
}

// --- 🚀 Vol de projectile (annonce → impact) --------------------------------------

export function VolAttaque({ cote, visuel, largeur, hauteur, duree, onTermine }: {
  cote: CoteCombat;
  visuel: VisuelAttaque;
  largeur: number;
  hauteur: number;
  duree: number;
  onTermine: () => void;
}) {
  // 🐢 la brume dérive plus lentement, le rouleau prend son élan ; le double
  // étire sa fenêtre pour que le 2ᵉ projectile atterrisse avec le 2ᵉ impact
  const dureeFamille = visuel.famille === 'brume' ? duree + 120
    : visuel.famille === 'rouleau' ? duree + 40
      : visuel.famille === 'double' ? Math.round(duree * 2.05)
        : duree;
  const prog = useProgression(dureeFamille, onTermine);

  const depart = positionCarte(cote, largeur, hauteur);
  const arrivee = positionCarte(cote === 'a' ? 'b' : 'a', largeur, hauteur);
  const txDroit = prog.interpolate({ inputRange: [0, 1], outputRange: [depart.x, arrivee.x] });
  // 💨 fondu de fin de vol : un toucher = le burst prend le relais, un raté = le
  // projectile s'évanouit (l'esquive se LIT, sans mot de plus).
  const opFin = prog.interpolate({ inputRange: [0, 0.86, 1], outputRange: [1, 1, 0] });

  switch (visuel.famille) {
    case 'perle-bond': {
      // 🟤 deux arcs de rebond de plus en plus petits
      const ty = prog.interpolate({
        inputRange: [0, 0.24, 0.46, 0.68, 0.88, 1],
        outputRange: [
          depart.y,
          lerp(depart.y, arrivee.y, 0.24) - hauteur * 0.15,
          lerp(depart.y, arrivee.y, 0.46),
          lerp(depart.y, arrivee.y, 0.68) - hauteur * 0.085,
          lerp(depart.y, arrivee.y, 0.88),
          arrivee.y,
        ],
      });
      const sc = prog.interpolate({ inputRange: [0, 0.88, 0.96, 1], outputRange: [0.85, 1, 1.25, 0.7] });
      return (
        <Animated.View style={[styles.point, { opacity: opFin, transform: [{ translateX: txDroit }, { translateY: ty }, { scale: sc }] }]}>
          <View style={[styles.boule22, { backgroundColor: visuel.couleur, borderColor: visuel.couleur2 ?? 'transparent', borderWidth: visuel.couleur2 ? 2.5 : 0 }]}>
            <View style={styles.reflet} />
          </View>
        </Animated.View>
      );
    }
    case 'rouleau': {
      // 🎳 grosse boule qui roule bas et grossit en approchant
      const ty = prog.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [depart.y, lerp(depart.y, arrivee.y, 0.5) - hauteur * 0.04, arrivee.y],
      });
      const rot = prog.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
      const sc = prog.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.35] });
      return (
        <Animated.View style={[styles.point, { opacity: opFin, transform: [{ translateX: txDroit }, { translateY: ty }, { rotate: rot }, { scale: sc }] }]}>
          <View style={[styles.boule30, { backgroundColor: visuel.couleur }]}>
            <View style={styles.refletGros} />
          </View>
        </Animated.View>
      );
    }
    case 'shuriken': {
      // ⭐ palet en étoile qui tournoie, trajectoire directe et rapide
      const ty = prog.interpolate({ inputRange: [0, 1], outputRange: [depart.y, arrivee.y] });
      const rot = prog.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] });
      return (
        <Animated.View style={[styles.point, { opacity: opFin, transform: [{ translateX: txDroit }, { translateY: ty }, { rotate: rot }] }]}>
          <View style={[styles.carre18, { backgroundColor: visuel.couleur }]} />
          <View style={[styles.carre18, styles.carre45, { backgroundColor: visuel.couleur }]} />
          <View style={styles.coeurPalet} />
        </Animated.View>
      );
    }
    case 'liquide': {
      // 💧 goutte principale en arc + 2 gouttelettes de traîne
      const arcY = (d0: number, d1: number) => prog.interpolate({
        inputRange: [d0, lerp(d0, d1, 0.45), d1],
        outputRange: [depart.y, lerp(depart.y, arrivee.y, 0.45) - hauteur * 0.2, arrivee.y],
        extrapolate: 'clamp',
      });
      const goutte = (i: number) => {
        const d0 = i * 0.08, d1 = Math.min(1, 0.84 + i * 0.08);
        const tx = prog.interpolate({ inputRange: [d0, d1], outputRange: [depart.x, arrivee.x], extrapolate: 'clamp' });
        const op = prog.interpolate({ inputRange: [d0, d0 + 0.05, d1 - 0.08, d1], outputRange: [0, i === 0 ? 1 : 0.6, i === 0 ? 1 : 0.6, 0], extrapolate: 'clamp' });
        const taille = i === 0 ? 15 : 8;
        return (
          <Animated.View key={i} style={[styles.point, { opacity: op, transform: [{ translateX: tx }, { translateY: arcY(d0, d1) }] }]}>
            <View style={{ position: 'absolute', left: -taille / 2, top: -taille / 2, width: taille, height: taille, borderRadius: taille / 2, backgroundColor: visuel.couleur }} />
            {i === 0 && <View style={[styles.pointeGoutte, { backgroundColor: visuel.couleur }]} />}
          </Animated.View>
        );
      };
      return <>{[0, 1, 2].map(goutte)}</>;
    }
    case 'graines': {
      // 🌻 5 graines en éventail, chacune décalée sur la perpendiculaire du tir
      const dx = arrivee.x - depart.x, dy = arrivee.y - depart.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      return (
        <>
          {[0, 1, 2, 3, 4].map((i) => {
            const d0 = i * 0.055, d1 = Math.min(1, d0 + 0.62);
            const k = (i - 2) / 2; // -1 … 1 : ouverture de l'éventail
            const fx = (-dy / len) * k * 30, fy = (dx / len) * k * 30;
            const sx = prog.interpolate({ inputRange: [d0, d1], outputRange: [depart.x, arrivee.x + fx], extrapolate: 'clamp' });
            const sy = prog.interpolate({
              inputRange: [d0, lerp(d0, d1, 0.5), d1],
              outputRange: [depart.y, lerp(depart.y, arrivee.y + fy, 0.5) - hauteur * (0.1 + 0.03 * i), arrivee.y + fy],
              extrapolate: 'clamp',
            });
            const sop = prog.interpolate({ inputRange: [d0, d0 + 0.05, d1 - 0.08, d1], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
            return (
              <Animated.View key={i} style={[styles.point, { opacity: sop, transform: [{ translateX: sx }, { translateY: sy }] }]}>
                <View style={[styles.pulpe, { backgroundColor: visuel.couleur }]}>
                  <View style={[styles.noyau, { backgroundColor: visuel.couleur2 ?? '#4A2B1A' }]} />
                </View>
              </Animated.View>
            );
          })}
        </>
      );
    }
    case 'brume': {
      // ☁️ 4 bouffées qui dérivent en gonflant + 💤/✦ si ça peut étourdir
      return (
        <>
          {[0, 1, 2, 3].map((i) => {
            const d0 = i * 0.07;
            const offx = ((i % 2) * 2 - 1) * (8 + i * 5);
            const offy = (i < 2 ? -1 : 1) * (6 + i * 3);
            const bx = prog.interpolate({ inputRange: [d0, 1], outputRange: [depart.x + offx, arrivee.x + offx * 1.4], extrapolate: 'clamp' });
            const by = prog.interpolate({ inputRange: [d0, 1], outputRange: [depart.y + offy, arrivee.y + offy], extrapolate: 'clamp' });
            const bop = prog.interpolate({ inputRange: [d0, d0 + 0.14, 0.82, 1], outputRange: [0, 0.85, 0.85, 0], extrapolate: 'clamp' });
            const bsc = prog.interpolate({ inputRange: [d0, 1], outputRange: [0.55, 1.2], extrapolate: 'clamp' });
            const taille = 16 + (i % 2) * 8;
            return (
              <Animated.View key={i} style={[styles.point, { opacity: bop, transform: [{ translateX: bx }, { translateY: by }, { scale: bsc }] }]}>
                <View style={{ position: 'absolute', left: -taille / 2, top: -taille / 2, width: taille, height: taille, borderRadius: taille / 2, backgroundColor: visuel.couleur }} />
              </Animated.View>
            );
          })}
          {visuel.etoiles && ['💤', '✦', '✦'].map((s, i) => {
            const d0 = 0.55 + i * 0.1;
            const eop = prog.interpolate({ inputRange: [d0, d0 + 0.12, 0.95, 1], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
            const ey = prog.interpolate({ inputRange: [d0, 1], outputRange: [arrivee.y - 10 - i * 8, arrivee.y - 46 - i * 14], extrapolate: 'clamp' });
            const erot = prog.interpolate({ inputRange: [d0, 1], outputRange: ['-10deg', '12deg'], extrapolate: 'clamp' });
            return (
              <Animated.Text key={`e${i}`} style={[styles.zzz, { opacity: eop, transform: [{ translateX: arrivee.x + (i - 1) * 16 }, { translateY: ey }, { rotate: erot }] }]}>
                {s}
              </Animated.Text>
            );
          })}
        </>
      );
    }
    case 'double': {
      // ⚡ deux projectiles rapides successifs : le 1ᵉʳ atterrit avec le 1ᵉʳ
      // impact (~annonce+520 ms), le 2ᵉ est cadencé sur le 2ᵉ coup du moteur.
      return (
        <>
          {[0, 1].map((i) => {
            const d0 = i === 0 ? 0 : 0.5, d1 = i === 0 ? 0.44 : 0.96;
            const bx = prog.interpolate({ inputRange: [d0, d1], outputRange: [depart.x, arrivee.x], extrapolate: 'clamp' });
            const by = prog.interpolate({
              inputRange: [d0, lerp(d0, d1, 0.5), d1],
              outputRange: [depart.y, lerp(depart.y, arrivee.y, 0.5) - hauteur * 0.12, arrivee.y],
              extrapolate: 'clamp',
            });
            const bop = prog.interpolate({ inputRange: [d0, d0 + 0.05, d1 - 0.07, d1], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
            return (
              <Animated.View key={i} style={[styles.point, { opacity: bop, transform: [{ translateX: bx }, { translateY: by }] }]}>
                <View style={[styles.boule13, { backgroundColor: visuel.couleur }]}>
                  <View style={styles.reflet} />
                </View>
              </Animated.View>
            );
          })}
        </>
      );
    }
    case 'zone': {
      // 🌧️ pluie de 8 mini-projectiles sur toute la zone ennemie (décalés, étirés)
      return (
        <>
          {Array.from({ length: 8 }).map((_, i) => {
            const d0 = i * 0.05, d1 = Math.min(1, d0 + 0.5);
            const zx = arrivee.x + (((i * 53) % 5) - 2) * 24;
            const zy = prog.interpolate({
              inputRange: [d0, d1],
              outputRange: [arrivee.y - hauteur * 0.3 - (i % 3) * 22, arrivee.y + ((i % 3) - 1) * 12],
              extrapolate: 'clamp',
            });
            const zop = prog.interpolate({ inputRange: [d0, d0 + 0.04, d1 - 0.06, d1], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
            return (
              <Animated.View key={i} style={[styles.point, { opacity: zop, transform: [{ translateX: zx }, { translateY: zy }, { scaleY: 1.7 }] }]}>
                <View style={[{ position: 'absolute', left: -3.5, top: -3.5, width: 7, height: 7, borderRadius: 3.5 }, { backgroundColor: visuel.couleur }]} />
              </Animated.View>
            );
          })}
        </>
      );
    }
    default:
      // 🤜 melee : pas de projectile (assaut de la carte + étoile, côté duel.tsx) ;
      // soin/boost/bouclier : effet « soi » (EffetSoi). Rien à dessiner ici.
      return null;
  }
}

// --- ✨ Effets « soi » : soin / boost / bouclier sur SA propre carte ----------------

export function EffetSoi({ famille, position, couleur, duree, onTermine }: {
  famille: 'soin' | 'boost' | 'bouclier';
  position: PointZone;
  couleur: string;
  duree: number;
  onTermine: () => void;
}) {
  const prog = useProgression(duree, onTermine);

  if (famille === 'soin') {
    // 💚 7 étincelles qui montent le long de la carte (alternance rond/croix)
    return (
      <>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const d0 = i * 0.07;
          const ox = (((i * 37) % 5) - 2) * 13;
          const sop = prog.interpolate({ inputRange: [d0, d0 + 0.1, 0.9, 1], outputRange: [0, 1, 0.9, 0], extrapolate: 'clamp' });
          const sy = prog.interpolate({ inputRange: [d0, 1], outputRange: [position.y + 16, position.y - 72], extrapolate: 'clamp' });
          const ssc = prog.interpolate({ inputRange: [d0, d0 + 0.1, 1], outputRange: [0.4, 1, 0.6], extrapolate: 'clamp' });
          return (
            <Animated.View key={i} style={[styles.point, { opacity: sop, transform: [{ translateX: position.x + ox }, { translateY: sy }, { scale: ssc }] }]}>
              {i % 2 === 0 ? (
                <View style={[styles.etincelle, { backgroundColor: couleur }]} />
              ) : (
                <View style={styles.croix}>
                  <View style={[styles.croixBarreH, { backgroundColor: couleur }]} />
                  <View style={[styles.croixBarreV, { backgroundColor: couleur }]} />
                </View>
              )}
            </Animated.View>
          );
        })}
      </>
    );
  }

  if (famille === 'boost') {
    // 💪 anneau doré pulsé deux fois autour de la carte
    const rop = prog.interpolate({ inputRange: [0, 0.14, 0.45, 0.6, 0.9, 1], outputRange: [0, 0.9, 0.15, 0.85, 0.1, 0] });
    const rsc = prog.interpolate({ inputRange: [0, 0.45, 0.6, 1], outputRange: [0.7, 1.22, 0.85, 1.34] });
    return (
      <Animated.View style={[styles.point, { opacity: rop, transform: [{ translateX: position.x }, { translateY: position.y }, { scale: rsc }] }]}>
        <View style={[styles.anneauBoost, { borderColor: couleur }]} />
      </Animated.View>
    );
  }

  // 🫧 bouclier : bulle qui se matérialise (rebond d'apparition) puis se dissout
  const bop = prog.interpolate({ inputRange: [0, 0.18, 0.78, 1], outputRange: [0, 1, 1, 0] });
  const bsc = prog.interpolate({ inputRange: [0, 0.55, 0.75, 1], outputRange: [0.2, 1.07, 0.98, 1.02] });
  return (
    <Animated.View style={[styles.point, { opacity: bop, transform: [{ translateX: position.x }, { translateY: position.y }, { scale: bsc }] }]}>
      <View style={[styles.bulle, { borderColor: couleur, backgroundColor: `${couleur}2E` }]}>
        <View style={styles.bulleReflet} />
      </View>
    </Animated.View>
  );
}

// --- ⭐ Étoile d'impact de MÊLÉE (le « contact » du coup, sur la cible) ------------

export function EtoileImpact({ position, couleur, onTermine }: {
  position: PointZone;
  couleur: string;
  onTermine: () => void;
}) {
  const prog = useProgression(340, onTermine);
  const op = prog.interpolate({ inputRange: [0, 0.12, 0.7, 1], outputRange: [0, 1, 1, 0] });
  const sc = prog.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.3, 1.15, 1.45] });
  const rot = prog.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '14deg'] });
  return (
    <Animated.View style={[styles.point, { opacity: op, transform: [{ translateX: position.x }, { translateY: position.y }, { scale: sc }, { rotate: rot }] }]}>
      <View style={[styles.carre30, { backgroundColor: couleur }]} />
      <View style={[styles.carre30, styles.carre45, { backgroundColor: couleur }]} />
      <View style={styles.coeurEtoile} />
    </Animated.View>
  );
}

// --- 💅 Styles : chaque forme est centrée sur son point par left/top négatifs ------
// (le wrapper `point` est un point 0×0 que les transforms translate déplacent —
// tout passe par le driver natif, jamais de re-layout).

const styles = StyleSheet.create({
  point: { position: 'absolute', left: 0, top: 0 },
  boule22: {
    position: 'absolute', left: -11, top: -11, width: 22, height: 22, borderRadius: 11,
  },
  boule30: {
    position: 'absolute', left: -15, top: -15, width: 30, height: 30, borderRadius: 15,
  },
  boule13: {
    position: 'absolute', left: -6.5, top: -6.5, width: 13, height: 13, borderRadius: 6.5,
  },
  reflet: {
    position: 'absolute', left: 4, top: 3, width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  refletGros: {
    position: 'absolute', left: 5, top: 4, width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  carre18: {
    position: 'absolute', left: -9, top: -9, width: 18, height: 18, borderRadius: 4,
  },
  carre30: {
    position: 'absolute', left: -15, top: -15, width: 30, height: 30, borderRadius: 7,
  },
  carre45: { transform: [{ rotate: '45deg' }] },
  coeurPalet: {
    position: 'absolute', left: -3, top: -3, width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  pointeGoutte: {
    position: 'absolute', left: -3, top: -12, width: 6, height: 8, borderRadius: 3,
  },
  pulpe: {
    position: 'absolute', left: -5.5, top: -5.5, width: 11, height: 11, borderRadius: 5.5,
  },
  noyau: {
    position: 'absolute', left: 4, top: 2, width: 5, height: 5, borderRadius: 2.5,
  },
  zzz: {
    position: 'absolute', left: -7, top: -9, fontSize: 14, color: '#6E5AA8',
  },
  etincelle: {
    position: 'absolute', left: -3, top: -3, width: 6, height: 6, borderRadius: 3,
  },
  croix: { position: 'absolute', left: 0, top: 0 },
  croixBarreH: {
    position: 'absolute', left: -5, top: -1.25, width: 10, height: 2.5, borderRadius: 1.25,
  },
  croixBarreV: {
    position: 'absolute', left: -1.25, top: -5, width: 2.5, height: 10, borderRadius: 1.25,
  },
  anneauBoost: {
    position: 'absolute', left: -48, top: -48, width: 96, height: 96, borderRadius: 30, borderWidth: 3,
  },
  bulle: {
    position: 'absolute', left: -47, top: -47, width: 94, height: 94, borderRadius: 47, borderWidth: 3,
  },
  bulleReflet: {
    position: 'absolute', left: 14, top: 12, width: 22, height: 9, borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.85)', transform: [{ rotate: '-32deg' }],
  },
  coeurEtoile: {
    position: 'absolute', left: -5, top: -5, width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
});
