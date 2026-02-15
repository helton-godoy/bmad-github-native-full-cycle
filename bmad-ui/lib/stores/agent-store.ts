import { create } from 'zustand';
import type { Agent, SystemHealth } from '../types/schema';

interface AgentStore {
  agents: Map<string, Agent>;
  systemHealth: SystemHealth | null;
  
  // Actions
  setAgents: (agents: Agent[]) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  setSystemHealth: (health: SystemHealth) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: new Map(),
  systemHealth: null,
  
  setAgents: (agents) => set((state) => {
    const agentMap = new Map(state.agents);
    agents.forEach(agent => agentMap.set(agent.id, agent));
    return { agents: agentMap };
  }),
  
  updateAgent: (id, updates) => set((state) => {
    const agentMap = new Map(state.agents);
    const agent = agentMap.get(id);
    if (agent) {
      agentMap.set(id, { ...agent, ...updates });
    }
    return { agents: agentMap };
  }),
  
  setSystemHealth: (health) => set({ systemHealth: health }),
}));
