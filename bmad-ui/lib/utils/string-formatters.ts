import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PersonaType, TaskStatus, Priority } from '../types/enums';

export const formatTimestamp = (isoString: string): string => {
  return format(new Date(isoString), 'HH:mm:ss', { locale: ptBR });
};

export const formatDate = (isoString: string): string => {
  return format(new Date(isoString), 'dd/MM/yyyy', { locale: ptBR });
};

export const formatElapsedTime = (milliseconds: number): string => {
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export const formatRelativeTime = (isoString: string): string => {
  return formatDistanceToNow(new Date(isoString), {
    addSuffix: true,
    locale: ptBR,
  });
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

export const formatLinesOfCode = (lines: number): string => {
  if (lines < 1000) return `${lines} lines`;
  return `${(lines / 1000).toFixed(1)}k lines`;
};

export const getPersonaLabel = (persona: PersonaType): string => {
  const labels: Record<PersonaType, string> = {
    PM: 'Product Manager',
    ARCHITECT: 'Architect',
    DEVELOPER: 'Developer',
    QA: 'QA Tester',
    SECURITY: 'Security',
    DEVOPS: 'DevOps',
    RELEASEMANAGER: 'Release Manager',
    RECOVERY: 'Recovery',
  };
  return labels[persona] || persona;
};

export const getPersonaIcon = (persona: PersonaType): string => {
  const icons: Record<PersonaType, string> = {
    PM: '📋',
    ARCHITECT: '📐',
    DEVELOPER: '💻',
    QA: '✅',
    SECURITY: '🔒',
    DEVOPS: '⚙️',
    RELEASEMANAGER: '🚀',
    RECOVERY: '🔧',
  };
  return icons[persona] || '❓';
};

export const getStatusLabel = (status: TaskStatus): string => {
  const labels: Record<TaskStatus, string> = {
    todo: 'To Do',
    planning: 'Planning',
    architecture: 'Architecture',
    development: 'Development',
    qa: 'QA Testing',
    done: 'Completed',
  };
  return labels[status] || status;
};

export const getPriorityBadgeText = (priority: Priority): string => {
  const texts: Record<Priority, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'CRITICAL',
  };
  return texts[priority] || priority;
};
