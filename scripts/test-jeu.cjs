const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const racine = path.resolve(__dirname, '..');
const sortie = fs.mkdtempSync(path.join(os.tmpdir(), 'boba-quest-tests-'));

try {
  execFileSync(path.join(racine, 'node_modules', '.bin', 'tsc'), [
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

  // --- 🔥 Série quotidienne + 🎯 quête « premier tampon » (Claude JEU, 18/07/2026) ---
  assert.equal(economie.multSerie(0), 1); assert.equal(economie.multSerie(2), 1);
  assert.equal(economie.multSerie(3), 1.1); assert.equal(economie.multSerie(7), 1.2);
  assert.equal(economie.multSerie(14), 1.3); assert.equal(economie.multSerie(99), 1.3);
  const j1 = economie.serieApresTick({ jours: 0, dernierJour: '' }, '2026-07-18', '2026-07-17');
  assert.ok(j1 && j1.serie.jours === 1 && j1.perles === economie.SERIE_PERLES[0] && !j1.capsuleDoree, 'série J1');
  const j2 = economie.serieApresTick(j1.serie, '2026-07-19', '2026-07-18');
  assert.ok(j2 && j2.serie.jours === 2 && j2.perles === economie.SERIE_PERLES[1], 'série J2 consécutive');
  assert.equal(economie.serieApresTick(j2.serie, '2026-07-19', '2026-07-18'), null, 'série idempotente le même jour');
  const cassee = economie.serieApresTick(j2.serie, '2026-07-25', '2026-07-24');
  assert.ok(cassee && cassee.serie.jours === 1, 'série cassée repart à 1 sans malus');
  const j7 = economie.serieApresTick({ jours: 6, dernierJour: '2026-07-23' }, '2026-07-24', '2026-07-23');
  assert.ok(j7 && j7.capsuleDoree && j7.perles === 0 && j7.serie.jours === 7, 'J7 = capsule dorée');
  const j14 = economie.serieApresTick({ jours: 13, dernierJour: '2026-07-30' }, '2026-07-31', '2026-07-30');
  assert.ok(j14 && j14.capsuleDoree && j14.serie.jours === 14, 'J14 = capsule dorée (cycle hebdo)');

  let q = { etape: 0, progres: 0, reclamee: false };
  q = economie.queteApresCredit(q, 'capsules', 1);
  assert.ok(q.etape === 0 && q.progres === 0, 'quête : étape hors ordre ignorée');
  q = economie.queteApresCredit(q, 'niveaux', 1);
  assert.equal(q.progres, 1, 'quête : crédite l étape courante');
  q = economie.queteApresCredit(q, 'niveaux', 2);
  assert.ok(q.etape === 1 && q.progres === 0, 'quête : passage à l étape suivante');
  for (const e of economie.QUETE_TAMPON.slice(1)) q = economie.queteApresCredit(q, e.id, e.cible);
  assert.ok(q.etape === economie.QUETE_TAMPON.length && !q.reclamee, 'quête complète');
  const figee = economie.queteApresCredit({ ...q, reclamee: true }, 'perles', 999);
  assert.ok(figee.reclamee === true, 'quête réclamée figée');

  // --- 🎯 Timing « tap parfait » + parade parfaite (Claude JEU, combats v2, 18/07/2026) ---
  assert.equal(arene.timingDepuisPosition(0.5), 'parfait', 'centre = parfait');
  assert.equal(arene.timingDepuisPosition(0.5 + arene.TIMING_ZONE_OR / 2), 'parfait', 'bord doré inclus');
  assert.equal(arene.timingDepuisPosition(0.5 + arene.TIMING_ZONE_VERT / 2), 'bien', 'bord vert inclus');
  assert.equal(arene.timingDepuisPosition(0.05), 'rate', 'début de piste = raté');
  assert.equal(arene.timingDepuisPosition(1), 'rate', 'fin de piste (trop tard) = raté');
  assert.ok(arene.TIMING_MULT.parfait > arene.TIMING_MULT.bien && arene.TIMING_MULT.bien > 1
    && arene.TIMING_MULT.rate < 1, 'multiplicateurs ordonnés : parfait > bien > 1 > raté');
  assert.ok(arene.GARDE_PARFAITE > arene.GARDE_REDUCTION, 'parade parfaite > garde normale');

  // Un round joué avec timing « parfait » ne peut pas rater et tape plus fort qu'en « raté »
  // (rng forcé : pas de crit, variance médiane). La garde parfaite applique bien −70 %.
  const rngFixe = () => 0.5;
  const cA = arene.creerCombat(['bubble-master'], ['bubble-master'], 1);
  const cB = arene.creerCombat(['bubble-master'], ['bubble-master'], 1);
  arene.jouerRound(cA, 0, rngFixe, 0, 'parfait');
  arene.jouerRound(cB, 0, rngFixe, 0, 'rate');
  const degatsParfait = cA.equipes.b[0].pvMax - cA.equipes.b[0].pv;
  const degatsRate = cB.equipes.b[0].pvMax - cB.equipes.b[0].pv;
  assert.ok(degatsParfait > degatsRate, 'parfait doit taper plus fort que raté');
  const cG = arene.creerCombat(['bubble-master'], ['bubble-master'], 1);
  arene.jouerRound(cG, 'garde', rngFixe, 0, 'parfait');
  assert.equal(cG.equipes.a[0].charge >= 2, true, 'parade parfaite : jauge +2');

  // --- 💪 Entraînement des cartes + retente tournoi (Claude JEU, 19/07/2026) ---
  assert.equal(economie.multNiveauCarte(1), 1, 'niveau 1 = stats de base');
  assert.ok(Math.abs(economie.multNiveauCarte(10) - 1.54) < 1e-9, 'niveau 10 = +54 %');
  assert.equal(economie.multNiveauCarte(99), economie.multNiveauCarte(economie.NIVEAU_CARTE_MAX), 'multiplicateur plafonné');
  assert.ok(economie.coutNiveauCarte('commun', 1) < economie.coutNiveauCarte('legendaire', 1), 'légendaire plus cher');
  assert.ok(economie.coutNiveauCarte('commun', 9) > economie.coutNiveauCarte('commun', 1), 'coût croissant');
  assert.equal(economie.doublonsPourNiveau(4), 1); assert.equal(economie.doublonsPourNiveau(7), 2);
  assert.equal(economie.doublonsPourNiveau(10), 3); assert.equal(economie.doublonsPourNiveau(5), 0);
  const base = arene.creerCombattant('classico');
  const nv5 = arene.creerCombattant('classico', 1, [], 5);
  assert.ok(nv5.pvMax > base.pvMax && nv5.atk > base.atk, 'le niveau augmente PV et ATQ');
  assert.equal(nv5.vit, base.vit, 'la VIT ne change pas avec le niveau');
  assert.equal(nv5.niveau, 5, 'niveau posé sur le combattant');
  const cNv = arene.creerCombat(['classico'], ['classico'], 1, {}, {}, undefined, { classico: 10 });
  assert.ok(cNv.equipes.a[0].pvMax > cNv.equipes.b[0].pvMax, 'niveauxA appliqués au seul côté joueur');
  assert.ok(economie.TOURNOI_RETENTE_PERLES > 0, 'retente tournoi définie');

  // --- 🎯 Défensif : un tir du shooter consomme EXACTEMENT 1 tir restant ---
  const nvS = shooter.creerNiveau(4);
  const lanceurTest = { x: shooter.LARGEUR_TERRAIN / 2, y: shooter.LIGNE_LIMITE * shooter.LIGNE_H + 1.6 };
  const tirsAvant = nvS.tirsRestants;
  shooter.tirer(nvS, lanceurTest, -Math.PI / 2, () => 0.5);
  assert.equal(nvS.tirsRestants, tirsAvant - 1, 'un tir = un seul tir décompté');

  // --- 🌟 Shooter v2 : supernova, +1 tir, tir en or, rush (19/07/2026) ---
  const compteSpecial = (etatNv, sp) => {
    let n = 0;
    for (const l of etatNv.grille) for (const b of l.cases) if (b && b.special === sp) n++;
    return n;
  };
  const nivSix = shooter.creerNiveau(6);
  assert.ok(compteSpecial(nivSix, 'etoile') >= 1, 'niveau 6 : au moins une SUPERNOVA');
  assert.deepEqual(nivSix.objectif, { type: 'tomber', cible: 8 }, 'niveau 6 : objectif de chute court et réaliste');
  assert.equal(shooter.objectifLabel(nivSix.objectif), 'Détache 8 perles', 'objectif de chute compréhensible dans le HUD');
  assert.deepEqual(shooter.paramsNiveau(14).objectif, { type: 'tomber', cible: 10 }, 'objectif de chute progressif');
  assert.deepEqual(shooter.paramsNiveau(22).objectif, { type: 'tomber', cible: 12 }, 'objectif de chute plafonné');
  const nivCinq = shooter.creerNiveau(5);
  assert.ok(compteSpecial(nivCinq, 'tir') >= 1, 'niveau 5 : au moins une perle +1 tir');
  assert.equal(nivCinq.tirsMax, nivCinq.tirsRestants, 'tirsMax mémorisé au départ');
  assert.equal(nivCinq.rush, null, 'pas de rush au départ');
  const infini = shooter.creerPartieInfini(() => 0.5);
  assert.equal(infini.tirsMax, null, 'infini : pas de budget de tirs');
  // Le TIR EN OR ne se déclare jamais tant qu'il reste plus d'un tir
  const nvOr = shooter.creerNiveau(4);
  const resOr = shooter.tirer(nvOr, lanceurTest, -Math.PI / 2, () => 0.5);
  assert.equal(resOr.tirEnOr, false, 'pas de tir en or avec un budget plein');
  assert.equal(typeof resOr.etoiles, 'number');
  assert.equal(typeof resOr.tirsBonus, 'number');
  assert.ok(resOr.rushFin === null, 'pas de rush résolu au premier tir');

  // Vider le plateau gagne toujours un niveau Aventure, même si l'objectif
  // chiffré n'est pas terminé : sinon le joueur reste bloqué sans cible.
  const nvVide = shooter.creerNiveau(6);
  nvVide.grille = [{
    decalee: false,
    cases: Array.from({ length: shooter.COLS }, (_, i) => i === 4 ? { couleur: 0 } : null),
  }];
  nvVide.objectif = { type: 'tomber', cible: 15 };
  nvVide.objProgres = 7;
  nvVide.tirsRestants = 19;
  const resVide = shooter.tirer(nvVide, lanceurTest, -Math.PI / 2, () => 0.5, 'bombe');
  assert.equal(resVide.plateauNettoye, true, 'la dernière perle doit vider le plateau');
  assert.equal(resVide.objectifAtteint, true, 'un plateau vide doit conclure le niveau en victoire');
  assert.equal(nvVide.objProgres, 7, 'la victoire de nettoyage ne falsifie pas la progression affichée');

  // L'aide de fin de niveau explique l'action attendue quand le plateau ou les
  // tirs s'épuisent, puis disparaît dès que l'objectif est atteint.
  const nvAlerte = shooter.creerNiveau(6);
  assert.equal(shooter.alerteObjectif(nvAlerte), null, "pas d'alerte envahissante au début du niveau");
  nvAlerte.grille = [{
    decalee: false,
    cases: Array.from({ length: shooter.COLS }, () => ({ couleur: 0 })),
  }];
  nvAlerte.objectif = { type: 'tomber', cible: 15 };
  nvAlerte.objProgres = 7;
  nvAlerte.tirsRestants = 19;
  const aideTomber = shooter.alerteObjectif(nvAlerte);
  assert.ok(aideTomber?.includes('Encore 8 perles') && aideTomber.includes('plafond') && aideTomber.includes("ne les éclate pas"),
    "l'alerte doit expliquer comment faire tomber les perles");
  nvAlerte.objProgres = 15;
  assert.equal(shooter.alerteObjectif(nvAlerte), null, "l'alerte disparaît quand l'objectif est rempli");

  const nvAlerteTirs = shooter.creerNiveau(7);
  nvAlerteTirs.tirsRestants = 5;
  nvAlerteTirs.objectif = { type: 'couleur', couleur: 2, cible: 12 };
  nvAlerteTirs.objProgres = 9;
  assert.ok(shooter.alerteObjectif(nvAlerteTirs, () => 'jaunes')?.includes("groupes d'au moins 3"),
    "l'alerte couleur doit expliquer comment éclater les perles");

  // --- ⚡ Combo de parfaits + 🔥 série de victoires (Combats v3, 19/07/2026) ---
  assert.equal(arene.multCombo(0), 1, 'sans combo = neutre');
  assert.ok(arene.multCombo(1) > 1 && arene.multCombo(3) > arene.multCombo(1), 'le combo monte');
  assert.equal(arene.multCombo(99), arene.multCombo(arene.COMBO_PARFAIT_MAX), 'combo plafonné');
  const cCombo0 = arene.creerCombat(['bubble-master'], ['bubble-master'], 1);
  const cCombo3 = arene.creerCombat(['bubble-master'], ['bubble-master'], 1);
  arene.jouerRound(cCombo0, 0, () => 0.5, 0, 'parfait', 0);
  arene.jouerRound(cCombo3, 0, () => 0.5, 0, 'parfait', 3);
  const dg0 = cCombo0.equipes.b[0].pvMax - cCombo0.equipes.b[0].pv;
  const dg3 = cCombo3.equipes.b[0].pvMax - cCombo3.equipes.b[0].pv;
  assert.ok(dg3 > dg0, 'un combo en banque tape plus fort');
  assert.equal(economie.multSerieVictoires(0), 1, 'série 0 = ×1');
  assert.ok(Math.abs(economie.multSerieVictoires(2) - 1.3) < 1e-9, 'série 2 = ×1,3');
  assert.equal(economie.multSerieVictoires(99), economie.multSerieVictoires(economie.SERIE_V_MAX), 'série plafonnée');

  // --- 🩸 Visée blessée : barre plus rapide + zones plus étroites -------------------
  assert.equal(arene.viseeBlessure(100, 100), 0, 'pleine forme = 0');
  assert.equal(arene.viseeBlessure(0, 100), 1, 'à terre = 1');
  assert.ok(arene.viseeDuree(0) === arene.VISEE_DUREE_BASE && arene.viseeDuree(1) === arene.VISEE_DUREE_MIN
    && arene.viseeDuree(0.5) < arene.viseeDuree(0), 'la barre accélère avec la blessure');
  const zSain = arene.viseeZones(0), zBlesse = arene.viseeZones(0.9);
  assert.ok(zBlesse.or < zSain.or && zBlesse.vert < zSain.vert, 'les zones rétrécissent');
  const posLimite = 0.5 + zSain.or / 2 - 0.001; // parfait en pleine forme…
  assert.equal(arene.timingDepuisPosition(posLimite), 'parfait');
  assert.equal(arene.timingDepuisPosition(posLimite, zBlesse), 'bien', '…mais plus quand on est blessé');

  // --- 💧 Fatigue de soin : chaque soin successif rend moins ------------------------
  assert.equal(arene.multFatigueSoin(0), 1, '1er soin = plein');
  assert.ok(Math.abs(arene.multFatigueSoin(1) - 0.75) < 1e-9, '2e soin = 75 %');
  assert.equal(arene.multFatigueSoin(99), arene.FATIGUE_SOIN_PLANCHER, 'plancher à 40 %');
  const cSoin = arene.creerCombat(['lacto'], ['bubble-master'], 1);
  cSoin.equipes.a[0].pvMax = 1000; // assez de marge pour survivre aux ripostes…
  cSoin.equipes.a[0].pv = 200;     // …tout en restant blessé (les soins s'appliquent)
  const gains = [];
  for (let i = 0; i < 2; i++) {
    const evts = arene.jouerRound(cSoin, 1, () => 0.5, 0);
    for (const e of evts) if (e.t === 'soin' && e.cote === 'a') gains.push(e.valeur);
  }
  assert.ok(gains.length >= 2 && gains[1] < gains[0], 'le 2e soin rend moins que le 1er');

  console.log('Boba Quest : tests moteurs OK');
} finally {
  fs.rmSync(sortie, { recursive: true, force: true });
}
