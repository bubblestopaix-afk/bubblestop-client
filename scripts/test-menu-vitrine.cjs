const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const racine = path.resolve(__dirname, '..');
const sortie = fs.mkdtempSync(path.join(os.tmpdir(), 'menu-vitrine-tests-'));

try {
  execFileSync(path.join(racine, 'node_modules', '.bin', 'tsc'), [
    '--outDir', sortie,
    '--rootDir', path.join(racine, 'src/data'),
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--target', 'es2020',
    '--allowJs',
    '--checkJs', 'false',
    '--skipLibCheck',
    path.join(racine, 'src/data/catalogue.js'),
    path.join(racine, 'src/data/menu-vitrine.ts'),
  ], { cwd: racine, stdio: 'pipe' });

  const { categories } = require(path.join(sortie, 'catalogue.js'));
  const menu = require(path.join(sortie, 'menu-vitrine.js'));

  assert.equal(menu.FAMILLES_MENU.length, 8, 'les huit familles du nouveau menu doivent ouvrir la vitrine');
  assert.equal(new Set(menu.FAMILLES_MENU.map((famille) => famille.id)).size, 8, 'identifiants de famille uniques');

  let saveursVerifiees = 0;
  for (const famille of menu.FAMILLES_MENU) {
    const categorie = menu.construireCategorieVitrine(categories, famille);
    assert.ok(categorie, `${famille.nom}: catégorie catalogue introuvable`);
    assert.ok(categorie.saveurs.length > 0, `${famille.nom}: aucune saveur`);
    for (const saveur of categorie.saveurs) {
      const description = menu.descriptionSaveur(categorie, saveur);
      assert.ok(description.length >= 24, `${famille.nom}/${saveur.nom}: explication trop courte`);
      saveursVerifiees += 1;
    }
  }

  assert.equal(saveursVerifiees, 52, 'toutes les saveurs du menu PDF doivent être expliquées');
  assert.equal(
    menu.descriptionSaveur({}, { id: 'mt-hojicha', nom: 'Hojicha' }),
    'Arôme grillé, à la saveur unique, aux notes de noisette et de caramel.',
    'la description validée du Hojicha doit rester stable',
  );
  assert.deepEqual(
    menu.saveursVitrine({
      saveurs: [
        { id: 'custom-1', nom: 'Sésame' },
        { id: 'custom-sesame-2', nom: 'Autre' },
        { id: 'mt-hojicha', nom: 'Hojicha' },
      ],
    }).map((saveur) => saveur.id),
    ['mt-hojicha'],
    'Sésame doit rester masqué, y compris depuis un ancien cache cloud',
  );

  const matcha = menu.construireCategorieVitrine(categories, 'milk-tea-matcha');
  assert.deepEqual(
    matcha.saveurs.map((saveur) => saveur.nom),
    ['Classic', 'Fraise', 'Vanille', 'Mangue'],
    'Matcha doit être une catégorie autonome à quatre déclinaisons',
  );
  assert.deepEqual(
    matcha.saveurs.map((saveur) => saveur.couleur),
    ['#88B066', '#F07A93', '#E8D4B0', '#ffb244'],
    'les pastilles Matcha doivent suivre les couleurs des saveurs',
  );
  assert.ok(!matcha.saveurs.some((saveur) => saveur.id === 'sg-creme-brulee'), 'Crème Brûlée ne doit jamais être rangée dans Matcha');

  const mousses = menu.construireCategorieVitrine(categories, 'mousses');
  assert.deepEqual(
    mousses.saveurs.map((saveur) => saveur.nom),
    ['Matcha Mousse', 'Chai Mousse', 'Hojicha Mousse'],
    'les trois mousses du PDF doivent être présentes',
  );
  assert.equal(mousses.photo, '/img/photos/mousses-menu.png', 'Mousses doit utiliser la photo extraite du menu PDF');

  const signatures = menu.construireCategorieVitrine(categories, 'signatures');
  assert.deepEqual(
    signatures.saveurs.map((saveur) => saveur.nom),
    ['Crème Brûlée', 'Tiger Sugar', 'Mango Punch'],
    'les signatures doivent être séparées du Matcha et des Mousses',
  );
  assert.equal(signatures.photo, '/img/photos/creme-brulee-menu.png', 'Signatures doit utiliser la photo Crème Brûlée du PDF');
  assert.ok(fs.existsSync(path.join(racine, 'assets/images/photos/mousses-menu.png')), 'photo Mousses absente');
  assert.ok(fs.existsSync(path.join(racine, 'assets/images/photos/creme-brulee-menu.png')), 'photo Crème Brûlée absente');

  const toutes = menu.FAMILLES_MENU.flatMap((famille) => menu.construireCategorieVitrine(categories, famille).saveurs);
  assert.deepEqual(
    toutes.filter((saveur) => saveur.bientot).map((saveur) => saveur.id).sort(),
    [...menu.IDS_SAVEURS_BIENTOT].sort(),
    'seules les quatre nouvelles recettes doivent porter Bientôt disponible',
  );
  assert.ok(!toutes.some((saveur) => saveur.id === 'tr-genmaicha'), 'Genmaicha absent du nouveau PDF doit être retiré');
  assert.ok(!toutes.some((saveur) => /s[ée]same/i.test(saveur.nom)), 'Sésame doit être retiré du nouveau menu');

  const ecranMenu = fs.readFileSync(path.join(racine, 'src/app/menu/[categorieId].tsx'), 'utf8');
  const accueil = fs.readFileSync(path.join(racine, 'src/app/index.tsx'), 'utf8');
  const onglets = fs.readFileSync(path.join(racine, 'src/components/app-tabs.tsx'), 'utf8');
  const config = fs.readFileSync(path.join(racine, 'src/lib/app-config.ts'), 'utf8');
  assert.match(ecranMenu, /Achats uniquement en boutique/);
  assert.doesNotMatch(ecranMenu, /€|Formats et tarifs|prixSaveur|commande en ligne/i);
  assert.match(accueil, /achats uniquement en boutique/i);
  assert.doesNotMatch(accueil, /\/commander|commande en ligne/i);
  assert.doesNotMatch(onglets, /name="commander"|title: 'Commander'/);
  assert.doesNotMatch(config, /FLAG_COMMANDE|useCommandeEnLigne|commande_en_ligne_active/);
  assert.equal(fs.existsSync(path.join(racine, 'src/app/commander')), false, 'les routes de commande doivent être supprimées');
  assert.equal(fs.existsSync(path.join(racine, 'src/store/panier.ts')), false, 'le panier mort doit être supprimé');
  assert.equal(fs.existsSync(path.join(racine, 'src/lib/eligibilite.ts')), false, 'la garde de commande morte doit être supprimée');

  console.log(`Menu PDF : 8 familles et ${saveursVerifiees} saveurs expliquées`);
} finally {
  fs.rmSync(sortie, { recursive: true, force: true });
}
