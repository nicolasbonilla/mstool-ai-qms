import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  set: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => {
  // Initialize from localStorage or system preference
  const stored = localStorage.getItem('qms-theme') as Theme | null;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial: Theme = stored || (systemDark ? 'dark' : 'light');

  // Apply immediately
  document.documentElement.setAttribute('data-theme', initial);

  return {
    theme: initial,

    toggle: () => set((state) => {
      const next: Theme = state.theme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('qms-theme', next);
      return { theme: next };
    }),

    set: (theme: Theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('qms-theme', theme);
      set({ theme });
    },
  };
});
