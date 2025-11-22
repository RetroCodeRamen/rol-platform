import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import Message from '@/lib/db/models/Message';
import User from '@/lib/db/models/User';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const currentUserId = await getUserIdFromSession();
    if (!currentUserId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    await dbConnect();

    const { userId: otherUserId } = await params;

    // Verify other user exists
    const otherUser = await User.findById(otherUserId).lean();
    if (!otherUser) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      );
    }

    // Get pagination params
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const before = searchParams.get('before'); // ISO timestamp for pagination

    // Build query
    const query: any = {
      type: 'im',
      deleted: false,
      $or: [
        { from: currentUserId, to: otherUserId },
        { from: otherUserId, to: currentUserId },
      ],
    };

    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    // Get messages
    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('from', 'username screenName')
      .populate('to', 'username screenName')
      .lean();

    // Reverse to get chronological order
    messages.reverse();

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        messages: messages.map((msg: any) => ({
          id: String(msg._id),
          from: msg.from.username,
          to: msg.to?.username,
          content: msg.content,
          timestamp: msg.timestamp.toISOString(),
          readAt: msg.readAt?.toISOString(),
        })),
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to fetch history' },
        { status: 500 }
      )
    );
  }
}

