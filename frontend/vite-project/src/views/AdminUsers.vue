<script setup>
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"
import { MongoService } from "../services/mongoService"

const router = useRouter()
const usuarios = ref([])
const isLoading = ref(false)
const error = ref("")
const showModal = ref(false)
const isEditing = ref(false)
const usuarioActual = ref({
  _id: null,
  username: "",
  password: "",
  nombre: "",
  role: "entrenador"
})

onMounted(async () => {
  await cargarUsuarios()
})

async function cargarUsuarios() {
  try {
    isLoading.value = true
    const data = await MongoService.getUsuarios()
    usuarios.value = data || []
  } catch (e) {
    console.error("Error loading usuarios:", e)
    error.value = "Error al cargar usuarios"
  } finally {
    isLoading.value = false
  }
}

function openCreateModal() {
  isEditing.value = false
  showModal.value = true
  error.value = ""
  usuarioActual.value = {
    _id: null,
    username: "",
    password: "",
    nombre: "",
    role: "entrenador"
  }
}

function openEditModal(usuario) {
  isEditing.value = true
  showModal.value = true
  error.value = ""
  usuarioActual.value = {
    _id: usuario._id,
    username: usuario.username,
    password: "", // No mostramos la contraseña actual
    nombre: usuario.nombre,
    role: usuario.role
  }
}

function closeModal() {
  showModal.value = false
  error.value = ""
  usuarioActual.value = {
    _id: null,
    username: "",
    password: "",
    nombre: "",
    role: "entrenador"
  }
}

async function guardarUsuario() {
  if (!usuarioActual.value.username.trim()) {
    error.value = "El nombre de usuario es requerido"
    return
  }
  
  if (!isEditing.value && !usuarioActual.value.password.trim()) {
    error.value = "La contraseña es requerida"
    return
  }
  
  if (!usuarioActual.value.nombre.trim()) {
    error.value = "El nombre es requerido"
    return
  }
  
  try {
    isLoading.value = true
    
    if (isEditing.value) {
      // Actualizar usuario existente
      const updateData = {
        username: usuarioActual.value.username.trim(),
        nombre: usuarioActual.value.nombre.trim(),
        role: usuarioActual.value.role
      }
      
      // Solo incluir password si se proporcionó uno nuevo
      if (usuarioActual.value.password.trim()) {
        updateData.password = usuarioActual.value.password.trim()
      }
      
      await MongoService.updateUsuario(usuarioActual.value._id, updateData)
    } else {
      // Crear nuevo usuario
      const userData = {
        username: usuarioActual.value.username.trim(),
        password: usuarioActual.value.password.trim(),
        nombre: usuarioActual.value.nombre.trim(),
        role: usuarioActual.value.role
      }
      
      await MongoService.createEntrenador(userData)
    }
    
    await cargarUsuarios()
    closeModal()
  } catch (e) {
    console.error(e)
    error.value = isEditing.value ? "Error al actualizar usuario" : "Error al crear usuario"
  } finally {
    isLoading.value = false
  }
}

async function eliminarUsuario(usuario) {
  const isEntrenador = usuario.role === 'entrenador'
  const mensaje = isEntrenador 
    ? `¿Estás seguro de que deseas eliminar al entrenador ${usuario.nombre}? \n\n¡ATENCION!:\nEsta es una ELIMINACION EN CADENA. Se eliminarán permanentemente todos sus alumnos y rutinas asociadas. Esta acción no se puede deshacer.`
    : `¿Estás seguro de que deseas eliminar al administrador ${usuario.nombre}?`

  if (!confirm(mensaje)) {
    return
  }

  try {
    isLoading.value = true
    await MongoService.deleteUsuario(usuario._id)
    await cargarUsuarios()
  } catch (e) {
    console.error(e)
    error.value = e.message || "Error al eliminar usuario"
  } finally {
    isLoading.value = false
  }
}

function goBack() {
  router.push("/admin")
}
</script>

