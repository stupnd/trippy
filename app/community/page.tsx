'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { TripRow } from '@/lib/supabase';

type JoinRequest = {
  id: string;
  trip_id: string;
  requester_id: string;
  display_name: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
};

export default function CommunityPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [memberTripIds, setMemberTripIds] = useState<Set<string>>(new Set());
  const [requestsByTrip, setRequestsByTrip] = useState<Record<string, JoinRequest>>({});
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestTrip, setRequestTrip] = useState<TripRow | null>(null);
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestForm, setRequestForm] = useState({
    displayName: '',
    message: '',
  });

  const statusLabel = (status?: string | null) => {
    switch (status) {
      case 'planning':
        return 'Planning';
      case 'booked':
        return 'Booked';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'canceled':
        return 'Canceled';
      default:
        return 'Planning';
    }
  };

  useEffect(() => {
    const loadCommunityTrips = async () => {
      try {
        const { data, error: tripsError } = await supabase
          .from('trips')
          .select('*')
          .eq('is_public', true)
          .order('created_at', { ascending: false });

        if (tripsError) throw tripsError;
        setTrips(data || []);
      } catch (err: any) {
        console.error('Error loading community trips:', err);
        setError('Failed to load community trips');
      } finally {
        setLoading(false);
      }
    };

    loadCommunityTrips();
  }, []);

  useEffect(() => {
    if (!user) return;

    const loadUserData = async () => {
      try {
        const { data: memberships, error: membersError } = await supabase
          .from('trip_members')
          .select('trip_id')
          .eq('user_id', user.id);

        if (membersError) throw membersError;
        setMemberTripIds(new Set((memberships || []).map((m) => m.trip_id)));

        const { data: requests, error: requestsError } = await supabase
          .from('join_requests')
          .select('*')
          .eq('requester_id', user.id);

        if (requestsError) throw requestsError;
        const mapped: Record<string, JoinRequest> = {};
        (requests || []).forEach((req) => {
          mapped[req.trip_id] = req as JoinRequest;
        });
        setRequestsByTrip(mapped);
      } catch (err: any) {
        console.error('Error loading community user data:', err);
      }
    };

    loadUserData();
  }, [user]);

  const openRequestModal = (trip: TripRow) => {
    setRequestTrip(trip);
    setRequestError('');
    setRequestForm({
      displayName:
        (user?.user_metadata?.full_name as string) ||
        (user?.user_metadata?.name as string) ||
        '',
      message: '',
    });
    setRequestOpen(true);
  };

  const submitJoinRequest = async () => {
    if (!user || !requestTrip) return;
    if (!requestForm.displayName.trim()) {
      setRequestError('Display name is required.');
      return;
    }
    if (!requestForm.message.trim()) {
      setRequestError('Please add a short description.');
      return;
    }
    if (requestForm.message.length > 280) {
      setRequestError('Description must be 280 characters or fewer.');
      return;
    }

    setRequestSaving(true);
    setRequestError('');

    try {
      const { data, error: insertError } = await supabase
        .from('join_requests')
        .insert({
          id: uuidv4(),
          trip_id: requestTrip.id,
          requester_id: user.id,
          display_name: requestForm.displayName.trim(),
          message: requestForm.message.trim(),
          status: 'pending',
        })
        .select('*')
        .single();

      if (insertError) throw insertError;
      if (data) {
        setRequestsByTrip((prev) => ({ ...prev, [requestTrip.id]: data as JoinRequest }));
      }
      setRequestOpen(false);
    } catch (err: any) {
      console.error('Error submitting join request:', err);
      setRequestError(err.message || 'Failed to submit request');
    } finally {
      setRequestSaving(false);
    }
  };

  const duplicateTrip = async (tripId: string) => {
    if (!user) return;
    try {
      const response = await fetch('/api/trips/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId, user_id: user.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to duplicate trip');
      }
      router.push(`/trips/${data.trip_id}`);
    } catch (err: any) {
      console.error('Error duplicating trip:', err);
      setError(err.message || 'Failed to duplicate trip');
    }
  };

  const planningTrips = useMemo(
    () => trips.filter((trip) => (trip.status || 'planning') === 'planning'),
    [trips]
  );
  const completedTrips = useMemo(
    () => trips.filter((trip) => (trip.status || 'planning') === 'completed'),
    [trips]
  );

  if (loading || authLoading) {
    return (
      <div className="min-h-screen pb-8">
        <div className="container mx-auto px-4 md:px-8 max-w-7xl">
          <div className="h-10 bg-white/10 rounded-2xl w-48 mt-8 mb-6 shimmer-loader"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card p-6 h-44 shimmer-loader"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl">
        <div className="pt-8 mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
            Community Trips
          </h1>
          <p className="text-slate-700 dark:text-slate-300">
            Browse public trips and join groups planning their next adventure.
          </p>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">Planning Now</h2>
          {planningTrips.length === 0 ? (
            <div className="glass-card p-6 text-slate-600 dark:text-slate-300">
              No public trips are in planning right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {planningTrips.map((trip) => {
                const isMember = memberTripIds.has(trip.id);
                const request = requestsByTrip[trip.id];
                const isOwner = user?.id === trip.created_by;

                return (
                  <div key={trip.id} className="glass-card p-6 rounded-2xl flex flex-col gap-4">
                    <div>
                      <div className="text-xs text-slate-400 mb-2">Status · {statusLabel(trip.status)}</div>
                      <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                        {trip.name}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                        {trip.destination_city}, {trip.destination_country}
                      </p>
                      {trip.start_date && trip.end_date && (
                        <p className="text-xs text-slate-400 mt-2">
                          {trip.start_date} → {trip.end_date}
                        </p>
                      )}
                    </div>

                    <div className="mt-auto">
                      {isMember && (
                        <Link
                          href={`/trips/${trip.id}`}
                          className="inline-flex items-center justify-center w-full px-4 py-2 rounded-xl bg-sky-200 text-slate-900 font-semibold hover:bg-sky-300 transition-all text-sm"
                        >
                          Open Trip
                        </Link>
                      )}
                      {!isMember && isOwner && (
                        <Link
                          href={`/trips/${trip.id}`}
                          className="inline-flex items-center justify-center w-full px-4 py-2 rounded-xl border border-white/20 text-slate-300 hover:bg-white/10 transition-all text-sm"
                        >
                          View Trip
                        </Link>
                      )}
                      {!isMember && !isOwner && (
                        <>
                          {request?.status === 'pending' && (
                            <div className="text-sm text-slate-400">Request pending</div>
                          )}
                          {request?.status === 'approved' && (
                            <Link
                              href={`/trips/${trip.id}`}
                              className="inline-flex items-center justify-center w-full px-4 py-2 rounded-xl bg-sky-200 text-slate-900 font-semibold hover:bg-sky-300 transition-all text-sm"
                            >
                              Open Trip
                            </Link>
                          )}
                          {(!request || request.status === 'rejected') && (
                            <button
                              type="button"
                              onClick={() => openRequestModal(trip)}
                              className="inline-flex items-center justify-center w-full px-4 py-2 rounded-xl bg-white/10 text-slate-200 hover:bg-white/20 transition-all text-sm"
                              disabled={!user}
                            >
                              {user ? 'Request to Join' : 'Sign in to request'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
            Completed Trips
          </h2>
          {completedTrips.length === 0 ? (
            <div className="glass-card p-6 text-slate-600 dark:text-slate-300">
              No public trips are completed yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {completedTrips.map((trip) => (
                <div key={trip.id} className="glass-card p-6 rounded-2xl flex flex-col gap-4">
                  <div>
                    <div className="text-xs text-slate-400 mb-2">Status · {statusLabel(trip.status)}</div>
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                      {trip.name}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      {trip.destination_city}, {trip.destination_country}
                    </p>
                    {trip.start_date && trip.end_date && (
                      <p className="text-xs text-slate-400 mt-2">
                        {trip.start_date} → {trip.end_date}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => duplicateTrip(trip.id)}
                    className="inline-flex items-center justify-center w-full px-4 py-2 rounded-xl bg-sky-200 text-slate-900 font-semibold hover:bg-sky-300 transition-all text-sm"
                    disabled={!user}
                  >
                    {user ? 'Duplicate Trip' : 'Sign in to duplicate'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {requestOpen && requestTrip && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center px-4">
          <div className="glass-card w-full max-w-lg rounded-3xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Request to Join</h2>
              <button
                onClick={() => setRequestOpen(false)}
                className="text-slate-300 hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="text-sm text-slate-400 mb-4">
              {requestTrip.name} · {requestTrip.destination_city}, {requestTrip.destination_country}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">Display name</label>
                <input
                  type="text"
                  value={requestForm.displayName}
                  onChange={(e) => setRequestForm((prev) => ({ ...prev, displayName: e.target.value }))}
                  className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Name shown to the group"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2">Why do you want to join?</label>
                <textarea
                  value={requestForm.message}
                  onChange={(e) => setRequestForm((prev) => ({ ...prev, message: e.target.value }))}
                  className="w-full min-h-[120px] rounded-2xl bg-white/5 border border-white/10 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={280}
                />
                <div className="text-xs text-slate-500 mt-1">
                  {requestForm.message.length}/280
                </div>
              </div>
              {requestError && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200 text-sm">
                  {requestError}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRequestOpen(false)}
                  className="flex-1 rounded-2xl border border-white/10 px-4 py-2 text-slate-200 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitJoinRequest}
                  disabled={requestSaving}
                  className="flex-1 rounded-2xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {requestSaving ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
