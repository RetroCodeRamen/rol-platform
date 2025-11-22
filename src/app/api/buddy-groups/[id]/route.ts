import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import BuddyGroup from '@/lib/db/models/BuddyGroup';
import mongoose from 'mongoose';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    await dbConnect();

    const { id: groupId } = await params;
    const body = await request.json();
    const { name, buddyIds, order } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (buddyIds !== undefined) {
      updateData.buddyIds = buddyIds.map((id: string) => new mongoose.Types.ObjectId(id));
    }
    if (order !== undefined) updateData.order = order;

    const group = await BuddyGroup.findOneAndUpdate(
      { _id: groupId, userId },
      updateData,
      { new: true }
    ).lean();

    if (!group) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Group not found' },
          { status: 404 }
        )
      );
    }

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        group: {
          id: String(group._id),
          name: group.name,
          buddyIds: group.buddyIds.map((id: any) => String(id)),
          order: group.order,
        },
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to update group' },
        { status: 500 }
      )
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    await dbConnect();

    const { id: groupId } = await params;

    const group = await BuddyGroup.findOneAndDelete({ _id: groupId, userId });

    if (!group) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Group not found' },
          { status: 404 }
        )
      );
    }

    return addSecurityHeaders(
      NextResponse.json({ success: true })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to delete group' },
        { status: 500 }
      )
    );
  }
}

