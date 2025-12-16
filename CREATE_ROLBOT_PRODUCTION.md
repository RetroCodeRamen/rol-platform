# Creating ROLBOT User in Production

The ROLBOT user needs to be created in the production database before you can add it as a buddy.

## Quick Fix

SSH to your production server and run:

```bash
ssh root@10.0.0.220
cd /var/www/rol-platform
node scripts/create-rolbot-user.js
pm2 restart all
```

## What the script does

1. Connects to MongoDB using `MONGODB_URI` from `.env.local`
2. Checks if ROLBOT user already exists
3. Creates ROLBOT user if it doesn't exist:
   - Username: `rolbot`
   - Screen Name: `ROLBOT`
   - Email: `rolbot@ramn.online`
   - Status: `online`

## After creating ROLBOT

1. **Restart the server** so ROLBOT bot connects:
   ```bash
   pm2 restart all
   ```

2. **Add ROLBOT as a buddy:**
   - Log in to your account
   - Search for "rolbot" in the buddy list
   - Send a buddy request
   - ROLBOT will auto-accept within 10 seconds

3. **Start testing:**
   - Open an IM window with ROLBOT
   - Try: `hi`, `hi 5`, `away Testing`, `logout`

## Troubleshooting

If you get "MONGODB_URI not found":
- Make sure `.env.local` exists in `/var/www/rol-platform/`
- Or set the environment variable: `export MONGODB_URI="your-connection-string"`

If ROLBOT still doesn't appear:
- Check server logs: `pm2 logs`
- Look for `[ROLBOT]` messages
- Make sure `ENABLE_ROLBOT` is not set to `false` in environment variables

