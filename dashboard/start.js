#!/usr/bin/env node
// dashboard/start.js
// Entry point for the Agent Monitor Dashboard.
// Usage:
//   node dashboard/start.js            # Start on port 4820
//   node dashboard/start.js --open     # Start and open in default browser
//   node dashboard/start.js --port 8080  # Custom port

'use strict';

const { createServer } = require('./server');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const port = portArg !== -1 && args[portArg + 1] ? parseInt(args[portArg + 1], 10) : 4820;
const shouldOpen = args.includes('--open');

const server = createServer();

server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}`;
  console.log(`\n  🤖 Agent Monitor Dashboard`);
  console.log(`  ─────────────────────────`);
  console.log(`  Running at: ${url}`);
  console.log(`  Press Ctrl+C to stop\n`);

  if (shouldOpen) {
    try {
      const platform = process.platform;
      if (platform === 'win32') {
        execSync(`start "" "${url}"`, { stdio: 'ignore' });
      } else if (platform === 'darwin') {
        execSync(`open "${url}"`, { stdio: 'ignore' });
      } else {
        execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
      }
    } catch {
      console.log(`  Could not auto-open browser. Visit ${url} manually.`);
    }
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Error: Port ${port} is already in use.`);
    console.error(`  Try: node dashboard/start.js --port ${port + 1}\n`);
  } else {
    console.error(`\n  Server error: ${err.message}\n`);
  }
  process.exit(1);
});
