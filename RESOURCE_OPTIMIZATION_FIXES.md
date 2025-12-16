# Resource Optimization Fixes

## Issues Found and Fixed

### 1. **Critical: Module-Level setInterval Memory Leaks** ✅ FIXED

**Problem:**
- `src/lib/security/accountLockout.ts` had a `setInterval` running every 60 seconds that never got cleaned up
- `src/lib/security/rateLimit.ts` had a `setInterval` running every 60 seconds that never got cleaned up
- These intervals ran forever, even when not needed, consuming CPU and memory

**Fix:**
- Changed to lazy initialization: intervals only start when first needed
- Added auto-cleanup: intervals stop themselves when their data structures are empty
- Intervals can now be properly managed and stopped

### 2. **Database Connection Pooling** ✅ FIXED

**Problem:**
- WebSocket server (`src/lib/websocket/server.js`) had its own `dbConnect()` function
- Could create multiple database connections instead of reusing the connection pool
- No connection pool size limits

**Fix:**
- Added connection pool configuration (maxPoolSize: 10, minPoolSize: 2)
- Better connection state checking to reuse existing connections
- Added connection timeout settings

### 3. **PM2 Memory Limits**

**Current Configuration:**
- PM2 is started with `--max-old-space-size=2048` (2GB memory limit)
- This is set in `deploy.sh` line 129

**Recommendations:**
- If server has < 4GB RAM: Keep 2GB limit
- If server has 4-8GB RAM: Increase to `--max-old-space-size=3072` (3GB)
- If server has > 8GB RAM: Increase to `--max-old-space-size=4096` (4GB)

## Remaining Potential Issues

### 4. **Component-Level Intervals**

These intervals should be cleaned up properly, but monitor for issues:

- **BuddyList.tsx**: Ping interval every 10 seconds ✅ (has cleanup)
- **ROLShell.tsx**: Buddy request check every 10 seconds ✅ (has cleanup)
- **WeatherWindow.tsx**: Weather refresh every 15 minutes ✅ (has cleanup)
- **ConnectScreen.tsx**: Step interval for dial-up ✅ (has cleanup, but complex)

### 5. **WebSocket Connection Cleanup**

The WebSocket disconnect handler cleans up mappings, but ensure:
- All socket event listeners are properly removed
- No orphaned socket connections remain in memory

## Server Resource Recommendations

### Minimum Requirements:
- **RAM**: 2GB minimum, 4GB recommended
- **CPU**: 2 cores minimum
- **Storage**: 10GB for application + logs

### For Production with Multiple Users:
- **RAM**: 4-8GB recommended
- **CPU**: 4 cores recommended
- **Storage**: 20GB+ for application + logs + uploads

### PM2 Configuration Updates Needed:

Update `deploy.sh` line 129 based on server RAM:

```bash
# For 4GB RAM server:
pm2 start server.js --name "$SERVICE_NAME" --node-args="--max-old-space-size=3072"

# For 8GB+ RAM server:
pm2 start server.js --name "$SERVICE_NAME" --node-args="--max-old-space-size=4096"
```

## Monitoring Commands

### Check Server Resources:
```bash
ssh root@10.0.0.220 "free -h && top -bn1 | head -20"
```

### Check PM2 Status:
```bash
ssh root@10.0.0.220 "pm2 status && pm2 list"
```

### Check PM2 Memory Usage:
```bash
ssh root@10.0.0.220 "pm2 monit"
```

### Check MongoDB Connection Count:
```bash
ssh root@10.0.0.220 "cd /var/www/rol-platform && node -e \"require('dotenv').config({path: '.env.local'}); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => { return mongoose.connection.db.admin().command({serverStatus: 1}); }).then(status => { console.log('Connections:', status.connections); process.exit(0); });\""
```

### Check User Count:
```bash
ssh root@10.0.0.220 "cd /var/www/rol-platform && node -e \"require('dotenv').config({path: '.env.local'}); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => { return mongoose.connection.db.db('rol-platform').collection('users').countDocuments(); }).then(count => { console.log('User count:', count); process.exit(0); });\""
```

## Next Steps

1. ✅ Fixed module-level setInterval memory leaks
2. ✅ Fixed database connection pooling
3. ⏳ Deploy fixes to production server
4. ⏳ Check server RAM size and adjust PM2 memory limits if needed
5. ⏳ Monitor resource usage after deployment
6. ⏳ Check user count in production database

## Deployment

After fixing these issues, deploy with:

```bash
./deploy.sh
```

Then monitor the server for 24-48 hours to ensure resource usage is stable.



