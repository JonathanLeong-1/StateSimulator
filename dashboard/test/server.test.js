// dashboard/test/server.test.js
// Integration tests for the dashboard HTTP server v2

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createServer } = require('../server');

let server;
let baseUrl;

function get(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`${baseUrl}${urlPath}`, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
          json() { return JSON.parse(body); },
        });
      });
    }).on('error', reject);
  });
}

describe('dashboard server v2', () => {
  before((_, done) => {
    server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      done();
    });
  });

  after((_, done) => {
    server.close(done);
  });

  // --- Static file serving ---

  it('serves index.html at /', async () => {
    const res = await get('/');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
    assert.ok(res.body.includes('<!DOCTYPE html'));
  });

  it('serves static CSS file', async () => {
    const res = await get('/styles.css');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/css'));
  });

  it('serves static JS file', async () => {
    const res = await get('/app.js');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('javascript'));
  });

  it('returns 404 for missing static file', async () => {
    const res = await get('/nonexistent.html');
    assert.equal(res.status, 404);
  });

  it('prevents path traversal in static files', async () => {
    const res = await get('/../package.json');
    assert.ok(res.status === 403 || res.status === 404);
  });

  // --- GET /api/state ---

  it('GET /api/state returns valid state object', async () => {
    const res = await get('/api/state');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('application/json'));
    const data = res.json();
    assert.ok('sessionStart' in data, 'should have sessionStart');
    assert.ok('planPath' in data, 'should have planPath');
    assert.ok('agents' in data, 'should have agents');
    assert.ok('graph' in data, 'should have graph');
    assert.ok('eventCount' in data, 'should have eventCount');
    assert.equal(typeof data.eventCount, 'number');
  });

  it('GET /api/state graph has nodes and edges arrays', async () => {
    const res = await get('/api/state');
    const data = res.json();
    assert.ok(Array.isArray(data.graph.nodes), 'graph.nodes should be an array');
    assert.ok(Array.isArray(data.graph.edges), 'graph.edges should be an array');
  });

  // --- GET /api/plan/:filename ---

  it('GET /api/plan/:filename serves a plan file', async () => {
    const res = await get('/api/plan/README.md');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/plain'));
    assert.ok(res.body.length > 0, 'plan body should not be empty');
  });

  it('GET /api/plan/:filename returns 404 for missing plan', async () => {
    const res = await get('/api/plan/does-not-exist.md');
    assert.equal(res.status, 404);
  });

  it('GET /api/plan/ rejects path traversal with ..', async () => {
    const res = await get('/api/plan/..%2F..%2Fetc%2Fpasswd');
    assert.ok(
      res.status === 400 || res.status === 403 || res.status === 404,
      `expected 400/403/404 but got ${res.status}`
    );
  });

  it('GET /api/plan/ rejects filenames containing slash', async () => {
    const res = await get('/api/plan/sub%2Ffile.md');
    assert.ok(
      res.status === 400 || res.status === 403 || res.status === 404,
      `expected 400/403/404 but got ${res.status}`
    );
  });

  // --- GET /api/stream (SSE) ---

  it('GET /api/stream returns SSE with correct content-type', (t, done) => {
    let finished = false;
    http.get(`${baseUrl}/api/stream`, (res) => {
      assert.equal(res.statusCode, 200);
      assert.ok(res.headers['content-type'].includes('text/event-stream'));

      let data = '';
      res.on('data', (chunk) => {
        data += chunk.toString();
        if (!finished && data.includes('event: connected')) {
          finished = true;
          res.destroy();
          done();
        }
      });
    }).on('error', (err) => {
      if (err.code !== 'ECONNRESET') {
        done(err);
      }
    });
  });

  it('GET /api/stream sends state snapshot after connected', (t, done) => {
    let finished = false;
    http.get(`${baseUrl}/api/stream`, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk.toString();
        if (!finished && data.includes('event: state')) {
          finished = true;
          const stateMatch = data.match(/event: state\ndata: (.+)\n/);
          assert.ok(stateMatch, 'should have state event with data');
          const parsed = JSON.parse(stateMatch[1]);
          assert.ok('agents' in parsed, 'state snapshot should have agents');
          res.destroy();
          done();
        }
      });
    }).on('error', (err) => {
      if (err.code !== 'ECONNRESET') {
        done(err);
      }
    });
  });

  // --- 404 for unknown API routes ---

  it('returns 404 for unknown API routes', async () => {
    const res = await get('/api/unknown');
    assert.equal(res.status, 404);
  });

  it('returns 404 for /api/agents (removed in v2)', async () => {
    const res = await get('/api/agents');
    assert.equal(res.status, 404);
  });

  // --- Multi-workstream integration tests ---

  it('GET /api/state includes workstream data when agents have workstreams', async () => {
    // Inject events directly into server state for testing
    server._state.processEvent({ ts: '2026-01-01T00:00:00Z', agent: 'test-ws-agent', event: 'spawned', workstream: 'backend' });
    const res = await get('/api/state');
    const data = res.json();
    assert.ok(data.agents['test-ws-agent'], 'agent should exist');
    assert.equal(data.agents['test-ws-agent'].workstream, 'backend');
  });

  it('server tracks byte offsets per file', () => {
    assert.ok(server._byteOffsets instanceof Map, 'byteOffsets should be a Map');
  });
});
