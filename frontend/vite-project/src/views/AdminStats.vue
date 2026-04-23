<script setup>
import { ref, onMounted, computed, watch } from "vue"
import { useRouter } from "vue-router"
import DateField from "../components/DateField.vue"
import { MongoService } from "../services/mongoService"
import { formatDateAR, formatDateInput, getMonthRangeDisplay, parseDisplayDate } from "../utils/date"
import { getStoredUser } from "../utils/authContext"

const router = useRouter()
const entrenadores = ref([])
const expenses = ref([])
const isLoading = ref(false)
const error = ref("")
const currentUser = ref(null)

const hoy = new Date()
const selectedMonth = ref(hoy.getMonth())
const selectedYear = ref(hoy.getFullYear())

const meses = [
  { val: 0, label: "Enero" }, { val: 1, label: "Febrero" }, { val: 2, label: "Marzo" },
  { val: 3, label: "Abril" }, { val: 4, label: "Mayo" }, { val: 5, label: "Junio" },
  { val: 6, label: "Julio" }, { val: 7, label: "Agosto" }, { val: 8, label: "Septiembre" },
  { val: 9, label: "Octubre" }, { val: 10, label: "Noviembre" }, { val: 11, label: "Diciembre" }
]

const trainerFilters = ref({})

const globalDateRange = computed(() => {
  return getMonthRangeDisplay(selectedYear.value, selectedMonth.value)
})

function syncTrainerFiltersWithGlobalRange() {
  const nextFilters = {}

  entrenadores.value.forEach((entrenador) => {
    nextFilters[entrenador._id] = {
      start: globalDateRange.value.start,
      end: globalDateRange.value.end
    }
  })

  trainerFilters.value = nextFilters
}

onMounted(async () => {
  await loadStatsData()
})

watch([selectedMonth, selectedYear], async () => {
  syncTrainerFiltersWithGlobalRange()
  await loadExpenses()
})

async function loadStatsData() {
  try {
    isLoading.value = true
    currentUser.value = getStoredUser()
    const [trainersData, expensesData] = await Promise.all([
      MongoService.getEntrenadores(true),
      MongoService.getExpenses(selectedMonth.value + 1, selectedYear.value)
    ])

    entrenadores.value = trainersData || []
    expenses.value = expensesData || []
    syncTrainerFiltersWithGlobalRange()
  } catch (e) {
    console.error("Error loading stats:", e)
    error.value = "Error al cargar estadísticas"
  } finally {
    isLoading.value = false
  }
}

async function loadExpenses() {
  try {
    expenses.value = await MongoService.getExpenses(selectedMonth.value + 1, selectedYear.value)
  } catch (e) {
    console.error("Error loading expenses:", e)
    error.value = "No se pudieron cargar los gastos del mes."
  }
}

const entrenadoresVisibles = computed(() => {
  if (!currentUser.value?.linkedTrainerId) {
    return entrenadores.value
  }

  return entrenadores.value.filter((entrenador) => {
    if (entrenador._id !== currentUser.value.linkedTrainerId) {
      return true
    }

    return entrenador.includeInAdminStats !== false
  })
})

function getUltimoPago(alumno) {
  if (!alumno.historialPagos || alumno.historialPagos.length === 0) return null
  return [...alumno.historialPagos].sort(comparePagosDesc)[0]
}

function getUltimoPagoHastaFecha(alumno, referenceDate) {
  if (!alumno.historialPagos || alumno.historialPagos.length === 0) return null

  return [...alumno.historialPagos]
    .filter((pago) => new Date(pago.fecha) <= referenceDate)
    .sort(comparePagosDesc)[0] || null
}

function isPromisePayment(tipo) {
  const normalized = String(tipo || "").trim().toLowerCase()
  return normalized === "promesa de pago" || normalized === "promesa_pago"
}

