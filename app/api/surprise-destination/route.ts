import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const geminiApiKey = process.env.GEMINI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    // For MVP, return a random destination from a curated list
    const suggestions = [
      'Tokyo, Japan',
      'Bali, Indonesia',
      'Lisbon, Portugal',
      'Reykjavik, Iceland',
      'Marrakech, Morocco',
      'Santorini, Greece',
      'Kyoto, Japan',
      'Barcelona, Spain',
    ];

    const randomDestination = suggestions[Math.floor(Math.random() * suggestions.length)];

    if (!geminiApiKey) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 30);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 5);
      return NextResponse.json({
        destination: randomDestination,
        trip_name: `Surprise Escape to ${randomDestination.split(',')[0]}`,
        reason: 'Based on trending destinations and your travel preferences',
        start_date: startDate.toISOString().slice(0, 10),
        end_date: endDate.toISOString().slice(0, 10),
        duration_days: 5,
      });
    }

    const prompt = `Suggest a single surprising group trip destination and a realistic travel window.

Return ONLY valid JSON:
{
  "trip_name": "Creative trip name",
  "destination": "City, Country",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "duration_days": 0,
  "reason": "short reason"
}

Rules:
- Use a trip window within the next 6 months.
- Keep duration between 3 and 10 days.
- end_date must be after start_date.
- Destination should be exciting but realistic for a group trip.`;

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
      console.error('Failed to parse surprise destination:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse AI response for surprise destination' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      destination: payload.destination || randomDestination,
      trip_name: payload.trip_name || `Surprise Escape to ${randomDestination.split(',')[0]}`,
      reason: payload.reason || 'Based on trending destinations and your travel preferences',
      start_date: payload.start_date,
      end_date: payload.end_date,
      duration_days: payload.duration_days,
    });
  } catch (error: any) {
    console.error('Error generating surprise destination:', error);
    return NextResponse.json(
      { error: 'Failed to generate surprise destination' },
      { status: 500 }
    );
  }
}
