import apiClient from './client';

export const analyzeAudit = (auditResult: any) =>
  apiClient.post('/ai/analyze-audit', { audit_result: auditResult });

export const autofillForm = (templateId: string, context?: any) =>
  apiClient.post('/ai/autofill', { template_id: templateId, context });

export const generateCAPA = (description: string, module?: string, requirements?: string) =>
  apiClient.post('/ai/generate-capa', {
    problem_description: description,
    affected_module: module || '',
    affected_requirements: requirements || '',
  });

export const reviewCode = (filePath: string) =>
  apiClient.post('/ai/review-code', { file_path: filePath });

export const detectRisks = () =>
  apiClient.get('/ai/detect-risks');

export const aiChat = (message: string, context?: any) =>
  apiClient.post('/ai/chat', { message, context });