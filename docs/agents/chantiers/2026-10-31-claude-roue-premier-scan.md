# Roue du Mois — accès dès un premier scan en boutique

Claude — 31/10/2026 — EN COURS.

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
