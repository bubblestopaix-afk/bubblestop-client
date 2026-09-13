# Bubble Stop client — instructions racine

> Ce fichier court est chargé à chaque session. Les règles détaillées sont lues à
> la demande selon le tableau « Routage du contexte ». L'ancien journal intégral
> reste archivé et consultable par recherche ciblée.

## Priorités permanentes

- Répondre à Yoann en français, de façon concise et factuelle.
- Toujours commencer chaque commande terminal par le `cd` absolu vers ce dépôt.
- Ne jamais saisir, afficher, journaliser ni versionner un secret, jeton, mot de
  passe, certificat, clé de service ou donnée réelle d'un client.
- Le dépôt peut être utilisé simultanément par Codex, Claude, Kimi et Yoann. Ne
  jamais annuler, écraser, reformater ou committer le travail d'une autre session.
- Garder les changements ciblés. Aucun bump, build, OTA, soumission, flag live,
  migration ou déploiement hors du périmètre explicitement demandé.
- Ne jamais annoncer un test, commit, push, OTA, build ou état live avant sa
  vérification réelle.

## Concurrence et verrouillage

Avant toute modification :

1. Lire ce fichier et `git status --short --branch`.
2. Vérifier les chantiers actifs ci-dessous.
3. Pour un lot multi-fichiers, ajouter une ligne et créer un journal dans
   `docs/agents/chantiers/` avec le périmètre exhaustif.
4. Ne pas toucher un fichier verrouillé par un chantier `EN COURS` de moins de
   48 heures.
5. Ne jamais réécrire le journal d'une autre session ; ajouter une correction
   factuelle signée ou un nouveau journal.
6. `git add -A` et `git add .` sont interdits. Lister explicitement ses fichiers.
7. Préfixer les commits par la session : `codex:`, `claude:` ou `kimi:`.

### Chantiers actifs

| Session | Depuis | Statut | Fichiers / dossiers verrouillés |
|---|---|---|---|

À la fin, marquer le journal `TERMINÉ` puis retirer sa ligne de ce tableau.

## Routage du contexte

Lire uniquement ce qui correspond aux fichiers ou au comportement touché :

| Périmètre | Instructions obligatoires |
|---|---|
| Écrans, composants, auth, fidélité, offres, navigation | `src/AGENTS.md` |
| Boba Quest, Boba Tower, Roue, économie et récompenses | `docs/agents/contextes/jeux.md` |
| OTA, EAS, builds, stores, runtime et dépendances natives | `docs/agents/contextes/release.md` |
| Pages publiques, confidentialité et règlements | `docs/agents/contextes/public.md` |
| Tests et scripts de contrôle | `scripts/AGENTS.md` |
| Schémas ou évolution Supabase | `supabase/AGENTS.md` |
| Architecture ou impact transverse | Graphify ciblé, puis sources et tests réels |
| Ancienne décision | archive par `rg`, jamais lecture intégrale |

Les contextes spécialisés précisent cette racine mais ne peuvent pas affaiblir une
garde de sécurité, d'accès aux clients réels ou de publication.

## État de référence

- Expo SDK **54**, React Native **0.81**, application et runtime **1.0.3**.
- `runtimeVersion.policy = appVersion` : une OTA ne cible que les binaires de la
  même version applicative.
- `main` est le code de référence. Le dernier commit au début de ce chantier est
  `9370876`; cela ne prouve pas qu'il est publié en OTA.
- Dernière OTA production vérifiée : groupe
  `969af8d1-d696-461b-b080-110e9f885d53`, runtime `1.0.3`, commit `ba5bd07`,
  publiée le 09/08/2026 pour iOS et Android. Vérifier EAS avant tout rollback.
- Le seul fichier non suivi initial est `Publier OTA preview.command`, aide locale
  appartenant à Yoann. Ne jamais le modifier ni l'ajouter à un commit sans demande.

## Contrats produit actuels

- La fidélité utilise exclusivement le code opaque `numero_fidelite`. Ne jamais
  réintroduire `profils.telephone` ou `fidelite_cloud.telephone`, colonnes supprimées.
- L'activation de carte passe par la RPC serveur ; le client ne choisit ni n'écrit
  lui-même son numéro de fidélité.
- Pour les seules offres flash, le magasin vient du dernier scan QR physique
  enregistré par le POS. Ne jamais demander ni déduire une boutique d'origine à
  l'inscription ; sans scan connu, seules les offres nationales sont visibles.
