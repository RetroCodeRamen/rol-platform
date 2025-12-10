import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, resolve, normalize } from 'path';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import { rateLimit, RATE_LIMITS } from '@/lib/security/rateLimit';
import dbConnect from '@/lib/db/mongoose';
import FileAttachment from '@/lib/db/models/FileAttachment';
import { randomUUID } from 'crypto';

// Maximum file size: 1MB for free tier (will be configurable by subscription tier later)
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

// Allowed file types - whitelist approach for security
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
] as const;

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'txt'] as const;

// MIME type to extension mapping for validation
const MIME_TO_EXTENSION: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/jpg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'application/pdf': ['pdf'],
  'text/plain': ['txt'],
};

/**
 * Sanitize filename to prevent path traversal and injection attacks
 */
function sanitizeFilename(filename: string): string {
  // Remove path separators and dangerous characters
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '') // Only allow alphanumeric, dots, underscores, hyphens
    .replace(/\.\./g, '') // Remove path traversal attempts
    .replace(/^\.+/, '') // Remove leading dots
    .substring(0, 255); // Limit length
}

/**
 * Validate file extension against MIME type
 */
function validateFileType(mimeType: string, extension: string): boolean {
  // Check if MIME type is allowed
  if (!ALLOWED_MIME_TYPES.includes(mimeType as any)) {
    return false;
  }

  // Check if extension is allowed
  if (!ALLOWED_EXTENSIONS.includes(extension.toLowerCase() as any)) {
    return false;
  }

  // Verify extension matches MIME type
  const allowedExtensions = MIME_TO_EXTENSION[mimeType];
  if (!allowedExtensions) {
    return false;
  }

  return allowedExtensions.includes(extension.toLowerCase());
}

/**
 * Basic MIME type detection from file buffer (magic bytes)
 * This is a simplified version - for production, consider using a library like 'file-type'
 */
function detectMimeType(buffer: Buffer): string | null {
  // Check magic bytes for common file types
  const bytes = buffer.slice(0, 12);
  
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }
  
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }
  
  // WebP: Check for RIFF...WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return 'image/webp';
    }
  }
  
  // PDF: %PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf';
  }
  
  // Text files - check if all bytes are printable ASCII
  if (bytes.every(b => (b >= 0x20 && b <= 0x7E) || b === 0x09 || b === 0x0A || b === 0x0D)) {
    return 'text/plain';
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting for file uploads
    const rateLimitResult = rateLimit(request, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10, // 10 uploads per 15 minutes
      message: 'Too many file uploads. Please try again later.',
    });
    
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { success: false, error: 'Too many file uploads. Please try again later.' },
        { status: 429 }
      );
      response.headers.set('Retry-After', String(Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)));
      return addSecurityHeaders(response);
    }

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

    // Check file size (1MB limit for free tier)
    if (file.size > MAX_FILE_SIZE) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB for mail attachments` },
          { status: 400 }
        )
      );
    }

    // Validate file has a name
    if (!file.name || file.name.trim().length === 0) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Invalid filename' }, { status: 400 })
      );
    }

    // Sanitize original filename
    const sanitizedOriginalName = sanitizeFilename(file.name);
    if (sanitizedOriginalName.length === 0) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Invalid filename' }, { status: 400 })
      );
    }

    // Extract and validate file extension
    const fileNameParts = file.name.split('.');
    const fileExtension = fileNameParts.length > 1 
      ? fileNameParts[fileNameParts.length - 1].toLowerCase()
      : '';
    
    if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension as any)) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'File type not allowed. Allowed types: images (jpg, png, gif, webp), PDF, text files' },
          { status: 400 }
        )
      );
    }

    // Read file buffer for MIME type detection
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Detect MIME type from file content (magic bytes)
    const detectedMimeType = detectMimeType(buffer);
    const clientMimeType = file.type || 'application/octet-stream';

    // Use detected MIME type if available, otherwise fall back to client-provided (with caution)
    const mimeType = detectedMimeType || clientMimeType;

    // Validate file type - both extension and MIME type must match
    if (!validateFileType(mimeType, fileExtension)) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'File type validation failed. File content does not match file extension.' },
          { status: 400 }
        )
      );
    }

    // If client provided MIME type, verify it matches detected type
    if (detectedMimeType && clientMimeType !== 'application/octet-stream' && detectedMimeType !== clientMimeType) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'File type mismatch detected' },
          { status: 400 }
        )
      );
    }

    // Generate unique filename with validated extension
    const uniqueFilename = `${randomUUID()}.${fileExtension}`;
    
    // Create uploads directory if it doesn't exist (separate from IM attachments)
    const uploadsDir = resolve(process.cwd(), 'uploads', 'mail-attachments');
    await mkdir(uploadsDir, { recursive: true });

    // Construct file path and validate it's within uploads directory (path traversal protection)
    const filePath = resolve(uploadsDir, uniqueFilename);
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

    // Save file to disk
    await writeFile(filePath, buffer);

    // Create file attachment record
    const attachment = await FileAttachment.create({
      filename: uniqueFilename,
      originalName: sanitizedOriginalName,
      mimeType: mimeType,
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
    // Don't log sensitive error details
    console.error('Mail file upload error:', error.message);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to upload file' },
        { status: 500 }
      )
    );
  }
}
