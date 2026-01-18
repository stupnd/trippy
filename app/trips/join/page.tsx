'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function JoinTripPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if user is authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      const redirect = searchParams.get('redirect') || '/';
      router.push(`/auth?redirect=${encodeURIComponent(`/trips/join?redirect=${encodeURIComponent(redirect)}`)}`);
    }
  }, [authLoading, user, router, searchParams]);

  // Pre-fill invite code from URL if present
  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam) {
      setInviteCode(codeParam.toUpperCase());
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('Please sign in first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Fetch trip by invite code
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('id')
        .eq('invite_code', inviteCode.toUpperCase())
        .single();

      if (tripError || !trip) {
        setError('Invalid invite code');
        setLoading(false);
        return;
      }

      // Use upsert to prevent 409 conflicts - will insert if new, update if exists
      // Let Supabase handle the primary key (id) - do NOT pass id manually
      // Matches the unique constraint on (trip_id, user_id)
      const { data, error: memberError } = await supabase
        .from('trip_members')
        .upsert(
          {
            trip_id: trip.id,
            user_id: user.id,
            name: userName,
          },
          {
            onConflict: 'trip_id, user_id', // Matches unique constraint on (trip_id, user_id)
          }
        );

      if (memberError) {
        // If error is 23505 (unique constraint violation), user is already a member
        // Just proceed to redirect instead of showing error
        if (memberError.code === '23505') {
          console.error('Unique constraint violation on trip_members (user already joined):', {
            trip_id: trip.id,
            user_id: user.id,
            error: memberError.message,
            code: memberError.code,
          });
          // User is already a member, redirect to home dashboard to see all trips
          router.push('/');
          setLoading(false);
          return;
        }
        throw memberError;
      }

      // Redirect to home dashboard after successful upsert to show all trips
      router.push('/');
    } catch (error: any) {
      console.error('Error joining trip:', error);
      setError(error.message || 'Failed to join trip. Please try again.');
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-200">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen pb-12">
      <div className="container mx-auto px-4 md:px-8 max-w-md">
        <div className="card-surface rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-white mb-10 tracking-tight">
            Join a Trip
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="inviteCode" className="block text-sm font-medium text-slate-200 mb-2">
                Invite Code
              </label>
              <input
                type="text"
                id="inviteCode"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                placeholder="ABC123"
                maxLength={6}
              />
              <p className="mt-1 text-sm text-slate-400">
                Enter the 6-character code shared by your trip organizer
              </p>
            </div>

            <div>
              <label htmlFor="userName" className="block text-sm font-medium text-slate-200 mb-2">
                Your Display Name
              </label>
              <input
                type="text"
                id="userName"
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Jane Doe"
              />
            </div>

            {error && (
              <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Joining...' : 'Join Trip'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 border border-slate-600 text-slate-200 rounded-lg font-semibold hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}