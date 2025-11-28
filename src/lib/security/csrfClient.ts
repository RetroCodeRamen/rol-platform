// Client-side CSRF token management

let csrfToken: string | null = null;

// Detect if we're running in an iframe
function isInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch (e) {
    // Cross-origin iframe - can't access window.top, so we're definitely in an iframe
    return true;
  }
}

export async function getCSRFToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }

  try {
    const inIframe = isInIframe();
    console.log('[CSRF] Fetching CSRF token...', inIframe ? '(iframe context)' : '(normal context)');
    
    const headers: HeadersInit = {};
    if (inIframe) {
      headers['X-Iframe-Context'] = 'true';
    }
    
    const response = await fetch('/api/auth/csrf-token' + (inIframe ? '?iframe=true' : ''), {
      method: 'GET',
      credentials: 'include',
      headers,
    });

    if (!response.ok) {
      console.error('[CSRF] Failed to get CSRF token, status:', response.status);
      throw new Error(`Failed to get CSRF token: ${response.status}`);
    }

    const data = await response.json();
    console.log('[CSRF] CSRF token response:', data);
    
    if (data.success && data.token) {
      csrfToken = data.token;
      console.log('[CSRF] CSRF token obtained successfully');
      return data.token;
    }
    
    throw new Error('Invalid CSRF token response');
  } catch (error: any) {
    console.error('[CSRF] Failed to get CSRF token:', error);
    throw error;
  }
}

export function clearCSRFToken(): void {
  csrfToken = null;
}

