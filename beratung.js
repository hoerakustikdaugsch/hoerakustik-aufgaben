/* Hörakustik Daugsch · Portal – Modul Beratung
   Geführte Beratung mit Live-Empfehlung; Geräte & Preise aus dem Preistool; Aufgaben & Laboraufträge in die Datenbank;
   Kundenansicht als eigenes Fenster (gleicher Rechner, BroadcastChannel). */
(() => {
const KUNDE=location.hash==="#kunde";
const H=()=>window.HD;
const $=id=>document.getElementById(id);
const esc=s=>H().esc(s);
const eur=n=>(Math.round(n)).toLocaleString("de-DE")+" €";
const uid=()=>H().uid();
const isoD=d=>H().iso(d);
const toast=m=>H()&&H().toast(m);
/* ---------- Logik ---------- */
const STAGES=[
 {id:"basis",name:"Basis",sub:"Gut hören im ruhigen Alltag",p:[3,1,1],auto:"einfach",ideal:"Zuhause, Gespräche zu zweit",plus:["Klare Sprache in ruhiger Umgebung","Schutz vor Pfeifen","Grundlegende Lärmdämpfung"]},
 {id:"komfort",name:"Komfort",sub:"Einfach hören. Bequem aufladen.",p:[3,1,1],auto:"einfach",ideal:"wie Basis, ohne Batteriewechsel",plus:["Akku statt Batterien","App & Bluetooth je nach Modell"]},
 {id:"balance",name:"Balance",sub:"Mehr Sicherheit im Höralltag",p:[4,2,2],auto:"erkennt Situationen",ideal:"Familie, Einkaufen, aktiver Alltag",plus:["Erkennt Situationen selbst","Hebt Ihr Gegenüber hervor","Dämpft Lärm und Wind stärker"]},
 {id:"praezision",name:"Präzision",sub:"Gesprächen leichter folgen",p:[4,3,3],auto:"passt sich laufend an",ideal:"regelmäßig Gruppen und Restaurant",plus:["Passt sich fließend an","Feinere Klangabstimmung","Eigene Stimme klingt natürlich"]},
 {id:"exzellenz",name:"Exzellenz",sub:"Souverän hören, auch wenn es lebhaft wird",p:[5,4,4],auto:"erkennt Sprecher und Bewegung",ideal:"Beruf, Vereine, wechselnde Situationen",plus:["Folgt mehreren Gesprächspartnern","Sensoren erkennen Bewegung","Eigene Musikprogramme"]},
 {id:"perfektion",name:"Perfektion",sub:"Höchste Technik für höchste Ansprüche",p:[5,5,5],auto:"volle Individualisierung",ideal:"höchste Ansprüche, Musik, schwierigste Situationen",plus:["Stärkste Hilfe im Lärm","Feinster Klang bis in hohe Töne","Premium-Extras je nach Hersteller"]}];
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
let SNAP_PRICES=null,SNAP_PLUS=null;
const P=()=>window.HD_PREISE;
let DEVICES=[];
const refreshDevices=()=>{DEVICES=P()?(P().state.devices||[]).filter(d=>d.active!==false).map(d=>({id:d.id,m:d.manufacturer,model:d.model,form:d.form||"",power:d.power||"",ek:Number(d.ek),oto:!!d.otoplastic,raw:d})).sort((a,b)=>a.ek-b.ek):[]};
const band=ek=>{const b=P()&&P().bandFor(ek);return b?[b.name,b.stage,0,0,Number(b.vk_private)]:["–","",0,0,0]};
function quote(dev,count,otos){const q=P()&&P().quote(dev.raw,S.kunde.kasse==="gkv"?"gkv":"privat",count,otos);return q?{lines:q.lines.map(l=>[l.label,l.amount]),total:q.total}:null}
const plusOf=s=>(SNAP_PLUS&&SNAP_PLUS[s.id])||(P()&&P().stagePlus&&P().stagePlus(s.id))||s.plus;
const stageFrom=id=>{if(SNAP_PRICES)return SNAP_PRICES[id]||{vk:0,gkv:0};return(P()&&P().stageFrom(id))||{vk:0,gkv:0}};

const empty=()=>({kunde:{anrede:"",vorname:"",nachname:"",geb:"",tel:"",mail:"",kasse:"gkv",kk:"",verordnung:"",vdatum:"",hno:"",versorgung:"erst"},
 an:{seit:"",verlauf:"",seite:"",bemerkt:"",hoersturz:"",hsWann:"",hsSeite:"",laerm:"",laermArt:[],entz:[],ops:[],tinn:"",tinnSeite:"",tinnBel:0,tinnArt:"",
  schwindel:"",druck:"",hyper:"",schmerz:"",ausfluss:"",puls:"",schmalz:"",allergie:"",allergieText:"",familie:"",meds:"",allg:[],handling:[],hgAlt:"",hgModell:"",hgTrage:"",hgZufr:"",hgStoer:""},
 audio:{R:{},L:{}},sit:{},leben:[],technik:"",phone:"",frei:"",wuensche:[],bauform:"",energie:"",budget:"",ziele:[{t:"",p:1}],override:"",device:"",otos:-1,tasks:[],
 oto:{needed:"",sides:"",same:true,R:{anbindung:"",form:"",material:"",haerte:"",farbe:"",vent:"",kanal:"",extras:[],hoerer:""},L:{anbindung:"",form:"",material:"",haerte:"",farbe:"",vent:"",kanal:"",extras:[],hoerer:""},abformung:{datum:new Date().toISOString().slice(0,10),qualitaet:"",besonderheiten:""},due:"",notes:"",sent:false},status:"offen"});

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
 ["R","L"].forEach(e=>{const g=a["oto"+e+"G"]||[],t=a["oto"+e+"T"]||[],s2=e==="R"?" rechts":" links";
  if(g.includes("Cerumen obturierend"))f.push("Obturierendes Cerumen"+s2+" – vor Messung/Abformung entfernen lassen");
  if(g.includes("gerötet / entzündet")||g.includes("Schwellung"))f.push("Entzündeter Gehörgang"+s2);
  if(g.includes("Fremdkörper"))f.push("Fremdkörper im Gehörgang"+s2);
  if(t.includes("Perforation"))f.push("Trommelfellperforation"+s2);
  if(t.includes("gerötet")||t.includes("vorgewölbt"))f.push("Auffälliges Trommelfell"+s2)});
 const r=pta("R"),l=pta("L");if(r!=null&&l!=null&&Math.abs(r-l)>=20)f.push("Deutlicher Seitenunterschied im Audiogramm");return f};
function ears(){const r=pta("R"),l=pta("L");const c=[r,l].filter(v=>v!=null&&v>25).length;return c||2}
const curStage=()=>S.override!==""?Number(S.override):recommend().idx;
const name=()=>[S.kunde.vorname,S.kunde.nachname].filter(Boolean).join(" ")||"Neuer Kunde";
const dots=(n,on="var(--forest)")=>`<span class="dots">${[1,2,3,4,5].map(i=>`<i style="background:${i<=n?on:"#DCE6E2"}"></i>`).join("")}</span>`;

/* ---------- Audiogramm-Grafik ---------- */
/* Audiogramm je Ohr: Luftleitung durchgezogen (○ rechts / × links), Knochenleitung gestrichelt (< rechts / > links) */
function audioPair(big=false,print=false){
 const one=e=>{const d=degree(pta(e));return `<figure class="audone ${e}"><figcaption><span class="ear ${e}">${e==="R"?"Rechtes Ohr ○":"Linkes Ohr ×"}</span><b>${d?esc(d):"–"}</b>${pta(e)!=null?`<small>Ø ${Math.round(pta(e))} dB</small>`:""}</figcaption>${audioSvg(big,e,print)}</figure>`};
 const bc=S.audioBC&&["R","L"].some(e=>Object.keys(S.audioBC[e]||{}).length);
 return `<div class="audpair">${one("R")}${one("L")}</div><p class="audleg"><span><i class="sw"></i>Sprachbereich</span>${bc?`<span>━ Luftleitung</span><span>┅ Knochenleitung</span>`:""}</p>`;
}
function audioSvg(big=false,ear=null,print=false){
 const W=ear?470:600,H=big?(ear?330:380):(ear?300:320),l=44,r=ear?84:96,t=20,b=30,x=i=>l+i*(W-l-r)/(FREQ.length-1),y=db=>t+(db+10)/130*(H-t-b);
 const zones=[[-10,25,"#EEF6F2","normal"],[25,40,"#F3F6EC","leicht"],[40,60,"#FBF4E6","mittel"],[60,80,"#FBEDE6","hochgradig"],[80,120,"#F8E6E6","an Taubheit grenzend"]];
 let s=`<svg viewBox="0 0 ${W} ${H}" class="audsvg" role="img" aria-label="Tonaudiogramm">`;
 zones.forEach(([a,c,col])=>{s+=`<rect x="${l}" y="${y(a)}" width="${W-l-r}" height="${y(c)-y(a)}" fill="${col}"/>`});
 // Sprachbereich (Fläche)
 s+=`<path d="M${x(1)} ${y(22)} Q${x(3)} ${y(18)} ${x(5)} ${y(28)} L${x(5)} ${y(55)} Q${x(3)} ${y(62)} ${x(1)} ${y(50)}Z" fill="#276955" opacity=".10"/>`;
 // Raster
 for(let d=0;d<=120;d+=20)s+=`<line x1="${l}" x2="${W-r}" y1="${y(d)}" y2="${y(d)}" stroke="#DCE6E2"/><text x="${l-8}" y="${y(d)+4}" text-anchor="end" font-size="11" fill="#587168">${d}</text>`;
 FREQ.forEach((f,i)=>s+=`<line x1="${x(i)}" x2="${x(i)}" y1="${t}" y2="${H-b}" stroke="#E7EEEB"/><text x="${x(i)}" y="${H-10}" text-anchor="middle" font-size="11" fill="#587168">${f>=1000?f/1000+"k":f}</text>`);
 // Beschriftungen über dem Raster, mit weißem Rand gut lesbar
 // Grad-Beschriftung rechts neben dem Raster (mittig je Zone, lange Begriffe zweizeilig)
 zones.forEach(([a,c,col,lb])=>{const m=(y(Math.max(a,-10))+y(Math.min(c,120)))/2,w=lb.split(" ");const lines=w.length>2?[w.slice(0,2).join(" "),w.slice(2).join(" ")]:[lb];
  s+=`<rect x="${W-r+4}" y="${y(a)+1}" width="4" height="${y(c)-y(a)-2}" rx="2" fill="${col}" stroke="#C9D8D2" stroke-width=".6"/>`;
  s+=`<text x="${W-r+12}" y="${m+4-(lines.length-1)*6}" font-size="11" font-weight="600" fill="#5E7A71">${lines.map((t2,i)=>`<tspan x="${W-r+12}" dy="${i?12:0}">${t2}</tspan>`).join("")}</text>`});
 [["R","#C0392B"],["L","#2F5D8A"]].filter(([e])=>!ear||e===ear).forEach(([e,c])=>{
  const bc=S.audioBC&&S.audioBC[e]?FREQ.map((f,i)=>[i,S.audioBC[e][f]]).filter(p=>p[1]!=null&&!isNaN(Number(p[1]))).map(p=>[p[0],Number(p[1])]):[];
  if(ear&&bc.length){if(bc.length>1)s+=`<polyline points="${bc.map(p=>x(p[0])+","+y(p[1])).join(" ")}" fill="none" stroke="${c}" stroke-width="1.8" stroke-dasharray="5 4" opacity=".8"/>`;
   bc.forEach(p=>{const X=x(p[0]),Y=y(p[1]);s+=e==="R"?`<path d="M${X+4} ${Y-6}L${X-4} ${Y}L${X+4} ${Y+6}" fill="none" stroke="${c}" stroke-width="2"/>`:`<path d="M${X-4} ${Y-6}L${X+4} ${Y}L${X-4} ${Y+6}" fill="none" stroke="${c}" stroke-width="2"/>`})}
  const pts=FREQ.map((f,i)=>[i,S.audio[e][f]]).filter(p=>p[1]!=null&&p[1]!==""&&!isNaN(Number(p[1]))).map(p=>[p[0],Number(p[1])]);
  if(pts.length>1)s+=`<polyline points="${pts.map(p=>x(p[0])+","+y(p[1])).join(" ")}" fill="none" stroke="${c}" stroke-width="2.5"/>`;
  pts.forEach(p=>{s+=e==="R"?`<circle cx="${x(p[0])}" cy="${y(p[1])}" r="6" fill="#fff" stroke="${c}" stroke-width="2.5"/>`:`<path d="M${x(p[0])-5} ${y(p[1])-5}l10 10M${x(p[0])+5} ${y(p[1])-5}l-10 10" stroke="${c}" stroke-width="2.5"/>`})});
 return s+`<text x="${l}" y="12" font-size="11" fill="#587168">dB HL</text></svg>`;
}

/* ---------- Schritte ---------- */
/* ---------- AkuWin ---------- */
const AK={q:"",loading:false,res:null,err:"",audios:null,audLoading:false,meta:null,metaLoading:false,upcoming:null,upLoading:false,creating:false,busy:null,busyKey:"",busyLoading:false,days:14};
const fmtD=d=>d?new Date(d+"T12:00").toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric"}):"";
async function akInvoke(body){const r=await H().sb.functions.invoke("akuwin",{body});if(r.error){let m=String(r.error.message||r.error);try{const j=await r.error.context.json();m=j.error||m}catch{}throw new Error(m)}if(r.data&&r.data.error)throw new Error(r.data.error);return r.data}
let akT=null;
function akSearch(q){AK.q=q;clearTimeout(akT);if(q.trim().length<2){AK.res=null;AK.err="";paintAk();return}
 akT=setTimeout(async()=>{AK.loading=true;paintAk();try{const d=await akInvoke({action:"clients",q:q.trim()});if(AK.q===q){AK.res=d.clients||[];AK.err=""}}catch(e){AK.err=e.message;AK.res=null}AK.loading=false;paintAk()},350)}
function akResHtml(){
 if(AK.loading)return '<p class="muted">Suche in AkuWin …</p>';
 if(AK.err)return `<p class="akerr">AkuWin: ${esc(AK.err)}</p>`;
 if(!AK.res)return "";
 if(!AK.res.length)return '<p class="muted">Kein Kunde gefunden. Tipp: nur den Nachnamen oder den Anfang eingeben.</p>';
 return `<div class="akres">${AK.res.map(c=>`<button type="button" class="akhit" data-akpick="${c.id}"><b>${esc(c.last)}, ${esc(c.first)}</b><span>${c.birthday?"geb. "+fmtD(c.birthday):""}${c.city?" · "+esc(c.city):""}${c.lastVisit?" · zuletzt "+fmtD(c.lastVisit):""}</span></button>`).join("")}</div>`;
}
function paintAk(){const el=$("akres");if(el)el.innerHTML=akResHtml()}
function akCard(){
 if(S.kunde.akuwinId)return `<div class="aklinked"><span class="akdot"></span><div><b>Mit AkuWin verknüpft</b><small>Kunden-Nr. ${esc(S.kunde.akuwinId)}${S.audioSrc?" · Audiogramm vom "+esc(fmtD(S.audioSrc.date)):""}</small></div><button type="button" class="btn" data-akreload>Audiogramm neu laden</button><button type="button" class="linkbtn" data-akunlink>Verknüpfung lösen</button></div>`;
 return card("Aus AkuWin übernehmen",`<label class="aksearch"><input id="akq" type="search" autocomplete="off" placeholder="Kunde suchen – z. B. Müller oder Anna Müller" value="${esc(AK.q)}"></label><div id="akres">${akResHtml()}</div><p class="muted">Stammdaten und das neueste Audiogramm werden automatisch übernommen.</p>`);
}
function applyAudiogram(a){
 const pick=src=>{const o={};FREQ.forEach(f=>{if(src[f]!=null)o[f]=src[f]});return o};
 S.audio={R:pick(a.ac.R||{}),L:pick(a.ac.L||{})};S.audioBC={R:pick(a.bc.R||{}),L:pick(a.bc.L||{})};S.audioSrc={guid:a.guid,date:a.date,from:"AkuWin"};
}
async function akLoadAudios(choose){
 if(!S.kunde.akuwinId)return;AK.audLoading=true;rr();
 try{const d=await akInvoke({action:"audiograms",clientId:S.kunde.akuwinId});AK.audios=d.audiograms||[];AK.audLoading=false;
  if(!AK.audios.length){toast("In AkuWin ist für diesen Kunden kein Audiogramm hinterlegt");rr();return}
  if(choose){const hasManual=["R","L"].some(e=>Object.values(S.audio[e]||{}).some(v=>v!=null&&v!==""));
   if(hasManual&&!S.audioSrc&&!await H().ask("Audiogramm ersetzen?","Die von Hand eingetragenen Werte werden durch das Audiogramm aus AkuWin ersetzt.","Ersetzen")){rr();return}
   applyAudiogram(AK.audios[0]);changed();toast("Audiogramm vom "+fmtD(AK.audios[0].date)+" übernommen")}
  rr();
 }catch(e){AK.audLoading=false;toast("AkuWin: "+e.message);rr()}
}
async function akPick(id){
 const c=(AK.res||[]).find(x=>String(x.id)===String(id));if(!c)return;const k=S.kunde;
 k.akuwinId=c.id;k.anrede=c.salutation==="Frau"||c.salutation==="Herr"?c.salutation:k.anrede;k.vorname=c.first;k.nachname=c.last;
 if(c.birthday)k.geb=c.birthday;if(c.phone)k.tel=c.phone;if(c.email)k.mail=c.email;if(c.insured&&!k.kasse)k.kasse="gkv";
 if(c.street||c.city)k.adresse=[c.street,[c.zip,c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
 AK.q="";AK.res=null;changed();toast("Kunde aus AkuWin übernommen");await akLoadAudios(true);
}
/* ---------- Folgetermine (AkuWin) ---------- */
const hmT=s=>s.slice(11,16);
const termDate=s=>new Date(s.slice(0,10)+"T12:00").toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"});
async function akMeta(){if(AK.meta||AK.metaLoading)return;AK.metaLoading=true;try{AK.meta=await akInvoke({action:"apptMeta"})}catch(e){AK.meta={types:[],resources:[],err:e.message}}AK.metaLoading=false;rr()}
async function akUpcoming(force){if(!S.kunde.akuwinId||(AK.upcoming&&!force)||AK.upLoading)return;AK.upLoading=true;
 try{const d=await akInvoke({action:"clientAppointments",clientId:S.kunde.akuwinId});AK.upcoming=(d.appointments||[]).slice().sort((a,b)=>a.start.localeCompare(b.start));AK.upAt=Date.now();
  // Snapshot für die Broschüre
  S.termine=AK.upcoming.map(a=>({start:a.start,end:a.end,type:a.type,res:(a.resources||[]).map(resLabel).filter(Boolean).join(", "),note:a.note}));changed();
 }catch(e){AK.upcoming=[];AK.upErr=e.message}AK.upLoading=false;rr()}
const resLabel=id=>{const r=(AK.meta&&AK.meta.resources||[]).find(x=>x.id===id);if(!r)return "";const n=r.name.replace(/\s*\([^)]*\)/,"");return n.includes(",")?n.split(",")[1].trim():n};
function tfDefaults(){
 const t=S.tf||(S.tf={});const m=AK.meta||{types:[],resources:[]};
 if(!t.typeId){const pref=m.types.find(x=>/^Anpassung$/i.test(x.name))||m.types[0];if(pref){t.typeId=pref.id;t.minutes=pref.minutes}}
 if(!t.res){const meName=(H().team().find(x=>x.id===H().me?.id)?.name||"").split(" ")[0].toLowerCase();const r=m.resources.find(x=>x.type==="Employee"&&x.name.toLowerCase().includes(meName))||m.resources.find(x=>x.type==="Employee")||m.resources[0];if(r)t.res=r.id}
 if(!t.date){const d=new Date();d.setDate(d.getDate()+7);if(d.getDay()===0)d.setDate(d.getDate()+1);if(d.getDay()===6)d.setDate(d.getDate()+2);t.date=d.toISOString().slice(0,10)}
 if(!t.time)t.time="10:00";if(!t.minutes)t.minutes=60;return t;
}
/* ---------- Freie Termine finden ---------- */
// Öffnungszeiten (Mo=1 … Fr=5) in Minuten ab 0 Uhr
const OPEN={1:[600,1020],2:[600,1020],3:[600,840],4:[600,1020],5:[600,840]};
const minOf=s=>Number(s.slice(11,13))*60+Number(s.slice(14,16));
async function akBusy(force){
 const from=new Date(),to=new Date();to.setDate(to.getDate()+AK.days);
 const key=isoD(from)+"|"+isoD(to);if(!force&&AK.busyKey===key&&AK.busy)return;if(AK.busyLoading)return;
 AK.busyLoading=true;
 try{const d=await akInvoke({action:"appointments",from:isoD(from),to:isoD(to)});AK.busy=d.appointments||[];AK.busyKey=key}catch(e){AK.busy=null;AK.busyErr=e.message}
 AK.busyLoading=false;rr();
}
function freeSlots(){
 if(!AK.busy)return null;const t=S.tf||{},dur=Number(t.minutes)||60,res=t.res;const now=new Date(),nowM=now.getHours()*60+now.getMinutes();
 const out=[];
 for(let i=0;i<=AK.days;i++){const d=new Date();d.setDate(d.getDate()+i);const wd=d.getDay(),oh=OPEN[wd];if(!oh)continue;const day=isoD(d);
  // belegte Zeiten dieser Ressource (abgesagte zählen nicht); ganztägige Termine sperren den Tag
  const rooms=t.room===false?[]:(AK.meta&&AK.meta.resources||[]).filter(x=>x.type!=="Employee").map(x=>x.id);
  const appts=AK.busy.filter(a=>a.start.slice(0,10)<=day&&a.end.slice(0,10)>=day&&a.state!=="Cancelled"&&(!a.resources.length||a.resources.includes(res)||a.resources.some(r=>rooms.includes(r))));
  if(appts.some(a=>a.allDay))continue;
  const busy=appts.map(a=>[a.start.slice(0,10)<day?0:minOf(a.start),a.end.slice(0,10)>day?1440:minOf(a.end)]);
  // bereits vorgemerkte Termine (gleiche Ressource) gelten als belegt – außer der Slot selbst, damit er abwählbar bleibt
  plan().filter(p=>p.date===day&&(p.res===res||t.room!==false)).forEach(p=>{const s=Number(p.time.slice(0,2))*60+Number(p.time.slice(3,5));busy.push([s,s+p.minutes,p.time])});
  const slots=[];
  for(let m=oh[0];m+dur<=oh[1];m+=15){if(i===0&&m<nowM+30)continue;const hm2=hhmm(m);if(busy.some(([s,e,own])=>own!==hm2&&m<e&&m+dur>s))continue;slots.push(m)}
  if(slots.length)out.push({day,date:d,slots});
 }
 return out;
}
const hhmm=m=>String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
function slotsHtml(){
 const key=isoD(new Date())+"|"+(()=>{const x=new Date();x.setDate(x.getDate()+AK.days);return isoD(x)})();
 if((!AK.busy||AK.busyKey!==key)&&!AK.busyLoading)setTimeout(()=>akBusy(),0);
 if(AK.busyLoading&&!AK.busy)return '<p class="muted">Freie Zeiten werden in AkuWin gesucht …</p>';
 if(!AK.busy)return `<p class="akerr">Freie Zeiten konnten nicht geladen werden${AK.busyErr?": "+esc(AK.busyErr):""}.</p>`;
 const f=freeSlots()||[],t=S.tf||{};
 if(!f.length)return `<p class="muted">In den nächsten ${AK.days} Tagen ist für ${resLabel(t.res)} kein passender Zeitraum frei.</p><button type="button" class="linkbtn" data-tfmore>14 Tage weiter suchen</button>`;
 return `<div class="slots">${f.slice(0,8).map(g=>`<div class="sday"><b>${esc(g.date.toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit"}))}<small class="indays">${inDays(g.day)}</small></b><div class="schips">${g.slots.filter((m,i,a)=>i===0||m-a[i-1]>=30||m%30===0).slice(0,8).map(m=>`<button type="button" class="chip schip" data-tfslot="${g.day}T${hhmm(m)}" aria-pressed="${plan().some(p=>p.date===g.day&&p.time===hhmm(m))}">${hhmm(m)}</button>`).join("")}</div></div>`).join("")}</div>
  <button type="button" class="linkbtn" data-tfmore>Weitere Tage anzeigen</button>`;
}
function termineCard(){
 if(!S.kunde.akuwinId)return card("Folgetermine in AkuWin",`<div class="audtop"><button class="btn" data-step="0">Kunde aus AkuWin übernehmen</button><span class="muted">Termine können angelegt werden, sobald die Beratung mit einem AkuWin-Kunden verknüpft ist.</span></div>`);
 if(!AK.meta){setTimeout(akMeta,0);return card("Folgetermine in AkuWin",'<p class="muted">Termintypen werden aus AkuWin geladen …</p>')}
 if(AK.upcoming==null&&!AK.upLoading)setTimeout(()=>akUpcoming(),0);
 const m=AK.meta,t=tfDefaults();
 const list=AK.upcoming||[];
 const typeChips=m.types.map(x=>`<button type="button" class="chip tchip" data-tftype="${esc(x.id)}" aria-pressed="${t.typeId===x.id}" style="--tc:${esc(x.color||"#E6EEEA")}"><i></i>${esc(x.name)}</button>`).join("");
 const resChips=m.resources.map(x=>`<button type="button" class="chip" data-tfres="${esc(x.id)}" aria-pressed="${t.res===x.id}">${esc(resLabel(x.id)||x.name)}</button>`).join("");
 const durs=[15,30,45,60,90,120,180];if(!durs.includes(Number(t.minutes)))durs.push(Number(t.minutes));
 return card("Folgetermine in AkuWin",`${m.err?`<p class="akerr">AkuWin: ${esc(m.err)}</p>`:""}
  <div class="tplan"><h4>Geplante Termine ${AK.upLoading?'<small class="muted">lädt …</small>':`<small class="muted">${list.length}${AK.upAt?" · Stand "+new Date(AK.upAt).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}):""}</small>`}<button type="button" class="linkbtn tref" data-tfrefresh ${AK.upLoading?"disabled":""}>↻ aktualisieren</button></h4>
   ${list.length?`<div class="tlist2">${list.map(a=>{const ty=m.types.find(x=>x.id===a.typeId);return `<div class="trow"><span class="tdot" style="background:${esc(ty&&ty.color||"#E6EEEA")}"></span><b>${esc(termDate(a.start))}</b><span>${hmT(a.start)}–${hmT(a.end)} Uhr</span><span>${esc(a.type)}</span><span class="muted">${esc((a.resources||[]).map(resLabel).filter(Boolean).join(", "))}</span></div>`}).join("")}</div>`:AK.upLoading?"":'<p class="muted">Noch keine kommenden Termine in AkuWin.</p>'}</div>
  <div class="tform"><h4>Neuer Termin</h4>
   <div class="q"><span class="ql">Termintyp</span><div class="chips">${typeChips}</div></div>
   <div class="form tgrid"><label>Datum<input type="date" data-in="tf.date" value="${esc(t.date)}"></label><label>Uhrzeit<input type="time" step="900" data-in="tf.time" value="${esc(t.time)}"></label>
    <label>Dauer<select data-in="tf.minutes" data-num>${durs.sort((a,b)=>a-b).map(d=>`<option value="${d}" ${Number(t.minutes)===d?"selected":""}>${d<60?d+" Min.":(d/60).toString().replace(".",",")+" Std."}</option>`).join("")}</select></label></div>
   <div class="q"><span class="ql">Bei</span><div class="chips">${resChips}</div></div>
   <div class="freeslots"><h4>Freie Termine <small class="muted">${esc(String(t.minutes))} Min. · ${esc(resLabel(t.res))} · zu den Öffnungszeiten</small></h4>
    ${(AK.meta.resources||[]).some(x=>x.type!=="Employee")&&(AK.meta.resources.find(x=>x.id===t.res)||{}).type==="Employee"?`<div class="chips" style="margin-bottom:8px"><button type="button" class="chip" data-tfroom aria-pressed="${t.room!==false}">${esc((AK.meta.resources.filter(x=>x.type!=="Employee").map(x=>x.name)).join(" / "))} muss frei sein</button></div>`:""}${slotsHtml()}</div>
   <div class="form">${inp("tf.note","Notiz für AkuWin","text","z. B. Erstanpassung, Hörsysteme mitbringen","full")}</div>
   <div class="nav2"><span class="muted">Freie Zeit oben antippen – oder Datum/Uhrzeit eintragen und vormerken.</span><button class="btn" data-tfreserve>+ Vormerken</button></div>
   ${plan().length?`<div class="tplanned"><h4>Vorgemerkt <small class="muted">${plan().length} · noch nicht in AkuWin</small></h4>
    ${plan().map((p,i)=>`<div class="trow"><span class="tdot" style="background:${esc(p.color||"#E6EEEA")}"></span><b>${esc(termDate(p.date+"T"))}</b><span>${p.time} Uhr · ${p.minutes} Min.</span><span>${esc(p.type)} <small class="muted">· ${inDays(p.date)}</small></span><span class="muted">${esc(resLabel(p.res))} <button type="button" class="delx sm" data-tfunplan="${i}" aria-label="Vormerkung entfernen">×</button></span></div>`).join("")}
    <div class="nav2"><span class="muted">Mit dem Kunden abstimmen – nach seinem OK werden alle vorgemerkten Termine in AkuWin eingetragen.</span><button class="btn primary" data-tfcreate ${AK.creating?"disabled":""}>${AK.creating?"Wird angelegt …":plan().length===1?"Termin in AkuWin anlegen":"Alle "+plan().length+" Termine in AkuWin anlegen"}</button></div></div>`:""}</div>`);
}
/* Vormerken: mehrere Termine sammeln, nach OK des Kunden gesammelt in AkuWin anlegen */
const plan=()=>S.tfPlan||(S.tfPlan=[]);
const offOf=d=>{const o=-d.getTimezoneOffset();return (o>=0?"+":"-")+String(Math.floor(Math.abs(o)/60)).padStart(2,"0")+":"+String(Math.abs(o)%60).padStart(2,"0")};
const inDays=day=>{const a=new Date();a.setHours(12,0,0,0);const b=new Date(day+"T12:00");const n=Math.round((b-a)/864e5);return n===0?"heute":n===1?"morgen":"in "+n+" Tagen"};
function tfReserve(date,time){
 const t=tfDefaults(),m=AK.meta,ty=m.types.find(x=>x.id===t.typeId);
 if(!ty){toast("Bitte einen Termintyp wählen");return}
 const d=date||t.date,tm=time||t.time;if(!d||!tm){toast("Bitte Datum und Uhrzeit wählen");return}
 if(new Date(d+"T"+tm+":00")<new Date()){toast("Der Termin liegt in der Vergangenheit");return}
 const i=plan().findIndex(p=>p.date===d&&p.time===tm&&p.res===t.res);
 if(i>=0){plan().splice(i,1);changed();rr();return}
 plan().push({date:d,time:tm,typeId:ty.id,type:ty.name,color:ty.color,minutes:Number(t.minutes),res:t.res,note:t.note||""});
 plan().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));changed();rr();
}
async function tfCreateAll(){
 const P=plan();if(!P.length)return;
 const lines=P.map(p=>`• ${new Date(p.date+"T12:00").toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit"})} ${p.time} Uhr – ${p.type} (${p.minutes} Min.) bei ${resLabel(p.res)}`).join("\n");
 if(!await H().ask(P.length===1?"Termin in AkuWin anlegen?":P.length+" Termine in AkuWin anlegen?",`Für ${name()}:\n${lines}`,"Anlegen"))return;
 AK.creating=true;rr();const fail=[];let ok=0;
 for(const p of P.slice()){
  const local=new Date(p.date+"T"+p.time+":00");
  try{await akInvoke({action:"createAppointment",clientId:S.kunde.akuwinId,typeId:p.typeId,start:p.date+"T"+p.time+":00"+offOf(local),minutes:p.minutes,resourceIds:[p.res],note:p.note});
   ok++;S.tfPlan=plan().filter(x=>x!==p);
  }catch(e){fail.push(`${p.date} ${p.time}: ${e.message}`)}
 }
 AK.creating=false;AK.busy=null;changed();await akUpcoming(true);window.HD_KALENDER&&window.HD_KALENDER.load(true);
 if(fail.length)await H().ask(ok?`${ok} angelegt, ${fail.length} nicht`:"Termine nicht angelegt",fail.join("\n"),"OK",true);
 else toast(ok===1?"Termin in AkuWin angelegt":ok+" Termine in AkuWin angelegt");
}
function stepKunde(){
 const k="kunde";
 return akCard()+card("Kunde",`<div class="q"><span class="ql">Anrede</span>${chips(k+".anrede",["Frau","Herr","neutral"])}</div><div class="form">${inp(k+".vorname","Vorname")}${inp(k+".nachname","Nachname")}${inp(k+".geb","Geburtsdatum","date")}${inp(k+".tel","Telefon","tel")}${inp(k+".mail","E-Mail","email","","full")}</div>`)+
 card("Krankenversicherung",`<div class="q"><span class="ql">Versicherung</span><div class="chips"><button type="button" class="chip" data-set="kunde.kasse" data-v="gkv" aria-pressed="${S.kunde.kasse==="gkv"}">Gesetzlich</button><button type="button" class="chip" data-set="kunde.kasse" data-v="privat" aria-pressed="${S.kunde.kasse==="privat"}">Privat</button></div></div>
  <div class="form">${inp(k+".kk","Krankenkasse","text","z. B. AOK, TK, Barmer","full")}</div>
  ${yn(k+".verordnung","Ärztliche Verordnung liegt vor",`<div class="form">${inp(k+".vdatum","Datum der Verordnung","date")}${inp(k+".hno","HNO-Arzt")}</div>`)}`)+
 card("Versorgung",`<div class="q"><span class="ql">Art</span>${chips("kunde.versorgung",["erst","Folgeversorgung"]).replace(">erst<",">Erstversorgung<")}</div>
`);
}
/* Frage mit Auswahl + Freitext "Sonstiges" (falls nichts passt) */
const qs=(label,p,opts,multi=false)=>`<div class="q"><span class="ql">${label}</span><div class="qwrap">${chips(p,opts,multi)}<input class="sonst" data-in="${p}Sonst" value="${esc(get(p+"Sonst")||"")}" placeholder="Sonstiges …" aria-label="${esc(label)} – Sonstiges"></div></div>`;
function stepAnamnese(){
 const a="an";
 const f=flags();
 return (f.length?`<div class="flag"><b>Ärztliche Abklärung empfehlen</b><span>${f.map(esc).join(" · ")}</span><small>Nur für dich sichtbar – erscheint nicht in der Kundenansicht oder Broschüre.</small></div>`:"")+
 card("Hörverlust",qs("Seit wann?",a+".seit",["weniger als 3 Monate","unter 1 Jahr","1–3 Jahre","3–5 Jahre","5–10 Jahre","über 10 Jahre"])+
  qs("Verlauf",a+".verlauf",["schleichend","plötzlich","schwankend"])+
  qs("Seite",a+".seite",["beidseitig","einseitig rechts","einseitig links"])+
  qs("Wer hat es bemerkt?",a+".bemerkt",["selbst","Angehörige","Arzt / Hörtest"]))+
 card("Ereignisse am Ohr",yn(a+".hoersturz","Hörsturz",qs("Wann?",a+".hsWann",["in den letzten 3 Monaten","vor 3–12 Monaten","länger her"])+qs("Seite",a+".hsSeite",["rechts","links","beidseitig"]))+
  yn(a+".laerm","Lärm- oder Knalltrauma, Lärmbelastung",qs("Art",a+".laermArt",["Knalltrauma","beruflich","Jagd / Schießsport","Musik / Konzerte","Maschinen / Werkzeug"],true))+
  qs("Entzündungen & Befunde",a+".entz",["Mittelohrentzündung akut","Mittelohrentzündung chronisch","Gehörgangsentzündung","Trommelfellperforation","Cholesteatom","Otosklerose"],true)+
  qs("Operationen am Ohr",a+".ops",["Paukenröhrchen","Tympanoplastik","Stapesplastik","Mastoidektomie","Cochlea-Implantat","BAHA"],true)+
  `<div class="form">${inp(a+".ereignisSonst","Sonstige Ereignisse am Ohr","text","z. B. Unfall, Barotrauma, Fremdkörper","full")}</div>`)+
 card("Otoskopie",`<p class="muted">Befund je Ohr – mehrere Angaben möglich.</p><div class="ears2">${["R","L"].map(e=>`<div><h4 class="ear ${e}">${e==="R"?"Rechtes Ohr":"Linkes Ohr"}</h4>
   ${qs("Gehörgang",a+".oto"+e+"G",["frei, reizlos","Cerumen wenig","Cerumen viel","Cerumen obturierend","gerötet / entzündet","Schwellung","Ekzem / trockene Haut","Exostosen","Fremdkörper","eng / gewunden"],true)}
   ${qs("Trommelfell",a+".oto"+e+"T",["intakt, reizlos","nicht einsehbar","getrübt","retrahiert","gerötet","vorgewölbt","Narben / Kalk","Perforation","Paukenröhrchen"],true)}
   ${qs("Abformung",a+".oto"+e+"A",["möglich","erst nach Reinigung","nicht möglich"])}</div>`).join("")}</div>`)+
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
 const lock=!!(S.audioSrc&&S.audioSrc.from==="AkuWin");
 const row=e=>`<tr><th><span class="ear ${e}">${e==="R"?"Rechts ○":"Links ×"}</span></th>${FREQ.map(f=>`<td><input inputmode="numeric" data-aud="${e}.${f}" value="${esc(S.audio[e][f]??"")}" aria-label="${e==="R"?"Rechts":"Links"} ${f} Hz" ${lock?"readonly tabindex=\"-1\"":""}></td>`).join("")}</tr>`;
 const dR=degree(pta("R")),dL=degree(pta("L"));
 return card("Tonaudiogramm",`<div class="audtop">${S.kunde.akuwinId?`<button class="btn primary" data-akload ${AK.audLoading?"disabled":""}>${AK.audLoading?"Lädt …":"Aus AkuWin laden"}</button>`:`<button class="btn" data-step="0">Aus AkuWin laden</button>`}<span class="muted">${S.audioSrc?`<b class="aklock">🔒 Aus AkuWin · Messung vom ${esc(fmtD(S.audioSrc.date))} · nicht veränderbar</b>`:S.kunde.akuwinId?"Werte in dB HL eintragen oder aus AkuWin laden.":"Erst in Schritt 1 den Kunden aus AkuWin übernehmen – oder Werte in dB HL eintragen."}</span></div>
  ${AK.audios&&AK.audios.length>1?`<div class="q"><span class="ql">Messungen in AkuWin</span><div class="chips">${AK.audios.map(a=>`<button type="button" class="chip" data-akaud="${esc(a.guid)}" aria-pressed="${S.audioSrc&&S.audioSrc.guid===a.guid}">${esc(fmtD(a.date))}</button>`).join("")}</div></div>`:""}
  <div class="scroll"><table class="audt${lock?" locked":""}"><thead><tr><th></th>${FREQ.map(f=>`<th>${f>=1000?f/1000+" kHz":f+" Hz"}</th>`).join("")}</tr></thead><tbody>${row("R")}${row("L")}</tbody></table></div>
  <div id="audchart">${audioPair()}</div>
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
/* Leistungstreppe: jede Stufe zeigt, was neu dazukommt */
function treppe(si,recIdx,pick){
 const gkv=S.kunde.kasse==="gkv";
 return `<div class="treppe${pick?" pick":""}">${STAGES.map((s,i)=>{const f=stageFrom(s.id),on=i===si,tag=pick?"button":"div";
  const plus=i===0&&gkv?[...plusOf(s),"Zuzahlungsfrei"]:plusOf(s);
  return `<${tag} ${pick?`type="button" data-stage="${i}" aria-pressed="${on}"`:""} class="tstep${on?" on":""}" style="--h:${370+i*34}px">
   <span class="ttop"><span class="tnum">${i+1}</span>${i===recIdx?'<span class="ttag">Empfehlung</span>':""}</span>
   <b>${s.name}</b><small>${esc(s.sub)}</small><i></i><em>${i===0?"Das ist dabei":"Neu"}</em>
   <ul>${plus.map(t=>`<li>${esc(t)}</li>`).join("")}</ul>
   <span class="tprice">${s.id==="basis"?"Kassenleistung":"ab "+eur(gkv?f.gkv:f.vk)}<small>${s.id==="basis"?(gkv?"zuzahlungsfrei":"je Seite"):gkv?"Eigenanteil je Seite":"je Seite"}</small></span></${tag}>`}).join("")}</div>
 <div class="tfoot"><span>Automatik: einfach</span><i></i><span>passt sich ganz von selbst an</span></div>
 <p class="muted tnote">Jede Stufe kann alles der vorherigen – und mehr. Welche Funktionen genau enthalten sind, hängt von Hersteller, Modell und Bauform ab; sehr kleine Im-Ohr-Geräte haben z. B. kein Bluetooth-Streaming.</p>`;
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
 ${card("Unsere Technikstufen",`${treppe(si,rec.idx,true)}${S.override!==""?`<button type="button" class="linkbtn" data-stage="reset">Zurück zum Vorschlag (${STAGES[rec.idx].name})</button>`:""}`)}
 <div class="grid2"><div>
  ${card("Warum diese Stufe?",`<ul class="why">${rec.reasons.length?rec.reasons.map(r=>`<li>${r}</li>`).join(""):"<li>Keine besonderen Schwierigkeiten angegeben – Basis reicht aus.</li>"}</ul>${rec.notes.length?`<div class="notes">${rec.notes.map(n=>`<span>• ${esc(n)}</span>`).join("")}</div>`:""}`)}
  ${card("Passende Geräte",devs.length?`<div class="devs">${devs.map(d=>`<button type="button" class="dev" data-dev="${d.id}" aria-pressed="${d.id===S.device}"><b>${esc(d.m)} ${esc(d.model)}</b><small>${esc(d.form)} · ${esc(d.power)} · ${band(d.ek)[0]}</small></button>`).join("")}</div><p class="muted">Geräte aus deinem Preistool.</p>`:'<p class="muted">Für diese Stufe ist noch kein Gerät im Preistool angelegt. <button type="button" class="linkbtn" data-goto="preise">Zum Preistool</button></p>')}
 </div>
 <aside class="aside">${q?`<h3>Preisorientierung</h3><span class="note">${S.kunde.kasse==="gkv"?"Gesetzlich versichert":"Privat versichert"} · ${count===2?"beidseitig":"eine Seite"}</span>
  <div class="pseg"><button data-otos="0" aria-pressed="${otos===0}">ohne Otoplastik</button><button data-otos="${count}" aria-pressed="${otos===count}">${count} Otoplastik${count>1?"en":""}</button></div>
  <div class="plines">${q.lines.map(l=>`<div><span>${esc(l[0])}</span><b>${eur(l[1])}</b></div>`).join("")}<div class="ptotal"><span>${S.kunde.kasse==="gkv"?"Eigenanteil":"Gesamt"}</span><b>${eur(q.total)}</b></div></div>
  <small class="note">Unverbindliche Preisorientierung. Der endgültige Preis richtet sich nach der gewählten Versorgung und wird in einem Kostenvoranschlag festgehalten.</small>
  <button class="btn light" data-cust>Dem Kunden zeigen</button>`:'<h3>Preisorientierung</h3><span class="note">Bitte ein Gerät wählen.</span>'}</aside></div>`;
}
/* Eigene Aufgabe mit Kundenbezug */
function freeTaskForm(){
 const f=S.ft||(S.ft={});if(!f.due){const d=new Date();d.setDate(d.getDate()+1);f.due=isoD(d)}if(f.who===undefined)f.who=H().me?.id||"";if(!f.cat)f.cat="Rückruf";
 const cats=(H().cats||[]).map(([g,cs])=>`<optgroup label="${esc(g)}">${cs.map(c=>`<option ${f.cat===c?"selected":""}>${esc(c)}</option>`).join("")}</optgroup>`).join("");
 return `<div class="ftask"><h4>Eigene Aufgabe</h4>
  <div class="form ftgrid"><label class="full">Aufgabe<input data-in="ft.title" value="${esc(f.title||"")}" placeholder="z. B. Hörsystem beim Hersteller bestellen" maxlength="160"></label>
   <label>Kategorie<select data-in="ft.cat">${cats}</select></label>
   <label>Zuständig<select data-in="ft.who"><option value="">– niemand –</option>${H().team().map(m=>`<option value="${esc(m.id)}" ${f.who===m.id?"selected":""}>${esc(m.name)}</option>`).join("")}</select></label>
   <label>Fällig<input type="date" data-in="ft.due" value="${esc(f.due)}"></label>
   <label class="full">Notiz<input data-in="ft.notes" value="${esc(f.notes||"")}" placeholder="optional"></label></div>
  <div class="nav2"><div class="chips"><button type="button" class="chip" data-ftprio aria-pressed="${f.prio==="hoch"}">Dringend</button></div><span class="muted">Wird mit ${esc(name())}${S.kunde.tel?" ("+esc(S.kunde.tel)+")":""} verknüpft.</span><button type="button" class="btn primary" data-ftcreate>+ Aufgabe anlegen</button></div></div>`;
}
async function freeTaskCreate(){
 const f=S.ft||{};const title=(f.title||"").trim();
 if(!title){toast("Bitte die Aufgabe beschreiben");const i=document.querySelector('[data-in="ft.title"]');if(i)i.focus();return}
 const ok=await createTask("free-"+uid(),title,f.cat||"Sonstiges",{assignee:f.who||"",due:f.due,priority:f.prio==="hoch"?"hoch":"normal",notes:(f.notes||"").trim()});
 if(ok!==false){S.ft={cat:f.cat,who:f.who,due:f.due};changed();rr()}
}
function stepAbschluss(){
 const dev=DEVICES.find(d=>d.id===S.device),count=ears(),n=name();
 const quick=[["reserve","Gerät vorreservieren",`Gerät vorreservieren: ${dev?dev.m+" "+dev.model:"Stufe "+STAGES[curStage()].name}${count===2?" beidseitig":""} – ${n}`,"Reservierung"],
  ["kv","Kostenvoranschlag an Kasse",`Kostenvoranschlag an ${S.kunde.kk||"Krankenkasse"} – ${n}`,"Krankenkasse"],
  ["call","Rückruf vereinbaren",`Rückruf: Rückfragen zur Beratung – ${n}`,"Rückruf"],
  ["fit","Anpasstermin vorbereiten",`Anpassung vorbereiten – ${n}`,"Anpassung"]];
 return (S.oto.sent?`<div class="okbox"><b>Laborauftrag gesendet</b><span>Otoplastik für ${esc(n)} steht im Labor-Reiter der Aufgaben – Schritt 1: Abformung reinigen.</span></div>`:"")+card("Aufgaben direkt anlegen",`<p class="muted">Ein Klick legt die Aufgabe in der Aufgaben-App an – mit Kunde, Telefon und Gerät verknüpft.</p>
  <div class="quick">${quick.map(([id,l,t,c])=>{const done=S.tasks.find(x=>x.id===id);return `<button type="button" class="qbtn" data-task="${id}" data-title="${esc(t)}" data-cat="${c}" ${done?"disabled":""}>${done?"✓ ":"+ "}${l}</button>`}).join("")}</div>
  ${freeTaskForm()}
  ${S.tasks.length?`<div class="tlist">${S.tasks.map(t=>`<div><span class="tile t-kunden">✓</span><div><b>${esc(t.title)}</b><small>${esc(t.cat)} · fällig ${esc(t.due)}${t.who?" · "+esc(t.who):""} · erscheint in „Aufgaben“</small></div></div>`).join("")}</div>`:""}`)+
 termineCard()+
 card("Broschüre für den Kunden",`<div class="brochure"><div class="bthumb"><span>Hörakustik Daugsch</span><b>Ihre persönliche Hörberatung</b><small>${esc(n)}</small></div>
  <div><p>Die Broschüre fasst alles zusammen: Hörsituation, Audiogramm, Hörprofil, Wünsche und Hörziele, Empfehlung mit Leistungsprofil, Preisorientierung und die Übersicht aller sechs Technikstufen – gestaltet für den Druck auf A4.</p>
  <button class="btn primary" data-brochure>Broschüre erstellen</button></div></div>`)+card("Beratung abschließen",`<p class="muted">${S.status==="abgeschlossen"?"Diese Beratung ist abgeschlossen.":"Alles wird laufend gespeichert. Mit „Abschließen“ markierst du die Beratung als fertig."}</p><button class="btn ${S.status==="abgeschlossen"?"":"primary"}" data-finish>${S.status==="abgeschlossen"?"Wieder öffnen":"Beratung abschließen"}</button>`);
}


// Otoplastik-Auswahllisten und Laborschritte kommen aus dem Labor-Modul (eine Quelle für beide)
const OOPT=window.HD_LABOR.OPT;
const LSTEPS=window.HD_LABOR.STEPS.map(x=>x.t);
function earOto(side){return window.HD_LABOR.specFields("oto."+side,get,{in:"data-in",chk:"data-chk",tog:"data-tog",ctx:"ber"})}
function stepOto(){
 const o=S.oto,dev=DEVICES.find(d=>d.id===S.device);
 if(!o.sides){const c=ears();const r=pta("R"),l=pta("L");o.sides=c===2?"beide":r!=null&&r>25?"rechts":"links"}
 const anb=dev?(/^RIC/.test(dev.form)?"RIC / Ex-Hörer":/^(IdO|CIC)/.test(dev.form)?"":"HdO mit Schlauch"):"";["R","L"].forEach(k=>{if(!o[k].anbindung&&anb)o[k].anbindung=anb});
 const both=o.sides==="beide",two=both&&!o.same;
 const head=card("Wird eine Otoplastik benötigt?",`<div class="q"><span class="ql">Otoplastik</span>${chips("oto.needed",["ja","nein","noch offen"])}</div>${dev?`<p class="muted">Gewähltes Gerät: ${esc(dev.m)} ${esc(dev.model)} (${esc(dev.form)})${dev.oto?" – laut Preistool ist hier in der Regel eine Otoplastik nötig.":""}</p>`:""}`);
 if(o.needed!=="ja")return head;
 if(o.sent)return head+`<div class="okbox"><b>Ans Labor gesendet</b><span>Der Auftrag steht jetzt im Labor-Reiter der Aufgaben-App und startet mit Schritt 1.</span>
  <ol class="mtrack">${LSTEPS.map((t,i)=>`<li class="${i===0?"now":""}"><i>${i+1}</i><small>${t}</small></li>`).join("")}</ol><button class="linkbtn" data-goto="labor">Im Labor ansehen</button></div>`;
 return head+card("Abformung",`<div class="ospec">${inp("oto.abformung.datum","Abgeformt am","date")}${inp("oto.due","Nächster Anpasstermin","date")}
   <label>Qualität<select data-in="oto.abformung.qualitaet"><option value="">– bitte wählen –</option>${OOPT.qualitaet.map(o=>`<option ${S.oto.abformung.qualitaet===o?"selected":""}>${o}</option>`).join("")}</select></label>
   ${inp("oto.abformung.besonderheiten","Besonderheiten","text","z. B. enger 2. Knick, Exostose rechts","wide")}</div>`)+
 card("Spezifikation",`<div class="q"><span class="ql">Seite</span>${chips("oto.sides",["rechts","links","beide"])}</div>
  ${both?`<div class="q"><span class="ql">Ausführung</span><div class="chips"><button type="button" class="chip" data-otosame="1" aria-pressed="${o.same}">Beide Seiten gleich</button><button type="button" class="chip" data-otosame="0" aria-pressed="${!o.same}">Seiten unterschiedlich</button></div></div>`:""}
  ${two?`<div class="ears2"><div><h4 class="ear R">Rechts</h4>${earOto("R")}</div><div><h4 class="ear L">Links</h4>${earOto("L")}</div></div>`:earOto(o.sides==="links"?"L":"R")}
  <div class="form">${ta("oto.notes","Hinweise fürs Labor","z. B. Kunde wünscht diskrete Farbe")}</div>
  <div class="q"><span class="ql">Wer macht den ersten Schritt?</span>${window.HD_LABOR?window.HD_LABOR.whoChips(o.assignee===undefined?H().me?.id:o.assignee,"data-otowho"):""}</div>
  <div class="nav2"><span class="muted">Der Auftrag erscheint im Labor (${LSTEPS.join(" → ")}) und als Eingangsmeldung („Otoplastik-Auftrag im Labor eingegangen“) bei der Person, die den ersten Schritt macht.</span><button class="btn primary" data-otosend>Auftrag ans Labor senden</button></div>`);
}
/* ---------- Kundenansicht ---------- */
function customerView(){
 const rec=recommend(),st=STAGES[curStage()],tabs=["Ihr Hörprofil","Ihr Audiogramm","Unsere Empfehlung","Alle Technikstufen"];
 const hard=SITS.filter(s=>S.sit[s.id]&&S.sit[s.id].d>=2);
 const body=custTab===0?`<div class="cgrid">${DIMS.map((d,i)=>`<div class="cbox"><span>${d==="Ruhe"?"In ruhiger Umgebung":d==="Gruppe"?"Gespräche mit mehreren":"In lebhafter Umgebung"}</span>${dots(rec.n[i],"#B8452F")}<small>${["kaum Unterstützung nötig","etwas Unterstützung","spürbare Unterstützung","viel Unterstützung","sehr viel Unterstützung"][rec.n[i]-1]}</small></div>`).join("")}</div>
   <h3>Hier fällt Ihnen das Hören schwer</h3><div class="chips big">${hard.map(s=>`<span class="chip on">${esc(s.t)}</span>`).join("")||"<span>–</span>"}</div>
   <h3>Ihre Hörziele</h3><ol class="cgoals">${S.ziele.filter(z=>z.t).sort((a,b)=>a.p-b.p).map(z=>`<li>${esc(z.t)}</li>`).join("")}</ol>`
 :custTab===1?`<div class="caud">${audioPair(true)}<p class="muted">Die grüne Fläche zeigt, wo Sprache liegt. Alles, was unterhalb Ihrer Hörkurve liegt, können Sie hören – Laute darüber gehen verloren.</p></div>`
 :custTab===2?`<div class="crec"><span class="pnum big">${stageIdx(st.id)+1}</span><div><h2>${st.name}</h2><p>${esc(st.sub)}</p><p class="muted">Ideal für ${esc(st.ideal)}</p></div></div>
   <div class="cgrid">${DIMS.map((d,i)=>`<div class="cbox"><span>${d}</span><small>Ihr Bedarf</small>${dots(rec.n[i],"#B8452F")}<small>${st.name}</small>${dots(st.p[i])}</div>`).join("")}</div>`
 :`<h2 class="ctitle">Jede Stufe kann alles der vorherigen – und mehr</h2>${treppe(STAGES.indexOf(st),rec.idx,false)}`;
 return `<div class="cust"><header><img class="clogo" src="img/logo.png" alt="Hörakustik Daugsch"><span class="muted">Ihre persönliche Hörberatung · ${esc(name())}</span>${KUNDE?"":`<button class="btn" data-custclose>Zurück zur Beratung</button>`}</header>
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
 AK.q="";AK.res=null;AK.audios=null;AK.upcoming=null;cid=id;mode="edit";step=0;customer=false;H().rerender();window.scrollTo(0,0);
}
async function delConsultation(id){
 const x=(list||[]).find(c=>c.id===id),n=x&&x.customer_name||"ohne Namen";
 if(!await H().ask("Beratung löschen?",`Die Beratung „${n}“ wird endgültig gelöscht und lässt sich nicht wiederherstellen. Aufgaben und Laboraufträge daraus bleiben erhalten.`))return;
 const{error}=await H().sb.from("consultations").delete().eq("id",id);
 if(error){toast("Löschen fehlgeschlagen: "+error.message);return}
 list=list.filter(c=>c.id!==id);H().rerender();toast("Beratung gelöscht");
}
function newConsultation(){AK.q="";AK.res=null;AK.audios=null;AK.upcoming=null;S=empty();cid=uid();mode="edit";step=0;customer=false;dirty=false;H().rerender();window.scrollTo(0,0)}

/* ---------- Aufgaben & Labor ---------- */
async function createTask(kind,title,cat,opt={}){
 const dev=DEVICES.find(d=>d.id===S.device);let due=new Date();due.setDate(due.getDate()+(kind==="call"?2:1));if(opt.due)due=new Date(opt.due+"T12:00");
 const assignee=opt.assignee!==undefined?opt.assignee||"":H().me?.id||"";
 // über die zentrale Speicherfunktion der Aufgaben-App: erscheint sofort in der Liste und wird live verteilt
 const t={id:uid(),title,category:cat,assignee,due:isoD(due),priority:opt.priority||"normal",status:"offen",customer:name(),phone:S.kunde.tel||"",
  manufacturer:kind==="reserve"&&dev?dev.m:"",model:kind==="reserve"&&dev?dev.model:"",notes:[opt.notes,`Aus der Beratung vom ${new Date().toLocaleDateString("de-DE")}`].filter(Boolean).join(" · "),consultationId:cid,akuwinId:S.kunde.akuwinId||null,createdAt:Date.now()};
 const ok=await H().saveTask(t,null);
 if(!ok){toast("Aufgabe nicht angelegt");return false}
 S.tasks.push({id:kind,title,cat,taskId:t.id,who:opt.assignee!==undefined?(H().team().find(m=>m.id===assignee)||{}).name||"":"",due:due.toLocaleDateString("de-DE",{weekday:"short",day:"numeric",month:"short"})});toast("Aufgabe angelegt");changed();H().rerender();
 return true;
}
async function sendLab(){
 const o=S.oto;if(!name()||name()==="Neuer Kunde"){toast("Bitte zuerst den Kundennamen eintragen");step=0;H().rerender();return}
 const same=o.sides!=="beide"||o.same,spec={same,R:o.sides==="links"&&same?o.L&&o.L.form?o.L:o.R:o.R,L:same?o.R:o.L,abformung:o.abformung};
 const me=H().team().find(t=>t.id===H().me?.id)?.name||"";
 const lab={id:uid(),akuwin_id:S.kunde.akuwinId||null,assignee:(o.assignee===undefined?H().me?.id:o.assignee)||null,customer:name(),phone:S.kunde.tel||null,consultation_id:cid,sides:o.sides||"beide",spec,stage:0,history:[{step:0,dir:0,at:new Date().toISOString(),by:me}],due:o.due||null,urgent:false,notes:o.notes||null};
 let{error}=await H().sb.from("lab_orders").insert(lab);
 if(error&&/assignee|akuwin_id/.test(error.message||"")){const l={...lab};delete l.assignee;delete l.akuwin_id;({error}=await H().sb.from("lab_orders").insert(l))}
 if(error){toast("Laborauftrag nicht gesendet: "+error.message);return}
 window.HD_LABOR&&window.HD_LABOR.syncTask(lab);
 o.sent=true;o.labId=lab.id;toast(lab.assignee?"Auftrag ist im Labor – Aufgabe angelegt":"Auftrag ist im Labor");changed();H().rerender();window.HD_LABOR&&window.HD_LABOR.load();
}

/* ---------- Kundenfenster ---------- */
function pushCustomer(){if(!bc||KUNDE)return;const prices={};STAGES.forEach(s=>prices[s.id]=stageFrom(s.id));const plus={};STAGES.forEach(s=>plus[s.id]=plusOf(s));bc.postMessage({type:"state",S,custTab,prices,plus,stage:curStage()})}
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
  <div class="body"><span class="title">${esc(x.customer_name||"Ohne Namen")}</span><div class="meta"><span>${new Date(x.updated_at||x.created_at).toLocaleDateString("de-DE",{day:"numeric",month:"short",year:"numeric"})}</span>${x.customer_phone?`<span>${esc(x.customer_phone)}</span>`:""}<span class="tag work">${esc(STAGE_NAME(x.stage_final))}</span>${x.status==="abgeschlossen"?'<span class="tag">abgeschlossen</span>':'<span class="tag wait">offen</span>'}</div></div><button class="delx" data-bdel="${esc(x.id)}" aria-label="Beratung ${esc(x.customer_name||"")} löschen" title="Beratung löschen">×</button></article>`).join("")}</section>`
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


/* ---------- Broschüre (A4, Druck / PDF) ---------- */
const FIRMA={name:"Hörakustik Daugsch",claim:"natürlich · individuell · hören",person:"Guido Daugsch",rolle:"Geschäftsführer & Inhaber · Hörakustikmeister",
 str:"Ludwig-Schwamb-Straße 19",ort:"67574 Osthofen",tel:"06242 50 69 744",mail:"hallo@hoerakustik-daugsch.de",web:"www.hoerakustik-daugsch.de",
 zeiten:[["Montag, Dienstag, Donnerstag","10 – 17 Uhr"],["Mittwoch, Freitag","10 – 14 Uhr"]]};
const TECH=[
 ["Richtmikrofone","Zwei Mikrofone je Gerät erkennen, aus welcher Richtung Sprache kommt, und heben Ihr Gegenüber hervor – Geräusche von hinten treten in den Hintergrund."],
 ["Störgeräuschunterdrückung","Gleichmäßige Geräusche wie Lüftung, Motor oder Stimmengewirr werden gedämpft, Sprache bleibt klar."],
 ["Automatische Situationserkennung","Das Hörsystem erkennt laufend, wo Sie sind – ruhiges Wohnzimmer, Restaurant, Straße – und stellt sich selbst passend ein."],
 ["Sprachfokus & Bewegung","Höhere Stufen erkennen mehrere Sprecher und sogar Ihre Bewegung, etwa beim Gehen, und passen den Fokus an."],
 ["Rückkopplungsschutz","Verhindert das bekannte Pfeifen, auch beim Umarmen oder Telefonieren."],
 ["Bluetooth-Streaming","Telefonate, Musik und Fernsehton kommen direkt in beide Ohren – je nach Gerät auch freihändig telefonieren."],
 ["App-Steuerung","Lautstärke und Programme bequem am Smartphone einstellen, Klang an Ihre Vorlieben anpassen."],
 ["Akku","Über Nacht im Ladeetui aufladen – kein Batteriewechsel, ein ganzer Tag Hören."],
 ["Tinnitus-Funktion","Ein sanftes, einstellbares Rauschen kann Ohrgeräusche überdecken und entlasten."],
 ["Bauformen","Hinter dem Ohr mit Hörer im Gehörgang (RIC), klassisch hinter dem Ohr (HdO) oder individuell im Ohr (IdO) – je nach Hörverlust, Ohr und Wunsch."]];
const NEXT=[["Probetragen","Sie testen Ihre Hörsysteme in Ihrem Alltag – zu Hause, unterwegs, im Gespräch."],["Feinanpassung","Gemeinsam stimmen wir den Klang auf Ihre Erfahrungen und Ihre Hörziele ab."],["Hörziele prüfen","Wir prüfen Ziel für Ziel, wie gut es sich verbessert hat – und optimieren weiter."],["Versorgung & Nachsorge","Sie entscheiden sich, wir kümmern uns um die Kasse. Danach sind wir regelmäßig für Service und Kontrolle für Sie da."]];
const salut=()=>{const k=S.kunde,n=[k.vorname,k.nachname].filter(Boolean).join(" ");return k.anrede==="Herr"?`Lieber Herr ${k.nachname||n}`:k.anrede==="Frau"?`Liebe Frau ${k.nachname||n}`:`Guten Tag ${n||""}`.trim()};
function friendlySituation(){
 const a=S.an,parts=[];
 if(a.seit)parts.push(`Ihr Hörverlust besteht seit ${a.seit==="weniger als 3 Monate"?"weniger als drei Monaten":a.seit.replace("unter","weniger als").replace("über","mehr als")}`);
 if(a.verlauf)parts.push(`er hat sich ${a.verlauf==="schleichend"?"schleichend entwickelt":a.verlauf==="plötzlich"?"plötzlich bemerkbar gemacht":"schwankend gezeigt"}`);
 let s=parts.join(" – ");if(a.seite)s+=(s?" und betrifft ":"Ihr Hörverlust betrifft ")+(a.seite==="beidseitig"?"beide Ohren":a.seite==="einseitig rechts"?"vor allem das rechte Ohr":"vor allem das linke Ohr");if(s)s+=".";
 const out=[s];
 if(a.bemerkt)out.push(a.bemerkt==="Angehörige"?"Zuerst aufgefallen ist er Ihren Angehörigen – das ist sehr typisch, denn ein Hörverlust entwickelt sich oft unbemerkt.":a.bemerkt==="selbst"?"Sie haben die Veränderung selbst bemerkt.":"Festgestellt wurde er bei einer ärztlichen Untersuchung bzw. einem Hörtest.");
 if(a.tinn==="ja")out.push(`Zusätzlich nehmen Sie ein Ohrgeräusch wahr${a.tinnArt?" („"+a.tinnArt+"“)":""}${a.tinnSeite?", "+(a.tinnSeite==="beidseitig"?"auf beiden Seiten":a.tinnSeite==="im Kopf"?"im Kopf":"auf der "+a.tinnSeite+"n Seite"):""}. Moderne Hörsysteme können hier spürbar entlasten.`);
 if(a.laerm==="ja")out.push("Ihr Gehör war in der Vergangenheit Lärm ausgesetzt – ein häufiger Grund für Hörverluste im Bereich hoher Töne, in dem viele Sprachlaute liegen.");
 if(a.hgAlt==="ja")out.push(`Sie haben bereits Erfahrung mit Hörgeräten${a.hgModell?" ("+a.hgModell+")":""} – darauf bauen wir auf.`);else if(a.hgAlt==="nein")out.push("Es ist Ihre erste Versorgung mit Hörsystemen. Wir begleiten Sie Schritt für Schritt.");
 return out.filter(Boolean);
}
function brochureHtml(){
 refreshDevices();
 const rec=recommend(),si=curStage(),st=STAGES[si],count=ears(),gkv=S.kunde.kasse==="gkv";
 const dev=DEVICES.find(d=>d.id===S.device),otos=S.otos<0?(dev&&dev.oto?count:0):S.otos,q=dev?quote(dev,count,otos):null;
 const date=new Date().toLocaleDateString("de-DE",{day:"numeric",month:"long",year:"numeric"}),nm=name();
 const base=location.href.split("#")[0].replace(/[^/]*$/,"");
 const dotsB=(n,c)=>`<span class="d">${[1,2,3,4,5].map(i=>`<i style="background:${i<=n?c:"#E1E9E6"}"></i>`).join("")}</span>`;
 const hard=SITS.filter(s=>S.sit[s.id]&&S.sit[s.id].d>0).sort((a,b)=>S.sit[b.id].d-S.sit[a.id].d||((S.sit[b.id].i??1)-(S.sit[a.id].i??1)));
 const dimTxt=["In ruhiger Umgebung","Bei Gesprächen mit mehreren","In lebhafter Umgebung"];
 const needTxt=["kaum Unterstützung","etwas Unterstützung","spürbare Unterstützung","viel Unterstützung","sehr viel Unterstützung"];
 const goals=S.ziele.filter(z=>z.t).sort((a,b)=>a.p-b.p);
 const dR=degree(pta("R")),dL=degree(pta("L"));
 const foot=(n)=>`<footer><img src="img/logo.png" alt="Hörakustik Daugsch"><span>${FIRMA.claim}</span><span>${n}</span></footer>`;
 const reasons=DIMS.map((d,i)=>{const ex=SITS.filter(s=>s.dim===i&&S.sit[s.id]&&S.sit[s.id].d>=2).map(s=>s.t);return ex.length?`<li><b>${dimTxt[i]}</b> – zum Beispiel ${esc(ex.slice(0,3).join(", "))} – brauchen Sie ${needTxt[rec.n[i]-1]}. ${st.name} bietet hier ${needTxt[st.p[i]-1]}.</li>`:""}).filter(Boolean);
 const priceBlock=q?`<table class="price">${q.lines.map(l=>`<tr><td>${esc(l[0])}</td><td>${eur(l[1])}</td></tr>`).join("")}<tr class="tot"><td>${gkv?"Ihr voraussichtlicher Eigenanteil":"Voraussichtlicher Gesamtpreis"}</td><td>${eur(q.total)}</td></tr></table>`
  :`<table class="price"><tr><td>${count} × Hörsystem der Stufe ${st.name}${gkv?" (Eigenanteil)":""}, ab</td><td>${eur((gkv?stageFrom(st.id).gkv:stageFrom(st.id).vk)*count)}</td></tr></table>`;
 return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Hörberatung ${esc(nm)} – ${FIRMA.name}</title><base href="${base}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Asap:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;background:#cfd8d4;font-family:Asap,system-ui,sans-serif;color:#14332A;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bar{position:sticky;top:0;z-index:5;display:flex;gap:10px;justify-content:center;align-items:center;padding:12px;background:#1B493B;color:#fff;font-size:15px}
.bar button{font:inherit;font-weight:700;border:0;border-radius:99px;padding:10px 18px;background:#fff;color:#1B493B;cursor:pointer}.bar button.s{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5)}
.page{width:210mm;height:297mm;margin:10mm auto;background:#fff;position:relative;overflow:hidden;page-break-after:always;break-after:page;box-shadow:0 10px 30px rgba(0,0,0,.18)}
.in{padding:18mm 18mm 24mm;height:100%;display:flex;flex-direction:column;gap:5mm}
footer{position:absolute;left:18mm;right:18mm;bottom:9mm;display:flex;justify-content:space-between;align-items:center;font-size:8.5pt;color:#7A918A;border-top:.3mm solid #DCE6E2;padding-top:3mm}
.kick{font-size:9pt;letter-spacing:.14em;text-transform:uppercase;color:#5A8278;font-weight:600}
h1{font-size:30pt;line-height:1.05;margin:0;font-weight:700}
h2{font-size:22pt;line-height:1.1;margin:0;font-weight:700}
h3{font-size:12.5pt;margin:0 0 2mm;font-weight:700}
p{margin:0;font-size:11pt;line-height:1.55}
.lead{font-size:12.5pt;line-height:1.55;color:#3C5A50}
/* Titel */
.cover .ph{position:absolute;inset:0;background:#1B493B url(img/empfang.jpg) center top/auto 72% no-repeat}
.cover .ph::after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,#1B493B 0%,#1B493B 36%,rgba(27,73,59,.9) 41%,rgba(27,73,59,.6) 48%,rgba(27,73,59,.28) 56%,rgba(27,73,59,.08) 63%,rgba(27,73,59,0) 70%)}
.cover .band{position:absolute;left:0;right:0;bottom:0;height:40%;background:transparent;color:#fff;padding:16mm 18mm;display:flex;flex-direction:column;gap:5mm}
.cover .logo{width:66mm;display:block;margin-bottom:4mm}
.cover h1{font-size:34pt}
.cover .who{font-size:15pt;color:#B7C6C2}
.cover .meta{margin-top:auto;display:flex;justify-content:space-between;font-size:10pt;color:#B7C6C2}
.cover .claim{font-style:italic}
/* Willkommen */
.two{display:grid;grid-template-columns:62mm 1fr;gap:9mm;align-items:start}
.portrait{width:62mm;height:78mm;border-radius:5mm;background:url(img/guido.jpg) 48% 20%/240% auto;}
.sig{margin-top:4mm}.sig b{display:block;font-size:12pt}.sig span{font-size:9.5pt;color:#587168}
.toc{background:#EEF3F1;border-radius:5mm;padding:6mm 7mm;display:grid;grid-template-columns:1fr 1fr;gap:2mm 8mm}
.toc div{display:flex;gap:3mm;font-size:10.5pt}.toc i{font-style:normal;font-weight:700;color:#276955;width:6mm}
/* Hörsituation */
.box{background:#EEF3F1;border-radius:5mm;padding:6mm 7mm}
.aud2 .audpair{display:grid;grid-template-columns:1fr 1fr;gap:5mm}.aud2 figure{margin:0}.aud2 figcaption{display:flex;align-items:baseline;gap:3mm;margin-bottom:1.5mm;font-size:9.5pt}
.aud2 figcaption .ear{font-weight:700}.aud2 .ear.R{color:#C0392B}.aud2 .ear.L{color:#2F5D8A}.aud2 figcaption small{color:#6B7F78}.aud2 svg{width:100%;height:auto;display:block}.aud2 .audleg{font-size:8.5pt;color:#6B7F78;display:flex;gap:6mm;margin:1mm 0 0}.aud2 .audleg .sw{display:inline-block;width:4mm;height:2.6mm;background:rgba(39,105,85,.16);border-radius:1mm;margin-right:1.5mm;vertical-align:-.3mm}
.deg{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
.deg div{border-radius:4mm;padding:4mm 5mm;background:#F6F9F7;border:.3mm solid #DCE6E2}
.deg small{display:block;font-size:9pt;color:#587168}.deg b{font-size:14pt}
.r{color:#C0392B}.l{color:#2F5D8A}
.legend{font-size:9pt;color:#587168;line-height:1.45}
/* Profil */
.dims{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
.dims div{background:#EEF3F1;border-radius:5mm;padding:5mm}
.dims b{display:block;font-size:11pt;margin-bottom:2mm}.dims small{display:block;font-size:9pt;color:#587168;margin-top:2mm}
.d{display:inline-flex;gap:1.6mm}.d i{width:4mm;height:4mm;border-radius:50%;display:block}
.sits{display:flex;flex-direction:column;gap:3mm}
.sit{display:grid;grid-template-columns:62mm 1fr 22mm;gap:4mm;align-items:center;font-size:10.5pt}
.track{height:3.2mm;border-radius:2mm;background:#E1E9E6;overflow:hidden}.track i{display:block;height:100%;border-radius:2mm}
.sit small{font-size:9pt;color:#587168;text-align:right}
.chips{display:flex;flex-wrap:wrap;gap:2.5mm}.chips span{background:#EEF3F1;border-radius:99px;padding:1.6mm 4mm;font-size:10pt}
.goals{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:3mm}
.goals li{display:flex;gap:5mm;align-items:center;font-size:14pt;background:#F3F8F6;border-radius:5mm;padding:4mm 5mm}.goals i{font-style:normal;width:10mm;height:10mm;border-radius:50%;background:#1B493B;color:#fff;display:grid;place-items:center;font-size:10pt;font-weight:700;flex:none}
.free{font-style:italic;color:#3C5A50;border-left:1mm solid #B7C6C2;padding-left:4mm}
/* Empfehlung */
.reco{background:#1B493B;color:#fff;border-radius:6mm;padding:6mm 7mm;display:grid;grid-template-columns:24mm 1fr;gap:6mm;align-items:center}
.reco .n{width:24mm;height:24mm;border-radius:50%;background:#fff;color:#1B493B;display:grid;place-items:center;font-size:28pt;font-weight:700}
.reco h2{font-size:28pt}.reco p{color:#D5E0DC}
.cmp{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
.cmp div{border:.3mm solid #DCE6E2;border-radius:5mm;padding:4mm 5mm;display:flex;flex-direction:column;gap:1.5mm}
.cmp small{font-size:8.5pt;color:#587168}
.why{margin:0;padding-left:5mm;display:flex;flex-direction:column;gap:1.5mm;font-size:10pt;line-height:1.45}
.dev{display:flex;justify-content:space-between;align-items:center;border:.3mm solid #DCE6E2;border-radius:5mm;padding:4mm 6mm}
.dev b{font-size:13pt}.dev span{font-size:9.5pt;color:#587168}
.price{width:100%;border-collapse:collapse;font-size:10.5pt}
.price td{padding:1.8mm 0;border-bottom:.3mm solid #E6EDEA}.price td:last-child{text-align:right;white-space:nowrap;font-weight:600}
.price .tot td{border:0;padding-top:4mm;font-size:13pt;font-weight:700;color:#1B493B}.price .tot td:last-child{font-size:18pt}
.fine{font-size:8.5pt;color:#7A918A;line-height:1.45}
/* Stufen */
.stages{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3.5mm}
.stg{border:.4mm solid #DCE6E2;border-radius:5mm;padding:4mm;display:flex;flex-direction:column;gap:1.4mm;position:relative}
.stg .sp{list-style:none;margin:1mm 0;padding:0;display:flex;flex-direction:column;gap:.8mm;font-size:9pt}.stg .sp li{padding-left:3.5mm;position:relative}.stg .sp li:before{content:"+";position:absolute;left:0;font-weight:700;color:#276955}
.stg.on{border:.8mm solid #276955;background:#F3F8F6}
.stg .tag{position:absolute;top:4mm;right:3.5mm;background:#276955;color:#fff;font-size:8pt;font-weight:700;border-radius:99px;padding:1mm 3mm}
.stg .num{width:8mm;height:8mm;border-radius:50%;background:#1B493B;color:#fff;display:grid;place-items:center;font-size:9pt;font-weight:700}
.stg b{font-size:12.5pt}.stg em{font-style:normal;font-size:9.5pt;color:#587168}
.stg .rows{display:grid;grid-template-columns:auto 1fr;gap:1mm 3mm;font-size:8.5pt;color:#3C5A50;align-items:center;margin:1mm 0}
.stg .from{margin-top:auto;font-size:12pt;font-weight:700;color:#276955}.stg .from small{font-size:8.5pt;font-weight:400;color:#587168}
/* Technologien */
.tech{display:grid;grid-template-columns:1fr 1fr;gap:4mm 7mm}
.tech div{border-top:.6mm solid #B7C6C2;padding-top:3mm}.tech b{display:block;font-size:11pt;margin-bottom:1mm}.tech p{font-size:9.8pt;line-height:1.5;color:#3C5A50}
/* Schritte & Kontakt */
.steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:0}
.steps li{display:grid;grid-template-columns:12mm 1fr;gap:5mm;padding-bottom:6mm;position:relative}
.steps li::before{content:"";position:absolute;left:5.6mm;top:10mm;bottom:0;width:.6mm;background:#B7C6C2}.steps li:last-child::before{display:none}
.steps i{font-style:normal;width:12mm;height:12mm;border-radius:50%;background:#276955;color:#fff;display:grid;place-items:center;font-weight:700;font-size:12pt}
.steps b{display:block;font-size:12pt;margin-top:1mm}.steps p{font-size:10.5pt;color:#3C5A50}
.contact{margin-top:auto;background:#1B493B;color:#fff;border-radius:6mm;padding:8mm;display:grid;grid-template-columns:1fr 1.15fr;gap:8mm}
.contact b{font-size:13pt}.contact p{color:#D5E0DC;font-size:10.5pt}.contact .clogo{width:52mm;display:block;margin-bottom:5mm}
.contact table{font-size:10pt;color:#D5E0DC;border-collapse:collapse}.contact td:last-child{white-space:nowrap}.contact td{padding:.8mm 4mm .8mm 0;vertical-align:top}
.appts{border:.3mm solid #DCE6E2;border-radius:5mm;padding:5mm 6mm;display:flex;flex-direction:column;gap:3mm;background:#F6F9F7}.appts b{font-size:11pt}.appts table{border-collapse:collapse;width:100%;font-size:10pt}.appts td{padding:2mm 2mm;border-bottom:.3mm solid #DCE6E2}.appts td:first-child{font-weight:700;color:#1B493B}.appts small{font-size:8.5pt;color:#587168}
.notes{border:.3mm solid #DCE6E2;border-radius:5mm;padding:5mm 6mm;display:flex;flex-direction:column;gap:7mm}.notes b{font-size:11pt}.notes span{display:block;border-bottom:.3mm solid #DCE6E2;height:0}
.wish{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.wish div{background:#EEF3F1;border-radius:5mm;padding:5mm}.wish small{display:block;font-size:9pt;color:#587168;margin-bottom:1mm}.wish b{font-size:12pt}
footer img{height:7mm}
@media print{html,body{background:#fff}.bar{display:none}.page{margin:0;box-shadow:none}}
</style></head><body>
<div class="bar"><span>Broschüre für ${esc(nm)}</span><button onclick="window.print()">Drucken / als PDF speichern</button><button class="s" onclick="window.close()">Schließen</button></div>

<section class="page cover"><div class="ph"></div><div class="band">
 <img class="logo" src="img/logo-weiss.png" alt="Hörakustik Daugsch">
 <h1>Ihre persönliche<br>Hörberatung</h1><div class="who">für ${esc(nm)}</div>
 <div class="meta"><span>${date}</span><span class="claim">${FIRMA.claim}</span></div></div></section>

<section class="page"><div class="in">
 <span class="kick">Willkommen</span><h2>Schön, dass Sie da waren.</h2>
 <div class="two"><div class="portrait" role="img" aria-label="${FIRMA.person}"></div>
 <div style="display:flex;flex-direction:column;gap:4mm"><p class="lead">${esc(salut())},</p>
  <p>vielen Dank für Ihr Vertrauen und das offene Gespräch. Gutes Hören bedeutet Lebensqualität: Gespräche mit Familie und Freunden, Musik, die kleinen Geräusche des Alltags.</p>
  <p>In dieser Broschüre haben wir alles zusammengefasst, was wir gemeinsam herausgefunden haben – Ihre Hörsituation, Ihr Hörprofil im Alltag, Ihre Wünsche und Ziele – und welche Technik wir Ihnen deshalb empfehlen. So können Sie in Ruhe zu Hause alles noch einmal nachlesen.</p>
  <p>Bei Fragen bin ich jederzeit gern für Sie da.</p>
  <div class="sig"><b>${FIRMA.person}</b><span>${FIRMA.rolle}</span></div></div></div>
 <div class="toc">${["Ihre Hörsituation","Ihr Hörprofil im Alltag","Ihre Wünsche & Hörziele","Unsere Empfehlung","Preisorientierung","Die sechs Technikstufen","Technik kurz erklärt","Ihre nächsten Schritte"].map((t,i)=>`<div><i>${String(i+1).padStart(2,"0")}</i>${t}</div>`).join("")}</div>
 ${foot(2)}</div></section>

<section class="page"><div class="in">
 <span class="kick">01 · Ihre Hörsituation</span><h2>Was wir über Ihr Hören wissen</h2>
 <div class="box" style="display:flex;flex-direction:column;gap:3mm">${friendlySituation().map(t=>`<p>${esc(t)}</p>`).join("")||"<p>–</p>"}</div>
 <h3>Ihr Tonaudiogramm</h3>
 <div class="aud2">${audioPair(true,true)}</div>
 <div class="deg"><div><small class="r">Rechtes Ohr ○</small><b>${dR?esc(dR[0].toUpperCase()+dR.slice(1)):"–"}</b>${pta("R")!=null?`<small>mittlerer Hörverlust ${Math.round(pta("R"))} dB</small>`:""}</div><div><small class="l">Linkes Ohr ×</small><b>${dL?esc(dL[0].toUpperCase()+dL.slice(1)):"–"}</b>${pta("L")!=null?`<small>mittlerer Hörverlust ${Math.round(pta("L"))} dB</small>`:""}</div></div>
 <p class="legend">So lesen Sie das Audiogramm: Links sind tiefe Töne, rechts hohe. Je weiter unten die Kurve liegt, desto lauter muss ein Ton sein, damit Sie ihn hören. Die grüne Fläche zeigt, wo die Laute der Sprache liegen – alles, was oberhalb Ihrer Kurve liegt, geht verloren. Besonders die hohen Töne tragen Konsonanten wie s, f oder t, die für das Verstehen wichtig sind.</p>
 ${foot(3)}</div></section>

<section class="page"><div class="in">
 <span class="kick">02 · Ihr Hörprofil im Alltag</span><h2>Wo Ihnen das Hören schwerfällt</h2>
 <div class="dims">${DIMS.map((d,i)=>`<div><b>${dimTxt[i]}</b>${dotsB(rec.n[i],"#B8452F")}<small>Sie brauchen ${needTxt[rec.n[i]-1]}</small></div>`).join("")}</div>
 <div class="sits">${hard.slice(0,12).map(s=>{const r=S.sit[s.id];const col=["#E1E9E6","#E4C77A","#E59A6A","#B8452F"][r.d];return `<div class="sit"><span>${esc(s.t)}</span><span class="track"><i style="width:${r.d/3*100}%;background:${col}"></i></span><small>${DIFF[r.d]} · ${IMP[r.i??1]}</small></div>`}).join("")||"<p>Keine besonderen Schwierigkeiten angegeben.</p>"}</div>
 ${S.frei?`<p class="free">„${esc(S.frei)}“</p>`:""}
 ${foot(4)}</div></section>

<section class="page"><div class="in">
 <span class="kick">03 · Ihre Wünsche & Hörziele</span><h2>Was Ihnen wichtig ist</h2>
 <div class="wish">${[["Bauform",S.bauform],["Energie",S.energie],["Smartphone",S.phone],["Budget",S.budget]].filter(x=>x[1]&&x[1]!=="noch offen").map(x=>`<div><small>${x[0]}</small><b>${esc(x[1][0].toUpperCase()+x[1].slice(1))}</b></div>`).join("")}</div>
 ${S.wuensche.length?`<h3>Gewünschte Ausstattung</h3><div class="chips">${S.wuensche.map(w=>`<span>${esc(w)}</span>`).join("")}</div>`:""}
 ${S.leben.length?`<h3>Ihr Alltag</h3><div class="chips">${S.leben.map(w=>`<span>${esc(w)}</span>`).join("")}</div>`:""}
 ${goals.length?`<h3 style="margin-top:3mm">Ihre persönlichen Hörziele</h3><ol class="goals">${goals.map((g,i)=>`<li><i>${i+1}</i>${esc(g.t)}</li>`).join("")}</ol><p class="fine">Bei der Anpassung prüfen wir jedes Ziel einzeln und halten fest, wie gut es sich verbessert hat. So sehen Sie schwarz auf weiß, was Ihre Hörsysteme für Sie leisten.</p>`:""}
 ${foot(5)}</div></section>

<section class="page"><div class="in">
 <span class="kick">04 · Unsere Empfehlung</span>
 <div class="reco"><span class="n">${si+1}</span><div><h2>${st.name}</h2><p>${esc(st.sub)} – ideal für ${esc(st.ideal)}.</p></div></div>
 <div class="cmp">${DIMS.map((d,i)=>`<div><b>${dimTxt[i]}</b><small>Ihr Bedarf</small>${dotsB(rec.n[i],"#B8452F")}<small>Leistung ${st.name}</small>${dotsB(st.p[i],"#276955")}</div>`).join("")}</div>
 ${reasons.length?`<h3>Warum diese Stufe zu Ihnen passt</h3><ul class="why">${reasons.join("")}</ul>`:""}
 ${dev?`<div class="dev"><div><span>Unser Gerätevorschlag</span><br><b>${esc(dev.m)} ${esc(dev.model)}</b></div><span>${esc(dev.form)} · ${esc(dev.power)}${count===2?" · beidseitig":""}</span></div>`:""}
 <span class="kick" style="margin-top:2mm">05 · Preisorientierung</span>
 <p style="font-size:10pt;color:#587168">${gkv?`Gesetzlich versichert${S.kunde.kk?" ("+esc(S.kunde.kk)+")":""}: Die Krankenkasse übernimmt einen Festbetrag je Ohr; angegeben ist Ihr Eigenanteil.`:"Privat versichert: angegeben ist der Gesamtpreis."}</p>
 ${priceBlock}
 <p class="fine">Unverbindliche Preisorientierung. Der endgültige Preis richtet sich nach der gewählten Versorgung und wird in einem Kostenvoranschlag festgehalten.${gkv?" Eine zuzahlungsfreie Versorgung (Stufe Basis) ist jederzeit möglich.":""}</p>
 ${foot(6)}</div></section>

<section class="page"><div class="in">
 <span class="kick">06 · Die sechs Technikstufen</span><h2>Für jeden Anspruch die passende Technik</h2>
 <p style="font-size:10.5pt;color:#3C5A50">Jede Stufe kann alles der vorherigen – und mehr. Je höher die Stufe, desto besser unterstützen die Hörsysteme Sie in anspruchsvollen Situationen und desto mehr arbeiten sie automatisch für Sie.</p>
 <div class="stages">${STAGES.map((s,i)=>{const f=stageFrom(s.id);return `<div class="stg${i===si?" on":""}">${i===si?'<span class="tag">Unsere Empfehlung</span>':""}<span class="num">${i+1}</span><b>${s.name}</b><em>${esc(s.sub)}</em>
  <div class="rows">${DIMS.map((d,j)=>`<span>${d}</span>${dotsB(s.p[j],"#276955")}`).join("")}</div>
  <ul class="sp">${(i===0&&gkv?[...plusOf(s),"Zuzahlungsfrei"]:plusOf(s)).map(t=>`<li>${esc(t)}</li>`).join("")}</ul>
  ${STAGES.some(x=>plusOf(x).length>3||plusOf(x).join("").length>110)?"":`<em>Ideal für ${esc(s.ideal)}</em>`}<span class="from">${s.id==="basis"?"Kassenleistung":"ab "+eur(gkv?f.gkv:f.vk)} <small>${s.id==="basis"?(gkv?"zuzahlungsfrei":"je Hörsystem"):gkv?"Eigenanteil je Hörsystem":"je Hörsystem"}</small></span></div>`}).join("")}</div>
 ${foot(7)}</div></section>

<section class="page"><div class="in">
 <span class="kick">07 · Technik kurz erklärt</span><h2>Was moderne Hörsysteme können</h2>
 <div class="tech">${TECH.map(([t,d])=>`<div><b>${t}</b><p>${d}</p></div>`).join("")}</div>
 <p class="fine">Welche Funktionen ein Hörsystem bietet, hängt von Hersteller, Modell und Technikstufe ab. Wir zeigen Ihnen gern den Unterschied im direkten Vergleich.</p>
 ${foot(8)}</div></section>

<section class="page"><div class="in">
 <span class="kick">08 · Ihre nächsten Schritte</span><h2>So geht es weiter</h2>
 <ol class="steps">${NEXT.map(([t,d],i)=>`<li><i>${i+1}</i><div><b>${t}</b><p>${d}</p></div></li>`).join("")}</ol>
 ${(S.termine||[]).length?`<div class="appts"><b>Ihre Termine bei uns</b><table>${S.termine.slice(0,6).map(a=>`<tr><td>${esc(new Date(a.start.slice(0,10)+"T12:00").toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long"}))}</td><td>${hmT(a.start)} Uhr</td><td>${esc(a.type)}</td>${a.res?`<td>bei ${esc(a.res)}</td>`:"<td></td>"}</tr>`).join("")}</table><small>Bitte geben Sie uns rechtzeitig Bescheid, falls Sie einen Termin nicht wahrnehmen können: ${FIRMA.tel}</small></div>`:`<div class="notes"><b>Ihre Notizen</b><span></span><span></span><span></span><span></span></div>`}
 <div class="contact"><div><img class="clogo" src="img/logo-weiss.png" alt="Hörakustik Daugsch"><b>${FIRMA.person}</b><p>${FIRMA.rolle}</p><p style="margin-top:3mm">${FIRMA.str}<br>${FIRMA.ort}</p></div>
  <div><table><tr><td>Telefon</td><td>${FIRMA.tel}</td></tr><tr><td>E-Mail</td><td>${FIRMA.mail}</td></tr><tr><td>Web</td><td>${FIRMA.web}</td></tr></table>
  <p style="margin:4mm 0 1mm;color:#fff;font-weight:700">Öffnungszeiten</p><table>${FIRMA.zeiten.map(z=>`<tr><td>${z[0]}</td><td>${z[1]}</td></tr>`).join("")}</table></div></div>
 ${foot(9)}</div></section>
</body></html>`;
}
async function openBrochure(){
 if(!name()||name()==="Neuer Kunde"){toast("Bitte zuerst den Kundennamen eintragen");return}
 // Fenster sofort öffnen (sonst blockiert der Browser), dann aktuelle Termine aus AkuWin holen und füllen
 const w=window.open("","_blank");if(!w){toast("Fenster blockiert – bitte Pop-ups erlauben");return}
 w.document.write('<p style="font-family:sans-serif;padding:40px;color:#1B493B">Broschüre wird erstellt …</p>');
 if(S.kunde.akuwinId){try{await akUpcoming(true)}catch{}}
 w.document.open();w.document.write(brochureHtml());w.document.close();
}

