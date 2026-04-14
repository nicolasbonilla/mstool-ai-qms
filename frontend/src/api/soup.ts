import apiClient from './client';

export const getDependencies = () => apiClient.get('/soup/dependencies');
export const getSOUPSummary = () => apiClient.get('/soup/summary');
export const scanVulnerabilities = () => apiClient.post('/soup/scan');
export const getDependencyDetail = (name: string) => apiClient.get(`/soup/dependency/${name}`);