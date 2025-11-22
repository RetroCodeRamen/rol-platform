'use client';

import { useState } from 'react';
import ThreadList from './ThreadList';

export interface IForumCategory {
  id: string;
  name: string;
  description: string;
  threadCount: number;
}

const MOCK_CATEGORIES: IForumCategory[] = [
  { id: '1', name: 'General Discussion', description: 'Talk about anything', threadCount: 42 },
  { id: '2', name: 'Tech Talk', description: 'Technology and computers', threadCount: 28 },
  { id: '3', name: 'Gaming', description: 'Video games and more', threadCount: 56 },
  { id: '4', name: 'Movies & TV', description: 'Entertainment discussions', threadCount: 33 },
  { id: '5', name: 'Music', description: 'Share your favorite tunes', threadCount: 19 },
];

export default function ForumList() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  if (selectedCategory) {
    return (
      <ThreadList
        categoryId={selectedCategory}
        categoryName={MOCK_CATEGORIES.find((c) => c.id === selectedCategory)?.name || 'Forum'}
        onBack={() => setSelectedCategory(null)}
      />
    );
  }

  return (
    <div className="h-full w-full flex flex-col" style={{ backgroundColor: '#e6f2ff' }}>
      <div className="px-2 py-1 border-b border-blue-400" style={{ background: 'linear-gradient(to bottom, #0066cc, #4a0080)' }}>
        <h2 className="text-white font-bold">Forums</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 retro-scrollbar">
        <div className="space-y-2">
          {MOCK_CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className="w-full text-left p-4 bg-gray-50 border-2 border-gray-300 rounded hover:bg-gray-100 hover:border-blue-400"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900">{category.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                </div>
                <div className="text-sm text-gray-500">
                  {category.threadCount} threads
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

