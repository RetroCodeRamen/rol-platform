'use client';

import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/state/store';
import DialogWindow from './DialogWindow';
import { dispatchMessage } from '@/lib/messaging/AppMessageHandler';

interface Buddy {
  id: string;
  username: string;
  screenName: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  awayStatus?: 'available' | 'away' | 'busy' | 'invisible';
  awayMessage?: string;
  hasUnreadIM?: boolean; // Flag for bold+asterisk when IM auto-open is disabled
}

interface BlockedUser {
  id: string;
  username: string;
  screenName: string;
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
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    type: 'buddy' | 'group' | 'blocked' | null;
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [showAddBuddyModal, setShowAddBuddyModal] = useState(false);
  const [newBuddyUsername, setNewBuddyUsername] = useState('');
  const [addingBuddy, setAddingBuddy] = useState(false);
  const [showMyAIMDropdown, setShowMyAIMDropdown] = useState(false);
  const [showAwayMessageDialog, setShowAwayMessageDialog] = useState(false);
  const [awayStatus, setAwayStatus] = useState<'available' | 'away'>('available');
  const [awayMessage, setAwayMessage] = useState('');
  const [savingAway, setSavingAway] = useState(false);
  const myAIMDropdownRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const currentUser = useAppStore((state) => state.currentUser);
  const openWindow = useAppStore((state) => state.openWindow);
  const closeWindow = useAppStore((state) => state.closeWindow);

  // Load buddies and groups
  useEffect(() => {
    loadBuddies();
    loadGroups();
    loadBlockedUsers();
    
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
      if (myAIMDropdownRef.current && !myAIMDropdownRef.current.contains(event.target as Node)) {
        setShowMyAIMDropdown(false);
      }
    };

    if (contextMenu || showMyAIMDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu, showMyAIMDropdown]);

  // Load away status on mount
  useEffect(() => {
    loadAwayStatus();
  }, []);

  const loadAwayStatus = async () => {
    try {
      const response = await fetch('/api/presence/away', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        const status = data.awayStatus || 'available';
        setAwayStatus(status === 'available' ? 'available' : 'away');
        setAwayMessage(data.awayMessage || '');
      }
    } catch (error) {
      console.error('Failed to load away status:', error);
    }
  };

  const handleOpenProfile = () => {
    setShowMyAIMDropdown(false);
    if (currentUser?.username) {
      openWindow('profile', 'My Profile', {
        username: currentUser.username,
        editable: true,
      });
    }
  };

  const handleOpenAwayMessage = () => {
    setShowMyAIMDropdown(false);
    setShowAwayMessageDialog(true);
  };

