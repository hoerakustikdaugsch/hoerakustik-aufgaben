/* Hörakustik Daugsch · Aufgaben-App
   Daten: Supabase (Postgres + Live-Sync). Alle angemeldeten Team-Mitglieder sehen dieselben Aufgaben. */
(() => {
const CATS=[["Kunden",["Rückruf","Anpassung","Reservierung"]],["Werkstatt",["Aufarbeitung","Reparatur","Otoplastik"]],["Einkauf & Lager",["Bestellung","Zubehör","Lagerausbuchung","Rücksendung Hersteller"]],["Verwaltung",["Krankenkasse","Buchhaltung","Marketing","Sonstiges"]]];
const GROUP_OF={};CATS.forEach(([g,cs])=>cs.forEach(c=>GROUP_OF[c]=g));
const STATUS={offen:"Offen",arbeit:"In Arbeit",wartet:"Wartet",erledigt:"Erledigt"};
const PRIO={hoch:0,normal:1,niedrig:2};
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ls={get(k,d){try{const v=localStorage.getItem("hd_"+k);return v==null?d:JSON.parse(v)}catch{return d}},set(k,v){try{localStorage.setItem("hd_"+k,JSON.stringify(v))}catch{}}};
const pad=n=>String(n).padStart(2,"0");
const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const addDays=(n,base=new Date())=>{const d=new Date(base);d.setDate(d.getDate()+n);return iso(d)};
const fmtDate=s=>{if(!s)return"";const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString("de-DE",{weekday:"short",day:"numeric",month:"short"})};
const uid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2,10));
const show=v=>["setupView","loginView","nameView","appView"].forEach(x=>$(x).classList.toggle("hidden",x!==v));

let sb=null,me=null,tasks=[],team=[],view="tag",person=ls.get("person","alle"),cat=ls.get("cat",""),q="",editing=null,loaded=false,live=false,channel=null;

/* ---------- Umwandlung Datenbank <-> App ---------- */
const fromRow=r=>({id:r.id,title:r.title,category:r.category,assignee:r.assignee||"",due:r.due||"",priority:r.priority,status:r.status,prevStatus:r.prev_status||null,
 customer:r.customer||"",phone:r.phone||"",manufacturer:r.manufacturer||"",model:r.model||"",notes:r.notes||"",
 createdAt:r.created_at?Date.parse(r.created_at):0,doneAt:r.done_at?Date.parse(r.done_at):null});
const toRow=t=>({id:t.id,title:t.title,category:t.category||"Sonstiges",assignee:t.assignee||null,due:t.due||null,priority:t.priority||"normal",status:t.status||"offen",
 prev_status:t.prevStatus||null,customer:t.customer||null,phone:t.phone||null,manufacturer:t.manufacturer||null,model:t.model||null,notes:t.notes||null,
 created_at:new Date(t.createdAt||Date.now()).toISOString(),updated_at:new Date().toISOString(),done_at:t.doneAt?new Date(t.doneAt).toISOString():null});
const putLocal=t=>{const i=tasks.findIndex(x=>x.id===t.id);i<0?tasks.push(t):tasks[i]=t};
const cache=()=>ls.set("cache",{tasks,team,at:Date.now()});

/* ---------- Speichern (sofort sichtbar, bei Fehler zurück) ---------- */
async function save(t,before){
 putLocal(t);render();
 const{error}=await sb.from("tasks").upsert(toRow(t));
 if(error){before?putLocal(before):(tasks=tasks.filter(x=>x.id!==t.id));render();toast("Nicht gespeichert – keine Verbindung?");return false}
 cache();return true;
}
async function removeTask(t){
 tasks=tasks.filter(x=>x.id!==t.id);render();
 const{error}=await sb.from("tasks").delete().eq("id",t.id);
 if(error){putLocal(t);render();toast("Löschen fehlgeschlagen");return false}
 cache();return true;
}

/* ---------- Daten laden + live halten ---------- */
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
function setSync(ok,txt){live=ok;$("sync").classList.toggle("off",!ok);$("syncTxt").textContent=txt;render()}
// Beim Zurückkehren zur App (z. B. Handy aus der Tasche) neu abgleichen
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&me){loadAll();if(!live)subscribe()}});
window.addEventListener("online",()=>{if(me){loadAll();subscribe()}});
window.addEventListener("offline",()=>setSync(false,"offline"));

