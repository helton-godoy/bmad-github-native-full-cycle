import { create } from 'zustand';
import type { Task, ExecutionLog } from '../types/schema';
import type { TaskStatus } from '../types/enums';

interface TaskStore {
  tasks: Map<number, Task>;
  activeTaskId: number | null;
  cotBuffers: Map<number, string[]>;
  logBuffers: Map<number, ExecutionLog[]>;
  
  // Actions
  setTasks: (tasks: Task[]) => void;
  updateTask: (id: number, updates: Partial<Task>) => void;
  setActiveTask: (id: number | null) => void;
  appendCoT: (taskId: number, line: string) => void;
  appendLog: (taskId: number, log: ExecutionLog) => void;
  moveTask: (taskId: number, newStatus: TaskStatus) => void;
  clearCoTBuffer: (taskId: number) => void;
  clearLogBuffer: (taskId: number) => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: new Map(),
  activeTaskId: null,
  cotBuffers: new Map(),
  logBuffers: new Map(),
  
  setTasks: (tasks) => set((state) => {
    const taskMap = new Map(state.tasks);
    tasks.forEach(task => taskMap.set(task.id, task));
    return { tasks: taskMap };
  }),
  
  updateTask: (id, updates) => set((state) => {
    const taskMap = new Map(state.tasks);
    const task = taskMap.get(id);
    if (task) {
      taskMap.set(id, { ...task, ...updates });
    }
    return { tasks: taskMap };
  }),
  
  setActiveTask: (id) => set({ activeTaskId: id }),
  
  appendCoT: (taskId, line) => set((state) => {
    const cotBuffers = new Map(state.cotBuffers);
    const buffer = cotBuffers.get(taskId) || [];
    cotBuffers.set(taskId, [...buffer, line]);
    return { cotBuffers };
  }),
  
  appendLog: (taskId, log) => set((state) => {
    const logBuffers = new Map(state.logBuffers);
    const buffer = logBuffers.get(taskId) || [];
    logBuffers.set(taskId, [...buffer, log]);
    return { logBuffers };
  }),
  
  moveTask: (taskId, newStatus) => set((state) => {
    const taskMap = new Map(state.tasks);
    const task = taskMap.get(taskId);
    if (task) {
      taskMap.set(taskId, { ...task, status: newStatus, updatedAt: new Date().toISOString() });
    }
    return { tasks: taskMap };
  }),
  
  clearCoTBuffer: (taskId) => set((state) => {
    const cotBuffers = new Map(state.cotBuffers);
    cotBuffers.delete(taskId);
    return { cotBuffers };
  }),
  
  clearLogBuffer: (taskId) => set((state) => {
    const logBuffers = new Map(state.logBuffers);
    logBuffers.delete(taskId);
    return { logBuffers };
  }),
}));
