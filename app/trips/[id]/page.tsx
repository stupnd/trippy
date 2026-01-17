'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plane, Hotel, Target, Calendar, Settings, Sparkles, Share2, Trash2, LogOut, Users, Circle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, useTripMember } from '@/lib/auth';
import { TripRow, TripMemberRow } from '@/lib/supabase';

interface MemberWithStatus extends TripMemberRow {
  hasPreferences: boolean;
}

type ModuleStatus = 'Awaiting Preferences' | 'Ready to Generate' | 'Locked';

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const { isMember, loading: memberLoading } = useTripMember(tripId);
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [members, setMembers] = useState<MemberWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [preferencesUpdatedAt, setPreferencesUpdatedAt] = useState<string | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetError, setBudgetError] = useState('');
  const [error, setError] = useState('');

  // Auth protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth?redirect=${encodeURIComponent(`/trips/${tripId}`)}`);
      return;
    }

    if (!authLoading && user && !memberLoading && isMember === false) {
      router.push(`/trips/join?code=&redirect=${encodeURIComponent(`/trips/${tripId}`)}`);
      return;
    }

    if (!authLoading && user && isMember) {
      fetchDashboardData();
    }
  }, [authLoading, user, memberLoading, isMember, tripId, router]);

  const fetchDashboardData = async () => {
    try {
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .maybeSingle();

      if (tripError && tripError.code !== 'PGRST116') {
        throw tripError;
      }

      if (!tripData) {
        router.push(`/trips/join?redirect=${encodeURIComponent(`/trips/${tripId}`)}`);
        return;
      }

      setTrip(tripData);

      const { data: membersData, error: membersError } = await supabase
        .from('trip_members')
        .select('*')
        .eq('trip_id', tripId)
        .order('joined_at', { ascending: true });

      if (membersError) throw membersError;

      const { data: preferencesData, error: preferencesError } = await supabase
        .from('user_preferences')
        .select('member_id, updated_at')
        .eq('trip_id', tripId);

      if (preferencesError) throw preferencesError;

      const membersWithPreferences = new Set(
        (preferencesData || []).map((p) => p.member_id)
      );

      const membersWithStatus: MemberWithStatus[] = (membersData || []).map(
        (member) => ({
          ...member,
          hasPreferences: membersWithPreferences.has(member.id),
        })
      );

      setMembers(membersWithStatus);

      const latestPreferenceUpdate =
        (preferencesData || [])
          .map((p) => p.updated_at)
          .filter((value): value is string => !!value)
          .sort()
          .pop() || null;
      setPreferencesUpdatedAt(latestPreferenceUpdate);

      // After fetching, check if user is actually a member
      // If not found in members list, redirect to join
      if (user && membersWithStatus.length > 0) {
        const userIsMember = membersWithStatus.some(m => {
          return (m as any).user_id === user.id || m.id === user.id;
        });
        if (!userIsMember) {
          router.push(`/trips/join?code=&redirect=${encodeURIComponent(`/trips/${tripId}`)}`);
          return;
        }
      }
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message || 'Failed to load trip');
      if (user && error.code === 'PGRST116') {
        router.push(`/trips/join?redirect=${encodeURIComponent(`/trips/${tripId}`)}`);
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  const getModuleStatus = (moduleName: string): ModuleStatus => {
    const membersWithPrefs = members.filter((m) => m.hasPreferences).length;
    
    if (membersWithPrefs === 0) {
      return 'Awaiting Preferences';
    }
    
    return 'Ready to Generate';
  };

  const handleGenerate = async () => {
    const membersWithPrefs = members.filter((m) => m.hasPreferences).length;
    if (membersWithPrefs === 0) return;

    setGenerating(true);
    
    setTimeout(() => {
      setGenerating(false);
    }, 2000);
  };

  const membersWithPreferences = members.filter((m) => m.hasPreferences).length;
  const canGenerate = membersWithPreferences > 0;
  const isCreator = !!user && !!trip && user.id === trip.created_by;

  const hashString = (value: string) => {
    let hash = 5381;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 33) ^ value.charCodeAt(i);
    }
    return (hash >>> 0).toString(16);
  };

  const getApprovedItemsFromCache = () => {
    if (typeof window === 'undefined' || members.length === 0) {
      return {
        flights: [],
        accommodations: [],
        activities: [],
        counts: { flights: 0, accommodations: 0, activities: 0 },
      };
    }

    const suggestionsRaw = localStorage.getItem(`suggestions_${tripId}`);
    const votesRaw = localStorage.getItem(`votes_${tripId}`);
    if (!suggestionsRaw) {
      return {
        flights: [],
        accommodations: [],
        activities: [],
        counts: { flights: 0, accommodations: 0, activities: 0 },
      };
    }

    let suggestions;
    try {
      suggestions = JSON.parse(suggestionsRaw);
    } catch {
      return {
        flights: [],
        accommodations: [],
        activities: [],
        counts: { flights: 0, accommodations: 0, activities: 0 },
      };
    }

    let votes: Record<string, Record<string, boolean>> = {};
    if (votesRaw) {
      try {
        votes = JSON.parse(votesRaw);
      } catch {
        votes = {};
      }
    }

    const membersCount = members.length;
    const voteCountFor = (key: string) => {
      const optionVotes = votes[key] || {};
      return Object.values(optionVotes).filter(Boolean).length;
    };

    const flights = suggestions?.suggestions?.flights || [];
    const accommodations = suggestions?.suggestions?.accommodations || [];
    const activities = suggestions?.suggestions?.activities || [];

    return {
      flights: flights.filter((item: any) => voteCountFor(`flight_${item.id}`) === membersCount),
      accommodations: accommodations.filter((item: any) => voteCountFor(`accommodation_${item.id}`) === membersCount),
      activities: activities.filter((item: any) => voteCountFor(`activity_${item.id}`) === membersCount),
      counts: {
        flights: flights.length,
        accommodations: accommodations.length,
        activities: activities.length,
      },
    };
  };

  const maybeUpdateSummary = async (force = false) => {
    if (!trip || members.length === 0) return;

    const approved = getApprovedItemsFromCache();
    const summaryInput = JSON.stringify({
      tripId,
      trip: {
        destination_city: trip.destination_city,
        destination_country: trip.destination_country,
        start_date: trip.start_date,
        end_date: trip.end_date,
        timezone: trip.timezone,
      },
      members: members.map((m) => ({ id: m.id, name: m.name })),
      preferencesUpdatedAt,
      approvedIds: {
        flights: approved.flights.map((item: any) => item.id),
        accommodations: approved.accommodations.map((item: any) => item.id),
        activities: approved.activities.map((item: any) => item.id),
      },
      counts: approved.counts,
    });

    const summaryHash = hashString(summaryInput);
    const hashKey = `summary_hash_${tripId}`;
    const previousHash = typeof window !== 'undefined' ? localStorage.getItem(hashKey) : null;

    if (!force && previousHash === summaryHash && trip.summary) {
      return;
    }

    setSummaryLoading(true);
    setSummaryError('');

    try {
      const response = await fetch('/api/generate-trip-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
          approved: {
            flights: approved.flights,
            accommodations: approved.accommodations,
            activities: approved.activities,
          },
          available_counts: approved.counts,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate trip summary');
      }

      setTrip((prev) =>
        prev
          ? {
              ...prev,
              summary: data.summary,
              summary_updated_at: data.summary_updated_at,
            }
          : prev
      );

      if (typeof window !== 'undefined') {
        localStorage.setItem(hashKey, summaryHash);
      }
    } catch (summaryError: any) {
      console.error('Error generating trip summary:', summaryError);
      setSummaryError(summaryError.message || 'Failed to generate trip summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  const maybeUpdateBudget = async (force = false) => {
    if (!trip || members.length === 0) return;

    const budgetInput = JSON.stringify({
      tripId,
      destination_city: trip.destination_city,
      destination_country: trip.destination_country,
      start_date: trip.start_date,
      end_date: trip.end_date,
      timezone: trip.timezone,
      members: members.map((m) => ({ id: m.id, name: m.name })),
      preferencesUpdatedAt,
    });

    const budgetHash = hashString(budgetInput);
    const hashKey = `budget_hash_${tripId}`;
    const previousHash = typeof window !== 'undefined' ? localStorage.getItem(hashKey) : null;

    if (!force && previousHash === budgetHash && trip.budget_min != null && trip.budget_max != null) {
      return;
    }

    setBudgetLoading(true);
    setBudgetError('');

    try {
      const response = await fetch('/api/generate-trip-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate trip budget');
      }

      setTrip((prev) =>
        prev
          ? {
              ...prev,
              budget_min: data.budget_min,
              budget_max: data.budget_max,
              budget_updated_at: data.budget_updated_at,
            }
          : prev
      );

      if (typeof window !== 'undefined') {
        localStorage.setItem(hashKey, budgetHash);
      }
    } catch (budgetError: any) {
      console.error('Error generating trip budget:', budgetError);
      setBudgetError(budgetError.message || 'Failed to generate trip budget');
    } finally {
      setBudgetLoading(false);
    }
  };

  const handleDeleteTrip = async () => {
    if (!trip || !user || user.id !== trip.created_by) return;
    const confirmed = window.confirm(
      'Delete this trip for everyone? This cannot be undone.'
    );
    if (!confirmed) return;

    setDeleting(true);
    setError('');

    try {
      const { error: preferencesError } = await supabase
        .from('user_preferences')
        .delete()
        .eq('trip_id', tripId);
      if (preferencesError) throw preferencesError;

      const { error: membersError } = await supabase
        .from('trip_members')
        .delete()
        .eq('trip_id', tripId);
      if (membersError) throw membersError;

      const { error: tripError } = await supabase
        .from('trips')
        .delete()
        .eq('id', tripId);
      if (tripError) throw tripError;

      if (typeof window !== 'undefined') {
        localStorage.removeItem(`suggestions_${tripId}`);
        localStorage.removeItem(`votes_${tripId}`);
      }

      router.push('/');
    } catch (deleteError: any) {
      console.error('Error deleting trip:', deleteError);
      setError(deleteError.message || 'Failed to delete trip');
      setDeleting(false);
    }
  };

  const handleLeaveTrip = async () => {
    if (!user || !trip || user.id === trip.created_by) return;
    const confirmed = window.confirm('Leave this trip? You can rejoin with the invite code.');
    if (!confirmed) return;

    setLeaving(true);
    setError('');

    try {
      const { error: leaveError } = await supabase
        .from('trip_members')
        .delete()
        .eq('trip_id', tripId)
        .eq('user_id', user.id);
      if (leaveError) throw leaveError;

      if (typeof window !== 'undefined') {
        localStorage.removeItem(`suggestions_${tripId}`);
        localStorage.removeItem(`votes_${tripId}`);
      }

      router.push('/');
    } catch (leaveError: any) {
      console.error('Error leaving trip:', leaveError);
      setError(leaveError.message || 'Failed to leave trip');
      setLeaving(false);
    }
  };

  useEffect(() => {
    if (trip && members.length > 0) {
      maybeUpdateSummary();
      maybeUpdateBudget();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, members.length, preferencesUpdatedAt]);

  if (authLoading || memberLoading || loading) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="mb-6">
            <div className="h-12 bg-white/5 rounded-3xl w-64 mb-4 shimmer-loader"></div>
            <div className="h-6 bg-white/5 rounded-3xl w-48 shimmer-loader"></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="glass-card p-6 h-32 shimmer-loader"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-50 mb-4">
            {error || 'Trip not found'}
          </h1>
          <Link href="/" className="text-blue-400 hover:underline">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  const inviteLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/trips/join?code=${trip.invite_code}`
      : '';

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="glass-card border-b border-white/10 mb-8">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <Link
                href="/"
                className="text-blue-400 hover:text-blue-300 mb-2 inline-flex items-center gap-2 text-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to My Trips
              </Link>
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="text-4xl font-bold text-slate-50">{trip.name}</h1>
                <div className="px-3 py-1 rounded-full glass-card text-slate-200 text-sm border border-white/10">
                  {budgetLoading ? (
                    <span>Budget: calculating...</span>
                  ) : trip.budget_min != null && trip.budget_max != null ? (
                    <span>Budget: ${trip.budget_min} - ${trip.budget_max}</span>
                  ) : (
                    <span>Budget: not set</span>
                  )}
                </div>
              </div>
              <p className="text-slate-300">
                {trip.destination_city}, {trip.destination_country}
              </p>
              {budgetError && (
                <p className="text-xs text-red-300 mt-2">{budgetError}</p>
              )}
            </div>
            <div className="flex gap-3 items-center">
              <Link
                href={`/trips/${tripId}/share`}
                className="glass-card px-4 py-2 rounded-xl font-semibold text-slate-200 hover:bg-white/10 transition-all glass-card-hover flex items-center gap-2"
              >
                <Share2 className="w-4 h-4 opacity-70" />
                Share
              </Link>
              {isCreator && (
                <button
                  onClick={handleDeleteTrip}
                  disabled={deleting}
                  className="glass-card px-4 py-2 rounded-xl font-semibold text-red-300 hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
              {!isCreator && (
                <button
                  onClick={handleLeaveTrip}
                  disabled={leaving}
                  className="glass-card px-4 py-2 rounded-xl font-semibold text-slate-200 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  {leaving ? 'Leaving...' : 'Leave'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {error && (
          <div className="glass-card border-red-500/50 bg-red-500/10 text-red-200 px-4 py-3 rounded-3xl mb-6">
            {error}
          </div>
        )}

        {/* Generate Button */}
        {canGenerate && (
          <div className="mb-8 flex justify-center">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className={`px-8 py-4 rounded-3xl font-semibold text-lg transition-all glass-card-hover ${
                generating
                  ? 'bg-blue-500/30 text-white cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg'
              }`}
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Generating Trip Options...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Generate Trip Options
                </span>
              )}
            </button>
          </div>
        )}

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          {/* Member Status - Large Card */}
          <div className="md:col-span-2 glass-card p-6 glass-card-hover">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-6 h-6 text-blue-400 opacity-80" />
              <h2 className="text-xl font-semibold text-slate-50">
                Trip Members ({members.length})
              </h2>
              <div className="flex items-center gap-2 ml-auto">
                <Circle className="w-2 h-2 fill-red-500 text-red-500 live-pulse" />
                <span className="text-xs text-slate-400">Live</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="glass-card px-4 py-2 rounded-full flex items-center gap-2 border-white/10"
                >
                  <span className="text-slate-200 font-medium">{member.name}</span>
                  {member.hasPreferences ? (
                    <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full border border-green-500/30">
                      ✓ Ready
                    </span>
                  ) : (
                    <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-500/30">
                      ⏳ Thinking
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Preferences Card */}
          <Link
            href={`/trips/${tripId}/preferences`}
            className="glass-card p-6 glass-card-hover"
          >
            <Settings className="w-8 h-8 text-purple-400 opacity-80 mb-3" />
            <h3 className="text-lg font-semibold mb-2 text-slate-50">
              Set Preferences
            </h3>
            <p className="text-slate-300 text-sm">
              Tell us what you want
            </p>
          </Link>

          {/* AI Suggestions Card */}
          <Link
            href={`/trips/${tripId}/suggestions`}
            className="glass-card p-6 glass-card-hover bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/20"
          >
            <Sparkles className="w-8 h-8 text-purple-400 opacity-80 mb-3" />
            <h3 className="text-lg font-semibold mb-2 text-slate-50">
              AI Suggestions
            </h3>
            <p className="text-slate-300 text-sm">
              View recommendations
            </p>
          </Link>
        </div>

        {/* Trip Summary */}
        <div className="card-surface rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-50">Trip Summary</h2>
            <button
              onClick={() => maybeUpdateSummary(true)}
              disabled={summaryLoading}
              className="px-4 py-2 text-sm bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {summaryLoading ? 'Updating...' : 'Refresh Summary'}
            </button>
          </div>
          {summaryError && (
            <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg mb-4">
              {summaryError}
            </div>
          )}
          {summaryLoading && !trip.summary && (
            <div className="text-slate-300">Generating summary...</div>
          )}
          {!summaryLoading && trip.summary && (
            <p className="text-slate-300 leading-relaxed whitespace-pre-line">
              {trip.summary}
            </p>
          )}
          {!summaryLoading && !trip.summary && !summaryError && (
            <p className="text-slate-400">
              Summary will appear here once generated.
            </p>
          )}
        </div>

        {/* Progress Overview - Module Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* Flights Card */}
          <ModuleCard
            title="Flights"
            icon={Plane}
            status={getModuleStatus('flights')}
            href={`/trips/${tripId}/suggestions?tab=flights`}
          />
          <ModuleCard
            title="Accommodations"
            icon={Hotel}
            status={getModuleStatus('accommodations')}
            href={`/trips/${tripId}/suggestions?tab=stays`}
          />
          <ModuleCard
            title="Activities"
            icon={Target}
            status={getModuleStatus('activities')}
            href={`/trips/${tripId}/suggestions?tab=activities`}
          />
          <ModuleCard
            title="Itinerary"
            icon={Calendar}
            status={getModuleStatus('itinerary')}
            href={`/trips/${tripId}/suggestions?tab=itinerary`}
          />
        </div>

        {/* Invite Card */}
        <div className="glass-card p-6">
          <h3 className="text-xl font-semibold mb-4 text-slate-50 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-400 opacity-80" />
            Invite Friends
          </h3>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={trip.invite_code}
                className="flex-1 px-4 py-3 border border-white/20 rounded-2xl bg-white/5 font-mono text-sm font-bold text-center text-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(trip.invite_code);
                }}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all glass-card-hover"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Share this code or{' '}
              <a
                href={inviteLink}
                className="text-blue-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                use the invite link
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Module Card Component
function ModuleCard({
  title,
  icon: Icon,
  status,
  href,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  status: ModuleStatus;
  href: string;
}) {
  const getStatusColor = () => {
    switch (status) {
      case 'Awaiting Preferences':
        return 'text-slate-400';
      case 'Ready to Generate':
        return 'text-green-400';
      case 'Locked':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'Awaiting Preferences':
        return '⏳';
      case 'Ready to Generate':
        return '✓';
      case 'Locked':
        return '🔒';
      default:
        return '⏳';
    }
  };

  return (
    <Link
      href={href}
      className="glass-card p-6 glass-card-hover flex flex-col"
    >
      <Icon className="w-8 h-8 text-blue-400 opacity-80 mb-3" />
      <h3 className="text-lg font-semibold mb-3 text-slate-50">{title}</h3>
      <div className="flex items-center gap-2 mt-auto">
        <span className={`text-lg ${getStatusColor()}`}>{getStatusIcon()}</span>
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {status}
        </span>
      </div>
    </Link>
  );
}
