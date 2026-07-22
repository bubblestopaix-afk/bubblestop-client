// === Connexion Google NATIVE (remplace le flux web signInWithOAuth) ===
// Pourquoi : le flux web affichait le popup iOS « BubbleStop veut utiliser
// zpnoopitysojsvuqnbuo.supabase.co » + la page Google avec le domaine technique.
// Le flux natif = feuille de connexion systeme « Bubble Stop », zero navigateur,
// puis echange du jeton d'identite avec Supabase (signInWithIdToken).
// Apple est DEJA en natif dans compte.tsx : ce module ne concerne que Google.
//
// Prerequis (deja crees le 16/07/2026, projet GCP bubblestock-498921) :
//   - client Web  (webClientId, EXISTANT, aussi utilise par le fallback web)
//   - client iOS  (iosClientId + URL scheme inverse dans app.json)
//   - clients Android par empreinte (signature Play + cle upload EAS) : rien a
//     mettre dans le code, Google matche package + SHA-1 automatiquement.
// + Dashboard Supabase > Auth > Google : iosClientId AJOUTE aux Client IDs autorises.
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { supabase } from '@/lib/supabase';

export const GOOGLE_WEB_CLIENT_ID = '172372207006-jhovojkoq1da9m0f3h897v4fe2hvfr47.apps.googleusercontent.com';
export const GOOGLE_IOS_CLIENT_ID = '172372207006-q6ggib11aoud3ldkau5p686u4m49ndbq.apps.googleusercontent.com';

let configure = false;
function configurer() {
  if (configure) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID, // OBLIGATOIRE pour recevoir un idToken sur Android
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    offlineAccess: false, // pas de refresh token Google cote serveur : Supabase gere la session
  });
  configure = true;
}

export type ResultatGoogleNatif =
  | { ok: true }                     // session Supabase creee
  | { ok: false; annule: true }      // l'utilisateur a ferme la feuille : ne rien afficher
  | { ok: false; annule: false; message: string };

// Connexion Google native -> session Supabase.
// Sur iOS/Android, ne jamais relancer automatiquement l'ancien OAuth web :
// il ferait choisir le compte une seconde fois et exposerait le domaine technique
// Supabase. Une erreur native reste donc une erreur visible et retentable.
export async function connexionGoogleNative(): Promise<ResultatGoogleNatif> {
  configurer();
  try {
    // Android : verifie Google Play Services (iOS : no-op)
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Feuille de compte systeme. signOut prealable (best effort) pour que le
    // client puisse changer de compte au lieu d'etre re-connecte en silence.
    try { await GoogleSignin.signOut(); } catch { /* premiere connexion : rien */ }
    const resultat = await GoogleSignin.signIn();
    // v13+ : { type: 'success'|'cancelled', data: { idToken } }.
    if (resultat.type === 'cancelled') return { ok: false, annule: true };
    const idToken = resultat.data.idToken;
    if (!idToken) {
      return { ok: false, annule: false, message: 'Connexion Google incomplète (jeton absent).' };
    }
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) {
      return { ok: false, annule: false, message: error.message };
    }
    return { ok: true };
  } catch (e: any) {
    if (e?.code === statusCodes.SIGN_IN_CANCELLED) return { ok: false, annule: true };
    if (e?.code === statusCodes.IN_PROGRESS) return { ok: false, annule: true };
    const playServicesKo = e?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE;
    return {
      ok: false,
      annule: false,
      message: playServicesKo ? 'Google Play Services indisponibles' : String(e?.message || e),
    };
  }
}
