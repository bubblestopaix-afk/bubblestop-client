# Roue sécurisée et inscriptions — Codex, 04/10/2026

Statut : SOURCES VALIDÉES — publication en attente de la garde cloud et de la recette native.

Autorisation Yoann : « ok fais 1 et 2 » après audit production. Tirage serveur préparé dans b8b03cb activé côté Supabase (dépôt POS), nouveaux tours réservés aux comptes inscrits depuis 7 jours révolus et scannés en boutique. Aucun achat requis. Anciens gains conservés ; aucun autre jeu ou mécanisme fidélité modifié.

Périmètre client : src/app/roue.tsx, src/lib/roue-serveur.ts, scripts/test-roue-serveur.cjs, public/reglement-roue-du-mois.html. Le pont recompenses-jeu et le tirage serveur de b8b03cb sont déjà préparés. Runtime 1.0.3 inchangé, aucune dépendance native. Le règlement public doit être publié après activation réelle des règles serveur.

Garde cloud : aucune nouvelle boucle, lecture explicite au focus / actualisation et un appel par lancer. Usage 30 jours à vérifier avant publication. Production native : dernier groupe réel 9762b8d6-4d3f-4dfc-b38f-06761abf569e, runtime 1.0.3 (13/09), repli identifié ; ne jamais repasser à ce groupe seul après activation du serveur sécurisé car son ancien tirage local serait refusé.

Validation locale : npm run test:quiet et TypeScript réussis ; export web vérifié par dix scénarios fictifs mobile 390×844 / bureau 1280×900 (conditions, scan, actualisation, double appui, animation, reprise après perte de réponse, panne). Zéro erreur JavaScript ; aucune requête de récompense réelle. Graphify mis à jour (1 820 nœuds / 4 290 liens), 14 fichiers non-code sans nœuds non utilisés comme preuve.

Publication attend la garde Usage Supabase, la coordination migration → Edge → clients et la recette OTA preview native. Aucun push / OTA / serveur de ce lot effectué. Le fichier local non suivi de Yoann reste intact.

Exports Hermes iOS et Android et export web réussis : /tmp/codex-roue-inscriptions-ota-20261004, runtime 1.0.3 inchangé. Source f93d547, plus SEC-02 b8b03cb déjà local ; aucun push. Les bundlings ne valent pas recette sur téléphone.
