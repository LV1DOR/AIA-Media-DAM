import { generateKeyPairSync, createHash, randomUUID } from 'node:crypto';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';

export const recoveryOpenSsl = 'C:/Program Files/Git/usr/bin/openssl.exe';
const helper = fileURLToPath(new URL('./protect-recovery-secret.ps1', import.meta.url));
export function runPrivate(executable, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const output = [], errors = [];
    child.stdout.on('data', (data) => output.push(data));
    child.stderr.on('data', (data) => errors.push(data));
    child.stdin.on('error', () => {});
    child.once('error', () => reject(new Error('Private recovery process could not start')));
    child.once('close', (code) => {
      if (code === 0) return resolve({ stdout: Buffer.concat(output), stderr: Buffer.concat(errors) });
      const diagnostic = Buffer.concat(errors).toString();
      const secret = typeof input === 'string' ? input.trim() : '';
      const safe = secret ? diagnostic.replaceAll(secret, '[REDACTED]') : diagnostic;
      reject(new Error(`Private recovery tool ${path.basename(executable)} failed (${code}): ${safe.slice(-1800)}`));
    });
    child.stdin.end(input);
  });
}
const powershell = 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
async function secureDirectory(directory) {
  await runPrivate(powershell, ['-NoProfile', '-NonInteractive', '-File', helper, '-Action', 'SecureDirectory', '-Path', directory]);
}
async function withKeyPipe(key, callback) {
  const pipe = `\\\\.\\pipe\\aia-recovery-key-${randomUUID()}`;
  const server = net.createServer((socket) => { socket.on('error', () => {}); socket.end(key); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(pipe, resolve); });
  try { return await callback(pipe); } finally { server.close(); }
}
export async function createRecoveryKey(directory, recoveryDirectory) {
  await secureDirectory(directory);
  await secureDirectory(recoveryDirectory);
  const passFile = path.join(directory, 'private-key.dpapi');
  const key = generateKeyPairSync('rsa', { modulusLength: 3072, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  await runPrivate(powershell, ['-NoProfile', '-NonInteractive', '-File', helper, '-Action', 'Protect', '-Path', passFile], key.privateKey);
  const publicKeyFile = path.join(directory, 'recipient.pem');
  await withKeyPipe(key.privateKey, (pipe) => runPrivate(recoveryOpenSsl, ['req', '-new', '-x509', '-sha256', '-key', pipe, '-subj', '/CN=AIA Media Recovery', '-days', '365', '-out', publicKeyFile]));
  const certificate = await runPrivate(recoveryOpenSsl, ['x509', '-in', publicKeyFile, '-outform', 'DER']);
  const fingerprint = createHash('sha256').update(certificate.stdout).digest('hex');
  const reference = { fingerprint, passFile, publicKeyFile, recoveryDirectory, format: 'OpenSSL CMS AuthEnvelopedData, AES-256-GCM, RSA-3072 recipient', protection: 'Private key protected with Windows DPAPI CurrentUser; directory ACL restricted to current user, SYSTEM and Administrators' };
  await writeFile(path.join(directory, 'key-reference.json'), JSON.stringify(reference, null, 2) + '\n', { flag: 'wx' });
  const recovered = await runPrivate(powershell, ['-NoProfile', '-NonInteractive', '-File', helper, '-Action', 'Unprotect', '-Path', passFile]);
  if (recovered.stdout.toString() !== key.privateKey) throw new Error('DPAPI recovery check failed');
  recovered.stdout.fill(0);
  return reference;
}
export async function decryptRecovery(reference, encryptedFile, outputFile) {
  const pass = await runPrivate(powershell, ['-NoProfile', '-NonInteractive', '-File', helper, '-Action', 'Unprotect', '-Path', reference.passFile]);
  try {
    await withKeyPipe(pass.stdout, (pipe) => runPrivate(recoveryOpenSsl, ['cms', '-decrypt', '-binary', '-inform', 'DER', '-in', encryptedFile, '-inkey', pipe, '-out', outputFile]));
  } finally { pass.stdout.fill(0); }
}

// Small, bounded recovery bundles can be uploaded without retaining plaintext.
export async function decryptRecoveryToBuffer(reference, encryptedFile) {
  const pass = await runPrivate(powershell, ['-NoProfile', '-NonInteractive', '-File', helper, '-Action', 'Unprotect', '-Path', reference.passFile]);
  try {
    const result = await withKeyPipe(pass.stdout, (pipe) => runPrivate(recoveryOpenSsl, ['cms', '-decrypt', '-binary', '-inform', 'DER', '-in', encryptedFile, '-inkey', pipe]));
    return result.stdout;
  } finally { pass.stdout.fill(0); }
}
