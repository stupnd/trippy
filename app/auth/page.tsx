'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Check if there's a redirect URL
        const redirect = searchParams.get('redirect');
        if (redirect) {
          router.push(redirect);
        } else {
          router.push('/');
        }
      }
    });

    // Handle auth callback (when user clicks magic link)
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const redirect = searchParams.get('redirect');
        if (redirect) {
          router.push(redirect);
        } else {
          router.push('/');
        }
      }
    });
  }, [router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth?redirect=${encodeURIComponent(
            searchParams.get('redirect') || '/'
          )}`,
        },
      });

      if (error) throw error;

      setMessage('Check your email for the magic link!');
      setEmail('');
    } catch (error: any) {
      console.error('Error sending magic link:', error);
      setError(error.message || 'Failed to send magic link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="card-surface rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-2">Welcome to Trippy</h1>
          <p className="text-slate-700 dark:text-slate-300 mb-6">
            Sign in with your email to continue
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-blue-500 dark:focus:border-blue-500"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-lg dark:bg-red-900 dark:border-red-700 dark:text-red-100">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-lg dark:bg-green-900 dark:border-green-700 dark:text-green-100">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-200 text-slate-900 px-6 py-3 rounded-lg font-semibold hover:bg-sky-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700"
            >
              {loading ? 'Sending...' : 'Send Magic Link'}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-600 dark:text-slate-400 text-center">
            We'll send you a secure link to sign in. No password needed!
          </p>
        </div>
      </div>
    </div>
  );
}