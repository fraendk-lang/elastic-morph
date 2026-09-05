!function(){"use strict";const e=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"],t={Db:"C#",Eb:"D#",Gb:"F#",Ab:"G#",Bb:"A#",Cb:"B",Fb:"E"},gDisp=["C","Cis","D","Dis","E","F","Fis","G","Gis","A","B","H"],deTok=["Ais","Cis","Dis","Fis","Gis","His","Ces","Des","Eis","Fes","Ges","As","Es","A","B","C","D","E","F","G","H"],deRoots={Ais:10,Cis:1,Dis:3,Fis:6,Gis:8,His:11,Ces:11,Des:1,Eis:5,Fes:4,Ges:6,As:8,Es:3,A:9,B:10,C:0,D:2,E:4,F:5,G:7,H:11},parseRootTok=function(str,lang){if("de"===lang){for(const tok of deTok){if(str.slice(0,tok.length).toLowerCase()===tok.toLowerCase())return{pc:deRoots[tok],len:tok.length}}return null}const m=str.match(/^([A-Ga-g])(#|b)?/);if(!m)return null;let d=m[1].toUpperCase()+(m[2]||"");t[d]&&(d=t[d]);const idx=e.indexOf(d);return-1===idx?null:{pc:idx,len:m[0].length}},noteLabel=function(pc,lang){const p=((pc%12)+12)%12;return"de"===lang?gDisp[p]:e[p]},n=[0,7,2,9,4,11,6,1,8,3,10,5],o={maj:{intervals:[0,4,7],display:"",base:"maj"},m:{intervals:[0,3,7],display:"m",base:"m"},dim:{intervals:[0,3,6],display:"dim",base:"dim"},aug:{intervals:[0,4,8],display:"aug",base:"aug"},dom7:{intervals:[0,4,7,10],display:"7",base:"maj"},maj7:{intervals:[0,4,7,11],display:"maj7",base:"maj"},m7:{intervals:[0,3,7,10],display:"m7",base:"m"},m7b5:{intervals:[0,3,6,10],display:"m7b5",base:"dim"},dim7:{intervals:[0,3,6,9],display:"dim7",base:"dim"},dom9:{intervals:[0,4,7,10,14],display:"9",base:"maj"},maj9:{intervals:[0,4,7,11,14],display:"maj9",base:"maj"},m9:{intervals:[0,3,7,10,14],display:"m9",base:"m"},six:{intervals:[0,4,7,9],display:"6",base:"maj"},m6:{intervals:[0,3,7,9],display:"m6",base:"m"},sus2:{intervals:[0,2,7],display:"sus2",base:"maj"},sus4:{intervals:[0,5,7],display:"sus4",base:"maj"},add9:{intervals:[0,4,7,14],display:"add9",base:"maj"},m11:{intervals:[0,3,7,10,14,17],display:"m11",base:"m"},m13:{intervals:[0,3,7,10,14,17,21],display:"m13",base:"m"},dom13:{intervals:[0,4,7,10,14,21],display:"13",base:"maj"},dom7b9:{intervals:[0,4,7,10,13],display:"7b9",base:"maj"},dom7s9:{intervals:[0,4,7,10,15],display:"7#9",base:"maj"},dom7s11:{intervals:[0,4,7,10,14,18],display:"7#11",base:"maj"},dom7b13:{intervals:[0,4,7,10,14,20],display:"7b13",base:"maj"},dom7alt:{intervals:[0,4,10,13,15,18,20],display:"7alt",base:"maj"}},a=[["maj9","maj9"],["maj7","maj7"],["m7b5","m7b5"],["min7b5","m7b5"],["m11","m11"],["min11","m11"],["m13","m13"],["min13","m13"],["m9","m9"],["min9","m9"],["7alt","dom7alt"],["alt","dom7alt"],["7b9","dom7b9"],["7#9","dom7s9"],["7#11","dom7s11"],["7b13","dom7b13"],["m7","m7"],["min7","m7"],["m6","m6"],["min6","m6"],["dim7","dim7"],["dim","dim"],["aug","aug"],["+","aug"],["sus2","sus2"],["sus4","sus4"],["add9","add9"],["maj","maj"],["M7","maj7"],["13","dom13"],["9","dom9"],["7","dom7"],["6","six"],["min","m"],["m","m"],["","maj"]];function i(t,n,a){let i=noteLabel(t,J.noteLang)+o[n].display;return void 0!==a&&a!==t&&(i+="/"+noteLabel(a,J.noteLang)),i}
const _mkLabel=i;function r(n){if(!n)return null;let r=n.trim();if(!r)return null;let s=null;const c=r.indexOf("/");-1!==c&&(s=r.slice(c+1).trim(),r=r.slice(0,c).trim());const rt=parseRootTok(r,J.noteLang);if(!rt)return null;const u=rt.pc;let m=r.slice(rt.len).trim(),p=null;for(const[e,t]of a)if(m===e){p=t;break}if(null===p){const e=m.toLowerCase();for(const[t,n]of a)if(t.toLowerCase()===e){p=n;break}}if(null===p)return null;let g=u;if(null!==s){const bt=parseRootTok(s,J.noteLang);if(!bt||bt.len!==s.length)return null;g=bt.pc}return{rootPc:u,qualityId:p,quality:o[p],bassPc:g,label:i(u,p,g)}}const I18N_DE_EN={"Chord-Editor":"Chord Editor","Song-Arrangement":"Song Arrangement","Speichern":"Save","🔗 Link kopieren":"🔗 Copy link","Noch keine gespeicherten Presets.":"No saved presets yet.","Bearbeite Sektion:":"Editing section:","← Zurück zur Song-Übersicht":"← Back to song overview","Modus":"Mode","Vorwärts":"Forward","Rückwärts (Ziel-gerichtet)":"Backward (goal-directed)","Kritik (Akkord ersetzen)":"Critique (replace chord)","Baue eine Progression Akkord für Akkord vorwärts auf.":"Build a progression chord by chord, forward.","Akkord hinzufügen":"Add chord","Klaviatur":"Keyboard","Quinte":"Fifths","Hinzufügen":"Add","Beispiel: C – Am – F":"Example: C – Am – F","Beispiel: Dm7 – G7 – Cmaj7":"Example: Dm7 – G7 – Cmaj7","Neu ab Am":"New from Am","Zurücksetzen":"Reset","Töne anklicken — mind. 2, tiefster Ton = Grundton":"Click notes — at least 2, lowest note = root","Übernehmen":"Apply","Leeren":"Clear","MIDI verbinden":"Connect MIDI","nicht verbunden":"not connected","Akkord auf angeschlossenem Controller spielen":"Play chord on connected controller","Noch kein Akkord — oben eingeben oder ein Beispiel laden.":"No chord yet — enter one above or load an example.","Erkannte Tonart: —":"Detected key: —","🎵 Metronom: Aus":"🎵 Metronome: Off","🎵 Metronom: An":"🎵 Metronome: On","▶ Progression abspielen":"▶ Play progression","⇩ MIDI exportieren":"⇩ Export MIDI","⇩ WAV exportieren":"⇩ Export WAV","🔀 Reharmonisieren":"🔀 Reharmonize","Letzten entfernen":"Remove last","Vorschläge — nächster Akkord":"Suggestions — next chord","Vorschläge — vorheriger Akkord":"Suggestions — previous chord","Vorschläge — Position wählen":"Suggestions — choose a position","DIATONISCH":"DIATONIC","CHROMATISCH":"CHROMATIC","Upper Structure (nur Dominant-Akkorde: 7, 9, 13, alteriert)":"Upper Structure (dominant chords only: 7, 9, 13, altered)","Aus":"Off","An":"On","II-Dur (9, #11, 13)":"II major (9, #11, 13)","bII-Moll (b9, b13)":"bII minor (b9, b13)","bIII-Dur (#9)":"bIII major (#9)","bVI-Dur (#9, b13)":"bVI major (#9, b13)","Voicing-Stil":"Voicing style","Eng":"Close","Klang":"Sound","Konzertflügel":"Grand Piano","Klavier (Upright)":"Piano (Upright)","Cembalo":"Harpsichord","Ambient-Pad":"Ambient Pad","HALL":"REVERB","WÄRME":"WARMTH","Stimmung":"Tuning","Humanize (Timing/Velocity beim Abspielen)":"Humanize (timing/velocity on playback)","STÄRKE":"AMOUNT","+ Eigene Sektion":"+ Custom section","Eigene Sektion":"Custom section","Song automatisch generieren":"Auto-generate song","Dur":"Major","Moll":"Minor","Pop-Standard (8 Sektionen)":"Pop standard (8 sections)","Kurz (4 Sektionen)":"Short (4 sections)","Loop-Style":"Loop style","ÜBERRASCHUNG":"SURPRISE","🪄 Song generieren":"🪄 Generate song","🔀 Song reharmonisieren":"🔀 Reharmonize song","Timeline erscheint, sobald der Song Akkorde enthält.":"Timeline appears once the song has chords.","Sektionen":"Sections","Noch keine Sektionen — oben eine hinzufügen.":"No sections yet — add one above.","Noch keine Akkorde im Song.":"No chords in the song yet.","▶ Song abspielen":"▶ Play song","⇩ Song als MIDI exportieren":"⇩ Export song as MIDI","⇩ Song als WAV exportieren":"⇩ Export song as WAV","Leadsheet-Ansicht":"Leadsheet view","Drucken":"Print","⇩ PDF exportieren":"⇩ Export PDF","← Zurück":"← Back","Legende:":"Legend:","diatonisch":"diatonic","Sekundärdominante":"secondary dominant","entlehnt":"borrowed","chromatisch":"chromatic","Jazz-Farbe":"jazz color","Anhören":"Listen","Authentische Kadenz (V→I)":"Authentic cadence (V→I)","Bestehendes Song-Arrangement ersetzen?":"Replace existing song arrangement?","Dauer in Beats (wirkt auf Abspielen und MIDI-Export)":"Duration in beats (affects playback and MIDI export)","Erkannte Kadenzen":"Detected cadences","Erst Zielakkord eingeben.":"Enter a target chord first.","Erst eine Progression aufbauen (Vorwärts-Modus).":"Build a progression first (forward mode).","Erzeuge PDF …":"Generating PDF …","Gib zuerst deinen Zielakkord ein (Text/Klaviatur/MIDI) — die Vorschläge zeigen dann, was gut davor passt. Jeder gewählte Vorschlag wird vorne angehängt.":"First enter your target chord (text/keyboard/MIDI) — the suggestions will then show what fits well before it. Each chosen suggestion is added to the front.","Harmonische Analyse":"Harmonic analysis","Harmonische Analyse — Progression":"Harmonic analysis — Progression","Harmonische Analyse — Song":"Harmonic analysis — Song","I (Picardie)":"I (Picardy)","II (entlehnt)":"II (borrowed)","IV (entlehnt)":"IV (borrowed)","Keine Akkorde zum Analysieren.":"No chords to analyze.","Keine Vorschläge.":"No suggestions.","Keine klassischen Kadenzen erkannt.":"No classical cadences detected.","Keine Änderungsvorschläge gefunden.":"No change suggestions found.","Klick einen Akkord in der Progression an, um Ersatzvorschläge für genau diese Position zu sehen — bewertet nach beiden Nachbarn.":"Click a chord in the progression to see replacement suggestions for that exact position — scored against both neighbors.","Klick oben einen Akkord in der Progression an.":"Click a chord in the progression above.","Kritik-Modus braucht eine bestehende Progression — erst im Vorwärts-Modus aufbauen.":"Critique mode needs an existing progression — build one in forward mode first.","Link kopieren (Strg/Cmd+C):":"Copy link (Ctrl/Cmd+C):","Link kopiert ✓":"Link copied ✓","Löschen":"Delete","Nach oben":"Move up","Nach unten":"Move down","Name der Sektion":"Section name","Noch kein Zielakkord — oben eingeben. Vorschläge werden dann davor angehängt.":"No target chord yet — enter one above. Suggestions will then be added before it.","Oktavlage der Voicing":"Octave register of the voicing","PDF-Export fehlgeschlagen: ":"PDF export failed: ","Plagale Kadenz (IV→I)":"Plagal cadence (IV→I)","Reharmonisierungs-Vorschau — Progression":"Reharmonization preview — Progression","Reharmonisierungs-Vorschau — Song":"Reharmonization preview — Song","Rendere Audio …":"Rendering audio …","Schließen":"Close","Sektion transponieren (Halbtonschritte)":"Transpose section (semitones)","Sekundärdominante aufgelöst":"Secondary dominant resolved","Trugschluss (V→vi)":"Deceptive cadence (V→vi)","Umkehrung / freier Bass (unabhängig vom Akkord wählbar)":"Inversion / free bass (selectable independent of the chord)","WAV-Export fehlgeschlagen: ":"WAV export failed: ","WAV-Export wird von diesem Browser nicht unterstützt.":"WAV export is not supported by this browser.","Web MIDI wird von diesem Browser nicht unterstützt (Chrome/Edge empfohlen).":"Web MIDI is not supported by this browser (Chrome/Edge recommended).","Ziehen zum Umsortieren":"Drag to reorder","Zielakkord festlegen":"Set target chord","Zugriff verweigert oder fehlgeschlagen":"Access denied or failed","bII (Neapolitan)":"bII (Neapolitan)","bIII (entlehnt)":"bIII (borrowed)","bVI (entlehnt)":"bVI (borrowed)","bVII (entlehnt)":"bVII (borrowed)","bVII7 (Backdoor-Dominante)":"bVII7 (backdoor dominant)","ii–V Verbindung":"ii–V connection","iv (entlehnt)":"iv (borrowed)","jsPDF konnte nicht geladen werden":"jsPDF could not be loaded","jsPDF nicht verfügbar":"jsPDF not available","kein MIDI-Gerät gefunden":"no MIDI device found","verbinde …":"connecting …","verbunden: ":"connected: ","vi° (entlehnt)":"vi° (borrowed)","✓ Alle übernehmen":"✓ Apply all","✓ Übernehmen":"✓ Apply","✗ Verwerfen":"✗ Discard","🎸 Bassline: An":"🎸 Bassline: On","🎸 Bassline: Aus":"🎸 Bassline: Off","🎼 Melodie: An":"🎼 Melody: On","🎼 Melodie: Aus":"🎼 Melody: Off","📊 Analyse":"📊 Analysis","📊 Song-Analyse":"📊 Song analysis","Bearbeiten":"Edit","Wiederholungen":"Repeats","Entfernen":"Remove","Dorisch":"Dorian","Phrygisch":"Phrygian","Lydisch":"Lydian","Mixolydisch":"Mixolydian","Lokrisch":"Locrian","Position":"Position","Bass":"Bass"};
const _i18nOrig=new WeakMap(),_i18nOrigAttr=new WeakMap();
function _i18nLookup(s){
const t=s.trim();
if(Object.prototype.hasOwnProperty.call(I18N_DE_EN,t))return I18N_DE_EN[t];
let m;
if(m=t.match(/^(\d+) Sektion(en)?, (\d+) Akkorde? insgesamt \(inkl\. Wiederholungen\)$/))return m[1]+" section"+("1"===m[1]?"":"s")+", "+m[3]+" chord"+("1"===m[3]?"":"s")+" total (incl. repeats)";
if(m=t.match(/^(\d+) Akkorde?$/))return m[1]+" chord"+("1"===m[1]?"":"s");
if(m=t.match(/^(\d+) Sektion(en)?$/))return m[1]+" section"+("1"===m[1]?"":"s");
if(m=t.match(/^Erkannte Tonart: (.+)$/))return"Detected key: "+m[1];
if(m=t.match(/^Bass: (.+)$/))return"Bass: "+m[1];
if(m=t.match(/^Gesamtlänge: ~(.+)$/))return"Total length: ~"+m[1];
if(m=t.match(/^Sektion bearbeiten: (.+)$/))return"Edit section: "+m[1];
if(m=t.match(/^Vorschläge — Ersatz für Position (\d+)$/))return"Suggestions — replacement for position "+m[1];
return null}
function _i18nTranslateTextNode(n){
if(!n||3!==n.nodeType)return;
if("en"===J.lang){
_i18nOrig.has(n)||_i18nOrig.set(n,n.nodeValue);
const o=_i18nOrig.get(n),tr=_i18nLookup(o);
if(null!==tr){
const lead=o.match(/^\s*/)[0],trail=o.match(/\s*$/)[0],nv=lead+tr+trail;
n.nodeValue!==nv&&(n.nodeValue=nv)
}
}else if(_i18nOrig.has(n)){
const o=_i18nOrig.get(n);
n.nodeValue!==o&&(n.nodeValue=o)
}}
function _i18nTranslateAttr(el,attr){
const cur=el.getAttribute(attr);
if(null===cur)return;
let st=_i18nOrigAttr.get(el);
st||(st={},_i18nOrigAttr.set(el,st));
if("en"===J.lang){
attr in st||(st[attr]=cur);
const tr=_i18nLookup(st[attr]);
null!==tr&&el.setAttribute(attr,tr)
}else if(attr in st){
el.setAttribute(attr,st[attr])
}}
function _i18nWalk(node){
if(!node)return;
if(3===node.nodeType)return void _i18nTranslateTextNode(node);
if(1===node.nodeType){
if("SCRIPT"===node.tagName||"STYLE"===node.tagName)return;
_i18nTranslateAttr(node,"title");
_i18nTranslateAttr(node,"placeholder");
_i18nTranslateAttr(node,"aria-label");
for(let i=0;i<node.childNodes.length;i++)_i18nWalk(node.childNodes[i])
}}
function applyLanguage(){
_i18nWalk(document.body);
const btn=document.getElementById("langToggleBtn");
btn&&(btn.textContent="de"===J.lang?"EN":"DE",btn.title="de"===J.lang?"Switch to English":"Auf Deutsch umschalten")
}
let _i18nObserver=null;
function initI18nObserver(){
if(_i18nObserver)return;
_i18nObserver=new MutationObserver(muts=>{
if("en"!==J.lang)return;
for(const mu of muts){
if("characterData"===mu.type){_i18nTranslateTextNode(mu.target);continue}
mu.addedNodes&&mu.addedNodes.forEach(n=>_i18nWalk(n))
}
});
_i18nObserver.observe(document.body,{childList:!0,subtree:!0,characterData:!0})
}
function refreshCofRingLabels(){if(!ee.circleOfFifths)return;ee.circleOfFifths.querySelectorAll(".cof-label[data-pc]").forEach(el=>{const pc=Number(el.getAttribute("data-pc")),isMinor=el.classList.contains("cof-label-minor");el.textContent=noteLabel(pc,J.noteLang)+(isMinor?"m":"")})}
function s(e){const t=Array.from(e);if(t.length<2)return null;const n=(Array.from(new Set(t)).sort((e,t)=>e-t)[0]%12+12)%12,a=Array.from(new Set(t.map(e=>(e%12+12)%12))),r=[n,...a.filter(e=>e!==n)];for(const e of r){const t=new Set(a.map(t=>((t-e)%12+12)%12));t.add(0);const r=Array.from(t).sort((e,t)=>e-t);for(const t of Object.keys(o)){const a=o[t],s=Array.from(new Set(a.intervals.map(e=>(e%12+12)%12))).sort((e,t)=>e-t);if(s.length===r.length&&s.every((e,t)=>e===r[t]))return{rootPc:e,qualityId:t,quality:a,bassPc:n,label:i(e,t,n)}}}return null}function c(e,t){const n=12*Math.floor(t/7);return e[(t%7+7)%7]+n}function l(e,t,n,o,a){const i=[0,1,2,3,4,5,6].map(e=>function(e,t){const n=c(e,t),o=c(e,t+2)-n,a=c(e,t+4)-n;return 4===o&&7===a?"maj":3===o&&7===a?"m":3===o&&6===a?"dim":4===o&&8===a?"aug":"maj"}(t,e));a&&Object.entries(a).forEach(([e,t])=>{i[Number(e)]=t});const r=i.map((e,t)=>function(e,t){let n=["I","II","III","IV","V","VI","VII"][e];return"m"!==t&&"dim"!==t||(n=n.toLowerCase()),"dim"===t&&(n+="°"),"aug"===t&&(n+="+"),n}(t,e)),s=o||function(e){const t=[];for(let n=0;n<7;n++){const o=[];for(let t=0;t<7;t++){if(n===t){o.push(.05);continue}const a=(c(e,n)%12+12)%12,i=(((c(e,t)%12+12)%12-a)%12+12)%12,r=Math.min(i,12-i);let s;s=5===r?.8:3===r||4===r?.55:1===r||2===r?.5:6===r?.25:.4,0===t&&(s=Math.min(.92,1.15*s)),o.push(s)}t.push(o)}return t}(t),l="maj"===i[0]||"aug"===i[0]?"bright":"dark";return{id:e,intervals:t,label:n,qualities:i,romans:r,trans:s,brightness:l}}const d={major:l("major",[0,2,4,5,7,9,11],"Dur",[[.05,.55,.25,.85,.9,.7,.35],[.3,.05,.2,.45,.85,.3,.55],[.3,.55,.05,.6,.35,.75,.2],[.75,.55,.2,.05,.85,.55,.25],[.9,.25,.15,.35,.05,.55,.2],[.35,.7,.3,.75,.55,.05,.25],[.85,.2,.45,.25,.3,.35,.05]]),lydian:l("lydian",[0,2,4,6,7,9,11],"Lydisch"),mixolydian:l("mixolydian",[0,2,4,5,7,9,10],"Mixolydisch"),minor:l("minor",[0,2,3,5,7,8,10],"Moll",[[.05,.5,.55,.75,.85,.7,.45],[.35,.05,.3,.3,.8,.25,.45],[.3,.3,.05,.45,.35,.75,.55],[.7,.45,.3,.05,.85,.55,.3],[.9,.2,.25,.3,.05,.45,.2],[.45,.55,.55,.65,.55,.05,.35],[.5,.3,.6,.35,.3,.4,.05]],{4:"maj"}),dorian:l("dorian",[0,2,3,5,7,9,10],"Dorisch"),phrygian:l("phrygian",[0,1,3,5,7,8,10],"Phrygisch"),locrian:l("locrian",[0,1,3,5,6,8,10],"Lokrisch")};function u(e,t){return d[t].intervals.map(t=>(e+t)%12)}function m(e,t,n){const o=d[n],a=u(t,n);let i=0;for(const t of e){const e=a.indexOf(t.rootPc);if(-1===e)continue;i+=1;const r=t.quality.base;r===o.qualities[e]?i+=1:i+="minor"!==n||4!==e||"maj"!==r&&"m"!==r?.25:.85}return e.length&&e[0].rootPc===t&&(i+=1.5),i}function p(e){if(!e.length)return{tonicPc:0,mode:"major"};let t=null;for(let n=0;n<12;n++)for(const o of Object.keys(d)){const a=m(e,n,o);(!t||a>t.score+1e-9)&&(t={tonicPc:n,mode:o,score:a})}return t}const g={none:{label:"Neutral",tagMul:{diatonic:1,secondary:1,borrowed:1,chromatic:1,jazz:1,substitute:1},degreeMul:[1,1,1,1,1,1,1]},lofi:{label:"Lo-Fi",tagMul:{diatonic:.9,secondary:1.4,borrowed:1.1,chromatic:1.2,jazz:1.5,substitute:1.3},degreeMul:[1,1.3,1,1,1,1.2,.8]},house:{label:"House",tagMul:{diatonic:1.5,secondary:.7,borrowed:.6,chromatic:.3,jazz:.3,substitute:.7},degreeMul:[1.3,.8,.8,1.2,1.3,1.2,.6]},cinematic:{label:"Cinematic",tagMul:{diatonic:.8,secondary:.9,borrowed:1.6,chromatic:1.3,jazz:1.1,substitute:1.4},degreeMul:[1.1,.8,.9,1.3,1,1.2,.7]}};function h(e,t){if(!e)return null;const n=t.indexOf(e.rootPc);return-1===n?null:n}function f(e,t,n,o,a){n=n||"none",o=o||"forward";const i=p(e),r=u(i.tonicPc,i.mode),s=d[i.mode],c=s.romans,l=s.trans;let m,f;if("backward"===o){if(!e.length)return{key:i,list:[]};const t=h(e[0],r)??0;m=e=>l[e][t],f=t}else if("critique"===o){if(null==a||!e[a])return{key:i,list:[]};const t=h(e[a-1],r),n=h(e[a+1],r);m=e=>(null!==t?l[t][e]:1)*(null!==n?l[e][n]:1),f=h(e[a],r)}else{const t=h(e[e.length-1],r)??0;m=e=>l[t][e],f=e.length>0?t:null}const b=new Map;function v(e,o,a,i,r,s,c){e=(e%12+12)%12;const l=a*function(e,t){const n=t/100*3;return.03+.97*Math.exp(-(e-n)*(e-n)/2)}(r,t)*function(e,t,n){const o=g[e]||g.none;let a=void 0!==o.tagMul[t]?o.tagMul[t]:1;return null!=n&&o.degreeMul&&(a*=o.degreeMul[n]),a}(n,i,c),d=function(e,t){return e+"_"+t}(e,o),u=b.get(d);(!u||u.weight<l)&&b.set(d,{rootPc:e,qualityId:o,weight:l,tag:i,romanLabel:s})}for(let e=0;e<7;e++){if(e===f)continue;const t=m(e),n=s.qualities[e];v(r[e],n,t,"diatonic",0,c[e],e)}for(let e=0;e<7;e++){if(0===e)continue;const t=.8*m(e);if("forward"===o){const n=(r[e]+7)%12;v(n,"dom7",t,"secondary",1,"V7/"+c[e],e),v(n,"dom13",.85*t,"jazz",3,"V13/"+c[e],e),v(n,"dom7alt",.75*t,"jazz",3.3,"V7alt/"+c[e],e),v(n,"dom7s9",.75*t,"jazz",3.2,"V7#9/"+c[e],e)}else v(r[e],"dom7",t,"secondary",1,c[e]+"7 (Dominant-Färbung)",e),v(r[e],"dom13",.85*t,"jazz",3,c[e]+"13 (Dominant-Färbung)",e),v(r[e],"dom7alt",.75*t,"jazz",3.3,c[e]+"7alt (Dominant-Färbung)",e),v(r[e],"dom7s9",.75*t,"jazz",3.2,c[e]+"7#9 (Dominant-Färbung)",e)}const y="backward"===o?e[0]:"critique"===o?e[a]:e[e.length-1];if(y){const e=h(y,r);if(null!==e){const t="bright"===s.brightness?5:2;0===e?v(r[t],s.qualities[t],.85,"substitute",.5,c[t]+" (Tonika-Vertreter)",t):e===t&&v(r[0],s.qualities[0],.85,"substitute",.5,c[0]+" (Tonika-Vertreter)",0),1===e?v(r[3],s.qualities[3],.75,"substitute",.6,c[3]+" (Subdominant-Vertreter)",3):3===e&&v(r[1],s.qualities[1],.75,"substitute",.6,c[1]+" (Subdominant-Vertreter)",1),0!==e&&1!==e&&3!==e||v(i.tonicPc+10,"dom7",.55,"substitute",2.2,"bVII7 (Backdoor-Dominante)",null)}}const E={bright:[{off:3,q:"maj",label:"bIII (entlehnt)"},{off:8,q:"maj",label:"bVI (entlehnt)"},{off:10,q:"maj",label:"bVII (entlehnt)"},{off:5,q:"m",label:"iv (entlehnt)"}],dark:[{off:0,q:"maj",label:"I (Picardie)"},{off:5,q:"maj",label:"IV (entlehnt)"},{off:9,q:"dim",label:"vi° (entlehnt)"},{off:2,q:"maj",label:"II (entlehnt)"}]};for(const e of E[s.brightness])v(i.tonicPc+e.off,e.q,.5,"borrowed",2,e.label,null);v(i.tonicPc+1,"maj",.4,"chromatic",3,"bII (Neapolitan)",null);v((r[4]+6)%12,"dom7",.45,"chromatic",3,"Tritonus-Sub",null);let k=Array.from(b.values());k.sort((e,t)=>t.weight-e.weight),k=k.slice(0,8);const w=k.length?k[0].weight:1;return k.forEach(e=>{e.pct=Math.max(1,Math.min(99,Math.round(e.weight/w*100)))}),{key:i,list:k}}function b(e,t){return e+12*Math.round((t-e)/12)}function v(e,t,n,o){null==o&&(o=e);const a=[],i=n&&n.length?n[0]:48;a.push(b(o,i));const r=((o-e)%12+12)%12,s=t.slice(),c=s.indexOf(r);-1!==c&&s.splice(c,1);const l=s.slice().sort((e,t)=>e-t),d=function(e,t,n){const o=e.length;if(0===o)return[];let a;if(n&&n.length){const i=n.slice().sort((e,t)=>e-t);let r;if(i.length===o)r=i;else if(i.length>o)r=i.slice(0,o);else for(r=i.slice();r.length<o;)r.push(r[r.length-1]+12);a=e.map((e,n)=>b(((t+e)%12+12)%12,r[n]))}else a=e.map(e=>b(((t+e)%12+12)%12,64));for(let e=1;e<a.length;e++)for(;a[e]<a[e-1];)a[e]+=12;return a}(l,e,n&&n.length>1?n.slice(1):n&&1===n.length?n:null);return l.forEach((e,t)=>{let n=d[t];if(e>=12)for(;n<=a[0]+11;)n+=12;a.push(n)}),a.map(e=>Math.min(96,Math.max(28,e)))}function y(e,t){if(!t||"close"===t||e.length<3)return e;const n="drop2"===t?2:3,o=e.slice().sort((e,t)=>e-t),a=o.length;if(a<n+1)return e;const i=a-n,r=o.slice();return r[i]=r[i]-12,r.sort((e,t)=>e-t),r.map(e=>Math.min(96,Math.max(21,e)))}const E=new Set(["dom7","dom9","dom13","dom7b9","dom7s9","dom7s11","dom7b13","dom7alt"]);function k(e){return E.has(e)}const w={none:{label:"Aus",addTones:[]},us_II:{label:"II-Dur (9, #11, 13)",addTones:[2,6,9]},us_bII:{label:"bII-Moll (b9, b13)",addTones:[1,4,8]},us_bIII:{label:"bIII-Dur (#9)",addTones:[3,7,10]},us_bVI:{label:"bVI-Dur (#9, b13)",addTones:[8,0,3]}};function B(e,t){const n=e.quality.intervals;if(!t||"none"===t||!k(e.qualityId))return n;const o=w[t];if(!o||!o.addTones.length)return n;const a=n.filter(e=>7!==e),i=new Set(a),r=o.addTones.filter(e=>!i.has(e));return a.concat(r)}const x=["major","dorian","phrygian","lydian","mixolydian","minor","locrian"];function I(e,t,n){let o=null;const a=[];return e.forEach(e=>{const i=B(e,t);let r=v(e.rootPc,i,o,e.bassPc);const s=12*(e.register||0);s&&(r=r.map(e=>Math.min(96,Math.max(28,e+s)))),o=r,a.push(y(r,n))}),a}let L=null,S=null;function A(e){S&&(S.dryGain.gain.setTargetAtTime(1-.4*J.reverbAmount,e,.05),S.reverbGain.gain.setTargetAtTime(.8*J.reverbAmount,e,.05))}function q(e){const t=e.createGain(),n=e.createGain(),o=e.createGain(),a=e.createConvolver();return a.buffer=function(e,t,n){const o=e.sampleRate,a=Math.max(1,Math.floor(o*t)),i=e.createBuffer(2,a,o);for(let e=0;e<2;e++){const t=i.getChannelData(e);for(let e=0;e<a;e++){const o=a-e,i=Math.pow(o/a,n);t[e]=(2*Math.random()-1)*i}}return i}(e,2.5,2),t.connect(n),n.connect(e.destination),t.connect(a),a.connect(o),o.connect(e.destination),{masterBus:t,dryGain:n,reverbGain:o,convolver:a}}function P(){return L||(L=new(window.AudioContext||window.webkitAudioContext),S=q(L),A(L.currentTime)),"suspended"===L.state&&L.resume(),L}const C=[{n:1,amp:1,decay:2.6},{n:2,amp:.55,decay:2},{n:3,amp:.32,decay:1.5},{n:4,amp:.19,decay:1.15},{n:5,amp:.12,decay:.9},{n:6,amp:.08,decay:.7},{n:7,amp:.05,decay:.55}];function M(e,t,n,o){const a=.05,i=Math.max(1,Math.floor(e.sampleRate*a)),r=e.createBuffer(1,i,e.sampleRate),s=r.getChannelData(0);for(let e=0;e<i;e++)s[e]=(2*Math.random()-1)*(1-e/i);const c=e.createBufferSource();c.buffer=r;const l=e.createBiquadFilter();l.type="bandpass",l.frequency.value=3200,l.Q.value=.6;const d=e.createGain();d.gain.setValueAtTime(.06*o,n),d.gain.exponentialRampToValueAtTime(1e-4,n+a),c.connect(l),l.connect(d),d.connect(t),c.start(n),c.stop(n+a+.02)}function T(e,t,n,o,a){const i=function(e){return J.tuningA4*Math.pow(2,(e-69)/12)}(n);switch(J.soundPreset){case"upright":return function(e,t,n,o,a){const i=e.createGain(),r=e.createOscillator();r.type="sawtooth",r.frequency.value=n-.4;const s=e.createOscillator();s.type="triangle",s.frequency.value=n+.4;const c=e.createGain(),l=e.createGain();c.gain.value=.25*a,l.gain.value=.55*a,r.connect(c),s.connect(l),c.connect(i),l.connect(i),i.gain.setValueAtTime(1e-4,o),i.gain.linearRampToValueAtTime(.9*a,o+.004),i.gain.exponentialRampToValueAtTime(1e-4,o+1.8),i.connect(t),r.start(o),s.start(o),r.stop(o+2),s.stop(o+2),M(e,t,o,a)}(e,t,i,o,a);case"rhodes":return function(e,t,n,o,a){const i=e.createGain(),r=e.createOscillator();r.type="sine",r.frequency.value=n;const s=e.createOscillator();s.type="sine",s.frequency.value=4*n;const c=e.createGain(),l=e.createGain();c.gain.value=.7*a,l.gain.setValueAtTime(.25*a,o),l.gain.exponentialRampToValueAtTime(1e-4,o+.3),r.connect(c),s.connect(l),c.connect(i),l.connect(i),i.gain.setValueAtTime(1e-4,o),i.gain.linearRampToValueAtTime(.85*a,o+.008),i.gain.exponentialRampToValueAtTime(1e-4,o+3),i.connect(t),r.start(o),s.start(o),r.stop(o+3.2),s.stop(o+.5)}(e,t,i,o,a);case"harpsichord":return function(e,t,n,o,a){const i=e.createGain(),r=e.createOscillator();r.type="sawtooth",r.frequency.value=n;const s=e.createOscillator();s.type="square",s.frequency.value=2*n;const c=e.createGain(),l=e.createGain();c.gain.value=.5*a,l.gain.value=.2*a,r.connect(c),s.connect(l),c.connect(i),l.connect(i),i.gain.setValueAtTime(1e-4,o),i.gain.linearRampToValueAtTime(.8*a,o+.001),i.gain.exponentialRampToValueAtTime(1e-4,o+1.1),i.connect(t),r.start(o),s.start(o),r.stop(o+1.2),s.stop(o+1.2)}(e,t,i,o,a);case"honkytonk":return function(e,t,n,o,a){const i=e.createGain(),r=e.createOscillator();r.type="triangle",r.frequency.value=n-1.8;const s=e.createOscillator();s.type="sawtooth",s.frequency.value=n+1.8;const c=e.createGain(),l=e.createGain();c.gain.value=.4*a,l.gain.value=.3*a,r.connect(c),s.connect(l),c.connect(i),l.connect(i),i.gain.setValueAtTime(1e-4,o),i.gain.linearRampToValueAtTime(.75*a,o+.005),i.gain.exponentialRampToValueAtTime(1e-4,o+1.6),i.connect(t),r.start(o),s.start(o),r.stop(o+1.8),s.stop(o+1.8),M(e,t,o,.7*a)}(e,t,i,o,a);case"pad":return function(e,t,n,o,a){const i=e.createGain(),r=e.createOscillator();r.type="sine",r.frequency.value=n;const s=e.createOscillator();s.type="triangle",s.frequency.value=1.002*n;const c=e.createGain(),l=e.createGain();c.gain.value=.5*a,l.gain.value=.3*a,r.connect(c),s.connect(l),c.connect(i),l.connect(i),i.gain.setValueAtTime(1e-4,o),i.gain.linearRampToValueAtTime(.7*a,o+.35),i.gain.exponentialRampToValueAtTime(1e-4,o+3.5),i.connect(t),r.start(o),s.start(o),r.stop(o+3.7),s.stop(o+3.7)}(e,t,i,o,a);default:return function(e,t,n,o,a){C.forEach(i=>{const r=Math.sqrt(1+35e-5*i.n*i.n),s=e.createOscillator();s.type="sine",s.frequency.value=n*i.n*r;const c=e.createGain(),l=a*i.amp*.55;c.gain.setValueAtTime(1e-4,o),c.gain.linearRampToValueAtTime(l,o+.006),c.gain.exponentialRampToValueAtTime(1e-4,o+i.decay),s.connect(c),c.connect(t),s.start(o),s.stop(o+i.decay+.05)}),M(e,t,o,a)}(e,t,i,o,a)}}function j(e,t,n){n=void 0===n?1:n;const o=P(),a=o.createGain(),i=o.createDynamicsCompressor();i.threshold.value=-20,i.knee.value=12,i.ratio.value=3,i.attack.value=.003,i.release.value=.25;const r=e.reduce((e,t)=>e+t,0)/e.length,s=o.createBiquadFilter();s.type="lowpass",s.frequency.value=(800+r/128*8e3)*(.5+.8*J.warmth),s.Q.value="harpsichord"===J.soundPreset?.9:.3,a.connect(i),i.connect(s),s.connect(S.masterBus);const c=e.length;e.forEach((e,i)=>{const r=(0===i?.85:.6)/Math.sqrt(c)*n;T(o,a,e,t+.012*i,r)})}function $(e,t){const n=I(J.progression,J.upperStructure,J.voicingStyle),a=n.length?n[n.length-1]:null,i=y(v(e,B({rootPc:e,qualityId:t,quality:o[t]},J.upperStructure),a),J.voicingStyle);j(i,P().currentTime),O(i)}function V(e){const t=I(J.progression,J.upperStructure,J.voicingStyle);t[e]&&(j(t[e],P().currentTime),O(t[e]))}function O(e){if(!ee.piano)return;const t=new Set(e.map(e=>(e%12+12)%12));ee.piano.querySelectorAll("[data-midi]").forEach(e=>{const n=(Number(e.dataset.midi)%12+12)%12;e.classList.toggle("preview",t.has(n))})}function N(e){ee.piano&&ee.piano.querySelectorAll("[data-midi]").forEach(t=>{const n=(Number(t.dataset.midi)%12+12)%12;t.classList.toggle("scale-hint",e.has(n))})}const z={none:{sustain:!0,events:[{offset:0,dur:1,voices:"all",velMul:1}]},lofi:{cellBeats:2,events:[{offset:0,dur:1.5,voices:"all",velMul:.9},{offset:1.5,dur:.4,voices:"upper",velMul:.55}]},house:{cellBeats:1,events:[{offset:0,dur:.4,voices:"all",velMul:1}]},cinematic:{sustain:!0,events:[{offset:0,dur:1,voices:"all",velMul:.85}]}};function D(e,t){const n=z[t]||z.none;if(n.sustain)return n.events.map(t=>({beatOffset:0,beatDur:e,voices:t.voices,velMul:t.velMul}));const o=n.cellBeats,a=[];for(let t=0;t<e;t+=o)n.events.forEach(n=>{const o=t+n.offset;if(o>=e)return;const i=Math.min(n.dur,e-o);i<=0||a.push({beatOffset:o,beatDur:i,voices:n.voices,velMul:n.velMul})});return a.length?a:[{beatOffset:0,beatDur:e,voices:"all",velMul:1}]}function F(e,t){return"root"===t?e.length?[e[0]]:[]:"upper"===t?e.slice(1):e}function G(e,t){if(!e.length)return;const n=P(),o=60/(t=t||100),a=I(e,J.upperStructure,J.voicingStyle);let i=0;a.forEach((t,a)=>{const r=e[a]&&e[a].beats||4;D(r,J.genre).forEach(e=>{const a=F(t,e.voices);a.length&&j(a,n.currentTime+i+e.beatOffset*o+.02,e.velMul)}),i+=r*o})}async function R(e,t){if(!e.length)return null;const n=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!n)return null;const o=function(e,t){const n=60/(t=t||100);return e.reduce((e,t)=>e+(t.beats||4)*n,0)+5}(e,t),a=L&&L.sampleRate||44100,i=new n(2,Math.ceil(o*a),a),r=L,s=S;L=i,S=q(i),A(0);try{G(e,t);return function(e){const t=e.numberOfChannels,n=e.sampleRate,o=e.length,a=2*t,i=o*a,r=new ArrayBuffer(44+i),s=new DataView(r);function c(e,t){for(let n=0;n<t.length;n++)s.setUint8(e+n,t.charCodeAt(n))}c(0,"RIFF"),s.setUint32(4,36+i,!0),c(8,"WAVE"),c(12,"fmt "),s.setUint32(16,16,!0),s.setUint16(20,1,!0),s.setUint16(22,t,!0),s.setUint32(24,n,!0),s.setUint32(28,n*a,!0),s.setUint16(32,a,!0),s.setUint16(34,16,!0),c(36,"data"),s.setUint32(40,i,!0);const l=[];for(let n=0;n<t;n++)l.push(e.getChannelData(n));let d=44;for(let e=0;e<o;e++)for(let n=0;n<t;n++){const t=Math.max(-1,Math.min(1,l[n][e]));s.setInt16(d,t<0?32768*t:32767*t,!0),d+=2}return new Uint8Array(r)}(await i.startRendering())}finally{L=r,S=s}}function H(e){let t=[127&e];for(e>>=7;e>0;)t.unshift(127&e|128),e>>=7;return t}function U(e,t,n,o,a,i,r){t=t||480,n=n||100,i=i||[];const s=[],c=[];let l=0;I(e,o,a).forEach((n,o)=>{c[o]=l;const a=e[o]&&e[o].beats||4;D(a,r).forEach(e=>{const o=F(n,e.voices),a=l+Math.round(t*e.beatOffset),i=a+Math.round(t*e.beatDur),r=Math.max(1,Math.min(127,Math.round(90*e.velMul)));o.forEach(e=>s.push({tick:a,kind:"noteon",note:e,velocity:r})),o.forEach(e=>s.push({tick:i,kind:"noteoff",note:e}))}),l+=t*a}),i.forEach(e=>{const t=c[e.index];void 0!==t&&s.push({tick:t,kind:"marker",text:e.label})}),s.sort((e,t)=>e.tick!==t.tick?e.tick-t.tick:"marker"===e.kind?-1:"marker"===t.kind?1:0);let d=[];const u=Math.round(6e7/n);d.push(...H(0),255,81,3,u>>16&255,u>>8&255,255&u);let m=0;s.forEach(e=>{const t=e.tick-m;if(m=e.tick,d.push(...H(t)),"marker"===e.kind){const t=String(e.text).split("").map(e=>255&e.charCodeAt(0));d.push(255,6,t.length,...t)}else d.push("noteon"===e.kind?144:128,127&e.note,"noteon"===e.kind?e.velocity||90:0)}),d.push(...H(0),255,47,0);const p=[77,84,104,100,0,0,0,6,0,0,0,1,t>>8&255,255&t],g=d.length;return new Uint8Array([...p,...[77,84,114,107,g>>24&255,g>>16&255,g>>8&255,255&g],...d])}function W(e,t,n){const o=new Blob([e],{type:t}),a=URL.createObjectURL(o),i=document.createElement("a");i.href=a,i.download=n,document.body.appendChild(i),i.click(),document.body.removeChild(i),setTimeout(()=>URL.revokeObjectURL(a),1e3)}async function K(e,t,n,o){if(!e||e.disabled)return;const a=e.textContent;e.disabled=!0,e.textContent="Rendere Audio …";try{const e=await t();e?W(e,"audio/wav",n):alert("WAV-Export wird von diesem Browser nicht unterstützt.")}catch(e){alert("WAV-Export fehlgeschlagen: "+(e&&e.message?e.message:e))}finally{e.textContent=a,e.disabled=!!o&&o()}}function Z(){const e=[],t=[];return J.song.sections.forEach(n=>{for(let o=0;o<n.repeats;o++)n.chords.length&&t.push({index:e.length,label:ne(n)+(n.repeats>1?` (${o+1}/${n.repeats})`:"")}),n.chords.forEach(t=>e.push(t))}),{flat:e,markers:t}}const J={progression:[],lang:"de",noteLang:"en",genre:"none",mode:"forward",critiquePos:null,upperStructure:"none",bpm:100,voicingStyle:"close",activeView:"editor",song:{sections:[]},editingSectionId:null,soundPreset:"grand",reverbAmount:.3,warmth:.8,tuningA4:440};let _=J.progression,Q=0;const X={intro:{label:"Intro"},verse:{label:"Verse"},chorus:{label:"Chorus"},bridge:{label:"Bridge"},outro:{label:"Outro"},custom:{label:"Eigene Sektion"}},Y={forward:"Baue eine Progression Akkord für Akkord vorwärts auf.",backward:"Gib zuerst deinen Zielakkord ein (Text/Klaviatur/MIDI) — die Vorschläge zeigen dann, was gut davor passt. Jeder gewählte Vorschlag wird vorne angehängt.",critique:"Klick einen Akkord in der Progression an, um Ersatzvorschläge für genau diese Position zu sehen — bewertet nach beiden Nachbarn."},ee={input:document.getElementById("chordInput"),addBtn:document.getElementById("addBtn"),progression:document.getElementById("progression"),keyReadout:document.getElementById("keyReadout"),suggestions:document.getElementById("suggestions"),complexity:document.getElementById("complexity"),complexityVal:document.getElementById("complexityVal"),bpmInput:document.getElementById("bpmInput"),playProgBtn:document.getElementById("playProgBtn"),exportMidiBtn:document.getElementById("exportMidiBtn"),exportWavBtn:document.getElementById("exportWavBtn"),presetNameInput:document.getElementById("presetNameInput"),savePresetBtn:document.getElementById("savePresetBtn"),presetsList:document.getElementById("presetsList"),shareLinkBtn:document.getElementById("shareLinkBtn"),undoBtn:document.getElementById("undoBtn"),resetBtn:document.getElementById("resetBtn"),piano:document.getElementById("piano"),circleOfFifths:document.getElementById("circleOfFifths"),pianoChordPreview:document.getElementById("pianoChordPreview"),pianoCommitBtn:document.getElementById("pianoCommitBtn"),pianoClearBtn:document.getElementById("pianoClearBtn"),midiConnectBtn:document.getElementById("midiConnectBtn"),midiStatus:document.getElementById("midiStatus"),midiHeldNotes:document.getElementById("midiHeldNotes"),midiChordPreview:document.getElementById("midiChordPreview"),midiCommitBtn:document.getElementById("midiCommitBtn"),modeHint:document.getElementById("modeHint"),addChordPanel:document.getElementById("addChordPanel"),addChordTitle:document.getElementById("addChordTitle"),suggestionsTitle:document.getElementById("suggestionsTitle"),editorView:document.getElementById("editorView"),songView:document.getElementById("songView"),leadsheetView:document.getElementById("leadsheetView"),sectionEditBanner:document.getElementById("sectionEditBanner"),sectionEditLabel:document.getElementById("sectionEditLabel"),backToSongBtn:document.getElementById("backToSongBtn"),sectionsList:document.getElementById("sectionsList"),songReadout:document.getElementById("songReadout"),playSongBtn:document.getElementById("playSongBtn"),exportSongMidiBtn:document.getElementById("exportSongMidiBtn"),exportSongWavBtn:document.getElementById("exportSongWavBtn"),leadsheetBtn:document.getElementById("leadsheetBtn"),leadsheetContent:document.getElementById("leadsheetContent"),leadsheetBackBtn:document.getElementById("leadsheetBackBtn"),leadsheetPrintBtn:document.getElementById("leadsheetPrintBtn"),leadsheetPdfBtn:document.getElementById("leadsheetPdfBtn")};function te(e){J.activeView=e,ee.editorView.hidden="editor"!==e,ee.songView.hidden="song"!==e,ee.leadsheetView.hidden="leadsheet"!==e,document.querySelectorAll(".view-btn").forEach(t=>{t.classList.toggle("active",t.getAttribute("data-view")===e||"leadsheet"===e&&"song"===t.getAttribute("data-view"))}),"editor"===e&&ce(),"song"===e&&de(),"leadsheet"===e&&function(){const e=ue();if(!e.length)return void(ee.leadsheetContent.innerHTML='<span class="empty-hint">Noch keine Akkorde im Song — erst Sektionen füllen.</span>');ee.leadsheetContent.innerHTML=e.map(e=>`\n      <div class="leadsheet-section">\n        <div class="leadsheet-section-title">${e.title}</div>\n        <div class="leadsheet-grid">\n          ${e.chords.map(e=>`<div class="leadsheet-chord">${e}</div>`).join("")}\n        </div>\n      </div>\n    `).join("")}()}function ne(e){return e.customLabel&&e.customLabel.trim()?e.customLabel.trim():X[e.type].label}function oe(e){const t=J.song.sections.find(t=>t.id===e);t&&(null===J.editingSectionId&&(_=J.progression),J.editingSectionId=e,J.progression=t.chords,J.critiquePos=null,ee.sectionEditBanner.hidden=!1,ee.sectionEditLabel.textContent=ne(t),te("editor"))}function ae(){J.editingSectionId=null,J.progression=_,ee.sectionEditBanner.hidden=!0,te("song")}function ie(e){"critique"!==J.mode&&("backward"===J.mode?J.progression.unshift(e):J.progression.push(e),ce())}function re(e,t){null!=e&&J.progression[e]&&(J.progression[e]=t,ce())}const se={forward:"Noch kein Akkord — oben eingeben oder ein Beispiel laden.",backward:"Noch kein Zielakkord — oben eingeben. Vorschläge werden dann davor angehängt.",critique:"Kritik-Modus braucht eine bestehende Progression — erst im Vorwärts-Modus aufbauen."};function ce(){if(ee.modeHint.textContent=Y[J.mode],ee.addChordPanel.style.display="critique"===J.mode?"none":"",ee.addChordTitle.textContent="backward"===J.mode&&0===J.progression.length?"Zielakkord festlegen":"Akkord hinzufügen",ee.suggestionsTitle.textContent={forward:"Vorschläge — nächster Akkord",backward:"Vorschläge — vorheriger Akkord",critique:null!==J.critiquePos?`Vorschläge — Ersatz für Position ${J.critiquePos+1}`:"Vorschläge — Position wählen"}[J.mode],ee.progression.innerHTML="",J.progression.length){const t=p(J.progression),n=u(t.tonicPc,t.mode),o=d[t.mode].romans;J.progression.forEach((a,r)=>{if(r>0){const e=document.createElement("span");e.className="arrow",e.textContent="→",ee.progression.appendChild(e)}const s=document.createElement("div");s.className="chip","critique"===J.mode&&(s.classList.add("critique-pick"),J.critiquePos===r&&s.classList.add("critique-target"));const c=n.indexOf(a.rootPc),l=-1!==c?o[c]:"?",m=a.register||0,p=a.beats||4,g=function(e,t){const n=u(t.tonicPc,t.mode).indexOf(e.rootPc);let o;o=-1!==n?x[(x.indexOf(t.mode)+n)%7]:k(e.qualityId)?"mixolydian":"m"===e.quality.base?"dorian":"dim"===e.quality.base?"locrian":"lydian";const a=u(e.rootPc,o);return{tonicPc:e.rootPc,modeId:o,scalePcSet:new Set(a)}}(a,t);s.innerHTML=`<div class="chip-row"><span class="num">${r+1}</span><span>${a.label}</span><span class="deg">${l}</span><span class="bass-ctrl" title="Umkehrung / freier Bass (unabhängig vom Akkord wählbar)"><select class="bass-select"></select></span><span class="reg-ctrl" title="Oktavlage der Voicing"><button class="reg-up">▴</button><span class="reg-val${0!==m?" shifted":""}">${m>0?"+"+m:m}</span><button class="reg-down">▾</button></span><span class="beat-ctrl" title="Dauer in Beats (wirkt auf Abspielen und MIDI-Export)"><button class="beat-up">▴</button><span class="beat-val${4!==p?" shifted":""}">${p}♩</span><button class="beat-down">▾</button></span><span class="del" title="Entfernen">×</span></div><div class="chip-scale">${noteLabel(g.tonicPc,J.noteLang)} ${d[g.modeId].label}</div>`,s.addEventListener("mouseenter",()=>N(g.scalePcSet)),s.addEventListener("mouseleave",()=>{ee.piano&&ee.piano.querySelectorAll(".scale-hint").forEach(e=>e.classList.remove("scale-hint"))});const h=s.querySelector(".bass-select"),f=Array.from(new Set(a.quality.intervals.filter(e=>e>0&&e<12))).sort((e,t)=>e-t),b=[{pc:a.rootPc,label:"Grundstellung"}];f.forEach((t,n)=>{b.push({pc:(a.rootPc+t)%12,label:n+1+". Umkehrung ("+noteLabel((a.rootPc+t)%12,J.noteLang)+")"})});const v=new Set(b.map(e=>e.pc));e.forEach((n,t)=>{v.has(t)||b.push({pc:t,label:"Bass: "+noteLabel(t,J.noteLang)})}),h.innerHTML=b.map(e=>`<option value="${e.pc}"${e.pc===a.bassPc?" selected":""}>${e.label}</option>`).join(""),a.bassPc!==a.rootPc&&h.classList.add("shifted"),h.addEventListener("click",e=>e.stopPropagation()),h.addEventListener("change",e=>{e.stopPropagation(),a.bassPc=Number(h.value),a.label=i(a.rootPc,a.qualityId,a.bassPc),ce(),V(r)}),s.querySelector(".del").addEventListener("click",e=>{e.stopPropagation(),J.progression.splice(r,1),J.critiquePos===r&&(J.critiquePos=null),ce()}),s.querySelector(".reg-up").addEventListener("click",e=>{e.stopPropagation(),a.register=Math.min(3,(a.register||0)+1),ce(),V(r)}),s.querySelector(".reg-down").addEventListener("click",e=>{e.stopPropagation(),a.register=Math.max(-3,(a.register||0)-1),ce(),V(r)}),s.querySelector(".beat-up").addEventListener("click",e=>{e.stopPropagation(),a.beats=Math.min(8,(a.beats||4)+1),ce()}),s.querySelector(".beat-down").addEventListener("click",e=>{e.stopPropagation(),a.beats=Math.max(1,(a.beats||4)-1),ce()}),s.addEventListener("click",e=>{e.target.closest(".del")||e.target.closest(".reg-ctrl")||e.target.closest(".beat-ctrl")||e.target.closest(".bass-ctrl")||("critique"===J.mode?(J.critiquePos=r,ce()):(V(r),N(g.scalePcSet)))}),ee.progression.appendChild(s)})}else{const e=document.createElement("span");e.className="empty-hint",e.textContent=se[J.mode],ee.progression.appendChild(e)}if(J.progression.length){const t=p(J.progression),n=noteLabel(t.tonicPc,J.noteLang),o=d[t.mode].label,a=u(t.tonicPc,t.mode).map(t=>noteLabel(t,J.noteLang)).join("–");ee.keyReadout.innerHTML="Erkannte Tonart: <b>"+n+" "+o+'</b> <span style="color:var(--text-faint)">('+a+")</span>"}else ee.keyReadout.textContent="Erkannte Tonart: —";ee.playProgBtn.disabled=0===J.progression.length,ee.exportMidiBtn.disabled=0===J.progression.length,ee.exportWavBtn.disabled=0===J.progression.length,ee.undoBtn.disabled=0===J.progression.length,le(),qe()}function le(){ee.suggestions.innerHTML="";const t=parseInt(ee.complexity.value,10),{list:n}=f(J.progression,t,J.genre,J.mode,J.critiquePos);if(n.forEach(t=>{const n=o[t.qualityId],a=noteLabel(t.rootPc,J.noteLang)+n.display,i=document.createElement("div");i.className="card";const r=t.tag,s={diatonic:"diatonisch",secondary:"sek.-dominante",borrowed:"entlehnt",chromatic:"chromatisch",jazz:"jazz-farbe",substitute:"substitution"}[t.tag];i.innerHTML=`\n        <div class="chord-sym">${a}</div>\n        <div class="tag ${r}">${s} · ${t.romanLabel}</div>\n        <div class="fitbar-track"><div class="fitbar-fill" style="width:${t.pct}%"></div></div>\n        <div class="card-foot">\n          <span class="fit-pct">${t.pct}% Fit</span>\n          <button class="play-btn" title="Anhören">▶</button>\n        </div>\n      `,i.querySelector(".play-btn").addEventListener("click",e=>{e.stopPropagation(),$(t.rootPc,t.qualityId)}),i.addEventListener("click",()=>{const e={rootPc:t.rootPc,qualityId:t.qualityId,quality:n,bassPc:t.rootPc,label:a};"critique"===J.mode?re(J.critiquePos,e):ie(e)}),ee.suggestions.appendChild(i)}),!n.length){const e=document.createElement("div");e.className="empty-hint",e.textContent="critique"===J.mode?J.progression.length?"Klick oben einen Akkord in der Progression an.":"Erst eine Progression aufbauen (Vorwärts-Modus).":"backward"===J.mode?"Erst Zielakkord eingeben.":"Keine Vorschläge.",ee.suggestions.appendChild(e)}}function de(){const e=J.song.sections;if(ee.sectionsList.innerHTML="",e.length)e.forEach((t,n)=>{const o=document.createElement("div");o.className="section-card";const a=t.chords.length?t.chords.map(e=>`<span class="mini-chip">${e.label}</span>`).join('<span class="mini-arrow">→</span>'):'<span class="empty-hint">leer</span>';o.innerHTML=`\n          <div class="section-card-head">\n            <div class="section-card-title">\n              <span class="section-type-badge">${X[t.type].label}</span>\n              ${"custom"===t.type?`<input type="text" class="section-name-input" value="${t.customLabel||""}" placeholder="Name der Sektion" style="width:140px;padding:6px 8px;font-size:12px;">`:`<span>${ne(t)}</span>`}\n            </div>\n            <div class="section-card-actions">\n              <span class="repeat-ctrl" title="Wiederholungen"><button class="rep-down">▾</button><span>${t.repeats}×</span><button class="rep-up">▴</button></span>\n              <button class="move-up" title="Nach oben" ${0===n?"disabled":""}>↑</button>\n              <button class="move-down" title="Nach unten" ${n===e.length-1?"disabled":""}>↓</button>\n              <button class="edit-section">Bearbeiten</button>\n              <button class="ghost del-section">Löschen</button>\n            </div>\n          </div>\n          <div class="section-chords">${a}</div>\n        `,"custom"===t.type&&o.querySelector(".section-name-input").addEventListener("change",e=>{t.customLabel=e.target.value,de()}),o.querySelector(".rep-up").addEventListener("click",()=>{t.repeats=Math.min(16,t.repeats+1),de()}),o.querySelector(".rep-down").addEventListener("click",()=>{t.repeats=Math.max(1,t.repeats-1),de()}),o.querySelector(".move-up").addEventListener("click",()=>{0!==n&&([e[n-1],e[n]]=[e[n],e[n-1]],de())}),o.querySelector(".move-down").addEventListener("click",()=>{n!==e.length-1&&([e[n+1],e[n]]=[e[n],e[n+1]],de())}),o.querySelector(".edit-section").addEventListener("click",()=>oe(t.id)),o.querySelector(".del-section").addEventListener("click",()=>{e.splice(n,1),de()}),ee.sectionsList.appendChild(o)});else{const e=document.createElement("span");e.className="empty-hint",e.textContent="Noch keine Sektionen — oben eine hinzufügen.",ee.sectionsList.appendChild(e)}const t=e.reduce((e,t)=>e+t.chords.length*t.repeats,0);ee.songReadout.textContent=t?`${e.length} Sektion${1===e.length?"":"en"}, ${t} Akkorde insgesamt (inkl. Wiederholungen)`:"Noch keine Akkorde im Song.",ee.playSongBtn.disabled=0===t,ee.exportSongMidiBtn.disabled=0===t,ee.exportSongWavBtn.disabled=0===t,ee.leadsheetBtn.disabled=0===t}function ue(){return J.song.sections.filter(e=>e.chords.length).map(e=>({title:ne(e)+(e.repeats>1?" × "+e.repeats:""),chords:e.chords.map(e=>e.label)}))}function me(){const e=r(ee.input.value);if(!e)return ee.input.style.borderColor="var(--red)",void setTimeout(()=>{ee.input.style.borderColor=""},700);ie(e),ee.input.value="",ee.input.focus()}document.querySelectorAll(".view-btn").forEach(e=>{e.addEventListener("click",()=>{const t=e.getAttribute("data-view");"song"===t&&null!==J.editingSectionId?ae():te(t)})}),document.querySelectorAll(".section-add-btn").forEach(e=>{e.addEventListener("click",()=>{const t=function(e){const t=J.song.sections,n=t[t.length-1],o=[];if(n&&n.chords.length){const e=n.chords[n.chords.length-1];o.push({rootPc:e.rootPc,qualityId:e.qualityId,quality:e.quality,bassPc:e.bassPc,label:e.label})}const a={id:"sec"+Q++,type:e,customLabel:null,chords:o,repeats:1};return t.push(a),a}(e.getAttribute("data-sectype"));de(),oe(t.id)})}),ee.backToSongBtn.addEventListener("click",ae),ee.playSongBtn.addEventListener("click",function(){const{flat:e}=Z();e.length&&G(e,J.bpm)}),ee.exportSongMidiBtn.addEventListener("click",function(){const{flat:e,markers:t}=Z();if(!e.length)return;W(U(e,480,J.bpm,J.upperStructure,J.voicingStyle,t,J.genre),"audio/midi","elastic-composer-song.mid")}),ee.exportSongWavBtn.addEventListener("click",function(){const{flat:e}=Z();if(e.length)return K(ee.exportSongWavBtn,()=>R(e,J.bpm),"elastic-composer-song.wav",()=>0===Z().flat.length)}),ee.leadsheetBtn.addEventListener("click",()=>te("leadsheet")),ee.leadsheetBackBtn.addEventListener("click",()=>te("song")),ee.leadsheetPrintBtn.addEventListener("click",()=>window.print()),ee.leadsheetPdfBtn.addEventListener("click",async function(){const e=ue();if(!e.length)return;const t=ee.leadsheetPdfBtn;if(!t||t.disabled)return;const n=t.textContent;t.disabled=!0,t.textContent="Erzeuge PDF …";try{const t=function(e,t){const n=new e({unit:"pt",format:"a4"}),o=n.internal.pageSize.getWidth(),a=n.internal.pageSize.getHeight(),i=48;let r=56;return n.setFont("helvetica","bold"),n.setFontSize(20),n.text("Elastic Composer — Leadsheet",i,r),r+=34,t.forEach(e=>{r>a-80&&(n.addPage(),r=56),n.setFont("helvetica","bold"),n.setFontSize(13),n.text(e.title,i,r),r+=22,n.setFont("courier","normal"),n.setFontSize(16);let t=i;e.chords.forEach(e=>{t+70>o-i&&(t=i,r+=26,r>a-60&&(n.addPage(),r=56,t=i)),n.text(e,t,r),t+=70}),r+=42}),n}(await(window.jspdf&&window.jspdf.jsPDF?Promise.resolve(window.jspdf.jsPDF):new Promise((e,t)=>{let n=document.getElementById("jspdf-cdn-script");n||(n=document.createElement("script"),n.id="jspdf-cdn-script",n.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",document.head.appendChild(n)),n.addEventListener("load",()=>{window.jspdf&&window.jspdf.jsPDF?e(window.jspdf.jsPDF):t(new Error("jsPDF nicht verfügbar"))},{once:!0}),n.addEventListener("error",()=>t(new Error("jsPDF konnte nicht geladen werden")),{once:!0})})),e);t.save("elastic-composer-leadsheet.pdf")}catch(e){alert("PDF-Export fehlgeschlagen: "+(e&&e.message?e.message:e))}finally{t.disabled=!1,t.textContent=n}}),ee.addBtn.addEventListener("click",me),ee.input.addEventListener("keydown",e=>{"Enter"===e.key&&me()}),ee.complexity.addEventListener("input",()=>{ee.complexityVal.textContent=ee.complexity.value+" / 100",le()}),document.querySelectorAll(".mode-btn").forEach(e=>{e.addEventListener("click",()=>{J.mode=e.getAttribute("data-mode"),J.critiquePos=null,document.querySelectorAll(".mode-btn").forEach(t=>t.classList.toggle("active",t===e)),ce()})}),document.querySelectorAll(".genre-btn").forEach(e=>{e.addEventListener("click",()=>{J.genre=e.getAttribute("data-genre"),document.querySelectorAll(".genre-btn").forEach(t=>t.classList.toggle("active",t===e)),le()})}),document.querySelectorAll(".us-btn").forEach(e=>{e.addEventListener("click",()=>{J.upperStructure=e.getAttribute("data-us"),document.querySelectorAll(".us-btn").forEach(t=>t.classList.toggle("active",t===e))})}),document.querySelectorAll(".vs-btn").forEach(e=>{e.addEventListener("click",()=>{J.voicingStyle=e.getAttribute("data-vs"),document.querySelectorAll(".vs-btn").forEach(t=>t.classList.toggle("active",t===e))})}),document.querySelectorAll(".sound-btn").forEach(e=>{e.addEventListener("click",()=>{J.soundPreset=e.getAttribute("data-sound"),document.querySelectorAll(".sound-btn").forEach(t=>t.classList.toggle("active",t===e))})});const pe=document.getElementById("reverbSlider"),ge=document.getElementById("reverbVal");pe.addEventListener("input",()=>{J.reverbAmount=Number(pe.value)/100,ge.textContent=pe.value+"%",L&&A(L.currentTime)});const he=document.getElementById("warmthSlider"),fe=document.getElementById("warmthVal");he.addEventListener("input",()=>{J.warmth=Number(he.value)/100,fe.textContent=he.value+"%"}),document.querySelectorAll(".tuning-btn").forEach(e=>{e.addEventListener("click",()=>{J.tuningA4=Number(e.getAttribute("data-tuning")),document.querySelectorAll(".tuning-btn").forEach(t=>t.classList.toggle("active",t===e))})}),document.querySelectorAll(".notelang-btn").forEach(e=>{e.addEventListener("click",()=>{J.noteLang=e.getAttribute("data-notelang"),document.querySelectorAll(".notelang-btn").forEach(t=>t.classList.toggle("active",t===e)),(()=>{const relabel=c=>{c.label=_mkLabel(c.rootPc,c.qualityId,c.bassPc)};J.progression.forEach(relabel);J.song.sections.forEach(s=>s.chords.forEach(relabel))})(),ce(),"function"==typeof de&&de(),(()=>{try{localStorage.setItem("ecNoteLang",J.noteLang)}catch(t){}})()})}),ee.playProgBtn.addEventListener("click",()=>G(J.progression,J.bpm)),ee.bpmInput.addEventListener("change",()=>{let e=parseInt(ee.bpmInput.value,10);isNaN(e)&&(e=100),e=Math.min(240,Math.max(40,e)),ee.bpmInput.value=e,J.bpm=e}),ee.exportMidiBtn.addEventListener("click",()=>function(e){if(!e.length)return;W(U(e,480,J.bpm,J.upperStructure,J.voicingStyle,void 0,J.genre),"audio/midi","elastic-composer-progression.mid")}(J.progression)),ee.exportWavBtn.addEventListener("click",()=>{return e=J.progression,K(ee.exportWavBtn,()=>R(e,J.bpm),"elastic-composer-progression.wav",()=>0===J.progression.length);var e}),ee.undoBtn.addEventListener("click",()=>{J.progression.pop(),ce()}),ee.resetBtn.addEventListener("click",()=>{J.progression.length=0,ce()}),document.querySelectorAll(".presets button[data-preset]").forEach(e=>{e.addEventListener("click",()=>{const t=e.getAttribute("data-preset").split(",");J.progression=t.map(r).filter(Boolean),ce()})}),document.querySelectorAll(".tab-btn").forEach(e=>{e.addEventListener("click",()=>{const t=e.getAttribute("data-tab");document.querySelectorAll(".tab-btn").forEach(t=>t.classList.toggle("active",t===e)),document.querySelectorAll(".tab-panel").forEach(e=>{e.hidden=e.getAttribute("data-tab-panel")!==t})})});const be=[0,2,4,5,7,9,11],ve={0:1,1:3,3:6,4:8,5:10},ye=new Set;function Ee(){const e=s(ye);e?(ee.pianoChordPreview.innerHTML='→ <b style="color:var(--green)">'+e.label+"</b>",ee.pianoCommitBtn.disabled=!1,ee.pianoCommitBtn.onclick=()=>{ie(e)}):(ee.pianoChordPreview.innerHTML=0===ye.size?'<span class="none">Töne anklicken — mind. 2, tiefster Ton = Grundton</span>':'<span class="none">kein erkannter Akkord</span>',ee.pianoCommitBtn.disabled=!0,ee.pianoCommitBtn.onclick=null)}function ke(e,t,n,o){const a=o*Math.PI/180;return{x:e+n*Math.cos(a),y:t+n*Math.sin(a)}}function we(e,t,n,o,a,i){const r=ke(e,t,o,a),s=ke(e,t,o,i),c=ke(e,t,n,i),l=ke(e,t,n,a);return`M ${r.x} ${r.y} A ${o} ${o} 0 0 1 ${s.x} ${s.y} L ${c.x} ${c.y} A ${n} ${n} 0 0 0 ${l.x} ${l.y} Z`}ee.pianoClearBtn.addEventListener("click",()=>{ye.clear(),ee.piano.querySelectorAll(".active").forEach(e=>e.classList.remove("active")),Ee()}),function(){const e=[],t=[];for(let t=0;t<2;t++)be.forEach((n,o)=>e.push({midi:48+12*t+n,whiteIndex:7*t+o}));e.push({midi:72,whiteIndex:14});for(let e=0;e<2;e++)Object.entries(ve).forEach(([n,o])=>{t.push({midi:48+12*e+Number(o),afterWhiteIndex:7*e+Number(n)})});const n=100/e.length,o=.62*n;ee.piano.innerHTML="",e.forEach(e=>{const t=document.createElement("div");t.className="pkey-white",t.dataset.midi=e.midi,ee.piano.appendChild(t)}),t.forEach(e=>{const t=document.createElement("div");t.className="pkey-black",t.dataset.midi=e.midi,t.style.left=(e.afterWhiteIndex+1)*n-o/2+"%",t.style.width=o+"%",ee.piano.appendChild(t)}),ee.piano.querySelectorAll("[data-midi]").forEach(e=>{e.addEventListener("click",()=>{const t=Number(e.dataset.midi);ye.has(t)?(ye.delete(t),e.classList.remove("active")):(ye.add(t),e.classList.add("active")),function(e){const t=P();T(t,S.masterBus,e,t.currentTime,.5)}(t),Ee()})})}(),Ee();const Be=200,xe=200,Ie=190,Le=130,Se=128,Ae=70;function qe(){if(!ee.circleOfFifths)return;const t=p(J.progression),o=d[t.mode],a=u(t.tonicPc,t.mode),i=ee.circleOfFifths.querySelector("#cofKeyTonic"),r=ee.circleOfFifths.querySelector("#cofKeyMode");if(i&&(i.textContent=J.progression.length?noteLabel(t.tonicPc,J.noteLang):"—"),refreshCofRingLabels(),r&&(r.textContent=J.progression.length?o.label:""),ee.circleOfFifths.querySelectorAll(".cof-seg").forEach(e=>{e.classList.remove("cof-diatonic","cof-tonic")}),J.progression.length){a.forEach((e,t)=>{const a=o.qualities[t],i=n.indexOf(e),r="maj"===a?"outer":"m"===a?"inner":null;if(r){const e=ee.circleOfFifths.querySelector(`.cof-seg[data-ring="${r}"][data-slot="${i}"]`);e&&e.classList.add("cof-diatonic")}});const e=n.indexOf(t.tonicPc),i=o.qualities[0],r="maj"===i||"aug"===i?"outer":"inner",s=ee.circleOfFifths.querySelector(`.cof-seg[data-ring="${r}"][data-slot="${e}"]`);s&&s.classList.add("cof-tonic")}const s=ee.circleOfFifths.querySelector("#cofPathLayer");if(s&&(s.innerHTML="",J.progression.length)){const e=J.progression.map(e=>{const t="m"===e.quality.base||"dim"===e.quality.base?"inner":"outer",o=n.indexOf(e.rootPc);return-1===o?null:function(e,t){return ke(Be,xe,"outer"===e?(Ie+Le)/2:(Se+Ae)/2,30*t-90)}(t,o)}).filter(Boolean);if(e.length>1){const t=e.map((e,t)=>(0===t?"M":"L")+e.x+" "+e.y).join(" ");s.innerHTML+=`<path class="cof-path" d="${t}"></path>`}e.forEach((e,t)=>{s.innerHTML+=`<circle class="cof-path-dot" cx="${e.x}" cy="${e.y}" r="9"></circle>`,s.innerHTML+=`<text class="cof-path-num" x="${e.x}" y="${e.y+3}">${t+1}</text>`})}}!function(){if(!ee.circleOfFifths)return;let t='<defs><marker id="cofArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--blue)"/></marker></defs>';for(let o=0;o<12;o++){const a=30*o-90-15,i=30*o-90+15,r=n[o],s=we(Be,xe,Le,Ie,a,i),c=we(Be,xe,Ae,Se,a,i),l=ke(Be,xe,(Le+Ie)/2,a+15),d=ke(Be,xe,(Ae+Se)/2,a+15);t+=`<path class="cof-seg" data-ring="outer" data-slot="${o}" data-pc="${r}" data-quality="maj" d="${s}"></path>`,t+=`<path class="cof-seg" data-ring="inner" data-slot="${o}" data-pc="${r}" data-quality="m" d="${c}"></path>`,t+=`<text class="cof-label" data-pc="${r}" x="${l.x}" y="${l.y}" dominant-baseline="middle">${noteLabel(r,J.noteLang)}</text>`,t+=`<text class="cof-label cof-label-minor" data-pc="${r}" x="${d.x}" y="${d.y}" dominant-baseline="middle">${noteLabel(r,J.noteLang)}m</text>`}t+=`<circle class="cof-center-bg" cx="${Be}" cy="${xe}" r="66"></circle>`,t+=`<text class="cof-center-text" id="cofKeyTonic" x="${Be}" y="${xe-4}" font-size="22"></text>`,t+=`<text class="cof-center-text cof-center-sub" id="cofKeyMode" x="${Be}" y="${xe+16}"></text>`,t+='<g id="cofPathLayer"></g>',ee.circleOfFifths.innerHTML=t,ee.circleOfFifths.querySelectorAll(".cof-seg").forEach(e=>{e.addEventListener("click",()=>{!function(e,t){const n={rootPc:e,qualityId:t,quality:o[t],bassPc:e,label:i(e,t)};$(e,t),"critique"===J.mode?re(J.critiquePos,n):ie(n)}(Number(e.dataset.pc),e.dataset.quality)})})}(),qe();const Pe=new Set;function Ce(t){const[n,o,a]=t.data,i=240&n;if(144===i&&a>0){Pe.add(o);const e=P();T(e,S.masterBus,o,e.currentTime,.6*Math.min(1,a/127))}else(128===i||144===i&&0===a)&&Pe.delete(o);!function(){ee.midiHeldNotes.innerHTML="",Array.from(Pe).sort((e,t)=>e-t).forEach(t=>{const n=document.createElement("span");n.className="held-note-pill",n.textContent=noteLabel((t%12+12)%12,J.noteLang)+Math.floor(t/12-1),ee.midiHeldNotes.appendChild(n)});const t=s(Pe);t?(ee.midiChordPreview.innerHTML='→ <b style="color:var(--green)">'+t.label+"</b>",ee.midiCommitBtn.disabled=!1,ee.midiCommitBtn.onclick=()=>{ie(t)}):(ee.midiChordPreview.innerHTML=0===Pe.size?'<span class="none">Akkord auf angeschlossenem Controller spielen</span>':'<span class="none">kein erkannter Akkord</span>',ee.midiCommitBtn.disabled=!0,ee.midiCommitBtn.onclick=null)}()}ee.midiConnectBtn.addEventListener("click",()=>{navigator.requestMIDIAccess?(ee.midiStatus.textContent="verbinde …",navigator.requestMIDIAccess({sysex:!1}).then(e=>{const t=Array.from(e.inputs.values());t.length?(t.forEach(e=>{e.onmidimessage=Ce}),ee.midiStatus.textContent="verbunden: "+t.map(e=>e.name).join(", "),ee.midiStatus.classList.add("connected")):ee.midiStatus.textContent="kein MIDI-Gerät gefunden"}).catch(()=>{ee.midiStatus.textContent="Zugriff verweigert oder fehlgeschlagen"})):ee.midiStatus.textContent="Web MIDI wird von diesem Browser nicht unterstützt (Chrome/Edge empfohlen)."}),navigator.requestMIDIAccess||(ee.midiStatus.textContent="Web MIDI wird von diesem Browser nicht unterstützt (Chrome/Edge empfohlen).");const Me="elastic-composer-presets-v1";function Te(){try{const e=localStorage.getItem(Me),t=e?JSON.parse(e):[];return Array.isArray(t)?t:[]}catch(e){return[]}}function je(e){try{localStorage.setItem(Me,JSON.stringify(e))}catch(e){}}function $e(){document.querySelectorAll(".mode-btn").forEach(e=>e.classList.toggle("active",e.getAttribute("data-mode")===J.mode)),document.querySelectorAll(".genre-btn").forEach(e=>e.classList.toggle("active",e.getAttribute("data-genre")===J.genre)),document.querySelectorAll(".us-btn").forEach(e=>e.classList.toggle("active",e.getAttribute("data-us")===J.upperStructure)),document.querySelectorAll(".vs-btn").forEach(e=>e.classList.toggle("active",e.getAttribute("data-vs")===J.voicingStyle)),document.querySelectorAll(".sound-btn").forEach(e=>e.classList.toggle("active",e.getAttribute("data-sound")===J.soundPreset)),document.querySelectorAll(".tuning-btn").forEach(e=>e.classList.toggle("active",Number(e.getAttribute("data-tuning"))===J.tuningA4)),ee.bpmInput.value=J.bpm;const e=document.getElementById("reverbSlider"),t=document.getElementById("reverbVal"),n=Math.round(100*J.reverbAmount);e.value=n,t.textContent=n+"%";const o=document.getElementById("warmthSlider"),a=document.getElementById("warmthVal"),i=Math.round(100*J.warmth);o.value=i,a.textContent=i+"%",L&&A(L.currentTime)}function Ve(){const e=Te();if(ee.presetsList.innerHTML="",!e.length){const e=document.createElement("span");return e.className="empty-hint",e.textContent="Noch keine gespeicherten Presets.",void ee.presetsList.appendChild(e)}e.slice().sort((e,t)=>t.savedAt-e.savedAt).forEach(e=>{const t=document.createElement("div");t.className="preset-item";const n=(e.data.progression||[]).length,o=(e.data.song&&e.data.song.sections||[]).length,a=o?`${o} Sektion${1===o?"":"en"}`:`${n} Akkord${1===n?"":"e"}`;t.innerHTML=`<span class="preset-name">${function(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}(e.name)}</span><span class="preset-meta">${a}</span>`;const i=document.createElement("button");i.textContent="Laden",i.addEventListener("click",()=>{return t=e.data,J.progression=(t.progression||[]).map(e=>({...e})),J.song={sections:(t.song&&t.song.sections||[]).map(e=>({...e,chords:(e.chords||[]).map(e=>({...e}))}))},J.genre=t.genre||"none",J.upperStructure=t.upperStructure||"none",J.voicingStyle=t.voicingStyle||"close",J.bpm=t.bpm||100,J.soundPreset=t.soundPreset||"grand",J.reverbAmount=null!=t.reverbAmount?t.reverbAmount:.3,J.warmth=null!=t.warmth?t.warmth:.8,J.tuningA4=t.tuningA4||440,J.mode="forward",J.critiquePos=null,J.editingSectionId=null,document.querySelectorAll(".mode-btn").forEach(e=>e.classList.toggle("active","forward"===e.getAttribute("data-mode"))),(()=>{const relabel=c=>{c.label=_mkLabel(c.rootPc,c.qualityId,c.bassPc)};J.progression.forEach(relabel);J.song.sections.forEach(s=>s.chords.forEach(relabel))})(),$e(),void te("editor");var t});const r=document.createElement("button");r.className="ghost",r.textContent="Löschen",r.addEventListener("click",()=>{je(Te().filter(t=>t.id!==e.id)),Ve()}),t.appendChild(i),t.appendChild(r),ee.presetsList.appendChild(t)})}function Oe(e){const t={r:e.rootPc,q:e.qualityId,b:e.bassPc};return e.register&&(t.g=e.register),e.beats&&4!==e.beats&&(t.t=e.beats),t}function Ne(e){const t=e.r,n=e.q,a=e.b,r={rootPc:t,qualityId:n,quality:o[n],bassPc:a,label:i(t,n,a)};return e.g&&(r.register=e.g),e.t&&(r.beats=e.t),r}ee.savePresetBtn.addEventListener("click",()=>{const e=ee.presetNameInput.value.trim();if(!e)return ee.presetNameInput.style.borderColor="var(--red)",void setTimeout(()=>{ee.presetNameInput.style.borderColor=""},700);const t=Te();t.push({id:"preset"+Date.now()+Math.random().toString(36).slice(2,7),name:e,savedAt:Date.now(),data:{progression:J.progression.map(e=>({...e})),song:{sections:J.song.sections.map(e=>({...e,chords:e.chords.map(e=>({...e}))}))},genre:J.genre,upperStructure:J.upperStructure,voicingStyle:J.voicingStyle,bpm:J.bpm,soundPreset:J.soundPreset,reverbAmount:J.reverbAmount,warmth:J.warmth,tuningA4:J.tuningA4}}),je(t),ee.presetNameInput.value="",Ve()}),ee.presetNameInput.addEventListener("keydown",e=>{"Enter"===e.key&&ee.savePresetBtn.click()}),Ve();const ze="#share=";ee.shareLinkBtn.addEventListener("click",()=>{const e=window.location.origin+window.location.pathname+ze+(t={p:J.progression.map(Oe),s:J.song.sections.map(e=>({ty:e.type,cl:e.customLabel||null,rp:e.repeats,ch:e.chords.map(Oe)})),ge:J.genre,us:J.upperStructure,vs:J.voicingStyle,bpm:J.bpm,sp:J.soundPreset,rv:J.reverbAmount,wm:J.warmth,tu:J.tuningA4},encodeURIComponent(JSON.stringify(t)));var t;const n=ee.shareLinkBtn.textContent;navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(e).then(()=>{return e="Link kopiert ✓",ee.shareLinkBtn.textContent=e,void setTimeout(()=>{ee.shareLinkBtn.textContent=n},1500);var e},()=>{window.prompt("Link kopieren (Strg/Cmd+C):",e)}):window.prompt("Link kopieren (Strg/Cmd+C):",e)});const De=function(){const e=window.location.hash||"";if(!e.startsWith(ze))return!1;const t=function(e){try{return JSON.parse(decodeURIComponent(e))}catch(e){return null}}(e.slice(7));return!!t&&(function(e){J.progression=(e.p||[]).map(Ne),J.song={sections:(e.s||[]).map((e,t)=>({id:"shared"+t,type:e.ty||"custom",customLabel:e.cl||null,repeats:e.rp||1,chords:(e.ch||[]).map(Ne)}))},J.genre=e.ge||"none",J.upperStructure=e.us||"none",J.voicingStyle=e.vs||"close",J.bpm=e.bpm||100,J.soundPreset=e.sp||"grand",J.reverbAmount=null!=e.rv?e.rv:.3,J.warmth=null!=e.wm?e.wm:.8,J.tuningA4=e.tu||440,J.mode="forward",J.critiquePos=null,J.editingSectionId=null,document.querySelectorAll(".mode-btn").forEach(e=>e.classList.toggle("active","forward"===e.getAttribute("data-mode"))),$e(),te("editor")}(t),!0)}();ee.complexityVal.textContent=ee.complexity.value+" / 100",De||ce()

var songFormPresets = {
  pop: [
    { type: "intro", deg: [0, 3] },
    { type: "verse", deg: [0, 4, 5, 3] },
    { type: "chorus", deg: [5, 3, 0, 4] },
    { type: "verse", deg: [0, 4, 5, 3] },
    { type: "chorus", deg: [5, 3, 0, 4] },
    { type: "bridge", deg: [3, 4, 2, 5] },
    { type: "chorus", deg: [5, 3, 0, 4] },
    { type: "outro", deg: [3, 0] }
  ],
  short: [
    { type: "intro", deg: [0, 3] },
    { type: "verse", deg: [0, 4, 5, 3] },
    { type: "chorus", deg: [5, 3, 0, 4] },
    { type: "outro", deg: [3, 0] }
  ],
  loop: [
    { type: "intro", deg: [0] },
    { type: "verse", deg: [0, 5, 3, 4] },
    { type: "chorus", deg: [0, 5, 3, 4] },
    { type: "outro", deg: [0] }
  ]
};

function genreDegreeQuality(modeId, deg, genre) {
  var base = d[modeId].qualities[deg];
  if (genre === "lofi") {
    if (deg === 4 && base === "maj") return "dom7";
    if (base === "maj") return "maj7";
    if (base === "m") return "m7";
    if (base === "dim") return "m7b5";
    return base;
  }
  if (genre === "cinematic") {
    if (deg === 4 && base === "maj") return "dom7";
    if (deg === 0 && base === "maj") return "maj7";
    if (base === "m") return "m7";
    return base;
  }
  if (genre === "house" && base === "dim") return "m";
  return base;
}

function buildDiatonicChord(tonicPc, modeId, deg, genre, beatsCount) {
  var scale = u(tonicPc, modeId);
  var rootPc = scale[deg];
  var qualityId = genreDegreeQuality(modeId, deg, genre);
  return { rootPc: rootPc, qualityId: qualityId, quality: o[qualityId], bassPc: rootPc, label: i(rootPc, qualityId, rootPc), beats: beatsCount || 4 };
}

function spiceWithSecondaryDominants(chordList, amountPct) {
  if (!amountPct) return chordList;
  for (var idx = 0; idx < chordList.length - 1; idx++) {
    if (Math.random() * 100 < amountPct * 0.5) {
      var targetRoot = chordList[idx + 1].rootPc;
      var domRoot = (targetRoot + 7) % 12;
      chordList[idx] = { rootPc: domRoot, qualityId: "dom7", quality: o.dom7, bassPc: domRoot, label: i(domRoot, "dom7", domRoot), beats: chordList[idx].beats || 4 };
    }
  }
  return chordList;
}

function generateSongArrangement(tonicPc, modeId, formKey, genre, spicePct) {
  var form = songFormPresets[formKey] || songFormPresets.pop;
  return form.map(function (sec, idx) {
    var chords = sec.deg.map(function (deg) { return buildDiatonicChord(tonicPc, modeId, deg, genre, 4); });
    spiceWithSecondaryDominants(chords, spicePct);
    return { id: "gen" + Date.now() + "_" + idx, type: sec.type, customLabel: null, chords: chords, repeats: 1 };
  });
}

function reharmonizeChordList(chordList, complexityVal, genre) {
  if (!chordList.length) return chordList;
  var snapshot = chordList.map(function (c) { return { rootPc: c.rootPc, qualityId: c.qualityId, quality: c.quality, bassPc: c.bassPc, label: c.label }; });
  var picks = chordList.map(function (_, idx) {
    var result = f(snapshot, complexityVal, genre, "critique", idx);
    var list = result && result.list ? result.list : [];
    var pick = list.find(function (cand) { return !(cand.rootPc === snapshot[idx].rootPc && cand.qualityId === snapshot[idx].qualityId); });
    if (!pick) pick = list[0];
    return pick || null;
  });
  picks.forEach(function (pick, idx) {
    if (!pick) return;
    chordList[idx].rootPc = pick.rootPc;
    chordList[idx].qualityId = pick.qualityId;
    chordList[idx].quality = o[pick.qualityId];
    chordList[idx].bassPc = pick.rootPc;
    chordList[idx].label = i(pick.rootPc, pick.qualityId, pick.rootPc);
  });
  return chordList;
}

var songGenRootInput = document.getElementById("songGenRoot");
var songGenModeBtns = document.querySelectorAll(".songgen-mode-btn");
var songGenFormBtns = document.querySelectorAll(".songgen-form-btn");
var songGenSpiceSlider = document.getElementById("songGenSpice");
var songGenSpiceVal = document.getElementById("songGenSpiceVal");
var songGenBtn = document.getElementById("songGenBtn");
var songReharmBtn = document.getElementById("songReharmBtn");
var progReharmBtn = document.getElementById("progReharmBtn");

var songGenState = { mode: "major", form: "pop" };

if (songGenModeBtns.length) {
  songGenModeBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      songGenState.mode = btn.getAttribute("data-mode2");
      songGenModeBtns.forEach(function (b) { b.classList.toggle("active", b === btn); });
    });
  });
}
if (songGenFormBtns.length) {
  songGenFormBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      songGenState.form = btn.getAttribute("data-form");
      songGenFormBtns.forEach(function (b) { b.classList.toggle("active", b === btn); });
    });
  });
}
if (songGenSpiceSlider) {
  songGenSpiceSlider.addEventListener("input", function () {
    songGenSpiceVal.textContent = songGenSpiceSlider.value + "%";
  });
}
if (songGenBtn) {
  songGenBtn.addEventListener("click", function () {
    if (J.song.sections.length && !window.confirm("Bestehendes Song-Arrangement ersetzen?")) return;
    var parsedRoot = r(songGenRootInput.value.trim() || "C");
    var tonicPc = parsedRoot ? parsedRoot.rootPc : 0;
    var spicePct = songGenSpiceSlider ? Number(songGenSpiceSlider.value) : 20;
    J.song.sections = generateSongArrangement(tonicPc, songGenState.mode, songGenState.form, J.genre, spicePct);
    J.editingSectionId = null;
    ee.sectionEditBanner.hidden = true;
    te("song");
  });
}
if (songReharmBtn) {
  songReharmBtn.addEventListener("click", function () {
    var complexityVal = parseInt(ee.complexity.value, 10);
    J.song.sections.forEach(function (sec) { reharmonizeChordList(sec.chords, complexityVal, J.genre); });
    de();
  });
}
if (progReharmBtn) {
  progReharmBtn.addEventListener("click", function () {
    var complexityVal = parseInt(ee.complexity.value, 10);
    if (!J.progression.length) return;
    reharmonizeChordList(J.progression, complexityVal, J.genre);
    ce();
  });
}

