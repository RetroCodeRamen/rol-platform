#!/bin/bash
# Deployment script for ROL Platform

set -e

SERVER_IP="10.0.0.220"
SERVER_USER="root"
SERVER_PASSWORD="P0pcorn!"
REPO_URL="git@github.com:RetroCodeRamen/rol-platform.git"
APP_DIR="/var/www/rol-platform"
SERVICE_NAME="rol-platform"

echo "🚀 Starting deployment..."

# Step 1: Create GitHub repo if it doesn't exist
echo "📦 Checking GitHub repository..."
if ! git ls-remote --exit-code origin main &>/dev/null; then
    echo "⚠️  Repository doesn't exist on GitHub yet."
    echo "Please create it at: https://github.com/new"
    echo "Repository name: rol-platform"
    echo "Then run this script again."
    exit 1
fi

# Step 2: Push to GitHub
echo "📤 Pushing to GitHub..."
git push -u origin main || {
    echo "❌ Failed to push to GitHub. Make sure the repository exists."
    exit 1
}

# Step 3: Connect to server and deploy
echo "🔌 Connecting to server..."
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" bash << EOF
    set -e
    
    APP_DIR="$APP_DIR"
    REPO_URL="$REPO_URL"
    SERVICE_NAME="$SERVICE_NAME"
    SERVER_IP="$SERVER_IP"
    
    echo "📥 Cloning/updating repository..."
    
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
    
    # Clone or update repository
    if [ -d "\$APP_DIR" ]; then
        echo "🔄 Updating existing repository..."
        cd "\$APP_DIR"
        git fetch origin
        git reset --hard origin/main
    else
        echo "📥 Cloning repository..."
        mkdir -p "\$(dirname \$APP_DIR)"
        git clone "\$REPO_URL" "\$APP_DIR"
        cd "\$APP_DIR"
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
        cp .env.local.example .env.local
        echo "⚠️  Please edit .env.local and add your MongoDB connection string!"
    fi
    
    # Create uploads directory
    mkdir -p uploads/im-attachments
    
    # Start/restart with PM2
    echo "🚀 Starting application with PM2..."
    if pm2 list | grep -q "\$SERVICE_NAME"; then
        pm2 restart "\$SERVICE_NAME"
    else
        pm2 start server.js --name "\$SERVICE_NAME" --node-args="--max-old-space-size=2048"
    fi
    
    pm2 save
    pm2 startup
    
    echo "✅ Deployment complete!"
    echo "🌐 Application should be running on http://\$SERVER_IP:3001"
    echo "📊 Check status with: pm2 status"
EOF

echo "✅ Deployment script completed!"

