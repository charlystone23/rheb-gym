<script setup>
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"
import ThemeToggle from "../components/ThemeToggle.vue"
import { MongoService } from "../services/mongoService"
import { clearStoredSession, getStoredUser, setAdminContext, setStoredUser } from "../utils/authContext"

const router = useRouter()
const user = ref(null)
const showTrainerModal = ref(false)
const trainerForm = ref({
  username: "",
  password: "",
  nombre: ""
})
const trainerError = ref("")
const isSavingTrainer = ref(false)

onMounted(() => {
  const storedUser = getStoredUser()
  if (storedUser) {
    user.value = storedUser
    setAdminContext(storedUser)
    if (user.value?.role !== "admin") {
      router.push("/dashboard")
    }
  } else {
    router.push("/")
  }
})

function logout() {
  clearStoredSession()
  router.push("/")
}

function openTrainerModal() {
  trainerError.value = ""
  trainerForm.value = {
    username: "",
    password: "",
    nombre: user.value?.nombre ? `${user.value.nombre} Entrenador` : ""
  }
  showTrainerModal.value = true
}

function closeTrainerModal() {
  showTrainerModal.value = false
  trainerError.value = ""
}

async function createLinkedTrainer() {
  if (!trainerForm.value.username.trim() || !trainerForm.value.password.trim() || !trainerForm.value.nombre.trim()) {
    trainerError.value = "Completá usuario, contraseña y nombre."
    return
  }

  try {
    isSavingTrainer.value = true
    const result = await MongoService.createLinkedTrainer(user.value._id, {
      username: trainerForm.value.username.trim(),
      password: trainerForm.value.password.trim(),
      nombre: trainerForm.value.nombre.trim()
    })

    user.value = result.admin
    setStoredUser(result.admin)
    setAdminContext(result.admin)
    closeTrainerModal()
  } catch (error) {
    trainerError.value = error.message || "No se pudo crear el entrenador vinculado."
  } finally {
    isSavingTrainer.value = false
  }
}

async function goToTrainer() {
  if (!user.value?.linkedTrainerId) return

  try {
    const trainerUser = await MongoService.getUsuarioById(user.value.linkedTrainerId)
    setAdminContext(user.value)
    setStoredUser(trainerUser)
    router.push("/dashboard")
  } catch (error) {
    trainerError.value = "No se pudo abrir el perfil de entrenador."
  }
}

function goToEntrenadores() {
  router.push("/admin/alumnos")
}

function goToUsers() {
  router.push("/admin/users")
}

function goToStats() {
  router.push("/admin/stats")
}

function goToExpenses() {
  router.push("/admin/expenses")
}

function goToMemberships() {
  router.push("/admin/memberships")
}

function goToConfig() {
  router.push("/admin/config")
}

function goToSales() {
  router.push("/sales")
}

function goToSchedules() {
  router.push("/admin/schedules")
}
</script>

