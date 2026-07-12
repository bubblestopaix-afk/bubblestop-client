// === Boba Quest — écran de DUEL (combat tour par tour) ===
// Type Pokémon : ton actif en bas, l'adversaire en haut, tu choisis l'attaque,
// les événements du moteur (arene.ts) sont rejoués un à un avec animations.
// Modes : ?mode=pnj&rang=N (Maître de l'Arène) · ?mode=ami[&amical=1|&mise=X&gain=Y]
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Line } from 'react-native-svg';

import { C, F, R, OMBRE } from '@/constants/charte';
import {
  adversairePNJ, adversaireTournoi, Combattant, CoteCombat, creerCombat, creerCombatBoss,
  CHARGE_MAX, decrireIntention, equipeSam, equipeAmi, EtatCombat, EvtCombat,
  GARDE_REDUCTION, HINT_ATTAQUE, jouerRound, multType, SIGNATURES, SPE_USAGES,
} from '@/components/jeu/arene';
import PastilleCollectible from '@/components/jeu/collectibles';
import { BurstSkia } from '@/components/jeu/combat-skia';
import { Icone, IconeEmoji, IconeType } from '@/components/jeu/icones';
import {
  bossDeLaSemaine, cleJour, cleSemaine, CONSOMMABLES, CONSOMMABLE_IDS, ConsommableId,
  mutateurDuJour, OBJETS, RARETES, TOURNOI_ETAPES, trouverCollectible,
} from '@/components/jeu/economie';
import { BoutonJeu, formatNb, IconePerle } from '@/components/jeu/ui-jeu';
import {
  defaiteArene, defaiteTournoi, enregistrerActionCarte, enregistrerVictoireEquipe,
  objetsEquipe, resoudreDefiAmi, resoudreDuelAmi, useBobaQuest,
  utiliserConsommable, victoireArene, victoireBoss, victoireTournoi,
} from '@/store/jeu';

type Recap = (
  | { type: 'pnj'; gagne: boolean; perles: number; capsule: 'classique' | 'doree' | null; rang: number; pc: number }
  | { type: 'tournoi'; gagne: boolean; perles: number; capsule: 'classique' | 'doree' | null; etape: number; champion: boolean }
  | { type: 'boss'; gagne: boolean; perles: number; capsules: number; eclats: number; deja: boolean }
  | { type: 'defi'; gagne: boolean; ami: string; perles: number }
  | { type: 'ami'; gagne: boolean; amical: boolean; miseId?: string; gainId?: string; nouveau?: boolean }
) & { bonusVedette?: number };

