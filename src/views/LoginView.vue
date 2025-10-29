<template>
  <div class="auth-container">
    <h1 v-if="mode === 'login'">Sign in</h1>
    <h1 v-else>Create account</h1>

    <form v-if="mode === 'login'" @submit.prevent="onLogin" class="auth-form">
      <label>
        <span>Kerb</span>
        <input v-model="kerb" type="text" autocomplete="username" required />
      </label>
      <label>
        <span>Password</span>
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>
      <button class="btn-primary" :disabled="loading">
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </button>
      <p v-if="error" class="error">{{ error }}</p>
      <p class="muted small">
        New here?
        <button class="link" type="button" @click="mode = 'register'">Create an account</button>
      </p>
    </form>

    <form v-else @submit.prevent="onRegister" class="auth-form">
      <label>
        <span>Kerb</span>
        <input v-model="kerb" type="text" autocomplete="username" required />
      </label>
      <label>
        <span>First name</span>
        <input v-model="first" type="text" autocomplete="given-name" required />
      </label>
      <label>
        <span>Last name</span>
        <input v-model="last" type="text" autocomplete="family-name" required />
      </label>
      <label>
        <span>Email</span>
        <input v-model="email" type="email" autocomplete="email" required />
      </label>
      <label>
        <span>Password</span>
        <input v-model="password" type="password" autocomplete="new-password" required />
      </label>
      <label>
        <span>Confirm password</span>
        <input v-model="confirm" type="password" autocomplete="new-password" required />
      </label>
      <button class="btn-primary" :disabled="loading">
        {{ loading ? 'Creating…' : 'Create account' }}
      </button>
      <p v-if="error" class="error">{{ error }}</p>
      <p class="muted small">
        Already have an account?
        <button class="link" type="button" @click="mode = 'login'">Sign in</button>
      </p>
    </form>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'

const kerb = ref('')
const password = ref('')
const email = ref('')
const first = ref('')
const last = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref('')
const mode = ref<'login' | 'register'>('login')

const router = useRouter()
const route = useRoute()
const session = useSessionStore()

async function onLogin() {
  loading.value = true
  error.value = ''
  try {
    await session.login({ kerb: kerb.value.trim(), password: password.value })
    const redirect = (route.query.redirect as string) || '/'
    router.replace(redirect)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to sign in'
  } finally {
    loading.value = false
  }
}

async function onRegister() {
  loading.value = true
  error.value = ''
  try {
    if (
      !kerb.value.trim() ||
      !first.value.trim() ||
      !last.value.trim() ||
      !email.value.trim() ||
      !password.value ||
      !confirm.value
    ) {
      throw new Error('Please fill out all fields')
    }
    const kerbVal = kerb.value.trim()
    // Kerb must be alphanumeric
    if (!/^[a-zA-Z0-9]+$/.test(kerbVal)) {
      throw new Error('Kerb must be alphanumeric')
    }
    // Minimal email validation
    const emailVal = email.value.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      throw new Error('Please enter a valid email')
    }
    // Email must match kerb prefix (local-part equals kerb)
    const localPart = emailVal.split('@')[0]
    if (localPart !== kerbVal) {
      throw new Error('Email must begin with your kerb (local-part must equal kerb)')
    }
    if (password.value !== confirm.value) {
      throw new Error('Passwords do not match')
    }
    if (password.value.length < 6) {
      throw new Error('Password must be at least 6 characters')
    }
    await session.register({
      kerb: kerbVal,
      email: emailVal,
      first: first.value.trim(),
      last: last.value.trim(),
      password: password.value,
    })
    // Auto-login after successful registration
    await session.login({ kerb: kerb.value.trim(), password: password.value })
    const redirect = (route.query.redirect as string) || '/'
    router.replace(redirect)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to create account'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-container {
  max-width: 360px;
  margin: 60px auto;
  padding: 24px;
  background: var(--bb-bg);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--bb-border);
  color: var(--bb-primary);
}
.auth-form {
  display: grid;
  gap: 12px;
}
label span {
  display: block;
  font-weight: 600;
  margin-bottom: 6px;
}
input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
}
.btn-primary {
  padding: 10px 14px;
  background: var(--bb-accent);
  color: var(--bb-bg);
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.error {
  color: #b91c1c;
  margin-top: 6px;
}
.muted {
  color: #64748b;
}
.small {
  font-size: 12px;
}
.link {
  background: none;
  border: none;
  color: var(--bb-accent);
  cursor: pointer;
  padding: 0;
}
</style>
