# Server Security Hardening Guide

## ✅ Completed Actions

1. **Malware Removed**
   - Killed malicious processes (xmrig, scanner.py, pcpcat)
   - Removed malicious files
   - Disabled auto-restarting malware services

2. **Firewall Configured**
   - UFW enabled with default deny incoming
   - Only SSH (22), HTTP (80), HTTPS (443), and app port (3001) allowed

3. **Fail2ban Installed**
   - Configured to ban IPs after 3 failed SSH attempts
   - 2-hour ban duration

4. **SSH Hardening Started**
   - SSH config updated (needs review before applying)

## 🔒 Remaining Security Tasks

### 1. Set Up SSH Key Authentication (CRITICAL)

**On your local machine:**
```bash
# Generate SSH key if you don't have one
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy public key to server
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@10.0.0.220
```

**On server, verify key was added:**
```bash
cat ~/.ssh/authorized_keys
```

**Test SSH key login:**
```bash
ssh -i ~/.ssh/id_ed25519 root@10.0.0.220
```

**Once SSH keys work, disable password auth:**
```bash
# Edit SSH config
nano /etc/ssh/sshd_config

# Ensure these lines:
PasswordAuthentication no
PermitRootLogin no  # Or use 'prohibit-password' to allow keys only

# Restart SSH
systemctl restart sshd
```

### 2. Change Root Password

```bash
passwd root
# Use a strong password: at least 16 characters, mixed case, numbers, symbols
```

### 3. Create Non-Root User (Recommended)

```bash
# Create user
adduser deploy
usermod -aG sudo deploy

# Copy SSH key
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Test login as new user
ssh deploy@10.0.0.220
```

### 4. Update System Regularly

```bash
# Set up automatic security updates
apt install unattended-upgrades -y
dpkg-reconfigure -plow unattended-upgrades

# Or update manually weekly
apt update && apt upgrade -y
```

### 5. Monitor Server Health

Use the monitoring script:
```bash
./monitor-server.sh
```

### 6. Review Logs Regularly

```bash
# Check for failed login attempts
grep "Failed password" /var/log/auth.log

# Check fail2ban status
fail2ban-client status sshd

# Check system resources
htop
# or
watch -n 1 'ps aux --sort=-%cpu | head -10'
```

### 7. Set Up Log Rotation

Ensure logs don't fill disk:
```bash
# Check logrotate config
cat /etc/logrotate.conf

# Check disk space
df -h
```

### 8. Enable Automatic Security Updates

```bash
apt install unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

## 🚨 Security Checklist

- [ ] SSH keys set up and tested
- [ ] Password authentication disabled
- [ ] Root password changed
- [ ] Non-root user created (optional but recommended)
- [ ] System updated (`apt update && apt upgrade`)
- [ ] Automatic security updates enabled
- [ ] Firewall rules verified (`ufw status`)
- [ ] Fail2ban monitoring SSH (`fail2ban-client status sshd`)
- [ ] Application secrets rotated (MongoDB password, session secrets)
- [ ] Regular backups configured
- [ ] Monitoring script running

## 📊 Current Server Status

After cleanup:
- ✅ CPU: 4.5% (was 100%)
- ✅ RAM: 853MB used / 8GB total (was 6.5GB)
- ✅ Load average: 2.53 (was 6.25)
- ✅ Application: Running normally (0% CPU, 732MB RAM)
- ✅ Malware: Removed
- ✅ Firewall: Active
- ✅ Fail2ban: Active

## 🔍 Monitoring Commands

```bash
# Check CPU/memory usage
top
htop

# Check for suspicious processes
ps aux --sort=-%cpu | head -10

# Check network connections
netstat -tulpn | grep LISTEN

# Check disk usage
df -h

# Check system logs
journalctl -xe

# Monitor application
pm2 monit
pm2 logs rol-platform
```

## ⚠️ Warning Signs to Watch For

- CPU usage > 50% for extended periods
- RAM usage > 80%
- Unknown processes in top output
- Unexpected network connections
- Failed login attempts in auth.log
- Disk space filling up
- Application errors in PM2 logs

## 🆘 If Malware Returns

1. Immediately kill suspicious processes
2. Check systemd services: `systemctl list-units | grep suspicious`
3. Check cron jobs: `crontab -l` and `/etc/cron.d/`
4. Review auth logs: `grep "Accepted" /var/log/auth.log | tail -20`
5. Check for new files: `find /opt /root /tmp -type f -mtime -1`
6. Consider rebuilding server from scratch if heavily compromised

