// === Commander : grille de catégories en vignettes photos (style app food) ===
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View, Text, ScrollView, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCatalogueCloud, trouverCategorieCloud, trouverSaveurCloud } from '@/data/catalogue-cloud';
import { photoCategorie } from '@/data/photos-categories';
import { usePanier, totalPanier, ajouterLigne, viderPanier } from '@/store/panier';
import { MAGASINS, setMagasin, getMagasin, MagasinId } from '@/store/magasin';
import { useFavoris, retirerFavori, Favori } from '@/store/favoris';
// @ts-ignore — règles de prix partagées avec le POS
import { calculerPrix } from '@/data/catalogue';
import { supabase } from '@/lib/supabase';
import { C, F, R, OMBRE } from '@/constants/charte';
import { BoutonPrimaire } from '@/components/ui-kit';

// Libellés courts des statuts pour la bannière de suivi
const STATUTS_BANNIERE: Record<string, string> = {
  en_attente: 'Commande n°%n reçue',
  en_preparation: 'Commande n°%n en préparation',
  prete: 'Commande n°%n prête — viens la chercher !',
};

export default function CommanderScreen() {
  const insets = useSafeAreaInsets();
  const { categories } = useCatalogueCloud(); // carte cloud du magasin choisi
  const lignes = usePanier();

  // === Verrou commande : carte de fidélité COMPLÉTÉE au moins une fois ===
  // La commande en ligne n'est ouverte qu'aux clients ayant déjà rempli une carte
  // entière (≥ 1 carte complétée dans leur historique). L'admin n'est pas soumis à ça.
  // Le magasin du client = celui de sa 1ère commande : il ne voit pas les autres.
  const [magasinInscription, setMagasinInscription] = useState<string | null>(null);
  const [carteLiee, setCarteLiee] = useState<boolean | null>(null); // null = chargement ; ici = ÉLIGIBLE à commander

  useEffect(() => {
    let actif = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (actif) setCarteLiee(false); return; }
      const { data } = await supabase.from('profils').select('magasin,numero_fidelite,est_admin').eq('id', session.user.id).maybeSingle();
      if (!actif) return;
      // ADMIN : accès libre (tests / gestion), magasin non verrouillé.
      let eligible = !!data?.est_admin;
      if (!eligible && data?.numero_fidelite) {
        const { data: f } = await supabase.from('fidelite_cloud')
          .select('cartes_completees,cadeaux').eq('telephone', data.numero_fidelite).maybeSingle();
        // Éligible si au moins 1 carte complétée à vie (ou un cadeau dispo, qui en est la preuve)
        eligible = (Number(f?.cartes_completees) || 0) >= 1 || (Number(f?.cadeaux) || 0) >= 1;
      }
      setCarteLiee(eligible);
      if (!data?.magasin || data?.est_admin) return;
      setMagasinInscription(data.magasin);
      // Force le magasin de l'app sur celui du client (verrouillé)
      if (getMagasin() !== data.magasin) { setMagasin(data.magasin as MagasinId); viderPanier(); }
    })();
    return () => { actif = false; };
  }, []);
  const favoris = useFavoris();
  const nbArticles = lignes.reduce((s, l) => s + l.quantite, 0);

  // Ajoute un favori au panier, au prix actuel de la carte
  const ajouterFavoriAuPanier = (f: Favori) => {
    const categorie = trouverCategorieCloud(f.categorieId);
    const saveur = trouverSaveurCloud(f.categorieId, f.saveurId);
    if (!categorie || !saveur || categorie.horsStock || saveur.horsStock) return;
    const prix = calculerPrix({
      categorie, saveur, format: f.format,
      toppings: f.toppings || {}, chantilly: f.chantilly, laitAvoine: f.laitAvoine,
    });
    ajouterLigne({
      categorieId: f.categorieId, saveurId: f.saveurId, format: f.format,
      sucre: f.sucre, temperature: f.temperature, glacons: f.glacons,
      toppings: f.toppings || {}, chantilly: f.chantilly, laitAvoine: f.laitAvoine,
      doublePortion: f.doublePortion, quantite: 1, prixUnitaire: prix,
    });
  };

  // Commande active du client (bannière de suivi), rafraîchie toutes les 15 s
  const [commandeActive, setCommandeActive] = useState<any>(null);
  useEffect(() => {
    let actif = true;
    const verifier = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { if (actif) setCommandeActive(null); return; }
        const { data } = await supabase
          .from('commandes')
          .select('numero, statut')
          .in('statut', ['en_attente', 'en_preparation', 'prete'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (actif) setCommandeActive(data ?? null);
      } catch (_) { /* silencieux */ }
    };
    verifier();
    const t = setInterval(verifier, 15000);
    return () => { actif = false; clearInterval(t); };
  }, []);

  // === Pas encore client en boutique → la commande en ligne est bloquée ===
  if (carteLiee === false) {
    return (
      <View style={styles.fond}>
        <ScrollView contentContainerStyle={[styles.contenu, { paddingTop: insets.top + 18, flexGrow: 1, justifyContent: 'center' }]}>
          <View style={styles.gateCarte}>
            <Text style={styles.gateEmoji}>🧋</Text>
            <Text style={styles.gateTitre}>La commande en ligne se débloque avec la fidélité</Text>
            <Text style={styles.gateTexte}>
              Pour commander depuis l'appli, il faut avoir complété au moins une carte de fidélité entière (9 tampons) en boutique.
            </Text>
            <Text style={styles.gateTexte}>
              Continue à cumuler tes tampons en caisse — dès ta première carte complète, la commande en ligne s'ouvre pour toi !
            </Text>
            <BoutonPrimaire titre="Voir ma fidélité" onPress={() => router.push('/explore' as any)} />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.fond}>
      <ScrollView contentContainerStyle={[styles.contenu, { paddingTop: insets.top + 18 }]}>
        <View style={styles.entete}>
          <Text style={styles.titre}>Commander</Text>
          <Pressable onPress={() => router.push('/commander/mes-commandes' as any)} hitSlop={8}>
            <Text style={styles.lienSuivi}>Mes commandes ›</Text>
          </Pressable>
        </View>

        {/* Magasin du client (celui de sa 1ère commande) — les autres ne sont pas proposés */}
        {magasinInscription && (
          <View style={styles.magasinChip}>
            <Text style={styles.magasinTexte}>
              📍 {MAGASINS.find((m) => m.id === magasinInscription)?.nom || magasinInscription}
            </Text>
          </View>
        )}

        {/* Bannière de suivi : commande en cours */}
        {commandeActive && (
          <Pressable
            style={[styles.banniere, commandeActive.statut === 'prete' && styles.bannierePrete]}
            onPress={() => router.push('/commander/mes-commandes' as any)}>
            <Text style={[styles.banniereTexte, commandeActive.statut === 'prete' && { color: C.violetProfond }]}>
              {(STATUTS_BANNIERE[commandeActive.statut] || commandeActive.statut)
                .replace('%n', String(commandeActive.numero))}
            </Text>
            <Text style={[styles.banniereLien, commandeActive.statut === 'prete' && { color: C.violetProfond }]}>
              Suivre ›
            </Text>
          </Pressable>
        )}

        {/* === Mes favoris : ajout en 1 tap === */}
        {favoris.length > 0 && (
          <>
            <Text style={styles.section}>Mes favoris</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favRail}>
              {favoris.map((f) => {
                const indispo = !trouverSaveurCloud(f.categorieId, f.saveurId)
                  || trouverCategorieCloud(f.categorieId)?.horsStock
                  || trouverSaveurCloud(f.categorieId, f.saveurId)?.horsStock;
                return (
                  <Pressable
                    key={f.id}
                    style={[styles.favCarte, indispo && { opacity: 0.45 }]}
                    disabled={!!indispo}
                    onPress={() => ajouterFavoriAuPanier(f)}
                    onLongPress={() => retirerFavori(f.id)}>
                    <Text style={styles.favPlus}>+</Text>
                    <Text style={styles.favNom} numberOfLines={2}>{f.nom}{indispo ? ' (indispo)' : ''}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={styles.favAide}>Tap = ajouter au panier · appui long = retirer le favori</Text>
          </>
        )}

        {/* === Grille des catégories (2 colonnes, vignettes photos) === */}
        <Text style={styles.section}>Nos boissons</Text>
        <View style={styles.grille}>
          {categories.map((cat: any) => {
            const photo = photoCategorie(cat);
            return (
              <Pressable
                key={cat.id}
                style={[styles.tuile, cat.horsStock && { opacity: 0.5 }]}
                disabled={!!cat.horsStock}
                onPress={() => router.push(`/commander/${cat.id}` as any)}>
                {photo
                  ? <Image source={photo} style={styles.tuilePhoto} />
                  : (
                    <View style={[styles.tuilePhoto, styles.tuileEmoji]}>
                      <Text style={{ fontSize: 44 }}>{cat.emoji}</Text>
                    </View>
                  )}
                <View style={styles.tuileInfos}>
                  <Text style={styles.tuileNom} numberOfLines={1}>{cat.nom}</Text>
                  <Text style={styles.tuileSous} numberOfLines={2}>
                    {cat.horsStock ? 'Indisponible aujourd\'hui' : cat.sousTitre}
                  </Text>
                  {!cat.horsStock && (
                    <Text style={styles.tuilePrix}>
                      dès {Math.min(...(Object.values(cat.prix) as number[])).toFixed(2).replace('.', ',')} €
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Bandeau panier flottant */}
      {nbArticles > 0 && (
        <Pressable style={styles.bandeauPanier} onPress={() => router.push('/commander/panier' as any)}>
          <View style={styles.bandeauNb}><Text style={styles.bandeauNbTxt}>{nbArticles}</Text></View>
          <Text style={styles.bandeauTexte}>Voir le panier</Text>
          <Text style={styles.bandeauTotal}>{totalPanier().toFixed(2).replace('.', ',')} €</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  contenu: { padding: 18, gap: 12, paddingBottom: 110 },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titre: { fontFamily: F.titre, fontSize: 26, color: C.violet },
  lienSuivi: { fontFamily: F.t700, fontSize: 14, color: C.violetClair },

  magasinChip: {
    alignSelf: 'flex-start', backgroundColor: C.lavande,
    borderRadius: R.pill, paddingVertical: 7, paddingHorizontal: 13,
  },
  magasinTexte: { fontFamily: F.t700, fontSize: 13, color: C.violetProfond },

  // Disclaimer no-show
  disclaimer: { backgroundColor: '#FFF3E0', borderRadius: 14, borderWidth: 1, borderColor: '#F5C16C', padding: 12 },
  disclaimerTxt: { fontFamily: F.t600, fontSize: 12.5, color: '#A06A00', lineHeight: 18 },

  // Écran « première commande en boutique » (commande en ligne bloquée)
  gateCarte: { backgroundColor: C.carte, borderRadius: R.carte, padding: 24, gap: 12, ...OMBRE },
  gateEmoji: { fontSize: 40, textAlign: 'center' },
  gateTitre: { fontFamily: F.t800, fontSize: 19, color: C.texte, textAlign: 'center' },
  gateTexte: { fontFamily: F.t400, fontSize: 14.5, color: C.texte2, lineHeight: 21 },

  banniere: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.carte, borderRadius: 16, padding: 15,
    borderWidth: 1.5, borderColor: C.jaune, ...OMBRE,
  },
  bannierePrete: { borderColor: C.vert, backgroundColor: C.vertPale },
  banniereTexte: { flex: 1, fontFamily: F.t700, fontSize: 14, color: C.texte },
  banniereLien: { fontFamily: F.t800, fontSize: 13.5, color: C.violetClair },

  section: { fontFamily: F.titre, fontSize: 17, color: C.violet, marginTop: 8 },

  favRail: { gap: 10, paddingVertical: 4, paddingRight: 6 },
  favCarte: { backgroundColor: C.carte, borderRadius: 16, padding: 14, width: 150, gap: 4, ...OMBRE },
  favPlus: { fontFamily: F.t800, fontSize: 18, color: C.vertFonce },
  favNom: { fontFamily: F.t700, fontSize: 13, color: C.texte, lineHeight: 18 },
  favAide: { fontFamily: F.t400, fontSize: 11.5, color: C.texte3, marginTop: -4 },

  // Grille 2 colonnes
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tuile: {
    width: '48%', flexGrow: 1, backgroundColor: C.carte,
    borderRadius: R.carte, overflow: 'hidden', ...OMBRE,
  },
  tuilePhoto: { width: '100%', height: 110, backgroundColor: C.lavande },
  tuileEmoji: { alignItems: 'center', justifyContent: 'center' },
  tuileInfos: { padding: 12, gap: 3 },
  tuileNom: { fontFamily: F.t800, fontSize: 15, color: C.texte },
  tuileSous: { fontFamily: F.t400, fontSize: 12, color: C.texte2, lineHeight: 16 },
  tuilePrix: { fontFamily: F.t700, fontSize: 12.5, color: C.violetClair, marginTop: 3 },

  // Bandeau panier flottant
  bandeauPanier: {
    position: 'absolute', left: 16, right: 16, bottom: 14,
    backgroundColor: C.vert, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#3A2A5E', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  bandeauNb: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: C.violetProfond,
    alignItems: 'center', justifyContent: 'center',
  },
  bandeauNbTxt: { fontFamily: F.t800, fontSize: 13, color: '#fff' },
  bandeauTexte: { flex: 1, fontFamily: F.t800, fontSize: 16, color: C.violetProfond },
  bandeauTotal: { fontFamily: F.t800, fontSize: 16, color: C.violetProfond },
});
