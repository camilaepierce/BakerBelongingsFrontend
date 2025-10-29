<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '../stores/session'
import { useRbacStore } from '../stores/rbac'

const session = useSessionStore()
const rbac = useRbacStore()

const roleLabel = computed(() => {
  const flagsLoaded = rbac.permissionFlags.length > 0
  if (!flagsLoaded) return 'loading…'
  if (rbac.hasFlag('Houseteam')) return 'Houseteam'
  if (rbac.hasFlag('Desk')) return 'Desk'
  return 'Resident'
})

const userKerb = computed(() => session.kerb || '')
</script>

<template>
  <span class="user-pill">
    <strong>{{ userKerb }}</strong>
    <span class="sep">|</span>
    <span class="role">{{ roleLabel }}</span>
  </span>
</template>

<style scoped>
.user-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  border-color: var(--bb-primary);
  background: transparent;
  color: var(--bb-heading);
  font-size: 0.9rem;
}

.user-pill .sep {
  opacity: 0.6;
}
</style>
