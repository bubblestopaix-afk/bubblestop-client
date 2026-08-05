// === Boba Quest — le COMPTOIR DE TROC (v2) ===
// 3 offres par jour, déterministes par date (anti-spam : chacune utilisable 1×) :
// • Le troc de Sam — un doublon contre une carte manquante (ou des ressources
//   quand la collection est complète).
// • La fonte de doublons — plusieurs doublons d'un certain standing fondus en capsule.
// • Le troc du comptoir — éclats ou consommables contre une capsule (ou l'inverse).
// Les trocs consomment les compteurs ×n (monnaie d'entraînement) : la vitrine (×1)
// n'est JAMAIS troquable. Toute la validation est rejouée côté store.
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { BORD, C, F, R, OMBRE } from '@/constants/charte';
import PastilleCollectible from '@/components/jeu/collectibles';
import {
  Collectible, COLLECTIBLES, CONSOMMABLES, CONSOMMABLE_IDS, ConsommableId, Rarete, RARETES,
  trouverCollectible,
} from '@/components/jeu/economie';
import { Icone, IconeEmoji } from '@/components/jeu/icones';
import { BoutonJeu, EnTeteJeu } from '@/components/jeu/ui-jeu';
import { hapticLeger } from '@/lib/juice';
import {
  type OffreTrocEnrichie, offresTrocAujourdhui, realiserOffreTroc, useBobaQuest,
} from '@/store/jeu';

const nomCarte = (id: string) => trouverCollectible(id)?.nom ?? '';

// 🩹 26/07 — LA FONTE COMPTE DES CARTES DIFFÉRENTES, PAS DES DOUBLONS. `toggle` ne
// sélectionne chaque carte qu'une fois et le store rejette les répétitions
// (`new Set(cartes).size !== cartes.length`) : ce qui compte est donc le nombre de
// cartes DISTINCTES possédées en double, jamais le total d'exemplaires. Un joueur avec
// une seule carte en ×4 face à « 3 doublons rares+ » lisait « Il te manque 2 doublons »
// alors qu'il en a 3 — ce qui lui manque, ce sont 2 cartes DIFFÉRENTES. Même règle
// exacte que le store et que la grille de sélection : ×2 mini + rareté suffisante.
function cartesFondables(
  collection: Record<string, number>, rareteMin: Rarete,
): Collectible[] {
  return COLLECTIBLES
    .filter((c) => (collection[c.id] || 0) >= 2 && RARETES[c.rarete].ordre >= RARETES[rareteMin].ordre)
    .sort((a, b) => RARETES[b.rarete].ordre - RARETES[a.rarete].ordre);
}

// Message d'indisponibilité de la fonte, recomposé côté UI : celui du store parle de
// « doublons » alors qu'il compte des cartes distinctes (et il n'est pas éditable ici).
function manqueFonte(nb: number, dispo: number, rareteMin: Rarete): string {
  const reste = Math.max(0, nb - dispo);
  return `Il te manque ${reste} carte${reste > 1 ? 's' : ''} différente${reste > 1 ? 's' : ''} `
    + `en double (${RARETES[rareteMin].nom} ou plus rare) — tu en as ${dispo} sur ${nb}. `
    + 'Plusieurs exemplaires d\'une même carte ne comptent que pour une.';
}

// Libellé FR de ce que Sam donne en échange (collection complète)
function labelRessources(sam: Extract<OffreTrocEnrichie, { type: 'sam' }>['sam'] & { kind: 'sam-ressource' }): string {
  const p: string[] = [];
  if (sam.capsule) p.push(`1 capsule ${sam.capsule === 'doree' ? 'dorée' : 'classique'}`);
  if (sam.perles) p.push(`${sam.perles} perles`);
  if (sam.eclats) p.push(`${sam.eclats} éclats`);
  return p.join(' + ');
}

