'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Trip } from '@/types';

export default function ShareTripPage() {
  const params = useParams();
  const tripId = params.id as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrip();
  }, [tripId]);

  const fetchTrip = async () => {
    try {
      const response = await fetch(`/api/trips?id=${tripId}`);
      if (response.ok) {
        const data = await response.json();
        setTrip(data);
      }
    } catch (error) {
      console.error('Error fetching trip:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Trip not found</h1>
        </div>
      </div>
    );
  }

  const selectedFlight = trip.flights?.options?.find(
    o => o.id === trip.flights?.selectedOptionId
  );
  const selectedAccommodation = trip.accommodation?.options?.find(
    o => o.id === trip.accommodation?.selectedOptionId
  );
  const selectedActivities = trip.activities.filter(a => a.isSelected);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{trip.name}</h1>
          <p className="text-2xl text-gray-600">
            {trip.destination.city}, {trip.destination.country}
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
            <span>
              📅 {format(parseISO(trip.startDate), 'MMM d')} - {format(parseISO(trip.endDate), 'MMM d, yyyy')}
            </span>
            <span>👥 {trip.members.length} {trip.members.length === 1 ? 'traveler' : 'travelers'}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Flight */}
        {selectedFlight && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900">✈️ Flight</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-lg font-semibold">
                    {selectedFlight.departure.airport} → {selectedFlight.arrival.airport}
                  </div>
                  <div className="text-sm text-gray-600">
                    {selectedFlight.airline.join(', ')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-indigo-600">
                    ${selectedFlight.price}
                  </div>
                  <div className="text-sm text-gray-500">per person</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                <div>
                  <div className="text-sm text-gray-500">Departure</div>
                  <div className="font-semibold">
                    {format(parseISO(selectedFlight.departure.time), 'MMM d, h:mm a')}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Arrival</div>
                  <div className="font-semibold">
                    {format(parseISO(selectedFlight.arrival.time), 'MMM d, h:mm a')}
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-600 pt-2 border-t">
                Duration: {Math.floor(selectedFlight.duration / 60)}h {selectedFlight.duration % 60}m
                {selectedFlight.layovers.count > 0 && (
                  <span> • {selectedFlight.layovers.count} layover{selectedFlight.layovers.count > 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Accommodation */}
        {selectedAccommodation && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900">🏨 Accommodation</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="text-xl font-semibold mb-1">{selectedAccommodation.name}</div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-yellow-500">★</span>
                    <span className="font-semibold">{selectedAccommodation.rating}</span>
                    <span className="text-gray-500">• {selectedAccommodation.type}</span>
                  </div>
                  <div className="text-sm text-gray-600">{selectedAccommodation.location}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-indigo-600">
                    ${selectedAccommodation.pricePerNight}
                  </div>
                  <div className="text-sm text-gray-500">per night</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Activities */}
        {selectedActivities.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900">🎯 Activities</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {selectedActivities
                .sort((a, b) => b.averageRating - a.averageRating)
                .map(activity => (
                  <div key={activity.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="font-semibold mb-1">{activity.name}</div>
                    <div className="text-sm text-gray-600 mb-2">{activity.description}</div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="bg-gray-100 px-2 py-1 rounded text-xs">{activity.category}</span>
                      <span className="text-gray-500">★ {activity.averageRating.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Itinerary */}
        {trip.itinerary && trip.itinerary.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-6 text-gray-900">📅 Day-by-Day Itinerary</h2>
            <div className="space-y-6">
              {trip.itinerary.map((day, dayIndex) => {
                const date = parseISO(day.date);
                const formattedDate = format(date, 'EEEE, MMMM d');
                const timeSlots = {
                  morning: day.activities.filter(a => a.timeOfDay === 'morning'),
                  afternoon: day.activities.filter(a => a.timeOfDay === 'afternoon'),
                  evening: day.activities.filter(a => a.timeOfDay === 'evening'),
                };

                const hasActivities = day.activities.length > 0;

                if (!hasActivities) return null;

                return (
                  <div key={day.date} className="border-t pt-6 first:border-t-0 first:pt-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Day {dayIndex + 1}: {formattedDate}
                    </h3>
                    <div className="space-y-3">
                      {timeSlots.morning.length > 0 && (
                        <div>
                          <div className="text-sm font-medium text-gray-500 mb-2">🌅 Morning</div>
                          <div className="space-y-2">
                            {timeSlots.morning.map((slot, idx) => {
                              const activity = trip.activities.find(a => a.id === slot.activityId);
                              if (!activity) return null;
                              return (
                                <div key={idx} className="bg-gray-50 rounded-lg p-3">
                                  <div className="font-medium">{activity.name}</div>
                                  <div className="text-sm text-gray-600">{activity.location}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {timeSlots.afternoon.length > 0 && (
                        <div>
                          <div className="text-sm font-medium text-gray-500 mb-2">☀️ Afternoon</div>
                          <div className="space-y-2">
                            {timeSlots.afternoon.map((slot, idx) => {
                              const activity = trip.activities.find(a => a.id === slot.activityId);
                              if (!activity) return null;
                              return (
                                <div key={idx} className="bg-gray-50 rounded-lg p-3">
                                  <div className="font-medium">{activity.name}</div>
                                  <div className="text-sm text-gray-600">{activity.location}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {timeSlots.evening.length > 0 && (
                        <div>
                          <div className="text-sm font-medium text-gray-500 mb-2">🌙 Evening</div>
                          <div className="space-y-2">
                            {timeSlots.evening.map((slot, idx) => {
                              const activity = trip.activities.find(a => a.id === slot.activityId);
                              if (!activity) return null;
                              return (
                                <div key={idx} className="bg-gray-50 rounded-lg p-3">
                                  <div className="font-medium">{activity.name}</div>
                                  <div className="text-sm text-gray-600">{activity.location}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!selectedFlight && !selectedAccommodation && selectedActivities.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <p className="text-gray-500">Trip planning is in progress. Check back later!</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 py-6 text-center text-gray-500 text-sm border-t border-gray-200">
        <p>Shared from Trippy - Collaborative Trip Planning</p>
      </div>
    </div>
  );
}