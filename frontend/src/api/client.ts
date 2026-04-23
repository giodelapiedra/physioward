import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

const api = axios.create({ withCredentials: true });

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const ok = await useAuthStore.getState().refreshToken();
      if (ok) {
        const newToken = useAuthStore.getState().accessToken;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
