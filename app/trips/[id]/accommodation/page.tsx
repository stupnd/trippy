'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trip, AccommodationPreference, AccommodationOption } from '@/types';
import { scoreAccommodations } from '@/lib/utils';

export default function AccommodationPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [formData, setFormData] = useState({
    minBudget: '',
    maxBudget: '',
    type: 'any' as 'hotel' | 'airbnb' | 'hostel' | 'any',
    features: [] as string[],
  });

  const featureOptions = ['WiFi', 'Pool', 'Parking', 'Breakfast', 'Pet Friendly', 'Gym'];

  useEffect(() => {
    fetchTrip();
  }, [tripId]);

  const fetchTrip = async () => {
    try {
      const response = await fetch(`/api/trips?id=${tripId}`);
      if (response.ok) {
        const data = await response.json();
        setTrip(data);
        setShowForm(!data.accommodation || data.accommodation.preferences.length === 0);
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

    const preference: AccommodationPreference = {
      userId: selectedUserId,
      budgetRange: {
        min: parseFloat(formData.minBudget),
        max: parseFloat(formData.maxBudget),
      },
      type: formData.type,
      mustHaveFeatures: formData.features,
    };

    const preferences = [...(trip.accommodation?.preferences || []), preference];
    const hasAllPreferences = preferences.length === trip.members.length;

    // Generate mock options if all preferences submitted
    let options: AccommodationOption[] = [];
    if (hasAllPreferences) {
      const avgMinBudget = preferences.reduce((sum, p) => sum + p.budgetRange.min, 0) / preferences.length;
      const avgMaxBudget = preferences.reduce((sum, p) => sum + p.budgetRange.max, 0) / preferences.length;
      options = generateMockAccommodations(trip, avgMinBudget, avgMaxBudget);
      options = scoreAccommodations(options, { minBudget: avgMinBudget, maxBudget: avgMaxBudget });
    }

    const accommodationSelection = {
      preferences,
      options,
      approvals: {},
    };

    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accommodation: accommodationSelection }),
      });

      if (response.ok) {
        const updated = await response.json();
        setTrip(updated);
        setShowForm(false);
        setFormData({
          minBudget: '',
          maxBudget: '',
          type: 'any',
          features: [],
        });
        setSelectedUserId('');
      }
    } catch (error) {
      console.error('Error saving preference:', error);
    }
  };

  const generateMockAccommodations = (
    trip: Trip,
    minBudget: number,
    maxBudget: number
  ): AccommodationOption[] => {
    const mockOptions: AccommodationOption[] = [
      {
        id: 'a1',
        name: 'Grand Hotel Central',
        type: 'hotel',
        pricePerNight: Math.round((minBudget + maxBudget) / 2),
        rating: 4.5,
        location: `Downtown ${trip.destination.city}`,
        link: '#',
        score: 0,
      },
      {
        id: 'a2',
        name: 'Cozy Downtown Apartment',
        type: 'airbnb',
        pricePerNight: Math.round(minBudget * 1.1),
        rating: 4.8,
        location: `City Center, ${trip.destination.city}`,
        link: '#',
        score: 0,
      },
      {
        id: 'a3',
        name: 'Beachside Hostel',
        type: 'hostel',
        pricePerNight: Math.round(minBudget * 0.7),
        rating: 4.2,
        location: `Near ${trip.destination.city} Beach`,
        link: '#',
        score: 0,
      },
      {
        id: 'a4',
        name: 'Boutique Hotel',
        type: 'hotel',
        pricePerNight: Math.round(maxBudget * 0.9),
        rating: 4.7,
        location: `Historic District, ${trip.destination.city}`,
        link: '#',
        score: 0,
      },
      {
        id: 'a5',
        name: 'Modern Studio Loft',
        type: 'airbnb',
        pricePerNight: Math.round((minBudget + maxBudget) / 2 * 0.85),
        rating: 4.6,
        location: `Arts District, ${trip.destination.city}`,
        link: '#',
        score: 0,
      },
    ];

    return mockOptions;
  };

  const handleApprove = async (approved: boolean, reason?: string) => {
    if (!trip || !trip.accommodation) return;
    
    const userId = trip.members[0].id; // Simplified
    const approvals = {
      ...trip.accommodation.approvals,
      [userId]: { approved, reason },
    };

    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accommodation: { ...trip.accommodation, approvals } 
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

  if (loading) return <div className="p-8">Loading...</div>;
  if (!trip) return <div className="p-8">Trip not found</div>;

  const allPreferencesSubmitted = trip.accommodation?.preferences.length === trip.members.length;
  const allApproved = trip.accommodation && 
    trip.accommodation.selectedOptionId &&
    Object.keys(trip.accommodation.approvals).length === trip.members.length &&
    Object.values(trip.accommodation.approvals).every(a => a.approved);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-6">
          <div className="flex gap-4 mb-4">
            <Link
              href="/"
              className="text-indigo-600 hover:underline"
            >
              ← Back to My Trips
            </Link>
            <button
              onClick={() => router.back()}
              className="text-indigo-600 hover:underline"
            >
              ← Back to Trip
            </button>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Accommodation</h1>
          <p className="text-gray-600 mt-2">
            {trip.destination.city}, {trip.destination.country}
          </p>
        </div>

        {!allPreferencesSubmitted && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Add Accommodation Preferences</h2>
            <form onSubmit={handleSubmitPreference} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Who is this for?
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Select a member</option>
                  {trip.members
                    .filter(m => !trip.accommodation?.preferences.some(p => p.userId === m.id))
                    .map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget per Night (USD)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    value={formData.minBudget}
                    onChange={(e) => setFormData({ ...formData, minBudget: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Min"
                    min="0"
                    step="10"
                    required
                  />
                  <input
                    type="number"
                    value={formData.maxBudget}
                    onChange={(e) => setFormData({ ...formData, maxBudget: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Max"
                    min="0"
                    step="10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Accommodation Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="any">Any</option>
                  <option value="hotel">Hotel</option>
                  <option value="airbnb">Airbnb / Vacation Rental</option>
                  <option value="hostel">Hostel</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Must-Have Features
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {featureOptions.map(feature => (
                    <label key={feature} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.features.includes(feature)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, features: [...formData.features, feature] });
                          } else {
                            setFormData({ ...formData, features: formData.features.filter(f => f !== feature) });
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{feature}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700"
              >
                Add Preference
              </button>
            </form>
          </div>
        )}

        {trip.accommodation?.options && trip.accommodation.options.length > 0 && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Accommodation Options</h2>
              {trip.accommodation.selectedOptionId && (
                <span className="bg-green-100 text-green-800 px-4 py-2 rounded-lg">
                  ✓ Finalized
                </span>
              )}
            </div>

            {trip.accommodation.options.map((option) => (
              <div
                key={option.id}
                className="bg-white rounded-lg shadow p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{option.name}</h3>
                      <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm capitalize">
                        {option.type}
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-indigo-600">
                      ${option.pricePerNight}
                      <span className="text-sm font-normal text-gray-600"> / night</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-yellow-500">★</span>
                      <span className="font-semibold">{option.rating}</span>
                      <span className="text-gray-500">• {option.location}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Score</div>
                    <div className="text-xl font-semibold">{option.score}/100</div>
                  </div>
                </div>

                {option.link && (
                  <div className="mt-4 pt-4 border-t flex justify-between items-center">
                    <a
                      href={option.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      View Details →
                    </a>
                    {!trip.accommodation?.selectedOptionId && (
                      <button
                        onClick={async () => {
                          const response = await fetch(`/api/trips/${tripId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              accommodation: { ...trip.accommodation, selectedOptionId: option.id }
                            }),
                          });
                          if (response.ok) {
                            const updated = await response.json();
                            setTrip(updated);
                          }
                        }}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                      >
                        Select
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {trip.accommodation.selectedOptionId && !allApproved && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Approval Required</h3>
                <p className="text-gray-600 mb-4">
                  All trip members need to approve the selected accommodation before finalizing.
                </p>
                <div className="space-y-3">
                  {trip.members.map(member => {
                    const approval = trip.accommodation?.approvals[member.id];
                    return (
                      <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <span>{member.name}</span>
                        {approval ? (
                          <span className={approval.approved ? 'text-green-600' : 'text-red-600'}>
                            {approval.approved ? '✓ Approved' : '✗ Rejected'}
                          </span>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(true)}
                              className="px-4 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleApprove(false)}
                              className="px-4 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
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