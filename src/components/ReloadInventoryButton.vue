<template>
  <div class="reload-inventory">
    <button class="reload-button" :disabled="loading" @click="reload">
      <span v-if="!loading">🔄 Reload Inventory</span>
      <span v-else>Reloading...</span>
    </button>
    <span v-if="success" class="status success">Reloaded</span>
    <span v-if="error" class="status error">{{ error }}</span>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { apiFetch } from '../lib/api'

const emit = defineEmits<{ reloaded: [] }>()

const loading = ref(false)
const success = ref(false)
const error = ref('')

async function reload() {
  loading.value = true
  success.value = false
  error.value = ''
  try {
    // Backend returns no JSON body; avoid parsing to prevent JSON.parse errors
    await apiFetch<Response>('/Viewer/loadItems', {
      method: 'POST',
      json: false,
      // send an empty text body (or omit body entirely if backend accepts)
      headers: { 'Content-Type': 'text/plain' },
      body: '',
    })
    success.value = true
    emit('reloaded')
    // hide success after a short delay
    setTimeout(() => (success.value = false), 2000)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to reload inventory'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.reload-inventory {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.reload-button {
  padding: 10px 16px;
  background-color: #0d6efd;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.reload-button:disabled {
  background-color: #87a8ee;
  cursor: not-allowed;
}

.status {
  font-size: 0.9rem;
}

.status.success {
  color: #198754;
}

.status.error {
  color: #dc3545;
}
</style>
