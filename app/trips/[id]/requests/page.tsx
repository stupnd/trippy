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
  const [requests, setRequests] = useState<(JoinRequestRow & { requester_name?: string; requester_avatar?: string | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

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
      
      // Fetch profiles for all requesters
      const requesterIds = (requestsData || []).map(req => req.requester_id).filter(Boolean);
      let profilesMap = new Map<string, { full_name?: string; avatar_url?: string | null }>();
      
      if (requesterIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', requesterIds);
        
        (profilesData || []).forEach(profile => {
          if (profile.id) {
            profilesMap.set(profile.id, {
              full_name: profile.full_name || undefined,
              avatar_url: profile.avatar_url || null,
            });
          }
        });
      }
      
      // Map the requests with profile names
      const requestsWithNames = (requestsData || []).map((req: any) => {
        const profile = profilesMap.get(req.requester_id);
        return {
          ...req,
          requester_name: profile?.full_name || 'Traveler',
          requester_avatar: profile?.avatar_url || null,
        };
      });
      
      setRequests(requestsWithNames as any);
    } catch (err: any) {
      console.error('Error fetching join requests:', err);
      setError(err.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (request: JoinRequestRow, nextStatus: 'approved' | 'rejected') => {
    setError('');
    
    try {
      if (nextStatus === 'approved') {
        // Step 1: Insert the requester into trip_members (only user_id, no name/avatar)
        // Profile data (full_name, avatar_url) will be fetched via join on the dashboard
        const { data: memberData, error: memberError } = await supabase
          .from('trip_members')
          .upsert(
            {
              trip_id: tripId,
              user_id: request.requester_id, // Only store user_id - profile data comes from profiles table
            },
            { onConflict: 'trip_id, user_id' }
          );

        if (memberError) {
          console.error('Error inserting into trip_members:', {
            trip_id: tripId,
            user_id: request.requester_id,
            error: memberError,
            code: memberError.code,
            message: memberError.message,
            details: memberError.details,
            hint: memberError.hint,
          });
          throw new Error(`Failed to add member to trip: ${memberError.message}`);
        }

        console.log('Successfully added member to trip:', {
          trip_id: tripId,
          user_id: request.requester_id,
          member_data: memberData,
        });
      }

      // Step 3: Update join_requests status
      const { error: updateError } = await supabase
        .from('join_requests')
        .update({ status: nextStatus })
        .eq('id', request.id);

      if (updateError) {
        console.error('Error updating join_requests status:', {
          request_id: request.id,
          new_status: nextStatus,
          error: updateError,
          code: updateError.code,
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
        });
        throw new Error(`Failed to update request status: ${updateError.message}`);
      }

      console.log('Successfully updated join request:', {
        request_id: request.id,
        new_status: nextStatus,
      });

      // Step 4: Update UI - remove approved requests, keep rejected ones with updated status
      if (nextStatus === 'approved') {
        // Remove approved request from the list
        setRequests((prev) => prev.filter((req) => req.id !== request.id));
        // Show success message with purple/indigo aesthetic
        const requesterName = (request as any).requester_name || 'Traveler';
        setSuccessMessage(`${requesterName} has been added to the trip!`);
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        // Update rejected request status in the list
        setRequests((prev) =>
          prev.map((req) => (req.id === request.id ? { ...req, status: nextStatus } : req))
        );
      }
    } catch (err: any) {
      console.error('Error in handleDecision:', {
        request_id: request.id,
        requester_id: request.requester_id,
        trip_id: tripId,
        next_status: nextStatus,
        error: err,
        error_message: err.message,
        error_code: err.code,
        error_details: err.details,
        error_hint: err.hint,
        stack: err.stack,
      });
      setError(err.message || `Failed to ${nextStatus === 'approved' ? 'approve' : 'reject'} request`);
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

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 px-6 py-4 bg-indigo-500/20 border border-indigo-500/30 rounded-2xl text-indigo-300 font-medium">
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 px-6 py-4 bg-red-500/20 border border-red-500/30 rounded-2xl text-red-300 font-medium">
            {error}
          </div>
        )}

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
                    <h3 className="text-lg font-semibold text-white">{(request as any).requester_name || 'Traveler'}</h3>
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
