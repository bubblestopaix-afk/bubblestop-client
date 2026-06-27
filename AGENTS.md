# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Déploiement

- **Appli stock** (`bubble-tea-pos/bubble-stock-expo`) = **PWA Cloudflare Pages, déploiement AUTO au `git push`** sur `bubblestopaix-afk/bubble-tea-pos` (branche `main`). **Jamais `wrangler`, jamais d'upload manuel, pas de build local.** Détails dans `bubble-tea-pos/AGENTS.md`.
- **Appli client** (ce repo) : JS → `npx eas-cli@latest update` ; natif → `npx eas-cli@latest build` + `submit`. Web/confidentialité = Cloudflare Pages `bubblestop-client`, déploiement auto au push sur `bubblestopaix-afk/bubblestop-client`.
- **⚠️ `eas` n'est PAS installé en global** (`zsh: command not found: eas`) → **toujours préfixer par `npx eas-cli@latest`** (ex. `npx eas-cli@latest build -p ios --profile production --auto-submit`). Le profil `production` a déjà `autoIncrement: true` → le n° de build s'incrémente seul (pas de « build number already used ») ; `--auto-submit` envoie direct sur TestFlight.

# Fidélité — identifiant = `numero_fidelite` (code), PAS le téléphone (depuis 27/06)

- La carte est identifiée par **`profils.numero_fidelite`** = **code à 8 chiffres** (généré côté serveur par la RPC **`activer_ma_carte()`**), **plus jamais le téléphone**. Le téléphone est un **contact optionnel** (`profils.telephone`).
- **`fidelite_cloud` a pour clé `numero_fidelite`** : toute lecture côté appli se fait via **`.eq('numero_fidelite', numero)`** (jamais `.eq('telephone', …)`) — voir `explore.tsx`, `index.tsx`, `commander/index.tsx`, `commander/panier.tsx`, realtime `filter: numero_fidelite=eq.…`.
- **Activation** (onglet Fidélité) = **un tap** → `supabase.rpc('activer_ma_carte')` renvoie le code (et déclenche le +1 tampon de bienvenue). **Ne plus écrire `numero_fidelite` côté client** (ni à l'inscription `compte.tsx`, ni dans « Mes infos », ni à la réclamation express) : ça reste géré par la RPC. Le QR de l'appli encode `numero` (= le code).
- **Carte express** (`reclamer-carte.tsx` / `lib/carte-temp.ts`) : on réclame sur le **code** du compte (auto-généré via la RPC si absent), pas sur un téléphone saisi.

# Pièges connus (ne pas refaire)

- **Crash AU LANCEMENT (iOS ET Android natif) = ERREUR JS au rendu, masquée en prod par expo-updates.** CAUSE RÉELLE CONFIRMÉE (vue en clair sur simulateur) : dans **`src/components/app-tabs.tsx`**, l'onglet caché `c` (carte express) utilisait **`href: null` ET `tabBarButton` ENSEMBLE** → la version actuelle d'**expo-router throw** : « Cannot use `href` and `tabBarButton` together ». Cette erreur de rendu au lancement plantait l'app. **Correctif = masquer l'onglet via `tabBarButton: () => null` + `tabBarItemStyle: { display:'none' }` SANS `href`** (jamais les deux ensemble). Introduit dans la refonte des onglets (commit `65a9e71`), d'où le bisect build 5 OK / build 9 KO. ⚠️ **En PROD, une erreur JS au lancement → expo-updates « errorRecoveryQueue » → SIGABRT** : le `.ips` (build 13) pointait cette queue = SYMPTÔME, pas la cause. Pistes FAUSSES (toutes innocentes) : Supabase/`EXPO_PUBLIC_*`, expo-updates, `@expo/ui`, `expo-glass-effect`/`expo-symbols`. **MÉTHODE qui marche = build LOCAL debug `npx expo run:ios` : il affiche l'erreur JS RÉELLE (LogBox rouge) que la prod cache.** Pré-requis simulateur : installer la plateforme iOS une fois (`xcodebuild -downloadPlatform iOS`), puis `npx expo run:ios` (l'UDID du simu booté se récupère via `xcrun simctl list devices booted`).
- **Retirer toute dépendance native NON utilisée avant un build de release** : elle s'enregistre au démarrage et peut crasher même sans import JS.
- **Toujours tester le build natif sur un VRAI iPhone via TestFlight AVANT de soumettre la review Apple.** Un build qui compile peut quand même crasher au lancement (le simulateur ne suffit pas — et le Mac ne limite pas le SDK : EAS build dans le cloud, on teste sur l'iPhone réel).
- **Avant de soumettre la review :** vérifier prix/dispo France, screenshots 6.5", App Review (compte démo `aix@bubblestop.fr` + tel), et le **statut trader DSA** (Business → vérif email obligatoire) sinon blocage UE.
