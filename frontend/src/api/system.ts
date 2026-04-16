import apiClient from './client';

export const getSystemHealth = () => apiClient.get('/system/health');
export const verifyLedger = (limit = 500) => apiClient.get('/system/ledger/verify', { params: { limit } });
export const triggerSnapshot = () => apiClient.post('/system/snapshot/trigger');
export const listAlerts = (onlyOpen = true) => apiClient.get('/system/alerts', { params: { only_open: onlyOpen } });
export const acknowledgeAlert = (alertId: string) => apiClient.post(`/system/alerts/${alertId}/acknowledge`);
