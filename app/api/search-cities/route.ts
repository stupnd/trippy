import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const geminiApiKey = process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
  console.error('GEMINI_API_KEY is not set');
}

interface CitySuggestion {
  city: string;
  country: string;
  iata?: string;
  display: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ suggestions: [] }, { status: 200 });
    }

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is not configured' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are a travel assistant. Given the user's partial city search query "${query}", suggest up to 8 popular travel destinations (cities) that match the query.

For each city, provide:
- The city name (most common English name)
- The country name (full country name)
- The primary IATA airport code (3-letter code) for that city's main international airport

Return ONLY a valid JSON array in this exact format:
[
  {
    "city": "City Name",
    "country": "Country Name",
    "iata": "AAA",
    "display": "City Name, Country Name"
  }
]

Requirements:
- Return exactly 8 suggestions (or fewer if fewer matches exist)
- Use real, popular travel destinations
- Include the primary IATA code for each city's main international airport
- If you can't determine the IATA code, omit the "iata" field (don't guess)
- Sort by relevance (most popular/matching first)
- Return ONLY the JSON array, no markdown, no explanation, no code blocks`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse JSON from response (handle markdown code blocks if present)
    let jsonText = text.trim();
    if (jsonText.startsWith('```')) {
      // Remove markdown code block formatting
      jsonText = jsonText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '');
    }

    let suggestions: CitySuggestion[];
    try {
      suggestions = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      console.error('Response text:', text);
      // Fallback: return empty array
      return NextResponse.json({ suggestions: [] }, { status: 200 });
    }

    // Validate and clean suggestions
    const validSuggestions = suggestions
      .filter((s: any) => s.city && s.country)
      .map((s: any) => ({
        city: s.city.trim(),
        country: s.country.trim(),
        iata: s.iata ? s.iata.trim().toUpperCase() : undefined,
        display: s.display || `${s.city.trim()}, ${s.country.trim()}`,
      }))
      .slice(0, 8); // Limit to 8

    return NextResponse.json({ suggestions: validSuggestions }, { status: 200 });
  } catch (error: any) {
    console.error('Error in city search API:', error);
    return NextResponse.json(
      { error: 'Failed to search cities', details: error.message },
      { status: 500 }
    );
  }
}
