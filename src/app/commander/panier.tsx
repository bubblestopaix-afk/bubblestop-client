// === Panier + envoi de la commande vers Supabase ===
// V1 : paiement au retrait (sur place). Stripe viendra en V2.
import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

const VIOLET = '#3A2A5E';
const VIOLET_PROFOND = '#2A1D46';
const VERT = '#A3C724';
const LAVANDE = '#EFE9F6';

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

export default function PanierScreen() {
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
          .from('fidelite_cloud').select('cadeaux').eq('telephone', profil.numero_fidelite).maybeSingle();
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
      // 1bis. Boutique ouverte ? (le serveur re-vérifie de toute façon)
      const { data: cfg } = await supabase
        .from('boutique_config')
        .select('commandes_ouvertes, message_fermeture')
        .eq('id', 'principal')
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
        <Text style={{ fontSize: 56 }}>✅</Text>
        <Text style={styles.titre}>Commande n°{numeroOk}</Text>
        <Text style={styles.aide}>
          C'est noté ! Paiement au retrait en boutique.{'\n'}Donne ton numéro en caisse.
        </Text>
        <Pressable
          style={styles.btn}
          onPress={() => router.replace('/commander/mes-commandes' as any)}>
          <Text style={styles.btnTexte}>Suivre ma commande</Text>
        </Pressable>
        <Pressable style={styles.btnGhostConfirm} onPress={() => router.back()}>
          <Text style={styles.btnGhostConfirmTexte}>Retour à la carte</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.fond}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.contenu}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.retour}>‹ Retour</Text>
          </Pressable>
          <Text style={styles.titre}>Mon panier</Text>

          {lignes.length === 0 && <Text style={styles.aide}>Ton panier est vide.</Text>}

          {lignes.map((l) => {
            const d = decrireLigne(l);
            return (
              <View key={l.id} style={styles.ligne}>
                {/* Tap sur la ligne → personnalisation pré-remplie (édition) */}
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => router.push(`/commander/${l.categorieId}?ligneId=${l.id}` as any)}>
                  <Text style={styles.ligneNom}>{d.nom} <Text style={styles.ligneModifier}>✎</Text></Text>
                  {!!d.détails && <Text style={styles.ligneDetails}>{d.détails}</Text>}
                  <Text style={styles.lignePrix}>
                    {(l.prixUnitaire * l.quantite).toFixed(2).replace('.', ',')} €
                  </Text>
                </Pressable>
                <View style={styles.qte}>
                  <Pressable style={styles.qteBtn} onPress={() => changerQuantite(l.id, -1)}>
                    <Text style={styles.qteBtnTexte}>−</Text>
                  </Pressable>
                  <Text style={styles.qteNb}>{l.quantite}</Text>
                  <Pressable style={styles.qteBtn} onPress={() => changerQuantite(l.id, 1)}>
                    <Text style={styles.qteBtnTexte}>+</Text>
                  </Pressable>
                </View>
                <Pressable onPress={() => retirerLigne(l.id)} style={{ padding: 6 }}>
                  <Text style={{ fontSize: 18 }}>🗑️</Text>
                </Pressable>
              </View>
            );
          })}

          {/* Remise mochis « pack de 2 » : −0,50€ par paire, comme en caisse */}
          {remiseMochi() > 0 && (
            <View style={[styles.ligne, { alignItems: 'center' }]}>
              <Text style={[styles.ligneNom, { flex: 1 }]}>🍡 Remise mochis (pack de 2)</Text>
              <Text style={styles.lignePrix}>−{remiseMochi().toFixed(2).replace('.', ',')} €</Text>
            </View>
          )}

          {/* === Cadeau fidélité (boisson offerte dispo) === */}
          {lignes.length > 0 && cadeauxDispo > 0 && (
            <Pressable style={styles.cadeauLigne} onPress={() => setUtiliserCadeau(!utiliserCadeau)}>
              <Text style={styles.cadeauTexte}>
                🎁 Utiliser ma boisson offerte (taille L, M pour Signature) — remise appliquée en caisse
              </Text>
              <View style={[styles.cadeauCase, utiliserCadeau && styles.cadeauCaseActive]}>
                <Text style={{ color: '#fff', fontWeight: '900' }}>{utiliserCadeau ? '✓' : ''}</Text>
              </View>
            </Pressable>
          )}

          {/* === Créneau de retrait === */}
          {lignes.length > 0 && (
            <>
              <Text style={styles.sectionCreneau}>
                Retrait — {MAGASINS.find((m) => m.id === magasin)?.nom}
              </Text>
              {fermeSansCreneau && (
                <Text style={styles.message}>
                  La boutique est fermée pour le moment — reviens pendant les horaires d'ouverture !
                </Text>
              )}
              <View style={styles.creneaux}>
                {ouvertMaintenant && (
                  <Pressable
                    style={[styles.creneauChip, creneau === null && styles.creneauChipActif]}
                    onPress={() => setCreneau(null)}>
                    <Text style={[styles.creneauTexte, creneau === null && styles.creneauTexteActif]}>
                      Dès que possible
                    </Text>
                  </Pressable>
                )}
                {creneaux.map((c) => {
                  const iso = c.toISOString();
                  const actif = creneau === iso;
                  return (
                    <Pressable
                      key={iso}
                      style={[styles.creneauChip, actif && styles.creneauChipActif]}
                      onPress={() => setCreneau(iso)}>
                      <Text style={[styles.creneauTexte, actif && styles.creneauTexteActif]}>
                        {heureCourte(c)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {message && <Text style={styles.message}>{message}</Text>}
        </ScrollView>

        {lignes.length > 0 && (
          <Pressable style={[styles.btnEnvoyer, envoi && { opacity: 0.6 }]} onPress={envoyer} disabled={envoi}>
            {envoi
              ? <ActivityIndicator color={VIOLET_PROFOND} />
              : <Text style={styles.btnTexte}>
                  Envoyer — {total.toFixed(2).replace('.', ',')} € (paiement au retrait)
                </Text>}
          </Pressable>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: VIOLET },
  centre: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  safe: { flex: 1 },
  contenu: { padding: 20, gap: 12, paddingBottom: 110 },
  retour: { color: LAVANDE, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  titre: { fontSize: 26, fontWeight: '900', color: '#fff' },
  aide: { fontSize: 15, color: LAVANDE, textAlign: 'center', lineHeight: 22 },
  ligne: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
  },
  ligneNom: { fontWeight: '800', fontSize: 15, color: VIOLET_PROFOND },
  ligneModifier: { fontSize: 13, color: '#60646C' },
  ligneDetails: { fontSize: 12.5, color: '#60646C', marginTop: 2 },
  lignePrix: { fontWeight: '800', fontSize: 14, color: VIOLET, marginTop: 4 },
  qte: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qteBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: LAVANDE,
    alignItems: 'center', justifyContent: 'center',
  },
  qteBtnTexte: { fontSize: 18, fontWeight: '900', color: VIOLET_PROFOND },
  qteNb: { fontWeight: '900', fontSize: 16, color: VIOLET_PROFOND, minWidth: 18, textAlign: 'center' },
  message: { color: '#FFD166', fontSize: 14, textAlign: 'center', paddingHorizontal: 16 },
  sectionCreneau: { fontSize: 17, fontWeight: '800', color: VERT, marginTop: 8 },
  cadeauLigne: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#EDF5D0', borderRadius: 14, padding: 14,
  },
  cadeauTexte: { flex: 1, fontSize: 13.5, fontWeight: '800', color: VIOLET_PROFOND },
  cadeauCase: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: '#c9d6a3',
    alignItems: 'center', justifyContent: 'center',
  },
  cadeauCaseActive: { backgroundColor: VERT },
  creneaux: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  creneauChip: { backgroundColor: '#ffffff22', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 },
  creneauChipActif: { backgroundColor: VERT },
  creneauTexte: { color: LAVANDE, fontWeight: '700', fontSize: 14 },
  creneauTexteActif: { color: VIOLET_PROFOND },
  btn: { backgroundColor: VERT, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32 },
  btnGhostConfirm: { padding: 12 },
  btnGhostConfirmTexte: { color: LAVANDE, fontWeight: '700', fontSize: 15, textDecorationLine: 'underline' },
  btnEnvoyer: {
    position: 'absolute', left: 16, right: 16, bottom: 12,
    backgroundColor: VERT, borderRadius: 16, padding: 18, alignItems: 'center',
  },
  btnTexte: { fontWeight: '900', fontSize: 16, color: VIOLET_PROFOND },
});