var originalCeRef = ce;
ce = function () {
  originalCeRef();
  if (progReharmBtn) progReharmBtn.disabled = J.progression.length === 0;
};
var originalDeRef = de;
de = function () {
  originalDeRef();
  var hasSongChords = J.song.sections.some(function (s) { return s.chords.length > 0; });
  if (songReharmBtn) songReharmBtn.disabled = !hasSongChords;
};
ce();
de();



function cloneChordEntry(c) {
  var copy = { rootPc: c.rootPc, qualityId: c.qualityId, quality: o[c.qualityId], bassPc: c.bassPc, label: c.label };
  if (c.register) copy.register = c.register;
  if (c.beats) copy.beats = c.beats;
  return copy;
}
function cloneChordListEntries(list) { return list.map(cloneChordEntry); }
function cloneSectionEntries(sections) {
  return sections.map(function (s) {
    return { id: s.id, type: s.type, customLabel: s.customLabel, chords: cloneChordListEntries(s.chords), repeats: s.repeats };
  });
}

var historyStack = [];
var historyIndex = -1;
var isRestoringHistory = false;
var MAX_HISTORY = 60;
var undoHistoryBtn = document.getElementById("undoHistoryBtn");
var redoHistoryBtn = document.getElementById("redoHistoryBtn");

