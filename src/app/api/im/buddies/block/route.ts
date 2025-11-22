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

    // Find the user to block
    const userToBlock = await User.findOne({ username: username.toLowerCase() });
    if (!userToBlock) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      );
    }

    // Can't block yourself
    if (String(userToBlock._id) === userId) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Cannot block yourself' },
          { status: 400 }
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

    // Add to blocked users list
    const blockedUserId = new mongoose.Types.ObjectId(userToBlock._id);
    if (!currentUser.blockedUsers) {
      currentUser.blockedUsers = [];
    }
    
    // Check if already blocked
    if (currentUser.blockedUsers.some((id) => String(id) === String(blockedUserId))) {
      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          message: 'User is already blocked',
        })
      );
    }

    currentUser.blockedUsers.push(String(blockedUserId));
    await currentUser.save();

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to block user' },
        { status: 500 }
      )
    );
  }
}

