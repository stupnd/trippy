'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur-xl transition-colors ${
        isDark
          ? 'border border-white/20 bg-slate-900/70 text-slate-100 hover:bg-slate-900/80'
          : 'border border-sky-200 bg-sky-200 text-slate-900 hover:bg-sky-300'
      }`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <>
          <Sun className="h-4 w-4 text-amber-300" />
          <span>Light</span>
        </>
      ) : (
        <>
          <Moon className="h-4 w-4 text-slate-900" />
          <span>Dark</span>
        </>
      )}
    </button>
  );
}