<template>
  <div class="admin-users-container">
    <div class="admin-users-header">
      <div class="header-left">
        <button @click="goBack" class="back-button">←</button>
        <img src="/logo.png" alt="Rheb Logo" class="logo-small" />
        <div>
          <h1>Gestión de Usuarios</h1>
          <p class="subtitle">Administra los usuarios del sistema</p>
        </div>
      </div>
      <button @click="openCreateModal" class="create-button">+ Crear Usuario</button>
    </div>

    <div class="admin-users-content">
      <div v-if="isLoading && usuarios.length === 0" class="loading">
        Cargando usuarios...
      </div>

      <div class="users-list">
        <div 
          v-for="usuario in usuarios" 
          :key="usuario._id" 
          class="user-card"
        >
          <div class="user-info">
            <h3>{{ usuario.nombre }}</h3>
            <p class="username">@{{ usuario.username }}</p>
            <span :class="['role-badge', usuario.role]">
              {{ usuario.role === 'admin' ? 'Administrador' : 'Entrenador' }}
            </span>
          </div>
          <div class="user-actions">
            <button @click="openEditModal(usuario)" class="edit-button">
              Editar
            </button>
            <button 
              v-if="usuario.role === 'entrenador'"
              @click="eliminarUsuario(usuario)" 
              class="delete-button"
              title="Eliminar entrenador y todos sus alumnos asociados"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>

      <div v-if="usuarios.length === 0 && !isLoading" class="empty-state">
        <p>No hay usuarios registrados</p>
      </div>
    </div>

    <!-- Modal para crear/editar usuario -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ isEditing ? 'Editar Usuario' : 'Crear Nuevo Usuario' }}</h2>
          <button @click="closeModal" class="close-button">×</button>
        </div>
        
        <form @submit.prevent="guardarUsuario" class="modal-form">
          <div class="form-group">
            <label for="username">Usuario *</label>
            <input
              id="username"
              v-model="usuarioActual.username"
              type="text"
              placeholder="Nombre de usuario"
              required
            />
          </div>

          <div class="form-group">
            <label for="password">
              {{ isEditing ? 'Nueva Contraseña (dejar vacío para mantener actual)' : 'Contraseña *' }}
            </label>
            <input
              id="password"
              v-model="usuarioActual.password"
              type="password"
              placeholder="Contraseña"
              :required="!isEditing"
            />
          </div>

          <div class="form-group">
            <label for="nombre">Nombre Completo *</label>
            <input
              id="nombre"
              v-model="usuarioActual.nombre"
              type="text"
              placeholder="Nombre completo"
              required
            />
          </div>

          <div class="form-group">
            <label for="role">Rol *</label>
            <select
              id="role"
              v-model="usuarioActual.role"
              required
              class="select-input"
            >
              <option value="entrenador">Entrenador</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <div v-if="error" class="error-message">
            {{ error }}
          </div>

          <div class="modal-actions">
            <button type="button" @click="closeModal" class="cancel-button">
              Cancelar
            </button>
            <button type="submit" class="submit-button" :disabled="isLoading">
              {{ isLoading ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear Usuario') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-users-container {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--page-bg);
  padding: 20px;
  padding-bottom: 40px;
}

.admin-users-header {
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

.admin-users-header h1 {
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

.admin-users-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.loading {
  text-align: center;
  padding: 40px;
  color: var(--rheb-accent-green);
  font-size: 1rem;
}

.users-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.user-card {
  background: var(--card-bg);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 2px solid var(--rheb-primary-green);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.user-info {
  flex: 1;
}

.user-info h3 {
  color: var(--header-text);
  font-size: 1.2rem;
  margin: 0 0 8px 0;
  font-weight: 600;
}

.username {
  color: var(--subtitle-text);
  font-size: 0.9rem;
  margin: 0 0 8px 0;
}

.role-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  border: 1px solid var(--rheb-black);
}

.role-badge.admin {
  background: linear-gradient(135deg, var(--rheb-primary-green) 0%, #FFA500 100%);
  color: var(--rheb-black);
}

.role-badge.entrenador {
  background-color: var(--rheb-dark-grey);
  color: var(--rheb-primary-green);
}

.user-actions {
  display: flex;
  gap: 10px;
}

.edit-button, .delete-button {
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

.edit-button {
  background-color: var(--rheb-dark-grey);
  color: var(--rheb-primary-green);
  border: 2px solid var(--rheb-black);
}

.edit-button:active {
  transform: scale(0.98);
  background-color: #3A3A3A;
}

.delete-button {
  background-color: #fff1f2;
  color: #e11d48;
  border: 2px solid #e11d48;
}

.delete-button:active {
  transform: scale(0.98);
  background-color: #ffe4e6;
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
  background: var(--input-bg);
  color: var(--header-text);
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
  background-color: var(--rheb-dark-grey);
  color: var(--rheb-primary-green);
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
</style>
