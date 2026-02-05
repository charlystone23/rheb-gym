<script setup>
import { ref, onMounted, computed } from "vue"
import { useRouter } from "vue-router"
import { MongoService } from "../services/mongoService"

const router = useRouter()
const alumnos = ref([])
const showModal = ref(false)
const showPaymentModal = ref(false)
const showDeleteModal = ref(false)
const alumnoSeleccionado = ref(null)
const alumnoAEliminar = ref(null)
const historialVisible = ref({}) // Objeto para rastrear qué historiales están visibles
const nuevoAlumno = ref({
  nombre: "",
  apellido: "",
  celular: "",
  fechaPago: "",
  tipoPago: "efectivo",
  detalleOtros: "",
  membresiaId: "" // ID de la membresía seleccionada
})
const nuevoPago = ref({
  fechaPago: "",
  tipoPago: "efectivo",
  detalleOtros: "",
  membresiaId: ""
})
const membresias = ref([])
const error = ref("")
const isEditing = ref(false)
const showDelegationModal = ref(false)
const entrenadores = ref([])
const trainerIdParaDelegar = ref("")
const isLoadingTrainers = ref(false)

const isLoading = ref(false)

const currentUser = ref(null)

onMounted(async () => {
  try {
    const userStr = localStorage.getItem('user')
    if (!userStr) {
      router.push('/') // Redirect to login if not logged in
      return
    }
    currentUser.value = JSON.parse(userStr)

    isLoading.value = true
    
    // Si es entrenador, filtramos por su ID. Si es admin, traemos todo (o podríamos filtrar por ?entrenadorId si quisiéramos)
    const entrenadorId = currentUser.value.role === 'entrenador' ? currentUser.value._id : null
    
    const data = await MongoService.getAlumnos(entrenadorId)
    alumnos.value = data || []

    const mData = await MongoService.getMembresias()
    membresias.value = mData || []
    
    // Set default membership (3 days if exists)
    const defaultM = membresias.value.find(m => m.nombre.includes('3 días')) || membresias.value[0]
    if (defaultM) {
      nuevoAlumno.value.membresiaId = defaultM._id
      nuevoPago.value.membresiaId = defaultM._id
    }
  } catch (e) {
    console.error("Error initial loading:", e)
    error.value = "Error al cargar datos"
  } finally {
    isLoading.value = false
  }
})

function getUltimoPago(alumno) {
  if (!alumno.historialPagos || alumno.historialPagos.length === 0) {
    return null
  }
  // Ordenar por fecha descendente y tomar el más reciente
  const pagosOrdenados = [...alumno.historialPagos].sort((a, b) => 
    new Date(b.fecha) - new Date(a.fecha)
  )
  return pagosOrdenados[0]
}

function getUltimosPagos(alumno, cantidad = 6) {
  if (!alumno.historialPagos || alumno.historialPagos.length === 0) {
    return []
  }
  // Ordenar por fecha descendente y tomar los últimos N
  const pagosOrdenados = [...alumno.historialPagos].sort((a, b) => 
    new Date(b.fecha) - new Date(a.fecha)
  )
  return pagosOrdenados.slice(0, cantidad)
}

function toggleHistorial(alumnoId) {
  historialVisible.value[alumnoId] = !historialVisible.value[alumnoId]
}

function isHistorialVisible(alumnoId) {
  return historialVisible.value[alumnoId] || false
}

function getPaymentStatus(alumno) {
  const ultimoPago = getUltimoPago(alumno)
  if (!ultimoPago) return "red"
  
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  
  const fechaPagoDate = new Date(ultimoPago.fecha)
  fechaPagoDate.setHours(0, 0, 0, 0)
  
  // Calcular la próxima fecha de pago (30 días después)
  const proximaFechaPago = new Date(fechaPagoDate)
  proximaFechaPago.setDate(proximaFechaPago.getDate() + 30)
  
  // Calcular días hasta el próximo pago
  const diasHastaPago = Math.ceil((proximaFechaPago - hoy) / (1000 * 60 * 60 * 24))
  
  if (diasHastaPago < 0) {
    return "red" // Pago retrasado
  } else if (diasHastaPago <= 5) {
    return "yellow" // 5 días o menos antes del pago
  } else {
    return "green" // Al día
  }
}

function formatDate(date) {
  const fecha = new Date(date)
  const dia = String(fecha.getDate()).padStart(2, '0')
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const año = fecha.getFullYear()
  return `${dia}/${mes}/${año}`
}

