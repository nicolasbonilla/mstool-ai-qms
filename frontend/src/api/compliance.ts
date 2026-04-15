import apiClient from './client';

export const getComplianceScore = () => apiClient.get('/compliance/score');
export const getDetailedScore = () => apiClient.get('/compliance/score-detailed');
export const getAuthCoverage = () => apiClient.get('/compliance/auth-coverage');
export const getDocuments = (standard?: string) =>
  apiClient.get('/compliance/documents', { params: standard ? { standard } : {} });
export const getTests = () => apiClient.get('/compliance/tests');
export const getCommits = (count = 30) => apiClient.get('/compliance/commits', { params: { count } });
export const getPullRequests = (state = 'all', count = 30) =>
  apiClient.get('/compliance/pull-requests', { params: { state, count } });
export const getCIRuns = (count = 10) => apiClient.get('/compliance/ci-runs', { params: { count } });
export const getTraceabilityGraph = () => apiClient.get('/compliance/traceability');
export const getCheckEvidence = (checkId: string) => apiClient.get(`/compliance/check/${checkId}/evidence`);