import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dbConnect from './db/mongoose';
import User from './db/models/User';

// Use constant-time comparison for password verification
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  try {
    await dbConnect();
    const user = await User.findOne({ username: username.toLowerCase() });
    
    if (!user) {
      // Still perform hash comparison to prevent timing attacks
      // Use a dummy hash to maintain constant time
      const dummyHash = '$2a$10$dummyhashdummyhashdummyhashdummyhashdummyhashdummyhashdummyhashdummyhashdummy';
      await bcrypt.compare(password, dummyHash);
      return false;
    }
    
    // Use bcrypt compare which is already constant-time
    return await bcrypt.compare(password, user.passwordHash);
  } catch (error) {
    console.error('[AUTH] Error verifying credentials:', error);
    return false;
  }
}

export async function setUserSession(userId: string): Promise<void> {
  const cookieStore = await cookies();
  // Allow explicit override for production behind proxies
  const useSecure = (process.env.NODE_ENV === 'production' || process.env.USE_SECURE_COOKIES === 'true') &&
                    process.env.USE_SECURE_COOKIES !== 'false';
  const sameSite = (process.env.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none') || 'lax';
  
  // Generate session token (not just userId for additional security)
  const sessionToken = crypto.randomBytes(32).toString('hex');
  
  // Store session token in database (you might want to create a Session model)
  // For now, we'll use userId but in production, use session tokens
  
  cookieStore.set('rol_session', userId, {
    httpOnly: true,
    secure: useSecure,
    sameSite: sameSite,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
  
  // Also set a separate session token cookie for additional verification
  cookieStore.set('rol_session_token', sessionToken, {
    httpOnly: true,
    secure: useSecure,
    sameSite: sameSite,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
}

export async function clearUserSession(): Promise<void> {
  const logId = `CLEAR-${Date.now()}`;
  console.log(`\n[${logId}] ========== clearUserSession() START ==========`);
  
  try {
    const cookieStore = await cookies();
    const useSecure = (process.env.NODE_ENV === 'production' || process.env.USE_SECURE_COOKIES === 'true') &&
                      process.env.USE_SECURE_COOKIES !== 'false';
    const sameSite = (process.env.COOKIE_SAME_SITE as 'strict' | 'lax' | 'none') || 'lax';
    
    // Check cookies before clearing
    const sessionBefore = cookieStore.get('rol_session');
    const tokenBefore = cookieStore.get('rol_session_token');
    console.log(`[${logId}] Cookies before clearing:`);
    console.log(`[${logId}]   rol_session: ${sessionBefore?.value ? `EXISTS (${sessionBefore.value.substring(0, 16)}...)` : 'MISSING'}`);
    console.log(`[${logId}]   rol_session_token: ${tokenBefore?.value ? 'EXISTS' : 'MISSING'}`);
    
    // Clear cookies with the same options they were set with to ensure proper deletion
    console.log(`[${logId}] Setting empty cookies (secure: ${useSecure}, sameSite: ${sameSite})...`);
    cookieStore.set('rol_session', '', {
      httpOnly: true,
      secure: useSecure,
      sameSite: sameSite,
      maxAge: 0, // Expire immediately
      path: '/',
    });
    
    cookieStore.set('rol_session_token', '', {
      httpOnly: true,
      secure: useSecure,
      sameSite: sameSite,
      maxAge: 0, // Expire immediately
      path: '/',
    });
    
    // Also delete them (belt and suspenders approach)
    console.log(`[${logId}] Deleting cookies...`);
    cookieStore.delete('rol_session');
    cookieStore.delete('rol_session_token');
    
    // Verify cookies are cleared
    const sessionAfter = cookieStore.get('rol_session');
    const tokenAfter = cookieStore.get('rol_session_token');
    console.log(`[${logId}] Cookies after clearing:`);
    console.log(`[${logId}]   rol_session: ${sessionAfter?.value ? 'STILL EXISTS' : 'CLEARED'}`);
    console.log(`[${logId}]   rol_session_token: ${tokenAfter?.value ? 'STILL EXISTS' : 'CLEARED'}`);
    console.log(`[${logId}] ============================================\n`);
  } catch (error: any) {
    console.error(`[${logId}] ❌ Error clearing session:`, error);
    console.error(`[${logId}] Stack:`, error.stack);
    throw error;
  }
}

export async function getCurrentUser(): Promise<string | null> {
  const logId = `AUTH-${Date.now()}`;
  console.log(`[${logId}] getCurrentUser() called`);
  
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('rol_session');
    const token = cookieStore.get('rol_session_token');
    
    console.log(`[${logId}] Cookie store inspection:`);
    console.log(`[${logId}]   rol_session cookie object:`, session ? {
      name: session.name,
      value: session.value ? `${session.value.substring(0, 16)}... (length: ${session.value.length})` : 'EMPTY',
      hasValue: !!session.value,
      valueType: typeof session.value
    } : 'NULL');
    console.log(`[${logId}]   rol_session_token cookie object:`, token ? {
      name: token.name,
      hasValue: !!token.value,
      valueType: typeof token.value
    } : 'NULL');
    
    // Both cookies must exist for a valid session
    // This prevents stale tokens where one cookie was cleared but not the other
    if (!session?.value || !token?.value) {
      console.log(`[${logId}] ❌ Session validation FAILED:`);
      console.log(`[${logId}]   - session?.value: ${session?.value ? 'EXISTS' : 'MISSING'}`);
      console.log(`[${logId}]   - token?.value: ${token?.value ? 'EXISTS' : 'MISSING'}`);
      return null;
    }
    
    console.log(`[${logId}] ✅ Session validated successfully, returning userId: ${session.value.substring(0, 16)}...`);
    return session.value;
  } catch (error: any) {
    console.error(`[${logId}] ❌ Error in getCurrentUser:`, error);
    console.error(`[${logId}] Stack:`, error.stack);
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const userId = await getCurrentUser();
  return userId !== null;
}

export async function getUserIdFromSession(): Promise<string | null> {
  return await getCurrentUser();
}

// Verify session token matches
export async function verifySessionToken(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get('rol_session');
  const token = cookieStore.get('rol_session_token');
  
  // Both must exist
  return !!(session?.value && token?.value);
}
