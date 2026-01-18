'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth, useTripMember } from '@/lib/auth';

type FoodRecommendation = {
  name: string;
  cuisine: string;
  dietary_options: string[];
  price_range: string;
  neighborhood: string;
  why: string;
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

  const destinationLabel = useMemo(() => {
    if (!trip) return '';
    return `${trip.destination_city}, ${trip.destination_country}`;
  }, [trip]);

  if (authLoading || memberLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-slate-700 dark:text-slate-200">Loading...</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-4">
            {error || 'Trip not found'}
          </h1>
          <Link href="/" className="text-blue-600 hover:underline dark:text-blue-400">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-6">
          <Link
            href={`/trips/${tripId}`}
            className="text-blue-600 hover:text-blue-500 underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Back to Trip
          </Link>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mt-3">
            Food Recommendations
          </h1>
          <p className="text-slate-700 dark:text-slate-300 mt-2">
            {trip.name} • {destinationLabel}
          </p>
        </div>

        <div className="card-surface rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                Find food near you
              </h2>
            </div>
            <button
              onClick={handleFetchRecommendations}
              disabled={fetching}
              className="px-6 py-3 rounded-xl font-semibold transition-colors bg-sky-200 text-slate-900 hover:bg-sky-300 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700"
            >
              {fetching ? 'Finding places...' : 'Get Food Recommendations'}
            </button>
          </div>
          {error && (
            <div className="mt-4 bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-lg dark:bg-red-900 dark:border-red-700 dark:text-red-100">
              {error}
            </div>
          )}
        </div>

        {recommendations.length === 0 ? (
          <div className="card-surface rounded-2xl p-8 text-center">
            <p className="text-slate-700 dark:text-slate-300">
              Click the button above to generate food recommendations.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recommendations.map((rec, index) => (
              <div key={`${rec.name}-${index}`} className="card-surface rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
                      {rec.name}
                    </h3>
                    <p className="text-slate-700 dark:text-slate-300 mt-1">
                      {rec.cuisine} • {rec.price_range} • {rec.neighborhood}
                    </p>
                  </div>
                  <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-full dark:bg-slate-700 dark:text-slate-200">
                    {rec.price_range}
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-slate-700 dark:text-slate-300">{rec.why}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(rec.dietary_options || []).map((option) => (
                    <span
                      key={option}
                      className="text-xs bg-blue-50 text-blue-900 px-2 py-1 rounded dark:bg-slate-700 dark:text-slate-200"
                    >
                      {option}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
