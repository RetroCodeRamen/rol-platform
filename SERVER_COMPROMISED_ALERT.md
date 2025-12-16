# 🚨 CRITICAL: SERVER COMPROMISED ALERT

**Date:** December 16, 2025  
**Severity:** CRITICAL  
**Status:** Server has been compromised with malware

## Malicious Processes Found

### 1. Cryptocurrency Miner (xmrig)
- **PID:** 94056
- **CPU:** 146.7%
- **RAM:** 2.3GB
- **Location:** `/var/www/rol-platform/build-new/xmrig`
- **Command:** `xmrig --url 178.218.144.107:3333 --user 98cd33c3-91b6-4b97-9183-98da92bb2802 --pass next --donate-level 0 --cpu-max-threads-hint=75`
- **Impact:** Consuming massive CPU resources

### 2. Suspicious "next" Process
- **PID:** 94041
- **CPU:** 206.7%
- **RAM:** 2.3GB
- **Location:** `/root/.local/share/next`
- **Impact:** Not our Next.js app - malicious process

### 3. Scanner/Malware (scanner.py)
- **PID:** 155
- **CPU:** 46.7%
- **RAM:** 1.4GB
- **Location:** `/usr/bin/python3 /opt/pcpcat/scanner.py`
- **Impact:** Likely scanning for vulnerabilities or spreading malware

### 4. Suspicious Proxy (gost)
- **PID:** 152
- **Location:** `/opt/pcpcat/gost -L socks5://:1080`
- **Impact:** Proxy server running on port 1080

## Our Application Status

- **PID:** 105901
- **CPU:** 0.0% (normal)
- **RAM:** 752MB (normal)
- **Status:** ✅ Application is running normally

**The high CPU/RAM usage is NOT from our application - it's from malware!**

## Immediate Actions Required

### 1. Kill Malicious Processes
```bash
kill -9 94041 94056 155
```

### 2. Remove Malicious Files
```bash
rm -rf /var/www/rol-platform/build-new/xmrig
rm -rf /root/.local/share/next
rm -rf /opt/pcpcat
```

### 3. Check for Backdoors
```bash
# Check for suspicious cron jobs
crontab -l
cat /etc/crontab
ls -la /etc/cron.d/
ls -la /etc/cron.hourly/
ls -la /etc/cron.daily/

# Check for suspicious systemd services
systemctl list-units | grep pcpcat
systemctl list-units | grep suspicious

# Check for SSH keys
cat ~/.ssh/authorized_keys
```

### 4. Check Network Connections
```bash
netstat -tulpn | grep -E '1080|3333'
ss -tulpn | grep -E '1080|3333'
```

### 5. Review Logs
```bash
# Check auth logs for unauthorized access
grep "Failed password" /var/log/auth.log
grep "Accepted" /var/log/auth.log | tail -20

# Check for suspicious activity
journalctl -u ssh | tail -50
```

### 6. Change All Passwords
- Root password
- SSH keys
- Database passwords
- Application secrets

### 7. Update System
```bash
apt update && apt upgrade -y
```

### 8. Install Security Tools
```bash
apt install fail2ban rkhunter chkrootkit -y
rkhunter --update
rkhunter --check
```

## How This Likely Happened

1. **Weak SSH credentials** - Password authentication enabled
2. **Exposed ports** - Ports accessible from internet
3. **Unpatched vulnerabilities** - System not updated
4. **Weak application security** - Possible code injection

## Prevention

1. **Disable password SSH** - Use key-based authentication only
2. **Firewall** - Only allow necessary ports
3. **Fail2ban** - Block brute force attempts
4. **Regular updates** - Keep system patched
5. **Monitor logs** - Set up log monitoring
6. **Backup regularly** - Have clean backups ready

## Next Steps

1. ✅ Kill malicious processes immediately
2. ✅ Remove malicious files
3. ✅ Check for backdoors
4. ✅ Review security logs
5. ✅ Change all credentials
6. ✅ Update system
7. ✅ Install security tools
8. ⚠️ Consider rebuilding server from scratch if heavily compromised

