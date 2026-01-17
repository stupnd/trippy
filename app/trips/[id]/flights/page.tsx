'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trip, FlightPreference, FlightOption } from '@/types';
import { scoreFlights } from '@/lib/utils';
import { generateMockFlights } from '@/lib/flights';

export default function FlightsPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    departureStart: '',
    departureEnd: '',
    returnStart: '',
    returnEnd: '',
  });

  useEffect(() => {
    fetchTrip();
  }, [tripId]);

  const fetchTrip = async () => {
    try {
      const response = await fetch(`/api/trips?id=${tripId}`);
      if (response.ok) {
        const data = await response.json();
        setTrip(data);
        setShowForm(!data.flights || data.flights.preferences.length === 0);
        
        // If we have preferences but no options, generate them
        if (data.flights?.preferences && data.flights.preferences.length > 0 && 
            (!data.flights.options || data.flights.options.length === 0)) {
          const options = generateMockFlights(data.flights.preferences);
          const scoredOptions = scoreFlights(options);
          
          // Update trip with generated flights
          const updateResponse = await fetch(`/api/trips/${tripId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              flights: {
                ...data.flights,
                options: scoredOptions,
              },
            }),
          });
          
          if (updateResponse.ok) {
            const updated = await updateResponse.json();
            setTrip(updated);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching trip:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPreference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !trip) return;

    const preference: FlightPreference = {
      userId: selectedUserId,
      origin: formData.origin.toUpperCase(),
      destination: formData.destination.toUpperCase(),
      departureDateRange: {
        start: formData.departureStart,
        end: formData.departureEnd,
      },
      returnDateRange: {
        start: formData.returnStart,
        end: formData.returnEnd,
      },
    };

    const preferences = [...(trip.flights?.preferences || []), preference];

    // Generate mock flight options when at least one preference is submitted
    // Use the latest preference for the search
    let options: FlightOption[] = [];
    if (preferences.length > 0) {
      options = generateMockFlights(preferences);
      options = scoreFlights(options);
    }

    const flightSelection = {
      preferences,
      options,
      approvals: {},
    };

    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flights: flightSelection }),
      });

      if (response.ok) {
        const updated = await response.json();
        setTrip(updated);
        setShowForm(false);
        setFormData({
          origin: '',
          destination: '',
          departureStart: '',
          departureEnd: '',
          returnStart: '',
          returnEnd: '',
        });
        setSelectedUserId('');
      }
    } catch (error) {
      console.error('Error saving preference:', error);
    }
  };


  const handleApprove = async (approved: boolean, reason?: string) => {
    if (!trip || !trip.flights) return;
    
    const userId = trip.members[0].id; // Simplified: use first member
    const approvals = {
      ...trip.flights.approvals,
      [userId]: { approved, reason },
    };

    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          flights: { ...trip.flights, approvals } 
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setTrip(updated);
      }
    } catch (error) {
      console.error('Error updating approval:', error);
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
          <h1 className="text-2xl font-bold text-slate-50 mb-4">Trip not found</h1>
          <button
            onClick={() => router.back()}
            className="text-blue-400 hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const allPreferencesSubmitted = trip.flights?.preferences.length === trip.members.length;
  const allApproved = trip.flights && 
    trip.flights.selectedOptionId &&
    Object.keys(trip.flights.approvals).length === trip.members.length &&
    Object.values(trip.flights.approvals).every(a => a.approved);

  return (
    <div className="min-h-screen bg-slate-900 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-6">
          <div className="flex gap-4 mb-4">
            <Link
              href="/"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              ← Back to My Trips
            </Link>
            <button
              onClick={() => router.back()}
              className="text-blue-400 hover:text-blue-300 underline"
            >
              ← Back to Trip
            </button>
          </div>
          <h1 className="text-3xl font-bold text-slate-50">Flights</h1>
          <p className="text-slate-300 mt-2">
            {trip.destination.city}, {trip.destination.country}
          </p>
        </div>

        {!allPreferencesSubmitted && (
          <div className="card-surface rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-slate-50">Add Flight Preferences</h2>
            <form onSubmit={handleSubmitPreference} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Who is this for?
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select a member</option>
                  {trip.members
                    .filter(m => !trip.flights?.preferences.some(p => p.userId === m.id))
                    .map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Origin Airport (IATA)
                  </label>
                  <input
                    type="text"
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="YOW"
                    maxLength={3}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Destination Airport (IATA)
                  </label>
                  <input
                    type="text"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="LAX"
                    maxLength={3}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Departure Date Range
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="date"
                    value={formData.departureStart}
                    onChange={(e) => setFormData({ ...formData, departureStart: e.target.value })}
                    className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <input
                    type="date"
                    value={formData.departureEnd}
                    onChange={(e) => setFormData({ ...formData, departureEnd: e.target.value })}
                    className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Return Date Range
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="date"
                    value={formData.returnStart}
                    onChange={(e) => setFormData({ ...formData, returnStart: e.target.value })}
                    className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <input
                    type="date"
                    value={formData.returnEnd}
                    onChange={(e) => setFormData({ ...formData, returnEnd: e.target.value })}
                    className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
              >
                Add Preference & Search Flights
              </button>
            </form>
          </div>
        )}

        {trip.flights?.preferences && trip.flights.preferences.length > 0 && (
          <div className="card-surface rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-slate-50">Flight Preferences</h2>
            <div className="space-y-3">
              {trip.flights.preferences.map((pref, idx) => {
                const member = trip.members.find(m => m.id === pref.userId);
                return (
                  <div key={idx} className="border border-slate-600 rounded-lg p-4 bg-slate-700">
                    <div className="font-semibold text-slate-50">{member?.name}</div>
                    <div className="text-sm text-slate-300">
                      {pref.origin} → {pref.destination}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Departure: {pref.departureDateRange.start} to {pref.departureDateRange.end}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {trip.flights?.options && trip.flights.options.length > 0 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-slate-50">
                Flight Options ({trip.flights.options.length})
              </h2>
              {trip.flights.selectedOptionId && (
                <span className="bg-green-900 text-green-100 px-4 py-2 rounded-lg border border-green-700">
                  ✓ Finalized
                </span>
              )}
            </div>

            {/* All Flight Options */}
            {trip.flights.options
              .sort((a, b) => b.score - a.score)
              .map((option) => (
                <div
                  key={option.id}
                  className={`card-surface rounded-lg p-6 border-2 ${
                    option.isBestValue ? 'border-blue-500' : 'border-slate-600'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex gap-2 mb-2 flex-wrap">
                        {option.isCheapest && (
                          <span className="bg-green-900 text-green-100 px-3 py-1 rounded-full text-sm font-semibold border border-green-700">
                            Cheapest
                          </span>
                        )}
                        {option.isFastest && (
                          <span className="bg-blue-900 text-blue-100 px-3 py-1 rounded-full text-sm font-semibold border border-blue-700">
                            Fastest
                          </span>
                        )}
                        {option.isBestValue && (
                          <span className="bg-blue-800 text-blue-50 px-3 py-1 rounded-full text-sm font-semibold border-2 border-blue-500">
                            Best Value
                          </span>
                        )}
                      </div>
                      <div className="text-2xl font-bold text-slate-50">${option.price}</div>
                      <div className="text-slate-300">{option.airline.join(', ')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-400">Score</div>
                      <div className="text-xl font-semibold text-slate-50">{option.score}/100</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-600">
                    <div>
                      <div className="text-sm text-slate-400">Departure</div>
                      <div className="font-semibold text-slate-50">
                        {new Date(option.departure.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-sm text-slate-300">{option.departure.airport}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">Arrival</div>
                      <div className="font-semibold text-slate-50">
                        {new Date(option.arrival.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-sm text-slate-300">{option.arrival.airport}</div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-600 flex justify-between items-center">
                    <div className="text-sm text-slate-300">
                      Duration: {Math.floor(option.duration / 60)}h {option.duration % 60}m
                      {option.layovers.count > 0 && (
                        <span className="ml-2">
                          • {option.layovers.count} layover{option.layovers.count > 1 ? 's' : ''}
                          {option.layovers.airports.length > 0 && ` (${option.layovers.airports.join(', ')})`}
                        </span>
                      )}
                    </div>
                    {!trip.flights.selectedOptionId && (
                      <button
                        onClick={async () => {
                          const response = await fetch(`/api/trips/${tripId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              flights: { ...trip.flights, selectedOptionId: option.id }
                            }),
                          });
                          if (response.ok) {
                            const updated = await response.json();
                            setTrip(updated);
                          }
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      >
                        Select
                      </button>
                    )}
                  </div>
                </div>
              ))}

            {trip.flights.selectedOptionId && !allApproved && (
              <div className="card-surface rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-slate-50">Approval Required</h3>
                <p className="text-slate-300 mb-4">
                  All trip members need to approve the selected flight before finalizing.
                </p>
                <div className="space-y-3">
                  {trip.members.map(member => {
                    const approval = trip.flights?.approvals[member.id];
                    return (
                      <div key={member.id} className="flex items-center justify-between p-3 border border-slate-600 rounded-lg bg-slate-700">
                        <span className="text-slate-50">{member.name}</span>
                        {approval ? (
                          <span className={approval.approved ? 'text-green-400' : 'text-red-400'}>
                            {approval.approved ? '✓ Approved' : '✗ Rejected'}
                          </span>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(true)}
                              className="px-4 py-1 bg-green-900 text-green-100 rounded hover:bg-green-800 border border-green-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleApprove(false)}
                              className="px-4 py-1 bg-red-900 text-red-100 rounded hover:bg-red-800 border border-red-700"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}