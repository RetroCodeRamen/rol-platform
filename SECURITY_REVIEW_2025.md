# Security Review - January 2025

## Executive Summary

Overall security posture: **GOOD** with some areas for improvement. The application implements many security best practices including CSRF protection, input validation, rate limiting, and proper authentication. However, there are several vulnerabilities and improvements needed, particularly around MongoDB regex injection, WebSocket authentication, and some authorization checks.

## ✅ Security Strengths

### 1. Authentication & Authorization
- ✅ Proper session management with HTTP-only cookies
- ✅ CSRF protection using double-submit cookie pattern
- ✅ Account lockout after failed login attempts
- ✅ Password hashing with bcrypt (cost factor 12)
- ✅ Strong password requirements enforced
- ✅ Most API endpoints check authentication via `getUserIdFromSession()`

### 2. Input Validation & Sanitization
- ✅ Zod schemas for input validation
- ✅ String sanitization removes HTML tags, javascript: protocols, event handlers
- ✅ TypeScript typing throughout
- ✅ File upload validation (MIME type, extension, magic bytes)

### 3. Rate Limiting
- ✅ Rate limiting implemented for auth, registration, and general endpoints
- ✅ IP-based tracking with Cloudflare support
- ✅ User-agent fingerprinting

### 4. Security Headers
- ✅ Comprehensive security headers (CSP, XSS protection, etc.)
- ✅ HSTS for production
- ✅ Content-Type-Options: nosniff

### 5. File Upload Security
- ✅ File type whitelist
- ✅ MIME type validation via magic bytes
- ✅ Filename sanitization
- ✅ Path traversal protection
- ✅ File size limits

## ⚠️ Security Issues & Recommendations

### 🔴 CRITICAL: MongoDB Regex Injection (ReDoS)

**Location**: `src/app/api/mail/search/route.ts` (lines 48, 52-55)

**Issue**: User input is directly used in MongoDB `$regex` queries without escaping special regex characters. This can lead to ReDoS (Regular Expression Denial of Service) attacks.

```typescript
// VULNERABLE CODE:
searchFilter[searchField] = { $regex: query, $options: 'i' };
searchFilter.$or = [
  { subject: { $regex: query, $options: 'i' } },
  // ...
];
```

**Impact**: An attacker could craft a regex pattern that causes excessive CPU usage, potentially causing DoS.

**Fix**: Escape special regex characters before using in queries:

```typescript
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Then use:
searchFilter[searchField] = { $regex: escapeRegex(query), $options: 'i' };
```

**Also Affected**:
- `src/app/api/mail/send/route.ts` (line 108)
- `src/app/api/auth/register/route.ts` (line 96)

### 🟡 MEDIUM: WebSocket Authentication Weakness

**Location**: `src/lib/websocket/server.ts` (lines 34-44)

**Issue**: WebSocket authentication relies on `authToken` passed from client, which is just the userId. This could be manipulated by a malicious client.

**Current Code**:
```typescript
const authToken = socket.handshake.auth?.userId;
if (!authToken) {
  return next(new Error('Authentication required'));
}
const user = await User.findById(authToken);
```

**Recommendation**: 
1. Use session cookies instead of auth token
2. Implement proper session validation
3. Consider using JWT tokens with expiration

### 🟡 MEDIUM: CSRF Token Cookie Not HTTP-Only

**Location**: `src/lib/security/csrf.ts` (line 31)

**Issue**: CSRF token cookie has `httpOnly: false` to allow JavaScript access. While this is intentional for the double-submit pattern, it makes the token accessible to XSS attacks.

**Current Code**:
```typescript
httpOnly: false, // Must be readable by JavaScript for client-side requests
```

**Recommendation**: 
- This is acceptable for the double-submit cookie pattern, but ensure:
  1. XSS protection is strong (CSP headers)
  2. Token is rotated frequently
  3. Consider using SameSite=Strict when not in iframe context

### 🟡 MEDIUM: Rate Limiting Uses In-Memory Store

**Location**: `src/lib/security/rateLimit.ts`

**Issue**: Rate limiting uses an in-memory store, which won't work in a distributed/load-balanced environment.

**Recommendation**:
- Use Redis or similar distributed cache for production
- Consider using a library like `@upstash/ratelimit` or `rate-limiter-flexible`

### 🟡 MEDIUM: Missing Authorization Checks

**Location**: Several endpoints

