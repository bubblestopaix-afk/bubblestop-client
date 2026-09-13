# Application client — audit du 13 septembre 2026

La roue était peu visible dans l’accueil. Elle dispose maintenant d’une carte dédiée, en tête de page, avec une illustration et un bouton jaune. Le lot indique **« Boisson L offerte »** sur la roue, dans les chances et pour le lot conservé ; l’exception **M pour les Signatures** reste explicitement affichée.

Une carte **« Ton avis compte »** a été ajoutée. Elle retrouve la boutique du dernier scan au clic. Aucun avis n’est prérempli, aucune note n’est imposée et aucune récompense n’est attribuée en échange.

**État : source locale testée, non publiée.** Base f0f57e7, branche `codex/audit-client-roue-avis-20260913` dans le dossier séparé `bubblestop-client-audit-20260913`.

## Parcours examinés

1. **Accueil — contrôlé avant/après.** Composant réel de l’application, données fictives, colonnes de 390 et 320 pixels. La roue était après le catalogue, Quest et Tower. Elle est maintenant immédiatement après l’en-tête. Les offres restent avant les boissons, sous le titre « Promotion du jour » demandé par Yoann.
2. **Roue — contrôlée visuellement.** Navigation depuis l’accueil et retour, libellé L, liste des chances, règle Signature. Aucun tirage effectué. Probabilités, code `roulette_boisson_l`, quota et attribution des récompenses inchangés.
3. **Offres — revue du rendu et du code.** Titre, message et ancienneté sont affichés ; le filtre suit le dernier scan. La carte fictive ne prouve ni l’éligibilité ni l’application d’une offre réelle en caisse.
4. **Avis Google — contrôlé avec trois profils fictifs.** Aix, Lyon et Toulouse produisent trois liens distincts. Le cas sans scan donne une consigne de scan ; une erreur réseau conserve un message et permet de réessayer. Aucun lien vers une boutique n’est fabriqué à partir du magasin d’origine.
5. **Accès — contrôlés.** Visiteur : roue et avis masqués. Roue désactivée : carte masquée, avis indépendant. Tests du changement de compte pendant la lecture et du nouveau scan entre deux clics.

Ces captures montrent le vrai rendu des composants avec des services remplacés par des réponses fictives. La petite navigation du bas appartient au harnais de recette. Cet audit n’est pas une recette iOS/Android complète, un audit de sécurité ou une vérification du service de caisse.

## Améliorations proposées, par priorité

| Priorité | Constat | Amélioration proposée | Critère de réussite |
|---|---|---|---|
| 1 — fait | La roue ressemblait à une troisième petite carte de jeu, loin dans l’accueil. | Carte dédiée en haut, contraste violet/jaune, action explicite. | Accès en un toucher, sans débordement à 320 pixels, garde serveur conservée. |
| 1 — suite | La fidélité et les cadeaux disponibles arrivent après le catalogue et les deux jeux. Le nouvel encart roue allonge encore cette distance. | Remonter un résumé « Mon QR / Mes cadeaux » avant les jeux ; conserver le détail dans Fidélité. | Un client venu faire scanner sa carte atteint son QR et voit son cadeau disponible immédiatement. |
| 1 — suite | L’accueil relit les données toutes les 15 secondes, sans condition de visibilité dans cet effet. Deux lectures du profil se succèdent dans le même cycle. | Mutualiser le profil, actualiser au retour sur l’écran et après une action utile, arrêter le poll hors consultation. | Même fraîcheur après scan, moins de lectures, essais après reprise et perte réseau. |
| 2 — suite | La case d’accueil de la roue ne distingue pas un tour disponible d’un tour déjà joué. Le détail le fait seulement après ouverture. | Afficher « Mon tour du mois » ou « Voir mon lot », à partir de l’état existant, sans nouveau poll ni promesse de gain non confirmé. | Aucun faux bouton invitant à rejouer ; lot en attente clairement identifiable. |
| 2 — suite | Les offres privilégient le texte promotionnel et l’ancienneté. Les conditions utiles dépendent du texte saisi. | Présenter automatiquement boutique, tailles concernées, dates de validité et nécessité de scanner la carte, à partir des règles réellement supportées. | Une offre « double tampons L » montre ses restrictions sans devoir les deviner. |
| 2 — suite | Sur la roue, les notes générales sont petites et pâles ; « NOUVEAU » et « PILOTE » occupent de la place sur les petites cartes de jeu. | Renforcer les textes de conditions et remplacer les badges permanents par une information réellement utile. | Lecture confortable avec texte agrandi ; pas de rognage sur petit téléphone. |

