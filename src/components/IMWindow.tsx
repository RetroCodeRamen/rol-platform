'use client';

import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/state/store';
import { chatService } from '@/services/ChatService';
import { notificationService } from '@/services/NotificationService';
import { getSocket } from '@/lib/websocket/client';
import { SoundService } from '@/services/SoundService';
import type { IIMMessage, IIMThread, IFileAttachment } from '@/services/ChatService';
import type { Window } from '@/state/store';

interface IMWindowProps {
  window?: Window;
}

export default function IMWindow({ window }: IMWindowProps) {
  if (!window || !window.participant) {
    return <div className="p-4">No participant selected</div>;
  }
  const participant = window.participant; // Get participant from window props
  const [currentThread, setCurrentThread] = useState<IIMThread | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [textColor, setTextColor] = useState('#000000');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<IFileAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUser = useAppStore((state) => state.currentUser);
  const updateIMThread = useAppStore((state) => state.updateIMThread);
  const openWindow = useAppStore((state) => state.openWindow);

  // Update window title format: MyScreenName : BuddyName - Instant Message
  useEffect(() => {
    if (participant && currentUser) {
      const title = `${currentUser.screenName || currentUser.username} : ${participant} - Instant Message`;
      const updateWindow = useAppStore.getState().updateWindow;
      updateWindow(window.id, { title });
    }
  }, [participant, currentUser, window.id]);

  // Load thread for this participant
  useEffect(() => {
    if (participant) {
      loadThread();
    }
  }, [participant]);

  useEffect(() => {
    scrollToBottom();
  }, [currentThread?.messages]);

  // Set up WebSocket listeners for real-time messaging
  useEffect(() => {
    if (!participant) return;
    
    const socket = getSocket();
    if (!socket) return;

    // Listen for new incoming messages
    const handleNewMessage = (message: IIMMessage) => {
      // Only handle messages for this participant
      if (message.from === participant) {
        // Play sound notification
        SoundService.play('new_im');
        
        // Reload thread to show new message
        loadThread();
        
        // Show notification
        notificationService.notifyNewIM(message, currentUser?.username || '');
      }
    };

    // Listen for sent message confirmation
    const handleSentMessage = (message: IIMMessage) => {
      // Reload thread if this message is for current participant
      if (message.to === participant) {
        loadThread();
      }
    };

    socket.on('im:new', handleNewMessage);
    socket.on('im:sent', handleSentMessage);

    return () => {
      socket.off('im:new', handleNewMessage);
      socket.off('im:sent', handleSentMessage);
    };
  }, [participant, currentUser]);

  const loadThread = async () => {
    if (!participant) return;
    setIsLoading(true);
    try {
      const thread = await chatService.getIMThread(participant);
      if (thread) {
        setCurrentThread(thread);
        // Mark as read when viewing
        updateIMThread(thread.id, { unreadCount: 0 });
      } else {
        // Create empty thread if none exists
        setCurrentThread({
          id: `thread_${participant}`,
          participant,
          messages: [],
          unreadCount: 0,
        });
      }
    } catch (error) {
      console.error('Failed to load thread:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/im/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setPendingAttachments([...pendingAttachments, data.attachment]);
      } else {
        alert(data.error || 'Failed to upload file');
      }
    } catch (error) {
      console.error('File upload error:', error);
      alert('Failed to upload file');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (attachmentId: string) => {
    setPendingAttachments(pendingAttachments.filter(a => a.id !== attachmentId));
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputMessage.trim() && pendingAttachments.length === 0) || !participant || !currentUser) return;

    const messageText = inputMessage.trim();
    const attachmentIds = pendingAttachments.map(a => a.id);
    setInputMessage('');
    setPendingAttachments([]);

    try {
      // Try WebSocket first for real-time delivery
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('im:send', {
          to: participant,
          message: messageText,
          attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
        });
        // Message will be confirmed via 'im:sent' event
      } else {
        // Fallback to REST API
        await chatService.sendIMMessage(participant, messageText, currentUser.username, attachmentIds.length > 0 ? attachmentIds : undefined);
        loadThread();
      }
    } catch (error) {
      console.error('Failed to send IM:', error);
      // Restore message on error
      setInputMessage(messageText);
      setPendingAttachments(pendingAttachments);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleBlock = async () => {
    if (!participant || !currentUser) return;
    
    try {
      const response = await fetch('/api/im/buddies/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: participant }),
      });
      
      const data = await response.json();
      if (data.success) {
        alert(`${participant} has been blocked.`);
        // Optionally close the IM window
        const closeWindow = useAppStore.getState().closeWindow;
        closeWindow(window.id);
      } else {
        alert(data.error || 'Failed to block user');
      }
    } catch (error) {
      console.error('Failed to block user:', error);
      alert('Failed to block user');
    }
  };

  const handleWarn = () => {
    // TODO: Implement warn functionality
    console.log('Warn user:', participant);
  };

  const handleViewProfile = () => {
    if (!participant) return;
    openWindow('profile', `Profile: ${participant}`, {
      username: participant,
    });
  };

  if (!participant) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        No participant specified
      </div>
    );
  }

  const myScreenName = currentUser?.screenName || currentUser?.username || 'You';
  const buddyScreenName = participant;

  return (
    <div className="h-full w-full flex flex-col" style={{ backgroundColor: '#ffffff' }}>
      {/* Menu Bar */}
      <div className="bg-gray-200 border-b border-gray-400 px-2 py-1 flex items-center" style={{ fontSize: '11px', fontFamily: 'Tahoma, Arial, sans-serif' }}>
        <span className="px-2 hover:bg-gray-300 cursor-pointer">File</span>
        <span className="px-2 hover:bg-gray-300 cursor-pointer">Edit</span>
        <span className="px-2 hover:bg-gray-300 cursor-pointer">Insert</span>
        <span className="px-2 hover:bg-gray-300 cursor-pointer">People</span>
        <div className="flex-1"></div>
        <span className="text-gray-600 text-xs">{buddyScreenName}'s Warning Level: 0%</span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        {/* Left Sidebar - Buddy Icons */}
        <div className="w-24 flex flex-col border-r border-gray-400" style={{
          background: 'linear-gradient(135deg, #b3d9ff 0%, #80c0ff 50%, #4da6ff 100%)',
        }}>
          {/* Remote User Avatar */}
          <div className="flex-1 flex items-center justify-center p-2 border-b border-gray-400">
            <div className="w-16 h-16 bg-white border-2 border-gray-400 rounded flex items-center justify-center shadow-inner" style={{
              boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.2)',
            }}>
              <span className="text-3xl">👤</span>
            </div>
          </div>
          
          {/* Local User Avatar */}
          <div className="flex-1 flex items-center justify-center p-2">
            <div className="w-16 h-16 bg-white border-2 border-gray-400 rounded flex items-center justify-center shadow-inner" style={{
              boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.2)',
            }}>
              <span className="text-3xl">👤</span>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col" style={{ minWidth: 0 }}>
          {/* Transcript Area */}
          <div 
            ref={messagesEndRef}
            className="flex-1 overflow-y-auto p-3 bg-white retro-scrollbar"
            style={{ 
              fontFamily: 'Tahoma, Arial, sans-serif',
              fontSize: '11px',
              lineHeight: '1.4',
            }}
          >
            {isLoading ? (
              <div className="text-center text-gray-500">Loading messages...</div>
            ) : currentThread && currentThread.messages.length > 0 ? (
              <div className="space-y-1">
                {currentThread.messages.map((msg) => {
                  const isFromMe = msg.from === currentUser?.username;
                  const displayName = isFromMe ? myScreenName : buddyScreenName;
                  const nameColor = isFromMe ? '#cc0000' : '#0000cc'; // Red for me, blue for buddy
                  
                  return (
                    <div key={msg.id} className="flex flex-col items-start mb-2">
                      <div className="flex items-start w-full">
                        <span 
                          className="font-semibold mr-2"
                          style={{ color: nameColor }}
                        >
                          {displayName}:
                        </span>
                        <span className="text-gray-900 flex-1">{msg.message || ''}</span>
                      </div>
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="ml-8 mt-1 flex flex-col gap-1">
                          {msg.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={`/api/im/attachment/${att.id}`}
                              download={att.filename}
                              className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                            >
                              📎 {att.filename} ({formatFileSize(att.size)})
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="text-center text-gray-500 mt-8">
                No messages yet. Start chatting with {buddyScreenName}!
              </div>
            )}
          </div>

          {/* Formatting Toolbar */}
          <div className="bg-gray-200 border-t border-b border-gray-400 px-2 py-1 flex items-center gap-1" style={{
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
          }}>
            {/* Font Name */}
            <div className="flex items-center border border-gray-400 bg-white px-1" style={{ fontSize: '10px' }}>
              <span className="mr-1">A</span>
              <select className="text-xs border-0 bg-transparent focus:outline-none" style={{ fontSize: '10px' }}>
                <option>Arial</option>
                <option>Times New Roman</option>
                <option>Tahoma</option>
                <option>Verdana</option>
              </select>
            </div>

            {/* Font Size */}
            <div className="flex items-center border border-gray-400 bg-white px-1" style={{ fontSize: '10px' }}>
              <select className="text-xs border-0 bg-transparent focus:outline-none" style={{ fontSize: '10px' }}>
                <option>8</option>
                <option>9</option>
                <option>10</option>
                <option>11</option>
                <option>12</option>
                <option>14</option>
                <option>16</option>
              </select>
            </div>

            {/* Text Color */}
            <button
              onClick={() => {
                const color = prompt('Enter color (hex or name):', textColor);
                if (color) setTextColor(color);
              }}
              className="border border-gray-400 bg-white px-2 py-1 hover:bg-gray-100 text-xs"
              style={{ fontSize: '10px' }}
              title="Text Color"
            >
              A
            </button>

            {/* Bold */}
            <button
              onClick={() => setIsBold(!isBold)}
              className={`border border-gray-400 px-2 py-1 text-xs font-bold hover:bg-gray-100 ${
                isBold ? 'bg-gray-300' : 'bg-white'
              }`}
              style={{ fontSize: '10px' }}
              title="Bold"
            >
              B
            </button>

            {/* Italic */}
            <button
              onClick={() => setIsItalic(!isItalic)}
              className={`border border-gray-400 px-2 py-1 text-xs italic hover:bg-gray-100 ${
                isItalic ? 'bg-gray-300' : 'bg-white'
              }`}
              style={{ fontSize: '10px' }}
              title="Italic"
            >
              I
            </button>

            {/* Underline */}
            <button
              onClick={() => setIsUnderline(!isUnderline)}
              className={`border border-gray-400 px-2 py-1 text-xs hover:bg-gray-100 ${
                isUnderline ? 'bg-gray-300 underline' : 'bg-white'
              }`}
              style={{ fontSize: '10px' }}
              title="Underline"
            >
              U
            </button>

            {/* Link */}
            <button
              className="border border-gray-400 bg-white px-2 py-1 hover:bg-gray-100 text-xs"
              style={{ fontSize: '10px' }}
              title="Insert Link"
            >
              🔗
            </button>

            {/* Emoji */}
            <button
              className="border border-gray-400 bg-white px-2 py-1 hover:bg-gray-100 text-xs"
              style={{ fontSize: '10px' }}
              title="Emoji"
            >
              😊
            </button>

            {/* Insert Image */}
            <button
              className="border border-gray-400 bg-white px-2 py-1 hover:bg-gray-100 text-xs"
              style={{ fontSize: '10px' }}
              title="Insert Image"
            >
              🖼️
            </button>

            {/* Attach File */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="border border-gray-400 bg-white px-2 py-1 hover:bg-gray-100 text-xs disabled:opacity-50"
              style={{ fontSize: '10px' }}
              title="Attach File"
            >
              📎
            </button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              multiple={false}
            />
          </div>

          {/* Pending Attachments */}
          {pendingAttachments.length > 0 && (
            <div className="px-2 py-1 bg-gray-100 border-t border-gray-300 flex flex-wrap gap-2">
              {pendingAttachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1 bg-white border border-gray-400 px-2 py-1 text-xs"
                >
                  <span>📎 {att.filename} ({formatFileSize(att.size)})</span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="text-red-600 hover:text-red-800 ml-1"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="p-2 bg-white border-t border-gray-400">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="w-full p-2 border border-gray-400 bg-white text-gray-900 resize-none focus:outline-none"
              style={{ 
                fontFamily: 'Tahoma, Arial, sans-serif',
                fontSize: '11px',
                minHeight: '60px',
                boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.1)',
              }}
              placeholder={`Type a message to ${buddyScreenName}...`}
            />
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-gray-300 border-t border-gray-500 px-2 py-2 flex items-center justify-between" style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
      }}>
        <div className="flex items-center gap-2">
          {/* Warn Button */}
          <button
            onClick={handleWarn}
            className="flex flex-col items-center px-2 py-1 bg-white border border-gray-400 hover:bg-gray-100 active:bg-gray-200"
            style={{
              boxShadow: 'inset -1px -1px 0 rgba(0,0,0,0.2), inset 1px 1px 0 rgba(255,255,255,0.5)',
            }}
            title="Warn"
          >
            <span className="text-lg mb-1">⚠️</span>
            <span className="text-xs" style={{ fontSize: '9px' }}>Warn</span>
          </button>

          {/* Block Button */}
          <button
            onClick={handleBlock}
            className="flex flex-col items-center px-2 py-1 bg-white border border-gray-400 hover:bg-gray-100 active:bg-gray-200"
            style={{
              boxShadow: 'inset -1px -1px 0 rgba(0,0,0,0.2), inset 1px 1px 0 rgba(255,255,255,0.5)',
            }}
            title="Block"
          >
            <span className="text-lg mb-1">🚫</span>
            <span className="text-xs" style={{ fontSize: '9px' }}>Block</span>
          </button>

          {/* Expressions Button */}
          <button
            className="flex flex-col items-center px-2 py-1 bg-white border border-gray-400 hover:bg-gray-100 active:bg-gray-200"
            style={{
              boxShadow: 'inset -1px -1px 0 rgba(0,0,0,0.2), inset 1px 1px 0 rgba(255,255,255,0.5)',
            }}
            title="Expressions"
          >
            <span className="text-lg mb-1">😊</span>
            <span className="text-xs" style={{ fontSize: '9px' }}>Expressions</span>
          </button>

          {/* Games Button */}
          <button
            className="flex flex-col items-center px-2 py-1 bg-white border border-gray-400 hover:bg-gray-100 active:bg-gray-200"
            style={{
              boxShadow: 'inset -1px -1px 0 rgba(0,0,0,0.2), inset 1px 1px 0 rgba(255,255,255,0.5)',
            }}
            title="Games"
          >
            <span className="text-lg mb-1">🎮</span>
            <span className="text-xs" style={{ fontSize: '9px' }}>Games</span>
          </button>

          {/* Profile Button */}
          <button
            onClick={handleViewProfile}
            className="flex flex-col items-center px-2 py-1 bg-white border border-gray-400 hover:bg-gray-100 active:bg-gray-200"
            style={{
              boxShadow: 'inset -1px -1px 0 rgba(0,0,0,0.2), inset 1px 1px 0 rgba(255,255,255,0.5)',
            }}
            title="View Profile"
          >
            <span className="text-lg mb-1">👤</span>
            <span className="text-xs" style={{ fontSize: '9px' }}>Profile</span>
          </button>
        </div>

        {/* Send Button */}
        <button
          onClick={() => handleSendMessage()}
          disabled={!inputMessage.trim() && pendingAttachments.length === 0}
          className="flex flex-col items-center px-4 py-1 bg-green-500 text-white border border-green-600 hover:bg-green-600 active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            boxShadow: 'inset -1px -1px 0 rgba(0,0,0,0.2), inset 1px 1px 0 rgba(255,255,255,0.3)',
          }}
          title="Send"
        >
          <span className="text-lg mb-1">📤</span>
          <span className="text-xs font-semibold" style={{ fontSize: '9px' }}>Send</span>
        </button>
      </div>
    </div>
  );
}
