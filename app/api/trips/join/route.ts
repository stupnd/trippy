import { NextRequest, NextResponse } from 'next/server';
import { tripStore } from '@/lib/store';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  request: NextRequest,
  { params }: { params: { code?: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    
    if (!code) {
      return NextResponse.json(
        { error: 'Invite code is required' },
        { status: 400 }
      );
    }

    const trip = tripStore.getByInviteCode(code);
    if (!trip) {
      return NextResponse.json(
        { error: 'Invalid invite code' },
        { status: 404 }
      );
    }

    const { name } = await request.json();
    const userId = uuidv4();

    const newMember = {
      id: userId,
      name,
      joinedAt: new Date().toISOString(),
      isOwner: false,
    };

    trip.members.push(newMember);
    tripStore.update(trip.id, { members: trip.members });

    return NextResponse.json({ success: true, tripId: trip.id, userId });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to join trip' },
      { status: 500 }
    );
  }
}