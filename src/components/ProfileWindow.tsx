'use client';

import { useEffect, useState } from 'react';
import type { Window } from '@/state/store';
import { useAppStore } from '@/state/store';
import { dispatchMessage } from '@/lib/messaging/AppMessageHandler';

interface ProfileWindowProps {
  window?: Window;
}

interface ProfileData {
  username: string;
  screenName: string;
  profile?: {
    bio?: string;
    location?: string;
    interests?: string[];
    favoriteQuote?: string;
    textColor?: string;
    font?: string;
  };
  awayStatus?: string;
  awayMessage?: string;
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

export default function ProfileWindow({ window }: ProfileWindowProps) {
  // All hooks must be called before any conditional returns
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingProfile, setEditingProfile] = useState({
    bio: '',
    location: '',
    interests: [] as string[],
    favoriteQuote: '',
    textColor: '#000000',
    font: 'Arial',
  });
  const [newInterest, setNewInterest] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const currentUser = useAppStore((state) => state.currentUser);

  const username = window?.username;
  const isOwnProfile = username === currentUser?.username;

  useEffect(() => {
    if (!username) {
      setError('No username specified');
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        const response = await fetch(`/api/profile/${username}`, {
          credentials: 'include',
        });
        const data = await response.json();
        
        if (data.success && data.profile) {
          setProfile(data.profile);
        } else {
          setError(data.error || 'Failed to load profile');
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [username]);

  // Initialize editing profile when entering edit mode
  useEffect(() => {
    if (isEditing && profile) {
      setEditingProfile({
        bio: profile.profile?.bio || '',
        location: profile.profile?.location || '',
        interests: profile.profile?.interests || [],
        favoriteQuote: profile.profile?.favoriteQuote || '',
        textColor: profile.profile?.textColor || '#000000',
        font: profile.profile?.font || 'Arial',
      });
    }
  }, [isEditing, profile]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editingProfile),
      });

      const data = await response.json();
      if (data.success) {
        setIsEditing(false);
        // Reload profile to show updated data
        const reloadResponse = await fetch(`/api/profile/${username}`, {
          credentials: 'include',
        });
        const reloadData = await reloadResponse.json();
        if (reloadData.success && reloadData.profile) {
          setProfile(reloadData.profile);
        }
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
    if (newInterest.trim() && !editingProfile.interests.includes(newInterest.trim())) {
      setEditingProfile({
        ...editingProfile,
        interests: [...editingProfile.interests, newInterest.trim()],
      });
      setNewInterest('');
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setEditingProfile({
      ...editingProfile,
      interests: editingProfile.interests.filter((i) => i !== interest),
    });
  };

  // Early return after all hooks
  if (!window || !username) {
    return <div className="p-4">No user selected</div>;
  }

  if (loading) {
    return (
      <div className="h-full overflow-auto retro-scrollbar p-6" style={{ backgroundColor: '#e6f2ff' }}>
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="h-full overflow-auto retro-scrollbar p-6" style={{ backgroundColor: '#e6f2ff' }}>
        <div className="flex items-center justify-center h-full">
          <p className="text-red-600">{error || 'Profile not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto retro-scrollbar p-6" style={{ backgroundColor: '#e6f2ff' }}>
      <div className="max-w-lg mx-auto">
        <div className="bg-white border-2 border-blue-300 rounded p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-24 h-24 bg-blue-200 border-2 border-blue-400 rounded-full mx-auto mb-3 flex items-center justify-center">
              <span className="text-4xl">👤</span>
            </div>
            <h2 className="text-2xl font-bold text-blue-800 mb-1">
              {profile.screenName || profile.username}
            </h2>
            <p className="text-sm text-gray-600">@{profile.username}</p>
            {isOwnProfile && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="mt-3 px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold"
              >
                Edit Profile
              </button>
            )}
          </div>

          {/* Profile Details */}
          {isEditing && isOwnProfile ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                <textarea
                  value={editingProfile.bio}
                  onChange={(e) => setEditingProfile({ ...editingProfile, bio: e.target.value })}
                  placeholder="Tell us about yourself..."
                  className="w-full p-2 border-2 border-gray-300 rounded text-sm resize-none"
                  rows={4}
                  maxLength={500}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {editingProfile.bio.length}/500 characters
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  value={editingProfile.location}
                  onChange={(e) => setEditingProfile({ ...editingProfile, location: e.target.value })}
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
                {editingProfile.interests.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {editingProfile.interests.map((interest, idx) => (
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
                  value={editingProfile.favoriteQuote}
                  onChange={(e) => setEditingProfile({ ...editingProfile, favoriteQuote: e.target.value })}
                  placeholder="Your favorite quote or saying..."
                  className="w-full p-2 border-2 border-gray-300 rounded text-sm resize-none italic"
                  rows={2}
                  maxLength={200}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {editingProfile.favoriteQuote.length}/200 characters
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Text Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editingProfile.textColor}
                      onChange={(e) => setEditingProfile({ ...editingProfile, textColor: e.target.value })}
                      className="w-12 h-8 border-2 border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={editingProfile.textColor}
                      onChange={(e) => setEditingProfile({ ...editingProfile, textColor: e.target.value })}
                      className="flex-1 p-2 border-2 border-gray-300 rounded text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Font</label>
                  <select
                    value={editingProfile.font}
                    onChange={(e) => setEditingProfile({ ...editingProfile, font: e.target.value })}
                    className="w-full p-2 border-2 border-gray-300 rounded text-sm"
                    style={{ fontFamily: editingProfile.font }}
                  >
                    {AVAILABLE_FONTS.map((font) => (
                      <option key={font} value={font} style={{ fontFamily: font }}>
                        {font}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setNewInterest('');
                  }}
                  className="px-4 py-2 border-2 border-gray-400 bg-gray-200 hover:bg-gray-300 rounded text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
            {profile.profile?.bio && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">About Me</h3>
                <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded border border-gray-200">
                  {profile.profile.bio}
                </p>
              </div>
            )}

            {profile.profile?.location && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Location</h3>
                <p className="text-sm text-gray-800">{profile.profile.location}</p>
              </div>
            )}

            {profile.profile?.favoriteQuote && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Favorite Quote</h3>
                <p className="text-sm text-gray-800 italic bg-gray-50 p-3 rounded border border-gray-200">
                  &quot;{profile.profile.favoriteQuote}&quot;
                </p>
              </div>
            )}

            {profile.profile?.interests && profile.profile.interests.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Interests</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.profile.interests.map((interest, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded border border-blue-200"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile.awayStatus && profile.awayStatus !== 'available' && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Status</h3>
                <p className="text-sm text-gray-800">
                  {profile.awayStatus === 'away' ? 'Away' : 
                   profile.awayStatus === 'busy' ? 'Busy' : 
                   profile.awayStatus === 'invisible' ? 'Invisible' : 'Available'}
                  {profile.awayMessage && ` - ${profile.awayMessage}`}
                </p>
              </div>
            )}

            {profile.profile?.textColor && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Text Color</h3>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 border-2 border-gray-400 rounded"
                    style={{ backgroundColor: profile.profile.textColor }}
                  />
                  <span className="text-sm text-gray-800">{profile.profile.textColor}</span>
                </div>
              </div>
            )}

            {profile.profile?.font && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Font</h3>
                <p className="text-sm text-gray-800" style={{ fontFamily: profile.profile.font }}>
                  {profile.profile.font}
                </p>
              </div>
            )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

