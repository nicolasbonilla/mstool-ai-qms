import apiClient from './client';

export const getClausePredictions = () => apiClient.get('/predict/clauses');
export const getChangeImpact = (commit_count = 5) =>
  apiClient.get('/predict/impact', { params: { commit_count } });
export const getGapExplanation = () => apiClient.get('/predict/explain');

export const getValidationDossier = () => apiClient.get('/agents/validation/dossier');
export const validateAgent = (name: string) => apiClient.post(`/agents/${name}/validate`);

export const getSuspectLinks = () => apiClient.get('/predict/suspect-links');
export const getMissingLinks = (top_k = 25, min_score = 0.18) =>
  apiClient.get('/predict/missing-links', { params: { top_k, min_score } });
export const getSamdScan = () => apiClient.get('/predict/samd-scan');