export default function TrocScreen() {
  const insets = useSafeAreaInsets();
  const etat = useBobaQuest();
  const offres = offresTrocAujourdhui(etat);
  const [recu, setRecu] = useState<string | null>(null);
  const [fonteVisible, setFonteVisible] = useState(false);
  const [consosVisible, setConsosVisible] = useState(false);

  const offreSam = offres.find((o) => o.id === 'sam') as Extract<OffreTrocEnrichie, { type: 'sam' }>;
  const offreFonte = offres.find((o) => o.id === 'fonte') as Extract<OffreTrocEnrichie, { type: 'fonte' }>;
  const offreRessource = offres.find((o) => o.id === 'ressource') as Extract<OffreTrocEnrichie, { type: 'ressource' }>;

  // Réalisation directe (sam, ressource éclats) — les offres à choix passent par leur modale.
  const troquer = (id: 'sam' | 'ressource') => {
    const r = realiserOffreTroc(id);
    if (r) { hapticLeger(); setRecu(r.recu); }
  };

  // 🩹 26/07 — cartes distinctes fondables aujourd'hui (sert au libellé ET au message
  // d'indisponibilité de la fonte, pour que les deux disent la même chose).
  const fondables = cartesFondables(etat.collection, offreFonte.rareteMin);

  // Carte d'offre générique : titre, contenu, bouton avec ses 3 états.
  // `manqueLocal` : 🩹 26/07 — permet de remplacer le message du store quand il est
  // trompeur (fonte). Sans lui, on retombe sur `offre.faisable.manque`.
  const carteOffre = (
    offre: OffreTrocEnrichie, emoji: string, titre: string, contenu: ReactNode, onTroquer: () => void,
    manqueLocal?: string,
  ) => (
    <View style={[styles.carte, offre.fait && { opacity: 0.62 }]}>
      <View style={styles.carteTitreRang}>
        <IconeEmoji emoji={emoji} taille={22} />
        <Text style={styles.carteTitre}>{titre}</Text>
        {offre.fait && (
          <View style={styles.faitBadge}><Icone nom="check" taille={13} /><Text style={styles.faitTxt}>Fait</Text></View>
        )}
      </View>
      {contenu}
      {offre.fait ? (
        <BoutonJeu titre="Fait ✓" disabled onPress={() => {}} style={{ alignSelf: 'stretch' }} />
      ) : offre.faisable.ok ? (
        <BoutonJeu titre="Troquer" onPress={onTroquer} style={{ alignSelf: 'stretch' }} />
      ) : (
        <>
          <BoutonJeu titre="Troquer" disabled onPress={() => {}} style={{ alignSelf: 'stretch' }} />
          <Text style={styles.manque}>{manqueLocal ?? offre.faisable.manque}</Text>
        </>
      )}
    </View>
  );

  return (
    <View style={[styles.fond, { paddingTop: insets.top + 10 }]}>
      <View style={{ paddingHorizontal: 18 }}>
        <EnTeteJeu titre="Comptoir de Troc" onRetour={() => router.back()} perles={etat.perles} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.pitch}>Sam troque avec toi — 3 offres par jour, nouvelles offres demain.</Text>

        {/* === Bannière récap du dernier troc === */}
        {recu && (
          <Pressable style={styles.recu} onPress={() => setRecu(null)} accessibilityRole="button">
            <Icone nom="cadeau" taille={18} />
            <Text style={styles.recuTxt}>Tu as reçu : {recu}</Text>
            <Text style={styles.recuFermer}>✕</Text>
          </Pressable>
        )}

        {/* === 1. Le troc de Sam === */}
        {carteOffre(offreSam, '🤝', 'Le troc de Sam', (
          <View style={styles.echangeRang}>
            <View style={styles.col}>
              <Text style={styles.colLabel}>Tu donnes</Text>
              <PastilleCollectible id={offreSam.sam.veut} taille={62} />
              <Text style={styles.colNom} numberOfLines={1}>1× {nomCarte(offreSam.sam.veut)}</Text>
              <Text style={styles.colSous}>ton doublon</Text>
            </View>
            <Text style={styles.fleche}>→</Text>
            <View style={styles.col}>
              <Text style={styles.colLabel}>Tu reçois</Text>
              {offreSam.sam.kind === 'sam-carte' ? (
                <>
                  <PastilleCollectible id={offreSam.sam.offre} taille={62} />
                  <Text style={styles.colNom} numberOfLines={1}>1× {nomCarte(offreSam.sam.offre)}</Text>
                  <View style={styles.neuf}><Text style={styles.neufTxt}>NOUVEAU</Text></View>
                </>
              ) : (
                <>
                  <View style={styles.resBadge}><Icone nom="cadeau" taille={30} /></View>
                  <Text style={styles.colNom}>{labelRessources(offreSam.sam)}</Text>
                  <Text style={styles.colSous}>collection complète !</Text>
                </>
              )}
            </View>
          </View>
        ), () => troquer('sam'))}

        {/* === 2. La fonte de doublons === */}
        {/* 🩹 26/07 : « N doublons » laissait croire que 4 exemplaires d'une même carte
            suffisaient. La fonte exige N cartes DIFFÉRENTES possédées en double. */}
        {carteOffre(offreFonte, '🔥', 'La fonte de doublons', (
          <View style={styles.detailRang}>
            <Icone nom="flamme" taille={18} />
            <Text style={styles.detailTxt}>
              {offreFonte.nb} cartes différentes en double, {RARETES[offreFonte.rareteMin].nom} ou plus rares
              {' → '}1 capsule {offreFonte.capsule === 'doree' ? 'DORÉE' : 'classique'}
              {offreFonte.eclatsBonus ? ` + ${offreFonte.eclatsBonus} éclats` : ''}
            </Text>
          </View>
        ), () => setFonteVisible(true), manqueFonte(offreFonte.nb, fondables.length, offreFonte.rareteMin))}

        {/* === 3. Le troc du comptoir === */}
        {carteOffre(offreRessource, '🎒', 'Le troc du comptoir', (
          <View style={styles.detailRang}>
            <IconeEmoji
              emoji={offreRessource.donne.type === 'eclats' ? '🔹' : '🧪'} taille={18}
            />
            <Text style={styles.detailTxt}>
              {offreRessource.donne.n} {offreRessource.donne.type === 'eclats' ? 'éclats' : 'consommables'}
              {' → '}
              {offreRessource.recoit.type === 'capsule'
                ? `1 capsule ${offreRessource.recoit.capsule === 'doree' ? 'DORÉE' : 'classique'}`
                : `${offreRessource.recoit.eclats} éclats`}
            </Text>
          </View>
        ), () => (offreRessource.donne.type === 'consos' ? setConsosVisible(true) : troquer('ressource')))}

        <Text style={styles.aide}>
          Les trocs consomment tes doublons (jamais le dernier exemplaire) : ce sont aussi
          la monnaie d'entraînement de tes cartes — troque avec soin !
        </Text>
      </ScrollView>

      {/* === Modale fonte : choisir les doublons à fondre === */}
      <Modal visible={fonteVisible} transparent animationType="fade" onRequestClose={() => setFonteVisible(false)}>
        {fonteVisible && (
          <View style={styles.modalFond}>
            <View style={styles.modalCarte}>
              <Text style={styles.modalTitre}>La fonte de doublons</Text>
              <FonteSelection
                offre={offreFonte}
                collection={etat.collection}
                onValider={(cartes) => {
                  const r = realiserOffreTroc('fonte', { cartes });
                  if (r) { hapticLeger(); setRecu(r.recu); setFonteVisible(false); }
                }}
                onFermer={() => setFonteVisible(false)}
              />
            </View>
          </View>
        )}
      </Modal>

      {/* === Modale comptoir : choisir les consommables à troquer === */}
      <Modal visible={consosVisible} transparent animationType="fade" onRequestClose={() => setConsosVisible(false)}>
        {consosVisible && offreRessource.donne.type === 'consos' && (
          <View style={styles.modalFond}>
            <View style={styles.modalCarte}>
              <Text style={styles.modalTitre}>Le troc du comptoir</Text>
              <ConsosSelection
                n={offreRessource.donne.n}
                consommables={etat.consommables}
                onValider={(consos) => {
                  const r = realiserOffreTroc('ressource', { consos });
                  if (r) { hapticLeger(); setRecu(r.recu); setConsosVisible(false); }
                }}
                onFermer={() => setConsosVisible(false)}
              />
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

// --- Sélection des doublons pour la fonte -----------------------------------------
// Grille des cartes éligibles (×n≥2, rareté ≥ min). Tap = toggle, max `offre.nb`.
// 🩹 26/07 — le badge « ×N » annonçait N exemplaires troquables alors que `toggle` ne
// sélectionne chaque carte QU'UNE fois (et que le store rejette les répétitions) :
// il promettait ce que le jeu refuse. Remplacé par un indicateur BINAIRE — la carte
// est choisie, ou elle ne l'est pas.
function FonteSelection({ offre, collection, onValider, onFermer }: {
  offre: Extract<OffreTrocEnrichie, { type: 'fonte' }>;
  collection: Record<string, number>;
  onValider: (cartes: string[]) => void;
  onFermer: () => void;
}) {
  const [sel, setSel] = useState<string[]>([]);
  const eligibles = cartesFondables(collection, offre.rareteMin);
  const toggle = (id: string) => {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < offre.nb ? [...s, id] : s));
  };
  return (
    <>
      <Text style={styles.modalSous}>
        Choisis {offre.nb} cartes différentes {RARETES[offre.rareteMin].nom}+ que tu possèdes
        en double — {sel.length}/{offre.nb}
      </Text>
      {/* 🩹 26/07 : la règle qui rendait le compteur incompréhensible, dite une fois. */}
      <Text style={styles.modalAide}>
        Une seule fonte par carte : plusieurs exemplaires d'une même carte ne comptent
        que pour une. Ton exemplaire de vitrine n'est jamais fondu.
      </Text>
      <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={styles.grille}>
        {eligibles.map((c) => {
          const actif = sel.includes(c.id);
          const complet = !actif && sel.length >= offre.nb; // sélection déjà pleine
          return (
            <Pressable
              key={c.id}
              style={[styles.choixCarte, actif && styles.choixCarteActif]}
              onPress={() => toggle(c.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: actif }}
              accessibilityLabel={`${c.nom}, ${RARETES[c.rarete].nom}, en double`}
              accessibilityHint={actif
                ? 'Sélectionnée pour la fonte — tape pour la retirer.'
                : complet
                  ? 'Sélection complète : retire d\'abord une autre carte.'
                  : 'Tape pour la choisir.'}
            >
              {/* 🩹 26/07 : indicateur BINAIRE (coché / non coché) — plus de « ×N » */}
              <View style={[styles.choixCase, actif && styles.choixCaseActive]}>
                {actif && <Icone nom="check" taille={11} />}
              </View>
              <PastilleCollectible id={c.id} taille={54} />
              <Text style={styles.choixNom} numberOfLines={1}>{c.nom}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <BoutonJeu
        titre={sel.length === offre.nb
          ? 'Fondre et recevoir la capsule'
          : `Encore ${offre.nb - sel.length} carte${offre.nb - sel.length > 1 ? 's' : ''} à choisir`}
        disabled={sel.length !== offre.nb}
        onPress={() => onValider(sel)}
        style={{ alignSelf: 'stretch' }}
      />
      <Pressable onPress={onFermer} hitSlop={6}><Text style={styles.annuler}>Annuler</Text></Pressable>
    </>
  );
}

// --- Sélection des consommables pour le troc du comptoir ---------------------------
// Tap répété autorisé sur un même consommable tant que du stock reste ; total = n.
function ConsosSelection({ n, consommables, onValider, onFermer }: {
  n: number;
  consommables: Partial<Record<ConsommableId, number>>;
  onValider: (consos: ConsommableId[]) => void;
  onFermer: () => void;
}) {
  const [choix, setChoix] = useState<Partial<Record<ConsommableId, number>>>({});
  const total = CONSOMMABLE_IDS.reduce((s, id) => s + (choix[id] ?? 0), 0);
  const ajouter = (id: ConsommableId) => {
    const stock = consommables[id] ?? 0;
    const pris = choix[id] ?? 0;
    if (total >= n || pris >= stock) return;
    setChoix({ ...choix, [id]: pris + 1 });
  };
  const retirer = (id: ConsommableId) => {
    const pris = choix[id] ?? 0;
    if (pris <= 0) return;
    setChoix({ ...choix, [id]: pris - 1 });
  };
  const valider = () => {
    const consos: ConsommableId[] = [];
    for (const id of CONSOMMABLE_IDS) for (let i = 0; i < (choix[id] ?? 0); i++) consos.push(id);
    onValider(consos);
  };
  return (
    <>
      <Text style={styles.modalSous}>Choisis {n} consommables de ton sac — {total}/{n}</Text>
      <View style={{ gap: 7, alignSelf: 'stretch' }}>
        {CONSOMMABLE_IDS.map((id) => {
          const d = CONSOMMABLES[id];
          const stock = consommables[id] ?? 0;
          const pris = choix[id] ?? 0;
          const plus = total < n && pris < stock;
          return (
            <View key={id} style={[styles.consoLigne, stock === 0 && { opacity: 0.45 }]}>
              <IconeEmoji emoji={d.emoji} taille={24} />
              <View style={{ flex: 1 }}>
                <Text style={styles.consoNom}>{d.nom}</Text>
                <Text style={styles.consoStock}>×{stock} en sac</Text>
              </View>
              {pris > 0 && (
                <Pressable style={styles.consoMoins} onPress={() => retirer(id)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Retirer un ${d.nom}`}>
                  <Text style={styles.consoMoinsTxt}>−</Text>
                </Pressable>
              )}
              <Text style={styles.consoPris}>{pris > 0 ? pris : ''}</Text>
              <Pressable
                style={[styles.consoPlus, !plus && { opacity: 0.35 }]}
                disabled={!plus}
                onPress={() => ajouter(id)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Ajouter un ${d.nom}`}
              >
                <Text style={styles.consoPlusTxt}>+</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <BoutonJeu
        titre={total === n ? 'Troquer' : `Encore ${n - total} à choisir`}
        disabled={total !== n}
        onPress={valider}
        style={{ alignSelf: 'stretch' }}
      />
      <Pressable onPress={onFermer} hitSlop={6}><Text style={styles.annuler}>Annuler</Text></Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  contenu: { padding: 18, gap: 14, paddingBottom: 34 },
  pitch: { fontFamily: F.t700, fontSize: 14.5, color: C.texte2, textAlign: 'center' },

  recu: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.vertPale, borderRadius: R.carte, paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: BORD.largeur, borderColor: '#D8EBC0', ...OMBRE,
  },
  recuTxt: { flex: 1, fontFamily: F.t800, fontSize: 13, color: C.vertFonce },
  recuFermer: { fontFamily: F.t800, fontSize: 13, color: C.texte3, paddingHorizontal: 4 },

  carte: { backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 12, borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE },
  carteTitreRang: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  carteTitre: { flex: 1, fontFamily: F.t800, fontSize: 16, color: C.texte },
  faitBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.vertPale, borderRadius: R.pill, paddingVertical: 3, paddingHorizontal: 9,
  },
  faitTxt: { fontFamily: F.t800, fontSize: 11, color: '#2E7D32' },

  echangeRang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  col: { alignItems: 'center', gap: 4, width: 120 },
  colLabel: { fontFamily: F.t700, fontSize: 11.5, color: C.texte3 },
  colNom: { fontFamily: F.t800, fontSize: 12.5, color: C.texte, textAlign: 'center' },
  colSous: { fontFamily: F.t600, fontSize: 10.5, color: C.texte3 },
  fleche: { fontFamily: F.titre, fontSize: 24, color: C.violetClair },
  neuf: { backgroundColor: C.vert, borderRadius: R.pill, paddingVertical: 2, paddingHorizontal: 8, marginTop: 1 },
  neufTxt: { fontFamily: F.t800, fontSize: 9.5, color: C.violetProfond },
  resBadge: {
    width: 62, height: 62, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.jaunePale, borderWidth: 2, borderColor: C.jaune,
  },

  detailRang: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailTxt: { flex: 1, fontFamily: F.t700, fontSize: 13.5, color: C.texte, lineHeight: 19 },
  manque: { fontFamily: F.t700, fontSize: 12, color: C.danger, textAlign: 'center' },
  aide: { fontFamily: F.t600, fontSize: 11, color: C.texte3, lineHeight: 15, textAlign: 'center' },

  modalFond: { flex: 1, backgroundColor: 'rgba(42,29,70,0.6)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  modalCarte: { backgroundColor: C.carte, borderRadius: 24, padding: 20, alignItems: 'center', gap: 12, alignSelf: 'stretch', borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE },
  modalTitre: { fontFamily: F.titre, fontSize: 20, color: C.violet },
  modalSous: { fontFamily: F.t700, fontSize: 13, color: C.texte2, textAlign: 'center' },
  // 🩹 26/07 : règle « une seule fonte par carte », sous le compteur de la modale
  modalAide: { fontFamily: F.t600, fontSize: 11, color: C.texte3, lineHeight: 15, textAlign: 'center' },
  annuler: { fontFamily: F.t700, fontSize: 13, color: C.texte3, paddingVertical: 4 },

  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', paddingVertical: 2 },
  choixCarte: {
    alignItems: 'center', gap: 3, width: 74, paddingVertical: 8, borderRadius: 16,
    borderWidth: 2, borderColor: 'transparent',
  },
  choixCarteActif: { borderColor: C.violet, backgroundColor: C.lavande },
  // 🩹 26/07 : case à cocher (état binaire) là où s'affichait le badge « ×N »
  choixCase: {
    position: 'absolute', top: 2, right: 3, zIndex: 2,
    width: 19, height: 19, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.carte, borderWidth: 2, borderColor: C.bord,
  },
  choixCaseActive: { backgroundColor: C.vert, borderColor: C.vert },
  choixNom: { fontFamily: F.t700, fontSize: 10.5, color: C.texte },

  consoLigne: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.fond, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10,
  },
  consoNom: { fontFamily: F.t800, fontSize: 13, color: C.texte },
  consoStock: { fontFamily: F.t600, fontSize: 11, color: C.texte3 },
  consoPris: { fontFamily: F.t800, fontSize: 14, color: C.violet, minWidth: 16, textAlign: 'center' },
  consoPlus: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.vert, alignItems: 'center', justifyContent: 'center' },
  consoPlusTxt: { fontFamily: F.t800, fontSize: 17, color: '#fff', marginTop: -2 },
  consoMoins: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.lavande, alignItems: 'center', justifyContent: 'center' },
  consoMoinsTxt: { fontFamily: F.t800, fontSize: 17, color: C.violet, marginTop: -2 },
});
