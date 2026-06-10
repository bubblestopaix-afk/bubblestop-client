# Bubblestop — appli client (démarrage)

## 1. Installer et lancer (Mac)

```bash
cd "/Users/yoannderoo/APP CLIENT/bubblestop-client"
npm install
npx expo start
```

## 2. Tester sur ton iPhone (tout de suite)

1. Installe **Expo Go** depuis l'App Store.
2. Scanne le QR affiché dans le terminal avec l'appareil photo de l'iPhone.
3. L'appli s'ouvre en live — chaque modification de code se recharge instantanément.

## 3. Tester côté Android (sans téléphone Android)

1. Installe **Android Studio** (gratuit) → More Actions → Virtual Device Manager → crée un appareil avec une image **Google Play** (ex. Pixel 8, API 35).
2. Démarre l'émulateur, puis dans le terminal Expo appuie sur **`a`** → l'appli s'installe dans l'émulateur.
3. Les notifications push fonctionnent dans cet émulateur (image Google Play obligatoire).

## 4. Ce qu'il y a déjà

- Onglet **Accueil** : branding + ce qui arrive
- Onglet **Fidélité** : saisie du numéro (mémorisé), affichage du **QR scannable en caisse** (le même format que le QR du POS : le numéro à 10 chiffres)

## 5. Prochaines étapes prévues

1. Compte **Google Play Console en organisation** (25 $ une fois, SIRET → pas de contrainte des 12 testeurs)
2. Notifications push (`expo-notifications` + un petit backend Supabase/Firebase)
3. Carte des boissons (réutilise le catalogue du POS)
4. Commande en avance, puis paiement Stripe
5. Build de publication : `npx eas build --platform android`
