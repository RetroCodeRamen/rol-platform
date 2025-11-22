'use client';

import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/state/store';
import { chatService } from '@/services/ChatService';
import type { IChatMessage, IChatRoom } from '@/services/ChatService';

export default function ChatWindow() {
  const [rooms, setRooms] = useState<IChatRoom[]>([]);
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeChatRoom = useAppStore((state) => state.activeChatRoom);
  const setActiveChatRoom = useAppStore((state) => state.setActiveChatRoom);
  const currentUser = useAppStore((state) => state.currentUser);

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    if (activeChatRoom) {
      loadMessages();
    }
  }, [activeChatRoom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadRooms = async () => {
    const chatRooms = await chatService.getChatRooms();
    setRooms(chatRooms);
    if (chatRooms.length > 0 && !activeChatRoom) {
      setActiveChatRoom(chatRooms[0].id);
    }
  };

  const loadMessages = async () => {
    if (!activeChatRoom) return;
    setIsLoading(true);
    try {
      const roomMessages = await chatService.getRoomMessages(activeChatRoom);
      setMessages(roomMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeChatRoom || !currentUser) return;

    try {
      const newMessage = await chatService.sendRoomMessage(
        activeChatRoom,
        inputMessage,
        currentUser.username
      );
      setMessages([...messages, newMessage]);
      setInputMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="h-full w-full flex" style={{ backgroundColor: '#e6f2ff' }}>
      {/* Room List */}
      <div className="w-48 border-r border-blue-300" style={{ backgroundColor: '#cce5ff' }}>
        <div className="p-2 border-b border-blue-400" style={{ background: 'linear-gradient(to bottom, #0066cc, #4a0080)' }}>
          <h3 className="text-white font-bold text-sm">Chat Rooms</h3>
        </div>
        <div className="divide-y divide-gray-300">
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => setActiveChatRoom(room.id)}
              className={`w-full text-left p-2 text-sm ${
                activeChatRoom === room.id
                  ? 'bg-blue-100 font-semibold'
                  : 'hover:bg-gray-200'
              }`}
            >
              <div className="font-medium">{room.name}</div>
              <div className="text-xs text-gray-600">{room.userCount} users</div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeChatRoom ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 retro-scrollbar">
              {isLoading ? (
                <div className="text-center text-gray-500">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500">No messages yet. Start chatting!</div>
              ) : (
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div key={msg.id} className="bg-white p-2 rounded border border-gray-300">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-blue-600 text-sm">{msg.from}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-800">{msg.message}</div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-2 border-t border-gray-400 bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-400 bg-white text-gray-900 focus:outline-none"
                  style={{ boxShadow: 'inset 1px 1px 0 rgba(0,0,0,0.1)' }}
                  placeholder="Type your message..."
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim()}
                  className="px-2 py-0.5 bg-gray-200 text-gray-900 text-xs font-semibold border border-gray-400 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)' }}
                >
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a chat room to start chatting
          </div>
        )}
      </div>
    </div>
  );
}

