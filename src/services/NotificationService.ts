import { SoundService } from './SoundService';
import type { IMessage } from './MailService';
import type { IIMMessage } from './ChatService';

export type NotificationType = 'mail' | 'im' | 'buddy_online' | 'buddy_offline';

export interface INotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export class NotificationService {
  private notifications: INotification[] = [];
  private listeners: Set<(notifications: INotification[]) => void> = new Set();
  private lastUnreadMailCount = 0;

  subscribe(listener: (notifications: INotification[]) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.notifications]));
  }

  addNotification(notification: Omit<INotification, 'id' | 'timestamp' | 'read'>) {
    const newNotification: INotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random()}`,
      timestamp: new Date().toISOString(),
      read: false,
    };

    this.notifications.unshift(newNotification);
    this.notify();

    // Play sound based on notification type
    switch (notification.type) {
      case 'mail':
        SoundService.play('youve_got_mail');
        break;
      case 'im':
        SoundService.play('new_im');
        break;
      case 'buddy_online':
        SoundService.play('buddy_in');
        break;
      case 'buddy_offline':
        SoundService.play('buddy_out');
        break;
    }
  }

  markRead(id: string) {
    const notification = this.notifications.find((n) => n.id === id);
    if (notification) {
      notification.read = true;
      this.notify();
    }
  }

  markAllRead() {
    this.notifications.forEach((n) => (n.read = true));
    this.notify();
  }

  getNotifications(): INotification[] {
    return [...this.notifications];
  }

  getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  // Helper to check for new mail and trigger notifications
  checkNewMail(messages: IMessage[]) {
    const unreadCount = messages.filter((m) => !m.read && m.folder === 'Inbox').length;
    if (unreadCount > this.lastUnreadMailCount) {
      const newCount = unreadCount - this.lastUnreadMailCount;
      this.addNotification({
        type: 'mail',
        title: 'You\'ve Got Mail!',
        message: `You have ${newCount} new message${newCount > 1 ? 's' : ''}`,
      });
    }
    this.lastUnreadMailCount = unreadCount;
  }

  // Helper to notify about new IM
  notifyNewIM(message: IIMMessage, currentUser: string) {
    if (message.to === currentUser) {
      this.addNotification({
        type: 'im',
        title: 'New Instant Message',
        message: `${message.from}: ${message.message.substring(0, 50)}...`,
      });
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

