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

async function registrarPago() {
  if (!alumnoSeleccionado.value) return
  
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

  const nuevoPagoObj = {
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
                <h3>{{ alumno.nombre }} {{ alumno.apellido }}<span v-if="hasPendingPartialPayment(alumno)" class="partial-indicator">*</span></h3>
                <div class="alumno-payment-info">
                  <p v-if="alumno.celular" class="alumno-phone">📱 {{ alumno.celular }}</p>
                  <p v-if="getUltimoPago(alumno)" class="payment-info">
                    Último pago: {{ formatDate(getUltimoPago(alumno).fecha) }} 
                    <span class="payment-type">({{ getPaymentLabel(getUltimoPago(alumno)) }})</span>
                    <span v-if="getDisplayedPaymentAmount(getUltimoPago(alumno))" class="payment-amount">
                      <span class="separator">|</span> ${{ getDisplayedPaymentAmount(getUltimoPago(alumno)) }}
                    </span>
                  </p>
                  <p v-else class="payment-info">Sin pagos registrados</p>
                  <div v-if="getUltimoPago(alumno) || getUltimosPagos(alumno).length > 0" class="payment-actions-row">
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
          <h2>{{ hasPendingPartialPayment(alumnoSeleccionado) ? 'Completar Pago' : 'Registrar Pago' }}</h2>
          <button @click="closePaymentModal" class="close-button">×</button>
        </div>
        
        <div class="modal-student-info">
          <p><strong>Alumno:</strong> {{ alumnoSeleccionado.nombre }} {{ alumnoSeleccionado.apellido }}</p>
        </div>
        
        <form @submit.prevent="registrarPago" class="modal-form">
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
              {{ hasPendingPartialPayment(alumnoSeleccionado) ? 'Completar Pago' : 'Registrar Pago' }}
            </button>
          </div>
        </form>
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
</style>
