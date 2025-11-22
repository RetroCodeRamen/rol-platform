import { NextResponse } from 'next/server';

export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Allow iframe embedding - can be controlled via environment variable
  const allowIframe = process.env.ALLOW_IFRAME !== 'false'; // Default to true
  
  // Security headers for Cloudflare + Next.js
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // Allow framing - removed X-Frame-Options to allow iframe embedding
  // (X-Frame-Options is deprecated in favor of CSP frame-ancestors)
  if (!allowIframe) {
    response.headers.set('X-Frame-Options', 'DENY');
  }
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content Security Policy (adjust based on your needs)
  const frameAncestors = allowIframe ? '*' : "'none'";
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Adjust for production
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss:", // Allow WebSocket connections for Socket.io
    `frame-ancestors ${frameAncestors}`,
  ].join('; ');
  
  response.headers.set('Content-Security-Policy', csp);
  
  // Strict Transport Security (HSTS) - Cloudflare will handle this, but good to have
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  return response;
}

