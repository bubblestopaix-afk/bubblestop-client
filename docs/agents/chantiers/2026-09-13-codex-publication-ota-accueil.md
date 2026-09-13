# Publication OTA accueil — 13 septembre 2026

EN COURS. Yoann autorise explicitement la publication après information que les
changements sont locaux et la recette native reste à faire.

Source produit : c9cacad, base de la dernière OTA : ba5bd07 (groupe production
969af8d1-d696-461b-b080-110e9f885d53), suivi documentaire f0f57e7.
Projet EAS : 10b00fe2-73e1-408c-a36a-23d1a079bb05 ; runtime 1.0.3 ;
plateformes iOS et Android ; environnement production ; canal production.

Périmètre : roue visible en tête, libellé Boisson L offerte (M pour Signatures),
Promotion du jour, avis Google avec choix des trois boutiques sans récompense.
Diff complet relu, dépendances et configuration native inchangées. Les tests
complets, TypeScript strict et export web ont réussi sur cette source.
Aucune modification des flags live. Aucun push Git ni nouveau build store.

Diffusion : paquet d'abord sur preview, puis republication identique vers production.
Aucun simulateur avec Bubble Stop ou Expo Go installé n'est disponible ; un build
preview iOS 1.0.3 existe sur EAS mais il cible un appareil physique. La recette
native (connexions, navigation, fidélité, Google) reste non effectuée ; ne pas
confondre les contrôles du paquet et le test matériel.
