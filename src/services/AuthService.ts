// AuthService interface - designed to be swappable with real API backend
import { getCSRFToken } from '@/lib/security/csrfClient';

export interface IUser {
  id: string;
  username: string;
  email: string;
  screenName?: string;
  status?: 'online' | 'away' | 'busy' | 'offline';
  createdAt?: string;
}

export interface IAuthService {
  login(username: string, password: string): Promise<IUser>;
  register(username: string, password: string, email: string, screenName?: string): Promise<IUser>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<IUser | null>;
  checkUsernameAvailable(username: string): Promise<boolean>;
}

const API_BASE = '/api/auth';

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

async function fetchWithCSRF(url: string, options: RequestInit = {}): Promise<Response> {
  const fetchId = `FETCH-${Date.now()}`;
  const inIframe = isInIframe();
  // console.log(`\n[${fetchId}] ========== fetchWithCSRF START ==========`);
  // console.log(`[${fetchId}] URL: ${url}`);
  // console.log(`[${fetchId}] Method: ${options.method || 'GET'}`);
  // console.log(`[${fetchId}] Iframe context: ${inIframe}`);
  
  try {
    // console.log(`[${fetchId}] Fetching CSRF token...`);
    const csrfToken = await getCSRFToken();
    // console.log(`[${fetchId}] CSRF token obtained: ${csrfToken ? `Yes (${csrfToken.substring(0, 16)}...)` : 'No'}`);
    
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
      // console.log(`[${fetchId}] CSRF token added to headers`);
    }
    // Add iframe context header
    if (inIframe) {
      headers.set('X-Iframe-Context', 'true');
    }
    
    // Add iframe query parameter if needed
    const urlWithIframe = inIframe && !url.includes('iframe=true') 
      ? `${url}${url.includes('?') ? '&' : '?'}iframe=true`
      : url;
    
    // console.log(`[${fetchId}] Making fetch request with credentials: include...`);
    const response = await fetch(urlWithIframe, {
      ...options,
      headers,
      credentials: 'include', // Important for cookies
    });
    
    // console.log(`[${fetchId}] ✅ Fetch completed: ${response.status} ${response.statusText}`);
    // console.log(`[${fetchId}] =========================================\n`);
    return response;
  } catch (csrfError: any) {
    // console.error(`[${fetchId}] ❌ CSRF token error:`, csrfError);
    // console.error(`[${fetchId}] Attempting request without CSRF token...`);
    // Still try the request - CSRF might fail but request could still work
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
    // console.log(`[${fetchId}] Fetch completed without CSRF: ${response.status}`);
    // console.log(`[${fetchId}] =========================================\n`);
    return response;
  }
}

export class RestAuthService implements IAuthService {
  private currentUser: IUser | null = null;

