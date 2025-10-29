import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { useSessionStore } from '../stores/session'
import { useRbacStore } from '../stores/rbac'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/management',
      name: 'management',
      component: () => import('../views/ManagementView.vue'),
      meta: {
        requiresAuth: true,
        // Management available to Desk or Houseteam
        requireFlags: ['Desk', 'Houseteam'],
      },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/forbidden',
      name: 'forbidden',
      component: () => import('../views/ForbiddenView.vue'),
    },
    {
      path: '/admin/permissions',
      name: 'permissionsAdmin',
      component: () => import('../views/PermissionsAdminView.vue'),
      meta: {
        requiresAuth: true,
        // Only Houseteam may access the permissions admin page
        requireFlags: ['Houseteam'],
      },
    },
    {
      path: '/dev',
      name: 'devTools',
      component: () => import('../views/DevToolsView.vue'),
      // No auth required for dev tools - should be removed in production
    },
  ],
})

// Global navigation guard for auth + RBAC
router.beforeEach(async (to) => {
  const session = useSessionStore()
  // Try to restore/validate session before guarded routes
  if (!session.isAuthenticated) {
    session.restore()
  }

  const requiresAuth = to.meta?.requiresAuth as boolean | undefined
  const requiredFlags = (to.meta?.requireFlags as string[] | undefined) ?? []

  if (requiresAuth) {
    if (!session.isAuthenticated) {
      return { path: '/login', query: { redirect: to.fullPath } }
    }
    // Validate token opportunistically
    await session.validateTokenIfNeeded(true)
  }

  if (requiresAuth && requiredFlags.length > 0) {
    const rbac = useRbacStore()
    if (session.userId) {
      // Ensure RBAC is initialized before evaluating flags
      if (!rbac.permissionFlags.length) {
        console.log('Loading RBAC for userId (flags focus):', session.userId)
        await rbac.loadForCurrentUser()
        console.log('RBAC loaded. Flags:', rbac.permissionFlags)
      }
      // Interpret requireFlags as OR (any flag satisfies). If you need AND semantics,
      // use an array in a separate meta key (e.g., requireAllFlags) and extend this guard.
      const flagsOk = requiredFlags.length === 0 || requiredFlags.some((f) => rbac.hasFlag(f))
      console.log('Permission check (flags only, OR):', { flagsOk, requiredFlags })
      if (!flagsOk) {
        console.error('❌ Access denied. Missing required permissions.')
        return { path: '/forbidden' }
      }
    } else {
      // Without userId we can't evaluate RBAC; deny access
      console.error('❌ No userId available. Cannot load RBAC.')
      return { path: '/forbidden' }
    }
  }
  return true
})

export default router
