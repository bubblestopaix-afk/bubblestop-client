// === Boba Quest — migrations pures de la sauvegarde locale ===
// Ce module reste sans dépendance React Native afin que chaque évolution de
// schéma puisse être testée sous Node avec des sauvegardes historiques.

export const VERSION_SAUVEGARDE = 3;

export function onboardingTermineApresMigration(sauve: Record<string, unknown>): boolean {
  if (typeof sauve.onboardingTermine === 'boolean') return sauve.onboardingTermine;
  if (Number(sauve.capsulesOuvertes ?? 0) > 0) return true;
  if (!sauve.collection || typeof sauve.collection !== 'object' || Array.isArray(sauve.collection)) return false;
  return Object.values(sauve.collection as Record<string, unknown>).some((n) => Number(n) > 0);
}

export type ProgressionMissionSauvee = { progres: number; reclamee: boolean };

export function missionsCartesApresMigration(brut: unknown): Record<string, ProgressionMissionSauvee> {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return {};
  const resultat: Record<string, ProgressionMissionSauvee> = {};
  for (const [id, valeur] of Object.entries(brut as Record<string, unknown>)) {
    if (!valeur || typeof valeur !== 'object' || Array.isArray(valeur)) continue;
    const v = valeur as Record<string, unknown>;
    resultat[id] = {
      progres: Math.max(0, Math.floor(Number(v.progres) || 0)),
      reclamee: v.reclamee === true,
    };
  }
  return resultat;
}

export function prestigeApresMigration(brut: unknown): Record<string, boolean> {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return {};
  return Object.fromEntries(
    Object.entries(brut as Record<string, unknown>)
      .filter(([, valeur]) => valeur === true)
      .map(([id]) => [id, true]),
  );
}
