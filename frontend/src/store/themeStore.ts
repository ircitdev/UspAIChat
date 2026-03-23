import { create } from 'zustand';

type ThemeMode = 'dark' | 'light' | 'system';

export interface AccentColor {
  id: string;
  name: string;
  value: string;
  light: string;
  dark: string;
  muted: string;
}

export const ACCENT_COLORS: AccentColor[] = [
  { id: 'violet',  name: 'Фиолетовый', value: '#7c3aed', light: '#a78bfa', dark: '#6d28d9', muted: 'rgba(124,58,237,0.15)' },
  { id: 'blue',    name: 'Синий',       value: '#2563eb', light: '#60a5fa', dark: '#1d4ed8', muted: 'rgba(37,99,235,0.15)' },
  { id: 'emerald', name: 'Изумрудный',  value: '#059669', light: '#34d399', dark: '#047857', muted: 'rgba(5,150,105,0.15)' },
  { id: 'rose',    name: 'Розовый',     value: '#e11d48', light: '#fb7185', dark: '#be123c', muted: 'rgba(225,29,72,0.15)' },
  { id: 'amber',   name: 'Янтарный',    value: '#d97706', light: '#fbbf24', dark: '#b45309', muted: 'rgba(217,119,6,0.15)' },
  { id: 'cyan',    name: 'Бирюзовый',   value: '#0891b2', light: '#22d3ee', dark: '#0e7490', muted: 'rgba(8,145,178,0.15)' },
  { id: 'indigo',  name: 'Индиго',      value: '#4f46e5', light: '#818cf8', dark: '#4338ca', muted: 'rgba(79,70,229,0.15)' },
  { id: 'pink',    name: 'Пурпурный',   value: '#c026d3', light: '#e879f9', dark: '#a21caf', muted: 'rgba(192,38,211,0.15)' },
];

interface ThemeState {
  mode: ThemeMode;
  accentId: string;
  setMode: (mode: ThemeMode) => void;
  setAccent: (id: string) => void;
}

function applyTheme(mode: ThemeMode) {
  const isDark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.classList.toggle('light', !isDark);
}

function applyAccent(id: string) {
  const color = ACCENT_COLORS.find(c => c.id === id) || ACCENT_COLORS[0];
  const root = document.documentElement;
  root.style.setProperty('--accent', color.value);
  root.style.setProperty('--accent-light', color.light);
  root.style.setProperty('--accent-dark', color.dark);
  root.style.setProperty('--accent-muted', color.muted);
}

const storedMode = (localStorage.getItem('theme') as ThemeMode) || 'dark';
const storedAccent = localStorage.getItem('accent_color') || 'violet';
applyTheme(storedMode);
applyAccent(storedAccent);

const useThemeStore = create<ThemeState>((set) => ({
  mode: storedMode,
  accentId: storedAccent,
  setMode: (mode: ThemeMode) => {
    localStorage.setItem('theme', mode);
    applyTheme(mode);
    set({ mode });
  },
  setAccent: (id: string) => {
    localStorage.setItem('accent_color', id);
    applyAccent(id);
    set({ accentId: id });
  },
}));

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const current = useThemeStore.getState().mode;
  if (current === 'system') {
    applyTheme('system');
  }
});

export default useThemeStore;
