#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const KiroSpecValidator = require('./lib/kiro-spec-validator');

const [, , command, target, extra] = process.argv;
const validator = new KiroSpecValidator({
  strict: !process.argv.includes('--lenient'),
});

function usage() {
  console.log('Usage:');
  console.log(
    '  node scripts/kiro-spec.js validate <spec-dir> [--json] [--write-report] [--lenient]'
  );
  console.log(
    '  node scripts/kiro-spec.js context <spec-dir> <task-id> [--json]'
  );
  console.log('  node scripts/kiro-spec.js init <spec-name>');
}

function writeAtomic(filename, content) {
  const temporary = `${filename}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, content);
  fs.renameSync(temporary, filename);
}

function init(name) {
  if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name))
    throw new Error('Spec name must be lowercase kebab-case');
  const dir = path.resolve('.kiro', 'specs', name);
  fs.mkdirSync(dir, { recursive: true });
  const files = {
    'requirements.md': `# Requirements Document\n\n## Introduction\n\nDescribe the capability and measurable outcome.\n\n## Glossary\n\n- **System**: The capability under specification\n\n## Requirements\n\n### Requirement 1: Capability name\n\n**User Story:** As a user, I want a capability, so that I receive value.\n\n#### Acceptance Criteria\n\n1. WHEN a valid event occurs, THE System SHALL produce a measurable result\n`,
    'design.md': `# Design Document: Capability name\n\n## Overview\n\nDescribe the smallest architecture that satisfies the requirements.\n\n## Architecture\n\nDescribe components, boundaries, data flow, failure behavior, and observability.\n\n## Correctness Properties\n\n### Property 1: Measurable result\n\n*For any* valid input, the system produces the required measurable result.\n\n**Validates: Requirements 1.1**\n`,
    'tasks.md': `# Implementation Plan: Capability name\n\n## Overview\n\nImplement in dependency order. A checked parent requires every non-optional direct child to be checked.\n\n## Tasks\n\n- [ ] 1. Implement the capability\n  - Implement the smallest production behavior for the acceptance criterion\n  - _Requirements: 1.1_\n\n  - [ ] 1.1 Write property test for measurable result\n    - **Property 1: Measurable result**\n    - **Validates: Requirements 1.1**\n\n## Notes\n\n- Add _Depends on: 1.1, 2.1_ when ordering cannot be inferred from hierarchy.\n- Quality, security, migration, rollback, and verification tasks must not be optional.\n`,
  };
  for (const [filename, content] of Object.entries(files)) {
    const destination = path.join(dir, filename);
    if (!fs.existsSync(destination)) writeAtomic(destination, content);
  }
  console.log(dir);
}

try {
  if (command === 'validate') {
    if (!target) return usage();
    const report = validator.validate(target);
    if (process.argv.includes('--write-report')) {
      const output = path.join(path.resolve(target), 'validation-report.json');
      const serializable = { ...report };
      delete serializable.model;
      writeAtomic(output, `${JSON.stringify(serializable, null, 2)}\n`);
    }
    if (process.argv.includes('--json')) {
      const serializable = { ...report };
      delete serializable.model;
      console.log(JSON.stringify(serializable, null, 2));
    } else {
      console.log(`${report.valid ? 'PASS' : 'FAIL'} ${report.specDir}`);
      console.log(
        `requirements=${report.metrics.requirements} criteria=${report.metrics.acceptanceCriteria} properties=${report.metrics.properties} tasks=${report.metrics.tasks} coverage=${report.metrics.traceCoveragePercent}%`
      );
      for (const item of [...report.errors, ...report.warnings])
        console.log(
          `${report.errors.includes(item) ? 'ERROR' : 'WARN'} ${item.code}: ${item.message}`
        );
    }
    process.exitCode = report.valid ? 0 : 1;
  } else if (command === 'context') {
    if (!target || !extra) return usage();
    console.log(
      JSON.stringify(validator.contextPacket(target, extra), null, 2)
    );
  } else if (command === 'init') {
    init(target);
  } else {
    usage();
  }
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
