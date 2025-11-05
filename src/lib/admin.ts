import { apiFetch } from './api'
import { useRbacStore } from '../stores/rbac'

export async function promoteUser({ kerb, permission }: { kerb: string; permission: string }) {
  await apiFetch('/Roles/promoteUser', {
    method: 'POST',
    json: true,
    body: { kerb, permission },
  })
}

export async function demoteUser({ kerb, permission }: { kerb: string; permission: string }) {
  await apiFetch('/Roles/demoteUser', {
    method: 'POST',
    json: true,
    body: { kerb, permission },
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
