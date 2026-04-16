import apiClient from './client';

export const getClausePredictions = () => apiClient.get('/predict/clauses');
export const getChangeImpact = (commit_count = 5) =>
  apiClient.get('/predict/impact', { params: { commit_count } });
export const getGapExplanation = () => apiClient.get('/predict/explain');

export const getValidationDossier = () => apiClient.get('/agents/validation/dossier');
export const validateAgent = (name: string) => apiClient.post(`/agents/${name}/validate`);
