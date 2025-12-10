'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/state/store';
import { mailService } from '@/services/MailService';
import { notificationService } from '@/services/NotificationService';
import type { IMessage } from '@/services/MailService';
import MessageView from './MessageView';
import ComposeView from './ComposeView';
import FilterManager from './FilterManager';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<IMessage[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [searchField, setSearchField] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  
  const messages = useAppStore((state) => state.messages);
  const setMessages = useAppStore((state) => state.setMessages);
  const updateMessage = useAppStore((state) => state.updateMessage);
  const currentUser = useAppStore((state) => state.currentUser);

  useEffect(() => {
    if (!searchQuery.trim()) {
      loadFolder();
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [currentFolder, searchQuery]);

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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    
    // Allow search even without query if date range is specified
    if (!query && !fromDate && !toDate) {
      setSearchResults([]);
      setIsSearching(false);
      await loadFolder();
      return;
    }

    setIsSearching(true);
    try {
      // Build search URL with advanced options
      const params = new URLSearchParams({ q: query || '' });
      if (currentFolder) {
        params.append('folder', currentFolder);
      }
      if (searchField && searchField !== 'all') {
        params.append('field', searchField);
      }
      if (fromDate) {
        params.append('fromDate', fromDate);
      }
      if (toDate) {
        params.append('toDate', toDate);
      }

      const response = await fetch(`/api/mail/search?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Search failed');
      }
      setSearchResults(
        data.messages.map((msg: any) => ({
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
        }))
      );
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    setSearchField('all');
    setFromDate('');
    setToDate('');
    setShowAdvancedSearch(false);
    loadFolder();
  };

  const folderMessages = messages.filter((msg) => msg.folder === currentFolder);
  const unreadCount = folderMessages.filter((msg) => !msg.read).length;
  
  // Use search results if searching, otherwise use folder messages
  const displayMessages = isSearching || searchResults.length > 0 ? searchResults : folderMessages;

  if (showFilters) {
    return <FilterManager onClose={() => setShowFilters(false)} />;
  }

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
          <button
            onClick={() => setShowFilters(true)}
            className="px-2 py-0.5 bg-gray-200 text-gray-900 text-xs font-semibold border border-gray-400 hover:bg-gray-300"
            style={{ boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)' }}
          >
            Filters
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-2 py-1.5 border-b border-blue-300" style={{ backgroundColor: '#cce5ff' }}>
        <form onSubmit={handleSearch} className="space-y-2">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search mail..."
              className="flex-1 px-2 py-1 text-xs border border-gray-400 rounded bg-white"
              style={{ boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.1)' }}
            />
            <button
              type="submit"
              disabled={isSearching || (!searchQuery.trim() && !fromDate && !toDate)}
              className="px-2 py-1 bg-gray-200 text-gray-900 text-xs font-semibold border border-gray-400 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)' }}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
            <button
              type="button"
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              className="px-2 py-1 bg-gray-200 text-gray-900 text-xs font-semibold border border-gray-400 hover:bg-gray-300"
              style={{ boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)' }}
            >
              {showAdvancedSearch ? 'Simple' : 'Advanced'}
            </button>
            {(searchQuery.trim() || searchResults.length > 0 || fromDate || toDate) && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-2 py-1 bg-red-200 text-red-800 text-xs font-semibold border border-red-400 hover:bg-red-300"
                style={{ boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)' }}
              >
                Clear
              </button>
            )}
          </div>
          {showAdvancedSearch && (
            <div className="flex gap-2 items-center flex-wrap">
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-700">Field:</label>
                <select
                  value={searchField}
                  onChange={(e) => setSearchField(e.target.value)}
                  className="px-1 py-0.5 text-xs border border-gray-400 rounded bg-white"
                >
                  <option value="all">All Fields</option>
                  <option value="from">From</option>
                  <option value="to">To</option>
                  <option value="subject">Subject</option>
                  <option value="body">Body</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-700">From:</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-1 py-0.5 text-xs border border-gray-400 rounded bg-white"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-700">To:</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-1 py-0.5 text-xs border border-gray-400 rounded bg-white"
                />
              </div>
            </div>
          )}
        </form>
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
        {isSearching ? (
          <div className="p-4 text-center text-gray-500">Searching...</div>
        ) : isLoading && displayMessages.length === 0 ? (
          <div className="p-4 text-center text-gray-500">Loading...</div>
        ) : displayMessages.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchQuery.trim() ? `No results found for "${searchQuery}"` : `No messages in ${currentFolder}`}
          </div>
        ) : (
          <div className="divide-y divide-gray-300">
            {searchQuery.trim() && searchResults.length > 0 && (
              <div className="px-3 py-2 bg-yellow-50 border-b border-yellow-200 text-xs text-gray-700">
                Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
              </div>
            )}
            {displayMessages.map((message) => (
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

