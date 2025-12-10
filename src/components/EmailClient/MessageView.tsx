'use client';

import type { IMessage } from '@/services/MailService';
import { mailService } from '@/services/MailService';
import { useAppStore } from '@/state/store';

interface MessageViewProps {
  message: IMessage;
  onBack: () => void;
}

export default function MessageView({ message, onBack }: MessageViewProps) {
  const updateMessage = useAppStore((state) => state.updateMessage);

  const handleDelete = async () => {
    await mailService.moveToFolder(message.id, 'Trash');
    updateMessage(message.id, { folder: 'Trash' });
    onBack();
  };

  const handleDownloadAttachment = (attachmentId: string, filename: string) => {
    // Open download in new tab
    window.open(`/api/mail/attachment/${attachmentId}`, '_blank');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="h-full w-full flex flex-col" style={{ backgroundColor: '#e6f2ff' }}>
      {/* Header */}
      <div className="px-2 py-1 flex items-center justify-between border-b border-blue-400" style={{ background: 'linear-gradient(to bottom, #0066cc, #4a0080)' }}>
        <button
          onClick={onBack}
          className="text-white text-sm font-semibold hover:underline"
        >
          ← Back
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            className="px-2 py-0.5 bg-gray-200 text-gray-900 text-xs font-semibold border border-gray-400 hover:bg-red-300"
            style={{ boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)' }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Message Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 pb-4 border-b-2 border-gray-300">
          <div className="mb-2">
            <span className="text-sm font-semibold text-gray-700">From: </span>
            <span className="text-sm text-gray-900">{message.from}</span>
          </div>
          <div className="mb-2">
            <span className="text-sm font-semibold text-gray-700">To: </span>
            <span className="text-sm text-gray-900">{message.to}</span>
          </div>
          <div className="mb-2">
            <span className="text-sm font-semibold text-gray-700">Date: </span>
            <span className="text-sm text-gray-900">
              {new Date(message.date).toLocaleString()}
            </span>
          </div>
          <div className="mt-3">
            <span className="text-sm font-semibold text-gray-700">Subject: </span>
            <span className="text-lg font-bold text-gray-900">{message.subject}</span>
          </div>
        </div>

        <div className="text-sm text-gray-800 whitespace-pre-wrap">{message.body}</div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-4 pt-4 border-t-2 border-gray-300">
            <div className="text-sm font-semibold text-gray-700 mb-2">Attachments:</div>
            <div className="space-y-2">
              {message.attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between px-3 py-2 bg-gray-100 border-2 border-gray-300 rounded hover:bg-gray-200"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📎</span>
                    <div>
                      <div className="text-sm font-medium text-gray-800">{att.filename}</div>
                      <div className="text-xs text-gray-500">
                        {formatFileSize(att.size)} • {att.mimeType}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownloadAttachment(att.id, att.filename)}
                    className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700"
                    style={{ boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)' }}
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

