/* Hörakustik Daugsch · Portal – Modul Preise
   Geräte mit EK anlegen → Preiskategorie, Kundenstufe und Preise werden automatisch erkannt. */
(() => {
const STAGES=[
 {id:"basis",name:"Basis",sub:"Gut hören im ruhigen Alltag"},
 {id:"komfort",name:"Komfort",sub:"Einfach hören. Bequem aufladen."},
 {id:"balance",name:"Balance",sub:"Mehr Sicherheit im Höralltag"},
 {id:"praezision",name:"Präzision",sub:"Gesprächen leichter folgen"},
 {id:"exzellenz",name:"Exzellenz",sub:"Souverän hören, auch wenn es lebhaft wird"},
 {id:"perfektion",name:"Perfektion",sub:"Höchste Technik für höchste Ansprüche"}];
const FORMS=["RIC (Ex-Hörer)","HdO","HdO mit Schlauch","IdO","CIC / IIC"];
const st={bands:[],extras:[],devices:[],gkv:690,plus:{},sub:"geraete",q:"",stage:"",loaded:false,missing:false,
 calc:{device:"",ins:"gkv",count:2,otos:0},editing:null,chan:null};
const H=()=>window.HD;
const eur=n=>(Math.round(n*100)/100).toLocaleString("de-DE",{minimumFractionDigits:n%1?2:0,maximumFractionDigits:2})+" €";
const num=v=>{const n=parseFloat(String(v).replace(/\./g,"").replace(",","."));return isFinite(n)?n:null};
const stageName=id=>STAGES.find(s=>s.id===id)?.name||id;

/* ---------- Preislogik ---------- */
function bandFor(ek){
 const b=st.bands.slice().sort((a,b)=>a.sort-b.sort);
 return b.find(x=>ek>=Number(x.ek_from)&&(x.ek_to==null||ek<=Number(x.ek_to)))||null;
}
const share=vk=>Math.max(0,vk-st.gkv);
function stageFrom(stage){const bs=st.bands.filter(b=>b.stage===stage);if(!bs.length)return null;const vk=Math.min(...bs.map(b=>Number(b.vk_private)));return{vk,gkv:share(vk)}}
function quote(dev,ins,count,otos){
 const band=bandFor(Number(dev.ek));if(!band)return null;
 const vk=Number(band.vk_private),per=ins==="privat"?vk:share(vk),lines=[];
 lines.push({label:`${count} × Hörsystem ${dev.manufacturer} ${dev.model}${ins==="gkv"?" (Eigenanteil)":""}`,amount:per*count,per});
 const pick=x=>Number(ins==="privat"?x.price_private:x.price_gkv);
 if(dev.receiver){const x=st.extras.find(e=>e.kind==="receiver");if(x)lines.push({label:`${count} × ${x.name}`,amount:pick(x)*count})}
 if(dev.charger_id){const x=st.extras.find(e=>e.id===dev.charger_id);if(x)lines.push({label:x.name,amount:pick(x)})}
 if(otos>0){const x=st.extras.find(e=>e.kind==="otoplastic");if(x)lines.push({label:`${otos} × ${x.name}`,amount:pick(x)*otos})}
 return{band,vk,per,lines,total:lines.reduce((s,l)=>s+l.amount,0)};
}

/* ---------- Laden & Live ---------- */
async function load(){
 const sb=H().sb;if(!sb)return;st.loading=true;
 const [b,e,d,s]=await Promise.all([sb.from("price_bands").select("*").order("sort"),sb.from("extras").select("*").order("sort"),
  sb.from("devices").select("*").order("manufacturer"),sb.from("settings").select("*")]);
 if(b.error||e.error||d.error){st.missing=true;st.loaded=true;st.loading=false;H().rerender();return}
 st.missing=false;st.bands=b.data;st.extras=e.data;st.devices=d.data;
 const g=(s.data||[]).find(x=>x.key==="gkv_share_per_side");if(g)st.gkv=Number(g.value);
 const pl=(s.data||[]).find(x=>x.key==="stage_plus");st.plus=pl&&pl.value&&typeof pl.value==="object"?pl.value:{};
 st.loaded=true;st.loading=false;H().rerender();
 if(!st.chan){st.chan=sb.channel("hd-preise");["price_bands","extras","devices","settings"].forEach(t=>st.chan.on("postgres_changes",{event:"*",schema:"public",table:t},()=>{clearTimeout(st.rt);st.rt=setTimeout(load,300)}));st.chan.subscribe()}
}
async function up(table,row,ok){
 const{error}=await H().sb.from(table).upsert(row);
 if(error){H().toast("Nicht gespeichert: "+error.message);load();return false}
 if(ok)H().toast(ok);return true;
}

/* ---------- Ansicht ---------- */
const esc=s=>H().esc(s),svg=(n,x)=>H().svg(n,x);
function stageStrip(){
 return `<div class="pstages">${STAGES.map((s,i)=>{const f=stageFrom(s.id),n=st.devices.filter(d=>d.active&&bandFor(Number(d.ek))?.stage===s.id).length;
  return `<button class="pstage${st.stage===s.id?" on":""}" data-p-stage="${s.id}"><span class="pnum">${String(i+1).padStart(2,"0")}</span><b>${s.name}</b><small>${esc(s.sub)}</small>
   <span class="pfrom">${f?(s.id==="basis"?"Kassenleistung":"ab "+eur(f.gkv)):"–"}</span><small>${f?(s.id==="basis"?"privat "+eur(f.vk):"Eigenanteil · privat ab "+eur(f.vk)):""} je Seite</small>
   <span class="pcount">${n} ${n===1?"Gerät":"Geräte"}</span></button>`}).join("")}</div>`;
}
function deviceRow(d){
 const b=bandFor(Number(d.ek)),ch=st.extras.find(e=>e.id===d.charger_id);
 const chips=[d.receiver?"Ex-Hörer":"",ch?ch.name:"",d.otoplastic?"Otoplastik":""].filter(Boolean).map(c=>`<span class="tag">${esc(c)}</span>`).join("");
 return `<article class="prow${d.active?"":" off"}" data-p-dev="${esc(d.id)}">
  <div class="body"><span class="title">${esc(d.manufacturer)} ${esc(d.model)}</span>
   <div class="meta"><span>${esc(d.form)}</span><span>${esc(d.power)}</span>${b?`<span class="tag work">${esc(b.name)}</span>`:'<span class="tag hot">keine Kategorie</span>'}${chips}${d.active?"":'<span class="tag wait">inaktiv</span>'}</div></div>
  <div class="pprice">${b?`<b>${eur(share(Number(b.vk_private)))}</b><small>Kasse / Seite</small>`:""}</div>
  <div class="pprice">${b?`<b>${eur(Number(b.vk_private))}</b><small>privat / Seite</small>`:""}</div>
  <div class="pprice ek"><b>${eur(Number(d.ek))}</b><small>EK</small></div>
 </article>`;
}
function calcBox(){
 const devs=st.devices.filter(d=>d.active).sort((a,b)=>Number(a.ek)-Number(b.ek));
 const c=st.calc,dev=devs.find(d=>d.id===c.device)||devs[0];
 const qq=dev?quote(dev,c.ins,c.count,c.otos):null;
 const seg=(k,opts)=>`<div class="pseg">${opts.map(([v,l])=>`<button data-p-calc="${k}" data-v="${v}" aria-pressed="${String(c[k])===String(v)}">${l}</button>`).join("")}</div>`;
 return `<aside class="aside pcalc"><h3>Preisrechner</h3>
  ${devs.length?`<label class="plbl">Gerät<select id="p_calcdev">${devs.map(d=>`<option value="${esc(d.id)}" ${dev&&d.id===dev.id?"selected":""}>${esc(d.manufacturer)} ${esc(d.model)}</option>`).join("")}</select></label>
  ${seg("ins",[["gkv","Gesetzlich"],["privat","Privat"]])}${seg("count",[[1,"1 Seite"],[2,"Beidseitig"]])}${seg("otos",[[0,"Keine Otoplastik"],[1,"1 Otoplastik"],[2,"2 Otoplastiken"]])}
  ${qq?`<div class="plines">${qq.lines.map(l=>`<div><span>${esc(l.label)}</span><b>${eur(l.amount)}</b></div>`).join("")}<div class="ptotal"><span>${c.ins==="gkv"?"Ihr Eigenanteil":"Gesamtpreis"}</span><b>${eur(qq.total)}</b></div></div>
   <small class="note">${esc(stageName(qq.band.stage))} · Kategorie ${esc(qq.band.name)}. Unverbindliche Preisorientierung. Der endgültige Preis richtet sich nach der gewählten Versorgung und wird in einem Kostenvoranschlag festgehalten.</small>`:'<span class="note">Für dieses Gerät passt keine Preiskategorie.</span>'}`
  :'<span class="note">Lege ein Gerät an, dann rechnet der Preisrechner hier sofort Eigenanteil bzw. Privatpreis aus.</span>'}
 </aside>`;
}
function devicesTab(){
 const ql=st.q.toLowerCase();
 const list=st.devices.filter(d=>(!st.stage||bandFor(Number(d.ek))?.stage===st.stage)&&(!ql||[d.manufacturer,d.model,d.form,d.features].join(" ").toLowerCase().includes(ql)));
 const groups=STAGES.map(s=>[s,list.filter(d=>bandFor(Number(d.ek))?.stage===s.id).sort((a,b)=>Number(a.ek)-Number(b.ek))]).filter(([,l])=>l.length);
 const none=list.filter(d=>!bandFor(Number(d.ek)));
 const body=groups.length||none.length?groups.map(([s,l])=>`<section class="list"><h3>${s.name} <small>${l.length}</small></h3>${l.map(deviceRow).join("")}</section>`).join("")+(none.length?`<section class="list overdue"><h3>Ohne Kategorie <small>${none.length}</small></h3>${none.map(deviceRow).join("")}</section>`:"")
  :`<div class="empty"><p>${st.devices.length?"Keine Geräte für diesen Filter.":"Noch keine Geräte angelegt. Mit „Gerät anlegen“ legst du Hersteller, Modell und EK an – Stufe und Preise erkennt das Tool automatisch."}</p></div>`;
 return `<div class="bar" style="gap:10px"><label class="search">${svg("search")}<input id="p_q" type="search" placeholder="Hersteller oder Modell suchen …" value="${esc(st.q)}" aria-label="Geräte suchen"></label>${st.stage?`<button class="chip" data-p-stage="" aria-pressed="true">${esc(stageName(st.stage))} ✕</button>`:""}</div>
  <div class="grid2"><div>${body}</div>${calcBox()}</div>`;
}
function bandsTab(){
 return `<div class="hint">Hier pflegst du die 11 internen Preiskategorien. Kunden sehen nur die 6 Stufen mit dem jeweils niedrigsten „ab“-Preis. Änderungen gelten sofort für alle Geräte.</div>
 <div class="pcard"><label class="plbl" style="max-width:280px">Kassenanteil je Seite (€)<input data-p-gkv value="${st.gkv}" inputmode="decimal"></label></div>
 <div class="pcard scroll"><table class="ptable"><thead><tr><th>Kategorie</th><th>Kundenstufe</th><th>EK von</th><th>EK bis</th><th>VK privat / Seite</th><th>Eigenanteil Kasse</th></tr></thead><tbody>
 ${st.bands.slice().sort((a,b)=>a.sort-b.sort).map(b=>`<tr><td><input data-p-band="${esc(b.id)}" data-f="name" value="${esc(b.name)}"></td>
  <td><select data-p-band="${esc(b.id)}" data-f="stage">${STAGES.map(s=>`<option value="${s.id}" ${b.stage===s.id?"selected":""}>${s.name}</option>`).join("")}</select></td>
  <td><input data-p-band="${esc(b.id)}" data-f="ek_from" value="${b.ek_from}" inputmode="decimal"></td>
  <td><input data-p-band="${esc(b.id)}" data-f="ek_to" value="${b.ek_to??""}" placeholder="offen" inputmode="decimal"></td>
  <td><input data-p-band="${esc(b.id)}" data-f="vk_private" value="${b.vk_private}" inputmode="decimal"></td>
  <td class="num">${eur(share(Number(b.vk_private)))}</td></tr>`).join("")}</tbody></table></div>`;
}
function extrasTab(){
 return `<div class="hint">Zusatzpositionen werden zusätzlich zum Gerätepreis berechnet. Ob Ex-Hörer, Ladegerät oder Otoplastik anfallen, legst du am jeweiligen Gerät fest.</div>
 <div class="pcard scroll"><table class="ptable"><thead><tr><th>Position</th><th>Privat</th><th>Kasse</th><th>Abrechnung</th><th>Hinweis</th></tr></thead><tbody>
 ${st.extras.map(x=>`<tr><td><input data-p-extra="${esc(x.id)}" data-f="name" value="${esc(x.name)}"></td>
  <td><input data-p-extra="${esc(x.id)}" data-f="price_private" value="${x.price_private}" inputmode="decimal"></td>
  <td><input data-p-extra="${esc(x.id)}" data-f="price_gkv" value="${x.price_gkv}" inputmode="decimal"></td>
  <td><select data-p-extra="${esc(x.id)}" data-f="billing"><option value="side" ${x.billing==="side"?"selected":""}>je Seite</option><option value="fitting" ${x.billing==="fitting"?"selected":""}>1× je Versorgung</option></select></td>
  <td><input data-p-extra="${esc(x.id)}" data-f="note" value="${esc(x.note||"")}"></td></tr>`).join("")}</tbody></table></div>`;
}
/* ---------- Mehrwert je Technikstufe (für Leistungstreppe & Broschüre) ---------- */
const defPlus=id=>{const B=window.HD_BERATUNG;return B&&B.defaultPlus?B.defaultPlus(id):[]};
const curPlus=id=>Array.isArray(st.plus[id])&&st.plus[id].length?st.plus[id]:defPlus(id);
function nutzenTab(){
 return `<div class="hint">Diese Punkte erscheinen in der Beratung in der Leistungstreppe, in der Kundenansicht und in der Broschüre. Pro Stufe nur das eintragen, was <b>neu dazukommt</b> – die Treppe zeigt, dass höhere Stufen alles der vorherigen enthalten. Kurz halten: 2–4 Punkte, je Punkt wenige Wörter.</div>
 <div class="nutzen">${STAGES.map((s,i)=>{const own=Array.isArray(st.plus[s.id])&&st.plus[s.id].length,list=curPlus(s.id);
  return `<section class="ncard"><header><span class="pnum">${String(i+1).padStart(2,"0")}</span><div><b>${s.name}</b><small>${esc(s.sub)}</small></div>${own?`<button type="button" class="linkbtn" data-n-reset="${s.id}">Auf Standard zurück</button>`:'<span class="tag">Standardtexte</span>'}</header>
   <div class="nlist">${list.map((t,j)=>`<div class="nrow"><span aria-hidden="true">+</span><input data-n-stage="${s.id}" data-n-i="${j}" value="${esc(t)}" maxlength="60" aria-label="${esc(s.name)} Punkt ${j+1}"><button type="button" class="nx" data-n-del="${s.id}" data-n-i="${j}" aria-label="Punkt löschen">×</button></div>`).join("")}</div>
   ${list.length<5?`<button type="button" class="btn light" data-n-add="${s.id}">${svg("plus")}Punkt hinzufügen</button>`:""}</section>`}).join("")}</div>
 <p class="muted" style="margin-top:12px">Bei Basis wird für Kassenpatienten automatisch „Zuzahlungsfrei“ ergänzt.</p>`;
}
async function savePlus(id,list){
 st.plus={...st.plus,[id]:list};
 await up("settings",{key:"stage_plus",value:st.plus},"Mehrwert gespeichert");H().rerender();
}
function render(){
 if(!st.loaded&&!st.loading&&H().sb)setTimeout(load,0);
 if(!st.loaded)return `<div class="empty"><p>Preise werden geladen …</p></div>`;
 if(st.missing)return `<div class="bar"><h2>Preise</h2></div><div class="empty"><p><b>Die Preis-Tabellen sind noch nicht eingerichtet.</b><br>Bitte das Skript <code>sql/002_preise.sql</code> einmal im Supabase SQL-Editor ausführen, dann diese Seite neu laden.</p></div>`;
 const tab=(id,l)=>`<button data-p-sub="${id}" aria-pressed="${st.sub===id}">${l}</button>`;
 return `<div class="bar"><h2>Preise</h2><div class="tabs" role="group" aria-label="Bereich">${tab("geraete","Geräte")}${tab("stufen","Preiskategorien")}${tab("extras","Zusatzpositionen")}${tab("nutzen","Mehrwert je Stufe")}</div>
  ${st.sub==="nutzen"?"":`<button class="btn primary" data-p-new style="margin-left:auto">${svg("plus")}Gerät anlegen</button>`}</div>`+
  (st.sub==="nutzen"?nutzenTab():stageStrip()+(st.sub==="stufen"?bandsTab():st.sub==="extras"?extrasTab():devicesTab()));
}

/* ---------- Geräte-Dialog ---------- */
function ensureDialog(){
 if(document.getElementById("devDlg"))return;
 document.body.insertAdjacentHTML("beforeend",`<dialog id="devDlg"><form class="sheet" id="devForm" method="dialog">
  <h3 id="devTitle">Gerät anlegen</h3>
  <label>Hersteller<input id="d_man" list="makers" required autocomplete="off"></label>
  <label>Modell<input id="d_model" required autocomplete="off" placeholder="z. B. Audéo Sphere I90"></label>
  <label>Bauform<select id="d_form">${FORMS.map(f=>`<option>${f}</option>`).join("")}</select></label>
  <label>Energie<select id="d_power"><option>Akku</option><option>Batterie</option></select></label>
  <label>Einkaufspreis (EK) je Gerät in €<input id="d_ek" required inputmode="decimal" placeholder="z. B. 550"></label>
  <div class="ppreview full" id="d_prev"></div>
  <div class="full" style="display:grid;gap:8px"><span class="lbl">Zusatzpositionen</span>
   <label class="pcheck"><input type="checkbox" id="d_rec"> Ex-Hörer wird berechnet (je Seite)</label>
   <label class="pcheck"><input type="checkbox" id="d_oto"> Otoplastik ist in der Regel erforderlich</label>
   <label>Ladegerät<select id="d_charger"></select></label></div>
  <label class="full">Besonderheiten (für Beratung &amp; Broschüre)<textarea id="d_feat" placeholder="z. B. Bluetooth-Streaming, Tinnitus-Funktion, wasserfest"></textarea></label>
  <label class="full">Interne Notiz<input id="d_notes"></label>
  <label class="pcheck full"><input type="checkbox" id="d_active" checked> Aktiv (wird in Beratung und Preisrechner angeboten)</label>
  <div class="actions"><button type="button" class="btn danger" id="d_del">Löschen</button><button type="button" class="btn" id="d_cancel">Abbrechen</button><button type="submit" class="btn primary">Speichern</button></div>
 </form></dialog>`);
 const $=id=>document.getElementById(id);
 const prev=()=>{const ek=num($("d_ek").value),b=ek!=null?bandFor(ek):null;
  $("d_prev").innerHTML=ek==null?'<span>Nach Eingabe des EK siehst du hier Stufe und Preise.</span>':b?`<span>Erkannt: <b>${esc(stageName(b.stage))}</b> · Kategorie ${esc(b.name)}</span><span>Privat <b>${eur(Number(b.vk_private))}</b> / Seite · Kasse Eigenanteil <b>${eur(share(Number(b.vk_private)))}</b> / Seite</span>`:'<span style="color:var(--hot)">Für diesen EK gibt es keine Preiskategorie.</span>'};
 $("d_ek").addEventListener("input",prev);
 $("d_form").addEventListener("change",()=>{if(!st.editing)$("d_rec").checked=$("d_form").value.startsWith("RIC")});
 $("d_man").addEventListener("change",()=>{if(st.editing)return;const m=$("d_man").value.toLowerCase(),c=st.extras.find(x=>x.kind==="charger"&&x.name.toLowerCase().includes(m)&&m);if(c&&$("d_power").value==="Akku")$("d_charger").value=c.id});
 $("d_cancel").onclick=()=>$("devDlg").close();
 $("d_del").onclick=async()=>{const b=$("d_del");if(!b.dataset.sure){b.dataset.sure=1;b.textContent="Wirklich löschen?";return}
  const d=st.editing;$("devDlg").close();const{error}=await H().sb.from("devices").delete().eq("id",d.id);if(error)H().toast("Löschen fehlgeschlagen");else{st.devices=st.devices.filter(x=>x.id!==d.id);H().rerender();H().toast("Gerät gelöscht")}};
 $("devForm").addEventListener("submit",async e=>{e.preventDefault();const ek=num($("d_ek").value);if(ek==null){$("d_ek").focus();return}
  const row={...(st.editing?{id:st.editing.id}:{}),manufacturer:$("d_man").value.trim(),model:$("d_model").value.trim(),form:$("d_form").value,power:$("d_power").value,ek,
   receiver:$("d_rec").checked,otoplastic:$("d_oto").checked,charger_id:$("d_charger").value||null,features:$("d_feat").value.trim()||null,notes:$("d_notes").value.trim()||null,active:$("d_active").checked,updated_at:new Date().toISOString()};
  if(!row.id)row.id=crypto.randomUUID?crypto.randomUUID():String(Date.now());
  $("devDlg").close();const i=st.devices.findIndex(x=>x.id===row.id);i<0?st.devices.push(row):st.devices[i]={...st.devices[i],...row};H().rerender();
  await up("devices",row,st.editing?"Gerät gespeichert":"Gerät angelegt");});
 st.prev=prev;
}
function openDevice(d){
 ensureDialog();st.editing=d||null;const $=id=>document.getElementById(id);
 $("devTitle").textContent=d?"Gerät bearbeiten":"Gerät anlegen";
 $("d_charger").innerHTML='<option value="">kein Ladegerät</option>'+st.extras.filter(x=>x.kind==="charger").map(x=>`<option value="${esc(x.id)}">${esc(x.name)} (${eur(Number(x.price_private))})</option>`).join("");
 $("d_man").value=d?.manufacturer||"";$("d_model").value=d?.model||"";$("d_form").value=d?.form||FORMS[0];$("d_power").value=d?.power||"Akku";
 $("d_ek").value=d?String(d.ek).replace(".",","):"";$("d_rec").checked=d?!!d.receiver:true;$("d_oto").checked=!!d?.otoplastic;$("d_charger").value=d?.charger_id||"";
 $("d_feat").value=d?.features||"";$("d_notes").value=d?.notes||"";$("d_active").checked=d?d.active!==false:true;
 $("d_del").style.display=d?"":"none";$("d_del").textContent="Löschen";delete $("d_del").dataset.sure;
 st.prev();$("devDlg").showModal();if(!d)$("d_man").focus();
}

/* ---------- Ereignisse ---------- */
document.addEventListener("click",e=>{
 if(!H()||H().page()!=="preise")return;const el=e.target;if(el.closest("dialog"))return;
 const s=el.closest("[data-p-sub]");if(s){st.sub=s.dataset.pSub;H().rerender();return}
 const g=el.closest("[data-p-stage]");if(g){st.stage=st.stage===g.dataset.pStage?"":g.dataset.pStage;st.sub="geraete";H().rerender();return}
 if(el.closest("[data-p-new]")){openDevice();return}
 const na=el.closest("[data-n-add]");if(na){const id=na.dataset.nAdd;st.plus={...st.plus,[id]:[...curPlus(id),""]};H().rerender();setTimeout(()=>{const ins=document.querySelectorAll(`[data-n-stage="${id}"]`);ins[ins.length-1]?.focus()},30);return}
 const nd=el.closest("[data-n-del]");if(nd){const id=nd.dataset.nDel,l=[...curPlus(id)];l.splice(Number(nd.dataset.nI),1);savePlus(id,l.filter(Boolean).length?l.filter(Boolean):[]);return}
 const nr=el.closest("[data-n-reset]");if(nr){H().ask("Standard wiederherstellen?",`Die eigenen Punkte für ${STAGES.find(s=>s.id===nr.dataset.nReset).name} werden durch die Standardtexte ersetzt.`,()=>savePlus(nr.dataset.nReset,[]));return}
 const c=el.closest("[data-p-calc]");if(c){const k=c.dataset.pCalc;st.calc[k]=k==="ins"?c.dataset.v:Number(c.dataset.v);H().rerender();return}
 const d=el.closest("[data-p-dev]");if(d){const dev=st.devices.find(x=>x.id===d.dataset.pDev);if(dev){st.calc.device=dev.id;openDevice(dev)}}
});
document.addEventListener("input",e=>{if(e.target.id==="p_q"){st.q=e.target.value;H().rerender()}});
document.addEventListener("change",async e=>{
 const t=e.target;if(!H()||H().page()!=="preise")return;
 if(t.id==="p_calcdev"){st.calc.device=t.value;H().rerender();return}
 if(t.dataset.nStage){const id=t.dataset.nStage,l=[...curPlus(id)];l[Number(t.dataset.nI)]=t.value.trim();await savePlus(id,l.filter(Boolean));return}
 if(t.dataset.pGkv!==undefined){const v=num(t.value);if(v==null)return H().toast("Bitte eine Zahl eingeben");st.gkv=v;await up("settings",{key:"gkv_share_per_side",value:v},"Kassenanteil gespeichert");H().rerender();return}
 const isB=t.dataset.pBand,isX=t.dataset.pExtra;if(!isB&&!isX)return;
 const f=t.dataset.f,list=isB?st.bands:st.extras,row=list.find(x=>x.id===(isB||isX));if(!row)return;
 let v=t.value;if(["ek_from","ek_to","vk_private","price_private","price_gkv"].includes(f)){v=f==="ek_to"&&v.trim()===""?null:num(v);if(v==null&&f!=="ek_to")return H().toast("Bitte eine Zahl eingeben")}
 row[f]=v;await up(isB?"price_bands":"extras",{...row},"Gespeichert");H().rerender();
});

window.HD_PREISE={render,load,quote,bandFor,stageFrom,STAGES,state:st,stagePlus:id=>Array.isArray(st.plus[id])&&st.plus[id].length?st.plus[id]:null,count:()=>st.devices.filter(d=>d.active).length};
})();
