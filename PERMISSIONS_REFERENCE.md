# Permissions Reference

This document lists all permission flags (and legacy actions for reference) used by the BakerBelongingsFrontend system, where they are defined, and how they are enforced in the UI.

## Permission Flags

These are the base permission flags that users can be assigned. Frontend enforcement is flag-based only.

| Flag Name   | Flag ID     | Source      | Notes                       |
| ----------- | ----------- | ----------- | --------------------------- |
| Admin       | Admin       | Backend API | Full administrative access  |
| DeskStaff   | DeskStaff   | Backend API | Desk staff operations       |
| Editor      | Editor      | Backend API | Content editing permissions |
| Viewer      | Viewer      | Backend API | View-only permissions       |
| Perm1       | Perm1       | Backend API | Custom permission 1         |
| Perm2       | Perm2       | Backend API | Custom permission 2         |
| ComplexPerm | ComplexPerm | Backend API | Complex permission set      |
| Alpha       | Alpha       | Backend API | Alpha test permission       |
| Beta        | Beta        | Backend API | Beta test permission        |

**Source Files:**

- Flags are fetched from: `POST /Roles/_listAllPermissionFlags`
- Flags are managed in: `src/stores/rbac.ts` (ensureFlagsCatalog method)
- Flags are displayed in: `src/views/PermissionsAdminView.vue`
- Admin initialization promotes to all flags in: `src/lib/initAdmin.ts`

## Actions (reference only)

The backend may expose actions (derived from flags), but the frontend no longer enforces actions. All route and component checks use flags only. You may still see actions in API responses or documentation; they are not used for client-side authorization.

## Usage Patterns

### Route-Level Protection (flags only)

Routes use `requireFlags` in their meta configuration. Action-based checks (`requireActions`) are not used.

**File:** `src/router/index.ts`

```typescript
{
  path: '/management',
  meta: {
    requiresAuth: true,
    requireFlags: ['Editor', 'Admin'],
  }
}

{
  path: '/admin/permissions',
  meta: {
    requiresAuth: true,
    requireFlags: ['Admin'],
  }
}
```

### Component-Level Protection (flag directives)

Components use flag-based directives to hide or disable UI elements:

**File:** `src/components/InventoryManagementTable.vue`

```vue
<button v-has-any-flag.disable="['Admin', 'DeskStaff']">Checkout</button>
<button v-has-any-flag.disable="['Admin', 'DeskStaff']">Checkin</button>
```

**Directive Modifiers:**

- No modifier: Element is hidden if user lacks permission
- `.disable` modifier: Element is shown but disabled if user lacks permission

### Permission Flags Directives

Components can check single flags with `v-has-flag` or OR across multiple flags with `v-has-any-flag`:

**File:** `src/main.ts` (directive definition)

```vue
<div v-has-flag="'Admin'">
  Admin-only content
</div>

<button v-has-flag.disable="'Editor'">
  Edit
</button>
```

## API Endpoints

### Authorization Endpoints

**File:** Various components and stores

- `POST /Authorization/register` - Register new user
- `POST /Authorization/login` - Login user
- `POST /Authorization/logout` - Logout user
- `POST /Authorization/validateToken` - Validate session token

### Role Management Endpoints

**File:** `src/lib/admin.ts`, `src/stores/rbac.ts`

- `POST /Roles/_getUserPermissions` - Get user's permission flags
  - Body: `{ user: userId }`
  - Returns: Array of `{ permissionFlags: string[] }`
- `POST /Roles/_listAllPermissionFlags` - Get all available flags
  - Body: `{}`
  - Returns: Array of `{ id: string, name: string, description?: string }`
- `POST /Roles/promoteUser` - Grant a flag to user
  - Body: `{ user: userId, flagId: string }`
- `POST /Roles/demoteUser` - Remove a flag from user
  - Body: `{ user: userId, flagId: string }`
    // Note: Client no longer calls action-related endpoints for authorization.

### Viewer Endpoints

**File:** `src/components/InventoryTable.vue`, `src/components/InventoryManagementTable.vue`

- `POST /Viewer/viewAvailable` - View available items
- `POST /Viewer/viewCheckedOut` - View checked out items
- `POST /Viewer/viewExpired` - View expired items
- `POST /Viewer/viewItem` - View specific item
- `POST /Viewer/viewCategory` - View items by category
- `POST /Viewer/viewTag` - View items by tag
- `POST /Viewer/viewAdjacent` - View adjacent/similar items
- `POST /Viewer/viewAutocomplete` - AI autocomplete suggestions
- `POST /Viewer/recommendItems` - AI recommendations
- `POST /Viewer/loadItems` - Load/reload inventory data
- `POST /Viewer/saveItems` - Save inventory data

