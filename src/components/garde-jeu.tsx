// === Garde commune aux trois jeux : Boba Quest, Boba Tower, La Roue du Mois ===
// Les trois se jouent avec un compte, et leurs lots se retirent en boutique avec la
// carte de fidélité. Un visiteur non inscrit ne doit donc ni les voir sur l'accueil,
// ni pouvoir les ouvrir par lien direct.
//
// ⚠️ Ce n'est PAS une sécurité. Un client modifié passe outre n'importe quelle
// condition d'interface. La vraie barrière est côté serveur — les RPC de jeu exigent
// déjà une session et une carte active (`acces au jeu non autorise`, `carte fidelite
// inactive`). Ce que cette garde évite, c'est qu'un visiteur joue, gagne, et se prenne
// un refus à l'écran suivant.
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { BORD, C, F, OMBRE, R } from '@/constants/charte';
import { BoutonPrimaire, BoutonRetour } from '@/components/ui-kit';

/**
 * Session, de façon RÉACTIVE : un visiteur qui s'inscrit depuis l'écran d'invite
 * revient au jeu sans avoir à le rouvrir.
 * `null` = pas encore su → on n'affiche rien (fail-closed, comme les flags serveur).
 */
export function useEstConnecte(): boolean | null {
  const [connecte, setConnecte] = useState<boolean | null>(null);
  useEffect(() => {
    let vivant = true;
    supabase.auth.getSession()
      .then(({ data }) => { if (vivant) setConnecte(!!data.session); })
      .catch(() => { if (vivant) setConnecte(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (vivant) setConnecte(!!session);
    });
    return () => { vivant = false; sub.subscription.unsubscribe(); };
  }, []);
  return connecte;
}

/**
 * Écran d'invite : on explique ce qui se joue et on emmène s'inscrire — jamais un
 * mur sec. `emoji` et `texte` situent le jeu concerné.
 */
export function InviteInscription({
  emoji, titre = 'Crée ton compte pour jouer', texte,
}: { emoji: string; titre?: string; texte: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.fond, { paddingTop: insets.top + 10 }]}>
      <View style={styles.entete}>
        <BoutonRetour onPress={() => router.back()} />
      </View>
      <View style={styles.zone}>
        <View style={styles.carte}>
          <Text style={styles.emoji}>{emoji}</Text>
          <Text style={styles.titre}>{titre}</Text>
          <Text style={styles.texte}>{texte}</Text>
          <BoutonPrimaire
            titre="Créer mon compte"
            onPress={() => router.push('/compte' as any)}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      </View>
    </View>
  );
}

/** Écran neutre le temps de savoir : ni jeu, ni invite, ni clignotement. */
export function EcranAttente() {
  return <View style={styles.fond} />;
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.fond },
  entete: { paddingHorizontal: 16, paddingBottom: 4 },
  zone: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  carte: {
    backgroundColor: '#fff', borderRadius: R.carte, padding: 22, gap: 12,
    alignItems: 'center', borderWidth: BORD.largeur, borderColor: BORD.surBlanc, ...OMBRE,
  },
  emoji: { fontSize: 40 },
  titre: { fontFamily: F.titre, fontSize: 20, color: C.violet, textAlign: 'center' },
  texte: { fontFamily: F.t400, fontSize: 14.5, color: C.texte2, textAlign: 'center', lineHeight: 20 },
});
