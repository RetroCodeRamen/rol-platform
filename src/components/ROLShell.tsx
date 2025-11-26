'use client';

import { useEffect, useState } from 'react';
import TopNavBar from './TopNavBar';
import WindowManager from './WindowManager';
import { useAppStore, WindowType } from '@/state/store';
import { notificationService } from '@/services/NotificationService';
import { authService } from '@/services/AuthService';
import { shellInitService } from '@/services/ShellInitializationService';
import { disconnectSocket, getSocket } from '@/lib/websocket/client';
import { SoundService } from '@/services/SoundService';
import type { IIMMessage } from '@/services/ChatService';

// Guard to avoid duplicate SHORTCUT_CREATED subscriptions (e.g. React Fast Refresh)
let shortcutHandlerInitialized = false;

export default function ROLShell() {
  const currentUser = useAppStore((state) => state.currentUser);
  const messages = useAppStore((state) => state.messages);
  const openWindow = useAppStore((state) => state.openWindow);
  const setCurrentUser = useAppStore((state) => state.setCurrentUser);
  const bringToFront = useAppStore((state) => state.bringToFront);
  const windows = useAppStore((state) => state.windows);
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  useEffect(() => {
    // Verify authentication before loading shell
    const verifyAuth = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (!user) {
          console.error('[ROLShell] No authenticated user found, redirecting to login');
          window.location.href = '/';
          return;
        }
        console.log('[ROLShell] User authenticated:', user.username);
        setCurrentUser(user);
        setIsAuthenticating(false);
        
        // Use initialization service - decouples initialization logic
        await shellInitService.initialize({
          user,
          onWelcomeWindowOpen: (title, options) => {
            openWindow('welcome', title, options);
          },
          onMailCheck: (unreadCount) => {
            // Show notification if needed
            if (unreadCount > 0) {
              notificationService.checkNewMail(messages);
            }
          },
        });

        // Check for unread mail and show notification
        const unreadCount = messages.filter((m) => !m.read && m.folder === 'Inbox').length;
        if (unreadCount > 0) {
          notificationService.checkNewMail(messages);
        }
      } catch (error) {
        console.error('[ROLShell] Authentication verification failed:', error);
        window.location.href = '/';
      }
    };
    
    verifyAuth();
    
    // Cleanup: disconnect socket on unmount
    return () => {
      disconnectSocket();
    };
  }, [messages, setCurrentUser, openWindow]);

  // Global IM message handler - uses AppMessageHandler
  useEffect(() => {
    if (!currentUser) return;

    const socket = getSocket();
    if (!socket) return;

    const handleNewIM = async (message: IIMMessage) => {
      // Only handle messages TO the current user
      if (message.to !== currentUser.username) return;

      // Dispatch through AppMessageHandler instead of handling directly
      const { dispatchMessage } = await import('@/lib/messaging/AppMessageHandler');
      dispatchMessage('IM_NEW_MESSAGE', { message });

      // Show notification
      notificationService.notifyNewIM(message, currentUser.username);
    };

    socket.on('im:new', handleNewIM);

    return () => {
      socket.off('im:new', handleNewIM);
    };
  }, [currentUser]);

  // Subscribe to IM_NEW_MESSAGE from AppMessageHandler
  useEffect(() => {
    if (!currentUser) return;

    let unsubscribe: (() => void) | null = null;

    const setupHandler = async () => {
      const { subscribeToMessage } = await import('@/lib/messaging/AppMessageHandler');
      const userSettings = useAppStore.getState().userSettings;

      unsubscribe = subscribeToMessage('IM_NEW_MESSAGE', (payload: any) => {
        const message = payload.message as IIMMessage;
        // Only handle messages TO the current user
        if (message.to !== currentUser.username) return;

        // Play sound notification
        SoundService.play('new_im');

        // Check if IM window already exists for this sender
        const existingWindow = windows.find(
          (w) => w.type === 'im' && w.participant === message.from
        );

        if (existingWindow) {
          // Don't force focus - just play sound
          // Window will update via its own message listener
        } else {
          // No window exists - check auto-open setting
          if (userSettings.autoOpenIMs) {
            // Auto-open: Create and show window immediately
            const myScreenName = currentUser.screenName || currentUser.username;
            const title = `${myScreenName} : ${message.from} - Instant Message`;
            openWindow('im', title, {
              participant: message.from,
            });
          } else {
            // Don't auto-open: Mark sender as bold+asterisk in buddy list
            const { setBuddies, buddies } = useAppStore.getState();
            setBuddies(
              buddies.map((buddy) => {
                if (buddy.username === message.from) {
                  return {
                    ...buddy,
                    hasUnreadIM: true, // Flag for bold+asterisk display
                  };
                }
                return buddy;
              })
            );
          }
        }
      });
    };

    setupHandler();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser, windows, openWindow, bringToFront]);

  // Handle SHORTCUT_CREATED messages - save to favorites
  useEffect(() => {
    if (!currentUser) return;
    if (shortcutHandlerInitialized) return;
    shortcutHandlerInitialized = true;

    let unsubscribe: (() => void) | null = null;

    const setupShortcutHandler = async () => {
      const { subscribeToMessage, dispatchMessage } = await import('@/lib/messaging/AppMessageHandler');

      unsubscribe = subscribeToMessage('SHORTCUT_CREATED', async (payload: any) => {
        const { windowId, windowType, title, url } = payload;
        console.log('[ROLShell] SHORTCUT_CREATED received:', payload);
        try {
          const response = await fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              title: payload.title,
              windowType: payload.windowType,
              url: payload.url,
              options: payload.url ? { url: payload.url } : undefined,
            }),
          });

          const data = await response.json();
          console.log('[ROLShell] Favorite save response:', data);
          if (data.success) {
            // Notify that a favorite was added so FavoritesWindow can refresh
            dispatchMessage('FAVORITE_ADDED', { favorite: data.favorite });
            dispatchMessage('SYSTEM_ALERT', {
              message: `"${payload.title}" added to favorites`,
              title: 'Favorite Added',
            });
          } else if (data.error === 'Favorite already exists') {
            dispatchMessage('SYSTEM_ALERT', {
              message: `"${payload.title}" is already in your favorites`,
              title: 'Already Added',
            });
          } else {
            dispatchMessage('SYSTEM_ALERT', {
              message: data.error || 'Failed to add favorite',
              title: 'Error',
            });
          }
        } catch (error) {
          console.error('[ROLShell] Failed to save favorite:', error);
          dispatchMessage('SYSTEM_ALERT', {
            message: 'Failed to add favorite',
            title: 'Error',
          });
        }
      });
    };

    setupShortcutHandler();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser]);

  // Handle SYSTEM_ALERT messages - show in-app dialogs instead of browser alerts
  useEffect(() => {
    const setupSystemAlertHandler = async () => {
      const { subscribeToMessage } = await import('@/lib/messaging/AppMessageHandler');
      const closeWindow = useAppStore.getState().closeWindow;

      const unsubscribe = subscribeToMessage('SYSTEM_ALERT', (payload: { message: string; title?: string }) => {
        const { message, title = 'Alert' } = payload;
        
        // Open a dialog window for the alert (slightly larger so content & buttons always fit)
        const dialogId = openWindow('dialog', title, {
          width: 460,
          height: 220,
          x: 300,
          y: 250,
          dialogProps: {
            message,
            showInput: false,
            onConfirm: () => {
              closeWindow(dialogId);
            },
            onCancel: () => {
              closeWindow(dialogId);
            },
            confirmText: 'OK',
            cancelText: '', // Hide cancel button for alerts
          },
        });
      });

      return unsubscribe;
    };

    let unsubscribe: (() => void) | null = null;
    setupSystemAlertHandler().then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [openWindow]);

  // Check for pending buddy requests and show popups
  useEffect(() => {
    if (!currentUser) return;

    const checkBuddyRequests = async () => {
      try {
        const response = await fetch('/api/im/buddies/requests', {
          credentials: 'include',
        });
        const data = await response.json();
        
        if (data.success && data.requests && data.requests.length > 0) {
          const currentWindows = useAppStore.getState().windows;
          const closeWindow = useAppStore.getState().closeWindow;
          
          // Show popup for each pending request
          data.requests.forEach((req: any) => {
            // Check if window already exists for this request
            const existingWindow = currentWindows.find(
              (w) => w.type === 'buddyrequest' && w.buddyRequestProps?.requestId === req.id
            );
            
            if (!existingWindow) {
              const windowId = openWindow('buddyrequest', 'Buddy Request', {
                width: 400,
                height: 200,
                x: 300,
                y: 250,
                buddyRequestProps: {
                  requesterUsername: req.requesterUsername,
                  requestId: req.id,
                  onAccept: async () => {
                    const acceptResponse = await fetch('/api/im/buddies/requests', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ requestId: req.id, action: 'accept' }),
                    });
                    const acceptData = await acceptResponse.json();
                    if (acceptData.success) {
                      closeWindow(windowId);
                      // Reload buddy list if it's open - trigger reload by bringing to front
                      const updatedWindows = useAppStore.getState().windows;
                      const buddyListWindow = updatedWindows.find((w) => w.type === 'buddylist');
                      if (buddyListWindow) {
                        bringToFront(buddyListWindow.id);
                      }
                    }
                  },
                  onIgnore: async () => {
                    const ignoreResponse = await fetch('/api/im/buddies/requests', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ requestId: req.id, action: 'reject' }),
                    });
                    const ignoreData = await ignoreResponse.json();
                    if (ignoreData.success) {
                      closeWindow(windowId);
                    }
                  },
                },
              });
            }
          });
        }
      } catch (error) {
        console.error('Failed to check buddy requests:', error);
      }
    };

    // Check immediately and then every 10 seconds
    checkBuddyRequests();
    const interval = setInterval(checkBuddyRequests, 10000);

    return () => clearInterval(interval);
  }, [currentUser, openWindow, bringToFront]);

  // Don't render shell content until authenticated
  if (isAuthenticating || !currentUser) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-300">
        <div className="text-center">
          <p className="text-gray-700">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  const handleDesktopIconClick = (type: Parameters<typeof openWindow>[0]) => {
    const titles: Partial<Record<WindowType, string>> = {
      mail: 'Mail',
      im: 'Instant Message',
      chat: 'Chat Rooms',
      forums: 'Forums',
      buddylist: 'Buddy List',
      channels: 'Channels',
      web: 'ROL RamenDesk Edition',
      welcome: 'Welcome',
      weather: 'Weather',
      dialog: 'Dialog',
      buddyrequest: 'Buddy Request',
      profile: 'Profile',
      settings: 'Settings',
    };
    openWindow(type, titles[type] || type);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--light-gray, #c0c0c0)' }}>
      {/* ROL Top Navigation Bar */}
      <TopNavBar />

      {/* ROL Workspace Container - Single Application Window */}
      <div className="flex-1 relative overflow-hidden" style={{ backgroundColor: 'var(--light-gray, #c0c0c0)' }}>
        {/* Window Manager - renders all ROL internal windows */}
        <WindowManager />
      </div>
    </div>
  );
}
