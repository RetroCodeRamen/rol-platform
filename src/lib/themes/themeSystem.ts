/**
 * Theme System for RamenOnline
 * 
 * Supports switching between AOL 5.0 and AOL 7.0-9.0 era themes
 */

export type ThemeName = 'aol5' | 'aol7';

export interface Theme {
  name: ThemeName;
  displayName: string;
  colors: {
    // Core AOL colors
    aolBlue: string;
    aolBlueLight: string;
    aolBlueDark: string;
    iconYellow: string;
    sidebarTeal: string;
    lightGray: string;
    white: string;
    // Title bar gradient
    titleBarTop: string;
    titleBarBottom: string;
    // Window colors
    windowBg: string;
    windowBorder: string;
    // Text colors
    textPrimary: string;
    textSecondary: string;
    // Button colors
    buttonBg: string;
    buttonHover: string;
    buttonText: string;
  };
  styles: {
    // Window styles
    windowBorderWidth: string;
    windowBorderStyle: string;
    windowBorderRadius: string;
    // Button styles
    buttonBorderRadius: string;
    buttonBevel: boolean;
    // Font styles
    fontFamily: string;
    fontSize: string;
    fontSmoothing: string;
  };
}

export const themes: Record<ThemeName, Theme> = {
  aol5: {
    name: 'aol5',
    displayName: 'AOL 5.0 (Classic)',
    colors: {
      aolBlue: '#0A2A73',
      aolBlueLight: '#1A3EA0',
      aolBlueDark: '#0A2A73',
      iconYellow: '#FDC700',
      sidebarTeal: '#00889B',
      lightGray: '#C8C8C8',
      white: '#F2F2F2',
      titleBarTop: '#1A3EA0',
      titleBarBottom: '#0A2A73',
      windowBg: '#F2F2F2',
      windowBorder: '#808080',
      textPrimary: '#000000',
      textSecondary: '#333333',
      buttonBg: '#C0C0C0',
      buttonHover: '#D0D0D0',
      buttonText: '#000000',
    },
    styles: {
      windowBorderWidth: '3px',
      windowBorderStyle: 'solid',
      windowBorderRadius: '0px',
      buttonBorderRadius: '0px',
      buttonBevel: true,
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      fontSmoothing: 'none', // No anti-aliasing for crunchy pixel edges
    },
  },
  aol7: {
    name: 'aol7',
    displayName: 'AOL 7.0-9.0 (Modern)',
    colors: {
      aolBlue: '#3A6EA5', // XP soft blue
      aolBlueLight: '#74A7E5', // Lighter XP blue
      aolBlueDark: '#2A5A8A', // Darker XP blue
      iconYellow: '#FF9C00', // Orange highlight (XP style)
      sidebarTeal: '#0092C9', // Turquoise
      lightGray: '#D7DCE2', // Silver-gray
      white: '#F0F3F5', // Off-white XP background
      titleBarTop: '#74A7E5', // Light XP blue gradient top
      titleBarBottom: '#3A6EA5', // Darker XP blue gradient bottom
      windowBg: '#F0F3F5', // XP off-white
      windowBorder: '#B0B0B0', // Light gray border
      textPrimary: '#000000',
      textSecondary: '#333333',
      buttonBg: '#E8F2FF', // Light blue button background
      buttonHover: '#D0E5FF', // Hover state
      buttonText: '#3A6EA5', // XP blue text
    },
    styles: {
      windowBorderWidth: '1px', // Thin borders
      windowBorderStyle: 'solid',
      windowBorderRadius: '6px', // Rounded corners
      buttonBorderRadius: '12px', // Rounded pill buttons
      buttonBevel: false,
      fontFamily: 'Tahoma, Arial, sans-serif',
      fontSize: '12px',
      fontSmoothing: 'antialiased',
    },
  },
};

/**
 * Get current theme from localStorage or default
 */
export function getCurrentTheme(): ThemeName {
  if (typeof window === 'undefined') return 'aol7';
  const saved = localStorage.getItem('rol-theme') as ThemeName;
  return saved && themes[saved] ? saved : 'aol7';
}

/**
 * Set theme and apply it to the document
 */
export function setTheme(themeName: ThemeName): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('rol-theme', themeName);
  applyTheme(themeName);
  // Dispatch custom event for components to listen to
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: themeName } }));
}

/**
 * Apply theme CSS variables to document root
 */
export function applyTheme(themeName: ThemeName): void {
  if (typeof document === 'undefined') return;
  const theme = themes[themeName];
  const root = document.documentElement;
  
  // Set CSS variables
  root.style.setProperty('--aol-blue', theme.colors.aolBlue);
  root.style.setProperty('--aol-blue-light', theme.colors.aolBlueLight);
  root.style.setProperty('--aol-blue-dark', theme.colors.aolBlueDark);
  root.style.setProperty('--icon-yellow', theme.colors.iconYellow);
  root.style.setProperty('--sidebar-teal', theme.colors.sidebarTeal);
  root.style.setProperty('--light-gray', theme.colors.lightGray);
  root.style.setProperty('--window-white', theme.colors.white);
  root.style.setProperty('--title-bar-top', theme.colors.titleBarTop);
  root.style.setProperty('--title-bar-bottom', theme.colors.titleBarBottom);
  root.style.setProperty('--window-bg', theme.colors.windowBg);
  root.style.setProperty('--window-border', theme.colors.windowBorder);
  root.style.setProperty('--text-primary', theme.colors.textPrimary);
  root.style.setProperty('--text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--button-bg', theme.colors.buttonBg);
  root.style.setProperty('--button-hover', theme.colors.buttonHover);
  root.style.setProperty('--button-text', theme.colors.buttonText);
  
  root.style.setProperty('--window-border-width', theme.styles.windowBorderWidth);
  root.style.setProperty('--window-border-style', theme.styles.windowBorderStyle);
  root.style.setProperty('--window-border-radius', theme.styles.windowBorderRadius);
  root.style.setProperty('--button-border-radius', theme.styles.buttonBorderRadius);
  root.style.setProperty('--font-family', theme.styles.fontFamily);
  root.style.setProperty('--font-size', theme.styles.fontSize);
  root.style.setProperty('--font-smoothing', theme.styles.fontSmoothing);
  
  // Add theme class to body for conditional styling
  document.body.className = document.body.className.replace(/theme-\w+/g, '');
  document.body.classList.add(`theme-${themeName}`);
}

// Initialize theme on load
if (typeof window !== 'undefined') {
  applyTheme(getCurrentTheme());
}

