const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// 18/10/2026 (Yoann) : « retire le jeton à la déconnexion dans l'appli aussi ».
// Un compte déconnecté ne doit plus recevoir ses notifications sur ce téléphone.
const racine = path.resolve(__dirname, '..');
const sortie = fs.mkdtempSync(path.join(os.tmpdir(), 'push-deconnexion-tests-'));
const lire = (f) => fs.readFileSync(path.join(racine, f), 'utf8');

(async () => {
  try {
    execFileSync(path.join(racine, 'node_modules/.bin/tsc'), ['--outDir', sortie,
      '--module', 'commonjs', '--moduleResolution', 'node', '--target', 'es2020', '--skipLibCheck',
      path.join(racine, 'src/lib/push-deconnexion.ts')], { cwd: racine, stdio: 'pipe' });
    const { retirerJetonPush, CLE_JETON_PUSH } = require(path.join(sortie, 'push-deconnexion.js'));

    const essai = async (options = {}) => {
      const { supprimer, lireJeton, delaiMs = 50 } = options;
      const jeton = 'jeton' in options ? options.jeton : 'ExponentPushToken[test]';
      const journal = { supprimes: [], oublie: 0 };
      const resultat = await retirerJetonPush({
        lireJeton: lireJeton || (async () => jeton),
        supprimer: supprimer || (async (j) => { journal.supprimes.push(j); return { error: null }; }),
        oublierJeton: async () => { journal.oublie += 1; },
        delaiMs,
      });
      return { resultat, ...journal };
    };

    // Jeton mémorisé : retiré par sa valeur, puis oublié.
    const ok = await essai();
    assert.equal(ok.resultat, 'retire');
    assert.deepEqual(ok.supprimes, ['ExponentPushToken[test]']);
    assert.equal(ok.oublie, 1);

    // Aucun jeton mémorisé (simulateur, permission refusée) : rien n'est envoyé.
    for (const jeton of [null, undefined, '', '   ']) {
      const r = await essai({ jeton });
      assert.equal(r.resultat, 'aucun-jeton');
      assert.deepEqual(r.supprimes, []);
      assert.equal(r.oublie, 0);
    }

    // Refus serveur ou réseau coupé : la déconnexion continue, le jeton reste mémorisé
    // pour être retenté à la prochaine déconnexion.
    const refus = await essai({ supprimer: async () => ({ error: { message: 'refus' } }) });
    assert.equal(refus.resultat, 'echec');
    assert.equal(refus.oublie, 0);
    const reseau = await essai({ supprimer: async () => { throw new Error('hors ligne'); } });
    assert.equal(reseau.resultat, 'echec');
    const lecture = await essai({ lireJeton: async () => { throw new Error('stockage'); } });
    assert.equal(lecture.resultat, 'echec');

    // Serveur qui ne répond pas : la déconnexion n'attend pas plus que le délai.
    const debut = Date.now();
    const lent = await essai({ supprimer: () => new Promise(() => {}), delaiMs: 30 });
    assert.equal(lent.resultat, 'delai');
    assert.ok(Date.now() - debut < 1000, 'déconnexion bornée');

    // Branchements : jeton mémorisé à l'enregistrement, retrait par jeton AVANT signOut.
    const push = lire('src/lib/push.ts');
    assert.equal(CLE_JETON_PUSH, 'push.jeton');
    assert.match(push, /if \(!token\) return;\s*\/\/[^\n]*\n\s*AsyncStorage\.setItem\(CLE_JETON_PUSH, token\)/);
    assert.match(push, /supprimer: \(jeton\) => supabase\.from\('push_tokens'\)\.delete\(\)\.eq\('token', jeton\)/);
    const compte = lire('src/app/compte.tsx');
    assert.match(compte, /const deconnexion = async \(\) => \{[^}]*await retirerPushAvantDeconnexion\(\);\s*await supabase\.auth\.signOut\(\);/);

    console.log('Notifications : jeton retiré à la déconnexion, borné et sans blocage, validé');
  } finally { fs.rmSync(sortie, { recursive: true, force: true }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
