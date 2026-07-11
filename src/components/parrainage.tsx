// === 🤝 Parrainage (carte fidélité) ===
// Ton code parrain = ton numéro de fidélité. Un ami l'entre à l'inscription (ou scanne
// ton QR) → à sa 1ère VRAIE commande, tampons pour lui ET pour toi, crédités À LA
// SECONDE (11/07 : trigger SQL fidelite_parrainage_instant → edge recompenser-numero,
// demandes appliquées instantanément côté cloud — le tick quotidien reste en filet).
// Récompenses réglables côté serveur (agent_config : parrain_tampons / filleul_tampons).
// Tout passe par l'edge `agent-bubblestop` (actions mon-parrainage / parrainer, JWT).
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Share, Platform } from 'react-native';

import { C, F, OMBRE } from '@/constants/charte';
import { ChampTexte, Message, BoutonPrimaire, BoutonGhost } from '@/components/ui-kit';
import QrView from '@/components/qr-view';
import { appelAgent, lienParrainage, appliquerParrainEnAttente } from '@/lib/parrainage';

type Etat = {
  code: string | null;
  filleuls: { total: number; recompenses: number };
  dejaParraine: boolean;
  recompenses: { parrain: number; filleul: number };
};

export default function Parrainage() {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null);

  const charger = () => {
    appelAgent({ action: 'mon-parrainage' }).then((d) => { if (d?.ok) setEtat(d as Etat); });
  };
  useEffect(() => {
    // Un code scanné avant la connexion (/p) attend peut-être → on l'applique d'abord.
    appliquerParrainEnAttente().then((r) => { if (r) setMsg({ ok: r.ok, texte: r.message }); }).finally(charger);
  }, []);

  if (!etat) return null; // pas connecté / réseau : la section s'efface simplement

  const partager = async () => {
    if (!etat.code) return;
    const texte = `Rejoins-moi chez Bubble Stop 🧋 Crée ton compte avec mon lien ${lienParrainage(etat.code)} : 1 tampon de bienvenue direct, et +${etat.recompenses.filleul} tampons dès ta 1ère commande ! (code : ${etat.code})`;
    try {
      if (Platform.OS === 'web' && (navigator as any)?.share) await (navigator as any).share({ text: texte });
      else await Share.share({ message: texte });
    } catch { /* partage annulé */ }
  };

  const valider = async () => {
    const code = saisie.replace(/\D/g, '');
    if (code.length < 6) { setMsg({ ok: false, texte: 'Entre le code de ton parrain (8 chiffres).' }); return; }
    setEnCours(true); setMsg(null);
    const d = await appelAgent({ action: 'parrainer', code });
    setEnCours(false);
    if (d?.ok) { setMsg({ ok: true, texte: d.message || 'Parrainage enregistré !' }); setSaisie(''); charger(); }
    else setMsg({ ok: false, texte: d?.erreur || 'Le parrainage a échoué, réessaie.' });
  };

  return (
    <View style={styles.carte}>
      <Text style={styles.titre}>Parrainage</Text>
      <Text style={styles.sous}>
        Fais découvrir Bubble Stop — vous êtes récompensés tous les deux, à la seconde de sa première commande.
      </Text>

      {/* Comment ça marche — les vraies règles (valeurs réglées côté serveur) */}
      <View style={styles.etapes}>
        <Text style={styles.etape}>1️⃣  Partage ton QR ou ton code à un ami</Text>
        <Text style={styles.etape}>2️⃣  Il crée son compte avec ton code → il démarre avec 1 tampon de bienvenue</Text>
        <Text style={styles.etape}>
          3️⃣  À sa 1ère commande : +{etat.recompenses.filleul} tampons pour lui (en plus de ceux de ses boissons)
          et +{etat.recompenses.parrain} pour toi — crédités instantanément, tu reçois une notification 🎉
        </Text>
      </View>

      {etat.code ? (
        <>
          {/* QR à faire scanner EN PERSONNE (caméra du filleul → /p?c=<code> → liaison auto).
              Le code texte reste pour l'envoi À DISTANCE (partage / saisie manuelle). */}
          <View style={styles.qrBloc}>
            <QrView valeur={lienParrainage(etat.code)} taille={150} />
            <Text style={styles.qrAide}>Fais scanner ce QR avec l'appareil photo de ton ami·e — son parrainage s'applique tout seul.</Text>
          </View>
          <View style={styles.codeBloc}>
            <Text style={styles.codeLabel}>Ton code parrain</Text>
            <Text style={styles.code}>{etat.code}</Text>
          </View>
          <BoutonPrimaire titre="Partager mon lien" onPress={partager} />
          {etat.filleuls.total > 0 && (
            <Text style={styles.compteur}>
              {etat.filleuls.recompenses}/{etat.filleuls.total} filleul{etat.filleuls.total > 1 ? 's' : ''} récompensé{etat.filleuls.recompenses > 1 ? 's' : ''}
            </Text>
          )}
        </>
      ) : (
        <Text style={styles.aide}>Active ta carte ci-dessus pour recevoir ton code parrain.</Text>
      )}

      {/* Saisir un code (nouveaux comptes uniquement, un seul parrain — vérifié côté serveur) */}
      {!etat.dejaParraine && (
        <View style={styles.saisieBloc}>
          <Text style={styles.saisieTitre}>On t'a parrainé ?</Text>
          <ChampTexte
            label="Code de ton parrain"
            value={saisie}
            onChangeText={(v: string) => setSaisie(String(v || '').replace(/\D/g, '').slice(0, 10))}
            placeholder="12345678"
            keyboardType="number-pad"
          />
          {msg && <Message type={msg.ok ? 'ok' : 'erreur'} texte={msg.texte} />}
          <BoutonGhost titre={enCours ? '…' : 'Valider mon parrain'} onPress={valider} />
        </View>
      )}
      {etat.dejaParraine && msg?.ok !== true && (
        <Text style={styles.compteur}>Parrainage enregistré ✓ — vos tampons tombent à la seconde de ta 1ère commande ⚡</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { backgroundColor: C.carte, borderRadius: 20, padding: 18, gap: 10, ...OMBRE },
  titre: { fontFamily: F.t800, fontSize: 15, color: C.violetProfond },
  sous: { fontFamily: F.t400, fontSize: 13, color: C.texte2, lineHeight: 18 },
  qrBloc: { alignItems: 'center', gap: 8 },
  qrAide: { fontFamily: F.t600, fontSize: 12, color: C.texte2, textAlign: 'center', lineHeight: 17 },
  codeBloc: { alignItems: 'center', backgroundColor: C.fond, borderRadius: 14, paddingVertical: 10 },
  codeLabel: { fontFamily: F.t600, fontSize: 11.5, color: C.texte2 },
  code: { fontFamily: F.titre, fontSize: 26, color: C.violet, letterSpacing: 3 },
  compteur: { fontFamily: F.t600, fontSize: 12.5, color: C.violetClair, textAlign: 'center' },
  aide: { fontFamily: F.t400, fontSize: 12.5, color: C.texte2 },
  saisieBloc: { borderTopWidth: 1, borderTopColor: C.lavande, paddingTop: 10, gap: 8 },
  saisieTitre: { fontFamily: F.t700, fontSize: 13.5, color: C.texte },
  etapes: { gap: 6, backgroundColor: C.fond, borderRadius: 14, padding: 12 },
  etape: { fontFamily: F.t600, fontSize: 12.5, color: C.texte, lineHeight: 18 },
});