**Issues**:
1. **Mail Filters**: Filter operations check authentication but don't verify the filter belongs to the user before update/delete (though MongoDB query includes `userId`, which is good)
2. **Mail Search**: Searches are scoped to `ownerUserId`, which is correct ✅
3. **Profile Updates**: Need to verify user can only update their own profile

**Recommendation**: Add explicit authorization checks where users can modify resources belonging to others.

### 🟢 LOW: Error Information Disclosure

**Location**: Various API endpoints

**Issue**: Some error messages might reveal too much information (e.g., "User not found" vs generic error).

**Current State**: Most endpoints use generic errors, which is good ✅

**Recommendation**: Continue using generic error messages in production.

### 🟢 LOW: Missing Input Length Limits

**Location**: Mail search, filter conditions

**Issue**: No explicit length limits on search queries or filter condition values.

**Recommendation**: Add reasonable limits:
- Search query: max 500 characters
- Filter condition value: max 200 characters
- Filter name: max 100 characters

### 🟢 LOW: CSP Allows Unsafe Inline Scripts

**Location**: `src/lib/security/headers.ts` (line 22)

**Issue**: CSP allows `'unsafe-inline'` and `'unsafe-eval'` for scripts.

**Current Code**:
```typescript
"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
```

**Recommendation**: 
- Use nonces or hashes for inline scripts
- Remove `'unsafe-eval'` if not needed
- This is acceptable for development but should be tightened for production

## 📋 Action Items

### Immediate (Critical)
1. ✅ **Fix MongoDB regex injection** - Escape special characters in regex queries
2. ✅ **Review WebSocket authentication** - Implement proper session-based auth

### Short-term (Medium Priority)
3. ✅ **Implement distributed rate limiting** - Use Redis for production
4. ✅ **Add input length limits** - Prevent DoS via large inputs
5. ✅ **Tighten CSP headers** - Remove unsafe-inline/unsafe-eval where possible

### Long-term (Low Priority)
6. ✅ **Add security monitoring** - Log security events (failed logins, CSRF failures)
7. ✅ **Implement request signing** - For critical operations
8. ✅ **Add virus scanning** - For file uploads
9. ✅ **Security audit logging** - Track all security-relevant events

## 🔍 Code Review Checklist

### Authentication
- [x] All state-changing endpoints require authentication
- [x] Session management is secure
- [x] Password hashing is strong (bcrypt)
- [x] Account lockout implemented
- [ ] WebSocket authentication needs improvement

### Authorization
- [x] Users can only access their own resources (mail, filters)
- [x] User ID is verified from session
- [ ] Some endpoints could add explicit authorization checks

### Input Validation
- [x] All inputs validated with Zod
- [x] String sanitization implemented
- [x] File upload validation comprehensive
- [ ] Need to add length limits
- [ ] Need to escape regex patterns

### CSRF Protection
- [x] CSRF tokens implemented
- [x] Double-submit cookie pattern
- [x] Constant-time comparison
- [x] Token validation on state-changing operations

### Rate Limiting
- [x] Rate limiting implemented
- [x] IP-based tracking
- [ ] Needs distributed store for production

### Security Headers
- [x] Comprehensive headers set
- [x] CSP configured
- [ ] CSP could be tighter (remove unsafe-inline)

### Error Handling
- [x] Generic error messages
- [x] No stack traces exposed
- [x] Proper HTTP status codes

## 📊 Security Score

**Overall Score: 7.5/10**

- Authentication: 8/10 (WebSocket needs work)
- Authorization: 8/10 (Mostly good, some gaps)
- Input Validation: 7/10 (Missing regex escaping, length limits)
- CSRF Protection: 9/10 (Well implemented)
- Rate Limiting: 7/10 (Needs distributed store)
- Security Headers: 8/10 (Could be tighter)
- File Upload: 9/10 (Very secure)

## 🎯 Recommendations Summary

1. **Fix regex injection** - High priority, easy fix
2. **Improve WebSocket auth** - Medium priority, moderate effort
3. **Add distributed rate limiting** - Medium priority, high effort
4. **Add input length limits** - Low priority, easy fix
5. **Tighten CSP** - Low priority, moderate effort

## 📝 Notes

- The application follows many security best practices
- Most critical issues are easy to fix
- The codebase is generally well-structured for security
- Consider implementing a security monitoring system
- Regular security audits recommended

