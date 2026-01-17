'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth, useTripMember } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export default function PreferencesPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const { user, loading: authLoading } = useAuth();
  const { isMember, loading: memberLoading } = useTripMember(tripId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [formData, setFormData] = useState({
    preferred_origin: '',
    flight_flexibility: 'medium' as 'low' | 'medium' | 'high',
    budget_sensitivity: 'medium' as 'low' | 'medium' | 'high',
    accommodation_budget_min: '',
    accommodation_budget_max: '',
    accommodation_type: '',
    activity_interests: [] as string[],
  });

  const safeParseJson = (value: string) => {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  const activityOptions = [
    'Outdoor Adventures',
    'Museums & Culture',
    'Food & Dining',
    'Nightlife',
    'Shopping',
    'Beaches',
    'Historical Sites',
    'Art Galleries',
    'Music & Concerts',
    'Sports Events',
    'Nature & Parks',
    'Photography',
  ];

  const accommodationTypes = [
    'Hotel',
    'Airbnb',
    'Hostel',
    'Resort',
    'Vacation Rental',
    'Any',
  ];

  const setMemberFromUser = () => {
    if (!user) return;
    setSelectedMemberId(user.id);
  };

  const fetchPreferences = async () => {
    if (!selectedMemberId) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError('Please sign in again to load preferences.');
        return;
      }

      const response = await fetch(
        `/api/preferences?tripId=${encodeURIComponent(tripId)}&memberId=${encodeURIComponent(selectedMemberId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const payloadText = await response.text();
      const payload = safeParseJson(payloadText);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to fetch preferences');
      }

      if (payload?.data) {
        setFormData({
          preferred_origin: payload.data.preferred_origin || '',
          flight_flexibility: payload.data.flight_flexibility || 'medium',
          budget_sensitivity: payload.data.budget_sensitivity || 'medium',
          accommodation_budget_min: payload.data.accommodation_budget_min?.toString() || '',
          accommodation_budget_max: payload.data.accommodation_budget_max?.toString() || '',
          accommodation_type: payload.data.accommodation_type || '',
          activity_interests: payload.data.activity_interests || [],
        });
      }
    } catch (error: any) {
      console.error('Error fetching preferences:', error);
    }
  };

  // Auth protection
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth?redirect=${encodeURIComponent(`/trips/${tripId}/preferences`)}`);
      return;
    }

    if (!authLoading && user && !memberLoading && isMember === false) {
      // User is logged in but not a member - redirect to join
      router.push(`/trips/join?code=&redirect=${encodeURIComponent(`/trips/${tripId}/preferences`)}`);
      return;
    }

    if (!authLoading && user && isMember) {
      setMemberFromUser();
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, memberLoading, isMember, tripId, router]);

  useEffect(() => {
    if (selectedMemberId) {
      fetchPreferences();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMemberId, tripId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId || !user || selectedMemberId !== user.id) {
      setError('You can only edit your own preferences.');
      return;
    }

    setSaving(true);
    setError('');
    setSaved(false);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError('Please sign in again to save preferences.');
        return;
      }

      const preferencesData = {
        trip_id: tripId,
        member_id: selectedMemberId,
        preferred_origin: formData.preferred_origin || null,
        flight_flexibility: formData.flight_flexibility,
        budget_sensitivity: formData.budget_sensitivity,
        accommodation_budget_min: formData.accommodation_budget_min
          ? parseFloat(formData.accommodation_budget_min)
          : null,
        accommodation_budget_max: formData.accommodation_budget_max
          ? parseFloat(formData.accommodation_budget_max)
          : null,
        accommodation_type: formData.accommodation_type || null,
        activity_interests: formData.activity_interests,
        updated_at: new Date().toISOString(),
      };

      const response = await fetch('/api/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: uuidv4(),
          ...preferencesData,
        }),
      });
      const payloadText = await response.text();
      const payload = safeParseJson(payloadText);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save preferences');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      updateTripSummary();
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      setError(error.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const toggleActivityInterest = (activity: string) => {
    setFormData((prev) => ({
      ...prev,
      activity_interests: prev.activity_interests.includes(activity)
        ? prev.activity_interests.filter((a) => a !== activity)
        : [...prev.activity_interests, activity],
    }));
  };

  const updateTripSummary = async () => {
    try {
      const { data: membersData, error: membersError } = await supabase
        .from('trip_members')
        .select('id')
        .eq('trip_id', tripId);
      if (membersError) throw membersError;

      const membersCount = membersData?.length || 0;
      const suggestionsRaw =
        typeof window !== 'undefined' ? localStorage.getItem(`suggestions_${tripId}`) : null;
      const votesRaw =
        typeof window !== 'undefined' ? localStorage.getItem(`votes_${tripId}`) : null;

      let suggestions;
      if (suggestionsRaw) {
        try {
          suggestions = JSON.parse(suggestionsRaw);
        } catch {
          suggestions = null;
        }
      }

      let votes: Record<string, Record<string, boolean>> = {};
      if (votesRaw) {
        try {
          votes = JSON.parse(votesRaw);
        } catch {
          votes = {};
        }
      }

      const voteCountFor = (key: string) => {
        const optionVotes = votes[key] || {};
        return Object.values(optionVotes).filter(Boolean).length;
      };

      const flights = suggestions?.suggestions?.flights || [];
      const accommodations = suggestions?.suggestions?.accommodations || [];
      const activities = suggestions?.suggestions?.activities || [];

      const approvedFlights = flights.filter(
        (item: any) => voteCountFor(`flight_${item.id}`) === membersCount
      );
      const approvedStays = accommodations.filter(
        (item: any) => voteCountFor(`accommodation_${item.id}`) === membersCount
      );
      const approvedActivities = activities.filter(
        (item: any) => voteCountFor(`activity_${item.id}`) === membersCount
      );

      await fetch('/api/generate-trip-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: tripId,
          approved: {
            flights: approvedFlights,
            accommodations: approvedStays,
            activities: approvedActivities,
          },
          available_counts: {
            flights: flights.length,
            accommodations: accommodations.length,
            activities: activities.length,
          },
        }),
      });
    } catch (summaryError) {
      console.error('Error updating trip summary:', summaryError);
    }
  };

  if (authLoading || memberLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-200">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
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
          <h1 className="text-3xl font-bold text-slate-50">User Preferences</h1>
          <p className="text-sm text-slate-400 mt-2">
            You can only edit your own preferences for this trip.
          </p>
        </div>

        {selectedMemberId && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Budget Preferences */}
            <div className="card-surface rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-slate-50">💰 Budget Preferences</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Budget Preference (USD)
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="number"
                      value={formData.accommodation_budget_min}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          accommodation_budget_min: e.target.value,
                        })
                      }
                      className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Min"
                      min="0"
                    />
                    <input
                      type="number"
                      value={formData.accommodation_budget_max}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          accommodation_budget_max: e.target.value,
                        })
                      }
                      className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Max"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Flight Preferences */}
            <div className="card-surface rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-slate-50">✈️ Flight Preferences</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Preferred Origin Airport (IATA code)
                  </label>
                  <input
                    type="text"
                    value={formData.preferred_origin}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        preferred_origin: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="LAX"
                    maxLength={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Flight Flexibility
                  </label>
                  <select
                    value={formData.flight_flexibility}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        flight_flexibility: e.target.value as 'low' | 'medium' | 'high',
                      })
                    }
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="low">Low - Fixed dates only</option>
                    <option value="medium">Medium - Some flexibility</option>
                    <option value="high">High - Very flexible</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Budget Sensitivity
                  </label>
                  <select
                    value={formData.budget_sensitivity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        budget_sensitivity: e.target.value as 'low' | 'medium' | 'high',
                      })
                    }
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="low">Low - Price is not a concern</option>
                    <option value="medium">Medium - Balance price and quality</option>
                    <option value="high">High - Minimize costs</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Accommodation Preferences */}
            <div className="card-surface rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-slate-50">🏨 Accommodation Preferences</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Accommodation Type
                  </label>
                  <select
                    value={formData.accommodation_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        accommodation_type: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select type</option>
                    {accommodationTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Activity Interests */}
            <div className="card-surface rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-slate-50">🎯 Activity Interests</h2>
              <p className="text-sm text-slate-300 mb-4">
                Select all activities you're interested in
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {activityOptions.map((activity) => (
                  <label
                    key={activity}
                    className="flex items-center space-x-2 cursor-pointer p-3 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={formData.activity_interests.includes(activity)}
                      onChange={() => toggleActivityInterest(activity)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-slate-200">{activity}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Error & Success Messages */}
            {error && (
              <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {saved && (
              <div className="bg-green-900 border border-green-700 text-green-100 px-4 py-3 rounded-lg">
                ✓ Preferences saved successfully!
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
