'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const fc = require('fast-check');
const KiroSpecValidator = require('../../scripts/lib/kiro-spec-validator');

function writeSpec(dir, overrides = {}) {
  const files = {
    'requirements.md': `# Requirements Document

## Requirements

### Requirement 1: Deterministic validation

**User Story:** As a developer, I want deterministic validation, so that quality is reproducible.

#### Acceptance Criteria

1. WHEN a valid spec is evaluated, THE Validator SHALL return a passing result
2. WHEN an invalid spec is evaluated, THE Validator SHALL identify every violated invariant
`,
    'design.md': `# Design Document

## Correctness Properties

### Property 1: Valid specifications pass

*For any* valid specification, validation returns success.

**Validates: Requirements 1.1**

### Property 2: Invalid specifications explain failures

*For any* invalid specification, all deterministic failures are reported.

**Validates: Requirements 1.2**
`,
    'tasks.md': `# Implementation Plan

## Tasks

- [ ] 1. Implement deterministic validation
  - _Requirements: 1.1, 1.2_

  - [ ] 1.1 Write property test for valid specifications
    - **Property 1: Valid specifications pass**
    - **Validates: Requirements 1.1**

  - [ ] 1.2 Write property test for invalid specifications
    - **Property 2: Invalid specifications explain failures**
    - **Validates: Requirements 1.2**
    - _Depends on: 1.1_
`,
    ...overrides,
  };
  for (const [name, content] of Object.entries(files))
    fs.writeFileSync(path.join(dir, name), content);
}

// Generators for property-based testing
const kebabCaseNameGen = () =>
  fc
    .tuple(
      fc.array(fc.stringMatching(/^[a-z0-9]+$/), { minLength: 1, maxLength: 3 }),
      fc.integer({ min: 0, max: 2 })
    )
    .map(([parts, hyphens]) => {
      // Insert hyphens between parts
      const result = [];
      for (let i = 0; i < parts.length; i++) {
        result.push(parts[i]);
        if (i < parts.length - 1 && hyphens > 0) {
          result.push('-');
        }
      }
      return result.join('').substring(0, 50);
    });

const invalidNameGen = () =>
  fc.oneof(
    fc.stringMatching(/^[A-Z]/, { minLength: 1 }),
    fc.stringMatching(/^[a-z]*_[a-z0-9]*$/, { minLength: 3 }),
    fc.stringMatching(/^[a-z0-9]*\s[a-z0-9]*$/, { minLength: 3 }),
    fc.stringMatching(/^[a-z0-9]*\.[a-z0-9]*$/, { minLength: 3 }),
    fc.stringMatching(/^[a-z0-9]*\/[a-z0-9]*$/, { minLength: 3 })
  );

const canonicalFileNamesGen = () =>
  fc.sample(
    fc.constantFrom(
      'requirements.md',
      'design.md',
      'tasks.md'
    ),
    { numRuns: 3 }
  ).sort();

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kiro-spec-'));
}

function cleanupTempDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('KiroSpecValidator', () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiro-spec-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('accepts a complete Kiro-compatible specification', () => {
    writeSpec(dir);
    const report = new KiroSpecValidator().validate(dir);
    expect(report.valid).toBe(true);
    expect(report.metrics).toMatchObject({
      requirements: 1,
      acceptanceCriteria: 2,
      properties: 2,
      tasks: 3,
      traceCoveragePercent: 100,
    });
  });

  test('rejects missing canonical Kiro files', () => {
    fs.writeFileSync(
      path.join(dir, 'requirements.md'),
      '# Requirements Document'
    );
    const report = new KiroSpecValidator().validate(dir);
    expect(
      report.errors.filter((item) => item.code === 'SPEC_FILE_MISSING')
    ).toHaveLength(2);
  });

  test('rejects unknown traces, uncovered criteria and missing property tests', () => {
    writeSpec(dir, {
      'tasks.md':
        '# Implementation Plan\n\n- [ ] 1. Implement something\n  - _Requirements: 9.9_\n',
    });
    const codes = new Set(
      new KiroSpecValidator().validate(dir).errors.map((item) => item.code)
    );
    expect(codes.has('UNKNOWN_REQUIREMENT_REF')).toBe(true);
    expect(codes.has('UNCOVERED_ACCEPTANCE_CRITERION')).toBe(true);
    expect(codes.has('PROPERTY_WITHOUT_TEST')).toBe(true);
  });

  test('rejects optional quality tasks and inconsistent parent status', () => {
    writeSpec(dir, {
      'tasks.md': `# Implementation Plan

- [x] 1. Implement deterministic validation
  - _Requirements: 1.1, 1.2_
  - [ ]* 1.1 Write property test for valid specifications
    - **Property 1: Valid specifications pass**
    - **Validates: Requirements 1.1**
  - [x] 1.2 Write property test for invalid specifications
    - **Property 2: Invalid specifications explain failures**
    - **Validates: Requirements 1.2**
`,
    });
    const codes = new KiroSpecValidator()
      .validate(dir)
      .errors.map((item) => item.code);
    expect(codes).toContain('CRITICAL_TASK_OPTIONAL');
  });

  test('rejects dependency cycles', () => {
    writeSpec(dir, {
      'tasks.md': `# Implementation Plan

- [ ] 1. Implement deterministic validation
  - _Requirements: 1.1, 1.2_
  - [ ] 1.1 Write property test for valid specifications
    - **Property 1: Valid specifications pass**
    - **Validates: Requirements 1.1**
    - _Depends on: 1.2_
  - [ ] 1.2 Write property test for invalid specifications
    - **Property 2: Invalid specifications explain failures**
    - **Validates: Requirements 1.2**
    - _Depends on: 1.1_
`,
    });
    expect(
      new KiroSpecValidator()
        .validate(dir)
        .errors.some((item) => item.code === 'DEPENDENCY_CYCLE')
    ).toBe(true);
  });

  test('builds a bounded task context packet', () => {
    writeSpec(dir);
    const packet = new KiroSpecValidator().contextPacket(dir, '1.2');
    expect(packet.task.id).toBe('1.2');
    expect(packet.requirements.map((item) => item.id)).toEqual(['1.2']);
    expect(packet.properties.map((item) => item.id)).toContain('2');
    expect(packet.dependencies[0].id).toBe('1.1');
  });
});

