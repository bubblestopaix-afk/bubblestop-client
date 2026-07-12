const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const racine = path.resolve(__dirname, '..');
const sortie = fs.mkdtempSync(path.join(os.tmpdir(), 'boba-quest-tests-'));

try {
  execFileSync(path.join(racine, 'node_modules', '.bin', 'tsc'), [
    '--ignoreConfig',
    '--ignoreDeprecations', '6.0',
    '--outDir', sortie,
    '--rootDir', path.join(racine, 'src/components/jeu'),
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--target', 'es2020',
    '--esModuleInterop',
    '--skipLibCheck',
    path.join(racine, 'src/components/jeu/economie.ts'),
    path.join(racine, 'src/components/jeu/arene.ts'),
    path.join(racine, 'src/components/jeu/moteur-shooter.ts'),
  ], { cwd: racine, stdio: 'pipe' });

  const shooter = require(path.join(sortie, 'moteur-shooter.js'));
  const arene = require(path.join(sortie, 'arene.js'));
  const economie = require(path.join(sortie, 'economie.js'));

  // Les 12 premiers niveaux ont bien 12 silhouettes distinctes et jouables.
  const silhouettes = new Set();
  for (let n = 1; n <= 12; n++) {
    const etat = shooter.creerNiveau(n);
    assert.ok(etat.grille[0].cases.some(Boolean), `niveau ${n}: plafond vide`);
    assert.equal(shooter.orphelines(etat.grille).length, 0, `niveau ${n}: grappe isolée au départ`);
    assert.equal(etat.fever, 0);
    assert.equal(etat.bossPhase, 1);
    silhouettes.add(etat.grille.map((l) => l.cases.map((b) => b ? '#' : '.').join('')).join('/'));
  }
  assert.equal(silhouettes.size, 12, 'les 12 plateaux doivent être distincts');

  // L'aperçu doit rester une simulation pure et ne jamais consommer le vrai tour.
  const apercuEtat = shooter.creerNiveau(7);
  const avantApercu = JSON.stringify(apercuEtat);
  const origine = { x: shooter.LARGEUR_TERRAIN / 2, y: shooter.LIGNE_LIMITE * shooter.LIGNE_H + 1.6 };
  shooter.previsualiserTir(apercuEtat, origine, -Math.PI / 2);
  assert.equal(JSON.stringify(apercuEtat), avantApercu, 'aperçu mutateur');

  // Un boss annonce puis exécute bien son attaque au troisième tir non interrompu.
  const bossShooter = shooter.creerNiveau(5);
  let attaqueBoss = null;
  for (let i = 0; i < 3; i++) {
    attaqueBoss = shooter.tirer(bossShooter, origine, -Math.PI / 2, () => 0.71).bossAction ?? attaqueBoss;
  }
  assert.ok(attaqueBoss, 'attaque du boss shooter non déclenchée');

  // Chaque famille de compagnon donne le pouvoir Fever annoncé, sans stock acheté.
  for (const [pouvoir, special] of [['topping', 'bombe'], ['signature', 'arc']]) {
    const etat = shooter.creerPartieInfini(() => 0.2);
    etat.fever = shooter.FEVER_MAX;
    const resultat = shooter.activerFever(etat, pouvoir);
    assert.equal(resultat.active, true);
    assert.equal(resultat.special, special);
    assert.equal(etat.fever, 0);
  }
  const fruit = shooter.creerPartieInfini(() => 0.2);
  fruit.fever = shooter.FEVER_MAX;
  shooter.activerFever(fruit, 'fruit');
  assert.equal(fruit.couleurCourante, fruit.couleurSuivante);

  // La Garde réduit réellement l'impact et l'intention montrée correspond au coup joué.
  const normal = arene.creerCombat(['boba'], ['fraisy']);
  const garde = arene.creerCombat(['boba'], ['fraisy']);
  const intentionAvant = arene.decrireIntention(normal).titre;
  const evtsNormaux = arene.jouerRound(normal, 0, () => 0.3);
  arene.jouerRound(garde, 'garde', () => 0.3);
  assert.ok(garde.equipes.a[0].pv > normal.equipes.a[0].pv, 'la Garde ne réduit pas les dégâts');
  assert.ok(evtsNormaux.some((e) => e.t === 'annonce' && e.cote === 'b' && e.texte.includes(intentionAvant)), 'intention différente du coup joué');

  // Les trois familles offensives posent leurs marques via leur attaque Spé.
  const collant = arene.creerCombat(['fraisy'], ['boba']);
  arene.jouerRound(collant, 1, () => 0.3, 0);
  assert.ok(collant.equipes.b[0].collantTours > 0, 'marque Collant absente');

  const givre = arene.creerCombat(['theo'], ['popping']);
  arene.jouerRound(givre, 1, () => 0.3, 0);
  assert.equal(givre.equipes.b[0].givre, true, 'marque Givré absente');

  const petillant = arene.creerCombat(['popping'], ['fraisy']);
  arene.jouerRound(petillant, 1, () => 0.3, 0);
  assert.equal(petillant.equipes.b[0].petillant, true, 'marque Pétillant absente');

  // Un boss franchissant 70 % passe bien en phase 2 et prépare sa phase finale.
  const bossDef = economie.bossDeLaSemaine('2026-S28');
  const boss = arene.creerCombatBoss(['bubble-master'], bossDef);
  boss.equipes.b[0].pv = Math.floor(boss.equipes.b[0].pvMax * 0.69);
  arene.jouerRound(boss, 0, () => 0.3, 0);
  assert.ok(boss.equipes.b[0].bossPhase >= 2, 'phase 2 du boss non déclenchée');

  console.log('Boba Quest : tests moteurs OK');
} finally {
  fs.rmSync(sortie, { recursive: true, force: true });
}
