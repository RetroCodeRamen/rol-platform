/**
 * ROLBOT - Automated testing bot
 * 
 * This bot acts as a real user in the system for testing purposes.
 * It connects via WebSocket and responds to messages using the real IM system.
 * 
 * Commands:
 * - "hi" or "hi <seconds>" - Responds immediately or after delay
 * - "away <message>" - Sets away message
 * - "logout" - Logs out for 30 seconds
 */

import { io, Socket } from 'socket.io-client';
import mongoose from 'mongoose';
import User from '@/lib/db/models/User';
import Message from '@/lib/db/models/Message';
import dbConnect from '@/lib/db/mongoose';

interface BotState {
  responseDelay: number; // Default delay in seconds
  awayMessage: string | null;
  isLoggedOut: boolean;
  logoutUntil: number | null;
}

class ROLBot {
  private socket: Socket | null = null;
  private botUserId: string | null = null;
  private botUsername: string = 'rolbot';
  private state: BotState = {
    responseDelay: 0,
    awayMessage: null,
    isLoggedOut: false,
    logoutUntil: null,
  };
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  async initialize() {
    try {
      console.log('[ROLBOT] Initializing...');
      
      // Connect to database
      await dbConnect();
      
      // Find or create ROLBOT user
      let botUser = await User.findOne({ username: this.botUsername });
      
      if (!botUser) {
        console.log('[ROLBOT] Creating ROLBOT user account...');
        const bcrypt = require('bcryptjs');
        const passwordHash = await bcrypt.hash('rolbot_password_' + Date.now(), 12);
        
        botUser = await User.create({
          username: this.botUsername,
          screenName: 'ROLBOT',
          email: 'rolbot@ramn.online',
          passwordHash,
          status: 'online',
          awayStatus: 'available',
        });
        console.log('[ROLBOT] User account created:', botUser._id);
      }
      
      this.botUserId = String(botUser._id);
      console.log('[ROLBOT] Bot user ID:', this.botUserId);
      
      // Connect to WebSocket
      await this.connect();
      
      // Set status to online
      await this.updateStatus('online');
      
      console.log('[ROLBOT] Initialization complete');
    } catch (error: any) {
      console.error('[ROLBOT] Initialization error:', error);
      throw error;
    }
  }