function snapshotAppState() {
  return {
    progression: cloneChordListEntries(J.progression),
    sections: cloneSectionEntries(J.song.sections),
    editingSectionId: J.editingSectionId
  };
}
function appStatesEqual(a, b) {
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
function updateHistoryButtons() {
  if (undoHistoryBtn) undoHistoryBtn.disabled = historyIndex <= 0;
  if (redoHistoryBtn) redoHistoryBtn.disabled = historyIndex >= historyStack.length - 1;
}
function pushHistorySnapshot() {
  if (isRestoringHistory) return;
  var snap = snapshotAppState();
  var last = historyStack[historyIndex];
  if (last && appStatesEqual(last, snap)) return;
  historyStack = historyStack.slice(0, historyIndex + 1);
  historyStack.push(snap);
  if (historyStack.length > MAX_HISTORY) historyStack.shift();
  historyIndex = historyStack.length - 1;
  updateHistoryButtons();
}
function restoreAppState(snap) {
  isRestoringHistory = true;
  J.song.sections = cloneSectionEntries(snap.sections);
  J.editingSectionId = snap.editingSectionId;
  if (snap.editingSectionId) {
    var sec = J.song.sections.find(function (s) { return s.id === snap.editingSectionId; });
    if (sec) {
      J.progression = sec.chords;
      ee.sectionEditBanner.hidden = false;
      ee.sectionEditLabel.textContent = ne(sec);
    } else {
      J.progression = cloneChordListEntries(snap.progression);
      J.editingSectionId = null;
      ee.sectionEditBanner.hidden = true;
    }
  } else {
    J.progression = cloneChordListEntries(snap.progression);
    ee.sectionEditBanner.hidden = true;
  }
  ce();
  de();
  isRestoringHistory = false;
}
function performHistoryUndo() {
  if (historyIndex <= 0) return;
  historyIndex -= 1;
  restoreAppState(historyStack[historyIndex]);
  updateHistoryButtons();
}
function performHistoryRedo() {
  if (historyIndex >= historyStack.length - 1) return;
  historyIndex += 1;
  restoreAppState(historyStack[historyIndex]);
  updateHistoryButtons();
}
if (undoHistoryBtn) undoHistoryBtn.addEventListener("click", performHistoryUndo);
if (redoHistoryBtn) redoHistoryBtn.addEventListener("click", performHistoryRedo);
var langToggleBtn = document.getElementById("langToggleBtn");
if (langToggleBtn) langToggleBtn.addEventListener("click", function () {
  J.lang = "de" === J.lang ? "en" : "de";
  try { localStorage.setItem("ecLang", J.lang); } catch (e) {}
  applyLanguage();
  ce();
  if (typeof de === "function") de();
});

var ceBeforeHistory = ce;
ce = function () {
  ceBeforeHistory();
  pushHistorySnapshot();
};
var deBeforeHistory = de;
de = function () {
  deBeforeHistory();
  pushHistorySnapshot();
};
pushHistorySnapshot();

document.addEventListener("keydown", function (e) {
  var tag = (e.target && e.target.tagName || "").toLowerCase();
  var isTyping = tag === "input" || tag === "textarea" || tag === "select" || (e.target && e.target.isContentEditable);
  if (isTyping) return;
  var mod = e.metaKey || e.ctrlKey;
  if (mod && !e.shiftKey && e.key && e.key.toLowerCase() === "z") {
    e.preventDefault();
    performHistoryUndo();
    return;
  }
  if (mod && e.key && ((e.shiftKey && e.key.toLowerCase() === "z") || e.key.toLowerCase() === "y")) {
    e.preventDefault();
    performHistoryRedo();
    return;
  }
  if (e.code === "Space" || e.key === " ") {
    e.preventDefault();
    if (J.activeView === "song") {
      var flatSong = Z().flat;
      if (flatSong.length) G(flatSong, J.bpm);
    } else if (J.progression.length) {
      G(J.progression, J.bpm);
    }
    return;
  }
  if ((e.key === "Backspace" || e.key === "Delete") && J.activeView === "editor" && J.progression.length) {
    e.preventDefault();
    J.progression.pop();
    ce();
  }
});

var humanizeToggleBtn = document.getElementById("humanizeToggleBtn");
var humanizeSlider = document.getElementById("humanizeSlider");
var humanizeVal = document.getElementById("humanizeVal");
J.humanizeEnabled = true;
J.humanizeAmount = 0.35;
if (humanizeToggleBtn) {
  humanizeToggleBtn.addEventListener("click", function () {
    J.humanizeEnabled = !J.humanizeEnabled;
    humanizeToggleBtn.textContent = J.humanizeEnabled ? "An" : "Aus";
    humanizeToggleBtn.classList.toggle("active", J.humanizeEnabled);
  });
}
if (humanizeSlider) {
  humanizeSlider.addEventListener("input", function () {
    J.humanizeAmount = Number(humanizeSlider.value) / 100;
    humanizeVal.textContent = humanizeSlider.value + "%";
  });
}

var jBeforeHumanize = j;
j = function (notes, startTime, velMul) {
  velMul = velMul === undefined ? 1 : velMul;
  var ctx = P();
  var isOfflineCtx = !!(window.OfflineAudioContext && ctx instanceof window.OfflineAudioContext) || !!(window.webkitOfflineAudioContext && ctx instanceof window.webkitOfflineAudioContext);
  if (!J.humanizeEnabled || isOfflineCtx) {
    jBeforeHumanize(notes, startTime, velMul);
    return;
  }
  var noteGain = ctx.createGain();
  var comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 12;
  comp.ratio.value = 3;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  var avg = notes.reduce(function (a, b) { return a + b; }, 0) / notes.length;
  var filt = ctx.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = (800 + avg / 128 * 8000) * (0.5 + 0.8 * J.warmth);
  filt.Q.value = J.soundPreset === "harpsichord" ? 0.9 : 0.3;
  noteGain.connect(comp);
  comp.connect(filt);
  filt.connect(S.masterBus);
  var count = notes.length;
  var amt = J.humanizeAmount || 0;
  notes.forEach(function (note, idx) {
    var baseVel = (idx === 0 ? 0.85 : 0.6) / Math.sqrt(count) * velMul;
    var timeJitter = (Math.random() * 2 - 1) * 0.015 * amt;
    var velJitter = 1 + (Math.random() * 2 - 1) * 0.18 * amt;
    var t2 = startTime + 0.012 * idx + timeJitter;
    var v2 = Math.max(0.05, baseVel * velJitter);
    T(ctx, noteGain, note, t2, v2);
  });
};


var timelineColors = { intro: "var(--blue)", verse: "var(--green)", chorus: "var(--orange)", bridge: "var(--purple)", outro: "var(--red)", custom: "#2dd4bf" };
var songTimelineEl = document.getElementById("songTimeline");

function renderSongTimeline() {
  if (!songTimelineEl) return;
  var sections = J.song.sections;
  var totals = sections.map(function (s) {
    var perRepeat = s.chords.reduce(function (sum, c) { return sum + (c.beats || 4); }, 0);
    return perRepeat * s.repeats;
  });
  var grandTotal = totals.reduce(function (a, b) { return a + b; }, 0);
  songTimelineEl.innerHTML = "";
  if (!grandTotal) {
    var emptyEl = document.createElement("span");
    emptyEl.className = "empty-hint";
    emptyEl.textContent = "Timeline erscheint, sobald der Song Akkorde enthält.";
    songTimelineEl.appendChild(emptyEl);
    return;
  }
  var track = document.createElement("div");
  track.className = "timeline-track";
  sections.forEach(function (s, idx) {
    var widthPct = totals[idx] / grandTotal * 100;
    if (widthPct <= 0) return;
    var seg = document.createElement("div");
    seg.className = "timeline-seg";
    seg.style.width = widthPct.toFixed(2) + "%";
    seg.style.background = timelineColors[s.type] || timelineColors.custom;
    var label = ne(s) + (s.repeats > 1 ? " × " + s.repeats : "");
    seg.title = label;
    seg.tabIndex = 0;
    seg.setAttribute("role", "button");
    seg.setAttribute("aria-label", "Sektion bearbeiten: " + label);
    var labelEl = document.createElement("span");
    labelEl.className = "timeline-seg-label";
    labelEl.textContent = label;
    seg.appendChild(labelEl);
    seg.addEventListener("click", function () { oe(s.id); });
    seg.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); oe(s.id); }
    });
    track.appendChild(seg);
  });
  songTimelineEl.appendChild(track);
  var secondsPerBeat = 60 / (J.bpm || 100);
  var totalSeconds = Math.round(grandTotal * secondsPerBeat);
  var mm = Math.floor(totalSeconds / 60);
  var ss = String(totalSeconds % 60).padStart(2, "0");
  var meta = document.createElement("div");
  meta.className = "timeline-meta";
  meta.textContent = "Gesamtlänge: ~" + mm + ":" + ss + " bei " + (J.bpm || 100) + " BPM";
  songTimelineEl.appendChild(meta);
}

