// Run inside the deployed API container. Private staff cookie arrives on stdin.
import {readFileSync} from 'node:fs';
import https from 'node:https';
import {createRequire} from 'node:module';
import {createHash,randomBytes} from 'node:crypto';
if(process.platform!=='linux'||!process.argv.includes('--approved-maintenance'))throw new Error('Approved NAS test mode required');
const input=JSON.parse(readFileSync(0,'utf8'));
const origin='https://192.168.250.80:8443',ca=readFileSync('/tmp/aia-proof-ca.crt');
function request(route,{method='GET',body,cookie=input.cookie,headers={}}={}){
 return new Promise((resolve,reject)=>{const req=https.request(origin+'/api'+route,{method,ca,headers:{Origin:origin,Cookie:cookie,...headers,...(body?{'Content-Length':body.length}:{})}},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',reject);req.end(body);});
}
async function json(route,body,cookie=input.cookie){const result=await request(route,{method:'POST',body:Buffer.from(JSON.stringify(body)),cookie,headers:{'Content-Type':'application/json'}});if(result.status!==200)throw new Error('JSON check failed at '+route.replace(/[A-Za-z0-9_-]{43}/g,'[id]')+' status '+result.status);return JSON.parse(result.body);}
async function loginCreated(created,username,password){
 if(!created.invitationUrl)return request('/auth/login',{method:'POST',body:Buffer.from(JSON.stringify({username,password})),cookie:'',headers:{'Content-Type':'application/json'}});
 const boundary='profile'+randomBytes(10).toString('hex'),photo=readFileSync('/tmp/aia-proof-fixtures/fixture.png');
 const body=Buffer.concat([Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="photo"; filename="profile.png"\r\nContent-Type: image/png\r\n\r\n'),photo,Buffer.from('\r\n--'+boundary+'--\r\n')]);
 const uploaded=await request('/auth/invitation/photo',{method:'POST',body,cookie:'',headers:{'x-aia-invitation':created.invitationUrl.split('#')[1],'Content-Type':'multipart/form-data; boundary='+boundary}});
 if(uploaded.status!==200)throw new Error('Synthetic profile photo setup failed');
 const started=await request('/auth/invitation/start' ,{method:'POST',body:Buffer.from(JSON.stringify({token:created.invitationUrl.split('#')[1],password})),cookie:'',headers:{'Content-Type':'application/json'}});
 if(started.status!==200)throw new Error('Synthetic invitation setup failed');
 const setup=JSON.parse(started.body),OTPAuth=createRequire('/app/services/transfer-api/package.json')('otpauth');
 return request('/auth/invitation/complete',{method:'POST',body:Buffer.from(JSON.stringify({code:new OTPAuth.TOTP({secret:setup.secret}).generate()})),cookie:started.headers['set-cookie'].map(c=>c.split(';')[0]).join('; '),headers:{'Content-Type':'application/json'}});
}
const password=randomBytes(24).toString('base64url')+'Aa1!',username='mediaproof_'+randomBytes(4).toString('hex');
const invited=await json('/admin/users',{username,password,name:'Synthetic media editor',role:'reviewer',libraryAccess:true}),user=invited.user;
const login=await loginCreated(invited,username,password);
if(login.status!==200)throw new Error('Media editor login failed');
const cookie=login.headers['set-cookie'].map(c=>c.split(';')[0]).join('; ');
const created=[];let marketer;const report={capturedAt:new Date().toISOString(),formats:[],nativeOffboarding:false,passed:false};
try{
 for(const extension of ['jpg','png','tif','mp4']){
  const bytes=readFileSync('/tmp/aia-proof-fixtures/fixture.'+extension),boundary='aia'+randomBytes(12).toString('hex');
  const body=Buffer.concat([Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="aia-proof-'+username+'.'+extension+'"\r\nContent-Type: application/octet-stream\r\n\r\n'),bytes,Buffer.from('\r\n--'+boundary+'--\r\n')]);
  const started=Date.now();
  const upload=await request('/library/upload?size='+bytes.length,{method:'POST',body,cookie,headers:{'Content-Type':'multipart/form-data; boundary='+boundary}});
  if(upload.status!==200)throw new Error('Upload '+extension+' failed status '+upload.status+' '+upload.body.toString().slice(0,150));
  const id=JSON.parse(upload.body).id;created.push(id);
  const published=await request('/library/'+id,{cookie});
  if(published.status!==200||JSON.parse(published.body).asset.state!==0)throw new Error('Automatic native publication failed');
  await json('/library/'+id+'/metadata',{fields:[{id:8,value:'AIA synthetic '+extension},{id:90,value:'AIA proof championship'},{id:91,value:'Generated test fixture only'}]},cookie);
  const download=await request('/library/'+id+'/download',{cookie});
  if(download.status!==200||createHash('sha256').update(download.body).digest('hex')!==createHash('sha256').update(bytes).digest('hex'))throw new Error('Original byte fidelity failed '+extension);
  const preview=await request('/library/'+id+(extension==='mp4'?'/video':'/preview'),{cookie,headers:extension==='mp4'?{Range:'bytes=0-1023'}:{}});
  if(![200,206].includes(preview.status))throw new Error('Preview failed '+extension+' status '+preview.status);
  if(extension==='mp4' && (preview.status!==206||!preview.headers['content-range']))throw new Error('Video range playback failed');
  report.formats.push({extension,originalBytes:bytes.length,originalHashMatches:true,automaticPublicationAndMetadata:true,previewStatus:preview.status,elapsedMs:Date.now()-started});
 }
 const search=await request('/library?search='+encodeURIComponent('AIA proof championship'),{cookie});
 if(search.status!==200||JSON.parse(search.body).items.length<4)throw new Error('Indexed metadata search failed');
 report.indexedMetadataSearch=true;
 const first=JSON.parse((await request('/library/'+created[0],{cookie})).body);
 const keywords=first.fields.find(f=>f.name==='keywords'&&f.type===9);
 if(!keywords)throw new Error('Native keyword field absent');
 const bulk=await json('/library/bulk-metadata',{resourceIds:created,fields:[{id:keywords.id,value:'synthetic-aiabulk-proof'}]},cookie);
 if(bulk.updated.length!==4||bulk.failed.length)throw new Error('Native bulk keywords failed');
 for(const id of created){const detail=JSON.parse((await request('/library/'+id,{cookie})).body);if(!detail.fields.find(f=>f.id===keywords.id)?.value.includes('synthetic-aiabulk-proof'))throw new Error('Native keyword round trip failed');}
 report.bulkNativeKeywords=true;
 const marketerPassword=randomBytes(24).toString('base64url')+'Aa1!',marketerName='uploadproof_'+randomBytes(4).toString('hex');
 const marketerInvite=await json('/admin/users',{username:marketerName,password:marketerPassword,name:'Synthetic marketing uploader',role:'marketer',libraryAccess:true});marketer=marketerInvite.user;
 const marketerLogin=await loginCreated(marketerInvite,marketerName,marketerPassword);
 if(marketerLogin.status!==200)throw new Error('Marketing login failed');
 const marketerCookie=marketerLogin.headers['set-cookie'].map(c=>c.split(';')[0]).join('; '),bytes=readFileSync('/tmp/aia-proof-fixtures/fixture.png'),boundary='aia'+randomBytes(12).toString('hex');
 const body=Buffer.concat([Buffer.from('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="marketing-upload-proof.png"\r\nContent-Type: application/octet-stream\r\n\r\n'),bytes,Buffer.from('\r\n--'+boundary+'--\r\n')]);
 const uploaded=await request('/library/upload?size='+bytes.length,{method:'POST',body,cookie:marketerCookie,headers:{'Content-Type':'multipart/form-data; boundary='+boundary}});
 if(uploaded.status!==200)throw new Error('Marketing library upload failed status '+uploaded.status);
 const marketerId=JSON.parse(uploaded.body).id;created.push(marketerId);
 const visible=await request('/library/'+marketerId,{cookie:marketerCookie});
 const denied=await request('/library/'+marketerId+'/state',{method:'POST',body:Buffer.from(JSON.stringify({state:2})),cookie:marketerCookie,headers:{'Content-Type':'application/json'}});
 if(visible.status!==200||denied.status!==403)throw new Error('Marketing library visibility or lifecycle denial failed');
 const checked=JSON.parse((await request('/library/'+marketerId,{cookie})).body);
 if(checked.asset.state!==0)throw new Error('Marketing upload did not enter the native library');
 report.marketingUploadPublishedAndLifecycleDenied=true;
}finally{
 for(const id of created)await json('/library/'+id+'/state',{state:2},cookie);
 await json('/admin/users/'+user.id,{disabled:true});
 if(marketer)await json('/admin/users/'+marketer.id,{disabled:true});
 report.fixtureAssetsArchived=created.length;
 const denied=await request('/auth/me',{cookie});
 if(denied.status!==401)throw new Error('Disabled staff session survived');
}
// Lifecycle worker reconciles source identities every 30s.
await new Promise(r=>setTimeout(r,32000));
const {DatabaseSync}=await import('node:sqlite');
const db=new DatabaseSync('/data/registry.sqlite',{readOnly:true});
report.nativeOffboarding=db.prepare('SELECT source_disabled FROM users WHERE id=?').get(user.id).source_disabled===1;db.close();
if(!report.nativeOffboarding)throw new Error('Native offboarding did not complete');
const {ResourceSpace}=await import('/app/services/transfer-api/src/adapters.ts');
const {SecretBox}=await import('/app/services/transfer-api/src/security.ts');
const registry=new DatabaseSync('/data/registry.sqlite',{readOnly:true});
try {
 const sourceUser=registry.prepare('SELECT rs_credentials FROM users WHERE id=?').get(user.id);
 const identity=new SecretBox(process.env.AIA_MASTER_KEY).open(sourceUser.rs_credentials);
 let denied=false;
 try{await new ResourceSpace(process.env.AIA_RS_URL).call(identity,'get_system_status');}catch(error){denied=[401,403].includes(error.status);}
 if(!denied)throw new Error('Disabled native API identity remained usable');
 report.disabledNativeApiIdentityDenied=true;
}finally{registry.close();}
report.passed=true;console.log(JSON.stringify(report));
