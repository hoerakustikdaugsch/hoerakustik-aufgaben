/* Kalender – Termine aus AkuWin (nur lesen)
   Daten kommen über die Supabase-Funktion "akuwin" (Aktion "appointments"). Nichts davon wird im Browser gespeichert. */
(function(){
const H=()=>window.HD;
const esc=s=>H().esc(s);
const pad=n=>String(n).padStart(2,"0");
const iso=d=>H().iso(d);
const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const monday=d=>{const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
const hm=s=>s.slice(11,16);
const mins=s=>Number(s.slice(11,13))*60+Number(s.slice(14,16));
const STATE={Approved:"Bestätigt",Perceived:"Wahrgenommen",Cancelled:"Abgesagt",Requested:"Angefragt"};
const isMobile=()=>matchMedia("(max-width:760px)").matches;

const st={view:null,date:new Date(),res:"all",showCancelled:false,cache:{},loading:false,err:"",resources:[],types:[],timer:null,lastLoad:0};
const view=()=>st.view||(isMobile()?"day":"week");
const weekKey=d=>iso(monday(d));

async function load(force,at){
 const sb=H()&&H().sb;if(!sb)return;
 const ref=at||st.date,key=weekKey(ref);
 if(!force&&st.cache[key]&&Date.now()-st.cache[key].at<5*60000)return;
 if(st.loading)return;st.loading=true;st.err="";H().rerender();
 const from=key,to=iso(addD(monday(ref),6));
 try{
  const r=await sb.functions.invoke("akuwin",{body:{action:"appointments",from,to}});
  if(r.error){let m=String(r.error.message||r.error);try{const j=await r.error.context.json();m=j.error||m}catch{}throw new Error(m)}
  if(r.data.error)throw new Error(r.data.error);
  st.cache[key]={at:Date.now(),list:r.data.appointments||[]};st.resources=r.data.resources||st.resources;st.types=r.data.types||st.types;st.lastLoad=Date.now();
 }catch(e){st.err=e.message||String(e)}
 st.loading=false;H().rerender();
}
function listFor(dayIso){
 const c=st.cache[weekKey(new Date(dayIso+"T12:00"))];if(!c)return null;
 return c.list.filter(a=>a.start.slice(0,10)===dayIso&&(st.res==="all"||a.resources.includes(st.res))&&(st.showCancelled||a.state!=="Cancelled"));
}
const typeColor=a=>{const t=st.types.find(t=>t.id===a.typeId);return t&&t.color&&t.color.toUpperCase()!=="#FFFFFF"?t.color:"#E6EEEA"};
const resName=id=>{const r=st.resources.find(r=>r.id===id);return r?r.name.replace(/\s*\([^)]*\)/,""):""};
const resShort=id=>{const n=resName(id);if(!n)return "";if(!n.includes(","))return n;const [last,first]=n.split(",").map(s=>s.trim());return first||last};

/* Überlappende Termine nebeneinander legen */
function lanes(list){
 const items=list.filter(a=>!a.allDay).map(a=>({a,s:mins(a.start),e:Math.max(mins(a.end),mins(a.start)+15)})).sort((x,y)=>x.s-y.s||y.e-x.e);
 let group=[],groupEnd=-1;const out=[];
 const flush=()=>{const cols=[];group.forEach(it=>{let c=cols.findIndex(end=>end<=it.s);if(c<0){c=cols.length;cols.push(0)}cols[c]=it.e;it.col=c});group.forEach(it=>{it.cols=cols.length;out.push(it)});group=[]};
 items.forEach(it=>{if(it.s>=groupEnd&&group.length)flush();group.push(it);groupEnd=Math.max(groupEnd,it.e)});if(group.length)flush();
 return out;
}

function apptCard(a,compact){
 const c=typeColor(a);
 if(compact==="line")return `<button type="button" class="kap line${a.state==="Cancelled"?" cancel":""}" data-kopen="${esc(a.id)}" style="--tc:${esc(c)}" title="${esc(hm(a.start)+"–"+hm(a.end)+" "+(a.client||a.type)+" · "+a.type)}"><span class="kt">${a.allDay?"":hm(a.start)}</span><b>${esc(a.client||a.note||a.type)}</b></button>`;
 return `<button type="button" class="kap${a.state==="Cancelled"?" cancel":""}" data-kopen="${esc(a.id)}" style="--tc:${esc(c)}">
  <span class="kt">${a.allDay?"ganztägig":hm(a.start)+"–"+hm(a.end)}</span><b>${esc(a.client||a.note||a.type)}</b>${compact?"":`<span class="ktype">${esc(a.type)}${a.resources.length?" · "+a.resources.map(resShort).map(esc).join(", "):""}</span>`}</button>`;
}

function weekView(){
 const mon=monday(st.date),today=iso(new Date());
 let days=[0,1,2,3,4].map(i=>addD(mon,i));
 const sat=addD(mon,5);const satList=listFor(iso(sat));if(satList&&satList.length)days.push(sat);
 const all=days.map(d=>listFor(iso(d))||[]);
 let h0=8,h1=18;all.flat().filter(a=>!a.allDay).forEach(a=>{h0=Math.min(h0,Math.floor(mins(a.start)/60));h1=Math.max(h1,Math.ceil(mins(a.end)/60))});
 const PH=72,top=m=>(m-h0*60)/60*PH;
 const now=new Date(),nowM=now.getHours()*60+now.getMinutes();
 const hours=[];for(let h=h0;h<=h1;h++)hours.push(h);
 return `<div class="kweek" style="--cols:${days.length}">
  <div class="khead"><span></span>${days.map(d=>`<button type="button" class="kdh${iso(d)===today?" today":""}" data-kday="${iso(d)}"><small>${d.toLocaleDateString("de-DE",{weekday:"short"})}</small><b>${d.getDate()}</b></button>`).join("")}</div>
  <div class="kallday"><span></span>${days.map((d,i)=>`<div>${all[i].filter(a=>a.allDay).map(a=>apptCard(a,"line")).join("")}</div>`).join("")}</div>
  <div class="kgrid" style="height:${(h1-h0)*PH}px">
   <div class="ktimes">${hours.map(h=>`<span style="top:${(h-h0)*PH}px">${pad(h)}:00</span>`).join("")}</div>
   ${days.map((d,i)=>`<div class="kcol${iso(d)===today?" today":""}">${hours.slice(1).map(h=>`<i style="top:${(h-h0)*PH}px"></i>`).join("")}
    ${iso(d)===today&&nowM>=h0*60&&nowM<=h1*60?`<em class="know" style="top:${top(nowM)}px"></em>`:""}
    ${lanes(all[i]).map(it=>{const ht=Math.max((it.e-it.s)/60*PH-3,22);return `<div class="kpos" style="top:${top(it.s)+1}px;height:${ht}px;left:calc(${it.col/it.cols*100}% + 2px);width:calc(${100/it.cols}% - 4px)">${apptCard(it.a,ht<40?"line":ht<62)}</div>`}).join("")}</div>`).join("")}
  </div></div>`;
}

function dayView(){
 const d=new Date(st.date),key=iso(d),list=listFor(key);
 const strip=[0,1,2,3,4,5].map(i=>addD(monday(d),i));
 const today=iso(new Date());
 return `<div class="kstrip">${strip.map(x=>{const n=(listFor(iso(x))||[]).length;return `<button type="button" class="kdh${iso(x)===key?" on":""}${iso(x)===today?" today":""}" data-kday="${iso(x)}"><small>${x.toLocaleDateString("de-DE",{weekday:"short"})}</small><b>${x.getDate()}</b><i>${n||""}</i></button>`}).join("")}</div>
 ${list===null?`<div class="empty"><p>Termine werden geladen …</p></div>`:list.length?`<div class="kagenda">${list.map(a=>`<div class="krow">${apptCard(a,false)}</div>`).join("")}</div>`:`<div class="empty"><p>Keine Termine an diesem Tag.</p></div>`}`;
}

function title(){
 const v=view(),d=new Date(st.date);
 if(v==="day")return d.toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"});
 const mon=monday(d),fri=addD(mon,4);
 return `${mon.getDate()}.${mon.getMonth()===fri.getMonth()?"":(mon.getMonth()+1)+"."} – ${fri.toLocaleDateString("de-DE",{day:"numeric",month:"long",year:"numeric"})}`;
}

function render(){
 if(!st.cache[weekKey(st.date)]&&!st.loading&&!st.err)setTimeout(()=>load(),0);
 clearInterval(st.timer);st.timer=setInterval(()=>{if(H().page()==="kalender"&&document.visibilityState==="visible")load(true)},5*60000);
 const v=view();
 const resChips=[{id:"all",name:"Alle"}].concat(st.resources.map(r=>({id:r.id,name:resShort(r.id)||r.name})));
 const body=st.err&&!st.cache[weekKey(st.date)]?`<div class="empty"><p><b>Termine konnten nicht geladen werden.</b><br>${esc(st.err)}</p><button class="btn" data-kreload>Erneut versuchen</button></div>`
  :v==="week"?(st.cache[weekKey(st.date)]?weekView():`<div class="empty"><p>Termine werden geladen …</p></div>`):dayView();
 return `<div class="bar kbar"><h2>Kalender</h2>
  <div class="knav"><button class="btn primary" data-knew>+ Termin erstellen</button><button class="btn" data-kmove="-1" aria-label="Zurück">‹</button><button class="btn" data-ktoday>Heute</button><button class="btn" data-kmove="1" aria-label="Weiter">›</button><span class="ktitle">${esc(title())}</span></div>
  <div class="tabs" role="group" aria-label="Ansicht"><button data-kview="day" aria-pressed="${v==="day"}">Tag</button><button data-kview="week" aria-pressed="${v==="week"}">Woche</button></div></div>
 <div class="chips kres">${resChips.map(r=>`<button class="chip" data-kres="${esc(r.id)}" aria-pressed="${st.res===r.id}">${esc(r.name)}</button>`).join("")}
  <button class="chip" data-kcancel aria-pressed="${st.showCancelled}">Abgesagte zeigen</button>
  <span class="ksync">${st.loading?"lädt …":st.lastLoad?"AkuWin · Stand "+new Date(st.lastLoad).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}):""} <button class="linkbtn" data-kreload>aktualisieren</button></span></div>
 ${body}`;
}

/* Startseite: heutige Termine */
function todayHtml(){
 if(!H().sb)return "";
 const key=iso(new Date());
 if(!st.cache[weekKey(new Date())]){if(!st.loading&&!st.err)load(false,new Date());return ""}
 const nowM=new Date().getHours()*60+new Date().getMinutes();
 const c=st.cache[weekKey(new Date())].list.filter(a=>a.start.slice(0,10)===key&&a.state!=="Cancelled");
 const next=c.filter(a=>mins(a.end)>=nowM);
 return `<section class="list ktoday"><h3>Termine heute <small>${c.length}</small></h3>
  ${next.length?`<div class="kagenda">${next.slice(0,6).map(a=>`<div class="krow">${apptCard(a,false)}</div>`).join("")}</div>`:`<div class="empty"><p>${c.length?"Für heute sind alle Termine vorbei.":"Heute keine Termine in AkuWin."}</p></div>`}
  <button class="btn" data-go="kalender" style="align-self:flex-start">Zum Kalender ›</button></section>`;
}

function cockpitHtml(){
 if(!H().sb)return `<p class="ckempty">Nicht verbunden.</p>`;
 const wk=st.cache[weekKey(new Date())];
 if(!wk){if(!st.loading&&!st.err)load(false,new Date());return `<p class="ckempty">${st.err?"AkuWin gerade nicht erreichbar.":"Termine werden geladen …"}</p>`}
 const key=iso(new Date()),nowM=new Date().getHours()*60+new Date().getMinutes();
 const c=wk.list.filter(a=>a.start.slice(0,10)===key&&a.state!=="Cancelled");
 const next=c.filter(a=>mins(a.end)>=nowM).slice(0,5);
 return {n:c.length,html:next.length?next.map(a=>`<button type="button" class="ckappt" data-kopen="${esc(a.id)}" style="--tc:${esc(typeColor(a))}"><span class="ckt">${a.allDay?"ganzt.":hm(a.start)}</span><span class="ckn"><b>${esc(a.client||a.note||a.type)}</b><small>${esc(a.type)}${a.resources.length?" · "+a.resources.map(resShort).map(esc).join(", "):""}</small></span></button>`).join("")
  :`<p class="ckempty">${c.length?"Für heute sind alle Termine vorbei.":"Heute keine Termine in AkuWin."}</p>`};
}

/* ---------- Termin erstellen: Kunde, Terminart, freie Zeiten → in AkuWin anlegen ---------- */
// Öffnungszeiten (So=0 … Sa=6) in Minuten ab 0 Uhr – wie in der Beratung
const OPEN={1:[600,1020],2:[600,1020],3:[600,840],4:[600,1020],5:[600,840]};
const hhmm=m=>pad(Math.floor(m/60))+":"+pad(m%60);
const offOf=d=>{const o=-d.getTimezoneOffset();return (o>=0?"+":"-")+pad(Math.floor(Math.abs(o)/60))+":"+pad(Math.abs(o)%60)};
const inDays=day=>{const a=new Date();a.setHours(12,0,0,0);const n=Math.round((new Date(day+"T12:00")-a)/864e5);return n===0?"heute":n===1?"morgen":"in "+n+" Tagen"};
const nf={};
async function invoke(body){
 const r=await H().sb.functions.invoke("akuwin",{body});
 if(r.error){let m=String(r.error.message||r.error);try{const j=await r.error.context.json();m=j.error||m}catch{}throw new Error(m)}
 if(r.data&&r.data.error)throw new Error(r.data.error);return r.data;
}
function nfDefaults(pre){
 Object.keys(nf).forEach(k=>delete nf[k]);
 const types=st.types,emp=st.resources.filter(r=>r.type==="Employee");
 const t=types.find(x=>/^Anpassung$/i.test(x.name))||types[0];
 const meName=((H().team().find(x=>x.id===H().me?.id)||{}).name||"").split(" ")[0].toLowerCase();
 const r=(st.res!=="all"&&st.resources.find(x=>x.id===st.res&&x.type==="Employee"))||emp.find(x=>meName&&x.name.toLowerCase().includes(meName))||emp[0]||st.resources[0];
 Object.assign(nf,{client:null,typeId:t?t.id:"",minutes:t&&t.minutes||30,res:r?r.id:"",room:true,date:"",time:"",note:"",days:14,busy:null,busyKey:"",loading:false,err:"",creating:false},pre||{});
}
async function nfBusy(force){
 const from=iso(new Date()),to=iso(addD(new Date(),nf.days)),key=from+"|"+to;
 if(!force&&nf.busyKey===key&&nf.busy)return;if(nf.loading)return;
 nf.loading=true;nf.err="";paintNew();
 try{const d=await invoke({action:"appointments",from,to});nf.busy=d.appointments||[];nf.busyKey=key;if(d.types&&d.types.length)st.types=d.types;if(d.resources&&d.resources.length)st.resources=d.resources}
 catch(e){nf.busy=null;nf.err=e.message||String(e)}
 nf.loading=false;paintNew();
}
function nfSlots(){
 if(!nf.busy)return null;const dur=Number(nf.minutes)||30,now=new Date(),nowM=now.getHours()*60+now.getMinutes();
 const isEmp=(st.resources.find(r=>r.id===nf.res)||{}).type==="Employee";
 const rooms=nf.room&&isEmp?st.resources.filter(r=>r.type!=="Employee").map(r=>r.id):[];
 const out=[];
 for(let i=0;i<=nf.days;i++){const d=addD(new Date(),i),oh=OPEN[d.getDay()];if(!oh)continue;const day=iso(d);
  const ap=nf.busy.filter(a=>a.start.slice(0,10)<=day&&a.end.slice(0,10)>=day&&a.state!=="Cancelled"&&(!a.resources.length||a.resources.includes(nf.res)||a.resources.some(r=>rooms.includes(r))));
  if(ap.some(a=>a.allDay))continue;
  const busy=ap.map(a=>[a.start.slice(0,10)<day?0:mins(a.start),a.end.slice(0,10)>day?1440:mins(a.end)]);
  const slots=[];for(let m=oh[0];m+dur<=oh[1];m+=15){if(i===0&&m<nowM+30)continue;if(busy.some(([s,e])=>m<e&&m+dur>s))continue;slots.push(m)}
  if(slots.length)out.push({day,date:d,slots});
 }
 return out;
}
function slotsBlock(){
 if(nf.loading&&!nf.busy)return '<p class="muted">Freie Zeiten werden in AkuWin gesucht …</p>';
 if(!nf.busy)return `<p class="akerr">Freie Zeiten konnten nicht geladen werden${nf.err?": "+esc(nf.err):""}.</p><button type="button" class="linkbtn" data-nf-reload>Erneut versuchen</button>`;
 const f=nfSlots()||[];
 if(!f.length)return `<p class="muted">In den nächsten ${nf.days} Tagen ist bei ${esc(resShort(nf.res))} kein passender Zeitraum frei.</p><button type="button" class="linkbtn" data-nf-more>14 Tage weiter suchen</button>`;
 return `<div class="slots">${f.slice(0,10).map(g=>`<div class="sday"><b>${esc(g.date.toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit"}))}<small class="indays">${inDays(g.day)}</small></b><div class="schips">${g.slots.filter(m=>m%30===0).slice(0,10).map(m=>`<button type="button" class="chip schip" data-nf-slot="${g.day}T${hhmm(m)}" aria-pressed="${nf.date===g.day&&nf.time===hhmm(m)}">${hhmm(m)}</button>`).join("")}</div></div>`).join("")}</div>
  <button type="button" class="linkbtn" data-nf-more>Weitere Tage anzeigen</button>`;
}
function newHtml(){
 const types=st.types,durs=[15,30,45,60,90,120];if(!durs.includes(Number(nf.minutes)))durs.push(Number(nf.minutes));
 const isEmp=(st.resources.find(r=>r.id===nf.res)||{}).type==="Employee",roomNames=st.resources.filter(r=>r.type!=="Employee").map(r=>resName(r.id));
 const c=nf.client,ready=c&&nf.typeId&&nf.res&&nf.date&&nf.time;
 return `<div class="kdtop"><div><h3>Termin erstellen</h3><p class="muted">Wird direkt in AkuWin eingetragen.</p></div><button type="button" class="btn" data-nf-close>Abbrechen</button></div>
 <div class="form"><div class="akpick full"><label>Kunde<input id="nfCust" autocomplete="off" value="${esc(c?c.name:"")}" placeholder="Name eingeben – Vorschläge aus AkuWin" ${c?`data-ak-lock="${esc(c.name)}"`:""}></label><div class="akdrop" id="nfDrop" hidden></div>
  ${c?`<div class="akid">AkuWin Kd. ${esc(c.id)}${c.phone?" · "+esc(c.phone):""} <button type="button" data-nf-unclient aria-label="Kunde entfernen">×</button></div>`:""}</div></div>
 <div class="q"><span class="ql">Terminart</span><div class="chips">${types.map(x=>`<button type="button" class="chip tchip" data-nf-type="${esc(x.id)}" aria-pressed="${nf.typeId===x.id}" style="--tc:${esc(x.color&&x.color.toUpperCase()!=="#FFFFFF"?x.color:"#E6EEEA")}"><i></i>${esc(x.name)}</button>`).join("")||'<span class="muted">Terminarten werden geladen …</span>'}</div></div>
 <div class="q"><span class="ql">Bei</span><div class="chips">${st.resources.map(r=>`<button type="button" class="chip" data-nf-res="${esc(r.id)}" aria-pressed="${nf.res===r.id}">${esc(resShort(r.id)||r.name)}</button>`).join("")}</div></div>
 ${isEmp&&roomNames.length?`<label class="ocheckline nfroom"><input type="checkbox" id="nfRoom" ${nf.room?"checked":""}> Nur Zeiten, in denen auch ${esc(roomNames.join(" / "))} frei ist</label>`:""}
 <div class="form tgrid"><label>Dauer<select id="nfMin">${durs.sort((a,b)=>a-b).map(d=>`<option value="${d}" ${Number(nf.minutes)===d?"selected":""}>${d<60?d+" Min.":(d/60).toString().replace(".",",")+" Std."}</option>`).join("")}</select></label>
  <label>Datum<input type="date" id="nfDate" value="${esc(nf.date)}" min="${iso(new Date())}"></label><label>Uhrzeit<input type="time" step="900" id="nfTime" value="${esc(nf.time)}"></label></div>
 <div class="form"><label class="full">Notiz für AkuWin<input id="nfNote" value="${esc(nf.note)}" placeholder="z. B. Hörsysteme mitbringen"></label></div>
 <div class="freeslots"><h4>Freie Termine <small class="muted">${esc(String(nf.minutes))} Min. · ${esc(resShort(nf.res))} · zu den Öffnungszeiten</small></h4>${slotsBlock()}</div>
 <div class="nav2"><span class="muted">${ready?`${esc(new Date(nf.date+"T12:00").toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"}))}, ${nf.time} Uhr · ${esc(c.name)}`:!c?"Bitte Kunde wählen.":!nf.date||!nf.time?"Freie Zeit antippen oder Datum und Uhrzeit eintragen.":""}</span>
  <button type="button" class="btn primary" data-nf-create ${ready&&!nf.creating?"":"disabled"}>${nf.creating?"Wird angelegt …":"In AkuWin anlegen"}</button></div>`;
}
function paintNew(){
 const body=document.getElementById("kNewBody");if(!body||!document.getElementById("kNew").open)return;
 const y=body.scrollTop;body.innerHTML=newHtml();body.scrollTop=y;
 const i=document.getElementById("nfCust");
 if(i&&H().akAttach)H().akAttach(i,document.getElementById("nfDrop"),c=>{nf.client={id:c.id,name:[c.first,c.last].filter(Boolean).join(" "),phone:c.phone||""};paintNew()});
}
function openNew(pre){
 if(!H().sb)return;
 let dlg=document.getElementById("kNew");
 if(!dlg){document.body.insertAdjacentHTML("beforeend",`<dialog id="kNew"><div class="sheet knew bx" id="kNewBody"></div></dialog>`);dlg=document.getElementById("kNew");
  dlg.addEventListener("click",e=>{if(e.target===dlg){dlg.close();return}const b=e.target.closest("button");if(!b)return;const d=b.dataset;
   if(d.nfClose!=null){dlg.close();return}
   if(d.nfUnclient!=null){nf.client=null;paintNew();return}
   if(d.nfType){const t=st.types.find(x=>x.id===d.nfType);nf.typeId=d.nfType;if(t&&t.minutes)nf.minutes=t.minutes;nf.date=nf.time="";paintNew();return}
   if(d.nfRes){nf.res=d.nfRes;nf.date=nf.time="";paintNew();return}
   if(d.nfRoom!=null){nf.room=!nf.room;paintNew();return}
   if(d.nfSlot){const [dd,tt]=d.nfSlot.split("T");if(nf.date===dd&&nf.time===tt){nf.date=nf.time=""}else{nf.date=dd;nf.time=tt}paintNew();return}
   if(d.nfMore!=null){nf.days+=14;nfBusy();return}
   if(d.nfReload!=null){nfBusy(true);return}
   if(d.nfCreate!=null){createNew();return}
  });
  dlg.addEventListener("input",e=>{const t=e.target;if(t.id==="nfNote")nf.note=t.value;
   if(t.id==="nfCust"&&nf.client&&t.value.trim()!==nf.client.name){nf.client=null;const a=dlg.querySelector(".akid");if(a)a.remove()}});
  dlg.addEventListener("change",e=>{const t=e.target;
   if(t.id==="nfRoom"){nf.room=t.checked;nf.date=nf.time="";paintNew()}
   if(t.id==="nfMin"){nf.minutes=Number(t.value);nf.date=nf.time="";paintNew()}
   if(t.id==="nfDate"||t.id==="nfTime"){nf[t.id==="nfDate"?"date":"time"]=t.value;paintNew()}});
 }
 nfDefaults(pre);dlg.showModal();paintNew();nfBusy();
 if(!st.types.length)invoke({action:"apptMeta"}).then(m=>{st.types=m.types||[];st.resources=st.resources.length?st.resources:(m.resources||[]);if(!nf.typeId&&st.types[0]){nf.typeId=st.types[0].id;nf.minutes=st.types[0].minutes||30}paintNew()}).catch(()=>{});
 setTimeout(()=>{const i=document.getElementById("nfCust");if(i&&!nf.client)i.focus()},50);
}
async function createNew(){
 const c=nf.client,ty=st.types.find(x=>x.id===nf.typeId);if(!c||!ty||!nf.date||!nf.time)return;
 const local=new Date(nf.date+"T"+nf.time+":00");if(local<new Date()){H().toast("Der Termin liegt in der Vergangenheit");return}
 const when=local.toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"});
 if(!await H().ask("Termin in AkuWin anlegen?",`${c.name} (Kd. ${c.id})\n${when}, ${nf.time} Uhr – ${ty.name} (${nf.minutes} Min.)\nbei ${resName(nf.res)}${nf.note?"\nNotiz: "+nf.note:""}`,"Anlegen"))return;
 nf.creating=true;paintNew();
 try{
  await invoke({action:"createAppointment",clientId:c.id,typeId:ty.id,start:nf.date+"T"+nf.time+":00"+offOf(local),minutes:Number(nf.minutes),resourceIds:[nf.res],note:nf.note});
  document.getElementById("kNew").close();H().toast("Termin in AkuWin angelegt");
  st.date=local;if(H().page()==="kalender"&&view()==="week"){}delete st.cache[weekKey(local)];load(true,local);
 }catch(e){nf.creating=false;paintNew();await H().ask("Termin nicht angelegt",e.message||String(e),"OK",true)}
}

/* Termin-Details */
function openDetail(id){
 let a=null;for(const k in st.cache){a=st.cache[k].list.find(x=>x.id===id);if(a)break}if(!a)return;
 let dlg=document.getElementById("kDlg");
 if(!dlg){document.body.insertAdjacentHTML("beforeend",`<dialog id="kDlg"><div class="sheet kdet" id="kDlgBody"></div></dialog>`);dlg=document.getElementById("kDlg");
  dlg.addEventListener("click",e=>{if(e.target===dlg){dlg.close();return}const b=e.target.closest("button");if(!b)return;const d=b.dataset;const ap=st.detail;
   if(d.kclose!=null){dlg.close();return}
   if(d.ktask!=null&&ap){dlg.close();H().newTask&&H().newTask({title:`Zum Termin ${new Date(ap.start).toLocaleDateString("de-DE")} ${hm(ap.start)} Uhr (${ap.type}${ap.note?", "+ap.note:""}): `,customer:(ap.client||"").split(",").map(s=>s.trim()).reverse().join(" "),akuwinId:ap.clientId||null});return}
   if(d.kberatung!=null&&ap){dlg.close();window.HD_BERATUNG&&window.HD_BERATUNG.startWith&&window.HD_BERATUNG.startWith(ap.client||"");return}
  })}
 st.detail=a;const day=new Date(a.start);
 const realClient=a.clientId&&a.client&&!/prüfprotokoll|urlaub|blocker/i.test(a.client);
 document.getElementById("kDlgBody").innerHTML=`<div class="kdtop"><span class="kdot" style="background:${esc(typeColor(a))}"></span><div><h3>${esc(a.client||a.type)}</h3><p class="muted">${esc(a.type)}</p></div><button class="btn" data-kclose>Schließen</button></div>
  <dl class="kdl"><dt>Wann</dt><dd>${day.toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"})}, ${a.allDay?"ganztägig":hm(a.start)+" – "+hm(a.end)+" Uhr"}</dd>
  ${a.resources.length?`<dt>Bei</dt><dd>${a.resources.map(resName).map(esc).join(", ")}</dd>`:""}
  ${a.note?`<dt>Notiz</dt><dd>${esc(a.note)}</dd>`:""}
  <dt>Status</dt><dd>${esc(STATE[a.state]||a.state||"–")}${a.recurring?" · Serientermin":""}</dd></dl>
  <div class="actions">${realClient?`<button class="btn" data-ktask>Aufgabe anlegen</button><button class="btn primary" data-kberatung>Beratung starten</button>`:""}</div>
  <p class="muted ksmall">Termine änderst du weiterhin in AkuWin – hier werden sie nur angezeigt.</p>`;
 dlg.showModal();
}

document.addEventListener("click",e=>{
 const el=e.target;if(!H()||el.closest("dialog"))return;
 const o=el.closest("[data-kopen]");if(o){openDetail(o.dataset.kopen);return}
 if(el.closest("[data-knew]")){openNew();return}
 if(H().page()!=="kalender")return;
 const b=el.closest("button");if(!b)return;const d=b.dataset;
 if(d.kmove){const n=Number(d.kmove);st.date=addD(st.date,view()==="day"?n:7*n);H().rerender();load();return}
 if(d.ktoday!=null){st.date=new Date();H().rerender();load();return}
 if(d.kview){st.view=d.kview;H().rerender();return}
 if(d.kday){st.date=new Date(d.kday+"T12:00");st.view="day";H().rerender();load();return}
 if(d.kres){st.res=d.kres;H().rerender();return}
 if(d.kcancel!=null){st.showCancelled=!st.showCancelled;H().rerender();return}
 if(d.kreload!=null){load(true);return}
});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&H()&&H().page&&(H().page()==="kalender"||H().page()==="start"))load(true)});

window.HD_KALENDER={openNew,cockpitHtml,render,load,todayHtml,state:st};
})();
