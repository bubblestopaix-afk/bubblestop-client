// === Correctif Cloudflare Pages ===
// Cloudflare Pages REFUSE d'uploader tout dossier nommé "node_modules".
// Or `expo export` place les polices sous dist/assets/node_modules/... →
// elles ne sont jamais servies (le fallback SPA renvoie du HTML), d'où la
// typo par défaut et les icônes en carrés vides.
// Ce script (à lancer APRÈS l'export) renomme le dossier en "vendor" et
// réécrit toutes les références dans les fichiers du build.
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, 'dist');
const src = path.join(dist, 'assets', 'node_modules');
const dest = path.join(dist, 'assets', 'vendor');

if (fs.existsSync(src)) {
  fs.renameSync(src, dest);
  console.log('✓ dist/assets/node_modules → dist/assets/vendor');
} else {
  console.log('(pas de dist/assets/node_modules — rien à renommer)');
}

// Réécrit les URLs dans tous les fichiers texte du build
let modifies = 0;
function parcourir(dossier) {
  for (const f of fs.readdirSync(dossier)) {
    const p = path.join(dossier, f);
    if (fs.statSync(p).isDirectory()) { parcourir(p); continue; }
    if (!/\.(js|html|css|json|map)$/.test(f)) continue;
    const txt = fs.readFileSync(p, 'utf8');
    if (txt.includes('assets/node_modules/')) {
      fs.writeFileSync(p, txt.split('assets/node_modules/').join('assets/vendor/'));
      modifies++;
    }
  }
}
parcourir(dist);
console.log(`✓ ${modifies} fichier(s) réécrit(s) (assets/node_modules → assets/vendor)`);

// === Copie du dossier public/ (sécurité) ===
// Expo copie normalement public/ → dist/ à l'export. On le refait ici par
// sécurité (idempotent) pour garantir que les pages statiques (ex. la
// politique de confidentialité servie à /confidentialite) sont bien dans le
// build Cloudflare, avec leur vrai type MIME (text/html) côté Pages.
const pub = path.join(__dirname, 'public');
if (fs.existsSync(pub)) {
  const copierRec = (src, dst) => {
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) {
      const s = path.join(src, f);
      const d = path.join(dst, f);
      if (fs.statSync(s).isDirectory()) copierRec(s, d);
      else fs.copyFileSync(s, d);
    }
  };
  copierRec(pub, dist);
  console.log('✓ public/ copié vers dist/ (pages statiques)');
} else {
  console.log('(pas de dossier public/ — rien à copier)');
}
