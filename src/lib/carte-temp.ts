// === Carte fidélité temporaire (QR express borne) côté appli ===
// Le client ouvre le lien du QR (/c?t=<jeton>). Pour que ses tampons soient récupérés MÊME s'il
// crée son compte juste après (et quitte l'écran), on MÉMORISE le jeton, et on le réclame
// automatiquement dès qu'il est connecté avec un numéro de fidélité (cf. _layout + compte).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const CLE = 'carteTemp.enAttente';

// Appelle la fonction carte-temp et renvoie TOUJOURS le corps JSON ({ ok, ... }),
// que la réponse soit 2xx (data) ou une erreur HTTP (corps dans error.context).
export async function appelCarteTemp(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('carte-temp', { body });
  if (error) {
    try { return await (error as any).context.json(); } catch { return { ok: false, erreur: (error as any)?.message }; }
  }
  return data;
}

export async function memoriserJeton(token: string): Promise<void> {
  const t = String(token || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (t) { try { await AsyncStorage.setItem(CLE, t); } catch { /* ignore */ } }
}
export async function lireJetonEnAttente(): Promise<string | null> {
  try { return await AsyncStorage.getItem(CLE); } catch { return null; }
}
export async function oublierJeton(): Promise<void> {
  try { await AsyncStorage.removeItem(CLE); } catch { /* ignore */ }
}

// Réclame le jeton en attente pour ce numéro. Renvoie le nb de tampons crédités (>=0), ou null si rien.
// Consomme le jeton mémorisé en cas de succès — ou s'il est déjà réclamé/expiré (inutile de retenter).
export async function reclamerJetonEnAttente(numeroFidelite: string): Promise<number | null> {
  const tel = String(numeroFidelite || '').replace(/\D/g, '');
  if (tel.length < 6) return null;
  const token = await lireJetonEnAttente();
  if (!token) return null;
  const d = await appelCarteTemp({ action: 'reclamer', token, telephone: tel });
  if (d?.ok) { await oublierJeton(); return Number(d.tamponsCredites) || 0; }
  if (/expir|réclam|reclam|déjà|inconnu/i.test(String(d?.erreur || ''))) await oublierJeton();
  return null;
}
