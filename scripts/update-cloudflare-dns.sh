#!/bin/bash
# Cloudflare DNS Update Script
# Automatically updates Cloudflare DNS A record to point to the server IP

set -e

# Configuration - Set these in environment variables or edit here
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
CLOUDFLARE_ZONE_ID="${CLOUDFLARE_ZONE_ID:-}"
DNS_RECORD_NAME="${DNS_RECORD_NAME:-rol.ramn.online}"  # Your domain/subdomain
SERVER_IP="${SERVER_IP:-10.0.0.220}"  # Your server IP

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔵 Cloudflare DNS Update Script"
echo "================================"

# Check if required variables are set
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo -e "${RED}❌ Error: CLOUDFLARE_API_TOKEN is not set${NC}"
    echo "Get your API token from: https://dash.cloudflare.com/profile/api-tokens"
    exit 1
fi

if [ -z "$CLOUDFLARE_ZONE_ID" ]; then
    echo -e "${RED}❌ Error: CLOUDFLARE_ZONE_ID is not set${NC}"
    echo "Find your Zone ID in Cloudflare Dashboard > Your Domain > Overview (right sidebar)"
    exit 1
fi

# Get current public IP (if server IP not specified)
if [ "$SERVER_IP" = "auto" ]; then
    echo "🌐 Detecting server public IP..."
    SERVER_IP=$(curl -s https://api.ipify.org || curl -s https://ifconfig.me || echo "10.0.0.220")
    echo "   Detected IP: $SERVER_IP"
fi

echo "📋 Configuration:"
echo "   Zone ID: $CLOUDFLARE_ZONE_ID"
echo "   Record: $DNS_RECORD_NAME"
echo "   Target IP: $SERVER_IP"
echo ""

# Get existing DNS record
echo "🔍 Checking existing DNS record..."
RECORD_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records?type=A&name=$DNS_RECORD_NAME" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json")

# Check if API call was successful
if echo "$RECORD_RESPONSE" | grep -q '"success":true'; then
    RECORD_ID=$(echo "$RECORD_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
    CURRENT_IP=$(echo "$RECORD_RESPONSE" | grep -o '"content":"[^"]*' | head -1 | cut -d'"' -f4)
    
    if [ -z "$RECORD_ID" ]; then
        echo -e "${YELLOW}⚠️  DNS record not found. Creating new record...${NC}"
        
        # Create new DNS record
        CREATE_RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "{\"type\":\"A\",\"name\":\"$DNS_RECORD_NAME\",\"content\":\"$SERVER_IP\",\"ttl\":300,\"proxied\":false}")
        
        if echo "$CREATE_RESPONSE" | grep -q '"success":true'; then
            echo -e "${GREEN}✅ DNS record created successfully!${NC}"
            echo "   $DNS_RECORD_NAME -> $SERVER_IP"
        else
            echo -e "${RED}❌ Failed to create DNS record${NC}"
            echo "$CREATE_RESPONSE" | grep -o '"message":"[^"]*' | head -1
            exit 1
        fi
    else
        if [ "$CURRENT_IP" = "$SERVER_IP" ]; then
            echo -e "${GREEN}✅ DNS record is already up to date${NC}"
            echo "   $DNS_RECORD_NAME -> $SERVER_IP"
        else
            echo -e "${YELLOW}🔄 Updating DNS record...${NC}"
            echo "   Current: $DNS_RECORD_NAME -> $CURRENT_IP"
            echo "   New:     $DNS_RECORD_NAME -> $SERVER_IP"
            
            # Update DNS record
            UPDATE_RESPONSE=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records/$RECORD_ID" \
                -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
                -H "Content-Type: application/json" \
                --data "{\"type\":\"A\",\"name\":\"$DNS_RECORD_NAME\",\"content\":\"$SERVER_IP\",\"ttl\":300,\"proxied\":false}")
            
            if echo "$UPDATE_RESPONSE" | grep -q '"success":true'; then
                echo -e "${GREEN}✅ DNS record updated successfully!${NC}"
            else
                echo -e "${RED}❌ Failed to update DNS record${NC}"
                echo "$UPDATE_RESPONSE" | grep -o '"message":"[^"]*' | head -1
                exit 1
            fi
        fi
    fi
else
    echo -e "${RED}❌ Failed to query Cloudflare API${NC}"
    echo "$RECORD_RESPONSE" | grep -o '"message":"[^"]*' | head -1
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 DNS update complete!${NC}"

