'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SoundService } from '@/services/SoundService';
import { authService } from '@/services/AuthService';
import { useAppStore } from '@/state/store';

// Module-level state to prevent React StrictMode double-mount interference
// These persist across component remounts
let isProcessingLogin = false;
let globalIntervals: { step?: NodeJS.Timeout; progress?: NodeJS.Timeout; timeout?: NodeJS.Timeout } = {};
let globalAudioRef: HTMLAudioElement | null = null;

type ConnectionType = 'dialup' | 'lan';

interface PendingLogin {
  username: string;
  password: string;
  connectionType: ConnectionType;
  isNewUser: boolean;
  email?: string;
  screenName?: string;
}

// Dial-up connection steps
const DIALUP_STEPS = [
  'Dialing...',
  'Connecting to Ramen Online...',
  'Negotiating connection...',
  'Verifying user...',
  'Almost there...',
  'Welcome!',
];

const DIALUP_SOUND_DURATION_MS = 28000; // 28 seconds
const VERIFY_USER_STEP_INDEX = 3; // Index of "Verifying user..." step
const STEP_DURATION_MS = DIALUP_SOUND_DURATION_MS / DIALUP_STEPS.length; // ~4.7 seconds per step
const SESSION_VERIFY_DELAY_MS = 500; // Small delay to allow cookies to be set

