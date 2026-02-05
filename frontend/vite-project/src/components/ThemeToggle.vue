<script setup>
import { ref, onMounted } from "vue"

const isDarkMode = ref(false)

onMounted(() => {
  const savedTheme = localStorage.getItem('theme') || 'light'
  isDarkMode.value = savedTheme === 'dark'
  document.documentElement.setAttribute('data-theme', savedTheme)
})

function toggleTheme() {
  const theme = isDarkMode.value ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
}

function handleToggle() {
  isDarkMode.value = !isDarkMode.value
  toggleTheme()
}
</script>

<template>
  <button @click="handleToggle" class="theme-toggle" :title="isDarkMode ? 'Modo Nocturno' : 'Modo Diurno'">
    <span v-if="isDarkMode" class="icon">🌙</span>
    <span v-else class="icon">☀️</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  background: var(--potenza-dark-grey);
  border: 2px solid var(--potenza-black);
  color: var(--potenza-yellow);
  padding: 8px;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1.25rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.theme-toggle:active {
  transform: scale(0.9);
}

.icon {
  line-height: 1;
}

[data-theme="dark"] .theme-toggle {
  background: var(--potenza-yellow);
  color: var(--potenza-dark-grey);
}
</style>
