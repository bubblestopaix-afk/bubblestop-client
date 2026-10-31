# Roue du Mois — accès dès un premier scan en boutique

Claude — 31/10/2026 — TERMINÉ (serveur, règlement, preview et production publiés).

## Demande

Yoann : « pourquoi la roue ne s'active que 7 jours après le premier scan ? elle devrait être
active dès le premier scan », puis « on peut changer ça pour juste 1 scan en boutique ».

## Constat

Règle posée le 04/10 (Codex, accord de Yoann « ok fais 1 et 2 ») contre les comptes
opportunistes : 7 jours révolus après l'inscription Auth ET un scan de carte dans une boutique
du réseau. Seule `tirer_roue_du_mois` l'appliquait (aucune autre fonction ni Edge Function).

## Changement

- Serveur (dépôt `bubble-tea-pos`, `dbea598`) : migration `20261031130737_roue_acces_des_premier_scan`
  appliquée par MCP ; seule la ligne `v_disponible_le := v_inscription + interval '168 hours'`
  devient `v_disponible_le := v_inscription`. Contrôles : empreinte avant attendue, ligne unique,
  après-coup « 168 hours » absent, `not v_scan_requis` présent, droits service_role seuls,
  SECURITY DEFINER conservé (empreinte après `0796b5db…`).
- Appli : textes de `src/app/roue.tsx` et `src/lib/roue-serveur.ts` sans « 7 jours » ;
  `scripts/test-roue-serveur.cjs` adapté.
- Règlement public `public/reglement-roue-du-mois.html` : accès dès un premier scan, version du
  31 octobre 2026.

## Validation

`npm run test:quiet` (dont `tsc --noEmit`) réussi ; `npm run test:jeu` : Tower, Roue, Quest OK ;
`git diff --check` propre.

## Publication — Claude, 31/10/2026

- Serveur : appliqué et vérifié (voir ci-dessus) ; effet immédiat pour toutes les versions de l'appli.
- Dépôt client poussé (`d603412`, avec les 4 commits de sécurité déjà en preview, sans autre
  changement sous `public/`) : règlement en ligne sur `commande.bubblestop.fr/reglement-roue-du-mois`
  vérifié « Version du 31 octobre 2026 », sans « 7 jours révolus ».
- OTA preview : groupe `71fc355c-85af-49a5-8e7d-d91278ecc894` (Android
  `01a19216-a657-7e53-92ab-17f5d941e14f`, iOS `01a19216-a657-7abb-8ecc-50024e3365b6`), runtime
  1.0.3, commit marqué modifié par EAS à cause du seul fichier local non suivi de Yoann.
- Production : inchangée, en attente de l'accord explicite de Yoann (elle embarquerait aussi le
  Wallet par code et le retrait du jeton à la déconnexion, en preview depuis le 18 et le 27/10).
  Jusque-là, l'appli en production affiche encore « dès 7 jours après ton inscription » dans
  l'intro de la roue, alors que le serveur ne l'exige plus.

## Production — Claude, 31/10/2026

Yoann : « publie ». Republication à l'identique du groupe preview `71fc355c…` vers la branche
`production` : groupe `c3cd7a5f-cfa2-44a6-aed8-1e2a74a072e2` (Android
`01a1921b-2f02-7272-82cd-0da4ead4964e`, iOS `01a1921b-2f02-79d6-a1fd-9bb70c1b1636`), runtime
1.0.3. Vérifié : c'est la dernière update de `production`, qui précède `0697e049…`.

Contenu par rapport à `0697e049` : roue dès le premier scan (textes), Wallet par code de 2 min
(13d2a96), mise à jour limitée aux stores officiels, retrait du jeton de notification à la
déconnexion (600e73c).

Non constaté : recette sur téléphone (démarrage, connexions, Wallet, déconnexion, roue).
Retour arrière : republier `0697e049-f6d2-43f0-8699-c4bda0c61585` (groupe production stable
précédent, vérifié dans la liste live) après contrôle de l'update fautive.