function formatNextPaymentDate(alumno) {
  const ultimoPago = getUltimoPago(alumno)
  if (!ultimoPago) return "Sin pago"
  
  const fechaPago = new Date(ultimoPago.fecha)
  const proximaFecha = new Date(fechaPago)
  proximaFecha.setDate(proximaFecha.getDate() + 30)
  const dia = String(proximaFecha.getDate()).padStart(2, '0')
  const mes = String(proximaFecha.getMonth() + 1).padStart(2, '0')
  const año = proximaFecha.getFullYear()
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
  router.push("/dashboard")
}

function openModal() {
  isEditing.value = false
  showModal.value = true
  error.value = ""
  nuevoAlumno.value = {
    nombre: "",
    apellido: "",
    celular: "",
    fechaPago: "" // Not used for editing but needed for object structure if any
  }
}

function openEditModal(alumno) {
  isEditing.value = true
  showModal.value = true
  error.value = ""
  // Store ID for update
  nuevoAlumno.value = {
    _id: alumno._id || alumno.id,
    nombre: alumno.nombre,
    apellido: alumno.apellido,
    celular: alumno.celular || "",
    // We don't edit payment info here basically, but we keep the object safe
    fechaPago: "" 
  }
}

function closeModal() {
  showModal.value = false
  error.value = ""
  nuevoAlumno.value = {
    nombre: "",
    apellido: "",
    celular: "",
    fechaPago: "",
    tipoPago: "efectivo",
    detalleOtros: "",
    membresiaId: membresias.value.find(m => m.nombre.includes('3 días'))?._id || membresias.value[0]?._id || ""
  }
}

function parseDateString(dateString) {
  // Convierte dd/mm/yyyy a Date
  const parts = dateString.split('/')
  if (parts.length !== 3) return null
  
  const dia = parseInt(parts[0], 10)
  const mes = parseInt(parts[1], 10) - 1 // Los meses en JS son 0-indexed
  const año = parseInt(parts[2], 10)
  
  if (isNaN(dia) || isNaN(mes) || isNaN(año)) return null
  
  const fecha = new Date(año, mes, dia)
  
  // Validar que la fecha sea válida
  if (fecha.getDate() !== dia || fecha.getMonth() !== mes || fecha.getFullYear() !== año) {
    return null
  }
  
  return fecha
}

function formatDateInput(value) {
  // Remover todo lo que no sea número
  let numbers = value.replace(/\D/g, '')
  
  // Aplicar formato dd/mm/yyyy
  if (numbers.length <= 2) {
    return numbers
  } else if (numbers.length <= 4) {
    return numbers.slice(0, 2) + '/' + numbers.slice(2)
  } else {
    return numbers.slice(0, 2) + '/' + numbers.slice(2, 4) + '/' + numbers.slice(4, 8)
  }
}

function handleDateInput(event) {
  const input = event.target
  const formatted = formatDateInput(input.value)
  
  // Limitar a 10 caracteres (dd/mm/yyyy)
  const finalValue = formatted.length > 10 ? formatted.slice(0, 10) : formatted
  
  // Determinar si es para nuevo alumno o nuevo pago
  if (input.id === 'fechaPago') {
    nuevoAlumno.value.fechaPago = finalValue
  } else if (input.id === 'fechaPagoPago') {
    nuevoPago.value.fechaPago = finalValue
  }
}

