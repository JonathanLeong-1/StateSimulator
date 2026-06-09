// dashboard/server.js
// Zero-dependency HTTP server for the Agent Monitor Dashboard v2.
// SSE push, session state, plan viewer, static files.

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const { SessionState } = require('./lib/state');
const { DEFAULT_EVENTS_FILE, DEFAULT_EVENTS_DIR } = require('./lib/log-event');

const PUBLIC_DIR = path.join(__dirname, 'public');
const PLANS_DIR = path.resolve(__dirname, '..', '.plans');
const EVENTS_DIR = DEFAULT_EVENTS_DIR;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/plain',
};

function createServer() {
  const state = new SessionState();
  const sseClients = new Set();
  const byteOffsets = new Map(); // filename -> byte offset
  let debounceTimer = null;
  let gitPollChild = null;

  // Load existing events on startup
  loadAllEvents(state);

  function getEventFiles() {
    if (!fs.existsSync(EVENTS_DIR)) return [];
    return fs.readdirSync(EVENTS_DIR)
      .filter((f) => f.startsWith('events') && f.endsWith('.jsonl'));
  }

  function loadAllEvents(sessionState) {
    const files = getEventFiles();
    const allEvents = [];

    for (const filename of files) {
      const fullPath = path.join(EVENTS_DIR, filename);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        byteOffsets.set(filename, Buffer.byteLength(content, 'utf8'));
        const lines = content.split('\n').filter((l) => l.trim());
        for (const line of lines) {
          try {
            allEvents.push(JSON.parse(line));
          } catch {
            // skip malformed lines
          }
        }
      } catch {
        // file read error
      }
    }

    // Sort by timestamp and process
    allEvents.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
    for (const evt of allEvents) {
      sessionState.processEvent(evt);
    }
  }

  function readNewEventsFromFile(filename) {
    const fullPath = path.join(EVENTS_DIR, filename);
    try {
      if (!fs.existsSync(fullPath)) return [];
      const stat = fs.statSync(fullPath);
      const offset = byteOffsets.get(filename) || 0;

      if (stat.size <= offset) {
        if (stat.size < offset) {
          // File was truncated (session reset)
          byteOffsets.set(filename, 0);
        } else {
          return [];
        }
      }

      const currentOffset = byteOffsets.get(filename) || 0;
      const fd = fs.openSync(fullPath, 'r');
      const buf = Buffer.alloc(stat.size - currentOffset);
      fs.readSync(fd, buf, 0, buf.length, currentOffset);
      fs.closeSync(fd);
      byteOffsets.set(filename, stat.size);

      const newContent = buf.toString('utf8');
      const lines = newContent.split('\n').filter((l) => l.trim());
      const events = [];
      for (const line of lines) {
        try {
          events.push(JSON.parse(line));
        } catch {
          // skip malformed
        }
      }
      return events;
    } catch {
      return [];
    }
  }

  function readNewEventsFromAllFiles() {
    const files = getEventFiles();
    const allNew = [];
    for (const filename of files) {
      const events = readNewEventsFromFile(filename);
      allNew.push(...events);
    }
    return allNew;
  }

  function handleSessionStart(evt) {
    // Truncate all event files
    try {
      if (!fs.existsSync(EVENTS_DIR)) {
        fs.mkdirSync(EVENTS_DIR, { recursive: true });
      }

      // Wipe all events-*.jsonl files
      const files = getEventFiles();
      for (const filename of files) {
        const fullPath = path.join(EVENTS_DIR, filename);
        if (filename === 'events.jsonl') {
          // Write session-start event to the main file
          fs.writeFileSync(fullPath, JSON.stringify(evt) + '\n', 'utf8');
          byteOffsets.set(filename, Buffer.byteLength(JSON.stringify(evt) + '\n', 'utf8'));
        } else {
          fs.writeFileSync(fullPath, '', 'utf8');
          byteOffsets.set(filename, 0);
        }
      }

      // Ensure events.jsonl exists with the session-start event
      const mainFile = path.join(EVENTS_DIR, 'events.jsonl');
      if (!files.includes('events.jsonl')) {
        fs.writeFileSync(mainFile, JSON.stringify(evt) + '\n', 'utf8');
        byteOffsets.set('events.jsonl', Buffer.byteLength(JSON.stringify(evt) + '\n', 'utf8'));
      }
    } catch {
      // best effort
    }

    // Reset state
    state.reset();
    state.processEvent(evt);

    // Push SSE session-reset
    broadcastSSE('session-reset', { ts: evt.ts, plan: evt.plan });
  }

  function broadcastSSE(eventType, data) {
    const payload = JSON.stringify(data);
    for (const client of sseClients) {
      try {
        client.write(`event: ${eventType}\ndata: ${payload}\n\n`);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  // Watch for new events in the events directory
  const eventsDir = EVENTS_DIR;
  if (!fs.existsSync(eventsDir)) {
    fs.mkdirSync(eventsDir, { recursive: true });
  }

  function processNewEvents() {
    const newEvents = readNewEventsFromAllFiles();
    for (const evt of newEvents) {
      if (evt.event === 'session-start' && evt.agent === 'architect') {
        handleSessionStart(evt);
        return; // session-start resets everything
      }
      state.processEvent(evt);
    }
    if (newEvents.length > 0) {
      broadcastSSE('events', newEvents);
    }
  }

  try {
    fs.watch(eventsDir, { persistent: false }, () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(processNewEvents, 100);
    });
  } catch {
    // fs.watch not available — fall back to polling
    setInterval(processNewEvents, 1000);
  }

  // Optional git-pull polling for cross-Codespace mode
  if (process.env.DASHBOARD_GIT_POLL === 'true') {
    try {
      const { spawn } = require('child_process');
      const pullScript = path.join(__dirname, 'lib', 'pull-events.js');
      gitPollChild = spawn(process.execPath, [pullScript, '--interval', '5000'], {
        stdio: 'inherit',
        detached: false,
      });
      gitPollChild.on('error', (err) => {
        console.warn(`Git poll process error: ${err.message}`);
      });
    } catch (err) {
      console.warn(`Failed to start git poll: ${err.message}`);
    }
  }

  function sendJSON(res, data, statusCode = 200) {
    const body = JSON.stringify(data);
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  }

  function serveStatic(res, reqPath) {
    const filePath = reqPath === '/' ? '/index.html' : reqPath;
    const fullPath = path.join(PUBLIC_DIR, filePath);
    const resolved = path.resolve(fullPath);

    // Path traversal protection
    if (!resolved.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(resolved, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      const ext = path.extname(resolved);
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': data.length,
      });
      res.end(data);
    });
  }

  function servePlan(res, filename) {
    // Validate filename — no path traversal
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      res.writeHead(400);
      res.end('Bad Request');
      return;
    }

    const fullPath = path.join(PLANS_DIR, filename);
    const resolved = path.resolve(fullPath);

    if (!resolved.startsWith(path.resolve(PLANS_DIR))) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(resolved, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Content-Length': Buffer.byteLength(data),
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  }

  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    if (pathname === '/api/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write('event: connected\ndata: {}\n\n');

      // Send current state snapshot
      const currentState = state.getState();
      res.write(`event: state\ndata: ${JSON.stringify(currentState)}\n\n`);

      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    if (pathname === '/api/state') {
      sendJSON(res, state.getState());
      return;
    }

    if (pathname.startsWith('/api/plan/')) {
      const filename = decodeURIComponent(pathname.slice('/api/plan/'.length));
      servePlan(res, filename);
      return;
    }

    // Static files
    serveStatic(res, pathname);
  });

  // Expose state and sseClients for testing
  server._state = state;
  server._sseClients = sseClients;
  server._byteOffsets = byteOffsets;
  server._gitPollChild = gitPollChild;

  const origClose = server.close.bind(server);
  server.close = function (cb) {
    if (gitPollChild) {
      gitPollChild.kill();
      gitPollChild = null;
    }
    return origClose(cb);
  };

  return server;
}

module.exports = { createServer };