/* ---------- Anzeige ---------- */
function match(t){
 if(person!=="alle"&&(t.assignee||"")!==person)return false;
 if(cat&&t.category!==cat&&GROUP_OF[t.category]!==cat)return false;
 if(q){const h=[t.title,t.customer,t.phone,t.manufacturer,t.model,t.notes,t.category].join(" ").toLowerCase();if(!h.includes(q))return false}
 return true;
}
const sortT=(a,b)=>(PRIO[a.priority]??1)-(PRIO[b.priority]??1)||(a.due||"9").localeCompare(b.due||"9")||(a.createdAt||0)-(b.createdAt||0);
const nameOf=id=>team.find(x=>x.id===id)?.name||"";
const initials=id=>nameOf(id).split(/\s+/).filter(Boolean).map(w=>w[0]).join("").slice(0,2).toUpperCase();

function card(t){
 const T=iso(new Date()),late=t.due&&t.due<T&&t.status!=="erledigt";
 const st=t.status&&t.status!=="offen"&&t.status!=="erledigt"?`<span class="tag ${t.status==="wartet"?"wait":"work"}">${STATUS[t.status]}</span>`:"";
 const device=[t.manufacturer,t.model].filter(Boolean).join(" ");
 const tel=t.phone?`<a href="tel:${esc(t.phone.replace(/[^\d+]/g,""))}" data-stop>☎ ${esc(t.phone)}</a>`:"";
 return `<article class="task${t.priority==="hoch"?" urgent":""}${t.status==="erledigt"?" done":""}" data-id="${esc(t.id)}">
  <button class="check" data-check aria-label="${t.status==="erledigt"?"Wieder öffnen":"Als erledigt markieren"}"><i></i></button>
  <div><div class="title">${esc(t.title)}</div>
   <div class="meta"><span class="tag">${esc(t.category||"Sonstiges")}</span>${t.priority==="hoch"?'<span class="tag hot">Dringend</span>':""}${st}
   ${t.customer?`<span>${esc(t.customer)}</span>`:""}${tel}${device?`<span>${esc(device)}</span>`:""}</div>
   ${t.notes?`<div class="meta">${esc(t.notes.length>110?t.notes.slice(0,110)+"…":t.notes)}</div>`:""}</div>
  <div class="side">${t.due?`<div class="${late?"late":""}">${late?"seit ":""}${esc(fmtDate(t.due))}</div>`:""}${t.assignee&&initials(t.assignee)?`<span class="who" title="${esc(nameOf(t.assignee))}">${esc(initials(t.assignee))}</span>`:""}</div>
 </article>`;
}
const sec=(title,list,cls="")=>list.length?`<section class="${cls}"><h2>${title} <small>${list.length}</small></h2>${list.sort(sortT).map(card).join("")}</section>`:"";

