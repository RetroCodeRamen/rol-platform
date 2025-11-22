/**
 * Window Registry Pattern
 * 
 * Decouples window type definitions from WindowManager.
 * Adding a new window type only requires registering it here,
 * not modifying WindowManager or other components.
 */

import { ComponentType } from 'react';
import type { WindowType, Window } from '@/state/store';

export interface WindowConfig {
  component: ComponentType<{ window?: Window }>; // Window prop is optional
  icon: string;
  defaultTitle: string;
  defaultSize: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
  // Window-specific behavior flags
  singleton?: boolean; // Only one instance allowed (e.g., buddylist)
  uniqueBy?: string; // Field to check for uniqueness (e.g., 'participant' for IM windows)
}

type WindowRegistry = Record<WindowType, WindowConfig>;

// Registry will be populated by registerWindow calls
const registry: Partial<WindowRegistry> = {};

/**
 * Register a window type configuration
 */
export function registerWindow(
  type: WindowType,
  config: WindowConfig
): void {
  registry[type] = config;
}

/**
 * Get window configuration for a type
 */
export function getWindowConfig(type: WindowType): WindowConfig | undefined {
  return registry[type];
}

/**
 * Get all registered window types
 */
export function getRegisteredWindowTypes(): WindowType[] {
  return Object.keys(registry) as WindowType[];
}

/**
 * Check if a window type is registered
 */
export function isWindowTypeRegistered(type: string): type is WindowType {
  return type in registry;
}

