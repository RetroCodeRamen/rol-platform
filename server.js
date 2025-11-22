const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
// Use 0.0.0.0 to allow access from LAN, or use HOSTNAME env var
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3001', 10);

// For Next.js, use '0.0.0.0' or undefined to allow all interfaces
const nextHostname = hostname === '0.0.0.0' ? undefined : hostname;
const app = next({ dev, hostname: nextHostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.io
  // Allow CORS from any origin in dev, or specific URL in production
  const allowedOrigins = dev 
    ? true // Allow all origins in dev for LAN access
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
  
  const io = new Server(httpServer, {
    path: '/api/socket.io',
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Import and initialize socket handlers
  const { initializeSocketIO } = require('./src/lib/websocket/server.js');
  initializeSocketIO(io);

  httpServer.listen(port, hostname, (err) => {
    if (err) throw err;
    const displayHost = hostname === '0.0.0.0' ? 'localhost' : hostname;
    console.log(`> Ready on http://${displayHost}:${port}`);
    if (hostname === '0.0.0.0') {
      // Try to get the local IP address
      const os = require('os');
      const networkInterfaces = os.networkInterfaces();
      const addresses = [];
      for (const name of Object.keys(networkInterfaces)) {
        for (const iface of networkInterfaces[name]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            addresses.push(iface.address);
          }
        }
      }
      if (addresses.length > 0) {
        console.log(`> Accessible on LAN at:`);
        addresses.forEach(ip => {
          console.log(`>   http://${ip}:${port}`);
        });
      } else {
        console.log(`> Accessible on LAN at http://<your-ip>:${port}`);
        console.log(`> Find your IP with: ip addr show | grep "inet "`);
      }
    }
  });
});

