// === 🤝 Parrainage : lien/QR, code en attente, application automatique ===
// Le QR du parrain encode lienParrainage(code) → route /p?c=<code> (appli native
// via deep link, ou appli web commande.bubblestop.fr via la caméra du téléphone).
// Si le filleul n'est pas encore connecté au moment du scan, le code est MÉMORISÉ
// puis appliqué automatiquement dès qu'une session existe (_layout / route /p) —
// même logique éprouvée que le jeton de carte express (lib/carte-temp).
// Les récompenses (parrain / filleul) restent créditées par l'agent à la 1ère
// commande du filleul — le QR ne fait qu'automatiser la LIAISON parrain-filleul.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const CLE = 'parrain.codeEnAttente';

// L'appli web sert de porte d'entrée universelle : le scan caméra ouvre cette URL,
// que l'appli soit installée ou non (même domaine que les QR carte express).
export const lienParrainage = (code: string) => `https://commande.bubblestop.fr/p?c=${code}`;

// Appelle l'edge agent-bubblestop et renvoie TOUJOURS un corps { ok, ... }.
// `reseau: true` = l'edge n'a pas répondu (offline…) → l'erreur n'est PAS définitive.
export async function appelAgent(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('agent-bubblestop', { body });
  if (error) {
    try { return await (error as any).context.json(); } catch { return { ok: false, reseau: true, erreur: (error as any)?.message }; }
  }
  return data;
}

export async function memoriserCodeParrain(code: string): Promise<void> {
  const c = String(code || '').replace(/\D/g, '').slice(0, 10);
  if (c.length >= 6) { try { await AsyncStorage.setItem(CLE, c); } catch { /* ignore */ } }
}
export async function lireCodeParrainEnAttente(): Promise<string | null> {
  try { return await AsyncStorage.getItem(CLE); } catch { return null; }
}
export async function oublierCodeParrain(): Promise<void> {
  try { await AsyncStorage.removeItem(CLE); } catch { /* ignore */ }
}

// Applique le code mémorisé si l'utilisateur est connecté. Consomme le code en cas
// de succès OU d'erreur définitive (déjà parrainé, code inconnu, compte trop ancien…).
// Erreur réseau → le code est conservé, on retentera à la prochaine ouverture.
export async function appliquerParrainEnAttente(): Promise<{ ok: boolean; message: string } | null> {
  const code = await lireCodeParrainEnAttente();
  if (!code) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const d = await appelAgent({ action: 'parrainer', code });
  if (d?.ok) { await oublierCodeParrain(); return { ok: true, message: d.message || 'Parrainage enregistré !' }; }
  if (d?.erreur && !d.reseau) { await oublierCodeParrain(); return { ok: false, message: String(d.erreur) }; }
  return null;
}
