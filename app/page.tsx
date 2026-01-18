'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { TripRow } from '@/lib/supabase';
import LandingPage from '@/components/LandingPage';

interface UserTrip extends TripRow {
  joined_at: string;
  member_name: string;
  member_id: string;
}

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [trips, setTrips] = useState<UserTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadByTrip, setUnreadByTrip] = useState<Record<string, number>>({});

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
        .select('id, trip_id, joined_at, name')
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
          member_id: membership?.id || '',
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

  useEffect(() => {
    if (!user || trips.length === 0) return;

    const channels = trips
      .filter((trip) => trip.member_id)
      .map((trip) => {
        const channel = supabase
          .channel(`home_unread_${trip.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `trip_id=eq.${trip.id}`,
            },
            (payload) => {
              const newMsg = payload.new as any;
              if (newMsg.member_id !== trip.member_id) {
                setUnreadByTrip((prev) => ({
                  ...prev,
                  [trip.id]: (prev[trip.id] || 0) + 1,
                }));
              }
            }
          )
          .subscribe();
        return channel;
      });

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [user, trips]);

  // Show loading skeleton while checking auth
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="mb-6">
            <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-lg w-64 mb-4 animate-pulse"></div>
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
    return <LandingPage />;
  }

  // User Dashboard - show user's trips
  return (
    <div className="min-h-screen pb-8">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">My Trips</h1>
            <p className="text-slate-700 dark:text-slate-300">
              Welcome back! Manage and view all your trips
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/trips/join"
              className="bg-sky-100 text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-sky-200 transition-all dark:glass-card dark:text-slate-200 dark:hover:bg-white/10"
            >
              Join Trip
            </Link>
            <Link
              href="/trips/new"
              className="bg-sky-200 text-slate-900 px-6 py-3 rounded-xl font-semibold hover:bg-sky-300 transition-all shadow-lg dark:bg-gradient-to-r dark:from-indigo-600 dark:to-violet-700 dark:text-white dark:hover:from-indigo-700 dark:hover:to-violet-800 dark:shadow-violet-600/40"
            >
              + Create New Trip
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 dark:bg-red-900 dark:border-red-700 dark:text-red-100">
            {error}
          </div>
        )}

        {trips.length > 0 && (
          <div className="mb-6 space-y-3">
            {trips
              .filter((trip) => (unreadByTrip[trip.id] || 0) > 0)
              .map((trip) => (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => {
                    setUnreadByTrip((prev) => ({ ...prev, [trip.id]: 0 }));
                    router.push(`/trips/${trip.id}?chat=1`);
                  }}
                  className="w-full bg-sky-200 text-slate-900 px-4 py-3 rounded-xl flex items-center justify-between hover:bg-sky-300 transition-all dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20"
                >
                  <span className="text-sm">
                    New chat message{(unreadByTrip[trip.id] || 0) > 1 ? 's' : ''} in {trip.name}
                  </span>
                  <span className="text-xs font-semibold bg-slate-900 text-white px-2 py-1 rounded-full dark:bg-white dark:text-slate-900">
                    Open chat
                  </span>
                </button>
              ))}
          </div>
        )}

        {/* Empty State */}
        {trips.length === 0 && !error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="glass-card rounded-3xl p-16 text-center max-w-2xl mx-auto"
          >
            <div className="text-6xl mb-6">✈️</div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-4 tracking-tight">
              Ready for an adventure?
            </h2>
            <p className="text-slate-700 dark:text-slate-300 mb-8 text-lg">
              Start planning your next trip with friends. Create a trip or join one with an invite code.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/trips/new"
                className="bg-sky-200 text-slate-900 px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-sky-300 transition-all shadow-xl dark:bg-gradient-to-r dark:from-indigo-600 dark:to-violet-700 dark:text-white dark:hover:from-indigo-700 dark:hover:to-violet-800 dark:shadow-violet-600/40 dark:hover:shadow-violet-600/50"
              >
                ✨ Create Your First Trip
              </Link>
              <Link
                href="/trips/join"
                className="bg-sky-100 text-slate-900 px-8 py-4 rounded-2xl font-semibold text-lg hover:bg-sky-200 transition-all border border-sky-200 dark:glass-card dark:text-slate-200 dark:hover:bg-white/10 dark:border-white/20"
              >
                Join with Code
              </Link>
            </div>
          </motion.div>
        )}

        {/* Trip Cards Grid */}
        {trips.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className="card-surface rounded-lg p-6 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mb-2">
                    {trip.name}
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300 text-sm">
                    {trip.destination_city}, {trip.destination_country}
                  </p>
                </div>

                <div className="mb-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
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
                  className="block w-full bg-sky-200 text-slate-900 text-center px-4 py-3 rounded-xl font-semibold hover:bg-sky-300 transition-all shadow-lg dark:bg-gradient-to-r dark:from-indigo-600 dark:to-violet-700 dark:text-white dark:hover:from-indigo-700 dark:hover:to-violet-800 dark:shadow-violet-600/40"
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
