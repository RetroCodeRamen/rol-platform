import { cookies } from 'next/headers';
import crypto from 'crypto';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'rol_csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

export async function generateCSRFToken(): Promise<string> {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

export async function setCSRFToken(): Promise<string> {
  const token = await generateCSRFToken();
  const cookieStore = await cookies();
  
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by JavaScript for client-side requests
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });
  
  return token;
}

export async function validateCSRFToken(request: Request): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
    // Try both header name variations (case-insensitive)
    const headerToken = request.headers.get(CSRF_HEADER_NAME) || 
                       request.headers.get('X-CSRF-Token') ||
                       request.headers.get('x-csrf-token');
    
    console.log('[CSRF] Validating token - cookie exists:', !!cookieToken, 'header exists:', !!headerToken);
    
    if (!cookieToken || !headerToken) {
      console.log('[CSRF] Missing token - cookie:', !!cookieToken, 'header:', !!headerToken);
      return false;
    }
    
    // Ensure tokens are same length before comparison
    if (cookieToken.length !== headerToken.length) {
      console.log('[CSRF] Token length mismatch - cookie:', cookieToken.length, 'header:', headerToken.length);
      return false;
    }
    
    // Use constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(headerToken)
    );
    
    console.log('[CSRF] Token validation result:', isValid);
    return isValid;
  } catch (error) {
    console.error('[CSRF] Token validation error:', error);
    // If comparison fails for any reason, reject
    return false;
  }
}

export async function getCSRFToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_COOKIE_NAME)?.value || null;
}
