import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const geminiApiKey = process.env.GEMINI_API_KEY;

const toString = (value: unknown, fallback = ''): string => {
  if (typeof value !== 'string') return fallback;
  return value.trim();
};

const isHttpsUrl = (value: string): boolean => {
  return /^https:\/\//i.test(value);
};

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 2500) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const isReachableImage = async (url: string): Promise<boolean> => {
  if (!isHttpsUrl(url)) return false;
  try {
    const head = await fetchWithTimeout(url, { method: 'HEAD' });
    if (head.ok) {
      const contentType = head.headers.get('content-type') || '';
      return contentType.startsWith('image/');
    }
  } catch {
    // Fall through to GET check.
  }

  try {
    const response = await fetchWithTimeout(url, { method: 'GET' });
    if (!response.ok) return false;
    const contentType = response.headers.get('content-type') || '';
    return contentType.startsWith('image/');
  } catch {
    return false;
  }
};

const fetchWikiImage = async (title: string): Promise<string> => {
  try {
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const response = await fetch(wikiUrl, {
      headers: { 'User-Agent': 'Trippy/1.0 (contact: support@trippy.app)' },
    });
    if (!response.ok) return '';
    const data = await response.json();
    const candidate = data?.thumbnail?.source || data?.originalimage?.source || '';
    return isHttpsUrl(candidate) ? candidate : '';
  } catch {
    return '';
  }
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const destination = toString(searchParams.get('destination') || '', '');

  if (!destination) {
    return NextResponse.json({ error: 'Destination is required' }, { status: 400 });
  }

  if (!geminiApiKey) {
    console.error('GEMINI_API_KEY is not set for trip images.');
    return NextResponse.json({ error: 'Gemini API key is not configured' }, { status: 500 });
  }

  const prompt = `Return ONLY valid JSON with a single key "image_url".

Destination: ${destination}

Requirements:
- image_url must be a direct https link to a real photo.
- Prefer Wikimedia Commons or official tourism board image URLs.
- Do NOT return Unsplash source or search URLs.`;

  try {
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

    const payload = JSON.parse(jsonText);
    const rawUrl = toString(payload?.image_url || payload?.imageUrl || payload?.image, '');
    let image = isHttpsUrl(rawUrl) ? rawUrl : '';

    if (image && !(await isReachableImage(image))) {
      image = '';
    }
    if (!image) {
      image = await fetchWikiImage(destination);
    }

    return NextResponse.json(
      { image },
      { headers: { 'Cache-Control': 'public, max-age=604800, stale-while-revalidate=2592000' } }
    );
  } catch (error: any) {
    console.error('Error generating trip image:', error);
    return NextResponse.json({ error: 'Failed to generate trip image' }, { status: 500 });
  }
}