export default function ConnectScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [connectionLog, setConnectionLog] = useState<string[]>([]);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [displayError, setDisplayError] = useState<string | null>(null);
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const setCurrentUser = useAppStore((state) => state.setCurrentUser);
  const loginAttemptedRef = useRef(false);
  const loginSuccessRef = useRef(false);
  const loginErrorRef = useRef<string | null>(null);
  const intervalsRef = useRef<{ step?: NodeJS.Timeout; progress?: NodeJS.Timeout; timeout?: NodeJS.Timeout }>({});
  const isProcessingRef = useRef(false);

  // Handle navigation errors in useEffect (React 19 compliance)
  useEffect(() => {
    if (navigationError) {
      router.push('/?error=' + encodeURIComponent(navigationError));
    }
  }, [navigationError, router]);

  useEffect(() => {
    const mountId = `MOUNT-${Date.now()}`;
    // console.log(`\n\n\n[${mountId}] ==========================================`);
    // console.log(`[${mountId}] ========== STEP 2: CONNECTSCREEN MOUNTED ==========`);
    // console.log(`[${mountId}] ==========================================`);
    // console.log(`[${mountId}] Timestamp: ${new Date().toISOString()}`);
    // console.log(`[${mountId}] URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}`);
    
    // Check module-level flag FIRST (before any state resets) to prevent React StrictMode double-mount interference
    if (isProcessingLogin) {
      // console.log(`[${mountId}] ⚠️ Already processing login (React StrictMode double-mount detected) - skipping this mount`);
      // console.log(`[${mountId}] Module-level flag isProcessingLogin=true prevents interference`);
      // console.log(`[${mountId}] This is normal in development mode - second mount will be ignored`);
      return;
    }
    
    // Set module-level flag IMMEDIATELY to prevent React StrictMode double-mount interference
    isProcessingLogin = true;
    // console.log(`[${mountId}] ✅ Module-level processing flag set to true (prevents double-mount interference)`);
    
    // Reset all state on mount - critical for fresh logins after logout
    // console.log(`[${mountId}] Resetting state...`);
    loginAttemptedRef.current = false;
    loginSuccessRef.current = false;
    loginErrorRef.current = null;
    setCurrentStep(0);
    setProgress(0);
    setConnectionLog([]);
    
    // Also set ref flag for consistency
    isProcessingRef.current = true;
    
    // Check for pending login - with retry mechanism for race conditions
    const checkPendingLogin = (retryCount = 0): PendingLogin | null => {
      const checkId = `CHECK-${Date.now()}-${retryCount}`;
      // console.log(`\n[${checkId}] ========== STEP 2.${retryCount + 1}: CHECKING SESSIONSTORAGE ==========`);
      // console.log(`[${checkId}] Attempt number: ${retryCount + 1}`);
      // console.log(`[${checkId}] Timestamp: ${new Date().toISOString()}`);
      
      // console.log(`[${checkId}] STEP 2.${retryCount + 1}.1: Reading sessionStorage...`);
      const storageStartTime = Date.now();
      const pendingLoginStr = sessionStorage.getItem('pendingLogin');
      const storageEndTime = Date.now();
      // console.log(`[${checkId}] Storage read took ${storageEndTime - storageStartTime}ms`);
      
      // console.log(`[${checkId}] STEP 2.${retryCount + 1}.2: Checking result...`);
      // console.log(`[${checkId}] pendingLogin value: ${pendingLoginStr ? `EXISTS (${pendingLoginStr.length} chars)` : 'NOT FOUND'}`);
      
      if (pendingLoginStr) {
        // console.log(`[${checkId}] Data preview: ${pendingLoginStr.substring(0, 150)}...`);
      } else {
        // console.log(`[${checkId}] All sessionStorage keys:`, Object.keys(sessionStorage));
      }
      
      if (!pendingLoginStr && retryCount < 2) {
        // Retry after a short delay (race condition with navigation)
        // console.log(`[${checkId}] STEP 2.${retryCount + 1}.3: No data found, scheduling retry...`);
        // console.log(`[${checkId}] Will retry in 100ms (attempt ${retryCount + 1} of 2)`);
        setTimeout(() => {
          const retryId = `RETRY-${Date.now()}`;
          // console.log(`[${retryId}] ========== RETRY ATTEMPT ${retryCount + 2} ==========`);
          const retryResult = checkPendingLogin(retryCount + 1);
          if (retryResult) {
            // console.log(`[${retryId}] ✅ Retry SUCCESS - found pendingLogin!`);
            processLoginFlow(retryResult);
          } else if (retryCount === 1) {
            // console.log(`[${retryId}] ❌ Final retry FAILED - checking existing session`);
            checkExistingSession();
          }
        }, 100);
        return null;
      }
      
      if (!pendingLoginStr) {
        // console.log(`[${checkId}] ❌ STEP 2.${retryCount + 1} FAILED - no data found after all retries`);
        return null;
      }
      
      // console.log(`[${checkId}] STEP 2.${retryCount + 1}.3: Parsing JSON data...`);
      try {
        const parseStartTime = Date.now();
        const parsed = JSON.parse(pendingLoginStr);
        const parseEndTime = Date.now();
        // console.log(`[${checkId}] Parse took ${parseEndTime - parseStartTime}ms`);
        // console.log(`[${checkId}] Parsed data:`, {
        //   username: parsed.username,
        //   connectionType: parsed.connectionType,
        //   isNewUser: parsed.isNewUser,
        //   hasPassword: !!parsed.password,
        //   hasEmail: !!parsed.email
        // });
        
        // console.log(`[${checkId}] STEP 2.${retryCount + 1}.4: Marking as processed (NOT removing yet to prevent React StrictMode issues)...`);
        // Don't remove from sessionStorage yet - React StrictMode causes double-mount
        // We'll remove it after the flow is confirmed started
        // console.log(`[${checkId}] ✅ STEP 2.${retryCount + 1} COMPLETE - data parsed`);
        return parsed;
      } catch (e: any) {
        // console.error(`[${checkId}] ❌ STEP 2.${retryCount + 1}.3 FAILED - parse error:`, e);
        // console.error(`[${checkId}] Error message: ${e.message}`);
        // console.error(`[${checkId}] Raw data that failed to parse: ${pendingLoginStr.substring(0, 200)}...`);
        return null;
      }
    };
    
    const checkExistingSession = () => {
      // console.log('[ConnectScreen] No pending login - checking existing session');
      authService.getCurrentUser()
        .then((user) => {
          isProcessingRef.current = false;
          if (user) {
            // console.log('[ConnectScreen] User already authenticated:', user.username);
            sessionStorage.removeItem('pendingLogin');
            sessionStorage.removeItem('pendingRegister');
            sessionStorage.removeItem('pendingAuth');
            router.push('/shell');
          } else {
            // console.log('[ConnectScreen] No existing session - redirecting to login');
            sessionStorage.removeItem('pendingLogin');
            sessionStorage.removeItem('pendingRegister');
            sessionStorage.removeItem('pendingAuth');
            router.push('/');
          }
        })
        .catch((err) => {
          // console.error('[ConnectScreen] Session check error:', err);
          isProcessingRef.current = false;
          sessionStorage.removeItem('pendingLogin');
          sessionStorage.removeItem('pendingRegister');
          sessionStorage.removeItem('pendingAuth');
          router.push('/');
        });
    };
    
    // Initial check - try to get pendingLogin BEFORE defining processLoginFlow
    // console.log(`[${mountId}] STEP 2.0: Performing initial check for pendingLogin...`);
    const initialPendingLogin = checkPendingLogin(0);
    // console.log(`[${mountId}] STEP 2.0 RESULT: ${initialPendingLogin ? 'FOUND - will process' : 'NOT FOUND - retry scheduled or checking session'}`);
    
    const processLoginFlow = (pendingLogin: PendingLogin) => {
      // Prevent double-processing in React StrictMode
      if (isProcessingRef.current && loginAttemptedRef.current) {
        // console.log('[ConnectScreen] Already processing login flow, skipping duplicate call');
        return;
      }
      
      const flowId = `FLOW-${Date.now()}`;
      // console.log(`\n[${flowId}] ========== STEP 3: PROCESSING LOGIN FLOW ==========`);
      // console.log(`[${flowId}] Timestamp: ${new Date().toISOString()}`);
      
      if (!pendingLogin) {
        // console.error(`[${flowId}] ❌ STEP 3 FAILED - no pending login provided`);
        isProcessingRef.current = false;
        router.push('/');
        return;
      }
      
      // Mark as processing and remove from sessionStorage now that we're committed
      // console.log(`[${flowId}] STEP 3.0: Removing pendingLogin from sessionStorage...`);
      sessionStorage.removeItem('pendingLogin');
      // console.log(`[${flowId}] ✅ Removed from sessionStorage`);

      // console.log(`[${flowId}] STEP 3.1: Extracting login data...`);
      // Store in a const to ensure closure works correctly
      const connectionType = pendingLogin.connectionType;
      const isNewUser = pendingLogin.isNewUser;
      const loginUsername = pendingLogin.username;
      const loginPassword = pendingLogin.password;
      const loginEmail = pendingLogin.email;
      const loginScreenName = pendingLogin.screenName;

      // console.log(`[${flowId}] Extracted data:`, {
      //   connectionType,
      //   isNewUser,
      //   username: loginUsername,
      //   hasPassword: !!loginPassword,
      //   hasEmail: !!loginEmail,
      //   screenName: loginScreenName
      // });
      
      // console.log(`[${flowId}] STEP 3.2: Checking connection type...`);
      // console.log(`[${flowId}] Connection type: "${connectionType}"`);
      // console.log(`[${flowId}] Is new user: ${isNewUser}`);
      // console.log(`[${flowId}] Username: "${loginUsername}"`);

      // LAN mode: immediate authentication, no animation
      if (connectionType === 'lan') {
        // console.log(`[${flowId}] ✅ STEP 3.2: LAN mode detected - immediate authentication`);
      
      const performAuth = async () => {
        try {
          let user;
          
          if (isNewUser) {
            // Create new user
            // console.log('[ConnectScreen] Creating new user...');
            if (!loginEmail) {
              throw new Error('Email is required for new user');
            }
            user = await authService.register(
              loginUsername,
              loginPassword,
              loginEmail,
              loginScreenName || loginUsername
            );
            // console.log('[ConnectScreen] User created successfully');
          } else {
            // Login existing user
            // console.log('[ConnectScreen] Logging in existing user...');
            user = await authService.login(loginUsername, loginPassword);
            // console.log('[ConnectScreen] Login successful');
          }

          // Small delay to allow cookies to be set
          await new Promise(resolve => setTimeout(resolve, SESSION_VERIFY_DELAY_MS));

          // Verify session
          const verifiedUser = await authService.getCurrentUser();
          if (verifiedUser) {
            // console.log('[ConnectScreen] Session verified, navigating to shell');
            setCurrentUser(verifiedUser);
            isProcessingRef.current = false;
            router.push('/shell');
          } else {
            throw new Error('Session verification failed');
          }
        } catch (err: any) {
          // console.error('[ConnectScreen] Authentication failed:', err);
          isProcessingRef.current = false;
          router.push('/?error=' + encodeURIComponent(err.message || 'Authentication failed'));
        }
      };

      performAuth();
      return;
    }

      // Dial-up mode: 28-second animation with staged steps
      // console.log(`[${flowId}] ✅ STEP 3.2: DIAL-UP mode detected - starting 28-second connection sequence`);
      // console.log(`[${flowId}] Will play dial-up sound and show animation`);
      // console.log(`[${flowId}] Initializing dial-up animation...`);

      // Play dial-up sound - use module-level ref to persist across remounts
      // console.log(`[${flowId}] Loading dial-up audio file...`);
      const audio = new Audio('/audio/dialup.mp3');
      audioRef.current = audio;
      globalAudioRef = audio; // Store in module-level ref
      // console.log(`[${flowId}] Attempting to play dial-up sound...`);
      audio.play().catch((error) => {
        // console.error(`[${flowId}] ❌ Could not play dialup sound:`, error);
        // Don't fail the whole flow if audio fails
      });
      // console.log(`[${flowId}] ✅ Dial-up sound playback initiated`);

    // Initialize connection log with first step
    setConnectionLog([DIALUP_STEPS[0]]);
    setCurrentStep(0);

    // Function to add log entry
    const addLogEntry = (message: string) => {
      setConnectionLog((prev) => {
        // Don't add duplicates
        if (prev.includes(message)) return prev;
        return [...prev, message];
      });
    };

    // Function to verify session with retry
    const verifySession = async (retries = 3): Promise<boolean> => {
      for (let i = 0; i < retries; i++) {
        try {
          // Add delay to allow cookies to be set
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, SESSION_VERIFY_DELAY_MS * (i + 1)));
          } else {
            // First attempt already has delay from performAuth
            await new Promise(resolve => setTimeout(resolve, SESSION_VERIFY_DELAY_MS));
          }
          const user = await authService.getCurrentUser();
          // console.log(`[ConnectScreen] Session verification attempt ${i + 1}:`, user ? 'SUCCESS' : 'FAILED');
          if (user) {
            return true;
          }
        } catch (error) {
          // console.error(`[ConnectScreen] Session verification attempt ${i + 1} error:`, error);
        }
      }
      // console.error('[ConnectScreen] All session verification attempts failed');
      return false;
    };

    // Function to navigate to shell
    const navigateToShell = async () => {
      // Use same approach as LAN mode - directly check getCurrentUser
      const verifiedUser = await authService.getCurrentUser();
      
      if (!verifiedUser) {
        // console.error('[ConnectScreen] Cannot navigate - session not verified');
        // Retry once more
        await new Promise(resolve => setTimeout(resolve, SESSION_VERIFY_DELAY_MS));
        const retryUser = await authService.getCurrentUser();
        
        if (!retryUser) {
          // console.error('[ConnectScreen] Session verification failed after retry');
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          isProcessingRef.current = false;
          isProcessingLogin = false; // Reset module flag on error
          router.push('/?error=' + encodeURIComponent('Authentication failed. Please try again.'));
          return;
        }
        
        // Success on retry
        setCurrentUser(retryUser);
      } else {
        setCurrentUser(verifiedUser);
      }
      
      // console.log('[ConnectScreen] Session verified, navigating to shell');
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      isProcessingRef.current = false;
      isProcessingLogin = false; // Reset module flag on successful navigation
      SoundService.play('welcome');
      router.push('/shell');
    };

    // Function to navigate back with error
    // Use state to trigger navigation in useEffect (React 19 compliance)
    const navigateBackWithError = (error: string) => {
      // console.log('[ConnectScreen] Connection failed, navigating back with error:', error);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      isProcessingRef.current = false;
      isProcessingLogin = false; // Reset module flag on error
      setNavigationError(error); // Set state to trigger navigation in useEffect
    };

    // Simulate connection steps - store in module-level to persist across remounts
    console.log(`[${flowId}] Setting up step interval...`);
    const stepInterval = setInterval(() => {
      console.log(`[${flowId}] Step interval tick - current step will advance`);
      setCurrentStep((prev) => {
        const nextStep = prev + 1;
        console.log(`[${flowId}] Step advancing: ${prev} -> ${nextStep} (${DIALUP_STEPS[nextStep] || 'END'})`);
        // console.log(`[${flowId}] Step advancing: ${prev} -> ${nextStep} (${DIALUP_STEPS[nextStep] || 'END'})`);
        
        // Add log entry for each step
        if (nextStep < DIALUP_STEPS.length) {
          addLogEntry(DIALUP_STEPS[nextStep]);
        }
        
            // If we've reached the "Verifying user..." step, attempt authentication
            if (!loginAttemptedRef.current && nextStep === VERIFY_USER_STEP_INDEX) {
              console.log(`[${flowId}] ✅ Reached VERIFY_USER_STEP_INDEX (${VERIFY_USER_STEP_INDEX}) - triggering auth`);
              loginAttemptedRef.current = true;
              const authStepId = `AUTH-STEP-${Date.now()}`;
              console.log(`\n[${authStepId}] ========== AUTHENTICATION STEP TRIGGERED ==========`);
              console.log(`[${authStepId}] Step index: ${VERIFY_USER_STEP_INDEX} (Verifying user...)`);
              console.log(`[${authStepId}] Is new user: ${isNewUser}`);
              console.log(`[${authStepId}] Username: ${loginUsername}`);
              console.log(`[${authStepId}] Has password: ${!!loginPassword}`);
              console.log(`[${authStepId}] Has email: ${!!loginEmail}`);
              
              // Perform authentication
              const performAuth = async () => {
                try {
                  let user;
                  
                  if (isNewUser) {
                    // Create new user
                    console.log(`[${authStepId}] Creating new user...`);
                    console.log(`[${authStepId}] Username: ${loginUsername}`);
                    console.log(`[${authStepId}] Email: ${loginEmail}`);
                    if (!loginEmail) {
                      const errorMsg = 'Email is required for new user';
                      console.error(`[${authStepId}] ❌ ${errorMsg}`);
                      throw new Error(errorMsg);
                    }
                    console.log(`[${authStepId}] Calling authService.register()...`);
                    try {
                      user = await authService.register(
                        loginUsername,
                        loginPassword,
                        loginEmail,
                        loginScreenName || loginUsername
                      );
                      console.log(`[${authStepId}] ✅ User created and logged in successfully`);
                      addLogEntry('Successfully created a new user.');
                    } catch (registerError: any) {
                      console.error(`[${authStepId}] ❌ Registration failed:`, registerError.message);
                      console.error(`[${authStepId}] Error stack:`, registerError.stack);
                      // Show error in log before redirecting
                      addLogEntry(`Error: ${registerError.message}`);
                      // Wait longer so user can see the error (10 seconds)
                      await new Promise(resolve => setTimeout(resolve, 10000));
                      throw registerError;
                    }
                  } else {
                    // Login existing user
                    const loginId = `DIALUP-LOGIN-${Date.now()}`;
                    console.log(`\n[${loginId}] ========== DIAL-UP LOGIN START ==========`);
                    console.log(`[${loginId}] Username: ${loginUsername}`);
                    console.log(`[${loginId}] Password provided: ${loginPassword ? 'YES' : 'NO'}`);
                    console.log(`[${loginId}] Calling authService.login()...`);
                    
                    try {
                      user = await authService.login(loginUsername, loginPassword);
                      console.log(`[${loginId}] ✅ Login API call successful`);
                      console.log(`[${loginId}] User object:`, { id: user.id, username: user.username });
                    } catch (loginError: any) {
                      console.error(`[${loginId}] ❌ Login API call FAILED:`);
                      console.error(`[${loginId}] Error: ${loginError.message}`);
                      console.error(`[${loginId}] Stack: ${loginError.stack}`);
                      // Show error in log before redirecting
                      addLogEntry(`Error: ${loginError.message}`);
                      // Wait longer so user can see the error (10 seconds)
                      await new Promise(resolve => setTimeout(resolve, 10000));
                      throw loginError; // Re-throw to be caught by outer try-catch
                    }
                    
                    console.log(`[${loginId}] =========================================\n`);
                  }

                  // Longer delay to allow cookies to be set and propagated
                  const verifyId = `VERIFY-${Date.now()}`;
                  // console.log(`\n[${verifyId}] ========== SESSION VERIFICATION START ==========`);
                  // console.log(`[${verifyId}] User object from login:`, { id: user.id, username: user.username });
                  // console.log(`[${verifyId}] Waiting ${SESSION_VERIFY_DELAY_MS * 2}ms for cookies to be set...`);
                  await new Promise(resolve => setTimeout(resolve, SESSION_VERIFY_DELAY_MS * 2));

                  // Verify session - use same approach as LAN mode
                  // console.log(`[${verifyId}] Attempting first session verification...`);
                  let verifiedUser = await authService.getCurrentUser();
                  
                  if (!verifiedUser) {
                    // console.log(`[${verifyId}] ❌ First verification FAILED`);
                    // console.log(`[${verifyId}] Retrying after ${SESSION_VERIFY_DELAY_MS * 2}ms delay...`);
                    // Retry with longer delay
                    await new Promise(resolve => setTimeout(resolve, SESSION_VERIFY_DELAY_MS * 2));
                    // console.log(`[${verifyId}] Attempting second session verification...`);
                    verifiedUser = await authService.getCurrentUser();
                  }
                  
                  if (verifiedUser) {
                    loginSuccessRef.current = true;
                    setCurrentUser(verifiedUser);
                    // console.log(`[${verifyId}] ✅ Session verification SUCCESSFUL`);
                    // console.log(`[${verifyId}] Verified user: ${verifiedUser.username} (${verifiedUser.id})`);
                    // console.log(`[${verifyId}] ================================================\n`);
                  } else {
                    // console.error(`[${verifyId}] ❌ Session verification FAILED after all retries`);
                    // console.error(`[${verifyId}] This might indicate cookies are not being set properly`);
                    // console.error(`[${verifyId}] ================================================\n`);
                    loginErrorRef.current = 'Session creation failed. Please try again.';
                    setDisplayError('Session creation failed. Please try again.');
                  }
                } catch (err: any) {
                  console.error(`[${authStepId}] ❌ Authentication error:`, err.message);
                  console.error(`[${authStepId}] Error stack:`, err.stack);
                  
                  // Determine user-friendly error message
                  let errorMessage = err.message || (isNewUser ? 'Failed to create account' : 'Invalid screen name or password');
                  
                  // Provide more specific error messages
                  if (err.message.includes('already exists')) {
                    errorMessage = 'Username, screen name, or email already exists. Please try a different one.';
                  } else if (err.message.includes('Server error') || err.message.includes('Database')) {
                    errorMessage = 'Server error occurred. Please try again later.';
                  } else if (err.message.includes('Account created but login failed')) {
                    errorMessage = 'Account was created but automatic login failed. Please try logging in manually.';
                  }
                  
                  loginErrorRef.current = errorMessage;
                  setDisplayError(errorMessage); // Update state to trigger re-render
                  console.error(`[${authStepId}] Setting error message: ${errorMessage}`);
                }
          };

          performAuth();
        }
        
        // Check for errors after verify user step
        if (nextStep > VERIFY_USER_STEP_INDEX) {
          if (loginErrorRef.current && !loginSuccessRef.current) {
            // Stop intervals and timeout
            if (intervalsRef.current.step) clearInterval(intervalsRef.current.step);
            if (intervalsRef.current.progress) clearInterval(intervalsRef.current.progress);
            if (intervalsRef.current.timeout) clearTimeout(intervalsRef.current.timeout);
            
            // Trigger navigation via state (handled in useEffect)
            navigateBackWithError(loginErrorRef.current!);
            
            return prev; // Don't advance step
          }
        }
        
        if (nextStep < DIALUP_STEPS.length) {
          return nextStep;
        }
        return prev;
      });
    }, STEP_DURATION_MS);
    intervalsRef.current.step = stepInterval;
    globalIntervals.step = stepInterval; // Also store in module-level
    // console.log(`[${flowId}] ✅ Step interval set up (${STEP_DURATION_MS}ms interval)`);

    // Update progress bar smoothly over 28 seconds
    // console.log(`[${flowId}] Setting up progress interval...`);
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 100) {
          return Math.min(prev + (100 / (DIALUP_SOUND_DURATION_MS / 100)), 100);
        }
        return prev;
      });
    }, 100);
    intervalsRef.current.progress = progressInterval;
    globalIntervals.progress = progressInterval; // Also store in module-level
    // console.log(`[${flowId}] ✅ Progress interval set up`);

    // Navigate to shell after exactly 28 seconds (only if login succeeded)
    const timeout = setTimeout(async () => {
      // console.log('[ConnectScreen] 28 second timeout fired');
      // console.log('[ConnectScreen] loginSuccess:', loginSuccessRef.current);
      // console.log('[ConnectScreen] loginError:', loginErrorRef.current);
      
      // If login succeeded, verify session one more time before navigating
      if (!loginErrorRef.current && loginSuccessRef.current) {
        // Double-check session is still valid before navigating
        const finalCheck = await authService.getCurrentUser();
        if (finalCheck) {
          // console.log('[ConnectScreen] Final session check passed, navigating to shell');
          setCurrentUser(finalCheck);
          await navigateToShell();
        } else {
          // console.error('[ConnectScreen] Session lost between auth and navigation');
          navigateBackWithError('Session expired. Please try again.');
        }
      } else if (loginErrorRef.current) {
        navigateBackWithError(loginErrorRef.current);
      } else {
        // console.error('[ConnectScreen] Timeout reached but authentication state unclear');
        // Try one final session check
        const finalCheck = await authService.getCurrentUser();
        if (finalCheck) {
          // console.log('[ConnectScreen] Found session on final check, navigating');
          setCurrentUser(finalCheck);
          await navigateToShell();
        } else {
          navigateBackWithError('Authentication timeout. Please try again.');
        }
      }
    }, DIALUP_SOUND_DURATION_MS);
    intervalsRef.current.timeout = timeout;
    globalIntervals.timeout = timeout; // Also store in module-level
    // console.log(`[${flowId}] ✅ Timeout set up (${DIALUP_SOUND_DURATION_MS}ms)`);
    };
    
    // Call processLoginFlow if we found pendingLogin
    // console.log(`[${mountId}] STEP 2.FINAL: Checking if we should call processLoginFlow...`);
    // console.log(`[${mountId}] initialPendingLogin: ${initialPendingLogin ? 'EXISTS' : 'NULL'}`);
    if (initialPendingLogin) {
      // console.log(`[${mountId}] ✅ Calling processLoginFlow with initialPendingLogin`);
      processLoginFlow(initialPendingLogin);
    } else {
      // console.log(`[${mountId}] ⏳ initialPendingLogin is null - retry logic or checkExistingSession will handle`);
      // console.log(`[${mountId}] If retry finds data, processLoginFlow will be called from within checkPendingLogin`);
    }
    // If null, checkPendingLogin will handle retry and checkExistingSession

    return () => {
      // In React StrictMode, cleanup runs immediately after mount
      // Don't clear intervals/audio if we're still processing - they're needed!
      // Only clear if we're actually navigating away
      const isStillOnConnectPage = typeof window !== 'undefined' && window.location.pathname === '/connect';
      
      if (isStillOnConnectPage && isProcessingLogin) {
        // console.log('[ConnectScreen] Cleanup called but still processing - NOT clearing intervals (React StrictMode remount)');
        // console.log('[ConnectScreen] Intervals will continue running from module-level storage');
        return; // Don't clear anything - let the flow continue
      }
      
      // console.log('[ConnectScreen] Cleanup called - actually navigating away, clearing everything');
      isProcessingRef.current = false;
      
      // Clear from both refs and module-level
      if (intervalsRef.current.step) clearInterval(intervalsRef.current.step);
      if (intervalsRef.current.progress) clearInterval(intervalsRef.current.progress);
      if (intervalsRef.current.timeout) clearTimeout(intervalsRef.current.timeout);
      if (globalIntervals.step) clearInterval(globalIntervals.step);
      if (globalIntervals.progress) clearInterval(globalIntervals.progress);
      if (globalIntervals.timeout) clearTimeout(globalIntervals.timeout);
      globalIntervals = {};
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (globalAudioRef) {
        globalAudioRef.pause();
        globalAudioRef.currentTime = 0;
        globalAudioRef = null;
      }
    };
  }, [router, setCurrentUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-900 to-blue-700">
      <div className="bg-white p-8 rounded-lg shadow-2xl border-4 border-gray-300 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-blue-600 mb-4">Connecting to Ramen Online</h1>
        </div>

        <div className="space-y-4">
          {/* Error Display - Show prominently if there's an error */}
          {displayError && (
            <div className="bg-red-100 border-4 border-red-500 rounded p-4 animate-pulse">
              <p className="text-lg font-bold text-red-800 text-center">
                ⚠️ Error: {displayError}
              </p>
              <p className="text-sm text-red-600 text-center mt-2">
                This message will stay visible for 10 seconds...
              </p>
            </div>
          )}
          
          {/* Connection Status */}
          <div className="bg-gray-100 border-2 border-gray-400 rounded p-4 min-h-[100px] flex items-center justify-center">
            <p className="text-lg font-semibold text-gray-800">
              {DIALUP_STEPS[currentStep] || 'Connecting...'}
            </p>
          </div>

          {/* Connection Log - Hidden */}
          {/* {connectionLog.length > 0 && (
            <div className="bg-gray-900 text-green-400 font-mono text-xs p-3 rounded border-2 border-gray-400 max-h-32 overflow-y-auto">
              {connectionLog.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))}
            </div>
          )} */}

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 border-2 border-gray-400 rounded overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-6 transition-all duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="text-center text-sm text-gray-600 mt-4">
            <p>Please wait while we connect you...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
