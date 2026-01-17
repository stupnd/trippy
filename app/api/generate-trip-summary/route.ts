import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';

const geminiApiKey = process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
  console.warn('GEMINI_API_KEY is not set. Trip summary generation will not work.');
}

type ApprovedItem = {
  id: string;
  name?: string;
  title?: string;
  type?: string;
  price?: number;
  pricePerNight?: number;
  airline?: string;
  duration?: string;
  location?: string;
};

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { trip_id, approved, available_counts } = body || {};

    if (!trip_id) {
      return NextResponse.json(
        { error: 'trip_id is required' },
        { status: 400 }
      );
    }

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is not configured' },
        { status: 500 }
      );
    }

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', trip_id)
      .single();

    if (tripError || !trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    const { data: members, error: membersError } = await supabase
      .from('trip_members')
      .select('*')
      .eq('trip_id', trip_id);

    if (membersError) {
      return NextResponse.json(
        { error: 'Failed to fetch trip members' },
        { status: 500 }
      );
    }

    const { data: preferences, error: preferencesError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('trip_id', trip_id);

    if (preferencesError) {
      return NextResponse.json(
        { error: 'Failed to fetch user preferences' },
        { status: 500 }
      );
    }

    const membersList = members || [];
    const preferencesList = preferences || [];

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
      .filter((interest, index, self) => self.indexOf(interest) === index);

    let accommodationBudgetMin = 50;
    let accommodationBudgetMax = 300;
    if (accommodationBudgetRanges.length > 0) {
      const mins = accommodationBudgetRanges.map((r) => r.min);
      const maxs = accommodationBudgetRanges.map((r) => r.max);
      accommodationBudgetMin = Math.max(...mins);
      accommodationBudgetMax = Math.min(...maxs);
      if (accommodationBudgetMin > accommodationBudgetMax) {
        accommodationBudgetMin = Math.min(...mins);
        accommodationBudgetMax = Math.max(...maxs);
      }
    }

    const destination = `${trip.destination_city || 'Unknown'}, ${trip.destination_country || 'Unknown'}`;
    const approvedFlights: ApprovedItem[] = approved?.flights || [];
    const approvedStays: ApprovedItem[] = approved?.accommodations || [];
    const approvedActivities: ApprovedItem[] = approved?.activities || [];
    const availableCounts = available_counts || {};

    const prompt = `You are a travel planner. Write a concise Trip Summary for a new trip member.

Trip:
- Name: ${trip.name || 'Untitled trip'}
- Destination: ${destination}
- Dates: ${trip.start_date || 'TBD'} to ${trip.end_date || 'TBD'}
- Timezone: ${trip.timezone || 'Unknown'}
- Travelers: ${membersList.length || 1}
- Members: ${(membersList || []).map((m) => m.name).filter(Boolean).join(', ') || 'Not listed yet'}

Group Preferences:
- Origins: ${originAirports.length ? originAirports.join(', ') : 'Not specified'}
- Accommodation Budget Range: $${accommodationBudgetMin}-$${accommodationBudgetMax} per night
- Accommodation Types: ${accommodationTypes.length ? accommodationTypes.join(', ') : 'Any'}
- Activity Interests: ${activityInterests.length ? activityInterests.join(', ') : 'General'}

Available Options (counts):
- Flights: ${availableCounts.flights ?? 0}
- Stays: ${availableCounts.accommodations ?? 0}
- Activities: ${availableCounts.activities ?? 0}

Approved Items (unanimous):
- Flights: ${approvedFlights.length ? approvedFlights.map((f) => `${f.airline || f.name || f.id} (${f.duration || 'duration TBD'})`).join('; ') : 'None yet'}
- Stays: ${approvedStays.length ? approvedStays.map((s) => `${s.name || s.title || s.id} (${s.type || 'stay'})`).join('; ') : 'None yet'}
- Activities: ${approvedActivities.length ? approvedActivities.map((a) => `${a.name || a.title || a.id}`).join('; ') : 'None yet'}

Requirements:
- Write 1 short paragraph (2-4 sentences) describing what this trip is about and what it could look like.
- Add a second paragraph that summarizes the itinerary status and what's approved vs pending.
- Keep it under 140 words total.
- Use plain text only (no markdown, no bullet points).`;

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const summaryText = result.response.text().trim();

    const { data: updatedTrip, error: updateError } = await supabase
      .from('trips')
      .update({
        summary: summaryText,
        summary_updated_at: new Date().toISOString(),
      })
      .eq('id', trip_id)
      .select('summary, summary_updated_at')
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update trip summary', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      summary: updatedTrip?.summary || summaryText,
      summary_updated_at: updatedTrip?.summary_updated_at,
    });
  } catch (error: any) {
    console.error('Unexpected error in generate-trip-summary:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate trip summary',
        message: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
