import React from 'react';
import {createRoot} from 'react-dom/client';
import Accueil from '../../../src/app/index';
import Offres from '../../../src/app/offres';
import Roue from '../../../src/app/roue';
function Preview(){
 const [route,setRoute]=React.useState(location.hash.slice(1)||'/');
 React.useEffect(()=>{const lire=()=>setRoute(location.hash.slice(1)||'/'); window.addEventListener('hashchange',lire);return()=>window.removeEventListener('hashchange',lire);},[]);
 return <><main>{route==='/roue'?<Roue/>:route==='/offres'?<Offres/>:route==='/'?<Accueil/>:<p>Route hors du périmètre de cette recette : {route}</p>}</main><nav aria-label="Navigation de recette"><a href="#/">Accueil</a><a href="#/offres">Offres</a><a href="#/roue">Roue</a></nav></>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
