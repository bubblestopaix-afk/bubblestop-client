# Bubble Stop — Dossier DA (handoff Codex / Claude)

Direction artistique « kawaii » de l'app client Bubble Stop, alignée sur la charte des menus.
À **déposer à la racine du repo** `bubblestop-client/`.

## Contenu
- **`AGENTS-DA.md`** — note à faire suivre par l'agent (Codex/Claude) + **journal de dépôt**.
- **`INVENTAIRE.md`** — chaque asset : écran, usage exact, statut (final / obsolète).
- **`charte-kawaii.ts`** — tokens à jour → à copier dans `src/constants/charte.ts`.
- **`_ds/…`** — **design system complet** (tokens CSS, composants, charte, fonts, logo, products).
- **`assets/`** — assets finaux propres :
  - `photos/` — 8 photos produits détourées (PNG alpha réelle, ≤ 800 px)
  - `logo/` — logos SVG (couleur/blanc, 2 lignes, baseline, picto-gobelet)
  - `brand/` — mascotte-perle (+ couronne), étincelle, perle-monnaie, trio-pastilles, vague
  - `game/` — 8 pictos SVG du hub Boba Quest (piste 2c)
- **`maquette/`** — toutes les maquettes (ouvrir le `.dc.html` dans un navigateur).
  ⚠️ `maquette/assets/products/` = **OBSOLÈTE** (brouillons menu PDF, cf. INVENTAIRE).

## Comment l'utiliser
1. **Note DA** : colle `AGENTS-DA.md` en haut de ton `AGENTS.md` (ou ajoute `@bubble-stop-DA/AGENTS-DA.md`).
2. **Tokens** : remplace `src/constants/charte.ts` par `charte-kawaii.ts` (installe Fredoka : `npx expo install @expo-google-fonts/fredoka`).
3. **Assets** : pioche dans `assets/` selon `INVENTAIRE.md`.
4. **Référence visuelle** : `maquette/App Bubble Stop - DA Kawaii.dc.html`.

## Règles importantes
- **Ne pas modifier le code de l'app** depuis ce dossier — l'intégration est faite par la conversation « JEU ».
- **Cartes collectibles (24)** : illustrations et **noms conservés** (décision Yoann). Aucun remplaçant simplifié.
