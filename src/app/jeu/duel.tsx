// === Boba Quest — écran de DUEL (combat tour par tour) ===
// Type Pokémon : ton actif en bas, l'adversaire en haut, tu choisis l'attaque,
// les événements du moteur (arene.ts) sont rejoués un à un avec animations.
// Modes : ?mode=pnj&rang=N (Maître de l'Arène) · ?mode=ami[&amical=1|&mise=X&gain=Y]
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Line } from 'react-native-svg';

import { C, F, R, OMBRE } from '@/constants/charte';
import {
  adversairePNJ, adversaireTournoi, Combattant, CoteCombat, creerCombat,
  equipeSam, EtatCombat, EvtCombat, HINT_ATTAQUE, jouerRound, multType,
} from '@/components/jeu/arene';
import PastilleCollectible from '@/components/jeu/collectibles';
import {
  cleJour, cleSemaine, OBJETS, RARETES, SETS, TOURNOI_ETAPES, trouverCollectible,
} from '@/components/jeu/economie';
import { BoutonJeu, formatNb, IconePerle } from '@/components/jeu/ui-jeu';
import {
  defaiteArene, defaiteTournoi, objetsEquipe, resoudreDuelAmi, useBobaQuest,
  victoireArene, victoireTournoi,
} from '@/store/jeu';

const delai = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Recap =
  | { type: 'pnj'; gagne: boolean; perles: number; capsule: 'classique' | 'doree' | null; rang: number }
  | { type: 'tournoi'; gagne: boolean; perles: number; capsule: 'classique' | 'doree' | null; etape: number; champion: boolean }
  | { type: 'ami'; gagne: boolean; amical: boolean; miseId?: string; gainId?: string; nouveau?: boolean };

