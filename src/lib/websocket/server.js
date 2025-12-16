// Socket.io server setup for Next.js custom server
// This file is JavaScript to work with server.js

const { Server: SocketIOServer } = require('socket.io');
const mongoose = require('mongoose');

// Import models to register them with Mongoose
// These will be compiled TypeScript files, so we need to handle the import carefully
// For now, we'll use mongoose.model() which will work once models are registered

// Map of user ID to socket ID for presence tracking
const userSocketMap = new Map();
// Map of socket ID to user ID for reverse lookup
const socketUserMap = new Map();

// Connect to MongoDB helper - reuse existing connection pool
async function dbConnect() {
  // Reuse existing connection if available
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }
  
  // If connecting, wait for it
  if (mongoose.connection.readyState === 2) {
    return new Promise((resolve, reject) => {
      mongoose.connection.once('connected', () => resolve(mongoose));
      mongoose.connection.once('error', reject);
    });
  }
  
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  
  // Use connection options for better resource management
  const options = {
    maxPoolSize: 10, // Limit connection pool size
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };
  
  return mongoose.connect(mongoUri, options);
}

function initializeSocketIO(io) {
  // Periodic cleanup of stale socket mappings to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    // Clean up stale socket mappings (sockets disconnected but not cleaned up)
    for (const [socketId, userId] of socketUserMap.entries()) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket || !socket.connected) {
        userSocketMap.delete(userId);
        socketUserMap.delete(socketId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[WebSocket] Cleaned up ${cleaned} stale socket mappings`);
    }
    // Log connection stats every 5 minutes
    if (now % 300000 < 60000) {
      console.log(`[WebSocket] Active connections: ${userSocketMap.size}, Socket map size: ${socketUserMap.size}`);
    }
  }, 60000); // Every minute

  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      // Get userId from auth token passed during connection
      const authToken = socket.handshake.auth?.userId;
      if (!authToken) {
        return next(new Error('Authentication required'));
      }

      // Verify user exists
      await dbConnect();
      const User = mongoose.model('User');
      const user = await User.findById(authToken);
      if (!user) {
        return next(new Error('Invalid user'));
      }

      // Attach user info to socket
      socket.userId = String(user._id);
      socket.username = user.username;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    const username = socket.username;

    // Store socket mapping
    userSocketMap.set(userId, socket.id);
    socketUserMap.set(socket.id, userId);

    // Update user status to online
    await dbConnect();
    const User = mongoose.model('User');
    await User.findByIdAndUpdate(userId, {
      status: 'online',
      lastSeen: new Date(),
    });

    // Notify buddies that user is online
    const user = await User.findById(userId).populate('buddyList').lean();
    if (user && user.buddyList) {
      for (const buddy of user.buddyList) {
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

    // WebRTC File Transfer Signaling
    // Handle file transfer offer (to is username)
    socket.on('webrtc:offer', async (data) => {
      try {
        const { to, offer, fileName, fileSize, mimeType } = data;
        await dbConnect();
        const User = mongoose.model('User');
        const recipient = await User.findOne({ username: to.toLowerCase() });
        if (!recipient) {
          socket.emit('webrtc:error', { error: 'Recipient not found' });
          return;
        }
        const recipientSocketId = userSocketMap.get(String(recipient._id));
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('webrtc:offer', {
            from: userId,
            fromUsername: username,
            fromSocketId: socket.id,
            offer,
            fileName,
            fileSize,
            mimeType,
          });
        } else {
          socket.emit('webrtc:error', { error: 'Recipient not online' });
        }
      } catch (error) {
        socket.emit('webrtc:error', { error: error.message });
      }
    });

    // Handle file transfer answer (to is socket ID)
    socket.on('webrtc:answer', async (data) => {
      try {
        const { to, answer } = data; // to is socket ID
        if (to) {
          io.to(to).emit('webrtc:answer', {
            from: userId,
            answer,
          });
        }
      } catch (error) {
        socket.emit('webrtc:error', { error: error.message });
      }
    });

    // Handle ICE candidates (to is socket ID)
    socket.on('webrtc:ice-candidate', async (data) => {
      try {
        const { to, candidate } = data; // to is socket ID
        if (to) {
          io.to(to).emit('webrtc:ice-candidate', {
            from: userId,
            candidate,
          });
        }
      } catch (error) {
        socket.emit('webrtc:error', { error: error.message });
      }
    });

    // Handle IM message sending
    socket.on('im:send', async (data) => {
      try {
        const { to, message, attachmentIds } = data;

        await dbConnect();
        const User = mongoose.model('User');
        const Message = mongoose.model('Message');

        // Find sender
        const sender = await User.findById(userId);
        if (!sender) {
          socket.emit('im:error', { error: 'Sender not found' });
          return;
        }

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

        // Check if sender has blocked recipient
        if (sender.blockedUsers?.some((id) => String(id) === String(recipient._id))) {
          socket.emit('im:error', { error: 'Cannot send message to this user' });
          return;
        }

        // Check if both users are buddies (mutual acceptance required)
        const senderBuddyList = sender.buddyList || [];
        const recipientBuddyList = recipient.buddyList || [];
        const senderIsBuddy = senderBuddyList.some((id) => String(id) === String(recipient._id));
        const recipientIsBuddy = recipientBuddyList.some((id) => String(id) === userId);

        if (!senderIsBuddy || !recipientIsBuddy) {
          socket.emit('im:error', { error: 'You must be buddies to send messages' });
          return;
        }

        // Validate attachment IDs if provided
        if (attachmentIds && Array.isArray(attachmentIds) && attachmentIds.length > 0) {
          const FileAttachment = mongoose.model('FileAttachment');
          const attachments = await FileAttachment.find({
            _id: { $in: attachmentIds },
            uploadedBy: userId,
          });
          if (attachments.length !== attachmentIds.length) {
            socket.emit('im:error', { error: 'Invalid attachment IDs' });
            return;
          }
        }

        // Create message in database
        const imMessage = await Message.create({
          from: userId,
          to: recipient._id,
          content: (message || '').trim(),
          type: 'im',
          deleted: false,
          attachments: attachmentIds && attachmentIds.length > 0 ? attachmentIds : undefined,
        });

        // Update attachment records to link to message
        if (attachmentIds && attachmentIds.length > 0) {
          const FileAttachment = mongoose.model('FileAttachment');
          await FileAttachment.updateMany(
            { _id: { $in: attachmentIds } },
            { messageId: imMessage._id }
          );
        }

        await imMessage.populate('from', 'username');
        await imMessage.populate('to', 'username');

        const messageData = {
          id: String(imMessage._id),
          from: imMessage.from.username,
          to: imMessage.to?.username,
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
      } catch (error) {
        socket.emit('im:error', { error: error.message || 'Failed to send message' });
      }
    });

    // Handle status updates
    socket.on('status:update', async (data) => {
      try {
        const { status } = data;
        await dbConnect();
        const User = mongoose.model('User');
        await User.findByIdAndUpdate(userId, { status, lastSeen: new Date() });

        // Notify buddies
        const user = await User.findById(userId).populate('buddyList').lean();
        if (user && user.buddyList) {
          for (const buddy of user.buddyList) {
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
      await dbConnect();
      const User = mongoose.model('User');
      
      // Update user status to offline
      await User.findByIdAndUpdate(userId, {
        status: 'offline',
        lastSeen: new Date(),
      });

      // Notify buddies
      const user = await User.findById(userId).populate('buddyList').lean();
      if (user && user.buddyList) {
        for (const buddy of user.buddyList) {
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

module.exports = { initializeSocketIO };

