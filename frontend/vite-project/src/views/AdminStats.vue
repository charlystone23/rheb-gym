<script setup>
import { ref, onMounted, computed } from "vue"
import { useRouter } from "vue-router"
import { MongoService } from "../services/mongoService"

const router = useRouter()
const entrenadores = ref([])
const isLoading = ref(false)
const error = ref("")

// Filtros Globales
const hoy = new Date()
const selectedMonth = ref(hoy.getMonth())
const selectedYear = ref(hoy.getFullYear())

const meses = [
  { val: 0, label: "Enero" }, { val: 1, label: "Febrero" }, { val: 2, label: "Marzo" },
  { val: 3, label: "Abril" }, { val: 4, label: "Mayo" }, { val: 5, label: "Junio" },
  { val: 6, label: "Julio" }, { val: 7, label: "Agosto" }, { val: 8, label: "Septiembre" },
  { val: 9, label: "Octubre" }, { val: 10, label: "Noviembre" }, { val: 11, label: "Diciembre" }
]

// Rango de fechas por entrenador (inicializar con mes actual)
const firstDay = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
const lastDay = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0]
const trainerFilters = ref({}) // { trainerId: { start, end } }

onMounted(async () => {
  try {
    isLoading.value = true
    const data = await MongoService.getEntrenadores()
    entrenadores.value = data || []
  } catch (e) {
    console.error("Error loading stats:", e)
    error.value = "Error al cargar estadísticas"
  } finally {
    isLoading.value = false
  }
})

function getUltimoPago(alumno) {
  if (!alumno.historialPagos || alumno.historialPagos.length === 0) return null
  return [...alumno.historialPagos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0]
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
  
  if (proximaFechaPago < hoy) return "red"
  
  const diffTime = proximaFechaPago - hoy
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays <= 5) return "yellow"
  return "green"
}

const statsPorEntrenador = computed(() => {
  return entrenadores.value.map(entrenador => {
    const totalAlumnos = entrenador.alumnos.length
    const alDia = entrenador.alumnos.filter(a => getPaymentStatus(a) === 'green').length
    const proximoVencer = entrenador.alumnos.filter(a => getPaymentStatus(a) === 'yellow').length
    const deuda = entrenador.alumnos.filter(a => getPaymentStatus(a) === 'red').length
    
    // Obtener filtros del entrenador o usar default
    const filter = trainerFilters.value[entrenador._id] || { start: firstDay, end: lastDay }
    const startDate = new Date(filter.start)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(filter.end)
    endDate.setHours(23, 59, 59, 999)

    // Calcular saldo histórico en el rango seleccionado
    let saldoHistorico = 0
    entrenador.alumnos.forEach(alumno => {
      alumno.historialPagos.forEach(pago => {
        const fechaPago = new Date(pago.fecha)
        if (fechaPago >= startDate && fechaPago <= endDate) {
          saldoHistorico += (pago.monto || 0)
        }
      })
    })
    
    return {
      id: entrenador._id,
      nombre: `${entrenador.nombre} ${entrenador.apellido || ''}`,
      total: totalAlumnos,
      alDia,
      proximoVencer,
      deuda,
      saldoHistorico,
      porcentajeActivos: totalAlumnos > 0 ? Math.round(((alDia + proximoVencer) / totalAlumnos) * 100) : 0
    }
  })
})

const statsGenerales = computed(() => {
  if (statsPorEntrenador.value.length === 0) return null
  
  const totalAlumnos = statsPorEntrenador.value.reduce((acc, s) => acc + s.total, 0)
  const alDia = statsPorEntrenador.value.reduce((acc, s) => acc + s.alDia, 0)
  const proximoVencer = statsPorEntrenador.value.reduce((acc, s) => acc + s.proximoVencer, 0)
  const deuda = statsPorEntrenador.value.reduce((acc, s) => acc + s.deuda, 0)
  
  // Calcular recaudación del mes seleccionado (pagos cuya fecha cae en ese mes)
  let recaudacionMes = 0
  entrenadores.value.forEach(entrenador => {
    entrenador.alumnos.forEach(alumno => {
      alumno.historialPagos.forEach(pago => {
        const fechaPago = new Date(pago.fecha)
        if (fechaPago.getMonth() === selectedMonth.value && fechaPago.getFullYear() === selectedYear.value) {
          recaudacionMes += (pago.monto || 0)
        }
      })
    })
  })
  
  return {
    totalAlumnos,
    alDia,
    proximoVencer,
    deuda,
    recaudacionMes,
    porcentajeActivos: totalAlumnos > 0 ? Math.round(((alDia + proximoVencer) / totalAlumnos) * 100) : 0
  }
})

