/** AGB Fahrer-Assistent V3.2: Nur api() und doGet() sind von außen aufrufbar.
 * Interne Helfer sind im Closure verborgen. Bestehende Tabellen und Nutzer bleiben erhalten.
 * WICHTIG: Vor öffentlicher Bereitstellung Bridge, Berechtigungen und echte Login-Tests prüfen.
 */
const AGB_BACKEND_ = (function(){
/** AGB Fahrer-Assistent V3 – Apps Script Backend. Deployment: execute as owner, access anyone. */
const CFG={origin:'https://agb-fahrer.github.io',spreadsheetName:'AGB Fahrer-Assistent V3 – Einsätze',sessionsSeconds:21600};
const TABS={users:['id','name','role','salt','hash','active','created','sessionVersion','mustChangePassword'],jobs:['id','title','createdBy','createdAt','status','segmentsJson'],assignments:['id','jobId','segmentId','driverId','status','updatedAt','note'],audit:['time','actor','action','target']};
function setup(){const p=PropertiesService.getScriptProperties();let id=p.getProperty('SHEET_ID');let ss=id?SpreadsheetApp.openById(id):SpreadsheetApp.create(CFG.spreadsheetName);if(!id)p.setProperty('SHEET_ID',ss.getId());Object.entries(TABS).forEach(([n,h])=>{let sh=ss.getSheetByName(n)||ss.insertSheet(n);if(sh.getLastRow()===0)sh.appendRow(h);
  else if(n==='users' && sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].indexOf('sessionVersion')===-1)
    sh.getRange(1,sh.getLastColumn()+1).setValue('sessionVersion');
  if(n==='users' && sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].indexOf('mustChangePassword')===-1)sh.getRange(1,sh.getLastColumn()+1).setValue('mustChangePassword');
  sh.setFrozenRows(1)});return {sheetUrl:ss.getUrl(),adminExists:rows('users').some(x=>x.role==='admin')};}
