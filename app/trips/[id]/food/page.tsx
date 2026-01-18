'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, UtensilsCrossed } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, useTripMember } from '@/lib/auth';

type FoodRecommendation = {
  name: string;
  cuisine: string;
  dietary_options: string[];
  price_range: string;
  neighborhood: string;
  why: string;
  rating?: number;
  address?: string;
};

type TripMeta = {
  name: string;
  destination_city: string;
  destination_country: string;
};

export default function FoodRecommendationsPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const { isMember, loading: memberLoading } = useTripMember(tripId);
  const [trip, setTrip] = useState<TripMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [recommendations, setRecommendations] = useState<FoodRecommendation[]>([]);
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  const [membersCount, setMembersCount] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth?redirect=${encodeURIComponent(`/trips/${tripId}/food`)}`);
      return;
    }

    if (!authLoading && user && !memberLoading && isMember === false) {
      router.push(`/trips/join?code=&redirect=${encodeURIComponent(`/trips/${tripId}/food`)}`);
      return;
    }

    if (!authLoading && user && isMember) {
      fetchTripMeta();
      fetchMembersCount();
    }
  }, [authLoading, user, memberLoading, isMember, tripId, router]);

  const fetchTripMeta = async () => {
    try {
      const { data, error: tripError } = await supabase
        .from('trips')
        .select('name, destination_city, destination_country')
        .eq('id', tripId)
        .maybeSingle();

      if (tripError) throw tripError;
      if (data) {
        setTrip(data as TripMeta);
      }
    } catch (tripError: any) {
      setError(tripError.message || 'Failed to load trip');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembersCount = async () => {
    try {
      const { data, error } = await supabase
        .from('trip_members')
        .select('id', { count: 'exact' })
        .eq('trip_id', tripId);

      if (!error && data) {
        setMembersCount(data.length);
      }
    } catch (err) {
      console.error('Error fetching members count:', err);
    }
  };

  const resolveLocation = async (): Promise<{ lat: number; lng: number; accuracy?: number } | null> => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return null;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  };

  const handleFetchRecommendations = async () => {
    setError('');
    setFetching(true);

    try {
      const location = await resolveLocation();
      const response = await fetch('/api/generate-food-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId, location }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to get recommendations');
      }

      setRecommendations(payload.recommendations || []);
    } catch (fetchError: any) {
      setError(fetchError.message || 'Failed to get recommendations');
    } finally {
      setFetching(false);
    }
  };

  const handleVote = (recommendationName: string, approved: boolean) => {
    setVotes((prev) => ({
      ...prev,
      [recommendationName]: approved,
    }));
  };

  const getUserVote = (recommendationName: string): boolean | undefined => {
    return votes[recommendationName];
  };

  const getVoteCount = (recommendationName: string): number => {
    // For MVP, using localStorage to simulate votes
    // In production, fetch from Supabase
    const voteKey = `food_${tripId}_${recommendationName}`;
    const stored = typeof window !== 'undefined' ? localStorage.getItem(voteKey) : null;
    if (stored) {
      try {
        const voteData = JSON.parse(stored);
        return Object.values(voteData).filter(Boolean).length;
      } catch {
        return 0;
      }
    }
    return Object.values(votes).filter((v) => v === true && Object.keys(votes).includes(recommendationName)).length;
  };

  const destinationLabel = useMemo(() => {
    if (!trip) return '';
    return `${trip.destination_city.toUpperCase()}, ${trip.destination_country}`;
  }, [trip]);

  if (authLoading || memberLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4 tracking-tight">
            {error || 'Trip not found'}
          </h1>
          <Link href="/" className="text-blue-400 hover:underline">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        {/* Header Section */}
        <div className="flex items-start justify-between gap-4 mb-10">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
              Food Recommendations
            </h1>
            <p className="text-slate-400 text-lg">
              {destinationLabel}
            </p>
          </div>
          <button
            onClick={handleFetchRecommendations}
            disabled={fetching}
            className="px-6 py-3 rounded-xl font-semibold text-white transition-all bg-gradient-to-r from-indigo-600 to-violet-700 hover:from-indigo-700 hover:to-violet-800 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {fetching ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                />
                Finding places...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Get Recommendations
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="bg-red-900/60 border border-red-500/50 text-red-200 px-4 py-3 rounded-3xl mb-6 backdrop-blur-xl">
            {error}
          </div>
        )}

        {/* Recommendations List */}
        {recommendations.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/60 backdrop-blur-xl border border-white/20 rounded-3xl p-12 text-center"
          >
            <div className="flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                <UtensilsCrossed className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2 tracking-tight">
                Looking for the best spots in {trip.destination_city}?
              </h3>
              <p className="text-slate-400 text-sm max-w-md">
                Click the button above to let AI find your perfect meal.
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {recommendations.map((rec, index) => {
              const recommendationKey = `${rec.name}-${index}`;
              const userVote = getUserVote(recommendationKey);
              const voteCount = getVoteCount(recommendationKey);
              const priceIcon = rec.price_range === '$' ? '💸' : rec.price_range === '$$' ? '💸💸' : rec.price_range === '$$$' ? '💸💸💸' : '💸💸💸💸';

              return (
                <motion.div
                  key={recommendationKey}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="bg-slate-900/60 backdrop-blur-xl border border-white/20 rounded-3xl p-6 hover:bg-slate-900/70 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-white tracking-tight">{rec.name}</h3>
                        <span className="text-xs bg-slate-700/50 text-slate-300 px-3 py-1 rounded-full border border-white/10">
                          {rec.cuisine}
                        </span>
                      </div>
                      <p className="text-slate-300 mb-3 text-sm leading-relaxed">{rec.why}</p>
                      <div className="flex items-center gap-4 text-sm text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          {priceIcon}
                          <span>{rec.price_range}</span>
                        </span>
                        {rec.rating && (
                          <span className="flex items-center gap-1">
                            ⭐
                            <span>{rec.rating}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          📍
                          <span>{rec.neighborhood}</span>
                        </span>
                      </div>
                      {rec.dietary_options && rec.dietary_options.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {rec.dietary_options.map((option) => (
                            <span
                              key={option}
                              className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded border border-blue-500/30"
                            >
                              {option}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-sm text-slate-400 mt-3">
                        {voteCount}/{membersCount} members approve
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleVote(recommendationKey, true)}
                        className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                          userVote === true
                            ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                            : 'bg-white/5 text-slate-200 hover:bg-emerald-500/20 hover:text-emerald-300 border border-white/10'
                        }`}
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleVote(recommendationKey, false)}
                        className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                          userVote === false
                            ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                            : 'bg-white/5 text-slate-200 hover:bg-red-500/20 hover:text-red-300 border border-white/10'
                        }`}
                      >
                        ✗ Reject
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
