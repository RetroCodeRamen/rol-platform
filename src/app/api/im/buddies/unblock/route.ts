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

    // Find the user to unblock
    const userToUnblock = await User.findOne({ username: username.toLowerCase() });
    if (!userToUnblock) {
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

    // Initialize blockedUsers if it doesn't exist
    if (!currentUser.blockedUsers) {
      currentUser.blockedUsers = [];
    }

    // Remove from blocked users list
    const unblockedUserId = String(userToUnblock._id);
    const initialLength = currentUser.blockedUsers.length;
    currentUser.blockedUsers = currentUser.blockedUsers.filter(
      (id) => String(id) !== unblockedUserId
    );

    // Check if user was actually blocked
    if (currentUser.blockedUsers.length === initialLength) {
      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          message: 'User is not blocked',
        })
      );
    }

    await currentUser.save();

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        message: 'User has been unblocked',
      })
    );
  } catch (error: any) {
    console.error('Unblock user error:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to unblock user' },
        { status: 500 }
      )
    );
  }
}

