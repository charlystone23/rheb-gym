<script setup>
import { ref } from "vue"
import { useRouter } from "vue-router"
import { MongoService } from "../services/mongoService"

const router = useRouter()

const username = ref("")
const password = ref("")
const error = ref("")
const loading = ref(false)

async function handleLogin() {
  if (!username.value || !password.value) {
    error.value = "Por favor, completa todos los campos"
    return
  }

  loading.value = true
  error.value = ""

  try {
    const response = await MongoService.login(username.value, password.value)
    
    if (response.success) {
      localStorage.setItem("user", JSON.stringify(response.user))
      // Redirect based on role
      if (response.user.role === 'admin') {
        router.push("/admin")
      } else {
        router.push("/dashboard")
      }
    } else {
      // Si el backend envió un mensaje específico, lo usamos.
      // Si no, y hay un campo 'error', es probablemente un error del servidor (500).
      error.value = response.message || response.error || "Error en el servidor o credenciales incorrectas"
    }
  } catch (err) {
    error.value = "Error de conexión con el servidor. Asegúrate de que el backend esté corriendo."
    console.error("Login error:", err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <div class="logo-container">
          <img src="/logo.png" alt="Rheb Logo" class="logo" />
        </div>
        <h1>Rheb</h1>
        <p class="subtitle">Inicia sesión en tu cuenta</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username">Usuario</label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="Nombre de usuario"
            required
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label for="password">Contraseña</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            required
            :disabled="loading"
          />
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <button type="submit" class="login-button" :disabled="loading">
          <span v-if="loading">Iniciando sesión...</span>
          <span v-else>Iniciar Sesión</span>
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  min-height: 100dvh; /* Dynamic viewport height for mobile */
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--page-bg);
  padding: 16px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.login-card {
  background: var(--card-bg);
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  padding: 32px 24px;
  width: 100%;
  max-width: 100%;
  border: 2px solid var(--card-border);
}

.login-header {
  text-align: center;
  margin-bottom: 28px;
}

.logo-container {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.logo {
  width: 100px;
  height: 100px;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
}

.login-header h1 {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--header-text);
}

.subtitle {
  color: var(--subtitle-text);
  font-size: 0.9rem;
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--header-text);
  text-align: left;
}

.form-group input {
  padding: 14px 16px;
  border: 2px solid var(--input-border);
  border-radius: 10px;
  font-size: 16px; /* Prevents zoom on iOS */
  transition: all 0.2s;
  font-family: inherit;
  -webkit-appearance: none;
  appearance: none;
  touch-action: manipulation;
  background: var(--input-bg);
  color: var(--header-text);
}

.form-group input:focus {
  outline: none;
  border-color: var(--rheb-primary-green);
  box-shadow: 0 0 0 3px rgba(0, 77, 64, 0.15);
}

.form-group input:disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}

.error-message {
  background-color: #fee2e2;
  color: #dc2626;
  padding: 12px;
  border-radius: 8px;
  font-size: 0.875rem;
  text-align: center;
}

.login-button {
  background: var(--primary-btn-bg);
  color: var(--primary-btn-text);
  border: none;
  padding: 16px;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  margin-top: 8px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  min-height: 48px; /* Better touch target */
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.login-button:active:not(:disabled) {
  transform: scale(0.98);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 24px 0;
  color: #9ca3af;
  font-size: 0.875rem;
}

.divider::before,
.divider::after {
  content: "";
  flex: 1;
  border-bottom: 1px solid #e5e7eb;
}

.divider span {
  padding: 0 16px;
}

.mock-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mock-button {
  width: 100%;
  padding: 14px;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  min-height: 48px;
  border: 2px solid #000000;
}

.mock-user {
  background-color: var(--rheb-dark-grey);
  color: var(--rheb-white);
}

.mock-admin {
  background-color: var(--rheb-primary-green);
  color: var(--rheb-white);
}

.mock-button:active:not(:disabled) {
  transform: scale(0.98);
}

.mock-user:active:not(:disabled) {
  background-color: #3A3A3A;
}

.mock-admin:active:not(:disabled) {
  background-color: #FFA500;
}

.mock-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Dark Mode specific overrides if needed (extra contrast) */
[data-theme="dark"] .login-card {
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}
</style>
    