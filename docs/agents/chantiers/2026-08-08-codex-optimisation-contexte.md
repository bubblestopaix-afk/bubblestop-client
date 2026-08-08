# Codex — optimisation du contexte IA client

**Date** : 08/08/2026
**État** : TERMINÉ

## Objectif

Réduire le contexte automatique de l'application client sans perdre les règles,
décisions ni historiques des sessions précédentes.

## Périmètre

- `AGENTS.md`, `.graphifyignore`, `package.json` ;
- `docs/agents/` ;
- `src/AGENTS.md`, `scripts/AGENTS.md`, `supabase/AGENTS.md` et les contextes
  internes sous `docs/agents/contextes/` ;
- `scripts/test-agents-contexte.cjs` ;
- `graphify-out/` local ignoré.

Le fichier non suivi `Publier OTA preview.command` est explicitement exclu.

## État initial et garde-fous

- Racine avant déclaration : 409 092 octets et 1 762 lignes.
- Archive après déclaration du chantier : 409 834 octets et 1 776 lignes.
- SHA-256 de l'archive exacte :
  `0f0a9e98577b51b3dae73d79dd03fc27c30e9ef082261bd08f88c5f9a1c4d0b0`.
- Baseline : `test:jeu`, `test:menu`, TypeScript et `git diff --check` verts.
- Aucun code produit, schéma, build, OTA, version, flag ou déploiement ne change.

## Livraison

- `AGENTS.md` racine réduit à environ 8 Kio, soit près de 98 % de contexte
  automatique en moins.
- Ancien journal conservé intégralement avec son empreinte SHA-256.
- Contextes ciblés ajoutés pour l'application, les jeux, les releases, les pages
  publiques, les scripts et Supabase.
- Archive volumineuse exclue du graphe actif ; Graphify régénéré sur les règles
  courantes et les sources réelles.
- `npm run test:quiet` valide contexte, trois jeux, menu et TypeScript avec une
  sortie compacte.
- Aucun code produit, schéma, build, OTA, version, flag ou déploiement modifié.
