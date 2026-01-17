import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';

const geminiApiKey = process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
  console.warn('GEMINI_API_KEY is not set. Trip budget generation will not work.');
}

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { trip_id } = body || {};
    if (!trip_id) {
      return NextResponse.json({ error: 'trip_id is required' }, { status: 400 });
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

    const accommodationBudgetRanges = preferencesList
      .filter((p) => p.accommodation_budget_min != null && p.accommodation_budget_max != null)
      .map((p) => ({
        min: p.accommodation_budget_min!,
        max: p.accommodation_budget_max!,
      }));

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

    const prompt = `Estimate a realistic total trip budget range per person in USD for a group trip.

Trip:
- Destination: ${destination}
- Dates: ${trip.start_date || 'TBD'} to ${trip.end_date || 'TBD'}
- Timezone: ${trip.timezone || 'Unknown'}
- Travelers: ${membersList.length || 1}

Preferences:
- Accommodation budget range per night: $${accommodationBudgetMin}-$${accommodationBudgetMax}
- Activity interests: ${activityInterests.length ? activityInterests.join(', ') : 'General'}

Return ONLY valid JSON:
{
  "budget_min": 0,
  "budget_max": 0
}

Rules:
- Provide integers (no decimals).
- budget_min must be <= budget_max.
- Keep the range realistic for the trip length and destination.`;

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

    let budget;
    try {
      budget = JSON.parse(jsonText);
    } catch (parseError: any) {
      return NextResponse.json(
        { error: 'Failed to parse JSON from AI response', message: parseError.message },
        { status: 500 }
      );
    }

    const budgetMin = Number(budget?.budget_min);
    const budgetMax = Number(budget?.budget_max);

    if (!Number.isFinite(budgetMin) || !Number.isFinite(budgetMax) || budgetMin > budgetMax) {
      return NextResponse.json(
        { error: 'Invalid budget range from AI response' },
        { status: 500 }
      );
    }

    const { data: updatedTrip, error: updateError } = await supabase
      .from('trips')
      .update({
        budget_min: budgetMin,
        budget_max: budgetMax,
        budget_updated_at: new Date().toISOString(),
      })
      .eq('id', trip_id)
      .select('budget_min, budget_max, budget_updated_at')
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update trip budget', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      budget_min: updatedTrip?.budget_min ?? budgetMin,
      budget_max: updatedTrip?.budget_max ?? budgetMax,
      budget_updated_at: updatedTrip?.budget_updated_at,
    });
  } catch (error: any) {
    console.error('Unexpected error in generate-trip-budget:', error);
    return NextResponse.json(
      { error: 'Failed to generate trip budget', message: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
