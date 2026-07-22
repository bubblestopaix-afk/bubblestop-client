# Bubble Stop — Design System

> **Fresh Tea and Boba.** A young, friendly bubble-tea brand from Aix-en-Provence (France).
> This design system encodes the official *charte graphique* (Feb 2022, V3) into reusable tokens, components, foundation cards and product recreations.

---

## 1. Brand context

**Bubble Stop** is a bubble-tea (boba) shop. The menu — *la carte* — is the brand's primary
customer-facing artifact: a portrait poster of drink families (Fruit Tea, Milk Tea, Matcha,
Milkshake, Citronnade…) on a deep-violet field, with white grid-paper cards and candy-coloured
price pills. The identity reads **fresh, natural, playful and youthful**.

- **Name / wordmark:** BUBBLE STOP. The elongated **L** evokes a straw; the two **green leaves** on it evoke tea. The whole mark feels *saine et naturelle* (healthy & natural).
- **Baseline / tagline:** *FRESH TEA AND BOBA*
- **Pictogram:** a bubble-tea cup carrying the same straw-L + leaves (used for avatars / stickers).
- **Web:** www.bubblestop.fr · **Contact:** bubblestopaix@gmail.com
- **Loyalty promise:** *9 boissons achetées = 1 grande offerte* (buy 9, get a large free).
- **Cup sizes:** S 360 ml (33 cl) · M 500 ml (50 cl) · L 700 ml (70 cl).
- **Touchpoints (charter):** carte, gobelets (plastic & paper), cup seals, reusable & paper straws, napkins, kraft bag, business card, loyalty card, email signature, social avatars.

### Sources provided
- `uploads/bubble_stop_charte_graphique_fevrier2022_V3.pdf` — the official 37-page brand charter (logo rules, colours, type, motifs, photography, illustrations, collateral mock-ups).
- `uploads/Carte_Final.jpg` — the production menu (3250×4585), the canonical example of the brand "in use". Logo and product photos in `assets/` were extracted from it.

> The original logo & illustrations in the PDF are **vector** and could not be rasterised in this environment, so the wordmark in `assets/logo/` was extracted (and cleaned to transparent) from the menu JPG. The charter's character illustrations are **not** included — see Caveats. If you have the vector logo / illustration files, drop them in `assets/` to upgrade.

---

## 2. Content fundamentals — how Bubble Stop writes

The voice is **French, warm, concrete and unfussy** — it names ingredients and lets the product
speak. It is descriptive, never salesy; there are no exclamation marks, no slogans shouting at you.

- **Language:** French for all customer copy (menu, collateral). The product *names* are a fun
  Franco-English mix that mirrors boba culture — `Fruit Tea`, `Milk Tea`, `Tiger Sugar`,
  `Classic Matcha`, `Crème Brûlée`, `Mango Punch`, `Milkshake`, `Cherry Blossom`. Keep this code-switch.
- **Casing:**
  - Product / category names → **Title Case**, set in Paytone One (`Fruit Tea`, `Thés du monde`).
  - Descriptions & flavours → **sentence case / lower-case lists** in Outfit (`thé vert, sirop de mangue, citron`).
  - The **wordmark and a few labels are ALL-CAPS** (`BUBBLE STOP`, `TAILLE`, `SUCRE`).
- **Ingredient-first descriptions:** a one-line recipe under each name —
  *"Thé noir, crème brûlée caramélisée + 1 ou 2 toppings"*, *"citron fraîchement pressé, eau et sucre"*.
- **Money:** comma decimal, € **after** the number, with `S : `, `M : `, `L : ` prefixes —
  e.g. `S : 3,5€`, `M : 4,5€`, `L : 5,5€`. Supplements read `supplément lait d'avoine : +0,60€`.
- **Conventions & footnotes:** a star **✱** flags *froid uniquement* (cold only); the page foots with
  *"Prix TTC en euros"*. Options are phrased *"+ 1 ou 2 toppings"*, *"2 inclus dans toutes les boissons"*.
