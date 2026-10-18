// === Jeton de notification retiré à la déconnexion (18/10/2026) ===
// Sans ce retrait, un compte déconnecté continue de recevoir ses notifications sur le
// téléphone tant qu'aucun autre compte ne s'y connecte. La suppression se fait AVANT
// la fermeture de session : la policy « push: supprimer le sien » n'autorise que les
// lignes du compte connecté. Elle ne bloque jamais la déconnexion et ne lève jamais.

export const CLE_JETON_PUSH = 'push.jeton';
export const DELAI_RETRAIT_JETON_MS = 3000;

export type ResultatRetraitJeton = 'retire' | 'aucun-jeton' | 'echec' | 'delai';

type Dependances = {
  lireJeton: () => Promise<string | null | undefined>;
  supprimer: (jeton: string) => PromiseLike<{ error?: unknown } | null | void>;
  oublierJeton: () => Promise<void>;
  delaiMs?: number;
};

export async function retirerJetonPush({
  lireJeton,
  supprimer,
  oublierJeton,
  delaiMs = DELAI_RETRAIT_JETON_MS,
}: Dependances): Promise<ResultatRetraitJeton> {
  let jeton: string;
  try {
    jeton = String((await lireJeton()) ?? '').trim();
  } catch {
    return 'echec';
  }
  if (!jeton) return 'aucun-jeton';

  let minuterie: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<'delai'>((resolve) => {
    minuterie = setTimeout(() => resolve('delai'), delaiMs);
  });
  const retrait = (async (): Promise<ResultatRetraitJeton> => {
    try {
      const reponse = await supprimer(jeton);
      if (reponse && reponse.error) return 'echec';
      // Le jeton mémorisé n'est oublié qu'après un retrait confirmé : un échec sera
      // retenté à la prochaine déconnexion.
      await oublierJeton().catch(() => {});
      return 'retire';
    } catch {
      return 'echec';
    }
  })();
  try {
    return await Promise.race([retrait, delai]);
  } finally {
    if (minuterie) clearTimeout(minuterie);
  }
}
