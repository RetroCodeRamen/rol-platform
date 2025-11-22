/**
 * Window Action Registration
 * 
 * Central place to register all button actions.
 * Adding a new button: register action here, no need to modify TopNavBar.
 */

import { registerAction } from './WindowActions';

// Register all button actions
registerAction('read', {
  windowType: 'mail',
  title: 'Mail',
  handler: (openWindow) => {
    // Clear any previous mail view mode
    sessionStorage.removeItem('mailViewMode');
    openWindow('mail', 'Mail');
  },
});

registerAction('write', {
  windowType: 'mail',
  title: 'Write Mail',
  handler: (openWindow) => {
    // Set compose mode
    sessionStorage.setItem('mailViewMode', 'compose');
    openWindow('mail', 'Write Mail');
  },
});

registerAction('messenger', {
  windowType: 'buddylist',
  title: 'Buddy List',
  handler: (openWindow, getWindowByType, bringToFront) => {
    // Singleton window - check if exists
    if (getWindowByType && bringToFront) {
      const existing = getWindowByType('buddylist');
      if (existing) {
        bringToFront(existing.id);
        return;
      }
    }
    openWindow('buddylist', 'Buddy List');
  },
});

registerAction('channels', {
  windowType: 'channels',
  title: 'Channels',
});

registerAction('my-aol', {
  windowType: 'settings',
  title: 'My ROL',
  handler: (openWindow, getWindowByType, bringToFront) => {
    // Opens settings window (singleton)
    if (getWindowByType && bringToFront) {
      const existing = getWindowByType('settings');
      if (existing) {
        bringToFront(existing.id);
        return;
      }
    }
    openWindow('settings', 'My ROL');
  },
});

// Placeholder actions for future buttons
registerAction('print', {
  windowType: 'web', // Placeholder
  title: 'Print',
  handler: () => {
    console.log('Print action - not yet implemented');
  },
});

registerAction('my-files', {
  windowType: 'web', // Placeholder
  title: 'My Files',
  handler: () => {
    console.log('My Files action - not yet implemented');
  },
});

registerAction('favorites', {
  windowType: 'web', // Placeholder
  title: 'Favorites',
  handler: () => {
    console.log('Favorites action - not yet implemented');
  },
});

registerAction('internet', {
  windowType: 'web',
  title: 'ROL RamenDesk Edition',
});

registerAction('quotes', {
  windowType: 'web', // Placeholder
  title: 'Quotes',
  handler: () => {
    console.log('Quotes action - not yet implemented');
  },
});

registerAction('perks', {
  windowType: 'web', // Placeholder
  title: 'Perks',
  handler: () => {
    console.log('Perks action - not yet implemented');
  },
});

registerAction('weather', {
  windowType: 'weather',
  title: 'Weather',
  handler: (openWindow, getWindowByType, bringToFront) => {
    // Singleton window - check if exists
    if (getWindowByType && bringToFront) {
      const existing = getWindowByType('weather');
      if (existing) {
        bringToFront(existing.id);
        return;
      }
    }
    openWindow('weather', 'Weather');
  },
});

