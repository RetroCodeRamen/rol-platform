import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import Message from '@/lib/db/models/Message';
import User from '@/lib/db/models/User';
import FileAttachment from '@/lib/db/models/FileAttachment';

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
    const { to, message, attachmentIds } = body;

    // Validate input
    if (!to || typeof to !== 'string') {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Recipient is required' },
          { status: 400 }
        )
      );
    }

    // Message or attachments required
    const hasMessage = message && typeof message === 'string' && message.trim().length > 0;
    const hasAttachments = Array.isArray(attachmentIds) && attachmentIds.length > 0;

    if (!hasMessage && !hasAttachments) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Message or attachment is required' },
          { status: 400 }
        )
      );
    }

    // Validate attachment IDs belong to user
    if (hasAttachments) {
      const attachments = await FileAttachment.find({
        _id: { $in: attachmentIds },
        uploadedBy: userId,
      });
      if (attachments.length !== attachmentIds.length) {
        return addSecurityHeaders(
          NextResponse.json(
            { success: false, error: 'Invalid attachment IDs' },
            { status: 400 }
          )
        );
      }
    }

    // Find recipient user
    const recipient = await User.findOne({ username: to.toLowerCase() });
    if (!recipient) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Recipient not found' },
          { status: 404 }
        )
      );
    }

    // Can't send to yourself
    if (String(recipient._id) === userId) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Cannot send message to yourself' },
          { status: 400 }
        )
      );
    }

    // Get sender
    const sender = await User.findById(userId);
    if (!sender) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      );
    }

    // Check if recipient has blocked sender
    if (recipient.blockedUsers?.some((id) => String(id) === userId)) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Cannot send message to this user' },
          { status: 403 }
        )
      );
    }

    // Check if sender has blocked recipient
    if (sender.blockedUsers?.some((id) => String(id) === String(recipient._id))) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Cannot send message to this user' },
          { status: 403 }
        )
      );
    }

    // Check if both users are buddies (mutual acceptance required)
    const senderBuddyList = sender.buddyList || [];
    const recipientBuddyList = recipient.buddyList || [];
    const senderIsBuddy = senderBuddyList.some((id) => String(id) === String(recipient._id));
    const recipientIsBuddy = recipientBuddyList.some((id) => String(id) === userId);

    if (!senderIsBuddy || !recipientIsBuddy) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'You must be buddies to send messages' },
          { status: 403 }
        )
      );
    }

    // Create IM message
    const imMessage = await Message.create({
      from: userId,
      to: recipient._id,
      content: (message || '').trim(),
      type: 'im',
      deleted: false,
      attachments: hasAttachments ? attachmentIds : undefined,
    });

    // Update attachment records to link to message
    if (hasAttachments) {
      await FileAttachment.updateMany(
        { _id: { $in: attachmentIds } },
        { messageId: imMessage._id }
      );
    }

    // Populate for response
    await imMessage.populate('from', 'username');
    await imMessage.populate('to', 'username');

    // TODO: Emit WebSocket event for real-time delivery
    // socketServer.to(`user:${recipient._id}`).emit('im:new', {
    //   id: String(imMessage._id),
    //   from: sender.username,
    //   to: recipient.username,
    //   message: imMessage.content,
    //   timestamp: imMessage.timestamp.toISOString(),
    // });

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        message: {
          id: String(imMessage._id),
          from: (imMessage.from as any).username,
          to: (imMessage.to as any)?.username,
          message: imMessage.content,
          timestamp: imMessage.timestamp.toISOString(),
        },
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to send message' },
        { status: 500 }
      )
    );
  }
}