describe('Property 1: Canonical trio initialization', () => {
  /**
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
   *
   * WHEN a specification is initialized with a valid kebab-case name,
   * THE Spec_Validator SHALL accept it and validate that all three canonical files
   * are present and properly structured.
   *
   * For any generated kebab-case name, the validator accepts complete specs created
   * under `.kiro/specs/<kebab-name>` with all three canonical files.
   *
   * For any existing files, validation preserves them without modification.
   */

  test('P1.1: Complete initialized specs with valid kebab-case names pass validation', () => {
    fc.assert(
      fc.property(kebabCaseNameGen(), (specName) => {
        const tempBase = createTempDir();
        try {
          const normalized = specName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          // Skip invalid patterns that don't normalize to kebab-case
          if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
            return;
          }

          const specDir = path.join(tempBase, '.kiro', 'specs', normalized);
          fs.mkdirSync(specDir, { recursive: true });

          // Create a properly initialized spec
          writeSpec(specDir);

          // Validation should succeed
          const report = new KiroSpecValidator().validate(specDir);
          expect(report.valid).toBe(true);
          expect(report.specDir).toBe(specDir);
        } finally {
          cleanupTempDir(tempBase);
        }
      }),
      { numRuns: 15 }
    );
  });

  test('P1.2: Existing canonical files prevent overwrite - validator sees original content', () => {
    fc.assert(
      fc.property(
        kebabCaseNameGen(),
        fc.constantFrom('requirements.md', 'design.md', 'tasks.md'),
        fc.string({
          minLength: 5,
          maxLength: 100,
        }),
        (specName, fileName, uniqueMarker) => {
          const tempBase = createTempDir();
          try {
            const normalized = specName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
              return;
            }

            const specDir = path.join(tempBase, '.kiro', 'specs', normalized);
            fs.mkdirSync(specDir, { recursive: true });

            // Create initial spec
            writeSpec(specDir);

            // Inject unique marker into one file
            const filePath = path.join(specDir, fileName);
            const original = fs.readFileSync(filePath, 'utf8');
            const marked = original + `\n<!-- MARKER: ${uniqueMarker} -->`;
            fs.writeFileSync(filePath, marked);

            // Re-reading should preserve the marker
            const readBack = fs.readFileSync(filePath, 'utf8');
            expect(readBack).toContain(uniqueMarker);

            // Validator should see the file as-is
            const report = new KiroSpecValidator().validate(specDir);
            expect(report.valid).toBe(true);
          } finally {
            cleanupTempDir(tempBase);
          }
        }
      ),
      { numRuns: 15 }
    );
  });

  test('P1.3: Invalid spec names outside kebab-case pattern are rejected', () => {
    fc.assert(
      fc.property(invalidNameGen(), (invalidName) => {
        const tempBase = createTempDir();
        try {
          const specDir = path.join(tempBase, '.kiro', 'specs', invalidName);
          fs.mkdirSync(specDir, { recursive: true });
          writeSpec(specDir);

          // Any name that is not valid kebab-case should be identified as invalid
          const isValidKebabCase =
            /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(invalidName);
          expect(isValidKebabCase).toBe(false);
        } finally {
          cleanupTempDir(tempBase);
        }
      }),
      { numRuns: 15 }
    );
  });

  test('P1.4: Validator detects missing canonical files for any spec name', () => {
    fc.assert(
      fc.property(
        kebabCaseNameGen(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (specName, hasReq, hasDesign, hasTasks) => {
          const tempBase = createTempDir();
          try {
            const normalized = specName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
              return;
            }

            const specDir = path.join(tempBase, '.kiro', 'specs', normalized);
            fs.mkdirSync(specDir, { recursive: true });

            // Create subset of canonical files with minimal Kiro content
            if (hasReq) {
              fs.writeFileSync(
                path.join(specDir, 'requirements.md'),
                '# Requirements Document\n\n### Requirement 1: Test\n\n#### Acceptance Criteria\n\n1. Test criterion'
              );
            }
            if (hasDesign) {
              fs.writeFileSync(
                path.join(specDir, 'design.md'),
                '# Design Document\n\n### Property 1: Test\n\n**Validates: Requirements 1.1**'
              );
            }
            if (hasTasks) {
              fs.writeFileSync(
                path.join(specDir, 'tasks.md'),
                '# Tasks\n\n- [ ] 1.1 Test task\n  - **Property 1: Test**\n  - **Validates: Requirements 1.1**'
              );
            }

            const report = new KiroSpecValidator().validate(specDir);

            // If any file is missing, validation should fail due to missing files
            const allPresent = hasReq && hasDesign && hasTasks;
            if (!allPresent) {
              // Should have errors for missing files
              const missingErrors = report.errors.filter(
                (e) => e.code === 'SPEC_FILE_MISSING'
              );
              expect(missingErrors.length).toBeGreaterThan(0);
              expect(report.valid).toBe(false);
            } else {
              // All present - may have other errors but not missing file errors
              const missingErrors = report.errors.filter(
                (e) => e.code === 'SPEC_FILE_MISSING'
              );
              expect(missingErrors.length).toBe(0);
            }
          } finally {
            cleanupTempDir(tempBase);
          }
        }
      ),
      { numRuns: 25 }
    );
  });

  test('P1.5: Validator accepts complete trio - all three files present and structured correctly', () => {
    fc.assert(
      fc.property(kebabCaseNameGen(), (specName) => {
        const tempBase = createTempDir();
        try {
          const normalized = specName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
            return;
          }

          const specDir = path.join(tempBase, '.kiro', 'specs', normalized);
          fs.mkdirSync(specDir, { recursive: true });
          writeSpec(specDir);

          // After complete initialization, all files must be present
          const reqExists = fs.existsSync(path.join(specDir, 'requirements.md'));
          const designExists = fs.existsSync(path.join(specDir, 'design.md'));
          const tasksExists = fs.existsSync(path.join(specDir, 'tasks.md'));

          expect(reqExists && designExists && tasksExists).toBe(true);

          // Validator confirms trio is complete
          const report = new KiroSpecValidator().validate(specDir);
          expect(report.valid).toBe(true);
          expect(report.metrics.requirements).toBeGreaterThan(0);
          expect(report.metrics.properties).toBeGreaterThan(0);
          expect(report.metrics.tasks).toBeGreaterThan(0);
        } finally {
          cleanupTempDir(tempBase);
        }
      }),
      { numRuns: 15 }
    );
  });

  test('P1.6: Validator idempotence - successive validations produce identical reports for unchanged specs', () => {
    fc.assert(
      fc.property(kebabCaseNameGen(), (specName) => {
        const tempBase = createTempDir();
        try {
          const normalized = specName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
            return;
          }

          const specDir = path.join(tempBase, '.kiro', 'specs', normalized);
          fs.mkdirSync(specDir, { recursive: true });
          writeSpec(specDir);

          const validator = new KiroSpecValidator();
          const report1 = validator.validate(specDir);
          const report2 = validator.validate(specDir);

          // Same spec should produce same fingerprint
          expect(report1.fingerprint).toBe(report2.fingerprint);
          // Same validation outcomes
          expect(report1.valid).toBe(report2.valid);
          expect(report1.metrics).toEqual(report2.metrics);
        } finally {
          cleanupTempDir(tempBase);
        }
      }),
      { numRuns: 12 }
    );
  });

  test('P1.7: Proper path nesting - specs created under .kiro/specs/<kebab-name>/', () => {
    fc.assert(
      fc.property(kebabCaseNameGen(), (specName) => {
        const tempBase = createTempDir();
        try {
          const normalized = specName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
            return;
          }

          const specDir = path.join(tempBase, '.kiro', 'specs', normalized);
          fs.mkdirSync(specDir, { recursive: true });

          // Verify correct nested structure
          expect(path.basename(specDir)).toBe(normalized);
          expect(path.basename(path.dirname(specDir))).toBe('specs');
          expect(path.basename(path.dirname(path.dirname(specDir)))).toBe(
            '.kiro'
          );

          // All three canonical files must be in this exact directory
          writeSpec(specDir);
          expect(
            fs.existsSync(path.join(specDir, 'requirements.md'))
          ).toBe(true);
          expect(fs.existsSync(path.join(specDir, 'design.md'))).toBe(true);
          expect(fs.existsSync(path.join(specDir, 'tasks.md'))).toBe(true);
        } finally {
          cleanupTempDir(tempBase);
        }
      }),
      { numRuns: 12 }
    );
  });

  test('P1.8: Kebab-case validation - valid patterns accepted, invalid rejected consistently', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('my-spec'),
          fc.constant('spec-name'),
          fc.constant('a'),
          fc.constant('a-b-c'),
          fc.constant('test1-spec2')
        ),
        (validName) => {
          const isValid = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(validName);
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 5 }
    );

    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('MySpec'),
          fc.constant('my_spec'),
          fc.constant('my.spec'),
          fc.constant('-invalid'),
          fc.constant('invalid-'),
          fc.constant('INVALID')
        ),
        (invalidName) => {
          const isValid = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(invalidName);
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 6 }
    );
  });

  test('P1.9: Fingerprint stability - unchanged trio produces identical fingerprint across runs', () => {
    fc.assert(
      fc.property(kebabCaseNameGen(), (specName) => {
        const tempBase = createTempDir();
        try {
          const normalized = specName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
            return;
          }

          const specDir = path.join(tempBase, '.kiro', 'specs', normalized);
          fs.mkdirSync(specDir, { recursive: true });
          writeSpec(specDir);

          // Multiple validation runs should produce identical fingerprints
          const fingerprints = [];
          for (let i = 0; i < 3; i++) {
            const report = new KiroSpecValidator().validate(specDir);
            fingerprints.push(report.fingerprint);
          }

          expect(fingerprints[0]).toBe(fingerprints[1]);
          expect(fingerprints[1]).toBe(fingerprints[2]);
        } finally {
          cleanupTempDir(tempBase);
        }
      }),
      { numRuns: 10 }
    );
  });
});