function updateTrainerFilter(trainerId, field, value) {
  if (!trainerFilters.value[trainerId]) {
    trainerFilters.value[trainerId] = { start: firstDay, end: lastDay }
  }
  trainerFilters.value[trainerId][field] = value
}

function goBack() {
  router.push("/admin")
}
</script>

<template>
  <div class="admin-stats-container">
    <div class="admin-stats-header">
      <div class="header-left">
        <button @click="goBack" class="back-button">←</button>
        <img src="/logo.svg" alt="Potenza Gym Logo" class="logo-small" />
        <div>
          <h1>Estadísticas</h1>
          <p class="subtitle">Métricas de rendimiento por entrenador</p>
        </div>
      </div>
      
      <!-- Selector de Mes Global -->
      <div class="header-filters">
        <label for="month-select">Mes de Recaudación:</label>
        <select id="month-select" v-model="selectedMonth" class="filter-select">
          <option v-for="m in meses" :key="m.val" :value="m.val">{{ m.label }}</option>
        </select>
        <select v-model="selectedYear" class="filter-select">
          <option v-for="y in [2024, 2025, 2026]" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
    </div>

    <div v-if="isLoading" class="loading">Cargando estadísticas...</div>
    <div v-else-if="error" class="error-msg">{{ error }}</div>
    
    <div v-else class="admin-stats-content">
      <!-- Resumen General -->
      <div class="stats-summary" v-if="statsGenerales">
        <div class="summary-card total">
          <span class="label">Total Alumnos</span>
          <span class="value">{{ statsGenerales.totalAlumnos }}</span>
        </div>
        <div class="summary-card active">
          <span class="label">Al Día</span>
          <span class="value">{{ statsGenerales.alDia }}</span>
        </div>
        <div class="summary-card warning">
          <span class="label">A Vencer</span>
          <span class="value">{{ statsGenerales.proximoVencer }}</span>
        </div>
        <div class="summary-card danger">
          <span class="label">En Deuda</span>
          <span class="value">{{ statsGenerales.deuda }}</span>
        </div>
        <div class="summary-card revenue">
          <span class="label">Recaudación Mes</span>
          <span class="value">${{ statsGenerales.recaudacionMes.toLocaleString() }}</span>
        </div>
      </div>

      <!-- Detalle por Entrenador -->
      <div class="trainer-stats-grid">
        <div v-for="stat in statsPorEntrenador" :key="stat.id" class="trainer-stat-card">
          <div class="card-header">
            <h3>{{ stat.nombre }}</h3>
            <div class="activos-badge">{{ stat.porcentajeActivos }}% Activos</div>
          </div>

          <!-- Filtro de Fecha por Entrenador -->
          <div class="trainer-date-filter">
            <div class="date-input-group">
              <label>Desde:</label>
              <input 
                type="date" 
                :value="trainerFilters[stat.id]?.start || firstDay" 
                @input="e => updateTrainerFilter(stat.id, 'start', e.target.value)"
              >
            </div>
            <div class="date-input-group">
              <label>Hasta:</label>
              <input 
                type="date" 
                :value="trainerFilters[stat.id]?.end || lastDay" 
                @input="e => updateTrainerFilter(stat.id, 'end', e.target.value)"
              >
            </div>
          </div>

          <div class="saldo-display">
            <span class="saldo-label">Saldo en periodo:</span>
            <span class="saldo-value">${{ stat.saldoHistorico.toLocaleString() }}</span>
          </div>
          
          <div class="stat-rows">
            <div class="stat-row">
              <span>Total Alumnos:</span>
              <span class="stat-val">{{ stat.total }}</span>
            </div>
            <div class="stat-row green-text">
              <span>Al Día:</span>
              <span class="stat-val">{{ stat.alDia }}</span>
            </div>
            <div class="stat-row yellow-text">
              <span>Próximos:</span>
              <span class="stat-val">{{ stat.proximoVencer }}</span>
            </div>
            <div class="stat-row red-text">
              <span>Morosos:</span>
              <span class="stat-val">{{ stat.deuda }}</span>
            </div>
          </div>

          <div class="progress-bar-container">
            <div class="progress-bar">
              <div 
                class="progress-fill green" 
                :style="{ width: (stat.total > 0 ? (stat.alDia / stat.total) * 100 : 0) + '%' }"
              ></div>
              <div 
                class="progress-fill yellow" 
                :style="{ width: (stat.total > 0 ? (stat.proximoVencer / stat.total) * 100 : 0) + '%' }"
              ></div>
              <div 
                class="progress-fill red" 
                :style="{ width: (stat.total > 0 ? (stat.deuda / stat.total) * 100 : 0) + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-stats-container {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--page-bg);
  padding: 20px;
  padding-bottom: 40px;
}

