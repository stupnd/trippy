'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { TripRow } from '@/lib/supabase';

interface UserTrip extends TripRow {
  joined_at: string;
  member_name: string;
}

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [trips, setTrips] = useState<UserTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Not logged in - show landing page, no need to fetch trips
      setLoading(false);
      return;
    }

    // User is logged in - fetch their trips
    fetchUserTrips();
  }, [user, authLoading]);

  const fetchUserTrips = async () => {
    try {
      // Fetch trip memberships for current user
      const { data: memberships, error: membersError } = await supabase
        .from('trip_members')
        .select('trip_id, joined_at, name')
        .eq('user_id', user!.id) // Use user_id column, not id
        .order('joined_at', { ascending: false });

      if (membersError) throw membersError;

      if (!memberships || memberships.length === 0) {
        setTrips([]);
        setLoading(false);
        return;
      }

      // Fetch trip details for each membership
      const tripIds = memberships.map((m) => m.trip_id);
      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select('*')
        .in('id', tripIds);

      if (tripsError) throw tripsError;

      // Combine trip data with membership data
      const userTrips: UserTrip[] = (tripsData || []).map((trip) => {
        const membership = memberships.find((m) => m.trip_id === trip.id);
        return {
          ...trip,
          joined_at: membership?.joined_at || '',
          member_name: membership?.name || '',
        };
      });

      // Sort by most recently joined
      userTrips.sort((a, b) => 
        new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime()
      );

      setTrips(userTrips);
    } catch (error: any) {
      console.error('Error fetching user trips:', error);
      setError('Failed to load your trips');
    } finally {
      setLoading(false);
    }
  };

  // Show loading skeleton while checking auth
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-900 py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="mb-6">
            <div className="h-10 bg-slate-800 rounded-lg w-64 mb-4 animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="card-surface rounded-lg p-6 h-48 animate-pulse"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Landing page for non-authenticated users
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-6xl font-bold text-slate-50 mb-4">
              Trippy
            </h1>
            <p className="text-xl text-slate-300 mb-12">
              Plan your next adventure together with your group
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth"
                className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
              >
                Sign In to Get Started
              </Link>
              <Link
                href="/trips/join"
                className="card-surface text-slate-50 px-8 py-4 rounded-lg font-semibold hover:bg-slate-700 transition-colors shadow-lg border-2 border-slate-600"
              >
                Join a Trip
              </Link>
            </div>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              <div className="card-surface p-6 rounded-lg shadow">
                <h3 className="text-xl font-semibold mb-2 text-slate-50">📅 Plan Together</h3>
                <p className="text-slate-300">
                  Collaborate on flights, accommodations, and activities with your group
                </p>
              </div>
              <div className="card-surface p-6 rounded-lg shadow">
                <h3 className="text-xl font-semibold mb-2 text-slate-50">✈️ Find Flights</h3>
                <p className="text-slate-300">
                  Get smart recommendations based on everyone's preferences
                </p>
              </div>
              <div className="card-surface p-6 rounded-lg shadow">
                <h3 className="text-xl font-semibold mb-2 text-slate-50">🎯 Build Itinerary</h3>
                <p className="text-slate-300">
                  Create a day-by-day plan that works for everyone
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // User Dashboard - show user's trips
  return (
    <div className="min-h-screen bg-slate-900 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-50 mb-2">My Trips</h1>
            <p className="text-slate-300">
              Welcome back! Manage and view all your trips
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/trips/join"
              className="border border-slate-600 text-slate-200 px-6 py-3 rounded-lg font-semibold hover:bg-slate-700 transition-colors"
            >
              Join Trip
            </Link>
            <Link
              href="/trips/new"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              + Create New Trip
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Empty State */}
        {trips.length === 0 && !error && (
          <div className="card-surface rounded-lg p-12 text-center">
            <h2 className="text-2xl font-semibold text-slate-50 mb-4">
              You haven't planned any trips yet!
            </h2>
            <p className="text-slate-300 mb-6">
              Start by creating one or joining with a code.
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/trips/new"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Create a Trip
              </Link>
              <Link
                href="/trips/join"
                className="border border-slate-600 text-slate-200 px-6 py-3 rounded-lg font-semibold hover:bg-slate-700 transition-colors"
              >
                Join with Code
              </Link>
            </div>
          </div>
        )}

        {/* Trip Cards Grid */}
        {trips.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className="card-surface rounded-lg p-6 hover:bg-slate-700 transition-colors"
              >
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-slate-50 mb-2">
                    {trip.name}
                  </h3>
                  <p className="text-slate-300 text-sm">
                    {trip.destination_city}, {trip.destination_country}
                  </p>
                </div>

                <div className="mb-4 space-y-2 text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>📅</span>
                    <span>
                      {format(new Date(trip.start_date), 'MMM d')} -{' '}
                      {format(new Date(trip.end_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>👤</span>
                    <span>Joined as: {trip.member_name}</span>
                  </div>
                </div>

                <Link
                  href={`/trips/${trip.id}`}
                  className="block w-full bg-blue-600 text-white text-center px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  View Trip →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}