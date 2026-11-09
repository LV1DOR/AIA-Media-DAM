import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { inspectResourceSpace } from './inspect-resourcespace.mjs';

const fixtureKey = '0'.repeat(64);

test('refuses insecure destinations and credential-bearing URLs before sending', async () => {
  const config = { user: 'fixture', apiKey: fixtureKey };
  await assert.rejects(inspectResourceSpace({ ...config, baseUrl: 'http://127.0.0.1:1' }), /HTTPS/);
  await assert.rejects(inspectResourceSpace({ ...config, baseUrl: 'http://example.com', allowPrivateHttp: true }), /HTTPS/);
  await assert.rejects(inspectResourceSpace({ ...config, baseUrl: 'https://user:password@example.com' }), /credentials/);
  await assert.rejects(inspectResourceSpace({ ...config, baseUrl: 'https://example.com?key=fixture' }), /query/);
});

test('uses signed POST, bounds search and omits asset values/credentials from reports', async () => {
  const seen = [];
  const fixtureValue = 'DO_NOT_SAVE_ASSET_CONTENT';
  const server = http.createServer(async (request, response) => {
    try {
      assert.equal(request.url, '/api/');
      assert.equal(request.method, 'POST');
      let body = '';
      for await (const chunk of request) body += chunk;
      const post = new URLSearchParams(body);
      const signed = post.get('query');
      const query = signed.slice(0, signed.lastIndexOf('&sign='));
      assert.equal(post.get('sign'), createHash('sha256').update(fixtureKey + query).digest('hex'));
      assert.equal(new URLSearchParams(signed).get('user'), 'DEV +ç*~');
      assert.ok(query.includes('DEV+%2B%C3%A7%2A%7E'));
      assert.ok(!body.includes(fixtureKey));
      const params = new URLSearchParams(query);
      const fn = params.get('function');
      seen.push(fn);
      let result;
      if (fn === 'get_system_status') result = { status: 'OK', results: { version: { info: 'FIXTURE 11.0' }, svn: { info: 'r-fixture' }, plugins: { info: 'fixture_plugin' } } };
      else if (fn === 'checkperm') result = params.get('perm') === 's';
      else if (fn === 'get_resource_types') result = [{ ref: 1, name: 'Photo' }];
      else if (fn === 'get_resource_type_fields') { response.statusCode = 403; result = null; }
      else if (fn === 'do_search') {
        assert.equal(params.get('fetchrows'), '0,1');
        assert.equal(params.get('archive'), '0');
        result = { total: 42, data: [{ ref: 123, field8: fixtureValue, file_path: fixtureValue }] };
      } else if (fn === 'get_resource_field_data') {
        assert.equal(params.get('resource'), '123');
        result = [{ ref: 8, name: 'title', title: 'Title', type: 0, required: 1, value: fixtureValue }];
      } else throw new Error('Unapproved discovery function');
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(result));
    } catch {
      response.statusCode = 500;
      response.end('fixture validation failed');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const report = await inspectResourceSpace({ baseUrl: `http://127.0.0.1:${server.address().port}`, user: 'DEV +ç*~', apiKey: fixtureKey, allowPrivateHttp: true });
    assert.equal(report.calls.length, 17);
    assert.equal(report.metadataAdministration.httpStatus, 403);
    assert.equal(report.boundedSearch.rowCount, 1);
    assert.equal(report.sampleFieldDefinitions[0].name, 'title');
    assert.equal(report.p0GatePassed, false);
    assert.equal(report.mutationsExecuted, false);
    assert.ok(seen.every((fn) => /^(get_|checkperm$|do_search$)/.test(fn)));
    for (const forbidden of [fixtureKey, fixtureValue, 'DEV +ç*~', '"value":', '"sign":']) {
      assert.ok(!JSON.stringify(report).includes(forbidden));
    }
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
