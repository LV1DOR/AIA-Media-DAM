import { readFile, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createNasSession } from './nas-session.mjs';
import { decryptRecovery } from './recovery-key.mjs';
const reference=JSON.parse(await readFile(process.argv[2],'utf8'));
const directory=reference.recoveryDirectory;
const manifest=JSON.parse(await readFile(path.join(directory,'capture-manifest.json'),'utf8'));
if (!/^p0-[0-9TZ]+$/.test(manifest.backupId) || !process.env.AIA_NAS_PASSWORD) throw new Error('Recovery identity/credential missing');
const nas=createNasSession({host:'192.168.250.80',user:'IT',password:process.env.AIA_NAS_PASSWORD,hostKey:'SHA256:1wIKP91n+Ri4XXzKQc//pfVzafacAkk9wgajlrgjJJk'});
const progress={};
const ticker=setInterval(()=>console.log(JSON.stringify({event:'portable-source-copy',bytes:progress.bytes??0})),15000);
try {
 const encrypted=path.join(directory,'source.tar.gz.cms');
 await nas.execute(`cat /volume1/docker/aia-media-backups/${manifest.backupId}/source.tar.gz.cms`,{outputFile:encrypted,timeoutMs:900000,progress});
 const hash=createHash('sha256');
 for await(const chunk of createReadStream(encrypted)) hash.update(chunk);
 const digest=hash.digest('hex');
 if(digest!=='ea4f148368e8229119d4d7f1dbb53137d8b68b5a83cc805833d904c7726d566c') throw new Error('Portable source checksum mismatch');
 await decryptRecovery(reference,encrypted,path.join(directory,'source.tar.gz'));
 const report={verifiedAt:new Date().toISOString(),sha256:digest,sourceRevision:29907,encryptedPortableSourceOnIndependentMachine:true,authenticatedDecryptionPassed:true,completeImmutableImageCopyOffNas:false};
 await writeFile(path.join(directory,'source-verification.json'),JSON.stringify(report,null,2),{flag:'wx'});
 console.log(JSON.stringify(report));
} finally {clearInterval(ticker);delete process.env.AIA_NAS_PASSWORD;}