Le potentiel de réduction réseau est un calcul de code, pas une mesure de production : avec compte, carte et offres activés, l’accueil peut effectuer quatre lectures REST par cycle de 15 s, soit **960 lectures par heure montée**. Les timers mobiles peuvent être suspendus en arrière-plan. Ce nombre ne correspond pas à des invocations Edge Functions ni à des utilisateurs actifs mesurés.

Le nouveau bouton d’avis ajoute **zéro appel périodique** et au plus une lecture de profil par action, puis utilise le navigateur. Il ne crée pas d’appel Edge dédié. Les contrôles de session utilisent le client d’authentification existant.

## Avis Google et boisson L

Google interdit les avantages, produits gratuits ou remises en échange d’un avis, même sans demander une note positive. La proposition « un avis = une boisson L » n’est donc pas implémentée. Une offre de boisson L peut être conçue séparément, avec une condition indépendante des avis. [Règle officielle Google](https://support.google.com/contributionpolicy/answer/7400114?hl=fr).

Les fiches publiques ont été rapprochées des adresses suivantes via leurs liens Google :

| Dernier scan | Boutique | Identifiant public de fiche |
|---|---|---|
| Aix | 32 rue Espariat | `ChIJRZe6J72NyRIROG8EKm4FZhI` |
| Lyon | 26 rue Victor Hugo | `ChIJif8QNwnr9EcRyMFB4tdVdJo` |
| Toulouse | 39 rue des Changes | `ChIJXWQyZRS9rhIRqiyfNgCvnpw` |

Sources de rapprochement : [Aix](https://bubblo.fr/salon/bubblestop-aix-en-provence), [Lyon](https://bubblo.fr/salon/bubble-stop-lyon), [Toulouse](https://bubblo.fr/salon/bubblestop-toulouse). Les liens émis ont été vérifiés dans le harnais. Le formulaire Google final et l’ouverture sur téléphone restent à vérifier ; aucun avis n’a été publié. Les liens « Demander des avis » directement fournis par le gestionnaire des fiches restent préférables s’ils sont disponibles.

Sur téléphone, l’ouverture du navigateur est demandée après la lecture. Sur le web, la boutique retrouvée et un lien explicite sont affichés : le clic direct évite le blocage des fenêtres après une requête asynchrone.

## Validation et limites

- `npm run test:quiet` réussi : Tower, Roue, Quest, menu (8 familles / 52 saveurs), offres, nouveaux tests d’avis, TypeScript strict.
- Export Expo web réussi ; aucune dépendance, version, migration, règle de récompense ou publication modifiée.
- Rendu contrôlé en 320 et 390 pixels, navigation accueil/roue, cas visiteur, flag désactivé, scan absent, erreur réseau, liens des trois boutiques.
- Le harnais présente les avertissements web déjà rencontrés avec certaines propriétés d’accessibilité des composants existants ; il ne prouve pas la conformité avec VoiceOver/TalkBack. Essai natif, texte agrandi, ouverture Google et vérification des fiches nécessaires avant diffusion.
- Aucun accès aux comptes réels, aucune attribution de lot, aucun avis transmis.
- Graphify utilisé comme carte de repérage sur la source initiale ; comportement vérifié dans le code. Le nouveau worktree ne contient pas de graphe généré.

Commande de validation :

```sh
cd /Users/yoannderoo/Desktop/bubblestop-client-audit-20260913 && npm run test:quiet
```

Aperçu fictif local :

```sh
cd /Users/yoannderoo/Desktop/bubblestop-client-audit-20260913 && node audit/2026-09-13-client/preview/server.cjs
```

Le harnais utilise l’esbuild déjà installé dans le dépôt POS voisin. Ouvrir `http://127.0.0.1:58785/?magasin=lyon`, ou ajouter `&largeur=320`. Aucun backend réel n’est accessible depuis cet aperçu.

## Captures

Avant :

![Accueil initial, colonne 390 pixels](avant-mobile.png)

Après :

![Roue visible en tête de page](apres-accueil.png)

![Même carte à 320 pixels](apres-320.png)

![Lot explicitement en taille L](apres-roue.png)

![Invitation facultative aux avis](apres-avis.png)

![Repli sans dernier scan](sans-scan.png)
