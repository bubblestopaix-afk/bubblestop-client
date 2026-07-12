// === Boba Quest — L'ARÈNE (hub de combat) ===
// Compose ton équipe de 3 collectibles, affronte les Maîtres de l'Arène
// (échelle de rangs, récompenses), et défie un ami : duel amical ou AVEC MISE
// de doublons — le vainqueur emporte les billes de l'autre 😏.
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { C, F, R, OMBRE } from '@/constants/charte';
import { adversairePNJ, equipeSam, MISES_DUEL_PAR_JOUR, recompenseRang } from '@/components/jeu/arene';
import PastilleCollectible from '@/components/jeu/collectibles';
import { Icone, IconeEmoji, IconeType } from '@/components/jeu/icones';
import {
  agregerEffets, CAPSULE_OBJET, cleJour, COLLECTIBLES, ECLATS_FORGE, EffetObjet,
  Emplacement, EMPLACEMENTS, OBJET_IDS, OBJETS, ObjetId, panopliesActives, PANOPLIES,
  PITY_OBJET_EPIQUE, objetsDeSlot, RARETES, TOURNOI_ETAPES, trouverCollectible,
  TIERS, recompenseSaison, mutateurDuJour, bossDeLaSemaine, BOSS_RECOMPENSE, cleSemaine,
  passifDe, coutCarte, coutEquipe, BUDGET_EQUIPE, multOutsider, equipeAutoSousBudget,
  CONSOMMABLES, CONSOMMABLE_IDS,
} from '@/components/jeu/economie';
import { BandeauPreview, BoutonJeu, EnTeteJeu, formatNb, IconePerle } from '@/components/jeu/ui-jeu';
import {
  acheterConsommable, acheterObjet, bossBattuCetteSemaine, classementActuel, definirEquipe,
  enregistrerMiseDuel, equiperObjet, etatTournoi, forgerObjet, idsDoublons, idsPossedes,
  misesRestantesAujourdhui, objetsDe, ouvrirCapsuleObjet, reclamerRecompenseSaison, useBobaQuest,
  defisEnAttente,
} from '@/store/jeu';

const ORDRE_RARETE = { legendaire: 0, epique: 1, rare: 2, commun: 3 } as const;
const SLOTS: Emplacement[] = ['paille', 'couvercle', 'breloque'];

// Résumé texte de l'effet agrégé (pour l'aperçu d'équipement)
function resumeEffet(e: EffetObjet): string {
  const p: string[] = [];
  if (e.atkPct) p.push(`+${e.atkPct}% ATQ`);
  if (e.pvPct) p.push(`+${e.pvPct}% PV`);
  if (e.vit) p.push(`+${e.vit} VIT`);
  if (e.critPct) p.push(`+${e.critPct}% crit`);
  if (e.precisionPct) p.push(`+${e.precisionPct}% précision`);
  if (e.soinTour) p.push(`+${e.soinTour} PV/tour`);
  if (e.volDeViePct) p.push(`vol de vie ${e.volDeViePct}%`);
  if (e.bouclierDepart) p.push('bouclier de départ');
  if (e.perceBouclier) p.push('perce-bouclier');
  if (e.reducZonePct) p.push(`−${e.reducZonePct}% dégâts de zone`);
  if (e.immuniteEtourdi) p.push('anti-étourdissement');
  if (e.reviveUneFois) p.push('survie à 1 PV');
  if (e.agitPremier) p.push('agit en premier');
  if (e.epinesPct) p.push(`épines ${e.epinesPct}%`);
  return p.join(' · ');
}

// Aperçu texte d'une récompense de fin de saison (par tier)
function apercuRecompense(tierId: number): string {
  const r = recompenseSaison(tierId);
  const p = [`+${r.perles} perles`];
  if (r.capsules) p.push(`${r.capsules} capsule${r.capsules > 1 ? 's' : ''} 🎁`);
  if (r.eclats) p.push(`${r.eclats} 🔹 éclats`);
  if (r.titre) p.push(`titre « ${r.titre} »`);
  return p.join('  ·  ');
}
function apercuGain(r: { perles: number; capsules: number; eclats: number; titre: string | null }): string {
  const p = [`+${r.perles} perles`];
  if (r.capsules) p.push(`${r.capsules} capsule${r.capsules > 1 ? 's' : ''}`);
  if (r.eclats) p.push(`${r.eclats} éclats`);
  if (r.titre) p.push(`titre « ${r.titre} »`);
  return p.join(' · ');
}

