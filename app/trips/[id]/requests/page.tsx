'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { TripRow, JoinRequestRow } from '@/lib/supabase';

export default function TripRequestsPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [requests, setRequests] = useState<JoinRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth?redirect=${encodeURIComponent(`/trips/${tripId}/requests`)}`);
      return;
    }
    if (user) {
      fetchRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, tripId]);

  const fetchRequests = async () => {
    try {
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (tripError || !tripData) {
        throw tripError || new Error('Trip not found');
      }

      if (tripData.created_by !== user?.id) {
        setError('Only the trip owner can view requests.');
        setLoading(false);
        return;
      }

      setTrip(tripData);

      const { data: requestsData, error: requestsError } = await supabase
        .from('join_requests')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;
      setRequests((requestsData || []) as JoinRequestRow[]);
    } catch (err: any) {
      console.error('Error fetching join requests:', err);
      setError(err.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (request: JoinRequestRow, nextStatus: 'approved' | 'rejected') => {
    try {
      if (nextStatus === 'approved') {
        const { error: memberError } = await supabase
          .from('trip_members')
          .upsert(
            {
              trip_id: tripId,
              user_id: request.requester_id,
              name: request.display_name,
            },
            { onConflict: 'trip_id, user_id' }
          );
        if (memberError) throw memberError;
      }

      const { error: updateError } = await supabase
        .from('join_requests')
        .update({ status: nextStatus })
        .eq('id', request.id);

      if (updateError) throw updateError;

      setRequests((prev) =>
        prev.map((req) => (req.id === request.id ? { ...req, status: nextStatus } : req))
      );
    } catch (err: any) {
      console.error('Error updating request:', err);
      setError(err.message || 'Failed to update request');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen pb-8">
        <div className="container mx-auto px-4 md:px-8 max-w-5xl">
          <div className="h-10 bg-white/10 rounded-2xl w-48 mt-8 mb-6 shimmer-loader"></div>
          <div className="glass-card p-6 h-40 shimmer-loader"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">{error}</h1>
          <Link href={`/trips/${tripId}`} className="text-blue-400 hover:underline">
            Back to trip
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      <div className="container mx-auto px-4 md:px-8 max-w-5xl">
        <div className="pt-8 mb-8">
          <Link href={`/trips/${tripId}`} className="text-blue-400 hover:underline">
            ← Back to trip
          </Link>
          <h1 className="text-3xl font-bold text-white mt-3">
            Join Requests {trip ? `· ${trip.name}` : ''}
          </h1>
        </div>

        {requests.length === 0 && (
          <div className="glass-card p-6 text-slate-300">
            No join requests yet.
          </div>
        )}

        {requests.length > 0 && (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="glass-card p-6 rounded-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{request.display_name}</h3>
                    <p className="text-sm text-slate-400 mt-1">{request.message}</p>
                  </div>
                  <div className="text-xs text-slate-400">
                    {request.status.toUpperCase()}
                  </div>
                </div>
                {request.status === 'pending' && (
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => handleDecision(request, 'approved')}
                      className="px-4 py-2 rounded-xl bg-green-500/20 text-green-200 hover:bg-green-500/30 transition-all text-sm"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDecision(request, 'rejected')}
                      className="px-4 py-2 rounded-xl bg-red-500/20 text-red-200 hover:bg-red-500/30 transition-all text-sm"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
