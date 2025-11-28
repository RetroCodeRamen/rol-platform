import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials } from '@/lib/auth';
import { addSecurityHeaders } from '@/lib/security/headers';
import { rateLimit, RATE_LIMITS } from '@/lib/security/rateLimit';
import { validateAndSanitize, loginSchema, sanitizeString } from '@/lib/security/validation';
import { isAccountLocked, recordFailedLogin, clearFailedLogin } from '@/lib/security/accountLockout';
import { validateCSRFToken } from '@/lib/security/csrf';
import dbConnect from '@/lib/db/mongoose';
import User, { IUser } from '@/lib/db/models/User';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const requestId = `LOGIN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`\n[${requestId}] ========== LOGIN REQUEST START ==========`);
  console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
  console.log(`[${requestId}] URL: ${request.url}`);
  console.log(`[${requestId}] Method: ${request.method}`);
  
  try {
    // Check incoming cookies
    const incomingCookies = request.headers.get('cookie');
    console.log(`[${requestId}] Incoming cookies: ${incomingCookies ? incomingCookies.substring(0, 100) + '...' : 'NONE'}`);
    
    // Rate limiting
    console.log(`[${requestId}] Checking rate limit...`);
    const rateLimitResult = rateLimit(request, RATE_LIMITS.AUTH);
    if (!rateLimitResult.allowed) {
      console.log(`[${requestId}] Rate limit exceeded`);
      const response = NextResponse.json(
        { success: false, error: RATE_LIMITS.AUTH.message },
        { status: 429 }
      );
      response.headers.set('Retry-After', String(Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)));
      return addSecurityHeaders(response);
    }
    console.log(`[${requestId}] Rate limit check passed`);

    // CSRF protection (for state-changing operations)
    console.log(`[${requestId}] Validating CSRF token...`);
    const csrfValid = await validateCSRFToken(request);
    if (!csrfValid) {
      console.log(`[${requestId}] CSRF validation FAILED`);
      // Log detailed CSRF failure info for debugging
      try {
        const { cookies } = await import('next/headers');
        const cookieStore = await cookies();
        const csrfCookie = cookieStore.get('rol_csrf_token');
        const csrfHeader = request.headers.get('x-csrf-token') || request.headers.get('X-CSRF-Token');
        console.log(`[${requestId}] CSRF Debug - Cookie exists: ${!!csrfCookie?.value}, Header exists: ${!!csrfHeader}`);
        console.log(`[${requestId}] CSRF Debug - Cookie value length: ${csrfCookie?.value?.length || 0}, Header value length: ${csrfHeader?.length || 0}`);
      } catch (e) {
        console.log(`[${requestId}] CSRF Debug - Could not inspect cookies:`, e);
      }
      
      // In production, if CSRF fails but we have credentials, log it for investigation
      // but still return 403 (not 401) to distinguish from auth failures
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid security token. Please refresh the page and try again.' },
          { status: 403 }
        )
      );
    }
    console.log(`[${requestId}] CSRF validation passed`);

    const body = await request.json();
    console.log(`[${requestId}] Request body received: ${JSON.stringify({ username: body.username, password: '***' })}`);
    
    // Validate and sanitize input
    console.log(`[${requestId}] Validating input...`);
    const validation = validateAndSanitize(loginSchema, body);
    if (!validation.success) {
      console.log(`[${requestId}] Input validation FAILED: ${validation.error}`);
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: validation.error },
          { status: 400 }
        )
      );
    }
    console.log(`[${requestId}] Input validation passed`);

    const { username, password } = validation.data;
    const sanitizedUsername = sanitizeString(username.toLowerCase());
    console.log(`[${requestId}] Sanitized username: ${sanitizedUsername}`);

    // Check account lockout
    console.log(`[${requestId}] Checking account lockout...`);
    const lockoutStatus = await isAccountLocked(sanitizedUsername);
    if (lockoutStatus.locked) {
      console.log(`[${requestId}] Account is LOCKED`);
      const remainingMinutes = Math.ceil((lockoutStatus.lockoutUntil! - Date.now()) / 60000);
      return addSecurityHeaders(
        NextResponse.json(
          {
            success: false,
            error: `Account temporarily locked. Please try again in ${remainingMinutes} minute(s).`,
          },
          { status: 423 } // 423 Locked
        )
      );
    }
    console.log(`[${requestId}] Account lockout check passed`);

    // Verify credentials
    console.log(`[${requestId}] Verifying credentials...`);
    const isValid = await verifyCredentials(sanitizedUsername, password);

    if (!isValid) {
      console.log(`[${requestId}] Credential verification FAILED`);
      // Record failed attempt
      await recordFailedLogin(sanitizedUsername);
      
      // Don't reveal whether username exists (security best practice)
      // Use consistent error message that matches what the frontend expects
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid username or password' },
          { status: 401 }
        )
      );
    }
    console.log(`[${requestId}] Credential verification PASSED`);

    // Clear failed attempts on successful login
    console.log(`[${requestId}] Clearing failed login attempts...`);
    await clearFailedLogin(sanitizedUsername);

    // Get user and update status
    console.log(`[${requestId}] Connecting to database...`);
    await dbConnect();
    console.log(`[${requestId}] Database connected, fetching user...`);
    const user = await User.findOne({ username: sanitizedUsername }) as IUser | null;
    
    if (!user) {
      console.log(`[${requestId}] User NOT FOUND in database`);
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      );
    }
    console.log(`[${requestId}] User found: ${user.username} (ID: ${user._id})`);

    // Update user status to online
    console.log(`[${requestId}] Updating user status to online...`);
    user.status = 'online';
    user.lastSeen = new Date();
    await user.save();
    console.log(`[${requestId}] User status updated`);

    // Set session - create response first, then set cookies on it
    const userId = String(user._id);
    
    // Detect iframe context - check for iframe header or query parameter
    const isIframe = request.headers.get('x-iframe-context') === 'true' || 
                     request.nextUrl.searchParams.get('iframe') === 'true';
    
    // For iframe embedding, we MUST use SameSite=None with Secure=true
    // This is required for cross-origin iframe cookies to work
    let useSecure: boolean;
    let sameSite: 'strict' | 'lax' | 'none';
    
    if (isIframe) {
      // In iframe: SameSite=None REQUIRES Secure=true
      useSecure = true;
      sameSite = 'none';
      console.log(`[${requestId}] Iframe context detected - using SameSite=None, Secure=true`);
    } else {
      // Normal context: use environment-based settings
      useSecure = (process.env.NODE_ENV === 'production' || process.env.USE_SECURE_COOKIES === 'true') &&
                  process.env.USE_SECURE_COOKIES !== 'false';
      sameSite = (process.env.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none') || 'lax';
    }
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    console.log(`[${requestId}] Creating session...`);
    console.log(`[${requestId}] User ID: ${userId}`);
    console.log(`[${requestId}] Session token: ${sessionToken.substring(0, 16)}...`);
    console.log(`[${requestId}] Cookie settings - secure: ${useSecure}, sameSite: ${sameSite}, maxAge: 7 days`);
    
    const response = NextResponse.json({
      success: true,
      user: {
        id: userId,
        username: user.username,
        screenName: user.screenName,
        email: user.email,
        status: user.status,
      },
    });
    
    // Set session cookies directly on the response object
    // This ensures cookies are included in the response headers
    console.log(`[${requestId}] Setting cookies on response object...`);
    response.cookies.set('rol_session', userId, {
      httpOnly: true,
      secure: useSecure,
      sameSite: sameSite,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    
    response.cookies.set('rol_session_token', sessionToken, {
      httpOnly: true,
      secure: useSecure,
      sameSite: sameSite,
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    
    // Verify cookies were set
    const sessionCookie = response.cookies.get('rol_session');
    const tokenCookie = response.cookies.get('rol_session_token');
    console.log(`[${requestId}] Cookie verification:`);
    console.log(`[${requestId}]   rol_session: ${sessionCookie?.value ? `SET (${sessionCookie.value.substring(0, 8)}...)` : 'NOT SET'}`);
    console.log(`[${requestId}]   rol_session_token: ${tokenCookie?.value ? 'SET' : 'NOT SET'}`);
    
    // Check response headers
    const setCookieHeaders = response.headers.get('set-cookie');
    console.log(`[${requestId}] Set-Cookie headers: ${setCookieHeaders ? setCookieHeaders.substring(0, 200) + '...' : 'NONE'}`);
    
    console.log(`[${requestId}] ========== LOGIN REQUEST SUCCESS ==========\n`);

    return addSecurityHeaders(response);
  } catch (error: any) {
    console.error(`[${requestId}] ========== LOGIN REQUEST ERROR ==========`);
    console.error(`[${requestId}] Error:`, error);
    console.error(`[${requestId}] Stack:`, error.stack);
    console.error(`[${requestId}] =========================================\n`);
    // Don't leak error details
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Authentication failed' },
        { status: 500 }
      )
    );
  }
}