### Reservation Endpoints

**File:** `src/components/InventoryManagementTable.vue`, `src/components/EmailNotification.vue`

- `POST /Reservation/checkoutItem` - Checkout an item
- `POST /Reservation/checkinItem` - Checkin an item
- `POST /Reservation/notifyCheckout` - Send checkout notification

## State Management

### Session Store

**File:** `src/stores/session.ts`

Manages user authentication state:

- `kerb` - User's Kerberos ID
- `token` - Session token (Bearer)
- `userId` - User's unique ID
- `expiresAt` - Token expiration timestamp

### RBAC Store

**File:** `src/stores/rbac.ts`

Manages user permissions (flag-first):

- `permissionFlags` - Array of flag IDs user has
- `flagsCatalog` - Map of all available flags (with optional actions for reference)

**Key Methods:**

- `hasFlag(flagId)` - Check if user has flag
- `loadForUser(userId)` / `loadViaWhoami()` - Load permissions for user
- `ensureFlagsCatalog()` - Load flag catalog if needed

## Admin Initialization

### Creating Admin Users

**Files:** `src/lib/initAdmin.ts`, `src/views/DevToolsView.vue`

The system includes utilities to create admin users with all permissions:

1. **Via Dev Tools UI** (`/dev` route):
   - Fill in credentials or use defaults
   - Click "Quick Init (Default Admin)"
   - Automatically promoted to all 9 flags

2. **Programmatically:**

   ```typescript
   import { initializeAdminUser, createDefaultAdmin } from './lib/initAdmin'

   // Custom admin
   await initializeAdminUser({
     kerb: 'myadmin',
     email: 'myadmin@test.com',
     first: 'My',
     last: 'Admin',
     password: 'secure123',
   })

   // Default admin (kerb: admin, password: admin123)
   await createDefaultAdmin()
   ```

**Process:**

1. Register user via `/Authorization/register`
2. Login to get session token
3. Fetch all available permission flags
4. Promote user to each flag via `/Roles/promoteUser`

## Permission Checking Flow

### Route Navigation

1. User navigates to protected route
2. Router guard (`beforeEach`) checks `requiresAuth`
3. If authenticated, validates token
4. Loads RBAC if not already loaded
5. Checks `requireFlags` only
6. Allows or denies navigation

### Component Rendering

1. Component uses `v-has-flag` or `v-has-any-flag` directive
2. Directive checks RBAC store
3. If permission missing:
   - Default: Element hidden (`display: none`)
   - `.disable` modifier: Element shown but disabled

### Programmatic Checks (flags)

```typescript
import { useRbacStore } from '@/stores/rbac'

const rbac = useRbacStore()

if (rbac.hasFlag('Admin')) {
  // Admin-only logic
}
```

## Adding New Permissions

### Adding a New Action (backend-only)

Actions can be added on the backend and associated with flags, but the frontend does not enforce actions. Prefer checking flags in routes (`requireFlags`) and components (`v-has-flag`, `v-has-any-flag`).

### Adding a New Flag

1. **Backend:** Create flag in roles system
2. **Backend:** Associate actions with flag
3. **Frontend:** No code changes needed - flags are dynamically loaded
4. **Admin:** Assign flag to users via `/admin/permissions` UI

## Security Considerations

1. **Token Storage:** Tokens stored in sessionStorage (cleared on tab close)
2. **Token Validation:** Periodic validation every 15 minutes
3. **401 Handling:** Automatic logout on unauthorized responses
4. **Route Guards:** Prevent navigation to protected routes
5. **Component Guards:** Hide/disable unauthorized UI elements
6. **RBAC Loading:** Lazy-loaded on first protected route access
7. **Cross-tab Sync:** Storage events sync logout across tabs

## Development vs Production

**Development Tools:**

- `/dev` route for admin initialization
- Should be **removed or restricted** in production
- Debug logging should be disabled in production

**Production Checklist:**

- [ ] Remove or restrict `/dev` route
- [ ] Disable console.log debug statements
- [ ] Use secure token storage (consider httpOnly cookies)
- [ ] Implement CSRF protection
- [ ] Use HTTPS only
- [ ] Set appropriate CORS policies
- [ ] Implement rate limiting
- [ ] Add audit logging for permission changes
