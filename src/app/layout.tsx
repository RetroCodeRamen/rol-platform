import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ramen Online (ROL) - RetroCodeRamen',
  description: 'Ramen Online - Retro dial-up experience - Frontend & Backend',
}

// Theme application script that runs before React hydrates
const themeScript = `
(function() {
  try {
    const themes = {
      aol5: {
        '--aol-blue': '#0A2A73',
        '--aol-blue-light': '#1A3EA0',
        '--aol-blue-dark': '#0A2A73',
        '--icon-yellow': '#FDC700',
        '--sidebar-teal': '#00889B',
        '--light-gray': '#C8C8C8',
        '--window-white': '#F2F2F2',
        '--title-bar-top': '#1A3EA0',
        '--title-bar-bottom': '#0A2A73',
        '--window-bg': '#F2F2F2',
        '--window-border': '#808080',
        '--text-primary': '#000000',
        '--text-secondary': '#333333',
        '--button-bg': '#C0C0C0',
        '--button-hover': '#D0D0D0',
        '--button-text': '#000000',
        '--window-border-width': '3px',
        '--window-border-style': 'solid',
        '--window-border-radius': '0px',
        '--button-border-radius': '0px',
        '--font-family': 'Arial, sans-serif',
        '--font-size': '11px',
        '--font-smoothing': 'none'
      },
      aol7: {
        '--aol-blue': '#3A6EA5',
        '--aol-blue-light': '#74A7E5',
        '--aol-blue-dark': '#2A5A8A',
        '--icon-yellow': '#FF9C00',
        '--sidebar-teal': '#0092C9',
        '--light-gray': '#D7DCE2',
        '--window-white': '#F0F3F5',
        '--title-bar-top': '#74A7E5',
        '--title-bar-bottom': '#3A6EA5',
        '--window-bg': '#F0F3F5',
        '--window-border': '#B0B0B0',
        '--text-primary': '#000000',
        '--text-secondary': '#333333',
        '--button-bg': '#E8F2FF',
        '--button-hover': '#D0E5FF',
        '--button-text': '#3A6EA5',
        '--window-border-width': '1px',
        '--window-border-style': 'solid',
        '--window-border-radius': '6px',
        '--button-border-radius': '12px',
        '--font-family': 'Tahoma, Arial, sans-serif',
        '--font-size': '12px',
        '--font-smoothing': 'antialiased'
      }
    };
    
    const getTheme = () => {
      try {
        const saved = localStorage.getItem('rol-theme');
        return (saved === 'aol5' || saved === 'aol7') ? saved : 'aol7';
      } catch (e) {
        return 'aol7';
      }
    };
    
    const applyTheme = (themeName) => {
      const theme = themes[themeName];
      if (!theme) return;
      
      const root = document.documentElement;
      Object.entries(theme).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
      
      document.body.className = document.body.className.replace(/theme-\\w+/g, '');
      document.body.classList.add('theme-' + themeName);
    };
    
    applyTheme(getTheme());
  } catch (e) {
    console.error('Theme initialization error:', e);
  }
})();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}

