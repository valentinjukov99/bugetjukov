import React, {useMemo,useState,useEffect,useRef} from "react";
import {initializeApp} from "firebase/app";
import {getAuth, signInAnonymously, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithRedirect, getRedirectResult, sendPasswordResetEmail, onAuthStateChanged, signOut} from "firebase/auth";
import {getFirestore,doc,onSnapshot,setDoc, arrayUnion, arrayRemove, collection, getDocs, query, where, getDoc, deleteDoc, addDoc, serverTimestamp} from "firebase/firestore";

// ===== utils (compact)
const mf=new Intl.NumberFormat("ro-RO",{minimumFractionDigits:2,maximumFractionDigits:2});
const pf=new Intl.NumberFormat("ro-RO",{style:"percent",minimumFractionDigits:1});
const fm=(n:number)=>Number.isFinite(n)?mf.format(n):"0,00"; const fp=(n:number)=>pf.format(n||0);
const ymd=(d=new Date())=>d.toISOString().slice(0,10); const ym=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; const todayYM=ym();
const roMonths=["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"]; const roLabel=(mk:string)=>{const [y,m]=mk.split("-");const i=Math.max(0,Math.min(11,parseInt(m||"1")-1));return `${roMonths[i]} ${y}`};
const _dm:Record<string,any>={}; const deb=(k:string,fn:()=>void,ms=200)=>{if(_dm[k])clearTimeout(_dm[k]);_dm[k]=setTimeout(fn,ms)};
const ev=(e:any)=>(e.target as any).value; const pn=(v:any)=>parseFloat((v??"0") as any)||0; const uid=()=> (crypto as any)?.randomUUID?(crypto as any).randomUUID():`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

// ===== config
const rates0={ronPerEur:5,mdlPerEur:19.4};
const cats=["restaurante","diferite chestii","diesel/masina","calatorii/hodina","cheltuieli neprevazute","cheltuieli studio","firma RO+MD","investitii","credite","15% Divid Adrea","15% Divid Valentin","alte"] as const;
const curr=["EUR","RON","MDL"] as const; const src=["Valentin","Adrea","Studio","Altul"] as const;

// ===== storage
const LS="buget-mobile-state-v3"; const load=()=>{try{return JSON.parse(localStorage.getItem(LS)||"null")}catch{return null}}; const save=(s:any)=>localStorage.setItem(LS,JSON.stringify(s));

// ===== cloud (Firestore anon)
// Default Firebase web config (from user) — used when no manual config is provided in Settings.
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDwk-ycTfv1LbsN7KtuI_OWbm4-0RoTmX0",
  authDomain: "bugetjukov.firebaseapp.com",
  projectId: "bugetjukov",
  storageBucket: "bugetjukov.firebasestorage.app",
  messagingSenderId: "1079891521113",
  appId: "1:1079891521113:web:83ffdc9b9604c97f788b48",
  measurementId: "G-RT2SL8B96C"
};

const CLOUD_DEF:any={enabled:true,budgetId:"bugetjukov",cfg:JSON.stringify(DEFAULT_FIREBASE_CONFIG)}; let _app:any=null,_db:any=null,_auth:any=null,_pull=false;
const validFbConfig=(cfg:any)=>!!(cfg&&cfg.apiKey&&cfg.projectId&&cfg.appId);

// Try to parse a Firebase config provided as JSON or as the standard JS snippet.
function parseFirebaseConfig(raw:string){
  if(!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  // Quick try JSON.parse
  try{ return JSON.parse(s); }catch(e){}

  // Try to extract the first object literal {...} by scanning braces to handle nested braces reliably
  const firstBrace = s.indexOf('{');
  if(firstBrace === -1) return null;
  let depth = 0; let end = -1;
  for(let i=firstBrace;i<s.length;i++){
    const ch = s[i];
    if(ch === '{') depth++; else if(ch === '}'){ depth--; if(depth===0){ end = i; break; }}
  }
  if(end===-1) return null;
  const objStr = s.slice(firstBrace, end+1);

  // Try JSON.parse on cleaned string
  try{ return JSON.parse(objStr); }catch(e){}

  // As a last resort, try to evaluate the object literal (runs in client runtime). Wrap in parentheses.
  try{
    // eslint-disable-next-line no-new-func
    const fn = new Function('return (' + objStr + ')');
    const obj = fn();
    return obj && typeof obj === 'object' ? obj : null;
  }catch(e){
    console.error('parseFirebaseConfig failed', e);
    return null;
  }
}

/**
 * Initialize Firebase app and services. Accepts raw JSON/string/object or will fallback to DEFAULT_FIREBASE_CONFIG.
 */
const fbInit=(cfgStrOrObj:any, allowAnon=true)=>{
  try{
    let parsed:any = null;
    // If nothing provided, use the embedded default config
    if(!cfgStrOrObj){ parsed = DEFAULT_FIREBASE_CONFIG; }
    else if(typeof cfgStrOrObj === 'string'){
      parsed = parseFirebaseConfig(cfgStrOrObj) || DEFAULT_FIREBASE_CONFIG;
    }else if(typeof cfgStrOrObj === 'object'){
      parsed = cfgStrOrObj;
    }
    if(!parsed || !validFbConfig(parsed)) return false;
    if(!_app){ _app = initializeApp(parsed); _auth = getAuth(_app); _db = getFirestore(_app); if(allowAnon){ signInAnonymously(_auth).catch(()=>{}); } }
    return true;
  }catch(err){ console.error('fbInit error', err); return false; }
};
const ref=(id:string)=>_db?doc(_db,"budgets",id):null;

// ===== types/helpers
type Tip="venit"|"cheltuiala";
type Plan={id?:string;denumire:string;tip:Tip;subtip?:"Adrea"|"Valentin"|"";categorie?:string;valutaPlan?:"EUR"|"RON"|"MDL";valutaAchitat?:"EUR"|"RON"|"MDL";sumaPlan:number;achitat:number;termen:string;platit?:boolean};
const emptyM=()=>({incomes:[] as any[],expenses:[] as any[],planner:[] as Plan[]});
const migrate=(E:any)=>{if(!E||typeof E!=="object")return E; const out:any={}; for(const k of Object.keys(E)){const M=E[k]||emptyM(); out[k]={incomes:(M.incomes||[]).map((i:any)=>i?.id?i:{...i,id:uid()}), expenses:(M.expenses||[]).map((x:any)=>x?.id?x:{...x,id:uid()}), planner:(M.planner||[]).map((p:any)=>{const vp=p.valutaPlan??(p as any).valuta??"EUR"; const va=p.valutaAchitat??(p as any).valuta??vp; const {valuta,...r}=p||{}; return {...r,id:p.id??uid(),valutaPlan:vp,valutaAchitat:va,categorie:p.categorie||r.categorie||"alte"}})};} return out};
const toE=(a:number|string,c:string,r:{ronPerEur:number;mdlPerEur:number})=>{const n=pn(a); if(c==="EUR")return n; if(c==="RON")return n/(r?.ronPerEur||rates0.ronPerEur); if(c==="MDL")return n/(r?.mdlPerEur||rates0.mdlPerEur); return n};
const isV=(p:Plan)=>p.tip==="venit"; const isC=(p:Plan)=>p.tip==="cheltuiala"; const tipL=(p:Plan)=>isV(p)?"venit":"cheltuială";
const restE=(p:Plan,r:any)=>{const cp=p.valutaPlan||"EUR", ca=p.valutaAchitat||cp, plan=toE(p.sumaPlan||0,cp,r), paid=toE(p.platit?(p.sumaPlan||0):(p.achitat||0), p.platit?cp:ca, r); return Math.max(plan-paid,0)};
const paidE=(p:Plan,r:any)=>{const cp=p.valutaPlan||"EUR", ca=p.valutaAchitat||cp, plan=toE(p.sumaPlan||0,cp,r), paid=toE(p.platit?(p.sumaPlan||0):(p.achitat||0), p.platit?cp:ca, r); return Math.min(paid,plan)};
const sumE=(a:any[])=>a.reduce((s,x)=>s+(x.sumaEUR||0),0); const sumIf=(a:any[],f:(x:any)=>boolean)=>sumE(a.filter(f));
const mkPatch=(mk:string,row:any,idx:number,idPatch:(mk:string,id:string,p:any)=>void,idxPatch:(mk:string,i:number,p:any)=>void)=>(p:any)=>(row?.id?idPatch(mk,row.id,p):idxPatch(mk,idx,p));
const Opt=({list}:{list:any[]})=>(<>{list.map(x=>(<option key={String(x)}>{String(x)}</option>))}</>);

// ===== UI atoms
const Section=({title,children}:{title:string;children:React.ReactNode})=> (<div className="mt-4 bg-white rounded-2xl shadow p-4"><div className="text-lg font-semibold mb-3">{title}</div>{children}</div>);
const KPI=React.memo(({label,value}:{label:string;value:string})=> (<div className="flex flex-col p-3 rounded-xl bg-slate-50"><div className="text-xs text-slate-500">{label}</div><div className="text-2xl font-bold">{value}</div></div>));
const Tabs=({value,onChange,tabs}:{value:string;onChange:(v:string)=>void;tabs:{value:string;label:string}[]})=> (<div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b"><div className="flex overflow-x-auto no-scrollbar">{tabs.map(t=> (<button key={t.value} onClick={()=>onChange(t.value)} className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 ${value===t.value?"border-slate-900 font-semibold":"border-transparent text-slate-500"}`}>{t.label}</button>))}</div></div>);
function useIsMobile(){const [isM,setM]=useState(()=>typeof window!=='undefined' && window.matchMedia? window.matchMedia('(max-width:640px)').matches:false); useEffect(()=>{if(typeof window==='undefined'||!window.matchMedia) return; const mq=window.matchMedia('(max-width:640px)'); const h=(e:any)=>setM(e.matches); mq.addEventListener?.('change',h); mq.addListener?.(h); return()=>{ mq.removeEventListener?.('change',h); mq.removeListener?.(h); }; },[]); return isM; }

const Table=React.memo(function({head,rows,renderRow,emptyText="Nimic de afișat",compact=false}:{head:string[];rows:any[];renderRow:(r:any,i:number)=>React.ReactNode;emptyText?:string;compact?:boolean}){
  const isMobile=useIsMobile();
  if(rows.length===0) return (<div className="px-4 py-6 text-slate-500">{emptyText}</div>);
  if(isMobile){
    return (<div className="card-list">
      {rows.map((r,i)=>(<div key={r.id||i} className="card-row">{/** renderRow produces td elements; we need a compact mobile rendering */}
        {/** For mobile, render a reduced summary: call renderRow into a wrapper and try to extract textContent fallback */}
        <div className="row-field"><div style={{fontWeight:600}}>{String((r.descriere||r.denumire||r.categorie||''))}</div><div style={{fontWeight:600}}>{fm(r.sumaEUR||r.suma||0)}</div></div>
        <div className="row-field"><div className="text-xs text-slate-500">{r.date||r.termen||''}</div><div className="text-xs text-slate-500">{r.valuta||''}</div></div>
      </div>))}
    </div>);
  }
  return (<div className={compact?"overflow-x-hidden table-wrapper":"overflow-x-auto -mx-4 sm:mx-0 touch-pan-x table-wrapper"}><table className={compact?"w-full table-fixed text-sm":"min-w-[1000px] text-sm"}><thead><tr>{head.map(h=>(<th key={h} className="text-left px-4 py-2 bg-slate-50 whitespace-nowrap">{h}</th>))}</tr></thead><tbody>{rows.map((r,i)=>(<tr key={i} className="border-t odd:bg-slate-50/40">{renderRow(r,i)}</tr>))}</tbody></table></div>);
});
const Field=({label,children,className=""}:{label:string;children:React.ReactNode;className?:string})=> (<label className={`text-xs ${className}`}><div className="text-[11px] text-slate-500 mb-1">{label}</div>{children}</label>);

