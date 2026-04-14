<script setup>
import { ref, onMounted, computed } from "vue"
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

const usuariosOrdenados = computed(() => {
  return [...usuarios.value].sort((a, b) => {
    if ((a.role === "admin") !== (b.role === "admin")) {
      return a.role === "admin" ? -1 : 1
    }

    if ((a.estado === "activo") !== (b.estado === "activo")) {
      return a.estado === "activo" ? -1 : 1
    }

    return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es")
  })
})

onMounted(async () => {
  await cargarUsuarios()
})

async function cargarUsuarios() {
  try {
    isLoading.value = true
    error.value = ""
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
    password: "",
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
    error.value = "La contrasena es requerida"
    return
  }

  if (!usuarioActual.value.nombre.trim()) {
    error.value = "El nombre es requerido"
    return
  }

  try {
    isLoading.value = true

    if (isEditing.value) {
      const updateData = {
        username: usuarioActual.value.username.trim(),
        nombre: usuarioActual.value.nombre.trim(),
        role: usuarioActual.value.role
      }

      if (usuarioActual.value.password.trim()) {
        updateData.password = usuarioActual.value.password.trim()
      }

      await MongoService.updateUsuario(usuarioActual.value._id, updateData)
    } else {
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

async function desactivarUsuario(usuario) {
  if (!confirm(`Deseas desactivar al entrenador ${usuario.nombre}? No se borraran sus alumnos y luego podra reactivarse.`)) {
    return
  }

  try {
    isLoading.value = true
    error.value = ""
    await MongoService.deactivateUsuario(usuario._id)
    await cargarUsuarios()
  } catch (e) {
    console.error(e)
    error.value = e.message || "Error al desactivar usuario"
  } finally {
    isLoading.value = false
  }
}

async function reactivarUsuario(usuario) {
  try {
    isLoading.value = true
    error.value = ""
    await MongoService.reactivateUsuario(usuario._id)
    await cargarUsuarios()
  } catch (e) {
    console.error(e)
    error.value = e.message || "Error al reactivar usuario"
  } finally {
    isLoading.value = false
  }
}

async function eliminarUsuario(usuario) {
  const isEntrenador = usuario.role === "entrenador"
  const mensaje = isEntrenador
    ? `Estas por eliminar definitivamente al entrenador ${usuario.nombre}.\n\nATENCION:\nEsta accion elimina en cadena sus alumnos y rutinas. No se puede deshacer.`
    : `Estas seguro de que deseas eliminar al administrador ${usuario.nombre}?`

  if (!confirm(mensaje)) {
    return
  }

  try {
    isLoading.value = true
    error.value = ""
    await MongoService.deleteUsuario(usuario._id)
    await cargarUsuarios()
  } catch (e) {
    console.error(e)
    error.value = e.message || "Error al eliminar usuario"
  } finally {
    isLoading.value = false
  }
}

function getEstadoLabel(usuario) {
  return usuario.estado === "inactivo" ? "Inactivo" : "Activo"
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
          <h1>Gestion de Usuarios</h1>
          <p class="subtitle">Administra usuarios, desactiva entrenadores o eliminarlos definitivamente si hace falta</p>
        </div>
      </div>
      <button @click="openCreateModal" class="create-button">+ Crear Usuario</button>
    </div>

    <div class="admin-users-content">
      <div v-if="isLoading && usuarios.length === 0" class="loading">
        Cargando usuarios...
      </div>

      <div v-else class="users-list">
        <div
          v-for="usuario in usuariosOrdenados"
          :key="usuario._id"
          class="user-card"
          :class="{ inactive: usuario.estado === 'inactivo' }"
        >
          <div class="user-info">
            <div class="title-row">
              <h3>{{ usuario.nombre }}</h3>
              <span class="state-badge" :class="usuario.estado || 'activo'">
                {{ getEstadoLabel(usuario) }}
              </span>
            </div>
            <p class="username">@{{ usuario.username }}</p>
            <div class="meta-row">
              <span :class="['role-badge', usuario.role]">
                {{ usuario.role === 'admin' ? 'Administrador' : 'Entrenador' }}
              </span>
              <span v-if="usuario.fechaInactivacion" class="meta-note">
                Inactivo desde {{ new Date(usuario.fechaInactivacion).toLocaleDateString('es-AR') }}
              </span>
            </div>
          </div>

          <div class="user-actions">
            <button @click="openEditModal(usuario)" class="edit-button">
              Editar
            </button>

            <button
              v-if="usuario.role === 'entrenador' && usuario.estado !== 'inactivo'"
              @click="desactivarUsuario(usuario)"
              class="soft-delete-button"
              :disabled="isLoading"
            >
              Desactivar
            </button>

            <button
              v-if="usuario.role === 'entrenador' && usuario.estado === 'inactivo'"
              @click="reactivarUsuario(usuario)"
              class="reactivate-button"
              :disabled="isLoading"
            >
              Reactivar
            </button>

            <button
              v-if="usuario.role === 'entrenador'"
              @click="eliminarUsuario(usuario)"
              class="delete-button"
              :disabled="isLoading"
              title="Eliminacion definitiva con borrado en cadena"
            >
              Eliminar Definitivo
            </button>
          </div>
        </div>
      </div>

      <div v-if="error" class="error-message page-error">
        {{ error }}
      </div>

      <div v-if="usuarios.length === 0 && !isLoading" class="empty-state">
        <p>No hay usuarios registrados</p>
      </div>
    </div>

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
              {{ isEditing ? 'Nueva Contrasena (opcional)' : 'Contrasena *' }}
            </label>
            <input
              id="password"
              v-model="usuarioActual.password"
              type="password"
              placeholder="Contrasena"
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

.back-button,
.create-button,
.edit-button,
.soft-delete-button,
.reactivate-button,
.delete-button,
.cancel-button,
.submit-button,
.close-button {
  cursor: pointer;
  transition: all 0.2s;
}

.back-button {
  background-color: var(--rheb-dark-grey);
  color: var(--rheb-primary-green);
  border: 2px solid var(--rheb-black);
  border-radius: 8px;
  padding: 10px 16px;
  font-size: 1.2rem;
  font-weight: 700;
  min-height: 44px;
  min-width: 44px;
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
  font-size: 0.95rem;
  margin: 4px 0 0 0;
  font-weight: 500;
}

.create-button,
.submit-button {
  background: linear-gradient(135deg, var(--rheb-primary-green) 0%, #ffa500 100%);
  color: var(--rheb-dark-grey);
  border: 2px solid var(--rheb-black);
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 700;
  min-height: 44px;
}

.users-list {
  display: grid;
  gap: 16px;
}

.user-card {
  background: var(--card-bg);
  border: 1px solid var(--input-border);
  border-radius: 16px;
  padding: 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
}

.user-card.inactive {
  opacity: 0.8;
  border-style: dashed;
}

.user-info {
  flex: 1;
}

.title-row,
.meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.user-info h3 {
  margin: 0;
  color: var(--header-text);
  font-size: 1.15rem;
}

.username {
  margin: 8px 0;
  color: var(--subtitle-text);
}

.role-badge,
.state-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 0.8rem;
  font-weight: 700;
}

.role-badge.admin {
  background: rgba(59, 130, 246, 0.12);
  color: #1d4ed8;
}

.role-badge.entrenador {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.state-badge.activo {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
}

.state-badge.inactivo {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}

.meta-note {
  color: var(--subtitle-text);
  font-size: 0.85rem;
}

.user-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.edit-button,
.soft-delete-button,
.reactivate-button,
.delete-button,
.cancel-button {
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 0.85rem;
  font-weight: 700;
  min-height: 42px;
  border: 1px solid transparent;
}

.edit-button {
  background: rgba(59, 130, 246, 0.08);
  color: #1d4ed8;
  border-color: rgba(59, 130, 246, 0.25);
}

.soft-delete-button {
  background: rgba(245, 158, 11, 0.08);
  color: #b45309;
  border-color: rgba(245, 158, 11, 0.25);
}

.reactivate-button {
  background: rgba(34, 197, 94, 0.08);
  color: #15803d;
  border-color: rgba(34, 197, 94, 0.25);
}

.delete-button {
  background: rgba(239, 68, 68, 0.08);
  color: #b91c1c;
  border-color: rgba(239, 68, 68, 0.25);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
}

.modal-content {
  width: min(100%, 520px);
  background: var(--card-bg);
  border-radius: 18px;
  border: 1px solid var(--input-border);
  padding: 22px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.24);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.modal-header h2 {
  margin: 0;
  color: var(--header-text);
}

.close-button {
  background: transparent;
  border: none;
  color: var(--subtitle-text);
  font-size: 1.6rem;
}

.modal-form {
  display: grid;
  gap: 14px;
}

.form-group {
  display: grid;
  gap: 8px;
}

.form-group label {
  color: var(--header-text);
  font-weight: 600;
}

.form-group input,
.form-group select {
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: var(--header-text);
  padding: 12px 14px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 6px;
}

.cancel-button {
  background: transparent;
  color: var(--header-text);
  border-color: var(--input-border);
}

.error-message {
  color: #b91c1c;
  font-weight: 600;
}

.page-error {
  margin-top: 16px;
}

.loading,
.empty-state {
  color: var(--subtitle-text);
  text-align: center;
  padding: 32px 12px;
}

@media (max-width: 720px) {
  .user-card {
    flex-direction: column;
    align-items: stretch;
  }

  .user-actions {
    justify-content: stretch;
  }

  .user-actions button {
    width: 100%;
  }

  .modal-actions {
    flex-direction: column-reverse;
  }

  .modal-actions button {
    width: 100%;
  }
}
</style>
