import apiClient from './client';

export interface AgentMeta {
  name: string;
  description: string;
  tier: 'haiku' | 'sonnet' | 'opus';
  model: string;
  requires_signoff_default: boolean;
}

export const listAgents = () => apiClient.get<{ agents: AgentMeta[] }>('/agents');

export const invokeAgent = (name: string, context: Record<string, any> = {}) =>
  apiClient.post(`/agents/${name}/invoke`, { context });

export const listAgentRuns = (name: string, limit = 20) =>
  apiClient.get(`/agents/${name}/runs`, { params: { limit } });

export const getAgentRun = (runId: string) =>
  apiClient.get(`/agents/runs/${runId}`);

export const approveAgentRun = (runId: string, notes = '') =>
  apiClient.post(`/agents/runs/${runId}/approve`, { notes });
