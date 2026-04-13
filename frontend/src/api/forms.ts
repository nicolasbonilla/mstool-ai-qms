import apiClient from './client';

export const getTemplates = () => apiClient.get('/forms/templates');
export const createForm = (templateId: string, title?: string) =>
  apiClient.post('/forms/', { template_id: templateId, title });
export const listForms = (templateId?: string, status?: string) =>
  apiClient.get('/forms/', { params: { template_id: templateId, status } });
export const getForm = (formId: string) => apiClient.get(`/forms/${formId}`);
export const updateForm = (formId: string, fields: Record<string, unknown>) =>
  apiClient.put(`/forms/${formId}`, { fields });
export const signForm = (formId: string) => apiClient.post(`/forms/${formId}/sign`);
export const approveForm = (formId: string) => apiClient.post(`/forms/${formId}/approve`);
