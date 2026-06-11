// === Commander : choix de la catégorie ===
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View, Text, ScrollView, Pressable, Image, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCatalogueCloud, trouverCategorieCloud, trouverSaveurCloud } from '@/data/catalogue-cloud';
import { usePanier, totalPanier, ajouterLigne, viderPanier } from '@/store/panier';
import { MAGASINS, useMagasin, setMagasin, getMagasin, MagasinId } from '@/store/magasin';
import { useFavoris, retirerFavori, Favori } from '@/store/favoris';
// @ts-ignore — règles de prix partagées avec le POS
import { calculerPrix } from '@/data/catalogue';
import { supabase } from '@/lib/supabase';

// Photos des catégories (reprises du POS) — require statique exigé par Metro
const PHOTOS: Record<string, any> = {
  'tea.webp': require('@/assets/images/photos/tea.webp'),
  'milktea.webp': require('@/assets/images/photos/milktea.webp'),
  'trad.webp': require('@/assets/images/photos/trad.webp'),
  'milkshake.webp': require('@/assets/images/photos/milkshake.webp'),
  'match.webp': require('@/assets/images/photos/match.webp'),
  'citronnade.webp': require('@/assets/images/photos/citronnade.webp'),
};
// Retrouve la photo d'une catégorie depuis son chemin POS (/img/photos/tea.webp)
function photoCategorie(cat: any) {
  const chemin = cat.photo || cat.photos?.[0];
  if (!chemin) return null;
  return PHOTOS[String(chemin).split('/').pop() as string] ?? null;
}

// Libellés courts des statuts pour la bannière de suivi
const STATUTS_BANNIERE: Record<string, string> = {
  en_attente: '🕐 Commande n°%n reçue',
  en_preparation: '👩‍🍳 Commande n°%n en préparation',
  prete: '🛍️ Commande n°%n prête — viens la chercher !',
};

const VIOLET = '#3A2A5E';
const VIOLET_PROFOND = '#2A1D46';
const VERT = '#A3C724';
const LAVANDE = '#EFE9F6';

