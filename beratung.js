/* Hörakustik Daugsch · Portal – Modul Beratung
   Geführte Beratung mit Live-Empfehlung; Geräte & Preise aus dem Preistool; Aufgaben & Laboraufträge in die Datenbank;
   Kundenansicht als eigenes Fenster (gleicher Rechner, BroadcastChannel). */
(() => {
const KUNDE=location.hash==="#kunde";
const H=()=>window.HD;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const eur=n=>(Math.round(n)).toLocaleString("de-DE")+" €";
const uid=()=>crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(36).slice(2);
const toast=m=>H()&&H().toast(m);
/* ---------- Logik ---------- */
const STAGES=[
 {id:"basis",name:"Basis",sub:"Gut hören im ruhigen Alltag",p:[3,1,1],auto:"einfach",ideal:"Zuhause, Gespräche zu zweit"},
 {id:"komfort",name:"Komfort",sub:"Einfach hören. Bequem aufladen.",p:[3,1,1],auto:"einfach",ideal:"wie Basis, ohne Batteriewechsel"},
 {id:"balance",name:"Balance",sub:"Mehr Sicherheit im Höralltag",p:[4,2,2],auto:"erkennt Situationen",ideal:"Familie, Einkaufen, aktiver Alltag"},
 {id:"praezision",name:"Präzision",sub:"Gesprächen leichter folgen",p:[4,3,3],auto:"passt sich laufend an",ideal:"regelmäßig Gruppen und Restaurant"},
 {id:"exzellenz",name:"Exzellenz",sub:"Souverän hören, auch wenn es lebhaft wird",p:[5,4,4],auto:"erkennt Sprecher und Bewegung",ideal:"Beruf, Vereine, wechselnde Situationen"},
 {id:"perfektion",name:"Perfektion",sub:"Höchste Technik für höchste Ansprüche",p:[5,5,5],auto:"volle Individualisierung",ideal:"höchste Ansprüche, Musik, schwierigste Situationen"}];
const DIMS=["Ruhe","Gruppe","Lärm"];
const stageIdx=id=>STAGES.findIndex(s=>s.id===id);

const SITS=[
 {id:"ruhe2",t:"Gespräch zu zweit in Ruhe",dim:0},{id:"tv",t:"Fernsehen",dim:0,media:1},{id:"tel",t:"Telefon / Handy",dim:0,media:1},
 {id:"klingel",t:"Türklingel, Wecker, Signale",dim:0},{id:"natur",t:"Natur, Vogelstimmen",dim:0},
 {id:"gruppe",t:"Gespräche in Familie oder Gruppe",dim:1},{id:"enkel",t:"Kinder- und Enkelstimmen",dim:1},{id:"vortrag",t:"Vortrag, Kirche, Theater",dim:1},
 {id:"beruf",t:"Beruf, Besprechungen",dim:1},{id:"video",t:"Videokonferenz",dim:1,media:1},
 {id:"restaurant",t:"Restaurant, Feier",dim:2},{id:"auto",t:"Im Auto",dim:2},{id:"draussen",t:"Draußen, Wind, Straße",dim:2},
 {id:"einkauf",t:"Einkaufen, Stadt",dim:2},{id:"musik",t:"Musik, Konzert",dim:2},{id:"sport",t:"Sport, Verein",dim:2}];
const DIFF=["keine","leicht","deutlich","sehr"],IMP=["selten","regelmäßig","täglich"];
const FREQ=[250,500,1000,2000,3000,4000,6000,8000];

/* ---------- Anbindung ans Preistool ---------- */
let SNAP_PRICES=null;
const P=()=>window.HD_PREISE;
let DEVICES=[];
const refreshDevices=()=>{DEVICES=P()?(P().state.devices||[]).filter(d=>d.active!==false).map(d=>({id:d.id,m:d.manufacturer,model:d.model,form:d.form||"",power:d.power||"",ek:Number(d.ek),oto:!!d.otoplastic,raw:d})).sort((a,b)=>a.ek-b.ek):[]};
const band=ek=>{const b=P()&&P().bandFor(ek);return b?[b.name,b.stage,0,0,Number(b.vk_private)]:["–","",0,0,0]};
function quote(dev,count,otos){const q=P()&&P().quote(dev.raw,S.kunde.kasse==="gkv"?"gkv":"privat",count,otos);return q?{lines:q.lines.map(l=>[l.label,l.amount]),total:q.total}:null}
const stageFrom=id=>{if(SNAP_PRICES)return SNAP_PRICES[id]||{vk:0,gkv:0};return(P()&&P().stageFrom(id))||{vk:0,gkv:0}};

const empty=()=>({kunde:{vorname:"",nachname:"",geb:"",tel:"",mail:"",kasse:"gkv",kk:"",verordnung:"",vdatum:"",hno:"",versorgung:"erst"},
 an:{seit:"",verlauf:"",seite:"",bemerkt:"",hoersturz:"",hsWann:"",hsSeite:"",laerm:"",laermArt:[],entz:[],ops:[],tinn:"",tinnSeite:"",tinnBel:0,tinnArt:"",
  schwindel:"",druck:"",hyper:"",schmerz:"",ausfluss:"",puls:"",schmalz:"",allergie:"",allergieText:"",familie:"",meds:"",allg:[],handling:[],hgAlt:"",hgModell:"",hgTrage:"",hgZufr:"",hgStoer:""},
 audio:{R:{},L:{}},sit:{},leben:[],technik:"",phone:"",frei:"",wuensche:[],bauform:"",energie:"",budget:"",ziele:[{t:"",p:1}],override:"",device:"",otos:-1,tasks:[],
 oto:{needed:"",sides:"",same:true,R:{anbindung:"",form:"",material:"",haerte:"",farbe:"",vent:"",kanal:"",extras:[],hoerer:""},L:{anbindung:"",form:"",material:"",haerte:"",farbe:"",vent:"",kanal:"",extras:[],hoerer:""},abformung:{datum:new Date().toISOString().slice(0,10),masse:"Silikon (A-vernetzend)",qualitaet:"Gut",besonderheiten:""},due:"",notes:"",sent:false},status:"offen"});

/* ---------- Zustand ---------- */
let S=empty(),cid=null,mode="list",step=0,customer=false,custTab=0,list=[],listLoaded=false,listLoading=false,q="",saveT=null,saving=false,dirty=false,custWin=null;
const bc=("BroadcastChannel" in window)?new BroadcastChannel("hd-kunde"):null;

const STEPS=[["Kunde","Stammdaten"],["Anamnese","medizinisch"],["Audiogramm","Hörschwelle"],["Bedarf","Alltagssituationen"],["Wünsche","Ausstattung"],["Hörziele","für die Anpassung"],["Empfehlung","Technik & Preis"],["Otoplastik","Abformung & Labor"],["Abschluss","Aufgaben & Broschüre"]];
/* ---------- Pfad-Helfer ---------- */
const get=p=>p.split(".").reduce((o,k)=>o==null?o:o[k],S);
const set=(p,v)=>{const ks=p.split(".");let o=S;ks.slice(0,-1).forEach(k=>{if(o[k]==null)o[k]={};o=o[k]});o[ks.at(-1)]=v};

/* ---------- Bausteine ---------- */
const chips=(p,opts,multi=false)=>`<div class="chips">${opts.map(o=>{const on=multi?(get(p)||[]).includes(o):get(p)===o;return `<button type="button" class="chip" ${multi?"data-tog":"data-set"}="${p}" data-v="${esc(o)}" aria-pressed="${on}">${esc(o)}</button>`}).join("")}</div>`;
const yn=(p,label,extra="")=>`<div class="q"><span class="ql">${label}</span>${chips(p,["ja","nein"])}</div>${get(p)==="ja"&&extra?`<div class="sub">${extra}</div>`:""}`;
const inp=(p,label,type="text",ph="",cls="")=>`<label class="${cls}">${label}<input type="${type}" data-in="${p}" value="${esc(get(p))}" placeholder="${esc(ph)}"></label>`;
const ta=(p,label,ph="")=>`<label class="full">${label}<textarea data-in="${p}" placeholder="${esc(ph)}">${esc(get(p))}</textarea></label>`;
const card=(title,body,cls="")=>`<section class="card ${cls}">${title?`<h3>${title}</h3>`:""}${body}</section>`;

/* ---------- Auswertung ---------- */
function pta(ear){const a=S.audio[ear];const v=[500,1000,2000,4000].map(f=>Number(a[f])).filter(x=>!isNaN(x)&&a!=null);return v.length===4?v.reduce((s,x)=>s+x,0)/4:null}
const degree=v=>v==null?null:v<=25?"normal":v<=40?"leicht":v<=60?"mittelgradig":v<=80?"hochgradig":"an Taubheit grenzend";
function needs(){
 const n=[1,1,1],why=[[],[],[]];
 SITS.forEach(s=>{const r=S.sit[s.id];if(!r||r.d==null)return;const i=r.i??1;let lvl=1+r.d;if(i===0)lvl=Math.max(1,lvl-1);if(i===2&&r.d===3)lvl=5;
  if(lvl>n[s.dim]){n[s.dim]=lvl}if(lvl>=3)why[s.dim].push(`${s.t}: ${DIFF[r.d]} schwierig, ${IMP[r.i??0]}`)});
 return{n,why};
}
function recommend(){
 const{n,why}=needs();let idx=STAGES.findIndex(s=>s.p[0]>=n[0]&&s.p[1]>=n[1]&&s.p[2]>=n[2]);if(idx<0)idx=5;
 const reasons=[];DIMS.forEach((d,i)=>{if(why[i].length)reasons.push(`<b>${d} ${"●".repeat(n[i])}${"○".repeat(5-n[i])}</b> – ${esc(why[i].slice(0,2).join("; "))}`)});
 if((S.wuensche.includes("Akku")||S.energie==="Akku")&&idx<1){idx=1;reasons.push("<b>Akku gewünscht</b> – ab Komfort ohne Batteriewechsel")}
 const media=SITS.filter(s=>s.media&&S.sit[s.id]&&S.sit[s.id].d>=2).map(s=>s.t);
 const notes=[];if(media.length||S.wuensche.some(w=>w.includes("Streaming")))notes.push("Streaming einplanen (TV-Adapter bzw. Handy): "+(media.join(", ")||"gewünscht"));
 if(S.an.tinn==="ja")notes.push("Tinnitus vorhanden – Gerät mit Tinnitus-Funktion bevorzugen");
 const dR=degree(pta("R")),dL=degree(pta("L"));if([dR,dL].some(d=>d==="hochgradig"||d==="an Taubheit grenzend"))notes.push("Hochgradiger Hörverlust – leistungsstarker Hörer bzw. Otoplastik prüfen");
 if(S.an.handling.length)notes.push("Handhabung beachten ("+S.an.handling.join(", ")+") – große Bedienelemente, Akku");
 if(S.budget==="möglichst zuzahlungsfrei"&&idx>0)notes.push("Budget „möglichst zuzahlungsfrei“ – Basis als Vergleichsgerät mit anbieten");
 return{idx,n,reasons,notes};
}
const flags=()=>{const a=S.an,f=[];
 if(a.verlauf==="plötzlich")f.push("Plötzlicher Hörverlust");if(a.seite==="einseitig rechts"||a.seite==="einseitig links")f.push("Einseitiger Hörverlust");
 if(a.schwindel==="ja")f.push("Schwindel");if(a.ausfluss==="ja")f.push("Ausfluss aus dem Ohr");if(a.schmerz==="ja")f.push("Ohrenschmerzen");if(a.puls==="ja")f.push("Pulsierendes Ohrgeräusch");
 if(a.hoersturz==="ja"&&a.hsWann==="in den letzten 3 Monaten")f.push("Hörsturz vor kurzem");
 const r=pta("R"),l=pta("L");if(r!=null&&l!=null&&Math.abs(r-l)>=20)f.push("Deutlicher Seitenunterschied im Audiogramm");return f};
function ears(){const r=pta("R"),l=pta("L");const c=[r,l].filter(v=>v!=null&&v>25).length;return c||2}
const curStage=()=>S.override!==""?Number(S.override):recommend().idx;
const name=()=>[S.kunde.vorname,S.kunde.nachname].filter(Boolean).join(" ")||"Neuer Kunde";
const dots=(n,on="var(--forest)")=>`<span class="dots">${[1,2,3,4,5].map(i=>`<i style="background:${i<=n?on:"#DCE6E2"}"></i>`).join("")}</span>`;

/* ---------- Audiogramm-Grafik ---------- */
function audioSvg(big=false){
 const W=560,H=big?380:320,l=44,r=16,t=20,b=30,x=i=>l+i*(W-l-r)/(FREQ.length-1),y=db=>t+(db+10)/130*(H-t-b);
 const zones=[[-10,25,"#EEF6F2","normal"],[25,40,"#F3F6EC","leicht"],[40,60,"#FBF4E6","mittel"],[60,80,"#FBEDE6","hochgradig"],[80,120,"#F8E6E6","an Taubheit grenzend"]];
 let s=`<svg viewBox="0 0 ${W} ${H}" class="audsvg" role="img" aria-label="Tonaudiogramm">`;
 zones.forEach(([a,c,col,lb])=>{s+=`<rect x="${l}" y="${y(a)}" width="${W-l-r}" height="${y(c)-y(a)}" fill="${col}"/><text x="${W-r-6}" y="${y(a)+14}" text-anchor="end" font-size="11" fill="#7A918A">${lb}</text>`});
 // Sprachbereich
 s+=`<path d="M${x(1)} ${y(22)} Q${x(3)} ${y(18)} ${x(5)} ${y(28)} L${x(5)} ${y(55)} Q${x(3)} ${y(62)} ${x(1)} ${y(50)}Z" fill="#276955" opacity=".10"/><text x="${x(3)}" y="${y(48)}" font-size="12" fill="#276955" opacity=".8" text-anchor="middle">Sprachbereich</text>`;
 for(let d=0;d<=120;d+=20)s+=`<line x1="${l}" x2="${W-r}" y1="${y(d)}" y2="${y(d)}" stroke="#DCE6E2"/><text x="${l-8}" y="${y(d)+4}" text-anchor="end" font-size="11" fill="#587168">${d}</text>`;
 FREQ.forEach((f,i)=>s+=`<line x1="${x(i)}" x2="${x(i)}" y1="${t}" y2="${H-b}" stroke="#E7EEEB"/><text x="${x(i)}" y="${H-10}" text-anchor="middle" font-size="11" fill="#587168">${f>=1000?f/1000+"k":f}</text>`);
 [["R","#C0392B"],["L","#2F5D8A"]].forEach(([e,c])=>{const pts=FREQ.map((f,i)=>[i,S.audio[e][f]]).filter(p=>p[1]!=null&&p[1]!==""&&!isNaN(Number(p[1]))).map(p=>[p[0],Number(p[1])]);
  if(pts.length>1)s+=`<polyline points="${pts.map(p=>x(p[0])+","+y(p[1])).join(" ")}" fill="none" stroke="${c}" stroke-width="2.5"/>`;
  pts.forEach(p=>{s+=e==="R"?`<circle cx="${x(p[0])}" cy="${y(p[1])}" r="6" fill="#fff" stroke="${c}" stroke-width="2.5"/>`:`<path d="M${x(p[0])-5} ${y(p[1])-5}l10 10M${x(p[0])+5} ${y(p[1])-5}l-10 10" stroke="${c}" stroke-width="2.5"/>`})});
 return s+`<text x="${l}" y="12" font-size="11" fill="#587168">dB HL</text></svg>`;
}

/* ---------- Schritte ---------- */
function stepKunde(){
 const k="kunde";
 return card("Kunde",`<div class="form">${inp(k+".vorname","Vorname")}${inp(k+".nachname","Nachname")}${inp(k+".geb","Geburtsdatum","date")}${inp(k+".tel","Telefon","tel")}${inp(k+".mail","E-Mail","email","","full")}</div>`)+
 card("Krankenversicherung",`<div class="q"><span class="ql">Versicherung</span><div class="chips"><button type="button" class="chip" data-set="kunde.kasse" data-v="gkv" aria-pressed="${S.kunde.kasse==="gkv"}">Gesetzlich</button><button type="button" class="chip" data-set="kunde.kasse" data-v="privat" aria-pressed="${S.kunde.kasse==="privat"}">Privat</button></div></div>
  <div class="form">${inp(k+".kk","Krankenkasse","text","z. B. AOK, TK, Barmer","full")}</div>
  ${yn(k+".verordnung","Ärztliche Verordnung liegt vor",`<div class="form">${inp(k+".vdatum","Datum der Verordnung","date")}${inp(k+".hno","HNO-Arzt")}</div>`)}`)+
 card("Versorgung",`<div class="q"><span class="ql">Art</span>${chips("kunde.versorgung",["erst","Folgeversorgung"]).replace(">erst<",">Erstversorgung<")}</div>
  <p class="muted">Später: Kunde direkt aus AkuWin übernehmen – Stammdaten und Audiogramm werden automatisch geladen.</p>`);
}
function stepAnamnese(){
 const a="an";
 const f=flags();
 return (f.length?`<div class="flag"><b>Ärztliche Abklärung empfehlen</b><span>${f.map(esc).join(" · ")}</span><small>Nur für dich sichtbar – erscheint nicht in der Kundenansicht oder Broschüre.</small></div>`:"")+
 card("Hörverlust",`<div class="q"><span class="ql">Seit wann?</span>${chips(a+".seit",["weniger als 3 Monate","unter 1 Jahr","1–3 Jahre","3–5 Jahre","5–10 Jahre","über 10 Jahre"])}</div>
  <div class="q"><span class="ql">Verlauf</span>${chips(a+".verlauf",["schleichend","plötzlich","schwankend"])}</div>
  <div class="q"><span class="ql">Seite</span>${chips(a+".seite",["beidseitig","einseitig rechts","einseitig links"])}</div>
  <div class="q"><span class="ql">Wer hat es bemerkt?</span>${chips(a+".bemerkt",["selbst","Angehörige","Arzt / Hörtest"])}</div>`)+
 card("Ereignisse am Ohr",yn(a+".hoersturz","Hörsturz",`<div class="q"><span class="ql">Wann?</span>${chips(a+".hsWann",["in den letzten 3 Monaten","vor 3–12 Monaten","länger her"])}</div><div class="q"><span class="ql">Seite</span>${chips(a+".hsSeite",["rechts","links","beidseitig"])}</div>`)+
  yn(a+".laerm","Lärm- oder Knalltrauma, Lärmbelastung",`<div class="q"><span class="ql">Art</span>${chips(a+".laermArt",["Knalltrauma","beruflich","Jagd / Schießsport","Musik / Konzerte","Maschinen / Werkzeug"],true)}</div>`)+
  `<div class="q"><span class="ql">Entzündungen & Befunde</span>${chips(a+".entz",["Mittelohrentzündung akut","Mittelohrentzündung chronisch","Gehörgangsentzündung","Trommelfellperforation","Cholesteatom","Otosklerose"],true)}</div>
  <div class="q"><span class="ql">Operationen am Ohr</span>${chips(a+".ops",["Paukenröhrchen","Tympanoplastik","Stapesplastik","Mastoidektomie","Cochlea-Implantat","BAHA"],true)}</div>`)+
 card("Begleitsymptome",yn(a+".tinn","Tinnitus / Ohrgeräusch",`<div class="q"><span class="ql">Seite</span>${chips(a+".tinnSeite",["rechts","links","beidseitig","im Kopf"])}</div><div class="q"><span class="ql">Klang</span>${chips(a+".tinnArt",["Pfeifen","Rauschen","Brummen","Pulsieren"])}</div>
   <label class="range">Belastung: <b>${S.an.tinnBel}</b> von 10<input type="range" min="0" max="10" data-in="an.tinnBel" data-num value="${S.an.tinnBel}"></label>`)+
  yn(a+".schwindel","Schwindel / Gleichgewichtsstörungen")+yn(a+".druck","Druckgefühl im Ohr")+yn(a+".hyper","Geräuschempfindlichkeit")+yn(a+".schmerz","Ohrenschmerzen")+yn(a+".ausfluss","Ausfluss aus dem Ohr")+yn(a+".puls","Pulsierendes Ohrgeräusch"))+
 card("Gehörgang, Haut & Allgemeines",yn(a+".schmalz","Neigung zu Ohrenschmalz")+yn(a+".allergie","Allergien (z. B. Acrylat, Silikon)",`<div class="form">${inp(a+".allergieText","Welche?","text","","full")}</div>`)+yn(a+".familie","Schwerhörigkeit in der Familie")+
  `<div class="q"><span class="ql">Allgemeinerkrankungen</span>${chips(a+".allg",["Diabetes","Bluthochdruck","Herz-Kreislauf","Nierenerkrankung","Rheuma"],true)}</div>
  <div class="form">${inp(a+".meds","Medikamente mit Einfluss aufs Gehör / Blutverdünner","text","z. B. bestimmte Antibiotika, hochdosiert ASS, Entwässerung","full")}</div>
  <div class="q"><span class="ql">Für die Handhabung wichtig</span>${chips(a+".handling",["Sehbeeinträchtigung","eingeschränkte Feinmotorik","Merkfähigkeit"],true)}</div>`)+
 card("Bisherige Hörgeräte",yn(a+".hgAlt","Bereits Hörgeräte getragen",`<div class="form">${inp(a+".hgModell","Modell / seit wann")}${inp(a+".hgTrage","Tragedauer pro Tag")}</div><div class="q"><span class="ql">Zufriedenheit</span>${chips(a+".hgZufr",["sehr zufrieden","zufrieden","unzufrieden"])}</div><div class="form">${inp(a+".hgStoer","Was hat gestört?","text","","full")}</div>`));
}
function stepAudio(){
 const row=e=>`<tr><th><span class="ear ${e}">${e==="R"?"Rechts ○":"Links ×"}</span></th>${FREQ.map(f=>`<td><input inputmode="numeric" data-aud="${e}.${f}" value="${esc(S.audio[e][f]??"")}" aria-label="${e==="R"?"Rechts":"Links"} ${f} Hz"></td>`).join("")}</tr>`;
 const dR=degree(pta("R")),dL=degree(pta("L"));
 return card("Tonaudiogramm (Luftleitung)",`<div class="audtop"><button class="btn" disabled>Aus AkuWin laden <span class="soon">bald</span></button><span class="muted">Werte in dB HL eintragen – die Grafik zeichnet sich live.</span></div>
  <div class="scroll"><table class="audt"><thead><tr><th></th>${FREQ.map(f=>`<th>${f>=1000?f/1000+" kHz":f+" Hz"}</th>`).join("")}</tr></thead><tbody>${row("R")}${row("L")}</tbody></table></div>
  <div id="audchart">${audioSvg()}</div>
  <div class="degrees"><div><span class="ear R">Rechts</span><b>${dR?esc(dR):"–"}</b><small>${pta("R")!=null?"Mittelwert "+Math.round(pta("R"))+" dB":""}</small></div><div><span class="ear L">Links</span><b>${dL?esc(dL):"–"}</b><small>${pta("L")!=null?"Mittelwert "+Math.round(pta("L"))+" dB":""}</small></div></div>`);
}
function stepBedarf(){
 const group=(i,title)=>`<div class="sitgroup"><h4>${title}</h4>${SITS.filter(s=>s.dim===i).map(s=>{const r=S.sit[s.id]||{};return `<div class="sit"><span>${esc(s.t)}</span>
   <div class="seg4">${DIFF.map((d,j)=>`<button type="button" data-sit="${s.id}" data-k="d" data-v="${j}" aria-pressed="${r.d===j}" class="d${j}">${d}</button>`).join("")}</div>
   <div class="seg3">${IMP.map((d,j)=>`<button type="button" data-sit="${s.id}" data-k="i" data-v="${j}" aria-pressed="${r.i===j}" ${r.d==null||r.d===0?"disabled":""}>${d}</button>`).join("")}</div></div>`}).join("")}</div>`;
 return card("Wo fällt das Hören schwer?",`<p class="muted">Links: Wie schwierig ist die Situation? Rechts: Wie oft kommt sie vor? Je schwieriger und häufiger, desto mehr Leistung braucht das Hörsystem in diesem Bereich (keine ● · leicht ●● · deutlich ●●● · sehr ●●●● · sehr + täglich ●●●●●, selten eine Stufe weniger).</p>${group(0,"Ruhige Situationen & Medien")}${group(1,"Gespräche mit mehreren")}${group(2,"Lebhafte Umgebung")}`)+
 card("Lebenssituation",`<div class="q"><span class="ql">Alltag</span>${chips("leben",["berufstätig","Rentner/in","Vereinsleben","Enkel","viel unterwegs","Sport","Musik / Chor","lebt allein"],true)}</div>
  <div class="q"><span class="ql">Smartphone</span>${chips("phone",["iPhone","Android","keins"])}</div>
  <div class="q"><span class="ql">Technik-Erfahrung</span>${chips("technik",["gering","mittel","hoch"])}</div>`)+
 card("Individuelle Informationen",`<div class="form">${ta("frei","Freitext","Alles, was im Gespräch wichtig war …")}</div>`);
}
function stepWuensche(){
 return card("Wünsche an die Hörgeräte",`<div class="q"><span class="ql">Ausstattung</span>${chips("wuensche",["Akku","Streaming vom Handy","TV-Streaming","App-Steuerung","Tinnitus-Funktion","Wasserschutz","Unauffällig","Freisprechen beim Telefonieren"],true)}</div>
  <div class="q"><span class="ql">Bauform</span>${chips("bauform",["hinter dem Ohr, unauffällig","hinter dem Ohr, kräftig","im Ohr","möglichst unsichtbar","noch offen"])}</div>
  <div class="q"><span class="ql">Energie</span>${chips("energie",["Akku","Batterie","egal"])}</div>
  <div class="q"><span class="ql">Budgetvorstellung</span>${chips("budget",["möglichst zuzahlungsfrei","mittel","Qualität vor Preis","noch offen"])}</div>`);
}
function stepZiele(){
 const hard=SITS.filter(s=>S.sit[s.id]&&S.sit[s.id].d>=2).map(s=>s.t);
 return card("Hörziele",`<p class="muted">3–5 konkrete Ziele, die bei der Anpassung gezielt geprüft werden. Nach der Anpassung wird die Verbesserung je Ziel festgehalten.</p>
  <div class="goals">${S.ziele.map((z,i)=>`<div class="goal"><span class="gnum">${i+1}</span><input data-in="ziele.${i}.t" value="${esc(z.t)}" placeholder="z. B. Die Enkel am Esstisch verstehen"><select data-in="ziele.${i}.p" data-num>${[1,2,3,4,5].map(p=>`<option value="${p}" ${z.p==p?"selected":""}>Priorität ${p}</option>`).join("")}</select><button type="button" class="x" data-delgoal="${i}" aria-label="Ziel entfernen">×</button></div>`).join("")}</div>
  ${S.ziele.length<5?`<button type="button" class="btn" data-addgoal>+ Ziel hinzufügen</button>`:""}
  ${hard.length?`<div class="sugg"><span class="ql">Vorschläge aus der Bedarfsanalyse</span><div class="chips">${hard.map(h=>`<button type="button" class="chip" data-sugg="${esc(h)}">+ ${esc(h)}</button>`).join("")}</div></div>`:""}`);
}
function stepEmpfehlung(){
 const rec=recommend(),si=curStage(),st=STAGES[si],count=ears();
 const formWish=S.bauform==="im Ohr"||S.bauform==="möglichst unsichtbar";
 let devs=DEVICES.filter(d=>band(d.ek)[1]===st.id);const isIdo=d=>/^(IdO|CIC)/.test(d.form);if(formWish&&devs.some(isIdo))devs=devs.filter(isIdo);
 if(!devs.find(d=>d.id===S.device))S.device=devs[0]?.id||"";
 const dev=DEVICES.find(d=>d.id===S.device),otos=S.otos<0?(dev&&dev.oto?count:0):S.otos,q=dev?quote(dev,count,otos):null;
 return `<div class="recohead card"><div><span class="muted">Empfohlene Technikstufe</span><h2>${stageIdx(st.id)+1} · ${st.name}</h2><p>${esc(st.sub)} – ideal für ${esc(st.ideal)}.</p>
   ${S.override!==""?`<span class="tag work">von dir angepasst · Vorschlag war ${STAGES[rec.idx].name}</span>`:""}</div>
   <div class="profile">${DIMS.map((d,i)=>`<div><span>${d}</span><small>Bedarf</small>${dots(rec.n[i],"#B8452F")}<small>${st.name}</small>${dots(st.p[i])}</div>`).join("")}</div></div>
 <div class="grid2"><div>
  ${card("Warum diese Stufe?",`<ul class="why">${rec.reasons.length?rec.reasons.map(r=>`<li>${r}</li>`).join(""):"<li>Keine besonderen Schwierigkeiten angegeben – Basis reicht aus.</li>"}</ul>${rec.notes.length?`<div class="notes">${rec.notes.map(n=>`<span>• ${esc(n)}</span>`).join("")}</div>`:""}`)}
  ${card("Stufe anpassen",`<div class="stagepick">${STAGES.map((s,i)=>{const f=stageFrom(s.id);return `<button type="button" data-stage="${i}" aria-pressed="${i===si}" class="${i===rec.idx?"rec":""}"><b>${s.name}</b><small>${s.id==="basis"?"Kasse":"ab "+eur(S.kunde.kasse==="gkv"?f.gkv:f.vk)}</small></button>`}).join("")}</div>${S.override!==""?`<button type="button" class="linkbtn" data-stage="reset">Zurück zum Vorschlag</button>`:""}`)}
  ${card("Passende Geräte",devs.length?`<div class="devs">${devs.map(d=>`<button type="button" class="dev" data-dev="${d.id}" aria-pressed="${d.id===S.device}"><b>${esc(d.m)} ${esc(d.model)}</b><small>${esc(d.form)} · ${esc(d.power)} · ${band(d.ek)[0]}</small></button>`).join("")}</div><p class="muted">Geräte aus deinem Preistool.</p>`:'<p class="muted">Für diese Stufe ist noch kein Gerät im Preistool angelegt. <button type="button" class="linkbtn" data-goto="preise">Zum Preistool</button></p>')}
 </div>
 <aside class="aside">${q?`<h3>Preisorientierung</h3><span class="note">${S.kunde.kasse==="gkv"?"Gesetzlich versichert":"Privat versichert"} · ${count===2?"beidseitig":"eine Seite"}</span>
  <div class="pseg"><button data-otos="0" aria-pressed="${otos===0}">ohne Otoplastik</button><button data-otos="${count}" aria-pressed="${otos===count}">${count} Otoplastik${count>1?"en":""}</button></div>
  <div class="plines">${q.lines.map(l=>`<div><span>${esc(l[0])}</span><b>${eur(l[1])}</b></div>`).join("")}<div class="ptotal"><span>${S.kunde.kasse==="gkv"?"Eigenanteil":"Gesamt"}</span><b>${eur(q.total)}</b></div></div>
  <small class="note">Unverbindliche Preisorientierung. Der endgültige Preis richtet sich nach der gewählten Versorgung und wird in einem Kostenvoranschlag festgehalten.</small>
  <button class="btn light" data-cust>Dem Kunden zeigen</button>`:'<h3>Preisorientierung</h3><span class="note">Bitte ein Gerät wählen.</span>'}</aside></div>`;
}
function stepAbschluss(){
 const dev=DEVICES.find(d=>d.id===S.device),count=ears(),n=name();
 const quick=[["reserve","Gerät vorreservieren",`Gerät vorreservieren: ${dev?dev.m+" "+dev.model:"Stufe "+STAGES[curStage()].name}${count===2?" beidseitig":""} – ${n}`,"Reservierung"],
  ["kv","Kostenvoranschlag an Kasse",`Kostenvoranschlag an ${S.kunde.kk||"Krankenkasse"} – ${n}`,"Krankenkasse"],
  ["call","Rückruf vereinbaren",`Rückruf: Rückfragen zur Beratung – ${n}`,"Rückruf"],
  ["fit","Anpasstermin vorbereiten",`Anpassung vorbereiten – ${n}`,"Anpassung"]];
 return (S.oto.sent?`<div class="okbox"><b>Laborauftrag gesendet</b><span>Otoplastik für ${esc(n)} steht im Labor-Reiter der Aufgaben – Schritt 1: Abformung reinigen.</span></div>`:"")+card("Aufgaben direkt anlegen",`<p class="muted">Ein Klick legt die Aufgabe in der Aufgaben-App an – mit Kunde, Telefon und Gerät verknüpft.</p>
  <div class="quick">${quick.map(([id,l,t,c])=>{const done=S.tasks.find(x=>x.id===id);return `<button type="button" class="qbtn" data-task="${id}" data-title="${esc(t)}" data-cat="${c}" ${done?"disabled":""}>${done?"✓ ":"+ "}${l}</button>`}).join("")}</div>
  ${S.tasks.length?`<div class="tlist">${S.tasks.map(t=>`<div><span class="tile t-kunden">✓</span><div><b>${esc(t.title)}</b><small>${esc(t.cat)} · fällig ${esc(t.due)} · erscheint in „Aufgaben“</small></div></div>`).join("")}</div>`:""}`)+
 card("Termin",`<div class="audtop"><button class="btn" disabled>Termin in AkuWin anlegen <span class="soon">bald</span></button><span class="muted">Freie Zeiten sehen und den Anpasstermin direkt mit dem Kunden vereinbaren.</span></div>`)+
 card("Broschüre für den Kunden",`<div class="brochure"><div class="bthumb"><span>Hörakustik Daugsch</span><b>Ihre persönliche Hörberatung</b><small>${esc(n)}</small></div>
  <div><p>Die Broschüre fasst alles zusammen: Hörsituation, Audiogramm, Hörprofil, Wünsche und Hörziele, Empfehlung mit Leistungsprofil, Preisorientierung und die Übersicht aller sechs Technikstufen – gestaltet für den Druck auf A4.</p>
  <button class="btn primary" disabled>Broschüre erstellen (Phase 3)</button></div></div>`)+card("Beratung abschließen",`<p class="muted">${S.status==="abgeschlossen"?"Diese Beratung ist abgeschlossen.":"Alles wird laufend gespeichert. Mit „Abschließen“ markierst du die Beratung als fertig."}</p><button class="btn ${S.status==="abgeschlossen"?"":"primary"}" data-finish>${S.status==="abgeschlossen"?"Wieder öffnen":"Beratung abschließen"}</button>`);
}


const OOPT={anbindung:["RIC / Ex-Hörer","HdO mit Schlauch","IdO-Schale","Gehörschutz","Schwimmschutz","In-Ear-Monitor"],form:["Vollschale (Concha)","Halbschale","Kralle","Spange / Skelett","Gehörgang (Canal)","Mini-Canal","Hohlschale"],
 material:["Hart (Acrylat / Fotopolymer)","Weich (Silikon)","Thermoplastisch"],haerte:["Shore 40","Shore 60","Shore 70"],farbe:["Transparent","Haut / Beige","Braun","Rot (rechts) / Blau (links)","Schwarz","Individuell"],
 vent:["Keine","0,8 mm","1,0 mm","1,5 mm","2,0 mm","2,5 mm","Offen / IROS"],kanal:["Kurz","Mittel","Lang (2. Knick)"],extras:["Ziehfaden","Gravur Name / Seite","Lack glänzend","Lack matt","Antibakteriell","Filter (Gehörschutz)"],
 masse:["Silikon (A-vernetzend)","Silikon (C-vernetzend)","Digitaler Ohrscan"],qualitaet:["Gut","Nachbessern nötig"]};
const LSTEPS=["Reinigen","Beschneiden","Scannen","Modeling","Druck","Finishing"];
function earOto(side){const p="oto."+side,e=S.oto[side];
 return `<div class="q"><span class="ql">Anbindung</span>${chips(p+".anbindung",OOPT.anbindung)}</div><div class="q"><span class="ql">Form</span>${chips(p+".form",OOPT.form)}</div>
 <div class="q"><span class="ql">Material</span>${chips(p+".material",OOPT.material)}</div>${(e.material||"").startsWith("Weich")?`<div class="q"><span class="ql">Härte</span>${chips(p+".haerte",OOPT.haerte)}</div>`:""}
 <div class="q"><span class="ql">Farbe</span>${chips(p+".farbe",OOPT.farbe)}</div><div class="q"><span class="ql">Belüftung (Vent)</span>${chips(p+".vent",OOPT.vent)}</div>
 <div class="q"><span class="ql">Kanallänge</span>${chips(p+".kanal",OOPT.kanal)}</div><div class="q"><span class="ql">Extras</span>${chips(p+".extras",OOPT.extras,true)}</div>
 ${(e.anbindung||"").startsWith("RIC")?`<div class="form">${inp(p+".hoerer","Hörer (Typ / Länge)","text","z. B. Hersteller-Hörer M, Länge 2","full")}</div>`:""}`}
function stepOto(){
 const o=S.oto,dev=DEVICES.find(d=>d.id===S.device);
 if(!o.sides){const c=ears();const r=pta("R"),l=pta("L");o.sides=c===2?"beide":r!=null&&r>25?"rechts":"links"}
 const anb=dev?(/^RIC/.test(dev.form)?"RIC / Ex-Hörer":/^(IdO|CIC)/.test(dev.form)?"IdO-Schale":"HdO mit Schlauch"):"";["R","L"].forEach(k=>{if(!o[k].anbindung&&anb)o[k].anbindung=anb});
 const both=o.sides==="beide",two=both&&!o.same;
 const head=card("Wird eine Otoplastik benötigt?",`<div class="q"><span class="ql">Otoplastik</span>${chips("oto.needed",["ja","nein","noch offen"])}</div>${dev?`<p class="muted">Gewähltes Gerät: ${esc(dev.m)} ${esc(dev.model)} (${esc(dev.form)})${dev.oto?" – laut Preistool ist hier in der Regel eine Otoplastik nötig.":""}</p>`:""}`);
 if(o.needed!=="ja")return head;
 if(o.sent)return head+`<div class="okbox"><b>Ans Labor gesendet</b><span>Der Auftrag steht jetzt im Labor-Reiter der Aufgaben-App und startet mit Schritt 1.</span>
  <ol class="mtrack">${LSTEPS.map((t,i)=>`<li class="${i===0?"now":""}"><i>${i+1}</i><small>${t}</small></li>`).join("")}</ol><button class="linkbtn" data-goto="labor">Im Labor ansehen</button></div>`;
 return head+card("Abformung",`<div class="form">${inp("oto.abformung.datum","Datum der Abformung","date")}${inp("oto.due","Geplanter Anpasstermin","date")}</div>
  <div class="q"><span class="ql">Material</span>${chips("oto.abformung.masse",OOPT.masse)}</div><div class="q"><span class="ql">Qualität</span>${chips("oto.abformung.qualitaet",OOPT.qualitaet)}</div>
  <div class="form">${inp("oto.abformung.besonderheiten","Besonderheiten","text","z. B. enger 2. Knick, Exostose rechts","full")}</div>`)+
 card("Spezifikation",`<div class="q"><span class="ql">Seite</span>${chips("oto.sides",["rechts","links","beide"])}</div>
  ${both?`<div class="q"><span class="ql">Ausführung</span><div class="chips"><button type="button" class="chip" data-otosame="1" aria-pressed="${o.same}">Beide Seiten gleich</button><button type="button" class="chip" data-otosame="0" aria-pressed="${!o.same}">Seiten unterschiedlich</button></div></div>`:""}
  ${two?`<div class="ears2"><div><h4 class="ear R">Rechts</h4>${earOto("R")}</div><div><h4 class="ear L">Links</h4>${earOto("L")}</div></div>`:earOto(o.sides==="links"?"L":"R")}
  <div class="form">${ta("oto.notes","Hinweise fürs Labor","z. B. Kunde wünscht diskrete Farbe")}</div>
  <div class="nav2"><span class="muted">Der Auftrag erscheint mit Kundenname im Labor-Reiter und durchläuft dort: ${LSTEPS.join(" → ")}.</span><button class="btn primary" data-otosend>Auftrag ans Labor senden</button></div>`);
}
/* ---------- Kundenansicht ---------- */
function customerView(){
 const rec=recommend(),st=STAGES[curStage()],tabs=["Ihr Hörprofil","Ihr Audiogramm","Unsere Empfehlung","Alle Technikstufen"];
 const hard=SITS.filter(s=>S.sit[s.id]&&S.sit[s.id].d>=2);
 const body=custTab===0?`<div class="cgrid">${DIMS.map((d,i)=>`<div class="cbox"><span>${d==="Ruhe"?"In ruhiger Umgebung":d==="Gruppe"?"Gespräche mit mehreren":"In lebhafter Umgebung"}</span>${dots(rec.n[i],"#B8452F")}<small>${["kaum Unterstützung nötig","etwas Unterstützung","spürbare Unterstützung","viel Unterstützung","sehr viel Unterstützung"][rec.n[i]-1]}</small></div>`).join("")}</div>
   <h3>Hier fällt Ihnen das Hören schwer</h3><div class="chips big">${hard.map(s=>`<span class="chip on">${esc(s.t)}</span>`).join("")||"<span>–</span>"}</div>
   <h3>Ihre Hörziele</h3><ol class="cgoals">${S.ziele.filter(z=>z.t).sort((a,b)=>a.p-b.p).map(z=>`<li>${esc(z.t)}</li>`).join("")}</ol>`
 :custTab===1?`<div class="caud">${audioSvg(true)}<div class="degrees"><div><span class="ear R">Rechtes Ohr</span><b>${esc(degree(pta("R"))||"–")}</b></div><div><span class="ear L">Linkes Ohr</span><b>${esc(degree(pta("L"))||"–")}</b></div></div><p class="muted">Die grüne Fläche zeigt, wo Sprache liegt. Alles, was unterhalb Ihrer Hörkurve liegt, können Sie hören – Laute darüber gehen verloren.</p></div>`
 :custTab===2?`<div class="crec"><span class="pnum big">${stageIdx(st.id)+1}</span><div><h2>${st.name}</h2><p>${esc(st.sub)}</p><p class="muted">Ideal für ${esc(st.ideal)}</p></div></div>
   <div class="cgrid">${DIMS.map((d,i)=>`<div class="cbox"><span>${d}</span><small>Ihr Bedarf</small>${dots(rec.n[i],"#B8452F")}<small>${st.name}</small>${dots(st.p[i])}</div>`).join("")}</div>`
 :`<div class="cstages">${STAGES.map((s,i)=>{const f=stageFrom(s.id);return `<div class="cstage${s.id===st.id?" on":""}"><span class="pnum">${i+1}</span><b>${s.name}</b><small>${esc(s.sub)}</small>
   <div class="mini">${DIMS.map((d,j)=>`<div><span>${d}</span>${dots(s.p[j])}</div>`).join("")}</div><span class="pfrom">${s.id==="basis"?"Kassenleistung":"ab "+eur(S.kunde.kasse==="gkv"?f.gkv:f.vk)}</span><small>${S.kunde.kasse==="gkv"&&s.id!=="basis"?"Eigenanteil je Seite":"je Seite"}</small></div>`}).join("")}</div>`;
 return `<div class="cust"><header><div class="brand"><img src="icons/emblem.png" alt="">HÖRAKUSTIK DAUGSCH</div><span class="muted">Ihre persönliche Hörberatung · ${esc(name())}</span>${KUNDE?"":`<button class="btn" data-custclose>Zurück zur Beratung</button>`}</header>
  <nav class="ctabs">${tabs.map((t,i)=>`<button data-ctab="${i}" aria-pressed="${i===custTab}">${t}</button>`).join("")}</nav><main>${body}</main>
  <footer class="muted">Hörakustik Daugsch · Ludwig-Schwamb-Straße 19 · 67574 Osthofen · 06242 50 69 744</footer></div>`;
}


/* ---------- Speichern & Laden ---------- */
const row=()=>({id:cid,customer_name:name(),customer_phone:S.kunde.tel||null,data:S,stage_rec:STAGES[recommend().idx].id,stage_final:STAGES[curStage()].id,device_id:S.device||null,status:S.status||"offen",updated_at:new Date().toISOString()});
function changed(){dirty=true;clearTimeout(saveT);saveT=setTimeout(saveNow,1200);pushCustomer()}
async function saveNow(){
 if(!dirty||!cid||!H().sb)return;if(!S.kunde.vorname&&!S.kunde.nachname&&step===0)return;
 dirty=false;saving=true;paintSave();
 const{error}=await H().sb.from("consultations").upsert(row());
 saving=false;if(error){dirty=true;toast("Beratung nicht gespeichert: "+error.message)}else{const i=list.findIndex(x=>x.id===cid);const r={id:cid,customer_name:name(),customer_phone:S.kunde.tel,stage_final:STAGES[curStage()].id,status:S.status||"offen",updated_at:new Date().toISOString()};i<0?list.unshift(r):list[i]={...list[i],...r}}
 paintSave();
}
function paintSave(){const el=$("bsave");if(el)el.textContent=saving?"speichert …":dirty?"Änderungen …":"gespeichert"}
async function loadList(){
 if(!H().sb)return;listLoading=true;
 const r=await H().sb.from("consultations").select("id,customer_name,customer_phone,stage_final,status,updated_at,created_at").order("updated_at",{ascending:false}).limit(200);
 listLoading=false;listLoaded=true;list=r.error?null:r.data;H().rerender();
}
async function openConsultation(id){
 const r=await H().sb.from("consultations").select("*").eq("id",id).maybeSingle();
 if(r.error||!r.data){toast("Beratung konnte nicht geladen werden");return}
 S=Object.assign(empty(),r.data.data||{});S.kunde=Object.assign(empty().kunde,S.kunde||{});S.an=Object.assign(empty().an,S.an||{});S.oto=Object.assign(empty().oto,S.oto||{});
 cid=id;mode="edit";step=0;customer=false;H().rerender();window.scrollTo(0,0);
}
function newConsultation(){S=empty();cid=uid();mode="edit";step=0;customer=false;dirty=false;H().rerender();window.scrollTo(0,0)}

/* ---------- Aufgaben & Labor ---------- */
const isoD=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
async function createTask(kind,title,cat){
 const dev=DEVICES.find(d=>d.id===S.device),due=new Date();due.setDate(due.getDate()+(kind==="call"?2:1));
 const t={id:uid(),title,category:cat,assignee:H().me?.id||null,due:isoD(due),priority:"normal",status:"offen",customer:name(),phone:S.kunde.tel||null,
  manufacturer:kind==="reserve"&&dev?dev.m:null,model:kind==="reserve"&&dev?dev.model:null,notes:`Aus der Beratung vom ${new Date().toLocaleDateString("de-DE")}`,consultation_id:cid,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
 const{error}=await H().sb.from("tasks").insert(t);
 if(error){toast("Aufgabe nicht angelegt: "+error.message);return}
 S.tasks.push({id:kind,title,cat,taskId:t.id,due:due.toLocaleDateString("de-DE",{weekday:"short",day:"numeric",month:"short"})});toast("Aufgabe angelegt");changed();H().rerender();
}
async function sendLab(){
 const o=S.oto;if(!name()||name()==="Neuer Kunde"){toast("Bitte zuerst den Kundennamen eintragen");step=0;H().rerender();return}
 const same=o.sides!=="beide"||o.same,spec={same,R:o.sides==="links"&&same?o.L&&o.L.form?o.L:o.R:o.R,L:same?o.R:o.L,abformung:o.abformung};
 const me=H().team().find(t=>t.id===H().me?.id)?.name||"";
 const lab={id:uid(),customer:name(),phone:S.kunde.tel||null,consultation_id:cid,sides:o.sides||"beide",spec,stage:0,history:[{step:0,dir:0,at:new Date().toISOString(),by:me}],due:o.due||null,urgent:false,notes:o.notes||null};
 const{error}=await H().sb.from("lab_orders").insert(lab);
 if(error){toast("Laborauftrag nicht gesendet: "+error.message);return}
 o.sent=true;o.labId=lab.id;toast("Auftrag ist im Labor");changed();H().rerender();window.HD_LABOR&&window.HD_LABOR.load();
}

/* ---------- Kundenfenster ---------- */
function pushCustomer(){if(!bc||KUNDE)return;const prices={};STAGES.forEach(s=>prices[s.id]=stageFrom(s.id));bc.postMessage({type:"state",S,custTab,prices,stage:curStage()})}
function openCustomerWindow(){
 const url=location.href.split("#")[0]+"#kunde";
 custWin=window.open(url,"hd-kunde","popup=yes,width=1280,height=820");
 if(!custWin){customer=true;H().rerender();toast("Fenster blockiert – Ansicht wird hier gezeigt");return}
 setTimeout(pushCustomer,800);setTimeout(pushCustomer,2000);toast("Kundenansicht geöffnet – auf den zweiten Bildschirm ziehen und Vollbild (F11)");
}

/* ---------- Ansicht ---------- */
const STAGE_NAME=id=>STAGES.find(s=>s.id===id)?.name||"–";
function listView(){
 if(!listLoaded){if(!listLoading)setTimeout(loadList,0);return `<div class="empty"><p>Beratungen werden geladen …</p></div>`}
 if(list===null)return `<div class="bar"><h2>Beratung</h2></div><div class="empty"><p><b>Die Beratungs-Tabelle ist noch nicht eingerichtet.</b><br>Bitte <code>sql/004_beratung.sql</code> in Supabase ausführen.</p></div>`;
 const f=list.filter(x=>!q||(x.customer_name||"").toLowerCase().includes(q.toLowerCase()));
 return `<div class="bar"><h2>Beratung</h2><label class="search"><svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="bq" type="search" placeholder="Kunde suchen …" value="${esc(q)}" aria-label="Beratung suchen"></label><button class="btn primary" data-bnew>+ Neue Beratung</button></div>
 ${f.length?`<section class="list">${f.map(x=>`<article class="task" data-bopen="${esc(x.id)}"><span class="tile t-werkstatt"><svg class="i" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg></span>
  <div class="body"><span class="title">${esc(x.customer_name||"Ohne Namen")}</span><div class="meta"><span>${new Date(x.updated_at||x.created_at).toLocaleDateString("de-DE",{day:"numeric",month:"short",year:"numeric"})}</span>${x.customer_phone?`<span>${esc(x.customer_phone)}</span>`:""}<span class="tag work">${esc(STAGE_NAME(x.stage_final))}</span>${x.status==="abgeschlossen"?'<span class="tag">abgeschlossen</span>':'<span class="tag wait">offen</span>'}</div></div></article>`).join("")}</section>`
  :`<div class="empty"><p>${list.length?"Keine Beratung gefunden.":"Noch keine Beratungen. Mit „+ Neue Beratung“ startest du die erste."}</p></div>`}`;
}
function editView(){
 const pp=P();if(pp&&!pp.state.loaded&&!pp.state.loading&&H().sb)pp.load();
 refreshDevices();
 if(customer)return `<div class="bx">${customerView()}</div>`;
 const f=flags(),rec=recommend();
 return `<div class="bx"><div class="bhead"><button class="btn" data-blist>← Übersicht</button><span class="crumb">Beratung · <b>${esc(name())}</b></span><span class="bsave" id="bsave">${dirty?"Änderungen …":"gespeichert"}</span>
  <div class="topright"><button class="btn" data-bcustwin>Kundenansicht öffnen</button></div></div>
 <div class="layout"><nav class="stepper">${STEPS.map(([t,s],i)=>`<button data-step="${i}" aria-current="${i===step?"step":"false"}"><span class="num">${i+1}</span><span><b>${t}</b><small>${i===1&&f.length?`<em>${f.length} Hinweis${f.length>1?"e":""}</em>`:i===6?esc(STAGES[curStage()].name):i===7&&S.oto.sent?"ans Labor gesendet ✓":s}</small></span></button>`).join("")}
  <div class="side-reco"><small>Aktueller Vorschlag</small><b>${STAGES[rec.idx].name}</b>${DIMS.map((d,i)=>`<div><span>${d}</span>${dots(rec.n[i],"#B8452F")}</div>`).join("")}</div></nav>
 <div class="content"><div class="stephead"><span class="muted">Schritt ${step+1} von ${STEPS.length}</span><h1>${STEPS[step][0]}</h1></div>
  ${[stepKunde,stepAnamnese,stepAudio,stepBedarf,stepWuensche,stepZiele,stepEmpfehlung,stepOto,stepAbschluss][step]()}
  <div class="nav2">${step>0?`<button class="btn" data-step="${step-1}">← ${STEPS[step-1][0]}</button>`:"<span></span>"}${step<STEPS.length-1?`<button class="btn primary" data-step="${step+1}">Weiter: ${STEPS[step+1][0]} →</button>`:""}</div></div></div></div>`;
}
function render(){const h=mode==="edit"?editView():listView();setTimeout(pushCustomer,0);return h}

/* ---------- Ereignisse ---------- */
const active=()=>KUNDE||(H()&&H().page()==="beratung");
const rr=()=>{const y=window.scrollY;H().rerender();window.scrollTo(0,y)};
document.addEventListener("click",e=>{
 if(!active())return;const el=e.target;if(el.closest("dialog"))return;
 const b=el.closest("button,article[data-bopen]");if(!b)return;const d=b.dataset;
 if(KUNDE){if(d.ctab!=null){custTab=Number(d.ctab);renderKunde()}return}
 if(d.bnew!=null){newConsultation();return}
 if(d.bopen){openConsultation(d.bopen);return}
 if(d.blist!=null){saveNow();mode="list";customer=false;listLoaded=false;H().rerender();return}
 if(d.goto){saveNow();if(d.goto==="labor"){H().go("aufgaben");H().setTab("labor")}else H().go(d.goto);return}
 if(mode!=="edit")return;
 if(d.step!=null){step=Number(d.step);saveNow();H().rerender();window.scrollTo(0,0);return}
 if(d.set){set(d.set,get(d.set)===d.v&&!d.set.endsWith("kasse")&&d.set!=="oto.sides"?"":d.v);changed();rr();return}
 if(d.tog){const a=get(d.tog)||[];set(d.tog,a.includes(d.v)?a.filter(x=>x!==d.v):[...a,d.v]);changed();rr();return}
 if(d.sit){const r=S.sit[d.sit]||{};const v=Number(d.v);r[d.k]=r[d.k]===v?null:v;if(d.k==="d"&&v>0&&r.i==null)r.i=1;if(d.k==="d"&&v===0)r.i=null;S.sit[d.sit]=r;changed();rr();return}
 if(d.addgoal!=null){S.ziele.push({t:"",p:S.ziele.length+1});changed();rr();return}
 if(d.delgoal!=null){S.ziele.splice(Number(d.delgoal),1);if(!S.ziele.length)S.ziele.push({t:"",p:1});changed();rr();return}
 if(d.sugg){const t=d.sugg.replace(/,.*$/,"");const txt="Besser verstehen: "+t;const i=S.ziele.findIndex(z=>!z.t);if(i>=0)S.ziele[i].t=txt;else if(S.ziele.length<5)S.ziele.push({t:txt,p:S.ziele.length+1});changed();rr();return}
 if(d.stage!=null){S.override=d.stage==="reset"||Number(d.stage)===recommend().idx?"":Number(d.stage);S.device="";S.otos=-1;changed();rr();return}
 if(d.dev){S.device=d.dev;S.otos=-1;changed();rr();return}
 if(d.otos!=null){S.otos=Number(d.otos);changed();rr();return}
 if(d.task){createTask(d.task,d.title,d.cat);return}
 if(d.otosame!=null){S.oto.same=d.otosame==="1";if(!S.oto.same)S.oto.L=JSON.parse(JSON.stringify(S.oto.R));changed();rr();return}
 if(d.otosend!=null){sendLab();return}
 if(d.finish!=null){S.status=S.status==="abgeschlossen"?"offen":"abgeschlossen";changed();saveNow();toast(S.status==="abgeschlossen"?"Beratung abgeschlossen":"Beratung wieder geöffnet");rr();return}
 if(d.cust!=null||d.bcustwin!=null){custTab=step===6?2:0;openCustomerWindow();return}
 if(d.custclose!=null){customer=false;H().rerender();return}
 if(d.ctab!=null){custTab=Number(d.ctab);pushCustomer();H().rerender();return}
});
document.addEventListener("input",e=>{
 if(!active()||KUNDE)return;const t=e.target;
 if(t.id==="bq"){q=t.value;H().rerender();const i=$("bq");i.focus();i.setSelectionRange(i.value.length,i.value.length);return}
 if(mode!=="edit")return;
 if(t.dataset.in){set(t.dataset.in,t.dataset.num!=null?Number(t.value):t.value);if(t.type==="range"){const lb=t.closest("label").querySelector("b");if(lb)lb.textContent=t.value}
  if(t.dataset.in.startsWith("kunde.")){const c=document.querySelector(".crumb b");if(c)c.textContent=name()}changed();return}
 if(t.dataset.aud){const[e2,f]=t.dataset.aud.split(".");const v=t.value.trim();S.audio[e2][f]=v===""?undefined:Number(v);$("audchart").innerHTML=audioSvg();
  const dg=document.querySelectorAll(".degrees b");if(dg.length===2){dg[0].textContent=degree(pta("R"))||"–";dg[1].textContent=degree(pta("L"))||"–"}changed()}
});
document.addEventListener("change",e=>{if(!active()||KUNDE||mode!=="edit")return;if(e.target.dataset.in&&e.target.tagName==="SELECT")rr()});
window.addEventListener("beforeunload",()=>{if(dirty)saveNow()});

/* ---------- Kundenmodus (eigenes Fenster) ---------- */
function renderKunde(){document.getElementById("kroot").innerHTML=`<div class="bx">${customerView()}</div>`}
if(KUNDE){
 document.title="Hörakustik Daugsch · Ihre Hörberatung";
 document.body.innerHTML='<div id="kroot"><div class="bx"><div class="cust"><header><div class="brand"><img src="icons/emblem.png" alt="">HÖRAKUSTIK DAUGSCH</div></header><main><div class="crec"><div><h2>Herzlich willkommen</h2><p class="muted">natürlich · individuell · hören</p></div></div></main></div></div></div>';
 if(bc)bc.onmessage=ev=>{const m=ev.data;if(m&&m.type==="state"){S=m.S;custTab=m.custTab;SNAP_PRICES=m.prices;S.override=m.stage===recommend().idx?"":m.stage;renderKunde()}};
}

window.HD_BERATUNG={render};
})();
