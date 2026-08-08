# Instructions scripts et tests

Ces règles s'ajoutent à `../AGENTS.md` pour `scripts/`.

- `test-jeu.cjs` couvre Boba Tower, Roue du Mois et Boba Quest. Conserver les trois
  lignes finales de succès et ajouter tout nouveau bloc avant la dernière ligne.
- Les moteurs TypeScript testés depuis CommonJS sont compilés dans un dossier
  temporaire propre ; ne pas écrire de sortie générée dans `src/`.
- Une correction de moteur doit avoir un test qui échoue réellement sur l'ancien
  comportement, pas seulement une assertion décorative.
- `test-menu-vitrine.cjs` protège les familles et saveurs du menu public.
- `test-agents-contexte.cjs` protège l'architecture de contexte et l'archive ; ne
  pas assouplir ses limites pour faire passer une nouvelle accumulation.
- La validation complète compacte est `npm run test:quiet`. En cas d'échec,
  relancer uniquement le script concerné avec sa sortie détaillée.
