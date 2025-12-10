import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { resolve, normalize } from 'path';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import FileAttachment from '@/lib/db/models/FileAttachment';
import MailMessage from '@/lib/db/models/MailMessage';

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

    // Check if user has access (either uploaded it or received it in a mail message)
    const isUploader = String(attachment.uploadedBy) === userId;
    
    let hasAccess = isUploader;
    if (!hasAccess) {
      // Check if attachment is linked to a mail message the user owns
      const mailMessage = await MailMessage.findOne({
        ownerUserId: userId,
        attachments: attachment._id,
      });
      hasAccess = !!mailMessage;
    }

    if (!hasAccess) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
      );
    }

    // Validate file path to prevent path traversal
    // Check both mail-attachments and im-attachments directories
    const mailUploadsDir = resolve(process.cwd(), 'uploads', 'mail-attachments');
    const imUploadsDir = resolve(process.cwd(), 'uploads', 'im-attachments');
    const filePath = resolve(attachment.path);
    const normalizedPath = normalize(filePath);
    
    // Ensure the resolved path is within one of the uploads directories
    const isInMailDir = normalizedPath.startsWith(normalize(mailUploadsDir));
    const isInImDir = normalizedPath.startsWith(normalize(imUploadsDir));
    
    if (!isInMailDir && !isInImDir) {
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
    console.error('Mail file download error:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to download file' },
        { status: 500 }
      )
    );
  }
}
