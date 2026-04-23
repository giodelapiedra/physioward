import { create } from 'zustand';
import axios from 'axios';
import { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null; // memory only — never localStorage
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:            null,
  accessToken:     null,
  isAuthenticated: false,
  isLoading:       true,

  login: async (email, password) => {
    const res = await axios.post('/api/auth/login', { email, password }, { withCredentials: true });
    set({
      user:            res.data.user,
      accessToken:     res.data.accessToken,
      isAuthenticated: true,
      isLoading:       false,
    });
  },

  logout: async () => {
    const token = get().accessToken;
    try {
      await axios.post('/api/auth/logout', {}, {
        headers:         { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
    } catch {}
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  refreshToken: async () => {
    try {
      const res = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
      set({
        user:            res.data.user ?? get().user,
        accessToken:     res.data.accessToken,
        isAuthenticated: true,
        isLoading:       false,
      });
      return true;
    } catch {
      set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
      return false;
    }
  },
}));
