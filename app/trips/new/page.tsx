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
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    country: '',
    startDate: '',
    endDate: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    userName: '',
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
          timezone: formData.timezone,
          invite_code: inviteCode,
          created_by: user.id, // Use auth.uid()
          status: 'planning',
          is_public: false,
        });

      if (tripError) {
        throw tripError;
      }

      // Insert creator as trip member using auth.uid()
      const { error: memberError } = await supabase
        .from('trip_members')
        .insert({
          trip_id: tripId,
          user_id: user.id,
          name: formData.userName,
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-slate-700 dark:text-slate-200">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen pb-12 bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 md:px-8 max-w-2xl">
        <div className="card-surface rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-10 tracking-tight">
            Create a New Trip
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                Trip Name
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-blue-500 dark:focus:border-blue-500"
                placeholder="Summer Vacation 2024"
              />
            </div>

            <div>
              <label htmlFor="destination" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                Destination
              </label>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  id="city"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-blue-500 dark:focus:border-blue-500"
                  placeholder="City"
                />
                <input
                  type="text"
                  id="country"
                  required
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-blue-500 dark:focus:border-blue-500"
                  placeholder="Country"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-blue-500 dark:focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  id="endDate"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-blue-500 dark:focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                Timezone
              </label>
              <input
                type="text"
                id="timezone"
                required
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-blue-500 dark:focus:border-blue-500"
                placeholder="America/New_York"
              />
            </div>

            <div>
              <label htmlFor="userName" className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                Your Display Name
              </label>
              <input
                type="text"
                id="userName"
                required
                value={formData.userName}
                onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-blue-500 dark:focus:border-blue-500"
                placeholder="John Doe"
              />
            </div>

            {error && (
              <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-lg dark:bg-red-900 dark:border-red-700 dark:text-red-100">
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-sky-200 text-slate-900 px-6 py-3 rounded-lg font-semibold hover:bg-sky-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700"
              >
                {loading ? 'Creating...' : 'Create Trip'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 border border-slate-200 text-slate-800 rounded-lg font-semibold hover:bg-slate-100 transition-colors dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
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
