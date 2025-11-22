import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const currentUserId = await getUserIdFromSession();
    if (!currentUserId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    await dbConnect();

    const { username: usernameParam } = await params;
    const username = usernameParam.toLowerCase();
    const user = await User.findOne({ username }).lean();

    if (!user) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      );
    }

    // Check if current user has blocked this user or vice versa
    const currentUser = await User.findById(currentUserId).lean();
    const isBlocked = currentUser?.blockedUsers?.some(
      (id: any) => String(id) === String(user._id)
    );
    const hasBlockedMe = user.blockedUsers?.some(
      (id: any) => String(id) === String(currentUserId)
    );

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        profile: {
          username: user.username,
          screenName: user.screenName,
          profile: {
            bio: user.profile?.bio,
            location: user.profile?.location,
            interests: user.profile?.interests,
            favoriteQuote: user.profile?.favoriteQuote,
            textColor: user.profile?.textColor,
            font: user.profile?.font,
          },
          awayStatus: user.awayStatus,
          awayMessage: user.awayMessage,
        },
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to fetch profile' },
        { status: 500 }
      )
    );
  }
}

