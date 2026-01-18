'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { generateInviteCode } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { CityOption } from '@/lib/cityIataMap';

export default function NewTripPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [creatorProfile, setCreatorProfile] = useState<{ full_name?: string; avatar_url?: string | null } | null>(null);
  const [countrySuggestions, setCountrySuggestions] = useState<string[]>([]);
  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    originCity: '',
    originIata: '',
    city: '',
    country: '',
    destinationIata: '',
    startDate: '',
    endDate: '',
  });
  
  // Autocomplete state
  const [originSuggestions, setOriginSuggestions] = useState<CityOption[]>([]);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [destSuggestions, setDestSuggestions] = useState<CityOption[]>([]);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const originInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);
  const justSelectedOriginRef = useRef(false);
  const justSelectedDestRef = useRef(false);

  // Mount guard
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Handle origin city autocomplete with Gemini API
  useEffect(() => {
    // Don't fetch if we just selected a suggestion
    if (justSelectedOriginRef.current) {
      justSelectedOriginRef.current = false;
      return;
    }

    const query = formData.originCity.trim();
    if (query.length < 2) {
      setOriginSuggestions([]);
      setShowOriginSuggestions(false);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        console.log('🔍 Fetching origin city suggestions for:', query);
        const response = await fetch(`/api/search-cities?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
          console.error('❌ City search API error:', response.statusText);
          return;
        }
        const data = await response.json();
        console.log('✅ Origin suggestions received:', data.suggestions);
        const suggestions: CityOption[] = (data.suggestions || []).map((s: any) => ({
          city: s.city,
          country: s.country,
          iata: s.iata || '',
          display: s.display || `${s.city}, ${s.country}`,
        }));
        console.log('📋 Mapped origin suggestions:', suggestions);
        setOriginSuggestions(suggestions);
        setShowOriginSuggestions(true);
      } catch (fetchError) {
        console.error('❌ City suggestions failed:', fetchError);
        setOriginSuggestions([]);
      }
    }, 150); // Debounce 150ms for faster response

    return () => clearTimeout(timeout);
  }, [formData.originCity]);

  const handleOriginCityChange = (value: string) => {
    setFormData({ ...formData, originCity: value, originIata: '' });
    if (value.length < 2) {
      setShowOriginSuggestions(false);
      setOriginSuggestions([]);
    }
  };

  const handleOriginSelect = (city: CityOption) => {
    justSelectedOriginRef.current = true; // Prevent useEffect from triggering
    setFormData({ ...formData, originCity: city.display.split(',')[0], originIata: city.iata });
    setShowOriginSuggestions(false);
    setOriginSuggestions([]);
  };

  // Handle destination city autocomplete with Gemini API
  useEffect(() => {
    // Don't fetch if we just selected a suggestion
    if (justSelectedDestRef.current) {
      justSelectedDestRef.current = false;
      return;
    }

    const query = formData.city.trim();
    if (query.length < 2) {
      setDestSuggestions([]);
      setShowDestSuggestions(false);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        console.log('🔍 Fetching destination city suggestions for:', query);
        const response = await fetch(`/api/search-cities?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
          console.error('❌ City search API error:', response.statusText);
          return;
        }
        const data = await response.json();
        console.log('✅ Destination suggestions received:', data.suggestions);
        const suggestions: CityOption[] = (data.suggestions || []).map((s: any) => ({
          city: s.city,
          country: s.country,
          iata: s.iata || '',
          display: s.display || `${s.city}, ${s.country}`,
        }));
        console.log('📋 Mapped destination suggestions:', suggestions);
        setDestSuggestions(suggestions);
        setShowDestSuggestions(true);
      } catch (fetchError) {
        console.error('❌ City suggestions failed:', fetchError);
        setDestSuggestions([]);
      }
    }, 150); // Debounce 150ms for faster response

    return () => clearTimeout(timeout);
  }, [formData.city]);

  const handleDestCityChange = (value: string) => {
    setFormData({ ...formData, city: value, destinationIata: '' });
    if (value.length < 2) {
      setShowDestSuggestions(false);
      setDestSuggestions([]);
    }
  };

  const handleDestSelect = (city: CityOption) => {
    justSelectedDestRef.current = true; // Prevent useEffect from triggering
    const parts = city.display.split(',');
    setFormData({ 
      ...formData, 
      city: parts[0].trim(), 
      country: parts[1]?.trim() || '',
      destinationIata: city.iata 
    });
    setShowDestSuggestions(false);
    setDestSuggestions([]);
  };

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
          origin_city: formData.originCity,
          origin_iata: formData.originIata.toUpperCase(),
          destination_city: formData.city,
          destination_country: formData.country,
          destination_iata: formData.destinationIata || null,
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
      // Profile data (full_name, avatar_url) will be fetched via join on the dashboard
      const { error: memberError } = await supabase
        .from('trip_members')
        .insert({
          trip_id: tripId,
          user_id: user.id, // Only store user_id - profile data comes from profiles table
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
              <label htmlFor="origin" className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-2">
                Origin (Starting Point)
              </label>
              <div className="relative mb-4">
                <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
                  <div className="relative">
                    <input
                      ref={originInputRef}
                      type="text"
                      id="originCity"
                      required
                      value={formData.originCity}
                      onChange={(e) => handleOriginCityChange(e.target.value)}
                      onFocus={() => {
                        if (formData.originCity.length >= 2) {
                          setShowOriginSuggestions(true);
                        }
                      }}
                      onBlur={() => {
                        // Delay to allow click on suggestion
                        setTimeout(() => setShowOriginSuggestions(false), 200);
                      }}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-zinc-900/50 dark:border-white/10 dark:text-white dark:placeholder-slate-500 dark:focus:ring-slate-400/20 dark:focus:border-white/20"
                      placeholder="Type city name (e.g., Lisbon)"
                    />
                    {showOriginSuggestions && originSuggestions.length > 0 && hasMounted && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden dark:bg-slate-900/95 dark:backdrop-blur-2xl dark:border-white/20">
                        {originSuggestions.map((city, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleOriginSelect(city)}
                            className="w-full text-left px-4 py-3 hover:bg-slate-100 transition-colors border-b border-slate-100 last:border-0 dark:hover:bg-white/10 dark:border-white/5"
                          >
                            <div className="text-slate-900 font-medium dark:text-white">{city.display}</div>
                            <div className="text-xs text-emerald-700 font-mono mt-1 dark:text-emerald-400">{city.iata}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {hasMounted && formData.originIata && (
                    <div className="flex items-center">
                      <span className="px-3 py-2 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-mono font-bold dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30">
                        {formData.originIata}
                      </span>
                    </div>
                  )}
                </div>
                {!formData.originIata && (
                  <input
                    type="text"
                    id="originIata"
                    value={formData.originIata}
                    onChange={(e) => setFormData({ ...formData, originIata: e.target.value.toUpperCase() })}
                    className="mt-2 w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 font-mono text-sm dark:bg-zinc-900/50 dark:border-white/10 dark:text-white dark:placeholder-slate-500 dark:focus:ring-slate-400/20 dark:focus:border-white/20"
                    placeholder="Or enter IATA code manually (e.g., YOW)"
                    maxLength={3}
                  />
                )}
              </div>
            </div>

            <div>
              <label htmlFor="destination" className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-2">
                Destination
              </label>
              <div className="relative mb-4">
                <div className="grid grid-cols-[1fr_auto] gap-4 items-start mb-2">
                  <div className="relative">
                    <input
                      ref={destInputRef}
                      type="text"
                      id="city"
                      required
                      value={formData.city}
                      onChange={(e) => handleDestCityChange(e.target.value)}
                      onFocus={() => {
                        if (formData.city.length >= 2) {
                          setShowDestSuggestions(true);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowDestSuggestions(false), 200);
                      }}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-zinc-900/50 dark:border-white/10 dark:text-white dark:placeholder-slate-500 dark:focus:ring-slate-400/20 dark:focus:border-white/20"
                      placeholder="Type city name (e.g., Tokyo)"
                    />
                    {showDestSuggestions && destSuggestions.length > 0 && hasMounted && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden dark:bg-slate-900/95 dark:backdrop-blur-2xl dark:border-white/20">
                        {destSuggestions.map((city, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleDestSelect(city)}
                            className="w-full text-left px-4 py-3 hover:bg-slate-100 transition-colors border-b border-slate-100 last:border-0 dark:hover:bg-white/10 dark:border-white/5"
                          >
                            <div className="text-slate-900 font-medium dark:text-white">{city.display}</div>
                            <div className="text-xs text-emerald-700 font-mono mt-1 dark:text-emerald-400">{city.iata}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {hasMounted && formData.destinationIata && (
                    <div className="flex items-center">
                      <span className="px-3 py-2 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-mono font-bold dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30">
                        {formData.destinationIata}
                      </span>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  id="country"
                  required
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-zinc-900/50 dark:border-white/10 dark:text-white dark:placeholder-slate-500 dark:focus:ring-slate-400/20 dark:focus:border-white/20"
                  placeholder="Country"
                />
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