/* ---------- Ereignisse ---------- */
const active=()=>KUNDE||(H()&&H().page()==="beratung");
const rr=()=>{const y=window.scrollY;H().rerender();window.scrollTo(0,y)};
document.addEventListener("click",e=>{
 if(!active())return;const el=e.target;if(el.closest("dialog"))return;
 const b=el.closest("button,article[data-bopen]");if(!b)return;const d=b.dataset;
 if(KUNDE){if(d.ctab!=null){custTab=Number(d.ctab);renderKunde()}return}
 if(d.bnew!=null){newConsultation();return}
 if(d.bdel){delConsultation(d.bdel);return}
 if(d.bopen){openConsultation(d.bopen);return}
 if(d.blist!=null){saveNow();mode="list";customer=false;listLoaded=false;H().rerender();return}
 if(d.goto){saveNow();if(d.goto==="labor"){H().go("aufgaben");H().setTab("labor")}else H().go(d.goto);return}
 if(mode!=="edit")return;
 if(d.step!=null){step=Number(d.step);if(step===8){AK.upcoming=null;AK.busy=null}saveNow();H().rerender();window.scrollTo(0,0);return}
 if(d.tfrefresh!=null){AK.busy=null;akUpcoming(true);return}
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
 if(d.ftcreate!=null){freeTaskCreate();return}
 if(d.ftprio!=null){S.ft=S.ft||{};S.ft.prio=S.ft.prio==="hoch"?"normal":"hoch";changed();rr();return}
 if(d.otosame!=null){S.oto.same=d.otosame==="1";if(!S.oto.same)S.oto.L=JSON.parse(JSON.stringify(S.oto.R));changed();rr();return}
 if(d.akpick){akPick(d.akpick);return}
 if(d.tftype){const ty=(AK.meta&&AK.meta.types||[]).find(x=>x.id===d.tftype);S.tf=S.tf||{};S.tf.typeId=d.tftype;if(ty)S.tf.minutes=ty.minutes;changed();rr();return}
 if(d.tfres){S.tf=S.tf||{};S.tf.res=d.tfres;changed();rr();return}
 if(d.tfcreate!=null){tfCreateAll();return}
 if(d.tfreserve!=null){tfReserve();return}
 if(d.tfunplan!=null){plan().splice(Number(d.tfunplan),1);changed();rr();return}
 if(d.tfslot){const [dd,tt]=d.tfslot.split("T");tfReserve(dd,tt);return}
 if(d.tfroom!=null){S.tf=S.tf||{};S.tf.room=S.tf.room===false;changed();rr();return}
 if(d.tfmore!=null){AK.days+=14;AK.busy=null;rr();return}
 if(d.akload!=null||d.akreload!=null){akLoadAudios(true);return}
 if(d.akaud){const a=(AK.audios||[]).find(x=>x.guid===d.akaud);if(a){applyAudiogram(a);changed();rr();toast("Audiogramm vom "+fmtD(a.date)+" übernommen")}return}
 if(d.akunlink!=null){delete S.kunde.akuwinId;if(S.audioSrc){S.audio={R:{},L:{}};S.audioBC=null}S.audioSrc=null;AK.audios=null;changed();rr();return}
 if(d.otowho!=null){const cur=S.oto.assignee===undefined?H().me?.id:S.oto.assignee;S.oto.assignee=cur===d.otowho?null:d.otowho;changed();rr();return}
 if(d.otosend!=null){sendLab();return}
 if(d.brochure!=null){saveNow();openBrochure();return}
 if(d.finish!=null){S.status=S.status==="abgeschlossen"?"offen":"abgeschlossen";changed();saveNow();toast(S.status==="abgeschlossen"?"Beratung abgeschlossen":"Beratung wieder geöffnet");rr();return}
 if(d.cust!=null||d.bcustwin!=null){custTab=step===6?2:0;openCustomerWindow();return}
 if(d.custclose!=null){customer=false;H().rerender();return}
 if(d.ctab!=null){custTab=Number(d.ctab);pushCustomer();H().rerender();return}
});
document.addEventListener("input",e=>{
 if(!active()||KUNDE)return;const t=e.target;
 if(t.id==="bq"){q=t.value;H().rerender();const i=$("bq");i.focus();i.setSelectionRange(i.value.length,i.value.length);return}
 if(t.id==="akq"){akSearch(t.value);return}
 if(mode!=="edit")return;
 if(t.dataset.chk){set(t.dataset.chk,t.checked);changed();return}
 if(t.dataset.in&&t.tagName==="SELECT"&&/^oto\..*(anbindung|material)$/.test(t.dataset.in)){set(t.dataset.in,t.value);changed();rr();return}
 if(t.dataset.in){set(t.dataset.in,t.dataset.num!=null?Number(t.value):t.value);if(t.type==="range"){const lb=t.closest("label").querySelector("b");if(lb)lb.textContent=t.value}
  if(t.dataset.in.startsWith("kunde.")){const c=document.querySelector(".crumb b");if(c)c.textContent=name()}changed();return}
 if(t.dataset.aud){if(S.audioSrc&&S.audioSrc.from==="AkuWin"){rr();return}const[e2,f]=t.dataset.aud.split(".");const v=t.value.trim();S.audio[e2][f]=v===""?undefined:Number(v);$("audchart").innerHTML=audioPair();
  const dg=document.querySelectorAll(".degrees b");if(dg.length===2){dg[0].textContent=degree(pta("R"))||"–";dg[1].textContent=degree(pta("L"))||"–"}changed()}
});
document.addEventListener("change",e=>{if(!active()||KUNDE||mode!=="edit")return;if(e.target.dataset.in&&e.target.tagName==="SELECT")rr()});
window.addEventListener("beforeunload",()=>{if(dirty)saveNow()});

