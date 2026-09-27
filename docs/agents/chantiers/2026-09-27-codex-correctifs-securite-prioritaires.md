# SEC-02 — Roue du Mois, 27/09/2026

Statut : TERMINÉ pour les sources, tests et export local. NON PUBLIÉ.

Yoann demande la correction des deux premières failles de l'audit POS/client/Stock.
La correction serveur et le journal détaillé sont dans bubble-tea-pos :
`docs/agents/chantiers/2026-09-27-codex-correctifs-securite-prioritaires.md`.

Périmètre : src/app/roue.tsx, src/lib/recompenses-jeu.ts, nouveau module
src/lib/roue-serveur.ts, scripts/test-roue-serveur.cjs et scripts/test-jeu.cjs.

L'écran demande le tirage au serveur avant l'animation, sans code de prix ni
horloge du téléphone. La lecture au focus retrouve le résultat persistant. Les
anciens gains enregistrés sont affichables. Le cache local non prouvé ne crée
plus de lot. Les changements de compte isolent l'écran et les réponses tardives.
Les jeux restent séparés ; probabilités et animation de la roue conservées.

Validé : test:quiet (incluant nouveau test du pont), TypeScript, export Expo web,
sept scénarios web réels sur réponses simulées (390×844 et 1280×900), zéro erreur
JavaScript, aucun envoi serveur réel. Graphify update . effectué, avertissement
sur 14 fichiers non-code sans nœuds ; sources et tests font foi.

Commandes :
```sh
cd /Users/yoannderoo/Desktop/bubblestop-client && node scripts/test-roue-serveur.cjs
cd /Users/yoannderoo/Desktop/bubblestop-client && npm run test:quiet
cd /Users/yoannderoo/Desktop/bubblestop-client && npx --no-install expo export --platform web --output-dir /tmp/codex-roue-securisee-web
```

Aucun bump runtime 1.0.3, OTA, push ou déploiement. La publication nécessitera
la migration 20260927195907 et jeu-recompenses corrigé avant le client. Les vieux
clients gardent leurs gains enregistrés mais doivent être actualisés pour de
nouveaux tirages. Recette native à faire avant diffusion. Le fichier local de
Yoann Publier OTA preview.command est conservé intact et non versionné.
