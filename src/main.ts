import './assets/main.css'

import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useRbacStore } from './stores/rbac'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Simple permission directives (flag-based)

app.directive('has-flag', {
  mounted(el, binding) {
    const rbac = useRbacStore()
    const flagId: string = String(binding.value)
    const shouldDisable = Boolean(binding.modifiers?.disable)

    const apply = () => {
      const allowed = rbac.hasFlag(flagId)
      if (shouldDisable) {
        ;(el as HTMLButtonElement | HTMLElement).setAttribute('aria-disabled', String(!allowed))
        if ('disabled' in (el as HTMLButtonElement)) {
          ;(el as HTMLButtonElement).disabled = !allowed
        } else {
          el.classList.toggle('is-disabled', !allowed)
        }
      } else {
        el.style.display = allowed ? '' : 'none'
      }
    }

    // Apply immediately and react to RBAC changes
    apply()
    const stop = watch(() => rbac.permissionFlags, apply)
    ;(el as HTMLElement & { __rbacStop?: () => void }).__rbacStop = stop
  },
  updated(el, binding) {
    // Re-apply when binding value/modifiers change
    const rbac = useRbacStore()
    const flagId: string = String(binding.value)
    const shouldDisable = Boolean(binding.modifiers?.disable)
    const allowed = rbac.hasFlag(flagId)
    if (shouldDisable) {
      ;(el as HTMLButtonElement | HTMLElement).setAttribute('aria-disabled', String(!allowed))
      if ('disabled' in (el as HTMLButtonElement)) {
        ;(el as HTMLButtonElement).disabled = !allowed
      } else {
        el.classList.toggle('is-disabled', !allowed)
      }
    } else {
      el.style.display = allowed ? '' : 'none'
    }
  },
  unmounted(el) {
    const stop = (el as HTMLElement & { __rbacStop?: () => void }).__rbacStop
    if (typeof stop === 'function') stop()
  },
})

// Allow OR over multiple flags: v-has-any-flag="['Houseteam', 'Desk']" or "Houseteam|Desk"
app.directive('has-any-flag', {
  mounted(el, binding) {
    const rbac = useRbacStore()
    const shouldDisable = Boolean(binding.modifiers?.disable)
    const resolveFlags = (): string[] =>
      Array.isArray(binding.value)
        ? binding.value.map((v: unknown) => String(v))
        : String(binding.value)
            .split('|')
            .map((s) => s.trim())
            .filter(Boolean)

    const apply = () => {
      const flags = resolveFlags()
      const allowed = flags.some((f) => rbac.hasFlag(f))
      if (shouldDisable) {
        ;(el as HTMLButtonElement | HTMLElement).setAttribute('aria-disabled', String(!allowed))
        if ('disabled' in (el as HTMLButtonElement)) {
          ;(el as HTMLButtonElement).disabled = !allowed
        } else {
          el.classList.toggle('is-disabled', !allowed)
        }
      } else {
        el.style.display = allowed ? '' : 'none'
      }
    }

    apply()
    const stop = watch(() => rbac.permissionFlags, apply)
    ;(el as HTMLElement & { __rbacStop?: () => void }).__rbacStop = stop
  },
  updated(el, binding) {
    // Re-apply when binding value/modifiers change
    const rbac = useRbacStore()
    const shouldDisable = Boolean(binding.modifiers?.disable)
    const flags: string[] = Array.isArray(binding.value)
      ? binding.value.map((v: unknown) => String(v))
      : String(binding.value)
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
    const allowed = flags.some((f) => rbac.hasFlag(f))
    if (shouldDisable) {
      ;(el as HTMLButtonElement | HTMLElement).setAttribute('aria-disabled', String(!allowed))
      if ('disabled' in (el as HTMLButtonElement)) {
        ;(el as HTMLButtonElement).disabled = !allowed
      } else {
        el.classList.toggle('is-disabled', !allowed)
      }
    } else {
      el.style.display = allowed ? '' : 'none'
    }
  },
  unmounted(el) {
    const stop = (el as HTMLElement & { __rbacStop?: () => void }).__rbacStop
    if (typeof stop === 'function') stop()
  },
})

app.mount('#app')
