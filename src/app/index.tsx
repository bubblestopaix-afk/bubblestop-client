// === Accueil Bubble Stop (DA kawaii) ===
// Header violet à vagues, offres, vitrine produits sur pastels, Boba Quest, fidélité.
import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Image, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SvgXml } from 'react-native-svg';

import { supabase } from '@/lib/supabase';
import { useJeuVisible, useRoueDuMoisVisible, useTowerVisible } from '@/lib/app-config';
import { useFonctionnalite } from '@/lib/fonctionnalites';
import { useEstConnecte } from '@/components/garde-jeu';
import { magasinOffresDepuisProfil, offreEnCours, offreVisiblePour } from '@/lib/offres';
import { constaterFidelite } from '@/lib/visites';
import { BORD, C, F, OMBRE, OMBRE_VIOLETTE, R } from '@/constants/charte';
import {
  BoutonGhost, Chevron, Etincelle, MascottePerle, Message, TitreKawaii,
} from '@/components/ui-kit';
import { LogoBubbleStop } from '@/components/logo-bubblestop';
import RappelNotifs from '@/components/rappel-notifs';
import { FAMILLES_MENU } from '@/data/menu-vitrine';

// Vitrine de consultation : elle reste indépendante de l'ancienne commande en
// ligne. Chaque tuile ouvre uniquement /menu, jamais /commander ni le panier.
// Visuels détourés de la DA kawaii sur pastilles pastel (vert/crème/rose).
const BOISSONS_VITRINE = [
  { id: 'fruit-tea', nom: 'Fruit Tea', photo: require('@/assets/images/products/fruit-tea.png'), pastel: '#EDF6E1' },
  { id: 'milk-tea', nom: 'Milk Tea', photo: require('@/assets/images/products/milk-tea.png'), pastel: '#FBF2E5' },
  { id: 'thes-du-monde', nom: 'Thés du monde', photo: require('@/assets/images/products/thes-du-monde.png'), pastel: '#FDEFF6' },
  { id: 'milkshake', nom: 'Milkshake', photo: require('@/assets/images/products/milkshake.png'), pastel: '#EDF6E1' },
  { id: 'milk-tea-matcha', nom: 'Milk Tea Matcha', photo: require('@/assets/images/products/matcha.png'), pastel: '#FBF2E5' },
  { id: 'mousses', nom: 'Mousses', photo: require('@/assets/images/photos/mousses-menu.png'), pastel: '#FDEFF6' },
  { id: 'signatures', nom: 'Signatures', photo: require('@/assets/images/photos/creme-brulee-menu.png'), pastel: '#EDF6E1' },
  { id: 'citronnade', nom: 'Citronnade', photo: require('@/assets/images/products/citronnade.png'), pastel: '#FDEFF6' },
] as const;

const FAMILLES_PAR_ID = new Map(FAMILLES_MENU.map((famille) => [famille.id, famille]));

// Vagues du header — COPIER-COLLER du <svg> de la maquette 1a (aucune retranscription)
const VAGUES_HEADER_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 393 160" preserveAspectRatio="none"><path d="M-20,34 Q40,22 100,34 T220,34 T340,34 T460,34 L460,-20 L-20,-20 Z" fill="#f2a7cf" opacity=".12"></path><path d="M-20,58 Q50,44 120,58 T260,58 T400,58 L400,-20 L-20,-20 Z" fill="#a883d6" opacity=".14"></path><path d="M-20,136 Q60,152 140,136 T300,136 T460,136 L460,180 L-20,180 Z" fill="#452a6e" opacity=".32"></path></svg>`;
function VagueHeader() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
      <SvgXml xml={VAGUES_HEADER_XML} width="100%" height="100%" />
    </View>
  );
}

// Vagues internes de la carte fidélité — COPIER-COLLER du <svg> de la maquette 1a
const VAGUES_FIDELITE_XML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 120" preserveAspectRatio="none"><path d="M-20,24 Q40,14 100,24 T220,24 T340,24 T460,24 L460,-20 L-20,-20 Z" fill="#f2a7cf" opacity=".1"></path><path d="M-20,102 Q60,114 140,102 T300,102 T460,102 L460,140 L-20,140 Z" fill="#452a6e" opacity=".35"></path></svg>`;
function VaguesFidelite() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
      <SvgXml xml={VAGUES_FIDELITE_XML} width="100%" height="100%" />
    </View>
  );
}

