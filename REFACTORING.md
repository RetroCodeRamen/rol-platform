# Code Refactoring: Decoupling & Clean Architecture

This document outlines the refactoring improvements made to decouple components and make the codebase more maintainable.

## Problems Identified

1. **Tight Coupling**: WindowManager had hardcoded switch statements - adding a new window type required modifying multiple files
2. **Code Duplication**: Each service reimplemented `fetchWithAuth` logic
3. **Monolithic Store**: All domain logic (mail, IM, buddies) mixed in one store
4. **Hardcoded Actions**: TopNavBar had hardcoded button handlers - adding buttons required modifying the component
5. **Mixed Responsibilities**: AOLShell handled auth, sound, websocket, mail checking, and window opening
6. **No Extension Points**: Adding features required modifying core components

## Solutions Implemented

### 1. Window Registry Pattern

**Before**: WindowManager had hardcoded switch statements
```typescript
switch (window.type) {
  case 'mail': return <MailboxView />;
  case 'im': return <IMWindow />;
  // ... adding new window = modifying this file
}
```

**After**: Window types registered in `src/lib/windows/registerWindows.ts`
```typescript
registerWindow('mail', {
  component: MailboxView,
  icon: '✉',
  defaultTitle: 'Mail',
  defaultSize: { width: 700, height: 500, x: 50, y: 50 },
});
```

**Benefits**:
- Adding a new window type: only modify `registerWindows.ts`
- WindowManager automatically picks up new registrations
- Window configuration (icon, size, behavior) centralized

### 2. Window Action Registry

**Before**: TopNavBar had hardcoded button handlers
```typescript
case 'read':
  sessionStorage.removeItem('mailViewMode');
  openWindow('mail', 'Mail');
  break;
```

**After**: Actions registered in `src/lib/windows/registerActions.ts`
```typescript
registerAction('read', {
  windowType: 'mail',
  title: 'Mail',
  handler: (openWindow) => {
    sessionStorage.removeItem('mailViewMode');
    openWindow('mail', 'Mail');
  },
});
```

**Benefits**:
- Adding a new button: only modify `registerActions.ts`
- TopNavBar doesn't need changes
- Button actions are testable in isolation

### 3. Shared HTTP Client

**Before**: Each service had duplicate `fetchWithAuth` logic
```typescript
// In MailService.ts
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  // ... error handling
}

// In ChatService.ts - same code duplicated
```

**After**: Centralized `HttpClient` in `src/lib/http/HttpClient.ts`
```typescript
import { httpClient } from '@/lib/http/HttpClient';

// In services:
const data = await httpClient.get('/api/mail/folders');
```

**Benefits**:
- Single source of truth for HTTP logic
- CSRF token handling centralized
- Error handling consistent across services
- Easy to add features (retry logic, request logging, etc.)

### 4. Shell Initialization Service

**Before**: AOLShell had 80+ lines of initialization logic mixed with component logic
```typescript
useEffect(() => {
  // Auth check
  // Sound initialization
  // WebSocket connection
  // Mail checking
  // Welcome window opening
  // ... all mixed together
}, []);
```

**After**: Extracted to `src/services/ShellInitializationService.ts`
```typescript
await shellInitService.initialize({
  user,
  onWelcomeWindowOpen: (title, options) => openWindow('welcome', title, options),
  onMailCheck: (unreadCount) => { /* ... */ },
});
```

**Benefits**:
- Initialization logic testable in isolation
- AOLShell component is cleaner
- Easy to modify startup behavior without touching component

## How to Add New Features

### Adding a New Window Type

1. Create your component (e.g., `src/components/NewWindow.tsx`)
2. Register it in `src/lib/windows/registerWindows.ts`:
```typescript
import NewWindow from '@/components/NewWindow';

registerWindow('newwindow', {
  component: NewWindow,
  icon: '🆕',
  defaultTitle: 'New Window',
  defaultSize: { width: 600, height: 400, x: 100, y: 100 },
});
```

That's it! WindowManager will automatically render it.

### Adding a New Button Action

1. Add button to `TOP_BAR_BUTTONS` in `TopNavBar.tsx` (just the UI)
2. Register action in `src/lib/windows/registerActions.ts`:
```typescript
registerAction('new-button', {
  windowType: 'newwindow',
  title: 'New Window',
  // Optional custom handler:
  handler: (openWindow, getWindowByType, bringToFront) => {
    // Custom logic here
    openWindow('newwindow', 'New Window');
  },
});
```

TopNavBar will automatically handle the click.

### Creating a New Service

Use the shared HttpClient:
```typescript
import { httpClient } from '@/lib/http/HttpClient';

export class MyService {
  async getData() {
    const data = await httpClient.get('/api/my-endpoint');
    return data;
  }
  
  async postData(body: any) {
    const data = await httpClient.post('/api/my-endpoint', body);
    return data;
  }
}
```

## Future Improvements

1. **Split Domain Stores**: Separate `mailStore`, `imStore`, `windowStore` instead of monolithic `useAppStore`
2. **Event Bus**: For cross-component communication (e.g., "mail received" event)
3. **Dependency Injection**: Replace singleton services with DI container
4. **Plugin System**: Allow window types and actions to be registered via plugins

## Files Changed

- `src/lib/windows/WindowRegistry.ts` - New: Window registry pattern
- `src/lib/windows/registerWindows.ts` - New: Window type registrations
- `src/lib/windows/WindowActions.ts` - New: Action registry pattern
- `src/lib/windows/registerActions.ts` - New: Button action registrations
- `src/lib/http/HttpClient.ts` - New: Shared HTTP client
- `src/services/ShellInitializationService.ts` - New: Extracted initialization logic
- `src/components/WindowManager.tsx` - Refactored: Uses registry
- `src/components/TopNavBar.tsx` - Refactored: Uses action registry
- `src/components/AOLShell.tsx` - Refactored: Uses initialization service
- `src/state/store.ts` - Refactored: Uses window registry for defaults

## Testing the Refactoring

The refactoring maintains backward compatibility. All existing functionality should work exactly as before, but now:

- ✅ Adding new window types doesn't break existing code
- ✅ Adding new buttons doesn't require modifying TopNavBar
- ✅ Services can be easily swapped or extended
- ✅ Initialization logic is testable
- ✅ Code is more maintainable and follows SOLID principles

