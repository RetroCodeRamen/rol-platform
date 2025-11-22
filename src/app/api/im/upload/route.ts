import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import FileAttachment from '@/lib/db/models/FileAttachment';
import { randomUUID } from 'crypto';

// Maximum file size: 10MB (for free tier, will be configurable later)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
          { status: 400 }
        )
      );
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop() || '';
    const uniqueFilename = `${randomUUID()}.${fileExtension}`;
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'uploads', 'im-attachments');
    await mkdir(uploadsDir, { recursive: true });

    // Save file to disk
    const filePath = join(uploadsDir, uniqueFilename);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Create file attachment record
    const attachment = await FileAttachment.create({
      filename: uniqueFilename,
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      path: filePath,
      uploadedBy: userId,
      isP2P: false,
    });

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        attachment: {
          id: String(attachment._id),
          filename: attachment.originalName,
          size: attachment.size,
          mimeType: attachment.mimeType,
        },
      })
    );
  } catch (error: any) {
    console.error('File upload error:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to upload file' },
        { status: 500 }
      )
    );
  }
}


