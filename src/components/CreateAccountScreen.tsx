'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/state/store';
import { authService } from '@/services/AuthService';

type ConnectionType = 'dialup' | 'lan';

// Cookie helper functions (same as LoginScreen)
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

interface CreateAccountScreenProps {
  onBack: () => void;
  connectionType: ConnectionType;
}

export default function CreateAccountScreen({ onBack, connectionType: propConnectionType }: CreateAccountScreenProps) {
  // Use cookie value if available, otherwise use prop
  const [connectionType, setConnectionTypeState] = useState<ConnectionType>(() => {
    const cookieType = getConnectionTypeCookie();
    return cookieType !== 'dialup' ? cookieType : propConnectionType;
  });
  
  const setConnectionType = (type: ConnectionType) => {
    setConnectionTypeState(type);
    setConnectionTypeCookie(type);
  };
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [screenName, setScreenName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  const router = useRouter();
  const setCurrentUser = useAppStore((state) => state.setCurrentUser);

  const handleCheckUsername = async () => {
    if (!username.trim() || username.length < 3) {
      setUsernameAvailable(false);
      setError('Username must be at least 3 characters');
      return;
    }

    setCheckingUsername(true);
    setError(null);
    try {
      const available = await authService.checkUsernameAvailable(username);
      setUsernameAvailable(available);
      if (!available) {
        setError('This screen name is already taken or invalid');
      } else {
        setError(null);
      }
    } catch (err: any) {
      console.error('Username check error:', err);
      setUsernameAvailable(false);
      setError(err.message || 'Could not check username availability');
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!username.trim() || username.length < 3) {
      setError('Screen name must be at least 3 characters');
      return;
    }
    if (!password.trim() || password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    // Strong password validation
    if (!/[a-z]/.test(password)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number');
      return;
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
      setError('Password must contain at least one special character');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    
    // Store account data and connection type for ConnectScreen to use
    sessionStorage.setItem('pendingLogin', JSON.stringify({
      username,
      password,
      email,
      screenName: screenName || username,
      connectionType,
      isNewUser: true
    }));
    
    // Navigate to connect screen - it will handle the account creation and connection
    router.push('/connect');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-900 to-blue-700">
      <div className="bg-white p-8 rounded-lg shadow-2xl border-4 border-gray-300 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">Create Account</h1>
          <p className="text-gray-600 text-sm">Join Ramen Online</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border-2 border-red-400 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Screen Name *
            </label>
            <div className="flex gap-2">
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setUsernameAvailable(null);
                  setError(null);
                }}
                onBlur={handleCheckUsername}
                className="flex-1 px-3 py-2 border-2 border-gray-400 rounded bg-white text-gray-900 focus:outline-none focus:border-blue-500"
                placeholder="Choose a screen name"
                disabled={isLoading}
                autoFocus
                minLength={3}
              />
              {checkingUsername && (
                <div className="flex items-center px-2 text-xs text-gray-500">Checking...</div>
              )}
              {usernameAvailable === true && (
                <div className="flex items-center px-2 text-xs text-green-600">✓ Available</div>
              )}
              {usernameAvailable === false && username.length >= 3 && (
                <div className="flex items-center px-2 text-xs text-red-600">✗ Taken</div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">3-20 characters, letters, numbers, and underscores only</p>
          </div>

          <div>
            <label htmlFor="screenName" className="block text-sm font-medium text-gray-700 mb-1">
              Display Name (optional)
            </label>
            <input
              id="screenName"
              type="text"
              value={screenName}
              onChange={(e) => setScreenName(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-400 rounded bg-white text-gray-900 focus:outline-none focus:border-blue-500"
              placeholder="How the system will address you (e.g., your real name)"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">This is private - only you will see this name in greetings</p>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-400 rounded bg-white text-gray-900 focus:outline-none focus:border-blue-500"
              placeholder="your@email.com"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password *
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-400 rounded bg-white text-gray-900 focus:outline-none focus:border-blue-500"
              placeholder="At least 8 characters with uppercase, lowercase, number, and special character"
              disabled={isLoading}
              minLength={8}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password *
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-400 rounded bg-white text-gray-900 focus:outline-none focus:border-blue-500"
              placeholder="Re-enter your password"
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBack}
              disabled={isLoading}
              className="flex-1 py-2 bg-gray-300 text-gray-800 font-semibold rounded border-2 border-gray-400 hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isLoading || !username.trim() || !password.trim() || !email.trim()}
              className="flex-1 py-2 bg-gradient-to-b from-blue-500 to-blue-600 text-white font-bold rounded border-2 border-blue-700 hover:from-blue-600 hover:to-blue-700 active:from-blue-700 active:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {isLoading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-xs text-gray-500">
          <p>By creating an account, you agree to ROL&apos;s Terms of Service</p>
        </div>
      </div>
    </div>
  );
}
