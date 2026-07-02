// === Fiche produit immersive : photo, saveurs, options, ajout au panier ===
// Saveur → format → sucre → température → toppings → suppléments → panier.
// Réutilise les règles de prix/portions du POS (catalogue.js).
import { useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View, Text, ScrollView, Pressable, Switch, TextInput, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// @ts-ignore — règles de prix partagées avec le POS (fonctions pures)
import {
  niveauxSucre,
  calculerPrix, ajouterTopping, incrementerTopping, totalPortions,
  PRIX_DOUBLE_PORTION, SUPPLEMENT_CHANTILLY, SUPPLEMENT_LAIT_AVOINE,
} from '@/data/catalogue';
import { useCatalogueCloud } from '@/data/catalogue-cloud';
import { photoCategorie } from '@/data/photos-categories';
import { ajouterLigne, getLigne, remplacerLigne } from '@/store/panier';
import { peutCommander } from '@/lib/eligibilite';
import { C, F, R, OMBRE } from '@/constants/charte';
import { BoutonRetour, Chip, Stepper } from '@/components/ui-kit';

// Pastille de couleur pour les saveurs/toppings (les pictos SVG du POS n'existent pas ici)
const libPortion = (p: number) =>
  p === 0.5 ? '½' : p === 1 ? '1' : p === 1.5 ? '1½' : String(p);

export default function PersonnalisationScreen() {
  const insets = useSafeAreaInsets();
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

  // Verrou commande : l'accueil pousse directement ici (raccourcis photos) sans passer
  // par l'écran Commander → on re-vérifie l'éligibilité et on renvoie vers le gate sinon.
  useEffect(() => {
    peutCommander().then((ok) => { if (!ok) router.replace('/commander' as any); });
  }, []);

  if (!cat) return null;

  const saveur = cat.saveurs.find((s: any) => s.id === saveurId) ?? null;
  // Pas de toppings / glaçons quand le catalogue le dit (mochi, milkshake…) — comme en caisse
  const sansToppings = !!cat.sansToppings || cat.id === 'mochi-glace';
  const sansGlacons = !!cat.sansGlacons || cat.id === 'mochi-glace';
  const froidForce = cat.froidUniquement || saveur?.froid;
  const photo = photoCategorie(cat);

  const prix = calculerPrix({
    categorie: cat, saveur, format,
    toppings: selToppings, chantilly, laitAvoine,
  });

  const tapTopping = (id: string) => {
    const t = tousToppings.find((x: any) => x.id === id);
    setSelToppings((cur) => {
      let next = cur[id] ? incrementerTopping(cur, id, doublePortion) : ajouterTopping(cur, id, doublePortion);
      // ×2 d'un topping coupé en caisse (doublePortionBloquee) → plafonné à 1 portion (cycle ½ → 1 → vide)
      if (t?.doublePortionBloquee && (next[id] ?? 0) > 1) {
        next = { ...next };
        delete next[id];
      }
      return next;
    });
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
    } as const;
    if (ligneEdit) remplacerLigne(ligneEdit.id, data as any); // édition → remplace
    else ajouterLigne(data as any);
    router.back();
  };

  return (
    <View style={styles.fond}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        {/* === En-tête immersif : photo de la catégorie === */}
        <View style={styles.hero}>
          {photo
            ? <Image source={photo} style={styles.heroPhoto} />
            : <View style={[styles.heroPhoto, styles.heroEmoji]}><Text style={{ fontSize: 72 }}>{cat.emoji}</Text></View>}
          <View style={[styles.heroBarre, { top: insets.top + 10 }]}>
            <BoutonRetour onPress={() => router.back()} surPhoto />
          </View>
        </View>

        <View style={styles.contenu}>
          <Text style={styles.titre}>{cat.nom}</Text>
          {!!cat.sousTitre && <Text style={styles.sousTitre}>{cat.sousTitre}</Text>}

          {/* === Saveur === */}
          <Text style={styles.section}>Saveur</Text>
          <View style={styles.grille}>
            {cat.saveurs.map((s: any) => (
              <Chip
                key={s.id}
                label={`${s.nom}${s.supplement ? ` +${s.supplement.toFixed(2).replace('.', ',')} €` : ''}${s.horsStock ? ' — épuisé' : ''}`}
                pastille={s.couleur}
                actif={saveurId === s.id}
                disabled={!!s.horsStock}
                onPress={() => setSaveurId(s.id)}
              />
            ))}
          </View>

          {/* === Format === */}
          {cat.formats.length > 1 && (
            <>
              <Text style={styles.section}>Format</Text>
              <View style={styles.ligne}>
                {cat.formats.map((f: string) => (
                  <Chip
                    key={f}
                    label={`${f} — ${cat.prix[f].toFixed(2).replace('.', ',')} €`}
                    actif={format === f}
                    onPress={() => setFormat(f)}
                  />
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
                  <Chip key={n.id} label={n.label} actif={sucre === n.id} onPress={() => setSucre(n.id)} />
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
                  <Chip
                    key={t}
                    label={t === 'glace' ? '🧊 Glacé' : '♨️ Chaud'}
                    actif={temperature === t}
                    onPress={() => setTemperature(t)}
                  />
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
                <View style={styles.toggleCarte}>
                  <Text style={styles.toggleTexte}>
                    Double portion (+{PRIX_DOUBLE_PORTION.toFixed(2).replace('.', ',')} €)
                  </Text>
                  <Switch
                    value={doublePortion}
                    onValueChange={(v) => { setDoublePortion(v); setSelToppings({}); }}
                    trackColor={{ false: C.bord, true: C.vert }}
                    thumbColor="#fff"
                  />
                </View>
              )}
              <View style={styles.grille}>
                {tousToppings.map((t: any) => {
                  const portion = selToppings[t.id];
                  return (
                    <Chip
                      key={t.id}
                      label={`${t.nom}${portion ? ` ×${libPortion(portion)}` : ''}${t.horsStock ? ' — épuisé' : t.doublePortionBloquee ? ' (×2 indispo)' : ''}`}
                      pastille={t.couleur}
                      actif={!!portion}
                      disabled={!!t.horsStock}
                      onPress={() => tapTopping(t.id)}
                    />
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
                  <Chip
                    label={`Chantilly +${SUPPLEMENT_CHANTILLY.toFixed(2).replace('.', ',')} €`}
                    actif={chantilly}
                    onPress={() => setChantilly(!chantilly)}
                  />
                )}
                {cat.optionLaitAvoine && (
                  <Chip
                    label={`Lait d'avoine +${SUPPLEMENT_LAIT_AVOINE.toFixed(2).replace('.', ',')} €`}
                    actif={laitAvoine}
                    onPress={() => setLaitAvoine(!laitAvoine)}
                  />
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
                  <Chip key={id} label={label} actif={glacons === id} onPress={() => setGlacons(id)} />
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
            placeholderTextColor={C.texte3}
            maxLength={60}
          />
        </View>
      </ScrollView>

      {/* === Barre du bas : quantité + ajout === */}
      <View style={[styles.barreBas, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Stepper
          valeur={quantite}
          onMoins={() => setQuantite(Math.max(1, quantite - 1))}
          onPlus={() => setQuantite(Math.min(10, quantite + 1))}
        />
        <Pressable
          style={[styles.btnAjout, !saveur && { opacity: 0.45 }]}
          disabled={!saveur}
          onPress={valider}>
          <Text style={styles.btnAjoutTexte}>
            {saveur
              ? `${ligneEdit ? 'Modifier' : 'Ajouter'} · ${(prix * quantite).toFixed(2).replace('.', ',')} €`
              : 'Choisis une saveur'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },

  // En-tête photo
  hero: { width: '100%', height: 210 },
  heroPhoto: { width: '100%', height: '100%', backgroundColor: C.violet },
  heroEmoji: { alignItems: 'center', justifyContent: 'center' },
  heroBarre: {
    position: 'absolute', left: 14, right: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },

  contenu: {
    backgroundColor: C.fond, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    marginTop: -24, padding: 20, paddingTop: 22,
  },
  titre: { fontFamily: F.titre, fontSize: 25, color: C.violet },
  sousTitre: { fontFamily: F.t600, fontSize: 14, color: C.texte2, marginTop: 2 },
  section: { fontFamily: F.titre, fontSize: 16, color: C.violet, marginTop: 20, marginBottom: 10 },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ligne: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  toggleCarte: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.carte, borderRadius: 14, padding: 14, marginBottom: 10, ...OMBRE,
  },
  toggleTexte: { fontFamily: F.t700, fontSize: 14, color: C.texte },

  noteInput: {
    backgroundColor: C.carte, borderRadius: 12, borderWidth: 1.5, borderColor: C.bord,
    padding: 14, fontFamily: F.t600, fontSize: 15, color: C.texte,
  },

  // Barre du bas (sticky)
  barreBas: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: C.carte, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingTop: 12, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: '#3A2A5E', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 10,
  },
  btnAjout: {
    flex: 1, backgroundColor: C.vert, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
  },
  btnAjoutTexte: { fontFamily: F.t800, fontSize: 16, color: C.violetProfond },
});
