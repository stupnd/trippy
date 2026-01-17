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
  const { user, loading: authLoading, signOut } = useAuth();
  const { isMember, loading: memberLoading } = useTripMember(tripId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
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

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('trip_members')
        .select('id, name')
        .eq('trip_id', tripId)
        .order('joined_at', { ascending: true });

      if (error) throw error;

      setMembers(data || []);
      if (data && data.length > 0 && !selectedMemberId && user) {
        // Auto-select current user's member ID if they're a member
        const userMember = data.find((m) => m.id === user.id);
        if (userMember) {
          setSelectedMemberId(userMember.id);
        } else {
          // Fallback to first member or localStorage
          const storedMemberId = localStorage.getItem(`trip_${tripId}_member_id`);
          setSelectedMemberId(storedMemberId || data[0].id);
        }
      }
    } catch (error: any) {
      console.error('Error fetching members:', error);
      setError('Failed to load trip members');
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    if (!selectedMemberId) return;

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('trip_id', tripId)
        .eq('member_id', selectedMemberId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found" which is okay
        throw error;
      }

      if (data) {
        setFormData({
          preferred_origin: data.preferred_origin || '',
          flight_flexibility: data.flight_flexibility || 'medium',
          budget_sensitivity: data.budget_sensitivity || 'medium',
          accommodation_budget_min: data.accommodation_budget_min?.toString() || '',
          accommodation_budget_max: data.accommodation_budget_max?.toString() || '',
          accommodation_type: data.accommodation_type || '',
          activity_interests: data.activity_interests || [],
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
      fetchMembers();
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
    if (!selectedMemberId) {
      setError('Please select a member');
      return;
    }

    setSaving(true);
    setError('');
    setSaved(false);

    try {
      // Check if preferences exist
      const { data: existing } = await supabase
        .from('user_preferences')
        .select('id')
        .eq('trip_id', tripId)
        .eq('member_id', selectedMemberId)
        .single();

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

      let error;
      if (existing) {
        // Update existing
        const { error: updateError } = await supabase
          .from('user_preferences')
          .update(preferencesData)
          .eq('id', existing.id);
        error = updateError;
      } else {
        // Insert new
        const { error: insertError } = await supabase
          .from('user_preferences')
          .insert({
            id: uuidv4(),
            ...preferencesData,
          });
        error = insertError;
      }

      if (error) throw error;

      // Store member_id in localStorage for future auto-select
      localStorage.setItem(`trip_${tripId}_member_id`, selectedMemberId);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
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
        </div>

        {/* Member Selection */}
        <div className="card-surface rounded-lg p-6 mb-6">
          <label className="block text-sm font-medium text-slate-200 mb-2">
            Who are you?
          </label>
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select a member</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>

        {selectedMemberId && (
          <form onSubmit={handleSubmit} className="space-y-6">
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
                    Accommodation Budget (USD per night)
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