- **No emoji.** The brand expresses fun through **colour, shapes and illustration**, not emoji or
  unicode symbols. (The only glyphs are the brand's own sparkles, bubbles and the ✱ cold marker.)
- **Vibe words (from the charter's cup seals):** *cool · fun · happy · crazy · chill · hungry.*
  Use this register for social / playful surfaces — short, lower-case, upbeat.

**Examples**
- Category line: `Fruit Tea — Thé + 1 saveur fruitée + 1 ou 2 toppings`
- Recipe line: `Tiger Sugar — Lait entier et Brown Sugar + 1 ou 2 toppings`
- Footnote: `✱ froid uniquement   —   Prix TTC en euros`

---

## 3. Visual foundations

### Colour
Two **primaries** carry the brand: **Violet `#633e90`** (distinguished, natural, a light feminine
touch — Pantone 267 C) and **Green `#9fc038`** (calming, refreshing — the leaf/nature note).
A **secondary** set softens and supports: Lavender `#bbaad3`, Mauve pastel `#eae8f5`, Yellow `#f2da33`,
and Violet profond `#4c2d77`.

A dedicated **product-family palette** gives every drink line its own colour, and three of them
double as the **size pills** on the carte:
| Family | Hex | Role |
|---|---|---|
| Traditional (Thés du monde) | `#2bb4a9` teal | family accent |
| Milk Tea | `#89cfe3` sky | family accent **+ size M pill** |
| Fruit Tea | `#e3b2d3` pink | family accent **+ size L pill** |
| Citronnade | `#f0b737` amber | family accent |
| Signature | `#8ebe74` green | family accent **+ size S pill** |
| Milkshake | `#ec647b` coral | family accent |

**Vibe of imagery:** warm, bright, *light & luminous* product photography on the violet/lavender
palette (charter rule). Drinks are shot clear and colourful on a crumpled white grid-paper surface.

### Type
- **Paytone One** — the single display face. Thick, rounded, reassuring; used for the wordmark,
  category titles and drink names. Set it **solid** (line-height ≈ 1.0) at large sizes.
- **Outfit** — the body face (300–800). Clean and highly legible for descriptions, flavour lists,
  prices, captions and all UI. Weight contrast (e.g. 400 vs 700) does the "aération" / rhythm work.
- Charter print hierarchy: Paytone 40/40 (titre) · Paytone 20/30 · Outfit 11/17 (courant) · Outfit 8/12 (légende).
- Web-safe fallback for email: **Calibri**.

### Backgrounds & surfaces
Two signature surfaces, no photographic hero backgrounds:
1. **`.bs-field`** — the **deep-violet field** (`#633e90`) with a faint top glow and a darker
   wave-shadow pooling at the bottom edge. This is the menu's "paper".
2. **`.bs-paper`** — **white grid-paper**: warm off-white with a fine 22 px grid and a soft
   diagonal sheen suggesting lightly **crumpled** stock. Every drink block sits on one of these cards.

### Graphic motifs (the brand "univers")
The charter defines three recurring shapes that *agrémentent* (garnish) layouts — placed sparingly
and harmoniously, **never crowding**:
- **Sparkles** — small 4-point twinkles (outline or solid white on violet).
- **Bubbles** — outline circles & dots, evoking the tapioca *perles de saveur*.
- **Wave** — a soft scalloped band along top/bottom edges of the violet field.

### Borders, radii & cards
- **Generous, soft radii** everywhere ("bords légèrement arrondis"): pills are fully round
  (`--radius-pill`), cards ~18 px (`--radius-card`), buttons ~14–20 px.
- **Cards** = white grid-paper, **flat** (no drop shadow) — the texture and rounding do the work.
  Optional **category accent**: a coloured top hairline or a coloured title.
- **Borders** are used lightly: violet hairlines for structure; thicker 2–3 px violet outlines
  appear on outline buttons and the price-pill candy style.

### Shadow system
- The **logo never takes a shadow** (hard charter rule — no inner or drop shadow).
- Menu cards are **flat**. Shadows are reserved for *interactive* UI: soft violet-tinted
  `--shadow-sm/md/lg`, a chunky candy `--shadow-pill` (a solid 4 px violet drop) for pills/buttons,
  and `--shadow-pop` for popovers/dialogs.

### Motion, hover & press
Friendly and bouncy, but subtle.
- **Easing:** `--ease-bounce` (gentle overshoot) for entrances & toggles; `--ease-out` for most
  transitions; durations 140 / 240 / 420 ms.
- **Hover:** lift slightly (`translateY(-2px)`) and/or deepen the violet; pills brighten.
- **Press:** **shrink** to ~0.96 and drop the candy shadow (button "presses down" onto the page).
- Respect `prefers-reduced-motion`.

### Transparency & blur
Used lightly. Soft white radial glows on the violet field; occasional translucent white panels
over the field (e.g. legend chips). No heavy glassmorphism.

---

## 4. Iconography

Bubble Stop has **no third-party icon set and no icon font.** Its iconography is its own small
**graphic-motif vocabulary**, drawn from the charter:

- **Sparkles** (4-point twinkles), **bubbles** (outline circles / dots = tapioca pearls), and the
  **wave** band — all provided as the `Decorations` brand component (simple geometric SVG, since the
  charter explicitly defines them as basic shapes — *petites formes : étoiles, cercles ; vague*).
- **Cup glyphs** for the size selector (S/M/L) — simple line drawings of the three cup sizes.
- The **✱ star** is the only functional symbol — it marks *froid uniquement* on the menu.
- **No emoji, no unicode pictographs** in customer copy.

If a future product surface (e.g. an ordering app) needs UI icons not in this vocabulary, use a
**rounded, friendly** open set — **Lucide** (CDN, 2 px round caps) is the closest match to the
brand's soft geometry — and document the addition here. *(None are bundled today — flagged so the
choice is deliberate, not accidental.)*

---

## 5. Index / manifest

**Root**
- `styles.css` — the single entry point consumers link (a list of `@import`s only).
- `readme.md` — this guide.
- `SKILL.md` — Agent-Skills front-matter so this folder works as a downloadable skill.

**Tokens** (`tokens/`, all reached from `styles.css`)
- `fonts.css` — `@font-face` for Paytone One + Outfit (woff2, hosted in `assets/fonts/`).
- `colors.css` — primaries, secondaries, product family, ramps, semantic aliases.
- `typography.css` — families, weights, type scale, line-heights, tracking + helper classes.
- `spacing.css` — 4 px spacing scale, radii, border widths, layout & control sizing.
- `effects.css` — shadows, the `.bs-paper` & `.bs-field` surfaces, motion tokens.
- `base.css` — light element resets + brand defaults.

**Assets** (`assets/`)
- `logo/` — `bubble-stop-logo-white.png` (transparent), `bubble-stop-logo-violet.png`.
- `products/` — 7 extracted drink photos (fruit-tea, milk-tea, matcha, milkshake, thés-du-monde, citronnade, crème-tiger).
- `fonts/` — the woff2 binaries.

**Components** (`components/`) — see each `*.prompt.md`
- `brand/` — `Logo`, `Decorations` (Sparkle / Bubble / Wave / sticker).
- `core/` — `Button`, `Card`, `Badge`.
- `menu/` — `PricePill`, `CategoryHeading`, `MenuItem`, `FlavorList`, `ToppingChip`, `SizeSelector`, `SugarLevel`.

**UI kits** (`ui_kits/`)
- `menu/` — the full **Carte** (`index.html`, recreation of `Carte_Final.jpg`) **+ a light variant** (`index-claire.html`, "Carte Claire" — colour-block header bands on a lavender field). The brand's signature artifact.
- `collateral/` — loyalty card, business card & cup-seal stickers.

**Foundation cards** (`guidelines/`) — small `@dsCard` specimens that populate the *Design System* tab.

---

## 6. Caveats
- **Logo is raster** (extracted & cleaned from the menu JPG), not the original vector. Good for
  screen use; replace with the official `.ai/.eps/.svg` for print.
- **Pictogram & character illustrations not included** — they are vector-only in the charter and
  could not be extracted here. The brand's illustration style (fun, youthful characters) is
  documented but not reproduced (the brief forbids inventing illustrations).
- **Fonts** are the correct families (Paytone One + Outfit, both Google Fonts) — **no substitution**.
