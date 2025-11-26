/**
 * Window Registration
 * 
 * Central place to register all window types.
 * Adding a new window type: import component, register here.
 */

import { registerWindow } from './WindowRegistry';
import MailboxView from '@/components/EmailClient/MailboxView';
import ChatWindow from '@/components/ChatWindow';
import IMWindow from '@/components/IMWindow';
import ForumList from '@/components/Forums/ForumList';
import BuddyList from '@/components/BuddyList';
import SideBarChannels from '@/components/SideBarChannels';
import WelcomeWindow from '@/components/WelcomeWindow';
import WebBrowser from '@/components/WebBrowser';
import WeatherWindow from '@/components/WeatherWindow';
import ProfileWindow from '@/components/ProfileWindow';
import SettingsWindow from '@/components/SettingsWindow';
import FavoritesWindow from '@/components/FavoritesWindow';

// Register all window types
registerWindow('mail', {
  component: MailboxView,
  icon: '✉',
  defaultTitle: 'Mail',
  defaultSize: { width: 700, height: 500, x: 50, y: 50 },
});

registerWindow('chat', {
  component: ChatWindow,
  icon: '💬',
  defaultTitle: 'Chat Rooms',
  defaultSize: { width: 600, height: 450, x: 150, y: 80 },
});

registerWindow('im', {
  component: IMWindow,
  icon: '💭',
  defaultTitle: 'Instant Message',
  defaultSize: { width: 550, height: 400, x: 100, y: 100 },
  uniqueBy: 'participant', // Only one IM window per participant
});

registerWindow('forums', {
  component: ForumList,
  icon: '📋',
  defaultTitle: 'Forums',
  defaultSize: { width: 650, height: 500, x: 80, y: 120 },
});

registerWindow('buddylist', {
  component: BuddyList,
  icon: '👥',
  defaultTitle: 'Buddy List',
  defaultSize: { width: 200, height: 400, x: 20, y: 100 },
  singleton: true, // Only one buddy list allowed
});

registerWindow('channels', {
  component: SideBarChannels,
  icon: '📺',
  defaultTitle: 'Channels',
  defaultSize: { width: 550, height: 400, x: 120, y: 100 },
});

registerWindow('welcome', {
  component: WelcomeWindow,
  icon: '👋',
  defaultTitle: 'Welcome',
  defaultSize: { width: 500, height: 400, x: 150, y: 100 },
});

registerWindow('web', {
  component: WebBrowser,
  icon: '🌐',
  defaultTitle: 'ROL RamenDesk Edition',
  defaultSize: { width: 700, height: 500, x: 60, y: 60 },
});

registerWindow('weather', {
  component: WeatherWindow,
  icon: '🌤️',
  defaultTitle: 'Weather',
  defaultSize: { width: 500, height: 450, x: 100, y: 100 },
  singleton: true, // Only one weather window allowed
});

registerWindow('profile', {
  component: ProfileWindow,
  icon: '👤',
  defaultTitle: 'Profile',
  defaultSize: { width: 500, height: 500, x: 150, y: 100 },
});

registerWindow('settings', {
  component: SettingsWindow,
  icon: '⚙️',
  defaultTitle: 'My ROL',
  defaultSize: { width: 600, height: 500, x: 150, y: 100 },
  singleton: true, // Only one settings window allowed
});

registerWindow('favorites', {
  component: FavoritesWindow,
  icon: '/images/icon-fav.png',
  defaultTitle: 'Favorites',
  defaultSize: { width: 600, height: 500, x: 150, y: 100 },
  singleton: true, // Only one favorites window allowed
});

