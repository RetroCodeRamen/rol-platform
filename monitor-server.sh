#!/bin/bash
# Server monitoring script

SERVER_IP="10.0.0.220"
SERVER_USER="root"
SERVER_PASSWORD="P0pcorn!"

echo "🔍 Server Health Check - $(date)"
echo "=================================="

sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" bash << 'EOF'
echo ""
echo "=== CPU & Memory Usage ==="
top -bn1 | head -5
free -h | head -2

echo ""
echo "=== Top CPU Processes ==="
ps aux --sort=-%cpu | head -6

echo ""
echo "=== Application Status ==="
pm2 status

echo ""
echo "=== Suspicious Processes Check ==="
ps aux | grep -E 'xmrig|scanner|pcpcat|miner' | grep -v grep || echo "✅ No suspicious processes found"

echo ""
echo "=== Network Connections ==="
netstat -tulpn 2>/dev/null | grep -E 'LISTEN|1080|3333|4444' || echo "✅ No suspicious ports"

echo ""
echo "=== Disk Usage ==="
df -h | grep -E 'Filesystem|/$'

echo ""
echo "=== Fail2ban Status ==="
fail2ban-client status sshd 2>/dev/null | grep -E 'Currently banned|Total banned' || echo "Fail2ban not running"

echo ""
echo "=== Recent Auth Logs (last 5 entries) ==="
tail -5 /var/log/auth.log 2>/dev/null | grep -E 'Failed|Accepted' || echo "No recent auth activity"

EOF

echo ""
echo "✅ Health check complete"

