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
  <div class="knav"><button class="btn" data-kmove="-1" aria-label="Zurück">‹</button><button class="btn" data-ktoday>Heute</button><button class="btn" data-kmove="1" aria-label="Weiter">›</button><span class="ktitle">${esc(title())}</span></div>
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

/* Termin-Details */
function openDetail(id){
 let a=null;for(const k in st.cache){a=st.cache[k].list.find(x=>x.id===id);if(a)break}if(!a)return;
 let dlg=document.getElementById("kDlg");
 if(!dlg){document.body.insertAdjacentHTML("beforeend",`<dialog id="kDlg"><div class="sheet kdet" id="kDlgBody"></div></dialog>`);dlg=document.getElementById("kDlg");
  dlg.addEventListener("click",e=>{if(e.target===dlg){dlg.close();return}const b=e.target.closest("button");if(!b)return;const d=b.dataset;const ap=st.detail;
   if(d.kclose!=null){dlg.close();return}
   if(d.ktask!=null&&ap){dlg.close();H().newTask&&H().newTask({title:"Rückruf: "+(ap.type||"Termin"),category:"Rückruf",customer:ap.client||"",notes:`Termin ${new Date(ap.start).toLocaleDateString("de-DE")} ${hm(ap.start)} Uhr · ${ap.type}${ap.note?" · "+ap.note:""}`});return}
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

window.HD_KALENDER={render,load,todayHtml,state:st};
})();
