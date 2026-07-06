# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Déploiement

- **Appli stock** (`bubble-tea-pos/bubble-stock-expo`) = **PWA Cloudflare Pages, déploiement AUTO au `git push`** sur `bubblestopaix-afk/bubble-tea-pos` (branche `main`). **Jamais `wrangler`, jamais d'upload manuel, pas de build local.** Détails dans `bubble-tea-pos/AGENTS.md`.
- **Appli client** (ce repo) : JS → `npx eas-cli@latest update` ; natif → `npx eas-cli@latest build` + `submit`. Web/confidentialité = Cloudflare Pages `bubblestop-client`, déploiement auto au push sur `bubblestopaix-afk/bubblestop-client`.
- **⚠️ `eas` n'est PAS installé en global** (`zsh: command not found: eas`) → **toujours préfixer par `npx eas-cli@latest`** (ex. `npx eas-cli@latest build -p ios --profile production --auto-submit`). Le profil `production` a déjà `autoIncrement: true` → le n° de build s'incrémente seul (pas de « build number already used ») ; `--auto-submit` envoie direct sur TestFlight.

# Simulation LOCALE sur Mac (gratuit — 0 crédit EAS — BASE QUI MARCHE, 30/06)

But : tester un build natif **sans dépenser de crédit EAS** (le build EAS payant n'arrive qu'à la toute fin, une fois sûr). **Confirmé OK iOS + Android le 30/06** : l'app s'ouvre, plus de crash, **« Sign in with Apple » visible en 1er sur iOS**, accueil + onglets OK.

