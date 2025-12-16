#!/usr/bin/env node
/**
 * Script to create ROLBOT user in production database
 * Run this on the production server to ensure ROLBOT exists
 */

// Try to load .env.local, but don't fail if it doesn't exist (for production)
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // Ignore if .env.local doesn't exist
}
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function createROLBotUser() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment variables');
      console.error('   Set MONGODB_URI environment variable or create .env.local file');
      process.exit(1);
    }

    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });

    console.log('✅ Connected to MongoDB');

    // Load User model
    const User = mongoose.model('User', new mongoose.Schema({
      username: { type: String, required: true, unique: true, lowercase: true },
      screenName: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      passwordHash: { type: String, required: true },
      status: { type: String, enum: ['online', 'away', 'busy', 'offline', 'invisible'], default: 'offline' },
      awayStatus: { type: String, enum: ['available', 'away', 'busy', 'invisible'], default: 'available' },
      awayMessage: String,
      buddyList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    }, { timestamps: true }));

    const BOT_USERNAME = 'rolbot';

    // Check if ROLBOT already exists
    let botUser = await User.findOne({ username: BOT_USERNAME });

    if (botUser) {
      console.log(`✅ ROLBOT user already exists (ID: ${botUser._id})`);
      console.log(`   Username: ${botUser.username}`);
      console.log(`   Screen Name: ${botUser.screenName}`);
      console.log(`   Email: ${botUser.email}`);
      console.log(`   Status: ${botUser.status}`);
    } else {
      console.log('📝 Creating ROLBOT user...');
      
      const passwordHash = await bcrypt.hash('rolbot_password_' + Date.now(), 12);
      
      botUser = await User.create({
        username: BOT_USERNAME,
        screenName: 'ROLBOT',
        email: 'rolbot@ramn.online',
        passwordHash,
        status: 'online',
        awayStatus: 'available',
      });

      console.log(`✅ ROLBOT user created successfully!`);
      console.log(`   ID: ${botUser._id}`);
      console.log(`   Username: ${botUser.username}`);
      console.log(`   Screen Name: ${botUser.screenName}`);
      console.log(`   Email: ${botUser.email}`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createROLBotUser();