function comparePagosDesc(a, b) {
  const fechaDiff = new Date(b.fecha) - new Date(a.fecha)
  if (fechaDiff !== 0) return fechaDiff

  const createdDiff = new Date(b.createdAt || b.clientCreatedAt || 0) - new Date(a.createdAt || a.clientCreatedAt || 0)
  if (createdDiff !== 0) return createdDiff

  if (a.completaParcial && !b.completaParcial) return -1
  if (b.completaParcial && !a.completaParcial) return 1
  if (a.esParcial && !b.esParcial) return 1
  if (b.esParcial && !a.esParcial) return -1

  return 0
}

function hasPendingPartialPayment(alumno, referenceDate = new Date()) {
  const ultimoPago = getUltimoPagoHastaFecha(alumno, referenceDate)
  return Boolean(ultimoPago?.esParcial && Number(ultimoPago?.saldoPendiente || 0) > 0)
}

function getPaymentAmount(pago) {
  if (!pago) return 0
  if (typeof pago.monto === "number") return pago.monto
  return Number(pago.monto || pago.membresia?.precio || 0)
}

function getEstimatedAmountForAlumno(alumno, referenceDate = new Date()) {
  const ultimoPago = getUltimoPagoHastaFecha(alumno, referenceDate)
  if (!ultimoPago) return 0

  if (typeof ultimoPago.montoObjetivo === "number" && ultimoPago.montoObjetivo > 0) {
    return ultimoPago.montoObjetivo
  }

  if (typeof ultimoPago.membresia?.precio === "number" && ultimoPago.membresia.precio > 0) {
    return ultimoPago.membresia.precio
  }

  return getPaymentAmount(ultimoPago)
}

function getPaymentStatus(alumno, referenceDate = new Date()) {
  const ultimoPago = getUltimoPagoHastaFecha(alumno, referenceDate)
  if (ultimoPago && (isPromisePayment(ultimoPago.tipo || ultimoPago.detalle) || hasPendingPartialPayment(alumno, referenceDate))) {
    return "red"
  }

  const today = new Date(referenceDate)
  today.setHours(0, 0, 0, 0)

  let nextPaymentDate = new Date()
  if (!ultimoPago) {
    nextPaymentDate = new Date(alumno.fechaRegistro || alumno.createdAt || today)
  } else {
    nextPaymentDate = new Date(ultimoPago.fecha)
    nextPaymentDate.setDate(nextPaymentDate.getDate() + 30)
  }
  nextPaymentDate.setHours(0, 0, 0, 0)

  const diffTime = nextPaymentDate - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return "red"
  if (diffDays <= 5) return "yellow"
  return "green"
}

