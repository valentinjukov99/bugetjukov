import React, {useMemo,useState,useEffect} from "react";
import {initializeApp} from "firebase/app";
import {getAuth,signInAnonymously} from "firebase/auth";
import {getFirestore,doc,onSnapshot,setDoc} from "firebase/firestore";

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
const CLOUD_DEF:any={enabled:false,budgetId:"",cfg:""}; let _app:any=null,_db:any=null,_auth:any=null,_pull=false;
const validFbConfig=(cfg:any)=>!!(cfg&&cfg.apiKey&&cfg.projectId&&cfg.appId);
const fbInit=(cfgStr:string)=>{try{const cfg=JSON.parse(cfgStr||"{}"); if(!validFbConfig(cfg)) return false; if(!_app){_app=initializeApp(cfg); _auth=getAuth(_app); signInAnonymously(_auth).catch(()=>{}); _db=getFirestore(_app);} return true;}catch{return false}};
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
const Table=React.memo(function({head,rows,renderRow,emptyText="Nimic de afișat",compact=false}:{head:string[];rows:any[];renderRow:(r:any,i:number)=>React.ReactNode;emptyText?:string;compact?:boolean}){return(<div className={compact?"overflow-x-hidden":"overflow-x-auto -mx-4 sm:mx-0 touch-pan-x"}><table className={compact?"w-full table-fixed text-sm":"min-w-[1000px] text-sm"}><thead><tr>{head.map(h=>(<th key={h} className="text-left px-4 py-2 bg-slate-50 whitespace-nowrap">{h}</th>))}</tr></thead><tbody>{rows.length===0?(<tr><td colSpan={head.length} className="px-4 py-6 text-slate-500">{emptyText}</td></tr>):(rows.map((r,i)=>(<tr key={i} className="border-t odd:bg-slate-50/40">{renderRow(r,i)}</tr>)))}</tbody></table></div>) });
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

function PageSettings({rates,setRates,entries,setEntries,backup,setBackup,onBackupNow,cloud,setCloud,pwaReady,installPWA}:any){
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
  const test=()=>{const ok=fbInit(cloud?.cfg||"");alert(ok?"Config valid / autentificat":"Config invalid (verifică apiKey, projectId, appId)")};
  const push=async()=>{if(!fbInit(cloud?.cfg||""))return alert("Config invalid");const r=ref(cloud?.budgetId||"");if(!r)return alert("Lipsește budgetId");await setDoc(r,{rates,entries,backup,updatedAt:Date.now()},{merge:true});alert("Trimis în cloud")};
  return(<div className="space-y-6">
    <Section title="Curs valutar (bază EUR)"><div className="grid grid-cols-2 gap-3">
      <Field label="RON per 1 EUR"><input inputMode="decimal" value={rates.ronPerEur} onChange={e=>setRates((r:any)=>({...r,ronPerEur:parseFloat((e.target as any).value)||0}))} className="w-full border rounded-xl p-2"/></Field>
      <Field label="MDL per 1 EUR"><input inputMode="decimal" value={rates.mdlPerEur} onChange={e=>setRates((r:any)=>({...r,mdlPerEur:parseFloat((e.target as any).value)||0}))} className="w-full border rounded-xl p-2"/></Field>
    </div></Section>
    <Section title="Sincronizare online (Firebase)"><div className="grid grid-cols-2 gap-3">
      <Field label="Activ"><input type="checkbox" checked={!!cloud.enabled} onChange={e=>setCloud((c:any)=>({...c,enabled:(e.target as any).checked}))}/></Field>
      <Field label="Budget ID"><input value={cloud.budgetId||""} onChange={e=>setCloud((c:any)=>({...c,budgetId:(e.target as any).value}))} className="w-full border rounded-xl p-2" placeholder="ex: buget-familie"/></Field>
      <Field label="Config JSON" className="col-span-2"><textarea rows={4} value={cloud.cfg||""} onChange={e=>setCloud((c:any)=>({...c,cfg:(e.target as any).value}))} className="w-full border rounded-xl p-2" placeholder='{"apiKey":"…","authDomain":"…","projectId":"…","appId":"…"}'/></Field>
      <div className="col-span-2 flex gap-3"><button onClick={test} className="px-4 py-2 rounded-xl border">Conectează/Test</button><button onClick={push} className="px-4 py-2 rounded-xl bg-black text-white font-semibold">Salvează remote</button></div>
      <div className="col-span-2 text-xs text-slate-500">Sincronizare în timp real. Politică: ultima scriere câștigă (LWW).</div>
    </div></Section>
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
  </div>)}

// ===== app
let _pwaEvt:any=null; export default function App(){
  const S=load();
  const[r,setR]=useState(S?.rates||rates0);
  const[E,setE]=useState(migrate(S?.entries)||{[todayYM]:emptyM()});
  const[B,setB]=useState(S?.backup||{email:"",freqDays:1,enabled:false,nextAt:0});
  const[C,setC]=useState(S?.cloud||CLOUD_DEF);
  const[tab,setTab]=useState("add"); const[pwaReady,setPwaReady]=useState(false);

  // local save + cloud push
  useEffect(()=>{const t=setTimeout(()=>{const snap={rates:r,entries:E,backup:B,cloud:C}; save(snap); if(C?.enabled&&C?.budgetId&&fbInit(C?.cfg||"")){const rf=ref(C.budgetId); if(rf&&!_pull)setDoc(rf,{rates:r,entries:E,backup:B,updatedAt:Date.now()},{merge:true});}},250); return()=>clearTimeout(t)},[r,E,B,C]);
  // PWA hooks
  useEffect(()=>{if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{});} const h=(e:any)=>{e.preventDefault(); _pwaEvt=e; setPwaReady(true)}; window.addEventListener('beforeinstallprompt',h); return()=>window.removeEventListener('beforeinstallprompt',h)},[]);
  // recalc EUR on rate change
  useEffect(()=>{setE((E0:any)=>{const out:any={}; for(const k of Object.keys(E0||{})){const M=E0[k]||{incomes:[],expenses:[],planner:[]}; out[k]={...M, incomes:(M.incomes||[]).map((i:any)=>({...i,sumaEUR:toE(i.suma,i.valuta,r)})), expenses:(M.expenses||[]).map((x:any)=>({...x,sumaEUR:toE(x.suma,x.valuta,r)}))};} return out});},[r]);
  // cloud subscribe
  useEffect(()=>{ if(!C?.enabled||!C?.budgetId||!C?.cfg) return; if(!fbInit(C.cfg)) return; const rf=ref(C.budgetId); if(!rf) return; const unsub=onSnapshot(rf,(snap)=>{const d:any=snap.data(); if(!d) return; _pull=true; setR(d.rates||rates0); setE(migrate(d.entries)||{[todayYM]:emptyM()}); setB(d.backup||{email:"",freqDays:1,enabled:false,nextAt:0}); setTimeout(()=>{_pull=false},300)}); return ()=>unsub(); },[C.enabled,C.budgetId,C.cfg]);

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
        />
      )}
    </div></div>
  );
}
// end of file