.admin-stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 20px;
}

.header-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--card-bg);
  padding: 10px 16px;
  border-radius: 10px;
  border: 2px solid var(--rheb-primary-green);
}

.header-filters label {
  font-weight: 700;
  color: var(--header-text);
  font-size: 0.9rem;
}

.filter-select {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--input-border);
  font-weight: 600;
  color: var(--header-text);
  background: var(--input-bg);
  outline: none;
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
  padding: 8px 12px;
  font-size: 1.2rem;
  font-weight: 700;
  cursor: pointer;
}

.logo-small {
  width: 50px;
  height: 50px;
}

.admin-stats-header h1 {
  color: var(--header-text);
  font-size: 1.75rem;
  margin: 0;
}

.subtitle {
  color: var(--subtitle-text);
  font-size: 0.9rem;
  margin: 4px 0 0 0;
}

.stats-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.summary-card {
  background: var(--card-bg);
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  border-bottom: 4px solid var(--input-border);
}

.summary-card.total { border-color: var(--rheb-dark-grey); }
.summary-card.active { border-color: #22c55e; }
.summary-card.warning { border-color: #eab308; }
.summary-card.danger { border-color: #ef4444; }
.summary-card.revenue { 
  border-color: var(--rheb-primary-green); 
  background: var(--input-bg);
}
.summary-card.revenue .label { color: var(--rheb-primary-green); }
.summary-card.revenue .value { color: var(--header-text); }

.summary-card .label {
  font-size: 0.8rem;
  color: var(--subtitle-text);
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 4px;
}

.summary-card .value {
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--header-text);
}

.trainer-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.trainer-stat-card {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  border: 2px solid var(--rheb-primary-green);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  border-bottom: 1px solid #eee;
  padding-bottom: 12px;
}

.card-header h3 {
  margin: 0;
  color: var(--header-text);
}

.activos-badge {
  background: var(--rheb-dark-grey);
  color: var(--rheb-primary-green);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
}

.trainer-date-filter {
  margin: 16px 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
  background: var(--input-bg);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--input-border);
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
}

.date-input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.date-input-group label {
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--subtitle-text);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.date-input-group input {
  padding: 10px 12px;
  border: 2px solid var(--input-border);
  border-radius: 8px;
  font-size: 0.85rem;
  color: var(--header-text);
  font-family: inherit;
  font-weight: 600;
  background: var(--card-bg);
  transition: all 0.2s ease;
  cursor: pointer;
  width: 100%;
  box-sizing: border-box;
  max-width: 100%;
}

.date-input-group input:focus {
  outline: none;
  border-color: var(--rheb-primary-green);
  box-shadow: 0 0 0 4px rgba(255, 215, 0, 0.1);
  background: white;
}

.date-input-group input:hover {
  border-color: #cbd5e1;
}

.saldo-display {
  background: var(--rheb-dark-grey);
  color: var(--rheb-primary-green);
  padding: 12px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.saldo-label {
  font-size: 0.85rem;
  font-weight: 600;
}

.saldo-value {
  font-size: 1.25rem;
  font-weight: 800;
}

.stat-rows {
  margin-bottom: 20px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 0.95rem;
}

.stat-val {
  font-weight: 700;
}

.green-text { color: #22c55e; }
.yellow-text { color: #eab308; }
.red-text { color: #ef4444; }

.progress-bar-container {
  height: 12px;
  background: #eee;
  border-radius: 6px;
  overflow: hidden;
}

.progress-bar {
  display: flex;
  height: 100%;
}

.progress-fill {
  height: 100%;
}

.progress-fill.green { background-color: #22c55e; }
.progress-fill.yellow { background-color: #eab308; }
.progress-fill.red { background-color: #ef4444; }

.loading, .error-msg {
  text-align: center;
  padding: 40px;
  font-size: 1.2rem;
}
</style>
