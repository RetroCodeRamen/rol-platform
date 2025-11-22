# AOL Platform - Retro Web Edition

A nostalgic web-based reimplementation of classic AOL (5.0/6.0 era) as a single-page web application with a strong retro dial-up vibe.

## Features

- **Retro AOL Experience**: Recreates the look and feel of classic AOL with Windows 98-style UI
- **Login & Connect Flow**: Authentic dial-up connection experience with sound effects
- **Email Client**: Full-featured email interface with inbox, sent, drafts, and trash folders
- **Instant Messaging**: Chat with buddies via IM windows
- **Chat Rooms**: Public chat rooms for group conversations
- **Buddy List**: See who's online and start conversations
- **Channels**: Browse different content channels (News, Sports, Games, etc.)
- **Forums**: Discussion boards with threads and replies
- **Sound Effects**: Classic AOL sounds ("You've got mail!", dial-up, IM notifications, etc.)

## Tech Stack

- **Next.js 14** (App Router) - React framework
- **TypeScript** - Type safety
- **TailwindCSS** - Styling with retro theme
- **Zustand** - State management
- **React** - UI library

## Getting Started
## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. **Set up MongoDB:**
   
   You need a MongoDB database for user authentication. Choose one option:
   
   **Option A: MongoDB Atlas (Cloud - Free)**
   1. Go to https://www.mongodb.com/cloud/atlas
   2. Create a free account and cluster
   3. Get your connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/aol-platform`)
   
   **Option B: Local MongoDB**
   1. Install MongoDB locally: https://www.mongodb.com/try/download/community
   2. Start MongoDB service
   3. Use connection string: `mongodb://localhost:27017/aol-platform`
   
   **Option C: Docker MongoDB**
   ```bash
   docker run -d -p 27017:27017 --name mongodb mongo
   ```
   Use connection string: `mongodb://localhost:27017/aol-platform`

3. **Create `.env.local` file:**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Then edit `.env.local` and add your MongoDB connection string:
   ```env
   MONGODB_URI=your_mongodb_connection_string_here
   ```

4. Ensure audio files are in `public/audio/`:
   - `Welcome.mp3`
   - `Goodbye.mp3`
   - `You've Got Mail.mp3`
   - `IM.mp3`
   - `BuddyIn.mp3`
   - `BuddyOut.mp3`
   - `dialup.mp3` (optional - will fail gracefully if missing)

5. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3001](http://localhost:3001) in your browser

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Login screen (root)
│   ├── connect/           # Connection screen
│   └── shell/             # Main AOL shell
├── components/            # React components
│   ├── LoginScreen.tsx
│   ├── ConnectScreen.tsx
│   ├── AOLShell.tsx       # Main layout
│   ├── TopNavBar.tsx
│   ├── SideBarChannels.tsx
│   ├── BuddyList.tsx
│   ├── ChatWindow.tsx
│   ├── IMWindow.tsx
│   ├── EmailClient/       # Email components
│   │   ├── MailboxView.tsx
│   │   ├── MessageView.tsx
│   │   └── ComposeView.tsx
│   └── Forums/            # Forum components
│       ├── ForumList.tsx
│       ├── ThreadList.tsx
│       └── ThreadView.tsx
├── services/              # Service layer (designed for API swap)
│   ├── AuthService.ts     # Authentication (mock)
│   ├── MailService.ts     # Email (mock)
│   ├── ChatService.ts     # Chat & IM (mock)
│   ├── NotificationService.ts
│   └── SoundService.ts    # Audio playback
└── state/                 # Global state
    ├── store.ts           # Zustand store
    └── mockData.ts        # Seed data
```

## Architecture: Swapping Mock Services for Real APIs

The application is designed with a **service interface pattern** to make it easy to swap mock services for real API backends.

### MailService

**Current Implementation**: `MockMailService` (in-memory)

**To Replace with Real API**:

1. Create a new class implementing `IMailService`:

```typescript
// services/RestMailService.ts
import type { IMailService, IMessage } from './MailService';

export class RestMailService implements IMailService {
  private baseUrl = process.env.NEXT_PUBLIC_API_URL;

  async getFolder(folder: IMessage['folder']): Promise<IMessage[]> {
    const response = await fetch(`${this.baseUrl}/api/mail/${folder}`);
    return response.json();
  }

  async sendMessage(message: Omit<IMessage, 'id' | 'date' | 'read' | 'folder'>): Promise<IMessage> {
    const response = await fetch(`${this.baseUrl}/api/mail/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    return response.json();
  }

  // ... implement other methods
}
```

2. Update `src/services/MailService.ts`:

```typescript
// Replace the export
export const mailService: IMailService = new RestMailService();
```

### ChatService

**Current Implementation**: `MockChatService` (in-memory)

**To Replace with Real API + WebSocket**:

1. Create `RestChatService` implementing `IChatService`
2. For real-time features, integrate WebSocket:

```typescript
// services/WebSocketChatService.ts
export class WebSocketChatService implements IChatService {
  private ws: WebSocket;

  constructor() {
    this.ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL);
    this.ws.onmessage = (event) => {
      // Handle incoming messages
    };
  }

  async sendRoomMessage(roomId: string, message: string, from: string): Promise<IChatMessage> {
    this.ws.send(JSON.stringify({ type: 'room_message', roomId, message, from }));
    // Return promise that resolves when server confirms
  }
}
```

3. Update `src/services/ChatService.ts`:

```typescript
export const chatService: IChatService = new WebSocketChatService();
```

### AuthService

**Current Implementation**: `MockAuthService` (accepts any credentials)

**To Replace with Real API**:

1. Create `RestAuthService` implementing `IAuthService`
2. Update `src/services/AuthService.ts`:

```typescript
export const authService: IAuthService = new RestAuthService();
```

## Key Design Decisions

1. **Service Interfaces**: All services implement interfaces, making it trivial to swap implementations
2. **Mock-First Development**: Start with mocks, swap in real APIs later
3. **State Management**: Zustand provides simple, type-safe global state
4. **Component Organization**: Features are grouped by domain (EmailClient, Forums, etc.)
5. **Retro Styling**: TailwindCSS with custom retro theme for Windows 98/AOL aesthetic

## Customization

### Adding New Sounds

1. Add audio file to `public/audio/`
2. Update `SoundService.ts`:

```typescript
export type SoundKey = 'dialup' | 'youve_got_mail' | 'new_im' | 'your_new_sound';

// In init():
const soundMap: Record<SoundKey, string> = {
  // ... existing sounds
  your_new_sound: '/audio/your-new-sound.mp3',
};
```

### Adding New Channels

Edit `src/components/SideBarChannels.tsx`:

```typescript
const CHANNELS = [
  // ... existing channels
  { id: 'new-channel', name: 'New Channel', icon: '🎯' },
];
```

### Styling

Retro styling is handled via:
- `src/app/globals.css` - Global styles and retro scrollbar
- TailwindCSS classes throughout components
- Custom gradient and border utilities

## Development Notes

- **No Real Backend**: All data is mocked in-memory. Perfect for frontend development.
- **Sound Files**: Audio files should be placed in `public/audio/`. Missing files will fail gracefully.
- **State Persistence**: Currently state is lost on refresh. To persist, integrate localStorage or backend session management.
- **Real-time Updates**: Currently simulated with intervals. Replace with WebSocket for real-time features.

## Future Enhancements

- [ ] Real backend API integration
- [ ] WebSocket for real-time chat/IM
- [ ] User profiles and avatars
- [ ] File sharing in IM
- [ ] Email attachments
- [ ] Search functionality
- [ ] Themes (different retro eras)
- [ ] Mobile responsive design

## License

© 2024 RetroCodeRamen

## Credits

Inspired by classic AOL 5.0/6.0 interface design.
