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
 const{error}=await H().sb.from("lab_orders").upsert({...row,updated_at:new Date().toISOString()});
 if(error){H().toast("Nicht gespeichert: "+error.message);load();return false}
 if(msg)H().toast(msg);return true;
}
const meName=()=>{const me=H().me;return(H().team().find(t=>t.id===me?.id)?.name)||me?.email||""};
function advance(o,dir=1){
 const stage=Math.max(0,Math.min(6,o.stage+dir));if(stage===o.stage)return;
 const history=[...(o.history||[]),{step:dir>0?stage:o.stage,dir,at:new Date().toISOString(),by:meName()}];
 save({...o,stage,history},dir>0?(stage===6?"Fertig – bereit zur Anpassung":`${STEPS[stage-1].t} erledigt`):"Schritt zurückgenommen");
}

/* ---------- Zusammenfassung der Spezifikation ---------- */
function earSpec(o,side){const s=o.spec||{};return s.same!==false?s.R||{}:s[side]||{}}
function summary(o){const r=earSpec(o,o.sides==="links"?"L":"R");return [r.form,r.material&&r.material.split(" (")[0]+(r.haerte&&r.material.startsWith("Weich")?" "+r.haerte:""),r.farbe,r.vent&&r.vent!=="Keine"?"Vent "+r.vent:""].filter(Boolean).join(" · ")}
const sideChips=o=>(o.sides==="beide"?["R","L"]:[o.sides==="rechts"?"R":"L"]).map(s=>`<span class="ear ${s}">${s==="R"?"Rechts":"Links"}</span>`).join("");

/* ---------- Ansicht ---------- */
function track(o){
 return `<ol class="ltrack">${STEPS.map((s,i)=>{const cls=i<o.stage?"done":i===o.stage?"now":"";return `<li class="${cls}"><span class="ldot">${i<o.stage?"✓":i+1}</span><small>${s.t}</small></li>`}).join("")}</ol>`;
}
function card(o){
 const n=daysTo(o.due),late=n!=null&&n<0&&o.stage<6,soon=n!=null&&n<=1&&o.stage<6;
 const next=o.stage<6?STEPS[o.stage]:null;
 return `<article class="lcard${late?" late":""}${o.urgent?" urgent":""}" data-l-open="${esc(o.id)}">
  <div class="lhead"><div><b class="lname">${esc(o.customer)}</b><div class="meta">${sideChips(o)}${o.urgent?'<span class="tag hot">Eilig</span>':""}<span>${esc(summary(o)||"Spezifikation offen")}</span></div></div>
   <div class="ldue ${late?"late":soon?"soon":""}">${o.due?esc(dueLabel(o.due)):"kein Termin"}</div></div>
  ${track(o)}
  <div class="lfoot"><span class="muted">${o.stage===6?"Alle Schritte erledigt":next?`Als Nächstes: <b>${esc(next.l)}</b>`:""}</span>
   ${o.stage<6?`<button class="btn primary sm" data-l-next="${esc(o.id)}">✓ ${esc(next.t)} erledigt</button>`:`<button class="btn sm" data-l-deliver="${esc(o.id)}">An Kunden übergeben</button>`}</div>
 </article>`;
}
function render(){
 if(!st.loaded){if(!st.loading&&H().sb)setTimeout(load,0);return `<div class="empty"><p>Labor wird geladen …</p></div>`}
 if(st.missing)return `<div class="empty"><p><b>Die Labor-Tabelle ist noch nicht eingerichtet.</b><br>Bitte <code>sql/003_labor.sql</code> einmal in Supabase ausführen.</p></div>`;
 const open=st.orders.filter(o=>!o.delivered_at);
 const counts=[0,1,2,3,4,5,6].map(i=>open.filter(o=>o.stage===i).length);
 const fl=st.filter===""?open:open.filter(o=>String(o.stage)===st.filter);
 const byDue=(a,b)=>(b.urgent-a.urgent)||((a.due||"9")>(b.due||"9")?1:-1);
 const inWork=fl.filter(o=>o.stage>0&&o.stage<6).sort(byDue),fresh=fl.filter(o=>o.stage===0).sort(byDue),done=fl.filter(o=>o.stage===6).sort(byDue);
 const late=open.filter(o=>o.stage<6&&daysTo(o.due)!=null&&daysTo(o.due)<0).length;
 const strip=`<div class="lstrip">${[["","Alle offen",open.length],...STEPS.map((s,i)=>[String(i),s.t,counts[i]]),["6","Fertig",counts[6]]].map(([k,l,c],idx)=>`<button data-l-filter="${k}" aria-pressed="${st.filter===k}"><b>${c}</b><small>${l}</small></button>`).join("")}</div>`;
 const sec=(t,list,cls="")=>list.length?`<section class="list ${cls}"><h3>${t} <small>${list.length}</small></h3>${list.map(card).join("")}</section>`:"";
 const archive=st.orders.filter(o=>o.delivered_at).sort((a,b)=>b.delivered_at.localeCompare(a.delivered_at)).slice(0,30);
 return `<div class="lbar"><div><b>Otoplastik-Labor</b><span class="muted">${open.length} offen${late?` · <em class="hotx">${late} überfällig</em>`:""}</span></div><button class="btn primary" data-l-new>+ Laborauftrag</button></div>`+strip+
  (fl.length?sec("Neu eingegangen – Abformung liegt bereit",fresh)+sec("In Fertigung",inWork)+sec("Fertig – bereit zur Anpassung",done,"ready"):
   `<div class="empty"><p>${open.length?"Keine Aufträge in diesem Schritt.":"Keine offenen Laboraufträge. Aufträge entstehen in der Beratung oder über „+ Laborauftrag“."}</p></div>`)+
  `<button class="linkbtn" data-l-archive>${st.archive?"Übergebene ausblenden":"Übergebene Aufträge anzeigen ("+archive.length+")"}</button>`+
  (st.archive&&archive.length?`<section class="list"><h3>Übergeben</h3>${archive.map(o=>`<article class="lcard done" data-l-open="${esc(o.id)}"><div class="lhead"><div><b class="lname">${esc(o.customer)}</b><div class="meta">${sideChips(o)}<span>${esc(summary(o))}</span></div></div><div class="ldue">übergeben ${esc(when(o.delivered_at))}</div></div></article>`).join("")}</section>`:"");
}

