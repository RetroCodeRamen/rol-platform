import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import MailMessage from '@/lib/db/models/MailMessage';

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

    // Get folder counts for the current user only
    const folders = ['Inbox', 'Sent', 'Drafts', 'Trash'] as const;
    const folderData = await Promise.all(
      folders.map(async (folder) => {
        const totalCount = await MailMessage.countDocuments({
          ownerUserId: userId,
          folder,
        });
        const unreadCount = await MailMessage.countDocuments({
          ownerUserId: userId,
          folder,
          isRead: false,
        });
        return {
          name: folder,
          totalCount,
          unreadCount,
        };
      })
    );

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        folders: folderData,
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to fetch folders' },
        { status: 500 }
      )
    );
  }
}

