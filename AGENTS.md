# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Déploiement

- **Appli stock** (`bubble-tea-pos/bubble-stock-expo`) = **PWA Cloudflare Pages, déploiement AUTO au `git push`** sur `bubblestopaix-afk/bubble-tea-pos` (branche `main`). **Jamais `wrangler`, jamais d'upload manuel, pas de build local.** Détails dans `bubble-tea-pos/AGENTS.md`.
- **Appli client** (ce repo) : JS → `npx eas-cli@latest update` ; natif → `npx eas-cli@latest build` + `submit`. Web/confidentialité = Cloudflare Pages `bubblestop-client`, déploiement auto au push sur `bubblestopaix-afk/bubblestop-client`.

# Pièges connus (ne pas refaire)

- **Crash AU LANCEMENT (iOS/Android natif) = variables `EXPO_PUBLIC_*` non « inlinées » dans le build EAS.** `src/lib/supabase.ts` appelle `createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, ...)` AU CHARGEMENT du module — et `app/_layout.tsx` (layout racine) l'importe, donc ça s'exécute tout en haut, avant tout rendu. Si la variable est `undefined` au bundling, Metro la remplace par `undefined` → `createClient(undefined)` throw → expo-updates relève l'erreur → **SIGABRT instantané**. Le `.env` (gitignoré) n'est PAS envoyé au build EAS ; le bloc `env` d'`eas.json` n'a PAS suffi (build 12 plantait encore). **Correctif définitif = valeur de repli EN DUR dans `supabase.ts` : `process.env.X || 'https://zpnoopitysojsvuqnbuo.supabase.co'`** (+ clé anon publique en dur — sûr car protégée par RLS). ⚠️ Web ET Expo Go ne reproduisent PAS ce crash (ils lisent le `.env` local) → tester en Expo Go ne valide pas ce bug, seul un build natif le montre. Hypothèses passées FAUSSES : `@expo/ui`, carte-express (retirées, n'ont rien changé).
- **Retirer toute dépendance native NON utilisée avant un build de release** : elle s'enregistre au démarrage et peut crasher même sans import JS.
- **Toujours tester le build natif sur un VRAI iPhone via TestFlight AVANT de soumettre la review Apple.** Un build qui compile peut quand même crasher au lancement (le simulateur ne suffit pas — et le Mac ne limite pas le SDK : EAS build dans le cloud, on teste sur l'iPhone réel).
- **Avant de soumettre la review :** vérifier prix/dispo France, screenshots 6.5", App Review (compte démo `aix@bubblestop.fr` + tel), et le **statut trader DSA** (Business → vérif email obligatoire) sinon blocage UE.
