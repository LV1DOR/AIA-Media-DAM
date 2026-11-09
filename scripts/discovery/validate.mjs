import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const checks = [];
function run(executable, args, env = process.env) {
  const result = spawnSync(executable, args, { cwd: root, env, encoding: 'utf8', timeout: 15000, windowsHide: true });
  if (result.error) throw result.error;
  return result;
}
function pass(name) { checks.push(name); console.log(`PASS ${name}`); }
async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.local', '.git', 'node_modules', '.next', '.private', 'dist', 'coverage'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(full));
    else result.push(full);
  }
  return result;
}
async function probe(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/discovery/probe.mjs', '127.0.0.1', String(port)], { cwd: root, windowsHide: true });
    let output = '';
    child.stdout.on('data', (data) => { output += data; });
    child.once('error', reject);
    child.once('exit', (code) => {
      try { resolve({ code, result: JSON.parse(output) }); } catch (error) { reject(error); }
    });
  });
}

try {
  const files = await walk(root);
  for (const file of files.filter((file) => file.endsWith('.mjs'))) {
    assert.equal(run(process.execPath, ['--check', file]).status, 0, `Syntax: ${path.relative(root, file)}`);
  }
  pass('JavaScript syntax');

  for (const file of files.filter((file) => file.endsWith('.md'))) {
    const text = await readFile(file, 'utf8');
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^[a-z]+:/i.test(target)) continue;
      assert.ok(existsSync(path.resolve(path.dirname(file), target)), `Broken link in ${path.relative(root, file)}: ${target}`);
    }
  }
  pass('Local Markdown links');

  const report = JSON.parse(await readFile(path.join(root, 'docs/discovery/evidence/gokapi-v2.2.4.json'), 'utf8'));
  assert.equal(report.release, 'v2.2.4');
  assert.equal(report.commit, '9a4b289c604198c05589e34314e889d2c25386d8');
  assert.match(report.schemaSha256, /^[0-9a-f]{64}$/);
  assert.ok(report.sourceUrl.includes(`/${report.commit}/`));
  assert.equal(report.operations.length, 9);
  assert.ok(Object.values(report.assertions).every((value) => value === true));
  for (const field of ['installedVersionVerified', 'runtimeTestsExecuted', 'f2GatePassed']) assert.equal(report[field], false);
  const rawPath = path.join(root, '.local/discovery/gokapi-v2.2.4/openapi.json');
  if (existsSync(rawPath)) {
    assert.equal(createHash('sha256').update(await readFile(rawPath)).digest('hex'), report.schemaSha256);
    pass('Raw upstream schema checksum matches recorded provenance');
  }
  pass('Recorded upstream provenance preserves unproven runtime gates');

  assert.equal(run(process.execPath, ['scripts/discovery/probe.mjs', 'host', '0']).status, 2);
  assert.equal(run(process.execPath, ['scripts/discovery/inspect-gokapi.mjs', '../invalid']).status, 2);
  pass('Discovery tools reject invalid inputs');

  const resourceSpaceTests = run(process.execPath, ['--test', 'scripts/discovery/inspect-resourcespace.test.mjs']);
  assert.equal(resourceSpaceTests.status, 0, `ResourceSpace discovery security fixtures failed: ${resourceSpaceTests.stdout}`);
  pass('ResourceSpace signed POST, destination restrictions, bounded reads and report minimization');

  const server = net.createServer((socket) => socket.end());
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  try {
    const connected = await probe(port);
    assert.equal(connected.code, 0);
    assert.equal(connected.result.status, 'connected');
  } finally { await new Promise((resolve) => server.close(resolve)); }
  const closed = await probe(port);
  assert.equal(closed.code, 1);
  assert.equal(closed.result.status, 'ECONNREFUSED');
  pass('TCP probe distinguishes live and closed loopback listeners');

  const bash = process.platform === 'win32' && existsSync('C:/Program Files/Git/bin/bash.exe')
    ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
  const collector = 'scripts/discovery/collect-nas.sh';
  assert.equal(run(bash, ['--noprofile', '--norc', '-n', collector]).status, 0);
  assert.equal(run(bash, ['--noprofile', '--norc', collector, '--inventory-only', '--unsafe']).status, 2);
  const collectorText = await readFile(path.join(root, collector), 'utf8');
  assert.ok(!/\.Config\.(Env|Labels|Cmd)|\.State\.Health\.Log|docker\s+(exec|logs|run|stop|restart|rm|system)/.test(collectorText));
  pass('NAS collector shell syntax, identifier guard and sensitive-field exclusions');

  const preflight = 'scripts/discovery/nas-recovery-preflight.sh';
  assert.equal(run(bash, ['--noprofile', '--norc', '-n', preflight]).status, 0);
  assert.equal(run(bash, ['--noprofile', '--norc', preflight, '--invalid']).status, 2);
  const preflightText = await readFile(path.join(root, preflight), 'utf8');
  assert.ok(!/docker\s+(pause|unpause|stop|restart|run|rm|cp|commit|save)|mariadb-dump|chmod|chown|\bmkdir\b/.test(preflightText));
  pass('Recovery preflight syntax, mandatory read-only mode and mutation exclusions');

  for (const script of ['backup-resourcespace.sh', 'restore-nas.sh']) {
    const target = `scripts/discovery/${script}`;
    assert.equal(run(bash, ['--noprofile', '--norc', '-n', target]).status, 0);
    assert.equal(run(bash, ['--noprofile', '--norc', target]).status, 2);
  }
  pass('Recovery runners parse and refuse missing execution mode before mutation');
  assert.equal(run(process.execPath, ['scripts/discovery/gokapi-large-proof.mjs']).status, 2);
  pass('Large transfer trial refuses missing execution mode before credential access/upload');

  const manifest = 'docs/discovery/staging.compose.yaml';
  const noImageEnv = { ...process.env };
  delete noImageEnv.GOKAPI_IMAGE;
  const composeArgs = ['compose', '--profile', 'staging-draft', '-f', manifest, 'config'];
  assert.notEqual(run('docker', [...composeArgs, '--quiet'], noImageEnv).status, 0);
  const parse = run('docker', [...composeArgs, '--format', 'json'], { ...noImageEnv, GOKAPI_IMAGE: `f0rc3/gokapi@sha256:${'0'.repeat(64)}` });
  assert.equal(parse.status, 0, 'Compose draft failed parsing');
  const config = JSON.parse(parse.stdout);
  assert.deepEqual(Object.keys(config.services), ['gokapi']);
  assert.equal(config.services.gokapi.ports[0].host_ip, '127.0.0.1');
  assert.ok(config.services.gokapi.volumes.every((mount) => mount.type === 'volume'));
  assert.ok(!config.services.gokapi.depends_on);
  assert.equal(config.services.gokapi.environment.GOKAPI_GUEST_UPLOAD_BY_DEFAULT, 'false');
  pass('Compose rejects missing image and parses isolated loopback-only draft');

  console.log(`\n${checks.length} local checks passed. No NAS inventory, restore or application acceptance test is implied.`);
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
