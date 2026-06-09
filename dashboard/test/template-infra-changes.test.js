// dashboard/test/template-infra-changes.test.js
// Validates structural correctness of template infrastructure changes
// for the modular-test-lead-workflow feature.

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

// ─── 1. File Existence ───────────────────────────────────────────────────────

describe('File existence', () => {
  it('.test-specs/README.md exists and is non-empty', () => {
    assert.ok(fileExists('.test-specs/README.md'), '.test-specs/README.md should exist');
    const content = readFile('.test-specs/README.md');
    assert.ok(content.trim().length > 0, '.test-specs/README.md should be non-empty');
  });

  it('.test-specs/project/.gitkeep exists', () => {
    assert.ok(fileExists('.test-specs/project/.gitkeep'), '.test-specs/project/.gitkeep should exist');
  });

  it('.test-specs/template/.gitkeep exists', () => {
    assert.ok(fileExists('.test-specs/template/.gitkeep'), '.test-specs/template/.gitkeep should exist');
  });

  it('.github/agents/test-lead.agent.md exists and is non-empty', () => {
    assert.ok(fileExists('.github/agents/test-lead.agent.md'), 'test-lead.agent.md should exist');
    const content = readFile('.github/agents/test-lead.agent.md');
    assert.ok(content.trim().length > 0, 'test-lead.agent.md should be non-empty');
  });
});

// ─── 2. YAML Frontmatter Validation ─────────────────────────────────────────

describe('YAML frontmatter validation', () => {
  const agentFiles = fs.readdirSync(path.join(ROOT, '.github', 'agents'))
    .filter(f => f.endsWith('.agent.md'));

  for (const file of agentFiles) {
    it(`${file} has valid YAML frontmatter delimiters`, () => {
      const content = readFile(path.join('.github', 'agents', file));
      const lines = content.split('\n');
      assert.equal(lines[0].trim(), '---', `${file} should start with ---`);
      const secondDelimiter = lines.slice(1, 10).findIndex(l => l.trim() === '---');
      assert.ok(secondDelimiter >= 0, `${file} should have closing --- within first 10 lines`);
    });
  }

  it('test-lead.agent.md frontmatter contains user-invocable: true', () => {
    const content = readFile('.github/agents/test-lead.agent.md');
    const frontmatter = content.split('---')[1];
    assert.ok(frontmatter.includes('user-invocable: true'),
      'test-lead.agent.md should have user-invocable: true');
  });

  it('test-lead.agent.md frontmatter has tools with execute and read', () => {
    const content = readFile('.github/agents/test-lead.agent.md');
    const frontmatter = content.split('---')[1];
    assert.ok(frontmatter.includes('tools:'), 'test-lead.agent.md should have tools: field');
    assert.ok(frontmatter.includes('execute'), 'test-lead.agent.md tools should include execute');
    assert.ok(frontmatter.includes('read'), 'test-lead.agent.md tools should include read');
  });
});

// ─── 3. .gitattributes ──────────────────────────────────────────────────────

describe('.gitattributes', () => {
  it('contains .test-specs/project/** merge=ours rule', () => {
    assert.ok(fileExists('.gitattributes'), '.gitattributes should exist');
    const content = readFile('.gitattributes');
    const normalized = content.replace(/\s+/g, ' ');
    assert.ok(
      normalized.includes('.test-specs/project/**') && normalized.includes('merge=ours'),
      '.gitattributes should contain .test-specs/project/** merge=ours'
    );
  });
});

// ─── 4. Content Checks ──────────────────────────────────────────────────────