export default function DuelScreen() {
  const insets = useSafeAreaInsets();
  const { height: hauteurEcran } = useWindowDimensions();
  const compact = hauteurEcran < 900;
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
    ? creerCombatBoss(jeu.arene.equipe, boss, objetsEquipe(jeu), mutateur)
    : creerCombat(jeu.arene.equipe, adversaire.ids, adversaire.echelle, objetsEquipe(jeu), adversaire.objets, mutateur));
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
    const progression = gagne
      ? enregistrerVictoireEquipe(combat.equipes.a.map((c) => c.id))
      : { bonusVedette: 0 };
    if (mode === 'pnj') {
      if (gagne) {
        const r = victoireArene(rang);
        setRecap({ type: 'pnj', gagne, perles: r.perles, bonusVedette: progression.bonusVedette, capsule: r.capsule, rang, pc: r.pc });
      } else {
        const r = defaiteArene();
        setRecap({ type: 'pnj', gagne, perles: r.perles, capsule: null, rang, pc: r.pc });
      }
    } else if (mode === 'boss') {
      if (gagne) {
        const r = victoireBoss();
        setRecap({ type: 'boss', gagne, perles: r.perles, bonusVedette: progression.bonusVedette, capsules: r.capsules, eclats: r.eclats, deja: r.deja });
      } else {
        setRecap({ type: 'boss', gagne, perles: 0, capsules: 0, eclats: 0, deja: false });
      }
    } else if (mode === 'tournoi') {
      if (gagne) {
        const r = victoireTournoi(etape);
        setRecap({ type: 'tournoi', gagne, perles: r.perles, bonusVedette: progression.bonusVedette, capsule: r.capsule, etape, champion: r.champion });
      } else {
        const r = defaiteTournoi();
        setRecap({ type: 'tournoi', gagne, perles: r.perles, capsule: null, etape, champion: false });
      }
    } else if (mode === 'defi') {
      const r = resoudreDefiAmi(amiNom, gagne);
      setRecap({ type: 'defi', gagne, ami: amiNom, perles: r.perles, bonusVedette: progression.bonusVedette });
    } else if (amical) {
      setRecap({ type: 'ami', gagne, amical: true, bonusVedette: progression.bonusVedette });
    } else {
      const { nouveau } = resoudreDuelAmi(gagne, miseId, gainId);
      setRecap({ type: 'ami', gagne, amical: false, miseId, gainId, nouveau, bonusVedette: progression.bonusVedette });
    }
  }, [mode, rang, etape, amical, miseId, gainId, amiNom]);

  const rejouerEvts = async (evts: EvtCombat[]) => {
    let critFlag = false;
    for (const evt of evts) {
      switch (evt.t) {
        case 'annonce':
          pousserJournal(evt.texte);
          await attendre(520);
          break;
        case 'degats': {
          majPv(evt.cote, evt.index, evt.pvApres); // → la barre GLISSE vers la nouvelle valeur
          const surActif = evt.index === afficheRef.current.actifs[evt.cote];
          if (surActif) {
            secouer(evt.cote);
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
        case 'ko':
          pousserJournal(`${evt.nom} est K.O. ! 💥`);
          await attendre(750);
          break;
        case 'entree':
          pousserJournal(`${evt.nom} entre en piste !`);
          majActif(evt.cote, evt.index); // → la carte bascule au bon MOMENT du replay
          await attendre(600);
          break;
        case 'fin':
          pousserJournal(evt.vainqueur === 'a' ? 'VICTOIRE ! 🎉' : 'Défaite… 😵‍💫');
          await attendre(500);
          finaliser(evt.vainqueur);
          break;
      }
    }
  };

  const attaquer = async (choix: 0 | 1 | 'signature') => {
    if (enCours || combat.fini) return;
    setEnCours(true);
    const actif = combat.equipes.a[combat.actifs.a];
    if (!actif.etourdi && choix === 1) enregistrerActionCarte(actif.id, 'spe');
    else if (!actif.etourdi && choix === 'signature') enregistrerActionCarte(actif.id, 'signature');
    const evts = jouerRound(combat, choix);
    await rejouerEvts(evts);
    synchroniser(); // filet de sécurité : affichage = état exact du moteur
    setEnCours(false);
  };

  const garder = async () => {
    if (enCours || combat.fini) return;
    setEnCours(true);
    const actif = combat.equipes.a[combat.actifs.a];
    if (!actif.etourdi) enregistrerActionCarte(actif.id, 'garde');
    const evts = jouerRound(combat, 'garde');
    await rejouerEvts(evts);
    synchroniser();
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
    <View style={[styles.fond, { paddingTop: insets.top + (compact ? 4 : 8) }]}>
      {/* header */}
      <View style={styles.hud}>
        <Pressable
          style={styles.fermer} onPress={quitter} hitSlop={8}
          accessibilityRole="button" accessibilityLabel="Quitter le combat"
        >
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Line x1={6} y1={6} x2={18} y2={18} stroke={C.violetProfond} strokeWidth={2.6} strokeLinecap="round" />
            <Line x1={18} y1={6} x2={6} y2={18} stroke={C.violetProfond} strokeWidth={2.6} strokeLinecap="round" />
          </Svg>
        </Pressable>
        <Text style={styles.titre} numberOfLines={1}>{adversaire.nom}</Text>
        <Pressable
          style={styles.vitesseBtn} disabled={enCours} onPress={() => setVitesse((v) => v === 1 ? 2 : 1)}
          accessibilityRole="button" accessibilityLabel={`Vitesse du combat, fois ${vitesse}`}
          accessibilityHint="Bascule entre la vitesse normale et accélérée"
          accessibilityState={{ disabled: enCours }}
        >
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

      <ScrollView
        style={styles.combatScroll}
        contentContainerStyle={[styles.combatContenu, compact && styles.combatContenuCompact]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {!combat.fini && (
          <View
            style={[styles.intention, compact && styles.intentionCompact, { backgroundColor: fondIntention }]}
            accessibilityRole="summary"
            accessibilityLabel={`Prochaine action adverse : ${intention.titre}. ${intention.detail}`}
          >
            <View style={styles.intentionHaut}>
              <Text style={styles.intentionLabel}>PROCHAINE ACTION ADVERSE</Text>
              {lui.gimmick && <Text style={styles.phaseBoss}>PHASE {lui.bossPhase}</Text>}
            </View>
            <Text style={styles.intentionTitre} numberOfLines={1}>{intention.titre}</Text>
            <Text style={styles.intentionDetail} numberOfLines={compact ? 1 : 2}>{intention.detail}</Text>
          </View>
        )}

        <View style={[styles.zone, compact && styles.zoneCompact]}>
        {/* === Adversaire === */}
        <CarteCombattant
          key={`b-${affiche.actifs.b}`}
          cote="b" equipe={combat.equipes.b} actifIdx={affiche.actifs.b}
          pvAffiches={affiche.pv.b} secousse={secousses.b} flottant={flottant}
          burst={burst?.cote === 'b' ? burst : null} inverse compact={compact}
        />

        {/* === Journal + avantage === */}
        <View style={[styles.centre, compact && styles.centreCompact]}>
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
          {journal.map((t, i) => (
            <Text key={`${t}-${i}`} style={[styles.journal, i > 0 && { opacity: 0.45, fontSize: 12.5 }]}>{t}</Text>
          ))}
        </View>

        {/* === Moi === */}
        <CarteCombattant
          key={`a-${affiche.actifs.a}`}
          cote="a" equipe={combat.equipes.a} actifIdx={affiche.actifs.a}
          pvAffiches={affiche.pv.a} secousse={secousses.a} flottant={flottant}
          burst={burst?.cote === 'a' ? burst : null} compact={compact}
        />
        </View>

        {/* === ⭐ Signature : jauge (se remplit en agissant/encaissant) ou bouton prêt === */}
        {!combat.fini && (
          sigPrete ? (
            <Pressable
              style={[styles.sigPret, compact && styles.sigPretCompact, enCours && { opacity: 0.45 }]}
              disabled={enCours}
              onPress={() => attaquer('signature')}
              accessibilityRole="button"
              accessibilityLabel={`Signature prête : ${sig.nom}. ${sig.desc}`}
              accessibilityState={{ disabled: enCours }}
            >
              <Icone nom="eclat" taille={18} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.sigPretNom, compact && styles.sigPretNomCompact]} numberOfLines={1}>{sig.nom} — PRÊT !</Text>
                {!compact && <Text style={styles.sigPretHint} numberOfLines={1}>{sig.desc}</Text>}
              </View>
            </Pressable>
          ) : (
            <View
              style={[styles.sigJauge, compact && styles.sigJaugeCompact]}
              accessibilityRole="progressbar"
              accessibilityLabel={`Signature chargée à ${moi.charge} sur ${CHARGE_MAX}`}
              accessibilityValue={{ min: 0, max: CHARGE_MAX, now: moi.charge }}
            >
              <Text style={styles.sigJaugeTxt}>Signature</Text>
              <View style={styles.sigPips}>
                {Array.from({ length: CHARGE_MAX }, (_, i) => (
                  <View key={i} style={[styles.sigPip, i < moi.charge && styles.sigPipPlein]} />
                ))}
              </View>
              {!compact && <Text style={styles.sigJaugeHint}>attaque et encaisse pour charger</Text>}
            </View>
          )
        )}
      </ScrollView>

      {/* === Attaques === */}
      <View style={[styles.attaques, compact && styles.attaquesCompact, { paddingBottom: (bancActif || sacDispo) ? 6 : insets.bottom + 12 }]}>
        {moi.attaques.map((a, i) => {
          const spe = i === 1;
          const epuisee = spe && moi.speRestantes <= 0;
          return (
            <Pressable
              key={a.nom}
              style={[styles.btnAttaque, (enCours || combat.fini || epuisee) && { opacity: 0.45 }, spe && styles.btnAttaqueSpe]}
              disabled={enCours || combat.fini || epuisee}
              onPress={() => attaquer(i as 0 | 1)}
              accessibilityRole="button"
              accessibilityLabel={`${a.nom}. ${HINT_ATTAQUE[a.type]}${spe ? `. ${moi.speRestantes} utilisations restantes` : ''}`}
              accessibilityState={{ disabled: enCours || combat.fini || epuisee }}
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
          <View style={[styles.bancBloc, compact && styles.bancBlocCompact, { paddingBottom: insets.bottom + 6 }]}>
            {banc.length > 0 && (
              <View style={styles.bancRang}>
                <Text style={styles.bancLabel}>Changer :</Text>
                {banc.map(({ c, i }) => {
                  const av = multType(c.set, lui.set);
                  return (
                    <Pressable
                      key={c.id}
                      style={[styles.bancChip, compact && styles.bancChipCompact, enCours && { opacity: 0.4 }]}
                      disabled={enCours}
                      onPress={() => changer(i)}
                      accessibilityRole="button"
                      accessibilityLabel={`Faire entrer ${c.nom}${av === 1.5 ? ', avantage de type' : av === 0.75 ? ', désavantage de type' : ''}`}
                      accessibilityHint="Changer de combattant coûte le tour"
                      accessibilityState={{ disabled: enCours }}
                    >
                      <PastilleCollectible id={c.id} taille={compact ? 22 : 26} />
                      <Text style={styles.bancChipNom} numberOfLines={1}>{c.nom}</Text>
                      {av !== 1 && <Text style={[styles.bancAv, { color: av === 1.5 ? C.vertFonce : C.danger }]}>{av === 1.5 ? '▲' : '▼'}</Text>}
                    </Pressable>
                  );
                })}
              </View>
            )}
            <View style={styles.outilsRang}>
              <Pressable
                style={[styles.gardeBtn, (!gardeDispo || enCours) && styles.gardeBtnInactif]}
                disabled={!gardeDispo || enCours}
                onPress={garder}
                accessibilityRole="button"
                accessibilityLabel={gardeDispo ? `Garde, réduit le prochain impact de ${Math.round(GARDE_REDUCTION * 100)} pour cent` : `Garde indisponible pendant ${gardeRestante} tour`}
                accessibilityState={{ disabled: !gardeDispo || enCours }}
              >
                <Icone nom="bouclier" taille={15} />
                <Text style={[styles.gardeBtnTxt, !gardeDispo && styles.gardeBtnTxtInactif]}>
                  {gardeDispo ? `Garde −${Math.round(GARDE_REDUCTION * 100)} %` : `Garde · ${gardeRestante} t`}
                </Text>
              </Pressable>
              {sacDispo && (
                <Pressable
                  style={[styles.sacBtn, enCours && { opacity: 0.4 }]} disabled={enCours} onPress={() => setSacVisible(true)}
                  accessibilityRole="button" accessibilityLabel={`Sac de combat, ${sacObjets.reduce((s, id) => s + (jeu.consommables[id] ?? 0), 0)} objets`}
                  accessibilityState={{ disabled: enCours }}
                >
                  <Icone nom="sac" taille={15} />
                  <Text style={styles.sacBtnTxt}>Sac{sacObjets.length ? ` · ${sacObjets.reduce((s, id) => s + (jeu.consommables[id] ?? 0), 0)}` : ''}</Text>
                </Pressable>
              )}
            </View>
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

      {/* === Fin === */}
      <Modal visible={!!recap} transparent animationType="fade" onRequestClose={() => {}}>
        {recap && (
          <View style={styles.modalFond}>
            <View style={styles.modalCarte}>
              <Icone nom={recap.gagne ? 'trophee' : 'triste'} taille={48} />
              <Text style={styles.modalTitre}>{recap.gagne ? 'VICTOIRE !' : 'Défaite…'}</Text>
              {!!recap.bonusVedette && (
                <View style={styles.gainRang}>
                  <Icone nom="etoile" taille={15} />
                  <Text style={styles.capsuleGain}>Carte vedette : +{formatNb(recap.bonusVedette)} perles</Text>
                </View>
              )}

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
                  {recap.gagne
                    ? <Text style={styles.modalTexte}>Rang {recap.rang + 1} débloqué — le prochain Maître t'attend.</Text>
                    : <Text style={styles.modalTexte}>Change d'équipe ou monte en puissance : le triangle des types fait tout !</Text>}
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

// Carte d'un combattant actif : pastille, nom, chips, barre de PV ANIMÉE
// (elle glisse à chaque coup), points d'équipe. Tout vient de l'état REJOUÉ.
function CarteCombattant({ cote, equipe, actifIdx, pvAffiches, secousse, flottant, burst, inverse, compact }: {
  cote: CoteCombat; equipe: Combattant[]; actifIdx: number; pvAffiches: number[];
  secousse: Animated.Value;
  flottant: { cote: CoteCombat; txt: string; couleur: string; cle: number } | null;
  burst: { cote: CoteCombat; crit: boolean; cle: number } | null;
  inverse?: boolean;
  compact: boolean;
}) {
  const c = equipe[actifIdx];
  const pv = pvAffiches[actifIdx];
  const pct = Math.max(0, Math.min(100, (pv / c.pvMax) * 100));
  const couleurPv = pct > 50 ? C.vert : pct > 22 ? C.jaune : C.danger;
  const meta = trouverCollectible(c.id);
  const taillePastille = compact ? 68 : 86;
  const tailleBurst = compact ? 104 : 124;

  // La barre GLISSE vers sa nouvelle valeur (au lieu de sauter)
  const largeur = useRef(new Animated.Value(pct)).current;
  useEffect(() => {
    Animated.timing(largeur, {
      toValue: pct, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [pct, largeur]);

  return (
    <Animated.View
      style={[styles.combattant, compact && styles.combattantCompact, inverse && { flexDirection: 'row-reverse' }, {
        transform: [{ translateX: secousse.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] }) }],
      }]}
    >
      <View style={{ alignItems: 'center', gap: 4 }}>
        <View style={{ opacity: pv > 0 ? 1 : 0.3 }}>
          <PastilleCollectible id={c.id} taille={taillePastille} />
          {burst && (
            <View pointerEvents="none" style={{ position: 'absolute', left: taillePastille / 2 - tailleBurst / 2, top: taillePastille / 2 - tailleBurst / 2 }}>
              <BurstSkia taille={tailleBurst} crit={burst.crit} cle={burst.cle} />
            </View>
          )}
        </View>
        {flottant && flottant.cote === cote && (
          <Text key={flottant.cle} style={[styles.flottant, { color: flottant.couleur }]}>{flottant.txt}</Text>
        )}
      </View>
      <View style={{ flex: 1, gap: compact ? 4 : 6 }}>
        <View style={styles.nomLigne}>
          <View style={styles.nomRang}>
            <Text style={[styles.nom, compact && styles.nomCompact]} numberOfLines={1}>{c.nom}</Text>
            {c.objets.map((o) => <IconeEmoji key={o} emoji={OBJETS[o].emoji} taille={14} />)}
          </View>
          <View style={styles.chipsRow}>
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
    alignItems: 'center', justifyContent: 'center', ...OMBRE,
  },
  titre: { flex: 1, fontFamily: F.titre, fontSize: 18, color: C.violet, textAlign: 'center' },
  vitesseBtn: {
    width: 40, height: 34, borderRadius: R.pill, backgroundColor: C.violet,
    alignItems: 'center', justifyContent: 'center',
  },
  vitesseTxt: { fontFamily: F.t800, fontSize: 13, color: '#fff', fontVariant: ['tabular-nums'] },

  combatScroll: { flex: 1, minHeight: 0 },
  combatContenu: { flexGrow: 1 },
  combatContenuCompact: { paddingTop: 1 },

  intention: {
    marginHorizontal: 18, marginTop: 5, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12,
    borderWidth: 1, borderColor: C.bord,
  },
  intentionCompact: { marginHorizontal: 12, marginTop: 3, paddingVertical: 5, paddingHorizontal: 10 },
  intentionHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  intentionLabel: { fontFamily: F.t800, fontSize: 9.5, color: C.texte3, letterSpacing: 0.4 },
  intentionTitre: { fontFamily: F.t800, fontSize: 13.5, color: C.texte, marginTop: 2 },
  intentionDetail: { fontFamily: F.t600, fontSize: 10.5, color: C.texte2 },
  phaseBoss: { fontFamily: F.t800, fontSize: 9.5, color: C.danger },

  zone: { flexGrow: 1, padding: 18, gap: 12, justifyContent: 'space-between' },
  zoneCompact: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },

  combattant: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.carte, borderRadius: R.carte, padding: 14, ...OMBRE,
  },
  combattantCompact: { gap: 10, padding: 10, borderRadius: 18 },
  nomLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nomRang: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  nom: { fontFamily: F.t800, fontSize: 16.5, color: C.texte },
  nomCompact: { fontSize: 15 },
  pvTxtRang: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chargeRang: { flexDirection: 'row', gap: 2.5, marginLeft: 3 },
  chargePip: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.lavande },
  chargePipPlein: { backgroundColor: '#F5A93B' },
  chips: { fontFamily: F.t700, fontSize: 11.5, color: C.texte2 },
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
  centreCompact: { gap: 3, minHeight: 54 },
  avantage: { borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 12 },
  avantageTxt: { fontFamily: F.t800, fontSize: 12 },
  avantageRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap', justifyContent: 'center' },
  journal: { fontFamily: F.t700, fontSize: 14.5, color: C.texte, textAlign: 'center' },

  attaques: { flexDirection: 'row', gap: 12, paddingHorizontal: 18 },
  attaquesCompact: { gap: 8, paddingHorizontal: 12 },
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
  sigJaugeCompact: { marginHorizontal: 12, marginBottom: 6, paddingVertical: 6, justifyContent: 'center' },
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
  sigPretCompact: { marginHorizontal: 12, marginBottom: 6, paddingVertical: 7, paddingHorizontal: 12 },
  sigPretNom: { fontFamily: F.t800, fontSize: 14.5, color: '#4A2B00' },
  sigPretNomCompact: { fontSize: 13.5 },
  sigPretHint: { fontFamily: F.t700, fontSize: 10.5, color: '#7A4B05' },
  bancBloc: { gap: 6, paddingHorizontal: 18, paddingTop: 7 },
  bancBlocCompact: { gap: 4, paddingHorizontal: 12, paddingTop: 5 },
  bancRang: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bancLabel: { fontFamily: F.t800, fontSize: 12.5, color: C.texte2 },
  bancChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.carte,
    borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1.5, borderColor: C.bord,
  },
  bancChipCompact: { flex: 1, minWidth: 0, gap: 4, paddingVertical: 4, paddingHorizontal: 7 },
  bancChipNom: { fontFamily: F.t700, fontSize: 12.5, color: C.texte },
  bancAv: { fontFamily: F.t800, fontSize: 12 },
  gardeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#E9E2F7', borderRadius: R.pill, paddingVertical: 6, paddingHorizontal: 12,
    borderWidth: 1, borderColor: C.violetClair,
  },
  gardeBtnTxt: { fontFamily: F.t800, fontSize: 11.5, color: C.violet },
  gardeBtnInactif: { backgroundColor: '#E4DEEC', borderColor: '#B9ABD0', opacity: 0.72 },
  gardeBtnTxtInactif: { color: '#6F6383' },
  outilsRang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  sacBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.violet, borderRadius: R.pill, paddingVertical: 6, paddingHorizontal: 14,
  },
  sacBtnTxt: { fontFamily: F.t800, fontSize: 12.5, color: '#fff' },
  sacCarte: { backgroundColor: C.carte, borderRadius: 24, padding: 20, gap: 10, alignSelf: 'stretch', ...OMBRE },
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
  modalCarte: { backgroundColor: C.carte, borderRadius: 24, padding: 24, alignItems: 'center', gap: 12, alignSelf: 'stretch', ...OMBRE },
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
