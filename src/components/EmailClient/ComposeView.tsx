'use client';

import { useState } from 'react';
import { mailService } from '@/services/MailService';
import { useAppStore } from '@/state/store';
import { notificationService } from '@/services/NotificationService';

interface ComposeViewProps {
  onClose: () => void;
}

export default function ComposeView({ onClose }: ComposeViewProps) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const currentUser = useAppStore((state) => state.currentUser);
  const addMessage = useAppStore((state) => state.addMessage);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim() || !subject.trim() || !body.trim()) return;

    setIsSending(true);
    try {
      const sentMessage = await mailService.sendMessage({
        from: currentUser?.email || 'user@ramn.online',
        to,
        subject,
        body,
      });
      addMessage(sentMessage);
      onClose();
    } catch (error: any) {
      console.error('Failed to send message:', error);
      const errorMessage = error?.message || 'Failed to send message. Please try again.';
      alert(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col" style={{ backgroundColor: '#e6f2ff' }}>
      {/* Header */}
      <div className="px-2 py-1 flex items-center justify-between border-b border-blue-400" style={{ background: 'linear-gradient(to bottom, #0066cc, #4a0080)' }}>
        <h2 className="text-white font-bold">Compose Message</h2>
        <button
          onClick={onClose}
          className="text-white text-sm font-semibold hover:underline"
        >
          Cancel
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSend} className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 space-y-3 border-b-2 border-gray-300">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">From:</label>
            <input
              type="email"
              value={currentUser?.username ? `${currentUser.username}@ramn.online` : ''}
              readOnly
              className="w-full px-3 py-2 border-2 border-gray-400 rounded bg-gray-100 text-gray-600 cursor-not-allowed"
              placeholder="username@ramn.online"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">To:</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-400 rounded bg-white text-gray-900 focus:outline-none focus:border-blue-500"
              placeholder="username@ramn.online or username1@ramn.online,username2@ramn.online"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Subject:</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-400 rounded bg-white text-gray-900 focus:outline-none focus:border-blue-500"
              placeholder="Enter subject"
              required
            />
          </div>
        </div>

        <div className="flex-1 p-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Message:</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full h-full px-3 py-2 border-2 border-gray-400 rounded bg-white text-gray-900 focus:outline-none focus:border-blue-500 resize-none"
            placeholder="Type your message here..."
            required
          />
        </div>

        <div className="p-4 border-t-2 border-gray-300 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-0.5 bg-gray-200 text-gray-900 text-xs font-semibold border border-gray-400 hover:bg-gray-300"
            style={{ boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSending || !to.trim() || !subject.trim() || !body.trim()}
            className="px-2 py-0.5 bg-gray-200 text-gray-900 text-xs font-semibold border border-gray-400 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)' }}
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}

