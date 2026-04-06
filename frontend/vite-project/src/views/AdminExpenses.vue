<script setup>
import { computed, onMounted, ref, watch } from "vue"
import { useRouter } from "vue-router"
import DateField from "../components/DateField.vue"
import { MongoService } from "../services/mongoService"
import { formatDateAR, formatDateInput, parseDisplayDate } from "../utils/date"

const router = useRouter()
const hoy = new Date()

const meses = [
  { val: 0, label: "Enero" }, { val: 1, label: "Febrero" }, { val: 2, label: "Marzo" },
  { val: 3, label: "Abril" }, { val: 4, label: "Mayo" }, { val: 5, label: "Junio" },
  { val: 6, label: "Julio" }, { val: 7, label: "Agosto" }, { val: 8, label: "Septiembre" },
  { val: 9, label: "Octubre" }, { val: 10, label: "Noviembre" }, { val: 11, label: "Diciembre" }
]

const selectedMonth = ref(hoy.getMonth())
const selectedYear = ref(hoy.getFullYear())
const expenses = ref([])
const isLoading = ref(false)
const isSaving = ref(false)
const error = ref("")
const form = ref({
  detalle: "",
  monto: null,
  fecha: formatDateAR(hoy)
})

const totalGastosMes = computed(() => {
  return expenses.value.reduce((acc, expense) => acc + (Number(expense.monto) || 0), 0)
})

onMounted(async () => {
  await loadExpenses()
})

watch([selectedMonth, selectedYear], async () => {
  await loadExpenses()
})

async function loadExpenses() {
  try {
    isLoading.value = true
    error.value = ""
    expenses.value = await MongoService.getExpenses(selectedMonth.value + 1, selectedYear.value)
  } catch (e) {
    console.error("Error loading expenses:", e)
    error.value = "No se pudieron cargar los gastos del mes."
  } finally {
    isLoading.value = false
  }
}

async function saveExpense() {
  const fecha = parseDisplayDate(form.value.fecha)

  if (!form.value.detalle.trim()) {
    error.value = "Ingresá un detalle para el gasto."
    return
  }

  if (!form.value.monto || Number(form.value.monto) <= 0) {
    error.value = "Ingresá un monto mayor a cero."
    return
  }

  if (!fecha) {
    error.value = "Ingresá una fecha válida."
    return
  }

  try {
    isSaving.value = true
    error.value = ""

    const expenseMonth = fecha.getMonth()
    const expenseYear = fecha.getFullYear()

    await MongoService.createExpense({
      detalle: form.value.detalle.trim(),
      monto: Number(form.value.monto),
      fecha
    })

    selectedMonth.value = expenseMonth
    selectedYear.value = expenseYear

    form.value = {
      detalle: "",
      monto: null,
      fecha: formatDateAR(fecha)
    }

    await loadExpenses()
  } catch (e) {
    error.value = e.message || "No se pudo guardar el gasto."
  } finally {
    isSaving.value = false
  }
}

async function removeExpense(expense) {
  if (!confirm(`¿Eliminar el gasto "${expense.detalle}"?`)) return

  try {
    await MongoService.deleteExpense(expense._id)
    await loadExpenses()
  } catch (e) {
    error.value = e.message || "No se pudo eliminar el gasto."
  }
}

function goBack() {
  router.push("/admin")
}

function goToStats() {
  router.push("/admin/stats")
}
</script>

