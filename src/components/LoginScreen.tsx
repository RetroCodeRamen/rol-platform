'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAppStore } from '@/state/store';
import { authService } from '@/services/AuthService';
import CreateAccountScreen from './CreateAccountScreen';

interface LoginScreenProps {
  initialError?: string | null;
}

type ConnectionType = 'dialup' | 'lan';

// Cookie helper functions
function getConnectionTypeCookie(): ConnectionType {
  if (typeof document === 'undefined') return 'dialup';
  const cookies = document.cookie.split(';');
  const connectionCookie = cookies.find(c => c.trim().startsWith('rol_connection_type='));
  if (connectionCookie) {
    const value = connectionCookie.split('=')[1];
    return (value === 'lan' || value === 'dialup') ? value : 'dialup';
  }
  return 'dialup';
}

function setConnectionTypeCookie(type: ConnectionType) {
  if (typeof document === 'undefined') return;
  // Set cookie to expire in 1 year
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `rol_connection_type=${type}; expires=${expires.toUTCString()}; path=/`;
}

export default function LoginScreen({ initialError }: LoginScreenProps = {}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [connectionType, setConnectionType] = useState<ConnectionType>(() => getConnectionTypeCookie());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const router = useRouter();
  const setCurrentUser = useAppStore((state) => state.setCurrentUser);


  useEffect(() => {
    if (initialError) {
      setError(initialError);
    }
    
    // Clear any stale session data on mount to prevent using old tokens
    const clearStaleSession = async () => {
      try {
        // Clear any pending login/register data first
        sessionStorage.removeItem('pendingLogin');
        sessionStorage.removeItem('pendingRegister');
        sessionStorage.removeItem('pendingAuth');
        sessionStorage.removeItem('welcomeWindowShown');
        
        // Clear CSRF token cache to force fresh token fetch
        try {
          const { clearCSRFToken } = await import('@/lib/security/csrfClient');
          clearCSRFToken();
          localStorage.removeItem('csrf_token');
        } catch (e) {
          // console.warn('[LoginScreen] Could not clear CSRF token:', e);
        }
        
        // Check if there's a stale session by attempting to get current user
        // BUT: Don't clear it if cookies are already empty (to avoid clearing fresh logins)
        const cookieHeader = document.cookie;
        const hasSessionCookies = cookieHeader.includes('rol_session=') && !cookieHeader.includes('rol_session=;');
        
        if (hasSessionCookies) {
          // console.log('[LoginScreen] Found session cookies, checking if stale...');
          const user = await authService.getCurrentUser();
          if (user) {
            // If we have a user but we're on the login screen, force logout to clear stale session
            // console.log('[LoginScreen] Found stale session, clearing...');
            try {
              await authService.logout();
              // Wait a bit for logout to complete
              await new Promise(resolve => setTimeout(resolve, 500));
            } catch (logoutError) {
              // console.warn('[LoginScreen] Error during logout:', logoutError);
              // Continue anyway - we've cleared sessionStorage
            }
          } else {
            // console.log('[LoginScreen] Session cookies exist but no valid user - cookies may be empty');
          }
        } else {
          // console.log('[LoginScreen] No session cookies found, skipping stale session check');
        }
        
        // Pre-fetch fresh CSRF token after clearing stale session
        try {
          const csrfResponse = await fetch('/api/auth/csrf-token', {
            method: 'GET',
            credentials: 'include',
          });
          if (csrfResponse.ok) {
            const csrfData = await csrfResponse.json();
            if (csrfData.success) {
              // console.log('[LoginScreen] Fresh CSRF token fetched successfully');
            }
          }
        } catch (csrfError) {
          // console.warn('[LoginScreen] Could not pre-fetch CSRF token:', csrfError);
        }
      } catch (error) {
        // Ignore errors - session might already be cleared
        // console.debug('[LoginScreen] Error clearing stale session:', error);
      }
    };
    
    clearStaleSession();
  }, [initialError]);

  const handleSignOn = async (e: React.FormEvent) => {
    const logId = `LOGIN-SCREEN-${Date.now()}`;
    // console.log(`\n\n\n[${logId}] ==========================================`);
    // console.log(`[${logId}] ========== STEP 1: LOGIN FORM SUBMITTED ==========`);
    // console.log(`[${logId}] ==========================================`);
    // console.log(`[${logId}] Timestamp: ${new Date().toISOString()}`);
    // console.log(`[${logId}] Username: "${username.trim()}"`);
    // console.log(`[${logId}] Password provided: ${password.trim() ? 'YES' : 'NO'}`);
    // console.log(`[${logId}] Connection type: "${connectionType}"`);
    
    e.preventDefault();
    
    // Validate inputs AFTER clicking connect
    // console.log(`[${logId}] STEP 1.1: Validating form inputs...`);
    if (!username.trim() && !password.trim()) {
      // console.log(`[${logId}] ❌ STEP 1.1 FAILED - missing both username and password`);
      setError('Please check your screen name and password');
      return;
    }
    if (!username.trim()) {
      // console.log(`[${logId}] ❌ STEP 1.1 FAILED - missing username`);
      setError('Please check your screen name');
      return;
    }
    if (!password.trim()) {
      // console.log(`[${logId}] ❌ STEP 1.1 FAILED - missing password`);
      setError('Please check your password');
      return;
    }
    // console.log(`[${logId}] ✅ STEP 1.1 PASSED - form inputs valid`);

    setError(null);
    setIsLoading(true);
    
    try {
      // console.log(`[${logId}] STEP 1.2: Fetching CSRF token...`);
      try {
        const csrfStartTime = Date.now();
        const response = await fetch('/api/auth/csrf-token', {
          method: 'GET',
          credentials: 'include',
        });
        const csrfEndTime = Date.now();
        // console.log(`[${logId}] CSRF fetch took ${csrfEndTime - csrfStartTime}ms`);
        // console.log(`[${logId}] CSRF response status: ${response.status}`);
        
        if (!response.ok) {
          throw new Error(`Failed to get security token: ${response.status}`);
        }
        const data = await response.json();
        // console.log(`[${logId}] CSRF response data:`, { success: data.success, hasToken: !!data.token });
        
        if (!data.success || !data.token) {
          throw new Error('Invalid security token response');
        }
        // console.log(`[${logId}] ✅ STEP 1.2 PASSED - CSRF token obtained`);
      } catch (csrfError: any) {
        // console.error(`[${logId}] ❌ STEP 1.2 FAILED - CSRF token error:`, csrfError);
        setError('Failed to initialize security. Please refresh the page and try again.');
        setIsLoading(false);
        return;
      }
      
      // console.log(`[${logId}] STEP 1.3: Preparing pending login data...`);
      const pendingLoginData = { 
        username: username.trim(), 
        password: password.trim(),
        connectionType,
        isNewUser: false
      };
      // console.log(`[${logId}] Pending login data:`, {
      //   username: pendingLoginData.username,
      //   connectionType: pendingLoginData.connectionType,
      //   isNewUser: pendingLoginData.isNewUser,
      //   hasPassword: !!pendingLoginData.password
      // });
      
      // console.log(`[${logId}] STEP 1.4: Storing in sessionStorage...`);
      const storageStartTime = Date.now();
      sessionStorage.setItem('pendingLogin', JSON.stringify(pendingLoginData));
      const storageEndTime = Date.now();
      // console.log(`[${logId}] Storage operation took ${storageEndTime - storageStartTime}ms`);
      
      // console.log(`[${logId}] STEP 1.5: Verifying storage...`);
      const stored = sessionStorage.getItem('pendingLogin');
      // console.log(`[${logId}] Stored check result: ${stored ? 'EXISTS' : 'MISSING'}`);
      if (stored) {
        // console.log(`[${logId}] Stored data length: ${stored.length} characters`);
        // console.log(`[${logId}] Stored data preview: ${stored.substring(0, 150)}...`);
        try {
          const parsed = JSON.parse(stored);
          // console.log(`[${logId}] Parsed verification:`, {
          //   username: parsed.username,
          //   connectionType: parsed.connectionType,
          //   isNewUser: parsed.isNewUser
          // });
        } catch (parseErr) {
          // console.error(`[${logId}] ❌ Failed to parse stored data:`, parseErr);
        }
      } else {
        // console.error(`[${logId}] ❌ CRITICAL: Storage verification FAILED - data not found!`);
        setError('Failed to store login data. Please try again.');
        setIsLoading(false);
        return;
      }
      
      // console.log(`[${logId}] STEP 1.6: Final check before navigation...`);
      const finalCheck = sessionStorage.getItem('pendingLogin');
      if (!finalCheck) {
        // console.error(`[${logId}] ❌ CRITICAL: Final check FAILED - pendingLogin missing!`);
        setError('Failed to store login data. Please try again.');
        setIsLoading(false);
        return;
      }
      // console.log(`[${logId}] ✅ STEP 1.6 PASSED - final check successful`);
      
      // console.log(`[${logId}] STEP 1.7: Navigating to /connect...`);
      // console.log(`[${logId}] ==========================================\n\n\n`);
      
      // Navigate to connect screen - it will handle the login
      router.push('/connect');
    } catch (err: any) {
      // console.error(`[${logId}] ❌ FATAL ERROR in handleSignOn:`, err);
      // console.error(`[${logId}] Error message: ${err.message}`);
      // console.error(`[${logId}] Stack:`, err.stack);
      setError('Failed to start connection. Please try again.');
      setIsLoading(false);
    }
  };

  if (showCreateAccount) {
    return <CreateAccountScreen onBack={() => setShowCreateAccount(false)} connectionType={connectionType} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-900 to-blue-700">
      <div className="bg-white p-8 rounded-lg shadow-2xl border-4 border-gray-300 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-2">
            <Image
              src="/images/logo-ramen-online.png"
              alt="Ramen Online"
              width={200}
              height={80}
              className="object-contain rounded-lg"
              style={{ borderRadius: '12px' }}
              priority
            />
          </div>
          <p className="text-gray-600 text-sm">Ramen Online</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border-2 border-red-400 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSignOn} className="space-y-4">
          <div>
            <label htmlFor="connectionType" className="block text-sm font-medium text-gray-700 mb-1">
              Connection Type
            </label>
            <select
              id="connectionType"
              value={connectionType}
              onChange={(e) => {
                const newType = e.target.value as ConnectionType;
                setConnectionType(newType);
                setConnectionTypeCookie(newType);
              }}
              className="w-full px-3 py-2 border-2 border-gray-400 rounded bg-white text-gray-900 focus:outline-none focus:border-blue-500"
              disabled={isLoading}
            >
              <option value="dialup">Dial-up</option>
              <option value="lan">LAN</option>
            </select>
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Screen Name
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              className="w-full px-3 py-2 border-2 border-gray-400 rounded bg-white text-gray-900 focus:outline-none focus:border-blue-500"
              placeholder="Enter your screen name"
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              className="w-full px-3 py-2 border-2 border-gray-400 rounded bg-white text-gray-900 focus:outline-none focus:border-blue-500"
              placeholder="Enter your password"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-b from-blue-500 to-blue-600 text-white font-bold rounded border-2 border-blue-700 hover:from-blue-600 hover:to-blue-700 active:from-blue-700 active:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            title={isLoading ? 'Connecting...' : 'Click to connect'}
          >
            {isLoading ? 'Connecting...' : 'Connect'}
          </button>
        </form>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowCreateAccount(true)}
            className="w-full py-2 bg-gradient-to-b from-green-500 to-green-600 text-white font-semibold rounded border-2 border-green-700 hover:from-green-600 hover:to-green-700 active:from-green-700 active:to-green-800 shadow-lg"
          >
            Create Account
          </button>
        </div>

        <div className="mt-6 text-center text-xs text-gray-500">
          <p>Version 5.0 RamenDesk Edition</p>
          <p className="mt-2">© 2024 RetroCodeRamen</p>
        </div>
      </div>
    </div>
  );
}
