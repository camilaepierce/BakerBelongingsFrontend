import { apiFetch } from './api'
import { useRbacStore } from '../stores/rbac'

export async function promoteUser(kerb: string, flagId: string) {
  await apiFetch('/Roles/promoteUser', {
    method: 'POST',
    json: true,
    body: { kerb, permission: flagId },
  })
}

export async function demoteUser(kerb: string, flagId: string) {
  await apiFetch('/Roles/demoteUser', {
    method: 'POST',
    json: true,
    body: { kerb, permission: flagId },
  })
}

export async function refreshUserPermissions(userId?: string) {
  const rbac = useRbacStore()
  if (userId) {
    await rbac.loadForUser(userId)
  } else {
    await rbac.loadForCurrentUser()
  }
}
