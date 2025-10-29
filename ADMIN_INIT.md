# Admin Initialization Guide

## Development Admin User

This project includes development tools to initialize an admin user with full permissions for testing.

### Using the Dev Tools UI

1. Navigate to `/dev` in your browser
2. Fill in the admin user details (default values provided):
   - Kerb: `admin`
   - Email: `admin@test.com`
   - First Name: `Admin`
   - Last Name: `User`
   - Password: `admin123`
3. Click "Initialize Admin User" or "Quick Init (Default Admin)"
4. The tool will:
   - Register the user
   - Login to get userId
   - Fetch all permission flags
   - Promote the user to all flags

### Using the API Directly

You can also initialize an admin user programmatically:

```typescript
import { initializeAdminUser, createDefaultAdmin } from './lib/initAdmin'

// Create a custom admin
await initializeAdminUser({
  kerb: 'myadmin',
  email: 'myadmin@test.com',
  first: 'My',
  last: 'Admin',
  password: 'mypassword',
})

// Or use the default admin (kerb: admin, password: admin123)
await createDefaultAdmin()
```

### Default Admin Credentials

When using Quick Init:

- **Kerb**: `admin`
- **Email**: `admin@test.com`
- **Password**: `admin123`

### Important Notes

1. **Email Format**: The email local-part must match the kerb (e.g., `admin@test.com` for kerb `admin`)
2. **Development Only**: The `/dev` route should be removed or restricted in production
3. **Permissions**: The admin will receive ALL permission flags available in the system
4. **Password Requirements**: Minimum 6 characters

### What the Admin Can Do

With all permissions, the admin user can:

- ✅ Access `/management` (inventory management)
- ✅ Access `/admin/permissions` (user permission management)
- ✅ Checkout and checkin items
- ✅ Send email notifications
- ✅ Promote/demote other users
- ✅ View all inventory data

### Troubleshooting

**"User already exists" error**:

- The user has already been registered. Try logging in with the existing credentials.

**"No userId returned" error**:

- The backend login response doesn't include a userId field. Check if the backend needs to be updated to return userId in the login response.

**"Email must match kerb prefix" error**:

- The email local-part (before @) must equal the kerb. For kerb `admin`, use `admin@domain.com`.

**Permission promotion failures**:

- Some flags may fail to promote. Check the console output for specific errors.
- Ensure the backend Roles API endpoints are accessible.

### Cleanup

To remove the admin user (must be done via backend):

- Use your backend's user management tools
- Or add a "Delete User" feature to the dev tools page

### Production

⚠️ **Remove the `/dev` route from production deployments** by:

1. Deleting the route from `router/index.ts`
2. Or adding environment-based guards:

```typescript
{
  path: '/dev',
  name: 'devTools',
  component: () => import('../views/DevToolsView.vue'),
  beforeEnter: () => {
    if (import.meta.env.PROD) {
      return { path: '/forbidden' }
    }
  }
}
```
