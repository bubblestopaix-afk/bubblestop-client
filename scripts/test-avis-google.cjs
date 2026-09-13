const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const racine = path.resolve(__dirname, '..');
const sortie = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-client-tests-'));
(async () => {
  try {
    execFileSync(path.join(racine, 'node_modules/.bin/tsc'), ['--outDir', sortie,
      '--module', 'commonjs', '--moduleResolution', 'node', '--target', 'es2020', '--skipLibCheck',
      path.join(racine, 'src/lib/avis-google.ts')], { cwd: racine, stdio: 'pipe' });
    const { BOUTIQUES_AVIS_GOOGLE, destinationAvisGoogle } = require(path.join(sortie, 'avis-google.js'));
    const attendus = { aix: 'ChIJRZe6J72NyRIROG8EKm4FZhI', lyon: 'ChIJif8QNwnr9EcRyMFB4tdVdJo', toulouse: 'ChIJXWQyZRS9rhIRqiyfNgCvnpw' };
    assert.deepEqual(BOUTIQUES_AVIS_GOOGLE.map(b => b.magasin), Object.keys(attendus));
    for (const [magasin, placeId] of Object.entries(attendus)) {
      const cible = destinationAvisGoogle(` ${magasin.toUpperCase()} `);
      assert.equal(cible.magasin, magasin);
      assert.equal(cible.url, `https://search.google.com/local/writereview?placeid=${placeId}`);
    }
    for (const choix of [null, undefined, '', {}, 'nimes', 'constructor', 'toString', 'inconnu', { dernier_magasin_scan: 'lyon' }]) {
      assert.equal(destinationAvisGoogle(choix), null, 'pas de destination sans choix valide');
    }
    const liens = ['lyon', 'aix', 'toulouse', 'lyon'].map(choix => destinationAvisGoogle(choix).url);
    assert.equal(new Set(liens).size, 3, 'les trois boutiques restent accessibles successivement');
    assert.equal(liens[0], liens[3], 'revenir sur une boutique ne la verrouille pas');
    console.log('Avis Google : choix explicite des trois boutiques et absence de destination implicite validés');
  } finally { fs.rmSync(sortie, { recursive: true, force: true }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
