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
    const { destinationAvisGoogle, lireDestinationAvisGoogle } = require(path.join(sortie, 'avis-google.js'));
    const attendus = { aix: 'ChIJRZe6J72NyRIROG8EKm4FZhI', lyon: 'ChIJif8QNwnr9EcRyMFB4tdVdJo', toulouse: 'ChIJXWQyZRS9rhIRqiyfNgCvnpw' };
    for (const [magasin, placeId] of Object.entries(attendus)) {
      const cible = destinationAvisGoogle({ dernier_magasin_scan: ` ${magasin.toUpperCase()} `, magasin: 'autre' });
      assert.equal(cible.magasin, magasin);
      assert.equal(cible.url, `https://search.google.com/local/writereview?placeid=${placeId}`);
    }
    for (const profil of [null, {}, { magasin: 'lyon' }, { dernier_magasin_scan: '' },
      { dernier_magasin_scan: 'nimes' }, { dernier_magasin_scan: 'inconnu', magasin: 'aix' }]) {
      assert.equal(destinationAvisGoogle(profil), null, 'aucune boutique devinée');
    }
    let magasin = 'lyon';
    let lectures = 0;
    const deps = { lireCompte: async () => 'compte-fictif', lireProfil: async (id) => {
      assert.equal(id, 'compte-fictif'); lectures++; return { dernier_magasin_scan: magasin };
    } };
    assert.equal((await lireDestinationAvisGoogle(deps)).magasin, 'lyon');
    magasin = 'aix';
    assert.equal((await lireDestinationAvisGoogle(deps)).magasin, 'aix', 'nouveau scan relu au clic');
    assert.equal(lectures, 2, 'une seule lecture de profil par action');
    await assert.rejects(lireDestinationAvisGoogle({ ...deps, lireCompte: async () => null }), /Connecte-toi/);
    assert.equal(lectures, 2, 'pas de requête profil sans compte');
    let sessions = 0;
    await assert.rejects(lireDestinationAvisGoogle({ ...deps, lireCompte: async () => ++sessions === 1 ? 'compte-fictif' : 'autre-compte-fictif' }), /compte a changé/);
    await assert.rejects(lireDestinationAvisGoogle({ ...deps, lireProfil: async () => null }), /Scanne ta carte/);
    await assert.rejects(lireDestinationAvisGoogle({ ...deps, lireProfil: async () => { throw Error('réseau fictif'); } }), /réseau fictif/);
    console.log('Avis Google : trois boutiques, dernier scan frais, compte changé et replis validés');
  } finally { fs.rmSync(sortie, { recursive: true, force: true }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
