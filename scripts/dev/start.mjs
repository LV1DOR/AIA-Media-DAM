import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPrivate } from '../discovery/recovery-key.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const configIndex=process.argv.indexOf('--config');
const privateConfig=path.resolve(root,configIndex>=0?process.argv[configIndex+1]:'.local/development/config-nas.dpapi');
const result=await runPrivate('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(root,'scripts/discovery/protect-recovery-secret.ps1'),'-Action','Unprotect','-Path',privateConfig]);
const settings=JSON.parse(result.stdout.toString());result.stdout.fill(0);
const children=[];const mode=process.argv.includes('--production-preview')?'start':'dev';
for(const [name,script,port]of [['@aia/api','start',4100],['@aia/media-web',mode,3100],['@aia/transfer-web',mode,3101]]){
 const standalone=script==='start'&&name!=='@aia/api';
 const command=standalone?process.execPath:'corepack';
 const args=standalone?[path.join(root,'apps',name.split('/')[1],'.next/standalone/apps',name.split('/')[1],'server.js')]:['pnpm','--filter',name,script,...(script==='dev'?['--hostname','127.0.0.1']:[])];
 const child=spawn(command,args,{cwd:root,env:{...process.env,...settings,HOSTNAME:'127.0.0.1',PORT:String(port)},shell:!standalone&&process.platform==='win32',windowsHide:true,stdio:'inherit'});children.push(child);child.on('exit',code=>{if(code&&code!==0)console.error(name+' exited with '+code)});
}
let stopping=false;function stop(){if(stopping)return;stopping=true;for(const child of children)if(child.pid){if(process.platform==='win32')spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else child.kill('SIGTERM')}}
process.on('SIGINT',stop);process.on('SIGTERM',stop);process.on('exit',stop);
