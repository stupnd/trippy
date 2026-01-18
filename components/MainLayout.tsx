'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import WorldMapFlashlight from './WorldMapFlashlight';
import GlobalNavbar from './GlobalNavbar';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen relative">
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
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
