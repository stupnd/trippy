'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import WorldMapFlashlight from './WorldMapFlashlight';
import GlobalNavbar from './GlobalNavbar';
import Breadcrumbs from './Breadcrumbs';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen relative text-slate-900 transition-colors dark:text-slate-100 [&_h1]:text-slate-900 dark:[&_h1]:text-white [&_h2]:text-slate-900 dark:[&_h2]:text-white [&_h3]:text-slate-900 dark:[&_h3]:text-white [&_h4]:text-slate-900 dark:[&_h4]:text-white [&_.text-slate-50]:text-slate-900 dark:[&_.text-slate-50]:text-slate-50 [&_.text-slate-100]:text-slate-900 dark:[&_.text-slate-100]:text-slate-100 [&_.text-slate-200]:text-slate-700 dark:[&_.text-slate-200]:text-slate-200 [&_.text-slate-300]:text-slate-700 dark:[&_.text-slate-300]:text-slate-300 [&_.text-slate-400]:text-slate-600 dark:[&_.text-slate-400]:text-slate-400 [&_.text-slate-500]:text-slate-600 dark:[&_.text-slate-500]:text-slate-500 [&_.glass-card_.text-white]:text-slate-900 dark:[&_.glass-card_.text-white]:text-white [&_.card-surface_.text-white]:text-slate-900 dark:[&_.card-surface_.text-white]:text-white">
      {/* Permanent World Map Background */}
      <WorldMapFlashlight />

      {/* Global Navbar */}
      <GlobalNavbar />

      {/* Main Content with Page Transition */}
      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="relative z-10 pt-28"
        >
          {/* Global Breadcrumbs */}
          <Breadcrumbs />
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
