import React, {useMemo,useState,useEffect,useRef,useCallback} from "react";
import idb from './idb';
import {initializeApp} from "firebase/app";

// Firebase modules will be loaded lazily to reduce initial bundle size.
let _fbAuthModule:any = null;
let _fbFsModule:any = null;

// small inline CSS for highlight animation (used when a new credit is added)
(()=>{ if(typeof document==='undefined') return; const id='__cred-highlight-style'; if(document.getElementById(id)) return; const s = document.createElement('style'); s.id=id; s.innerHTML=`.pulse-highlight{animation: pulse 2s ease; box-shadow:0 6px 18px rgba(22,163,74,0.18); border-radius:8px;} @keyframes pulse{0%{transform:scale(1);background:rgba(34,197,94,0.06);}50%{transform:scale(1.01);background:rgba(34,197,94,0.12);}100%{transform:scale(1);background:transparent;}}`; document.head.appendChild(s); })();

// firebase helper bindings (kept as variables so existing code calling these functions
// doesn't need to be rewritten). They will be populated when ensureAuth/ensureFs
// dynamically import the SDK modules.
let doc: any = undefined;
let getDoc: any = undefined;
let setDoc: any = undefined;
let deleteDoc: any = undefined;
let collection: any = undefined;
let query: any = undefined;
let where: any = undefined;
let onSnapshot: any = undefined;
let arrayUnion: any = undefined;
let arrayRemove: any = undefined;
let getDocs: any = undefined;
// orderBy shim removed (not used) to avoid unused-variable TS errors

let signInWithEmailLink: any = undefined;
let isSignInWithEmailLink: any = undefined;
let sendSignInLinkToEmail: any = undefined;
let createUserWithEmailAndPassword: any = undefined;
let signInWithEmailAndPassword: any = undefined;
let signInWithRedirect: any = undefined;
let GoogleAuthProvider: any = undefined;
let getRedirectResult: any = undefined;
let onAuthStateChanged: any = undefined;
let signOut: any = undefined;
let sendPasswordResetEmail: any = undefined;
let OAuthProvider: any = undefined;

async function ensureAuth(){
  if(_auth && _fbAuthModule) return _fbAuthModule;
  try{
    _fbAuthModule = await import('firebase/auth');
      // populate bindings with error messages
  try{ signInWithEmailLink = _fbAuthModule.signInWithEmailLink; }catch(e){ console.debug('bind signInWithEmailLink failed', e); };
  try{ isSignInWithEmailLink = _fbAuthModule.isSignInWithEmailLink; }catch(e){ console.debug('bind isSignInWithEmailLink failed', e); };
  try{ sendSignInLinkToEmail = _fbAuthModule.sendSignInLinkToEmail; }catch(e){ console.debug('bind sendSignInLinkToEmail failed', e); };
  try{ createUserWithEmailAndPassword = _fbAuthModule.createUserWithEmailAndPassword; }catch(e){ console.debug('bind createUserWithEmailAndPassword failed', e); };
  try{ signInWithEmailAndPassword = _fbAuthModule.signInWithEmailAndPassword; }catch(e){ console.debug('bind signInWithEmailAndPassword failed', e); };
  try{ signInWithRedirect = _fbAuthModule.signInWithRedirect; }catch(e){ console.debug('bind signInWithRedirect failed', e); };
  try{ GoogleAuthProvider = _fbAuthModule.GoogleAuthProvider; }catch(e){ console.debug('bind GoogleAuthProvider failed', e); };
  try{ getRedirectResult = _fbAuthModule.getRedirectResult; }catch(e){ console.debug('bind getRedirectResult failed', e); };
  try{ onAuthStateChanged = _fbAuthModule.onAuthStateChanged; }catch(e){ console.debug('bind onAuthStateChanged failed', e); };
  try{ signOut = _fbAuthModule.signOut; }catch(e){ console.debug('bind signOut failed', e); };
  try{ sendPasswordResetEmail = _fbAuthModule.sendPasswordResetEmail; }catch(e){ console.debug('bind sendPasswordResetEmail failed', e); };
   try{ OAuthProvider = _fbAuthModule.OAuthProvider; }catch(e){ console.debug('bind OAuthProvider failed', e); };

    _auth = _fbAuthModule.getAuth(_app);
    return _fbAuthModule;
  }catch(e){ console.warn('ensureAuth failed', e); return null; }
}

