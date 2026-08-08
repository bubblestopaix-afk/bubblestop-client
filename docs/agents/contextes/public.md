# Contexte des pages publiques

À lire pour tout changement sous `public/`.

- `public/` est publié automatiquement sur Cloudflare Pages lors du push Git.
- Ne jamais y placer un fichier d'instructions interne, un secret ou une preuve
  contenant des données privées : tout fichier peut devenir accessible sur le web.
- Préserver le lien unique `/app` vers les stores et les redirections existantes.
- La confidentialité doit rester cohérente avec les données réellement traitées :
  compte, fidélité, achats liés au compte, notifications et sauvegardes de jeux.
- Chaque jeu avec des récompenses réelles conserve son règlement propre. Ne pas
  fusionner les textes Boba Quest, Boba Tower et Roue sans décision juridique.
- Un règlement ou une politique publié est une preuve visible : ne pas annoncer un
  comportement serveur, une durée ou une récompense qui n'est pas en production.
- Vérifier liens, titre, encodage, rendu mobile et absence de données privées après
  toute modification HTML.
