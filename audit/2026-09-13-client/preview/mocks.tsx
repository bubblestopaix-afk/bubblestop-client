import React from 'react';
const args = new URLSearchParams(location.search);
const session = args.has('visiteur') ? null : {user:{id:'fixture-anonyme'}};
export const router = {push:(route:any)=>{ location.hash=typeof route==='string'?route:route.pathname; },back:()=>{location.hash='/';}};
export function Redirect({href}:any){React.useEffect(()=>{location.hash=href;},[href]);return null;}
export function Link({href,children,asChild,...rest}:any){return asChild ? React.cloneElement(children,{href,...rest}) : <a href={href} {...rest}>{children}</a>;}
export const useFocusEffect = React.useEffect;
export const useSafeAreaInsets=()=>({top:0,right:0,bottom:0,left:0});
export const SafeAreaView=({children}:any)=><>{children}</>;
export const useJeuVisible=()=>({visible:args.has('jeux-demo'),charge:true});
export const useTowerVisible=useJeuVisible;
export const useRoueDuMoisVisible=()=>({visible:!args.has('roue-off'),charge:true});
export const useFonctionnalite=()=>({actif:!args.has('offres-off'),charge:true});
export const constaterFidelite=async()=>{};
export const enregistrerPush=async()=>{};
export const hapticLeger=()=>{}; export const hapticMoyen=hapticLeger; export const hapticSucces=hapticLeger;
export const chargerDemandesRecompensesJeu=async()=>[];
export const creerDemandeRecompenseJeu=async()=>{throw Error('Récompense réelle interdite dans cet aperçu');};
const memory=new Map<string,string>();
export default {getItem:async(k:string)=>memory.get(k)||null,setItem:async(k:string,v:string)=>{memory.set(k,v);},removeItem:async(k:string)=>{memory.delete(k);}};
export const supabase = {auth:{getSession:async()=>({data:{session},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from(table:string){
 const data = table==='profils'?{nom:'',numero_fidelite:'carte-fictive',dernier_magasin_scan:args.get('magasin')||null}:table==='fidelite_cloud'?{tampons:4,cadeaux:0,cartes_completees:0}:[{id:'offre-fictive',created_at:'2026-09-13T08:00:00Z',titre:'Double tampons',message:'Deux tampons pour tes boissons L payées, avec ta carte fidélité.',active:true,magasins:[],jours:null,date_debut:null,date_fin:null}];
 const q:any={select(){return q;},eq(){return q;},order(){return q;},limit(){return q;},maybeSingle(){return q;},then(resolve:any){return Promise.resolve({data,error:args.has('erreur')?{message:'indisponible'}:null}).then(resolve);}}; return q;
}};
