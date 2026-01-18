import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const geminiApiKey = process.env.GEMINI_API_KEY;
const allowedVibes = ['neon', 'nature', 'history', 'coastal'] as const;

const toString = (value: unknown, fallback = ''): string => {
  if (typeof value !== 'string') return fallback;
  return value.trim();
};

const toNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const toCountryCode = (value: unknown): string => {
  const code = toString(value, '').toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : '';
};

const slugify = (value: string): string => {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return cleaned || 'destination';
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number.parseInt(searchParams.get('limit') || '8', 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 12) : 8;

  if (!geminiApiKey) {
    console.error('GEMINI_API_KEY is not set for trending destinations.');
    return NextResponse.json(
      { error: 'Gemini API key is not configured' },
      { status: 500 }
    );
  }

  const prompt = `Return ONLY valid JSON for ${limit} trending travel destinations.

Output a JSON array. Each item must include:
- name: city or destination name
- country: country name
- country_code: ISO 3166-1 alpha-2 country code (2 letters)
- description: short 1-sentence summary (max 90 characters)
- vibe: one of ${allowedVibes.join(', ')}
- lat: latitude as number
- lng: longitude as number
- image_url: a direct https image URL (prefer Wikimedia Commons, official tourism boards, or other open-license sources)

Rules:
- Provide ${limit} unique destinations worldwide.
- Keep description concise and vivid.
- Use the vibe list exactly.`;

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
    const rawList = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.destinations)
        ? payload.destinations
        : [];

    if (!Array.isArray(rawList) || rawList.length === 0) {
      return NextResponse.json(
        { error: 'Gemini response did not include destinations' },
        { status: 500 }
      );
    }

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

    const destinations = await Promise.all(rawList.slice(0, limit).map(async (item: any, index: number) => {
      const name = toString(item?.name, `Destination ${index + 1}`);
      const country = toString(item?.country, 'Unknown');
      const countryCode = toCountryCode(item?.country_code || item?.countryCode);
      const description = toString(item?.description, 'Explore this destination.');
      const vibeInput = toString(item?.vibe, 'history');
      const vibe = allowedVibes.includes(vibeInput as typeof allowedVibes[number])
        ? (vibeInput as typeof allowedVibes[number])
        : 'history';
      const lat = toNumber(item?.lat, 0);
      const lng = toNumber(item?.lng, 0);
      const imageUrl = toString(item?.image_url || item?.imageUrl || item?.image, '');
      let image = isHttpsUrl(imageUrl) ? imageUrl : '';
      if (image && !(await isReachableImage(image))) {
        image = '';
      }
      if (!image) {
        image = await fetchWikiImage(`${name}, ${country}`);
      }
      if (!image) {
        image = await fetchWikiImage(name);
      }
      const idBase = toString(item?.id, `${name}-${country}-${index}`);

      return {
        id: slugify(idBase),
        name,
        country,
        countryCode,
        description,
        vibe,
        lat,
        lng,
        image,
      };
    }));

    return NextResponse.json(
      { destinations },
      { headers: { 'Cache-Control': 'public, max-age=21600, stale-while-revalidate=86400' } }
    );
  } catch (error: any) {
    console.error('Error generating trending destinations:', error);
    return NextResponse.json(
      { error: 'Failed to generate trending destinations' },
      { status: 500 }
    );
  }
}
