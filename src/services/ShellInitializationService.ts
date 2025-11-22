/**
 * Shell Initialization Service
 * 
 * Extracts initialization logic from ROLShell component.
 * Makes it easier to test and modify startup behavior.
 */

import { SoundService } from './SoundService';
import { mailService } from './MailService';
import { connectSocket } from '@/lib/websocket/client';
import type { IUser } from './AuthService';

export interface ShellInitOptions {
  user: IUser;
  onWelcomeWindowOpen: (title: string, options: any) => void;
  onMailCheck?: (unreadCount: number) => void;
}

export class ShellInitializationService {
  private welcomeSoundPlayed = false;

  /**
   * Initialize the shell after successful authentication
   */
  async initialize(options: ShellInitOptions): Promise<void> {
    const { user, onWelcomeWindowOpen, onMailCheck } = options;

    // Initialize sound service and play welcome sound
    SoundService.init();
    if (!this.welcomeSoundPlayed) {
      this.welcomeSoundPlayed = true;
      SoundService.play('welcome');
    }

    // Connect to WebSocket (non-blocking)
    connectSocket(user.id).catch((error) => {
      console.error('[ShellInit] Failed to connect to WebSocket:', error);
      // Continue without WebSocket
    });

    // Check for unread mail after delay
    setTimeout(async () => {
      try {
        const folders = await mailService.getFolders();
        const inboxFolder = folders.find((f) => f.name === 'Inbox');
        if (inboxFolder && inboxFolder.unreadCount > 0) {
          SoundService.play('youve_got_mail');
          onMailCheck?.(inboxFolder.unreadCount);
        }
      } catch (error) {
        // Silently fail - don't interrupt user experience
        console.error('[ShellInit] Failed to check mail:', error);
      }
    }, 3000);

    // Open welcome window if not already shown
    const welcomeShown = sessionStorage.getItem('welcomeWindowShown');
    if (!welcomeShown) {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const windowWidth = 500;
      const windowHeight = 400;
      onWelcomeWindowOpen(`Welcome, ${user.screenName || user.username}`, {
        x: (screenWidth - windowWidth) / 2,
        y: (screenHeight - windowHeight) / 2,
        width: windowWidth,
        height: windowHeight,
      });
      sessionStorage.setItem('welcomeWindowShown', 'true');
    }
  }

  /**
   * Reset initialization state (useful for testing or logout)
   */
  reset(): void {
    this.welcomeSoundPlayed = false;
  }
}

// Export singleton instance
export const shellInitService = new ShellInitializationService();

