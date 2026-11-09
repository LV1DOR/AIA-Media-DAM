import net from 'node:net';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
export async function startNasTunnel({password,hostKey,targetIp,localPort=18088}){
 if(!/^\d+\.\d+\.\d+\.\d+$/.test(targetIp)||!Number.isInteger(localPort)||localPort<1024||localPort>65535)throw new Error('Invalid tunnel endpoint');
 const pipe='\\\\.\\pipe\\aia-tunnel-'+randomUUID();const server=net.createServer(socket=>{socket.on('error',()=>{});socket.end(password+'\n')});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(pipe,resolve)});
 const child=spawn('C:/Program Files/PuTTY/plink.exe',['-batch','-ssh','-N','-noagent','-hostkey',hostKey,'-pwfile',pipe,'-L',`127.0.0.1:${localPort}:${targetIp}:80`,'IT@192.168.250.80'],{windowsHide:true,stdio:['ignore','ignore','pipe']});let diagnostic='';child.stderr.on('data',chunk=>{diagnostic+=chunk.toString().replaceAll(password,'[REDACTED]')});child.once('exit',()=>server.close());
 await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,1500);child.once('error',error=>{clearTimeout(timer);reject(error)});child.once('exit',code=>{clearTimeout(timer);reject(new Error('Private tunnel exited '+code+': '+diagnostic.slice(-200)))})});return {pid:child.pid,close(){child.kill();server.close()}};
}
