'use client';

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let isConnecting = false;
let connectionPromise: Promise<Socket> | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export async function connectSocket(userId: string): Promise<Socket> {
  if (socket?.connected) {
    return socket;
  }

  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }

  isConnecting = true;
  connectionPromise = new Promise((resolve, reject) => {
    try {
      // Connect to Socket.io server
      socket = io({
        path: '/api/socket.io',
        auth: {
          userId, // Pass user ID for authentication
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      socket.on('connect', () => {
        isConnecting = false;
        resolve(socket!);
      });

      socket.on('disconnect', () => {
        isConnecting = false;
      });

      socket.on('connect_error', (error) => {
        isConnecting = false;
        connectionPromise = null;
        console.error('Socket connection error:', error);
        reject(error);
      });
    } catch (error) {
      isConnecting = false;
      connectionPromise = null;
      reject(error);
    }
  });

  return connectionPromise;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  isConnecting = false;
  connectionPromise = null;
}

