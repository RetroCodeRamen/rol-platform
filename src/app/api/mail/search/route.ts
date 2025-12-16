import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import MailMessage from '@/lib/db/models/MailMessage';
import { escapeRegex } from '@/lib/security/validation';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    const searchParams = request.nextUrl.searchParams;
    let query = searchParams.get('q')?.trim();
    const folder = searchParams.get('folder'); // Optional: search in specific folder
    const fromDate = searchParams.get('fromDate'); // Optional: date range start
    const toDate = searchParams.get('toDate'); // Optional: date range end
    const searchField = searchParams.get('field'); // Optional: search in specific field (from, to, subject, body)
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = (page - 1) * limit;

    // Input length limits to prevent DoS attacks
    const MAX_QUERY_LENGTH = 500;
    if (query && query.length > MAX_QUERY_LENGTH) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: `Search query exceeds maximum length of ${MAX_QUERY_LENGTH} characters` },
          { status: 400 }
        )
      );
    }

    // Allow search with date range even without query
    if ((!query || query.length === 0) && !fromDate && !toDate) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Search query or date range is required' },
          { status: 400 }
        )
      );
    }

    await dbConnect();

    // Build search filter
    const searchFilter: any = {
      ownerUserId: userId,
    };

    // Build search query conditions
    if (query && query.length > 0) {
      // Escape regex special characters to prevent ReDoS attacks
      const escapedQuery = escapeRegex(query);
      
      if (searchField && ['from', 'to', 'subject', 'body'].includes(searchField)) {
        // Search in specific field
        searchFilter[searchField] = { $regex: escapedQuery, $options: 'i' };
      } else {
        // Search in all fields
        searchFilter.$or = [
          { subject: { $regex: escapedQuery, $options: 'i' } },
          { from: { $regex: escapedQuery, $options: 'i' } },
          { to: { $regex: escapedQuery, $options: 'i' } },
          { body: { $regex: escapedQuery, $options: 'i' } },
        ];
      }
    }

    // Optionally filter by folder
    if (folder && ['Inbox', 'Sent', 'Drafts', 'Trash'].includes(folder)) {
      searchFilter.folder = folder;
    }

    // Date range filter
    if (fromDate || toDate) {
      searchFilter.createdAt = {};
      if (fromDate) {
        searchFilter.createdAt.$gte = new Date(fromDate);
      }
      if (toDate) {
        const toDateObj = new Date(toDate);
        toDateObj.setHours(23, 59, 59, 999); // End of day
        searchFilter.createdAt.$lte = toDateObj;
      }
    }

    // Execute search
    const messages = await MailMessage.find(searchFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await MailMessage.countDocuments(searchFilter);

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        messages: messages.map((msg) => ({
          id: String(msg._id),
          folder: msg.folder,
          from: msg.from,
          to: msg.to,
          cc: msg.cc,
          bcc: msg.bcc,
          subject: msg.subject,
          body: msg.body,
          createdAt: msg.createdAt.toISOString(),
          readAt: msg.readAt?.toISOString(),
          isRead: msg.isRead,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        query,
      })
    );
  } catch (error: any) {
    console.error('[mail/search] Error:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: 'Failed to search messages' },
        { status: 500 }
      )
    );
  }
}


