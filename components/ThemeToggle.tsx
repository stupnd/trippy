'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from './ThemeProvider';

const Moon = dynamic(() => import('lucide-react').then(m => m.Moon), { ssr: false });
const Sun = dynamic(() => import('lucide-react').then(m => m.Sun), { ssr: false });

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = theme === 'dark';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`${positionClass} flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur-xl transition-colors ${className} ${
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
