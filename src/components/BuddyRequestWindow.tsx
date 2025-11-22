'use client';

import { useEffect } from 'react';
import type { Window } from '@/state/store';

interface BuddyRequestWindowProps {
  window: Window;
  requesterUsername: string;
  onAccept: () => void;
  onIgnore: () => void;
}

export default function BuddyRequestWindow({
  window,
  requesterUsername,
  onAccept,
  onIgnore,
}: BuddyRequestWindowProps) {
  return (
    <div 
      className="h-full w-full flex flex-col p-6"
      style={{ backgroundColor: '#e6f2ff' }}
    >
      <div className="bg-white border-2 border-gray-400 rounded p-6 shadow-lg max-w-md mx-auto">
        <h3 className="text-lg font-bold mb-4 text-gray-800">Buddy Request</h3>
        <p className="text-sm text-gray-700 mb-6">
          <strong>{requesterUsername}</strong> wants to add you as a buddy.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onIgnore}
            className="px-4 py-2 text-sm bg-gray-200 text-gray-900 rounded hover:bg-gray-300 border border-gray-400"
            style={{
              boxShadow: 'inset -1px -1px 0 rgba(0,0,0,0.2), inset 1px 1px 0 rgba(255,255,255,0.5)',
            }}
          >
            Ignore
          </button>
          <button
            onClick={onAccept}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 border border-blue-700"
            style={{
              boxShadow: 'inset -1px -1px 0 rgba(0,0,0,0.2), inset 1px 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            Add Buddy
          </button>
        </div>
      </div>
    </div>
  );
}