  async checkUsernameAvailable(username: string): Promise<boolean> {
    try {
      // console.log('[AuthService] Checking username:', username);
      const response = await fetch(`${API_BASE}/check-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
        credentials: 'include',
      });

      if (!response.ok) {
        // console.error('[AuthService] Username check failed with status:', response.status);
        // If request fails, assume available (fail open)
        return true;
      }

      const data = await response.json();
      // console.log('[AuthService] Username check response:', data);
      
      // Return true only if the check was successful AND username is available
      if (data.success === true && data.available === true) {
        // console.log('[AuthService] Username is available');
        return true;
      }
      
      // If validation failed or username is taken, return false
      // console.log('[AuthService] Username is not available:', data);
      return false;
    } catch (error) {
      // console.error('[AuthService] Failed to check username availability:', error);
      // Fail open - assume available if we can't check
      return true;
    }
  }

  async register(
    username: string,
    password: string,
    email: string,
    screenName?: string
  ): Promise<IUser> {
    const logId = `AUTHSVC-REGISTER-${Date.now()}`;
    console.log(`[${logId}] ========== Registration START ==========`);
    console.log(`[${logId}] Username: ${username}`);
    console.log(`[${logId}] Email: ${email}`);
    console.log(`[${logId}] Screen name: ${screenName || username}`);
    
    try {
      const response = await fetchWithCSRF(`${API_BASE}/register`, {
        method: 'POST',
        body: JSON.stringify({
          username,
          password,
          email,
          screenName: screenName || username,
        }),
      });

      console.log(`[${logId}] Response status: ${response.status} ${response.statusText}`);

      // Check if response is OK before parsing JSON
      if (!response.ok) {
        let errorMessage = 'Failed to create account';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error(`[${logId}] ❌ Registration failed: ${errorMessage}`);
        } catch (parseError) {
          // If JSON parsing fails, use status text
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
          console.error(`[${logId}] ❌ Registration failed - could not parse error response`);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log(`[${logId}] Response data:`, { success: data.success, hasUser: !!data.user });

      if (!data.success) {
        const errorMessage = data.error || 'Failed to create account';
        console.error(`[${logId}] ❌ Registration failed: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      console.log(`[${logId}] ✅ Registration successful, attempting auto-login...`);
      // After registration, auto-login
      try {
        const user = await this.login(username, password);
        console.log(`[${logId}] ✅ Auto-login successful`);
        console.log(`[${logId}] =========================================\n`);
        return user;
      } catch (loginError: any) {
        console.error(`[${logId}] ❌ Auto-login failed after registration:`, loginError.message);
        // User was created but login failed - this is a critical error
        throw new Error(`Account created but login failed: ${loginError.message}. Please try logging in manually.`);
      }
    } catch (error: any) {
      console.error(`[${logId}] ❌ Registration error:`, error.message);
      console.error(`[${logId}] Stack:`, error.stack);
      console.log(`[${logId}] =========================================\n`);
      throw error;
    }
  }

  async login(username: string, password: string): Promise<IUser> {
    const logId = `AUTHSVC-LOGIN-${Date.now()}`;
    // console.log(`\n[${logId}] ========== AuthService.login() START ==========`);
    // console.log(`[${logId}] Username: ${username}`);
    // console.log(`[${logId}] API endpoint: ${API_BASE}/login`);
    
    try {
      // console.log(`[${logId}] Calling fetchWithCSRF...`);
      const response = await fetchWithCSRF(`${API_BASE}/login`, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      // console.log(`[${logId}] ✅ Fetch completed`);
      // console.log(`[${logId}] Response status: ${response.status} ${response.statusText}`);
      // console.log(`[${logId}] Response headers:`);
      const setCookieHeader = response.headers.get('set-cookie');
      // console.log(`[${logId}]   Set-Cookie: ${setCookieHeader ? setCookieHeader.substring(0, 300) + '...' : 'NONE'}`);
      // console.log(`[${logId}]   Content-Type: ${response.headers.get('content-type')}`);
      
      // Check if response is ok before parsing JSON
      if (!response.ok) {
        const errorText = await response.text();
        // console.error(`[${logId}] ❌ Response not OK: ${response.status}`);
        // console.error(`[${logId}] Error body: ${errorText.substring(0, 200)}`);
        throw new Error(`Login failed: ${response.status} ${response.statusText}`);
      }

          const data = await response.json();
          // console.log(`[${logId}] Response JSON parsed:`, { 
          //   success: data.success, 
          //   userId: data.user?.id,
          //   username: data.user?.username,
          //   error: data.error 
          // });

      if (!data.success) {
        // console.error(`[${logId}] ❌ Login failed: ${data.error}`);
        // Use the error message from the API, or default to user-friendly message
        const errorMsg = data.error || 'Invalid username or password';
        throw new Error(errorMsg);
      }

      const user: IUser = {
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        screenName: data.user.screenName,
        status: data.user.status,
        createdAt: data.user.createdAt,
      };

      this.currentUser = user;
      // console.log(`[${logId}] ✅ User stored in memory: ${user.username}`);
      
      // Wait longer for cookies to be set and propagated in browser
      // console.log(`[${logId}] Waiting 500ms for cookies to propagate in browser...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify cookies are now available
      // console.log(`[${logId}] Checking if cookies are available...`);
      const cookieCheck = document.cookie;
      const hasSessionCookie = cookieCheck.includes('rol_session=') && !cookieCheck.includes('rol_session=;');
      // console.log(`[${logId}] Cookie check result: ${hasSessionCookie ? 'COOKIES FOUND' : 'NO COOKIES'}`);
      if (cookieCheck) {
        // console.log(`[${logId}] Document cookies: ${cookieCheck.substring(0, 200)}...`);
      }
      
      // console.log(`[${logId}] ================================================\n`);
      return user;
    } catch (error: any) {
      // console.error(`[${logId}] ❌ ERROR in login:`);
      // console.error(`[${logId}] Error message: ${error.message}`);
      // console.error(`[${logId}] Error stack: ${error.stack}`);
      // console.error(`[${logId}] ================================================\n`);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await fetchWithCSRF(`${API_BASE}/logout`, {
        method: 'POST',
      });
    } catch (error) {
      // console.error('[AuthService] Logout API error:', error);
      // Even if API call fails, clear client-side state
    } finally {
      // Always clear client-side state regardless of API success/failure
      this.currentUser = null;
      
      // Clear all session storage items
      try {
        sessionStorage.removeItem('pendingLogin');
        sessionStorage.removeItem('pendingRegister');
        sessionStorage.removeItem('pendingAuth');
        sessionStorage.removeItem('welcomeWindowShown');
        // Clear any other session-related items
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
          if (key.startsWith('rol_') || key.startsWith('pending')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (e) {
        // console.warn('[AuthService] Could not clear sessionStorage:', e);
      }
      
      // Clear CSRF token - both from localStorage and the in-memory cache
      try {
        localStorage.removeItem('csrf_token');
        // Also clear the CSRF client cache
        const { clearCSRFToken } = await import('@/lib/security/csrfClient');
        clearCSRFToken();
      } catch (e) {
        // console.warn('[AuthService] Could not clear CSRF token:', e);
      }
    }
  }

  async getCurrentUser(): Promise<IUser | null> {
    const logId = `AUTHSVC-${Date.now()}`;
    // console.log(`\n[${logId}] ========== AuthService.getCurrentUser() START ==========`);
    
    // If we already have the user in memory, return it
    if (this.currentUser) {
      // console.log(`[${logId}] ✅ Returning cached user: ${this.currentUser.username}`);
      // console.log(`[${logId}] ================================================\n`);
      return this.currentUser;
    }

    // console.log(`[${logId}] No cached user, fetching from server...`);
    // console.log(`[${logId}] Request URL: ${API_BASE}/current-user`);
    // console.log(`[${logId}] Request options: { method: 'GET', credentials: 'include' }`);

    // Otherwise, fetch from server
    try {
      const response = await fetch(`${API_BASE}/current-user`, {
        method: 'GET',
        credentials: 'include',
      });

      // console.log(`[${logId}] Response status: ${response.status} ${response.statusText}`);
      // console.log(`[${logId}] Response headers:`, {
      //   'content-type': response.headers.get('content-type'),
      //   'set-cookie': response.headers.get('set-cookie') ? 'present' : 'none'
      // });

      const data = await response.json();
      // console.log(`[${logId}] Response data:`, { success: data.success, hasUser: !!data.user });

      if (data.success && data.user) {
        const user: IUser = {
          id: data.user.id,
          username: data.user.username,
          email: data.user.email,
          screenName: data.user.screenName,
          status: data.user.status,
          createdAt: data.user.createdAt,
        };
        this.currentUser = user;
        // console.log(`[${logId}] ✅ User fetched and cached: ${user.username}`);
        // console.log(`[${logId}] ================================================\n`);
        return user;
      }

      // console.log(`[${logId}] ❌ No user in response (success: ${data.success})`);
      // console.log(`[${logId}] ================================================\n`);
      return null;
    } catch (error: any) {
      // console.error(`[${logId}] ❌ ERROR fetching current user:`);
      // console.error(`[${logId}] Error:`, error);
      // console.error(`[${logId}] Stack:`, error.stack);
      // console.error(`[${logId}] ================================================\n`);
      return null;
    }
  }
}

// Export singleton instance
export const authService: IAuthService = new RestAuthService();
