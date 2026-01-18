import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';

const geminiApiKey = process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
  console.warn('GEMINI_API_KEY is not set. Trip itinerary generation will not work.');
}

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { trip_id } = body || {};
    if (!trip_id) {
      return NextResponse.json({ error: 'trip_id is required' }, { status: 400 });
    }

    if (!geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 500 });
    }

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', trip_id)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const { data: members, error: membersError } = await supabase
      .from('trip_members')
      .select('*')
      .eq('trip_id', trip_id);

    if (membersError) {
      return NextResponse.json({ error: 'Failed to fetch trip members' }, { status: 500 });
    }

    const { data: preferences, error: preferencesError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('trip_id', trip_id);

    if (preferencesError) {
      return NextResponse.json({ error: 'Failed to fetch user preferences' }, { status: 500 });
    }

    const membersList = members || [];
    const preferencesList = preferences || [];

    const activityInterests = preferencesList
      .flatMap((p) => p.activity_interests || [])
      .filter((interest, index, self) => self.indexOf(interest) === index);

    const destination = `${trip.destination_city || 'Unknown'}, ${trip.destination_country || 'Unknown'}`;

    const prompt = `Create a day-by-day travel itinerary for this group trip.

Trip:
- Destination: ${destination}
- Dates: ${trip.start_date || 'TBD'} to ${trip.end_date || 'TBD'}
- Timezone: ${trip.timezone || 'Unknown'}
- Travelers: ${membersList.length || 1}
- Budget range per person: $${trip.budget_min || 'TBD'} - $${trip.budget_max || 'TBD'}
- Interests: ${activityInterests.length ? activityInterests.join(', ') : 'General sightseeing, food, local culture'}

Requirements:
- Return JSON only (no markdown).
- Provide one entry per day between the start and end dates (inclusive).
- Each day must include: date (YYYY-MM-DD), title, budget_range, morning, afternoon, evening, notes.
- Keep activities realistic and specific to the destination.
- Balance paid activities with free/low-cost options if budget is moderate.

Return ONLY this JSON structure:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "title": "Short theme",
      "budget_range": "$100-$180",
      "morning": "...",
      "afternoon": "...",
      "evening": "...",
      "notes": "..."
    }
  ]
}`;

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    let jsonText = responseText;
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    let payload;
    try {
      payload = JSON.parse(jsonText);
    } catch (parseError: any) {
      return NextResponse.json(
        { error: 'Failed to parse JSON from AI response', message: parseError.message },
        { status: 500 }
      );
    }

    if (!payload?.days || !Array.isArray(payload.days)) {
      return NextResponse.json(
        { error: 'Invalid itinerary format from AI' },
        { status: 500 }
      );
    }

    return NextResponse.json({ days: payload.days });
  } catch (error: any) {
    console.error('Unexpected error in generate-trip-itinerary:', error);
    return NextResponse.json(
      { error: 'Failed to generate itinerary', message: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
