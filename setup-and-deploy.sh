#!/bin/bash
set -e

echo "🚀 ROL Platform - Setup and Deployment Script"
echo "=============================================="
echo ""

# Step 1: Create GitHub Repository
echo "📦 Step 1: Setting up GitHub repository..."
if git ls-remote --exit-code origin main &>/dev/null 2>&1; then
    echo "✅ Repository already exists on GitHub"
else
    echo "⚠️  Repository doesn't exist yet."
    echo ""
    echo "Please create it now:"
    echo "1. Open: https://github.com/new"
    echo "2. Repository name: rol-platform"
    echo "3. Description: Retro web-based AOL experience"
    echo "4. Make it Public"
    echo "5. DO NOT initialize with README, .gitignore, or license"
    echo "6. Click 'Create repository'"
    echo ""
    read -p "Press Enter once you've created the repository..."
    
    # Try to push
    echo "📤 Pushing to GitHub..."
    git push -u origin main || {
        echo "❌ Failed to push. Please check:"
        echo "   - Repository name is exactly 'rol-platform'"
        echo "   - Repository is under RetroCodeRamen organization"
        echo "   - You have push access"
        exit 1
    }
fi

echo ""
echo "✅ Code pushed to GitHub!"
echo ""

# Step 2: Deploy to Server
echo "🔌 Step 2: Deploying to server..."
./deploy.sh

echo ""
echo "🎉 All done! Your application should be running at:"
echo "   http://10.0.0.220:3001"
