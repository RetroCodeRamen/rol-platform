import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import Message from '@/lib/db/models/Message';

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
    const { messageIds } = body;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Message IDs array is required' },
          { status: 400 }
        )
      );
    }

    // Mark messages as read only if they were sent TO the current user
    const result = await Message.updateMany(
      {
        _id: { $in: messageIds },
        to: userId,
        readAt: null, // Only update if not already read
      },
      {
        $set: {
          readAt: new Date(),
        },
      }
    );

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        updated: result.modifiedCount,
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to mark messages as read' },
        { status: 500 }
      )
    );
  }
}

