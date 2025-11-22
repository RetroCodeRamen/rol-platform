'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { useAppStore } from '@/state/store';
import { getCurrentTheme } from '@/lib/themes/themeSystem';
import type { Window } from '@/state/store';

interface WindowProps {
  window: Window;
  children: ReactNode;
  icon?: string;
}

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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        const parent = windowRef.current?.parentElement;
        if (parent) {
          const parentRect = parent.getBoundingClientRect();
          const newX = Math.max(0, Math.min(windowData.x + deltaX, parentRect.width - windowData.width));
          const newY = Math.max(0, Math.min(windowData.y + deltaY, parentRect.height - 24)); // 24px for title bar
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

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart, windowData, updateWindow]);

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
      {/* ROL Title Bar - Theme-aware Gradient */}
      <div
        ref={titleBarRef}
        className="aol-title-bar text-white px-2 py-0.5 flex items-center justify-between cursor-move select-none"
        style={{
          background: 'linear-gradient(to bottom, var(--title-bar-top), var(--title-bar-bottom))',
          height: currentTheme === 'aol5' ? '20px' : '24px',
          fontSize: 'var(--font-size)',
          fontFamily: 'var(--font-family)',
        }}
        onMouseDown={handleTitleBarMouseDown}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {icon && <span className="text-xs">{icon}</span>}
          <span className="text-xs font-semibold truncate">{windowData.title}</span>
        </div>
        <div className="flex items-center gap-0.5 ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              minimizeWindow(windowData.id);
            }}
            className="w-4 h-4 flex items-center justify-center text-xs font-bold hover:bg-blue-800 border border-blue-900 bg-blue-700 text-white"
            title="Minimize"
          >
            _
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeWindow(windowData.id);
            }}
            className="w-4 h-4 flex items-center justify-center text-xs font-bold hover:bg-red-600 border border-red-800 bg-red-700 text-white"
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Window Content - Theme-aware Background */}
      <div 
        className="overflow-hidden" 
        style={{ 
          backgroundColor: 'var(--window-bg)',
          height: currentTheme === 'aol5' 
            ? 'calc(100% - 20px)' 
            : 'calc(100% - 24px)',
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
