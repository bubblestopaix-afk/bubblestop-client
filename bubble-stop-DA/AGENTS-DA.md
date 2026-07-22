# 🎨 Direction artistique Bubble Stop — À RESPECTER

> **Copie ce bloc dans `AGENTS.md` (racine du repo)** — ou ajoute la ligne `@bubble-stop-DA/AGENTS-DA.md` à ton `AGENTS.md`. Toute modification graphique doit suivre cette DA.

## Règle pour Codex / tout agent
**Avant tout changement visuel** (écran, composant, couleur, icône, espacement), suivre la DA « kawaii » Bubble Stop — alignée sur la charte des menus. **Ne jamais inventer de couleurs ou de polices hors charte.** En cas de doute : `src/constants/charte.ts`, le design system `bubble-stop-DA/_ds/…` et les maquettes.

**Ne pas toucher au code de l'app** (`src/`, `package.json`, config…) depuis ce dossier : l'intégration au code est faite par la conversation « JEU ». Ce dossier est une **référence DA + assets**.

## Tokens (source de vérité)
`src/constants/charte.ts` — version à jour dans `bubble-stop-DA/charte-kawaii.ts`.
- **Violet signature** `#633E90` · **Violet profond** `#452A6E` · **Violet clair** `#815FAE`
- **Vert boba** `#9FC038` (actions, tampons, S) · **Jaune perle** `#F2DA33` (offres, M) · **Rose bubble** `#F7B8D6` (L, badges)
- **Pastels de carte** : fruitées `#EDF6E1` · lactées `#FBF2E5` · toppings `#FDEFF6`
- **Surfaces** : fond `#F7F5FB` · cartes `#FFFFFF` · lavande `#ECE7F6` · bordure `#F0EBF8`
- **Texte** : `#443657` / `#7D6F95` / `#A99FC0`

## Typographie
- **Fredoka** (600) — titres, noms, voix « souriante ». Installer : `npx expo install @expo-google-fonts/fredoka`.
- **Outfit** (400–800) — texte courant, prix, listes.
- **Paytone One** — réservé au logo.

## Composants & signes
- **Cartes** : blanches, bordure 3 px `#F0EBF8`, rayon 22–24, ombre douce violette. Sur pastel : bordure 3 px blanche.
- **Trio de pastilles** vert/jaune/rose en ouverture de section · **séparateurs pointillés roses** · **étincelles ✦** · **mascotte-perle** rose.
- **Rayons** : carte 24 · bouton 16 · pilule 999. **Pas d'emoji** dans le contenu client (sauf sparkles ✦ de marque et ✱ « froid uniquement »).
- **Monnaie du jeu** : la **perle** (`assets/brand/perle-monnaie.svg`).

## Jeu Boba Quest — plus de fantaisie permise
Sur les écrans du jeu : dégradés violets immersifs, ombres « candy » 3D, pictos illustrés multicolores, cartes « verre ». **Garder l'ADN** : violet, perles, Fredoka. Piste retenue : **2c « Carte au trésor »**.

## ⚠️ Cartes collectibles (24) — NE PAS MODIFIER
Les illustrations et **les noms** des 24 collectibles existants sont conservés (décision Yoann). Ne pas fournir de remplaçants simplifiés ; les mascottes de la maquette « Collection » ne sont que des repères de layout.

## Références
- Assets finaux : `bubble-stop-DA/assets/` (voir `INVENTAIRE.md` pour l'usage de chaque fichier).
- Design system complet : `bubble-stop-DA/_ds/bubble-stop-design-system-…/`.
- Maquettes : `bubble-stop-DA/maquette/App Bubble Stop - DA Kawaii.dc.html`.

---

## 📦 Journal de dépôt
**2026-07-18 — Dépôt DA kawaii complet** (`bubble-stop-DA/`) :
- `_ds/bubble-stop-design-system-f3ccec49-…/` — design system complet (tokens, bundle, charte, fonts, logo, products)
- `assets/photos/` — 8 photos produits détourées finales (≤ 800 px, alpha réelle)
- `assets/logo/` — 8 logos SVG (couleur/blanc, 2 lignes, baseline, picto-gobelet)
- `assets/brand/` — mascotte-perle (+ couronne), étincelle, perle-monnaie, trio-pastilles, vague
- `assets/game/` — 8 pictos SVG du hub Boba Quest (piste 2c)
- `maquette/` — toutes les maquettes + runtime (`maquette/assets/products/` = **OBSOLÈTE**)
- `charte-kawaii.ts`, `INVENTAIRE.md`, `README.md`, `AGENTS-DA.md`
