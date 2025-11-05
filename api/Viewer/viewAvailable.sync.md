# Viewer API: viewAvailable (Sync-Orchestrated)

**Endpoint:** POST /api/Viewer/viewAvailable

**Description:** Query available inventory items with authentication and authorization via synchronized flows. This route is orchestrated by the Requesting concept and requires valid login credentials and the "viewAvailable" permission.

## Synchronization Flow

This endpoint triggers a multi-step synchronization:

1. **QueryItems_Login**: Authenticates the user via `Authorization.login`
2. **QueryItems_Authorize**: Checks if the user has the "viewAvailable" action permission via `Roles.allowAction`
3. **QueryItems_Respond**: If allowed, executes `Viewer.viewAvailable` and responds with authorization status

## Request Body

```json
{
  "kerb": "string (username)",
  "password": "string"
}
```

### Parameters

- **kerb** (required): User's kerberos username
- **password** (required): User's password

## Success Response Body

```json
{
  "allowed": true
}
```

**Note:** The current implementation returns only the authorization status. The actual items are retrieved via `Viewer.viewAvailable` but are not currently bound to the response. Future enhancement will include the items array in the response.

## Error Response Body

```json
{
  "error": "string"
}
```

### Common Errors

- **401**: Invalid credentials (login failed)
- **403**: User does not have "viewAvailable" permission
- **504**: Request timed out (default 10s timeout)

## Requirements

- User must exist in the `userLogins` collection
- User must have the "viewAvailable" action in one of their assigned permission flags
- Valid password must be provided

## Effects

- User is authenticated (login action)
- Authorization check is performed
- Available items are queried (if authorized)
- Response is sent back to the requester

## Exclusion Note

This route is **excluded** from passthrough in `src/concepts/Requesting/passthrough.ts` and requires the full sync orchestration flow.

## Related Syncs

- `sample.QueryItems_Login`
- `sample.QueryItems_Authorize`
- `sample.QueryItems_Respond`

Located in: `src/syncs/sample.sync.ts`
