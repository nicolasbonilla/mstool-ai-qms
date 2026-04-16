import apiClient from './client';

export const getDependencies = () => apiClient.get('/soup/dependencies');
export const getSOUPSummary = () => apiClient.get('/soup/summary');
export const scanVulnerabilities = () => apiClient.post('/soup/scan');
export const getDependencyDetail = (name: string) =>
  apiClient.get(`/soup/dependency/${name}`);

// Wave: enriched SOUP capabilities
export const getScanHistory = (limit = 30) =>
  apiClient.get('/soup/scan/history', { params: { limit } });
export const getLatestScan = () => apiClient.get('/soup/scan/latest');
export const getLatestSOUPAgentRun = () => apiClient.get('/soup/agent-run/latest');
export const getPackageAnomalies = (name: string, limit = 10) =>
  apiClient.get(`/soup/anomalies/${name}`, { params: { limit } });
export const getUnpinnedClassC = () => apiClient.get('/soup/unpinned-class-c');
export const generateReviewDrafts = () =>
  apiClient.post('/soup/review-drafts/generate');
export const generateReviewDraftFor = (name: string) =>
  apiClient.post(`/soup/review-drafts/single/${name}`);
export const listReviewDrafts = (limit = 100) =>
  apiClient.get('/soup/review-drafts', { params: { limit } });

// Direct SBOM download (browser handles binary blob)
export const sbomDownloadUrl = () => '/soup/sbom';
