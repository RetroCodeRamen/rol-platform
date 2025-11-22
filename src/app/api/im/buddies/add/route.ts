import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';
import BuddyRequest from '@/lib/db/models/BuddyRequest';
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

    // Find the user to add as buddy
    const buddyToAdd = await User.findOne({ username: username.toLowerCase() });
    if (!buddyToAdd) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      );
    }

    // Can't add yourself
    if (String(buddyToAdd._id) === userId) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Cannot add yourself as a buddy' },
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

    // Check if already in buddy list
    const buddyId = new mongoose.Types.ObjectId(buddyToAdd._id);
    if (currentUser.buddyList?.some((id) => String(id) === String(buddyId))) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'User is already in your buddy list' },
          { status: 400 }
        )
      );
    }

    // Check if there's already a pending request
    const existingRequest = await BuddyRequest.findOne({
      requesterId: userId,
      recipientId: buddyToAdd._id,
      status: 'pending',
    });

    if (existingRequest) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Buddy request already sent' },
          { status: 400 }
        )
      );
    }

    // Check if there's a pending request from them to us (mutual acceptance)
    const reverseRequest = await BuddyRequest.findOne({
      requesterId: buddyToAdd._id,
      recipientId: userId,
      status: 'pending',
    });

    if (reverseRequest) {
      // Both want to be buddies - auto-accept both sides
      reverseRequest.status = 'accepted';
      await reverseRequest.save();

      // Add to both buddy lists
      if (!currentUser.buddyList) {
        currentUser.buddyList = [];
      }
      currentUser.buddyList.push(String(buddyId));
      await currentUser.save();

      if (!buddyToAdd.buddyList) {
        buddyToAdd.buddyList = [];
      }
      buddyToAdd.buddyList.push(String(userId));
      await buddyToAdd.save();

      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          buddy: {
            id: String(buddyToAdd._id),
            username: buddyToAdd.username,
            status: buddyToAdd.status || 'offline',
          },
          message: 'Buddy request accepted!',
        })
      );
    }

    // Create new pending request
    const buddyRequest = await BuddyRequest.create({
      requesterId: userId,
      recipientId: buddyToAdd._id,
      status: 'pending',
    });

    // TODO: Emit WebSocket event to notify recipient if online
    // For now, the recipient will see it on next ping or page load

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        message: 'Buddy request sent',
        requestId: String(buddyRequest._id),
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to add buddy' },
        { status: 500 }
      )
    );
  }
}

