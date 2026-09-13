# Audit accueil, roue et avis Google — 13 septembre 2026

TERMINÉ — source locale, non publiée. Base f0f57e7, worktree séparé. Préserver le fichier personnel
« Publier OTA preview.command » du dépôt de Yoann. Aucun déploiement demandé.

Périmètre : src/app/index.tsx, composants accueil dédiés, helper avis Google,
scripts de tests ciblés et dossier audit/2026-09-13-client. Capturer l'interface
réelle avec des API fictives avant/après. Conserver la charte, les flags de jeu,
les quotas et les récompenses côté serveur. Ne pas ajouter de poll.

Ajout demandé par Yoann : préciser « Boisson L offerte » sur la roue, sa liste
de chances et le lot déjà conservé. Fichiers supplémentaires :
src/components/roue/roue.ts et src/app/roue.tsx. Le règlement existant réserve
la taille M aux Signatures ; rendre cette exception visible sans changer le lot.

Google interdit les avantages contre un avis, indépendamment de la note.
Retenir une invitation facultative sans récompense liée. Boutique exclusivement
déduite de dernier_magasin_scan ; sans scan valide, ne pas deviner de destination.

Validation finale : suite complète `npm run test:quiet` et export Expo web réussis.
Recette de composants en données fictives à 320/390 pixels ; avis Aix/Lyon/Toulouse,
sans scan, réseau en erreur, visiteur et roue désactivée contrôlés. Aucun tirage
ni compte réel. Ouverture Google native et formulaire final non testés.

Fichiers produits : src/components/carte-roue-accueil.tsx,
src/components/carte-avis-google.tsx, src/lib/avis-google.ts,
scripts/test-avis-google.cjs, package.json (commande de test),
src/app/index.tsx, src/app/roue.tsx, src/components/roue/roue.ts,
audit/2026-09-13-client/ et ce journal. Rapport : audit/2026-09-13-client/AUDIT.md.
Aucune nouvelle lecture périodique, migration, récompense ni publication.
