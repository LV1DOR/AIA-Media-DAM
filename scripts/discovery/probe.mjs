import net from 'node:net';

const [host, portText] = process.argv.slice(2);
const port = Number(portText);
if (!host || !/^[a-zA-Z0-9.:-]+$/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Usage: node scripts/discovery/probe.mjs <host> <port>');
  process.exit(2);
}

const started = Date.now();
const result = await new Promise((resolve) => {
  const socket = new net.Socket();
  let done = false;
  const finish = (status) => {
    if (done) return;
    done = true;
    socket.destroy();
    resolve({ checkedAt: new Date().toISOString(), host, port, status, elapsedMs: Date.now() - started });
  };
  socket.setTimeout(4000);
  socket.once('connect', () => finish('connected'));
  socket.once('timeout', () => finish('timeout'));
  socket.once('error', (error) => finish(error.code ?? 'connection_error'));
  socket.connect(port, host);
});
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.status === 'connected' ? 0 : 1;
