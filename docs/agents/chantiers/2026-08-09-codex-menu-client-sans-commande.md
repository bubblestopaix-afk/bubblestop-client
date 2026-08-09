# Codex - menu client sans commande ni prix (09/08/2026)

Statut : TERMINÉ

## Demande

L'application client sert à consulter les familles et saveurs. Elle ne proposera
jamais de commande en ligne : retirer les routes, panier, mentions et prix visibles,
puis indiquer clairement que les boissons s'achètent uniquement en boutique.

## Fichiers du chantier

- `src/app/index.tsx` et `src/app/menu/[categorieId].tsx` ;
- `src/components/app-tabs.tsx`, `src/components/app-tabs.web.tsx` et
  `src/components/tab-icons.tsx` ;
- suppression de `src/app/commander/`, `src/store/panier.ts` et
  `src/lib/eligibilite.ts` ;
- retrait de l'ancien flag dans `src/lib/app-config.ts` ;
- tests et instructions associées ;
- `AGENTS.md` pour le verrou temporaire.

## Hors périmètre

Le catalogue source reste disponible pour la fidélité, les jeux et les saveurs.
Aucun changement d'authentification, de fidélité, de runtime, d'OTA ou de version.

## Livraison

- anciennes routes `commander`, panier, garde d'éligibilité et flag supprimés ;
- accueil et fiches indiquent que les achats se font uniquement en boutique ;
- prix, formats et tarifs retirés de la vitrine, saveurs et descriptions conservées ;
- suite complète, TypeScript et export web verts ; contrôle mobile sans erreur ;
- Graphify actualisé, aucune OTA ni publication déclenchée.
