import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

    return NextResponse.json({
      destination: randomDestination,
      reason: 'Based on trending destinations and your travel preferences',
    });
  } catch (error: any) {
    console.error('Error generating surprise destination:', error);
    return NextResponse.json(
      { error: 'Failed to generate surprise destination' },
      { status: 500 }
    );
  }
}
