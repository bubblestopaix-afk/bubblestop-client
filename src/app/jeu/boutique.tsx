// === Boba Quest — boutique des prix + « Mes prix » ===
// Les perles s'échangent contre des PRIX RÉELS (paliers volontairement longs :
// c'est le sink de l'économie). En bas : la liste des prix gagnés (sets, roulette,
// boutique) avec leur statut.
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { BORD, C, F, OMBRE, R } from '@/constants/charte';
import { BOUTIQUE, Gain } from '@/components/jeu/economie';
import { Icone } from '@/components/jeu/icones';
import {
  BandeauPreview, BoutonJeu, EnTeteJeu, formatNb, IconePerle,
} from '@/components/jeu/ui-jeu';
import { hapticSucces } from '@/lib/juice';
import { chargerDemandesRecompensesJeu, creerDemandeRecompenseJeu } from '@/lib/recompenses-jeu';
import { supabase } from '@/lib/supabase';
import {
  acheterBoutique, mettreGainEnAttente, restantCeMois,
  synchroniserGainsServeur, useBobaQuest,
} from '@/store/jeu';

const ORIGINES: Record<Gain['origine'], string> = {
  set: 'Set complété',
  collection: 'Collection complète',
  boutique: 'Boutique',
  roulette: 'Roulette du mois',
  quete: 'Quête « Mon premier tampon »',
};

