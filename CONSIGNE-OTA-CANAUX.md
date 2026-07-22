# CONSIGNE OTA — canaux EAS Update (16/07/2026, rédigée par Claude, validée Yoann)

## Signalement initial (16/07, ~18h00–18h30) — OTA réfuté par l'audit EAS
Deux changements ont été constatés sur l'iPhone de Yoann entre 18h03 et 18h31 et
ont d'abord été attribués à un supposé OTA production :
- l'onglet **« Commander » a disparu** de la barre (le flag serveur
  `commande_en_ligne_active` n'a pas bougé depuis le 28/06) ;
- une erreur **« The authorization attempt failed for an unknown reason »**
  (Sign in with Apple) est apparue juste après.

**Correction factuelle Codex, audit en lecture seule à 19h27 : aucun OTA n'a été
publié le 16/07, ni entre 18h00 et 18h30.** `eas update:list --branch
production --limit 5` et `eas update:view` montrent comme dernier groupe production
`bc5028e7-629a-42a2-9480-8bf9a38de929`, créé le 12/07 à 20h04 heure de Paris
(commit `251547734239f7a22e07f9666bad8cca980592d8`). La build 24 et ce groupe ont les
mêmes `app-tabs.tsx`; le flux Apple est inchangé. Les onglets locaux ont été
modifiés le 15/07 à 16h21 et restent non déployés. **Ne pas effectuer de rollback
pour ce signalement.** Chercher la session/statut admin pour Commander et
l'appareil/AuthenticationServices pour Apple.

Le canal production = les clients réels des 3 boutiques. Ils reçoivent chaque
update en quelques minutes, sans passage par les stores.

## Règles (permanentes)
1. **`eas update --branch production` = INTERDIT pour tester.** Publication sur
   production UNIQUEMENT après validation complète ET accord explicite de Yoann.
2. **Tests OTA → `eas update --branch preview`.** Le profil existe déjà dans
   `eas.json` (`build.preview.channel = "preview"`). Pour recevoir ces updates :
   une build interne `eas build --profile preview` installée sur l'appareil de test
   (à générer une fois). Les builds store, elles, restent sur production.
3. **Checklist avant TOUT publish production** : l'app démarre ; connexion
   email + Apple + Google OK ; barre d'onglets complète (Accueil / Fidélité /
   Offres / Compte, + Commander si flag actif pour le magasin/admin) ; écran
   fidélité lisible ; aucun secret/console.log ajouté. Publier ensuite avec un
   message d'update explicite (`--message "..."`).
4. **Rollback d'urgence** : `eas update:republish` de l'update stable précédent
   sur production (plus rapide que corriger en avant). À connaître AVANT d'en avoir besoin.

## Audit immédiat terminé le 16/07
1. Production aujourd'hui : **aucune publication**. Dernier OTA : 12/07 à 20h04.
2. Commander : retrait complet voulu par Yoann le 15/07, mais changement local
   non commité/non déployé. La version publique masque déjà l'onglet aux non-admins
   avec le flag `{}` et le montre aux admins ; aucun rollback n'est justifié.
3. Apple : aucune ligne `loginApple`, `AppleAuthentication`, `signInWithIdToken`,
   `expo-apple-authentication` ou `usesAppleSignIn` n'a changé entre build 24,
   dernier OTA et copie locale. Poursuivre côté appareil si l'erreur se reproduit.
4. Règles preview/production consignées dans la section Déploiement d'`AGENTS.md`.

## Note
Le dossier `_kit-google-natif/` (connexion Google native, préparé par Claude) est
indépendant : à intégrer plus tard via son README, build native 1.0.3 requise,
rien à publier sans le GO de Yoann.
