import { apiFetch } from './api'

/**
 * Development utility to initialize an admin user with full permissions.
 * This should only be used in development/testing environments.
 */
export async function initializeAdminUser(credentials: {
  kerb: string
  email: string
  first: string
  last: string
  password: string
  role?: string
}) {
  try {
    // Step 1: Register the admin user
    console.log('Registering admin user:', credentials.kerb)
    // Ensure any initialized admin is a member of the 'houseteam' role by default
    const registrationBody = { ...credentials, role: credentials.role ?? 'houseteam' }
    await apiFetch('/Authorization/register', {
      method: 'POST',
      json: true,
      body: registrationBody,
    })
    console.log('✓ Admin user registered successfully')

    // Step 2: Login to get token and userId
    console.log('Logging in as admin...')
    const loginRes = await apiFetch<{
      kerb: string
      token: string
      userId?: string
    }>('/Authorization/login', {
      method: 'POST',
      json: true,
      body: { kerb: credentials.kerb, password: credentials.password },
    })
    console.log('✓ Login successful, userId:', loginRes.userId)

    if (!loginRes.userId) {
      console.warn('⚠ Warning: No userId returned from login. Cannot assign permissions.')
      return { success: false, message: 'No userId returned from backend' }
    }

    // Step 3: Get all available permission flags
    console.log('Fetching all permission flags...')
    const flagsResult = await apiFetch<
      | { id: string; name?: string; actions?: string[] }[]
      | { result?: { id: string; name?: string; actions?: string[] }[] }
    >('/Roles/_listAllPermissionFlags', {
      method: 'POST',
      json: true,
    })

    const flags = Array.isArray(flagsResult)
      ? flagsResult
      : Array.isArray(flagsResult?.result)
        ? flagsResult.result
        : []

    console.log(`✓ Found ${flags.length} permission flags`)

    // Step 4: Promote admin user to all flags
    console.log('Promoting admin to all flags...')
    let successCount = 0
    let failCount = 0

    for (const flag of flags) {
      try {
        await apiFetch('/Roles/promoteUser', {
          method: 'POST',
          json: true,
          body: { user: loginRes.userId, permission: flag.id },
        })
        console.log(`  ✓ Promoted to flag: ${flag.name || flag.id}`)
        successCount++
      } catch (err) {
        console.error(`  ✗ Failed to promote to flag: ${flag.name || flag.id}`, err)
        failCount++
      }
    }

    console.log(`\n✓ Admin initialization complete!`)
    console.log(`  - Promoted to ${successCount} flags`)
    if (failCount > 0) {
      console.log(`  - Failed ${failCount} flags`)
    }
    console.log(`\nAdmin credentials:`)
    console.log(`  Kerb: ${credentials.kerb}`)
    console.log(`  Password: ${credentials.password}`)
    console.log(`  UserID: ${loginRes.userId}`)

    return {
      success: true,
      userId: loginRes.userId,
      kerb: credentials.kerb,
      flagsPromoted: successCount,
      flagsFailed: failCount,
    }
  } catch (error) {
    console.error('✗ Failed to initialize admin user:', error)
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log('\nℹ User may already exist. Try logging in instead.')
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Quick helper to create a default admin user for development
 */
export async function createDefaultAdmin() {
  return initializeAdminUser({
    kerb: 'admin',
    email: 'admin@test.com',
    first: 'Admin',
    last: 'User',
    password: 'admin123',
    role: 'houseteam',
  })
}
