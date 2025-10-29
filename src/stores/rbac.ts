import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '../lib/api'
import { useSessionStore } from './session'

export interface PermissionFlagDef {
  id: string
  name?: string
  actions?: string[]
}

export const useRbacStore = defineStore('rbac', () => {
  const permissionFlags = ref<string[]>([])
  const actions = ref<Set<string>>(new Set())
  const flagsCatalog = ref<Map<string, PermissionFlagDef>>(new Map())
  const loading = ref(false)
  const lastLoadedUserId = ref<string | null>(null)
  const allFlags = computed<PermissionFlagDef[]>(() => Array.from(flagsCatalog.value.values()))

  const hasAny = (required: string[]) => required.some((a) => actions.value.has(a))
  const hasAll = (required: string[]) => required.every((a) => actions.value.has(a))
  const can = (actionId: string) => actions.value.has(actionId)
  const hasFlag = (flagId: string) => permissionFlags.value.includes(flagId)

  const isReady = computed(() => !!lastLoadedUserId.value && !loading.value)

  function reset() {
    permissionFlags.value = []
    actions.value = new Set()
    lastLoadedUserId.value = null
  }

  function normalizeFlags(input: string[] | undefined): string[] {
    const raw = (input ?? []).map((s) => String(s))
    const set = new Set<string>()
    const has = (arr: string[]) => arr.some((a) => raw.includes(a))
    if (has(['Admin', 'Houseteam', 'HouseTeam', 'House Team'])) set.add('Houseteam')
    if (has(['DeskStaff', 'Desk', 'desk'])) set.add('Desk')
    if (has(['Viewer', 'Resident', 'resident'])) set.add('Resident')
    // If nothing matched, default to Resident (view-only access)
    if (set.size === 0) set.add('Resident')
    return Array.from(set)
  }

  function initializeDirect(input: { userId: string; flags?: string[]; actions?: string[] }) {
    permissionFlags.value = normalizeFlags(input.flags)
    actions.value = new Set(Array.isArray(input.actions) ? input.actions : [])
    lastLoadedUserId.value = input.userId
  }

  async function ensureFlagsCatalog() {
    if (flagsCatalog.value.size > 0) return
    // Prefer a single catalog call: _listAllPermissionFlags
    const result = await apiFetch<PermissionFlagDef[] | { result?: PermissionFlagDef[] }>(
      '/Roles/_listAllPermissionFlags',
      { method: 'POST', json: true },
    )

    const list: PermissionFlagDef[] = Array.isArray(result)
      ? result
      : Array.isArray(result?.result)
        ? result.result!
        : []

    flagsCatalog.value = new Map(list.map((f) => [f.id, f]))
  }

  function actionsForFlags(flags: string[]): string[] {
    const set = new Set<string>()
    for (const flagId of flags) {
      const def = flagsCatalog.value.get(flagId)
      if (def?.actions) for (const a of def.actions) set.add(a)
    }
    return Array.from(set)
  }

  async function loadForCurrentUser() {
    const session = useSessionStore()
    if (!session.token || !session.userId) {
      // Without userId we cannot map permissions; leave empty
      reset()
      return
    }
    // Preferred: ask backend for identity + RBAC in one shot
    const whoOk = await loadViaWhoami()
    if (!whoOk) {
      // Fallback to assembling from flags and catalog if whoami is unavailable
      await loadForUser(session.userId)
    }
  }

  async function loadForUser(userId: string) {
    loading.value = true
    try {
      await ensureFlagsCatalog()
      console.log('📋 Flags catalog loaded:', flagsCatalog.value.size, 'flags')

      const data = await apiFetch<
        { permissionFlags?: string[] }[] | { result?: { permissionFlags?: string[] }[] }
      >('/Roles/_getUserPermissions', {
        method: 'POST',
        json: true,
        body: { user: userId },
      })

      console.log('📥 getUserPermissions response:', data)

      const list = Array.isArray(data) ? data : (data?.result ?? [])
      console.log('📝 Parsed list:', list)
      console.log('📝 First item:', list[0])

      const flags = list.flatMap((row) => row.permissionFlags ?? [])
      console.log('📝 Extracted flags before dedup:', flags)
      permissionFlags.value = normalizeFlags(flags)

      console.log('🏴 Canonical user permission flags:', permissionFlags.value)

      // Build actions set by flattening catalog entries
      const actSet = new Set<string>()
      for (const flagId of permissionFlags.value) {
        const def = flagsCatalog.value.get(flagId)
        console.log(`🔍 Looking up flag "${flagId}":`, def)
        if (def?.actions) {
          for (const a of def.actions) actSet.add(a)
        } else {
          // Fallback: fetch actions for a flag individually if catalog lacks it
          try {
            const res = await apiFetch<
              { actions?: string[] }[] | { result?: { actions?: string[] }[] }
            >('/Roles/_getPermissionFlagActions', {
              method: 'POST',
              json: true,
              body: { flag: flagId },
            })
            const arr = Array.isArray(res) ? res : (res?.result ?? [])
            const actionsArr = arr.flatMap((r) => r.actions ?? [])
            console.log(`📦 Fetched actions for flag "${flagId}":`, actionsArr)
            for (const a of actionsArr) actSet.add(a)
          } catch {
            // ignore per-flag errors to avoid blocking
            console.warn(`⚠️ Could not fetch actions for flag "${flagId}"`)
          }
        }
      }
      actions.value = actSet
      lastLoadedUserId.value = userId

      console.log('✅ Final actions loaded:', Array.from(actions.value))
    } finally {
      loading.value = false
    }
  }

  async function loadViaWhoami(): Promise<boolean> {
    const session = useSessionStore()
    if (!session.token) return false
    try {
      const data = await apiFetch<
        | { userId?: string; kerb?: string; flags?: string[]; actions?: string[] }
        | { result?: { userId?: string; kerb?: string; flags?: string[]; actions?: string[] } }
      >('/Authorization/whoami', {
        method: 'POST',
        json: true,
        body: { token: session.token },
      })

      type WhoPayload = { userId?: string; kerb?: string; flags?: string[]; actions?: string[] }
      const payload: WhoPayload = (data as { result?: WhoPayload })?.result ?? (data as WhoPayload)
      const userId = payload?.userId as string | undefined
      const flags = (payload?.flags as string[] | undefined) ?? []
      const acts = (payload?.actions as string[] | undefined) ?? []

      if (!userId) return false
      initializeDirect({ userId, flags, actions: acts })
      console.log('✅ RBAC initialized via whoami:', { flags, actions: acts })
      return true
    } catch {
      console.warn('whoami not available or failed, falling back to catalog-based RBAC.')
      return false
    }
  }

  async function refresh() {
    if (lastLoadedUserId.value) {
      await loadForUser(lastLoadedUserId.value)
    }
  }

  return {
    permissionFlags,
    actions,
    loading,
    isReady,
    allFlags,
    can,
    hasAny,
    hasAll,
    hasFlag,
    initializeDirect,
    ensureFlagsCatalog,
    actionsForFlags,
    loadForUser,
    loadForCurrentUser,
    loadViaWhoami,
    refresh,
    reset,
  }
})
