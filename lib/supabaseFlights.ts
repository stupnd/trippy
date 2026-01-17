import { supabase } from '@/lib/supabase';
import { FlightOption, FlightSearchInput } from '@/types';

export interface FlightSearchInsert {
  trip_id?: string;
  origin: string;
  destination: string;
  departure_start: string;
  departure_end: string;
  return_start: string;
  return_end: string;
  budget?: number;
  travelers: number;
  results: FlightOption[];
}

export interface FlightSelectionInsert {
  trip_id?: string;
  search_id?: string;
  option_id: string;
  selected_option: FlightOption;
}

export async function saveFlightSearch(
  search: FlightSearchInput,
  results: FlightOption[],
  tripId?: string
) {
  const payload: FlightSearchInsert = {
    trip_id: tripId,
    origin: search.origin,
    destination: search.destination,
    departure_start: search.departureDateRange.start,
    departure_end: search.departureDateRange.end,
    return_start: search.returnDateRange.start,
    return_end: search.returnDateRange.end,
    budget: search.budget,
    travelers: search.travelers,
    results,
  };

  const { data, error } = await supabase
    .from('flight_searches')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to save flight search: ${error.message}`);
  }

  return data?.id as string | undefined;
}

export async function saveFlightSelection(
  selection: FlightSelectionInsert
) {
  const { error } = await supabase
    .from('flight_selections')
    .insert(selection);

  if (error) {
    throw new Error(`Failed to save flight selection: ${error.message}`);
  }
}
