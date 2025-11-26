# Security Action Plan
**Priority Order for Implementation**

## 🚨 IMMEDIATE (Do Today)

### 1. Improve Server Credentials Security (Optional)
**Time:** 10-15 minutes  
**Files:** `serverCred.cfg`

**Current Status:**
- ✅ File is in `.gitignore` (properly excluded)
- ✅ Used for local development (Cursor access)
- ⚠️ Contains plaintext password

**Recommended Improvements:**

**Option A: Use SSH Keys (Recommended)**
```bash
# Generate SSH key
ssh-keygen -t ed25519

# Copy to server
ssh-copy-id root@10.0.0.220

# Update Cursor configuration to use SSH key
# Then password can be removed from serverCred.cfg
```

**Option B: Verify Git Protection**
```bash
# Test git ignore
git status  # Should not show serverCred.cfg

# If needed, force ignore
git update-index --assume-unchanged serverCred.cfg
```

**Note:** Since file is properly gitignored and for local dev only, this is optional but recommended for better security.

---

### 2. Fix File Upload Security
**Time:** 2-3 hours  
**Files:** `src/app/api/im/upload/route.ts`

**Required Changes:**
1. Install file type detection library
2. Add MIME type whitelist
3. Validate file types server-side
4. Sanitize filenames
5. Add path traversal protection
6. Add rate limiting

**Dependencies to Add:**
```bash
npm install file-type
npm install --save-dev @types/file-type
```

---

## 🔴 CRITICAL (This Week)

### 3. Strengthen Content Security Policy
**Time:** 4-6 hours  
**Files:** `src/middleware.ts`, `src/lib/security/headers.ts`

**Changes:**
- Remove `'unsafe-inline'` and `'unsafe-eval'`
- Implement CSP nonces
- Test all functionality

---

### 4. Fix Logging Security
**Time:** 3-4 hours  
**Files:** Multiple API routes

**Changes:**
- Install logging framework (Winston or Pino)
- Remove sensitive data from logs
- Implement log levels
- Configure production logging

**Dependencies:**
```bash
npm install winston
# or
npm install pino pino-pretty
```

---

### 5. Improve Socket.IO Authentication
**Time:** 2-3 hours  
**Files:** `src/lib/websocket/server.ts`

**Changes:**
- Parse session cookies properly
- Validate session tokens
- Verify user session in database

---

### 6. Add Security Headers to File Downloads
**Time:** 30 minutes  
**Files:** `src/app/api/im/attachment/[id]/route.ts`

**Changes:**
- Use `addSecurityHeaders()` helper
- Validate MIME type before serving

---

## 🟡 HIGH PRIORITY (Before Launch)

### 7. Implement Distributed Rate Limiting
**Time:** 4-6 hours  
**Files:** `src/lib/security/rateLimit.ts`

**Options:**
- Use Redis (recommended)
- Use database-backed rate limiting
- Use Cloudflare rate limiting (already using Cloudflare)

**If using Redis:**
```bash
npm install ioredis
npm install --save-dev @types/ioredis
```

---

### 8. Add Session Token Validation
**Time:** 3-4 hours  
**Files:** `src/lib/auth.ts`, `src/lib/db/models/`

**Changes:**
- Create Session model
- Store tokens in database
- Validate on each request
- Implement session invalidation

---

### 9. Fix Account Lockout Persistence
**Time:** 2-3 hours  
**Files:** `src/lib/security/accountLockout.ts`

**Changes:**
- Store lockout in database
- Or use Redis for distributed lockout

---

### 10. Add Path Validation
**Time:** 1 hour  
**Files:** `src/app/api/im/attachment/[id]/route.ts`

**Changes:**
- Validate file paths
- Normalize paths
- Check for traversal

---

### 11. Verify CSRF on All Endpoints
**Time:** 2-3 hours  
**Files:** All API routes

**Changes:**
- Audit all POST/PUT/DELETE endpoints
- Add CSRF where missing
- Test CSRF protection

---

### 12. Add Upload Rate Limiting
**Time:** 1 hour  
**Files:** `src/app/api/im/upload/route.ts`

**Changes:**
- Add rate limiting
- Set per-user limits

---

## 📋 Implementation Checklist

### Week 1: Critical Fixes
- [ ] Day 1: Remove credentials, fix file uploads
- [ ] Day 2-3: Strengthen CSP, fix logging
- [ ] Day 4: Fix Socket.IO auth, file download headers
- [ ] Day 5: Testing and verification

### Week 2: High Priority
- [ ] Day 1-2: Distributed rate limiting
- [ ] Day 3: Session token validation
- [ ] Day 4: Account lockout persistence
- [ ] Day 5: Path validation, CSRF audit

### Week 3: Testing & Hardening
- [ ] Security testing
- [ ] Penetration testing (if budget allows)
- [ ] Dependency scanning
- [ ] Final review

---

## Testing Plan

### Unit Tests
- [ ] File upload validation tests
- [ ] CSRF token validation tests
- [ ] Rate limiting tests
- [ ] Session validation tests

### Integration Tests
- [ ] Authentication flow tests
- [ ] File upload/download tests
- [ ] WebSocket authentication tests

### Security Tests
- [ ] File upload attack tests
- [ ] CSRF attack tests
- [ ] XSS tests
- [ ] SQL injection tests (if applicable)
- [ ] Path traversal tests

---

## Deployment Checklist

Before deploying to production:

- [ ] All critical issues fixed
- [ ] All high priority issues fixed
- [ ] Security testing completed
- [ ] Environment variables configured
- [ ] Logging configured
- [ ] Monitoring set up
- [ ] Incident response plan ready
- [ ] Backup strategy in place
- [ ] SSL/TLS configured
- [ ] Security headers verified

---

## Payment Integration Security

Before adding PayU:

- [ ] All security fixes completed
- [ ] HTTPS enforced
- [ ] Payment endpoints secured
- [ ] Webhook signature verification
- [ ] Idempotency implemented
- [ ] Fraud monitoring set up
- [ ] PCI DSS compliance verified
- [ ] Payment logging implemented

---

## Estimated Timeline

- **Critical Fixes:** 1 week
- **High Priority:** 1 week
- **Testing & Hardening:** 1 week
- **Total:** 3 weeks to production-ready

---

## Resources Needed

### Tools
- File type detection library
- Logging framework
- Redis (for distributed rate limiting)
- Security testing tools

### Budget
- Security tools: $500-$2,000/year
- Penetration testing: $5,000-$15,000 (one-time)
- Security monitoring: $200-$1,000/month

### Team
- 1-2 developers for implementation
- Security review before launch
- Optional: Professional penetration tester

---

## Success Criteria

The application is ready for public launch when:

1. ✅ All critical issues resolved
2. ✅ All high priority issues resolved
3. ✅ Security testing passed
4. ✅ No hardcoded credentials
5. ✅ File uploads secured
6. ✅ CSP strengthened
7. ✅ Logging secured
8. ✅ Rate limiting distributed
9. ✅ Session management secure
10. ✅ Monitoring in place

---

**Last Updated:** 2024  
**Status:** In Progress

