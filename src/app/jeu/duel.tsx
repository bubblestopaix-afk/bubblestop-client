// === Boba Quest — écran de DUEL (combat tour par tour) ===
// Type Pokémon : ton actif en bas, l'adversaire en haut, tu choisis l'attaque,
// les événements du moteur (arene.ts) sont rejoués un à un avec animations.
// Modes : ?mode=pnj&rang=N (Maître de l'Arène) · ?mode=ami[&amical=1|&mise=X&gain=Y]
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Line } from 'react-native-svg';

import { BORD, C, F, R, OMBRE } from '@/constants/charte';
import {
  adversairePNJ, adversaireTournoi, Combattant, CoteCombat, creerCombat, creerCombatBoss,
  CHARGE_MAX, decrireIntention, equipeSam, equipeAmi, EtatCombat, EvtCombat,
  GARDE_PARFAITE, GARDE_REDUCTION, HINT_ATTAQUE, jouerRound, multType, SIGNATURES, SPE_USAGES,
  Timing, timingDepuisPosition, viseeBlessure, viseeDuree, viseeZones,
} from '@/components/jeu/arene';
import PastilleCollectible from '@/components/jeu/collectibles';
import { BurstSkia } from '@/components/jeu/combat-skia';
import { Icone, IconeEmoji, IconeType } from '@/components/jeu/icones';
import {
  bossDeLaSemaine, cleJour, cleSemaine, CONSOMMABLES, CONSOMMABLE_IDS, ConsommableId,
  mutateurDuJour, OBJETS, RARETES, TOURNOI_ETAPES, trouverCollectible,
} from '@/components/jeu/economie';
import { BoutonJeu, Confettis, formatNb, IconePerle } from '@/components/jeu/ui-jeu';
import { hapticLeger, hapticLourd, hapticMoyen, hapticSucces } from '@/lib/juice';
import {
  defaiteArene, defaiteTournoi, niveauxEquipe, objetsEquipe, resoudreDefiAmi, resoudreDuelAmi,
  useBobaQuest, utiliserConsommable, victoireArene, victoireBoss, victoireTournoi,
} from '@/store/jeu';

type Recap =
  | { type: 'pnj'; gagne: boolean; perles: number; capsule: 'classique' | 'doree' | null; rang: number; pc: number; serie: number; multSerie: number }
  | { type: 'tournoi'; gagne: boolean; perles: number; capsule: 'classique' | 'doree' | null; etape: number; champion: boolean }
  | { type: 'boss'; gagne: boolean; perles: number; capsules: number; eclats: number; deja: boolean }
  | { type: 'defi'; gagne: boolean; ami: string; perles: number }
  | { type: 'ami'; gagne: boolean; amical: boolean; miseId?: string; gainId?: string; nouveau?: boolean };

