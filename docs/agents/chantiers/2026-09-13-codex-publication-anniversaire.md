# Publication cadeaux et anniversaire — 13 septembre 2026

TERMINÉ — Yoann demande « publie » après les nouveaux libellés et le cadeau anniversaire.

Source client préparée : 7cab231 ; aucun changement natif, runtime 1.0.3.
Destination : EAS, projet 10b00fe2-73e1-408c-a36a-23d1a079bb05,
canaux preview puis production, iOS et Android, environnement production.
La publication Git met aussi à jour le règlement public.

## Précontrôle

La production serveur reste marketing-auto v19 / tpv-api v32 : colonne
quantite_payee et RPC mon_cadeau_anniversaire absentes. La règle des cinq achats
ne peut pas être activée honnêtement avant la projection des caisses compatible.
Usage relu dans Chrome : 644 999 appels sur 30 jours, puis rafraîchissement à
645 584. Le lot anniversaire ne crée aucun appel Edge périodique (cron existant,
30 appels par mois ; delta zéro). L’exception cloud est demandée explicitement,
conformément à AGENTS.md, et ne vaut pas accord tant que la réponse manque.
Aucune migration ni fonction serveur déployée pour ce lot à ce stade.

La recette native reste à effectuer ; les tests automatiques et le rendu web
sont distincts de la réception d’une notification réelle et de la recette POS.

## Accord reçu

Yoann répond « oui vas y » à la demande d’exception cloud pour ce lot.
Le plafond reste inchangé pour les autres évolutions ; aucun forfait modifié.

## Publication réalisée

Paquet combiné avec le compteur Google déjà publié : source bb6898f3e598034003d781303c6025a3e9ae0023.
Preview f6ce6d74-9bbc-4ccd-a306-d9398e8b4ae4 ; production
9762b8d6-4d3f-4dfc-b38f-06761abf569e, iOS et Android, runtime 1.0.3.
Les deux bundles Hermes et les 55 assets par plateforme sont identiques entre
le gel local, preview et production. La première preview e2a7e296 a été remplacée
avant toute promotion pour préserver le compteur Google concurrent.

Migrations anniversaire appliquées ; tpv-api v33 et marketing-auto v20 actifs,
sources distantes identiques au lot. POS 0.31.112 publié sur l’auto-update standard,
EXE et feed retéléchargés publiquement et identiques au gel. Cron quotidien
existant conservé, aucun appel périodique supplémentaire, aucun abonnement changé.
Les quantités fiables commencent après installation .112 : ancien historique
ambigu exclu. Aucun crédit réel ou push de test déclenché pendant la recette.
Les autorisations HTTP/SQL, tests client complets et SQL isolé passent.
Installation sur caisses, réception push réelle et recette native restent à constater.

Retour applicatif identifié avant publication : groupe 73e80ca0-62d5-4a9a-9e9f-a9e71347392b.
Ne pas revenir au crédit anniversaire serveur sans condition en cas de souci UI.
La lecture de publication ne prouve pas que chaque téléphone l’a chargée.
Fermer complètement et rouvrir l’app ; une seconde fermeture/réouverture peut
être nécessaire au téléchargement automatique.

Commande de vérification :
`cd /Users/yoannderoo/Desktop/bubblestop-client && npx eas-cli@latest update:list --branch production --limit 1 --non-interactive`.

Règlement public relu après push Git : nouvelle formulation présente à
https://commande.bubblestop.fr/reglement-roue-du-mois et sur son chemin .html.
Preuve : audit/2026-09-13-anniversaire/publication-reglement.json.
