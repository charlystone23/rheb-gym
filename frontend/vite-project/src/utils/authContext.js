const USER_KEY = "user"
const ADMIN_CONTEXT_KEY = "adminUserContext"

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    localStorage.removeItem(USER_KEY)
    return null
  }
}

export function setStoredUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearStoredSession() {
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(ADMIN_CONTEXT_KEY)
}

export function setAdminContext(user) {
  localStorage.setItem(ADMIN_CONTEXT_KEY, JSON.stringify(user))
}

export function getAdminContext() {
  try {
    const raw = localStorage.getItem(ADMIN_CONTEXT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    localStorage.removeItem(ADMIN_CONTEXT_KEY)
    return null
  }
}
