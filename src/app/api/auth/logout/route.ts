import { NextRequest, NextResponse } from 'next/server';
import { clearUserSession, getCurrentUser } from '@/lib/auth';
import { addSecurityHeaders } from '@/lib/security/headers';
import { validateCSRFToken } from '@/lib/security/csrf';
import dbConnect from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';

export async function POST(request: NextRequest) {
  const requestId = `LOGOUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`\n[${requestId}] ========== LOGOUT REQUEST START ==========`);
  console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
  
  try {
    // Check incoming cookies before logout
    const incomingCookies = request.headers.get('cookie');
    console.log(`[${requestId}] Incoming cookies: ${incomingCookies ? incomingCookies.substring(0, 200) + '...' : 'NONE'}`);
    
    // CSRF protection
    console.log(`[${requestId}] Validating CSRF token...`);
    const csrfValid = await validateCSRFToken(request);
    if (!csrfValid) {
      console.log(`[${requestId}] ❌ CSRF validation FAILED`);
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid security token' },
          { status: 403 }
        )
      );
    }
    console.log(`[${requestId}] ✅ CSRF validation passed`);

    console.log(`[${requestId}] Getting current user from session...`);
    const userId = await getCurrentUser();
    console.log(`[${requestId}] Current user ID: ${userId || 'NONE'}`);

    if (userId) {
      console.log(`[${requestId}] Updating user status to offline...`);
      // Update user status to offline
      await dbConnect();
      const user = await User.findById(userId);
      if (user) {
        user.status = 'offline';
        user.lastSeen = new Date();
        await user.save();
        console.log(`[${requestId}] ✅ User status updated: ${user.username}`);
      } else {
        console.log(`[${requestId}] ⚠️ User not found in database`);
      }
    } else {
      console.log(`[${requestId}] ⚠️ No user ID found, skipping status update`);
    }

    console.log(`[${requestId}] Clearing user session...`);
    await clearUserSession();
    console.log(`[${requestId}] ✅ Session cleared via clearUserSession()`);

    const response = NextResponse.json({ success: true });
    
    // Explicitly clear cookies in the response headers as well
    // Use same configuration as login route
    const useSecure = (process.env.NODE_ENV === 'production' || process.env.USE_SECURE_COOKIES === 'true') &&
                      process.env.USE_SECURE_COOKIES !== 'false';
    const sameSite = (process.env.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none') || 'lax';
    console.log(`[${requestId}] Setting empty cookies on response (secure: ${useSecure}, sameSite: ${sameSite})...`);
    response.cookies.set('rol_session', '', {
      httpOnly: true,
      secure: useSecure,
      sameSite: sameSite,
      maxAge: 0,
      path: '/',
    });
    response.cookies.set('rol_session_token', '', {
      httpOnly: true,
      secure: useSecure,
      sameSite: sameSite,
      maxAge: 0,
      path: '/',
    });
    
    const setCookieHeaders = response.headers.get('set-cookie');
    console.log(`[${requestId}] Set-Cookie headers: ${setCookieHeaders ? setCookieHeaders.substring(0, 300) + '...' : 'NONE'}`);
    console.log(`[${requestId}] ========== LOGOUT REQUEST SUCCESS ==========\n`);
    
    return addSecurityHeaders(response);
  } catch (error: any) {
    console.error(`[${requestId}] ========== LOGOUT REQUEST ERROR ==========`);
    console.error(`[${requestId}] Error:`, error);
    console.error(`[${requestId}] Stack:`, error.stack);
    console.error(`[${requestId}] ===========================================\n`);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to logout' },
        { status: 500 }
      )
    );
  }
}
