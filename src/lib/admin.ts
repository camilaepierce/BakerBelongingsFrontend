import { apiFetch } from './api'
import { useRbacStore } from '../stores/rbac'

export async function promoteUser(userId: string, flagId: string) {
  await apiFetch('/Roles/promoteUser', {
    method: 'POST',
    json: true,
    body: { user: userId, flag: flagId },
  })
}

export async function demoteUser(userId: string, flagId: string) {
  await apiFetch('/Roles/demoteUser', {
    method: 'POST',
    json: true,
    body: { user: userId, flag: flagId },
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