var deBeforeTimeline = de;
de = function () {
  deBeforeTimeline();
  renderSongTimeline();
};
renderSongTimeline();

var dragState = { type: null, fromIndex: null };

function armDragHandle(handle, container) {
  handle.addEventListener("mousedown", function () { container.draggable = true; });
  handle.addEventListener("touchstart", function () { container.draggable = true; }, { passive: true });
  document.addEventListener("mouseup", function () { container.draggable = false; });
  container.addEventListener("dragend", function () {
    container.draggable = false;
    container.classList.remove("dragging");
  });
}

function setupChordDragAndDrop() {
  var chips = Array.prototype.slice.call(ee.progression.querySelectorAll(".chip"));
  chips.forEach(function (chip, idx) {
    chip.draggable = false;
    var row = chip.querySelector(".chip-row");
    if (row && !row.querySelector(".drag-handle")) {
      var handle = document.createElement("span");
      handle.className = "drag-handle";
      handle.title = "Ziehen zum Umsortieren";
      handle.setAttribute("aria-hidden", "true");
      handle.textContent = "⠿";
      row.insertBefore(handle, row.firstChild);
      armDragHandle(handle, chip);
    }
    chip.addEventListener("dragstart", function (e) {
      dragState = { type: "chord", fromIndex: idx };
      chip.classList.add("dragging");
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    });
    chip.addEventListener("dragover", function (e) {
      if (dragState.type !== "chord") return;
      e.preventDefault();
      chip.classList.add("drag-over");
    });
    chip.addEventListener("dragleave", function () { chip.classList.remove("drag-over"); });
    chip.addEventListener("drop", function (e) {
      e.preventDefault();
      chip.classList.remove("drag-over");
      if (dragState.type !== "chord" || dragState.fromIndex === null) return;
      var from = dragState.fromIndex, to = idx;
      dragState = { type: null, fromIndex: null };
      if (from === to) return;
      var moved = J.progression.splice(from, 1)[0];
      J.progression.splice(to, 0, moved);
      if (J.critiquePos === from) J.critiquePos = to;
      else if (J.critiquePos !== null) {
        if (from < J.critiquePos && to >= J.critiquePos) J.critiquePos -= 1;
        else if (from > J.critiquePos && to <= J.critiquePos) J.critiquePos += 1;
      }
      ce();
    });
  });
}

