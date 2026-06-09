// dashboard/test/pull-events.test.js
// Tests for pull-events.js CLI argument parsing (mocked git)

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { parseArgs } = require('../lib/pull-events');

describe('pull-events.js', () => {
  describe('parseArgs', () => {
    it('should default to once mode', () => {
      const args = parseArgs([]);
      assert.equal(args.once, true);
      assert.equal(args.interval, null);
    });

    it('should parse --once flag', () => {
      const args = parseArgs(['--once']);
      assert.equal(args.once, true);
      assert.equal(args.interval, null);
    });

    it('should parse --interval flag', () => {
      const args = parseArgs(['--interval', '5000']);
      assert.equal(args.once, false);
      assert.equal(args.interval, 5000);
    });

    it('should handle --interval overriding --once', () => {
      const args = parseArgs(['--once', '--interval', '3000']);
      assert.equal(args.once, false);
      assert.equal(args.interval, 3000);
    });

    it('should handle --once overriding --interval', () => {
      const args = parseArgs(['--interval', '3000', '--once']);
      assert.equal(args.once, true);
      assert.equal(args.interval, null);
    });
  });
});
