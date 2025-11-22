import { NextResponse } from 'next/server';
import { setCSRFToken } from '@/lib/security/csrf';
import { addSecurityHeaders } from '@/lib/security/headers';

export async function GET() {
  try {
    const token = await setCSRFToken();
    
    const response = NextResponse.json({
      success: true,
      token,
    });
    
    return addSecurityHeaders(response);
  } catch (error) {
    console.error('[AUTH] CSRF token error:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to generate security token' },
        { status: 500 }
      )
    );
  }
}

