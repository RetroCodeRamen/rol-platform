'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import Image from 'next/image';
import { useAppStore } from '@/state/store';
import { getCurrentTheme } from '@/lib/themes/themeSystem';
import { dispatchMessage } from '@/lib/messaging/AppMessageHandler';
import type { Window } from '@/state/store';

interface WindowProps {
  window: Window;
  children: ReactNode;
  icon?: string;
}

// Helper to check if window should show shortcut button
const shouldShowShortcutButton = (windowType: string): boolean => {
  return windowType !== 'im' && windowType !== 'mail';
};

// Win95-style button component for AOL 5.0 theme
const Win95Button = ({ 
  onClick, 
  title, 
  children,
  variant = 'minimize' 
}: { 
  onClick: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
  variant?: 'minimize' | 'maximize' | 'close';
}) => {
  const [isPressed, setIsPressed] = useState(false);
  
  const getButtonStyle = () => {
    const baseStyle: React.CSSProperties = {
      width: '18px',
      height: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '11px',
      fontFamily: 'Arial, sans-serif',
      fontWeight: 'bold',
      cursor: 'pointer',
      userSelect: 'none',
      border: '2px outset #C0C0C0',
      backgroundColor: '#C0C0C0',
      color: '#000000',
      padding: 0,
      margin: '0 1px',
    };

    if (isPressed) {
      return {
        ...baseStyle,
        border: '2px inset #C0C0C0',
        backgroundColor: '#808080',
      };
    }

    return baseStyle;
  };

  return (
    <button
      onClick={onClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      title={title}
      style={getButtonStyle()}
    >
      {children}
    </button>
  );
};

// Shortcut creator button (favorites icon)
const ShortcutButton = ({ 
  onClick 
}: { 
  onClick: (e: React.MouseEvent) => void;
}) => {
  return (
    <button
      onClick={onClick}
      title="Add to Favorites"
      style={{
        width: '18px',
        height: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        cursor: 'pointer',
        border: '1px solid #808080',
        backgroundColor: '#F0F0F0',
        padding: 0,
        margin: '0 1px',
        fontFamily: 'Arial, sans-serif',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#E0E0E0';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#F0F0F0';
      }}
    >
      <Image
        src="/images/icon-fav.png"
        alt="Add to Favorites"
        width={14}
        height={14}
        className="object-contain"
        style={{ display: 'block' }}
      />
    </button>
  );
};

export default function WindowComponent({ window: windowData, children, icon }: WindowProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [currentTheme, setCurrentTheme] = useState<'aol5' | 'aol7'>('aol7');
  
  const windowRef = useRef<HTMLDivElement>(null);
  const titleBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentTheme(getCurrentTheme());
    // Listen for theme changes via custom event
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: 'aol5' | 'aol7' }>;
      setCurrentTheme(customEvent.detail.theme);
    };
    // Use global window object (not the prop)
    if (typeof window !== 'undefined') {
      window.addEventListener('themechange', handleThemeChange);
      return () => {
        window.removeEventListener('themechange', handleThemeChange);
      };
    }
  }, []);
  
  const updateWindow = useAppStore((state) => state.updateWindow);
  const bringToFront = useAppStore((state) => state.bringToFront);
  const minimizeWindow = useAppStore((state) => state.minimizeWindow);
  const closeWindow = useAppStore((state) => state.closeWindow);

  // Calculate title bar height - thicker for both themes
  const titleBarHeight = currentTheme === 'aol5' ? '26px' : '28px';

  useEffect(() => {
    // Only add listeners when actually dragging or resizing
    if (!isDragging && !isResizing) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        const parent = windowRef.current?.parentElement;
        if (parent) {
          const parentRect = parent.getBoundingClientRect();
          const titleBarHeightNum = currentTheme === 'aol5' ? 26 : 28;
          const newX = Math.max(0, Math.min(windowData.x + deltaX, parentRect.width - windowData.width));
          const newY = Math.max(0, Math.min(windowData.y + deltaY, parentRect.height - titleBarHeightNum));
          updateWindow(windowData.id, { x: newX, y: newY });
        }
        setDragStart({ x: e.clientX, y: e.clientY });
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        const newWidth = Math.max(300, resizeStart.width + deltaX);
        const newHeight = Math.max(200, resizeStart.height + deltaY);
        updateWindow(windowData.id, { width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Always cleanup listeners when effect runs again or component unmounts
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, resizeStart, windowData, updateWindow, currentTheme]);

  const handleTitleBarMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    bringToFront(windowData.id);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: windowData.width,
      height: windowData.height,
    });
  };

  const handleClick = () => {
    bringToFront(windowData.id);
  };

  const handleCreateShortcut = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[Window] Creating shortcut for:', {
      windowId: windowData.id,
      windowType: windowData.type,
      title: windowData.title,
      url: windowData.type === 'web' ? windowData.url : undefined,
    });
    // Dispatch message for shortcut creation
    dispatchMessage('SHORTCUT_CREATED', {
      windowId: windowData.id,
      windowType: windowData.type,
      title: windowData.title,
      url: windowData.type === 'web' ? windowData.url : undefined,
    });
    
    // Favorite will be saved via SHORTCUT_CREATED handler in ROLShell
  };

  if (windowData.isMinimized) {
    return (
      <div
        className="absolute bottom-0 left-0 bg-blue-600 px-2 py-1 cursor-pointer hover:bg-blue-700 border border-blue-800"
        style={{ 
          left: `${Math.min(windowData.x, 20)}px`, 
          zIndex: windowData.zIndex,
        }}
        onClick={() => {
          const restoreWindow = useAppStore.getState().restoreWindow;
          restoreWindow(windowData.id);
        }}
      >
        <span className="text-xs text-white font-semibold">{windowData.title}</span>
      </div>
    );
  }

  const showShortcutButton = shouldShowShortcutButton(windowData.type);

  return (
    <div
      ref={windowRef}
      className="absolute aol-window"
      style={{
        left: `${windowData.x}px`,
        top: `${windowData.y}px`,
        width: `${windowData.width}px`,
        height: `${windowData.height}px`,
        zIndex: windowData.zIndex,
        backgroundColor: 'var(--window-bg)',
        borderColor: 'var(--window-border)',
        borderWidth: 'var(--window-border-width)',
        borderStyle: 'var(--window-border-style)',
        borderRadius: 'var(--window-border-radius)',
      }}
      onClick={handleClick}
    >
      {/* ROL Title Bar - Thicker for both themes, theme-aware buttons */}
      <div
        ref={titleBarRef}
        className="aol-title-bar text-white px-2 py-0.5 flex items-center justify-between cursor-move select-none"
        style={{
          background: 'linear-gradient(to bottom, var(--title-bar-top), var(--title-bar-bottom))',
          height: titleBarHeight,
          fontSize: 'var(--font-size)',
          fontFamily: 'var(--font-family)',
          padding: currentTheme === 'aol5' ? '2px 4px' : '3px 6px',
        }}
        onMouseDown={handleTitleBarMouseDown}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {icon && (
            icon.startsWith('/') ? (
              <Image
                src={icon}
                alt=""
                width={16}
                height={16}
                className="object-contain"
                style={{ flexShrink: 0 }}
              />
            ) : (
              <span className="text-xs">{icon}</span>
            )
          )}
          <span 
            className="text-xs font-semibold truncate"
            style={{
              fontSize: currentTheme === 'aol5' ? '11px' : '12px',
              lineHeight: titleBarHeight,
            }}
          >
            {windowData.title}
          </span>
        </div>
        <div className="flex items-center gap-0.5 ml-2">
          {/* Shortcut Creator Button (for non-IM/Email windows) */}
          {showShortcutButton && (
            <ShortcutButton onClick={handleCreateShortcut} />
          )}
          
          {/* Theme-aware window buttons */}
          {currentTheme === 'aol5' ? (
            // Win95-style buttons for AOL 5.0
            <>
              <Win95Button
                onClick={(e) => {
                  e.stopPropagation();
                  minimizeWindow(windowData.id);
                }}
                title="Minimize"
                variant="minimize"
              >
                _
              </Win95Button>
              <Win95Button
                onClick={(e) => {
                  e.stopPropagation();
                  closeWindow(windowData.id);
                }}
                title="Close"
                variant="close"
              >
                ×
              </Win95Button>
            </>
          ) : (
            // Modern buttons for AOL 7.0-9.0 (adjusted for thicker bar)
            <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              minimizeWindow(windowData.id);
            }}
                className="flex items-center justify-center text-xs font-bold hover:bg-blue-800 border border-blue-900 bg-blue-700 text-white"
            title="Minimize"
                style={{
                  width: '20px',
                  height: '18px',
                  fontSize: '12px',
                  padding: 0,
                  margin: '0 1px',
                }}
          >
            _
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeWindow(windowData.id);
            }}
                className="flex items-center justify-center text-xs font-bold hover:bg-red-600 border border-red-800 bg-red-700 text-white"
            title="Close"
                style={{
                  width: '20px',
                  height: '18px',
                  fontSize: '12px',
                  padding: 0,
                  margin: '0 1px',
                }}
          >
            ×
          </button>
            </>
          )}
        </div>
      </div>

      {/* Window Content - Adjusted for thicker title bar */}
      <div 
        className="overflow-hidden" 
        style={{ 
          backgroundColor: 'var(--window-bg)',
          height: `calc(100% - ${titleBarHeight})`,
        }}
      >
        {children}
      </div>

      {/* Resize Handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        onMouseDown={handleResizeMouseDown}
        style={{
          background: `
            repeating-linear-gradient(
              45deg,
              #c0c0c0,
              #c0c0c0 2px,
              #808080 2px,
              #808080 4px
            )
          `,
          borderTop: '1px solid #808080',
          borderLeft: '1px solid #808080',
        }}
      />
    </div>
  );
}
