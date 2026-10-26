const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Audit de sécurité du 27/10/2026 (Yoann : « corrige le reste »).
// 1. Le jeton de session ne passe plus dans l'URL du Wallet (code de 2 minutes).
// 2. Le bouton de mise à jour n'ouvre que les stores officiels.
const racine = path.resolve(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(racine, f), 'utf8');

try {
  const explore = lire('src/app/explore.tsx');
  assert.match(explore, /supabase\.functions\.invoke\('wallet-pass\?action=code', \{ method: 'POST' \}\)/);
  assert.match(explore, /wallet-pass\?platform=\$\{plateforme\}&code=\$\{encodeURIComponent\(code\)\}/);
  assert.doesNotMatch(explore, /wallet-pass\?[^`]*token=/);
  assert.doesNotMatch(explore, /access_token/);

  // mise-a-jour.ts dépend de modules natifs (expo-constants, react-native) : la règle est
  // extraite du source et exécutée telle quelle, et son emploi pour les deux stores est vérifié.
  const source = lire('src/lib/mise-a-jour.ts');
  const ligne = /const URL_STORE_OFFICIEL = (\/.+\/);/.exec(source);
  assert.ok(ligne, 'règle des stores officiels absente');
  const regle = eval(ligne[1]);
  for (const ok of ['https://apps.apple.com/fr/app/bubble-stop/id1', 'https://play.google.com/store/apps/details?id=fr.bubblestop']) {
    assert.equal(regle.test(ok), true, ok);
  }
  for (const piege of ['https://apps.apple.com.pirate.example/x', 'https://pirate.example/apps.apple.com/', 'http://apps.apple.com/x', 'https://play.google.com.evil.fr/']) {
    assert.equal(regle.test(piege), false, piege);
  }
  assert.match(source, /typeof v\.ios_url === 'string' && URL_STORE_OFFICIEL\.test\(v\.ios_url\)/);
  assert.match(source, /typeof v\.android_url === 'string' && URL_STORE_OFFICIEL\.test\(v\.android_url\)/);
  console.log('✓ Sécurité : Wallet sans jeton de session dans l’URL, mise à jour limitée aux stores officiels');
} catch (e) {
  console.error(e);
  process.exitCode = 1;
}
