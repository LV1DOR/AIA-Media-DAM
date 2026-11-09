import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const tag = process.argv[2];
if (!/^v\d+\.\d+\.\d+$/.test(tag ?? '')) {
  console.error('Usage: node scripts/discovery/inspect-gokapi.mjs v2.2.4');
  process.exit(2);
}
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, '.local', 'discovery', `gokapi-${tag}`);
const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'aia-media-discovery' };
async function get(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!response.ok) throw new Error(`Public upstream request failed: HTTP ${response.status}`);
  return response.text();
}

try {
  const [releaseText, commitText] = await Promise.all([
    get(`https://api.github.com/repos/Forceu/Gokapi/releases/tags/${tag}`),
    get(`https://api.github.com/repos/Forceu/Gokapi/commits/${tag}`),
  ]);
  const release = JSON.parse(releaseText);
  const commit = JSON.parse(commitText).sha;
  assert.equal(release.tag_name, tag);
  assert.equal(release.draft, false);
  assert.equal(release.prerelease, false);
  assert.match(commit, /^[0-9a-f]{40}$/);
  const sourceUrl = `https://raw.githubusercontent.com/Forceu/Gokapi/${commit}/openapi.json`;
  const raw = await get(sourceUrl);
  const schema = JSON.parse(raw);
  assert.equal(schema.openapi, '3.0.0');
  assert.ok(schema.servers.some((server) => server.url === '/api/'));
  const required = [
    ['/info/version', 'get'], ['/files/add', 'post'], ['/chunk/add', 'post'],
    ['/chunk/complete', 'post'], ['/files/list', 'get'], ['/files/list/{id}', 'get'],
    ['/files/modify', 'put'], ['/files/delete', 'delete'], ['/files/downloadzip', 'get'],
  ];
  const operations = required.map(([endpoint, method]) => {
    const operation = schema.paths[endpoint]?.[method];
    assert.ok(operation, `Missing ${method.toUpperCase()} ${endpoint}`);
    return {
      path: `/api${endpoint}`, method: method.toUpperCase(),
      operationId: operation.operationId,
      security: operation.security ?? schema.security,
      parameters: (operation.parameters ?? []).map(({ name, in: location, required }) => ({ name, in: location, required: Boolean(required) })),
    };
  });
  assert.match(schema.paths['/files/add'].post.description, /does not use chunking/i);
  assert.match(schema.paths['/files/add'].post.description, /does not support end-to-end encryption/i);
  assert.match(schema.paths['/chunk/add'].post.description, /does not support end-to-end encryption/i);
  const presign = schema.paths['/files/downloadzip'].get.parameters.find((parameter) => parameter.name === 'presignUrl');
  assert.match(presign?.description ?? '', /logged in users/i);
  const excludedPaths = Object.keys(schema.paths).filter((endpoint) => endpoint.startsWith('/uploadrequest/'));
  const report = {
    checkedAt: new Date().toISOString(), release: tag, releasePublishedAt: release.published_at,
    releaseUrl: release.html_url, commit, sourceUrl,
    schemaSha256: createHash('sha256').update(raw).digest('hex'), schemaInfoVersion: schema.info.version,
    schemaPathCount: Object.keys(schema.paths).length,
    operations, excludedV1Paths: excludedPaths,
    assertions: { requiredOperationsPresent: true, basicUploadNotChunked: true, basicAndChunkApiNotE2E: true, presignedZipRequiresStaffLogin: true },
    installedVersionVerified: false, runtimeTestsExecuted: false, f2GatePassed: false,
  };
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'openapi.json'), raw, { encoding: 'utf8', flag: 'wx' });
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  console.log(JSON.stringify({ report: path.relative(root, path.join(output, 'report.json')), commit, schemaSha256: report.schemaSha256, gate: 'NOT_PROVEN' }, null, 2));
} catch (error) {
  // No environment, credentials, response body or native share handles in errors.
  console.error(`Upstream inspection failed: ${error.message}`);
  process.exitCode = 1;
}
