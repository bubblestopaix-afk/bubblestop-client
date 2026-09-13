# Avis Google : choix libre de boutique

TERMINÉ — demande de Yoann du 13 septembre 2026 après la recette accueil.
Périmètre : carte-avis-google.tsx, avis-google.ts, test-avis-google.cjs,
fixture de prévisualisation et rapport d'audit. Remplacer le rattachement automatique
par le choix explicite Aix/Lyon/Toulouse ; chaque fiche reste accessible, sans quota
local d'avis ni promesse de récompense. Aucun appel de profil nécessaire.
Vérifier les flags de jeux en lecture seule, sans modifier l'activation live.

Lecture live le 13/09 : `jeu` actif=false, selection=false, admin=false ;
`boba_tower` absent (client désactivé, admin visible par défaut selon le code) ;
`roue_du_mois` actif=true, admin=true. Aucun flag modifié.
L’ancien aperçu forçait les jeux pour audit ; il les masque maintenant par défaut.
Paramètre `jeux-demo` uniquement pour la recette fictive.

Validation : `npm run test:quiet` et export Expo web réussis, contrôle visuel
à 390 et 320 pixels, trois liens distincts et changement de sélection validés.
Aucun avis transmis, aucun flag modifié, aucune publication. Ouverture Google
sur appareil natif non testée. Commande :
`cd /Users/yoannderoo/Desktop/bubblestop-client-audit-20260913 && npm run test:quiet`.
