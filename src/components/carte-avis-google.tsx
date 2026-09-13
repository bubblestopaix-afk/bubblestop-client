import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { lireDestinationAvisGoogle } from '@/lib/avis-google';
import { C, F, R } from '@/constants/charte';

export default function CarteAvisGoogle() {
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState('');
  const [lienWeb, setLienWeb] = useState<{ nom: string; url: string } | null>(null);
  const verrou = useRef(false);
  const vivant = useRef(true);
  useEffect(() => { vivant.current = true; return () => { vivant.current = false; }; }, []);

  async function ouvrir() {
    if (verrou.current) return;
    verrou.current = true;
    setChargement(true);
    setMessage('');
    setLienWeb(null);
    try {
      const destination = await lireDestinationAvisGoogle({
        lireCompte: async () => {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw new Error('Connexion indisponible. Réessaie dans un instant.');
          return data.session?.user.id ?? null;
        },
        lireProfil: async (compte) => {
          const { data, error } = await supabase.from('profils')
            .select('dernier_magasin_scan').eq('id', compte).maybeSingle();
          if (error) throw new Error('Impossible de retrouver ton dernier magasin. Réessaie dans un instant.');
          return data;
        },
      });
      if (!vivant.current) return;
      // Sur le web, le clic direct sur un lien évite les fenêtres bloquées après
      // une lecture asynchrone. Sur téléphone, le navigateur s'ouvre directement.
      if (Platform.OS === 'web') setLienWeb(destination);
      else await Linking.openURL(destination.url);
      if (vivant.current) setMessage(`Boutique de ton dernier scan : ${destination.nom}.`);
    } catch (erreur) {
      if (vivant.current) setMessage(erreur instanceof Error && /^(Connecte-toi|Ton compte|Scanne ta carte|Connexion indisponible|Impossible de retrouver)/.test(erreur.message)
        ? erreur.message : 'Google ne s’est pas ouvert. Réessaie dans un instant.');
    } finally {
      verrou.current = false;
      if (vivant.current) setChargement(false);
    }
  }

  return (
    <View style={s.carte}>
      <Text style={s.titre}>Ton avis compte</Text>
      <Text style={s.texte}>Raconte ton expérience dans la boutique de ton dernier scan.</Text>
      <Pressable onPress={ouvrir} disabled={chargement} accessibilityRole="button"
        accessibilityState={{ disabled: chargement, busy: chargement }}
        style={({ pressed }) => [s.bouton, (pressed || chargement) && { opacity: 0.7 }]}>
        <Text style={s.action}>{chargement ? 'Recherche de ta boutique…' : 'Donner mon avis sur Google ↗'}</Text>
      </Pressable>
      <Text style={s.precision}>Un avis libre, avec tes mots.</Text>
      {!!message && <Text accessibilityRole="alert" style={s.message}>{message}</Text>}
      {lienWeb && (
        <Link href={lienWeb.url as `https://${string}`} target="_blank" rel="noopener noreferrer" asChild>
          <Pressable accessibilityRole="link" style={s.bouton}>
            <Text style={s.action}>Ouvrir Google · {lienWeb.nom} ↗</Text>
          </Pressable>
        </Link>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  carte: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#DED5E9', borderRadius: R.carte, padding: 18, gap: 10 },
  titre: { fontFamily: F.titre, fontSize: 21, color: C.violet },
  texte: { fontFamily: F.t500, fontSize: 14, lineHeight: 20, color: C.texte },
  bouton: { backgroundColor: C.violet, borderRadius: R.btn, minHeight: 48, padding: 13, justifyContent: 'center' },
  action: { fontFamily: F.t700, fontSize: 15, color: '#fff', textAlign: 'center' },
  precision: { fontFamily: F.t400, fontSize: 12, color: C.texte2 },
  message: { fontFamily: F.t600, fontSize: 13, lineHeight: 18, color: C.violetProfond },
});
