const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const racine = path.join(__dirname, '..');
const chemin = (fichier) => path.join(racine, fichier);
const lire = (fichier) => fs.readFileSync(chemin(fichier), 'utf8');
const archive = 'docs/agents/archive/AGENTS-2026-08-08-avant-optimisation.md';
const contextes = [
  'src/AGENTS.md',
  'docs/agents/contextes/jeux.md',
  'docs/agents/contextes/public.md',
  'docs/agents/contextes/release.md',
  'scripts/AGENTS.md',
  'supabase/AGENTS.md',
];

const instructions = lire('AGENTS.md');
assert.ok(fs.statSync(chemin('AGENTS.md')).size <= 12 * 1024, 'AGENTS.md doit rester sous 12 Kio');

for (const contexte of contextes) {
  assert.ok(fs.existsSync(chemin(contexte)), `${contexte} doit exister`);
  assert.ok(instructions.includes(contexte), `${contexte} doit être routé depuis la racine`);
  assert.ok(fs.statSync(chemin(contexte)).size <= 6 * 1024, `${contexte} doit rester sous 6 Kio`);
}

assert.match(instructions, /Production contient de vrais clients/i);
assert.match(instructions, /npx supabase db push[^\n]*depuis ce dépôt/i);
assert.match(instructions, /git add -A[^\n]*interdits/i);
assert.match(instructions, /profils\.telephone/);
assert.match(instructions, /PASSEPORT_ACTIF[^\n]*false/);

const archiveBrute = fs.readFileSync(chemin(archive));
const empreinte = crypto.createHash('sha256').update(archiveBrute).digest('hex');
assert.equal(empreinte, '0f0a9e98577b51b3dae73d79dd03fc27c30e9ef082261bd08f88c5f9a1c4d0b0');
assert.ok(archiveBrute.length > 400_000, "l'archive intégrale ne doit pas être résumée");
assert.match(lire('.graphifyignore'), /^docs\/agents\/archive\/$/m);

const pkg = JSON.parse(lire('package.json'));
assert.ok(pkg.scripts['test:quiet'].includes('test:agents'));
assert.ok(pkg.scripts['test:quiet'].includes('test:jeu:quiet'));
assert.ok(pkg.scripts['test:jeu:quiet'].includes('--no-warnings'));
assert.ok(pkg.scripts['test:quiet'].includes('tsc --noEmit --pretty false'));

console.log('Contexte IA client : tailles, routage et archive OK');
