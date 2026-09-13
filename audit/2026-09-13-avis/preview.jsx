import React from 'react';import {createRoot} from 'react-dom/client';
import CarteAvisGoogle from '../../src/components/carte-avis-google';
import {CompteurAvisGoogle} from '../../../bubble-stock-fournisseurs-20260913/bubble-stock-expo/src/avis-google';
import {syntheseAvisGoogle} from '../../../bubble-stock-fournisseurs-20260913/supabase/functions/stock-api/stats-clients.mjs';
let noter=()=>{};
export const supabase={rpc:async(fn,p)=>{if(fn!=='noter_ouverture_avis_google')throw Error('RPC non simulée');noter(p.p_magasin);return {data:{ok:true},error:null};}};
export function Link({children}) {return React.cloneElement(children,{href:'#google-simule',target:undefined,onPress:e=>{e.preventDefault();children.props.onPress?.(e);}});}
function App(){const [rows,setRows]=React.useState([]);noter=magasin=>setRows(r=>[...r,{magasin,jour:'2026-09-13',ouvertures:1}]);return <main style={{maxWidth:720,margin:'auto',padding:18}}><p>Démonstration · clics fictifs · aucun avis transmis</p><CarteAvisGoogle/><div style={{height:30}}/><CompteurAvisGoogle avis={syntheseAvisGoogle(rows,'2026-09-13')} periode="7 jours"/></main>;}
createRoot(document.getElementById('root')).render(<App/>);
