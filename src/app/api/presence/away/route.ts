import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    await dbConnect();

    const user = await User.findById(userId).lean();
    if (!user) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      );
    }

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        awayStatus: user.awayStatus || 'available',
        awayMessage: user.awayMessage || '',
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to fetch away status' },
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
    const { awayStatus, awayMessage } = body;

    const validStatuses = ['available', 'away', 'busy', 'invisible'];
    if (!awayStatus || !validStatuses.includes(awayStatus)) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid away status' },
          { status: 400 }
        )
      );
    }

    const updateData: any = {
      awayStatus,
      status: awayStatus === 'available' ? 'online' : awayStatus,
    };

    if (awayMessage !== undefined) {
      updateData.awayMessage = awayMessage || '';
    }

    const user = await User.findByIdAndUpdate(userId, updateData, { new: true }).lean();

    if (!user) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      );
    }

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        awayStatus: user.awayStatus,
        awayMessage: user.awayMessage || '',
      })
    );
  } catch (error: any) {
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to update away status' },
        { status: 500 }
      )
    );
  }
}

