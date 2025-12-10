export interface IAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface IMessage {
  id: string;
  folder: 'Inbox' | 'Sent' | 'Drafts' | 'Trash';
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  date: string;
  read: boolean;
  attachments?: IAttachment[];
  hasAttachments?: boolean; // For list view - indicates if message has attachments
  attachmentCount?: number; // Number of attachments
}

export interface IFolderInfo {
  name: 'Inbox' | 'Sent' | 'Drafts' | 'Trash';
  totalCount: number;
  unreadCount: number;
}

export interface IMailFilter {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    field: 'from' | 'to' | 'subject' | 'body';
    operator: 'contains' | 'equals' | 'startsWith' | 'endsWith';
    value: string;
  }[];
  actions: {
    moveToFolder?: 'Inbox' | 'Sent' | 'Drafts' | 'Trash';
    markAsRead?: boolean;
    delete?: boolean;
  };
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface IMailService {
  getFolders(): Promise<IFolderInfo[]>;
  getFolder(folder: IMessage['folder']): Promise<IMessage[]>;
  getMessage(id: string): Promise<IMessage | null>;
  sendMessage(message: Omit<IMessage, 'id' | 'date' | 'read' | 'folder'>): Promise<IMessage>;
  markRead(id: string, read: boolean): Promise<void>;
  moveToFolder(id: string, folder: IMessage['folder']): Promise<void>;
  search(query: string, folder?: IMessage['folder']): Promise<IMessage[]>;
  getFilters(): Promise<IMailFilter[]>;
  createFilter(filter: Omit<IMailFilter, 'id' | 'createdAt' | 'updatedAt'>): Promise<IMailFilter>;
  updateFilter(id: string, filter: Partial<IMailFilter>): Promise<IMailFilter>;
  deleteFilter(id: string): Promise<void>;
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

export class RestMailService implements IMailService {
  private apiBase = '/api/mail';

  async getFolders(): Promise<IFolderInfo[]> {
    const response = await fetchWithAuth(`${this.apiBase}/folders`);
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch folders');
    }
    return data.folders;
  }

  async getFolder(folder: IMessage['folder']): Promise<IMessage[]> {
    const response = await fetchWithAuth(`${this.apiBase}/folder/${folder}`);
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch folder');
    }
    return data.messages.map((msg: any) => ({
      id: msg.id,
      folder: msg.folder,
      from: msg.from,
      to: msg.to,
      cc: msg.cc,
      bcc: msg.bcc,
      subject: msg.subject,
      body: msg.body,
      date: msg.createdAt,
      read: msg.isRead,
      attachments: msg.attachments || [],
      hasAttachments: msg.hasAttachments || false,
      attachmentCount: msg.attachmentCount || 0,
    }));
  }

  async getMessage(id: string): Promise<IMessage | null> {
    const response = await fetchWithAuth(`${this.apiBase}/message/${id}`);
    const data = await response.json();
    if (!data.success) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(data.error || 'Failed to fetch message');
    }
    const msg = data.message;
    return {
      id: msg.id,
      folder: msg.folder,
      from: msg.from,
      to: msg.to,
      cc: msg.cc,
      bcc: msg.bcc,
      subject: msg.subject,
      body: msg.body,
      date: msg.createdAt,
      read: msg.isRead,
      attachments: msg.attachments || [],
    };
  }

  async sendMessage(message: Omit<IMessage, 'id' | 'date' | 'read' | 'folder'> & { attachmentIds?: string[] }): Promise<IMessage> {
    const response = await fetchWithAuth(`${this.apiBase}/send`, {
      method: 'POST',
      body: JSON.stringify({
        to: message.to,
        cc: message.cc,
        bcc: message.bcc,
        subject: message.subject,
        body: message.body,
        attachmentIds: (message as any).attachmentIds || [],
      }),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to send message');
    }
    const msg = data.message;
    return {
      id: msg.id,
      folder: 'Sent',
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      body: message.body,
      date: msg.createdAt,
      read: true,
    };
  }

  async markRead(id: string, read: boolean): Promise<void> {
    if (!read) {
      // For unread, we'd need a separate endpoint or handle it differently
      // For now, only support marking as read
      return;
    }
    const response = await fetchWithAuth(`${this.apiBase}/message/${id}/read`, {
      method: 'POST',
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to mark message as read');
    }
  }

  async moveToFolder(id: string, folder: IMessage['folder']): Promise<void> {
    const response = await fetchWithAuth(`${this.apiBase}/message/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ folder }),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to move message');
    }
  }

  async search(query: string, folder?: IMessage['folder']): Promise<IMessage[]> {
    const params = new URLSearchParams({ q: query });
    if (folder) {
      params.append('folder', folder);
    }
    const response = await fetchWithAuth(`${this.apiBase}/search?${params.toString()}`);
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to search messages');
    }
    return data.messages.map((msg: any) => ({
      id: msg.id,
      folder: msg.folder,
      from: msg.from,
      to: msg.to,
      cc: msg.cc,
      bcc: msg.bcc,
      subject: msg.subject,
      body: msg.body,
      date: msg.createdAt,
      read: msg.isRead,
      attachments: msg.attachments || [],
      hasAttachments: msg.hasAttachments || false,
      attachmentCount: msg.attachmentCount || 0,
    }));
  }

  async getFilters(): Promise<IMailFilter[]> {
    const response = await fetchWithAuth(`${this.apiBase}/filters`);
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch filters');
    }
    return data.filters;
  }

  async createFilter(filter: Omit<IMailFilter, 'id' | 'createdAt' | 'updatedAt'>): Promise<IMailFilter> {
    const response = await fetchWithAuth(`${this.apiBase}/filters`, {
      method: 'POST',
      body: JSON.stringify(filter),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to create filter');
    }
    return data.filter;
  }

  async updateFilter(id: string, filter: Partial<IMailFilter>): Promise<IMailFilter> {
    const response = await fetchWithAuth(`${this.apiBase}/filters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(filter),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to update filter');
    }
    return data.filter;
  }

  async deleteFilter(id: string): Promise<void> {
    const response = await fetchWithAuth(`${this.apiBase}/filters/${id}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to delete filter');
    }
  }
}

// Export singleton instance
export const mailService: IMailService = new RestMailService();
