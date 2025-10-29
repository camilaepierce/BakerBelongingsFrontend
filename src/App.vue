<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { computed, onMounted } from 'vue'
import { useSessionStore } from './stores/session'
import { useRbacStore } from './stores/rbac'
import UserPill from './components/UserPill.vue'

const session = useSessionStore()
const isAuthenticated = computed(() => session.isAuthenticated)
const rbac = useRbacStore()

async function handleLogout() {
  await session.logout()
}

onMounted(async () => {
  // Preload RBAC so nav directives can reflect permissions immediately
  if (session.isAuthenticated && rbac.permissionFlags.length === 0) {
    await rbac.loadForCurrentUser()
  }
})
</script>

<template>
  <header>
    <div class="wrapper">
      <h1 class="app-title">Baker Belongings</h1>

      <div class="nav-row">
        <nav class="main-nav">
          <RouterLink to="/">Inventory</RouterLink>
          <RouterLink to="/management" v-has-any-flag="['Houseteam', 'Desk']"
            >Management</RouterLink
          >
          <RouterLink to="/admin/permissions" v-has-flag="'Houseteam'">Permissions</RouterLink>
        </nav>
        <div class="auth-controls">
          <div v-if="isAuthenticated" class="user-meta">
            <UserPill />
            <button @click="handleLogout" class="logout-btn">Logout</button>
          </div>
          <RouterLink v-else to="/login" class="login-btn">Login</RouterLink>
        </div>
      </div>
    </div>
  </header>

  <RouterView />
</template>

<style scoped>
header {
  line-height: 1.5;
  background: var(--bb-surface);
  border-bottom: 1px solid var(--bb-border);
  /* full-bleed background across viewport */
  width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
}

.wrapper {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.auth-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* user-pill styles moved into UserPill component */

.app-title {
  color: var(--bb-heading);
  margin: 0 0 0.5rem 0;
}

.main-nav {
  width: 100%;
  font-size: 14px;
  text-align: left;
  margin-top: 0.5rem;
}

.main-nav a.router-link-exact-active {
  color: var(--bb-mint);
}

.main-nav a.router-link-exact-active:hover {
  background-color: transparent;
}

.main-nav a {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-left: 1px solid var(--bb-border);
  color: var(--bb-link);
}

.main-nav a:first-of-type {
  border: 0;
}

.logout-btn {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: var(--bb-danger);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition:
    background-color 0.2s,
    filter 0.2s,
    box-shadow 0.2s;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.05),
    0 1px 2px rgba(0, 0, 0, 0.06);
}

.logout-btn:hover {
  filter: brightness(0.9);
}

.login-btn {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: var(--bb-primary);
  color: #fff !important;
  border-radius: 4px;
  font-weight: 600;
  transition:
    background-color 0.2s,
    filter 0.2s,
    box-shadow 0.2s;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.05),
    0 1px 2px rgba(0, 0, 0, 0.06);
}

.login-btn:hover {
  filter: brightness(0.95);
}

@media (min-width: 1024px) {
  .main-nav {
    text-align: left;
    font-size: 1rem;
    padding: 0.5rem 0 1rem;
  }
}
</style>