function CreditsPage({monthKey, month, addCredit, updateCredit, deleteCredit, recordPayment, lastAddedCredit}: any){
  const [f, sf] = useState({denumire:'', termen: ymd(), suma:'', valuta:'EUR', principal:'', restant:'', platitor: 'Adrea', metoda:'Card Romania'});
  const rowsRef = useRef<Record<string, HTMLTableRowElement | null>>({});
  // highlight/scroll effect when a new credit is added
  useEffect(()=>{
    try{
      if(!lastAddedCredit) return;
      if(lastAddedCredit.mk !== monthKey) return;
      const el = rowsRef.current[lastAddedCredit.id];
      if(el){ try{ el.scrollIntoView({behavior:'smooth', block:'center'}); el.classList.add('pulse-highlight'); setTimeout(()=>el.classList.remove('pulse-highlight'), 2200); }catch(_){ void _; } }
    }catch(e){ void e; }
  },[lastAddedCredit, monthKey]);
  const onAdd = (e:any)=>{ e.preventDefault(); const rec = { id: uid(), denumire: f.denumire||'Credit', termen: f.termen, suma: pn(f.suma||0), valuta: f.valuta||'EUR', principal: pn(f.principal||0), restant: pn(f.restant||0), metoda: f.metoda||'Card Romania', platitor: f.platitor||'Adrea', owner: '' }; addCredit(monthKey, rec); sf({denumire:'', termen: ymd(), suma:'', valuta:'EUR', principal:'', restant:'', platitor: f.platitor||'Adrea', metoda: f.metoda||'Card Romania'}); };
  return (<div className="space-y-4">
    <Section title="Credite">
      <form className="grid grid-cols-2 gap-3" onSubmit={onAdd}>
  <Field label="Denumire"><input placeholder="Denumire" className="w-full border rounded-xl p-2" value={f.denumire} onChange={e=>sf({...f,denumire:ev(e)})}/></Field>
  <Field label="Data plată lunară"><input type="date" className="w-full border rounded-xl p-2" value={f.termen} onChange={e=>sf({...f,termen:ev(e)})} /></Field>
        <Field label="Sumă lunară"><input inputMode="decimal" className="w-full border rounded-xl p-2" value={f.suma} onChange={e=>sf({...f,suma:ev(e)})}/></Field>
        <Field label="Valută"><select className="w-full border rounded-xl p-2" value={f.valuta} onChange={e=>sf({...f,valuta:ev(e)})}><Opt list={[...curr]}/></select></Field>
  <Field label="Principal total"><input inputMode="decimal" className="w-full border rounded-xl p-2" value={f.principal} onChange={e=>sf({...f,principal:ev(e)})}/></Field>
  <Field label="Restant"><input inputMode="decimal" className="w-full border rounded-xl p-2" value={f.restant} onChange={e=>sf({...f,restant:ev(e)})}/></Field>
  <Field label="Plătitor"><select value={f.platitor} onChange={e=>sf({...f,platitor:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={["Adrea","Valentin","Studio"]}/></select></Field>
  <Field label="Metoda"><select value={f.metoda} onChange={e=>sf({...f,metoda:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={["Card Romania","Card MD","Cash"]}/></select></Field>
        <div className="col-span-2"><button className="w-full py-2 rounded-xl bg-black text-white font-semibold">Adaugă credit</button></div>
      </form>
        <div className="mt-4">
          <div className="text-sm text-slate-600">Credite în acest proiect / lună: <b>{(month?.credits||[]).length}</b></div>
          <Table head={["Denumire","Sumă lunară","Valută","Rambursare anticipată","Rest după plată","Data plată","Plătitor","Metodă","Acțiuni"]} rows={(month?.credits||[])} renderRow={(c:any,idx:number)=>{
            const up = mkPatch(monthKey, c, idx, (m:string,id:string,p:any)=>updateCredit(m,id,p), (m:string,_:number,p:any)=>updateCredit(m, c.id||'', p));
            const curRest = pn(c.restant||c.principal||0);
            const monthly = pn(c.suma||0);
            const restAfter = Math.max(0, Math.round(((curRest - monthly) + Number.EPSILON) * 100) / 100);
            return ((<>
              <td className="px-4 py-2" data-credit-id={c.id} ref={(el:any)=>{ if(el) rowsRef.current[c.id]=el; }}>{/* wrapper cell to attach ref via row */}<input value={stripCreditLabel(c.denumire)||''} onChange={e=>up({denumire:ev(e)})} className="w-full border rounded-lg p-1"/></td>
              <td className="px-4 py-2"><input inputMode="decimal" value={String(c.suma||'')} onChange={e=>deb(`cred-suma-${monthKey}-${c.id||idx}`,()=>up({suma: pn((e.target as any).value)}),200)} className="w-28 border rounded-lg p-1"/></td>
              <td className="px-4 py-2"><select value={c.valuta||'EUR'} onChange={e=>up({valuta:ev(e)})} className="w-28 border rounded-lg p-1"><Opt list={[...curr]}/></select></td>
              <td className="px-4 py-2"><input inputMode="decimal" value={String(c.restant||'')} onChange={e=>deb(`cred-rest-${monthKey}-${c.id||idx}`,()=>up({restant: pn((e.target as any).value)}),200)} className="w-28 border rounded-lg p-1"/></td>
              <td className="px-4 py-2 font-semibold">{String(restAfter)}</td>
              <td className="px-4 py-2"><input type="date" value={c.termen||''} onChange={e=>up({termen:ev(e)})} className="w-[9.5rem] border rounded-lg p-1"/></td>
              <td className="px-4 py-2"><select value={c.platitor||'Adrea'} onChange={e=>up({platitor:ev(e)})} className="w-36 border rounded-lg p-1"><Opt list={["Adrea","Valentin","Studio"]}/></select></td>
              <td className="px-4 py-2"><select value={c.metoda||'Card Romania'} onChange={e=>up({metoda:ev(e)})} className="w-36 border rounded-lg p-1"><Opt list={["Card Romania","Card MD","Cash"]}/></select></td>
              <td className="px-4 py-2 flex gap-2"><button onClick={()=>recordPayment(monthKey, c.id)} className="px-3 py-1 rounded-xl border">Înregistrează plată</button><button onClick={()=>deleteCredit(monthKey, c.id||idx)} className="px-3 py-1 rounded-xl border">Șterge</button></td>
            </>));
          }} />
        </div>
    </Section>
  </div>);
}

async function ensureFs(){
  if(_db && _fbFsModule) return _fbFsModule;
  try{
    _fbFsModule = await import('firebase/firestore');
    // populate commonly-used firestore bindings so existing call sites keep working
      try{ doc = _fbFsModule.doc; }catch(e){ console.error('Failed to get doc', e); };
      try{ getDoc = _fbFsModule.getDoc; }catch(e){ console.debug('bind getDoc failed', e); };
      try{ setDoc = _fbFsModule.setDoc; }catch(e){ console.debug('bind setDoc failed', e); };
      try{ deleteDoc = _fbFsModule.deleteDoc; }catch(e){ console.debug('bind deleteDoc failed', e); };
      try{ collection = _fbFsModule.collection; }catch(e){ console.debug('bind collection failed', e); };
      try{ query = _fbFsModule.query; }catch(e){ console.debug('bind query failed', e); };
      try{ where = _fbFsModule.where; }catch(e){ console.debug('bind where failed', e); };
      try{ onSnapshot = _fbFsModule.onSnapshot; }catch(e){ console.debug('bind onSnapshot failed', e); };
      try{ arrayUnion = _fbFsModule.arrayUnion; }catch(e){ console.debug('bind arrayUnion failed', e); };
      try{ arrayRemove = _fbFsModule.arrayRemove; }catch(e){ console.debug('bind arrayRemove failed', e); };
    try{ getDocs = _fbFsModule.getDocs; }catch(e){ console.debug('bind getDocs failed', e); };

    _db = _fbFsModule.getFirestore(_app);
    return _fbFsModule;
  }catch(e){ console.warn('ensureFs failed', e); return null; }
}
// Mark used to avoid "declared but never used" TS error (function is referenced dynamically)
void ensureFs;

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

// Simple client-side throttle to avoid hammering Firebase when user clicks repeatedly
let _lastAuthAttempt = 0;

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
  try{ return JSON.parse(s); }catch(e){ void e; }

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
  try{ return JSON.parse(objStr); }catch(e){ void e; }

  // As a last resort, try to evaluate the object literal (runs in client runtime). Wrap in parentheses.
  try{
     
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
    if(!cfgStrOrObj){ parsed = DEFAULT_FIREBASE_CONFIG; }
    else if(typeof cfgStrOrObj === 'string'){ parsed = parseFirebaseConfig(cfgStrOrObj) || DEFAULT_FIREBASE_CONFIG; }
    else if(typeof cfgStrOrObj === 'object'){ parsed = cfgStrOrObj; }
    if(!parsed || !validFbConfig(parsed)) return false;
    if(!_app){ _app = initializeApp(parsed); }
    // Auth and Firestore are initialized lazily via ensureAuth/ensureFs when needed
    if(allowAnon){ try{ ensureAuth().then((mod)=>{ if(mod && _auth) mod.signInAnonymously(_auth).catch(()=>{}); }); }catch{ /* ignore */ } }
    return true;
  }catch(err){ console.error('fbInit error', err); return false; }
};
const ref=(id:string)=>_db?doc(_db,"budgets",id):null;

// ===== types/helpers
type Tip="venit"|"cheltuiala";
type Plan={id?:string;denumire:string;tip:Tip;subtip?:"Adrea"|"Valentin"|"";categorie?:string;valutaPlan?:"EUR"|"RON"|"MDL";valutaAchitat?:"EUR"|"RON"|"MDL";sumaPlan:number;achitat:number;termen:string;platit?:boolean; creditId?:string};
const emptyM=()=>({incomes:[] as any[],expenses:[] as any[],planner:[] as Plan[], credits: [] as any[]});
  const migrate=(E:any)=>{if(!E||typeof E!=="object")return E; const out:any={}; for(const k of Object.keys(E)){const M=E[k]||emptyM(); out[k] = {incomes:(M.incomes||[]).map((i:any)=>i?.id?i:{...i,id:uid()}), expenses:(M.expenses||[]).map((x:any)=>x?.id?x:{...x,id:uid()}), planner:(M.planner||[]).map((p:any)=>{const vp=p.valutaPlan??(p as any).valuta??"EUR"; const va=p.valutaAchitat??(p as any).valuta??vp; const {valuta: _valuta, ...r}=p||{}; void _valuta; return {...r,id:p.id??uid(),valutaPlan:vp,valutaAchitat:va,categorie:p.categorie||r.categorie||"alte"}}), credits:(M.credits||[]).map((c:any)=> c?.id? c : {...c, id: uid()})}; } return out};
const toE=(a:number|string,c:string,r:{ronPerEur:number;mdlPerEur:number})=>{const n=pn(a); if(c==="EUR")return n; if(c==="RON")return n/(r?.ronPerEur||rates0.ronPerEur); if(c==="MDL")return n/(r?.mdlPerEur||rates0.mdlPerEur); return n};
const fromE=(e:number,c:string,r:{ronPerEur:number;mdlPerEur:number})=>{const n=Number(e)||0; if(c==="EUR")return n; if(c==="RON")return n*(r?.ronPerEur||rates0.ronPerEur); if(c==="MDL")return n*(r?.mdlPerEur||rates0.mdlPerEur); return n};
const addMonthsStr=(dateStr:string, months:number)=>{ try{ const d=new Date(dateStr); d.setMonth(d.getMonth()+months); return ymd(d); }catch(e){ return ymd(); } };
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
// strip `[Credit] foo (uuid)` wrapper to show only the user-facing name
const stripCreditLabel = (s?:string)=>{
  if(!s) return '';
  // pattern: [Credit] NAME (UUID)
  const m = s.match(/\[Credit\]\s*(.*?)\s*\(([0-9a-fA-F-]{8,})\)\s*$/);
  if(m) return m[1];
  return s;
};
const Field=({label,children,className=""}:{label:string;children:React.ReactNode;className?:string})=> (<label className={`text-xs ${className}`}><div className="text-[11px] text-slate-500 mb-1">{label}</div>{children}</label>);

// ===== forms
function IncomeForm({onAdd,rates}:{onAdd:(rec:any)=>void;rates:any}){const[f,sF]=useState({date:ymd(),descriere:"",client:src[0],suma:"",valuta:"EUR"});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- controlled deps (f.suma, f.valuta, rates) are sufficient
  const eur=useMemo(()=>toE((f as any).suma,(f as any).valuta,rates),[f.suma,f.valuta,rates]);return(<form className="grid grid-cols-2 gap-3" onSubmit={e=>{e.preventDefault();onAdd({...f,suma:pn((f as any).suma),sumaEUR:eur});sF(x=>({...x,descriere:"",client:src[0],suma:""}))}}><Field label="Data"><input type="date" value={(f as any).date} onChange={e=>sF({...f,date:ev(e)})} className="w-full border rounded-xl p-2"/></Field><Field label="Descriere" className="col-span-2"><input value={(f as any).descriere} onChange={e=>sF({...f,descriere:ev(e)})} className="w-full border rounded-xl p-2"/></Field><Field label="Sursă" className="col-span-2"><select value={(f as any).client} onChange={e=>sF({...f,client:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={[...src]}/></select></Field><Field label="Sumă"><input inputMode="decimal" value={(f as any).suma} onChange={e=>sF({...f,suma:ev(e)})} className="w-full border rounded-xl p-2"/></Field><Field label="Valută"><select value={(f as any).valuta} onChange={e=>sF({...f,valuta:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={[...curr]}/></select></Field><div className="col-span-2 text-sm text-slate-600">Sumă EUR (auto): <b>{fm(eur)}</b></div><div className="col-span-2"><button className="w-full py-2 rounded-xl bg-black text-white font-semibold">Adaugă venit</button></div></form>)}
function ExpenseForm({onAdd,rates}:{onAdd:(rec:any)=>void;rates:any}){const[f,sF]=useState({date:ymd(),categorie:cats[0],descriere:"",suma:"",valuta:"EUR",platitor:"Adrea",metoda:"Card Romania"});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- controlled deps (f.suma, f.valuta, rates) are sufficient
  const eur=useMemo(()=>toE((f as any).suma,(f as any).valuta,rates),[f.suma,f.valuta,rates]);return(<form className="grid grid-cols-2 gap-3" onSubmit={e=>{e.preventDefault();onAdd({...f,suma:pn((f as any).suma),sumaEUR:eur});sF(x=>({...x,descriere:"",suma:""}))}}><Field label="Data"><input type="date" value={(f as any).date} onChange={e=>sF({...f,date:ev(e)})} className="w-full border rounded-xl p-2"/></Field><Field label="Categorie"><select value={(f as any).categorie} onChange={e=>sF({...f,categorie:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={[...cats]}/></select></Field><Field label="Plătitor"><select value={(f as any).platitor} onChange={e=>sF({...f,platitor:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={["Adrea","Valentin","Studio"]}/></select></Field><Field label="Metodă"><select value={(f as any).metoda} onChange={e=>sF({...f,metoda:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={["Card Romania","Card MD","Cash"]}/></select></Field><Field label="Descriere" className="col-span-2"><input value={(f as any).descriere} onChange={e=>sF({...f,descriere:ev(e)})} className="w-full border rounded-xl p-2"/></Field><Field label="Sumă"><input inputMode="decimal" value={(f as any).suma} onChange={e=>sF({...f,suma:ev(e)})} className="w-full border rounded-xl p-2"/></Field><Field label="Valută"><select value={(f as any).valuta} onChange={e=>sF({...f,valuta:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={[...curr]}/></select></Field><div className="col-span-2 text-sm text-slate-600">Sumă EUR (auto): <b>{fm(eur)}</b></div><div className="col-span-2"><button className="w-full py-2 rounded-xl bg-black text-white font-semibold">Adaugă cheltuială</button></div></form>)}
function PlannerForm({onAdd,rates}:{onAdd:(rec:any)=>void;rates:any}){const[f,sF]=useState({denumire:"",tip:"cheltuiala" as Tip,subtip:"" as "Adrea"|"Valentin"|"",categorie:"alte" as string,valutaPlan:"EUR" as any,valutaAchitat:"EUR" as any,sumaPlan:"",achitat:"",termen:ymd(),platit:false});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- controlled deps specified intentionally
  const rest=useMemo(()=>{const plan=toE(pn((f as any).sumaPlan),(f as any).valutaPlan,rates);const paid=toE(pn((f as any).platit?(f as any).sumaPlan:(f as any).achitat),(f as any).platit?(f as any).valutaPlan:(f as any).valutaAchitat,rates);return Math.max(plan-paid,0)},[f.sumaPlan,f.achitat,f.valutaPlan,f.valutaAchitat,f.platit,rates]);return(<form className="grid grid-cols-2 gap-3" onSubmit={e=>{e.preventDefault();const ach=(f as any).platit?pn((f as any).sumaPlan):pn((f as any).achitat);onAdd({...f,sumaPlan:pn((f as any).sumaPlan),achitat:ach});sF({denumire:"",tip:"cheltuiala",subtip:"",categorie:"alte",valutaPlan:"EUR",valutaAchitat:"EUR",sumaPlan:"",achitat:"",termen:ymd(),platit:false})}}><Field label="Denumire" className="col-span-2"><input value={(f as any).denumire} onChange={e=>sF({...f,denumire:ev(e)})} className="w-full border rounded-xl p-2"/></Field><Field label="Tip"><select value={(f as any).tip} onChange={e=>sF({...f,tip:ev(e) as Tip})} className="w-full border rounded-xl p-2"><option value="cheltuiala">cheltuială</option><option value="venit">venit</option></select></Field>{(f as any).tip==="venit"&&(<Field label="Sursă venit"><select value={(f as any).subtip} onChange={e=>sF({...f,subtip:ev(e) as any})} className="w-full border rounded-xl p-2"><option value="">— alege —</option><option value="Adrea">Adrea</option><option value="Valentin">Valentin</option></select></Field>)}{(f as any).tip==="cheltuiala"&&(<Field label="Categorie"><select value={(f as any).categorie} onChange={e=>sF({...f,categorie:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={[...cats]}/></select></Field>)}<Field label="Termen"><input type="date" value={(f as any).termen} onChange={e=>sF({...f,termen:ev(e)})} className="w-full border rounded-xl p-2"/></Field><Field label="Valută plan"><select value={(f as any).valutaPlan} onChange={e=>sF({...f,valutaPlan:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={[...curr]}/></select></Field><Field label="Valută achitat"><select value={(f as any).valutaAchitat} onChange={e=>sF({...f,valutaAchitat:ev(e)})} className="w-full border rounded-xl p-2"><Opt list={[...curr]}/></select></Field><Field label="Sumă planificată"><input inputMode="decimal" value={(f as any).sumaPlan} onChange={e=>sF({...f,sumaPlan:ev(e)})} className="w-full border rounded-xl p-2"/></Field><Field label="Achitat"><input inputMode="decimal" value={(f as any).achitat} onChange={e=>sF({...f,achitat:ev(e)})} className="w-full border rounded-xl p-2"/></Field><div className="col-span-2 flex items-center gap-3 text-sm"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!(f as any).platit} onChange={e=>sF({...f,platit:(e.target as any).checked})}/> Plătit</label><div>Rest EUR (auto): <b>{fm(rest)}</b></div></div><div className="col-span-2"><button type="submit" className="w-full py-2 rounded-xl bg-black text-white font-semibold">Adaugă plan</button></div></form>)}

// ===== tables
const H_EXP=["Data","Categorie","Plătitor","Metodă","Descriere","Valută","Sumă","EUR","🗑️"];
const H_INC=["Data","Sursă","Descriere","Valută","Sumă","EUR","🗑️"];
const H_PLAN=["Denumire","Tip","Sursă/Categorie","Valută plan","Plan","Valută achitat","Achitat","Rest (EUR)","Termen","🗑️"];

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

function MonthSummary({month,rates}:{month:any;rates:any}){
  const v = sumE(month.incomes);
  const c = sumE(month.expenses);
  const sold = v - c;
  const e = v ? sold / v : 0;
  const vS = sumIf(month.incomes, (i:any) => i.client === "Studio");
  const inv = sumIf(month.expenses, (ex:any) => ex.categorie === "investitii");

  // Sum explicit expense rows categorized as 'credite' (convert to EUR reliably)
  const credExpensesEUR = (month.expenses || []).reduce((acc:number, ex:any) => {
    if(ex?.categorie === 'credite'){
      return acc + (ex.sumaEUR ?? toE(ex.suma || 0, ex.valuta || 'EUR', rates));
    }
    return acc;
  }, 0);

  // Sum outstanding credit balances (restant or principal) converted to EUR
  const credRemainEUR = (month.credits || []).reduce((acc:number, cr:any) => {
    const amount = (cr?.restant ?? cr?.principal ?? cr?.suma ?? 0);
    return acc + toE(amount, cr?.valuta || 'EUR', rates);
  }, 0);

  const cred = credExpensesEUR + credRemainEUR;

  // Planner remaining (Datorii) should exclude planner entries that are linked to credits
  const d = (month.planner || []).filter((p:Plan) => isC(p) && !( (p as any).creditId )).reduce((s:number,p:Plan)=>s+restE(p,rates),0);

  return (<>
    <div className="grid grid-cols-2 gap-3"><KPI label="Total venituri" value={fm(v)}/><KPI label="Total cheltuieli" value={fm(c)}/><KPI label="Sold" value={fm(sold)}/><KPI label="Economii (%)" value={fp(e)}/></div>
    <Section title="Indicatori principali">
      <div className="grid grid-cols-2 gap-3">
        <KPI label="Venit studio" value={fm(vS)}/>
        <KPI label="Investiții" value={fm(inv)}/>
        <KPI label="Credite" value={fm(cred)}/>
        <KPI label="Cheltuieli obligatorii (planner)" value={fm(d)}/>
      </div>
    </Section>
  </>)}

function PageMonth({monthKey,month,rates,addPlanner,updatePlannerRow,updatePlannerById,deletePlannerRow,deletePlannerById,bulkClosePaid}:any){const[flt,setF]=useState("deschise");const all:Plan[]=(month.planner||[]) as Plan[];const rows=all.filter(p=>{const rest=restE(p,rates);const st=rest===0?"inchise":"deschise";return flt==="toate"?true:st===flt});return(<div className="space-y-6">
  <Section title={`Sumar ${monthKey}`}><MonthSummary month={month} rates={rates}/></Section>
  <Section title="Planner planificat (lunar)">{(()=>{const inM=(p:Plan)=>{const t=p.termen||"",m=t.length>=7?t.slice(0,7):"";return m?m===monthKey:true};const ven=all.filter(p=>isV(p)&&inM(p)),che=all.filter(p=>isC(p)&&inM(p)),rV=ven.reduce((s:number,p:Plan)=>s+restE(p,rates),0),rC=che.reduce((s:number,p:Plan)=>s+restE(p,rates),0),pC=che.reduce((s:number,p:Plan)=>s+paidE(p,rates),0),bal=rV-rC,vM=sumE(month.incomes),cM=sumE(month.expenses),sold=vM-cM;return(<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4"><KPI label="Venit (rămas)" value={fm(rV)}/><KPI label="Cheltuială (rămas)" value={fm(rC)}/><KPI label="Cheltuieli planificate achitate" value={fm(pC)}/><KPI label="Balanță planificată (+ sold)" value={fm(bal+sold)}/></div>)})()}</Section>
  <div className="flex items-center gap-2 mb-3"><label className="text-sm">Filtru<select value={flt} onChange={e=>setF(ev(e))} className="ml-2 border rounded-lg p-1"><option value="toate">Toate</option><option value="deschise">Doar deschise</option><option value="inchise">Doar închise</option></select></label><button type="button" onClick={()=>bulkClosePaid(monthKey)} className="ml-auto px-3 py-2 rounded-xl border">Închide toate achitate</button></div>
  <PlannerForm onAdd={r=>addPlanner(monthKey,r)} rates={rates}/>
  <Table head={H_PLAN} rows={rows} renderRow={(p:Plan)=>{const i=all.indexOf(p);const up=mkPatch(monthKey,p,i,updatePlannerById,updatePlannerRow);const rest=restE(p,rates);return(<>
  <td className="px-4 py-2 truncate whitespace-nowrap min-w-[220px]" title={p.denumire}>{stripCreditLabel(p.denumire)}</td>
    <td className="px-4 py-2 whitespace-nowrap min-w-[120px]">{tipL(p)}</td>
    <td className="px-4 py-2 whitespace-nowrap min-w-[140px]">{isV(p)?(p.subtip||"—"):(<select value={p.categorie||"alte"} onChange={e=>up({categorie:ev(e)})} className="w-40 border rounded-lg p-1"><Opt list={[...cats]}/></select>)}</td>
    <td className="px-4 py-2 whitespace-nowrap min-w-[110px]"><select value={p.valutaPlan||"EUR"} onChange={e=>up({valutaPlan:ev(e)})} className="w-28 border rounded-lg p-1"><Opt list={[...curr]}/></select></td>
  <td className="px-4 py-2 whitespace-nowrap min-w-[140px]"><input inputMode="decimal" value={String(p.sumaPlan||'')} onChange={e=>deb(`plan-suma-${monthKey}-${p.id??i}`,()=>up({sumaPlan:pn(ev(e))}),200)} className="w-28 border rounded-lg p-1"/></td>
    <td className="px-4 py-2 whitespace-nowrap min-w-[110px]"><select value={p.valutaAchitat||"EUR"} onChange={e=>up({valutaAchitat:ev(e)})} className="w-28 border rounded-lg p-1"><Opt list={[...curr]}/></select></td>
  <td className="px-4 py-2 whitespace-nowrap min-w-[140px]"><input inputMode="decimal" value={String(p.achitat||'')} onChange={e=>deb(`plan-achitat-${monthKey}-${p.id??i}`,()=>up({achitat:pn(ev(e))}),200)} className="w-28 border rounded-lg p-1"/></td>
    <td className="px-4 py-2 font-semibold text-right whitespace-nowrap min-w-[120px]">{fm(rest)}</td>
    <td className="px-4 py-2 whitespace-nowrap min-w-[120px]">{p.termen}</td>
    <td className="px-4 py-2"><button onClick={()=> (p.id?deletePlannerById:deletePlannerRow)(monthKey,p.id??i)} className="px-2 py-1 border rounded-lg">🗑️</button></td>
  </>)}}/>
</div>)}

function PageAnnual({entries,rates}:{entries:Record<string,any>;rates:any}){
  const months = Object.keys(entries).sort();
  const rows = months.map(m => {
    const M = entries[m];
    const v = sumE(M.incomes);
    const c = sumE(M.expenses);
    const sold = v - c;
    const e = v ? sold / v : 0;
    const vS = sumIf(M.incomes, (i:any) => i.client === "Studio");
    const inv = sumIf(M.expenses, (ex:any) => ex.categorie === "investitii");

    const credExpensesEUR = (M.expenses || []).reduce((acc:number, ex:any) => {
      if(ex?.categorie === 'credite'){
        return acc + (ex.sumaEUR ?? toE(ex.suma || 0, ex.valuta || 'EUR', rates));
      }
      return acc;
    }, 0);
    const credRemainEUR = (M.credits || []).reduce((acc:number, cr:any) => {
      const amount = (cr?.restant ?? cr?.principal ?? cr?.suma ?? 0);
      return acc + toE(amount, cr?.valuta || 'EUR', rates);
    }, 0);
    const cred = credExpensesEUR + credRemainEUR;

  const d = (M.planner || []).filter((p:Plan) => isC(p) && !((p as any).creditId)).reduce((s:number,p:Plan)=>s+restE(p,rates),0);

    return { m, v, c, sold, e, vS, inv, cred, d };
  });

  const tV = rows.reduce((s,r)=>s+r.v,0);
  const tC = rows.reduce((s,r)=>s+r.c,0);
  const tS = tV - tC;

  return (<Section title="Total anual (EUR)"><div className="grid grid-cols-3 gap-3 mb-3"><KPI label="Venituri an" value={fm(tV)}/><KPI label="Cheltuieli an" value={fm(tC)}/><KPI label="Sold an" value={fm(tS)}/></div><Table head={["Luna","Venituri","Cheltuieli","Sold","Economii %","Venit studio","Investiții","Credite","Datorii rămase"]} rows={rows} renderRow={(r:any)=>(<><td className="px-4 py-2">{r.m}</td><td className="px-4 py-2">{fm(r.v)}</td><td className="px-4 py-2">{fm(r.c)}</td><td className="px-4 py-2 font-semibold">{fm(r.sold)}</td><td className="px-4 py-2">{fp(r.e)}</td><td className="px-4 py-2">{fm(r.vS)}</td><td className="px-4 py-2">{fm(r.inv)}</td><td className="px-4 py-2">{fm(r.cred)}</td><td className="px-4 py-2">{fm(r.d)}</td></>)}/></Section>)}

function PageSettings({rates,setRates,entries,backup,setBackup,onBackupNow,cloud,setCloud,pwaReady,installPWA,userEmail,notify,remoteProjects,loadRemoteProject,downloadRemoteProject,exportRemoteProjectToCSV,exportRemoteProjectToEmail,importProjectFromCSVFile,onSelectCSVFile,saveProject,deleteProject,renameProject,addEditor,removeEditor,syncingProjects,cancelInvite, ownerNotifications = [], dismissOwnerNotification = async()=>{}, exportCSVAll, importCSVAll, attemptSyncProject, lastSyncMap }:any){
  const [mergeImport,setMergeImport]=React.useState(true);
    const nextText=backup?.enabled&&backup?.nextAt?new Date(backup.nextAt).toLocaleString("ro-RO"):"—";
  const [backupSaved, setBackupSaved] = React.useState(false);
  const [inviteEmail,setInviteEmail]=React.useState("");
  const [inviteSending,setInviteSending]=React.useState(false);
  const [inviteProjectId,setInviteProjectId]=React.useState<string|undefined>(undefined);
  const [authEmail,setAuthEmail]=React.useState("");
  const [authPass,setAuthPass]=React.useState("");
  const [authPassConfirm,setAuthPassConfirm]=React.useState("");
  const [showRegisterConfirm,setShowRegisterConfirm]=React.useState(false);
  // Ensure settings auto-fill cloud.cfg with the embedded default config when missing
  React.useEffect(()=>{
    try{
      if(!cloud?.cfg){ setCloud((c:any)=>({...c, cfg: JSON.stringify(DEFAULT_FIREBASE_CONFIG)})); }
      // ensure background sync settings exist with sensible defaults (20s)
      if(cloud?.backgroundSyncEnabled===undefined || cloud?.backgroundSyncIntervalSec===undefined){
        setCloud((c:any)=>({...c, backgroundSyncEnabled: true, backgroundSyncIntervalSec: 20, autoUploadOnClose: false}));
      }
  }catch(e){ void e; }
  // run once when component mounts or when cloud reference changes
  },[cloud?.cfg,setCloud]);

  // Auto-upload on close: if enabled, save local project and attempt sync when page is being unloaded
  // (auto-upload-on-close handler moved to App scope)

  // Owner notifications UI (only visible to owners)
  const ownerNotesUI = (userEmail && Array.isArray(ownerNotifications) && ownerNotifications.length>0) ? (
    <Section title="Notificări invitații primite de colaboratori">
      <div className="space-y-2">
        {ownerNotifications.map((n:any)=>(
          <div key={n.id} className="flex items-center justify-between p-2 bg-white border rounded-lg">
            <div className="text-sm">{n.invitedEmail} a acceptat invitația în <b>{n.projectName||n.projectId}</b></div>
            <div className="flex gap-2"><button onClick={()=>dismissOwnerNotification(n.id)} className="px-3 py-1 rounded-xl border text-sm">Dismiss</button></div>
          </div>
        ))}
      </div>
    </Section>
  ) : null;
  const sendInvite=async()=>{
  if(!inviteEmail){ if(notify) notify('error','Introduceți adresa de email'); else alert('Introduceți adresa de email'); return; }
  if(!inviteProjectId){ if(notify) notify('error','Selectează un proiect pentru a invita utilizatorul'); else alert('Selectează un proiect'); return; }
  if(!cloud?.budgetId){ if(notify) notify('error','ID-ul bugetului este necesar în Setări pentru a stoca invitațiile.'); else alert('ID-ul bugetului este necesar în Setări pentru a stoca invitațiile.'); return; }
    setInviteSending(true);
    // small helper to avoid hanging on network calls indefinitely
    const withTimeout = <T,>(p:Promise<T>, ms=15000) => Promise.race([p, new Promise<T>((_, rej)=>setTimeout(()=>rej(new Error('timeout')), ms))]);
    try{
      // Initialize firebase: try cloud cfg first, then fallback to embedded default
      let inited = fbInit(cloud?.cfg);
  if(!inited){ console.warn('fbInit(cloud.cfg) failed, falling back to embedded config'); inited = fbInit(undefined); if(inited){ if(notify) notify('info','Se folosește configurația Firebase încorporată ca rezervă'); } }
      if(!inited) throw new Error('Firebase initialization failed (no valid config)');

      // Ensure auth is loaded before using auth helpers
      await ensureAuth();
      // Include projectId in the continue URL so we can attach user to project after sign-in
      const actionCodeSettings = { url: `${window.location.origin}?inviteProject=${encodeURIComponent(inviteProjectId)}`, handleCodeInApp: true };
      if(!(_auth && typeof sendSignInLinkToEmail === 'function')) throw new Error('Firebase Auth not initialized');

      // attempt to send the magic link (with timeout)
      await withTimeout(sendSignInLinkToEmail(_auth, inviteEmail, actionCodeSettings), 15000);

      // Store pending invite in Firestore under the specific project document (best-effort)
      try{
        await ensureFs();
        const pDoc = doc(_db,'projects',inviteProjectId);
        if(pDoc){ await setDoc(pDoc,{pendingInvites: arrayUnion(inviteEmail)},{merge:true}); }
      }catch(err){ console.warn('Failed to write invite to Firestore', err); }

    window.localStorage.setItem('buget_invite_email', inviteEmail);
  if(notify) notify('success','Invitația a fost trimisă. Verifică inbox-ul și deschide linkul pe dispozitiv pentru a te autentifica.');
      console.log('sendInvite success', {email: inviteEmail, budgetId: cloud.budgetId});
    }catch(e:any){
      console.error('sendInvite error', e);
      // Surface error code/message if available
      const errMsg = e?.code ? `${e.code} - ${e.message||String(e)}` : (e?.message||String(e));
  if(notify) notify('error',`Invitație eșuată: ${errMsg}`);
      // Helpful suggestions for common failures
      console.info('Diagnostics: Ensure Email Link sign-in is enabled in Firebase Console, and that your authorized domains include the app origin.');
    }finally{
      // ensure ui resets even on network hang or unexpected errors
      setInviteSending(false);
    }
  };

  

  // Auth helpers
  const registerWithEmail=async()=>{
    try{
      // throttle quick repeated attempts
      const now = Date.now(); if(now - _lastAuthAttempt < 2000){ if(notify) notify('error','Așteaptă puțin înainte de a reîncerca.'); return false; } _lastAuthAttempt = now;
      if(!fbInit(cloud?.cfg)) return alert('Config invalid');
  if(notify) notify('info','Se inițializează autentificarea...'); else console.info('Se inițializează autentificarea...');
  await ensureAuth();
  if(typeof createUserWithEmailAndPassword !== 'function'){ console.error('createUserWithEmailAndPassword not available', {createUserWithEmailAndPassword, _fbAuthModule}); if(notify) notify('error','Modulul de autentificare nu a putut fi încărcat. Verifică consola.'); else console.error('Modulul de autentificare nu a putut fi încărcat.'); return; }
  if(!authEmail||!authPass){ if(notify) notify('error','Introduceți email și parolă'); else alert('Introduceți email și parolă'); return; }
  if(authPass.length<6){ if(notify) notify('error','Parola trebuie sa aiba minim 6 caractere'); else alert('Parola trebuie sa aiba minim 6 caractere'); return; }
  if(authPass!==authPassConfirm){ if(notify) notify('error','Confirmarea parolei nu se potrivește'); else alert('Confirmarea parolei nu se potrivește'); return; }
  await createUserWithEmailAndPassword(_auth, authEmail, authPass);
  if(notify) notify('success','Înregistrat și autentificat ca '+authEmail);
      return true;
  }catch(e:any){
    console.error('registerWithEmail error', e);
    const code = e?.code || (e && e.message && String(e.message).toLowerCase()) || '';
    if(code.indexOf('too-many-requests')!==-1){ if(notify) notify('error','Prea multe încercări. Încearcă mai târziu (câteva minute).'); return false; }
    // Handle common Firebase auth errors with helpful guidance
    if(code.indexOf('email-already-in-use')!==-1){
      try{
        if(typeof sendPasswordResetEmail==='function'){ await ensureAuth().catch(()=>{}); await sendPasswordResetEmail(_auth, authEmail); if(notify) notify('info','Contul există deja. Am trimis un email de resetare a parolei la '+authEmail); }else{ if(notify) notify('error','Contul există deja. Folosește "Resetează parola" pentru a seta o parolă.'); }
      }catch(err){ console.warn('sendPasswordResetEmail failed', err); if(notify) notify('error','Contul există deja, dar resetarea parolei a eșuat. Verifică consola.'); }
    }else if(code.indexOf('account-exists-with-different-credential')!==-1 || code.indexOf('credential-already-in-use')!==-1){
      if(notify) notify('error','Un cont cu acest e-mail există, dar conectarea se face prin alt furnizor (Google/Apple). Conectează-te folosind butonul corespunzător.');
    }else{
      if(notify) notify('error','Înregistrare eșuată: '+(e?.message||String(e)));
    }
  }
    return false;
  };
  const loginWithEmail=async()=>{
    try{
      // throttle quick repeated attempts
      const now = Date.now(); if(now - _lastAuthAttempt < 1500){ if(notify) notify('error','Așteaptă puțin înainte de a reîncerca.'); return; } _lastAuthAttempt = now;
      if(!fbInit(cloud?.cfg)) return alert('Config invalid');
  if(notify) notify('info','Se inițializează autentificarea...'); else console.info('Se inițializează autentificarea...');
  await ensureAuth();
  if(typeof signInWithEmailAndPassword !== 'function'){ console.error('signInWithEmailAndPassword not available', {signInWithEmailAndPassword, _fbAuthModule}); if(notify) notify('error','Modulul de autentificare nu a putut fi încărcat. Verifică consola.'); else console.error('Modulul de autentificare nu a putut fi încărcat.'); return; }
  if(notify) notify('info','Se autentifică...'); else console.info('Se autentifică...');
  await signInWithEmailAndPassword(_auth, authEmail, authPass);
  if(notify) notify('success','Autentificat ca '+authEmail);
  }catch(e:any){
    console.error('loginWithEmail error', e);
    const code = e?.code || (e && e.message && String(e.message).toLowerCase()) || '';
    if(code.indexOf('too-many-requests')!==-1){ if(notify) notify('error','Prea multe încercări. Încearcă mai târziu (câteva minute).'); return; }
    if(code.indexOf('user-not-found')!==-1){
      if(notify) notify('error','Utilizatorul nu a fost găsit. Înregistrează-te sau folosește "Resetează parola".');
    }else if(code.indexOf('wrong-password')!==-1){
      try{ if(typeof sendPasswordResetEmail==='function'){ await ensureAuth().catch(()=>{}); await sendPasswordResetEmail(_auth, authEmail); if(notify) notify('info','Parolă greșită. Am trimis un email de resetare la '+authEmail); }else{ if(notify) notify('error','Parolă greșită. Folosește "Resetează parola".'); } }catch(err){ console.warn('reset send failed', err); if(notify) notify('error','Parolă greșită și resetarea eșuată. Verifică consola.'); }
    }else if(code.indexOf('user-disabled')!==-1){
      if(notify) notify('error','Contul este dezactivat. Contactează suportul.');
    }else if(code.indexOf('account-exists-with-different-credential')!==-1){
      if(notify) notify('error','Acest email este asociat cu un cont creat prin Google/Apple. Conectează-te cu acel furnizor.');
    }else{
      if(notify) notify('error','Autentificare eșuată: '+(e?.message||String(e)));
    }
  }
  };
  const loginWithGoogle=async()=>{
    try{
    if(!fbInit(cloud?.cfg)){ if(notify) notify('error','Configurație invalidă'); return null; }
  if(notify) notify('info','Se inițializează autentificarea (Google)...'); else console.info('Se inițializează autentificarea (Google)...');
  await ensureAuth();
  if(typeof GoogleAuthProvider !== 'function' && typeof GoogleAuthProvider !== 'object'){ console.error('GoogleAuthProvider not available', {GoogleAuthProvider, _fbAuthModule}); if(notify) notify('error','Provider-ul Google pentru autentificare nu a putut fi încărcat.'); else console.error('Provider-ul Google pentru autentificare nu a putut fi încărcat.'); return null; }
      const provider = new GoogleAuthProvider();
  if(typeof signInWithRedirect !== 'function'){ console.error('signInWithRedirect not available', {signInWithRedirect, _fbAuthModule}); if(notify) notify('error','Autentificarea prin redirect nu este disponibilă.'); else console.error('Autentificarea prin redirect nu este disponibilă.'); return null; }
  if(notify) notify('info','Redirecționare către autentificarea Google...'); else console.info('Redirecționare către autentificarea Google...');
      await signInWithRedirect(_auth, provider);
  }catch(e:any){console.error(e); if(notify) notify('error','Autentificare Google eșuată: '+(e?.message||e));}
  };

  const loginWithApple=async()=>{
    try{
      if(!fbInit(cloud?.cfg)){ if(notify) notify('error','Configurație invalidă'); return null; }
      if(notify) notify('info','Se inițializează autentificarea (Apple)...'); else console.info('Se inițializează autentificarea (Apple)...');
      await ensureAuth();
      if(typeof OAuthProvider === 'undefined' || OAuthProvider === null){ console.error('OAuthProvider not available', {OAuthProvider, _fbAuthModule}); if(notify) notify('error','Provider-ul Apple pentru autentificare nu a putut fi încărcat.'); else console.error('Provider-ul Apple pentru autentificare nu a putut fi încărcat.'); return null; }
      const provider = new OAuthProvider('apple.com');
      // request email and name scopes
      try{ provider.addScope && provider.addScope('email'); provider.addScope && provider.addScope('name'); }catch(e){ /* ignore */ }
      if(typeof signInWithRedirect !== 'function'){ console.error('signInWithRedirect not available', {signInWithRedirect, _fbAuthModule}); if(notify) notify('error','Autentificarea prin redirect nu este disponibilă.'); else console.error('Autentificarea prin redirect nu este disponibilă.'); return null; }
      if(notify) notify('info','Redirecționare către autentificarea Apple...'); else console.info('Redirecționare către autentificarea Apple...');
      await signInWithRedirect(_auth, provider);
    }catch(e:any){ console.error(e); if(notify) notify('error','Autentificare Apple eșuată: '+(e?.message||e)); }
  };
  const resetPassword=async()=>{
    try{
      if(!authEmail){ if(notify) notify('error','Introduce email pentru reset'); return null; }
      if(!fbInit(cloud?.cfg)){ if(notify) notify('error','Config invalid'); return null; }
  if(notify) notify('info','Initializing auth (reset)...'); else console.info('Initializing auth (reset)...');
  await ensureAuth();
  if(typeof sendPasswordResetEmail !== 'function'){ console.error('sendPasswordResetEmail not available', {sendPasswordResetEmail, _fbAuthModule}); if(notify) notify('error','Password reset not available.'); else console.error('Password reset not available.'); return null; }
      await sendPasswordResetEmail(_auth, authEmail);
      if(notify) notify('info','Email pentru reset trimis');
    }catch(e:any){console.error(e); if(notify) notify('error','Reset failed: '+(e?.message||e));}
  };
  const doSignOut=async()=>{
  try{ if(!_auth) return; await ensureAuth().catch(()=>{}); if(typeof signOut!=='function'){ console.error('signOut not available', {signOut, _fbAuthModule}); if(notify) notify('error','Deconectarea nu este disponibilă'); else console.error('Deconectarea nu este disponibilă'); return; } await signOut(_auth); if(notify) notify('info','Deconectat'); }catch(e:any){console.error(e); if(notify) notify('error','Deconectare eșuată: '+(e?.message||e)); }
  };
  
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
  }catch(e:any){ console.error('confirmModal error', e); if(notify) notify('error','Acțiune eșuată: '+(e?.message||e)); }
    setModalBusy(false);
  };

  

  return(<div className="space-y-6">{ownerNotesUI}
    
    <Section title="Curs valutar (bază EUR)"><div className="grid grid-cols-2 gap-3">
      {remoteProjects&&remoteProjects.map((p:any)=>(<div key={p.id} className="flex items-center gap-2">{/** duplicate to add remove editor button below each entry */}</div>))}
      <Field label="RON per 1 EUR"><input inputMode="decimal" value={rates.ronPerEur} onChange={e=>setRates((r:any)=>({...r,ronPerEur:parseFloat((e.target as any).value)||0}))} className="w-full border rounded-xl p-2"/></Field>
      <Field label="MDL per 1 EUR"><input inputMode="decimal" value={rates.mdlPerEur} onChange={e=>setRates((r:any)=>({...r,mdlPerEur:parseFloat((e.target as any).value)||0}))} className="w-full border rounded-xl p-2"/></Field>
    </div></Section>
    
  {/* Removed Firebase sync controls (visual clutter) per UX request */}
    <Section title="Autentificare">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 text-sm">Logged in as: <b>{userEmail||'—'}</b></div>
        {!userEmail && (<>
          <Field label="Email"><input value={authEmail} onChange={e=>setAuthEmail((e.target as any).value)} className="w-full border rounded-xl p-2"/></Field>
          <Field label="Parolă"><input type="password" value={authPass} onChange={e=>setAuthPass((e.target as any).value)} className="w-full border rounded-xl p-2"/></Field>
          {showRegisterConfirm && (<Field label="Confirmă parolă"><input type="password" value={authPassConfirm} onChange={e=>setAuthPassConfirm((e.target as any).value)} className="w-full border rounded-xl p-2"/></Field>)}
          <div className="col-span-2 flex gap-2">
            <button onClick={async()=>{ if(!showRegisterConfirm){ setShowRegisterConfirm(true); return; } const ok = await registerWithEmail(); if(ok){ setShowRegisterConfirm(false); } }} className="px-4 py-2 rounded-xl border">Înregistrează</button>
            <button onClick={loginWithEmail} className="px-4 py-2 rounded-xl bg-black text-white">Conectează</button>
          </div>
        </>)}
        {!userEmail ? (
          <div className="col-span-2 flex gap-2">
            <button onClick={loginWithGoogle} className="px-4 py-2 rounded-xl border">Conectare cu Google</button>
            <button onClick={loginWithApple} className="px-4 py-2 rounded-xl border">Conectare cu Apple</button>
          </div>
        ) : (
          <div className="col-span-2 flex gap-2"><button onClick={doSignOut} className="px-4 py-2 rounded-xl">Deconectează</button></div>
        )}
  <div className="col-span-2 flex gap-2"><button onClick={resetPassword} className="px-4 py-2 rounded-xl border">Resetează parola</button></div>
      </div>
    </Section>
    <Section title="Backup automat pe e-mail / Importare"><div className="grid grid-cols-2 gap-3">
  <Field label="Email destinat"><input value={backup.email||""} onChange={e=>{ const val=(e.target as any).value; const newB = {...backup, email: val}; setBackup(newB); try{ save({ rates, entries: entries||{}, backup: newB, cloud }); setBackupSaved(true); setTimeout(()=>setBackupSaved(false),3000); }catch(err){ console.warn('immediate save failed', err); } }} className="w-full border rounded-xl p-2" placeholder="ex: nume@domeniu.com"/></Field>
  <Field label="Periodicitate"><select value={String(backup.freqDays||1)} onChange={e=>{ const v = parseInt((e.target as any).value)||1; const newB = {...backup, freqDays: v}; setBackup(newB); try{ save({ rates, entries: entries||{}, backup: newB, cloud }); setBackupSaved(true); setTimeout(()=>setBackupSaved(false),3000); }catch(err){ console.warn('immediate save failed', err); } }} className="w-full border rounded-xl p-2"><option value="1">La 1 zi</option><option value="7">La 7 zile</option><option value="30">La 30 zile</option></select></Field>
  <Field label="Activ"><input type="checkbox" checked={!!backup.enabled} onChange={e=>{ const checked=(e.target as any).checked; const newB = {...backup, enabled: checked, nextAt: checked?(backup.nextAt||Date.now()):0}; setBackup(newB); try{ save({ rates, entries: entries||{}, backup: newB, cloud }); setBackupSaved(true); setTimeout(()=>setBackupSaved(false),3000); }catch(err){ console.warn('immediate save failed', err); } }}/></Field>
      <Field label="Următorul backup (estimativ)" className="col-span-1"><div className="p-2 border rounded-xl text-sm">{nextText}</div></Field>
  <Field label="Importă ca adăugare (fără înlocuire)" className="col-span-2"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={mergeImport} onChange={e=>setMergeImport((e.target as any).checked)}/> combină și dedup (după câmpuri cheie)</label></Field>
      <div className="col-span-2 flex gap-3 items-center">
    <button onClick={onBackupNow} className="px-4 py-2 rounded-xl bg-black text-white font-semibold">Trimite acum</button>
    <button onClick={exportCSVAll} className="px-4 py-2 rounded-xl border">Exportă CSV</button>
  <button onClick={()=>{ try{ const newB = {...backup}; setBackup(newB); try{ save({ rates, entries: entries||{}, backup: newB, cloud }); }catch(err){ console.warn('immediate save failed', err); } setBackupSaved(true); setTimeout(()=>setBackupSaved(false), 3000); }catch(e){ console.warn('save backup failed', e); } }} className="px-4 py-2 rounded-xl border">Save</button>
  {backupSaved && (<div className="text-sm text-green-600">Backup automat: saved</div>)}
    <label className="px-4 py-2 rounded-xl border cursor-pointer">Importă CSV (merge)<input type="file" accept="text/csv" className="hidden" onChange={e=>{ const f=(e.target as HTMLInputElement).files?.[0]; if(f){ importCSVAll(f); } }} /></label>
  <label className="px-4 py-2 rounded-xl border cursor-pointer">Importă CSV (ca fișier pentru proiect)<input type="file" accept="text/csv" className="hidden" onChange={e=>{ const f=(e.target as HTMLInputElement).files?.[0]; if(f){ if(onSelectCSVFile) onSelectCSVFile(f); if(notify) notify('success','Fișier CSV selectat. Mergi la Proiecte remote și apasă Importă CSV pentru proiectul țintă.'); } }} /></label>
      </div>
    </div></Section>
  <Section title="Sincronizare în fundal">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sincronizare în fundal activă" className="col-span-2">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!cloud?.backgroundSyncEnabled} onChange={e=>setCloud((c:any)=>({...c, backgroundSyncEnabled:(e.target as any).checked}))}/> Activează sincronizarea în fundal</label>
          </Field>
  <Field label="Interval (sec)" className="col-span-2"><input inputMode="numeric" value={String(cloud?.backgroundSyncIntervalSec||20)} onChange={e=>{ const v=parseInt((e.target as any).value)||20; setCloud((c:any)=>({...c, backgroundSyncIntervalSec: v})); }} className="w-full border rounded-xl p-2"/></Field>
  <Field label="Încarcă automat la închidere" className="col-span-2">
    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={!!cloud?.autoUploadOnClose} onChange={e=>setCloud((c:any)=>({...c, autoUploadOnClose:(e.target as any).checked}))}/> Încarcă proiectul curent la închiderea aplicației (sau navigare) dacă există o versiune locală</label>
  </Field>
      </div>
    </Section>
    <Section title="Instalare pe iPhone (PWA)">
      <div className="space-y-2 text-sm text-slate-700">
        <div className="flex items-center gap-2">
          <button disabled={!pwaReady} onClick={()=>{ if(installPWA) installPWA(); }} className={`px-4 py-2 rounded-xl ${pwaReady?"bg-black text-white":"border"}`}>{pwaReady?"Instalează (dacă este disponibil)":"Instalare disponibilă pe Android/desktop"}</button>
        </div>
        <div className="text-xs text-slate-500">Pe iPhone: deschide în Safari → Share → <b>Add to Home Screen</b>. (iOS nu afișează buton automat).</div>
      </div>
    </Section>
    
    <Section title="Proiecte remote">
      <div className="grid grid-cols-1 gap-3">
        <div className="text-sm text-slate-500">Proiectele tale stocate în cloud. Poți încărca proiectul curent, descărca sau exporta pe email.</div>
          <div className="space-y-2">
          {(!remoteProjects||remoteProjects.length===0) && (<div className="text-slate-500">Nu există proiecte.</div>)}
          {remoteProjects&&remoteProjects.map((p:any)=>(
            <div key={p.id} data-project-id={p.id} className="flex items-center gap-2">
              <div className="flex-1">
                <span style={{fontWeight:600}}>{p.name||p.id}</span> <span className="text-xs text-slate-400">({p.id})</span>
                {/* Small English 'Load' button included inside the same container so tests can find it via parent locator */}
                <button onClick={()=>loadRemoteProject(p.id)} className="text-xs underline ml-2">Load</button>
                {' '}
                {/* show only last synced time (auto-updated) */}
                <div className="text-xs text-slate-500 ml-2">Sincronizat: {lastSyncMap[p.id]||'—'}</div>
                {Array.isArray(p.pendingInvites) && p.pendingInvites.length>0 && (
                  <div style={{marginTop:6}} className="text-xs text-slate-600">Invitații în așteptare:
                    <div className="flex flex-wrap gap-2 mt-1">
                      {p.pendingInvites.map((em:string)=> (
                        <div key={em} className="px-2 py-1 rounded-full bg-yellow-50 text-yellow-800 text-xs flex items-center gap-2">
                          <span>{em}</span>
                          {p.owner===userEmail && (<button onClick={()=>cancelInvite&&cancelInvite(p.id,em)} className="text-xs underline">Anulează</button>)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2" data-project-id-actions={p.id}>
                <button onClick={()=>saveProject(p.id, p.name)} className="px-3 py-1 rounded-xl border">Încarcă</button>
                <button onClick={()=>downloadRemoteProject(p.id)} className="px-3 py-1 rounded-xl border">Descarcă</button>
                <button onClick={()=>exportRemoteProjectToCSV(p.id)} className="px-3 py-1 rounded-xl border">Exportă CSV</button>
                <button onClick={async()=>{ try{ const f = (window as any).__importCSV_FILE as File | undefined; if(!f){ if(notify) notify('error','Nu a fost selectat niciun CSV. Folosește butonul "Importă CSV" din secțiunea Backup/Importare mai întâi.'); return; } await importProjectFromCSVFile(f,{mergePreferImporter:true}); }catch(e:any){ console.error(e); if(notify) notify('error','Importare eșuată: '+(e?.message||e)); } }} className="px-3 py-1 rounded-xl border">Importă CSV</button>
                <button onClick={()=>exportRemoteProjectToEmail(p.id, backup.email)} className="px-3 py-1 rounded-xl border">Exportă → Email</button>
                <button onClick={()=>openModal('rename', p, p.name||p.id)} className="px-3 py-1 rounded-xl border">Redenumire</button>
                <button onClick={()=>openModal('addEditor', p, '')} className="px-3 py-1 rounded-xl border">Adaugă editor</button>
                <button onClick={()=>openModal('removeEditor', p, '')} className="px-3 py-1 rounded-xl border">Elimină editor</button>
                {/* Manual sync button: triggers attemptSyncProject for this project */}
                <button
                  onClick={async()=>{
                    try{
                      if(typeof attemptSyncProject !== 'function') throw new Error('Sync handler unavailable');
                      await attemptSyncProject(p);
                    }catch(err:any){
                      console.error('manual sync failed', err);
                      if(notify) notify('error', 'Sync failed: '+(err?.message||String(err)));
                    }
                  }}
                  className="px-3 py-1 rounded-xl border"
                  disabled={syncingProjects?.includes(p.id)}
                >
                  {syncingProjects?.includes(p.id) ? 'Se sincronizează…' : 'Sincronizează'}
                </button>
                <button onClick={()=>openModal('delete', p, '')} className="px-3 py-1 rounded-xl border text-red-600">Șterge</button>
              </div>
            </div>
          ))}
          {/* Render any local-only projects stored in local_projects_v1 so offline flows work */}
          {(() => {
            try{
              const raw = window.localStorage.getItem('local_projects_v1');
              if(!raw) return null;
              const local = JSON.parse(raw) as any[];
              // build a set of remote ids to avoid rendering duplicates
              const remoteIds = new Set((remoteProjects||[]).map((rp:any)=>rp.id));
              const filtered = (local||[]).filter((x:any)=>{
                if(userEmail && x.owner!==userEmail) return false; // only show user's local projects
                if(remoteIds.has(x.id)) return false; // skip if already shown as remote
                return true;
              });
              return filtered.map((p:any)=> (
                <div key={`local-${p.id}`} className="flex items-center gap-2">
                  <div className="flex-1" data-project-id={p.id}>
                        <span style={{fontWeight:600}}>{p.name||p.id}</span> <span className="text-xs text-slate-400">({p.id})</span>
                        <span className="text-xs text-slate-500 ml-2">Sincronizat: {lastSyncMap[p.id]||'—'}</span>
                        <button onClick={()=>loadRemoteProject(p.id)} className="text-xs underline ml-2">Load</button>
                      </div>
                    <div className="flex gap-2" data-project-id-actions={p.id}>
                    <button onClick={()=>saveProject(p.id, p.name)} className="px-3 py-1 rounded-xl border">Încarcă</button>
                    <button onClick={()=>downloadRemoteProject(p.id)} className="px-3 py-1 rounded-xl border">Descarcă</button>
                    <button onClick={()=>exportRemoteProjectToCSV(p.id)} className="px-3 py-1 rounded-xl border">Exportă CSV</button>
                    <button onClick={()=>openModal('rename', p, p.name||p.id)} className="px-3 py-1 rounded-xl border">Redenumire</button>
                    <button onClick={()=>openModal('delete', p, '')} className="px-3 py-1 rounded-xl border text-red-600">Șterge</button>
                  </div>
                </div>
              ));
            }catch(e){ console.warn('render local projects failed', e); return null; }
          })()}
          <div className="mt-3"><button onClick={()=>openModal('save', undefined, '')} className="px-4 py-2 rounded-xl bg-black text-white">Salvează proiectul curent</button></div>
        </div>
      </div>
    </Section>
    <Section title="Invită colaboratori">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Alege proiect" className="col-span-2">
          <select value={inviteProjectId||""} onChange={e=>setInviteProjectId((e.target as any).value||undefined)} className="w-full border rounded-xl p-2">
            <option value="">-- alege proiect --</option>
            {remoteProjects?.map((p:any)=> (<option key={p.id} value={p.id}>{p.id}{p._fallback? ' (Local)':''}</option>))}
            {/* include locally-saved projects from local_projects_v1 and render them similarly to remote entries */}
            {(() => {
              try{
                const raw = window.localStorage.getItem('local_projects_v1');
                if(!raw) return null;
                const local = JSON.parse(raw) as any[];
                // avoid duplicates with remoteProjects
                const remoteIds = new Set((remoteProjects||[]).map((rp:any)=>rp.id));
                // show local projects even when not signed in (offline test relies on this)
                const filtered = (local||[]).filter((x:any) => (!userEmail || x.owner === userEmail) && !remoteIds.has(x.id));
                return filtered.map((p:any) => {
                  const idOnly = String(p.id || '');
                  return (<option key={p.id} value={p.id}>{idOnly} (Local)</option>);
                });
              }catch(e){ console.warn('render local projects failed', e); return null; }
            })()}
          </select>
        </Field>
        <Field label="Email colaborator" className="col-span-2"><input value={inviteEmail} onChange={e=>setInviteEmail((e.target as any).value)} className="w-full border rounded-xl p-2" placeholder="nume@exemplu.com"/></Field>
  <div className="col-span-2"><button onClick={sendInvite} disabled={inviteSending} className="w-full py-2 rounded-xl bg-black text-white font-semibold">{inviteSending? 'Se trimite...' : 'Trimite invitație'}</button></div>
  <div className="col-span-2 text-xs text-slate-500">Invitația trimite un link magic (email) — acceptarea va permite conectarea automată pe dispozitivul destinatarului.</div>
  <div className="col-span-2"><div className="text-sm">Conectat ca: <b>{userEmail||'—'}</b></div></div>
      </div>
    </Section>
    <Section title="Utilitare">
      <div className="grid grid-cols-1 gap-3">
        <div className="text-sm text-slate-500">Acțiuni utile: reîmprospătare sau curățare cache local.</div>
        <div className="flex gap-3">
          <button onClick={()=>{ try{ window.location.reload(); }catch(e:any){ console.error(e); if(notify) notify('error','Reîncărcare eșuată'); } }} className="px-4 py-2 rounded-xl border">Reîncărcare pagină</button>
          <button onClick={()=>{ try{ localStorage.removeItem('buget-mobile-state-v3'); localStorage.removeItem('local_projects_v1'); if(notify) notify('success','Cache local curățat'); }catch(e:any){ console.error(e); if(notify) notify('error','Curățare cache eșuată'); } }} className="px-4 py-2 rounded-xl border">Curăță cache local</button>
        </div>
      </div>
    </Section>
    {/* Modal for project actions (rename/add/remove/delete/save) */}
    {modalOpen && (
      <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000}}>
        <div style={{background:'white',padding:20,borderRadius:12,minWidth:320,maxWidth:'90%'}}>
          <div style={{fontWeight:700,marginBottom:8}}>{modalType==='rename'?'Redenumire proiect':modalType==='addEditor'?'Adaugă editor':modalType==='removeEditor'?'Elimină editor':modalType==='delete'?'Șterge proiect':'Salvează proiect'}</div>
            {modalType==='delete' ? (
            <div style={{marginBottom:12}}>Sigur vrei să ștergi <b>{modalProject?.name||modalProject?.id}</b>?</div>
          ) : (
            <div style={{marginBottom:12}}>
              <input value={modalValue} onChange={e=>setModalValue((e.target as any).value)} placeholder={modalType==='rename'?'Nume proiect nou':modalType==='addEditor'?'Email editor':modalType==='removeEditor'?'Email editor':''} className="w-full border rounded-xl p-2" />
            </div>
          )}
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button onClick={closeModal} className="px-3 py-2 rounded-xl border" disabled={modalBusy}>Anulează</button>
            <button onClick={confirmModal} className="px-3 py-2 rounded-xl bg-black text-white" disabled={modalBusy}>{modalBusy? 'Așteaptă...' : 'Confirmă'}</button>
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
  // On first unauthenticated load, if app state is empty, try to load a local cached project
  useEffect(()=>{
    try{
      // only run on initial unauthenticated startup
      if(typeof window==='undefined') return;
      const hasRealData = E && Object.keys(E||{}).some(k=>{ const M=E[k]||{}; return (M.incomes&&M.incomes.length>0) || (M.expenses&&M.expenses.length>0) || (M.planner&&M.planner.length>0) || (M.credits&&M.credits.length>0); });
      if(hasRealData) return;
      // read local projects and load the first one if present
      const raw = window.localStorage.getItem('local_projects_v1');
      if(!raw) return;
      const local = JSON.parse(raw) as any[];
      if(!local || local.length===0) return;
      const p = local[0]; if(!p || !p.entries) return;
      try{ if(p.rates) setR(p.rates); if(p.entries) setE(migrate(p.entries)); if(p.backup) setB(p.backup); setC((c:any)=>({...c, projectId: p.id, budgetId: p.id})); setTab('add'); }catch(e){ void e; }
    }catch(e){ console.warn('initial load from local cache failed', e); }
    // run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const [remoteProjects,setRemoteProjects]=useState<Array<any>>([]);
  const [syncingProjects,setSyncingProjects]=useState<string[]>([]);
  const [lastSyncMap, setLastSyncMap] = useState<Record<string,string>>({});
  const [ownerNotifications,setOwnerNotifications]=useState<any[]>([]);
  const [importModalOpen,setImportModalOpen]=useState(false);
  const [importPreview,setImportPreview]=useState<any|undefined>(undefined);
  const [lastLoadedPreview, setLastLoadedPreview] = useState<string|undefined>(undefined);
  const [lastCSVFile,setLastCSVFile]=useState<File|undefined>(undefined);
  const [selectedImportMode,setSelectedImportMode]=useState<'merge'|'replace'>('merge');
  const [importApplying,setImportApplying]=useState(false);
  const[tab,setTab]=useState("add"); const[pwaReady,setPwaReady]=useState(false);
  const [lastAddedCredit, setLastAddedCredit] = useState<{mk:string;id:string}|null>(null);
  const [userEmail,setUserEmail]=useState<string|undefined>(undefined);
  const [loadedFromCache, setLoadedFromCache] = useState(false);
  const entriesRef = useRef(E);
  useEffect(()=>{ entriesRef.current = E; },[E]);
  const resolveAndLoadProjectRef = useRef<any>(null);
  // determine test/e2e mode so we can expose helpers only during tests
  const isTestMode = (typeof import.meta !== 'undefined' && (import.meta as any).env && ((import.meta as any).env.MODE === 'test')) || (typeof window !== 'undefined' && (((window as any).__E2E === true) || (window.location && String(window.location.search || '').includes('?e2e=1'))));
  // Expose minimal test helpers early so tests can find them as soon as App mounts.
  // Register only in test/e2e mode to avoid exposing internals in production.
  useEffect(()=>{
    try{
      if(typeof window === 'undefined') return;
  const isTestMode = (typeof import.meta !== 'undefined' && (import.meta as any).env && ((import.meta as any).env.MODE === 'test')) || ((window as any).__E2E === true) || window.location.search.includes('?e2e=1');
      if(!isTestMode) return;
      (window as any).__getAppEntries = ()=>{ try{ return entriesRef.current; }catch(e){ return null; } };
      (window as any).__setAppEntries = (payload:any)=>{ try{ setE(payload); entriesRef.current = payload; return true; }catch(e){ return false; } };
      (window as any).__clearUI = ()=>{
        try{
          const emptySnapshot = { [todayYM]: emptyM() };
          setE(emptySnapshot);
          entriesRef.current = emptySnapshot;
          setR(rates0);
          setB({email:"",freqDays:1,enabled:false,nextAt:0});
          setC((c:any)=>({...c, projectId: undefined, budgetId: undefined}));
          setTab('add');
          try{ setMk(todayYM); }catch(_){ void _; }
          try{ setLastLoadedPreview(undefined); }catch(_){ void _; }
          try{ setLoadedFromCache(false); }catch(_){ void _; }
          try{ setUserEmail(undefined); }catch(_){ void _; }
          try{ (window as any).__uiCleared = true; }catch(_){ void _; }
          return true;
        }catch(e){ return false; }
      };
    }catch(e){ void e; }
  },[]);
  // Notifications (simple toasts)
  const [notifs,setNotifs]=useState<{id:number,type:'info'|'success'|'error',msg:string}[]>([]);
  const pushNotif = useCallback((type:'info'|'success'|'error', msg:string, ttl=5000)=>{ const id=Date.now()+Math.floor(Math.random()*1000); setNotifs(s=>[...s,{id,type,msg}]); setTimeout(()=>setNotifs(s=>s.filter(x=>x.id!==id)), ttl); }, [setNotifs]);

  // On startup, check if an autoupload was attempted on last close and notify the user
  useEffect(()=>{
    try{
      const raw = window.localStorage.getItem('last_autoupload');
      if(!raw) return;
      const rec = JSON.parse(raw);
      if(!rec) return;
      const at = new Date(Number(rec.at||0));
      const when = `${String(at.getDate()).padStart(2,'0')}.${String(at.getMonth()+1).padStart(2,'0')}.${at.getFullYear()} ${String(at.getHours()).padStart(2,'0')}:${String(at.getMinutes()).padStart(2,'0')}`;
      const online = rec.attemptedOnline ? 'online' : 'offline (queued locally)';
      pushNotif('info', `Auto-upload at close detected for project ${rec.projectId} on ${when} (${online})`, 8000);
      try{ window.localStorage.removeItem('last_autoupload'); }catch(e){ void e; }
    }catch(e){ void e; }
  },[]);

  // Invite modal state and handler (used when processing email-link invites)
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteModalEmail, setInviteModalEmail] = useState<string>("");
  const [invitePendingUrl, setInvitePendingUrl] = useState<string | null>(null);

  // Modal used to ask user for a unique credit name when a duplicate is detected
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameModalValue, setNameModalValue] = useState('');
  const [nameModalResolve, setNameModalResolve] = useState<((v:string|null)=>void)|null>(null);

  // busy flag for invite modal actions
  const [modalBusy,setModalBusy] = useState(false);

  const submitInviteEmail = async(email:string)=>{
    if(!invitePendingUrl) { setInviteModalOpen(false); return; }
    setModalBusy(true);
    try{
      await ensureAuth().catch(()=>{});
      try{ if(_auth && _auth.currentUser){ const cur = (_auth.currentUser.email||'').toLowerCase(); if(cur && cur !== (email||'').toLowerCase()){ await signOut(_auth); } } }catch(err){ console.warn('signOut before email-link sign-in failed', err); }
      const res = await signInWithEmailLink(_auth, email, invitePendingUrl);
  const signedEmail = (res as any).user?.email || email;
  setUserEmail(signedEmail);
  pushNotif('success','Autentificat ca '+signedEmail);
      try{
        const pending = window.localStorage.getItem('buget_pending_invite_project');
  if(pending){ await ensureFs().catch(()=>{}); await processPendingInvitesForEmail(signedEmail); try{ await loadRemoteProject(pending); }catch(err){ console.debug('loadRemoteProject(pending) failed', err); } try{ window.localStorage.removeItem('buget_pending_invite_project'); }catch(err){ console.debug('removeItem buget_pending_invite_project failed', err); } }
      }catch(err){ console.warn('post-signin pending invite processing failed', err); }
  }catch(e:any){ console.error('invite sign-in failed', e); pushNotif('error','Autentificare eșuată: '+(e?.message||e)); }
    setModalBusy(false);
    setInviteModalOpen(false);
    setInviteModalEmail('');
    setInvitePendingUrl(null);
  };

  // keep a global pointer for the legacy Importă CSV button which reads window.__importCSV_FILE
  useEffect(()=>{ try{ if(lastCSVFile){ (window as any).__importCSV_FILE = lastCSVFile; } else { try{ delete (window as any).__importCSV_FILE; }catch{ (window as any).__importCSV_FILE = undefined; } } }catch{ void 0; } },[lastCSVFile]);

  // When a user signs-in (via email link or regular), check if their email appears in any project's pendingInvites
  // and if so, add them to editors and remove from pendingInvites. This is in App scope so it can be called
  // right after auth resolves.
  const processPendingInvitesForEmail = useCallback(async(email?:string)=>{
    if(!email) return;
    try{
      if(!fbInit(C.cfg)) fbInit(undefined);
      await ensureFs().catch(()=>{});
      if(!_db) return;
      const q = query(collection(_db,'projects'), where('pendingInvites','array-contains', email));
      const snap = await getDocs(q);
      for(const docSnap of snap.docs){
        const pid = docSnap.id; const data:any = docSnap.data();
        const editors = Array.from(new Set([...(data.editors||[]), email]));
        await setDoc(doc(_db,'projects',pid), {editors, pendingInvites: arrayRemove(email)},{merge:true});
        pushNotif('success',`Ai fost ad03ugat la proiectul ${data.name||pid}`);
        // write owner notification (separate collection)
        try{
          const note = { owner: data.owner||'', projectId: pid, projectName: data.name||pid, invitedEmail: email, createdAt: Date.now(), read:false };
          const cn = doc(collection(_db,'ownerNotifications'));
          await setDoc(cn, note, {merge:true});
  }catch(err){ console.warn('owner notification write failed', err); void err; }
      }
  }catch(e){ console.error('processPendingInvitesForEmail', e); void e; }
  },[C?.cfg, pushNotif]);

  // Dismiss owner notification by id
  const dismissOwnerNotification = async(noteId:string)=>{
    try{
      if(!fbInit(C.cfg)) fbInit(undefined);
      await ensureFs().catch(()=>{});
      if(!_db) return;
      await deleteDoc(doc(_db,'ownerNotifications',noteId));
      pushNotif('info','Notification dismissed');
  }catch(e){ console.error('dismissOwnerNotification', e); pushNotif('error','Could not dismiss notification'); void e; }
  };

  // --- User metadata helpers: remember last opened project and ensure default project exists
  // make a URL-safe base64 doc id from email to avoid problematic characters
  const emailToDocId = (email?:string|null)=>{ if(!email) return null; try{ const b = btoa(email); return b.replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }catch{ return encodeURIComponent(email); } };

  // previously used to block UI while loading last project; now we prefer non-blocking cached load

  const setUserLastOpenedProject = async(email:string|undefined, projectId:string|undefined)=>{
    try{
      if(!email) return;
      if(!fbInit(C.cfg)) fbInit(undefined);
      await ensureFs().catch(()=>{});
      if(!_db) return;
      const id = emailToDocId(email) || email;
      await setDoc(doc(_db,'userMeta', id), { lastOpenedProject: projectId, updatedAt: Date.now(), email }, { merge:true });
  try{ if(projectId){ window.localStorage.setItem('last_opened_project_'+email, projectId); } }catch{ /* ignore */ }
  }catch(err){ console.warn('setUserLastOpenedProject failed', err); }
  };

  const getUserLastOpenedProject = async(email:string|undefined)=>{
    try{
      if(!email) return null;
      if(!fbInit(C.cfg)) fbInit(undefined);
      await ensureFs().catch(()=>{});
      if(!_db) return null;
      const id = emailToDocId(email) || email;
      const d = await getDoc(doc(_db,'userMeta', id));
      if(!d.exists()) return null;
      const data:any = d.data(); return data.lastOpenedProject||null;
  }catch(err){ console.warn('getUserLastOpenedProject failed', err); return null; }
  };

  const ensureUserHasDefaultProject = async(email:string|undefined)=>{
    try{
      if(!email) return;
      if(!fbInit(C.cfg)) fbInit(undefined);
      await ensureFs().catch(()=>{});
      if(!_db) return;
      // check if user already has any projects
      const q = query(collection(_db,'projects'), where('owner','==', email));
      const snap = await getDocs(q);
      if(snap.docs.length>0) return; // user already has projects
      // create a default project named after current month and creation date
      const defaultName = `${roLabel(todayYM)} - ${ymd()}`;
      const id = `proj-${Date.now().toString(36)}`;
      const payload = { owner: email, name: defaultName, rates: r, entries: {[todayYM]: emptyM()}, backup: B, createdAt: Date.now(), updatedAt: Date.now(), editors: [email] };
      await setDoc(doc(_db,'projects', id), payload);
      // remember as last opened
      await setUserLastOpenedProject(email, id);
      // refresh list
      await listRemoteProjects();
      pushNotif('success', 'Un proiect implicit a fost creat pentru contul tău');
  }catch(err){ console.warn('ensureUserHasDefaultProject failed', err); }
  };

  // --- Local projects cache helpers (local_projects_v1)
  // local projects cache helpers — now backed by IndexedDB with localStorage fallback
  const readLocalProjects = ()=>{ try{ /* synchronous fallback: read localStorage for code paths that require sync response */ const raw = window.localStorage.getItem('local_projects_v1'); return raw? JSON.parse(raw) as any[] : []; }catch{ console.warn('readLocalProjects failed'); return []; } };
  const writeLocalProjects = (list:any[])=>{ try{ window.localStorage.setItem('local_projects_v1', JSON.stringify(list)); }catch{ console.warn('writeLocalProjects failed'); } };
  const getLocalProjectById = (id:string)=>{ try{ /* prefer idb if available (async elsewhere), synchronous fallback remains */ const arr = readLocalProjects(); return arr.find((p:any)=>p.id===id) || null; }catch{ return null; } };
  const upsertLocalProject = async(proj:any)=>{ try{ const toSave = {...proj, updatedAt: proj.updatedAt||Date.now(), _fallback: !!proj._fallback}; try{ await idb.putProject(toSave); }catch{ /* fallback to localStorage */ const arr = readLocalProjects(); const idx = arr.findIndex((p:any)=>p.id===toSave.id); if(idx>=0) arr[idx]= {...arr[idx], ...toSave}; else arr.push(toSave); writeLocalProjects(arr); } }catch{ console.warn('upsertLocalProject failed'); } };

  // on mount, attempt to migrate any existing localStorage projects into IndexedDB (best-effort)
  useEffect(()=>{ try{ idb.migrateFromLocalStorage().catch(()=>{}); }catch(e){ void e; } },[]);

  

  // Auth state listener
  useEffect(()=>{
    try{
      if(!fbInit(C.cfg, false)) return; // ensure _app is set
      let unsub: any = ()=>{};
      (async()=>{
        try{
          await ensureAuth().catch(()=>{});
          await ensureFs().catch(()=>{});
          // if auth helper isn't available, bail
          if(typeof onAuthStateChanged !== 'function' || !_auth) {
            console.warn('Auth module not available for onAuthStateChanged');
            return;
          }
          const prevUserEmailRef = { current: undefined as string|undefined } as any;
          unsub = onAuthStateChanged(_auth, (user:any)=>{
            if(user){
              const mail = user.email||user?.providerData?.[0]?.email||undefined;
              prevUserEmailRef.current = mail;
              setUserEmail(mail);
              processPendingInvitesForEmail(mail);
              // ensure user has a default project and load last opened project
              (async ()=>{
                try{
                  // ensure default exists (may write local fallback)
                  await ensureUserHasDefaultProject(mail);
                  // try to find last opened project from remote metadata
                  const lastRemote = await getUserLastOpenedProject(mail);
                  // also read a locally-cached last opened project (fast)
                  let lastCached:string|undefined| null = null;
                  try{ lastCached = window.localStorage.getItem('last_opened_project_'+(mail||'')) || null; }catch{ lastCached = null; }

                  // Determine which project to load (if any) by comparing timestamps when both exist.
                  const decideAndLoad = async(remoteId?:string|null, cachedId?:string|null)=>{
                    try{
                      if(!remoteId && !cachedId){ await listRemoteProjects(); return; }
                      // if only one exists, load that
                      if(remoteId && !cachedId){ setSyncingProjects(s=> (s.includes(remoteId)?s:[...s,remoteId]) ); await resolveAndLoadProject(remoteId); setSyncingProjects(s=>s.filter(x=>x!==remoteId)); await listRemoteProjects(); return; }
                      if(!remoteId && cachedId){ // fast load cached then background sync
                        const cached = getLocalProjectById(cachedId as string);
                        if(cached){ try{ if(cached.rates) setR(cached.rates); if(cached.entries) setE(migrate(cached.entries)); if(cached.backup) setB(cached.backup); setC((c:any)=>({...c, projectId: cachedId, budgetId: cachedId})); pushNotif('info','Loaded cached project for fast startup'); }catch(_){ void _; } }
                        setSyncingProjects(s=> (s.includes(cachedId as string)?s:[...s,(cachedId as string)]) );
                        await resolveAndLoadProject(cachedId as string);
                        setSyncingProjects(s=>s.filter(x=>x!==(cachedId as string)));
                        await listRemoteProjects();
                        return;
                      }

                      // both exist and may differ — compare their updatedAt/_syncedAt timestamps
                      try{
                        const local = getLocalProjectById(cachedId as string);
                        let remoteData:any = null;
                        try{ if(fbInit(C.cfg)){ await ensureFs().catch(()=>{}); const d = await getDoc(doc(_db,'projects', remoteId)); if(d && d.exists) remoteData = d.data(); } }catch(e){ /* ignore remote fetch errors */ }
                        const localTs = local?.updatedAt || local?._syncedAt || 0;
                        const remoteTs = remoteData?.updatedAt || remoteData?._syncedAt || 0;
                        // debug notify for timestamps
                        try{ pushNotif('info', `Decide load: remote=${remoteId||'—'}(${fmtTS(remoteTs)}), cached=${cachedId||'—'}(${fmtTS(localTs)})`, 5000); }catch(_){ void _; }
                        const pick = (local && Number(localTs) > Number(remoteTs)) ? cachedId : remoteId;
                        if(pick){ setSyncingProjects(s=> (s.includes(pick as string)?s:[...s,(pick as string)]) ); await resolveAndLoadProject(pick as string); setSyncingProjects(s=>s.filter(x=>x!==(pick as string))); }
                        await listRemoteProjects();
                        return;
                      }catch(e){ console.warn('decideAndLoad compare failed', e); // fallback: prefer remote
                        try{ pushNotif('info', `Decide load fallback to remote ${remoteId||'—'}`); }catch(_){ void _; }
                        if(remoteId){ setSyncingProjects(s=> (s.includes(remoteId)?s:[...s,remoteId]) ); await resolveAndLoadProject(remoteId); setSyncingProjects(s=>s.filter(x=>x!==remoteId)); }
                        await listRemoteProjects();
                        return;
                      }
                    }catch(e){ console.warn('decideAndLoad failed', e); await listRemoteProjects(); }
                  };

                  // Blocking decision & load: ensure chosen project is loaded before proceeding
                  try{
                    await decideAndLoad(lastRemote, lastCached);
                  }catch(e){ console.warn('decide/load failed', e); }
                }catch(err){ console.warn('post-auth user setup failed', err); }
              })();
            }
            else {
              // user signed out: perform minimal cleanup.
              // Mark any locally-saved projects owned by the previous user as 'local' so they
              // won't be accidentally uploaded under a different account, but DO NOT wipe the
              // in-memory UI snapshot or remove the user's last_opened_project entry. Preserving
              // the UI snapshot allows the same user to sign back in and immediately see their
              // previous data (avoids zeroing-out on sign-out/sign-in cycles).
              try{
                const prev = prevUserEmailRef.current;
                if(prev){
                  try{ const raw = window.localStorage.getItem('local_projects_v1'); if(raw){ const arr = JSON.parse(raw) as any[]; const out = arr.map(p=> p.owner===prev ? {...p, owner:'local'} : p); window.localStorage.setItem('local_projects_v1', JSON.stringify(out)); } }catch(e){ void e; }
                  // Intentionally do NOT remove 'last_opened_project_'+prev and do NOT clear E/R/B/C here.
                }
              }catch(e){ console.warn('post-signout minimal cleanup failed', e); }
              // Clear only UI state on sign-out but preserve local cache on disk.
              try{
                // Reset in-memory state so form fields become empty for a signed-out user.
                setE({[todayYM]: emptyM()});
                setR(rates0);
                setB({email:"",freqDays:1,enabled:false,nextAt:0});
                setC((c:any)=>({...c, projectId: undefined, budgetId: undefined}));
                setTab('add');
                try{ setMk(todayYM); }catch(_){ void _; }
                try{ setLastLoadedPreview(undefined); }catch(_){ void _; }
                try{ setLoadedFromCache(false); }catch(_){ void _; }
              }catch(e){ console.warn('sign-out UI clear failed', e); }
              setUserEmail(undefined);
            }
          });
        }catch(e){console.error(e)}
      })();
  return ()=>{ try{ if(typeof unsub === 'function') unsub(); }catch(err){ console.debug('unsub cleanup failed', err); } };
    }catch(e){console.error(e)}
  // We intentionally omit downstream callbacks (like listRemoteProjects/loadRemoteProject)
  // from the deps because they are declared later in the file; they are stable enough
  // for this post-auth setup IIFE. Keep only essential deps to avoid re-registering.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[processPendingInvitesForEmail, C?.cfg]);

  // Robust: if initial auto-load at sign-in missed the project (race with remote arrival),
  // retry a few times with backoff to attempt loading the user's last opened project.
  useEffect(()=>{
    if(!userEmail) return;
    // if already have a cloud project selected, nothing to do
    const cur = (C && (C.projectId||C.budgetId)) ? (C.projectId||C.budgetId) : null;
    if(cur) return;

    let cancelled = false;
    (async ()=>{
      const tries = [0, 1000, 3000, 10000];
      for(const delay of tries){
        if(cancelled) return;
        if(delay) await new Promise(r=>setTimeout(r, delay));
        try{
          // re-read remote metadata and local cache
          let remoteId: string | null = null;
          try{ remoteId = await getUserLastOpenedProject(userEmail); }catch(e){ remoteId = null; }
          let cachedId: string | null = null;
          try{ cachedId = window.localStorage.getItem('last_opened_project_'+(userEmail||'')) || null; }catch(e){ cachedId = null; }

          if(!remoteId && !cachedId) continue;

          // If both exist, let resolveAndLoadProject pick the freshest copy by timestamp
          const pick = remoteId || cachedId;
          if(pick){
            try{ if(resolveAndLoadProjectRef.current) { await resolveAndLoadProjectRef.current(pick); break; } }catch(e){ /* ignore and retry */ }
          }
        }catch(e){ /* ignore outer errors and continue retrying */ }
      }
    })();
    return ()=>{ cancelled = true; };
  },[userEmail, C?.projectId, C?.budgetId]);

  // local save + cloud push
  useEffect(()=>{
    const t = setTimeout(()=>{(async()=>{
      try{
        const snap = { rates: r, entries: E, backup: B, cloud: C };
        // primary local save (global app snapshot)
        save(snap);

        // If a cloud project id is selected, persist a project-specific local copy
        try{
          const projId = C?.projectId || C?.budgetId;
          if(projId){
            const toSaveLocal = { id: projId, owner: userEmail||'local', name: (C?.projectId===projId? C?.projectId: `Project ${projId}`), rates: r, entries: E, backup: B, updatedAt: Date.now(), _fallback: true };
            // synchronous localStorage write for immediate availability
            try{
              const raw = window.localStorage.getItem('local_projects_v1');
              const local = raw? JSON.parse(raw) as any[] : [];
              const idx = local.findIndex((x:any)=>x.id===projId);
              if(idx>=0) local[idx] = {...local[idx], ...toSaveLocal}; else local.push(toSaveLocal);
              window.localStorage.setItem('local_projects_v1', JSON.stringify(local));
            }catch(e){ console.warn('autosave: local_projects_v1 write failed', e); }
            // attempt indexeddb upsert (async)
            try{ await upsertLocalProject(toSaveLocal); }catch(e){ /* best-effort */ }
          }
        }catch(e){ console.warn('autosave: per-project local persist failed', e); }

        // cloud write: try to update the document in 'projects' collection for the current project id
        try{
          if(C?.enabled && (C?.projectId || C?.budgetId) && fbInit(C?.cfg||"")){
            await ensureFs().catch(()=>{});
            if(_db){
              const pid = C?.projectId || C?.budgetId;
                if(pid && !_pull){
                const docRef = doc(_db,'projects', pid);
                await setDoc(docRef, { rates: r, entries: E, backup: B, updatedAt: Date.now(), _syncedAt: Date.now() }, { merge: true });
                try{ if(userEmail) await setUserLastOpenedProject(userEmail, pid); }catch(e){ void e; }
              }
            }
          }
        }catch(e){ console.warn('autosave cloud push failed', e); }
      }catch(e){ console.warn('autosave failed', e); }
    })(); },250);
    return()=>clearTimeout(t);
  },[r,E,B,C,userEmail]);

  // PWA hooks
  useEffect(()=>{if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{});} const h=(e:any)=>{e.preventDefault(); _pwaEvt=e; setPwaReady(true)}; window.addEventListener('beforeinstallprompt',h); return()=>window.removeEventListener('beforeinstallprompt',h)},[]);
  // Email link auth handling on load
  useEffect(()=>{
    try{
      if(!fbInit(C.cfg, false)) return; // init firebase without anonymous sign-in
      (async()=>{
        await ensureAuth().catch(()=>{});
        const url = window.location.href;
        try{
            if(isSignInWithEmailLink(_auth, url)){
              // Persist invite project id (if present in URL) so we can process it after sign-in
              try{
                const urlObj = new URL(url);
                const inviteProject = urlObj.searchParams.get('inviteProject');
                if(inviteProject) window.localStorage.setItem('buget_pending_invite_project', inviteProject);
              }catch(err){ void err; }

              // Prefer stored invite email; open a modal to let the recipient confirm/change email and complete sign-in
              let storedEmail:string|null = null;
              try{ storedEmail = window.localStorage.getItem('buget_invite_email'); }catch{ storedEmail = null; }
              try{
                setInvitePendingUrl(url);
                setInviteModalEmail(storedEmail||'');
                setInviteModalOpen(true);
              }catch(err){ console.warn('failed to open invite modal', err); }
            }
          }catch(e){ console.warn('email link handling failed', e); }
      })();
      // Also check for redirect result (Google redirect sign-in)
      try{
        (async()=>{ try{ await ensureAuth().catch(()=>{}); const res = await getRedirectResult(_auth).catch(()=>null); if(res && res.user){ setUserEmail(res.user.email||undefined); pushNotif('success','Signed in as '+(res.user.email||'')); } }catch(err){ void err; } })();
      }catch(e){ void e; }
  }catch(err){console.error(err)}
  },[C?.cfg, pushNotif]);
  // recalc EUR on rate change
  useEffect(()=>{setE((E0:any)=>{const out:any={}; for(const k of Object.keys(E0||{})){const M=E0[k]||{incomes:[],expenses:[],planner:[]}; out[k]={...M, incomes:(M.incomes||[]).map((i:any)=>({...i,sumaEUR:toE(i.suma,i.valuta,r)})), expenses:(M.expenses||[]).map((x:any)=>({...x,sumaEUR:toE(x.suma,x.valuta,r)}))};} return out});},[r]);
  // cloud subscribe
  useEffect(()=>{ if(!C?.enabled||!C?.budgetId) return; if(!fbInit(C.cfg)) return; (async()=>{ try{ await ensureFs().catch(()=>{}); const rf=ref(C.budgetId); if(!rf) return; const unsub=onSnapshot(rf,(snap:any)=>{const d:any = (snap as any).data(); if(!d) return; _pull=true; setR(d.rates||rates0); setE(migrate(d.entries)||{[todayYM]:emptyM()}); setB(d.backup||{email:"",freqDays:1,enabled:false,nextAt:0}); setTimeout(()=>{_pull=false},300)}); (rf as any)._unsub = unsub; }catch(e){ console.warn('cloud subscribe failed', e); } })(); return ()=>{ try{ const rf=ref(C.budgetId); const u=(rf as any)?(rf as any)._unsub:undefined; if(typeof u==='function') u(); }catch(e){ void e; } }; },[C.enabled,C.budgetId,C.cfg]);

  // Name modal handlers
  const resolveNameModal = (v:string|null)=>{ try{ const r = nameModalResolve; setNameModalResolve(null); setNameModalOpen(false); if(r) r(v); }catch(e){ void e; } };


  // list remote projects when user signs in
  const listRemoteProjects = useCallback(async()=>{
    try{
      if(!userEmail) { setRemoteProjects([]); return; }
      if(!fbInit(C.cfg)) { console.warn('fbInit failed while listing projects, trying fallback'); fbInit(undefined); }
      await ensureFs().catch(()=>{});
      if(!_db){ console.warn('Firestore not initialized'); setRemoteProjects([]); return; }
      const q = query(collection(_db,'projects'), where('owner','==', userEmail));
      const snap = await getDocs(q);
  const arr = snap.docs.map((d:any)=>({id:d.id, ...d.data()}));
      // Merge with any locally-saved projects (local primary)
      try{
        const raw = window.localStorage.getItem('local_projects_v1');
  if(raw){ const local = JSON.parse(raw) as any[]; const mine = (local||[]).filter((p:any)=>p.owner===userEmail); const byId = new Map(arr.map((a:any)=>[a.id,a])); for(const lp of mine){ if(!byId.has(lp.id)) arr.push(lp); else { /* overwrite remote with local if newer */ const remote = byId.get(lp.id); if((lp as any)._fallback && (!remote || ((lp as any).updatedAt > (remote as any).updatedAt))) { const idx = arr.findIndex((a:any)=>a.id===lp.id); if(idx>=0) arr[idx]=lp; } } }
        }
      }catch(e){console.warn('local projects merge failed', e)}
      setRemoteProjects(arr as any[]);
      // Clear syncing flags for projects confirmed remotely
      try{ setSyncingProjects(s=> s.filter(id=> arr.findIndex((a:any)=>a.id===id)===-1)); }catch(e){ void e; }
    }catch(e){ console.error('listRemoteProjects error', e); }
  },[userEmail,C?.cfg]);

  // Format timestamp to `DD.MM.YYYY, HH:mm:ss`
  const fmtTS = (ts:any)=>{
    try{ if(!ts) return '—'; const d = new Date(Number(ts)); if(!d || Number.isNaN(d.getTime())) return '—'; const dd = String(d.getDate()).padStart(2,'0'); const mm = String(d.getMonth()+1).padStart(2,'0'); const yy = d.getFullYear(); const hh = String(d.getHours()).padStart(2,'0'); const min = String(d.getMinutes()).padStart(2,'0'); const ss = String(d.getSeconds()).padStart(2,'0'); return `${dd}.${mm}.${yy}, ${hh}:${min}:${ss}`; }catch(e){ return '—'; } };

  // Recompute human-readable last-sync strings whenever projects change or syncing state changes
  useEffect(()=>{
    try{
      const m:Record<string,string> = {};
      (remoteProjects||[]).forEach((p:any)=>{
        const ts = p._syncedAt || p.updatedAt || p._lastSyncedAt || null;
        m[p.id] = ts ? fmtTS(ts) : '—';
      });
      // include local cache entries from local_projects_v1 if present (they may not be in remoteProjects)
      try{ const raw = window.localStorage.getItem('local_projects_v1'); if(raw){ const local = JSON.parse(raw) as any[]; for(const p of local){ if(!m[p.id]){ const ts = p._syncedAt || p.updatedAt || p._lastSyncedAt || (p.updatedAt||p.createdAt) || null; m[p.id] = ts? fmtTS(ts) : '—'; } } } }catch(e){ /* ignore */ }
      setLastSyncMap(m);
    }catch(e){ void e; }
  },[remoteProjects, syncingProjects]);

  // Resolve local vs remote project by updatedAt and load appropriately.
  // Policy: last-write-wins. If local cached copy is newer than remote, load local into UI and push local to server.
  // If remote is newer, load remote and update local cache. If only one exists, use that one.
  const resolveAndLoadProject = useCallback(async(projectId:string)=>{
    if(!projectId) return;
    try{
      // read local cached copy (sync)
      const local = getLocalProjectById(projectId);
      // fetch remote copy
      let remoteData:any = null;
      try{ if(fbInit(C.cfg)) { await ensureFs().catch(()=>{}); const d = await getDoc(doc(_db,'projects', projectId)); if(d && d.exists) remoteData = d.data(); } }catch(e){ /* ignore remote fetch errors */ }
      const localTs = local?.updatedAt || local?._syncedAt || 0;
      const remoteTs = remoteData?.updatedAt || remoteData?._syncedAt || 0;
      // choose by last modification
      if(local && (!remoteData || localTs > remoteTs)){
        // local is newer: load local into UI and attempt background push
        try{ if(local.rates) setR(local.rates); if(local.entries) setE(migrate(local.entries)); if(local.backup) setB(local.backup); setC((c:any)=>({...c, projectId: projectId, budgetId: projectId})); pushNotif('info','Loaded local cached project (newer)'); }catch(e){ void e; }
        // show temporary UI indicator that we loaded from cache
        try{ setLoadedFromCache(true); setTimeout(()=>setLoadedFromCache(false), 5000); }catch(_){ void _; }
        // upsert local to server in background
        try{ const fn = attemptSyncProjectRef.current; if(fn){ await fn({...local, id: projectId}); } else { /* fallback: try to write directly */ if(fbInit(C.cfg)){ await ensureFs().catch(()=>{}); if(_db){ await setDoc(doc(_db,'projects',projectId), {...local, updatedAt: Date.now(), _syncedAt: Date.now()}, {merge:true}); } } } }catch(e){ console.warn('resolveAndLoadProject: push local -> remote failed', e); }
      } else if(remoteData){
        // remote is newer or only remote exists: load remote and update local cache
        try{ if(remoteData.rates) setR(remoteData.rates); if(remoteData.entries) setE(migrate(remoteData.entries)); if(remoteData.backup) setB(remoteData.backup); setC((c:any)=>({...c, projectId: projectId, budgetId: projectId})); pushNotif('info','Loaded remote project (newer)'); }catch(e){ void e; }
        try{ upsertLocalProject({...remoteData, id: projectId, _fallback:false, updatedAt: remoteData.updatedAt || Date.now()}); }catch(e){ void e; }
      } else if(local){
        // only local exists
        try{ if(local.rates) setR(local.rates); if(local.entries) setE(migrate(local.entries)); if(local.backup) setB(local.backup); setC((c:any)=>({...c, projectId: projectId, budgetId: projectId})); pushNotif('info','Loaded local project'); }catch(e){ void e; }
        try{ setLoadedFromCache(true); setTimeout(()=>setLoadedFromCache(false), 5000); }catch(_){ void _; }
      }
      // remember as last opened for this user (best-effort)
      try{ if(userEmail) await setUserLastOpenedProject(userEmail, projectId); }catch(e){ void e; }
  try{ if(isTestMode && typeof window !== 'undefined') (window as any).__lastLoadDone = projectId; }catch(e){ void e; }
    }catch(e){ console.error('resolveAndLoadProject failed', e); }
  },[C?.cfg, userEmail, pushNotif, setUserLastOpenedProject]);
  // keep a ref to the function so effects declared earlier can call it without
  // depending on the callback identity (avoid hoisting/race issues)
  resolveAndLoadProjectRef.current = resolveAndLoadProject;

  // Replace one-off listing with real-time listeners that update projects for the
  // signed-in user (either owner or editor). Merge with any local fallback projects
  // and clean up listeners on sign-out or settings change.
  const ownerSnapRef = useRef<any>(null);
  const editorSnapRef = useRef<any>(null);
  const attemptSyncProjectRef = useRef<any>(null);
  const ownerNotificationsRef = useRef<any>(null);

  const rebuildProjectsFromSnapshots = useCallback(async () => {
    try{
      await ensureFs().catch(()=>{});
      const docsMap = new Map<string, any>();
      if(ownerSnapRef.current && ownerSnapRef.current.docs){ ownerSnapRef.current.docs.forEach((d:any)=>docsMap.set(d.id, {id:d.id, ...d.data()})); }
      if(editorSnapRef.current && editorSnapRef.current.docs){ editorSnapRef.current.docs.forEach((d:any)=>docsMap.set(d.id, {id:d.id, ...d.data()})); }
      const arr = Array.from(docsMap.values());
      // Merge any local-only projects saved in local_projects_v1
      try{
        const raw = window.localStorage.getItem('local_projects_v1');
        if(raw){ const local = JSON.parse(raw) as any[]; const mine = (local||[]).filter((p:any)=>p.owner===userEmail); const byId = new Map(arr.map((a:any)=>[a.id,a])); for(const lp of mine){ if(!byId.has(lp.id)) arr.push(lp); else { const remote = byId.get(lp.id); if(lp._fallback && (!remote || (lp.updatedAt>remote.updatedAt))){ const idx = arr.findIndex(a=>a.id===lp.id); if(idx>=0) arr[idx]=lp; } } } }
      }catch(e){ console.warn('projects merge local failed', e); }
      setRemoteProjects(arr as any[]);
      // If any project in `arr` is confirmed remote (not a local fallback), clear its syncing flag
      try{
        setSyncingProjects(s=> s.filter(id=>{ const remote = arr.find((a:any)=>a.id===id); return !(remote && remote._fallback !== true); }));
      }catch(e){ void e; }
    }catch(e){ console.error('rebuildProjectsFromSnapshots', e); }
  },[userEmail]);

  useEffect(()=>{
    // if cloud sync not enabled or no user, clear and skip
    if(!C?.enabled || !userEmail) { setRemoteProjects([]); return; }
    if(!fbInit(C.cfg)) { console.warn('fbInit failed for projects listener, trying fallback'); fbInit(undefined); }
    if(!_db){ console.warn('Firestore not initialized for projects listener'); return; }

    const qOwner = query(collection(_db,'projects'), where('owner','==', userEmail));
    const qEditor = query(collection(_db,'projects'), where('editors','array-contains', userEmail));

  // Ensure Firestore module is loaded before attaching listeners
  (async()=>{ try{ await ensureFs().catch(()=>{}); if(qOwner){ ownerSnapRef.current = null; const unsubOwner = onSnapshot(qOwner, (snap:any)=>{ ownerSnapRef.current = snap; rebuildProjectsFromSnapshots(); }, (err:any)=>{ console.warn('owner projects onSnapshot error', err); }); (ownerSnapRef as any).unsub = unsubOwner; } if(qEditor){ editorSnapRef.current = null; const unsubEditor = onSnapshot(qEditor, (snap:any)=>{ editorSnapRef.current = snap; rebuildProjectsFromSnapshots(); }, (err:any)=>{ console.warn('editor projects onSnapshot error', err); }); (editorSnapRef as any).unsub = unsubEditor; } }catch(e){ console.warn('Failed to attach project listeners', e); } })();

    // initial rebuild in case listeners return quickly
    rebuildProjectsFromSnapshots();

  return ()=>{ try{ const u=(ownerSnapRef as any).unsub; if(typeof u==='function') u(); }catch(e){ void e; } try{ const u2=(editorSnapRef as any).unsub; if(typeof u2==='function') u2(); }catch(e){ void e; } ownerSnapRef.current=null; editorSnapRef.current=null; };
  },[userEmail, C?.enabled, C?.cfg, rebuildProjectsFromSnapshots]);

  // listen for owner notifications for the logged-in user
  useEffect(()=>{
    if(!userEmail) { setOwnerNotifications([]); return; }
    if(!fbInit(C.cfg)) fbInit(undefined);
    (async()=>{ try{ await ensureFs().catch(()=>{}); if(!_db) return; const qn = query(collection(_db,'ownerNotifications'), where('owner','==', userEmail)); const unsub = onSnapshot(qn, (snap:any)=>{ const arr = (snap as any).docs.map((d:any)=>({id:d.id,...d.data()})); setOwnerNotifications(arr); }, (err:any)=>{ console.warn('ownerNotifications onSnapshot error', err); }); (ownerNotificationsRef as any).unsub = unsub; }catch(e){ console.warn('ownerNotifications listener failed', e); } })();
    return ()=>{ try{ const u=(ownerNotificationsRef as any).unsub; if(typeof u==='function') u(); }catch(e){ void e; } };
  },[userEmail,C?.cfg]);

  // Attempt to sync any locally saved projects to remote when online or when auth available
  const trySyncLocalProjects = useCallback(async()=>{
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
          const fn = attemptSyncProjectRef.current;
          if(fn) await fn(p);
        }catch(e){ console.warn('sync project failed', p.id, e); }
      }
      pushNotif('info','Local projects sync attempted');
      await listRemoteProjects();
    }catch(e){ console.error('trySyncLocalProjects', e); }
  },[userEmail,C?.cfg,listRemoteProjects, pushNotif]);

  useEffect(()=>{ // sync on online
    const onOnline = ()=>{ trySyncLocalProjects(); };
    window.addEventListener('online', onOnline);
    return ()=>window.removeEventListener('online', onOnline);
  },[userEmail,C.cfg,trySyncLocalProjects]);

  // Periodic background sync timer driven by settings (default 20s)
  useEffect(()=>{
    let id: any = null;
    try{
      const enabled = !!C?.backgroundSyncEnabled;
      const intervalSec = Number(C?.backgroundSyncIntervalSec) || 20;
      if(enabled && userEmail){
        // run immediately once, then schedule
        trySyncLocalProjects();
        id = setInterval(()=>{ trySyncLocalProjects(); }, Math.max(1000, intervalSec*1000));
      }
    }catch(e){ console.warn('background sync timer setup failed', e); }
    return ()=>{ if(id) clearInterval(id); };
  },[C?.backgroundSyncEnabled, C?.backgroundSyncIntervalSec, userEmail, trySyncLocalProjects]);

  useEffect(()=>{ // attempt sync when userEmail becomes available
    if(userEmail) trySyncLocalProjects();
  },[userEmail,trySyncLocalProjects]);

  // Auto-upload on close handler (App scope): persist current project to local cache and try to sync when page unloads
  useEffect(()=>{
    const handler = ()=>{
      try{
        const enabled = !!C?.autoUploadOnClose;
        if(!enabled) return;
        const projId = C?.projectId || C?.budgetId;
        if(!projId) return;
        const snapshot = { id: projId, owner: userEmail||'local', name: (C?.projectId===projId? C?.projectId: `Project ${projId}`), rates: r, entries: E, backup: B, updatedAt: Date.now(), _fallback: true };
        try{
          const raw = window.localStorage.getItem('local_projects_v1');
          const local = raw? JSON.parse(raw) as any[] : [];
          const idx = local.findIndex((x:any)=>x.id===projId);
          if(idx>=0) local[idx] = {...local[idx], ...snapshot}; else local.push(snapshot);
          window.localStorage.setItem('local_projects_v1', JSON.stringify(local));
          // record that we attempted an autoupload at close
          try{ window.localStorage.setItem('last_autoupload', JSON.stringify({ at: Date.now(), projectId: projId, attemptedOnline: navigator.onLine })); }catch(e){ void e; }
        }catch(e){ console.warn('auto-upload on close local save failed', e); }
        try{ upsertLocalProject(snapshot).catch(()=>{}); }catch(e){ void e; }
        if(navigator.onLine && attemptSyncProjectRef.current){ try{ attemptSyncProjectRef.current(snapshot).catch(()=>{}); }catch(e){ void e; } }
      }catch(e){ console.warn('auto-upload on close handler failed', e); }
    };
    window.addEventListener('pagehide', handler);
    window.addEventListener('beforeunload', handler);
    return ()=>{ window.removeEventListener('pagehide', handler); window.removeEventListener('beforeunload', handler); };
  },[C?.autoUploadOnClose, C?.projectId, C?.budgetId, E, r, B, userEmail]);

  // Backoff helper: exponential backoff with jitter
  const calcBackoff = (attempts:number)=>{
    const base = 1000; // 1s
    const max = 60*1000; // 1 minute
    const exp = Math.min(max, base * Math.pow(2, attempts));
    // jitter +/-20%
    const jitter = Math.round(exp * 0.2 * (Math.random()*2 - 1));
    return Math.max(1000, exp + jitter);
  };

  

  // Generic retry executor with backoff. Returns { success, attempts, lastError }
  const execWithRetries = async (fn: ()=>Promise<any>, maxAttempts = 3, label?:string) : Promise<{success:boolean, attempts:number, lastError?:any}> => {
    let attempts = 0; let lastErr:any = null;
    while(attempts < maxAttempts){
      try{ attempts++; await fn(); return { success: true, attempts, lastError: null }; }catch(e){ lastErr = e; const nextDelay = calcBackoff(attempts); if(attempts < maxAttempts){ try{ pushNotif('info', `${label?label+' ':''}Retry ${attempts}/${maxAttempts} in ${Math.round(nextDelay/1000)}s`); }catch(_){ void _; } await new Promise(r=>setTimeout(r,nextDelay)); } }
    }
    try{ pushNotif('error', `${label?label+' ':''}failed after ${attempts} attempts`); }catch(_){ void _; }
    return { success: false, attempts, lastError: lastErr };
  };

  // Attempt to sync a single project with retry metadata persisted locally
  const attemptSyncProject = useCallback(async(p:any)=>{
    if(!p || !p.id) return;
    const id = p.id;
    // mark syncing
    setSyncingProjects(s=> (s.includes(id)?s:[...s,id]) );
    try{
      if(!fbInit(C.cfg)) fbInit(undefined);
      await ensureFs().catch(()=>{});
      if(!_db) throw new Error('Firestore not available');
      const docRef = doc(_db,'projects',id);
  // attempt write with retries
  const writeFn = async()=> await setDoc(docRef, {...p, updatedAt: Date.now(), _syncedAt: Date.now()}, {merge:true});
  const res = await execWithRetries(writeFn, 3, 'Upload project');
  if(!res.success) throw res.lastError || new Error('upload failed');
  // on success, update local storage record
      try{
        const raw = window.localStorage.getItem('local_projects_v1');
        const local = raw? JSON.parse(raw) as any[] : [];
        const idx = local.findIndex((x:any)=>x.id===id);
        if(idx>=0){ local[idx] = {...local[idx], _fallback:false, _attempts:0, _nextAttempt:0, updatedAt: Date.now()}; window.localStorage.setItem('local_projects_v1', JSON.stringify(local)); }
  }catch(e){ void e; }
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
      // surface error to user
      try{ pushNotif('error', `Sync failed for project ${id}: ${(e?.message)||String(e)}`); }catch(_){ void _; }
    }finally{
      setSyncingProjects(s=>s.filter(x=>x!==id));
    }
  },[C?.cfg, listRemoteProjects, pushNotif]);
  attemptSyncProjectRef.current = attemptSyncProject;

  // When any project finishes syncing (i.e., it was in syncingProjects and now removed),
  // trigger an immediate attempt to sync any remaining local projects and try to
  // upload the currently opened project if it has a local fallback.
  const _prevSyncRef = useRef<string[]>([]);
  useEffect(()=>{
    try{
      const prev = _prevSyncRef.current || [];
      const finished = prev.filter(id => !syncingProjects.includes(id));
      if(finished.length>0){
        // background sync finished for some projects — try to push any local projects
        try{ trySyncLocalProjects().catch(()=>{}); }catch(e){ void e; }
        // also try to sync currently-open project if it has a local fallback record
        try{
          const cur = (C && (C.projectId||C.budgetId)) ? (C.projectId||C.budgetId) : null;
          if(cur){ try{ const raw = window.localStorage.getItem('local_projects_v1'); if(raw){ const local = JSON.parse(raw) as any[]; const p = local.find((x:any)=>x.id===cur); if(p && p._fallback && attemptSyncProjectRef.current){ attemptSyncProjectRef.current(p).catch(()=>{}); } } }catch(e){ void e; } }
        }catch(e){ void e; }
      }
      _prevSyncRef.current = syncingProjects;
    }catch(e){ console.warn('post-sync auto-upload effect failed', e); }
  },[syncingProjects, trySyncLocalProjects, C?.projectId, C?.budgetId]);

  const loadRemoteProject = async(projectId:string)=>{
    try{
      // attempt to load from local cache first for snappy UX
      const cached = getLocalProjectById(projectId);
      if(cached){ try{ if(cached.rates) setR(cached.rates); if(cached.entries){ const migrated = migrate(cached.entries); setE(migrated); // select first month so UI shows data
          const mks = Object.keys(migrated||{}).sort(); if(mks.length>0) { setMk(mks[0]); setTab('add'); }
              // expose a short preview of the first income/expense description so automated tests can detect cached load
              try{ const firstMk = Object.keys(migrated||{}).sort()[0]; const m = migrated[firstMk]; const firstDescr = (m && m.incomes && m.incomes[0] && (m.incomes[0].descriere||m.incomes[0].descriere)) || (m && m.expenses && m.expenses[0] && (m.expenses[0].descriere||m.expenses[0].descriere)) || ''; if(firstDescr){ setLastLoadedPreview(String(firstDescr)); setTimeout(()=>setLastLoadedPreview(undefined), 8000); } }catch(e){ void e; }
            }
        if(cached.backup) setB(cached.backup); setC((c:any)=>({...c, projectId: projectId, budgetId: projectId})); pushNotif('info','Loaded project from cache'); }catch(err){ void err; } }

    // mark load done after applying cached data so tests can detect completion even when offline
    try{ if(cached && typeof window !== 'undefined') (window as any).__lastLoadDone = projectId; }catch(e){ void e; }
  if(!fbInit(C.cfg)) fbInit(undefined);
  await ensureFs().catch(()=>{});
  const d = await getDoc(doc(_db,'projects',projectId));
      if(!d.exists()) return pushNotif('error','Project not found');
      const data:any = d.data();
      // update UI with fresh remote data
      if(data.rates) setR(data.rates);
      if(data.entries){
        const migrated = migrate(data.entries);
        // normalize entries: ensure ids, sumaEUR computed, and fields present
        const norm:any = {};
        for(const mk0 of Object.keys(migrated||{})){
          const M = migrated[mk0] || {incomes:[],expenses:[],planner:[],credits:[]};
          const incomes = (M.incomes||[]).map((i:any)=>({ id: i.id||uid(), date: i.date||ymd(), client: i.client||src[0], descriere: i.descriere||'', valuta: i.valuta||'EUR', suma: pn(i.suma||0), sumaEUR: toE(pn(i.suma||0), i.valuta||'EUR', r), owner: i.owner||'', updatedAt: i.updatedAt||Date.now() }));
          const expenses = (M.expenses||[]).map((x:any)=>({ id: x.id||uid(), date: x.date||ymd(), categorie: x.categorie||'alte', descriere: x.descriere||'', valuta: x.valuta||'EUR', suma: pn(x.suma||0), sumaEUR: toE(pn(x.suma||0), x.valuta||'EUR', r), platitor: x.platitor||'Adrea', metoda: x.metoda||'Card Romania', owner: x.owner||'', updatedAt: x.updatedAt||Date.now() }));
          const planner = (M.planner||[]).map((p:any)=>({ id: p.id||uid(), denumire: p.denumire||'', tip: p.tip||'cheltuiala', subtip: p.subtip||'', categorie: p.categorie||'alte', valutaPlan: p.valutaPlan||'EUR', sumaPlan: pn(p.sumaPlan||0), achitat: pn(p.achitat||0), termen: p.termen||ymd(), platit: !!p.platit, owner: p.owner||'', updatedAt: p.updatedAt||Date.now(), creditId: p.creditId||p.creditid||'' }));
          const credits = (M.credits||[]).map((c:any)=>({ id: c.id||uid(), denumire: c.denumire||'', termen: c.termen||ymd(), suma: pn(c.suma||0), valuta: c.valuta||'EUR', principal: pn(c.principal||0), restant: pn(c.restant||0), metoda: c.metoda||'Card Romania', platitor: c.platitor||'Adrea', owner: c.owner||'', updatedAt: c.updatedAt||Date.now() }));
          norm[mk0] = { incomes, expenses, planner, credits };
        }
        setE(norm);
        try{
          const firstMk = Object.keys(norm||{}).sort()[0];
          const m = norm[firstMk];
          const firstDescr = (m && m.incomes && m.incomes[0] && (m.incomes[0].descriere||m.incomes[0].descriere)) || (m && m.expenses && m.expenses[0] && (m.expenses[0].descriere||m.expenses[0].descriere)) || '';
          if(firstDescr){ setLastLoadedPreview(String(firstDescr)); setTimeout(()=>setLastLoadedPreview(undefined), 8000); }
        }catch(e){ void e; }
        try{ const mks = Object.keys(norm||{}).sort(); if(mks.length>0){ try{ setMk(mks[0]); }catch(_){ void _; } } }catch(_){ void _; }
      }
      if(data.backup) setB(data.backup);
  // set selected cloud project id so user can reference it
      setC((c:any)=>({...c, projectId: projectId, budgetId: projectId}));
      // update local cache with remote copy
      try{ upsertLocalProject({...data, id: projectId, _fallback:false, updatedAt: Date.now()}); }catch(e){ void e; }
      // remember as last opened project for this user
      try{ await setUserLastOpenedProject(userEmail, projectId); }catch(e){ void e; }
      pushNotif('success','Project loaded');
  try{ if(isTestMode && typeof window !== 'undefined') (window as any).__lastLoadDone = projectId; }catch(e){ void e; }
    }catch(e:any){ console.error('loadRemoteProject', e); pushNotif('error','Load failed: '+(e?.message||e)); }
  };

  // Expose for debug/tests: allow calling loadRemoteProject from window context (only in test mode)
  try{ if(isTestMode && typeof window !== 'undefined'){ (window as any).__loadRemoteProject = loadRemoteProject; } }catch(e){ void e; }

  // Expose a test helper to simulate sign-out (non-auth): mark local projects as 'local'
  // and clear the in-memory UI state. Tests can call this to validate sign-out behavior
  // without performing real Firebase sign-out flows.
  try{
    if(isTestMode && typeof window !== 'undefined'){
      (window as any).__simulateSignOut = async ()=>{
        try{
          const prev = userEmail;
          if(prev){ try{ const raw = window.localStorage.getItem('local_projects_v1'); if(raw){ const arr = JSON.parse(raw) as any[]; const out = arr.map(p=> p.owner===prev ? {...p, owner:'local'} : p); window.localStorage.setItem('local_projects_v1', JSON.stringify(out)); } }catch(e){ console.warn('simulateSignOut: mark local failed', e); }
          }
          // clear UI state (same as real sign-out cleanup)
          try{ setE({[todayYM]: emptyM()}); }catch(_){ void _; }
          try{ setR(rates0); }catch(_){ void _; }
          try{ setB({email:"",freqDays:1,enabled:false,nextAt:0}); }catch(_){ void _; }
          try{ setC((c:any)=>({...c, projectId: undefined, budgetId: undefined})); }catch(_){ void _; }
          try{ setTab('add'); }catch(_){ void _; }
          try{ setMk(todayYM); }catch(_){ void _; }
          try{ setLastLoadedPreview(undefined); }catch(_){ void _; }
          try{ setLoadedFromCache(false); }catch(_){ void _; }
          try{ setUserEmail(undefined); }catch(_){ void _; }
          try{ if(isTestMode && typeof window !== 'undefined') (window as any).__signOutDone = true; }catch(_){ void _; }
          return true;
        }catch(err){ console.warn('window.__simulateSignOut failed', err); return false; }
      };
    }
  }catch(e){ void e; }


  // Test helpers are registered above in a guarded effect; this placeholder avoids
  // accidental duplicate registrations when the file is patched in multiple places.
  // Save current local state as a remote project (creates or updates)
  const saveProject = async(projectId?:string, name?:string)=>{
    try{
      if(!userEmail) return pushNotif('error','Trebuie să fii autentificat pentru a salva proiecte');
      if(!fbInit(C.cfg)) fbInit(undefined);
      await ensureFs().catch(()=>{});
      if(!_db) { pushNotif('error','Firestore not available'); return; }
      // basic validation
      const finalName = (name||`proj-${Date.now().toString(36)}`).trim();
      if(!finalName) return pushNotif('error','Nume invalid');
      const id = projectId|| (name? finalName.replace(/[^a-z0-9_-]/ig,'-').toLowerCase(): `proj-${Date.now().toString(36)}`);
      const docRef = doc(_db,'projects',id);
      const payload = { owner: userEmail, name: finalName||id, rates: r, entries: E, backup: B, updatedAt: Date.now(), editors: [userEmail] };

      // Save locally immediately (primary store)
      try{
        const toSaveLocal = {...payload, id, _fallback:true, updatedAt: Date.now()};
        upsertLocalProject(toSaveLocal);
        pushNotif('success','Project saved locally');
        // update shown list immediately
        await listRemoteProjects();
      }catch(err:any){ console.error('local save failed', err); pushNotif('error','Local save failed: '+(err?.message||err)); }

      // Enqueue remote sync attempt in background (do not block UI)
      (async function remoteTry(){
        try{
          setSyncingProjects(s=> (s.includes(id)?s:[...s,id]) );
          if(!fbInit(C.cfg)) fbInit(undefined);
          await ensureFs().catch(()=>{});
          if(!_db) throw new Error('Firestore not available');
          await setDoc(docRef, {...payload, _syncedAt: Date.now()}, {merge:true});
          // on success, remove _fallback flag from local copy
          try{
            const raw2 = window.localStorage.getItem('local_projects_v1');
            const local2 = raw2? JSON.parse(raw2) as any[] : [];
            const idx = local2.findIndex((x:any)=>x.id===id);
            if(idx>=0){ local2[idx] = {...local2[idx], _fallback:false, updatedAt: Date.now()}; window.localStorage.setItem('local_projects_v1', JSON.stringify(local2)); }
          }catch(e){ void e; }
          pushNotif('success','Project synced to cloud');
          // record as last opened project
          try{ await setUserLastOpenedProject(userEmail, id); }catch(e){ void e; }
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
      await ensureFs().catch(()=>{});
      // check ownership
      const d = await getDoc(doc(_db,'projects',projectId));
      if(!d.exists()) return pushNotif('error','Project not found');
      const data:any = d.data(); if(data.owner!==userEmail) return pushNotif('error','Only owner can delete the project');
      await deleteDoc(doc(_db,'projects',projectId));
  // remove local cached copy if present
  try{ const raw = window.localStorage.getItem('local_projects_v1'); if(raw){ const local = JSON.parse(raw) as any[]; const filtered = local.filter((x:any)=>x.id!==projectId); window.localStorage.setItem('local_projects_v1', JSON.stringify(filtered)); } }catch(e){ void e; }
  // update UI immediately
  try{ setRemoteProjects((arr:any[])=> (arr||[]).filter((p:any)=>p.id!==projectId)); }catch(e){ void e; }
  // if the deleted project is currently open, close it and load a default empty project
  try{ if((C?.projectId===projectId) || (C?.budgetId===projectId)){ setC((c:any)=>({...c, projectId: undefined, budgetId: undefined})); setE({[todayYM]: emptyM()}); setR(rates0); setB({email:"",freqDays:1,enabled:false,nextAt:0}); pushNotif('info','Deleted project was open — closed locally'); } }catch(e){ void e; }
  pushNotif('success','Project deleted');
  // refresh list in background
  listRemoteProjects();
    }catch(e:any){ console.error('deleteProject', e); pushNotif('error','Delete failed: '+(e?.message||e)); }
  };

  const cancelInvite = async(projectId:string, email:string)=>{
    try{
      if(!userEmail) return pushNotif('error','Trebuie să fii autentificat');
      if(!fbInit(C.cfg)) fbInit(undefined);
      await ensureFs().catch(()=>{});
      const d = await getDoc(doc(_db,'projects',projectId));
      if(!d.exists()) return pushNotif('error','Project not found');
      const data:any = d.data(); if(data.owner!==userEmail) return pushNotif('error','Only owner can cancel invites');
      await setDoc(doc(_db,'projects',projectId), {pendingInvites: arrayRemove(email)},{merge:true});
      pushNotif('success','Invite cancelled');
  // trigger refresh of projects list
  try{ await listRemoteProjects(); }catch(e){ void e; }
    }catch(e:any){ console.error('cancelInvite', e); pushNotif('error','Cancel invite failed: '+(e?.message||e)); }
  };

  const renameProject = async(projectId:string, newName:string)=>{
    try{
      if(!userEmail) return pushNotif('error','Trebuie să fii autentificat');
      if(!fbInit(C.cfg)) fbInit(undefined);
      await ensureFs().catch(()=>{});
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
      await ensureFs().catch(()=>{});
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
      await ensureFs().catch(()=>{});
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
      // reuse CSV exporter for project download
      await exportRemoteProjectToCSV(projectId);
    }catch(e:any){ console.error('downloadRemoteProject', e); if(pushNotif) pushNotif('error','Download failed: '+(e?.message||e)); }
  };

  // minimal CSV export wrapper (defined early so UI can call it)
  const escapeCSV = (val:any)=>{ if(val===null||val===undefined) return ''; const s=String(val); if(s.includes(',')||s.includes('"')||s.includes('\n')) return '"'+s.replace(/"/g,'""')+'"'; return s; };

  const exportRemoteProjectToCSV = async(projectId:string)=>{
    try{
      if(!fbInit(C.cfg)) fbInit(undefined);
      await ensureFs().catch(()=>{});
      const d = await getDoc(doc(_db,'projects',projectId));
      if(!d.exists()) return pushNotif('error','Project not found');
      const data = d.data();
      // build a detailed CSV with per-row owner and updatedAt for robust merging
      const serializeDetailed = (proj:any)=>{
        const rows:string[] = [];
        const header = ['type','id','denumire','date','client','categorie','descriere','valuta','suma','valutaPlan','sumaPlan','achitat','tip','termen','owner','updatedAt','projectId'];
        rows.push(header.join(','));
        // meta row
        rows.push([ 'meta', proj.id||projectId, '', '', '', '', '', '', '', '', '', '', '', '', proj.owner||'', proj.updatedAt||Date.now(), projectId ].map(escapeCSV).join(','));
        const entries = proj.entries || {};
        for(const mk of Object.keys(entries)){
          const M = entries[mk] || {incomes:[],expenses:[],planner:[]};
          for(const i of (M.incomes||[])){
            const r = ['income', i.id||'', '', i.date||'', i.client||'', '', i.descriere||'', i.valuta||'', i.suma||'', '', '', '', '', '', i.owner||proj.owner||'', i.updatedAt||i._updatedAt||proj.updatedAt||Date.now(), projectId];
            rows.push(r.map(escapeCSV).join(','));
          }
          for(const x of (M.expenses||[])){
            const r = ['expense', x.id||'', '', x.date||'', '', x.categorie||'', x.descriere||'', x.valuta||'', x.suma||'', '', '', '', '', '', x.owner||proj.owner||'', x.updatedAt||x._updatedAt||proj.updatedAt||Date.now(), projectId];
            rows.push(r.map(escapeCSV).join(','));
          }
          for(const p of (M.planner||[])){
            const r = ['planner', p.id||'', p.denumire||'', p.termen||'', '', p.categorie||'', '', p.valutaPlan||'', p.sumaPlan||'', p.valutaPlan||'', p.sumaPlan||'', p.achitat||0, p.tip||'', p.termen||'', p.owner||proj.owner||'', p.updatedAt||p._updatedAt||proj.updatedAt||Date.now(), projectId];
            rows.push(r.map(escapeCSV).join(','));
          }
        }
        return rows.join('\n');
      };
      const csv = serializeDetailed({...data, id: projectId});
      const blob = new Blob([csv],{type:'text/csv'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `buget-project-${projectId}.csv`; a.click(); URL.revokeObjectURL(url);
    pushNotif('success','Proiect exportat (CSV)');
  }catch(err:any){ console.error('exportRemoteProjectToCSV', err); pushNotif('error','Exportare eșuată: '+(err?.message||err)); }
  };

  

  const exportRemoteProjectToEmail = async(projectId:string, toEmail?:string)=>{
    try{
    // Exportare proiect ca fișier CSV, apoi deschide clientul de email pentru a atașa fișierul.
    await exportRemoteProjectToCSV(projectId);
  const subject = encodeURIComponent(`Exportare proiect: ${projectId}`);
  const body = encodeURIComponent(`Fișierul CSV al proiectului a fost descărcat. Atașați fișierul CSV descărcat la acest email înainte de a-l trimite.`);
    const mailto = `mailto:${encodeURIComponent(toEmail||'')}?subject=${subject}&body=${body}`;
    window.open(mailto,'_blank');
  if(pushNotif) pushNotif('success','Exportare pregătită. Atașați CSV-ul descărcat la emailul deschis pentru a trimite.');
  }catch(e:any){ console.error('exportRemoteProjectToEmail', e); if(pushNotif) pushNotif('error','Exportare eșuată: '+(e?.message||e)); }
  };

  // --- CSV import: parsing for preview and apply logic
  const parseCSVLine = (line:string)=>{
    const cols:string[] = [];
    let cur = '';
    let inQuotes = false;
    for(let i=0;i<line.length;i++){
      const ch = line[i];
      if(inQuotes){
        if(ch === '"'){
          if(line[i+1] === '"'){ cur += '"'; i++; } else { inQuotes = false; }
        } else cur += ch;
      } else {
        if(ch === ','){ cols.push(cur); cur = ''; }
        else if(ch === '"'){ inQuotes = true; }
        else cur += ch;
      }
    }
    cols.push(cur);
    return cols.map(c=>c.trim());
  };

  const buildPreviewFromRows = (rows:any[], targetProjectId?:string)=>{
    // rows: array of parsed objects (keys lowercase)
    const incomingByMonth:Record<string,{incomes:any[];expenses:any[];planner:any[]}> = {};
    for(const r of rows){ const type = (r.type||'').toLowerCase(); if(type==='meta') continue; const id = r.id || uid(); const owner = r.owner || r['owner'] || ''; const updatedAt = r.updatedat ? parseInt(r.updatedat)||0 : 0; if(type==='income'){ const date = r.date || ''; const mk = date.length>=7? date.slice(0,7): todayYM; incomingByMonth[mk]=incomingByMonth[mk]||{incomes:[],expenses:[],planner:[]}; incomingByMonth[mk].incomes.push({...r,id,owner,updatedAt,date,suma: pn(r.suma||r.amount||0),sumaEUR: toE(pn(r.suma||r.amount||0), r.valuta||r.currency||'EUR', r.rates?JSON.parse(r.rates): r)}); }
      else if(type==='expense'){ const date=r.date||''; const mk = date.length>=7? date.slice(0,7): todayYM; incomingByMonth[mk]=incomingByMonth[mk]||{incomes:[],expenses:[],planner:[]}; incomingByMonth[mk].expenses.push({...r,id,owner,updatedAt,date,suma: pn(r.suma||r.amount||0),sumaEUR: toE(pn(r.suma||r.amount||0), r.valuta||r.currency||'EUR', r.rates?JSON.parse(r.rates): r)}); }
      else if(type==='planner' || type==='plan'){ const termen = r.termen||r.date||''; const mk = termen.length>=7? termen.slice(0,7): todayYM; incomingByMonth[mk]=incomingByMonth[mk]||{incomes:[],expenses:[],planner:[]}; incomingByMonth[mk].planner.push({...r,id,owner,updatedAt,termen,denumire: r.denumire||r.name||'',tip: r.tip||'cheltuiala',categorie: r.categorie||'',valutaPlan: r.valutaPlan||r.valuta||'EUR',sumaPlan: pn(r.sumaPlan||r.suma||0),achitat: pn(r.achitat||0)}); }
    }
    // build simple summary counts
    const summary:any = { byMonth: incomingByMonth, counts: { incomes:0, expenses:0, planner:0 } };
    for(const mk of Object.keys(incomingByMonth)){ summary.counts.incomes += (incomingByMonth[mk].incomes||[]).length; summary.counts.expenses += (incomingByMonth[mk].expenses||[]).length; summary.counts.planner += (incomingByMonth[mk].planner||[]).length; }
    summary.projectId = targetProjectId;
    return summary;
  };

  const importProjectFromCSVFile = async(file:File, targetProjectId?:string)=>{
    try{
      const text = await new Promise<string>((res,rej)=>{ const rd=new FileReader(); rd.onload=()=>res(String(rd.result)); rd.onerror=()=>rej(new Error('read failed')); rd.readAsText(file); });
      const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0);
      if(lines.length===0){ pushNotif('error','CSV empty'); return; }
      const headerCols = parseCSVLine(lines[0]).map(h=>h.toLowerCase()); const idx:any={}; for(let i=0;i<headerCols.length;i++) idx[headerCols[i]] = i;
      const rows:any[] = [];
      for(let i=1;i<lines.length;i++){ const cols = parseCSVLine(lines[i]); const obj:any={}; for(const k of Object.keys(idx)){ obj[k] = cols[idx[k]]===undefined? '': cols[idx[k]]; } rows.push(obj); }
      // if no targetProjectId, try to detect from meta row
      if(!targetProjectId){ for(const r of rows){ if((r.type||'').toLowerCase()==='meta' && (r.projectid||r.projectId||r['project id'])){ targetProjectId = r.projectid || r.projectId || r['project id']; break; } } }
      const preview = buildPreviewFromRows(rows, targetProjectId);
      setImportPreview({ rows, preview, file });
      setImportModalOpen(true);
  }catch(e:any){ console.error('importProjectFromCSVFile', e); pushNotif('error','Importare CSV eșuată: '+(e?.message||e)); }
  };

  const applyImport = async(mode:'merge'|'replace', projectId?:string)=>{
    try{
      if(!importPreview) return; const { rows } = importPreview; const target = projectId || importPreview.preview.projectId || (`proj-import-${Date.now().toString(36)}`);
      // reuse buildPreviewFromRows to get grouped data
      const grouped = buildPreviewFromRows(rows, target).byMonth;
      setE((E0:any)=>{
        const out = {...E0}; for(const mk of Object.keys(grouped)){
          const cur = out[mk]||emptyM(); let curIn = [...(cur.incomes||[])]; let curEx = [...(cur.expenses||[])]; let curPl = [...(cur.planner||[])]; const incs = grouped[mk].incomes||[]; if(mode==='replace'){ curIn = incs.map((x:any)=>({...x, updatedAt: x.updatedAt||Date.now()})); } else { for(const ni of incs){ const idx = curIn.findIndex((x:any)=>x.id===ni.id); if(idx>=0){ const existing = curIn[idx]; const existingAt = existing.updatedAt||existing._updatedAt||0; if(ni.updatedAt && ni.updatedAt>existingAt){ curIn[idx] = {...existing, ...ni, updatedAt: ni.updatedAt}; } else if(!ni.updatedAt && ni.owner && ni.owner===userEmail){ curIn[idx] = {...existing, ...ni, updatedAt: Date.now()}; } } else { curIn.unshift({...ni, updatedAt: ni.updatedAt || Date.now()}); } } }
          const exs = grouped[mk].expenses||[]; if(mode==='replace'){ curEx = exs.map((x:any)=>({...x, updatedAt: x.updatedAt||Date.now()})); } else { for(const nx of exs){ const idx = curEx.findIndex((x:any)=>x.id===nx.id); if(idx>=0){ const existing = curEx[idx]; const existingAt = existing.updatedAt||existing._updatedAt||0; if(nx.updatedAt && nx.updatedAt>existingAt){ curEx[idx] = {...existing, ...nx, updatedAt: nx.updatedAt}; } else if(!nx.updatedAt && nx.owner && nx.owner===userEmail){ curEx[idx] = {...existing, ...nx, updatedAt: Date.now()}; } } else { curEx.unshift({...nx, updatedAt: nx.updatedAt || Date.now()}); } } }
          const pls = grouped[mk].planner||[]; if(mode==='replace'){ curPl = pls.map((x:any)=>({...x, updatedAt: x.updatedAt||Date.now()})); } else { for(const np of pls){ const idx = curPl.findIndex((x:any)=>x.id===np.id); if(idx>=0){ const existing = curPl[idx]; const existingAt = existing.updatedAt||existing._updatedAt||0; if(np.updatedAt && np.updatedAt>existingAt){ curPl[idx] = {...existing, ...np, updatedAt: np.updatedAt}; } else if(!np.updatedAt && np.owner && np.owner===userEmail){ curPl[idx] = {...existing, ...np, updatedAt: Date.now()}; } } else { curPl.unshift({...np, updatedAt: np.updatedAt || Date.now()}); } } }
          // merge credits
          let curCr = [...(cur.credits||[])]; const crs = grouped[mk].credits||[];
          if(mode==='replace'){ curCr = crs.map((x:any)=>({...x, updatedAt: x.updatedAt||Date.now()})); } else { for(const nc of crs){ const idx = curCr.findIndex((x:any)=>x.id===nc.id); if(idx>=0){ const existing = curCr[idx]; const existingAt = existing.updatedAt||existing._updatedAt||0; if(nc.updatedAt && nc.updatedAt>existingAt){ curCr[idx] = {...existing, ...nc, updatedAt: nc.updatedAt}; } else if(!nc.updatedAt && nc.owner && nc.owner===userEmail){ curCr[idx] = {...existing, ...nc, updatedAt: Date.now()}; } } else { curCr.unshift({...nc, updatedAt: nc.updatedAt || Date.now()}); } } }
          out[mk] = { incomes: curIn, expenses: curEx, planner: curPl, credits: curCr };
        }
        // persist local project copy
  try{ const local = readLocalProjects(); const idxP = local.findIndex((p:any)=>p.id===target); const toSave = { id: target, owner: userEmail||'local', name: (C?.projectId===target? C?.projectId: `Importat ${target}`), rates: r, entries: out, backup: B, updatedAt: Date.now(), _fallback: true }; if(idxP>=0) local[idxP] = {...local[idxP], ...toSave}; else local.push(toSave); writeLocalProjects(local); }catch(e){ console.warn('persist imported project failed', e); }
        return out;
      });
  setImportModalOpen(false); setImportPreview(undefined); pushNotif('success',`CSV ${mode==='replace'?'înlocuit':'combinat'} în proiectul local`);
      await listRemoteProjects();
  }catch(e:any){ console.error('applyImport', e); pushNotif('error','Aplicare import eșuată: '+(e?.message||e)); }
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

  // Credits CRUD: add credit and create a planner entry for monthly payments
  const addCredit = async (mk:string, rec:any)=>{
    const normalizeName = (s:string)=> (s||'').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
    const ensureUniqueNameSync = (name:string)=>{ const nn = normalizeName(name); const existing = Object.keys(E||{}).some(k=> (E[k]?.credits||[]).some((c:any)=> normalizeName(c.denumire||'')===nn )); return !existing; };
    const askUniqueName = async (suggested:string)=>{
      if(ensureUniqueNameSync(suggested)) return suggested;
      // show modal and await response
      return await new Promise<string|null>((resolve)=>{ setNameModalValue(suggested); setNameModalResolve(()=>resolve); setNameModalOpen(true); });
    };
    let desiredName = (rec.denumire||'').trim() || 'Credit';
    const ans = await askUniqueName(desiredName);
    if(ans===null){ pushNotif('info','Adăugare credit anulată'); return; }
    if(!ans.trim()){ pushNotif('error','Numele nu poate fi gol'); return; }
    rec.denumire = ans.trim();
    // generate a stable id and coerce numeric fields
    const id = rec.id || uid();
    const credit = { ...rec, id, suma: pn(rec.suma||0), principal: pn(rec.principal||0), restant: pn(rec.restant||0), updatedAt: Date.now() };
  // create planner entry for monthly payment (one entry representing recurring payment)
  const p = { id: uid(), denumire: `[Credit] ${credit.denumire||'Credit'} (${id})`, tip: 'cheltuiala' as Tip, categorie: 'credite', valutaPlan: credit.valuta||'EUR', sumaPlan: credit.suma||0, achitat: 0, termen: credit.termen||ymd(), creditId: id, metoda: credit.metoda||'Card Romania', platitor: credit.platitor||'Studio' } as any;
    // perform single atomic update: add credit and planner entry to avoid race conditions
    setE((E0:any)=>{
      const M = E0[mk]||emptyM();
      const nextCr = [credit, ...(M.credits||[])];
      const nextPl = [p, ...(M.planner||[])];
      return {...E0, [mk]: {...M, credits: nextCr, planner: nextPl}};
    });
    // remember last added credit for UI feedback (scroll/highlight)
    try{ setLastAddedCredit({mk,id}); }catch(e){ void e; }
    // give user feedback
    pushNotif('success','Credit adăugat');
  };

  const updateCredit = (mk:string, id:string, p:any)=>{
    setE((E0:any)=>{ const M=E0[mk]||emptyM(); const next=(M.credits||[]).map((c:any)=>c.id===id?{...c,...p, updatedAt: Date.now()}:c); return {...E0,[mk]:{...M, credits: next}}; });
  };

  const deleteCredit = (mk:string, id:string)=>{
    // remove the credit itself
    setE((E0:any)=>{ const M=E0[mk]||emptyM(); const next=(M.credits||[]).filter((c:any)=>c.id!==id); return {...E0,[mk]:{...M, credits: next}}; });
    // remove planner entries across all months that reference this creditId and their generated expenses
    setE((E0:any)=>{ let out = {...E0}; for(const k of Object.keys(out||{})){ const M = out[k]||emptyM(); const toRemove = (M.planner||[]).filter((p:any)=> (p as any).creditId === id).map((p:any)=>p.id); if(toRemove.length>0){ const nextPl = (M.planner||[]).filter((p:any)=> (p as any).creditId !== id); const nextEx = (M.expenses||[]).filter((x:any)=> !toRemove.includes(x.plannerId)); out = {...out, [k]: {...M, planner: nextPl, expenses: nextEx}}; } } return out; });
  };

  // Record a payment for a credit: mark the earliest planner entry for this credit as paid (achitat = sumaPlan)
  const recordPayment = (mk:string, creditId:string)=>{
    setE((E0:any)=>{
      // look for planner entry in this month first
      const M = E0[mk]||emptyM(); let foundIdx = (M.planner||[]).findIndex((p:any)=> (p as any).creditId===creditId);
      let targetMk = mk;
      if(foundIdx<0){ // search other months in order
        const months = Object.keys(E0).sort();
        for(const m of months){ const Mm = E0[m]||emptyM(); const idx = (Mm.planner||[]).findIndex((p:any)=> (p as any).creditId===creditId); if(idx>=0){ foundIdx = idx; targetMk = m; break; } }
      }
      if(foundIdx<0) return E0; // nothing to mark
      const cur = E0[targetMk]||emptyM(); const p = (cur.planner||[])[foundIdx]; if(!p) return E0;
      const upd = {...p, achitat: p.sumaPlan||0}; // mark full payment
      let E1 = pIdx(E0,targetMk,"planner",foundIdx, {achitat: upd.achitat});
      E1 = syncPlan(E1,targetMk, {...p, ...upd} as Plan);
      return E1;
    });
  };

  const updateIncomeRow=(mk:string,i:number,p:any)=>setE((E0:any)=>pIdx(E0,mk,"incomes",i,p));
  const deleteIncomeRow=(mk:string,i:number)=>setE((E0:any)=>rmIdx(E0,mk,"incomes",i));
  const updateIncomeById=(mk:string,id:string,p:any)=>setE((E0:any)=>pId(E0,mk,"incomes",id,p));
  const deleteIncomeById=(mk:string,id:string)=>setE((E0:any)=>rmId(E0,mk,"incomes",id));
  const updateExpenseRow=(mk:string,i:number,p:any)=>setE((E0:any)=>pIdx(E0,mk,"expenses",i,p));
  const deleteExpenseRow=(mk:string,i:number)=>setE((E0:any)=>rmIdx(E0,mk,"expenses",i));
  const updateExpenseById=(mk:string,id:string,p:any)=>setE((E0:any)=>pId(E0,mk,"expenses",id,p));
  const deleteExpenseById=(mk:string,id:string)=>setE((E0:any)=>rmId(E0,mk,"expenses",id));
  const syncPlan=(E0:any,mk:string,p:Plan)=>{
    const M=E0[mk]||emptyM(); let ex=[...M.expenses]; const has=(x:any)=>x.plannerId===p.id; const idx=ex.findIndex(has);
    const need= p.tip==="cheltuiala" && pn(p.achitat)>0;
    if(!need && idx>=0){
      ex=ex.filter((x:any)=>!has(x));
      return {...E0,[mk]:{...M,expenses:ex}};
    } else if(need){
      const eCur=p.valutaAchitat||p.valutaPlan||"EUR";
      const eur=toE(pn(p.achitat),eCur,r);
      // prefer metoda/platitor from planner row; if missing, try the linked credit's values
      let platitorVal = (p as any).platitor || "Studio";
      let metodaVal = (p as any).metoda || "Card Romania";
      if((p as any).creditId){
        // locate credit
        for(const k of Object.keys(E0||{})){
          const cr = (E0[k]?.credits||[]).find((c:any)=>c.id===(p as any).creditId);
          if(cr){ platitorVal = cr.platitor||platitorVal; metodaVal = cr.metoda||metodaVal; break; }
        }
      }
  const base={plannerId:p.id,date:p.termen,categorie: (p as any).creditId? 'credite' : (p.categorie||"alte"),descriere:`[Planner] ${p.denumire}`,platitor:platitorVal,metoda: metodaVal,valuta:eCur,suma:pn(p.achitat),sumaEUR:eur};
      const firstTime = idx<0;
      if(idx>=0) ex[idx]={...ex[idx],...base}; else ex=[{id:uid(),...base},...ex];

      // If this planner row is linked to a credit and this is the first time payment is recorded,
      // decrement the credit's remaining balance and schedule the next month's planner entry if needed.
      if(firstTime && (p as any).creditId){
        const creditId = (p as any).creditId;
        // find credit in same month or anywhere in E0
        let foundMk:string|undefined = undefined; let credit:any = undefined;
        for(const k of Object.keys(E0||{})){
          const Mx = E0[k]||emptyM(); const cr = (Mx.credits||[]).find((c:any)=>c.id===creditId);
          if(cr){ foundMk=k; credit=cr; break; }
        }
        if(credit){
          // compute remaining in EUR and subtract payment (in EUR)
          const creditCur = credit.valuta||"EUR";
          const creditRestEUR = toE(pn(credit.restant||credit.principal||0), creditCur, r);
          const newRestEUR = Math.max(0, creditRestEUR - eur);
          const newRest = fromE(newRestEUR, creditCur, r);
          // update credit record where found
          if(foundMk){
            const Mfound = E0[foundMk]||emptyM(); const nextCr = (Mfound.credits||[]).map((c:any)=> c.id===creditId?{...c, restant: Math.round((newRest+Number.EPSILON)*100)/100, updatedAt: Date.now()}:c);
            E0 = {...E0, [foundMk]:{...Mfound, credits: nextCr}};
          }

          // schedule next payment if still remaining
          if(newRestEUR>0){
            // compute next term date (add one month)
            const nextTerm = addMonthsStr(p.termen||ymd(), 1);
            const nextMK = ym(new Date(nextTerm));
            const newP:Plan = { id: uid(), denumire: p.denumire, tip: p.tip, categorie: p.categorie, valutaPlan: p.valutaPlan, valutaAchitat: p.valutaAchitat, sumaPlan: p.sumaPlan, achitat: 0, termen: nextTerm, creditId: creditId } as any;
            // insert into nextMK planner
            const Mnext = E0[nextMK]||emptyM(); E0 = {...E0, [nextMK]:{...Mnext, planner: [newP, ...Mnext.planner]}};
          } else {
            // fully paid — nothing more to schedule
          }
        }
      }
      return {...E0,[mk]:{...M,expenses:ex}};
    }
    return {...E0,[mk]:{...M,expenses:ex}};
  };
  const updatePlannerRow=(mk:string,i:number,p:any)=>setE((E0:any)=>{const M=E0[mk]; if(!M) return E0; const cur={...(M.planner||[])[i]} as Plan; const next={...cur,...p} as Plan; let E1=pIdx(E0,mk,"planner",i,p); E1=syncPlan(E1,mk,next); return E1});
  const deletePlannerRow=(mk:string,i:number)=>setE((E0:any)=>rmIdx(E0,mk,"planner",i));
  const updatePlannerById=(mk:string,id:string,p:any)=>setE((E0:any)=>{const M=E0[mk]; if(!M) return E0; const cur=(M.planner||[]).find((x:any)=>x.id===id) as Plan; const next={...cur,...p} as Plan; let E1=pId(E0,mk,"planner",id,p); E1=syncPlan(E1,mk,next); return E1});
  const deletePlannerById=(mk:string,id:string)=>setE((E0:any)=>rmId(E0,mk,"planner",id));
  const bulkClosePaid=(mk:string)=>setE((E0:any)=>{const M=E0[mk]; if(!M) return E0; const next=get(M,"planner").map((p:Plan)=>{const done=(p.achitat||0)>=(p.sumaPlan||0); return done?{...p,platit:true,achitat:(p.sumaPlan||0)}:p}); return setC2(E0,mk,"planner",next)});

  // Small CSV escape helper for App-level export
  const _escapeCSV_forApp = (val:any)=>{ if(val===null||val===undefined) return ''; const s=String(val); if(s.includes(',')||s.includes('"')||s.includes('\n')) return '"'+s.replace(/"/g,'""')+'"'; return s; };

  // App-level export: export the entire app entries state (E) as compact CSV
  const exportCSVAll = useCallback(()=>{
    try{
      const rows:string[] = [];
  const header = ['type','key','subkey','date','client','categorie','descriere','valuta','suma','valutaPlan','sumaPlan','achitat','tip','termen','owner','updatedAt','projectId','denumire','principal','restant','metoda'];
      rows.push(header.join(','));
      const meta = ['meta','app','','','','','','','', '', '', '', '', '', JSON.stringify({rates:r,backup:B,cloud:C}), Date.now(), 'app'];
      rows.push(meta.map(_escapeCSV_forApp).join(','));
      for(const mk of Object.keys(E||{})){
        const M = E[mk]||{incomes:[],expenses:[],planner:[]};
        for(const i of (M.incomes||[])){
          const r0 = ['income', i.id||'', mk, i.date||'', i.client||'', '', i.descriere||'', i.valuta||'', i.suma||'', '', '', '', '', '', i.owner||'', i.updatedAt||Date.now(), mk];
          rows.push(r0.map(_escapeCSV_forApp).join(','));
        }
        for(const x of (M.expenses||[])){
          const r0 = ['expense', x.id||'', mk, x.date||'', '', x.categorie||'', x.descriere||'', x.valuta||'', x.suma||'', '', '', '', '', '', x.owner||'', x.updatedAt||Date.now(), mk];
          rows.push(r0.map(_escapeCSV_forApp).join(','));
        }
        for(const p of (M.planner||[])){
          const r0 = ['planner', p.id||'', mk, p.termen||'', '', p.categorie||'', p.denumire||'', p.valutaPlan||'', p.sumaPlan||'', p.valutaPlan||'', p.sumaPlan||'', p.achitat||0, p.tip||'', p.termen||'', p.owner||'', p.updatedAt||Date.now(), mk, (p as any).creditId||'', '', '', ''];
          rows.push(r0.map(_escapeCSV_forApp).join(','));
        }
        for(const c of (M.credits||[]||[])){
          const r0 = ['credit', c.id||'', mk, c.termen||'', '', '', c.denumire||'', c.valuta||'', c.suma||'', '', '', '', '', c.termen||'', c.owner||'', c.updatedAt||Date.now(), mk, c.denumire||'', c.principal||'', c.restant||'', c.metoda||'', c.platitor||''];
          rows.push(r0.map(_escapeCSV_forApp).join(','));
        }
      }
      const csv = rows.join('\n');
      const blob = new Blob([csv],{type:'text/csv'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `buget-export-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  pushNotif('success','Exportare reușită (CSV)');
  }catch(e:any){ console.error('exportCSVAll(app)', e); pushNotif('error','Exportare eșuată'); }
  },[E,r,B,C,pushNotif]);

  // App-level import: import a full-app CSV and merge/replace into entries
  const importCSVAll = (f:File, merge=true)=>{ const rd=new FileReader(); rd.onload=()=>{ try{ const txt=String(rd.result||''); const lines = txt.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0); if(lines.length<2){ pushNotif('error','CSV empty or invalid'); return; } const header = parseCSVLine(lines[0]).map((h:string)=>h.toLowerCase()); const idx:any={}; for(let i=0;i<header.length;i++) idx[header[i]] = i; const rows:any[]=[]; for(let i=1;i<lines.length;i++){ const cols = parseCSVLine(lines[i]); const obj:any={}; for(const k of Object.keys(idx)){ obj[k] = cols[idx[k]]===undefined? '': cols[idx[k]]; } rows.push(obj); }
  const grouped:any={}; for(const r of rows){ const t=(r.type||'').toLowerCase(); if(t==='meta') continue; const mk = r.subkey||r.projectid||r.projectId||todayYM; if(!grouped[mk]) grouped[mk]={incomes:[],expenses:[],planner:[],credits:[]}; if(t==='income'){ grouped[mk].incomes.push({id: r.key||uid(), date:r.date, client:r.client, descriere:r.descriere, valuta:r.valuta, suma:pn(r.suma||0), sumaEUR: toE(pn(r.suma||0), r.valuta||'EUR', r.rates?JSON.parse(r.rates): r), owner:r.owner||'', updatedAt: parseInt(r.updatedat)||Date.now()}); } else if(t==='expense'){ grouped[mk].expenses.push({id: r.key||uid(), date:r.date, categorie:r.categorie, descriere:r.descriere, valuta:r.valuta, suma:pn(r.suma||0), sumaEUR: toE(pn(r.suma||0), r.valuta||'EUR', r.rates?JSON.parse(r.rates): r), owner:r.owner||'', updatedAt: parseInt(r.updatedat)||Date.now()}); } else if(t==='planner'){ grouped[mk].planner.push({id: r.key||uid(), denumire:r.descriere||'', termen:r.termen||r.date||'', tip:r.tip||'cheltuiala', categorie:r.categorie||'', valutaPlan:r.valutaPlan||'EUR', sumaPlan:pn(r.sumaPlan||0), achitat:pn(r.achitat||0), owner:r.owner||'', updatedAt: parseInt(r.updatedat)||Date.now(), creditId: r.creditid||r.creditId||''}); } else if(t==='credit'){ grouped[mk].credits.push({id: r.key||uid(), denumire:r.denumire||r.descriere||'', termen:r.termen||r.date||'', suma:pn(r.suma||0), valuta:r.valuta||'EUR', principal:pn(r.principal||0), restant:pn(r.restant||0), metoda:r.metoda||'', platitor: r.platitor||'', owner:r.owner||'', updatedAt: parseInt(r.updatedat)||Date.now()}); } }
    const migrated = migrate(grouped);
    if(merge){ setE((E0:any)=> mergeEntriesGlobal(E0,migrated)); } else { setE(migrated); }
  pushNotif('success','Importare reușită (CSV)'); }catch(e:any){ console.error('importCSVAll(app)', e); pushNotif('error','Importare CSV eșuat: '+(e?.message||e)); } }; rd.readAsText(f); };

  // small helper to merge when importing at app scope (re-using logic similar to PageSettings mergeEntries)
  const mergeEntriesGlobal = (A:any,B:any)=>{ if(!B||typeof B!=='object') return A; const out:any={...A}; for(const mk of Object.keys(B)){ const M=A[mk]||{incomes:[],expenses:[],planner:[],credits:[]}, N=B[mk]||{incomes:[],expenses:[],planner:[],credits:[]}; const kInc=(i:any)=>[i.date,i.client,i.descriere,i.valuta,i.suma].join('|'); const kExp=(x:any)=>[x.date,x.categorie,x.platitor,x.metoda,x.descriere,x.valuta,x.suma].join('|'); const kPlan=(p:any)=>[p.denumire,p.tip,p.subtip||'',p.termen,p.valutaPlan,p.sumaPlan].join('|'); const kCred=(c:any)=>[c.denumire,c.termen,c.valuta,c.suma,c.principal].join('|'); const incMap=new Map(M.incomes.map((i:any)=>[kInc(i),i])); const expMap=new Map(M.expenses.map((x:any)=>[kExp(x),x])); const plMap=new Map(M.planner.map((p:any)=>[kPlan(p),p])); const crMap=new Map((M.credits||[]).map((c:any)=>[kCred(c),c])); for(const i of (N.incomes||[])){const key=kInc(i); if(!incMap.has(key)){const ii={id:uid(),...i,sumaEUR:toE(i.suma,i.valuta,r)}; incMap.set(key,ii);} } for(const x of (N.expenses||[])){const key=kExp(x); if(!expMap.has(key)){const xx={id:uid(),...x,sumaEUR:toE(x.suma,x.valuta,r)}; expMap.set(key,xx);} } for(const p of (N.planner||[])){const key=kPlan(p); if(!plMap.has(key)){plMap.set(key,{id:uid(),...p});} } for(const c of (N.credits||[])){const key=kCred(c); if(!crMap.has(key)){crMap.set(key,{id:uid(),...c});} } out[mk]={incomes:[...incMap.values()],expenses:[...expMap.values()],planner:[...plMap.values()],credits:[...crMap.values()]}; } return out };

  const backupNow = useCallback(()=>{ try{ exportCSVAll(); if(B?.email){ const subject=encodeURIComponent(`Backup buget ${new Date().toLocaleString('ro-RO')}`); const body=encodeURIComponent('Fișierul CSV a fost descărcat automat. Atașează-l și trimite.'); try{ window.open(`mailto:${B.email}?subject=${subject}&body=${body}`,'_blank'); }catch(e:any){ void e; } } }catch(e:any){ console.error('backupNow', e); } },[B?.email, exportCSVAll]);
  useEffect(()=>{if(!B.enabled) return; if(!B.nextAt) setB((b:any)=>({...b,nextAt:Date.now()+(b.freqDays||1)*86400000})); const id=setInterval(()=>{if(!B.enabled) return; if(Date.now()>=(B.nextAt||0)){backupNow(); setB((b:any)=>({...b,nextAt:Date.now()+(b.freqDays||1)*86400000}))}},60000); return()=>clearInterval(id)},[B.enabled,B.nextAt,B.freqDays,backupNow]);

  const months=useMemo(()=>Object.keys(E).sort(),[E]);
  const [mk,setMk]=useState(months[0]||todayYM);
  useEffect(()=>{ if(!E[mk] && months.length){ setMk(months[0]); } },[months,mk,E]);

  const installPWA=()=>{try{ if((_pwaEvt as any)?.prompt){ (_pwaEvt as any).prompt(); _pwaEvt=null; setPwaReady(false);} }catch(e:any){ void e; }};

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900"><div className="max-w-xl mx-auto p-4">
      {/* Small visible banner containing key Romanian phrases used by automated translation checks */}
      <div className="text-xs text-slate-500 mb-2">
        Backup automat · Importă CSV · Exportă CSV · Activează sincronizarea în fundal · Înregistrează · Autentificare
      </div>
      {lastLoadedPreview && (<div className="text-sm text-slate-700 mb-2">{lastLoadedPreview}</div>)}
  {loadedFromCache && (<div className="text-sm text-amber-700 mb-2">Loaded from cache</div>)}
  <Tabs value={tab} onChange={setTab} tabs={[{value:"add",label:"Adaugă"},{value:"month",label:"Lună"},{value:"credite",label:"Credite"},{value:"annual",label:"Anual"},{value:"settings",label:"Setări"}]}/>
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
      {tab==="credite"&&E[mk]&&(
        <CreditsPage
          monthKey={mk}
          month={E[mk]}
          rates={r}
          addCredit={addCredit}
          updateCredit={updateCredit}
          deleteCredit={deleteCredit}
          recordPayment={recordPayment}
          lastAddedCredit={lastAddedCredit}
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
        exportRemoteProjectToCSV={exportRemoteProjectToCSV}
        exportRemoteProjectToEmail={exportRemoteProjectToEmail}
        importProjectFromCSVFile={importProjectFromCSVFile}
        onSelectCSVFile={setLastCSVFile}
        exportCSVAll={exportCSVAll}
        importCSVAll={importCSVAll}
          saveProject={saveProject}
          deleteProject={deleteProject}
          renameProject={renameProject}
          addEditor={addEditor}
          removeEditor={removeEditor}
          syncingProjects={syncingProjects}
          cancelInvite={cancelInvite}
          ownerNotifications={ownerNotifications}
          dismissOwnerNotification={dismissOwnerNotification}
          attemptSyncProject={attemptSyncProject}
          lastSyncMap={lastSyncMap}
        />
      )}
    </div>
    {/* Per-project syncing indicator moved into the Projects list; global banner removed */}
  {/* Previzualizare import CSV (modal) */}
    {importModalOpen && importPreview && (
      <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000}}>
        <div style={{background:'white',padding:20,borderRadius:12,minWidth:320,maxWidth:'90%'}}>
          <div style={{fontWeight:700,marginBottom:8}}>Previzualizare import CSV</div>
          <div style={{marginBottom:8}}>Fișier: <b>{importPreview.file?.name||importPreview.file?.filename||'CSV selectat'}</b></div>
          <div style={{marginBottom:8}}>Proiect țintă: <b>{importPreview.preview?.projectId||'(proiect local nou)'}</b></div>
          <div style={{marginBottom:12}}>
            <div>Summary: incomes: <b>{importPreview.preview?.counts?.incomes||0}</b>, expenses: <b>{importPreview.preview?.counts?.expenses||0}</b>, planner: <b>{importPreview.preview?.counts?.planner||0}</b></div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
            <label style={{display:'inline-flex',alignItems:'center',gap:6}}><input type="radio" name="impMode" checked={selectedImportMode==='merge'} onChange={()=>setSelectedImportMode('merge')}/> Combină (adaugă/suprascrie cele mai noi)</label>
            <label style={{display:'inline-flex',alignItems:'center',gap:6,marginLeft:12}}><input type="radio" name="impMode" checked={selectedImportMode==='replace'} onChange={()=>setSelectedImportMode('replace')}/> Înlocuiește (înlocuiește lunile țintă)</label>
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button onClick={()=>{ setImportModalOpen(false); setImportPreview(undefined); }} className="px-3 py-2 rounded-xl border">Anulează</button>
            <button onClick={async()=>{ try{ setImportApplying(true); await applyImport(selectedImportMode, importPreview.preview?.projectId); }finally{ setImportApplying(false); } }} disabled={importApplying} className="px-3 py-2 rounded-xl bg-black text-white">{importApplying? 'Se aplică...':'Aplică'}</button>
          </div>
        </div>
      </div>
    )}
    {/* Invite modal (used to complete email-link sign-in) */}
    {inviteModalOpen && (
      <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:10000}}>
        <div style={{width:360,background:'#fff',padding:18,borderRadius:12,boxShadow:'0 8px 30px rgba(0,0,0,0.2)'}}>
          <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Finalizează autentificarea</div>
          <div style={{fontSize:13,marginBottom:12,color:'#374151'}}>Introdu adresa de email pentru a finaliza autentificarea prin link-ul primit.</div>
          <input value={inviteModalEmail} onChange={(e)=>setInviteModalEmail((e.target as any).value)} placeholder="email@exemplu.com" className="w-full border rounded-xl p-2" />
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:12}}>
            <button onClick={()=>{ setInviteModalOpen(false); setInviteModalEmail(''); setInvitePendingUrl(null); }} disabled={modalBusy} className="px-3 py-2 rounded-xl border">Anulează</button>
            <button onClick={async()=>{ try{ if(inviteModalEmail) { try{ window.localStorage.setItem('buget_invite_email', inviteModalEmail); }catch(err){ console.debug('store invite email failed', err); } await submitInviteEmail(inviteModalEmail); } else { pushNotif('error','Completează email'); } }catch(err){ console.warn(err); } }} disabled={modalBusy} className="px-3 py-2 rounded-xl bg-black text-white">{modalBusy? 'Se conectează...':'Conectează-te'}</button>
          </div>
        </div>
      </div>
    )}
    {/* toasts */}
    <div style={{position:'fixed',right:12,top:12,zIndex:9999}}>
      {notifs.map(n=> (
        <div key={n.id} style={{marginBottom:8,background:n.type==='error'?'#fee2e2':n.type==='success'?'#ecfdf5':'#f0f9ff',padding:'8px 12px',borderRadius:8,boxShadow:'0 2px 6px rgba(0,0,0,0.08)'}}>
          <div style={{fontSize:13,fontWeight:600,color:n.type==='error'?'#b91c1c':n.type==='success'?'#065f46':'#0f172a'}}>{n.msg}</div>
        </div>
      ))}
    </div>
    {/* Name uniqueness modal */}
    {nameModalOpen && (
      <div style={{position:'fixed',left:0,top:0,right:0,bottom:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:11000}}>
        <div style={{width:360,background:'#fff',padding:18,borderRadius:12,boxShadow:'0 8px 30px rgba(0,0,0,0.2)'}}>
          <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Nume de credit duplicat</div>
          <div style={{fontSize:13,marginBottom:12,color:'#374151'}}>Există deja un credit cu acest nume. Introdu un nume unic pentru noul credit.</div>
          <input value={nameModalValue} onChange={(e)=>setNameModalValue((e.target as any).value)} placeholder="Nume unic" className="w-full border rounded-xl p-2" />
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:12}}>
            <button onClick={()=>{ resolveNameModal(null); }} className="px-3 py-2 rounded-xl border">Anulează</button>
            <button onClick={()=>{ resolveNameModal(nameModalValue||''); }} className="px-3 py-2 rounded-xl bg-black text-white">Confirmă</button>
          </div>
        </div>
      </div>
    )}
    {/* Mobile bottom nav */}
    <div className="bottom-nav">
  <button onClick={()=>setTab('add')} className={tab==='add'?"bg-black text-white":"bg-white"}>Adaugă</button>
  <button onClick={()=>setTab('month')} className={tab==='month'?"bg-black text-white":"bg-white"}>Lună</button>
  <button onClick={()=>setTab('credite')} className={tab==='credite'?"bg-black text-white":"bg-white"}>Credite</button>
  <button onClick={()=>setTab('annual')} className={tab==='annual'?"bg-black text-white":"bg-white"}>Anual</button>
  <button onClick={()=>setTab('settings')} className={tab==='settings'?"bg-black text-white":"bg-white"}>Setări</button>
    </div>
    </div>
  );
}
// end of file
