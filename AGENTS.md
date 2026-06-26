# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Déploiement

- **Appli stock** (`bubble-tea-pos/bubble-stock-expo`) = **PWA Cloudflare Pages, déploiement AUTO au `git push`** sur `bubblestopaix-afk/bubble-tea-pos` (branche `main`). **Jamais `wrangler`, jamais d'upload manuel, pas de build local.** Détails dans `bubble-tea-pos/AGENTS.md`.
- **Appli client** (ce repo) : JS → `npx eas-cli@latest update` ; natif → `npx eas-cli@latest build` + `submit`. Web/confidentialité = Cloudflare Pages `bubblestop-client`, déploiement auto au push sur `bubblestopaix-afk/bubblestop-client`.
