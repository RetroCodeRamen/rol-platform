/**
 * Mail Filter Engine
 * 
 * Applies user-defined filters to incoming mail messages
 */

import MailFilter from '@/lib/db/models/MailFilter';
import type { MailFolder } from '@/lib/db/models/MailMessage';
import mongoose from 'mongoose';

export interface MailMessageData {
  from: string;
  to: string;
  subject: string;
  body: string;
  folder?: MailFolder;
  isRead?: boolean;
}

/**
 * Check if a message matches a filter condition
 */
function matchesCondition(
  message: MailMessageData,
  condition: { field: string; operator: string; value: string }
): boolean {
  const { field, operator, value } = condition;
  let fieldValue = '';

  switch (field) {
    case 'from':
      fieldValue = message.from.toLowerCase();
      break;
    case 'to':
      fieldValue = message.to.toLowerCase();
      break;
    case 'subject':
      fieldValue = message.subject.toLowerCase();
      break;
    case 'body':
      fieldValue = message.body.toLowerCase();
      break;
    default:
      return false;
  }

  const searchValue = value.toLowerCase();

  switch (operator) {
    case 'contains':
      return fieldValue.includes(searchValue);
    case 'equals':
      return fieldValue === searchValue;
    case 'startsWith':
      return fieldValue.startsWith(searchValue);
    case 'endsWith':
      return fieldValue.endsWith(searchValue);
    default:
      return false;
  }
}

/**
 * Check if a message matches all conditions of a filter
 */
function matchesFilter(message: MailMessageData, filter: any): boolean {
  // All conditions must match (AND logic)
  return filter.conditions.every((condition: any) =>
    matchesCondition(message, condition)
  );
}

/**
 * Apply filters to a message and return the modified message data
 */
export async function applyFilters(
  userId: mongoose.Types.ObjectId,
  message: MailMessageData
): Promise<MailMessageData> {
  // Get all enabled filters for the user, ordered by execution order
  const filters = await MailFilter.find({
    userId,
    enabled: true,
  })
    .sort({ order: 1 })
    .lean();

  let result: MailMessageData = { ...message };

  // Apply filters in order (first match wins)
  for (const filter of filters) {
    if (matchesFilter(result, filter)) {
      // Apply actions
      if (filter.actions.delete) {
        // Delete immediately (move to trash)
        result.folder = 'Trash';
      } else if (filter.actions.moveToFolder) {
        result.folder = filter.actions.moveToFolder as MailFolder;
      }

      if (filter.actions.markAsRead !== undefined) {
        result.isRead = filter.actions.markAsRead;
      }

      // Stop after first matching filter (unless we want to allow multiple)
      // For now, we'll allow multiple filters to apply
      // break;
    }
  }

  return result;
}
