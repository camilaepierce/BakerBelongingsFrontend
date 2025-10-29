<template>
  <div class="permissions-admin">
    <h1>Permissions Admin</h1>

    <section class="controls">
      <label>
        <span>Target User ID</span>
        <input v-model="targetUserId" type="text" placeholder="Enter userId" />
      </label>
      <button class="btn" @click="loadTarget">Load User Permissions</button>
      <span v-if="loading" class="muted">Loading…</span>
      <span v-if="error" class="error">{{ error }}</span>
    </section>

    <section class="layout">
      <div class="column">
        <h2>All Flags</h2>
        <div class="flag-list">
          <div v-for="flag in allFlags" :key="flag.id" class="flag-item">
            <label>
              <input
                type="checkbox"
                :checked="userFlagsSet.has(flag.id)"
                @change="toggleFlag(flag.id, $event)"
              />
              <strong>{{ flag.name || flag.id }}</strong>
              <small class="muted">({{ flag.id }})</small>
            </label>
            <div class="actions" v-if="flag.actions && flag.actions.length">
              <span v-for="a in flag.actions" :key="a" class="chip">{{ a }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="column">
        <h2>Target User</h2>
        <div v-if="targetLoaded">
          <p><strong>User ID:</strong> {{ targetUserId }}</p>
          <p>
            <strong>Flags ({{ userFlags.length }})</strong>
          </p>
          <div class="chip-list">
            <span v-for="f in userFlags" :key="f" class="chip alt">{{ f }}</span>
          </div>
          <p>
            <strong>Actions ({{ userActions.length }})</strong>
          </p>
          <div class="chip-list">
            <span v-for="a in userActions" :key="a" class="chip">{{ a }}</span>
          </div>
        </div>
        <div v-else class="muted">No user loaded yet.</div>
      </div>
    </section>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, onMounted } from 'vue'
import { useRbacStore } from '../stores/rbac'
import { apiFetch } from '../lib/api'
import { promoteUser, demoteUser } from '../lib/admin'

const rbac = useRbacStore()
const targetUserId = ref('')
const userFlags = ref<string[]>([])
const loading = ref(false)
const error = ref('')

const userFlagsSet = computed(() => new Set(userFlags.value))
const allFlags = computed(() => rbac.allFlags)
const userActions = computed(() => rbac.actionsForFlags(userFlags.value))
const targetLoaded = computed(() => userFlags.value.length > 0)

async function loadTarget() {
  if (!targetUserId.value.trim()) return
  loading.value = true
  error.value = ''
  try {
    await rbac.ensureFlagsCatalog()
    const data = await apiFetch<
      { permissionFlags?: string[] }[] | { result?: { permissionFlags?: string[] }[] }
    >('/Roles/_getUserPermissions', {
      method: 'POST',
      json: true,
      body: { user: targetUserId.value.trim() },
    })
    const list = Array.isArray(data) ? data : (data?.result ?? [])
    userFlags.value = [...new Set(list.flatMap((row) => row.permissionFlags ?? []))]
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load user permissions'
  } finally {
    loading.value = false
  }
}

async function toggleFlag(flagId: string, ev: Event) {
  const checked = (ev.target as HTMLInputElement).checked
  try {
    if (checked) {
      await promoteUser(targetUserId.value.trim(), flagId)
    } else {
      await demoteUser(targetUserId.value.trim(), flagId)
    }
    await loadTarget()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to update flag'
  }
}

onMounted(async () => {
  await rbac.ensureFlagsCatalog()
})
</script>

<style scoped>
.permissions-admin {
  max-width: 1200px;
  margin: 20px auto;
  padding: 12px;
}
.controls {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}
.controls input {
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
}
.btn {
  padding: 8px 12px;
  border: 1px solid #3b82f6;
  background: #3b82f6;
  color: white;
  border-radius: 6px;
  cursor: pointer;
}
.layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.flag-list {
  display: grid;
  gap: 10px;
}
.flag-item {
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 8px;
}
.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef2ff;
  color: #1e40af;
  font-size: 12px;
}
.chip.alt {
  background: #f1f5f9;
  color: #0f172a;
}
.muted {
  color: #64748b;
}
.error {
  color: #b91c1c;
}
.actions {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
