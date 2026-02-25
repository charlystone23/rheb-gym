<script setup>
import { ref, onMounted, computed, watch } from "vue"
import { useRouter } from "vue-router"
import { MongoService } from "../services/mongoService"

const router = useRouter()

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]
const DIAS_KEY = ["lunes", "martes", "miercoles", "jueves", "viernes"]
const HORA_INICIO = 7
const HORA_FIN = 23
const HORAS = Array.from({ length: HORA_FIN - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i)

// ─── State ───
const horarios = ref([])
const entrenadores = ref([])
const todosAlumnos = ref([])
const membresias = ref([])
const isLoading = ref(false)

// ─── Trainer filter ───
const selectedTrainer = ref("") // "" = show all

// ─── Detail panel (Slot Assignment) ───
const selectedBlock = ref(null) // Holds the master schedule of the selected trainer
const activeSlotDia = ref("")
const activeSlotHora = ref(null)

// ─── Assign student modal ───
const showAssignModal = ref(false)
const assignAlumnoId = ref("")
const assignError = ref("")
const assignLoading = ref(false)
const alumnoStatsMap = ref({})

// ─── Trainer colors palette ───
const TRAINER_COLORS = [
  { bg: "#22c55e", border: "#16a34a", text: "#fff" },
  { bg: "#3b82f6", border: "#1d4ed8", text: "#fff" },
  { bg: "#f97316", border: "#c2410c", text: "#fff" },
  { bg: "#a855f7", border: "#7e22ce", text: "#fff" },
  { bg: "#ec4899", border: "#9d174d", text: "#fff" },
  { bg: "#14b8a6", border: "#0f766e", text: "#fff" },
  { bg: "#eab308", border: "#a16207", text: "#1a1a1a" },
  { bg: "#ef4444", border: "#991b1b", text: "#fff" },
]

const trainerColorMap = computed(() => {
  const map = {}
  entrenadores.value.forEach((e, i) => { map[e._id] = TRAINER_COLORS[i % TRAINER_COLORS.length] })
  return map
})

// ─── Membership color coding ───
const MEMBRESIA_COLORS = {
  2: { bg: '#3b82f6', border: '#1d4ed8', text: '#fff' },
  3: { bg: '#22c55e', border: '#15803d', text: '#fff' },
  4: { bg: '#f97316', border: '#c2410c', text: '#fff' },
  5: { bg: '#eab308', border: '#a16207', text: '#1a1a1a' },
}

function getDiasPorSemana(alumno) {
  if (!alumno?.historialPagos?.length) return null
  const last = alumno.historialPagos[alumno.historialPagos.length - 1]
  const nombre = last?.membresia?.nombre
  if (!nombre) return null
  const m = membresias.value.find(m => m.nombre === nombre)
  return m?.diasPorSemana ?? null
}

function getMembresiaColor(alumno) {
  const dias = getDiasPorSemana(alumno)
  return MEMBRESIA_COLORS[dias] || { bg: '#4b5563', border: '#374151', text: '#fff' }
}

function getMembresiaColorStyle(alumno) {
  const c = getMembresiaColor(alumno)
  return { background: c.bg, borderColor: c.border, color: c.text }
}

// ─── Block helpers ───
function formatHour(h) {
  if (h === 12) return "12:00 PM"
  if (h === 0) return "12:00 AM"
  return h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`
}

function diaLabel(key) {
  const idx = DIAS_KEY.indexOf(key)
  return idx >= 0 ? DIAS[idx] : key
}

// Get first trainer's color for the block background
function getColorForBlock(block) {
  const trainers = block.entrenadores || []
  // No trainer: use a dark teal/brand gradient instead of flat grey
  if (!trainers.length) return { bg: "#1a3a3a", border: "#2d6a4f", text: "#80cbc4" }
  const tid = trainers[0]._id || trainers[0]
  return trainerColorMap.value[tid] || TRAINER_COLORS[0]
}

// Filtered horarios — if a trainer is selected, show only blocks that include them
const horariosFiltered = computed(() => {
  if (!selectedTrainer.value) return horarios.value
  return horarios.value.filter(h =>
    (h.entrenadores || []).some(e => (e._id || e).toString() === selectedTrainer.value)
  )
})

function getBlocksStartingAt(diaKey, hora) {
  return horariosFiltered.value.filter(h => h.dias.includes(diaKey) && h.horaInicio === hora)
}

function isCellCovered(diaKey, hora) {
  return horariosFiltered.value.some(h => h.dias.includes(diaKey) && hora > h.horaInicio && hora < h.horaFin)
}

function blockSpan(block) { return block.horaFin - block.horaInicio }

// ─── Data loading ───
onMounted(async () => {
  isLoading.value = true
  await Promise.all([cargarEntrenadores(), cargarAlumnos(), cargarMembresias()])
  // After trainers are loaded, ensure master schedules exist for all of them
  await ensureMasterSchedules()
  await cargarHorarios()
  isLoading.value = false
})

async function cargarHorarios() {
  horarios.value = await MongoService.getHorarios()
}

async function cargarEntrenadores() {
  const users = await MongoService.getUsuarios()
  entrenadores.value = users.filter(u => u.role === "entrenador")
}

async function ensureMasterSchedules() {
  for (const ent of entrenadores.value) {
    await MongoService.ensureMasterSchedule(ent._id)
  }
}

async function cargarAlumnos() {
  todosAlumnos.value = await MongoService.getAlumnos()
}

async function cargarMembresias() {
  membresias.value = await MongoService.getMembresias()
}

// ─── Detail panel (Slot cell click) ───
function openDetailPanel(diaKey, hora) {
  if (!selectedTrainer.value) {
    alert("Por favor, seleccioná un entrenador en el filtro primero.")
    return
  }
  
  // Find the master schedule for the selected trainer
  const master = horarios.value.find(h => 
    h.entrenadores?.some(e => (e._id || e).toString() === selectedTrainer.value)
  )
  
  if (!master) {
    alert("No se encontró el horario maestro para este entrenador.")
    return
  }
  
  selectedBlock.value = master
  activeSlotDia.value = diaKey
  activeSlotHora.value = hora
}

function closeDetailPanel() { 
  selectedBlock.value = null 
  activeSlotDia.value = ""
  activeSlotHora.value = null
}

// Students available to assign:
// - If a trainer is selected in the filter bar → only that trainer's students
// - Otherwise → students from ALL trainers assigned to this block
const alumnosDelBloque = computed(() => {
  if (!selectedBlock.value) return []
  const trainerIds = (selectedBlock.value.entrenadores || []).map(e => (e._id || e).toString())
  if (!trainerIds.length) return []

  // Which trainer IDs are in scope?
  const scope = selectedTrainer.value
    ? (trainerIds.includes(selectedTrainer.value) ? [selectedTrainer.value] : [])
    : trainerIds

  return todosAlumnos.value.filter(a => {
    const aTrainer = a.entrenador?._id?.toString() || a.entrenador?.toString() || ''
    return scope.includes(aTrainer)
  })
})

// Assignments for a specific slot (within current block)
function asignacionesDeSlot(dia, hora) {
  if (!selectedBlock.value?.asignaciones) return []
  return selectedBlock.value.asignaciones.filter(a => a.dia === dia && a.hora === hora)
}

// Global count of students in a day+hour slot across ALL horarios
const MAX_POR_TURNO = 20
function slotCount(dia, hora) {
  let total = 0
  horarios.value.forEach(h => {
    total += h.asignaciones.filter(a => a.dia === dia && a.hora === hora).length
  })
  return total
}
function slotIsFull(dia, hora) {
  return slotCount(dia, hora) >= MAX_POR_TURNO
}

function membresiaAlumno(alumno) {
  if (!alumno?.historialPagos?.length) return null
  const last = alumno.historialPagos[alumno.historialPagos.length - 1]
  return last?.membresia?.nombre || null
}

async function loadAlumnoStats(alumnoId) {
  if (alumnoStatsMap.value[alumnoId]) return
  const stats = await MongoService.getAlumnoAsignaciones(alumnoId)
  alumnoStatsMap.value[alumnoId] = stats
}

function getAlumnoStats(alumnoId) {
  return alumnoStatsMap.value[alumnoId] || null
}

async function preloadStats() {
  for (const a of alumnosDelBloque.value) {
    await loadAlumnoStats(a._id || a.id)
  }
}

watch(selectedBlock, async (val) => {
  if (val) await preloadStats()
})

// ─── Assign student ───
function openAssignModal() {
  assignAlumnoId.value = ""
  assignError.value = ""
  showAssignModal.value = true
}

function closeAssignModal() { showAssignModal.value = false; assignError.value = "" }

function canAssign(alumno) {
  const id = alumno._id || alumno.id
  const stats = getAlumnoStats(id)
  if (!stats || stats.diasPermitidos === null) return true
  return stats.total < stats.diasPermitidos
}

function alreadyInSlot(alumno, dia, hora) {
  if (!selectedBlock.value?.asignaciones) return false
  const id = alumno._id || alumno.id
  return selectedBlock.value.asignaciones.some(
    a => (a.alumno?._id || a.alumno)?.toString() === id.toString() && a.dia === dia && a.hora === hora
  )
}

async function asignarAlumno() {
  if (!assignAlumnoId.value) { assignError.value = "Seleccioná un alumno"; return }
  try {
    assignLoading.value = true
    assignError.value = ""
    const updated = await MongoService.addAsignacion(selectedBlock.value._id, {
      alumnoId: assignAlumnoId.value,
      dia: activeSlotDia.value,
      hora: activeSlotHora.value
    })
    const idx = horarios.value.findIndex(h => h._id === selectedBlock.value._id)
    if (idx >= 0) horarios.value[idx] = updated
    selectedBlock.value = updated
    delete alumnoStatsMap.value[assignAlumnoId.value]
    await loadAlumnoStats(assignAlumnoId.value)
    closeAssignModal()
  } catch (e) {
    assignError.value = e.message || "Error al asignar"
  } finally {
    assignLoading.value = false
  }
}

async function quitarAsignacion(asignacionId) {
  const id = String(asignacionId)
  if (!id || id === 'undefined') { console.error('asignacionId inválido', asignacionId); return }
  try {
    isLoading.value = true
    const horarioId = String(selectedBlock.value._id)
    const updated = await MongoService.removeAsignacion(horarioId, id)
    // Refresh full list from server response
    const idx = horarios.value.findIndex(h => String(h._id) === horarioId)
    if (idx >= 0) horarios.value[idx] = updated
    selectedBlock.value = updated
    alumnoStatsMap.value = {}
    await preloadStats()
  } catch (e) {
    console.error('Error al quitar asignación:', e)
    alert("Error al quitar asignación: " + (e.message || 'desconocido'))
  } finally {
    isLoading.value = false
  }
}

function goBack() { router.push("/admin") }

const horaOptions = HORAS.map(h => ({ value: h, label: formatHour(h) }))
const horaFinOptions = [...horaOptions.slice(1), { value: HORA_FIN, label: formatHour(HORA_FIN) }]
</script>

<template>
  <div class="schedule-container">
    <!-- Header -->
    <div class="schedule-header">
      <div class="header-left">
        <button @click="goBack" class="back-button">←</button>
        <img src="/logo.png" alt="Rheb Logo" class="logo-small" />
        <div>
          <h1>Horarios y Clases</h1>
          <p class="subtitle">Gestión de turnos por entrenador</p>
        </div>
      </div>
    </div>

    <!-- Trainer filter bar -->
    <div class="filter-bar">
      <span class="filter-label">Ver calendario de:</span>
      <div class="filter-buttons">
        <button
          class="filter-btn"
          :class="{ active: selectedTrainer === '' }"
          @click="selectedTrainer = ''"
        >Todos</button>
        <button
          v-for="(ent, idx) in entrenadores"
          :key="ent._id"
          class="filter-btn"
          :class="{ active: selectedTrainer === ent._id }"
          :style="selectedTrainer === ent._id ? { background: TRAINER_COLORS[idx % TRAINER_COLORS.length].bg, color: TRAINER_COLORS[idx % TRAINER_COLORS.length].text, borderColor: TRAINER_COLORS[idx % TRAINER_COLORS.length].border } : {}"
          @click="selectedTrainer = ent._id"
        >
          <span class="filter-dot" :style="{ background: TRAINER_COLORS[idx % TRAINER_COLORS.length].bg }"></span>
          {{ ent.nombre }}
        </button>
      </div>
    </div>

    <!-- Membership color legend -->
    <div class="legend">
      <span class="legend-title">Membresías:</span>
      <div v-for="(color, dias) in MEMBRESIA_COLORS" :key="dias" class="legend-item">
        <span class="legend-dot" :style="{ background: color.bg }"></span>
        <span>{{ dias }} días/sem</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot" style="background:#4b5563"></span>
        <span>Sin membresía</span>
      </div>
    </div>

    <div v-if="isLoading && !horarios.length" class="loading">Cargando horarios...</div>

    <!-- Main layout: grid + optional detail panel -->
    <div class="main-layout" :class="{ 'with-panel': selectedBlock }">

      <!-- Weekly Grid -->
      <div class="grid-wrapper">
        <div class="schedule-grid">
          <div class="cell header-cell corner"></div>
          <div v-for="dia in DIAS" :key="dia" class="cell header-cell day-header">{{ dia }}</div>

          <template v-for="hora in HORAS" :key="hora">
            <div class="cell hour-label">{{ formatHour(hora) }}</div>
            <div
              v-for="diaKey in DIAS_KEY" :key="diaKey"
              class="cell day-cell slot-cell"
              :class="{ 
                'is-active': activeSlotDia === diaKey && activeSlotHora === hora,
                'disabled': !selectedTrainer
              }"
              @click="openDetailPanel(diaKey, hora)"
            >
              <div v-if="selectedTrainer" class="slot-content">
                <div 
                  v-for="asig in asignacionesDeSlot(diaKey, hora)" 
                  :key="asig._id"
                  class="mini-chip"
                  :style="{ background: getMembresiaColor(asig.alumno).bg }"
                  :title="`${asig.alumno?.nombre} ${asig.alumno?.apellido}`"
                ></div>
                <div v-if="asignacionesDeSlot(diaKey, hora).length === 0" class="slot-empty">Libre</div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Detail Panel (Slot View) -->
      <div v-if="selectedBlock && activeSlotDia && activeSlotHora" class="detail-panel">
        <div class="detail-header">
          <div class="detail-title-block">
            <h2>{{ diaLabel(activeSlotDia) }}</h2>
            <p class="detail-sub">
              {{ formatHour(activeSlotHora) }}
            </p>
          </div>
          <div class="detail-actions">
            <button class="close-panel-btn" @click="closeDetailPanel">✕</button>
          </div>
        </div>

        <!-- Slot specific list -->
        <div class="slots-container">
          <div class="slot-row single-slot">
              <div class="slot-students">
                <div
                  v-for="asig in asignacionesDeSlot(activeSlotDia, activeSlotHora)"
                  :key="asig._id"
                  class="student-chip"
                  :style="getMembresiaColorStyle(asig.alumno)"
                >
                  <span class="student-name">{{ asig.alumno?.nombre }} {{ asig.alumno?.apellido }}</span>
                  <button
                    class="remove-btn"
                    :style="{ color: getMembresiaColor(asig.alumno).text === '#fff' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.5)' }"
                    @click="quitarAsignacion(String(asig._id))"
                    title="Quitar alumno del turno"
                  >✕</button>
                </div>
                <button
                  class="add-student-btn"
                  :class="{
                    'slot-full': slotIsFull(activeSlotDia, activeSlotHora)
                  }"
                  :disabled="slotIsFull(activeSlotDia, activeSlotHora)"
                  @click="openAssignModal()"
                  :title="slotIsFull(activeSlotDia, activeSlotHora) ? 'Turno lleno (máx. 20 alumnos)' : ''"
                >{{
                  slotIsFull(activeSlotDia, activeSlotHora) ? 'Turno lleno' : '+ Alumno'
                }}</button>
                <span class="slot-cap-badge" :class="{ 'cap-full': slotIsFull(activeSlotDia, activeSlotHora) }">
                  {{ slotCount(activeSlotDia, activeSlotHora) }}/{{ MAX_POR_TURNO }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>



    <!-- ─── Assign Student Modal ─── -->
    <div v-if="showAssignModal" class="modal-overlay" @click.self="closeAssignModal">
      <div class="modal-content assign-modal">
        <div class="modal-header">
          <h2>Asignar Alumno</h2>
          <button @click="closeAssignModal" class="close-button">×</button>
        </div>
        <p class="assign-slot-info">{{ diaLabel(activeSlotDia) }} · {{ formatHour(activeSlotHora) }}</p>
        <div class="modal-form">
          <div class="students-select-list">
            <label
              v-for="alumno in alumnosDelBloque"
              :key="alumno._id || alumno.id"
              class="student-select-row"
              :class="{
                'at-limit': !canAssign(alumno),
                'in-slot': alreadyInSlot(alumno, activeSlotDia, activeSlotHora),
                selected: assignAlumnoId === (alumno._id || alumno.id)
              }"
            >
              <input
                type="radio"
                :value="alumno._id || alumno.id"
                v-model="assignAlumnoId"
                :disabled="!canAssign(alumno) || alreadyInSlot(alumno, activeSlotDia, activeSlotHora)"
              />
              <div class="student-row-info">
                <span class="student-row-name">{{ alumno.nombre }} {{ alumno.apellido }}</span>
                <div class="student-row-badges">
                  <span class="memb-badge color-badge" :style="getMembresiaColorStyle(alumno)">
                    {{ membresiaAlumno(alumno) || 'Sin membresía' }}
                  </span>
                  <span class="days-badge" :class="{ 'days-full': !canAssign(alumno) }">
                    <template v-if="getAlumnoStats(alumno._id || alumno.id)">
                      {{ getAlumnoStats(alumno._id || alumno.id).total }}/{{ getAlumnoStats(alumno._id || alumno.id).diasPermitidos ?? '∞' }} días
                    </template>
                    <template v-else>Cargando...</template>
                  </span>
                  <span v-if="alreadyInSlot(alumno, activeSlotDia, activeSlotHora)" class="already-badge">Ya asignado</span>
                  <span v-else-if="!canAssign(alumno)" class="limit-badge">Límite alcanzado</span>
                </div>
              </div>
            </label>
            <div v-if="!alumnosDelBloque.length" class="no-students">
              {{ 'Asigná un entrenador primero.' }}
            </div>
          </div>
          <div v-if="assignError" class="error-message">{{ assignError }}</div>
          <div class="modal-actions">
            <button type="button" @click="closeAssignModal" class="cancel-button">Cancelar</button>
            <button class="submit-button" @click="asignarAlumno" :disabled="!assignAlumnoId || assignLoading">
              {{ assignLoading ? 'Asignando...' : 'Asignar' }}
            </button>
          </div>
        </div>
      </div>
    </div>
</template>

<style scoped>
.schedule-container {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--page-bg);
  padding: 20px;
  padding-bottom: 40px;
}

/* ─── Header ─── */
.schedule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left { display: flex; align-items: center; gap: 16px; }
.logo-small { width: 50px; height: 50px; }

.schedule-header h1 { color: var(--header-text); font-size: 1.75rem; font-weight: 700; margin: 0; }
.subtitle { color: var(--subtitle-text); font-size: 0.9rem; margin: 4px 0 0 0; }

.back-button {
  background: var(--rheb-dark-grey); color: var(--rheb-primary-green);
  border: 2px solid var(--rheb-black); border-radius: 8px;
  padding: 10px 16px; font-size: 1.2rem; font-weight: 700; cursor: pointer;
  min-height: 44px; min-width: 44px;
}

.create-button {
  background: linear-gradient(135deg, var(--rheb-primary-green) 0%, #FFA500 100%);
  color: var(--rheb-dark-grey); border: 2px solid var(--rheb-black);
  padding: 10px 20px; border-radius: 8px; font-size: 0.9rem; font-weight: 700;
  cursor: pointer; min-height: 44px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  white-space: nowrap;
}

/* ─── Filter bar ─── */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  background: var(--card-bg);
  border: 2px solid var(--rheb-primary-green);
  border-radius: 12px;
  padding: 10px 14px;
}

.filter-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--subtitle-text);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.filter-buttons { display: flex; flex-wrap: wrap; gap: 6px; }

.filter-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  border: 2px solid var(--input-border);
  background: var(--input-bg);
  color: var(--header-text);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.filter-btn.active {
  border-color: var(--rheb-primary-green);
  background: var(--rheb-primary-green);
  color: #1a1a1a;
}

.filter-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ─── Legend ─── */
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
  align-items: center;
}

.legend-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--subtitle-text);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.legend-item { display: flex; align-items: center; gap: 5px; font-size: 0.8rem; color: var(--header-text); font-weight: 500; }
.legend-dot { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; }

.loading { text-align: center; padding: 40px; color: var(--rheb-primary-green); }

/* ─── Main layout ─── */
.main-layout { display: grid; grid-template-columns: 1fr; gap: 16px; }

@media (min-width: 960px) {
  .main-layout.with-panel { grid-template-columns: 1fr 360px; }
}

/* ─── Grid ─── */
.grid-wrapper {
  overflow-x: auto;
  border-radius: 12px;
  border: 2px solid var(--rheb-primary-green);
  background: var(--card-bg);
}

.schedule-grid {
  display: grid;
  grid-template-columns: 84px repeat(5, minmax(100px, 1fr));
  min-width: 600px;
}

.cell {
  border-right: 1px solid var(--input-border, #e5e7eb);
  border-bottom: 1px solid var(--input-border, #e5e7eb);
  position: relative;
}

.header-cell {
  background: var(--rheb-dark-grey, #2a2a2a);
  color: var(--rheb-primary-green);
  font-weight: 700; font-size: 0.75rem;
  text-align: center; padding: 8px 4px;
  text-transform: uppercase; letter-spacing: 0.05em;
}

.corner { background: var(--rheb-black, #1a1a1a) !important; z-index: 3; }

.hour-label {
  background: var(--card-bg); color: var(--subtitle-text);
  font-size: 0.68rem; font-weight: 600;
  padding: 0 6px; height: 48px;
  display: flex; align-items: center; justify-content: flex-end;
  white-space: nowrap;
  border-right: 2px solid var(--rheb-primary-green) !important;
}

.day-cell {
  background: #fff;
  transition: background 0.15s;
}

.slot-cell {
  cursor: pointer;
}
.slot-cell:hover:not(.disabled) {
  background: rgba(34, 197, 94, 0.08);
}
.slot-cell.is-active {
  background: rgba(255, 165, 0, 0.15);
  box-shadow: inset 0 0 0 2px #FFA500;
}
.slot-cell.disabled {
  cursor: not-allowed;
}

.slot-content {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 6px;
  align-content: flex-start;
  height: 100%;
}

.mini-chip {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.15);
}

.slot-empty {
  font-size: 0.7rem;
  color: var(--subtitle-text);
  margin: auto;
  opacity: 0.6;
  font-weight: 500;
}

/* ─── Detail Panel ─── */
.detail-panel {
  background: var(--card-bg);
  border-radius: 12px; border: 2px solid var(--rheb-primary-green);
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  display: flex; flex-direction: column;
  max-height: 80vh; overflow-y: auto;
}

.detail-header {
  background: var(--rheb-dark-grey); padding: 14px;
  display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;
  position: sticky; top: 0; z-index: 2;
}

.detail-title-block { flex: 1; min-width: 0; }

.detail-header h2 {
  color: var(--rheb-primary-green); font-size: 1rem; margin: 0 0 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.detail-sub { color: var(--subtitle-text); font-size: 0.78rem; margin: 0 0 6px; }

.trainer-chips-row { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }

.trainer-chip-panel {
  font-size: 0.72rem; font-weight: 700; border-radius: 10px; padding: 2px 8px;
}

.trainer-chip-panel.no-trainer { background: #4b5563; color: #d1d5db; }

.assign-trainer-btn {
  background: transparent; border: 1.5px solid var(--rheb-primary-green);
  color: var(--rheb-primary-green); border-radius: 10px;
  padding: 2px 8px; font-size: 0.7rem; font-weight: 700;
  cursor: pointer; transition: background 0.15s; white-space: nowrap;
}

.assign-trainer-btn:hover { background: rgba(34,197,94,0.12); }

.detail-actions { display: flex; gap: 6px; flex-shrink: 0; }

.edit-block-btn {
  background: var(--rheb-primary-green); color: #1a1a1a; border: none;
  border-radius: 6px; padding: 6px 10px; font-size: 0.9rem; cursor: pointer;
}

.close-panel-btn {
  background: #4b5563; color: #fff; border: none;
  border-radius: 6px; padding: 6px 10px; font-size: 0.9rem; cursor: pointer;
}

.delete-block-btn {
  background: #fee2e2; color: #dc2626; border: 2px solid #dc2626;
  border-radius: 6px; padding: 6px 10px; font-size: 0.9rem; cursor: pointer;
  transition: background 0.15s;
}
.delete-block-btn:hover:not(:disabled) { background: #fecaca; }
.delete-block-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ─── Slots ─── */
.slots-container { padding: 10px; display: flex; flex-direction: column; gap: 14px; }

.dia-title {
  color: var(--rheb-primary-green); font-size: 0.82rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 6px;
}

.slot-row { display: flex; gap: 8px; align-items: flex-start; padding: 5px 0; border-bottom: 1px solid var(--input-border); }

.slot-time { font-size: 0.72rem; font-weight: 700; color: var(--subtitle-text); min-width: 54px; padding-top: 4px; }

.slot-students { flex: 1; display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }

.student-chip {
  display: flex; align-items: center; gap: 4px;
  border-radius: 20px; padding: 3px 8px 3px 10px;
  border: 1.5px solid transparent;
}

.student-name { font-size: 0.76rem; font-weight: 600; }

.remove-btn { background: none; border: none; cursor: pointer; font-size: 0.72rem; padding: 0 2px; line-height: 1; }

.add-student-btn {
  background: transparent; border: 1.5px dashed var(--rheb-primary-green);
  color: var(--rheb-primary-green); border-radius: 20px;
  padding: 3px 10px; font-size: 0.72rem; font-weight: 600; cursor: pointer;
  transition: background 0.15s;
}
.add-student-btn:hover:not(:disabled) { background: rgba(34,197,94,0.1); }
.add-student-btn.slot-full {
  border-color: #dc2626; color: #dc2626; cursor: not-allowed; opacity: 0.7;
}
.add-student-btn.no-trainer-sel {
  border-color: #92400e; color: #b45309; border-style: dashed; cursor: not-allowed; opacity: 0.65; font-size: 0.68rem;
}

.slot-cap-badge {
  font-size: 0.66rem; font-weight: 700;
  background: var(--rheb-dark-grey); color: var(--subtitle-text);
  border-radius: 10px; padding: 2px 7px;
  border: 1.5px solid var(--input-border);
  white-space: nowrap;
}
.slot-cap-badge.cap-full {
  background: #fee2e2; color: #dc2626; border-color: #dc2626;
}

/* ─── Modals ─── */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.72);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 20px;
}

.modal-content {
  background: var(--card-bg); border-radius: 16px; padding: 24px;
  width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0,0,0,0.35); border: 2px solid var(--rheb-primary-green);
}

.assign-modal { max-width: 440px; }

.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.modal-header h2 { color: var(--header-text); font-size: 1.2rem; margin: 0; }
.close-button { background: none; border: none; font-size: 2rem; cursor: pointer; color: var(--header-text); line-height: 1; }

.assign-slot-info {
  background: var(--rheb-dark-grey); color: var(--rheb-primary-green);
  border-radius: 8px; padding: 6px 12px; font-size: 0.85rem; font-weight: 700; margin-bottom: 14px;
}

.modal-form { display: flex; flex-direction: column; gap: 14px; }

.form-group { display: flex; flex-direction: column; gap: 7px; }
.form-group label { font-size: 0.875rem; font-weight: 600; color: var(--header-text); }
.form-group input, .form-group select, .select-input {
  padding: 11px; border: 2px solid var(--input-border); border-radius: 8px;
  font-size: 1rem; background: var(--input-bg); color: var(--header-text);
}

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.dias-grid { display: flex; gap: 6px; flex-wrap: wrap; }

.dia-btn {
  flex: 1; min-width: 44px; padding: 10px 4px; border-radius: 8px;
  border: 2px solid var(--input-border); background: var(--input-bg);
  color: var(--subtitle-text); font-size: 0.8rem; font-weight: 600; cursor: pointer;
}
.dia-btn.active { background: var(--rheb-primary-green); border-color: var(--rheb-primary-green); color: #1a1a1a; }

/* ─── Trainer select list ─── */
.trainer-select-list { display: flex; flex-direction: column; gap: 6px; }

.trainer-select-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 10px;
  border: 2px solid var(--input-border); cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.trainer-select-row:hover { border-color: var(--rheb-primary-green); }
.trainer-select-row.selected { border-color: var(--rheb-primary-green); background: rgba(34,197,94,0.08); }

.trainer-select-row input[type=checkbox] { accent-color: var(--rheb-primary-green); width: 16px; height: 16px; flex-shrink: 0; }
.trainer-color-dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }
.trainer-select-name { flex: 1; font-size: 0.9rem; font-weight: 600; color: var(--header-text); }
.selected-badge { font-size: 0.8rem; color: var(--rheb-primary-green); font-weight: 700; }

/* ─── Student select list ─── */
.students-select-list { display: flex; flex-direction: column; gap: 6px; max-height: 300px; overflow-y: auto; }

.student-select-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px; border-radius: 10px;
  border: 2px solid var(--input-border); cursor: pointer;
  transition: border-color 0.15s; background: var(--card-bg);
}
.student-select-row:hover:not(.at-limit):not(.in-slot) { border-color: var(--rheb-primary-green); }
.student-select-row.selected { border-color: var(--rheb-primary-green); background: rgba(34,197,94,0.08); }
.student-select-row.at-limit, .student-select-row.in-slot { opacity: 0.5; cursor: not-allowed; }
.student-select-row input[type=radio] { accent-color: var(--rheb-primary-green); width: 16px; height: 16px; flex-shrink: 0; }

.student-row-info { display: flex; flex-direction: column; gap: 3px; flex: 1; }
.student-row-name { font-size: 0.88rem; font-weight: 600; color: var(--header-text); }
.student-row-badges { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; }

.memb-badge { font-size: 0.68rem; border-radius: 10px; padding: 2px 7px; font-weight: 700; }
.color-badge { border: 1.5px solid transparent; }

.days-badge { font-size: 0.68rem; background: var(--rheb-dark-grey); color: var(--subtitle-text); border-radius: 10px; padding: 2px 7px; font-weight: 600; }
.days-badge.days-full { background: #fee2e2; color: #dc2626; }

.already-badge { font-size: 0.68rem; background: #fef3c7; color: #d97706; border-radius: 10px; padding: 2px 7px; font-weight: 600; }
.limit-badge { font-size: 0.68rem; background: #fee2e2; color: #dc2626; border-radius: 10px; padding: 2px 7px; font-weight: 600; }

.no-students { color: var(--subtitle-text); text-align: center; padding: 20px; font-size: 0.9rem; }

.error-message { background: #fee2e2; color: #dc2626; padding: 10px 12px; border-radius: 8px; font-size: 0.875rem; }

/* ─── Modal actions ─── */
.modal-actions { display: flex; gap: 10px; flex-wrap: wrap; }

.cancel-button, .submit-button, .delete-button {
  flex: 1; padding: 12px; border-radius: 8px; font-size: 0.95rem;
  font-weight: 600; cursor: pointer; border: 2px solid var(--rheb-black); min-height: 48px;
}

.cancel-button { background: var(--rheb-dark-grey); color: var(--rheb-primary-green); }

.submit-button {
  background: linear-gradient(135deg, var(--rheb-primary-green) 0%, #FFA500 100%);
  color: var(--rheb-dark-grey); box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.submit-button:disabled, .cancel-button:disabled { opacity: 0.6; cursor: not-allowed; }
.delete-button { background: #fff1f2; color: #e11d48; border-color: #e11d48; flex: 0 0 auto; }

.optional-tag { font-size: 0.75rem; font-weight: 400; color: var(--subtitle-text); }

/* ─── Dark Mode Enhancements ─── */
[data-theme="dark"] .grid-wrapper {
  border-color: var(--rheb-accent-green);
  box-shadow: 0 0 0 1px rgba(77,182,172,0.15), 0 8px 32px rgba(0,0,0,0.5);
}

[data-theme="dark"] .day-cell {
  background: rgba(0, 37, 26, 0.6);
}
[data-theme="dark"] .slot-cell:hover:not(.disabled) {
  background: rgba(0, 105, 92, 0.25);
}
[data-theme="dark"] .slot-cell.is-active {
  background: rgba(255, 165, 0, 0.15);
  box-shadow: inset 0 0 0 2px #FFA500;
}

[data-theme="dark"] .cell {
  border-color: rgba(0, 105, 92, 0.3);
}

[data-theme="dark"] .filter-btn.active {
  box-shadow: 0 0 12px 2px rgba(255,255,255,0.12);
}

[data-theme="dark"] .detail-panel {
  border-color: var(--rheb-accent-green);
  box-shadow: 0 4px 24px rgba(0,0,0,0.5);
}

[data-theme="dark"] .slot-row {
  border-color: rgba(0, 105, 92, 0.25);
}

[data-theme="dark"] .student-chip {
  box-shadow: 0 1px 4px rgba(0,0,0,0.4);
}

[data-theme="dark"] .slot-cap-badge {
  background: rgba(0, 55, 42, 0.8);
  border-color: rgba(0, 105, 92, 0.4);
  color: #80cbc4;
}
[data-theme="dark"] .slot-cap-badge.cap-full {
  background: rgba(185, 28, 28, 0.3);
  border-color: #dc2626;
  color: #fca5a5;
}
</style>
