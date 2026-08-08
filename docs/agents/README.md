# Contextes IA de l'application client

## Organisation

- `AGENTS.md` racine : règles permanentes, état courant et routeur.
- `*/AGENTS.md` : règles automatiques propres à un dossier.
- `contextes/` : règles transverses chargées sur demande, notamment jeux et release.
- `chantiers/` : un journal court par lot multi-fichiers.
- `archive/` : ancien journal intégral, uniquement pour une recherche précise.

Ne jamais demander à un agent de lire tout `archive/` ou tout le rapport Graphify.
Rechercher un terme, ouvrir le journal ou contexte correspondant, puis lire la
source réelle ciblée.

## Cycle d'un chantier

1. Déclarer le périmètre dans la racine.
2. Créer `chantiers/YYYY-MM-DD-session-sujet.md`.
3. Travailler uniquement dans les fichiers déclarés.
4. Ajouter validations et état de publication au journal.
5. Marquer `TERMINÉ`, retirer le verrou racine et committer explicitement.

La racine reste sous 12 Kio et les contextes spécialisés sous 6 Kio. Le script
`scripts/test-agents-contexte.cjs` bloque une nouvelle inflation silencieuse.
