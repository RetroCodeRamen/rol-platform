import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import BuddyRequest from '@/lib/db/models/BuddyRequest';
import User from '@/lib/db/models/User';
import mongoose from 'mongoose';

// GET: Fetch pending buddy requests for current user
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    await dbConnect();

    const pendingRequests = await BuddyRequest.find({
      recipientId: userId,
      status: 'pending',
    })
      .populate('requesterId', 'username screenName')
      .lean();

    const requests = pendingRequests.map((req: any) => ({
      id: String(req._id),
      requesterId: String(req.requesterId._id),
      requesterUsername: req.requesterId.username,
      requesterScreenName: req.requesterId.screenName,
      createdAt: req.createdAt.toISOString(),
    }));

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        requests,
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to fetch buddy requests' },
        { status: 500 }
      )
    );
  }
}

// POST: Accept or reject a buddy request
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
    const { requestId, action } = body; // action: 'accept' | 'reject'

    if (!requestId || !action || !['accept', 'reject'].includes(action)) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid request' },
          { status: 400 }
        )
      );
    }

    const buddyRequest = await BuddyRequest.findById(requestId);
    if (!buddyRequest) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Request not found' },
          { status: 404 }
        )
      );
    }

    // Verify this request is for the current user
    if (String(buddyRequest.recipientId) !== userId) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 403 }
        )
      );
    }

    if (action === 'accept') {
      // Update request status
      buddyRequest.status = 'accepted';
      await buddyRequest.save();

      // Add to both buddy lists
      const requester = await User.findById(buddyRequest.requesterId);
      const recipient = await User.findById(userId);

      if (!requester || !recipient) {
        return addSecurityHeaders(
          NextResponse.json(
            { success: false, error: 'User not found' },
            { status: 404 }
          )
        );
      }

      // Add requester to recipient's buddy list
      if (!recipient.buddyList) {
        recipient.buddyList = [];
      }
      const requesterId = String(buddyRequest.requesterId);
      if (!recipient.buddyList.some((id) => String(id) === requesterId)) {
        recipient.buddyList.push(requesterId);
        await recipient.save();
      }

      // Add recipient to requester's buddy list
      if (!requester.buddyList) {
        requester.buddyList = [];
      }
      const recipientId = String(userId);
      if (!requester.buddyList.some((id) => String(id) === recipientId)) {
        requester.buddyList.push(recipientId);
        await requester.save();
      }

      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          message: 'Buddy request accepted',
        })
      );
    } else {
      // Reject: just mark as rejected
      buddyRequest.status = 'rejected';
      await buddyRequest.save();

      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          message: 'Buddy request rejected',
        })
      );
    }
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to process buddy request' },
        { status: 500 }
      )
    );
  }
}

