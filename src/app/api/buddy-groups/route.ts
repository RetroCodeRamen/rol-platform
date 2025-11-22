import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import BuddyGroup from '@/lib/db/models/BuddyGroup';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    await dbConnect();

    const groups = await BuddyGroup.find({ userId }).sort({ order: 1 }).lean();

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        groups: groups.map((g: any) => ({
          id: String(g._id),
          name: g.name,
          buddyIds: g.buddyIds.map((id: any) => String(id)),
          order: g.order,
        })),
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to fetch groups' },
        { status: 500 }
      )
    );
  }
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

    const body = await request.json();
    const { name, order } = body;

    if (!name || typeof name !== 'string') {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Group name is required' },
          { status: 400 }
        )
      );
    }

    const maxOrder = await BuddyGroup.findOne({ userId })
      .sort({ order: -1 })
      .select('order')
      .lean();

    const newGroup = await BuddyGroup.create({
      userId,
      name: name.trim(),
      order: order ?? (maxOrder?.order ?? 0) + 1,
      buddyIds: [],
    });

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        group: {
          id: String(newGroup._id),
          name: newGroup.name,
          buddyIds: [],
          order: newGroup.order,
        },
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to create group' },
        { status: 500 }
      )
    );
  }
}

