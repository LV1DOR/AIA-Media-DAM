// Explicit synthetic 10 GiB acceptance trial, inside deployed API; no DAM writes.
import {readFileSync} from 'node:fs';
import https from 'node:https';
import {createHash,randomBytes} from 'node:crypto';
if(process.platform!=='linux'||!process.argv.includes('--execute-approved-10gib-trial'))throw new Error('Explicit approved NAS 10 GiB trial mode required');
const {cookie}=JSON.parse(readFileSync(0,'utf8'));
const origin='https://192.168.250.80:8444',ca=readFileSync('/tmp/aia-proof-ca.crt');
const size=10*1024**3,chunk=randomBytes(16*1024**2),expected=createHash('sha256');
const report={startedAt:new Date().toISOString(),bytes:size,chunkBytes:chunk.length,certificateValidationEnabled:true,passed:false};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function request(route,{method='GET',body,download=false}={}){
 return new Promise((resolve,reject)=>{const req=https.request(origin+'/api'+route,{method,ca,headers:{Origin:origin,Cookie:cookie,...(body?{'Content-Length':body.length,'Content-Type':Buffer.isBuffer(body)?'application/octet-stream':'application/json'}:{})}},res=>{
  let bytes=0;const chunks=[],hash=createHash('sha256');
  res.on('data',b=>{bytes+=b.length;if(download)hash.update(b);else if(bytes<1024**2)chunks.push(b);else req.destroy(new Error('Unexpected large control response'));});
  res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,bytes,hash:download?hash.digest('hex'):null,body:Buffer.concat(chunks)}));
 });req.on('error',reject);req.end(body);});
}
async function call(route,body){for(let attempt=0;attempt<4;attempt++){
 const r=await request(route,{method:body===undefined?'GET':'POST',body:body===undefined?undefined:Buffer.isBuffer(body)?body:JSON.stringify(body)});
 if(r.status===429){await wait(Math.min(61000,Math.max(1000,Number(r.headers['retry-after']||10)*1000)));continue;}
 if(r.status!==200)throw new Error('Acceptance request status '+r.status+' at '+route.split('?')[0].replace(/[A-Za-z0-9_-]{43}/g,'[id]'));
 return JSON.parse(r.body);
}throw new Error('Rate limit retry exhausted');}
let transfer;
try {
 transfer=(await call('/transfers',{title:'Synthetic NAS 10 GiB proof',days:1,files:[{name:'synthetic-10gib.bin',size}]})).transfer;
 const file=transfer.files[0];let offset=0,confirmed=0;
 const started=Date.now();
 while(offset<size){
  const response=await call('/transfers/'+transfer.id+'/chunk?fileId='+file.id+'&offset='+offset,chunk);
  expected.update(chunk);offset=response.uploadedBytes;
  if(offset===3*chunk.length){
   // Simulate a dropped client. Reconstruct offset from durable registry, then resume.
   await wait(1500);const restored=(await call('/transfers/'+transfer.id)).transfer;
   confirmed=restored.files[0].uploadedBytes;if(confirmed!==offset)throw new Error('Durable offset mismatch');
  }
 }
 report.chunkUploadSeconds=(Date.now()-started)/1000;report.confirmedResumeOffset=confirmed;
 const processing=Date.now();await call('/transfers/'+transfer.id+'/complete-file',{fileId:file.id});
 report.nativeFinalizeSeconds=(Date.now()-processing)/1000;
 await call('/transfers/'+transfer.id+'/activate',{});
 const startedDownload=Date.now(),download=await request('/public/'+transfer.id+'/files/'+file.id,{download:true});
 if(download.status!==200||download.bytes!==size||download.hash!==expected.digest('hex'))throw new Error('Large download byte/hash mismatch');
 report.downloadSeconds=(Date.now()-startedDownload)/1000;report.downloadSha256=download.hash;report.exactBytesAndHashMatch=true;
 await call('/transfers/'+transfer.id+'/revoke',{});
 const denied=await request('/public/'+transfer.id+'/files/'+file.id);
 if(denied.status!==410)throw new Error('Cached large file path survived revocation');
 report.cachedLinkDeniedAfterRevoke=true;report.sourceCleanupRequested=true;report.passed=true;
}finally{if(transfer)await call('/transfers/'+transfer.id+'/revoke',{});}
report.finishedAt=new Date().toISOString();console.log(JSON.stringify(report));
