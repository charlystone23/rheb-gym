<script setup>
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"
import DateField from "../components/DateField.vue"
import { MongoService } from "../services/mongoService"
import { formatDateAR, parseDisplayDate } from "../utils/date"

const router = useRouter()
const entrenadores = ref([])
const isLoading = ref(false)
const error = ref("")
const expandedTrainers = ref({})
const expandedHistory = ref({})
const membresias = ref([])
const showEditPaymentModal = ref(false)
const isSavingPayment = ref(false)
const alumnoPagoEditando = ref(null)
const entrenadorPagoEditando = ref(null)
const pagoActual = ref({
  pagoId: "",
  fechaPago: "",
  tipoPago: "efectivo",
  membresiaId: "",
  monto: "",
  medio: "transferencia"
})

function normalizePaymentType(tipo) {
  const normalized = String(tipo || "").trim().toLowerCase()

  if (normalized === "promesa de pago" || normalized === "promesa_pago") return "promesa de pago"
  if (normalized === "descuento") return "descuento"
  if (normalized === "efectivo") return "efectivo"
  if (normalized === "transferencia") return "transferencia"

  return normalized
}

function isPromisePayment(tipo) {
  return normalizePaymentType(tipo) === "promesa de pago"
}

function isDiscountPayment(tipo) {
  return normalizePaymentType(tipo) === "descuento"
}

