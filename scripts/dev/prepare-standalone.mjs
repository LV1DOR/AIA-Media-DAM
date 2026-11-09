import { cp,mkdir } from 'node:fs/promises';
import path from 'node:path';
for(const name of ['media-web','transfer-web']){const root=path.resolve('apps',name,'.next');const destination=path.resolve(root,'standalone/apps',name,'.next/static');if(!destination.startsWith(root+path.sep))throw new Error('Unexpected standalone output');await mkdir(path.dirname(destination),{recursive:true});await cp(path.join(root,'static'),destination,{recursive:true});}
console.log('Prepared standalone static assets for both interfaces');
for(const name of ['media-web','transfer-web']){const source=path.resolve('apps',name,'public');await cp(source,path.resolve('apps',name,'.next/standalone/apps',name,'public'),{recursive:true});}
