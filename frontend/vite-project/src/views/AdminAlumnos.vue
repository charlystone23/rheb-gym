<script setup>
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"
import { MongoService } from "../services/mongoService"

const router = useRouter()
const entrenadores = ref([])
const isLoading = ref(false)
const error = ref("")
const expandedTrainers = ref({})

onMounted(async () => {
  try {
    isLoading.value = true
    const data = await MongoService.getEntrenadores()
    entrenadores.value = data || []
  } catch (e) {
    console.error("Error loading entrenadores:", e)
    error.value = "Error al cargar entrenadores"
  } finally {
    isLoading.value = false
  }
})

function getUltimoPago(alumno) {
  if (!alumno.historialPagos || alumno.historialPagos.length === 0) {
    return null
  }
  const pagosOrdenados = [...alumno.historialPagos].sort((a, b) => 
    new Date(b.fecha) - new Date(a.fecha)
  )
  return pagosOrdenados[0]
}

function getPaymentStatus(alumno) {
  const ultimoPago = getUltimoPago(alumno)
  if (!ultimoPago) return "red"
  
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  
  const fechaPagoDate = new Date(ultimoPago.fecha)
  fechaPagoDate.setHours(0, 0, 0, 0)
  
  const proximaFechaPago = new Date(fechaPagoDate)
  proximaFechaPago.setDate(proximaFechaPago.getDate() + 30)
  
  const diasHastaPago = Math.ceil((proximaFechaPago - hoy) / (1000 * 60 * 60 * 24))
  
  if (diasHastaPago < 0) {
    return "red"
  } else if (diasHastaPago <= 5) {
    return "yellow"
  } else {
    return "green"
  }
}

function formatDate(date) {
  const fecha = new Date(date)
  const dia = String(fecha.getDate()).padStart(2, '0')
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const año = fecha.getFullYear()
  return `${dia}/${mes}/${año}`
}

function getDaysUntilPayment(alumno) {
  const ultimoPago = getUltimoPago(alumno)
  if (!ultimoPago) return -999
  
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  
  const fechaPago = new Date(ultimoPago.fecha)
  const proximaFecha = new Date(fechaPago)
  proximaFecha.setDate(proximaFecha.getDate() + 30)
  
  const dias = Math.ceil((proximaFecha - hoy) / (1000 * 60 * 60 * 24))
  return dias
}

function goBack() {
  router.push("/admin")
}

function toggleTrainer(trainerId) {
  expandedTrainers.value[trainerId] = !expandedTrainers.value[trainerId]
}

function isTrainerExpanded(trainerId) {
  return expandedTrainers.value[trainerId] || false
}
</script>

<template>
  <div class="admin-alumnos-container">
    <div class="admin-alumnos-header">
      <div class="header-left">
        <button @click="goBack" class="back-button">←</button>
        <img src="/logo.svg" alt="Potenza Gym Logo" class="logo-small" />
        <div>
          <h1>Entrenadores</h1>
          <p class="subtitle">Visualiza los entrenadores y sus alumnos</p>
        </div>
      </div>
    </div>

    <div class="admin-alumnos-content">
      <div class="legend">
        <div class="legend-item">
          <div class="status-indicator green"></div>
          <span>Al día</span>
        </div>
        <div class="legend-item">
          <div class="status-indicator yellow"></div>
          <span>Próximo pago (5 días)</span>
        </div>
        <div class="legend-item">
          <div class="status-indicator red"></div>
          <span>Pago retrasado</span>
        </div>
      </div>

      <div class="entrenadores-list">
        <div 
          v-for="entrenador in entrenadores" 
          :key="entrenador.id" 
          class="entrenador-card"
        >
          <div class="entrenador-header">
            <div class="entrenador-info">
              <h2>{{ entrenador.nombre }} {{ entrenador.apellido }}</h2>
              <p class="entrenador-email">{{ entrenador.username }}</p>
              <p class="alumnos-count">{{ entrenador.alumnos.length }} alumno(s)</p>
            </div>
            <button @click="toggleTrainer(entrenador._id)" class="toggle-button">
              {{ isTrainerExpanded(entrenador._id) ? 'Ocultar' : 'Ver' }} Alumnos
            </button>
          </div>

          <div class="alumnos-section" v-if="isTrainerExpanded(entrenador._id)">
            <div 
              v-for="alumno in entrenador.alumnos" 
              :key="alumno.id" 
              class="alumno-item"
            >
              <div class="alumno-details">
                <h3>{{ alumno.nombre }} {{ alumno.apellido }}</h3>
                <div class="alumno-payment-info">
                  <p v-if="alumno.celular" class="alumno-phone">📱 {{ alumno.celular }}</p>
                  <p v-if="getUltimoPago(alumno)" class="payment-info">
                    Último pago: {{ formatDate(getUltimoPago(alumno).fecha) }} 
                    <span class="payment-type">({{ getUltimoPago(alumno).tipo }})</span>
                  </p>
                  <p v-else class="payment-info">Sin pagos registrados</p>
                </div>
              </div>
              <div class="status-container">
                <div 
                  :class="['status-light', getPaymentStatus(alumno)]"
                  :title="getPaymentStatus(alumno) === 'red' 
                    ? 'Pago retrasado' 
                    : getPaymentStatus(alumno) === 'yellow' 
                    ? `Próximo pago en ${getDaysUntilPayment(alumno)} días`
                    : 'Pago al día'"
                ></div>
                <span class="days-info" v-if="getPaymentStatus(alumno) !== 'green'">
                  {{ getDaysUntilPayment(alumno) < 0 
                    ? `${Math.abs(getDaysUntilPayment(alumno))} días de retraso`
                    : `${getDaysUntilPayment(alumno)} días` }}
                </span>
              </div>
            </div>

            <div v-if="entrenador.alumnos.length === 0" class="no-alumnos">
              <p>Este entrenador no tiene alumnos asignados</p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="entrenadores.length === 0" class="empty-state">
        <p>No hay entrenadores registrados</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-alumnos-container {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--page-bg);
  padding: 20px;
  padding-bottom: 40px;
}