<template>
  <div class="admin-container">
    <div class="admin-header">
      <div class="header-left">
        <img src="/logo.png" alt="Rheb Logo" class="logo-small" />
        <div>
          <h1>Panel Administrador</h1>
          <p class="admin-badge">ADMIN</p>
        </div>
      </div>
      <div class="header-actions">
        <ThemeToggle />
        <button @click="logout" class="logout-button">Cerrar Sesión</button>
      </div>
    </div>

    <div class="admin-content">
      <div class="welcome-card">
        <h2>¡Bienvenido, {{ user?.nombre || user?.name || 'Administrador' }}!</h2>
        <p>Gestiona entrenadores y configuraciones del gimnasio.</p>
        <div class="welcome-actions">
          <button v-if="user?.linkedTrainerId" @click="goToTrainer" class="switch-role-button">
            Ir a Entrenador
          </button>
          <button v-else @click="openTrainerModal" class="switch-role-button">
            Crear mi usuario entrenador
          </button>
        </div>
      </div>

      <div class="cards-grid">
        <div class="card" @click="goToEntrenadores">
          <div class="card-icon">👥</div>
          <h3>Entrenadores</h3>
          <p>Visualiza entrenadores y sus alumnos</p>
        </div>

        <div class="card" @click="goToUsers">
          <div class="card-icon">👤</div>
          <h3>Gestión de Usuarios</h3>
          <p>Administra miembros y sus perfiles</p>
        </div>

        <div class="card disabled">
          <div class="card-icon">📋</div>
          <h3>Rutinas y Planes</h3>
          <p>Crea y edita rutinas de entrenamiento</p>
          <span class="coming-soon">Próximamente</span>
        </div>

        <div class="card" @click="goToStats">
          <div class="card-icon">📊</div>
          <h3>Estadísticas</h3>
          <p>Visualiza métricas y reportes del gimnasio</p>
        </div>

        <div class="card" @click="goToExpenses">
          <div class="card-icon">ðŸ§¾</div>
          <h3>Gastos</h3>
          <p>RegistrÃ¡ egresos mensuales con detalle y fecha</p>
        </div>

        <div class="card" @click="goToMemberships">
          <div class="card-icon">💳</div>
          <h3>Pagos y Membresías</h3>
          <p>Configura planes, precios y revisa pagos</p>
        </div>

        <div class="card" @click="goToSchedules">
          <div class="card-icon">📅</div>
          <h3>Horarios y Clases</h3>
          <p>Configura horarios y clases disponibles</p>
        </div>

        <div class="card" @click="goToConfig">
          <div class="card-icon">⚙️</div>
          <h3>Configuración</h3>
          <p>Ajustes generales del sistema</p>
        </div>

        <div class="card" @click="goToSales">
          <div class="card-icon">🛒</div>
          <h3>Ventas y Stock</h3>
          <p>Gestionar productos y ventas</p>
        </div>
      </div>
    </div>

    <div v-if="showTrainerModal" class="modal-overlay" @click.self="closeTrainerModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Crear usuario entrenador vinculado</h2>
          <button @click="closeTrainerModal" class="close-button">×</button>
        </div>

        <div class="modal-form">
          <div class="form-group">
            <label for="trainer-username">Usuario *</label>
            <input id="trainer-username" v-model="trainerForm.username" type="text" placeholder="usuario.entrenador" />
          </div>

          <div class="form-group">
            <label for="trainer-password">Contraseña *</label>
            <input id="trainer-password" v-model="trainerForm.password" type="password" placeholder="Contraseña" />
          </div>

          <div class="form-group">
            <label for="trainer-name">Nombre *</label>
            <input id="trainer-name" v-model="trainerForm.nombre" type="text" placeholder="Nombre visible del entrenador" />
          </div>

          <div v-if="trainerError" class="error-message">{{ trainerError }}</div>

          <div class="modal-actions">
            <button type="button" class="cancel-button" @click="closeTrainerModal">Cancelar</button>
            <button type="button" class="submit-button" :disabled="isSavingTrainer" @click="createLinkedTrainer">
              {{ isSavingTrainer ? "Creando..." : "Crear y vincular" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-container {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--page-bg);
  padding: 20px;
  padding-bottom: 40px;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-small {
  width: 50px;
  height: 50px;
}

.admin-header h1 {
  color: var(--header-text);
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
}

.admin-badge {
  background: linear-gradient(135deg, var(--rheb-primary-green) 0%, #FFA500 100%);
  color: var(--rheb-black);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  margin: 4px 0 0 0;
  display: inline-block;
  border: 1px solid var(--rheb-black);
}

.logout-button {
  background-color: var(--rheb-dark-grey);
  color: var(--rheb-primary-green);
  border: 2px solid var(--rheb-black);
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  min-height: 44px;
}

.logout-button:active {
  transform: scale(0.98);
  background-color: #3A3A3A;
}

.admin-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.welcome-card {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 2px solid var(--rheb-primary-green);
}

.welcome-card h2 {
  color: var(--header-text);
  font-size: 1.5rem;
  margin: 0 0 8px 0;
}

.welcome-card p {
  color: var(--subtitle-text);
  margin: 0;
  font-size: 1rem;
}

.welcome-actions {
  margin-top: 18px;
}

.switch-role-button {
  background: linear-gradient(135deg, var(--rheb-primary-green) 0%, #0f766e 100%);
  color: white;
}

.cards-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.card {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 2px solid transparent;
  transition: all 0.2s;
  cursor: pointer;
}

.card:active {
  transform: scale(0.98);
  border-color: var(--rheb-primary-green);
}

.card-icon {
  font-size: 2.5rem;
  margin-bottom: 12px;
}

.card h3 {
  color: var(--header-text);
  font-size: 1.1rem;
  margin: 0 0 8px 0;
  font-weight: 600;
}

.card p {
  color: var(--subtitle-text);
  font-size: 0.9rem;
  margin: 0;
  line-height: 1.4;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
}

.modal-content {
  width: min(100%, 460px);
  background: var(--card-bg);
  border: 2px solid var(--card-border);
  border-radius: 18px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.modal-header {
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--input-border);
}

.modal-header h2 {
  margin: 0;
  color: var(--header-text);
  font-size: 1.1rem;
}

.close-button {
  background: transparent;
  color: var(--header-text);
  box-shadow: none;
  font-size: 1.4rem;
  padding: 0;
  min-height: 0;
}

.modal-form {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  color: var(--header-text);
  font-weight: 700;
}

.form-group input {
  padding: 12px 14px;
  border-radius: 10px;
  border: 2px solid var(--input-border);
  background: var(--input-bg);
  color: var(--header-text);
}

.error-message {
  background: #fee2e2;
  color: #b91c1c;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 0.92rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cancel-button {
  background: transparent;
  color: var(--header-text);
  border: 2px solid var(--input-border);
}

.submit-button {
  background: var(--primary-btn-bg);
  color: var(--primary-btn-text);
}

.card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  position: relative;
}

.card.disabled:active {
  transform: none;
  border-color: transparent;
}

.coming-soon {
  display: inline-block;
  background: var(--potenza-grey-green);
  color: white;
  font-size: 0.7rem;
  padding: 4px 8px;
  border-radius: 6px;
  margin-top: 8px;
  font-weight: 600;
}

@media (min-width: 480px) {
  .cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
  
