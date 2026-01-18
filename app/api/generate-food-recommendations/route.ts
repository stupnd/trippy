import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';

const geminiApiKey = process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
  console.warn('GEMINI_API_KEY is not set. Food recommendations will not work.');
}

type LocationPayload = {
  lat: number;
  lng: number;
  accuracy?: number;
};

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { trip_id, location } = body || {};
    const locationPayload = location as LocationPayload | undefined;
    if (!trip_id) {
      return NextResponse.json({ error: 'trip_id is required' }, { status: 400 });
    }

    if (!geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 500 });
    }

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('destination_city, destination_country')
      .eq('id', trip_id)
      .maybeSingle();

    if (tripError) {
      return NextResponse.json({ error: 'Failed to load trip details' }, { status: 500 });
    }

    const destination = trip
      ? `${trip.destination_city || 'Unknown'}, ${trip.destination_country || 'Unknown'}`
      : 'Unknown';

    const hasLocation =
      locationPayload &&
      typeof locationPayload.lat === 'number' &&
      typeof locationPayload.lng === 'number';

    const prompt = `Provide food recommendations for a traveler.

Context:
- Destination: ${destination}
- User location: ${hasLocation ? `${locationPayload!.lat}, ${locationPayload!.lng}` : 'Not provided'}

Requirements:
- Return JSON only (no markdown).
- Provide 8 recommendations.
- Each recommendation must include:
  - name
  - cuisine (general type like Indian, Italian, Mediterranean, etc.)
  - dietary_options (array of options like vegan, gluten-free, vegetarian)
  - price_range (e.g., "$", "$$", "$$$")
  - neighborhood (short area or nearby landmark)
  - why (short reason)
- Focus on places likely near the user's location if provided, otherwise near the destination.

Return ONLY this JSON structure:
{
  "recommendations": [
    {
      "name": "Place name",
      "cuisine": "Cuisine type",
      "dietary_options": ["Vegan", "Vegetarian"],
      "price_range": "$$",
      "neighborhood": "Neighborhood or landmark",
      "why": "Short reason"
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

    if (!payload?.recommendations || !Array.isArray(payload.recommendations)) {
      return NextResponse.json(
        { error: 'Invalid recommendations format from AI' },
        { status: 500 }
      );
    }

    return NextResponse.json({ recommendations: payload.recommendations });
  } catch (error: any) {
    console.error('Unexpected error in generate-food-recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to generate food recommendations', message: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
