import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import { generateInviteCode } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trip_id, user_id } = body || {};

    if (!trip_id || !user_id) {
      return NextResponse.json({ error: 'trip_id and user_id are required' }, { status: 400 });
    }

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', trip_id)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    if (!trip.is_public || (trip.status || 'planning') !== 'completed') {
      return NextResponse.json({ error: 'Trip is not available for duplication' }, { status: 403 });
    }

    const newTripId = uuidv4();
    const inviteCode = generateInviteCode();

    const { error: insertError } = await supabase
      .from('trips')
      .insert({
        id: newTripId,
        name: `${trip.name} (Copy)`,
        destination_city: trip.destination_city,
        destination_country: trip.destination_country,
        start_date: trip.start_date,
        end_date: trip.end_date,
        timezone: trip.timezone,
        invite_code: inviteCode,
        created_by: user_id,
        status: 'planning',
        is_public: false,
        summary: trip.summary,
        summary_updated_at: trip.summary_updated_at,
        budget_min: trip.budget_min,
        budget_max: trip.budget_max,
        budget_updated_at: trip.budget_updated_at,
      });

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to duplicate trip', details: insertError.message },
        { status: 500 }
      );
    }

    const { error: memberError } = await supabase
      .from('trip_members')
      .insert({
        trip_id: newTripId,
        user_id: user_id,
        name: 'Trip Owner',
      });

    if (memberError) {
      return NextResponse.json(
        { error: 'Failed to add creator to duplicated trip', details: memberError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ trip_id: newTripId });
  } catch (error: any) {
    console.error('Error duplicating trip:', error);
    return NextResponse.json({ error: 'Failed to duplicate trip' }, { status: 500 });
  }
}
