#!/bin/bash
# Server diagnostic script

SERVER_IP="10.0.0.220"
SERVER_USER="root"
SERVER_PASSWORD="P0pcorn!"

echo "=== Server Resource Usage ==="
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "free -h"

echo ""
echo "=== CPU Usage ==="
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "top -bn1 | head -20"

echo ""
echo "=== PM2 Status ==="
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "pm2 status"

echo ""
echo "=== PM2 Memory Usage ==="
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "pm2 list"

echo ""
echo "=== Recent PM2 Logs (last 30 lines) ==="
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "pm2 logs rol-platform --lines 30 --nostream"

echo ""
echo "=== MongoDB Connection Check ==="
sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "cd /var/www/rol-platform && node -e \"require('dotenv').config({path: '.env.local'}); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => { return mongoose.connection.db.admin().command({listDatabases: 1}); }).then(result => { console.log('Databases:', JSON.stringify(result.databases.map(d => d.name), null, 2)); return mongoose.connection.db.db('rol-platform').collection('users').countDocuments(); }).then(count => { console.log('User count:', count); process.exit(0); }).catch(err => { console.error('Error:', err.message); process.exit(1); });\""



