'use client';

import { useState, useEffect } from 'react';
import { getCurrentTheme, setTheme, themes, type ThemeName } from '@/lib/themes/themeSystem';
import { useAppStore } from '@/state/store';
import type { Window } from '@/state/store';

interface SettingsWindowProps {
  window?: Window;
}

export default function SettingsWindow({ window }: SettingsWindowProps = {}) {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('aol7');
  const [themeChanged, setThemeChanged] = useState(false);
  const userSettings = useAppStore((state) => state.userSettings);
  const setUserSettings = useAppStore((state) => state.setUserSettings);

  useEffect(() => {
    setCurrentTheme(getCurrentTheme());
  }, []);

  const handleThemeChange = (themeName: ThemeName) => {
    setTheme(themeName);
    setCurrentTheme(themeName);
    setThemeChanged(true);
    setTimeout(() => setThemeChanged(false), 2000);
  };

  return (
    <div 
      className="h-full overflow-auto retro-scrollbar p-6"
      style={{ backgroundColor: '#F2F2F2' }}
    >
      <div className="max-w-2xl mx-auto">
        <div className="bg-white border-2 border-gray-400 rounded p-6 mb-4">
          <h2 className="text-xl font-bold text-gray-800 mb-4">My ROL Settings</h2>
          
          {/* Theme Selection */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Theme</h3>
            <div className="space-y-2">
              {Object.values(themes).map((theme) => (
                <label
                  key={theme.name}
                  className="flex items-center p-3 border-2 border-gray-300 rounded cursor-pointer hover:bg-gray-50"
                  style={{
                    borderColor: currentTheme === theme.name ? '#0A2A73' : '#C8C8C8',
                    backgroundColor: currentTheme === theme.name ? '#E6F2FF' : '#FFFFFF',
                  }}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={theme.name}
                    checked={currentTheme === theme.name}
                    onChange={() => handleThemeChange(theme.name)}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">{theme.displayName}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {theme.name === 'aol5' 
                        ? 'Classic late-90s AOL with chunky beveled windows and bold colors'
                        : 'XP-era AOL 7.0-9.0 with soft blues, rounded corners, glossy buttons, and airy layout'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            {themeChanged && (
              <div className="mt-3 p-2 bg-green-100 border border-green-300 rounded text-sm text-green-800">
                Theme changed! Refresh the page to see all changes.
              </div>
            )}
          </div>

          {/* IM Settings */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Instant Messages</h3>
            <div className="space-y-3">
              <label className="flex items-center p-3 border-2 border-gray-300 rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={userSettings.autoOpenIMs}
                  onChange={(e) => {
                    setUserSettings({ autoOpenIMs: e.target.checked });
                  }}
                  className="mr-3"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-800">Auto-open new IM windows</div>
                  <div className="text-xs text-gray-600 mt-1">
                    When disabled, new IMs will show as bold with asterisk (*username) in your buddy list until opened
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Other Settings Sections (Placeholder) */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Account</h3>
            <div className="text-sm text-gray-600">
              Account settings coming soon...
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Notifications</h3>
            <div className="text-sm text-gray-600">
              Notification settings coming soon...
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Privacy</h3>
            <div className="text-sm text-gray-600">
              Privacy settings coming soon...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

