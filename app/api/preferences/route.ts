import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { supabase } from '@/lib/supabase';

async function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return data.user;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tripId = searchParams.get('tripId');
    const memberId = searchParams.get('memberId');

    if (!tripId || !memberId || memberId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('user_preferences')
      .select('*')
      .eq('trip_id', tripId)
      .eq('member_id', memberId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    const { trip_id, member_id } = payload ?? {};

    if (!trip_id || !member_id || member_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('user_preferences')
      .select('id')
      .eq('trip_id', trip_id)
      .eq('member_id', member_id)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      const { error } = await supabaseAdmin
        .from('user_preferences')
        .update(payload)
        .eq('id', existing.id);

      if (error) {
        throw error;
      }
    } else {
      const { error } = await supabaseAdmin
        .from('user_preferences')
        .insert(payload);

      if (error) {
        throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save preferences' },
      { status: 500 }
    );
  }
}
