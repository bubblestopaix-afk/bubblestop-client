# Anniversaire client — Codex, 13 septembre 2026

Statut : TERMINÉ — implémentation locale validée, publication séparée.

Demande : 5 boissons réellement payées sur les 12 mois précédant l’anniversaire ; explication discrète ; notification annuelle et rappel accueil. Autorisation explicite des notifications anniversaire uniquement.

Périmètre : migration additive et RPC anniversaire, marketing-auto, projection electron/achats-lignes.js (aucune écriture fiscale), tests dédiés ; client lib/composants anniversaire, accueil, Fidélité, promesse naissance/inscription, routage notification et tests.

Budget : réutilisation du cron quotidien existant (1 × 1 × 1 jour × 30 = 30 invocations Edge/30 jours, delta zéro). Lecture client via RPC PostgREST au focus, sans timer ni Edge supplémentaire, dédoublonnée et cache mémoire 5 minutes par compte. Aucun nouveau poll POS.

Constat : historique cloud démarrant le 24/08/2026, sans quantité payée distincte. Les unités ambiguës ne seront pas inventées. Les cadeaux existants restent inchangés.

Publication : aucune migration, Edge, OTA ou version POS publiée à ce stade ; déploiement ordonné à préparer après validation.

## Résultat

Source prête, sans migration/deploiement/OTA/package. Rapport détaillé :
`/Users/yoannderoo/Desktop/bubble-tea-pos-anniversaire-20260913/audit/2026-09-13-anniversaire/QUALIFICATION.md`.
Le complément inclut tpv-api, le libellé de notifications promotionnelles Stock
et les chapitres/annexe/manifest documentaire, sans modifier la version publiée.
Tests : 1 285 POS, tests SQL isolés et trigger crédit live rejoué, suite client
et TypeScript, builds POS/web et deux bundles Edge. Rendu 320/390 px validé.
Conditionnement des achats historiques et recette native restent documentés.
