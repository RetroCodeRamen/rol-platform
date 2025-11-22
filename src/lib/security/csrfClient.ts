// Client-side CSRF token management

let csrfToken: string | null = null;

export async function getCSRFToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }

  try {
    console.log('[CSRF] Fetching CSRF token...');
    const response = await fetch('/api/auth/csrf-token', {
      method: 'GET',
      credentials: 'include',
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

