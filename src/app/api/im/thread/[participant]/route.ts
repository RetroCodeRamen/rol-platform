import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import Message from '@/lib/db/models/Message';
import User from '@/lib/db/models/User';
import FileAttachment from '@/lib/db/models/FileAttachment';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ participant: string }> }
) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    await dbConnect();

    const { participant: participantParam } = await params;
    const participantUsername = participantParam.toLowerCase();

    // Find participant user
    const participant = await User.findOne({ username: participantUsername });
    if (!participant) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      );
    }

    // Get all messages between current user and participant
    const messages = await Message.find({
      type: 'im',
      deleted: false,
      $or: [
        { from: userId, to: participant._id },
        { from: participant._id, to: userId },
      ],
    })
      .sort({ timestamp: 1 })
      .populate('from', 'username')
      .populate('to', 'username')
      .populate('attachments')
      .lean();

    // Format messages with attachments
    const formattedMessages = await Promise.all(
      messages.map(async (msg: any) => {
        const attachments = msg.attachments || [];
        const attachmentData = await Promise.all(
          attachments.map(async (att: any) => ({
            id: String(att._id),
            filename: att.originalName,
            size: att.size,
            mimeType: att.mimeType,
          }))
        );

        return {
          id: String(msg._id),
          from: msg.from.username,
          to: msg.to?.username,
          message: msg.content,
          timestamp: msg.timestamp.toISOString(),
          attachments: attachmentData.length > 0 ? attachmentData : undefined,
        };
      })
    );

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        thread: {
          id: `${userId}_${participant._id}`,
          participant: participant.username,
          messages: formattedMessages,
        },
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to fetch thread' },
        { status: 500 }
      )
    );
  }
}