describe('Content checks', () => {
  it('architect.agent.md contains "Modular Architecture Bias"', () => {
    const content = readFile('.github/agents/architect.agent.md');
    assert.ok(content.includes('Modular Architecture Bias'),
      'architect.agent.md should mention Modular Architecture Bias');
  });

  const teamLeads = [
    'backend-lead.agent.md',
    'frontend-lead.agent.md',
    'infra-lead.agent.md',
  ];

  for (const file of teamLeads) {
    it(`${file} contains "GATE 2.5"`, () => {
      const content = readFile(path.join('.github', 'agents', file));
      assert.ok(content.includes('GATE 2.5') || content.includes('Gate 2.5'),
        `${file} should contain GATE 2.5 or Gate 2.5`);
    });

    it(`${file} contains "Test Specs Reference"`, () => {
      const content = readFile(path.join('.github', 'agents', file));
      assert.ok(content.includes('Test Specs Reference'),
        `${file} should contain Test Specs Reference`);
    });
  }

  it('tester.agent.md contains "Test Specs Reference" and "PRIMARY"', () => {
    const content = readFile('.github/agents/tester.agent.md');
    assert.ok(content.includes('Test Specs Reference'),
      'tester.agent.md should contain Test Specs Reference');
    assert.ok(content.includes('PRIMARY'),
      'tester.agent.md should contain PRIMARY');
  });

  it('docs-writer.agent.md contains "Test Specs Reference" and "test strategy"', () => {
    const content = readFile('.github/agents/docs-writer.agent.md');
    assert.ok(content.includes('Test Specs Reference'),
      'docs-writer.agent.md should contain Test Specs Reference');
    assert.ok(content.toLowerCase().includes('test strategy'),
      'docs-writer.agent.md should contain test strategy');
  });

  it('copilot-instructions.md contains required terms', () => {
    const content = readFile('.github/copilot-instructions.md');
    assert.ok(content.includes('Modular Architecture Preference'),
      'copilot-instructions.md should contain Modular Architecture Preference');
    assert.ok(content.includes('test-lead'),
      'copilot-instructions.md should contain test-lead');
    assert.ok(
      content.includes('GATE 2.5') || content.includes('Gate 2.5') || content.includes('| 2.5 |'),
      'copilot-instructions.md should reference Gate 2.5 (heading, inline, or table row)');
  });

  it('TEMPLATE-GUIDE.md contains @test-lead, Test Lead, and .test-specs/', () => {
    const content = readFile('TEMPLATE-GUIDE.md');
    assert.ok(content.includes('@test-lead'),
      'TEMPLATE-GUIDE.md should contain @test-lead');
    assert.ok(content.includes('Test Lead'),
      'TEMPLATE-GUIDE.md should contain Test Lead');
    assert.ok(content.includes('.test-specs/'),
      'TEMPLATE-GUIDE.md should contain .test-specs/');
  });
});

// ─── 5. Consistency Checks ──────────────────────────────────────────────────

describe('Consistency checks', () => {
  const teamLeads = [
    'backend-lead.agent.md',
    'frontend-lead.agent.md',
    'infra-lead.agent.md',
  ];

  it('Gate 2.5 heading text is consistent across all team lead files', () => {
    const headings = teamLeads.map(file => {
      const content = readFile(path.join('.github', 'agents', file));
      const lines = content.split('\n');
      const gateLine = lines.find(l =>
        (l.includes('GATE 2.5') || l.includes('Gate 2.5')) && l.trim().startsWith('#')
      );
      return { file, heading: gateLine ? gateLine.trim() : null };
    });

    // All should have a heading
    for (const { file, heading } of headings) {
      assert.ok(heading, `${file} should have a Gate 2.5 heading`);
    }

    // All headings should match
    const uniqueHeadings = new Set(headings.map(h => h.heading));
    assert.equal(uniqueHeadings.size, 1,
      `Gate 2.5 headings should be identical. Found: ${[...uniqueHeadings].join(' | ')}`);
  });

  it('test-lead.agent.md contains expected sections', () => {
    const content = readFile('.github/agents/test-lead.agent.md');
    const expectedSections = [
      'FORBIDDEN ACTIONS',
      'Workflow',
      'Test Specification Output Format',
      'Agent Monitor Events',
    ];
    for (const section of expectedSections) {
      assert.ok(content.includes(section),
        `test-lead.agent.md should contain section: ${section}`);
    }
  });
});
