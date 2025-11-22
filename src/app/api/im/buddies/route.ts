import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    await dbConnect();

    // Get current user with populated buddy list
    const user = await User.findById(userId).populate('buddyList', 'username status lastSeen').lean();
    if (!user) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      );
    }

    // Format buddies for response
    const buddies = (user.buddyList || []).map((buddy: any) => ({
      id: String(buddy._id),
      username: buddy.username,
      status: buddy.status || 'offline',
      lastSeen: buddy.lastSeen?.toISOString(),
    }));

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        buddies,
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to fetch buddies' },
        { status: 500 }
      )
    );
  }
}

