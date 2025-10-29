import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import router from '../router'
import { apiFetch, setAuthTokenGetter, setUnauthorizedHandler } from '../lib/api'

export interface SessionData {
  kerb: string
  token: string
  userId?: string
  expiresAt?: string // ISO string for persistence; interpret as Date when needed
}

const STORAGE_KEY = 'bb.session'
const VALIDATION_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

export const useSessionStore = defineStore('session', () => {
  const kerb = ref<string | null>(null)
  const token = ref<string | null>(null)
  const userId = ref<string | null>(null)
  const expiresAt = ref<string | null>(null)
  const lastValidatedAt = ref<number>(0)
  let validationTimer: number | undefined

  const isAuthenticated = computed(() => !!token.value)

  function persist() {
    const data: SessionData | null = token.value
      ? {
          kerb: kerb.value!,
          token: token.value!,
          userId: userId.value || undefined,
          expiresAt: expiresAt.value || undefined,
        }
      : null
    if (data) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }

  function restore() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) return false
      const parsed = JSON.parse(raw) as SessionData
      kerb.value = parsed.kerb
      token.value = parsed.token
      userId.value = parsed.userId ?? null
      expiresAt.value = parsed.expiresAt ?? null
      return true
    } catch {
      return false
    }
  }

  async function validateTokenIfNeeded(force = false) {
    const now = Date.now()
    if (!token.value || !kerb.value) return false
    if (!force && now - lastValidatedAt.value < VALIDATION_INTERVAL_MS) return true

    try {
      const result = await apiFetch<{ valid: boolean; kerb?: string }>(
        '/Authorization/validateToken',
        {
          method: 'POST',
          json: true,
          body: { kerb: kerb.value, token: token.value },
        },
      )
      lastValidatedAt.value = now
      if (result && result.valid) {
        return true
      }
    } catch {
      // fallthrough to logout
    }
    await logout(true)
    return false
  }

  async function login(creds: { kerb: string; password: string }) {
    const res = await apiFetch<{
      kerb: string
      token: string
      userId?: string
      expiresAt?: string
    }>('/Authorization/login', { method: 'POST', json: true, body: creds })
    kerb.value = res.kerb
    token.value = res.token
    userId.value = res.userId ?? null
    expiresAt.value = res.expiresAt ?? null

    // Debug logging
    console.log('Login response:', res)
    console.log('userId set to:', userId.value)

    // If userId is missing, try to use kerb as userId fallback
    if (!userId.value) {
      console.warn('⚠️ No userId in login response. Using kerb as userId fallback.')
      userId.value = res.kerb
    }

    persist()
    scheduleValidation()
    return true
  }

  async function register(data: {
    kerb: string
    email: string
    first: string
    last: string
    password: string
    role?: string
  }) {
    await apiFetch('/Authorization/register', { method: 'POST', json: true, body: data })
  }

  async function logout(silent = false) {
    const oldToken = token.value
    kerb.value = null
    token.value = null
    userId.value = null
    expiresAt.value = null
    persist()
    clearValidation()
    try {
      if (oldToken) {
        await apiFetch('/Authorization/logout', { method: 'POST', json: true })
      }
    } catch {
      // ignore logout errors
    }
    if (!silent) {
      router.push({ path: '/login' })
    }
  }

  function clearValidation() {
    if (validationTimer) {
      window.clearInterval(validationTimer)
      validationTimer = undefined
    }
  }

  function scheduleValidation() {
    clearValidation()
    validationTimer = window.setInterval(() => {
      validateTokenIfNeeded().catch(() => {
        /* handled in store */
      })
    }, VALIDATION_INTERVAL_MS)
  }

  // Initialize hooks once
  if (!authTokenGetterInitialized) {
    setAuthTokenGetter(() => token.value || undefined)
    setUnauthorizedHandler(() => {
      // When backend says 401, clear session and send to login
      logout().catch(() => {
        /* ignore */
      })
    })
    authTokenGetterInitialized = true
  }

  // Attempt to restore from storage on first import
  restore()
  if (token.value) scheduleValidation()

  // Cross-tab sync
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      restore()
    }
  })

  return {
    kerb,
    token,
    userId,
    expiresAt,
    isAuthenticated,
    restore,
    persist,
    login,
    logout,
    register,
    validateTokenIfNeeded,
  }
})

// simple module-level guard to avoid duplicate hook init
let authTokenGetterInitialized = false