- **iOS (simulateur — AUCUNE signature requise, le simu n'enforce pas le code signing)** :
  ```
  npx expo install expo-apple-authentication   # si pas déjà installé
  npx expo run:ios                             # prebuild + compile via Xcode + lance le simulateur
  ```
  1re fois seulement : `xcodebuild -downloadPlatform iOS` (installe le runtime simulateur). `--configuration Release` = variante la plus proche du store (révèle les bugs que le debug masque).
- **Android (émulateur) — 2 pièges réglés** :
  1. **SDK pas dans le PATH** → `emulator` introuvable → « No Android connected device found / no emulators could be started automatically ». Fix :
     ```
     export ANDROID_HOME="$HOME/Library/Android/sdk"
     export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
     emulator -list-avds     # donne le VRAI nom de l'AVD (ex. Pixel_3a_API_34_extension_level_7_arm64-v8a)
     ```
  2. **JDK trop récent** → Gradle échoue : `Unsupported class file major version 69` (= **Java 25**). Gradle 8.14 / Android veulent **JDK 17** (24 maxi). Fix :
     ```
     export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"   # JDK livré avec Android Studio
     java -version           # doit afficher 17 ou 21, surtout PAS 25
     ```
     (ou `brew install --cask temurin@17` + `export JAVA_HOME=$(/usr/libexec/java_home -v 17)`). Mettre les `export` dans **`~/.zshrc`** pour que ce soit permanent.
  Puis `npx expo run:android` (1er build = quelques min, Gradle compile tout).
- **`/ios` et `/android` sont gitignorés** (workflow CNG / prebuild à la demande) → ne JAMAIS committer les dossiers natifs générés.
- Le **bouton Apple est iOS-only** (`Platform.OS === 'ios'`) → sur Android l'écran de connexion est inchangé (Google + email).
- ⚠️ Le **build EAS CLOUD (payant) n'a PAS le souci Java** (il embarque son propre JDK). Ce réglage `JAVA_HOME` ne concerne **QUE les builds locaux Mac** (`expo run:*`, `eas build --local`).

# Fidélité — identifiant = `numero_fidelite` (code), PAS le téléphone (depuis 27/06)

- La carte est identifiée par **`profils.numero_fidelite`** = **code à 8 chiffres** (généré côté serveur par la RPC **`activer_ma_carte()`**), **plus jamais le téléphone**. Le téléphone est un **contact optionnel** (`profils.telephone`).
- **`fidelite_cloud` a pour clé `numero_fidelite`** : toute lecture côté appli se fait via **`.eq('numero_fidelite', numero)`** (jamais `.eq('telephone', …)`) — voir `explore.tsx`, `index.tsx`, `commander/index.tsx`, `commander/panier.tsx`, realtime `filter: numero_fidelite=eq.…`.
- **Activation** (onglet Fidélité) = **un tap** → `supabase.rpc('activer_ma_carte')` renvoie le code (et déclenche le +1 tampon de bienvenue). **Ne plus écrire `numero_fidelite` côté client** (ni à l'inscription `compte.tsx`, ni dans « Mes infos », ni à la réclamation express) : ça reste géré par la RPC. Le QR de l'appli encode `numero` (= le code).
- **Carte express** (`reclamer-carte.tsx` / `lib/carte-temp.ts`) : on réclame sur le **code** du compte (auto-généré via la RPC si absent), pas sur un téléphone saisi.

# Commande en ligne — interrupteur serveur PAR MAGASIN (depuis 28/06)

- **Flag serveur `app_config.commande_en_ligne_active`** (table clé/valeur **`app_config`** : `cle text PK`, `valeur jsonb` ; **lecture publique** RLS, **écriture admin** `est_admin`). **`valeur` = map `{ magasinId: bool }`** (ex. `{"aix":true,"lyon":false}`) → la commande s'active **par magasin**. Magasin absent / `{}` (défaut) = **désactivé** (l'appli sert d'abord à la fidélité). But : ouvrir la commande d'un magasin **sans rebuild ni MAJ** une fois l'app publiée — il suffit de basculer l'interrupteur de ce magasin (effet immédiat au prochain chargement d'écran).
- Helper **`src/lib/app-config.ts`** : `lireCommandeMagasins()` → `Record<magasin,bool>`, `ecrireCommandeMagasin(magasin, bool)` (lecture-modif-écriture de la map, admin only), hook **`useCommandeEnLigne()`** → `{ actif, admin }` où `actif` = commande activée **pour le magasin de l'utilisateur** (profils.magasin sinon `getMagasin()`) OU admin (l'admin teste avant d'ouvrir).
- **Onglet « Commander » masqué** quand OFF pour son magasin (`app-tabs.tsx` : `tabBarButton:()=>null` + `tabBarItemStyle:{display:'none'}` — **JAMAIS `href`** ensemble, cf. piège crash plus bas), sauf admin. **Écran `commander/index.tsx`** : si le magasin du client est OFF & pas admin → carte « La commande en ligne arrive bientôt » (`commandeOff`) ; sinon le gate fidélité existant (`carteLiee`) s'applique.
- **Interrupteurs admin** = `compte.tsx` (hub Admin, sous « Toutes les commandes », réservé `est_admin`) : **un `Switch` par magasin** (Aix / Lyon / Toulouse) → `ecrireCommandeMagasin`. C'est l'**admin de l'appli client** qui active/désactive, magasin par magasin. Déploiement du CODE = OTA `npx eas-cli@latest update` (le flag DB, lui, est déjà live).

# Pièges connus (ne pas refaire)

- **Crash AU LANCEMENT (iOS ET Android natif) = ERREUR JS au rendu, masquée en prod par expo-updates.** CAUSE RÉELLE CONFIRMÉE (vue en clair sur simulateur) : dans **`src/components/app-tabs.tsx`**, l'onglet caché `c` (carte express) utilisait **`href: null` ET `tabBarButton` ENSEMBLE** → la version actuelle d'**expo-router throw** : « Cannot use `href` and `tabBarButton` together ». Cette erreur de rendu au lancement plantait l'app. **Correctif = masquer l'onglet via `tabBarButton: () => null` + `tabBarItemStyle: { display:'none' }` SANS `href`** (jamais les deux ensemble). Introduit dans la refonte des onglets (commit `65a9e71`), d'où le bisect build 5 OK / build 9 KO. ⚠️ **En PROD, une erreur JS au lancement → expo-updates « errorRecoveryQueue » → SIGABRT** : le `.ips` (build 13) pointait cette queue = SYMPTÔME, pas la cause. Pistes FAUSSES (toutes innocentes) : Supabase/`EXPO_PUBLIC_*`, expo-updates, `@expo/ui`, `expo-glass-effect`/`expo-symbols`. **MÉTHODE qui marche = build LOCAL debug `npx expo run:ios` : il affiche l'erreur JS RÉELLE (LogBox rouge) que la prod cache.** Pré-requis simulateur : installer la plateforme iOS une fois (`xcodebuild -downloadPlatform iOS`), puis `npx expo run:ios` (l'UDID du simu booté se récupère via `xcrun simctl list devices booted`).
- **Retirer toute dépendance native NON utilisée avant un build de release** : elle s'enregistre au démarrage et peut crasher même sans import JS.
- **Toujours tester le build natif sur un VRAI iPhone via TestFlight AVANT de soumettre la review Apple.** Un build qui compile peut quand même crasher au lancement (le simulateur ne suffit pas — et le Mac ne limite pas le SDK : EAS build dans le cloud, on teste sur l'iPhone réel).
- **Avant de soumettre la review :** vérifier prix/dispo France, screenshots 6.5", App Review (compte démo `aix@bubblestop.fr` + tel), et le **statut trader DSA** (Business → vérif email obligatoire) sinon blocage UE.

# Sign in with Apple — règle App Store 4.8 (depuis 30/06)

- L'app propose **Google + email/mot de passe** → Apple peut rejeter (guideline **4.8**) faute de login Apple équivalent. **Ajouté : Sign in with Apple sur iOS.**
- **Code** : `expo-apple-authentication` (plugin dans `app.json` + **`ios.usesAppleSignIn: true`**) ; dans **`src/app/compte.tsx`** un **`AppleAuthentication.AppleAuthenticationButton`** affiché **EN PREMIER** sur iOS (gardé `Platform.OS === 'ios'`, au-dessus du bouton Google), handler **`loginApple`** → `AppleAuthentication.signInAsync(...)` puis **`supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken })`**. Annulation utilisateur = `e.code === 'ERR_REQUEST_CANCELED'` (silencieux).
- **Pré-requis SERVEUR (à faire dans le dashboard Supabase)** : Authentication → **Providers → Apple → activer**, et mettre le **bundle `com.bubblestop.client`** dans les **Client IDs autorisés**. Pour le natif iOS (token d'identité), **pas besoin de Services ID / secret** (ceux-ci servent au flux OAuth web). Sans ça, `signInWithIdToken` renvoie une erreur « provider not enabled ».
- **Dépendance NATIVE → nouveau build EAS obligatoire** (pas d'OTA) : `npx expo install expo-apple-authentication` puis `npx eas-cli@latest build -p ios --profile production --auto-submit`. **Ne pas retirer le bouton Apple tant que Google est proposé** (sinon re-rejet 4.8).

# Audit / corrections du 02/07 (base qui marche)

- **Verrou commande = 3 COUCHES (ne jamais en retirer une)** : (1) gate UI `commander/index.tsx` ; (2) re-vérif `src/lib/eligibilite.ts` → `peutCommander()` appelée par la fiche produit `[categorieId].tsx` (redirect vers `/commander` si non éligible — l'accueil pousse DIRECT vers une catégorie, sans ça le gate se contourne) ET par `panier.tsx` avant l'insert ; (3) **policy RLS serveur** : l'INSERT `commandes` exige `auth.uid() = client_id AND public.peut_commander()` (fonction SQL SECURITY DEFINER, migration `commandes_insert_verrou_eligibilite`, même règle : admin || commande_debloquee || ≥1 carte complétée/cadeau). Le WARN linter « peut_commander executable by authenticated » = VOULU (booléen inoffensif, requis par la policy).
- **Contrôle « commandes ouvertes » du panier** : lit `boutique_config` du **magasin choisi** (`eq('id', magasin)`), PLUS JAMAIS la ligne legacy `'principal'` (qui existe encore en base mais n'est plus une source de vérité). Le trigger serveur `verifier_ouverture` (BOUTIQUE_FERMEE) vérifie déjà `new.magasin` — le client doit rester aligné.
- **Écrans client vs admin** : toute lecture de `commandes` côté écrans CLIENT (accueil, bannière commander, mes-commandes) DOIT filtrer `.eq('client_id', session.user.id)` — la RLS « admin lit tout » ferait sinon voir à un admin les commandes des autres dans SES écrans. Seul `admin-commandes.tsx` lit sans filtre (c'est son rôle).
- **Splash** : `AnimatedSplashOverlay` (animated-icon.tsx) = voile **#623E91** (violet charte, couleur du splash natif d'app.json). Ne JAMAIS remettre le bleu #208AEF du template Expo. Version web = null.
- **`app-tabs.web.tsx` doit rester le MIROIR de `app-tabs.tsx`** (flag `useCommandeEnLigne` + route `c` masquée) : toute modif des onglets se fait dans LES DEUX fichiers (dupliqués exprès, cf. boucle Metro).
- **Téléphone : purge finale** — `admin-commandes.tsx` ne lit plus `profils.telephone` ; PIN fidélité : numéro de carte = **exactement 8 chiffres** (`compte.tsx`), et la lecture `fidelite_pin_demandes` filtre sur SA carte. La colonne DB `fidelite_pin_demandes.telephone` garde son nom historique mais contient le numero_fidelite. Profil legacy « Jp » (numero=tél 10 chiffres, carte cloud inexistante) remis à zéro en base le 02/07 → il réactivera une carte propre dans l'appli.
- **Code mort du template Expo SUPPRIMÉ** (themed-text/view, hint-row, web-badge, collapsible, external-link, use-theme, use-color-scheme, constants/theme, global.css, animated-icon.module.css, store/favoris, data/catalogue-helpers). `src/types/qrcode.d.ts` ajouté pour `npx tsc --noEmit` propre. ⚠️ `expo-glass-effect` + `expo-symbols` restent dans package.json (deps NATIVES inutilisées → à retirer au PROCHAIN build EAS, pas en OTA).
- **admin-commandes.tsx** utilise désormais les couleurs/polices de `constants/charte.ts` (plus de constantes locales ni fontWeight). NB : la palette in-app (`charte.ts`, violet #3A2A5E « design clair food ») diffère VOLONTAIREMENT ( ?) du violet officiel #623E91 (icône/splash) — trancher avec Yoann avant tout alignement global.

# Rejet App Store 4.0 du 02/07 (clavier iPad) — corrigé le 03/07

- **Motif Apple** : sur iPad Air 11" (l'app tourne en mode compatibilité iPhone, `supportsTablet:false`), le **clavier number-pad de l'écran date de naissance (gate-naissance) ne pouvait pas être fermé** après Sign in with Apple → reviewer bloqué (guideline 4.0, submission 12028745, version 1.0 (20)).
- **Règle PERMANENTE : tout `TextInput` (surtout `number-pad`/`numeric`, SANS touche retour sur iOS) doit vivre dans un `ScrollView keyboardShouldPersistTaps="handled"` ENVELOPPÉ d'un `KeyboardAvoidingView behavior="padding"` (iOS), avec un moyen évident de fermer le clavier** (tap extérieur et/ou auto-`Keyboard.dismiss()` quand la saisie est complète — 8 chiffres date, etc.). Fixes appliqués : `gate-naissance.tsx` (KAV + ScrollView + tap-dismiss + auto-dismiss 8 chiffres), `compte.tsx` hub connecté (KAV ajouté — champs PIN/codes en bas de page) + date d'inscription (auto-dismiss), `[categorieId].tsx` (KAV + persistTaps pour la note produit, la barre « Ajouter » reste visible).
- **Guideline 2.3.10** : ne JAMAIS afficher un bouton/mention **Google Play dans l'app iOS** (reclamer-carte.tsx : boutons stores désormais par plateforme). `LIEN_IOS` = lien direct `https://apps.apple.com/fr/app/id6783475068` (app id ASC 6783475068).
- **Re-soumission** : changements JS mais la review teste un BINAIRE → `npx eas-cli@latest build --platform ios --profile production --auto-submit`, tester le build via TestFlight sur un VRAI iPhone (gate naissance, changement PIN, note produit : clavier fermable partout), puis dans App Store Connect → version 1.0 → sélectionner le nouveau build → « Resubmit to App Review ». Compte reviewer aix@bubblestop.fr : date_naissance ✓, carte complétée ✓, commande_debloquee ✓ (vérifié en base le 03/07).
- Play Console (Android) : release 12 (1.0.0) toujours « En cours d'examen » au 03/07 — rien à faire, attendre Google.

# Fidélité — affichage (03/07)

- **« Grande boisson » partout** : toute mention d'une boisson offerte précise que c'est une GRANDE (taille L, M pour les Signatures sans L) — inscription, label date de naissance, explore. La règle est codée côté POS (`fidelite-helpers.js estLigneEligible`) : seule une L (ou M si pas de L) est éligible, extras payants.
- **Historique des cartes complétées** : `explore.tsx` affiche « 🏆 Mes cartes complétées » depuis la table **`fidelite_cartes`** (RLS = ses lignes uniquement), alimentée par le POS à chaque carte remplie. Repli « +X avant la mise en place de l'historique » quand `fidelite_cloud.cartes_completees` (compteur à vie) dépasse les lignes datées. Le cumul de cartes est natif : `cadeaux` s'additionnent tant qu'ils ne sont pas utilisés, visibles sur l'app ET le pass Wallet (wallet-pass ≥ 03/07).

- **Carte express — récupération SANS friction (04/07, edge carte-temp v7)** : `reclamer-carte.tsx` n'appelle PLUS `activer_ma_carte` avant de réclamer. L'edge identifie le compte via le JWT : compte **sans carte** → **rattachement direct** (`profils.numero_fidelite = code de la carte express`) — tampons, boissons offertes et historique conservés tels quels ; compte **avec carte** → transfert intégral côté caisse (`fidelite_demandes type='transfert'` : tampons + cadeaux déplacés, vieux QR redirigé à vie via `fidelite_cloud.transferee_vers`). L'écran affiche désormais tampons **+ cadeaux** (`etat` renvoie `cadeaux`), gère le statut `rattachee` (« déjà associée à un autre compte »), et précise que le QR express reste valable. Placeholder de saisie = numéro de carte numérique (8 chiffres, les vieux jetons alphanumériques marchent toujours). Déploiement = OTA.

- **🤝 Parrainage (04/07)** : composant `src/components/parrainage.tsx` monté dans `explore.tsx` (page Ma carte). Mon code parrain = mon `numero_fidelite` (partage natif Share / navigator.share) ; saisie d'un code parrain (nouveaux comptes <60 j, un seul parrain — contrainte unique serveur). Tout passe par l'edge **`agent-bubblestop`** (actions `mon-parrainage` / `parrainer`, JWT). Récompenses (parrain +3 / filleul +2 tampons, réglables dans `agent_config`) créditées AUTOMATIQUEMENT à la 1ère commande du filleul par le tick quotidien de l'agent (via `fidelite_demandes`, appliquées par la caisse). Si l'edge ne répond pas, la section s'efface silencieusement (return null). Déploiement = OTA.
