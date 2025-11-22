import { create } from 'zustand';
import type { IUser } from '@/services/AuthService';
import type { IMessage } from '@/services/MailService';
import type { IBuddy, IIMThread } from '@/services/ChatService';
import { mockMessages } from './mockData';

export type WindowType = 'mail' | 'im' | 'chat' | 'forums' | 'buddylist' | 'channels' | 'web' | 'welcome' | 'weather' | 'dialog' | 'buddyrequest' | 'profile' | 'settings';

export interface Window {
  id: string;
  type: WindowType;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isMinimized: boolean;
  isMaximized?: boolean;
  participant?: string; // For IM windows - username of the other participant
  username?: string; // For profile windows - username to view
  // Dialog-specific props
  dialogProps?: {
    message?: string;
    inputLabel?: string;
    inputPlaceholder?: string;
    inputValue?: string;
    onConfirm: (value?: string) => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    showInput?: boolean;
  };
  // Buddy request props
  buddyRequestProps?: {
    requesterUsername: string;
    requestId: string;
    onAccept: () => void;
    onIgnore: () => void;
  };
}

interface AppState {
  // User
  currentUser: IUser | null;
  setCurrentUser: (user: IUser | null) => void;

  // Mail
  messages: IMessage[];
  setMessages: (messages: IMessage[]) => void;
  addMessage: (message: IMessage) => void;
  updateMessage: (id: string, updates: Partial<IMessage>) => void;

  // Buddies
  buddies: IBuddy[];
  setBuddies: (buddies: IBuddy[]) => void;

  // IM Threads
  imThreads: IIMThread[];
  setIMThreads: (threads: IIMThread[]) => void;
  updateIMThread: (threadId: string, updates: Partial<IIMThread>) => void;

  // Window Management
  windows: Window[];
  nextZIndex: number;
  openWindow: (type: WindowType, title: string, options?: Partial<Window>) => string; // Returns window ID
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  bringToFront: (id: string) => void;
  updateWindow: (id: string, updates: Partial<Window>) => void;
  getWindowByType: (type: WindowType) => Window | undefined;

  // UI State (kept for compatibility, but windows are primary)
  activeView: 'mail' | 'im' | 'chat' | 'channels' | 'forums' | null;
  setActiveView: (view: AppState['activeView']) => void;
  activeIMThread: string | null;
  setActiveIMThread: (threadId: string | null) => void;
  activeChatRoom: string | null;
  setActiveChatRoom: (roomId: string | null) => void;
  activeChannel: string | null;
  setActiveChannel: (channel: string | null) => void;

  // Reset state on logout
  reset: () => void;
}

// Default window positions and sizes
const DEFAULT_WINDOWS: Record<WindowType, Partial<Window>> = {
  mail: { width: 700, height: 500, x: 50, y: 50 },
  im: { width: 500, height: 400, x: 100, y: 100 },
  chat: { width: 600, height: 450, x: 150, y: 80 },
  forums: { width: 650, height: 500, x: 80, y: 120 },
  buddylist: { width: 200, height: 400, x: 20, y: 100 },
  channels: { width: 550, height: 400, x: 120, y: 100 },
  web: { width: 700, height: 500, x: 60, y: 60 },
  welcome: { width: 500, height: 400, x: 150, y: 100 },
  weather: { width: 500, height: 450, x: 100, y: 100 },
  dialog: { width: 400, height: 200, x: 200, y: 200 },
  buddyrequest: { width: 400, height: 200, x: 200, y: 200 },
  profile: { width: 500, height: 500, x: 150, y: 100 },
  settings: { width: 600, height: 500, x: 150, y: 100 },
};

const initialState = {
  currentUser: null,
  messages: [], // Start with empty array - messages will be loaded from API
  buddies: [],
  imThreads: [],
  windows: [] as Window[],
  nextZIndex: 1000,
  activeView: null,
  activeIMThread: null,
  activeChatRoom: null,
  activeChannel: null,
};

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  setCurrentUser: (user) => set({ currentUser: user }),

  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg)),
    })),

  setBuddies: (buddies) => set({ buddies }),
  setIMThreads: (threads) => set({ imThreads: threads }),
  updateIMThread: (threadId, updates) =>
    set((state) => ({
      imThreads: state.imThreads.map((thread) =>
        thread.id === threadId ? { ...thread, ...updates } : thread
      ),
    })),

  openWindow: (type, title, options = {}) => {
    const state = get();
    
    // Use window registry to check for singleton/unique windows
    // Dynamic import to avoid circular dependency
    const { getWindowConfig } = require('@/lib/windows/WindowRegistry');
    const config = getWindowConfig(type);
    
    // Special handling for singleton windows (like buddylist)
    if (config?.singleton) {
      const existing = state.windows.find((w) => w.type === type);
      if (existing) {
        get().bringToFront(existing.id);
        return existing.id;
      }
    }
    
    // Special handling for unique-by-participant windows (like IM)
    if (config?.uniqueBy && options[config.uniqueBy as keyof typeof options]) {
      const uniqueByKey = config.uniqueBy as keyof Window;
      const uniqueByValue = options[config.uniqueBy as keyof typeof options];
      const existing = state.windows.find(
        (w) => w.type === type && (w as any)[uniqueByKey] === uniqueByValue
      );
      if (existing) {
        get().bringToFront(existing.id);
        return existing.id;
      }
    }
    
    // Use registry defaults if available, otherwise fall back to DEFAULT_WINDOWS
    const defaults = config?.defaultSize || DEFAULT_WINDOWS[type] || {};
    const newWindow: Window = {
      id: `window_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      x: options.x ?? defaults.x ?? 100,
      y: options.y ?? defaults.y ?? 100,
      width: options.width ?? defaults.width ?? 500,
      height: options.height ?? defaults.height ?? 400,
      zIndex: state.nextZIndex,
      isMinimized: false,
      ...options,
    };

    set({
      windows: [...state.windows, newWindow],
      nextZIndex: state.nextZIndex + 1,
    });
    
    return newWindow.id;
  },

  closeWindow: (id) => {
    set((state) => ({
      windows: state.windows.filter((w) => w.id !== id),
    }));
  },

  minimizeWindow: (id) => {
    set((state) => ({
      windows: state.windows.map((w) => (w.id === id ? { ...w, isMinimized: true } : w)),
    }));
  },

  restoreWindow: (id) => {
    set((state) => ({
      windows: state.windows.map((w) => (w.id === id ? { ...w, isMinimized: false } : w)),
      nextZIndex: state.nextZIndex + 1,
    }));
    get().bringToFront(id);
  },

  bringToFront: (id) => {
    const state = get();
    set({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, zIndex: state.nextZIndex, isMinimized: false } : w
      ),
      nextZIndex: state.nextZIndex + 1,
    });
  },

  updateWindow: (id, updates) => {
    set((state) => ({
      windows: state.windows.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    }));
  },

  getWindowByType: (type) => {
    return get().windows.find((w) => w.type === type);
  },

  setActiveView: (view) => set({ activeView: view }),
  setActiveIMThread: (threadId) => set({ activeIMThread: threadId }),
  setActiveChatRoom: (roomId) => set({ activeChatRoom: roomId }),
  setActiveChannel: (channel) => set({ activeChannel: channel }),

  reset: () => set(initialState),
}));