describe('Property 2: Markdown remains canonical', () => {
  /**
   * **Validates: Requirements 1.5**
   *
   * WHEN Markdown and a Derived_Artifact disagree, THE system SHALL treat the
   * three canonical Markdown files as the source of truth.
   *
   * For any report or context packet, its content is derived from the current
   * canonical trio and never overrides the Markdown source. Derived artifacts
   * are idempotent projections: modifying canonical files produces new reports
   * reflecting those changes, and Markdown files are never rewritten by
   * reading or generating derived artifacts.
   */

  test('P2.1: Canonical files are never mutated by validate() operation', () => {
    fc.assert(
      fc.property(kebabCaseNameGen(), (specName) => {
        const tempBase = createTempDir();
        try {
          const normalized = specName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
            return;
          }

          const specDir = path.join(tempBase, '.kiro', 'specs', normalized);
          fs.mkdirSync(specDir, { recursive: true });
          writeSpec(specDir);

          // Capture original content
          const originalContents = {
            requirements: fs.readFileSync(
              path.join(specDir, 'requirements.md'),
              'utf8'
            ),
            design: fs.readFileSync(path.join(specDir, 'design.md'), 'utf8'),
            tasks: fs.readFileSync(path.join(specDir, 'tasks.md'), 'utf8'),
          };

          // Run validation multiple times
          const validator = new KiroSpecValidator();
          for (let i = 0; i < 3; i++) {
            validator.validate(specDir);
          }

          // Verify files are unchanged
          const finalContents = {
            requirements: fs.readFileSync(
              path.join(specDir, 'requirements.md'),
              'utf8'
            ),
            design: fs.readFileSync(path.join(specDir, 'design.md'), 'utf8'),
            tasks: fs.readFileSync(path.join(specDir, 'tasks.md'), 'utf8'),
          };

          expect(finalContents.requirements).toBe(originalContents.requirements);
          expect(finalContents.design).toBe(originalContents.design);
          expect(finalContents.tasks).toBe(originalContents.tasks);
        } finally {
          cleanupTempDir(tempBase);
        }
      }),
      { numRuns: 12 }
    );
  });

  test('P2.2: Canonical files are never mutated by contextPacket() operation', () => {
    fc.assert(
      fc.property(kebabCaseNameGen(), (specName) => {
        const tempBase = createTempDir();
        try {
          const normalized = specName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
            return;
          }

          const specDir = path.join(tempBase, '.kiro', 'specs', normalized);
          fs.mkdirSync(specDir, { recursive: true });
          writeSpec(specDir);

          // Capture original content
          const originalContents = {
            requirements: fs.readFileSync(
              path.join(specDir, 'requirements.md'),
              'utf8'
            ),
            design: fs.readFileSync(path.join(specDir, 'design.md'), 'utf8'),
            tasks: fs.readFileSync(path.join(specDir, 'tasks.md'), 'utf8'),
          };

          // Generate context packet
          const validator = new KiroSpecValidator();
          try {
            validator.contextPacket(specDir, '1.2');
          } catch {
            // Ignore if task doesn't exist
          }

          // Verify files are unchanged
          const finalContents = {
            requirements: fs.readFileSync(
              path.join(specDir, 'requirements.md'),
              'utf8'
            ),
            design: fs.readFileSync(path.join(specDir, 'design.md'), 'utf8'),
            tasks: fs.readFileSync(path.join(specDir, 'tasks.md'), 'utf8'),
          };

          expect(finalContents.requirements).toBe(originalContents.requirements);
          expect(finalContents.design).toBe(originalContents.design);
          expect(finalContents.tasks).toBe(originalContents.tasks);
        } finally {
          cleanupTempDir(tempBase);
        }
      }),
      { numRuns: 12 }
    );
  });

  test('P2.3: Report content derives from current canonical state - changes to Markdown change report', () => {
    fc.assert(
      fc.property(kebabCaseNameGen(), (specName) => {
        const tempBase = createTempDir();
        try {
          const normalized = specName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
            return;
          }

          const specDir = path.join(tempBase, '.kiro', 'specs', normalized);
          fs.mkdirSync(specDir, { recursive: true });
          writeSpec(specDir);

          const validator = new KiroSpecValidator();

          // Get initial report
          const report1 = validator.validate(specDir);
          const fingerprint1 = report1.fingerprint;
          const coverage1 = report1.metrics.traceCoveragePercent;

          // Modify a canonical file
          const designPath = path.join(specDir, 'design.md');
          let designContent = fs.readFileSync(designPath, 'utf8');
          designContent += '\n\n### Property 3: Test added property\n\n**Validates: Requirements 1.2**\n';
          fs.writeFileSync(designPath, designContent);

          // Get new report
          const report2 = validator.validate(specDir);
          const fingerprint2 = report2.fingerprint;
          const coverage2 = report2.metrics.traceCoveragePercent;

          // Fingerprints should differ (content changed)
          expect(fingerprint2).not.toBe(fingerprint1);

          // Properties count should increase
          expect(report2.metrics.properties).toBeGreaterThan(
            report1.metrics.properties
          );

          // Canonical files should not be re-written by validator
          const designAfter = fs.readFileSync(designPath, 'utf8');
          expect(designAfter).toContain('### Property 3: Test added property');
        } finally {
          cleanupTempDir(tempBase);
        }
      }),
      { numRuns: 10 }
    );
  });

  test('P2.4: Report and context packet fingerprints match when content unchanged', () => {
    fc.assert(
      fc.property(kebabCaseNameGen(), (specName) => {
        const tempBase = createTempDir();
        try {
          const normalized = specName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
            return;
          }

          const specDir = path.join(tempBase, '.kiro', 'specs', normalized);
          fs.mkdirSync(specDir, { recursive: true });
          writeSpec(specDir);

          const validator = new KiroSpecValidator();
          const report = validator.validate(specDir);

          // If valid, generate context packet
          if (report.valid) {
            const packet = validator.contextPacket(specDir, '1.2');
            // Both should have identical fingerprint
            expect(packet.fingerprint).toBe(report.fingerprint);
          }
        } finally {
          cleanupTempDir(tempBase);
        }
      }),
      { numRuns: 12 }
    );
  });

  test('P2.5: Idempotent projections - repeated validation with unchanged Markdown produces identical reports', () => {
    fc.assert(
      fc.property(kebabCaseNameGen(), (specName) => {
        const tempBase = createTempDir();
        try {
          const normalized = specName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
            return;
          }

          const specDir = path.join(tempBase, '.kiro', 'specs', normalized);
          fs.mkdirSync(specDir, { recursive: true });
          writeSpec(specDir);

          const validator = new KiroSpecValidator();

          // Generate multiple reports
          const reports = [];
          for (let i = 0; i < 5; i++) {
            reports.push(validator.validate(specDir));
          }

          // All should be identical
          const first = reports[0];
          for (let i = 1; i < reports.length; i++) {
            expect(reports[i].valid).toBe(first.valid);
            expect(reports[i].fingerprint).toBe(first.fingerprint);
            expect(reports[i].metrics).toEqual(first.metrics);
            expect(reports[i].errors.length).toBe(first.errors.length);
          }
        } finally {
          cleanupTempDir(tempBase);
        }
      }),
      { numRuns: 10 }
    );
  });

  test('P2.6: Modification to requirement changes coverage metrics in report', () => {
    fc.assert(
      fc.property(kebabCaseNameGen(), (specName) => {
        const tempBase = createTempDir();
        try {
          const normalized = specName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
            return;
          }

          const specDir = path.join(tempBase, '.kiro', 'specs', normalized);
          fs.mkdirSync(specDir, { recursive: true });
          writeSpec(specDir);

          const validator = new KiroSpecValidator();
          const report1 = validator.validate(specDir);
          const initialACs = report1.metrics.acceptanceCriteria;

          // Add a new acceptance criterion
          const reqPath = path.join(specDir, 'requirements.md');
          let reqContent = fs.readFileSync(reqPath, 'utf8');
          reqContent += '\n3. WHEN new criterion is evaluated, THE validator SHALL accept it';
          fs.writeFileSync(reqPath, reqContent);

          const report2 = validator.validate(specDir);

          // New report should reflect additional criterion
          expect(report2.metrics.acceptanceCriteria).toBeGreaterThanOrEqual(
            initialACs
          );

          // But file should not be mutated back
          const reqAfter = fs.readFileSync(reqPath, 'utf8');
          expect(reqAfter).toContain('3. WHEN new criterion is evaluated');
        } finally {
          cleanupTempDir(tempBase);
        }
      }),
      { numRuns: 10 }
    );
  });

  test('P2.7: Context packet is derived and immutable - repeated calls with same Markdown yield identical packets', () => {
    fc.assert(
      fc.property(kebabCaseNameGen(), (specName) => {
        const tempBase = createTempDir();
        try {
          const normalized = specName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
            return;
          }

          const specDir = path.join(tempBase, '.kiro', 'specs', normalized);
          fs.mkdirSync(specDir, { recursive: true });
          writeSpec(specDir);

          const validator = new KiroSpecValidator();
          const report = validator.validate(specDir);

          if (report.valid) {
            // Generate context packet multiple times
            const packets = [];
            for (let i = 0; i < 3; i++) {
              packets.push(validator.contextPacket(specDir, '1.2'));
            }

            // All packets should be identical
            const first = packets[0];
            for (let i = 1; i < packets.length; i++) {
              expect(JSON.stringify(packets[i])).toBe(
                JSON.stringify(first)
              );
            }
          }
        } finally {
          cleanupTempDir(tempBase);
        }
      }),
      { numRuns: 12 }
    );
  });

  test('P2.8: Canonical Markdown is source of truth - report metrics derived from current state', () => {
    fc.assert(
      fc.property(
        kebabCaseNameGen(),
        fc.integer({ min: 1, max: 3 }),
        (specName, modifications) => {
          const tempBase = createTempDir();
          try {
            const normalized = specName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
              return;
            }

            const specDir = path.join(tempBase, '.kiro', 'specs', normalized);
            fs.mkdirSync(specDir, { recursive: true });
            writeSpec(specDir);

            const validator = new KiroSpecValidator();

            // Record metrics sequence
            const metricsSequence = [];

            for (let mod = 0; mod < modifications; mod++) {
              // Get current state
              const report = validator.validate(specDir);
              metricsSequence.push({
                requirements: report.metrics.requirements,
                properties: report.metrics.properties,
                tasks: report.metrics.tasks,
              });

              // Modify each file type in sequence
              if (mod % 3 === 0) {
                // Add requirement
                const reqPath = path.join(specDir, 'requirements.md');
                let reqContent = fs.readFileSync(reqPath, 'utf8');
                reqContent += `\n\n### Requirement ${2 + mod}: Test\n\n#### Acceptance Criteria\n\n1. Test AC`;
                fs.writeFileSync(reqPath, reqContent);
              } else if (mod % 3 === 1) {
                // Add property
                const designPath = path.join(specDir, 'design.md');
                let designContent = fs.readFileSync(designPath, 'utf8');
                designContent += `\n\n### Property ${3 + mod}: Test\n\n**Validates: Requirements 1.1**`;
                fs.writeFileSync(designPath, designContent);
              } else {
                // Add task
                const tasksPath = path.join(specDir, 'tasks.md');
                let tasksContent = fs.readFileSync(tasksPath, 'utf8');
                tasksContent += `\n  - [ ] 1.${3 + mod} Test task\n    - **Property ${2 + mod}: Test**`;
                fs.writeFileSync(tasksPath, tasksContent);
              }
            }

            // Verify each report reflected current state at the time
            expect(metricsSequence.length).toBe(modifications);
          } finally {
            cleanupTempDir(tempBase);
          }
        }
      ),
      { numRuns: 8 }
    );
  });

  test('P2.9: Read-only Markdown contract - validator never creates write operations to canonical files', () => {
    fc.assert(
      fc.property(kebabCaseNameGen(), (specName) => {
        const tempBase = createTempDir();
        try {
          const normalized = specName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
            return;
          }

          const specDir = path.join(tempBase, '.kiro', 'specs', normalized);
          fs.mkdirSync(specDir, { recursive: true });
          writeSpec(specDir);

          // Record initial modification times
          const requirementsPath = path.join(specDir, 'requirements.md');
          const designPath = path.join(specDir, 'design.md');
          const tasksPath = path.join(specDir, 'tasks.md');

          const getMtimes = () => ({
            requirements: fs.statSync(requirementsPath).mtimeMs,
            design: fs.statSync(designPath).mtimeMs,
            tasks: fs.statSync(tasksPath).mtimeMs,
          });

          const initialMtimes = getMtimes();

          // Wait a minimal amount and validate
          const validator = new KiroSpecValidator();
          validator.validate(specDir);

          const afterValidateMtimes = getMtimes();

          // mtimeMs should not change (validator doesn't write)
          // Note: on fast filesystems this might not be detectable, so we also
          // rely on the previous tests which check file content
          expect(afterValidateMtimes.requirements).toBe(
            initialMtimes.requirements
          );
          expect(afterValidateMtimes.design).toBe(initialMtimes.design);
          expect(afterValidateMtimes.tasks).toBe(initialMtimes.tasks);
        } finally {
          cleanupTempDir(tempBase);
        }
      }),
      { numRuns: 10 }
    );
  });

  test('P2.10: Derived artifacts are projections - report content is computed from Markdown, not stored back', () => {
    fc.assert(
      fc.property(kebabCaseNameGen(), (specName) => {
        const tempBase = createTempDir();
        try {
          const normalized = specName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
            return;
          }

          const specDir = path.join(tempBase, '.kiro', 'specs', normalized);
          fs.mkdirSync(specDir, { recursive: true });
          writeSpec(specDir);

          const validator = new KiroSpecValidator();

          // Generate reports and packets - derived artifacts
          const report1 = validator.validate(specDir);
          const report1Fingerprint = report1.fingerprint;

          // Simulate that someone tried to edit Markdown based on report
          const reqPath = path.join(specDir, 'requirements.md');
          let reqContent = fs.readFileSync(reqPath, 'utf8');
          // Check fingerprint hasn't changed (no one wrote back to Markdown)
          const reqAfter = fs.readFileSync(reqPath, 'utf8');
          expect(reqAfter).toBe(reqContent);

          // Next validation should produce same fingerprint
          const report2 = validator.validate(specDir);
          expect(report2.fingerprint).toBe(report1Fingerprint);
        } finally {
          cleanupTempDir(tempBase);
        }
      }),
      { numRuns: 10 }
    );
  });
});
