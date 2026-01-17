import { FlightOption, FlightPreference } from '@/types';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function buildDateList(start: string, end: string, maxDays = 7): string[] {
  if (!start || !end) return [];
  const startDate = new Date(start);
  const endDate = new Date(end);
  const dates: string[] = [];

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return dates;
  }

  const clampedEnd = new Date(Math.min(endDate.getTime(), startDate.getTime() + DAY_IN_MS * (maxDays - 1)));
  for (let d = startDate; d <= clampedEnd; d = new Date(d.getTime() + DAY_IN_MS)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function isDateWithinRange(date: string, start: string, end: string): boolean {
  if (!date || !start || !end) return false;
  const target = new Date(date).getTime();
  const rangeStart = new Date(start).getTime();
  const rangeEnd = new Date(end).getTime();
  if ([target, rangeStart, rangeEnd].some(Number.isNaN)) return false;
  return target >= rangeStart && target <= rangeEnd;
}

export function filterFlightsByBudget(options: FlightOption[], budget?: number): FlightOption[] {
  if (!budget || budget <= 0) return options;
  return options.filter(option => (option.roundTripPrice ?? option.price) <= budget);
}

export function filterFlightsByDateRange(
  options: FlightOption[],
  departureStart: string,
  departureEnd: string,
  returnStart: string,
  returnEnd: string
): FlightOption[] {
  return options.filter(option => {
    const outboundDate = option.outboundDate ?? option.departure.time;
    const returnDate = option.returnDate ?? option.returnSegment?.departure.time;
    if (!outboundDate || !returnDate) return false;
    return isDateWithinRange(outboundDate, departureStart, departureEnd) &&
      isDateWithinRange(returnDate, returnStart, returnEnd);
  });
}

export function sortFlightsByPrice(options: FlightOption[]): FlightOption[] {
  return [...options].sort((a, b) => (a.roundTripPrice ?? a.price) - (b.roundTripPrice ?? b.price));
}

export function formatFlightDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'N/A';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatFlightTime(isoTime?: string): string {
  if (!isoTime) return 'N/A';
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatFlightDate(isoDate?: string): string {
  if (!isoDate) return 'N/A';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatLayovers(layovers: { count: number; airports: string[] }): string {
  if (!layovers.count) return 'Direct';
  if (layovers.airports.length === 0) {
    return `${layovers.count} stop${layovers.count > 1 ? 's' : ''}`;
  }
  return `${layovers.count} stop${layovers.count > 1 ? 's' : ''} • ${layovers.airports.join(', ')}`;
}

// Deterministic hash function for consistent results
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Generate deterministic flight options based on origin + destination
export function generateMockFlights(
  preferences: FlightPreference[]
): FlightOption[] {
  if (preferences.length === 0) return [];

  // Use first preference for route (simplified for MVP)
  const pref = preferences[0];
  const origin = pref.origin.toUpperCase();
  const destination = pref.destination.toUpperCase();
  
  // Create deterministic seed from origin + destination
  const seed = hashString(`${origin}${destination}`);
  
  // Common airlines
  const airlines = [
    ['United Airlines'],
    ['American Airlines'],
    ['Delta'],
    ['Southwest'],
    ['JetBlue'],
    ['Alaska Airlines'],
    ['Spirit Airlines'],
    ['Frontier'],
    ['United Airlines', 'Lufthansa'],
    ['American Airlines', 'British Airways'],
    ['Delta', 'KLM'],
    ['United Airlines', 'Air Canada'],
  ];

  // Common layover airports (realistic hubs)
  const layoverHubs = ['DFW', 'ATL', 'DEN', 'ORD', 'LAX', 'JFK', 'CLT', 'PHX', 'SEA', 'MIA'];
  
  // Generate 10-12 flights deterministically
  const numFlights = 10 + (seed % 3); // 10-12 flights
  const flights: FlightOption[] = [];
  
  const basePrice = 300 + (seed % 300); // Base price $300-600
  const baseDuration = 180 + (seed % 240); // Base duration 3-7 hours
  
  for (let i = 0; i < numFlights; i++) {
    const flightSeed = seed + i * 1000; // Unique seed per flight
    const rand = () => flightSeed % 1000;
    
    // Price variation: $250-$850
    const priceMultiplier = 0.7 + (rand() % 30) / 100;
    const price = Math.round(basePrice * priceMultiplier);
    
    // Duration variation: 2-8 hours
    const durationMultiplier = 0.8 + (rand() % 60) / 100;
    const duration = Math.round(baseDuration * durationMultiplier);
    
    // Determine layovers (20% direct, 50% 1 layover, 30% 2 layovers)
    const layoverType = rand() % 100;
    let layovers;
    if (layoverType < 20) {
      // Direct flight
      layovers = { count: 0, airports: [] };
    } else if (layoverType < 70) {
      // 1 layover
      const hubIndex = rand() % layoverHubs.length;
      layovers = { count: 1, airports: [layoverHubs[hubIndex]] };
    } else {
      // 2 layovers
      const hub1 = layoverHubs[rand() % layoverHubs.length];
      let hub2 = layoverHubs[rand() % layoverHubs.length];
      while (hub2 === hub1) {
        hub2 = layoverHubs[rand() % layoverHubs.length];
      }
      layovers = { count: 2, airports: [hub1, hub2] };
    }
    
    // Calculate departure/arrival times based on duration and layovers
    const departureHour = 6 + (rand() % 14); // 6 AM - 8 PM
    const departureMinute = (rand() % 4) * 15; // 0, 15, 30, 45
    
    // Use first date from preference range
    const baseDate = new Date(pref.departureDateRange.start);
    const departure = new Date(baseDate);
    departure.setHours(departureHour, departureMinute, 0, 0);
    
    // Calculate arrival
    const arrival = new Date(departure);
    arrival.setMinutes(arrival.getMinutes() + duration);
    
    // Add layover time (1 hour per layover)
    if (layovers.count > 0) {
      arrival.setHours(arrival.getHours() + layovers.count);
    }
    
    const airline = airlines[i % airlines.length];
    
    const returnDeparture = new Date(pref.returnDateRange.start);
    returnDeparture.setHours(departureHour + 2, departureMinute, 0, 0);
    const returnArrival = new Date(returnDeparture);
    returnArrival.setMinutes(returnArrival.getMinutes() + duration);
    if (layovers.count > 0) {
      returnArrival.setHours(returnArrival.getHours() + layovers.count);
    }

    const returnSegment = {
      airline: airline[0],
      departure: {
        time: returnDeparture.toISOString(),
        airport: destination,
      },
      arrival: {
        time: returnArrival.toISOString(),
        airport: origin,
      },
      duration: duration + (layovers.count * 60),
      layovers,
      stops: layovers.count,
    };

    flights.push({
      id: `flight-${origin}-${destination}-${i}`,
      price,
      roundTripPrice: price * 2,
      currency: 'USD',
      airline,
      departure: {
        time: departure.toISOString(),
        airport: origin,
      },
      arrival: {
        time: arrival.toISOString(),
        airport: destination,
      },
      duration: duration + (layovers.count * 60), // Add layover wait time
      layovers,
      stops: layovers.count,
      returnSegment,
      totalDuration: duration + returnSegment.duration,
      outboundDate: departure.toISOString().slice(0, 10),
      returnDate: returnDeparture.toISOString().slice(0, 10),
      score: 0, // Will be scored later
    });
  }
  
  return flights;
}