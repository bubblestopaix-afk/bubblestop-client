# Design QA — accueil avec vitrine boissons

- **Source visuelle** : `/var/folders/l_/0bcn7m295ljb_jnpv_rtxtc00000gn/T/codex-clipboard-e0319133-de45-40bd-b45d-03d35edc75f9.png`
- **Capture de l'implémentation** : `/Users/yoannderoo/Desktop/bubblestop-client/tmp/design-qa/accueil-vitrine-390x844.png`
- **Comparaison côte à côte** : `/Users/yoannderoo/Desktop/bubblestop-client/tmp/design-qa/comparaison-accueil.png`
- **Viewport** : 390 × 844
- **État** : référence native connectée/admin ; implémentation web locale déconnectée. Le contenu conditionnel (prénom, Boba Quest et fidélité liée) diffère donc volontairement, mais la structure commune de l'en-tête et la nouvelle vitrine sont comparables.

## Full-view comparison evidence

La capture locale confirme que l'en-tête violet conserve son logo, sa typographie et ses rayons, puis laisse maintenant une respiration claire avant la nouvelle vitrine. Le rail montre trois tuiles et une partie de la suivante à 390 px, ce qui rend le défilement horizontal évident sans indicateur. La vitrine occupe l'espace qui était vide depuis le retrait de la commande et crée un bloc visuel entre le prénom et les cartes fonctionnelles. Le DOM confirme que les six tuiles sont des images/génériques et non des boutons ou liens : aucune route `/commander` n'est réintroduite.

## Focused region comparison evidence

Un recadrage supplémentaire n'est pas nécessaire : à 390 × 844, la comparaison côte à côte rend lisibles le logo, les titres, les trois premières photos, les rayons, les espacements et la première carte fonctionnelle. Les détails importants de la modification sont tous au-dessus de la ligne de flottaison.

## Required fidelity surfaces

- **Fonts and typography** : Paytone One et Outfit restent les familles du design existant ; hiérarchie lisible entre « Nos boissons », le sous-titre et les noms de catégories. Aucun texte n'est tronqué ; « Les traditionnels » tient sur deux lignes dans sa tuile.
- **Spacing and layout rhythm** : le chevauchement négatif de 24 px a été retiré et remplacé par 12 px de marge sous le header. Le rail, ses tuiles et la carte suivante conservent un rythme de 16 px entre sections. Aucun débordement horizontal de la page ; seul le rail défile horizontalement.
- **Colors and visual tokens** : fond, violet, lavande, blanc, rayons et ombres réutilisent strictement `constants/charte.ts`. Le nouveau bloc ne crée aucune couleur concurrente.
- **Image quality and asset fidelity** : les six vraies photos WebP existantes sont utilisées, en `cover`, sans étirement ni placeholder. Les fonds et cadrages restent nets au viewport mobile.
- **Copy and content** : « Nos boissons » et « À retrouver en boutique » présentent une vitrine, sans promesse de commande, retrait ou click & collect.

## Findings

Aucun P0, P1 ou P2 restant sur la modification demandée.

- **P3 — état connecté non capturé localement** : la session web de contrôle est déconnectée, donc Boba Quest n'apparaît pas dans la capture d'implémentation. Le code place néanmoins la vitrine avant le bloc Boba Quest conditionnel ; la séparation demandée est structurelle et indépendante de la session. À confirmer une fois sur la build preview connectée.

## Comparison history

- **Pass 1** : aucun P0/P1/P2 détecté. La vitrine est visible, les vraies images chargent, le rail ne contient aucune action et la carte fonctionnelle suivante reste entièrement lisible. Aucun correctif visuel supplémentaire requis.

## Primary interactions and console

- Défilement vertical de l'accueil chargé correctement.
- Rail horizontal rendu avec six boissons ; tuiles volontairement non interactives.
- Navigation à quatre onglets visible et non recouverte à 390 × 844.
- Aucune erreur console. Deux avertissements web React Native préexistants concernent la dépréciation de `shadow*` et `pointerEvents` ; ils ne bloquent ni le natif ni cette modification.

