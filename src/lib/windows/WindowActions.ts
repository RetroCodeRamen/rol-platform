/**
 * Window Action Registry
 * 
 * Decouples button actions from TopNavBar component.
 * Adding a new button action only requires registering it here.
 */

import type { WindowType } from '@/state/store';

export interface WindowAction {
  windowType: WindowType;
  title: string;
  options?: {
    // Window-specific options
    participant?: string;
    username?: string;
    [key: string]: any;
  };
  // Custom handler if needed (overrides default behavior)
  handler?: (
    openWindow: (type: WindowType, title: string, options?: any) => string,
    getWindowByType?: (type: WindowType, participant?: string) => any,
    bringToFront?: (id: string) => void
  ) => void;
}

type ActionRegistry = Record<string, WindowAction>;

const registry: ActionRegistry = {};

/**
 * Register a button action
 */
export function registerAction(buttonId: string, action: WindowAction): void {
  registry[buttonId] = action;
}

/**
 * Get action for a button
 */
export function getAction(buttonId: string): WindowAction | undefined {
  return registry[buttonId];
}

/**
 * Execute an action
 */
export function executeAction(
  buttonId: string,
  openWindow: (type: WindowType, title: string, options?: any) => string,
  getWindowByType?: (type: WindowType, participant?: string) => any,
  bringToFront?: (id: string) => void
): void {
  const action = getAction(buttonId);
  if (!action) {
    console.warn(`No action registered for button: ${buttonId}`);
    return;
  }

  // If custom handler exists, use it
  if (action.handler) {
    action.handler(openWindow, getWindowByType, bringToFront);
    return;
  }

  // Default handler: check for singleton windows or unique windows
  const windowType = action.windowType;
  
  // Check if this is a singleton window (like buddylist)
  if (windowType === 'buddylist' && getWindowByType && bringToFront) {
    const existing = getWindowByType(windowType);
    if (existing) {
      bringToFront(existing.id);
      return;
    }
  }

  // Check if this is a unique-by-participant window (like IM)
  if (windowType === 'im' && action.options?.participant && getWindowByType && bringToFront) {
    const existing = getWindowByType(windowType, action.options.participant);
    if (existing) {
      bringToFront(existing.id);
      return;
    }
  }

  // Open new window
  openWindow(windowType, action.title, action.options);
}

