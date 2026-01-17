'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

interface FlightSuggestion {
  id: string;
  airline: string;
  departure: { airport: string; time: string; date: string };
  arrival: { airport: string; time: string; date: string };
  duration: string;
  price: number;
  layovers: number;
  layoverAirports: string[];
  link: string;
}

interface AccommodationSuggestion {
  id: string;
  name: string;
  type: string;
  pricePerNight: number;
  location: string;
  rating: number;
  features: string[];
  link: string;
}

interface ActivitySuggestion {
  id: string;
  name: string;
  type: string;
  duration: string;
  price: number;
  location: string;
  description: string;
}

interface SuggestionsResponse {
  success: boolean;
  trip_id: string;
  model_used: string;
  suggestions: {
    flights: FlightSuggestion[];
    accommodations: AccommodationSuggestion[];
    activities: ActivitySuggestion[];
  };
}

type TabType = 'flights' | 'stays' | 'activities';

export default function SuggestionsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('flights');
  const [suggestions, setSuggestions] = useState<SuggestionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [votes, setVotes] = useState<Record<string, Record<string, boolean>>>({}); // optionId -> userId -> approved
  const [membersCount, setMembersCount] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth?redirect=${encodeURIComponent(`/trips/${tripId}/suggestions`)}`);
      return;
    }

    if (user) {
      fetchSuggestions();
      fetchVotes();
      fetchMembersCount();
    }
  }, [authLoading, user, tripId, router]);

  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabType | null;
    if (tabParam && ['flights', 'stays', 'activities'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

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

  const fetchSuggestions = async () => {
    setLoading(true);
    setError('');
    try {
      // Check if we have cached suggestions in localStorage or fetch from API
      const cached = localStorage.getItem(`suggestions_${tripId}`);
      if (cached) {
        setSuggestions(JSON.parse(cached));
        setLoading(false);
        return;
      }
      // If no cache, don't auto-fetch - show empty state
      setSuggestions(null);
    } catch (err: any) {
      console.error('Error fetching suggestions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchVotes = async () => {
    if (!user) return;
    try {
      // For MVP, we'll use localStorage to track votes
      // In production, replace with Supabase votes table
      const cachedVotes = localStorage.getItem(`votes_${tripId}`);
      if (cachedVotes) {
        setVotes(JSON.parse(cachedVotes));
      }
    } catch (err) {
      console.error('Error fetching votes:', err);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const response = await fetch('/api/generate-trip-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to generate suggestions');
      }

      setSuggestions(data);
      // Cache suggestions
      localStorage.setItem(`suggestions_${tripId}`, JSON.stringify(data));
    } catch (err: any) {
      console.error('Error generating suggestions:', err);
      setError(err.message || 'Failed to generate suggestions');
    } finally {
      setGenerating(false);
    }
  };

  const handleVote = async (optionType: 'flight' | 'accommodation' | 'activity', optionId: string, approved: boolean) => {
    if (!user) return;

    const voteKey = `${optionType}_${optionId}`;
    const newVotes = {
      ...votes,
      [voteKey]: {
        ...votes[voteKey],
        [user.id]: approved,
      },
    };

    setVotes(newVotes);
    // Save to localStorage (MVP) - in production, save to Supabase votes table
    localStorage.setItem(`votes_${tripId}`, JSON.stringify(newVotes));

    // TODO: In production, save to Supabase:
    // await supabase.from('votes').upsert({
    //   trip_id: tripId,
    //   member_id: user.id,
    //   option_type: optionType,
    //   option_id: optionId,
    //   approved,
    // });
  };

  const getVoteCount = (optionType: 'flight' | 'accommodation' | 'activity', optionId: string): number => {
    const voteKey = `${optionType}_${optionId}`;
    const optionVotes = votes[voteKey] || {};
    return Object.values(optionVotes).filter(Boolean).length;
  };

  const getUserVote = (optionType: 'flight' | 'accommodation' | 'activity', optionId: string): boolean | null => {
    if (!user) return null;
    const voteKey = `${optionType}_${optionId}`;
    return votes[voteKey]?.[user.id] ?? null;
  };

  const getAirlineDomain = (airline: string): string => {
    const airlineMap: Record<string, string> = {
      'TAP Air Portugal': 'flytap.com',
      'United Airlines': 'united.com',
      'Delta Airlines': 'delta.com',
      'American Airlines': 'aa.com',
      'Lufthansa': 'lufthansa.com',
      'British Airways': 'ba.com',
      'Air France': 'airfrance.com',
    };
    return airlineMap[airline] || airline.toLowerCase().replace(/\s+/g, '') + '.com';
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-900 py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="h-12 bg-slate-800 rounded-lg w-64 mb-8 animate-pulse"></div>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-800 rounded-lg animate-pulse"></div>
            ))}
          </div>
          <div className="card-surface rounded-lg p-12 text-center">
            <div className="h-8 bg-slate-700 rounded-lg w-64 mx-auto animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state - no suggestions yet
  if (!suggestions && !generating) {
    return (
      <div className="min-h-screen bg-slate-900 py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <Link href={`/trips/${tripId}`} className="text-blue-400 hover:text-blue-300 mb-4 inline-block underline">
            ← Back to Trip
          </Link>

          <div className="card-surface rounded-2xl p-16 text-center shadow-xl">
            <div className="text-6xl mb-6">✨</div>
            <h1 className="text-4xl font-bold text-slate-50 mb-4">Generate Group Recommendations</h1>
            <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
              Get AI-powered suggestions for flights, accommodations, and activities based on your group's preferences
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {generating ? '✨ Generating...' : '✨ Generate Group Recommendations'}
            </button>
            {error && (
              <div className="mt-6 bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg max-w-md mx-auto">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'flights' as TabType, label: '✈️ Flights', count: suggestions?.suggestions.flights.length || 0 },
    { id: 'stays' as TabType, label: '🏨 Stays', count: suggestions?.suggestions.accommodations.length || 0 },
    { id: 'activities' as TabType, label: '🎡 Activities', count: suggestions?.suggestions.activities.length || 0 },
  ];

  const flights = suggestions?.suggestions.flights || [];
  const accommodations = suggestions?.suggestions.accommodations || [];
  const activities = suggestions?.suggestions.activities || [];

  // Find cheapest and fastest flight for "Best Value" tag
  const cheapestFlight = flights.length > 0 ? flights.reduce((prev, curr) => (prev.price < curr.price ? prev : curr)) : null;
  const fastestFlight = flights.length > 0 ? flights.reduce((prev, curr) => {
    const prevDuration = parseInt(prev.duration.replace(/[^\d]/g, ''));
    const currDuration = parseInt(curr.duration.replace(/[^\d]/g, ''));
    return prevDuration < currDuration ? prev : curr;
  }) : null;

  return (
    <div className="min-h-screen bg-slate-900 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        <Link href={`/trips/${tripId}`} className="text-blue-400 hover:text-blue-300 mb-4 inline-block underline">
          ← Back to Trip
        </Link>

        <h1 className="text-4xl font-bold text-slate-50 mb-8">Trip Suggestions</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-slate-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-semibold rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-slate-700 text-slate-50 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab.label} <span className="text-sm text-slate-500">({tab.count})</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Flights Tab */}
        {activeTab === 'flights' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {flights.map((flight) => {
              const isCheapest = cheapestFlight?.id === flight.id;
              const isFastest = fastestFlight?.id === flight.id;
              const voteCount = getVoteCount('flight', flight.id);
              const userVote = getUserVote('flight', flight.id);
              const airlineDomain = getAirlineDomain(flight.airline);

              return (
                <div
                  key={flight.id}
                  className="card-surface rounded-2xl p-6 hover:bg-slate-700 transition-all shadow-lg hover:shadow-xl"
                >
                  {/* Airline Logo & Price Badge */}
                  <div className="flex justify-between items-start mb-4">
                    <img
                      src={`https://logo.clearbit.com/${airlineDomain}`}
                      alt={flight.airline}
                      className="h-8 w-8 rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-50">${flight.price}</div>
                      {(isCheapest || isFastest) && (
                        <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full mt-1">
                          {isCheapest && isFastest ? 'Best Value' : isCheapest ? 'Cheapest' : 'Fastest'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Flight Details */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-lg font-semibold text-slate-50">{flight.departure.airport}</div>
                        <div className="text-sm text-slate-400">{flight.departure.time}</div>
                      </div>
                      <div className="text-slate-400">→</div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-slate-50">{flight.arrival.airport}</div>
                        <div className="text-sm text-slate-400">{flight.arrival.time}</div>
                      </div>
                    </div>
                    <div className="text-sm text-slate-400 mt-2">
                      {flight.airline} • {flight.duration}
                      {flight.layovers > 0 && ` • ${flight.layovers} layover${flight.layovers > 1 ? 's' : ''}`}
                    </div>
                  </div>

                  {/* Vote Count */}
                  <div className="text-sm text-slate-400 mb-4">
                    {voteCount}/{membersCount} members approve
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleVote('flight', flight.id, true)}
                      className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                        userVote === true
                          ? 'bg-green-600 text-white'
                          : 'bg-slate-700 text-slate-200 hover:bg-green-600 hover:text-white'
                      }`}
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => handleVote('flight', flight.id, false)}
                      className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                        userVote === false
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-700 text-slate-200 hover:bg-red-600 hover:text-white'
                      }`}
                    >
                      ✗ Reject
                    </button>
                    <a
                      href={flight.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Book
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Accommodations Tab */}
        {activeTab === 'stays' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accommodations.map((accommodation) => {
              const voteCount = getVoteCount('accommodation', accommodation.id);
              const userVote = getUserVote('accommodation', accommodation.id);
              const stars = Math.round(accommodation.rating);

              return (
                <div
                  key={accommodation.id}
                  className="card-surface rounded-2xl p-6 hover:bg-slate-700 transition-all shadow-lg hover:shadow-xl"
                >
                  {/* Name & Rating */}
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-slate-50 mb-2">{accommodation.name}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={i < stars ? 'text-yellow-400' : 'text-slate-600'}>
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-sm text-slate-400">{accommodation.rating}</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-50">${accommodation.pricePerNight}/night</div>
                    <div className="text-sm text-slate-400 mt-1">{accommodation.location}</div>
                    <span className="inline-block mt-2 text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                      {accommodation.type}
                    </span>
                  </div>

                  {/* Features */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {accommodation.features.slice(0, 5).map((feature) => (
                      <span key={feature} className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                        {feature}
                      </span>
                    ))}
                  </div>

                  {/* Vote Count */}
                  <div className="text-sm text-slate-400 mb-4">
                    {voteCount}/{membersCount} members approve
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleVote('accommodation', accommodation.id, true)}
                      className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                        userVote === true
                          ? 'bg-green-600 text-white'
                          : 'bg-slate-700 text-slate-200 hover:bg-green-600 hover:text-white'
                      }`}
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => handleVote('accommodation', accommodation.id, false)}
                      className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                        userVote === false
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-700 text-slate-200 hover:bg-red-600 hover:text-white'
                      }`}
                    >
                      ✗ Reject
                    </button>
                    <a
                      href={accommodation.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                      Book
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Activities Tab */}
        {activeTab === 'activities' && (
          <div className="space-y-4">
            {activities.map((activity) => {
              const voteCount = getVoteCount('activity', activity.id);
              const userVote = getUserVote('activity', activity.id);

              return (
                <div
                  key={activity.id}
                  className="card-surface rounded-2xl p-6 hover:bg-slate-700 transition-all shadow-lg hover:shadow-xl"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-slate-50">{activity.name}</h3>
                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                          {activity.type}
                        </span>
                      </div>
                      <p className="text-slate-300 mb-2">{activity.description}</p>
                      <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span>⏱️ {activity.duration}</span>
                        <span>💰 ${activity.price === 0 ? 'Free' : activity.price}</span>
                        <span>📍 {activity.location}</span>
                      </div>
                      <div className="text-sm text-slate-400 mt-3">
                        {voteCount}/{membersCount} members approve
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVote('activity', activity.id, true)}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                          userVote === true
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-700 text-slate-200 hover:bg-green-600 hover:text-white'
                        }`}
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleVote('activity', activity.id, false)}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                          userVote === false
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-700 text-slate-200 hover:bg-red-600 hover:text-white'
                        }`}
                      >
                        ✗ Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
