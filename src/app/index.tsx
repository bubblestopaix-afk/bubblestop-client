// === Accueil Bubble Stop (style app food pro) ===
// Header de marque violet, suivi LIVE de la commande, CTA Commander,
// raccourcis catalogue en photos, carte de fidélité, offres.
import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Image, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { offreEnCours } from '@/lib/offres';
import { MAGASINS } from '@/store/magasin';
import { useCatalogueCloud, trouverCategorieCloud, trouverSaveurCloud } from '@/data/catalogue-cloud';
import { photoCategorie } from '@/data/photos-categories';
import { usePanier, ajouterLigne, totalPanier } from '@/store/panier';
// @ts-ignore — règles de prix partagées avec le POS
import { calculerPrix } from '@/data/catalogue';
import { C, F, R, OMBRE } from '@/constants/charte';
import { Chevron } from '@/components/ui-kit';
import RappelNotifs from '@/components/rappel-notifs';

const STATUT_LIB: Record<string, { txt: string; etape: number }> = {
  en_attente: { txt: 'Commande reçue', etape: 1 },
  en_preparation: { txt: 'En préparation', etape: 2 },
  prete: { txt: 'Prête — viens la chercher !', etape: 3 },
};

export default function AccueilScreen() {
  const insets = useSafeAreaInsets();
  const { categories } = useCatalogueCloud();
  const lignes = usePanier();
  const [prenom, setPrenom] = useState('');
  const [magasinId, setMagasinId] = useState<string | null>(null);
  const [carte, setCarte] = useState<{ tampons: number; cadeaux: number } | null>(null);
  const [carteLiee, setCarteLiee] = useState<boolean | null>(null);
  const [cmdActive, setCmdActive] = useState<any>(null);
  const [horairesJour, setHorairesJour] = useState<string | null>(null);
  const [offres, setOffres] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(false);

  const charger = useCallback(async () => {
    try {
      // Offres actives (visibles même sans compte) — les offres PROGRAMMÉES
      // (jours/heures/dates) ne s'affichent que pendant leur fenêtre (offreEnCours).
      const { data: offresData } = await supabase.from('offres')
        .select('id, titre, message, jours, heure_debut, heure_fin, date_debut, date_fin, active')
        .eq('active', true)
        .order('created_at', { ascending: false }).limit(10);
      setOffres((offresData ?? []).filter((o) => offreEnCours(o as any)).slice(0, 5));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setCarteLiee(false); return; }

      // Profil : prénom + magasin + carte
      const { data: p } = await supabase.from('profils')
        .select('nom, prenom_sur_ticket, magasin, numero_fidelite')
        .eq('id', session.user.id).maybeSingle();
      // Salut PRÉNOM uniquement (1er mot du nom), pas le nom complet
      setPrenom((p?.nom || '').trim().split(/\s+/)[0] || '');
      setMagasinId(p?.magasin ?? null);
      setCarteLiee(!!p?.numero_fidelite);

      // Carte de fidélité : tampons / cadeaux en direct
      if (p?.numero_fidelite) {
        const { data: f } = await supabase.from('fidelite_cloud')
          .select('tampons, cadeaux').eq('numero_fidelite', p.numero_fidelite).maybeSingle();
        setCarte(f ? { tampons: Number(f.tampons) || 0, cadeaux: Number(f.cadeaux) || 0 } : null);
      }

      // Commande active (suivi live) — filtrée sur SA commande (sinon un admin,
      // dont la RLS lit tout, verrait ici la commande d'un autre client)
      const { data: c } = await supabase.from('commandes')
        .select('numero, statut')
        .eq('client_id', session.user.id)
        .in('statut', ['en_attente', 'en_preparation', 'prete'])
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      setCmdActive(c ?? null);

      // Horaires du jour du magasin du client
      if (p?.magasin) {
        const { data: cfg } = await supabase.from('boutique_config')
          .select('horaires').eq('id', p.magasin).maybeSingle();
        const h = cfg?.horaires?.[String(new Date().getDay())];
        if (h) setHorairesJour(h.ouvert === false ? 'Fermé aujourd\'hui' : (h.de && h.a ? `Ouvert aujourd'hui · ${h.de} – ${h.a}` : null));
      }
    } catch (_) { /* silencieux */ }
  }, []);

  useEffect(() => {
    charger();
    // Statut de commande rafraîchi en continu (15 s)
    const t = setInterval(charger, 15000);
    return () => clearInterval(t);
  }, [charger]);

  const onRefresh = async () => { setRefresh(true); await charger(); setRefresh(false); };

  const nomMagasin = magasinId ? (MAGASINS.find((m) => m.id === magasinId)?.nom || magasinId) : null;
  const tampons = carte?.tampons ?? 0;
  const statut = cmdActive ? STATUT_LIB[cmdActive.statut] : null;
  const nbArticles = lignes.reduce((s, l) => s + l.quantite, 0);
  const catsAvecPhoto = categories.filter((c: any) => !c.horsStock);

  return (
    <View style={styles.fond}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor="#fff" />}
      >
        {/* === Header de marque (violet, arrondi en bas) === */}
        <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
          <Text style={styles.logo}>BUBBLE STOP</Text>
          <Text style={styles.salut}>
            {prenom ? `Salut ${prenom} 👋` : 'Ton bubble tea préféré, dans ta poche'}
          </Text>
          {(nomMagasin || horairesJour) && (
            <View style={styles.infosMag}>
              {!!nomMagasin && <Text style={styles.infosMagTxt}>📍 {nomMagasin}</Text>}
              {!!horairesJour && <Text style={styles.infosMagHoraires}>{horairesJour}</Text>}
            </View>
          )}
        </View>

        <View style={styles.contenu}>
          {/* 🔔 Rappel notifications (connecté sans permission → il raterait toutes les promos) */}
          <RappelNotifs />

          {/* === Suivi LIVE de la commande en cours (l'info n°1 quand elle existe) === */}
          {cmdActive && statut && (
            <Pressable
              style={[styles.suivi, cmdActive.statut === 'prete' && styles.suiviPrete]}
              onPress={() => router.push('/commander/mes-commandes' as any)}
            >
              <View style={styles.suiviHaut}>
                <Text style={styles.suiviTitre}>Commande n°{cmdActive.numero}</Text>
                <Chevron couleur={C.texte3} />
              </View>
              {/* Barre d'étapes : reçue → préparation → prête */}
              <View style={styles.etapes}>
                {[1, 2, 3].map((e) => (
                  <View key={e} style={[styles.etape, e <= statut.etape && styles.etapeFaite]} />
                ))}
              </View>
              <Text style={[styles.suiviTexte, cmdActive.statut === 'prete' && { color: C.vertFonce }]}>
                {statut.txt}
              </Text>
            </Pressable>
          )}

          {/* === CTA Commander (action n°1) === */}
          <Pressable style={styles.cta} onPress={() => router.push('/commander' as any)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaTitre}>Commander</Text>
              <Text style={styles.ctaSous}>
                {nbArticles > 0
                  ? `Panier en cours · ${totalPanier().toFixed(2).replace('.', ',')} €`
                  : 'Retrait en boutique, sans attendre'}
              </Text>
            </View>
            <View style={styles.ctaRond}>
              <Chevron couleur={C.violetProfond} size={22} />
            </View>
          </Pressable>

          {/* === La carte : raccourcis catégories en photos === */}
          <Text style={styles.sectionTitre}>La carte</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRail}>
            {catsAvecPhoto.map((cat: any) => {
              const photo = photoCategorie(cat);
              return (
                <Pressable key={cat.id} style={styles.catTuile} onPress={() => router.push(`/commander/${cat.id}` as any)}>
                  {photo
                    ? <Image source={photo} style={styles.catPhoto} />
                    : <View style={[styles.catPhoto, styles.catEmoji]}><Text style={{ fontSize: 34 }}>{cat.emoji}</Text></View>}
                  <Text style={styles.catNom} numberOfLines={1}>{cat.nom}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* === Carte de fidélité (tampons en direct) === */}
          {carteLiee && carte ? (
            <Pressable style={styles.fidelite} onPress={() => router.push('/explore' as any)}>
              <View style={styles.fideliteHaut}>
                <Text style={styles.fideliteTitre}>Ma fidélité</Text>
                <Text style={styles.fideliteCompteur}>{tampons}/9</Text>
              </View>
              <View style={styles.tampons}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <View key={i} style={[styles.tampon, i < tampons && styles.tamponPlein]} />
                ))}
              </View>
              <Text style={styles.fideliteTexte}>
                {carte.cadeaux > 0
                  ? `🎉 ${carte.cadeaux} boisson${carte.cadeaux > 1 ? 's' : ''} offerte${carte.cadeaux > 1 ? 's' : ''} à utiliser`
                  : `Encore ${9 - tampons} boisson${9 - tampons > 1 ? 's' : ''} avant la prochaine offerte`}
              </Text>
            </Pressable>
          ) : carteLiee === false ? (
            <Pressable style={styles.fidelite} onPress={() => router.push('/explore' as any)}>
              <Text style={styles.fideliteTitre}>Active ta carte de fidélité</Text>
              <Text style={styles.fideliteTexte}>Ton QR et tes tampons en direct : 9 boissons = 1 offerte ›</Text>
            </Pressable>
          ) : null}


          {/* === Offres en cours === */}
          {offres.length > 0 && (
            <>
              <Text style={styles.sectionTitre}>En ce moment</Text>
              {offres.slice(0, 2).map((o) => (
                <Pressable key={o.id} style={styles.offre} onPress={() => router.push('/offres' as any)}>
                  <Text style={styles.offreTitre}>{o.titre}</Text>
                  <Text style={styles.offreMessage} numberOfLines={2}>{o.message}</Text>
                </Pressable>
              ))}
              {offres.length > 2 && (
                <Pressable style={styles.lien} onPress={() => router.push('/offres' as any)}>
                  <Text style={styles.lienTexte}>Voir toutes les offres ›</Text>
                </Pressable>
              )}
            </>
          )}

          {/* Accès rapide : historique des commandes */}
          <Pressable style={styles.lien} onPress={() => router.push('/commander/mes-commandes' as any)}>
            <Text style={styles.lienTexte}>Mes commandes passées ›</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },

  // Header de marque
  header: {
    backgroundColor: C.violet,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    paddingHorizontal: 22, paddingBottom: 40, gap: 6,
  },
  logo: { fontFamily: F.titre, fontSize: 30, color: '#fff', letterSpacing: 0.5 },
  salut: { fontFamily: F.t600, fontSize: 15.5, color: C.lavande },
  infosMag: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  infosMagTxt: {
    fontFamily: F.t700, fontSize: 12.5, color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: R.pill,
    paddingVertical: 6, paddingHorizontal: 12, overflow: 'hidden',
  },
  infosMagHoraires: { fontFamily: F.t600, fontSize: 12.5, color: '#CDBFE6' },

  // Le contenu chevauche le bas du header (cartes "posées" dessus)
  contenu: { paddingHorizontal: 18, gap: 14, marginTop: -24 },

  // Suivi de commande live
  suivi: { backgroundColor: C.carte, borderRadius: R.carte, padding: 18, gap: 10, ...OMBRE },
  suiviPrete: { borderWidth: 2, borderColor: C.vert },
  suiviHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  suiviTitre: { fontFamily: F.t800, fontSize: 16, color: C.texte },
  suiviTexte: { fontFamily: F.t700, fontSize: 14, color: C.texte2 },
  etapes: { flexDirection: 'row', gap: 6 },
  etape: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.lavande },
  etapeFaite: { backgroundColor: C.vert },

  // CTA Commander
  cta: {
    backgroundColor: C.vert, borderRadius: R.carte, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12, ...OMBRE,
  },
  ctaTitre: { fontFamily: F.titre, fontSize: 21, color: C.violetProfond },
  ctaSous: { fontFamily: F.t600, fontSize: 13.5, color: C.violetProfond, opacity: 0.75, marginTop: 2 },
  ctaRond: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },

  sectionTitre: { fontFamily: F.titre, fontSize: 18, color: C.violet, marginTop: 8, marginBottom: -2 },

  // Rail catégories
  catRail: { gap: 12, paddingVertical: 4, paddingRight: 6 },
  catTuile: { alignItems: 'center', gap: 7, width: 86 },
  catPhoto: { width: 82, height: 82, borderRadius: 24, backgroundColor: C.lavande },
  catEmoji: { alignItems: 'center', justifyContent: 'center' },
  catNom: { fontFamily: F.t700, fontSize: 12.5, color: C.texte, textAlign: 'center' },

  // Carte fidélité
  fidelite: { backgroundColor: C.violet, borderRadius: R.carte, padding: 20, gap: 10, ...OMBRE },
  fideliteHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fideliteTitre: { fontFamily: F.titre, fontSize: 17, color: '#fff' },
  fideliteCompteur: { fontFamily: F.t800, fontSize: 16, color: C.vert },
  tampons: { flexDirection: 'row', gap: 7 },
  tampon: { flex: 1, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.18)' },
  tamponPlein: { backgroundColor: C.vert },
  fideliteTexte: { fontFamily: F.t600, fontSize: 13.5, color: C.lavande },


  // Offres
  offre: { backgroundColor: C.jaune, borderRadius: 18, padding: 16, gap: 4, ...OMBRE },
  offreTitre: { fontFamily: F.t800, fontSize: 15.5, color: C.violetProfond },
  offreMessage: { fontFamily: F.t600, fontSize: 13.5, color: C.violetProfond, opacity: 0.8, lineHeight: 19 },

  lien: { paddingVertical: 4, alignItems: 'center' },
  lienTexte: { fontFamily: F.t700, fontSize: 14, color: C.violetClair },
});
