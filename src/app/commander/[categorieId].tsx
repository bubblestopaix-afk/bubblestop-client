// === Commander : personnalisation d'une boisson ===
// Saveur → format → sucre → température → toppings → suppléments → panier.
// Réutilise les règles de prix/portions du POS (catalogue.js).
import { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View, Text, ScrollView, Pressable, Switch, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// @ts-ignore — règles de prix partagées avec le POS (fonctions pures)
import {
  niveauxSucre,
  calculerPrix, ajouterTopping, incrementerTopping, totalPortions,
  PRIX_DOUBLE_PORTION, SUPPLEMENT_CHANTILLY, SUPPLEMENT_LAIT_AVOINE,
} from '@/data/catalogue';
import { useCatalogueCloud } from '@/data/catalogue-cloud';
import { ajouterLigne, getLigne, remplacerLigne } from '@/store/panier';
import { ajouterFavori, retirerFavori, favoriExistant, useFavoris } from '@/store/favoris';

const VIOLET = '#3A2A5E';
const VIOLET_PROFOND = '#2A1D46';
const VERT = '#A3C724';
const LAVANDE = '#EFE9F6';

// Affiche l'icône du catalogue ; les pictos SVG du POS n'existent pas ici → fallback
// (avec correspondances emoji pour les pictos connus)
const EMOJI_SVG: Record<string, string> = {
  'svg-bubble-tea-matcha': '🍵',
  'svg-peche': '🍑',
  'svg-framboise': '🫐',
  'svg-litchi': '🤍',
  'svg-passion': '🧡',
  'svg-grain-cafe': '☕',
  'svg-vanille': '🌼',
  'svg-brown-sugar': '🟤',
};
const icone = (i: string | undefined, fallback: string) =>
  i && !i.startsWith('svg-') ? i : (i && EMOJI_SVG[i]) || fallback;

// Libellé de portion : ½, 1, 1½, 2
const libPortion = (p: number) =>
  p === 0.5 ? '½' : p === 1 ? '1' : p === 1.5 ? '1½' : String(p);

export default function PersonnalisationScreen() {
  const { categorieId, ligneId } = useLocalSearchParams<{ categorieId: string; ligneId?: string }>();
  const { categories, toppings: tousToppings } = useCatalogueCloud();
  // any : le catalogue n'a pas de types stricts
  const cat: any = useMemo(
    () => categories.find((c: any) => c.id === categorieId),
    [categories, categorieId],
  );

  // Édition d'une ligne existante du panier : états pré-remplis
  const ligneEdit = useMemo(() => (ligneId ? getLigne(ligneId) : undefined), [ligneId]);

  const [saveurId, setSaveurId] = useState<string | null>(ligneEdit?.saveurId ?? null);
  const [format, setFormat] = useState<string>(ligneEdit?.format ?? cat?.formats?.[0] ?? 'M');
  const [sucre, setSucre] = useState(ligneEdit?.sucre ?? 'normal');
  const [temperature, setTemperature] = useState<'glace' | 'chaud'>(ligneEdit?.temperature ?? 'glace');
  const [selToppings, setSelToppings] = useState<Record<string, number>>(ligneEdit?.toppings ?? {});
  const [doublePortion, setDoublePortion] = useState(!!ligneEdit?.doublePortion);
  const [chantilly, setChantilly] = useState(!!ligneEdit?.chantilly);
  const [laitAvoine, setLaitAvoine] = useState(!!ligneEdit?.laitAvoine);
  const [quantite, setQuantite] = useState(ligneEdit?.quantite ?? 1);
  const [glacons, setGlacons] = useState<'avec' | 'peu' | 'sans'>(ligneEdit?.glacons ?? 'avec');
  const [note, setNote] = useState(ligneEdit?.note ?? '');

  useFavoris(); // re-render quand les favoris changent (état du cœur)

  if (!cat) return null;

  const saveur = cat.saveurs.find((s: any) => s.id === saveurId) ?? null;
  // Pas de toppings / glaçons quand le catalogue le dit (mochi, milkshake…) — comme en caisse
  const sansToppings = !!cat.sansToppings || cat.id === 'mochi-glace';
  const sansGlacons = !!cat.sansGlacons || cat.id === 'mochi-glace';
  const froidForce = cat.froidUniquement || saveur?.froid;

  const prix = calculerPrix({
    categorie: cat, saveur, format,
    toppings: selToppings, chantilly, laitAvoine,
  });

  const tapTopping = (id: string) => {
    setSelToppings((cur) =>
      cur[id] ? incrementerTopping(cur, id, doublePortion) : ajouterTopping(cur, id, doublePortion));
  };

  const valider = () => {
    if (!saveur) return;
    const data = {
      categorieId: cat.id,
      saveurId: saveur.id,
      format,
      sucre: cat.sansChoixSucre ? null : sucre,
      temperature: froidForce ? 'glace' : temperature,
      glacons: ((froidForce || temperature === 'glace') && !sansGlacons) ? glacons : undefined,
      note: note.trim() || undefined,
      toppings: selToppings,
      chantilly, laitAvoine, doublePortion,
      quantite,
      prixUnitaire: prix,
    };
    if (ligneEdit) remplacerLigne(ligneEdit.id, data); // édition → remplace
    else ajouterLigne(data);
    router.back();
  };

  // Config courante au format favori (sans quantité/prix)
  const configFavori = saveur ? {
    categorieId: cat.id,
    saveurId: saveur.id,
    format,
    sucre: cat.sansChoixSucre ? null : sucre,
    temperature: (froidForce ? 'glace' : temperature) as 'glace' | 'chaud',
    glacons: ((froidForce || temperature === 'glace') && !sansGlacons) ? glacons : undefined,
    toppings: selToppings,
    chantilly, laitAvoine, doublePortion,
  } : null;
  const dejaFavori = configFavori ? favoriExistant(configFavori) : undefined;

  const basculerFavori = () => {
    if (!configFavori || !saveur) return;
    if (dejaFavori) retirerFavori(dejaFavori.id);
    else ajouterFavori({ ...configFavori, nom: `${cat.nom} ${saveur.nom} ${format}` });
  };

  return (
    <View style={styles.fond}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.contenu}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.retour}>‹ Retour</Text>
          </Pressable>
          <Text style={styles.titre}>{cat.emoji} {cat.nom}</Text>

          {/* === Saveur === */}
          <Text style={styles.section}>Saveur</Text>
          <View style={styles.grille}>
            {cat.saveurs.map((s: any) => (
              <Pressable
                key={s.id}
                style={[
                  styles.puce, { backgroundColor: s.couleur },
                  saveurId === s.id && styles.puceActive,
                  s.horsStock && styles.puceOff,
                ]}
                disabled={!!s.horsStock}
                onPress={() => setSaveurId(s.id)}>
                <Text style={styles.puceTexte}>
                  {icone(s.icone, cat.emoji)} {s.nom}{s.reco ? ' ⭐' : ''}
                  {s.supplement ? ` (+${s.supplement.toFixed(2).replace('.', ',')} €)` : ''}
                  {s.horsStock ? ' — épuisé' : ''}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* === Format === */}
          {cat.formats.length > 1 && (
            <>
              <Text style={styles.section}>Format</Text>
              <View style={styles.ligne}>
                {cat.formats.map((f: string) => (
                  <Pressable
                    key={f}
                    style={[styles.choix, format === f && styles.choixActif]}
                    onPress={() => setFormat(f)}>
                    <Text style={[styles.choixTexte, format === f && styles.choixTexteActif]}>
                      {f} — {cat.prix[f].toFixed(2).replace('.', ',')} €
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* === Sucre === */}
          {!cat.sansChoixSucre && (
            <>
              <Text style={styles.section}>Sucre</Text>
              <View style={styles.ligne}>
                {niveauxSucre.map((n: any) => (
                  <Pressable
                    key={n.id}
                    style={[styles.choix, sucre === n.id && styles.choixActif]}
                    onPress={() => setSucre(n.id)}>
                    <Text style={[styles.choixTexte, sucre === n.id && styles.choixTexteActif]}>{n.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* === Température === */}
          {!froidForce && (
            <>
              <Text style={styles.section}>Température</Text>
              <View style={styles.ligne}>
                {(['glace', 'chaud'] as const).map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.choix, temperature === t && styles.choixActif]}
                    onPress={() => setTemperature(t)}>
                    <Text style={[styles.choixTexte, temperature === t && styles.choixTexteActif]}>
                      {t === 'glace' ? '🧊 Glacé' : '♨️ Chaud'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* === Toppings === */}
          {!sansToppings && (
            <>
              <Text style={styles.section}>
                Toppings {cat.toppingPayantUnit
                  ? '(0,50 € la portion)'
                  : `(1 portion offerte — ${totalPortions(selToppings)}/${doublePortion ? 2 : 1})`}
              </Text>
              {!cat.toppingPayantUnit && (
                <View style={styles.ligneToggle}>
                  <Text style={styles.choixTexte}>
                    Double portion (+{PRIX_DOUBLE_PORTION.toFixed(2).replace('.', ',')} €)
                  </Text>
                  <Switch
                    value={doublePortion}
                    onValueChange={(v) => { setDoublePortion(v); setSelToppings({}); }}
                    trackColor={{ false: '#ffffff33', true: VERT }}
                    thumbColor="#fff"
                  />
                </View>
              )}
              <View style={styles.grille}>
                {tousToppings.map((t: any) => {
                  const portion = selToppings[t.id];
                  return (
                    <Pressable
                      key={t.id}
                      style={[
                        styles.puce, { backgroundColor: t.couleur },
                        !!portion && styles.puceActive,
                        t.horsStock && styles.puceOff,
                      ]}
                      disabled={!!t.horsStock}
                      onPress={() => tapTopping(t.id)}>
                      <Text style={styles.puceTexte}>
                        {icone(t.icone, '🧋')} {t.nom}{portion ? `  ×${libPortion(portion)}` : ''}
                        {t.horsStock ? ' — épuisé' : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* === Suppléments === */}
          {(cat.optionChantilly || cat.optionLaitAvoine) && (
            <>
              <Text style={styles.section}>Suppléments</Text>
              <View style={styles.ligne}>
                {cat.optionChantilly && (
                  <Pressable
                    style={[styles.choix, chantilly && styles.choixActif]}
                    onPress={() => setChantilly(!chantilly)}>
                    <Text style={[styles.choixTexte, chantilly && styles.choixTexteActif]}>
                      Chantilly (+{SUPPLEMENT_CHANTILLY.toFixed(2).replace('.', ',')} €)
                    </Text>
                  </Pressable>
                )}
                {cat.optionLaitAvoine && (
                  <Pressable
                    style={[styles.choix, laitAvoine && styles.choixActif]}
                    onPress={() => setLaitAvoine(!laitAvoine)}>
                    <Text style={[styles.choixTexte, laitAvoine && styles.choixTexteActif]}>
                      Lait d'avoine (+{SUPPLEMENT_LAIT_AVOINE.toFixed(2).replace('.', ',')} €)
                    </Text>
                  </Pressable>
                )}
              </View>
            </>
          )}
          {/* === Glaçons (boissons froides, sauf catégories sans glaçons) === */}
          {(froidForce || temperature === 'glace') && !sansGlacons && (
            <>
              <Text style={styles.section}>Glaçons</Text>
              <View style={styles.ligne}>
                {([['avec', '🧊 Avec'], ['peu', 'Peu'], ['sans', 'Sans']] as const).map(([id, label]) => (
                  <Pressable
                    key={id}
                    style={[styles.choix, glacons === id && styles.choixActif]}
                    onPress={() => setGlacons(id)}>
                    <Text style={[styles.choixTexte, glacons === id && styles.choixTexteActif]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* === Note pour la cuisine === */}
          <Text style={styles.section}>Une précision ?</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Ex : peu de sucre, allergie…"
            placeholderTextColor="#9a8fb5"
            maxLength={60}
          />

          {/* === Quantité === */}
          <Text style={styles.section}>Quantité</Text>
          <View style={styles.stepper}>
            <Pressable style={styles.stepperBtn} onPress={() => setQuantite(Math.max(1, quantite - 1))}>
              <Text style={styles.stepperBtnTexte}>−</Text>
            </Pressable>
            <Text style={styles.stepperNb}>{quantite}</Text>
            <Pressable style={styles.stepperBtn} onPress={() => setQuantite(Math.min(10, quantite + 1))}>
              <Text style={styles.stepperBtnTexte}>+</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* Cœur favori (au-dessus du bouton ajout) */}
        {saveur && (
          <Pressable style={styles.btnCoeur} onPress={basculerFavori}>
            <Text style={{ fontSize: 24 }}>{dejaFavori ? '❤️' : '🤍'}</Text>
          </Pressable>
        )}

        {/* Bouton ajout */}
        <Pressable
          style={[styles.btnAjout, !saveur && styles.btnOff]}
          disabled={!saveur}
          onPress={valider}>
          <Text style={styles.btnAjoutTexte}>
            {saveur
              ? `${ligneEdit ? 'Modifier' : 'Ajouter'} ${quantite > 1 ? `×${quantite} ` : ''}— ${(prix * quantite).toFixed(2).replace('.', ',')} €`
              : 'Choisis une saveur'}
          </Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: VIOLET },
  safe: { flex: 1 },
  contenu: { padding: 20, paddingBottom: 110 },
  retour: { color: LAVANDE, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  titre: { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 4 },
  section: { fontSize: 17, fontWeight: '800', color: VERT, marginTop: 18, marginBottom: 10 },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ligne: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  puce: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, opacity: 0.92 },
  puceActive: { borderWidth: 3, borderColor: VERT, opacity: 1 },
  puceOff: { opacity: 0.35 },
  puceTexte: { fontWeight: '700', color: '#1a1325', fontSize: 14 },
  choix: { backgroundColor: '#ffffff22', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  ligneToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff22', borderRadius: 12, padding: 12, marginBottom: 10,
  },
  choixActif: { backgroundColor: VERT },
  choixTexte: { color: LAVANDE, fontWeight: '700', fontSize: 14 },
  choixTexteActif: { color: VIOLET_PROFOND },
  noteInput: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    fontSize: 15, fontWeight: '600', color: VIOLET_PROFOND,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 18, alignSelf: 'flex-start' },
  stepperBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#ffffff22',
    alignItems: 'center', justifyContent: 'center',
  },
  stepperBtnTexte: { color: '#fff', fontSize: 24, fontWeight: '900' },
  stepperNb: { color: '#fff', fontSize: 20, fontWeight: '900', minWidth: 24, textAlign: 'center' },
  btnAjout: {
    position: 'absolute', left: 16, right: 16, bottom: 12,
    backgroundColor: VERT, borderRadius: 16, padding: 18, alignItems: 'center',
  },
  btnCoeur: {
    position: 'absolute', right: 16, bottom: 84,
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#ffffff22',
    alignItems: 'center', justifyContent: 'center',
  },
  btnOff: { opacity: 0.45 },
  btnAjoutTexte: { fontWeight: '900', fontSize: 17, color: VIOLET_PROFOND },
});