  private async connect() {
    return new Promise<void>((resolve, reject) => {
      if (!this.botUserId) {
        reject(new Error('Bot user ID not set'));
        return;
      }

      const serverUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
      console.log('[ROLBOT] Connecting to:', serverUrl);

      this.socket = io(serverUrl, {
        path: '/api/socket.io',
        auth: {
          userId: this.botUserId,
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: this.maxReconnectAttempts,
      });

      this.socket.on('connect', () => {
        console.log('[ROLBOT] Connected to WebSocket server');
        this.reconnectAttempts = 0;
        this.setupMessageHandlers();
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log('[ROLBOT] Disconnected from server');
      });

      this.socket.on('connect_error', (error) => {
        console.error('[ROLBOT] Connection error:', error);
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error('Max reconnection attempts reached'));
        }
      });
    });
  }

  private setupMessageHandlers() {
    if (!this.socket) return;

    // Listen for new IM messages
    this.socket.on('im:new', async (messageData: any) => {
      try {
        // Only respond to messages TO the bot
        if (messageData.to?.toLowerCase() !== this.botUsername) {
          return;
        }

        const message = messageData.message?.trim() || '';
        const from = messageData.from;

        console.log(`[ROLBOT] Received message from ${from}: "${message}"`);

        // Check if bot is logged out
        if (this.state.isLoggedOut) {
          const now = Date.now();
          if (this.state.logoutUntil && now < this.state.logoutUntil) {
            console.log(`[ROLBOT] Bot is logged out, ignoring message`);
            return;
          } else {
            // Logout period expired, log back in
            this.state.isLoggedOut = false;
            this.state.logoutUntil = null;
            await this.updateStatus('online');
            console.log('[ROLBOT] Logout period expired, bot is back online');
          }
        }

        // Parse commands
        await this.handleCommand(message, from);
      } catch (error: any) {
        console.error('[ROLBOT] Error handling message:', error);
      }
    });

    // Listen for sent message confirmations
    this.socket.on('im:sent', (messageData: any) => {
      console.log('[ROLBOT] Message sent confirmation:', messageData);
    });

    // Listen for errors
    this.socket.on('im:error', (error: any) => {
      console.error('[ROLBOT] IM error:', error);
    });
  }

  private async handleCommand(message: string, from: string) {
    const lowerMessage = message.toLowerCase().trim();

    // Handle logout command
    if (lowerMessage === 'logout') {
      this.state.isLoggedOut = true;
      this.state.logoutUntil = Date.now() + (30 * 1000); // 30 seconds
      await this.updateStatus('offline');
      await this.sendMessage(from, 'Logging out for 30 seconds...');
      console.log('[ROLBOT] Logged out for 30 seconds');
      
      // Auto-login after 30 seconds
      setTimeout(async () => {
        this.state.isLoggedOut = false;
        this.state.logoutUntil = null;
        await this.updateStatus('online');
        console.log('[ROLBOT] Auto-logged back in after 30 seconds');
      }, 30000);
      return;
    }

    // Handle away message command
    if (lowerMessage.startsWith('away ')) {
      const awayMsg = message.substring(5).trim();
      if (awayMsg) {
        this.state.awayMessage = awayMsg;
        await this.updateAwayMessage(awayMsg);
        await this.sendMessage(from, `Away message set: "${awayMsg}"`);
        console.log(`[ROLBOT] Away message set: "${awayMsg}"`);
      } else {
        // Clear away message
        this.state.awayMessage = null;
        await this.updateAwayMessage(null);
        await this.sendMessage(from, 'Away message cleared');
        console.log('[ROLBOT] Away message cleared');
      }
      return;
    }

    // Handle hi command with optional delay
    if (lowerMessage.startsWith('hi')) {
      let delay = 0;
      
      // Check for delay number
      const parts = message.split(/\s+/);
      if (parts.length > 1) {
        const delayStr = parts[parts.length - 1];
        const parsedDelay = parseInt(delayStr, 10);
        if (!isNaN(parsedDelay) && parsedDelay >= 0) {
          delay = parsedDelay;
        }
      }

      const response = delay > 0 
        ? `Hi! (responding after ${delay} second${delay !== 1 ? 's' : ''} delay)`
        : 'Hi!';

      if (delay > 0) {
        console.log(`[ROLBOT] Will respond in ${delay} seconds`);
        setTimeout(() => {
          this.sendMessage(from, response);
        }, delay * 1000);
      } else {
        await this.sendMessage(from, response);
      }
      return;
    }

    // Default: echo the message with a delay if specified
    const delayMatch = message.match(/(\d+)$/);
    if (delayMatch) {
      const delay = parseInt(delayMatch[1], 10);
      const messageWithoutDelay = message.substring(0, message.length - delayMatch[0].length).trim();
      if (messageWithoutDelay) {
        setTimeout(() => {
          this.sendMessage(from, `Echo: ${messageWithoutDelay}`);
        }, delay * 1000);
        return;
      }
    }

    // Default response
    await this.sendMessage(from, `You said: "${message}"`);
  }

  private async sendMessage(to: string, message: string) {
    if (!this.socket || !this.socket.connected) {
      console.error('[ROLBOT] Cannot send message: socket not connected');
      return;
    }

    try {
      console.log(`[ROLBOT] Sending message to ${to}: "${message}"`);
      this.socket.emit('im:send', {
        to,
        message,
      });
    } catch (error: any) {
      console.error('[ROLBOT] Error sending message:', error);
    }
  }

  private async updateStatus(status: 'online' | 'away' | 'busy' | 'offline') {
    if (!this.botUserId) return;

    try {
      await dbConnect();
      await User.findByIdAndUpdate(this.botUserId, {
        status,
        lastSeen: new Date(),
      });

      if (this.socket) {
        this.socket.emit('status:update', { status });
      }
    } catch (error: any) {
      console.error('[ROLBOT] Error updating status:', error);
    }
  }

  private async updateAwayMessage(message: string | null) {
    if (!this.botUserId) return;

    try {
      await dbConnect();
      const update: any = {
        awayMessage: message,
        lastSeen: new Date(),
      };

      if (message) {
        update.awayStatus = 'away';
        update.status = 'away';
      } else {
        update.awayStatus = 'available';
        update.status = 'online';
      }

      await User.findByIdAndUpdate(this.botUserId, update);

      if (this.socket) {
        this.socket.emit('status:update', { 
          status: message ? 'away' : 'online' 
        });
      }
    } catch (error: any) {
      console.error('[ROLBOT] Error updating away message:', error);
    }
  }

  async shutdown() {
    console.log('[ROLBOT] Shutting down...');
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.botUserId) {
      await this.updateStatus('offline');
    }
  }
}

// Export singleton instance
let botInstance: ROLBot | null = null;

export function getROLBot(): ROLBot {
  if (!botInstance) {
    botInstance = new ROLBot();
  }
  return botInstance;
}

export async function startROLBot(): Promise<void> {
  const bot = getROLBot();
  await bot.initialize();
}

export async function stopROLBot(): Promise<void> {
  if (botInstance) {
    await botInstance.shutdown();
    botInstance = null;
  }
}

