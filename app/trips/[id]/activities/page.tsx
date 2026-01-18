'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trip, Activity } from '@/types';
import { updateActivityRatings, validateActivitySelection } from '@/lib/utils';

export default function ActivitiesPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userRatings, setUserRatings] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    fetchTrip();
  }, [tripId]);

  const fetchTrip = async () => {
    try {
      const response = await fetch(`/api/trips?id=${tripId}`);
      if (response.ok) {
        const data = await response.json();
        setTrip(data);
        
        // Initialize activities if empty
        if (!data.activities || data.activities.length === 0) {
          const mockActivities = generateMockActivities(data);
          const response = await fetch(`/api/trips/${tripId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activities: mockActivities }),
          });
          if (response.ok) {
            const updated = await response.json();
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

  const generateMockActivities = (trip: Trip): Activity[] => {
    const activities: Activity[] = [
      {
        id: 'act1',
        name: 'City Walking Tour',
        category: 'Sightseeing',
        description: 'Explore the historic downtown area with a guided walking tour',
        location: 'Downtown',
        link: '#',
        ratings: {},
        averageRating: 0,
        isSelected: false,
      },
      {
        id: 'act2',
        name: 'Beach Day',
        category: 'Outdoor',
        description: 'Relax at the famous beach with crystal clear waters',
        location: 'Beach District',
        link: '#',
        ratings: {},
        averageRating: 0,
        isSelected: false,
      },
      {
        id: 'act3',
        name: 'Museum of Art',
        category: 'Culture',
        description: 'Visit the renowned art museum with contemporary collections',
        location: 'Arts District',
        link: '#',
        ratings: {},
        averageRating: 0,
        isSelected: false,
      },
      {
        id: 'act4',
        name: 'Food Market Tour',
        category: 'Food & Drink',
        description: 'Sample local cuisine at the bustling food market',
        location: 'Market Square',
        link: '#',
        ratings: {},
        averageRating: 0,
        isSelected: false,
      },
      {
        id: 'act5',
        name: 'Sunset Cruise',
        category: 'Entertainment',
        description: 'Enjoy a scenic boat cruise at sunset',
        location: 'Harbor',
        link: '#',
        ratings: {},
        averageRating: 0,
        isSelected: false,
      },
      {
        id: 'act6',
        name: 'Hiking Trail',
        category: 'Outdoor',
        description: 'Moderate hike with stunning views of the city',
        location: 'Mountain Park',
        link: '#',
        ratings: {},
        averageRating: 0,
        isSelected: false,
      },
      {
        id: 'act7',
        name: 'Local Brewery',
        category: 'Food & Drink',
        description: 'Taste craft beers at a popular local brewery',
        location: 'Brewery District',
        link: '#',
        ratings: {},
        averageRating: 0,
        isSelected: false,
      },
      {
        id: 'act8',
        name: 'Shopping District',
        category: 'Shopping',
        description: 'Browse unique boutiques and local shops',
        location: 'Shopping Quarter',
        link: '#',
        ratings: {},
        averageRating: 0,
        isSelected: false,
      },
    ];

    return activities;
  };

  const handleRate = async (activityId: string, userId: string, rating: number) => {
    if (!trip) return;

    const activities = trip.activities.map(activity => {
      if (activity.id === activityId) {
        return {
          ...activity,
          ratings: {
            ...activity.ratings,
            [userId]: rating,
          },
        };
      }
      return activity;
    });

    const updatedActivities = updateActivityRatings(activities);

    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activities: updatedActivities }),
      });

      if (response.ok) {
        const updated = await response.json();
        setTrip(updated);
      }
    } catch (error) {
      console.error('Error updating rating:', error);
    }
  };

  const handleToggleSelection = async (activityId: string) => {
    if (!trip) return;

    const activities = trip.activities.map(activity => {
      if (activity.id === activityId) {
        return { ...activity, isSelected: !activity.isSelected };
      }
      return activity;
    });

    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activities }),
      });

      if (response.ok) {
        const updated = await response.json();
        setTrip(updated);
      }
    } catch (error) {
      console.error('Error toggling selection:', error);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!trip) return <div className="p-8">Trip not found</div>;

  const selectedActivities = trip.activities.filter(a => a.isSelected);
  const validation = validateActivitySelection(trip.activities, trip.members.map(m => m.id));

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Activities</h1>
          <p className="text-gray-600 mt-2">
            {trip.destination.city}, {trip.destination.country}
          </p>
        </div>

        {selectedUserId && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
            <p className="text-indigo-800">
              Rating as: <strong>{trip.members.find(m => m.id === selectedUserId)?.name}</strong>
            </p>
            <button
              onClick={() => setSelectedUserId('')}
              className="text-sm text-indigo-600 hover:underline mt-2"
            >
              Change user
            </button>
          </div>
        )}

        {!selectedUserId && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Select User to Rate</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {trip.members.map(member => (
                <button
                  key={member.id}
                  onClick={() => setSelectedUserId(member.id)}
                  className="px-4 py-3 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-semibold"
                >
                  {member.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedUserId && (
          <div className="space-y-4 mb-8">
            {trip.activities.map((activity) => {
              const userRating = activity.ratings[selectedUserId] || 0;
              return (
                <div
                  key={activity.id}
                  className={`bg-white rounded-lg shadow p-6 ${
                    activity.isSelected ? 'ring-2 ring-indigo-500' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{activity.name}</h3>
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm">
                          {activity.category}
                        </span>
                        {activity.isSelected && (
                          <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-sm">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 mb-2">{activity.description}</p>
                      <p className="text-sm text-gray-500">{activity.location}</p>
                      <div className="mt-2">
                        <span className="text-sm text-gray-600">
                          Average Rating: <strong>{activity.averageRating.toFixed(1)}</strong> / 5.0
                        </span>
                        {activity.conflicts && activity.conflicts.length > 0 && (
                          <span className="ml-3 text-sm text-red-600">
                            Conflicts: {activity.conflicts.length} user(s) rated &lt; 3
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Your Rating (1-5)
                      </label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(rating => (
                          <button
                            key={rating}
                            onClick={() => handleRate(activity.id, selectedUserId, rating)}
                            className={`w-10 h-10 rounded-lg font-semibold transition-colors ${
                              userRating === rating
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                      {userRating > 0 && (
                        <p className="text-sm text-gray-500 mt-2">
                          You rated: {userRating}/5
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleSelection(activity.id)}
                      className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                        activity.isSelected
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                      }`}
                    >
                      {activity.isSelected ? 'Deselect' : 'Select'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedActivities.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                Selected Activities ({selectedActivities.length})
              </h2>
              {validation.isValid ? (
                <span className="bg-green-100 text-green-800 px-4 py-2 rounded-lg">
                  ✓ 80% Rule Satisfied
                </span>
              ) : (
                <span className="bg-red-100 text-red-800 px-4 py-2 rounded-lg">
                  ⚠ 80% Rule Not Met
                </span>
              )}
            </div>

            {!validation.isValid && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-800 font-semibold mb-2">Validation Failed</p>
                <p className="text-red-700 text-sm">
                  Some users have not rated at least 80% of selected activities as "okay" (≥3).
                  Please adjust selections or ask users to rate more activities.
                </p>
              </div>
            )}

            <div className="space-y-2">
              {selectedActivities
                .sort((a, b) => b.averageRating - a.averageRating)
                .map(activity => (
                  <div key={activity.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="font-medium">{activity.name}</span>
                    <span className="text-sm text-gray-600">
                      Avg: {activity.averageRating.toFixed(1)}/5
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}