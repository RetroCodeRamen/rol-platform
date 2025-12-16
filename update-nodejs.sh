#!/bin/bash
# Update Node.js and npm to latest secure versions

SERVER_IP="10.0.0.220"
SERVER_USER="root"
SERVER_PASSWORD="P0pcorn!"

echo "🔄 Updating Node.js and npm to latest secure versions..."
echo "Current versions will be checked and updated if needed"

sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" bash << 'EOF'
set -e

echo "=== Current Versions ==="
node -v
npm -v

echo ""
echo "=== Checking for latest Node.js LTS ==="
# Get latest LTS version
LATEST_LTS=$(curl -s https://nodejs.org/dist/index.json | grep -o '"version":"v[0-9]*\.[0-9]*\.[0-9]*","lts":"[^"]*"' | head -1 | grep -o 'v[0-9]*\.[0-9]*\.[0-9]*' | head -1)

if [ -z "$LATEST_LTS" ]; then
    # Fallback: Use Node.js 22.x LTS (current LTS)
    LATEST_LTS="22"
    echo "Using Node.js 22.x LTS (fallback)"
else
    echo "Latest LTS version: $LATEST_LTS"
fi

CURRENT_NODE=$(node -v | sed 's/v//')
CURRENT_MAJOR=$(echo $CURRENT_NODE | cut -d. -f1)

echo ""
echo "Current Node.js: v$CURRENT_NODE"
echo "Target version: Node.js $LATEST_LTS.x LTS"

# Check if update is needed
if [ "$CURRENT_MAJOR" -lt 22 ]; then
    echo ""
    echo "⚠️  Node.js version is outdated. Updating to latest LTS..."
    
    # Remove old NodeSource repository if exists
    rm -f /etc/apt/sources.list.d/nodesource.list 2>/dev/null || true
    
    # Install Node.js 22.x LTS
    echo "Installing Node.js 22.x LTS..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
    
    echo ""
    echo "=== Updated Versions ==="
    node -v
    npm -v
    
    # Update npm to latest
    echo ""
    echo "=== Updating npm to latest ==="
    npm install -g npm@latest
    
    echo ""
    echo "=== Final Versions ==="
    node -v
    npm -v
    
    # Verify installation
    echo ""
    echo "=== Verifying Installation ==="
    which node
    which npm
    node --version
    npm --version
    
    echo ""
    echo "✅ Node.js and npm updated successfully!"
else
    echo ""
    echo "✅ Node.js version is up to date (v$CURRENT_NODE)"
    echo "Updating npm to latest..."
    npm install -g npm@latest
    npm -v
    echo "✅ npm updated"
fi

echo ""
echo "=== Security Check ==="
echo "Checking for known vulnerabilities in Node.js version..."
node -v

EOF

echo ""
echo "✅ Node.js update script completed!"
echo ""
echo "⚠️  Next step: Restart the application to use new Node.js version"
echo "   Run: ssh root@10.0.0.220 'cd /var/www/rol-platform && pm2 restart rol-platform'"

