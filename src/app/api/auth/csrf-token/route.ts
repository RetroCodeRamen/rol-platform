import { NextRequest, NextResponse } from 'next/server';
import { setCSRFToken } from '@/lib/security/csrf';
import { addSecurityHeaders } from '@/lib/security/headers';

export async function GET(request: NextRequest) {
  try {
    // Detect iframe context
    const isIframe = request.headers.get('x-iframe-context') === 'true' || 
                     request.nextUrl.searchParams.get('iframe') === 'true';
    
    const token = await setCSRFToken(isIframe);
    
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