export default function AreneScreen() {
  const insets = useSafeAreaInsets();
  const etat = useBobaQuest();
  const possedes = idsPossedes(etat);
  const doublons = idsDoublons(etat);
  const misesRestantes = misesRestantesAujourdhui(etat);

  const [choixVisible, setChoixVisible] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [miseVisible, setMiseVisible] = useState(false);
  const [maMise, setMaMise] = useState<string | null>(null);
  const [samMise, setSamMise] = useState<string | null>(null);
  const [objetPour, setObjetPour] = useState<string | null>(null); // membre en cours d'équipement
  const [atelierVisible, setAtelierVisible] = useState(false);
  const [atelierTab, setAtelierTab] = useState<'boutique' | 'capsule' | 'forge' | 'conso'>('boutique');
  const [revele, setRevele] = useState<{ objet: ObjetId; doublon: boolean; eclats: number } | null>(null);
  const [ligueVisible, setLigueVisible] = useState(false);
  const [gainSaison, setGainSaison] = useState<string | null>(null); // confirmation de réclamation
  const tournoi = etatTournoi(etat);
  const cl = classementActuel(etat);
  const mutateur = mutateurDuJour(cleJour());
  const boss = bossDeLaSemaine(cleSemaine());
  const bossBattu = bossBattuCetteSemaine(etat);
  const nbDefis = defisEnAttente(etat).length;

  // équipe auto-réparée : 3 possédés qui tiennent SOUS le budget de rareté
  useEffect(() => {
    const valide = etat.arene.equipe.length === 3
      && etat.arene.equipe.every((id) => possedes.includes(id))
      && coutEquipe(etat.arene.equipe) <= BUDGET_EQUIPE;
    if (!valide && possedes.length >= 3) definirEquipe(equipeAutoSousBudget(possedes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [possedes.length]);

  const adversaire = useMemo(() => adversairePNJ(etat.arene.rang), [etat.arene.rang]);
  const recompense = recompenseRang(etat.arene.rang);
  const sam = useMemo(() => equipeSam(cleJour()), []);

  const ouvrirMise = () => {
    // Sam mise en priorité un collectible que tu N'AS PAS (c'est ça, le sel du duel)
    const manquants = COLLECTIBLES.filter((c) => !(etat.collection[c.id] > 0));
    const cible = manquants.length
      ? manquants[Math.floor(Math.random() * manquants.length)]
      : COLLECTIBLES[Math.floor(Math.random() * COLLECTIBLES.length)];
    setSamMise(cible.id);
    setMaMise(doublons[0] ?? null);
    setMiseVisible(true);
  };

  const lancerDuelMise = () => {
    if (!maMise || !samMise) return;
    enregistrerMiseDuel();
    setMiseVisible(false);
    router.push(`/jeu/duel?mode=ami&mise=${maMise}&gain=${samMise}` as any);
  };

  // — pas encore 3 collectibles : l'Arène est verrouillée —
  if (possedes.length < 3) {
    return (
      <View style={[styles.fond, { paddingTop: insets.top + 10 }]}>
        <View style={{ paddingHorizontal: 18 }}>
          <EnTeteJeu titre="L'Arène" onRetour={() => router.back()} perles={etat.perles} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
          <View style={styles.verrou}>
            <Icone nom="epee" taille={46} />
            <Text style={styles.verrouTitre}>Il te faut 3 combattants !</Text>
            <Text style={styles.verrouTexte}>
              Chaque collectible de ton album sait se battre. Trouve-en au moins 3
              dans les capsules (via l'Aventure) pour entrer dans l'Arène.
            </Text>
            <BoutonJeu titre="Partir à l'Aventure" onPress={() => router.replace('/jeu/parcours' as any)} style={{ alignSelf: 'stretch', backgroundColor: C.vert }} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.fond, { paddingTop: insets.top + 10 }]}>
      <View style={{ paddingHorizontal: 18 }}>
        <EnTeteJeu titre="L'Arène" onRetour={() => router.back()} perles={etat.perles} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu}>
        {/* === 🏆 Classement (ligue + saison) === */}
        <Pressable style={[styles.rangCarte, { borderColor: cl.tier.couleur }]} onPress={() => setLigueVisible(true)}>
          <View style={styles.rangHaut}>
            <IconeEmoji emoji={cl.tier.emoji} taille={38} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rangNom, { color: cl.tier.couleur }]}>{cl.tier.nom}</Text>
              <Text style={styles.rangSaison}>Saison {cl.saison} · finit dans {cl.joursRestants} j</Text>
            </View>
            <View style={styles.rangPcBoite}>
              <Text style={styles.rangPc}>{cl.pc}</Text>
              <Text style={styles.rangPcLib}>PC</Text>
            </View>
          </View>
          <View style={styles.rangBarreFond}>
            <View style={[styles.rangBarrePlein, { width: `${Math.round(cl.progression * 100)}%`, backgroundColor: cl.tier.couleur }]} />
          </View>
          <Text style={styles.rangSous}>
            {cl.suivant ? `Plus que ${cl.suivant.seuil - cl.pc} PC → ${cl.suivant.emoji} ${cl.suivant.nom}` : '👑 Tier maximal atteint !'}
            {'   ·   Voir la ligue ›'}
          </Text>
          {cl.recompenseEnAttente && (
            <View style={styles.rangRecompenseBadge}>
              <Text style={styles.rangRecompenseTxt}>🎁 Récompense de saison à réclamer !</Text>
            </View>
          )}
        </Pressable>

        {/* === Mutateur du jour === */}
        <View style={styles.mutBanniere}>
          <View style={styles.mutTitreRang}>
            <Icone nom="eclair" taille={16} />
            <Text style={styles.mutTitre}>Règle du jour :</Text>
            <IconeEmoji emoji={mutateur.emoji} taille={18} />
            <Text style={styles.mutTitre}>{mutateur.nom}</Text>
          </View>
          <Text style={styles.mutDesc}>{mutateur.desc} — s'applique à TOUS les combats aujourd'hui.</Text>
        </View>

        {/* === Mon équipe === */}
        <View style={styles.carte}>
          <View style={styles.carteHaut}>
            <Text style={styles.carteTitre}>Mon équipe</Text>
            <Text style={styles.stats}>{etat.arene.victoires} V · {etat.arene.defaites} D</Text>
          </View>
          <View style={styles.equipeRang}>
            {etat.arene.equipe.map((id) => (
              <Pressable key={id} style={styles.slot} onPress={() => { setSelection(etat.arene.equipe); setChoixVisible(true); }}>
                <PastilleCollectible id={id} taille={72} />
                <Text style={styles.slotNom} numberOfLines={1}>{trouverCollectible(id)?.nom}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.aide}>Touche une carte pour changer d'équipe</Text>
          <View style={styles.typeCarte}>
            <View style={styles.typeLegende}>
              <View style={styles.typeChip}><IconeType set="fruit" taille={26} /><Text style={styles.typeNom}>Fruité</Text></View>
              <Text style={styles.typeBat}>bat</Text>
              <View style={styles.typeChip}><IconeType set="milk" taille={26} /><Text style={styles.typeNom}>Milk</Text></View>
              <Text style={styles.typeBat}>bat</Text>
              <View style={styles.typeChip}><IconeType set="topping" taille={26} /><Text style={styles.typeNom}>Topping</Text></View>
            </View>
            <View style={styles.typeSign}>
              <IconeType set="signature" taille={20} />
              <Text style={styles.typeSignTxt}>Le cycle boucle (Topping rebat Fruité) · Signature : neutre</Text>
            </View>
          </View>
        </View>

        {/* === Le Maître du rang === */}
        <View style={[styles.carte, styles.cartePnj]}>
          <View style={styles.carteHaut}>
            <View style={styles.titreIcone}><Icone nom="epee" taille={18} /><Text style={styles.carteTitre}>{adversaire.nom}</Text></View>
            <View style={styles.puissance}><Text style={styles.puissanceTxt}>×{adversaire.echelle.toFixed(2)}</Text></View>
          </View>
          <View style={styles.equipeRang}>
            {adversaire.ids.map((id) => (
              <View key={id} style={styles.slot}>
                <PastilleCollectible id={id} taille={64} />
                <Text style={styles.slotNom} numberOfLines={1}>{trouverCollectible(id)?.nom}</Text>
              </View>
            ))}
          </View>
          <View style={styles.recompenseRang}>
            <Icone nom="trophee" taille={16} />
            <Text style={styles.recompense}>
              {formatNb(recompense.perles)} perles
              {recompense.capsule ? ` + capsule ${recompense.capsule === 'doree' ? 'DORÉE' : 'classique'}` : ''}
            </Text>
            {recompense.capsule ? <IconeEmoji emoji={recompense.capsule === 'doree' ? '👑' : '🎁'} taille={16} /> : null}
          </View>
          <BoutonJeu
            titre={`Combattre — Rang ${etat.arene.rang} !`}
            onPress={() => router.push(`/jeu/duel?mode=pnj&rang=${etat.arene.rang}` as any)}
            style={{ backgroundColor: C.vert }}
          />
        </View>

        {/* === 🏆 Tournoi de la semaine === */}
        <Pressable style={[styles.carte, styles.carteTournoi]} onPress={() => router.push('/jeu/tournoi' as any)}>
          <View style={styles.carteHaut}>
            <View style={styles.titreIcone}><Icone nom="trophee" taille={18} /><Text style={styles.carteTitre}>Tournoi de la semaine</Text></View>
            {tournoi.trophees > 0 && (
              <View style={styles.tropheesMiniRang}><Icone nom="couronne" taille={14} /><Text style={styles.tropheesMini}>×{tournoi.trophees}</Text></View>
            )}
          </View>
          <Text style={styles.tournoiEtat}>
            {tournoi.etape >= 3
              ? '👑 CHAMPION cette semaine — reviens lundi défendre ton titre !'
              : tournoi.elimine
                ? 'Éliminé cette semaine… nouveau tournoi lundi 🍀'
                : `Prochaine étape : ${TOURNOI_ETAPES[tournoi.etape]} — une seule tentative par semaine !`}
          </Text>
          <Text style={styles.tournoiOuvrir}>Ouvrir le tournoi ›</Text>
        </Pressable>

        {/* === 👹 Boss de la semaine === */}
        <View style={[styles.bossCarte, bossBattu && { opacity: 0.75 }]}>
          <View style={styles.bossHaut}>
            <PastilleCollectible id={boss.combattantId} taille={54} />
            <View style={{ flex: 1 }}>
              <View style={styles.titreIcone}><IconeEmoji emoji={boss.emoji} taille={22} /><Text style={styles.bossNom}>{boss.nom}</Text></View>
              <Text style={styles.bossGimmick}>{boss.gimmickDesc}</Text>
            </View>
          </View>
          <Text style={styles.bossIndice}>{boss.indice} Il change de phase à 70 % puis 35 % de PV.</Text>
          <View style={styles.bossRecompRang}>
            <Icone nom="trophee" taille={14} />
            <Text style={styles.bossRecomp}>{formatNb(BOSS_RECOMPENSE.perles)} perles · {BOSS_RECOMPENSE.capsules} capsule ·</Text>
            <Icone nom="eclat" taille={13} />
            <Text style={styles.bossRecomp}>{BOSS_RECOMPENSE.eclats} éclats</Text>
          </View>
          {bossBattu ? (
            <View style={styles.bossBattuBadge}><Icone nom="check" taille={16} /><Text style={styles.bossBattuTxt}>Vaincu cette semaine — reviens lundi !</Text></View>
          ) : (
            <BoutonJeu titre="Combattre le boss" onPress={() => router.push('/jeu/duel?mode=boss' as any)} style={{ alignSelf: 'stretch', backgroundColor: '#C0455A' }} />
          )}
        </View>

        {/* === 🎒 Équipement (3 emplacements par combattant) === */}
        <View style={styles.carte}>
          <View style={styles.equipEnTete}>
            <View style={styles.titreIcone}><Icone nom="sac" taille={18} /><Text style={styles.carteTitre}>Équipement</Text></View>
            <View style={styles.eclatsPill}><Icone nom="eclat" taille={13} /><Text style={styles.eclatsTxt}>{formatNb(etat.eclats)}</Text></View>
          </View>
          {etat.arene.equipe.map((id) => {
            const slots = etat.portes[id] || {};
            const panos = panopliesActives(objetsDe(id, etat));
            return (
              <Pressable key={id} style={styles.equipLigne} onPress={() => setObjetPour(id)}>
                <PastilleCollectible id={id} taille={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.objetNomPerso}>{trouverCollectible(id)?.nom}</Text>
                  <View style={styles.slotChips}>
                    {SLOTS.map((slot) => {
                      const oid = slots[slot];
                      const def = oid && etat.objets[oid] ? OBJETS[oid] : null;
                      return (
                        <View
                          key={slot}
                          style={[styles.slotChip, def && { borderColor: RARETES[def.rarete].couleur, backgroundColor: '#fff' }]}
                        >
                          {def
                            ? <IconeEmoji emoji={def.emoji} taille={19} />
                            : <View style={{ opacity: 0.32 }}><IconeEmoji emoji={EMPLACEMENTS[slot].emoji} taille={19} /></View>}
                        </View>
                      );
                    })}
                    {panos.map((p) => (
                      <View key={p.id} style={styles.panoTagRang}>
                        <IconeEmoji emoji={PANOPLIES[p.id].emoji} taille={14} />
                        <Text style={[styles.panoTag, { color: PANOPLIES[p.id].couleur }]}>{p.pieces}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <Text style={styles.objetChanger}>Équiper ›</Text>
              </Pressable>
            );
          })}
          <BoutonJeu titre="Atelier d'objets" onPress={() => { setAtelierVisible(true); setRevele(null); }} style={{ backgroundColor: C.violetClair, marginTop: 6 }} />
          <Text style={styles.aide}>3 emplacements par combattant. Réunis une panoplie (Givré · Sucré · Orage · Royale) pour un bonus de set.</Text>
        </View>

        {/* === Défis d'amis (async) === */}
        <Pressable style={[styles.carte, styles.defisCarte]} onPress={() => router.push('/jeu/defis' as any)}>
          <View style={styles.defisHaut}>
            <View style={styles.titreIcone}><Icone nom="epee" taille={18} /><Text style={styles.carteTitre}>Défis d'amis</Text></View>
            {nbDefis > 0 && <View style={styles.defisBadge}><Text style={styles.defisBadgeTxt}>{nbDefis}</Text></View>}
          </View>
          <Text style={styles.aide}>
            {nbDefis > 0
              ? `${nbDefis} ami${nbDefis > 1 ? 's t\'ont' : ' t\'a'} défié — relève leurs équipes quand tu veux, sans notif.`
              : 'Tous les défis du jour sont relevés — reviens demain !'}
          </Text>
          <Text style={styles.defisOuvrir}>Ouvrir les défis ›</Text>
        </Pressable>

        {/* === Défier un ami === */}
        <View style={styles.carte}>
          <View style={styles.titreIcone}><Icone nom="epee" taille={18} /><Text style={styles.carteTitre}>Duel rapide</Text></View>
          <Text style={styles.aide}>
            Sam (simulé) a composé son équipe du jour. En duel MISÉ, chacun met un
            doublon en jeu : le vainqueur emporte les deux billes !
          </Text>
          <View style={styles.equipeRang}>
            {sam.map((id) => (
              <View key={id} style={styles.slot}>
                <PastilleCollectible id={id} taille={56} />
              </View>
            ))}
          </View>
          <BoutonJeu titre="Duel amical (sans enjeu)" onPress={() => router.push('/jeu/duel?mode=ami&amical=1' as any)} />
          <BoutonJeu
            titre={
              doublons.length === 0
                ? 'Duel avec mise — aucun doublon à miser'
                : misesRestantes === 0
                  ? 'Duel avec mise — reviens demain !'
                  : `Duel avec mise (${misesRestantes}/${MISES_DUEL_PAR_JOUR} aujourd'hui)`
            }
            disabled={doublons.length === 0 || misesRestantes === 0}
            onPress={ouvrirMise}
            style={{ backgroundColor: '#D2588A' }}
          />
        </View>

        <Text style={styles.note}>
          En version finale : duels asynchrones entre vrais comptes (défi envoyé par
          QR ou notification, l'équipe de ton ami se bat même s'il n'est pas là).
        </Text>
        <BandeauPreview />
      </ScrollView>

      {/* === Choix d'équipe === */}
      <Modal visible={choixVisible} transparent animationType="fade" onRequestClose={() => setChoixVisible(false)}>
        <View style={styles.modalFond}>
          <View style={[styles.modalCarte, { maxHeight: '86%' }]}>
            <Text style={styles.modalTitre}>Mon équipe ({selection.length}/3)</Text>
            {(() => {
              const coutSel = coutEquipe(selection);
              const mult = multOutsider(coutSel);
              return (
                <View style={styles.budgetBoite}>
                  <View style={styles.budgetLigne}>
                    <Text style={styles.budgetTxt}>Budget rareté : {coutSel}/{BUDGET_EQUIPE}</Text>
                    {mult > 1 && <Text style={styles.budgetBonus}>Bonus outsider +{Math.round((mult - 1) * 100)} %</Text>}
                  </View>
                  <View style={styles.budgetBarreFond}>
                    <View style={[styles.budgetBarrePlein, { width: `${Math.min(100, (coutSel / BUDGET_EQUIPE) * 100)}%` }]} />
                  </View>
                  <Text style={styles.budgetAide}>Commune 1 · Rare 2 · Épique 3 · Légendaire 4. Chaque point sous le budget booste ton équipe (PV/ATQ).</Text>
                </View>
              );
            })()}
            <ScrollView contentContainerStyle={styles.grilleChoix}>
              {possedes.map((id) => {
                const choisi = selection.includes(id);
                const c = trouverCollectible(id)!;
                const trop = !choisi && (selection.length >= 3 || coutEquipe([...selection, id]) > BUDGET_EQUIPE);
                const pas = passifDe(id);
                return (
                  <Pressable
                    key={id}
                    style={[styles.choix, choisi && styles.choixActif, trop && { opacity: 0.38 }]}
                    disabled={trop}
                    onPress={() => {
                      if (choisi) setSelection(selection.filter((x) => x !== id));
                      else if (!trop) setSelection([...selection, id]);
                    }}
                  >
                    <PastilleCollectible id={id} taille={56} />
                    <Text style={styles.slotNom} numberOfLines={1}>{c.nom}</Text>
                    <Text style={[styles.choixRarete, { color: RARETES[c.rarete].couleur }]}>{RARETES[c.rarete].nom} · {coutCarte(id)}pt</Text>
                    {pas && (
                      <View style={styles.choixPassifRang}>
                        <Icone nom="etoile" taille={11} />
                        <Text style={styles.choixPassif} numberOfLines={1}>{pas.nom}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
            <BoutonJeu
              titre="Valider l'équipe"
              disabled={selection.length !== 3}
              onPress={() => { definirEquipe(selection); setChoixVisible(false); }}
              style={{ alignSelf: 'stretch', backgroundColor: C.vert }}
            />
            <Pressable onPress={() => setChoixVisible(false)} hitSlop={6}>
              <Text style={styles.annuler}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* === Équipement d'un membre (3 emplacements) === */}
      <Modal visible={!!objetPour} transparent animationType="fade" onRequestClose={() => setObjetPour(null)}>
        {objetPour && (() => {
          const actifs = objetsDe(objetPour, etat);
          const eff = agregerEffets(actifs);
          const panos = panopliesActives(actifs);
          const slots = etat.portes[objetPour] || {};
          return (
            <View style={styles.modalFond}>
              <View style={[styles.modalCarte, { maxHeight: '88%' }]}>
                <Text style={styles.modalTitre}>Équiper {trouverCollectible(objetPour)?.nom}</Text>
                <ScrollView contentContainerStyle={{ gap: 14 }}>
                  {SLOTS.map((slot) => {
                    const possede = objetsDeSlot(slot).filter((o) => etat.objets[o]);
                    const equipe = slots[slot];
                    return (
                      <View key={slot} style={styles.slotBloc}>
                        <View style={styles.slotTitreRang}>
                          <IconeEmoji emoji={EMPLACEMENTS[slot].emoji} taille={17} />
                          <Text style={styles.slotTitre}>{EMPLACEMENTS[slot].nom} · {EMPLACEMENTS[slot].role}</Text>
                        </View>
                        <View style={styles.slotChoixRang}>
                          <Pressable style={[styles.miniChoix, !equipe && styles.miniChoixActif]} onPress={() => equiperObjet(objetPour!, slot, null)}>
                            <Icone nom="interdit" taille={22} />
                          </Pressable>
                          {possede.length === 0 && <Text style={styles.slotVide}>Aucun objet — va à l'Atelier</Text>}
                          {possede.map((o) => (
                            <Pressable
                              key={o}
                              style={[styles.miniChoix, { borderColor: RARETES[OBJETS[o].rarete].couleur }, equipe === o && styles.miniChoixActif]}
                              onPress={() => equiperObjet(objetPour!, slot, o)}
                            >
                              <IconeEmoji emoji={OBJETS[o].emoji} taille={22} />
                            </Pressable>
                          ))}
                        </View>
                        {equipe && <Text style={styles.slotDetail}>{OBJETS[equipe].nom} — {OBJETS[equipe].detail}</Text>}
                      </View>
                    );
                  })}
                  {passifDe(objetPour) && (
                    <View style={styles.passifBoite}>
                      <View style={styles.titreIcone}><Icone nom="etoile" taille={14} /><Text style={styles.passifTitre}>Atout : {passifDe(objetPour)!.nom}</Text></View>
                      <Text style={styles.passifDesc}>{passifDe(objetPour)!.desc}</Text>
                    </View>
                  )}
                  <View style={styles.effResume}>
                    <Text style={styles.effTitre}>Bonus actifs (objets + panoplies)</Text>
                    <Text style={styles.effTxt}>{resumeEffet(eff) || 'Aucun objet équipé'}</Text>
                    {panos.map((p) => {
                      const pano = PANOPLIES[p.id];
                      const palier = [...pano.paliers].reverse().find((x) => p.pieces >= x.seuil);
                      return (
                        <View key={p.id} style={styles.panoLigneRang}>
                          <IconeEmoji emoji={pano.emoji} taille={14} />
                          <Text style={[styles.panoLigne, { color: pano.couleur }]}>
                            Panoplie {pano.nom} ({p.pieces}/3){palier ? ` — ${palier.detail}` : ''}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
                <BoutonJeu titre="Terminé" onPress={() => setObjetPour(null)} style={{ alignSelf: 'stretch' }} />
              </View>
            </View>
          );
        })()}
      </Modal>

      {/* === Atelier d'objets : boutique perles / Capsule Objet / forge d'éclats === */}
      <Modal visible={atelierVisible} transparent animationType="fade" onRequestClose={() => setAtelierVisible(false)}>
        <View style={styles.modalFond}>
          <View style={[styles.modalCarte, { maxHeight: '90%' }]}>
            <View style={styles.atelierEnTete}>
              <View style={styles.modalTitreRang}><Icone nom="marteau" taille={20} /><Text style={styles.modalTitre}>Atelier d'objets</Text></View>
              <View style={styles.soldeRang}>
                <View style={styles.soldePill}><IconePerle taille={12} /><Text style={styles.soldeTxt}>{formatNb(etat.perles)}</Text></View>
                <View style={styles.soldePill}><Icone nom="eclat" taille={12} /><Text style={styles.soldeTxt}>{formatNb(etat.eclats)}</Text></View>
              </View>
            </View>
            <View style={styles.tabsRang}>
              {(['boutique', 'capsule', 'forge', 'conso'] as const).map((t) => (
                <Pressable key={t} style={[styles.tab, atelierTab === t && styles.tabActif]} onPress={() => setAtelierTab(t)}>
                  <Text style={[styles.tabTxt, atelierTab === t && styles.tabTxtActif]}>
                    {t === 'boutique' ? 'Objets' : t === 'capsule' ? 'Capsule' : t === 'forge' ? 'Forge' : 'Sac'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <ScrollView contentContainerStyle={{ gap: 9, paddingVertical: 6 }}>
              {atelierTab === 'boutique' && OBJET_IDS.filter((o) => OBJETS[o].source === 'perles').map((o) => {
                const def = OBJETS[o];
                const owned = !!etat.objets[o];
                const cher = def.cout == null || etat.perles < def.cout;
                return (
                  <View key={o} style={styles.boutiqueLigne}>
                    <View style={[styles.objBadge, { borderColor: RARETES[def.rarete].couleur }]}><IconeEmoji emoji={def.emoji} taille={24} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.objNom}>{def.nom} <Text style={{ color: RARETES[def.rarete].couleur, fontSize: 10 }}>{RARETES[def.rarete].nom}</Text></Text>
                      <View style={styles.objDetailRang}><IconeEmoji emoji={EMPLACEMENTS[def.slot].emoji} taille={13} /><Text style={styles.objDetail}>{def.detail}</Text></View>
                    </View>
                    {owned ? <Icone nom="check" taille={20} /> : (
                      <Pressable style={[styles.objAchat, cher && { opacity: 0.4 }]} disabled={cher} onPress={() => acheterObjet(o)}>
                        <IconePerle taille={12} /><Text style={styles.objAchatTxt}>{def.cout != null ? formatNb(def.cout) : '—'}</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}

              {atelierTab === 'capsule' && (
                <View style={{ gap: 12, alignItems: 'center' }}>
                  <Text style={styles.capsuleDesc}>
                    Ouvre une Capsule Objet : un objet aléatoire (surtout rares/épiques, parfois légendaire).
                    Les doublons se transforment en éclats à forger.
                  </Text>
                  <Text style={styles.pityTxt}>Épique garanti dans {Math.max(1, PITY_OBJET_EPIQUE - etat.pityObjet)} ouverture(s)</Text>
                  {revele && (
                    <View style={[styles.reveleBoite, { borderColor: RARETES[OBJETS[revele.objet].rarete].couleur }]}>
                      <IconeEmoji emoji={OBJETS[revele.objet].emoji} taille={46} />
                      <Text style={styles.reveleNom}>{OBJETS[revele.objet].nom}</Text>
                      <Text style={[styles.reveleRar, { color: RARETES[OBJETS[revele.objet].rarete].couleur }]}>{RARETES[OBJETS[revele.objet].rarete].nom}</Text>
                      <Text style={styles.reveleEtat}>{revele.doublon ? `Doublon → +${revele.eclats} éclats` : 'Nouvel objet débloqué !'}</Text>
                    </View>
                  )}
                  <Pressable
                    style={[styles.capsuleBtn, etat.perles < CAPSULE_OBJET.cout && { opacity: 0.4 }]}
                    disabled={etat.perles < CAPSULE_OBJET.cout}
                    onPress={() => { const r = ouvrirCapsuleObjet(); if (r) setRevele(r); }}
                  >
                    <IconePerle taille={15} /><Text style={styles.capsuleBtnTxt}>Ouvrir — {formatNb(CAPSULE_OBJET.cout)}</Text>
                  </Pressable>
                </View>
              )}

              {atelierTab === 'forge' && (
                <View style={{ gap: 9 }}>
                  <Text style={styles.capsuleDesc}>
                    Dépense tes éclats pour forger DIRECTEMENT l'objet voulu — même épique ou légendaire.
                    La parade anti-malchance des gros joueurs.
                  </Text>
                  {OBJET_IDS.filter((o) => !etat.objets[o]).sort((a, b) => ORDRE_RARETE[OBJETS[a].rarete] - ORDRE_RARETE[OBJETS[b].rarete]).map((o) => {
                    const def = OBJETS[o];
                    const cout = ECLATS_FORGE[def.rarete];
                    const peut = etat.eclats >= cout;
                    return (
                      <View key={o} style={styles.boutiqueLigne}>
                        <View style={[styles.objBadge, { borderColor: RARETES[def.rarete].couleur }]}><IconeEmoji emoji={def.emoji} taille={24} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.objNom}>{def.nom} <Text style={{ color: RARETES[def.rarete].couleur, fontSize: 10 }}>{RARETES[def.rarete].nom}</Text></Text>
                          <View style={styles.objDetailRang}><IconeEmoji emoji={EMPLACEMENTS[def.slot].emoji} taille={13} /><Text style={styles.objDetail}>{def.detail}</Text></View>
                        </View>
                        <Pressable style={[styles.objAchat, !peut && { opacity: 0.4 }]} disabled={!peut} onPress={() => forgerObjet(o)}>
                          <Icone nom="eclat" taille={12} /><Text style={styles.objAchatTxt}>{cout}</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}

              {atelierTab === 'conso' && (
                <View style={{ gap: 9 }}>
                  <Text style={styles.capsuleDesc}>
                    Des objets à usage unique pour tes duels : soigner, réveiller, booster… Utiliser un
                    consommable en combat coûte ton tour, mais ça sauve les remontées.
                  </Text>
                  {CONSOMMABLE_IDS.map((id) => {
                    const d = CONSOMMABLES[id];
                    const stock = etat.consommables[id] ?? 0;
                    const cher = etat.perles < d.cout;
                    return (
                      <View key={id} style={styles.boutiqueLigne}>
                        <View style={[styles.objBadge, { borderColor: C.bord }]}><IconeEmoji emoji={d.emoji} taille={24} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.objNom}>{d.nom} {stock > 0 && <Text style={{ color: C.vert, fontSize: 11 }}>×{stock}</Text>}</Text>
                          <Text style={styles.objDetail}>{d.desc}</Text>
                        </View>
                        <Pressable style={[styles.objAchat, cher && { opacity: 0.4 }]} disabled={cher} onPress={() => acheterConsommable(id)}>
                          <IconePerle taille={12} /><Text style={styles.objAchatTxt}>{formatNb(d.cout)}</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
            <BoutonJeu titre="Fermer" onPress={() => setAtelierVisible(false)} style={{ alignSelf: 'stretch' }} />
          </View>
        </View>
      </Modal>

      {/* === 🏆 Ligue : échelle des tiers, saison, récompense === */}
      <Modal visible={ligueVisible} transparent animationType="fade" onRequestClose={() => setLigueVisible(false)}>
        <View style={styles.modalFond}>
          <View style={[styles.modalCarte, { maxHeight: '90%' }]}>
            <View style={styles.modalTitreRang}><Icone nom="trophee" taille={20} /><Text style={styles.modalTitre}>Ligue — Saison {cl.saison}</Text></View>
            <Text style={styles.ligueSous}>
              Grimpe les tiers en gagnant tes combats d'Arène (+{26} PC la victoire). La saison finit dans {cl.joursRestants} j :
              reset doux, et ton meilleur tier te donne une récompense + un titre.
            </Text>
            {gainSaison && <Text style={styles.ligueGain}>Réclamé : {gainSaison}</Text>}
            {cl.recompenseEnAttente && (
              <View style={styles.ligueRecompense}>
                <View style={styles.titreIcone}><Icone nom="cadeau" taille={16} /><Text style={styles.ligueRecompenseTitre}>Récompense de la saison {cl.recompenseEnAttente.saison}</Text></View>
                <Text style={styles.ligueRecompenseDetail}>{apercuRecompense(cl.recompenseEnAttente.tierId)}</Text>
                <BoutonJeu
                  titre="Réclamer"
                  onPress={() => { const r = reclamerRecompenseSaison(); if (r) setGainSaison(apercuGain(r)); }}
                  style={{ alignSelf: 'stretch', backgroundColor: C.vert }}
                />
              </View>
            )}
            <ScrollView contentContainerStyle={{ gap: 7, paddingVertical: 2 }}>
              {[...TIERS].reverse().map((t) => {
                const actuel = t.id === cl.tier.id;
                const atteint = cl.meilleurTierSaison >= t.id;
                const titre = recompenseSaison(t.id).titre;
                return (
                  <View key={t.id} style={[styles.ligueTier, actuel && { borderColor: t.couleur, borderWidth: 2, backgroundColor: '#fff' }]}>
                    <IconeEmoji emoji={t.emoji} taille={26} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.ligueTierNom, { color: t.couleur }]}>{t.nom}{actuel ? '  ← toi' : ''}</Text>
                      <Text style={styles.ligueTierSeuil}>{t.seuil} PC{titre ? `  ·  titre « ${titre} »` : ''}</Text>
                    </View>
                    {atteint && <Icone nom="check" taille={16} />}
                  </View>
                );
              })}
            </ScrollView>
            {cl.titres.length > 0 && (
              <View style={styles.ligueTitresRang}>
                <Icone nom="trophee" taille={14} />
                <Text style={styles.ligueTitres}>Tes titres : {cl.titres.join('  ·  ')}</Text>
              </View>
            )}
            <BoutonJeu titre="Fermer" onPress={() => setLigueVisible(false)} style={{ alignSelf: 'stretch' }} />
          </View>
        </View>
      </Modal>

      {/* === Mise du duel === */}
      <Modal visible={miseVisible} transparent animationType="fade" onRequestClose={() => setMiseVisible(false)}>
        <View style={styles.modalFond}>
          <View style={styles.modalCarte}>
            <Text style={styles.modalTitre}>Duel avec mise</Text>
            <Text style={styles.aide}>Choisis le doublon que tu mises :</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
              {doublons.map((id) => (
                <Pressable key={id} style={[styles.choix, maMise === id && styles.choixActif]} onPress={() => setMaMise(id)}>
                  <PastilleCollectible id={id} taille={56} />
                  <Text style={styles.slotNom} numberOfLines={1}>{trouverCollectible(id)?.nom}</Text>
                  <Text style={styles.choixRarete}>×{etat.collection[id]}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.vsLigne}>
              <Text style={styles.vsTxt}>Sam mise :</Text>
              {samMise && <PastilleCollectible id={samMise} taille={52} cache={!(etat.collection[samMise] > 0)} />}
              <Text style={styles.vsNom}>
                {samMise && (etat.collection[samMise] > 0 ? trouverCollectible(samMise)?.nom : '??? (tu ne l\'as pas !)')}
              </Text>
            </View>
            <BoutonJeu
              titre="Lancer le duel !"
              disabled={!maMise}
              onPress={lancerDuelMise}
              style={{ alignSelf: 'stretch', backgroundColor: '#D2588A' }}
            />
            <Pressable onPress={() => setMiseVisible(false)} hitSlop={6}>
              <Text style={styles.annuler}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  contenu: { padding: 18, gap: 14, paddingBottom: 34 },

  carte: { backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 12, ...OMBRE },
  cartePnj: { borderWidth: 2, borderColor: C.violetClair },
  carteHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  carteTitre: { fontFamily: F.t800, fontSize: 16, color: C.texte },
  stats: { fontFamily: F.t700, fontSize: 13, color: C.texte2 },

  equipeRang: { flexDirection: 'row', justifyContent: 'space-around' },
  slot: { alignItems: 'center', gap: 4, width: 86 },
  slotNom: { fontFamily: F.t700, fontSize: 11.5, color: C.texte },

  aide: { fontFamily: F.t600, fontSize: 12, color: C.texte2, lineHeight: 17, textAlign: 'center' },
  typeCarte: { backgroundColor: C.fond, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 10, gap: 7, marginTop: 4 },
  typeLegende: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.carte, borderRadius: R.pill, paddingVertical: 3, paddingHorizontal: 8 },
  typeNom: { fontFamily: F.t800, fontSize: 12, color: C.texte },
  typeBat: { fontFamily: F.t700, fontSize: 11, color: C.texte3 },
  typeSign: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  typeSignTxt: { fontFamily: F.t600, fontSize: 10.5, color: C.texte2, textAlign: 'center' },
  puissance: { backgroundColor: C.lavande, borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 10 },
  puissanceTxt: { fontFamily: F.t800, fontSize: 12.5, color: C.violetProfond },
  recompense: { fontFamily: F.t700, fontSize: 13, color: C.vertFonce, textAlign: 'center' },

  note: { fontFamily: F.t600, fontSize: 12, color: C.texte3, textAlign: 'center', lineHeight: 17 },

  verrou: { backgroundColor: C.carte, borderRadius: R.carte, padding: 24, alignItems: 'center', gap: 12, ...OMBRE },
  verrouTitre: { fontFamily: F.titre, fontSize: 20, color: C.violet },
  verrouTexte: { fontFamily: F.t400, fontSize: 14, color: C.texte2, textAlign: 'center', lineHeight: 20 },

  carteTournoi: { borderWidth: 2, borderColor: C.jaune },
  tropheesMini: { fontFamily: F.t800, fontSize: 13, color: '#9A6B00' },
  tournoiEtat: { fontFamily: F.t600, fontSize: 13, color: C.texte2, lineHeight: 18 },
  tournoiOuvrir: { fontFamily: F.t800, fontSize: 13.5, color: C.violetClair, textAlign: 'right' },
  defisCarte: { borderWidth: 2, borderColor: C.violetClair },
  defisHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  defisBadge: { backgroundColor: C.danger, borderRadius: R.pill, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  defisBadgeTxt: { fontFamily: F.t800, fontSize: 12, color: '#fff' },
  defisOuvrir: { fontFamily: F.t800, fontSize: 13.5, color: C.violetClair, textAlign: 'right' },

  objetLigne: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  objetNomPerso: { fontFamily: F.t800, fontSize: 13.5, color: C.texte },
  objetTenu: { fontFamily: F.t600, fontSize: 11.5, color: C.texte2, marginTop: 1 },
  objetChanger: { fontFamily: F.t700, fontSize: 12.5, color: C.violetClair },
  objetChoix: {
    backgroundColor: C.fond, borderRadius: 14, padding: 12, gap: 3,
    borderWidth: 2, borderColor: 'transparent',
  },
  objetChoixActif: { borderColor: C.vert, backgroundColor: C.vertPale },
  objetChoixNom: { fontFamily: F.t800, fontSize: 14, color: C.texte },
  objetChoixDetail: { fontFamily: F.t600, fontSize: 12, color: C.texte2 },
  objetSection: { fontFamily: F.t800, fontSize: 12.5, color: C.texte2, marginTop: 4 },
  objetAchat: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: C.vert, borderRadius: R.pill, paddingVertical: 6, paddingHorizontal: 12, marginTop: 4,
  },
  objetAchatTxt: { fontFamily: F.t800, fontSize: 12.5, color: C.violetProfond },

  // === équipement (carte) ===
  equipEnTete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eclatsPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EAF4FA', borderRadius: R.pill, paddingVertical: 3, paddingHorizontal: 10, borderWidth: 1, borderColor: '#BFE0EF' },
  eclatsTxt: { fontFamily: F.t800, fontSize: 12.5, color: '#3E7C97' },
  equipLigne: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  slotChips: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  slotChip: {
    width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: C.bord, backgroundColor: C.fond,
  },
  slotChipTxt: { fontSize: 14 },
  panoTag: { fontFamily: F.t800, fontSize: 11.5, marginLeft: 2 },

  // === équipement (modal 3 emplacements) ===
  slotBloc: { gap: 6 },
  slotTitre: { fontFamily: F.t800, fontSize: 13.5, color: C.texte },
  slotChoixRang: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  miniChoix: {
    width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.bord, backgroundColor: C.fond,
  },
  miniChoixActif: { borderColor: C.vert, backgroundColor: C.vertPale },
  miniChoixTxt: { fontSize: 20 },
  slotVide: { fontFamily: F.t600, fontSize: 11.5, color: C.texte3, fontStyle: 'italic' },
  slotDetail: { fontFamily: F.t600, fontSize: 11.5, color: C.texte2 },
  effResume: { backgroundColor: C.fond, borderRadius: 14, padding: 12, gap: 4 },
  effTitre: { fontFamily: F.t800, fontSize: 12.5, color: C.texte },
  effTxt: { fontFamily: F.t700, fontSize: 12, color: C.violetClair },
  panoLigne: { fontFamily: F.t700, fontSize: 11.5, marginTop: 2 },

  // === atelier d'objets ===
  atelierEnTete: { alignItems: 'center', gap: 8 },
  soldeRang: { flexDirection: 'row', gap: 8 },
  soldePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.fond, borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 10 },
  soldeTxt: { fontFamily: F.t800, fontSize: 12.5, color: C.texte },
  tabsRang: { flexDirection: 'row', gap: 6, backgroundColor: C.fond, borderRadius: R.pill, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: R.pill },
  tabActif: { backgroundColor: C.violet },
  tabTxt: { fontFamily: F.t800, fontSize: 12.5, color: C.texte2 },
  tabTxtActif: { color: '#fff' },
  boutiqueLigne: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.fond, borderRadius: 14, padding: 10 },
  objBadge: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, backgroundColor: '#fff' },
  objNom: { fontFamily: F.t800, fontSize: 13, color: C.texte },
  objDetail: { fontFamily: F.t600, fontSize: 11, color: C.texte2, marginTop: 1 },
  possede: { fontFamily: F.t800, fontSize: 15, color: C.vert },
  objAchat: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.jaune, borderRadius: R.pill, paddingVertical: 7, paddingHorizontal: 12 },
  objAchatTxt: { fontFamily: F.t800, fontSize: 12.5, color: C.violetProfond },
  capsuleDesc: { fontFamily: F.t600, fontSize: 12.5, color: C.texte2, lineHeight: 18, textAlign: 'center' },
  pityTxt: { fontFamily: F.t800, fontSize: 12, color: '#3E7C97', backgroundColor: '#EAF4FA', borderRadius: R.pill, paddingVertical: 4, paddingHorizontal: 12, overflow: 'hidden' },
  reveleBoite: { alignItems: 'center', gap: 3, backgroundColor: C.fond, borderRadius: 18, padding: 16, borderWidth: 2.5, alignSelf: 'stretch' },
  reveleNom: { fontFamily: F.t800, fontSize: 15, color: C.texte },
  reveleRar: { fontFamily: F.t800, fontSize: 12 },
  reveleEtat: { fontFamily: F.t700, fontSize: 12.5, color: C.texte2, marginTop: 2 },
  capsuleBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#4E9DC4', borderRadius: R.pill, paddingVertical: 13, paddingHorizontal: 26 },
  capsuleBtnTxt: { fontFamily: F.t800, fontSize: 15, color: '#fff' },

  // === classement (carte) ===
  rangCarte: { backgroundColor: C.carte, borderRadius: 20, padding: 16, gap: 10, borderWidth: 2, ...OMBRE },
  rangHaut: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rangEmoji: { fontSize: 34 },
  rangNom: { fontFamily: F.t800, fontSize: 17 },
  rangSaison: { fontFamily: F.t600, fontSize: 11.5, color: C.texte2, marginTop: 1 },
  rangPcBoite: { alignItems: 'center' },
  rangPc: { fontFamily: F.titre, fontSize: 22, color: C.texte },
  rangPcLib: { fontFamily: F.t700, fontSize: 10, color: C.texte2, marginTop: -2 },
  rangBarreFond: { height: 9, borderRadius: 5, backgroundColor: C.fond, overflow: 'hidden' },
  rangBarrePlein: { height: 9, borderRadius: 5 },
  rangSous: { fontFamily: F.t700, fontSize: 11.5, color: C.violetClair },
  rangRecompenseBadge: { backgroundColor: C.vertPale, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10, alignItems: 'center' },
  rangRecompenseTxt: { fontFamily: F.t800, fontSize: 12.5, color: '#2E7D32' },
  mutBanniere: { backgroundColor: '#FFF3D6', borderRadius: 16, paddingVertical: 11, paddingHorizontal: 15, gap: 2, borderWidth: 1, borderColor: C.jaune },
  mutTitre: { fontFamily: F.t800, fontSize: 13.5, color: '#9A6B00' },
  mutDesc: { fontFamily: F.t600, fontSize: 11.5, color: C.texte2, lineHeight: 16 },
  bossCarte: { backgroundColor: C.carte, borderRadius: 20, padding: 16, gap: 9, borderWidth: 2, borderColor: '#F0C0C8', ...OMBRE },
  bossHaut: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bossNom: { fontFamily: F.t800, fontSize: 16, color: '#B23A4E' },
  bossGimmick: { fontFamily: F.t700, fontSize: 12, color: C.texte2, marginTop: 2 },
  bossIndice: { fontFamily: F.t600, fontSize: 11.5, color: C.texte2, lineHeight: 16 },
  bossRecomp: { fontFamily: F.t800, fontSize: 12, color: '#9A6B00' },
  bossBattuBadge: { flexDirection: 'row', gap: 6, backgroundColor: C.vertPale, borderRadius: 10, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  bossRecompRang: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  bossBattuTxt: { fontFamily: F.t800, fontSize: 12.5, color: '#2E7D32' },

  // === ligue (modal) ===
  ligueSous: { fontFamily: F.t600, fontSize: 12.5, color: C.texte2, lineHeight: 18, textAlign: 'center' },
  ligueGain: { fontFamily: F.t800, fontSize: 12.5, color: '#2E7D32', textAlign: 'center', backgroundColor: C.vertPale, borderRadius: 10, paddingVertical: 8, overflow: 'hidden' },
  ligueRecompense: { backgroundColor: '#FFF3D6', borderRadius: 14, padding: 12, gap: 8, borderWidth: 1, borderColor: C.jaune },
  ligueRecompenseTitre: { fontFamily: F.t800, fontSize: 13.5, color: '#9A6B00' },
  ligueRecompenseDetail: { fontFamily: F.t700, fontSize: 12, color: C.texte },
  ligueTier: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.fond, borderRadius: 12, padding: 10, borderWidth: 2, borderColor: 'transparent' },
  ligueTierEmoji: { fontSize: 24 },
  ligueTierNom: { fontFamily: F.t800, fontSize: 14 },
  ligueTierSeuil: { fontFamily: F.t600, fontSize: 11, color: C.texte2, marginTop: 1 },
  ligueTierCheck: { fontFamily: F.t800, fontSize: 16, color: C.vert },
  ligueTitres: { fontFamily: F.t700, fontSize: 11.5, color: C.texte2, textAlign: 'center' },

  modalFond: { flex: 1, backgroundColor: 'rgba(42,29,70,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCarte: { backgroundColor: C.carte, borderRadius: 24, padding: 20, gap: 12, alignSelf: 'stretch', ...OMBRE },
  modalTitre: { fontFamily: F.titre, fontSize: 20, color: C.violet, textAlign: 'center' },
  grilleChoix: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  choix: {
    alignItems: 'center', gap: 3, width: 86, padding: 8, borderRadius: 14,
    borderWidth: 2, borderColor: 'transparent', backgroundColor: C.fond,
  },
  choixActif: { borderColor: C.vert, backgroundColor: C.vertPale },
  choixRarete: { fontFamily: F.t700, fontSize: 10.5, color: C.texte3 },
  choixPassif: { fontFamily: F.t700, fontSize: 9.5, color: C.violetClair, textAlign: 'center' },
  budgetBoite: { backgroundColor: C.fond, borderRadius: 14, padding: 12, gap: 6 },
  budgetLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  budgetTxt: { fontFamily: F.t800, fontSize: 13, color: C.texte },
  budgetBonus: { fontFamily: F.t800, fontSize: 12, color: '#2E7D32' },
  budgetBarreFond: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: C.bord },
  budgetBarrePlein: { height: 8, borderRadius: 4, backgroundColor: C.violetClair },
  budgetAide: { fontFamily: F.t600, fontSize: 10.5, color: C.texte2, lineHeight: 15 },
  passifBoite: { backgroundColor: '#F1ECFA', borderRadius: 12, padding: 11, gap: 2, borderWidth: 1, borderColor: C.violetClair },
  passifTitre: { fontFamily: F.t800, fontSize: 13, color: C.violet },
  passifDesc: { fontFamily: F.t600, fontSize: 11.5, color: C.texte2 },
  vsLigne: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  vsTxt: { fontFamily: F.t700, fontSize: 13.5, color: C.texte2 },
  vsNom: { fontFamily: F.t800, fontSize: 13.5, color: C.texte },
  annuler: { fontFamily: F.t700, fontSize: 14, color: C.texte2, textAlign: 'center', padding: 6 },

  // rangées « icône + texte » (remplacent les emojis inline)
  titreIcone: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  modalTitreRang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  mutTitreRang: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  recompenseRang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, flexWrap: 'wrap' },
  tropheesMiniRang: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  panoTagRang: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 2 },
  choixPassifRang: { flexDirection: 'row', alignItems: 'center', gap: 3, justifyContent: 'center' },
  slotTitreRang: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  objDetailRang: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  panoLigneRang: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ligueTitresRang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
});
