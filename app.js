/* Hörakustik Daugsch · Portal – Start & Aufgaben
   Daten: Supabase (Postgres + Live-Sync). */
(() => {
const VERSION="1.7.1 · Labor-Eingangsmeldung";
const CATS=[["Kunden",["Rückruf","Anpassung","Reservierung"]],["Werkstatt",["Aufarbeitung","Reparatur","Otoplastik"]],["Einkauf & Lager",["Bestellung","Zubehör","Lagerausbuchung","Rücksendung Hersteller"]],["Verwaltung",["Krankenkasse","Buchhaltung","Marketing","Sonstiges"]]];
const GROUP_OF={};CATS.forEach(([g,cs])=>cs.forEach(c=>GROUP_OF[c]=g));
const TILE={"Kunden":"t-kunden","Werkstatt":"t-werkstatt","Einkauf & Lager":"t-lager","Verwaltung":"t-verwaltung"};
const IC={
 phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
 wrench:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z"/>',
 box:'<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
 doc:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
 check:'<path d="M20 6 9 17l-5-5"/>',
 list:'<path d="M9 6h12M9 12h12M9 18h12M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
 chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
 euro:'<path d="M17 6.5A6.5 6.5 0 1 0 17 17.5M4 10h9M4 14h9"/>',
 cal:'<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
 arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
 plus:'<path d="M12 5v14M5 12h14"/>'};
const ICON_OF={"Rückruf":"phone","Anpassung":"user","Reservierung":"user","Aufarbeitung":"wrench","Reparatur":"wrench","Otoplastik":"wrench","Bestellung":"box","Zubehör":"box","Lagerausbuchung":"box","Rücksendung Hersteller":"box"};
const svg=(n,s="")=>`<svg class="i" viewBox="0 0 24 24"${s}>${IC[n]}</svg>`;
const STATUS={offen:"Offen",arbeit:"In Arbeit",wartet:"Wartet",erledigt:"Erledigt"};
const PRIO={hoch:0,normal:1,niedrig:2};
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ls={get(k,d){try{const v=localStorage.getItem("hd_"+k);return v==null?d:JSON.parse(v)}catch{return d}},set(k,v){try{localStorage.setItem("hd_"+k,JSON.stringify(v))}catch{}}};
const pad=n=>String(n).padStart(2,"0");
const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const addDays=(n,base=new Date())=>{const d=new Date(base);d.setDate(d.getDate()+n);return iso(d)};
const fmtDate=s=>{if(!s)return"";const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString("de-DE",{weekday:"short",day:"numeric",month:"short"})};
const relDate=s=>{const T=iso(new Date());if(!s)return"";if(s===T)return"Heute";if(s===addDays(1))return"Morgen";if(s===addDays(-1))return"seit gestern";if(s<T)return"seit "+fmtDate(s);return fmtDate(s)};
const uid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2,10));
const show=v=>["setupView","loginView","pwView","nameView","appView"].forEach(x=>$(x).classList.toggle("hidden",x!==v));

let sb=null,me=null,tasks=[],team=[],page=ls.get("page","start"),tab="tag",person=ls.get("person","alle"),cat=ls.get("cat",""),q="",editing=null,loaded=false,live=false,channel=null,timer=null;
$("ver").textContent=VERSION;
window.HD={get tasks(){return tasks},saveTask:(t,b)=>save(t,b),esc:s=>esc(s),svg:(n,x)=>svg(n,x),toast:(m,u)=>toast(m,u),rerender:()=>render(),page:()=>page,get sb(){return sb},get me(){return me},team:()=>team,go:t=>go(t),ask:(title,text,ok="Löschen")=>new Promise(res=>{const d=$("askDlg");$("askTitle").textContent=title;$("askText").textContent=text||"";$("askYes").textContent=ok;d.returnValue="";d.onclose=()=>res(d.returnValue==="yes");d.showModal();setTimeout(()=>$("askNo").focus(),30)}),
 setTab:t=>{if(t==="labor"){go("labor");return}tab=t;render()},laborActive:()=>page==="labor"};

/* ---------- Datenbank <-> App ---------- */
const fromRow=r=>({id:r.id,title:r.title,category:r.category,assignee:r.assignee||"",due:r.due||"",priority:r.priority,status:r.status,prevStatus:r.prev_status||null,
 customer:r.customer||"",phone:r.phone||"",manufacturer:r.manufacturer||"",model:r.model||"",notes:r.notes||"",
 createdAt:r.created_at?Date.parse(r.created_at):0,doneAt:r.done_at?Date.parse(r.done_at):null,labOrderId:r.lab_order_id||null,consultationId:r.consultation_id||null});
