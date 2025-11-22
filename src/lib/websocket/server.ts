import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { getUserIdFromSession } from '@/lib/auth';
import dbConnect from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';
import Message from '@/lib/db/models/Message';

// Map of user ID to socket ID for presence tracking
const userSocketMap = new Map<string, string>();
// Map of socket ID to user ID for reverse lookup
const socketUserMap = new Map<string, string>();

export function initializeSocketIO(server: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(server, {
    path: '/api/socket.io',
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      // Extract session from handshake
      const cookies = socket.handshake.headers.cookie;
      if (!cookies) {
        return next(new Error('No cookies provided'));
      }

      // Parse session from cookies (simplified - in production, use proper session parsing)
      // For now, we'll use a different approach: pass userId in auth token
      const authToken = socket.handshake.auth?.userId;
      if (!authToken) {
        return next(new Error('Authentication required'));
      }

      // Verify user exists
      await dbConnect();
      const user = await User.findById(authToken);
      if (!user) {
        return next(new Error('Invalid user'));
      }

      // Attach user info to socket
      (socket as any).userId = String(user._id);
      (socket as any).username = user.username;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = (socket as any).userId;
    const username = (socket as any).username;

    // Store socket mapping
    userSocketMap.set(userId, socket.id);
    socketUserMap.set(socket.id, userId);

    // Update user status to online
    await User.findByIdAndUpdate(userId, {
      status: 'online',
      lastSeen: new Date(),
    });

    // Notify buddies that user is online
    const user = await User.findById(userId).populate('buddyList').lean();
    if (user && user.buddyList) {
      for (const buddy of user.buddyList as any[]) {
        const buddySocketId = userSocketMap.get(String(buddy._id));
        if (buddySocketId) {
          io.to(buddySocketId).emit('buddy:status', {
            userId,
            username,
            status: 'online',
          });
        }
      }
    }

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Handle IM message sending
    socket.on('im:send', async (data: { to: string; message: string }) => {
      try {
        const { to, message } = data;

        // Find recipient
        const recipient = await User.findOne({ username: to.toLowerCase() });
        if (!recipient) {
          socket.emit('im:error', { error: 'Recipient not found' });
          return;
        }

        // Check if blocked
        if (recipient.blockedUsers?.some((id) => String(id) === userId)) {
          socket.emit('im:error', { error: 'Cannot send message to this user' });
          return;
        }

        // Create message in database
        const imMessage = await Message.create({
          from: userId,
          to: recipient._id,
          content: message.trim(),
          type: 'im',
          deleted: false,
        });

        await imMessage.populate('from', 'username');
        await imMessage.populate('to', 'username');

        const messageData = {
          id: String(imMessage._id),
          from: (imMessage.from as any).username,
          to: (imMessage.to as any)?.username,
          message: imMessage.content,
          timestamp: imMessage.timestamp.toISOString(),
        };

        // Send to sender (confirmation)
        socket.emit('im:sent', messageData);

        // Send to recipient (if online)
        const recipientSocketId = userSocketMap.get(String(recipient._id));
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('im:new', messageData);
        }
      } catch (error: any) {
        socket.emit('im:error', { error: error.message || 'Failed to send message' });
      }
    });

    // Handle status updates
    socket.on('status:update', async (data: { status: 'online' | 'away' | 'busy' | 'offline' }) => {
      try {
        const { status } = data;
        await User.findByIdAndUpdate(userId, { status, lastSeen: new Date() });

        // Notify buddies
        const user = await User.findById(userId).populate('buddyList').lean();
        if (user && user.buddyList) {
          for (const buddy of user.buddyList as any[]) {
            const buddySocketId = userSocketMap.get(String(buddy._id));
            if (buddySocketId) {
              io.to(buddySocketId).emit('buddy:status', {
                userId,
                username,
                status,
              });
            }
          }
        }
      } catch (error) {
        socket.emit('status:error', { error: 'Failed to update status' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      // Update user status to offline
      await User.findByIdAndUpdate(userId, {
        status: 'offline',
        lastSeen: new Date(),
      });

      // Notify buddies
      const user = await User.findById(userId).populate('buddyList').lean();
      if (user && user.buddyList) {
        for (const buddy of user.buddyList as any[]) {
          const buddySocketId = userSocketMap.get(String(buddy._id));
          if (buddySocketId) {
            io.to(buddySocketId).emit('buddy:status', {
              userId,
              username,
              status: 'offline',
            });
          }
        }
      }

      // Clean up mappings
      userSocketMap.delete(userId);
      socketUserMap.delete(socket.id);
    });
  });

  return io;
}

