/**
 * ROLBOT Server-side initialization
 * This file runs on the server to start the bot
 */

const mongoose = require('mongoose');
const { io } = require('socket.io-client');

// Bot state
let botSocket = null;
let botUserId = null;
const BOT_USERNAME = 'rolbot';

const botState = {
  responseDelay: 0,
  awayMessage: null,
  isLoggedOut: false,
  logoutUntil: null,
};

async function dbConnect() {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }
  
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }
  
  const options = {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };
  
  return mongoose.connect(mongoUri, options);
}

async function initializeROLBot() {
  try {
    console.log('[ROLBOT] Initializing ROLBOT...');
    
    await dbConnect();
    
    // Import User model schema
    const UserSchema = new mongoose.Schema({
      username: { type: String, required: true, unique: true, lowercase: true },
      screenName: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      passwordHash: { type: String, required: true },
      status: { type: String, enum: ['online', 'away', 'busy', 'offline', 'invisible'], default: 'offline' },
      awayStatus: { type: String, enum: ['available', 'away', 'busy', 'invisible'], default: 'available' },
      awayMessage: String,
      buddyList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      lastSeen: Date,
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    }, { timestamps: true });
    
    const User = mongoose.models.User || mongoose.model('User', UserSchema);
    const bcrypt = require('bcryptjs');
    
    // Find or create ROLBOT user
    let botUser = await User.findOne({ username: BOT_USERNAME });
    
    if (!botUser) {
      console.log('[ROLBOT] Creating ROLBOT user account...');
      const passwordHash = await bcrypt.hash('rolbot_password_' + Date.now(), 12);
      
      botUser = await User.create({
        username: BOT_USERNAME,
        screenName: 'ROLBOT',
        email: 'rolbot@ramn.online',
        passwordHash,
        status: 'online',
        awayStatus: 'available',
      });
      console.log('[ROLBOT] User account created:', botUser._id);
    } else {
      console.log('[ROLBOT] Using existing user account:', botUser._id);
    }
    
    botUserId = String(botUser._id);
    
    // Connect to WebSocket server
    const serverUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
    console.log('[ROLBOT] Connecting to WebSocket server:', serverUrl);
    
    botSocket = io(serverUrl, {
      path: '/api/socket.io',
      auth: {
        userId: botUserId,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });
    
    botSocket.on('connect', async () => {
      console.log('[ROLBOT] ✅ Connected to WebSocket server');
      setupMessageHandlers();
      // Check for pending buddy requests immediately on connect
      await checkAndAcceptBuddyRequests();
    });
    
    botSocket.on('disconnect', () => {
      console.log('[ROLBOT] Disconnected from server');
    });
    
    botSocket.on('connect_error', (error) => {
      console.error('[ROLBOT] Connection error:', error.message);
    });
    
    // Update status to online and set lastActiveAt
    await User.findByIdAndUpdate(botUserId, {
      status: 'online',
      lastSeen: new Date(),
      lastActiveAt: new Date(),
      isManuallyLoggedOff: false,
    });
    
    // Keep ROLBOT online by updating lastActiveAt every 20 seconds
    setInterval(async () => {
      if (botUserId && !botState.isLoggedOut) {
        try {
          await dbConnect();
          // Use the same User schema definition
          const UserSchema = new mongoose.Schema({
            username: { type: String, required: true, unique: true, lowercase: true },
            screenName: { type: String, required: true },
            email: { type: String, required: true, unique: true },
            passwordHash: { type: String, required: true },
            status: { type: String, enum: ['online', 'away', 'busy', 'offline', 'invisible'], default: 'offline' },
            awayStatus: { type: String, enum: ['available', 'away', 'busy', 'invisible'], default: 'available' },
            awayMessage: String,
            buddyList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
            blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
            lastSeen: Date,
            lastActiveAt: Date,
            isManuallyLoggedOff: Boolean,
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
          }, { timestamps: true });
          
          const User = mongoose.models.User || mongoose.model('User', UserSchema);
          await User.findByIdAndUpdate(botUserId, {
            lastActiveAt: new Date(),
          });
          console.log('[ROLBOT] Updated lastActiveAt');
        } catch (error) {
          console.error('[ROLBOT] Error updating lastActiveAt:', error);
        }
      }
    }, 20000); // Every 20 seconds (within 30 second threshold)
    
    console.log('[ROLBOT] ✅ Initialization complete');
  } catch (error) {
    console.error('[ROLBOT] ❌ Initialization error:', error);
    throw error;
  }
}

async function checkAndAcceptBuddyRequests() {
  try {
    await dbConnect();
    
    // Import User model schema
    const UserSchema = new mongoose.Schema({
      username: { type: String, required: true, unique: true, lowercase: true },
      screenName: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      passwordHash: { type: String, required: true },
      status: { type: String, enum: ['online', 'away', 'busy', 'offline', 'invisible'], default: 'offline' },
      awayStatus: { type: String, enum: ['available', 'away', 'busy', 'invisible'], default: 'available' },
      awayMessage: String,
      buddyList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      lastSeen: Date,
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    }, { timestamps: true });
    
    const User = mongoose.models.User || mongoose.model('User', UserSchema);
    
    // BuddyRequest schema
    const BuddyRequestSchema = new mongoose.Schema({
      requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    }, { timestamps: true });
    
    const BuddyRequest = mongoose.models.BuddyRequest || mongoose.model('BuddyRequest', BuddyRequestSchema);

    if (!botUserId) return;

    // Find pending buddy requests for ROLBOT
    const pendingRequests = await BuddyRequest.find({
      recipientId: botUserId,
      status: 'pending',
    }).populate('requesterId', 'username');

    for (const request of pendingRequests) {
      // Get requester ID (handle both populated and unpopulated)
      const requesterId = request.requesterId._id ? String(request.requesterId._id) : String(request.requesterId);
      const requesterUsername = request.requesterId?.username || 'unknown';
      console.log(`[ROLBOT] Auto-accepting buddy request from ${requesterUsername} (ID: ${requesterId})`);
      
      // Accept the request
      request.status = 'accepted';
      await request.save();

      // Add to both buddy lists
      const requester = await User.findById(requesterId);
      const botUser = await User.findById(botUserId);

      if (requester && botUser) {
        // Add requester to bot's buddy list
        if (!botUser.buddyList) {
          botUser.buddyList = [];
        }
        if (!botUser.buddyList.some((id) => String(id) === requesterId)) {
          botUser.buddyList.push(requesterId);
          await botUser.save();
        }

        // Add bot to requester's buddy list
        if (!requester.buddyList) {
          requester.buddyList = [];
        }
        const botId = String(botUserId);
        if (!requester.buddyList.some((id) => String(id) === botId)) {
          requester.buddyList.push(botId);
          await requester.save();
        }

        console.log(`[ROLBOT] ✅ Auto-accepted buddy request from ${requester.username}`);
      }
    }
  } catch (error) {
    console.error('[ROLBOT] Error checking buddy requests:', error);
  }
}

function setupMessageHandlers() {
  if (!botSocket) return;
  
  // Check for buddy requests every 10 seconds
  setInterval(() => {
    checkAndAcceptBuddyRequests();
  }, 10000);
  
  // Listen for new IM messages
  botSocket.on('im:new', async (messageData) => {
    try {
      // Only respond to messages TO the bot
      if (messageData.to?.toLowerCase() !== BOT_USERNAME) {
        return;
      }
      
      const message = (messageData.message || '').trim();
      const from = messageData.from;
      
      console.log(`[ROLBOT] Received message from ${from}: "${message}"`);
      
      // Check if bot is logged out
      if (botState.isLoggedOut) {
        const now = Date.now();
        if (botState.logoutUntil && now < botState.logoutUntil) {
          console.log(`[ROLBOT] Bot is logged out, ignoring message`);
          return;
        } else {
          // Logout period expired
          botState.isLoggedOut = false;
          botState.logoutUntil = null;
          await updateStatus('online');
          console.log('[ROLBOT] Logout period expired, bot is back online');
        }
      }
      
      // Update lastActiveAt when receiving a message to stay online
      if (botUserId) {
        try {
          await dbConnect();
          const UserSchema = new mongoose.Schema({
            username: { type: String, required: true, unique: true, lowercase: true },
            screenName: { type: String, required: true },
            email: { type: String, required: true, unique: true },
            passwordHash: { type: String, required: true },
            status: { type: String, enum: ['online', 'away', 'busy', 'offline', 'invisible'], default: 'offline' },
            awayStatus: { type: String, enum: ['available', 'away', 'busy', 'invisible'], default: 'available' },
            awayMessage: String,
            buddyList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
            blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
            lastSeen: Date,
            lastActiveAt: Date,
            isManuallyLoggedOff: Boolean,
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
          }, { timestamps: true });
          const User = mongoose.models.User || mongoose.model('User', UserSchema);
          await User.findByIdAndUpdate(botUserId, {
            lastActiveAt: new Date(),
          });
        } catch (error) {
          console.error('[ROLBOT] Error updating lastActiveAt on message:', error);
        }
      }
      
      // Parse and handle commands
      await handleCommand(message, from);
    } catch (error) {
      console.error('[ROLBOT] Error handling message:', error);
    }
  });
  
  botSocket.on('im:sent', (messageData) => {
    console.log('[ROLBOT] Message sent confirmation');
  });
  
  botSocket.on('im:error', (error) => {
    console.error('[ROLBOT] IM error:', error);
  });
}

async function handleCommand(message, from) {
  const lowerMessage = message.toLowerCase().trim();
  
  // Handle logout command
  if (lowerMessage === 'logout') {
    botState.isLoggedOut = true;
    botState.logoutUntil = Date.now() + (30 * 1000); // 30 seconds
    await updateStatus('offline');
    await sendMessage(from, 'Logging out for 30 seconds...');
    console.log('[ROLBOT] Logged out for 30 seconds');
    
    // Auto-login after 30 seconds
    setTimeout(async () => {
      botState.isLoggedOut = false;
      botState.logoutUntil = null;
      await updateStatus('online');
      console.log('[ROLBOT] Auto-logged back in after 30 seconds');
    }, 30000);
    return;
  }
  
  // Handle away message command
  if (lowerMessage.startsWith('away ')) {
    const awayMsg = message.substring(5).trim();
    if (awayMsg) {
      botState.awayMessage = awayMsg;
      await updateAwayMessage(awayMsg);
      await sendMessage(from, `Away message set: "${awayMsg}"`);
      console.log(`[ROLBOT] Away message set: "${awayMsg}"`);
    } else {
      // Clear away message
      botState.awayMessage = null;
      await updateAwayMessage(null);
      await sendMessage(from, 'Away message cleared');
      console.log('[ROLBOT] Away message cleared');
    }
    return;
  }
  
  // Handle hi command with optional delay
  if (lowerMessage.startsWith('hi')) {
    let delay = 0;
    
    // Check for delay number
    const parts = message.split(/\s+/);
    if (parts.length > 1) {
      const delayStr = parts[parts.length - 1];
      const parsedDelay = parseInt(delayStr, 10);
      if (!isNaN(parsedDelay) && parsedDelay >= 0) {
        delay = parsedDelay;
      }
    }
    
    const response = delay > 0 
      ? `Hi! (responding after ${delay} second${delay !== 1 ? 's' : ''} delay)`
      : 'Hi!';
    
    if (delay > 0) {
      console.log(`[ROLBOT] Will respond in ${delay} seconds`);
      setTimeout(async () => {
        // Update lastActiveAt before sending delayed response
        if (botUserId) {
          try {
            await dbConnect();
            const UserSchema = new mongoose.Schema({
              username: { type: String, required: true, unique: true, lowercase: true },
              screenName: { type: String, required: true },
              email: { type: String, required: true, unique: true },
              passwordHash: { type: String, required: true },
              status: { type: String, enum: ['online', 'away', 'busy', 'offline', 'invisible'], default: 'offline' },
              awayStatus: { type: String, enum: ['available', 'away', 'busy', 'invisible'], default: 'available' },
              awayMessage: String,
              buddyList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
              blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
              lastSeen: Date,
              lastActiveAt: Date,
              isManuallyLoggedOff: Boolean,
              createdAt: { type: Date, default: Date.now },
              updatedAt: { type: Date, default: Date.now },
            }, { timestamps: true });
            const User = mongoose.models.User || mongoose.model('User', UserSchema);
            await User.findByIdAndUpdate(botUserId, {
              lastActiveAt: new Date(),
            });
          } catch (error) {
            console.error('[ROLBOT] Error updating lastActiveAt before delayed response:', error);
          }
        }
        await sendMessage(from, response);
      }, delay * 1000);
    } else {
      await sendMessage(from, response);
    }
    return;
  }
  
  // Default: echo the message
  await sendMessage(from, `You said: "${message}"`);
}

async function sendMessage(to, message) {
  if (!botSocket || !botSocket.connected) {
    console.error('[ROLBOT] Cannot send message: socket not connected');
    return;
  }
  
  try {
    console.log(`[ROLBOT] Sending message to ${to}: "${message}"`);
    botSocket.emit('im:send', {
      to,
      message,
    });
  } catch (error) {
    console.error('[ROLBOT] Error sending message:', error);
  }
}

async function updateStatus(status) {
  if (!botUserId) return;
  
  try {
    await dbConnect();
    const User = mongoose.models.User || mongoose.model('User');
    const update = {
      status,
      lastSeen: new Date(),
    };
    
    // Update lastActiveAt if going online
    if (status === 'online') {
      update.lastActiveAt = new Date();
      update.isManuallyLoggedOff = false;
    } else if (status === 'offline') {
      update.isManuallyLoggedOff = true;
    }
    
    await User.findByIdAndUpdate(botUserId, update);
    
    if (botSocket) {
      botSocket.emit('status:update', { status });
    }
  } catch (error) {
    console.error('[ROLBOT] Error updating status:', error);
  }
}

async function updateAwayMessage(message) {
  if (!botUserId) return;
  
  try {
    await dbConnect();
    const User = mongoose.models.User || mongoose.model('User');
    const update = {
      awayMessage: message,
      lastSeen: new Date(),
    };
    
    if (message) {
      update.awayStatus = 'away';
      update.status = 'away';
    } else {
      update.awayStatus = 'available';
      update.status = 'online';
    }
    
    await User.findByIdAndUpdate(botUserId, update);
    
    if (botSocket) {
      botSocket.emit('status:update', { 
        status: message ? 'away' : 'online' 
      });
    }
  } catch (error) {
    console.error('[ROLBOT] Error updating away message:', error);
  }
}

module.exports = { initializeROLBot };