export default function AccueilScreen() {
  const insets = useSafeAreaInsets();
  const jeuFlag = useJeuVisible(); // 🕹️ flag serveur : la carte Boba Quest s'affiche ou pas
  const towerFlag = useTowerVisible(); // 🗼 flag serveur INDÉPENDANT : la carte Boba Tower
  const roueFlag = useRoueDuMoisVisible(); // 🎡 flag serveur INDÉPENDANT : la carte Roue du Mois
  const offresFlag = useFonctionnalite('offres');
  const [prenom, setPrenom] = useState('');
  const [carte, setCarte] = useState<{ tampons: number; cadeaux: number } | null>(null);
  const [carteLiee, setCarteLiee] = useState<boolean | null>(null);
  // Session RÉACTIVE (abonnée à onAuthStateChange) : une déconnexion retire les cartes
  // de jeu à l'instant. Un état posé dans `charger()` ne l'aurait fait qu'au prochain
  // poll — 15 s de carte fantôme — et jamais du tout si `charger()` échouait avant la
  // lecture de session. `null` = pas encore su → cartes masquées (fail-closed, comme
  // sous un flag serveur éteint).
  // (`carteLiee` ne pouvait pas servir : il vaut false aussi bien pour « pas connecté »
  //  que pour « connecté sans carte de fidélité ».)
  const estConnecte = useEstConnecte();
  // null = chargement initial (ou module désactivé). On évite ainsi d'afficher
  // "Pas d'offre" avant que Supabase ait réellement répondu.
  const [offres, setOffres] = useState<any[] | null>(null);
  const [refresh, setRefresh] = useState(false);
  const [erreurReseau, setErreurReseau] = useState(false);
  const [erreurOffres, setErreurOffres] = useState(false);

  const charger = useCallback(async () => {
    try {
      let echec = false;
      // Offres actives (visibles même sans compte) — les offres PROGRAMMÉES
      // (jours/heures/dates) ne s'affichent que pendant leur fenêtre (offreEnCours).
      if (offresFlag.actif) {
        // Une promo flash suit uniquement le dernier QR scanné en boutique. Sans
        // scan connu, le filtre ne laisse passer que les promos nationales.
        let magasinClient: string | null = null;
        try {
          const { data: sess } = await supabase.auth.getSession();
          if (sess?.session) {
            const { data: pm } = await supabase.from('profils')
              .select('dernier_magasin_scan').eq('id', sess.session.user.id).maybeSingle();
            magasinClient = magasinOffresDepuisProfil(pm);
          }
        } catch (_) { magasinClient = null; }
        const { data: offresData, error: erreurChargementOffres } = await supabase.from('offres')
          .select('id, titre, message, jours, heure_debut, heure_fin, date_debut, date_fin, active, magasins')
          .eq('active', true)
          .order('created_at', { ascending: false }).limit(10);
        if (erreurChargementOffres) {
          echec = true;
          setErreurOffres(true);
        } else {
          setErreurOffres(false);
          setOffres((offresData ?? [])
            .filter((o) => offreEnCours(o as any) && offreVisiblePour(o as any, magasinClient))
            .slice(0, 5));
        }
      } else {
        setErreurOffres(false);
        setOffres(null);
      }

      const { data: { session }, error: erreurSession } = await supabase.auth.getSession();
      if (erreurSession) throw erreurSession;
      if (!session) { setCarteLiee(false); setErreurReseau(echec); return; }

      // Profil : prénom + carte. La ville n'est plus demandée depuis le retrait
      // de la commande en ligne ; la fidélité reste valable dans les 3 boutiques.
      const { data: p, error: erreurProfil } = await supabase.from('profils')
        .select('nom, numero_fidelite')
        .eq('id', session.user.id).maybeSingle();
      if (erreurProfil) throw erreurProfil;
      // Salut PRÉNOM uniquement (1er mot du nom), pas le nom complet
      setPrenom((p?.nom || '').trim().split(/\s+/)[0] || '');
      setCarteLiee(!!p?.numero_fidelite);

      // Carte de fidélité : tampons / cadeaux en direct
      if (p?.numero_fidelite) {
        const { data: f, error: erreurCarte } = await supabase.from('fidelite_cloud')
          .select('tampons, cadeaux, cartes_completees').eq('numero_fidelite', p.numero_fidelite).maybeSingle();
        if (erreurCarte) echec = true;
        else {
          setCarte(f ? { tampons: Number(f.tampons) || 0, cadeaux: Number(f.cadeaux) || 0 } : null);
          // 🧋 26/07 — LA GORGÉE FRAÎCHE. `tampons` est le compteur INTRA-carte (« n/9 ») :
          // il retombe à 0 à chaque carte remplie, d'où `cartes_completees` ajouté au
          // select pour reconstituer un total MONOTONE. `lib/visites` en déduit les achats
          // RÉELS (en retirant la part des tampons gagnés dans le jeu, lue côté serveur)
          // et les met de côté ; c'est Boba Quest qui récompense à l'ouverture.
          // Volontairement sans await : jamais bloquer le rendu de l'accueil pour ça.
          if (f) void constaterFidelite(f.tampons, (f as { cartes_completees?: unknown }).cartes_completees);
        }
      }

      setErreurReseau(echec);
    } catch (_) { setErreurReseau(true); }
  }, [offresFlag.actif]);

  useEffect(() => {
    charger();
    // Tampons et offres restent frais sans imposer un rechargement manuel.
    const t = setInterval(charger, 15000);
    return () => clearInterval(t);
  }, [charger]);

  const onRefresh = async () => { setRefresh(true); await charger(); setRefresh(false); };

  const tampons = carte?.tampons ?? 0;

  return (
    <View style={styles.fond}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor="#fff" />}
      >
        {/* === Header de marque (violet à vagues, arrondi en bas) === */}
        <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
          <VagueHeader />
          <Etincelle taille={19} style={{ position: 'absolute', top: 6 + insets.top, right: 26, opacity: 0.85 }} />
          <Etincelle taille={12} couleur="#EAE8F5" style={{ position: 'absolute', top: 34 + insets.top, right: 56, opacity: 0.5 }} />
          <LogoBubbleStop variante="blanc" largeur={168} />
          <Text style={styles.salut}>
            {prenom ? `Salut ${prenom}` : 'Ton bubble tea préféré, dans ta poche'}
          </Text>
        </View>

        <View style={styles.contenu}>
          {erreurReseau && (
            <View accessibilityRole="alert">
              <Message type="erreur" texte="Certaines informations ne sont pas à jour. Vérifie ta connexion." />
              <BoutonGhost titre="Réessayer" onPress={charger} />
            </View>
          )}

          {/* === Offres prioritaires : toujours avant la vitrine boissons === */}
          {offresFlag.actif && offres !== null && !erreurOffres && (
            <View style={styles.offresSection}>
              <TitreKawaii texte="En ce moment" taille={19} />
              {offres.length > 0 ? (
                <>
                  {offres.slice(0, 2).map((o, i) => (
                    <Pressable
                      key={o.id}
                      style={[styles.offre, i > 0 && styles.offreBlanche]}
                      onPress={() => router.push('/offres' as any)}>
                      <Text style={[styles.offreTitre, i > 0 && { color: C.texte }]}>{o.titre}</Text>
                      <Text style={[styles.offreMessage, i > 0 && { color: C.texte2 }]} numberOfLines={2}>{o.message}</Text>
                    </Pressable>
                  ))}
                  {offres.length > 2 && (
                    <Pressable style={styles.lien} onPress={() => router.push('/offres' as any)}>
                      <Text style={styles.lienTexte}>Voir toutes les offres ›</Text>
                    </Pressable>
                  )}
                </>
              ) : (
                <View style={styles.offreVide} accessibilityLabel="Pas d'offre pour le moment">
                  <Etincelle taille={24} couleur={C.jaune} />
                  <View style={styles.offreVideTextes}>
                    <Text style={styles.offreVideTitre}>Pas d'offre pour le moment</Text>
                    <Text style={styles.offreVideMessage}>Reviens bientôt découvrir les prochains bons plans.</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* 🔔 Rappel notifications (connecté sans permission → il raterait toutes les promos) */}
          {offresFlag.actif && <RappelNotifs />}

          {/* Vitrine boissons : consultation du menu sans réactiver la commande. */}
          <View style={styles.vitrine}>
            <TitreKawaii texte="Nos boissons" sousTitre="À retrouver en boutique" taille={19} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.vitrineRail}
              accessibilityLabel="Aperçu des boissons Bubble Stop">
              {BOISSONS_VITRINE.map((boisson, i) => (
                <Pressable
                  key={boisson.id}
                  onPress={() => router.push({
                    pathname: '/menu/[categorieId]',
                    params: { categorieId: boisson.id },
                  } as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`Découvrir ${FAMILLES_PAR_ID.get(boisson.id)?.nom ?? boisson.nom}`}
                  accessibilityHint="Ouvre le menu vitrine de cette famille, sans commande en ligne"
                  style={({ pressed }) => [
                    styles.vitrineTuile,
                    { backgroundColor: boisson.pastel },
                    pressed && styles.vitrineTuilePressee,
                  ]}>
                  <Image
                    source={boisson.photo}
                    style={[styles.vitrinePhoto, { transform: [{ rotate: `${[-2, 1.8, -1.5, 2, -1.8, 1.6][i % 6]}deg` }] }]}
                    resizeMode="contain"
                    accessibilityLabel={`Photo ${boisson.nom}`}
                  />
                  <View style={styles.vitrineNomRang}>
                    <Text style={styles.vitrineNom} numberOfLines={2}>{boisson.nom}</Text>
                    <Chevron couleur={C.violetClair} size={13} />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* === 🕹️ Boba Quest : visible pour tous, pour une sélection de membres,
               ou pour l'admin selon les réglages serveur (cf. AGENTS.md). === */}
          {jeuFlag.visible && estConnecte === true && (
            <Pressable style={styles.jeu} onPress={() => router.push('/jeu' as any)}>
              <MascottePerle taille={46} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.jeuTitre}>Boba Quest</Text>
                  <View style={styles.jeuBadge}><Text style={styles.jeuBadgeTxt}>NOUVEAU</Text></View>
                </View>
                <Text style={styles.jeuSous}>Joue, collectionne, gagne de vrais prix !</Text>
              </View>
              <Chevron couleur={C.roseFonce} />
            </Pressable>
          )}

          {/* === 🗼 Boba Tower : le 2e jeu, INDÉPENDANT de Boba Quest (toggle serveur
               `boba_tower`, fail-closed). Masqué → aucune carte, aucun lien mort.
               Les sous-titres différencient les deux jeux : Quest = collection et
               combats, Tower = parties rapides et records. === */}
          {towerFlag.visible && estConnecte === true && (
            <Pressable
              style={styles.tower}
              onPress={() => router.push('/boba-tower' as any)}
              accessibilityRole="button"
              accessibilityLabel="Boba Tower, le jeu d'adresse : parties rapides et records">
              <Text style={{ fontSize: 34 }}>🗼</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.towerTitre}>Boba Tower</Text>
                  <View style={styles.towerBadge}><Text style={styles.towerBadgeTxt}>PILOTE</Text></View>
                </View>
                <Text style={styles.towerSous}>Empile ta boisson en 45 s — adresse, combos, records</Text>
              </View>
              <Chevron couleur={C.vertFonce} />
            </Pressable>
          )}

          {/* === 🎡 La Roue du Mois : le 3e jeu, INDÉPENDANT de Boba Quest (toggle
               serveur `roue_du_mois`, fail-closed) — sortie du hub Boba Quest le
               03/08/2026. Un tour gratuit par mois, lot RÉEL à retirer en boutique.
               Masqué → aucune carte, aucun lien mort. === */}
          {roueFlag.visible && estConnecte === true && (
            <Pressable
              style={styles.roue}
              onPress={() => router.push('/roue' as any)}
              accessibilityRole="button"
              accessibilityLabel="La Roue du Mois : un tour gratuit par mois, un vrai lot à gagner en boutique">
              <Text style={{ fontSize: 34 }}>🎡</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.roueTitre}>La Roue du Mois</Text>
                  <View style={styles.roueBadge}><Text style={styles.roueBadgeTxt}>1 TOUR/MOIS</Text></View>
                </View>
                <Text style={styles.roueSous}>Tourne la roue, repars avec un vrai lot en boutique</Text>
              </View>
              <Chevron couleur="#8A6D1D" />
            </Pressable>
          )}

          {/* === Carte de fidélité (tampons en direct) === */}
          {carteLiee && carte ? (
            <Pressable style={styles.fidelite} onPress={() => router.push('/explore' as any)}>
              <VaguesFidelite />
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
                  ? `${carte.cadeaux} boisson${carte.cadeaux > 1 ? 's' : ''} offerte${carte.cadeaux > 1 ? 's' : ''} à utiliser`
                  : `Encore ${9 - tampons} boisson${9 - tampons > 1 ? 's' : ''} avant la prochaine offerte`}
              </Text>
            </Pressable>
          ) : carteLiee === false ? (
            <Pressable style={styles.fidelite} onPress={() => router.push('/explore' as any)}>
              <VaguesFidelite />
              <Text style={styles.fideliteTitre}>Active ta carte de fidélité</Text>
              <Text style={styles.fideliteTexte}>Ton QR et tes tampons en direct : 9 boissons = 1 offerte ›</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },

  // Header de marque (vagues + étincelles par-dessus le violet)
  header: {
    backgroundColor: C.violet,
    paddingHorizontal: 22, paddingBottom: 26, gap: 8, overflow: 'hidden',
    borderBottomLeftRadius: 30, borderBottomRightRadius: 30,
  },
  logo: { fontFamily: F.logo, fontSize: 30, color: '#fff', letterSpacing: 0.5 },
  salut: { fontFamily: F.t600, fontSize: 15.5, color: C.surViolet },
  // L'accueil respire sous le prénom ; la vitrine sépare ensuite naturellement
  // l'en-tête de Boba Quest au lieu de coller la carte au bord du header.
  contenu: { paddingHorizontal: 18, gap: 16, marginTop: 14 },

  // Vitrine boissons : accès au menu de consultation, jamais à la commande.
  vitrine: { gap: 9 },
  vitrineRail: { gap: 12, paddingVertical: 5, paddingRight: 6 },
  // Maquette 1a : contenu ancré en HAUT (l'étiquette s'étire dessous, la photo
  // reste alignée d'une tuile à l'autre, même quand le nom fait deux lignes).
  vitrineTuile: {
    width: 98, padding: 8, paddingHorizontal: 6, paddingBottom: 10, gap: 6,
    alignItems: 'center', borderRadius: 22,
    borderWidth: BORD.largeur, borderColor: BORD.surPastel, ...OMBRE,
  },
  vitrineTuilePressee: { transform: [{ scale: 0.97 }], opacity: 0.88 },
  vitrinePhoto: { width: 78, height: 92 },
  vitrineNomRang: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  vitrineNom: {
    fontFamily: F.t700, fontSize: 12, lineHeight: 15, color: C.texte,
    textAlign: 'center', paddingLeft: 2, flexShrink: 1,
  },

  // Boba Quest (jeu à collection) — carte rose pâle à mascotte
  jeu: {
    backgroundColor: C.rosePale, borderRadius: R.carte, paddingVertical: 13, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: BORD.largeur, borderColor: BORD.surPastel, ...OMBRE,
  },
  jeuTitre: { fontFamily: F.titre, fontSize: 17, color: C.violet },
  jeuBadge: { backgroundColor: '#FFC4DD', borderRadius: R.pill, paddingVertical: 3, paddingHorizontal: 8 },
  jeuBadgeTxt: { fontFamily: F.t800, fontSize: 10, color: C.roseFonce, letterSpacing: 0.4 },
  jeuSous: { fontFamily: F.t500, fontSize: 12.5, color: C.roseFonce, marginTop: 3 },

  // Boba Tower (jeu d'adresse) — carte vert pâle, pendant de la rose Boba Quest
  tower: {
    backgroundColor: C.vertPale, borderRadius: R.carte, paddingVertical: 13, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: BORD.largeur, borderColor: BORD.surPastel, ...OMBRE,
  },
  towerTitre: { fontFamily: F.titre, fontSize: 17, color: C.violet },
  towerBadge: { backgroundColor: '#DFF0BC', borderRadius: R.pill, paddingVertical: 3, paddingHorizontal: 8 },
  towerBadgeTxt: { fontFamily: F.t800, fontSize: 10, color: C.vertFonce, letterSpacing: 0.4 },
  towerSous: { fontFamily: F.t500, fontSize: 12.5, color: C.vertFonce, marginTop: 3 },

  // La Roue du Mois (3e jeu) — carte jaune pâle « lactées », pendant du rose (Quest)
  // et du vert (Tower). Textes en brun doré : le seul foncé lisible sur ce pastel.
  roue: {
    backgroundColor: C.jaunePale, borderRadius: R.carte, paddingVertical: 13, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: BORD.largeur, borderColor: BORD.surPastel, ...OMBRE,
  },
  roueTitre: { fontFamily: F.titre, fontSize: 17, color: C.violet },
  roueBadge: { backgroundColor: '#F6E5A8', borderRadius: R.pill, paddingVertical: 3, paddingHorizontal: 8 },
  roueBadgeTxt: { fontFamily: F.t800, fontSize: 10, color: '#8A6D1D', letterSpacing: 0.4 },
  roueSous: { fontFamily: F.t500, fontSize: 12.5, color: '#8A6D1D', marginTop: 3 },

  // Carte fidélité (violette, ombre violette DA)
  fidelite: {
    backgroundColor: C.violet, borderRadius: 26, padding: 17, paddingHorizontal: 18, gap: 10,
    overflow: 'hidden', ...OMBRE_VIOLETTE,
  },
  fideliteHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fideliteTitre: { fontFamily: F.titre, fontSize: 17, color: '#fff' },
  fideliteCompteur: { fontFamily: F.t800, fontSize: 15.5, color: C.jaune },
  tampons: { flexDirection: 'row', gap: 7 },
  tampon: { flex: 1, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.18)' },
  tamponPlein: { backgroundColor: C.vert },
  fideliteTexte: { fontFamily: F.t600, fontSize: 13, color: C.surViolet },

  // Offres — placées avant les boissons ; la 1re en jaune, les suivantes en blanc.
  offresSection: { gap: 10 },
  offre: {
    backgroundColor: C.jaune, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, gap: 4,
    borderWidth: BORD.largeur, borderColor: BORD.surPastel, ...OMBRE,
  },
  offreBlanche: { backgroundColor: C.carte, borderColor: BORD.surBlanc },
  offreTitre: { fontFamily: F.t800, fontSize: 15, color: '#54470A' },
  offreMessage: { fontFamily: F.t500, fontSize: 13, color: '#54470A', opacity: 0.8, lineHeight: 19 },
  offreVide: {
    backgroundColor: C.jaunePale, borderRadius: 22, paddingVertical: 15, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: BORD.largeur, borderColor: BORD.surPastel, ...OMBRE,
  },
  offreVideTextes: { flex: 1, gap: 2 },
  offreVideTitre: { fontFamily: F.t800, fontSize: 14.5, color: C.violet },
  offreVideMessage: { fontFamily: F.t500, fontSize: 12.5, lineHeight: 17, color: C.texte2 },

  lien: { paddingVertical: 4, alignItems: 'center' },
  lienTexte: { fontFamily: F.t700, fontSize: 13.5, color: C.violetClair },
});
