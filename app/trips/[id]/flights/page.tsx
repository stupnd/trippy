'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FlightOption, FlightSearchInput, Trip } from '@/types';
import { scoreFlights } from '@/lib/utils';
import { sortFlightsByPrice } from '@/lib/flights';
import { saveFlightSearch, saveFlightSelection } from '@/lib/supabaseFlights';
import FlightCard from './FlightCard';

type SearchFormState = {
  origin: string;
  destination: string;
  departureStart: string;
  departureEnd: string;
  returnStart: string;
  returnEnd: string;
  budget: string;
  travelers: number;
};

const defaultFormState: SearchFormState = {
  origin: '',
  destination: '',
  departureStart: '',
  departureEnd: '',
  returnStart: '',
  returnEnd: '',
  budget: '',
  travelers: 1,
};

export default function FlightsPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchId, setSearchId] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState<SearchFormState>(defaultFormState);

  useEffect(() => {
    fetchTrip();
  }, [tripId]);

  const fetchTrip = async () => {
    try {
      const response = await fetch(`/api/trips?id=${tripId}`);
      if (response.ok) {
        const data = (await response.json()) as Trip;
        setTrip(data);
        if (data.flights?.search) {
          const search = data.flights.search;
          setFormData({
            origin: search.origin,
            destination: search.destination,
            departureStart: search.departureDateRange.start,
            departureEnd: search.departureDateRange.end,
            returnStart: search.returnDateRange.start,
            returnEnd: search.returnDateRange.end,
            budget: search.budget ? String(search.budget) : '',
            travelers: search.travelers,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching trip:', error);
    } finally {
      setLoading(false);
    }
  };

  const options = useMemo(() => trip?.flights?.options ?? [], [trip]);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trip) return;

    setSearchError(null);
    setSearchLoading(true);

    const payload: FlightSearchInput = {
      origin: formData.origin.trim().toUpperCase(),
      destination: formData.destination.trim().toUpperCase(),
      departureDateRange: {
        start: formData.departureStart,
        end: formData.departureEnd,
      },
      returnDateRange: {
        start: formData.returnStart,
        end: formData.returnEnd,
      },
      budget: formData.budget ? Number(formData.budget) : undefined,
      travelers: Math.max(1, Number(formData.travelers)),
    };

    try {
      const response = await fetch('/api/flights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch flights');
      }

      const scored = scoreFlights(data.options as FlightOption[]);
      const sorted = sortFlightsByPrice(scored);

      const flightSelection = {
        search: payload,
        preferences: [],
        options: sorted,
        approvals: {},
      };

      const updateResponse = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flights: flightSelection }),
      });

      if (updateResponse.ok) {
        const updated = (await updateResponse.json()) as Trip;
        setTrip(updated);
      }

      const storedSearchId = await saveFlightSearch(payload, sorted, tripId);
      setSearchId(storedSearchId);
    } catch (error) {
      console.error('Error searching flights:', error);
      setSearchError(error instanceof Error ? error.message : 'Failed to search flights');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectOption = async (option: FlightOption) => {
    if (!trip || !trip.flights) return;

    try {
      const updateResponse = await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flights: { ...trip.flights, selectedOptionId: option.id },
        }),
      });

      if (updateResponse.ok) {
        const updated = (await updateResponse.json()) as Trip;
        setTrip(updated);
      }

      await saveFlightSelection({
        trip_id: tripId,
        search_id: searchId,
        option_id: option.id,
        selected_option: option,
      });
    } catch (error) {
      console.error('Error saving flight selection:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-slate-700 dark:text-slate-200">Loading...</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-4">Trip not found</h1>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">Flights</h1>
          <p className="text-slate-700 dark:text-slate-300 mt-2">
            {trip.destination.city}, {trip.destination.country}
          </p>
        </div>

        <div className="card-surface rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-50">Search Flights</h2>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                  Origin (IATA)
                </label>
                <input
                  type="text"
                  value={formData.origin}
                  onChange={(e) => setFormData({ ...formData, origin: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-blue-500 dark:focus:border-blue-500"
                  placeholder="YOW"
                  maxLength={3}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                  Destination (IATA)
                </label>
                <input
                  type="text"
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-blue-500 dark:focus:border-blue-500"
                  placeholder="LAX"
                  maxLength={3}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                Departure Date Range
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="date"
                  value={formData.departureStart}
                  onChange={(e) => setFormData({ ...formData, departureStart: e.target.value })}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-blue-500 dark:focus:border-blue-500"
                  required
                />
                <input
                  type="date"
                  value={formData.departureEnd}
                  onChange={(e) => setFormData({ ...formData, departureEnd: e.target.value })}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-blue-500 dark:focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                Return Date Range
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="date"
                  value={formData.returnStart}
                  onChange={(e) => setFormData({ ...formData, returnStart: e.target.value })}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-blue-500 dark:focus:border-blue-500"
                  required
                />
                <input
                  type="date"
                  value={formData.returnEnd}
                  onChange={(e) => setFormData({ ...formData, returnEnd: e.target.value })}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-blue-500 dark:focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
              <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                  Budget (USD total for group)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-blue-500 dark:focus:border-blue-500"
                  placeholder="600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">
                  Travelers
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.travelers}
                  onChange={(e) =>
                    setFormData({ ...formData, travelers: Number(e.target.value) })
                  }
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-300/60 focus:border-sky-300 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50 dark:focus:ring-blue-500 dark:focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {searchError && (
              <div className="text-sm text-red-300 bg-red-950 border border-red-800 rounded-lg px-4 py-2">
                {searchError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-70"
              disabled={searchLoading}
            >
              {searchLoading ? 'Searching flights...' : 'Search Flights'}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-slate-50">
              Flight Options ({options.length})
            </h2>
            {trip.flights?.selectedOptionId && (
              <span className="bg-green-900 text-green-100 px-4 py-2 rounded-lg border border-green-700">
                ✓ Selected
              </span>
            )}
          </div>

          {options.length === 0 && (
            <div className="card-surface rounded-lg p-6 text-slate-300">
              Search for flights to see options that match your group dates and budget.
            </div>
          )}

          {options.map((option) => (
            <FlightCard
              key={option.id}
              option={option}
              travelers={trip.flights?.search?.travelers ?? formData.travelers}
              isSelected={trip.flights?.selectedOptionId === option.id}
              onSelect={() => handleSelectOption(option)}
              showSelect={!trip.flights?.selectedOptionId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
