# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Déploiement

- **Appli stock** (`bubble-tea-pos/bubble-stock-expo`) = **PWA Cloudflare Pages, déploiement AUTO au `git push`** sur `bubblestopaix-afk/bubble-tea-pos` (branche `main`). **Jamais `wrangler`, jamais d'upload manuel, pas de build local.** Détails dans `bubble-tea-pos/AGENTS.md`.
- **Appli client** (ce repo) : JS → `npx eas-cli@latest update` ; natif → `npx eas-cli@latest build` + `submit`. Web/confidentialité = Cloudflare Pages `bubblestop-client`, déploiement auto au push sur `bubblestopaix-afk/bubblestop-client`.

# Pièges connus (ne pas refaire)

- **`@expo/ui` fait crasher l'app AU LANCEMENT en SDK 54.** Son module natif s'enregistre au démarrage : même **non importé** dans le code JS, il crashe l'app dès l'ouverture (nouvelle archi). Ses vues SwiftUI iOS sont incompatibles avec `ExpoModulesCore` de SDK 54 (erreurs build `SafeAreaControllable` / `RNHostViewProtocol`, qu'on avait masquées en pinnant beta.9). **Ne JAMAIS garder `@expo/ui` tant qu'on est en SDK 54.** Build 9 (avec `@expo/ui` beta.9) = crash au lancement ; build 10 (retiré) = corrigé.
- **Retirer toute dépendance native NON utilisée avant un build de release** : elle s'enregistre au démarrage et peut crasher même sans import JS.
- **Toujours tester le build natif sur un VRAI iPhone via TestFlight AVANT de soumettre la review Apple.** Un build qui compile peut quand même crasher au lancement (le simulateur ne suffit pas — et le Mac ne limite pas le SDK : EAS build dans le cloud, on teste sur l'iPhone réel).
- **Avant de soumettre la review :** vérifier prix/dispo France, screenshots 6.5", App Review (compte démo `aix@bubblestop.fr` + tel), et le **statut trader DSA** (Business → vérif email obligatoire) sinon blocage UE.
