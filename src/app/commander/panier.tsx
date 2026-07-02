// === Panier + envoi de la commande vers Supabase ===
// V1 : paiement au retrait (sur place). Stripe viendra en V2.
import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

// @ts-ignore — helpers formats/sucre du catalogue local (fixes)
import { trouverFormat, trouverSucre } from '@/data/catalogue';
import {
  trouverCategorieCloud as trouverCategorie,
  trouverSaveurCloud as trouverSaveur,
  trouverToppingCloud as trouverTopping,
} from '@/data/catalogue-cloud';
import { usePanier, totalPanier, remiseMochi, retirerLigne, changerQuantite, viderPanier, LignePanier } from '@/store/panier';
import { useMagasin, MAGASINS } from '@/store/magasin';
import { supabase } from '@/lib/supabase';
import { peutCommander } from '@/lib/eligibilite';
import { C, F, R, OMBRE } from '@/constants/charte';
import { BoutonRetour, Chip, Stepper, Message, BoutonPrimaire, BoutonGhost } from '@/components/ui-kit';

// Résumé lisible d'une ligne (affichage + JSON envoyé en base)
function decrireLigne(l: LignePanier) {
  const cat = trouverCategorie(l.categorieId);
  const sav = trouverSaveur(l.categorieId, l.saveurId);
  const détails: string[] = [];
  const f = trouverFormat(l.format);
  if (f) détails.push(f.label);
  if (l.sucre) détails.push(`sucre ${trouverSucre(l.sucre)?.label?.toLowerCase() ?? l.sucre}`);
  if (l.temperature === 'chaud') détails.push('chaud');
  if (l.glacons === 'sans') détails.push('sans glaçons');
  if (l.glacons === 'peu') détails.push('peu de glaçons');
  const tops = Object.entries(l.toppings).map(
    ([id, p]) => `${trouverTopping(id)?.nom ?? id}${p !== 1 ? ` ×${p === 0.5 ? '½' : p}` : ''}`);
  if (tops.length) détails.push(tops.join(', '));
  if (l.chantilly) détails.push('chantilly');
  if (l.laitAvoine) détails.push("lait d'avoine");
  if (l.note) détails.push(`» ${l.note}`);
  return { nom: `${cat?.nom ?? ''} ${sav?.nom ?? ''}`.trim(), détails: détails.join(' · ') };
}

// Une date est-elle dans les horaires d'ouverture ? (true si horaires non configurés)
function dansHoraires(d: Date, horaires: any): boolean {
  if (!horaires) return true;
  const h = horaires[String(d.getDay())];
  if (!h || !h.ouvert) return false;
  const minutes = d.getHours() * 60 + d.getMinutes();
  const [deH, deM] = String(h.de || '00:00').split(':').map(Number);
  const [aH, aM] = String(h.a || '23:59').split(':').map(Number);
  return minutes >= deH * 60 + deM && minutes <= aH * 60 + aM;
}

// Créneaux de retrait : quarts d'heure sur les 2 prochaines heures, dans les horaires
function genererCreneaux(horaires: any): Date[] {
  const out: Date[] = [];
  const d = new Date(Date.now() + 15 * 60000); // premier créneau dans 15 min minimum
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15); // arrondi au quart d'heure suivant
  for (let i = 0; i < 8; i++) {
    const c = new Date(d.getTime() + i * 15 * 60000);
    if (dansHoraires(c, horaires)) out.push(c);
  }
  return out;
}

const heureCourte = (d: Date) =>
  d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

