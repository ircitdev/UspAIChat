import { create } from 'zustand';

type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

function applyTheme(mode: ThemeMode) {
  const isDark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.classList.toggle('light', !isDark);
}

const stored = (localStorage.getItem('theme') as ThemeMode) || 'dark';
applyTheme(stored);

const useThemeStore = create<ThemeState>((set) => ({
  mode: stored,
  setMode: (mode: ThemeMode) => {
    localStorage.setItem('theme', mode);
    applyTheme(mode);
    set({ mode });
  },
}));

// Listen for OS theme changes when mode is 'system'
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const current = useThemeStore.getState().mode;
  if (current === 'system') {
    applyTheme('system');
  }
});

export default useThemeStore;