  const handleSaveAwayStatus = async () => {
    setSavingAway(true);
    try {
      const response = await fetch('/api/presence/away', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          awayStatus,
          awayMessage: awayMessage.trim(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setShowAwayMessageDialog(false);
        dispatchMessage('SYSTEM_ALERT', {
          message: 'Away status updated successfully!',
          title: 'Status Updated',
        });
        loadAwayStatus(); // Reload to refresh buddy list
      } else {
        dispatchMessage('SYSTEM_ALERT', {
          message: data.error || 'Failed to update away status',
          title: 'Error',
        });
      }
    } catch (error: any) {
      dispatchMessage('SYSTEM_ALERT', {
        message: error.message || 'Failed to update away status',
        title: 'Error',
      });
    } finally {
      setSavingAway(false);
    }
  };

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
        dispatchMessage('SYSTEM_ALERT', {
          message: `${username} has been removed from your buddy list.`,
          title: 'Buddy Removed',
        });
      } else {
        dispatchMessage('SYSTEM_ALERT', {
          message: data.error || 'Failed to remove buddy',
          title: 'Error',
        });
      }
    } catch (error) {
      console.error('Failed to remove buddy:', error);
      dispatchMessage('SYSTEM_ALERT', {
        message: 'Failed to remove buddy',
        title: 'Error',
      });
    }
  };

  const loadBlockedUsers = async () => {
    try {
      const response = await fetch('/api/im/buddies/blocked', {
        method: 'GET',
        credentials: 'include',
      });
      
      const data = await response.json();
      if (data.success) {
        setBlockedUsers(data.blockedUsers || []);
      }
    } catch (error) {
      console.error('Failed to load blocked users:', error);
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
        loadBlockedUsers(); // Reload blocked users
        dispatchMessage('SYSTEM_ALERT', {
          message: `${username} has been blocked.`,
          title: 'User Blocked',
        });
      } else {
        dispatchMessage('SYSTEM_ALERT', {
          message: data.error || 'Failed to block user',
          title: 'Error',
        });
      }
    } catch (error) {
      console.error('Failed to block user:', error);
      dispatchMessage('SYSTEM_ALERT', {
        message: 'Failed to block user',
        title: 'Error',
      });
    }
  };

  const handleUnblockUser = async (username: string) => {
    try {
      const response = await fetch('/api/im/buddies/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username }),
      });
      
      const data = await response.json();
      if (data.success) {
        loadBlockedUsers(); // Reload blocked users
        loadBuddies(); // Reload buddy list in case they become visible
        dispatchMessage('SYSTEM_ALERT', {
          message: `${username} has been unblocked.`,
          title: 'User Unblocked',
        });
      } else {
        dispatchMessage('SYSTEM_ALERT', {
          message: data.error || 'Failed to unblock user',
          title: 'Error',
        });
      }
    } catch (error) {
      console.error('Failed to unblock user:', error);
      dispatchMessage('SYSTEM_ALERT', {
        message: 'Failed to unblock user',
        title: 'Error',
      });
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
            dispatchMessage('SYSTEM_ALERT', {
              message: data.error || 'Failed to create group',
              title: 'Error',
            });
          }
        } catch (error) {
          dispatchMessage('SYSTEM_ALERT', {
            message: 'Failed to create group',
            title: 'Error',
          });
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
            dispatchMessage('SYSTEM_ALERT', {
              message: data.error || 'Failed to rename group',
              title: 'Error',
            });
          }
        } catch (error) {
          dispatchMessage('SYSTEM_ALERT', {
            message: 'Failed to rename group',
            title: 'Error',
          });
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
            dispatchMessage('SYSTEM_ALERT', {
              message: data.error || 'Failed to remove group',
              title: 'Error',
            });
          }
        } catch (error) {
          dispatchMessage('SYSTEM_ALERT', {
            message: 'Failed to remove group',
            title: 'Error',
          });
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
        dispatchMessage('SYSTEM_ALERT', {
          message: `Added ${newBuddyUsername} to your buddy list!`,
          title: 'Buddy Added',
        });
      } else {
        dispatchMessage('SYSTEM_ALERT', {
          message: data.error || 'Failed to add buddy',
          title: 'Error',
        });
      }
    } catch (error: any) {
      dispatchMessage('SYSTEM_ALERT', {
        message: error.message || 'Failed to add buddy',
        title: 'Error',
      });
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
      <div style={{ padding: '1px' }}>
        {/* Show all buddies in their assigned groups */}
        {groupsWithBuddies.map((group) => {
          const isExpanded = expandedGroups.has(group.id);
          const totalBuddies = group.allBuddies.length;
          const onlineCount = group.onlineBuddies.length;
          return (
            <div key={group.id} style={{ marginBottom: '1px' }}>
              {/* Group Header - Yellow Highlighter Behind Text Only */}
              <div
                className="cursor-pointer"
                onClick={() => toggleGroup(group.id)}
                style={{
                  padding: '2px 4px',
                  minHeight: '18px',
                }}
              >
                <div className="flex items-center" style={{ gap: '4px' }}>
                  {/* Disclosure Triangle */}
                  <span style={{ fontSize: '10px', color: '#000', width: '12px' }}>
                    {isExpanded ? '▼' : '►'}
                  </span>
                  {/* Group Name with Yellow Highlight Behind Text Only */}
                  <span
                    className="font-bold"
                    style={{
                      fontSize: '11px',
                      color: '#000000',
                      backgroundColor: AIM_YELLOW_HIGHLIGHT,
                      padding: '0 2px',
                      lineHeight: '1.3',
                    }}
                  >
                    {group.name} ({onlineCount})
                  </span>
                </div>
              </div>
              {isExpanded && (
                <div style={{ marginLeft: '16px', paddingTop: '1px' }}>
                  {/* Show online buddies first - Plain black text, no status dots */}
                  {group.onlineBuddies.map((buddy) => (
                    <div
                      key={buddy.id}
                      className="cursor-pointer"
                      onDoubleClick={() => {
                        handleBuddyDoubleClick(buddy);
                        // Clear unread IM flag when opening IM window
                        if (buddy.hasUnreadIM) {
                          setBuddies(
                            buddies.map((b) =>
                              b.id === buddy.id ? { ...b, hasUnreadIM: false } : b
                            )
                          );
                        }
                      }}
                      onContextMenu={(e) => handleBuddyRightClick(e, buddy)}
                      style={{
                        padding: '1px 4px',
                        fontSize: '11px',
                        color: '#000000',
                        lineHeight: '1.4',
                        minHeight: '16px',
                        fontWeight: buddy.hasUnreadIM ? 'bold' : 'normal',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = '#E5E5E5';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                      }}
                    >
                      {buddy.hasUnreadIM ? `*${buddy.username}` : buddy.username}
                      {buddy.awayStatus === 'away' && buddy.awayMessage && (
                        <span style={{ color: AIM_DARK_GREY, fontSize: '10px', fontStyle: 'italic' }}>
                          {' '}({buddy.awayMessage})
                        </span>
                      )}
                    </div>
                  ))}
                  {/* Offline buddies are NOT shown in groups - they only appear in the Offline section */}
                </div>
              )}
            </div>
          );
        })}

        {/* Offline Buddies group at the bottom - Grey, No Yellow Highlight */}
        {offlineBuddies.length > 0 && (
          <div style={{ marginTop: '2px' }}>
            <div
              className="cursor-pointer"
              onClick={() => toggleGroup('offline')}
              style={{
                padding: '2px 4px',
                minHeight: '18px',
              }}
            >
              <div className="flex items-center" style={{ gap: '4px' }}>
                {/* Disclosure Triangle */}
                <span style={{ fontSize: '10px', color: AIM_DARK_GREY, width: '12px' }}>
                  {expandedGroups.has('offline') ? '▼' : '►'}
                </span>
                {/* Offline Group Name - Grey, No Yellow Highlight */}
                <span
                  className="font-bold"
                  style={{
                    fontSize: '11px',
                    color: AIM_DARK_GREY,
                    lineHeight: '1.3',
                  }}
                >
                  Offline ({offlineBuddies.length})
                </span>
              </div>
            </div>
            {expandedGroups.has('offline') && (
              <div style={{ marginLeft: '16px', paddingTop: '1px' }}>
                {offlineBuddies.map((buddy) => (
                  <div
                    key={buddy.id}
                    className="cursor-pointer"
                    onDoubleClick={() => {
                      handleBuddyDoubleClick(buddy);
                      // Clear unread IM flag when opening IM window
                      if (buddy.hasUnreadIM) {
                        setBuddies(
                          buddies.map((b) =>
                            b.id === buddy.id ? { ...b, hasUnreadIM: false } : b
                          )
                        );
                      }
                    }}
                    onContextMenu={(e) => handleBuddyRightClick(e, buddy)}
                    style={{
                      padding: '1px 4px',
                      fontSize: '11px',
                      color: AIM_DARK_GREY,
                      lineHeight: '1.4',
                      minHeight: '16px',
                      fontWeight: buddy.hasUnreadIM ? 'bold' : 'normal',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = '#E5E5E5';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    {buddy.hasUnreadIM ? `*${buddy.username}` : buddy.username}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Blocked Users section */}
        {blockedUsers.length > 0 && (
          <div style={{ marginTop: '2px' }}>
            <div
              className="cursor-pointer"
              onClick={() => toggleGroup('blocked')}
              style={{
                padding: '2px 4px',
                minHeight: '18px',
              }}
            >
              <div className="flex items-center" style={{ gap: '4px' }}>
                {/* Disclosure Triangle */}
                <span style={{ fontSize: '10px', color: AIM_DARK_GREY, width: '12px' }}>
                  {expandedGroups.has('blocked') ? '▼' : '►'}
                </span>
                {/* Blocked Users Group Name - Red tint */}
                <span
                  className="font-bold"
                  style={{
                    fontSize: '11px',
                    color: '#CC0000',
                    lineHeight: '1.3',
                  }}
                >
                  Blocked ({blockedUsers.length})
                </span>
              </div>
            </div>
            {expandedGroups.has('blocked') && (
              <div style={{ marginLeft: '16px', paddingTop: '1px' }}>
                {blockedUsers.map((blockedUser) => (
                  <div
                    key={blockedUser.id}
                    className="cursor-pointer"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({
                        type: 'blocked',
                        id: blockedUser.id,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }}
                    style={{
                      padding: '1px 4px',
                      fontSize: '11px',
                      color: '#CC0000',
                      lineHeight: '1.4',
                      minHeight: '16px',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = '#FFE5E5';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    {blockedUser.username}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render groups for List Setup tab - AIM Style
  const renderSetupTab = () => {
    return (
      <div style={{ padding: '2px' }}>
        <div className="flex gap-1" style={{ marginBottom: '4px' }}>
          <button
            onClick={handleAddGroup}
            className="px-2 py-1 text-xs font-semibold border border-gray-400"
            style={{
              backgroundColor: '#E0E0E0',
              borderTop: '2px solid #FFFFFF',
              borderLeft: '2px solid #FFFFFF',
              borderRight: '2px solid #808080',
              borderBottom: '2px solid #808080',
              fontSize: '10px',
            }}
          >
            + Add Group
          </button>
          <button
            onClick={() => setShowAddBuddyModal(true)}
            className="px-2 py-1 text-xs font-semibold border border-gray-400"
            style={{
              backgroundColor: '#E0E0E0',
              borderTop: '2px solid #FFFFFF',
              borderLeft: '2px solid #FFFFFF',
              borderRight: '2px solid #808080',
              borderBottom: '2px solid #808080',
              fontSize: '10px',
            }}
          >
            + Add Buddy
          </button>
        </div>
        {allGroups.map((group) => {
          const groupBuddies = getBuddiesForGroup(group);
          const isExpanded = expandedGroups.has(group.id);

          return (
            <div key={group.id} style={{ marginBottom: '1px' }}>
              {/* Group Header - Yellow Highlighter Behind Text Only */}
              <div
                className="cursor-pointer"
                onClick={() => toggleGroup(group.id)}
                onContextMenu={(e) => handleGroupRightClick(e, group)}
                style={{
                  padding: '2px 4px',
                  minHeight: '18px',
                }}
              >
                <div className="flex items-center" style={{ gap: '4px' }}>
                  {/* Disclosure Triangle */}
                  <span style={{ fontSize: '10px', color: '#000', width: '12px' }}>
                    {isExpanded ? '▼' : '►'}
                  </span>
                  {/* Group Name with Yellow Highlight Behind Text Only */}
                  <span
                    className="font-bold"
                    style={{
                      fontSize: '11px',
                      color: '#000000',
                      backgroundColor: AIM_YELLOW_HIGHLIGHT,
                      padding: '0 2px',
                      lineHeight: '1.3',
                    }}
                  >
                    {group.name} ({groupBuddies.length})
                  </span>
                </div>
              </div>
              {isExpanded && (
                <div style={{ marginLeft: '16px', paddingTop: '1px' }}>
                  {groupBuddies.map((buddy) => (
                    <div
                      key={buddy.id}
                      className="cursor-pointer"
                      onContextMenu={(e) => handleBuddyRightClick(e, buddy)}
                      style={{
                        padding: '1px 4px',
                        fontSize: '11px',
                        color: '#000000',
                        lineHeight: '1.4',
                        minHeight: '16px',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = '#E5E5E5';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                      }}
                    >
                      {buddy.username}
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

  // AIM Color Palette
  const AIM_YELLOW_HIGHLIGHT = '#FFF68F';
  const AIM_BORDER = '#A0A0A0';
  const AIM_DARK_BORDER = '#404040';
  const AIM_GREY = '#E5E5E5';
  const AIM_LIGHT_GREY = '#C0C0C0';
  const AIM_DARK_GREY = '#808080';

  return (
    <>
      <div className="h-full w-full flex flex-col" style={{ 
        backgroundColor: '#E5E5E5',
        border: `1px solid ${AIM_DARK_BORDER}`,
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        lineHeight: '1.2',
      }}>
        {/* AIM Banner - Dark Blue Gradient */}
        <div 
          className="flex items-center justify-between px-3"
          style={{
            height: '70px',
            background: 'linear-gradient(to bottom, #003366, #001a33)',
            borderBottom: `1px solid ${AIM_DARK_BORDER}`,
          }}
        >
          <div className="flex items-center gap-3">
            <img
              src="/images/logo-ramen-online.png"
              alt="Ramen Online"
              style={{ height: '50px', width: 'auto' }}
              onError={(e) => {
                // Fallback if image doesn't exist
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="text-white" style={{ fontSize: '14px', fontWeight: 'bold' }}>
              Ramen Online Instant Messenger
            </div>
          </div>
          
          {/* My AIM Dropdown */}
          <div className="relative" ref={myAIMDropdownRef}>
            <button
              onClick={() => setShowMyAIMDropdown(!showMyAIMDropdown)}
              className="text-white hover:bg-blue-800 px-3 py-1 rounded text-sm font-semibold"
              style={{ fontSize: '12px' }}
            >
              My AIM ▼
            </button>
            {showMyAIMDropdown && (
              <div
                className="absolute right-0 mt-1 bg-white border-2 border-gray-400 shadow-lg z-50"
                style={{ minWidth: '180px' }}
              >
                <button
                  onClick={handleOpenProfile}
                  className="w-full text-left px-3 py-2 hover:bg-blue-100 text-sm text-gray-800"
                  style={{ fontSize: '11px' }}
                >
                  Edit Profile
                </button>
                <button
                  onClick={handleOpenAwayMessage}
                  className="w-full text-left px-3 py-2 hover:bg-blue-100 text-sm text-gray-800 border-t border-gray-300"
                  style={{ fontSize: '11px' }}
                >
                  Set Away Message
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs - Win95 3D Style */}
        <div className="flex" style={{ 
          borderBottom: `1px solid ${AIM_DARK_GREY}`,
          backgroundColor: AIM_GREY,
        }}>
          <button
            onClick={() => setActiveTab('online')}
            className="px-4 py-1.5 text-xs font-bold"
            style={{
              backgroundColor: activeTab === 'online' ? '#E0E0E0' : AIM_LIGHT_GREY,
              color: activeTab === 'online' ? '#000000' : AIM_DARK_GREY,
              borderTop: activeTab === 'online' ? `2px solid #FFFFFF` : `2px solid ${AIM_DARK_GREY}`,
              borderLeft: activeTab === 'online' ? `2px solid #FFFFFF` : `2px solid ${AIM_DARK_GREY}`,
              borderRight: activeTab === 'online' ? `2px solid ${AIM_DARK_GREY}` : `2px solid #FFFFFF`,
              borderBottom: activeTab === 'online' ? `none` : `2px solid ${AIM_DARK_GREY}`,
              marginRight: '2px',
              fontSize: '10px',
            }}
          >
            Online
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            className="px-4 py-1.5 text-xs font-bold"
            style={{
              backgroundColor: activeTab === 'setup' ? '#E0E0E0' : AIM_LIGHT_GREY,
              color: activeTab === 'setup' ? '#000000' : AIM_DARK_GREY,
              borderTop: activeTab === 'setup' ? `2px solid #FFFFFF` : `2px solid ${AIM_DARK_GREY}`,
              borderLeft: activeTab === 'setup' ? `2px solid #FFFFFF` : `2px solid ${AIM_DARK_GREY}`,
              borderRight: activeTab === 'setup' ? `2px solid ${AIM_DARK_GREY}` : `2px solid #FFFFFF`,
              borderBottom: activeTab === 'setup' ? `none` : `2px solid ${AIM_DARK_GREY}`,
              fontSize: '10px',
            }}
          >
            List Setup
          </button>
        </div>

        {/* Content - White Buddy List Area with Inset Border */}
        <div 
          className="flex-1 overflow-y-auto aim-scrollbar"
          style={{
            backgroundColor: '#FFFFFF',
            border: `inset 1px solid ${AIM_BORDER}`,
            margin: '2px',
            padding: '2px',
            fontFamily: 'Arial, sans-serif',
            fontSize: '11px',
          }}
        >
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
            ) : contextMenu.type === 'blocked' ? (
              <div className="py-1">
                <button
                  className="w-full text-left px-3 py-1 text-sm hover:bg-blue-100"
                  onClick={() => {
                    const blockedUser = blockedUsers.find((b) => b.id === contextMenu.id);
                    if (blockedUser) {
                      handleUnblockUser(blockedUser.username);
                    }
                    setContextMenu(null);
                  }}
                >
                  Unblock User
                </button>
                <button
                  className="w-full text-left px-3 py-1 text-sm hover:bg-blue-100"
                  onClick={() => {
                    const blockedUser = blockedUsers.find((b) => b.id === contextMenu.id);
                    if (blockedUser) {
                      handleViewProfile(blockedUser.username);
                    }
                    setContextMenu(null);
                  }}
                >
                  View Profile
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

        {/* Away Message Dialog */}
        {showAwayMessageDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white border-2 border-gray-400 shadow-lg" style={{ width: '400px' }}>
              <div className="bg-blue-600 text-white px-3 py-1 font-semibold text-sm">
                Set Away Message
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <div className="flex gap-3">
                    {(['available', 'away'] as const).map((status) => (
                      <label
                        key={status}
                        className={`flex items-center p-2 border-2 rounded cursor-pointer flex-1 ${
                          awayStatus === status
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="awayStatus"
                          value={status}
                          checked={awayStatus === status}
                          onChange={(e) => setAwayStatus(e.target.value as 'available' | 'away')}
                          className="mr-2"
                        />
                        <span className="text-sm font-medium capitalize">{status}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Away Message (optional)
                  </label>
                  <textarea
                    value={awayMessage}
                    onChange={(e) => setAwayMessage(e.target.value)}
                    placeholder="e.g., 'Be back in 30 minutes!'"
                    className="w-full p-2 border-2 border-gray-300 rounded text-sm resize-none"
                    rows={3}
                    maxLength={200}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {awayMessage.length}/200 characters
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowAwayMessageDialog(false);
                      loadAwayStatus(); // Reset to current values
                    }}
                    className="px-4 py-1 text-sm border-2 border-gray-400 bg-gray-200 hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAwayStatus}
                    disabled={savingAway}
                    className="px-4 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingAway ? 'Saving...' : 'Save'}
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
