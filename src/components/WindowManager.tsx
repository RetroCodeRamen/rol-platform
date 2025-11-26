'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/state/store';
import WindowComponent from './Window';
import DialogWindow from './DialogWindow';
import BuddyRequestWindow from './BuddyRequestWindow';
import { getWindowConfig } from '@/lib/windows/WindowRegistry';
import '@/lib/windows/registerWindows'; // Side effect: registers all windows

export default function WindowManager() {
  const windows = useAppStore((state) => state.windows);

  const renderWindowContent = (window: typeof windows[0]) => {
    // Handle dialog windows specially
    if (window.type === 'dialog' && window.dialogProps) {
      return <DialogWindow window={window} title={window.title} {...window.dialogProps} />;
    }

    // Handle buddy request windows specially
    if (window.type === 'buddyrequest' && window.buddyRequestProps) {
      return (
        <BuddyRequestWindow
          window={window}
          requesterUsername={window.buddyRequestProps.requesterUsername}
          onAccept={window.buddyRequestProps.onAccept}
          onIgnore={window.buddyRequestProps.onIgnore}
        />
      );
    }

    const config = getWindowConfig(window.type);
    if (!config) {
      console.warn(`No window config found for type: ${window.type}`);
      return null;
    }

    const Component = config.component;
    // Pass window props to components that need them (like IM windows with participant)
    // Components that don't need it can ignore the prop by making it optional
    try {
      return <Component window={window} />;
    } catch (error) {
      // Fallback: try without window prop if component doesn't accept it
      return <Component />;
    }
  };

  const getWindowIcon = (type: typeof windows[0]['type'], title?: string) => {
    // Check if this is a Favorites window by title
    if (title === 'Favorites') {
      return '/images/icon-fav.png';
    }
    if (type === 'dialog') return '💬';
    if (type === 'buddyrequest') return '👤';
    const config = getWindowConfig(type);
    return config?.icon || '';
  };

  return (
    <>
      {windows.map((window) => (
        <WindowComponent key={window.id} window={window} icon={getWindowIcon(window.type, window.title)}>
          {renderWindowContent(window)}
        </WindowComponent>
      ))}
    </>
  );
}

