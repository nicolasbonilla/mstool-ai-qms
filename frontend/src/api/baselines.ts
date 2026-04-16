import apiClient from './client';

export const listBaselines = (limit = 50) =>
  apiClient.get('/baselines', { params: { limit } });

export const createBaseline = (version_tag: string, notes = '') =>
  apiClient.post('/baselines', { version_tag, notes });

export const getBaseline = (versionTag: string) =>
  apiClient.get(`/baselines/${versionTag}`);

export const signBaseline = (versionTag: string, role: string, meaning = 'approved') =>
  apiClient.post(`/baselines/${versionTag}/sign`, { role, meaning });

export const diffBaselines = (vFrom: string, vTo: string) =>
  apiClient.get(`/baselines/${vFrom}/diff/${vTo}`);
