'use client';

import { useEffect, useState } from 'react';
import type { Window } from '@/state/store';

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

export default function ProfileWindow({ window }: ProfileWindowProps) {
  // All hooks must be called before any conditional returns
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const username = window?.username;

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
          </div>

          {/* Profile Details */}
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
        </div>
      </div>
    </div>
  );
}

