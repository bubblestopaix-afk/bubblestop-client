const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const racine = path.resolve(__dirname, '..');
const sortie = fs.mkdtempSync(path.join(os.tmpdir(), 'offres-client-tests-'));

try {
  execFileSync(path.join(racine, 'node_modules', '.bin', 'tsc'), [
    '--outDir', sortie,
    '--rootDir', path.join(racine, 'src/lib'),
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--target', 'es2020',
    '--skipLibCheck',
    path.join(racine, 'src/lib/offres.ts'),
  ], { cwd: racine, stdio: 'pipe' });

  const { magasinOffresDepuisProfil, offreVisiblePour } = require(path.join(sortie, 'offres.js'));
  const nationale = { magasins: ['aix', 'lyon', 'toulouse'] };
  const lyon = { magasins: ['lyon'] };

  assert.equal(magasinOffresDepuisProfil({ magasin: 'lyon' }), null,
    'la boutique historique ne doit pas cibler les offres flash');
  assert.equal(magasinOffresDepuisProfil({ dernier_magasin_scan: ' LYON ' }), 'lyon');
  assert.equal(magasinOffresDepuisProfil({ dernier_magasin_scan: 'paris' }), null);
  assert.equal(offreVisiblePour(nationale, null), true, 'une offre nationale reste visible avant tout scan');
  assert.equal(offreVisiblePour(lyon, null), false, 'une offre locale échoue fermée avant le premier scan');
  assert.equal(offreVisiblePour(lyon, 'lyon'), true);
  assert.equal(offreVisiblePour(lyon, 'aix'), false);

  const compte = fs.readFileSync(path.join(racine, 'src/app/compte.tsx'), 'utf8');
  assert.match(compte, /const \[offreMagasins, setOffreMagasins\]/);
  assert.match(compte, /magasins: offreMagasins/);
  assert.match(compte, /basculerMagasinOffre/);
  assert.match(compte, /Les notifications suivent le dernier QR scanné/);
  assert.doesNotMatch(compte, /Notification envoyée à tous au début de chaque créneau/);

  console.log('Offres client : ciblage par dernier scan QR validé');
} finally {
  fs.rmSync(sortie, { recursive: true, force: true });
}
