(()=>{'use strict';
const $=id=>document.getElementById(id),ORIGIN='https://script.google.com';let bridgeOrigin=ORIGIN,bridgeWindow=null,frame=null,ready=false,sequence=0,pending=new Map(),token=sessionStorage.getItem('agb_v3_token')||'',user=null,users=[],jobs=[],editing=null,jobView='active';
const note=s=>$('cloudStatus').textContent=s;
function setupFrame(){const url=localStorage.getItem('agb_v3_backend');if(!url){$('connectionSetup').hidden=false;return}try{const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='script.google.com'||!/^\/macros\/s\/[^/]+\/exec$/.test(u.pathname))throw Error('Adresse muss eine veröffentlichte Apps-Script-/exec-URL sein.');frame=document.createElement('iframe');frame.referrerPolicy='no-referrer';frame.src=u.href;frame.style.cssText='position:absolute;width:1px;height:1px;opacity:0;pointer-events:none';frame.title='AGB Datenverbindung';document.body.append(frame);$('connectionSetup').hidden=true;$('loginPanel').hidden=false;note('Verbindung wird aufgebaut …');setTimeout(()=>{if(!ready)note('Keine Verbindung: Die Google-Web-App antwortet nicht. Bei Bereitstellung „Nur ich“ blockiert Google häufig die Anmeldung im eingebetteten Fenster. Bitte Freigabe NICHT ungeprüft ändern.')},12000)}catch(e){note(e.message);$('connectionSetup').hidden=false}}
window.addEventListener('message',event=>{if(!frame||!(event.origin===ORIGIN||/^https:\/\/[a-z0-9.-]+\.googleusercontent\.com$/.test(event.origin)))return;const d=event.data||{};if(d.kind==='agb-ready'){if(ready||!event.source)return;bridgeWindow=event.source;bridgeOrigin=event.origin;ready=true;note('Datenverbindung bereit.');if(token)call('me',{token}).then(x=>{user=x.user;(user.mustChangePassword?showPasswordPanel():showSession());if(!user.mustChangePassword)run(refresh)}).catch(()=>{token='';sessionStorage.removeItem('agb_v3_token');note('Bitte anmelden.')});return}if(d.kind==='agb-response'){if(event.source!==bridgeWindow||event.origin!==bridgeOrigin)return;const p=pending.get(d.id);if(!p)return;pending.delete(d.id);clearTimeout(p.timer);d.result?.ok?p.resolve(d.result.data):p.reject(Error(d.result?.error||'Unbekannter Serverfehler'))}});
function call(op,args={}){return new Promise((resolve,reject)=>{if(!ready||!bridgeWindow)return reject(Error('Keine Verbindung zum Google-Script.'));const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Zeitüberschreitung.'))},45000);pending.set(id,{resolve,reject,timer});bridgeWindow.postMessage({kind:'agb-request',id,op,args},bridgeOrigin)})}
async function run(fn){try{await fn()}catch(e){const message='Fehler: '+e.message;note(message);const el=$('cloudStatus');if(el){el.style.cssText='position:fixed;bottom:12px;left:12px;right:12px;z-index:9999;background:#fff0f0;border:2px solid #b91c1c;color:#7f1d1d;padding:14px;border-radius:9px;box-shadow:0 4px 20px #0003;max-width:700px;margin:auto';el.scrollIntoView({block:'nearest'});setTimeout(()=>{el.style.cssText=''},12000)}console.error('AGB Aktion fehlgeschlagen:',e)}}
function showSession(){$('passwordPanel').hidden=false;$('passwordPanel').hidden=true;$('loginPanel').hidden=true;$('sessionPanel').hidden=false;$('sessionLabel').textContent='Angemeldet: '+user.name+' ('+(user.role==='admin'?'Administrator':user.role==='leader'?'Einsatzleiter':'Fahrer')+')';$('adminTools').hidden=user.role!=='admin';$('largeJobBtn').hidden=!['admin','leader'].includes(user.role);$('adminLink').hidden=user.role!=='admin';$('tabArchive').hidden=user.role!=='admin';if(user.role!=='admin')jobView='active';setJobTab()}
function showPasswordPanel(){ $('loginPanel').hidden=true;$('sessionPanel').hidden=true;$('passwordPanel').hidden=false;note(user?.mustChangePassword?'Startpasswort muss geändert werden.':'Eigenes Passwort ändern.'); }
function logout(){jobView='active';editing=null;$('syncPanel').hidden=true;token='';user=null;sessionStorage.removeItem('agb_v3_token');$('sessionPanel').hidden=true;$('passwordPanel').hidden=true;$('loginPanel').hidden=false;note('Abgemeldet.');}
$('changeOwnPassword').onclick=showPasswordPanel;
$('cancelPassword').onclick=logout;
$('saveOwnPassword').onclick=()=>run(async()=>{const oldPassword=$('oldPassword').value,newPassword=$('newOwnPassword').value,confirm=$('confirmOwnPassword').value;if(!/^[0-9]{4,12}$/.test(newPassword))throw Error('Bitte 4 bis 12 Ziffern eingeben.');if(newPassword!==confirm)throw Error('Neue Passwörter stimmen nicht überein.');await call('changePassword',{token,oldPassword,newPassword});$('oldPassword').value='';$('newOwnPassword').value='';$('confirmOwnPassword').value='';logout();note('Passwort geändert. Bitte mit dem neuen Passwort anmelden.');});
$('connectBackend').onclick=()=>{const url=$('backendUrl').value.trim();localStorage.setItem('agb_v3_backend',url);for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Verbindung wurde neu eingerichtet.'))}pending.clear();frame?.remove();frame=null;bridgeWindow=null;bridgeOrigin=ORIGIN;ready=false;setupFrame()};
$('loginBtn').onclick=()=>run(async()=>{const x=await call('login',{name:$('loginName').value,password:$('loginPassword').value});token=x.token;user=x.user;sessionStorage.setItem('agb_v3_token',token);$('loginPassword').value='';if(user.mustChangePassword){showPasswordPanel();return;}showSession();note('Angemeldet.');await refresh()});
$('logoutBtn').onclick=logout;
let refreshing=null;
async function refresh(){
 if(refreshing)return refreshing;
 refreshing=(async()=>{
  note('Lade zentrale Einsätze …');
  // Unabhängige Leseanfragen gleichzeitig statt nacheinander ausführen.
  const [newJobs,newUsers]=await Promise.all([call('jobs',{token}),['admin','leader'].includes(user.role)?call('users',{token}):Promise.resolve([])]);
  jobs=newJobs;users=newUsers;
  if(user.role==='admin')renderUsers();
  renderJobs();note(jobs.length+' zentrale Einsätze geladen.');
 })();
 try{return await refreshing}finally{refreshing=null}
}
$('refreshJobs').onclick=()=>run(refresh);
// Sichtbare Bestätigung und Fehlermeldungen direkt am Speicherbutton.
const sendButton=$('sendJob');
const sendFeedback=document.createElement('div');sendFeedback.id='sendJobFeedback';sendFeedback.setAttribute('role','status');sendFeedback.style.cssText='width:100%;padding:8px 10px;margin:8px 0;border-radius:6px;background:#eef6ff;color:#16385a;white-space:pre-wrap';sendFeedback.textContent='Bereit: Lokale Messung laden und hier zentral speichern.';
sendButton.insertAdjacentElement('afterend',sendFeedback);
let sendArmed=false,sendBusy=false;
function resetSendButton(){sendArmed=false;sendButton.textContent=window.AGBLargeMode?'🚨 Großeinsatz als Entwurf zentral anlegen':'Aktuelle Messung zentral speichern';sendButton.disabled=false;}
sendButton.addEventListener('click',async()=>{
 if(sendBusy)return;
 try{
  sendFeedback.textContent='Prüfe die aktuelle Messung …';
  if(!user||!token)throw Error('Bitte zuerst in der zentralen Einsatzverwaltung anmelden.');
  if(!ready)throw Error('Die Google-Datenverbindung ist noch nicht bereit.');
  if(editing)throw Error('Zentrale Abschnittsbearbeitung aktiv. Bitte zuerst „Bearbeitung verlassen“ wählen.');
  if(!window.AGBMeasure||typeof window.AGBMeasure.get!=='function')throw Error('Vermessungsmodul ist nicht geladen.');
  const m=window.AGBMeasure.get();
  if(!m.title)throw Error('Bitte oben unter „Bezeichnung / Auftrag“ einen Einsatznamen eingeben.');
  const complete=(m.segments||[]).filter(s=>Array.isArray(s.points)&&s.points.length>=2);
  if(!complete.length)throw Error('Die geladene Messung benötigt mindestens einen Abschnitt mit zwei GPS-Punkten.');
  if(complete.length!==m.segments.length)throw Error('Ein Abschnitt enthält weniger als zwei GPS-Punkte. Bitte diesen Abschnitt vervollständigen oder entfernen.');
  if(!sendArmed){sendArmed=true;sendButton.textContent='✓ Zentral speichern bestätigen';sendFeedback.textContent='Bereit: „'+m.title+'“ mit '+complete.length+' Abschnitt(en). Zum Übertragen erneut auf „Zentral speichern bestätigen“ klicken. Lokale Sicherungen bleiben erhalten.';return;}
  sendBusy=true;sendButton.disabled=true;sendFeedback.textContent='Übertrage „'+m.title+'“ an die zentrale Einsatzverwaltung …';
  if(window.AGBLargeMode&&draftBusy)throw Error('Automatisches Speichern läuft. Bitte kurz warten.');if(window.AGBLargeMode&&draftId){await saveDraft();sendFeedback.textContent='Entwurf aktualisiert.';resetSendButton();sendBusy=false;return;}const r=await call('createJob',{token,title:m.title,segments:m.segments,large:window.AGBLargeMode});if(window.AGBLargeMode){draftId=r.id;setMode(true);}
  resetSendButton();sendBusy=false;
  // Die lokale Kopie bleibt gespeichert. Nur die geöffnete Ansicht wird zurückgesetzt.
  if(!window.AGBLargeMode)window.AGBMeasure.reset();
  sendFeedback.textContent='Erfolgreich zentral gespeichert: „'+m.title+'“ ('+complete.length+' Abschnitte). Einsatz-ID: '+(r?.id||'vergeben');
  try{await refresh()}catch(e){sendFeedback.textContent+='\nDer Einsatz wurde angelegt, aber die Liste konnte nicht aktualisiert werden: '+e.message;}
 }catch(e){sendBusy=false;resetSendButton();sendFeedback.textContent='Zentrales Speichern nicht möglich: '+e.message;note('Fehler: '+e.message);console.error('AGB Zentrales Speichern',e);}
});
$('addDriver').onclick=()=>run(async()=>{const name=$('newDriver').value.trim(),password=$('newPassword').value;if(!name||!/^[0-9]{4,12}$/.test(password))throw Error('Name und Passwort mit 4 bis 12 Ziffern eingeben.');await call('addUser',{token,name,password,role:$('newRole').value});$('newDriver').value='';$('newPassword').value='';await refresh()});
function button(label,handler){const b=document.createElement('button');b.textContent=label;b.onclick=()=>run(handler);return b}
function renderUsers(){
 const box=$('driverList');box.replaceChildren();
 users.filter(u=>u.role==='driver'||u.role==='leader').forEach(u=>{
  const row=document.createElement('div');row.className='savedItem';
  const span=document.createElement('span');span.textContent=u.name+' · '+(u.role==='leader'?'Einsatzleiter':'Fahrer')+(u.active?' · aktiv':' · gesperrt');
  row.append(span,button(u.role==='driver'?'Zum Einsatzleiter':'Zum Fahrer',async()=>{if(!confirm('Rolle ändern? Der Benutzer muss sich danach neu anmelden.'))return;await call('setRole',{token,id:u.id,role:u.role==='driver'?'leader':'driver'});await refresh()}),
   button(u.active?'Sperren':'Aktivieren',async()=>{if(!confirm('Benutzerstatus ändern?'))return;await call('setUserActive',{token,id:u.id,active:!u.active});await refresh()}),
   button('Passwort ändern',async()=>{const p=prompt('Neues Passwort (4 bis 12 Ziffern):');if(p===null)return;await call('resetPassword',{token,id:u.id,password:p});note('Passwort geändert.')}),
   button('🗑️ Fahrer löschen',async()=>{
    const name=prompt('Fahrer endgültig löschen? Zur Bestätigung den vollständigen Fahrernamen eingeben: '+u.name);
    if(name===null)return;
    if(name!==u.name)throw Error('Fahrername stimmt nicht überein.');
    if(!confirm('Fahrerkonto „'+u.name+'“ endgültig löschen? Dies kann nicht rückgängig gemacht werden. Bei vorhandener Einsatzhistorie wird das Konto entfernt und die technische Zuordnung für alte Berichte erhalten.'))return;
    await call('deleteUser',{token,id:u.id,confirmName:name});
    await refresh();note('Fahrerkonto „'+u.name+'“ entfernt; historische Zuordnungen bleiben erhalten.');
   })
  );box.append(row);
 });
}
function firstPoint(segment){const p=segment?.points?.[0];if(!p)return null;const lat=Number(p.lat),lng=Number(p.lng);return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng}:null}
function navigateTo(segment){const p=firstPoint(segment);if(!p)throw Error('Für diesen Abschnitt ist noch kein gültiger GPS-Startpunkt vorhanden.');const url='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(p.lat+','+p.lng)+'&travelmode=driving';const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.click();note('Navigation zum ersten GPS-Punkt geöffnet. Lkw-Beschränkungen beachten.');}
function editSegment(job,segment){
 if(editing&&!confirm('Bisherige, noch nicht zentral gespeicherte Änderungen verwerfen?'))return;
 window.AGBMeasure.loadSegment(job,segment.id);editing={jobId:job.id,segmentId:segment.id,revision:job.segmentRevisions?.[segment.id]};
 $('syncPanel').hidden=false;$('syncLabel').textContent='Zentral bearbeiten: '+job.title+' / '+(segment.name||'Abschnitt');
 document.getElementById('measurePanel').scrollIntoView({behavior:'smooth'});note('Abschnitt geladen. Nach der Messung zentral aktualisieren.');
}
$('syncSegment').onclick=()=>run(async()=>{if(!editing)throw Error('Kein zentraler Abschnitt geladen.');const s=window.AGBMeasure.getActive().segment;if(s.points.length<2)throw Error('Mindestens zwei Messpunkte erforderlich.');if(!confirm('Diesen Abschnitt zentral aktualisieren?'))return;await call('updateSegment',{token,jobId:editing.jobId,segmentId:editing.segmentId,revision:editing.revision,segment:s});editing=null;$('syncPanel').hidden=true;await refresh();note('Abschnitt erfolgreich zentral synchronisiert.');});
$('syncCancel').onclick=()=>{if(!confirm('Zentrale Bearbeitung verlassen? Nicht übertragene Änderungen bleiben nur in der Messansicht.'))return;editing=null;$('syncPanel').hidden=true;note('Zentrale Bearbeitung beendet.')};
window.addEventListener('agb:new-measurement',()=>{editing=null;$('syncPanel').hidden=true;note('Neue Messung gestartet. Zentrale Abschnittsbearbeitung beendet.');});
function setJobTab(){ $('tabActive').classList.toggle('selected',jobView==='active');$('tabArchive').classList.toggle('selected',jobView==='archive');}
$('tabActive').onclick=()=>{jobView='active';setJobTab();renderJobs()};
$('tabArchive').onclick=()=>{if(user?.role!=='admin')return;jobView='archive';setJobTab();renderJobs()};
function safeDate(x){const d=new Date(x);return Number.isNaN(d.getTime())?'':d.toLocaleString('de-DE')}
function jobStatus(j){return j.status==='entwurf'?'🔒 Entwurf':j.status==='archiviert'?'Archiviert':j.assignments?.some(a=>a.status==='in Bearbeitung')?'In Bearbeitung':'Offen'}
function renderJobs(){
 const box=$('cloudJobs');box.replaceChildren();
 const active=jobs.filter(j=>j.status!=='archiviert'),archived=jobs.filter(j=>j.status==='archiviert');
 $('jobStats').textContent=active.length+' aktiv · '+(user?.role==='admin'?archived.length+' archiviert':'Meine Einsätze');
 const list=(jobView==='archive'&&user?.role==='admin'?archived:active);
 if(!list.length){const empty=document.createElement('p');empty.className='empty-state';empty.textContent=jobView==='archive'?'Das Archiv ist leer.':'Keine aktiven Einsätze vorhanden.';box.append(empty);return}
 list.forEach(j=>{
  const isArchived=j.status==='archiviert';
  const card=document.createElement('article');card.className='job-card'+(isArchived?' archived':'');
  const header=document.createElement('div');header.className='job-card-header';
  const title=document.createElement('div');const h=document.createElement('h4');h.textContent=j.title;const date=document.createElement('small');date.textContent='Erstellt: '+safeDate(j.createdAt);title.append(h,date);
  const badge=document.createElement('span');badge.className='status-badge '+(isArchived?'badge-archived':'badge-active');badge.textContent=jobStatus(j);header.append(title,badge);card.append(header);
  const controls=document.createElement('div');controls.className='job-actions';
  controls.append(button('🗺️ Auf Karte',async()=>{window.AGBMeasure.load(j);document.getElementById('measurePanel').scrollIntoView({behavior:'smooth'});note('Einsatz auf Karte geöffnet.')}));
  if(['admin','leader'].includes(user.role)){
   if(j.status==='entwurf')controls.append(button('🟢 Für Fahrer freigeben',async()=>{if(!confirm('Großeinsatz jetzt für zugewiesene Fahrer freigeben?'))return;await call('releaseJob',{token,jobId:j.id});await refresh()}));
   if(isArchived){controls.append(button('↩ Wieder öffnen',async()=>{if(!confirm('Einsatz wieder aktivieren?'))return;note('Öffne Einsatz „'+j.title+'“ …');await call('reopenJob',{token,jobId:j.id});jobView='active';setJobTab();await refresh();note('Einsatz „'+j.title+'“ wieder geöffnet.')}));controls.append(button('🗑️ Löschen',async()=>{const typed=prompt('Einsatz endgültig löschen? Alle GPS-Punkte und Zuweisungen gehen verloren. Zur Bestätigung exakt den Einsatznamen eingeben: '+j.title);if(typed===null)return;if(typed!==j.title)throw Error('Einsatzname stimmt nicht überein.');if(!confirm('Wirklich endgültig löschen? Dieser Schritt kann nicht rückgängig gemacht werden.'))return;note('Lösche Einsatz „'+j.title+'“ …');await call('deleteJob',{token,jobId:j.id,confirmTitle:typed});await refresh();note('Einsatz „'+j.title+'“ gelöscht.')}));}
   else if(j.status!=='entwurf') controls.append(button('📁 Abschließen',async()=>{if(!confirm('Gesamten Einsatz archivieren? Fahrer können ihn danach nicht mehr bearbeiten.'))return;await call('archiveJob',{token,jobId:j.id});await refresh()}));
  }
  card.append(controls);
  const details=document.createElement('details');details.className='job-details';const summary=document.createElement('summary');summary.textContent='Abschnitte anzeigen ('+j.segments.length+')';details.append(summary);
  j.segments.forEach((segment,i)=>{
   const row=document.createElement('div');row.className='job-segment';const a=j.assignments.find(x=>x.segmentId===segment.id),driver=users.find(x=>x.id===a?.driverId);
   const info=document.createElement('div');info.className='segment-info';const label=document.createElement('strong');label.textContent=segment.name?.trim()||'Abschnitt '+(i+1);const meta=document.createElement('span');meta.textContent=(driver?.name||(a?'Zugewiesen':'Nicht zugewiesen'))+' · '+(a?.status||'offen');info.append(label,meta);row.append(info);
   const actions=document.createElement('div');actions.className='segment-actions';
   if(!isArchived&&(['admin','leader'].includes(user.role)||a?.driverId===user.id))actions.append(button('✏️ Vermessen',async()=>editSegment(j,segment)));
   if(firstPoint(segment)&&(['admin','leader'].includes(user.role)||a?.driverId===user.id))actions.append(button('📍 Navigation',async()=>navigateTo(segment)));
   if(!isArchived&&['admin','leader'].includes(user.role)){
    const select=document.createElement('select');select.setAttribute('aria-label','Fahrer für Abschnitt '+(i+1)+' zuweisen');const opt=document.createElement('option');opt.value='';opt.textContent='Fahrer zuweisen';select.append(opt);
    users.filter(x=>x.role==='driver'&&x.active).forEach(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=x.name;if(a?.driverId===x.id)o.selected=true;select.append(o)});
    select.onchange=()=>run(async()=>{if(!select.value)return;await call('assign',{token,jobId:j.id,segmentId:segment.id,driverId:select.value});await refresh()});actions.append(select);
   }
   if(!isArchived&&a&&(['admin','leader'].includes(user.role)||a.driverId===user.id)){
    const sel=document.createElement('select');sel.setAttribute('aria-label','Bearbeitungsstatus Abschnitt '+(i+1));['offen','in Bearbeitung','abgeschlossen'].forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;o.selected=a.status===v;sel.append(o)});
    sel.onchange=()=>run(async()=>{await call('status',{token,assignmentId:a.id,status:sel.value});await refresh()});actions.append(sel);
   }
   row.append(actions);details.append(row);
  });card.append(details);box.append(card);
 });
}

let draftId=null,draftTimer=null,draftBusy=false;
function setMode(large){window.AGBLargeMode=large;$('modeBanner').textContent=large?'🚨 Großeinsatz: Nur Längen vermessen, Breite bleibt offen.':'📍 Normale Vermessung: Länge messen, danach Breite eingeben.';$('sendJob').textContent=large?'🚨 Großeinsatz als Entwurf zentral anlegen':'Aktuelle Messung zentral speichern';$('draftControls').hidden=!large||!draftId;}
$('largeJobBtn').onclick=()=>{if(!user||!['admin','leader'].includes(user.role))return;window.AGBMeasure.reset();draftId=null;setMode(true);$('title').focus();document.getElementById('measurePanel').scrollIntoView({behavior:'smooth'});note('Großeinsatz: Strecke erfassen, dann als Entwurf zentral anlegen.');};
$('normalMeasure').onclick=()=>{draftId=null;setMode(false);window.AGBMeasure.reset()};
async function saveDraft(){if(!draftId||!window.AGBLargeMode||draftBusy)return;draftBusy=true;$('draftState').textContent='Wird gespeichert …';try{const m=window.AGBMeasure.get();await call('saveDraft',{token,jobId:draftId,segments:m.segments});$('draftState').textContent='Zentral gespeichert · '+new Date().toLocaleTimeString('de-DE');}catch(e){$('draftState').textContent='Nicht übertragen: '+e.message;note('Entwurf nicht synchronisiert: '+e.message)}finally{draftBusy=false}}
$('saveDraftNow').onclick=()=>run(saveDraft);
window.addEventListener('agb:measure-changed',()=>{if(!window.AGBLargeMode||!user||!ready)return;clearTimeout(draftTimer);draftTimer=setTimeout(async()=>{if(draftId){await saveDraft();return}const m=window.AGBMeasure.get();if(!m.title||!m.segments.some(s=>s.points?.length>=2&&s.finished)){ $('draftState').textContent='Bitte Einsatzname eingeben und ersten Abschnitt abschließen.';return}if(draftBusy)return;draftBusy=true;try{const r=await call('createJob',{token,title:m.title,segments:m.segments,large:true});draftId=r.id;setMode(true);$('draftState').textContent='Entwurf automatisch zentral angelegt.';await refresh()}catch(e){note('Automatisches Speichern fehlgeschlagen: '+e.message)}finally{draftBusy=false}},1800)});

$('backendUrl').value=localStorage.getItem('agb_v3_backend')||'';setupFrame();
})();