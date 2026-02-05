<script setup>
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"
import ThemeToggle from "../components/ThemeToggle.vue"

const router = useRouter()
const user = ref(null)

onMounted(() => {
  const userStr = localStorage.getItem("user")
  if (userStr) {
    user.value = JSON.parse(userStr)
  } else {
    router.push("/")
  }
})

function logout() {
  localStorage.removeItem("user")
  router.push("/")
}

function goToAlumnos() {
  router.push("/alumnos")
}

function goToSales() {
  router.push("/sales")
}
</script>

<template>
  <div class="dashboard-container">
    <div class="dashboard-header">
      <div class="header-left">
        <img src="/logo.svg" alt="Potenza Gym Logo" class="logo-small" />
        <div>
          <h1>Mi Panel</h1>
          <p class="user-name" v-if="user">{{ user.name }}</p>
        </div>
      </div>
      <div class="header-actions">
        <ThemeToggle />
        <button @click="logout" class="logout-button">Cerrar Sesión</button>
      </div>
    </div>

    <div class="dashboard-content">
      <div class="welcome-card">
        <h2>¡Bienvenido, {{ user?.nombre || user?.name || 'a Potenza Gym' }}!</h2>
        <p>Gestiona tus entrenamientos y rutinas desde aquí.</p>
      </div>

      <div class="cards-grid">
        <div class="card" :class="{ 'disabled': user?.role === 'entrenador' }">
          <div class="card-icon">💪</div>
          <h3>Mis Rutinas</h3>
          <p>Consulta y sigue tus rutinas de entrenamiento</p>
        </div>

        <div class="card" @click="goToAlumnos">
          <div class="card-icon">👥</div>
          <h3>Alumnos</h3>
          <p>Gestiona tus alumnos y sus pagos</p>
        </div>

        <div class="card" @click="goToSales">
          <div class="card-icon">🛒</div>
          <h3>Ventas</h3>
          <p>Kiosco y venta de productos</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-container {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--page-bg);
  padding: 20px;
  padding-bottom: 40px;
}

.dashboard-header {
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

.dashboard-header h1 {
  color: var(--header-text);
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
}

.user-name {
  color: var(--subtitle-text);
  font-size: 0.9rem;
  margin: 4px 0 0 0;
  font-weight: 500;
}

.logout-button {
  background-color: var(--potenza-dark-grey);
  color: var(--potenza-yellow);
  border: 2px solid var(--potenza-black);
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

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.welcome-card {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 2px solid var(--potenza-yellow);
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
  border-color: var(--potenza-yellow);
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

@media (min-width: 480px) {
  .cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
  filter: grayscale(1);
}
</style>