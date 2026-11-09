// F2 native-API contract probe using synthetic data; not an upload engine.
import { readFile, writeFile, rename, stat } from 'node:fs/promises';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { runPrivate } from './recovery-key.mjs';

if (!process.argv.includes('--execute-approved-10gib-trial')) {
 console.error('Explicit approved 10 GiB trial mode required');
 process.exit(2);
}

const directory=path.resolve('.local/gokapi-poc');
const stateFile=path.join(directory,'large-upload-state.json');
const blockFile=path.join(directory,'large-fixture-block.bin');
const reportFile=path.join(directory,'large-file-proof.json');
const base='http://127.0.0.1:53842';
const pauseAfter=process.argv.includes('--pause-after-three') ? 3 : null;
const ps='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const helper=path.resolve('scripts/discovery/protect-recovery-secret.ps1');
const protectedKey=await runPrivate(ps,['-NoProfile','-NonInteractive','-File',helper,'-Action','Unprotect','-Path',path.join(directory,'api-key.dpapi')]);
const apiKey=protectedKey.stdout.toString();
protectedKey.stdout.fill(0);
const emit=(event,data={})=>console.log(JSON.stringify({at:new Date().toISOString(),event,...data}));
let state;
try { state=JSON.parse(await readFile(stateFile,'utf8')); }
catch(error) {
 if(error.code!=='ENOENT') throw error;
 const chunkBytes=32*1024*1024;
 await writeFile(blockFile,randomBytes(chunkBytes),{flag:'wx'});
 state={uuid:randomUUID(),totalBytes:10*1024*1024*1024,chunkBytes,nextOffset:0,startedAt:new Date().toISOString(),runs:0};
}
state.runs++;
const block=await readFile(blockFile);
if(block.length!==state.chunkBytes) throw new Error('Synthetic fixture block changed');
const expectedHash=createHash('sha256');
const started=Date.now();
const startingOffset=state.nextOffset;
async function save() {
 await writeFile(stateFile+'.tmp',JSON.stringify(state,null,2));
 await rename(stateFile+'.tmp',stateFile);
}
await save();
try {
 let sentThisRun=0;
 for(let offset=0;offset<state.totalBytes;offset+=state.chunkBytes) {
  expectedHash.update(block);
  if(offset<state.nextOffset) continue;
  const form=new FormData();
  form.set('file',new Blob([block]),'chunk.bin');
  form.set('uuid',state.uuid); form.set('filesize',String(state.totalBytes)); form.set('offset',String(offset));
  const response=await fetch(base+'/api/chunk/add',{method:'POST',headers:{apikey:apiKey},body:form,signal:AbortSignal.timeout(120000)});
  if(response.status!==200) throw new Error(`Native chunk API failed with HTTP ${response.status}`);
  await response.arrayBuffer();
  state.nextOffset=offset+state.chunkBytes;
  await save();
  sentThisRun++;
  if(sentThisRun%16===0) emit('native-chunks-confirmed',{bytes:state.nextOffset,totalBytes:state.totalBytes});
  if(pauseAfter&&sentThisRun===pauseAfter) {
   emit('client-stopped-between-confirmed-chunks',{bytes:state.nextOffset});
   process.exit(0);
  }
 }
 emit('finalizing-native-upload',{bytes:state.totalBytes});
 const response=await fetch(base+'/api/chunk/complete',{method:'POST',headers:{apikey:apiKey,uuid:state.uuid,filename:'AIA-P1-10GiB-synthetic.bin',filesize:String(state.totalBytes),contenttype:'application/octet-stream',allowedDownloads:'3',expiryDays:'1',password:'',nonblocking:'false'},signal:AbortSignal.timeout(300000)});
 if(response.status!==200) throw new Error(`Native completion failed with HTTP ${response.status}`);
 const result=await response.json();
 if(result.Result!=='OK'||result.FileInfo?.SizeBytes!==state.totalBytes) throw new Error('Source completion metadata mismatch');
 const uploadedAt=Date.now();
 const download=await fetch(result.FileInfo.UrlHotlink,{signal:AbortSignal.timeout(300000)});
 if(download.status!==200) throw new Error('Native large download failed');
 const actualHash=createHash('sha256'); let downloaded=0;
 for await(const chunk of download.body) {actualHash.update(chunk);downloaded+=chunk.byteLength;}
 const matches=actualHash.digest('hex')===expectedHash.digest('hex');
 const deletion=await fetch(base+'/api/files/delete',{method:'DELETE',headers:{apikey:apiKey,id:result.FileInfo.Id}});
 const lookup=await fetch(base+'/api/files/list/'+result.FileInfo.Id,{headers:{apikey:apiKey}});
 const report={checkedAt:new Date().toISOString(),version:'2.2.4',environment:'Windows Docker Desktop, loopback; not NAS/WAN benchmark',fileBytes:state.totalBytes,chunkBytes:state.chunkBytes,confirmedChunks:state.totalBytes/state.chunkBytes,clientRestartResumeVerified:startingOffset>0&&state.runs>1,downloadedBytes:downloaded,downloadSha256Matches:matches,uploadSecondsThisRun:(uploadedAt-started)/1000,downloadSeconds:(Date.now()-uploadedAt)/1000,sourceDeleteStatus:deletion.status,sourceMetadataAbsentAfterDelete:lookup.status===404,syntheticRepeatedRandomBlock:true,e2eEncryptionTested:false,passed:downloaded===state.totalBytes&&matches&&deletion.status===200&&lookup.status===404};
 await writeFile(reportFile,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 emit('large-file-proof-complete',report);
} catch(error) {emit('large-file-proof-failed',{message:error.message});process.exitCode=1;}
