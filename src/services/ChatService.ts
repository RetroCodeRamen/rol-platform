export interface IChatRoom {
  id: string;
  name: string;
  description: string;
  userCount: number;
}

export interface IChatMessage {
  id: string;
  roomId: string;
  from: string;
  message: string;
  timestamp: string;
}

export interface IBuddy {
  id: string;
  username: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  lastSeen?: string;
}

export interface IIMThread {
  id: string;
  participant: string;
  messages: IIMMessage[];
  unreadCount: number;
}

export interface IFileAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface IIMMessage {
  id: string;
  from: string;
  to: string;
  message: string;
  timestamp: string;
  attachments?: IFileAttachment[];
}

export interface IChatService {
  getChatRooms(): Promise<IChatRoom[]>;
  getRoomMessages(roomId: string): Promise<IChatMessage[]>;
  sendRoomMessage(roomId: string, message: string, from: string): Promise<IChatMessage>;
  getBuddies(): Promise<IBuddy[]>;
  addBuddy(username: string): Promise<void>;
  removeBuddy(username: string): Promise<void>;
  getIMThreads(): Promise<IIMThread[]>;
  getIMThread(participant: string): Promise<IIMThread | null>;
  sendIMMessage(to: string, message: string, from: string, attachmentIds?: string[]): Promise<IIMMessage>;
}

// Helper function to make authenticated API requests
async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Include cookies for authentication
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response;
}

export class RestChatService implements IChatService {
  private apiBase = '/api/im';

  async getChatRooms(): Promise<IChatRoom[]> {
    // Chat rooms not implemented yet - return empty array
    return [];
  }

  async getRoomMessages(roomId: string): Promise<IChatMessage[]> {
    // Chat rooms not implemented yet - return empty array
    return [];
  }

  async sendRoomMessage(roomId: string, message: string, from: string): Promise<IChatMessage> {
    // Chat rooms not implemented yet
    throw new Error('Chat rooms not implemented');
  }

  async getBuddies(): Promise<IBuddy[]> {
    const response = await fetchWithAuth(`${this.apiBase}/buddies`);
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch buddies');
    }
    return data.buddies.map((buddy: any) => ({
      id: buddy.id,
      username: buddy.username,
      status: buddy.status || 'offline',
      lastSeen: buddy.lastSeen,
    }));
  }

  async addBuddy(username: string): Promise<void> {
    const response = await fetchWithAuth(`${this.apiBase}/buddies/add`, {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to add buddy');
    }
  }

  async removeBuddy(username: string): Promise<void> {
    const response = await fetchWithAuth(`${this.apiBase}/buddies/remove`, {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to remove buddy');
    }
  }

  async getIMThreads(): Promise<IIMThread[]> {
    const response = await fetchWithAuth(`${this.apiBase}/threads`);
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch threads');
    }
    return data.threads;
  }

  async getIMThread(participant: string): Promise<IIMThread | null> {
    const response = await fetchWithAuth(`${this.apiBase}/thread/${participant}`);
    const data = await response.json();
    if (!data.success) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(data.error || 'Failed to fetch thread');
    }
    return data.thread;
  }

  async sendIMMessage(to: string, message: string, from: string, attachmentIds?: string[]): Promise<IIMMessage> {
    const response = await fetchWithAuth(`${this.apiBase}/send`, {
      method: 'POST',
      body: JSON.stringify({ to, message, attachmentIds }),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to send message');
    }
    return data.message;
  }
}

// Export singleton instance
export const chatService: IChatService = new RestChatService();
