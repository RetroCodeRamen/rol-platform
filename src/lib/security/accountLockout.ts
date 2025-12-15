import dbConnect from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';

interface FailedAttempt {
  count: number;
  lockoutUntil: number | null;
  lastAttempt: number;
}

const failedAttempts: Map<string, FailedAttempt> = new Map();

// Clean up old entries - use a single interval that can be cleared
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanupInterval() {
  // Only start if not already running
  if (cleanupInterval) return;
  
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    failedAttempts.forEach((attempt, key) => {
      if (attempt.lockoutUntil && attempt.lockoutUntil < now) {
        failedAttempts.delete(key);
      } else if (!attempt.lockoutUntil && now - attempt.lastAttempt > 30 * 60 * 1000) {
        // Clear attempts older than 30 minutes
        failedAttempts.delete(key);
      }
    });
    
    // Auto-stop interval if map is empty (save resources)
    if (failedAttempts.size === 0 && cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  }, 60000);
}

// Start cleanup on first use
if (typeof window === 'undefined') {
  // Server-side: start immediately
  startCleanupInterval();
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const INITIAL_BACKOFF = 60 * 1000; // 1 minute

export async function recordFailedLogin(username: string): Promise<void> {
  const key = username.toLowerCase();
  const now = Date.now();
  
  // Start cleanup interval if not running
  if (!cleanupInterval) {
    startCleanupInterval();
  }
  
  let attempt = failedAttempts.get(key);
  
  if (!attempt) {
    attempt = {
      count: 0,
      lockoutUntil: null,
      lastAttempt: now,
    };
  }
  
  attempt.count++;
  attempt.lastAttempt = now;
  
  // Progressive lockout: longer lockout with more attempts
  if (attempt.count >= MAX_FAILED_ATTEMPTS) {
    const backoffMultiplier = Math.min(attempt.count - MAX_FAILED_ATTEMPTS + 1, 5);
    attempt.lockoutUntil = now + (LOCKOUT_DURATION * backoffMultiplier);
  }
  
  failedAttempts.set(key, attempt);
  
  // Also update database for persistence
  try {
    await dbConnect();
    const user = await User.findOne({ username: key });
    if (user) {
      // Store failed attempts count in user document (optional)
      // This allows persistence across server restarts
    }
  } catch (error) {
    console.error('Failed to update failed login attempts in DB:', error);
  }
}

export async function clearFailedLogin(username: string): Promise<void> {
  const key = username.toLowerCase();
  failedAttempts.delete(key);
}

export async function isAccountLocked(username: string): Promise<{
  locked: boolean;
  lockoutUntil: number | null;
  remainingAttempts: number;
}> {
  const key = username.toLowerCase();
  const attempt = failedAttempts.get(key);
  const now = Date.now();
  
  if (!attempt) {
    return {
      locked: false,
      lockoutUntil: null,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
    };
  }
  
  if (attempt.lockoutUntil && attempt.lockoutUntil > now) {
    return {
      locked: true,
      lockoutUntil: attempt.lockoutUntil,
      remainingAttempts: 0,
    };
  }
  
  // Lockout expired, reset
  if (attempt.lockoutUntil && attempt.lockoutUntil <= now) {
    failedAttempts.delete(key);
    return {
      locked: false,
      lockoutUntil: null,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
    };
  }
  
  return {
    locked: false,
    lockoutUntil: null,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - attempt.count),
  };
}

