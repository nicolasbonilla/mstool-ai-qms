import axios from 'axios';
import { auth } from '../lib/firebase';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const apiClient = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Automatically refresh token on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry && auth.currentUser) {
      originalRequest._retry = true;
      const token = await auth.currentUser.getIdToken(true);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      originalRequest.headers['Authorization'] = `Bearer ${token}`;
      return apiClient(originalRequest);
    }
    return Promise.reject(error);
  },
);

export default apiClient;