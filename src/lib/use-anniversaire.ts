import { useCallback, useState, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Anniversaire, creerLectureAnniversaire } from '@/lib/anniversaire';

const lecture = creerLectureAnniversaire(async () => {
  const { data, error } = await supabase.rpc('mon_cadeau_anniversaire');
  if (error) throw new Error('anniversaire-indisponible');
  return data;
});

export function useAnniversaire(solde?: number) {
  const precedent = useRef(solde);
  const [cadeau, setCadeau] = useState<Anniversaire | null>(null);
  const [erreur, setErreur] = useState(false);
  useFocusEffect(useCallback(() => {
    let vivant = true; let sequence = 0;
    const charger = async (forcer = false) => {
      const n = ++sequence;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!vivant || n !== sequence) return;
        if (!session) { lecture.changer(null); setCadeau(null); setErreur(false); return; }
        const valeur = await lecture.charger(session.user.id, forcer);
        if (vivant && n === sequence) { setCadeau(valeur); setErreur(false); }
      } catch { if (vivant && n === sequence) { setCadeau(null); setErreur(true); } }
    };
    const change = precedent.current !== solde;
    precedent.current = solde;
    void charger(change);
    const app = AppState.addEventListener('change', etat => { if (etat === 'active') void charger(); });
    const { data: auth } = supabase.auth.onAuthStateChange(evt => {
      if (evt === 'SIGNED_OUT' || evt === 'SIGNED_IN') {
        sequence++; lecture.changer(null); setCadeau(null);
        // Hors callback Auth : pas de RPC sous le verrou de session Supabase.
        if (evt === 'SIGNED_IN') void Promise.resolve().then(() => charger());
      }
    });
    return () => { vivant = false; sequence++; app.remove(); auth.subscription.unsubscribe(); };
  }, [solde]));
  return { cadeau, erreur };
}
