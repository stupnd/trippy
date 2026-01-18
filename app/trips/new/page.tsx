'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { generateInviteCode } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function NewTripPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [creatorProfile, setCreatorProfile] = useState<{ full_name?: string; avatar_url?: string | null } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    country: '',
    startDate: '',
    endDate: '',
  });

  // Prefill destination and dates from query params
  useEffect(() => {
    const destination = searchParams?.get('destination');
    const name = searchParams?.get('name');
    const startDate = searchParams?.get('startDate');
    const endDate = searchParams?.get('endDate');
    if (destination) {
      // Try to parse "City, Country" or just "City"
      const parts = destination.split(',').map(s => s.trim());
      if (parts.length === 2) {
        setFormData(prev => ({
          ...prev,
          name: prev.name || name || '',
          city: prev.city || parts[0],
          country: prev.country || parts[1],
          startDate: prev.startDate || startDate || '',
          endDate: prev.endDate || endDate || '',
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          name: prev.name || name || '',
          city: prev.city || parts[0],
          startDate: prev.startDate || startDate || '',
          endDate: prev.endDate || endDate || '',
        }));
      }
    } else if (startDate || endDate) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || name || '',
        startDate: prev.startDate || startDate || '',
        endDate: prev.endDate || endDate || '',
      }));
    }
  }, [searchParams]);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth?redirect=${encodeURIComponent('/trips/new')}`);
    }
  }, [authLoading, user, router]);

  // Fetch creator profile on mount - always fetch latest from profiles table
  useEffect(() => {
    if (!user) return;
    
    const fetchCreatorProfile = async () => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching creator profile:', error);
        }
        
        if (profile) {
          setCreatorProfile(profile);
        } else {
          // Profile doesn't exist yet - set to null so we show warning
          setCreatorProfile(null);
        }
      } catch (err) {
        console.error('Error fetching creator profile:', err);
        setCreatorProfile(null);
      }
    };
    
    fetchCreatorProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('Please sign in first');
      return;
    }

    setLoading(true);
    setError('');

    const tripId = uuidv4();
    const inviteCode = generateInviteCode();

    try {
      // Insert trip into Supabase
      const { error: tripError } = await supabase
        .from('trips')
        .insert({
          id: tripId,
          name: formData.name,
          destination_city: formData.city,
          destination_country: formData.country,
          start_date: formData.startDate,
          end_date: formData.endDate,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          invite_code: inviteCode,
          created_by: user.id, // Use auth.uid()
          status: 'planning',
          is_public: false,
        });

      if (tripError) {
        throw tripError;
      }

      // Insert creator as trip member using auth.uid()
      // Use creator's full_name from profile (or empty string as fallback)
      const { error: memberError } = await supabase
        .from('trip_members')
        .insert({
          trip_id: tripId,
          user_id: user.id,
          name: creatorProfile?.full_name || '', // Auto-filled from profiles.full_name
        });

      if (memberError) {
        throw memberError;
      }

      // Redirect to trip dashboard
      router.push(`/trips/${tripId}`);
    } catch (error: any) {
      console.error('Error creating trip:', error);
      setError(error.message || 'Failed to create trip. Please try again.');
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-300">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen pb-12 bg-slate-900">
      <div className="container mx-auto px-4 md:px-8 max-w-2xl">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-white mb-10 tracking-tight">
            Create a New Trip
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Creator Identity Display */}
            {creatorProfile?.full_name ? (
              <div className="bg-zinc-900/50 border border-white/10 rounded-lg px-4 py-3">
                <p className="text-sm text-slate-400">
                  Creating as: <span className="font-semibold text-slate-300">{creatorProfile.full_name}</span>
                </p>
              </div>
            ) : user && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
                <p className="text-sm text-amber-400">
                  ⚠️ Please set up your profile name in <a href="/profile" className="underline hover:text-amber-300">Profile Settings</a> before creating a trip.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-400 mb-2">
                Trip Name
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-zinc-900/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/20 focus:border-white/20"
                placeholder="Summer Vacation 2024"
              />
            </div>

            <div>
              <label htmlFor="destination" className="block text-sm font-medium text-slate-400 mb-2">
                Destination
              </label>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  id="city"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="px-4 py-2 bg-zinc-900/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/20 focus:border-white/20"
                  placeholder="City"
                />
                <input
                  type="text"
                  id="country"
                  required
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="px-4 py-2 bg-zinc-900/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/20 focus:border-white/20"
                  placeholder="Country"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-slate-400 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-2 bg-zinc-900/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-slate-400/20 focus:border-white/20"
                />
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-slate-400 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  id="endDate"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-2 bg-zinc-900/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-slate-400/20 focus:border-white/20"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading || !creatorProfile?.full_name}
                className="flex-1 bg-slate-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
              >
                {loading ? 'Creating...' : 'Create Trip'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 border border-white/10 text-slate-300 rounded-lg font-semibold hover:bg-white/5 transition-colors"
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