export default function DuelScreen() {
  const insets = useSafeAreaInsets();
  const jeu = useBobaQuest();
  const params = useLocalSearchParams<{ mode?: string; rang?: string; etape?: string; amical?: string; mise?: string; gain?: string }>();
  const mode = params.mode === 'pnj' ? 'pnj' : params.mode === 'tournoi' ? 'tournoi' : 'ami';
  const rang = Math.max(1, parseInt(String(params.rang ?? '1'), 10) || 1);
  const etape = Math.min(2, Math.max(0, parseInt(String(params.etape ?? '0'), 10) || 0));
  const amical = params.amical === '1';
  const miseId = params.mise ? String(params.mise) : undefined;
  const gainId = params.gain ? String(params.gain) : undefined;

  const adversaire = useMemo(
    () => (mode === 'pnj'
      ? adversairePNJ(rang)
      : mode === 'tournoi'
        ? { ...adversaireTournoi(cleSemaine(), etape), nom: `${adversaireTournoi(cleSemaine(), etape).nom} · ${TOURNOI_ETAPES[etape]}` }
        : { nom: amical ? 'Sam (amical)' : 'Sam — duel misé 😏', ids: equipeSam(cleJour()), echelle: 1, objets: {} }),
    [mode, rang, etape, amical],
  );

  const nouveauCombat = () =>
    creerCombat(jeu.arene.equipe, adversaire.ids, adversaire.echelle, objetsEquipe(jeu), adversaire.objets);
  const combatRef = useRef<EtatCombat | null>(null);
  if (!combatRef.current) combatRef.current = nouveauCombat();
  const combat = combatRef.current;

  // ÉTAT D'AFFICHAGE, mis à jour événement par événement pendant le replay.
  // Le moteur résout tout le round d'un coup : si on lisait directement ses PV,
  // la barre sauterait à l'état final — ici elle descend coup par coup.
  const [affiche, setAffiche] = useState(() => ({
    actifs: { a: 0, b: 0 } as Record<CoteCombat, number>,
    pv: {
      a: combat.equipes.a.map((c) => c.pv),
      b: combat.equipes.b.map((c) => c.pv),
    } as Record<CoteCombat, number[]>,
  }));
  const afficheRef = useRef(affiche);
  afficheRef.current = affiche;
  const [journal, setJournal] = useState<string[]>([`${adversaire.nom} veut se battre !`]);
  const [enCours, setEnCours] = useState(false);
  const [flottant, setFlottant] = useState<{ cote: CoteCombat; txt: string; couleur: string; cle: number } | null>(null);
  const [recap, setRecap] = useState<Recap | null>(null);
  const crediteRef = useRef(false);

  const majPv = (cote: CoteCombat, index: number, pvApres: number) =>
    setAffiche((prev) => {
      const pv = { ...prev.pv, [cote]: [...prev.pv[cote]] };
      pv[cote][index] = pvApres;
      return { ...prev, pv };
    });
  const majActif = (cote: CoteCombat, index: number) =>
    setAffiche((prev) => ({ ...prev, actifs: { ...prev.actifs, [cote]: index } }));
  const synchroniser = () =>
    setAffiche({
      actifs: { ...combat.actifs },
      pv: { a: combat.equipes.a.map((c) => c.pv), b: combat.equipes.b.map((c) => c.pv) },
    });

  // nouveau combat quand les paramètres changent (étape suivante du tournoi…)
  const premierRendu = useRef(true);
  useEffect(() => {
    if (premierRendu.current) { premierRendu.current = false; return; }
    combatRef.current = nouveauCombat();
    crediteRef.current = false;
    setRecap(null);
    setEnCours(false);
    setFlottant(null);
    setJournal([`${adversaire.nom} veut se battre !`]);
    synchroniser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adversaire]);

  const secousses = useRef({ a: new Animated.Value(0), b: new Animated.Value(0) }).current;

  const pousserJournal = (t: string) => setJournal((j) => [t, ...j].slice(0, 2));

  const secouer = (cote: CoteCombat) => {
    Animated.sequence([
      Animated.timing(secousses[cote], { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(secousses[cote], { toValue: -1, duration: 55, useNativeDriver: true }),
      Animated.timing(secousses[cote], { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(secousses[cote], { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  };

  const finaliser = useCallback((vainqueur: CoteCombat) => {
    if (crediteRef.current) return;
    crediteRef.current = true;
    const gagne = vainqueur === 'a';
    if (mode === 'pnj') {
      if (gagne) {
        const r = victoireArene(rang);
        setRecap({ type: 'pnj', gagne, perles: r.perles, capsule: r.capsule, rang });
      } else {
        const r = defaiteArene();
        setRecap({ type: 'pnj', gagne, perles: r.perles, capsule: null, rang });
      }
    } else if (mode === 'tournoi') {
      if (gagne) {
        const r = victoireTournoi(etape);
        setRecap({ type: 'tournoi', gagne, perles: r.perles, capsule: r.capsule, etape, champion: r.champion });
      } else {
        const r = defaiteTournoi();
        setRecap({ type: 'tournoi', gagne, perles: r.perles, capsule: null, etape, champion: false });
      }
    } else if (amical) {
      setRecap({ type: 'ami', gagne, amical: true });
    } else {
      const { nouveau } = resoudreDuelAmi(gagne, miseId, gainId);
      setRecap({ type: 'ami', gagne, amical: false, miseId, gainId, nouveau });
    }
  }, [mode, rang, etape, amical, miseId, gainId]);

  const rejouerEvts = async (evts: EvtCombat[]) => {
    for (const evt of evts) {
      switch (evt.t) {
        case 'annonce':
          pousserJournal(evt.texte);
          await delai(520);
          break;
        case 'degats': {
          majPv(evt.cote, evt.index, evt.pvApres); // → la barre GLISSE vers la nouvelle valeur
          const surActif = evt.index === afficheRef.current.actifs[evt.cote];
          if (surActif) {
            secouer(evt.cote);
            setFlottant({ cote: evt.cote, txt: `−${evt.valeur}`, couleur: C.danger, cle: Date.now() });
          } else {
            // dégâts de ZONE sur le banc : visible au journal + points d'équipe
            const nom = combat.equipes[evt.cote][evt.index]?.nom ?? '';
            pousserJournal(`${nom} (banc) encaisse −${evt.valeur} !`);
          }
          const eff = evt.efficace === 1.5 ? ' C\'est super efficace !' : evt.efficace === 0.75 ? ' Pas très efficace…' : '';
          if (eff && surActif) pousserJournal(eff.trim());
          await delai(surActif ? 700 : 480);
          setFlottant(null);
          break;
        }
        case 'soin':
          majPv(evt.cote, evt.index, evt.pvApres);
          if (evt.index === afficheRef.current.actifs[evt.cote]) {
            setFlottant({ cote: evt.cote, txt: `+${evt.valeur}`, couleur: C.vertFonce, cle: Date.now() });
          }
          await delai(620);
          setFlottant(null);
          break;
        case 'statut':
          pousserJournal(evt.texte);
          await delai(600);
          break;
        case 'ko':
          pousserJournal(`${evt.nom} est K.O. ! 💥`);
          await delai(750);
          break;
        case 'entree':
          pousserJournal(`${evt.nom} entre en piste !`);
          majActif(evt.cote, evt.index); // → la carte bascule au bon MOMENT du replay
          await delai(600);
          break;
        case 'fin':
          pousserJournal(evt.vainqueur === 'a' ? 'VICTOIRE ! 🎉' : 'Défaite… 😵‍💫');
          await delai(500);
          finaliser(evt.vainqueur);
          break;
      }
    }
  };

  const attaquer = async (choix: 0 | 1) => {
    if (enCours || combat.fini) return;
    setEnCours(true);
    const evts = jouerRound(combat, choix);
    await rejouerEvts(evts);
    synchroniser(); // filet de sécurité : affichage = état exact du moteur
    setEnCours(false);
  };

  const quitter = () => {
    // abandonner un duel misé = perdre sa mise (sinon ce serait trop facile 😉)
    if (mode === 'ami' && !amical && !combat.fini && !crediteRef.current) {
      crediteRef.current = true;
      resoudreDuelAmi(false, miseId, gainId);
    }
    router.back();
  };

  // tout l'affichage suit l'état REJOUÉ (affiche), pas l'état final du moteur
  const moi = combat.equipes.a[affiche.actifs.a];
  const lui = combat.equipes.b[affiche.actifs.b];
  const avantage = multType(moi.set, lui.set);

  return (
    <View style={[styles.fond, { paddingTop: insets.top + 8 }]}>
      {/* header */}
      <View style={styles.hud}>
        <Pressable style={styles.fermer} onPress={quitter} hitSlop={8}>
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Line x1={6} y1={6} x2={18} y2={18} stroke={C.violetProfond} strokeWidth={2.6} strokeLinecap="round" />
            <Line x1={18} y1={6} x2={6} y2={18} stroke={C.violetProfond} strokeWidth={2.6} strokeLinecap="round" />
          </Svg>
        </Pressable>
        <Text style={styles.titre} numberOfLines={1}>{adversaire.nom}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.zone}>
        {/* === Adversaire === */}
        <CarteCombattant
          key={`b-${affiche.actifs.b}`}
          cote="b" equipe={combat.equipes.b} actifIdx={affiche.actifs.b}
          pvAffiches={affiche.pv.b} secousse={secousses.b} flottant={flottant} inverse
        />

        {/* === Journal + avantage === */}
        <View style={styles.centre}>
          {avantage !== 1 && !combat.fini && (
            <View style={[styles.avantage, { backgroundColor: avantage === 1.5 ? C.vertPale : C.dangerPale }]}>
              <Text style={[styles.avantageTxt, { color: avantage === 1.5 ? C.vertFonce : C.danger }]}>
                {avantage === 1.5 ? `Avantage de type ×1,5 (${SETS[moi.set].emoji} > ${SETS[lui.set].emoji})` : 'Désavantage de type ×0,75'}
              </Text>
            </View>
          )}
          {journal.map((t, i) => (
            <Text key={`${t}-${i}`} style={[styles.journal, i > 0 && { opacity: 0.45, fontSize: 12.5 }]}>{t}</Text>
          ))}
        </View>

        {/* === Moi === */}
        <CarteCombattant
          key={`a-${affiche.actifs.a}`}
          cote="a" equipe={combat.equipes.a} actifIdx={affiche.actifs.a}
          pvAffiches={affiche.pv.a} secousse={secousses.a} flottant={flottant}
        />
      </View>

      {/* === Attaques === */}
      <View style={[styles.attaques, { paddingBottom: insets.bottom + 12 }]}>
        {moi.attaques.map((a, i) => (
          <Pressable
            key={a.nom}
            style={[styles.btnAttaque, (enCours || combat.fini) && { opacity: 0.45 }, i === 1 && styles.btnAttaqueSpe]}
            disabled={enCours || combat.fini}
            onPress={() => attaquer(i as 0 | 1)}
          >
            <Text style={[styles.btnAttaqueNom, i === 1 && { color: '#fff' }]}>{a.nom}</Text>
            <Text style={[styles.btnAttaqueHint, i === 1 && { color: C.lavande }]}>{HINT_ATTAQUE[a.type]}</Text>
          </Pressable>
        ))}
      </View>

      {/* === Fin === */}
      <Modal visible={!!recap} transparent animationType="fade" onRequestClose={() => {}}>
        {recap && (
          <View style={styles.modalFond}>
            <View style={styles.modalCarte}>
              <Text style={{ fontSize: 44 }}>{recap.gagne ? '🏆' : '😵‍💫'}</Text>
              <Text style={styles.modalTitre}>{recap.gagne ? 'VICTOIRE !' : 'Défaite…'}</Text>

              {recap.type === 'pnj' && (
                <>
                  <View style={styles.ligneGain}>
                    <IconePerle taille={18} />
                    <Text style={styles.ligneGainTxt}>+{formatNb(recap.perles)} perles</Text>
                  </View>
                  {recap.capsule && (
                    <Text style={styles.capsuleGain}>
                      🎁 +1 capsule {recap.capsule === 'doree' ? 'DORÉE 👑' : 'classique'} !
                    </Text>
                  )}
                  {recap.gagne
                    ? <Text style={styles.modalTexte}>Rang {recap.rang + 1} débloqué — le prochain Maître t'attend.</Text>
                    : <Text style={styles.modalTexte}>Change d'équipe ou monte en puissance : le triangle des types fait tout !</Text>}
                </>
              )}
              {recap.type === 'tournoi' && (
                <>
                  {recap.champion && (
                    <Text style={styles.championTxt}>👑 CHAMPION DE LA SEMAINE ! 👑</Text>
                  )}
                  <View style={styles.ligneGain}>
                    <IconePerle taille={18} />
                    <Text style={styles.ligneGainTxt}>+{formatNb(recap.perles)} perles</Text>
                  </View>
                  {recap.capsule && (
                    <Text style={styles.capsuleGain}>
                      🎁 +1 capsule {recap.capsule === 'doree' ? 'DORÉE 👑' : 'classique'} !
                    </Text>
                  )}
                  {recap.gagne && !recap.champion && (
                    <BoutonJeu
                      titre={`${TOURNOI_ETAPES[Math.min(2, recap.etape + 1)]} →`}
                      onPress={() => router.replace(`/jeu/duel?mode=tournoi&etape=${recap.etape + 1}` as any)}
                      style={{ alignSelf: 'stretch', backgroundColor: C.vert }}
                    />
                  )}
                  {!recap.gagne && (
                    <Text style={styles.modalTexte}>
                      Éliminé pour cette semaine… Nouveau tournoi lundi ! (+{formatNb(recap.perles)} perles de consolation)
                    </Text>
                  )}
                </>
              )}
              {recap.type === 'ami' && recap.amical && (
                <Text style={styles.modalTexte}>
                  {recap.gagne ? 'La classe. Sam va demander sa revanche !' : 'Sam jubile. Tu connais le chemin de l\'Aventure…'}
                </Text>
              )}
              {recap.type === 'ami' && !recap.amical && (
                <>
                  {recap.gagne && recap.gainId && (
                    <View style={{ alignItems: 'center', gap: 8 }}>
                      <PastilleCollectible id={recap.gainId} taille={84} />
                      <Text style={styles.capsuleGain}>
                        Tu remportes {trouverCollectible(recap.gainId)?.nom} !{recap.nouveau ? '  ✨ NOUVEAU !' : ''}
                      </Text>
                    </View>
                  )}
                  {!recap.gagne && recap.miseId && (
                    <Text style={styles.modalTexte}>
                      Sam emporte ton doublon {trouverCollectible(recap.miseId)?.nom}… Récupère-le à la revanche !
                    </Text>
                  )}
                </>
              )}

              <BoutonJeu
                titre={recap.type === 'tournoi' ? 'Retour au tournoi' : 'Retour à l\'Arène'}
                onPress={() => router.back()}
                style={{ alignSelf: 'stretch' }}
              />
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

// Carte d'un combattant actif : pastille, nom, chips, barre de PV ANIMÉE
// (elle glisse à chaque coup), points d'équipe. Tout vient de l'état REJOUÉ.
function CarteCombattant({ cote, equipe, actifIdx, pvAffiches, secousse, flottant, inverse }: {
  cote: CoteCombat; equipe: Combattant[]; actifIdx: number; pvAffiches: number[];
  secousse: Animated.Value;
  flottant: { cote: CoteCombat; txt: string; couleur: string; cle: number } | null;
  inverse?: boolean;
}) {
  const c = equipe[actifIdx];
  const pv = pvAffiches[actifIdx];
  const pct = Math.max(0, Math.min(100, (pv / c.pvMax) * 100));
  const couleurPv = pct > 50 ? C.vert : pct > 22 ? C.jaune : C.danger;
  const meta = trouverCollectible(c.id);

  // La barre GLISSE vers sa nouvelle valeur (au lieu de sauter)
  const largeur = useRef(new Animated.Value(pct)).current;
  useEffect(() => {
    Animated.timing(largeur, {
      toValue: pct, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [pct, largeur]);

  return (
    <Animated.View
      style={[styles.combattant, inverse && { flexDirection: 'row-reverse' }, {
        transform: [{ translateX: secousse.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] }) }],
      }]}
    >
      <View style={{ alignItems: 'center', gap: 4 }}>
        <View style={{ opacity: pv > 0 ? 1 : 0.3 }}>
          <PastilleCollectible id={c.id} taille={86} />
        </View>
        {flottant && flottant.cote === cote && (
          <Text key={flottant.cle} style={[styles.flottant, { color: flottant.couleur }]}>{flottant.txt}</Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.nomLigne}>
          <Text style={styles.nom}>{c.nom}{c.objets.length ? `  ${c.objets.map((o) => OBJETS[o].emoji).join('')}` : ''}</Text>
          <Text style={styles.chips}>{SETS[c.set].emoji} {meta ? RARETES[meta.rarete].nom : ''}</Text>
        </View>
        <View style={styles.pvBarre}>
          <Animated.View
            style={[styles.pvRempli, {
              backgroundColor: couleurPv,
              width: largeur.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
            }]}
          />
        </View>
        <View style={styles.sousLigne}>
          <Text style={styles.pvTxt}>{pv}/{c.pvMax} PV{c.bouclier ? '  🛡️' : ''}{c.boostTours > 0 ? '  💪' : ''}{c.etourdi ? '  💫' : ''}</Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {equipe.map((m, i) => (
              <View key={m.id} style={[styles.point, pvAffiches[i] <= 0 && { backgroundColor: C.bord }, i === actifIdx && pvAffiches[i] > 0 && { borderWidth: 1.5, borderColor: C.violetProfond }]} />
            ))}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  hud: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  fermer: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.carte,
    alignItems: 'center', justifyContent: 'center', ...OMBRE,
  },
  titre: { flex: 1, fontFamily: F.titre, fontSize: 18, color: C.violet, textAlign: 'center' },

  zone: { flex: 1, padding: 18, gap: 12, justifyContent: 'space-between' },

  combattant: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.carte, borderRadius: R.carte, padding: 14, ...OMBRE,
  },
  nomLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nom: { fontFamily: F.t800, fontSize: 16.5, color: C.texte },
  chips: { fontFamily: F.t700, fontSize: 11.5, color: C.texte2 },
  pvBarre: { height: 10, borderRadius: 5, backgroundColor: C.lavande, overflow: 'hidden' },
  pvRempli: { height: 10, borderRadius: 5 },
  sousLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pvTxt: { fontFamily: F.t700, fontSize: 12, color: C.texte2 },
  point: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.vert },
  flottant: { position: 'absolute', top: -6, alignSelf: 'center', fontFamily: F.titre, fontSize: 20 },

  centre: { alignItems: 'center', gap: 6, minHeight: 74, justifyContent: 'center' },
  avantage: { borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 12 },
  avantageTxt: { fontFamily: F.t800, fontSize: 12 },
  journal: { fontFamily: F.t700, fontSize: 14.5, color: C.texte, textAlign: 'center' },

  attaques: { flexDirection: 'row', gap: 12, paddingHorizontal: 18 },
  btnAttaque: {
    flex: 1, backgroundColor: C.carte, borderRadius: R.btn + 2, paddingVertical: 14,
    alignItems: 'center', gap: 3, borderWidth: 2, borderColor: C.bord, ...OMBRE,
  },
  btnAttaqueSpe: { backgroundColor: C.violet, borderColor: C.violet },
  btnAttaqueNom: { fontFamily: F.t800, fontSize: 14.5, color: C.texte, textAlign: 'center' },
  btnAttaqueHint: { fontFamily: F.t600, fontSize: 11, color: C.texte2, textAlign: 'center' },

  modalFond: { flex: 1, backgroundColor: 'rgba(42,29,70,0.65)', alignItems: 'center', justifyContent: 'center', padding: 26 },
  modalCarte: { backgroundColor: C.carte, borderRadius: 24, padding: 24, alignItems: 'center', gap: 12, alignSelf: 'stretch', ...OMBRE },
  modalTitre: { fontFamily: F.titre, fontSize: 24, color: C.violet },
  modalTexte: { fontFamily: F.t400, fontSize: 13.5, color: C.texte2, textAlign: 'center', lineHeight: 20 },
  ligneGain: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.vertPale, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14,
  },
  ligneGainTxt: { fontFamily: F.t800, fontSize: 15, color: C.vertFonce },
  capsuleGain: { fontFamily: F.t700, fontSize: 14, color: '#9A6B00', textAlign: 'center' },
  championTxt: { fontFamily: F.titre, fontSize: 17, color: '#D2588A', textAlign: 'center' },
});
