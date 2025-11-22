'use client';

import { useState, useEffect } from 'react';
import ThreadView from './ThreadView';

export interface IThread {
  id: string;
  title: string;
  author: string;
  postCount: number;
  lastPostDate: string;
}

const MOCK_THREADS: Record<string, IThread[]> = {
  '1': [
    { id: '1', title: 'Welcome to ROL Forums!', author: 'Admin', postCount: 5, lastPostDate: new Date().toISOString() },
    { id: '2', title: 'What\'s your favorite memory of old dial-up?', author: 'User123', postCount: 12, lastPostDate: new Date(Date.now() - 3600000).toISOString() },
    { id: '3', title: 'Remember dial-up sounds?', author: 'RetroFan', postCount: 8, lastPostDate: new Date(Date.now() - 7200000).toISOString() },
  ],
  '2': [
    { id: '4', title: 'Best programming language in 2024?', author: 'DevGuru', postCount: 15, lastPostDate: new Date(Date.now() - 1800000).toISOString() },
    { id: '5', title: 'Building retro web apps', author: 'WebDev', postCount: 7, lastPostDate: new Date(Date.now() - 5400000).toISOString() },
  ],
  '3': [
    { id: '6', title: 'Classic games that still hold up', author: 'Gamer99', postCount: 23, lastPostDate: new Date(Date.now() - 900000).toISOString() },
    { id: '7', title: 'Retro gaming recommendations', author: 'OldSchool', postCount: 11, lastPostDate: new Date(Date.now() - 3600000).toISOString() },
  ],
  '4': [
    { id: '8', title: 'Best movies of the 90s', author: 'MovieBuff', postCount: 18, lastPostDate: new Date(Date.now() - 2700000).toISOString() },
  ],
  '5': [
    { id: '9', title: '90s music recommendations', author: 'MusicLover', postCount: 9, lastPostDate: new Date(Date.now() - 4500000).toISOString() },
  ],
};

interface ThreadListProps {
  categoryId: string;
  categoryName: string;
  onBack: () => void;
}

export default function ThreadList({ categoryId, categoryName, onBack }: ThreadListProps) {
  const [threads, setThreads] = useState<IThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  useEffect(() => {
    // Load threads for this category
    setThreads(MOCK_THREADS[categoryId] || []);
  }, [categoryId]);

  if (selectedThreadId) {
    const thread = threads.find((t) => t.id === selectedThreadId);
    return (
      <ThreadView
        threadId={selectedThreadId}
        threadTitle={thread?.title || 'Thread'}
        onBack={() => setSelectedThreadId(null)}
      />
    );
  }

  return (
    <div className="h-full w-full flex flex-col" style={{ backgroundColor: '#e6f2ff' }}>
      <div className="px-2 py-1 flex items-center justify-between border-b border-blue-400" style={{ background: 'linear-gradient(to bottom, #0066cc, #4a0080)' }}>
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="text-white text-sm font-semibold hover:underline"
          >
            ← Back
          </button>
          <span className="text-white">|</span>
          <h2 className="text-white font-bold">{categoryName}</h2>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 retro-scrollbar">
        {threads.length === 0 ? (
          <div className="text-center text-gray-500">No threads in this category yet</div>
        ) : (
          <div className="space-y-2">
            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => setSelectedThreadId(thread.id)}
                className="w-full text-left p-3 bg-gray-50 border-2 border-gray-300 rounded hover:bg-gray-100 hover:border-blue-400"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{thread.title}</h3>
                    <p className="text-xs text-gray-600 mt-1">
                      by {thread.author} • {thread.postCount} posts
                    </p>
                  </div>
                  <div className="text-xs text-gray-500 ml-4">
                    {new Date(thread.lastPostDate).toLocaleDateString()}
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

