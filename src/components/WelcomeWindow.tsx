'use client';

import { useAppStore } from '@/state/store';

export default function WelcomeWindow() {
  const currentUser = useAppStore((state) => state.currentUser);

  return (
    <div className="h-full overflow-auto retro-scrollbar p-4" style={{ backgroundColor: '#e6f2ff' }}>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-blue-800 mb-2">
            Welcome to Ramen Online, {currentUser?.screenName || currentUser?.username}!
          </h1>
          <p className="text-gray-700">You&apos;ve successfully connected to Ramen Online</p>
        </div>

        <div className="bg-white border-2 border-blue-300 rounded p-4 mb-4">
          <h2 className="text-lg font-semibold text-blue-700 mb-2">Getting Started</h2>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            <li>Check your mail using the Mail Center button</li>
            <li>Browse Channels to explore content</li>
            <li>Chat with friends in Chat Rooms</li>
            <li>Send Instant Messages to your buddies</li>
          </ul>
        </div>

        <div className="bg-white border-2 border-blue-300 rounded p-4 mb-4">
          <h2 className="text-lg font-semibold text-blue-700 mb-2">Your Account</h2>
          <div className="text-sm text-gray-700 space-y-1">
            <p><strong>Screen Name:</strong> {currentUser?.screenName || currentUser?.username}</p>
            <p><strong>Email:</strong> {currentUser?.username ? `${currentUser.username}@ramn.online` : 'N/A'}</p>
            <p><strong>Status:</strong> {currentUser?.status || 'online'}</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-100 to-purple-100 border-2 border-blue-300 rounded p-4">
          <p className="text-sm text-gray-700 text-center">
            Welcome to the retro Ramen Online experience! Enjoy your stay on ROL.
          </p>
        </div>
      </div>
    </div>
  );
}

