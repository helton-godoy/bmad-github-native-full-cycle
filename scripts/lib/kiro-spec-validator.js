'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REQUIRED_FILES = ['requirements.md', 'design.md', 'tasks.md'];
const PLACEHOLDER_PATTERN =
  /(?:\{\{[^}]+\}\}|\[(?:todo|tbd|add |describe |placeholder)[^\]]*\]|\b(?:TODO|TBD)\b)/i;

function refs(value) {
  return [...new Set((value || '').match(/\d+\.\d+/g) || [])];
}

function propertyRefs(value) {
  return [
    ...new Set(
      (value || '')
        .match(/Property\s+(\d+)/gi)
        ?.map((item) => item.match(/\d+/)[0]) || []
    ),
  ];
}

class KiroSpecValidator {
  constructor(options = {}) {
    this.strict = options.strict !== false;
  }

  load(specDir) {
    const absoluteDir = path.resolve(specDir);
    const missing = REQUIRED_FILES.filter(
      (name) => !fs.existsSync(path.join(absoluteDir, name))
    );
    if (missing.length) {
      return {
        dir: absoluteDir,
        missing,
        requirements: [],
        properties: [],
        tasks: [],
        contents: {},
      };
    }

    const contents = Object.fromEntries(
      REQUIRED_FILES.map((name) => [
        name,
        fs.readFileSync(path.join(absoluteDir, name), 'utf8'),
      ])
    );
    return {
      dir: absoluteDir,
      missing: [],
      contents,
      requirements: this.parseRequirements(contents['requirements.md']),
      properties: this.parseProperties(contents['design.md']),
      tasks: this.parseTasks(contents['tasks.md']),
    };
  }

