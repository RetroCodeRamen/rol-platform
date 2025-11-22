'use client';

import { useState, useEffect } from 'react';

export interface IPost {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

const MOCK_POSTS: Record<string, IPost[]> = {
  '1': [
    { id: '1', author: 'Admin', content: 'Welcome to the ROL Forums! This is a retro reimplementation of the classic dial-up experience.', timestamp: new Date(Date.now() - 86400000).toISOString() },
    { id: '2', author: 'User123', content: 'Thanks for setting this up! Brings back memories.', timestamp: new Date(Date.now() - 82800000).toISOString() },
    { id: '3', author: 'RetroFan', content: 'Love the retro vibe!', timestamp: new Date(Date.now() - 79200000).toISOString() },
  ],
  '2': [
    { id: '4', author: 'User123', content: 'What\'s your favorite memory of old dial-up? Mine was waiting for "You\'ve got mail!"', timestamp: new Date(Date.now() - 3600000).toISOString() },
    { id: '5', author: 'RetroFan', content: 'The dial-up sound! So nostalgic.', timestamp: new Date(Date.now() - 3300000).toISOString() },
  ],
};

interface ThreadViewProps {
  threadId: string;
  threadTitle: string;
  onBack: () => void;
}

export default function ThreadView({ threadId, threadTitle, onBack }: ThreadViewProps) {
  const [posts, setPosts] = useState<IPost[]>([]);
  const [replyContent, setReplyContent] = useState('');
  const [currentUser] = useState('User123'); // In real app, get from store

  useEffect(() => {
    // Load posts for this thread
    setPosts(MOCK_POSTS[threadId] || []);
  }, [threadId]);

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    const newPost: IPost = {
      id: `post_${Date.now()}`,
      author: currentUser,
      content: replyContent,
      timestamp: new Date().toISOString(),
    };

    setPosts([...posts, newPost]);
    setReplyContent('');
  };

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
          <h2 className="text-white font-bold">{threadTitle}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 retro-scrollbar">
        {posts.length === 0 ? (
          <div className="text-center text-gray-500">No posts in this thread yet</div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="bg-white p-4 border-2 border-gray-300 rounded">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-blue-600">{post.author}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(post.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm text-gray-800 whitespace-pre-wrap">{post.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleReply} className="p-4 border-t-2 border-gray-400 bg-white">
        <div className="mb-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Reply:</label>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="w-full px-3 py-2 border-2 border-gray-400 rounded bg-white text-gray-900 focus:outline-none focus:border-blue-500 resize-none"
            rows={3}
            placeholder="Type your reply..."
          />
        </div>
        <button
          type="submit"
          disabled={!replyContent.trim()}
          className="px-2 py-0.5 bg-gray-200 text-gray-900 text-xs font-semibold border border-gray-400 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)' }}
        >
          Post Reply
        </button>
      </form>
    </div>
  );
}

