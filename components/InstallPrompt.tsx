'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
      return;
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Handle beforeinstallprompt event (Android/Desktop)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt after a short delay
      setTimeout(() => setShowPrompt(true), 2000);
    };

    // Check if user has dismissed the prompt before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return () => {
          window.removeEventListener('beforeinstallprompt', handler);
        };
      }
    }

    window.addEventListener('beforeinstallprompt', handler);

    // For iOS, show custom instructions
    if (iOS) {
      setTimeout(() => setShowPrompt(true), 2000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowPrompt(false);
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    
    setDeferredPrompt(null);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 rounded-2xl shadow-2xl p-6">
        {isIOS ? (
          <div>
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Install Trippy
              </h3>
              <button
                onClick={handleDismiss}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                aria-label="Dismiss"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Tap the <span className="font-semibold">Share</span> button{' '}
              <span className="inline-block mx-1">⬆️</span> and select{' '}
              <span className="font-semibold">&quot;Add to Home Screen&quot;</span>
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Install Trippy App
              </h3>
              <button
                onClick={handleDismiss}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                aria-label="Dismiss"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Install Trippy for a faster, app-like experience with offline support!
            </p>
            <button
              onClick={handleInstall}
              className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-purple-500/30"
            >
              Install Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
