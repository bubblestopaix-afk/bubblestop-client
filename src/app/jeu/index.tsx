// === Boba Quest — hub du jeu ===
// Solde de perles, Aventure (niveaux), défis du jour, Infini, Capsules,
// Collection, Boutique des prix, Comptoir de Troc.
// ⚠️ La Roue du Mois n'habite PLUS ici (03/08/2026) : c'est un jeu autonome sur
// /roue (flag serveur `roue_du_mois`), carte dédiée sur l'accueil. L'ancienne
// route /jeu/roulette redirige. Le code roulette du store reste pour la compat
// des sauvegardes, mais aucune tuile ne pointe plus dessus.
import { useEffect, useState } from 'react';
import {
  Alert, DevSettings, StyleSheet, View, Text, ScrollView, Pressable, Modal, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import Svg, { Circle, Path } from 'react-native-svg';

import { BORD, C, F, OMBRE, OMBRE_VIOLETTE, R } from '@/constants/charte';
import { TitreKawaii, BoutonRetour, Etincelle, MascottePerle, Vague } from '@/components/ui-kit';
import {
  COLLECTIBLES, evenementDuJour, GORGEE_FRAICHE, gorgeePourBoissons, multSerie,
  PASS_PALIERS, QUETE_TAMPON,
} from '@/components/jeu/economie';
import { Icone } from '@/components/jeu/icones';
import {
  BandeauPreview, BoutonJeu, Confettis, formatNb, IconePerle, PictoHub, TuileMode,
} from '@/components/jeu/ui-jeu';
import { hapticMoyen, hapticSucces } from '@/lib/juice';
import { consommerVisitesEnAttente, visitesEnAttente } from '@/lib/visites';
import { programmerSauvegarde } from '@/lib/sauvegarde-jeu';
import type { GainGorgee } from '@/components/jeu/economie';
import {
  bonusJourDispo, boostVisite, crediterGorgee, defisDuJour, etatPass,
  nbUniques, offresTrocAujourdhui, paliersAReclamer,
  paliersTourneeReclamables, reclamerBonusDefis, reclamerDefi, reclamerQueteTampon,
  effacerSauvegardeLocalePourTestRestauration, resetBobaQuest, tickSerie,
  tourneeActuelle, useBobaQuest,
} from '@/store/jeu';

export default function HubBobaQuest() {
  const insets = useSafeAreaInsets();
  const etat = useBobaQuest();
  // 🔥 Série quotidienne : pointée à l'arrivée sur le hub (une fois par jour)
  const [serieJour, setSerieJour] = useState<{ jours: number; perles: number; capsuleDoree: boolean } | null>(null);
  useEffect(() => {
    const r = tickSerie();
    if (r) {
      setSerieJour(r);
      if (r.capsuleDoree) hapticSucces(); else hapticMoyen();
    }
  }, []);
  const [resetVisible, setResetVisible] = useState(false);

  // 🧋 LA GORGÉE FRAÎCHE — une VRAIE visite en boutique récompense le joueur.
  // `lib/visites` a détecté l'achat depuis la hausse du compteur de fidélité (hors store,
  // pour ne pas importer @/store/jeu dans l'accueil de l'app) ; on la consomme ici et on
  // crédite. Le tir est unique par visite : `consommerVisitesEnAttente` remet à zéro.
  const [gorgee, setGorgee] = useState<GainGorgee | null>(null);
  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        // ORDRE VOLONTAIRE : on LIT d'abord, on crédite, et on ne consomme QUE si le
        // crédit a réussi. L'inverse (consommer puis créditer) perdrait la récompense si
        // le store refusait le crédit — par exemple sur une sauvegarde illisible.
        const boissons = await visitesEnAttente();
        if (!vivant || boissons <= 0) return;
        const gain = crediterGorgee(boissons);
        if (!gain) return;                       // on retentera à la prochaine ouverture
        await consommerVisitesEnAttente();
        if (vivant) { setGorgee(gain); hapticSucces(); }
      } catch { /* rien à créditer, ou lecture impossible : silencieux */ }
    })();
    return () => { vivant = false; };
  }, []);
  const visite = boostVisite(etat);

  // 💾 Le hub est le point de passage de toute session de jeu : revenir ici après avoir
  // joué programme une sauvegarde serveur différée (anti-rafale). Le passage en
  // arrière-plan en déclenche une immédiate, c'est là que l'on risque de perdre l'app.
  useEffect(() => { programmerSauvegarde(); }, [etat.revision]);

  const uniques = nbUniques(etat);
  const bonus = bonusJourDispo(etat);
  const aReclamer = etat.gains.filter((g) => g.statut === 'a_reclamer').length;
  const capsulesGratuites = etat.capsulesGratuites + etat.capsulesDoreesGratuites;
  const defis = defisDuJour(etat);
  const tousReclames = defis.every((d) => d.reclame);
  const etoilesTotal = Object.values(etat.aventure.etoiles).reduce((s, e) => s + e, 0);
  const evt = evenementDuJour();
  const pass = etatPass(etat);
  const passAReclamer = paliersAReclamer(etat);
  const prochainPalier = PASS_PALIERS.find((p) => pass.xp < p.xp);
  const dernierPalier = PASS_PALIERS[PASS_PALIERS.length - 1];
  const pctPass = Math.min(100, (pass.xp / dernierPalier.xp) * 100);
  // indice « encore X avant la capsule du rang 5/10… »
  const versCapsuleArene = 5 - ((etat.arene.rang - 1) % 5);
  // 🗺️ Tournée : badge = n° du prochain duel (ou « ! » si un draft / palier attend)
  const suiviTournee = tourneeActuelle(etat);
  const badgeTournee = suiviTournee.run
    ? (suiviTournee.run.draftEnAttente ? '!' : String(suiviTournee.run.etape))
    : paliersTourneeReclamables(etat) > 0 ? '!' : undefined;
  // 🤝 Troc : badge « ! » quand au moins une offre du jour est faisable et pas encore faite
  const trocDispo = offresTrocAujourdhui(etat).some((o) => !o.fait && o.faisable.ok);
  // Guide dérivé : tant que la collection n'a pas commencé, le hub pointe soit
  // vers l'Aventure, soit vers la capsule gratuite déjà gagnée. Zéro nouveau champ.
  const debutSansCollection = etat.capsulesOuvertes === 0 && uniques === 0;
  const etapeDebut: 'jouer' | 'ouvrir' | null = debutSansCollection
    ? (capsulesGratuites > 0 ? 'ouvrir' : 'jouer')
    : null;
  const tuileAventure = (
    <CarteAventure
      niveau={etat.aventure.niveauMax}
      etoiles={etoilesTotal}
      cta={etapeDebut === 'jouer' ? "Commencer l'aventure ›" : "Continuer l'aventure ›"}
    />
  );
  const tuilePremiereCapsule = (
    <Pressable
      style={styles.tuileCapsuleDebut}
      onPress={() => router.push('/jeu/capsules' as any)}
      accessibilityRole="button"
      accessibilityLabel="Capsule gratuite prête à ouvrir"
      accessibilityHint="Ouvre la machine à capsules"
    >
      <PictoHub id="capsules" fond="#fff" taille={52} />
      <View style={{ flex: 1 }}>
        <Text style={styles.tuileJouerTitre}>Ta capsule t’attend</Text>
        <Text style={styles.tuileJouerSous}>
          Tu l’as gagnée en Aventure. Ouvre-la pour découvrir ton premier personnage.
        </Text>
      </View>
      <Text style={styles.tuileJouerGo}>OUVRIR</Text>
    </Pressable>
  );

  return (
    <View style={[styles.fond, { paddingTop: insets.top + 10 }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {/* === En-tête clair (maquette 2c) : retour · Boba Quest · pilule perles === */}
        <View style={styles.entete}>
          <BoutonRetour onPress={() => router.back()} />
          <View style={{ flex: 1 }}>
            <Text style={styles.titre}>Boba Quest</Text>
            <Text style={styles.sousTitre}>Ton aventure boba</Text>
          </View>
          <View style={styles.perlesPill}>
            <IconePerle taille={17} />
            <Text style={styles.perlesPillTxt}>{formatNb(etat.perles)}</Text>
          </View>
        </View>

        <View style={styles.contenu}>
          {/* === 🎯 Quête « Mon premier tampon » === */}
          {!etat.queteTampon.reclamee && (
            <View style={styles.queteCarte} accessibilityLabel="Quête Mon premier tampon">
              <View style={styles.serieHaut}>
                <PictoHub id="boutique" fond={C.jaunePale} taille={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.serieTitre}>Mon premier tampon</Text>
                  <Text style={styles.serieSous}>
                    {etat.queteTampon.etape < QUETE_TAMPON.length
                      ? `Étape ${etat.queteTampon.etape + 1}/${QUETE_TAMPON.length} · ${QUETE_TAMPON[etat.queteTampon.etape].label}`
                      : 'Quête terminée — ton tampon t’attend !'}
                  </Text>
                </View>
              </View>
              {etat.queteTampon.etape < QUETE_TAMPON.length ? (
                <View style={styles.queteBarre}>
                  <View style={[styles.queteBarreRempli, {
                    width: `${Math.min(100, Math.round((etat.queteTampon.progres / QUETE_TAMPON[etat.queteTampon.etape].cible) * 100))}%`,
                  }]} />
                </View>
              ) : (
                <BoutonJeu
                  titre="Réclamer mon tampon !"
                  onPress={() => { const g = reclamerQueteTampon(); if (g) hapticSucces(); }}
                />
              )}
              <Text style={styles.queteRecompense}>Récompense : 1 vrai tampon de fidélité (une seule fois)</Text>
            </View>
          )}

          {etapeDebut && (
            <View
              style={styles.depart}
              accessibilityRole="summary"
              accessibilityLabel={etapeDebut === 'jouer'
                ? 'Premier objectif, étape 1 sur 3 : jouer le niveau 1'
                : 'Premier objectif, étape 2 sur 3 : ouvrir la capsule gratuite'}
            >
              <View style={styles.departHaut}>
                <Icone nom="cible" taille={24} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.departTitre}>Ton premier objectif</Text>
                  <Text style={styles.departSous}>Découvre le jeu en trois étapes simples.</Text>
                </View>
              </View>
              <Text style={[
                styles.departEtape,
                etapeDebut === 'jouer' ? styles.departEtapeActive : styles.departEtapeFaite,
              ]}>1. Joue le niveau 1</Text>
              <Text style={[
                styles.departEtape,
                etapeDebut === 'ouvrir' && styles.departEtapeActive,
              ]}>2. Ouvre ta capsule gratuite</Text>
              <Text style={styles.departEtape}>3. Découvre ton personnage dans la collection</Text>
            </View>
          )}

          {etapeDebut === 'jouer' && tuileAventure}
          {etapeDebut === 'ouvrir' && tuilePremiereCapsule}

          {/* === Aventure (tuile principale) === */}
          {!etapeDebut && (
            <CarteAventure
              niveau={etat.aventure.niveauMax}
              etoiles={etoilesTotal}
              cta="Continuer l'aventure ›"
            />
          )}

          {/* === ⚡ Événement du week-end (double perles) === */}
          {evt.actif && (
            <View style={styles.evenement}>
              <Text style={styles.evenementTitre}>{evt.titre}</Text>
              <Text style={styles.evenementSous}>{evt.sous}</Text>
            </View>
          )}

          {/* === Aujourd'hui : bonus + série + défis === */}

          {bonus && (
            <View style={styles.bonusChip}>
              <Text style={styles.bonusChipTxt}>Bonus du jour : perles ×2 sur ta 1ʳᵉ partie</Text>
            </View>
          )}

          <TitreKawaii texte="Aujourd'hui" taille={17} />
          {/* === 🔥 Série quotidienne === */}
          <View style={styles.serieCarte} accessibilityLabel={`Série quotidienne, ${etat.serie.jours} jour${etat.serie.jours > 1 ? 's' : ''}`}>
            {serieJour?.capsuleDoree && <Confettis hauteur={130} />}
            <View style={styles.serieHaut}>
              <Svg width={26} height={26} viewBox="0 0 24 24" accessibilityElementsHidden>
                <Path d="M12 2 C13 6 16 7.5 16 12 A5.5 5.5 0 0 1 5 12 C5 9 7 7.5 8 5 C9 7 10 8 10.5 9.5 C11.5 7 11.5 4.5 12 2 Z" fill="#EC647B" />
                <Path d="M12 9 C12.6 11 14 11.8 14 14 A2.9 2.9 0 0 1 8.2 14 C8.2 12 10 11.2 10.4 9.8 C11 10.8 11.6 10.4 12 9 Z" fill={C.jaune} />
              </Svg>
              <View style={{ flex: 1 }}>
                <Text style={styles.serieTitre}>
                  {etat.serie.jours > 0 ? `Série : ${etat.serie.jours} jour${etat.serie.jours > 1 ? 's' : ''}` : 'Commence ta série !'}
                </Text>
                <Text style={styles.serieSous}>
                  {serieJour
                    ? (serieJour.capsuleDoree ? 'Capsule dorée de série offerte !' : `+${serieJour.perles} perles de retour !`)
                    : multSerie(etat.serie.jours) > 1
                      ? `Perles ×${multSerie(etat.serie.jours).toFixed(1).replace('.', ',')} tant que la série tient`
                      : 'Reviens chaque jour : bonus croissants, capsule dorée au 7ᵉ !'}
                </Text>
              </View>
            </View>
            <View style={styles.serieJours}>
              {Array.from({ length: 7 }).map((_, i) => {
                const pos = etat.serie.jours === 0 ? 0 : ((etat.serie.jours - 1) % 7) + 1;
                return <View key={i} style={[styles.serieJour, i < pos && styles.serieJourFait]} />;
              })}
            </View>
          </View>

          {/* === Défis du jour === */}
          <View style={styles.defisCarte}>
            <View style={styles.defisHaut}>
              <View style={styles.defisTitreRang}><Icone nom="eclair" taille={17} /><Text style={styles.defisTitre}>Défis du jour</Text></View>
              <Text style={styles.defisSous}>{defis.filter((d) => d.reclame).length}/3</Text>
            </View>
            {defis.map((defi) => (
              <View key={defi.id} style={styles.defi}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.defiLabel, defi.reclame && styles.defiFaitTxt]}>{defi.label}</Text>
                  <View style={styles.defiBarre}>
                    <View style={[styles.defiBarreRempli, { width: `${(defi.progres / defi.cible) * 100}%` }]} />
                  </View>
                </View>
                {defi.reclame ? (
                  <View style={styles.defiCocheBox}><Icone nom="check" taille={17} /></View>
                ) : defi.fait ? (
                  <Pressable
                    style={styles.defiReclamer}
                    onPress={() => { reclamerDefi(defi.id); hapticMoyen(); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Réclamer ${defi.perles} perles pour ${defi.label}`}
                  >
                    <IconePerle taille={13} />
                    <Text style={styles.defiReclamerTxt}>+{defi.perles}</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.defiProgres}>{formatNb(defi.progres)}/{formatNb(defi.cible)}</Text>
                )}
              </View>
            ))}
            {tousReclames && !etat.defisBonusReclame ? (
              <BoutonJeu
                titre="3/3 — Réclamer la capsule bonus"
                onPress={() => reclamerBonusDefis()}
              />
            ) : (
              <Text style={styles.defisBonusLigne}>
                {etat.defisBonusReclame ? 'Capsule bonus du jour récupérée' : 'Les 3 défis réclamés = +1 capsule'}
              </Text>
            )}
          </View>

          {/* === Rangée de tuiles candy (maquette 2c) === */}
          <View
            style={styles.rangTuiles}
            accessibilityLabel="Modes de jeu"
          >
            <TuileMode
              id="arene" label="Arène"
              accessibilityLabel={`Arène, rang ${etat.arene.rang}${versCapsuleArene <= 2 ? `, ${versCapsuleArene} victoire${versCapsuleArene > 1 ? 's' : ''} avant une capsule` : ''}`}
              onPress={() => router.push('/jeu/arene' as any)}
            />
            <TuileMode
              id="tournee" label="Tournée"
              badge={badgeTournee}
              accessibilityLabel={suiviTournee.run
                ? `Tournée des Maîtres, run en cours au duel ${suiviTournee.run.etape}${suiviTournee.run.draftEnAttente ? ', un bonus de run attend ton choix' : ''}`
                : `Tournée des Maîtres, record ${suiviTournee.record} victoires`}
              onPress={() => router.push('/jeu/tournee' as any)}
            />
            <TuileMode
              id="infini" label="Infini"
              accessibilityLabel={`Infini, record ${formatNb(etat.meilleurScore)}`}
              onPress={() => router.push('/jeu/infini' as any)}
            />
            <TuileMode
              id="capsules" label="Capsules"
              badge={capsulesGratuites > 0 ? String(capsulesGratuites) : undefined}
              accessibilityLabel={capsulesGratuites > 0 ? `Capsules, ${capsulesGratuites} gratuite${capsulesGratuites > 1 ? 's' : ''} à ouvrir` : 'Capsules'}
              onPress={() => router.push('/jeu/capsules' as any)}
            />
            <TuileMode
              id="collection" label="Collection"
              accessibilityLabel={`Collection, ${uniques} sur ${COLLECTIBLES.length}`}
              onPress={() => router.push('/jeu/collection' as any)}
            />
            {/* La tuile Roulette a déménagé : la roue est un jeu autonome (/roue),
                avec sa carte sur l'accueil — plus de doublon dans le hub Quest. */}
            <TuileMode
              id="boutique" label="Boutique"
              badge={aReclamer > 0 ? String(aReclamer) : undefined}
              accessibilityLabel={aReclamer > 0 ? `Boutique des prix, ${aReclamer} prix à réclamer` : 'Boutique des prix'}
              onPress={() => router.push('/jeu/boutique' as any)}
            />
            <TuileMode
              id="troc" label="Troc"
              badge={trocDispo ? '!' : undefined}
              accessibilityLabel={trocDispo ? 'Comptoir de Troc, une offre du jour est faisable' : 'Comptoir de Troc'}
              onPress={() => router.push('/jeu/troc' as any)}
            />
          </View>

          {/* === 🧋 La Gorgée Fraîche : la promesse, AVANT la visite ===
              Placée JUSTE APRÈS les modes de jeu, à dessein : c'est le premier bloc que
              l'on rencontre en quittant la grille des modes, donc vu sans rien pousser
              vers le bas — aucun pixel n'est ajouté au-dessus des tuiles. */}
          <CarteGorgeeFraiche visite={visite} />

          {/* === 🎫 Boba Pass (progression hebdo) === */}
          <Pressable
            style={styles.pass}
            onPress={() => router.push('/jeu/pass' as any)}
            accessibilityRole="button"
            accessibilityLabel={`Boba Pass, ${formatNb(pass.xp)} XP`}
            accessibilityHint="Ouvre les récompenses du pass hebdomadaire"
          >
            <View style={styles.passHaut}>
              <View style={styles.passTitreRang}><Icone nom="trophee" taille={17} /><Text style={styles.passTitre}>Boba Pass</Text></View>
              <View style={styles.passXpRang}>
                <Text style={styles.passXp}>{formatNb(pass.xp)} XP</Text>
                {passAReclamer > 0 && <View style={styles.passBadge}><Text style={styles.passBadgeTxt}>{passAReclamer}</Text></View>}
              </View>
            </View>
            <View style={styles.passBarre}>
              <View style={[styles.passRempli, { width: `${pctPass}%` }]} />
            </View>
            <Text style={styles.passSous}>
              {passAReclamer > 0
                ? `${passAReclamer} palier${passAReclamer > 1 ? 's' : ''} à réclamer !`
                : prochainPalier
                  ? `Encore ${formatNb(prochainPalier.xp - pass.xp)} XP avant le prochain cadeau`
                  : 'Pass complet — bravo !'}
            </Text>
          </Pressable>


          <Text style={styles.stats}>
            {formatNb(etat.partiesJouees)} partie{etat.partiesJouees > 1 ? 's' : ''} · {formatNb(etat.capsulesOuvertes)} capsule{etat.capsulesOuvertes > 1 ? 's' : ''} ouverte{etat.capsulesOuvertes > 1 ? 's' : ''}
          </Text>
          <BandeauPreview />
          <Pressable
            onPress={() => Linking.openURL('https://commande.bubblestop.fr/reglement-boba-quest')}
            hitSlop={6}
            accessibilityRole="link"
            accessibilityLabel="Lire le règlement Boba Quest"
          >
            <Text style={styles.reglement}>Règlement Boba Quest · Données personnelles</Text>
          </Pressable>
          {__DEV__ && (
            <>
              <Pressable
                onPress={() => setResetVisible(true)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Remettre la progression de test à zéro"
              >
                <Text style={styles.reset}>Tout remettre à zéro</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Alert.alert(
                    'Tester la restauration cloud ?',
                    'La copie locale Boba Quest sera effacée, puis l’app se rechargera. Ton compte et la sauvegarde cloud ne seront pas touchés.',
                    [
                      { text: 'Annuler', style: 'cancel' },
                      {
                        text: 'Lancer le test',
                        onPress: async () => {
                          try {
                            const effacee = await effacerSauvegardeLocalePourTestRestauration();
                            if (effacee) DevSettings.reload();
                          } catch {
                            Alert.alert('Test impossible', 'La copie locale n’a pas pu être effacée.');
                          }
                        },
                      },
                    ],
                  );
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Tester la restauration de la progression depuis le cloud"
              >
                <Text style={styles.reset}>Tester la restauration cloud</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      {/* === 🧋 Célébration de la Gorgée Fraîche === */}
      <Modal visible={!!gorgee} transparent animationType="fade" onRequestClose={() => setGorgee(null)}>
        {gorgee && (
          <View style={styles.modalFond}>
            <View style={styles.gorgeeCarte}>
              <Confettis hauteur={200} />
              <Text style={{ fontSize: 46 }}>🧋</Text>
              <Text style={styles.gorgeeTitre}>Merci pour ta visite !</Text>
              <Text style={styles.gorgeeSous}>
                {gorgee.boissons > 1
                  ? `${gorgee.boissons} boissons en boutique, ça se fête.`
                  : 'Ta boisson en boutique, ça se fête.'}
              </Text>
              <View style={styles.gorgeeLots}>
                {gorgee.capsulesDorees > 0 && (
                  <Text style={styles.gorgeeLot}>
                    👑 {gorgee.capsulesDorees} capsule{gorgee.capsulesDorees > 1 ? 's' : ''} DORÉE{gorgee.capsulesDorees > 1 ? 'S' : ''}
                  </Text>
                )}
                {gorgee.capsulesClassiques > 0 && (
                  <Text style={styles.gorgeeLot}>
                    🎁 {gorgee.capsulesClassiques} capsule{gorgee.capsulesClassiques > 1 ? 's' : ''} classique{gorgee.capsulesClassiques > 1 ? 's' : ''}
                  </Text>
                )}
                <Text style={styles.gorgeeLot}>🫧 +{formatNb(gorgee.perles)} perles</Text>
                {gorgee.tournees > 0 && (
                  <Text style={styles.gorgeeLot}>
                    🗺️ {gorgee.tournees} Tournée offerte{gorgee.tournees > 1 ? 's' : ''}
                  </Text>
                )}
                {/* dérivé, comme la carte de promesse : la célébration ne doit jamais
                    annoncer une durée que l'économie ne tient plus */}
                <Text style={styles.gorgeeLot}>
                  ⚡ Perles ×{GORGEE_FRAICHE.multiplicateur} pendant {GORGEE_FRAICHE.heuresX2} h
                </Text>
              </View>
              <BoutonJeu
                titre="Trop bien !"
                onPress={() => setGorgee(null)}
                style={{ alignSelf: 'stretch' }}
              />
            </View>
          </View>
        )}
      </Modal>

      {/* Modal reset preview */}
      {__DEV__ && (
        <Modal visible={resetVisible} transparent animationType="fade" onRequestClose={() => setResetVisible(false)}>
          <View style={styles.modalFond}>
            <View style={styles.modalCarte}>
              <Text style={{ fontSize: 40 }}>🧹</Text>
              <Text style={styles.modalTitre}>Tout remettre à zéro ?</Text>
              <Text style={styles.modalTexte}>
                Perles, collection, niveaux et prix gagnés : tout repart de zéro.
              </Text>
              <BoutonJeu
                titre="Oui, remise à zéro"
                onPress={() => { resetBobaQuest(); setResetVisible(false); }}
                variante="danger" style={{ alignSelf: 'stretch' }}
              />
              <Pressable
                onPress={() => setResetVisible(false)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Annuler la remise à zéro"
              >
                <Text style={styles.resetAnnuler}>Annuler</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// Carte « L'Aventure » façon carte au trésor (piste 2c) : fond violet, chemin
// pointillé, mascotte-perle sur le niveau courant, CTA candy vert.
function CarteAventure({ niveau, etoiles, cta }: { niveau: number; etoiles: number; cta: string }) {
  return (
    <Pressable
      style={styles.aventure}
      onPress={() => router.push('/jeu/parcours' as any)}
      accessibilityRole="button"
      accessibilityLabel={`Aventure, niveau ${niveau}, ${etoiles} étoiles`}
      accessibilityHint="Ouvre le parcours des niveaux"
    >
      <Svg
        pointerEvents="none"
        width="100%"
        height="100%"
        style={{ position: 'absolute', left: 0, top: 0 }}
        viewBox="0 0 360 190"
        preserveAspectRatio="none"
        accessibilityElementsHidden
      >
        {/* vague décorative du haut — rester au-dessus du sous-titre (y ≤ ~28),
            sinon son bord traverse le texte comme un faux « barré » */}
        <Path d="M0 22 Q80 10 180 18 Q280 28 360 14 L360 0 L0 0 Z" fill={C.violetProfond} opacity={0.4} />
        {/* chemin pointillé du trésor — sous le sous-titre et entièrement au-dessus
            du CTA. width/height sont explicites sur le Svg : sans eux, le web garde
            son ratio intrinsèque et étire le tracé verticalement sur les cartes larges. */}
        <Path d="M28 100 Q110 108 190 100 Q270 91 330 54" stroke="rgba(255,255,255,0.55)" strokeWidth={5} strokeLinecap="round" strokeDasharray="0.5, 14" fill="none" />
        <Circle cx={28} cy={100} r={13} fill={C.vert} stroke="#fff" strokeWidth={3} />
        <Circle cx={190} cy={100} r={13} fill={C.vert} stroke="#fff" strokeWidth={3} />
        <Circle cx={330} cy={50} r={15} fill={C.jaune} stroke="#fff" strokeWidth={3} />
      </Svg>
      {/* ⚠️ ne pas replacer cette étincelle vers top≈52 : elle passe derrière le
          sous-titre et fait un faux « barré » sur le mot Niveau */}
      <Etincelle taille={12} couleur="#CBB6E8" style={{ position: 'absolute', top: 92, left: 190 }} />
      <Etincelle taille={14} style={{ position: 'absolute', top: 88, right: 18 }} />
      <View style={styles.aventurePin}>
        <MascottePerle taille={40} />
        <View style={styles.aventurePinPill}><Text style={styles.aventurePinTxt}>Niveau {niveau}</Text></View>
      </View>
      <Text style={styles.aventureTitre}>L'Aventure</Text>
      <Text style={styles.aventureSous}>Niveau {niveau} · {etoiles} étoile{etoiles > 1 ? 's' : ''} — libère les capsules en tirs limités</Text>
      <View style={styles.aventureCta}><Text style={styles.aventureCtaTxt}>{cta}</Text></View>
    </Pressable>
  );
}

// 🧋 LA GORGÉE FRAÎCHE — la PROMESSE, affichée en permanence, AVANT toute visite.
//
// POURQUOI cette carte existe : la mécanique fonctionnait déjà, mais elle n'apparaissait
// qu'APRÈS coup, en modale surprise, doublée d'une pastille qui ne s'allume que quand le
// ×2 tourne DÉJÀ. Un joueur qui n'est jamais venu ne pouvait donc pas découvrir que venir
// paie. Une récompense que le joueur ignore ne change aucun comportement : elle se
// contente de remercier ceux qui seraient venus de toute façon — exactement la subvention
// que le projet cherche à supprimer. La carte répond à trois questions d'un coup d'œil :
// qu'est-ce que je gagne, comment, et où j'en suis.
//
// TON : un MENU, jamais un cadenas. On donne envie de passer, on ne reproche pas de ne
// pas être passé. Aucun compte à rebours anxiogène : le seul temps affiché est celui d'un
// bonus DÉJÀ acquis.
//
// ⚠️ AUCUN CHIFFRE EN DUR. Les lots viennent de `gorgeePourBoissons()` — la fonction que
// `crediterGorgee` appelle vraiment pour payer le joueur — et les valeurs qu'elle ne
// porte pas (plafond, durée, multiplicateur) de `GORGEE_FRAICHE`. Si l'économie bouge
// dans economie.ts, la promesse bouge avec elle : on ne peut pas promettre autre chose
// que ce que la caisse et le store tiendront.
function CarteGorgeeFraiche({ visite }: { visite: { actif: boolean; heures: number } }) {
  // Le lot d'UNE boisson, calculé par la fonction qui crédite réellement.
  const lot = gorgeePourBoissons(1);
  if (!lot) return null; // inatteignable (1 > 0) : garde-fou de typage, pas une règle
  // Chaque ligne est conditionnée à sa propre valeur : si une récompense passait à 0 dans
  // economie.ts, on cesserait de la promettre au lieu d'afficher « 0 capsule ».
  const lots: { picto: string; texte: string }[] = [];
  if (lot.capsulesDorees > 0) {
    lots.push({
      picto: '👑',
      texte: `${lot.capsulesDorees} capsule${lot.capsulesDorees > 1 ? 's' : ''} dorée${lot.capsulesDorees > 1 ? 's' : ''}`,
    });
  }
  // Le plafond est DIT, pas caché : une grosse commande n'ouvre pas un coffre-fort, et
  // mieux vaut l'annoncer que laisser le joueur le découvrir en se sentant floué.
  if (GORGEE_FRAICHE.capsuleParBoissonEnPlus > 0 && GORGEE_FRAICHE.maxCapsulesClassiques > 0) {
    lots.push({
      picto: '🎁',
      texte: `+${GORGEE_FRAICHE.capsuleParBoissonEnPlus} capsule${GORGEE_FRAICHE.capsuleParBoissonEnPlus > 1 ? 's' : ''} classique${GORGEE_FRAICHE.capsuleParBoissonEnPlus > 1 ? 's' : ''} par boisson en plus (jusqu’à ${GORGEE_FRAICHE.maxCapsulesClassiques})`,
    });
  }
  if (lot.perles > 0) lots.push({ picto: '🫧', texte: `+${formatNb(lot.perles)} perles` });
  if (lot.tournees > 0) {
    lots.push({
      picto: '🗺️',
      texte: `${lot.tournees} Tournée${lot.tournees > 1 ? 's' : ''} offerte${lot.tournees > 1 ? 's' : ''}`,
    });
  }
  lots.push({
    picto: '⚡',
    texte: `Perles ×${GORGEE_FRAICHE.multiplicateur} pendant ${GORGEE_FRAICHE.heuresX2} h`,
  });

  // « Où en suis-je ? » — le ×2 en cours remplace l'invitation : inutile d'inviter
  // quelqu'un qui vient de passer, on le remercie.
  const etat = visite.actif
    ? `Merci pour ta visite — perles ×${GORGEE_FRAICHE.multiplicateur} encore ${visite.heures} h`
    : 'Ta prochaine boisson en boutique, et tout ça t’attend ici.';
  // Condition RÉELLE du déclenchement : c'est la carte de fidélité présentée en caisse qui
  // fait foi, pas le fait d'entrer. Le dire évite la déception « je suis venu, j'ai rien eu ».
  const comment = 'Une boisson prise en boutique, ta carte de fidélité scannée en caisse :';

  return (
    <View
      style={styles.visiteCarte}
      accessibilityRole="summary"
      accessibilityLabel={`La Gorgée Fraîche. ${comment} ${lots.map((l) => l.texte).join('. ')}. ${etat}`}
    >
      <View style={styles.visiteHaut}>
        <PictoHub id="boutique" fond={C.rosePale} taille={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.visiteTitre}>La Gorgée Fraîche</Text>
          <Text style={styles.visiteSous}>Ta visite en boutique paie — à chaque fois.</Text>
        </View>
      </View>
      <Text style={styles.visiteComment}>{comment}</Text>
      <View style={styles.visiteLots}>
        {lots.map((l) => (
          <Text key={l.texte} style={styles.visiteLot}>{l.picto} {l.texte}</Text>
        ))}
      </View>
      <Text style={[styles.visiteEtat, visite.actif && styles.visiteEtatActif]}>
        {visite.actif ? `🧋 ${etat}` : etat}
      </Text>
    </View>
  );
}

function Tuile({ picto, fond, titre, sous, badge, bientot, onPress }: {
  picto: string; fond: string; titre: string; sous: string; badge?: string; bientot?: boolean; onPress: () => void;
  }) {
  return (
    <Pressable
      style={styles.tuile}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${titre}. ${sous}`}
      accessibilityHint="Ouvre cet écran"
    >
      {badge && <View style={styles.badge}><Text style={styles.badgeTxt}>{badge}</Text></View>}
      {bientot && <View style={styles.bientot}><Text style={styles.bientotTxt}>BIENTÔT</Text></View>}
      <PictoHub id={picto} fond={fond} />
      <Text style={styles.tuileTitre}>{titre}</Text>
      <Text style={styles.tuileSous} numberOfLines={2}>{sous}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },

  entete: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 18 },
  titre: { fontFamily: F.titre, fontSize: 24, color: C.violet, lineHeight: 26 },
  sousTitre: { fontFamily: F.t600, fontSize: 11.5, color: '#9384AC', marginTop: 2 },
  perlesPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderWidth: 2.5, borderColor: C.lavande,
    borderRadius: R.pill, paddingVertical: 6, paddingHorizontal: 12,
    borderBottomWidth: 3, borderBottomColor: '#E0D6EF',
  },
  perlesPillTxt: { fontFamily: F.t800, fontSize: 14, color: '#4C2D77' },

  bonusChip: {
    backgroundColor: C.vert, borderRadius: R.pill, alignSelf: 'flex-start',
    paddingVertical: 7, paddingHorizontal: 13,
    borderBottomWidth: 3, borderBottomColor: '#6F8F1F',
  },
  bonusChipTxt: { fontFamily: F.t700, fontSize: 12.5, color: '#2C380C' },

  contenu: { paddingHorizontal: 18, gap: 14, marginTop: 14 },

  // 🔥 Série quotidienne
  serieCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 15, gap: 10,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, overflow: 'hidden', ...OMBRE,
  },
  serieHaut: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  serieTitre: { fontFamily: F.titre, fontSize: 16, color: C.violet },
  serieSous: { fontFamily: F.t600, fontSize: 12, color: C.texte2, marginTop: 1 },
  serieJours: { flexDirection: 'row', gap: 6 },
  serieJour: { flex: 1, height: 9, borderRadius: 5, backgroundColor: C.lavande },
  serieJourFait: { backgroundColor: '#EC647B' },

  // 🎯 Quête premier tampon
  queteCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 15, gap: 10,
    borderWidth: BORD.largeur, borderColor: C.jaune, ...OMBRE,
  },
  queteBarre: { height: 9, borderRadius: 5, backgroundColor: C.lavande, overflow: 'hidden' },
  queteBarreRempli: { height: 9, borderRadius: 5, backgroundColor: C.jaune },
  queteRecompense: { fontFamily: F.t600, fontSize: 11.5, color: C.texte3, textAlign: 'center' },

  // Première visite : donne une direction claire avant les systèmes récurrents.
  depart: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 17, gap: 9,
    borderWidth: BORD.largeur, borderColor: C.vert, ...OMBRE,
  },
  departHaut: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  departTitre: { fontFamily: F.titre, fontSize: 18, color: C.violetProfond },
  departSous: { fontFamily: F.t600, fontSize: 12.5, color: C.texte2, marginTop: 1 },
  departEtape: {
    fontFamily: F.t700, fontSize: 13.5, lineHeight: 19, color: C.texte,
    backgroundColor: C.fond, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 11,
  },
  departEtapeActive: { backgroundColor: C.vertPale, color: C.violetProfond, borderWidth: 1, borderColor: C.vert },
  departEtapeFaite: { color: C.vertFonce, opacity: 0.72 },

  // Événement du week-end
  evenement: {
    backgroundColor: C.jaune, borderRadius: R.carte, padding: 16, gap: 3,
    borderWidth: BORD.largeur, borderColor: BORD.surPastel, ...OMBRE,
  },
  evenementTitre: { fontFamily: F.titre, fontSize: 17, color: C.violetProfond },
  evenementSous: { fontFamily: F.t600, fontSize: 12.5, color: C.violetProfond, opacity: 0.8, lineHeight: 17 },

  // Boba Pass
  pass: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 8,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  passHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  passTitre: { fontFamily: F.titre, fontSize: 16, color: C.violet },
  passTitreRang: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  passXp: { fontFamily: F.t800, fontSize: 14, color: C.violetClair },
  passXpRang: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  passBarre: { height: 10, borderRadius: 5, backgroundColor: C.lavande, overflow: 'hidden' },
  passRempli: { height: 10, borderRadius: 5, backgroundColor: C.vert },
  passSous: { fontFamily: F.t600, fontSize: 12.5, color: C.texte2 },
  passBadge: {
    backgroundColor: C.danger, borderRadius: R.pill, minWidth: 22, height: 22,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  passBadgeTxt: { fontFamily: F.t800, fontSize: 12, color: '#fff' },

  // Carte « L'Aventure » (carte au trésor violette)
  aventure: {
    backgroundColor: C.violet, borderRadius: 28, padding: 18, paddingTop: 16,
    gap: 4, overflow: 'hidden', minHeight: 190, ...OMBRE_VIOLETTE,
  },
  aventureTitre: { fontFamily: F.titre, fontSize: 22, color: '#fff' },
  aventureSous: { fontFamily: F.t600, fontSize: 12.5, color: C.surViolet, lineHeight: 17, maxWidth: '58%' },
  aventurePin: { position: 'absolute', top: 46, right: 84, alignItems: 'center', gap: 3, zIndex: 2 },
  aventurePinPill: {
    backgroundColor: '#fff', borderRadius: R.pill, paddingVertical: 3, paddingHorizontal: 9,
  },
  aventurePinTxt: { fontFamily: F.titre, fontSize: 11.5, color: C.violet },
  aventureCta: {
    marginTop: 'auto', backgroundColor: C.vert, borderRadius: R.btn,
    borderBottomWidth: 5, borderBottomColor: '#6F8F1F',
    paddingVertical: 13, alignItems: 'center',
  },
  aventureCtaTxt: { fontFamily: F.titre, fontSize: 17, color: '#2C380C' },

  tuileCapsuleDebut: {
    backgroundColor: C.rosePale, borderRadius: R.carte, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: BORD.largeur, borderColor: BORD.surPastel, ...OMBRE,
  },
  tuileJouerTitre: { fontFamily: F.titre, fontSize: 20, color: C.violet },
  tuileJouerSous: { fontFamily: F.t600, fontSize: 12.5, color: C.texte2, marginTop: 2, lineHeight: 17 },
  tuileJouerGo: {
    fontFamily: F.t800, fontSize: 13, color: '#fff', backgroundColor: C.violet,
    borderRadius: R.pill, paddingVertical: 9, paddingHorizontal: 14, overflow: 'hidden',
  },

  // Défis du jour
  defisCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 12,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  defisHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  defisTitre: { fontFamily: F.titre, fontSize: 16, color: C.violet },
  defisTitreRang: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  defisSous: { fontFamily: F.t800, fontSize: 13, color: C.vertFonce },
  defi: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  defiLabel: { fontFamily: F.t700, fontSize: 12.5, color: C.texte, marginBottom: 5 },
  defiFaitTxt: { color: C.texte3 },
  defiBarre: { height: 7, borderRadius: 4, backgroundColor: C.lavande, overflow: 'hidden' },
  defiBarreRempli: { height: 7, borderRadius: 4, backgroundColor: C.vert },
  defiProgres: { fontFamily: F.t700, fontSize: 11, color: C.texte3, minWidth: 34, textAlign: 'right' },
  defiCoche: { fontFamily: F.t800, fontSize: 17, color: C.vertFonce, minWidth: 48, textAlign: 'right' },
  defiCocheBox: { minWidth: 48, alignItems: 'flex-end' },
  defiReclamer: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.vert, borderRadius: R.pill, paddingVertical: 6, paddingHorizontal: 11,
    borderBottomWidth: 3, borderBottomColor: '#6F8F1F',
  },
  defiReclamerTxt: { fontFamily: F.t800, fontSize: 11.5, color: '#2C380C' },
  defisBonusLigne: { fontFamily: F.t600, fontSize: 12, color: C.texte2, textAlign: 'center' },

  rangTuiles: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    columnGap: 8, rowGap: 12, paddingVertical: 6,
  },
  tuile: {
    width: '48%', flexGrow: 1, backgroundColor: C.carte, borderRadius: R.carte,
    padding: 14, gap: 8,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  tuileTitre: { fontFamily: F.titre, fontSize: 15, color: C.violet },
  tuileSous: { fontFamily: F.t600, fontSize: 12, color: C.texte2, lineHeight: 16 },
  badge: {
    position: 'absolute', top: 10, right: 10, zIndex: 2,
    backgroundColor: C.danger, borderRadius: R.pill, minWidth: 22, height: 22,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  badgeTxt: { fontFamily: F.t800, fontSize: 12, color: '#fff' },
  bientot: {
    position: 'absolute', top: 10, right: 10, zIndex: 2,
    backgroundColor: C.jaunePale, borderRadius: R.pill, paddingVertical: 3, paddingHorizontal: 8,
    borderWidth: 1, borderColor: C.jaune,
  },
  bientotTxt: { fontFamily: F.t800, fontSize: 9.5, color: '#9A6B00' },

  stats: { fontFamily: F.t600, fontSize: 12, color: C.texte3, textAlign: 'center' },
  reglement: {
    fontFamily: F.t600, fontSize: 11.5, color: C.texte3, textAlign: 'center',
    textDecorationLine: 'underline', paddingVertical: 5,
  },
  reset: { fontFamily: F.t600, fontSize: 12, color: C.texte3, textAlign: 'center', textDecorationLine: 'underline', padding: 4 },
  resetAnnuler: { fontFamily: F.t700, fontSize: 14, color: C.texte2, padding: 6 },

  modalFond: {
    flex: 1, backgroundColor: 'rgba(42,29,70,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  modalCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 24,
    alignItems: 'center', gap: 12, alignSelf: 'stretch',
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  modalTitre: { fontFamily: F.titre, fontSize: 18, color: C.violet, textAlign: 'center' },

  // 🧋 Gorgée Fraîche — carte de promesse permanente. Bordure rose : même identité que
  // la modale de célébration, pour que la promesse et le cadeau se ressemblent.
  visiteCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 15, gap: 10,
    borderWidth: BORD.largeur, borderColor: C.rose, ...OMBRE,
  },
  visiteHaut: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  visiteTitre: { fontFamily: F.titre, fontSize: 16, color: C.violet },
  visiteSous: { fontFamily: F.t600, fontSize: 12, color: C.texte2, marginTop: 1 },
  visiteComment: { fontFamily: F.t600, fontSize: 12.5, color: C.texte, lineHeight: 17 },
  visiteLots: { gap: 6 },
  visiteLot: {
    fontFamily: F.t700, fontSize: 12.5, color: C.violetProfond,
    backgroundColor: C.fond, borderRadius: 11, paddingVertical: 8, paddingHorizontal: 12,
  },
  visiteEtat: { fontFamily: F.t600, fontSize: 12, color: C.texte2, textAlign: 'center' },
  visiteEtatActif: {
    fontFamily: F.t700, color: C.roseFonce, alignSelf: 'center', overflow: 'hidden',
    backgroundColor: C.rosePale, borderRadius: R.pill, paddingVertical: 7, paddingHorizontal: 13,
    borderWidth: 1.5, borderColor: C.rose,
  },
  gorgeeCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 24,
    alignItems: 'center', gap: 10, alignSelf: 'stretch', overflow: 'hidden',
    borderWidth: BORD.largeur, borderColor: C.rose, ...OMBRE,
  },
  gorgeeTitre: { fontFamily: F.titre, fontSize: 22, color: C.violet, textAlign: 'center' },
  gorgeeSous: { fontFamily: F.t600, fontSize: 13.5, color: C.texte2, textAlign: 'center', lineHeight: 19 },
  gorgeeLots: { alignSelf: 'stretch', gap: 7, marginVertical: 6 },
  gorgeeLot: {
    fontFamily: F.t700, fontSize: 14, color: C.violetProfond,
    backgroundColor: C.fond, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 13,
  },
  modalTexte: { fontFamily: F.t400, fontSize: 14, color: C.texte2, textAlign: 'center', lineHeight: 20 },
});
