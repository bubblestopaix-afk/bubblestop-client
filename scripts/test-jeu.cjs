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
    path.join(racine, 'src/components/jeu/sauvegarde-jeu.ts'),
  ], { cwd: racine, stdio: 'pipe' });

  const shooter = require(path.join(sortie, 'moteur-shooter.js'));
  const arene = require(path.join(sortie, 'arene.js'));
  const economie = require(path.join(sortie, 'economie.js'));
  const sauvegarde = require(path.join(sortie, 'sauvegarde-jeu.js'));

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

  // Un soin actif est borné à 25 % des PV max et ne cumule pas la régénération
  // passive de la panoplie Sucré pendant la même action.
  const soinDirect = arene.creerCombat(
    ['nuage'], ['boba'], 1,
    { nuage: ['paille-caramel', 'couvercle-nappe', 'sablier'] },
  );
  soinDirect.equipes.a[0].pv = 1;
  const evtsSoin = arene.jouerRound(soinDirect, 1, () => 0.3, 0);
  const soinsDirects = evtsSoin.filter((e) => e.t === 'soin' && e.cote === 'a');
  assert.equal(soinsDirects.length, 1, 'un soin actif ne doit pas déclencher une régénération bonus');
  assert.ok(
    soinsDirects[0].valeur <= Math.round(soinDirect.equipes.a[0].pvMax * arene.SOIN_DIRECT_MAX_PV_PCT / 100),
    'soin direct supérieur au plafond',
  );

  // Le vol de vie d'une zone est consolidé en un seul soin et plafonné à 12 %
  // des PV max, même si les trois cibles sont touchées.
  const volZone = arene.creerCombat(
    ['popping'], ['fraisy', 'fraisy', 'fraisy'], 1,
    { popping: ['paille-caramel'] },
  );
  volZone.equipes.a[0].pv = 1;
  const evtsVol = arene.jouerRound(volZone, 1, () => 0.3, 0);
  const soinsVol = evtsVol.filter((e) => e.t === 'soin' && e.cote === 'a');
  assert.equal(soinsVol.length, 1, 'le vol de vie de zone doit être consolidé');
  assert.ok(
    soinsVol[0].valeur <= Math.round(volZone.equipes.a[0].pvMax * arene.VOL_DE_VIE_MAX_PV_PCT_ACTION / 100),
    'vol de vie supérieur au plafond par action',
  );

  // La régénération passive reste bornée à 10 PV même quand passif et panoplie
  // Royale s'additionnent au-delà de cette valeur.
  const regen = arene.creerCombat(
    ['mochito'], ['boba'], 1,
    { mochito: ['paille-royale', 'couvercle-royal', 'grigri'] },
  );
  regen.equipes.a[0].pv = 1;
  const evtsRegen = arene.jouerRound(regen, 0, () => 0.3, 0);
  const soinsRegen = evtsRegen.filter((e) => e.t === 'soin' && e.cote === 'a');
  assert.equal(soinsRegen.length, 1, 'la régénération passive doit être consolidée');
  assert.ok(soinsRegen[0].valeur <= arene.REGEN_MAX_PAR_ACTION, 'régénération passive supérieure au plafond');

  // La Signature Milk rend désormais 20 % des PV max et ne déclenche pas une
  // seconde régénération passive sur la même action.
  const signatureSoin = arene.creerCombat(
    ['classico'], ['boba'], 1,
    { classico: ['paille-royale', 'couvercle-royal', 'grigri'] },
  );
  signatureSoin.equipes.a[0].pv = 1;
  signatureSoin.equipes.a[0].charge = arene.CHARGE_MAX;
  const evtsSignature = arene.jouerRound(signatureSoin, 'signature', () => 0.3, 0);
  const soinsSignature = evtsSignature.filter((e) => e.t === 'soin' && e.cote === 'a');
  assert.equal(soinsSignature.length, 1, 'la Signature Milk ne doit pas doubler son soin');
  assert.ok(
    soinsSignature[0].valeur <= Math.round(signatureSoin.equipes.a[0].pvMax * 0.2),
    'soin de la Signature Milk supérieur à 20 %',
  );

  // Économie capsules : poids cohérents et garanties anti-malchance réellement
  // respectées par la fonction de tirage minimale.
  for (const conf of Object.values(economie.CAPSULES)) {
    assert.equal(Object.values(conf.poids).reduce((s, n) => s + n, 0), 100, 'poids de capsule incohérents');
  }
  const garantiEpique = economie.tirerCapsuleMin('classique', 'epique', () => 0);
  assert.equal(garantiEpique.rarete, 'epique', 'le pity épique forcé ne doit pas devenir une légendaire artificielle');
  assert.equal(economie.CAPSULES.classique.cout, 600);
  assert.equal(economie.CAPSULES.doree.cout, 1800);
  assert.equal(economie.capsulePremiereVictoireNiveau(1, false), 'classique');
  assert.equal(economie.capsulePremiereVictoireNiveau(4, false), 'classique');
  assert.equal(economie.capsulePremiereVictoireNiveau(5, true), 'doree');
  assert.equal(economie.capsulePremiereVictoireNiveau(7, false), null);
  assert.equal(economie.capsulePremiereVictoireNiveau(8, false), 'classique');

  const nouveauProtege = economie.protegerNouveauCollectible(
    economie.trouverCollectible('boba'), { boba: 1 }, 'classique', null, () => 0,
  );
  assert.equal(nouveauProtege.id, 'classico', 'les trois premiers tirages doivent pouvoir éviter un doublon');

  const trocMemeRarete = economie.trocDuJour(
    '2026-07-12', ['boba'], ['taro-queen', 'classico'],
  );
  assert.deepEqual(trocMemeRarete, { veut: 'boba', offre: 'classico' }, 'le troc doit rester dans la même rareté');
  assert.equal(economie.trocDuJour('2026-07-12', ['boba'], ['taro-queen']), null, 'un commun ne doit pas acheter une légendaire');
  assert.equal(Object.keys(economie.MISSIONS_CARTES).length, economie.COLLECTIBLES.length, 'une mission est requise pour chaque carte');
  assert.equal(economie.rangMaitrise(1), 'bronze');
  assert.equal(economie.rangMaitrise(2), 'argent');
  assert.equal(economie.rangMaitrise(3), 'or');
  assert.equal(economie.rangMaitrise(5), 'holo');
  assert.equal(
    economie.carteVedetteSemaine('2026-S28').id,
    economie.carteVedetteSemaine('2026-S28').id,
    'la vedette hebdomadaire doit être déterministe',
  );
  assert.equal(new Set(economie.BOUTIQUE.map((p) => p.id)).size, economie.BOUTIQUE.length, 'ids boutique dupliqués');
  assert.ok(economie.BOUTIQUE.every((p) => p.parMois >= 1), 'plafond mensuel boutique invalide');

  // Migration v1 → v3 : les joueurs existants ayant déjà une collection ne
  // revoient pas l'onboarding, tandis qu'une vraie sauvegarde vierge le conserve.
  assert.equal(sauvegarde.VERSION_SAUVEGARDE, 3);
  assert.equal(sauvegarde.onboardingTermineApresMigration({ capsulesOuvertes: 0, collection: {} }), false);
  assert.equal(sauvegarde.onboardingTermineApresMigration({ capsulesOuvertes: 1, collection: {} }), true);
  assert.equal(sauvegarde.onboardingTermineApresMigration({ collection: { boba: 1 } }), true);
  assert.equal(sauvegarde.onboardingTermineApresMigration({ onboardingTermine: false, capsulesOuvertes: 8 }), false);
  assert.deepEqual(sauvegarde.missionsCartesApresMigration(null), {});
  assert.deepEqual(
    sauvegarde.missionsCartesApresMigration({ boba: { progres: 2.9, reclamee: true }, invalide: 'x' }),
    { boba: { progres: 2, reclamee: true } },
  );
  assert.deepEqual(sauvegarde.prestigeApresMigration({ boba: true, theo: false }), { boba: true });

  console.log('Boba Quest : tests moteurs OK');
} finally {
  fs.rmSync(sortie, { recursive: true, force: true });
}