function setupSectionDragAndDrop() {
  var cards = Array.prototype.slice.call(ee.sectionsList.querySelectorAll(".section-card"));
  cards.forEach(function (card, idx) {
    card.draggable = false;
    var head = card.querySelector(".section-card-title");
    if (head && !head.querySelector(".drag-handle")) {
      var handle = document.createElement("span");
      handle.className = "drag-handle";
      handle.title = "Ziehen zum Umsortieren";
      handle.setAttribute("aria-hidden", "true");
      handle.textContent = "⠿";
      head.insertBefore(handle, head.firstChild);
      armDragHandle(handle, card);
    }
    card.addEventListener("dragstart", function (e) {
      dragState = { type: "section", fromIndex: idx };
      card.classList.add("dragging");
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragover", function (e) {
      if (dragState.type !== "section") return;
      e.preventDefault();
      card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", function () { card.classList.remove("drag-over"); });
    card.addEventListener("drop", function (e) {
      e.preventDefault();
      card.classList.remove("drag-over");
      if (dragState.type !== "section" || dragState.fromIndex === null) return;
      var from = dragState.fromIndex, to = idx;
      dragState = { type: null, fromIndex: null };
      if (from === to) return;
      var sections = J.song.sections;
      var moved = sections.splice(from, 1)[0];
      sections.splice(to, 0, moved);
      de();
    });
  });
}

var ceBeforeDrag = ce;
ce = function () {
  ceBeforeDrag();
  setupChordDragAndDrop();
};
var deBeforeDragSections = de;
de = function () {
  deBeforeDragSections();
  setupSectionDragAndDrop();
};
setupChordDragAndDrop();
setupSectionDragAndDrop();

J.metronomeEnabled = false;

function scheduleMetronomeClick(ctx, time, accented) {
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = accented ? 1500 : 1000;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(accented ? 0.35 : 0.22, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  osc.connect(gain);
  gain.connect(S.masterBus);
  osc.start(time);
  osc.stop(time + 0.06);
}

var GBeforeMetronome = G;
G = function (chordList, bpm) {
  GBeforeMetronome(chordList, bpm);
  if (!J.metronomeEnabled || !chordList.length) return;
  var ctx = P();
  var isOfflineCtx = !!(window.OfflineAudioContext && ctx instanceof window.OfflineAudioContext) || !!(window.webkitOfflineAudioContext && ctx instanceof window.webkitOfflineAudioContext);
  if (isOfflineCtx) return;
  var secondsPerBeat = 60 / (bpm || 100);
  var t = ctx.currentTime + 0.02;
  chordList.forEach(function (c) {
    var beats = c.beats || 4;
    for (var b = 0; b < beats; b++) {
      scheduleMetronomeClick(ctx, t, b === 0);
      t += secondsPerBeat;
    }
  });
};

var metronomeToggleBtn = document.getElementById("metronomeToggleBtn");
if (metronomeToggleBtn) {
  metronomeToggleBtn.addEventListener("click", function () {
    J.metronomeEnabled = !J.metronomeEnabled;
    metronomeToggleBtn.textContent = J.metronomeEnabled ? "🎵 Metronom: An" : "🎵 Metronom: Aus";
    metronomeToggleBtn.classList.toggle("active", J.metronomeEnabled);
  });
}

var activeLoopTimer = null;
var activeLoopSectionId = null;

function updateLoopButtons() {
  document.querySelectorAll(".section-loop-btn").forEach(function (btn) {
    var id = btn.getAttribute("data-loopid");
    var active = id === activeLoopSectionId;
    btn.textContent = active ? "⏹ Stop" : "🔁 Loop";
    btn.classList.toggle("active", active);
  });
}

function stopSectionLoop() {
  if (activeLoopTimer) { clearTimeout(activeLoopTimer); activeLoopTimer = null; }
  activeLoopSectionId = null;
  updateLoopButtons();
}

function playSectionLoop(sectionId) {
  var sec = J.song.sections.find(function (s) { return s.id === sectionId; });
  if (!sec || !sec.chords.length) return;
  stopSectionLoop();
  activeLoopSectionId = sectionId;
  var secondsPerBeat = 60 / (J.bpm || 100);
  var totalBeats = sec.chords.reduce(function (sum, c) { return sum + (c.beats || 4); }, 0);
  var durationMs = Math.max(200, totalBeats * secondsPerBeat * 1000);
  function scheduleNext() {
    if (activeLoopSectionId !== sectionId) return;
    G(sec.chords, J.bpm);
    activeLoopTimer = setTimeout(scheduleNext, durationMs);
  }
  scheduleNext();
  updateLoopButtons();
}

function injectSectionLoopButtons() {
  var cards = ee.sectionsList.querySelectorAll(".section-card");
  cards.forEach(function (card, idx) {
    var sec = J.song.sections[idx];
    if (!sec) return;
    var actions = card.querySelector(".section-card-actions");
    if (!actions || actions.querySelector(".section-loop-btn")) return;
    var loopBtn = document.createElement("button");
    loopBtn.className = "ghost section-loop-btn";
    loopBtn.setAttribute("data-loopid", sec.id);
    loopBtn.textContent = "🔁 Loop";
    loopBtn.disabled = !sec.chords.length;
    loopBtn.addEventListener("click", function () {
      if (activeLoopSectionId === sec.id) stopSectionLoop();
      else playSectionLoop(sec.id);
    });
    actions.insertBefore(loopBtn, actions.firstChild);
  });
  updateLoopButtons();
}

var deBeforeLoop = de;
de = function () {
  deBeforeLoop();
  injectSectionLoopButtons();
};
injectSectionLoopButtons();

var teBeforeLoopStop = te;
te = function (view) {
  if (view !== "song") stopSectionLoop();
  teBeforeLoopStop(view);
};

function computeReharmProposals(chordList, complexityVal, genre) {
  if (!chordList.length) return [];
  var snapshot = chordList.map(function (c) { return { rootPc: c.rootPc, qualityId: c.qualityId, quality: c.quality, bassPc: c.bassPc, label: c.label }; });
  return chordList.map(function (c, idx) {
    var result = f(snapshot, complexityVal, genre, "critique", idx);
    var list = result && result.list ? result.list : [];
    var pick = list.find(function (cand) { return !(cand.rootPc === snapshot[idx].rootPc && cand.qualityId === snapshot[idx].qualityId); });
    if (!pick) pick = list[0];
    if (!pick) return null;
    if (pick.rootPc === c.rootPc && pick.qualityId === c.qualityId) return null;
    return { rootPc: pick.rootPc, qualityId: pick.qualityId, label: i(pick.rootPc, pick.qualityId, pick.rootPc) };
  });
}

function applyReharmPick(chordEntry, pick) {
  chordEntry.rootPc = pick.rootPc;
  chordEntry.qualityId = pick.qualityId;
  chordEntry.quality = o[pick.qualityId];
  chordEntry.bassPc = pick.rootPc;
  chordEntry.label = i(pick.rootPc, pick.qualityId, pick.rootPc);
}

function buildReharmItems(chordList, proposals, contextLabelFn) {
  var items = [];
  proposals.forEach(function (pick, idx) {
    if (!pick) return;
    var chord = chordList[idx];
    items.push({
      posLabel: (contextLabelFn ? contextLabelFn(idx) + " – " : "") + "Position " + (idx + 1),
      oldLabel: chord.label,
      newLabel: pick.label,
      accept: function () { applyReharmPick(chord, pick); }
    });
  });
  return items;
}

var activeReharmPanel = null;

function closeReharmPanel() {
  if (activeReharmPanel && activeReharmPanel.parentNode) activeReharmPanel.parentNode.removeChild(activeReharmPanel);
  activeReharmPanel = null;
}

function renderReharmPanel(items, onAnyChange, title) {
  closeReharmPanel();
  if (!items.length) { alert("Keine Änderungsvorschläge gefunden."); return null; }
  var panel = document.createElement("div");
  panel.className = "panel reharm-preview-panel";
  var titleEl = document.createElement("div");
  titleEl.className = "panel-title";
  titleEl.textContent = title || "Reharmonisierungs-Vorschau";
  panel.appendChild(titleEl);
  var list = document.createElement("div");
  list.className = "reharm-item-list";
  items.forEach(function (item) {
    var row = document.createElement("div");
    row.className = "reharm-item";
    var textEl = document.createElement("span");
    textEl.className = "reharm-item-text";
    var posSpan = document.createElement("span");
    posSpan.className = "reharm-item-pos";
    posSpan.textContent = item.posLabel + ": ";
    var oldSpan = document.createElement("span");
    oldSpan.className = "reharm-item-old";
    oldSpan.textContent = item.oldLabel;
    var arrowSpan = document.createElement("span");
    arrowSpan.className = "arrow";
    arrowSpan.textContent = " → ";
    var newSpan = document.createElement("span");
    newSpan.className = "reharm-item-new";
    newSpan.textContent = item.newLabel;
    textEl.appendChild(posSpan);
    textEl.appendChild(oldSpan);
    textEl.appendChild(arrowSpan);
    textEl.appendChild(newSpan);
    var acceptBtn = document.createElement("button");
    acceptBtn.className = "ghost reharm-accept-btn";
    acceptBtn.textContent = "✓ Übernehmen";
    var rejectBtn = document.createElement("button");
    rejectBtn.className = "ghost reharm-reject-btn";
    rejectBtn.textContent = "✗ Verwerfen";
    acceptBtn.addEventListener("click", function () {
      item.accept();
      row.remove();
      onAnyChange();
      if (!list.querySelector(".reharm-item")) closeReharmPanel();
    });
    rejectBtn.addEventListener("click", function () {
      row.remove();
      if (!list.querySelector(".reharm-item")) closeReharmPanel();
    });
    row.appendChild(textEl);
    row.appendChild(acceptBtn);
    row.appendChild(rejectBtn);
    list.appendChild(row);
  });
  panel.appendChild(list);
  var bulkRow = document.createElement("div");
  bulkRow.className = "toolbar";
  var acceptAllBtn = document.createElement("button");
  acceptAllBtn.className = "primary";
  acceptAllBtn.textContent = "✓ Alle übernehmen";
  acceptAllBtn.addEventListener("click", function () {
    items.forEach(function (item) { item.accept(); });
    onAnyChange();
    closeReharmPanel();
  });
  var cancelBtn = document.createElement("button");
  cancelBtn.className = "ghost";
  cancelBtn.textContent = "Abbrechen";
  cancelBtn.addEventListener("click", function () { closeReharmPanel(); });
  bulkRow.appendChild(acceptAllBtn);
  bulkRow.appendChild(cancelBtn);
  panel.appendChild(bulkRow);
  return panel;
}

function openProgressionReharmPreview() {
  var complexityVal = parseInt(ee.complexity.value, 10);
  var proposals = computeReharmProposals(J.progression, complexityVal, J.genre);
  var items = buildReharmItems(J.progression, proposals, null);
  var panel = renderReharmPanel(items, function () { ce(); }, "Reharmonisierungs-Vorschau — Progression");
  if (!panel) return;
  var anchor = ee.progression.closest(".panel");
  anchor.parentNode.insertBefore(panel, anchor.nextSibling);
  activeReharmPanel = panel;
}

function openSongReharmPreview() {
  var complexityVal = parseInt(ee.complexity.value, 10);
  var items = [];
  J.song.sections.forEach(function (sec) {
    var proposals = computeReharmProposals(sec.chords, complexityVal, J.genre);
    items = items.concat(buildReharmItems(sec.chords, proposals, function () { return ne(sec); }));
  });
  var panel = renderReharmPanel(items, function () { de(); }, "Reharmonisierungs-Vorschau — Song");
  if (!panel) return;
  var anchor = ee.sectionsList.closest(".panel");
  anchor.parentNode.insertBefore(panel, anchor.nextSibling);
  activeReharmPanel = panel;
}

var progReharmBtnEl = document.getElementById("progReharmBtn");
if (progReharmBtnEl) {
  var progReharmBtnClone = progReharmBtnEl.cloneNode(true);
  progReharmBtnEl.parentNode.replaceChild(progReharmBtnClone, progReharmBtnEl);
  progReharmBtn = progReharmBtnClone;
  progReharmBtn.addEventListener("click", function () {
    if (!J.progression.length) return;
    openProgressionReharmPreview();
  });
}
var songReharmBtnEl = document.getElementById("songReharmBtn");
if (songReharmBtnEl) {
  var songReharmBtnClone = songReharmBtnEl.cloneNode(true);
  songReharmBtnEl.parentNode.replaceChild(songReharmBtnClone, songReharmBtnEl);
  songReharmBtn = songReharmBtnClone;
  songReharmBtn.addEventListener("click", function () {
    openSongReharmPreview();
  });
}

var teBeforeReharmClose = te;
te = function (view) {
  closeReharmPanel();
  teBeforeReharmClose(view);
};


function computeApproachTone(fromRootPc, toRootPc) {
  if (fromRootPc === toRootPc) return (toRootPc + 7) % 12;
  var diff = ((toRootPc - fromRootPc) % 12 + 12) % 12;
  var stepFromBelow = (toRootPc - 1 + 12) % 12;
  var stepFromAbove = (toRootPc + 1) % 12;
  return diff <= 6 ? stepFromBelow : stepFromAbove;
}

function computeBasslinePattern(chordEntry, nextChordEntry, beats) {
  var root = chordEntry.rootPc;
  var fifth = (root + 7) % 12;
  var targetRoot = nextChordEntry ? nextChordEntry.rootPc : root;
  var approach = computeApproachTone(root, targetRoot);
  if (beats >= 4) {
    return [
      { offsetBeat: 0, pc: root, durBeats: Math.max(1, beats - 2) },
      { offsetBeat: 2, pc: fifth, durBeats: 1 },
      { offsetBeat: beats - 1, pc: approach, durBeats: 0.9 }
    ];
  }
  if (beats === 3) {
    return [
      { offsetBeat: 0, pc: root, durBeats: 1.8 },
      { offsetBeat: 2, pc: approach, durBeats: 0.9 }
    ];
  }
  if (beats === 2) {
    return [
      { offsetBeat: 0, pc: root, durBeats: 0.9 },
      { offsetBeat: 1, pc: approach, durBeats: 0.9 }
    ];
  }
  return [{ offsetBeat: 0, pc: root, durBeats: Math.max(0.4, beats - 0.1) }];
}

function bassMidiFreq(midiNote) {
  return J.tuningA4 * Math.pow(2, (midiNote - 69) / 12);
}

function playBassSynthNote(ctx, dest, midiNote, startTime, durSec, vel) {
  var freq = bassMidiFreq(midiNote);
  var osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = freq;
  var sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.value = freq / 2;
  var oscGain = ctx.createGain();
  var subGain = ctx.createGain();
  oscGain.gain.value = 0.55 * vel;
  subGain.gain.value = 0.45 * vel;
  var envGain = ctx.createGain();
  osc.connect(oscGain);
  sub.connect(subGain);
  oscGain.connect(envGain);
  subGain.connect(envGain);
  var filt = ctx.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = 900;
  filt.Q.value = 0.5;
  envGain.gain.setValueAtTime(0.0001, startTime);
  envGain.gain.linearRampToValueAtTime(1, startTime + 0.012);
  envGain.gain.exponentialRampToValueAtTime(0.0001, startTime + durSec);
  envGain.connect(filt);
  filt.connect(dest);
  osc.start(startTime);
  sub.start(startTime);
  osc.stop(startTime + durSec + 0.05);
  sub.stop(startTime + durSec + 0.05);
}

function scheduleBasslineForPlayback(chordList, bpm) {
  var ctx = P();
  var secondsPerBeat = 60 / (bpm || 100);
  var t = ctx.currentTime + 0.02;
  chordList.forEach(function (chordEntry, idx) {
    var beats = chordEntry.beats || 4;
    var nextChord = chordList[idx + 1] || null;
    var pattern = computeBasslinePattern(chordEntry, nextChord, beats);
    pattern.forEach(function (nte) {
      var midiNote = b(nte.pc, 36);
      var noteStart = t + nte.offsetBeat * secondsPerBeat;
      var noteDur = nte.durBeats * secondsPerBeat;
      playBassSynthNote(ctx, S.masterBus, midiNote, noteStart, noteDur, 0.8);
    });
    t += beats * secondsPerBeat;
  });
}

function midiVarLen(n) {
  return H(n);
}

function buildMidiTrackFromEvents(events, trackName) {
  events.sort(function (a, c) {
    return a.tick - c.tick || (a.kind === "noteoff" ? -1 : 1);
  });
  var data = [];
  var nameBytes = String(trackName).split("").map(function (ch) {
    return 255 & ch.charCodeAt(0);
  });
  data.push(0, 255, 3, nameBytes.length);
  nameBytes.forEach(function (nb) { data.push(nb); });
  var lastTick = 0;
  events.forEach(function (ev) {
    var delta = ev.tick - lastTick;
    lastTick = ev.tick;
    midiVarLen(delta).forEach(function (bb) { data.push(bb); });
    if (ev.kind === "noteoff") { data.push(128, ev.note & 127, 0); }
    else { data.push(144, ev.note & 127, ev.velocity || 80); }
  });
  midiVarLen(0).forEach(function (bb) { data.push(bb); });
  data.push(255, 47, 0);
  var length = data.length;
  var header = [77, 84, 114, 107, (length >> 24) & 255, (length >> 16) & 255, (length >> 8) & 255, length & 255];
  return new Uint8Array(header.concat(data));
}

function buildBassMidiTrackBytes(chordList, ticksPerBeat) {
  ticksPerBeat = ticksPerBeat || 480;
  var events = [];
  var cursorTick = 0;
  chordList.forEach(function (chordEntry, idx) {
    var beats = chordEntry.beats || 4;
    var nextChord = chordList[idx + 1] || null;
    var pattern = computeBasslinePattern(chordEntry, nextChord, beats);
    pattern.forEach(function (nte) {
      var midiNote = b(nte.pc, 36);
      var onTick = cursorTick + Math.round(ticksPerBeat * nte.offsetBeat);
      var offTick = onTick + Math.round(ticksPerBeat * nte.durBeats);
      events.push({ tick: onTick, kind: "noteon", note: midiNote, velocity: 85 });
      events.push({ tick: offTick, kind: "noteoff", note: midiNote });
    });
    cursorTick += ticksPerBeat * beats;
  });
  return buildMidiTrackFromEvents(events, "Bassline");
}

function appendMidiTrack(fullBytes, newTrackBytes) {
  var arr = Array.from(fullBytes);
  var ntrks = (arr[10] << 8) | arr[11];
  arr[8] = 0; arr[9] = 1;
  var newNtrks = ntrks + 1;
  arr[10] = (newNtrks >> 8) & 255; arr[11] = newNtrks & 255;
  return new Uint8Array(arr.concat(Array.from(newTrackBytes)));
}

J.basslineEnabled = false;

var GBeforeBassline = G;
G = function (chordList, bpm) {
  GBeforeBassline(chordList, bpm);
  if (!J.basslineEnabled || !chordList.length) return;
  scheduleBasslineForPlayback(chordList, bpm);
};

var UBeforeBassline = U;
U = function (e, t, n, o, a, i, r) {
  var bytes = UBeforeBassline(e, t, n, o, a, i, r);
  if (J.basslineEnabled && e.length) {
    var bassTrack = buildBassMidiTrackBytes(e, t || 480);
    bytes = appendMidiTrack(bytes, bassTrack);
  }
  return bytes;
};

var basslineToggleBtn = document.createElement("button");
basslineToggleBtn.className = "ghost bassline-toggle-btn";
basslineToggleBtn.textContent = "🎸 Bassline: Aus";
basslineToggleBtn.addEventListener("click", function () {
  J.basslineEnabled = !J.basslineEnabled;
  basslineToggleBtn.textContent = J.basslineEnabled ? "🎸 Bassline: An" : "🎸 Bassline: Aus";
  basslineToggleBtn.classList.toggle("active", J.basslineEnabled);
});
if (typeof metronomeToggleBtn !== "undefined" && metronomeToggleBtn && metronomeToggleBtn.parentNode) {
  metronomeToggleBtn.parentNode.insertBefore(basslineToggleBtn, metronomeToggleBtn.nextSibling);
}

function computeMelodyNoteForChord(chordEntry, prevMidi) {
  var chordTones = Array.from(new Set(chordEntry.quality.intervals.map(function (iv) {
    return (chordEntry.rootPc + iv) % 12;
  })));
  var refMidi = prevMidi == null ? 72 : prevMidi;
  var candidates = chordTones.map(function (pc) { return b(pc, refMidi); });
  candidates.sort(function (a, c) { return Math.abs(a - refMidi) - Math.abs(c - refMidi); });
  return candidates[0];
}

function melodyMidiFreq(midiNote) {
  return J.tuningA4 * Math.pow(2, (midiNote - 69) / 12);
}

function playMelodySynthNote(ctx, dest, midiNote, startTime, durSec, vel) {
  var freq = melodyMidiFreq(midiNote);
  var osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;
  var osc2 = ctx.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.value = freq * 1.003;
  var g1 = ctx.createGain();
  var g2 = ctx.createGain();
  g1.gain.value = 0.5 * vel;
  g2.gain.value = 0.3 * vel;
  var envGain = ctx.createGain();
  osc.connect(g1);
  osc2.connect(g2);
  g1.connect(envGain);
  g2.connect(envGain);
  envGain.gain.setValueAtTime(0.0001, startTime);
  envGain.gain.linearRampToValueAtTime(1, startTime + 0.02);
  envGain.gain.exponentialRampToValueAtTime(0.0001, startTime + durSec);
  envGain.connect(dest);
  osc.start(startTime);
  osc2.start(startTime);
  osc.stop(startTime + durSec + 0.05);
  osc2.stop(startTime + durSec + 0.05);
}

function scheduleMelodyForPlayback(chordList, bpm) {
  var ctx = P();
  var secondsPerBeat = 60 / (bpm || 100);
  var t = ctx.currentTime + 0.02;
  var prevMidi = null;
  chordList.forEach(function (chordEntry) {
    var beats = chordEntry.beats || 4;
    var midiNote = computeMelodyNoteForChord(chordEntry, prevMidi);
    prevMidi = midiNote;
    playMelodySynthNote(ctx, S.masterBus, midiNote, t, Math.max(0.3, (beats - 0.3) * secondsPerBeat), 0.5);
    t += beats * secondsPerBeat;
  });
}

function buildMelodyMidiTrackBytes(chordList, ticksPerBeat) {
  ticksPerBeat = ticksPerBeat || 480;
  var events = [];
  var cursorTick = 0;
  var prevMidi = null;
  chordList.forEach(function (chordEntry) {
    var beats = chordEntry.beats || 4;
    var midiNote = computeMelodyNoteForChord(chordEntry, prevMidi);
    prevMidi = midiNote;
    var onTick = cursorTick;
    var offTick = cursorTick + Math.round(ticksPerBeat * Math.max(0.3, beats - 0.3));
    events.push({ tick: onTick, kind: "noteon", note: midiNote, velocity: 70 });
    events.push({ tick: offTick, kind: "noteoff", note: midiNote });
    cursorTick += ticksPerBeat * beats;
  });
  return buildMidiTrackFromEvents(events, "Melody");
}

J.melodyEnabled = false;

var GBeforeMelody = G;
G = function (chordList, bpm) {
  GBeforeMelody(chordList, bpm);
  if (!J.melodyEnabled || !chordList.length) return;
  scheduleMelodyForPlayback(chordList, bpm);
};

var UBeforeMelody = U;
U = function (e, t, n, o, a, i, r) {
  var bytes = UBeforeMelody(e, t, n, o, a, i, r);
  if (J.melodyEnabled && e.length) {
    var melodyTrack = buildMelodyMidiTrackBytes(e, t || 480);
    bytes = appendMidiTrack(bytes, melodyTrack);
  }
  return bytes;
};

var melodyToggleBtn = document.createElement("button");
melodyToggleBtn.className = "ghost melody-toggle-btn";
melodyToggleBtn.textContent = "🎼 Melodie: Aus";
melodyToggleBtn.addEventListener("click", function () {
  J.melodyEnabled = !J.melodyEnabled;
  melodyToggleBtn.textContent = J.melodyEnabled ? "🎼 Melodie: An" : "🎼 Melodie: Aus";
  melodyToggleBtn.classList.toggle("active", J.melodyEnabled);
});
if (typeof basslineToggleBtn !== "undefined" && basslineToggleBtn && basslineToggleBtn.parentNode) {
  basslineToggleBtn.parentNode.insertBefore(melodyToggleBtn, basslineToggleBtn.nextSibling);
}

function detectSectionKey(section) {
  if (!section.chords.length) return null;
  return p(section.chords);
}

function transposeSectionChords(section, semitones) {
  section.chords.forEach(function (chordEntry) {
    chordEntry.rootPc = ((chordEntry.rootPc + semitones) % 12 + 12) % 12;
    chordEntry.bassPc = ((chordEntry.bassPc + semitones) % 12 + 12) % 12;
    chordEntry.label = i(chordEntry.rootPc, chordEntry.qualityId, chordEntry.bassPc);
  });
}

function injectSectionModulationControls() {
  var cards = ee.sectionsList.querySelectorAll(".section-card");
  var prevKeyLabel = null;
  cards.forEach(function (card, idx) {
    var sec = J.song.sections[idx];
    if (!sec) return;
    var key = detectSectionKey(sec);
    var keyLabel = key ? (noteLabel(key.tonicPc, J.noteLang) + " " + (d[key.mode] ? d[key.mode].label : key.mode)) : null;
    var titleRow = card.querySelector(".section-card-title");
    if (titleRow) {
      var existingBadge = card.querySelector(".section-key-badge");
      if (keyLabel) {
        if (!existingBadge) {
          existingBadge = document.createElement("span");
          existingBadge.className = "section-key-badge";
          titleRow.appendChild(existingBadge);
        }
        existingBadge.textContent = "🔑 " + keyLabel;
        existingBadge.classList.toggle("modulated", !!(prevKeyLabel && keyLabel !== prevKeyLabel));
      } else if (existingBadge) {
        existingBadge.remove();
      }
    }
    if (keyLabel) prevKeyLabel = keyLabel;

    var actions = card.querySelector(".section-card-actions");
    if (actions && !actions.querySelector(".transpose-ctrl") && sec.chords.length) {
      var wrap = document.createElement("span");
      wrap.className = "transpose-ctrl";
      wrap.title = "Sektion transponieren (Halbtonschritte)";
      var minusBtn = document.createElement("button");
      minusBtn.className = "ghost transpose-minus";
      minusBtn.textContent = "♭";
      var valSpan = document.createElement("span");
      valSpan.className = "transpose-val";
      valSpan.textContent = "0";
      var plusBtn = document.createElement("button");
      plusBtn.className = "ghost transpose-plus";
      plusBtn.textContent = "♯";
      var applyBtn = document.createElement("button");
      applyBtn.className = "ghost transpose-apply";
      applyBtn.textContent = "Transponieren";
      applyBtn.disabled = true;
      var pending = 0;
      minusBtn.addEventListener("click", function () {
        pending = Math.max(-12, pending - 1);
        valSpan.textContent = String(pending);
        applyBtn.disabled = pending === 0;
      });
      plusBtn.addEventListener("click", function () {
        pending = Math.min(12, pending + 1);
        valSpan.textContent = String(pending);
        applyBtn.disabled = pending === 0;
      });
      applyBtn.addEventListener("click", function () {
        if (!pending) return;
        transposeSectionChords(sec, pending);
        pending = 0;
        valSpan.textContent = "0";
        applyBtn.disabled = true;
        de();
      });
      wrap.appendChild(minusBtn);
      wrap.appendChild(valSpan);
      wrap.appendChild(plusBtn);
      wrap.appendChild(applyBtn);
      actions.appendChild(wrap);
    }
  });
}

var deBeforeModulation = de;
de = function () {
  deBeforeModulation();
  injectSectionModulationControls();
};
injectSectionModulationControls();

function analyzeProgression(chordList) {
  if (!chordList.length) return { key: null, romanSeq: [], cadences: [] };
  var key = p(chordList);
  var scale = u(key.tonicPc, key.mode);
  var romans = d[key.mode].romans;
  var romanSeq = chordList.map(function (chordEntry) {
    var deg = scale.indexOf(chordEntry.rootPc);
    var base = deg !== -1 ? romans[deg] : null;
    var label = base || ("(" + noteLabel(chordEntry.rootPc, J.noteLang) + ")");
    if (chordEntry.qualityId && o[chordEntry.qualityId] && o[chordEntry.qualityId].display) {
      label += o[chordEntry.qualityId].display;
    }
    return label;
  });
  var cadences = [];
  for (var idx = 1; idx < chordList.length; idx++) {
    var prevDeg = scale.indexOf(chordList[idx - 1].rootPc);
    var curDeg = scale.indexOf(chordList[idx].rootPc);
    if (prevDeg === 4 && curDeg === 0) cadences.push({ pos: idx, type: "Authentische Kadenz (V→I)" });
    else if (prevDeg === 3 && curDeg === 0) cadences.push({ pos: idx, type: "Plagale Kadenz (IV→I)" });
    else if (prevDeg === 4 && curDeg === 5) cadences.push({ pos: idx, type: "Trugschluss (V→vi)" });
    else if (prevDeg === 1 && curDeg === 4) cadences.push({ pos: idx, type: "ii–V Verbindung" });
    else {
      var prevQ = chordList[idx - 1].qualityId;
      var interval = ((chordList[idx - 1].rootPc - chordList[idx].rootPc) % 12 + 12) % 12;
      if (prevQ && k(prevQ) && curDeg !== -1 && interval === 7) {
        cadences.push({ pos: idx, type: "Sekundärdominante aufgelöst" });
      }
    }
  }
  return { key: key, romanSeq: romanSeq, cadences: cadences };
}

var activeAnalysisPanel = null;
function closeHarmonicAnalysisPanel() {
  if (activeAnalysisPanel && activeAnalysisPanel.parentNode) activeAnalysisPanel.parentNode.removeChild(activeAnalysisPanel);
  activeAnalysisPanel = null;
}

function renderHarmonicAnalysisPanel(chordList, anchorEl, title) {
  closeHarmonicAnalysisPanel();
  if (!chordList.length || !anchorEl) { alert("Keine Akkorde zum Analysieren."); return; }
  var result = analyzeProgression(chordList);
  var panel = document.createElement("div");
  panel.className = "panel harmonic-analysis-panel";
  var titleEl = document.createElement("div");
  titleEl.className = "panel-title";
  titleEl.textContent = title || "Harmonische Analyse";
  panel.appendChild(titleEl);
  var keyLine = document.createElement("div");
  keyLine.className = "key-readout";
  keyLine.textContent = "Erkannte Tonart: " + noteLabel(result.key.tonicPc, J.noteLang) + " " + (d[result.key.mode] ? d[result.key.mode].label : result.key.mode);
  panel.appendChild(keyLine);
  var romanRow = document.createElement("div");
  romanRow.className = "roman-analysis-row";
  result.romanSeq.forEach(function (romanLabel, idx) {
    if (idx > 0) {
      var arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = "→";
      romanRow.appendChild(arrow);
    }
    var chip = document.createElement("span");
    chip.className = "roman-chip";
    chip.textContent = romanLabel;
    romanRow.appendChild(chip);
  });
  panel.appendChild(romanRow);
  if (result.cadences.length) {
    var cadTitle = document.createElement("div");
    cadTitle.className = "panel-title";
    cadTitle.style.marginTop = "14px";
    cadTitle.textContent = "Erkannte Kadenzen";
    panel.appendChild(cadTitle);
    var cadList = document.createElement("div");
    cadList.className = "cadence-list";
    result.cadences.forEach(function (cad) {
      var row = document.createElement("div");
      row.className = "cadence-item";
      row.textContent = "Position " + cad.pos + ": " + cad.type;
      cadList.appendChild(row);
    });
    panel.appendChild(cadList);
  } else {
    var noCad = document.createElement("div");
    noCad.className = "mode-hint";
    noCad.textContent = "Keine klassischen Kadenzen erkannt.";
    panel.appendChild(noCad);
  }
  var closeBtn = document.createElement("button");
  closeBtn.className = "ghost";
  closeBtn.textContent = "Schließen";
  closeBtn.style.marginTop = "12px";
  closeBtn.addEventListener("click", closeHarmonicAnalysisPanel);
  panel.appendChild(closeBtn);
  anchorEl.parentNode.insertBefore(panel, anchorEl.nextSibling);
  activeAnalysisPanel = panel;
}

function injectAnalysisButtons() {
  if (typeof progReharmBtn !== "undefined" && progReharmBtn && progReharmBtn.parentNode && !document.getElementById("progAnalysisBtn")) {
    var btn = document.createElement("button");
    btn.id = "progAnalysisBtn";
    btn.className = "ghost";
    btn.textContent = "📊 Analyse";
    btn.disabled = J.progression.length === 0;
    btn.addEventListener("click", function () {
      if (!J.progression.length) return;
      renderHarmonicAnalysisPanel(J.progression, ee.progression.closest(".panel"), "Harmonische Analyse — Progression");
    });
    progReharmBtn.parentNode.insertBefore(btn, progReharmBtn.nextSibling);
  }
  if (typeof songReharmBtn !== "undefined" && songReharmBtn && songReharmBtn.parentNode && !document.getElementById("songAnalysisBtn")) {
    var btn2 = document.createElement("button");
    btn2.id = "songAnalysisBtn";
    btn2.className = "ghost";
    btn2.textContent = "📊 Song-Analyse";
    var hasSongChords0 = J.song.sections.some(function (s) { return s.chords.length > 0; });
    btn2.disabled = !hasSongChords0;
    btn2.addEventListener("click", function () {
      var flat = Z().flat;
      if (!flat.length) return;
      renderHarmonicAnalysisPanel(flat, ee.sectionsList.closest(".panel"), "Harmonische Analyse — Song");
    });
    songReharmBtn.parentNode.insertBefore(btn2, songReharmBtn.nextSibling);
  }
}
injectAnalysisButtons();

var teBeforeAnalysisClose = te;
te = function (view) {
  closeHarmonicAnalysisPanel();
  teBeforeAnalysisClose(view);
};

var ceBeforeAnalysisSync = ce;
ce = function () {
  ceBeforeAnalysisSync();
  var btn = document.getElementById("progAnalysisBtn");
  if (btn) btn.disabled = J.progression.length === 0;
};
var deBeforeAnalysisSync = de;
de = function () {
  deBeforeAnalysisSync();
  var btn2 = document.getElementById("songAnalysisBtn");
  if (btn2) btn2.disabled = !J.song.sections.some(function (s) { return s.chords.length > 0; });
};
try { J.lang = "en" === localStorage.getItem("ecLang") ? "en" : "de"; } catch (e) {}
try {
  if ("de" === localStorage.getItem("ecNoteLang")) {
    J.noteLang = "de";
    document.querySelectorAll(".notelang-btn").forEach(function (b) {
      b.classList.toggle("active", "de" === b.getAttribute("data-notelang"));
    });
  }
} catch (e) {}
initI18nObserver();
ce();
de();
applyLanguage();

}();