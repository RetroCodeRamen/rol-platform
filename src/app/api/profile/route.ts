import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    await dbConnect();

    const user = await User.findById(userId).lean();
    if (!user) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      );
    }

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        profile: {
          username: user.username,
          screenName: user.screenName,
          bio: user.profile?.bio || '',
          location: user.profile?.location || '',
          interests: user.profile?.interests || [],
          favoriteQuote: user.profile?.favoriteQuote || '',
          textColor: user.profile?.textColor || '#000000',
          font: user.profile?.font || 'Arial',
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

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    await dbConnect();

    const body = await request.json();
    const { bio, location, interests, favoriteQuote, textColor, font } = body;

    const updateData: any = {
      'profile.bio': bio || '',
      'profile.location': location || '',
      'profile.interests': interests || [],
      'profile.favoriteQuote': favoriteQuote || '',
      'profile.textColor': textColor || '#000000',
      'profile.font': font || 'Arial',
    };

    const user = await User.findByIdAndUpdate(userId, updateData, { new: true }).lean();

    if (!user) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      );
    }

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        profile: {
          username: user.username,
          screenName: user.screenName,
          bio: user.profile?.bio || '',
          location: user.profile?.location || '',
          interests: user.profile?.interests || [],
          favoriteQuote: user.profile?.favoriteQuote || '',
          textColor: user.profile?.textColor || '#000000',
          font: user.profile?.font || 'Arial',
        },
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to update profile' },
        { status: 500 }
      )
    );
  }
}

