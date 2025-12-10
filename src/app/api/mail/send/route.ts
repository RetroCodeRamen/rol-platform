import { NextRequest, NextResponse } from 'next/server';
import { addSecurityHeaders } from '@/lib/security/headers';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import MailMessage from '@/lib/db/models/MailMessage';
import { applyFilters } from '@/lib/mail/filterEngine';
import User from '@/lib/db/models/User';
import FileAttachment from '@/lib/db/models/FileAttachment';
import { escapeRegex } from '@/lib/security/validation';
import mongoose from 'mongoose';

// Parse comma-separated email addresses
function parseEmailAddresses(addresses: string): string[] {
  return addresses
    .split(',')
    .map((addr) => addr.trim())
    .filter((addr) => addr.length > 0);
}

// Check if email is internal (@ramn.online)
function isInternalEmail(email: string): boolean {
  return email.toLowerCase().endsWith('@ramn.online');
}

// Extract username from email address (e.g., "test@ramn.online" -> "test")
function extractUsernameFromEmail(email: string): string | null {
  if (!isInternalEmail(email)) {
    return null;
  }
  const parts = email.toLowerCase().split('@');
  if (parts.length === 2 && parts[1] === 'ramn.online') {
    return parts[0];
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromSession();
    if (!userId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      );
    }

    await dbConnect();

    // Get sender details
    const sender = await User.findById(userId).lean();
    if (!sender) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      );
    }

    // From address is always <username>@ramn.online, not the user's external email
    const fromAddress = `${sender.username}@ramn.online`;

    const body = await request.json();
    const { to, cc, bcc, subject, body: messageBody, attachmentIds } = body;

    // Validate required fields
    if (!to || !subject || !messageBody) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Missing required fields: to, subject, body' },
          { status: 400 }
        )
      );
    }

    // Validate and process attachments if provided
    let attachmentObjectIds: any[] = [];
    if (attachmentIds && Array.isArray(attachmentIds) && attachmentIds.length > 0) {
      // Validate attachment IDs belong to user
      const attachments = await FileAttachment.find({
        _id: { $in: attachmentIds },
        uploadedBy: userId,
      });
      
      if (attachments.length !== attachmentIds.length) {
        return addSecurityHeaders(
          NextResponse.json(
            { success: false, error: 'Invalid attachment IDs or access denied' },
            { status: 400 }
          )
        );
      }
      
      attachmentObjectIds = attachments.map(att => att._id);
    }

    // Parse recipient addresses
    const toAddresses = parseEmailAddresses(to);
    const ccAddresses = cc ? parseEmailAddresses(cc) : [];
    const bccAddresses = bcc ? parseEmailAddresses(bcc) : [];

    if (toAddresses.length === 0) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'At least one recipient is required' },
          { status: 400 }
        )
      );
    }

    // Process recipients
    const recipientUserIds: string[] = [];
    const invalidRecipients: string[] = [];

    // Combine all recipients (to, cc, bcc) for processing
    const allRecipients = [...toAddresses, ...ccAddresses, ...bccAddresses];

    for (const email of allRecipients) {
      if (isInternalEmail(email)) {
        // Try multiple lookup methods for internal emails
        let user = null;
        
        // Method 1: Look up by email address directly
        user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
          // Method 2: Extract username/screenName from email and look up
          // Username and screenName are interchangeable
          const username = extractUsernameFromEmail(email);
          if (username) {
            // Escape regex to prevent ReDoS attacks
            const escapedUsername = escapeRegex(username);
            // Try both username and screenName fields (they should match, but check both for safety)
            user = await User.findOne({ 
              $or: [
                { username: username.toLowerCase() },
                { screenName: { $regex: new RegExp(`^${escapedUsername}$`, 'i') } }
              ]
            });
          }
        }
        
        if (user) {
          recipientUserIds.push(String(user._id));
          console.log(`[MAIL] Found user: ${user.username} (${user.email}) for recipient: ${email}`);
        } else {
          console.log(`[MAIL] User not found for: ${email} (tried email and username/screenName)`);
          invalidRecipients.push(email);
        }
      } else {
        // External email - look up by email for future SendGrid integration
        const user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
          // User exists in our system with this external email
          recipientUserIds.push(String(user._id));
          console.log(`[MAIL] Found user by external email: ${user.username} (${user.email})`);
        } else {
          // External email not in our system - will be handled by SendGrid later
          console.log(`[MAIL] External email not in system: ${email} (will be handled by SendGrid)`);
          invalidRecipients.push(email);
        }
      }
    }
    
    console.log(`[MAIL] Recipients processed - Valid: ${recipientUserIds.length}, Invalid: ${invalidRecipients.length}`);

    // If all recipients are invalid, reject the send
    if (invalidRecipients.length === allRecipients.length) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            success: false,
            error: `No valid recipients found. Invalid addresses: ${invalidRecipients.join(', ')}`,
          },
          { status: 400 }
        )
      );
    }

    // Create message in each recipient's Inbox (apply filters)
    const inboxMessages = await Promise.all(
      recipientUserIds.map(async (recipientId) => {
        // Apply filters to determine folder and read status
        const recipientObjectId = new mongoose.Types.ObjectId(recipientId);
        const filteredMessage = await applyFilters(recipientObjectId, {
          from: fromAddress,
          to: toAddresses.join(', '),
          subject,
          body: messageBody,
          folder: 'Inbox',
          isRead: false,
        });

        return await MailMessage.create({
          ownerUserId: recipientId,
          folder: filteredMessage.folder || 'Inbox',
          from: fromAddress,
          to: toAddresses.join(', '),
          cc: ccAddresses.length > 0 ? ccAddresses.join(', ') : undefined,
          bcc: bccAddresses.length > 0 ? bccAddresses.join(', ') : undefined,
          subject,
          body: messageBody,
          isRead: filteredMessage.isRead !== undefined ? filteredMessage.isRead : false,
          attachments: attachmentObjectIds.length > 0 ? attachmentObjectIds : undefined,
        });
      })
    );

    // Create message in sender's Sent folder
    const sentMessage = await MailMessage.create({
      ownerUserId: userId,
      folder: 'Sent',
      from: fromAddress,
      to: toAddresses.join(', '),
      cc: ccAddresses.length > 0 ? ccAddresses.join(', ') : undefined,
      bcc: bccAddresses.length > 0 ? bccAddresses.join(', ') : undefined,
      subject,
      body: messageBody,
      isRead: true, // Sent messages are marked as read
      attachments: attachmentObjectIds.length > 0 ? attachmentObjectIds : undefined,
    });

    // TODO: Future SendGrid integration point
    // For external recipients, forward via SendGrid here
    // if (externalRecipients.length > 0) {
    //   await sendViaSendGrid({
    //     from: fromAddress, // Always use <username>@ramn.online format
    //     to: externalRecipients,
    //     subject,
    //     body: messageBody,
    //   });
    // }

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        message: {
          id: String(sentMessage._id),
          folder: sentMessage.folder,
          from: sentMessage.from,
          to: sentMessage.to,
          subject: sentMessage.subject,
          createdAt: sentMessage.createdAt.toISOString(),
        },
        deliveredTo: recipientUserIds.length,
        invalidRecipients: invalidRecipients.length > 0 ? invalidRecipients : undefined,
      })
    );
  } catch (error: any) {
    console.error('[MAIL] Send error:', error);
    return addSecurityHeaders(
      NextResponse.json(
        { success: false, error: error.message || 'Failed to send message' },
        { status: 500 }
      )
    );
  }
}

