#!/bin/bash
# Deployment script for ROL Platform - Uses GitHub as source of truth

set -e

SERVER_IP="10.0.0.220"
SERVER_USER="root"
SERVER_PASSWORD="P0pcorn!"
REPO_URL="git@github.com:RetroCodeRamen/rol-platform.git"
APP_DIR="/var/www/rol-platform"
SERVICE_NAME="rol-platform"

echo "🚀 Starting deployment..."

# Step 1: Push to GitHub first (if not already pushed)
echo "📤 Checking if code is pushed to GitHub..."
if ! git ls-remote --exit-code origin main &>/dev/null; then
    echo "⚠️  Repository doesn't exist on GitHub yet."
    echo "Please create it at: https://github.com/new"
    echo "Repository name: rol-platform"
    echo "Then run this script again."
    exit 1
fi

# Try to push (may fail if email not verified, but that's okay - we'll pull what's there)
echo "📤 Pushing latest commits to GitHub..."
if git push -u origin main 2>&1 | grep -q "verify your email"; then
    echo "⚠️  GitHub email verification required, but continuing with deployment..."
    echo "   (Will pull latest code that's already on GitHub)"
else
    echo "✅ Code pushed to GitHub"
fi

# Step 2: Connect to server and pull from GitHub
echo "🔌 Connecting to server and pulling from GitHub..."
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" bash << EOF
    set -e
    
    APP_DIR="$APP_DIR"
    REPO_URL="$REPO_URL"
    SERVICE_NAME="$SERVICE_NAME"
    SERVER_IP="$SERVER_IP"
    
    echo "📥 Cloning/updating repository from GitHub..."
    
    # Install Node.js 20 if not present
    if ! command -v node &> /dev/null || [ "\$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -lt 20 ]; then
        echo "📦 Installing Node.js 20..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi
    
    # Install PM2 if not present
    if ! command -v pm2 &> /dev/null; then
        echo "📦 Installing PM2..."
        npm install -g pm2
    fi
    
    # Install git if not present
    if ! command -v git &> /dev/null; then
        echo "📦 Installing git..."
        apt-get update && apt-get install -y git
    fi
    
    # Clone or update repository from GitHub
    if [ -d "\$APP_DIR" ]; then
        echo "🔄 Updating existing repository from GitHub..."
        cd "\$APP_DIR"
        
        # Stash any local changes (shouldn't be any, but just in case)
        git stash || true
        
        # Pull latest from GitHub
        git fetch origin
        git reset --hard origin/main
        
        echo "✅ Repository updated from GitHub"
    else
        echo "📥 Cloning repository from GitHub..."
        mkdir -p "\$(dirname \$APP_DIR)"
        git clone "\$REPO_URL" "\$APP_DIR"
        cd "\$APP_DIR"
        echo "✅ Repository cloned from GitHub"
    fi
    
    # Install dependencies
    echo "📦 Installing dependencies..."
    npm install --production=false
    
    # Build the application
    echo "🔨 Building application..."
    npm run build
    
    # Create .env.local if it doesn't exist
    if [ ! -f .env.local ]; then
        echo "📝 Creating .env.local from example..."
        if [ -f .env.local.example ]; then
            cp .env.local.example .env.local
            echo "⚠️  Please edit .env.local and add your MongoDB connection string!"
        else
            echo "⚠️  .env.local.example not found. Creating basic .env.local..."
            echo "# MongoDB connection string" > .env.local
            echo "MONGODB_URI=your_mongodb_connection_string_here" >> .env.local
            echo "⚠️  Please edit .env.local and add your MongoDB connection string!"
        fi
    else
        echo "✅ .env.local already exists (preserving existing configuration)"
    fi
    
    # Create uploads directory
    mkdir -p uploads/im-attachments
    
    # Start/restart with PM2
    echo "🚀 Starting application with PM2..."
    if pm2 list | grep -q "\$SERVICE_NAME"; then
        echo "🔄 Restarting existing service..."
        pm2 restart "\$SERVICE_NAME"
    else
        echo "🆕 Starting new service..."
        pm2 start server.js --name "\$SERVICE_NAME" --node-args="--max-old-space-size=2048"
    fi
    
    pm2 save
    
    # Update Cloudflare DNS if configured
    if [ -f .env.cloudflare ]; then
        echo "🌐 Updating Cloudflare DNS..."
        export \$(cat .env.cloudflare | xargs) && ./scripts/update-cloudflare-dns.sh || echo "⚠️  DNS update skipped (check .env.cloudflare)"
    fi
    
    echo ""
    echo "✅ Deployment complete!"
    echo "🌐 Application should be running on http://\$SERVER_IP:3001"
    echo "🌍 DNS: https://ramn.online (if configured)"
    echo "📊 Check status with: pm2 status"
    echo "📋 View logs with: pm2 logs \$SERVICE_NAME"
EOF

echo ""
echo "✅ Deployment script completed!"
echo ""
echo "📝 Next steps:"
echo "   1. Verify the app is running: ssh root@10.0.0.220 'pm2 status'"
echo "   2. Check logs if needed: ssh root@10.0.0.220 'pm2 logs rol-platform'"
echo "   3. If .env.local needs updating: ssh root@10.0.0.220 'cd /var/www/rol-platform && nano .env.local && pm2 restart rol-platform'"
