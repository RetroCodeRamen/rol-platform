#!/bin/bash
# Script to set up ROLBOT on production server

SERVER_IP="10.0.0.220"
SERVER_USER="root"
SERVER_PATH="/var/www/rol-platform"

echo "🤖 Setting up ROLBOT on production server..."

# Step 1: Copy the create-rolbot-user script to server
echo "📋 Copying create-rolbot-user script to server..."
scp scripts/create-rolbot-user.js "$SERVER_USER@$SERVER_IP:$SERVER_PATH/scripts/"

# Step 2: Run the script on the server to create ROLBOT user
echo "🔧 Creating ROLBOT user in production database..."
ssh "$SERVER_USER@$SERVER_IP" "cd $SERVER_PATH && MONGODB_URI=\$(grep MONGODB_URI .env.local | cut -d '=' -f2-) node scripts/create-rolbot-user.js"

# Step 3: Verify ROLBOT files are in place
echo "✅ Verifying ROLBOT files..."
ssh "$SERVER_USER@$SERVER_IP" "cd $SERVER_PATH && ls -la src/lib/bot/rolbot-server.js"

echo ""
echo "✅ ROLBOT setup complete!"
echo ""
echo "Next steps:"
echo "1. Restart the server: ssh $SERVER_USER@$SERVER_IP 'pm2 restart all'"
echo "2. Add ROLBOT as a buddy from your account"
echo "3. Start testing by sending messages to ROLBOT"

