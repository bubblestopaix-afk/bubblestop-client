# Publication cadeaux et anniversaire — 13 septembre 2026

EN COURS — Yoann demande « publie » après les nouveaux libellés et le cadeau anniversaire.

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
