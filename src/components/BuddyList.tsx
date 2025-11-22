'use client';

import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/state/store';
import DialogWindow from './DialogWindow';

interface Buddy {
  id: string;
  username: string;
  screenName: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  awayStatus?: 'available' | 'away' | 'busy' | 'invisible';
  awayMessage?: string;
}

interface BuddyGroup {
  id: string;
  name: string;
  buddyIds: string[];
  order: number;
}

type Tab = 'online' | 'setup';

export default function BuddyList() {
  const [activeTab, setActiveTab] = useState<Tab>('online');
  const [groups, setGroups] = useState<BuddyGroup[]>([]);
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    type: 'buddy' | 'group' | null;
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [showAddBuddyModal, setShowAddBuddyModal] = useState(false);
  const [newBuddyUsername, setNewBuddyUsername] = useState('');
  const [addingBuddy, setAddingBuddy] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const currentUser = useAppStore((state) => state.currentUser);
  const openWindow = useAppStore((state) => state.openWindow);
  const closeWindow = useAppStore((state) => state.closeWindow);

  // Load buddies and groups
  useEffect(() => {
    loadBuddies();
    loadGroups();
    
    // Set up ping interval (every 10 seconds)
    const pingInterval = setInterval(() => {
      pingPresence();
    }, 10000);

    return () => clearInterval(pingInterval);
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu]);

  const pingPresence = async () => {
    try {
      const response = await fetch('/api/presence/ping', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setBuddies(data.buddies || []);
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Failed to ping presence:', error);
    }
  };

  const loadBuddies = async () => {
    try {
      const response = await fetch('/api/presence/ping', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setBuddies(data.buddies || []);
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Failed to load buddies:', error);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await fetch('/api/buddy-groups', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const handleBuddyDoubleClick = (buddy: Buddy) => {
    // Open IM window (WindowManager will prevent duplicates)
    openWindow('im', `IM: ${buddy.username}`, {
      participant: buddy.username,
    });
  };

  const handleBuddyRightClick = (e: React.MouseEvent, buddy: Buddy) => {
    e.preventDefault();
    setContextMenu({
      type: 'buddy',
      id: buddy.id,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleGroupRightClick = (e: React.MouseEvent, group: BuddyGroup) => {
    e.preventDefault();
    // Only show context menu in List Setup tab
    if (activeTab === 'setup') {
      setContextMenu({
        type: 'group',
        id: group.id,
        x: e.clientX,
        y: e.clientY,
      });
    }
  };

  const handleViewProfile = async (username: string) => {
    openWindow('profile', `Profile: ${username}`, {
      username,
    });
  };

  const handleSendMessage = (username: string) => {
    openWindow('im', `IM: ${username}`, {
      participant: username,
    });
  };

  const handleRemoveBuddy = async (username: string) => {
    try {
      const response = await fetch('/api/im/buddies/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username }),
      });
      
      const data = await response.json();
      if (data.success) {
        loadBuddies(); // Reload buddy list
        alert(`${username} has been removed from your buddy list.`);
      } else {
        alert(data.error || 'Failed to remove buddy');
      }
    } catch (error) {
      console.error('Failed to remove buddy:', error);
      alert('Failed to remove buddy');
    }
  };

  const handleBlockUser = async (username: string) => {
    try {
      const response = await fetch('/api/im/buddies/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username }),
      });
      
      const data = await response.json();
      if (data.success) {
        loadBuddies(); // Reload buddy list
        alert(`${username} has been blocked.`);
      } else {
        alert(data.error || 'Failed to block user');
      }
    } catch (error) {
      console.error('Failed to block user:', error);
      alert('Failed to block user');
    }
  };

  // Helper to open dialog window
  const openDialog = (
    title: string,
    message: string,
    showInput: boolean,
    inputLabel?: string,
    inputPlaceholder?: string,
    inputValue?: string,
    onConfirm?: (value?: string) => void,
    onCancel?: () => void
  ): string => {
    const dialogId = openWindow('dialog', title, {
      width: 350,
      height: showInput ? 180 : 150,
      x: 300,
      y: 200,
      dialogProps: {
        message,
        showInput,
        inputLabel,
        inputPlaceholder,
        inputValue,
        onConfirm: (value?: string) => {
          if (onConfirm) onConfirm(value);
          closeWindow(dialogId);
        },
        onCancel: () => {
          if (onCancel) onCancel();
          closeWindow(dialogId);
        },
      },
    });
    return dialogId;
  };

  const handleAddGroup = () => {
    openDialog(
      'New Group',
      '',
      true,
      'Group Name',
      'Enter group name',
      '',
      async (name) => {
        if (!name || !name.trim()) return;

        try {
          const response = await fetch('/api/buddy-groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name: name.trim() }),
          });
          const data = await response.json();
          if (data.success) {
            loadGroups();
          } else {
            alert(data.error || 'Failed to create group');
          }
        } catch (error) {
          alert('Failed to create group');
        }
      }
    );
  };

  const handleRenameGroup = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    openDialog(
      'Rename Group',
      '',
      true,
      'Group Name',
      'Enter new group name',
      group.name,
      async (newName) => {
        if (!newName || !newName.trim()) return;

        try {
          const response = await fetch(`/api/buddy-groups/${groupId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name: newName.trim() }),
          });
          const data = await response.json();
          if (data.success) {
            loadGroups();
          } else {
            alert(data.error || 'Failed to rename group');
          }
        } catch (error) {
          alert('Failed to rename group');
        }
      }
    );
  };

  const handleDeleteGroup = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    openDialog(
      'Remove Group',
      `Remove group "${group.name}"? Buddies in this group will be moved to the default group.`,
      false,
      undefined,
      undefined,
      undefined,
      async () => {
        try {
          const response = await fetch(`/api/buddy-groups/${groupId}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          const data = await response.json();
          if (data.success) {
            loadGroups();
            loadBuddies(); // Reload to update buddy assignments
          } else {
            alert(data.error || 'Failed to remove group');
          }
        } catch (error) {
          alert('Failed to remove group');
        }
      }
    );
  };

  const handleAddBuddy = async () => {
    if (!newBuddyUsername.trim()) return;

    setAddingBuddy(true);
    try {
      const response = await fetch('/api/im/buddies/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: newBuddyUsername.trim() }),
      });

      const data = await response.json();
      if (data.success) {
        setShowAddBuddyModal(false);
        setNewBuddyUsername('');
        loadBuddies(); // Reload buddies list
        alert(`Added ${newBuddyUsername} to your buddy list!`);
      } else {
        alert(data.error || 'Failed to add buddy');
      }
    } catch (error: any) {
      alert(error.message || 'Failed to add buddy');
    } finally {
      setAddingBuddy(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      case 'busy':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  // Filter buddies by online status
  const onlineBuddies = buddies.filter((b) => b.status === 'online');
  const offlineBuddies = buddies.filter((b) => b.status === 'offline');

  // Get buddies for a group
  const getBuddiesForGroup = (group: BuddyGroup) => {
    return buddies.filter((b) => group.buddyIds.includes(b.id));
  };

  // Get default "Buddies" group (for offline buddies to be moved to)
  const getDefaultGroup = () => {
    return groups.find((g) => g.name.toLowerCase() === 'buddies') || groups[0];
  };

  // Default groups - "Buddies" group includes ALL buddies (both online and offline)
  const defaultGroups: BuddyGroup[] = [
    { id: 'online', name: 'Buddies', buddyIds: buddies.map((b) => b.id), order: 0 },
  ];

  // For Online tab: show online buddies in their groups + offline buddies group
  // For List Setup tab: show all groups and all buddies
  const allGroups = [...defaultGroups, ...groups].sort((a, b) => a.order - b.order);

  // Render groups for Online tab
  const renderOnlineTab = () => {
    // Show ALL groups from List Setup (same groups, same structure)
    // Within each group, show both online and offline buddies
    // Plus a separate "Offline Buddies" group at the bottom showing ALL offline buddies
    const groupsWithBuddies = allGroups.map((group) => {
      const groupBuddies = getBuddiesForGroup(group);
      const onlineGroupBuddies = groupBuddies.filter((b) => b.status === 'online');
      const offlineGroupBuddies = groupBuddies.filter((b) => b.status === 'offline');
      return { 
        ...group, 
        allBuddies: groupBuddies,
        onlineBuddies: onlineGroupBuddies,
        offlineBuddies: offlineGroupBuddies,
      };
    }); // Show ALL groups, even if empty - they're the same groups as List Setup

    return (
      <div className="space-y-1">
        {/* Show all buddies in their assigned groups */}
        {groupsWithBuddies.map((group) => {
          const isExpanded = expandedGroups.has(group.id);
          return (
            <div key={group.id}>
              <div
                className="flex items-center justify-between px-2 py-1 cursor-pointer hover:bg-blue-100 rounded"
                style={{ backgroundColor: '#cce5ff' }}
                onClick={() => toggleGroup(group.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
                  <span className="text-sm font-semibold text-gray-800">{group.name}</span>
                  <span className="text-xs text-gray-500">
                    ({group.onlineBuddies.length} online{group.offlineBuddies.length > 0 ? `, ${group.offlineBuddies.length} offline` : ''})
                  </span>
                </div>
              </div>
              {isExpanded && (
                <div className="ml-4 mt-1 space-y-0.5">
                  {/* Show online buddies first */}
                  {group.onlineBuddies.map((buddy) => (
                    <div
                      key={buddy.id}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer"
                      onDoubleClick={() => handleBuddyDoubleClick(buddy)}
                      onContextMenu={(e) => handleBuddyRightClick(e, buddy)}
                    >
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(buddy.status)}`} />
                      <span className="text-sm text-gray-800">{buddy.username}</span>
                      {buddy.awayStatus === 'away' && buddy.awayMessage && (
                        <span className="text-xs text-gray-500 italic">({buddy.awayMessage})</span>
                      )}
                    </div>
                  ))}
                  {/* Show offline buddies in same group */}
                  {group.offlineBuddies.map((buddy) => (
                    <div
                      key={buddy.id}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer"
                      onDoubleClick={() => handleBuddyDoubleClick(buddy)}
                      onContextMenu={(e) => handleBuddyRightClick(e, buddy)}
                    >
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(buddy.status)}`} />
                      <span className="text-sm text-gray-600">{buddy.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Offline Buddies group at the bottom - shows ALL offline buddies */}
        {offlineBuddies.length > 0 && (
          <div>
            <div
              className="flex items-center justify-between px-2 py-1 cursor-pointer hover:bg-gray-200 rounded mt-2"
              style={{ backgroundColor: '#e0e0e0' }}
              onClick={() => toggleGroup('offline')}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs">{expandedGroups.has('offline') ? '▼' : '▶'}</span>
                <span className="text-sm font-semibold text-gray-800">Offline Buddies</span>
                <span className="text-xs text-gray-500">({offlineBuddies.length})</span>
              </div>
            </div>
            {expandedGroups.has('offline') && (
              <div className="ml-4 mt-1 space-y-0.5">
                {offlineBuddies.map((buddy) => (
                  <div
                    key={buddy.id}
                    className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer"
                    onDoubleClick={() => handleBuddyDoubleClick(buddy)}
                    onContextMenu={(e) => handleBuddyRightClick(e, buddy)}
                  >
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(buddy.status)}`} />
                    <span className="text-sm text-gray-600">{buddy.username}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render groups for List Setup tab
  const renderSetupTab = () => {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            onClick={handleAddGroup}
            className="flex-1 px-2 py-1 text-sm bg-blue-200 text-blue-900 rounded hover:bg-blue-300"
          >
            + Add Group
          </button>
          <button
            onClick={() => setShowAddBuddyModal(true)}
            className="flex-1 px-2 py-1 text-sm bg-green-200 text-green-900 rounded hover:bg-green-300"
          >
            + Add Buddy
          </button>
        </div>
        {allGroups.map((group) => {
          const groupBuddies = getBuddiesForGroup(group);
          const isExpanded = expandedGroups.has(group.id);

          return (
            <div key={group.id}>
              <div
                className="flex items-center justify-between px-2 py-1 cursor-pointer hover:bg-blue-100 rounded"
                style={{ backgroundColor: '#cce5ff' }}
                onClick={() => toggleGroup(group.id)}
                onContextMenu={(e) => handleGroupRightClick(e, group)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
                  <span className="text-sm font-semibold text-gray-800">{group.name}</span>
                  <span className="text-xs text-gray-500">({groupBuddies.length})</span>
                </div>
              </div>
              {isExpanded && (
                <div className="ml-4 mt-1 space-y-0.5">
                  {groupBuddies.map((buddy) => (
                    <div
                      key={buddy.id}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded"
                      onContextMenu={(e) => handleBuddyRightClick(e, buddy)}
                    >
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(buddy.status)}`} />
                      <span className="text-sm text-gray-800">{buddy.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="h-full w-full flex flex-col" style={{ backgroundColor: '#e6f2ff' }}>
        {/* Tabs */}
        <div className="flex border-b-2 border-blue-400" style={{ background: 'linear-gradient(to bottom, #0066cc, #4a0080)' }}>
          <button
            onClick={() => setActiveTab('online')}
            className={`px-4 py-2 text-sm font-semibold ${
              activeTab === 'online'
                ? 'bg-blue-600 text-white border-b-2 border-white'
                : 'text-blue-200 hover:text-white'
            }`}
          >
            Online
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            className={`px-4 py-2 text-sm font-semibold ${
              activeTab === 'setup'
                ? 'bg-blue-600 text-white border-b-2 border-white'
                : 'text-blue-200 hover:text-white'
            }`}
          >
            List Setup
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto retro-scrollbar p-2">
          {activeTab === 'online' ? renderOnlineTab() : renderSetupTab()}
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <div
            ref={contextMenuRef}
            className="fixed bg-white border-2 border-gray-400 shadow-lg z-50"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
              minWidth: '150px',
            }}
          >
            {contextMenu.type === 'buddy' ? (
              <div className="py-1">
                <button
                  className="w-full text-left px-3 py-1 text-sm hover:bg-blue-100"
                  onClick={() => {
                    const buddy = buddies.find((b) => b.id === contextMenu.id);
                    if (buddy) {
                      handleViewProfile(buddy.username);
                    }
                    setContextMenu(null);
                  }}
                >
                  View Profile
                </button>
                <button
                  className="w-full text-left px-3 py-1 text-sm hover:bg-blue-100"
                  onClick={() => {
                    const buddy = buddies.find((b) => b.id === contextMenu.id);
                    if (buddy) {
                      handleSendMessage(buddy.username);
                    }
                    setContextMenu(null);
                  }}
                >
                  Send Message
                </button>
                <button
                  className="w-full text-left px-3 py-1 text-sm hover:bg-blue-100"
                  onClick={() => {
                    const buddy = buddies.find((b) => b.id === contextMenu.id);
                    if (buddy) {
                      handleRemoveBuddy(buddy.username);
                    }
                    setContextMenu(null);
                  }}
                >
                  Remove Buddy
                </button>
                <button
                  className="w-full text-left px-3 py-1 text-sm hover:bg-blue-100"
                  onClick={() => {
                    const buddy = buddies.find((b) => b.id === contextMenu.id);
                    if (buddy) {
                      handleBlockUser(buddy.username);
                    }
                    setContextMenu(null);
                  }}
                >
                  Block User
                </button>
              </div>
            ) : (
              <div className="py-1">
                <button
                  className="w-full text-left px-3 py-1 text-sm hover:bg-blue-100"
                  onClick={() => {
                    handleRenameGroup(contextMenu.id);
                    setContextMenu(null);
                  }}
                >
                  Rename Group
                </button>
                <button
                  className="w-full text-left px-3 py-1 text-sm hover:bg-blue-100"
                  onClick={() => {
                    handleDeleteGroup(contextMenu.id);
                    setContextMenu(null);
                  }}
                >
                  Remove Group
                </button>
              </div>
            )}
          </div>
        )}

        {/* Add Buddy Modal */}
        {showAddBuddyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white border-4 border-gray-400 p-4 rounded shadow-lg" style={{ minWidth: '300px' }}>
              <h3 className="text-lg font-bold mb-3 text-gray-800">Add Buddy</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Username:
                  </label>
                  <input
                    type="text"
                    value={newBuddyUsername}
                    onChange={(e) => setNewBuddyUsername(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !addingBuddy && newBuddyUsername.trim()) {
                        handleAddBuddy();
                      }
                      if (e.key === 'Escape') {
                        setShowAddBuddyModal(false);
                        setNewBuddyUsername('');
                      }
                    }}
                    className="w-full px-3 py-2 border-2 border-gray-400 rounded bg-white text-gray-900 focus:outline-none focus:border-blue-500"
                    placeholder="Enter username"
                    autoFocus
                    disabled={addingBuddy}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowAddBuddyModal(false);
                      setNewBuddyUsername('');
                    }}
                    disabled={addingBuddy}
                    className="px-3 py-1 text-sm bg-gray-200 text-gray-900 rounded hover:bg-gray-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddBuddy}
                    disabled={addingBuddy || !newBuddyUsername.trim()}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {addingBuddy ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
