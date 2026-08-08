# Contexte des jeux

À lire pour Boba Quest, Boba Tower, la Roue du Mois, leur économie, leurs accès et
leurs récompenses.

## Séparation et accès

- Boba Quest, Boba Tower et la Roue sont trois produits séparés : flags, routes,
  règlements et règles de quota restent indépendants.
- Les jeux exigent une session. Les gardes de l'accueil et de la route doivent
  partager la même décision et échouer fermé quand l'état live est inconnu.
- Retirer un accès masque le jeu sans supprimer progression, lots ou sauvegarde.
- Un flag absent ou illisible ne doit pas rendre une fonctionnalité publique.

## Autorité et économie

- Toute récompense réelle est créée, plafonnée et confirmée côté serveur. Un id de
  route, une animation terminée ou AsyncStorage ne prouve jamais un droit.
- Les achats viennent de `achats_lignes`, publiés par le POS après fiscalisation.
  Leur ingestion reste monotone, idempotente et résistante aux publications tardives.
- Le Passeport a `PASSEPORT_ACTIF = false` comme défaut compilé. La configuration
  serveur peut le piloter, mais aucune activation sans pilote physique explicite.
- La Roue est autonome depuis le commit `9370876`. Ne pas la rattacher au flag,
  aux quotas ou aux libellés de Boba Quest.
- Ne jamais transformer une mécanique gratuite en hasard acheté ou ajouter un
  paiement réel à une capsule.

## Sauvegarde et moteurs

- Boba Quest utilise `VERSION_SAUVEGARDE = 2`. Ne la changer que si la forme
  persistée change réellement et qu'une migration descendante sûre existe.
- En synchronisation : `undefined` signifie lecture serveur en échec ; `null`
  signifie absence de sauvegarde. Les confondre peut écraser une progression riche.
- L'état local ne parle pas directement au réseau. Les adaptateurs dédiés assurent
  synchronisation, reprise et validation.
- Garder les moteurs purs, déterministes et testables. Injecter le hasard et le
  temps plutôt que dépendre de `Math.random()` ou `Date.now()` dans la logique pure.
- Le store revalide toute entrée issue de l'UI ou d'un deep-link avant un crédit.

## Validation

- `npm run test:jeu` après tout changement de jeu ; conserver ses trois lignes de
  succès Tower, Roue, Quest.
- `./node_modules/.bin/tsc --noEmit --pretty false` pour tout changement TypeScript.
- Vérifier migrations de sauvegarde, idempotence, accès fail-closed, bornes
  économiques et morsure des tests pour une correction de moteur.
- Une interface de jeu doit être testée au doigt sur la plateforme cible avant
  production ; le typage ne couvre ni le ressenti ni les défauts visuels.