export default function BoutiqueScreen() {
  const insets = useSafeAreaInsets();
  const etat = useBobaQuest();
  const [celebration, setCelebration] = useState<Gain | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [envoiId, setEnvoiId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null);
  const detail = detailId ? etat.gains.find((g) => g.id === detailId) || null : null;

  const synchroniser = useCallback(async () => {
    try {
      const demandes = await chargerDemandesRecompensesJeu();
      synchroniserGainsServeur(demandes);
    } catch {
      // Le jeu reste disponible hors-ligne. Une demande réelle n'est toutefois
      // jamais marquée utilisée tant que le serveur ne l'a pas confirmée.
    }
  }, []);

  useFocusEffect(useCallback(() => { void synchroniser(); }, [synchroniser]));
  useEffect(() => {
    const canal = supabase.channel('boba-quest-recompenses')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'jeu_recompenses_demandes',
      }, () => { void synchroniser(); })
      .subscribe();
    return () => { void supabase.removeChannel(canal); };
  }, [synchroniser]);

  const preparerPourCaisse = async (gain: Gain) => {
    if (gain.statut !== 'a_reclamer' || envoiId) return;
    setEnvoiId(gain.id);
    setMessage(null);
    try {
      const demande = await creerDemandeRecompenseJeu(gain.id, gain.code);
      mettreGainEnAttente(gain.id, demande.id);
      setMessage({
        type: 'ok',
        texte: 'Prix prêt : scanne ton QR fidélité en boutique. La caisse affichera la demande et l’équipe la validera avec toi.',
      });
      await synchroniser();
    } catch (e) {
      setMessage({
        type: 'erreur',
        texte: e instanceof Error ? e.message : 'Impossible de préparer ce prix pour le moment.',
      });
    } finally {
      setEnvoiId(null);
    }
  };

  return (
    <View style={[styles.fond, { paddingTop: insets.top + 10 }]}>
      <View style={{ paddingHorizontal: 18 }}>
        <EnTeteJeu titre="Boutique des prix" onRetour={() => router.back()} perles={etat.perles} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.pitch}>
          Échange tes perles contre de vrais prix Bubble Stop
        </Text>

        {BOUTIQUE.map((p) => {
          const restant = restantCeMois(p.id, etat);
          const plafonne = restant <= 0;
          const possible = etat.perles >= p.cout && !plafonne;
          const progression = Math.min(1, etat.perles / p.cout);
          return (
            <View key={p.id} style={[styles.palier, plafonne && { opacity: 0.6 }]}>
              <View style={styles.palierHaut}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.palierLabel}>{p.label}</Text>
                  <Text style={styles.palierDetail}>{p.detail}</Text>
                </View>
                <View style={styles.cout}>
                  <IconePerle taille={15} />
                  <Text style={styles.coutTxt}>{formatNb(p.cout)}</Text>
                </View>
              </View>
              {/* 🗓️ Plafond mensuel : la règle ET où j'en suis, directement dans la carte */}
              <View style={[styles.mois, plafonne ? styles.moisPlein : styles.moisDispo]}>
                <Icone nom={plafonne ? 'sablier' : 'check'} taille={14} />
                <Text style={[styles.moisTxt, { color: plafonne ? C.texte2 : C.vertFonce }]}>
                  {p.parMois === 1
                    ? (plafonne ? '1 par mois — déjà pris, de retour le 1er du mois' : '1 par mois — encore disponible ce mois-ci')
                    : (plafonne ? `${p.parMois} par mois — plafond atteint, de retour le 1er` : `${p.parMois} par mois — encore ${restant} ce mois-ci`)}
                </Text>
              </View>
              <View style={styles.barre}>
                <View style={[styles.barreRemplie, { width: `${progression * 100}%` }]} />
              </View>
              {possible ? (
                <BoutonJeu
                  titre="Échanger"
                  onPress={() => { const g = acheterBoutique(p.id); if (g) { setCelebration(g); hapticSucces(); } }}
                />
              ) : (
                <View style={styles.indispo} accessibilityRole="text">
                  <Text style={styles.indispoTxt}>
                    {plafonne ? 'Reviens le mois prochain' : `Encore ${formatNb(p.cout - etat.perles)} perles`}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {/* === Mes prix === */}
        <View style={styles.sectionTitreRang}><Icone nom="cadeau" taille={19} /><Text style={styles.sectionTitre}>Mes prix</Text></View>
        {etat.gains.length === 0 ? (
          <View style={styles.vide}>
            <Icone nom="cadeau" taille={34} />
            <Text style={styles.videTxt}>
              Aucun prix pour l'instant — complète un set, tourne la roulette du mois
              ou économise tes perles !
            </Text>
          </View>
        ) : (
          etat.gains.map((g) => (
            <Pressable key={g.id} style={styles.gain} onPress={() => { setDetailId(g.id); setMessage(null); }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.gainLabel, g.statut === 'utilise' && styles.gainUtilise]}>
                  {g.label}
                </Text>
                <Text style={styles.gainOrigine}>
                  {ORIGINES[g.origine]} · {new Date(g.gagneLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                </Text>
              </View>
              <View style={[
                styles.statut,
                g.statut === 'utilise' ? styles.statutUtilise
                  : g.statut === 'en_attente' ? styles.statutAttente
                    : g.statut === 'refuse' ? styles.statutRefuse : styles.statutAReclamer,
              ]}>
                <Text style={[styles.statutTxt, g.statut === 'utilise' && { color: C.texte3 }]}>
                  {g.statut === 'utilise' ? 'Utilisé'
                    : g.statut === 'en_attente' ? 'Prêt en caisse'
                      : g.statut === 'refuse' ? 'Indisponible' : 'À réclamer'}
                </Text>
              </View>
            </Pressable>
          ))
        )}

        <BandeauPreview />
      </ScrollView>

      {/* Célébration achat */}
      <Modal visible={!!celebration} transparent animationType="fade" onRequestClose={() => setCelebration(null)}>
        {celebration && (
          <View style={styles.modalFond}>
            <View style={styles.modalCarte}>
              <Icone nom="cadeau" taille={46} />
              <Text style={styles.modalTitre}>Prix débloqué !</Text>
              <Text style={styles.modalLabel}>{celebration.label}</Text>
              <Text style={styles.modalTexte}>
                Il est maintenant disponible dans « Mes prix » juste en dessous.
              </Text>
              <BoutonJeu titre="Parfait !" onPress={() => setCelebration(null)} style={{ alignSelf: 'stretch' }} />
            </View>
          </View>
        )}
      </Modal>

      {/* Détail d'un prix */}
      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetailId(null)}>
        {detail && (
          <Pressable style={styles.modalFond} onPress={() => setDetailId(null)}>
            <Pressable style={styles.modalCarte} onPress={() => {}}>
              <Icone nom="cadeau" taille={38} />
              <Text style={styles.modalLabel}>{detail.label}</Text>
              <Text style={styles.modalTexte}>
                {detail.type === 'reduction'
                  ? 'Prépare ce prix, puis scanne ton QR fidélité pendant ta prochaine commande. La caisse appliquera automatiquement la réduction après confirmation.'
                  : detail.type === 'boisson'
                    ? 'Prépare ce prix, puis scanne ton QR fidélité en boutique. Après confirmation en caisse, la grande boisson offerte sera ajoutée à ta carte.'
                    : 'Prépare ce prix, puis scanne ton QR fidélité en boutique. Après confirmation en caisse, les tampons seront ajoutés automatiquement à ta carte.'}
              </Text>
              {detail.statut === 'a_reclamer' && (
                <Pressable
                  disabled={!!envoiId}
                  onPress={() => { void preparerPourCaisse(detail); }}
                  style={styles.btnUtilise}
                >
                  <Text style={styles.btnUtiliseTxt}>
                    {envoiId === detail.id ? 'Préparation…' : 'Préparer pour la caisse'}
                  </Text>
                </Pressable>
              )}
              {detail.statut === 'en_attente' && (
                <View style={styles.infoAttente}>
                  <Text style={styles.infoAttenteTxt}>
                    Demande prête · elle apparaîtra au prochain scan de ton QR fidélité et restera disponible jusqu’à sa validation.
                  </Text>
                </View>
              )}
              {detail.statut === 'utilise' && (
                <Text style={styles.confirme}>✓ Confirmé par la caisse</Text>
              )}
              {message && (
                <View style={[styles.message, message.type === 'erreur' && styles.messageErreur]}>
                  <Text style={[styles.messageTxt, message.type === 'erreur' && styles.messageErreurTxt]}>{message.texte}</Text>
                </View>
              )}
              <BoutonJeu titre="Fermer" onPress={() => setDetailId(null)} style={{ alignSelf: 'stretch' }} />
            </Pressable>
          </Pressable>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  contenu: { padding: 18, gap: 14, paddingBottom: 34 },
  pitch: { fontFamily: F.t700, fontSize: 14.5, color: C.texte2, textAlign: 'center' },
  // 🗓️ pastille « plafond mensuel » intégrée à chaque carte
  mois: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1,
  },
  moisDispo: { backgroundColor: C.vertPale, borderColor: C.vert },
  moisPlein: { backgroundColor: C.fond, borderColor: C.bord },
  moisTxt: { fontFamily: F.t700, fontSize: 11.5 },

  palier: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 16, gap: 12,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  palierHaut: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  palierLabel: { fontFamily: F.titre, fontSize: 16.5, color: C.violet },
  palierDetail: { fontFamily: F.t600, fontSize: 12.5, color: C.texte2, marginTop: 2 },
  cout: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.lavande, borderRadius: R.pill, paddingVertical: 6, paddingHorizontal: 11,
  },
  coutTxt: { fontFamily: F.t800, fontSize: 13.5, color: C.violetProfond },
  barre: { height: 8, borderRadius: 4, backgroundColor: C.lavande, overflow: 'hidden' },
  indispo: { backgroundColor: C.lavande, borderRadius: 14, padding: 12, alignItems: 'center' },
  indispoTxt: { fontFamily: F.t800, fontSize: 13.5, color: C.texte3 },
  barreRemplie: { height: 8, borderRadius: 4, backgroundColor: C.vert },

  sectionTitre: { fontFamily: F.titre, fontSize: 18, color: C.violet },
  sectionTitreRang: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },

  vide: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 22,
    alignItems: 'center', gap: 8,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  videTxt: { fontFamily: F.t600, fontSize: 13, color: C.texte2, textAlign: 'center', lineHeight: 19 },

  gain: {
    backgroundColor: C.carte, borderRadius: R.btn + 2, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  gainLabel: { fontFamily: F.t700, fontSize: 14.5, color: C.texte },
  gainUtilise: { color: C.texte3, textDecorationLine: 'line-through' },
  gainOrigine: { fontFamily: F.t600, fontSize: 12, color: C.texte3, marginTop: 2 },
  statut: { borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 10 },
  statutAReclamer: { backgroundColor: C.vertPale, borderWidth: 1, borderColor: C.vert },
  statutAttente: { backgroundColor: C.jaunePale, borderWidth: 1, borderColor: C.jaune },
  statutRefuse: { backgroundColor: '#FBE5E5', borderWidth: 1, borderColor: '#D96B6B' },
  statutUtilise: { backgroundColor: C.fond, borderWidth: 1, borderColor: C.bord },
  statutTxt: { fontFamily: F.t800, fontSize: 11, color: C.vertFonce },

  modalFond: {
    flex: 1, backgroundColor: 'rgba(42,29,70,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  modalCarte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 24,
    alignItems: 'center', gap: 12, alignSelf: 'stretch',
    borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  modalTitre: { fontFamily: F.titre, fontSize: 22, color: C.violet },
  modalLabel: { fontFamily: F.t800, fontSize: 16, color: C.vertFonce, textAlign: 'center' },
  modalTexte: { fontFamily: F.t400, fontSize: 13.5, color: C.texte2, textAlign: 'center', lineHeight: 20 },
  btnUtilise: { alignSelf: 'stretch', paddingVertical: 13, paddingHorizontal: 16, borderRadius: R.btn, backgroundColor: C.vert, alignItems: 'center' },
  btnUtiliseTxt: { fontFamily: F.t800, fontSize: 14, color: C.violetProfond },
  infoAttente: { alignSelf: 'stretch', borderRadius: 14, backgroundColor: C.jaunePale, padding: 12 },
  infoAttenteTxt: { fontFamily: F.t600, fontSize: 12.5, color: C.texte, lineHeight: 18, textAlign: 'center' },
  confirme: { fontFamily: F.t800, fontSize: 13.5, color: C.vertFonce },
  message: { alignSelf: 'stretch', borderRadius: 14, backgroundColor: C.vertPale, padding: 12 },
  messageErreur: { backgroundColor: '#FBE5E5' },
  messageTxt: { fontFamily: F.t700, fontSize: 12.5, color: C.vertFonce, lineHeight: 18, textAlign: 'center' },
  messageErreurTxt: { color: '#9C2D2D' },
});
