# Mesurer les ouvertures vers Google

EN COURS — Codex. Demande acceptée par Yoann : compteur de clics vers Google par
boutique et période, distinct des avis effectivement publiés. Base 1d9c97c, même
source produit que l’OTA accueil d522ee02. Fichiers : avis-google.ts,
carte-avis-google.tsx, test-avis-google.cjs ; serveur/Stock dans le dépôt POS.
Un clic déclenche une RPC sans bloquer Google ; erreurs ignorées pour cette mesure
facultative, aucun rejeu ni poll. Le serveur filtre les doubles appuis et les comptes
test ; agrégats par jour/boutique, sans contenu d’avis. Aucun flag ni récompense.
Graphify global existant est antérieur à la carte avis ; routage Supabase confirmé
puis sources réelles. Le nouveau lien est CarteAvisGoogle → signalerOuvertureAvisGoogle
→ noter_ouverture_avis_google → compteurs SQL → statsClients dans Bubble Stock.

## Validation

Suite `npm run test:quiet`, TypeScript strict et export web réussis. Recette visuelle locale : choix Lyon puis clic fait passer le compteur de 0 à 1 ; aucun avis ni appel réel dans cette recette. PostgreSQL isolé valide droits, trois magasins, rejet anonyme, comptes test exclus, double appui et suppression de compte. Migration serveur `20260913210903` appliquée, Stock v97/PWA publiés. Application/runtime 1.0.3 inchangés, aucune dépendance/configuration native modifiée. OTA production précédente vérifiée : d522ee02-d024-4ab4-b7cf-1dd866eb28d4.

Préparation d’une OTA preview (projet 10b00fe2-73e1-408c-a36a-23d1a079bb05, environnement production, iOS et Android, runtime 1.0.3). Recette sur build interne native indisponible ; ne pas prétendre un essai physique. Promotion production après validation du périmètre/exception applicable.

Commande locale de validation :
```sh
cd /Users/yoannderoo/Desktop/bubblestop-client-avis-20260913 && npm run test:quiet
```

## Preview publiée et vérifiée

Groupe **e4397209-2b0c-4191-a926-4c933668bfa8**, source **d272649**, publié le 13/09/2026 à 21:13:53 UTC pour Android et iOS, runtime **1.0.3**. Les deux bundles sont exportés et téléversés ; aucun nouvel asset natif. Production précédente non remplacée. Le 13/09, question explicite envoyée à Yoann pour autoriser la diffusion client malgré l’absence de recette native sur téléphone ; réponse en attente.

## Autorisation de diffusion

Yoann répond **« publie »** à la demande de diffusion du compteur aux clients malgré l’absence de recette sur téléphone physique. Cette instruction autorise la promotion du groupe preview exact vers le canal production pour iOS et Android, runtime 1.0.3. Aucun nouveau build natif, aucune modification de fidélité et aucun rejeu de migration.
