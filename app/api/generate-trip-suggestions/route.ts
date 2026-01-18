import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';
import { TripRow, UserPreferencesRow, TripMemberRow } from '@/lib/supabase';

const geminiApiKey = process.env.GEMINI_API_KEY;
const amadeusClientId = process.env.AMADEUS_CLIENT_ID;
const amadeusClientSecret = process.env.AMADEUS_CLIENT_SECRET;

if (!geminiApiKey) {
  console.warn('GEMINI_API_KEY is not set. Trip suggestions will not work.');
}

const fetchAmadeusToken = async () => {
  if (!amadeusClientId || !amadeusClientSecret) {
    return { error: 'Amadeus API keys are not configured', token: null };
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: amadeusClientId,
    client_secret: amadeusClientSecret,
  });

  const response = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Amadeus token error:', errorText);
    return { error: 'Failed to authenticate with Amadeus', token: null };
  }

  const payload = await response.json();
  return { error: null, token: payload.access_token as string };
};

const formatDuration = (duration: string) => {
  if (!duration) return '0h 0m';
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return duration;
  const hours = match[1] ? Number.parseInt(match[1], 10) : 0;
  const minutes = match[2] ? Number.parseInt(match[2], 10) : 0;
  return `${hours}h ${minutes}m`;
};

const resolveIataCode = async (token: string, keyword: string) => {
  if (!keyword) return '';
  const url = new URL('https://test.api.amadeus.com/v1/reference-data/locations');
  url.searchParams.set('keyword', keyword);
  url.searchParams.set('subType', 'AIRPORT,CITY');
  url.searchParams.set('page[limit]', '1');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return '';
  }

  const payload = await response.json();
  const candidate = payload?.data?.[0]?.iataCode;
  return typeof candidate === 'string' ? candidate : '';
};

