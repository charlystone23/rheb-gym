<script setup>
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"
import { MongoService } from "../services/mongoService"

const router = useRouter()
const membresias = ref([])
const isLoading = ref(false)
const error = ref("")
const showModal = ref(false)
const isEditing = ref(false)

const membresiaActual = ref({
  _id: null,
  nombre: "",
  precio: 0,
  diasPorSemana: 3
})

onMounted(async () => {
  await cargarMembresias()
})

async function cargarMembresias() {
  try {
    isLoading.value = true
    const data = await MongoService.getMembresias()
    membresias.value = data || []
  } catch (e) {
    console.error("Error loading membresias:", e)
    error.value = "Error al cargar membresías"
  } finally {
    isLoading.value = false
  }
}

function openCreateModal() {
  isEditing.value = false
  showModal.value = true
  error.value = ""
  membresiaActual.value = {
    _id: null,
    nombre: "",
    precio: 0,
    diasPorSemana: 3
  }
}

function openEditModal(membresia) {
  isEditing.value = true
  showModal.value = true
  error.value = ""
  membresiaActual.value = { ...membresia }
}

function closeModal() {
  showModal.value = false
}

async function guardarMembresia() {
  if (!membresiaActual.value.nombre.trim()) {
    error.value = "El nombre es requerido"
    return
  }
  
  if (membresiaActual.value.precio <= 0) {
    error.value = "El precio debe ser mayor a 0"
    return
  }
  
  try {
    isLoading.value = true
    if (isEditing.value) {
      await MongoService.updateMembresia(membresiaActual.value._id, membresiaActual.value)
    } else {
      await MongoService.createMembresia(membresiaActual.value)
    }
    await cargarMembresias()
    closeModal()
  } catch (e) {
    console.error(e)
    error.value = "Error al guardar membresía"
  } finally {
    isLoading.value = false
  }
}

async function eliminarMembresia(id) {
  if (!confirm("¿Estás seguro de eliminar esta membresía?")) return
  
  try {
    isLoading.value = true
    await MongoService.deleteMembresia(id)
    await cargarMembresias()
  } catch (e) {
    console.error(e)
    alert("Error al eliminar")
  } finally {
    isLoading.value = false
  }
}

function goBack() {
  router.push("/admin")
}
</script>

<template>
  <div class="admin-memberships-container">
    <div class="admin-memberships-header">
      <div class="header-left">
        <button @click="goBack" class="back-button">←</button>
        <img src="/logo.svg" alt="Potenza Gym Logo" class="logo-small" />
        <div>
          <h1>Gestión de Membresías</h1>
          <p class="subtitle">Administra los tipos de planes y precios</p>
        </div>
      </div>
      <button @click="openCreateModal" class="create-button">+ Nueva Membresía</button>
    </div>

    <div class="admin-memberships-content">
      <div v-if="isLoading && membresias.length === 0" class="loading">Cargando...</div>
      
      <div class="memberships-grid">
        <div v-for="m in membresias" :key="m._id" class="membership-card">
          <div class="card-info">
            <h3>{{ m.nombre }}</h3>
            <p class="price-tag">${{ m.precio.toLocaleString() }}</p>
            <p class="details">{{ m.diasPorSemana }} días por semana</p>
          </div>
          <div class="card-actions">
            <button @click="openEditModal(m)" class="edit-btn">Editar</button>
            <button @click="eliminarMembresia(m._id)" class="delete-btn">Eliminar</button>
          </div>
        </div>
      </div>

      <div v-if="membresias.length === 0 && !isLoading" class="empty-state">
        No hay membresías creadas.
      </div>
    </div>

    <!-- Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ isEditing ? 'Editar Membresía' : 'Nueva Membresía' }}</h2>
          <button @click="closeModal" class="close-button">×</button>
        </div>
        
        <form @submit.prevent="guardarMembresia" class="modal-form">
          <div class="form-group">
            <label>Nombre del Plan *</label>
            <input v-model="membresiaActual.nombre" type="text" placeholder="Ej: 3 días a la semana" required />
          </div>
          
          <div class="form-group">
            <label>Precio ($) *</label>
            <input v-model.number="membresiaActual.precio" type="number" required />
          </div>

          <div class="form-group">
            <label>Días por semana</label>
            <input v-model.number="membresiaActual.diasPorSemana" type="number" min="1" max="7" />
          </div>

          <div v-if="error" class="error-message">{{ error }}</div>

          <div class="modal-actions">
            <button type="button" @click="closeModal" class="cancel-button">Cancelar</button>
            <button type="submit" class="submit-button" :disabled="isLoading">
              {{ isLoading ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-memberships-container {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--page-bg);
  padding: 20px;
}

.admin-memberships-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-button {
  background-color: var(--potenza-dark-grey);
  color: var(--potenza-yellow);
  border: 2px solid var(--potenza-black);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 1.2rem;
  font-weight: 700;
  cursor: pointer;
}

.logo-small { width: 50px; height: 50px; }

.admin-memberships-header h1 {
  color: var(--header-text);
  margin: 0;
  font-size: 1.75rem;
}

.subtitle {
  color: var(--subtitle-text);
  font-size: 0.9rem;
  margin: 0;
}

.create-button {
  background: linear-gradient(135deg, var(--potenza-yellow) 0%, #FFA500 100%);
  color: var(--potenza-dark-grey);
  border: 2px solid var(--potenza-black);
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
}

.memberships-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.membership-card {
  background: var(--card-bg);
  padding: 24px;
  border-radius: 16px;
  border: 2px solid var(--potenza-yellow);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.card-info h3 {
  margin: 0 0 12px 0;
  color: var(--header-text);
}

.price-tag {
  font-size: 2rem;
  font-weight: 800;
  color: var(--header-text);
  margin-bottom: 8px;
}

.details {
  color: var(--subtitle-text);
  font-weight: 600;
}

.card-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.edit-btn, .delete-btn {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  border: 2px solid var(--potenza-black);
}

.edit-btn { background: var(--potenza-dark-grey); color: var(--potenza-yellow); }
.delete-btn { background: #fee2e2; color: #dc2626; border-color: #dc2626; }

.loading, .empty-state { text-align: center; padding: 40px; color: var(--potenza-grey-green); }

.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: var(--card-bg); 
  border-radius: 16px; 
  padding: 24px; 
  width: 100%; 
  max-width: 450px;
  border: 2px solid var(--potenza-yellow);
}

.modal-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;
}

.close-button { background: none; border: none; font-size: 2rem; cursor: pointer; color: var(--header-text); }

.modal-form { display: flex; flex-direction: column; gap: 16px; }

.form-group { display: flex; flex-direction: column; gap: 8px; }

.form-group label { font-weight: 700; color: var(--header-text); }

.form-group input { 
  padding: 12px; 
  border: 2px solid var(--input-border); 
  border-radius: 8px; 
  background: var(--input-bg);
  color: var(--header-text);
}

.error-message { color: #dc2626; background: #fee2e2; padding: 10px; border-radius: 8px; font-size: 0.9rem; }

.modal-actions { display: flex; gap: 12px; margin-top: 8px; }

.cancel-button, .submit-button {
  flex: 1; padding: 12px; border-radius: 8px; font-weight: 700; cursor: pointer; border: 2px solid var(--potenza-black);
}

.submit-button { background: var(--potenza-yellow); }
</style>
