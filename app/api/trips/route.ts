import { NextRequest, NextResponse } from 'next/server';
import { tripStore } from '@/lib/store';
import { Trip } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const trip: Trip = await request.json();
    tripStore.create(trip);
    return NextResponse.json({ success: true, tripId: trip.id });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create trip' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id) {
    const trip = tripStore.get(id);
    if (!trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(trip);
  }

  return NextResponse.json(tripStore.getAll());
}