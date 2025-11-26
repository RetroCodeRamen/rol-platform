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

    // Get current user with populated blocked users
    const user = await User.findById(userId).populate('blockedUsers', 'username screenName').lean();
    if (!user) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      );
    }

    // Format blocked users for response
    const blockedUsers = (user.blockedUsers || []).map((blockedUser: any) => ({
      id: String(blockedUser._id),
      username: blockedUser.username,
      screenName: blockedUser.screenName,
    }));

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        blockedUsers,
      })
    );
  } catch (error: any) {
    console.error('Get blocked users error:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to fetch blocked users' },
        { status: 500 }
      )
    );
  }
}