const toRow=t=>({id:t.id,title:t.title,category:t.category||"Sonstiges",assignee:t.assignee||null,due:t.due||null,priority:t.priority||"normal",status:t.status||"offen",
 prev_status:t.prevStatus||null,customer:t.customer||null,phone:t.phone||null,manufacturer:t.manufacturer||null,model:t.model||null,notes:t.notes||null,
 created_at:new Date(t.createdAt||Date.now()).toISOString(),updated_at:new Date().toISOString(),done_at:t.doneAt?new Date(t.doneAt).toISOString():null,...(t.labOrderId?{lab_order_id:t.labOrderId}:{}),...(t.consultationId?{consultation_id:t.consultationId}:{})});
const putLocal=t=>{const i=tasks.findIndex(x=>x.id===t.id);i<0?tasks.push(t):tasks[i]=t};
const cache=()=>ls.set("cache",{tasks,team,at:Date.now()});

async function save(t,before){
 putLocal(t);render();
 let{error}=await sb.from("tasks").upsert(toRow(t));
 if(error&&/lab_order_id|consultation_id/.test(error.message||"")){const r=toRow(t);delete r.lab_order_id;delete r.consultation_id;({error}=await sb.from("tasks").upsert(r))}
 if(error){before?putLocal(before):(tasks=tasks.filter(x=>x.id!==t.id));render();toast("Nicht gespeichert – keine Verbindung?");return false}
 cache();return true;
}
async function removeTask(t){
 tasks=tasks.filter(x=>x.id!==t.id);render();
 const{error}=await sb.from("tasks").delete().eq("id",t.id);
 if(error){putLocal(t);render();toast("Löschen fehlgeschlagen");return false}
 cache();return true;
}
async function loadAll(){
 const [o,d,p]=await Promise.all([
  sb.from("tasks").select("*").neq("status","erledigt"),
  sb.from("tasks").select("*").eq("status","erledigt").order("done_at",{ascending:false}).limit(200),
  sb.from("profiles").select("id,name").order("created_at")]);
 if(o.error||d.error||p.error){setSync(false,"keine Verbindung");return}
 tasks=[...o.data,...d.data].map(fromRow);team=p.data;loaded=true;cache();render();
}
function subscribe(){
 if(channel)sb.removeChannel(channel);
 channel=sb.channel("hd-live")
  .on("postgres_changes",{event:"*",schema:"public",table:"tasks"},p=>{
    if(p.eventType==="DELETE")tasks=tasks.filter(t=>t.id!==(p.old&&p.old.id));else putLocal(fromRow(p.new));
    cache();render()})
  .on("postgres_changes",{event:"*",schema:"public",table:"profiles"},()=>{
    sb.from("profiles").select("id,name").order("created_at").then(({data})=>{if(data){team=data;cache();render()}})})
  .subscribe(s=>{if(s==="SUBSCRIBED")setSync(true,"live synchron");else if(s==="CHANNEL_ERROR"||s==="TIMED_OUT"||s==="CLOSED")setSync(false,"Sync unterbrochen")});
}
function setSync(ok,txt){live=ok;$("sync").classList.toggle("off",!ok);$("syncTxt").textContent=txt}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&me){loadAll();if(!live)subscribe()}});
window.addEventListener("online",()=>{if(me){loadAll();subscribe()}});
window.addEventListener("offline",()=>{setSync(false,"offline");render()});

/* ---------- Helfer ---------- */
function match(t,withQ=true){
 if(person!=="alle"&&(t.assignee||"")!==person)return false;
 if(cat&&t.category!==cat&&GROUP_OF[t.category]!==cat)return false;
 if(withQ&&q){const h=[t.title,t.customer,t.phone,t.manufacturer,t.model,t.notes,t.category].join(" ").toLowerCase();if(!h.includes(q))return false}
 return true;
}
const sortT=(a,b)=>(PRIO[a.priority]??1)-(PRIO[b.priority]??1)||(a.due||"9").localeCompare(b.due||"9")||(a.createdAt||0)-(b.createdAt||0);
const urgency=(a,b)=>(a.due||"9").localeCompare(b.due||"9")||(PRIO[a.priority]??1)-(PRIO[b.priority]??1);
const nameOf=id=>team.find(x=>x.id===id)?.name||"";
const firstName=id=>nameOf(id).split(/\s+/)[0]||"";
const initials=id=>nameOf(id).split(/\s+/).filter(Boolean).map(w=>w[0]).join("").slice(0,2).toUpperCase();
const greeting=()=>{const h=new Date().getHours();return h<11?"Guten Morgen":h<18?"Guten Tag":"Guten Abend"};
const isToday=ms=>ms&&iso(new Date(ms))===iso(new Date());

