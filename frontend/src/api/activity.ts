import apiClient from './client';

export const getActivityFeed = (params: { limit?: number; resource_type?: string; action?: string; user_uid?: string; days?: number } = {}) =>
  apiClient.get('/activity/feed', { params });

export const getActivitySummary = (days = 7) =>
  apiClient.get('/activity/summary', { params: { days } });
