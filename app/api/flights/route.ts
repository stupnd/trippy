import { NextRequest, NextResponse } from 'next/server';
import {
  buildDateList,
  filterFlightsByBudget,
  filterFlightsByDateRange,
  sortFlightsByPrice,
} from '@/lib/flights';
import { FlightOption, FlightSearchInput, FlightSegment } from '@/types';

const AVIATIONSTACK_API_KEY =
  process.env.AVIATIONSTACK_API_KEY || 'ca46f59383220e6fc580c0e7102c622a';
const AVIATIONSTACK_BASE_URL = 'https://api.aviationstack.com/v1/flights';
const MAX_DATES_PER_LEG = 5;
const MAX_OPTIONS = 25;

type AviationstackFlight = {
  airline?: { name?: string };
  flight?: { iata?: string; number?: string };
  departure?: { iata?: string; airport?: string; city?: string; scheduled?: string };
  arrival?: { iata?: string; airport?: string; city?: string; scheduled?: string };
};

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function parseDurationMinutes(departureTime?: string, arrivalTime?: string): number {
  if (!departureTime || !arrivalTime) return 120;
  const departure = new Date(departureTime).getTime();
  const arrival = new Date(arrivalTime).getTime();
  if (Number.isNaN(departure) || Number.isNaN(arrival)) return 120;
  const minutes = Math.max(30, Math.round((arrival - departure) / 60000));
  return minutes;
}

function mapToSegment(flight: AviationstackFlight): FlightSegment | null {
  const departureTime = flight.departure?.scheduled;
  const arrivalTime = flight.arrival?.scheduled;
  if (!departureTime || !arrivalTime) return null;

  const airline = flight.airline?.name || 'Unknown Airline';
  const flightNumber = flight.flight?.iata || flight.flight?.number || undefined;

  return {
    airline,
    flightNumber,
    departure: {
      time: departureTime,
      airport: flight.departure?.iata || flight.departure?.airport || 'Unknown',
      city: flight.departure?.city,
    },
    arrival: {
      time: arrivalTime,
      airport: flight.arrival?.iata || flight.arrival?.airport || 'Unknown',
      city: flight.arrival?.city,
    },
    duration: parseDurationMinutes(departureTime, arrivalTime),
    layovers: { count: 0, airports: [] },
    stops: 0,
  };
}

function estimateRoundTripPrice(outbound: FlightSegment, returnSegment?: FlightSegment): number {
  const totalDuration = outbound.duration + (returnSegment?.duration ?? 0);
  const stops = outbound.stops + (returnSegment?.stops ?? 0);
  const base = 80 + totalDuration * 0.18 + stops * 45;
  const seed = hashString(
    `${outbound.airline}-${outbound.flightNumber ?? ''}-${outbound.departure.time}-${returnSegment?.departure.time ?? ''}`
  );
  const multiplier = 0.85 + (seed % 30) / 100;
  return Math.max(120, Math.round(base * multiplier));
}

async function fetchFlightsForDates(
  origin: string,
  destination: string,
  dates: string[]
): Promise<FlightSegment[]> {
  const requests = dates.map(async (date) => {
    const url = new URL(AVIATIONSTACK_BASE_URL);
    url.searchParams.set('access_key', AVIATIONSTACK_API_KEY);
    url.searchParams.set('dep_iata', origin);
    url.searchParams.set('arr_iata', destination);
    url.searchParams.set('flight_date', date);

    const response = await fetch(url.toString(), { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Aviationstack request failed with status ${response.status}`);
    }
    const payload = await response.json();
    if (payload?.error) {
      throw new Error(payload.error.message || 'Aviationstack returned an error');
    }
    return (payload?.data || []) as AviationstackFlight[];
  });

  const responses = await Promise.all(requests);
  const segments = responses.flatMap((flights) => flights.map(mapToSegment).filter(Boolean)) as FlightSegment[];
  return segments;
}

function buildFlightOptions(
  outboundSegments: FlightSegment[],
  returnSegments: FlightSegment[],
  travelers: number
): FlightOption[] {
  if (outboundSegments.length === 0 || returnSegments.length === 0) return [];

  const options: FlightOption[] = [];
  const max = Math.min(outboundSegments.length, MAX_OPTIONS);

  for (let i = 0; i < max; i += 1) {
    const outbound = outboundSegments[i];
    const returnSegment = returnSegments[i % returnSegments.length];
    const roundTripPerTraveler = estimateRoundTripPrice(outbound, returnSegment);

    options.push({
      id: `${outbound.flightNumber ?? 'flight'}-${i}`,
      price: roundTripPerTraveler,
      roundTripPrice: roundTripPerTraveler * Math.max(travelers, 1),
      currency: 'USD',
      airline: [outbound.airline, returnSegment.airline].filter(Boolean),
      departure: outbound.departure,
      arrival: outbound.arrival,
      duration: outbound.duration,
      layovers: outbound.layovers,
      stops: outbound.stops,
      returnSegment,
      totalDuration: outbound.duration + returnSegment.duration,
      outboundDate: outbound.departure.time.slice(0, 10),
      returnDate: returnSegment.departure.time.slice(0, 10),
      score: 0,
    });
  }

  return options;
}

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as FlightSearchInput;

    if (!input?.origin || !input?.destination) {
      return NextResponse.json({ error: 'Origin and destination are required.' }, { status: 400 });
    }

    const departureDates = buildDateList(
      input.departureDateRange.start,
      input.departureDateRange.end,
      MAX_DATES_PER_LEG
    );
    const returnDates = buildDateList(
      input.returnDateRange.start,
      input.returnDateRange.end,
      MAX_DATES_PER_LEG
    );

    const [outboundSegments, returnSegments] = await Promise.all([
      fetchFlightsForDates(input.origin, input.destination, departureDates),
      fetchFlightsForDates(input.destination, input.origin, returnDates),
    ]);

    const options = buildFlightOptions(outboundSegments, returnSegments, input.travelers);
    const dateFiltered = filterFlightsByDateRange(
      options,
      input.departureDateRange.start,
      input.departureDateRange.end,
      input.returnDateRange.start,
      input.returnDateRange.end
    );
    const budgetFiltered = filterFlightsByBudget(dateFiltered, input.budget);
    const sorted = sortFlightsByPrice(budgetFiltered);

    return NextResponse.json({ options: sorted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch flights' },
      { status: 500 }
    );
  }
}
