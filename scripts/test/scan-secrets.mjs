import { readdir,readFile } from 'node:fs/promises';
import path from 'node:path';
import {homedir} from 'node:os';
import { runPrivate } from '../discovery/recovery-key.mjs';
const skip=new Set(['node_modules','.local','.private','.git','.next','.next-review','coverage','vendor-private','dist']);
const known=Object.entries(process.env).filter(([key,value])=>/^AIA_.*(KEY|PASSWORD|SECRET)$/.test(key)&&value?.length>=14).map(([,value])=>value);
if(process.platform==='win32'){
 const collect=(config)=>{for(const [key,value]of Object.entries(config)){if(value&&typeof value==='object')collect(value);else if(/KEY|PASSWORD|SECRET/i.test(key)&&typeof value==='string'&&value.length>=14)known.push(value)}};
 for(const reference of ['.local/development/config-nas.dpapi','.local/deployment/runtime-config-final.dpapi']){
  try{const protectedConfig=await runPrivate('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-File',path.resolve('scripts/discovery/protect-recovery-secret.ps1'),'-Action','Unprotect','-Path',path.resolve(reference)]);const config=JSON.parse(protectedConfig.stdout.toString());protectedConfig.stdout.fill(0);collect(config)}catch{}
 }
}
// Include the durable local review key in leak detection without printing it.
try {
 const base=process.platform==='win32'?(process.env.LOCALAPPDATA||path.join(homedir(),'AppData','Local')):(process.env.XDG_DATA_HOME||path.join(homedir(),'.local','share'));
 const directory=process.env.AIA_REVIEW_IDENTITY_DIR||path.join(base,'AIA-Media','review-identity');
 const key=(await readFile(path.join(directory,'master-key'),'utf8')).trim();
 if(Buffer.from(key,'base64').length===32)known.push(key);
}catch(error){if(error.code!=='ENOENT')throw error;}
const violations=[];let scanned=0;
async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true})){if(skip.has(entry.name)||entry.isSymbolicLink())continue;const file=path.join(directory,entry.name);if(entry.isDirectory()){await walk(file);continue}if(/\.(png|jpg|jpeg|gif|webp|ico|woff2?|gz|zip|cms|dpapi|bin|pdf|sqlite.*|tsbuildinfo|log)$/i.test(file))continue;const content=await readFile(file,'utf8');scanned++;if(known.some(secret=>content.includes(secret))||/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)||/\bgh[pousr]_[A-Za-z0-9]{30,}\b/.test(content))violations.push(file)}}
await walk('.');
if(violations.length){console.error(JSON.stringify({secretScanPassed:false,files:violations}));process.exitCode=1}else console.log(JSON.stringify({secretScanPassed:true,filesScanned:scanned,knownPrivateValuesChecked:known.length}));
