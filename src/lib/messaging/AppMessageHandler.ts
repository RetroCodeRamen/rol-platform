/**
 * Centralized App-Wide Message Handler for Ramen Online
 * 
 * All app behavior should use this handler instead of raw browser events.
 * This provides a single source of truth for app-wide communication.
 */

export type MessageType =
  // IM Events
  | 'IM_NEW_MESSAGE'
  | 'IM_SENT'
  | 'IM_WINDOW_OPEN'
  | 'IM_WINDOW_CLOSE'
  | 'IM_WINDOW_FOCUS'
  // Buddy Events
  | 'BUDDY_ONLINE'
  | 'BUDDY_OFFLINE'
  | 'BUDDY_STATUS_CHANGE'
  | 'BUDDY_BLOCKED'
  | 'BUDDY_UNBLOCKED'
  | 'BUDDY_ADDED'
  | 'BUDDY_REMOVED'
  // Channel Events
  | 'CHANNEL_JOIN'
  | 'CHANNEL_LEAVE'
  | 'CHANNEL_MESSAGE'
  // Navigation Events
  | 'NAVIGATE_INTERNAL'
  | 'NAVIGATE_EXTERNAL'
  // System Events
  | 'SYSTEM_ALERT'
  | 'SYSTEM_CONFIRM'
  | 'SYSTEM_NOTIFICATION'
  // Browser Events
  | 'BROWSER_PAGE_LOADED'
  | 'BROWSER_PAGE_ERROR'
  | 'BROWSER_IFRAME_BLOCKED'
  | 'BROWSER_NAVIGATE'
  // Window Events
  | 'WINDOW_OPENED'
  | 'WINDOW_CLOSED'
  | 'WINDOW_MINIMIZED'
  | 'WINDOW_RESTORED'
  // Shortcut Events
  | 'SHORTCUT_CREATED'
  | 'SHORTCUT_OPENED'
  // Favorites Events
  | 'FAVORITE_ADDED'
  | 'FAVORITE_REMOVED';

export interface MessagePayload {
  [key: string]: any;
}

type MessageCallback = (payload: MessagePayload) => void;

class AppMessageHandlerClass {
  private subscribers: Map<MessageType, Set<MessageCallback>> = new Map();
  private messageHistory: Array<{ type: MessageType; payload: MessagePayload; timestamp: number }> = [];
  private maxHistorySize = 100;

  /**
   * Dispatch a message to all subscribers
   */
  dispatch(type: MessageType, payload: MessagePayload = {}): void {
    // Add to history
    this.messageHistory.push({
      type,
      payload,
      timestamp: Date.now(),
    });

    // Trim history if too large
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift();
    }

    // Notify all subscribers
    const callbacks = this.subscribers.get(type);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`[AppMessageHandler] Error in callback for ${type}:`, error);
        }
      });
    }

    // Also notify wildcard subscribers (for debugging/monitoring)
    const wildcardCallbacks = this.subscribers.get('*' as MessageType);
    if (wildcardCallbacks) {
      wildcardCallbacks.forEach((callback) => {
        try {
          callback({ type, ...payload });
        } catch (error) {
          console.error(`[AppMessageHandler] Error in wildcard callback:`, error);
        }
      });
    }
  }

  /**
   * Subscribe to a message type
   * @returns Unsubscribe function
   */
  subscribe(type: MessageType, callback: MessageCallback): () => void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }

    this.subscribers.get(type)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(type);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscribers.delete(type);
        }
      }
    };
  }

  /**
   * Subscribe to multiple message types
   */
  subscribeMultiple(types: MessageType[], callback: MessageCallback): () => void {
    const unsubscribers = types.map((type) => this.subscribe(type, callback));
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }

  /**
   * Get message history (for debugging)
   */
  getHistory(): Array<{ type: MessageType; payload: MessagePayload; timestamp: number }> {
    return [...this.messageHistory];
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = [];
  }

  /**
   * Get subscriber count for a message type (for debugging)
   */
  getSubscriberCount(type: MessageType): number {
    return this.subscribers.get(type)?.size || 0;
  }
}

// Export singleton instance
export const AppMessageHandler = new AppMessageHandlerClass();

// Export convenience functions
export const dispatchMessage = (type: MessageType, payload?: MessagePayload) => {
  AppMessageHandler.dispatch(type, payload || {});
};

export const subscribeToMessage = (type: MessageType, callback: MessageCallback) => {
  return AppMessageHandler.subscribe(type, callback);
};