export default function PanierScreen() {
  const insets = useSafeAreaInsets();
  const lignes = usePanier();
  const magasin = useMagasin();
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [numeroOk, setNumeroOk] = useState<number | null>(null);
  // null = dès que possible, sinon ISO du créneau choisi
  const [creneau, setCreneau] = useState<string | null>(null);
  // Cadeau fidélité : boisson offerte disponible + choix du client
  const [cadeauxDispo, setCadeauxDispo] = useState(0);
  const [utiliserCadeau, setUtiliserCadeau] = useState(false);
  // Config boutique DU MAGASIN choisi (horaires + ouverture)
  const [configBoutique, setConfigBoutique] = useState<any>(null);
  useEffect(() => {
    supabase.from('boutique_config')
      .select('commandes_ouvertes, message_fermeture, horaires')
      .eq('id', magasin)
      .maybeSingle()
      .then(({ data }) => setConfigBoutique(data ?? {}));
  }, [magasin]);
  // Cadeaux disponibles sur la carte fidélité du compte
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: profil } = await supabase
          .from('profils').select('numero_fidelite').eq('id', session.user.id).maybeSingle();
        if (!profil?.numero_fidelite) return;
        const { data: carte } = await supabase
          .from('fidelite_cloud').select('cadeaux').eq('numero_fidelite', profil.numero_fidelite).maybeSingle();
        setCadeauxDispo(carte?.cadeaux || 0);
      } catch (_) { /* pas de cadeau affiché */ }
    })();
  }, []);
  const horaires = configBoutique?.horaires ?? null;
  const creneaux = useMemo(() => genererCreneaux(horaires), [horaires]);
  const ouvertMaintenant = dansHoraires(new Date(), horaires);
  // Si "dès que possible" mais boutique fermée → forcer le choix d'un créneau
  const fermeSansCreneau = !ouvertMaintenant && creneaux.length === 0;
  const total = totalPanier();
  const sousTotal = lignes.reduce((s, l) => s + l.prixUnitaire * l.quantite, 0);

  const envoyer = async () => {
    setMessage(null);
    setEnvoi(true);
    try {
      // 1. Connecté ?
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Connecte-toi dans l’onglet Compte pour envoyer ta commande.');
        return;
      }
      // 1ter. Toujours éligible ? (carte complétée / débloqué / admin — le serveur re-vérifie)
      if (!(await peutCommander())) {
        setMessage('La commande en ligne se débloque après ta première carte de fidélité complétée (9 tampons) en boutique.');
        return;
      }
      // 1bis. Boutique ouverte ? — config DU MAGASIN choisi (le serveur re-vérifie de toute façon)
      const { data: cfg } = await supabase
        .from('boutique_config')
        .select('commandes_ouvertes, message_fermeture')
        .eq('id', magasin)
        .maybeSingle();
      if (cfg && cfg.commandes_ouvertes === false) {
        setMessage(cfg.message_fermeture || 'Les commandes en ligne sont fermées pour le moment. Reviens plus tard !');
        return;
      }
      // Hors horaires : impossible aujourd'hui, ou créneau obligatoire
      if (fermeSansCreneau) {
        setMessage('La boutique est fermée — commande impossible pour le moment.');
        return;
      }
      if (!creneau && !ouvertMaintenant) {
        setMessage('Choisis un créneau de retrait.');
        return;
      }
      // 2. Création de la commande
      const { data: cmd, error } = await supabase
        .from('commandes')
        .insert({
          client_id: session.user.id,
          total_cents: Math.round(total * 100),
          mode_paiement: 'sur_place',
          creneau_retrait: creneau, // null = dès que possible
          magasin, // boutique de retrait choisie
          cadeau_demande: utiliserCadeau && cadeauxDispo > 0,
        })
        .select('id, numero')
        .single();
      if (error) throw error;

      // 3. Lignes de commande (produit figé en JSON)
      const items = lignes.map((l) => {
        const d = decrireLigne(l);
        return {
          commande_id: cmd.id,
          produit: { nom: d.nom, details: d.détails, brut: l },
          quantite: l.quantite,
          prix_cents: Math.round(l.prixUnitaire * 100),
        };
      });
      const { error: errItems } = await supabase.from('commande_items').insert(items);
      if (errItems) throw errItems;

      viderPanier();
      setNumeroOk(cmd.numero);
    } catch (e: any) {
      const txt = String(e?.message ?? e);
      // Refus du serveur quand la boutique vient de fermer (trigger SQL)
      if (txt.includes('BOUTIQUE_FERMEE')) {
        setMessage('Les commandes en ligne sont fermées pour le moment. Reviens plus tard !');
      } else {
        setMessage(txt);
      }
    } finally {
      setEnvoi(false);
    }
  };

  // === Confirmation ===
  if (numeroOk !== null) {
    return (
      <View style={[styles.fond, styles.centre]}>
        <View style={styles.okRond}>
          <Svg width={44} height={44} viewBox="0 0 24 24" fill="none">
            <Path d="M5 12.5 L10 17.5 L19 7" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <Text style={styles.okTitre}>Commande n°{numeroOk}</Text>
        <Text style={styles.okTexte}>
          C'est noté ! Paiement au retrait en boutique.{'\n'}Donne ton numéro en caisse.
        </Text>
        <BoutonPrimaire
          titre="Suivre ma commande"
          onPress={() => router.replace('/commander/mes-commandes' as any)}
          style={{ alignSelf: 'stretch', marginTop: 10 }}
        />
        <BoutonGhost titre="Retour à la carte" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.fond}>
      <ScrollView contentContainerStyle={[styles.contenu, { paddingTop: insets.top + 12 }]}>
        <View style={styles.enTete}>
          <BoutonRetour onPress={() => router.back()} />
          <Text style={styles.titre}>Mon panier</Text>
          <View style={{ width: 40 }} />
        </View>

        {lignes.length === 0 && (
          <View style={styles.videCarte}>
            <Text style={{ fontSize: 40 }}>🛒</Text>
            <Text style={styles.videTitre}>Ton panier est vide</Text>
            <BoutonPrimaire titre="Voir la carte" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
          </View>
        )}

        {lignes.map((l) => {
          const d = decrireLigne(l);
          return (
            <View key={l.id} style={styles.ligne}>
              {/* Tap sur la ligne → personnalisation pré-remplie (édition) */}
              <Pressable
                style={{ flex: 1, gap: 2 }}
                onPress={() => router.push(`/commander/${l.categorieId}?ligneId=${l.id}` as any)}>
                <Text style={styles.ligneNom}>{d.nom} <Text style={styles.ligneModifier}>✎</Text></Text>
                {!!d.détails && <Text style={styles.ligneDetails}>{d.détails}</Text>}
                <Text style={styles.lignePrix}>{eur(l.prixUnitaire * l.quantite)}</Text>
              </Pressable>
              <View style={{ alignItems: 'flex-end', gap: 8 }}>
                <Stepper
                  petit
                  valeur={l.quantite}
                  onMoins={() => (l.quantite <= 1 ? retirerLigne(l.id) : changerQuantite(l.id, -1))}
                  onPlus={() => changerQuantite(l.id, 1)}
                />
                <Pressable onPress={() => retirerLigne(l.id)} hitSlop={6}>
                  <Text style={styles.supprimer}>Retirer</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {/* === Cadeau fidélité (boisson offerte dispo) === */}
        {lignes.length > 0 && cadeauxDispo > 0 && (
          <Pressable style={styles.cadeauLigne} onPress={() => setUtiliserCadeau(!utiliserCadeau)}>
            <Text style={styles.cadeauTexte}>
              🎁 Utiliser ma boisson offerte (taille L, M pour Signature) — remise appliquée en caisse
            </Text>
            <View style={[styles.cadeauCase, utiliserCadeau && styles.cadeauCaseActive]}>
              <Text style={{ color: '#fff', fontFamily: F.t800 }}>{utiliserCadeau ? '✓' : ''}</Text>
            </View>
          </Pressable>
        )}

        {/* === Créneau de retrait === */}
        {lignes.length > 0 && (
          <>
            <Text style={styles.section}>
              Retrait — {MAGASINS.find((m) => m.id === magasin)?.nom}
            </Text>
            {fermeSansCreneau && (
              <Message type="erreur" texte="La boutique est fermée pour le moment — reviens pendant les horaires d'ouverture !" />
            )}
            <View style={styles.creneaux}>
              {ouvertMaintenant && (
                <Chip label="Dès que possible" actif={creneau === null} onPress={() => setCreneau(null)} />
              )}
              {creneaux.map((c) => {
                const iso = c.toISOString();
                return (
                  <Chip key={iso} label={heureCourte(c)} actif={creneau === iso} onPress={() => setCreneau(iso)} />
                );
              })}
            </View>

            {/* === Récap des totaux === */}
            <View style={styles.recap}>
              <View style={styles.recapLigne}>
                <Text style={styles.recapLabel}>Sous-total</Text>
                <Text style={styles.recapVal}>{eur(sousTotal)}</Text>
              </View>
              {remiseMochi() > 0 && (
                <View style={styles.recapLigne}>
                  <Text style={styles.recapLabel}>Remise mochis (pack de 2)</Text>
                  <Text style={[styles.recapVal, { color: C.vertFonce }]}>−{eur(remiseMochi())}</Text>
                </View>
              )}
              <View style={[styles.recapLigne, styles.recapTotal]}>
                <Text style={styles.recapTotalLabel}>Total</Text>
                <Text style={styles.recapTotalVal}>{eur(total)}</Text>
              </View>
              <Text style={styles.recapInfo}>Paiement au retrait, en boutique.</Text>
            </View>
          </>
        )}

        {message && <Message type="erreur" texte={message} />}
      </ScrollView>

      {lignes.length > 0 && (
        <View style={[styles.barreBas, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable style={[styles.btnEnvoyer, envoi && { opacity: 0.6 }]} onPress={envoyer} disabled={envoi}>
            {envoi
              ? <ActivityIndicator color={C.violetProfond} />
              : <Text style={styles.btnEnvoyerTxt}>Envoyer la commande · {eur(total)}</Text>}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  centre: { alignItems: 'center', justifyContent: 'center', padding: 26, gap: 12 },
  contenu: { padding: 18, gap: 12, paddingBottom: 120 },
  enTete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titre: { fontFamily: F.titre, fontSize: 22, color: C.violet },

  videCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 28,
    alignItems: 'center', gap: 12, marginTop: 20, ...OMBRE,
  },
  videTitre: { fontFamily: F.t800, fontSize: 17, color: C.texte },

  ligne: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.carte, borderRadius: 16, padding: 15, ...OMBRE,
  },
  ligneNom: { fontFamily: F.t800, fontSize: 15, color: C.texte },
  ligneModifier: { fontSize: 13, color: C.texte3 },
  ligneDetails: { fontFamily: F.t400, fontSize: 12.5, color: C.texte2, lineHeight: 17 },
  lignePrix: { fontFamily: F.t800, fontSize: 14, color: C.violetClair, marginTop: 3 },
  supprimer: { fontFamily: F.t700, fontSize: 12, color: C.danger },

  cadeauLigne: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.vertPale, borderRadius: 16, padding: 14,
    borderWidth: 1.5, borderColor: C.vert,
  },
  cadeauTexte: { flex: 1, fontFamily: F.t700, fontSize: 13, color: C.violetProfond, lineHeight: 18 },
  cadeauCase: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: '#C9D6A3',
    alignItems: 'center', justifyContent: 'center',
  },
  cadeauCaseActive: { backgroundColor: C.vert },

  section: { fontFamily: F.titre, fontSize: 16, color: C.violet, marginTop: 8 },
  creneaux: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  recap: { backgroundColor: C.carte, borderRadius: R.carte, padding: 18, gap: 10, marginTop: 6, ...OMBRE },
  recapLigne: { flexDirection: 'row', justifyContent: 'space-between' },
  recapLabel: { fontFamily: F.t600, fontSize: 14, color: C.texte2 },
  recapVal: { fontFamily: F.t700, fontSize: 14, color: C.texte },
  recapTotal: { borderTopWidth: 1, borderTopColor: C.bord, paddingTop: 10 },
  recapTotalLabel: { fontFamily: F.t800, fontSize: 16, color: C.texte },
  recapTotalVal: { fontFamily: F.t800, fontSize: 16, color: C.violet },
  recapInfo: { fontFamily: F.t400, fontSize: 12, color: C.texte3 },

  barreBas: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: C.carte, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingTop: 12, paddingHorizontal: 16,
    shadowColor: '#3A2A5E', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 10,
  },
  btnEnvoyer: { backgroundColor: C.vert, borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
  btnEnvoyerTxt: { fontFamily: F.t800, fontSize: 16, color: C.violetProfond },

  okRond: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: C.vert,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6, ...OMBRE,
  },
  okTitre: { fontFamily: F.titre, fontSize: 26, color: C.violet },
  okTexte: { fontFamily: F.t600, fontSize: 15, color: C.texte2, textAlign: 'center', lineHeight: 22 },
});
