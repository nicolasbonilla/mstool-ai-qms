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

// New endpoints (Wave 5+)
export const listSkills = () => apiClient.get('/agents/skills');
export const getSkillContent = (name: string) =>
  apiClient.get(`/agents/skills/${name}`);
export const runCanary = () => apiClient.post('/agents/validation/canary-run');
export const getDriftHistory = (agent_name?: string, limit = 50) =>
  apiClient.get('/agents/validation/drift-history',
    { params: agent_name ? { agent_name, limit } : { limit } });
export const generatePCCP = () => apiClient.post('/agents/validation/pccp');

// MCP gateway
export const listMcpTools = () => apiClient.get('/mcp/tools');

// Baseline signature verification
export const verifyBaselineSignatures = (versionTag: string) =>
  apiClient.get(`/baselines/${versionTag}/verify-signatures`);

// System usage / scheduler
export const getSystemUsage = () => apiClient.get('/system/usage');
export const getSchedulerStatus = () => apiClient.get('/system/scheduler/status');
