import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createWriteStream, createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Buffer } from 'node:buffer';

const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;

// Password delivery uses a one-use Windows named pipe, never a disk file or argv.
export function createNasSession({ host, user, password, hostKey, plink = 'C:/Program Files/PuTTY/plink.exe' }) {
  if (!/^[\d.]+$/.test(host) || !/^[A-Za-z0-9_-]+$/.test(user) || !hostKey.startsWith('SHA256:')) throw new Error('Invalid explicit NAS identity');
  return {
    async execute(script, { outputFile, inputFile, inputBuffer, timeoutMs = 30000, progress } = {}) {
      const pipe = `\\\\.\\pipe\\aia-media-${randomUUID()}`;
      const server = net.createServer((socket) => { socket.on('error', () => {}); socket.end(password + '\n'); });
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(pipe, resolve); });
      const command = `sudo -S -p '' bash -c ${quote(script)}`;
      const child = spawn(plink, ['-batch', '-ssh', '-T', '-noagent', '-no-antispoof', '-hostkey', hostKey, '-pwfile', pipe, `${user}@${host}`, command], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      if (progress) { progress.pid = child.pid; progress.startedAt = new Date().toISOString(); progress.bytes = 0; child.stdout.on('data', (data) => { progress.bytes += data.length; }); child.once('close', (code) => { progress.childClosed = true; progress.exitCode = code; }); }
      let stdout = '', stderr = '';
      child.stderr.on('data', (data) => { if (stderr.length < 20000) stderr += data.toString(); });
      child.stdin.on('error', () => {});
      let inputTransfer;
      if (inputFile) {
        child.stdin.write(password + '\nAIA_PRIVATE_INPUT_V1\n');
        inputTransfer = pipeline(createReadStream(inputFile), child.stdin);
        inputTransfer.catch(() => {});
      } else if (inputBuffer) child.stdin.end(Buffer.concat([Buffer.from(password + '\nAIA_PRIVATE_INPUT_V1\n'), Buffer.from(inputBuffer)]));
      else child.stdin.end(password + '\n');
      let transfer;
      if (outputFile) transfer = pipeline(child.stdout, createWriteStream(outputFile, { flags: 'wx' }));
      else child.stdout.on('data', (data) => { if (stdout.length < 4000000) stdout += data.toString(); });
      const timer = setTimeout(() => child.kill(), timeoutMs);
      try {
        const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
        if (transfer) await transfer;
        if (inputTransfer) await inputTransfer;
        const safe = (value) => value.replaceAll(password, '[REDACTED]');
        if (code !== 0) throw new Error(`NAS command failed (${code}): ${safe(stderr).slice(-2000)}`);
        return { code, stdout: safe(stdout), stderr: safe(stderr) };
      } finally { clearTimeout(timer); server.close(); }
    },
  };
}
