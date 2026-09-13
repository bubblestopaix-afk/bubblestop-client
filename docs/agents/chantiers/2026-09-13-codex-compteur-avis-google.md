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
