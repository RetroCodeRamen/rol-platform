'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/state/store';
import { mailService } from '@/services/MailService';
import { notificationService } from '@/services/NotificationService';
import type { IMessage } from '@/services/MailService';
import MessageView from './MessageView';
import ComposeView from './ComposeView';

type Folder = 'Inbox' | 'Sent' | 'Drafts' | 'Trash';
type ViewMode = 'list' | 'message' | 'compose';

export default function MailboxView() {
  const [currentFolder, setCurrentFolder] = useState<Folder>('Inbox');
  // Check sessionStorage for initial view mode (set by Write button)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const savedMode = sessionStorage.getItem('mailViewMode');
      if (savedMode === 'compose') {
        sessionStorage.removeItem('mailViewMode'); // Clear after reading
        return 'compose';
      }
    }
    return 'list';
  });
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const messages = useAppStore((state) => state.messages);
  const setMessages = useAppStore((state) => state.setMessages);
  const updateMessage = useAppStore((state) => state.updateMessage);
  const currentUser = useAppStore((state) => state.currentUser);

  useEffect(() => {
    loadFolder();
  }, [currentFolder]);

  useEffect(() => {
    // Check for new mail and trigger notifications
    notificationService.checkNewMail(messages);
  }, [messages]);

  const loadFolder = async () => {
    setIsLoading(true);
    try {
      const folderMessages = await mailService.getFolder(currentFolder);
      // Replace all messages - API returns all messages for the current folder
      // We only show messages for the current folder anyway, so this is fine
      setMessages(folderMessages);
    } catch (error) {
      console.error('Failed to load folder:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMessageClick = async (messageId: string) => {
    setSelectedMessageId(messageId);
    setViewMode('message');
    await mailService.markRead(messageId, true);
    updateMessage(messageId, { read: true });
  };

  const handleFetchNewMail = async () => {
    // Reload current folder to fetch new mail
    await loadFolder();
  };

  const folderMessages = messages.filter((msg) => msg.folder === currentFolder);
  const unreadCount = folderMessages.filter((msg) => !msg.read).length;

  if (viewMode === 'compose') {
    return <ComposeView onClose={() => {
      setViewMode('list');
      sessionStorage.removeItem('mailViewMode'); // Clear when closing compose
    }} />;
  }

  if (viewMode === 'message' && selectedMessageId) {
    const message = messages.find((m) => m.id === selectedMessageId);
    if (message) {
      return (
        <MessageView
          message={message}
          onBack={() => {
            setViewMode('list');
            setSelectedMessageId(null);
          }}
        />
      );
    }
  }

  return (
    <div className="h-full w-full flex flex-col" style={{ backgroundColor: '#e6f2ff' }}>
      {/* Header */}
      <div className="px-2 py-1 flex items-center justify-between border-b border-blue-400" style={{ background: 'linear-gradient(to bottom, #0066cc, #4a0080)' }}>
        <h2 className="text-white font-bold">Mail</h2>
        <div className="flex gap-2">
          <button
            onClick={handleFetchNewMail}
            disabled={isLoading}
            className="px-2 py-0.5 bg-gray-200 text-gray-900 text-xs font-semibold border border-gray-400 hover:bg-gray-300 disabled:opacity-50"
            style={{ boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)' }}
          >
            {isLoading ? 'Fetching...' : 'Get Mail'}
          </button>
          <button
            onClick={() => setViewMode('compose')}
            className="px-2 py-0.5 bg-gray-200 text-gray-900 text-xs font-semibold border border-gray-400 hover:bg-gray-300"
            style={{ boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)' }}
          >
            Compose
          </button>
        </div>
      </div>

      {/* Folder Tabs */}
      <div className="flex border-b border-blue-300" style={{ backgroundColor: '#cce5ff' }}>
        {(['Inbox', 'Sent', 'Drafts', 'Trash'] as Folder[]).map((folder) => (
          <button
            key={folder}
            onClick={() => {
              setCurrentFolder(folder);
              setViewMode('list');
            }}
            className={`px-3 py-1 text-xs font-semibold border-r border-gray-400 ${
              currentFolder === folder
                ? 'bg-gray-200 text-gray-900 border-b border-b-gray-200 -mb-[1px]'
                : 'text-gray-700 hover:bg-gray-300'
            }`}
          >
            {folder}
            {folder === 'Inbox' && unreadCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto retro-scrollbar">
        {isLoading && folderMessages.length === 0 ? (
          <div className="p-4 text-center text-gray-500">Loading...</div>
        ) : folderMessages.length === 0 ? (
          <div className="p-4 text-center text-gray-500">No messages in {currentFolder}</div>
        ) : (
          <div className="divide-y divide-gray-300">
            {folderMessages.map((message) => (
              <button
                key={message.id}
                onClick={() => handleMessageClick(message.id)}
                className={`w-full text-left p-3 hover:bg-blue-50 ${
                  !message.read ? 'bg-blue-50 font-semibold' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {currentFolder === 'Inbox' ? message.from : message.to}
                      </span>
                      {!message.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full" />
                      )}
                    </div>
                    <div className="text-sm text-gray-700 mt-1 truncate">{message.subject}</div>
                  </div>
                  <div className="text-xs text-gray-500 ml-4">
                    {new Date(message.date).toLocaleDateString()}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