async function agregarAlumno() {
  // Validar campos
  if (!nuevoAlumno.value.nombre.trim()) {
    error.value = "El nombre es requerido"
    return
  }
  
  if (!nuevoAlumno.value.apellido.trim()) {
    error.value = "El apellido es requerido"
    return
  }

  if (!nuevoAlumno.value.celular.trim()) {
    error.value = "El celular es requerido"
    return
  }

  // Si estamos editando, solo permitimos nombre, apellido, celular
  if (isEditing.value) {
    try {
      isLoading.value = true
      const updated = await MongoService.updateAlumno(nuevoAlumno.value._id, {
        nombre: nuevoAlumno.value.nombre.trim(),
        apellido: nuevoAlumno.value.apellido.trim(),
        celular: nuevoAlumno.value.celular.trim()
      })
      
      // Update local list
      const index = alumnos.value.findIndex(a => (a._id || a.id) === (updated._id || updated.id))
      if (index !== -1) {
        // Keep existing properties like history
        alumnos.value[index] = { ...alumnos.value[index], ...updated }
      }
      closeModal()
    } catch (e) {
      console.error(e)
      error.value = "Error al actualizar alumno"
    } finally {
      isLoading.value = false
    }
    return
  }
  
  if (!nuevoAlumno.value.fechaPago) {
    error.value = "La fecha de pago es requerida"
    return
  }
  
  // Validar formato de fecha dd/mm/yyyy
  const fechaRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/
  if (!fechaRegex.test(nuevoAlumno.value.fechaPago)) {
    error.value = "La fecha debe tener el formato dd/mm/yyyy"
    return
  }
  
  // Convertir fecha string a Date
  const fechaPagoDate = parseDateString(nuevoAlumno.value.fechaPago)
  
  if (!fechaPagoDate || isNaN(fechaPagoDate.getTime())) {
    error.value = "La fecha ingresada no es válida"
    return
  }
  
  // Validar que la fecha no sea futura
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  fechaPagoDate.setHours(0, 0, 0, 0)
  
  if (fechaPagoDate > hoy) {
    error.value = "La fecha de pago no puede ser futura"
    return
  }
  
  // Crear nuevo alumno object for Mongo service
  // Note: ID generation is handled by MongoService mostly, but we might want
  // a temp ID for local view until refresh or use the response
  const selectedM = membresias.value.find(m => m._id === nuevoAlumno.value.membresiaId)
  
  const alumnoData = {
    nombre: nuevoAlumno.value.nombre.trim(),
    apellido: nuevoAlumno.value.apellido.trim(),
    celular: nuevoAlumno.value.celular.trim(),
    entrenador: currentUser.value ? currentUser.value._id : null,
    historialPagos: [{
      fecha: fechaPagoDate,
      tipo: nuevoAlumno.value.tipoPago === 'otros' 
        ? (nuevoAlumno.value.detalleOtros.trim() || 'otros')
        : nuevoAlumno.value.tipoPago,
      membresia: selectedM ? {
        nombre: selectedM.nombre,
        precio: selectedM.precio
      } : null,
      monto: selectedM ? selectedM.precio : 0
    }]
  }
  
  try {
    isLoading.value = true
    const savedAlumno = await MongoService.createAlumno(alumnoData)
    alumnos.value.push(savedAlumno)
    closeModal()
  } catch (e) {
    console.error(e)
    error.value = "Error al guardar en MongoDB"
  } finally {
    isLoading.value = false
  }
}

function openPaymentModal(alumno) {
  alumnoSeleccionado.value = alumno
  showPaymentModal.value = true
  error.value = ""
  
  // Set default membership (3 days)
  const defaultM = membresias.value.find(m => m.nombre.includes('3 días')) || membresias.value[0]
  
  nuevoPago.value = {
    fechaPago: "",
    tipoPago: "efectivo",
    detalleOtros: "",
    membresiaId: defaultM?._id || ""
  }
}

function closePaymentModal() {
  showPaymentModal.value = false
  alumnoSeleccionado.value = null
  error.value = ""
  nuevoPago.value = {
    fechaPago: "",
    tipoPago: "efectivo",
    detalleOtros: "",
    membresiaId: ""
  }
}

async function registrarPago() {
  if (!alumnoSeleccionado.value) return
  
  // Validar fecha
  if (!nuevoPago.value.fechaPago) {
    error.value = "La fecha de pago es requerida"
    return
  }
  
  // Validar formato de fecha dd/mm/yyyy
  const fechaRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/
  if (!fechaRegex.test(nuevoPago.value.fechaPago)) {
    error.value = "La fecha debe tener el formato dd/mm/yyyy"
    return
  }
  
  // Convertir fecha string a Date
  const fechaPagoDate = parseDateString(nuevoPago.value.fechaPago)
  
  if (!fechaPagoDate || isNaN(fechaPagoDate.getTime())) {
    error.value = "La fecha ingresada no es válida"
    return
  }
  
  // Validar que la fecha no sea futura
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  fechaPagoDate.setHours(0, 0, 0, 0)
  
  if (fechaPagoDate > hoy) {
    error.value = "La fecha de pago no puede ser futura"
    return
  }
  
  // Buscar el alumno en la lista
  const alumnoIndex = alumnos.value.findIndex(a => a.id === alumnoSeleccionado.value.id)
  if (alumnoIndex === -1) return
  
  // Crear nuevo pago
  let tipoFinal = nuevoPago.value.tipoPago
  if (nuevoPago.value.tipoPago === 'otros') {
    if (!nuevoPago.value.detalleOtros.trim()) {
      error.value = "Debes especificar el detalle para 'Otros'"
      return
    }
    tipoFinal = nuevoPago.value.detalleOtros.trim() || 'otros'
  }
  
  const selectedM = membresias.value.find(m => m._id === nuevoPago.value.membresiaId)

  const nuevoPagoObj = {
    fecha: fechaPagoDate,
    tipo: tipoFinal,
    membresia: selectedM ? {
      nombre: selectedM.nombre,
      precio: selectedM.precio
    } : null,
    monto: selectedM ? selectedM.precio : 0
  }
  
  try {
    isLoading.value = true
    await MongoService.addPago(alumnoSeleccionado.value._id || alumnoSeleccionado.value.id, nuevoPagoObj)
    
    // Update local state
    if (!alumnos.value[alumnoIndex].historialPagos) {
      alumnos.value[alumnoIndex].historialPagos = []
    }
    
    alumnos.value[alumnoIndex].historialPagos.push(nuevoPagoObj)
    
    // Sorting for display
    alumnos.value[alumnoIndex].historialPagos.sort((a, b) => 
      new Date(b.fecha) - new Date(a.fecha)
    )
    
    // Do not truncate local history, let the view helper handle it
    
    closePaymentModal()
  } catch (e) {
    console.error(e)
    error.value = "Error al registrar pago en MongoDB"
  } finally {
    isLoading.value = false
  }
}

