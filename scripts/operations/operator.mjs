// Run only inside the NAS API container over an authenticated operator channel.
import { readFileSync } from 'node:fs';
if(process.platform!=='linux'||!process.argv.includes('--approved-maintenance'))throw new Error('Approved NAS container maintenance mode required');
const input=JSON.parse(readFileSync(0,'utf8'));
if(!/^[a-zA-Z0-9._-]{3,60}$/.test(input.username||''))throw new Error('Invalid staff reference');
const { Store }=await import('/app/services/transfer-api/src/store.ts');
const { SecretBox,token,hashPassword }=await import('/app/services/transfer-api/src/security.ts');
const store=new Store(process.env.AIA_DATA_DIR||'/data');
try{
 const existing=store.get('SELECT * FROM users WHERE username=?',input.username);
 if(input.action==='create-qa'){
  if(!input.username.startsWith('qa_install_')||existing||!store.get("SELECT id FROM users WHERE username='admin'")||typeof input.password!=='string'||input.password.length<20)throw new Error('QA account preconditions differ');
  const box=new SecretBox(process.env.AIA_MASTER_KEY);
  store.run('INSERT INTO users(id,username,name,role,password_hash,rs_credentials) VALUES(?,?,?,?,?,?)',token(),input.username,'Synthetic installation QA','admin',await hashPassword(input.password),box.seal({user:process.env.AIA_RS_USER,key:process.env.AIA_RS_KEY}));
 }else if(input.action==='reset-mfa'){
  if(!existing)throw new Error('Staff account not found');
  store.run('UPDATE users SET totp_secret=NULL,session_version=session_version+1 WHERE id=?',existing.id);store.run('DELETE FROM sessions WHERE user_id=?',existing.id);
 }else if(input.action==='reset-password'){
  if(!existing||typeof input.password!=='string'||input.password.length<14||input.password.length>128)throw new Error('Password reset preconditions differ');
  store.run('UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?',await hashPassword(input.password),existing.id);store.run('DELETE FROM sessions WHERE user_id=?',existing.id);
 }else if(input.action==='disable-qa'){
  if(!input.username.startsWith('qa_install_')||!existing)throw new Error('QA cleanup preconditions differ');
  store.run('UPDATE users SET disabled=1,session_version=session_version+1 WHERE id=?',existing.id);store.run('DELETE FROM sessions WHERE user_id=?',existing.id);store.run("UPDATE transfers SET state='revoking' WHERE owner=? AND state IN ('active','draft')",existing.id);
 }else throw new Error('Unknown maintenance action');
 store.audit('operator',input.action,existing?.id||input.username);
 console.log(JSON.stringify({completed:true,action:input.action}));
}finally{store.close()}