function stats(){
 const T=iso(new Date()),open=tasks.filter(t=>t.status!=="erledigt"&&match(t,false));
 const od=open.filter(t=>t.due&&t.due<T),td=open.filter(t=>t.due===T),wait=open.filter(t=>t.status==="wartet");
 const doneToday=tasks.filter(t=>t.status==="erledigt"&&isToday(t.doneAt)&&match(t,false)).length;
 return{open,od,td,wait,doneToday,ringTotal:doneToday+od.length+td.length};
}
function hero(){
 const s=stats(),now=new Date(),who=person==="alle"?firstName(me.id):person===me.id?firstName(me.id):firstName(person);
 const forOther=person!=="alle"&&person!==me.id;
 const todo=s.od.length+s.td.length;
 const line=todo===0?(s.open.length?"Für heute ist alles erledigt. Stark!":"Keine offenen Aufgaben."):
  `Heute ${todo===1?"steht 1 Aufgabe":"stehen "+todo+" Aufgaben"} an${s.od.length?` – ${s.od.length===1?"eine davon ist":s.od.length+" davon sind"} überfällig`:""}.`;
 const pct=s.ringTotal?s.doneToday/s.ringTotal:0,C=2*Math.PI*50;
 return `<div class="hero">
  <div class="txt"><span class="date">${now.toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"})}</span>
   <h1>${forOther?"Aufgaben von "+esc(who):esc(greeting())+(who?", "+esc(who):"")}</h1><p>${line}</p></div>
  <div class="kpis">
   <button class="kpi ${s.od.length?"hot":""}" data-go="aufgaben"><strong>${s.od.length}</strong><span>Überfällig</span></button>
   <button class="kpi" data-go="aufgaben"><strong>${s.td.length}</strong><span>Heute</span></button>
   <button class="kpi" data-go="aufgaben"><strong>${s.wait.length}</strong><span>Wartet</span></button>
  </div>
  <div class="ring" role="img" aria-label="${s.doneToday} von ${s.ringTotal} heute erledigt"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" fill="none" stroke="#E3EBE8" stroke-width="12"/>${pct>0?`<circle cx="60" cy="60" r="50" fill="none" stroke="#276955" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(pct*C).toFixed(1)} ${C.toFixed(1)}"/>`:""}</svg>
   <div><b>${s.doneToday}/${s.ringTotal}</b><small>heute erledigt</small></div></div>
 </div>`;
}
function peopleRow(){
 const T=iso(new Date()),open=tasks.filter(t=>t.status!=="erledigt");
 return `<div class="people" role="group" aria-label="Aufgaben von">${[["alle","Alle"],...team.map(m=>[m.id,m.name])].map(([id,n])=>{
  const own=open.filter(t=>id==="alle"||t.assignee===id),late=own.filter(t=>t.due&&t.due<T).length;
  return `<button class="pbtn" data-person="${esc(id)}" aria-pressed="${person===id}"><i class="av">${id==="alle"?"★":esc(initials(id))}</i><span><b>${esc(n)}${id===me.id?" (ich)":""}</b><small>${own.length} offen${late?` · <em>${late} überfällig</em>`:""}</small></span></button>`}).join("")}</div>`;
}
function card(t){
 const T=iso(new Date()),late=t.due&&t.due<T&&t.status!=="erledigt",g=GROUP_OF[t.category]||"Verwaltung";
 const tile=late||t.priority==="hoch"&&t.status!=="erledigt"?"t-hot":TILE[g];
 const ic=ICON_OF[t.category]||(g==="Verwaltung"?"doc":"user");
 const st=t.status==="wartet"?'<span class="tag wait">Wartet</span>':t.status==="arbeit"?'<span class="tag work">In Arbeit</span>':"";
 const device=[t.manufacturer,t.model].filter(Boolean).join(" ");
 const tel=t.phone?`<a href="tel:${esc(t.phone.replace(/[^\d+]/g,""))}" data-stop>${esc(t.phone)}</a>`:"";
 const dl=t.status==="erledigt"&&t.doneAt?"erledigt "+new Date(t.doneAt).toLocaleDateString("de-DE",{day:"numeric",month:"short"}):relDate(t.due);
 const lo=t.labOrderId&&window.HD_LABOR?window.HD_LABOR.state.orders.find(o=>o.id===t.labOrderId):null;
 const labTag=lo?`<span class="tag lab">Labor: ${esc(lo.delivered_at?"übergeben":(window.HD_LABOR.COLS.find(c=>c.stages.includes(lo.stage))||{}).t||"")}</span>`:"";
 const av=t.assignee&&initials(t.assignee)?`<span class="who" title="${esc(nameOf(t.assignee))}">${esc(initials(t.assignee))}</span>`:"";
 return `<article class="task${t.priority==="hoch"||late?" urgent":""}${t.status==="erledigt"?" done":""}${t.id===arrived?" arrive":""}" data-id="${esc(t.id)}">
  <span class="tile ${tile}">${svg(ic)}</span>
  <div class="body"><span class="title">${esc(t.title)}</span>
   <div class="meta"><span>${esc(t.category||"Sonstiges")}</span>${t.priority==="hoch"&&t.status!=="erledigt"?'<span class="tag hot">Dringend</span>':""}${st}${labTag}${t.customer?`<span>${esc(t.customer)}</span>`:""}${tel}${device?`<span>${esc(device)}</span>`:""}</div>
   ${t.notes?`<div class="meta">${esc(t.notes.length>120?t.notes.slice(0,120)+"…":t.notes)}</div>`:""}
   <div class="meta mside">${dl?`<span class="${late?"late":""}" style="${late?"color:var(--hot);font-weight:700":""}">${esc(dl)}</span>`:""}${t.assignee?`<span>${esc(firstName(t.assignee))}</span>`:""}</div></div>
  <div class="side">${dl?`<span class="${late?"late":""}">${esc(dl)}</span>`:""}${av}</div>
  <button class="check" data-check aria-label="${t.status==="erledigt"?"Wieder öffnen":"Als erledigt markieren"}">${t.status==="erledigt"?svg("check",' style="width:18px;height:18px;stroke-width:3"'):""}</button>
 </article>`;
}
const sec=(title,list,cls="")=>list.length?`<section class="list ${cls}"><h3>${title} <small>${list.length}</small></h3>${list.sort(sortT).map(card).join("")}</section>`:"";
const emptyBox=txt=>`<div class="empty"><svg viewBox="0 0 120 50" width="120" height="50" aria-hidden="true"><path d="M2 25 C22 5 42 45 62 25 S102 5 118 25" fill="none" stroke="#8BAAA2" stroke-width="4" stroke-linecap="round"/><path d="M2 40 C22 20 42 60 62 40 S102 20 118 40" fill="none" stroke="#B7C6C2" stroke-width="4" stroke-linecap="round"/></svg><p>${txt}</p></div>`;

/* ---------- Seiten ---------- */
function startPage(){
 const s=stats(),next=s.open.slice().sort(urgency).slice(0,5);
 return hero()+peopleRow()+
  `<section class="list"><h3>Als Nächstes <small>${next.length}</small></h3>${next.length?next.map(card).join(""):emptyBox("Keine offenen Aufgaben.")}${s.open.length>5?`<button class="btn" data-go="aufgaben" style="align-self:flex-start">Alle ${s.open.length} Aufgaben ${svg("arrow")}</button>`:""}</section>`;
}
function tasksPage(){
 if(tab==="labor")tab="tag";
 const T=iso(new Date()),TM=addDays(1),now=new Date(),SUN=addDays(6-(now.getDay()+6)%7);
 const open=tasks.filter(t=>t.status!=="erledigt"),mine=open.filter(t=>match(t));
 const doneAll=tasks.filter(t=>t.status==="erledigt"&&match(t)).sort((a,b)=>(b.doneAt||0)-(a.doneAt||0));
 let h="";
 if(tab==="tag"){
  const od=mine.filter(t=>t.due&&t.due<T),td=mine.filter(t=>t.due===T);
  const rest=mine.filter(t=>!(t.due&&t.due<=T)),nw=rest.filter(t=>t.status!=="wartet");
  h=sec("Überfällig",od,"overdue")+sec("Heute",td)+sec("Morgen",nw.filter(t=>t.due===TM))+sec("Diese Woche",nw.filter(t=>t.due>TM&&t.due<=SUN))+
   sec("Später",nw.filter(t=>t.due>SUN&&t.due>TM))+sec("Ohne Datum",nw.filter(t=>!t.due))+sec("Wartet auf Rückmeldung",rest.filter(t=>t.status==="wartet"));
 }else if(tab==="alle")h=sec("Alle offenen Aufgaben",mine.slice());
 else{const d=doneAll.slice(0,150);h=d.length?`<section class="list"><h3>Verlauf – zuletzt erledigt <small>${d.length}</small></h3>${d.map(card).join("")}</section>`:""}
 if(!h)h=emptyBox(!loaded&&!tasks.length?"Aufgaben werden geladen …":tab==="erledigt"?"Noch nichts erledigt.":q||cat||person!=="alle"?"Keine Aufgaben für diesen Filter.":"Keine offenen Aufgaben. Mit „+“ legst du die erste an.");
 const offline=!navigator.onLine?(()=>{const c=ls.get("cache",null);return `<div class="hint">Keine Internetverbindung – Stand von ${c?new Date(c.at).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}):"vorhin"} Uhr.</div>`})():"";
 const today=doneAll.filter(t=>isToday(t.doneAt));
 const st=stats(),left=st.od.length+st.td.length;
 const doneCol=`<aside class="donecol"><div class="dhead"><h3>Heute erledigt <small>${today.length}</small></h3>${left===0&&today.length?'<span class="yay">Tagesziel erreicht 🎉</span>':left?`<span class="dleft">noch ${left} für heute</span>`:""}</div>
  ${today.length?today.map(card).join(""):`<div class="dempty">${svg("check")}<p>Erledigte Aufgaben landen hier.<br>Einfach links abhaken.</p></div>`}
  ${doneAll.length>today.length?`<button class="linkbtn" data-tab="erledigt">Ganzer Verlauf (${doneAll.length}) ${svg("arrow")}</button>`:""}</aside>`;
 return `<div class="bar"><h2>Aufgaben</h2>
   <div class="tabs" role="group" aria-label="Ansicht"><button data-tab="tag" aria-pressed="${tab==="tag"}">Tagesübersicht</button><button data-tab="alle" aria-pressed="${tab==="alle"}">Alle offenen</button><button data-tab="erledigt" aria-pressed="${tab==="erledigt"}">Verlauf</button></div>
   <label class="search">${svg("search")}<input id="q" type="search" placeholder="Kunde, Gerät, Notiz suchen …" aria-label="Suchen" value="${esc(q)}"></label></div>`+
  peopleRow()+
  `<div class="chips"><button class="chip" data-cat="" aria-pressed="${!cat}">Alle Kategorien</button>${CATS.map(([g])=>`<button class="chip" data-cat="${esc(g)}" aria-pressed="${cat===g}">${esc(g)}</button>`).join("")}<select id="catSel" aria-label="Einzelne Kategorie"><option value="">Genauer …</option>${CATS.map(([g,cs])=>`<optgroup label="${esc(g)}">${cs.map(c=>`<option ${cat===c?"selected":""}>${esc(c)}</option>`).join("")}</optgroup>`).join("")}</select></div>`+
  offline+(tab==="erledigt"?`<div>${h}</div>`:`<div class="board"><div class="opencol">${h}</div>${doneCol}</div>`);
}
function laborPage(){return window.HD_LABOR?window.HD_LABOR.render():emptyBox("Labor wird geladen …")}
function render(){
 if(!me)return;
 const p=page==="erledigt"?"aufgaben":page;
 if(person!=="alle"&&team.length&&!team.some(m=>m.id===person))person="alle";
 document.querySelectorAll("[data-go]").forEach(b=>{if(b.closest(".mainnav,.mobnav")){const g=b.dataset.go;b.setAttribute("aria-current",(g===p&&!(g==="aufgaben"&&tab==="erledigt"))||(g==="erledigt"&&p==="aufgaben"&&tab==="erledigt")?"page":"false")}});
 const focus=document.activeElement&&document.activeElement.id==="q";
 const ln=window.HD_LABOR?window.HD_LABOR.openCount():0;document.querySelectorAll(".labcnt").forEach(x=>{x.textContent=ln||"";x.hidden=!ln});
 $("main").innerHTML=p==="aufgaben"?tasksPage():p==="labor"?laborPage():p==="preise"&&window.HD_PREISE?window.HD_PREISE.render():p==="beratung"&&window.HD_BERATUNG?window.HD_BERATUNG.render():startPage();
 if(focus){const i=$("q");i.focus();i.setSelectionRange(i.value.length,i.value.length)}
 $("meLine").textContent="Angemeldet als "+(nameOf(me.id)||me.email);
}
function go(target){
 if(target==="erledigt"){page="aufgaben";tab="erledigt"}
 else{page=target;if(target==="aufgaben"&&tab==="erledigt")tab="tag"}
 ls.set("page",page);render();window.scrollTo({top:0,behavior:"smooth"});
}

/* ---------- Formular ---------- */
const segSet=(id,v)=>$(id).querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===v));
const segGet=id=>$(id).querySelector('[aria-pressed="true"]')?.dataset.v;
function openForm(t){
 editing=t||null;
 $("formTitle").textContent=t?"Aufgabe bearbeiten":"Neue Aufgabe";
 $("f_cat").innerHTML=CATS.map(([g,cs])=>`<optgroup label="${esc(g)}">${cs.map(c=>`<option>${esc(c)}</option>`).join("")}</optgroup>`).join("");
 $("f_who").innerHTML=`<option value="">– niemand –</option>`+team.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("");
 const d=t||{category:CATS.flatMap(c=>c[1]).includes(cat)?cat:"Rückruf",assignee:person!=="alle"?person:me.id,due:iso(new Date()),priority:"normal",status:"offen"};
 $("f_title").value=d.title||"";$("f_cat").value=d.category||"Sonstiges";$("f_who").value=d.assignee||"";$("f_due").value=d.due||"";
 $("f_cust").value=d.customer||"";$("f_phone").value=d.phone||"";$("f_maker").value=d.manufacturer||"";$("f_model").value=d.model||"";$("f_notes").value=d.notes||"";
 segSet("f_prio",d.priority||"normal");segSet("f_status",d.status||"offen");
 $("delBtn").style.display=t?"":"none";$("delBtn").textContent="Löschen";delete $("delBtn").dataset.sure;
 $("dlg").showModal();if(!t)$("f_title").focus();
}
$("form").addEventListener("submit",async e=>{
 e.preventDefault();
 const title=$("f_title").value.trim();if(!title){$("f_title").focus();return}
 const status=segGet("f_status")||"offen",prev=editing||{},was=editing?{...editing}:null;
 const t={...prev,id:prev.id||uid(),title,category:$("f_cat").value,assignee:$("f_who").value,due:$("f_due").value,priority:segGet("f_prio")||"normal",status,
  customer:$("f_cust").value.trim(),phone:$("f_phone").value.trim(),manufacturer:$("f_maker").value.trim(),model:$("f_model").value.trim(),notes:$("f_notes").value.trim(),
  createdAt:prev.createdAt||Date.now(),doneAt:status==="erledigt"?(prev.doneAt||Date.now()):null};
 $("dlg").close();
 if(await save(t,was))toast(was?"Gespeichert":"Aufgabe angelegt");
});
$("cancelBtn").onclick=()=>$("dlg").close();
$("dueQuick").onclick=e=>{const b=e.target.closest("button");if(b)$("f_due").value=addDays(+b.dataset.d)};
["f_prio","f_status"].forEach(id=>$(id).onclick=e=>{const b=e.target.closest("button");if(b)segSet(id,b.dataset.v)});
$("delBtn").onclick=async()=>{const b=$("delBtn");if(!b.dataset.sure){b.dataset.sure=1;b.textContent="Wirklich löschen?";return}
 const t={...editing};$("dlg").close();if(await removeTask(t))toast("Aufgabe gelöscht",()=>save(t))};

let tt;function toast(msg,undo){$("toastMsg").textContent=msg;$("toastUndo").style.display=undo?"":"none";$("toastUndo").onclick=()=>{undo&&undo();$("toast").style.display="none"};
 $("toast").style.display="flex";clearTimeout(tt);tt=setTimeout(()=>$("toast").style.display="none",undo?6000:2200)}

/* ---------- Animation & Konfetti ---------- */
let arrived=null,arrT;
const reduced=()=>window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
function confetti(undo){
 if(reduced()){toast("Alles für heute erledigt – stark! 🎉",undo);return}
 const c=document.createElement("canvas");c.className="confetti";document.body.appendChild(c);
 const x=c.getContext("2d"),dpr=window.devicePixelRatio||1,W=innerWidth,H=innerHeight;c.width=W*dpr;c.height=H*dpr;x.scale(dpr,dpr);
 const COL=["#276955","#1B493B","#8BAAA2","#E9C46A","#F4A261","#E5989B","#B7C6C2","#ffffff"];
 const P=[];for(let i=0;i<220;i++){const left=i%2===0;P.push({x:left?-10:W+10,y:H*(.55+Math.random()*.3),vx:(left?1:-1)*(6+Math.random()*9),vy:-(10+Math.random()*12),r:4+Math.random()*6,rot:Math.random()*6,vr:(Math.random()-.5)*.4,c:COL[i%COL.length],s:Math.random()<.5})}
 for(let i=0;i<90;i++)P.push({x:Math.random()*W,y:-20-Math.random()*H*.5,vx:(Math.random()-.5)*2,vy:2+Math.random()*3,r:4+Math.random()*5,rot:Math.random()*6,vr:(Math.random()-.5)*.3,c:COL[i%COL.length],s:Math.random()<.5});
 const t0=performance.now();
 (function f(now){const el=now-t0;x.clearRect(0,0,W,H);x.globalAlpha=el>2600?Math.max(0,1-(el-2600)/900):1;
  for(const p of P){p.vy+=.32;p.vx*=.985;p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;x.save();x.translate(p.x,p.y);x.rotate(p.rot);x.fillStyle=p.c;
   if(p.s)x.fillRect(-p.r/2,-p.r/4,p.r,p.r/2);else{x.beginPath();x.arc(0,0,p.r/2.4,0,7);x.fill()}x.restore()}
  if(el<3500)requestAnimationFrame(f);else c.remove()})(t0);
 toast("Alles für heute erledigt – stark! 🎉",undo);
}

/* ---------- Klicks ---------- */
document.addEventListener("click",e=>{
 const el=e.target;if(!me||el.closest("[data-stop]")||el.closest("dialog"))return;
 const g=el.closest("[data-go]");if(g){e.preventDefault();go(g.dataset.go);return}
 const tb=el.closest("[data-tab]");if(tb){tab=tb.dataset.tab;render();return}
 const p=el.closest("[data-person]");if(p){person=p.dataset.person;ls.set("person",person);render();return}
 const c=el.closest("[data-cat]");if(c){cat=c.dataset.cat;ls.set("cat",cat);render();return}
 const o=el.closest("[data-open]");if(o){const t=tasks.find(x=>x.id===o.dataset.open);if(t)openTask(t);return}
 const art=el.closest(".task");if(!art)return;
 const t=tasks.find(x=>x.id===art.dataset.id);if(!t)return;
 if(el.closest("[data-check]")){
  const before={...t},done=t.status!=="erledigt";
  const nt={...t,status:done?"erledigt":(t.prevStatus||"offen"),prevStatus:done?t.status:null,doneAt:done?Date.now():null};
  const T=iso(new Date()),wasToday=done&&t.due&&t.due<=T,s0=stats();
  const commit=()=>{arrived=t.id;clearTimeout(arrT);arrT=setTimeout(()=>{arrived=null},1200);
   save(nt,before).then(ok=>{if(!ok)return;toast(done?"Erledigt":"Wieder geöffnet",()=>save(before,nt));
    if(wasToday&&s0.od.length+s0.td.length>0){const s1=stats();if(s1.od.length+s1.td.length===0)confetti(()=>save(before,nt))}})};
  if(reduced()){commit();return}
  art.classList.add(done?"leaving":"leaving back");art.style.height=art.offsetHeight+"px";
  requestAnimationFrame(()=>art.classList.add("go"));setTimeout(commit,380);return}
 openTask(t);
});
/* Labor-Eingangsmeldung öffnet direkt den Auftrag in der Labormaske */
function openTask(t){
 const L=window.HD_LABOR;
 if(t.labOrderId&&L&&L.state.orders.some(o=>o.id===t.labOrderId)){go("labor");setTimeout(()=>L.openDetail(t.labOrderId),60);return}
 openForm(t);
}
document.addEventListener("change",e=>{if(e.target.id==="catSel"){cat=e.target.value;ls.set("cat",cat);render()}});
document.addEventListener("input",e=>{if(e.target.id==="q"){q=e.target.value.trim().toLowerCase();render()}});
$("addBtn").onclick=$("fab").onclick=()=>openForm();

/* ---------- Team ---------- */
function openTeam(){$("teamList").innerHTML=team.map(m=>`<li>${esc(m.name)}${m.id===me.id?" (ich)":""}</li>`).join("")||"<li>Noch niemand.</li>";$("t_name").value=nameOf(me.id);$("teamDlg").showModal()}
$("teamBtn").onclick=openTeam;$("mobTeam").onclick=openTeam;
$("teamClose").onclick=()=>$("teamDlg").close();
$("teamForm").addEventListener("submit",async e=>{e.preventDefault();const n=$("t_name").value.trim();if(!n)return;
 const{error}=await sb.from("profiles").upsert({id:me.id,name:n});if(error){toast("Name nicht gespeichert");return}
 const m=team.find(x=>x.id===me.id);m?m.name=n:team.push({id:me.id,name:n});$("teamDlg").close();render();toast("Name gespeichert")});

/* ---------- Installieren & Service Worker ---------- */
let installEvt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEvt=e;$("installBtn").classList.remove("hidden")});
$("installBtn").onclick=async()=>{if(!installEvt)return;installEvt.prompt();await installEvt.userChoice;installEvt=null;$("installBtn").classList.add("hidden")};
if("serviceWorker" in navigator&&location.protocol.startsWith("http")){
 /* Updates: beim Öffnen und beim Zurückkehren in die App nach neuer Version schauen und automatisch neu laden */
 navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).then(reg=>{
  const check=()=>reg.update().catch(()=>{});setInterval(check,5*60000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")check()});
 }).catch(()=>{});
 let reloading=false,hadCtrl=!!navigator.serviceWorker.controller;
 navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!hadCtrl){hadCtrl=true;return}if(reloading)return;reloading=true;
  const busy=document.querySelector("dialog[open]")||(window.HD_BERATUNG&&page==="beratung");
  if(busy){toast("Neue Version verfügbar – App bitte einmal neu öffnen");return}location.reload()});
}

/* ---------- Anmeldung ---------- */
$("loginForm").addEventListener("submit",async e=>{
 e.preventDefault();$("loginErr").textContent="";$("loginBtn").disabled=true;
 const{error}=await sb.auth.signInWithPassword({email:$("l_mail").value.trim(),password:$("l_pw").value});
 $("loginBtn").disabled=false;
 if(error)$("loginErr").textContent=/invalid/i.test(error.message)?"E-Mail oder Passwort stimmt nicht.":"Anmeldung fehlgeschlagen: "+error.message;
});
$("forgotBtn").onclick=async()=>{
 const mail=$("l_mail").value.trim();$("loginErr").textContent="";$("loginOk").textContent="";
 if(!mail){$("loginErr").textContent="Bitte oben zuerst deine E-Mail-Adresse eintragen.";$("l_mail").focus();return}
 $("forgotBtn").disabled=true;
 const{error}=await sb.auth.resetPasswordForEmail(mail,{redirectTo:location.origin+location.pathname});
 $("forgotBtn").disabled=false;
 if(error){$("loginErr").textContent=/rate|seconds/i.test(error.message)?"Bitte kurz warten und es dann noch einmal versuchen.":"Konnte keinen Link senden: "+error.message;return}
 $("loginOk").textContent="Link ist unterwegs. Bitte die E-Mail auf diesem Gerät öffnen und auf den Link tippen.";
};
$("pwForm").addEventListener("submit",async e=>{
 e.preventDefault();const a=$("pw1").value,b=$("pw2").value;$("pwErr").textContent="";
 if(a.length<8){$("pwErr").textContent="Bitte mindestens 8 Zeichen.";return}
 if(a!==b){$("pwErr").textContent="Die beiden Passwörter stimmen nicht überein.";return}
 $("pwBtn").disabled=true;const{error}=await sb.auth.updateUser({password:a});$("pwBtn").disabled=false;
 if(error){$("pwErr").textContent=/different|same/i.test(error.message)?"Bitte ein anderes Passwort als bisher wählen.":"Nicht gespeichert: "+error.message;return}
 pwMode=null;$("pw1").value=$("pw2").value="";history.replaceState(null,"",location.pathname);
 const{data}=await sb.auth.getSession();me=null;await onSession(data.session);toast("Passwort gespeichert");
});
const logout=async()=>{$("teamDlg").close();await sb.auth.signOut();try{localStorage.removeItem("hd_cache")}catch{}};
$("logoutBtn").onclick=logout;$("logoutBtn2").onclick=logout;
$("nameForm").addEventListener("submit",async e=>{e.preventDefault();const n=$("n_name").value.trim();if(!n)return;
 const{error}=await sb.from("profiles").upsert({id:me.id,name:n});
 if(error){$("nameErr").textContent="Konnte nicht gespeichert werden: "+error.message;return}
 enterApp()});

async function onSession(session){
 if(!session){me=null;tasks=[];team=[];loaded=false;if(channel){sb.removeChannel(channel);channel=null}show("loginView");return}
 if(pwMode){me=null;$("pw_user").value=session.user.email||"";
  $("pwTitle").textContent=pwMode==="invite"?"Willkommen im Portal":"Neues Passwort";
  $("pwText").textContent=pwMode==="invite"?"Lege jetzt dein persönliches Passwort fest. Damit meldest du dich künftig in der App auf allen Geräten an.":"Lege ein neues Passwort fest. Danach bist du direkt angemeldet.";
  show("pwView");setTimeout(()=>$("pw1").focus(),50);return}
 if(me&&me.id===session.user.id)return;
 me={id:session.user.id,email:session.user.email};
 const c=ls.get("cache",null);if(c){tasks=c.tasks||[];team=c.team||[]}
 const{data,error}=await sb.from("profiles").select("id,name").eq("id",me.id).maybeSingle();
 if(!error&&!data){show("nameView");$("n_name").focus();return}
 enterApp();
}
function enterApp(){show("appView");render();loadAll();subscribe();window.HD_PREISE&&window.HD_PREISE.load();window.HD_LABOR&&window.HD_LABOR.load();clearInterval(timer);timer=setInterval(render,60000)}

/* Einladungs- und Passwort-Links: Art des Links merken, bevor supabase-js die Adresse aufräumt */
const AUTH_HASH=new URLSearchParams((location.hash||"").replace(/^#/,""));
const AUTH_QUERY=new URLSearchParams(location.search);
let pwMode=["invite","recovery"].includes(AUTH_HASH.get("type"))?AUTH_HASH.get("type"):["invite","recovery"].includes(AUTH_QUERY.get("type"))?AUTH_QUERY.get("type"):null;
const AUTH_ERR=AUTH_HASH.get("error_code")||AUTH_HASH.get("error")||AUTH_QUERY.get("error_code");
function start(url,key){
 if(!window.supabase||!window.supabase.createClient){show("setupView");$("setupErr").textContent="Die Datenbank-Bibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen und neu laden.";return}
 sb=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true}});
 sb.auth.getSession().then(({data})=>onSession(data.session));
 sb.auth.onAuthStateChange((ev,session)=>{if(ev==="PASSWORD_RECOVERY")pwMode=pwMode||"recovery";if(ev==="SIGNED_IN"||ev==="SIGNED_OUT"||ev==="PASSWORD_RECOVERY")setTimeout(()=>onSession(session),0)});
 if(AUTH_ERR){history.replaceState(null,"",location.pathname);setTimeout(()=>{$("loginErr").textContent=/expired|otp/i.test(AUTH_ERR)?"Der Link ist abgelaufen oder wurde schon benutzt. Unten auf „Passwort vergessen?“ tippen – dann kommt ein neuer Link per E-Mail.":"Der Link hat nicht funktioniert ("+AUTH_ERR+"). Bitte „Passwort vergessen?“ nutzen."},50)}
}
$("setupForm").addEventListener("submit",e=>{e.preventDefault();const u=$("s_url").value.trim().replace(/\/+$/,""),k=$("s_key").value.trim();
 if(!/^https:\/\/.+/.test(u)){$("setupErr").textContent="Die URL muss mit https:// beginnen.";return}
 ls.set("cfg",{u,k});start(u,k)});
const C=window.HD_CONFIG||{},saved=ls.get("cfg",null);
if(location.hash==="#kunde"){}
else if(C.SUPABASE_URL&&C.SUPABASE_KEY)start(C.SUPABASE_URL,C.SUPABASE_KEY);
else if(saved)start(saved.u,saved.k);
else show("setupView");
})();
