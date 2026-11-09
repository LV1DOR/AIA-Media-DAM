import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// P0 discovery only. No upload, share, user-management or configuration mutation.
const permissions = ['a', 's', 'v', 'g', 't', 'u', 'c', 'd', 'e0', 'e-1', 'noex', 'exup'];
const functions = new Set(['get_system_status', 'checkperm', 'get_resource_types', 'get_resource_type_fields', 'do_search', 'get_resource_field_data']);
const privateIPv4 = /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;

function form(values) {
  // PHP http_build_query's default RFC1738 encoding, including literal * and ~.
  const encode = (value) => encodeURIComponent(String(value))
    .replace(/[!'()*~]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
  return Object.entries(values).map(([name, value]) => `${encode(name)}=${encode(value)}`).join('&');
}

export async function inspectResourceSpace({ baseUrl, user, apiKey, allowPrivateHttp = false }) {
  const base = new URL(baseUrl);
  if (base.username || base.password || base.search || base.hash) throw new Error('Base URL must not contain credentials, query or fragment');
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && allowPrivateHttp && privateIPv4.test(base.hostname) && /^\d+\.\d+\.\d+\.\d+$/.test(base.hostname))) {
    throw new Error('Use HTTPS, or explicitly allow HTTP on a private IPv4 address');
  }
  if (!user || !/^[a-fA-F0-9]{64}$/.test(apiKey ?? '')) throw new Error('Supply the approved user and 64-hex native API key securely');
  const endpoint = new URL(`${base.pathname.replace(/\/$/, '')}/api/`, base.origin);
  const calls = [];
  async function read(fn, params = {}) {
    if (!functions.has(fn)) throw new Error('Discovery function is not read-only allowlisted');
    const query = form({ user, function: fn, ...params });
    const sign = createHash('sha256').update(apiKey + query).digest('hex');
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form({ query: `${query}&sign=${sign}`, sign, user }),
      });
    } catch { throw new Error(`Read-only ${fn} request failed; no request/credential details logged`); }
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch { /* Record shape failure without logging body. */ }
    calls.push({ function: fn, httpStatus: response.status, json: data !== undefined, bytes: new TextEncoder().encode(raw).byteLength });
    return { status: response.status, data };
  }
  const status = await read('get_system_status');
  if (status.status !== 200 || !status.data?.results) throw new Error('Signed status request was not authorized or returned an unsupported shape');
  const permissionResults = {};
  for (const perm of permissions) {
    const result = await read('checkperm', { perm });
    permissionResults[perm] = result.status === 200 && typeof result.data === 'boolean' ? result.data : null;
  }
  const types = await read('get_resource_types');
  const fields = await read('get_resource_type_fields');
  const search = await read('do_search', { search: '', restypes: '', order_by: 'relevance', archive: '0', fetchrows: '0,1', sort: 'desc' });
  const rows = Array.isArray(search.data?.data) ? search.data.data : [];
  const sample = rows[0];
  let sampleFields;
  if (sample && /^\d+$/.test(String(sample.ref))) sampleFields = await read('get_resource_field_data', { resource: String(sample.ref) });

  const checks = status.data.results;
  const text = (value) => typeof value === 'string' ? value.slice(0, 400) : null;
  return {
    checkedAt: new Date().toISOString(), endpointPath: endpoint.pathname, transport: base.protocol.slice(0, -1),
    authentication: 'user-specific key signed POST (default userkey authmode); no credentials or signatures in URL',
    systemStatus: text(status.data.status), version: text(checks.version?.info), revision: text(checks.svn?.info),
    enabledPlugins: typeof checks.plugins?.info === 'string' ? checks.plugins.info.split(',').map((plugin) => plugin.trim()) : [],
    permissions: permissionResults,
    resourceTypes: Array.isArray(types.data) ? types.data.map((type) => ({ ref: type.ref, name: text(type.name) })) : [],
    metadataAdministration: { httpStatus: fields.status, allowed: fields.status === 200 },
    boundedSearch: { httpStatus: search.status, structured: Array.isArray(search.data?.data), rowCount: rows.length, totalWasNumeric: typeof search.data?.total === 'number', sampleKeys: sample ? Object.keys(sample) : [] },
    sampleFieldDefinitions: Array.isArray(sampleFields?.data) ? sampleFields.data.map((field) => ({ ref: field.ref, name: text(field.name), title: text(field.title), type: field.type, required: field.required })) : [],
    calls,
    assetValuesSaved: false, passwordUsed: false, mutationsExecuted: false,
    sourceShareLifecycleProven: false, backupRestoreProven: false, p0GatePassed: false,
  };
}

if (typeof process !== 'undefined' && process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [output, flag] = process.argv.slice(2);
    if (!output || (flag && flag !== '--allow-private-http')) throw new Error('Usage: node scripts/discovery/inspect-resourcespace.mjs <new-report.json> [--allow-private-http]');
    const report = await inspectResourceSpace({ baseUrl: process.env.AIA_DISCOVERY_RS_URL, user: process.env.AIA_DISCOVERY_RS_USER, apiKey: process.env.AIA_DISCOVERY_RS_KEY, allowPrivateHttp: flag === '--allow-private-http' });
    await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log('Sanitized discovery report written; P0 gate remains NOT_PROVEN.');
  } catch (error) {
    // Never print fetch responses, request bodies, URLs, stack traces or environment.
    console.error(error instanceof TypeError ? 'Invalid discovery configuration or response' : error.message);
    process.exitCode = 1;
  }
}
