# Contexte release, OTA et stores

## Référence

- Application `1.0.3`, Expo SDK 54, runtime calculé depuis `appVersion`.
- Profils EAS : `preview` interne et `production` clients réels.
- Toujours utiliser `npx eas-cli@latest`; aucune installation globale d'EAS n'est
  supposée.
- Le dernier état production documenté dans l'ancien journal est une OTA du
  05/08/2026. Les commits suivants ne prouvent pas une publication : consulter EAS.

## Choix OTA ou build

- OTA uniquement pour du JS/TS/assets compatibles avec les binaires `1.0.3`.
- Nouveau module natif, plugin, permission, icône native, `app.json` natif ou
  changement de runtime : nouveau build obligatoire.
- Une version App Store déjà publiée ferme son train iOS ; un nouveau binaire exige
  le bump approprié avant construction.
- `ios/` et `android/` sont générés localement et ignorés. Ne pas les versionner.

## Garde production

- Aucun update, republish, rollback, build ou submit production sans accord
  explicite de Yoann et validation complète.
- Tester l'OTA sur `preview` avec une build interne : démarrage, email, Apple,
  Google, onglets, fidélité, écrans touchés et absence de logs sensibles.
- Avant un rollback, identifier dans EAS l'update fautive et le groupe stable réel.
  Ne jamais recopier un ancien identifiant de groupe sans contrôle live.
- Une OTA publie le bundle entier du worktree, pas seulement un fichier. Le dépôt
  doit être propre et le diff intégral relu avant publication.

## Stores et web

- Un build production utilise l'auto-incrément configuré ; la soumission Android
  cible directement la production. Vérifier cet impact avant `--auto-submit`.
- Tester le build natif sur un appareil réel avant review, notamment lancement et
  connexions Apple/Google.
- Le push Git déploie automatiquement `public/` sur Cloudflare Pages. Une correction
  documentaire publique peut donc être publiée sans OTA.
- Ne jamais versionner ou afficher certificats, clés EAS/Apple/Google, fichiers de
  service account ou secrets d'environnement.
