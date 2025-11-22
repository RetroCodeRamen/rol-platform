import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromSession } from '@/lib/auth';
import { addSecurityHeaders } from '@/lib/security/headers';
import dbConnect from '@/lib/db/mongoose';
import User, { IUser } from '@/lib/db/models/User';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const requestId = `CURRENT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`\n[${requestId}] ========== CURRENT USER REQUEST START ==========`);
  console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
  console.log(`[${requestId}] URL: ${request.url}`);
  
  try {
    // Debug logging - check cookies before getUserIdFromSession
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('rol_session');
    const tokenCookie = cookieStore.get('rol_session_token');
    
    console.log(`[${requestId}] Raw cookie inspection:`);
    console.log(`[${requestId}]   rol_session: ${sessionCookie ? JSON.stringify({ name: sessionCookie.name, value: sessionCookie.value?.substring(0, 20) + '...', hasValue: !!sessionCookie.value }) : 'MISSING'}`);
    console.log(`[${requestId}]   rol_session_token: ${tokenCookie ? JSON.stringify({ name: tokenCookie.name, hasValue: !!tokenCookie.value }) : 'MISSING'}`);
    
    // Also check request headers
    const requestCookies = request.headers.get('cookie');
    console.log(`[${requestId}] Request Cookie header: ${requestCookies ? requestCookies.substring(0, 200) + '...' : 'NONE'}`);
    
    const userId = await getUserIdFromSession();

    if (!userId) {
      console.log(`[${requestId}] ❌ No user ID found in session - returning 401`);
      console.log(`[${requestId}] ========== CURRENT USER REQUEST FAILED ==========\n`);
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, user: null },
          { status: 401 }
        )
      );
    }
    
    console.log(`[${requestId}] ✅ User ID found: ${userId}`);

    console.log(`[${requestId}] Fetching user from database...`);
    await dbConnect();
    const user = await User.findById(userId) as IUser | null;

    if (!user) {
      console.log(`[${requestId}] ❌ User NOT FOUND in database for ID: ${userId}`);
      console.log(`[${requestId}] ========== CURRENT USER REQUEST FAILED ==========\n`);
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, user: null },
          { status: 404 }
        )
      );
    }

    console.log(`[${requestId}] ✅ User found: ${user.username} (${user.email})`);
    console.log(`[${requestId}] ========== CURRENT USER REQUEST SUCCESS ==========\n`);

    const response = NextResponse.json({
      success: true,
      user: {
        id: String(user._id),
        username: user.username,
        screenName: user.screenName,
        email: user.email,
        status: user.status,
        createdAt: user.createdAt?.toISOString(),
      },
    });

    return addSecurityHeaders(response);
  } catch (error: any) {
    console.error(`[${requestId}] ========== CURRENT USER REQUEST ERROR ==========`);
    console.error(`[${requestId}] Error:`, error);
    console.error(`[${requestId}] Stack:`, error.stack);
    console.error(`[${requestId}] ===============================================\n`);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, user: null },
        { status: 500 }
      )
    );
  }
}
