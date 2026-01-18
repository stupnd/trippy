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

    if (!tripId || !memberId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: memberRow, error: memberError } = await supabaseAdmin
      .from('trip_members')
      .select('id')
      .eq('id', memberId)
      .eq('trip_id', tripId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberError || !memberRow) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
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

    const payload = await request.json();
    const { trip_id, member_id } = payload ?? {};

    if (!trip_id || !member_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: memberRow, error: memberError } = await supabaseAdmin
      .from('trip_members')
      .select('id')
      .eq('id', member_id)
      .eq('trip_id', trip_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberError || !memberRow) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('user_preferences')
      .select('id')
      .eq('trip_id', trip_id)
      .eq('member_id', member_id)
      .maybeSingle();

    if (existingError) {
      console.error('Preferences fetch error:', existingError);
      throw existingError;
    }

    if (existing) {
      const { error } = await supabaseAdmin
        .from('user_preferences')
        .update(payload)
        .eq('id', existing.id);

      if (error) {
        console.error('Preferences update error:', error);
        throw error;
      }
    } else {
      const { error } = await supabaseAdmin
        .from('user_preferences')
        .insert(payload);

      if (error) {
        console.error('Preferences insert error:', error);
        throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to save preferences',
        details: error,
      },
      { status: 500 }
    );
  }
}
