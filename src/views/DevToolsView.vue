<template>
  <div class="dev-tools">
    <h2>🔧 Development Tools</h2>
    <p class="warning">⚠️ This page should only be accessible in development mode</p>

    <div class="tool-section">
      <h3>Initialize Admin User</h3>
      <p>Create an admin user with full permissions for testing</p>

      <div class="form-group">
        <label>Kerb:</label>
        <input v-model="adminData.kerb" type="text" placeholder="admin" />
      </div>

      <div class="form-group">
        <label>Email:</label>
        <input v-model="adminData.email" type="email" placeholder="admin@test.com" />
      </div>

      <div class="form-group">
        <label>First Name:</label>
        <input v-model="adminData.first" type="text" placeholder="Admin" />
      </div>

      <div class="form-group">
        <label>Last Name:</label>
        <input v-model="adminData.last" type="text" placeholder="User" />
      </div>

      <div class="form-group">
        <label>Password:</label>
        <input v-model="adminData.password" type="password" placeholder="admin123" />
      </div>

      <button @click="initAdmin" :disabled="loading" class="btn-primary">
        {{ loading ? 'Initializing...' : 'Initialize Admin User' }}
      </button>

      <button @click="quickInit" :disabled="loading" class="btn-secondary">
        Quick Init (Default Admin)
      </button>

      <div
        v-if="result"
        class="result"
        :class="{ success: result.success, error: !result.success }"
      >
        <h4>{{ result.success ? '✓ Success!' : '✗ Error' }}</h4>
        <pre>{{ JSON.stringify(result, null, 2) }}</pre>
      </div>

      <div v-if="logs.length > 0" class="logs">
        <h4>Console Output:</h4>
        <div class="log-entry" v-for="(log, i) in logs" :key="i">{{ log }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { initializeAdminUser, createDefaultAdmin } from '../lib/initAdmin'

const adminData = ref({
  kerb: 'admin',
  email: 'admin@test.com',
  first: 'Admin',
  last: 'User',
  password: 'admin123',
})

const loading = ref(false)
const result = ref<{
  success: boolean
  userId?: string
  kerb?: string
  flagsPromoted?: number
  flagsFailed?: number
  error?: string
  message?: string
} | null>(null)
const logs = ref<string[]>([])

// Intercept console.log to show in UI
const originalLog = console.log
const originalError = console.error

function captureConsole() {
  console.log = (...args: unknown[]) => {
    logs.value.push(args.join(' '))
    originalLog(...args)
  }
  console.error = (...args: unknown[]) => {
    logs.value.push('ERROR: ' + args.join(' '))
    originalError(...args)
  }
}

function restoreConsole() {
  console.log = originalLog
  console.error = originalError
}

async function initAdmin() {
  loading.value = true
  result.value = null
  logs.value = []
  captureConsole()

  try {
    // Validate email format
    const emailVal = adminData.value.email.trim()
    const localPart = emailVal.split('@')[0]
    if (localPart !== adminData.value.kerb.trim()) {
      result.value = {
        success: false,
        error: 'Email local-part must match kerb',
      }
      return
    }

    const res = await initializeAdminUser({
      kerb: adminData.value.kerb.trim(),
      email: emailVal,
      first: adminData.value.first.trim(),
      last: adminData.value.last.trim(),
      password: adminData.value.password,
    })
    result.value = res
  } catch (error) {
    result.value = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  } finally {
    loading.value = false
    restoreConsole()
  }
}

async function quickInit() {
  loading.value = true
  result.value = null
  logs.value = []
  captureConsole()

  try {
    const res = await createDefaultAdmin()
    result.value = res
  } catch (error) {
    result.value = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  } finally {
    loading.value = false
    restoreConsole()
  }
}
</script>

<style scoped>
.dev-tools {
  max-width: 800px;
  margin: 40px auto;
  padding: 20px;
}

.warning {
  background: #fff3cd;
  border: 1px solid #ffc107;
  padding: 12px;
  border-radius: 6px;
  color: #856404;
  margin-bottom: 20px;
}

.tool-section {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 4px;
}

.form-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
}

button {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  margin-right: 10px;
  margin-top: 10px;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

.btn-secondary {
  background: #64748b;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #475569;
}

.result {
  margin-top: 20px;
  padding: 16px;
  border-radius: 6px;
  border: 2px solid;
}

.result.success {
  background: #d4edda;
  border-color: #28a745;
  color: #155724;
}

.result.error {
  background: #f8d7da;
  border-color: #dc3545;
  color: #721c24;
}

.result pre {
  margin-top: 10px;
  background: rgba(0, 0, 0, 0.05);
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
}

.logs {
  margin-top: 20px;
  background: #1e293b;
  color: #e2e8f0;
  padding: 16px;
  border-radius: 6px;
  max-height: 400px;
  overflow-y: auto;
}

.logs h4 {
  margin-top: 0;
  color: #94a3b8;
}

.log-entry {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  margin-bottom: 4px;
  white-space: pre-wrap;
}
</style>
