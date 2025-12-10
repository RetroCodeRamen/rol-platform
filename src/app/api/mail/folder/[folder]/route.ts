import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import MailMessage, { MailFolder } from '@/lib/db/models/MailMessage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ folder: string }> }
) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    const { folder: folderParam } = await params;
    const folder = folderParam as MailFolder;
    
    // Validate folder
    const validFolders: MailFolder[] = ['Inbox', 'Sent', 'Drafts', 'Trash'];
    if (!validFolders.includes(folder)) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid folder' },
          { status: 400 }
        )
      );
    }

    await dbConnect();

    // Get pagination params
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = (page - 1) * limit;

    // Get messages for current user only, scoped by folder
    const messages = await MailMessage.find({
      ownerUserId: userId,
      folder,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await MailMessage.countDocuments({
      ownerUserId: userId,
      folder,
    });

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        messages: messages.map((msg) => ({
          id: String(msg._id),
          folder: msg.folder,
          from: msg.from,
          to: msg.to,
          cc: msg.cc,
          bcc: msg.bcc,
          subject: msg.subject,
          body: msg.body,
          createdAt: msg.createdAt.toISOString(),
          readAt: msg.readAt?.toISOString(),
          isRead: msg.isRead,
          hasAttachments: msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0,
          attachmentCount: msg.attachments && Array.isArray(msg.attachments) ? msg.attachments.length : 0,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to fetch messages' },
        { status: 500 }
      )
    );
  }
}

