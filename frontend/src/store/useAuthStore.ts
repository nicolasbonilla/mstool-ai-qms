import { create } from 'zustand';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import apiClient from '../api/client';

interface QMSProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  picture?: string;
}

interface AuthState {
  user: User | null;
  profile: QMSProfile | null;
  loading: boolean;
  error: string | null;

  init: () => () => void;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  error: null,

  init: () => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Set token on API client
        const token = await user.getIdToken();
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        // Register/get QMS profile
        try {
          const { data } = await apiClient.post('/users/me');
          set({ user, profile: data, loading: false, error: null });
        } catch {
          set({ user, profile: null, loading: false, error: null });
        }
      } else {
        delete apiClient.defaults.headers.common['Authorization'];
        set({ user: null, profile: null, loading: false });
      }
    });
    return unsubscribe;
  },

  loginWithEmail: async (email, password) => {
    set({ loading: true, error: null });
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      set({ loading: false, error: e.message });
    }
  },

  loginWithGoogle: async () => {
    set({ loading: true, error: null });
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      set({ loading: false, error: e.message });
    }
  },

  register: async (email, password) => {
    set({ loading: true, error: null });
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      set({ loading: false, error: e.message });
    }
  },

  logout: async () => {
    await signOut(auth);
    set({ user: null, profile: null });
  },

  clearError: () => set({ error: null }),
}));