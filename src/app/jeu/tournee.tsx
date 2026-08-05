// === Boba Quest — 🗺️ la TOURNÉE DES MAÎTRES (run roguelite hebdo) ===
// Enchaîne des duels à difficulté croissante : tes PV se REPORTENT d'un combat
// à l'autre, chaque victoire ouvre un DRAFT de 3 bonus cumulables, une défaite
// (ou un abandon) termine la run. Adversaires et drafts identiques pour tous
// chaque semaine (seedés). Paliers hebdo sur les victoires CUMULÉES, toutes runs.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { BORD, C, F, R, OMBRE } from '@/constants/charte';
import PastilleCollectible from '@/components/jeu/collectibles';
import { Icone, IconeEmoji } from '@/components/jeu/icones';
import { OBJETS, trouverCollectible } from '@/components/jeu/economie';
import {
  adversaireTournee, BONUS_RUN, draftBonusRun, perlesVictoireTournee, pvMaxEquipeRun,
  TOURNEE_PALIERS,
} from '@/components/jeu/tournee';
import { BandeauPreview, BoutonJeu, EnTeteJeu, formatNb } from '@/components/jeu/ui-jeu';
import {
  abandonnerTournee, choisirBonusTournee, goutsEquipe, lancerTournee, niveauxEquipe, objetsEquipe,
  reclamerPalierTournee, talentsEquipe, tourneeActuelle, TOURNEES_PAR_JOUR,
  tourneesRestantesAujourdhui, useBobaQuest,
} from '@/store/jeu';