function render(){
 if(!me)return;
 const now=new Date(),T=iso(now),TM=addDays(1),SUN=addDays(6-(now.getDay()+6)%7);
 $("today").textContent=now.toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
 if(person!=="alle"&&team.length&&!team.some(m=>m.id===person))person="alle";
 const open=tasks.filter(t=>t.status!=="erledigt"),mine=open.filter(match);
 const od=mine.filter(t=>t.due&&t.due<T),td=mine.filter(t=>t.due===T);
 $("people").innerHTML=[["alle","Alle"],...team.map(m=>[m.id,m.name])].map(([id,n])=>{
  const own=open.filter(t=>id==="alle"||t.assignee===id),late=own.filter(t=>t.due&&t.due<T).length;
  const av=id==="alle"?"★":esc(initials(id));
  return `<button class="pbtn" data-person="${esc(id)}" aria-pressed="${person===id}"><i class="av" aria-hidden="true">${av}</i><span>${esc(n)}${id===me.id?" (ich)":""}<small class="cnt">${own.length} offen${late?` · <b>${late} überfällig</b>`:""}</small></span></button>`}).join("");
 $("pageTitle").textContent=person==="alle"?"Aufgaben":person===me.id?"Meine Aufgaben":"Aufgaben von "+(nameOf(person)||"…");
 $("stats").innerHTML=[["hot",od.length,"Überfällig"],["",td.length,"Heute fällig"],["",mine.filter(t=>t.status==="wartet").length,"Wartet"],["",mine.length,"Offen gesamt"]]
  .map(([c,n,l])=>`<div class="stat ${n&&c?c:""}"><strong>${n}</strong><span>${l}</span></div>`).join("");
 $("cats").innerHTML=`<button class="chip" data-cat="" aria-pressed="${!cat}">Alle Kategorien</button>`+CATS.map(([g])=>`<button class="chip" data-cat="${esc(g)}" aria-pressed="${cat===g}">${esc(g)}</button>`).join("")+
  `<select id="catSel" aria-label="Einzelne Kategorie"><option value="">Genauer …</option>${CATS.map(([g,cs])=>`<optgroup label="${esc(g)}">${cs.map(c=>`<option ${cat===c?"selected":""}>${esc(c)}</option>`).join("")}</optgroup>`).join("")}</select>`;
 document.querySelectorAll(".tabs button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.view===view));
 let n="";
 if(!navigator.onLine){const c=ls.get("cache",null);n+=`<div class="note">Keine Internetverbindung – du siehst den Stand von ${c?new Date(c.at).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}):"vorhin"} Uhr. Änderungen sind erst wieder online möglich.</div>`}
 $("notes").innerHTML=n;
 let h="";
 if(!loaded&&!tasks.length)h=`<p class="empty">Aufgaben werden geladen …</p>`;
 else if(view==="tag"){
  const rest=mine.filter(t=>!(t.due&&t.due<=T)),nw=rest.filter(t=>t.status!=="wartet");
  h=sec("Überfällig",od,"overdue")+sec("Heute",td)+sec("Morgen",nw.filter(t=>t.due===TM))+sec("Diese Woche",nw.filter(t=>t.due>TM&&t.due<=SUN))+
   sec("Später",nw.filter(t=>t.due>SUN&&t.due>TM))+sec("Ohne Datum",nw.filter(t=>!t.due))+sec("Wartet auf Hersteller / Krankenkasse",rest.filter(t=>t.status==="wartet"));
 }else if(view==="alle")h=sec("Alle offenen Aufgaben",mine.slice());
 else{const d=tasks.filter(t=>t.status==="erledigt"&&match(t)).sort((a,b)=>(b.doneAt||0)-(a.doneAt||0)).slice(0,100);
  h=d.length?`<section><h2>Zuletzt erledigt <small>${d.length}</small></h2>${d.map(card).join("")}</section>`:""}
 if(!h)h=`<div class="empty"><svg viewBox="0 0 120 60" aria-hidden="true"><path d="M0 30 C20 10 40 50 60 30 S100 10 120 30" fill="none" stroke="#8BAAA2" stroke-width="4" stroke-linecap="round"/><path d="M0 44 C20 24 40 64 60 44 S100 24 120 44" fill="none" stroke="#B7C6C2" stroke-width="4" stroke-linecap="round"/></svg>${view==="erledigt"?"Noch nichts erledigt.":q||cat||person!=="alle"?"Keine Aufgaben für diesen Filter.":"Keine offenen Aufgaben. Mit „+“ legst du die erste an."}</div>`;
 $("list").innerHTML=h;
 $("meLine").textContent="Angemeldet als "+(nameOf(me.id)||me.email);
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

/* ---------- Toast ---------- */
let tt;function toast(msg,undo){$("toastMsg").textContent=msg;$("toastUndo").style.display=undo?"":"none";$("toastUndo").onclick=()=>{undo&&undo();$("toast").style.display="none"};
 $("toast").style.display="flex";clearTimeout(tt);tt=setTimeout(()=>$("toast").style.display="none",undo?6000:2200)}

/* ---------- Klicks ---------- */
document.addEventListener("click",e=>{
 const el=e.target;if(!me||el.closest("[data-stop]")||el.closest("dialog"))return;
 const v=el.closest("[data-view]");if(v){view=v.dataset.view;render();return}
 const p=el.closest("[data-person]");if(p){person=p.dataset.person;ls.set("person",person);render();return}
 const c=el.closest("[data-cat]");if(c){cat=c.dataset.cat;ls.set("cat",cat);render();return}
 const art=el.closest(".task");if(!art)return;
 const t=tasks.find(x=>x.id===art.dataset.id);if(!t)return;
 if(el.closest("[data-check]")){
  const before={...t},done=t.status!=="erledigt";
  const nt={...t,status:done?"erledigt":(t.prevStatus||"offen"),prevStatus:done?t.status:null,doneAt:done?Date.now():null};
  save(nt,before).then(ok=>ok&&toast(done?"Erledigt":"Wieder geöffnet",()=>save(before,nt)));return}
 openForm(t);
});
document.addEventListener("change",e=>{if(e.target.id==="catSel"){cat=e.target.value;ls.set("cat",cat);render()}});
$("q").addEventListener("input",e=>{q=e.target.value.trim().toLowerCase();render()});
$("addBtn").onclick=$("fab").onclick=()=>openForm();

/* ---------- Team / eigener Name ---------- */
$("teamBtn").onclick=()=>{$("teamList").innerHTML=team.map(m=>`<li><span>${esc(m.name)}${m.id===me.id?" (ich)":""}</span></li>`).join("")||"<li>Noch niemand.</li>";$("t_name").value=nameOf(me.id);$("teamDlg").showModal()};
$("teamClose").onclick=()=>$("teamDlg").close();
$("teamForm").addEventListener("submit",async e=>{e.preventDefault();const n=$("t_name").value.trim();if(!n)return;
 const{error}=await sb.from("profiles").upsert({id:me.id,name:n});if(error){toast("Name nicht gespeichert");return}
 const m=team.find(x=>x.id===me.id);m?m.name=n:team.push({id:me.id,name:n});$("teamDlg").close();render();toast("Name gespeichert")});

/* ---------- Installieren ---------- */
let installEvt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEvt=e;$("installBtn").classList.remove("hidden")});
$("installBtn").onclick=async()=>{if(!installEvt)return;installEvt.prompt();await installEvt.userChoice;installEvt=null;$("installBtn").classList.add("hidden")};
const standalone=matchMedia("(display-mode: standalone)").matches||navigator.standalone;
if(/iphone|ipad|ipod/i.test(navigator.userAgent)&&!standalone)$("iosHint").classList.remove("hidden");
if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("sw.js").catch(()=>{});

