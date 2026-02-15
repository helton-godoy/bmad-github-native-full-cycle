import type { PersonaType, TaskStatus, AgentStatus, LogLevel, Priority } from './enums';

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  persona: PersonaType;
  priority: Priority;
  assignedAgent: PersonaType;
  createdAt: string;
  updatedAt: string;
  elapsedTime: number; // milliseconds
  dependencies: number[]; // array of task IDs
  artifacts: Artifact[];
  blockers: string[];
  workflowId: string;
  issueNumber: number;
}

export interface Agent {
  id: string;
  persona: PersonaType;
  status: AgentStatus;
  currentTaskId: number | null;
  activeTime: number; // milliseconds since became active
  lastAction: string;
  lastActionTime: string;
}

export interface ChainOfThoughtEntry {
  timestamp: string;
  content: string;
  taskId: number;
}

export interface ExecutionLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  taskId: number;
  source?: string;
}

export interface Artifact {
  id: string;
  type: 'file' | 'document' | 'report';
  name: string;
  path: string;
  size: number; // bytes
  linesOfCode?: number;
}

export interface SystemHealth {
  apiLatency: number; // ms
  dbStatus: 'ready' | 'degraded' | 'down';
  queueUsage: number; // percentage 0-100
  activeWorkflows: number;
  completedToday: number;
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'planned';
  taskCount: number;
}