## Final result

final result: passed

---

# Design QA — carte Aventure responsive (22/07/2026)

- **Source visuelle du défaut** : `/var/folders/l_/0bcn7m295ljb_jnpv_rtxtc00000gn/T/TemporaryItems/NSIRD_screencaptureui_Tw1ve9/Screenshot 2026-07-22 at 13.50.31.png`
- **Capture de l’implémentation corrigée** : `/Users/yoannderoo/Desktop/bubblestop-client/tmp/design-qa/boba-hub-aventure-wide-fixed.jpg`
- **Capture complète de l’implémentation** : `/Users/yoannderoo/Desktop/bubblestop-client/tmp/design-qa/boba-hub-wide-full.jpg`
- **Comparaison côte à côte** : `/Users/yoannderoo/Desktop/bubblestop-client/tmp/design-qa/boba-hub-aventure-qa-side-by-side.jpg` (défaut à gauche, correction à droite)
- **Viewport / densité** : source 1224 × 468 px, recadrage utile 1194 × 378 px à densité 2 puis normalisé à 597 × 189 ; implémentation mesurée à 633 × 678 CSS px, DPR 2, carte 597 × 190 CSS px et capture normalisée 597 × 190.
- **État** : hub web local `/jeu`, première visite, niveau 1, premier objectif actif.

## Full-view comparison evidence

La comparaison au même gabarit montre que la hiérarchie, la typographie, les couleurs, les rayons, la mascotte et le CTA sont conservés. Dans la source, le tracé pointillé et les deux nœuds verts ressortent sous le bouton. Dans l’implémentation corrigée, le tracé reste entièrement dans la zone violette libre au-dessus du CTA et suit la mascotte sans être rogné.

## Focused region comparison evidence

La carte seule est le bon niveau de détail : le défaut concernait exclusivement la relation entre le SVG décoratif et le CTA. Les mesures DOM confirment une carte de **597 × 190**, un SVG de **597 × 190** après correction (contre **597 × 315,08** avant), un bas de nœud à **541** et un haut de CTA à **548,5**, soit **7,5 px de séparation**. Aucun recadrage supplémentaire n’est nécessaire.

## Required fidelity surfaces

- **Fonts and typography** : familles et tailles existantes inchangées ; aucun nouveau retour à la ligne ni texte tronqué.
- **Spacing and layout rhythm** : seul le cadre de coordonnées du décor est corrigé. Le CTA conserve sa hauteur, ses marges et son ombre ; le parcours gagne une séparation mesurée de 7,5 px.
- **Colors and visual tokens** : aucune couleur ajoutée ; violet, vert, jaune, blanc et opacités restent issus des tokens existants.
- **Image quality and asset fidelity** : aucun asset raster, logo ou illustration n’est remplacé. Le SVG et la mascotte existants restent nets, sans étirement vertical.
- **Copy and content** : titre, niveau, objectif et libellé du bouton sont strictement inchangés.

## Findings and comparison history

- **Pass 1 — P1 corrigé** : le SVG absolu n’avait ni `width` ni `height`. Sur une carte large, React Native Web conservait son ratio intrinsèque et rendait le décor à 315,08 px de haut dans une carte de 190 px, ce qui plaçait les nœuds derrière le CTA.
- **Fix appliqué** : dimensions explicites `width="100%"` et `height="100%"` sur le SVG, tout en conservant le `viewBox` et `preserveAspectRatio="none"`.
- **Pass 2 — résultat** : aucun P0, P1 ou P2 restant. Le SVG mesure exactement la carte, le chemin est visible, les nœuds n’intersectent plus le CTA et l’action ouvre toujours `/jeu/parcours`.

## Primary interaction and errors

