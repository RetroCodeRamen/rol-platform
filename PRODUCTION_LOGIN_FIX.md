# Production Login 401 Error - Fix Guide

## Problem
Getting "Login failed: 401" error in production, but login works in development.

## Root Causes
The 401 error can be caused by several production-specific issues:

1. **CSRF Token Cookie Not Being Set/Read**
   - Cookies with `secure: true` require HTTPS
   - If behind a reverse proxy without proper HTTPS termination, cookies won't be set
   - `sameSite: 'strict'` can block cookies in some proxy/redirect scenarios

2. **Cookie Configuration Issues**
   - Production environment may not have proper HTTPS setup
   - Reverse proxies may strip or modify cookie headers
   - Domain/subdomain mismatches

## Changes Made

### 1. Cookie Configuration Made Flexible
- Changed `sameSite` from `'strict'` to `'lax'` by default (configurable via env var)
- Added ability to disable `secure` flag via `USE_SECURE_COOKIES=false`
- All cookie settings now respect environment variables

### 2. Enhanced CSRF Debugging
- Added detailed logging when CSRF validation fails
- Logs cookie and header presence to help diagnose issues

### 3. Consistent Cookie Settings
- All auth-related routes now use the same cookie configuration
- Login, logout, and session management all use consistent settings

## Environment Variables

Add these to your production `.env` file:

### For Production Behind Proxy (HTTP, not HTTPS)
```bash
# Disable secure cookies if behind a proxy that doesn't terminate HTTPS
USE_SECURE_COOKIES=false

# Use 'lax' for better compatibility (default, but can be explicit)
COOKIE_SAME_SITE=lax
```

### For Production with HTTPS
```bash
# Enable secure cookies (default in production)
USE_SECURE_COOKIES=true

# Use 'lax' for better compatibility
COOKIE_SAME_SITE=lax
```

### For Maximum Security (HTTPS + Strict)
```bash
# Enable secure cookies
USE_SECURE_COOKIES=true

# Use 'strict' for maximum CSRF protection
COOKIE_SAME_SITE=strict
```

## Debugging Steps

1. **Check Server Logs**
   - Look for `[LOGIN-...]` log entries
   - Check for CSRF validation failures
   - Look for cookie setting confirmations

2. **Check Browser DevTools**
   - Open Network tab
   - Try to login
   - Check if cookies are being set in response headers
   - Check if CSRF token cookie exists before login request

3. **Verify Environment Variables**
   - Ensure `NODE_ENV=production` is set
   - Check if `USE_SECURE_COOKIES` is set correctly
   - Verify `COOKIE_SAME_SITE` if you set it explicitly

4. **Test CSRF Token Endpoint**
   ```bash
   curl -v https://your-domain.com/api/auth/csrf-token
   ```
   - Should return a token
   - Check if `rol_csrf_token` cookie is set in response

5. **Check Reverse Proxy Configuration**
   - If using nginx/apache, ensure cookies are passed through
   - Check if `X-Forwarded-Proto` header is set correctly
   - Verify proxy doesn't strip cookie headers

## Common Scenarios

### Scenario 1: Behind Nginx Reverse Proxy (HTTP internally, HTTPS externally)
```bash
# .env
USE_SECURE_COOKIES=false
COOKIE_SAME_SITE=lax
```

### Scenario 2: Direct HTTPS (no proxy)
```bash
# .env
USE_SECURE_COOKIES=true
COOKIE_SAME_SITE=lax
```

### Scenario 3: Cloudflare or Similar CDN
```bash
# .env
USE_SECURE_COOKIES=true
COOKIE_SAME_SITE=lax
# Cloudflare handles HTTPS termination
```

## Testing

After setting environment variables:

1. Restart your production server
2. Clear browser cookies for your domain
3. Try logging in again
4. Check server logs for detailed error messages

## Additional Notes

- The 401 error specifically means "Unauthorized" - credentials failed validation
- If you see 403 instead, that's CSRF validation failure
- Check database connection if credentials are definitely correct
- Verify user exists and password hash is correct in database

