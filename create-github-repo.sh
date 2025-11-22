#!/bin/bash
# Create GitHub repository using GitHub CLI or manual instructions

if command -v gh &> /dev/null; then
    echo "Creating repository with GitHub CLI..."
    gh repo create RetroCodeRamen/rol-platform --public --description "Retro web-based AOL experience - A nostalgic recreation of classic AOL with React 19 and Next.js 15"
    git push -u origin main
else
    echo "GitHub CLI not found. Please create the repository manually:"
    echo ""
    echo "1. Go to: https://github.com/new"
    echo "2. Owner: RetroCodeRamen"
    echo "3. Repository name: rol-platform"
    echo "4. Description: Retro web-based AOL experience"
    echo "5. Make it Public"
    echo "6. DO NOT initialize with README, .gitignore, or license"
    echo "7. Click 'Create repository'"
    echo ""
    echo "Then run: git push -u origin main"
fi
