# Security Implementation

This document outlines the comprehensive security measures implemented in the ROL Platform.

## Authentication & Authorization

### Password Security
- **Bcrypt Hashing**: Passwords are hashed using bcrypt with cost factor 12
- **Strong Password Requirements**:
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character
- **Constant-Time Comparison**: Password verification uses constant-time comparison to prevent timing attacks

### Account Lockout
- **Progressive Lockout**: After 5 failed login attempts, account is locked
- **Lockout Duration**: Starts at 15 minutes, increases with repeated failures
- **Automatic Reset**: Lockout expires automatically after the duration

### Session Management
- **HTTP-Only Cookies**: Session cookies are HTTP-only to prevent XSS attacks
- **Secure Cookies**: Cookies use `Secure` flag in production
- **SameSite Strict**: Cookies use `SameSite=Strict` to prevent CSRF
- **Session Tokens**: Additional session token for enhanced security
- **7-Day Expiration**: Sessions expire after 7 days of inactivity

## CSRF Protection

- **Double Submit Cookie Pattern**: CSRF tokens stored in both cookie and header
- **Token Validation**: All state-changing operations require valid CSRF token
- **Token Rotation**: New CSRF token generated for each request
- **Constant-Time Comparison**: Token comparison uses timing-safe comparison

## Rate Limiting

### Endpoint-Specific Limits
- **Authentication**: 5 attempts per 15 minutes
- **Registration**: 3 attempts per hour
- **Username Check**: 10 checks per minute
- **General API**: 60 requests per minute

### Implementation
- **IP-Based Tracking**: Uses Cloudflare's `CF-Connecting-IP` header when available
- **User-Agent Fingerprinting**: Additional fingerprinting for better tracking
- **Automatic Cleanup**: Old rate limit entries cleaned up periodically

## Input Validation & Sanitization

### Validation
- **Zod Schemas**: All inputs validated using Zod schemas
- **Type Safety**: Strong TypeScript typing throughout
- **Regex Validation**: Username, email, and password patterns validated

### Sanitization
- **HTML Escaping**: Removes potential HTML tags and scripts
- **Protocol Stripping**: Removes `javascript:` and other dangerous protocols
- **Event Handler Removal**: Strips event handlers from input
- **Trim & Lowercase**: Normalizes usernames and emails

## Security Headers

All responses include comprehensive security headers:

- **X-Content-Type-Options**: `nosniff` - Prevents MIME type sniffing
- **X-Frame-Options**: `DENY` - Prevents clickjacking
- **X-XSS-Protection**: `1; mode=block` - XSS protection
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **Permissions-Policy**: Restricts geolocation, microphone, camera
- **Content-Security-Policy**: Restricts resource loading
- **Strict-Transport-Security**: HSTS for HTTPS enforcement (production)

## Cloudflare Integration

### IP Detection
- **CF-Connecting-IP**: Primary source for client IP
- **X-Forwarded-For**: Fallback when Cloudflare header not available
- **X-Real-IP**: Additional fallback

### Security Features
- **DDoS Protection**: Cloudflare provides DDoS mitigation
- **WAF**: Web Application Firewall protection
- **SSL/TLS**: Automatic SSL termination
- **Bot Management**: Cloudflare bot detection

## Error Handling

### Information Disclosure Prevention
- **Generic Error Messages**: Don't reveal whether username exists
- **No Stack Traces**: Error details not exposed to clients
- **Logging**: Security events logged server-side only

### Error Codes
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (invalid credentials)
- **403**: Forbidden (CSRF failure)
- **423**: Locked (account lockout)
- **429**: Too Many Requests (rate limiting)
- **500**: Internal Server Error (generic server errors)

## Database Security

### MongoDB Security
- **Connection String**: Stored in environment variables
- **Indexes**: Unique indexes on username, email, screenName
- **Password Hashing**: Passwords never stored in plaintext
- **ObjectId Validation**: Proper ObjectId handling

## Best Practices

### Code Security
- **No Hardcoded Secrets**: All secrets in environment variables
- **Type Safety**: Full TypeScript coverage
- **Input Validation**: Validate at API boundary
- **Output Encoding**: Proper encoding for all outputs

### Operational Security
- **Environment Variables**: Sensitive data in `.env.local`
- **Logging**: Security events logged for monitoring
- **Monitoring**: Rate limit violations tracked
- **Updates**: Keep dependencies updated

## Production Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Configure `MONGODB_URI` with proper credentials
- [ ] Set `USE_SECURE_COOKIES=true`
- [ ] Review CSP headers (remove `unsafe-inline` if possible)
- [ ] Enable Cloudflare SSL/TLS
- [ ] Configure Cloudflare WAF rules
- [ ] Set up monitoring and alerting
- [ ] Review rate limit thresholds
- [ ] Test account lockout functionality
- [ ] Verify CSRF protection
- [ ] Test password requirements
- [ ] Review error messages
- [ ] Set up backup strategy for MongoDB

## Security Monitoring

### Logged Events
- Failed login attempts
- Account lockouts
- Rate limit violations
- Registration attempts
- CSRF token failures
- Authentication errors

### Metrics to Monitor
- Failed login rate
- Account lockout frequency
- Rate limit hits per endpoint
- Registration success rate
- Session creation/destruction

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:
1. Do not disclose publicly
2. Contact the development team
3. Provide detailed information
4. Allow time for fix before disclosure