/* ---------- Formular (Auftrag anlegen / bearbeiten) ---------- */
const blankEar=()=>({anbindung:"RIC / Ex-Hörer",form:"",material:"",haerte:"",farbe:"",vent:"",kanal:"",extras:[],hoerer:""});
const blank=()=>({id:null,customer:"",phone:"",sides:"beide",due:"",urgent:false,notes:"",spec:{same:true,R:blankEar(),L:blankEar(),abformung:{datum:iso(new Date()),masse:"Silikon (A-vernetzend)",qualitaet:"Gut",besonderheiten:""}}});
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
  <label>Anpasstermin<input data-lf-in="due" type="date" value="${esc(f.due||"")}"></label><div class="lq inline"><span class="lql">Priorität</span><div class="chips"><button type="button" class="chip" data-lf-urgent aria-pressed="${!!f.urgent}">Eilig</button></div></div></div>
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
  if(d.lfUrgent!=null){st.form.urgent=!st.form.urgent;paintForm();return}
  if(d.lfCancel!=null){document.getElementById("labDlg").close();return}
  if(d.lfDel!=null){if(!b.dataset.sure){b.dataset.sure=1;b.textContent="Wirklich löschen?";return}
   const id=st.form.id;document.getElementById("labDlg").close();const{error}=await H().sb.from("lab_orders").delete().eq("id",id);if(error)H().toast("Löschen fehlgeschlagen");else{st.orders=st.orders.filter(o=>o.id!==id);H().rerender();H().toast("Auftrag gelöscht")}return}
  if(d.lfSave!=null){const fo=st.form;if(!fo.customer.trim()){f.querySelector('[data-lf-in="customer"]').focus();return}
   if(fo.sides!=="beide")fo.spec.same=true;if(fo.sides==="links"&&fo.spec.same)fo.spec.L=fo.spec.R;
   const isNew=!fo.id,row={id:fo.id||(crypto.randomUUID?crypto.randomUUID():String(Date.now())),customer:fo.customer.trim(),phone:fo.phone||null,sides:fo.sides,due:fo.due||null,urgent:!!fo.urgent,notes:fo.notes||null,spec:fo.spec,
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

/* ---------- Ereignisse in der Übersicht ---------- */
document.addEventListener("click",e=>{
 if(!H()||!H().laborActive())return;const el=e.target;if(el.closest("dialog"))return;
 const n=el.closest("[data-l-next]");if(n){e.stopPropagation();const o=st.orders.find(x=>x.id===n.dataset.lNext);if(o)advance(o,1);return}
 const dv=el.closest("[data-l-deliver]");if(dv){const o=st.orders.find(x=>x.id===dv.dataset.lDeliver);if(o)save({...o,delivered_at:new Date().toISOString()},"Als übergeben markiert");return}
 const f=el.closest("[data-l-filter]");if(f){st.filter=st.filter===f.dataset.lFilter?"":f.dataset.lFilter;H().rerender();return}
 if(el.closest("[data-l-new]")){openForm();return}
 if(el.closest("[data-l-archive]")){st.archive=!st.archive;H().rerender();return}
 const o=el.closest("[data-l-open]");if(o){openDetail(o.dataset.lOpen);return}
},true);

window.HD_LABOR={render,load,openForm,STEPS,OPT,state:st,openCount:()=>st.orders.filter(o=>!o.delivered_at).length,lateCount:()=>st.orders.filter(o=>!o.delivered_at&&o.stage<6&&daysTo(o.due)!=null&&daysTo(o.due)<0).length};
})();
