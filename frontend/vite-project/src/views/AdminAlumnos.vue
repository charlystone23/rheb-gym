<script setup>
import { ref, onMounted, computed } from "vue"
import { useRouter } from "vue-router"
import DateField from "../components/DateField.vue"
import { MongoService } from "../services/mongoService"
import { formatDateAR, parseDisplayDate } from "../utils/date"

const router = useRouter()
const entrenadores = ref([])
const isLoading = ref(false)
const error = ref("")
const currentUser = ref(null)
const expandedTrainers = ref({})
const expandedHistory = ref({})
const membresias = ref([])
const showEditPaymentModal = ref(false)
const showConfirmPaymentStep = ref(false)
const pagoAConfirmar = ref(null)
const isSavingPayment = ref(false)
const isDeletingPayment = ref(false)
const deactivatingAlumnoId = ref("")
const deletingInactiveAlumnoId = ref("")
const alumnoPagoEditando = ref(null)
const entrenadorPagoEditando = ref(null)
const pagoOriginalEditando = ref(null)
const pagoActual = ref({
  pagoId: "",
  fechaPago: "",
  mesQueAbona: new Date().getMonth() + 1,
  tipoPago: "efectivo",
  membresiaId: "",
  monto: "",
  montoContable: "",
  medio: "transferencia"
})
const currentYear = new Date().getFullYear()

const showPaymentModal = ref(false)
const alumnoSeleccionado = ref(null)
const entrenadorSeleccionado = ref(null)
const nuevoPago = ref({
  fechaPago: "",
  mesQueAbona: new Date().getMonth() + 1,
  tipoPago: "efectivo",
  membresiaId: "",
  montoDescuento: "",
  medioDescuento: "transferencia",
  pagoSimilar: false,
  montoSimilar: "",
  pagoParcial: false,
  montoParcial: ""
})

const paymentYear = computed(() => {
  const date = parseDisplayDate(nuevoPago.value.fechaPago)
  return date && !isNaN(date.getTime()) ? date.getFullYear() : new Date().getFullYear()
})

const editPaymentYear = computed(() => {
  const date = parseDisplayDate(pagoActual.value.fechaPago)
  return date && !isNaN(date.getTime()) ? date.getFullYear() : new Date().getFullYear()
})
const mesesQueAbona = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" }
]

function getNombreMes(mesNum) {
  const m = mesesQueAbona.find(item => item.value === Number(mesNum))
  return m ? m.label : `Mes ${mesNum}`
}

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

function getDisplayedPaymentAmount(pago) {
  if (!pago) return 0
  if (typeof pago.montoInformado === "number") return pago.montoInformado
  if (typeof pago.monto === "number") return pago.monto
  return Number(pago.monto || pago.membresia?.precio || 0)
}

function getSelectedMembershipPrice(membershipId) {
  return Number(membresias.value.find((m) => m._id === membershipId)?.precio || 0)
}

