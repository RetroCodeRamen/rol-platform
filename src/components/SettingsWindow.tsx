'use client';

import { useState, useEffect } from 'react';
import { getCurrentTheme, setTheme, themes, type ThemeName } from '@/lib/themes/themeSystem';
import { useAppStore } from '@/state/store';
import type { Window } from '@/state/store';
import { dispatchMessage } from '@/lib/messaging/AppMessageHandler';

interface SettingsWindowProps {
  window?: Window;
}

interface ProfileData {
  bio: string;
  location: string;
  interests: string[];
  favoriteQuote: string;
  textColor: string;
  font: string;
}

const AVAILABLE_FONTS = [
  'Arial',
  'Times New Roman',
  'Comic Sans MS',
  'Courier New',
  'Georgia',
  'Verdana',
  'Trebuchet MS',
  'Impact',
];

export default function SettingsWindow({ window }: SettingsWindowProps = {}) {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('aol7');
  const [themeChanged, setThemeChanged] = useState(false);
  const userSettings = useAppStore((state) => state.userSettings);
  const setUserSettings = useAppStore((state) => state.setUserSettings);

  // Profile Editor state
  const [profile, setProfile] = useState<ProfileData>({
    bio: '',
    location: '',
    interests: [],
    favoriteQuote: '',
    textColor: '#000000',
    font: 'Arial',
  });
  const [newInterest, setNewInterest] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    setCurrentTheme(getCurrentTheme());
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await fetch('/api/profile', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success && data.profile) {
        setProfile({
          bio: data.profile.bio || '',
          location: data.profile.location || '',
          interests: data.profile.interests || [],
          favoriteQuote: data.profile.favoriteQuote || '',
          textColor: data.profile.textColor || '#000000',
          font: data.profile.font || 'Arial',
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const handleThemeChange = (themeName: ThemeName) => {
    setTheme(themeName);
    setCurrentTheme(themeName);
    setThemeChanged(true);
    setTimeout(() => setThemeChanged(false), 2000);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileSaved(false);
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(profile),
      });

      const data = await response.json();
      if (data.success) {
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 3000);
        dispatchMessage('SYSTEM_ALERT', {
          message: 'Profile updated successfully!',
          title: 'Profile Updated',
        });
      } else {
        dispatchMessage('SYSTEM_ALERT', {
          message: data.error || 'Failed to update profile',
          title: 'Error',
        });
      }
    } catch (error: any) {
      dispatchMessage('SYSTEM_ALERT', {
        message: error.message || 'Failed to update profile',
        title: 'Error',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddInterest = () => {
    if (newInterest.trim() && !profile.interests.includes(newInterest.trim())) {
      setProfile({
        ...profile,
        interests: [...profile.interests, newInterest.trim()],
      });
      setNewInterest('');
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setProfile({
      ...profile,
      interests: profile.interests.filter((i) => i !== interest),
    });
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

          {/* Profile Editor */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Edit Profile</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                <textarea
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  placeholder="Tell us about yourself..."
                  className="w-full p-2 border-2 border-gray-300 rounded text-sm resize-none"
                  rows={4}
                  maxLength={500}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {profile.bio.length}/500 characters
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  value={profile.location}
                  onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                  placeholder="e.g., New York, NY"
                  className="w-full p-2 border-2 border-gray-300 rounded text-sm"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Interests</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newInterest}
                    onChange={(e) => setNewInterest(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddInterest();
                      }
                    }}
                    placeholder="Add an interest..."
                    className="flex-1 p-2 border-2 border-gray-300 rounded text-sm"
                  />
                  <button
                    onClick={handleAddInterest}
                    className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-semibold"
                  >
                    Add
                  </button>
                </div>
                {profile.interests.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {profile.interests.map((interest, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs border border-blue-200"
                      >
                        {interest}
                        <button
                          onClick={() => handleRemoveInterest(interest)}
                          className="text-blue-600 hover:text-blue-800 font-bold"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Favorite Quote</label>
                <textarea
                  value={profile.favoriteQuote}
                  onChange={(e) => setProfile({ ...profile, favoriteQuote: e.target.value })}
                  placeholder="Your favorite quote or saying..."
                  className="w-full p-2 border-2 border-gray-300 rounded text-sm resize-none italic"
                  rows={2}
                  maxLength={200}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {profile.favoriteQuote.length}/200 characters
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Text Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={profile.textColor}
                      onChange={(e) => setProfile({ ...profile, textColor: e.target.value })}
                      className="w-12 h-8 border-2 border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={profile.textColor}
                      onChange={(e) => setProfile({ ...profile, textColor: e.target.value })}
                      className="flex-1 p-2 border-2 border-gray-300 rounded text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Font</label>
                  <select
                    value={profile.font}
                    onChange={(e) => setProfile({ ...profile, font: e.target.value })}
                    className="w-full p-2 border-2 border-gray-300 rounded text-sm"
                    style={{ fontFamily: profile.font }}
                  >
                    {AVAILABLE_FONTS.map((font) => (
                      <option key={font} value={font} style={{ fontFamily: font }}>
                        {font}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-semibold"
              >
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>

              {profileSaved && (
                <div className="p-2 bg-green-100 border border-green-300 rounded text-sm text-green-800">
                  Profile saved successfully!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