function openDeleteConfirm(alumno) {
  alumnoAEliminar.value = alumno
  showDeleteModal.value = true
}

function closeDeleteModal() {
  showDeleteModal.value = false
  alumnoAEliminar.value = null
}

async function confirmarEliminacion() {
  if (!alumnoAEliminar.value) return

  try {
    isLoading.value = true
    await MongoService.deleteAlumno(alumnoAEliminar.value.id || alumnoAEliminar.value._id)
    alumnos.value = alumnos.value.filter(a => 
      a.id !== (alumnoAEliminar.value.id || alumnoAEliminar.value._id) && 
      a._id !== (alumnoAEliminar.value.id || alumnoAEliminar.value._id)
    )
    closeDeleteModal()
  } catch (e) {
    console.error(e)
    alert("Error al eliminar el alumno")
  } finally {
    isLoading.value = false
  }
}

async function eliminarAlumno(id) {
  // Method replaced by openDeleteConfirm
}

async function openDelegationModal(alumno) {
  alumnoSeleccionado.value = alumno
  showDelegationModal.value = true
  error.value = ""
  trainerIdParaDelegar.value = ""
  
  try {
    isLoadingTrainers.value = true
    const data = await MongoService.getEntrenadores()
    // Filtrar al entrenador actual para no delegar a sí mismo
    entrenadores.value = data.filter(t => t._id !== currentUser.value._id)
  } catch (e) {
    console.error("Error loading trainers:", e)
    error.value = "Error al cargar la lista de entrenadores"
  } finally {
    isLoadingTrainers.value = false
  }
}

function closeDelegationModal() {
  showDelegationModal.value = false
  alumnoSeleccionado.value = null
  trainerIdParaDelegar.value = ""
  error.value = ""
}

