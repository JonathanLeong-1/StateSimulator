#!/usr/bin/env node
// dashboard/lib/pull-events.js
// CLI to fetch event files from the agent-events orphan branch.
// Zero dependencies — Node.js built-ins only.
//
// Usage:
//   node dashboard/lib/pull-events.js              # pull once (default)
//   node dashboard/lib/pull-events.js --once       # pull once (explicit)
//   node dashboard/lib/pull-events.js --interval 5000  # poll every 5s

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { DEFAULT_EVENTS_DIR } = require('./log-event');

const BRANCH = 'agent-events';

function parseArgs(argv) {
  const args = { once: true, interval: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--once') {
      args.once = true;
      args.interval = null;
    } else if (argv[i] === '--interval' && argv[i + 1]) {
      args.interval = parseInt(argv[++i], 10);
      args.once = false;
    }
  }
  return args;
}

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function branchExists() {
  try {
    git(`ls-remote --heads origin ${BRANCH}`);
    return true;
  } catch {
    return false;
  }
}

function pullOnce() {
  if (!branchExists()) {
    console.log(`Branch "${BRANCH}" not found on remote — nothing to pull.`);
    return false;
  }

  try {
    git(`fetch origin ${BRANCH}`);
  } catch (err) {
    console.warn(`Fetch failed: ${err.message}`);
    return false;
  }

  // List event files on the fetched branch
  let fileList;
  try {
    fileList = git(`ls-tree --name-only FETCH_HEAD`);
  } catch {
    console.warn('Could not list files on remote branch.');
    return false;
  }

  const files = fileList.split('\n')
    .filter((f) => f.startsWith('events') && f.endsWith('.jsonl'));

  if (files.length === 0) {
    console.log('No event files on remote branch.');
    return false;
  }

  // Ensure local events directory exists
  if (!fs.existsSync(DEFAULT_EVENTS_DIR)) {
    fs.mkdirSync(DEFAULT_EVENTS_DIR, { recursive: true });
  }

  // Copy each file from the fetched branch
  for (const filename of files) {
    try {
      const content = git(`show FETCH_HEAD:${filename}`);
      fs.writeFileSync(path.join(DEFAULT_EVENTS_DIR, filename), content, 'utf8');
    } catch {
      console.warn(`Could not read "${filename}" from remote branch.`);
    }
  }

  console.log(`✓ Pulled ${files.length} event file(s) from ${BRANCH}`);
  return true;
}

function startPolling(intervalMs) {
  console.log(`Polling ${BRANCH} every ${intervalMs}ms...`);
  pullOnce();
  const timer = setInterval(() => {
    pullOnce();
  }, intervalMs);
  // Allow the process to exit if this is the only thing running
  timer.unref();
  return timer;
}

// CLI entry point
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  if (args.interval) {
    startPolling(args.interval);
    // Keep the process alive for polling
    process.stdin.resume();
  } else {
    pullOnce();
  }
}

module.exports = { pullOnce, startPolling, parseArgs, branchExists };