function getPaymentLabel(pago) {
  if (!pago) return ""
  if (pago.esParcial) return `Pago parcial (${pago.tipo || "pago"})`
  if (pago.completaParcial) return `Completa pago (${pago.tipo || "pago"})`
  return pago.detalle || pago.tipo || ""
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

function hasPendingPartialPayment(alumno) {
  const ultimoPago = getUltimoPago(alumno)
  return Boolean(ultimoPago?.esParcial && Number(ultimoPago?.saldoPendiente || 0) > 0)
}

function toggleHistory(alumnoId) {
  expandedHistory.value[alumnoId] = !expandedHistory.value[alumnoId]
}

function isHistoryExpanded(alumnoId) {
  return expandedHistory.value[alumnoId] || false
}

onMounted(async () => {
  try {
    isLoading.value = true
    const [data, memberships] = await Promise.all([
      MongoService.getEntrenadores(),
      MongoService.getMembresias()
    ])
    entrenadores.value = data || []
    membresias.value = memberships || []
  } catch (e) {
    console.error("Error loading entrenadores:", e)
    error.value = "Error al cargar entrenadores"
  } finally {
    isLoading.value = false
  }
})

function getUltimosPagos(alumno, cantidad = 6) {
  if (!alumno.historialPagos || alumno.historialPagos.length === 0) {
    return []
  }
  const pagosOrdenados = [...alumno.historialPagos].sort(comparePagosDesc)
  return pagosOrdenados.slice(0, cantidad)
}

function getUltimoPago(alumno) {
  if (!alumno.historialPagos || alumno.historialPagos.length === 0) {
    return null
  }
  const pagosOrdenados = [...alumno.historialPagos].sort(comparePagosDesc)
  return pagosOrdenados[0]
}

function getPaymentStatus(alumno) {
  const ultimoPago = getUltimoPago(alumno)
  if (ultimoPago && (isPromisePayment(ultimoPago.tipo || ultimoPago.detalle) || hasPendingPartialPayment(alumno))) {
    return "red"
  }

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  
  let proximaFechaPago = new Date()
  if (!ultimoPago) {
    proximaFechaPago = new Date(alumno.fechaRegistro || alumno.createdAt || hoy)
  } else {
    proximaFechaPago = new Date(ultimoPago.fecha)
    proximaFechaPago.setDate(proximaFechaPago.getDate() + 30)
  }
  proximaFechaPago.setHours(0, 0, 0, 0)
  
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
  return formatDateAR(date)
}

function getDaysUntilPayment(alumno) {
  const ultimoPago = getUltimoPago(alumno)
  if (ultimoPago && (isPromisePayment(ultimoPago.tipo || ultimoPago.detalle) || hasPendingPartialPayment(alumno))) {
    return null
  }

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  
  let proximaFecha = new Date()
  if (!ultimoPago) {
    proximaFecha = new Date(alumno.fechaRegistro || alumno.createdAt || hoy)
  } else {
    proximaFecha = new Date(ultimoPago.fecha)
    proximaFecha.setDate(proximaFecha.getDate() + 30)
  }
  proximaFecha.setHours(0, 0, 0, 0)
  
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

function getAlumnoId(alumno) {
  return alumno?._id || alumno?.id || ""
}

function closeEditPaymentModal() {
  showEditPaymentModal.value = false
  isSavingPayment.value = false
  alumnoPagoEditando.value = null
  entrenadorPagoEditando.value = null
  pagoActual.value = {
    pagoId: "",
    fechaPago: "",
    tipoPago: "efectivo",
    membresiaId: "",
    monto: "",
    medio: "transferencia"
  }
}

function openEditPaymentModal(entrenador, alumno) {
  const ultimoPago = getUltimoPago(alumno)
  if (!ultimoPago?._id) {
    error.value = "Este alumno no tiene pagos para editar."
    return
  }

  const membresiaId =
    ultimoPago.membresia?.id ||
    ultimoPago.membresia?._id ||
    membresias.value.find((m) => m.nombre === ultimoPago.membresia?.nombre)?._id ||
    membresias.value[0]?._id ||
    ""

  entrenadorPagoEditando.value = entrenador
  alumnoPagoEditando.value = alumno
  pagoActual.value = {
    pagoId: ultimoPago._id,
    fechaPago: formatDateAR(ultimoPago.fecha),
    tipoPago: normalizePaymentType(ultimoPago.tipo || ultimoPago.detalle) || "efectivo",
    membresiaId,
    monto: String(ultimoPago.monto ?? ultimoPago.membresia?.precio ?? ""),
    medio: ultimoPago.medio || "transferencia"
  }
  error.value = ""
  showEditPaymentModal.value = true
}

async function guardarPagoEditado() {
  if (!alumnoPagoEditando.value || !pagoActual.value.pagoId) return

  const fechaPagoDate = parseDisplayDate(pagoActual.value.fechaPago)
  if (!fechaPagoDate) {
    error.value = "La fecha ingresada no es válida."
    return
  }

  if (
    !isPromisePayment(pagoActual.value.tipoPago) &&
    (pagoActual.value.monto === "" || Number.isNaN(Number(pagoActual.value.monto)))
  ) {
    error.value = "Ingresá un monto válido."
    return
  }

  const monto = Number(pagoActual.value.monto || 0)
  if (monto < 0) {
    error.value = "El monto no puede ser negativo."
    return
  }

  const ultimoPago = getUltimoPago(alumnoPagoEditando.value)
  const selectedMembresia = membresias.value.find((m) => m._id === pagoActual.value.membresiaId)

  if (!selectedMembresia) {
    error.value = "Seleccioná una membresía válida."
    return
  }

  const tipoNormalizado = normalizePaymentType(pagoActual.value.tipoPago)

  const payload = {
    fecha: fechaPagoDate,
    tipo: tipoNormalizado,
    detalle: isPromisePayment(tipoNormalizado)
      ? "Promesa de Pago"
      : isDiscountPayment(tipoNormalizado)
        ? "Descuento"
        : "",
    medio: isDiscountPayment(tipoNormalizado) ? (pagoActual.value.medio || "transferencia") : "",
    monto: isPromisePayment(tipoNormalizado) ? 0 : monto,
    membresia: {
      id: selectedMembresia._id,
      nombre: selectedMembresia.nombre,
      precio: selectedMembresia.precio
    },
    esParcial: ultimoPago?.esParcial || false,
    completaParcial: ultimoPago?.completaParcial || false,
    montoObjetivo: ultimoPago?.montoObjetivo ?? null,
    saldoPendiente: ultimoPago?.saldoPendiente ?? 0
  }

  try {
    isSavingPayment.value = true
    error.value = ""

    const alumnoActualizado = await MongoService.updatePago(
      getAlumnoId(alumnoPagoEditando.value),
      pagoActual.value.pagoId,
      payload
    )

    entrenadores.value = entrenadores.value.map((entrenador) => {
      if (entrenador._id !== entrenadorPagoEditando.value?._id) return entrenador

      return {
        ...entrenador,
        alumnos: (entrenador.alumnos || []).map((alumno) =>
          getAlumnoId(alumno) === getAlumnoId(alumnoPagoEditando.value)
            ? alumnoActualizado
            : alumno
        )
      }
    })

    closeEditPaymentModal()
  } catch (e) {
    console.error("Error updating payment:", e)
    error.value = e.message || "No se pudo actualizar el pago."
  } finally {
    isSavingPayment.value = false
  }
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
                <h3>{{ alumno.nombre }} {{ alumno.apellido }}<span v-if="hasPendingPartialPayment(alumno)" class="partial-indicator">*</span></h3>
                <div class="alumno-payment-info">
                  <p v-if="alumno.celular" class="alumno-phone">📱 {{ alumno.celular }}</p>
                  <p v-if="getUltimoPago(alumno)" class="payment-info">
                    Último pago: {{ formatDate(getUltimoPago(alumno).fecha) }} 
                    <span class="payment-type">({{ getPaymentLabel(getUltimoPago(alumno)) }})</span>
                    <span v-if="getUltimoPago(alumno).monto" class="payment-amount">
                      <span class="separator">|</span> ${{ getUltimoPago(alumno).monto }}
                    </span>
                  </p>
                  <p v-else class="payment-info">Sin pagos registrados</p>
                  <div v-if="getUltimoPago(alumno) || getUltimosPagos(alumno).length > 0" class="payment-actions-row">
                    <button
                      v-if="getUltimoPago(alumno)"
                      @click="openEditPaymentModal(entrenador, alumno)"
                      class="edit-payment-button"
                    >
                      Editar último pago
                    </button>
                    
                    <!-- Historial Toggle -->
                    <button 
                      v-if="getUltimosPagos(alumno).length > 0"
                      @click="toggleHistory(alumno._id || alumno.id)" 
                      class="history-toggle-btn"
                    >
                      {{ isHistoryExpanded(alumno._id || alumno.id) ? 'Ocultar' : 'Ver' }} Historial
                    </button>
                  </div>

                  <!-- Historial List -->
                  <div v-if="isHistoryExpanded(alumno._id || alumno.id)" class="admin-history-list">
                    <p class="history-title">Últimos pagos:</p>
                    <div v-for="(pago, i) in getUltimosPagos(alumno)" :key="i" class="mini-history-item">
                      <span class="mini-date">{{ formatDate(pago.fecha) }}</span>
                      <span class="mini-type">{{ getPaymentLabel(pago) }}</span>
                      <span v-if="pago.membresia" class="mini-membresia">{{ pago.membresia.nombre }}</span>
                      <span v-if="pago.monto" class="mini-monto">${{ pago.monto }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="status-container">
                <div 
                  :class="['status-light', getPaymentStatus(alumno)]"
                  :title="getPaymentStatus(alumno) === 'red' 
                  ? (hasPendingPartialPayment(alumno)
                      ? 'Pago parcial pendiente'
                      : (isPromisePayment(getUltimoPago(alumno)?.tipo || getUltimoPago(alumno)?.detalle) ? 'Promesa de pago pendiente' : 'Pago retrasado')) 
                    : getPaymentStatus(alumno) === 'yellow' 
                    ? `Próximo pago en ${getDaysUntilPayment(alumno)} días`
                    : 'Pago al día'"
                ></div>
                <span class="days-info" v-if="getPaymentStatus(alumno) !== 'green'">
                  {{ getDaysUntilPayment(alumno) === null
                    ? (hasPendingPartialPayment(alumno) ? 'Deudor *' : 'Promesa pendiente')
                    : getDaysUntilPayment(alumno) < 0 
                    ? `${Math.abs(getDaysUntilPayment(alumno))} días de retraso`
                    : getDaysUntilPayment(alumno) === 0 ? '0 días de retraso' : `${getDaysUntilPayment(alumno)} días` }}
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

    <div
      v-if="showEditPaymentModal && alumnoPagoEditando"
      class="modal-overlay"
      @click.self="closeEditPaymentModal"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h2>Editar Último Pago</h2>
          <button @click="closeEditPaymentModal" class="close-button">×</button>
        </div>

        <div class="modal-form">
          <div class="form-group">
            <label>Alumno</label>
            <div class="payment-edit-summary">
              {{ alumnoPagoEditando.nombre }} {{ alumnoPagoEditando.apellido }}
              <span v-if="entrenadorPagoEditando">
                (de {{ entrenadorPagoEditando.nombre }} {{ entrenadorPagoEditando.apellido }})
              </span>
            </div>
          </div>

          <div class="form-group">
            <label for="edit-fecha-pago">Fecha de Pago *</label>
            <DateField
              id="edit-fecha-pago"
              v-model="pagoActual.fechaPago"
              placeholder="dd/mm/aaaa"
            />
          </div>

          <div class="form-group">
            <label for="edit-tipo-pago">Tipo de Pago *</label>
            <select id="edit-tipo-pago" v-model="pagoActual.tipoPago">
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="descuento">Descuento</option>
              <option value="promesa de pago">Promesa de Pago</option>
            </select>
          </div>

          <div v-if="isDiscountPayment(pagoActual.tipoPago)" class="form-group">
            <label for="edit-medio-pago">Tipo del descuento *</label>
            <select id="edit-medio-pago" v-model="pagoActual.medio">
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
            </select>
          </div>

          <div class="form-group">
            <label for="edit-membresia">Membresía *</label>
            <select id="edit-membresia" v-model="pagoActual.membresiaId">
              <option value="" disabled>Seleccioná una membresía</option>
              <option v-for="membresia in membresias" :key="membresia._id" :value="membresia._id">
                {{ membresia.nombre }} - ${{ membresia.precio }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label for="edit-monto">Monto *</label>
            <input
              id="edit-monto"
              v-model="pagoActual.monto"
              type="number"
              min="0"
              step="0.01"
              :disabled="isPromisePayment(pagoActual.tipoPago)"
              placeholder="Ej: 38000"
            />
          </div>

          <div v-if="error" class="error-message">
            {{ error }}
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeEditPaymentModal" class="cancel-button" :disabled="isSavingPayment">
              Cancelar
            </button>
            <button type="button" @click="guardarPagoEditado" class="submit-button" :disabled="isSavingPayment">
              {{ isSavingPayment ? "Guardando..." : "Guardar Cambios" }}
            </button>
          </div>
        </div>
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

.partial-indicator {
  color: #ef4444;
  font-size: 1.1rem;
  font-weight: 800;
  margin-left: 6px;
}

.payment-info {
  color: var(--subtitle-text);
  font-size: 0.85rem;
  margin: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.payment-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
  align-items: center;
}

.edit-payment-button {
  background: rgba(255, 215, 0, 0.08);
  color: var(--rheb-primary-green);
  border: 1px solid var(--rheb-primary-green);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-payment-button:hover {
  background: rgba(255, 215, 0, 0.08);
}

.payment-type {
  color: var(--header-text);
  text-transform: capitalize;
  font-weight: 500;
}

.payment-amount {
  font-weight: 600;
  color: var(--rheb-primary-green);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.separator {
  color: var(--input-border);
  font-weight: 400;
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
  background: var(--input-bg);
  color: var(--header-text);
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

.payment-edit-summary {
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  color: var(--header-text);
  font-weight: 600;
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
.history-toggle-btn {
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  color: var(--rheb-primary-green);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.2s;
}

.history-toggle-btn:hover {
  border-color: var(--rheb-primary-green);
  background: rgba(255, 215, 0, 0.08);
}

.admin-history-list {
  margin-top: 8px;
  padding: 8px;
  background: var(--card-bg);
  border: 1px solid var(--input-border);
  border-radius: 8px;
}

.history-title {
  font-size: 0.75rem;
  color: var(--subtitle-text);
  margin: 0 0 4px 0;
}

.mini-history-item {
  display: flex;
  gap: 8px;
  font-size: 0.8rem;
  padding: 2px 0;
  border-bottom: 1px solid var(--input-border);
}

.mini-history-item:last-child {
  border-bottom: none;
}

.mini-date { font-weight: 600; color: var(--header-text); }
.mini-type { color: var(--subtitle-text); }
.mini-membresia { color: var(--rheb-accent-green); margin-left: auto; }
.mini-monto { font-weight: 600; color: var(--rheb-primary-green); margin-left: 8px; }
</style>
