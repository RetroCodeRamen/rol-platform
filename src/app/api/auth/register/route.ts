import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { addSecurityHeaders } from '@/lib/security/headers';
import { rateLimit, RATE_LIMITS } from '@/lib/security/rateLimit';
import { validateAndSanitize, registerSchema, sanitizeString } from '@/lib/security/validation';
import { validateCSRFToken } from '@/lib/security/csrf';
import dbConnect from '@/lib/db/mongoose';
import User, { IUser } from '@/lib/db/models/User';

export async function POST(request: NextRequest) {
  try {
    console.log('[AUTH] Registration request received');
    
    // Rate limiting - stricter for registration
    const rateLimitResult = rateLimit(request, RATE_LIMITS.REGISTER);
    if (!rateLimitResult.allowed) {
      console.log('[AUTH] Rate limit exceeded');
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
      console.log('[AUTH] CSRF validation failed');
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid security token. Please refresh the page and try again.' },
          { status: 403 }
        )
      );
    }

    const body = await request.json();
    console.log('[AUTH] Registration body received:', { 
      username: body.username, 
      email: body.email,
      hasPassword: !!body.password,
      screenName: body.screenName 
    });
    
    // Validate and sanitize input
    const validation = validateAndSanitize(registerSchema, body);
    if (!validation.success) {
      console.log('[AUTH] Validation failed:', validation.error);
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

    console.log('[AUTH] Attempting database connection...');
    try {
      await dbConnect();
      console.log('[AUTH] Database connected successfully');
    } catch (dbError: any) {
      console.error('[AUTH] Database connection error:', dbError);
      console.error('[AUTH] Error message:', dbError.message);
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Database connection failed. Please check your MongoDB configuration.' },
          { status: 500 }
        )
      );
    }

    // Check if user already exists (use case-insensitive comparison)
    console.log('[AUTH] Checking for existing user...');
    try {
      const existingUser = await User.findOne({
        $or: [
          { username: sanitizedUsername },
          { screenName: { $regex: new RegExp(`^${sanitizedScreenName}$`, 'i') } },
          { email: sanitizedEmail },
        ],
      });

      if (existingUser) {
        console.log('[AUTH] User already exists');
        // Don't reveal which field is taken (security best practice)
        return addSecurityHeaders(
          NextResponse.json(
            { success: false, error: 'Username, screen name, or email already exists' },
            { status: 400 }
          )
        );
      }
    } catch (queryError: any) {
      console.error('[AUTH] Query error:', queryError);
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Failed to check existing users' },
          { status: 500 }
        )
      );
    }

    // Hash password with bcrypt (cost factor 12 for better security)
    console.log('[AUTH] Hashing password...');
    let passwordHash: string;
    try {
      passwordHash = await bcrypt.hash(password, 12);
      console.log('[AUTH] Password hashed successfully');
    } catch (hashError: any) {
      console.error('[AUTH] Password hashing error:', hashError);
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Failed to process password' },
          { status: 500 }
        )
      );
    }
    
    // Create user
    console.log('[AUTH] Creating user...');
    try {
      const user = await User.create({
        username: sanitizedUsername,
        screenName: sanitizedScreenName,
        email: sanitizedEmail,
        passwordHash,
        status: 'offline',
      }) as IUser;

      console.log('[AUTH] User created successfully:', { id: user._id, username: user.username });

      const response = NextResponse.json({
        success: true,
        user: {
          id: String(user._id),
          username: user.username,
          screenName: user.screenName,
          email: user.email,
        },
      });

      return addSecurityHeaders(response);
    } catch (createError: any) {
      console.error('[AUTH] User creation error:', createError);
      console.error('[AUTH] Error code:', createError.code);
      console.error('[AUTH] Error message:', createError.message);
      
      // Handle duplicate key errors specifically
      if (createError.code === 11000) {
        return addSecurityHeaders(
          NextResponse.json(
            { success: false, error: 'Username, screen name, or email already exists' },
            { status: 400 }
          )
        );
      }
      
      // Return more specific error for debugging (in development)
      const errorMessage = process.env.NODE_ENV === 'development' 
        ? `Failed to create user: ${createError.message}`
        : 'Failed to register user';
      
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: errorMessage },
          { status: 500 }
        )
      );
    }
  } catch (error: any) {
    console.error('[AUTH] Registration error:', error);
    console.error('[AUTH] Error stack:', error.stack);
    
    // Return more specific error for debugging
    const errorMessage = process.env.NODE_ENV === 'development'
      ? `Registration failed: ${error.message}`
      : 'Failed to register user';
    
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      )
    );
  }
}
