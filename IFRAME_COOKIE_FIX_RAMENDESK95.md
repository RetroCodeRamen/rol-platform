# Iframe Cookie Handling Fix for RamenDesk95

## Problem Summary

The ROL Platform (aol-platform) is being embedded in an iframe on `retrocodera.men` (RamenDesk95), but login is failing because cookies are not being properly handled in the cross-origin iframe context.

## Root Cause

When embedding a cross-origin application in an iframe, modern browsers require specific permissions and cookie settings for cookies to work:

1. **Missing `allow` attribute**: The iframe needs explicit permission for cookies
2. **Third-party cookie restrictions**: Browsers block third-party cookies by default unless properly configured
3. **Storage Access API**: Some browsers require explicit storage access requests

## Required Changes to RamenDesk95

### File: `components/apps/IframeApp.tsx`

**Current Code (Line 59-66):**
```tsx
<iframe
  ref={iframeRef}
  src={url}
  className="flex-1 w-full border-0"
  title={title}
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
  onLoad={handleIframeLoad}
/>
```

**Required Changes:**

1. **Add `allow` attribute** for cookie permissions:
```tsx
<iframe
  ref={iframeRef}
  src={url}
  className="flex-1 w-full border-0"
  title={title}
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-storage-access-by-user-activation"
  allow="cookies; storage-access"
  onLoad={handleIframeLoad}
/>
```

**Explanation:**
- `allow="cookies; storage-access"` - Explicitly allows cookies and storage access API
- `allow-storage-access-by-user-activation` in sandbox - Allows the iframe to request storage access (required for third-party cookies in Safari and some other browsers)

### File: `next.config.js`

**Current Code (Lines 7-31):**
```js
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'SAMEORIGIN',
        },
        // ... other headers
      ],
    },
  ];
},
```

**Required Changes:**

The `X-Frame-Options: SAMEORIGIN` header will block cross-origin iframes. Since RamenDesk95 needs to embed external apps (like ROL Platform), this should be removed or made conditional.

**Option 1: Remove X-Frame-Options (Recommended)**
```js
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        // Remove X-Frame-Options - let CSP handle it instead
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        // Add Content-Security-Policy to allow iframe embedding
        {
          key: 'Content-Security-Policy',
          value: "frame-ancestors 'self' https://retrocodera.men https://*.retrocodera.men;",
        },
      ],
    },
  ];
},
```

**Option 2: Make it conditional (More Secure)**
```js
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'Content-Security-Policy',
          value: "frame-ancestors 'self' https://retrocodera.men https://*.retrocodera.men;",
        },
      ],
    },
  ];
},
```

**Note:** `X-Frame-Options` is deprecated in favor of CSP `frame-ancestors`. Using CSP is more flexible and modern.

## Additional Considerations

### 1. HTTPS Requirement

For `SameSite=None` cookies (which ROL Platform uses in iframe mode), **HTTPS is required**. Ensure:
- RamenDesk95 is served over HTTPS (`https://retrocodera.men`)
- ROL Platform is served over HTTPS (or behind a proxy that provides HTTPS)

### 2. Browser Compatibility

Some browsers (especially Safari) have strict third-party cookie policies:
- **Safari**: Requires Storage Access API and user interaction
- **Chrome**: Blocks third-party cookies by default (can be enabled in settings)
- **Firefox**: Blocks third-party cookies by default

The ROL Platform automatically detects iframe context and uses `SameSite=None; Secure` cookies, which should work once the iframe permissions are correct.

### 3. Testing

After making these changes, test:
1. Open RamenDesk95 in a browser
2. Launch the ROL Platform app (Ramn Online)
3. Try to log in
4. Check browser console for any cookie-related errors
5. Check Network tab to verify cookies are being sent with requests

### 4. Debugging

If login still fails after these changes:

1. **Check Browser Console:**
   - Look for cookie-related errors
   - Check if `X-Iframe-Context: true` header is being sent (ROL Platform logs this)

2. **Check Network Tab:**
   - Verify cookies are in request headers
   - Check if `Set-Cookie` headers are in responses
   - Look for CORS errors

3. **Check Browser Settings:**
   - Ensure third-party cookies are not blocked
   - In Chrome: Settings → Privacy and security → Cookies and other site data → Allow all cookies (for testing)

## Summary of Changes

1. ✅ Add `allow="cookies; storage-access"` to iframe element
2. ✅ Add `allow-storage-access-by-user-activation` to sandbox attribute
3. ✅ Remove or update `X-Frame-Options` header in `next.config.js`
4. ✅ Add CSP `frame-ancestors` header to allow embedding

## Files to Modify

1. `components/apps/IframeApp.tsx` - Update iframe element
2. `next.config.js` - Update security headers

## Questions?

If you encounter issues after implementing these changes, check:
- Browser console for errors
- Network tab for cookie headers
- ROL Platform server logs for iframe detection

The ROL Platform has been updated to automatically detect iframe context and use appropriate cookie settings (`SameSite=None; Secure`), so once the iframe permissions are correct, login should work.

