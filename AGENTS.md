# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Déploiement

- **Appli stock** (`bubble-tea-pos/bubble-stock-expo`) = **PWA Cloudflare Pages, déploiement AUTO au `git push`** sur `bubblestopaix-afk/bubble-tea-pos` (branche `main`). **Jamais `wrangler`, jamais d'upload manuel, pas de build local.** Détails dans `bubble-tea-pos/AGENTS.md`.
- **Appli client** (ce repo) : JS → `npx eas-cli@latest update` ; natif → `npx eas-cli@latest build` + `submit`. Web/confidentialité = Cloudflare Pages `bubblestop-client`, déploiement auto au push sur `bubblestopaix-afk/bubblestop-client`.
- **⚠️ `eas` n'est PAS installé en global** (`zsh: command not found: eas`) → **toujours préfixer par `npx eas-cli@latest`** (ex. `npx eas-cli@latest build -p ios --profile production --auto-submit`). Le profil `production` a déjà `autoIncrement: true` → le n° de build s'incrémente seul (pas de « build number already used ») ; `--auto-submit` envoie direct sur TestFlight.

# Pièges connus (ne pas refaire)

- **Crash AU LANCEMENT (iOS ET Android natif) = expo-updates.** CAUSE CONFIRMÉE PAR LE RAPPORT DE CRASH `.ips` (build 13) : `EXC_CRASH (SIGABRT)`, exception ObjC non rattrapée (`NSException raise`), **thread déclencheur = `queue "expo.controller.errorRecoveryQueue"`** (+ `expo.controller.AssetFilesQueue` qui fait `removeItem`). Le thread **JavaScript est vivant/au repos → ce N'EST PAS une erreur JS.** C'est le mécanisme de **récupération d'erreur d'expo-updates** qui plante au lancement. **Correctif : `app.json` → `"updates": { "enabled": false }`** (on n'utilise pas l'OTA — Channel: None partout). Pour réactiver l'OTA plus tard : remettre `updates.url` + configurer un **channel** EAS Update proprement, et tester. ⚠️ **Web ET Expo Go ne reproduisent PAS ce crash** (expo-updates ne tourne pas) — ni un build **debug** local (`expo run:ios`, expo-updates désactivé). Seul un build **natif de prod** le montre → diagnostic = lire le `.ips` (Réglages → Confidentialité → Données d'analyse). Hypothèses FAUSSES (n'ont rien changé) : `@expo/ui`, carte-express, variables `EXPO_PUBLIC_*`/Supabase (le repli en dur dans `supabase.ts` a été gardé car inoffensif + sûr, clé anon publique, mais ce n'était PAS la cause).
- **Retirer toute dépendance native NON utilisée avant un build de release** : elle s'enregistre au démarrage et peut crasher même sans import JS.
- **Toujours tester le build natif sur un VRAI iPhone via TestFlight AVANT de soumettre la review Apple.** Un build qui compile peut quand même crasher au lancement (le simulateur ne suffit pas — et le Mac ne limite pas le SDK : EAS build dans le cloud, on teste sur l'iPhone réel).
- **Avant de soumettre la review :** vérifier prix/dispo France, screenshots 6.5", App Review (compte démo `aix@bubblestop.fr` + tel), et le **statut trader DSA** (Business → vérif email obligatoire) sinon blocage UE.
