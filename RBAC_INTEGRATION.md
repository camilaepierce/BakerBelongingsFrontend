# Backend RBAC API Summary for Frontend Integration

This document summarizes the backend endpoints available for implementing Role-Based Access Control (RBAC) in the frontend.

## Authentication Flow

### 1. Login
**POST** `/api/Authorization/login`

**Request:**
```json
{
  "kerb": "camjohnson",
  "password": "testpassword123"
}
```

**Response:**
```json
{
  "success": true,
  "kerb": "camjohnson",
  "token": "abc123...",
  "userId": "user_camjohnson_1234567890"
}
```

**Note:** `userId` is included when a user profile exists. Use this to query roles.

### 2. Get User Identity & RBAC Data (Alternative)
**POST** `/api/Authorization/whoami`

**Request:**
```json
{
  "token": "abc123..."
}
```

**Response:**
```json
{
  "userId": "user_camjohnson_1234567890",
  "kerb": "camjohnson",
  "flags": ["Viewer"],
  "actions": []
}
```

**Use case:** One-shot RBAC initialization. Returns user identity + all permission flags and actions in a single call.

## Roles & Permissions Queries

### 3. Get User's Permission Flags
**POST** `/api/Roles/_getUserPermissions`

**Request:**
```json
{
  "user": "user_camjohnson_1234567890"
}
```

**Response:**
```json
[
  {
    "permissionFlags": ["Viewer"]
  }
]
```

### 4. List All Available Permission Flags
**POST** `/api/Roles/_listAllPermissionFlags`

**Request:**
```json
{}
```

**Response:**
```json
[
  {
    "id": "Admin",
    "name": "Admin",
    "actions": ["inventory.manage", "roles.manage", "reservation.checkout", "reservation.checkin"]
  },
  {
    "id": "DeskStaff",
    "name": "DeskStaff",
    "actions": ["reservation.checkout", "reservation.checkin"]
  },
  {
    "id": "Editor",
    "name": "Editor",
    "actions": ["inventory.manage"]
  },
  {
    "id": "Viewer",
    "name": "Viewer",
    "actions": []
  }
]
```

**Use case:** Fetch all available roles and their actions for client-side caching.

### 5. Get Actions for a Specific Permission Flag
**POST** `/api/Roles/_getPermissionFlagActions`

**Request:**
```json
{
  "permission": "Admin"
}
```

**Response:**
```json
[
  {
    "actions": ["inventory.manage", "roles.manage", "reservation.checkout", "reservation.checkin"]
  }
]
```

**Error Response:**
```json
{
  "error": "Permission Flag with ID 'xyz' not found."
}
```

### 6. Check if User Can Perform Action
**POST** `/api/Roles/allowAction`

**Request:**
```json
{
  "user": "user_camjohnson_1234567890",
  "action": "inventory.manage"
}
```

**Response:**
```json
{
  "allowed": false
}
```

## Recommended Frontend Implementation

### Option 1: Use `whoami` for initialization
```typescript
// After login, call whoami once
const { userId, kerb, flags, actions } = await whoami(token);

// Store in RBAC store
rbacStore.initialize({ userId, flags, actions });

// Check permissions client-side
if (rbacStore.can('inventory.manage')) {
  // Show protected UI
}
```

### Option 2: Use login + separate queries
```typescript
// Get userId from login
const { userId, token } = await login(kerb, password);

// Fetch all flags and cache
const allFlags = await listAllPermissionFlags();
rbacStore.cacheFlags(allFlags);

// Get user's flags
const { permissionFlags } = await getUserPermissions(userId);

// Build user's actions from cached flag data
const userActions = permissionFlags.flatMap(flagId => 
  allFlags.find(f => f.id === flagId)?.actions || []
);

rbacStore.initialize({ userId, flags: permissionFlags, actions: userActions });
```

## Reference Permission Flags (Dev Database)

When the server starts in development mode, these flags are auto-seeded:

- **Admin** → roles.manage, inventory.manage, reservation.checkout, reservation.checkin
- **DeskStaff** → reservation.checkout, reservation.checkin
- **Editor** → inventory.manage
- **Viewer** → (no actions)
- **Perm1, Perm2, ComplexPerm, Alpha, Beta** → Various test flags

## Dev Test Users

All users from `src/utils/users.csv` are seeded with:
- Password: `testpassword123`
- Role assignment:
  - `resident` → Viewer flag
  - `desk` → DeskStaff flag
  - `houseteam` → Admin flag

Example test users:
- `camjohnson` (resident) → Viewer
- `samdoer` (desk) → DeskStaff
- `zoeclark` (houseteam) → Admin

## Action Naming Convention

Actions follow the pattern: `<domain>.<operation>`

Examples:
- `inventory.manage` - Can create/edit inventory items
- `roles.manage` - Can promote/demote users
- `reservation.checkout` - Can checkout items
- `reservation.checkin` - Can checkin items