// ===== forms
function IncomeForm({onAdd,rates}:{onAdd:(rec:any)=>void;rates:any}){const[f,sF]=useState({date:ymd(),descriere:"",client:src[0],suma:"",valuta:"EUR"});const eur=useMemo(()=>toE((f as any).suma,(f as any).valuta,rates),[f.suma,f.valuta,rates]);return(<form className="grid grid-cols-2 gap-3" onSubmit={e=>{e.preventDefault();onAdd({...f,suma:pn((f as any).suma),sumaEUR:eur});sF(x=>({...x,descriere:"",client:src[0],suma:""}))}}><Field label="Data"><input type="date" value={(f as any).date} onChange={e=>sF({...f,date:ev(e)})} className="w-full border rounded-xl p-2"/></Field><Field label="Descriere" className="col-span-2"><input value={(f as any).descriere} onChange={e=>sF({...f,descriere:ev(e)})} className="w-full border rounded-xl p-2"/></Field><Field label="Sursă" className="col-span-2"><select value={(f as any).client} onChange={e=>sF({...f,client:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={[...src]}/></select></Field><Field label="Sumă"><input inputMode="decimal" value={(f as any).suma} onChange={e=>sF({...f,suma:ev(e)})} className="w-full border rounded-xl p-2"/></Field><Field label="Valută"><select value={(f as any).valuta} onChange={e=>sF({...f,valuta:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={[...curr]}/></select></Field><div className="col-span-2 text-sm text-slate-600">Sumă EUR (auto): <b>{fm(eur)}</b></div><div className="col-span-2"><button className="w-full py-2 rounded-xl bg-black text-white font-semibold">Adaugă venit</button></div></form>)}
function ExpenseForm({onAdd,rates}:{onAdd:(rec:any)=>void;rates:any}){const[f,sF]=useState({date:ymd(),categorie:cats[0],descriere:"",suma:"",valuta:"EUR",platitor:"Adrea",metoda:"Card Romania"});const eur=useMemo(()=>toE((f as any).suma,(f as any).valuta,rates),[f.suma,f.valuta,rates]);return(<form className="grid grid-cols-2 gap-3" onSubmit={e=>{e.preventDefault();onAdd({...f,suma:pn((f as any).suma),sumaEUR:eur});sF(x=>({...x,descriere:"",suma:""}))}}><Field label="Data"><input type="date" value={(f as any).date} onChange={e=>sF({...f,date:ev(e)})} className="w-full border rounded-xl p-2"/></Field><Field label="Categorie"><select value={(f as any).categorie} onChange={e=>sF({...f,categorie:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={[...cats]}/></select></Field><Field label="Plătitor"><select value={(f as any).platitor} onChange={e=>sF({...f,platitor:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={["Adrea","Valentin","Studio"]}/></select></Field><Field label="Metodă"><select value={(f as any).metoda} onChange={e=>sF({...f,metoda:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={["Card Romania","Card MD","Cash"]}/></select></Field><Field label="Descriere" className="col-span-2"><input value={(f as any).descriere} onChange={e=>sF({...f,descriere:ev(e)})} className="w-full border rounded-xl p-2"/></Field><Field label="Sumă"><input inputMode="decimal" value={(f as any).suma} onChange={e=>sF({...f,suma:ev(e)})} className="w-full border rounded-xl p-2"/></Field><Field label="Valută"><select value={(f as any).valuta} onChange={e=>sF({...f,valuta:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={[...curr]}/></select></Field><div className="col-span-2 text-sm text-slate-600">Sumă EUR (auto): <b>{fm(eur)}</b></div><div className="col-span-2"><button className="w-full py-2 rounded-xl bg-black text-white font-semibold">Adaugă cheltuială</button></div></form>)}
function PlannerForm({onAdd,rates}:{onAdd:(rec:any)=>void;rates:any}){const[f,sF]=useState({denumire:"",tip:"cheltuiala" as Tip,subtip:"" as "Adrea"|"Valentin"|"",categorie:"alte" as string,valutaPlan:"EUR" as any,valutaAchitat:"EUR" as any,sumaPlan:"",achitat:"",termen:ymd(),platit:false});const rest=useMemo(()=>{const plan=toE(pn((f as any).sumaPlan),(f as any).valutaPlan,rates);const paid=toE(pn((f as any).platit?(f as any).sumaPlan:(f as any).achitat),(f as any).platit?(f as any).valutaPlan:(f as any).valutaAchitat,rates);return Math.max(plan-paid,0)},[f.sumaPlan,f.achitat,f.valutaPlan,f.valutaAchitat,f.platit,rates]);return(<form className="grid grid-cols-2 gap-3" onSubmit={e=>{e.preventDefault();const ach=(f as any).platit?pn((f as any).sumaPlan):pn((f as any).achitat);onAdd({...f,sumaPlan:pn((f as any).sumaPlan),achitat:ach});sF({denumire:"",tip:"cheltuiala",subtip:"",categorie:"alte",valutaPlan:"EUR",valutaAchitat:"EUR",sumaPlan:"",achitat:"",termen:ymd(),platit:false})}}><Field label="Denumire" className="col-span-2"><input value={(f as any).denumire} onChange={e=>sF({...f,denumire:ev(e)})} className="w-full border rounded-xl p-2"/></Field><Field label="Tip"><select value={(f as any).tip} onChange={e=>sF({...f,tip:ev(e) as Tip})} className="w-full border rounded-xl p-2"><option value="cheltuiala">cheltuială</option><option value="venit">venit</option></select></Field>{(f as any).tip==="venit"&&(<Field label="Sursă venit"><select value={(f as any).subtip} onChange={e=>sF({...f,subtip:ev(e) as any})} className="w-full border rounded-xl p-2"><option value="">— alege —</option><option value="Adrea">Adrea</option><option value="Valentin">Valentin</option></select></Field>)}{(f as any).tip==="cheltuiala"&&(<Field label="Categorie"><select value={(f as any).categorie} onChange={e=>sF({...f,categorie:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={[...cats]}/></select></Field>)}<Field label="Termen"><input type="date" value={(f as any).termen} onChange={e=>sF({...f,termen:ev(e)})} className="w-full border rounded-xl p-2"/></Field><Field label="Valută plan"><select value={(f as any).valutaPlan} onChange={e=>sF({...f,valutaPlan:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={[...curr]}/></select></Field><Field label="Valută achitat"><select value={(f as any).valutaAchitat} onChange={e=>sF({...f,valutaAchitat:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={[...curr]}/></select></Field><Field label="Sumă planificată"><input inputMode="decimal" value={(f as any).sumaPlan} onChange={e=>sF({...f,sumaPlan:ev(e)})} className="w-full border rounded-xl p-2"/></Field><Field label="Achitat"><input inputMode="decimal" value={(f as any).achitat} onChange={e=>sF({...f,achitat:ev(e)})} className="w-full border rounded-xl p-2"/></Field><div className="col-span-2 flex items-center gap-3 text-sm"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!(f as any).platit} onChange={e=>sF({...f,platit:(e.target as any).checked})}/> Plătit</label><div>Rest EUR (auto): <b>{fm(rest)}</b></div></div><div className="col-span-2"><button type="submit" className="w-full py-2 rounded-xl bg-black text-white font-semibold">Adaugă plan</button></div></form>)}

// ===== tables
const H_EXP=["Data","Categorie","Plătitor","Metodă","Descriere","Valută","Sumă","EUR","🗑️"];
const H_INC=["Data","Sursă","Descriere","Valută","Sumă","EUR","🗑️"];
const H_PLAN=["Denumire","Tip","Sursă/Categorie","Valută plan","Plan","Valută achitat","Achitat","Rest (EUR)","Termen","🗑️"];

// ===== pages
function PageAdd({monthKey,month,addIncome,addExpense,rates,updateIncomeRow,updateIncomeById,deleteIncomeRow,deleteIncomeById,updateExpenseRow,updateExpenseById,deleteExpenseRow,deleteExpenseById}:any){return(<div className="space-y-6">
  <Section title="Sumar total">{(()=>{const v=sumE(month?.incomes||[]),c=sumE(month?.expenses||[]),vAV=sumIf(month?.incomes||[],(i:any)=>i.client==="Adrea"||i.client==="Valentin"),v15=v-0.15*vAV,bal=v-c;return(<div className="grid grid-cols-2 gap-3"><KPI label="Sumar venituri" value={fm(v)}/><KPI label="Sumar cheltuieli" value={fm(c)}/><KPI label="Venituri (-15%)" value={fm(v15)}/><KPI label="Balanță (venit - chelt)" value={fm(bal)}/></div>)})()}</Section>
  <Section title="Sumar pe persoană">{(()=>{const vA=sumIf(month?.incomes||[],(i:any)=>i.client==="Adrea"),vV=sumIf(month?.incomes||[],(i:any)=>i.client==="Valentin"),vS=sumIf(month?.incomes||[],(i:any)=>i.client==="Studio"),cS=sumIf(month?.expenses||[],(e:any)=>e.categorie==="cheltuieli studio"),dA=0.15*vA,dV=0.15*vV,dAp=sumIf(month?.expenses||[],(e:any)=>e.categorie==="15% Divid Adrea"),dVp=sumIf(month?.expenses||[],(e:any)=>e.categorie==="15% Divid Valentin"),sNet=vS-cS;return(<div className="grid grid-cols-2 gap-3"><KPI label="Divid Adrea 15% (plătit/calculat)" value={`${fm(dAp)} / ${fm(dA)}`}/><KPI label="Divid Valentin 15% (plătit/calculat)" value={`${fm(dVp)} / ${fm(dV)}`}/><KPI label="Venit Adrea" value={fm(vA)}/><KPI label="Venit Valentin" value={fm(vV)}/><KPI label="Venit Studio" value={fm(vS)}/><KPI label="Studio net" value={fm(sNet)}/></div>)})()}</Section>
  <Section title="Adaugă cheltuială"><ExpenseForm onAdd={r=>addExpense(monthKey,r)} rates={rates}/></Section>
  <Section title="Ultimele cheltuieli"><Table head={H_EXP} rows={(month?.expenses||[]).slice(0,20)} renderRow={(r:any,idx:number)=>{const up=mkPatch(monthKey,r,idx,updateExpenseById,updateExpenseRow);return(<>
    <td className="px-4 py-2"><input type="date" value={r.date} onChange={e=>up({date:ev(e)})} className="w-[9.5rem] border rounded-lg p-1"/></td>
    <td className="px-4 py-2"><select value={r.categorie} onChange={e=>up({categorie:ev(e)})} className="w-40 border rounded-lg p-1"><Opt list={[...cats]}/></select></td>
    <td className="px-4 py-2"><select value={r.platitor||"Adrea"} onChange={e=>up({platitor:ev(e)})} className="w-36 border rounded-lg p-1"><Opt list={["Adrea","Valentin","Studio"]}/></select></td>
    <td className="px-4 py-2"><select value={r.metoda||"Card Romania"} onChange={e=>up({metoda:ev(e)})} className="w-36 border rounded-lg p-1"><Opt list={["Card Romania","Card MD","Cash"]}/></select></td>
    <td className="px-4 py-2"><input value={r.descriere||""} onInput={e=>deb(`exp-desc-${monthKey}-${r.id??idx}`,()=>up({descriere:ev(e)}),200)} className="w-56 border rounded-lg p-1"/></td>
    <td className="px-4 py-2"><select value={r.valuta} onChange={e=>up({valuta:ev(e)})} className="w-28 border rounded-lg p-1"><Opt list={[...curr]}/></select></td>
    <td className="px-4 py-2"><input inputMode="decimal" value={r.suma} onInput={e=>deb(`exp-suma-${monthKey}-${r.id??idx}`,()=>up({suma:pn(ev(e))}),200)} className="w-28 border rounded-lg p-1"/></td>
    <td className="px-4 py-2 font-semibold">{fm(r.sumaEUR)}</td>
    <td className="px-4 py-2 whitespace-nowrap min-w-[80px]"><button onClick={()=> (r.id?deleteExpenseById:deleteExpenseRow)(monthKey,r.id??idx)} className="px-2 py-1 border rounded-lg">🗑️</button></td>
  </>)}}/></Section>
  <Section title="Adaugă venit"><IncomeForm onAdd={r=>addIncome(monthKey,r)} rates={rates}/></Section>
  <Section title="Ultimele venituri"><Table head={H_INC} rows={(month?.incomes||[]).slice(0,20)} renderRow={(i:any,idx:number)=>{const up=mkPatch(monthKey,i,idx,updateIncomeById,updateIncomeRow);return(<>
    <td className="px-4 py-2"><input type="date" value={i.date} onChange={e=>up({date:ev(e)})} className="w-[9.5rem] border rounded-lg p-1"/></td>
    <td className="px-4 py-2"><select value={i.client} onChange={e=>up({client:ev(e)})} className="w-40 border rounded-lg p-1"><Opt list={[...src]}/></select></td>
    <td className="px-4 py-2"><input value={i.descriere||""} onInput={e=>deb(`inc-desc-${monthKey}-${i.id??idx}`,()=>up({descriere:ev(e)}),200)} className="w-56 border rounded-lg p-1"/></td>
    <td className="px-4 py-2"><select value={i.valuta} onChange={e=>up({valuta:ev(e)})} className="w-28 border rounded-lg p-1"><Opt list={[...curr]}/></select></td>
    <td className="px-4 py-2"><input inputMode="decimal" value={i.suma} onInput={e=>deb(`inc-${monthKey}-${i.id??idx}`,()=>up({suma:pn(ev(e))}),200)} className="w-28 border rounded-lg p-1"/></td>
    <td className="px-4 py-2 font-semibold">{fm(i.sumaEUR)}</td>
    <td className="px-4 py-2"><button onClick={()=> (i.id?deleteIncomeById:deleteIncomeRow)(monthKey,i.id??idx)} className="px-2 py-1 border rounded-lg">🗑️</button></td>
  </>)}}/></Section>
</div>)}

function MonthSummary({month,rates}:{month:any;rates:any}){const v=sumE(month.incomes),c=sumE(month.expenses),sold=v-c,e=v?sold/v:0,d=month.planner.filter((p:Plan)=>isC(p)).reduce((s:number,p:Plan)=>s+restE(p,rates),0),vS=sumIf(month.incomes,(i:any)=>i.client==="Studio"),inv=sumIf(month.expenses,(e:any)=>e.categorie==="investitii"),cred=sumIf(month.expenses,(e:any)=>e.categorie==="credite");return(<><div className="grid grid-cols-2 gap-3"><KPI label="Total venituri" value={fm(v)}/><KPI label="Total cheltuieli" value={fm(c)}/><KPI label="Sold" value={fm(sold)}/><KPI label="Economii (%)" value={fp(e)}/></div><Section title="Indicatori principali"><div className="grid grid-cols-2 gap-3"><KPI label="Venit studio" value={fm(vS)}/><KPI label="Investiții" value={fm(inv)}/><KPI label="Credite" value={fm(cred)}/><KPI label="Cheltuieli obligatorii (planner)" value={fm(d)}/></div></Section></>)}

function PageMonth({monthKey,month,rates,addPlanner,updatePlannerRow,updatePlannerById,deletePlannerRow,deletePlannerById,bulkClosePaid}:any){const[flt,setF]=useState("deschise");const all:Plan[]=(month.planner||[]) as Plan[];const rows=all.filter(p=>{const rest=restE(p,rates);const st=rest===0?"inchise":"deschise";return flt==="toate"?true:st===flt});return(<div className="space-y-6">
  <Section title={`Sumar ${monthKey}`}><MonthSummary month={month} rates={rates}/></Section>
  <Section title="Planner planificat (lunar)">{(()=>{const inM=(p:Plan)=>{const t=p.termen||"",m=t.length>=7?t.slice(0,7):"";return m?m===monthKey:true};const ven=all.filter(p=>isV(p)&&inM(p)),che=all.filter(p=>isC(p)&&inM(p)),rV=ven.reduce((s:number,p:Plan)=>s+restE(p,rates),0),rC=che.reduce((s:number,p:Plan)=>s+restE(p,rates),0),pC=che.reduce((s:number,p:Plan)=>s+paidE(p,rates),0),bal=rV-rC,vM=sumE(month.incomes),cM=sumE(month.expenses),sold=vM-cM;return(<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4"><KPI label="Venit (rămas)" value={fm(rV)}/><KPI label="Cheltuială (rămas)" value={fm(rC)}/><KPI label="Cheltuieli planificate achitate" value={fm(pC)}/><KPI label="Balanță planificată (+ sold)" value={fm(bal+sold)}/></div>)})()}</Section>
  <div className="flex items-center gap-2 mb-3"><label className="text-sm">Filtru<select value={flt} onChange={e=>setF(ev(e))} className="ml-2 border rounded-lg p-1"><option value="toate">Toate</option><option value="deschise">Doar deschise</option><option value="inchise">Doar închise</option></select></label><button type="button" onClick={()=>bulkClosePaid(monthKey)} className="ml-auto px-3 py-2 rounded-xl border">Închide toate achitate</button></div>
  <PlannerForm onAdd={r=>addPlanner(monthKey,r)} rates={rates}/>
  <Table head={H_PLAN} rows={rows} renderRow={(p:Plan)=>{const i=all.indexOf(p);const up=mkPatch(monthKey,p,i,updatePlannerById,updatePlannerRow);const rest=restE(p,rates);return(<>
    <td className="px-4 py-2 truncate whitespace-nowrap min-w-[220px]" title={p.denumire}>{p.denumire}</td>
    <td className="px-4 py-2 whitespace-nowrap min-w-[120px]">{tipL(p)}</td>
    <td className="px-4 py-2 whitespace-nowrap min-w-[140px]">{isV(p)?(p.subtip||"—"):(<select value={p.categorie||"alte"} onChange={e=>up({categorie:ev(e)})} className="w-40 border rounded-lg p-1"><Opt list={[...cats]}/></select>)}</td>
    <td className="px-4 py-2 whitespace-nowrap min-w-[110px]"><select value={p.valutaPlan||"EUR"} onChange={e=>up({valutaPlan:ev(e)})} className="w-28 border rounded-lg p-1"><Opt list={[...curr]}/></select></td>
    <td className="px-4 py-2 whitespace-nowrap min-w-[140px]"><input inputMode="decimal" defaultValue={p.sumaPlan} onInput={e=>deb(`plan-suma-${monthKey}-${p.id??i}`,()=>up({sumaPlan:pn(ev(e))}),200)} className="w-28 border rounded-lg p-1"/></td>
    <td className="px-4 py-2 whitespace-nowrap min-w-[110px]"><select value={p.valutaAchitat||"EUR"} onChange={e=>up({valutaAchitat:ev(e)})} className="w-28 border rounded-lg p-1"><Opt list={[...curr]}/></select></td>
    <td className="px-4 py-2 whitespace-nowrap min-w-[140px]"><input inputMode="decimal" defaultValue={p.achitat} onInput={e=>deb(`plan-achitat-${monthKey}-${p.id??i}`,()=>up({achitat:pn(ev(e))}),200)} className="w-28 border rounded-lg p-1"/></td>
    <td className="px-4 py-2 font-semibold text-right whitespace-nowrap min-w-[120px]">{fm(rest)}</td>
    <td className="px-4 py-2 whitespace-nowrap min-w-[120px]">{p.termen}</td>
    <td className="px-4 py-2"><button onClick={()=> (p.id?deletePlannerById:deletePlannerRow)(monthKey,p.id??i)} className="px-2 py-1 border rounded-lg">🗑️</button></td>
  </>)}}/>
</div>)}

function PageAnnual({entries,rates}:{entries:Record<string,any>;rates:any}){const months=Object.keys(entries).sort();const rows=months.map(m=>{const M=entries[m],v=sumE(M.incomes),c=sumE(M.expenses),sold=v-c,e=v?sold/v:0,vS=sumIf(M.incomes,(i:any)=>i.client==="Studio"),inv=sumIf(M.expenses,(e:any)=>e.categorie==="investitii"),cred=sumIf(M.expenses,(e:any)=>e.categorie==="credite"),d=M.planner.filter((p:Plan)=>isC(p)).reduce((s:number,p:Plan)=>s+restE(p,rates),0);return{m,v,c,sold,e,vS,inv,cred,d}});const tV=rows.reduce((s,r)=>s+r.v,0),tC=rows.reduce((s,r)=>s+r.c,0),tS=tV-tC;return(<Section title="Total anual (EUR)"><div className="grid grid-cols-3 gap-3 mb-3"><KPI label="Venituri an" value={fm(tV)}/><KPI label="Cheltuieli an" value={fm(tC)}/><KPI label="Sold an" value={fm(tS)}/></div><Table head={["Luna","Venituri","Cheltuieli","Sold","Economii %","Venit studio","Investiții","Credite","Datorii rămase"]} rows={rows} renderRow={(r:any)=>(<><td className="px-4 py-2">{r.m}</td><td className="px-4 py-2">{fm(r.v)}</td><td className="px-4 py-2">{fm(r.c)}</td><td className="px-4 py-2 font-semibold">{fm(r.sold)}</td><td className="px-4 py-2">{fp(r.e)}</td><td className="px-4 py-2">{fm(r.vS)}</td><td className="px-4 py-2">{fm(r.inv)}</td><td className="px-4 py-2">{fm(r.cred)}</td><td className="px-4 py-2">{fm(r.d)}</td></>)}/></Section>)}

function PageSettings({rates,setRates,entries,setEntries,backup,setBackup,onBackupNow,cloud,setCloud,pwaReady,installPWA,userEmail,notify,remoteProjects,loadRemoteProject,downloadRemoteProject,exportRemoteProjectToEmail,saveProject,deleteProject,renameProject,addEditor,removeEditor,syncingProjects,cancelInvite}:any){
  const [mergeImport,setMergeImport]=React.useState(true);
  const exportJSON=()=>{const blob=new Blob([JSON.stringify({rates,entries,backup,cloud},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`buget-export-${Date.now()}.json`;a.click();URL.revokeObjectURL(url)};
  const kInc=(i:any)=>[i.date,i.client,i.descriere,i.valuta,i.suma].join('|');
  const kExp=(x:any)=>[x.date,x.categorie,x.platitor,x.metoda,x.descriere,x.valuta,x.suma].join('|');
  const kPlan=(p:any)=>[p.denumire,p.tip,p.subtip||'',p.termen,p.valutaPlan,p.sumaPlan].join('|');
  const mergeEntries=(A:any,B:any)=>{if(!B||typeof B!=="object")return A; const out:any={...A}; for(const mk of Object.keys(B)){const M=A[mk]||{incomes:[],expenses:[],planner:[]}, N=B[mk]||{incomes:[],expenses:[],planner:[]}; const incMap=new Map(M.incomes.map((i:any)=>[kInc(i),i])); const expMap=new Map(M.expenses.map((x:any)=>[kExp(x),x])); const plMap =new Map(M.planner.map((p:any)=>[kPlan(p),p]));
    for(const i of (N.incomes||[])){const key=kInc(i); if(!incMap.has(key)){const ii={id:uid(),...i,sumaEUR:toE(i.suma,i.valuta,rates)}; incMap.set(key,ii);} }
    for(const x of (N.expenses||[])){const key=kExp(x); if(!expMap.has(key)){const xx={id:uid(),...x,sumaEUR:toE(x.suma,x.valuta,rates)}; expMap.set(key,xx);} }
    for(const p of (N.planner||[])){const key=kPlan(p); if(!plMap.has(key)){plMap.set(key,{id:uid(),...p});} }
    out[mk]={incomes:[...incMap.values()],expenses:[...expMap.values()],planner:[...plMap.values()]};
  } return out};
  const importJSON=(f:File)=>{const rd=new FileReader();rd.onload=()=>{try{const d=JSON.parse(rd.result as string); if(d?.rates) setRates(d.rates); if(d?.entries){const src=migrate(d.entries); setEntries((E:any)=> mergeImport? mergeEntries(E,src): src);} if(d?.backup) setBackup(d.backup); if(d?.cloud) setCloud(d.cloud);}catch{}};rd.readAsText(f)};
  const nextText=backup?.enabled&&backup?.nextAt?new Date(backup.nextAt).toLocaleString("ro-RO"):"—";
  const test=()=>{const ok=fbInit(cloud?.cfg||""); if(notify) ok?notify('success','Config valid / autentificat'):notify('error','Config invalid (verifică apiKey, projectId, appId)'); };
  const [inviteEmail,setInviteEmail]=React.useState("");
  const [inviteSending,setInviteSending]=React.useState(false);
  const [inviteProjectId,setInviteProjectId]=React.useState<string|undefined>(undefined);
  const [authEmail,setAuthEmail]=React.useState("");
  const [authPass,setAuthPass]=React.useState("");
  const [authPassConfirm,setAuthPassConfirm]=React.useState("");
  // Ensure settings auto-fill cloud.cfg with the embedded default config when missing
  React.useEffect(()=>{
    try{
      if(!cloud?.cfg){ setCloud((c:any)=>({...c, cfg: JSON.stringify(DEFAULT_FIREBASE_CONFIG)})); }
    }catch(e){}
  // run once when component mounts or when cloud reference changes
  },[cloud?.cfg,setCloud]);
  const sendInvite=async()=>{
    if(!inviteEmail) return notify?notify('error','Introduce email'):(alert('Introduce email'));
    if(!inviteProjectId) return notify?notify('error','Select a project to invite the user into'):(alert('Select a project'));
    if(!cloud?.budgetId) return notify?notify('error','Budget ID is required in settings to store invites.'):(alert('Budget ID is required in settings to store invites.'));
    setInviteSending(true);
    try{
      // Initialize firebase: try cloud cfg first, then fallback to embedded default
      let inited = fbInit(cloud?.cfg);
      if(!inited){ console.warn('fbInit(cloud.cfg) failed, falling back to embedded config'); inited = fbInit(undefined); if(inited){ notify&&notify('info','Using embedded Firebase config fallback'); } }
      if(!inited) throw new Error('Firebase initialization failed (no valid config)');

  // Include projectId in the continue URL so we can attach user to project after sign-in
  const actionCodeSettings = { url: `${window.location.origin}?inviteProject=${encodeURIComponent(inviteProjectId)}`, handleCodeInApp: true };
      if(!(_auth && typeof sendSignInLinkToEmail === 'function')) throw new Error('Firebase Auth not initialized');

      // attempt to send the magic link
      await sendSignInLinkToEmail(_auth, inviteEmail, actionCodeSettings);

      // Store pending invite in Firestore under the specific project document (best-effort)
      try{
        const pDoc = doc(_db,'projects',inviteProjectId);
        if(pDoc){ await setDoc(pDoc,{pendingInvites: arrayUnion(inviteEmail)},{merge:true}); }
      }catch(e){ console.warn('Failed to write invite to Firestore', e); }

      window.localStorage.setItem('buget_invite_email', inviteEmail);
      notify&&notify('success','Invite sent. Check inbox and open the link on the device to sign in.');
      console.log('sendInvite success', {email: inviteEmail, budgetId: cloud.budgetId});
    }catch(e:any){
      console.error('sendInvite error', e);
      // Surface error code/message if available
      const errMsg = e?.code ? `${e.code} - ${e.message||String(e)}` : (e?.message||String(e));
      notify?notify('error',`Invite failed: ${errMsg}`):(alert('Invite failed: '+errMsg));
      // Helpful suggestions for common failures
      console.info('Diagnostics: Ensure Email Link sign-in is enabled in Firebase Console, and that your authorized domains include the app origin.');
    }finally{
      setInviteSending(false);
    }
  };

  

  // Auth helpers
  const registerWithEmail=async()=>{
    try{
      if(!fbInit(cloud?.cfg)) return alert('Config invalid');
      if(!authEmail||!authPass) return notify?notify('error','Introduce email and password'):(alert('Introduce email and password'));
      if(authPass.length<6) return notify?notify('error','Parola trebuie sa aiba minim 6 caractere'):(alert('Parola trebuie sa aiba minim 6 caractere'));
      if(authPass!==authPassConfirm) return notify?notify('error','Confirmarea parolei nu se potrivește'):(alert('Confirmarea parolei nu se potrivește'));
      await createUserWithEmailAndPassword(_auth, authEmail, authPass);
      if(notify) notify('success','Registered and signed in as '+authEmail);
    }catch(e:any){console.error(e); if(notify) notify('error','Register failed: '+(e?.message||e));}
  };
  const loginWithEmail=async()=>{
    try{
      if(!fbInit(cloud?.cfg)) return alert('Config invalid');
      await signInWithEmailAndPassword(_auth, authEmail, authPass);
      if(notify) notify('success','Signed in as '+authEmail);
    }catch(e:any){console.error(e); if(notify) notify('error','Login failed: '+(e?.message||e));}
  };
  const loginWithGoogle=async()=>{
    try{
      if(!fbInit(cloud?.cfg)) return notify?notify('error','Config invalid'):(null);
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(_auth, provider);
    }catch(e:any){console.error(e); if(notify) notify('error','Google sign-in failed: '+(e?.message||e));}
  };
  const resetPassword=async()=>{
    try{
      if(!authEmail) return notify?notify('error','Introduce email pentru reset'):(null);
      if(!fbInit(cloud?.cfg)) return notify?notify('error','Config invalid'):(null);
      await sendPasswordResetEmail(_auth, authEmail);
      if(notify) notify('info','Email pentru reset trimis');
    }catch(e:any){console.error(e); if(notify) notify('error','Reset failed: '+(e?.message||e));}
  };
  const doSignOut=async()=>{
    try{ if(!_auth) return; await signOut(_auth); if(notify) notify('info','Signed out'); }catch(e:any){console.error(e); if(notify) notify('error','Sign out failed: '+(e?.message||e)); }
  };
  const push=async()=>{if(!fbInit(cloud?.cfg))return notify?notify('error','Config invalid'):(null);const r=ref(cloud?.budgetId||"");if(!r)return notify?notify('error','Lipsește budgetId'):(null);await setDoc(r,{rates,entries,backup,updatedAt:Date.now()},{merge:true}); if(notify) notify('success','Trimis în cloud');};
  // Modal state for replacing prompt/confirm flows in Projects
  const [modalOpen,setModalOpen] = React.useState(false);
  const [modalType,setModalType] = React.useState<string| null>(null);
  const [modalProject,setModalProject] = React.useState<any>(null);
  const [modalValue,setModalValue] = React.useState<string>("");
  const [modalBusy,setModalBusy] = React.useState(false);
  const openModal = (type:string, project?:any, initialValue = "")=>{ setModalType(type); setModalProject(project||null); setModalValue(initialValue||""); setModalOpen(true); };
  const closeModal = ()=>{ setModalOpen(false); setModalType(null); setModalProject(null); setModalValue(""); };
  const confirmModal = async()=>{
    if(!modalType) return closeModal();
    // Capture values then close modal immediately to avoid blocking UI
    const type = modalType; const project = modalProject; const value = modalValue;
    closeModal();
    setModalBusy(true);
    try{
      if(type==="rename" && project) await renameProject(project.id, value);
      else if(type==="addEditor" && project) await addEditor(project.id, value);
      else if(type==="removeEditor" && project) await removeEditor(project.id, value);
      else if(type==="delete" && project) await deleteProject(project.id);
      else if(type==="save") await saveProject(undefined, value);
    }catch(e:any){ console.error('confirmModal error', e); notify && notify('error','Acțiune eșuată: '+(e?.message||e)); }
    setModalBusy(false);
  };

  return(<div className="space-y-6">
    <Section title="Curs valutar (bază EUR)"><div className="grid grid-cols-2 gap-3">
      {remoteProjects&&remoteProjects.map((p:any)=>(<div key={p.id} className="flex items-center gap-2">{/** duplicate to add remove editor button below each entry */}</div>))}
      <Field label="RON per 1 EUR"><input inputMode="decimal" value={rates.ronPerEur} onChange={e=>setRates((r:any)=>({...r,ronPerEur:parseFloat((e.target as any).value)||0}))} className="w-full border rounded-xl p-2"/></Field>
      <Field label="MDL per 1 EUR"><input inputMode="decimal" value={rates.mdlPerEur} onChange={e=>setRates((r:any)=>({...r,mdlPerEur:parseFloat((e.target as any).value)||0}))} className="w-full border rounded-xl p-2"/></Field>
    </div></Section>
  <Section title="Sincronizare online (Firebase)"><div className="grid grid-cols-2 gap-3">
      <Field label="Activ"><input type="checkbox" checked={!!cloud.enabled} onChange={e=>setCloud((c:any)=>({...c,enabled:(e.target as any).checked}))}/></Field>
      <Field label="Budget ID"><input value={cloud.budgetId||""} onChange={e=>setCloud((c:any)=>({...c,budgetId:(e.target as any).value}))} className="w-full border rounded-xl p-2" placeholder="ex: buget-familie"/></Field>
  <Field label="Firebase (autofill)" className="col-span-2"><div className="p-2 border rounded-xl text-sm">Using embedded Firebase config. API key: <b style={{wordBreak:'break-all'}}>{DEFAULT_FIREBASE_CONFIG.apiKey}</b><br/>Project: <b>{DEFAULT_FIREBASE_CONFIG.projectId}</b></div></Field>
  <div className="col-span-2 flex gap-3"><button onClick={test} className="px-4 py-2 rounded-xl border">Conectează/Test</button><button onClick={push} className="px-4 py-2 rounded-xl bg-black text-white font-semibold">Salvează remote</button></div>
      <div className="col-span-2 text-xs text-slate-500">Sincronizare în timp real. Politică: ultima scriere câștigă (LWW).</div>
    </div></Section>
    <Section title="Autentificare">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 text-sm">Logged in as: <b>{userEmail||'—'}</b></div>
        {!userEmail && (<>
          <Field label="Email"><input value={authEmail} onChange={e=>setAuthEmail((e.target as any).value)} className="w-full border rounded-xl p-2"/></Field>
          <Field label="Parolă"><input type="password" value={authPass} onChange={e=>setAuthPass((e.target as any).value)} className="w-full border rounded-xl p-2"/></Field>
          <Field label="Confirmă parolă"><input type="password" value={authPassConfirm} onChange={e=>setAuthPassConfirm((e.target as any).value)} className="w-full border rounded-xl p-2"/></Field>
          <div className="col-span-2 flex gap-2"><button onClick={registerWithEmail} className="px-4 py-2 rounded-xl border">Înregistrează</button><button onClick={loginWithEmail} className="px-4 py-2 rounded-xl bg-black text-white">Conectează</button></div>
        </>)}
        {!userEmail ? (
          <div className="col-span-2 flex gap-2"><button onClick={loginWithGoogle} className="px-4 py-2 rounded-xl border">Sign in with Google</button></div>
        ) : (
          <div className="col-span-2 flex gap-2"><button onClick={doSignOut} className="px-4 py-2 rounded-xl">Logout</button></div>
        )}
        <div className="col-span-2 flex gap-2"><button onClick={resetPassword} className="px-4 py-2 rounded-xl border">Reset password</button></div>
      </div>
    </Section>
    <Section title="Backup automat pe e-mail / Import"><div className="grid grid-cols-2 gap-3">
      <Field label="Email destinat"><input value={backup.email||""} onChange={e=>setBackup((b:any)=>({...b,email:(e.target as any).value}))} className="w-full border rounded-xl p-2" placeholder="ex: nume@domeniu.com"/></Field>
      <Field label="Periodicitate"><select value={String(backup.freqDays||1)} onChange={e=>setBackup((b:any)=>({...b,freqDays:parseInt((e.target as any).value)||1}))} className="w-full border rounded-xl p-2"><option value="1">La 1 zi</option><option value="7">La 7 zile</option><option value="30">La 30 zile</option></select></Field>
      <Field label="Activ"><input type="checkbox" checked={!!backup.enabled} onChange={e=>setBackup((b:any)=>({...b,enabled:(e.target as any).checked,nextAt:(e.target as any).checked?(b.nextAt||Date.now()):0}))}/></Field>
      <Field label="Următorul backup (estimativ)" className="col-span-1"><div className="p-2 border rounded-xl text-sm">{nextText}</div></Field>
      <Field label="Import ca adăugare (fără înlocuire)" className="col-span-2"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={mergeImport} onChange={e=>setMergeImport((e.target as any).checked)}/> combină și dedup (după câmpuri cheie)</label></Field>
      <div className="col-span-2 flex gap-3">
        <button onClick={onBackupNow} className="px-4 py-2 rounded-xl bg-black text-white font-semibold">Trimite acum</button>
        <button onClick={exportJSON} className="px-4 py-2 rounded-xl border">Exportă JSON</button>
        <label className="px-4 py-2 rounded-xl border cursor-pointer">Importă JSON<input type="file" accept="application/json" className="hidden" onChange={e=>(e.target as HTMLInputElement).files?.[0]&&importJSON((e.target as HTMLInputElement).files![0])}/></label>
      </div>
    </div></Section>
    <Section title="Instalare pe iPhone (PWA)">
      <div className="space-y-2 text-sm text-slate-700">
        <div className="flex items-center gap-2">
          <button disabled={!pwaReady} onClick={()=>installPWA&&installPWA()} className={`px-4 py-2 rounded-xl ${pwaReady?"bg-black text-white":"border"}`}>{pwaReady?"Instalează (dacă este disponibil)":"Instalare disponibilă pe Android/desktop"}</button>
        </div>
        <div className="text-xs text-slate-500">Pe iPhone: deschide în Safari → Share → <b>Add to Home Screen</b>. (iOS nu afișează buton automat).</div>
      </div>
    </Section>
  <Section title="Invită colaboratori">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Alege proiect" className="col-span-2">
          <select value={inviteProjectId||""} onChange={e=>setInviteProjectId((e.target as any).value||undefined)} className="w-full border rounded-xl p-2">
            <option value="">-- alege proiect --</option>
            {remoteProjects?.map((p:any)=> (<option key={p.id} value={p.id}>{p.name||p.id} {p._fallback? '(Local)':''}</option>))}
            {/* include locally-saved projects from local_projects_v1 */}
            {(()=>{try{const raw=window.localStorage.getItem('local_projects_v1'); if(raw){ const local=JSON.parse(raw) as any[]; return local.filter((x:any)=>x.owner===userEmail).map((p:any)=>(<option key={p.id} value={p.id}>{p.name||p.id} (Local)</option>)); }}catch(e){} return null; })()}
          </select>
        </Field>
        <Field label="Email colaborator" className="col-span-2"><input value={inviteEmail} onChange={e=>setInviteEmail((e.target as any).value)} className="w-full border rounded-xl p-2" placeholder="nume@exemplu.com"/></Field>
  <div className="col-span-2"><button onClick={sendInvite} disabled={inviteSending} className="w-full py-2 rounded-xl bg-black text-white font-semibold">{inviteSending? 'Se trimite...' : 'Trimite invitație'}</button></div>
        <div className="col-span-2 text-xs text-slate-500">Invitația trimite un link magic (email) — acceptarea привилегирует автоматический вход на устройстве получателя.</div>
        <div className="col-span-2"><div className="text-sm">Signed in as: <b>{userEmail||'—'}</b></div></div>
      </div>
    </Section>
    <Section title="Proiecte remote">
      <div className="grid grid-cols-1 gap-3">
        <div className="text-sm text-slate-500">Proiectele tale stocate în cloud. Poți încărca proiectul curent, descărca sau exporta pe email.</div>
          <div className="space-y-2">
          {(!remoteProjects||remoteProjects.length===0) && (<div className="text-slate-500">Nu există proiecte.</div>)}
          {remoteProjects&&remoteProjects.map((p:any)=>(
            <div key={p.id} className="flex items-center gap-2">
              <div className="flex-1">
                <span style={{fontWeight:600}}>{p.name||p.id}</span> <span className="text-xs text-slate-400">({p.id})</span>
                {' '}
                {syncingProjects?.includes(p.id) ? (<span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 ml-2">Syncing…</span>) : p._fallback ? (<span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 ml-2">Local</span>) : (<span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 ml-2">Synced</span>)}
                {Array.isArray(p.pendingInvites) && p.pendingInvites.length>0 && (
                  <div style={{marginTop:6}} className="text-xs text-slate-600">Pending invites:
                    <div className="flex flex-wrap gap-2 mt-1">
                      {p.pendingInvites.map((em:string)=> (
                        <div key={em} className="px-2 py-1 rounded-full bg-yellow-50 text-yellow-800 text-xs flex items-center gap-2">
                          <span>{em}</span>
                          {p.owner===userEmail && (<button onClick={()=>cancelInvite&&cancelInvite(p.id,em)} className="text-xs underline">Cancel</button>)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={()=>loadRemoteProject(p.id)} className="px-3 py-1 rounded-xl border">Load</button>
                <button onClick={()=>downloadRemoteProject(p.id)} className="px-3 py-1 rounded-xl border">Download</button>
                <button onClick={()=>exportRemoteProjectToEmail(p.id, backup.email)} className="px-3 py-1 rounded-xl border">Export→Email</button>
                <button onClick={()=>openModal('rename', p, p.name||p.id)} className="px-3 py-1 rounded-xl border">Rename</button>
                <button onClick={()=>openModal('addEditor', p, '')} className="px-3 py-1 rounded-xl border">Add editor</button>
                <button onClick={()=>openModal('removeEditor', p, '')} className="px-3 py-1 rounded-xl border">Remove editor</button>
                <button onClick={()=>openModal('delete', p, '')} className="px-3 py-1 rounded-xl border text-red-600">Delete</button>
              </div>
            </div>
          ))}
          <div className="mt-3"><button onClick={()=>openModal('save', undefined, '')} className="px-4 py-2 rounded-xl bg-black text-white">Save current as project</button></div>
        </div>
      </div>
    </Section>
    {/* Modal for project actions (rename/add/remove/delete/save) */}
    {modalOpen && (
      <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000}}>
        <div style={{background:'white',padding:20,borderRadius:12,minWidth:320,maxWidth:'90%'}}>
          <div style={{fontWeight:700,marginBottom:8}}>{modalType==='rename'?'Rename project':modalType==='addEditor'?'Add editor':modalType==='removeEditor'?'Remove editor':modalType==='delete'?'Delete project':'Save project'}</div>
          {modalType==='delete' ? (
            <div style={{marginBottom:12}}>Are you sure you want to delete <b>{modalProject?.name||modalProject?.id}</b>?</div>
          ) : (
            <div style={{marginBottom:12}}>
              <input value={modalValue} onChange={e=>setModalValue((e.target as any).value)} placeholder={modalType==='rename'?'New project name':modalType==='addEditor'?'Editor email':modalType==='removeEditor'?'Editor email':''} className="w-full border rounded-xl p-2" />
            </div>
          )}
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button onClick={closeModal} className="px-3 py-2 rounded-xl border" disabled={modalBusy}>Cancel</button>
            <button onClick={confirmModal} className="px-3 py-2 rounded-xl bg-black text-white" disabled={modalBusy}>{modalBusy? 'Așteaptă...' : 'Confirm'}</button>
          </div>
        </div>
      </div>
    )}
  </div>)}

// ===== app
let _pwaEvt:any=null; export default function App(){
  const S=load();
  const[r,setR]=useState(S?.rates||rates0);
  const[E,setE]=useState(migrate(S?.entries)||{[todayYM]:emptyM()});
  const[B,setB]=useState(S?.backup||{email:"",freqDays:1,enabled:false,nextAt:0});
  const[C,setC]=useState(S?.cloud||CLOUD_DEF);
  const [remoteProjects,setRemoteProjects]=useState<Array<any>>([]);
  const [syncingProjects,setSyncingProjects]=useState<string[]>([]);
  const[tab,setTab]=useState("add"); const[pwaReady,setPwaReady]=useState(false);
  const [userEmail,setUserEmail]=useState<string|undefined>(undefined);
  // Notifications (simple toasts)
  const [notifs,setNotifs]=useState<{id:number,type:'info'|'success'|'error',msg:string}[]>([]);
  const pushNotif=(type:'info'|'success'|'error', msg:string, ttl=5000)=>{const id=Date.now()+Math.floor(Math.random()*1000); setNotifs(s=>[...s,{id,type,msg}]); setTimeout(()=>setNotifs(s=>s.filter(x=>x.id!==id)), ttl); };

  // When a user signs-in (via email link or regular), check if their email appears in any project's pendingInvites
  // and if so, add them to editors and remove from pendingInvites. This is in App scope so it can be called
  // right after auth resolves.
  const processPendingInvitesForEmail = async(email?:string)=>{
    if(!email) return;
    try{
      if(!fbInit(C.cfg)) fbInit(undefined);
      if(!_db) return;
      const q = query(collection(_db,'projects'), where('pendingInvites','array-contains', email));
      const snap = await getDocs(q);
      for(const docSnap of snap.docs){
        const pid = docSnap.id; const data:any = docSnap.data();
        const editors = Array.from(new Set([...(data.editors||[]), email]));
        await setDoc(doc(_db,'projects',pid), {editors, pendingInvites: arrayRemove(email)},{merge:true});
        pushNotif('success',`Ai fost adăugat la proiectul ${data.name||pid}`);
        // notify the project owner that the invite was accepted
        try{
          if(data.owner){ await addDoc(collection(_db,'notifications'), {to: data.owner, from: email, projectId: pid, projectName: data.name||pid, type: 'invite_accepted', createdAt: serverTimestamp()}); }
        }catch(e){ console.warn('notify owner failed', e); }
      }
    }catch(e){ console.error('processPendingInvitesForEmail', e); }
  };

  

  // Auth state listener
  useEffect(()=>{
    try{
      if(!fbInit(C.cfg, false)) return; // ensure _auth is set
      const unsub = onAuthStateChanged(_auth, (user:any)=>{
        if(user){ setUserEmail(user.email||user?.providerData?.[0]?.email||undefined); processPendingInvitesForEmail(user.email||user?.providerData?.[0]?.email); }
        else setUserEmail(undefined);
      });
      return ()=>unsub();
    }catch(e){console.error(e)}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Listen for notifications targeted to the signed-in user and show them as toasts
  useEffect(()=>{
    if(!userEmail) return;
    if(!fbInit(C.cfg)) fbInit(undefined);
    if(!_db) return;
    const q = query(collection(_db,'notifications'), where('to','==', userEmail));
    const unsub = onSnapshot(q, async(snap)=>{
      for(const d of snap.docChanges()){
        if(d.type==='added'){
          const n:any = d.doc.data();
          try{ pushNotif('info', n.type==='invite_accepted'? `User ${n.from} accepted invite to project ${n.projectName||n.projectId}` : 'Notification'); }catch(e){}
          try{ await deleteDoc(d.doc.ref); }catch(e){}
        }
      }
    });
    return ()=>unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[userEmail]);

  // local save + cloud push
  useEffect(()=>{const t=setTimeout(()=>{const snap={rates:r,entries:E,backup:B,cloud:C}; save(snap); if(C?.enabled&&C?.budgetId&&fbInit(C?.cfg||"")){const rf=ref(C.budgetId); if(rf&&!_pull)setDoc(rf,{rates:r,entries:E,backup:B,updatedAt:Date.now()},{merge:true});}},250); return()=>clearTimeout(t)},[r,E,B,C]);
  // PWA hooks
  useEffect(()=>{if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{});} const h=(e:any)=>{e.preventDefault(); _pwaEvt=e; setPwaReady(true)}; window.addEventListener('beforeinstallprompt',h); return()=>window.removeEventListener('beforeinstallprompt',h)},[]);
  // Email link auth handling on load
  useEffect(()=>{
    try{
      if(!fbInit(C.cfg, false)) return; // init firebase without anonymous sign-in
      const url = window.location.href;
      if(isSignInWithEmailLink(_auth, url)){
        let savedEmail = window.localStorage.getItem('buget_invite_email');
        // If no saved email (invite sent from another device), prompt the user to input it
        if(!savedEmail){
          try{
            // Use a friendly prompt; user must enter the same email that received the invite
            const entered = window.prompt('Introduceți email-ul folosit pentru invitație (pentru finalizarea autentificării):');
            if(entered && typeof entered === 'string') savedEmail = entered.trim();
          }catch(e){ /* ignore */ }
        }
        if(savedEmail){
          signInWithEmailLink(_auth, savedEmail, url).then((res)=>{ setUserEmail(res.user.email||undefined); pushNotif('success','Signed in as '+(res.user.email||'')); }).catch((e)=>{console.error(e); pushNotif('error','Sign-in failed: '+(e?.message||e));});
        } else {
          // Could not obtain email — inform the user about manual fallback
          pushNotif('info','Nu am găsit e‑mail salvat pentru finalizarea autentificării. Introduceți e‑mailul folosit când vi se cere.');
        }
      }
      // Also check for redirect result (Google redirect sign-in)
      try{
        getRedirectResult(_auth).then((result:any)=>{ if(result && result.user){ setUserEmail(result.user.email||undefined); pushNotif('success','Signed in as '+(result.user.email||'')); }}).catch(()=>{});
      }catch(e){}
    }catch(e){console.error(e)}
  },[]);
  // recalc EUR on rate change
  useEffect(()=>{setE((E0:any)=>{const out:any={}; for(const k of Object.keys(E0||{})){const M=E0[k]||{incomes:[],expenses:[],planner:[]}; out[k]={...M, incomes:(M.incomes||[]).map((i:any)=>({...i,sumaEUR:toE(i.suma,i.valuta,r)})), expenses:(M.expenses||[]).map((x:any)=>({...x,sumaEUR:toE(x.suma,x.valuta,r)}))};} return out});},[r]);
  // cloud subscribe
  useEffect(()=>{ if(!C?.enabled||!C?.budgetId) return; if(!fbInit(C.cfg)) return; const rf=ref(C.budgetId); if(!rf) return; const unsub=onSnapshot(rf,(snap)=>{const d:any=snap.data(); if(!d) return; _pull=true; setR(d.rates||rates0); setE(migrate(d.entries)||{[todayYM]:emptyM()}); setB(d.backup||{email:"",freqDays:1,enabled:false,nextAt:0}); setTimeout(()=>{_pull=false},300)}); return ()=>unsub(); },[C.enabled,C.budgetId,C.cfg]);

  // list remote projects when user signs in
  const listRemoteProjects = async()=>{
    try{
      if(!userEmail) { setRemoteProjects([]); return; }
      if(!fbInit(C.cfg)) { console.warn('fbInit failed while listing projects, trying fallback'); fbInit(undefined); }
      if(!_db){ console.warn('Firestore not initialized'); setRemoteProjects([]); return; }
      const q = query(collection(_db,'projects'), where('owner','==', userEmail));
      const snap = await getDocs(q);
      const arr = snap.docs.map(d=>({id:d.id, ...d.data()}));
      // Merge with any locally-saved projects (local primary)
      try{
        const raw = window.localStorage.getItem('local_projects_v1');
        if(raw){ const local = JSON.parse(raw) as any[]; const mine = (local||[]).filter((p:any)=>p.owner===userEmail); const byId = new Map(arr.map((a:any)=>[a.id,a])); for(const lp of mine){ if(!byId.has(lp.id)) arr.push(lp); else { /* overwrite remote with local if newer */ const remote = byId.get(lp.id); if(lp._fallback && (!remote || (lp.updatedAt>remote.updatedAt))) { const idx = arr.findIndex(a=>a.id===lp.id); if(idx>=0) arr[idx]=lp; } } }
        }
      }catch(e){console.warn('local projects merge failed', e)}
      setRemoteProjects(arr as any[]);
    }catch(e){ console.error('listRemoteProjects error', e); }
  };

  // Replace one-off listing with real-time listeners that update projects for the
  // signed-in user (either owner or editor). Merge with any local fallback projects
  // and clean up listeners on sign-out or settings change.
  const ownerSnapRef = useRef<any>(null);
  const editorSnapRef = useRef<any>(null);

  const rebuildProjectsFromSnapshots = async () => {
    try{
      const docsMap = new Map<string, any>();
      if(ownerSnapRef.current && ownerSnapRef.current.docs){ ownerSnapRef.current.docs.forEach((d:any)=>docsMap.set(d.id, {id:d.id, ...d.data()})); }
      if(editorSnapRef.current && editorSnapRef.current.docs){ editorSnapRef.current.docs.forEach((d:any)=>docsMap.set(d.id, {id:d.id, ...d.data()})); }
      let arr = Array.from(docsMap.values());
      // Merge any local-only projects saved in local_projects_v1
      try{
        const raw = window.localStorage.getItem('local_projects_v1');
        if(raw){ const local = JSON.parse(raw) as any[]; const mine = (local||[]).filter((p:any)=>p.owner===userEmail); const byId = new Map(arr.map((a:any)=>[a.id,a])); for(const lp of mine){ if(!byId.has(lp.id)) arr.push(lp); else { const remote = byId.get(lp.id); if(lp._fallback && (!remote || (lp.updatedAt>remote.updatedAt))){ const idx = arr.findIndex(a=>a.id===lp.id); if(idx>=0) arr[idx]=lp; } } } }
      }catch(e){ console.warn('projects merge local failed', e); }
      setRemoteProjects(arr as any[]);
    }catch(e){ console.error('rebuildProjectsFromSnapshots', e); }
  };

  useEffect(()=>{
    // if cloud sync not enabled or no user, clear and skip
    if(!C?.enabled || !userEmail) { setRemoteProjects([]); return; }
    if(!fbInit(C.cfg)) { console.warn('fbInit failed for projects listener, trying fallback'); fbInit(undefined); }
    if(!_db){ console.warn('Firestore not initialized for projects listener'); return; }

    const qOwner = query(collection(_db,'projects'), where('owner','==', userEmail));
    const qEditor = query(collection(_db,'projects'), where('editors','array-contains', userEmail));

    const unsubOwner = onSnapshot(qOwner, (snap)=>{ ownerSnapRef.current = snap; rebuildProjectsFromSnapshots(); }, (err:any)=>{ console.warn('owner projects onSnapshot error', err); });
    const unsubEditor = onSnapshot(qEditor, (snap)=>{ editorSnapRef.current = snap; rebuildProjectsFromSnapshots(); }, (err:any)=>{ console.warn('editor projects onSnapshot error', err); });

    // initial rebuild in case listeners return quickly
    rebuildProjectsFromSnapshots();

    return ()=>{ try{ unsubOwner(); }catch{} try{ unsubEditor(); }catch{} ownerSnapRef.current=null; editorSnapRef.current=null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[userEmail, C?.enabled, C?.cfg]);

  // Attempt to sync any locally saved projects to remote when online or when auth available
  const trySyncLocalProjects = async()=>{
    try{
      const raw = window.localStorage.getItem('local_projects_v1');
      if(!raw) return;
      const local = JSON.parse(raw) as any[];
      if(!local || local.length===0) return;
      if(!userEmail) return; // only sync for signed-in user
      if(!fbInit(C.cfg)) fbInit(undefined);
      if(!_db) return;
      for(const p of local){
        try{
          // only attempt to sync projects owned by user
          if(p.owner!==userEmail) continue;
          // respect backoff metadata
          const now = Date.now();
          const nextAttempt = p._nextAttempt || 0;
          if(nextAttempt && nextAttempt>now) continue; // skip until nextAttempt
          await attemptSyncProject(p);
        }catch(e){ console.warn('sync project failed', p.id, e); }
      }
      pushNotif('info','Local projects sync attempted');
      await listRemoteProjects();
    }catch(e){ console.error('trySyncLocalProjects', e); }
  };

  useEffect(()=>{ // sync on online
    const onOnline = ()=>{ trySyncLocalProjects(); };
    window.addEventListener('online', onOnline);
    return ()=>window.removeEventListener('online', onOnline);
  },[userEmail,C.cfg]);

  useEffect(()=>{ // attempt sync when userEmail becomes available
    if(userEmail) trySyncLocalProjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[userEmail]);

  // Backoff helper: exponential backoff with jitter
  const calcBackoff = (attempts:number)=>{
    const base = 1000; // 1s
    const max = 60*1000; // 1 minute
    const exp = Math.min(max, base * Math.pow(2, attempts));
    // jitter +/-20%
    const jitter = Math.round(exp * 0.2 * (Math.random()*2 - 1));
    return Math.max(1000, exp + jitter);
  };

  // Attempt to sync a single project with retry metadata persisted locally
  const attemptSyncProject = async(p:any)=>{
    if(!p || !p.id) return;
    const id = p.id;
    // mark syncing
    setSyncingProjects(s=> (s.includes(id)?s:[...s,id]) );
    try{
      if(!fbInit(C.cfg)) fbInit(undefined);
      if(!_db) throw new Error('Firestore not available');
      const docRef = doc(_db,'projects',id);
      await setDoc(docRef, {...p, updatedAt: Date.now(), _syncedAt: Date.now()}, {merge:true});
      // on success, update local storage record
      try{
        const raw = window.localStorage.getItem('local_projects_v1');
        const local = raw? JSON.parse(raw) as any[] : [];
        const idx = local.findIndex((x:any)=>x.id===id);
        if(idx>=0){ local[idx] = {...local[idx], _fallback:false, _attempts:0, _nextAttempt:0, updatedAt: Date.now()}; window.localStorage.setItem('local_projects_v1', JSON.stringify(local)); }
      }catch(e){/* ignore */}
      pushNotif('success','Project synced: '+(p.name||id));
      await listRemoteProjects();
    }catch(e:any){
      console.warn('attemptSyncProject error', id, e);
      // persist retry metadata
      try{
        const raw = window.localStorage.getItem('local_projects_v1');
        const local = raw? JSON.parse(raw) as any[] : [];
        const idx = local.findIndex((x:any)=>x.id===id);
        if(idx>=0){ const cur = local[idx]; const attempts = (cur._attempts||0)+1; const delay = calcBackoff(attempts); cur._attempts=attempts; cur._nextAttempt=Date.now()+delay; local[idx]=cur; window.localStorage.setItem('local_projects_v1', JSON.stringify(local)); }
      }catch(e2){ console.error('save retry metadata failed', e2); }
    }finally{
      setSyncingProjects(s=>s.filter(x=>x!==id));
    }
  };

  const loadRemoteProject = async(projectId:string)=>{
    try{
      if(!fbInit(C.cfg)) fbInit(undefined);
      const d = await getDoc(doc(_db,'projects',projectId));
      if(!d.exists()) return pushNotif('error','Project not found');
      const data:any = d.data();
      // set rates/entries/backup from project doc
      if(data.rates) setR(data.rates);
      if(data.entries) setE(migrate(data.entries));
      if(data.backup) setB(data.backup);
      // set selected cloud project id so user can reference it
      setC((c:any)=>({...c, projectId: projectId, budgetId: projectId}));
      pushNotif('success','Project loaded');
    }catch(e:any){ console.error('loadRemoteProject', e); pushNotif('error','Load failed: '+(e?.message||e)); }
  };

  // Save current local state as a remote project (creates or updates)
  const saveProject = async(projectId?:string, name?:string)=>{
    try{
      if(!userEmail) return pushNotif('error','Trebuie să fii autentificat pentru a salva proiecte');
      if(!fbInit(C.cfg)) fbInit(undefined);
      if(!_db) { pushNotif('error','Firestore not available'); return; }
      // basic validation
      const finalName = (name||`proj-${Date.now().toString(36)}`).trim();
      if(!finalName) return pushNotif('error','Nume invalid');
      const id = projectId|| (name? finalName.replace(/[^a-z0-9_-]/ig,'-').toLowerCase(): `proj-${Date.now().toString(36)}`);
      const docRef = doc(_db,'projects',id);
      const payload = { owner: userEmail, name: finalName||id, rates: r, entries: E, backup: B, updatedAt: Date.now(), editors: [userEmail] };

      // Save locally immediately (primary store)
      try{
        const raw = window.localStorage.getItem('local_projects_v1');
        const local = raw? JSON.parse(raw) as any[] : [];
        const existingIdx = local.findIndex((x:any)=>x.id===id);
        const toSaveLocal = {...payload, id, _fallback:true};
        if(existingIdx>=0) local[existingIdx]=toSaveLocal; else local.push(toSaveLocal);
        window.localStorage.setItem('local_projects_v1', JSON.stringify(local));
        pushNotif('success','Project saved locally');
        // update shown list immediately
        await listRemoteProjects();
      }catch(err:any){ console.error('local save failed', err); pushNotif('error','Local save failed: '+(err?.message||err)); }

      // Enqueue remote sync attempt in background (do not block UI)
      (async function remoteTry(){
        try{
          setSyncingProjects(s=> (s.includes(id)?s:[...s,id]) );
          if(!fbInit(C.cfg)) fbInit(undefined);
          if(!_db) throw new Error('Firestore not available');
          await setDoc(docRef, {...payload, _syncedAt: Date.now()}, {merge:true});
          // on success, remove _fallback flag from local copy
          try{
            const raw2 = window.localStorage.getItem('local_projects_v1');
            const local2 = raw2? JSON.parse(raw2) as any[] : [];
            const idx = local2.findIndex((x:any)=>x.id===id);
            if(idx>=0){ local2[idx] = {...local2[idx], _fallback:false, updatedAt: Date.now()}; window.localStorage.setItem('local_projects_v1', JSON.stringify(local2)); }
          }catch(e){/* ignore */}
          pushNotif('success','Project synced to cloud');
          await listRemoteProjects();
        }catch(e:any){ console.warn('remote sync failed (will keep local):', e); }
        finally{ setSyncingProjects(s=>s.filter(x=>x!==id)); }
      })();
      return id;
    }catch(e:any){ console.error('saveProject', e); pushNotif('error','Save failed: '+(e?.message||e)); }
  };

  const deleteProject = async(projectId:string)=>{
    try{
      if(!userEmail) return pushNotif('error','Trebuie să fii autentificat pentru a șterge proiecte');
      if(!fbInit(C.cfg)) fbInit(undefined);
      // check ownership
      const d = await getDoc(doc(_db,'projects',projectId));
      if(!d.exists()) return pushNotif('error','Project not found');
      const data:any = d.data(); if(data.owner!==userEmail) return pushNotif('error','Only owner can delete the project');
      await deleteDoc(doc(_db,'projects',projectId));
      pushNotif('success','Project deleted');
      listRemoteProjects();
    }catch(e:any){ console.error('deleteProject', e); pushNotif('error','Delete failed: '+(e?.message||e)); }
  };

  const cancelInvite = async(projectId:string, email:string)=>{
    try{
      if(!userEmail) return pushNotif('error','Trebuie să fii autentificat');
      if(!fbInit(C.cfg)) fbInit(undefined);
      const d = await getDoc(doc(_db,'projects',projectId));
      if(!d.exists()) return pushNotif('error','Project not found');
      const data:any = d.data(); if(data.owner!==userEmail) return pushNotif('error','Only owner can cancel invites');
      await setDoc(doc(_db,'projects',projectId), {pendingInvites: arrayRemove(email)},{merge:true});
      pushNotif('success','Invite cancelled');
      // trigger refresh of projects list
      try{ await listRemoteProjects(); }catch{}
    }catch(e:any){ console.error('cancelInvite', e); pushNotif('error','Cancel invite failed: '+(e?.message||e)); }
  };

  const renameProject = async(projectId:string, newName:string)=>{
    try{
      if(!userEmail) return pushNotif('error','Trebuie să fii autentificat');
      if(!fbInit(C.cfg)) fbInit(undefined);
      const d = await getDoc(doc(_db,'projects',projectId));
      if(!d.exists()) return pushNotif('error','Project not found');
      const data:any = d.data(); if(data.owner!==userEmail) return pushNotif('error','Only owner can rename');
      await setDoc(doc(_db,'projects',projectId), {name:newName},{merge:true});
      pushNotif('success','Project renamed');
      listRemoteProjects();
    }catch(e:any){ console.error('renameProject', e); pushNotif('error','Rename failed: '+(e?.message||e)); }
  };

  const addEditor = async(projectId:string, editorEmail:string)=>{
    try{
      if(!userEmail) return pushNotif('error','Trebuie să fii autentificat');
      if(!fbInit(C.cfg)) fbInit(undefined);
      const d = await getDoc(doc(_db,'projects',projectId));
      if(!d.exists()) return pushNotif('error','Project not found');
      const data:any = d.data(); if(data.owner!==userEmail) return pushNotif('error','Only owner can add editors');
      const editors = Array.from(new Set([...(data.editors||[]), editorEmail]));
      await setDoc(doc(_db,'projects',projectId), {editors},{merge:true});
      pushNotif('success','Editor added'); listRemoteProjects();
    }catch(e:any){ console.error('addEditor', e); pushNotif('error','Add editor failed: '+(e?.message||e)); }
  };

  const removeEditor = async(projectId:string, editorEmail:string)=>{
    try{
      if(!userEmail) return pushNotif('error','Trebuie să fii autentificat');
      if(!fbInit(C.cfg)) fbInit(undefined);
      const d = await getDoc(doc(_db,'projects',projectId));
      if(!d.exists()) return pushNotif('error','Project not found');
      const data:any = d.data(); if(data.owner!==userEmail) return pushNotif('error','Only owner can remove editors');
      const editors = (data.editors||[]).filter((e:string)=>e!==editorEmail);
      await setDoc(doc(_db,'projects',projectId), {editors},{merge:true});
      pushNotif('success','Editor removed'); listRemoteProjects();
    }catch(e:any){ console.error('removeEditor', e); pushNotif('error','Remove editor failed: '+(e?.message||e)); }
  };

  const downloadRemoteProject = async(projectId:string)=>{
    try{
      if(!fbInit(C.cfg)) fbInit(undefined);
      const d = await getDoc(doc(_db,'projects',projectId));
      if(!d.exists()) return pushNotif('error','Project not found');
      const data = d.data();
      const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `buget-project-${projectId}.json`; a.click(); URL.revokeObjectURL(url);
      pushNotif('success','Project downloaded');
    }catch(e:any){ console.error('downloadRemoteProject', e); pushNotif('error','Download failed: '+(e?.message||e)); }
  };

  const exportRemoteProjectToEmail = async(projectId:string, toEmail?:string)=>{
    try{
      if(!fbInit(C.cfg)) fbInit(undefined);
      const d = await getDoc(doc(_db,'projects',projectId));
  if(!d.exists()) return pushNotif('error','Project not found');
      const data = d.data();
      const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
      const url = URL.createObjectURL(blob);
      // trigger download and open mailto to instruct attaching file (no SMTP backend here)
      const a = document.createElement('a'); a.href = url; a.download = `buget-project-${projectId}.json`; a.click(); URL.revokeObjectURL(url);
      const subject = encodeURIComponent(`Buget project export: ${projectId}`);
      const body = encodeURIComponent(`Attached is the exported project file for ${projectId}.
Please attach the downloaded file to this email before sending.`);
      const mailto = `mailto:${encodeURIComponent(toEmail||'')}?subject=${subject}&body=${body}`;
      window.open(mailto,'_blank');
      pushNotif('success','Export prepared. Attach the downloaded file to the opened email to send.');
  }catch(e:any){ console.error('exportRemoteProjectToEmail', e); pushNotif('error','Export failed: '+(e?.message||e)); }
  };

  // helpers CRUD
  const ensure=(k:string)=>setE((EE:any)=>({...EE,[k]:EE[k]||emptyM()}));
  type CK="incomes"|"expenses"|"planner"; const get=(M:any,k:CK)=>M?.[k]||[]; const setC2=(E0:any,mk:string,k:CK,next:any[])=>({...E0,[mk]:{...E0[mk],[k]:next}});
  const pIdx=(E0:any,mk:string,k:CK,i:number,p:any)=>{const M=E0[mk]; if(!M) return E0; const next=[...get(M,k)]; next[i]={...next[i],...p}; if(k!=="planner"){const u=next[i]; u.sumaEUR=toE(u.suma,u.valuta,r);} return setC2(E0,mk,k,next)};
  const pId=(E0:any,mk:string,k:CK,id:string,p:any)=>{const M=E0[mk]; if(!M) return E0; const idx=get(M,k).findIndex((x:any)=>x.id===id); return idx<0?E0:pIdx(E0,mk,k,idx,p)};
  const rmIdx=(E0:any,mk:string,k:CK,i:number)=>{const M=E0[mk]; if(!M) return E0; const next=get(M,k).filter((_:any,j:number)=>j!==i); return setC2(E0,mk,k,next)};
  const rmId=(E0:any,mk:string,k:CK,id:string)=>{const M=E0[mk]; if(!M) return E0; const next=get(M,k).filter((x:any)=>x.id!==id); return setC2(E0,mk,k,next)};

  const addIncome=(mk:string,rec:any)=>setE((E0:any)=>{const M=E0[mk]||emptyM(); const r0={id:uid(),...rec,sumaEUR:toE(rec.suma,rec.valuta,r)}; return {...E0,[mk]:{...M,incomes:[r0,...M.incomes]}}});
  const addExpense=(mk:string,rec:any)=>setE((E0:any)=>{const M=E0[mk]||emptyM(); const x0={id:uid(),...rec,sumaEUR:toE(rec.suma,rec.valuta,r)}; return {...E0,[mk]:{...M,expenses:[x0,...M.expenses]}}});
  const addPlanner=(mk:string,rec:any)=>setE((E0:any)=>{const M=E0[mk]||emptyM(); const p0:Plan={id:uid(),...rec}; let nextExp=[...M.expenses]; if(p0.tip==="cheltuiala" && pn(p0.achitat)>0){ const eCur=p0.valutaAchitat||"EUR"; const eur=toE(pn(p0.achitat),eCur,r); const newX={id:uid(),plannerId:p0.id,date:p0.termen,categorie:p0.categorie||"alte",descriere:`[Planner] ${p0.denumire}`,platitor:"Studio",metoda:"Card Romania",valuta:eCur,suma:pn(p0.achitat),sumaEUR:eur}; nextExp=[newX,...nextExp]; } return {...E0,[mk]:{...M,planner:[p0,...M.planner],expenses:nextExp}}});

  const updateIncomeRow=(mk:string,i:number,p:any)=>setE((E0:any)=>pIdx(E0,mk,"incomes",i,p));
  const deleteIncomeRow=(mk:string,i:number)=>setE((E0:any)=>rmIdx(E0,mk,"incomes",i));
  const updateIncomeById=(mk:string,id:string,p:any)=>setE((E0:any)=>pId(E0,mk,"incomes",id,p));
  const deleteIncomeById=(mk:string,id:string)=>setE((E0:any)=>rmId(E0,mk,"incomes",id));
  const updateExpenseRow=(mk:string,i:number,p:any)=>setE((E0:any)=>pIdx(E0,mk,"expenses",i,p));
  const deleteExpenseRow=(mk:string,i:number)=>setE((E0:any)=>rmIdx(E0,mk,"expenses",i));
  const updateExpenseById=(mk:string,id:string,p:any)=>setE((E0:any)=>pId(E0,mk,"expenses",id,p));
  const deleteExpenseById=(mk:string,id:string)=>setE((E0:any)=>rmId(E0,mk,"expenses",id));
  const syncPlan=(E0:any,mk:string,p:Plan)=>{const M=E0[mk]||emptyM(); let ex=[...M.expenses]; const has=(x:any)=>x.plannerId===p.id; const idx=ex.findIndex(has); const need= p.tip==="cheltuiala" && pn(p.achitat)>0; if(!need && idx>=0){ ex=ex.filter((x:any)=>!has(x)); } else if(need){ const eCur=p.valutaAchitat||"EUR"; const eur=toE(pn(p.achitat),eCur,r); const base={plannerId:p.id,date:p.termen,categorie:p.categorie||"alte",descriere:`[Planner] ${p.denumire}`,platitor:"Studio",metoda:"Card Romania",valuta:eCur,suma:pn(p.achitat),sumaEUR:eur}; if(idx>=0) ex[idx]={...ex[idx],...base}; else ex=[{id:uid(),...base},...ex]; } return {...E0,[mk]:{...M,expenses:ex}}};
  const updatePlannerRow=(mk:string,i:number,p:any)=>setE((E0:any)=>{const M=E0[mk]; if(!M) return E0; const cur={...(M.planner||[])[i]} as Plan; const next={...cur,...p} as Plan; let E1=pIdx(E0,mk,"planner",i,p); E1=syncPlan(E1,mk,next); return E1});
  const deletePlannerRow=(mk:string,i:number)=>setE((E0:any)=>rmIdx(E0,mk,"planner",i));
  const updatePlannerById=(mk:string,id:string,p:any)=>setE((E0:any)=>{const M=E0[mk]; if(!M) return E0; const cur=(M.planner||[]).find((x:any)=>x.id===id) as Plan; const next={...cur,...p} as Plan; let E1=pId(E0,mk,"planner",id,p); E1=syncPlan(E1,mk,next); return E1});
  const deletePlannerById=(mk:string,id:string)=>setE((E0:any)=>rmId(E0,mk,"planner",id));
  const bulkClosePaid=(mk:string)=>setE((E0:any)=>{const M=E0[mk]; if(!M) return E0; const next=get(M,"planner").map((p:Plan)=>{const done=(p.achitat||0)>=(p.sumaPlan||0); return done?{...p,platit:true,achitat:(p.sumaPlan||0)}:p}); return setC2(E0,mk,"planner",next)});

  const backupNow=()=>{const blob=new Blob([JSON.stringify({rates:r,entries:E},null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`buget-backup-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`; a.click(); URL.revokeObjectURL(url); if(B?.email){const subject=encodeURIComponent(`Backup buget ${new Date().toLocaleString('ro-RO')}`); const body=encodeURIComponent('Fișierul JSON a fost descărcat automat. Atașează-l și trimite.'); try{window.open(`mailto:${B.email}?subject=${subject}&body=${body}`,'_blank')}catch{}}};
  useEffect(()=>{if(!B.enabled) return; if(!B.nextAt) setB((b:any)=>({...b,nextAt:Date.now()+(b.freqDays||1)*86400000})); const id=setInterval(()=>{if(!B.enabled) return; if(Date.now()>=(B.nextAt||0)){backupNow(); setB((b:any)=>({...b,nextAt:Date.now()+(b.freqDays||1)*86400000}))}},60000); return()=>clearInterval(id)},[B.enabled,B.nextAt,B.freqDays,r,E]);
  // Test helpers and refs (guarded: only enabled in test/e2e mode)
  const entriesRef = useRef(E);
  useEffect(()=>{ entriesRef.current = E; },[E]);
  // determine test mode: query ?e2e=1, runtime flag window.__E2E, or Vite test mode
  const isTestMode = typeof window !== 'undefined' && ( (window as any).__E2E === true || (typeof location !== 'undefined' && location.search.indexOf('e2e=1')>=0) || (import.meta && (import.meta as any).env && (import.meta as any).env.MODE === 'test') );
  useEffect(()=>{
    if(!isTestMode) return;
    try{
      (window as any).__getAppEntries = ()=> entriesRef.current;
      (window as any).__setAppEntries = (v:any)=> { try{ setE(v); }catch(e){} };
      (window as any).__clearUI = ()=> { try{ setE({[todayYM]: emptyM()}); }catch(e){} };
      (window as any).__loadRemoteProject = (id:string)=> { try{ return loadRemoteProject(id); }catch(e){} };
    }catch(e){ console.warn('test helpers registration failed', e); }
    return ()=>{
      try{ delete (window as any).__getAppEntries; delete (window as any).__setAppEntries; delete (window as any).__clearUI; delete (window as any).__loadRemoteProject; }catch(e){}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const months=useMemo(()=>Object.keys(E).sort(),[E]);
  const [mk,setMk]=useState(months[0]||todayYM);
  useEffect(()=>{ if(!E[mk] && months.length){ setMk(months[0]); } },[months,mk,E]);

  const installPWA=()=>{try{ if((_pwaEvt as any)?.prompt){ (_pwaEvt as any).prompt(); _pwaEvt=null; setPwaReady(false);} }catch{}};

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900"><div className="max-w-xl mx-auto p-4">
      <Tabs value={tab} onChange={setTab} tabs={[{value:"add",label:"Adaugă"},{value:"month",label:"Lună"},{value:"annual",label:"Anual"},{value:"settings",label:"Setări"}]}/>
      <Section title="+luna"><div className="flex gap-2 items-center"><select value={mk} onChange={e=>{const v=ev(e); setMk(v); ensure(v)}} className="border rounded-xl p-2">{months.map(m=>(<option key={m} value={m}>{roLabel(m)}</option>))}</select><button onClick={()=>{const y=2025; const pick=prompt("Alege luna (YYYY-MM)",`${y}-${(new Date().getMonth()+1).toString().padStart(2,'0')}`); if(!pick) return; ensure(pick); setMk(pick);}} className="px-3 py-2 rounded-xl border">+luna</button></div></Section>
      {tab==="add"&&E[mk]&&(
        <PageAdd
          monthKey={mk}
          month={E[mk]}
          addIncome={addIncome}
          addExpense={addExpense}
          rates={r}
          updateIncomeRow={updateIncomeRow}
          updateIncomeById={updateIncomeById}
          deleteIncomeRow={deleteIncomeRow}
          deleteIncomeById={deleteIncomeById}
          updateExpenseRow={updateExpenseRow}
          updateExpenseById={updateExpenseById}
          deleteExpenseRow={deleteExpenseRow}
          deleteExpenseById={deleteExpenseById}
        />)}
      {tab==="month"&&E[mk]&&(
        <PageMonth
          monthKey={mk}
          month={E[mk]}
          rates={r}
          addPlanner={addPlanner}
          updatePlannerRow={updatePlannerRow}
          updatePlannerById={updatePlannerById}
          deletePlannerRow={deletePlannerRow}
          deletePlannerById={deletePlannerById}
          bulkClosePaid={bulkClosePaid}
        />
      )}
      {tab==="annual"&&(<PageAnnual entries={E} rates={r}/>)}
      {tab==="settings"&&(
      <PageSettings
          rates={r}
          setRates={setR}
          entries={E}
          setEntries={setE}
          backup={B}
          setBackup={setB}
          onBackupNow={backupNow}
          cloud={C}
          setCloud={setC}
          pwaReady={pwaReady}
          installPWA={installPWA}
        userEmail={userEmail}
        notify={pushNotif}
        remoteProjects={remoteProjects}
        loadRemoteProject={loadRemoteProject}
        downloadRemoteProject={downloadRemoteProject}
        exportRemoteProjectToEmail={exportRemoteProjectToEmail}
          saveProject={saveProject}
          deleteProject={deleteProject}
          renameProject={renameProject}
          addEditor={addEditor}
          removeEditor={removeEditor}
          syncingProjects={syncingProjects}
          cancelInvite={cancelInvite}
        />
      )}
    </div>
    {/* toasts */}
    <div style={{position:'fixed',right:12,top:12,zIndex:9999}}>
      {notifs.map(n=> (
        <div key={n.id} style={{marginBottom:8,background:n.type==='error'?'#fee2e2':n.type==='success'?'#ecfdf5':'#f0f9ff',padding:'8px 12px',borderRadius:8,boxShadow:'0 2px 6px rgba(0,0,0,0.08)'}}>
          <div style={{fontSize:13,fontWeight:600,color:n.type==='error'?'#b91c1c':n.type==='success'?'#065f46':'#0f172a'}}>{n.msg}</div>
        </div>
      ))}
    </div>
    {/* Mobile bottom nav */}
    <div className="bottom-nav">
      <button onClick={()=>setTab('add')} className={tab==='add'?"bg-black text-white":"bg-white"}>Adaugă</button>
      <button onClick={()=>setTab('month')} className={tab==='month'?"bg-black text-white":"bg-white"}>Lună</button>
      <button onClick={()=>setTab('annual')} className={tab==='annual'?"bg-black text-white":"bg-white"}>Anual</button>
      <button onClick={()=>setTab('settings')} className={tab==='settings'?"bg-black text-white":"bg-white"}>Setări</button>
    </div>
    </div>
  );
}
// end of file
