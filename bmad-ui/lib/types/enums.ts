export type PersonaType = 'PM' | 'ARCHITECT' | 'DEVELOPER' | 'QA' | 'SECURITY' | 'DEVOPS' | 'RELEASEMANAGER' | 'RECOVERY';

export type TaskStatus = 'todo' | 'planning' | 'architecture' | 'development' | 'qa' | 'done';

export type AgentStatus = 'idle' | 'working' | 'blocked' | 'error';

export type LogLevel = 'info' | 'warn' | 'error';

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export type InterventionAction = 'pause' | 'resume' | 'retry';

export const KANBAN_COLUMNS: { id: TaskStatus; label: string; icon: string }[] = [
  { id: 'todo', label: 'TODO', icon: '📋' },
  { id: 'planning', label: 'PLAN', icon: '📐' },
  { id: 'architecture', label: 'ARCH', icon: '🏗️' },
  { id: 'development', label: 'DEV', icon: '💻' },
  { id: 'qa', label: 'QA', icon: '✅' },
  { id: 'done', label: 'DONE', icon: '🎉' },
];

export const PERSONA_COLORS: Record<PersonaType, string> = {
  PM: '#8b5cf6',
  ARCHITECT: '#06b6d4',
  DEVELOPER: '#3b82f6',
  QA: '#10b981',
  SECURITY: '#ef4444',
  DEVOPS: '#f59e0b',
  RELEASEMANAGER: '#ec4899',
  RECOVERY: '#6366f1',
};

export const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: '#94a3b8',
  working: '#3b82f6',
  blocked: '#f59e0b',
  error: '#ef4444',
};