- Le bouton Aventure a été activé dans un onglet de contrôle : navigation vers `/jeu/parcours` confirmée.
- Aucun message d’erreur ni écran de récupération n’est visible après rechargement. Le canal de contrôle utilisé n’expose pas de journal console séparé ; TypeScript et les suites de tests couvrent donc la vérification technique complémentaire.

## Validation

- `npx tsc --noEmit` — OK.
- `npm run test:jeu` — OK.
- `npm run test:menu` — OK.
- `git diff --check -- src/app/jeu/index.tsx` — OK.

## Final result

final result: passed

---

# Design QA — logo officiel sur l’authentification (18/07/2026)

- **Source visuelle demandée** : `/var/folders/l_/0bcn7m295ljb_jnpv_rtxtc00000gn/T/TemporaryItems/NSIRD_screencaptureui_LXz1Dh/Screenshot 2026-07-18 at 22.46.40.png`
- **Source de marque** : composant vectoriel officiel `src/components/logo-bubblestop.tsx`, issu du PDF de marque et cohérent avec `bubble-stop-DA/assets/logo/bubble-stop-logo.svg`
- **Capture de l’implémentation** : `/Users/yoannderoo/Desktop/bubblestop-client/tmp/design-qa/auth-logo-officiel-390x844.png`
- **Comparaison côte à côte** : `/Users/yoannderoo/Desktop/bubblestop-client/tmp/design-qa/comparaison-auth-logo-780x844.png` (référence à gauche, implémentation à droite)
- **Viewport** : 390 × 844
- **État** : écran Compte déconnecté, onglet Connexion, rendu web local Expo SDK 54

## Full-view comparison evidence

La comparaison côte à côte au même viewport montre que le texte approximatif « BUBBLE STOP » de la référence est remplacé au même emplacement par le logotype vectoriel complet : lettres officielles, pousse verte au-dessus du « L », proportions d’origine et netteté indépendante de la densité d’écran. La largeur de 205 points conserve la hiérarchie de la référence sans modifier la carte, les champs ni la navigation. Le bouton Apple manque uniquement dans la capture web locale car son affichage est volontairement iOS-only ; son code natif n’a pas été touché.

## Focused region comparison evidence

La zone supérieure confirme un logo centré, entièrement visible, sans rognage ni déformation. Le ratio largeur/hauteur est celui du fichier de marque (`690,62 / 170,88`) ; aucune police ou reconstitution textuelle n’est utilisée.

## Required fidelity surfaces

- **Asset fidelity** : réutilisation du composant SVG officiel déjà employé dans l’accueil et la fidélité ; violet de marque et feuilles vertes conservés.
- **Spacing and layout rhythm** : espacement de 18 points entre le logo et la carte inchangé ; aucune variation des marges latérales ou verticales du formulaire.
- **Accessibility** : le logo expose le rôle image et le libellé « Logo Bubble Stop ».
- **Compatibility** : même composant React Native SVG sur iOS, Android et web ; aucun ajout de dépendance native.
- **States covered in code** : connexion/inscription, confirmation du compte et mot de passe oublié utilisent tous le vrai logo.

## Findings

Aucun P0, P1 ou P2 sur cette modification. Les deux avertissements web observés (`shadow*` et `pointerEvents`) ainsi que l’avertissement SSR React Native Web sur la prop `accessibilityElementsHidden` sont préexistants et sans rapport avec le logo ; la page reste rendue et interactive. L’erreur React #418 enregistrée par le navigateur venait de l’ancienne tentative d’ouvrir un export statique via une route `.html` ; elle n’est pas présente sur la page Expo locale vérifiée à `http://127.0.0.1:8082/compte`.

## Validation

- TypeScript : `npx tsc --noEmit` — OK.
- Export web Expo SDK 54 : `npx expo export --platform web --output-dir tmp/logo-auth-web` — OK, 29 routes générées.
- Vérification visuelle mobile 390 × 844 : logo officiel visible, centré et net — OK.
- Vérification DOM : une image accessible « Logo Bubble Stop » est présente — OK.

## Final result

final result: passed
