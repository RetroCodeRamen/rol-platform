import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Check if this is the default_index.html page (needed for browser component)
  const isDefaultIndex = request.nextUrl.pathname === '/default_index.html';

  // Security headers - Cloudflare compatible
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // Allow framing for default_index.html (needed for browser component)
  response.headers.set('X-Frame-Options', isDefaultIndex ? 'SAMEORIGIN' : 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Content Security Policy
  // Allow frame-ancestors for default_index.html so it can be loaded in iframe
  const frameAncestors = isDefaultIndex ? "'self'" : "'none'";
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Adjust for production - remove unsafe-*
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    `frame-ancestors ${frameAncestors}`,
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  // Strict Transport Security (Cloudflare will handle this, but good to have)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Cloudflare-specific headers
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    // Cloudflare is handling the connection
    response.headers.set('X-Forwarded-For', cfConnectingIp);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

