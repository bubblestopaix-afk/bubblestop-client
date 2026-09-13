# Taille des cadeaux — Codex, 13 septembre 2026

Statut : TERMINÉ — source non publiée.

Demande : remplacer la mention « M pour Signature » par la plus grande taille
disponible de la catégorie. Source nommée par Yoann : Menu-portrait-A1.pdf,
PDF A IMPRIMER/PRINTOCLOCK-2026-08-04, consulté visuellement, PDF inchangé.

Constat : Fruit Tea, Citronnade, Thés du monde, Milk Tea/Matcha, Café Latté,
Milkshake : jusqu’au L. Mousse, Mango Punch, Crème Brûlée, Tiger Sugar : M seul.

Périmètre : textes anniversaire/Fidélité/inscription/naissance, résultat et
condition Roue, libellés de lots de jeux et règlement de la Roue ; notification
anniversaire préparée côté serveur. Identifiants de lots, probabilités, tailles
du catalogue et calculs de récompense inchangés. Aucun déploiement/OTA.

Validation : suite client `npm run test:quiet` réussie (jeux, menu, offres, avis,
anniversaire, TypeScript), export Expo web, deux tests notification serveur,
diff sans erreur. Rendu vérifié à 320 px sur des données fictives. Aucun PDF
modifié, aucun envoi push ou changement des probabilités/montants.

Commandes :
- `cd /Users/yoannderoo/Desktop/bubblestop-client-audit-20260913 && npm run test:quiet`
- `cd /Users/yoannderoo/Desktop/bubble-tea-pos-anniversaire-20260913 && node --test test/anniversaire-notifications.test.js`

Les anciens identifiants internes contenant « signature » ou « boisson_l » sont
conservés pour préserver les cartes, récompenses et routes existantes. La vitrine
du menu conserve son regroupement historique ; ce lot corrige les textes cadeaux.
