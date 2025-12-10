'use client';

import { useState } from 'react';
import { mailService, type IAttachment } from '@/services/MailService';
import { useAppStore } from '@/state/store';
import { notificationService } from '@/services/NotificationService';
import { dispatchMessage } from '@/lib/messaging/AppMessageHandler';

interface ComposeViewProps {
  onClose: () => void;
}

interface PendingAttachment extends IAttachment {
  uploading?: boolean;
}

export default function ComposeView({ onClose }: ComposeViewProps) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const currentUser = useAppStore((state) => state.currentUser);
  const addMessage = useAppStore((state) => state.addMessage);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (1MB limit)
    const MAX_SIZE = 1 * 1024 * 1024; // 1MB
    if (file.size > MAX_SIZE) {
      dispatchMessage('SYSTEM_ALERT', {
        message: `File size exceeds 1MB limit. Maximum size: 1MB`,
        title: 'File Too Large',
      });
      e.target.value = ''; // Clear input
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/mail/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to upload file');
      }

      setAttachments([...attachments, data.attachment]);
    } catch (error: any) {
      console.error('Failed to upload file:', error);
      dispatchMessage('SYSTEM_ALERT', {
        message: error?.message || 'Failed to upload file. Please try again.',
        title: 'Upload Error',
      });
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Clear input
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(attachments.filter(att => att.id !== id));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim() || !subject.trim() || !body.trim()) return;

    setIsSending(true);
    try {
      const attachmentIds = attachments.map(att => att.id);
      const sentMessage = await mailService.sendMessage({
        from: currentUser?.email || 'user@ramn.online',
        to,
        subject,
        body,
        attachmentIds,
      } as any);
      addMessage(sentMessage);
      onClose();
    } catch (error: any) {
      console.error('Failed to send message:', error);
      const errorMessage = error?.message || 'Failed to send message. Please try again.';
      dispatchMessage('SYSTEM_ALERT', {
        message: errorMessage,
        title: 'Send Error',
      });
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
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Attachments:</label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="text-sm text-gray-700 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                accept="image/*,.pdf,.txt"
              />
              {isUploading && (
                <span className="text-xs text-gray-500">Uploading...</span>
              )}
            </div>
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between px-2 py-1 bg-gray-100 rounded text-xs"
                  >
                    <span className="text-gray-700">
                      📎 {att.filename} ({formatFileSize(att.size)})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="text-red-600 hover:text-red-800 font-semibold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Maximum file size: 1MB per attachment
            </p>
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