  parseRequirements(content) {
    const lines = content.split(/\r?\n/);
    const requirements = [];
    for (let i = 0; i < lines.length; i += 1) {
      const match = lines[i].match(
        /^### Requirement\s+(\d+)(?::\s*(.+))?\s*$/i
      );
      if (!match) continue;
      const requirement = {
        id: match[1],
        title: (match[2] || `Requirement ${match[1]}`).trim(),
        criteria: [],
        line: i + 1,
      };
      let inCriteria = false;
      for (
        let j = i + 1;
        j < lines.length && !/^###\s/.test(lines[j]);
        j += 1
      ) {
        if (/^#### Acceptance Criteria/i.test(lines[j])) inCriteria = true;
        const criterion = inCriteria && lines[j].match(/^\s*(\d+)\.\s+(.+)$/);
        if (criterion) {
          requirement.criteria.push({
            id: `${requirement.id}.${criterion[1]}`,
            text: criterion[2].trim(),
            line: j + 1,
          });
        }
      }
      requirements.push(requirement);
    }
    return requirements;
  }

  parseProperties(content) {
    const lines = content.split(/\r?\n/);
    const properties = [];
    for (let i = 0; i < lines.length; i += 1) {
      const match = lines[i].match(
        /^(?:###\s+)?\*{0,2}Property\s+(\d+)(?::\s*(.+?))?\*{0,2}\s*$/i
      );
      if (!match) continue;
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j += 1) {
        if (
          /^(?:###\s+)?\*{0,2}Property\s+\d+/i.test(lines[j]) ||
          /^##\s+/.test(lines[j])
        ) {
          end = j;
          break;
        }
      }
      const body = lines
        .slice(i + 1, end)
        .join('\n')
        .trim();
      properties.push({
        id: match[1],
        title: (match[2] || `Property ${match[1]}`).trim(),
        requirements: refs(
          body.match(/\*\*Validates:\s*Requirements?([^*]+)\*\*/i)?.[1]
        ),
        body,
        line: i + 1,
      });
    }
    return properties;
  }

  parseTasks(content) {
    const lines = content.split(/\r?\n/);
    const tasks = [];
    for (let i = 0; i < lines.length; i += 1) {
      const match = lines[i].match(
        /^(\s*)- \[([ xX])\](\*)?\s+(\d+(?:\.\d+)*)(?:\.)?\s+(.+)$/
      );
      if (!match) continue;
      const indent = match[1].length;
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j += 1) {
        const next = lines[j].match(
          /^(\s*)- \[[ xX]\](?:\*)?\s+\d+(?:\.\d+)*(?:\.)?\s+/
        );
        if (next || /^#{1,3}\s/.test(lines[j])) {
          end = j;
          break;
        }
      }
      const body = lines.slice(i + 1, end).join('\n');
      const reqLine = body.match(/_Requirements?:\s*([^_]+)_/i)?.[1] || '';
      const validates =
        body.match(/\*\*Validates:\s*Requirements?([^*]+)\*\*/i)?.[1] || '';
      const depends = body.match(/_Depends on:\s*([^_]+)_/i)?.[1] || '';
      tasks.push({
        id: match[4],
        title: match[5].trim(),
        complete: match[2].toLowerCase() === 'x',
        optional: Boolean(match[3]),
        indent,
        requirements: refs(`${reqLine},${validates}`),
        properties: propertyRefs(body),
        dependsOn: [...new Set(depends.match(/\d+(?:\.\d+)*/g) || [])],
        body,
        line: i + 1,
      });
    }
    return tasks;
  }

  validate(specDir) {
    const model = this.load(specDir);
    const errors = [];
    const warnings = [];
    const add = (target, code, message, file, line, subject) =>
      target.push({ code, message, file, line, subject });

    for (const file of model.missing)
      add(
        errors,
        'SPEC_FILE_MISSING',
        `Required Kiro file is missing: ${file}`,
        file
      );
    if (model.missing.length) return this.report(model, errors, warnings);

    for (const [name, content] of Object.entries(model.contents)) {
      if (!content.trim())
        add(errors, 'SPEC_FILE_EMPTY', `${name} is empty`, name);
      if (PLACEHOLDER_PATTERN.test(content))
        add(
          errors,
          'UNRESOLVED_PLACEHOLDER',
          `${name} contains an unresolved placeholder`,
          name
        );
    }

    if (!model.requirements.length)
      add(
        errors,
        'NO_REQUIREMENTS',
        'No Kiro Requirement headings were found',
        'requirements.md'
      );
    if (!model.properties.length)
      add(
        errors,
        'NO_PROPERTIES',
        'No correctness properties were found',
        'design.md'
      );
    if (!model.tasks.length)
      add(errors, 'NO_TASKS', 'No Kiro checkbox tasks were found', 'tasks.md');

    const criteria = new Map(
      model.requirements.flatMap((r) => r.criteria.map((c) => [c.id, c]))
    );
    const propertyIds = new Set(model.properties.map((p) => p.id));
    const taskIds = new Set();

    for (const requirement of model.requirements) {
      if (!requirement.criteria.length)
        add(
          errors,
          'REQUIREMENT_WITHOUT_AC',
          `Requirement ${requirement.id} has no acceptance criteria`,
          'requirements.md',
          requirement.line,
          requirement.id
        );
      for (const criterion of requirement.criteria) {
        if (!/(WHEN|IF|WHERE|WHILE|THE\s+\w+\s+SHALL)/i.test(criterion.text)) {
          add(
            warnings,
            'AC_NOT_EARS',
            `Acceptance criterion ${criterion.id} is not recognizably EARS-formatted`,
            'requirements.md',
            criterion.line,
            criterion.id
          );
        }
      }
    }

    for (const property of model.properties) {
      if (!property.requirements.length)
        add(
          errors,
          'PROPERTY_WITHOUT_REQUIREMENT',
          `Property ${property.id} has no requirement trace`,
          'design.md',
          property.line,
          property.id
        );
      for (const ref of property.requirements)
        if (!criteria.has(ref))
          add(
            errors,
            'UNKNOWN_REQUIREMENT_REF',
            `Property ${property.id} references unknown criterion ${ref}`,
            'design.md',
            property.line,
            property.id
          );
    }

    for (const task of model.tasks) {
      if (taskIds.has(task.id))
        add(
          errors,
          'DUPLICATE_TASK_ID',
          `Task id ${task.id} is duplicated`,
          'tasks.md',
          task.line,
          task.id
        );
      taskIds.add(task.id);
      if (!task.requirements.length && !/\bcheckpoint\b/i.test(task.title))
        add(
          errors,
          'TASK_WITHOUT_REQUIREMENT',
          `Task ${task.id} has no requirement trace`,
          'tasks.md',
          task.line,
          task.id
        );
      for (const ref of task.requirements)
        if (!criteria.has(ref))
          add(
            errors,
            'UNKNOWN_REQUIREMENT_REF',
            `Task ${task.id} references unknown criterion ${ref}`,
            'tasks.md',
            task.line,
            task.id
          );
      for (const ref of task.properties)
        if (!propertyIds.has(ref))
          add(
            errors,
            'UNKNOWN_PROPERTY_REF',
            `Task ${task.id} references unknown Property ${ref}`,
            'tasks.md',
            task.line,
            task.id
          );
      if (
        task.optional &&
        /(test|verify|validation|security|migration|rollback)/i.test(task.title)
      ) {
        add(
          this.strict ? errors : warnings,
          'CRITICAL_TASK_OPTIONAL',
          `Quality-critical task ${task.id} must not be optional`,
          'tasks.md',
          task.line,
          task.id
        );
      }
    }

    for (const task of model.tasks) {
      for (const dependency of task.dependsOn) {
        if (!taskIds.has(dependency))
          add(
            errors,
            'UNKNOWN_DEPENDENCY',
            `Task ${task.id} depends on unknown task ${dependency}`,
            'tasks.md',
            task.line,
            task.id
          );
        if (dependency === task.id)
          add(
            errors,
            'SELF_DEPENDENCY',
            `Task ${task.id} depends on itself`,
            'tasks.md',
            task.line,
            task.id
          );
      }
      const children = model.tasks.filter(
        (candidate) =>
          candidate.id.startsWith(`${task.id}.`) &&
          candidate.id.split('.').length === task.id.split('.').length + 1
      );
      const requiredChildren = children.filter((child) => !child.optional);
      if (
        requiredChildren.length &&
        task.complete !== requiredChildren.every((child) => child.complete)
      ) {
        add(
          errors,
          'PARENT_STATUS_MISMATCH',
          `Task ${task.id} status disagrees with its required direct children`,
          'tasks.md',
          task.line,
          task.id
        );
      }
    }

    const cycle = this.findCycle(model.tasks);
    if (cycle)
      add(
        errors,
        'DEPENDENCY_CYCLE',
        `Task dependency cycle: ${cycle.join(' -> ')}`,
        'tasks.md',
        undefined,
        cycle[0]
      );

    for (const criterion of criteria.values()) {
      if (!model.tasks.some((task) => task.requirements.includes(criterion.id)))
        add(
          errors,
          'UNCOVERED_ACCEPTANCE_CRITERION',
          `Acceptance criterion ${criterion.id} has no task`,
          'tasks.md',
          undefined,
          criterion.id
        );
    }
    for (const property of model.properties) {
      if (
        !model.tasks.some(
          (task) =>
            task.properties.includes(property.id) &&
            /(test|verify|validation)/i.test(task.title)
        )
      ) {
        add(
          errors,
          'PROPERTY_WITHOUT_TEST',
          `Property ${property.id} has no explicit verification task`,
          'tasks.md',
          undefined,
          property.id
        );
      }
    }

    return this.report(model, errors, warnings);
  }

  findCycle(tasks) {
    const graph = new Map(tasks.map((task) => [task.id, task.dependsOn]));
    const visiting = new Set();
    const visited = new Set();
    const walk = (id, trail) => {
      if (visiting.has(id)) return [...trail.slice(trail.indexOf(id)), id];
      if (visited.has(id)) return null;
      visiting.add(id);
      for (const next of graph.get(id) || []) {
        const found = walk(next, [...trail, next]);
        if (found) return found;
      }
      visiting.delete(id);
      visited.add(id);
      return null;
    };
    for (const id of graph.keys()) {
      const found = walk(id, [id]);
      if (found) return found;
    }
    return null;
  }

  report(model, errors, warnings) {
    const totalCriteria = model.requirements.reduce(
      (sum, item) => sum + item.criteria.length,
      0
    );
    const coveredCriteria = new Set(
      model.tasks.flatMap((task) => task.requirements)
    ).size;
    return {
      valid: errors.length === 0,
      specDir: model.dir,
      errors,
      warnings,
      metrics: {
        requirements: model.requirements.length,
        acceptanceCriteria: totalCriteria,
        properties: model.properties.length,
        tasks: model.tasks.length,
        completedTasks: model.tasks.filter((task) => task.complete).length,
        traceCoveragePercent: totalCriteria
          ? Math.round((coveredCriteria / totalCriteria) * 10000) / 100
          : 0,
      },
      fingerprint: crypto
        .createHash('sha256')
        .update(
          REQUIRED_FILES.map((name) => model.contents[name] || '').join('\n')
        )
        .digest('hex'),
      model,
    };
  }

  contextPacket(specDir, taskId) {
    const report = this.validate(specDir);
    if (!report.valid)
      throw new Error('Cannot create context from an invalid spec');
    const task = report.model.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    const requirements = report.model.requirements.flatMap((requirement) =>
      requirement.criteria.filter((criterion) =>
        task.requirements.includes(criterion.id)
      )
    );
    const properties = report.model.properties.filter(
      (property) =>
        task.properties.includes(property.id) ||
        property.requirements.some((ref) => task.requirements.includes(ref))
    );
    return {
      schemaVersion: 1,
      fingerprint: report.fingerprint,
      task,
      requirements,
      properties: properties.map(
        ({ id, title, requirements: propertyRequirements, body }) => ({
          id,
          title,
          requirements: propertyRequirements,
          body,
        })
      ),
      dependencies: report.model.tasks
        .filter((item) => task.dependsOn.includes(item.id))
        .map(({ id, title, complete }) => ({ id, title, complete })),
      deterministicInstructions: [
        'Implement only this task and its traced acceptance criteria.',
        'Do not mark complete until every traced criterion and property passes.',
        'Preserve behavior outside the traced scope.',
        'Return changed files, commands run, and objective evidence.',
      ],
    };
  }
}

module.exports = KiroSpecValidator;
module.exports.REQUIRED_FILES = REQUIRED_FILES;
