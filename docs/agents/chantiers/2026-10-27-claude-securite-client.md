# Correctifs de sécurité de l'appli client

Claude — 27/10/2026 — TERMINÉ (preview publiée ; production en attente de l'essai de Yoann).

## Demande

Yoann : audit de sécurité complet (POS, Supabase, Stock, appli client), puis « tu peux
corriger le reste ». Journal principal côté serveur et POS :
`bubble-tea-pos/docs/agents/chantiers/2026-10-27-claude-correctifs-securite.md`.

## Correctifs (commit `13d2a96`)

- Wallet : l'appli demande un code d'ouverture de 2 minutes (`wallet-pass?action=code`,
  avec sa session) et ouvre `wallet-pass?platform=…&code=…`. Le jeton de session (1 h,
  accès à tout le compte) ne passe plus dans l'URL du navigateur, qui finissait dans
  l'historique et les journaux Supabase. Serveur déployé avant l'OTA ; l'ancien `?token=`
  reste accepté pour les applis non mises à jour.
- Mise à jour forcée : le bouton n'ouvre que `apps.apple.com`, `itunes.apple.com` ou
  `play.google.com`, même si la configuration serveur était altérée (valeurs live déjà
  conformes).
- Test : `npm run test:securite` (intégré à `test:quiet`).

## Publication preview — Claude, 27/10/2026

- Contrôles : `npm run test:quiet` (dont `tsc --noEmit`) réussi, `git diff --check` propre,
  export Expo iOS/Android/web réussi (33 pages web), appel `wallet-pass?action=code`
  présent dans les deux bundles natifs.
- `npx eas-cli@latest update --branch preview` : groupe
  `3a97d6b7-5cd1-465d-9e4c-036d7b8a0d5e`, runtime 1.0.3, Android
  `01a17aa9-a68c-73c4-961e-f850b9b4ebcb`, iOS `01a17aa9-a68c-70ab-b76a-c83a68292762`.
  Inclut aussi le retrait du jeton de notification à la déconnexion (18/10).
- Production inchangée (`0697e049…`, « Roue sécurisée »).

## Reste

- Essai sur téléphone (preview) : « Ajouter à Apple Wallet » / « Google Wallet » ; puis
  production seulement avec l'accord de Yoann.
- Non fait, demande un nouveau build natif : session dans le stockage sécurisé
  (expo-secure-store), nonce Sign in with Apple (expo-crypto), signature des OTA.