/* ---------- Anmeldung ---------- */
$("loginForm").addEventListener("submit",async e=>{
 e.preventDefault();$("loginErr").textContent="";$("loginBtn").disabled=true;
 const{error}=await sb.auth.signInWithPassword({email:$("l_mail").value.trim(),password:$("l_pw").value});
 $("loginBtn").disabled=false;
 if(error)$("loginErr").textContent=/invalid/i.test(error.message)?"E-Mail oder Passwort stimmt nicht.":"Anmeldung fehlgeschlagen: "+error.message;
});
$("logoutBtn").onclick=async()=>{await sb.auth.signOut();try{localStorage.removeItem("hd_cache")}catch{}};
$("nameForm").addEventListener("submit",async e=>{e.preventDefault();const n=$("n_name").value.trim();if(!n)return;
 const{error}=await sb.from("profiles").upsert({id:me.id,name:n});
 if(error){$("nameErr").textContent="Konnte nicht gespeichert werden: "+error.message;return}
 enterApp()});

async function onSession(session){
 if(!session){me=null;tasks=[];team=[];loaded=false;if(channel){sb.removeChannel(channel);channel=null}show("loginView");return}
 if(me&&me.id===session.user.id)return;
 me={id:session.user.id,email:session.user.email};
 const c=ls.get("cache",null);if(c){tasks=c.tasks||[];team=c.team||[]}
 const{data,error}=await sb.from("profiles").select("id,name").eq("id",me.id).maybeSingle();
 if(!error&&!data){show("nameView");$("n_name").focus();return}
 enterApp();
}
function enterApp(){show("appView");render();loadAll();subscribe();setInterval(render,60000)}

/* ---------- Start ---------- */
function start(url,key){
 if(!window.supabase||!window.supabase.createClient){show("setupView");$("setupErr").textContent="Die Datenbank-Bibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen und neu laden.";return}
 sb=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true}});
 sb.auth.getSession().then(({data})=>onSession(data.session));
 sb.auth.onAuthStateChange((ev,session)=>{if(ev==="SIGNED_IN"||ev==="SIGNED_OUT")setTimeout(()=>onSession(session),0)});
}
$("setupForm").addEventListener("submit",e=>{e.preventDefault();const u=$("s_url").value.trim().replace(/\/+$/,""),k=$("s_key").value.trim();
 if(!/^https:\/\/.+/.test(u)){$("setupErr").textContent="Die URL muss mit https:// beginnen.";return}
 ls.set("cfg",{u,k});start(u,k)});
const C=window.HD_CONFIG||{},saved=ls.get("cfg",null);
if(C.SUPABASE_URL&&C.SUPABASE_KEY)start(C.SUPABASE_URL,C.SUPABASE_KEY);
else if(saved)start(saved.u,saved.k);
else show("setupView");
})();
