import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';
import BuddyGroup from '@/lib/db/models/BuddyGroup';
import mongoose from 'mongoose';

// Presence rule: online = (!isManuallyLoggedOff && now - lastActiveAt < 30 seconds)
function isUserOnline(user: any): boolean {
  if (user.isManuallyLoggedOff) {
    return false;
  }
  if (!user.lastActiveAt) {
    return false;
  }
  const now = new Date();
  const diffMs = now.getTime() - new Date(user.lastActiveAt).getTime();
  return diffMs < 30000; // 30 seconds
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    await dbConnect();

    // Update current user's lastActiveAt
    const currentUser = await User.findByIdAndUpdate(
      userId,
      {
        lastActiveAt: new Date(),
        isManuallyLoggedOff: false,
      },
      { new: true }
    ).lean();

    if (!currentUser) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      );
    }

    // Get user's buddy list
    const user = await User.findById(userId).populate('buddyList').lean();
    if (!user || !user.buddyList || (user.buddyList as any[]).length === 0) {
      // Return empty buddies but still return groups
      const groups = await BuddyGroup.find({ userId: new mongoose.Types.ObjectId(userId) }).sort({ order: 1 }).lean();
      return addSecurityHeaders(
        NextResponse.json({ 
          success: true, 
          buddies: [],
          groups: groups.map((g: any) => ({
            id: String(g._id),
            name: g.name,
            order: g.order,
            buddyIds: g.buddyIds.map((id: any) => String(id)),
          }))
        })
      );
    }

    // Get buddy groups (convert userId string to ObjectId)
    const groups = await BuddyGroup.find({ userId: new mongoose.Types.ObjectId(userId) }).sort({ order: 1 }).lean();

    // Get all unique buddy IDs from groups and direct buddyList
    const allBuddyIds = new Set<string>();
    (user.buddyList as any[]).forEach((buddy: any) => {
      allBuddyIds.add(String(buddy._id));
    });
    groups.forEach((group: any) => {
      group.buddyIds.forEach((buddyId: any) => {
        allBuddyIds.add(String(buddyId));
      });
    });

    // Fetch all buddies with their current status
    const buddyIdsArray = Array.from(allBuddyIds);
    const buddies = await User.find({ _id: { $in: buddyIdsArray } }).lean();

    // Format buddies with online status
    const formattedBuddies = buddies.map((buddy: any) => ({
      id: String(buddy._id),
      username: buddy.username,
      screenName: buddy.screenName,
      status: isUserOnline(buddy) ? 'online' : 'offline',
      awayStatus: buddy.awayStatus || 'available',
      awayMessage: buddy.awayMessage || null,
      lastActiveAt: buddy.lastActiveAt?.toISOString(),
    }));

    // Format groups with buddies
    const formattedGroups = groups.map((group: any) => ({
      id: String(group._id),
      name: group.name,
      order: group.order,
      buddyIds: group.buddyIds.map((id: any) => String(id)),
    }));

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        buddies: formattedBuddies,
        groups: formattedGroups,
      })
    );
  } catch (error: any) {
    console.error('[presence/ping] Error:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: error.message || 'Failed to ping presence' },
        { status: 500 }
      )
    );
  }
}