export default function CommanderScreen() {
  const magasin = useMagasin();
  const { categories } = useCatalogueCloud(); // carte cloud du magasin choisi
  const lignes = usePanier();

  // === Verrou « 1ère commande en boutique » ===
  // La commande en ligne n'est possible qu'une fois la carte de fidélité LIÉE
  // (la carte n'existe que si une première commande a été faite en caisse).
  // Le magasin du client = celui de sa 1ère commande : il ne voit pas les autres.
  const [magasinInscription, setMagasinInscription] = useState<string | null>(null);
  const [carteLiee, setCarteLiee] = useState<boolean | null>(null); // null = chargement

  useEffect(() => {
    let actif = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (actif) setCarteLiee(false); return; }
      const { data } = await supabase.from('profils').select('magasin,numero_fidelite').eq('id', session.user.id).maybeSingle();
      if (!actif) return;
      setCarteLiee(!!data?.numero_fidelite);
      if (!data?.magasin) return;
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
      categorie, saveur,
      format: f.format,
      toppings: f.toppings || {},
      chantilly: f.chantilly,
      laitAvoine: f.laitAvoine,
    });
    ajouterLigne({
      categorieId: f.categorieId,
      saveurId: f.saveurId,
      format: f.format,
      sucre: f.sucre,
      temperature: f.temperature,
      glacons: f.glacons,
      toppings: f.toppings || {},
      chantilly: f.chantilly,
      laitAvoine: f.laitAvoine,
      doublePortion: f.doublePortion,
      quantite: 1,
      prixUnitaire: prix,
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
        <SafeAreaView style={styles.safe}>
          <ScrollView contentContainerStyle={[styles.contenu, { flexGrow: 1, justifyContent: 'center' }]}>
            <View style={styles.gateCarte}>
              <Text style={styles.gateTitre}>🧋 Ta première commande se passe en boutique</Text>
              <Text style={styles.gateTexte}>
                Viens commander dans ton Bubble Stop : on te crée ta carte de fidélité avec un code PIN.
              </Text>
              <Text style={styles.gateTexte}>
                Ensuite, lie ta carte dans l'onglet Fidélité — et tu pourras commander en avance depuis l'appli, dans ton magasin.
              </Text>
              <Pressable style={styles.gateBtn} onPress={() => router.push('/explore' as any)}>
                <Text style={styles.gateBtnTexte}>🎟 Lier ma carte de fidélité</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.fond}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.contenu}>
          <View style={styles.entete}>
            <Text style={styles.titre}>Commander</Text>
            <Pressable onPress={() => router.push('/commander/mes-commandes' as any)}>
              <Text style={styles.lienSuivi}>Mes commandes ›</Text>
            </Pressable>
          </View>
          {/* Magasin du client (celui de sa 1ère commande) — les autres ne sont pas proposés */}
          {magasinInscription && (
            <View style={styles.magasins}>
              <View style={[styles.magasinChip, styles.magasinChipActif]}>
                <Text style={[styles.magasinTexte, styles.magasinTexteActif]}>
                  📍 {MAGASINS.find((m) => m.id === magasinInscription)?.nom || magasinInscription}
                </Text>
              </View>
            </View>
          )}

          <Text style={styles.sousTitre}>Choisis ta catégorie</Text>

          {/* Bannière de suivi : commande en cours */}
          {commandeActive && (
            <Pressable
              style={[styles.banniere, commandeActive.statut === 'prete' && styles.bannierePrete]}
              onPress={() => router.push('/commander/mes-commandes' as any)}>
              <Text style={[styles.banniereTexte, commandeActive.statut === 'prete' && { color: VIOLET_PROFOND }]}>
                {(STATUTS_BANNIERE[commandeActive.statut] || commandeActive.statut)
                  .replace('%n', String(commandeActive.numero))}
              </Text>
              <Text style={[styles.banniereLien, commandeActive.statut === 'prete' && { color: VIOLET_PROFOND }]}>
                Suivre ›
              </Text>
            </Pressable>
          )}

          {/* === Mes favoris : ajout en 1 tap === */}
          {favoris.length > 0 && (
            <>
              <Text style={styles.sectionFavoris}>❤️ Mes favoris</Text>
              <View style={styles.favoris}>
                {favoris.map((f) => {
                  const indispo = !trouverSaveurCloud(f.categorieId, f.saveurId)
                    || trouverCategorieCloud(f.categorieId)?.horsStock
                    || trouverSaveurCloud(f.categorieId, f.saveurId)?.horsStock;
                  return (
                    <Pressable
                      key={f.id}
                      style={[styles.favoriChip, indispo && { opacity: 0.4 }]}
                      disabled={!!indispo}
                      onPress={() => ajouterFavoriAuPanier(f)}
                      onLongPress={() => retirerFavori(f.id)}>
                      <Text style={styles.favoriTexte}>
                        + {f.nom}{indispo ? ' (indispo)' : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.favoriAide}>Tap = ajouter au panier · appui long = retirer le favori</Text>
            </>
          )}

          {categories.map((cat: any) => (
            <Pressable
              key={cat.id}
              style={[styles.carte, { borderLeftColor: cat.couleur }, cat.horsStock && styles.carteOff]}
              disabled={!!cat.horsStock}
              onPress={() => router.push(`/commander/${cat.id}` as any)}>
              {photoCategorie(cat) ? (
                <Image source={photoCategorie(cat)} style={styles.cartePhoto} />
              ) : (
                <Text style={styles.carteEmoji}>{cat.emoji}</Text>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.carteNom}>{cat.nom}</Text>
                <Text style={styles.carteSousTitre}>{cat.horsStock ? 'Indisponible aujourd\'hui' : cat.sousTitre}</Text>
              </View>
              {!cat.horsStock && (
                <Text style={styles.cartePrix}>
                  dès {Math.min(...(Object.values(cat.prix) as number[])).toFixed(2).replace('.', ',')} €
                </Text>
              )}
            </Pressable>
          ))}
        </ScrollView>

        {/* Bandeau panier flottant */}
        {nbArticles > 0 && (
          <Pressable style={styles.bandeauPanier} onPress={() => router.push('/commander/panier' as any)}>
            <Text style={styles.bandeauTexte}>
              🛒 {nbArticles} article{nbArticles > 1 ? 's' : ''} — {totalPanier().toFixed(2).replace('.', ',')} €
            </Text>
            <Text style={styles.bandeauVoir}>Voir le panier ›</Text>
          </Pressable>
        )}
      </SafeAreaView>

      {/* (Plus de changement de magasin : le client est rattaché à celui de sa 1ère commande) */}
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: VIOLET },
  safe: { flex: 1 },
  contenu: { padding: 20, gap: 12, paddingBottom: 100 },
  titre: { fontSize: 28, fontWeight: '900', color: '#fff' },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lienSuivi: { color: '#A3C724', fontWeight: '800', fontSize: 15 },
  sousTitre: { fontSize: 15, color: LAVANDE, marginBottom: 8 },
  carte: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderLeftWidth: 6,
  },
  carteOff: { opacity: 0.45 },
  magasins: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  magasinChip: { backgroundColor: '#ffffff22', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13 },
  magasinChipActif: { backgroundColor: VERT },
  magasinTexte: { color: LAVANDE, fontWeight: '700', fontSize: 13 },
  magasinTexteActif: { color: VIOLET_PROFOND },
  magasinAide: { fontSize: 11.5, color: '#9a8fb5', marginTop: -4 },
  // Écran « première commande en boutique » (commande en ligne bloquée)
  gateCarte: { backgroundColor: '#fff', borderRadius: 18, padding: 22, gap: 12 },
  gateTitre: { fontSize: 20, fontWeight: '900', color: VIOLET_PROFOND },
  gateTexte: { fontSize: 15, color: '#4a4060', lineHeight: 22 },
  gateBtn: { backgroundColor: VERT, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  gateBtnTexte: { color: VIOLET_PROFOND, fontWeight: '900', fontSize: 16 },
  // Modal changement de magasin (mot de passe)
  modalFond: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', padding: 26 },
  modalBoite: { backgroundColor: '#fff', borderRadius: 18, padding: 22, gap: 12 },
  modalTitre: { fontSize: 19, fontWeight: '900', color: VIOLET_PROFOND },
  modalTexte: { fontSize: 14, color: '#4a4060', lineHeight: 20 },
  modalInput: {
    borderWidth: 1, borderColor: '#d8cfe2', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, color: VIOLET_PROFOND,
  },
  modalErreur: { color: '#c0392b', fontWeight: '700', fontSize: 13 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  modalBtnGhost: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: 12 },
  modalBtnGhostTxt: { color: '#6a5f85', fontWeight: '800', fontSize: 15 },
  modalBtnOk: { backgroundColor: VERT, paddingVertical: 11, paddingHorizontal: 20, borderRadius: 12 },
  modalBtnOkTxt: { color: VIOLET_PROFOND, fontWeight: '900', fontSize: 15 },
  sectionFavoris: { fontSize: 16, fontWeight: '800', color: VERT, marginTop: 4 },
  favoris: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  favoriChip: {
    backgroundColor: '#ffffff22', borderRadius: 999,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  favoriTexte: { color: LAVANDE, fontWeight: '700', fontSize: 14 },
  favoriAide: { fontSize: 11.5, color: '#9a8fb5' },
  banniere: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#ffffff22', borderRadius: 14, padding: 14,
  },
  bannierePrete: { backgroundColor: VERT },
  banniereTexte: { flex: 1, fontWeight: '800', fontSize: 14.5, color: '#fff' },
  banniereLien: { fontWeight: '800', fontSize: 14, color: '#fff' },
  carteEmoji: { fontSize: 32 },
  cartePhoto: { width: 56, height: 56, borderRadius: 12 },
  carteNom: { fontSize: 18, fontWeight: '800', color: VIOLET_PROFOND },
  carteSousTitre: { fontSize: 13, color: '#60646C', marginTop: 2 },
  cartePrix: { fontSize: 13, fontWeight: '700', color: VIOLET },
  bandeauPanier: {
    position: 'absolute', left: 16, right: 16, bottom: 12,
    backgroundColor: VERT, borderRadius: 16, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  bandeauTexte: { fontWeight: '800', fontSize: 16, color: VIOLET_PROFOND },
  bandeauVoir: { fontWeight: '800', fontSize: 15, color: VIOLET_PROFOND },
});
