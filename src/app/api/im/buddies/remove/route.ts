import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';
import mongoose from 'mongoose';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    await dbConnect();

    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== 'string') {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Username is required' },
          { status: 400 }
        )
      );
    }

    // Find the user to remove
    const buddyToRemove = await User.findOne({ username: username.toLowerCase() });
    if (!buddyToRemove) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      );
    }

    // Get current user
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      );
    }

    // Remove from buddy list
    const buddyId = new mongoose.Types.ObjectId(buddyToRemove._id);
    if (currentUser.buddyList) {
      currentUser.buddyList = currentUser.buddyList.filter(
        (id) => String(id) !== String(buddyId)
      );
      await currentUser.save();
    }

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to remove buddy' },
        { status: 500 }
      )
    );
  }
}

