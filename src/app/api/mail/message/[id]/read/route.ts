import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import MailMessage from '@/lib/db/models/MailMessage';
import mongoose from 'mongoose';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    const { id: messageId } = await params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid message ID' },
          { status: 400 }
        )
      );
    }

    await dbConnect();

    // Update message ONLY if it belongs to the current user
    const message = await MailMessage.findOneAndUpdate(
      {
        _id: messageId,
        ownerUserId: userId,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
      { new: true }
    );

    if (!message) {
      // Return 404 to prevent information leakage
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Message not found' },
          { status: 404 }
        )
      );
    }

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        message: {
          id: String(message._id),
          isRead: message.isRead,
          readAt: message.readAt?.toISOString(),
        },
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to mark message as read' },
        { status: 500 }
      )
    );
  }
}

