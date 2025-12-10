import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import MailFilter from '@/lib/db/models/MailFilter';

// PUT: Update a filter
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

    const { id } = await params;
    const body = await request.json();
    const { name, enabled, conditions, actions, order } = body;

    const filter = await MailFilter.findOne({ _id: id, userId });
    if (!filter) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Filter not found' }, { status: 404 })
      );
    }

    // Update fields
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return addSecurityHeaders(
          NextResponse.json(
            { success: false, error: 'Filter name cannot be empty' },
            { status: 400 }
          )
        );
      }
      filter.name = name.trim();
    }

    if (enabled !== undefined) {
      filter.enabled = enabled;
    }

    if (conditions !== undefined) {
      if (!Array.isArray(conditions) || conditions.length === 0) {
        return addSecurityHeaders(
          NextResponse.json(
            { success: false, error: 'At least one condition is required' },
            { status: 400 }
          )
        );
      }
      // Validate conditions (same as POST)
      for (const condition of conditions) {
        if (!['from', 'to', 'subject', 'body'].includes(condition.field)) {
          return addSecurityHeaders(
            NextResponse.json(
              { success: false, error: 'Invalid condition field' },
              { status: 400 }
            )
          );
        }
        if (!['contains', 'equals', 'startsWith', 'endsWith'].includes(condition.operator)) {
          return addSecurityHeaders(
            NextResponse.json(
              { success: false, error: 'Invalid condition operator' },
              { status: 400 }
            )
          );
        }
      }
      filter.conditions = conditions;
    }

    if (actions !== undefined) {
      if (actions.moveToFolder && !['Inbox', 'Sent', 'Drafts', 'Trash'].includes(actions.moveToFolder)) {
        return addSecurityHeaders(
          NextResponse.json(
            { success: false, error: 'Invalid folder' },
            { status: 400 }
          )
        );
      }
      filter.actions = { ...filter.actions, ...actions };
    }

    if (order !== undefined) {
      filter.order = order;
    }

    await filter.save();

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        filter: {
          id: String(filter._id),
          name: filter.name,
          enabled: filter.enabled,
          conditions: filter.conditions,
          actions: filter.actions,
          order: filter.order,
          createdAt: filter.createdAt.toISOString(),
          updatedAt: filter.updatedAt.toISOString(),
        },
      })
    );
  } catch (error: any) {
    console.error('[mail/filters/[id]/PUT] Error:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: error.message || 'Failed to update filter' },
        { status: 500 }
      )
    );
  }
}

// DELETE: Delete a filter
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

    const { id } = await params;
    const filter = await MailFilter.findOneAndDelete({ _id: id, userId });

    if (!filter) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Filter not found' }, { status: 404 })
      );
    }

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        message: 'Filter deleted successfully',
      })
    );
  } catch (error: any) {
    console.error('[mail/filters/[id]/DELETE] Error:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: error.message || 'Failed to delete filter' },
        { status: 500 }
      )
    );
  }
}


