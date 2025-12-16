#!/bin/bash
# Script to check and create ROLBOT user on production server

SERVER_IP="10.0.0.220"
SERVER_USER="root"
SERVER_PATH="/var/www/rol-platform"

echo "🔍 Checking ROLBOT user on production server..."

# Check if ROLBOT user exists
ssh "$SERVER_USER@$SERVER_IP" << 'EOF'
cd /var/www/rol-platform

# Load environment variables
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

# Check if ROLBOT exists
node -e "
const mongoose = require('mongoose');
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('❌ MONGODB_URI not found');
  process.exit(1);
}

mongoose.connect(mongoUri, { maxPoolSize: 10, serverSelectionTimeoutMS: 5000 })
  .then(async () => {
    const User = mongoose.model('User', new mongoose.Schema({
      username: String,
      screenName: String,
      email: String,
      status: String,
    }, { collection: 'users' }));
    
    const botUser = await User.findOne({ username: 'rolbot' });
    if (botUser) {
      console.log('✅ ROLBOT user exists:');
      console.log('   ID:', botUser._id);
      console.log('   Username:', botUser.username);
      console.log('   Screen Name:', botUser.screenName);
      console.log('   Status:', botUser.status);
    } else {
      console.log('❌ ROLBOT user NOT found');
      console.log('   Run: node scripts/create-rolbot-user.js');
    }
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
"
EOF

