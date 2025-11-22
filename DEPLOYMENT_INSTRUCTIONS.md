# Deployment Instructions

## ✅ Server Setup Complete!

The server at `10.0.0.220` is now ready with:
- Node.js 20.19.5
- npm 10.8.2
- PM2 (process manager)
- Git
- Build tools

## 📦 Step 1: Create GitHub Repository

1. Go to: https://github.com/new
2. **Repository name:** `rol-platform`
3. **Description:** `Retro web-based AOL experience - A nostalgic recreation of classic AOL with React 19 and Next.js 15`
4. **Visibility:** Public
5. **DO NOT** initialize with README, .gitignore, or license
6. Click **"Create repository"**

## 📤 Step 2: Push to GitHub

Once the repository is created, run:

```bash
cd "/home/aj/Documents/Development/retrocoderamen web/rol-platform"
git push -u origin main
```

## 🚀 Step 3: Deploy to Server

Run the deployment script:

```bash
./deploy.sh
```

Or manually:

```bash
sshpass -p "P0pcorn!" ssh root@10.0.0.220
cd /var/www
git clone git@github.com:RetroCodeRamen/rol-platform.git
cd rol-platform
npm install
npm run build
# Create .env.local with your MongoDB connection string
cp .env.local.example .env.local
# Edit .env.local and add: MONGODB_URI=your_connection_string
pm2 start server.js --name rol-platform
pm2 save
```

## 🌐 Access

Once deployed, the application will be available at:
- **Direct:** http://10.0.0.220:3001
- **Via Reverse Proxy:** Configure your reverse proxy to point to `10.0.0.220:3001`

## 📝 Important Notes

1. **MongoDB:** Make sure to set up your MongoDB connection string in `.env.local` on the server
2. **Firewall:** Ensure port 3001 is open on the server if accessing from LAN
3. **PM2:** The app will auto-restart on server reboot if PM2 startup is configured
4. **Updates:** To update, SSH to server and run:
   ```bash
   cd /var/www/rol-platform
   git pull
   npm install
   npm run build
   pm2 restart rol-platform
   ```

