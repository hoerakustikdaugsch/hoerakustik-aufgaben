/* Hörakustik Daugsch · Portal – Labor (Otoplastik-Fertigung)
   Auftrag mit Spezifikationen → Workflow in 6 Schritten → fertig zur Anpassung → ausgeliefert. */
(() => {
const STEPS=[
 {t:"Reinigen",l:"Abformung reinigen, Ultraschallbad"},
 {t:"Beschneiden",l:"Abformung beschneiden"},
 {t:"Scannen",l:"Abformung scannen"},
 {t:"Modeling",l:"3D-Modeling"},
 {t:"Druck",l:"3D-Druck"},
 {t:"Finishing",l:"Finishing"}];
const OPT={
 anbindung:["RIC / Ex-Hörer","HdO mit Schlauch","IdO-Schale","Gehörschutz","Schwimmschutz","In-Ear-Monitor"],
 form:["Vollschale (Concha)","Halbschale","Kralle","Spange / Skelett","Gehörgang (Canal)","Mini-Canal","Hohlschale"],
 material:["Hart (Acrylat / Fotopolymer)","Weich (Silikon)","Thermoplastisch"],
 haerte:["Shore 40","Shore 60","Shore 70"],
 farbe:["Transparent","Haut / Beige","Braun","Rot (rechts) / Blau (links)","Schwarz","Individuell"],
 vent:["Keine","0,8 mm","1,0 mm","1,5 mm","2,0 mm","2,5 mm","Offen / IROS"],
 kanal:["Kurz","Mittel","Lang (2. Knick)"],
 extras:["Ziehfaden","Gravur Name / Seite","Lack glänzend","Lack matt","Antibakteriell","Filter (Gehörschutz)"],
 masse:["Silikon (A-vernetzend)","Silikon (C-vernetzend)","Digitaler Ohrscan"],
 qualitaet:["Gut","Nachbessern nötig"]};
const st={orders:[],loaded:false,loading:false,missing:false,filter:"",archive:false,form:null,chan:null,detail:null};
const H=()=>window.HD;
const esc=s=>H().esc(s);
const pad=n=>String(n).padStart(2,"0");
const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const fmt=s=>{if(!s)return"";const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString("de-DE",{weekday:"short",day:"numeric",month:"short"})};
const daysTo=s=>{if(!s)return null;const[y,m,d]=s.split("-").map(Number);const t=new Date();t.setHours(0,0,0,0);return Math.round((new Date(y,m-1,d)-t)/864e5)};
const dueLabel=s=>{const n=daysTo(s);if(n==null)return"";return n<0?`${-n} Tag${n===-1?"":"e"} überfällig`:n===0?"Anpassung heute":n===1?"Anpassung morgen":`Anpassung ${fmt(s)}`};
const when=ts=>new Date(ts).toLocaleString("de-DE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});

/* ---------- Daten ---------- */
async function load(){
 const sb=H().sb;if(!sb)return;st.loading=true;
 const r=await sb.from("lab_orders").select("*").order("created_at",{ascending:false}).limit(300);
 st.loading=false;st.loaded=true;
 if(r.error){st.missing=true;H().rerender();return}
 st.missing=false;st.orders=r.data;H().rerender();
 if(!st.chan){st.chan=sb.channel("hd-labor").on("postgres_changes",{event:"*",schema:"public",table:"lab_orders"},()=>{clearTimeout(st.rt);st.rt=setTimeout(load,250)});st.chan.subscribe()}
}
async function save(row,msg){
 const i=st.orders.findIndex(o=>o.id===row.id);i<0?st.orders.unshift(row):st.orders[i]={...st.orders[i],...row};H().rerender();
 let{error}=await H().sb.from("lab_orders").upsert({...row,updated_at:new Date().toISOString()});
 if(error&&/assignee/.test(error.message||"")){const r={...row,updated_at:new Date().toISOString()};delete r.assignee;({error}=await H().sb.from("lab_orders").upsert(r))}
 if(error){H().toast("Nicht gespeichert: "+error.message);load();return false}
 syncTask(st.orders.find(o=>o.id===row.id)||row);
 if(msg)H().toast(msg);return true;
}
/* ---------- Aufgabe zum Laborauftrag ---------- */
const whoChips=(cur,attr)=>{const team=H().team()||[];return team.length?`<div class="whochips">${team.map(m=>`<button type="button" class="chip" ${attr}="${esc(m.id)}" aria-pressed="${cur===m.id}">${esc(m.name)}${m.id===H().me?.id?" (ich)":""}</button>`).join("")}</div>`:'<span class="muted">Noch kein Team angelegt.</span>'};
const whoName=id=>(H().team()||[]).find(m=>m.id===id)?.name||"";
const whoIni=id=>whoName(id).split(/\s+/).filter(Boolean).map(w=>w[0]).slice(0,2).join("").toUpperCase();
const sidesTxt=o=>o.sides==="beide"?"beidseitig":o.sides==="links"?"links":"rechts";
function taskDue(o){if(o.due){const d=new Date(o.due+"T12:00");d.setDate(d.getDate()-1);const t=new Date();t.setHours(12,0,0,0);return iso(d<t?t:d)}const d=new Date();d.setDate(d.getDate()+3);return iso(d)}
/* legt die Aufgabe an bzw. hält sie aktuell: Zuständig, Termin, Status (fertig → erledigt) */
async function syncTask(o){
 if(!o||!o.id||!H().saveTask)return;
 const all=H().tasks||[],ex=all.find(t=>t.labOrderId===o.id);
 const finished=!!o.delivered_at||o.stage>=6;
 if(!ex){if(finished||!o.assignee)return;
  const t={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),title:"Otoplastik fertigen ("+sidesTxt(o)+")",category:"Otoplastik",assignee:o.assignee,due:taskDue(o),
   priority:o.urgent?"hoch":"normal",status:"offen",customer:o.customer,phone:o.phone||"",notes:[summary(o),o.notes].filter(Boolean).join(" · "),labOrderId:o.id,consultationId:o.consultation_id||null,createdAt:Date.now()};
  await H().saveTask(t,null);return}
 const nt={...ex,customer:o.customer,phone:o.phone||ex.phone,priority:o.urgent?"hoch":ex.priority==="hoch"?"normal":ex.priority,due:taskDue(o)};
 if(o.assignee!==undefined)nt.assignee=o.assignee||"";
 if(finished&&ex.status!=="erledigt"){nt.status="erledigt";nt.prevStatus=ex.status;nt.doneAt=Date.now()}
 if(!finished&&ex.status==="erledigt"){nt.status=ex.prevStatus||"offen";nt.prevStatus=null;nt.doneAt=null}
 const same=["customer","phone","priority","due","assignee","status"].every(k=>(nt[k]||"")===(ex[k]||""));
 if(!same)await H().saveTask(nt,ex);
}
const meName=()=>{const me=H().me;return(H().team().find(t=>t.id===me?.id)?.name)||me?.email||""};
function advance(o,dir=1){moveTo(o,o.stage+dir)}
function moveTo(o,target){
 const stage=Math.max(0,Math.min(6,target));if(stage===o.stage)return;
 const history=[...(o.history||[])],at=new Date().toISOString(),by=meName();
 if(stage>o.stage)for(let i=o.stage+1;i<=stage;i++)history.push({step:i,dir:1,at,by});
 else for(let i=o.stage;i>stage;i--)history.push({step:i,dir:-1,at,by});
 st.arrived=o.id;clearTimeout(st.arrT);st.arrT=setTimeout(()=>{st.arrived=null},1200);
 const col=COLS.find(c=>c.stages.includes(stage));
 save({...o,stage,history},stage<o.stage?"Zurück nach „"+col.t+"“":stage===6?"Fertig – bereit zur Anpassung":"Weiter nach „"+col.t+"“");
}
/* Board-Spalten: welche Stufen gehören dazu, wohin geht es mit „erledigt“ */
const COLS=[
 {k:"neu",t:"Reinigen & Beschneiden",sub:"Neu eingegangen",stages:[0,1],to:2,btn:"Gereinigt & beschnitten"},
 {k:"scan",t:"Scannen",stages:[2],to:3,btn:"Gescannt"},
 {k:"model",t:"Modeling",stages:[3],to:4,btn:"Modeling fertig"},
 {k:"druck",t:"3D-Druck",stages:[4],to:5,btn:"Gedruckt"},
 {k:"finish",t:"Finishing",stages:[5],to:6,btn:"Finishing fertig"},
 {k:"fertig",t:"Fertig",sub:"bereit zur Anpassung",stages:[6],to:null,btn:"An Kunden übergeben"}];

/* ---------- Zusammenfassung der Spezifikation ---------- */
function earSpec(o,side){const s=o.spec||{};return s.same!==false?s.R||{}:s[side]||{}}
function summary(o){const r=earSpec(o,o.sides==="links"?"L":"R");return [r.form,r.material&&r.material.split(" (")[0]+(r.haerte&&r.material.startsWith("Weich")?" "+r.haerte:""),r.farbe,r.vent&&r.vent!=="Keine"?"Vent "+r.vent:""].filter(Boolean).join(" · ")}
const sideChips=o=>(o.sides==="beide"?["R","L"]:[o.sides==="rechts"?"R":"L"]).map(s=>`<span class="ear ${s}">${s==="R"?"Rechts":"Links"}</span>`).join("");

/* ---------- Ansicht ---------- */
function track(o){
 return `<ol class="ltrack">${STEPS.map((s,i)=>{const cls=i<o.stage?"done":i===o.stage?"now":"";return `<li class="${cls}"><span class="ldot">${i<o.stage?"✓":i+1}</span><small>${s.t}</small></li>`}).join("")}</ol>`;
}
function kcard(o,c){
 const n=daysTo(o.due),late=n!=null&&n<0&&o.stage<6,soon=n!=null&&n<=1&&o.stage<6;
 const step=o.stage===1?"Gereinigt – Beschneiden offen":"";
 return `<article class="lk${late?" late":""}${o.urgent?" urgent":""}${st.arrived===o.id?" arrive":""}" data-l-open="${esc(o.id)}" draggable="true" data-l-drag="${esc(o.id)}">
  <div class="lkt"><b>${esc(o.customer)}</b><span class="lkr">${o.urgent?'<span class="tag hot">Eilig</span>':""}${o.assignee?`<span class="who" title="${esc(whoName(o.assignee))}">${esc(whoIni(o.assignee))}</span>`:""}</span></div>
  <div class="lkm">${sideChips(o)}<span class="lks">${esc(summary(o)||"Spezifikation offen")}</span></div>
  ${step?`<div class="lkstep">${step}</div>`:""}
  <div class="lkf"><span class="ldue ${late?"late":soon?"soon":""}">${o.due?esc(dueLabel(o.due)):"kein Termin"}</span>
   ${c.to!=null?`<button class="lkb" data-l-to="${esc(o.id)}" data-stage="${c.to}" title="${esc(c.btn)}">✓ ${esc(c.btn)}</button>`:`<button class="lkb" data-l-deliver="${esc(o.id)}">Übergeben</button>`}</div>
 </article>`;
}
function render(){
 if(!st.loaded){if(!st.loading&&H().sb)setTimeout(load,0);return `<div class="empty"><p>Labor wird geladen …</p></div>`}
 if(st.missing)return `<div class="empty"><p><b>Die Labor-Tabelle ist noch nicht eingerichtet.</b><br>Bitte <code>sql/003_labor.sql</code> einmal in Supabase ausführen.</p></div>`;
 const open=st.orders.filter(o=>!o.delivered_at);
 const byDue=(a,b)=>(b.urgent-a.urgent)||((a.due||"9")>(b.due||"9")?1:-1);
 const late=open.filter(o=>o.stage<6&&daysTo(o.due)!=null&&daysTo(o.due)<0).length;
 const archive=st.orders.filter(o=>o.delivered_at).sort((a,b)=>b.delivered_at.localeCompare(a.delivered_at)).slice(0,30);
 const board=`<div class="lboard">${COLS.map((c,i)=>{const list=open.filter(o=>c.stages.includes(o.stage)).sort(byDue);
  return `<section class="lcol c-${c.k}" data-l-col="${c.stages[0]}"><header><span class="lcn">${i+1}</span><div><b>${c.t}</b>${c.sub?`<small>${c.sub}</small>`:""}</div><em>${list.length}</em></header>
   <div class="lcards">${list.length?list.map(o=>kcard(o,c)).join(""):`<div class="lkempty">${i===0?"Keine neuen Abformungen":"Leer"}</div>`}</div></section>`}).join("")}</div>`;
 return `<div class="lbar"><div><b>Otoplastik-Labor</b><span class="muted">${open.length} offen${late?` · <em class="hotx">${late} überfällig</em>`:""}<span class="lhint"> · Karte antippen für Details, am PC auch per Ziehen verschieben</span></span></div><button class="btn primary" data-l-new>+ Laborauftrag</button></div>`+
  (open.length?board:`<div class="empty"><p>Keine offenen Laboraufträge. Aufträge entstehen in der Beratung oder über „+ Laborauftrag“.</p></div>`)+
  `<button class="linkbtn" data-l-archive>${st.archive?"Übergebene ausblenden":"Übergebene Aufträge anzeigen ("+archive.length+")"}</button>`+
  (st.archive&&archive.length?`<div class="larch">${archive.map(o=>`<article class="lk done" data-l-open="${esc(o.id)}"><div class="lkt"><b>${esc(o.customer)}</b></div><div class="lkm">${sideChips(o)}<span class="lks">${esc(summary(o))}</span></div><div class="lkf"><span class="ldue">übergeben ${esc(when(o.delivered_at))}</span></div></article>`).join("")}</div>`:"");
}

/* ---------- Formular (Auftrag anlegen / bearbeiten) ---------- */
const blankEar=()=>({anbindung:"RIC / Ex-Hörer",form:"",material:"",haerte:"",farbe:"",vent:"",kanal:"",extras:[],hoerer:""});
const blank=()=>({id:null,assignee:H().me?.id||null,customer:"",phone:"",sides:"beide",due:"",urgent:false,notes:"",spec:{same:true,R:blankEar(),L:blankEar(),abformung:{datum:iso(new Date()),masse:"Silikon (A-vernetzend)",qualitaet:"Gut",besonderheiten:""}}});
function getP(p){return p.split(".").reduce((o,k)=>o==null?o:o[k],st.form)}
function setP(p,v){const ks=p.split(".");let o=st.form;ks.slice(0,-1).forEach(k=>{if(o[k]==null)o[k]={};o=o[k]});o[ks.at(-1)]=v}
const chips=(p,opts,multi)=>`<div class="chips">${opts.map(v=>{const on=multi?(getP(p)||[]).includes(v):getP(p)===v;return `<button type="button" class="chip" ${multi?"data-lf-tog":"data-lf-set"}="${p}" data-v="${esc(v)}" aria-pressed="${on}">${esc(v)}</button>`}).join("")}</div>`;
const row=(label,html)=>`<div class="lq"><span class="lql">${label}</span>${html}</div>`;
function earForm(side){
 const p=`spec.${side}`,e=getP(p)||{};
 return row("Anbindung",chips(p+".anbindung",OPT.anbindung))+row("Form",chips(p+".form",OPT.form))+row("Material",chips(p+".material",OPT.material))+
  ((e.material||"").startsWith("Weich")?row("Härte",chips(p+".haerte",OPT.haerte)):"")+row("Farbe",chips(p+".farbe",OPT.farbe))+row("Belüftung (Vent)",chips(p+".vent",OPT.vent))+
  row("Kanallänge",chips(p+".kanal",OPT.kanal))+row("Extras",chips(p+".extras",OPT.extras,true))+
  ((e.anbindung||"").startsWith("RIC")?row("Hörer",`<input data-lf-in="${p}.hoerer" value="${esc(e.hoerer||"")}" placeholder="z. B. Hersteller-Hörer M, Länge 2">`):"");
}
function formHtml(){
 const f=st.form,s=f.spec,both=f.sides==="beide";
 const earTabs=both&&s.same===false;
 return `<h3>${f.id?"Laborauftrag bearbeiten":"Neuer Laborauftrag"}</h3>
 <div class="lgrid"><label>Kunde<input data-lf-in="customer" value="${esc(f.customer)}" required placeholder="Vor- und Nachname"></label><label>Telefon<input data-lf-in="phone" value="${esc(f.phone||"")}" type="tel"></label>
  <label>Anpasstermin<input data-lf-in="due" type="date" value="${esc(f.due||"")}"></label>
  <div class="lq inline full"><span class="lql">Wer übernimmt?</span>${whoChips(f.assignee,"data-lf-who")}</div><div class="lq inline"><span class="lql">Priorität</span><div class="chips"><button type="button" class="chip" data-lf-urgent aria-pressed="${!!f.urgent}">Eilig</button></div></div></div>
 <div class="lsec"><h4>Abformung</h4>${row("Datum",`<input data-lf-in="spec.abformung.datum" type="date" value="${esc(s.abformung?.datum||"")}">`)}${row("Material",chips("spec.abformung.masse",OPT.masse))}${row("Qualität",chips("spec.abformung.qualitaet",OPT.qualitaet))}
  ${row("Besonderheiten",`<input data-lf-in="spec.abformung.besonderheiten" value="${esc(s.abformung?.besonderheiten||"")}" placeholder="z. B. enger 2. Knick, Exostose rechts">`)}</div>
 <div class="lsec"><h4>Otoplastik</h4>${row("Seite",chips("sides",["rechts","links","beide"]))}
  ${both?row("Ausführung",`<div class="chips"><button type="button" class="chip" data-lf-same="1" aria-pressed="${s.same!==false}">Beide Seiten gleich</button><button type="button" class="chip" data-lf-same="0" aria-pressed="${s.same===false}">Seiten unterschiedlich</button></div>`):""}
  ${earTabs?`<div class="ears2"><div><h5 class="ear R">Rechts</h5>${earForm("R")}</div><div><h5 class="ear L">Links</h5>${earForm("L")}</div></div>`:earForm(f.sides==="links"&&!both?"L":"R")}</div>
 <label class="full">Hinweise fürs Labor<textarea data-lf-in="notes" placeholder="z. B. Gerät wird am Freitag angepasst, Kunde wünscht diskrete Farbe">${esc(f.notes||"")}</textarea></label>
 <div class="actions">${f.id?'<button type="button" class="btn danger" data-lf-del>Löschen</button>':""}<button type="button" class="btn" data-lf-cancel>Abbrechen</button><button type="button" class="btn primary" data-lf-save>${f.id?"Speichern":"Auftrag ans Labor"}</button></div>`;
}
function openForm(o){
 ensure();st.form=o?JSON.parse(JSON.stringify({...blank(),...o,spec:{...blank().spec,...(o.spec||{})}})):blank();
 if(o&&o.sides==="links"&&o.spec&&o.spec.same!==false&&!o.spec.R)st.form.spec.R=o.spec.L||blankEar();
 paintForm();document.getElementById("labDlg").showModal();
}
function paintForm(){const d=document.getElementById("labForm"),y=d.scrollTop;d.innerHTML=formHtml();d.scrollTop=y}
function ensure(){
 if(document.getElementById("labDlg"))return;
 document.body.insertAdjacentHTML("beforeend",`<dialog id="labDlg" class="wide"><div class="sheet lform" id="labForm"></div></dialog><dialog id="labDetail" class="wide"><div class="sheet" id="labDetailBody"></div></dialog>`);
 const f=document.getElementById("labForm");
 f.addEventListener("click",async e=>{const b=e.target.closest("button");if(!b)return;const d=b.dataset;
  if(d.lfSet){setP(d.lfSet,getP(d.lfSet)===d.v&&d.lfSet!=="sides"?"":d.v);paintForm();return}
  if(d.lfTog){const a=getP(d.lfTog)||[];setP(d.lfTog,a.includes(d.v)?a.filter(x=>x!==d.v):[...a,d.v]);paintForm();return}
  if(d.lfSame){st.form.spec.same=d.lfSame==="1";if(!st.form.spec.same)st.form.spec.L=JSON.parse(JSON.stringify(st.form.spec.R));paintForm();return}
  if(d.lfWho!=null){st.form.assignee=st.form.assignee===d.lfWho?null:d.lfWho;paintForm();return}
  if(d.lfUrgent!=null){st.form.urgent=!st.form.urgent;paintForm();return}
  if(d.lfCancel!=null){document.getElementById("labDlg").close();return}
  if(d.lfDel!=null){if(!b.dataset.sure){b.dataset.sure=1;b.textContent="Wirklich löschen?";return}
   const id=st.form.id;document.getElementById("labDlg").close();const lt=(H().tasks||[]).find(t=>t.labOrderId===id&&t.status!=="erledigt");if(lt)H().saveTask({...lt,status:"erledigt",prevStatus:lt.status,doneAt:Date.now(),notes:((lt.notes||"")+" · Laborauftrag gelöscht").trim()},lt);
   const{error}=await H().sb.from("lab_orders").delete().eq("id",id);if(error)H().toast("Löschen fehlgeschlagen");else{st.orders=st.orders.filter(o=>o.id!==id);H().rerender();H().toast("Auftrag gelöscht")}return}
  if(d.lfSave!=null){const fo=st.form;if(!fo.customer.trim()){f.querySelector('[data-lf-in="customer"]').focus();return}
   if(fo.sides!=="beide")fo.spec.same=true;if(fo.sides==="links"&&fo.spec.same)fo.spec.L=fo.spec.R;
   const isNew=!fo.id,row={id:fo.id||(crypto.randomUUID?crypto.randomUUID():String(Date.now())),assignee:fo.assignee||null,customer:fo.customer.trim(),phone:fo.phone||null,sides:fo.sides,due:fo.due||null,urgent:!!fo.urgent,notes:fo.notes||null,spec:fo.spec,
    ...(isNew?{stage:0,history:[{step:0,dir:0,at:new Date().toISOString(),by:meName()}]}:{})};
   document.getElementById("labDlg").close();await save(row,isNew?"Auftrag ist im Labor":"Auftrag gespeichert");return}
 });
 f.addEventListener("input",e=>{const t=e.target;if(t.dataset.lfIn)setP(t.dataset.lfIn,t.value)});
 document.getElementById("labDetail").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const d=b.dataset,o=st.orders.find(x=>x.id===st.detail);if(!o)return;
  if(d.ldClose!=null){document.getElementById("labDetail").close();return}
  if(d.ldEdit!=null){document.getElementById("labDetail").close();openForm(o);return}
  if(d.ldNext!=null){advance(o,1);setTimeout(()=>openDetail(o.id),50);return}
  if(d.ldBack!=null){advance(o,-1);setTimeout(()=>openDetail(o.id),50);return}
  if(d.ldDeliver!=null){save({...o,delivered_at:new Date().toISOString()},"Als übergeben markiert");document.getElementById("labDetail").close();return}
  if(d.ldReopen!=null){save({...o,delivered_at:null},"Wieder geöffnet");document.getElementById("labDetail").close();return}
 });
}
function specTable(e){
 const rows=[["Anbindung",e.anbindung],["Form",e.form],["Material",[e.material,(e.material||"").startsWith("Weich")?e.haerte:""].filter(Boolean).join(", ")],["Farbe",e.farbe],["Belüftung",e.vent],["Kanallänge",e.kanal],["Extras",(e.extras||[]).join(", ")],["Hörer",e.hoerer]].filter(r=>r[1]);
 return rows.length?`<dl class="lspec">${rows.map(r=>`<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join("")}</dl>`:'<p class="muted">Keine Angaben.</p>';
}
function openDetail(id){
 ensure();const o=st.orders.find(x=>x.id===id);if(!o)return;st.detail=id;const s=o.spec||{},a=s.abformung||{};
 const ears=o.sides==="beide"&&s.same===false?`<div class="ears2"><div><h5 class="ear R">Rechts</h5>${specTable(s.R||{})}</div><div><h5 class="ear L">Links</h5>${specTable(s.L||{})}</div></div>`:specTable(earSpec(o,o.sides==="links"?"L":"R"));
 const hist=(o.history||[]).slice().reverse().map(h=>`<li><b>${h.dir===0?"Auftrag angelegt":h.dir<0?"Zurückgenommen: "+(STEPS[h.step-1]?.t||""):STEPS[h.step-1]?.l||""}</b><small>${esc(when(h.at))}${h.by?" · "+esc(h.by):""}</small></li>`).join("");
 document.getElementById("labDetailBody").innerHTML=`<div class="ldtop"><div><h3>${esc(o.customer)}</h3><div class="meta">${sideChips(o)}${o.urgent?'<span class="tag hot">Eilig</span>':""}${o.phone?`<a href="tel:${esc(o.phone.replace(/[^\d+]/g,""))}">${esc(o.phone)}</a>`:""}<span>${o.due?esc(dueLabel(o.due)):"kein Anpasstermin"}</span></div></div><button class="btn" data-ld-close>Schließen</button></div>
  ${track(o)}
  <div class="ldgrid"><div><h4>Otoplastik</h4>${ears}${o.notes?`<p class="lnote">${esc(o.notes)}</p>`:""}<h4>Abformung</h4><dl class="lspec"><dt>Datum</dt><dd>${esc(a.datum?fmt(a.datum):"–")}</dd><dt>Material</dt><dd>${esc(a.masse||"–")}</dd><dt>Qualität</dt><dd>${esc(a.qualitaet||"–")}</dd>${a.besonderheiten?`<dt>Besonderheiten</dt><dd>${esc(a.besonderheiten)}</dd>`:""}</dl></div>
   <div><h4>Verlauf</h4><ol class="lhist">${hist}</ol></div></div>
  <div class="actions"><button class="btn" data-ld-edit>Bearbeiten</button>${o.delivered_at?'<button class="btn" data-ld-reopen>Wieder öffnen</button>':`${o.stage>0?'<button class="btn" data-ld-back>← Schritt zurück</button>':""}${o.stage<6?`<button class="btn primary" data-ld-next>✓ ${esc(STEPS[o.stage].t)} erledigt</button>`:'<button class="btn primary" data-ld-deliver>An Kunden übergeben</button>'}`}</div>`;
 const dlg=document.getElementById("labDetail");if(!dlg.open)dlg.showModal();
}

/* ---------- Ziehen & Ablegen (PC) ---------- */
document.addEventListener("dragstart",e=>{const c=e.target.closest&&e.target.closest("[data-l-drag]");if(!c||!H().laborActive())return;st.drag=c.dataset.lDrag;e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",st.drag);setTimeout(()=>c.classList.add("dragging"),0)});
document.addEventListener("dragend",()=>{st.drag=null;document.querySelectorAll(".lk.dragging,.lcol.over").forEach(x=>x.classList.remove("dragging","over"))});
document.addEventListener("dragover",e=>{if(!st.drag)return;const col=e.target.closest&&e.target.closest("[data-l-col]");if(!col)return;e.preventDefault();document.querySelectorAll(".lcol.over").forEach(x=>x!==col&&x.classList.remove("over"));col.classList.add("over")});
document.addEventListener("drop",e=>{if(!st.drag)return;const col=e.target.closest&&e.target.closest("[data-l-col]");if(!col)return;e.preventDefault();const o=st.orders.find(x=>x.id===st.drag);const target=Number(col.dataset.lCol);
 col.classList.remove("over");if(o&&!COLS.find(c=>c.stages.includes(o.stage)).stages.includes(target))moveTo(o,target);st.drag=null});

/* ---------- Ereignisse in der Übersicht ---------- */
document.addEventListener("click",e=>{
 if(!H()||!H().laborActive())return;const el=e.target;if(el.closest("dialog"))return;
 const to=el.closest("[data-l-to]");if(to){e.stopPropagation();const o=st.orders.find(x=>x.id===to.dataset.lTo);if(!o)return;const card=to.closest(".lk");
  const go=()=>moveTo(o,Number(to.dataset.stage));if(card&&!matchMedia("(prefers-reduced-motion: reduce)").matches){card.style.height=card.offsetHeight+"px";card.classList.add("leaving");requestAnimationFrame(()=>card.classList.add("go"));setTimeout(go,340)}else go();return}
 const dv=el.closest("[data-l-deliver]");if(dv){const o=st.orders.find(x=>x.id===dv.dataset.lDeliver);if(o)save({...o,delivered_at:new Date().toISOString()},"Als übergeben markiert");return}
 if(el.closest("[data-l-new]")){openForm();return}
 if(el.closest("[data-l-archive]")){st.archive=!st.archive;H().rerender();return}
 const o=el.closest("[data-l-open]");if(o){openDetail(o.dataset.lOpen);return}
},true);

window.HD_LABOR={render,load,openForm,syncTask,whoChips,STEPS,COLS,OPT,state:st,openCount:()=>st.orders.filter(o=>!o.delivered_at).length,lateCount:()=>st.orders.filter(o=>!o.delivered_at&&o.stage<6&&daysTo(o.due)!=null&&daysTo(o.due)<0).length};
})();
