# Notifications : jeton retiré à la déconnexion

Claude — 18/10/2026 — TERMINÉ (code ; OTA en attente d'accord).

## Demande

Yoann : « retire le jeton à la déconnexion dans l'appli aussi », après la correction
serveur des jetons partagés (dépôt `bubble-tea-pos`, migration
`20261018161201_push_tokens_dernier_compte_appareil`).

## Constat

`src/lib/push.ts` enregistre le jeton Expo du téléphone dans `push_tokens` ; la
déconnexion (`compte.tsx`, `deconnexion`) appelle seulement `supabase.auth.signOut()`.
Un compte déconnecté continue donc de recevoir ses notifications sur le téléphone tant
qu'aucun autre compte ne s'y connecte.

## Changement prévu

- `src/lib/push-deconnexion.ts` (nouveau, sans dépendance native) : retrait du jeton
  mémorisé, borné à 3 s, jamais bloquant ni levant d'erreur.
- `src/lib/push.ts` : mémorise le jeton obtenu (AsyncStorage) et expose
  `retirerPushAvantDeconnexion()` (suppression `push_tokens` par jeton, limitée par la
  policy « push: supprimer le sien »).
- `src/app/compte.tsx` : retrait avant `signOut`.
- `scripts/test-push-deconnexion.cjs` + `package.json` (`test:push`, inclus dans
  `test:quiet`).

Aucune OTA ni build sans accord explicite.

## Périmètre verrouillé

`src/lib/push.ts`, `src/lib/push-deconnexion.ts`, `src/app/compte.tsx` (fonction
`deconnexion`), `scripts/test-push-deconnexion.cjs`, `package.json` (scripts de test),
ce journal.

## Réalisation et validations — Claude, 18/10/2026

- `push-deconnexion.ts` : jeton mémorisé lu puis supprimé par sa valeur ; oublié
  seulement après un retrait confirmé ; refus, réseau coupé ou stockage illisible →
  `echec` sans erreur levée ; serveur muet → `delai` après 3 s.
- `push.ts` : jeton mémorisé (`push.jeton`) dès qu'il est obtenu ;
  `retirerPushAvantDeconnexion()` supprime la ligne `push_tokens` de ce jeton, la
  policy limitant au compte connecté. Les installations existantes mémorisent le jeton
  au premier lancement connecté après la mise à jour.
- `compte.tsx` : « Se déconnecter » retire le jeton puis ferme la session. Suppression
  de compte inchangée (cascade serveur `profils` → `push_tokens`).
- `scripts/test-push-deconnexion.cjs` (nouveau, dans `test:quiet`) : retrait nominal,
  absence de jeton, refus serveur, réseau coupé, stockage illisible, serveur muet,
  branchements (mémorisation, retrait par jeton avant `signOut`).
- `npm run test:quiet` réussi (dont `tsc --noEmit`), `git diff --check` propre.
- JavaScript seul, aucune dépendance native : compatible OTA runtime 1.0.3. Non
  constaté : essai sur téléphone (déconnexion puis notification non reçue).
