'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Plane, Hotel, Target, Calendar, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import MagneticButton from '@/components/MagneticButton';
import FlightMapPath from '@/components/FlightMapPath';

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

type TabType = 'flights' | 'stays' | 'activities' | 'itinerary';

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
  const [votingPulse, setVotingPulse] = useState<string | null>(null);
  const [approvedItems, setApprovedItems] = useState<Set<string>>(new Set());
  const [hoveredFlightId, setHoveredFlightId] = useState<string | null>(null);
  const summaryUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (tabParam && ['flights', 'stays', 'activities', 'itinerary'].includes(tabParam)) {
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
      scheduleSummaryUpdate(votes);
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
    scheduleSummaryUpdate(newVotes);

    // Voting pulse animation
    setVotingPulse(voteKey);
    setTimeout(() => setVotingPulse(null), 600);

    // Check if approved by all members
    const newVoteCount = Object.values(newVotes[voteKey] || {}).filter(Boolean).length;
    if (newVoteCount === membersCount && membersCount > 0) {
      // Approval celebration with confined confetti to card boundaries
      const itemKey = `${optionType}_${optionId}`;
      if (!approvedItems.has(itemKey)) {
        setApprovedItems(new Set([...approvedItems, itemKey]));
        
        // Find the card element to confine confetti
        const cardElement = document.querySelector(`[data-flight-id="${optionId}"], [data-accommodation-id="${optionId}"], [data-activity-id="${optionId}"]`);
        
        if (cardElement) {
          const rect = cardElement.getBoundingClientRect();
          const x = (rect.left + rect.width / 2) / window.innerWidth;
          const y = (rect.top + rect.height / 2) / window.innerHeight;
          
          confetti({
            particleCount: 80,
            spread: 40, // Reduced spread for confinement
            origin: { x, y },
            colors: ['#fbbf24', '#fcd34d', '#fde047'], // Gold colors
            gravity: 0.8,
            ticks: 200,
          });
        } else {
          // Fallback to center
          confetti({
            particleCount: 80,
            spread: 40,
            origin: { y: 0.5 },
            colors: ['#fbbf24', '#fcd34d', '#fde047'],
          });
        }
      }
    }

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

  const isApprovedByAll = (optionType: 'flight' | 'accommodation' | 'activity', optionId: string): boolean => {
    if (membersCount === 0) return false;
    return getVoteCount(optionType, optionId) === membersCount;
  };

  const getVoteCountFrom = (
    allVotes: Record<string, Record<string, boolean>>,
    optionType: 'flight' | 'accommodation' | 'activity',
    optionId: string
  ) => {
    const voteKey = `${optionType}_${optionId}`;
    const optionVotes = allVotes[voteKey] || {};
    return Object.values(optionVotes).filter(Boolean).length;
  };

  const scheduleSummaryUpdate = (allVotes: Record<string, Record<string, boolean>>) => {
    if (!suggestions || membersCount === 0) return;

    if (summaryUpdateTimer.current) {
      clearTimeout(summaryUpdateTimer.current);
    }

    summaryUpdateTimer.current = setTimeout(async () => {
      const approvedFlights = flights.filter(
        (flight) => getVoteCountFrom(allVotes, 'flight', flight.id) === membersCount
      );
      const approvedStays = accommodations.filter(
        (stay) => getVoteCountFrom(allVotes, 'accommodation', stay.id) === membersCount
      );
      const approvedActivities = activities.filter(
        (activity) => getVoteCountFrom(allVotes, 'activity', activity.id) === membersCount
      );

      try {
        await fetch('/api/generate-trip-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trip_id: tripId,
            approved: {
              flights: approvedFlights,
              accommodations: approvedStays,
              activities: approvedActivities,
            },
            available_counts: {
              flights: flights.length,
              accommodations: accommodations.length,
              activities: activities.length,
            },
          }),
        });
      } catch (err) {
        console.error('Error updating trip summary:', err);
      }
    }, 800);
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
      <div className="min-h-screen pb-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="h-12 bg-white/5 rounded-3xl w-64 mb-8 shimmer-loader"></div>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-white/5 rounded-3xl shimmer-loader"></div>
            ))}
          </div>
          <div className="glass-card p-12 text-center">
            <div className="h-8 bg-white/5 rounded-3xl w-64 mx-auto shimmer-loader"></div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state - no suggestions yet
  if (!suggestions && !generating) {
    return (
      <div className="min-h-screen pb-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="glass-card p-16 text-center">
            <Sparkles className="w-16 h-16 text-purple-400 mx-auto mb-6 opacity-80" />
            <h1 className="text-4xl font-bold text-white mb-10 tracking-tight">Generate Group Recommendations</h1>
            <p className="text-slate-300 mb-8 max-w-2xl mx-auto">
              Get AI-powered suggestions for flights, accommodations, and activities based on your group's preferences
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-3xl font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all glass-card-hover disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center gap-2 mx-auto"
            >
              {generating ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Group Recommendations
                </>
              )}
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

  const flights = suggestions?.suggestions.flights || [];
  const accommodations = suggestions?.suggestions.accommodations || [];
  const activities = suggestions?.suggestions.activities || [];

  const tabs = [
    { id: 'flights' as TabType, label: '✈️ Flights', count: flights.length },
    { id: 'stays' as TabType, label: '🏨 Stays', count: accommodations.length },
    { id: 'activities' as TabType, label: '🎡 Activities', count: activities.length },
    {
      id: 'itinerary' as TabType,
      label: '📅 Itinerary',
      count:
        flights.filter((f) => isApprovedByAll('flight', f.id)).length +
        accommodations.filter((a) => isApprovedByAll('accommodation', a.id)).length +
        activities.filter((a) => isApprovedByAll('activity', a.id)).length,
    },
  ];

  // Find cheapest and fastest flight for "Best Value" tag
  const cheapestFlight = flights.length > 0 ? flights.reduce((prev, curr) => (prev.price < curr.price ? prev : curr)) : null;
  const fastestFlight = flights.length > 0 ? flights.reduce((prev, curr) => {
    const prevDuration = parseInt(prev.duration.replace(/[^\d]/g, ''));
    const currDuration = parseInt(curr.duration.replace(/[^\d]/g, ''));
    return prevDuration < currDuration ? prev : curr;
  }) : null;

  return (
    <div className="min-h-screen pb-8">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <h1 className="text-4xl font-bold text-white mb-10 tracking-tight">Trip Suggestions</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-white/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-semibold rounded-t-2xl transition-all relative ${
                activeTab === tab.id
                  ? 'text-white bg-slate-900/60 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              {tab.label} <span className="text-sm opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="glass-card border-red-500/50 bg-red-500/10 text-red-200 px-4 py-3 rounded-3xl mb-6">
            {error}
          </div>
        )}

        {/* Flights Tab - Vertical Stack Layout */}
        {activeTab === 'flights' && (
          <>
            {/* Map Path Overlay */}
            {hoveredFlightId && (
              <FlightMapPath
                origin={flights.find(f => f.id === hoveredFlightId)?.departure || { airport: '' }}
                destination={flights.find(f => f.id === hoveredFlightId)?.arrival || { airport: '' }}
                isHovered={!!hoveredFlightId}
              />
            )}
            
            <div className="flex flex-col gap-6">
              {flights.map((flight, index) => {
              const isCheapest = cheapestFlight?.id === flight.id;
              const isFastest = fastestFlight?.id === flight.id;
              const voteCount = getVoteCount('flight', flight.id);
              const userVote = getUserVote('flight', flight.id);
              const airlineDomain = getAirlineDomain(flight.airline);
              const isApproved = isApprovedByAll('flight', flight.id);
              const voteKey = `flight_${flight.id}`;
              const hasPulse = votingPulse === voteKey;

              return (
                <motion.div
                  key={flight.id}
                  data-flight-id={flight.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  onMouseEnter={() => setHoveredFlightId(flight.id)}
                  onMouseLeave={() => setHoveredFlightId(null)}
                  className={`glass-edge glass-card rounded-3xl p-6 glass-card-hover ${
                    isApproved ? 'golden-state' : ''
                  } ${hasPulse ? 'voting-pulse' : ''}`}
                >
                  {/* Top Row: Flight Route + Price + Tags */}
                  <div className="flex items-start justify-between mb-6">
                    {/* Origin -> Destination in single line */}
                    <div className="flex-1 flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-bold text-white">{flight.departure.airport}</div>
                        <div className="text-sm text-slate-400">{flight.departure.time}</div>
                      </div>
                      <div className="text-slate-500">→</div>
                      <div className="flex items-center gap-2">
                        <div className="text-2xl font-bold text-white">{flight.arrival.airport}</div>
                        <div className="text-sm text-slate-400">{flight.arrival.time}</div>
                      </div>
                    </div>

                    {/* Price + Tags in top right */}
                    <div className="flex items-start gap-4">
                      {/* Tags as pills in top right */}
                      {(isCheapest || isFastest) && (
                        <div className="flex flex-col gap-2">
                          {isCheapest && (
                            <span className="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-full border border-emerald-500/30 font-medium">
                              Cheapest
                            </span>
                          )}
                          {isFastest && (
                            <span className="text-xs bg-blue-500/20 text-blue-300 px-3 py-1.5 rounded-full border border-blue-500/30 font-medium">
                              Fastest
                            </span>
                          )}
                          {isCheapest && isFastest && (
                            <span className="text-xs bg-amber-500/20 text-amber-300 px-3 py-1.5 rounded-full border border-amber-500/30 font-medium">
                              Best Value
                            </span>
                          )}
                        </div>
                      )}
                      <div className="text-right">
                        <div className="text-4xl font-black text-white">${flight.price}</div>
                      </div>
                    </div>
                  </div>

                  {/* Middle Row: Airline Logo */}
                  <div className="flex items-center gap-4 mb-6">
                    <img
                      src={`https://logo.clearbit.com/${airlineDomain}`}
                      alt={flight.airline}
                      className="h-12 w-12 rounded-lg bg-white/10 p-2"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="text-sm text-slate-300">
                      {flight.duration}
                      {flight.layovers > 0 && ` • ${flight.layovers} layover${flight.layovers > 1 ? 's' : ''} ${flight.layoverAirports.join(', ')}`}
                    </div>
                  </div>

                  {/* Bottom Row: Vote Count + Action Buttons */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm text-slate-400">
                      {voteCount}/{membersCount} members approve
                    </div>

                    <div className="flex gap-3">
                      {/* Approve Button - Emerald Gradient with Checkmark - Magnetic */}
                      <MagneticButton
                        onClick={() => handleVote('flight', flight.id, true)}
                        className={`px-6 py-3 rounded-2xl font-semibold transition-all flex items-center gap-2 ${
                          userVote === true
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
                            : 'bg-white/5 text-slate-300 hover:bg-gradient-to-r hover:from-emerald-500 hover:to-teal-600 hover:text-white hover:shadow-lg hover:shadow-emerald-500/30 border border-white/10'
                        }`}
                      >
                        <Check className={`w-5 h-5 ${userVote === true ? 'text-white' : 'text-emerald-400'}`} strokeWidth={2.5} />
                        Approve
                      </MagneticButton>

                      {/* Reject Button - Ghost with border */}
                      <button
                        onClick={() => handleVote('flight', flight.id, false)}
                        className={`px-6 py-3 rounded-2xl font-semibold transition-all border ${
                          userVote === false
                            ? 'bg-red-500/20 text-red-300 border-red-500/50'
                            : 'bg-transparent text-red-400 border-red-500/50 hover:bg-red-500/20 hover:text-red-300'
                        }`}
                      >
                        Reject
                      </button>

                      {/* Book Button - Purple/Blue Gradient with Neon Shadow - Magnetic */}
                      <MagneticButton
                        href={flight.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-700 text-white rounded-2xl font-semibold hover:from-indigo-700 hover:to-violet-800 transition-all shadow-lg shadow-violet-600/40 hover:shadow-xl hover:shadow-violet-600/50"
                      >
                        Book
                      </MagneticButton>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
        )}

        {/* Accommodations Tab */}
        {activeTab === 'stays' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accommodations.map((accommodation) => {
              const voteCount = getVoteCount('accommodation', accommodation.id);
              const userVote = getUserVote('accommodation', accommodation.id);
              const stars = Math.round(accommodation.rating);
              const isApproved = isApprovedByAll('accommodation', accommodation.id);
              const voteKey = `accommodation_${accommodation.id}`;
              const hasPulse = votingPulse === voteKey;

              return (
                <div
                  key={accommodation.id}
                  className={`glass-card p-6 glass-card-hover ${
                    isApproved ? 'golden-state' : ''
                  } ${hasPulse ? 'voting-pulse' : ''}`}
                >
                  {/* Name & Rating */}
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-white mb-2 tracking-tight">{accommodation.name}</h3>
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
                    <div className="text-2xl font-bold text-white">${accommodation.pricePerNight}/night</div>
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
                      className={`flex-1 px-4 py-2 rounded-xl font-semibold transition-all glass-card-hover ${
                        userVote === true
                          ? 'bg-green-500/30 text-green-300 border border-green-500/50'
                          : 'bg-white/5 text-slate-200 hover:bg-green-500/20 hover:text-green-300 border border-white/10'
                      }`}
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => handleVote('accommodation', accommodation.id, false)}
                      className={`flex-1 px-4 py-2 rounded-xl font-semibold transition-all glass-card-hover ${
                        userVote === false
                          ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                          : 'bg-white/5 text-slate-200 hover:bg-red-500/20 hover:text-red-300 border border-white/10'
                      }`}
                    >
                      ✗ Reject
                    </button>
                    <a
                      href={accommodation.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all glass-card-hover"
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
              const isApproved = isApprovedByAll('activity', activity.id);
              const voteKey = `activity_${activity.id}`;
              const hasPulse = votingPulse === voteKey;

              return (
                <div
                  key={activity.id}
                  className={`glass-card p-6 glass-card-hover ${
                    isApproved ? 'golden-state' : ''
                  } ${hasPulse ? 'voting-pulse' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-white tracking-tight">{activity.name}</h3>
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
                        className={`px-4 py-2 rounded-xl font-semibold transition-all glass-card-hover ${
                          userVote === true
                            ? 'bg-green-500/30 text-green-300 border border-green-500/50'
                            : 'bg-white/5 text-slate-200 hover:bg-green-500/20 hover:text-green-300 border border-white/10'
                        }`}
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleVote('activity', activity.id, false)}
                        className={`px-4 py-2 rounded-xl font-semibold transition-all glass-card-hover ${
                          userVote === false
                            ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                            : 'bg-white/5 text-slate-200 hover:bg-red-500/20 hover:text-red-300 border border-white/10'
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

        {/* Itinerary Tab */}
        {activeTab === 'itinerary' && (
          <div className="space-y-6">
            {membersCount === 0 && (
              <div className="card-surface rounded-2xl p-6 text-slate-300">
                Trip members are still loading. Try again in a moment.
              </div>
            )}

            {membersCount > 0 && (
              <>
                <div className="card-surface rounded-2xl p-6">
                  <h2 className="text-xl font-semibold text-white mb-4 tracking-tight">✅ Approved Flights</h2>
                  {flights.filter((f) => isApprovedByAll('flight', f.id)).length === 0 ? (
                    <p className="text-slate-400">No flights approved by everyone yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {flights
                        .filter((f) => isApprovedByAll('flight', f.id))
                        .map((flight) => (
                          <div
                            key={flight.id}
                            className="p-4 rounded-xl bg-slate-800 border border-slate-700"
                          >
                            <div className="flex justify-between items-center mb-2">
                              <div className="text-white font-semibold">{flight.airline}</div>
                              <div className="text-slate-200 font-semibold">${flight.price}</div>
                            </div>
                            <div className="text-sm text-slate-300">
                              {flight.departure.airport} → {flight.arrival.airport} • {flight.duration}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div className="card-surface rounded-2xl p-6">
                  <h2 className="text-xl font-semibold text-white mb-4 tracking-tight">✅ Approved Stays</h2>
                  {accommodations.filter((a) => isApprovedByAll('accommodation', a.id)).length === 0 ? (
                    <p className="text-slate-400">No stays approved by everyone yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {accommodations
                        .filter((a) => isApprovedByAll('accommodation', a.id))
                        .map((accommodation) => (
                          <div
                            key={accommodation.id}
                            className="p-4 rounded-xl bg-slate-800 border border-slate-700"
                          >
                            <div className="flex justify-between items-center mb-2">
                              <div className="text-slate-50 font-semibold">{accommodation.name}</div>
                              <div className="text-slate-200 font-semibold">
                                ${accommodation.pricePerNight}/night
                              </div>
                            </div>
                            <div className="text-sm text-slate-300">
                              {accommodation.type} • {accommodation.location}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div className="card-surface rounded-2xl p-6">
                  <h2 className="text-xl font-semibold text-slate-50 mb-4">✅ Approved Activities</h2>
                  {activities.filter((a) => isApprovedByAll('activity', a.id)).length === 0 ? (
                    <p className="text-slate-400">No activities approved by everyone yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {activities
                        .filter((a) => isApprovedByAll('activity', a.id))
                        .map((activity) => (
                          <div
                            key={activity.id}
                            className="p-4 rounded-xl bg-slate-800 border border-slate-700"
                          >
                            <div className="flex justify-between items-center mb-2">
                              <div className="text-slate-50 font-semibold">{activity.name}</div>
                              <div className="text-slate-200 font-semibold">
                                {activity.price === 0 ? 'Free' : `$${activity.price}`}
                              </div>
                            </div>
                            <div className="text-sm text-slate-300">
                              {activity.type} • {activity.location}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
