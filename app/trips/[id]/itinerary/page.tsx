'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { Trip, ItineraryDay } from '@/types';

export default function ItineraryPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [draggedActivity, setDraggedActivity] = useState<string | null>(null);

  useEffect(() => {
    fetchTrip();
  }, [tripId]);

  const fetchTrip = async () => {
    try {
      const response = await fetch(`/api/trips?id=${tripId}`);
      if (response.ok) {
        const data = await response.json();
        setTrip(data);
        
        // Initialize itinerary if empty
        if (!data.itinerary || data.itinerary.length === 0) {
          const days = eachDayOfInterval({
            start: parseISO(data.startDate),
            end: parseISO(data.endDate),
          });

          const newItinerary: ItineraryDay[] = days.map(date => ({
            date: format(date, 'yyyy-MM-dd'),
            activities: [],
          }));

          const response = await fetch(`/api/trips/${tripId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itinerary: newItinerary }),
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

  const handleDragStart = (activityId: string) => {
    setDraggedActivity(activityId);
  };

  const handleDrop = async (dayIndex: number, timeOfDay: 'morning' | 'afternoon' | 'evening') => {
    if (!draggedActivity || !trip) return;

    const updatedItinerary = trip.itinerary.map((day, idx) => {
      if (idx === dayIndex) {
        // Remove from other slots if exists
        const filteredActivities = day.activities.filter(
          a => a.activityId !== draggedActivity
        );
        
        // Add to new slot
        return {
          ...day,
          activities: [
            ...filteredActivities,
            { activityId: draggedActivity, timeOfDay },
          ],
        };
      }
      return {
        ...day,
        activities: day.activities.filter(a => a.activityId !== draggedActivity),
      };
    });

    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itinerary: updatedItinerary }),
      });

      if (response.ok) {
        const updated = await response.json();
        setTrip(updated);
      }
    } catch (error) {
      console.error('Error updating itinerary:', error);
    }

    setDraggedActivity(null);
  };

  const handleRemove = async (dayIndex: number, activityId: string) => {
    if (!trip) return;

    const updatedItinerary = trip.itinerary.map((day, idx) => {
      if (idx === dayIndex) {
        return {
          ...day,
          activities: day.activities.filter(a => a.activityId !== activityId),
        };
      }
      return day;
    });

    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itinerary: updatedItinerary }),
      });

      if (response.ok) {
        const updated = await response.json();
        setTrip(updated);
      }
    } catch (error) {
      console.error('Error removing activity:', error);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!trip) return <div className="p-8">Trip not found</div>;

  const selectedActivities = trip.activities.filter(a => a.isSelected);
  const timeSlots: ('morning' | 'afternoon' | 'evening')[] = ['morning', 'afternoon', 'evening'];
  const timeLabels = {
    morning: '🌅 Morning',
    afternoon: '☀️ Afternoon',
    evening: '🌙 Evening',
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-indigo-600 hover:underline mb-4"
          >
            ← Back to Trip
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Itinerary Builder</h1>
          <p className="text-gray-600 mt-2">
            {trip.destination.city}, {trip.destination.country}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Available Activities Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4 sticky top-4">
              <h2 className="text-lg font-semibold mb-4">Available Activities</h2>
              {selectedActivities.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No activities selected yet. Go to Activities page to select some.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedActivities.map(activity => {
                    const isUsed = trip.itinerary.some(day =>
                      day.activities.some(a => a.activityId === activity.id)
                    );
                    return (
                      <div
                        key={activity.id}
                        draggable
                        onDragStart={() => handleDragStart(activity.id)}
                        className={`p-3 rounded-lg border-2 cursor-move transition-colors ${
                          isUsed
                            ? 'bg-gray-100 border-gray-300 opacity-60'
                            : 'bg-indigo-50 border-indigo-200 hover:border-indigo-400'
                        }`}
                      >
                        <div className="font-medium text-sm">{activity.name}</div>
                        <div className="text-xs text-gray-500 mt-1">{activity.category}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Itinerary Days */}
          <div className="lg:col-span-3 space-y-6">
            {trip.itinerary.map((day, dayIndex) => {
              const date = parseISO(day.date);
              const formattedDate = format(date, 'EEEE, MMMM d');
              
              return (
                <div key={day.date} className="bg-white rounded-lg shadow">
                  <div className="p-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Day {dayIndex + 1}: {formattedDate}
                    </h2>
                  </div>

                  <div className="p-4 space-y-4">
                    {timeSlots.map(timeOfDay => {
                      const activitiesInSlot = day.activities.filter(
                        a => a.timeOfDay === timeOfDay
                      );
                      
                      return (
                        <div
                          key={timeOfDay}
                          onDragOver={(e) => {
                            e.preventDefault();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            handleDrop(dayIndex, timeOfDay);
                          }}
                          className={`min-h-[100px] p-4 rounded-lg border-2 border-dashed transition-colors ${
                            draggedActivity
                              ? 'border-indigo-400 bg-indigo-50'
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="font-semibold text-gray-700 mb-2">
                            {timeLabels[timeOfDay]}
                          </div>
                          
                          {activitiesInSlot.length === 0 ? (
                            <div className="text-sm text-gray-400 italic py-4 text-center">
                              Drop activity here
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {activitiesInSlot.map((slotActivity, idx) => {
                                const activity = trip.activities.find(
                                  a => a.id === slotActivity.activityId
                                );
                                if (!activity) return null;
                                
                                return (
                                  <div
                                    key={idx}
                                    className="bg-white border border-gray-200 rounded-lg p-3 flex justify-between items-start"
                                  >
                                    <div>
                                      <div className="font-medium">{activity.name}</div>
                                      <div className="text-sm text-gray-500 mt-1">
                                        {activity.category} • {activity.location}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleRemove(dayIndex, activity.id)}
                                      className="text-red-500 hover:text-red-700 text-sm px-2"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}