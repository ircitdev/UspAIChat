import { create } from 'zustand';
import api from '../services/api';

interface User {
  id: string;
  email: string | null;
  username: string;
  role: 'admin' | 'user';
  is_blocked: number;
  balance: number;
  avatar?: string;
  telegram_id?: number | null;
  telegram_username?: string | null;
  created_at: number;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  loginWithApple: (idToken: string, user?: { name?: { firstName?: string; lastName?: string }; email?: string }) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<boolean>;
  clearError: () => void;
  updateBalance: (balance: number) => void;
}

function setAxiosToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('refreshToken', data.refreshToken);
      setAxiosToken(data.accessToken);
      set({ user: data.user, accessToken: data.accessToken, loading: false });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Ошибка входа';
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  register: async (email, username, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/register', { email, username, password });
      localStorage.setItem('refreshToken', data.refreshToken);
      setAxiosToken(data.accessToken);
      set({ user: data.user, accessToken: data.accessToken, loading: false });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Ошибка регистрации';
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  loginWithGoogle: async (credential) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/oauth/google', { credential });
      localStorage.setItem('refreshToken', data.refreshToken);
      setAxiosToken(data.accessToken);
      set({ user: data.user, accessToken: data.accessToken, loading: false });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Ошибка входа через Google';
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  loginWithApple: async (idToken, user) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/oauth/apple', { id_token: idToken, user });
      localStorage.setItem('refreshToken', data.refreshToken);
      setAxiosToken(data.accessToken);
      set({ user: data.user, accessToken: data.accessToken, loading: false });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Ошибка входа через Apple';
      set({ error: msg, loading: false });
      throw new Error(msg);
    }
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try { await api.post('/auth/logout', { refreshToken }); } catch {}
    localStorage.removeItem('refreshToken');
    setAxiosToken(null);
    set({ user: null, accessToken: null });
  },

  restoreSession: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;
    try {
      const { data } = await api.post('/auth/refresh', { refreshToken });
      localStorage.setItem('refreshToken', data.refreshToken);
      setAxiosToken(data.accessToken);
      set({ user: data.user, accessToken: data.accessToken });
      return true;
    } catch {
      localStorage.removeItem('refreshToken');
      return false;
    }
  },

  clearError: () => set({ error: null }),
  updateBalance: (balance: number) => set(s => s.user ? { user: { ...s.user, balance } } : {}),
}));

// Auto-refresh access token every 12 minutes
setInterval(async () => {
  const { accessToken, restoreSession } = useAuthStore.getState();
  if (accessToken) await restoreSession();
}, 12 * 60 * 1000);

export default useAuthStore;
