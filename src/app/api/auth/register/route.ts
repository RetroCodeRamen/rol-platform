import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { addSecurityHeaders } from '@/lib/security/headers';
import { rateLimit, RATE_LIMITS } from '@/lib/security/rateLimit';
import { validateAndSanitize, registerSchema, sanitizeString, escapeRegex } from '@/lib/security/validation';
import { validateCSRFToken } from '@/lib/security/csrf';
import dbConnect from '@/lib/db/mongoose';
import User, { IUser } from '@/lib/db/models/User';

export async function POST(request: NextRequest) {
  const requestId = `REG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  try {
    console.log(`[${requestId}] ========== Registration Request START ==========`);
    console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
    
    // Rate limiting - stricter for registration
    const rateLimitResult = rateLimit(request, RATE_LIMITS.REGISTER);
    if (!rateLimitResult.allowed) {
      const duration = Date.now() - startTime;
      console.log(`[${requestId}] ❌ Rate limit exceeded (${duration}ms)`);
      const response = NextResponse.json(
        { success: false, error: RATE_LIMITS.REGISTER.message },
        { status: 429 }
      );
      response.headers.set('Retry-After', String(Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)));
      return addSecurityHeaders(response);
    }

    // CSRF protection
    const csrfValid = await validateCSRFToken(request);
    if (!csrfValid) {
      const duration = Date.now() - startTime;
      console.log(`[${requestId}] ❌ CSRF validation failed (${duration}ms)`);
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid security token. Please refresh the page and try again.' },
          { status: 403 }
        )
      );
    }

    const body = await request.json();
    console.log(`[${requestId}] Request body:`, { 
      username: body.username, 
      email: body.email,
      hasPassword: !!body.password,
      screenName: body.screenName 
    });
    
    // Validate and sanitize input
    const validation = validateAndSanitize(registerSchema, body);
    if (!validation.success) {
      const duration = Date.now() - startTime;
      console.log(`[${requestId}] ❌ Validation failed: ${validation.error} (${duration}ms)`);
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: validation.error },
          { status: 400 }
        )
      );
    }

    const { username, screenName, email, password } = validation.data;
    const finalScreenName = screenName || username;
    
    // Additional sanitization
    const sanitizedUsername = sanitizeString(username.toLowerCase());
    const sanitizedScreenName = sanitizeString(finalScreenName);
    // Auto-generate email as <lowercased_username>@ramn.online
    const sanitizedEmail = `${sanitizedUsername}@ramn.online`;

    console.log(`[${requestId}] Attempting database connection...`);
    try {
      await dbConnect();
      console.log(`[${requestId}] ✅ Database connected successfully`);
    } catch (dbError: any) {
      const duration = Date.now() - startTime;
      console.error(`[${requestId}] ❌ Database connection error (${duration}ms):`, dbError.message);
      console.error(`[${requestId}] Error stack:`, dbError.stack);
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Server error: Database connection failed. Please try again later.' },
          { status: 500 }
        )
      );
    }

    // Check if user already exists (use case-insensitive comparison)
    console.log(`[${requestId}] Checking for existing user...`);
    try {
      // Escape regex to prevent ReDoS attacks
      const escapedScreenName = escapeRegex(sanitizedScreenName);
      const existingUser = await User.findOne({
        $or: [
          { username: sanitizedUsername },
          { screenName: { $regex: new RegExp(`^${escapedScreenName}$`, 'i') } },
          { email: sanitizedEmail },
        ],
      });

      if (existingUser) {
        const duration = Date.now() - startTime;
        console.log(`[${requestId}] ❌ User already exists (${duration}ms)`);
        // Don't reveal which field is taken (security best practice)
        return addSecurityHeaders(
          NextResponse.json(
            { success: false, error: 'Username, screen name, or email already exists. Please try a different one.' },
            { status: 400 }
          )
        );
      }
      console.log(`[${requestId}] ✅ No existing user found`);
    } catch (queryError: any) {
      const duration = Date.now() - startTime;
      console.error(`[${requestId}] ❌ Query error (${duration}ms):`, queryError.message);
      console.error(`[${requestId}] Error stack:`, queryError.stack);
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Server error: Failed to check existing users. Please try again later.' },
          { status: 500 }
        )
      );
    }

    // Hash password with bcrypt (cost factor 12 for better security)
    console.log(`[${requestId}] Hashing password...`);
    let passwordHash: string;
    try {
      passwordHash = await bcrypt.hash(password, 12);
      console.log(`[${requestId}] ✅ Password hashed successfully`);
    } catch (hashError: any) {
      const duration = Date.now() - startTime;
      console.error(`[${requestId}] ❌ Password hashing error (${duration}ms):`, hashError.message);
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Server error: Failed to process password. Please try again later.' },
          { status: 500 }
        )
      );
    }
    
    // Create user
    console.log(`[${requestId}] Creating user in database...`);
    try {
      const user = await User.create({
        username: sanitizedUsername,
        screenName: sanitizedScreenName,
        email: sanitizedEmail,
        passwordHash,
        status: 'offline',
      }) as IUser;

      const duration = Date.now() - startTime;
      console.log(`[${requestId}] ✅ User created successfully (${duration}ms):`, { 
        id: String(user._id), 
        username: user.username,
        screenName: user.screenName,
        email: user.email
      });

      const response = NextResponse.json({
        success: true,
        user: {
          id: String(user._id),
          username: user.username,
          screenName: user.screenName,
          email: user.email,
        },
      });

      console.log(`[${requestId}] ========== Registration Request SUCCESS ==========\n`);
      return addSecurityHeaders(response);
    } catch (createError: any) {
      const duration = Date.now() - startTime;
      console.error(`[${requestId}] ❌ User creation error (${duration}ms):`, createError.message);
      console.error(`[${requestId}] Error code:`, createError.code);
      console.error(`[${requestId}] Error stack:`, createError.stack);
      
      // Handle duplicate key errors specifically
      if (createError.code === 11000) {
        console.error(`[${requestId}] Duplicate key error - user already exists`);
        return addSecurityHeaders(
          NextResponse.json(
            { success: false, error: 'Username, screen name, or email already exists. Please try a different one.' },
            { status: 400 }
          )
        );
      }
      
      // Return user-friendly error message
      const errorMessage = 'Server error: Failed to create user account. Please try again later.';
      
      console.log(`[${requestId}] ========== Registration Request FAILED ==========\n`);
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: errorMessage },
          { status: 500 }
        )
      );
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] ❌ Unexpected registration error (${duration}ms):`, error.message);
    console.error(`[${requestId}] Error stack:`, error.stack);
    
    // Return user-friendly error message
    const errorMessage = 'Server error: An unexpected error occurred. Please try again later.';
    
    console.log(`[${requestId}] ========== Registration Request FAILED ==========\n`);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      )
    );
  }
}