function getMonthBounds(year, month) {
  const start = new Date(year, month, 1)
  start.setHours(0, 0, 0, 0)

  const end = new Date(year, month + 1, 0)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

function wasAlumnoActiveInRange(alumno, startDate, endDate) {
  if (Array.isArray(alumno.periodosActividad) && alumno.periodosActividad.length > 0) {
    return alumno.periodosActividad.some((periodo) => {
      const inicio = new Date(periodo.inicio)
      inicio.setHours(0, 0, 0, 0)

      const fin = periodo.fin ? new Date(periodo.fin) : null
      if (fin) {
        fin.setHours(23, 59, 59, 999)
      }

      return inicio <= endDate && (!fin || fin >= startDate)
    })
  }

  const fechaAlta = new Date(alumno.fechaRegistro || alumno.createdAt || endDate)
  fechaAlta.setHours(0, 0, 0, 0)

  const fechaInactivacion = alumno.fechaInactivacion ? new Date(alumno.fechaInactivacion) : null
  if (fechaInactivacion) {
    fechaInactivacion.setHours(23, 59, 59, 999)
  }

  return fechaAlta <= endDate && (!fechaInactivacion || fechaInactivacion >= startDate)
}

const statsPorEntrenador = computed(() => {
  const monthBounds = getMonthBounds(selectedYear.value, selectedMonth.value)

  return entrenadoresVisibles.value.map((entrenador) => {
    const alumnosActivosEnMes = (entrenador.alumnos || []).filter((alumno) =>
      wasAlumnoActiveInRange(alumno, monthBounds.start, monthBounds.end)
    )
    const totalAlumnos = alumnosActivosEnMes.length
    const alDia = alumnosActivosEnMes.filter((a) => getPaymentStatus(a, monthBounds.end) === "green").length
    const proximoVencer = alumnosActivosEnMes.filter((a) => getPaymentStatus(a, monthBounds.end) === "yellow").length
    const deuda = alumnosActivosEnMes.filter((a) => getPaymentStatus(a, monthBounds.end) === "red").length

    const filter = trainerFilters.value[entrenador._id] || globalDateRange.value
    const startDate = parseDisplayDate(filter.start)
    const endDate = parseDisplayDate(filter.end)

    if (!startDate || !endDate) {
      return {
        id: entrenador._id,
        nombre: `${entrenador.nombre} ${entrenador.apellido || ""}`.trim(),
        total: totalAlumnos,
        alDia,
        proximoVencer,
        deuda,
        montoReal: 0,
        montoEstimado: alumnosActivosEnMes.reduce(
          (acc, alumno) => acc + getEstimatedAmountForAlumno(alumno, monthBounds.end),
          0
        ),
        porcentajeActivos: totalAlumnos > 0 ? Math.round(((alDia + proximoVencer) / totalAlumnos) * 100) : 0
      }
    }

    startDate.setHours(0, 0, 0, 0)
    endDate.setHours(23, 59, 59, 999)

    let montoReal = 0
    alumnosActivosEnMes.forEach((alumno) => {
      alumno.historialPagos.forEach((pago) => {
        const fechaPago = new Date(pago.fecha)
        if (fechaPago >= startDate && fechaPago <= endDate) {
          montoReal += getPaymentAmount(pago)
        }
      })
    })

    const montoEstimado = alumnosActivosEnMes.reduce(
      (acc, alumno) => acc + getEstimatedAmountForAlumno(alumno, endDate),
      0
    )

    return {
      id: entrenador._id,
      nombre: `${entrenador.nombre} ${entrenador.apellido || ""}`.trim(),
      total: totalAlumnos,
      alDia,
      proximoVencer,
      deuda,
      montoReal,
      montoEstimado,
      porcentajeActivos: totalAlumnos > 0 ? Math.round(((alDia + proximoVencer) / totalAlumnos) * 100) : 0
    }
  })
})

const statsGenerales = computed(() => {
  if (statsPorEntrenador.value.length === 0) return null

  const totalAlumnos = statsPorEntrenador.value.reduce((acc, stat) => acc + stat.total, 0)
  const alDia = statsPorEntrenador.value.reduce((acc, stat) => acc + stat.alDia, 0)
  const proximoVencer = statsPorEntrenador.value.reduce((acc, stat) => acc + stat.proximoVencer, 0)
  const deuda = statsPorEntrenador.value.reduce((acc, stat) => acc + stat.deuda, 0)

  let montoRealMes = 0
  let montoEstimadoMes = 0
  entrenadoresVisibles.value.forEach((entrenador) => {
    const { start, end } = getMonthBounds(selectedYear.value, selectedMonth.value)
    ;(entrenador.alumnos || [])
      .filter((alumno) => wasAlumnoActiveInRange(alumno, start, end))
      .forEach((alumno) => {
      montoEstimadoMes += getEstimatedAmountForAlumno(alumno, end)
      alumno.historialPagos.forEach((pago) => {
        const fechaPago = new Date(pago.fecha)
        if (fechaPago.getMonth() === selectedMonth.value && fechaPago.getFullYear() === selectedYear.value) {
          montoRealMes += getPaymentAmount(pago)
        }
      })
    })
  })

  const gastosMes = expenses.value.reduce((acc, expense) => acc + (Number(expense.monto) || 0), 0)
  const recaudacionNeta = montoRealMes - gastosMes

  return {
    totalAlumnos,
    alDia,
    proximoVencer,
    deuda,
    montoRealMes,
    montoEstimadoMes,
    gastosMes,
    recaudacionNeta,
    cantidadGastos: expenses.value.length,
    porcentajeActivos: totalAlumnos > 0 ? Math.round(((alDia + proximoVencer) / totalAlumnos) * 100) : 0
  }
})

function updateTrainerFilter(trainerId, field, value) {
  if (!trainerFilters.value[trainerId]) {
    trainerFilters.value[trainerId] = {
      start: globalDateRange.value.start,
      end: globalDateRange.value.end
    }
  }

  trainerFilters.value[trainerId][field] = formatDateInput(value)
}

function goBack() {
  router.push("/admin")
}

function goToExpenses() {
  router.push("/admin/expenses")
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
          <p class="subtitle">Ingresos, gastos y estado general del gimnasio</p>
        </div>
      </div>

      <div class="header-right">
        <div class="header-filters">
          <label for="month-select">Mes:</label>
          <select id="month-select" v-model="selectedMonth" class="filter-select">
            <option v-for="m in meses" :key="m.val" :value="m.val">{{ m.label }}</option>
          </select>
          <select v-model="selectedYear" class="filter-select">
            <option v-for="y in [2024, 2025, 2026, 2027]" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>

        <button @click="goToExpenses" class="expense-link-button">Cargar gastos</button>
      </div>
    </div>

    <div v-if="isLoading" class="loading">Cargando estadísticas...</div>
    <div v-else-if="error" class="error-msg">{{ error }}</div>

    <div v-else class="admin-stats-content">
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
        <div class="summary-card income">
          <span class="label">Monto Real del Mes</span>
          <span class="value">${{ statsGenerales.montoRealMes.toLocaleString() }}</span>
        </div>
        <div class="summary-card income">
          <span class="label">Monto Estimado del Mes</span>
          <span class="value">${{ statsGenerales.montoEstimadoMes.toLocaleString() }}</span>
        </div>
        <div class="summary-card expense">
          <span class="label">Gastos del Mes</span>
          <span class="value">${{ statsGenerales.gastosMes.toLocaleString() }}</span>
        </div>
        <div class="summary-card net">
          <span class="label">Recaudación Neta</span>
          <span class="value">${{ statsGenerales.recaudacionNeta.toLocaleString() }}</span>
        </div>
      </div>

      <div class="expense-summary-panel" v-if="statsGenerales">
        <div>
          <h2>Resumen económico de {{ meses[selectedMonth].label }} {{ selectedYear }}</h2>
          <p>
            Se registraron {{ statsGenerales.cantidadGastos }} gasto<span v-if="statsGenerales.cantidadGastos !== 1">s</span>
            este mes. La recaudación neta ya descuenta esos egresos.
          </p>
        </div>
        <button @click="goToExpenses" class="expense-link-button secondary">Administrar gastos</button>
      </div>

      <div class="expenses-list-panel">
        <div class="panel-header">
          <h3>Gastos del mes</h3>
          <span class="panel-total">${{ expenses.reduce((acc, expense) => acc + (Number(expense.monto) || 0), 0).toLocaleString() }}</span>
        </div>
        <div v-if="expenses.length === 0" class="empty-expenses">
          No hay gastos cargados para este mes.
        </div>
        <div v-else class="expenses-list">
          <article v-for="expense in expenses" :key="expense._id" class="expense-item">
            <div class="expense-item-main">
              <span class="expense-detail">{{ expense.detalle }}</span>
              <span class="expense-date">{{ formatDateAR(expense.fecha) }}</span>
            </div>
            <span class="expense-amount">${{ Number(expense.monto || 0).toLocaleString() }}</span>
          </article>
        </div>
      </div>

      <div class="trainer-stats-grid">
        <div v-for="stat in statsPorEntrenador" :key="stat.id" class="trainer-stat-card">
          <div class="card-header">
            <h3>{{ stat.nombre }}</h3>
            <div class="activos-badge">{{ stat.porcentajeActivos }}% Activos</div>
          </div>

          <div class="trainer-date-filter">
            <div class="date-input-group">
              <label>Desde:</label>
              <DateField
                :model-value="trainerFilters[stat.id]?.start || globalDateRange.start"
                :input-id="`trainer-start-${stat.id}`"
                @update:model-value="value => updateTrainerFilter(stat.id, 'start', value)"
              />
            </div>
            <div class="date-input-group">
              <label>Hasta:</label>
              <DateField
                :model-value="trainerFilters[stat.id]?.end || globalDateRange.end"
                :input-id="`trainer-end-${stat.id}`"
                @update:model-value="value => updateTrainerFilter(stat.id, 'end', value)"
              />
            </div>
          </div>

          <div class="saldo-display">
            <span class="saldo-label">Monto real en período:</span>
            <span class="saldo-value">${{ stat.montoReal.toLocaleString() }}</span>
          </div>

          <div class="saldo-display">
            <span class="saldo-label">Monto estimado:</span>
            <span class="saldo-value">${{ stat.montoEstimado.toLocaleString() }}</span>
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

.admin-stats-header,
.header-left,
.header-right,
.header-filters,
.expense-summary-panel,
.panel-header,
.expense-item,
.saldo-display,
.card-header,
.stat-row {
  display: flex;
  align-items: center;
}

.admin-stats-header,
.expense-summary-panel,
.panel-header,
.expense-item,
.saldo-display,
.card-header,
.stat-row {
  justify-content: space-between;
}

.admin-stats-header {
  margin-bottom: 24px;
  gap: 20px;
  flex-wrap: wrap;
}

.header-left,
.header-right,
.header-filters {
  gap: 12px;
}

.header-right {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.header-filters {
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

.back-button,
.expense-link-button {
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
}

.back-button {
  background-color: var(--rheb-dark-grey);
  color: var(--rheb-primary-green);
  border: 2px solid var(--rheb-black);
  padding: 8px 12px;
  font-size: 1.2rem;
}

.expense-link-button {
  border: 2px solid var(--rheb-black);
  background: linear-gradient(135deg, var(--rheb-primary-green) 0%, #FFA500 100%);
  color: var(--rheb-black);
  padding: 10px 16px;
}

.expense-link-button.secondary {
  background: transparent;
  border-color: var(--input-border);
  color: var(--header-text);
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
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
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
.summary-card.income { border-color: #0f766e; }
.summary-card.expense { border-color: #dc2626; }
.summary-card.net { border-color: var(--rheb-primary-green); background: var(--input-bg); }

.summary-card .label {
  font-size: 0.8rem;
  color: var(--subtitle-text);
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 4px;
  text-align: center;
}

.summary-card .value {
  font-size: 1.7rem;
  font-weight: 800;
  color: var(--header-text);
  text-align: center;
}

.expense-summary-panel,
.expenses-list-panel,
.trainer-stat-card {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 20px 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  border: 2px solid var(--card-border);
}

.expense-summary-panel {
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.expense-summary-panel h2,
.panel-header h3,
.card-header h3 {
  margin: 0;
  color: var(--header-text);
}

.expense-summary-panel p {
  margin: 6px 0 0;
  color: var(--subtitle-text);
}

.expenses-list-panel {
  margin-bottom: 24px;
}

.panel-total {
  color: #b91c1c;
  font-size: 1.3rem;
  font-weight: 800;
}

.expenses-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
}

.expense-item {
  gap: 16px;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  flex-wrap: wrap;
}

.expense-item-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.expense-detail {
  color: var(--header-text);
  font-weight: 700;
}

.expense-date,
.empty-expenses {
  color: var(--subtitle-text);
}

.expense-amount {
  color: #b91c1c;
  font-weight: 800;
  font-size: 1.05rem;
}

.trainer-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.trainer-stat-card {
  border-color: var(--rheb-primary-green);
}

.card-header {
  align-items: flex-start;
  margin-bottom: 16px;
  border-bottom: 1px solid #eee;
  padding-bottom: 12px;
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
  grid-template-columns: 1fr;
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
  min-height: 52px;
  color-scheme: light;
}

.saldo-display {
  background: var(--rheb-dark-grey);
  color: var(--rheb-primary-green);
  padding: 12px;
  border-radius: 8px;
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
  background: var(--muted-track);
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

.loading,
.error-msg {
  text-align: center;
  padding: 40px;
  font-size: 1.2rem;
}

@media (min-width: 900px) {
  .trainer-date-filter {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: end;
  }
}
</style>
