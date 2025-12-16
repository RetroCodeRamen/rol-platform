#!/bin/bash
# Simple script to create ROLBOT user on production server
# Run this directly on the production server

echo "🤖 Creating ROLBOT user in production database..."

cd /var/www/rol-platform || exit 1

# Load environment variables from .env.local
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | grep MONGODB_URI | xargs)
fi

# Run the create script
node scripts/create-rolbot-user.js

echo ""
echo "✅ Done! If ROLBOT was created, restart the server with: pm2 restart all"

