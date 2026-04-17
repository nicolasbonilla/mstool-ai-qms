import apiClient from './client';

const b64 = (path: string) =>
  btoa(unescape(encodeURIComponent(path)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export const reviewDoc = (path: string, role: string, meaning = 'approved', notes = '') =>
  apiClient.post(`/docsync/${b64(path)}/review`, { role, meaning, notes });

export const listDocReviews = (path: string, limit = 50) =>
  apiClient.get(`/docsync/${b64(path)}/reviews`, { params: { limit } });

export const getDocHistory = (path: string, limit = 30) =>
  apiClient.get(`/docsync/${b64(path)}/history`, { params: { limit } });

export const getDocDiff = (path: string) =>
  apiClient.get(`/docsync/${b64(path)}/diff`);

export const getDocCompleteness = (path: string) =>
  apiClient.get(`/docsync/${b64(path)}/completeness`);

export const getDocPreview = (path: string) =>
  apiClient.get(`/docsync/${b64(path)}/preview`);

export const runDocAIDrift = (path: string) =>
  apiClient.post(`/docsync/${b64(path)}/ai-drift`);

export const draftDocUpdate = (path: string) =>
  apiClient.post(`/docsync/${b64(path)}/ai-update-draft`);

export const getDocTimeline = () =>
  apiClient.get('/docsync/timeline');

export const exportDocsCsvUrl = () => '/docsync/export';