export default function DuelScreen() {
  const insets = useSafeAreaInsets();
  const jeu = useBobaQuest();
  const params = useLocalSearchParams<{ mode?: string; rang?: string; etape?: string; amical?: string; mise?: string; gain?: string; ami?: string }>();
  const mode = params.mode === 'pnj' ? 'pnj' : params.mode === 'tournoi' ? 'tournoi' : params.mode === 'boss' ? 'boss' : params.mode === 'defi' ? 'defi' : 'ami';
  const rang = Math.max(1, parseInt(String(params.rang ?? '1'), 10) || 1);
  const etape = Math.min(2, Math.max(0, parseInt(String(params.etape ?? '0'), 10) || 0));
  const amical = params.amical === '1';
  const miseId = params.mise ? String(params.mise) : undefined;
  const gainId = params.gain ? String(params.gain) : undefined;
  const amiNom = params.ami ? String(params.ami) : 'Un ami';

  const boss = useMemo(() => bossDeLaSemaine(cleSemaine()), []);
  const adversaire = useMemo(
    () => (mode === 'pnj'
      ? adversairePNJ(rang)
      : mode === 'tournoi'
        ? { ...adversaireTournoi(cleSemaine(), etape), nom: `${adversaireTournoi(cleSemaine(), etape).nom} · ${TOURNOI_ETAPES[etape]}` }
        : mode === 'boss'
          ? { nom: boss.nom, ids: [boss.combattantId], echelle: boss.echelle, objets: {} }
          : mode === 'defi'
            ? { nom: amiNom, ids: equipeAmi(amiNom), echelle: 1, objets: {} }
            : { nom: amical ? 'Sam (amical)' : 'Sam — duel misé', ids: equipeSam(cleJour()), echelle: 1, objets: {} }),
    [mode, rang, etape, amical, boss, amiNom],
  );

  const mutateur = useMemo(() => mutateurDuJour(cleJour()), []);
  const nouveauCombat = () => (mode === 'boss'
    ? creerCombatBoss(jeu.arene.equipe, boss, objetsEquipe(jeu), mutateur, niveauxEquipe(jeu))
    : creerCombat(jeu.arene.equipe, adversaire.ids, adversaire.echelle, objetsEquipe(jeu), adversaire.objets, mutateur, niveauxEquipe(jeu)));
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
  const [burst, setBurst] = useState<{ cote: CoteCombat; crit: boolean; cle: number } | null>(null);
  const [sacVisible, setSacVisible] = useState(false);
  const [recap, setRecap] = useState<Recap | null>(null);
  // 🎯 jauge de timing : action en attente du tap, et verdict flash (PARFAIT/Bien/Raté)
  const [timingDemande, setTimingDemande] = useState<0 | 1 | 'signature' | 'garde' | null>(null);
  const [verdictTiming, setVerdictTiming] = useState<{ t: Timing; cle: number } | null>(null);
  // ⚡ combo de PARFAITS en banque (+8 %/parfait sur les dégâts, cassé par un raté)
  const [combo, setCombo] = useState(0);
  // 💥 K.O. cinématique plein écran quand un adversaire tombe
  const [koFlash, setKoFlash] = useState<{ nom: string; cle: number } | null>(null);
  const [vitesse, setVitesse] = useState<1 | 2>(1);
  const vitesseRef = useRef<1 | 2>(1);
  vitesseRef.current = vitesse;
  const crediteRef = useRef(false);
  const attendre = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.round(ms / vitesseRef.current)));

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
    setCombo(0);
    setKoFlash(null);
    setJournal([`${adversaire.nom} veut se battre !`]);
    synchroniser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adversaire]);

  const secousses = useRef({ a: new Animated.Value(0), b: new Animated.Value(0) }).current;
  // 🥊 élan d'attaque : la carte bondit vers l'adversaire au moment de l'annonce
  const elans = useRef({ a: new Animated.Value(0), b: new Animated.Value(0) }).current;

  const elancer = (cote: CoteCombat) => {
    Animated.sequence([
      Animated.timing(elans[cote], { toValue: 1, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(elans[cote], { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };

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
        setRecap({ type: 'pnj', gagne, perles: r.perles, capsule: r.capsule, rang, pc: r.pc, serie: r.serie, multSerie: r.multSerie });
      } else {
        const r = defaiteArene();
        setRecap({ type: 'pnj', gagne, perles: r.perles, capsule: null, rang, pc: r.pc, serie: 0, multSerie: 1 });
      }
    } else if (mode === 'boss') {
      if (gagne) {
        const r = victoireBoss();
        setRecap({ type: 'boss', gagne, perles: r.perles, capsules: r.capsules, eclats: r.eclats, deja: r.deja });
      } else {
        setRecap({ type: 'boss', gagne, perles: 0, capsules: 0, eclats: 0, deja: false });
      }
    } else if (mode === 'tournoi') {
      if (gagne) {
        const r = victoireTournoi(etape);
        setRecap({ type: 'tournoi', gagne, perles: r.perles, capsule: r.capsule, etape, champion: r.champion });
      } else {
        const r = defaiteTournoi();
        setRecap({ type: 'tournoi', gagne, perles: r.perles, capsule: null, etape, champion: false });
      }
    } else if (mode === 'defi') {
      const r = resoudreDefiAmi(amiNom, gagne);
      setRecap({ type: 'defi', gagne, ami: amiNom, perles: r.perles });
    } else if (amical) {
      setRecap({ type: 'ami', gagne, amical: true });
    } else {
      const { nouveau } = resoudreDuelAmi(gagne, miseId, gainId);
      setRecap({ type: 'ami', gagne, amical: false, miseId, gainId, nouveau });
    }
  }, [mode, rang, etape, amical, miseId, gainId, amiNom]);

  const rejouerEvts = async (evts: EvtCombat[]) => {
    let critFlag = false;
    for (const evt of evts) {
      switch (evt.t) {
        case 'annonce':
          elancer(evt.cote); // 🥊 la carte bondit vers l'adversaire
          if (/déchaîne/.test(evt.texte)) hapticLourd(); // ⭐ signature
          pousserJournal(evt.texte);
          await attendre(520);
          break;
        case 'degats': {
          majPv(evt.cote, evt.index, evt.pvApres); // → la barre GLISSE vers la nouvelle valeur
          const surActif = evt.index === afficheRef.current.actifs[evt.cote];
          if (surActif) {
            secouer(evt.cote);
            if (critFlag) hapticMoyen(); else hapticLeger(); // 💥 l'impact se SENT
            setBurst({ cote: evt.cote, crit: critFlag, cle: Date.now() }); // 💥 burst Skia
            setFlottant({ cote: evt.cote, txt: `−${evt.valeur}`, couleur: C.danger, cle: Date.now() });
          } else {
            // dégâts de ZONE sur le banc : visible au journal + points d'équipe
            const nom = combat.equipes[evt.cote][evt.index]?.nom ?? '';
            pousserJournal(`${nom} (banc) encaisse −${evt.valeur} !`);
          }
          critFlag = false;
          const eff = evt.efficace === 1.5 ? ' C\'est super efficace !' : evt.efficace === 0.75 ? ' Pas très efficace…' : '';
          if (eff && surActif) pousserJournal(eff.trim());
          await attendre(surActif ? 700 : 480);
          setFlottant(null);
          break;
        }
        case 'soin':
          majPv(evt.cote, evt.index, evt.pvApres);
          if (evt.index === afficheRef.current.actifs[evt.cote]) {
            setFlottant({ cote: evt.cote, txt: `+${evt.valeur}`, couleur: C.vertFonce, cle: Date.now() });
          }
          await attendre(620);
          setFlottant(null);
          break;
        case 'statut':
          if (/critique/i.test(evt.texte)) critFlag = true; // le prochain coup est un critique
          pousserJournal(evt.texte);
          await attendre(600);
          break;
        case 'ko': {
          hapticLourd();
          secouer(evt.cote);
          // 💥 K.O. adverse = cinématique plein écran (flash + gros texte)
          if (evt.cote === 'b') {
            const cle = Date.now();
            setKoFlash({ nom: evt.nom, cle });
            setTimeout(() => setKoFlash((k) => (k?.cle === cle ? null : k)), 1050);
          }
          pousserJournal(`${evt.nom} est K.O. ! 💥`);
          await attendre(evt.cote === 'b' ? 1000 : 750);
          break;
        }
        case 'entree':
          pousserJournal(`${evt.nom} entre en piste !`);
          majActif(evt.cote, evt.index); // → la carte bascule au bon MOMENT du replay
          await attendre(600);
          break;
        case 'fin':
          if (evt.vainqueur === 'a') hapticSucces(); else hapticLourd();
          pousserJournal(evt.vainqueur === 'a' ? 'VICTOIRE ! 🎉' : 'Défaite… 😵‍💫');
          await attendre(500);
          finaliser(evt.vainqueur);
          break;
      }
    }
  };

  // 🎯 Attaque / Signature / Garde passent par la JAUGE DE TIMING : le bouton ouvre
  // la jauge, le tap du joueur décide du résultat, puis le round est résolu avec.
  const attaquer = (choix: 0 | 1 | 'signature') => {
    if (enCours || combat.fini || timingDemande !== null) return;
    setTimingDemande(choix);
  };

  const garder = () => {
    if (enCours || combat.fini || timingDemande !== null) return;
    setTimingDemande('garde');
  };

  const resoudreTiming = async (t: Timing) => {
    const action = timingDemande;
    setTimingDemande(null);
    if (action === null || enCours || combat.fini) return;
    const cle = Date.now();
    setVerdictTiming({ t, cle });
    setTimeout(() => setVerdictTiming((v) => (v?.cle === cle ? null : v)), 950);
    if (t === 'parfait') hapticSucces(); else if (t === 'bien') hapticLeger();
    setEnCours(true);
    // ⚡ le combo EN BANQUE booste ce coup ; puis il évolue : parfait +1, raté → 0
    const evts = jouerRound(combat, action, Math.random, undefined, t, combo);
    setCombo(t === 'parfait' ? combo + 1 : t === 'rate' ? 0 : combo);
    await rejouerEvts(evts);
    synchroniser(); // filet de sécurité : affichage = état exact du moteur
    setEnCours(false);
  };

  // 🔄 Changement actif : permute un combattant du banc (coûte le tour, l'adversaire frappe)
  const changer = async (index: number) => {
    if (enCours || combat.fini) return;
    setEnCours(true);
    const evts = jouerRound(combat, { changer: index });
    await rejouerEvts(evts);
    synchroniser();
    setEnCours(false);
  };

  // 🎒 Consommable : dépense un objet du sac (coûte le tour, l'adversaire frappe)
  const utiliser = async (id: ConsommableId) => {
    if (enCours || combat.fini) return;
    if (!utiliserConsommable(id)) return; // décrémente le sac (persisté)
    setSacVisible(false);
    setEnCours(true);
    const evts = jouerRound(combat, { objet: id });
    await rejouerEvts(evts);
    synchroniser();
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
  const bancActif = combat.equipes.a.some((c, i) => i !== affiche.actifs.a && c.pv > 0) && !combat.fini;
  const sacDispo = !combat.fini; // 🎒 toujours visible (état vide = découvre la fonctionnalité)
  const sacObjets = CONSOMMABLE_IDS.filter((id) => (jeu.consommables[id] ?? 0) > 0);
  const sigPrete = moi.charge >= CHARGE_MAX;
  const sig = SIGNATURES[moi.set];
  const intention = decrireIntention(combat);
  const gardeRestante = Math.max(0, moi.gardeCooldown - 1);
  const gardeDispo = moi.gardeCooldown <= 1;
  const marqueSpe = moi.set === 'fruit' ? 'Pose Collant 🍯'
    : moi.set === 'milk' ? 'Pose Givré ❄️'
      : moi.set === 'topping' ? 'Pose Pétillant 🫧' : null;
  const fondIntention = intention.ton === 'danger' ? C.dangerPale
    : intention.ton === 'soin' ? C.vertPale
      : intention.ton === 'defense' ? '#E9E2F7' : '#FFF3D6';

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
        <Pressable style={styles.vitesseBtn} disabled={enCours} onPress={() => setVitesse((v) => v === 1 ? 2 : 1)}>
          <Text style={styles.vitesseTxt}>×{vitesse}</Text>
        </Pressable>
      </View>

      {mutateur && (
        <View style={styles.mutateurBanniere}>
          <View style={styles.mutateurRang}>
            <Icone nom="eclair" taille={14} />
            <IconeEmoji emoji={mutateur.emoji} taille={15} />
            <Text style={[styles.mutateurTxt, { flexShrink: 1 }]} numberOfLines={2}>{mutateur.nom} — {mutateur.desc}</Text>
          </View>
        </View>
      )}

      {!combat.fini && (
        <View style={[styles.intention, { backgroundColor: fondIntention }]}>
          <View style={styles.intentionHaut}>
            <Text style={styles.intentionLabel}>PROCHAINE ACTION ADVERSE</Text>
            {lui.gimmick && <Text style={styles.phaseBoss}>PHASE {lui.bossPhase}</Text>}
          </View>
          <Text style={styles.intentionTitre} numberOfLines={1}>{intention.titre}</Text>
          <Text style={styles.intentionDetail} numberOfLines={2}>{intention.detail}</Text>
        </View>
      )}

      <View style={styles.zone}>
        {/* === Adversaire === */}
        <CarteCombattant
          key={`b-${affiche.actifs.b}`}
          cote="b" equipe={combat.equipes.b} actifIdx={affiche.actifs.b}
          pvAffiches={affiche.pv.b} secousse={secousses.b} elan={elans.b} flottant={flottant}
          burst={burst?.cote === 'b' ? burst : null} inverse
        />

        {/* === Journal + avantage === */}
        <View style={styles.centre}>
          {avantage !== 1 && !combat.fini && (
            <View style={[styles.avantage, { backgroundColor: avantage === 1.5 ? C.vertPale : C.dangerPale }]}>
              {avantage === 1.5 ? (
                <View style={styles.avantageRow}>
                  <Text style={[styles.avantageTxt, { color: C.vertFonce }]}>Avantage ×1,5 :</Text>
                  <IconeType set={moi.set} taille={18} />
                  <Text style={[styles.avantageTxt, { color: C.vertFonce }]}>bat</Text>
                  <IconeType set={lui.set} taille={18} />
                </View>
              ) : (
                <Text style={[styles.avantageTxt, { color: C.danger }]}>Désavantage de type ×0,75</Text>
              )}
            </View>
          )}
          {verdictTiming && (
            <Text key={verdictTiming.cle} style={[styles.verdict, {
              color: verdictTiming.t === 'parfait' ? '#E8930C' : verdictTiming.t === 'bien' ? C.vertFonce : C.texte3,
            }]}>
              {verdictTiming.t === 'parfait' ? '✨ PARFAIT !' : verdictTiming.t === 'bien' ? 'Bien !' : 'Raté…'}
            </Text>
          )}
          {journal.map((t, i) => (
            <Text key={`${t}-${i}`} style={[styles.journal, i > 0 && { opacity: 0.45, fontSize: 12.5 }]}>{t}</Text>
          ))}
        </View>

        {/* === Moi === */}
        <CarteCombattant
          key={`a-${affiche.actifs.a}`}
          cote="a" equipe={combat.equipes.a} actifIdx={affiche.actifs.a}
          pvAffiches={affiche.pv.a} secousse={secousses.a} elan={elans.a} flottant={flottant}
          burst={burst?.cote === 'a' ? burst : null}
        />
      </View>

      {/* === ⚡ Combo de PARFAITS en banque === */}
      {combo > 0 && !combat.fini && (
        <View style={styles.comboChip}>
          <Text style={styles.comboChipTxt}>
            ⚡ PARFAITS ×{combo} — prochains coups +{Math.min(3, combo) * 8} %
          </Text>
        </View>
      )}

      {/* === ⭐ Signature : jauge (se remplit en agissant/encaissant) ou bouton prêt === */}
      {!combat.fini && (
        sigPrete ? (
          <Pressable
            style={[styles.sigPret, enCours && { opacity: 0.45 }]}
            disabled={enCours}
            onPress={() => attaquer('signature')}
          >
            <Icone nom="eclat" taille={18} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sigPretNom}>{sig.nom} — PRÊT !</Text>
              <Text style={styles.sigPretHint}>{sig.desc}</Text>
            </View>
          </Pressable>
        ) : (
          <View style={styles.sigJauge}>
            <Text style={styles.sigJaugeTxt}>Signature</Text>
            <View style={styles.sigPips}>
              {Array.from({ length: CHARGE_MAX }, (_, i) => (
                <View key={i} style={[styles.sigPip, i < moi.charge && styles.sigPipPlein]} />
              ))}
            </View>
            <Text style={styles.sigJaugeHint}>attaque et encaisse pour charger</Text>
          </View>
        )
      )}

      {/* === Attaques === */}
      <View style={[styles.attaques, { paddingBottom: (bancActif || sacDispo) ? 8 : insets.bottom + 12 }]}>
        {moi.attaques.map((a, i) => {
          const spe = i === 1;
          const epuisee = spe && moi.speRestantes <= 0;
          return (
            <Pressable
              key={a.nom}
              style={[styles.btnAttaque, (enCours || combat.fini || epuisee) && { opacity: 0.45 }, spe && styles.btnAttaqueSpe]}
              disabled={enCours || combat.fini || epuisee}
              onPress={() => attaquer(i as 0 | 1)}
            >
              <Text style={[styles.btnAttaqueNom, spe && { color: '#fff' }]}>{a.nom}</Text>
              <Text style={[styles.btnAttaqueHint, spe && { color: C.lavande }]}>
                {epuisee ? 'Épuisée pour ce combat' : `${HINT_ATTAQUE[a.type]}${spe && marqueSpe && ['degats', 'double', 'etourdit', 'zone'].includes(a.type) ? ` · ${marqueSpe}` : ''}`}
              </Text>
              {spe && (
                <Text style={styles.btnAttaqueMun}>
                  {'●'.repeat(moi.speRestantes)}{'○'.repeat(SPE_USAGES - moi.speRestantes)}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* === 🔄 Changement actif (banc) + 🎒 Sac === */}
      {(() => {
        const banc = combat.equipes.a.map((c, i) => ({ c, i })).filter(({ c, i }) => i !== affiche.actifs.a && c.pv > 0);
        if (combat.fini || (banc.length === 0 && !sacDispo)) return null;
        return (
          <View style={[styles.bancRang, { paddingBottom: insets.bottom + 6 }]}>
            {banc.length > 0 && <Text style={styles.bancLabel}>Changer :</Text>}
            {banc.map(({ c, i }) => {
              const av = multType(c.set, lui.set);
              return (
                <Pressable
                  key={c.id}
                  style={[styles.bancChip, enCours && { opacity: 0.4 }]}
                  disabled={enCours}
                  onPress={() => changer(i)}
                >
                  <PastilleCollectible id={c.id} taille={26} />
                  <Text style={styles.bancChipNom} numberOfLines={1}>{c.nom}</Text>
                  {av !== 1 && <Text style={[styles.bancAv, { color: av === 1.5 ? C.vertFonce : C.danger }]}>{av === 1.5 ? '▲' : '▼'}</Text>}
                </Pressable>
              );
            })}
            <Pressable
              style={[styles.gardeBtn, (!gardeDispo || enCours) && { opacity: 0.42 }]}
              disabled={!gardeDispo || enCours}
              onPress={garder}
            >
              <Icone nom="bouclier" taille={15} />
              <Text style={styles.gardeBtnTxt}>
                {gardeDispo ? `Garde −${Math.round(GARDE_REDUCTION * 100)}/${Math.round(GARDE_PARFAITE * 100)} %` : `Garde · ${gardeRestante} t`}
              </Text>
            </Pressable>
            {sacDispo && (
              <Pressable style={[styles.sacBtn, enCours && { opacity: 0.4 }]} disabled={enCours} onPress={() => setSacVisible(true)}>
                <Icone nom="sac" taille={15} />
                <Text style={styles.sacBtnTxt}>Sac{sacObjets.length ? ` · ${sacObjets.reduce((s, id) => s + (jeu.consommables[id] ?? 0), 0)}` : ''}</Text>
              </Pressable>
            )}
          </View>
        );
      })()}

      {/* === 🎒 Sac de consommables === */}
      <Modal visible={sacVisible} transparent animationType="fade" onRequestClose={() => setSacVisible(false)}>
        <Pressable style={styles.modalFond} onPress={() => setSacVisible(false)}>
          <Pressable style={styles.sacCarte} onPress={() => {}}>
            <View style={styles.modalTitreRang}><Icone nom="sac" taille={22} /><Text style={styles.modalTitre}>Sac de combat</Text></View>
            {sacObjets.length > 0 ? (
              <>
                <Text style={styles.sacAide}>Utiliser un objet coûte ton tour — l'adversaire frappe ensuite.</Text>
                {sacObjets.map((id) => {
                  const d = CONSOMMABLES[id];
                  return (
                    <Pressable key={id} style={[styles.sacLigne, enCours && { opacity: 0.4 }]} disabled={enCours} onPress={() => utiliser(id)}>
                      <IconeEmoji emoji={d.emoji} taille={30} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sacNom}>{d.nom} ×{jeu.consommables[id]}</Text>
                        <Text style={styles.sacDesc}>{d.desc}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </>
            ) : (
              <>
                <Text style={styles.sacAide}>
                  Ton sac est vide ! Les consommables se jouent en plein combat — soin,
                  boost, bouclier, anti-étourdissement ou dégâts directs — mais utiliser
                  un objet coûte ton tour.
                </Text>
                <Text style={styles.sacVide}>
                  Ils s'achètent avec des perles à l'Arène, section « Sac de combat ».
                </Text>
              </>
            )}
            <BoutonJeu titre="Fermer" onPress={() => setSacVisible(false)} style={{ alignSelf: 'stretch' }} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* === 💥 K.O. cinématique === */}
      {koFlash && <KoCinematique key={koFlash.cle} nom={koFlash.nom} />}

      {/* === 🎯 Jauge de timing (attaque / Signature / Garde) — plus dure si blessé === */}
      {timingDemande !== null && (
        <JaugeTiming
          intitule={timingDemande === 'garde' ? 'PARADE — tape dans la zone dorée !' : 'Tape dans la zone dorée !'}
          blessure={viseeBlessure(affiche.pv.a[affiche.actifs.a] ?? moi.pv, moi.pvMax)}
          onResultat={resoudreTiming}
        />
      )}

      {/* === Fin === */}
      <Modal visible={!!recap} transparent animationType="fade" onRequestClose={() => {}}>
        {recap && (
          <View style={styles.modalFond}>
            {recap.gagne && (
              <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
                <Confettis hauteur={320} />
              </View>
            )}
            <View style={styles.modalCarte}>
              <Icone nom={recap.gagne ? 'trophee' : 'triste'} taille={48} />
              <Text style={styles.modalTitre}>{recap.gagne ? 'VICTOIRE !' : 'Défaite…'}</Text>

              {recap.type === 'pnj' && (
                <>
                  <View style={styles.ligneGain}>
                    <IconePerle taille={18} />
                    <Text style={styles.ligneGainTxt}>+{formatNb(recap.perles)} perles</Text>
                  </View>
                  {recap.pc !== 0 && (
                    <View style={styles.gainRang}>
                      <Icone nom="trophee" taille={15} />
                      <Text style={[styles.pcGain, { color: recap.pc > 0 ? '#2E7D32' : '#C0455A' }]}>
                        {recap.pc > 0 ? `+${recap.pc}` : recap.pc} PC de classement
                      </Text>
                    </View>
                  )}
                  {recap.capsule && (
                    <View style={styles.gainRang}>
                      <Icone nom="cadeau" taille={16} />
                      <Text style={styles.capsuleGain}>+1 capsule {recap.capsule === 'doree' ? 'DORÉE' : 'classique'} !</Text>
                      {recap.capsule === 'doree' && <Icone nom="couronne" taille={16} />}
                    </View>
                  )}
                  {/* 🔥 série de victoires : la boucle « encore un ! » */}
                  {recap.gagne && recap.serie >= 2 && (
                    <Text style={styles.serieVTxt}>
                      🔥 {recap.serie} victoires d'affilée — perles ×{recap.multSerie.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')}
                    </Text>
                  )}
                  {recap.gagne && recap.serie === 1 && (
                    <Text style={styles.serieVHint}>Enchaîne sans perdre : chaque victoire d'affilée paie +15 % !</Text>
                  )}
                  {recap.gagne
                    ? <Text style={styles.modalTexte}>Rang {recap.rang + 1} débloqué — le prochain Maître t'attend.</Text>
                    : <Text style={styles.modalTexte}>Change d'équipe ou monte en puissance : le triangle des types fait tout !</Text>}
                  {recap.gagne && (
                    <BoutonJeu
                      titre={`Maître suivant — Rang ${recap.rang + 1} →`}
                      onPress={() => router.replace(`/jeu/duel?mode=pnj&rang=${recap.rang + 1}` as any)}
                      style={{ alignSelf: 'stretch', backgroundColor: C.vert }}
                    />
                  )}
                </>
              )}
              {recap.type === 'tournoi' && (
                <>
                  {recap.champion && (
                    <View style={styles.gainRang}>
                      <Icone nom="couronne" taille={18} />
                      <Text style={styles.championTxt}>CHAMPION DE LA SEMAINE !</Text>
                      <Icone nom="couronne" taille={18} />
                    </View>
                  )}
                  <View style={styles.ligneGain}>
                    <IconePerle taille={18} />
                    <Text style={styles.ligneGainTxt}>+{formatNb(recap.perles)} perles</Text>
                  </View>
                  {recap.capsule && (
                    <View style={styles.gainRang}>
                      <Icone nom="cadeau" taille={16} />
                      <Text style={styles.capsuleGain}>+1 capsule {recap.capsule === 'doree' ? 'DORÉE' : 'classique'} !</Text>
                      {recap.capsule === 'doree' && <Icone nom="couronne" taille={16} />}
                    </View>
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
              {recap.type === 'boss' && (
                recap.gagne ? (
                  recap.deja ? (
                    <Text style={styles.modalTexte}>Boss déjà vaincu cette semaine — reviens lundi pour le prochain.</Text>
                  ) : (
                    <>
                      <View style={styles.ligneGain}>
                        <IconePerle taille={18} />
                        <Text style={styles.ligneGainTxt}>+{formatNb(recap.perles)} perles</Text>
                      </View>
                      <View style={styles.gainRang}>
                        <Icone nom="cadeau" taille={15} />
                        <Text style={styles.capsuleGain}>+{recap.capsules} capsule ·</Text>
                        <Icone nom="eclat" taille={14} />
                        <Text style={styles.capsuleGain}>+{recap.eclats} éclats</Text>
                      </View>
                      <Text style={styles.modalTexte}>Boss de la semaine vaincu ! Reviens lundi défier le suivant.</Text>
                    </>
                  )
                ) : (
                  <Text style={styles.modalTexte}>Le boss est coriace ! Adapte ton équipe à son gimmick et retente.</Text>
                )
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
                        Tu remportes {trouverCollectible(recap.gainId)?.nom} !{recap.nouveau ? '  NOUVEAU !' : ''}
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
              {recap.type === 'defi' && (
                <>
                  {recap.gagne && (
                    <View style={styles.ligneGain}>
                      <IconePerle taille={18} />
                      <Text style={styles.ligneGainTxt}>+{formatNb(recap.perles)} perles</Text>
                    </View>
                  )}
                  <Text style={styles.modalTexte}>
                    {recap.gagne
                      ? `Tu as battu l'équipe de ${recap.ami} ! Défi relevé.`
                      : `${recap.ami} a bien défendu son équipe… Retente sur un autre défi !`}
                  </Text>
                </>
              )}

              <BoutonJeu
                titre={recap.type === 'tournoi' ? 'Retour au tournoi' : recap.type === 'defi' ? 'Retour aux défis' : 'Retour à l\'Arène'}
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

// 🎯 Jauge de timing façon « action command » : un curseur balaie la piste,
// le joueur tape — zone dorée = PARFAIT, verte = BIEN, sinon (ou trop tard) = RATÉ.
// 🩸 Plus la carte active est BLESSÉE, plus le curseur FILE et plus les zones se
// resserrent (mains qui tremblent). Résolution par timingDepuisPosition (PUR, testé).
function JaugeTiming({ intitule, blessure, onResultat }: { intitule: string; blessure: number; onResultat: (t: Timing) => void }) {
  const prog = useRef(new Animated.Value(0)).current;
  const pos = useRef(0);
  const resolu = useRef(false);
  const LARGEUR = 264;
  const zones = viseeZones(blessure);
  const grave = blessure >= 0.5;

  useEffect(() => {
    const id = prog.addListener(({ value }) => { pos.current = value; });
    Animated.timing(prog, { toValue: 1, duration: viseeDuree(blessure), easing: Easing.linear, useNativeDriver: true })
      .start(({ finished }) => {
        if (finished && !resolu.current) { resolu.current = true; onResultat('rate'); } // trop tard
      });
    return () => prog.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const taper = () => {
    if (resolu.current) return;
    resolu.current = true;
    prog.stopAnimation();
    onResultat(timingDepuisPosition(pos.current, zones));
  };

  return (
    <Pressable style={styles.timingFond} onPress={taper} accessibilityRole="button" accessibilityLabel="Jauge de timing — tape maintenant">
      <View style={[styles.timingCarte, grave && styles.timingCarteGrave]}>
        <Text style={styles.timingTitre}>{intitule}</Text>
        <View style={[styles.timingPiste, { width: LARGEUR }]}>
          <View style={[styles.timingZoneVerte, { left: LARGEUR * (0.5 - zones.vert / 2), width: LARGEUR * zones.vert }]} />
          <View style={[styles.timingZoneOr, { left: LARGEUR * (0.5 - zones.or / 2), width: LARGEUR * zones.or }]} />
          <Animated.View
            style={[styles.timingCurseur, {
              transform: [{ translateX: prog.interpolate({ inputRange: [0, 1], outputRange: [0, LARGEUR - 5] }) }],
            }]}
          />
        </View>
        <Text style={[styles.timingHint, grave && { color: C.danger }]}>
          {grave
            ? '🩸 Carte blessée : la barre FILE et la cible rétrécit !'
            : 'Doré = PARFAIT (coup sûr + crit) · vert = bien · sinon raté'}
        </Text>
      </View>
    </Pressable>
  );
}

// 💥 K.O. cinématique : flash + « K.O. ! » qui claque, disparaît tout seul (~1 s)
function KoCinematique({ nom }: { nom: string }) {
  const av = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(av, { toValue: 1, duration: 170, easing: Easing.out(Easing.back(1.8)), useNativeDriver: true }),
      Animated.delay(500),
      Animated.timing(av, { toValue: 2, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [av]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.koFond, { opacity: av.interpolate({ inputRange: [0, 0.2, 1, 2], outputRange: [0, 1, 1, 0] }) }]}
    >
      <Animated.Text
        style={[styles.koTxt, {
          transform: [
            { scale: av.interpolate({ inputRange: [0, 1, 2], outputRange: [0.3, 1, 1.18] }) },
            { rotate: '-6deg' },
          ],
        }]}
      >
        K.O. !
      </Animated.Text>
      <Text style={styles.koNom}>{nom} est au tapis</Text>
    </Animated.View>
  );
}

// Carte d'un combattant actif : pastille, nom, chips, barre de PV ANIMÉE
// (elle glisse à chaque coup), points d'équipe. Tout vient de l'état REJOUÉ.
function CarteCombattant({ cote, equipe, actifIdx, pvAffiches, secousse, elan, flottant, burst, inverse }: {
  cote: CoteCombat; equipe: Combattant[]; actifIdx: number; pvAffiches: number[];
  secousse: Animated.Value;
  elan: Animated.Value;
  flottant: { cote: CoteCombat; txt: string; couleur: string; cle: number } | null;
  burst: { cote: CoteCombat; crit: boolean; cle: number } | null;
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

  // 🚨 pouls de DANGER : anneau rouge qui bat quand l'actif est sous 25 % de PV
  const danger = pv > 0 && pct <= 25;
  const pouls = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!danger) { pouls.setValue(0); return; }
    const boucle = Animated.loop(Animated.sequence([
      Animated.timing(pouls, { toValue: 1, duration: 440, useNativeDriver: true }),
      Animated.timing(pouls, { toValue: 0, duration: 440, useNativeDriver: true }),
    ]));
    boucle.start();
    return () => boucle.stop();
  }, [danger, pouls]);

  return (
    <Animated.View
      style={[styles.combattant, inverse && { flexDirection: 'row-reverse' }, {
        transform: [
          { translateX: secousse.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] }) },
          // 🥊 élan d'attaque : bond vers l'adversaire (bas → haut, haut → bas)
          { translateY: elan.interpolate({ inputRange: [0, 1], outputRange: [0, inverse ? 13 : -13] }) },
          { scale: elan.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
        ],
      }]}
    >
      {danger && (
        <Animated.View
          pointerEvents="none"
          style={[styles.dangerRing, { opacity: pouls.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.9] }) }]}
        />
      )}
      <View style={{ alignItems: 'center', gap: 4 }}>
        <View style={{ opacity: pv > 0 ? 1 : 0.3 }}>
          <PastilleCollectible id={c.id} taille={86} />
          {burst && (
            <View pointerEvents="none" style={{ position: 'absolute', left: 43 - 62, top: 43 - 62 }}>
              <BurstSkia taille={124} crit={burst.crit} cle={burst.cle} />
            </View>
          )}
        </View>
        {flottant && flottant.cote === cote && (
          <Text key={flottant.cle} style={[styles.flottant, { color: flottant.couleur }]}>{flottant.txt}</Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.nomLigne}>
          <View style={styles.nomRang}>
            <Text style={styles.nom} numberOfLines={1}>{c.nom}</Text>
            {c.objets.map((o) => <IconeEmoji key={o} emoji={OBJETS[o].emoji} taille={14} />)}
          </View>
          <View style={styles.chipsRow}>
            {c.niveau > 1 && <Text style={styles.chipNiveau}>Nv {c.niveau}</Text>}
            <IconeType set={c.set} taille={16} />
            <Text style={styles.chips}>{meta ? RARETES[meta.rarete].nom : ''}</Text>
          </View>
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
          <View style={styles.pvTxtRang}>
            <Text style={styles.pvTxt}>{pv}/{c.pvMax} PV</Text>
            {c.bouclier ? <Icone nom="bouclier" taille={13} /> : null}
            {c.boostTours > 0 ? <Icone nom="boost" taille={13} /> : null}
            {c.etourdi ? <Icone nom="etourdi" taille={13} /> : null}
            {c.gardePct > 0 ? <Text style={styles.statutMini}>GARDE</Text> : null}
            {c.collantTours > 0 ? <Text style={styles.statutMini}>🍯</Text> : null}
            {c.givre ? <Text style={styles.statutMini}>❄️</Text> : null}
            {c.petillant ? <Text style={styles.statutMini}>🫧</Text> : null}
            {c.gimmick && c.bossPhase > 1 ? <Text style={styles.statutBoss}>P{c.bossPhase}</Text> : null}
            {/* ⭐ jauge signature — visible des DEUX côtés (on voit venir l'ulti adverse) */}
            <View style={styles.chargeRang}>
              {Array.from({ length: CHARGE_MAX }, (_, i) => (
                <View key={i} style={[styles.chargePip, i < c.charge && styles.chargePipPlein]} />
              ))}
            </View>
          </View>
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
    alignItems: 'center', justifyContent: 'center', borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  titre: { flex: 1, fontFamily: F.titre, fontSize: 18, color: C.violet, textAlign: 'center' },
  vitesseBtn: {
    width: 40, height: 34, borderRadius: R.pill, backgroundColor: C.violet,
    alignItems: 'center', justifyContent: 'center',
  },
  vitesseTxt: { fontFamily: F.t800, fontSize: 13, color: '#fff', fontVariant: ['tabular-nums'] },

  intention: {
    marginHorizontal: 18, marginTop: 5, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12,
    borderWidth: 1, borderColor: C.bord,
  },
  intentionHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  intentionLabel: { fontFamily: F.t800, fontSize: 9.5, color: C.texte3, letterSpacing: 0.4 },
  intentionTitre: { fontFamily: F.t800, fontSize: 13.5, color: C.texte, marginTop: 2 },
  intentionDetail: { fontFamily: F.t600, fontSize: 10.5, color: C.texte2 },
  phaseBoss: { fontFamily: F.t800, fontSize: 9.5, color: C.danger },

  zone: { flex: 1, padding: 18, gap: 12, justifyContent: 'space-between' },

  // 🎯 jauge de timing (action command)
  timingFond: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(69,42,110,0.45)', alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: 150, zIndex: 20,
  },
  timingCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, paddingVertical: 16, paddingHorizontal: 20,
    alignItems: 'center', gap: 12, borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  timingTitre: { fontFamily: F.titre, fontSize: 16, color: C.violet },
  timingCarteGrave: { borderColor: C.danger, borderWidth: 2 },
  timingPiste: {
    height: 26, borderRadius: 13, backgroundColor: C.lavande, overflow: 'hidden',
  },
  timingZoneVerte: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#C9E29B' },
  timingZoneOr: { position: 'absolute', top: 0, bottom: 0, backgroundColor: C.jaune },
  timingCurseur: {
    position: 'absolute', top: -2, bottom: -2, width: 5, borderRadius: 2.5,
    backgroundColor: C.violetProfond,
  },
  timingHint: { fontFamily: F.t600, fontSize: 11, color: C.texte2, textAlign: 'center' },
  verdict: { fontFamily: F.titre, fontSize: 20, textAlign: 'center' },

  // ⚡ combo de parfaits
  comboChip: {
    alignSelf: 'center', backgroundColor: '#FFF3D6', borderRadius: R.pill,
    paddingVertical: 4, paddingHorizontal: 14, marginBottom: 4,
    borderWidth: 1, borderColor: C.jaune,
  },
  comboChipTxt: { fontFamily: F.t800, fontSize: 12, color: '#9A6B00' },

  // 💥 K.O. cinématique
  koFond: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(69,42,110,0.35)',
  },
  koTxt: {
    fontFamily: F.titre, fontSize: 64, color: C.jaune,
    textShadowColor: C.violetProfond, textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 8,
  },
  koNom: { fontFamily: F.t800, fontSize: 15, color: '#fff', marginTop: 6 },

  // 🚨 pouls de danger (PV bas)
  dangerRing: {
    position: 'absolute', left: -2, right: -2, top: -2, bottom: -2,
    borderWidth: 3, borderColor: C.danger, borderRadius: R.carte,
  },

  // 🔥 série de victoires
  serieVTxt: { fontFamily: F.t800, fontSize: 14, color: '#C7541F', textAlign: 'center' },
  serieVHint: { fontFamily: F.t600, fontSize: 12, color: C.texte2, textAlign: 'center' },

  combattant: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.carte, borderRadius: R.carte, padding: 14, borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  nomLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nomRang: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  nom: { fontFamily: F.t800, fontSize: 16.5, color: C.texte },
  pvTxtRang: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chargeRang: { flexDirection: 'row', gap: 2.5, marginLeft: 3 },
  chargePip: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.lavande },
  chargePipPlein: { backgroundColor: '#F5A93B' },
  chips: { fontFamily: F.t700, fontSize: 11.5, color: C.texte2 },
  chipNiveau: {
    fontFamily: F.t800, fontSize: 10.5, color: C.violet, backgroundColor: C.lavande,
    borderRadius: R.pill, paddingHorizontal: 6, paddingVertical: 1.5, overflow: 'hidden',
  },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pvBarre: { height: 10, borderRadius: 5, backgroundColor: C.lavande, overflow: 'hidden' },
  pvRempli: { height: 10, borderRadius: 5 },
  sousLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pvTxt: { fontFamily: F.t700, fontSize: 12, color: C.texte2 },
  statutMini: { fontFamily: F.t800, fontSize: 9, color: C.violet, backgroundColor: C.lavande, borderRadius: 5, paddingHorizontal: 3 },
  statutBoss: { fontFamily: F.t800, fontSize: 9, color: '#fff', backgroundColor: C.danger, borderRadius: 5, paddingHorizontal: 4 },
  point: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.vert },
  flottant: { position: 'absolute', top: -6, alignSelf: 'center', fontFamily: F.titre, fontSize: 20 },

  centre: { alignItems: 'center', gap: 6, minHeight: 74, justifyContent: 'center' },
  avantage: { borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 12 },
  avantageTxt: { fontFamily: F.t800, fontSize: 12 },
  avantageRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap', justifyContent: 'center' },
  journal: { fontFamily: F.t700, fontSize: 14.5, color: C.texte, textAlign: 'center' },

  attaques: { flexDirection: 'row', gap: 12, paddingHorizontal: 18 },
  btnAttaque: {
    flex: 1, backgroundColor: C.carte, borderRadius: R.btn + 2, paddingVertical: 14,
    alignItems: 'center', gap: 3, borderWidth: 2, borderColor: C.bord, ...OMBRE,
  },
  btnAttaqueSpe: { backgroundColor: C.violet, borderColor: C.violet },
  btnAttaqueNom: { fontFamily: F.t800, fontSize: 14.5, color: C.texte, textAlign: 'center' },
  btnAttaqueHint: { fontFamily: F.t600, fontSize: 11, color: C.texte2, textAlign: 'center' },
  btnAttaqueMun: { fontFamily: F.t800, fontSize: 10, color: '#FFD166', textAlign: 'center', letterSpacing: 2, marginTop: 1 },

  // ⭐ signature : jauge fine (pas prête) ou gros bouton doré (prête)
  sigJauge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 18, marginBottom: 8, paddingVertical: 7, paddingHorizontal: 12,
    backgroundColor: C.carte, borderRadius: 12, borderWidth: 1, borderColor: C.bord,
  },
  sigJaugeTxt: { fontFamily: F.t800, fontSize: 11.5, color: C.texte2 },
  sigPips: { flexDirection: 'row', gap: 4 },
  sigPip: { width: 14, height: 8, borderRadius: 4, backgroundColor: C.lavande },
  sigPipPlein: { backgroundColor: '#F5A93B' },
  sigJaugeHint: { flex: 1, fontFamily: F.t600, fontSize: 10.5, color: C.texte3, textAlign: 'right' },
  sigPret: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 18, marginBottom: 8, paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: '#F5A93B', borderRadius: 14, borderWidth: 2, borderColor: '#E8920F',
  },
  sigPretNom: { fontFamily: F.t800, fontSize: 14.5, color: '#4A2B00' },
  sigPretHint: { fontFamily: F.t700, fontSize: 10.5, color: '#7A4B05' },
  bancRang: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 8, flexWrap: 'wrap' },
  bancLabel: { fontFamily: F.t800, fontSize: 12.5, color: C.texte2 },
  bancChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.carte,
    borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1.5, borderColor: C.bord,
  },
  bancChipNom: { fontFamily: F.t700, fontSize: 12.5, color: C.texte },
  bancAv: { fontFamily: F.t800, fontSize: 12 },
  gardeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#E9E2F7', borderRadius: R.pill, paddingVertical: 6, paddingHorizontal: 12,
    borderWidth: 1, borderColor: C.violetClair,
  },
  gardeBtnTxt: { fontFamily: F.t800, fontSize: 11.5, color: C.violet },
  sacBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.violet, borderRadius: R.pill, paddingVertical: 6, paddingHorizontal: 14,
  },
  sacBtnTxt: { fontFamily: F.t800, fontSize: 12.5, color: '#fff' },
  sacCarte: { backgroundColor: C.carte, borderRadius: 24, padding: 20, gap: 10, alignSelf: 'stretch', borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE },
  sacAide: { fontFamily: F.t600, fontSize: 12, color: C.texte2, textAlign: 'center' },
  sacVide: { fontFamily: F.t700, fontSize: 12.5, color: C.violet, textAlign: 'center', lineHeight: 18 },
  sacLigne: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.fond,
    borderRadius: 14, padding: 12,
  },
  sacNom: { fontFamily: F.t800, fontSize: 14, color: C.texte },
  sacDesc: { fontFamily: F.t600, fontSize: 11.5, color: C.texte2, marginTop: 1 },
  mutateurBanniere: {
    marginHorizontal: 18, marginTop: 4, marginBottom: 2, backgroundColor: '#FFF3D6',
    borderRadius: R.pill, paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: C.jaune,
  },
  mutateurTxt: { fontFamily: F.t800, fontSize: 12, color: '#9A6B00', textAlign: 'center' },
  mutateurRang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },

  modalFond: { flex: 1, backgroundColor: 'rgba(42,29,70,0.65)', alignItems: 'center', justifyContent: 'center', padding: 26 },
  modalCarte: { backgroundColor: C.carte, borderRadius: 24, padding: 24, alignItems: 'center', gap: 12, alignSelf: 'stretch', borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE },
  modalTitre: { fontFamily: F.titre, fontSize: 24, color: C.violet },
  modalTitreRang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  gainRang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' },
  modalTexte: { fontFamily: F.t400, fontSize: 13.5, color: C.texte2, textAlign: 'center', lineHeight: 20 },
  ligneGain: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.vertPale, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14,
  },
  ligneGainTxt: { fontFamily: F.t800, fontSize: 15, color: C.vertFonce },
  capsuleGain: { fontFamily: F.t700, fontSize: 14, color: '#9A6B00', textAlign: 'center' },
  pcGain: { fontFamily: F.t800, fontSize: 13.5, textAlign: 'center' },
  championTxt: { fontFamily: F.titre, fontSize: 17, color: '#D2588A', textAlign: 'center' },
});
