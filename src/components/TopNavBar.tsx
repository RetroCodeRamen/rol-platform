'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAppStore } from '@/state/store';
import { authService } from '@/services/AuthService';
import { SoundService } from '@/services/SoundService';
import { executeAction } from '@/lib/windows/WindowActions';
import '@/lib/windows/registerActions'; // Side effect: registers all actions

const TOP_BAR_BUTTONS = [
  { id: 'read', icon: '/images/icon-read.png', label: 'Read' },
  { id: 'write', icon: '/images/icon-write.png', label: 'Write' },
  { id: 'messenger', icon: '/images/icon-messenger.png', label: 'Messenger' },
  { id: 'print', icon: '/images/icon-print.png', label: 'Print' },
  { id: 'my-files', icon: '/images/icon-my-files.png', label: 'My Files' },
  { id: 'my-aol', icon: '/images/icon-my-aol.png', label: 'My ROL' },
  { id: 'favorites', icon: '/images/icon-favorites.png', label: 'Favorites' },
  { id: 'internet', icon: '/images/icon-internet.png', label: 'Internet' },
  { id: 'channels', icon: '/images/icon-channels.png', label: 'Channels' },
  { id: 'quotes', icon: '/images/incon-quotes.png', label: 'Quotes' },
  { id: 'perks', icon: '/images/icon-perks.png', label: 'Perks' },
  { id: 'weather', icon: '/images/icon-weather.png', label: 'Weather' },
] as const;

export default function TopNavBar() {
  const router = useRouter();
  const currentUser = useAppStore((state) => state.currentUser);
  const reset = useAppStore((state) => state.reset);
  const openWindow = useAppStore((state) => state.openWindow);
  const getWindowByType = useAppStore((state) => state.getWindowByType);
  const bringToFront = useAppStore((state) => state.bringToFront);

  const handleSignOff = async () => {
    try {
      SoundService.play('goodbye');
      await authService.logout();
      // Wait a moment for cookies to be cleared
      await new Promise(resolve => setTimeout(resolve, 200));
      reset();
      // Force a hard navigation to ensure everything is cleared
      window.location.href = '/';
    } catch (error) {
      console.error('[TopNavBar] Error during sign off:', error);
      // Still try to navigate even if logout fails
      reset();
      window.location.href = '/';
    }
  };

  const handleButtonClick = (buttonId: string) => {
    // Use action registry - no need to modify this function when adding new buttons
    executeAction(buttonId, openWindow, getWindowByType, bringToFront);
  };

  return (
    <div className="bg-blue-600 border-b-2 border-blue-800 px-4 py-2 flex items-center justify-between flex-shrink-0" style={{ 
      background: 'linear-gradient(to bottom, #0066cc, #0052a3)',
      minHeight: '80px',
      height: '80px'
    }}>
      {/* ROL Logo */}
      <div className="flex items-center gap-3">
        <Image
          src="/images/icon-ROL.png"
          alt="ROL"
          width={48}
          height={48}
          className="object-contain"
        />
        <div className="text-white text-base font-bold">{currentUser?.screenName || 'Guest'}</div>
      </div>

      {/* Top Bar Buttons */}
      <div className="flex items-center gap-1 flex-1 justify-center">
        {TOP_BAR_BUTTONS.map((button) => (
          <button
            key={button.id}
            onClick={() => handleButtonClick(button.id)}
            className="flex flex-col items-center justify-center px-2 py-1 hover:bg-blue-700 active:bg-blue-800 border border-transparent hover:border-blue-500 rounded"
            title={button.label}
          >
            <Image
              src={button.icon}
              alt={button.label}
              width={48}
              height={48}
              className="object-contain"
            />
            <span className="text-xs text-white leading-tight mt-1">{button.label}</span>
          </button>
        ))}
      </div>

      {/* Sign Off Button */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleSignOff}
          className="px-4 py-2 bg-red-600 text-white text-sm font-semibold border border-red-700 hover:bg-red-700 active:bg-red-800 rounded"
        >
          Sign Off
        </button>
      </div>
    </div>
  );
}
