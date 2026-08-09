# Codex - offres liées au dernier scan fidélité (09/08/2026)

Statut : TERMINÉ ✅

## Demande

Le QR reste valable dans toutes les boutiques. Les offres flash visibles dans
l'application client suivent automatiquement le magasin du dernier scan physique,
sans demander de boutique à l'inscription ni afficher une boutique d'origine.

## Fichiers du chantier

- `src/app/index.tsx` ;
- `src/app/offres.tsx` ;
- `src/app/compte.tsx` (éditeur administrateur historique) ;
- `src/lib/offres.ts` et `src/AGENTS.md` ;
- `scripts/test-offres.cjs`, `scripts/AGENTS.md` et `package.json` ;
- ce journal et `AGENTS.md` pour le verrou temporaire.

## Hors périmètre

Aucun changement du QR, de l'inscription, de l'authentification, du runtime natif,
de la version, du build ou de la publication OTA.

## Livraison

- l'accueil et l'écran offres lisent uniquement `dernier_magasin_scan` ;
- sans scan connu, une offre locale reste masquée et une offre des trois boutiques
  reste visible ; aucune boutique d'origine n'est utilisée ;
- l'éditeur administrateur historique permet de choisir Aix, Lyon et Toulouse et
  transmet ce périmètre à l'offre et au push ;
- un test dédié protège ce contrat et fait partie de `npm run test:quiet`.

## Vérifications

- suite client complète : verte ;
- TypeScript strict : vert ;
- test ciblé offres : vert ;
- export Expo web : vert, 33 routes statiques ;
- Graphify actualisé et `git diff --check` propre.

## Publication

Aucune OTA, build native, publication Cloudflare ou modification de version n'a
été réalisée dans ce chantier.