function createFirstAdmin(name,password){setup();if(rows('users').some(x=>x.role==='admin'))throw Error('Ein Administrator ist bereits vorhanden.');return addUserInternal(name,password,'admin');}
function internalDoGet(){return HtmlService.createHtmlOutputFromFile('Bridge').setTitle('AGB Datenverbindung').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);}
function sheet(n){const id=PropertiesService.getScriptProperties().getProperty('SHEET_ID');if(!id)throw Error('Zuerst setup() ausführen.');return SpreadsheetApp.openById(id).getSheetByName(n)}
function rows(n){const a=sheet(n).getDataRange().getValues(),h=a.shift();return a.map((r,i)=>({r,i})).filter(x=>x.r[0]).map(x=>Object.fromEntries(h.map((k,j)=>[k,x.r[j]]).concat([['_row',x.i+2]])))}
function append(n,o){sheet(n).appendRow(TABS[n].map(k=>o[k]??''));}
function patch(n,id,changes){const r=rows(n).find(x=>String(x.id)===String(id));if(!r)throw Error('Eintrag nicht gefunden.');const sh=sheet(n);for(const [k,v] of Object.entries(changes)){const col=TABS[n].indexOf(k);if(col>=0)sh.getRange(r._row,col+1).setValue(v)};return {...r,...changes}}
function uid(){return Utilities.getUuid()}
function digest(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s).map(x=>('0'+(x&255).toString(16)).slice(-2)).join('')}
function strongDigest(salt,password){
  let h=digest(salt+password);
  for(let i=0;i<12000;i++)h=digest(h+salt);
  return 'v2:'+h;
}
function checkPassword(p){if(typeof p!=='string'||p.length<12||p.length>200)throw Error('Passwort: mindestens 12 Zeichen.');}
function addUserInternal(name,password,role){checkPassword(password);name=String(name||'').trim();if(!/^[\p{L}\p{N} ._-]{3,60}$/u.test(name))throw Error('Ungültiger Benutzername.');if(rows('users').some(x=>x.name.toLowerCase()===name.toLowerCase()))throw Error('Benutzername bereits vergeben.');const salt=uid()+uid(),user={id:uid(),name,role,salt,hash:strongDigest(salt,password),active:true,created:new Date().toISOString(),sessionVersion:1,mustChangePassword:role!=='admin'};append('users',user);return {id:user.id,name,role};}
function safeUser(u){return {id:u.id,name:u.name,role:u.role,active:String(u.active).toLowerCase()!=='false',mustChangePassword:String(u.mustChangePassword).toLowerCase()==='true'}}
function auth(token){const s=CacheService.getScriptCache().get('s:'+String(token||''));if(!s)throw Error('Sitzung abgelaufen. Bitte erneut anmelden.');const x=JSON.parse(s),u=rows('users').find(u=>u.id===x.id);if(!u||String(u.active).toLowerCase()==='false')throw Error('Konto gesperrt.');if(String(x.ver||'1')!==String(u.sessionVersion||1))throw Error('Sitzung ungültig. Bitte erneut anmelden.');return u}
function admin(u){if(u.role!=='admin')throw Error('Nur für Administratoren.');}
function log(u,action,target){append('audit',{time:new Date().toISOString(),actor:u.id,action,target:target||''})}
function sanitizeSegments(input){if(!Array.isArray(input)||input.length>40)throw Error('Ungültige Abschnitte.');return input.map((s,i)=>{const pts=Array.isArray(s.points)?s.points:[];if(pts.length>1000)throw Error('Zu viele Messpunkte.');return {id:String(s.id||uid()).slice(0,100),name:String(s.name||'Abschnitt '+(i+1)).replace(/^[=+@\-]/,'').slice(0,100),points:pts.map(p=>{const lat=Number(p.lat),lng=Number(p.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw Error('Ungültiger GPS-Punkt.');return {lat,lng}}),passes:Math.max(1,Math.min(30,Math.floor(Number(s.passes)||1))),width:s.width===null||s.width===''?null:(Number.isFinite(Number(s.width))&&Number(s.width)>0&&Number(s.width)<=100?Number(s.width):null),finished:!!s.finished}})}
function response(op,args){args=args||{};if(op==='login'){const name=String(args.name||'').trim().toLowerCase(),p=String(args.password||'');if(name.length>60||p.length>200)throw Error('Anmeldung fehlgeschlagen.');
const key='fail:'+digest(name).slice(0,32),cache=CacheService.getScriptCache();
const props=PropertiesService.getScriptProperties();
const record=JSON.parse(props.getProperty(key)||'{"count":0,"until":0}');
const now=Date.now();
const fails=record.until>now?record.count:0;
if(fails>=8)throw Error('Zu viele Anmeldeversuche. Bitte in 15 Minuten erneut versuchen.');
const u=rows('users').find(x=>String(x.name).toLowerCase()===name&&String(x.active).toLowerCase()!=='false');
const match=!!u&&(String(u.hash).startsWith('v2:')
  ?strongDigest(String(u.salt),p)===String(u.hash)
  :digest(String(u.salt)+p)===String(u.hash));
if(!match){
  props.setProperty(key,JSON.stringify({count:fails+1,until:now+900000}));
  throw Error('Anmeldung fehlgeschlagen.');
}
props.deleteProperty(key);
if(!String(u.hash).startsWith('v2:')){
  patch('users',u.id,{hash:strongDigest(String(u.salt),p)});
}
const token=uid()+uid();CacheService.getScriptCache().put('s:'+token,JSON.stringify({id:u.id,ver:String(u.sessionVersion||1)}),CFG.sessionsSeconds);return {token,user:safeUser(u)}}
const u=auth(args.token);
if(op==='me')return {user:safeUser(u)};
if(op==='changePassword'){
  checkPassword(args.newPassword);
  const old=String(args.oldPassword||'');
  const verified=String(u.hash).startsWith('v2:')?strongDigest(String(u.salt),old)===String(u.hash):digest(String(u.salt)+old)===String(u.hash);
  if(!verified)throw Error('Bisheriges Passwort ist nicht korrekt.');
  if(old===args.newPassword)throw Error('Bitte ein anderes Passwort verwenden.');
  const salt=uid()+uid();
  patch('users',u.id,{salt,hash:strongDigest(salt,args.newPassword),sessionVersion:Number(u.sessionVersion||1)+1,mustChangePassword:false});
  log(u,'changePassword',u.id);
  CacheService.getScriptCache().remove('s:'+String(args.token));
  return {changed:true};
}
if(String(u.mustChangePassword).toLowerCase()==='true')throw Error('Bitte zuerst das Startpasswort ändern.');
if(op==='users'){if(!['admin','leader'].includes(u.role))throw Error('Keine Berechtigung.');return rows('users').map(safeUser)}
if(op==='addUser'){admin(u);const role=['driver','leader'].includes(args.role)?args.role:'driver';const x=addUserInternal(args.name,args.password,role);log(u,'addUser',x.id);return x}
if(op==='setUserActive'){admin(u);const target=rows('users').find(x=>x.id===args.id);if(!target||target.role==='admin')throw Error('Admin-Konto kann hier nicht deaktiviert werden.');patch('users',target.id,{active:args.active===true,sessionVersion:Number(target.sessionVersion||1)+1});log(u,'setUserActive',target.id);return true}
if(op==='deleteUser'){admin(u);
 const target=rows('users').find(x=>String(x.id)===String(args.id));
 if(!target||!['driver','leader'].includes(target.role))throw Error('Nur Fahrer und Einsatzleiter können hier gelöscht werden.');
 if(String(args.confirmName)!==String(target.name))throw Error('Fahrername stimmt nicht überein.');
 if(rows('assignments').some(a=>String(a.driverId)===String(target.id)))throw Error('Fahrer hat Einsatzzuweisungen. Aus Dokumentationsgründen bitte sperren statt löschen.');
 if(rows('jobs').some(j=>String(j.createdBy)===String(target.id)))throw Error('Fahrer hat Einsätze erstellt. Aus Dokumentationsgründen bitte sperren statt löschen.');
 log(u,'deleteUser',target.id+':'+target.name);
 sheet('users').deleteRow(target._row);
 return {deleted:true};
}
if(op==='resetPassword'){admin(u);checkPassword(args.password);const target=rows('users').find(x=>x.id===args.id);if(!target||target.role==='admin')throw Error('Administratorkonto hier nicht änderbar.');const salt=uid()+uid();patch('users',target.id,{salt,hash:strongDigest(salt,args.password),sessionVersion:Number(target.sessionVersion||1)+1,mustChangePassword:true});log(u,'resetPassword',target.id);return true}
if(op==='jobs'){const jobs=rows('jobs'),assign=rows('assignments');return jobs.filter(j=>['admin','leader'].includes(u.role)||(String(j.status)!=='archiviert'&&String(j.status)!=='entwurf'&&(j.createdBy===u.id||assign.some(a=>a.jobId===j.id&&a.driverId===u.id)))).map(j=>({...j,segments:JSON.parse(j.segmentsJson||'[]').filter(s=>['admin','leader'].includes(u.role)||j.createdBy===u.id||assign.some(a=>a.jobId===j.id&&a.driverId===u.id&&a.segmentId===s.id)),segmentsJson:undefined,segmentRevisions:Object.fromEntries(JSON.parse(j.segmentsJson||'[]').map(s=>[s.id,digest(JSON.stringify(s))])),assignments:assign.filter(a=>a.jobId===j.id&&(['admin','leader'].includes(u.role)||a.driverId===u.id||j.createdBy===u.id)).map(a=>({id:a.id,segmentId:a.segmentId,driverId:a.driverId,status:a.status,note:a.note}))}))}
if(op==='createJob'){if(args.large===true&&!['admin','leader'].includes(u.role))throw Error('Nur Einsatzleiter dürfen Großeinsätze anlegen.');const title=String(args.title||'').trim().slice(0,150);if(/^[=+@\-]/.test(title))throw Error('Einsatzbezeichnung darf nicht mit Formelzeichen beginnen.');if(!title)throw Error('Einsatzbezeichnung fehlt.');const seg=sanitizeSegments(args.segments||[]);if(!seg.length)throw Error('Keine Abschnitte.');if(JSON.stringify(seg).length>38000)throw Error('Einsatz zu groß für eine Tabellenzelle. Bitte GPS-Punkte reduzieren.');const j={id:uid(),title,createdBy:u.id,createdAt:new Date().toISOString(),status:args.large===true?'entwurf':'offen',segmentsJson:JSON.stringify(seg)};append('jobs',j);log(u,'createJob',j.id);return {id:j.id}}
if(op==='updateSegment'){
 const j=rows('jobs').find(x=>x.id===args.jobId);if(!j)throw Error('Einsatz nicht gefunden.');if(String(j.status)==='archiviert')throw Error('Archivierte Einsätze können nicht bearbeitet werden.');
 const assignments=rows('assignments');const authorized=['admin','leader'].includes(u.role)||assignments.some(a=>a.jobId===j.id&&a.segmentId===args.segmentId&&a.driverId===u.id);
 if(!authorized||j.status==='entwurf'&&!['admin','leader'].includes(u.role))throw Error('Keine Berechtigung für diesen Abschnitt.');
 const all=JSON.parse(j.segmentsJson||'[]'),index=all.findIndex(s=>s.id===args.segmentId);if(index<0)throw Error('Abschnitt nicht gefunden.');
 const revision=digest(JSON.stringify(all[index]));if(String(args.revision)!==revision)throw Error('Dieser Abschnitt wurde zwischenzeitlich geändert. Bitte neu laden und Änderungen prüfen.');
 const next=sanitizeSegments([args.segment])[0];if(next.id!==all[index].id)throw Error('Abschnitt-ID darf nicht geändert werden.');
 if(next.width===null&&String(j.status)!=='entwurf'&&['admin','leader'].includes(u.role)===false)throw Error('Bitte Breite eingeben.');
 next.passes=1;all[index]=next;const serialized=JSON.stringify(all);if(serialized.length>38000)throw Error('Einsatz zu groß für die Tabellenzelle.');
 patch('jobs',j.id,{segmentsJson:serialized});log(u,'updateSegment',j.id+':'+next.id);return {saved:true,revision:digest(JSON.stringify(next))};
}
if(op==='assign'){if(!['admin','leader'].includes(u.role))throw Error('Keine Berechtigung.');const j=rows('jobs').find(x=>x.id===args.jobId),driver=rows('users').find(x=>x.id===args.driverId&&x.role==='driver'&&String(x.active).toLowerCase()!=='false');if(!j||!driver)throw Error('Einsatz/Fahrer nicht gefunden.');if(String(j.status)==='archiviert')throw Error('Archivierte Einsätze können nicht zugewiesen werden.');const s=JSON.parse(j.segmentsJson||'[]').find(x=>x.id===args.segmentId);if(!s)throw Error('Abschnitt nicht gefunden.');const existing=rows('assignments').find(x=>x.jobId===j.id&&x.segmentId===s.id);if(existing)patch('assignments',existing.id,{driverId:driver.id,status:'offen',updatedAt:new Date().toISOString()});else append('assignments',{id:uid(),jobId:j.id,segmentId:s.id,driverId:driver.id,status:'offen',updatedAt:new Date().toISOString(),note:''});log(u,'assign',j.id);return true}
if(op==='status'){const a=rows('assignments').find(x=>x.id===args.assignmentId);if(!a||!(['admin','leader'].includes(u.role)||a.driverId===u.id))throw Error('Keine Berechtigung.');const j=rows('jobs').find(x=>x.id===a.jobId);if(!j||String(j.status)==='archiviert'||j.status==='entwurf'&&u.role==='driver')throw Error('Einsatz ist nicht freigegeben oder nicht vorhanden.');const allowed=['offen','in Bearbeitung','abgeschlossen'];if(!allowed.includes(args.status))throw Error('Ungültiger Status.');patch('assignments',a.id,{status:args.status,updatedAt:new Date().toISOString()});log(u,'status',a.id);const all=rows('assignments').filter(x=>x.jobId===a.jobId);const sections=JSON.parse(j.segmentsJson||'[]');if(sections.length&&sections.every(section=>all.some(x=>x.segmentId===section.id&&x.status==='abgeschlossen'))){patch('jobs',j.id,{status:'archiviert'});log(u,'autoArchive',j.id)}return true}
if(op==='archiveJob'){if(!['admin','leader'].includes(u.role))throw Error('Keine Berechtigung.');const j=rows('jobs').find(x=>x.id===args.jobId);if(!j)throw Error('Einsatz nicht gefunden.');if(String(j.status)==='archiviert')return true;patch('jobs',j.id,{status:'archiviert'});log(u,'archiveJob',j.id);return true}
if(op==='reopenJob'){admin(u);const j=rows('jobs').find(x=>x.id===args.jobId);if(!j)throw Error('Einsatz nicht gefunden.');patch('jobs',j.id,{status:'offen'});log(u,'reopenJob',j.id);return true}

if(op==='setRole'){admin(u);const target=rows('users').find(x=>x.id===args.id);if(!target||target.role==='admin')throw Error('Administratoren können hier nicht geändert werden.');if(!['driver','leader'].includes(args.role))throw Error('Ungültige Rolle.');patch('users',target.id,{role:args.role,sessionVersion:Number(target.sessionVersion||1)+1});log(u,'setRole',target.id+':'+args.role);return true}
if(op==='saveDraft'){if(!['admin','leader'].includes(u.role))throw Error('Nur Einsatzleiter.');const j=rows('jobs').find(x=>x.id===args.jobId);if(!j||j.status!=='entwurf')throw Error('Entwurf nicht gefunden.');const seg=sanitizeSegments(args.segments||[]);if(!seg.length)throw Error('Keine Abschnitte.');const serialized=JSON.stringify(seg);if(serialized.length>38000)throw Error('Zu viele GPS-Punkte.');patch('jobs',j.id,{segmentsJson:serialized});log(u,'saveDraft',j.id);return true}
if(op==='releaseJob'){if(!['admin','leader'].includes(u.role))throw Error('Nur Einsatzleiter.');const j=rows('jobs').find(x=>x.id===args.jobId);if(!j||j.status!=='entwurf')throw Error('Entwurf nicht gefunden.');const seg=JSON.parse(j.segmentsJson||'[]');if(!seg.length||seg.some(s=>!s.points||s.points.length<2))throw Error('Alle Abschnitte benötigen mindestens zwei Messpunkte.');if(!rows('assignments').some(a=>a.jobId===j.id))throw Error('Vor der Freigabe mindestens einen Fahrer zuweisen.');patch('jobs',j.id,{status:'offen'});log(u,'releaseJob',j.id);return true}
if(op==='deleteJob'){admin(u);const j=rows('jobs').find(x=>x.id===args.jobId);if(!j)throw Error('Einsatz nicht gefunden.');if(String(j.status)!=='archiviert')throw Error('Nur archivierte Einsätze dürfen gelöscht werden.');if(String(args.confirmTitle)!==String(j.title))throw Error('Einsatzname stimmt nicht überein.');const sh=sheet('assignments');rows('assignments').filter(x=>x.jobId===j.id).sort((a,b)=>b._row-a._row).forEach(x=>sh.deleteRow(x._row));sheet('jobs').deleteRow(j._row);log(u,'deleteJob',j.id);return true}
throw Error('Unbekannte Aktion.');}
function internalApi(op,args){
if(typeof op!=='string'||!['login','me','users','addUser','setUserActive','deleteUser','setRole','saveDraft','releaseJob','resetPassword','changePassword','jobs','createJob','assign','status','updateSegment','archiveJob','reopenJob','deleteJob'].includes(op))return {ok:false,error:'Unbekannte Aktion.'};
if(!args||typeof args!=='object'||Array.isArray(args))return {ok:false,error:'Ungültige Anfrage.'};
const readOnly=['me','users','jobs'].includes(op);
if(readOnly){try{return {ok:true,data:response(op,args)}}catch(e){return {ok:false,error:String(e.message||e)}}}
const lock=LockService.getScriptLock();lock.waitLock(20000);try{return {ok:true,data:response(op,args)}}catch(e){return {ok:false,error:String(e.message||e)}}finally{lock.releaseLock()}}

return {api:internalApi,doGet:internalDoGet};
})();
function api(op,args){return AGB_BACKEND_.api(op,args);}
function doGet(e){return AGB_BACKEND_.doGet(e);}
