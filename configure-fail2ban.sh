#!/bin/bash
# Configure fail2ban for SSH protection

SERVER_IP="10.0.0.220"
SERVER_USER="root"
SERVER_PASSWORD="P0pcorn!"

sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" bash << 'EOF'
set -e

echo "=== Configuring fail2ban ==="

# Create fail2ban jail for SSH
cat > /etc/fail2ban/jail.local << 'JAIL_EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
destemail = root@localhost
sendername = Fail2Ban
action = %(action_)s

[sshd]
enabled = true
port = ssh
logpath = %(sshd_log)s
backend = %(sshd_backend)s
maxretry = 3
bantime = 7200
JAIL_EOF

# Restart fail2ban
systemctl restart fail2ban
systemctl enable fail2ban

echo "✅ fail2ban configured"
echo "Checking status:"
fail2ban-client status sshd

EOF

echo "✅ fail2ban configuration complete"

