import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import Message from '@/lib/db/models/Message';
import User from '@/lib/db/models/User';
import FileAttachment from '@/lib/db/models/FileAttachment';
import mongoose from 'mongoose';

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

    // Convert userId to ObjectId if it's a string
    const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
    const participantIdObj = participant._id;

    // Get all messages between current user and participant
    const messages = await Message.find({
      type: 'im',
      deleted: false,
      $or: [
        { from: userIdObj, to: participantIdObj },
        { from: participantIdObj, to: userIdObj },
      ],
    })
      .sort({ timestamp: 1 })
      .populate('from', 'username screenName')
      .populate('to', 'username screenName')
      .lean();

    // Get user info for from/to fields if not populated
    const getUserInfo = async (userIdOrObj: any): Promise<string | null> => {
      if (!userIdOrObj) return null;
      if (typeof userIdOrObj === 'object' && userIdOrObj.username) {
        return userIdOrObj.username;
      }
      if (typeof userIdOrObj === 'string' || userIdOrObj._id) {
        const user = await User.findById(userIdOrObj).select('username').lean();
        return user?.username || null;
      }
      return null;
    };

    // Format messages with attachments
    const formattedMessages = await Promise.all(
      messages.map(async (msg: any) => {
        try {
          // Load attachments separately if they exist
          let attachmentData: any[] = [];
          if (msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
            try {
              const attachments = await FileAttachment.find({
                _id: { $in: msg.attachments },
              }).lean();
              attachmentData = attachments.map((att: any) => ({
                id: String(att._id),
                filename: att.originalName || 'unknown',
                size: att.size || 0,
                mimeType: att.mimeType || 'application/octet-stream',
              }));
            } catch (attErr) {
              console.error('[api/im/thread] Error loading attachments:', attErr);
            }
          }

          const fromUsername = await getUserInfo(msg.from);
          const toUsername = await getUserInfo(msg.to);

          if (!fromUsername) {
            console.error('[api/im/thread] Missing from username for message:', msg._id);
          }

          return {
            id: String(msg._id),
            from: fromUsername || 'unknown',
            to: toUsername || undefined,
            message: msg.content || '',
            timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
            attachments: attachmentData.length > 0 ? attachmentData : undefined,
          };
        } catch (err: any) {
          console.error('[api/im/thread] Error formatting message:', msg._id, err);
          // Return a minimal message object to prevent complete failure
          return {
            id: String(msg._id),
            from: 'unknown',
            to: undefined,
            message: msg.content || '',
            timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
            attachments: undefined,
          };
        }
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
    console.error('[api/im/thread] Error:', error);
    console.error('[api/im/thread] Stack:', error.stack);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: error.message || 'Failed to fetch thread' },
        { status: 500 }
      )
    );
  }
}