const fetchAmadeusFlights = async ({
  token,
  origin,
  destination,
  departureDate,
  returnDate,
  travelers,
}: {
  token: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null;
  travelers: number;
}) => {
  const url = new URL('https://test.api.amadeus.com/v2/shopping/flight-offers');
  url.searchParams.set('originLocationCode', origin);
  url.searchParams.set('destinationLocationCode', destination);
  url.searchParams.set('departureDate', departureDate);
  if (returnDate) {
    url.searchParams.set('returnDate', returnDate);
  }
  url.searchParams.set('adults', String(Math.max(travelers, 1)));
  url.searchParams.set('currencyCode', 'USD');
  url.searchParams.set('max', '5');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Amadeus flight offers error:', errorText);
    return [];
  }

  const payload = await response.json();
  const offers = Array.isArray(payload?.data) ? payload.data : [];

  return offers.map((offer: any, index: number) => {
    const itinerary = offer.itineraries?.[0];
    const segments = itinerary?.segments || [];
    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];
    const layoverAirports = segments.slice(0, -1).map((segment: any) => segment.arrival?.iataCode).filter(Boolean);
    const airlineCode = firstSegment?.carrierCode || offer.validatingAirlineCodes?.[0] || 'Airline';
    const price = Number.parseFloat(offer?.price?.total || '0');
    const googleFlightsQuery = `https://www.google.com/travel/flights?q=Flights%20from%20${origin}%20to%20${destination}%20on%20${departureDate}`;

    return {
      id: `flight-${index + 1}`,
      airline: airlineCode,
      departure: {
        airport: firstSegment?.departure?.iataCode || origin,
        time: firstSegment?.departure?.at ? firstSegment.departure.at.slice(11, 16) : '',
        date: firstSegment?.departure?.at ? firstSegment.departure.at.slice(0, 10) : departureDate,
      },
      arrival: {
        airport: lastSegment?.arrival?.iataCode || destination,
        time: lastSegment?.arrival?.at ? lastSegment.arrival.at.slice(11, 16) : '',
        date: lastSegment?.arrival?.at ? lastSegment.arrival.at.slice(0, 10) : departureDate,
      },
      duration: formatDuration(itinerary?.duration || ''),
      price: Number.isFinite(price) ? Math.round(price) : 0,
      layovers: Math.max(segments.length - 1, 0),
      layoverAirports,
      link: googleFlightsQuery,
    };
  });
};

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { trip_id, rejection_context } = body;

    if (!trip_id) {
      return NextResponse.json(
        { error: 'trip_id is required' },
        { status: 400 }
      );
    }

    // Verify Gemini API key is configured
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY is not set');
      return NextResponse.json(
        { error: 'Gemini API key is not configured' },
        { status: 500 }
      );
    }

    // Fetch trip data - handle case where trip doesn't exist
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', trip_id)
      .single();

    if (tripError) {
      console.error('Error fetching trip:', tripError);
      // Check if it's a "not found" error
      if (tripError.code === 'PGRST116' || tripError.message?.includes('No rows')) {
        return NextResponse.json(
          { error: 'Trip not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch trip data', details: tripError.message },
        { status: 500 }
      );
    }

    if (!trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    // Fetch trip members - handle empty results
    const { data: members, error: membersError } = await supabase
      .from('trip_members')
      .select('*')
      .eq('trip_id', trip_id);

    if (membersError) {
      console.error('Error fetching trip members:', membersError);
      return NextResponse.json(
        { error: 'Failed to fetch trip members', details: membersError.message },
        { status: 500 }
      );
    }

    // Ensure members is an array (handle null/undefined)
    const membersList = members || [];

    // Fetch profiles for all members
    const memberUserIds = membersList.map((m: any) => m.user_id).filter(Boolean);
    let profilesMap = new Map<string, { full_name?: string }>();
    
    if (memberUserIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', memberUserIds);
      
      (profilesData || []).forEach(profile => {
        if (profile.id) {
          profilesMap.set(profile.id, {
            full_name: profile.full_name || undefined,
          });
        }
      });
    }

    // Fetch user preferences - handle empty results (this is OK - some users may not have preferences yet)
    const { data: preferences, error: preferencesError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('trip_id', trip_id);

    if (preferencesError) {
      console.error('Error fetching user preferences:', preferencesError);
      return NextResponse.json(
        { error: 'Failed to fetch user preferences', details: preferencesError.message },
        { status: 500 }
      );
    }

    // Ensure preferences is an array (handle null/undefined)
    const preferencesList = preferences || [];

    // Prepare preference data for the prompt - handle empty preferences gracefully
    const membersWithPreferences = membersList.map((member: any) => {
      const memberPrefs = preferencesList.find(
        (p) => p.member_id === member.id
      );
      const profile = member.user_id ? profilesMap.get(member.user_id) : null;
      return {
        name: profile?.full_name || 'Traveler',
        preferences: memberPrefs || null,
      };
    });

    // Aggregate overlapping preferences - safe with empty arrays
    const originAirports = preferencesList
      .map((p) => p.preferred_origin)
      .filter((origin): origin is string => !!origin);

    const accommodationBudgetRanges = preferencesList
      .filter((p) => p.accommodation_budget_min != null && p.accommodation_budget_max != null)
      .map((p) => ({
        min: p.accommodation_budget_min!,
        max: p.accommodation_budget_max!,
      }));

    const accommodationTypes = preferencesList
      .map((p) => p.accommodation_type)
      .filter((type): type is string => !!type);

    const activityInterests = preferencesList
      .flatMap((p) => p.activity_interests || [])
      .filter((interest, index, self) => self.indexOf(interest) === index); // unique

    const budgetSensitivities = preferencesList
      .map((p) => p.budget_sensitivity)
      .filter((bs): bs is string => !!bs);

    const flightFlexibilities = preferencesList
      .map((p) => p.flight_flexibility)
      .filter((ff): ff is string => !!ff);

    // Calculate overlapping budget range - handle empty arrays safely
    let accommodationBudgetMin = 50; // Default minimum
    let accommodationBudgetMax = 300; // Default maximum
    if (accommodationBudgetRanges.length > 0) {
      const mins = accommodationBudgetRanges.map((r) => r.min);
      const maxs = accommodationBudgetRanges.map((r) => r.max);
      accommodationBudgetMin = Math.max(...mins);
      accommodationBudgetMax = Math.min(...maxs);
      // If no overlap, use the union
      if (accommodationBudgetMin > accommodationBudgetMax) {
        accommodationBudgetMin = Math.min(...mins);
        accommodationBudgetMax = Math.max(...maxs);
      }
    }

    // Use trip destination as default if no preferences provided
    const destination = `${trip.destination_city || 'Unknown'}, ${trip.destination_country || 'Unknown'}`;
    // Use trip origin_iata if available, otherwise fall back to user preferences
    const tripOrigin = (trip as any).origin_iata || null;
    const preferredOrigins =
      tripOrigin
        ? [tripOrigin]
        : originAirports.length > 0
        ? originAirports
        : ['Not specified'];

    // Construct the prompt for Gemini - handle missing trip data
    const rejectionNotes = rejection_context
      ? `\nRejection feedback (use this to improve new options):\n${rejection_context}`
      : '';
    const prompt = `You are an expert travel coordinator. Based on the following group preferences for a trip to ${destination}, suggest 5 accommodations and 10 activities.${rejectionNotes}

Trip Details:
- Origin: ${(trip as any).origin_city || 'Not specified'} (${tripOrigin || 'Not specified'})
- Destination: ${destination}
- Start Date: ${trip.start_date || 'Not specified'}
- End Date: ${trip.end_date || 'Not specified'}
- Number of Travelers: ${membersList.length || 1}

Group Preferences Summary:
- Origin Airport: ${preferredOrigins.join(', ') || 'Not specified'}${tripOrigin ? ' (from trip)' : originAirports.length > 0 ? ' (from preferences)' : ''}
- Flight Flexibility: ${flightFlexibilities.join(', ') || 'medium'}
- Budget Sensitivity: ${budgetSensitivities.join(', ') || 'medium'}
- Accommodation Budget Range: $${accommodationBudgetMin}-$${accommodationBudgetMax} per night
- Preferred Accommodation Types: ${accommodationTypes.join(', ') || 'any'}
- Activity Interests: ${activityInterests.join(', ') || 'General travel activities'}

Individual Member Details:
${membersWithPreferences.map((m) => {
  const prefs = m.preferences;
  return `- ${m.name}: ${
    prefs
      ? `Origin: ${prefs.preferred_origin || 'Not specified'}, Budget: ${
          prefs.accommodation_budget_min || 'N/A'
        }-$${prefs.accommodation_budget_max || 'N/A'}/night, Interests: ${
          prefs.activity_interests?.join(', ') || 'General'
        }`
      : 'No preferences submitted yet'
  }`;
}).join('\n')}

Please provide suggestions in the following strict JSON format:

{
  "accommodations": [
    {
      "id": "accommodation-1",
      "name": "Hotel/Accommodation Name",
      "type": "hotel|airbnb|hostel",
      "pricePerNight": 99,
      "location": "Address or area",
      "rating": 4.5,
      "features": ["WiFi", "Pool", "Parking"],
      "link": "https://booking-url.com/accommodation-id"
    }
  ],
  "activities": [
    {
      "id": "activity-1",
      "name": "Activity Name",
      "type": "sightseeing|adventure|food|culture|relaxation",
      "duration": "2-3 hours",
      "price": 49,
      "location": "Location name",
      "description": "Brief description"
    }
  ]
}

Important: 
- Return ONLY valid JSON, no markdown formatting, no code blocks.
- Provide exactly 5 accommodations and 10 activities.
- Use realistic data for prices, airports, and locations.
- Consider the group's budget ranges and preferences.
- For accommodations, prioritize the preferred types but include variety.
- For activities, focus on the interests mentioned but provide a diverse mix.
- CRITICAL: Include a "link" field for each accommodation with a realistic booking URL (e.g., "https://www.booking.com/hotel/...", or "https://www.airbnb.com/rooms/...").`;

    // Initialize Gemini - verify API key is valid
    if (!geminiApiKey || typeof geminiApiKey !== 'string') {
      console.error('Invalid GEMINI_API_KEY');
      return NextResponse.json(
        { error: 'Invalid Gemini API key configuration' },
        { status: 500 }
      );
    }

    let genAI;
    try {
      genAI = new GoogleGenerativeAI(geminiApiKey);
    } catch (initError: any) {
      console.error('Error initializing Gemini client:', initError);
      return NextResponse.json(
        { error: 'Failed to initialize Gemini client', details: initError.message },
        { status: 500 }
      );
    }
    
    // Use gemini-2.0-flash model (as specified)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Generate content with the constructed prompt
    const result = await model.generateContent(prompt);
    
    // Extract text from response
    const responseText = result.response.text();
    
    // Parse JSON from response (remove markdown code blocks if present)
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    let suggestions;
    try {
      suggestions = JSON.parse(jsonText);
    } catch (parseError: any) {
      console.error('Failed to parse Gemini response:', jsonText);
      return NextResponse.json(
        {
          error: 'Failed to parse JSON from AI response',
          message: parseError.message,
          rawResponse: responseText.substring(0, 500), // First 500 chars for debugging
        },
        { status: 500 }
      );
    }

    // Validate structure
    if (
      !suggestions.accommodations ||
      !Array.isArray(suggestions.accommodations) ||
      !suggestions.activities ||
      !Array.isArray(suggestions.activities)
    ) {
      return NextResponse.json(
        {
          error: 'Invalid response structure from AI',
          message: 'Response missing required fields (accommodations, activities)',
          suggestions,
        },
        { status: 500 }
      );
    }

    let flights: any[] = [];
    if (amadeusClientId && amadeusClientSecret) {
      const { error: tokenError, token } = await fetchAmadeusToken();
      if (!tokenError && token) {
        let originCode = preferredOrigins[0];
        if (originCode && !/^[A-Z]{3}$/.test(originCode)) {
          originCode = await resolveIataCode(token, originCode);
        }
        let destinationCode = (trip as any).destination_iata || '';
        if (!destinationCode) {
          destinationCode = await resolveIataCode(token, trip.destination_city || '');
        }
        if (originCode && destinationCode && trip.start_date && /^[A-Z]{3}$/.test(originCode) && /^[A-Z]{3}$/.test(destinationCode)) {
          flights = await fetchAmadeusFlights({
            token,
            origin: originCode,
            destination: destinationCode,
            departureDate: trip.start_date,
            returnDate: trip.end_date || null,
            travelers: membersList.length || 1,
          });
        }
      }
    }

    // Persist suggestions
    const { error: suggestionsError } = await supabase
      .from('trip_suggestions')
      .upsert(
        {
          trip_id,
          flights,
          accommodations: suggestions.accommodations,
          activities: suggestions.activities,
          generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'trip_id' }
      );

    if (suggestionsError) {
      console.error('Error saving trip suggestions:', suggestionsError);
      return NextResponse.json(
        { error: 'Failed to save suggestions' },
        { status: 500 }
      );
    }

    // Success - return suggestions
    return NextResponse.json({
      success: true,
      trip_id,
      model_used: 'gemini-2.0-flash',
      suggestions: {
        flights,
        accommodations: suggestions.accommodations,
        activities: suggestions.activities,
      },
    });
  } catch (error: any) {
    // Catch any unexpected errors
    console.error('Unexpected error in generate-trip-suggestions:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate trip suggestions',
        message: error.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
