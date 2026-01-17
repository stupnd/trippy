import { NextRequest, NextResponse } from 'next/server';
import { tripStore } from '@/lib/store';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const trip = tripStore.get(params.id);
    if (!trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(trip);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch trip' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const updates = await request.json();
    tripStore.update(params.id, updates);
    const trip = tripStore.get(params.id);
    return NextResponse.json(trip);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update trip' },
      { status: 500 }
    );
  }
}