async function confirmarDelegacion() {
  if (!trainerIdParaDelegar.value) {
    error.value = "Debes seleccionar un entrenador"
    return
  }

  try {
    isLoading.value = true
    const alumnoId = alumnoSeleccionado.value._id || alumnoSeleccionado.value.id
    await MongoService.updateAlumno(alumnoId, {
      entrenador: trainerIdParaDelegar.value
    })
    
    // Eliminar el alumno de la lista local ya que ya no pertenece a este entrenador
    alumnos.value = alumnos.value.filter(a => (a._id || a.id) !== alumnoId)
    
    closeDelegationModal()
    alert("Alumno delegado correctamente")
  } catch (e) {
    console.error("Error delegating alumno:", e)
    error.value = "Error al delegar el alumno"
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="alumnos-container">
    <div class="alumnos-header">
      <div class="header-left">
        <button @click="goBack" class="back-button">←</button>
        <img src="/logo.png" alt="Rheb Logo" class="logo-small" />
        <div>
          <h1>Mis Alumnos</h1>
          <p class="subtitle" v-if="currentUser">Panel de {{ currentUser.nombre || currentUser.name }}</p>
          <p class="subtitle" v-else>Gestiona tus alumnos y sus pagos</p>
        </div>
      </div>
      <button @click="openModal" class="add-button">
        <span class="add-icon">+</span>
        Nuevo Alumno
      </button>
    </div>

    <div class="alumnos-content">
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

      <div class="alumnos-list">
        <div 
          v-for="alumno in alumnos" 
          :key="alumno.id" 
          class="alumno-card"
        >
          <div class="alumno-info">
            <div class="alumno-name">
              <h3>{{ alumno.nombre }} {{ alumno.apellido }}</h3>
            </div>
            <div class="alumno-payment">
              <p class="payment-label">Último pago:</p>
              <p class="payment-date" v-if="getUltimoPago(alumno)">
                {{ formatDate(getUltimoPago(alumno).fecha) }} 
                <span class="payment-type">({{ getUltimoPago(alumno).tipo }})</span>
                <span v-if="getUltimoPago(alumno).membresia" class="membership-info-chip">
                  {{ getUltimoPago(alumno).membresia.nombre }} - ${{ getUltimoPago(alumno).membresia.precio.toLocaleString() }}
                </span>
              </p>
              <p class="payment-date" v-else>Sin pagos registrados</p>
              <p class="next-payment">Próximo pago: {{ formatNextPaymentDate(alumno) }}</p>
              
              <!-- Botón para ver historial -->
              <button 
                v-if="getUltimosPagos(alumno).length > 0"
                @click="toggleHistorial(alumno.id)" 
                class="history-button"
              >
                {{ isHistorialVisible(alumno.id) ? 'Ocultar' : 'Ver' }} Historial ({{ getUltimosPagos(alumno).length }})
              </button>
            </div>
            
            <!-- Historial de pagos (colapsable) -->
            <div 
              class="payment-history" 
              v-if="getUltimosPagos(alumno).length > 0 && isHistorialVisible(alumno.id)"
            >
              <p class="history-label">Historial de pagos (últimos 6):</p>
              <div class="history-list">
                <div 
                  v-for="(pago, index) in getUltimosPagos(alumno)" 
                  :key="index"
                  class="history-item"
                >
                  <span class="history-date">{{ formatDate(pago.fecha) }}</span>
                  <span class="history-type">{{ pago.tipo }}</span>
                  <span v-if="pago.membresia" class="history-membresia">
                    {{ pago.membresia.nombre }} (${{ pago.membresia.precio.toLocaleString() }})
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class="alumno-actions">
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
            <button @click="openPaymentModal(alumno)" class="register-payment-button">
              Registrar Pago
            </button>
            <div class="action-buttons-group">
            <button 
              v-if="currentUser?.role === 'entrenador'"
              @click.stop="openDelegationModal(alumno)" 
              class="delegate-alumno-button-inline" 
              title="Delegar Alumno a otro entrenador"
            >
              🔄
            </button>
            <button 
              v-if="currentUser?.role === 'entrenador'"
              @click.stop="openEditModal(alumno)" 
              class="edit-alumno-button-inline" 
              title="Editar Alumno"
            >
              ✏️
            </button>
            <button @click.stop="openDeleteConfirm(alumno)" class="delete-alumno-button-inline" title="Eliminar Alumno">
              🗑️
            </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="alumnos.length === 0" class="empty-state">
        <p>No hay alumnos registrados</p>
      </div>
    </div>

    <!-- Modal de confirmación de eliminación -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="closeDeleteModal">
      <div class="modal-content delete-confirmation-modal">
        <div class="delete-icon-large">⚠️</div>
        <h3>¿Eliminar Alumno?</h3>
        <p>Estás a punto de eliminar a <strong>{{ alumnoAEliminar?.nombre }} {{ alumnoAEliminar?.apellido }}</strong>.</p>
        <p class="delete-warning">Esta acción es permanente y no se puede deshacer.</p>
        
        <div class="modal-actions-stacked">
          <button @click="confirmarEliminacion" class="confirm-delete-btn" :disabled="isLoading">
            {{ isLoading ? 'Eliminando...' : 'Sí, Eliminar' }}
          </button>
          <button @click="closeDeleteModal" class="cancel-delete-btn" :disabled="isLoading">
            Cancelar
          </button>
        </div>
      </div>
    </div>

    <!-- Modal para agregar nuevo alumno -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ isEditing ? 'Editar Alumno' : 'Nuevo Alumno' }}</h2>
          <button @click="closeModal" class="close-button">×</button>
        </div>
        
        <form @submit.prevent="agregarAlumno" class="modal-form">
          <div class="form-group">
            <label for="nombre">Nombre *</label>
            <input
              id="nombre"
              v-model="nuevoAlumno.nombre"
              type="text"
              placeholder="Ingresa el nombre"
              required
            />
          </div>

          <div class="form-group">
            <label for="apellido">Apellido *</label>
            <input
              id="apellido"
              v-model="nuevoAlumno.apellido"
              type="text"
              placeholder="Ingresa el apellido"
              required
            />
          </div>

          <div class="form-group">
            <label for="celular">Celular *</label>
            <input
              id="celular"
              v-model="nuevoAlumno.celular"
              type="text"
              placeholder="Ingresa el celular"
              required
            />
          </div>

          <!-- Campos de Pago solo si NO estamos editando -->
          <div v-if="!isEditing">
            <div class="form-group">
              <label for="fechaPago">Fecha de Último Pago * (dd/mm/yyyy)</label>
            <input
              id="fechaPago"
              v-model="nuevoAlumno.fechaPago"
              type="text"
              placeholder="dd/mm/yyyy"
              @input="handleDateInput"
              maxlength="10"
              required
            />
          </div>

          <div class="form-group">
            <label for="tipoPagoNuevo">Tipo de Pago *</label>
            <select
              id="tipoPagoNuevo"
              v-model="nuevoAlumno.tipoPago"
              required
              class="select-input"
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="otros">Otros</option>
            </select>
          </div>

          <div class="form-group" v-if="nuevoAlumno.tipoPago === 'otros'">
            <label for="detalleOtrosNuevo">Detalle *</label>
            <input
              id="detalleOtrosNuevo"
              v-model="nuevoAlumno.detalleOtros"
              type="text"
              placeholder="Especifica el tipo de pago"
              required
            />
          </div>

          <div class="form-group">
            <label for="membresiaNuevo">Membresía *</label>
            <select
              id="membresiaNuevo"
              v-model="nuevoAlumno.membresiaId"
              required
              class="select-input"
            >
              <option v-for="m in membresias" :key="m._id" :value="m._id">
                {{ m.nombre }} - ${{ m.precio.toLocaleString() }}
              </option>
            </select>
          </div>
          </div>

          <div v-if="error" class="error-message">
            {{ error }}
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeModal" class="cancel-button">
              Cancelar
            </button>
            <button type="submit" class="submit-button">
              {{ isEditing ? 'Actualizar Alumno' : 'Agregar Alumno' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal para registrar pago -->
    <div v-if="showPaymentModal && alumnoSeleccionado" class="modal-overlay" @click.self="closePaymentModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Registrar Pago</h2>
          <button @click="closePaymentModal" class="close-button">×</button>
        </div>
        
        <div class="modal-student-info">
          <p><strong>Alumno:</strong> {{ alumnoSeleccionado.nombre }} {{ alumnoSeleccionado.apellido }}</p>
        </div>
        
        <form @submit.prevent="registrarPago" class="modal-form">
          <div class="form-group">
            <label for="fechaPagoPago">Fecha de Pago * (dd/mm/yyyy)</label>
            <input
              id="fechaPagoPago"
              v-model="nuevoPago.fechaPago"
              type="text"
              placeholder="dd/mm/yyyy"
              @input="handleDateInput"
              maxlength="10"
              required
            />
          </div>

          <div class="form-group">
            <label for="tipoPago">Tipo de Pago *</label>
            <select
              id="tipoPago"
              v-model="nuevoPago.tipoPago"
              required
              class="select-input"
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="otros">Otros</option>
            </select>
          </div>

          <div class="form-group">
            <label for="membresiaPago">Membresía *</label>
            <select
              id="membresiaPago"
              v-model="nuevoPago.membresiaId"
              required
              class="select-input"
            >
              <option v-for="m in membresias" :key="m._id" :value="m._id">
                {{ m.nombre }} - ${{ m.precio.toLocaleString() }}
              </option>
            </select>
          </div>

          <div class="form-group" v-if="nuevoPago.tipoPago === 'otros'">
            <label for="detalleOtros">Detalle *</label>
            <input
              id="detalleOtros"
              v-model="nuevoPago.detalleOtros"
              type="text"
              placeholder="Especifica el tipo de pago"
              required
            />
          </div>

          <div v-if="error" class="error-message">
            {{ error }}
          </div>

          <div class="modal-actions">
            <button type="button" @click="closePaymentModal" class="cancel-button">
              Cancelar
            </button>
            <button type="submit" class="submit-button">
              Registrar Pago
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal para delegar alumno -->
    <div v-if="showDelegationModal && alumnoSeleccionado" class="modal-overlay" @click.self="closeDelegationModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Delegar Alumno</h2>
          <button @click="closeDelegationModal" class="close-button">×</button>
        </div>
        
        <div class="modal-student-info">
          <p>Vas a transferir a <strong>{{ alumnoSeleccionado.nombre }} {{ alumnoSeleccionado.apellido }}</strong> a otro entrenador.</p>
          <p class="delegate-warning-text">Una vez delegado, el alumno dejará de aparecer en tu lista.</p>
        </div>
        
        <div class="modal-form">
          <div class="form-group">
            <label for="trainerSelect">Seleccionar nuevo entrenador *</label>
            <div v-if="isLoadingTrainers" class="loading-mini">Cargando entrenadores...</div>
            <select
              v-else
              id="trainerSelect"
              v-model="trainerIdParaDelegar"
              required
              class="select-input"
            >
              <option value="" disabled>Selecciona un entrenador</option>
              <option v-for="t in entrenadores" :key="t._id" :value="t._id">
                {{ t.nombre }} (@{{ t.username }})
              </option>
            </select>
          </div>

          <div v-if="error" class="error-message">
            {{ error }}
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeDelegationModal" class="cancel-button" :disabled="isLoading">
              Cancelar
            </button>
            <button @click="confirmarDelegacion" class="submit-button" :disabled="isLoading || !trainerIdParaDelegar">
              {{ isLoading ? 'Delegando...' : 'Confirmar Delegación' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.alumnos-container {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--page-bg);
  padding: 20px;
  padding-bottom: 40px;
}

.action-buttons-group {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: auto;
}

.alumnos-header {
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

.alumnos-header h1 {
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

.alumnos-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stat-card {
  background: var(--card-bg);
  border-radius: 20px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  border: 2px solid var(--rheb-primary-green);
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

.alumnos-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.alumno-card {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  gap: 16px;
  border: 2px solid transparent;
  transition: all 0.2s;
  flex-wrap: wrap;
}

.alumno-card:active {
  transform: scale(0.98);
  border-color: var(--rheb-primary-green);
}

.alumno-info {
  flex: 1;
}

.alumno-name h3 {
  color: var(--header-text);
  font-size: 1.2rem;
  margin: 0;
  font-weight: 600;
}

.alumno-payment {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.payment-label {
  color: var(--subtitle-text);
  font-size: 0.85rem;
  margin: 0;
  font-weight: 500;
}

.payment-date {
  color: var(--header-text);
  font-size: 0.95rem;
  margin: 0;
  font-weight: 600;
}

.payment-type {
  color: var(--subtitle-text);
  font-size: 0.85rem;
  font-weight: 500;
  text-transform: capitalize;
}

.next-payment {
  color: var(--subtitle-text);
  font-size: 0.85rem;
  margin: 4px 0 0 0;
}

.membership-info-chip {
  display: inline-block;
  background-color: var(--rheb-dark-grey);
  color: var(--rheb-primary-green);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  margin-left: 8px;
  vertical-align: middle;
}

.edit-alumno-button-inline {
  background-color: var(--input-bg);
  border: 1px solid var(--input-border);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  width: 38px;
}

.edit-alumno-button-inline:hover {
  border-color: var(--rheb-primary-green);
  background-color: var(--rheb-dark-grey);
}

.delegate-alumno-button-inline {
  background-color: var(--input-bg);
  border: 1px solid var(--rheb-primary-green);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  width: 38px;
}

.delegate-alumno-button-inline:hover {
  background-color: var(--rheb-primary-green);
  color: var(--rheb-dark-grey);
  transform: translateY(-1px);
}

.delete-alumno-button-inline {
  background-color: var(--input-bg);
  border: 1px solid #ef4444;
  color: #ef4444;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  width: 38px;
}

.delete-alumno-button-inline:hover {
  background-color: #ef4444;
  color: white;
  transform: translateY(-1px);
}

[data-theme="dark"] .delete-alumno-button-inline:hover {
  background-color: #dc2626;
}

/* Delete Modal Styles */
.delete-confirmation-modal {
  text-align: center;
  max-width: 400px !important;
  padding: 40px 24px !important;
}

.delete-icon-large {
  font-size: 3rem;
  margin-bottom: 16px;
}

.delete-confirmation-modal h3 {
  color: var(--header-text);
  font-size: 1.5rem;
  margin: 0 0 12px 0;
}

.delete-confirmation-modal p {
  color: var(--subtitle-text);
  margin: 0 0 8px 0;
}

.delete-warning {
  color: #ef4444 !important;
  font-size: 0.85rem;
  font-weight: 600;
  margin-top: 16px !important;
}

.modal-actions-stacked {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 32px;
}

.confirm-delete-btn {
  background: #ef4444;
  color: white;
  border: 2px solid var(--rheb-black);
  padding: 14px;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.confirm-delete-btn:hover:not(:disabled) {
  background: #dc2626;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

.cancel-delete-btn {
  background: var(--rheb-dark-grey);
  color: white;
  border: 2px solid var(--rheb-black);
  padding: 14px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}

.cancel-delete-btn:hover {
  background: #3A3A3A;
}

.delete-alumno-button:active {
  transform: scale(0.9);
}

.history-button {
  margin-top: 12px;
  background-color: var(--rheb-dark-grey);
  color: var(--rheb-primary-green);
  border: 2px solid var(--rheb-black);
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  min-height: 36px;
}

.history-button:active {
  transform: scale(0.98);
  background-color: #3A3A3A;
}

.payment-history {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--input-border);
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.history-label {
  color: var(--header-text);
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: var(--input-bg);
  border-radius: 6px;
  font-size: 0.8rem;
}

.history-date {
  color: var(--header-text);
  font-weight: 500;
}

.history-type {
  color: var(--subtitle-text);
  text-transform: capitalize;
  font-size: 0.75rem;
  padding: 2px 8px;
  background: var(--card-bg);
  border-radius: 4px;
  border: 1px solid var(--input-border);
}

.history-membresia {
  color: var(--header-text);
  font-weight: 700;
  font-size: 0.75rem;
  margin-left: auto;
  padding-left: 10px;
}

.alumno-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  min-width: 120px;
}

.status-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
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
  color: var(--subtitle-text);
  font-weight: 600;
  text-align: center;
}

.register-payment-button {
  background: linear-gradient(135deg, var(--rheb-primary-green) 0%, #FFA500 100%);
  color: var(--rheb-dark-grey);
  border: 2px solid var(--rheb-black);
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  min-height: 40px;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.register-payment-button:active {
  transform: scale(0.98);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.empty-state {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  color: var(--rheb-accent-green);
  font-size: 1rem;
}

.payment-summary p {
  margin: 4px 0;
  color: var(--header-text);
  font-size: 1rem;
}

.modal-student-info {
  padding: 16px 24px;
  background: var(--input-bg);
  border-bottom: 1px solid var(--input-border);
}

.select-input {
  padding: 12px 16px;
  border: 2px solid var(--input-border);
  border-radius: 8px;
  font-size: 16px;
  font-family: inherit;
  background-color: var(--input-bg);
  cursor: pointer;
  transition: all 0.2s;
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%232D2D2D' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 40px;
}

.select-input:focus {
  outline: none;
  border-color: var(--rheb-primary-green);
  box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.15);
}

.add-button {
  background: linear-gradient(135deg, var(--rheb-primary-green) 0%, #FFA500 100%);
  color: var(--rheb-dark-grey);
  border: 2px solid var(--rheb-black);
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.add-button:active {
  transform: scale(0.98);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.add-icon {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
  -webkit-overflow-scrolling: touch;
}

.modal-content {
  background: var(--card-bg);
  border-radius: 20px;
  padding: 32px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 15px 50px rgba(0, 0, 0, 0.3);
  border: 2px solid var(--rheb-primary-green);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 2px solid var(--rheb-primary-green);
}

.modal-header h2 {
  color: var(--header-text);
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.close-button {
  background: transparent;
  border: none;
  font-size: 2rem;
  color: var(--rheb-dark-grey);
  cursor: pointer;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.2s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.close-button:active {
  background-color: #f3f4f6;
  transform: scale(0.95);
}

.modal-form {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.membership-option h4 {
  margin: 0 0 4px 0;
  font-size: 1rem;
  color: var(--header-text);
}

.form-group h4 {
  margin: 0 0 8px 0;
  font-size: 0.95rem;
  color: var(--header-text);
}

.form-group label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--header-text);
}

.form-group input,
.form-group select {
  padding: 12px;
  border: 2px solid var(--input-border);
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  transition: all 0.2s;
  -webkit-appearance: none;
  appearance: none;
}

.form-group input:focus {
  outline: none;
  border-color: var(--rheb-primary-green);
  box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.15);
}

.error-message {
  background-color: #fee2e2;
  color: #dc2626;
  padding: 12px;
  border-radius: 8px;
  font-size: 0.875rem;
  text-align: center;
}

.delegate-warning-text {
  color: #eab308;
  font-size: 0.85rem;
  font-weight: 600;
  margin-top: 8px;
}

.loading-mini {
  padding: 10px;
  text-align: center;
  color: var(--subtitle-text);
  font-style: italic;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.cancel-button {
  flex: 1;
  background-color: var(--rheb-dark-grey);
  color: var(--rheb-primary-green);
  border: 2px solid var(--rheb-black);
  padding: 14px;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  min-height: 48px;
}

.cancel-button:active {
  transform: scale(0.98);
  background-color: #3A3A3A;
}

.submit-button {
  flex: 1;
  background: linear-gradient(135deg, var(--rheb-primary-green) 0%, #FFA500 100%);
  color: var(--rheb-dark-grey);
  border: 2px solid var(--rheb-black);
  padding: 14px;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  min-height: 48px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.submit-button:active {
  transform: scale(0.98);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

@media (min-width: 480px) {
  .alumno-card {
    padding: 24px;
  }
  
  .add-button {
    padding: 12px 24px;
  }
}
</style>
