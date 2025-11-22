# Accessing RamenOnline from Another Machine on Your LAN

## Quick Setup

The server is now configured to accept connections from your local network. No changes needed!

## Steps to Access from Another Machine

1. **Start the server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Find your machine's IP address**:
   
   **Linux/Mac:**
   ```bash
   ip addr show | grep "inet " | grep -v 127.0.0.1
   ```
   or
   ```bash
   hostname -I
   ```
   
   **Windows:**
   ```bash
   ipconfig
   ```
   Look for "IPv4 Address" under your network adapter (usually starts with 192.168.x.x or 10.x.x.x)

3. **Access from another machine**:
   - Open a web browser on the other machine
   - Navigate to: `http://<your-ip-address>:3001`
   - Example: `http://192.168.1.100:3001`

## What Was Changed

- **Server binding**: Changed from `localhost` to `0.0.0.0` (allows connections from any network interface)
- **CORS**: Updated to allow all origins in development mode (for LAN access)
- **Socket.io**: Configured to accept connections from any origin in dev mode

## Firewall Considerations

If you can't connect, you may need to allow port 3001 through your firewall:

**Linux (ufw):**
```bash
sudo ufw allow 3001/tcp
```

**Linux (firewalld):**
```bash
sudo firewall-cmd --add-port=3001/tcp --permanent
sudo firewall-cmd --reload
```

**Windows:**
- Open Windows Firewall settings
- Add inbound rule for port 3001 (TCP)

**Mac:**
- System Preferences → Security & Privacy → Firewall
- Add application or port exception

## Production Deployment

For production, set these environment variables:

```bash
HOSTNAME=0.0.0.0  # or specific IP
PORT=3001
NEXT_PUBLIC_APP_URL=http://your-domain.com  # For CORS in production
```

## Troubleshooting

- **Can't connect**: Check firewall settings
- **WebSocket errors**: Make sure CORS is allowing your origin
- **Connection refused**: Verify the server is running and bound to 0.0.0.0
- **Check server logs**: The server will print available LAN IPs on startup




