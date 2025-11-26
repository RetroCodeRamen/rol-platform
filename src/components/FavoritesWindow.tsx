'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/state/store';
import { dispatchMessage } from '@/lib/messaging/AppMessageHandler';
import Image from 'next/image';

interface Favorite {
  id: string;
  title: string;
  windowType: string;
  url?: string;
  options?: any;
  createdAt: string;
}

export default function FavoritesWindow() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const openWindow = useAppStore((state) => state.openWindow);
  const currentUser = useAppStore((state) => state.currentUser);

  useEffect(() => {
    loadFavorites();
    
    // Subscribe to favorite added/removed events to refresh the list
    const setupFavoriteListener = async () => {
      const { subscribeToMessage } = await import('@/lib/messaging/AppMessageHandler');
      
      const unsubscribeAdded = subscribeToMessage('FAVORITE_ADDED', () => {
        loadFavorites(); // Refresh when a favorite is added
      });
      
      const unsubscribeRemoved = subscribeToMessage('FAVORITE_REMOVED', () => {
        loadFavorites(); // Refresh when a favorite is removed
      });
      
      return () => {
        unsubscribeAdded();
        unsubscribeRemoved();
      };
    };
    
    let unsubscribe: (() => void) | null = null;
    setupFavoriteListener().then((unsub) => {
      unsubscribe = unsub;
    });
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const loadFavorites = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/favorites', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setFavorites(data.favorites || []);
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenFavorite = (favorite: Favorite) => {
    // Open the window based on the favorite's stored data
    openWindow(
      favorite.windowType as any,
      favorite.title,
      favorite.options || (favorite.url ? { url: favorite.url } : undefined)
    );
  };

  const handleDeleteFavorite = async (id: string) => {
    try {
      const response = await fetch('/api/favorites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (data.success) {
        setFavorites(favorites.filter((fav) => fav.id !== id));
        // Notify that a favorite was removed
        dispatchMessage('FAVORITE_REMOVED', { id });
        dispatchMessage('SYSTEM_ALERT', {
          message: 'Favorite removed',
          title: 'Success',
        });
      } else {
        dispatchMessage('SYSTEM_ALERT', {
          message: data.error || 'Failed to remove favorite',
          title: 'Error',
        });
      }
    } catch (error) {
      dispatchMessage('SYSTEM_ALERT', {
        message: 'Failed to remove favorite',
        title: 'Error',
      });
    }
  };

  const getWindowIcon = (windowType: string) => {
    // Return appropriate icon based on window type
    const iconMap: Record<string, string> = {
      web: '🌐',
      mail: '✉',
      im: '💭',
      chat: '💬',
      forums: '📋',
      buddylist: '👥',
      channels: '📺',
      welcome: '👋',
      weather: '🌤️',
      profile: '👤',
      settings: '⚙️',
    };
    return iconMap[windowType] || '📄';
  };

  return (
    <div className="h-full w-full flex flex-col" style={{ backgroundColor: '#e6f2ff' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b-2 border-gray-400 bg-gray-200">
        <h2 className="text-lg font-bold text-gray-800">Favorites</h2>
        <p className="text-xs text-gray-600 mt-1">
          {favorites.length} {favorites.length === 1 ? 'favorite' : 'favorites'}
        </p>
      </div>

      {/* Favorites List */}
      <div className="flex-1 overflow-y-auto retro-scrollbar p-4">
        {isLoading ? (
          <div className="text-center text-gray-600 py-8">Loading favorites...</div>
        ) : favorites.length === 0 ? (
          <div className="text-center text-gray-600 py-8">
            <p className="text-lg mb-2">No favorites yet</p>
            <p className="text-sm">
              Click the favorites icon in any window title bar to add it to your favorites.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {favorites.map((favorite) => (
              <div
                key={favorite.id}
                className="flex items-center gap-3 p-3 bg-white border-2 border-gray-400 hover:bg-gray-50 cursor-pointer"
                style={{
                  boxShadow: 'inset 1px 1px 0 rgba(0,0,0,0.1)',
                }}
                onDoubleClick={() => handleOpenFavorite(favorite)}
              >
                {/* Icon */}
                <div className="flex-shrink-0 text-2xl">{getWindowIcon(favorite.windowType)}</div>

                {/* Favorite Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 truncate">{favorite.title}</div>
                  {favorite.url && (
                    <div className="text-xs text-gray-600 truncate mt-1">{favorite.url}</div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(favorite.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleOpenFavorite(favorite)}
                    className="px-3 py-1 text-xs font-semibold border-2 border-gray-400 bg-blue-500 text-white hover:bg-blue-600"
                    style={{
                      borderColor: '#ffffff #808080 #808080 #ffffff',
                      boxShadow: 'inset -1px -1px 0 #000000, inset 1px 1px 0 #c0c0c0',
                    }}
                    title="Open"
                  >
                    Open
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFavorite(favorite.id);
                    }}
                    className="px-3 py-1 text-xs font-semibold border-2 border-gray-400 bg-red-500 text-white hover:bg-red-600"
                    style={{
                      borderColor: '#ffffff #808080 #808080 #ffffff',
                      boxShadow: 'inset -1px -1px 0 #000000, inset 1px 1px 0 #c0c0c0',
                    }}
                    title="Delete"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

