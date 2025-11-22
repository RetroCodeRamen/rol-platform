'use client';

import { useAppStore } from '@/state/store';

const CHANNELS = [
  { id: 'news', name: 'News', icon: '📰' },
  { id: 'sports', name: 'Sports', icon: '⚽' },
  { id: 'games', name: 'Games', icon: '🎮' },
  { id: 'kids', name: 'Kids', icon: '👶' },
  { id: 'local', name: 'Local', icon: '📍' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
  { id: 'shopping', name: 'Shopping', icon: '🛒' },
  { id: 'travel', name: 'Travel', icon: '✈️' },
];

export default function SideBarChannels() {
  const activeChannel = useAppStore((state) => state.activeChannel);
  const setActiveChannel = useAppStore((state) => state.setActiveChannel);
  const setActiveView = useAppStore((state) => state.setActiveView);

  const handleChannelClick = (channelId: string) => {
    setActiveChannel(channelId);
    setActiveView('channels');
  };

  return (
    <div className="h-full w-full p-2" style={{ backgroundColor: '#e6f2ff' }}>
      <div className="mb-2">
        <h2 className="text-sm font-bold text-gray-800 mb-1 px-2">Channels</h2>
      </div>
      <div className="space-y-1">
        {CHANNELS.map((channel) => (
          <button
            key={channel.id}
            onClick={() => handleChannelClick(channel.id)}
            className={`w-full text-left px-2 py-1 rounded text-sm font-medium transition-colors ${
              activeChannel === channel.id
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-800 hover:bg-gray-300 border border-gray-400'
            }`}
          >
            <span className="mr-2">{channel.icon}</span>
            {channel.name}
          </button>
        ))}
      </div>
    </div>
  );
}