export default function TourneeScreen() {
  const insets = useSafeAreaInsets();
  const etat = useBobaQuest();
  const t = tourneeActuelle(etat);
  const run = t.run;
  const restantes = tourneesRestantesAujourdhui(etat);
  const [confirmerAbandon, setConfirmerAbandon] = useState(false);

  const equipePrete = etat.arene.equipe.length >= 3;
  const adv = run ? adversaireTournee(run.semaine, run.etape) : null;
  const draft = run?.draftEnAttente ? draftBonusRun(run) : [];

  // PV max « en combat » de l'équipe (niveaux + talents + objets + outsider + 👅 Goût),
  // ×1,15 par Perle Géante prise en run — reflet fidèle des barres du lobby.
  // 👅 Sans `goutsEquipe`, le lobby afficherait des PV max INFÉRIEURS à ceux du combat :
  // le report de PV d'une étape à l'autre écrêterait alors les cartes bien gourmées.
  const pvMaxBase = pvMaxEquipeRun(
    etat.arene.equipe, objetsEquipe(etat), niveauxEquipe(etat), talentsEquipe(etat),
    goutsEquipe(etat.arene.equipe, etat),
  );
  const multPerle = Math.pow(1.15, run ? run.bonus.filter((b) => b === 'perle-geante').length : 0);
  const pvDe = (id: string) => {
    const max = Math.round((pvMaxBase[id] ?? 1) * multPerle);
    const actuel = Math.max(0, Math.min(max, Math.round(run?.pvReportes[id] ?? pvMaxBase[id] ?? max)));
    return { actuel, max };
  };

  return (
    <View style={[styles.fond, { paddingTop: insets.top + 10 }]}>
      <View style={{ paddingHorizontal: 18 }}>
        <EnTeteJeu titre="Tournée des Maîtres" onRetour={() => router.back()} perles={etat.perles} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu}>
        {/* Bandeau pitch + record */}
        <View style={styles.enTete}>
          <Text style={styles.pitch}>
            Enchaîne les duels, de plus en plus forts. Tes PV se reportent d'un combat
            à l'autre — une carte K.O. reste K.O. ! Perds, et la run s'arrête.
          </Text>
          <View style={styles.recordChip}>
            <Icone nom="trophee" taille={14} />
            <Text style={styles.recordTxt}>
              Record : {t.record} victoire{t.record > 1 ? 's' : ''} d'affilée
            </Text>
          </View>
        </View>

        {/* === Paliers hebdomadaires (victoires cumulées de la semaine) === */}
        <View style={styles.carte}>
          <Text style={styles.carteTitre}>Paliers de la semaine</Text>
          <Text style={styles.carteSousTitre}>
            {t.victoiresSemaine} victoire{t.victoiresSemaine > 1 ? 's' : ''} cette semaine — toutes runs confondues
          </Text>
          {TOURNEE_PALIERS.map((p, i) => {
            const reclame = t.reclames.includes(i);
            const debloque = t.victoiresSemaine >= p.victoires;
            return (
              <View key={p.victoires} style={[styles.palier, reclame && { opacity: 0.55 }]}>
                <View style={styles.palierIcone}>
                  <Icone nom={reclame ? 'check' : debloque ? 'cadeau' : 'cadenas'} taille={15} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.palierNom}>{p.victoires} victoires</Text>
                  <Text style={styles.palierGain}>{p.label}</Text>
                </View>
                {!reclame && (
                  debloque ? (
                    <BoutonJeu titre="Réclamer" onPress={() => reclamerPalierTournee(i)} />
                  ) : (
                    <Text style={styles.palierReste}>encore {p.victoires - t.victoiresSemaine}</Text>
                  )
                )}
              </View>
            );
          })}
        </View>

        {/* === RUN EN COURS === */}
        {run && adv && (
          <View style={styles.runCarte}>
            <Text style={styles.runTitre}>RUN EN COURS — Duel {run.etape}</Text>
            <Text style={styles.runSerie}>
              {run.victoires} victoire{run.victoires > 1 ? 's' : ''} dans cette run
            </Text>

            {/* Adversaire du prochain duel */}
            <View style={styles.advBloc}>
              <View style={styles.advHaut}>
                <Text style={styles.advNom} numberOfLines={1}>{adv.nom}</Text>
                <Text style={styles.puissance}>×{adv.echelle.toFixed(2)}</Text>
              </View>
              <View style={styles.equipeRang}>
                {adv.ids.map((id) => (
                  <View key={id} style={styles.slot}>
                    <PastilleCollectible id={id} taille={52} />
                    <View style={styles.slotNomRang}>
                      <Text style={styles.slotNom} numberOfLines={1}>{trouverCollectible(id)?.nom}</Text>
                      {adv.objets[id]?.map((o) => <IconeEmoji key={o} emoji={OBJETS[o].emoji} taille={11} />)}
                    </View>
                  </View>
                ))}
              </View>
              <Text style={styles.recompense}>
                Victoire : +{formatNb(perlesVictoireTournee(run.etape))} perles
              </Text>
            </View>

            {/* PV reportés de ton équipe */}
            <View style={styles.pvBloc}>
              <Text style={styles.pvTitre}>Ton équipe (PV reportés)</Text>
              {etat.arene.equipe.map((id) => {
                const { actuel, max } = pvDe(id);
                const ko = actuel <= 0;
                return (
                  <View key={id} style={styles.pvLigne}>
                    <PastilleCollectible id={id} taille={30} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pvNom, ko && { color: C.danger }]} numberOfLines={1}>
                        {trouverCollectible(id)?.nom}{ko ? ' — K.O.' : ''}
                      </Text>
                      <View style={styles.pvPiste}>
                        <View style={[styles.pvBarre, { width: `${Math.max(0, Math.min(100, (actuel / Math.max(1, max)) * 100))}%` }]} />
                      </View>
                    </View>
                    <Text style={styles.pvVal}>{ko ? '💀' : `${actuel}/${max}`}</Text>
                  </View>
                );
              })}
            </View>

            {/* Bonus de run cumulés */}
            {run.bonus.length > 0 && (
              <View style={styles.bonusRang}>
                {run.bonus.map((b, i) => (
                  <View key={`${b}-${i}`} style={styles.bonusChip}>
                    <IconeEmoji emoji={BONUS_RUN[b].emoji} taille={13} />
                    <Text style={styles.bonusChipTxt}>{BONUS_RUN[b].nom}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Draft post-victoire OU bouton continuer */}
            {run.draftEnAttente ? (
              <View style={styles.draftBloc}>
                <Text style={styles.draftTitre}>Victoire ! Choisis un bonus de run :</Text>
                {draft.map((id) => {
                  const b = BONUS_RUN[id];
                  return (
                    <Pressable
                      key={id}
                      style={({ pressed }) => [styles.draftCarte, pressed && { transform: [{ scale: 0.98 }] }]}
                      onPress={() => choisirBonusTournee(id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Choisir ${b.nom}`}
                    >
                      <IconeEmoji emoji={b.emoji} taille={30} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.draftNom}>{b.nom}</Text>
                        <Text style={styles.draftDesc}>{b.desc}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <BoutonJeu
                titre={`Continuer — Duel ${run.etape} !`}
                onPress={() => router.push(`/jeu/duel?mode=tournee&duel=${run.etape}&s=${run.semaine}` as any)}
                style={{ alignSelf: 'stretch' }}
              />
            )}

            {/* Abandon discret (confirmation en 2 taps) */}
            <Pressable
              onPress={() => {
                if (confirmerAbandon) { setConfirmerAbandon(false); abandonnerTournee(); }
                else setConfirmerAbandon(true);
              }}
              hitSlop={8}
            >
              <Text style={styles.abandon}>
                {confirmerAbandon ? 'Vraiment abandonner ? La run sera perdue — tape encore pour confirmer' : 'Abandonner la run'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* === PAS DE RUN : lancement === */}
        {!run && (
          <View style={styles.carte}>
            <Text style={styles.carteTitre}>Prêt pour une nouvelle run ?</Text>
            <Text style={styles.pitch}>
              Ton équipe d'Arène part au front. Chaque victoire rapporte des perles et
              ouvre un draft de 3 bonus cumulables. Adversaires identiques pour tous
              cette semaine !
            </Text>
            {/* 🩹 26/07 — La Tournée était une ferme à perles : aucun coût, aucune limite.
                Gagner le duel 1 (95 % de victoire) puis abandonner rapportait ~80 perles
                par cycle à l'infini, et débloquait les paliers hebdo sans dépasser le
                duel 2. Elle est désormais limitée à TOURNEES_PAR_JOUR runs par jour — ce
                qu'il faut ANNONCER, sinon un bouton qui ne répond plus se lit comme un bug. */}
            <BoutonJeu
              titre={restantes > 0 ? 'Lancer la Tournée — Duel 1 !' : 'Plus de tournée aujourd’hui'}
              disabled={!equipePrete || restantes <= 0}
              onPress={() => {
                if (lancerTournee()) {
                  const semaine = tourneeActuelle().run?.semaine;
                  if (semaine) router.push(`/jeu/duel?mode=tournee&duel=1&s=${semaine}` as any);
                }
              }}
              style={{ alignSelf: 'stretch' }}
            />
            <Text style={styles.hint} accessibilityRole="text">
              {restantes > 0
                ? `${restantes} tournée${restantes > 1 ? 's' : ''} sur ${TOURNEES_PAR_JOUR} encore disponible${restantes > 1 ? 's' : ''} aujourd’hui.`
                : `Tu as utilisé tes ${TOURNEES_PAR_JOUR} tournées du jour — elles se rechargent demain.`}
            </Text>
            {!equipePrete && (
              <Text style={styles.hint}>Constitue d'abord ton équipe de 3 cartes à l'Arène.</Text>
            )}
          </View>
        )}

        <BandeauPreview />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  contenu: { padding: 18, gap: 14, paddingBottom: 34 },

  enTete: { alignItems: 'center', gap: 8 },
  pitch: { fontFamily: F.t600, fontSize: 12.5, color: C.texte2, textAlign: 'center', lineHeight: 18 },
  recordChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.jaunePale, borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 12,
    borderWidth: 1, borderColor: C.jaune,
  },
  recordTxt: { fontFamily: F.t800, fontSize: 12.5, color: '#9A6B00' },

  carte: { backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 10, borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE },
  carteTitre: { fontFamily: F.titre, fontSize: 17, color: C.violet, textAlign: 'center' },
  carteSousTitre: { fontFamily: F.t600, fontSize: 12, color: C.texte2, textAlign: 'center' },
  hint: { fontFamily: F.t600, fontSize: 12, color: C.texte3, textAlign: 'center' },

  palier: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  palierIcone: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.lavande,
  },
  palierNom: { fontFamily: F.t800, fontSize: 13.5, color: C.texte },
  palierGain: { fontFamily: F.t600, fontSize: 11.5, color: C.vertFonce },
  palierReste: { fontFamily: F.t700, fontSize: 12, color: C.texte3 },

  runCarte: {
    backgroundColor: C.violet, borderRadius: R.carte, padding: 16, gap: 12, ...OMBRE,
  },
  runTitre: { fontFamily: F.titre, fontSize: 18, color: '#fff', textAlign: 'center' },
  runSerie: { fontFamily: F.t700, fontSize: 12.5, color: C.lavande, textAlign: 'center' },

  advBloc: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: R.carte, padding: 12, gap: 8 },
  advHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  advNom: { fontFamily: F.titre, fontSize: 15.5, color: '#fff', flexShrink: 1 },
  puissance: {
    fontFamily: F.t800, fontSize: 12, color: C.violetProfond,
    backgroundColor: C.lavande, borderRadius: R.pill, paddingVertical: 3, paddingHorizontal: 9,
    overflow: 'hidden',
  },
  equipeRang: { flexDirection: 'row', justifyContent: 'space-around' },
  slot: { alignItems: 'center', gap: 3, width: 88 },
  slotNom: { fontFamily: F.t700, fontSize: 11, color: '#fff' },
  slotNomRang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, flexWrap: 'wrap' },
  recompense: { fontFamily: F.t700, fontSize: 12.5, color: C.jaune, textAlign: 'center' },

  pvBloc: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: R.carte, padding: 12, gap: 8 },
  pvTitre: { fontFamily: F.t800, fontSize: 12.5, color: C.lavande, textAlign: 'center' },
  pvLigne: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pvNom: { fontFamily: F.t700, fontSize: 12, color: '#fff' },
  pvPiste: { height: 7, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.25)', overflow: 'hidden', marginTop: 3 },
  pvBarre: { height: 7, borderRadius: 4, backgroundColor: C.vert },
  pvVal: { fontFamily: F.t700, fontSize: 11, color: C.lavande, width: 58, textAlign: 'right' },

  bonusRang: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  bonusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: R.pill,
    paddingVertical: 4, paddingHorizontal: 9,
  },
  bonusChipTxt: { fontFamily: F.t700, fontSize: 11, color: '#fff' },

  draftBloc: { gap: 8 },
  draftTitre: { fontFamily: F.titre, fontSize: 15, color: C.jaune, textAlign: 'center' },
  draftCarte: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.carte, borderRadius: R.carte, padding: 12,
    borderWidth: 2, borderColor: C.jaune,
  },
  draftNom: { fontFamily: F.t800, fontSize: 14, color: C.texte },
  draftDesc: { fontFamily: F.t600, fontSize: 11.5, color: C.texte2, lineHeight: 16 },

  abandon: { fontFamily: F.t600, fontSize: 11.5, color: C.lavande, textAlign: 'center', textDecorationLine: 'underline' },
});
