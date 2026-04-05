import { createRouter, createWebHistory } from "vue-router"
import Login from "../views/Login.vue"
import Dashboard from "../views/Dashboard.vue"
import Admin from "../views/Admin.vue"
import Alumnos from "../views/Alumnos.vue"
import AdminAlumnos from "../views/AdminAlumnos.vue"
import AdminUsers from "../views/AdminUsers.vue"
import AdminStats from "../views/AdminStats.vue"
import AdminMemberships from "../views/AdminMemberships.vue"
import AdminConfig from "../views/AdminConfig.vue"
import AdminSales from "../views/AdminSales.vue"
import AdminSchedules from "../views/AdminSchedules.vue"
import { getStoredUser } from "../utils/authContext"

const routes = [
  {
    path: "/",
    component: Login,
    meta: { requiresAuth: false }
  },
  {
    path: "/dashboard",
    component: Dashboard,
    meta: { requiresAuth: true }
  },
  {
    path: "/alumnos",
    component: Alumnos,
    meta: { requiresAuth: true }
  },
  {
    path: "/admin",
    component: Admin,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: "/admin/alumnos",
    component: AdminAlumnos,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: "/admin/users",
    component: AdminUsers,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: "/admin/stats",
    component: AdminStats,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: "/admin/memberships",
    component: AdminMemberships,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: "/admin/config",
    component: AdminConfig,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: "/sales",
    component: AdminSales,
    meta: { requiresAuth: true }
  },
  {
    path: "/admin/schedules",
    component: AdminSchedules,
    meta: { requiresAuth: true } // Quitamos requiresAdmin para que entrenadores puedan entrar
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/"
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  // Get user from localStorage safely
  let user = null
  try {
    user = getStoredUser()
  } catch (e) {
    console.error("Error parsing user from localStorage:", e)
    localStorage.removeItem("user")
  }

  // If route requires authentication and user is not logged in, redirect to login
  if (to.meta.requiresAuth && !user) {
    next("/")
    return
  }

  // If route requires admin and user is not admin, redirect to dashboard
  if (to.meta.requiresAdmin && user?.role !== "admin") {
    next("/dashboard")
    return
  }

  // If user is admin trying to access dashboard or alumnos (trainer view), redirect to admin panel
  if ((to.path === "/dashboard" || to.path === "/alumnos") && user?.role === "admin") {
    next("/admin")
    return
  }

  // If user is common user trying to access admin routes (except schedules), redirect to dashboard
  if (to.path.startsWith("/admin") && to.path !== "/admin/schedules" && user?.role !== "admin") {
    next("/dashboard")
    return
  }

  // Allow navigation
  next()
})

export default router