- La commande en ligne est retirée du produit. Les anciennes routes ne doivent pas
  être conservées ni redevenir accessibles par un flag ou un lien résiduel.
- Le menu client est une vitrine de familles et saveurs sans prix ni panier. Il
  indique explicitement que les achats se font uniquement en boutique.
- Email, Sign in with Apple et Google sont des voies d'authentification supportées.
  Apple reste proposé sur iOS quand une connexion tierce est disponible.
- Le module Google natif est chargé à la demande : Expo Go doit continuer à ouvrir
  l'app et expliquer que Google nécessite une build native.
- Les jeux sont réservés aux comptes connectés et restent pilotés par leurs flags.
  Un écran masqué ou hors ligne doit échouer fermé sans effacer la progression.
- Boba Quest, Boba Tower et la Roue du Mois sont trois jeux distincts. Ne pas
  recoupler leur accès, règlement, quota ou récompense par commodité.
- `PASSEPORT_ACTIF` reste `false` comme défaut compilé. Toute activation demande un
  pilote réel et une décision explicite ; la valeur serveur reste l'autorité live.
- Une récompense réelle, un tampon, un lot ou un achat ne doit jamais être validé
  uniquement par l'UI ou l'état local. Le serveur et la preuve métier font foi.

## Données et Supabase

- Projet Supabase : `zpnoopitysojsvuqnbuo`. Seule la clé publique anonyme peut être
  embarquée ; une clé `service_role` n'a jamais sa place dans cette application.
- Respecter RLS, identité de session, idempotence et mode fail-closed. Une mutation
  ambiguë ne doit pas être rejouée aveuglément si elle a pu réussir côté serveur.
- Les fichiers `supabase/schema*.sql` sont des instantanés historiques, pas une
  preuve du schéma live ni un dossier de migrations fiable.
- Les évolutions serveur vivent dans `bubble-tea-pos`. Ne jamais lancer
  `npx supabase db push` depuis ce dépôt.

## Publication

- **Production contient de vrais clients.** Aucun `eas update`, rollback, republish,
  build ou submit production sans validation complète et accord explicite de Yoann.
- Les essais OTA utilisent `preview`. Toujours employer `npx eas-cli@latest` :
  `eas` n'est pas installé globalement.
- Une OTA est réservée au JavaScript compatible avec le runtime courant. Toute
  dépendance, plugin ou configuration native exige un nouveau build.
- Avant production : démarrage réel, connexions email/Apple/Google, onglets,
  fidélité, jeux concernés, absence de secret/log et scénario de rollback vérifié.
- Le push Git publie aussi le site public via Cloudflare Pages ; relire l'impact des
  changements sous `public/` avant de pousser.

## Graphify

Quand `graphify-out/graph.json` existe :

1. Vérifier la racine réelle du dépôt.
2. Commencer par `graphify query` avec une question précise et un budget court.
3. Utiliser `graphify path` ou `graphify explain` pour réduire le périmètre.
4. Confirmer dans les fichiers du worktree, le diff et les tests.
5. Après modification transverse, lancer `graphify update .`, puis actualiser le
   graphe global local si nécessaire.

Graphify est une carte locale, jamais une preuve de production. Ne pas charger son
rapport entier ni y indexer secrets, certificats, données clients ou archives IA.

## Validation et clôture

- Pendant le travail, lancer les tests ciblés ; avant clôture, utiliser
  `npm run test:quiet` puis `git diff --check`.
- Toute modification TypeScript doit passer `tsc --noEmit`. Une interface modifiée
  doit être vérifiée sur les plateformes et tailles réellement concernées.
- Un changement natif exige un build ; une route ou un bundle web exige un export
  adapté. Ne pas lancer un build coûteux sans nécessité ou demande.
- Relire le diff, retirer le verrou, puis ajouter explicitement les seuls fichiers
  du lot au commit.

## Archives

- L'ancien fichier racine de 409 834 octets est conservé mot pour mot dans
  `docs/agents/archive/AGENTS-2026-08-08-avant-optimisation.md`.
- SHA-256 :
  `0f0a9e98577b51b3dae73d79dd03fc27c30e9ef082261bd08f88c5f9a1c4d0b0`.
- Rechercher d'abord un titre ou un terme avec `rg`, puis lire uniquement la plage
  utile. Ne jamais réinjecter l'archive entière dans le contexte automatique.
