'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { LogOut, User, Settings, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function GlobalNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Interactive logo glow
  const [logoHover, setLogoHover] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const glowX = useSpring(mouseX, { damping: 30, stiffness: 200 });
  const glowY = useSpring(mouseY, { damping: 30, stiffness: 200 });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Logo glow effect
  useEffect(() => {
    if (!logoHover) return;

    const handleMouseMove = (e: MouseEvent) => {
      const logoElement = document.getElementById('trippy-logo');
      if (logoElement) {
        const rect = logoElement.getBoundingClientRect();
        mouseX.set(e.clientX - rect.left - rect.width / 2);
        mouseY.set(e.clientY - rect.top - rect.height / 2);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [logoHover, mouseX, mouseY]);

  // Get user initials for avatar
  const userInitials = user?.email
    ? user.email
        .split('@')[0]
        .split('.')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <nav className="sticky top-0 z-50 bg-slate-50/80 dark:bg-slate-900/60 backdrop-blur-xl border-b border-slate-200 dark:border-white/20">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Left: Logo */}
          <Link
            href="/"
            id="trippy-logo"
            className="relative flex items-center gap-2 group"
            onMouseEnter={() => setLogoHover(true)}
            onMouseLeave={() => setLogoHover(false)}
          >
            {logoHover && (
              <motion.div
                className="absolute inset-0 -z-10 blur-xl opacity-30 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"
                style={{
                  x: glowX,
                  y: glowY,
                  width: '100px',
                  height: '100px',
                  left: '50%',
                  top: '50%',
                  marginLeft: '-50px',
                  marginTop: '-50px',
                }}
              />
            )}
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Trippy
            </div>
          </Link>

          {/* Center: Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className={`text-sm font-semibold transition-colors ${
                pathname === '/'
                  ? 'text-slate-900 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              My Trips
            </Link>
            <Link
              href="/discover"
              className={`text-sm font-semibold transition-colors ${
                pathname === '/discover'
                  ? 'text-slate-900 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Discover
            </Link>
            <Link
              href="/community"
              className={`text-sm font-semibold transition-colors ${
                pathname === '/community'
                  ? 'text-slate-900 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Community
            </Link>
          </div>

          {/* Right: Profile Section */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 glass-card px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                  {userInitials}
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-600 dark:text-slate-300 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown */}
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-56 bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-2 shadow-xl border border-slate-200 dark:border-white/20"
                >
                  <div className="px-3 py-2 border-b border-slate-200 dark:border-white/20 mb-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/profile"
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-700 dark:text-slate-300 text-sm"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <User className="w-4 h-4" />
                    My Profile
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-700 dark:text-slate-300 text-sm"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                  <button
                    onClick={async () => {
                      await signOut();
                      router.push('/');
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-red-500/20 transition-colors text-red-500 text-sm mt-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </motion.div>
              )}
            </div>
          ) : (
            <Link
              href="/auth"
              className="glass-card px-4 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-all text-slate-700 dark:text-slate-300 text-sm font-semibold"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
