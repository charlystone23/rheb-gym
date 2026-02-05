<script setup>
import { onMounted } from "vue"

onMounted(() => {
  const savedTheme = localStorage.getItem('theme') || 'light'
  document.documentElement.setAttribute('data-theme', savedTheme)
})
</script>

<template>
  <router-view />
</template>

<style>
/* Global styles are now in style.css */
</style>
