import { z } from 'zod';

// Username validation: 3-20 chars, alphanumeric and underscore only
export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
  .refine((val) => !val.startsWith('_') && !val.endsWith('_'), {
    message: 'Username cannot start or end with underscore',
  });

// Screen name validation: 1-30 chars, more permissive
export const screenNameSchema = z
  .string()
  .min(1, 'Screen name must be at least 1 character')
  .max(30, 'Screen name must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_\s-]+$/, 'Screen name contains invalid characters');

// Email validation
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(100, 'Email address is too long')
  .toLowerCase()
  .trim();

// Password validation: Strong password requirements
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');

// Registration schema
// Note: email is optional because it's auto-generated as <username>@ramn.online
export const registerSchema = z.object({
  username: usernameSchema,
  screenName: screenNameSchema.optional(),
  email: emailSchema.optional(), // Optional - will be auto-generated if not provided
  password: passwordSchema,
});

// Login schema
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// Sanitize string inputs
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

// Validate and sanitize input
export function validateAndSanitize<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues.map((e) => e.message).join(', '),
      };
    }
    return { success: false, error: 'Validation failed' };
  }
}

