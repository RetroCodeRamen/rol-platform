import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { rateLimit, RATE_LIMITS } from '@/lib/security/rateLimit';
import { usernameSchema, sanitizeString } from '@/lib/security/validation';
import dbConnect from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = rateLimit(request, RATE_LIMITS.CHECK_USERNAME);
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { success: false, available: false, error: RATE_LIMITS.CHECK_USERNAME.message },
        { status: 429 }
      );
      response.headers.set('Retry-After', String(Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)));
      return addSecurityHeaders(response);
    }

    const body = await request.json();
    
    console.log('[AUTH] Check username request:', { username: body.username, type: typeof body.username });
    
    // Basic validation - if format is invalid, username is not available
    if (!body.username || typeof body.username !== 'string') {
      console.log('[AUTH] Invalid username format');
      return addSecurityHeaders(
        NextResponse.json(
          { success: true, available: false, error: 'Invalid username format' },
          { status: 200 }
        )
      );
    }

    // Validate format
    const validation = usernameSchema.safeParse(body.username);
    if (!validation.success) {
      // Format is invalid, so username is not available
      const errorMessages = validation.error.issues.map(e => e.message).join(', ');
      console.log('[AUTH] Username validation failed:', validation.error.issues);
      return addSecurityHeaders(
        NextResponse.json(
          { success: true, available: false, error: errorMessages },
          { status: 200 }
        )
      );
    }

    const sanitizedUsername = sanitizeString(validation.data.toLowerCase());
    console.log('[AUTH] Sanitized username:', sanitizedUsername);

    try {
      await dbConnect();
      console.log('[AUTH] Database connected successfully');
    } catch (dbError: any) {
      console.error('[AUTH] Database connection error:', dbError);
      console.error('[AUTH] Error message:', dbError.message);
      // If DB connection fails, assume username is available (fail open for better UX)
      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          available: true,
          warning: 'Database connection issue - please try again',
        })
      );
    }

    try {
      const existingUser = await User.findOne({
        username: sanitizedUsername,
      });

      console.log(`[AUTH] Checking username "${sanitizedUsername}":`, existingUser ? 'FOUND' : 'NOT FOUND');
      if (existingUser) {
        console.log('[AUTH] Existing user found:', { id: existingUser._id, username: existingUser.username });
      }

      const response = NextResponse.json({
        success: true,
        available: !existingUser,
      });

      console.log('[AUTH] Response:', { success: true, available: !existingUser });
      return addSecurityHeaders(response);
    } catch (dbQueryError: any) {
      console.error('[AUTH] Database query error:', dbQueryError);
      console.error('[AUTH] Error details:', {
        message: dbQueryError.message,
        name: dbQueryError.name,
        stack: dbQueryError.stack,
      });
      // If query fails, assume username is available (fail open)
      return addSecurityHeaders(
        NextResponse.json({
          success: true,
          available: true,
          warning: 'Could not verify username - please try again',
        })
      );
    }
  } catch (error: any) {
    console.error('[AUTH] Check username error:', error);
    console.error('[AUTH] Error stack:', error.stack);
    // Fail open - assume available if we can't check
    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        available: true,
        warning: 'Could not verify username availability',
      })
    );
  }
}
