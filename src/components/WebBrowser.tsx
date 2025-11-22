'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * ROL RamenDesk Edition Browser Component
 * Simple webpage viewer with retro styling
 */

// Use full URL for iframe compatibility
const getDefaultUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/default_index.html`;
  }
  return '/default_index.html';
};

const DEFAULT_HOME_URL = getDefaultUrl();

export default function WebBrowser() {
  // Get full URL for iframe - must be absolute for same-origin iframe to work
  const getDefaultUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.host}/default_index.html`;
    }
    return '/default_index.html';
  };
  
  const defaultUrl = getDefaultUrl();
  const [url, setUrl] = useState(defaultUrl);
  const [currentUrl, setCurrentUrl] = useState(defaultUrl);
  const [isLoading, setIsLoading] = useState(true); // Start loading
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([defaultUrl]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle iframe load events
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Set loading state when URL changes
    setIsLoading(true);
    setError(null);

    const handleLoad = () => {
      setIsLoading(false);
      setError(null);
      // Update current URL from iframe (if allowed by CORS)
      try {
        const iframeUrl = iframe.contentWindow?.location.href;
        if (iframeUrl && iframeUrl !== 'about:blank') {
          setCurrentUrl(iframeUrl);
          setUrl(iframeUrl);
        }
      } catch (e) {
        // Cross-origin restrictions - can't read iframe URL
        // This is expected for external sites
      }
    };

    const handleError = () => {
      setIsLoading(false);
      setError('Failed to load page. Please check the URL and try again.');
    };

    // Timeout to catch pages that don't load
    const timeoutId = setTimeout(() => {
      // Check if iframe is still loading after 10 seconds
      if (isLoading) {
        setIsLoading(false);
        // Don't set error immediately - might still be loading
      }
    }, 10000);

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    return () => {
      clearTimeout(timeoutId);
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  }, [currentUrl, isLoading]);

  const normalizeUrl = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return currentUrl;

    // If it already has a protocol, use it
    if (trimmed.match(/^https?:\/\//i)) {
      return trimmed;
    }

    // If it starts with /, it's a relative URL - use it as-is
    if (trimmed.startsWith('/')) {
      return trimmed;
    }

    // If it looks like a domain (has dots and no spaces), add https://
    if (trimmed.includes('.') && !trimmed.includes(' ')) {
      return `https://${trimmed}`;
    }

    // Otherwise, treat as a search query (Google search)
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
  };

  const navigateTo = (newUrl: string) => {
    const normalizedUrl = normalizeUrl(newUrl);
    setIsLoading(true);
    setError(null);
    setCurrentUrl(normalizedUrl);
    setUrl(normalizedUrl);

    // Update history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(normalizedUrl);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleGo = () => {
    navigateTo(url);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleGo();
    }
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const newUrl = history[newIndex];
      setHistoryIndex(newIndex);
      setIsLoading(true);
      setError(null);
      setCurrentUrl(newUrl);
      setUrl(newUrl);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const newUrl = history[newIndex];
      setHistoryIndex(newIndex);
      setIsLoading(true);
      setError(null);
      setCurrentUrl(newUrl);
      setUrl(newUrl);
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      setError(null);
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleHome = () => {
    const homeUrl = typeof window !== 'undefined' ? `${window.location.origin}/default_index.html` : '/default_index.html';
    navigateTo(homeUrl);
  };

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Browser Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b-2 border-gray-400 bg-gray-200" style={{ borderStyle: 'inset' }}>
        {/* Navigation Buttons */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleBack}
            disabled={!canGoBack}
            className="px-2 py-1 text-xs font-semibold border-2 border-gray-400 bg-gray-300 hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: '#808080 #ffffff #ffffff #808080',
              boxShadow: 'inset 1px 1px 0 #000000, inset -1px -1px 0 #c0c0c0',
            }}
            title="Back"
          >
            ←
          </button>
          <button
            onClick={handleForward}
            disabled={!canGoForward}
            className="px-2 py-1 text-xs font-semibold border-2 border-gray-400 bg-gray-300 hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: '#808080 #ffffff #ffffff #808080',
              boxShadow: 'inset 1px 1px 0 #000000, inset -1px -1px 0 #c0c0c0',
            }}
            title="Forward"
          >
            →
          </button>
          <button
            onClick={handleRefresh}
            className="px-2 py-1 text-xs font-semibold border-2 border-gray-400 bg-gray-300 hover:bg-gray-400"
            style={{
              borderColor: '#808080 #ffffff #ffffff #808080',
              boxShadow: 'inset 1px 1px 0 #000000, inset -1px -1px 0 #c0c0c0',
            }}
            title="Refresh"
          >
            ↻
          </button>
          <button
            onClick={handleHome}
            className="px-2 py-1 text-xs font-semibold border-2 border-gray-400 bg-gray-300 hover:bg-gray-400"
            style={{
              borderColor: '#808080 #ffffff #ffffff #808080',
              boxShadow: 'inset 1px 1px 0 #000000, inset -1px -1px 0 #c0c0c0',
            }}
            title="Home"
          >
            ⌂
          </button>
        </div>

        {/* Address Bar */}
        <div className="flex-1 flex items-center gap-1 ml-2">
          <label htmlFor="url-input" className="text-xs font-semibold text-gray-700 whitespace-nowrap">
            Address:
          </label>
          <input
            id="url-input"
            ref={inputRef}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 px-2 py-1 text-xs border-2 border-gray-400 bg-white"
            style={{
              borderColor: '#808080 #ffffff #ffffff #808080',
              boxShadow: 'inset 1px 1px 0 #000000, inset -1px -1px 0 #c0c0c0',
            }}
            placeholder="Enter URL or search..."
          />
          <button
            onClick={handleGo}
            className="px-3 py-1 text-xs font-semibold border-2 border-gray-400 bg-blue-500 text-white hover:bg-blue-600"
            style={{
              borderColor: '#ffffff #808080 #808080 #ffffff',
              boxShadow: 'inset -1px -1px 0 #000000, inset 1px 1px 0 #c0c0c0',
            }}
          >
            Go
          </button>
        </div>

        {/* Loading Indicator */}
        {isLoading && (
          <div className="ml-2 text-xs text-gray-600">
            Loading...
          </div>
        )}
      </div>

      {/* Browser Content Area */}
      <div className="flex-1 relative overflow-hidden bg-white">
        {error ? (
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-lg font-bold text-red-600 mb-2">Error Loading Page</h3>
              <p className="text-sm text-gray-700 mb-4">{error}</p>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 text-sm font-semibold border-2 border-gray-400 bg-blue-500 text-white hover:bg-blue-600"
                style={{
                  borderColor: '#ffffff #808080 #808080 #ffffff',
                  boxShadow: 'inset -1px -1px 0 #000000, inset 1px 1px 0 #c0c0c0',
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={currentUrl}
            className="w-full h-full border-0"
            title="Web Browser Content"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-navigation"
            allow="fullscreen"
            onLoad={() => {
              setIsLoading(false);
              setError(null);
            }}
            onError={() => {
              setIsLoading(false);
              setError('Failed to load page. The page may have blocked iframe embedding or the URL is invalid.');
            }}
          />
        )}
      </div>

      {/* Status Bar */}
      <div className="px-2 py-1 text-xs bg-gray-200 border-t-2 border-gray-400" style={{ borderStyle: 'inset' }}>
        <span className="text-gray-700">
          {isLoading ? 'Loading...' : error ? `Error: ${error}` : currentUrl}
        </span>
      </div>
    </div>
  );
}
