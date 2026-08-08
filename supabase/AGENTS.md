# Instructions Supabase du client

Ces règles s'ajoutent à `../AGENTS.md` pour `supabase/` et tout changement de
contrat serveur impliquant l'application.

- Projet de production : `zpnoopitysojsvuqnbuo`.
- `schema.sql` et `schema-v2.sql` sont des instantanés historiques. Ils ne prouvent
  ni le schéma live ni l'ordre des migrations.
- Les migrations et Edge Functions maintenues vivent dans le dépôt
  `../bubble-tea-pos`. Écrire et appliquer le changement depuis ce dépôt après
  lecture de ses propres instructions.
- **Ne jamais lancer `npx supabase db push`** depuis l'application client.
- Le client n'embarque que la clé anonyme publique. Aucun secret, `service_role`,
  certificat ou jeton utilisateur dans le code, les logs ou les preuves.
- Respecter RLS et vérifier côté serveur toute récompense, mutation sensible et
  droit d'accès. Une garde UI ne remplace pas une policy ou un endpoint autoritaire.
- Pour une lecture live, utiliser le skill Supabase et comparer la définition
  distante au contrat consommé par `src/` avant de modifier ce dernier.
- Déployer le serveur compatible avant le client, puis vérifier le chemin métier et
  le repli d'une ancienne version.
