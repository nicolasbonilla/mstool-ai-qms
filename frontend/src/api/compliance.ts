import apiClient from './client';

export const getComplianceScore = () => apiClient.get('/compliance/score');
export const getAuthCoverage = () => apiClient.get('/compliance/auth-coverage');
export const getDocuments = (standard?: string) =>
  apiClient.get('/compliance/documents', { params: standard ? { standard } : {} });
export const getTests = () => apiClient.get('/compliance/tests');
