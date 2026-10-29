(()=>{'use strict';
const $=id=>document.getElementById(id),key='agb_fahrer_messungen_v2_1',oldKey='agb_fahrer_messungen_v2';
const colors=['#e1271a','#0075d5','#18864a','#b43dbb','#b06a00','#4456ad'];
const fmt=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(n);
let segments=[fresh()],active=0,watch=null,map=null,markers=[],lines=[],lastFix=null;
function fresh(){return {id:Date.now()+'-'+Math.random().toString(36).slice(2),points:[],passes:1,width:1.5,finished:false}}
function msg(t){$('status').textContent=t}
function rad(d){return d*Math.PI/180}
function meters(a,b){const r=6371000,dLat=rad(b.lat-a.lat),dLon=rad(b.lng-a.lng),h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 2*r*Math.asin(Math.min(1,Math.sqrt(h)))}
function segLength(s){return (s.points||[]).slice(1).reduce((sum,p,i)=>sum+meters(s.points[i],p),0)}
function totals(){return segments.reduce((t,s)=>{const d=segLength(s);t.distance+=d;t.cleaned+=d;t.area+=d*s.width;return t},{distance:0,cleaned:0,area:0})}
function current(){return segments[active]}
const WIDTHS=[0.5,1,1.5,2,2.5];
function validInputs(){const w=Number($('width').value);if(!WIDTHS.includes(w)){msg('Bitte eine Reinigungsbreite von 0,50 bis 2,50 m auswählen.');return false}current().passes=1;current().width=w;return true}
function setWidth(w){if(current().finished)return;const i=WIDTHS.indexOf(Number(current().width));const next=WIDTHS.includes(w)?w:WIDTHS[Math.max(0,Math.min(WIDTHS.length-1,i))];current().width=next;current().passes=1;render()}
function paint(){if(!map)return;markers.forEach(m=>map.removeLayer(m));lines.forEach(l=>map.removeLayer(l));markers=[];lines=[];segments.forEach((s,idx)=>{const color=colors[idx%colors.length];s.points.forEach((p,j)=>markers.push(L.circleMarker([p.lat,p.lng],{radius:j===0?7:4,color,fillColor:color,fillOpacity:1,weight:2}).bindPopup('Abschnitt '+(idx+1)+' · Punkt '+(j+1)).addTo(map)));if(s.points.length>1)lines.push(L.polyline(s.points.map(p=>[p.lat,p.lng]),{color,weight:5}).addTo(map))})}
function render(){const s=current(),t=totals();$('activeLabel').textContent='Abschnitt '+(active+1)+(s.finished?' · abgeschlossen':' · aktiv');$('segmentState').textContent=s.points.length+' Messpunkte';$('activeDistance').textContent=fmt(segLength(s))+' m';$('activeCount').textContent=s.points.length;$('distance').textContent=fmt(t.distance)+' m';$('area').textContent=fmt(t.area)+' m²';$('count').textContent=segments.length;$('point').disabled=s.finished;$('start').disabled=s.finished;$('start').textContent=watch!==null?'■ Aufzeichnung beenden':'▶ Aufzeichnung starten';$('start').classList.toggle('warn',watch!==null);$('start').classList.toggle('success',watch===null);$('finish').disabled=s.finished;$('undo').disabled=s.finished||!s.points.length;$('passes').value=1;$('width').value=WIDTHS.includes(Number(s.width))?s.width:1.5;$('widthDisplay').textContent=Number($('width').value).toFixed(2).replace('.',',')+' m';$('widthMinus').disabled=s.finished||Number($('width').value)<=.5;$('widthPlus').disabled=s.finished||Number($('width').value)>=2.5;
const box=$('segments');box.replaceChildren();segments.forEach((seg,i)=>{const row=document.createElement('div');row.className='segmentItem '+(i===active?'active ':'')+(seg.finished?'finished':'');const label=document.createElement('span');label.textContent='● Abschnitt '+(i+1)+' · '+fmt(segLength(seg))+' m · '+Number(seg.width||1.5).toFixed(2).replace('.',',')+' m Breite · '+fmt(segLength(seg)*seg.width)+' m²'+(seg.finished?' · fertig':'');label.style.color=colors[i%colors.length];const select=document.createElement('button');select.textContent=i===active?'Aktiv':'Ansehen';select.disabled=i===active;select.onclick=()=>{stop();active=i;render();fitSegment(seg);msg('Abschnitt '+(i+1)+' ausgewählt.' )};row.append(label,select);box.append(row)});paint()}
function fitSegment(s){if(map&&s.points.length){if(s.points.length===1)map.setView([s.points[0].lat,s.points[0].lng],17);else map.fitBounds(L.latLngBounds(s.points.map(p=>[p.lat,p.lng])).pad(.25))}}
function add(p,source){const s=current();if(s.finished){msg('Dieser Abschnitt ist abgeschlossen. Bitte „Nächste Ölspur“ wählen.');return}if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng))return;const prev=s.points.at(-1);if(prev&&meters(prev,p)<2){msg('Punkt zu nah am letzten Messpunkt (<2 m).');return}s.points.push({lat:p.lat,lng:p.lng,accuracy:p.accuracy??null,time:new Date().toISOString(),source});render();if(map)map.panTo([p.lat,p.lng]);msg('Abschnitt '+(active+1)+': Punkt '+s.points.length+' gesetzt ('+source+').')}
function initMap(){if(typeof L==='undefined'){msg('Kartenbibliothek nicht geladen. Internetverbindung prüfen.');$('mapFallback').textContent='Karte nicht verfügbar. Internetverbindung und Inhaltsblocker prüfen.';return}map=L.map('map').setView([49.8988,10.9028],12);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap-Mitwirkende'}).addTo(map);map.on('click',e=>add({lat:e.latlng.lat,lng:e.latlng.lng},'Karte'));setTimeout(()=>map.invalidateSize(),250)}
function geoError(e){const desc={1:'Standortzugriff verweigert. Safari-Ortungsdienste prüfen.',2:'GPS-Position nicht verfügbar.',3:'GPS-Zeitüberschreitung.'};msg(desc[e.code]||'GPS-Fehler: '+e.message)}
function gps(cb){if(!navigator.geolocation){msg('GPS wird nicht unterstützt.');return}navigator.geolocation.getCurrentPosition(p=>{lastFix={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy};msg('Standort ermittelt, Genauigkeit ca. ±'+Math.round(p.coords.accuracy)+' m');if(map)map.setView([lastFix.lat,lastFix.lng],17);if(cb)cb(lastFix)},geoError,{enableHighAccuracy:true,timeout:20000,maximumAge:0})}
function stop(){if(watch!==null){navigator.geolocation.clearWatch(watch);watch=null}render()}
function start(){if(current().finished){msg('Abschnitt abgeschlossen. Neuen Abschnitt starten.');return}if(!navigator.geolocation){msg('GPS nicht verfügbar.');return}if(watch!==null)return;watch=navigator.geolocation.watchPosition(p=>{const fix={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy};lastFix=fix;if(fix.accuracy>40){msg('GPS zu ungenau (±'+Math.round(fix.accuracy)+' m), Punkt übersprungen.');return}const prev=current().points.at(-1);if(prev&&meters(prev,fix)<5)return;if(prev&&meters(prev,fix)>150){msg('GPS-Sprung >150 m erkannt; Punkt übersprungen.');return}add(fix,'GPS-Aufzeichnung')},geoError,{enableHighAccuracy:true,maximumAge:0,timeout:20000});render();msg('GPS-Aufzeichnung läuft. App geöffnet lassen.')}
function storage(){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}}
const selectedLocal=new Set();
function persist(list){try{localStorage.setItem(key,JSON.stringify(list));return true}catch{msg('Speichern fehlgeschlagen. Gerätespeicher prüfen.');return false}}
 function renderSaved(){
  const box=$('saved');box.replaceChildren();const list=storage();
  if(!list.length){box.textContent='Noch keine Messungen gespeichert.';return}
  const mergeBar=document.createElement('div');mergeBar.style.cssText='display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0';
  const mergeBtn=document.createElement('button');mergeBtn.type='button';mergeBtn.textContent='🔗 Ausgewählte zu einem Einsatz zusammenführen';
  const mergeInfo=document.createElement('span');mergeInfo.textContent='Messungen auswählen (mindestens 2)';
  function updateMerge(){mergeInfo.textContent=selectedLocal.size+' Messungen ausgewählt';mergeBtn.disabled=selectedLocal.size<2;}
  mergeBtn.addEventListener('click',()=>{
   try{
    const latest=storage();const picks=[...selectedLocal].sort((a,b)=>a-b).map(i=>latest[i]);
    if(picks.length<2||picks.some(x=>!x))throw Error('Bitte mindestens zwei gültige Messungen auswählen.');
    const joined=[];
    picks.forEach((item,sourceIndex)=>{
     if(!Array.isArray(item.segments))throw Error('Eine ausgewählte Messung hat keine gültigen Abschnitte.');
     item.segments.forEach((s,segmentIndex)=>{
      if(!Array.isArray(s.points)||s.points.length<2)return;
      const points=s.points.map(p=>({...p,lat:Number(p.lat),lng:Number(p.lng)}));
      if(points.some(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||Math.abs(p.lat)>90||Math.abs(p.lng)>180))throw Error('Ungültige GPS-Punkte in Messung '+(sourceIndex+1));
      joined.push({...JSON.parse(JSON.stringify(s)),id:'merge-'+Date.now()+'-'+sourceIndex+'-'+segmentIndex+'-'+Math.random().toString(36).slice(2),points,width:WIDTHS.includes(Number(s.width))?Number(s.width):1.5,passes:1,finished:false});
     });
    });
    if(!joined.length)throw Error('Keine Abschnitte mit mindestens zwei GPS-Punkten gefunden.');
    const proposed=picks.map(x=>x.title).filter(Boolean)[0]||'Gemeinsamer Einsatz';
    const title=prompt('Name des gemeinsamen Einsatzes:',proposed);if(title===null)return;
    if(!title.trim())throw Error('Bitte einen Einsatznamen eingeben.');
    if(segments.some(s=>s.points?.length)&&!confirm('Aktuell geöffnete Messansicht ersetzen? Die lokal gespeicherten Messungen bleiben erhalten.'))return;
    stop();window.dispatchEvent(new CustomEvent('agb:new-measurement'));
    segments=joined;active=0;lastFix=null;$('title').value=title.trim();render();fitAll();
    selectedLocal.clear();renderSaved();
    msg('Gemeinsamer Einsatz vorbereitet: '+joined.length+' Abschnitte aus '+picks.length+' lokalen Messungen. Jetzt „Zentral speichern“ wählen.');
    document.getElementById('measurePanel')?.scrollIntoView({behavior:'smooth'});
   }catch(e){msg('Zusammenführen fehlgeschlagen: '+e.message);console.error(e)}
  });
  mergeBar.append(mergeBtn,mergeInfo);box.append(mergeBar);updateMerge();
  const backup=document.createElement('button');backup.type='button';backup.textContent='⬇ Alle lokalen Messungen sichern (JSON)';
  backup.addEventListener('click',()=>{try{download('agb-lokale-messungen-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({format:'agb-local-backup-v1',created:new Date().toISOString(),measurements:storage()},null,2),'application/json');msg('Sicherung heruntergeladen.')}catch(e){msg('Sicherung fehlgeschlagen: '+e.message)}});
  box.append(backup);
  list.forEach((item,i)=>{
   const row=document.createElement('div');row.className='savedItem';
   const choose=document.createElement('input');choose.type='checkbox';choose.setAttribute('aria-label','Messung '+(i+1)+' zum gemeinsamen Einsatz auswählen');choose.checked=selectedLocal.has(i);choose.addEventListener('change',()=>{if(choose.checked)selectedLocal.add(i);else selectedLocal.delete(i);updateMerge()});
   const span=document.createElement('span');
   const sum=(item.segments||[]).reduce((n,s)=>n+segLength(s),0);
   const date=item.created?new Date(item.created):null;
   span.textContent=(item.title||'Messung')+' · '+(date&&!Number.isNaN(date.getTime())?date.toLocaleString('de-DE'):'ohne Datum')+' · '+fmt(sum)+' m · '+(item.segments||[]).length+' Abschnitte';
   const open=document.createElement('button');open.type='button';open.textContent='Laden';
   const del=document.createElement('button');del.type='button';del.textContent='Löschen';
   const feedback=document.createElement('div');feedback.style.cssText='width:100%;font-size:14px;margin-top:6px;white-space:normal';
   let mode='';
   function clearChoice(){mode='';feedback.textContent='';open.textContent='Laden';del.textContent='Löschen';}
   open.addEventListener('click',()=>{
    if(mode!=='load'&&segments.some(s=>s.points?.length)){
     clearChoice();mode='load';open.textContent='Laden bestätigen';
     feedback.textContent='Die aktuelle Messansicht wird ersetzt (gespeicherte Messungen bleiben erhalten). Zum Öffnen erneut klicken.';return;
    }
    try{
     if(!Array.isArray(item.segments)||!item.segments.length)throw Error('Keine gültigen Abschnitte gespeichert.');
     const loaded=JSON.parse(JSON.stringify(item.segments));
     if(!loaded.every(s=>Array.isArray(s.points)))throw Error('Gespeicherte Messpunkte sind ungültig.');
     stop();window.dispatchEvent(new CustomEvent('agb:new-measurement'));
     segments=loaded;active=Math.max(0,Math.min(Number(item.active??loaded.length-1)||0,loaded.length-1));
     $('title').value=item.title||'';render();fitAll();
     msg('Gespeicherte Messung geladen: '+(item.title||'Messung'));
     document.getElementById('map')?.scrollIntoView({behavior:'smooth',block:'center'});
     clearChoice();
    }catch(e){feedback.textContent='Laden fehlgeschlagen: '+e.message;msg('Laden fehlgeschlagen: '+e.message);console.error(e)}
   });
   del.addEventListener('click',()=>{
    if(mode!=='delete'){
     clearChoice();mode='delete';del.textContent='Löschen bestätigen';
     feedback.textContent='Diese lokale Messung wird endgültig gelöscht. Vorher möglichst die JSON-Sicherung herunterladen. Erneut klicken zum Löschen.';return;
    }
    try{
     const latest=storage();
     // Index plus vollständiger Datenvergleich: funktioniert auch bei alten Einträgen ohne ID.
     if(i>=latest.length||JSON.stringify(latest[i])!==JSON.stringify(item))throw Error('Liste wurde verändert. Bitte Seite neu laden.');
     latest.splice(i,1);
     if(!persist(latest))throw Error('Speichern im Browser fehlgeschlagen.');
     selectedLocal.clear();renderSaved();msg('Lokale Messung gelöscht.');
    }catch(e){feedback.textContent='Löschen fehlgeschlagen: '+e.message;msg('Löschen fehlgeschlagen: '+e.message);console.error(e)}
   });
   row.append(choose,span,open,del,feedback);box.append(row);
  });
 }
function fitAll(){if(!map)return;const pts=segments.flatMap(s=>s.points);if(pts.length===1)map.setView([pts[0].lat,pts[0].lng],17);else if(pts.length>1)map.fitBounds(L.latLngBounds(pts.map(p=>[p.lat,p.lng])).pad(.15))}
function download(filename,data,type){const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000)}
function migrate(){if(localStorage.getItem('agb_v21_migrated'))return;try{const old=JSON.parse(localStorage.getItem(oldKey)||'[]');if(old.length){const existing=storage();old.forEach(o=>{existing.push({id:o.id||String(Date.now()),created:o.created||new Date().toISOString(),title:o.title||'',active:0,segments:[{id:'alt',points:o.points||[],passes:o.passes||1,width:o.width||2.5,finished:true}]})});if(!persist(existing))return}localStorage.setItem('agb_v21_migrated','1')}catch{}}
$('locate').onclick=()=>gps();$('point').onclick=()=>gps(p=>{if(p.accuracy>40){msg('GPS ungenau (±'+Math.round(p.accuracy)+' m). Bitte warten und erneut versuchen.');return}add(p,'GPS')});$('start').onclick=()=>{if(watch!==null){stop();msg('Aufzeichnung beendet. Messung kontrollieren und speichern.')}else start()};$('undo').onclick=()=>{current().points.pop();render();msg('Letzten Punkt entfernt.')};$('apply').onclick=()=>{if(validInputs()){render();msg('Werte für Abschnitt '+(active+1)+' übernommen.')}};$('widthMinus').onclick=()=>setWidth(WIDTHS[Math.max(0,WIDTHS.indexOf(Number(current().width))-1)]);$('widthPlus').onclick=()=>setWidth(WIDTHS[Math.min(4,WIDTHS.indexOf(Number(current().width))+1)]);
$('finish').onclick=()=>{if(!validInputs())return;if(current().points.length<2){msg('Zum Abschließen mindestens zwei Messpunkte setzen.');return}stop();current().finished=true;render();msg('Abschnitt '+(active+1)+' abgeschlossen. Für getrennte Verschmutzung „Nächste Ölspur“ wählen.')};
$('next').onclick=()=>{if(!validInputs())return;if(current().points.length<2){msg('Zuerst mindestens zwei Punkte im aktuellen Abschnitt setzen.');return}stop();current().finished=true;segments.push(fresh());active=segments.length-1;render();msg('Abschnitt '+(active+1)+' gestartet. Saubere Zwischenstrecke wird nicht mitgerechnet.')} ;
$('clear').onclick=()=>{if(segments.some(s=>s.points.length)&&!confirm('Neuen Einsatz beginnen? Nicht gespeicherte Daten gehen verloren.'))return;window.dispatchEvent(new CustomEvent('agb:new-measurement'));window.AGBMeasure.reset();};
$('save').onclick=()=>{if(!validInputs())return;if(!segments.some(s=>s.points.length>=2)){msg('Bitte mindestens zwei Messpunkte setzen.');return}const list=storage();list.unshift({id:globalThis.crypto?.randomUUID?.()||String(Date.now()),created:new Date().toISOString(),title:$('title').value.trim(),active,segments:JSON.parse(JSON.stringify(segments))});if(persist(list)){renderSaved();msg('Einsatz mit '+segments.length+' Abschnitt(en) lokal gespeichert.')}};
$('geo').onclick=()=>{const features=segments.filter(s=>s.points.length>=2).map((s,i)=>({type:'Feature',properties:{abschnitt:segments.indexOf(s)+1,auftrag:$('title').value,laenge_m:segLength(s),breite_m:s.width,flaeche_m2:segLength(s)*s.width},geometry:{type:'LineString',coordinates:s.points.map(p=>[p.lng,p.lat])}}));if(!features.length){msg('Keine vollständigen Abschnitte vorhanden.');return}download('agb-oelspur-abschnitte.geojson',JSON.stringify({type:'FeatureCollection',features},null,2),'application/geo+json')};
$('csv').onclick=()=>{if(!segments.some(s=>s.points.length)){msg('Keine Messpunkte vorhanden.');return}const rows=['Abschnitt;Punkt;Breitengrad;Laengengrad;Genauigkeit_m;Zeit;Quelle;Breite_m'];segments.forEach((s,i)=>s.points.forEach((p,j)=>rows.push([i+1,j+1,p.lat,p.lng,p.accuracy??'',p.time,p.source,s.width].join(';'))));download('agb-oelspur-abschnitte.csv','\ufeff'+rows.join('\r\n'),'text/csv;charset=utf-8')};$('print').onclick=()=>{if(!validInputs())return;window.print()};
window.AGBMeasure={reset:()=>{stop();segments=[fresh()];active=0;lastFix=null;$('title').value='';render();if(map)map.setView([49.8988,10.9028],12);msg('Neuer Einsatz bereit: Abschnitt 1, 0 Messpunkte.');},get:()=>({title:$('title').value.trim(),segments:JSON.parse(JSON.stringify(segments)),active}),getActive:()=>({segment:JSON.parse(JSON.stringify(current())),active}),loadSegment:(job,segmentId)=>{stop();const s=(job.segments||[]).find(x=>x.id===segmentId);if(!s)throw Error('Abschnitt nicht gefunden.');segments=[JSON.parse(JSON.stringify(s))];segments[0].finished=false;segments[0].passes=1;segments[0].width=WIDTHS.includes(Number(s.width))?Number(s.width):1.5;active=0;$('title').value=job.title||'';render();fitAll();msg('Zugewiesener Abschnitt geladen. Änderungen zentral speichern.')},load:(job)=>{stop();segments=JSON.parse(JSON.stringify(job.segments||[]));if(!segments.length)segments=[fresh()];active=0;$('title').value=job.title||'';render();fitAll();msg('Einsatz aus zentraler Verwaltung geladen.')},fit:fitAll};
initMap();migrate();renderSaved();render();
})();