import type { IMessage } from '@/services/MailService';

export const mockMessages: IMessage[] = [
  {
    id: '1',
    folder: 'Inbox',
    from: 'welcome@ramn.online',
    to: 'user@ramn.online',
    subject: 'Welcome to Ramen Online!',
    body: 'This is a mock email in our ROL reimplementation. Have fun exploring the retro interface!\n\nYou can check your mail, chat with buddies, and explore forums.',
    date: new Date(Date.now() - 86400000).toISOString(),
    read: false,
  },
  {
    id: '2',
    folder: 'Inbox',
    from: 'friend@ramn.online',
    to: 'user@ramn.online',
    subject: 'Remember the good old days?',
    body: 'Hey! Remember when we used to wait for dial-up? Those were the days!\n\n- Your friend',
    date: new Date(Date.now() - 3600000).toISOString(),
    read: false,
  },
  {
    id: '3',
    folder: 'Sent',
    from: 'user@ramn.online',
    to: 'friend@ramn.online',
    subject: 'Re: Remember the good old days?',
    body: 'Yes! Those were simpler times. The sound of dial-up connecting was oddly satisfying.',
    date: new Date(Date.now() - 1800000).toISOString(),
    read: true,
  },
];

