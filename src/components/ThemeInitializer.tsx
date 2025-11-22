'use client';

import { useEffect } from 'react';
import { getCurrentTheme, applyTheme } from '@/lib/themes/themeSystem';

/**
 * Theme Initializer Component
 * 
 * Initializes theme on mount and applies it to the document
 */
export function ThemeInitializer() {
  useEffect(() => {
    // Apply theme on mount
    const theme = getCurrentTheme();
    applyTheme(theme);
  }, []);

  return null; // This component doesn't render anything
}




