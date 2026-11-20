# Navigation et visuels de l'accueil, de la fidélité et des offres

Claude — 20/11/2026 — TERMINÉ (commité sur `main`, non poussé ; OTA preview publiée le 20/11 ;
production non publiée, en attente de l'essai sur l'iPhone et de l'accord explicite de Yoann).

## Demande

Yoann : « regarde l'appli stock et l'appli client et propose des améliorations de navigation
et graphique », « rends ça moins IA et plus humain », puis après la maquette avant/après :
« change aussi l'icône roue du mois, cette roue avec le smiley au milieu fait cheap » et
« tu peux passer aux corrections que tu as proposées, je les aime bien ».
Travail demandé sur la branche courante (`main`), sans nouvelle branche.

## Périmètre exhaustif

- `src/app/index.tsx` : carte fidélité remontée sous l'en-tête, picto dessiné pour Boba Tower
  à la place de l'emoji, trio de pastilles sur le premier titre seulement, textes plus simples.
- `src/app/explore.tsx` : Fidélité sans compte, boutons « Me connecter » et « Créer mon compte ».
- `src/app/compte.tsx` : paramètre de route `mode=inscription` qui ouvre l'onglet Inscription.
- `src/app/offres.tsx` : bouton retour (repli vers l'accueil sans historique), texte vide.
- `src/components/ui-kit.tsx` : option `trio` de `TitreKawaii` (vrai par défaut).
- `src/components/carte-roue-accueil.tsx` : nouvelle petite roue, sans visage.
- `src/components/picto-boba-tower.tsx` (nouveau) : gobelets empilés.

Hors périmètre de ce lot : bloc des trois boutiques avec photos, badge « préféré de l'équipe »,
accroche courte des promos (champ à créer côté éditeur), écran admin séparé de Compte.

## Réalisé (commité, non poussé, non publié)

- Fidélité sans compte : « Me connecter » (vers Compte) et « Créer mon compte » (vers Compte,
  onglet Inscription par `?mode=inscription&t=…`, hook placé avant tout retour).
- Offres : bouton retour ; sans historique (ouverture depuis une notification), retour à l'accueil.
- Accueil : carte fidélité (ou « Active ta carte ») sous l'en-tête, avant anniversaire, roue,
  promo, vitrine et jeux ; trio de pastilles sur le premier titre seulement (« Nos boissons » le
  garde quand la promo n'est pas affichée) ; « Pas d'offre en ce moment » avec le picto cadeau au
  lieu d'une étincelle sur fond jaune ; salut sans compte « Bienvenue chez Bubble Stop ».
- Boba Tower : picto dessiné (trois gobelets empilés) sur la carte d'accueil. L'emoji reste sur
  l'invitation à s'inscrire de `boba-tower.tsx` (prop `emoji` de `InviteInscription`).
- Roue du Mois : petite roue à huit parts sans visage, repère cerné, mêmes couleurs.
- Maquette avant/après (artefact privé) alignée sur ce code.

## Validation

- `npm run test:quiet` (agents, jeux, menu, offres, avis, anniversaire, push, sécurité et
  `tsc --noEmit`) : réussi. `git diff --check` propre.
- `npx expo export --platform web` vers un dossier temporaire : réussi (`dist/` non touché).
- Web local sans compte, 375 × 812 : carte fidélité en tête, trio unique ; Fidélité → « Créer
  mon compte » ouvre l'onglet Inscription ; Accueil → promo → Offres → retour ; Offres ouvert
  directement → retour à l'accueil. Console : seulement les avertissements web déjà présents.
- Non vu à l'écran : accueil connecté (roue, Boba Tower, carte avec tampons), qui demande une vraie
  session. Natif iOS/Android non essayé. Roue et picto vus seulement sur une page de test reprenant
  les tracés exacts du code.

## OTA preview — Claude, 20/11/2026

Demande de Yoann : « pousse l'appli stock et fais la mise à jour ota ». Canal **preview** seul,
selon la garde production (essai sur la build interne avant toute production).

- Contrôle avant publication : seul code d'appli modifié depuis la dernière preview (`d603412`,
  groupe `71fc355c…`) = ce lot ; `npm run test:quiet` vert ; `git diff --check` propre ; dépôt
  propre hormis l'aide locale non suivie `Publier OTA preview.command` (hors bundle).
- `npx eas-cli@latest update --branch preview` depuis `1885c7a` (l'astérisque d'EAS vient de ce
  fichier non suivi) : groupe `f81d875f-9525-43e0-bacd-1e1d5c68dee4`, Android
  `01a1f87d-d132-7bbb-9776-b3483b08d837`, iOS `01a1f87d-d132-7636-84a7-99ab38403559`, runtime
  `1.0.3`. `dist/` (export ignoré par Git) vidé avant, comme le fait le script de Yoann.
- Vérifié dans EAS : dernière preview = ce groupe ; production inchangée (`c3cd7a5f…`, OTA du 31/10).
- Dépôt client non poussé (rien sous `public/` dans ce lot).
- Reste à faire avant production : essai sur l'iPhone avec la build preview (démarrage, connexions
  email, Apple et Google, onglets, fidélité, écrans touchés), puis accord explicite de Yoann.
