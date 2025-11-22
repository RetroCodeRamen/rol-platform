# Cloudflare DNS Automatic Update Setup

This guide will help you set up automatic DNS updates for your ROL Platform server.

## 📋 Prerequisites

1. A Cloudflare account with your domain
2. Cloudflare API Token with DNS edit permissions

## 🔑 Step 1: Get Cloudflare API Token

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Use **"Edit zone DNS"** template, or create custom token with:
   - **Permissions:**
     - Zone → DNS → Edit
   - **Zone Resources:**
     - Include → Specific zone → Select your domain
4. Click **"Continue to summary"** → **"Create Token"**
5. **Copy the token** (you won't see it again!)

## 🌐 Step 2: Get Your Zone ID

1. Go to: https://dash.cloudflare.com/
2. Select your domain
3. In the right sidebar under **"API"**, you'll see **"Zone ID"**
4. Copy the Zone ID

## ⚙️ Step 3: Configure on Server

SSH into your server and set up the environment variables:

```bash
ssh root@10.0.0.220

# Create environment file
cat > /var/www/rol-platform/.env.cloudflare << EOF
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ZONE_ID=your_zone_id_here
DNS_RECORD_NAME=rol.ramn.online
SERVER_IP=10.0.0.220
EOF

# Make script executable
chmod +x /var/www/rol-platform/scripts/update-cloudflare-dns.sh
```

## 🚀 Step 4: Run the Update Script

### Option A: Manual Update
```bash
cd /var/www/rol-platform
source .env.cloudflare
./scripts/update-cloudflare-dns.sh
```

### Option B: Automatic Updates (Cron Job)

Set up a cron job to update DNS periodically (useful if your server IP changes):

```bash
# Edit crontab
crontab -e

# Add this line to update DNS every hour
0 * * * * cd /var/www/rol-platform && source .env.cloudflare && ./scripts/update-cloudflare-dns.sh >> /var/log/cloudflare-dns.log 2>&1

# Or update on server startup
@reboot cd /var/www/rol-platform && source .env.cloudflare && ./scripts/update-cloudflare-dns.sh
```

### Option C: Update on Deployment

Add to your deployment script to update DNS after each deploy:

```bash
# In deploy.sh, add after PM2 restart:
source .env.cloudflare 2>/dev/null || true
./scripts/update-cloudflare-dns.sh || echo "DNS update skipped"
```

## 🔍 Step 5: Verify

1. Run the script manually to test:
   ```bash
   cd /var/www/rol-platform
   source .env.cloudflare
   ./scripts/update-cloudflare-dns.sh
   ```

2. Check Cloudflare Dashboard:
   - Go to DNS → Records
   - Verify your A record points to `10.0.0.220`

3. Test DNS resolution:
   ```bash
   nslookup rol.ramn.online
   # Should return: 10.0.0.220
   ```

## 🔒 Security Notes

- **Never commit** `.env.cloudflare` to git (it's already in .gitignore)
- The API token has limited permissions (DNS edit only for your zone)
- Consider using Cloudflare's **API Keys** instead if you prefer (less secure)

## 🛠️ Troubleshooting

### "Invalid API Token"
- Verify token has correct permissions
- Check token hasn't expired
- Ensure Zone ID matches your domain

### "Record not found"
- Script will automatically create the record
- Or create it manually in Cloudflare Dashboard first

### "Permission denied"
- Check API token has "DNS Edit" permission
- Verify Zone ID is correct

## 📝 Example Usage

```bash
# Update DNS to point to server
export CLOUDFLARE_API_TOKEN="your_token"
export CLOUDFLARE_ZONE_ID="your_zone_id"
export DNS_RECORD_NAME="rol.ramn.online"
export SERVER_IP="10.0.0.220"

./scripts/update-cloudflare-dns.sh
```

## 🔄 Dynamic IP Support

If your server IP changes, set `SERVER_IP=auto` and the script will detect it automatically:

```bash
export SERVER_IP="auto"  # Auto-detect public IP
```

Or use a service like `ddclient` or `cloudflare-ddns` for more advanced dynamic DNS.