/* ---------- Kundenmodus (eigenes Fenster) ---------- */
function renderKunde(){document.getElementById("kroot").innerHTML=`<div class="bx">${customerView()}</div>`}
if(KUNDE){
 document.title="Hörakustik Daugsch · Ihre Hörberatung";
 document.body.innerHTML='<div id="kroot"><div class="bx"><div class="cust"><header><img class="clogo" src="img/logo.png" alt="Hörakustik Daugsch"></header><main><div class="crec"><div><h2>Herzlich willkommen</h2><p class="muted">natürlich · individuell · hören</p></div></div></main></div></div></div>';
 if(bc)bc.onmessage=ev=>{const m=ev.data;if(m&&m.type==="state"){S=m.S;custTab=m.custTab;SNAP_PRICES=m.prices;SNAP_PLUS=m.plus||null;S.override=m.stage===recommend().idx?"":m.stage;renderKunde()}};
}

window.HD_BERATUNG={defaultPlus:id=>(STAGES.find(s=>s.id===id)||{}).plus||[],render,set:(p,v)=>{set(p,v);changed();rr()},startWith:name=>{H().go("beratung");newConsultation();const n=String(name||"").replace(/,.*$/,"").trim();if(n){AK.q=n;akSearch(n);H().rerender()}}};
})();
/* Abschluss: geplante Termine automatisch auffrischen (beim Zurückkehren in die App und alle 2 Minuten) */
(function(){const fresh=()=>{if(mode==="edit"&&step===8&&S.kunde&&S.kunde.akuwinId&&!AK.upLoading&&document.visibilityState==="visible"&&active()){AK.busy=null;akUpcoming(true)}};
 document.addEventListener("visibilitychange",fresh);setInterval(fresh,120000)})();