function resolveStoredAmounts({ tipoPago, montoIngresado, membresiaPrecio, pagoParcial = false }) {
  if (isPromisePayment(tipoPago)) {
    return { monto: 0, montoInformado: 0 }
  }

  if (pagoParcial) {
    return { monto: montoIngresado, montoInformado: montoIngresado }
  }

  if (isDiscountPayment(tipoPago)) {
    return {
      monto: membresiaPrecio,
      montoInformado: montoIngresado
    }
  }

  return {
    monto: montoIngresado,
    montoInformado: montoIngresado
  }
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

function isSameCalendarDay(firstDate, secondDate) {
  const first = new Date(firstDate)
  const second = new Date(secondDate)

  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return false

  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate()
}

function findSameDayPayment(alumno, fechaPagoDate, excludedPagoId = null) {
  if (!alumno?.historialPagos?.length) return null

  return alumno.historialPagos.find((pago) => {
    if (excludedPagoId && String(pago._id || pago.id) === String(excludedPagoId)) return false
    return isSameCalendarDay(pago.fecha, fechaPagoDate)
  }) || null
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
    const userStr = localStorage.getItem("user")
    currentUser.value = userStr ? JSON.parse(userStr) : null
    const [data, memberships] = await Promise.all([
      MongoService.getEntrenadores(true),
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

function getPagoPeriodoInfo(pago) {
  if (!pago) return null
  const fechaPago = new Date(pago.fecha)
  const month = Number(pago.mesQueAbona || (Number.isNaN(fechaPago.getTime()) ? null : fechaPago.getMonth() + 1))
  const year = Number(pago.anioQueAbona || (Number.isNaN(fechaPago.getTime()) ? null : fechaPago.getFullYear()))
  if (!month || !year || month < 1 || month > 12) return null
  return { month, year, date: new Date(year, month - 1, 1) }
}

function getUltimoPagoHastaPeriodo(alumno, referenceDate = new Date()) {
  if (!alumno.historialPagos || alumno.historialPagos.length === 0) return null

  const referenceMonth = referenceDate.getMonth() + 1
  const referenceYear = referenceDate.getFullYear()

  return [...alumno.historialPagos]
    .filter((pago) => {
      const periodo = getPagoPeriodoInfo(pago)
      if (!periodo) return false
      return periodo.year < referenceYear || (periodo.year === referenceYear && periodo.month <= referenceMonth)
    })
    .sort((a, b) => {
      const periodoA = getPagoPeriodoInfo(a)
      const periodoB = getPagoPeriodoInfo(b)
      const yearDiff = (periodoB?.year || 0) - (periodoA?.year || 0)
      if (yearDiff !== 0) return yearDiff
      const monthDiff = (periodoB?.month || 0) - (periodoA?.month || 0)
      if (monthDiff !== 0) return monthDiff
      return comparePagosDesc(a, b)
    })[0] || null
}

function findAlumnoById(alumnoId) {
  if (!alumnoId) return null
  const idStr = String(alumnoId._id || alumnoId.id || alumnoId)
  for (const entrenador of entrenadores.value) {
    const found = (entrenador.alumnos || []).find((a) => String(a._id || a.id) === idStr)
    if (found) return found
  }
  return null
}

const NOMBRES_MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

function formatPromoPeriodo(promo) {
  if (!promo) return ""
  let mInicio = promo.mesInicio
  let aInicio = promo.anioInicio
  let mFin = promo.mesFin
  let aFin = promo.anioFin

  if (!mInicio && promo.fechaInicio) {
    const d = new Date(promo.fechaInicio)
    mInicio = d.getMonth() + 1
    aInicio = d.getFullYear()
  }
  if (!mFin && promo.fechaFin) {
    const d = new Date(promo.fechaFin)
    mFin = d.getMonth() + 1
    aFin = d.getFullYear()
  }

  if (!mInicio || !aInicio) return ""

  const nombreInicio = NOMBRES_MESES[mInicio - 1]
  const nombreFin = mFin ? NOMBRES_MESES[mFin - 1] : nombreInicio

  if (mInicio === mFin && aInicio === aFin) {
    return `${nombreInicio} ${aInicio}`
  }
  if (aInicio === aFin) {
    return `${nombreInicio} - ${nombreFin} ${aInicio}`
  }
  return `${nombreInicio} ${aInicio} - ${nombreFin} ${aFin}`
}

function isPromo2x1Activa(alumno, referenceDate = new Date()) {
  if (!alumno?.promo2x1?.activo) return false
  const ref = new Date(referenceDate)

  if (alumno.promo2x1.mesFin && alumno.promo2x1.anioFin) {
    const refTotal = ref.getFullYear() * 12 + (ref.getMonth() + 1)
    const endTotal = Number(alumno.promo2x1.anioFin) * 12 + Number(alumno.promo2x1.mesFin)
    return refTotal <= endTotal
  }

  if (!alumno.promo2x1.fechaFin) return false
  const fin = new Date(alumno.promo2x1.fechaFin)
  fin.setHours(23, 59, 59, 999)
  return ref <= fin
}

function isPromo2x1AnexadoActiva(alumno, referenceDate = new Date()) {
  return isPromo2x1Activa(alumno, referenceDate) && alumno?.promo2x1?.rol === "anexado"
}

function getNombreVinculado(alumno) {
  if (!alumno?.promo2x1?.alumnoVinculado) return "Alumno vinculado"
  if (typeof alumno.promo2x1.alumnoVinculado === "object" && alumno.promo2x1.alumnoVinculado.nombre) {
    return `${alumno.promo2x1.alumnoVinculado.nombre} ${alumno.promo2x1.alumnoVinculado.apellido || ""}`.trim()
  }
  const encontrado = findAlumnoById(alumno.promo2x1.alumnoVinculado)
  if (encontrado) {
    return `${encontrado.nombre} ${encontrado.apellido || ""}`.trim()
  }
  return "Alumno vinculado"
}

function getProximaFechaPago(alumno, referenceDate = new Date()) {
  if (isPromo2x1AnexadoActiva(alumno, referenceDate)) {
    const titular = findAlumnoById(alumno.promo2x1?.alumnoVinculado)
    if (titular) {
      return getProximaFechaPago(titular, referenceDate)
    }
  }

  const ultimoPago = getUltimoPagoHastaPeriodo(alumno, referenceDate)
  const hoy = new Date(referenceDate)
  hoy.setHours(0, 0, 0, 0)

  if (!ultimoPago) {
    const fechaInicio = new Date(alumno.fechaRegistro || alumno.createdAt || hoy)
    fechaInicio.setHours(0, 0, 0, 0)
    return fechaInicio
  }

  const proximaFecha = new Date(ultimoPago.fecha)
  proximaFecha.setDate(proximaFecha.getDate() + 30)
  proximaFecha.setHours(0, 0, 0, 0)
  return proximaFecha
}

function getDaysUntilPayment(alumno, referenceDate = new Date()) {
  if (isPromo2x1AnexadoActiva(alumno, referenceDate)) {
    const titular = findAlumnoById(alumno.promo2x1?.alumnoVinculado)
    if (titular) {
      return getDaysUntilPayment(titular, referenceDate)
    }
  }

  const ultimoPago = getUltimoPagoHastaPeriodo(alumno, referenceDate)
  if (ultimoPago && (isPromisePayment(ultimoPago.tipo || ultimoPago.detalle) || hasPendingPartialPayment(alumno))) {
    return null
  }

  const hoy = new Date(referenceDate)
  hoy.setHours(0, 0, 0, 0)

  const proximaFecha = getProximaFechaPago(alumno, referenceDate)
  const dias = Math.ceil((proximaFecha - hoy) / (1000 * 60 * 60 * 24))
  return dias
}

function getPaymentStatus(alumno, referenceDate = new Date()) {
  if (isPromo2x1AnexadoActiva(alumno, referenceDate)) {
    const titular = findAlumnoById(alumno.promo2x1?.alumnoVinculado)
    if (titular) {
      return getPaymentStatus(titular, referenceDate)
    }
    return "green"
  }

  const ultimoPago = getUltimoPagoHastaPeriodo(alumno, referenceDate)
  if (ultimoPago && (isPromisePayment(ultimoPago.tipo || ultimoPago.detalle) || hasPendingPartialPayment(alumno))) {
    return "red"
  }

  const diasHastaPago = getDaysUntilPayment(alumno, referenceDate)
  if (diasHastaPago === null || diasHastaPago < 0) {
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

function getActiveAlumnos(entrenador) {
  return (entrenador.alumnos || []).filter((alumno) => alumno.estado !== "inactivo")
}

function getInactiveAlumnos(entrenador) {
  return (entrenador.alumnos || []).filter((alumno) => alumno.estado === "inactivo")
}

async function desactivarAlumno(entrenador, alumno) {
  const alumnoId = getAlumnoId(alumno)
  const confirmed = confirm(`¿Querés desactivar a ${alumno.nombre} ${alumno.apellido}? Se quitará de sus turnos y quedará en alumnos inactivos.`)
  if (!confirmed) return

  try {
    deactivatingAlumnoId.value = alumnoId
    error.value = ""

    const result = await MongoService.deleteAlumno(alumnoId, {
      role: currentUser.value?.role,
      userId: currentUser.value?._id
    })
    const alumnoActualizado = result?.alumno || result

    entrenadores.value = entrenadores.value.map((item) => {
      if (item._id !== entrenador._id) return item

      return {
        ...item,
        alumnos: (item.alumnos || []).map((existingAlumno) =>
          getAlumnoId(existingAlumno) === alumnoId
            ? { ...existingAlumno, ...alumnoActualizado, id: alumnoActualizado?._id || alumnoId }
            : existingAlumno
        )
      }
    })
  } catch (e) {
    console.error("Error deactivating alumno:", e)
    error.value = e.message || "No se pudo desactivar el alumno."
  } finally {
    deactivatingAlumnoId.value = ""
  }
}

async function reactivarAlumno(entrenador, alumno) {
  try {
    error.value = ""
    const alumnoActualizado = await MongoService.reactivarAlumno(getAlumnoId(alumno), currentUser.value)

    entrenadores.value = entrenadores.value.map((item) => {
      if (item._id !== entrenador._id) return item

      return {
        ...item,
        alumnos: (item.alumnos || []).map((existingAlumno) =>
          getAlumnoId(existingAlumno) === getAlumnoId(alumno)
            ? alumnoActualizado
            : existingAlumno
        )
      }
    })
  } catch (e) {
    console.error("Error reactivating alumno:", e)
    error.value = e.message || "No se pudo reactivar el alumno."
  }
}

async function eliminarAlumnoInactivo(entrenador, alumno) {
  const alumnoId = getAlumnoId(alumno)
  const confirmed = confirm(`¿Querés eliminar definitivamente a ${alumno.nombre} ${alumno.apellido}? Esta acción no se puede deshacer.`)
  if (!confirmed) return

  try {
    deletingInactiveAlumnoId.value = alumnoId
    error.value = ""

    await MongoService.deleteAlumnoPermanentemente(alumnoId, {
      role: currentUser.value?.role,
      userId: currentUser.value?._id
    })

    entrenadores.value = entrenadores.value.map((item) => {
      if (item._id !== entrenador._id) return item

      return {
        ...item,
        alumnos: (item.alumnos || []).filter((existingAlumno) =>
          getAlumnoId(existingAlumno) !== alumnoId
        )
      }
    })
  } catch (e) {
    console.error("Error deleting inactive alumno:", e)
    error.value = e.message || "No se pudo eliminar el alumno."
  } finally {
    deletingInactiveAlumnoId.value = ""
  }
}

function closeEditPaymentModal() {
  showEditPaymentModal.value = false
  isSavingPayment.value = false
  isDeletingPayment.value = false
  alumnoPagoEditando.value = null
  entrenadorPagoEditando.value = null
  pagoOriginalEditando.value = null
  pagoActual.value = {
    pagoId: "",
    fechaPago: "",
    mesQueAbona: new Date().getMonth() + 1,
    tipoPago: "efectivo",
    membresiaId: "",
    monto: "",
    montoContable: "",
    medio: "transferencia"
  }
}

function replaceAlumnoInTrainer(entrenadorId, alumnoActualizado) {
  entrenadores.value = entrenadores.value.map((entrenador) => {
    if (entrenador._id !== entrenadorId) return entrenador

    return {
      ...entrenador,
      alumnos: (entrenador.alumnos || []).map((alumno) =>
        getAlumnoId(alumno) === getAlumnoId(alumnoActualizado)
          ? alumnoActualizado
          : alumno
      )
    }
  })
}

function replaceAlumnoAnywhere(alumnoActualizado) {
  if (!alumnoActualizado) return
  const idStr = String(getAlumnoId(alumnoActualizado))
  entrenadores.value = entrenadores.value.map((entrenador) => ({
    ...entrenador,
    alumnos: (entrenador.alumnos || []).map((alumno) =>
      String(getAlumnoId(alumno)) === idStr ? { ...alumno, ...alumnoActualizado } : alumno
    )
  }))
}

// --- PROMO 2x1 MODAL & ACTIONS ---
const showPromo2x1Modal = ref(false)
const alumnoPromoSeleccionado = ref(null)
const entrenadorPromoSeleccionado = ref(null)
const isSavingPromo2x1 = ref(false)
const promo2x1Error = ref("")
const promo2x1Success = ref("")

const currentMonthNumber = new Date().getMonth() + 1
const currentYearNumber = new Date().getFullYear()

const opcionesMeses = [
  { val: 1, label: "Enero" },
  { val: 2, label: "Febrero" },
  { val: 3, label: "Marzo" },
  { val: 4, label: "Abril" },
  { val: 5, label: "Mayo" },
  { val: 6, label: "Junio" },
  { val: 7, label: "Julio" },
  { val: 8, label: "Agosto" },
  { val: 9, label: "Septiembre" },
  { val: 10, label: "Octubre" },
  { val: 11, label: "Noviembre" },
  { val: 12, label: "Diciembre" }
]

const opcionesAnios = computed(() => {
  const current = new Date().getFullYear()
  return [current - 1, current, current + 1, current + 2]
})

const promo2x1Form = ref({
  alumnoAnexadoId: "",
  meses: 1,
  mesInicio: currentMonthNumber,
  anioInicio: currentYearNumber,
  searchFilter: ""
})

const promoRenovarForm = ref({
  meses: 1,
  modoInicio: "consecutivo",
  mesInicio: currentMonthNumber,
  anioInicio: currentYearNumber
})

const todosLosAlumnosActivos = computed(() => {
  const list = []
  const currentId = alumnoPromoSeleccionado.value ? String(getAlumnoId(alumnoPromoSeleccionado.value)) : ""
  entrenadores.value.forEach((entrenador) => {
    (entrenador.alumnos || []).forEach((alumno) => {
      const id = String(getAlumnoId(alumno))
      if (alumno.estado !== "inactivo" && id !== currentId) {
        list.push({
          id,
          _id: id,
          nombreCompleto: `${alumno.nombre} ${alumno.apellido}`.trim(),
          entrenadorNombre: `${entrenador.nombre} ${entrenador.apellido || ""}`.trim(),
          celular: alumno.celular || "",
          promo2x1: alumno.promo2x1
        })
      }
    })
  })
  return list.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto))
})

const alumnosFiltradosParaPromo = computed(() => {
  const q = promo2x1Form.value.searchFilter.trim().toLowerCase()
  if (!q) return todosLosAlumnosActivos.value
  return todosLosAlumnosActivos.value.filter((a) =>
    a.nombreCompleto.toLowerCase().includes(q) ||
    a.entrenadorNombre.toLowerCase().includes(q)
  )
})

const periodoEstimadoPromo = computed(() => {
  const m = Number(promo2x1Form.value.mesInicio) || currentMonthNumber
  const a = Number(promo2x1Form.value.anioInicio) || currentYearNumber
  const duracion = Math.max(1, parseInt(promo2x1Form.value.meses, 10) || 1)

  const totalFin = (a * 12 + (m - 1)) + (duracion - 1)
  const aFin = Math.floor(totalFin / 12)
  const mFin = (totalFin % 12) + 1

  const nombreInicio = NOMBRES_MESES[m - 1]
  const nombreFin = NOMBRES_MESES[mFin - 1]

  if (duracion === 1) {
    return `${nombreInicio} ${a}`
  }
  if (a === aFin) {
    return `${nombreInicio} a ${nombreFin} ${a}`
  }
  return `${nombreInicio} ${a} a ${nombreFin} ${aFin}`
})

const periodoEstimadoRenovacion = computed(() => {
  const duracion = Math.max(1, parseInt(promoRenovarForm.value.meses, 10) || 1)
  let m = Number(promoRenovarForm.value.mesInicio) || currentMonthNumber
  let a = Number(promoRenovarForm.value.anioInicio) || currentYearNumber

  if (promoRenovarForm.value.modoInicio === "consecutivo") {
    const curPromo = alumnoPromoSeleccionado.value?.promo2x1
    if (curPromo?.mesFin && curPromo?.anioFin) {
      const nextTotal = (Number(curPromo.anioFin) * 12 + (Number(curPromo.mesFin) - 1)) + 1
      a = Math.floor(nextTotal / 12)
      m = (nextTotal % 12) + 1
    }
  }

  const totalFin = (a * 12 + (m - 1)) + (duracion - 1)
  const aFin = Math.floor(totalFin / 12)
  const mFin = (totalFin % 12) + 1

  const nombreInicio = NOMBRES_MESES[m - 1]
  const nombreFin = NOMBRES_MESES[mFin - 1]

  if (duracion === 1) {
    return `${nombreInicio} ${a}`
  }
  if (a === aFin) {
    return `${nombreInicio} a ${nombreFin} ${a}`
  }
  return `${nombreInicio} ${a} a ${nombreFin} ${aFin}`
})

function openPromo2x1Modal(entrenador, alumno) {
  entrenadorPromoSeleccionado.value = entrenador
  alumnoPromoSeleccionado.value = alumno
  promo2x1Error.value = ""
  promo2x1Success.value = ""
  const now = new Date()
  promo2x1Form.value = {
    alumnoAnexadoId: "",
    meses: 1,
    mesInicio: now.getMonth() + 1,
    anioInicio: now.getFullYear(),
    searchFilter: ""
  }
  promoRenovarForm.value = {
    meses: 1,
    modoInicio: "consecutivo",
    mesInicio: now.getMonth() + 1,
    anioInicio: now.getFullYear()
  }
  showPromo2x1Modal.value = true
}

function closePromo2x1Modal() {
  showPromo2x1Modal.value = false
  alumnoPromoSeleccionado.value = null
  entrenadorPromoSeleccionado.value = null
  promo2x1Error.value = ""
  promo2x1Success.value = ""
}

async function vincularPromo2x1() {
  if (!promo2x1Form.value.alumnoAnexadoId) {
    promo2x1Error.value = "Seleccioná al alumno que será anexado en el 2x1."
    return
  }
  const mesesNum = parseInt(promo2x1Form.value.meses, 10)
  if (!mesesNum || mesesNum < 1) {
    promo2x1Error.value = "La cantidad de meses debe ser al menos 1."
    return
  }

  try {
    isSavingPromo2x1.value = true
    promo2x1Error.value = ""
    promo2x1Success.value = ""

    const titularId = getAlumnoId(alumnoPromoSeleccionado.value)
    const result = await MongoService.vincularPromo2x1({
      alumnoTitularId: titularId,
      alumnoAnexadoId: promo2x1Form.value.alumnoAnexadoId,
      meses: mesesNum,
      mesInicio: Number(promo2x1Form.value.mesInicio),
      anioInicio: Number(promo2x1Form.value.anioInicio)
    })

    replaceAlumnoAnywhere(result.titular)
    replaceAlumnoAnywhere(result.anexado)
    alumnoPromoSeleccionado.value = result.titular

    promo2x1Success.value = `¡Promo 2x1 vinculada con éxito para ${periodoEstimadoPromo.value}!`
  } catch (err) {
    console.error(err)
    promo2x1Error.value = err.message || "Error al vincular promo 2x1."
  } finally {
    isSavingPromo2x1.value = false
  }
}

async function renovarPromo2x1() {
  const mesesNum = parseInt(promoRenovarForm.value.meses, 10)
  if (!mesesNum || mesesNum < 1) {
    promo2x1Error.value = "La cantidad de meses a renovar debe ser al menos 1."
    return
  }

  let mInicio = null
  let aInicio = null
  if (promoRenovarForm.value.modoInicio === "mes_especifico") {
    mInicio = Number(promoRenovarForm.value.mesInicio)
    aInicio = Number(promoRenovarForm.value.anioInicio)
  }

  try {
    isSavingPromo2x1.value = true
    promo2x1Error.value = ""
    promo2x1Success.value = ""

    const alumnoId = getAlumnoId(alumnoPromoSeleccionado.value)
    const result = await MongoService.renovarPromo2x1({
      alumnoId,
      meses: mesesNum,
      mesInicio: mInicio,
      anioInicio: aInicio
    })

    replaceAlumnoAnywhere(result.titular)
    replaceAlumnoAnywhere(result.anexado)

    const updatedSelected = String(getAlumnoId(result.titular)) === String(alumnoId) ? result.titular : result.anexado
    alumnoPromoSeleccionado.value = updatedSelected

    promo2x1Success.value = `¡Promo 2x1 renovada por ${mesesNum} mes(es) adicionales!`
  } catch (err) {
    console.error(err)
    promo2x1Error.value = err.message || "Error al renovar la promo 2x1."
  } finally {
    isSavingPromo2x1.value = false
  }
}

async function desvincularPromo2x1() {
  const confirmed = confirm("¿Estás seguro de que querés desvincular esta promo 2x1? Ambos alumnos volverán a gestionarse de forma independiente.")
  if (!confirmed) return

  try {
    isSavingPromo2x1.value = true
    promo2x1Error.value = ""
    promo2x1Success.value = ""

    const alumnoId = getAlumnoId(alumnoPromoSeleccionado.value)
    const vinculadoId = alumnoPromoSeleccionado.value?.promo2x1?.alumnoVinculado?._id || alumnoPromoSeleccionado.value?.promo2x1?.alumnoVinculado

    await MongoService.desvincularPromo2x1(alumnoId)

    if (alumnoPromoSeleccionado.value) {
      alumnoPromoSeleccionado.value.promo2x1 = {
        activo: false,
        rol: null,
        alumnoVinculado: null,
        meses: 0,
        fechaInicio: null,
        fechaFin: null
      }
      replaceAlumnoAnywhere(alumnoPromoSeleccionado.value)
    }

    if (vinculadoId) {
      const vinculado = findAlumnoById(vinculadoId)
      if (vinculado) {
        vinculado.promo2x1 = {
          activo: false,
          rol: null,
          alumnoVinculado: null,
          meses: 0,
          fechaInicio: null,
          fechaFin: null
        }
        replaceAlumnoAnywhere(vinculado)
      }
    }

    promo2x1Success.value = "Promo 2x1 desvinculada exitosamente. Ambos alumnos son ahora independientes."
  } catch (err) {
    console.error(err)
    promo2x1Error.value = err.message || "Error al desvincular promo 2x1."
  } finally {
    isSavingPromo2x1.value = false
  }
}

function openEditPaymentModal(entrenador, alumno, pagoSeleccionado = null) {
  const pagoAEditar = pagoSeleccionado || getUltimoPago(alumno)
  if (!pagoAEditar?._id) {
    error.value = "Este alumno no tiene pagos para editar."
    return
  }

  const membresiaId =
    pagoAEditar.membresia?.id ||
    pagoAEditar.membresia?._id ||
    membresias.value.find((m) => m.nombre === pagoAEditar.membresia?.nombre)?._id ||
    membresias.value[0]?._id ||
    ""

  entrenadorPagoEditando.value = entrenador
  alumnoPagoEditando.value = alumno
  pagoOriginalEditando.value = pagoAEditar
  pagoActual.value = {
    pagoId: pagoAEditar._id,
    fechaPago: formatDateAR(pagoAEditar.fecha),
    mesQueAbona: Number(pagoAEditar.mesQueAbona || (new Date(pagoAEditar.fecha).getMonth() + 1)),
    tipoPago: normalizePaymentType(pagoAEditar.tipo || pagoAEditar.detalle) || "efectivo",
    membresiaId,
    monto: String(pagoAEditar.montoInformado ?? pagoAEditar.monto ?? pagoAEditar.membresia?.precio ?? ""),
    montoContable: String(pagoAEditar.monto ?? pagoAEditar.membresia?.precio ?? ""),
    medio: pagoAEditar.medio || "transferencia"
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

  const pagoBase = pagoOriginalEditando.value
  const selectedMembresia = membresias.value.find((m) => m._id === pagoActual.value.membresiaId)

  if (!selectedMembresia) {
    error.value = "Seleccioná una membresía válida."
    return
  }

  const tipoNormalizado = normalizePaymentType(pagoActual.value.tipoPago)

  const isNewPagoPartial = pagoBase?.esParcial || pagoBase?.completaParcial
  const isNewPagoPromise = isPromisePayment(tipoNormalizado)

  if (!isNewPagoPartial && !isNewPagoPromise) {
    const hasDuplicatePeriod = alumnoPagoEditando.value.historialPagos?.some(p => {
      if (p._id === pagoActual.value.pagoId) return false
      const isExistingPagoPartial = p.esParcial || p.completaParcial
      const isExistingPagoPromise = isPromisePayment(p.tipo || p.detalle)
      return p.mesQueAbona === Number(pagoActual.value.mesQueAbona) &&
             p.anioQueAbona === editPaymentYear.value &&
             !isExistingPagoPartial &&
             !isExistingPagoPromise
    })

    if (hasDuplicatePeriod) {
      error.value = `El alumno ya tiene otro pago completo registrado para el período ${pagoActual.value.mesQueAbona}/${editPaymentYear.value}.`
      return
    }
  }

  const sameDayPayment = findSameDayPayment(alumnoPagoEditando.value, fechaPagoDate, pagoActual.value.pagoId)
  let allowDuplicateSameDay = false

  if (sameDayPayment) {
    const confirmed = confirm("Este alumno ya tiene otro pago cargado en esa misma fecha. ¿Querés guardar la edición igualmente?")
    if (!confirmed) {
      error.value = "No se guardó el pago duplicado."
      return
    }
    allowDuplicateSameDay = true
  }

  const payload = {
    fecha: fechaPagoDate,
    mesQueAbona: Number(pagoActual.value.mesQueAbona || (fechaPagoDate.getMonth() + 1)),
    anioQueAbona: editPaymentYear.value,
    tipo: tipoNormalizado,
    detalle: isPromisePayment(tipoNormalizado)
      ? "Promesa de Pago"
      : isDiscountPayment(tipoNormalizado)
        ? "Descuento"
        : "",
    medio: isDiscountPayment(tipoNormalizado) ? (pagoActual.value.medio || "transferencia") : "",
    membresia: {
      id: selectedMembresia._id,
      nombre: selectedMembresia.nombre,
      precio: selectedMembresia.precio
    },
    ...resolveStoredAmounts({
      tipoPago: tipoNormalizado,
      montoIngresado: monto,
      membresiaPrecio: Number(selectedMembresia.precio || 0),
      pagoParcial: Boolean(pagoBase?.esParcial)
    }),
    esParcial: pagoBase?.esParcial || false,
    completaParcial: pagoBase?.completaParcial || false,
    montoObjetivo: pagoBase?.montoObjetivo ?? null,
    saldoPendiente: pagoBase?.saldoPendiente ?? 0,
    allowDuplicateSameDay
  }

  try {
    isSavingPayment.value = true
    error.value = ""

    const alumnoActualizado = await MongoService.updatePago(
      getAlumnoId(alumnoPagoEditando.value),
      pagoActual.value.pagoId,
      payload
    )

    replaceAlumnoInTrainer(entrenadorPagoEditando.value?._id, alumnoActualizado)

    closeEditPaymentModal()
  } catch (e) {
    console.error("Error updating payment:", e)
    if (e.status === 409 && e.code === "DUPLICATE_PAYMENT_SAME_DAY") {
      const confirmed = confirm("El sistema detectó otro pago en esa misma fecha. ¿Querés guardar la edición igualmente?")
      if (!confirmed) {
        error.value = "No se guardó el pago duplicado."
        return
      }

      try {
        const alumnoActualizado = await MongoService.updatePago(
          getAlumnoId(alumnoPagoEditando.value),
          pagoActual.value.pagoId,
          {
            ...payload,
            allowDuplicateSameDay: true
          }
        )

        replaceAlumnoInTrainer(entrenadorPagoEditando.value?._id, alumnoActualizado)

        closeEditPaymentModal()
        return
      } catch (retryError) {
        console.error("Error updating payment:", retryError)
        error.value = retryError.message || "No se pudo actualizar el pago."
        return
      }
    }

    error.value = e.message || "No se pudo actualizar el pago."
  } finally {
    isSavingPayment.value = false
  }
}

async function eliminarPagoEditando() {
  if (!alumnoPagoEditando.value || !pagoActual.value.pagoId) return

  const confirmed = confirm("¿Querés eliminar este pago? Esta acción no se puede deshacer.")
  if (!confirmed) return

  try {
    isDeletingPayment.value = true
    error.value = ""

    const alumnoActualizado = await MongoService.deletePago(
      getAlumnoId(alumnoPagoEditando.value),
      pagoActual.value.pagoId
    )

    replaceAlumnoInTrainer(entrenadorPagoEditando.value?._id, alumnoActualizado)
    closeEditPaymentModal()
  } catch (e) {
    console.error("Error deleting payment:", e)
    error.value = e.message || "No se pudo eliminar el pago."
  } finally {
    isDeletingPayment.value = false
  }
}

function getPendingPartialAmount(alumno) {
  const ultimoPago = getUltimoPago(alumno)
  if (!ultimoPago?.esParcial) return 0
  return Number(ultimoPago.saldoPendiente || 0)
}

function shouldShowCustomAmountForPayment() {
  return nuevoPago.value.pagoSimilar || isDiscountPayment(nuevoPago.value.tipoPago) || hasPendingPartialPayment(alumnoSeleccionado.value)
}

function applySimilarPaymentFromLast(alumno) {
  const ultimoPago = getUltimoPago(alumno)
  if (!ultimoPago) return

  const tipoNormalizado = normalizePaymentType(ultimoPago.tipo || ultimoPago.detalle)
  const membresiaId = ultimoPago.membresia?.id || ultimoPago.membresia?._id || nuevoPago.value.membresiaId

  nuevoPago.value.tipoPago = tipoNormalizado || "efectivo"
  nuevoPago.value.membresiaId = membresiaId || nuevoPago.value.membresiaId
  nuevoPago.value.montoSimilar = String(getDisplayedPaymentAmount(ultimoPago))
  nuevoPago.value.medioDescuento = ultimoPago.medio || "transferencia"
}

function handlePagoSimilarChange() {
  if (!nuevoPago.value.pagoSimilar) {
    nuevoPago.value.montoSimilar = ""
    if (isDiscountPayment(nuevoPago.value.tipoPago)) {
      nuevoPago.value.medioDescuento = nuevoPago.value.medioDescuento || "transferencia"
    }
    return
  }

  if (alumnoSeleccionado.value) {
    applySimilarPaymentFromLast(alumnoSeleccionado.value)
  }
}

function getBaseAmountForCurrentPayment(selectedM, alumno) {
  if (hasPendingPartialPayment(alumno)) {
    return getPendingPartialAmount(alumno)
  }

  if (nuevoPago.value.pagoSimilar && nuevoPago.value.montoSimilar !== "" && !isNaN(Number(nuevoPago.value.montoSimilar))) {
    return Number(nuevoPago.value.montoSimilar)
  }

  if (isDiscountPayment(nuevoPago.value.tipoPago) && nuevoPago.value.montoDescuento !== "" && !isNaN(Number(nuevoPago.value.montoDescuento))) {
    return Number(nuevoPago.value.montoDescuento)
  }

  return selectedM ? selectedM.precio : 0
}

function openPaymentModal(entrenador, alumno) {
  entrenadorSeleccionado.value = entrenador
  alumnoSeleccionado.value = alumno
  showPaymentModal.value = true
  error.value = ""
  
  let defaultMembresiaId = ""
  const ultimoPago = getUltimoPago(alumno)
  
  if (ultimoPago && ultimoPago.membresia && ultimoPago.membresia.nombre) {
    const mEncontrada = membresias.value.find(m => m.nombre === ultimoPago.membresia.nombre)
    if (mEncontrada) {
      defaultMembresiaId = mEncontrada._id
    }
  }
  
  if (!defaultMembresiaId) {
    const defaultM = membresias.value.find(m => m.nombre.includes('3 días')) || membresias.value[0]
    if (defaultM) defaultMembresiaId = defaultM._id
  }
  
  nuevoPago.value = {
    fechaPago: formatDateAR(new Date()),
    mesQueAbona: new Date().getMonth() + 1,
    tipoPago: "efectivo",
    membresiaId: defaultMembresiaId,
    montoDescuento: "",
    medioDescuento: "transferencia",
    pagoSimilar: false,
    montoSimilar: "",
    pagoParcial: false,
    montoParcial: ""
  }

  if (hasPendingPartialPayment(alumno)) {
    const ultimoPago = getUltimoPago(alumno)
    nuevoPago.value.tipoPago = normalizePaymentType(ultimoPago.tipo || ultimoPago.detalle) || "efectivo"
    nuevoPago.value.membresiaId = ultimoPago.membresia?.id || ultimoPago.membresia?._id || defaultMembresiaId
    nuevoPago.value.montoSimilar = String(getPendingPartialAmount(alumno))
    nuevoPago.value.medioDescuento = ultimoPago.medio || "transferencia"
  }
}

function closePaymentModal() {
  showPaymentModal.value = false
  showConfirmPaymentStep.value = false
  pagoAConfirmar.value = null
  alumnoSeleccionado.value = null
  entrenadorSeleccionado.value = null
  error.value = ""
  nuevoPago.value = {
    fechaPago: "",
    mesQueAbona: new Date().getMonth() + 1,
    tipoPago: "efectivo",
    membresiaId: "",
    montoDescuento: "",
    medioDescuento: "transferencia",
    pagoSimilar: false,
    montoSimilar: "",
    pagoParcial: false,
    montoParcial: ""
  }
}

function prepararConfirmacionPago() {
  if (!alumnoSeleccionado.value) return
  error.value = ""
  
  if (!nuevoPago.value.fechaPago) {
    error.value = "La fecha de pago es requerida"
    return
  }
  
  const fechaRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/
  if (!fechaRegex.test(nuevoPago.value.fechaPago)) {
    error.value = "La fecha debe tener el formato dd/mm/yyyy"
    return
  }
  
  const fechaPagoDate = parseDisplayDate(nuevoPago.value.fechaPago)
  if (!fechaPagoDate || isNaN(fechaPagoDate.getTime())) {
    error.value = "La fecha ingresada no es válida"
    return
  }
  fechaPagoDate.setHours(0, 0, 0, 0)
  
  const tipoFinal = nuevoPago.value.tipoPago
  const selectedM = membresias.value.find(m => m._id === nuevoPago.value.membresiaId)
  const hadPendingPartial = hasPendingPartialPayment(alumnoSeleccionado.value)
  const ultimoPago = getUltimoPago(alumnoSeleccionado.value)
  const montoBase = getBaseAmountForCurrentPayment(selectedM, alumnoSeleccionado.value)
  let montoCalculado = montoBase

  if (nuevoPago.value.pagoParcial) {
    if (isPromisePayment(tipoFinal)) {
      error.value = "No podés registrar una promesa de pago como pago parcial."
      return
    }

    if (nuevoPago.value.montoParcial === "" || isNaN(Number(nuevoPago.value.montoParcial))) {
      error.value = "Ingresá el monto abonado en esta parte del pago."
      return
    }

    const montoParcial = Number(nuevoPago.value.montoParcial)
    if (montoParcial <= 0) {
      error.value = "El monto parcial debe ser mayor a cero."
      return
    }

    if (montoParcial > montoBase) {
      error.value = "El monto parcial no puede superar el total pendiente."
      return
    }

    montoCalculado = montoParcial
  }

  const isNewPagoPartial = nuevoPago.value.pagoParcial || hadPendingPartial
  const isNewPagoPromise = isPromisePayment(tipoFinal)

  if (!isNewPagoPartial && !isNewPagoPromise) {
    const hasDuplicatePeriod = alumnoSeleccionado.value.historialPagos?.some(p => {
      const isExistingPagoPartial = p.esParcial || p.completaParcial
      const isExistingPagoPromise = isPromisePayment(p.tipo || p.detalle)
      return p.mesQueAbona === Number(nuevoPago.value.mesQueAbona) &&
             p.anioQueAbona === paymentYear.value &&
             !isExistingPagoPartial &&
             !isExistingPagoPromise
    })

    if (hasDuplicatePeriod) {
      error.value = `El alumno ya tiene un pago completo registrado para el período ${nuevoPago.value.mesQueAbona}/${paymentYear.value}.`
      return
    }
  }

  const completaConMontoExacto = nuevoPago.value.pagoParcial && montoCalculado === montoBase
  const sameDayPayment = findSameDayPayment(alumnoSeleccionado.value, fechaPagoDate)
  let allowDuplicateSameDay = false

  if (sameDayPayment) {
    const confirmed = confirm("Este alumno ya tiene un pago cargado en esa misma fecha. ¿Querés registrar otro pago igualmente?")
    if (!confirmed) {
      error.value = "No se registró el pago duplicado."
      return
    }
    allowDuplicateSameDay = true
  }

  pagoAConfirmar.value = {
    fecha: fechaPagoDate,
    mesQueAbona: Number(nuevoPago.value.mesQueAbona || (fechaPagoDate.getMonth() + 1)),
    anioQueAbona: paymentYear.value,
    tipo: isPromisePayment(tipoFinal) ? "promesa de pago" : tipoFinal,
    detalle: completaConMontoExacto
      ? "Completa pago parcial"
      : nuevoPago.value.pagoParcial
      ? "Pago parcial"
      : hadPendingPartial
        ? "Completa pago parcial"
        : isPromisePayment(tipoFinal)
      ? "Promesa de Pago"
      : isDiscountPayment(tipoFinal)
        ? "Descuento"
        : "",
    medio: isDiscountPayment(tipoFinal) ? nuevoPago.value.medioDescuento : "",
    esParcial: nuevoPago.value.pagoParcial && !completaConMontoExacto,
    completaParcial: completaConMontoExacto || (!nuevoPago.value.pagoParcial && hadPendingPartial),
    montoObjetivo: nuevoPago.value.pagoParcial && !completaConMontoExacto
      ? (hadPendingPartial ? Number(ultimoPago?.montoObjetivo || montoBase + montoCalculado) : montoBase)
      : (hadPendingPartial ? Number(ultimoPago?.montoObjetivo || montoBase) : null),
    saldoPendiente: nuevoPago.value.pagoParcial && !completaConMontoExacto ? Number((montoBase - montoCalculado).toFixed(2)) : 0,
    clientCreatedAt: new Date().toISOString(),
    membresia: selectedM ? {
      id: selectedM._id,
      nombre: selectedM.nombre,
      precio: selectedM.precio
    } : null,
    ...resolveStoredAmounts({
      tipoPago: tipoFinal,
      montoIngresado: montoCalculado,
      membresiaPrecio: Number(selectedM?.precio || 0),
      pagoParcial: nuevoPago.value.pagoParcial
    }),
    allowDuplicateSameDay
  }

  showConfirmPaymentStep.value = true
}

function volverAEditarPago() {
  showConfirmPaymentStep.value = false
  error.value = ""
}

async function confirmarYGuardarPago() {
  if (!alumnoSeleccionado.value || !pagoAConfirmar.value) return
  error.value = ""
  
  const nuevoPagoObj = pagoAConfirmar.value
  
  try {
    isLoading.value = true
    const updatedAlumno = await MongoService.addPago(alumnoSeleccionado.value._id || alumnoSeleccionado.value.id, nuevoPagoObj)
    
    replaceAlumnoInTrainer(entrenadorSeleccionado.value?._id, updatedAlumno)
    
    closePaymentModal()
  } catch (e) {
    console.error(e)
    if (e.status === 409 && e.code === "DUPLICATE_PAYMENT_SAME_DAY") {
      const confirmed = confirm("El sistema detectó que ya existe un pago ese mismo día. ¿Querés guardarlo igual?")
      if (!confirmed) {
        error.value = "No se registró el pago duplicado."
        return
      }

      try {
        const updatedAlumno = await MongoService.addPago(alumnoSeleccionado.value._id || alumnoSeleccionado.value.id, {
          ...nuevoPagoObj,
          allowDuplicateSameDay: true
        })

        replaceAlumnoInTrainer(entrenadorSeleccionado.value?._id, updatedAlumno)
        closePaymentModal()
        return
      } catch (retryError) {
        console.error(retryError)
        error.value = retryError.message || "Error al registrar pago en MongoDB"
        return
      }
    }

    error.value = e.message || "Error al registrar pago en MongoDB"
  } finally {
    isLoading.value = false
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
              <p class="alumnos-count">{{ getActiveAlumnos(entrenador).length }} activo(s) · {{ getInactiveAlumnos(entrenador).length }} inactivo(s)</p>
            </div>
            <button @click="toggleTrainer(entrenador._id)" class="toggle-button">
              {{ isTrainerExpanded(entrenador._id) ? 'Ocultar' : 'Ver' }} Alumnos
            </button>
          </div>

          <div class="alumnos-section" v-if="isTrainerExpanded(entrenador._id)">
            <div 
              v-for="alumno in getActiveAlumnos(entrenador)" 
              :key="alumno.id" 
              class="alumno-item"
            >
              <div class="alumno-details">
                <div class="alumno-header-row">
                  <h3>
                    {{ alumno.nombre }} {{ alumno.apellido }}
                    <span v-if="hasPendingPartialPayment(alumno)" class="partial-indicator">*</span>
                    <span
                      v-if="alumno.promo2x1?.activo && isPromo2x1Activa(alumno)"
                      class="promo-badge"
                      :class="alumno.promo2x1.rol"
                      :title="`Promo 2x1: ${formatPromoPeriodo(alumno.promo2x1)}`"
                    >
                      🏷️ 2x1 {{ alumno.promo2x1.rol === 'titular' ? 'Titular' : 'Anexado' }} ({{ formatPromoPeriodo(alumno.promo2x1) }})
                    </span>
                    <span
                      v-else-if="alumno.promo2x1?.activo && !isPromo2x1Activa(alumno)"
                      class="promo-badge expired"
                      :title="`Promo 2x1 vencida: ${formatPromoPeriodo(alumno.promo2x1)}`"
                    >
                      ⚠️ 2x1 Vencido ({{ formatPromoPeriodo(alumno.promo2x1) }})
                    </span>
                  </h3>
                </div>
                <div class="alumno-payment-info">
                  <p v-if="alumno.celular" class="alumno-phone">📱 {{ alumno.celular }}</p>
                  <p v-if="isPromo2x1AnexadoActiva(alumno)" class="payment-info promo-covered-text">
                    ✨ Cubierto por membresía 2x1 de <strong>{{ getNombreVinculado(alumno) }}</strong> ({{ formatPromoPeriodo(alumno.promo2x1) }})
                  </p>
                  <p v-if="getUltimoPago(alumno)" class="payment-info">
                    Último pago: {{ formatDate(getUltimoPago(alumno).fecha) }} 
                    <span class="payment-type">({{ getPaymentLabel(getUltimoPago(alumno)) }})</span>
                    <span v-if="getDisplayedPaymentAmount(getUltimoPago(alumno))" class="payment-amount">
                      <span class="separator">|</span> ${{ getDisplayedPaymentAmount(getUltimoPago(alumno)) }}
                    </span>
                  </p>
                  <p v-else-if="!isPromo2x1AnexadoActiva(alumno)" class="payment-info">Sin pagos registrados</p>
                  <div class="payment-actions-row">
                    <button
                      type="button"
                      @click="openPaymentModal(entrenador, alumno)"
                      class="edit-payment-button register-payment-btn"
                    >
                      Registrar pago
                    </button>
                    <button
                      type="button"
                      @click="openPromo2x1Modal(entrenador, alumno)"
                      class="promo-2x1-btn"
                      :class="{ 'has-promo': alumno.promo2x1?.activo }"
                    >
                      🏷️ {{ alumno.promo2x1?.activo ? 'Gestionar 2x1' : 'Promo 2x1' }}
                    </button>
                    <button
                      v-if="getUltimoPago(alumno)"
                      @click="openEditPaymentModal(entrenador, alumno, getUltimoPago(alumno))"
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
                      <div class="mini-history-main">
                        <span class="mini-date">{{ formatDate(pago.fecha) }}</span>
                        <span class="mini-type">{{ getPaymentLabel(pago) }}</span>
                        <span v-if="pago.membresia" class="mini-membresia">{{ pago.membresia.nombre }}</span>
                        <span v-if="getDisplayedPaymentAmount(pago)" class="mini-monto">${{ getDisplayedPaymentAmount(pago) }}</span>
                      </div>
                      <div class="mini-history-actions">
                        <button type="button" class="history-action-button" @click="openEditPaymentModal(entrenador, alumno, pago)">
                          Editar
                        </button>
                        <button type="button" class="history-action-button danger" @click="openEditPaymentModal(entrenador, alumno, pago)">
                          Eliminar
                        </button>
                      </div>
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
                <button
                  @click="desactivarAlumno(entrenador, alumno)"
                  class="edit-payment-button deactivate-active-button"
                  :disabled="deactivatingAlumnoId === getAlumnoId(alumno)"
                >
                  {{ deactivatingAlumnoId === getAlumnoId(alumno) ? "Desactivando..." : "Desactivar" }}
                </button>
              </div>
            </div>

            <div v-if="getInactiveAlumnos(entrenador).length > 0" class="inactive-students-block">
              <h3 class="inactive-title">Alumnos inactivos</h3>
              <div
                v-for="alumno in getInactiveAlumnos(entrenador)"
                :key="`inactive-${alumno._id || alumno.id}`"
                class="alumno-item inactive"
              >
                <div class="alumno-details">
                  <h3>{{ alumno.nombre }} {{ alumno.apellido }}</h3>
                  <div class="alumno-payment-info">
                    <p class="payment-info">Inactivo desde {{ formatDate(alumno.fechaInactivacion || alumno.updatedAt) }}</p>
                  </div>
                </div>
                <div class="status-container">
                  <button @click="reactivarAlumno(entrenador, alumno)" class="edit-payment-button">
                    Reactivar
                  </button>
                  <button
                    @click="eliminarAlumnoInactivo(entrenador, alumno)"
                    class="edit-payment-button delete-inactive-button"
                    :disabled="deletingInactiveAlumnoId === getAlumnoId(alumno)"
                  >
                    {{ deletingInactiveAlumnoId === getAlumnoId(alumno) ? "Eliminando..." : "Eliminar" }}
                  </button>
                </div>
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

    <!-- Modal para registrar pago -->
    <div v-if="showPaymentModal && alumnoSeleccionado" class="modal-overlay" @click.self="closePaymentModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ showConfirmPaymentStep ? 'Confirmar Registro de Pago' : (hasPendingPartialPayment(alumnoSeleccionado) ? 'Completar Pago' : 'Registrar Pago') }}</h2>
          <button @click="closePaymentModal" class="close-button">×</button>
        </div>
        
        <!-- PASO 1: FORMULARIO DE CARGA -->
        <template v-if="!showConfirmPaymentStep">
          <div class="modal-student-info">
            <p><strong>Alumno:</strong> {{ alumnoSeleccionado.nombre }} {{ alumnoSeleccionado.apellido }}</p>
          </div>
          
          <form @submit.prevent="prepararConfirmacionPago" class="modal-form">
            <div class="form-group">
              <label for="fechaPagoPago">Fecha de Pago *</label>
              <DateField
                input-id="fechaPagoPago"
                :model-value="nuevoPago.fechaPago"
                @update:model-value="value => nuevoPago.fechaPago = value"
              />
            </div>

            <div class="form-group">
              <label for="mesQueAbonaPago">Mes que abona *</label>
              <select
                id="mesQueAbonaPago"
                v-model="nuevoPago.mesQueAbona"
                required
                class="select-input"
              >
                <option v-for="mes in mesesQueAbona" :key="mes.value" :value="mes.value">
                  {{ mes.label }} {{ paymentYear }}
                </option>
              </select>
            </div>

            <div class="form-group checkbox-group">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  v-model="nuevoPago.pagoSimilar"
                  :disabled="!getUltimoPago(alumnoSeleccionado)"
                  @change="handlePagoSimilarChange"
                />
                Pago recurrente
              </label>
              <span v-if="!getUltimoPago(alumnoSeleccionado)" class="checkbox-help">
                Disponible cuando el alumno ya tiene un pago previo.
              </span>
            </div>

            <div class="form-group checkbox-group" v-if="!isPromisePayment(nuevoPago.tipoPago)">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  v-model="nuevoPago.pagoParcial"
                />
                Registrar pago por partes
              </label>
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
                <option value="descuento">Descuento</option>
                <option value="promesa de pago">Promesa de Pago</option>
              </select>
            </div>

            <div class="form-group" v-if="nuevoPago.pagoSimilar">
              <label for="montoSimilarPago">Monto informado del pago *</label>
              <input
                id="montoSimilarPago"
                v-model="nuevoPago.montoSimilar"
                type="number"
                min="0"
                step="0.01"
                placeholder="Monto del último pago"
                required
              />
            </div>

            <div class="form-group" v-if="nuevoPago.pagoParcial">
              <label for="montoParcialPago">Monto abonado en esta parte *</label>
              <input
                id="montoParcialPago"
                v-model="nuevoPago.montoParcial"
                type="number"
                min="0"
                step="0.01"
                :placeholder="hasPendingPartialPayment(alumnoSeleccionado) ? 'Monto a completar parcialmente' : 'Monto abonado ahora'"
                required
              />
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

            <div class="form-group" v-if="isDiscountPayment(nuevoPago.tipoPago)">
              <label for="medioDescuentoPago">Medio del Descuento *</label>
              <select
                id="medioDescuentoPago"
                v-model="nuevoPago.medioDescuento"
                class="select-input"
              >
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
              </select>
            </div>

            <div class="form-group" v-if="isDiscountPayment(nuevoPago.tipoPago) && !nuevoPago.pagoSimilar">
              <label for="montoDescuentoPago">Monto (Final) *</label>
              <input
                id="montoDescuentoPago"
                v-model="nuevoPago.montoDescuento"
                type="number"
                min="0"
                placeholder="Ingrese el monto con descuento"
                required
              />
              <small>Se guarda como dato informativo. Las estadísticas toman el valor de la membresía.</small>
            </div>

            <div v-if="error" class="error-message">
              {{ error }}
            </div>

            <div class="modal-actions">
              <button type="button" @click="closePaymentModal" class="cancel-button">
                Cancelar
              </button>
              <button type="submit" class="submit-button">
                Continuar a Confirmación →
              </button>
            </div>
          </form>
        </template>

        <!-- PASO 2: PANTALLA DE CONFIRMACIÓN -->
        <template v-else>
          <div class="confirmation-container">
            <div class="confirmation-question-card">
              <div class="question-icon">❓</div>
              <p class="question-text">
                ¿Estás seguro que el pago de <strong>{{ alumnoSeleccionado.nombre }} {{ alumnoSeleccionado.apellido }}</strong> corresponde al período <strong>{{ getNombreMes(nuevoPago.mesQueAbona) }} {{ paymentYear }}</strong>?
              </p>
            </div>

            <div class="summary-card">
              <h3>Resumen del Pago</h3>
              <div class="summary-grid">
                <div class="summary-item">
                  <span class="summary-label">Alumno:</span>
                  <span class="summary-value">{{ alumnoSeleccionado.nombre }} {{ alumnoSeleccionado.apellido }}</span>
                </div>
                <div class="summary-item highlight-period">
                  <span class="summary-label">Período a abonar:</span>
                  <span class="summary-value font-bold">{{ getNombreMes(nuevoPago.mesQueAbona) }} {{ paymentYear }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Fecha de Cobro:</span>
                  <span class="summary-value">{{ nuevoPago.fechaPago }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Tipo de Pago:</span>
                  <span class="summary-value badge-tipo">{{ pagoAConfirmar?.tipo }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Monto:</span>
                  <span class="summary-value font-bold">${{ (pagoAConfirmar?.monto || 0).toLocaleString() }}</span>
                </div>
                <div class="summary-item" v-if="pagoAConfirmar?.membresia">
                  <span class="summary-label">Membresía:</span>
                  <span class="summary-value">{{ pagoAConfirmar.membresia.nombre }}</span>
                </div>
              </div>
            </div>

            <div v-if="error" class="error-message">
              {{ error }}
            </div>

            <div class="confirmation-actions">
              <button type="button" @click="volverAEditarPago" class="back-button" :disabled="isLoading">
                <span class="arrow">←</span> Volver a editar
              </button>
              <button type="button" @click="confirmarYGuardarPago" :disabled="isLoading" class="confirm-button">
                {{ isLoading ? 'Guardando...' : '✓ Confirmar y Guardar Pago' }}
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div
      v-if="showEditPaymentModal && alumnoPagoEditando"
      class="modal-overlay"
      @click.self="closeEditPaymentModal"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h2>Editar Pago</h2>
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
            <label for="edit-mes-que-abona">Mes que abona *</label>
            <select id="edit-mes-que-abona" v-model="pagoActual.mesQueAbona">
              <option v-for="mes in mesesQueAbona" :key="mes.value" :value="mes.value">
                {{ mes.label }} {{ editPaymentYear }}
              </option>
            </select>
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
            <label for="edit-monto">Monto final informado *</label>
            <input
              id="edit-monto"
              v-model="pagoActual.monto"
              type="number"
              min="0"
              step="0.01"
              :disabled="isPromisePayment(pagoActual.tipoPago)"
              placeholder="Ej: 38000"
            />
            <small v-if="isDiscountPayment(pagoActual.tipoPago)">
              Se muestra como dato informativo. El monto contable queda atado al valor de la membresía.
            </small>
          </div>

          <div class="form-group" v-if="isDiscountPayment(pagoActual.tipoPago)">
            <label>Monto contable para estadísticas</label>
            <div class="payment-edit-summary">${{ getSelectedMembershipPrice(pagoActual.membresiaId).toLocaleString() }}</div>
          </div>

          <div v-if="error" class="error-message">
            {{ error }}
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeEditPaymentModal" class="cancel-button" :disabled="isSavingPayment">
              Cancelar
            </button>
            <button
              type="button"
              @click="eliminarPagoEditando"
              class="cancel-button danger-button"
              :disabled="isSavingPayment || isDeletingPayment"
            >
              {{ isDeletingPayment ? "Eliminando..." : "Eliminar Pago" }}
            </button>
            <button type="button" @click="guardarPagoEditado" class="submit-button" :disabled="isSavingPayment">
              {{ isSavingPayment ? "Guardando..." : "Guardar Cambios" }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Gestión Promo 2x1 -->
    <div
      v-if="showPromo2x1Modal && alumnoPromoSeleccionado"
      class="modal-overlay"
      @click.self="closePromo2x1Modal"
    >
      <div class="modal-content modal-promo2x1">
        <div class="modal-header">
          <div class="header-title-group">
            <span class="header-icon">🏷️</span>
            <div>
              <h2>Gestión Promo 2x1</h2>
              <p class="modal-subtitle">
                Alumno Titular: <strong>{{ alumnoPromoSeleccionado.nombre }} {{ alumnoPromoSeleccionado.apellido }}</strong>
              </p>
            </div>
          </div>
          <button @click="closePromo2x1Modal" class="close-button">✕</button>
        </div>

        <div v-if="promo2x1Error" class="error-message">
          {{ promo2x1Error }}
        </div>
        <div v-if="promo2x1Success" class="success-message">
          {{ promo2x1Success }}
        </div>

        <!-- CASO 1: Alumno YA tiene Promo 2x1 (Activa o Vencida) -->
        <div v-if="alumnoPromoSeleccionado.promo2x1?.activo" class="promo-current-info">
          <div
            class="promo-status-card"
            :class="{ active: isPromo2x1Activa(alumnoPromoSeleccionado), expired: !isPromo2x1Activa(alumnoPromoSeleccionado) }"
          >
            <div class="promo-status-header">
              <span class="status-chip">
                {{ isPromo2x1Activa(alumnoPromoSeleccionado) ? '🟢 Promo 2x1 Vigente' : '🔴 Promo 2x1 Vencida' }}
              </span>
              <span class="role-chip">
                Rol: {{ alumnoPromoSeleccionado.promo2x1.rol === 'titular' ? 'Titular (Paga cuota)' : 'Anexado (Beneficiario)' }}
              </span>
            </div>
            <div class="promo-status-details">
              <p><strong>Vinculado con:</strong> {{ getNombreVinculado(alumnoPromoSeleccionado) }}</p>
              <p><strong>Meses cubiertos:</strong> {{ formatPromoPeriodo(alumnoPromoSeleccionado.promo2x1) }} ({{ alumnoPromoSeleccionado.promo2x1.meses }} mes/es)</p>
            </div>
            <p v-if="!isPromo2x1Activa(alumnoPromoSeleccionado)" class="expired-notice">
              ⚠️ La promo finalizó. A menos que se renueve, el alumno anexado se cuenta como alumno independiente en las estadísticas y requiere abonar su cuota.
            </p>
          </div>

          <!-- Formulario de Renovación -->
          <form @submit.prevent="renovarPromo2x1" class="promo-renew-section">
            <h3>Renovar Promo 2x1</h3>
            <p class="help-text">Sumá meses de promo para continuar cubriendo a ambos alumnos.</p>

            <div class="form-row-2col">
              <div class="form-group">
                <label for="renovarMeses">Meses a sumar *</label>
                <select id="renovarMeses" v-model="promoRenovarForm.meses" class="select-input" required>
                  <option :value="1">1 mes</option>
                  <option :value="2">2 meses</option>
                  <option :value="3">3 meses</option>
                  <option :value="4">4 meses</option>
                  <option :value="5">5 meses</option>
                  <option :value="6">6 meses</option>
                  <option :value="12">12 meses (1 año)</option>
                </select>
              </div>

              <div class="form-group">
                <label>Modo de inicio</label>
                <select v-model="promoRenovarForm.modoInicio" class="select-input">
                  <option value="consecutivo">Consecutivo (al terminar periodo actual)</option>
                  <option value="mes_especifico">Elegir mes de inicio</option>
                </select>
              </div>
            </div>

            <div class="form-row-2col" v-if="promoRenovarForm.modoInicio === 'mes_especifico'">
              <div class="form-group">
                <label for="renovarMesInicio">Mes de inicio</label>
                <select id="renovarMesInicio" v-model="promoRenovarForm.mesInicio" class="select-input">
                  <option v-for="m in opcionesMeses" :key="m.val" :value="m.val">
                    {{ m.label }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label for="renovarAnioInicio">Año de inicio</label>
                <select id="renovarAnioInicio" v-model="promoRenovarForm.anioInicio" class="select-input">
                  <option v-for="a in opcionesAnios" :key="a" :value="a">{{ a }}</option>
                </select>
              </div>
            </div>

            <div class="promo-preview-box">
              <p>📅 <strong>Nuevo período cubierto:</strong> {{ periodoEstimadoRenovacion }}</p>
            </div>

            <div class="modal-actions">
              <button
                type="button"
                @click="desvincularPromo2x1"
                class="cancel-button danger-button"
                :disabled="isSavingPromo2x1"
              >
                Desvincular 2x1
              </button>
              <button
                type="submit"
                class="submit-button"
                :disabled="isSavingPromo2x1"
              >
                {{ isSavingPromo2x1 ? 'Guardando...' : 'Renovar Promo 2x1' }}
              </button>
            </div>
          </form>
        </div>

        <!-- CASO 2: Alumno NO tiene Promo 2x1 -> Vincular a otro alumno -->
        <div v-else class="promo-new-section">
          <div class="section-intro">
            <span class="intro-icon">ℹ️</span>
            <div>
              Al activar el 2x1, <strong>{{ alumnoPromoSeleccionado.nombre }}</strong> es el <strong>titular</strong> (abona 1 membresía) y el alumno anexado quedará cubierto durante los meses elegidos <strong>sin duplicar en las estadísticas</strong>.
            </div>
          </div>

          <form @submit.prevent="vincularPromo2x1">
            <div class="form-group">
              <label for="alumnoAnexadoSelect">Seleccionar Alumno a anexar (Beneficiario 2x1) *</label>
              <div class="search-box-wrapper">
                <input
                  id="searchAlumnoAnexo"
                  v-model="promo2x1Form.searchFilter"
                  type="text"
                  placeholder="🔍 Buscar por nombre o entrenador..."
                  class="select-input search-input"
                />
              </div>
              <select
                id="alumnoAnexadoSelect"
                v-model="promo2x1Form.alumnoAnexadoId"
                required
                class="select-input student-select-box"
                size="5"
              >
                <option
                  v-for="al in alumnosFiltradosParaPromo"
                  :key="al.id"
                  :value="al.id"
                >
                  {{ al.nombreCompleto }} · Prof. {{ al.entrenadorNombre }}
                </option>
              </select>
              <small v-if="alumnosFiltradosParaPromo.length === 0" class="empty-list-note">
                No se encontraron alumnos con ese nombre.
              </small>
            </div>

            <div class="period-selection-card">
              <span class="period-card-title">Período de vigencia 2x1</span>
              <div class="form-row-3col">
                <div class="form-group">
                  <label for="promoMesInicio">Mes de inicio *</label>
                  <select
                    id="promoMesInicio"
                    v-model="promo2x1Form.mesInicio"
                    required
                    class="select-input"
                  >
                    <option v-for="m in opcionesMeses" :key="m.val" :value="m.val">
                      {{ m.label }}
                    </option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="promoAnioInicio">Año *</label>
                  <select
                    id="promoAnioInicio"
                    v-model="promo2x1Form.anioInicio"
                    required
                    class="select-input"
                  >
                    <option v-for="a in opcionesAnios" :key="a" :value="a">{{ a }}</option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="promoMeses">Duración *</label>
                  <select
                    id="promoMeses"
                    v-model="promo2x1Form.meses"
                    required
                    class="select-input"
                  >
                    <option :value="1">1 mes</option>
                    <option :value="2">2 meses</option>
                    <option :value="3">3 meses</option>
                    <option :value="4">4 meses</option>
                    <option :value="5">5 meses</option>
                    <option :value="6">6 meses</option>
                    <option :value="12">12 meses (1 año)</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="promo-preview-box">
              <p class="preview-title">
                ✨ <strong>Meses cubiertos por el 2x1:</strong>
                <span class="preview-period-highlight">{{ periodoEstimadoPromo }}</span>
              </p>
              <p class="preview-subtext">
                Durante este período, el alumno anexado figurará "Al Día" sin contar como ingreso esperado en las estadísticas.
              </p>
            </div>

            <div class="modal-actions">
              <button
                type="button"
                @click="closePromo2x1Modal"
                class="cancel-button"
                :disabled="isSavingPromo2x1"
              >
                Cancelar
              </button>
              <button
                type="submit"
                class="submit-button"
                :disabled="isSavingPromo2x1"
              >
                {{ isSavingPromo2x1 ? 'Vinculando...' : 'Vincular Promo 2x1' }}
              </button>
            </div>
          </form>
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

.alumno-item.inactive {
  opacity: 0.85;
  border-style: dashed;
}

.inactive-students-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.inactive-title {
  color: var(--header-text);
  margin: 4px 0 0;
  font-size: 1rem;
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

.delete-inactive-button {
  background: #fee2e2;
  color: #b91c1c;
  border-color: #b91c1c;
}

.deactivate-active-button {
  background: #fffbeb;
  color: #b45309;
  border-color: #f59e0b;
}

.deactivate-active-button:hover {
  background: #fef3c7;
}

.delete-inactive-button:hover {
  background: #fecaca;
}

.deactivate-active-button:disabled,
.delete-inactive-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
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

.danger-button {
  background: #fee2e2;
  color: #b91c1c;
  border-color: #b91c1c;
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
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.8rem;
  padding: 6px 0;
  border-bottom: 1px solid var(--input-border);
}

.mini-history-item:last-child {
  border-bottom: none;
}

.mini-history-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.mini-history-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.history-action-button {
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: var(--header-text);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.history-action-button.danger {
  color: #b91c1c;
  border-color: #fca5a5;
}

.mini-date { font-weight: 600; color: var(--header-text); }
.mini-type { color: var(--subtitle-text); }
.mini-membresia { color: var(--rheb-accent-green); }
.mini-monto { font-weight: 600; color: var(--rheb-primary-green); }

.modal-student-info {
  padding: 16px 24px;
  background: var(--input-bg);
  border-bottom: 1px solid var(--input-border);
  margin-bottom: 16px;
}

.checkbox-group {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: 4px;
  margin-bottom: 8px;
  gap: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--header-text);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}

.checkbox-help {
  color: var(--subtitle-text);
  font-size: 0.82rem;
  font-weight: 500;
  margin-left: 30px;
}

.checkbox-label input[type="checkbox"] {
  -webkit-appearance: auto !important;
  appearance: auto !important;
  width: 20px;
  height: 20px;
  padding: 0;
  margin: 0;
  border: none;
  cursor: pointer;
}

.register-payment-btn {
  background: color-mix(in srgb, var(--rheb-primary-green) 12%, transparent);
  color: var(--rheb-primary-green);
  border-color: var(--rheb-primary-green);
}

.confirmation-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 10px;
}

.confirmation-question-card {
  background: rgba(255, 215, 0, 0.08);
  border: 2px solid var(--rheb-primary-green);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.question-icon {
  font-size: 1.8rem;
  line-height: 1;
}

.question-text {
  font-size: 1.05rem;
  color: #FFFFFF;
  margin: 0;
  line-height: 1.45;
}

.question-text strong {
  color: var(--rheb-primary-green);
  font-weight: 700;
}

.summary-card {
  background: var(--rheb-dark-grey);
  border: 1px solid #3A3A3A;
  border-radius: 12px;
  padding: 16px;
}

.summary-card h3 {
  margin: 0 0 12px 0;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #A0A0A0;
  border-bottom: 1px solid #333;
  padding-bottom: 8px;
}

.summary-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.summary-item.highlight-period {
  background: rgba(255, 215, 0, 0.12);
  padding: 8px 12px;
  border-radius: 8px;
  border-left: 3px solid var(--rheb-primary-green);
}

.summary-label {
  color: #BBB;
  font-size: 0.9rem;
}

.summary-value {
  color: #FFF;
  font-weight: 600;
  font-size: 0.95rem;
}

.summary-value.font-bold {
  font-weight: 700;
  color: var(--rheb-primary-green);
}

.badge-tipo {
  text-transform: capitalize;
  background: #333;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.85rem;
}

.confirmation-actions {
  display: flex;
  gap: 12px;
  margin-top: 10px;
}

.back-button {
  flex: 1;
  background-color: var(--rheb-dark-grey);
  color: #FFF;
  border: 2px solid #555;
  padding: 12px;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.2s;
}

.back-button:hover {
  background-color: #333;
  border-color: var(--rheb-primary-green);
}

.confirm-button {
  flex: 1.4;
  background: linear-gradient(135deg, var(--rheb-primary-green) 0%, #28a745 100%);
  color: #111;
  border: 2px solid var(--rheb-black);
  padding: 12px;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  transition: all 0.2s;
}

.confirm-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.4);
}

/* --- PROMO 2X1 STYLES --- */
.alumno-header-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.promo-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.76rem;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  margin-left: 8px;
  vertical-align: middle;
  text-transform: none;
  letter-spacing: 0.2px;
}

.promo-badge.titular {
  background: rgba(46, 204, 113, 0.15);
  color: #27ae60;
  border: 1px solid rgba(46, 204, 113, 0.35);
}

.promo-badge.anexado {
  background: rgba(52, 152, 219, 0.15);
  color: #2980b9;
  border: 1px solid rgba(52, 152, 219, 0.35);
}

.promo-badge.expired {
  background: rgba(231, 76, 60, 0.15);
  color: #c0392b;
  border: 1px solid rgba(231, 76, 60, 0.35);
}

.promo-covered-text {
  color: #2980b9 !important;
  font-weight: 600;
  font-size: 0.9rem;
}

.promo-2x1-btn {
  background-color: var(--card-bg);
  color: var(--header-text);
  border: 1px solid var(--border-color);
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.promo-2x1-btn:hover {
  background-color: rgba(52, 152, 219, 0.12);
  border-color: #3498db;
  color: #2980b9;
}

.promo-2x1-btn.has-promo {
  background: rgba(46, 204, 113, 0.12);
  border-color: rgba(46, 204, 113, 0.4);
  color: #27ae60;
}

.promo-2x1-btn.has-promo:hover {
  background: rgba(46, 204, 113, 0.22);
  border-color: #27ae60;
}

.modal-promo2x1 {
  max-width: 580px;
  width: 95%;
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  font-size: 1.6rem;
  line-height: 1;
}

.modal-subtitle {
  color: var(--subtitle-text);
  font-size: 0.9rem;
  margin-top: 4px;
}

.section-intro {
  color: var(--body-text);
  font-size: 0.9rem;
  line-height: 1.45;
  margin-bottom: 16px;
  background: var(--input-bg);
  padding: 12px 14px;
  border-radius: 8px;
  border-left: 4px solid var(--rheb-primary-green);
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.intro-icon {
  font-size: 1.25rem;
  line-height: 1.3;
  flex-shrink: 0;
}

.search-box-wrapper {
  margin-bottom: 6px;
}

.search-input {
  width: 100%;
}

.student-select-box {
  min-height: 130px;
  padding: 6px;
  width: 100%;
}

.student-select-box option {
  padding: 7px 10px;
  border-radius: 4px;
  margin-bottom: 2px;
  font-size: 0.9rem;
}

.student-select-box option:checked {
  background-color: var(--rheb-primary-green);
  color: #111;
  font-weight: 700;
}

.empty-list-note {
  display: block;
  color: var(--subtitle-text);
  margin-top: 6px;
  font-style: italic;
}

.period-selection-card {
  background: var(--input-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 14px;
  margin-top: 12px;
  margin-bottom: 12px;
}

.period-card-title {
  display: block;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--subtitle-text);
  margin-bottom: 8px;
}

.form-row-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-row-3col {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr;
  gap: 10px;
}

@media (max-width: 480px) {
  .form-row-3col {
    grid-template-columns: 1fr;
  }
}

.promo-preview-box {
  background: rgba(46, 204, 113, 0.08);
  border: 1px dashed rgba(46, 204, 113, 0.4);
  border-radius: 8px;
  padding: 12px 14px;
  margin-top: 10px;
  margin-bottom: 16px;
}

.promo-preview-box p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--header-text);
}

.preview-title {
  font-size: 0.95rem !important;
}

.preview-period-highlight {
  color: var(--rheb-primary-green);
  font-weight: 800;
  margin-left: 6px;
  text-decoration: underline;
  text-decoration-color: rgba(46, 204, 113, 0.4);
}

.preview-subtext {
  font-size: 0.82rem !important;
  color: var(--subtitle-text) !important;
  margin-top: 6px !important;
  line-height: 1.4;
}

.promo-status-card {
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 18px;
  border: 1px solid var(--border-color);
  background: var(--input-bg);
}

.promo-status-card.active {
  border-left: 4px solid #27ae60;
  background: rgba(46, 204, 113, 0.06);
}

.promo-status-card.expired {
  border-left: 4px solid #c0392b;
  background: rgba(231, 76, 60, 0.06);
}

.promo-status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.status-chip {
  font-size: 0.85rem;
  font-weight: 700;
}

.role-chip {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--subtitle-text);
}

.promo-status-details p {
  margin: 4px 0;
  font-size: 0.9rem;
  color: var(--header-text);
}

.expired-notice {
  margin-top: 10px;
  font-size: 0.85rem;
  color: #c0392b;
  font-weight: 600;
}

.promo-renew-section {
  border-top: 1px solid var(--border-color);
  padding-top: 16px;
}

.promo-renew-section h3 {
  margin: 0 0 4px 0;
  font-size: 1.05rem;
  color: var(--header-text);
}

.help-text {
  font-size: 0.85rem;
  color: var(--subtitle-text);
  margin-bottom: 14px;
}

.radio-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 6px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  color: var(--body-text);
  cursor: pointer;
}

.radio-label input[type="radio"] {
  cursor: pointer;
  accent-color: var(--rheb-primary-green);
}

.preview-text {
  font-size: 0.9rem;
  color: var(--header-text);
  margin: 12px 0;
}

.success-message {
  background: rgba(46, 204, 113, 0.15);
  color: #27ae60;
  border: 1px solid rgba(46, 204, 113, 0.35);
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 14px;
  font-weight: 600;
  font-size: 0.9rem;
}
</style>
