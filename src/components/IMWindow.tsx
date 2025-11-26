'use client';

import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/state/store';
import { chatService } from '@/services/ChatService';
import { notificationService } from '@/services/NotificationService';
import { getSocket } from '@/lib/websocket/client';
import { SoundService } from '@/services/SoundService';
import { dispatchMessage } from '@/lib/messaging/AppMessageHandler';
import type { IIMMessage, IIMThread, IFileAttachment } from '@/services/ChatService';
import type { Window } from '@/state/store';

interface IMWindowProps {
  window?: Window;
}

export default function IMWindow({ window }: IMWindowProps) {
  // All hooks must be called before any conditional returns
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

  const participant = window?.participant;

  // Update window title format: MyScreenName : BuddyName - Instant Message
  useEffect(() => {
    if (participant && currentUser && window) {
      const title = `${currentUser.screenName || currentUser.username} : ${participant} - Instant Message`;
      const updateWindow = useAppStore.getState().updateWindow;
      updateWindow(window.id, { title });
    }
  }, [participant, currentUser, window?.id]);

  // Load thread for this participant
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

  useEffect(() => {
    if (participant) {
      loadThread();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant]);

  useEffect(() => {
    scrollToBottom();
  }, [currentThread?.messages]);

  // Clear unread IM flag when window is opened
  useEffect(() => {
    if (!participant) return;
    
    // Clear the unread IM flag for this participant in buddy list
    const { setBuddies, buddies } = useAppStoreDirect.getState();
    const hasUnread = buddies.some((b) => b.username === participant && b.hasUnreadIM);
    
    if (hasUnread) {
      setBuddies(
        buddies.map((buddy) => {
          if (buddy.username === participant) {
            return {
              ...buddy,
              hasUnreadIM: false,
            };
          }
          return buddy;
        })
      );
    }
  }, [participant]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant, currentUser]);

  // Early return after all hooks
  if (!window || !participant) {
    return <div className="p-4">No participant selected</div>;
  }

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
        dispatchMessage('SYSTEM_ALERT', {
          message: data.error || 'Failed to upload file',
          title: 'Upload Error',
        });
      }
    } catch (error) {
      console.error('File upload error:', error);
      dispatchMessage('SYSTEM_ALERT', {
        message: 'Failed to upload file',
        title: 'Upload Error',
      });
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
        dispatchMessage('SYSTEM_ALERT', {
          message: `${participant} has been blocked.`,
          title: 'User Blocked',
        });
        // Optionally close the IM window
        const closeWindow = useAppStore.getState().closeWindow;
        closeWindow(window.id);
      } else {
        dispatchMessage('SYSTEM_ALERT', {
          message: data.error || 'Failed to block user',
          title: 'Error',
        });
      }
    } catch (error) {
      console.error('Failed to block user:', error);
      dispatchMessage('SYSTEM_ALERT', {
        message: 'Failed to block user',
        title: 'Error',
      });
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

  // AIM Color Palette
  const AIM_BLUE = '#0037FF';
  const AIM_GREY = '#E5E5E5';
  const AIM_BORDER = '#A0A0A0';
  const XP_BLUE = '#3A6EA5';
  const AIM_YELLOW = '#FFD700';

  return (
    <div className="h-full w-full flex flex-col" style={{ backgroundColor: '#FFFFFF', border: `1px solid ${AIM_BORDER}` }}>
      {/* Menu Bar - AIM Style */}
      <div className="bg-gray-200 border-b border-gray-400 px-2 py-0.5 flex items-center" style={{ 
        fontSize: '11px', 
        fontFamily: 'Tahoma, Arial, sans-serif',
        minHeight: '20px'
      }}>
        <span className="px-2 hover:bg-gray-300 cursor-pointer" style={{ fontSize: '10px' }}>File</span>
        <span className="px-2 hover:bg-gray-300 cursor-pointer" style={{ fontSize: '10px' }}>Edit</span>
        <span className="px-2 hover:bg-gray-300 cursor-pointer" style={{ fontSize: '10px' }}>Insert</span>
        <span className="px-2 hover:bg-gray-300 cursor-pointer" style={{ fontSize: '10px' }}>People</span>
        <div className="flex-1"></div>
        {/* Buddy Name - Bold Blue */}
        <span className="font-bold mr-2" style={{ color: AIM_BLUE, fontSize: '11px' }}>
          {buddyScreenName}
        </span>
        {/* Warning Level - Right-aligned, smaller grey */}
        <span className="text-gray-500" style={{ fontSize: '9px' }}>
          Warning Level: 0%
        </span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex" style={{ minHeight: 0 }}>
        {/* Left Sidebar - Buddy Icons - AIM Style */}
        <div className="w-20 flex flex-col border-r border-gray-400" style={{
          backgroundColor: AIM_GREY,
          minWidth: '80px',
        }}>
          {/* Remote User Avatar */}
          <div className="flex-1 flex items-center justify-center p-1.5 border-b border-gray-400">
            <div className="w-14 h-14 bg-white border border-gray-400 flex items-center justify-center" style={{
              boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.1)',
            }}>
              <span className="text-2xl">👤</span>
            </div>
          </div>
          
          {/* Local User Avatar */}
          <div className="flex-1 flex items-center justify-center p-1.5">
            <div className="w-14 h-14 bg-white border border-gray-400 flex items-center justify-center" style={{
              boxShadow: 'inset 1px 1px 2px rgba(0,0,0,0.1)',
            }}>
              <span className="text-2xl">👤</span>
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col" style={{ minWidth: 0 }}>
          {/* Transcript Area - AIM Style with Inset Border */}
          <div 
            ref={messagesEndRef}
            className="flex-1 overflow-y-auto p-2 bg-white retro-scrollbar"
            style={{ 
              fontFamily: 'Arial, sans-serif',
              fontSize: '11px',
              lineHeight: '1.5',
              border: `inset 1px solid ${AIM_BORDER}`,
              margin: '2px',
            }}
          >
            {isLoading ? (
              <div className="text-center text-gray-500">Loading messages...</div>
            ) : currentThread && currentThread.messages.length > 0 ? (
              <div className="space-y-1">
                {currentThread.messages.map((msg) => {
                  const isFromMe = msg.from === currentUser?.username;
                  const displayName = isFromMe ? myScreenName : buddyScreenName;
                  // AIM colors: Blue for buddy names, Black for your messages
                  const nameColor = isFromMe ? '#000000' : AIM_BLUE; // Black for me, blue for buddy
                  const messageColor = isFromMe ? '#000000' : '#000000'; // Both black text
                  
                  return (
                    <div key={msg.id} className="flex flex-col items-start mb-1" style={{ marginBottom: '2px' }}>
                      <div className="flex items-start w-full">
                        <span 
                          className="font-bold mr-1"
                          style={{ color: nameColor, fontSize: '11px' }}
                        >
                          {displayName}:
                        </span>
                        <span className="flex-1" style={{ color: messageColor, fontSize: '11px' }}>{msg.message || ''}</span>
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

          {/* Formatting Toolbar - Compact AIM Style */}
          <div className="bg-gray-200 border-t border-b border-gray-400 px-1 py-0.5 flex items-center gap-0.5" style={{
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
            minHeight: '22px',
            fontSize: '10px',
            fontFamily: 'Tahoma, Arial, sans-serif',
          }}>
            {/* Font Name - Compact */}
            <div className="flex items-center border border-gray-400 bg-white px-0.5" style={{ fontSize: '9px', height: '18px' }}>
              <span className="mr-0.5" style={{ fontSize: '9px' }}>A</span>
              <select className="border-0 bg-transparent focus:outline-none" style={{ fontSize: '9px', padding: '0' }}>
                <option>Arial</option>
                <option>Times New Roman</option>
                <option>Tahoma</option>
                <option>Verdana</option>
              </select>
            </div>

            {/* Font Size - Compact */}
            <div className="flex items-center border border-gray-400 bg-white px-0.5" style={{ fontSize: '9px', height: '18px' }}>
              <select className="border-0 bg-transparent focus:outline-none" style={{ fontSize: '9px', padding: '0' }}>
                <option>8</option>
                <option>9</option>
                <option>10</option>
                <option>11</option>
                <option>12</option>
                <option>14</option>
                <option>16</option>
              </select>
            </div>

            {/* Text Color - Compact */}
            <button
              onClick={() => {
                const color = prompt('Enter color (hex or name):', textColor);
                if (color) setTextColor(color);
              }}
              className="border border-gray-400 bg-white px-1 py-0 hover:bg-gray-100"
              style={{ fontSize: '10px', height: '18px', minWidth: '18px' }}
              title="Text Color"
            >
              A
            </button>

            {/* Bold - Compact */}
            <button
              onClick={() => setIsBold(!isBold)}
              className={`border border-gray-400 px-1 py-0 font-bold hover:bg-gray-100 ${
                isBold ? 'bg-gray-300' : 'bg-white'
              }`}
              style={{ fontSize: '10px', height: '18px', minWidth: '18px' }}
              title="Bold"
            >
              B
            </button>

            {/* Italic - Compact */}
            <button
              onClick={() => setIsItalic(!isItalic)}
              className={`border border-gray-400 px-1 py-0 italic hover:bg-gray-100 ${
                isItalic ? 'bg-gray-300' : 'bg-white'
              }`}
              style={{ fontSize: '10px', height: '18px', minWidth: '18px' }}
              title="Italic"
            >
              I
            </button>

            {/* Underline - Compact */}
            <button
              onClick={() => setIsUnderline(!isUnderline)}
              className={`border border-gray-400 px-1 py-0 hover:bg-gray-100 ${
                isUnderline ? 'bg-gray-300 underline' : 'bg-white'
              }`}
              style={{ fontSize: '10px', height: '18px', minWidth: '18px' }}
              title="Underline"
            >
              U
            </button>

            {/* Link - Compact */}
            <button
              className="border border-gray-400 bg-white px-1 py-0 hover:bg-gray-100"
              style={{ fontSize: '10px', height: '18px', minWidth: '18px' }}
              title="Insert Link"
            >
              🔗
            </button>

            {/* Emoji - Compact */}
            <button
              className="border border-gray-400 bg-white px-1 py-0 hover:bg-gray-100"
              style={{ fontSize: '10px', height: '18px', minWidth: '18px' }}
              title="Emoji"
            >
              😊
            </button>

            {/* Insert Image - Compact */}
            <button
              className="border border-gray-400 bg-white px-1 py-0 hover:bg-gray-100"
              style={{ fontSize: '10px', height: '18px', minWidth: '18px' }}
              title="Insert Image"
            >
              🖼️
            </button>

            {/* Attach File - Compact */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="border border-gray-400 bg-white px-1 py-0 hover:bg-gray-100 disabled:opacity-50"
              style={{ fontSize: '10px', height: '18px', minWidth: '18px' }}
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

          {/* Pending Attachments - Compact AIM Style */}
          {pendingAttachments.length > 0 && (
            <div className="px-1.5 py-0.5 bg-gray-100 border-t border-gray-300 flex flex-wrap gap-1" style={{ minHeight: '24px' }}>
              {pendingAttachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-0.5 bg-white border border-gray-400 px-1.5 py-0.5 text-xs"
                  style={{ fontSize: '10px', fontFamily: 'Tahoma, Arial, sans-serif' }}
                >
                  <span>📎 {att.filename} ({formatFileSize(att.size)})</span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="text-red-600 hover:text-red-800 ml-0.5"
                    style={{ fontSize: '12px' }}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Area - AIM Style */}
          <div className="p-1.5 bg-white border-t border-gray-400">
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
              className="w-full bg-white text-gray-900 resize-none focus:outline-none"
              style={{ 
                fontFamily: 'Arial, sans-serif',
                fontSize: '11px',
                minHeight: '50px',
                padding: '4px',
                border: `inset 1px solid ${AIM_BORDER}`,
                boxShadow: 'inset 1px 1px 1px rgba(0,0,0,0.1)',
              }}
              placeholder={`Type a message to ${buddyScreenName}...`}
            />
          </div>
        </div>
      </div>

      {/* Bottom Action Bar - AIM Style */}
      <div className="bg-gray-300 border-t border-gray-500 px-1.5 py-1 flex items-center justify-between" style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
        minHeight: '50px',
      }}>
        <div className="flex items-center gap-1">
          {/* Warn Button - AOL Style with Pastel Background */}
          <button
            onClick={handleWarn}
            className="flex flex-col items-center justify-center px-1.5 py-1 border border-gray-400 hover:bg-gray-200 active:bg-gray-300"
            style={{
              width: '50px',
              height: '40px',
              backgroundColor: '#FFE4B5', // Pastel yellow/peach
              borderRadius: '4px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2), inset 1px 1px 0 rgba(255,255,255,0.5)',
            }}
            title="Warn"
          >
            <span className="text-base mb-0.5">⚠️</span>
            <span className="text-xs font-semibold" style={{ fontSize: '8px', color: '#000' }}>Warn</span>
          </button>

          {/* Block Button */}
          <button
            onClick={handleBlock}
            className="flex flex-col items-center justify-center px-1.5 py-1 border border-gray-400 hover:bg-gray-200 active:bg-gray-300"
            style={{
              width: '50px',
              height: '40px',
              backgroundColor: '#FFB6C1', // Pastel pink
              borderRadius: '4px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2), inset 1px 1px 0 rgba(255,255,255,0.5)',
            }}
            title="Block"
          >
            <span className="text-base mb-0.5">🚫</span>
            <span className="text-xs font-semibold" style={{ fontSize: '8px', color: '#000' }}>Block</span>
          </button>

          {/* Smiley Button */}
          <button
            className="flex flex-col items-center justify-center px-1.5 py-1 border border-gray-400 hover:bg-gray-200 active:bg-gray-300"
            style={{
              width: '50px',
              height: '40px',
              backgroundColor: '#E0E0E0', // Light grey
              borderRadius: '4px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2), inset 1px 1px 0 rgba(255,255,255,0.5)',
            }}
            title="Smiley"
          >
            <span className="text-base mb-0.5">😊</span>
            <span className="text-xs font-semibold" style={{ fontSize: '8px', color: '#000' }}>Smiley</span>
          </button>

          {/* Expressions Button */}
          <button
            className="flex flex-col items-center justify-center px-1.5 py-1 border border-gray-400 hover:bg-gray-200 active:bg-gray-300"
            style={{
              width: '50px',
              height: '40px',
              backgroundColor: '#DDA0DD', // Pastel purple
              borderRadius: '4px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2), inset 1px 1px 0 rgba(255,255,255,0.5)',
            }}
            title="Expressions"
          >
            <span className="text-base mb-0.5">😊</span>
            <span className="text-xs font-semibold" style={{ fontSize: '8px', color: '#000' }}>Expressions</span>
          </button>

          {/* Games Button */}
          <button
            className="flex flex-col items-center justify-center px-1.5 py-1 border border-gray-400 hover:bg-gray-200 active:bg-gray-300"
            style={{
              width: '50px',
              height: '40px',
              backgroundColor: '#B0E0E6', // Pastel blue
              borderRadius: '4px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2), inset 1px 1px 0 rgba(255,255,255,0.5)',
            }}
            title="Games"
          >
            <span className="text-base mb-0.5">🎮</span>
            <span className="text-xs font-semibold" style={{ fontSize: '8px', color: '#000' }}>Games</span>
          </button>

          {/* Profile Button */}
          <button
            onClick={handleViewProfile}
            className="flex flex-col items-center justify-center px-1.5 py-1 border border-gray-400 hover:bg-gray-200 active:bg-gray-300"
            style={{
              width: '50px',
              height: '40px',
              backgroundColor: '#F0E68C', // Pastel yellow
              borderRadius: '4px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2), inset 1px 1px 0 rgba(255,255,255,0.5)',
            }}
            title="View Profile"
          >
            <span className="text-base mb-0.5">👤</span>
            <span className="text-xs font-semibold" style={{ fontSize: '8px', color: '#000' }}>Profile</span>
          </button>
        </div>

        {/* Send Button - Big Green XP-Style */}
        <button
          onClick={() => handleSendMessage()}
          disabled={!inputMessage.trim() && pendingAttachments.length === 0}
          className="px-6 py-2 text-white font-semibold border border-green-700 hover:bg-green-600 active:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: '#4CAF50', // Green
            borderRadius: '4px',
            fontSize: '12px',
            minWidth: '80px',
            height: '40px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.2)',
            textShadow: '0 1px 1px rgba(0,0,0,0.2)',
          }}
          title="Send"
        >
          Send
        </button>
      </div>
    </div>
  );
}
