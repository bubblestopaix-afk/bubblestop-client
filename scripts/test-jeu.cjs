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
    path.join(racine, 'src/components/jeu/tournee.ts'),
    path.join(racine, 'src/components/jeu/moteur-shooter.ts'),
  ], { cwd: racine, stdio: 'pipe' });

  const shooter = require(path.join(sortie, 'moteur-shooter.js'));
  const arene = require(path.join(sortie, 'arene.js'));
  const economie = require(path.join(sortie, 'economie.js'));
  const tournee = require(path.join(sortie, 'tournee.js'));

  // Tous les prix qui ont une valeur réelle en boutique possèdent un code
  // canonique unique. Les gains purement internes (perles/capsule) n'en ont pas.
  const codesReels = [
    'quete_premier_tampon',
    ...Object.values(economie.SETS).map((set) => set.recompense.code),
    economie.RECOMPENSE_COLLECTION.code,
    ...economie.BOUTIQUE.map((prix) => prix.code),
    ...economie.ROULETTE.filter((prix) => ['tampon', 'reduction', 'boisson'].includes(prix.type))
      .map((prix) => prix.code),
  ];
  const codesAttendus = [
    'quete_premier_tampon',
    'set_milk', 'set_fruit', 'set_topping', 'set_signature', 'collection_complete',
    'boutique_tampon_1', 'boutique_reduction_10', 'boutique_reduction_20', 'boutique_boisson_l',
    'roulette_tampon_1', 'roulette_tampon_2', 'roulette_tampon_3',
    'roulette_reduction_10', 'roulette_boisson_l',
  ];
  assert.deepEqual([...new Set(codesReels)].sort(), codesAttendus.sort(),
    'le catalogue client doit couvrir exactement tous les prix réels');
  assert.equal(codesReels.length, new Set(codesReels).size,
    'un code canonique ne doit pas représenter deux prix client différents');
  for (const segment of economie.ROULETTE) {
    if (['tampon', 'reduction', 'boisson'].includes(segment.type)) {
      assert.ok(segment.code, `roulette ${segment.id}: code serveur manquant`);
    } else {
      assert.equal(segment.code, undefined, `roulette ${segment.id}: gain interne envoyé à tort à la caisse`);
    }
  }

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
  // 🔁 MIGRATION 26/07 (LOT F, mission 2) — le pont `COMPAT_STATUTS` d'arene.ts est
  // supprimé : `.collantTours` devient `toursStatut(c, 'collant')` (le pont rendait
  // `Math.max(0, tours)`, et le Collant est toujours posé à une durée > 0 : sémantique
  // identique), `.givre` / `.petillant` deviennent `aStatut(c, id)`. La propriété testée
  // — « la marque de famille est bien posée » — ne change pas d'un iota.
  const collant = arene.creerCombat(['fraisy'], ['boba']);
  arene.jouerRound(collant, 1, () => 0.3, 0);
  assert.ok(arene.toursStatut(collant.equipes.b[0], 'collant') > 0, 'marque Collant absente');

  const givre = arene.creerCombat(['theo'], ['popping']);
  arene.jouerRound(givre, 1, () => 0.3, 0);
  assert.equal(arene.aStatut(givre.equipes.b[0], 'givre'), true, 'marque Givré absente');

  const petillant = arene.creerCombat(['popping'], ['fraisy']);
  arene.jouerRound(petillant, 1, () => 0.3, 0);
  assert.equal(arene.aStatut(petillant.equipes.b[0], 'petillant'), true, 'marque Pétillant absente');

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

  // --- 🔄 Riposte de parade parfaite + 🛡️⚡ parade anti-Signature (Pack 1, 19/07/2026) ---
  // Parade parfaite (timing « parfait » sur la Garde) = contre-coup GARANTI :
  // 50 % de l'ATQ, imparable, joué APRÈS l'action adverse, même si elle n'attaque pas.
  const cRip = arene.creerCombat(['classico'], ['classico'], 1);
  const evtsRip = arene.jouerRound(cRip, 'garde', rngFixe, 0, 'parfait');
  const ripostes = evtsRip.filter((e) => e.t === 'riposte');
  assert.equal(ripostes.length, 1, 'parade parfaite = exactement une riposte');
  assert.equal(ripostes[0].cote, 'a', 'la riposte vient du joueur');
  assert.equal(ripostes[0].antiSignature, false, 'pas anti-Signature contre une attaque normale');
  const coupsSurB = evtsRip.filter((e) => e.t === 'degats' && e.cote === 'b');
  assert.equal(coupsSurB.length, 1, 'un seul impact subi par l adversaire');
  const riposteAttendue = Math.round(cRip.equipes.a[0].atk * arene.RIPOSTE_PCT);
  assert.equal(coupsSurB[0].valeur, riposteAttendue, 'riposte = 50 % de l ATQ (rng médian, pas de crit)');
  assert.equal(cRip.equipes.b[0].pv, cRip.equipes.b[0].pvMax - riposteAttendue, 'PV adverses cohérents avec la riposte');

  // Timings inférieurs : jamais de riposte, l'adversaire reste intact.
  for (const timing of ['bien', 'rate']) {
    const cPas = arene.creerCombat(['classico'], ['classico'], 1);
    const evtsPas = arene.jouerRound(cPas, 'garde', rngFixe, 0, timing);
    assert.equal(evtsPas.some((e) => e.t === 'riposte'), false, `timing ${timing} : aucune riposte`);
    assert.equal(cPas.equipes.b[0].pv, cPas.equipes.b[0].pvMax, `timing ${timing} : adversaire intact`);
  }
  // Une ATTAQUE (même parfaite) ne déclenche jamais la riposte : elle est liée à la Garde.
  const evtsAtt = arene.jouerRound(arene.creerCombat(['classico'], ['classico'], 1), 0, rngFixe, 0, 'parfait');
  assert.equal(evtsAtt.some((e) => e.t === 'riposte'), false, 'la riposte n existe que sur parade parfaite');

  // Parade parfaite CONTRE une Signature annoncée : −80 % (au lieu de −70 %),
  // jauge +3, et la riposte est marquée « antiSignature » (journal héroïque).
  const cAnti = arene.creerCombat(['bubble-master'], ['bubble-master'], 1);
  cAnti.equipes.b[0].charge = arene.CHARGE_MAX;
  cAnti.intentionB = 'signature';
  const degatsSig = Math.min(
    Math.round(cAnti.equipes.a[0].pvMax * 0.2),
    Math.round(cAnti.equipes.b[0].atk * arene.SIG_CAP_ATK),
  );
  const evtsAnti = arene.jouerRound(cAnti, 'garde', rngFixe, undefined, 'parfait');
  assert.equal(cAnti.equipes.a[0].charge, 3, 'parade héroïque : jauge +3 (plafonnée à CHARGE_MAX)');
  assert.equal(
    cAnti.equipes.a[0].pv,
    cAnti.equipes.a[0].pvMax - Math.ceil(degatsSig * (1 - arene.GARDE_PARFAITE_ANTI_SIGNATURE)),
    'la Signature encaissée en parade héroïque est réduite de 80 %',
  );
  const ripAnti = evtsAnti.find((e) => e.t === 'riposte');
  assert.ok(ripAnti && ripAnti.antiSignature === true, 'riposte héroïque marquée anti-Signature');
  assert.ok(arene.GARDE_PARFAITE_ANTI_SIGNATURE > arene.GARDE_PARFAITE, 'anti-Signature bloque plus qu une parade parfaite');

  // La riposte peut mettre K.O. : le remplaçant entre, ou le combat se termine.
  const cKoR = arene.creerCombat(['bubble-master'], ['classico', 'theo', 'lacto'], 1);
  cKoR.equipes.b[0].pv = 5; // son passif le soigne à 10, la riposte (~16) suffit quand même
  const evtsKoR = arene.jouerRound(cKoR, 'garde', rngFixe, 0, 'parfait');
  assert.ok(evtsKoR.some((e) => e.t === 'ko' && e.cote === 'b'), 'la riposte peut mettre K.O.');
  assert.ok(evtsKoR.some((e) => e.t === 'entree' && e.cote === 'b' && e.index === 1), 'le remplaçant entre après le K.O.');
  assert.equal(cKoR.actifs.b, 1, 'l actif adverse bascule sur le remplaçant');
  const cFinR = arene.creerCombat(['bubble-master'], ['classico'], 1);
  cFinR.equipes.b[0].pv = 5;
  const evtsFinR = arene.jouerRound(cFinR, 'garde', rngFixe, 0, 'parfait');
  const finR = evtsFinR.find((e) => e.t === 'fin');
  assert.ok(finR && finR.vainqueur === 'a' && cFinR.fini, 'un K.O. de riposte peut terminer le combat');

  // --- 🏅 Palmarès « Exploits » par carte (Pack 1, 19/07/2026) ---
  // Compteurs purs : incréments, MAX pour le plus gros coup, titres par paliers.
  let ex = economie.exploitsApresEvenement({}, 'classico', { ko: 1 });
  ex = economie.exploitsApresEvenement(ex, 'classico', { ko: 1, victoires: 1, parfaits: 1, plusGrosCoup: 12 });
  ex = economie.exploitsApresEvenement(ex, 'classico', { plusGrosCoup: 21 });
  ex = economie.exploitsApresEvenement(ex, 'classico', { plusGrosCoup: 7 }); // un petit coup n'efface pas le record
  assert.deepEqual(ex, { classico: { ko: 2, victoires: 1, parfaits: 1, plusGrosCoup: 21 } }, 'exploits : incréments + record conservé');
  assert.deepEqual(
    economie.exploitsApresEvenement(ex, 'theo', { victoires: 1 }).theo,
    { ko: 0, victoires: 1, parfaits: 0, plusGrosCoup: 0 },
    'une nouvelle carte part de zéro',
  );
  assert.deepEqual(economie.titresExploits({ ko: 9, victoires: 4, parfaits: 9, plusGrosCoup: 0 }), [], 'aucun titre sous les seuils');
  assert.deepEqual(economie.titresExploits({ ko: 10, victoires: 0, parfaits: 0, plusGrosCoup: 0 }), ['Finisseur'], '1er palier de K.O.');
  assert.equal(economie.titresExploits({ ko: 150, victoires: 0, parfaits: 0, plusGrosCoup: 0 }).length, 3, '3 titres à 150 K.O.');
  assert.deepEqual(economie.titresExploits({ ko: 0, victoires: 5, parfaits: 0, plusGrosCoup: 0 }), ['Combattante'], '1er palier de victoires');
  assert.equal(economie.titresExploits({ ko: 0, victoires: 100, parfaits: 0, plusGrosCoup: 0 }).length, 3, '3 titres à 100 victoires');
  assert.deepEqual(economie.titresExploits({ ko: 0, victoires: 0, parfaits: 50, plusGrosCoup: 0 }), ['Adroite', 'Chirurgicale'], '2 premiers paliers de parfaits');
  assert.ok(economie.titresExploits({ ko: 0, victoires: 0, parfaits: 200, plusGrosCoup: 0 }).includes('Métronome'), 'palier ultime de parfaits');
  // Migration de sauvegarde : additive, tolérante, jamais destructrice.
  assert.deepEqual(economie.migrerExploits(undefined), {}, 'migration : absent → map vide');
  assert.deepEqual(economie.migrerExploits(null), {}, 'migration : null → map vide');
  assert.deepEqual(
    economie.migrerExploits({ classico: { ko: 3 } }),
    { classico: { ko: 3, victoires: 0, parfaits: 0, plusGrosCoup: 0 } },
    'migration : compteurs manquants complétés à 0',
  );
  assert.deepEqual(
    economie.migrerExploits({ classico: { ko: -4, victoires: 'x', parfaits: null, plusGrosCoup: 12.7 }, fantome: null }),
    { classico: { ko: 0, victoires: 0, parfaits: 0, plusGrosCoup: 12 } },
    'migration : valeurs sales assainies, entrées invalides ignorées',
  );

  // ============================================================================
  // PACK 2 (19/07/2026) — 🎖️ Talents d'évolution + 🗺️ Tournée des Maîtres
  // ============================================================================

  // --- 🎖️ Table des talents : les 24 cartes, 3 paliers × 2 options -----------------
  assert.equal(Object.keys(economie.TALENTS_CARTES).length, 24, '24 tables de talents curées');
  for (const c of economie.COLLECTIBLES) {
    const table = economie.TALENTS_CARTES[c.id];
    assert.ok(table, `${c.id}: table de talents manquante`);
    for (const palier of economie.PALIERS_TALENT) {
      const options = table[palier];
      assert.ok(Array.isArray(options) && options.length === 2, `${c.id} palier ${palier}: 2 options requises`);
      for (const opt of options) {
        assert.ok(opt.effet && opt.nom && opt.desc, `${c.id} palier ${palier}: option incomplète`);
      }
    }
  }

  // Un talent n'est actif que si le palier est ATTEINT et le choix FAIT.
  assert.deepEqual(economie.talentsActifsCarte('boba', { p4: 'a' }, 3), [], 'palier non atteint → inactif');
  assert.deepEqual(economie.talentsActifsCarte('boba', undefined, 10), [], 'aucun choix → inactif');
  assert.deepEqual(
    economie.talentsActifsCarte('boba', { p4: 'a' }, 4),
    [economie.TALENTS_CARTES.boba[4][0].effet],
    'palier 4 atteint + choix a → 1 effet',
  );
  assert.deepEqual(
    economie.talentsActifsCarte('boba', { p4: 'b', p10: 'a' }, 10).length,
    2,
    'p7 sans choix → ignoré ; p4 + p10 actifs',
  );
  assert.deepEqual(
    economie.talentsActifsCarte('boba', { p4: 'a', p7: 'a', p10: 'b' }, 10).length,
    3,
    '3 paliers choisis → 3 effets',
  );

  // effetsTalentsEquipe : même canal que niveauxEquipe, ne garde que les cartes actives.
  const effetsEq = economie.effetsTalentsEquipe(
    { boba: { p4: 'a' }, classico: {}, theo: { p7: 'b' } },
    { boba: 4, classico: 10, theo: 6 },
  );
  assert.equal(Object.keys(effetsEq).length, 1, 'theo niveau 6 < palier 7 → pas d effet ; classico sans choix → ignoré');
  assert.deepEqual(effetsEq.boba, [economie.TALENTS_CARTES.boba[4][0].effet]);

  // Migration de sauvegarde : additive, tolérante, jamais destructrice.
  assert.deepEqual(economie.migrerTalents(undefined), {}, 'talents : absent → map vide');
  assert.deepEqual(economie.migrerTalents(null), {}, 'talents : null → map vide');
  assert.deepEqual(
    economie.migrerTalents({ boba: { p4: 'a', p7: 'x', p10: 'b' }, fantome: null, p: 'a' }),
    { boba: { p4: 'a', p10: 'b' } },
    'talents : seuls a/b sur p4/p7/p10 sont conservés',
  );

  // --- 🎖️ Talents « plats » à la création du combattant ------------------------------
  const ficheClassico = arene.creerCombattant('classico', 1);
  const vite = arene.creerCombattant('classico', 1, [], 1, ['vit_plus']);
  assert.equal(vite.vit, ficheClassico.vit + arene.TALENT_VIT, 'vit_plus : +3 VIT');
  assert.equal(
    arene.creerCombattant('classico', 1, [], 1, ['vit_plus', 'vit_plus']).vit,
    ficheClassico.vit + 2 * arene.TALENT_VIT,
    'vit_plus : cumul +6',
  );
  const fort = arene.creerCombattant('classico', 1, [], 1, ['atk_pct']);
  assert.ok(Math.abs(fort.atk / ficheClassico.atk - 1.1) < 0.04, `atk_pct : ×1,1 (obtenu ${fort.atk}/${ficheClassico.atk})`);
  const tank = arene.creerCombattant('boba', 1, [], 1, ['pv_pct']);
  const baseBoba = arene.creerCombattant('boba', 1);
  assert.ok(Math.abs(tank.pvMax / baseBoba.pvMax - 1.12) < 0.04, 'pv_pct : ×1,12');
  assert.equal(tank.pv, tank.pvMax, 'pv_pct : PV pleins à la création');
  // 🔁 MIGRATION (mission 2) — `.bouclier` → `aStatut(c, 'bouclier')` : le pont rendait
  // exactement ce booléen. Même sémantique : « le bouclier est levé à la création ».
  assert.equal(arene.aStatut(arene.creerCombattant('boba', 1, [], 1, ['bouclier_depart']), 'bouclier'), true, 'bouclier_depart : bouclier levé');
  assert.equal(arene.creerCombattant('boba', 1, [], 1, ['charge_depart']).charge, 1, 'charge_depart : +1 charge');
  assert.equal(
    arene.creerCombattant('mango', 1, [], 1, ['spe_munition']).speRestantes,
    arene.SPE_USAGES + 1,
    'spe_munition : +1 munition',
  );
  assert.equal(arene.creerCombattant('theo', 1, [], 1, ['premiere_frappe']).premiereFrappe, true, 'premiere_frappe armé');

  // --- 🎖️ spe_crit : +20 pts de crit sur la spé (rng 0,2 : crit AVEC, pas SANS) -----
  const cCritAvec = arene.creerCombat(['mango'], ['pasteka'], 1, {}, {}, undefined, {}, { mango: ['spe_crit'] });
  const evtsCritAvec = arene.jouerRound(cCritAvec, 1, () => 0.2, 0);
  assert.ok(
    evtsCritAvec.some((e) => e.t === 'statut' && /critique/i.test(e.texte)),
    'spe_crit : rng 0,2 < 0,12+0,20 → critique',
  );
  const cCritSans = arene.creerCombat(['mango'], ['pasteka'], 1);
  const evtsCritSans = arene.jouerRound(cCritSans, 1, () => 0.2, 0);
  assert.ok(
    !evtsCritSans.some((e) => e.t === 'statut' && /critique/i.test(e.texte)),
    'sans talent : rng 0,2 > 0,12 → pas de critique',
  );

  // --- 🎖️ marque_plus : Collant 3 actions (→ 2 après décrément), Pétillant 35 % -----
  // 🔁 MIGRATION (mission 2) — `.collantTours` → `toursStatut(c, 'collant')`. Le pont
  // renvoyait `Math.max(0, toursStatut(...))` et `toursStatut` rend déjà 0 quand le
  // statut est absent : la DURÉE RESTANTE testée est rigoureusement la même.
  const cCollAvec = arene.creerCombat(['fraisy'], ['pasteka'], 1, {}, {}, undefined, {}, { fraisy: ['marque_plus'] });
  arene.jouerRound(cCollAvec, 1, () => 0.2, 0);
  assert.equal(arene.toursStatut(cCollAvec.equipes.b[0], 'collant'), 2, 'marque_plus : Collant posé à 3, décrémenté à 2 après l action adverse');
  const cCollSans = arene.creerCombat(['fraisy'], ['pasteka'], 1);
  arene.jouerRound(cCollSans, 1, () => 0.2, 0);
  assert.equal(arene.toursStatut(cCollSans.equipes.b[0], 'collant'), 1, 'sans marque_plus : Collant posé à 2, décrémenté à 1');
  const cPetAvec = arene.creerCombat(['popping'], ['pasteka'], 1, {}, {}, undefined, {}, { popping: ['marque_plus'] });
  arene.jouerRound(cPetAvec, 1, () => 0.2, 0);
  assert.equal(cPetAvec.equipes.b[0].petillantPct, arene.TALENT_PETILLANT_PCT, 'marque_plus : Pétillant éclabousse à 35 %');
  const cPetSans = arene.creerCombat(['popping'], ['pasteka'], 1);
  arene.jouerRound(cPetSans, 1, () => 0.2, 0);
  assert.equal(cPetSans.equipes.b[0].petillantPct, arene.PETILLANT_PCT, 'sans talent : Pétillant standard 25 %');

  // --- 🎖️ contre_marque : 25 % de poser SA marque en encaissant (rng 0,2 déclenche) -
  const cContreAvec = arene.creerCombat(['pasteka'], ['classico'], 1, {}, {}, undefined, {}, { pasteka: ['contre_marque'] });
  arene.jouerRound(cContreAvec, 'garde', () => 0.2, 0);
  // 🔁 MIGRATION (mission 2) — idem : `.collantTours` → `toursStatut(c, 'collant')`.
  // Le cas « 0 » couvre l'absence de statut, que `toursStatut` rend déjà comme 0.
  assert.equal(arene.toursStatut(cContreAvec.equipes.b[0], 'collant'), 1, 'contre_marque : pasteka rend l attaquant COLLANT (2 → 1 après décrément)');
  const cContreSans = arene.creerCombat(['pasteka'], ['classico'], 1);
  arene.jouerRound(cContreSans, 'garde', () => 0.2, 0);
  assert.equal(arene.toursStatut(cContreSans.equipes.b[0], 'collant'), 0, 'sans talent : pas de contre-marque');

  // --- 🎖️ garde_maitrisee : SA Garde bloque −55 % au lieu de −45 % -------------------
  const pvMaxPasteka = arene.creerCombattant('pasteka', 1).pvMax;
  const cGardeAvec = arene.creerCombat(['pasteka'], ['classico'], 1, {}, {}, undefined, {}, { pasteka: ['garde_maitrisee'] });
  const evtsGardeAvec = arene.jouerRound(cGardeAvec, 'garde', () => 0.2, 0);
  const perteAvec = cGardeAvec.equipes.a[0].pvMax - cGardeAvec.equipes.a[0].pv;
  const cGardeSans = arene.creerCombat(['pasteka'], ['classico'], 1);
  arene.jouerRound(cGardeSans, 'garde', () => 0.2, 0);
  const perteSans = cGardeSans.equipes.a[0].pvMax - cGardeSans.equipes.a[0].pv;
  assert.ok(perteAvec < perteSans, `garde_maitrisee : ${perteAvec} PV perdus < ${perteSans} sans talent`);
  assert.ok(
    evtsGardeAvec.some((e) => e.t === 'statut' && /amortit 55 %/.test(e.texte)),
    'garde_maitrisee : l événement annonce 55 %',
  );
  assert.ok(pvMaxPasteka > 0, 'fiche pasteka lisible');

  // --- 🎖️ soin_plus : soins prodigués ×1,2 -------------------------------------------
  const cSoinAvec = arene.creerCombat(['lacto'], ['pasteka'], 1, {}, {}, undefined, {}, { lacto: ['soin_plus'] });
  cSoinAvec.equipes.a[0].pv = 30; // de la place pour mesurer le soin réel
  const evtsSoinAvec = arene.jouerRound(cSoinAvec, 1, () => 0.2, 0);
  const soinAvec = evtsSoinAvec.find((e) => e.t === 'soin' && e.cote === 'a')?.valeur ?? 0;
  const cSoinSans = arene.creerCombat(['lacto'], ['pasteka'], 1);
  cSoinSans.equipes.a[0].pv = 30;
  const evtsSoinSans = arene.jouerRound(cSoinSans, 1, () => 0.2, 0);
  const soinSans = evtsSoinSans.find((e) => e.t === 'soin' && e.cote === 'a')?.valeur ?? 0;
  assert.ok(soinSans > 0, 'le Bain de lait soigne');
  assert.ok(
    Math.abs(soinAvec / soinSans - 1.2) <= 0.03,
    `soin_plus : soin ×1,2 (obtenu ${soinAvec}/${soinSans})`,
  );

  // --- 🎖️ premiere_frappe : 1ère attaque du combat +25 %, consommée -----------------
  const cFrappeAvec = arene.creerCombat(['paillette'], ['pasteka'], 1, {}, {}, undefined, {}, { paillette: ['premiere_frappe'] });
  const evtsFrappeAvec = arene.jouerRound(cFrappeAvec, 0, () => 0.2, 0);
  const degatsFrappeAvec = evtsFrappeAvec.find((e) => e.t === 'degats' && e.cote === 'b')?.valeur ?? 0;
  const cFrappeSans = arene.creerCombat(['paillette'], ['pasteka'], 1);
  const evtsFrappeSans = arene.jouerRound(cFrappeSans, 0, () => 0.2, 0);
  const degatsFrappeSans = evtsFrappeSans.find((e) => e.t === 'degats' && e.cote === 'b')?.valeur ?? 0;
  assert.ok(
    Math.abs(degatsFrappeAvec / degatsFrappeSans - 1.25) < 0.06,
    `premiere_frappe : 1er coup ×1,25 (obtenu ${degatsFrappeAvec}/${degatsFrappeSans})`,
  );
  assert.ok(
    evtsFrappeAvec.some((e) => e.t === 'statut' && /premier coup parfait/.test(e.texte)),
    'premiere_frappe : événement journalisé',
  );
  assert.equal(cFrappeAvec.equipes.a[0].premiereFrappe, false, 'premiere_frappe : consommé au 1er impact');

  // --- 🗺️ Tournée : run, adversaires et drafts déterministes --------------------------
  const runVierge = tournee.creerRun('2026-S30');
  assert.deepEqual(
    runVierge,
    { semaine: '2026-S30', etape: 1, victoires: 0, bonus: [], pvReportes: {}, draftEnAttente: false },
    'creerRun : run neuve à l étape 1',
  );
  const adv1a = tournee.adversaireTournee('2026-S30', 1);
  const adv1b = tournee.adversaireTournee('2026-S30', 1);
  assert.deepEqual(adv1a, adv1b, 'adversaireTournee : déterministe à semaine+étape fixées');
  assert.equal(adv1a.ids.length, 3, 'adversaire : 3 combattants');
  assert.equal(adv1a.echelle, 1.07, 'échelle étape 1 = 1,07');
  assert.deepEqual(adv1a.objets, {}, 'pas d objets tenus avant l étape 8');
  assert.equal(tournee.adversaireTournee('2026-S30', 8).echelle, 1.56, 'échelle étape 8 = 1,56');
  assert.equal(tournee.adversaireTournee('2026-S30', 10).echelle, 1.7, 'échelle étape 10 = 1,70');
  const draft1 = tournee.draftBonusRun(runVierge);
  assert.equal(draft1.length, 3, 'draft : 3 bonus proposés');
  assert.equal(new Set(draft1).size, 3, 'draft : 3 bonus distincts');
  assert.deepEqual(draft1, tournee.draftBonusRun(runVierge), 'draft : déterministe');
  const runAvecBonus = { ...runVierge, bonus: [draft1[0]] };
  assert.ok(
    tournee.draftBonusRun(runAvecBonus).every((id) => id !== draft1[0]),
    'draft : jamais un bonus déjà pris',
  );
  assert.equal(tournee.draftBonusRun({ ...runVierge, bonus: [...tournee.BONUS_RUN_IDS] }).length, 0, 'draft vide quand tout est pris');
  // 💰 27/07 — LA TOURNÉE EST RELEVÉE (mode le plus mal payé du jeu : 60 perles/combat en
  // médiane, alors que c'est le SEUL où perdre efface toute la run). Une victoire d'étape
  // porte désormais une PRIME DE RISQUE cumulative, donc l'étape 5 passe de 160 à 460.
  // Ce qui NE bouge pas — et ne doit jamais bouger — c'est l'étape 1 : la gagner puis
  // abandonner est répétable à l'infini, donc ses 80 perles sont le PLANCHER ANTI-FARM de
  // tout le jeu. Le plancher tient parce que la prime de risque vaut EXACTEMENT 0 à
  // l'étape 1 (aucune étape franchie = aucun risque pris) : c'est vérifié plus bas, dérivé
  // des constantes, dans « 💰 B · RÉÉQUILIBRAGE DES COMBATS ».
  assert.equal(tournee.perlesVictoireTournee(1), 80, 'victoire duel 1 = 80 perles');
  assert.equal(tournee.perlesVictoireTournee(5), 460, 'victoire duel 5 = 460 perles (prime de risque cumulative)');

  // --- 🗺️ Bonus de run sur le combat frais ---------------------------------------------
  const cBonus = arene.creerCombat(['classico'], ['pasteka'], 1);
  const atkAvant = cBonus.equipes.a[0].atk;
  const pvAvant = cBonus.equipes.a[0].pvMax;
  const vitAvant = cBonus.equipes.a[0].vit;
  tournee.appliquerBonusRun(cBonus, ['sirop-atk', 'perle-geante', 'recharge-spe', 'shaker-chaud', 'the-energisant', 'glacon-ouverture', 'paille-vampire', 'poignet-sur']);
  const cb = cBonus.equipes.a[0];
  assert.equal(cb.atk, Math.round(atkAvant * 1.15), 'sirop-atk : ATQ ×1,15');
  assert.equal(cb.pvMax, Math.round(pvAvant * 1.15), 'perle-geante : PV max ×1,15');
  assert.equal(cb.pv, cb.pvMax, 'perle-geante : PV recalés au nouveau max');
  assert.equal(cb.speRestantes, arene.SPE_USAGES + 1, 'recharge-spe : +1 munition');
  assert.equal(cb.charge, 1, 'shaker-chaud : +1 charge au départ');
  assert.equal(cb.vit, vitAvant + 3, 'the-energisant : +3 VIT');
  // 🔁 MIGRATION (mission 2) — `.bouclier` → `aStatut(cb, 'bouclier')`.
  assert.equal(arene.aStatut(cb, 'bouclier'), true, 'glacon-ouverture : bouclier levé');
  assert.equal(cb.eff.volDeViePct, 10, 'paille-vampire : vol de vie 10 %');

  // --- 🛡️ « Poignet Sûr » — RÉÉCRIT LE 27/07 : le bonus ne faisait STRICTEMENT RIEN. ----
  // Il baissait `gardeCooldownBase`, mais le cooldown est décrémenté en tête du round
  // suivant : un cooldown posé `P` rend la Garde au round N+P, donc `P = 1` autoriserait
  // deux Gardes d'affilée (invariant). Or `GARDE_COOLDOWN = 1` (§A9) donne déjà `P = 2`, la
  // cadence la plus serrée que l'invariant permette — mesuré `G.G.G.G.` avec ET sans le
  // bonus, et +0 victoire sur 400 duels seedés. Le bonus garde son esprit (la Garde) en
  // changeant d'axe : garder MIEUX au lieu de garder plus souvent, via le talent existant
  // `garde_maitrisee`. Mesuré après : +17 victoires/400 pour un joueur défensif (6e des 10
  // bonus, entre `shaker-chaud` +12 et `marque-ouverture` +19), +4/400 en jeu mixte.
  const gardeDeBase = (bonus, timing, talentsDeDepart) => {
    const c = arene.creerCombat(['pasteka'], ['classico'], 1);
    if (talentsDeDepart) c.equipes.a[0].talents = [...talentsDeDepart];
    tournee.appliquerBonusRun(c, bonus);
    arene.jouerRound(c, 'garde', rngFixe, 1, timing); // choixB = 1 → action NON offensive
    return arene.valeurStatut(c.equipes.a[0], 'garde');
  };
  // 1) le bonus a un effet RÉEL et mesurable sur la Garde de base — c'est tout l'objet du
  //    correctif : un bonus de draft ne doit jamais pouvoir être choisi pour rien.
  assert.equal(gardeDeBase([], 'rate'), arene.GARDE_REDUCTION, 'sans le bonus : Garde de base standard');
  assert.equal(gardeDeBase(['poignet-sur'], 'rate'), arene.GARDE_MAITRISEE, 'poignet-sur : la Garde de base est MAÎTRISÉE');
  assert.ok(gardeDeBase(['poignet-sur'], 'rate') > gardeDeBase([], 'rate'),
    'poignet-sur DOIT être strictement meilleur que l absence de bonus (il ne l était plus)');
  // 2) les deux constantes figées par §A9 restent intactes : le bonus ne peut pas les
  //    dépasser, et la parade parfaite reste la récompense du timing, pas du draft.
  assert.equal(gardeDeBase(['poignet-sur'], 'parfait'), arene.GARDE_PARFAITE,
    'poignet-sur ne touche PAS à GARDE_PARFAITE (§A9)');
  assert.ok(arene.GARDE_MAITRISEE < arene.GARDE_PARFAITE, 'la parade parfaite reste strictement meilleure');
  // 3) idempotence : une carte qui a DÉJÀ le talent ne le cumule pas (pas de power creep),
  //    et le bonus reste sans effet destructeur sur ses autres talents.
  assert.equal(gardeDeBase(['poignet-sur'], 'rate', ['garde_maitrisee']), arene.GARDE_MAITRISEE,
    'poignet-sur sur une carte qui a déjà garde_maitrisee : même valeur, aucun cumul');
  const cCumul = arene.creerCombat(['pasteka'], ['classico'], 1);
  cCumul.equipes.a[0].talents = ['garde_maitrisee', 'vit_plus'];
  tournee.appliquerBonusRun(cCumul, ['poignet-sur', 'poignet-sur']);
  assert.equal(cCumul.equipes.a[0].talents.filter((t) => t === 'garde_maitrisee').length, 1,
    'garde_maitrisee reste en un seul exemplaire même appliqué deux fois');
  assert.ok(cCumul.equipes.a[0].talents.includes('vit_plus'), 'les talents existants de la carte sont préservés');
  // 4) L'INVARIANT DE CADENCE : jamais deux Gardes d'affilée avec la même carte, avec ET
  //    sans le bonus. C'est ce que l'ancien effet mettait en danger s'il avait « marché ».
  const cadenceGarde = (bonus) => {
    const c = arene.creerCombat(['pasteka'], ['classico'], 1);
    tournee.appliquerBonusRun(c, bonus);
    let motif = '';
    for (let r = 0; r < 8 && !c.fini; r++) {
      const ev = arene.jouerRound(c, 'garde', rngFixe, 1, 'bien');
      motif += ev.some((e) => e.t === 'annonce' && e.cote === 'a' && e.cle === 'garde') ? 'G' : '.';
    }
    return motif;
  };
  for (const bonus of [[], ['poignet-sur']]) {
    const motif = cadenceGarde(bonus);
    assert.equal(motif.includes('GG'), false,
      `invariant : jamais deux Gardes d affilée (bonus « ${bonus[0] ?? 'aucun'} » → ${motif})`);
    assert.ok(motif.includes('G'), 'la Garde reste bel et bien jouable');
  }
  assert.equal(cadenceGarde(['poignet-sur']), cadenceGarde([]),
    'poignet-sur ne change PAS la cadence de Garde : il n y touche plus du tout');
  // 5) le libellé affiché au joueur DIT LA VÉRITÉ, et le dira encore si les constantes
  //    bougent : il est dérivé du moteur, jamais recopié à la main.
  assert.equal(tournee.BONUS_RUN['poignet-sur'].desc,
    `La Garde de toute l’équipe bloque −${Math.round(arene.GARDE_MAITRISEE * 100)} % au lieu de −${Math.round(arene.GARDE_REDUCTION * 100)} %`,
    'le libellé de Poignet Sûr est dérivé des constantes du moteur');
  // Le plancher de cooldown reste, lui, la garantie MOTEUR de l invariant (§A9).
  const cGardeStd = arene.creerCombat(['pasteka'], ['classico'], 1);
  arene.jouerRound(cGardeStd, 'garde', rngFixe, 0);
  assert.equal(cGardeStd.equipes.a[0].gardeCooldown, arene.GARDE_COOLDOWN + 1, 'standard : cooldown 2+1');

  // --- 🗺️ Marque d'Ouverture : la 1ère action qui touche pose la marque (même attaque de base)
  const cOuvertAvec = arene.creerCombat(['boba'], ['pasteka'], 1);
  tournee.appliquerBonusRun(cOuvertAvec, ['marque-ouverture']);
  arene.jouerRound(cOuvertAvec, 0, () => 0.2, 0);
  // 🔁 MIGRATION (mission 2) — `.givre` → `aStatut(c, 'givre')`, dans les deux sens
  // (présence ET absence de la marque) : c'est le même booléen que rendait le pont.
  assert.equal(arene.aStatut(cOuvertAvec.equipes.b[0], 'givre'), true, 'marque-ouverture : boba (milk) GIVRE dès la 1ère attaque');
  assert.equal(cOuvertAvec.equipes.a[0].marqueOuvertureDispo, false, 'marque-ouverture : consommée');
  const cOuvertSans = arene.creerCombat(['boba'], ['pasteka'], 1);
  arene.jouerRound(cOuvertSans, 0, () => 0.2, 0);
  assert.equal(arene.aStatut(cOuvertSans.equipes.b[0], 'givre'), false, 'sans le bonus : l attaque de base ne pose pas de marque');

  // --- 🗺️ PV max de run (soins + lobby) : niveaux + talents + objets + outsider --------
  const pvMaxRun = tournee.pvMaxEquipeRun(['boba'], {}, {}, { boba: ['pv_pct'] });
  const pvMaxRunSans = tournee.pvMaxEquipeRun(['boba'], {}, {}, {});
  assert.ok(pvMaxRun.boba > pvMaxRunSans.boba, 'pvMaxEquipeRun : le talent pv_pct est compté');

  // --- 🗺️ Soin de run (Thé Revigorant) : K.O. relevé à 30 %, vivant +30 %, plafonné ----
  const soignes = tournee.soignerRun({ a: 0, b: 20 }, { a: 100, b: 80, c: 100 });
  assert.equal(soignes.a, 30, 'soignerRun : K.O. relevé à exactement 30 %');
  assert.equal(soignes.b, 44, 'soignerRun : vivant +30 % des PV max');
  assert.equal(soignes.c, 100, 'soignerRun : carte en pleine forme plafonnée à pvMax');

  // --- 🗺️ Report des PV : clamp, actif = 1er debout, équipe K.O. = défaite -------------
  const cReport = arene.creerCombat(['boba', 'classico', 'theo'], ['pasteka'], 1);
  tournee.appliquerPvReportes(cReport, { boba: 0, classico: 10 });
  assert.equal(cReport.equipes.a[0].pv, 0, 'pvReportes : boba reste K.O.');
  assert.equal(cReport.equipes.a[1].pv, 10, 'pvReportes : classico à 10 PV');
  assert.equal(cReport.equipes.a[2].pv, cReport.equipes.a[2].pvMax, 'absent des pvReportes = pleine forme');
  assert.equal(cReport.actifs.a, 1, 'l actif passe au premier combattant debout');
  const cReportKo = arene.creerCombat(['boba'], ['pasteka'], 1);
  tournee.appliquerPvReportes(cReportKo, { boba: 0 });
  assert.equal(cReportKo.fini, true, 'équipe entièrement K.O. = défaite');
  assert.equal(cReportKo.vainqueur, 'b');

  // --- 🗺️ Cycle de run : victoire → draft → bonus → fin -------------------------------
  const run1 = tournee.runApresVictoire(runVierge, { boba: 40 });
  assert.equal(run1.etape, 2, 'victoire : étape +1');
  assert.equal(run1.victoires, 1, 'victoire : score +1');
  assert.deepEqual(run1.pvReportes, { boba: 40 }, 'victoire : PV reportés');
  assert.equal(run1.draftEnAttente, true, 'victoire : draft ouvert');
  const run2 = tournee.runApresBonus(run1, draft1[0]);
  assert.deepEqual(run2.bonus, [draft1[0]], 'bonus cumulé');
  assert.equal(run2.draftEnAttente, false, 'draft refermé');
  const fin1 = tournee.finirRun({ ...tournee.TOURNEE_VIERGE, reclames: [], record: 5, run: { ...run2, victoires: 3 } });
  assert.equal(fin1.score, 3, 'finirRun : score = victoires de la run');
  assert.equal(fin1.nouveau, false, 'pas de record (3 < 5)');
  assert.equal(fin1.suivi.record, 5, 'record conservé');
  assert.equal(fin1.suivi.run, null, 'run effacée');
  const fin2 = tournee.finirRun({ ...tournee.TOURNEE_VIERGE, reclames: [], record: 2, run: { ...run2, victoires: 7 } });
  assert.equal(fin2.nouveau, true, 'nouveau record détecté');
  assert.equal(fin2.suivi.record, 7, 'record monté');

  // --- 🗺️ Migration du suivi : additive, tolérante, record jamais purgé ---------------
  assert.deepEqual(
    tournee.migrerTournee(undefined),
    { semaine: '', victoiresSemaine: 0, reclames: [], record: 0, run: null },
    'migrerTournee : absent → vierge',
  );
  const migreSale = tournee.migrerTournee({
    semaine: '2026-S29', victoiresSemaine: 7.9, reclames: [0, 2, 99, 'x'], record: 12,
    run: { semaine: '2026-S30', etape: 4.7, victoires: 3, bonus: ['sirop-atk', 'bidon'], pvReportes: { boba: 33.6, mauvais: 'x' }, draftEnAttente: 1 },
  });
  assert.equal(migreSale.victoiresSemaine, 7, 'migrerTournee : compteur assaini');
  assert.deepEqual(migreSale.reclames, [0, 2], 'migrerTournee : paliers invalides filtrés');
  assert.equal(migreSale.record, 12, 'migrerTournee : record conservé');
  assert.equal(migreSale.run.etape, 4, 'migrerTournee : étape assainie');
  assert.deepEqual(migreSale.run.bonus, ['sirop-atk'], 'migrerTournee : bonus inconnus filtrés');
  assert.deepEqual(migreSale.run.pvReportes, { boba: 34 }, 'migrerTournee : PV arrondis, entrées sales ignorées');
  assert.equal(migreSale.run.draftEnAttente, false, 'migrerTournee : flag non booléen → false');

  // --- 📈 Infini tendu : paliers de descente 6 → 5 → 4 --------------------------
  const pal = shooter.creerPartieInfini(() => 0.5);
  assert.equal(pal.tirsParDescente, 6, 'infini : 6 tirs par descente au départ');
  assert.equal(pal.descentes, 0, 'infini : aucune descente au départ');
  const lanceurPal = { x: shooter.LARGEUR_TERRAIN / 2, y: shooter.LIGNE_LIMITE * shooter.LIGNE_H + 1.6 };
  const attenduPaliers = [6, 6, 5, 5, 5, 5, 5, 4, 4];
  for (let i = 0; i < attenduPaliers.length; i++) {
    // plateau réduit à une ligne vide : le tir vertical se pose au plafond, sans match
    pal.grille = [{ decalee: false, cases: Array.from({ length: shooter.COLS }, () => null) }];
    pal.fever = 0;
    pal.chaine = 0;
    pal.tirs = pal.tirsParDescente - 1;
    const resPal = shooter.tirer(pal, lanceurPal, -Math.PI / 2, () => 0.5);
    assert.ok(resPal && resPal.nouvelleLigne, `descente ${i + 1} déclenchée`);
    assert.equal(pal.descentes, i + 1, `compteur de descentes = ${i + 1}`);
    assert.equal(pal.tirsParDescente, attenduPaliers[i], `palier après descente ${i + 1}`);
  }

  // --- 📈 Les niveaux Aventure gardent leur cadence de descente fixe ------------
  // L'INVARIANT testé ici est « pas de paliers en Aventure, contrairement à l'Infini » :
  // la cadence ne doit pas bouger après une descente. On la DÉRIVE de paramsNiveau au
  // lieu de la figer, sinon tout rééquilibrage de la descente casse ce test sans que la
  // propriété testée soit en cause (c'est arrivé le 26/07 avec la cadence 'nettoyer').
  const NV_CADENCE = 12;
  const cadenceAttendue = shooter.paramsNiveau(NV_CADENCE).tirsParDescente;
  const nvCadence = shooter.creerNiveau(NV_CADENCE);
  assert.equal(nvCadence.tirsParDescente, cadenceAttendue, `niveau ${NV_CADENCE} : cadence conforme à paramsNiveau`);
  nvCadence.grille = [{ decalee: false, cases: Array.from({ length: shooter.COLS }, () => null) }];
  nvCadence.tirs = nvCadence.tirsParDescente - 1;
  const resCad = shooter.tirer(nvCadence, lanceurPal, -Math.PI / 2, () => 0.5);
  assert.ok(resCad && resCad.nouvelleLigne, 'niveau : descente déclenchée');
  assert.equal(nvCadence.descentes, 1, 'niveau : descente comptée');
  assert.equal(nvCadence.tirsParDescente, cadenceAttendue, 'niveau : cadence inchangée (pas de paliers)');

  // --- 🩹 26/07 — « nettoyer » : descente DEUX FOIS plus lente -------------------
  // L'objectif « vide le plateau » demandait d'effacer ~44 perles en 19 tirs pendant que
  // la descente en rajoutait 8 toutes les 6 rangées : hors d'atteinte. Cadence doublée.
  for (const n of [8, 12, 16, 24, 28, 32]) {
    const p = shooter.paramsNiveau(n);
    if (p.objectif.type !== 'nettoyer' || p.tirsParDescente === 0) continue;
    const voisin = [n - 1, n + 1].map((m) => shooter.paramsNiveau(m))
      .find((q) => q.objectif.type !== 'nettoyer' && q.tirsParDescente > 0);
    if (voisin) {
      assert.ok(p.tirsParDescente >= voisin.tirsParDescente * 2,
        `niveau ${n} (nettoyer) : descente au moins deux fois plus lente qu'un niveau voisin`);
    }
  }

  // --- 👑 Boss incarné : rotation déterministe des légendaires ------------------
  assert.equal(shooter.bossPersonnage(5), 'bubble-master', 'boss du niveau 5');
  assert.equal(shooter.bossPersonnage(10), 'brown-sugar-king', 'boss du niveau 10');
  assert.equal(shooter.bossPersonnage(30), 'caramel-chef', 'boss du niveau 30');
  assert.equal(shooter.bossPersonnage(35), 'bubble-master', 'la rotation des boss boucle');

  // ==================== 🎁 PACK 5a — butin de consommables ====================

  // Probabilités de butin (pures, valeurs exactes)
  assert.equal(economie.SAC_MAX_CONSO, 5, 'plafond de sac = 5 par consommable');
  assert.equal(economie.probaButinNiveau(1, false, true), 0.2, '1★ première = 20 %');
  assert.equal(economie.probaButinNiveau(3, true, true), 0.9, '3★ boss première = 90 % (plafond)');
  assert.ok(Math.abs(economie.probaButinNiveau(3, false, true) - 0.6) < 1e-12, '3★ non-boss première = 60 %');
  assert.equal(economie.probaButinNiveau(1, false, false), 0.1, 'rejeu 1★ = 10 % (moitié)');
  assert.equal(economie.probaButinInfini(499), 0, 'infini < 500 : jamais de butin');
  assert.equal(economie.probaButinInfini(500), 0.25, 'infini 500 = 25 %');
  assert.equal(economie.probaButinInfini(1000), 0.5, 'infini 1000 = 50 %');

  // Tirage pondéré : avec une suite déterministe, reste toujours dans le catalogue
  let graineButin = 42;
  const rngButin = () => { graineButin = (graineButin * 1103515245 + 12345) % 2147483648; return graineButin / 2147483648; };
  const butinsVus = new Set();
  for (let i = 0; i < 60; i++) butinsVus.add(economie.tirerButinConso(rngButin));
  for (const id of butinsVus) assert.ok(economie.CONSOMMABLE_IDS.includes(id), `butin hors catalogue : ${id}`);
  assert.ok(butinsVus.size >= 2, 'le tirage de butin varie');
  assert.equal(economie.BUTIN_CONSO_PODS.reduce((s, p) => s + p.poids, 0), 100, 'poids de butin sur 100');

  // ==================== 🤝 PACK 5b — offres du comptoir de troc ====================

  // Déterminisme : 2 appels le même jour = mêmes offres profondes, sur plusieurs jours
  const ctxTroc = {
    doublons: [{ id: 'boba', rarete: 'commun' }, { id: 'passion', rarete: 'rare' }],
    manquants: [{ id: 'jelly', rarete: 'epique' }, { id: 'citro', rarete: 'rare' }, { id: 'taro-queen', rarete: 'legendaire' }],
  };
  for (let i = 1; i <= 5; i++) {
    const j = `2026-07-${String(19 + i).padStart(2, '0')}`;
    assert.deepEqual(
      economie.offresTrocDuJour(j, ctxTroc),
      economie.offresTrocDuJour(j, ctxTroc),
      `offres du ${j} déterministes`,
    );
  }
  const offresEx = economie.offresTrocDuJour('2026-07-20', ctxTroc);
  assert.equal(offresEx.length, 3, 'toujours 3 offres');
  assert.deepEqual(offresEx.map((o) => o.id), ['sam', 'fonte', 'ressource'], 'ids stables sam/fonte/ressource');
  assert.equal(offresEx[0].type, 'sam');
  assert.equal(offresEx[1].type, 'fonte');
  assert.equal(offresEx[2].type, 'ressource');

  // Sam-carte : jamais de rareté supérieure au doublon tant qu'une candidate ≤ existe.
  // Doublon commun + manquantes commun/épique → il offre TOUJOURS la commune (rareté égale).
  const ctxEgal = {
    doublons: [{ id: 'boba', rarete: 'commun' }],
    manquants: [{ id: 'classico', rarete: 'commun' }, { id: 'jelly', rarete: 'epique' }],
  };
  for (let i = 1; i <= 20; i++) {
    const sam = economie.offresTrocDuJour(`2026-08-${String(i).padStart(2, '0')}`, ctxEgal)[0];
    assert.equal(sam.sam.kind, 'sam-carte');
    assert.equal(sam.sam.veut, 'boba', 'Sam veut le seul doublon');
    assert.equal(sam.sam.offre, 'classico', 'rareté égale préférée à une supérieure');
  }
  // Fallback : doublon épique, aucune épique manquante → la rare la plus proche (STRICTEMENT inférieure)
  const ctxInferieur = {
    doublons: [{ id: 'jelly', rarete: 'epique' }],
    manquants: [{ id: 'boba', rarete: 'commun' }, { id: 'citro', rarete: 'rare' }],
  };
  for (let i = 1; i <= 20; i++) {
    const sam = economie.offresTrocDuJour(`2026-09-${String(i).padStart(2, '0')}`, ctxInferieur)[0];
    assert.equal(sam.sam.offre, 'citro', 'fallback : rareté inférieure la plus proche');
  }

  // Collection complète : Sam paie en ressources, montants exacts par rareté
  const jourFixe = '2026-07-20';
  assert.deepEqual(
    economie.offresTrocDuJour(jourFixe, { doublons: [{ id: 'boba', rarete: 'commun' }], manquants: [] })[0].sam,
    { kind: 'sam-ressource', veut: 'boba', capsule: null, perles: 120, eclats: 0 },
    'collection complète, doublon commun → 120 perles',
  );
  assert.deepEqual(
    economie.offresTrocDuJour(jourFixe, { doublons: [{ id: 'citro', rarete: 'rare' }], manquants: [] })[0].sam,
    { kind: 'sam-ressource', veut: 'citro', capsule: 'classique', perles: 0, eclats: 0 },
    'rare → capsule classique',
  );
  assert.deepEqual(
    economie.offresTrocDuJour(jourFixe, { doublons: [{ id: 'jelly', rarete: 'epique' }], manquants: [] })[0].sam,
    { kind: 'sam-ressource', veut: 'jelly', capsule: 'classique', perles: 0, eclats: 20 },
    'épique → capsule classique + 20 éclats',
  );
  assert.deepEqual(
    economie.offresTrocDuJour(jourFixe, { doublons: [{ id: 'taro-queen', rarete: 'legendaire' }], manquants: [] })[0].sam,
    { kind: 'sam-ressource', veut: 'taro-queen', capsule: 'doree', perles: 0, eclats: 0 },
    'légendaire → capsule dorée',
  );

  // Migration tolérante du champ persisté trocJour (v1 → v2)
  const auj = economie.cleJour();
  assert.deepEqual(economie.migrerTrocJour({ jour: auj, fait: true }), { jour: auj, faits: ['sam'] }, 'v1 fait aujourd\'hui → sam marqué');
  assert.deepEqual(economie.migrerTrocJour({ jour: auj, fait: false }), { jour: auj, faits: [] }, 'v1 pas fait → rien de marqué');
  assert.deepEqual(economie.migrerTrocJour({ jour: '2020-01-01', fait: true }), { jour: '', faits: [] }, 'v1 d\'un autre jour → reset');
  assert.deepEqual(economie.migrerTrocJour({ jour: auj, faits: ['sam', 'bidon', 3, 'sam'] }), { jour: auj, faits: ['sam'] }, 'v2 : ids invalides filtrés, doublons dédupliqués');
  assert.deepEqual(economie.migrerTrocJour(undefined), { jour: '', faits: [] }, 'absent → vierge');
  assert.deepEqual(economie.migrerTrocJour('sale'), { jour: '', faits: [] }, 'forme inconnue → vierge');

  // ==================== 🏪 PACK 5 — STORE (modules natifs mockés) ====================
  // Le store importe react (useSyncExternalStore) et AsyncStorage : en node on
  // compile à part (rootDir src, alias @/) et on injecte des doubles via
  // Module._resolveFilename — le code de l'app n'est pas touché.
  global.__DEV__ = true; // le store lit __DEV__ (resetBobaQuest, warn sauvegarde)
  fs.writeFileSync(path.join(sortie, 'shims.d.ts'), 'declare var __DEV__: boolean;\ndeclare var console: { warn: (...a: any[]) => void };\n');
  fs.writeFileSync(path.join(sortie, 'tsconfig-store.json'), JSON.stringify({
    compilerOptions: {
      outDir: sortie,
      rootDir: path.join(racine, 'src'),
      module: 'commonjs',
      moduleResolution: 'node',
      target: 'es2020',
      esModuleInterop: true,
      skipLibCheck: true,
      strict: false,
      types: [],
      lib: ['es2020'],
      baseUrl: path.join(racine, 'src'),
      paths: { '@/*': ['./*'] },
    },
    files: [path.join(racine, 'src/store/jeu.ts'), path.join(sortie, 'shims.d.ts')],
  }));
  execFileSync(path.join(racine, 'node_modules', '.bin', 'tsc'), ['-p', path.join(sortie, 'tsconfig-store.json')], { cwd: racine, stdio: 'pipe' });
  fs.writeFileSync(path.join(sortie, 'mock-react.js'), 'exports.useSyncExternalStore = function (sub, get) { return get(); };\n');
  fs.writeFileSync(path.join(sortie, 'mock-async-storage.js'), [
    'const mem = new Map();',
    'module.exports = {',
    '  getItem: async (k) => (mem.has(k) ? mem.get(k) : null),',
    '  setItem: async (k, v) => { mem.set(k, String(v)); },',
    '  removeItem: async (k) => { mem.delete(k); },',
    '};',
    '',
  ].join('\n'));
  const ModuleNode = require('node:module');
  const resoudreOrigine = ModuleNode._resolveFilename;
  ModuleNode._resolveFilename = function (request, ...rest) {
    if (request === 'react') return path.join(sortie, 'mock-react.js');
    if (request === '@react-native-async-storage/async-storage') return path.join(sortie, 'mock-async-storage.js');
    if (request.startsWith('@/')) return path.join(sortie, request.slice(2) + '.js');
    return resoudreOrigine.call(this, request, ...rest);
  };
  const store = require(path.join(sortie, 'store', 'jeu.js'));
  // 💾 LE CONTRAT LE PLUS IMPORTANT DE LA SAUVEGARDE SERVEUR, vérifié ici et nulle part
  // ailleurs : au tout premier instant, la lecture d'AsyncStorage est encore EN COURS.
  // Tant qu'elle ne l'est plus, le store refuse de livrer un instantané — sinon
  // `lib/sauvegarde-jeu.ts` pousserait un état PAR DÉFAUT par-dessus la sauvegarde
  // serveur d'un joueur qui a six semaines de jeu. Cette assertion doit rester la
  // PREMIÈRE chose faite après le require : après le premier resetBobaQuest(), la
  // question ne se pose plus.
  assert.equal(store.instantaneEtat(), null,
    'hydratation en cours : aucun instantané, donc rien à pousser au serveur');
  const etatCourant = () => store.useBobaQuest(); // mock synchrone → état interne
  const STATS = { score: 1200, eclatees: 0, orphelines: 0, capsulesLiberees: 0, meilleurGroupe: 0, chaineMax: 0 };

  // — gagnerConsommable : plafond 5 + conversion exacte en perles —
  store.resetBobaQuest();
  assert.deepEqual(store.gagnerConsommable('potion', 4), { ajoute: 4, convertisPerles: 0 }, '4 potions ajoutées');
  assert.deepEqual(store.gagnerConsommable('potion', 3), { ajoute: 1, convertisPerles: 240 }, 'excédent : 1 ajoutée, 2 × 120 perles (240/2)');
  assert.equal(etatCourant().consommables.potion, 5, 'sac plafonné à 5');
  assert.equal(etatCourant().perles, 240, 'remboursement crédité directement');

  // — acheterConsommable : refus au plafond, perles non débitées —
  etatCourant().perles = 1000;
  assert.equal(store.acheterConsommable('potion'), false, 'boutique : achat refusé au plafond');
  assert.equal(etatCourant().perles, 1000, 'perles non débitées au refus');
  assert.equal(etatCourant().consommables.potion, 5, 'stock inchangé au refus');
  assert.equal(store.acheterConsommable('reveil'), true, 'achat sous le plafond accepté');
  assert.equal(etatCourant().perles, 840, 'prix boutique débité');

  // — terminerNiveau : butin forcé / refusé via rng injecté —
  store.resetBobaQuest();
  const vicButin = store.terminerNiveau(1, 3, false, STATS, () => 0.01);
  assert.ok(vicButin.butin, 'rng bas : butin forcé');
  assert.ok(economie.CONSOMMABLE_IDS.includes(vicButin.butin.id), 'butin du catalogue');
  assert.equal(vicButin.butin.ajoute, 1, 'sac vide : 1 ajouté');
  assert.equal(etatCourant().consommables[vicButin.butin.id], 1, 'butin crédité dans le sac');
  const vicSans = store.terminerNiveau(2, 3, false, STATS, () => 0.99);
  assert.equal(vicSans.butin, null, 'rng haut : pas de butin');
  // plafond respecté : sac plein → tout est converti au tarif exact
  for (const id of economie.CONSOMMABLE_IDS) store.gagnerConsommable(id, 5);
  const vicPlein = store.terminerNiveau(3, 3, true, STATS, () => 0.01); // rng 0.01 → 1er pod = potion
  assert.ok(vicPlein.butin, 'boss 3★ première : butin forcé');
  assert.equal(vicPlein.butin.id, 'potion', 'rng figé → potion');
  assert.equal(vicPlein.butin.ajoute, 0, 'sac plein : rien ajouté');
  assert.equal(vicPlein.butin.convertisPerles, 120, 'converti au tarif exact (240/2)');
  assert.equal(etatCourant().consommables.potion, 5, 'plafond jamais dépassé');

  // — finPartieInfini : idem, avec seuil de score —
  store.resetBobaQuest();
  const infButin = store.finPartieInfini({ ...STATS, score: 800 }, () => 0.01);
  assert.ok(infButin.butin, 'infini ≥ 500 : butin possible');
  assert.equal(infButin.butin.id, 'potion', 'rng figé → potion');
  assert.equal(infButin.butin.ajoute, 1, 'sac vide : 1 ajouté');
  assert.equal(store.finPartieInfini({ ...STATS, score: 800 }, () => 0.99).butin, null, 'rng haut : pas de butin');
  assert.equal(store.finPartieInfini({ ...STATS, score: 300 }, () => 0.01).butin, null, 'score < 500 : jamais de butin même rng bas');

  // — realiserOffreTroc : SAM —
  store.resetBobaQuest();
  etatCourant().collection = { boba: 3 };
  const offresJ = store.offresTrocAujourdhui();
  const samJ = offresJ.find((o) => o.id === 'sam');
  assert.equal(samJ.sam.veut, 'boba', 'Sam veut le seul doublon');
  assert.equal(samJ.sam.kind, 'sam-carte', 'collection incomplète → troc carte');
  assert.ok(samJ.faisable.ok && !samJ.fait, 'sam faisable au départ');
  const rSam = store.realiserOffreTroc('sam');
  assert.ok(rSam?.ok, 'troc sam réalisé');
  assert.equal(etatCourant().collection.boba, 2, 'doublon consommé, vitrine épargnée');
  assert.equal(etatCourant().collection[samJ.sam.offre], 1, 'carte manquante reçue');
  assert.equal(store.realiserOffreTroc('sam'), null, 'même offre 2× le même jour = refus');
  // refus si ×1 (dernier exemplaire)
  store.resetBobaQuest();
  etatCourant().collection = { boba: 1 };
  const offresX1 = store.offresTrocAujourdhui();
  assert.equal(offresX1.find((o) => o.id === 'sam').faisable.ok, false, '×1 : non faisable');
  assert.equal(store.realiserOffreTroc('sam'), null, 'refus : la vitrine n\'est jamais troquée');
  assert.equal(etatCourant().collection.boba, 1, 'exemplaire vitrine intact');

  // — realiserOffreTroc : FONTE (rareteMin/nb dépendent de la seed du jour) —
  store.resetBobaQuest();
  etatCourant().collection = { boba: 3, classico: 2, theo: 2, citro: 2, passion: 2, jelly: 2, coco: 2, nuage: 1 };
  const fonteJ = store.offresTrocAujourdhui().find((o) => o.id === 'fonte');
  assert.ok(fonteJ.faisable.ok, 'fonte faisable avec assez de doublons');
  const bonnes = fonteJ.rareteMin === 'epique' ? ['jelly', 'coco'] : ['citro', 'passion', 'jelly'];
  const mauvaiseRarete = fonteJ.rareteMin === 'epique' ? 'citro' : 'boba';
  assert.equal(store.realiserOffreTroc('fonte', { cartes: [mauvaiseRarete, ...bonnes.slice(1)] }), null, 'fonte : rareté trop basse refusée');
  assert.equal(store.realiserOffreTroc('fonte', { cartes: ['nuage', ...bonnes.slice(1)] }), null, 'fonte : ×1 (vitrine) refusée');
  assert.equal(store.realiserOffreTroc('fonte', { cartes: [bonnes[0], bonnes[0], ...bonnes.slice(2)] }), null, 'fonte : cartes non distinctes refusées');
  assert.equal(store.realiserOffreTroc('fonte', { cartes: bonnes.slice(0, bonnes.length - 1) }), null, 'fonte : sélection incomplète refusée');
  assert.equal(etatCourant().collection.citro, 2, 'aucun compteur consommé après refus');
  const capAvant = { classique: etatCourant().capsulesGratuites, doree: etatCourant().capsulesDoreesGratuites };
  const rFonte = store.realiserOffreTroc('fonte', { cartes: bonnes });
  assert.ok(rFonte?.ok, 'fonte réalisée');
  for (const cid of bonnes) assert.equal(etatCourant().collection[cid], 1, `${cid} : 1 doublon consommé`);
  if (fonteJ.capsule === 'doree') assert.equal(etatCourant().capsulesDoreesGratuites, capAvant.doree + 1, 'capsule dorée créditée');
  else assert.equal(etatCourant().capsulesGratuites, capAvant.classique + 1, 'capsule classique créditée');
  assert.equal(store.realiserOffreTroc('fonte', { cartes: bonnes }), null, 'fonte 2× le même jour = refus');

  // — realiserOffreTroc : RESSOURCE (variante du jour dépend de la seed) —
  store.resetBobaQuest();
  const resJ = store.offresTrocAujourdhui().find((o) => o.id === 'ressource');
  assert.equal(resJ.faisable.ok, false, 'sans ressources : non faisable');
  if (resJ.donne.type === 'eclats') {
    assert.equal(store.realiserOffreTroc('ressource'), null, 'refus sans assez d\'éclats');
    etatCourant().eclats = resJ.donne.n;
    const capA = etatCourant().capsulesGratuites;
    const rRes = store.realiserOffreTroc('ressource');
    assert.ok(rRes?.ok, 'troc éclats réalisé');
    assert.equal(etatCourant().eclats, 0, 'éclats débités');
    assert.equal(etatCourant().capsulesGratuites, capA + 1, 'capsule classique créditée');
    assert.equal(store.realiserOffreTroc('ressource'), null, 'ressource 2× le même jour = refus');
  } else {
    etatCourant().consommables = { potion: 4, piment: 4 };
    assert.equal(store.realiserOffreTroc('ressource', { consos: ['potion'] }), null, 'compte incomplet refusé');
    assert.equal(store.realiserOffreTroc('ressource', { consos: Array(resJ.donne.n).fill('reveil') }), null, 'stock insuffisant refusé');
    const consos = ['potion', 'potion', 'potion', 'piment', 'piment', 'piment'].slice(0, resJ.donne.n);
    const capA2 = etatCourant().capsulesGratuites;
    const rRes = store.realiserOffreTroc('ressource', { consos });
    assert.ok(rRes?.ok, 'troc consommables réalisé');
    assert.equal(etatCourant().consommables.potion, 4 - consos.filter((c) => c === 'potion').length, 'potions débitées');
    assert.equal(etatCourant().consommables.piment, 4 - consos.filter((c) => c === 'piment').length, 'piments débités');
    if (resJ.recoit.type === 'capsule') assert.equal(etatCourant().capsulesGratuites, capA2 + 1, 'capsule classique créditée');
    else assert.equal(etatCourant().eclats, resJ.recoit.eclats, 'éclats crédités');
    assert.equal(store.realiserOffreTroc('ressource', { consos }), null, 'ressource 2× le même jour = refus');
  }

  // — reset lazy au jour suivant : le comptoir se rouvre —
  etatCourant().trocJour = { jour: '2020-01-01', faits: ['sam', 'fonte', 'ressource'] };
  etatCourant().collection = { boba: 3 };
  const rLendemain = store.realiserOffreTroc('sam');
  assert.ok(rLendemain?.ok, 'jour changé : l\'offre redevient faisable (reset lazy)');
  assert.deepEqual(etatCourant().trocJour, { jour: economie.cleJour(), faits: ['sam'] }, 'faits du jour réinitialisés puis marqués');

  // — 🎁 Rythme capsules aventure : classique tous les 3 niveaux, dorée au boss —
  assert.equal(economie.capsuleDuNiveau(1, false), null, 'niveau 1 : pas de capsule');
  assert.equal(economie.capsuleDuNiveau(3, false), 'classique', 'multiple de 3 : classique');
  assert.equal(economie.capsuleDuNiveau(5, true), 'doree', 'boss : dorée');
  assert.equal(economie.capsuleDuNiveau(15, true), 'doree', 'boss ET multiple de 3 : dorée (la meilleure)');
  assert.equal(economie.capsuleDuNiveau(6, false), 'classique', 'niveau 6 : classique');
  assert.equal(economie.capsuleDuNiveau(7, false), null, 'niveau 7 : pas de capsule');
  assert.equal(economie.prochaineCapsuleNiveau(1), 3, 'après le 1 : capsule au 3');
  assert.equal(economie.prochaineCapsuleNiveau(3), 5, 'après le 3 : boss du 5');
  assert.equal(economie.prochaineCapsuleNiveau(5), 6, 'après le boss 5 : capsule au 6');
  assert.equal(economie.prochaineCapsuleNiveau(14), 15, 'après le 14 : boss du 15');
  assert.equal(economie.prochaineCapsuleNiveau(15), 18, 'après le 15 : capsule au 18');

  // — terminerNiveau : 1ʳᵉ réussite sans capsule → prime d'exploration +60 —
  store.resetBobaQuest();
  const p0 = etatCourant().perles;
  const vic11 = store.terminerNiveau(11, 3, false, STATS, () => 0.99);
  assert.equal(vic11.capsule, null, 'niveau 11 : plus de capsule automatique');
  assert.equal(etatCourant().capsulesGratuites, 0, 'aucune capsule créditée');
  assert.equal(etatCourant().perles, p0 + vic11.perlesGagnees + economie.NIVEAU_PRIME_EXPLORATION, 'prime +60 créditée hors perlesGagnees');
  const vic12 = store.terminerNiveau(12, 3, false, STATS, () => 0.99);
  assert.equal(vic12.capsule, 'classique', 'niveau 12 (multiple de 3) : capsule conservée');
  assert.equal(etatCourant().capsulesGratuites, 1, 'capsule classique créditée');
  const p1 = etatCourant().perles;
  const vic13 = store.terminerNiveau(13, 3, false, STATS, () => 0.99);
  assert.equal(vic13.capsule, null, 'niveau 13 : pas de capsule');
  assert.equal(etatCourant().perles, p1 + vic13.perlesGagnees + economie.NIVEAU_PRIME_EXPLORATION, 'prime +60 à nouveau');
  const vic11bis = store.terminerNiveau(11, 3, false, STATS, () => 0.99);
  assert.equal(vic11bis.capsule, null, 'rejeu : pas de capsule');
  assert.equal(vic11bis.premiere, false, 'rejeu détecté');
  const p2 = etatCourant().perles;
  const vic13re = store.terminerNiveau(13, 3, false, STATS, () => 0.99);
  assert.equal(etatCourant().perles, p2 + vic13re.perlesGagnees, 'rejeu : perles du niveau seules, aucune prime');

  // — 💰 Prix capsules rééquilibrés (700/2000) + remboursements doublons ajustés —
  assert.equal(economie.CAPSULES.classique.cout, 700, 'classique passée à 700');
  assert.equal(economie.CAPSULES.doree.cout, 2000, 'dorée passée à 2000');
  assert.deepEqual(economie.DOUBLON_PERLES, { commun: 90, rare: 220, epique: 500, legendaire: 800 }, 'remboursements ajustés');

  store.resetBobaQuest();
  etatCourant().perles = 700;
  assert.ok(store.ouvrirCapsule('classique', false), 'capsule payante ouverte à 700');
  assert.equal(etatCourant().perles, 0, '700 perles débitées exactement');
  assert.equal(store.ouvrirCapsule('classique', false), null, 'refus net sans assez de perles');

  // doublon épique → remboursement exact de 500 (pity forcé + toutes les épiques possédées)
  store.resetBobaQuest();
  etatCourant().perles = 1000;
  etatCourant().collection = { popping: 1, jelly: 1, mochito: 1, coco: 1, pudding: 1, nuage: 1 };
  etatCourant().pity = { epique: economie.PITY_EPIQUE - 1, legendaire: 0 };
  // 🩹 26/07 — rng INJECTÉ. Sans lui ce test était un tirage au sort (4 échecs sur 8) :
  // la garantie « épique-ou-mieux » puise dans les 12 cartes épique+légendaire, donc elle
  // peut rendre un légendaire — non possédé, donc pas un doublon. 0.95 tombe sur épique
  // au tirage naturel (62+26 = 88 < 95 ≤ 97).
  const tirage = store.ouvrirCapsule('classique', false, () => 0.95);
  assert.equal(tirage && tirage.collectible.rarete, 'epique', 'pity : rareté épique déterministe');
  assert.ok(tirage && tirage.doublon, 'épique forcé au pity = doublon (toutes possédées)');
  assert.equal(tirage.perlesRendues, 500, 'remboursement doublon épique = 500');
  assert.equal(etatCourant().perles, 1000 - 700 + 500, 'débit 700 puis remboursement 500');

  // ============ 🧋 LA GORGÉE FRAÎCHE — récompenser une VRAIE visite ============
  // Le compteur `fidelite_cloud.tampons` est INTRA-carte (« n/9 ») : il retombe à 0 à
  // chaque carte remplie. Le total monotone est `cartes_completees × 9 + tampons`.
  assert.equal(economie.TAMPONS_PAR_CARTE, 9, 'une carte = 9 tampons');
  assert.equal(economie.totalTamponsMonotone(4, 0), 4, 'total : première carte');
  assert.equal(economie.totalTamponsMonotone(0, 1), 9, 'total : carte remplie, compteur retombé à 0');
  assert.equal(economie.totalTamponsMonotone(3, 2), 21, 'total : 2 cartes + 3 tampons');
  assert.equal(economie.totalTamponsMonotone(null, undefined), 0, 'total : valeurs sales → 0');
  assert.equal(economie.totalTamponsMonotone('5', '1'), 14, 'total : chaînes tolérées');

  // Part imputable aux PRIX DU JEU : seules les demandes `appliquee` comptent.
  const demandes = [
    { type: 'tampon', quantite: 2, tampons_bonus: 0, statut: 'appliquee' },
    { type: 'tampon', quantite: 1, tampons_bonus: 0, statut: 'en_attente' }, // pas encore honorée
    { type: 'boisson', quantite: 1, tampons_bonus: 3, statut: 'appliquee' }, // collection complète
    { type: 'reduction', quantite: 10, tampons_bonus: 0, statut: 'appliquee' }, // 0 tampon
  ];
  assert.equal(economie.tamponsIssusDuJeu(demandes), 5, 'tampons du jeu = 2 + 3 (bonus), en_attente exclue');
  assert.equal(economie.tamponsIssusDuJeu([]), 0, 'aucune demande → 0');

  // — Le premier constat CALIBRE et ne récompense jamais (anti-réinstallation) —
  const s0 = economie.SUIVI_TAMPONS_VIERGE;
  const s1 = economie.suiviApresConstat(s0, 47, 5);
  assert.equal(s1.amorce, true, 'premier constat : amorcé');
  assert.equal(s1.enAttente, 0, 'premier constat : AUCUNE récompense (sinon une réinstallation en offrirait 47)');
  assert.equal(s1.totalVu, 47, 'premier constat : total mémorisé');

  // — Un achat réel est détecté —
  const s2 = economie.suiviApresConstat(s1, 48, 5);
  assert.equal(s2.enAttente, 1, 'une boisson achetée = 1 en attente');
  // — Idempotence : re-constater le même total ne rajoute rien (poll de 15 s) —
  assert.equal(economie.suiviApresConstat(s2, 48, 5).enAttente, 1, 'poll répété : rien de plus');
  // — Un tampon GAGNÉ DANS LE JEU ne compte pas comme un achat —
  const s3 = economie.suiviApresConstat(s2, 50, 7);
  assert.equal(s3.enAttente, 1, 'hausse de 2 entièrement expliquée par le jeu → aucun achat');
  // — Mélange achat + tampon de jeu —
  const s4 = economie.suiviApresConstat(s3, 53, 8);
  assert.equal(s4.enAttente, 3, 'hausse 3 dont 1 du jeu → 2 achats de plus');
  // — Une BAISSE (carte remplie sans cartes_completees, correction caisse) n'offre rien —
  const s5 = economie.suiviApresConstat(s4, 2, 8);
  assert.equal(s5.enAttente, 3, 'baisse : rien offert');
  assert.equal(s5.totalVu, 53, 'baisse : on garde le maximum vu, jamais de régression');

  // — Ce que rapporte une visite —
  assert.equal(economie.gorgeePourBoissons(0), null, '0 boisson = aucun gain');
  const g1 = economie.gorgeePourBoissons(1);
  assert.equal(g1.capsulesDorees, 1, '1 boisson : 1 capsule dorée');
  assert.equal(g1.capsulesClassiques, 0, '1 boisson : pas de classique en plus');
  assert.equal(g1.perles, economie.GORGEE_FRAICHE.perles, 'perles de visite');
  const g3 = economie.gorgeePourBoissons(3);
  assert.equal(g3.capsulesClassiques, 2, '3 boissons : 2 classiques en plus');
  const g99 = economie.gorgeePourBoissons(99);
  assert.equal(g99.capsulesClassiques, economie.GORGEE_FRAICHE.maxCapsulesClassiques,
    'grosse commande : capsules bornées (pas de coffre-fort)');
  assert.equal(g99.capsulesDorees, 1, 'une seule dorée quelle que soit la commande');

  // — Le ×2 de visite : actif 24 h, puis expiré —
  const t0 = new Date('2026-07-26T12:00:00.000Z');
  const vApres = economie.visitesApresGorgee(economie.VISITES_VIERGES, t0);
  assert.equal(vApres.visites, 1, 'compteur de visites incrémenté');
  assert.equal(economie.multGorgee(vApres, t0), 2, '×2 actif juste après la visite');
  assert.equal(economie.heuresGorgeeRestantes(vApres, t0), economie.GORGEE_FRAICHE.heuresX2, '24 h restantes');
  const t23 = new Date(t0.getTime() + 23 * 3600e3);
  assert.equal(economie.multGorgee(vApres, t23), 2, '×2 encore actif à 23 h');
  const t25 = new Date(t0.getTime() + 25 * 3600e3);
  assert.equal(economie.multGorgee(vApres, t25), 1, '×2 expiré à 25 h');
  assert.equal(economie.heuresGorgeeRestantes(vApres, t25), 0, '0 h restante après expiration');
  assert.equal(economie.multGorgee(economie.VISITES_VIERGES, t0), 1, 'aucune visite → aucun bonus');

  // — Migrations tolérantes (champs ADDITIFS d'avant le 26/07) —
  assert.deepEqual(economie.migrerVisites(undefined), economie.VISITES_VIERGES, 'visites absentes → vierges');
  assert.deepEqual(economie.migrerVisites({ boostJusqua: 'nawak', visites: -3 }),
    { boostJusqua: '', visites: 0, derniereVisite: '' }, 'visites sales assainies');
  assert.deepEqual(economie.migrerSuiviTampons(null), economie.SUIVI_TAMPONS_VIERGE, 'suivi absent → vierge');
  assert.deepEqual(economie.migrerSuiviTampons({ amorce: 'oui', totalVu: 12.9, enAttente: -1 }),
    { amorce: false, totalVu: 12, totalJeuVu: 0, enAttente: 0 }, 'suivi sale assaini (amorce non-booléen = false)');

  // — Côté STORE : le crédit d'une visite —
  store.resetBobaQuest();
  const avantG = etatCourant();
  const perlesAvant = avantG.perles;
  const doreesAvant = avantG.capsulesDoreesGratuites;
  assert.equal(store.crediterGorgee(0), null, '0 boisson : rien crédité');
  const gain = store.crediterGorgee(2);
  assert.ok(gain, '2 boissons : gain crédité');
  assert.equal(etatCourant().capsulesDoreesGratuites, doreesAvant + 1, 'capsule dorée créditée');
  assert.equal(etatCourant().capsulesGratuites, 1, '2 boissons : 1 classique en plus');
  assert.equal(etatCourant().perles, perlesAvant + economie.GORGEE_FRAICHE.perles, 'perles créditées SANS multiplicateur');
  assert.equal(etatCourant().visites.visites, 1, 'visite comptée dans l’état du jeu');
  assert.ok(store.boostVisite(etatCourant()).actif, '×2 de visite actif après crédit');

  // — Une Tournée OFFERTE s'ajoute au quota du jour et se consomme en premier —
  store.resetBobaQuest();
  const quota = store.TOURNEES_PAR_JOUR;
  assert.equal(store.tourneesRestantesAujourdhui(etatCourant()), quota, 'quota du jour au départ');
  store.crediterGorgee(1);
  assert.equal(store.tourneesRestantesAujourdhui(etatCourant()), quota + 1, 'la visite ajoute une Tournée');
  etatCourant().arene.equipe = ['boba', 'classico', 'theo'];
  etatCourant().collection = { boba: 1, classico: 1, theo: 1 };
  assert.ok(store.lancerTournee(), 'Tournée lancée');
  assert.equal(etatCourant().tourneesOffertes, 0, 'la run OFFERTE est consommée en priorité');
  assert.equal(etatCourant().statsJour.tourneesLancees, 0, 'le quota du jour est préservé');

  // — Le ×2 de visite s'applique bien aux gains de partie, sous le plafond final —
  store.resetBobaQuest();
  const sansVisite = store.finPartieInfini({ ...STATS, score: 900 }, () => 0.99).perlesGagnees;
  store.resetBobaQuest();
  store.crediterGorgee(1);
  const avecVisite = store.finPartieInfini({ ...STATS, score: 900 }, () => 0.99).perlesGagnees;
  assert.ok(avecVisite > sansVisite, `le ×2 de visite augmente le gain (${sansVisite} → ${avecVisite})`);
  assert.ok(avecVisite <= economie.PERLES_MAX_FINAL.infini, 'gain borné par le plafond final');

  // ============ 🎫 LE PASSEPORT DE LA CARTE — débloquer en BUVANT ============
  // Les ids du mapping doivent EXISTER dans le catalogue réel, partagé avec la caisse.
  // Ce test est le garde-fou du Passeport : un renommage de la carte (ou une saveur
  // retirée) le casse ici, au lieu de casser silencieusement le déblocage des cartes.
  {
    const catalogue = require(path.join(racine, 'src/data/catalogue.js'));
    const saveurs = new Set();
    const categories = new Set();
    for (const g of catalogue.categories) {
      categories.add(g.id);
      for (const sv of (g.saveurs || [])) saveurs.add(sv.id);
    }
    const toppings = new Set((catalogue.toppings || []).map((t) => t.id));

    const inconnus = [];
    for (const [carte, d] of Object.entries(economie.DEBLOCAGE_CARTES)) {
      if (d.par !== 'achat') continue;
      assert.ok(d.cibles.length > 0, `${carte} : au moins une cible d'achat`);
      assert.ok(d.nb >= 1, `${carte} : au moins un achat requis`);
      for (const c of d.cibles) {
        const ok = c.type === 'saveur' ? saveurs.has(c.id)
          : c.type === 'categorie' ? categories.has(c.id)
          : c.type === 'topping' ? toppings.has(c.id)
          : ['chantilly', 'lait-avoine'].includes(c.id);
        if (!ok) inconnus.push(`${carte} → ${c.type}:${c.id}`);
      }
    }
    assert.deepEqual(inconnus, [], 'toutes les cibles du Passeport existent au catalogue');

    // Le nombre d'achats suit la rareté, et le set commun reste GRATUIT.
    for (const c of economie.COLLECTIBLES) {
      const d = economie.deblocageDe(c.id);
      if (c.set === 'milk') {
        assert.equal(d.par, 'jeu', `${c.id} (commun) doit rester obtenable en jouant`);
      }
      if (d.par === 'achat') {
        assert.equal(d.nb, economie.ACHATS_PAR_RARETE[c.rarete],
          `${c.id} : nombre d'achats conforme à sa rareté`);
      }
    }
    // Une équipe 100 % commune reste JOUABLE et sous le budget (le joueur du canapé).
    const communes = economie.COLLECTIBLES.filter((c) => c.set === 'milk').slice(0, 3).map((c) => c.id);
    assert.equal(communes.length, 3, 'trois communes disponibles gratuitement');
    assert.ok(economie.coutEquipe(communes) <= economie.BUDGET_EQUIPE, 'équipe commune sous le budget');
    assert.ok(economie.multOutsider(economie.coutEquipe(communes)) > 1.2,
      'et compensée par le bonus outsider (> +20 %)');

    // Les 6 fruités mappent 6 saveurs DISTINCTES de fruit-tea (aucune collision).
    const fruits = economie.COLLECTIBLES.filter((c) => c.set === 'fruit');
    const cibles = fruits.flatMap((c) => economie.deblocageDe(c.id).cibles.map((x) => x.id));
    assert.equal(new Set(cibles).size, fruits.length, 'un fruit = une saveur, sans collision');
  }

  // — Compter les achats qui comptent pour une carte —
  const L = (categorieId, saveurId, extra) => ({ categorieId, saveurId, quantite: 1, ...extra });
  assert.equal(economie.achatsPourCarte('fraisy', [L('fruit-tea', 'ft-fraise')]), 1, 'un fruit tea fraise compte');
  assert.equal(economie.achatsPourCarte('fraisy', [L('milk-tea', 'mt-fraise')]), 0,
    'un MILK tea fraise ne débloque pas Fraisberry (cible = fruit-tea uniquement)');
  assert.equal(economie.achatsPourCarte('fraisy', [{ ...L('fruit-tea', 'ft-fraise'), quantite: 3 }]), 3,
    'une ligne de 3 compte pour 3 : le client a payé trois boissons');
  assert.equal(economie.achatsPourCarte('boba', [L('milk-tea', 'mt-original')]), 0,
    'une carte gratuite ne compte aucun achat');

  // Toppings : la carte désigne une FAMILLE, plusieurs ids l'ouvrent.
  assert.equal(economie.achatsPourCarte('popping', [L('fruit-tea', 'ft-mangue', { toppings: ['perles-mangue'] })]), 1,
    'perles mangue → Popping');
  assert.equal(economie.achatsPourCarte('popping', [L('fruit-tea', 'ft-mangue', { toppings: ['tapioca'] })]), 0,
    'le tapioca n’est pas une perle de fruit');
  assert.equal(economie.achatsPourCarte('jelly', [L('milk-tea', 'mt-original', { toppings: ['jelly-litchi'] })]), 1,
    'jelly litchi → Wobblina');
  assert.equal(economie.achatsPourCarte('nuage', [L('milk-tea', 'mt-original', { chantilly: true })]), 1,
    'chantilly → Nuage');
  assert.equal(economie.achatsPourCarte('mochito', [L('mochi-glace', 'mo-vanille')]), 1,
    'toute saveur de mochi glacé → Mochito');

  // — Progression et déblocage —
  const versTaro = (n) => Array.from({ length: n }, () => L('milk-tea', 'mt-taro'));
  assert.deepEqual(economie.passeportCarte('taro-queen', versTaro(0)),
    { parJeu: false, acquise: false, faits: 0, requis: 3 }, 'Taro Queen : 0/3 au départ');
  assert.deepEqual(economie.passeportCarte('taro-queen', versTaro(2)),
    { parJeu: false, acquise: false, faits: 2, requis: 3 }, 'Taro Queen : 2/3');
  assert.equal(economie.passeportCarte('taro-queen', versTaro(3)).acquise, true, 'Taro Queen : acquise à 3');
  assert.equal(economie.passeportCarte('boba', []).parJeu, true, 'Boba : obtenable en jouant');
  assert.equal(economie.passeportCarte('boba', []).acquise, true, 'une carte de jeu est toujours « acquise » côté Passeport');

  assert.deepEqual(economie.cartesDebloqueesParAchats([]), [], 'aucun achat = aucune carte débloquée par achat');
  const debloquees = economie.cartesDebloqueesParAchats([
    ...versTaro(3),
    L('fruit-tea', 'ft-mangue'),
    L('signature', 'sg-tiger'), L('signature', 'sg-tiger'), L('signature', 'sg-tiger'),
  ]);
  assert.ok(debloquees.includes('taro-queen'), '3 taros → Taro Queen');
  assert.ok(debloquees.includes('mango'), '1 fruit tea mangue → Mangozilla');
  assert.ok(debloquees.includes('oreo-star'), '3 Tiger Sugar → Tiger Sugar');
  assert.ok(!debloquees.includes('matcha-sensei'), 'rien pour Matcha Sensei sans matcha');

  // — Coût de la collection complète en ACHATS RÉELS : le chiffre qui compte pour Yoann —
  {
    let total = 0;
    for (const c of economie.COLLECTIBLES) {
      const d = economie.deblocageDe(c.id);
      if (d.par === 'achat') total += d.nb;
    }
    assert.ok(total >= 20 && total <= 40,
      `la collection complète doit valoir 20 à 40 achats réels (mesuré : ${total})`);
  }

  // ============ 🎫 PASSEPORT : côté STORE ============
  // L'interrupteur DOIT rester à false jusqu'à ce que la caisse publie `achats_lignes` :
  // l'activer avant verrouillerait la collection sans moyen de la débloquer.
  assert.equal(economie.PASSEPORT_ACTIF, false,
    'le Passeport reste DÉSACTIVÉ tant que la caisse ne publie pas les achats');

  // — Exemplaires justifiés par les achats : racheter fait monter la carte —
  const taro = (n) => Array.from({ length: n }, () => ({ categorieId: 'milk-tea', saveurId: 'mt-taro', quantite: 1 }));
  assert.equal(economie.exemplairesParAchats('taro-queen', taro(2)), 0, '2 taros : pas encore la carte');
  assert.equal(economie.exemplairesParAchats('taro-queen', taro(3)), 1, '3 taros : la carte');
  assert.equal(economie.exemplairesParAchats('taro-queen', taro(6)), 2, '6 taros : la carte + un doublon d entraînement');
  assert.equal(economie.exemplairesParAchats('boba', taro(9)), 0, 'une carte gratuite ne compte aucun achat');

  // — Le vivier des capsules quand le Passeport est actif —
  const poolVide = economie.poolCapsuleAvecPasseport([]);
  const gratuites = economie.COLLECTIBLES.filter((c) => economie.deblocageDe(c.id).par === 'jeu');
  assert.equal(poolVide.length, gratuites.length, 'sans rien débloqué : uniquement les cartes gratuites');
  assert.ok(economie.COLLECTIBLES.filter((c) => c.set === 'milk')
    .every((c) => poolVide.some((p) => p.id === c.id)), 'les 6 Milk Tea en font partie');
  // ✅ 27/07 — LA BRÈCHE EST REFERMÉE (décisions tranchées par Yoann). Toute carte laissée
  // sans mapping produit est GRATUITE, donc sortable d'une capsule sans le moindre achat,
  // Passeport actif. Les deux dernières dans ce cas — Flantastique (aucun topping flan au
  // catalogue) et Bubble Master (mascotte sans produit) — ne le sont plus : Flantastique
  // est rattachée à la FAMILLE VANILLE (4 saveurs, réclamées par aucune autre carte) et
  // Bubble Master à la variante `{ par: 'collection' }`, les 23 autres cartes réunies —
  // qui n'est PAS une carte gratuite (cf. le bloc 🎫 A plus bas, qui teste 22 et 23).
  // Ne reste donc hors mapping que le SEUL set commun (les 6 Milk Tea), et c'est une
  // décision produit explicite, pas un oubli : le joueur qui ne vient jamais garde une
  // équipe complète et compétitive. Ce test interdit désormais qu'une carte RETOMBE dans
  // la brèche — ajouter un collectible sans mapping le fait échouer, ce qui est le but.
  const sansMappingHorsCommun = gratuites.filter((c) => c.set !== 'milk').map((c) => c.id);
  assert.deepEqual(sansMappingHorsCommun.sort(), [],
    'aucune carte hors du set commun ne doit rester sans mapping produit (brèche du Passeport)');
  const poolAvecTaro = economie.poolCapsuleAvecPasseport(['taro-queen']);
  assert.equal(poolAvecTaro.length, gratuites.length + 1, 'une légendaire débloquée entre dans le vivier');
  assert.ok(poolAvecTaro.some((c) => c.id === 'taro-queen'));
  assert.ok(!poolAvecTaro.some((c) => c.id === 'matcha-sensei'),
    'une carte NON débloquée ne peut pas sortir d une capsule (sinon le Passeport ne sert à rien)');

  // — appliquerPasseport : monotone, idempotent, cumulatif —
  store.resetBobaQuest();
  const r1 = store.appliquerPasseport(taro(3));
  assert.deepEqual(r1.nouvelles, ['taro-queen'], '3 taros → Taro Queen accordée');
  assert.equal(etatCourant().collection['taro-queen'], 1, 'un exemplaire');
  const r2 = store.appliquerPasseport(taro(3));
  assert.deepEqual(r2, { nouvelles: [], exemplaires: 0 }, 'IDEMPOTENT : rien de plus au second passage');
  const r3 = store.appliquerPasseport(taro(6));
  assert.equal(etatCourant().collection['taro-queen'], 2, '6 taros → un doublon d entraînement');
  assert.equal(r3.exemplaires, 1, 'un exemplaire de plus signalé');
  // MONOTONE : un historique tronqué (rétention serveur, réseau) ne retire jamais rien
  store.appliquerPasseport([]);
  assert.equal(etatCourant().collection['taro-queen'], 2, 'historique vide : la carte RESTE acquise');
  // CUMULATIF : une carte obtenue autrement n est jamais dégradée
  etatCourant().collection = { ...etatCourant().collection, 'matcha-sensei': 3 };
  store.appliquerPasseport(taro(6));
  assert.equal(etatCourant().collection['matcha-sensei'], 3, 'une carte de capsule n est pas rabaissée');

  // — La progression affichée par l album —
  store.resetBobaQuest();
  const prog = store.passeportCollection(taro(2), etatCourant());
  assert.deepEqual(prog['taro-queen'], { parJeu: false, acquise: false, faits: 2, requis: 3 },
    'Taro Queen : 2/3, pas encore acquise');
  assert.equal(prog['boba'].parJeu, true, 'Boba : par le jeu');
  assert.equal(prog['fraisy'].requis, 1, 'un fruité : 1 achat');
  // une carte déjà possédée est acquise même sans achat
  etatCourant().collection = { 'matcha-sensei': 1 };
  assert.equal(store.passeportCollection([], etatCourant())['matcha-sensei'].acquise, true,
    'une carte déjà en collection reste acquise quel que soit l historique');

  // ============ 💾 SAUVEGARDE SERVEUR — arbitrage téléphone / serveur ============
  // Chaque cas ci-dessous correspond à une façon RÉELLE de perdre une progression.
  const D = economie.decisionSync;

  // Le cas qui compte le plus : LECTURE SERVEUR ÉCHOUÉE. On ne pousse JAMAIS, sinon une
  // installation neuve (révision 0, état vide) écrase six semaines de jeu.
  assert.equal(D(0, undefined, true), 'attendre', 'lecture échouée + install neuve : NE RIEN FAIRE');
  assert.equal(D(999, undefined, false), 'attendre', 'lecture échouée, même avec une grosse progression locale');

  // Réinstallation : le téléphone est vierge, le serveur a tout → on adopte.
  assert.equal(D(0, 42, true), 'adopter-serveur', 'réinstallation : le serveur fait foi');
  // Joueur en avance : on pousse.
  assert.equal(D(43, 42, false), 'pousser-local', 'téléphone en avance : on pousse');
  // À égalité : rien (évite un aller-retour réseau à chaque ouverture).
  assert.equal(D(42, 42, false), 'rien', 'déjà synchronisé');
  // Aucune sauvegarde serveur encore.
  assert.equal(D(7, null, false), 'pousser-local', 'première sauvegarde du joueur');
  assert.equal(D(0, null, true), 'rien', 'joueur qui n’a jamais joué : pas de ligne inutile');
  // Téléphone EN RETARD (autre appareil plus avancé) → on adopte, on n’écrase pas.
  assert.equal(D(10, 25, false), 'adopter-serveur', 'second appareil en retard : il adopte');

  // — Le store expose de quoi synchroniser, sans jamais parler au réseau —
  store.resetBobaQuest();
  const inst0 = store.instantaneEtat();
  assert.ok(inst0, 'instantané disponible une fois hydraté');
  assert.equal(inst0.vierge, true, 'un état neuf est reconnu VIERGE (pas de ligne serveur inutile)');
  const rev0 = inst0.revision;

  // la révision AVANCE à chaque modification, et jamais en arrière
  store.crediterGorgee(1);
  const inst1 = store.instantaneEtat();
  assert.ok(inst1.revision > rev0, `la révision avance (${rev0} → ${inst1.revision})`);
  assert.equal(inst1.vierge, false, 'un état avec des perles n’est plus vierge');

  // — Adopter une sauvegarde serveur : elle passe par le MÊME assainissement qu’une
  //   sauvegarde locale, et la révision du serveur fait foi —
  store.resetBobaQuest();
  const ok = store.adopterEtatServeur({
    perles: 4242, collection: { boba: 2 }, partiesJouees: 17,
    // champ sale volontaire : la migration doit l’assainir sans faire échouer l’adoption
    eclats: 'nawak',
  }, 77);
  assert.equal(ok, true, 'sauvegarde serveur adoptée');
  assert.equal(etatCourant().perles, 4242, 'perles adoptées');
  assert.equal(etatCourant().collection.boba, 2, 'collection adoptée');
  assert.equal(etatCourant().eclats, 0, 'valeur sale assainie, pas de crash');
  assert.ok(etatCourant().revision >= 77,
    'la révision du SERVEUR fait foi — sinon le téléphone se croirait aussitôt en avance et repousserait');

  // une sauvegarde illisible n’est jamais adoptée (on ne remplace pas un bon état par du vide)
  store.resetBobaQuest();
  etatCourant().perles = 500;
  assert.equal(store.adopterEtatServeur('[]', 5), false, 'un tableau n’est pas une sauvegarde');
  assert.equal(store.adopterEtatServeur(null, 5), false, 'null n’est pas une sauvegarde');
  assert.equal(etatCourant().perles, 500, 'l’état local est INTACT après un refus');

  // — Un état vierge est reconnu comme tel (sert à ne pas créer de ligne serveur) —
  assert.equal(economie.etatEstVierge({ perles: 0, collection: {}, partiesJouees: 0, capsulesOuvertes: 0, gains: [] }), true);
  assert.equal(economie.etatEstVierge({ perles: 1, collection: {}, partiesJouees: 0, capsulesOuvertes: 0, gains: [] }), false);
  assert.equal(economie.etatEstVierge({ perles: 0, collection: { boba: 1 }, partiesJouees: 0, capsulesOuvertes: 0, gains: [] }), false);
  assert.equal(economie.etatEstVierge({ perles: 0, collection: {}, partiesJouees: 0, capsulesOuvertes: 0, gains: [{}] }), false,
    'un prix réel gagné suffit à rendre l’état précieux');

  // ============ ⚖️ INFORMATION CLIENT ============
  const confidentialite = fs.readFileSync(path.join(racine, 'public/confidentialite.html'), 'utf8');
  const reglement = fs.readFileSync(path.join(racine, 'public/reglement-boba-quest.html'), 'utf8');
  const compte = fs.readFileSync(path.join(racine, 'src/app/compte.tsx'), 'utf8');
  const hub = fs.readFileSync(path.join(racine, 'src/app/jeu/index.tsx'), 'utf8');
  assert.match(confidentialite, /lignes d'achat nominatives[\s\S]*24 mois/i,
    'la nouvelle finalité et sa rétention doivent être annoncées');
  assert.match(confidentialite, /ni moyen de paiement, ni numéro de carte bancaire/i,
    'la minimisation doit être expliquée clairement');
  assert.match(confidentialite, /progression du jeu[\s\S]*numéro de révision technique/i,
    'la sauvegarde de progression liée au compte doit être annoncée');
  assert.match(confidentialite, /sauvegarde de progression Boba Quest[\s\S]*tant que le compte est actif/i,
    'la durée de conservation de la sauvegarde doit être annoncée');
  assert.match(reglement, /simple présentation de la carte, sans vente, ne consomme pas le prix/i,
    'le règlement doit décrire la preuve de vente');
  assert.match(reglement, /restaurée après une réinstallation ou un changement d'appareil/i,
    'le règlement doit expliquer la sauvegarde liée au compte');
  assert.match(reglement, /politique de confidentialité/i);
  assert.match(compte, /URL_REGLEMENT_BOBA_QUEST/);
  assert.match(hub, /reglement-boba-quest/);


  // ============================================================================
  // 🧪 LOT F (26/07/2026) — LES 12 FAMILLES DE TESTS DE LA REFONTE (cahier §7/F1)
  // Ajoutées EN FIN de fichier, rien retiré ni déplacé. Tout aléa passe par un `rng`
  // injecté (aucun test instable), et aucune valeur dérivable n'est figée : les
  // attendus se calculent à partir des constantes exportées par les moteurs.
  // ============================================================================

  const rngF = () => 0.5;          // rng médian : pas de crit, variance neutre, impact plein
  const rngRate = () => 0.99;      // rng haut : jamais de crit, et le coup EFFLEURE (0,99 > précision)

  // --- 🧪 F1 · STATUTS : pose, cumul plafonné, expiration, insensible, tick --------
  // Le refactor A1 remplace 6 champs ad hoc par une liste unique. Ce qu'on verrouille
  // ici, ce sont les RÈGLES de `poserStatut`/`tickStatuts`, pas leurs valeurs de contenu.
  const statPose = arene.creerCombattant('classico');
  assert.equal(arene.aStatut(statPose, 'poison'), false, 'statuts : liste vide à la création');
  assert.equal(arene.poserStatut(statPose, 'poison', 3, undefined, arene.POISON_PILES_MAX), true, 'pose acceptée');
  assert.equal(arene.pilesStatut(statPose, 'poison'), 1, 'une seule pile à la première pose');
  for (let i = 0; i < arene.POISON_PILES_MAX + 3; i++) {
    arene.poserStatut(statPose, 'poison', 3, undefined, arene.POISON_PILES_MAX);
  }
  assert.equal(arene.pilesStatut(statPose, 'poison'), arene.POISON_PILES_MAX, 'cumul plafonné à POISON_PILES_MAX');
  arene.poserStatut(statPose, 'poison', 1);
  assert.equal(arene.toursStatut(statPose, 'poison'), 3, 'repose plus courte : on garde le MAX des durées');
  arene.retirerStatut(statPose, 'poison');
  assert.equal(arene.aStatut(statPose, 'poison'), false, 'retirerStatut nettoie la liste');

  // `tours = -1` = « jusqu'à consommation » : ni rabaissé par un Math.max naïf, ni
  // décrémenté par le tick. C'est ce qui distingue un bouclier d'un buff à durée.
  const statPerm = arene.creerCombattant('classico');
  arene.poserStatut(statPerm, 'bouclier', -1);
  arene.poserStatut(statPerm, 'bouclier', 5);
  assert.equal(arene.toursStatut(statPerm, 'bouclier'), -1, 'une pose permanente n est jamais rabaissée à une durée finie');
  for (let i = 0; i < 5; i++) arene.tickStatuts(statPerm, 'a', []);
  assert.equal(arene.aStatut(statPerm, 'bouclier'), true, 'tours === -1 : le tick ne décrémente jamais');

  // Expiration : `tours` décroît d'exactement 1 par tick, puis le statut disparaît.
  const statExp = arene.creerCombattant('classico');
  arene.poserStatut(statExp, 'faiblesse', 2);
  arene.tickStatuts(statExp, 'a', []);
  assert.equal(arene.toursStatut(statExp, 'faiblesse'), 1, 'un tick = une action consommée');
  const evtsExp = [];
  arene.tickStatuts(statExp, 'a', evtsExp);
  assert.equal(arene.aStatut(statExp, 'faiblesse'), false, 'le statut expire à 0');
  assert.ok(evtsExp.some((e) => e.t === 'statut' && e.cle === 'statut-expire'), 'l expiration est journalisée pour l UI');

  // 🪨 insensible : bloque les statuts SUBIS, jamais les buffs qu'on se donne.
  const statIns = arene.creerCombattant('classico');
  arene.poserStatut(statIns, 'insensible', 1);
  for (const hostile of ['poison', 'brulure', 'faiblesse', 'etourdi', 'collant', 'givre', 'petillant']) {
    assert.equal(arene.poserStatut(statIns, hostile, 2), false, `insensible : ${hostile} refusé`);
    assert.equal(arene.aStatut(statIns, hostile), false, `insensible : ${hostile} absent après refus`);
  }
  for (const amical of ['garde', 'bouclier', 'boost', 'regen']) {
    assert.equal(arene.poserStatut(statIns, amical, 2, 0.5), true, `insensible : ${amical} reste posable sur soi`);
  }

  // Le tick passe par `encaisserDegats` — donc par le PIPELINE UNIQUE. La preuve : le
  // passif « Increvable » de Boba (reviveDispo) intercepte une brûlure mortelle, ce que
  // seule une perte de PV passée par `resoudreImpact` peut faire.
  const statLetal = arene.creerCombattant('boba');
  assert.equal(statLetal.reviveDispo, true, 'Boba porte bien le passif Increvable');
  statLetal.pv = 2;
  arene.poserStatut(statLetal, 'brulure', 3, statLetal.pvMax); // valeur démesurée : écrêtée par le plafond
  const evtsLetal = [];
  arene.tickStatuts(statLetal, 'a', evtsLetal);
  assert.ok(evtsLetal.some((e) => e.t === 'degats'), 'le tick émet un événement degats : il est passé par le pipeline');
  assert.equal(statLetal.pv, 1, 'reviveDispo honoré par les dégâts de statut (pipeline unique)');
  const evtsLetal2 = [];
  arene.tickStatuts(statLetal, 'a', evtsLetal2);
  assert.equal(statLetal.pv, 0, 'le tick suivant achève, sans revive');
  assert.ok(statLetal.pv >= 0, 'un tick ne descend JAMAIS sous 0 PV');
  arene.tickStatuts(statLetal, 'a', []);
  assert.equal(statLetal.pv, 0, 'un porteur déjà à 0 PV ne prend plus de dégâts de statut');

  // §A9 : tous statuts confondus, une cible ne perd pas plus de STATUT_DEGATS_MAX_PCT
  // de ses PV max par tour. Attendu DÉRIVÉ de la constante, jamais écrit en dur.
  const statPlafond = arene.creerCombattant('boba');
  arene.poserStatut(statPlafond, 'brulure', 3, statPlafond.pvMax);
  for (let i = 0; i < arene.POISON_PILES_MAX; i++) {
    arene.poserStatut(statPlafond, 'poison', 3, undefined, arene.POISON_PILES_MAX);
  }
  const pvAvantPlafond = statPlafond.pv;
  arene.tickStatuts(statPlafond, 'a', []);
  const perteStatuts = pvAvantPlafond - statPlafond.pv;
  assert.ok(perteStatuts > 0, 'les statuts mordent bien');
  assert.ok(
    perteStatuts <= Math.floor(statPlafond.pvMax * arene.STATUT_DEGATS_MAX_PCT / 100),
    `§A9 : ${perteStatuts} PV perdus > plafond de ${arene.STATUT_DEGATS_MAX_PCT} % des PV max`,
  );

  // 💚 la régén passe par `appliquerSoin` : elle subit donc la fatigue de soin.
  const statRegen = arene.creerCombattant('lacto');
  statRegen.pv = 1;
  arene.poserStatut(statRegen, 'regen', 5);
  const gainsRegen = [];
  for (let i = 0; i < 2; i++) {
    const ev = [];
    arene.tickStatuts(statRegen, 'a', ev);
    gainsRegen.push(ev.filter((e) => e.t === 'soin').reduce((s, e) => s + e.valeur, 0));
  }
  assert.ok(gainsRegen[0] > 0 && gainsRegen[0] <= arene.REGEN_MAX_PAR_ACTION, 'régén bornée par REGEN_MAX_PAR_ACTION');
  assert.ok(gainsRegen[1] < gainsRegen[0], 'la régén subit la fatigue de soin (appliquerSoin, pas un chemin parallèle)');

  // 📋 EXHAUSTIVITÉ DES TABLES DE CONTENU. `tickStatuts` lit `INFOS_STATUT[id].nom` pour
  // annoncer une expiration et `poserStatutJournalise` pour annoncer une pose : une
  // entrée manquante ne serait pas un texte vide, ce serait un CRASH en plein combat.
  // Même logique pour `HINT_TRAIT`, que l'UI affiche sous chaque bouton d'attaque.
  const statutsDuContenu = new Set();
  for (const sig of Object.values(arene.SIGNATURES_CARTE)) {
    for (const cle of ['statut', 'statutSoi', 'statutEquipe', 'statutEquipeSoi']) {
      if (sig[cle]) statutsDuContenu.add(sig[cle].id);
    }
  }
  assert.ok(statutsDuContenu.size >= 6, 'les 24 signatures posent bien une variété de statuts');
  for (const id of statutsDuContenu) {
    const info = arene.INFOS_STATUT[id];
    assert.ok(info && info.emoji && info.nom && info.aide, `INFOS_STATUT incomplet pour « ${id} » — crash garanti à l expiration`);
  }
  const traitsDuContenu = new Set();
  for (const fiche of Object.values(arene.FICHES)) {
    for (const attaque of fiche.attaques) for (const t of (attaque.traits || [])) traitsDuContenu.add(t);
  }
  assert.ok(traitsDuContenu.size >= 10, 'les 24 cartes exploitent bien la palette de traits (§A3)');
  for (const t of traitsDuContenu) {
    assert.ok(arene.HINT_TRAIT[t], `HINT_TRAIT manquant pour le trait « ${t} » : l UI n aurait rien à afficher`);
  }
  // §A4 : `signatureDe` doit rendre une signature pour les 24 cartes, sans exception —
  // le repli par set est ce qui garantit qu aucune carte ne se retrouve sans ulti.
  for (const c of economie.COLLECTIBLES) {
    const sig = arene.signatureDe(arene.creerCombattant(c.id));
    assert.ok(sig && sig.nom && sig.desc && typeof sig.pvPct === 'number', `${c.id} : signature introuvable (ni perso, ni repli de set)`);
  }
  assert.equal(Object.keys(arene.SIGNATURES_CARTE).length, economie.COLLECTIBLES.length,
    '§A4 : une signature PROPRE par carte (24), plus les 4 replis par set');

  // ✅ NON-RÉGRESSION (ex-🐞 n°1, corrigé le 27/07) — LE PLAFOND §A9 TIENT À TOUS LES
  // ROUNDS. `tickStatuts` borne le budget à STATUT_DEGATS_MAX_PCT des PV max PUIS appelle
  // `encaisserDegats` : tant que le pipeline remultipliait par `multEscalade(etat.round)`
  // (étape 9 bis), le plafond sautait dès ROUND_ESCALADE (mesuré : 22,6 % au round 12,
  // 40,4 % au 18, 59,6 % au 25 — une carte mourait en deux tours sans être touchée). Les
  // deux ticks passent désormais `sansEscalade`, comme les épines et l'éclaboussure : une
  // perte DÉJÀ bornée en pourcentage de PV max ne se remajore pas après coup. §A9 tranche
  // la contradiction avec la lecture large de §A7. Le plafond est dérivé de
  // STATUT_DEGATS_MAX_PCT et des PV max, jamais écrit en dur.
  const perteStatutsAuRound = (round) => {
    const c = arene.creerCombat(['theo'], ['pasteka'], 1);
    const porteur = c.equipes.b[0];
    porteur.pv = porteur.pvMax;
    porteur.reviveDispo = false;
    c.round = round;
    // état parfaitement atteignable : Infusion Sans Fin (poison ×3) + une saignée
    for (let i = 0; i < arene.POISON_PILES_MAX; i++) arene.poserStatut(porteur, 'poison', 4, undefined, arene.POISON_PILES_MAX);
    arene.poserStatut(porteur, 'brulure', 4, Math.round(porteur.pvMax * arene.SAIGNEE_PCT / 100));
    const avant = porteur.pv;
    arene.tickStatuts(porteur, 'b', [], c, 0);
    return { perte: avant - porteur.pv, plafond: Math.floor(porteur.pvMax * arene.STATUT_DEGATS_MAX_PCT / 100) };
  };
  // Balayage des rounds qui ENCADRENT le COUP DE CHAUD : avant, au déclenchement, au
  // plafond §A9 de durée de combat, et bien au-delà (l'escalade y est saturée à
  // ESCALADE_MAX). Aucun ne doit franchir le budget, et le pire cas doit l'ATTEINDRE —
  // sans quoi le test passerait aussi sur un tick devenu inoffensif.
  const ROUNDS_PLAFOND_A9 = [1, arene.ROUND_ESCALADE - 1, arene.ROUND_ESCALADE, 18, 25, 60];
  for (const round of ROUNDS_PLAFOND_A9) {
    const m = perteStatutsAuRound(round);
    assert.ok(m.perte <= m.plafond,
      `§A9 : au round ${round} les statuts retirent ${m.perte} PV pour un plafond de ${m.plafond}`);
  }
  assert.equal(perteStatutsAuRound(1).perte, perteStatutsAuRound(1).plafond,
    'le pire cumul atteint EXACTEMENT le plafond §A9 (poison ×3 + saignée)');
  assert.equal(perteStatutsAuRound(arene.ROUND_ESCALADE).perte, perteStatutsAuRound(1).perte,
    'le COUP DE CHAUD ne majore PAS les dégâts de statut : même perte avant et après ROUND_ESCALADE');
  assert.equal(perteStatutsAuRound(60).perte, perteStatutsAuRound(1).perte,
    'escalade saturée (ESCALADE_MAX) : la perte par statuts reste rigoureusement identique');
  // Le Coup de chaud reste bien actif là où il DOIT l'être : un échange de coups normal.
  // Sans ce contrôle, « désescalader » les statuts pourrait masquer une désescalade totale.
  assert.ok(arene.multEscalade(arene.ROUND_ESCALADE) > arene.multEscalade(arene.ROUND_ESCALADE - 1),
    'le COUP DE CHAUD reste actif sur les échanges de coups (seuls les statuts en sont exclus)');

  // ✅ NON-RÉGRESSION (ex-🐞 n°2, corrigé le 27/07) — RÉ-EMPOISONNER NE DÉSEMPOISONNE
  // JAMAIS. `poserStatut` faisait `piles = Math.min(pilesMax, piles + 1)` : une re-pose
  // dont le `pilesMax` était INFÉRIEUR au cumul en place le rabaissait (l'Averse Acide de
  // Citro, 2 piles, retirait une pile à une cible montée à 3 par l'Infusion Sans Fin de
  // Théo — mesuré 3 → 2). Un `Math.max` extérieur rend la pose MONOTONE, comme elle l'est
  // déjà pour `valeur` et pour la durée `-1`. Tout est dérivé des signatures de contenu.
  const statPiles = arene.creerCombattant('pasteka');
  const poisonTheo = arene.SIGNATURES_CARTE.theo.statut;            // 3 piles
  const poisonCitro = arene.SIGNATURES_CARTE.citro.statutEquipe;    // 2 piles
  assert.equal(poisonTheo.id, 'poison', 'prémisse : Infusion Sans Fin empoisonne');
  assert.equal(poisonCitro.id, 'poison', 'prémisse : Averse Acide empoisonne aussi');
  assert.ok(poisonCitro.piles < poisonTheo.piles, 'prémisse : Averse Acide est MOINS cumulable');
  for (let n = 0; n < poisonTheo.piles; n++) arene.poserStatut(statPiles, 'poison', poisonTheo.tours, undefined, poisonTheo.piles);
  assert.equal(arene.pilesStatut(statPiles, 'poison'), arene.POISON_PILES_MAX, 'Infusion Sans Fin monte le poison au maximum');
  for (let n = 0; n < poisonCitro.piles; n++) arene.poserStatut(statPiles, 'poison', poisonCitro.tours, undefined, poisonCitro.piles);
  assert.equal(arene.pilesStatut(statPiles, 'poison'), arene.POISON_PILES_MAX,
    'Averse Acide (moins cumulable) LAISSE le poison au maximum : re-poser ne retire jamais');
  // La monotonie doit valoir pour TOUT couple de `pilesMax`, pas seulement pour ce duo de
  // contenu : balayage exhaustif des cumuls atteignables, et vérification que la montée
  // NORMALE (pilesMax croissant) marche toujours — le `Math.max` ne doit rien geler.
  for (let deja = 1; deja <= arene.POISON_PILES_MAX; deja++) {
    for (let pilesMax = 1; pilesMax <= arene.POISON_PILES_MAX; pilesMax++) {
      const c = arene.creerCombattant('pasteka');
      for (let n = 0; n < deja; n++) arene.poserStatut(c, 'poison', 3, undefined, arene.POISON_PILES_MAX);
      const avant = arene.pilesStatut(c, 'poison');
      arene.poserStatut(c, 'poison', 3, undefined, pilesMax);
      const apres = arene.pilesStatut(c, 'poison');
      assert.ok(apres >= avant, `re-pose (cumul ${avant}, pilesMax ${pilesMax}) : ${apres} < ${avant}`);
      assert.equal(apres, Math.max(avant, Math.min(pilesMax, avant + 1)),
        `re-pose (cumul ${avant}, pilesMax ${pilesMax}) : la montée normale doit rester possible`);
      assert.ok(apres <= arene.POISON_PILES_MAX, 'POISON_PILES_MAX reste le plafond dur');
    }
  }

  // ✅ NON-RÉGRESSION (ex-🐞 n°3, corrigé le 27/07) — UNE GARDE FAIBLE N'HÉRITE PLUS D'UNE
  // GARDE FORTE. `poserStatut` conserve `Math.max(valeur)` et la Garde n'est consommée que
  // par un IMPACT : parer parfaitement une action NON offensive laissait GARDE_PARFAITE en
  // place, et la Garde ratée du round suivant en héritait (mesuré : 0,70 au lieu de 0,45).
  // `appliquerGarde` retire donc la Garde précédente avant de poser la nouvelle : la valeur
  // affichée est celle de la parade qu'on vient RÉELLEMENT de réussir.
  const cGardeHeritee = arene.creerCombat(['pasteka'], ['classico'], 1);
  arene.jouerRound(cGardeHeritee, 'garde', rngF, 1, 'parfait'); // choixB = 1 → action NON offensive
  assert.equal(arene.valeurStatut(cGardeHeritee.equipes.a[0], 'garde'), arene.GARDE_PARFAITE,
    'une parade parfaite dans le vide n est pas consommée');
  cGardeHeritee.equipes.a[0].gardeCooldown = 0;
  arene.jouerRound(cGardeHeritee, 'garde', rngF, 1, 'rate');
  assert.equal(arene.valeurStatut(cGardeHeritee.equipes.a[0], 'garde'), arene.GARDE_REDUCTION,
    'la Garde RATÉE qui suit vaut sa propre réduction, pas celle héritée de la parade parfaite');
  // Symétrique indispensable, sur un combat FRAIS (deux rounds seulement : au-delà, un
  // impact réel consomme la Garde et le test ne mesurerait plus la pose) : le retrait ne
  // doit pas non plus BLOQUER la montée d'une Garde faible vers une parade parfaite.
  const cGardeMontee = arene.creerCombat(['pasteka'], ['classico'], 1);
  arene.jouerRound(cGardeMontee, 'garde', rngF, 1, 'rate');
  assert.equal(arene.valeurStatut(cGardeMontee.equipes.a[0], 'garde'), arene.GARDE_REDUCTION,
    'prémisse du symétrique : une Garde ratée dans le vide vaut GARDE_REDUCTION');
  cGardeMontee.equipes.a[0].gardeCooldown = 0;
  arene.jouerRound(cGardeMontee, 'garde', rngF, 1, 'parfait');
  assert.equal(arene.valeurStatut(cGardeMontee.equipes.a[0], 'garde'), arene.GARDE_PARFAITE,
    'la Garde reflète TOUJOURS la dernière parade réussie, dans les deux sens');
  // Le talent 🎖️ garde_maitrisee reste la meilleure Garde de base (et n est pas écrasé).
  const cGardeTalent = arene.creerCombat(['pasteka'], ['classico'], 1);
  cGardeTalent.equipes.a[0].talents = ['garde_maitrisee'];
  arene.jouerRound(cGardeTalent, 'garde', rngF, 1, 'rate');
  assert.equal(arene.valeurStatut(cGardeTalent.equipes.a[0], 'garde'), arene.GARDE_MAITRISEE,
    'garde_maitrisee s applique bien à la pose, le retrait préalable ne l efface pas');

  // --- ⚡ F2 · ÉNERGIE D'ÉQUIPE ------------------------------------------------------
  const cEnerF2 = arene.creerCombat(['classico', 'theo'], ['pasteka'], 1);
  assert.equal(cEnerF2.energie.a, arene.ENERGIE_DEPART, 'réserve de départ du joueur');
  assert.equal(cEnerF2.energie.b, arene.ENERGIE_DEPART, 'réserve de départ du PNJ (même règle)');
  for (let i = 0; i < 20; i++) arene.gagnerEnergie(cEnerF2, 'a', 5);
  assert.equal(cEnerF2.energie.a, arene.ENERGIE_MAX, 'gains bornés par ENERGIE_MAX');
  arene.retirerEnergie(cEnerF2, 'a', 999);
  assert.equal(cEnerF2.energie.a, 0, 'retrait borné à 0 : jamais d énergie négative');
  assert.equal(arene.payerEnergie(cEnerF2, 'a', 1), false, 'débit STRICT : refusé si le camp ne peut pas payer');
  assert.equal(cEnerF2.energie.a, 0, 'un débit refusé ne prélève rien');

  // Spé impayable → repli sur l'attaque 0, SANS consommer de munition.
  const cSpeKO = arene.creerCombat(['mango'], ['pasteka'], 1);
  cSpeKO.energie.a = 0; // + ENERGIE_PAR_ROUND (2) reste < COUT_SPE (3)
  assert.ok(arene.ENERGIE_PAR_ROUND < arene.COUT_SPE, 'prémisse du test : un round de revenu ne paie pas une spé');
  const evSpeKO = arene.jouerRound(cSpeKO, 1, rngF, 0);
  assert.ok(
    evSpeKO.some((e) => e.t === 'annonce' && e.cote === 'a' && e.texte.includes(arene.FICHES.mango.attaques[0].nom)),
    'spé impayable → repli sur l attaque de base',
  );
  assert.equal(cSpeKO.equipes.a[0].speRestantes, arene.SPE_USAGES, 'le repli ne brûle aucune munition');
  const cSpeOK = arene.creerCombat(['mango'], ['pasteka'], 1);
  cSpeOK.energie.a = arene.COUT_SPE;
  const evSpeOK = arene.jouerRound(cSpeOK, 1, rngF, 0);
  assert.ok(
    evSpeOK.some((e) => e.t === 'annonce' && e.cote === 'a' && e.texte.includes(arene.FICHES.mango.attaques[1].nom)),
    'spé payable → la spé part',
  );
  assert.equal(cSpeOK.equipes.a[0].speRestantes, arene.SPE_USAGES - 1, 'une munition consommée');
  assert.equal(
    cSpeOK.energie.a,
    Math.min(arene.ENERGIE_MAX, arene.COUT_SPE + arene.ENERGIE_PAR_ROUND) - arene.COUT_SPE,
    'COUT_SPE débité DANS LE MOTEUR',
  );

  // LE changement de règle décisif : `{ changer, puis }` joue DEUX actions dans le round.
  const cChgF2 = arene.creerCombat(['classico', 'theo'], ['pasteka'], 1);
  cChgF2.energie.a = arene.ENERGIE_MAX;
  const pvBAvantChg = cChgF2.equipes.b[0].pv;
  const evChgF2 = arene.jouerRound(cChgF2, { changer: 1, puis: 0 }, rngF, 0);
  const annChgF2 = evChgF2.filter((e) => e.t === 'annonce' && e.cote === 'a').map((e) => e.texte);
  assert.equal(annChgF2.length, 2, '{ changer, puis } : deux actions annoncées dans le même round');
  assert.ok(annChgF2[0].includes(arene.titreIntentionChangement(cChgF2.equipes.a[1].nom)), 'la 1re action est le changement');
  assert.ok(annChgF2[1].includes(cChgF2.equipes.a[1].attaques[0].nom), 'la 2e est l attaque de la carte ENTRANTE');
  assert.equal(cChgF2.actifs.a, 1, 'le banc est bien monté au front');
  assert.ok(cChgF2.equipes.b[0].pv < pvBAvantChg, 'l action `puis` a réellement porté');
  assert.equal(
    cChgF2.energie.a,
    Math.min(arene.ENERGIE_MAX, arene.ENERGIE_MAX + arene.ENERGIE_PAR_ROUND) - arene.COUT_CHANGER,
    'COUT_CHANGER débité une seule fois',
  );
  // Sans `puis` : comportement HISTORIQUE strictement conservé (le tour passe).
  const cChgSeul = arene.creerCombat(['classico', 'theo'], ['pasteka'], 1);
  cChgSeul.energie.a = arene.ENERGIE_MAX;
  const evChgSeul = arene.jouerRound(cChgSeul, { changer: 1 }, rngF, 0);
  assert.equal(
    evChgSeul.filter((e) => e.t === 'annonce' && e.cote === 'a').length, 1,
    'sans `puis` : le tour passe, comme avant la refonte',
  );
  // Le revenu de round couvre TOUJOURS un changement : le banc ne peut jamais devenir
  // inaccessible faute d'énergie (c'est ce qui garantit la promesse « le banc revit »).
  assert.ok(
    arene.ENERGIE_PAR_ROUND >= arene.COUT_CHANGER,
    'un changement est toujours payable après le revenu de round : le banc n est jamais verrouillé',
  );
  // Changement ILLÉGAL (cible K.O.) : IGNORÉ, mais l'action `puis` se joue quand même.
  const cChgKo = arene.creerCombat(['classico', 'theo'], ['pasteka'], 1);
  cChgKo.equipes.a[1].pv = 0;
  const evChgKo = arene.jouerRound(cChgKo, { changer: 1, puis: 0 }, rngF, 0);
  assert.equal(cChgKo.actifs.a, 0, 'changement vers une carte K.O. : ignoré');
  assert.ok(
    evChgKo.some((e) => e.t === 'annonce' && e.cote === 'a' && e.texte.includes(cChgKo.equipes.a[0].attaques[0].nom)),
    'changement ignoré : l action `puis` se joue quand même',
  );

  // Prime de skill, comeback, et Garde « dans le vide ».
  const cParF2 = arene.creerCombat(['classico'], ['pasteka'], 1);
  const cBienF2 = arene.creerCombat(['classico'], ['pasteka'], 1);
  cParF2.energie.a = 0; cBienF2.energie.a = 0;
  arene.jouerRound(cParF2, 0, rngF, 0, 'parfait');
  arene.jouerRound(cBienF2, 0, rngF, 0, 'bien');
  assert.equal(cParF2.energie.a - cBienF2.energie.a, arene.ENERGIE_PARFAIT, 'un tap PARFAIT rapporte ENERGIE_PARFAIT');
  const cKoTemoin = arene.creerCombat(['classico', 'theo'], ['bubble-master'], 1);
  cKoTemoin.energie.a = 0;
  const evKoTemoin = arene.jouerRound(cKoTemoin, 0, rngF, 0);
  const cKoChute = arene.creerCombat(['classico', 'theo'], ['bubble-master'], 1);
  cKoChute.energie.a = 0;
  cKoChute.equipes.a[0].pv = 1;
  const evKoChute = arene.jouerRound(cKoChute, 0, rngF, 0);
  assert.equal(evKoTemoin.some((e) => e.t === 'ko'), false, 'témoin : personne ne tombe');
  assert.ok(evKoChute.some((e) => e.t === 'ko' && e.cote === 'a'), 'la carte du joueur tombe');
  assert.equal(cKoChute.energie.a - cKoTemoin.energie.a, arene.ENERGIE_KO, 'comeback : ENERGIE_KO au camp qui perd une carte');
  const cGachee = arene.creerCombat(['classico'], ['pasteka'], 1);
  cGachee.energie.a = 0;
  // choixB = 1 → « Carapace de pastèque » (type bouclier) : une action NON offensive
  const evGachee = arene.jouerRound(cGachee, 'garde', rngF, 1, 'bien');
  assert.ok(evGachee.some((e) => e.t === 'statut' && e.cle === 'garde-gachee'), 'Garde contre une action non offensive : remboursée');
  assert.equal(
    cGachee.energie.a,
    Math.min(arene.ENERGIE_MAX, arene.ENERGIE_PAR_ROUND + arene.ENERGIE_GARDE_GACHEE),
    'remboursement exact de ENERGIE_GARDE_GACHEE',
  );

  // --- 🩹 F3 · PIPELINE D'IMPACT UNIQUE (le bug historique n°1) ----------------------
  // `mut.degatsMult` DOIT s'appliquer aux QUATRE sources. Avant la refonte, quatre
  // chemins de calcul non factorisés en oubliaient chacun au moins un — la Signature,
  // l'attaque la plus importante du jeu, sautait le mutateur. On mesure les dégâts avec
  // et sans mutateur, à rng identique, et on exige le RAPPORT exact `degatsMult`.
  const MUT_F3 = { id: 'test-verre-fin', nom: 'Verre fin (test)', emoji: '💢', desc: 'test', degatsMult: 2 };
  const totalDegatsB = (evts) => evts.filter((e) => e.t === 'degats' && e.cote === 'b').reduce((s, e) => s + e.valeur, 0);
  const sourcesF3 = {
    // 1️⃣ attaque de base
    attaque: (mut) => {
      const c = arene.creerCombat(['bubble-master'], ['theo'], 1, {}, {}, mut);
      return totalDegatsB(arene.jouerRound(c, 0, rngF, 0));
    },
    // 2️⃣ Signature (jauge forcée pleine)
    signature: (mut) => {
      const c = arene.creerCombat(['bubble-master'], ['theo'], 1, {}, {}, mut);
      c.equipes.a[0].charge = arene.CHARGE_MAX;
      return totalDegatsB(arene.jouerRound(c, 'signature', rngF, 0));
    },
    // 3️⃣ riposte de parade parfaite
    riposte: (mut) => {
      const c = arene.creerCombat(['classico'], ['classico'], 1, {}, {}, mut);
      const ev = arene.jouerRound(c, 'garde', rngF, 0, 'parfait');
      const iRip = ev.findIndex((e) => e.t === 'riposte');
      const dg = ev.slice(iRip).find((e) => e.t === 'degats' && e.cote === 'b');
      return dg ? dg.valeur : 0;
    },
    // 4️⃣ dégâts SECONDAIRES (consommable « Bonbon Piquant » → encaisserDegats)
    secondaire: (mut) => {
      const c = arene.creerCombat(['classico'], ['theo'], 1, {}, {}, mut);
      const ev = arene.jouerRound(c, { objet: 'piment' }, rngF, 0);
      const dg = ev.filter((e) => e.t === 'degats' && e.cote === 'b');
      return dg.length ? dg[0].valeur : 0;
    },
  };
  for (const [source, mesurer] of Object.entries(sourcesF3)) {
    const sans = mesurer(undefined);
    const avec = mesurer(MUT_F3);
    assert.ok(sans > 0, `source ${source} : le témoin doit infliger des dégâts`);
    assert.equal(avec, sans * MUT_F3.degatsMult, `mut.degatsMult DOIT s appliquer à la source « ${source} » (${sans} → ${avec})`);
  }

  // Le filet du 26/07 : une réduction cumulée > 100 % rend 0 dégât — jamais des PV.
  const cFiletF3 = arene.creerCombat(['bubble-master'], ['theo'], 1);
  const victimeF3 = cFiletF3.equipes.b[0];
  victimeF3.pv = Math.round(victimeF3.pvMax / 2);
  arene.poserStatut(victimeF3, 'garde', -1, 1.8); // combo d'objets historique : 180 % de réduction
  const pvAvantFilet = victimeF3.pv;
  const evFiletF3 = arene.jouerRound(cFiletF3, 0, rngF, 0);
  const dgFiletF3 = evFiletF3.filter((e) => e.t === 'degats' && e.cote === 'b');
  assert.ok(dgFiletF3.length > 0, 'un impact a bien eu lieu');
  assert.ok(dgFiletF3.every((e) => e.valeur >= 0), 'aucun dégât NÉGATIF ne sort du pipeline');
  assert.ok(victimeF3.pv <= pvAvantFilet, 'une réduction > 100 % ne SOIGNE jamais la cible');

  // --- 💨 F4 · LE RATÉ DEVIENT UN COUP EFFLEURÉ (§A6) --------------------------------
  // Avec un rng qui force le raté : la cible perd QUAND MÊME des PV (fini l'échec sec),
  // mais aucune marque ni aucun statut n'est posé. Fraisy (fruit) pose Collant sur sa
  // spé, et son trait `saignee` pose une brûlure : les deux doivent rester absents.
  const cEffl = arene.creerCombat(['fraisy'], ['classico'], 1);
  const pvBAvantEffl = cEffl.equipes.b[0].pv;
  const evEffl = arene.jouerRound(cEffl, 1, rngRate, 0);
  assert.ok(evEffl.some((e) => e.t === 'statut' && e.cle === 'effleure'), 'le raté est journalisé comme un coup effleuré');
  const dgEffl = evEffl.filter((e) => e.t === 'degats' && e.cote === 'b').reduce((s, e) => s + e.valeur, 0);
  assert.ok(dgEffl > 0, 'un coup effleuré inflige quand même des dégâts (plus d échec sec)');
  assert.ok(cEffl.equipes.b[0].pv < pvBAvantEffl, 'la cible perd bien des PV');
  assert.equal(arene.aStatut(cEffl.equipes.b[0], 'collant'), false, 'effleuré : AUCUNE marque de famille posée');
  assert.equal(arene.aStatut(cEffl.equipes.b[0], 'brulure'), false, 'effleuré : AUCUN statut de trait posé');
  // Témoin plein : mêmes cartes, rng médian → marque ET statut posés, dégâts supérieurs.
  const cPlein = arene.creerCombat(['fraisy'], ['classico'], 1);
  const evPlein = arene.jouerRound(cPlein, 1, rngF, 0);
  assert.equal(evPlein.some((e) => e.t === 'statut' && e.cle === 'effleure'), false, 'témoin : impact plein');
  const dgPlein = evPlein.filter((e) => e.t === 'degats' && e.cote === 'b').reduce((s, e) => s + e.valeur, 0);
  assert.ok(dgPlein > dgEffl, 'un impact plein tape plus fort qu un coup effleuré');
  assert.equal(arene.aStatut(cPlein.equipes.b[0], 'collant'), true, 'témoin : la marque de famille est posée');
  assert.ok(arene.EFFLEURE_MULT > 0 && arene.EFFLEURE_MULT < 1, 'EFFLEURE_MULT est bien un amortissement, pas une annulation');
  // Un tap PARFAIT et le trait `precise` garantissent l'impact plein, même rng au pire.
  assert.equal(
    arene.jouerRound(arene.creerCombat(['fraisy'], ['classico'], 1), 1, rngRate, 0, 'parfait')
      .some((e) => e.t === 'statut' && e.cle === 'effleure'),
    false, 'un tap PARFAIT ne peut jamais effleurer',
  );
  assert.ok(arene.FICHES.classico.attaques[0].traits.includes('precise'), 'prémisse : l attaque 0 de Classico est `precise`');
  assert.equal(
    arene.jouerRound(arene.creerCombat(['classico'], ['pasteka'], 1), 0, rngRate, 0)
      .some((e) => e.t === 'statut' && e.cle === 'effleure'),
    false, 'le trait `precise` ne peut jamais effleurer',
  );


  // --- 🤖 F5 · L'IA : contraintes absolues + intention non recalculée ---------------
  // Échantillon SEEDÉ (aucun test instable) : 4 compositions, 200 combats, choix joueur
  // tirés du même rng. On vérifie les interdits produit (§0.9) puis la fidélité de
  // l'intention annoncée. Les équipes du JOUEUR sont volontairement choisies sans aucun
  // vol d'énergie (ni trait `recul`, ni signature `energieAdverse`) : voir le bloc 🐞
  // juste après, qui isole précisément ce qui casse l'invariant.
  const COMPOS_IA = [
    [['boba', 'classico', 'theo'], ['lacto', 'sucrette', 'fraisy']],
    [['mango', 'litchee', 'passion'], ['citro', 'pasteka', 'jelly']],
    [['mochito', 'coco', 'pudding'], ['nuage', 'taro-queen', 'oreo-star']],
    [['caramel-chef', 'brown-sugar-king', 'lacto'], ['boba', 'classico', 'theo']],
  ];
  // Texte que le moteur DOIT contenir pour l'intention verrouillée. Dérivé des helpers
  // publics (`signatureDe`, `titreIntentionChangement`) : aucun libellé écrit en dur.
  const texteAttenduIA = (etat, intention) => {
    const b = etat.equipes.b[etat.actifs.b];
    if (intention === 'garde') return arene.TITRE_INTENTION_GARDE;
    if (typeof intention === 'object') return arene.titreIntentionChangement(etat.equipes.b[intention.changer]?.nom ?? '?');
    if (intention === 'signature') return arene.signatureDe(b).nom;
    return b.attaques[intention].nom;
  };
  let roundsIA = 0, riposteCoteB = 0, talentsCoteB = 0, energieHorsBornes = 0, intentionsTrahies = 0;
  const intentionsVues = new Set();
  for (let s = 0; s < 200; s++) {
    const [idsA, idsB] = COMPOS_IA[s % COMPOS_IA.length];
    const rngIA = shooter.creerRng(31337 + s * 7919);
    const combatIA = arene.creerCombat(idsA, idsB, 1);
    for (let r = 0; r < 50 && !combatIA.fini; r++) {
      const intention = combatIA.intentionB;
      const actifAvant = combatIA.actifs.b;
      const etourdiAvant = arene.aStatut(combatIA.equipes.b[actifAvant], 'etourdi');
      const attendu = texteAttenduIA(combatIA, intention);
      intentionsVues.add(typeof intention === 'object' ? 'changer' : String(intention));
      const evts = arene.jouerRound(
        combatIA, [0, 1, 'signature', 'garde'][Math.floor(rngIA() * 4)], rngIA, undefined,
        ['parfait', 'bien', 'rate'][Math.floor(rngIA() * 3)],
      );
      roundsIA++;
      // 1) l'IA ne riposte JAMAIS (la riposte reste la prime au skill du joueur)
      if (evts.some((e) => e.t === 'riposte' && e.cote === 'b')) riposteCoteB++;
      // 2) l'IA n'a JAMAIS de talent
      for (const cb of combatIA.equipes.b) if (cb.talents) talentsCoteB++;
      // 3) l'énergie reste dans ses bornes des DEUX côtés (jamais de dette)
      for (const cote of ['a', 'b']) {
        if (combatIA.energie[cote] < 0 || combatIA.energie[cote] > arene.ENERGIE_MAX) energieHorsBornes++;
      }
      // 4) l'intention verrouillée est bien celle jouée — dans le domaine où elle
      //    RESTE exécutable : même actif, actif vivant, non étourdi, cible du
      //    changement encore sur le banc. Hors de ce domaine, la carte annoncée n'est
      //    tout simplement plus là pour jouer (un mort ne joue pas son intention).
      const memeActif = combatIA.actifs.b === actifAvant;
      const vivant = combatIA.equipes.b[actifAvant].pv > 0;
      const pasEtourdi = !etourdiAvant && !evts.some((e) => e.t === 'statut' && e.cle === 'etourdi-passe' && e.cote === 'b');
      const cibleEncoreAuBanc = typeof intention !== 'object'
        || (intention.changer !== actifAvant && (combatIA.equipes.b[intention.changer]?.pv ?? 0) > 0);
      if (!combatIA.fini && memeActif && vivant && pasEtourdi && cibleEncoreAuBanc) {
        const annonces = evts.filter((e) => e.t === 'annonce' && e.cote === 'b').map((e) => e.texte).join(' | ');
        if (!annonces.includes(attendu)) intentionsTrahies++;
      }
    }
  }
  assert.ok(roundsIA > 1500, `échantillon IA suffisant (${roundsIA} rounds joués)`);
  assert.deepEqual([...intentionsVues].sort(), ['0', '1', 'changer', 'garde', 'signature'],
    'les 5 formes d intention (dont `garde` et `changer`, nouvelles) sont exercées par l échantillon');
  assert.equal(riposteCoteB, 0, 'l IA ne riposte JAMAIS (§0.9)');
  assert.equal(talentsCoteB, 0, 'l IA n a JAMAIS de talent (§0.9)');
  assert.equal(energieHorsBornes, 0, 'l énergie reste dans [0, ENERGIE_MAX] : l IA ne dépense jamais ce qu elle n a pas');
  assert.equal(intentionsTrahies, 0, 'l intention annoncée est EXACTEMENT celle jouée (jamais recalculée après le choix du joueur)');

  // ✅ NON-RÉGRESSION (ex-🐞, corrigé le 27/07) — VOLER L'ÉNERGIE ADVERSE NE PEUT PLUS
  // ANNULER L'ACTION DÉJÀ ANNONCÉE. `choisirActionIA` verrouille son intention à la fin du
  // round précédent en anticipant le revenu de round (`energiePrevue`) ; le joueur pouvait
  // ensuite VIDER la réserve adverse pendant le round (trait `recul`, signature
  // `energieAdverse`), et le garde-fou d'`agir()` repliait la Spé promise sur l'attaque de
  // base SANS aucun événement. Mesuré sur le balayage exhaustif des états où le mensonge
  // est possible (5 sources de vol × 7 adversaires × {Spé, Changement}) : 44/58 avant,
  // 0/58 après. `energieReservee` protège désormais le coût de l'action engagée.
  const cVolEnergie = arene.creerCombat(['bubble-master'], ['taro-queen'], 1);
  cVolEnergie.energie.b = arene.COUT_SPE - arene.ENERGIE_PAR_ROUND; // spé tout juste payable au verrou
  cVolEnergie.intentionB = 1;
  const titreAnnonceAuJoueur = arene.decrireIntention(cVolEnergie).titre;
  assert.equal(titreAnnonceAuJoueur, arene.FICHES['taro-queen'].attaques[1].nom, 'l UI annonce bien la Spé adverse');
  // le joueur joue la spé de Bubble Master, qui porte le trait `recul` (−1 ⚡ adverse)
  assert.ok(arene.FICHES['bubble-master'].attaques[1].traits.includes('recul'), 'prémisse : la spé du joueur vole de l énergie');
  const evVolEnergie = arene.jouerRound(cVolEnergie, 1, rngF, undefined);
  const annonceReelleB = evVolEnergie.filter((e) => e.t === 'annonce' && e.cote === 'b').map((e) => e.texte).join(' | ');
  assert.ok(
    annonceReelleB.includes(titreAnnonceAuJoueur),
    `la Spé annoncée est BIEN jouée malgré le vol d énergie (annoncé « ${titreAnnonceAuJoueur} », joué « ${annonceReelleB} »)`,
  );
  assert.equal(cVolEnergie.equipes.b[0].speRestantes, arene.SPE_USAGES - 1, 'la Spé promise consomme bien sa munition');

  // Même propriété sur un CHANGEMENT annoncé (COUT_CHANGER) : c'était le second visage du
  // même mensonge — l'entrée annoncée n'avait tout simplement pas lieu, sans un événement.
  const cVolChangement = arene.creerCombat(['bubble-master'], ['taro-queen', 'lacto'], 1);
  cVolChangement.energie.b = arene.COUT_CHANGER - arene.ENERGIE_PAR_ROUND;
  cVolChangement.intentionB = { changer: 1 };
  const titreChangementPromis = arene.decrireIntention(cVolChangement).titre;
  assert.equal(titreChangementPromis, arene.titreIntentionChangement(cVolChangement.equipes.b[1].nom),
    'l UI annonce bien le changement adverse');
  const evVolChangement = arene.jouerRound(cVolChangement, 1, rngF, undefined);
  assert.ok(
    evVolChangement.some((e) => e.t === 'annonce' && e.cote === 'b' && e.texte.includes(titreChangementPromis)),
    'le changement annoncé a bien lieu malgré le vol d énergie',
  );
  assert.equal(cVolChangement.actifs.b, 1, 'l entrant annoncé est réellement sur le terrain');

  // ⚖️ CONTREPARTIE À BORNER : la réserve ne doit protéger QUE le coût de l'action engagée,
  // et rien d'autre. Hors réservation, le vol garde toute sa force — y compris la signature
  // de Bubble Master, dont le contrat de contenu est de VIDER la réserve adverse.
  for (const intentionSansCout of [0, 'garde']) {
    const cVide = arene.creerCombat(['bubble-master'], ['taro-queen', 'lacto'], 1);
    cVide.equipes.a[0].charge = arene.CHARGE_MAX;
    cVide.energie.b = arene.ENERGIE_MAX - arene.ENERGIE_PAR_ROUND;
    cVide.intentionB = intentionSansCout;
    assert.equal(arene.SIGNATURES_CARTE['bubble-master'].energieAdverse, arene.ENERGIE_MAX,
      'prémisse : le Jugement du Boba vide la réserve adverse');
    arene.jouerRound(cVide, 'signature', rngF, undefined);
    assert.equal(cVide.energie.b, 0,
      `une intention gratuite (« ${intentionSansCout} ») ne réserve RIEN : la réserve adverse est bien vidée`);
  }
  // Et la réserve TOMBE dès que l'action engagée est jouée : b ne devient pas immunisé au
  // vol pour le reste du round (sinon le plancher serait un bouclier permanent).
  const cApresAction = arene.creerCombat(['bubble-master'], ['taro-queen'], 1);
  cApresAction.intentionB = 1;
  cApresAction.energie.b = arene.ENERGIE_MAX;
  arene.jouerRound(cApresAction, 0, rngF, undefined);
  assert.equal(arene.energieReservee(cApresAction, 'b'), 0,
    'après le round, plus aucune énergie n est réservée côté b');
  assert.equal(arene.energieReservee(cApresAction, 'a'), 0,
    'le camp du joueur ne réserve JAMAIS rien : il ne verrouille pas d intention à l avance');
  // Et le vol lui-même n annonce QUE ce qu il a réellement pris : la réserve peut le
  // bloquer, or annoncer « le camp adverse perd 1 ⚡ » sans rien retirer serait exactement
  // le même mensonge d UI, en plus petit. L événement disparaît quand le vol ne prend rien.
  const cVolAnnonce = arene.creerCombat(['bubble-master'], ['taro-queen'], 1);
  cVolAnnonce.energie.b = arene.COUT_SPE - arene.ENERGIE_PAR_ROUND;
  cVolAnnonce.intentionB = 1;
  const evAnnonceVol = arene.jouerRound(cVolAnnonce, 1, rngF, undefined);
  assert.equal(evAnnonceVol.some((e) => e.t === 'statut' && e.cle === 'recul'), false,
    'un recul entièrement bloqué par la réserve n annonce RIEN');
  const cVolReel = arene.creerCombat(['bubble-master'], ['taro-queen'], 1);
  cVolReel.energie.b = arene.ENERGIE_MAX;
  cVolReel.intentionB = 0; // intention gratuite → rien de réservé, le vol passe
  const evVolReel = arene.jouerRound(cVolReel, 1, rngF, undefined);
  assert.ok(evVolReel.some((e) => e.t === 'statut' && e.cle === 'recul' && e.texte.includes(String(arene.RECUL_ENERGIE))),
    'un recul qui prend bien son dû est annoncé pour le montant EXACT retiré');

  // --- ⏱️ F6 · DURÉE DE COMBAT (§A9 : jamais avant le round 4, jamais après le 25) ---
  // Protocole IDENTIQUE à celui documenté dans arene.ts (200 combats seedés × 5
  // compositions, actions du joueur tirées du même rng) — c'est la mesure de référence
  // de la refonte. Les bornes viennent de constantes, la longueur du run aussi.
  const ROUND_MIN_F6 = 4;
  const ROUND_MAX_F6 = 25;
  const COMPOS_F6 = [
    [['boba', 'classico', 'theo'], ['lacto', 'paillette', 'sucrette']],
    [['fraisy', 'mango', 'litchee'], ['passion', 'citro', 'pasteka']],
    [['popping', 'jelly', 'mochito'], ['coco', 'pudding', 'nuage']],
    [['taro-queen', 'matcha-sensei', 'oreo-star'], ['brown-sugar-king', 'caramel-chef', 'bubble-master']],
    [['boba', 'fraisy', 'popping'], ['classico', 'mango', 'jelly']],
  ];
  let roundMinF6 = Infinity, roundMaxF6 = 0, inachevesF6 = 0;
  for (let s = 0; s < 200; s++) {
    const [idsA, idsB] = COMPOS_F6[s % COMPOS_F6.length];
    const rngF6 = shooter.creerRng(1000 + s * 7919);
    const combatF6 = arene.creerCombat(idsA, idsB, 1);
    let tours = 0;
    while (!combatF6.fini && tours < 200) {
      arene.jouerRound(
        combatF6, [0, 1, 'signature', 'garde'][Math.floor(rngF6() * 4)], rngF6, undefined,
        ['parfait', 'bien', 'rate'][Math.floor(rngF6() * 3)],
      );
      tours++;
    }
    if (!combatF6.fini) inachevesF6++;
    roundMinF6 = Math.min(roundMinF6, combatF6.round);
    roundMaxF6 = Math.max(roundMaxF6, combatF6.round);
  }
  assert.equal(inachevesF6, 0, 'aucun combat ne s enlise : la TERMINAISON est une propriété du moteur');
  assert.ok(roundMinF6 >= ROUND_MIN_F6, `aucun combat ne se termine avant le round ${ROUND_MIN_F6} (mesuré : ${roundMinF6})`);
  assert.ok(roundMaxF6 <= ROUND_MAX_F6, `aucun combat ne dépasse le round ${ROUND_MAX_F6} (mesuré : ${roundMaxF6})`);
  // Le COUP DE CHAUD est ce qui rend la borne haute mathématique et non espérée :
  // neutre avant ROUND_ESCALADE, puis strictement croissant, puis plafonné.
  assert.equal(arene.multEscalade(arene.ROUND_ESCALADE - 1), 1, 'escalade neutre avant ROUND_ESCALADE');
  assert.ok(arene.multEscalade(arene.ROUND_ESCALADE) > 1, 'escalade active dès ROUND_ESCALADE');
  assert.ok(arene.multEscalade(ROUND_MAX_F6) > arene.multEscalade(arene.ROUND_ESCALADE), 'escalade croissante');
  assert.equal(arene.multEscalade(9999), arene.ESCALADE_MAX, 'escalade plafonnée à ESCALADE_MAX');
  // 🐞 CONNU : la borne haute de §A9 ne tient PAS sur les duels EN MIROIR défensifs.
  // Mesuré : `['lacto','pasteka','mochito']` contre lui-même (coût 6 ≤ BUDGET_EQUIPE),
  // joueur 100 % Garde avec un timing raté, rng constant 0,5 → 34 rounds. Le combat
  // TERMINE toujours (l'escalade fait son travail), mais bien au-delà du round 25.
  // On verrouille ici ce qui est réellement garanti — la terminaison — pour que la
  // régression « combat qui ne finit plus » soit détectée le jour où elle revient.
  const EQUIPE_MIROIR_F6 = ['lacto', 'pasteka', 'mochito'];
  assert.ok(economie.coutEquipe(EQUIPE_MIROIR_F6) <= economie.BUDGET_EQUIPE, 'prémisse : équipe miroir LÉGALE');
  const cMiroirF6 = arene.creerCombat(EQUIPE_MIROIR_F6, EQUIPE_MIROIR_F6, 1);
  let toursMiroir = 0;
  while (!cMiroirF6.fini && toursMiroir < 200) { arene.jouerRound(cMiroirF6, 'garde', rngF, undefined, 'rate'); toursMiroir++; }
  assert.equal(cMiroirF6.fini, true, 'même le pire miroir défensif TERMINE (garantie de l escalade)');
  assert.ok(cMiroirF6.round > ROUND_MAX_F6,
    `🐞 connu : ce miroir défensif dépasse la borne §A9 (${cMiroirF6.round} rounds > ${ROUND_MAX_F6}) — à signaler, pas à masquer`);


  // --- 🧩 F7 · MOTEUR DE CASCADE : les 7 spéciales historiques, inchangées ----------
  // Le LOT C remplace 3 blocs `if` codés en dur par un registre + une file de
  // propagation. Le contrat est « comportement STRICTEMENT identique » pour les 7
  // perles historiques : on le vérifie perle par perle, sur des plateaux fabriqués.
  const LANCEUR_F7 = { x: shooter.LARGEUR_TERRAIN / 2, y: shooter.LIGNE_LIMITE * shooter.LIGNE_H + 1.6 };
  const clonerF7 = (e) => JSON.parse(JSON.stringify(e));
  const perleF7 = (couleur, extra) => ({ couleur, ...(extra || {}) });
  // Plateau d'essai : un plafond plein (ligne 0) + une ligne 1 sur mesure. Tout ce qui
  // est aléatoire est neutralisé (pas de descente, pas de semis, pas de régénération).
  const plateauF7 = (lignes, couleurTir) => {
    const e = shooter.creerPartieInfini(() => 0.5);
    e.grille = lignes.map((cases, r) => ({ decalee: r % 2 === 1, cases: cases.slice() }));
    e.regenerer = false; e.specialsAuto = false; e.tirsParDescente = 0;
    e.tirsRestants = null; e.tirsMax = null; e.objectif = { type: 'nettoyer' };
    e.objProgres = 0; e.chaine = 0; e.fever = 0; e.graceChaine = 0;
    e.couleurCourante = couleurTir; e.couleurSuivante = couleurTir;
    return e;
  };
  // Angle DÉTERMINISTE dont la case de pose est exactement `cible` (balayage fin).
  const viserF7 = (etat, cible) => {
    for (let k = 0; k < 900; k++) {
      const angle = -Math.PI + (k + 0.5) * (Math.PI / 900);
      const g = clonerF7(etat).grille;
      const p = shooter.casePourImpact(g, shooter.simulerVolPlateau(g, LANCEUR_F7, angle).impact);
      if (p && p.r === cible.r && p.c === cible.c) return angle;
    }
    return null;
  };
  const PLAFOND_F7 = () => Array.from({ length: shooter.COLS }, () => perleF7(4));
  // Ligne 1 : deux perles de la couleur tirée en 0 et 1, la spéciale EN 1, du remplissage
  // ensuite. Poser en (2,1) forme donc un groupe de 3 qui emporte la spéciale.
  const ligneAvecSpecial = (couleur, special, extra) => [
    perleF7(couleur), perleF7(couleur, { special, ...(extra || {}) }), perleF7(1),
    perleF7(2), perleF7(3), perleF7(4), perleF7(5), perleF7(2),
  ];
  const tirerSurSpecial = (special, extra, options) => {
    const e = plateauF7([PLAFOND_F7(), ligneAvecSpecial(0, special, extra)], 0);
    Object.assign(e, (options && options.etat) || {});
    const angle = viserF7(e, { r: 2, c: 1 });
    assert.ok(angle !== null, `plateau d essai ${special} : aucun angle ne pose en (2,1)`);
    return { etat: e, res: shooter.tirer(e, LANCEUR_F7, angle, () => 0.5, (options && options.munition) || null, !!(options && options.parfait)) };
  };
  const perlesRestantes = (e) => e.grille.flatMap((l) => l.cases).filter(Boolean);

  // 1️⃣ 💥 bombe — détone quand une VOISINE éclate (détonation de proximité)
  const bombeF7 = plateauF7([PLAFOND_F7(), [
    perleF7(0), perleF7(0), perleF7(1, { special: 'bombe' }), perleF7(2), perleF7(3), perleF7(4), perleF7(5), perleF7(2),
  ]], 0);
  const angleBombeF7 = viserF7(bombeF7, { r: 2, c: 1 });
  const resBombeF7 = shooter.tirer(bombeF7, LANCEUR_F7, angleBombeF7, () => 0.5);
  assert.equal(resBombeF7.explosions, 1, 'bombe : une détonation de proximité');
  assert.ok(resBombeF7.eclatees.length > 3, 'bombe : elle emporte ses voisines en plus du groupe');
  assert.equal(perlesRestantes(bombeF7).some((b) => b.special === 'bombe'), false, 'bombe : partie avec sa détonation');
  // 2️⃣ 🧊 glaçon — BLOC : ne se matche jamais par la couleur
  assert.equal(shooter.estBloc({ couleur: 0, special: 'glacon' }), true, 'glaçon : bloc');
  assert.equal(shooter.estBloc({ couleur: 0 }), false, 'perle ordinaire : pas un bloc');
  assert.equal(
    shooter.groupeMemeCouleur(plateauF7([[perleF7(0), perleF7(0, { special: 'glacon' }), perleF7(0)]], 0).grille, { r: 0, c: 1 }).length,
    0, 'glaçon : un bloc ne forme jamais de groupe',
  );
  // 3️⃣ ❄️ givre — armure de GIVRE_PV coups AU MATCH, mais emporté d'un coup par une
  //     bombe ou un TIR PARFAIT (comportement de production, à ne surtout pas changer)
  const givreMatch = tirerSurSpecial('givre', { pv: shooter.GIVRE_PV });
  const givreRestant = perlesRestantes(givreMatch.etat).find((b) => b.special === 'givre');
  assert.ok(givreRestant, 'givre : survit au premier match');
  assert.equal(givreRestant.pv, shooter.GIVRE_PV - 1, 'givre : l armure perd exactement 1 PV par match');
  assert.equal(
    perlesRestantes(tirerSurSpecial('givre', { pv: shooter.GIVRE_PV }, { munition: 'bombe' }).etat).some((b) => b.special === 'givre'),
    false, 'givre : une BOMBE l emporte d un seul coup',
  );
  assert.equal(
    perlesRestantes(tirerSurSpecial('givre', { pv: shooter.GIVRE_PV }, { parfait: true }).etat).some((b) => b.special === 'givre'),
    false, 'givre : un TIR PARFAIT l emporte d un seul coup',
  );
  // 4️⃣ 🌈 arc — joker de couleur dans un groupe
  assert.equal(
    shooter.groupeMemeCouleur(
      plateauF7([[perleF7(2), perleF7(2), perleF7(0, { special: 'arc' }), perleF7(5)]], 2).grille, { r: 0, c: 0 },
    ).length, 3, 'arc : le joker rejoint le groupe quelle que soit sa couleur',
  );
  // 5️⃣ ⭐ bonus — BONUS_POINTS immédiats et un compteur dédié
  const bonusF7 = tirerSurSpecial('bonus');
  assert.equal(bonusF7.res.bonusPop, 1, 'bonus : compteur bonusPop');
  assert.ok(bonusF7.res.points >= shooter.BONUS_POINTS, 'bonus : au moins BONUS_POINTS de plus');
  // 6️⃣ 🌟 supernova — emporte TOUTES les perles de sa couleur, une seule fois par tir
  const superF7 = plateauF7([
    PLAFOND_F7(),
    [perleF7(0), perleF7(0, { special: 'etoile' }), perleF7(3), perleF7(3), perleF7(1), perleF7(3), perleF7(1), perleF7(3)],
  ], 0);
  const couleurSuper = superF7.grille[1].cases[1].couleur;
  const avantSuper = perlesRestantes(superF7).filter((b) => b.couleur === couleurSuper).length;
  const resSuperF7 = shooter.tirer(superF7, LANCEUR_F7, viserF7(superF7, { r: 2, c: 1 }), () => 0.5);
  assert.equal(resSuperF7.etoiles, 1, 'supernova : une seule détonation');
  assert.ok(avantSuper > 1, 'prémisse : plusieurs perles de la couleur de la supernova');
  assert.equal(
    perlesRestantes(superF7).filter((b) => b.couleur === couleurSuper && !shooter.estBloc(b)).length, 0,
    'supernova : TOUTE sa couleur part avec elle',
  );
  // 7️⃣ 🎁 perle « +1 tir » — rend exactement un tir (aventure)
  const tirPlusF7 = tirerSurSpecial('tir', undefined, { etat: { tirsRestants: 10, tirsMax: 10 } });
  assert.equal(tirPlusF7.res.tirsBonus, 1, 'perle cadeau : un tir rendu');
  assert.equal(tirPlusF7.etat.tirsRestants, 10, '+1 tir compense exactement le tir consommé');

  // --- 🧩 F7 bis · les 6 NOUVELLES perles et la file de propagation ------------------
  const laserF7 = tirerSurSpecial('laser');
  assert.equal(laserF7.res.lasers, 1, 'paille : une ligne rasée');
  assert.equal(
    laserF7.etat.grille[1] ? laserF7.etat.grille[1].cases.filter(Boolean).length : 0, 0,
    'paille : TOUTE sa ligne horizontale est aspirée',
  );
  const contagionF7 = plateauF7([PLAFOND_F7(), ligneAvecSpecial(0, 'contagion')], 0);
  const avantContagion = contagionF7.grille[0].cases.map((b) => b.couleur).join('');
  const resContagionF7 = shooter.tirer(contagionF7, LANCEUR_F7, viserF7(contagionF7, { r: 2, c: 1 }), () => 0.5);
  assert.equal(resContagionF7.contagions, 1, 'sirop : une contamination');
  assert.notEqual(contagionF7.grille[0].cases.map((b) => (b ? b.couleur : '.')).join(''), avantContagion,
    'sirop : les voisines survivantes sont repeintes (préparation de combo, aucune destruction)');
  const lienF7 = plateauF7([PLAFOND_F7(), [
    perleF7(0), perleF7(0, { special: 'lien', lienId: 7 }), perleF7(1), perleF7(2),
    perleF7(3), perleF7(4), perleF7(5), perleF7(2, { special: 'lien', lienId: 7 }),
  ]], 0);
  const resLienF7 = shooter.tirer(lienF7, LANCEUR_F7, viserF7(lienF7, { r: 2, c: 1 }), () => 0.5);
  assert.equal(resLienF7.liens, 1, 'jumelles : une paire déclenchée');
  assert.equal(perlesRestantes(lienF7).filter((b) => b.special === 'lien').length, 0,
    'jumelles : la jumelle éloignée part aussi, où qu elle soit');
  // 🔗 anti-boucle : une jumelle appelée cherche sa paire, ne trouve plus rien, s arrête.
  const lienBoucle = plateauF7([PLAFOND_F7(), [
    perleF7(0), perleF7(0, { special: 'lien', lienId: 1 }), perleF7(0, { special: 'lien', lienId: 1 }),
    perleF7(2), perleF7(3), perleF7(4), perleF7(5), perleF7(2),
  ]], 0);
  const resLienBoucle = shooter.tirer(lienBoucle, LANCEUR_F7, viserF7(lienBoucle, { r: 2, c: 1 }), () => 0.5);
  assert.ok(resLienBoucle.eclatees.length <= shooter.CASCADE_MAX, 'jumelles adjacentes : aucune boucle infinie');
  // 🧨 mèche : compte à rebours décrémenté à CHAQUE tir, puis explosion en croix
  const mecheF7 = plateauF7([
    PLAFOND_F7(),
    Array.from({ length: shooter.COLS }, (_, c) => perleF7(c === 4 ? 1 : 3, c === 4 ? { special: 'meche', pv: 2 } : undefined)),
  ], 5);
  const angleAilleurs = viserF7(mecheF7, { r: 2, c: 0 });
  shooter.tirer(mecheF7, LANCEUR_F7, angleAilleurs, () => 0.5);
  assert.equal(perlesRestantes(mecheF7).find((b) => b.special === 'meche').pv, 1,
    'mèche : le compte à rebours descend même si le tir ne la touche pas');
  const resMecheF7 = shooter.tirer(mecheF7, LANCEUR_F7, angleAilleurs, () => 0.5);
  assert.equal(resMecheF7.meches, 1, 'mèche : détonation à zéro');
  assert.equal(perlesRestantes(mecheF7).some((b) => b.special === 'meche'), false, 'mèche : elle disparaît en explosant');
  // 🪨 roche : bloc à ROCHE_PV, absorbe les coups, la gravité ne l emporte jamais
  assert.equal(shooter.EFFETS_PERLE.roche.pvDepart, shooter.ROCHE_PV, 'roche : PV du registre');
  assert.equal(shooter.EFFETS_PERLE.roche.neTombeJamais, true, 'roche : insensible à la gravité');
  const rocheF7 = plateauF7([
    [perleF7(4), perleF7(4), perleF7(4), null, null, null, null, null],
    [perleF7(0), perleF7(0), perleF7(1, { special: 'roche', pv: shooter.ROCHE_PV }), null, null, null, null, null],
  ], 0);
  shooter.tirer(rocheF7, LANCEUR_F7, viserF7(rocheF7, { r: 2, c: 1 }), () => 0.5, 'bombe');
  const rocheApres = perlesRestantes(rocheF7).find((b) => b.special === 'roche');
  assert.ok(rocheApres, 'roche : encore là après une bombe');
  assert.equal(rocheApres.pv, shooter.ROCHE_PV - 1, 'roche : elle encaisse 1 PV au lieu de partir');

  // ⚠️ §C5 — `clonerEtatShooter` est une deep-copy MANUELLE et l aperçu tactique rejoue
  // un VRAI `tirer()` ~11 fois par seconde pendant la visée. La 🧨 mèche décrémente son
  // `pv` à CHAQUE tir : c est LE champ qui trahirait une copie incomplète. Le test
  // historique (l.71) ne couvre que le niveau 7, sans mèche — on le rejoue ici sur le
  // premier niveau qui en porte une.
  let niveauMecheF7 = null;
  for (let n = 1; n <= 44 && niveauMecheF7 === null; n++) {
    if (shooter.creerNiveau(n).grille.flatMap((l) => l.cases).some((b) => b && b.special === 'meche')) niveauMecheF7 = n;
  }
  assert.ok(niveauMecheF7 !== null, 'le parcours porte bien au moins une perle à mèche');
  const etatMecheF7 = shooter.creerNiveau(niveauMecheF7);
  const avantApercuMeche = JSON.stringify(etatMecheF7);
  for (let k = 0; k < 12; k++) {
    shooter.previsualiserTir(etatMecheF7, LANCEUR_F7, -Math.PI + (k + 0.5) * (Math.PI / 12));
  }
  assert.equal(JSON.stringify(etatMecheF7), avantApercuMeche,
    'aperçu mutateur : le compte à rebours des mèches de la partie RÉELLE a bougé');
  // Les deux constructeurs d'EtatShooter (infini / aventure) doivent rester alignés :
  // un champ ajouté à l'un et oublié dans l'autre est un `undefined` en production.
  assert.deepEqual(
    Object.keys(shooter.creerPartieInfini(() => 0.5)).sort(),
    Object.keys(shooter.creerNiveau(13)).sort(),
    '§C5 : creerPartieInfini et creerNiveau construisent EXACTEMENT les mêmes champs',
  );
  // Invariants de génération sur TOUT le parcours (le test historique s arrête au 12).
  for (let n = 1; n <= 44; n++) {
    const gen = shooter.creerNiveau(n);
    assert.equal(shooter.orphelines(gen.grille).length, 0, `niveau ${n} : aucun plateau ne démarre avec des orphelines`);
    const paires = {};
    for (const l of gen.grille) {
      for (const b of l.cases) {
        if (b && (b.special === 'lien' || b.special === 'portail')) {
          const cle = `${b.special}:${b.lienId}`;
          paires[cle] = (paires[cle] || 0) + 1;
        }
      }
    }
    for (const [cle, nb] of Object.entries(paires)) {
      assert.equal(nb, 2, `niveau ${n} : ${cle} posée en ${nb} exemplaire(s) au lieu d une PAIRE`);
    }
  }

  // 🚧 PLAFOND DUR de la cascade : un plateau monochrome géant ne peut pas faire
  // exploser le travail d animation envoyé à l écran.
  // Plateau monochrome de plus de CASCADE_MAX perles. Le lanceur est placé SOUS le
  // plateau (paramètre `origine`) : sinon la bille partirait de l'intérieur de la
  // matière et `casePourImpact`, qui ne cherche une case libre que sur 4 rangées
  // autour de l'impact, n'aurait aucune case à proposer.
  const LIGNES_CASCADE = Math.ceil(shooter.CASCADE_MAX / shooter.COLS) + 1;
  const cascadeGeante = plateauF7(
    Array.from({ length: LIGNES_CASCADE }, () => Array.from({ length: shooter.COLS }, () => perleF7(0))), 0,
  );
  const lanceurBas = { x: shooter.LARGEUR_TERRAIN / 2, y: LIGNES_CASCADE * shooter.LIGNE_H + 1.6 };
  const debutCascade = Date.now();
  const resCascade = shooter.tirer(cascadeGeante, lanceurBas, -Math.PI / 2, () => 0.5);
  assert.ok(resCascade.eclatees.length <= shooter.CASCADE_MAX,
    `cascade bornée par CASCADE_MAX (${resCascade.eclatees.length} > ${shooter.CASCADE_MAX})`);
  assert.equal(resCascade.eclatees.length, shooter.CASCADE_MAX, 'le plafond MORD réellement sur ce plateau');
  assert.ok(Date.now() - debutCascade < 2000, 'la cascade plafonnée reste instantanée');

  // --- 🌀 F8 · PORTAILS : l'invariant ANTI-MENSONGE ---------------------------------
  // Le guide pointillé, l aperçu tactique et le tir réel partagent le pas de 0,08 de
  // `simulerVol` ET la même paire de portails (via `simulerVolPlateau`). Si l une des
  // trois divergeait, la ligne montrée au joueur mentirait. On balaie un large
  // échantillon d angles sur TOUS les niveaux à portails et on exige la même case.
  const NIVEAUX_PORTAILS = [];
  for (let n = 1; n <= 44; n++) {
    if (shooter.portailsDeGrille(shooter.creerNiveau(n).grille)) NIVEAUX_PORTAILS.push(n);
  }
  assert.ok(NIVEAUX_PORTAILS.length > 0, 'au moins un niveau porte une paire de portails');
  assert.ok(NIVEAUX_PORTAILS.every((n) => n >= 13), 'les portails n apparaissent pas avant le niveau 13 (§C3)');
  let anglesF8 = 0, sautsF8 = 0, divergencesF8 = 0, posesNullesF8 = 0;
  const ANGLES_F8 = 48;
  for (const n of NIVEAUX_PORTAILS) {
    const base = shooter.creerNiveau(n);
    for (let k = 0; k < ANGLES_F8; k++) {
      const angle = -Math.PI + (k + 0.5) * (Math.PI / ANGLES_F8);
      // 1) le GUIDE : `simulerVolPlateau` puis la case d impact (grille clonée :
      //    `casePourImpact` pousse des lignes, comportement existant)
      const grilleGuide = clonerF7(base).grille;
      const vol = shooter.simulerVolPlateau(grilleGuide, LANCEUR_F7, angle);
      const caseGuide = shooter.casePourImpact(grilleGuide, vol.impact);
      // 2) l APERÇU tactique
      const apercu = shooter.previsualiserTir(clonerF7(base), LANCEUR_F7, angle);
      // 3) le TIR RÉEL
      const tir = shooter.tirer(clonerF7(base), LANCEUR_F7, angle, () => 0.5);
      anglesF8++;
      if (vol.portailUtilise) sautsF8++;
      if (!caseGuide || !apercu.pose || !tir.pose) posesNullesF8++;
      const cle = (c) => (c ? `${c.r}:${c.c}` : 'null');
      if (cle(caseGuide) !== cle(apercu.pose) || cle(apercu.pose) !== cle(tir.pose)) divergencesF8++;
      // cohérence de la polyligne : une rupture par saut, jamais plus
      assert.ok(vol.ruptures.length === (vol.portailUtilise ? 1 : 0), 'une rupture de polyligne par saut de portail, pas plus');
      assert.ok(tir.portails === (vol.portailUtilise ? 1 : 0), 'le compteur `portails` du résultat suit le vol');
    }
  }
  assert.ok(anglesF8 >= 1000, `échantillon d angles suffisant (${anglesF8})`);
  assert.ok(sautsF8 > 0, `l échantillon emprunte réellement des portails (${sautsF8} sauts)`);
  assert.equal(divergencesF8, 0, 'guide, aperçu et tir réel désignent EXACTEMENT la même case d impact');
  assert.equal(posesNullesF8, 0, 'aucun angle ne produit de case de pose introuvable (sortie de portail bouchée)');
  // Déterminisme pur : deux vols identiques donnent la même polyligne, au point près.
  const grilleDet = shooter.creerNiveau(NIVEAUX_PORTAILS[0]).grille;
  const portailsDet = shooter.portailsDeGrille(grilleDet);
  const volDet1 = shooter.simulerVol(grilleDet, LANCEUR_F7, -Math.PI / 2.4, 0.08, portailsDet);
  const volDet2 = shooter.simulerVol(grilleDet, LANCEUR_F7, -Math.PI / 2.4, 0.08, portailsDet);
  assert.deepEqual(volDet1, volDet2, 'simulerVol avec portails est DÉTERMINISTE');
  // Un seul saut par tir : sans ce verrou, A → B → A boucle à l infini.
  let sautsMax = 0;
  for (let k = 0; k < 180; k++) {
    const v = shooter.simulerVol(grilleDet, LANCEUR_F7, -Math.PI + (k + 0.5) * (Math.PI / 180), 0.08, portailsDet);
    sautsMax = Math.max(sautsMax, v.ruptures.length);
  }
  assert.equal(sautsMax, 1, 'un seul saut de portail par tir (verrou anti-boucle)');


  // --- 🎯 F9 · LES 4 NOUVEAUX OBJECTIFS SONT RÉELLEMENT ATTEIGNABLES ----------------
  // L'historique du fichier montre 4 objectifs arithmétiquement ingagnables livrés en
  // production. Deux garde-fous ici : (1) la cible est bornée par la MATIÈRE réellement
  // posée sur le plateau, jamais par une formule en `n` seule ; (2) un bot en force
  // brute trouve effectivement une solution sur CHAQUE niveau qui porte l'objectif.
  const NIVEAU_MAX_F9 = 44;
  const niveauxParObjectif = {};
  for (let n = 1; n <= NIVEAU_MAX_F9; n++) {
    const t = shooter.paramsNiveau(n).objectif.type;
    (niveauxParObjectif[t] = niveauxParObjectif[t] || []).push(n);
  }
  for (const type of ['chaine', 'lacher', 'parfaits', 'speciales']) {
    assert.ok((niveauxParObjectif[type] || []).length > 0, `le parcours propose bien l objectif « ${type} »`);
  }
  // (1) bornes de faisabilité §C4, chacune vérifiée contre le plateau RÉEL du niveau
  for (const n of niveauxParObjectif.chaine) {
    const o = shooter.paramsNiveau(n).objectif;
    assert.ok(o.cible <= shooter.CHAINE_MAX,
      `niveau ${n} : une chaîne de ${o.cible} dépasse le multiplicateur maximal CHAINE_MAX`);
    assert.ok(o.cible >= 2, `niveau ${n} : une chaîne de ${o.cible} n est pas un objectif`);
  }
  for (const n of niveauxParObjectif.lacher) {
    const o = shooter.paramsNiveau(n).objectif;
    assert.ok(o.cible <= shooter.GROS_LACHER, `niveau ${n} : lâcher plafonné par GROS_LACHER`);
    assert.ok(o.cible <= shooter.lacherAtteignable(shooter.creerNiveau(n).grille),
      `niveau ${n} : lâcher de ${o.cible} au-dessus de ce que le plateau peut décrocher`);
  }
  for (const n of niveauxParObjectif.parfaits) {
    const p = shooter.paramsNiveau(n);
    assert.ok(p.objectif.cible <= Math.max(3, Math.floor(p.tirsMax * 0.35)),
      `niveau ${n} : plus de 35 % du budget de tirs exigé en tirs parfaits`);
  }
  for (const n of niveauxParObjectif.speciales) {
    const p = shooter.paramsNiveau(n);
    let declenchables = 0;
    for (const l of shooter.creerNiveau(n).grille) {
      for (const b of l.cases) if (shooter.infoPerle(b) && shooter.infoPerle(b).declencheObjectif) declenchables++;
    }
    assert.ok(p.objectif.cible <= declenchables,
      `niveau ${n} : ${p.objectif.cible} spéciales demandées pour ${declenchables} réellement posées`);
  }
  // (2) FORCE BRUTE : un bot déterministe (angles balayés, munition échangée ou non,
  // rng seedé) doit trouver une solution. Il n'optimise rien de subtil : s'il y arrive,
  // un joueur y arrive.
  const rejouerEnForceBrute = (n, { parfait = false, graine = 7, angles = 64 } = {}) => {
    const etat = shooter.creerNiveau(n);
    const rngBot = shooter.creerRng(graine);
    let coups = 0;
    while (!shooter.objectifAtteint(etat) && (etat.tirsRestants || 0) > 0 && !etat.perdu && coups < 80) {
      let meilleur = null;
      for (let swap = 0; swap < 2; swap++) {
        for (let k = 0; k < angles; k++) {
          const angle = -Math.PI + (k + 0.5) * (Math.PI / angles);
          const essai = clonerF7(etat);
          if (swap) shooter.echangerMunitions(essai);
          const progresAvant = essai.objProgres;
          const chaineAvant = essai.chaine;
          const r = shooter.tirer(essai, LANCEUR_F7, angle, () => 0.5, null, parfait);
          const note = (shooter.objectifAtteint(essai) ? 1e6 : 0)
            + (essai.objProgres - progresAvant) * 1000
            + (essai.chaine - chaineAvant) * 200
            + (essai.perdu ? -5e5 : 0)
            - shooter.ligneLaPlusBasse(essai.grille) * 30   // ne pas se laisser enterrer
            + r.eclatees.length * 3 + r.tombees.length * 2;
          if (!meilleur || note > meilleur.note) meilleur = { note, angle, swap };
        }
      }
      if (!meilleur) break;
      if (meilleur.swap) shooter.echangerMunitions(etat);
      shooter.tirer(etat, LANCEUR_F7, meilleur.angle, rngBot, null, parfait);
      coups++;
    }
    return { gagne: shooter.objectifAtteint(etat), progres: etat.objProgres, coups };
  };
  for (const [type, parfait] of [['chaine', false], ['lacher', false], ['parfaits', true], ['speciales', false]]) {
    for (const n of niveauxParObjectif[type]) {
      const cible = shooter.paramsNiveau(n).objectif.cible;
      let issue = null;
      // graines FIXES (jamais Math.random) : le test reste déterministe d une exécution
      // à l autre, seule la suite de munitions change d une tentative à l autre.
      for (const graine of [7, 101, 999]) {
        issue = rejouerEnForceBrute(n, { parfait, graine });
        if (issue.gagne) break;
      }
      assert.equal(issue.gagne, true,
        `niveau ${n} (${type}, cible ${cible}) : aucune solution trouvée en force brute (meilleur ${issue.progres})`);
    }
  }
  // Le FILET UNIVERSEL : plateau vidé = victoire, quel que soit l'objectif chiffré.
  for (const objectif of [
    { type: 'chaine', cible: shooter.CHAINE_MAX }, { type: 'lacher', cible: shooter.GROS_LACHER },
    { type: 'parfaits', cible: 9 }, { type: 'speciales', cible: 9 },
  ]) {
    const vide = shooter.creerNiveau(18);
    vide.grille = [{ decalee: false, cases: Array.from({ length: shooter.COLS }, () => null) }];
    vide.objectif = objectif;
    vide.objProgres = 0;
    assert.equal(shooter.objectifAtteint(vide), true,
      `plateau vidé : victoire même avec l objectif « ${objectif.type} » inachevé`);
    // …et le libellé du HUD existe pour les 4 (sinon le joueur ne sait pas quoi faire)
    assert.ok(shooter.objectifLabel(objectif).length > 0, `libellé HUD manquant pour « ${objectif.type} »`);
    assert.equal(shooter.objectifCible(objectif), objectif.cible, `objectifCible lit la cible de « ${objectif.type} »`);
  }
  // L'alerte de fin de niveau explique le VERBE des 4 nouveaux objectifs.
  for (const objectif of [
    { type: 'chaine', cible: shooter.CHAINE_MAX }, { type: 'lacher', cible: 5 },
    { type: 'parfaits', cible: 5 }, { type: 'speciales', cible: 5 },
  ]) {
    const presqueFini = shooter.creerNiveau(18);
    presqueFini.objectif = objectif;
    presqueFini.objProgres = 0;
    presqueFini.tirsRestants = 3;
    assert.ok((shooter.alerteObjectif(presqueFini) || '').length > 0,
      `aide de fin de niveau manquante pour « ${objectif.type} »`);
  }

  // --- 👅 F10 · LE GOÛT : borné, monotone, idempotent, tolérant ---------------------
  const lignesTaro = (n) => Array.from({ length: n }, () => ({ categorieId: 'milk-tea', saveurId: 'mt-taro', quantite: 1 }));
  assert.equal(economie.rangGout('taro-queen', lignesTaro(0)), 0, 'aucun achat → Goût 0');
  assert.equal(economie.rangGout('taro-queen', lignesTaro(economie.GOUT_ACHATS_PAR_RANG)), 1,
    'GOUT_ACHATS_PAR_RANG achats = +1 rang');
  assert.equal(economie.rangGout('taro-queen', lignesTaro(economie.GOUT_ACHATS_PAR_RANG - 1)), 0,
    'un achat de moins ne suffit pas');
  assert.equal(economie.rangGout('taro-queen', lignesTaro(economie.GOUT_ACHATS_PAR_RANG * economie.GOUT_MAX)),
    economie.GOUT_MAX, 'rang maximal atteint exactement au bon nombre d achats');
  assert.equal(economie.rangGout('taro-queen', lignesTaro(economie.GOUT_ACHATS_PAR_RANG * economie.GOUT_MAX * 10)),
    economie.GOUT_MAX, 'rangGout BORNÉ à GOUT_MAX : aucun power creep');
  assert.equal(economie.rangGout('boba', lignesTaro(99)), 0,
    'une carte gratuite n a aucune boisson à racheter : Goût 0, et c est voulu');
  // Barème : `bonusGout` est la SEULE table, `creerCombattant` doit s y aligner.
  assert.deepEqual(economie.bonusGout(0), { pvPct: 0, atkPct: 0, speBonus: 0, marqueBonus: 0 }, 'Goût 0 = aucun bonus');
  assert.deepEqual(economie.bonusGout(999), economie.bonusGout(economie.GOUT_MAX), 'bonusGout plafonné');
  assert.equal(economie.bonusGout(economie.GOUT_MAX).pvPct, economie.GOUT_BONUS_PCT * economie.GOUT_MAX,
    'plafond de bonus dérivé de GOUT_BONUS_PCT × GOUT_MAX');
  const carteGout0 = arene.creerCombattant('taro-queen', 1, [], 1, [], 0);
  const carteGoutMax = arene.creerCombattant('taro-queen', 1, [], 1, [], economie.GOUT_MAX);
  const ratioAttenduGout = 1 + economie.bonusGout(economie.GOUT_MAX).pvPct / 100;
  assert.ok(Math.abs(carteGoutMax.pvMax / carteGout0.pvMax - ratioAttenduGout) < 0.01,
    'PV max du combattant alignés sur bonusGout (aucune seconde formule)');
  assert.ok(Math.abs(carteGoutMax.atk / carteGout0.atk - ratioAttenduGout) < 0.01, 'ATQ alignée sur bonusGout');
  assert.equal(arene.creerCombattant('taro-queen', 1, [], 1, [], economie.GOUT_RANG_MUNITION).speRestantes,
    arene.SPE_USAGES + economie.bonusGout(economie.GOUT_RANG_MUNITION).speBonus, 'rang munition : +1 charge de Spé');
  assert.equal(arene.creerCombattant('taro-queen', 1, [], 1, [], economie.GOUT_RANG_MUNITION - 1).speRestantes,
    arene.SPE_USAGES, 'un rang sous le seuil : aucune munition en plus');
  // Le Goût ne franchit JAMAIS la ligne : le PNJ n'en a pas.
  const cGoutF10 = arene.creerCombat(['taro-queen'], ['taro-queen'], 1, {}, {}, undefined, {}, {},
    { 'taro-queen': economie.GOUT_MAX });
  assert.equal(cGoutF10.equipes.a[0].gout, economie.GOUT_MAX, 'Goût appliqué au camp joueur');
  assert.equal(cGoutF10.equipes.b[0].gout, 0, 'le PNJ n a JAMAIS de Goût (§E4)');
  assert.ok(cGoutF10.equipes.a[0].pvMax > cGoutF10.equipes.b[0].pvMax, 'et cela se voit sur les PV max');
  // Rang 5 : la marque de famille dure une action de plus (dérivé de bonusGout).
  const cMarqueGout = arene.creerCombat(['fraisy'], ['pasteka'], 1, {}, {}, undefined, {}, {},
    { fraisy: economie.GOUT_RANG_MARQUE });
  arene.jouerRound(cMarqueGout, 1, () => 0.2, 0);
  assert.equal(
    arene.toursStatut(cMarqueGout.equipes.b[0], 'collant'),
    arene.MARQUE_COLLANT_TOURS + economie.bonusGout(economie.GOUT_RANG_MARQUE).marqueBonus - 1,
    'Goût rang 5 : la marque de famille dure +1 action (mesurée après le décrément du tour)',
  );
  // Migration : additive, tolérante, jamais destructrice (patron `migrerExploits`).
  assert.deepEqual(economie.migrerGout(undefined), {}, 'goût : absent → map vide');
  assert.deepEqual(economie.migrerGout(null), {}, 'goût : null → map vide');
  assert.deepEqual(economie.migrerGout('nawak'), {}, 'goût : forme inconnue → map vide');
  assert.deepEqual(economie.migrerGout([1, 2, 3]), {}, 'goût : un tableau n est pas une map de rangs');
  assert.deepEqual(
    economie.migrerGout({ boba: 2, theo: 999, lacto: -3, mango: 'x', coco: 2.7, nuage: null }),
    { boba: 2, theo: economie.GOUT_MAX, coco: 2 },
    'goût : rangs bornés 0..GOUT_MAX, entrées sales ignorées, jamais de purge',
  );
  // ✅ NON-RÉGRESSION (ex-🐞, corrigé le 27/07) : un rang porté par une clé qui ne désigne
  // AUCUNE carte n'est pas une donnée du joueur — il est illisible et repartait pourtant
  // dans chaque push serveur. Il est écarté, tandis que les rangs des cartes RÉELLES de la
  // même map sont conservés intacts. Précédent : `assainirComptes` (store/jeu.ts).
  assert.deepEqual(
    economie.migrerGout({ boba: 2, 'carte-fantome': 2, 'boba-2': 5, '': 4 }),
    { boba: 2 },
    'goût : clés sans carte écartées (même très proches d un id réel), la carte réelle voisine conservée',
  );
  for (const c of economie.COLLECTIBLES) {
    assert.equal(economie.migrerGout({ [c.id]: 1 })[c.id], 1, `goût : ${c.id} est une carte RÉELLE, jamais écartée`);
  }
  // Côté STORE : monotone, idempotente, un seul emit.
  store.resetBobaQuest();
  const montee1 = store.appliquerGout(lignesTaro(economie.GOUT_ACHATS_PAR_RANG * 2));
  assert.deepEqual(montee1, [{ id: 'taro-queen', avant: 0, rang: 2 }], 'appliquerGout signale la montée à l écran');
  assert.equal(store.goutCarte('taro-queen'), 2, 'rang persisté');
  assert.deepEqual(store.appliquerGout(lignesTaro(economie.GOUT_ACHATS_PAR_RANG * 2)), [],
    'IDEMPOTENTE : rappelée à chaque ouverture d écran, elle ne réaccorde rien');
  store.appliquerGout([]);
  assert.equal(store.goutCarte('taro-queen'), 2,
    'MONOTONE : un historique tronqué (rétention serveur) ne dégrade jamais un rang');
  assert.deepEqual(store.appliquerGout(lignesTaro(economie.GOUT_ACHATS_PAR_RANG * 4)),
    [{ id: 'taro-queen', avant: 2, rang: 4 }], 'un achat de plus fait monter le rang');
  assert.deepEqual(store.goutsEquipe(['taro-queen', 'boba']), { 'taro-queen': 4, boba: 0 },
    'goutsEquipe donne une entrée par carte demandée, 0 par défaut');

  // --- 🔴 F11 · ANTI-RÉGRESSION : LA FAILLE DES DOUBLONS RÉGÉNÉRABLES ---------------
  // `appliquerPasseport` comparait autrefois les exemplaires justifiés par les achats à
  // la COLLECTION VIVANTE, que `entrainerCarte` décrémente. « J'entraîne, je quitte
  // l'écran Collection, je le rouvre » rendait donc le doublon consommé — indéfiniment,
  // sans un seul achat de plus (mesuré : 40 000 perles de matière en 50 réouvertures).
  store.resetBobaQuest();
  const requisTaro = economie.deblocageDe('taro-queen').nb;
  const achatsDeuxExemplaires = lignesTaro(requisTaro * 2);
  assert.equal(economie.exemplairesParAchats('taro-queen', achatsDeuxExemplaires), 2,
    'prémisse : ces achats justifient exactement 2 exemplaires');
  assert.deepEqual(store.appliquerPasseport(achatsDeuxExemplaires).nouvelles, ['taro-queen'], 'carte accordée');
  assert.equal(etatCourant().collection['taro-queen'], 2, 'la carte + son doublon d entraînement');
  assert.equal(etatCourant().exemplairesPasseport['taro-queen'], 2,
    'le compteur d OCTROI mémorise ce qui a été donné (le nouveau point de comparaison)');
  // On entraîne jusqu'à ce que le palier consomme réellement le doublon.
  etatCourant().perles = 1000000;
  let gardeFouEntrainement = 0;
  while (etatCourant().collection['taro-queen'] === 2 && gardeFouEntrainement++ < 12) {
    if (!store.entrainerCarte('taro-queen').ok) break;
  }
  assert.equal(etatCourant().collection['taro-queen'], 1, 'l entraînement a bien CONSOMMÉ le doublon');
  // 🔴 LE test : rouvrir l'écran Collection ne doit RIEN rendre.
  assert.deepEqual(store.appliquerPasseport(achatsDeuxExemplaires), { nouvelles: [], exemplaires: 0 },
    'le Passeport ne régénère PAS un doublon consommé par l entraînement');
  assert.equal(etatCourant().collection['taro-queen'], 1, 'la collection reste à un exemplaire');
  for (let i = 0; i < 50; i++) store.appliquerPasseport(achatsDeuxExemplaires);
  assert.equal(etatCourant().collection['taro-queen'], 1, '50 réouvertures d écran : la pompe à perles reste fermée');
  assert.equal(etatCourant().exemplairesPasseport['taro-queen'], 2, 'le compteur d octroi n a pas bougé');
  // …et le Passeport n'est pas cassé pour autant : un achat RÉEL de plus donne bien.
  const apresVraiAchat = store.appliquerPasseport(lignesTaro(requisTaro * 3));
  assert.equal(apresVraiAchat.exemplaires, 1, 'un achat réel supplémentaire octroie bien un exemplaire');
  assert.equal(etatCourant().collection['taro-queen'], 2, 'exemplaire crédité');
  assert.equal(etatCourant().exemplairesPasseport['taro-queen'], 3, 'compteur d octroi mis à jour');
  // Le compteur reste borné par les achats : `floor(achats / nb)`, un point.
  store.appliquerPasseport(lignesTaro(requisTaro * 3));
  assert.equal(etatCourant().collection['taro-queen'], 2, 'total offert borné par les achats réels');

  // --- 💾 F12 · SAUVEGARDE : v2 sans les nouveaux champs, sans la moindre perte ------
  // Les champs du LOT E (`goutCartes`, `exemplairesPasseport`) sont ADDITIFS :
  // VERSION_SAUVEGARDE reste à 2 et une sauvegarde d'avant doit se charger telle quelle.
  store.resetBobaQuest();
  const sauvegardeV2 = {
    versionSauvegarde: 2,
    perles: 3210, eclats: 40,
    collection: { boba: 3, 'taro-queen': 1 },
    niveauxCartes: { boba: 4 },
    partiesJouees: 12, meilleurScore: 900, capsulesOuvertes: 5,
    exploits: { boba: { ko: 7 } },
    aventure: { niveauMax: 9 },
  };
  assert.equal(store.adopterEtatServeur(sauvegardeV2, 11), true, 'une sauvegarde v2 sans les champs du LOT E se charge');
  assert.equal(etatCourant().perles, 3210, 'perles conservées');
  assert.equal(etatCourant().eclats, 40, 'éclats conservés');
  assert.deepEqual(etatCourant().collection, { boba: 3, 'taro-queen': 1 }, 'collection conservée à l identique');
  assert.equal(etatCourant().niveauxCartes.boba, 4, 'niveaux d entraînement conservés');
  assert.equal(etatCourant().exploits.boba.ko, 7, 'palmarès conservé');
  assert.equal(etatCourant().aventure.niveauMax, 9, 'progression Aventure conservée');
  assert.equal(etatCourant().versionSauvegarde, 2, 'VERSION_SAUVEGARDE vaut toujours 2');
  assert.deepEqual(etatCourant().goutCartes, {}, 'champ additif absent → map vide, aucune purge');
  assert.deepEqual(etatCourant().exemplairesPasseport, { boba: 3, 'taro-queen': 1 },
    'exemplairesPasseport amorcé CONSERVATIVEMENT sur la collection : rien d octroyé, rien de retiré');
  // Conséquence directe de cet amorçage : le Passeport ne redonne pas rétroactivement.
  assert.deepEqual(store.appliquerPasseport(lignesTaro(requisTaro)), { nouvelles: [], exemplaires: 0 },
    'un ancien joueur ne reçoit rien rétroactivement au premier chargement');
  // Les champs du LOT E déjà présents font foi et ne sont jamais ré-amorcés.
  store.resetBobaQuest();
  assert.equal(store.adopterEtatServeur({
    ...sauvegardeV2, goutCartes: { 'taro-queen': 3, boba: 99, fantome: 99 }, exemplairesPasseport: {},
  }, 12), true, 'sauvegarde LOT E adoptée');
  // ✅ NON-RÉGRESSION (ex-🐞, corrigé le 27/07) — DEUX PROPRIÉTÉS DISTINCTES, longtemps
  // confondues sous un seul « jamais purgé » :
  //  1. une donnée LÉGITIME (rang sur une carte RÉELLE) est bornée et CONSERVÉE — c'est la
  //     doctrine du projet, un rang sale ne doit jamais faire perdre sa progression ;
  //  2. une clé qui ne désigne AUCUNE carte est écartée — ce n'est pas une donnée du
  //     joueur mais une fuite : illisible (`goutCarte` travaille par id de collectible) et
  //     pourtant réexpédiée dans le push serveur de 85 Ko à chaque sauvegarde. Même
  //     arbitrage, même filtre `trouverCollectible` que `assainirComptes` applique déjà à
  //     `collection` et `niveauxCartes` juste à côté.
  assert.equal(etatCourant().goutCartes['taro-queen'], 3, 'rang de Goût persisté relu');
  assert.equal(etatCourant().goutCartes.boba, economie.GOUT_MAX,
    'propriété 1 : rang sale sur une carte RÉELLE → borné à GOUT_MAX et conservé');
  assert.equal(economie.trouverCollectible('fantome'), undefined, 'prémisse : « fantome » ne désigne aucune carte');
  assert.equal('fantome' in etatCourant().goutCartes, false,
    'propriété 2 : une clé qui ne désigne aucune carte est ÉCARTÉE, pas réexpédiée à chaque push');
  for (const id of Object.keys(etatCourant().goutCartes)) {
    assert.ok(economie.trouverCollectible(id), `goutCartes ne contient que des cartes réelles (« ${id} » n en est pas une)`);
  }
  assert.deepEqual(etatCourant().exemplairesPasseport, {},
    'un exemplairesPasseport PRÉSENT (même vide) fait foi : jamais ré-amorcé depuis la collection');
  // Une sauvegarde plus RÉCENTE que le code est refusée : pas de perte silencieuse.
  store.resetBobaQuest();
  etatCourant().perles = 777;
  assert.equal(store.adopterEtatServeur({ ...sauvegardeV2, versionSauvegarde: 3 }, 13), false,
    'une sauvegarde d une version supérieure est REFUSÉE (downgrade d app)');
  assert.equal(etatCourant().perles, 777, 'état local intact après le refus');
  store.resetBobaQuest();


  // ============ 🎡 ROULETTE — parts égales : l'écart doit rester serré ============
  // 27/07 : la roue est repassée à 8 parts VISUELLEMENT ÉGALES (45°) parce que les
  // chances ont été resserrées. Ce compromis ne tient que tant que l'écart reste
  // faible : si un poids repart à 1 % pendant qu'un autre est à 28 %, les parts égales
  // redeviennent le mensonge que le correctif du 26/07 avait supprimé (« Boisson
  // offerte » aussi large que le reste alors qu'elle est 12 fois plus rare).
  // Ce test est le garde-fou de ce compromis — s'il casse, il faut SOIT resserrer les
  // poids, SOIT repasser la roue en secteurs proportionnels. Ne pas l'assouplir.
  {
    const poids = economie.ROULETTE.map((s) => s.poids);
    const total = poids.reduce((a, b) => a + b, 0);
    const apparent = 100 / economie.ROULETTE.length; // ce que le joueur LIT sur la roue
    const pcts = poids.map((p) => (p / total) * 100);
    // Le critère qui protège vraiment le joueur n'est pas le rapport entre lots, c'est
    // l'écart entre ce que la roue MONTRE (12,5 % pour chacune des 8 parts) et la
    // chance RÉELLE du lot. Au-delà d'un facteur 2, la part égale ment ; à 1 % contre
    // 12,5 % — l'état d'avant le 27/07 — le facteur était de 12.
    for (const [i, pct] of pcts.entries()) {
      const distorsion = Math.max(apparent / pct, pct / apparent);
      assert.ok(distorsion <= 2,
        `roulette « ${economie.ROULETTE[i].label} » : ${pct.toFixed(1)} % réels affichés comme ${apparent.toFixed(1)} % (facteur ${distorsion.toFixed(2)})`);
    }
    // Le tirage suit les POIDS, jamais le découpage visuel : sur 200 000 tirages seedés,
    // chaque lot doit tomber à sa fréquence réelle, pas à 12,5 %.
    const rng = shooter.creerRng(4242);
    const compte = Object.create(null);
    for (let i = 0; i < 200000; i++) {
      const seg = economie.tirerRoulette(rng);
      compte[seg.id] = (compte[seg.id] || 0) + 1;
    }
    for (const [i, seg] of economie.ROULETTE.entries()) {
      const observe = (compte[seg.id] / 200000) * 100;
      assert.ok(Math.abs(observe - pcts[i]) < 0.6,
        `roulette « ${seg.label} » : ${observe.toFixed(2)} % observés pour ${pcts[i].toFixed(1)} % attendus`);
    }
    // Les lots en perles ne doivent plus être dérisoires face au plus petit lot réel
    // (+1 tampon = 8 000 perles en boutique). C'est ce qui a motivé le relèvement.
    const tampon1 = economie.BOUTIQUE.find((p) => p.id === 'tampon-1');
    for (const seg of economie.ROULETTE.filter((s) => s.type === 'perles')) {
      assert.ok(seg.qte >= tampon1.cout * 0.1,
        `roulette « ${seg.label} » : ${seg.qte} perles, dérisoire face aux ${tampon1.cout} perles d'un tampon`);
    }
    // Le libellé de la part EST la promesse : « 1 200 perles » doit rendre 1 200 perles.
    for (const seg of economie.ROULETTE.filter((s) => s.type === 'perles')) {
      const chiffres = Number(seg.label.replace(/[^0-9]/g, ''));
      assert.equal(chiffres, seg.qte,
        `roulette « ${seg.label} » : le libellé annonce ${chiffres} mais le lot vaut ${seg.qte}`);
    }
  }


  // ============ 🎡 ROULETTE — le lot en perles est HORS multiplicateurs ============
  // Décision Yoann du 27/07 : la part annonce « 1 200 perles », donc le joueur touche
  // 1 200 perles, quel que soit le jour. On force ici le pire cas de multiplication
  // (Gorgée Fraîche ×2, contrôlable sans toucher à l'horloge) et on vérifie que le
  // crédit reste FACIAL. Rebrancher `perlesEvenement` sur la roulette casse ce test —
  // c'est voulu : cela rouvrirait la question du plafond (« 3 000 perles » pouvait en
  // rendre 15 600, soit 22 capsules d'un coup).
  {
    const segPerles = economie.ROULETTE.filter((s) => s.type === 'perles');
    assert.ok(segPerles.length > 0, 'la roulette a au moins un lot en perles');
    // Un rng qui vise le CENTRE de la tranche de poids du segment voulu : déterministe,
    // et insensible à un futur réordonnancement de la table.
    const total = economie.ROULETTE.reduce((a, x) => a + x.poids, 0);
    const rngVers = (id) => {
      let avant = 0;
      for (const x of economie.ROULETTE) { if (x.id === id) break; avant += x.poids; }
      const cible = economie.ROULETTE.find((x) => x.id === id);
      return () => (avant + cible.poids / 2) / total;
    };
    for (const seg of segPerles) {
      store.resetBobaQuest();
      // ×2 « Gorgée Fraîche » actif : sans le correctif, le lot serait doublé.
      store.crediterGorgee(1);
      const avantPerles = etatCourant().perles;
      const tire = store.tournerRoulette(rngVers(seg.id));
      assert.equal(tire && tire.id, seg.id, `le rng doit viser « ${seg.label} »`);
      const delta = etatCourant().perles - avantPerles;
      assert.equal(delta, seg.qte,
        `roulette « ${seg.label} » : ${delta} perles créditées pour ${seg.qte} annoncées (multiplicateur appliqué à tort ?)`);
    }
    // Contrôle en miroir : le ×2 de la Gorgée est bien actif dans cet état, sinon le
    // test ci-dessus passerait pour une mauvaise raison.
    store.resetBobaQuest();
    const sansVisiteR = store.finPartieInfini({ ...STATS, score: 900 }, () => 0.99).perlesGagnees;
    store.resetBobaQuest();
    store.crediterGorgee(1);
    const avecVisiteR = store.finPartieInfini({ ...STATS, score: 900 }, () => 0.99).perlesGagnees;
    assert.ok(avecVisiteR > sansVisiteR,
      'le ×2 Gorgée doit bien être actif dans ce scénario (sinon le test roulette ne prouve rien)');
    store.resetBobaQuest();
  }


  // ============ 🎬 DUEL — le couplage projectile ↔ impact ne doit pas se rompre ======
  // Régression vécue le 27/07, remontée par Yoann après test sur iPhone : « il n'y a
  // plus les animations d'attaques ». En réalité elles jouaient toujours — mais
  // `ATTENTE.annonce` avait été raccourcie de 520 à 300 ms pour resserrer le rythme,
  // sans voir que 520 n'était PAS un réglage de rythme : c'était exactement
  // `DUREE_VOL_MS`, donc le temps de vol du projectile. Désynchronisés, les dégâts
  // s'affichaient avant que le projectile n'arrive, et l'attaque se lisait comme si
  // elle n'avait aucune animation.
  // L'écran DÉRIVE désormais son attente de la durée réelle de l'effet. Ce test est un
  // fil-piège sur ce couplage : si tu le fais tomber en refactorant, rétablis le
  // couplage — ne le supprime pas.
  {
    const duel = fs.readFileSync(path.join(racine, 'src/app/jeu/duel.tsx'), 'utf8');
    const projectiles = fs.readFileSync(path.join(racine, 'src/components/jeu/projectiles.tsx'), 'utf8');
    assert.ok(/attenteAnnonce\s*=\s*DUREE_VOL_MS/.test(duel),
      "duel.tsx : l'attente de l'annonce doit être DÉRIVÉE de DUREE_VOL_MS quand un projectile part");
    assert.ok(/attenteAnnonce\s*=\s*DUREE_SOI_MS/.test(duel),
      "duel.tsx : idem pour les effets sur soi (DUREE_SOI_MS)");
    const vol = Number(/DUREE_VOL_MS\s*=\s*(\d+)/.exec(projectiles)[1]);
    const soi = Number(/DUREE_SOI_MS\s*=\s*(\d+)/.exec(projectiles)[1]);
    assert.ok(vol > 0 && vol <= 600, `DUREE_VOL_MS = ${vol} ms : hors du budget de rythme`);
    assert.ok(soi > 0 && soi <= 700, `DUREE_SOI_MS = ${soi} ms : hors du budget de rythme`);

    // 📳 UNE vibration par attaque (retour de Yoann) : aucune haptique ne doit revenir
    // sur les événements de statut, dont un round produit jusqu'à une douzaine.
    const tableStatut = duel.split('const REACTIONS_STATUT')[1].split('};')[0];
    assert.ok(!/haptique/.test(tableStatut),
      'REACTIONS_STATUT : aucune haptique ne doit être rebranchée sur les événements de statut');
    assert.ok(/vibrationArmee\.current = null/.test(duel),
      "duel.tsx : la vibration doit être DÉSARMÉE après le premier impact (une seule par attaque)");
  }


  // ============================================================================
  // 🚚 LIVRAISON DU 27/07/2026 — QUATRE LOTS EN PARALLÈLE
  //   🎫 A · Passeport : la variante `{ par: 'collection' }` + interrupteur SERVEUR
  //   💰 B · Rééquilibrage des combats (Arène sans plateau, Tournée relevée)
  //   🎖️ C · Paliers de parcours et FAISABILITÉ des niveaux boss
  //   🧋 D · Hub : la Gorgée Fraîche promise AVANT la visite
  //   💸 E · Non-régression économique (double crédit, revanche du boss hebdo)
  // Ajoutés EN FIN de fichier, rien retiré ni déplacé. Tout aléa passe par un `rng`
  // injecté (aucun test instable), et aucune valeur dérivable n'est figée : les
  // attendus se recalculent depuis les constantes exportées par les moteurs.
  // ============================================================================

  // --- 🎫 A · PASSEPORT : `{ par: 'collection' }` n'est PAS une carte gratuite -------
  // C'est TOUT l'enjeu de la variante. Une carte laissée `{ par: 'jeu' }` sort d'une
  // capsule sans le moindre achat ; la mascotte devait donc devenir la plus DIFFICILE à
  // obtenir, pas la plus facile. On teste la frontière exacte : 22 autres cartes = non,
  // 23 = oui. L'id de la mascotte est DÉRIVÉ (aucun `'bubble-master'` écrit en dur) :
  // le jour où une autre carte prend cette variante, le test la suit.
  const cartesCollection = economie.COLLECTIBLES.filter((c) => economie.deblocageDe(c.id).par === 'collection');
  assert.equal(cartesCollection.length, 1,
    'une seule carte se mérite en RÉUNISSANT la collection (la mascotte) — pas deux, pas zéro');
  const MASCOTTE = cartesCollection[0].id;
  const deblocageMascotte = economie.deblocageDe(MASCOTTE);
  assert.equal(deblocageMascotte.nb, economie.COLLECTIBLES.length - 1,
    'le seuil de la mascotte est DÉRIVÉ du catalogue : ajouter un collectible ne la rend jamais plus facile');
  const autresQueMascotte = economie.COLLECTIBLES.map((c) => c.id).filter((id) => id !== MASCOTTE);
  const poolMoinsUne = economie.poolCapsuleAvecPasseport(autresQueMascotte.slice(0, deblocageMascotte.nb - 1));
  const poolComplete = economie.poolCapsuleAvecPasseport(autresQueMascotte);
  assert.equal(poolMoinsUne.some((c) => c.id === MASCOTTE), false,
    `${deblocageMascotte.nb - 1}/${deblocageMascotte.nb} : la mascotte reste HORS du vivier des capsules`);
  assert.ok(poolComplete.some((c) => c.id === MASCOTTE),
    `${deblocageMascotte.nb}/${deblocageMascotte.nb} : la mascotte entre enfin dans le vivier`);
  assert.equal(poolComplete.length, economie.COLLECTIBLES.length,
    'collection réunie : le vivier est complet, la mascotte comprise');
  // La progression affichée dit la même chose, et la carte ne s'aide JAMAIS d'elle-même.
  assert.deepEqual(
    economie.passeportCarte(MASCOTTE, [], autresQueMascotte.slice(0, deblocageMascotte.nb - 1)),
    { parJeu: false, acquise: false, faits: deblocageMascotte.nb - 1, requis: deblocageMascotte.nb },
    'mascotte : la jauge compte les AUTRES cartes, et il en manque une',
  );
  assert.equal(economie.passeportCarte(MASCOTTE, [], autresQueMascotte).acquise, true,
    'mascotte : acquise quand les autres sont toutes là');
  assert.equal(economie.passeportCarte(MASCOTTE, []).parJeu, false,
    'mascotte : JAMAIS marquée « obtenable en jouant » — elle n est pas gratuite');
  assert.equal(economie.passeportCarte(MASCOTTE, []).acquise, false,
    'sans liste de possédées, la lecture est PRUDENTE : jamais acquise par défaut');
  assert.equal(
    economie.autresCartesPossedees(MASCOTTE, [...autresQueMascotte.slice(0, 5), MASCOTTE]),
    5, 'la mascotte ne se compte pas elle-même dans sa propre condition');
  assert.equal(economie.cartesDebloqueesParAchats([], autresQueMascotte.slice(0, deblocageMascotte.nb - 1))
    .includes(MASCOTTE), false, 'condition incomplète : la mascotte n est pas débloquée');
  assert.ok(economie.cartesDebloqueesParAchats([], autresQueMascotte).includes(MASCOTTE),
    'condition remplie : la mascotte est débloquée');
  // Aucun ACHAT ne la justifie : le Passeport ne doit donc jamais l'OCTROYER d'office —
  // elle s'obtient dans une capsule, là où elle produit son moment de fête.
  assert.equal(economie.achatsPourCarte(MASCOTTE, lignesTaro(99)), 0, 'mascotte : aucun achat ne compte pour elle');
  assert.equal(economie.exemplairesParAchats(MASCOTTE, lignesTaro(99)), 0, 'mascotte : aucun exemplaire justifié par un achat');
  assert.equal(economie.rangGout(MASCOTTE, lignesTaro(99)), 0, 'mascotte : aucune boisson à racheter, donc Goût 0');

  // Le SET COMMUN reste la seule famille gratuite, et c'est une décision produit.
  for (const c of economie.COLLECTIBLES) {
    assert.equal(economie.deblocageDe(c.id).par === 'jeu', c.set === 'milk',
      `${c.id} : « obtenable en jouant » doit valoir exactement « set commun »`);
  }

  // 🍮 Flantastique → la FAMILLE VANILLE. Les cibles existent au catalogue (déjà vérifié
  // plus haut pour TOUTES les cartes) ; ce qui est neuf ici, c'est qu'aucune autre carte
  // ne les réclame — sinon deux cartes progresseraient sur le même achat sans que ce soit
  // la décision explicite prise pour la crème brûlée.
  {
    const vanille = economie.COLLECTIBLES
      .map((c) => ({ c, d: economie.deblocageDe(c.id) }))
      .filter((x) => x.d.par === 'achat' && x.d.cibles.every((t) => /vanille/.test(t.id)));
    assert.equal(vanille.length, 1, 'une seule carte est adossée à la famille vanille');
    const cartesVanille = vanille[0];
    assert.equal(cartesVanille.d.cibles.length, 4, 'la famille vanille compte 4 saveurs');
    const cataloguePasseport = require(path.join(racine, 'src/data/catalogue.js'));
    const saveursConnues = new Set();
    for (const g of cataloguePasseport.categories) for (const sv of (g.saveurs || [])) saveursConnues.add(sv.id);
    for (const t of cartesVanille.d.cibles) {
      assert.equal(t.type, 'saveur', 'la famille vanille est faite de SAVEURS, pas de catégories');
      assert.ok(saveursConnues.has(t.id), `saveur vanille absente du catalogue : ${t.id}`);
    }
    const reclamees = new Set(cartesVanille.d.cibles.map((t) => `${t.type}:${t.id}`));
    const collisions = [];
    for (const c of economie.COLLECTIBLES) {
      if (c.id === cartesVanille.c.id) continue;
      const d = economie.deblocageDe(c.id);
      if (d.par !== 'achat') continue;
      for (const t of d.cibles) if (reclamees.has(`${t.type}:${t.id}`)) collisions.push(`${c.id} → ${t.id}`);
    }
    assert.deepEqual(collisions, [],
      'les saveurs vanille ne sont réclamées par AUCUNE autre carte (collision non décidée)');
    assert.equal(cartesVanille.d.nb, economie.ACHATS_PAR_RARETE[cartesVanille.c.rarete],
      'le nombre d achats de la famille vanille suit la rareté, comme toutes les autres');
  }

  // --- 🚦 A · L'INTERRUPTEUR EST SERVEUR : précédence, marche arrière, zéro perte -----
  // ⚠️ ORDRE OBLIGATOIRE. `definirPasseportActif(v, true)` pose un VERROU de session :
  // une fois le serveur entendu, le cache ne peut plus reprendre la main. Les trois
  // niveaux de précédence ne sont donc testables que dans cet ordre, une seule fois.
  // 1/3 — aucune lecture n'a encore eu lieu : c'est le DÉFAUT COMPILÉ qui s'applique.
  assert.equal(store.passeportActif(), economie.PASSEPORT_ACTIF,
    'au démarrage, l interrupteur vaut le défaut compilé (repli fail-closed : collection OUVERTE)');
  assert.equal(economie.PASSEPORT_ACTIF, false,
    'ce défaut doit rester `false` : mieux vaut une collection ouverte par erreur que fermée par erreur');
  // 2/3 — le CACHE local (AsyncStorage, relu au démarrage) prime sur le défaut.
  store.definirPasseportActif(true);
  assert.equal(store.passeportActif(), true, 'cache local > défaut compilé');
  store.definirPasseportActif(false);
  assert.equal(store.passeportActif(), false, 'cache local : la marche arrière passe aussi');
  // 3/3 — une lecture SERVEUR réussie prime sur le cache, et pour toute la session : un
  // cache périmé qui arriverait APRÈS (lecture AsyncStorage lente) ne doit rien écraser.
  store.definirPasseportActif(true, true);
  assert.equal(store.passeportActif(), true, 'serveur > cache');
  store.definirPasseportActif(false);
  assert.equal(store.passeportActif(), true,
    'un cache périmé arrivé APRÈS la réponse serveur ne la réécrit JAMAIS');
  // La marche arrière SERVEUR, elle, doit passer — c'est la raison d'être du flag.
  store.definirPasseportActif(false, true);
  assert.equal(store.passeportActif(), false, 'le serveur peut TOUJOURS rouvrir la collection');

  // Une bascule complète est SANS PERTE et ne consomme AUCUNE révision de sauvegarde :
  // une config d'exploitation n'a rien à faire dans la sauvegarde d'un joueur (elle
  // voyagerait d'un téléphone à l'autre et survivrait à la marche arrière).
  store.resetBobaQuest();
  etatCourant().perles = 4242;
  etatCourant().collection = { boba: 2, 'taro-queen': 1 };
  etatCourant().exemplairesPasseport = { 'taro-queen': 1 };
  const empreinteAvantBascule = JSON.stringify(store.instantaneEtat());
  store.definirPasseportActif(true, true);
  store.definirPasseportActif(false, true);
  assert.equal(JSON.stringify(store.instantaneEtat()), empreinteAvantBascule,
    'bascule false → true → false : état ET révision rigoureusement inchangés');
  assert.equal(store.passeportActif(), false, 'et l interrupteur est bien revenu à sa position');
  // …et une remise à zéro de la partie ne rouvre pas une collection que l'exploitant a
  // fermée : effacer SA progression ne doit pas déplacer un réglage d'exploitation.
  store.definirPasseportActif(true, true);
  store.resetBobaQuest();
  assert.equal(store.passeportActif(), true, 'resetBobaQuest ne touche pas à l interrupteur d exploitation');

  // --- 🎫 A · Le vivier RÉEL des capsules suit la même frontière, interrupteur allumé -
  // (l'interrupteur est ON depuis l'assertion précédente : c'est ce qu'on veut mesurer)
  const indexDansPool = (pool, id) => pool.findIndex((c) => c.id === id);
  const rngVersCarte = (pool, id) => {
    const i = indexDansPool(pool, id);
    return () => (i + 0.5) / pool.length;   // vise le CENTRE de la tranche : déterministe
  };
  store.resetBobaQuest();
  const collectionMoinsUne = {};
  for (const id of autresQueMascotte.slice(0, deblocageMascotte.nb - 1)) collectionMoinsUne[id] = 1;
  etatCourant().collection = { ...collectionMoinsUne };
  etatCourant().perles = economie.CAPSULES.classique.cout * 30;
  const poolReelMoinsUne = economie.poolCapsuleAvecPasseport(Object.keys(collectionMoinsUne));
  assert.equal(indexDansPool(poolReelMoinsUne, MASCOTTE), -1, 'prémisse : la mascotte n est pas dans ce vivier');
  // Balayage EXHAUSTIF du vivier : chaque tranche est visée une fois (le vivier ne bouge
  // pas, toutes ces cartes sont déjà possédées → que des doublons). Aucune tranche ne doit
  // rendre la mascotte. Bien plus fort qu'un échantillon : c'est une preuve, pas un sondage.
  const cartesTirees = new Set();
  for (let i = 0; i < poolReelMoinsUne.length; i++) {
    const tire = store.ouvrirCapsule('classique', false, () => (i + 0.5) / poolReelMoinsUne.length);
    assert.ok(tire, `capsule ${i} : ouverture refusée (perles insuffisantes ?)`);
    cartesTirees.add(tire.collectible.id);
  }
  assert.equal(cartesTirees.has(MASCOTTE), false,
    'Passeport actif, condition incomplète : AUCUNE tranche du vivier ne peut rendre la mascotte');
  // Et plus largement : rien de ce qui sort ne peut être hors du vivier autorisé — c'est
  // toute la règle du Passeport. (Le nombre de cartes DISTINCTES vues n'est pas figé : la
  // garantie de pity resserre le vivier sur les épiques+ dès qu'elle tombe, ce qui est le
  // comportement voulu et n'a rien à voir avec la propriété testée ici.)
  for (const id of cartesTirees) {
    assert.ok(poolReelMoinsUne.some((c) => c.id === id),
      `carte « ${id} » sortie d une capsule alors qu elle n est pas dans le vivier autorisé`);
  }
  assert.ok(cartesTirees.size > 1, 'le balayage a bien vu plusieurs cartes du vivier');
  store.resetBobaQuest();
  const collectionComplete = {};
  for (const id of autresQueMascotte) collectionComplete[id] = 1;
  etatCourant().collection = { ...collectionComplete };
  etatCourant().perles = economie.CAPSULES.classique.cout * 2;
  const poolReelComplet = economie.poolCapsuleAvecPasseport(Object.keys(collectionComplete));
  const tireMascotte = store.ouvrirCapsule('classique', false, rngVersCarte(poolReelComplet, MASCOTTE));
  assert.equal(tireMascotte && tireMascotte.collectible.id, MASCOTTE,
    'condition remplie : la capsule PEUT enfin rendre la mascotte');
  assert.equal(tireMascotte.doublon, false, 'et c est bien une nouveauté, pas un doublon');

  // --- 🎫 A · `appliquerPasseport` : monotone, idempotente, jamais adossée à la ------
  // collection VIVANTE. F11 verrouille déjà la pompe à doublons ; ce qui est neuf ici,
  // c'est que la comparaison se fait au compteur d'OCTROI même quand la collection a été
  // GONFLÉE par ailleurs (capsule, troc, cadeau) — et que la mascotte n'est jamais
  // octroyée d'office, quel que soit l'état de la collection.
  store.resetBobaQuest();
  const requisMascotteVoisin = economie.deblocageDe('taro-queen').nb;
  const achatsUnExemplaire = lignesTaro(requisMascotteVoisin);
  assert.deepEqual(store.appliquerPasseport(achatsUnExemplaire).nouvelles, ['taro-queen'], 'prémisse : carte accordée');
  assert.equal(etatCourant().exemplairesPasseport['taro-queen'], 1, 'un exemplaire OCTROYÉ');
  // La collection grossit par un autre canal : le Passeport ne doit PAS s'en servir de
  // référence — ni pour redonner, ni pour reprendre.
  etatCourant().collection = { ...etatCourant().collection, 'taro-queen': 9 };
  assert.deepEqual(store.appliquerPasseport(achatsUnExemplaire), { nouvelles: [], exemplaires: 0 },
    'collection gonflée : le Passeport compare à exemplairesPasseport, pas à la collection');
  assert.equal(etatCourant().collection['taro-queen'], 9, 'et il ne reprend rien non plus');
  // IDEMPOTENCE stricte : dix rappels d'affilée ne bougent RIEN (l'écran Collection
  // rappelle cette fonction à chaque ouverture, et à chaque retour de `chargerAchats`).
  const empreinteIdem = JSON.stringify(store.instantaneEtat());
  for (let i = 0; i < 10; i++) store.appliquerPasseport(achatsUnExemplaire);
  assert.equal(JSON.stringify(store.instantaneEtat()), empreinteIdem,
    'IDEMPOTENTE : 10 rappels ne consomment ni exemplaire, ni révision de sauvegarde');
  // MONOTONE : l'historique se vide (rétention serveur, réseau) → rien n'est repris.
  store.appliquerPasseport([]);
  assert.equal(etatCourant().collection['taro-queen'], 9, 'historique vide : rien de repris');
  assert.equal(etatCourant().exemplairesPasseport['taro-queen'], 1, 'compteur d octroi jamais rabaissé');
  // La mascotte n'est JAMAIS octroyée, même collection réunie et interrupteur allumé.
  store.resetBobaQuest();
  etatCourant().collection = { ...collectionComplete };
  assert.deepEqual(store.appliquerPasseport(lignesTaro(999)).nouvelles.filter((id) => id === MASCOTTE), [],
    'la mascotte ne s OCTROIE pas : elle se gagne dans une capsule, c est tout son intérêt');
  assert.equal(etatCourant().collection[MASCOTTE] || 0, 0, 'et elle n apparaît pas dans la collection');
  // `appliquerPasseport` ne dépend PAS de l'interrupteur (le lot E5 l'a établi) : la
  // marche arrière du flag ne doit donc rien changer à ce qui a déjà été octroyé.
  store.definirPasseportActif(false, true);
  store.resetBobaQuest();
  assert.deepEqual(store.appliquerPasseport(achatsUnExemplaire).nouvelles, ['taro-queen'],
    'interrupteur ÉTEINT : le comptoir accorde quand même ce que les achats justifient');
  store.resetBobaQuest();

  // --- 💰 B · RÉÉQUILIBRAGE DES COMBATS ---------------------------------------------
  // 🏆 Arène : le PLATEAU a disparu. L'ancienne formule `Math.min(200 + 45r, 700)` gelait
  // la récompense dès le rang 12 alors que les rangs 12 à 50 sont réellement joués.
  // Trois propriétés, et pas une de moins : monotone, STRICTEMENT croissante loin
  // au-delà de 12, et BORNÉE (le plafond est déplacé, jamais supprimé).
  const RANG_MAX_MESURE = 500;
  let rangNonMonotone = null, precedentPerles = -1;
  for (let r = 1; r <= RANG_MAX_MESURE && rangNonMonotone === null; r++) {
    const p = arene.recompenseRang(r).perles;
    if (p < precedentPerles) rangNonMonotone = r;
    precedentPerles = p;
  }
  assert.equal(rangNonMonotone, null,
    `recompenseRang doit être MONOTONE non décroissante (chute observée au rang ${rangNonMonotone})`);
  // La rampe historique des premiers rangs est intacte, AU PERLE PRÈS : l'entrée de jeu
  // n'est pas inflatée et le farm du bas de tableau n'est pas rendu plus rentable.
  for (let r = 1; r <= arene.ARENE_RANG_LINEAIRE; r++) {
    assert.equal(arene.recompenseRang(r).perles,
      arene.ARENE_PERLES_BASE + r * arene.ARENE_PERLES_PAR_RANG,
      `rang ${r} : la rampe linéaire historique ne doit pas bouger`);
  }
  // « Loin au-delà du rang 12 » : on balaie jusqu'à trois fois la fin de rampe. C'est là
  // que l'ancien `Math.min` mordait, et c'est la bande où vit le joueur investi.
  const RANG_CROISSANCE_STRICTE = arene.ARENE_RANG_LINEAIRE * 3;
  for (let r = 1; r < RANG_CROISSANCE_STRICTE; r++) {
    assert.ok(arene.recompenseRang(r + 1).perles > arene.recompenseRang(r).perles,
      `rang ${r} → ${r + 1} : monter en rang doit TOUJOURS payer plus (plus jamais de mur)`);
  }
  assert.ok(arene.recompenseRang(12).perles < arene.recompenseRang(25).perles
    && arene.recompenseRang(25).perles < arene.recompenseRang(40).perles,
    'le mur du rang 12 a bien disparu de la bande 12-40');
  // BORNÉE : l'Arène est le seul mode sans plafond FINAL sur les multiplicateurs, donc
  // la borne dure de la fonction n'est pas négociable.
  for (const r of [50, 100, 1000, 1e6, Number.MAX_SAFE_INTEGER]) {
    assert.ok(arene.recompenseRang(r).perles <= arene.ARENE_PERLES_ASYMPTOTE,
      `rang ${r} : la récompense doit rester bornée par ARENE_PERLES_ASYMPTOTE`);
  }
  assert.ok(arene.ARENE_PERLES_ASYMPTOTE > arene.ARENE_PERLES_BASE + arene.ARENE_RANG_LINEAIRE * arene.ARENE_PERLES_PAR_RANG,
    'l asymptote doit rester AU-DESSUS de la fin de rampe, sinon la courbe redescendrait');
  // Entrées sales NUMÉRIQUES : le `Math.max(1, Math.round(rang))` du correctif fait bien
  // son travail — un rang nul, négatif ou fractionnaire retombe sur le rang 1.
  for (const sale of [0, -5, 0.4, null]) {
    assert.equal(arene.recompenseRang(sale).perles, arene.recompenseRang(1).perles,
      `rang « ${sale} » : repli propre sur le rang 1`);
  }
  // ✅ NON-RÉGRESSION (ex-🐞, corrigé le 27/07) — LA RÈGLE DE TOUTE LA FAMILLE « NaN » :
  // **UNE COMPARAISON N'EST PAS UN GARDE-FOU.** `Math.max(1, Math.round(rang))` avait
  // l'AIR de borner la valeur, mais `Math.max(1, NaN)` vaut NaN : un rang non numérique
  // traversait la fonction et en ressortait en NaN. Ce n'était pas théorique — la
  // migration adoptait `arene.rang: "nawak"` tel quel, `victoireArene` faisait
  // `etat.perles += NaN`, le solde devenait NaN DÉFINITIVEMENT puis partait au serveur en
  // `perles: null` (JSON n'a pas de NaN) pendant qu'`etatEstVierge` le déclarait
  // « vierge ». Les deux moteurs coercent désormais AVANT de tester la finitude
  // (`Number("12")` vaut 12 : une valeur persistée en chaîne garde son sens), puis
  // replient le non fini sur le rang 1 / l'étape 1 — exactement comme les entrées sales
  // numériques ci-dessus. Attendus DÉRIVÉS de la fonction elle-même, jamais figés.
  // La finitude est asserée À PART : sans elle, un `recompenseRang(1)` qui repartirait en
  // NaN rendrait la comparaison vraie des deux côtés (NaN === NaN passe en deepEqual).
  assert.ok(Number.isFinite(arene.recompenseRang(1).perles), 'prémisse : le rang 1 rapporte un nombre FINI');
  assert.ok(Number.isFinite(tournee.perlesVictoireTournee(1)), 'prémisse : l étape 1 rapporte un nombre FINI');
  for (const nonFini of [NaN, Infinity, 'nawak', undefined]) {
    assert.equal(arene.recompenseRang(nonFini).perles, arene.recompenseRang(1).perles,
      `rang « ${String(nonFini)} » : repli sur le rang 1, plus jamais de NaN`);
    assert.deepEqual(arene.recompenseRang(nonFini), arene.recompenseRang(1),
      `rang « ${String(nonFini)} » : la capsule aussi suit le repli, pas seulement les perles`);
    assert.ok(Number.isFinite(arene.recompenseRang(nonFini).perles),
      `rang « ${String(nonFini)} » : la récompense reste un nombre FINI (c est ELLE qui alimente etat.perles)`);
  }
  assert.equal(tournee.perlesVictoireTournee(NaN), tournee.perlesVictoireTournee(1),
    'étape NaN : même garde-fou, même repli sur l étape 1 (perlesVictoireTournee)');
  assert.ok(Number.isFinite(tournee.perlesVictoireTournee(NaN)),
    'étape NaN : le gain de Tournée reste un nombre FINI');

  // 🎁 Le RYTHME DES CAPSULES a changé (c'était l'écart le plus gros et le plus
  // invisible). Attendus DÉRIVÉS des deux constantes, jamais des nombres 3 et 6.
  for (let r = 1; r <= 60; r++) {
    const attendu = r % arene.ARENE_CAPSULE_DOREE_RYTHME === 0 ? 'doree'
      : r % arene.ARENE_CAPSULE_RYTHME === 0 ? 'classique' : null;
    assert.equal(arene.recompenseRang(r).capsule, attendu, `rang ${r} : capsule conforme au rythme`);
  }
  assert.equal(arene.ARENE_CAPSULE_DOREE_RYTHME % arene.ARENE_CAPSULE_RYTHME, 0,
    'la dorée doit tomber SUR un rang de classique : sinon elle s ajoute au lieu de remplacer');
  assert.ok(arene.ARENE_CAPSULE_DOREE_RYTHME > arene.ARENE_CAPSULE_RYTHME,
    'la dorée reste plus rare que la classique');
  // Le rythme reste plus lâche que celui du shooter : la capsule d'Arène doit rester un
  // événement, pas un tapis roulant (dérivé de `capsuleDuNiveau`, la référence).
  const rythmeShooterDoree = 5;  // un boss d'Aventure tous les 5 niveaux (capsuleDuNiveau)
  assert.equal(economie.capsuleDuNiveau(rythmeShooterDoree, true), 'doree', 'prémisse : la dorée du shooter tombe au boss');
  assert.ok(arene.ARENE_CAPSULE_DOREE_RYTHME > rythmeShooterDoree,
    'la dorée d Arène doit rester PLUS RARE que celle du shooter (elle coûte souvent plus d un combat)');

  // 💔 La défaite ne devient JAMAIS relativement plus payante que la victoire : la
  // consolation est fixe pendant que les victoires montent, donc l'écart se creuse.
  let partDefaitePrecedente = Infinity;
  for (let r = 1; r <= 60; r++) {
    const gain = arene.recompenseRang(r).perles;
    const part = arene.PERLES_DEFAITE_ARENE / gain;
    assert.ok(arene.PERLES_DEFAITE_ARENE < gain, `rang ${r} : perdre doit rapporter moins que gagner`);
    assert.ok(part <= partDefaitePrecedente + 1e-12,
      `rang ${r} : la défaite devient RELATIVEMENT plus payante (${(part * 100).toFixed(1)} %)`);
    partDefaitePrecedente = part;
  }

  // 🗺️ Tournée : la courbe doit être STRICTEMENT croissante — sinon recommencer une run
  // depuis l'étape 1 vaudrait mieux que pousser, et le mode s'effondrerait sur son
  // plancher anti-farm. On vérifie aussi que ce plancher est bien DÉRIVÉ (prime de
  // risque nulle à l'étape 1), ce qui est la garantie qu'il ne bougera pas par accident.
  assert.equal(
    tournee.perlesVictoireTournee(1),
    tournee.TOURNEE_PERLES_BASE + tournee.TOURNEE_PERLES_PAR_ETAPE,
    'plancher anti-farm : l étape 1 ne porte AUCUNE prime de risque (aucune étape franchie)',
  );
  assert.ok(tournee.TOURNEE_PERLES_RISQUE > 0, 'la prime de risque existe bel et bien au-delà de l étape 1');
  const ETAPE_MAX_TESTEE = 30;
  for (let e = 1; e < ETAPE_MAX_TESTEE; e++) {
    assert.ok(tournee.perlesVictoireTournee(e + 1) > tournee.perlesVictoireTournee(e),
      `étape ${e} → ${e + 1} : pousser doit TOUJOURS battre recommencer`);
    assert.ok(tournee.perlesVictoireTournee(e + 1) > tournee.perlesVictoireTournee(1),
      `étape ${e + 1} : une étape profonde ne peut pas valoir moins qu un reset`);
  }
  // Convexité : l'écart d'une étape à l'autre CROÎT tant que le palier de risque n'est
  // pas atteint, puis se fige (sans le palier, une run profonde deviendrait la ferme
  // optimale du jeu). Bornes dérivées de TOURNEE_RISQUE_PALIER.
  const ecartTournee = (e) => tournee.perlesVictoireTournee(e + 1) - tournee.perlesVictoireTournee(e);
  for (let e = 1; e < tournee.TOURNEE_RISQUE_PALIER; e++) {
    assert.ok(ecartTournee(e + 1) > ecartTournee(e), `étape ${e} : l escalade doit s accélérer avant le palier`);
  }
  for (let e = tournee.TOURNEE_RISQUE_PALIER + 1; e < ETAPE_MAX_TESTEE - 1; e++) {
    assert.equal(ecartTournee(e + 1), ecartTournee(e),
      `étape ${e} : passé TOURNEE_RISQUE_PALIER l escalade doit se FIGER, pas continuer`);
  }
  // Entrées sales numériques : une étape nulle ou négative retombe sur le plancher, jamais
  // sur 0 (l'étape vient d'un champ persisté, `run.etape`, déjà vu sale en migration).
  // Le cas NON NUMÉRIQUE, lui, fuit encore : cf. le 🐞 CONNU du bloc Arène ci-dessus.
  for (const sale of [0, -3, 1.4, null]) {
    assert.equal(tournee.perlesVictoireTournee(sale), tournee.perlesVictoireTournee(1),
      `étape « ${sale} » : repli propre sur l étape 1`);
  }
  // ⚠️ À SURVEILLER (mesuré, pas supposé) : `arene.ts` documente la règle « la Tournée
  // rattrape l'Arène, elle ne la dépasse jamais au combat ». Cette règle est tenue EN
  // MOYENNE DE RUN (mesure du lot), pas victoire par victoire : la courbe de Tournée est
  // linéaire à l'infini au-delà du palier, quand celle de l'Arène est bornée. Le test ne
  // fige pas le point de croisement (il bougera à chaque réglage) — il exige seulement
  // qu'il reste HORS de la fenêtre calibrée du risque. S'il y entre, c'est que la prime
  // a été relevée sans refaire la mesure.
  let croisementTourneeArene = Infinity;
  for (let e = 1; e <= 100; e++) {
    if (tournee.perlesVictoireTournee(e) > arene.ARENE_PERLES_ASYMPTOTE) { croisementTourneeArene = e; break; }
  }
  assert.ok(croisementTourneeArene > tournee.TOURNEE_RISQUE_PALIER,
    `une victoire de Tournée dépasse le plafond dur de l Arène dès l étape ${croisementTourneeArene}`
    + ` (palier de risque : ${tournee.TOURNEE_RISQUE_PALIER})`);

  // --- 🎖️ C · PALIERS DE PARCOURS : arithmétique du chapitre -------------------------
  // Un palier = NIVEAUX_PAR_PALIER niveaux, refermé par son boss. Tout est DÉRIVÉ du
  // numéro de niveau (zéro champ persisté), donc rien ne peut se désynchroniser — mais
  // encore faut-il que les quatre fonctions racontent la MÊME histoire.
  const NIVEAU_MAX_PALIERS = 80;
  for (let n = 1; n <= NIVEAU_MAX_PALIERS; n++) {
    const index = shooter.palierDuNiveau(n);
    const etape = shooter.etapePalier(n);
    const p = shooter.paramsNiveau(n);
    assert.equal(p.palier, index, `niveau ${n} : paramsNiveau et palierDuNiveau doivent s accorder`);
    assert.equal(shooter.creerNiveau(n).palier, index, `niveau ${n} : le palier est posé sur l état de partie`);
    assert.equal(etape.actuel.index, index, `niveau ${n} : etapePalier.actuel`);
    assert.equal(etape.suivant.index, index + 1, `niveau ${n} : etapePalier.suivant est le chapitre d après`);
    assert.equal(etape.niveauBoss, shooter.niveauBossDuPalier(index), `niveau ${n} : boss du chapitre`);
    assert.equal(etape.restants, etape.niveauBoss - n, `niveau ${n} : restants = distance au boss`);
    assert.ok(etape.restants >= 0 && etape.restants < shooter.NIVEAUX_PAR_PALIER,
      `niveau ${n} : restants hors du chapitre (${etape.restants})`);
    assert.ok(n >= shooter.premierNiveauDuPalier(index) && n <= shooter.niveauBossDuPalier(index),
      `niveau ${n} : encadré par son propre chapitre`);
    assert.equal(p.boss, etape.restants === 0, `niveau ${n} : « c est un boss » ⟺ « il ne reste rien à faire »`);
    assert.ok(etape.progression >= 0 && etape.progression <= 1, `niveau ${n} : progression hors de 0..1`);
    // Chaque chapitre est AFFICHABLE : `parcours.tsx` lit ces trois champs sans repli.
    for (const fiche of [etape.actuel, etape.suivant]) {
      assert.ok(fiche.nom && fiche.emoji && fiche.promesse, `palier ${fiche.index} : fiche incomplète (écran muet)`);
    }
  }
  // Entrées sales NUMÉRIQUES : un `niveauMax` nul ou négatif retombe sur le premier
  // chapitre, jamais sur un chapitre négatif (qui indexerait la table à l'envers).
  for (const sale of [0, -7, 1.4]) {
    assert.equal(shooter.palierDuNiveau(sale), 0, `niveau « ${sale} » : repli sur le premier chapitre`);
    assert.equal(shooter.etapePalier(sale).niveauBoss, shooter.NIVEAUX_PAR_PALIER,
      `niveau « ${sale} » : le boss annoncé reste celui du premier chapitre`);
  }
  // ✅ NON-RÉGRESSION (ex-🐞, corrigé le 27/07) — C'ÉTAIT LE PLUS GRAVE DES TROIS : ici
  // on ne dégradait pas, on LEVAIT. `palierInfo` faisait `PALIERS_NOMMES[i % len]` après
  // un `Math.max(0, Math.round(index))` qui ne gardait PAS contre le non-fini : `NaN % 8`
  // vaut NaN, `Infinity % 8` aussi, la table rendait `undefined`, et la lecture de `.nom`
  // jetait un TypeError. Comme `paramsBruts` appelle `renfortPalier(palierDuNiveau(n))`,
  // la chaîne `creerNiveau` → `paramsNiveau` → `palierInfo` propageait le crash. Chemin
  // réel : une sauvegarde serveur portant `aventure.niveauMax: "nawak"` était adoptée
  // telle quelle et `parcours.tsx` (`etapePalier(etat.aventure.niveauMax)` DÈS LE RENDU)
  // tombait en écran rouge, sans moyen d'en sortir.
  // Désormais les trois fonctions REPLIENT sur le premier chapitre. On vérifie non pas
  // « ça ne lève plus » (trop faible : rendre `undefined` ne lève pas non plus) mais que
  // la sortie est UTILISABLE par l'écran qui la consomme.
  for (const nonFini of [NaN, Infinity, -Infinity, 'nawak', undefined, null, {}]) {
    // La boucle « entrées sales NUMÉRIQUES » ci-dessus s'arrête à 0/-7/1.4 : le non fini
    // n'était vérifié nulle part sur `palierDuNiveau`, alors que c'est LUI qui alimente
    // `renfortPalier` et toute la chaîne des chapitres.
    assert.equal(shooter.palierDuNiveau(nonFini), 0,
      `palierDuNiveau(${String(nonFini)}) : repli sur le premier chapitre, jamais un index NaN`);
    const fiche = shooter.palierInfo(nonFini);
    assert.equal(fiche.index, 0, `palierInfo(${String(nonFini)}) : repli sur le premier chapitre`);
    // `parcours.tsx` lit ces trois champs SANS repli : une fiche muette = un écran vide.
    for (const champ of ['nom', 'emoji', 'promesse']) {
      assert.ok(fiche[champ], `palierInfo(${String(nonFini)}) : champ « ${champ} » vide — écran muet`);
    }
    assert.deepEqual(fiche, shooter.palierInfo(0),
      `palierInfo(${String(nonFini)}) : la fiche de repli est CELLE du chapitre 0, pas une fiche bricolée`);
  }
  assert.equal(shooter.etapePalier(NaN).niveauBoss, shooter.NIVEAUX_PAR_PALIER,
    'etapePalier(NaN) : le boss annoncé est celui du premier chapitre (parcours.tsx ne tombe plus)');
  // `niveauBoss` seul ne suffit pas : il est déjà protégé par `palierDuNiveau` ET par
  // `niveauBossDuPalier`, donc il survit même si `etapePalier` cesse d'assainir son
  // niveau — mais `restants` et `progression`, eux, deviennent NaN, et ce sont EUX que
  // `parcours.tsx` affiche (« plus que N avant le boss », barre de progression). On
  // exige donc le contrat COMPLET, dérivé de l'étape 1.
  assert.deepEqual(shooter.etapePalier(NaN), shooter.etapePalier(1),
    'etapePalier(NaN) : contrat COMPLET du repli — la fiche du niveau 1, à l identique');
  for (const champ of ['niveauBoss', 'restants', 'progression']) {
    assert.ok(Number.isFinite(shooter.etapePalier(NaN)[champ]),
      `etapePalier(NaN).${champ} : NaN à l écran, c est une barre de progression morte`);
  }
  {
    // `creerNiveau(NaN)` doit rendre un état JOUABLE, pas seulement « ne pas lever ».
    const degenere = shooter.creerNiveau(NaN);
    assert.ok(degenere.grille[0].cases.some(Boolean), 'creerNiveau(NaN) : plafond vide, rien à viser');
    assert.equal(shooter.orphelines(degenere.grille).length, 0, 'creerNiveau(NaN) : grappe isolée au départ');
    assert.ok(Number.isFinite(degenere.tirsMax), 'creerNiveau(NaN) : tirsMax non fini, le compteur de tirs casse');
    assert.ok(Number.isFinite(degenere.tirsRestants), 'creerNiveau(NaN) : tirsRestants non fini');
  }
  // Au-delà de la table, le parcours BOUCLE en le DISANT (l'index reste vrai, le nom
  // porte le tour) : mieux vaut un cycle assumé qu'une ligne plate qui prétend progresser.
  {
    let periode = null;
    for (let i = 1; i <= 40 && periode === null; i++) {
      if (shooter.palierInfo(i).emoji === shooter.palierInfo(0).emoji
        && shooter.palierInfo(i).promesse === shooter.palierInfo(0).promesse) periode = i;
    }
    assert.ok(periode !== null && periode >= 4, `la table des chapitres doit contenir au moins 4 entrées (période ${periode})`);
    assert.equal(shooter.palierInfo(periode).index, periode, 'un chapitre recyclé garde son VRAI index');
    assert.notEqual(shooter.palierInfo(periode).nom, shooter.palierInfo(0).nom,
      'un chapitre recyclé change de nom (le joueur doit voir qu il repasse)');
    assert.equal(shooter.palierInfo(2 * periode).index, 2 * periode, 'et au deuxième tour aussi');
  }
  // 🎖️ Le RENFORT : rien avant PALIER_RENFORT_MIN (les premiers chapitres ont déjà de
  // vraies nouveautés), et JAMAIS un bloc ni un portail — un chapitre doit OUVRIR
  // quelque chose, pas murer le plateau, et `portailsDeGrille` n apparie que la première
  // paire trouvée (une seconde ferait communiquer deux paires différentes).
  const PERLES_INTERDITES_EN_RENFORT = ['portail', 'glacon', 'roche'];
  for (let i = 0; i < shooter.PALIER_RENFORT_MIN; i++) {
    assert.equal(shooter.renfortPalier(i), null,
      `palier ${i} : aucun renfort avant PALIER_RENFORT_MIN (les seuils historiques suffisent)`);
  }
  for (let i = 0; i <= 40; i++) {
    const r = shooter.renfortPalier(i);
    if (r === null) continue;
    assert.ok(shooter.EFFETS_PERLE[r], `palier ${i} : renfort « ${r} » absent du registre des perles`);
    assert.equal(PERLES_INTERDITES_EN_RENFORT.includes(r), false,
      `palier ${i} : « ${r} » ne doit JAMAIS être un renfort de chapitre (bloc ou portail)`);
  }

  // --- 👹 C · LE TROU LE PLUS COÛTEUX : des niveaux boss ARITHMÉTIQUEMENT ingagnables -
  // Les PV du boss suivaient `26 + 4n` pendant que le budget de tirs PLAFONNE : il
  // fallait 7,4 dégâts par tir au niveau 40 quand le maximum mesuré est 4,6. Neuf
  // niveaux boss étaient hors d'atteinte, livrés en production. La borne est désormais
  // adossée à la MATIÈRE réelle (le budget de tirs) — on la verrouille ici comme les
  // bornes de 'couleur', 'lacher', 'parfaits' et 'speciales'.
  // Plafond de dégâts par tir RÉELLEMENT mesuré sur un bot en force brute (1,28 à 4,63
  // selon les niveaux). Ce n'est pas une valeur dérivable : c'est une MESURE, et c'est
  // elle qui empêche de « réparer » un boss ingagnable en gonflant la constante.
  const BOSS_DEGATS_PAR_TIR_MESURE_MAX = 4.6;
  assert.ok(shooter.BOSS_DEGATS_PAR_TIR > 0 && shooter.BOSS_DEGATS_PAR_TIR <= BOSS_DEGATS_PAR_TIR_MESURE_MAX,
    `BOSS_DEGATS_PAR_TIR = ${shooter.BOSS_DEGATS_PAR_TIR} : au-dessus du maximum MESURÉ (${BOSS_DEGATS_PAR_TIR_MESURE_MAX}),`
    + ' la borne ne borne plus rien et les niveaux boss redeviennent ingagnables');
  const NIVEAU_MAX_BOSS = 60;
  let niveauxBoss = 0;
  for (let n = shooter.NIVEAUX_PAR_PALIER; n <= NIVEAU_MAX_BOSS; n += shooter.NIVEAUX_PAR_PALIER) {
    const p = shooter.paramsNiveau(n);
    assert.equal(p.objectif.type, 'boss', `niveau ${n} : un multiple de NIVEAUX_PAR_PALIER doit porter le boss`);
    niveauxBoss++;
    assert.ok(p.tirsMax > 0, `niveau ${n} : un niveau boss doit avoir un budget de tirs`);
    assert.ok(
      p.objectif.pv <= p.tirsMax * shooter.BOSS_DEGATS_PAR_TIR,
      `niveau ${n} : ${p.objectif.pv} PV pour ${p.tirsMax} tirs, soit `
      + `${(p.objectif.pv / p.tirsMax).toFixed(2)} dégâts/tir exigés — au-dessus du plafond du jeu`,
    );
    assert.ok(p.objectif.pv > 0, `niveau ${n} : un boss sans PV n est pas un boss`);
    // La borne historique reste un PLAFOND : on ramène sur terre les boss impossibles,
    // on n en durcit aucun au passage.
    assert.ok(p.objectif.pv <= 26 + n * 4,
      `niveau ${n} : ${p.objectif.pv} PV dépasse la borne historique 26 + 4n (${26 + n * 4})`);
  }
  assert.ok(niveauxBoss >= 12, `l échantillon doit couvrir tout le parcours boss (${niveauxBoss} niveaux)`);
  // …et la borne arithmétique ne suffit pas : un bot DÉTERMINISTE en force brute doit
  // réellement terrasser chaque boss. Même protocole que F9 (angles balayés, munition
  // échangée ou non, graines FIXES) — s'il y arrive, un joueur qui anticipe y arrive.
  const ANGLES_BOSS = 40;
  const rejouerBossEnForceBrute = (n, graine) => {
    const etat = shooter.creerNiveau(n);
    const rngBoss = shooter.creerRng(graine);
    let coups = 0;
    while (!shooter.objectifAtteint(etat) && (etat.tirsRestants || 0) > 0 && !etat.perdu && coups < 60) {
      let meilleur = null;
      for (let swap = 0; swap < 2; swap++) {
        for (let k = 0; k < ANGLES_BOSS; k++) {
          const angle = -Math.PI + (k + 0.5) * (Math.PI / ANGLES_BOSS);
          const essai = clonerF7(etat);
          if (swap) shooter.echangerMunitions(essai);
          const avant = essai.objProgres;
          const r = shooter.tirer(essai, LANCEUR_F7, angle, () => 0.5);
          const note = (shooter.objectifAtteint(essai) ? 1e6 : 0)
            + (essai.objProgres - avant) * 1000
            + (essai.perdu ? -5e5 : 0)
            - shooter.ligneLaPlusBasse(essai.grille) * 30   // ne pas se laisser enterrer
            + r.eclatees.length * 3 + r.tombees.length * 2;
          if (!meilleur || note > meilleur.note) meilleur = { note, angle, swap };
        }
      }
      if (!meilleur) break;
      if (meilleur.swap) shooter.echangerMunitions(etat);
      shooter.tirer(etat, LANCEUR_F7, meilleur.angle, rngBoss);
      coups++;
    }
    return { gagne: shooter.objectifAtteint(etat), degats: etat.objProgres, pv: etat.objectif.pv, enterre: etat.perdu };
  };
  for (let n = shooter.NIVEAUX_PAR_PALIER; n <= 40; n += shooter.NIVEAUX_PAR_PALIER) {
    let issue = null;
    for (const graine of [7, 101, 999, 31337, 4242, 8080]) {
      issue = rejouerBossEnForceBrute(n, graine);
      if (issue.gagne) break;
    }
    assert.equal(issue.gagne, true,
      `niveau ${n} (boss ${issue.pv} PV) : aucune victoire en force brute — meilleur total ${issue.degats} dégâts`
      + `${issue.enterre ? ', bot ENTERRÉ par la descente' : ''}`);
  }

  // --- 🎖️ C · LES PREMIERS NIVEAUX SONT FIGÉS ---------------------------------------
  // `poserSpecial` CONSOMME le rng : intercaler une pose (renfort de palier, nouvelle
  // perle) avant les poses historiques déplacerait TOUT le parcours, y compris le tunnel
  // d'apprentissage déjà équilibré. Les poses de palier sont donc faites EN DERNIER, et
  // valent 0 avant leur chapitre. On le vérifie des deux façons :
  //  1. par la CAUSE — aucune pose de palier ne se déclenche sur les premiers niveaux ;
  //  2. par l'EFFET — l'empreinte de génération de ces niveaux ne bouge pas d'un iota.
  // ⚠️ Le niveau 15 est volontairement HORS de l'empreinte : c'est un niveau BOSS, et la
  // géométrie de son plateau appartient au correctif de faisabilité des boss (marge de
  // rangées, PV bornés par le budget), qui est en cours de réglage MESURÉ. Sa neutralité
  // vis-à-vis des paliers, elle, est bien vérifiée ci-dessous.
  const NIVEAUX_NEUTRES_PALIER = shooter.premierNiveauDuPalier(shooter.PALIER_RENFORT_MIN) - 1;
  assert.ok(NIVEAUX_NEUTRES_PALIER >= 15,
    `le renfort de palier ne doit pas démarrer avant le niveau 16 (mesuré : ${NIVEAUX_NEUTRES_PALIER + 1})`);
  const PERLES_DE_PALIER = new Set();
  for (let i = 0; i <= 40; i++) { const r = shooter.renfortPalier(i); if (r) PERLES_DE_PALIER.add(r); }
  for (let n = 1; n <= NIVEAUX_NEUTRES_PALIER; n++) {
    const p = shooter.paramsNiveau(n);
    assert.equal(p.renfort, null, `niveau ${n} : aucun renfort de palier avant le chapitre qui l ouvre`);
    assert.equal(shooter.renfortPalier(shooter.palierDuNiveau(n)), null,
      `niveau ${n} : son chapitre ne doit rien renforcer`);
  }
  // …et le lot n'est pas inerte pour autant : passé la zone neutre, un chapitre OUVRE
  // réellement quelque chose sur le plateau. Sans ce contrôle, un `renfortPalier` qui
  // rendrait `null` partout passerait tous les tests ci-dessus en silence.
  let niveauxAvecRenfort = 0;
  for (let n = NIVEAUX_NEUTRES_PALIER + 1; n <= NIVEAU_MAX_BOSS; n++) {
    if (shooter.paramsNiveau(n).renfort) niveauxAvecRenfort++;
  }
  assert.ok(niveauxAvecRenfort > 0,
    'les paliers doivent RENFORCER quelque chose au-delà du niveau 15 — sinon le lot ne change rien');
  assert.ok(PERLES_DE_PALIER.size > 0, 'au moins une perle sert de signature de chapitre');
  // Empreinte de génération : type d'objectif / budget de tirs / rangées / hachage du
  // plateau. Ce n'est PAS une valeur dérivable, c'est un test de caractérisation — si une
  // ligne bouge, c'est qu'un tirage a été intercalé, et il faut le savoir tout de suite.
  const empreinteNiveau = (n) => {
    const e = shooter.creerNiveau(n);
    const plan = e.grille.map((l) => (l.decalee ? '>' : '|') + l.cases
      .map((b) => (b ? (b.capsule ? 'C' : (b.special ? b.special[0].toUpperCase() : String(b.couleur))) : '.'))
      .join('')).join('');
    let h = 2166136261;
    for (let i = 0; i < plan.length; i++) { h ^= plan.charCodeAt(i); h = Math.imul(h, 16777619); }
    return `${e.objectif.type}/${e.tirsMax}/${e.grille.length}/${(h >>> 0).toString(36)}`;
  };
  const EMPREINTES_FIGEES = [
    'capsules/29/4/9sovcm', 'capsules/28/4/wdn1ap', 'couleur/30/4/h7vlko', 'nettoyer/29/4/88ot8u',
    'boss/35/5/qftev8', 'tomber/28/5/6auwvl', 'lacher/28/5/17q4737', 'nettoyer/27/5/1wxqt1q',
    'capsules/29/6/pwvgmv', 'boss/32/6/1p47o45', 'couleur/26/6/zb5867', 'chaine/25/6/m7dyaf',
    'parfaits/25/7/1o7ef2h', 'tomber/24/7/vxnsck',
  ];
  for (let n = 1; n <= EMPREINTES_FIGEES.length; n++) {
    assert.equal(empreinteNiveau(n), EMPREINTES_FIGEES[n - 1],
      `niveau ${n} : sa génération a bougé — un tirage a été intercalé, tout le parcours a glissé`);
  }
  // …et la génération reste PURE : deux appels donnent le même plateau (c'est ce qui
  // garantit que « chaque niveau est le même pour tout le monde »).
  for (const n of [3, 15, 21, 26, 44]) {
    assert.equal(empreinteNiveau(n), empreinteNiveau(n), `niveau ${n} : génération non déterministe`);
  }
  // Une paire de perles jumelles est posée ENTIÈRE ou pas du tout : une jumelle
  // solitaire n'a personne à appeler, et un portail solitaire dévierait vers le néant
  // (`portailsDeGrille` rend `null` en deçà de deux — repli sûr, mais promesse trahie).
  for (let n = 1; n <= NIVEAU_MAX_BOSS; n++) {
    const paires = {};
    for (const l of shooter.creerNiveau(n).grille) {
      for (const b of l.cases) {
        if (b && (b.special === 'lien' || b.special === 'portail')) {
          const cle = `${b.special}:${b.lienId}`;
          paires[cle] = (paires[cle] || 0) + 1;
        }
      }
    }
    for (const [cle, nb] of Object.entries(paires)) {
      assert.equal(nb % 2, 0, `niveau ${n} : ${cle} posée en ${nb} exemplaire(s) — paire incomplète`);
    }
  }

  // --- 🧋 D · LE HUB PROMET LA GORGÉE *AVANT* LA VISITE ------------------------------
  // La mécanique marchait déjà, mais elle n'apparaissait qu'APRÈS coup : un joueur qui
  // n'est jamais venu ne pouvait pas découvrir que venir paie. Une récompense que le
  // joueur ignore ne change aucun comportement. Test de SOURCE (comme le bloc 🎬 DUEL) :
  // il empêche un futur lot de retirer la promesse sans s'en apercevoir.
  {
    assert.equal((hub.match(/<CarteGorgeeFraiche/g) || []).length, 1,
      'le hub doit porter la carte de promesse de la Gorgée Fraîche, une fois et une seule');
    const carteGorgee = hub.split('function CarteGorgeeFraiche')[1].split('\nfunction ')[0];
    // La promesse ne se cache JAMAIS derrière une visite déjà faite : le seul repli du
    // composant est le garde-fou de typage, et la liste des lots est construite avant
    // que l'état de visite ne soit seulement consulté.
    assert.equal((carteGorgee.match(/return null/g) || []).length, 1,
      'la carte ne doit avoir qu UN seul repli (le garde-fou de typage), jamais une visite en condition');
    assert.match(carteGorgee, /if \(!lot\) return null/,
      'ce repli doit être celui du lot introuvable, pas « le joueur n est pas venu »');
    assert.ok(carteGorgee.indexOf('const lots') < carteGorgee.indexOf('visite.actif'),
      'les lots promis sont construits AVANT toute lecture de l état de visite');
    // Les chiffres viennent de la fonction qui PAIE réellement, jamais d'une recopie.
    assert.match(carteGorgee, /gorgeePourBoissons\(1\)/,
      'le lot promis doit venir de gorgeePourBoissons — la fonction que crediterGorgee appelle');
    for (const champ of ['multiplicateur', 'heuresX2', 'maxCapsulesClassiques', 'capsuleParBoissonEnPlus']) {
      assert.ok(carteGorgee.includes(`GORGEE_FRAICHE.${champ}`),
        `la promesse doit dériver GORGEE_FRAICHE.${champ}, jamais le recopier`);
    }
    for (const champ of ['perles', 'capsulesDorees', 'tournees']) {
      assert.ok(carteGorgee.includes(`lot.${champ}`), `la promesse doit lire lot.${champ}`);
    }
    // Aucune valeur de l'économie recopiée en dur. On ne teste que les valeurs à deux
    // chiffres ou plus : « 1 », « 2 », « 4 » sont trop ambigus pour être cherchés dans du
    // JSX (tailles d'icône, pluriels), et ce sont les grands nombres qui se démodent.
    for (const [cle, valeur] of Object.entries(economie.GORGEE_FRAICHE)) {
      if (typeof valeur !== 'number' || valeur < 10) continue;
      assert.equal(new RegExp(`\\b${valeur}\\b`).test(carteGorgee), false,
        `la promesse écrit ${valeur} en dur au lieu de dériver GORGEE_FRAICHE.${cle}`);
    }
    // La CÉLÉBRATION (après la visite) est tenue à la même règle : elle ne doit pas
    // annoncer une durée ou un multiplicateur que l'économie ne tient plus.
    assert.match(hub, /Perles ×\{GORGEE_FRAICHE\.multiplicateur\} pendant \{GORGEE_FRAICHE\.heuresX2\} h/,
      'la modale de célébration doit elle aussi dériver durée et multiplicateur');
  }
  // Et la promesse est TENUE : ce que le hub annonce est exactement ce que le store verse.
  // (contrôle de comportement, pas de source : c'est lui qui rend le test de source utile)
  for (const boissons of [1, 2, 3, 6, 99]) {
    store.resetBobaQuest();
    const promis = economie.gorgeePourBoissons(boissons);
    const avantG27 = {
      perles: etatCourant().perles,
      dorees: etatCourant().capsulesDoreesGratuites,
      classiques: etatCourant().capsulesGratuites,
      tournees: etatCourant().tourneesOffertes,
    };
    const verse = store.crediterGorgee(boissons);
    assert.deepEqual(verse, promis, `${boissons} boisson(s) : le crédit est exactement le lot annoncé`);
    assert.equal(etatCourant().perles - avantG27.perles, promis.perles,
      `${boissons} boisson(s) : perles versées = perles promises (aucun multiplicateur)`);
    assert.equal(etatCourant().capsulesDoreesGratuites - avantG27.dorees, promis.capsulesDorees,
      `${boissons} boisson(s) : capsules dorées versées = promises`);
    assert.equal(etatCourant().capsulesGratuites - avantG27.classiques, promis.capsulesClassiques,
      `${boissons} boisson(s) : capsules classiques versées = promises`);
    assert.equal(etatCourant().tourneesOffertes - avantG27.tournees, promis.tournees,
      `${boissons} boisson(s) : Tournées offertes versées = promises`);
    assert.ok(promis.capsulesClassiques <= economie.GORGEE_FRAICHE.maxCapsulesClassiques,
      'le plafond annoncé par le hub est bien celui que l économie applique');
  }
  store.resetBobaQuest();

  // --- 💸 E · NON-RÉGRESSION ÉCONOMIQUE : on ne paie jamais deux fois ----------------
  // Le boss hebdo n'est battable qu'une fois par semaine. Un double appel (double-tap,
  // remontage d'écran, rejeu d'une fin de combat) ne doit RIEN recréditer — et ne doit
  // même pas consommer de révision de sauvegarde, sinon chaque non-crédit pousserait
  // quand même un état au serveur.
  store.resetBobaQuest();
  const avantBoss = {
    perles: etatCourant().perles, capsules: etatCourant().capsulesGratuites,
    eclats: etatCourant().eclats, pc: etatCourant().classement.pc, xp: etatCourant().pass.xp,
  };
  const boss1 = store.victoireBoss();
  assert.equal(boss1.deja, false, 'première victoire : le boss n était pas encore battu');
  assert.equal(etatCourant().perles - avantBoss.perles, boss1.perles, 'perles créditées une fois');
  assert.equal(etatCourant().capsulesGratuites - avantBoss.capsules, economie.BOSS_RECOMPENSE.capsules, 'capsule créditée');
  assert.equal(etatCourant().eclats - avantBoss.eclats, economie.BOSS_RECOMPENSE.eclats, 'éclats crédités');
  assert.ok(etatCourant().classement.pc > avantBoss.pc, 'PC de classement crédités');
  assert.ok(etatCourant().pass.xp > avantBoss.xp, 'XP de Pass créditée');
  const empreinteApresBoss = JSON.stringify(store.instantaneEtat());
  const boss2 = store.victoireBoss();
  assert.deepEqual(boss2, { perles: 0, capsules: 0, eclats: 0, deja: true },
    'deuxième victoireBoss() : aucun versement, et le récap le SAIT (deja)');
  assert.equal(JSON.stringify(store.instantaneEtat()), empreinteApresBoss,
    'un second appel ne bouge RIEN — pas même la révision de sauvegarde');
  assert.equal(store.bossBattuCetteSemaine(), true, 'le boss reste marqué battu pour la semaine');
  store.resetBobaQuest();

  // 👹 LA REVANCHE DU BOSS HEBDO NE CRÉDITE RIEN. Elle rouvre la porte du contenu le plus
  // intéressant du jeu (« Vaincu — reviens lundi » était une récompense en forme de porte
  // close), mais sans un centime : ni perle, ni capsule, ni éclat. Deux garanties à tenir,
  // et l'écran est le seul endroit où elles vivent — d'où un test de SOURCE.
  {
    const duelRevanche = fs.readFileSync(path.join(racine, 'src/app/jeu/duel.tsx'), 'utf8');
    const ecranArene = fs.readFileSync(path.join(racine, 'src/app/jeu/arene.tsx'), 'utf8');
    // 1) LE CRÉDIT — la branche de revanche n'appelle AUCUNE fonction de versement. Le
    //    garde-fou `{ deja: true }` de `victoireBoss()` ne suffit pas : un appel « qui ne
    //    fait rien » est une bombe à retardement (il suffirait qu'un lot ajoute une ligne
    //    AVANT le garde-fou pour transformer la revanche en distributeur).
    const brancheBoss = duelRevanche.split("} else if (mode === 'boss') {")[1].split("} else if (mode === 'tournoi') {")[0];
    assert.ok(brancheBoss && brancheBoss.includes('if (revanche) {'),
      'duel.tsx : le mode boss doit distinguer la REVANCHE du combat hebdomadaire');
    const brancheRevanche = brancheBoss.split('if (revanche) {')[1].split('} else if (gagne) {')[0];
    for (const crediteur of [
      'victoireBoss', 'victoireArene', 'defaiteArene', 'victoireTournoi', 'victoireTourneeDuel',
      'crediterGorgee', 'ouvrirCapsule', 'gagnerXpPass', 'appliquerPc', 'gagnerConsommable',
    ]) {
      assert.equal(brancheRevanche.includes(`${crediteur}(`), false,
        `duel.tsx : la revanche ne doit JAMAIS appeler ${crediteur}() — même « à vide »`);
    }
    for (const zero of ['perles: 0', 'capsules: 0', 'eclats: 0']) {
      assert.ok(brancheRevanche.includes(zero), `duel.tsx : le récap de revanche doit poser ${zero}`);
    }
    // 2) L'ANNONCE — le récap ne peut PAS afficher un gain non versé : sa branche de rendu
    //    ne contient aucune ligne de gain, par construction.
    const recapRevanche = duelRevanche
      .split("recap.type === 'boss' && recap.revanche > 0")[1]
      .split("recap.type === 'boss' && recap.revanche === 0")[0];
    assert.ok(recapRevanche.length > 0, 'duel.tsx : le récap de revanche doit exister');
    assert.equal(/ligneGain/.test(recapRevanche), false,
      'duel.tsx : la branche de revanche ne doit contenir AUCUNE ligne de gain');
    assert.match(recapRevanche, /ni perles, ni capsule, ni éclats/,
      'duel.tsx : le récap doit DIRE que la revanche ne paie rien');
    // …tandis que le vrai combat hebdomadaire, lui, annonce toujours ses gains.
    const recapHebdo = duelRevanche.split("recap.type === 'boss' && recap.revanche === 0")[1].split('\n              )}')[0];
    assert.ok(/ligneGain/.test(recapHebdo),
      'duel.tsx : le combat hebdomadaire, lui, doit continuer d annoncer ses gains');
    // 3) SORTIR d'une revanche ne peut rien coûter : la traiter comme un combat à enjeu
    //    afficherait une confirmation d'abandon mensongère.
    assert.match(duelRevanche, /const aEnjeu = [^\n]*&& !revanche/,
      'duel.tsx : une revanche n a AUCUN enjeu comptable, la sortie ne doit rien pénaliser');
    // 4) L'Arène ne doit pas afficher la ligne de récompense au-dessus d'un bouton qui ne
    //    paie rien : elle n'annonce que ce qui est réellement versable.
    assert.match(ecranArene, /\{!bossBattu && \([\s\S]{0,120}?styles\.bossRecompRang/,
      'arene.tsx : la ligne de récompense du boss doit DISPARAÎTRE une fois le boss battu');
    assert.match(ecranArene, /aucune perle, aucune capsule, aucun éclat/,
      'arene.tsx : le bloc de revanche doit annoncer clairement qu il ne paie rien');
    assert.match(ecranArene, /revanche=\$\{palierRevanche\(\)\}/,
      'arene.tsx : le palier de revanche passe par la ROUTE, pas par une seconde source de vérité');
  }

  // ==================================================================================
  // 🔗🌀 A · INVARIANTS DE PLATEAU — les perles qui n'ont de sens QU'EN PAIRE
  // ==================================================================================
  // Le correctif du 27/07 a fermé « perles spéciales perdues » : la pose d'une paire
  // était tentée perle par perle, donc une jumelle pouvait atterrir seule (sa moitié
  // orpheline ne détruit plus rien) et un portail seul (il ne mène nulle part —
  // `portailsDeGrille` apparie les DEUX PREMIERS portails trouvés, un impair fausse
  // la trajectoire). Ces deux invariants FIGENT le correctif : ils tiennent sur toute
  // la plage jouable, pas sur les trois niveaux qu'on avait sous les yeux.
  const NIVEAU_MAX_INVARIANTS = 80;
  // Dosage ANNONCÉ par `paramsNiveau` → nom du champ. `lien` et `portail` s'annoncent en
  // PAIRES (cf. le type ParamsNiveau) : 1 paire = 2 perles sur la grille.
  const CHAMP_DOSAGE = {
    glacon: 'nbGlacons', bombe: 'nbBombes', givre: 'nbGivre', arc: 'nbArc', bonus: 'nbBonus',
    etoile: 'nbEtoiles', tir: 'nbTirsPlus', laser: 'nbLasers', contagion: 'nbContagions',
    roche: 'nbRoches', meche: 'nbMeches', cascade: 'nbCascades', aimant: 'nbAimants',
    lien: 'nbLiens', portail: 'nbPortails',
  };
  const PAR_PAIRE = ['lien', 'portail'];
  for (let n = 1; n <= NIVEAU_MAX_INVARIANTS; n++) {
    const plateau = shooter.creerNiveau(n);
    const params = shooter.paramsNiveau(n);

    // 1) TOUTE paire posée compte EXACTEMENT 2 perles. Ni un portail seul (trajectoire
    //    fausse), ni une jumelle orpheline (perle morte que le joueur croit utile).
    const paires = new Map();
    const poses = {};
    for (const ligne of plateau.grille) {
      for (const bulle of ligne.cases) {
        if (!bulle || !bulle.special) continue;
        poses[bulle.special] = (poses[bulle.special] || 0) + 1;
        if (PAR_PAIRE.includes(bulle.special)) {
          const cle = `${bulle.special}#${bulle.lienId}`;
          paires.set(cle, (paires.get(cle) || 0) + 1);
        }
      }
    }
    for (const [cle, compte] of paires) {
      assert.equal(compte, 2,
        `niveau ${n} : « ${cle} » posé ${compte} fois — une paire compte EXACTEMENT 2 perles`);
    }
    // …et l'appariement doit rester LISIBLE par le moteur : autant de paires que de
    // `lienId` distincts, donc jamais deux perles de paires différentes confondues.
    for (const special of PAR_PAIRE) {
      const nbPaires = [...paires.keys()].filter((c) => c.startsWith(`${special}#`)).length;
      assert.equal(poses[special] || 0, nbPaires * 2,
        `niveau ${n} : ${poses[special] || 0} ${special}(s) pour ${nbPaires} paire(s) — un impair traîne`);
    }
    // `portailsDeGrille` est le consommateur direct de cet invariant : il rend une paire
    // s'il y en a une, et n'en INVENTE pas quand la grille n'en porte aucune.
    const nbPairesPortail = [...paires.keys()].filter((c) => c.startsWith('portail#')).length;
    const apparies = shooter.portailsDeGrille(plateau.grille);
    if (nbPairesPortail > 0) {
      assert.ok(apparies, `niveau ${n} : ${nbPairesPortail} paire(s) de portails posée(s), portailsDeGrille rend null`);
    } else {
      assert.equal(apparies, null, `niveau ${n} : aucun portail posé, portailsDeGrille en invente une paire`);
    }

    // 2) LE DOSAGE ANNONCÉ EST TENU. C'est le test qui aurait attrapé « niveau 15 :
    //    1 portail demandé, 0 posé » : `paramsNiveau` promet, `creerNiveau` dispose, et
    //    rien ne les confrontait. Comparaison en ≤ (jamais en =) : `creerNiveau` a le
    //    droit de SEMER en plus (bonus de secours quand la pose réelle est trop pauvre),
    //    jamais d'en poser MOINS que ce que l'écran de niveau annonce au joueur.
    for (const [special, champ] of Object.entries(CHAMP_DOSAGE)) {
      const parUnite = PAR_PAIRE.includes(special) ? 2 : 1;
      // 🎖️ Le RENFORT de chapitre s'ajoute au dosage de base : il est posé par le même
      // chemin, il doit donc être compté du même côté de l'inégalité.
      const annonce = (params[champ] || 0) * parUnite + (params.renfort === special ? parUnite : 0);
      assert.ok((poses[special] || 0) >= annonce,
        `niveau ${n} : ${special} annoncé ${annonce}, posé ${poses[special] || 0}`
        + ` (renfort du chapitre ${params.palier} : ${params.renfort ?? 'aucun'})`);
    }
  }
  // Le test ne serait qu'un décor s'il ne portait sur rien : au moins un niveau de la
  // plage DOIT réellement annoncer une paire, sinon l'invariant ne mord nulle part.
  assert.ok(
    Array.from({ length: NIVEAU_MAX_INVARIANTS }, (_, i) => shooter.paramsNiveau(i + 1))
      .some((p) => p.nbLiens > 0 || p.nbPortails > 0),
    'prémisse : la plage testée doit contenir des paires, sinon l invariant ne vérifie rien',
  );

  // ==================================================================================
  // 💾 B · MIGRATION — LA FAMILLE « NaN » EST FERMÉE
  // ==================================================================================
  // Rappel de la règle, parce que c'est ELLE qu'on verrouille ici et pas trois cas
  // particuliers : **UNE COMPARAISON N'EST PAS UN GARDE-FOU CONTRE `NaN`.**
  // `Math.max(1, NaN)` vaut NaN et `'nawak' < 30` vaut `false` — un test qui a l'air de
  // borner une valeur ne la borne que si la valeur est DÉJÀ un nombre. Les sous-objets
  // de `migrerSauvegarde` étaient recopiés par SPREAD BRUT : le brut serveur arrivait
  // donc intact jusqu'à l'arithmétique du jeu.

  // — B1. `pass.xp` sale n'offre plus la piste entière —————————————————————————
  // `assurerSemainePass` saute un palier quand `etat.pass.xp < palier.xp`. Avec
  // `xp: 'nawak'` la comparaison est FAUSSE à chaque palier : aucun n'était sauté, donc
  // le rattrapage hebdomadaire les octroyait TOUS — exactement le résultat d'un
  // `xp: 99999`. On mesure par `consommerPassRattrape()`, qui isole le crédit du pass
  // du bruit des perles de série et du multiplicateur d'événement du jour.
  const VIDE = { perles: 0, capsules: 0, capsulesDorees: 0 };
  const rattrapagePass = (xp) => {
    store.resetBobaQuest();
    store.consommerPassRattrape();       // purge un éventuel reliquat des tests précédents
    // semaine vide ⇒ jamais la semaine courante ⇒ le rollover hebdomadaire se déclenche
    store.adopterEtatServeur({ perles: 0, pass: { semaine: '', xp, reclames: [] } }, 900);
    store.tickSerie();                   // le point de passage du rattrapage (hub)
    return store.consommerPassRattrape() || { ...VIDE };
  };
  // Attendu DÉRIVÉ de la table des paliers, jamais figé : c'est la piste COMPLÈTE.
  const pistePleine = economie.PASS_PALIERS.reduce((acc, p) => ({
    perles: acc.perles + (p.type === 'perles' ? p.qte : 0) + (p.perlesBonus || 0),
    capsules: acc.capsules + (p.type === 'capsule' ? p.qte : 0),
    capsulesDorees: acc.capsulesDorees + (p.type === 'capsule_doree' ? p.qte : 0),
  }), { ...VIDE });
  const xpDernierPalier = economie.PASS_PALIERS[economie.PASS_PALIERS.length - 1].xp;
  assert.ok(pistePleine.perles > 0 && pistePleine.capsulesDorees > 0,
    'prémisse : la piste complète vaut bien quelque chose (perles ET capsule dorée)');
  // Les deux bornes SAINES d'abord — sans elles, un rattrapage cassé « en dur à zéro »
  // passerait le test du cas sale sans rien prouver.
  assert.deepEqual(rattrapagePass(0), VIDE, 'xp 0 : aucun palier atteint, rien à rattraper');
  assert.deepEqual(rattrapagePass(xpDernierPalier), pistePleine,
    'xp au dernier palier : la piste ENTIÈRE est bien rattrapable (sinon le test suivant ne prouve rien)');
  // ✅ LE CAS QUI FUYAIT.
  for (const sale of ['nawak', {}, [], true]) {
    assert.deepEqual(rattrapagePass(sale), VIDE,
      `pass.xp « ${JSON.stringify(sale)} » : un xp non numérique n octroie plus RIEN`);
    assert.notDeepEqual(rattrapagePass(sale), pistePleine,
      `pass.xp « ${JSON.stringify(sale)} » : et surtout plus la PISTE ENTIÈRE (l ancien symptôme)`);
  }
  // Coercition AVANT test de finitude : une sauvegarde qui porte "2200" garde sa valeur.
  // On n'assainit jamais au prix d'une donnée légitime.
  assert.deepEqual(rattrapagePass(String(xpDernierPalier)), pistePleine,
    `pass.xp "${xpDernierPalier}" (chaîne LÉGITIME) : coercé, donc la piste reste due`);
  // Et l'xp lui-même est un nombre fini après migration, quoi qu'il arrive.
  for (const sale of ['nawak', null, undefined]) {
    store.resetBobaQuest();
    store.adopterEtatServeur({ perles: 0, pass: { semaine: economie.cleSemaine(), xp: sale, reclames: [] } }, 901);
    assert.ok(Number.isFinite(etatCourant().pass.xp),
      `pass.xp « ${String(sale)} » : la valeur persistée est un nombre FINI après migration`);
  }
  // Les index de paliers réclamés restent des index de la table (hors table = rien).
  store.resetBobaQuest();
  store.adopterEtatServeur({
    perles: 0,
    pass: { semaine: economie.cleSemaine(), xp: 500, reclames: [0, 2, 'nawak', -1, 999, 1.5, 2] },
  }, 902);
  assert.deepEqual(etatCourant().pass.reclames, [0, 2],
    'pass.reclames : seuls les INDEX réels de la table survivent (dédupliqués), le reste ne désigne rien');

  // — B2. `classement.pc` ne devient plus `NaN` (ni une chaîne qui se concatène) ————
  // `appliquerPc` fait `Math.max(0, etat.classement.pc + delta)`. Avec `pc: 'nawak'` le
  // résultat était `NaN` : tier de saison retombé à Bronze, et PC poussé au serveur en
  // `null` (JSON n'a pas de NaN) — DÉFINITIVEMENT, sans un seul message.
  const saisonCourante = economie.cleMois();
  const classementSauve = (pc) => ({
    perles: 0,
    classement: { pc, saison: saisonCourante, meilleurTierSaison: 0, recompenseEnAttente: null, titres: [] },
  });
  // `true` n'est pas de la liste : `Number(true)` vaut 1, c'est une coercition
  // LÉGITIME (même règle que `Number("12")` → 12), pas une valeur à neutraliser.
  for (const sale of ['nawak', {}, [], 'Infinity', null, undefined]) {
    store.resetBobaQuest();
    store.adopterEtatServeur(classementSauve(sale), 910);
    assert.equal(etatCourant().classement.pc, 0,
      `classement.pc « ${JSON.stringify(sale)} » : ramené à 0 dès la migration`);
    store.victoireArene(1);
    const apres = etatCourant().classement;
    assert.ok(Number.isFinite(apres.pc), `classement.pc « ${JSON.stringify(sale)} » : reste FINI après une victoire`);
    assert.equal(apres.pc, economie.PC_VICTOIRE,
      `classement.pc « ${JSON.stringify(sale)} » : la victoire crédite exactement PC_VICTOIRE`);
    // Ce que le serveur recevrait réellement : `JSON.stringify(NaN)` vaut `null`.
    assert.notEqual(JSON.parse(JSON.stringify(apres)).pc, null,
      `classement.pc « ${JSON.stringify(sale)} » : le push serveur ne porte plus « pc: null »`);
    assert.equal(apres.meilleurTierSaison, economie.tierPourPc(apres.pc).id,
      `classement.pc « ${JSON.stringify(sale)} » : le tier de saison suit le PC réel`);
  }
  // Symétrique, et plus sournois : un `pc` LÉGITIME persisté en chaîne était CONCATÉNÉ
  // (`'340' + 26` vaut `'34026'`), propulsant le joueur au dernier tier. Coercition
  // d'abord : la valeur est conservée, puis additionnée.
  {
    const pcLegitime = economie.TIERS[2].seuil + 40;   // un PC quelconque, mais DÉRIVÉ
    store.resetBobaQuest();
    store.adopterEtatServeur(classementSauve(String(pcLegitime)), 911);
    assert.equal(etatCourant().classement.pc, pcLegitime,
      `classement.pc "${pcLegitime}" : une chaîne LÉGITIME garde sa valeur (Number("${pcLegitime}"))`);
    store.victoireArene(1);
    assert.equal(etatCourant().classement.pc, pcLegitime + economie.PC_VICTOIRE,
      'classement.pc : la victoire ADDITIONNE, elle ne CONCATÈNE pas');
    assert.equal(etatCourant().classement.meilleurTierSaison,
      economie.tierPourPc(pcLegitime + economie.PC_VICTOIRE).id,
      'classement : le tier atteint est celui du PC réel, pas celui d une chaîne recollée');
  }
  // Le tier persisté reste un INDEX de la table `TIERS` : au-delà, `TIERS[id]` rend
  // `undefined` et l'écran de ligue affiche du vide.
  store.resetBobaQuest();
  store.adopterEtatServeur({
    perles: 0,
    classement: { pc: 100, saison: saisonCourante, meilleurTierSaison: 9999, recompenseEnAttente: null, titres: [] },
  }, 912);
  assert.equal(etatCourant().classement.meilleurTierSaison, economie.TIERS.length - 1,
    'classement.meilleurTierSaison : borné au dernier tier réel, jamais hors table');
  assert.ok(economie.TIERS[etatCourant().classement.meilleurTierSaison],
    'classement.meilleurTierSaison : désigne toujours un tier existant');

  // — B3. TOUS les sous-objets sont assainis, plus un seul spread brut ————————————
  // Le symptôme se propage par l'arithmétique : il suffit qu'UN champ persisté ne soit
  // pas un nombre pour que la comparaison qui le borde devienne un décor.
  store.resetBobaQuest();
  store.adopterEtatServeur({
    perles: 'nawak', eclats: 'nawak',
    powerups: { bombe: 'nawak', arc: -3 },
    serie: { jours: 'nawak', dernierJour: 42 },
    queteTampon: { etape: 'nawak', progres: 'nawak', reclamee: 'oui' },
    classement: { pc: 'nawak', saison: saisonCourante, meilleurTierSaison: 'nawak' },
    bossHebdo: { semaine: 42, battu: 'oui' },
    defis: { jour: 42, resolus: 'nope', historique: 'nope' },
    tournoi: { semaine: 42, etape: 'nawak', elimine: 'oui', trophees: 'nawak' },
    pity: { epique: 'nawak', legendaire: 'nawak' },
    pass: { semaine: economie.cleSemaine(), xp: 'nawak', reclames: 'nope' },
    prixMois: { mois: economie.cleMois(), achats: { 'boisson-l': 'nawak' } },
    statsJour: { jour: economie.cleJour(), duelsMises: 'nawak', tourneesLancees: 'nawak' },
    aventure: { niveauMax: 'nawak' },
    arene: { rang: 'nawak' },
  }, 920);
  const CHAMPS_NUMERIQUES = [
    'perles', 'eclats', 'powerups.bombe', 'powerups.arc', 'serie.jours',
    'queteTampon.etape', 'queteTampon.progres', 'classement.pc', 'classement.meilleurTierSaison',
    'tournoi.etape', 'tournoi.trophees', 'pity.epique', 'pity.legendaire', 'pass.xp',
    'statsJour.duelsMises', 'statsJour.tourneesLancees', 'aventure.niveauMax', 'arene.rang',
  ];
  const lire = (obj, chemin) => chemin.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  for (const chemin of CHAMPS_NUMERIQUES) {
    const v = lire(etatCourant(), chemin);
    assert.equal(typeof v, 'number', `${chemin} : une sauvegarde sale laissait passer un ${typeof v}`);
    assert.ok(Number.isFinite(v), `${chemin} : doit être un nombre FINI après migration`);
  }
  // Les listes restent des listes : les écrans les PARCOURENT sans repli (`.map` lève).
  for (const chemin of ['defis.resolus', 'defis.historique', 'pass.reclames', 'classement.titres', 'arene.equipe']) {
    assert.ok(Array.isArray(lire(etatCourant(), chemin)), `${chemin} : doit rester un tableau, sinon l écran lève au rendu`);
  }
  // Les drapeaux restent des booléens (un `'oui'` truthy n'est pas un drapeau posé).
  for (const chemin of ['bossHebdo.battu', 'tournoi.elimine', 'queteTampon.reclamee']) {
    assert.equal(typeof lire(etatCourant(), chemin), 'boolean', `${chemin} : doit rester un booléen`);
  }
  // …et le jeu tourne : la même séquence qu'en production, sans produire un seul NaN.
  store.tickSerie();
  store.victoireArene(1);
  store.defaiteArene();
  for (const chemin of CHAMPS_NUMERIQUES) {
    assert.ok(Number.isFinite(lire(etatCourant(), chemin)),
      `${chemin} : reste FINI après une séquence de jeu réelle (série, victoire, défaite)`);
  }

  // — B4. Le plafond MENSUEL des PRIX RÉELS ne s'ouvre plus sur un compteur sale ————
  // `acheterBoutique` fait `const pris = achats[id] || 0; if (pris >= palier.parMois) return null;`
  // puis `achats[id] = pris + 1`. Avec `'nawak'` : `'nawak' >= 1` est faux → achat
  // autorisé, puis `'nawak' + 1` vaut `'nawak1'` → toujours faux. Des BOISSONS RÉELLES
  // en illimité, mois après mois — la faille la plus chère du lot, en euros.
  const articleBoutique = economie.BOUTIQUE.find((p) => p.parMois > 0);
  const acheterAutantQuePossible = (compteurPersiste) => {
    store.resetBobaQuest();
    store.adopterEtatServeur({
      perles: articleBoutique.cout * 50,
      prixMois: { mois: economie.cleMois(), achats: { [articleBoutique.id]: compteurPersiste } },
    }, 930);
    let obtenus = 0;
    for (let i = 0; i < 50; i++) if (store.acheterBoutique(articleBoutique.id)) obtenus++;
    return obtenus;
  };
  assert.equal(acheterAutantQuePossible(0), articleBoutique.parMois,
    `boutique « ${articleBoutique.id} » : un compteur SAIN autorise exactement parMois achats`);
  assert.equal(acheterAutantQuePossible('nawak'), articleBoutique.parMois,
    `boutique « ${articleBoutique.id} » : un compteur SALE ne rouvre plus le robinet des prix réels`);
  assert.equal(acheterAutantQuePossible(articleBoutique.parMois), 0,
    `boutique « ${articleBoutique.id} » : le plafond déjà atteint reste atteint`);

  // — B5. Une sauvegarde LÉGITIME traverse la migration SANS PERDRE UN SEUL CHAMP ———
  // C'est l'autre moitié de la doctrine, et la plus facile à casser en assainissant
  // trop fort : on ASSAINIT, on ne PURGE jamais. Les champs INCONNUS sont conservés —
  // une version d'app plus récente peut en avoir ajouté, et la sauvegarde doit rester
  // compatible dans les DEUX sens (le joueur passe d'un appareil à l'autre).
  const sauvegardeLegitime = {
    versionSauvegarde: 2, perles: 8400, eclats: 210,
    collection: { boba: 5 },
    powerups: { bombe: 2, arc: 1, futurPowerup: 7 },
    serie: { jours: 12, dernierJour: '2026-07-26', badgeInedit: 'gardé' },
    queteTampon: { etape: 3, progres: 2, reclamee: false, noteInedite: 'gardée' },
    classement: {
      pc: 640, saison: '2026-07', meilleurTierSaison: 3,
      recompenseEnAttente: { saison: '2026-06', tierId: 2 }, titres: ['Maître du Boba'], mmrInedit: 1234,
    },
    bossHebdo: { semaine: '2026-S30', battu: true, degatsInedits: 999 },
    defis: {
      jour: '2026-07-27', resolus: ['d1', 'd2'],
      historique: [{ ami: 'lea', gagne: true }, { ami: 'tom', gagne: false }], serieInedite: 4,
    },
    tournoi: { semaine: '2026-S30', etape: 2, elimine: false, trophees: 3, graineInedite: 'abc' },
    pity: { epique: 7, legendaire: 22, objetInedit: 3 },
    pass: { semaine: '2026-S30', xp: 1240, reclames: [0, 1, 2], premiumInedit: true },
    prixMois: { mois: '2026-07', achats: { 'boisson-l': 1, 'reduction-10': 2 } },
    statsJour: { jour: '2026-07-27', parties: 6, duelsMises: 2, tourneesLancees: 1, champInedit: 42 },
  };
  store.resetBobaQuest();
  assert.equal(store.adopterEtatServeur(sauvegardeLegitime, 940), true, 'la sauvegarde légitime est adoptée');
  const migre = etatCourant();
  // Tous les champs CONNUS, à l'identique.
  for (const [chemin, attendu] of [
    ['powerups.bombe', 2], ['powerups.arc', 1],
    ['serie.jours', 12], ['serie.dernierJour', '2026-07-26'],
    ['queteTampon.etape', 3], ['queteTampon.progres', 2], ['queteTampon.reclamee', false],
    ['classement.pc', 640], ['classement.saison', '2026-07'], ['classement.meilleurTierSaison', 3],
    ['bossHebdo.semaine', '2026-S30'], ['bossHebdo.battu', true],
    ['defis.jour', '2026-07-27'],
    ['tournoi.semaine', '2026-S30'], ['tournoi.etape', 2], ['tournoi.elimine', false], ['tournoi.trophees', 3],
    ['pity.epique', 7], ['pity.legendaire', 22],
    ['pass.semaine', '2026-S30'], ['pass.xp', 1240],
    ['prixMois.mois', '2026-07'],
    ['statsJour.jour', '2026-07-27'], ['statsJour.parties', 6], ['statsJour.duelsMises', 2],
  ]) {
    assert.equal(lire(migre, chemin), attendu, `migration : ${chemin} doit traverser INTACT`);
  }
  assert.deepEqual(migre.classement.recompenseEnAttente, { saison: '2026-06', tierId: 2 },
    'migration : une récompense de saison en attente n est jamais perdue (elle vaut un vrai lot)');
  assert.deepEqual(migre.classement.titres, ['Maître du Boba'], 'migration : les titres cosmétiques survivent');
  assert.deepEqual(migre.defis.resolus, ['d1', 'd2'], 'migration : les défis résolus du jour survivent');
  assert.deepEqual(migre.defis.historique, [{ ami: 'lea', gagne: true }, { ami: 'tom', gagne: false }],
    'migration : l historique de défis survit ligne à ligne');
  assert.deepEqual(migre.pass.reclames, [0, 1, 2],
    'migration : les paliers DÉJÀ réclamés survivent (sinon ils seraient re-crédités au rollover)');
  assert.deepEqual(migre.prixMois.achats, { 'boisson-l': 1, 'reduction-10': 2 },
    'migration : le compteur anti-farm des prix réels survit (le perdre = rouvrir le quota)');
  // …et TOUS les champs INCONNUS, y compris au fond des sous-objets.
  for (const [chemin, attendu] of [
    ['powerups.futurPowerup', 7], ['serie.badgeInedit', 'gardé'], ['queteTampon.noteInedite', 'gardée'],
    ['classement.mmrInedit', 1234], ['bossHebdo.degatsInedits', 999], ['defis.serieInedite', 4],
    ['tournoi.graineInedite', 'abc'], ['pity.objetInedit', 3], ['pass.premiumInedit', true],
    ['statsJour.champInedit', 42],
  ]) {
    assert.equal(lire(migre, chemin), attendu,
      `migration : le champ INCONNU ${chemin} doit être CONSERVÉ (compatibilité avant/arrière)`);
  }
  assert.equal(migre.versionSauvegarde, 2, 'VERSION_SAUVEGARDE reste à 2 : ces migrateurs n ont PAS changé le schéma');
  // Aucun sous-objet connu ne disparaît, même absent de la sauvegarde : `undefined` est
  // toléré et retombe sur le DEFAUT, jamais sur `undefined`.
  store.resetBobaQuest();
  assert.equal(store.adopterEtatServeur({ perles: 42 }, 941), true, 'une sauvegarde minimale est adoptée');
  for (const cle of ['powerups', 'serie', 'queteTampon', 'classement', 'bossHebdo', 'defis',
    'tournoi', 'pity', 'pass', 'prixMois', 'statsJour', 'aventure', 'arene']) {
    const valeur = etatCourant()[cle];
    assert.ok(valeur && typeof valeur === 'object' && !Array.isArray(valeur),
      `migration : « ${cle} » absent de la sauvegarde doit retomber sur le DEFAUT, pas sur undefined`);
  }
  assert.equal(etatCourant().perles, 42, 'migration : et la sauvegarde minimale garde ce qu elle porte');
  store.resetBobaQuest();


// ==================== 🏗️ BOBA TOWER — moteur v2 « La tour vivante » (29/07/2026) ====================
// Bloc RÉÉCRIT pour la refonte (verdict commanditaire sur la v1 : « assez
// ennuyeux et répétitif ») — changement de design produit assumé : la LARGEUR
// est la barre de vie, le RATTRAPAGE est le 2e battement, les ÉTAGES sont sans
// fin. Les tests v1 (recette fermée de 16, instabilité comptable, victoire)
// n'ont plus d'objet. Bloc AUTONOME en fin de harnais : il compile son moteur
// dans SON PROPRE dossier (comme le PACK 5 — STORE compile le sien) et ne
// touche à rien de Boba Quest — le « Boba Quest : tests moteurs + store OK »
// qui SUIT reste le verdict final du harnais (contrat de sortie de release).
const sortieTower = fs.mkdtempSync(path.join(os.tmpdir(), 'boba-tower-tests-'));
try {
  execFileSync(path.join(racine, 'node_modules', '.bin', 'tsc'), [
    '--outDir', sortieTower,
    '--rootDir', path.join(racine, 'src/components/boba-tower'),
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--target', 'es2020',
    '--esModuleInterop',
    '--skipLibCheck',
    '--strict',
    path.join(racine, 'src/components/boba-tower/moteur-tower.ts'),
  ], { cwd: racine, stdio: 'pipe' });
  const tower = require(path.join(sortieTower, 'moteur-tower.js'));

  // --- 🔒 Test de SOURCE : l'isolement vis-à-vis de Boba Quest est un CONTRAT.
  // Le moteur Tower ne doit rien importer de components/jeu ni de store/jeu (et,
  // plus fort : rien importer DU TOUT — il est pur), ne jamais tirer Math.random,
  // Date.now ni console. L'écran, lui, ne doit pas toucher au store Boba Quest.
  // On analyse le CODE (commentaires retirés, spécificateurs d'import extraits) :
  // les commentaires ont justement le droit d'expliquer ces interdits. Si un
  // import légitime devient nécessaire un jour, ce test se relâche EXPRÈS.
  const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const importsDe = (src) => [
    ...[...sansCommentaires(src).matchAll(/(?:^|\n)\s*import[\s\S]*?from\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
    ...[...sansCommentaires(src).matchAll(/(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
  ];
  const srcMoteur = fs.readFileSync(path.join(racine, 'src/components/boba-tower/moteur-tower.ts'), 'utf8');
  assert.ok(!importsDe(srcMoteur).some((m) => /components\/jeu|store\/jeu/.test(m)),
    'moteur-tower: import de Boba Quest interdit');
  assert.equal(importsDe(srcMoteur).length, 0, 'moteur-tower: doit rester sans AUCUN import (pur)');
  assert.ok(!/Math\.random|Date\.now|console\./.test(sansCommentaires(srcMoteur)),
    'moteur-tower: aléa non seedé / horloge / console interdits dans le code');
  const srcEcran = fs.readFileSync(path.join(racine, 'src/app/boba-tower.tsx'), 'utf8');
  assert.ok(!importsDe(srcEcran).some((m) => /store\/jeu/.test(m)),
    'boba-tower.tsx: le store Boba Quest est interdit à l\'écran Tower');
  assert.ok(importsDe(srcEcran).some((m) => /components\/boba-tower\/moteur-tower/.test(m)),
    'boba-tower.tsx: l\'écran doit jouer via le moteur pur');
  assert.ok(/useTowerVisible/.test(srcEcran) && /<Redirect/.test(srcEcran), 'boba-tower.tsx: gate du flag distant absente');
  assert.ok(!/console\./.test(sansCommentaires(srcEcran)), 'boba-tower.tsx: console interdit');
  // …et la refonte est branchée À L'ÉCRAN : le 2e battement existe, la jauge v1 est morte.
  assert.ok(/rattraper\s*\(/.test(sansCommentaires(srcEcran)), 'boba-tower.tsx: le rattrapage (2e tap) doit être branché');
  assert.ok(/RATTRAPÉ/.test(srcEcran), 'boba-tower.tsx: le verdict « RATTRAPÉ ! » est un TEXTE (jamais la couleur seule)');
  assert.ok(!/instabilite|INSTABILITE/i.test(sansCommentaires(srcEcran)),
    'boba-tower.tsx: plus AUCUNE trace de l\'instabilité v1 (la largeur est la barre de vie)');

  // — outillage : tout est déterministe (moteur seedé ⇒ recherches seedées) —
  const clamp = (x) => Math.max(-59, Math.min(59, x));
  // taper avec un écart VOULU au point de visée (variante nulle : cible = dérive)
  const taper = (etat, offsetVoulu, apres = 250) =>
    tower.lacher(etat, tower.tPourPosition(etat, clamp(etat.derive + offsetVoulu), apres));
  // révèle les n premiers ingrédients d'un seed (la file est générée au fil de
  // l'eau : on la déroule en posant parfait — un 0 d'écart est TOUJOURS parfait)
  const apercuFile = (seed, n) => {
    const e = tower.creerPartie(seed);
    const ids = [];
    for (let i = 0; i < n && !e.finie; i++) { ids.push(e.file[e.indice]); taper(e, 0); }
    return ids;
  };
  const chercherSeed = (pred, borne = 6000) => {
    for (let s = 1; s <= borne; s++) if (pred(s)) return s;
    throw new Error('aucun seed ne satisfait le prédicat (file anormale ?)');
  };
  const estClassique = (id) => !tower.INGREDIENTS[id].special;
  const sansNaN = (obj, contexte) => JSON.stringify(obj, (k, v) => {
    assert.ok(!(typeof v === 'number' && !Number.isFinite(v)), `${contexte}: NaN/∞ propagé sur « ${k} »`);
    return v;
  });
  const L0 = tower.LARGEUR_INITIALE;
  const fEtageAttendu = (e) => Math.max(tower.FACTEUR_ETAGE_PLANCHER, Math.pow(tower.FACTEUR_ETAGE, e - 1));
  const seedClassique = chercherSeed((s) => {
    const ids = apercuFile(s, 8);
    return ids.length === 8 && ids.every(estClassique);
  });

  // --- 🔺 L'onde triangle : bornée, périodique, symétrique — dérivée des constantes.
  {
    const etat = tower.creerPartie(seedClassique);
    const P = tower.periodeIngredient(etat);
    assert.equal(P, tower.PERIODE_INITIALE, 'classique posé en premier : période initiale (réglage nerveux : 1900)');
    const A = tower.AMPLITUDE_OSCILLATION;
    assert.equal(tower.positionIngredient(etat, 0), -A, 'départ au bord gauche');
    assert.ok(Math.abs(tower.positionIngredient(etat, P / 4)) < 1e-9, 'quart de période : pile au centre');
    assert.equal(tower.positionIngredient(etat, P / 2), A, 'demi-période : bord droit');
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * 3 * P;
      const x = tower.positionIngredient(etat, t);
      assert.ok(Math.abs(x) <= A + 1e-9, 'triangle borné à l\'amplitude');
      assert.ok(Math.abs(x - tower.positionIngredient(etat, t + P)) < 1e-9, 'triangle périodique');
    }
    for (const t of [0.31 * P, 0.11 * P, 0.47 * P]) {
      assert.ok(Math.abs(tower.positionIngredient(etat, t) - tower.positionIngredient(etat, P - t)) < 1e-9,
        'triangle symétrique : x(P − t) = x(t)');
    }
  }

  // --- ⏩ Accélération NERVEUSE, dérivée des constantes : −8 % tous les 3 posés,
  //     plancher 1050 — et le palier où le plancher mord se CALCULE, jamais figé.
  {
    const etat = tower.creerPartie(seedClassique);
    for (let i = 0; i < tower.POSES_PAR_PALIER; i++) taper(etat, 0);
    if (estClassique(etat.file[etat.indice])) {
      assert.ok(Math.abs(tower.periodeIngredient(etat)
        - Math.max(tower.PERIODE_PLANCHER, tower.PERIODE_INITIALE * tower.ACCELERATION_PERIODE)) < 1e-9,
        'palier 1 : période × 0,92 après 3 poses');
    }
    const palierPlancher = Math.ceil(
      Math.log(tower.PERIODE_PLANCHER / tower.PERIODE_INITIALE) / Math.log(tower.ACCELERATION_PERIODE));
    const e2 = tower.creerPartie(seedClassique);
    e2.indice = palierPlancher * tower.POSES_PAR_PALIER + 1; // hors file : facteur ingrédient neutre
    assert.equal(tower.periodeIngredient(e2), tower.PERIODE_PLANCHER,
      `le plancher borne la progression (dès le palier ${palierPlancher})`);
    e2.indice = (palierPlancher - 1) * tower.POSES_PAR_PALIER;
    assert.ok(tower.periodeIngredient(e2) > tower.PERIODE_PLANCHER, 'un palier plus tôt : pas encore au plancher');
  }

  // --- 🎯 Fenêtres VIVANTES : scalées par la largeur ET l'étage — tout est dérivé.
  {
    // à la création : L = L0, étage 1 ⇒ facteur exactement 1
    const neuf = tower.creerPartie(seedClassique);
    assert.equal(tower.facteurFenetresCourant(neuf), 1, 'partie neuve : facteur 1 (L0, étage 1)');
    assert.deepEqual(tower.fenetresCourantes(neuf),
      { parfait: tower.FENETRE_PARFAIT, bien: tower.FENETRE_BIEN, bancal: tower.FENETRE_BANCAL },
      'fenêtres neuves = constantes de base');
    // facteur d'étage : 0,96^(étage−1), plancher 0,72 — et le plancher mord à
    // l'étage ⌈ln(0,72)/ln(0,96)⌉ + 1, CALCULÉ (pas d'étage 10 en dur)
    assert.equal(tower.facteurEtage(1), 1);
    assert.ok(Math.abs(tower.facteurEtage(2) - tower.FACTEUR_ETAGE) < 1e-12);
    const etagePlancher = Math.ceil(
      Math.log(tower.FACTEUR_ETAGE_PLANCHER) / Math.log(tower.FACTEUR_ETAGE)) + 1;
    assert.ok(tower.facteurEtage(etagePlancher - 1) > tower.FACTEUR_ETAGE_PLANCHER,
      'juste sous le plancher : la progression mord encore');
    assert.equal(tower.facteurEtage(etagePlancher), tower.FACTEUR_ETAGE_PLANCHER,
      'puis le plancher borne (le jeu reste jouable, jamais injouable pur)');
    assert.equal(tower.facteurEtage(999), tower.FACTEUR_ETAGE_PLANCHER);
    // largeur entamée + altitude : facteur = (L/L0) × fEtage, aux 3 fenêtres
    const use = tower.creerPartie(seedClassique);
    use.largeur = 38; use.etage = 4;
    const fAttendu = (38 / L0) * fEtageAttendu(4);
    assert.ok(Math.abs(tower.facteurFenetresCourant(use) - fAttendu) < 1e-12, 'facteur (L/L0) × 0,96^(étage−1)');
    const fen = tower.fenetresCourantes(use);
    assert.ok(Math.abs(fen.parfait - tower.FENETRE_PARFAIT * fAttendu) < 1e-12);
    assert.ok(Math.abs(fen.bien - tower.FENETRE_BIEN * fAttendu) < 1e-12);
    assert.ok(Math.abs(fen.bancal - tower.FENETRE_BANCAL * fAttendu) < 1e-12);
    // …et via lacher() (intégration triangle → verdict), de part et d'autre de
    // la fenêtre « bien » EFFECTIVE (marge 0,3 u contre le flottant)
    const dedans = tower.creerPartie(seedClassique); dedans.largeur = 38; dedans.etage = 4;
    assert.equal(taper(dedans, tower.FENETRE_BIEN * fAttendu - 0.3).verdict, 'bien', 'juste dans la fenêtre scalée');
    const dehors = tower.creerPartie(seedClassique); dehors.largeur = 38; dehors.etage = 4;
    assert.equal(taper(dehors, tower.FENETRE_BIEN * fAttendu + 0.3).verdict, 'bancal', 'juste au-delà : la tour vivante a resserré');
  }
  // …bornes EXACTES de verdictDeOffset (incluses), et repli NaN
  assert.equal(tower.verdictDeOffset(0), 'parfait');
  assert.equal(tower.verdictDeOffset(tower.FENETRE_PARFAIT), 'parfait', 'borne parfaite INCLUSE');
  assert.equal(tower.verdictDeOffset(tower.FENETRE_PARFAIT + 1e-9), 'bien');
  assert.equal(tower.verdictDeOffset(tower.FENETRE_BIEN), 'bien', 'borne bien INCLUSE');
  assert.equal(tower.verdictDeOffset(tower.FENETRE_BANCAL), 'bancal', 'borne bancale INCLUSE');
  assert.equal(tower.verdictDeOffset(tower.FENETRE_BANCAL + 1e-9), 'rate');
  assert.equal(tower.verdictDeOffset(-tower.FENETRE_PARFAIT), 'parfait', 'offset signé : valeur absolue');
  assert.equal(tower.verdictDeOffset(tower.FENETRE_PARFAIT * 0.7, 0.7), 'parfait', 'facteur réduit : bornes multipliées');
  assert.equal(tower.verdictDeOffset(tower.FENETRE_PARFAIT * 0.7 + 1e-9, 0.7), 'bien');
  assert.equal(tower.verdictDeOffset(NaN), 'rate', 'offset NaN : jamais un faux parfait');

  // --- 📏 LA LARGEUR EST LA BARRE DE VIE : rétrécit, se répare, plafonne.
  {
    const etat = tower.creerPartie(seedClassique);
    assert.equal(etat.largeur, L0, 'départ à L0');
    let evt = taper(etat, 20);                       // bancal (16 < 20 ≤ 26 à facteur 1)
    assert.equal(evt.verdict, 'bancal');
    assert.equal(etat.largeur, L0 - tower.PERTE_BANCAL, 'BANCAL : L − 6');
    tower.rattraper(etat, 0);                        // fenêtre consommée (manquée)
    evt = taper(etat, 0);                            // parfait : la tour RESPIRE
    assert.equal(evt.verdict, 'parfait');
    assert.equal(etat.largeur, L0 - tower.PERTE_BANCAL + tower.GAIN_PARFAIT, 'PARFAIT : L + 4');
    taper(etat, 0);
    assert.equal(etat.largeur, L0, 'la réparation PLAFONNE à L0 (54 + 4 → 56, pas 58)');
    taper(etat, 0);
    assert.equal(etat.largeur, L0, 'et y reste : le plafond ne se perce jamais');
    const avantBien = etat.largeur;
    evt = taper(etat, (tower.FENETRE_PARFAIT + tower.FENETRE_BIEN) / 2); // 11 u : bien
    assert.equal(evt.verdict, 'bien');
    assert.equal(etat.largeur, avantBien, 'BIEN : largeur PRÉSERVÉE (ni gain ni perte)');
  }

  // --- 🦷 MORSURE 1 — la spirale de largeur : le MÊME écart, toléré à pleine
  //     largeur, devient une faute quand la tour s'est étranglée. C'est la
  //     conséquence physique de l'erreur qui manquait à la v1.
  {
    const L44 = L0 - 2 * tower.PERTE_BANCAL;         // largeur après 2 bancals
    // écart choisi ENTRE la fenêtre bien rétrécie (L 44) et la fenêtre bien
    // pleine — dérivé des constantes : BIEN avant, BANCAL après, par construction
    const offTest = (tower.FENETRE_BIEN * (L44 / L0) + tower.FENETRE_BIEN) / 2;
    assert.ok(offTest > tower.FENETRE_PARFAIT, 'préambule : l\'écart-test est bien au-delà du parfait');
    const temoin = tower.creerPartie(seedClassique);
    assert.equal(taper(temoin, offTest).verdict, 'bien', 'à pleine largeur : cet écart = BIEN');
    const etat = tower.creerPartie(seedClassique);
    taper(etat, 20); tower.rattraper(etat, 0);       // bancal non rattrapé → L 50
    taper(etat, -20); tower.rattraper(etat, 0);      // bancal de l'autre côté → L 44 (dérive contenue)
    assert.equal(etat.largeur, L44);
    assert.ok(tower.FENETRE_BIEN * (L44 / L0) < offTest,
      'préambule dérivé : à L 44, la fenêtre bien est passée sous l\'écart-test');
    assert.equal(taper(etat, offTest).verdict, 'bancal',
      'MORSURE : le même écart est devenu BANCAL — chaque erreur rend la suivante plus probable');
  }

  // --- 🦷 MORSURE 2 — l'altitude mord : le même écart, PARFAIT à l'étage 1,
  //     n'est plus que BIEN en haut de la tour (0,96^(étage−1)). C'est la
  //     garantie qu'une partie parfaite finit quand même par se tendre.
  {
    const etageHaut = 8;
    const offVise = (tower.FENETRE_PARFAIT * (fEtageAttendu(etageHaut) + 1)) / 2; // entre 6×f8 et 6
    const bas = tower.creerPartie(seedClassique);
    assert.equal(taper(bas, offVise).verdict, 'parfait', 'étage 1 : cet écart est PARFAIT');
    const haut = tower.creerPartie(seedClassique);
    haut.etage = etageHaut;
    assert.equal(taper(haut, offVise).verdict, 'bien',
      'MORSURE : à l\'étage 8, le même écart n\'est plus que BIEN — l\'altitude se paie');
  }

  // --- 🦷 MORSURE 3 — le plancher de mort : 3 ratés non rattrapés depuis L0 et
  //     la tour bascule (56 → 44 → 32 → 20 < 22). Fin de partie PHYSIQUE, pas
  //     comptable — et pas de rattrapage in extremis sur le coup fatal.
  {
    const etat = tower.creerPartie(seedClassique);
    let evt = taper(etat, 40);                       // raté (au-delà de 26)
    assert.equal(evt.verdict, 'rate');
    assert.equal(etat.indice, 0, 'un raté ne consomme pas l\'ingrédient (il tombe à côté)');
    assert.equal(etat.poses.length, 0, 'un raté n\'est pas posé');
    assert.equal(etat.largeur, L0 - tower.PERTE_RATE, 'RATÉ : L − 12');
    assert.deepEqual(evt.rattrapage, { dureeMs: tower.RATTRAPAGE_DUREE_MS, perdu: tower.PERTE_RATE },
      'un raté non mortel OUVRE la fenêtre de rattrapage');
    tower.rattraper(etat, 0);                        // manqué
    evt = taper(etat, -40); tower.rattraper(etat, 0);
    assert.equal(etat.largeur, L0 - 2 * tower.PERTE_RATE);
    assert.equal(etat.finie, false, 'à L 32, la tour tient encore');
    evt = taper(etat, 40);                           // 32 − 12 = 20 < 22
    assert.equal(evt.fini, true, 'MORSURE : le plancher de largeur tue');
    assert.equal(evt.basculee, true);
    assert.equal(evt.raisonBascule, 'largeur');
    assert.equal(evt.rattrapage, null, 'pas de rattrapage in extremis : le vacillement stabilise, il ne ressuscite pas');
    assert.equal(evt.suivant, null);
    // partie finie : lacher/rattraper deviennent neutres, AUCUNE mutation
    const gel = JSON.stringify(etat);
    assert.equal(tower.lacher(etat, 500).fini, true, 'lacher() sur partie finie : événement neutre');
    assert.equal(tower.rattraper(etat, 450).reussi, false, 'rattraper() sur partie finie : refus');
    assert.equal(JSON.stringify(etat), gel, '…et zéro mutation post-mortem');
  }

  // --- 🦷 MORSURE 4 — la dérive (2e axe de mort, conservé) : marteler le même
  //     côté fait glisser le sommet au-delà de ±20 — AVANT que la largeur tue.
  {
    const etat = tower.creerPartie(seedClassique);
    let evt = null;
    let n = 0;
    while (!etat.finie && n++ < 8) {
      // toujours BANCAL du même côté : juste sous la fenêtre bancale EFFECTIVE
      // (elle rétrécit avec L — un écart figé deviendrait un raté, qui ne pose
      // rien et ne déplace donc pas le sommet)
      const off = tower.FENETRE_BANCAL * (etat.largeur / L0) * fEtageAttendu(etat.etage) - 1;
      evt = taper(etat, off);
      tower.rattraper(etat, 0);
    }
    assert.equal(evt.basculee, true, 'dérive au-delà du seuil → bascule');
    assert.equal(evt.raisonBascule, 'derive', 'la bascule vient bien de la DÉRIVE (pas de la largeur)');
    assert.ok(Math.abs(evt.derive) > tower.DERIVE_MAX);
    assert.ok(etat.largeur >= tower.LARGEUR_MORT, 'la largeur seule n\'expliquait pas la fin');
    assert.equal(evt.rattrapage, null, 'mort par dérive : pas de fenêtre non plus');
  }

  // --- 🤲 LE RATTRAPAGE : réussi au centre, manqué aux bords, moitié récupérée,
  //     un seul par pose, ZÉRO point — il sauve, il ne paie pas.
  {
    const etat = tower.creerPartie(seedClassique);
    const evt = taper(etat, 20);                     // bancal → L 50, fenêtre ouverte
    assert.deepEqual(evt.rattrapage, { dureeMs: tower.RATTRAPAGE_DUREE_MS, perdu: tower.PERTE_BANCAL });
    const scoreAvant = etat.score;
    const comboAvant = etat.combo;                   // 0 : le bancal l'a cassé
    const r = tower.rattraper(etat, tower.RATTRAPAGE_DUREE_MS / 2); // PILE au point d'équilibre
    assert.equal(r.reussi, true, 'tap au point d\'équilibre : RATTRAPÉ');
    assert.equal(r.largeurRecuperee, tower.PERTE_BANCAL / 2, 'récupère LA MOITIÉ de la largeur perdue (+3)');
    assert.equal(etat.largeur, L0 - tower.PERTE_BANCAL / 2);
    assert.equal(etat.score, scoreAvant, 'PAS de points : le rattrapage sauve, il ne paie pas');
    assert.equal(etat.combo, comboAvant, 'PAS de combo restauré : la faute reste une faute pour le score');
    assert.equal(etat.rattrapages, 1, 'compté pour les stats/objectifs');
    assert.equal(etat.fautesEtage, 0, 'le verdict comptabilisé pour le sans-faute d\'étage devient BIEN');
    const r2 = tower.rattraper(etat, tower.RATTRAPAGE_DUREE_MS / 2);
    assert.equal(r2.reussi, false, 'UN SEUL rattrapage par pose : la tentative est consommée');
    assert.equal(etat.largeur, L0 - tower.PERTE_BANCAL / 2, '…et rien ne bouge au 2e appel');
  }
  {
    // bornes de la sous-fenêtre : ±150 ms autour de 450, INCLUSES ; NaN jamais
    const essai = (t) => {
      const e = tower.creerPartie(seedClassique);
      taper(e, 20);
      return tower.rattraper(e, t).reussi;
    };
    const centre = tower.RATTRAPAGE_DUREE_MS / 2;
    const demiF = tower.RATTRAPAGE_FENETRE_MS;
    assert.equal(essai(centre), true);
    assert.equal(essai(centre - demiF), true, 'borne basse INCLUSE');
    assert.equal(essai(centre + demiF), true, 'borne haute INCLUSE');
    assert.equal(essai(centre - demiF - 1), false, 'trop tôt : manqué');
    assert.equal(essai(centre + demiF + 1), false, 'trop tard : manqué');
    assert.equal(essai(0), false, 'le bord du vacillement : manqué');
    assert.equal(essai(tower.RATTRAPAGE_DUREE_MS), false, 'la fin du vacillement : manqué');
    assert.equal(essai(NaN), false, 'un NaN ne réussit JAMAIS un rattrapage (repli hors fenêtre)');
  }
  {
    // après un RATÉ : moitié de 12 = +6 ; et le tap manqué n'aggrave RIEN
    const e = tower.creerPartie(seedClassique);
    taper(e, 40);                                    // raté → L 44
    const r = tower.rattraper(e, tower.RATTRAPAGE_DUREE_MS / 2);
    assert.equal(r.largeurRecuperee, tower.PERTE_RATE / 2, 'raté rattrapé : +6');
    assert.equal(e.largeur, L0 - tower.PERTE_RATE / 2);
    const e2 = tower.creerPartie(seedClassique);
    taper(e2, 40);
    const largeurAvant = e2.largeur;
    const fautesAvant = e2.fautesEtage;
    assert.equal(tower.rattraper(e2, 100).reussi, false);
    assert.equal(e2.largeur, largeurAvant, 'manqué : rien de PIRE (jamais de double peine)');
    assert.equal(e2.fautesEtage, fautesAvant, '…et la faute reste simple faute');
  }
  {
    // le marqueur : triangle PUR sur 900 ms — écart 1 → 0 (équilibre) → 1, et le
    // bord de la réussite (±150 ms) tombe à écart 150/450 : la règle et le
    // visuel de l'écran (interpolation linéaire) coïncident exactement.
    const D = tower.RATTRAPAGE_DUREE_MS;
    assert.equal(tower.marqueurRattrapage(0), 1);
    assert.equal(tower.marqueurRattrapage(D / 2), 0, 'équilibre à mi-fenêtre');
    assert.equal(tower.marqueurRattrapage(D), 1);
    assert.ok(Math.abs(tower.marqueurRattrapage(D / 4) - 0.5) < 1e-12, 'pente constante (triangle, pas sinus)');
    const bord = tower.RATTRAPAGE_FENETRE_MS / (D / 2);
    assert.ok(Math.abs(tower.marqueurRattrapage(D / 2 - tower.RATTRAPAGE_FENETRE_MS) - bord) < 1e-12,
      'au bord de la sous-fenêtre, écart = 150/450 : le vert de la jauge dit vrai');
    assert.ok(Number.isFinite(tower.marqueurRattrapage(NaN)), 'marqueur à t NaN : fini');
  }
  {
    // fenêtre laissée ouverte (écran en retard) : le lacher suivant la résout
    // MANQUÉE d'abord — jamais deux fenêtres, jamais de récupération fantôme.
    const e = tower.creerPartie(seedClassique);
    taper(e, 20);                                    // bancal → L 50, fenêtre ouverte
    assert.ok(e.rattrapage, 'fenêtre ouverte');
    const evt = taper(e, 0);                         // parfait sans avoir résolu
    assert.equal(e.rattrapage, null, 'la fenêtre est refermée (manquée) par le lacher suivant');
    assert.equal(evt.verdict, 'parfait');
    assert.equal(e.largeur, L0 - tower.PERTE_BANCAL + tower.GAIN_PARFAIT, 'aucune moitié récupérée en douce');
    assert.equal(e.rattrapages, 0);
  }

  // --- 🏢 LES ÉTAGES SANS FIN : scellement à 8, bonus dérivé de la largeur
  //     préservée, ré-élargissement plafonné, sans-faute à +100.
  {
    const etat = tower.creerPartie(seedClassique);
    let evt = null;
    for (let i = 0; i < tower.POSES_PAR_ETAGE - 1; i++) {
      evt = taper(etat, 0);
      assert.equal(evt.scellement, null, `pose ${i + 1} : pas encore de couvercle`);
    }
    const scoreAvant = etat.score;
    evt = taper(etat, 0);                            // 8e pose acceptée
    assert.ok(evt.scellement, 'scellement à la 8e pose acceptée');
    assert.equal(evt.scellement.etage, 1);
    assert.equal(evt.scellement.bonus, tower.BONUS_ETAGE_BASE + tower.BONUS_ETAGE_PAR_LARGEUR * L0,
      'bonus DÉRIVÉ de la largeur préservée : 200 + 4 × 56');
    assert.equal(evt.scellement.bonusSansFaute, tower.BONUS_ETAGE_SANS_FAUTE, 'étage sans-faute : +100');
    assert.equal(evt.scellement.sansFaute, true);
    assert.equal(etat.score, scoreAvant + evt.points + evt.scellement.bonus + evt.scellement.bonusSansFaute,
      'le bonus est crédité au scellement, et rien d\'autre');
    assert.equal(etat.etage, 2, 'on continue à l\'étage 2 — la « victoire » n\'existe plus');
    assert.equal(etat.posesEtage, 0);
    assert.equal(etat.poses.length, 0, 'les couches affichables repartent à zéro (le couvercle absorbe)');
    assert.equal(etat.largeur, L0, 'ré-élargissement PLAFONNÉ : 56 + 10 → 56, pas 66');
    assert.equal(etat.etagesSansFaute, 1);
    assert.equal(etat.finie, false);
  }
  {
    // largeur ENTAMÉE au scellement : bonus plus maigre (la préservation paie),
    // ré-élargissement NON plafonné cette fois (44 + 10 = 54 < 56), pas de +100.
    const etat = tower.creerPartie(seedClassique);
    for (let i = 0; i < 4; i++) taper(etat, 0);      // 4 parfaits, L 56
    taper(etat, 20); tower.rattraper(etat, 0);       // bancal → L 50 (pose 5)
    taper(etat, -20); tower.rattraper(etat, 0);      // bancal → L 44 (pose 6)
    const fBien = (etat.largeur / L0);               // étage 1 : facteur = L/L0
    taper(etat, tower.FENETRE_BIEN * fBien - 0.5);   // bien (pose 7) : L préservée
    const evt = taper(etat, 0);                      // parfait (pose 8) : L 44+4 = 48 → scellement
    assert.ok(evt.scellement);
    assert.equal(evt.scellement.bonus,
      tower.BONUS_ETAGE_BASE + tower.BONUS_ETAGE_PAR_LARGEUR * (L0 - 2 * tower.PERTE_BANCAL + tower.GAIN_PARFAIT),
      'bonus sur la largeur telle qu\'elle est au couvercle (48) : préserver PAIE');
    assert.equal(evt.scellement.sansFaute, false, '2 bancals non rattrapés : pas de +100');
    assert.equal(evt.scellement.bonusSansFaute, 0);
    assert.equal(evt.scellement.largeurApres, L0,
      'ré-élargissement plafonné : 48 + 10 = 58 → tronqué à L0 (56)');
  }

  // (le cas ci-dessus re-plafonne : 48 + 10 → 56. Cas VRAIMENT sous le
  //  plafond : sceller à L 44 — le +10 rend 54, et ça se vérifie à l'unité.)
  {
    const etat = tower.creerPartie(seedClassique);
    for (let i = 0; i < 4; i++) taper(etat, 0);
    taper(etat, 20); tower.rattraper(etat, 0);       // L 50 (pose 5)
    taper(etat, -20); tower.rattraper(etat, 0);      // L 44 (pose 6)
    const f7 = etat.largeur / L0;
    taper(etat, tower.FENETRE_BIEN * f7 - 0.5);      // bien (pose 7)
    const f8 = etat.largeur / L0;
    const evt = taper(etat, tower.FENETRE_BIEN * f8 - 0.5); // bien (pose 8) → scellement à L 44
    assert.ok(evt.scellement);
    assert.equal(evt.scellement.bonus, tower.BONUS_ETAGE_BASE + tower.BONUS_ETAGE_PAR_LARGEUR * (L0 - 2 * tower.PERTE_BANCAL));
    assert.equal(evt.scellement.largeurApres, L0 - 2 * tower.PERTE_BANCAL + tower.RELARGISSEMENT_ETAGE,
      'l\'étage neuf redonne de l\'air : 44 + 10 = 54 (sous le plafond, pas de troncature)');
    assert.equal(etat.largeur, evt.scellement.largeurApres);
  }

  // --- 🤝 Scellement DIFFÉRÉ : la 8e pose est un BANCAL → le couvercle attend
  //     l'issue du rattrapage. Rattrapé = sans-faute PRÉSERVÉ (le verdict
  //     compte comme BIEN) ; manqué = scellé quand même, sans le +100.
  {
    const etat = tower.creerPartie(seedClassique);
    for (let i = 0; i < tower.POSES_PAR_ETAGE - 1; i++) taper(etat, 0); // 7 parfaits
    const evt = taper(etat, etat.derive > 0 ? -20 : 20);               // 8e : bancal
    assert.equal(evt.verdict, 'bancal');
    assert.equal(evt.scellement, null, '8e pose bancale : le couvercle ATTEND');
    assert.ok(evt.rattrapage, '…pendant que la tour vacille');
    assert.equal(etat.scellementDiffere, true);
    const r = tower.rattraper(etat, tower.RATTRAPAGE_DUREE_MS / 2);
    assert.equal(r.reussi, true);
    assert.ok(r.scellement, 'le scellement arrive par rattraper()');
    assert.equal(r.scellement.sansFaute, true, 'rattrapé : le sans-faute d\'étage est PRÉSERVÉ');
    assert.equal(r.scellement.bonusSansFaute, tower.BONUS_ETAGE_SANS_FAUTE);
    assert.equal(r.scellement.bonus,
      tower.BONUS_ETAGE_BASE + tower.BONUS_ETAGE_PAR_LARGEUR * (L0 - tower.PERTE_BANCAL / 2),
      'bonus APRÈS récupération : L = 56 − 6 + 3 = 53 (l\'ordre sert le joueur)');
    assert.equal(etat.etage, 2);
    assert.equal(etat.etagesSansFaute, 1);
  }
  {
    const etat = tower.creerPartie(seedClassique);
    for (let i = 0; i < tower.POSES_PAR_ETAGE - 1; i++) taper(etat, 0);
    taper(etat, etat.derive > 0 ? -20 : 20);
    const r = tower.rattraper(etat, 100);            // manqué
    assert.equal(r.reussi, false);
    assert.ok(r.scellement, 'scellé quand même : jamais de double peine');
    assert.equal(r.scellement.sansFaute, false);
    assert.equal(r.scellement.bonus, tower.BONUS_ETAGE_BASE + tower.BONUS_ETAGE_PAR_LARGEUR * (L0 - tower.PERTE_BANCAL));
    assert.equal(etat.etage, 2);
    assert.equal(etat.etagesSansFaute, 0);
  }

  // --- ♾️ FIN UNIQUEMENT PAR BASCULE : 64 poses parfaites = 8 étages scellés,
  //     et la partie CONTINUE. Les champs v1 (victoire, instabilité, recette)
  //     ont disparu de l'état comme du résultat.
  {
    const etat = tower.creerPartie(seedClassique);
    for (let i = 0; i < 8 * tower.POSES_PAR_ETAGE; i++) taper(etat, 0);
    assert.equal(etat.finie, false, '64 poses parfaites : AUCUNE victoire ne termine la partie');
    assert.equal(etat.etage, 9, '8 étages scellés, on attaque le 9e');
    assert.equal(etat.indice, 64);
    for (const champ of ['victoire', 'instabilite', 'recette', 'sansFaute']) {
      assert.ok(!(champ in etat), `champ v1 « ${champ} » disparu de l'état`);
    }
    const res = tower.resultatDe(etat);
    for (const champ of ['victoire', 'instabilite', 'sansFaute']) {
      assert.ok(!(champ in res), `champ v1 « ${champ} » disparu du résultat`);
    }
    assert.equal(res.etages, 9, 'le résultat porte la HAUTEUR (record star)');
    assert.equal(res.poses, 64);
    assert.equal(res.etagesSansFaute, 8);
    assert.equal(res.basculee, false, '…et basculee n\'est vraie qu\'à la vraie fin');
    sansNaN(res, 'resultatDe');
  }

  // --- 🧾 Le score se REJOUE depuis les événements : points de pose + bonus de
  //     scellement, RIEN d'autre — un rattrapage réussi crédite 0.
  {
    const etat = tower.creerPartie(seedClassique);
    const motif = [0, 3, 8, 0, 20, 0, 0, 10, 0, 40, 5, 0, 12, 0, 0, 18];
    let somme = 0;
    let rattrapes = 0;
    for (let i = 0; i < 30 && !etat.finie; i++) {
      const evt = taper(etat, motif[i % motif.length], 200 + (i % 3) * 137);
      somme += evt.points;
      if (evt.scellement) somme += evt.scellement.bonus + evt.scellement.bonusSansFaute;
      if (evt.rattrapage) {
        const r = tower.rattraper(etat, i % 2 === 0 ? tower.RATTRAPAGE_DUREE_MS / 2 : 100);
        if (r.reussi) rattrapes += 1;
        if (r.scellement) somme += r.scellement.bonus + r.scellement.bonusSansFaute;
      }
    }
    assert.equal(somme, etat.score, 'score = Σ points + Σ bonus d\'étage — le rattrapage n\'ajoute RIEN');
    assert.equal(etat.rattrapages, rattrapes, 'les rattrapages comptés sont exactement les réussis');
  }

  // --- 🔗 Combo : 3 parfaits → 3 ; un BIEN le conserve ; un BANCAL le casse —
  //     et le rattrapage ne le RESTAURE pas (il sauve la tour, pas le score).
  {
    const etat = tower.creerPartie(seedClassique);
    taper(etat, 0); taper(etat, 0);
    const p3 = taper(etat, 0);
    assert.equal(p3.combo, 3, '3 parfaits → combo 3');
    assert.equal(p3.multCombo, 1 + tower.COMBO_PAS * 3, 'multiplicateur du combo 3');
    const bien = taper(etat, 10);
    assert.equal(bien.verdict, 'bien');
    assert.equal(bien.combo, 3, 'un BIEN conserve le combo sans l\'incrémenter');
    assert.equal(bien.multCombo, 1 + tower.COMBO_PAS * 3, '…et garde le multiplicateur acquis');
    const bancal = taper(etat, 20);
    assert.equal(bancal.verdict, 'bancal');
    assert.equal(bancal.combo, 0, 'un BANCAL casse le combo');
    assert.equal(tower.rattraper(etat, tower.RATTRAPAGE_DUREE_MS / 2).reussi, true);
    assert.equal(etat.combo, 0, 'RATTRAPÉ ne ressuscite PAS le combo');
    assert.equal(etat.meilleurCombo, 3, 'le meilleur combo est mémorisé');
  }

  // --- ♻️ Déterminisme : même seed + mêmes instants (poses ET rattrapages) →
  //     DEUX parties identiques ; seeds différents → files différentes.
  {
    const motif = [0, 8, -12, 3, 22, -5, 0, 14, -20, 6, 1, -9];
    const jouer = (seed) => {
      const etat = tower.creerPartie(seed);
      const evts = [];
      for (let i = 0; i < 40 && !etat.finie; i++) {
        const evt = taper(etat, motif[i % motif.length], 200 + (i % 3) * 137);
        evts.push(evt);
        if (evt.rattrapage) evts.push(tower.rattraper(etat, (i % 3) * 220));
      }
      return JSON.stringify({ evts, etat });
    };
    assert.equal(jouer(1234), jouer(1234), 'deux runs du même seed doivent être identiques');
    assert.notEqual(JSON.stringify(apercuFile(11, 12)), JSON.stringify(apercuFile(12, 12)),
      'deux seeds différents : files différentes (sinon le seed ne sert à rien)');
  }

  // --- ✨ Spéciaux : popping pardonne, mousse glisse, glaçon étrangle double —
  //     densité 1 SUR 3, et JAMAIS deux spéciaux de suite (file sans fin).
  {
    const kDans = (s, id) => apercuFile(s, 7).findIndex((x) => x === id);
    const seedPour = (id) => chercherSeed((s) => {
      const ids = apercuFile(s, 7);
      const k = ids.indexOf(id);
      return k >= 0 && k <= 6 && ids.slice(0, k).every(estClassique);
    });
    {
      const seedPop = seedPour('popping');
      const etat = tower.creerPartie(seedPop);
      for (let i = 0; i < kDans(seedPop, 'popping'); i++) taper(etat, 0);
      const evt = taper(etat, 20); // 20 u : bancal pour un classique…
      assert.equal(evt.effet, 'popping');
      assert.equal(evt.verdict, 'bien', 'popping : offset effectif ×0,55 → un bancal devient un bien');
      assert.ok(Math.abs(evt.offset - 20 * 0.55) < 0.6, 'offset effectif réduit à 55 %');
    }
    {
      const seedMou = seedPour('mousse');
      const etat = tower.creerPartie(seedMou);
      for (let i = 0; i < kDans(seedMou, 'mousse'); i++) taper(etat, 0);
      const cibleAvant = etat.derive;
      const evt = taper(etat, 0); // pose parfaite… qui GLISSE quand même
      assert.equal(evt.effet, 'mousse');
      assert.equal(Math.abs(evt.glisse), tower.INGREDIENTS.mousse.glisse, 'mousse : glissement de 6 u');
      assert.ok(Math.abs(Math.abs(evt.x - cibleAvant) - tower.INGREDIENTS.mousse.glisse) < 1e-9,
        'la position posée est décalée du glissement (le verdict, lui, reste sur la pose)');
      assert.equal(evt.verdict, 'parfait', 'le glissement ne vole pas le verdict');
    }
    {
      // 🦷 MORSURE 5 — le glaçon : un bancal étrangle DOUBLE (−12), et le
      // rattrapage rend la moitié de la VRAIE perte (+6) — cohérent partout.
      const seedGla = seedPour('glacon');
      const etat = tower.creerPartie(seedGla);
      const k = kDans(seedGla, 'glacon');
      for (let i = 0; i < k; i++) taper(etat, 0);
      assert.ok(Math.abs(tower.periodeIngredient(etat)
        - Math.max(tower.PERIODE_PLANCHER, tower.PERIODE_INITIALE * Math.pow(tower.ACCELERATION_PERIODE, Math.floor(k / tower.POSES_PAR_PALIER))) * 1.35) < 1e-9,
        'glaçon : période ×1,35 (lent)');
      const largeurAvant = etat.largeur;
      const fGla = tower.facteurFenetresCourant(etat);
      const evt = taper(etat, (tower.FENETRE_BIEN + tower.FENETRE_BANCAL) / 2 * fGla);
      assert.equal(evt.verdict, 'bancal');
      assert.equal(evt.effet, 'glacon');
      assert.equal(etat.largeur, largeurAvant - tower.PERTE_BANCAL * tower.INGREDIENTS.glacon.malusBancal,
        'MORSURE : bancal sur glaçon = perte DOUBLE (−12)');
      assert.equal(evt.rattrapage.perdu, tower.PERTE_BANCAL * 2);
      const r = tower.rattraper(etat, tower.RATTRAPAGE_DUREE_MS / 2);
      assert.equal(r.largeurRecuperee, tower.PERTE_BANCAL, 'rattrapé : la moitié de 12, soit +6');
    }
    {
      let speciaux = 0, total = 0;
      for (let s = 1; s <= 60; s++) {
        const ids = apercuFile(s, 30);
        for (let i = 1; i < ids.length; i++) {
          assert.ok(!(tower.INGREDIENTS[ids[i]].special && tower.INGREDIENTS[ids[i - 1]].special),
            `seed ${s}: deux spéciaux consécutifs (${ids[i - 1]} puis ${ids[i]})`);
        }
        speciaux += ids.filter((id) => tower.INGREDIENTS[id].special).length;
        total += ids.length;
      }
      const densite = speciaux / total;
      assert.ok(densite > 0.26 && densite < 0.41,
        `densité de spéciaux « 1 sur 3 » attendue (p=0,5 sans doublon ⇒ 1/3 ; mesurée ${densite.toFixed(3)})`);
      // variantes : Tout-glaçon = que des glaçons ; Pluie de minis ≈ 50 % de minis
      {
        const e = tower.creerPartie(5, 'glacons');
        for (let i = 0; i < 12; i++) { assert.equal(e.file[e.indice], 'glacon', 'variante Tout-glaçon'); taper(e, 0); }
      }
      let minis = 0, totalMinis = 0;
      for (let s = 1; s <= 40; s++) {
        const e = tower.creerPartie(s, 'minis');
        for (let i = 0; i < 16 && !e.finie; i++) { if (e.file[e.indice] === 'mini') minis++; totalMinis++; taper(e, 0); }
      }
      const densiteMinis = minis / totalMinis;
      assert.ok(densiteMinis > 0.35 && densiteMinis < 0.65, `Pluie de minis ≈ 50 % (mesurée ${densiteMinis.toFixed(2)})`);
    }
  }

  // --- 🌬️ Vent : le point de visée respire de ±5 u (et seulement en variante vent).
  {
    const etat = tower.creerPartie(9, 'vent');
    assert.equal(tower.cibleVisee(etat, 0), etat.derive, 'vent : départ neutre (continuité visuelle)');
    assert.ok(Math.abs(tower.cibleVisee(etat, tower.VENT_PERIODE / 4) - etat.derive - tower.VENT_AMPLITUDE) < 1e-9,
      'vent : +5 u au quart de période');
    const sansVent = tower.creerPartie(9);
    assert.equal(tower.cibleVisee(sansVent, 1234), sansVent.derive, 'sans variante : cible = dérive, toujours');
  }

  // --- 📅 Défi + objectifs du jour : déterministes par date, variés sur 30 jours,
  //     et le pool ÉTENDU (hauteur, rattrapages, étage sans-faute) est branché.
  {
    assert.deepEqual(tower.defiDuJour('2026-07-29'), tower.defiDuJour('2026-07-29'), 'défi stable pour une date');
    assert.deepEqual(tower.objectifsDuJour('2026-07-29'), tower.objectifsDuJour('2026-07-29'), 'objectifs stables pour une date');
    const variantes = new Set(); const triples = new Set(); const typesVus = new Set();
    for (let j = 1; j <= 30; j++) {
      const date = `2026-09-${String(j).padStart(2, '0')}`;
      const defi = tower.defiDuJour(date);
      assert.ok(tower.VARIANTES[defi.variante], 'variante du défi valide');
      assert.ok(Number.isFinite(defi.seed) && defi.nom && defi.emoji && defi.description, 'défi complet');
      variantes.add(defi.variante);
      const objs = tower.objectifsDuJour(date);
      assert.equal(objs.length, 3, '3 objectifs par jour');
      assert.equal(new Set(objs.map((o) => o.type)).size, 3, 'jamais deux objectifs du même type le même jour');
      for (const o of objs) { assert.ok(o.libelle && o.id, 'objectif complet'); typesVus.add(o.type); }
      triples.add(objs.map((o) => o.id).join('+'));
    }
    assert.ok(variantes.size >= 3, `au moins 3 variantes distinctes sur 30 jours (${variantes.size})`);
    assert.ok(triples.size >= 8, `les triplettes d'objectifs varient sur 30 jours (${triples.size})`);
    for (const type of ['etage', 'rattrapages', 'etage_sans_faute']) {
      assert.ok(typesVus.has(type), `le pool étendu sort réellement des objectifs « ${type} » sur 30 jours`);
    }
  }
  {
    const res = {
      score: 1600, meilleurCombo: 6, parfaits: 5, biens: 4, bancals: 3, rates: 1,
      rattrapages: 2, etages: 3, poses: 20, etagesSansFaute: 1,
      basculee: true, raisonBascule: 'largeur',
    };
    const objs = [
      { id: 'a', type: 'parfaits', cible: 5, libelle: '' }, { id: 'b', type: 'score', cible: 1500, libelle: '' },
      { id: 'c', type: 'combo', cible: 8, libelle: '' }, { id: 'd', type: 'etage', cible: 3, libelle: '' },
      { id: 'e', type: 'rattrapages', cible: 3, libelle: '' }, { id: 'f', type: 'etage_sans_faute', cible: 1, libelle: '' },
      { id: 'g', type: 'poses', cible: 25, libelle: '' }, { id: 'h', type: 'objectif-du-futur', cible: 1, libelle: '' },
    ];
    assert.deepEqual(tower.evaluerObjectifs(res, objs), [true, true, false, true, false, true, false, false],
      'évaluation pure des objectifs v2 (type inconnu → false, jamais un crash)');
  }

  // --- 🔥 Série de jours joués : SANS malus — un oubli repart à 1, sans reproche.
  assert.deepEqual(tower.majSerie(null, '2026-07-29'), { jours: 1, dernierJour: '2026-07-29' }, 'première partie → 1');
  assert.deepEqual(tower.majSerie({ jours: 3, dernierJour: '2026-07-29' }, '2026-07-29'), { jours: 3, dernierJour: '2026-07-29' }, 'même jour : inchangée');
  assert.deepEqual(tower.majSerie({ jours: 3, dernierJour: '2026-07-28' }, '2026-07-29'), { jours: 4, dernierJour: '2026-07-29' }, 'lendemain : +1');
  assert.deepEqual(tower.majSerie({ jours: 9, dernierJour: '2026-07-20' }, '2026-07-29'), { jours: 1, dernierJour: '2026-07-29' }, 'trou : repart à 1');
  assert.deepEqual(tower.majSerie({ jours: 2, dernierJour: '2026-07-31' }, '2026-08-01'), { jours: 3, dernierJour: '2026-08-01' }, 'passage de mois correct');
  assert.deepEqual(tower.majSerie({ jours: NaN, dernierJour: 'sale' }, 'sale aussi'), { jours: 1, dernierJour: '1970-01-01' }, 'entrées sales : repli propre');

  // --- 🧪 Entrées sales : seed NaN, t NaN — AUCUN NaN propagé (leçon du projet).
  {
    const etat = tower.creerPartie(NaN);
    assert.equal(etat.seed, tower.GRAINE_REPLI, 'seed NaN → graine de repli');
    assert.ok(etat.file.length >= 1 && tower.INGREDIENTS[etat.file[0]], 'la file démarre quand même');
    sansNaN(etat, 'creerPartie(NaN)');
    assert.ok(Number.isFinite(tower.positionIngredient(etat, NaN)), 'position à t NaN : finie');
    assert.ok(Number.isFinite(tower.positionIngredient(etat, -500)), 'position à t négatif : finie');
    assert.ok(Number.isFinite(tower.tPourPosition(etat, NaN, NaN)), 'tPourPosition sale : fini');
    assert.equal(tower.facteurEtage(NaN), 1, 'facteurEtage(NaN) : repli étage 1, jamais NaN');
    const evt = tower.lacher(etat, NaN);
    sansNaN(evt, 'lacher(NaN)'); sansNaN(etat, 'état après lacher(NaN)');
    if (etat.rattrapage) { sansNaN(tower.rattraper(etat, NaN), 'rattraper(NaN)'); sansNaN(etat, 'état après rattraper(NaN)'); }
    const infini = tower.creerPartie(Infinity, 'variante-bidon');
    assert.equal(infini.variante, null, 'variante inconnue → null');
    sansNaN(infini, 'creerPartie(Infinity)');
    sansNaN(tower.defiDuJour('n\'importe quoi'), 'defiDuJour sale');
    assert.equal(tower.objectifsDuJour(undefined).length, 3, 'objectifs sur date invalide : repli déterministe');
  }

  // --- 🤖 Bots seedés (calibrage léger — le calibrage complet vit hors harnais) :
  //     le MOYEN atteint l'étage 2-4 en ~25-75 s ; le BON monte à l'étage 5+ mais
  //     la spirale fenêtres×étage l'ATTRAPE (mort typique avant ~4 min) —
  //     personne n'est immortel. Bruit TEMPOREL : σ (en u, à la vitesse
  //     initiale) est multiplié par PERIODE_INITIALE/période — l'accélération
  //     nerveuse coûte de la précision, comme à un pouce humain. Tout est seedé :
  //     la simulation est STABLE, l'assertion ne peut pas flotter.
  {
    const gauss = (rng) => {
      let u = 0, v = 0;
      while (u === 0) u = rng();
      while (v === 0) v = rng();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    const simuler = (seed, sigma, etourderie, rng) => {
      const etat = tower.creerPartie(seed);
      let duree = 0, garde = 0;
      while (!etat.finie && garde++ < 1200) {
        const p = tower.periodeIngredient(etat);
        const attente = 280 + Math.floor(rng() * 2) * (p / 2) + rng() * 140;
        let err = gauss(rng) * sigma * (tower.PERIODE_INITIALE / p);
        if (rng() < etourderie) err = (rng() < 0.5 ? -1 : 1) * (28 + rng() * 20);
        const t = tower.tPourPosition(etat, clamp(etat.derive + err), attente);
        const evt = tower.lacher(etat, t);
        duree += t + 420;
        if (evt.rattrapage) {
          duree += evt.rattrapage.dureeMs;
          tower.rattraper(etat, rng() < 0.6 ? tower.RATTRAPAGE_DUREE_MS / 2 : 100); // ~60 % de réussite
        }
        if (evt.scellement) duree += 650;
      }
      return { duree, res: tower.resultatDe(etat), finie: etat.finie };
    };
    const med = (arr) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)];
    const rngMoyen = tower.mulberry32(20260729);
    const moyens = [];
    for (let i = 0; i < 30; i++) moyens.push(simuler(3000 + i, 11, 0.05, rngMoyen));
    assert.ok(moyens.every((p) => p.finie), 'le joueur moyen finit TOUJOURS par basculer (aucune partie infinie)');
    const etageMoyen = med(moyens.map((p) => p.res.etages));
    assert.ok(etageMoyen >= 2 && etageMoyen <= 4, `joueur moyen : étage médian 2-4 (mesuré ${etageMoyen})`);
    const dureeMoyenne = moyens.reduce((s, p) => s + p.duree, 0) / moyens.length / 1000;
    assert.ok(dureeMoyenne >= 25 && dureeMoyenne <= 75,
      `joueur moyen : durée moyenne 25-75 s (mesurée ${dureeMoyenne.toFixed(1)} s)`);
    const rngBon = tower.mulberry32(424242);
    const bons = [];
    for (let i = 0; i < 24; i++) bons.push(simuler(6000 + i, 4.5, 0.015, rngBon));
    assert.ok(bons.every((p) => p.finie), 'même un BON joueur finit par basculer — personne n\'est immortel');
    assert.ok(med(bons.map((p) => p.res.etages)) >= 5,
      `un bon joueur monte à l'étage 5+ (médiane ${med(bons.map((p) => p.res.etages))})`);
    assert.ok(med(bons.map((p) => p.duree)) < 240000,
      `…mais la spirale l'attrape avant ~4 min (médiane ${(med(bons.map((p) => p.duree)) / 1000).toFixed(0)} s)`);
    assert.ok(med(bons.map((p) => p.res.score)) > med(moyens.map((p) => p.res.score)) * 1.5, 'l\'écart de skill se lit au score');
    assert.ok(bons.some((p) => p.res.rattrapages >= 2) && moyens.some((p) => p.res.rattrapages >= 1),
      'le rattrapage vit dans les vraies parties (pas une mécanique fantôme)');
  }

  console.log('Boba Tower : tests moteur OK');
} finally {
  fs.rmSync(sortieTower, { recursive: true, force: true });
}


  // ============ 🎡 ROUE DU MOIS — moteur pur (3e jeu autonome, hors Boba Quest) ============
  // Le moteur vit dans src/components/roue/ (PAS components/jeu/) : il se compile donc
  // À PART, avec tsc, dans son propre dossier temporaire — exactement comme le bloc
  // principal compile les moteurs Quest. Tout est déterministe : rng seedé, dates
  // fixées, zéro Math.random / Date.now (le moteur les INTERDIT, les tests aussi).
  {
    const sortieRoue = fs.mkdtempSync(path.join(os.tmpdir(), 'roue-du-mois-tests-'));
    try {
      execFileSync(path.join(racine, 'node_modules', '.bin', 'tsc'), [
        '--outDir', sortieRoue,
        '--rootDir', path.join(racine, 'src/components/roue'),
        '--module', 'commonjs',
        '--moduleResolution', 'node',
        '--target', 'es2020',
        '--esModuleInterop',
        '--skipLibCheck',
        path.join(racine, 'src/components/roue/roue.ts'),
      ], { cwd: racine, stdio: 'pipe' });
      const roue = require(path.join(sortieRoue, 'roue.js'));

      // rng seedé (mulberry32, la même recette que `creerRng` du shooter) redéfini
      // ICI : le harnais d'un jeu indépendant ne s'appuie pas sur les moteurs Quest.
      const rngRoue = (graine) => {
        let a = graine >>> 0;
        return () => {
          a |= 0; a = (a + 0x6D2B79F5) | 0;
          let t = Math.imul(a ^ (a >>> 15), 1 | a);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      };

      // --- La table : 8 segments, poids = 100 %, ids uniques, code null = re-spin seul ---
      assert.equal(roue.SEGMENTS_ROUE.length, 8, 'roue : 8 segments affichés');
      assert.equal(roue.PART_DEG, 45, 'roue : parts affichées égales de 45°');
      assert.equal(roue.SEGMENTS_ROUE.reduce((s, x) => s + x.poids, 0), 100,
        'roue : les poids sont des % réels et doivent sommer exactement à 100');
      assert.equal(new Set(roue.SEGMENTS_ROUE.map((s) => s.id)).size, 8, 'roue : ids uniques');
      for (const seg of roue.SEGMENTS_ROUE) {
        if (seg.id === 'double') {
          assert.equal(seg.code, null, 'roue : « double » est le SEUL lot virtuel (code null)');
        } else {
          assert.ok(typeof seg.code === 'string' && seg.code.length > 0,
            `roue : ${seg.id} est un lot réel, code caisse obligatoire`);
        }
        assert.ok(typeof seg.libelle === 'string' && seg.libelle.length > 0, `roue : ${seg.id} sans libellé`);
      }
      // Doctrine d'honnêteté de la roulette Quest, reprise telle quelle : part affichée
      // (12,5 %) vs chance réelle, distorsion ≤ 2 sinon les parts égales mentent.
      for (const seg of roue.SEGMENTS_ROUE) {
        const distorsion = Math.max(12.5 / seg.poids, seg.poids / 12.5);
        assert.ok(distorsion <= 2,
          `roue « ${seg.libelle} » : ${seg.poids} % réels affichés comme 12,5 % (facteur ${distorsion.toFixed(2)})`);
      }

      // --- tirerSegment suit les POIDS (fréquences serrées sur rng seedé fixe) ---
      {
        const rng = rngRoue(20260801);
        const N = 200000;
        const compte = new Array(8).fill(0);
        for (let i = 0; i < N; i++) compte[roue.tirerSegment(rng)]++;
        for (const [i, seg] of roue.SEGMENTS_ROUE.entries()) {
          const obs = (compte[i] / N) * 100;
          assert.ok(Math.abs(obs - seg.poids) < 0.5,
            `roue « ${seg.libelle} » : ${obs.toFixed(2)} % observés pour ${seg.poids} % attendus`);
        }
      }
      // --- exclusion : JAMAIS l'exclu, et masse renormalisée au prorata des restants ---
      {
        const rng = rngRoue(777);
        const N = 120000;
        const compte = new Array(8).fill(0);
        for (let i = 0; i < N; i++) compte[roue.tirerSegment(rng, 'double')]++;
        const iDouble = roue.SEGMENTS_ROUE.findIndex((s) => s.id === 'double');
        assert.equal(compte[iDouble], 0, 'roue : le segment exclu ne doit JAMAIS sortir');
        for (const [i, seg] of roue.SEGMENTS_ROUE.entries()) {
          if (i === iDouble) continue;
          const attendu = (seg.poids / 86) * 100; // 100 − 14 (poids du re-spin exclu)
          const obs = (compte[i] / N) * 100;
          assert.ok(Math.abs(obs - attendu) < 0.6,
            `roue exclusion « ${seg.libelle} » : ${obs.toFixed(2)} % pour ${attendu.toFixed(2)} % attendus`);
        }
        // l'exclusion vaut pour n'importe quel id, pas seulement le lot virtuel
        const rng2 = rngRoue(778);
        const iBoisson = roue.SEGMENTS_ROUE.findIndex((s) => s.id === 'boisson');
        for (let i = 0; i < 4000; i++) {
          assert.notEqual(roue.tirerSegment(rng2, 'boisson'), iBoisson,
            'roue : exclusion d un lot réel ignorée');
        }
      }

      // --- tirageComplet : le mois se solde TOUJOURS par un lot réel ---
      {
        const rng = rngRoue(4242);
        let doubles = 0;
        for (let i = 0; i < 30000; i++) {
          const t = roue.tirageComplet(rng);
          assert.notEqual(t.finalId, 'double', 'roue : finalId ne doit jamais être le re-spin');
          assert.equal(t.doubleTour, t.premierId === 'double', 'roue : doubleTour ⇔ premier tirage sur « double »');
          if (!t.doubleTour) assert.equal(t.finalId, t.premierId, 'roue : sans double tour, le lot EST le premier tirage');
          if (t.doubleTour) doubles++;
        }
        const pctDouble = (doubles / 30000) * 100;
        assert.ok(Math.abs(pctDouble - 14) < 1,
          `roue : « double tour » doit sortir à ~14 % (${pctDouble.toFixed(2)} % observés)`);
      }

      // --- rotation ↔ segment : aller-retour EXACT + marge ≥ 6° des coutures ---
      for (let index = 0; index < 8; index++) {
        for (const graine of [11, 22, 33]) {
          const rng = rngRoue(index * 1000 + graine);
          for (let k = 0; k < 40; k++) {
            const tours = 2 + (k % 4);
            const rot = roue.rotationCibleVers(index, rng, tours);
            assert.ok(rot >= tours * 360, 'roue : les tours pleins demandés doivent être respectés');
            assert.equal(roue.segmentSousPointeur(rot), index,
              `roue : rotation visant ${index} mais pointeur sur ${roue.segmentSousPointeur(rot)}`);
            // distance au centre ≤ 22,5 − 6 ⇔ marge ≥ 6° de chaque couture
            const angle = (((360 - (rot % 360)) % 360) + 360) % 360;
            let ecart = Math.abs(angle - index * 45);
            ecart = Math.min(ecart, 360 - ecart);
            assert.ok(ecart <= 45 / 2 - 6 + 1e-9,
              `roue : atterrissage à ${ecart.toFixed(2)}° du centre de la part ${index} — marge < 6° de la couture`);
          }
        }
      }

      // --- instantsDeCrans : le tic-tic-tic d'une roue qui ralentit VRAIMENT ---
      {
        const rotTotale = 4 * 360 + 190; // un premier tour réaliste (repos → arrêt)
        const duree = 4600;
        const crans = roue.instantsDeCrans(rotTotale, duree);
        // une couture tous les 45°, la première à 22,5° du repos (pointeur au centre)
        assert.equal(crans.length, Math.floor((rotTotale - 22.5) / 45) + 1,
          'roue : nombre de crans = nombre de coutures franchies');
        for (let i = 1; i < crans.length; i++) {
          assert.ok(crans[i] > crans[i - 1], 'roue : les crans doivent être strictement croissants');
        }
        assert.ok(crans[crans.length - 1] <= duree, 'roue : le dernier cran ne dépasse jamais la durée');
        // les écarts AUGMENTENT vers la fin : signature du ralentissement (cubic-out)
        for (let i = 2; i < crans.length; i++) {
          assert.ok(crans[i] - crans[i - 1] > crans[i - 1] - crans[i - 2],
            'roue : les crans doivent s espacer quand la roue ralentit');
        }
        // et surtout : chaque cran retombe PILE sur une couture quand on rejoue l'easing
        // À L'ENDROIT — p(t) = 1 − (1 − t/durée)³, la courbe exacte que l'écran donne à
        // RN Animated (Easing.out(Easing.cubic)). C'est le contrat module ↔ animation :
        // un exposant qui change d'un seul côté casse cette ligne.
        crans.forEach((t, j) => {
          const p = 1 - Math.pow(1 - t / duree, 3);
          assert.ok(Math.abs(rotTotale * p - (22.5 + j * 45)) < 1e-6,
            `roue : le cran ${j} ne coïncide pas avec une couture sous cubic-out`);
        });
        // cas dégénérés : pas de rotation ou pas de durée → aucun cran, pas de boucle folle
        assert.deepEqual(roue.instantsDeCrans(0, 4600), [], 'roue : rotation nulle = aucun cran');
        assert.deepEqual(roue.instantsDeCrans(720, 0), [], 'roue : durée nulle = aucun cran');
      }

      // --- clés de mois : passage d'année, février bissextile, 1er du mois ---
      assert.equal(roue.cleDuMois(new Date(2026, 11, 31)), '2026-12', 'roue : cleDuMois en décembre');
      assert.equal(roue.cleDuMois(new Date(2027, 0, 1)), '2027-01', 'roue : cleDuMois au passage d année');
      assert.equal(roue.cleDuMois(new Date(2026, 2, 3)), '2026-03', 'roue : mois toujours sur 2 chiffres');
      assert.equal(roue.joursAvantMoisSuivant(new Date(2026, 11, 31)), 1, 'roue : 31 décembre → nouvelle roue demain');
      assert.equal(roue.joursAvantMoisSuivant(new Date(2026, 0, 1)), 31, 'roue : 1er janvier → 31 jours');
      assert.equal(roue.joursAvantMoisSuivant(new Date(2028, 1, 28)), 2, 'roue : février BISSEXTILE (2028) → 2 jours');
      assert.equal(roue.joursAvantMoisSuivant(new Date(2026, 1, 28)), 1, 'roue : février non bissextile → 1 jour');
      for (const d of [new Date(2026, 6, 15), new Date(2026, 11, 1), new Date(2027, 1, 27)]) {
        assert.ok(roue.joursAvantMoisSuivant(d) >= 1, 'roue : le compte à rebours ne descend jamais sous 1');
      }

      // --- « Tes chances » : la liste honnête somme à 100 et suit l'ordre de la roue ---
      {
        const pcts = roue.pourcentagesHonnetes();
        assert.equal(pcts.length, 8, 'roue : une ligne de chances par segment');
        assert.ok(Math.abs(pcts.reduce((s, x) => s + x.pct, 0) - 100) < 1e-9,
          'roue : les chances affichées somment à 100');
        pcts.forEach((p, i) => {
          assert.equal(p.id, roue.SEGMENTS_ROUE[i].id, 'roue : la liste des chances suit l ordre d affichage');
          assert.ok(Math.abs(p.pct - roue.SEGMENTS_ROUE[i].poids) < 1e-9,
            'roue : % affiché = poids réel du segment');
        });
      }

      // --- Validité 30 jours (03/08) : échéance CALENDAIRE, débordements normalisés ---
      // On compare les composantes LOCALES d'une date construite en local : le même
      // test passe en UTC (machine) et en Europe/Paris (Mac), et le cas d'octobre
      // prouve que l'heure affichée ne dérive pas d'une heure au changement d'heure.
      {
        assert.equal(roue.LOT_VALIDITE_JOURS, 30, 'roue : la validité affichée partout est 30 jours');
        const cas = [
          ['2026-08-03T14:30:00', '2026-09-02T14:30'],  // mois de 31 jours
          ['2026-12-15T09:00:00', '2027-01-14T09:00'],  // passage d'année
          ['2028-01-31T23:59:00', '2028-03-01T23:59'],  // 31/01 + 30 j via un février bissextile
          ['2026-10-10T12:00:00', '2026-11-09T12:00'],  // traverse l'heure d'hiver : 12 h reste 12 h
        ];
        for (const [depart, attendu] of cas) {
          const e = roue.expireLe(new Date(depart));
          const obtenu = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-`
            + `${String(e.getDate()).padStart(2, '0')}T${String(e.getHours()).padStart(2, '0')}:`
            + `${String(e.getMinutes()).padStart(2, '0')}`;
          assert.equal(obtenu, attendu, `roue : ${depart} + 30 j calendaires → ${attendu}`);
        }
      }

      console.log('Roue du Mois : moteur pur OK');
    } finally {
      fs.rmSync(sortieRoue, { recursive: true, force: true });
    }
  }

  console.log('Boba Quest : tests moteurs + store OK');
} finally {
  fs.rmSync(sortie, { recursive: true, force: true });
}