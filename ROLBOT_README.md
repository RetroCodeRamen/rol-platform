# ROLBOT - Automated Testing Bot

ROLBOT is an automated testing bot that acts as a real user in the system. It connects via WebSocket and responds to messages using the real IM system, making it perfect for testing features without needing multiple logged-in users.

## Features

- **Auto-responds to messages** - Responds immediately or with a configurable delay
- **Auto-accepts buddy requests** - Automatically accepts any buddy requests sent to it
- **Uses real messaging system** - All interactions go through the same IM system as real users
- **Configurable commands** - Control the bot via IM messages

## Commands

### Basic Response
- `hi` - Bot responds immediately with "Hi!"
- `hi <seconds>` - Bot waits the specified number of seconds before responding
  - Example: `hi 10` - Bot waits 10 seconds, then responds "Hi! (responding after 10 seconds delay)"

### Away Message
- `away <message>` - Sets an away message for the bot
  - Example: `away This is a test` - Sets away message to "This is a test"
- `away` (with no message) - Clears the away message

### Logout
- `logout` - Logs the bot out for 30 seconds, then automatically logs back in

## Setup

### Local Development

ROLBOT is automatically started when the server starts (unless `ENABLE_ROLBOT=false` is set).

### Production

1. **Create ROLBOT user in database:**
   ```bash
   node scripts/create-rolbot-user.js
   ```

2. **Ensure ROLBOT is enabled:**
   The bot is enabled by default. To disable it, set `ENABLE_ROLBOT=false` in your environment variables.

3. **Add ROLBOT as a buddy:**
   - Log in to your account
   - Search for "rolbot" in the buddy list
   - Send a buddy request
   - ROLBOT will automatically accept it

## Usage

1. **Add ROLBOT as a buddy** (if not already done)
2. **Open an IM window** with ROLBOT
3. **Send commands** to test features:
   - Test immediate responses: `hi`
   - Test delayed responses: `hi 5`
   - Test away messages: `away Testing away message`
   - Test logout behavior: `logout`

## Technical Details

- **Username:** `rolbot`
- **Screen Name:** `ROLBOT`
- **Email:** `rolbot@ramn.online`
- **Status:** Automatically set to `online` when bot starts
- **Buddy Requests:** Auto-accepted every 10 seconds

## Files

- `src/lib/bot/rolbot-server.js` - Server-side bot implementation
- `src/services/ROLBot.ts` - TypeScript bot service (for future use)
- `scripts/create-rolbot-user.js` - Script to create ROLBOT user in database
- `server.js` - Bot initialization on server start

## Notes

- ROLBOT uses the same WebSocket connection as real users
- All messages go through the same IM system and database
- ROLBOT respects buddy requirements - you must be buddies to message it
- The bot automatically reconnects if the connection is lost

