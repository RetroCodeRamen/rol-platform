import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { resolve, normalize } from 'path';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import FileAttachment from '@/lib/db/models/FileAttachment';
import Message from '@/lib/db/models/Message';

export async function GET(
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

    await dbConnect();

    const { id } = await params;
    // Find attachment
    const attachment = await FileAttachment.findById(id);
    if (!attachment) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Attachment not found' }, { status: 404 })
      );
    }

    // Check if user has access (either uploaded it or received it in a message)
    const isUploader = String(attachment.uploadedBy) === userId;
    
    let hasAccess = isUploader;
    if (!hasAccess && attachment.messageId) {
      // Check if user is recipient or sender of the message
      const message = await Message.findById(attachment.messageId);
      if (message) {
        hasAccess = String(message.from) === userId || String(message.to) === userId;
      }
    }

    if (!hasAccess) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
      );
    }

    // Validate file path to prevent path traversal
    const uploadsDir = resolve(process.cwd(), 'uploads', 'im-attachments');
    const filePath = resolve(attachment.path);
    const normalizedPath = normalize(filePath);
    
    // Ensure the resolved path is within the uploads directory
    if (!normalizedPath.startsWith(normalize(uploadsDir))) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid file path' },
          { status: 400 }
        )
      );
    }

    // Read file from disk
    const fileBuffer = await readFile(attachment.path);

    // Return file with appropriate headers and security headers
    const response = new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `attachment; filename="${attachment.originalName}"`,
        'Content-Length': attachment.size.toString(),
        'X-Content-Type-Options': 'nosniff', // Prevent MIME type sniffing
      },
    });
    
    // Add additional security headers
    return addSecurityHeaders(response);
  } catch (error: any) {
    console.error('File download error:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to download file' },
        { status: 500 }
      )
    );
  }
}


