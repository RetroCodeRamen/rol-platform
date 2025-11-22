import { NextRequest } from 'next/server';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 60000); // Clean every minute

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
}

export function getClientIdentifier(req: NextRequest): string {
  // Use Cloudflare's CF-Connecting-IP header if available, otherwise fallback
  const cfIp = req.headers.get('cf-connecting-ip');
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = cfIp || forwardedFor?.split(',')[0] || realIp || 'unknown';
  
  // Also include user-agent for additional fingerprinting
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  return `${ip}:${userAgent.substring(0, 50)}`;
}

export function rateLimit(
  req: NextRequest,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  const identifier = getClientIdentifier(req);
  const now = Date.now();
  
  let entry = store[identifier];
  
  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired one
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    store[identifier] = entry;
  }
  
  entry.count++;
  
  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  
  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
  };
}

// Predefined rate limit configs
export const RATE_LIMITS = {
  // Strict limits for auth endpoints
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    message: 'Too many authentication attempts. Please try again later.',
  },
  REGISTER: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 registrations per hour
    message: 'Too many registration attempts. Please try again later.',
  },
  CHECK_USERNAME: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 checks per minute
    message: 'Too many username checks. Please slow down.',
  },
  GENERAL: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    message: 'Too many requests. Please slow down.',
  },
};

