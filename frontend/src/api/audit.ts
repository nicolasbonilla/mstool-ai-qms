import apiClient from './client';

export const getAuditPlan = () => apiClient.get('/audit/plan');

export const runAudit = (mode: string, target?: string) =>
  apiClient.post('/audit/run', { mode, target });

export const getAuditHistory = (limit = 20) =>
  apiClient.get('/audit/history', { params: { limit } });

export const exportAuditPDF = (mode: string) =>
  apiClient.post('/audit/export-pdf', { mode }, { responseType: 'blob' });