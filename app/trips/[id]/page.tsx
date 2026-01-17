'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth, useTripMember } from '@/lib/auth';
import { TripRow, TripMemberRow, UserPreferencesRow } from '@/lib/supabase';

interface MemberWithStatus extends TripMemberRow {
  hasPreferences: boolean;
}

type ModuleStatus = 'Awaiting Preferences' | 'Ready to Generate' | 'Locked';

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const { user, loading: authLoading, signOut } = useAuth();
  const { isMember, loading: memberLoading } = useTripMember(tripId);
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [members, setMembers] = useState<MemberWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // Auth protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth?redirect=${encodeURIComponent(`/trips/${tripId}`)}`);
      return;
    }

    if (!authLoading && user && !memberLoading && isMember === false) {
      // User is logged in but not a member - redirect to join
      router.push(`/trips/join?code=&redirect=${encodeURIComponent(`/trips/${tripId}`)}`);
      return;
    }

    if (!authLoading && user && isMember) {
      fetchDashboardData();
    }
  }, [authLoading, user, memberLoading, isMember, tripId, router]);

  const fetchDashboardData = async () => {
    try {
      // Fetch trip from Supabase
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (tripError || !tripData) {
        setError('Trip not found');
        setLoading(false);
        return;
      }

      setTrip(tripData);

      // Fetch trip members
      const { data: membersData, error: membersError } = await supabase
        .from('trip_members')
        .select('*')
        .eq('trip_id', tripId)
        .order('joined_at', { ascending: true });

      if (membersError) throw membersError;

      // Fetch all user preferences for this trip
      const { data: preferencesData, error: preferencesError } = await supabase
        .from('user_preferences')
        .select('member_id')
        .eq('trip_id', tripId);

      if (preferencesError) throw preferencesError;

      // Create a set of member IDs who have preferences
      const membersWithPreferences = new Set(
        (preferencesData || []).map((p) => p.member_id)
      );

      // Map members with status
      const membersWithStatus: MemberWithStatus[] = (membersData || []).map(
        (member) => ({
          ...member,
          hasPreferences: membersWithPreferences.has(member.id),
        })
      );

      setMembers(membersWithStatus);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message || 'Failed to load trip');
    } finally {
      setLoading(false);
    }
  };

  const getModuleStatus = (moduleName: string): ModuleStatus => {
    const membersWithPrefs = members.filter((m) => m.hasPreferences).length;
    
    if (membersWithPrefs === 0) {
      return 'Awaiting Preferences';
    }
    
    // For MVP, assume all modules need preferences first
    // Later this can check if flights/accommodations/activities have been generated
    return 'Ready to Generate';
  };

  const handleGenerate = async () => {
    const membersWithPrefs = members.filter((m) => m.hasPreferences).length;
    if (membersWithPrefs === 0) return;

    setGenerating(true);
    
    // Simulate AI "thinking" - just show loading state
    setTimeout(() => {
      setGenerating(false);
      // TODO: Actual AI integration will go here
    }, 2000);
  };

  const membersWithPreferences = members.filter((m) => m.hasPreferences).length;
  const canGenerate = membersWithPreferences > 0;

  if (authLoading || memberLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-900 py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Loading Skeleton */}
          <div className="mb-6">
            <div className="h-12 bg-slate-800 rounded-lg w-64 mb-4 animate-pulse"></div>
            <div className="h-6 bg-slate-800 rounded-lg w-48 animate-pulse"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="card-surface rounded-lg p-6 h-32 animate-pulse"
              ></div>
            ))}
          </div>

          <div className="card-surface rounded-lg p-6 mb-6">
            <div className="h-6 bg-slate-700 rounded w-48 mb-4 animate-pulse"></div>
            <div className="flex gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 bg-slate-700 rounded-full w-24 animate-pulse"
                ></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
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
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="card-surface shadow border-b border-slate-700">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <Link
                href="/"
                className="text-blue-400 hover:text-blue-300 mb-2 inline-block text-sm underline"
              >
                ← Back to My Trips
              </Link>
              <h1 className="text-3xl font-bold text-slate-50">{trip.name}</h1>
              <p className="text-slate-300 mt-1">
                {trip.destination_city}, {trip.destination_country}
              </p>
            </div>
            <div className="flex gap-3 items-center">
              <Link
                href={`/trips/${tripId}/share`}
                className="bg-slate-700 text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-600 transition-colors"
              >
                Share Overview
              </Link>
              <button
                onClick={async () => {
                  await signOut();
                  router.push('/');
                }}
                className="bg-red-700 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Generate Button */}
        {canGenerate && (
          <div className="mb-6 flex justify-center">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className={`px-8 py-4 rounded-lg font-semibold text-lg transition-colors ${
                generating
                  ? 'bg-blue-400 text-white cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
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
                '✨ Generate Trip Options'
              )}
            </button>
          </div>
        )}

        {/* Member Status */}
        <div className="card-surface rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-slate-50">
            Trip Members ({members.length})
          </h2>
          <div className="flex flex-wrap gap-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="px-4 py-2 bg-slate-700 text-slate-200 rounded-full flex items-center gap-2 border border-slate-600"
              >
                <span>{member.name}</span>
                {member.hasPreferences ? (
                  <span className="text-xs bg-green-900 text-green-100 px-2 py-0.5 rounded border border-green-700">
                    ✅ Ready
                  </span>
                ) : (
                  <span className="text-xs bg-yellow-900 text-yellow-100 px-2 py-0.5 rounded border border-yellow-700">
                    ⏳ Thinking
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Progress Overview - Module Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* Flights Card */}
          <ModuleCard
            title="✈️ Flights"
            status={getModuleStatus('flights')}
            href={`/trips/${tripId}/flights`}
          />

          {/* Accommodations Card */}
          <ModuleCard
            title="🏨 Accommodations"
            status={getModuleStatus('accommodations')}
            href={`/trips/${tripId}/accommodation`}
          />

          {/* Activities Card */}
          <ModuleCard
            title="🎯 Activities"
            status={getModuleStatus('activities')}
            href={`/trips/${tripId}/activities`}
          />

          {/* Itinerary Card */}
          <ModuleCard
            title="📅 Itinerary"
            status={getModuleStatus('itinerary')}
            href={`/trips/${tripId}/itinerary`}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href={`/trips/${tripId}/preferences`}
            className="card-surface rounded-lg p-6 hover:bg-slate-700 transition-colors"
          >
            <h3 className="text-xl font-semibold mb-2 text-slate-50">
              ⚙️ Set Preferences
            </h3>
            <p className="text-slate-300 text-sm">
              Tell us what you want for this trip
            </p>
          </Link>

          <div className="card-surface rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4 text-slate-50">
              🔗 Invite Friends
            </h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={trip.invite_code}
                  className="flex-1 px-3 py-2 border border-slate-600 rounded-lg bg-slate-700 font-mono text-sm font-bold text-center text-slate-50"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(trip.invite_code);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
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
    </div>
  );
}

// Module Card Component
function ModuleCard({
  title,
  status,
  href,
}: {
  title: string;
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
        return '✅';
      case 'Locked':
        return '🔒';
      default:
        return '⏳';
    }
  };

  return (
    <Link
      href={href}
      className="card-surface rounded-lg p-6 hover:bg-slate-700 transition-colors"
    >
      <h3 className="text-xl font-semibold mb-3 text-slate-50">{title}</h3>
      <div className="flex items-center gap-2">
        <span className="text-lg">{getStatusIcon()}</span>
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {status}
        </span>
      </div>
    </Link>
  );
}