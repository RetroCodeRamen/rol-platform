/**
 * Hook to integrate IM logic with AppMessageHandler
 * Handles auto-open behavior and bold+asterisk indicators
 */

import { useEffect } from 'react';
import { useAppStore } from '@/state/store';
import { subscribeToMessage, dispatchMessage, type MessageType } from './AppMessageHandler';
import { SoundService } from '@/services/SoundService';

interface IIMMessage {
  id: string;
  from: string;
  to: string;
  message: string;
  timestamp: string;
}

export function useIMMessageHandler() {
  const { currentUser, userSettings, windows, openWindow, bringToFront, setBuddies, buddies } = useAppStore();

  useEffect(() => {
    if (!currentUser) return;

    const handleNewIM = (payload: any) => {
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
        // Window exists - don't force focus, just play sound and update
        // The window will update via its own message listener
        dispatchMessage('IM_WINDOW_FOCUS', { windowId: existingWindow.id, participant: message.from });
      } else {
        // No window exists
        if (userSettings.autoOpenIMs) {
          // Auto-open: Create and show window immediately
          const myScreenName = currentUser.screenName || currentUser.username;
          const title = `${myScreenName} : ${message.from} - Instant Message`;
          const windowId = openWindow('im', title, {
            participant: message.from,
          });
          dispatchMessage('IM_WINDOW_OPEN', { windowId, participant: message.from });
        } else {
          // Don't auto-open: Mark sender as bold+asterisk in buddy list
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
    };

    // Subscribe to IM_NEW_MESSAGE events
    const unsubscribe = subscribeToMessage('IM_NEW_MESSAGE', handleNewIM);

    return () => {
      unsubscribe();
    };
  }, [currentUser, userSettings.autoOpenIMs, windows, openWindow, bringToFront, setBuddies, buddies]);
}

