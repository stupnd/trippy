'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';

export default function JoinTripPage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      // Generate user ID
      const userId = uuidv4();

      // Insert user as trip member
      const { error: memberError } = await supabase
        .from('trip_members')
        .insert({
          id: userId,
          trip_id: trip.id,
          name: userName,
        });

      if (memberError) {
        throw memberError;
      }

      // Redirect to trip dashboard
      router.push(`/trips/${trip.id}`);
    } catch (error: any) {
      console.error('Error joining trip:', error);
      setError(error.message || 'Failed to join trip. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="card-surface rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-slate-50 mb-6">
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