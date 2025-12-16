#!/usr/bin/env node
// Script to check database status and user count
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function checkDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in .env.local');
      process.exit(1);
    }

    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });

    console.log('✅ Connected to MongoDB');

    // Get database stats
    const db = mongoose.connection.db;
    const adminDb = db.admin();
    
    // Get server status
    const serverStatus = await adminDb.command({ serverStatus: 1 });
    console.log('\n📊 Database Connection Stats:');
    console.log(`   Active connections: ${serverStatus.connections.current}`);
    console.log(`   Available connections: ${serverStatus.connections.available}`);
    
    // Get database info
    const dbStats = await db.stats();
    console.log('\n💾 Database Stats:');
    console.log(`   Database name: ${dbStats.db}`);
    console.log(`   Collections: ${dbStats.collections}`);
    console.log(`   Data size: ${(dbStats.dataSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Storage size: ${(dbStats.storageSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Index size: ${(dbStats.indexSize / 1024 / 1024).toFixed(2)} MB`);

    // Count users
    const User = mongoose.model('User');
    const userCount = await User.countDocuments();
    console.log(`\n👥 User Count: ${userCount}`);

    // Count online users
    const onlineCount = await User.countDocuments({ status: 'online' });
    console.log(`   Online users: ${onlineCount}`);

    // Count offline users
    const offlineCount = await User.countDocuments({ status: 'offline' });
    console.log(`   Offline users: ${offlineCount}`);

    // Get collection sizes
    const collections = await db.listCollections().toArray();
    console.log('\n📋 Collections:');
    for (const collection of collections) {
      const coll = db.collection(collection.name);
      const count = await coll.countDocuments();
      const stats = await coll.stats();
      console.log(`   ${collection.name}: ${count} documents (${(stats.size / 1024).toFixed(2)} KB)`);
    }

    await mongoose.disconnect();
    console.log('\n✅ Database check complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();



