# Inventaire — Dossier DA Bubble Stop

Un export par visuel réellement utilisé dans les maquettes. PNG à transparence réelle (≤ 800 px de large) ou SVG si vectoriel. Noms en kebab-case.

---

## 1. Photos produits — `assets/photos/` · **FINAL** (PNG alpha réelle, ≤ 800 px)
| Fichier | Écran(s) | Usage | Statut |
|---|---|---|---|
| `fruit-tea.png` | Accueil (vitrine) — réserve | Fruit tea (orange, boba rouge + noir) | final |
| `fruit-tea-orange.png` | Accueil (vitrine) | Fruit tea affiché (orange, boba rouge) | final |
| `milk-tea.png` | Accueil (vitrine) | Milk tea | final |
| `matcha.png` | Accueil (vitrine) | Matcha | final |
| `milkshake.png` | Accueil (vitrine) | Milkshake | final |
| `citronnade.png` | Accueil (vitrine) | Citronnade | final |
| `thes-du-monde.png` | Accueil (vitrine) | Thés du monde | final |
| `creme-tiger.png` | réserve (non affiché) | Crème brûlée / Tiger — version PROPRE retouchée | final |

_Tous : vrais gobelets Bubble Stop, transparence réelle, sans damier ni texte fantôme._

## 2. Logos — `assets/logo/` · **FINAL** (SVG vectoriel)
| Fichier | Usage | Statut |
|---|---|---|
| `bubble-stop-logo.svg` | Logo couleur sur fond clair (en-tête DA) | final |
| `bubble-stop-logo-blanc.svg` | Header violet, carte membre fidélité | final |
| `bubble-stop-logo-2lignes.svg` / `-blanc.svg` | Formats carrés/verticaux | final (réserve) |
| `bubble-stop-logo-baseline.svg` / `-blanc.svg` | Lockup + « Fresh Tea and Boba » | final (réserve) |
| `picto-gobelet.svg` / `picto-gobelet-violet.svg` | Avatar, favicon, tampons | final (réserve) |

## 3. Marque & déco — `assets/brand/` · **FINAL** (SVG)
| Fichier | Écran(s) | Usage | Statut |
|---|---|---|---|
| `mascotte-perle.svg` | Accueil (Boba Quest), Compte (avatar), Parcours (niveau courant) | Mascotte-perle rose signature | final |
| `mascotte-perle-couronne.svg` | Collection / Arène (Taro Queen) | Variante couronnée | final |
| `etincelle.svg` | Fonds violets | Étincelle ✦ décor | final |
| `perle-monnaie.svg` | Tous écrans du jeu | Monnaie « perle » (solde) | final |
| `trio-pastilles.svg` | Ouvertures de section (app) | Trio vert/jaune/rose | final |
| `vague.svg` | Bas/haut des fonds violets | Bande ondulée | final |

## 4. Jeu — piste 2c — `assets/game/` · **FINAL** (SVG)
`picto-arene`, `picto-capsule`, `picto-collection`, `picto-roulette`, `picto-boutique`, `picto-infini`, `picto-troc`, `picto-jouer-cible` — tuiles & rangées du hub Boba Quest et écrans associés.

## 5. Design system COMPLET — `_ds/bubble-stop-design-system-…/`
Tokens CSS (`colors`, `typography`, `spacing`, `effects`, `base`, `components`, `fonts`), `styles.css`, `_ds_bundle.js` (composants compilés), `_ds_manifest.json`, `readme.md` (charte), `assets/fonts` (Outfit, Paytone One), `assets/logo`, `assets/products`. **Référence de style de vérité.**

## 6. Maquettes — `maquette/`
| Chemin | Usage | Statut |
|---|---|---|
| `App Bubble Stop - DA Kawaii.dc.html` | Toutes les maquettes (réf. visuelle écran par écran) | final |
| `support.js`, `ios-frame.jsx` | Runtime pour ouvrir la maquette dans un navigateur | technique |
| `maquette/assets/photos/` | Copies chargées par la maquette | final |
| **`maquette/assets/products/`** | — | **⚠️ OBSOLÈTE** |

> ⚠️ **`maquette/assets/products/` est OBSOLÈTE** : ce sont des brouillons issus du menu PDF. L'app a déjà été corrigée pour utiliser `maquette/assets/photos/`. Ne pas réutiliser ces fichiers.

## 7. Cartes collectibles (24) — **NON FOURNIES / NE PAS MODIFIER**
Les 24 illustrations de collectibles **existantes gardent leur identité visuelle et leurs noms** (décision Yoann). Les mascottes-perles simplifiées visibles sur la maquette « Collection » (3c) ne sont **que des repères de mise en page** — ne pas les exporter comme assets, ne pas remplacer les vraies cartes, ne pas renommer les personnages.
