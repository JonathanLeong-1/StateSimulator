#!/usr/bin/env node
// dashboard/lib/push-events.js
// CLI to push local event files to the agent-events orphan branch via git worktree.
// Zero dependencies — Node.js built-ins only.
//
// Usage:
//   node dashboard/lib/push-events.js --workstream <name>
//   node dashboard/lib/push-events.js --all
//   node dashboard/lib/push-events.js --workstream <name> --wipe

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { DEFAULT_EVENTS_DIR, WORKSTREAM_RE } = require('./log-event');

const BRANCH = 'agent-events';

function parseArgs(argv) {
  const args = { workstream: null, all: false, wipe: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workstream' && argv[i + 1]) {
      args.workstream = argv[++i];
    } else if (argv[i] === '--all') {
      args.all = true;
    } else if (argv[i] === '--wipe') {
      args.wipe = true;
    }
  }
  return args;
}

function git(cmd, opts) {
  return execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();
}

function ensureOrphanBranch() {
  try {
    git(`rev-parse --verify ${BRANCH}`);
  } catch {
    // Branch doesn't exist — create an orphan
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'push-events-init-'));
    try {
      git(`worktree add --detach "${tmpDir}"`);
      git(`checkout --orphan ${BRANCH}`, { cwd: tmpDir });
      git('rm -rf .', { cwd: tmpDir });
      fs.writeFileSync(path.join(tmpDir, '.gitkeep'), '', 'utf8');
      git('add .gitkeep', { cwd: tmpDir });
      git('commit -m "init agent-events branch"', { cwd: tmpDir });
    } finally {
      git(`worktree remove --force "${tmpDir}"`);
    }
  }
}

function getLocalEventFiles(workstream, all) {
  if (!fs.existsSync(DEFAULT_EVENTS_DIR)) return [];

  if (all) {
    return fs.readdirSync(DEFAULT_EVENTS_DIR)
      .filter((f) => f.startsWith('events') && f.endsWith('.jsonl'));
  }

  if (workstream) {
    const filename = `events-${workstream}.jsonl`;
    const fullPath = path.join(DEFAULT_EVENTS_DIR, filename);
    return fs.existsSync(fullPath) ? [filename] : [];
  }

  return [];
}

function pushEvents(args) {
  if (!args.workstream && !args.all) {
    console.error('Error: Specify --workstream <name> or --all');
    process.exit(1);
  }

  if (args.workstream && !WORKSTREAM_RE.test(args.workstream)) {
    console.error(`Error: Invalid workstream name "${args.workstream}" — must match /^[a-z][a-z0-9-]*$/`);
    process.exit(1);
  }

  const files = getLocalEventFiles(args.workstream, args.all);
  if (files.length === 0) {
    console.log('No event files to push.');
    return;
  }

  ensureOrphanBranch();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'push-events-'));
  try {
    git(`worktree add "${tmpDir}" ${BRANCH}`);

    if (args.wipe) {
      // Remove all events files from the worktree
      const existing = fs.readdirSync(tmpDir)
        .filter((f) => f.startsWith('events') && f.endsWith('.jsonl'));
      for (const f of existing) {
        fs.unlinkSync(path.join(tmpDir, f));
      }
    }

    // Copy local event files into the worktree
    for (const filename of files) {
      const src = path.join(DEFAULT_EVENTS_DIR, filename);
      const dest = path.join(tmpDir, filename);
      fs.copyFileSync(src, dest);
    }

    git('add -A', { cwd: tmpDir });

    // Check if there's anything to commit
    try {
      git('diff --cached --quiet', { cwd: tmpDir });
      console.log('No changes to push.');
      return;
    } catch {
      // There are staged changes — proceed with commit
    }

    git('commit -m "update agent events"', { cwd: tmpDir });

    // Force-push with retry
    let pushed = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        git(`push origin ${BRANCH} --force`, { cwd: tmpDir });
        pushed = true;
        break;
      } catch (err) {
        if (attempt === 0) {
          console.warn('Push failed, retrying...');
        } else {
          console.error(`Push failed after retry: ${err.message}`);
          process.exit(1);
        }
      }
    }

    if (pushed) {
      console.log(`✓ Pushed ${files.length} event file(s) to ${BRANCH}`);
    }
  } finally {
    try {
      git(`worktree remove --force "${tmpDir}"`);
    } catch {
      // best effort cleanup
    }
  }
}

// CLI entry point
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  pushEvents(args);
}

module.exports = { pushEvents, parseArgs, ensureOrphanBranch, getLocalEventFiles };
