'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Trip, TripMember } from '@/types';

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTrip();
  }, [tripId]);

  const fetchTrip = async () => {
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

      // Fetch trip members from Supabase
      const { data: membersData, error: membersError } = await supabase
        .from('trip_members')
        .select('*')
        .eq('trip_id', tripId)
        .order('joined_at', { ascending: true });

      if (membersError) {
        throw membersError;
      }

      // Transform Supabase data to Trip interface
      // Owner is determined by matching id with trip's created_by
      const members: TripMember[] = (membersData || []).map((m) => ({
        id: m.id,
        name: m.name,
        joinedAt: m.joined_at,
        isOwner: m.id === tripData.created_by,
      }));

      const trip: Trip = {
        id: tripData.id,
        name: tripData.name,
        destination: {
          city: tripData.destination_city,
          country: tripData.destination_country,
        },
        currentLocation: '', // Not in schema, empty for now
        startDate: tripData.start_date,
        endDate: tripData.end_date,
        maxDays: 0, // Not in schema, 0 for now
        inviteCode: tripData.invite_code,
        createdAt: tripData.created_at,
        createdBy: tripData.created_by,
        members,
        userPreferences: {},
        activities: [],
        itinerary: [],
      };

      setTrip(trip);
    } catch (error: any) {
      console.error('Error fetching trip:', error);
      setError(error.message || 'Failed to load trip');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-200">Loading...</div>
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

  const inviteLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/trips/join?code=${trip.inviteCode}`
    : '';

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="card-surface shadow border-b border-slate-700">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-slate-50">{trip.name}</h1>
              <p className="text-slate-300 mt-1">
                {trip.destination.city}, {trip.destination.country}
              </p>
            </div>
            <Link
              href={`/trips/${tripId}/share`}
              className="bg-slate-700 text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-600 transition-colors"
            >
              Share Overview
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Invite Section */}
        <div className="card-surface rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-slate-50">Invite Friends</h2>
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Invite Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={trip.inviteCode}
                  className="flex-1 px-4 py-2 border border-slate-600 rounded-lg bg-slate-700 font-mono text-lg font-bold text-center text-slate-50"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(trip.inviteCode);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Copy Code
                </button>
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Invite Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="flex-1 px-4 py-2 border border-slate-600 rounded-lg bg-slate-700 text-sm text-slate-300"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(inviteLink);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Trip Members */}
        <div className="card-surface rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-slate-50">Trip Members ({trip.members.length})</h2>
          <div className="flex flex-wrap gap-3">
            {trip.members.map((member) => (
              <div
                key={member.id}
                className="px-4 py-2 bg-blue-900 text-blue-100 rounded-full flex items-center gap-2 border border-blue-700"
              >
                <span>{member.name}</span>
                {member.isOwner && (
                  <span className="text-xs bg-blue-700 px-2 py-0.5 rounded">
                    Owner
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Link
            href={`/trips/${tripId}/preferences`}
            className="card-surface rounded-lg p-6 hover:bg-slate-700 transition-colors"
          >
            <h3 className="text-xl font-semibold mb-2 text-slate-50">⚙️ Preferences</h3>
            <p className="text-slate-300 text-sm">
              Set your trip preferences
            </p>
          </Link>

          <Link
            href={`/trips/${tripId}/flights`}
            className="card-surface rounded-lg p-6 hover:bg-slate-700 transition-colors"
          >
            <h3 className="text-xl font-semibold mb-2 text-slate-50">✈️ Flights</h3>
            <p className="text-slate-300 text-sm">
              {trip.flights ? 'View flight options' : 'Add flight preferences'}
            </p>
          </Link>

          <Link
            href={`/trips/${tripId}/accommodation`}
            className="card-surface rounded-lg p-6 hover:bg-slate-700 transition-colors"
          >
            <h3 className="text-xl font-semibold mb-2 text-slate-50">🏨 Accommodation</h3>
            <p className="text-slate-300 text-sm">
              {trip.accommodation ? 'View options' : 'Add preferences'}
            </p>
          </Link>

          <Link
            href={`/trips/${tripId}/activities`}
            className="card-surface rounded-lg p-6 hover:bg-slate-700 transition-colors"
          >
            <h3 className="text-xl font-semibold mb-2 text-slate-50">🎯 Activities</h3>
            <p className="text-slate-300 text-sm">
              {trip.activities.length > 0 
                ? `${trip.activities.filter(a => a.isSelected).length} selected`
                : 'Rate activities'
              }
            </p>
          </Link>
        </div>

        {/* Itinerary */}
        <div className="mt-6 card-surface rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-slate-50">📅 Itinerary</h2>
            <Link
              href={`/trips/${tripId}/itinerary`}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {trip.itinerary && trip.itinerary.length > 0 ? 'Edit Itinerary' : 'Build Itinerary'}
            </Link>
          </div>
          {trip.itinerary && trip.itinerary.length > 0 ? (
            <p className="text-slate-300">
              {trip.itinerary.filter(d => d.activities.length > 0).length} of {trip.itinerary.length} days planned
            </p>
          ) : (
            <p className="text-slate-300">No itinerary yet. Start building your day-by-day plan!</p>
          )}
        </div>
      </div>
    </div>
  );
}