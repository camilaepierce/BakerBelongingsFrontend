<template>
  <div class="permissions-admin">
    <h1>Permissions Admin</h1>

    <section class="controls">
      <label>
        <span>Target Kerb</span>
        <input v-model="targetKerb" type="text" placeholder="Enter kerb (e.g., camjohnson)" />
      </label>
      <button class="btn" @click="loadTarget" :disabled="loading || !targetKerb.trim()">
        Load User Permissions
      </button>
      <button class="btn success" @click="saveChanges" :disabled="saving || !targetLoaded">
        Submit Changes
      </button>
      <button class="btn ghost" @click="resetChanges" :disabled="saving || !targetLoaded">
        Reset
      </button>
      <span v-if="loading" class="muted">Loading…</span>
      <span v-if="saving" class="muted">Saving…</span>
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
                :value="flag.id"
                v-model="selectedFlags"
                :disabled="!targetLoaded || saving"
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
          <p><strong>Kerb:</strong> {{ targetKerb }}</p>
          <p>
            <strong>Flags ({{ selectedFlags.length }})</strong>
          </p>
          <div class="chip-list">
            <span v-for="f in selectedFlags" :key="f" class="chip alt">{{ f }}</span>
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
const targetKerb = ref('')
const loadedFlags = ref<string[]>([])
const selectedFlags = ref<string[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const allFlags = computed(() => rbac.allFlags)
const userActions = computed(() => rbac.actionsForFlags(selectedFlags.value))
const targetLoaded = ref(false)

async function loadTarget() {
  if (!targetKerb.value.trim()) return
  loading.value = true
  error.value = ''
  targetLoaded.value = false
  try {
    await rbac.ensureFlagsCatalog()
    const data = await apiFetch<
      { permissionFlags?: string[] }[] | { result?: { permissionFlags?: string[] }[] }
    >('/Roles/_getUserPermissions', {
      method: 'POST',
      json: true,
      body: { kerb: targetKerb.value.trim() },
    })
    const list = Array.isArray(data) ? data : (data?.result ?? [])
    const flags = [...new Set(list.flatMap((row) => row.permissionFlags ?? []))]
    loadedFlags.value = flags
    selectedFlags.value = [...flags]
    targetLoaded.value = true
  } catch (e) {
    const message = e instanceof Error ? e.message : ''

    // Friendly permission load errors
    if (message.includes('not found') || message.includes('does not exist')) {
      error.value = `User "${targetKerb.value.trim()}" not found. Please check the kerb.`
    } else if (message.includes('401') || message.includes('Unauthorized')) {
      error.value = 'Your session expired. Please log in again.'
    } else if (message.includes('403') || message.includes('permission')) {
      error.value = "You don't have permission to view user permissions."
    } else if (message.includes('500') || message.includes('Internal Server')) {
      error.value = 'Server error. Please try again in a moment.'
    } else if (message) {
      error.value = message
    } else {
      error.value = 'Failed to load user permissions. Please try again.'
    }
  } finally {
    loading.value = false
  }
}

async function saveChanges() {
  if (!targetLoaded.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    const before = new Set(loadedFlags.value)
    const after = new Set(selectedFlags.value)
    const toAdd: string[] = []
    const toRemove: string[] = []
    // Compute diffs
    for (const f of after) if (!before.has(f)) toAdd.push(f)
    for (const f of before) if (!after.has(f)) toRemove.push(f)

    // Apply changes
    for (const f of toAdd) {
      await promoteUser({ kerb: targetKerb.value.trim(), permission: f })
    }
    for (const f of toRemove) {
      await demoteUser({ kerb: targetKerb.value.trim(), permission: f })
    }

    // Refresh snapshot from server to reflect real state
    await loadTarget()
  } catch (e) {
    const message = e instanceof Error ? e.message : ''

    // Friendly permission save errors
    if (message.includes('not found') || message.includes('does not exist')) {
      error.value = `User "${targetKerb.value.trim()}" not found or permission flag invalid.`
    } else if (message.includes('not valid') || message.includes('invalid')) {
      error.value = 'One or more permission flags are invalid. Please refresh and try again.'
    } else if (message.includes('401') || message.includes('Unauthorized')) {
      error.value = 'Your session expired. Please log in again.'
    } else if (message.includes('403') || message.includes('permission')) {
      error.value = "You don't have permission to modify user permissions."
    } else if (message.includes('500') || message.includes('Internal Server')) {
      error.value = 'Server error. Changes may not have been saved. Please try again.'
    } else if (message) {
      error.value = `Save failed: ${message}`
    } else {
      error.value = 'Failed to save changes. Please try again.'
    }
  } finally {
    saving.value = false
  }
}

function resetChanges() {
  if (!targetLoaded.value) return
  selectedFlags.value = [...loadedFlags.value]
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
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn.ghost {
  background: white;
  color: #1e40af;
  border-color: #cbd5e1;
}
.btn.success {
  background: #16a34a;
  border-color: #16a34a;
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
