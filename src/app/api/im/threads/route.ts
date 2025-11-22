import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import Message from '@/lib/db/models/Message';
import User from '@/lib/db/models/User';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    await dbConnect();

    // Get all IM threads where current user is either sender or recipient
    const imMessages = await Message.find({
      type: 'im',
      deleted: false,
      $or: [
        { from: userId },
        { to: userId },
      ],
    })
      .sort({ timestamp: -1 })
      .populate('from', 'username')
      .populate('to', 'username')
      .lean();

    // Group messages by participant (the other user in the conversation)
    const threadMap = new Map<string, any[]>();

    for (const msg of imMessages) {
      const fromId = String(msg.from);
      const toId = String(msg.to);
      
      // Determine the other participant
      const participantId = fromId === userId ? toId : fromId;
      
      if (!threadMap.has(participantId)) {
        threadMap.set(participantId, []);
      }
      threadMap.get(participantId)!.push(msg);
    }

    // Get participant usernames and build thread list
    const threads = await Promise.all(
      Array.from(threadMap.entries()).map(async ([participantId, messages]) => {
        const participant = await User.findById(participantId).lean();
        if (!participant) return null;

        // Sort messages by timestamp
        messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Count unread messages (messages sent to current user that haven't been read)
        const unreadCount = messages.filter(
          (msg) => String(msg.to) === userId && !(msg as any).readAt
        ).length;

        return {
          id: `${userId}_${participantId}`,
          participant: participant.username,
          messages: messages.map((msg: any) => ({
            id: String(msg._id),
            from: msg.from.username,
            to: msg.to?.username,
            message: msg.content,
            timestamp: msg.timestamp.toISOString(),
          })),
          unreadCount,
        };
      })
    );

    // Filter out nulls and return
    const validThreads = threads.filter((t) => t !== null);

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        threads: validThreads,
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to fetch threads' },
        { status: 500 }
      )
    );
  }
}

