import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createNasSession } from './nas-session.mjs';
import { decryptRecoveryToBuffer } from './recovery-key.mjs';

const reference = JSON.parse(await readFile(process.argv[2], 'utf8'));
const directory = reference.recoveryDirectory;
const manifest = JSON.parse(await readFile(path.join(directory, 'capture-manifest.json'), 'utf8'));
if (!/^p0-[0-9TZ]+$/.test(manifest.backupId) || !process.env.AIA_NAS_PASSWORD) throw new Error('Recovery identity/credential missing');
const ciphertext = await readFile(path.join(directory, 'recovery.tar.cms'));
if (ciphertext.length > 64 * 1024 * 1024) throw new Error('This rehearsal runner accepts only bounded small recovery bundles');
const expectedLine = (await readFile(path.join(directory, 'encrypted.sha256'), 'utf8')).split(/\r?\n/).find((line) => line.endsWith('  recovery.tar.cms'));
const encryptedHash = createHash('sha256').update(ciphertext).digest('hex');
if (encryptedHash !== expectedLine?.split(' ')[0]) throw new Error('Independent archive checksum mismatch');
const clearTar = await decryptRecoveryToBuffer(reference, path.join(directory, 'recovery.tar.cms'));
const clearHash = createHash('sha256').update(clearTar).digest('hex');
const nas = createNasSession({ host: '192.168.250.80', user: 'IT', password: process.env.AIA_NAS_PASSWORD, hostKey: 'SHA256:1wIKP91n+Ri4XXzKQc//pfVzafacAkk9wgajlrgjJJk' });
const target = `/volume1/docker/aia-media-backups/${manifest.backupId}/independent-recovery.tar`;
const upload = `python3 -c 'import sys,os,hashlib
stream=sys.stdin.buffer
magic=b"AIA_PRIVATE_INPUT_V1\\n"
line=stream.readline()
if line != magic: line=stream.readline()
if line != magic: raise SystemExit("Private input framing failed")
data=stream.read(67108865)
if len(data)>67108864: raise SystemExit("Recovery upload bound exceeded")
if hashlib.sha256(data).hexdigest()!="${clearHash}": raise SystemExit("Independent recovery data hash differs")
with os.fdopen(os.open("${target}",os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600),"wb") as f: f.write(data)
print("Independent recovery archive received and verified")'
`;
const emit = (event, data = {}) => console.log(JSON.stringify({ at: new Date().toISOString(), event, ...data }));
try {
  emit('independent-data-checksum-and-decryption-verified');
  await nas.execute(upload, { inputBuffer: clearTar, timeoutMs: 120000 });
  clearTar.fill(0);
  emit('isolated-restore-starting');
  const script = await readFile(new URL('./restore-nas.sh', import.meta.url), 'utf8');
  const result = await nas.execute(`export AIA_BACKUP_ID=${manifest.backupId}\nset -- --approved-isolated-restore\n` + script, { timeoutMs: 180000 });
  const report = JSON.parse(result.stdout.trim().split('\n').at(-1));
  await writeFile(path.join(directory, 'nas-restore-report.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
  await writeFile(path.join(directory, 'independent-verification.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), encryptedDataHash: encryptedHash, decryptedTarHash: clearHash, encryptedCopyOnSeparateMachine: true, authenticatedDecryptionPassed: true, immutableImagesIndependentCopyComplete: false }, null, 2), { flag: 'wx' });
  emit('isolated-restore-complete', report);
} catch (error) { emit('isolated-restore-failed', { message: error.message }); process.exitCode = 1; }
finally { clearTar.fill(0); delete process.env.AIA_NAS_PASSWORD; }
