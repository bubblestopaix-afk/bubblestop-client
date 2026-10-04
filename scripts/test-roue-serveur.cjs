const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname,'..');
function moduleTs(fichier, imports={}) {
  const exports={};
  const source=fs.readFileSync(path.join(root,fichier),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code,{exports,require:nom=>{if(!(nom in imports))throw new Error(`Import non simulé ${nom}`);return imports[nom];},Date,Error});
  return exports;
}
const roue=moduleTs('src/components/roue/roue.ts');
const adaptateur=moduleTs('src/lib/roue-serveur.ts',{'../components/roue/roue':roue});
const resultat={ok:true,mois:'2026-09',deja_creee:false,demande:{
  client_id:'compte-fictif',origine:'roulette',code:'roulette_tampon_2',created_at:'2026-09-27T10:00:00Z',statut:'en_attente',roue_premier_id:'double',
}};
(async()=>{
  const etat=adaptateur.lireEtatRoueServeur(resultat,'compte-fictif',true);
  assert.equal(etat.tirage.finalId,'tampon2'); assert.equal(etat.tirage.premierId,'double'); assert.equal(etat.tirage.doubleTour,true);
  assert.equal(etat.tirage.mois,'2026-09');
  const historique=adaptateur.lireEtatRoueServeur({...resultat,deja_creee:true,demande:{...resultat.demande,roue_premier_id:null,statut:'appliquee'}},'compte-fictif',true);
  assert.equal(historique.tirage.finalId,'tampon2'); assert.equal(historique.dejaCreee,true); assert.equal(historique.statut,'appliquee');
  for(const mauvais of [
    {...resultat,mois:'2026-99'}, {...resultat,ok:false},
    {...resultat,demande:null}, {...resultat,demande:{...resultat.demande,client_id:'autre'}},
    {...resultat,demande:{...resultat.demande,code:'lot-invente'}},
    {...resultat,demande:{...resultat.demande,roue_premier_id:'boisson'}},
    {...resultat,demande:{...resultat.demande,created_at:'invalide'}},
  ]) assert.throws(()=>adaptateur.lireEtatRoueServeur(mauvais,'compte-fictif',true));
  const eligible={autorisee:true,disponible_le:'2026-09-20T10:00:00Z',scan_requis:false};
  const lecture={...resultat,demande:null,eligibilite:eligible};
  assert.equal(adaptateur.lireEtatRoueServeur(lecture,'compte-fictif',false).tirage,null);
  assert.equal(adaptateur.lireEtatRoueServeur(lecture,'compte-fictif',false).eligibilite.autorisee,true);
  for(const conditions of [null,{}, {...eligible,autorisee:'oui'}, {...eligible,disponible_le:'invalide'}, {...eligible,scan_requis:true}]) {
    assert.throws(()=>adaptateur.lireEtatRoueServeur({...lecture,eligibilite:conditions},'compte-fictif',false));
  }
  const attente={autorisee:false,disponibleLe:'2099-10-20T10:00:00Z',scanRequis:true};
  assert.match(adaptateur.messageEligibiliteRoue(attente),/20 octobre.*premier scan/);
  assert.match(adaptateur.messageEligibiliteRoue({...attente,scanRequis:false}),/7 jours/);
  assert.match(adaptateur.messageEligibiliteRoue({...attente,disponibleLe:'2020-01-01T00:00:00Z'}),/Aucun achat nécessaire/);
  assert.equal(adaptateur.messageEligibiliteRoue({autorisee:true,disponibleLe:eligible.disponible_le,scanRequis:false}),null);
  let clientId='compte-fictif', panne=false, changer=false, dernierCorps, appels=0;
  const supabase={auth:{getSession:async()=>({data:{session:clientId ? {user:{id:clientId}}:null}})},functions:{invoke:async(nom,{body})=>{
    appels++; dernierCorps=body;
    assert.equal(nom,'jeu-recompenses');
    if(changer)clientId='autre-compte';
    if(panne) return {data:null,error:{context:{json:async()=>({erreur:'roue indisponible'})}}};
    return {data:resultat,error:null};
  }}};
  const pont=moduleTs('src/lib/recompenses-jeu.ts',{'@/lib/supabase':{supabase},'./roue-serveur':adaptateur});
  const premier=await pont.chargerRoueDuMois(true);
  assert.deepEqual(JSON.parse(JSON.stringify(dernierCorps)),{action:'tirer-roue'});
  resultat.deja_creee=true;
  const second=await pont.chargerRoueDuMois(true);
  assert.equal(second.tirage.code,premier.tirage.code);assert.equal(second.dejaCreee,true);
  await pont.chargerRoueDuMois(false);assert.equal(dernierCorps.action,'etat-roue');
  panne=true;await assert.rejects(pont.chargerRoueDuMois(true),/roue indisponible/);
  panne=false;changer=true;await assert.rejects(pont.chargerRoueDuMois(true),/session modifiee/);
  clientId=null;const avant=appels;await assert.rejects(pont.chargerRoueDuMois(true),/session invalide/);assert.equal(appels,avant);
  const ecran=fs.readFileSync(path.join(root,'src/app/roue.tsx'),'utf8').replace(/\/\/[^\n]*/g,'');
  assert.doesNotMatch(ecran,/tirageComplet\s*\(|creerDemandeRecompenseJeu\s*\(|AsyncStorage/,'aucun repli vers un lot local');
  assert.match(ecran,/await chargerRoueDuMois\(true\)/);
  assert.match(ecran,/<RoueContenu key=\{clientId\}/,'changement de compte = écran neuf');
  if(!process.argv.includes('--quiet'))console.log('Roue serveur : contrat, anciens gains, erreurs et sessions OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