.admin-alumnos-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-button {
  background-color: var(--rheb-dark-grey);
  color: var(--rheb-primary-green);
  border: 2px solid var(--rheb-black);
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 1.2rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  min-height: 44px;
  min-width: 44px;
}

.back-button:active {
  transform: scale(0.98);
  background-color: #3A3A3A;
}

.logo-small {
  width: 50px;
  height: 50px;
}

.admin-alumnos-header h1 {
  color: var(--header-text);
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
}

.subtitle {
  color: var(--subtitle-text);
  font-size: 0.9rem;
  margin: 4px 0 0 0;
  font-weight: 500;
}

.create-button {
  background: linear-gradient(135deg, var(--rheb-primary-green) 0%, #FFA500 100%);
  color: var(--rheb-dark-grey);
  border: 2px solid var(--rheb-black);
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  min-height: 44px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
}

.create-button:active {
  transform: scale(0.98);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.admin-alumnos-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.legend {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 2px solid var(--rheb-primary-green);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--header-text);
}

.status-indicator {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--rheb-black);
}

.status-indicator.green {
  background-color: #22c55e;
}

.status-indicator.yellow {
  background-color: #eab308;
}

.status-indicator.red {
  background-color: #ef4444;
}

.entrenadores-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.entrenador-card {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 2px solid var(--rheb-primary-green);
}

.entrenador-header {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--rheb-primary-green);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.entrenador-info {
  flex: 1;
}

.toggle-button {
  background-color: var(--rheb-dark-grey);
  color: var(--rheb-primary-green);
  border: 2px solid var(--rheb-black);
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  min-height: 44px;
  white-space: nowrap;
}

.toggle-button:active {
  transform: scale(0.98);
  background-color: #3A3A3A;
}

.entrenador-info h2 {
  color: var(--header-text);
  font-size: 1.5rem;
  margin: 0 0 8px 0;
  font-weight: 700;
}

.entrenador-email {
  color: var(--subtitle-text);
  font-size: 0.9rem;
  margin: 0 0 8px 0;
}

.alumnos-count {
  color: var(--header-text);
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0;
}

.alumnos-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.alumno-item {
  background: var(--input-bg);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  border: 1px solid var(--input-border);
}

.alumno-details {
  flex: 1;
}

.alumno-details h3 {
  color: var(--header-text);
  font-size: 1.1rem;
  margin: 0 0 8px 0;
  font-weight: 600;
}

.payment-info {
  color: var(--subtitle-text);
  font-size: 0.85rem;
  margin: 0;
}

.payment-type {
  color: var(--header-text);
  text-transform: capitalize;
  font-weight: 500;
}

.alumno-phone {
  color: var(--header-text);
  font-size: 0.9rem;
  margin: 0 0 4px 0;
  font-weight: 500;
}

.status-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 100px;
}

.status-light {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid var(--rheb-black);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.status-light.green {
  background-color: #22c55e;
}

.status-light.yellow {
  background-color: #eab308;
}

.status-light.red {
  background-color: #ef4444;
}

.days-info {
  font-size: 0.75rem;
  color: var(--header-text);
  font-weight: 600;
  text-align: center;
}

.no-alumnos {
  text-align: center;
  padding: 20px;
  color: var(--subtitle-text);
  font-size: 0.9rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  border: 2px solid var(--rheb-primary-green);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-header h2 {
  color: var(--header-text);
  font-size: 1.5rem;
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: var(--header-text);
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--header-text);
}

.form-group input,
.form-group select {
  padding: 12px;
  border: 2px solid var(--input-border);
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--rheb-primary-green);
}

.error-message {
  background-color: #fee2e2;
  color: #dc2626;
  padding: 12px;
  border-radius: 8px;
  font-size: 0.875rem;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.cancel-button,
.submit-button {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid var(--rheb-black);
  min-height: 48px;
}

.cancel-button {
  background-color: var(--card-bg);
  color: var(--header-text);
}

.cancel-button:active {
  transform: scale(0.98);
  background-color: #f3f4f6;
}

.submit-button {
  background: linear-gradient(135deg, var(--rheb-primary-green) 0%, #FFA500 100%);
  color: var(--rheb-dark-grey);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.submit-button:active:not(:disabled) {
  transform: scale(0.98);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.empty-state {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  color: var(--subtitle-text);
  font-size: 1rem;
  border: 2px solid var(--rheb-primary-green);
}
</style>
