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
  const [citySuggestions, setCitySuggestions] = useState<Array<{ city: string; country: string }>>([]);
  const [countrySuggestions, setCountrySuggestions] = useState<string[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    country: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    const query = formData.city.trim();
    if (query.length < 2) {
      setCitySuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(
          query
        )}&format=json&addressdetails=1&limit=8`;
        const response = await fetch(url, {
          headers: { 'Accept-Language': 'en' },
        });
        if (!response.ok) return;
        const results = (await response.json()) as Array<{
          address?: {
            city?: string;
            town?: string;
            village?: string;
            municipality?: string;
            county?: string;
            country?: string;
          };
        }>;
        const next = new Map<string, { city: string; country: string }>();
        results.forEach((item) => {
          const address = item.address || {};
          const city =
            address.city ||
            address.town ||
            address.village ||
            address.municipality ||
            address.county ||
            '';
          const country = address.country || '';
          if (!city || !country) return;
          const key = `${city.toLowerCase()}-${country.toLowerCase()}`;
          if (!next.has(key)) {
            next.set(key, { city, country });
          }
        });
        setCitySuggestions(Array.from(next.values()));
      } catch (fetchError) {
        console.error('City suggestions failed:', fetchError);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [formData.city]);

  useEffect(() => {
    const query = formData.country.trim();
    if (query.length < 2) {
      setCountrySuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const url = `https://restcountries.com/v3.1/name/${encodeURIComponent(
          query
        )}?fields=name`;
        const response = await fetch(url);
        if (!response.ok) return;
        const results = (await response.json()) as Array<{ name?: { common?: string } }>;
        const names = Array.from(
          new Set(results.map((c) => c.name?.common).filter(Boolean) as string[])
        ).slice(0, 8);
        setCountrySuggestions(names);
      } catch (fetchError) {
        console.error('Country suggestions failed:', fetchError);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [formData.country]);

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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-slate-700 dark:text-slate-300">Loading...</div>
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
            {/* Creator Identity Display */}
            {creatorProfile?.full_name ? (
              <div className="bg-slate-100 border border-slate-200 rounded-lg px-4 py-3 dark:bg-zinc-900/50 dark:border-white/10">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Creating as:{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-300">
                    {creatorProfile.full_name}
                  </span>
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
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-2">
                Trip Name
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-zinc-900/50 dark:border-white/10 dark:text-white dark:placeholder-slate-500 dark:focus:ring-slate-400/20 dark:focus:border-white/20"
                placeholder="Summer Vacation 2024"
              />
            </div>

            <div>
              <label htmlFor="destination" className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-2">
                Destination
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <input
                    type="text"
                    id="city"
                    required
                    value={formData.city}
                    onChange={(e) => {
                      setFormData({ ...formData, city: e.target.value });
                      setShowCitySuggestions(true);
                    }}
                    onFocus={() => setShowCitySuggestions(true)}
                    onBlur={() => setTimeout(() => setShowCitySuggestions(false), 150)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-zinc-900/50 dark:border-white/10 dark:text-white dark:placeholder-slate-500 dark:focus:ring-slate-400/20 dark:focus:border-white/20"
                    placeholder="City"
                    autoComplete="off"
                  />
                  {showCitySuggestions && citySuggestions.length > 0 && (
                    <div className="absolute z-10 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-900/95 dark:backdrop-blur-xl">
                      {citySuggestions.map((suggestion) => (
                        <button
                          key={`${suggestion.city}-${suggestion.country}`}
                          type="button"
                          onMouseDown={() => {
                            setFormData({
                              ...formData,
                              city: suggestion.city,
                              country: formData.country || suggestion.country,
                            });
                            setShowCitySuggestions(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/5"
                        >
                          {suggestion.city}, {suggestion.country}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    id="country"
                    required
                    value={formData.country}
                    onChange={(e) => {
                      setFormData({ ...formData, country: e.target.value });
                      setShowCountrySuggestions(true);
                    }}
                    onFocus={() => setShowCountrySuggestions(true)}
                    onBlur={() => setTimeout(() => setShowCountrySuggestions(false), 150)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-zinc-900/50 dark:border-white/10 dark:text-white dark:placeholder-slate-500 dark:focus:ring-slate-400/20 dark:focus:border-white/20"
                    placeholder="Country"
                    autoComplete="off"
                  />
                  {showCountrySuggestions && countrySuggestions.length > 0 && (
                    <div className="absolute z-10 mt-2 w-full rounded-lg border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-slate-900/95 dark:backdrop-blur-xl">
                      {countrySuggestions.map((country) => (
                        <button
                          key={country}
                          type="button"
                          onMouseDown={() => {
                            setFormData({ ...formData, country });
                            setShowCountrySuggestions(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/5"
                        >
                          {country}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-zinc-900/50 dark:border-white/10 dark:text-white dark:focus:ring-slate-400/20 dark:focus:border-white/20"
                />
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  id="endDate"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-zinc-900/50 dark:border-white/10 dark:text-white dark:focus:ring-slate-400/20 dark:focus:border-white/20"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-lg dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading || !creatorProfile?.full_name}
                className="flex-1 bg-sky-200 text-slate-900 px-6 py-3 rounded-lg font-semibold hover:bg-sky-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 dark:border-white/10"
              >
                {loading ? 'Creating...' : 'Create Trip'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 border border-slate-200 text-slate-800 rounded-lg font-semibold hover:bg-slate-100 transition-colors dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
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
