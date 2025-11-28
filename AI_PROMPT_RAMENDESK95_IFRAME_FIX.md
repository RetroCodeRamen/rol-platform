# AI Prompt: Fix Iframe Cookie Handling in RamenDesk95

## Context
RamenDesk95 embeds external applications (like ROL Platform at `https://ramn.online`) in iframes. These embedded apps need to set and read cookies for authentication, but currently cookies are being blocked due to missing iframe permissions.

**Important:** This is for RamenDesk95 as a standalone desktop application, NOT for use within the Noodlescape browser component.

## Task
Fix cookie handling in iframe-embedded applications by updating the iframe element permissions and security headers.

## Required Changes

### 1. Update `components/apps/IframeApp.tsx`

**Current iframe element (around line 59-66):**
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

**Change to:**
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

**What changed:**
- Added `allow-storage-access-by-user-activation` to the `sandbox` attribute
- Added `allow="cookies; storage-access"` attribute

**Why:**
- `allow="cookies; storage-access"` explicitly grants cookie permissions to the iframe
- `allow-storage-access-by-user-activation` enables the Storage Access API, which is required for third-party cookies in modern browsers (especially Safari)

### 2. Update `next.config.js`

**Current headers configuration (around lines 7-31):**
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
          key: 'X-Frame-Options',
          value: 'SAMEORIGIN',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
      ],
    },
  ];
},
```

**Change to:**
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
        // Removed X-Frame-Options - using CSP frame-ancestors instead
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

**What changed:**
- Removed `X-Frame-Options: SAMEORIGIN` header (it blocks cross-origin iframes)
- Added `Content-Security-Policy` with `frame-ancestors` directive

**Why:**
- `X-Frame-Options: SAMEORIGIN` prevents RamenDesk95 from embedding external apps in iframes
- CSP `frame-ancestors` is the modern replacement and allows more granular control
- The CSP allows embedding from `retrocodera.men` and its subdomains

## Testing Instructions

After making these changes:

1. **Build and run the application:**
   ```bash
   npm run build
   npm start
   ```

2. **Test with ROL Platform:**
   - Open RamenDesk95
   - Launch "Ramn Online" app (which embeds `https://ramn.online`)
   - Try to log in to the ROL Platform
   - Login should now work

3. **Verify in browser DevTools:**
   - Open DevTools → Network tab
   - Look for login requests
   - Check that cookies are being sent in request headers
   - Check that `Set-Cookie` headers are present in responses

4. **Check console for errors:**
   - Open DevTools → Console
   - Look for any cookie-related errors
   - Should see no errors related to cookies being blocked

## Expected Behavior

- ✅ Embedded applications (like ROL Platform) can set cookies
- ✅ Embedded applications can read cookies
- ✅ Login/authentication works in iframe-embedded apps
- ✅ No console errors about cookies being blocked

## Notes

- These changes only affect iframe-embedded external applications
- Internal RamenDesk95 apps are not affected
- The Noodlescape browser component is separate and not affected by these changes
- HTTPS is required for `SameSite=None` cookies (which embedded apps use)

## Files to Modify

1. `components/apps/IframeApp.tsx` - Add cookie permissions to iframe
2. `next.config.js` - Update security headers to allow cross-origin iframes

## Implementation Checklist

- [ ] Update `IframeApp.tsx` iframe element with `allow` attribute and updated `sandbox`
- [ ] Update `next.config.js` to remove `X-Frame-Options` and add CSP `frame-ancestors`
- [ ] Test login in embedded ROL Platform
- [ ] Verify cookies are working in browser DevTools
- [ ] Confirm no console errors

