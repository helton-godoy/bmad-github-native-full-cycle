import type { Task, Agent, SystemHealth, Sprint } from '../types/schema';
import type { PersonaType, TaskStatus, AgentStatus, Priority } from '../types/enums';

// Mock Tasks
export const mockTasks: Task[] = [
  {
    id: 42,
    title: 'Implement Authentication Service',
    description: 'Create JWT-based authentication service with token refresh',
    status: 'development',
    persona: 'DEVELOPER',
    priority: 'high',
    assignedAgent: 'DEVELOPER',
    createdAt: '2026-02-15T08:00:00Z',
    updatedAt: '2026-02-15T10:30:00Z',
    elapsedTime: 9000000, // 2.5 hours
    dependencies: [38, 39],
    artifacts: [
      {
        id: 'art-1',
        type: 'file',
        name: 'auth.service.ts',
        path: 'src/services/auth.service.ts',
        size: 12800,
        linesOfCode: 240,
      },
      {
        id: 'art-2',
        type: 'file',
        name: 'auth.test.ts',
        path: 'src/services/auth.test.ts',
        size: 8600,
        linesOfCode: 156,
      },
    ],
    blockers: [],
    workflowId: 'wf-2026-001',
    issueNumber: 42,
  },
  {
    id: 38,
    title: 'Design Authentication Architecture',
    description: 'Define auth flow and security requirements',
    status: 'done',
    persona: 'ARCHITECT',
    priority: 'high',
    assignedAgent: 'ARCHITECT',
    createdAt: '2026-02-14T14:00:00Z',
    updatedAt: '2026-02-15T08:00:00Z',
    elapsedTime: 64800000,
    dependencies: [],
    artifacts: [
      {
        id: 'art-3',
        type: 'document',
        name: 'auth-spec.md',
        path: 'docs/architecture/auth-spec.md',
        size: 15200,
      },
    ],
    blockers: [],
    workflowId: 'wf-2026-001',
    issueNumber: 38,
  },
  {
    id: 45,
    title: 'QA Testing - Auth Flow',
    description: 'Test authentication endpoints and edge cases',
    status: 'qa',
    persona: 'QA',
    priority: 'high',
    assignedAgent: 'QA',
    createdAt: '2026-02-15T11:00:00Z',
    updatedAt: '2026-02-15T11:30:00Z',
    elapsedTime: 1800000,
    dependencies: [42],
    artifacts: [],
    blockers: ['Waiting for DEV task #42 to complete'],
    workflowId: 'wf-2026-001',
    issueNumber: 45,
  },
  {
    id: 50,
    title: 'Setup CI/CD Pipeline',
    description: 'Configure GitHub Actions for automated testing and deployment',
    status: 'planning',
    persona: 'DEVOPS',
    priority: 'medium',
    assignedAgent: 'DEVOPS',
    createdAt: '2026-02-15T09:00:00Z',
    updatedAt: '2026-02-15T09:15:00Z',
    elapsedTime: 900000,
    dependencies: [],
    artifacts: [],
    blockers: [],
    workflowId: 'wf-2026-002',
    issueNumber: 50,
  },
];

// Mock Agents
export const mockAgents: Agent[] = [
  {
    id: 'agent-pm',
    persona: 'PM',
    status: 'idle',
    currentTaskId: null,
    activeTime: 0,
    lastAction: 'Created PRD for Sprint 1',
    lastActionTime: '2026-02-15T08:00:00Z',
  },
  {
    id: 'agent-architect',
    persona: 'ARCHITECT',
    status: 'idle',
    currentTaskId: null,
    activeTime: 0,
    lastAction: 'Completed architecture spec',
    lastActionTime: '2026-02-15T08:00:00Z',
  },
  {
    id: 'agent-developer',
    persona: 'DEVELOPER',
    status: 'working',
    currentTaskId: 42,
    activeTime: 9000000,
    lastAction: 'Implementing JWT validation',
    lastActionTime: '2026-02-15T10:30:00Z',
  },
  {
    id: 'agent-qa',
    persona: 'QA',
    status: 'blocked',
    currentTaskId: 45,
    activeTime: 1800000,
    lastAction: 'Waiting for dependencies',
    lastActionTime: '2026-02-15T11:30:00Z',
  },
  {
    id: 'agent-security',
    persona: 'SECURITY',
    status: 'idle',
    currentTaskId: null,
    activeTime: 0,
    lastAction: 'Completed security audit',
    lastActionTime: '2026-02-14T16:00:00Z',
  },
  {
    id: 'agent-devops',
    persona: 'DEVOPS',
    status: 'working',
    currentTaskId: 50,
    activeTime: 900000,
    lastAction: 'Configuring GitHub Actions',
    lastActionTime: '2026-02-15T09:15:00Z',
  },
];

// Mock System Health
export const mockSystemHealth: SystemHealth = {
  apiLatency: 12,
  dbStatus: 'ready',
  queueUsage: 75,
  activeWorkflows: 2,
  completedToday: 8,
};

// Mock Sprint
export const mockSprint: Sprint = {
  id: 'sprint-1',
  name: 'Sprint 1 - Authentication & CI/CD',
  startDate: '2026-02-14T00:00:00Z',
  endDate: '2026-02-28T23:59:59Z',
  status: 'active',
  taskCount: 12,
};

// Mock Chain of Thought lines
export const mockCoTLines = [
  '> Analyzing requirements from PRD...',
  '> Identified need for JWT-based auth',
  '> Creating auth.service.ts file',
  '> Implementing token generation logic',
  '> Adding token validation middleware',
  '> Implementing refresh token rotation',
  '> Running unit tests... 8/10 passed ✅',
  '> Fixing failing test cases...',
  '> All tests passing ✅',
  '> Code ready for review',
];

// Mock Execution Logs
export const mockExecutionLogs = [
  {
    timestamp: '2026-02-15T08:05:00Z',
    level: 'info' as const,
    message: 'Started implementation of auth service',
    taskId: 42,
    source: 'developer-agent',
  },
  {
    timestamp: '2026-02-15T08:15:30Z',
    level: 'info' as const,
    message: 'Created file: src/services/auth.service.ts',
    taskId: 42,
    source: 'developer-agent',
  },
  {
    timestamp: '2026-02-15T09:45:12Z',
    level: 'warn' as const,
    message: 'Deprecation warning: jwt.verify() options parameter',
    taskId: 42,
    source: 'eslint',
  },
  {
    timestamp: '2026-02-15T10:20:45Z',
    level: 'info' as const,
    message: 'Running test suite: auth.test.ts',
    taskId: 42,
    source: 'jest',
  },
  {
    timestamp: '2026-02-15T10:21:02Z',
    level: 'error' as const,
    message: 'Test failed: should handle expired tokens - Expected 401, got 500',
    taskId: 42,
    source: 'jest',
  },
  {
    timestamp: '2026-02-15T10:28:30Z',
    level: 'info' as const,
    message: 'All tests passed (10/10) ✅',
    taskId: 42,
    source: 'jest',
  },
];
