# Instructions application client

Ces règles s'ajoutent à `../AGENTS.md` pour tout fichier sous `src/`.

## Architecture et navigation

- Expo Router découvre les routes sous `app/`. Toute route qui ne doit pas devenir
  un onglet doit être masquée dans `components/app-tabs.tsx` ET
  `components/app-tabs.web.tsx`.
- Pour une route masquée, utiliser `tabBarButton: () => null` et
  `tabBarItemStyle: { display: 'none' }`. Ne jamais combiner `href` et
  `tabBarButton` : Expo Router plante au rendu natif.
- Tous les hooks restent avant les retours anticipés. Préserver l'ordre des hooks
  dans les gardes d'authentification, d'hydratation et de flags.
- Maintenir les parcours natifs et web. Un module natif absent d'Expo Go doit être
  chargé à la demande avec un message explicite, jamais au niveau global.

## Authentification et profil

- Conserver email, Apple sur iOS et Google natif. Ne pas affaiblir les contrôles de
  session ni exposer de jeton dans les logs.
- Le prénom et la date de naissance sont validés par les helpers partagés ; ne pas
  recréer des validations divergentes dans chaque écran.
- La suppression de compte reste destructive et distincte d'une confirmation
  ordinaire.

## Fidélité, offres et données

- Utiliser `numero_fidelite` comme identifiant opaque. Les colonnes téléphone de
  `profils` et `fidelite_cloud` sont supprimées.
- L'activation de carte passe par la RPC ; le client ne fabrique pas le code.
- Une promo ciblée est filtrée avec `offreVisiblePour`. Sans boutique connue,
  afficher uniquement les offres valables partout : repli fail-closed.
- Une mutation réseau ambiguë doit conserver l'action et demander une actualisation
  plutôt que provoquer un doublon potentiel.
- Les droits et récompenses réels doivent être revalidés côté serveur ; masquer un
  bouton ne constitue jamais une autorisation.

## Interface et validation

- Respecter la charte de `constants/charte.ts` et les composants existants. Les
  écrans compacts restent lisibles sur petit iPhone et sur le web.
- Préserver le contenu saisi pendant un chargement ou une erreur récupérable.
- Après modification : test ciblé, TypeScript strict, puis `npm run test:quiet`.
- Pour une route ou un rendu web modifié, vérifier l'export Expo web. Pour une
  interaction native, prévoir un essai sur appareil ou simulateur adapté.
