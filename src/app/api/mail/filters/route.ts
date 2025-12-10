import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import MailFilter from '@/lib/db/models/MailFilter';

// GET: List all filters for the user
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    await dbConnect();

    const filters = await MailFilter.find({ userId })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        filters: filters.map((filter) => ({
          id: String(filter._id),
          name: filter.name,
          enabled: filter.enabled,
          conditions: filter.conditions,
          actions: filter.actions,
          order: filter.order,
          createdAt: filter.createdAt.toISOString(),
          updatedAt: filter.updatedAt.toISOString(),
        })),
      })
    );
  } catch (error: any) {
    console.error('[mail/filters/GET] Error:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to fetch filters' },
        { status: 500 }
      )
    );
  }
}

// POST: Create a new filter
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
    const { name, enabled = true, conditions, actions, order } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Filter name is required' },
          { status: 400 }
        )
      );
    }

    if (!Array.isArray(conditions) || conditions.length === 0) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'At least one condition is required' },
          { status: 400 }
        )
      );
    }

    // Validate conditions
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
      if (!condition.value || typeof condition.value !== 'string') {
        return addSecurityHeaders(
          NextResponse.json(
            { success: false, error: 'Condition value is required' },
            { status: 400 }
          )
        );
      }
    }

    // Validate actions
    if (!actions || typeof actions !== 'object') {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Actions are required' },
          { status: 400 }
        )
      );
    }

    if (actions.moveToFolder && !['Inbox', 'Sent', 'Drafts', 'Trash'].includes(actions.moveToFolder)) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid folder' },
          { status: 400 }
        )
      );
    }

    // Get max order if not provided
    let filterOrder = order;
    if (filterOrder === undefined) {
      const maxOrderFilter = await MailFilter.findOne({ userId })
        .sort({ order: -1 })
        .lean();
      filterOrder = maxOrderFilter ? (maxOrderFilter.order || 0) + 1 : 0;
    }

    const filter = await MailFilter.create({
      userId,
      name: name.trim(),
      enabled: enabled !== false,
      conditions,
      actions,
      order: filterOrder,
    });

    return addSecurityHeaders(
      NextResponse.json(
        {
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
        },
        { status: 201 }
      )
    );
  } catch (error: any) {
    console.error('[mail/filters/POST] Error:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: error.message || 'Failed to create filter' },
        { status: 500 }
      )
    );
  }
}


