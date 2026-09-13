const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'anniversaire-client-'));
(async () => {
 try {
  execFileSync(path.join(root,'node_modules/.bin/tsc'), ['--outDir',tmp,'--module','commonjs','--moduleResolution','node','--target','es2020','--skipLibCheck',path.join(root,'src/lib/anniversaire.ts')],{cwd:root,stdio:'pipe'});
  const { lireAnniversaire, creerLectureAnniversaire } = require(path.join(tmp,'anniversaire.js'));
  const cadeau = { statut:'disponible',expireLe:'2026-10-13' };
  assert.deepEqual(lireAnniversaire(cadeau),cadeau);
  for(const v of [null,{}, {statut:'disponible',expireLe:'2026-99-99'}, {statut:'disponible',expireLe:'2026-02-30'}, {statut:'conditions',boissons:9,prochainAnniversaire:'2026-10-13'}]) assert.equal(lireAnniversaire(v),null);
  let appels=0,heure=1,fin;
  const service=creerLectureAnniversaire(async()=>{appels++;return cadeau},()=>heure);
  await Promise.all([service.charger('compte-fictif-A'),service.charger('compte-fictif-A')]);
  assert.equal(appels,1,'accueil et fidélité partagent la lecture');
  await service.charger('compte-fictif-A'); assert.equal(appels,1);
  heure+=300001;await service.charger('compte-fictif-A');assert.equal(appels,2);
  await service.charger('compte-fictif-A',true);assert.equal(appels,3,'solde modifié : revalidation');
  await service.charger('compte-fictif-B');assert.equal(appels,4,'jamais de cache entre comptes');
  const lent=creerLectureAnniversaire(()=>new Promise(r=>fin=r));
  const attente=lent.charger('compte-fictif-A');lent.changer(null);fin(cadeau);
  assert.equal(await attente,null,'réponse ancienne ignorée après déconnexion');
  const panne=creerLectureAnniversaire(async()=>{throw Error('hors ligne')});
  await assert.rejects(()=>panne.charger('compte-fictif-A'));
  let rate=false, relectures=0;
  const fragile=creerLectureAnniversaire(async()=>{relectures++;if(rate)throw Error('panne');return cadeau});
  await fragile.charger('A');rate=true;
  await assert.rejects(()=>fragile.charger('A',true));
  await assert.rejects(()=>fragile.charger('A'));
  assert.equal(relectures,3,'une erreur de revalidation invalide le cadeau ancien');
  console.log('Anniversaire client : contrat, dates, cache, dédoublonnage, changements de compte et erreurs validés.');
 } finally { fs.rmSync(tmp,{recursive:true,force:true}); }
})().catch(e=>{console.error(e);process.exitCode=1});
