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
  const [tripName, setTripName] = useState<string>('');
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

  const setMemberFromUser = async () => {
    if (!user) return;
    const { data: member, error: memberError } = await supabase
      .from('trip_members')
      .select('id')
      .eq('trip_id', tripId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (memberError) {
      console.error('Error fetching member id:', memberError);
      return;
    }
    if (member?.id) {
      setSelectedMemberId(member.id);
    }
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
    if (!selectedMemberId || !user) {
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
      updateTripBudget();
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
      const { data: suggestionsRow } = await supabase
        .from('trip_suggestions')
        .select('flights, accommodations, activities')
        .eq('trip_id', tripId)
        .maybeSingle();

      const { data: votesData } = await supabase
        .from('suggestion_votes')
        .select('option_type, option_id, approved')
        .eq('trip_id', tripId);

      const votesByKey: Record<string, number> = {};
      (votesData || []).forEach((vote) => {
        if (!vote.approved) return;
        const key = `${vote.option_type}_${vote.option_id}`;
        votesByKey[key] = (votesByKey[key] || 0) + 1;
      });

      const flights = suggestionsRow?.flights || [];
      const accommodations = suggestionsRow?.accommodations || [];
      const activities = suggestionsRow?.activities || [];

      const approvedFlights = flights.filter(
        (item: any) => votesByKey[`flight_${item.id}`] === membersCount
      );
      const approvedStays = accommodations.filter(
        (item: any) => votesByKey[`accommodation_${item.id}`] === membersCount
      );
      const approvedActivities = activities.filter(
        (item: any) => votesByKey[`activity_${item.id}`] === membersCount
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

  const updateTripBudget = async () => {
    try {
      await fetch('/api/generate-trip-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId }),
      });
    } catch (budgetError) {
      console.error('Error updating trip budget:', budgetError);
    }
  };

  if (authLoading || memberLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-700 dark:text-slate-200">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      <div className="container mx-auto px-4 md:px-8 max-w-4xl">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">User Preferences</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            You can only edit your own preferences for this trip.
          </p>
        </div>

        {selectedMemberId && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Budget Preferences */}
            <div className="glass-card rounded-3xl p-6">
              <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white tracking-tight">💰 Budget Preferences</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
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
                      className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 focus:outline-none dark:bg-slate-900/60 dark:border-white/20 dark:text-white dark:focus:ring-blue-500/50 dark:focus:border-blue-500/50"
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
                      className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 focus:outline-none dark:bg-slate-900/60 dark:border-white/20 dark:text-white dark:focus:ring-blue-500/50 dark:focus:border-blue-500/50"
                      placeholder="Max"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Flight Preferences */}
            <div className="glass-card rounded-3xl p-6">
              <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white tracking-tight">✈️ Flight Preferences</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
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
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 focus:outline-none dark:bg-slate-900/60 dark:border-white/20 dark:text-white dark:focus:ring-blue-500/50 dark:focus:border-blue-500/50"
                    placeholder="LAX"
                    maxLength={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
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
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 focus:outline-none dark:bg-slate-900/60 dark:border-white/20 dark:text-white dark:focus:ring-blue-500/50 dark:focus:border-blue-500/50"
                  >
                    <option value="low" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Low - Fixed dates only</option>
                    <option value="medium" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Medium - Some flexibility</option>
                    <option value="high" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">High - Very flexible</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
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
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 focus:outline-none dark:bg-slate-900/60 dark:border-white/20 dark:text-white dark:focus:ring-blue-500/50 dark:focus:border-blue-500/50"
                  >
                    <option value="low">Low - Price is not a concern</option>
                    <option value="medium">Medium - Balance price and quality</option>
                    <option value="high">High - Minimize costs</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Accommodation Preferences */}
            <div className="glass-card rounded-3xl p-6">
              <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white tracking-tight">🏨 Accommodation Preferences</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
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
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 focus:outline-none dark:bg-slate-900/60 dark:border-white/20 dark:text-white dark:focus:ring-blue-500/50 dark:focus:border-blue-500/50"
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
            <div className="glass-card rounded-3xl p-6">
              <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white tracking-tight">🎯 Activity Interests</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                Select all activities you're interested in
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {activityOptions.map((activity) => (
                  <label
                    key={activity}
                    className="flex items-center space-x-2 cursor-pointer p-3 glass-card rounded-xl hover:bg-slate-100 transition-all dark:hover:bg-white/10"
                  >
                    <input
                      type="checkbox"
                      checked={formData.activity_interests.includes(activity)}
                      onChange={() => toggleActivityInterest(activity)}
                      className="w-4 h-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-2 focus:ring-sky-300/60 dark:border-white/20 dark:bg-slate-900/60 dark:focus:ring-blue-500/50"
                    />
                    <span className="text-slate-800 dark:text-slate-200 text-sm">{activity}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Error & Success Messages */}
            {error && (
              <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-lg dark:bg-red-900 dark:border-red-700 dark:text-red-100">
                {error}
              </div>
            )}

            {saved && (
              <div className="bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-lg dark:bg-green-900 dark:border-green-700 dark:text-green-100">
                ✓ Preferences saved successfully!
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-gradient-to-r from-indigo-600 to-violet-700 text-white px-8 py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-violet-800 transition-all shadow-lg shadow-violet-600/40 disabled:opacity-50 disabled:cursor-not-allowed"
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