<template>
  <div class="admin-expenses-container">
    <div class="admin-expenses-header">
      <div class="header-left">
        <button @click="goBack" class="back-button">←</button>
        <img src="/logo.svg" alt="Rheb Logo" class="logo-small" />
        <div>
          <h1>Gastos</h1>
          <p class="subtitle">Registrá egresos mensuales para impactar en la recaudación neta</p>
        </div>
      </div>

      <button @click="goToStats" class="secondary-button">Ver estadísticas</button>
    </div>

    <div class="toolbar">
      <div class="month-selector">
        <label for="expense-month">Mes</label>
        <select id="expense-month" v-model="selectedMonth" class="filter-select">
          <option v-for="m in meses" :key="m.val" :value="m.val">{{ m.label }}</option>
        </select>
        <select v-model="selectedYear" class="filter-select">
          <option v-for="y in [2024, 2025, 2026, 2027]" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>

      <div class="summary-box">
        <span class="summary-label">Total gastos del mes</span>
        <span class="summary-value">${{ totalGastosMes.toLocaleString() }}</span>
      </div>
    </div>

    <div class="content-grid">
      <section class="expense-form-card">
        <h2>Cargar gasto</h2>
        <form class="expense-form" @submit.prevent="saveExpense">
          <div class="form-group">
            <label for="expense-detail">Detalle</label>
            <input
              id="expense-detail"
              v-model="form.detalle"
              type="text"
              maxlength="120"
              placeholder="Ej: alquiler, luz, mantenimiento, insumos"
            >
          </div>

          <div class="form-group">
            <label for="expense-amount">Monto</label>
            <input
              id="expense-amount"
              v-model.number="form.monto"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
            >
          </div>

          <div class="form-group">
            <label>Fecha</label>
            <DateField
              :model-value="form.fecha"
              input-id="expense-date"
              @update:model-value="value => form.fecha = formatDateInput(value)"
            />
          </div>

          <p v-if="error" class="error-message">{{ error }}</p>

          <button type="submit" class="save-button" :disabled="isSaving">
            {{ isSaving ? "Guardando..." : "Guardar gasto" }}
          </button>
        </form>
      </section>

      <section class="expense-list-card">
        <div class="list-header">
          <div>
            <h2>Gastos cargados</h2>
            <p>{{ meses[selectedMonth].label }} {{ selectedYear }}</p>
          </div>
        </div>

        <div v-if="isLoading" class="loading">Cargando gastos...</div>
        <div v-else-if="expenses.length === 0" class="empty-state">
          No hay gastos registrados para este mes.
        </div>
        <div v-else class="expense-list">
          <article v-for="expense in expenses" :key="expense._id" class="expense-item">
            <div class="expense-main">
              <span class="expense-detail">{{ expense.detalle }}</span>
              <span class="expense-date">{{ formatDateAR(expense.fecha) }}</span>
            </div>
            <div class="expense-actions">
              <span class="expense-amount">${{ Number(expense.monto || 0).toLocaleString() }}</span>
              <button class="delete-button" @click="removeExpense(expense)">Eliminar</button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.admin-expenses-container {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--page-bg);
  padding: 20px;
  padding-bottom: 40px;
}

.admin-expenses-header,
.toolbar,
.list-header,
.expense-item,
.expense-actions {
  display: flex;
  align-items: center;
}

.admin-expenses-header,
.toolbar,
.expense-item {
  justify-content: space-between;
}

.admin-expenses-header {
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-button,
.secondary-button,
.save-button,
.delete-button {
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
}

.back-button {
  background-color: var(--rheb-dark-grey);
  color: var(--rheb-primary-green);
  border: 2px solid var(--rheb-black);
  padding: 8px 12px;
  font-size: 1.1rem;
}

.secondary-button {
  background: transparent;
  color: var(--header-text);
  border: 2px solid var(--input-border);
  padding: 10px 16px;
}

.logo-small {
  width: 50px;
  height: 50px;
}

h1,
h2 {
  color: var(--header-text);
  margin: 0;
}

.subtitle,
.list-header p {
  margin: 4px 0 0;
  color: var(--subtitle-text);
}

.toolbar {
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.month-selector,
.summary-box {
  background: var(--card-bg);
  border: 2px solid var(--rheb-primary-green);
  border-radius: 14px;
  padding: 14px 16px;
}

.month-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

.month-selector label {
  color: var(--header-text);
  font-weight: 700;
}

.filter-select,
.expense-form input {
  border: 2px solid var(--input-border);
  border-radius: 10px;
  background: var(--input-bg);
  color: var(--header-text);
  padding: 10px 12px;
}

.summary-box {
  display: flex;
  flex-direction: column;
  min-width: 220px;
}

.summary-label {
  color: var(--subtitle-text);
  font-size: 0.8rem;
  text-transform: uppercase;
  font-weight: 700;
}

.summary-value {
  color: var(--header-text);
  font-size: 1.8rem;
  font-weight: 800;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.expense-form-card,
.expense-list-card {
  background: var(--card-bg);
  border: 2px solid var(--card-border);
  border-radius: 18px;
  padding: 24px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
}

.expense-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 18px;
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

.save-button {
  border: 2px solid var(--rheb-black);
  background: linear-gradient(135deg, var(--rheb-primary-green) 0%, #FFA500 100%);
  color: var(--rheb-black);
  padding: 12px 18px;
}

.error-message {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: #fee2e2;
  color: #b91c1c;
  font-weight: 600;
}

.list-header {
  justify-content: space-between;
  margin-bottom: 18px;
}

.expense-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.expense-item {
  gap: 16px;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  flex-wrap: wrap;
}

.expense-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.expense-detail {
  color: var(--header-text);
  font-weight: 700;
}

.expense-date {
  color: var(--subtitle-text);
  font-size: 0.92rem;
}

.expense-actions {
  gap: 12px;
}

.expense-amount {
  color: #b91c1c;
  font-size: 1.1rem;
  font-weight: 800;
}

.delete-button {
  border: 2px solid #dc2626;
  background: #fee2e2;
  color: #b91c1c;
  padding: 8px 12px;
}

.loading,
.empty-state {
  color: var(--subtitle-text);
  padding: 24px 0;
}

@media (min-width: 960px) {
  .content-grid {
    grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
  }
}
</style>
