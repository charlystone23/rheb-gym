<script setup>
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"

const router = useRouter()
const isDarkMode = ref(false)

onMounted(() => {
  const savedTheme = localStorage.getItem('theme') || 'light'
  isDarkMode.value = savedTheme === 'dark'
})

function toggleTheme() {
  const theme = isDarkMode.value ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
}

function goBack() {
  router.push("/admin")
}
</script>

<template>
  <div class="admin-config-container">
    <div class="admin-config-header">
      <div class="header-left">
        <button @click="goBack" class="back-button">←</button>
        <img src="/logo.png" alt="Rheb Logo" class="logo-small" />
        <div>
          <h1>Configuración</h1>
          <p class="subtitle">Personaliza tu experiencia en el panel</p>
        </div>
      </div>
    </div>

    <div class="admin-config-content">
      <div class="config-section">
        <h3>Apariencia</h3>
        <div class="config-item">
          <div class="item-info">
            <span class="item-title">Modo Nocturno</span>
            <span class="item-desc">Cambia entre el tema claro y oscuro</span>
          </div>
          <label class="switch">
            <input type="checkbox" v-model="isDarkMode" @change="toggleTheme">
            <span class="slider round"></span>
          </label>
        </div>
      </div>

      <div class="config-section">
        <h3>Sobre la aplicación</h3>
        <div class="config-item disabled">
          <div class="item-info">
            <span class="item-title">Versión</span>
            <span class="item-desc">v1.2.0 - Rheb Platform</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-config-container {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--page-bg);
  padding: 20px;
}

.admin-config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
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
  padding: 8px 12px;
  font-size: 1.2rem;
  font-weight: 700;
  cursor: pointer;
}

.logo-small { width: 50px; height: 50px; }

.admin-config-header h1 {
  color: var(--header-text);
  margin: 0;
  font-size: 1.75rem;
}

.subtitle {
  color: var(--subtitle-text);
  font-size: 0.9rem;
  margin: 4px 0 0 0;
}

.config-section {
  background: var(--card-bg);
  border-radius: 16px;
  padding: 24px;
  border: 2px solid var(--card-border);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  margin-bottom: 24px;
}

.config-section h3 {
  margin: 0 0 20px 0;
  color: var(--header-text);
  font-size: 1.1rem;
  border-bottom: 1px solid var(--input-border);
  padding-bottom: 12px;
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-title {
  font-weight: 700;
  color: var(--header-text);
}

.item-desc {
  font-size: 0.85rem;
  color: var(--subtitle-text);
}

/* Switch styling */
.switch {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 34px;
}

.switch input { 
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  -webkit-transition: .4s;
  transition: .4s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 26px;
  width: 26px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  -webkit-transition: .4s;
  transition: .4s;
}

input:checked + .slider {
  background-color: var(--rheb-primary-green);
}

input:focus + .slider {
  box-shadow: 0 0 1px var(--rheb-primary-green);
}

input:checked + .slider:before {
  -webkit-transform: translateX(26px);
  -ms-transform: translateX(26px);
  transform: translateX(26px);
  background-color: var(--rheb-dark-grey);
}

.slider.round {
  border-radius: 34px;
}

.slider.round:before {
  border-radius: 50%;
}

.disabled {
  opacity: 0.6;
}
</style>
