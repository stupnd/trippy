'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Trip, UserPreferences } from '@/types';

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<Partial<UserPreferences>>({
    flightBudget: { min: 0, max: 0 },
    accommodationBudget: { min: 0, max: 0 },
    activityBudget: { min: 0, max: 0 },
    housingNonNegotiables: [],
    flightNonNegotiables: [],
    dietaryRestrictions: [],
    notes: '',
  });

  const housingOptions = [
    'WiFi', 'Air Conditioning', 'Heating', 'Kitchen', 'Parking',
    'Pet Friendly', 'Pool', 'Gym', 'Breakfast Included', 'Washer/Dryer'
  ];

  const flightOptions = [
    'No Layovers', 'Window Seat Preferred', 'Aisle Seat Preferred',
    'Early Morning Only', 'Direct Flights Only', 'Carry-on Only',
    'Extra Legroom', 'Priority Boarding'
  ];

  const dietaryOptions = [
    'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut Allergy',
    'Halal', 'Kosher', 'Pescatarian', 'Low Carb', 'Sugar-Free'
  ];

  useEffect(() => {
    fetchTrip();
  }, [tripId]);

  useEffect(() => {
    if (trip && selectedUserId) {
      const existing = trip.userPreferences[selectedUserId];
      if (existing) {
        setPreferences({
          flightBudget: existing.flightBudget || { min: 0, max: 0 },
          accommodationBudget: existing.accommodationBudget || { min: 0, max: 0 },
          activityBudget: existing.activityBudget || { min: 0, max: 0 },
          housingNonNegotiables: existing.housingNonNegotiables || [],
          flightNonNegotiables: existing.flightNonNegotiables || [],
          dietaryRestrictions: existing.dietaryRestrictions || [],
          notes: existing.notes || '',
        });
      } else {
        setPreferences({
          flightBudget: { min: 0, max: 0 },
          accommodationBudget: { min: 0, max: 0 },
          activityBudget: { min: 0, max: 0 },
          housingNonNegotiables: [],
          flightNonNegotiables: [],
          dietaryRestrictions: [],
          notes: '',
        });
      }
    }
  }, [selectedUserId, trip]);

  const fetchTrip = async () => {
    try {
      const response = await fetch(`/api/trips?id=${tripId}`);
      if (response.ok) {
        const data = await response.json();
        setTrip(data);
        if (data.members.length > 0 && !selectedUserId) {
          setSelectedUserId(data.members[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching trip:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!trip || !selectedUserId) return;

    setSaving(true);

    const userPreferences: UserPreferences = {
      userId: selectedUserId,
      tripId: tripId,
      flightBudget: preferences.flightBudget,
      accommodationBudget: preferences.accommodationBudget,
      activityBudget: preferences.activityBudget,
      housingNonNegotiables: preferences.housingNonNegotiables || [],
      flightNonNegotiables: preferences.flightNonNegotiables || [],
      dietaryRestrictions: preferences.dietaryRestrictions || [],
      notes: preferences.notes,
      updatedAt: new Date().toISOString(),
    };

    const updatedPreferences = {
      ...trip.userPreferences,
      [selectedUserId]: userPreferences,
    };

    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPreferences: updatedPreferences }),
      });

      if (response.ok) {
        const updated = await response.json();
        setTrip(updated);
        alert('Preferences saved successfully!');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const toggleArrayItem = (
    array: string[],
    item: string,
    setter: (arr: string[]) => void
  ) => {
    if (array.includes(item)) {
      setter(array.filter(i => i !== item));
    } else {
      setter([...array, item]);
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-blue-400 hover:text-blue-300 mb-4 underline"
          >
            ← Back to Trip
          </button>
          <h1 className="text-3xl font-bold text-slate-50">Profile & Preferences</h1>
          <p className="text-slate-300 mt-2">
            {trip.destination.city}, {trip.destination.country}
          </p>
        </div>

        {/* User Selection */}
        <div className="card-surface rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-50 mb-4">Select Profile</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {trip.members.map(member => (
              <button
                key={member.id}
                onClick={() => setSelectedUserId(member.id)}
                className={`px-4 py-3 rounded-lg font-semibold transition-colors ${
                  selectedUserId === member.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                }`}
              >
                {member.name}
              </button>
            ))}
          </div>
        </div>

        {selectedUserId && (
          <div className="space-y-6">
            {/* Budgets */}
            <div className="card-surface rounded-lg p-6">
              <h2 className="text-xl font-semibold text-slate-50 mb-4">💰 Budgets (USD)</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Flight Budget
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="number"
                      value={preferences.flightBudget?.min || 0}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        flightBudget: {
                          min: parseFloat(e.target.value) || 0,
                          max: preferences.flightBudget?.max || 0,
                        },
                      })}
                      className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Min"
                      min="0"
                    />
                    <input
                      type="number"
                      value={preferences.flightBudget?.max || 0}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        flightBudget: {
                          min: preferences.flightBudget?.min || 0,
                          max: parseFloat(e.target.value) || 0,
                        },
                      })}
                      className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Max"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Accommodation Budget (per night)
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="number"
                      value={preferences.accommodationBudget?.min || 0}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        accommodationBudget: {
                          min: parseFloat(e.target.value) || 0,
                          max: preferences.accommodationBudget?.max || 0,
                        },
                      })}
                      className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Min"
                      min="0"
                    />
                    <input
                      type="number"
                      value={preferences.accommodationBudget?.max || 0}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        accommodationBudget: {
                          min: preferences.accommodationBudget?.min || 0,
                          max: parseFloat(e.target.value) || 0,
                        },
                      })}
                      className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Max"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Activity Budget (total)
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="number"
                      value={preferences.activityBudget?.min || 0}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        activityBudget: {
                          min: parseFloat(e.target.value) || 0,
                          max: preferences.activityBudget?.max || 0,
                        },
                      })}
                      className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Min"
                      min="0"
                    />
                    <input
                      type="number"
                      value={preferences.activityBudget?.max || 0}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        activityBudget: {
                          min: preferences.activityBudget?.min || 0,
                          max: parseFloat(e.target.value) || 0,
                        },
                      })}
                      className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Max"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Housing Non-Negotiables */}
            <div className="card-surface rounded-lg p-6">
              <h2 className="text-xl font-semibold text-slate-50 mb-4">🏨 Housing Non-Negotiables</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {housingOptions.map(option => (
                  <label key={option} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.housingNonNegotiables?.includes(option) || false}
                      onChange={() => toggleArrayItem(
                        preferences.housingNonNegotiables || [],
                        option,
                        (arr) => setPreferences({ ...preferences, housingNonNegotiables: arr })
                      )}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-slate-200">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Flight Non-Negotiables */}
            <div className="card-surface rounded-lg p-6">
              <h2 className="text-xl font-semibold text-slate-50 mb-4">✈️ Flight Non-Negotiables</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {flightOptions.map(option => (
                  <label key={option} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.flightNonNegotiables?.includes(option) || false}
                      onChange={() => toggleArrayItem(
                        preferences.flightNonNegotiables || [],
                        option,
                        (arr) => setPreferences({ ...preferences, flightNonNegotiables: arr })
                      )}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-slate-200">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Dietary Restrictions */}
            <div className="card-surface rounded-lg p-6">
              <h2 className="text-xl font-semibold text-slate-50 mb-4">🍽️ Dietary Restrictions</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {dietaryOptions.map(option => (
                  <label key={option} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.dietaryRestrictions?.includes(option) || false}
                      onChange={() => toggleArrayItem(
                        preferences.dietaryRestrictions || [],
                        option,
                        (arr) => setPreferences({ ...preferences, dietaryRestrictions: arr })
                      )}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-slate-200">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="card-surface rounded-lg p-6">
              <h2 className="text-xl font-semibold text-slate-50 mb-4">📝 Notes</h2>
              <textarea
                value={preferences.notes || ''}
                onChange={(e) => setPreferences({ ...preferences, notes: e.target.value })}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[120px]"
                placeholder="Any additional preferences or notes..."
              />
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}